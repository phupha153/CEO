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

    console.log(`🔍 Finding Bookings with missing Tenant references in branch: ${branch_id}`);

    // 1. Get all tenants
    const tenants = await base44.asServiceRole.entities.Tenant.filter(
      { branch_id },
      '',
      500
    );
    const validTenantIds = new Set((tenants || []).map(t => t.id));
    console.log(`📊 Found ${validTenantIds.size} valid tenants`);

    // 2. Get all bookings
    let allBookings = [];
    let skip = 0;
    let fetching = true;

    while (fetching) {
      const batch = await base44.asServiceRole.entities.Booking.filter(
        { branch_id },
        '-created_date',
        500,
        skip
      );
      
      if (!batch || batch.length === 0) {
        fetching = false;
      } else {
        allBookings = allBookings.concat(batch);
        skip += batch.length;
      }
    }

    console.log(`📋 Found ${allBookings.length} total bookings`);

    // 3. Find bookings with missing tenant_id
    const brokenBookings = [];
    const validBookings = [];

    for (const booking of allBookings) {
      if (!booking.tenant_id || !validTenantIds.has(booking.tenant_id)) {
        brokenBookings.push(booking);
      } else {
        validBookings.push(booking);
      }
    }

    console.log(`✅ Valid bookings: ${validBookings.length}`);
    console.log(`❌ Broken bookings: ${brokenBookings.length}`);

    // 4. Details of broken bookings
    const brokenDetails = brokenBookings.slice(0, 20).map(b => ({
      booking_id: b.id,
      room_id: b.room_id,
      missing_tenant_id: b.tenant_id,
      status: b.status,
      check_in: b.check_in_date,
      guest_name: b.guest_name
    }));

    return Response.json({
      success: true,
      branch_id,
      valid_tenants: validTenantIds.size,
      total_bookings: allBookings.length,
      valid_bookings: validBookings.length,
      broken_bookings: brokenBookings.length,
      broken_details: brokenDetails,
      message: `Found ${brokenBookings.length} bookings with missing tenant references (showing first 20)`
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});