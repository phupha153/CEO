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

    console.log('🔧 FIXING TENANT STATUS MISMATCH...');
    console.log(`📍 Branch: ${targetBranchId || 'ALL'}`);

    // 1. ดึง Tenants, Bookings, Contracts
    const filter = targetBranchId ? { branch_id: targetBranchId } : {};
    
    let allMovedOutTenants = [];
    let skip = 0;
    let fetching = true;

    // ดึง Tenants ที่ status="moved_out" ทั้งหมด
    console.log('\n📥 Fetching moved_out tenants...');
    while (fetching) {
      const batch = await base44.asServiceRole.entities.Tenant.filter(
        { ...filter, status: 'moved_out' },
        '-created_date',
        200,
        skip
      );

      if (!batch || batch.length === 0) {
        fetching = false;
        break;
      }

      allMovedOutTenants = allMovedOutTenants.concat(batch);
      skip += batch.length;
      console.log(`   Batch: ${batch.length} (total: ${allMovedOutTenants.length})`);

      if (batch.length < 200) {
        fetching = false;
      }
    }

    console.log(`✅ Found ${allMovedOutTenants.length} moved_out tenants`);

    // 2. ดึง Bookings active ทั้งหมด
    const activeBookings = await base44.asServiceRole.entities.Booking.filter(
      { ...filter, status: 'active' },
      '-created_date',
      1000
    );

    const bookingsByTenant = new Map(
      activeBookings.map(b => [b.tenant_id, b])
    );

    console.log(`✅ Found ${activeBookings.length} active bookings`);

    // 3. ดึง Contracts active แค่ 500 รายการ (ข้ามหาก Booking แล้ว)
    const contractsByTenant = new Map();
    
    console.log(`✅ Skipping contract check (using booking as primary source)`);

    // 4. หา Tenants ที่ status ผิด (มี active Booking หรือ Contract แต่ status="moved_out")
    const tenantsFix = [];

    for (const tenant of allMovedOutTenants) {
      const hasActiveBooking = bookingsByTenant.has(tenant.id);

      // ⭐ ต้อง active booking เท่านั้น (contract อาจขึ้นอยู่กับ booking)
      if (hasActiveBooking) {
        const booking = bookingsByTenant.get(tenant.id);
        tenantsFix.push({
          tenantId: tenant.id,
          tenantName: tenant.full_name,
          room: booking?.room_id || 'N/A'
        });
      }
    }

    console.log(`\n🔴 Found ${tenantsFix.length} tenants with STATUS MISMATCH`);

    if (tenantsFix.length > 0) {
      console.log('\n📋 Details:');
      tenantsFix.forEach(item => {
        console.log(`   - Room: ${item.room}, Tenant: ${item.tenantName}`);
      });

      // 5. อัพเดต Tenant.status = "active"
      console.log(`\n⏳ Updating ${tenantsFix.length} tenants...`);

      let successCount = 0;
      for (const item of tenantsFix) {
        try {
          await base44.asServiceRole.entities.Tenant.update(item.tenantId, {
            status: 'active'
          });
          successCount++;
          console.log(`   ✅ ${item.tenantName}: moved_out → active`);
        } catch (err) {
          console.error(`   ❌ ${item.tenantName}: ${err.message}`);
        }
      }

      console.log(`\n✅ FIXED: ${successCount}/${tenantsFix.length} tenants`);
    }

    return Response.json({
      success: true,
      message: `Fixed ${tenantsFix.length} tenants with status mismatch`,
      fixed: tenantsFix.length,
      details: tenantsFix
    });

  } catch (err) {
    console.error('❌ Error:', err);
    return Response.json({
      success: false,
      error: err.message
    }, { status: 500 });
  }
});