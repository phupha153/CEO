import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

/**
 * ⭐ Flexible Tenant CSV/TSV Import
 * Handles Excel exports with missing leading 0s on phone numbers
 * Supports both comma and tab delimiters
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

    const { csv_text, branch_id, preview_only = true, data } = await req.json();

    if (!branch_id) {
      return Response.json(
        { error: 'Missing branch_id' },
        { status: 400 }
      );
    }

    // ⭐ ถ้าได้รับ data สำเร็จแล้ว (จาก preview) ให้ใช้เลย ไม่ต้อง parse ใหม่
    let tenants_data;
    
    if (data && Array.isArray(data)) {
      console.log('✅ Using pre-parsed data:', data.length, 'records');
      tenants_data = data;
    } else if (csv_text) {
      console.log('📄 Parsing CSV text...');
      
      // Parse CSV/TSV with flexible delimiter detection
      const lines = csv_text.trim().split('\n');
    if (lines.length < 2) {
      return Response.json({ error: 'CSV must have headers and data' }, { status: 400 });
    }

    // Detect delimiter (tab or comma)
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    
    // Parse headers - Clean BOM, ZWNBSP, tabs, spaces
    const headers = lines[0]
      .split(delimiter)
      .map(h => h
        .replace(/^\ufeff/, '')      // BOM
        .replace(/\u200b/g, '')      // Zero-Width Space
        .replace(/\t/g, ' ')         // Tab → Space
        .replace(/"/g, '')           // Remove quotes
        .trim()
      );

    console.log('📋 Headers:', headers);

    // Parse data rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = line.split(delimiter).map(v => v.replace(/"/g, '').trim());
      const record = {};
      
      headers.forEach((header, idx) => {
        record[header] = values[idx] || '';
      });

      // ⭐ CRITICAL FIX: Skip rows that are completely empty (all values are empty or just hyphens)
      const hasData = Object.values(record).some(v => v && v !== '-' && v.trim() !== '');
      if (!hasData) {
        continue; // Skip this row
      }

      rows.push(record);
    }

      console.log(`📊 Parsed ${rows.length} records`);
      console.log('Sample record:', rows[0]);

      // ✅ Transform and validate data
      tenants_data = rows.map(record => {
      // Fix phone numbers (add 0 if missing)
      const phone = String(record['เบอร์โทร'] || '').trim();
      const formattedPhone = phone && phone.length === 9 ? '0' + phone : phone;

      const emergency = String(record['เบอร์ติดต่อฉุกเฉิน'] || '').trim();
      const formattedEmergency = emergency && emergency.length === 9 ? '0' + emergency : emergency;

      return {
        full_name: (record['ชื่อ-นามสกุล'] || '').trim(),
        phone: formattedPhone,
        gender: (record['เพศ'] || '').toLowerCase(),
        age: record['อายุ'] ? parseInt(record['อายุ']) : undefined,
        line_id: (record['LINE ID'] || '').trim(),
        national_id: (record['เลขบัตรประชาชน'] || '').trim(),
        email: (record['อีเมล'] || '').trim(),
        address: (record['ที่อยู่'] || '').trim(),
        emergency_contact: formattedEmergency,
        notes: (record['หมายเหตุ'] || '').trim(),
        status: 'active',
        // Booking data
        _booking: {
          room_number: (record['เลขห้อง'] || '').trim(),
          check_in_date: (record['วันเริ่มสัญญา'] || '').trim(),
          check_out_date: (record['วันสิ้นสุดสัญญา'] || '').trim(),
          deposit_amount: record['เงินมัดจำ'] ? parseFloat(record['เงินมัดจำ']) : 0,
          booking_status: (record['สถานะการจอง'] || 'active').toLowerCase()
        }
      };
      });
    } else {
      return Response.json(
        { error: 'Missing csv_text or data' },
        { status: 400 }
      );
    }

    // ✅ PREVIEW ONLY: Return parsed data without creating records
    if (preview_only) {
      return Response.json({
        success: true,
        data: tenants_data,
        count: tenants_data.length,
        message: `อ่านข้อมูลสำเร็จ: ${tenants_data.length} รายการ`
      });
    }

    // ⭐ ACTUAL IMPORT: Create Tenant + Booking records
    console.log('📤 Starting actual import of', tenants_data.length, 'tenants...');
    
    // Fetch existing rooms for validation
    const allRooms = await base44.asServiceRole.entities.Room.filter({ branch_id }, '-room_number', 1000);
    const existingTenants = await base44.asServiceRole.entities.Tenant.filter({ branch_id }, '-created_date', 5000);
    const existingBookings = await base44.asServiceRole.entities.Booking.filter({ branch_id, booking_type: 'monthly' }, '-created_date', 5000);

    let createdCount = 0;
    let updatedCount = 0;
    let bookingsCreated = 0;
    let bookingsUpdated = 0;
    const errors = [];

    for (const record of tenants_data) {
      try {
        const tenantData = {
          full_name: record.full_name,
          phone: record.phone,
          gender: record.gender,
          age: record.age,
          line_id: record.line_id,
          national_id: record.national_id,
          email: record.email,
          address: record.address,
          emergency_contact: record.emergency_contact,
          notes: record.notes,
          status: 'active',
          branch_id
        };

        // Find existing tenant by phone or national_id
        const existingTenant = existingTenants.find(t => 
          (t.phone && record.phone && t.phone === record.phone) ||
          (t.national_id && record.national_id && t.national_id === record.national_id)
        );

        let finalTenant;
        if (existingTenant) {
          await base44.asServiceRole.entities.Tenant.update(existingTenant.id, tenantData);
          finalTenant = existingTenant;
          updatedCount++;
        } else {
          finalTenant = await base44.asServiceRole.entities.Tenant.create(tenantData);
          existingTenants.push(finalTenant);
          createdCount++;
        }

        // ⭐ Create Booking if room_number provided
        const roomNumber = record._booking?.room_number;
        if (roomNumber && String(roomNumber).trim() !== '') {
          const room = allRooms.find(r => r.room_number === String(roomNumber).trim());
          
          if (!room) {
            errors.push(`${record.full_name}: ไม่พบห้อง ${roomNumber}`);
            continue;
          }

          const checkInDate = record._booking.check_in_date || new Date().toISOString().split('T')[0];
          const checkOutDate = record._booking.check_out_date;
          const depositAmount = parseFloat(record._booking.deposit_amount || 0);
          const bookingStatus = (record._booking.booking_status || 'active').toLowerCase();

          const existingBooking = existingBookings.find(b => 
            b.tenant_id === finalTenant.id && b.room_id === room.id
          );

          const bookingData = {
            tenant_id: finalTenant.id,
            room_id: room.id,
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            deposit_amount: depositAmount,
            total_amount: room.price,
            booking_type: 'monthly',
            status: bookingStatus,
            branch_id
          };

          if (existingBooking) {
            await base44.asServiceRole.entities.Booking.update(existingBooking.id, bookingData);
            bookingsUpdated++;
          } else {
            const newBooking = await base44.asServiceRole.entities.Booking.create(bookingData);
            existingBookings.push(newBooking);
            bookingsCreated++;
          }

          // Update room status
          const newRoomStatus = bookingStatus === 'active' ? 'occupied' : 'available';
          if (room.status !== newRoomStatus) {
            await base44.asServiceRole.entities.Room.update(room.id, { status: newRoomStatus });
          }
        }
      } catch (error) {
        errors.push(`${record.full_name || 'Unknown'}: ${error.message}`);
      }
    }

    return Response.json({
      success: true,
      created: createdCount,
      updated: updatedCount,
      bookings_created: bookingsCreated,
      bookings_updated: bookingsUpdated,
      errors,
      message: `นำเข้าสำเร็จ: สร้างใหม่ ${createdCount} คน, อัพเดท ${updatedCount} คน, สัญญา ${bookingsCreated + bookingsUpdated} รายการ`
    });
  } catch (error) {
    console.error('❌ Import error:', error);
    return Response.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
});