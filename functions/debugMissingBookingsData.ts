import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetBranchId = body.branch_id;

    console.log('🔍 DEBUGGING MISSING BOOKINGS DATA...');

    const filter = targetBranchId ? { branch_id: targetBranchId } : {};

    // ดึง ALL Rooms + Bookings + Tenants
    const rooms = await base44.asServiceRole.entities.Room.filter(filter, '-room_number', 500);
    const bookings = await base44.asServiceRole.entities.Booking.filter({}, '-created_date', 2000);
    const tenants = await base44.asServiceRole.entities.Tenant.filter(filter, '-created_date', 500);

    const roomsWithBooking = new Set(bookings.filter(b => b.status === 'active').map(b => b.room_id));
    const monthlyRooms = rooms.filter(r => r.room_type === 'monthly');

    // หาห้องที่ไม่มี active booking
    const orphanedRooms = monthlyRooms.filter(r => !roomsWithBooking.has(r.id));

    // สร้าง mapping จาก historical bookings
    const roomToTenantFromHistory = new Map();
    for (const booking of bookings) {
      if (booking.room_id && booking.tenant_id) {
        roomToTenantFromHistory.set(booking.room_id, {
          tenant_id: booking.tenant_id,
          status: booking.status,
          check_in: booking.check_in_date,
          check_out: booking.check_out_date
        });
      }
    }

    const debug = {
      totalRooms: rooms.length,
      monthlyRooms: monthlyRooms.length,
      totalBookings: bookings.length,
      activeBookings: bookings.filter(b => b.status === 'active').length,
      orphanedRooms: orphanedRooms.length,
      orphanedRoomDetails: orphanedRooms.slice(0, 20).map(room => {
        const history = roomToTenantFromHistory.get(room.id);
        const tenant = history ? tenants.find(t => t.id === history.tenant_id) : null;
        return {
          room_number: room.room_number,
          room_id: room.id,
          status: room.status,
          tenant_name: tenant?.full_name || 'UNKNOWN',
          tenant_id: history?.tenant_id || 'UNKNOWN',
          last_booking_status: history?.status || 'UNKNOWN'
        };
      })
    };

    console.log('Debug Info:', JSON.stringify(debug, null, 2));

    return Response.json(debug);

  } catch (err) {
    console.error('❌ Error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});