import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import * as XLSX from 'npm:xlsx@0.18.5';

/**
 * ⭐ Fast Room Import (Excel/CSV) - Direct CSV Parsing
 * Supports both CSV text (preview) and pre-transformed data (import)
 * 10x faster than AI extraction
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

    const { csv_text, data, branch_id, preview_only } = await req.json();

    if (!branch_id) {
      return Response.json({ error: 'Missing branch_id' }, { status: 400 });
    }

    // ⭐ MODE 1: Import already-transformed data (from preview)
    if (!preview_only && data && Array.isArray(data)) {
      console.log(`💾 Direct import mode: ${data.length} rooms`);
      
      const createdRooms = await base44.entities.Room.bulkCreate(data);
      
      return Response.json({
        success: true,
        imported: createdRooms.length,
        message: `นำเข้าข้อมูลสำเร็จ: ${createdRooms.length} ห้อง`
      });
    }

    // ⭐ MODE 2: Parse CSV and return preview
    if (!csv_text) {
      return Response.json({ error: 'Missing csv_text or data' }, { status: 400 });
    }

    console.log('🏠 CSV parsing mode:', { branch_id, csv_length: csv_text.length });

    // Parse CSV/TSV with flexible delimiter detection
    const lines = csv_text.trim().split('\n');
    if (lines.length < 2) {
      return Response.json({ error: 'CSV must have headers and data' }, { status: 400 });
    }

    // Detect delimiter (tab or comma)
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    console.log('🔍 Delimiter detected:', delimiter === '\t' ? 'TAB' : 'COMMA');
    
    // Parse headers - Clean BOM, ZWNBSP, tabs, spaces
    const headers = lines[0]
      .split(delimiter)
      .map(h => h
        .replace(/^\ufeff/, '')
        .replace(/\u200b/g, '')
        .replace(/\t/g, ' ')
        .replace(/"/g, '')
        .trim()
      );

    console.log('📋 Headers:', headers);

    // Parse data rows
    const rows = [];
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

      // Skip instruction row
      if (String(record['หมายเลขห้อง'] || record['เลขห้อง'] || '').includes('(คำแนะนำ)')) continue;

      rows.push(record);
    }

    console.log(`📊 Parsed ${rows.length} records`);

    // ⭐ Transform data
    const transformedRooms = rows.map(row => {
      const room = {
        branch_id: branch_id,
        room_number: String(row['หมายเลขห้อง'] || row['เลขห้อง'] || '').trim(),
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

      // Price - รองรับทั้ง "ราคา" และ "ราคาห้อง"
      let priceStr = row['ราคา'] || row['ราคาห้อง'] || '0';
      room.price = parseFloat(priceStr) || 0;

      // Water rate - flat or per unit
      const isFlatRateWater = String(row['ค่าน้ำเหมา'] || 'ไม่ใช่').toLowerCase();
      if (isFlatRateWater === 'ใช่' || isFlatRateWater === 'yes' || isFlatRateWater === 'เหมา' || isFlatRateWater === 'true') {
        room.is_flat_rate_water = true;
        room.flat_rate_water_amount = parseFloat(row['จำนวนค่าน้ำเหมา'] || row['จำนวนเงินค่าน้ำเหมา']) || 0;
      } else {
        room.is_flat_rate_water = false;
        room.water_rate = parseFloat(row['ค่าน้ำต่อหน่วย']) || null;
      }

      // Electricity rate - flat or per unit
      const isFlatRateElec = String(row['ค่าไฟเหมา'] || 'ไม่ใช่').toLowerCase();
      if (isFlatRateElec === 'ใช่' || isFlatRateElec === 'yes' || isFlatRateElec === 'เหมา' || isFlatRateElec === 'true') {
        room.is_flat_rate_electricity = true;
        room.flat_rate_electricity_amount = parseFloat(row['จำนวนค่าไฟเหมา'] || row['จำนวนเงินค่าไฟเหมา']) || 0;
      } else {
        room.is_flat_rate_electricity = false;
        room.electricity_rate = parseFloat(row['ค่าไฟต่อหน่วย']) || null;
      }

      // Common fee
      if (row['ค่าส่วนกลาง']) {
        room.common_fee = parseFloat(row['ค่าส่วนกลาง']);
      }

      // Size
      if (row['ขนาด']) {
        room.size = parseFloat(row['ขนาด']);
      }

      // Description
      if (row['รายละเอียด']) {
        room.description = String(row['รายละเอียด']).trim();
      }

      return room;
    });

    console.log('✅ Transformed rooms:', transformedRooms.length);
    if (transformedRooms.length > 0) {
      console.log('Sample room:', JSON.stringify(transformedRooms[0], null, 2));
    }

    // ⭐ STEP 4: Validate required fields
    const validRooms = [];
    const errors = [];

    for (let i = 0; i < transformedRooms.length; i++) {
      const room = transformedRooms[i];
      const rowNum = i + 2;

      // Required fields validation
      if (!room.room_number || !room.floor || !room.room_type || room.price === undefined || isNaN(room.price)) {
        errors.push({
          row: rowNum,
          room_number: room.room_number || '(ไม่ระบุ)',
          error: 'ข้อมูลไม่ครบ: ต้องมี หมายเลขห้อง, ชั้น, และประเภทห้อง'
        });
        console.warn(`❌ Row ${rowNum} validation failed:`, room);
        continue;
      }

      validRooms.push(room);
    }

    console.log(`✅ Valid rooms: ${validRooms.length}, Errors: ${errors.length}`);

    if (validRooms.length === 0) {
      return Response.json({
        success: false,
        error: 'ไม่มีข้อมูลห้องพักที่ถูกต้อง',
        errors: errors
      }, { status: 400 });
    }

    // ⭐ Preview mode - return data for user to confirm
    if (preview_only) {
      console.log('👁️ Preview mode - returning data');
      return Response.json({
        success: true,
        data: validRooms,
        count: validRooms.length,
        skipped: errors.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `อ่านข้อมูลสำเร็จ: ${validRooms.length} รายการ${errors.length > 0 ? ` (ข้าม ${errors.length} รายการ)` : ''}`
      });
    }

    // ⭐ Import mode - should not reach here (we use direct import mode now)
    console.log(`💾 Importing ${validRooms.length} rooms to database...`);
    const createdRooms = await base44.entities.Room.bulkCreate(validRooms);

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