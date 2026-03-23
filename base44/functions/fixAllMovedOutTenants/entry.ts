import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { branch_id } = body;

    if (!branch_id) {
      return Response.json({ error: 'Missing branch_id' }, { status: 400 });
    }

    console.log(`🔧 Fixing ALL moved_out tenants in branch: ${branch_id}`);

    // 1. Get all moved_out tenants
    const movedOutTenants = await base44.asServiceRole.entities.Tenant.filter(
      { branch_id, status: 'moved_out' },
      '-created_date',
      500
    );

    console.log(`📊 Found ${movedOutTenants?.length || 0} moved_out tenants`);

    if (!movedOutTenants || movedOutTenants.length === 0) {
      return Response.json({
        success: true,
        message: 'No moved_out tenants found',
        fixed: 0
      });
    }

    // 2. Fix all: moved_out → active + Fix Bookings
    let fixedCount = 0;
    const fixedList = [];

    for (const tenant of movedOutTenants) {
      try {
        // Fix Tenant
        await base44.asServiceRole.entities.Tenant.update(tenant.id, {
          status: 'active',
          moved_out_date: null
        });

        // Fix Bookings for this tenant
        const bookings = await base44.asServiceRole.entities.Booking.filter(
          { tenant_id: tenant.id, branch_id },
          '-created_date',
          100
        );

        if (bookings && bookings.length > 0) {
          for (const booking of bookings) {
            if (booking.status !== 'active') {
              await base44.asServiceRole.entities.Booking.update(booking.id, {
                status: 'active'
              });
              console.log(`  ✅ Booking ${booking.id}: ${booking.status} → active`);
            }
          }
        }

        fixedCount++;
        fixedList.push({
          id: tenant.id,
          name: tenant.full_name,
          previous_status: 'moved_out',
          new_status: 'active',
          bookings_fixed: bookings?.length || 0
        });
        console.log(`✅ ${tenant.full_name}: moved_out → active`);
      } catch (err) {
        console.error(`❌ Failed to fix ${tenant.full_name}:`, err.message);
      }
    }

    return Response.json({
      success: true,
      message: `Fixed ${fixedCount}/${movedOutTenants.length} tenants`,
      fixed: fixedCount,
      total: movedOutTenants.length,
      details: fixedList
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});