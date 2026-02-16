import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { tenant_id, branch_id } = body;

    if (!tenant_id || !branch_id) {
      return Response.json({ 
        error: 'Missing tenant_id or branch_id' 
      }, { status: 400 });
    }

    console.log(`🔧 Fixing Tenant ${tenant_id}...`);

    // 1. Get Tenant
    const tenants = await base44.asServiceRole.entities.Tenant.filter(
      { id: tenant_id }
    );

    if (!tenants || tenants.length === 0) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    const tenant = tenants[0];
    console.log(`📋 Found: ${tenant.full_name} (status: ${tenant.status})`);

    // 2. Update Tenant: moved_out → active
    await base44.asServiceRole.entities.Tenant.update(tenant_id, {
      status: 'active',
      moved_out_date: null
    });
    console.log(`✅ Tenant status: moved_out → active`);

    // 3. Find & Fix Bookings for this Tenant
    const bookings = await base44.asServiceRole.entities.Booking.filter(
      { tenant_id: tenant_id, branch_id: branch_id },
      '-created_date',
      100
    );

    let fixedBookings = 0;
    if (bookings && bookings.length > 0) {
      for (const booking of bookings) {
        if (booking.status !== 'active') {
          await base44.asServiceRole.entities.Booking.update(booking.id, {
            status: 'active'
          });
          fixedBookings++;
          console.log(`✅ Booking ${booking.id}: ${booking.status} → active`);
        }
      }
    }

    return Response.json({
      success: true,
      message: `Fixed Tenant ${tenant.full_name}`,
      tenant_id,
      previous_status: tenant.status,
      new_status: 'active',
      bookings_fixed: fixedBookings
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});