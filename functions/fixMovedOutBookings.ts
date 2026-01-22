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

    console.log('🔧 FIXING MOVED-OUT TENANT BOOKINGS...');
    console.log(`📍 Branch: ${targetBranchId || 'ALL'}`);

    const filter = targetBranchId ? { branch_id: targetBranchId } : {};

    // 1. ดึง Tenants ที่ status="moved_out"
    const movedOutTenants = await base44.asServiceRole.entities.Tenant.filter(
      { ...filter, status: 'moved_out' },
      '-created_date',
      1000
    );

    console.log(`\n📊 Found ${movedOutTenants?.length || 0} moved_out tenants`);

    if (!movedOutTenants || movedOutTenants.length === 0) {
      return Response.json({
        success: true,
        message: 'No moved_out tenants found',
        fixed: 0
      });
    }

    // 2. สำหรับแต่ละ moved_out tenant หา active bookings
    let totalFixed = 0;
    const fixes = [];

    for (const tenant of movedOutTenants) {
      const activeBookings = await base44.asServiceRole.entities.Booking.filter(
        { tenant_id: tenant.id, status: 'active' },
        '-created_date',
        100
      );

      if (activeBookings && activeBookings.length > 0) {
        console.log(`\n🔴 Tenant: ${tenant.full_name} (ID: ${tenant.id})`);
        console.log(`   Status: moved_out | Active Bookings: ${activeBookings.length}`);

        // 3. ปิด active bookings
        for (const booking of activeBookings) {
          try {
            await base44.asServiceRole.entities.Booking.update(booking.id, {
              status: 'completed'
            });

            fixes.push({
              tenantName: tenant.full_name,
              tenantStatus: 'moved_out',
              roomId: booking.room_id,
              bookingId: booking.id,
              action: 'closed booking'
            });

            totalFixed++;
            console.log(`   ✅ Closed booking in Room ${booking.room_id}`);
          } catch (err) {
            console.error(`   ❌ Failed to close booking: ${err.message}`);
          }
        }
      }
    }

    console.log(`\n✅ FIXED: ${totalFixed} bookings closed`);

    return Response.json({
      success: true,
      message: `Fixed ${totalFixed} moved_out tenant bookings`,
      fixed: totalFixed,
      details: fixes
    });

  } catch (err) {
    console.error('❌ Error:', err);
    return Response.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
});