import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

/**
 * ⚡ Fast Room Import - CSV Parser (NO AI)
 * Same approach as flexibleTenantImport for maximum speed
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { csv_text, branch_id, preview_only } = await req.json();

    if (!csv_text || !branch_id) {
      return Response.json(
        { error: 'Missing csv_text or branch_id' },
        { status: 400 }
      );
    }

    console.log('🏠 Fast room import:', { branch_id, preview_only, csv_length: csv_text.length });

    // ⭐ STEP 1: Parse CSV manually (NO AI - super fast!)
    const lines = csv_text.trim().split('\n');
    if (lines.length < 2) {
      return Response.json({ error: 'ไฟล์ต้องมีหัวตารางและข้อมูลอย่างน้อย 1 แถว' }, { status: 400 });
    }

    // Detect delimiter
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    
    // Parse headers - Clean BOM, spaces, quotes
    const headers = lines[0]
      .split(delimiter)
      .map(h => h
        .replace(/^\ufeff/, '')
        .replace(/\u200b/g, '')
        .replace(/"/g, '')
        .trim()
      );

    console.log('📋 Headers:', headers);

    // Parse data rows
    const rawData = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = line.split(delimiter).map(v => v.replace(/"/g, '').trim());
      const record = {};
      
      headers.forEach((header, idx) => {
        record[header] = values[idx] || '';
      });

      // Skip empty rows
      const hasData = Object.values(record).some(v => v && v !== '-' && String(v).trim() !== '');
      if (!hasData) continue;

      rawData.push(record);
    }

    console.log(`📊 Parsed ${rawData.length} rooms from CSV`);

    // ⭐ STEP 2: Transform data (ported from RoomImportConfig.jsx)
    const transformedRooms = rawData.map(row => {
      const room = {
        branch_id: branch_id,
        room_number: String(row['เลขห้อง'] || '').trim(),
        floor: parseInt(row['ชั้น']) || 1,
        status: 'available'
      };

      // Room type mapping
      const roomType = String(row['ประเภทห้อง'] || '').toLowerCase();
      if (roomType.includes('เดือน') || roomType === 'monthly') {
        room.room_type = 'monthly';
      } else if (roomType.includes('วัน') || roomType === 'daily') {
        room.room_type = 'daily';
      } else {
        room.room_type = 'monthly'; // Default
      }

      // Price
      if (row['ราคาห้อง']) {
        room.price = parseFloat(row['ราคาห้อง']);
      }

      // Water rate - flat or per unit
      const isFlatRateWater = String(row['ค่าน้ำเหมา'] || '').toLowerCase();
      if (isFlatRateWater === 'ใช่' || isFlatRateWater === 'yes' || isFlatRateWater === 'เหมา') {
        room.is_flat_rate_water = true;
        room.flat_rate_water_amount = parseFloat(row['จำนวนเงินค่าน้ำเหมา']) || 0;
      } else {
        room.is_flat_rate_water = false;
        room.water_rate = parseFloat(row['ค่าน้ำต่อหน่วย']) || 0;
      }

      // Electricity rate - flat or per unit
      const isFlatRateElec = String(row['ค่าไฟเหมา'] || '').toLowerCase();
      if (isFlatRateElec === 'ใช่' || isFlatRateElec === 'yes' || isFlatRateElec === 'เหมา') {
        room.is_flat_rate_electricity = true;
        room.flat_rate_electricity_amount = parseFloat(row['จำนวนเงินค่าไฟเหมา']) || 0;
      } else {
        room.is_flat_rate_electricity = false;
        room.electricity_rate = parseFloat(row['ค่าไฟต่อหน่วย']) || 0;
      }

      // Minimum charges
      if (row['ค่าน้ำขั้นต่ำ (หน่วย)']) {
        room.min_water_units = parseFloat(row['ค่าน้ำขั้นต่ำ (หน่วย)']);
      }
      if (row['ค่าน้ำขั้นต่ำ (บาท)']) {
        room.min_water_charge = parseFloat(row['ค่าน้ำขั้นต่ำ (บาท)']);
      }
      if (row['ค่าไฟขั้นต่ำ (หน่วย)']) {
        room.min_electricity_units = parseFloat(row['ค่าไฟขั้นต่ำ (หน่วย)']);
      }
      if (row['ค่าไฟขั้นต่ำ (บาท)']) {
        room.min_electricity_charge = parseFloat(row['ค่าไฟขั้นต่ำ (บาท)']);
      }

      // Common fee
      if (row['ค่าส่วนกลาง']) {
        room.common_fee = parseFloat(row['ค่าส่วนกลาง']);
      }

      // Other monthly fees (parse JSON string or comma-separated)
      if (row['ค่าใช้จ่ายอื่นๆ']) {
        const otherFeesStr = String(row['ค่าใช้จ่ายอื่นๆ']).trim();
        if (otherFeesStr && otherFeesStr !== '-') {
          try {
            // Try parsing as JSON first
            room.other_monthly_fees = JSON.parse(otherFeesStr);
          } catch {
            // Parse comma-separated: "ค่าอินเทอร์เน็ต:200, ค่าจอดรถ:300"
            const fees = [];
            const items = otherFeesStr.split(',');
            for (const item of items) {
              const [name, amount] = item.split(':').map(s => s.trim());
              if (name && amount) {
                fees.push({ name, amount: parseFloat(amount) || 0 });
              }
            }
            if (fees.length > 0) {
              room.other_monthly_fees = fees;
            }
          }
        }
      }

      // Size
      if (row['ขนาดห้อง']) {
        room.size = parseFloat(row['ขนาดห้อง']);
      }

      // Amenities (parse comma-separated or JSON array)
      if (row['สิ่งอำนวยความสะดวก']) {
        const amenitiesStr = String(row['สิ่งอำนวยความสะดวก']).trim();
        if (amenitiesStr && amenitiesStr !== '-') {
          try {
            room.amenities = JSON.parse(amenitiesStr);
          } catch {
            room.amenities = amenitiesStr.split(',').map(a => a.trim()).filter(a => a);
          }
        }
      }

      // Description
      if (row['รายละเอียดห้อง']) {
        room.description = String(row['รายละเอียดห้อง']).trim();
      }

      return room;
    });

    console.log('✅ Transformed rooms:', transformedRooms.length);

    // ⭐ STEP 3: Validate required fields
    const validRooms = [];
    const errors = [];

    for (let i = 0; i < transformedRooms.length; i++) {
      const room = transformedRooms[i];
      const rowNum = i + 2; // Excel row number (header = 1)

      // Required fields validation
      if (!room.room_number || !room.floor || !room.room_type || !room.price) {
        errors.push({
          row: rowNum,
          room_number: room.room_number || '(ไม่ระบุ)',
          error: 'ข้อมูลไม่ครบ: ต้องมี เลขห้อง, ชั้น, ประเภทห้อง, และราคาห้อง'
        });
        continue;
      }

      validRooms.push(room);
    }

    if (validRooms.length === 0) {
      return Response.json({
        error: 'ไม่มีข้อมูลห้องพักที่ถูกต้อง',
        errors: errors
      }, { status: 400 });
    }

    // ⭐ NEW: If preview_only, return data for user to confirm
    if (preview_only) {
      console.log('👁️ Preview mode - returning data without importing');
      return Response.json({
        success: true,
        data: validRooms,
        count: validRooms.length,
        skipped: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `อ่านข้อมูลสำเร็จ: ${validRooms.length} รายการ${errors.length > 0 ? ` (ข้าม ${errors.length} รายการ)` : ''}`
      });
    }

    // ⭐ STEP 4: Bulk create rooms (only if NOT preview_only)
    console.log(`💾 Importing ${validRooms.length} rooms to database...`);
    
    const createdRooms = await base44.entities.Room.bulkCreate(validRooms);

    console.log('✅ Import completed:', createdRooms.length, 'rooms');

    return Response.json({
      success: true,
      imported: createdRooms.length,
      skipped: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `นำเข้าข้อมูลสำเร็จ: ${createdRooms.length} ห้อง${errors.length > 0 ? ` (ข้าม ${errors.length} ห้อง)` : ''}`
    });

  } catch (error) {
    console.error('❌ Room import error:', error);
    return Response.json(
      { 
        error: error.message || 'Unknown error',
        stack: error.stack
      },
      { status: 500 }
    );
  }
});