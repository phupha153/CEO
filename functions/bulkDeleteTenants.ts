import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { tenant_ids, branch_id } = await req.json();

    if (!tenant_ids || !Array.isArray(tenant_ids) || tenant_ids.length === 0) {
      return Response.json({ error: 'tenant_ids is required and must be a non-empty array' }, { status: 400 });
    }

    if (!branch_id) {
      return Response.json({ error: 'branch_id is required' }, { status: 400 });
    }

    console.log(`🗑️ [Bulk Delete] Starting deletion of ${tenant_ids.length} tenants for branch ${branch_id}`);

    let deletedCount = 0;
    const errors = [];

    // ✅ Process in batches of 5 with delay to prevent rate limiting
    const batchSize = 5;
    for (let i = 0; i < tenant_ids.length; i += batchSize) {
      const batch = tenant_ids.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${i / batchSize + 1}/${Math.ceil(tenant_ids.length / batchSize)}`);

      for (const tenantId of batch) {
        try {
          // 0. Backup tenant data (for restore)
          const tenant = await base44.asServiceRole.entities.Tenant.get(tenantId);
          if (tenant) {
            await base44.asServiceRole.entities.DeletedTenant.create({
              original_id: tenantId,
              branch_id: branch_id,
              tenant_data: tenant,
              deleted_by: user.email,
              deleted_date: new Date().toISOString()
            });
          }

          // 1. Delete all payments
          const payments = await base44.asServiceRole.entities.Payment.filter({ tenant_id: tenantId }, '', 1000);
          for (const payment of payments) {
            await base44.asServiceRole.entities.Payment.delete(payment.id);
          }

          // 2. Delete all contracts
          const contracts = await base44.asServiceRole.entities.Contract.filter({ tenant_id: tenantId }, '', 1000);
          for (const contract of contracts) {
            await base44.asServiceRole.entities.Contract.delete(contract.id);
          }

          // 3. Delete bookings and update room status
          const bookings = await base44.asServiceRole.entities.Booking.filter({ tenant_id: tenantId }, '', 1000);
          for (const booking of bookings) {
            if (booking.room_id && booking.status === 'active') {
              try {
                await base44.asServiceRole.entities.Room.update(booking.room_id, { status: 'available' });
              } catch (e) {
                console.warn(`Room update failed: ${e.message}`);
              }
            }
            await base44.asServiceRole.entities.Booking.delete(booking.id);
          }

          // 4. Delete ratings
          const ratings = await base44.asServiceRole.entities.TenantRating.filter({ tenant_id: tenantId }, '', 1000);
          for (const rating of ratings) {
            await base44.asServiceRole.entities.TenantRating.delete(rating.id);
          }

          // 5. Delete tenant
          await base44.asServiceRole.entities.Tenant.delete(tenantId);

          deletedCount++;
          console.log(`✅ Deleted tenant ${tenantId} (${deletedCount}/${tenant_ids.length})`);

        } catch (error) {
          console.error(`❌ Failed to delete tenant ${tenantId}:`, error.message);
          errors.push({ tenant_id: tenantId, error: error.message });
        }
      }

      // ✅ Delay between batches (800ms)
      if (i + batchSize < tenant_ids.length) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }
    }

    console.log(`✅ [Bulk Delete] Completed: ${deletedCount} deleted, ${errors.length} errors`);

    return Response.json({
      success: true,
      deleted: deletedCount,
      errors: errors,
      message: `ลบผู้เช่าสำเร็จ ${deletedCount} คน${errors.length > 0 ? ` (ล้มเหลว ${errors.length} คน)` : ''}`
    });

  } catch (error) {
    console.error('❌ [Bulk Delete] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});