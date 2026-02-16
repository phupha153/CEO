import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { room_number, branch_id } = body;

    if (!room_number || !branch_id) {
      return Response.json({ 
        error: 'Missing room_number or branch_id' 
      }, { status: 400 });
    }

    console.log(`🔍 Debugging Room ${room_number} in branch ${branch_id}`);

    // 1. Get Room
    const rooms = await base44.asServiceRole.entities.Room.filter(
      { branch_id, room_number },
      '',
      1
    );
    const room = rooms && rooms.length > 0 ? rooms[0] : null;

    if (!room) {
      return Response.json({ 
        success: false,
        error: `Room ${room_number} not found in this branch` 
      });
    }

    console.log('🏠 Room found:', room.id, 'Status:', room.status);

    // 2. Get ALL Bookings for this room (not just active)
    const allBookings = await base44.asServiceRole.entities.Booking.filter(
      { room_id: room.id },
      '-created_date',
      100
    );

    console.log(`📋 Total bookings: ${allBookings?.length || 0}`);

    // 3. Get Tenants if any
    const tenantIds = new Set(allBookings?.filter(b => b.tenant_id).map(b => b.tenant_id) || []);
    const tenants = [];
    
    for (const tenantId of tenantIds) {
      const t = await base44.asServiceRole.entities.Tenant.filter(
        { id: tenantId },
        '',
        1
      );
      if (t && t.length > 0) tenants.push(t[0]);
    }

    const tenantMap = {};
    tenants.forEach(t => {
      tenantMap[t.id] = t;
    });

    // 4. Build detailed report
    const bookingDetails = (allBookings || []).map(b => ({
      booking_id: b.id,
      status: b.status,
      booking_type: b.booking_type,
      check_in: b.check_in_date,
      check_out: b.check_out_date,
      tenant_id: b.tenant_id || 'NULL',
      tenant_name: b.tenant_id ? (tenantMap[b.tenant_id]?.full_name || 'TENANT NOT FOUND') : 'NO TENANT',
      tenant_status: b.tenant_id ? (tenantMap[b.tenant_id]?.status || 'UNKNOWN') : 'N/A',
      guest_name: b.guest_name || 'N/A',
      is_active: b.status === 'active',
      is_valid: b.tenant_id && tenantMap[b.tenant_id]?.status === 'active'
    }));

    const activeBookings = bookingDetails.filter(b => b.status === 'active');
    const validActiveBookings = activeBookings.filter(b => b.is_valid);

    return Response.json({
      success: true,
      room_number,
      room_id: room.id,
      room_status: room.status,
      room_type: room.room_type,
      total_bookings: allBookings?.length || 0,
      active_bookings: activeBookings.length,
      valid_active_bookings: validActiveBookings.length,
      issue: validActiveBookings.length === 0 && activeBookings.length > 0 
        ? '⚠️ มี booking status=active แต่ไม่มี tenant ที่ valid (tenant_id null หรือ tenant moved_out)'
        : validActiveBookings.length === 0 
          ? '✅ ไม่มี active booking' 
          : '✅ OK',
      booking_details: bookingDetails,
      suggested_fix: validActiveBookings.length === 0 && activeBookings.length > 0
        ? `อัปเดต Booking status จาก 'active' → 'cancelled' หรือเชื่อม tenant_id ใหม่`
        : room.status === 'reserved' && validActiveBookings.length === 0
          ? `เปลี่ยน Room status จาก 'reserved' → 'available'`
          : null
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});