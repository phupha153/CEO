import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branch_id, tenants_data } = await req.json();

    if (!branch_id) {
      return Response.json({ error: 'branch_id is required' }, { status: 400 });
    }

    if (!Array.isArray(tenants_data) || tenants_data.length === 0) {
      return Response.json({ error: 'tenants_data must be a non-empty array' }, { status: 400 });
    }

    // 🔒 SECURITY: Verify user has access to this branch
    const userRole = user.custom_role || (user.role === 'admin' ? 'developer' : 'employee');
    const isDeveloper = userRole === 'developer';
    
    if (!isDeveloper) {
      const accessibleBranches = user.accessible_branches || [];
      if (!accessibleBranches.includes(branch_id)) {
        return Response.json({ error: 'No access to this branch' }, { status: 403 });
      }
    }

    // ⚡ OPTIMIZATION: Fetch all data once
    const [branchRooms, existingTenants, existingBookings] = await Promise.all([
      base44.asServiceRole.entities.Room.filter({ branch_id }, '-room_number', 5000),
      base44.asServiceRole.entities.Tenant.filter({ branch_id }, '-created_date', 5000),
      base44.asServiceRole.entities.Booking.filter({ branch_id, booking_type: 'monthly' }, '-created_date', 5000)
    ]);

    let createdCount = 0;
    let updatedCount = 0;
    let bookingCreatedCount = 0;
    let bookingUpdatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // 📊 BATCH 1: Prepare tenant data
    const tenantsToCreate = [];
    const tenantsToUpdate = [];

    for (const record of tenants_data) {
      const fullName = record.full_name || record['ชื่อ-นามสกุล'];
      
      if (!fullName || fullName.trim() === '') {
        skippedCount++;
        continue;
      }

      const tenantId = record.id || record['รหัส'];
      const existingTenant = tenantId ? existingTenants.find(t => t.id === tenantId) : null;

      const tenantData = {
        full_name: fullName,
        phone: record.phone || record['เบอร์โทร'],
        gender: record.gender || record['เพศ'] || existingTenant?.gender,
        age: record.age || record['อายุ'] ? parseInt(record.age || record['อายุ']) : existingTenant?.age,
        line_id: record.line_id || record['LINE ID'] || existingTenant?.line_id,
        national_id: record.national_id || record['เลขบัตรประชาชน'] || existingTenant?.national_id,
        email: record.email || record['อีเมล'] || existingTenant?.email,
        address: record.address || record['ที่อยู่'] || existingTenant?.address,
        emergency_contact: record.emergency_contact || record['เบอร์ฉุกเฉิน'] || existingTenant?.emergency_contact,
        notes: record.notes || record['หมายเหตุ'] || existingTenant?.notes,
        status: record.status || record['สถานะผู้เช่า'] || existingTenant?.status || 'active',
        line_user_id: existingTenant?.line_user_id,
        branch_id
      };

      if (existingTenant) {
        tenantsToUpdate.push({ id: existingTenant.id, data: tenantData, originalRecord: record });
      } else {
        tenantsToCreate.push({ data: tenantData, originalRecord: record });
      }
    }

    // ⚡ BATCH CREATE: Create all new tenants at once
    let newTenants = [];
    if (tenantsToCreate.length > 0) {
      const bulkData = tenantsToCreate.map(t => t.data);
      newTenants = await base44.asServiceRole.entities.Tenant.bulkCreate(bulkData);
      createdCount = newTenants.length;
      
      // Map created tenants back to original records
      tenantsToCreate.forEach((item, idx) => {
        item.tenant = newTenants[idx];
      });
    }

    // ⚡ BATCH UPDATE: Update existing tenants in chunks
    if (tenantsToUpdate.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < tenantsToUpdate.length; i += chunkSize) {
        const chunk = tenantsToUpdate.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(({ id, data }) => base44.asServiceRole.entities.Tenant.update(id, data))
        );
        updatedCount += chunk.length;
        
        // Delay to prevent rate limit
        if (i + chunkSize < tenantsToUpdate.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }

    // 📊 BATCH 2: Prepare booking data
    const bookingsToCreate = [];
    const bookingsToUpdate = [];
    const roomsToUpdate = [];

    const allProcessedTenants = [
      ...tenantsToCreate.map(t => ({ tenant: t.tenant, record: t.originalRecord })),
      ...tenantsToUpdate.map(t => ({ tenant: existingTenants.find(et => et.id === t.id), record: t.originalRecord }))
    ];

    for (const { tenant, record } of allProcessedTenants) {
      const roomNumber = record.room_number || record['เลขห้อง'];
      
      if (!roomNumber || roomNumber.toString().trim() === '') continue;

      const room = branchRooms.find(r => r.room_number === roomNumber.toString().trim());
      
      if (!room) {
        errors.push(`ห้อง ${roomNumber} ไม่พบในสาขา`);
        continue;
      }

      const checkInDate = record.check_in_date || record['วันเริ่มสัญญา'] || new Date().toISOString().split('T')[0];
      const checkOutDate = record.check_out_date || record['วันสิ้นสุดสัญญา'] || null;
      const depositAmount = parseFloat(record.deposit_amount || record['เงินมัดจำ'] || 0);
      const bookingStatus = record.booking_status || record['สถานะการจอง'] || 'active';

      const bookingData = {
        tenant_id: tenant.id,
        room_id: room.id,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        deposit_amount: depositAmount,
        total_amount: room.price,
        booking_type: 'monthly',
        status: bookingStatus,
        branch_id
      };

      // Check existing booking
      const existingBooking = existingBookings.find(b => 
        b.tenant_id === tenant.id && b.room_id === room.id
      );

      if (existingBooking) {
        bookingsToUpdate.push({ id: existingBooking.id, data: bookingData });
      } else {
        bookingsToCreate.push(bookingData);
      }

      // Prepare room status update
      const newRoomStatus = bookingStatus === 'active' ? 'occupied' : 'available';
      if (room.status !== newRoomStatus) {
        roomsToUpdate.push({ id: room.id, status: newRoomStatus });
      }
    }

    // ⚡ BATCH CREATE: Create all bookings at once
    if (bookingsToCreate.length > 0) {
      await base44.asServiceRole.entities.Booking.bulkCreate(bookingsToCreate);
      bookingCreatedCount = bookingsToCreate.length;
    }

    // ⚡ BATCH UPDATE: Update bookings in chunks
    if (bookingsToUpdate.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < bookingsToUpdate.length; i += chunkSize) {
        const chunk = bookingsToUpdate.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(({ id, data }) => base44.asServiceRole.entities.Booking.update(id, data))
        );
        bookingUpdatedCount += chunk.length;
        
        if (i + chunkSize < bookingsToUpdate.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }

    // ⚡ BATCH UPDATE: Update room statuses in chunks
    if (roomsToUpdate.length > 0) {
      const chunkSize = 50;
      for (let i = 0; i < roomsToUpdate.length; i += chunkSize) {
        const chunk = roomsToUpdate.slice(i, i + chunkSize);
        await Promise.all(
          chunk.map(({ id, status }) => base44.asServiceRole.entities.Room.update(id, { status }))
        );
        
        if (i + chunkSize < roomsToUpdate.length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }
    }

    return Response.json({
      success: true,
      summary: {
        tenants_created: createdCount,
        tenants_updated: updatedCount,
        bookings_created: bookingCreatedCount,
        bookings_updated: bookingUpdatedCount,
        rooms_updated: roomsToUpdate.length,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});