import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { branch_id, room_numbers } = body;

    if (!branch_id || !room_numbers) {
      return Response.json({ 
        error: 'Missing branch_id or room_numbers' 
      }, { status: 400 });
    }

    console.log(`🔍 Debugging rooms: ${room_numbers.join(', ')}`);

    // Fetch all data
    const [rooms, tenants, bookings] = await Promise.all([
      base44.asServiceRole.entities.Room.filter(
        { branch_id },
        '',
        500
      ),
      base44.asServiceRole.entities.Tenant.filter(
        { branch_id },
        '',
        500
      ),
      base44.asServiceRole.entities.Booking.filter(
        { branch_id },
        '-created_date',
        500
      )
    ]);

    const roomMap = {};
    if (rooms) {
      rooms.forEach(r => {
        roomMap[r.room_number] = r;
      });
    }

    const tenantMap = {};
    if (tenants) {
      tenants.forEach(t => {
        tenantMap[t.id] = t;
      });
    }

    const bookingsByRoom = {};
    if (bookings) {
      bookings.forEach(b => {
        if (!bookingsByRoom[b.room_id]) {
          bookingsByRoom[b.room_id] = [];
        }
        bookingsByRoom[b.room_id].push(b);
      });
    }

    // Build results
    const results = [];
    for (const roomNum of room_numbers) {
      const room = roomMap[roomNum];
      if (!room) {
        results.push({
          room: roomNum,
          status: '❌ NOT FOUND'
        });
        continue;
      }

      const roomBookings = bookingsByRoom[room.id] || [];
      const tenantInfo = roomBookings.map(b => {
        const t = tenantMap[b.tenant_id];
        return {
          booking_id: b.id,
          tenant_id: b.tenant_id,
          tenant_name: t?.full_name || 'UNKNOWN',
          booking_status: b.status,
          tenant_status: t?.status || 'UNKNOWN',
          check_in: b.check_in_date,
          is_tenant_active: t?.status === 'active',
          is_booking_active: b.status === 'active'
        };
      });

      results.push({
        room: roomNum,
        room_id: room.id,
        room_status: room.status,
        bookings_count: roomBookings.length,
        tenant_info: tenantInfo.length > 0 ? tenantInfo : 'NO BOOKINGS',
        can_generate_bill: roomBookings.some(b => 
          b.status === 'active' && 
          tenantMap[b.tenant_id]?.status === 'active'
        ) ? '✅ YES' : '❌ NO'
      });
    }

    return Response.json({
      success: true,
      branch_id,
      rooms_checked: room_numbers.length,
      results
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});