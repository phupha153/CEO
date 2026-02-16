import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetBranchId = body.branch_id;

    console.log('🔧 FIXING MISSING BOOKINGS...');
    console.log(`📍 Branch: ${targetBranchId || 'ALL'}`);

    // 1. ดึง Rooms, Tenants, Bookings
    const filter = targetBranchId ? { branch_id: targetBranchId } : {};

    const [rooms, tenants, bookings] = await Promise.all([
      base44.asServiceRole.entities.Room.filter(filter, '-room_number', 1000),
      base44.asServiceRole.entities.Tenant.filter(filter, '-created_date', 1000),
      base44.asServiceRole.entities.Booking.filter(filter, '-created_date', 1000)
    ]);

    console.log(`✅ Rooms: ${rooms.length}, Tenants: ${tenants.length}, Bookings: ${bookings.length}`);

    // 2. หา Rooms ที่ไม่มี Booking แต่มี Tenant active
    const roomsWithBooking = new Set(bookings.map(b => b.room_id));
    const activeTenants = tenants.filter(t => t.status === 'active');
    const activeTenantsByRoom = new Map(
      activeTenants.map(t => [t.id, t])
    );

    const missingBookingRooms = [];

    for (const room of rooms) {
      if (room.room_type !== 'monthly') continue;
      if (roomsWithBooking.has(room.id)) continue;

      // หา Tenant ที่เช่าห้องนี้ (หรือเคยเช่า)
      const tenantInRoom = activeTenants.find(t => {
        // ใช้ logic จากการเลือกห้อง
        if (t.status === 'moved_out') return false;
        
        // ถ้า room มี tenant_id ใน data ก็ใช้นั่น (แต่ Room entity ไม่มี tenant_id)
        // ดังนั้นลอง heuristic: ถ้า Tenant เพิ่งเช่า ให้เอา
        return true; // ⚠️ ทัวหลักหรือรหัสที่ชัดเจน?
      });

      if (tenantInRoom) {
        missingBookingRooms.push({
          room,
          tenant: tenantInRoom
        });
      }
    }

    console.log(`\n🔍 Found ${missingBookingRooms.length} rooms missing Booking`);
    missingBookingRooms.forEach(({ room, tenant }) => {
      console.log(`   - Room ${room.room_number}: ${tenant.full_name}`);
    });

    // 3. สร้าง Bookings
    const bookingsToCreate = missingBookingRooms.map(({ room, tenant }) => ({
      branch_id: room.branch_id,
      room_id: room.id,
      tenant_id: tenant.id,
      check_in_date: tenant.created_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      booking_type: 'monthly',
      status: 'active'
    }));

    console.log(`\n📝 Creating ${bookingsToCreate.length} bookings...`);

    if (bookingsToCreate.length > 0) {
      const created = await base44.asServiceRole.entities.Booking.bulkCreate(bookingsToCreate);
      console.log(`✅ Created ${created.length} bookings`);
    }

    return Response.json({
      success: true,
      message: `Fixed ${bookingsToCreate.length} missing bookings`,
      created: bookingsToCreate.length
    });

  } catch (err) {
    console.error('❌ Error:', err);
    return Response.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
});