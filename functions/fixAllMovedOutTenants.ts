import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // 2. Fix all: moved_out → active
    let fixedCount = 0;
    const fixedList = [];

    for (const tenant of movedOutTenants) {
      try {
        await base44.asServiceRole.entities.Tenant.update(tenant.id, {
          status: 'active',
          moved_out_date: null
        });
        fixedCount++;
        fixedList.push({
          id: tenant.id,
          name: tenant.full_name,
          previous_status: 'moved_out',
          new_status: 'active'
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