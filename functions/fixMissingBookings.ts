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

    console.log('🔧 FIXING MISSING BOOKINGS...');
    console.log(`📍 Branch: ${targetBranchId || 'ALL'}`);

    const filter = targetBranchId ? { branch_id: targetBranchId } : {};

    // 1. ดึงข้อมูล
    const [rooms, tenants, bookings, contracts, payments] = await Promise.all([
      base44.asServiceRole.entities.Room.filter(filter, '-room_number', 1000),
      base44.asServiceRole.entities.Tenant.filter(filter, '-created_date', 1000),
      base44.asServiceRole.entities.Booking.filter(filter, '-created_date', 1000),
      base44.asServiceRole.entities.Contract.filter(filter, '-contract_date', 1000),
      base44.asServiceRole.entities.Payment.filter(filter, '-created_date', 1000)
    ]);

    console.log(`✅ Rooms: ${rooms.length}, Tenants: ${tenants.length}, Bookings: ${bookings.length}`);

    // 2. สร้าง mapping: room_id → tenant_id จาก Contracts & Payments
    const roomToTenantMap = new Map();

    // จาก Contracts
    for (const contract of contracts) {
      if (contract.room_id && contract.tenant_id) {
        roomToTenantMap.set(contract.room_id, contract.tenant_id);
      }
    }

    // จาก Payments (ถ้า Contract ไม่มี)
    for (const payment of payments) {
      if (payment.room_id && payment.tenant_id && !roomToTenantMap.has(payment.room_id)) {
        roomToTenantMap.set(payment.room_id, payment.tenant_id);
      }
    }

    console.log(`\n🔗 Found ${roomToTenantMap.size} room-tenant mappings`);

    // 3. หา Rooms ที่ไม่มี Booking
    const roomsWithBooking = new Set(bookings.map(b => b.room_id));
    const activeTenants = new Map(tenants.filter(t => t.status === 'active').map(t => [t.id, t]));

    const bookingsToCreate = [];

    for (const room of rooms) {
      if (room.room_type !== 'monthly') continue;
      if (roomsWithBooking.has(room.id)) continue;

      const tenantId = roomToTenantMap.get(room.id);
      const tenant = tenantId ? activeTenants.get(tenantId) : null;

      if (!tenant) continue;

      bookingsToCreate.push({
        branch_id: room.branch_id,
        room_id: room.id,
        tenant_id: tenant.id,
        check_in_date: tenant.created_date?.split('T')[0] || new Date().toISOString().split('T')[0],
        booking_type: 'monthly',
        status: 'active'
      });

      console.log(`   ✏️ Room ${room.room_number}: ${tenant.full_name}`);
    }

    // 4. สร้าง Bookings
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