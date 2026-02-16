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

    console.log(`🔗 Linking broken bookings to tenants in branch: ${branch_id}`);

    // 1. Get all tenants
    const tenants = await base44.asServiceRole.entities.Tenant.filter(
      { branch_id },
      '-created_date',
      500
    );
    const validTenantIds = new Set((tenants || []).map(t => t.id));
    const tenantMap = new Map((tenants || []).map(t => [t.id, t]));
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

    // 3. Find broken bookings
    const brokenBookings = allBookings.filter(b => 
      !b.tenant_id || !validTenantIds.has(b.tenant_id)
    );
    const validBookings = allBookings.filter(b => 
      b.tenant_id && validTenantIds.has(b.tenant_id)
    );

    console.log(`❌ Broken bookings: ${brokenBookings.length}`);
    console.log(`✅ Valid bookings: ${validBookings.length}`);

    // 4. Map: room_id → active tenants
    const roomToTenantsMap = new Map();
    for (const tenant of tenants) {
      // Find bookings for this tenant in this branch
      const tenantBookings = validBookings.filter(b => b.tenant_id === tenant.id);
      
      for (const booking of tenantBookings) {
        if (!roomToTenantsMap.has(booking.room_id)) {
          roomToTenantsMap.set(booking.room_id, []);
        }
        roomToTenantsMap.get(booking.room_id).push({
          tenant_id: tenant.id,
          tenant_name: tenant.full_name,
          tenant_status: tenant.status,
          booking_status: booking.status,
          check_in: booking.check_in_date
        });
      }
    }

    console.log(`🗺️ Rooms with active tenants: ${roomToTenantsMap.size}`);

    // 5. Link broken bookings to tenants by room_id
    const linkedResults = [];
    const failedToLink = [];

    for (const brokenBooking of brokenBookings) {
      const roomId = brokenBooking.room_id;
      const tenantsInRoom = roomToTenantsMap.get(roomId);

      if (!tenantsInRoom || tenantsInRoom.length === 0) {
        failedToLink.push({
          booking_id: brokenBooking.id,
          room_id: roomId,
          reason: 'No active tenants found in this room',
          old_tenant_id: brokenBooking.tenant_id
        });
        console.log(`   ❌ Room ${roomId}: No active tenants found`);
        continue;
      }

      // Use the first active tenant (most recent check-in)
      const targetTenant = tenantsInRoom[0];
      const oldTenantId = brokenBooking.tenant_id;

      try {
        await base44.asServiceRole.entities.Booking.update(brokenBooking.id, {
          tenant_id: targetTenant.tenant_id
        });

        linkedResults.push({
          booking_id: brokenBooking.id,
          room_id: roomId,
          old_tenant_id: oldTenantId,
          new_tenant_id: targetTenant.tenant_id,
          new_tenant_name: targetTenant.tenant_name,
          status: 'linked'
        });

        console.log(`   ✅ Booking ${brokenBooking.id.slice(0, 8)}: Linked to tenant ${targetTenant.tenant_name}`);
      } catch (err) {
        failedToLink.push({
          booking_id: brokenBooking.id,
          room_id: roomId,
          reason: err.message,
          old_tenant_id: oldTenantId
        });
        console.error(`   ❌ Failed to link booking: ${err.message}`);
      }
    }

    console.log(`\n✅ Successfully linked: ${linkedResults.length}`);
    console.log(`❌ Failed to link: ${failedToLink.length}`);

    return Response.json({
      success: true,
      branch_id,
      total_broken_bookings: brokenBookings.length,
      successfully_linked: linkedResults.length,
      failed_to_link: failedToLink.length,
      linked_details: linkedResults.slice(0, 20),
      failed_details: failedToLink.slice(0, 10),
      message: `Linked ${linkedResults.length}/${brokenBookings.length} broken bookings to tenants`
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});