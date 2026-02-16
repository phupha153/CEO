import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Parse request body
    const body = await req.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return Response.json({ error: 'Missing tenant_id' }, { status: 400 });
    }

    // ดึงข้อมูล tenant (ใช้ service role เพราะหน้านี้ไม่ต้อง login)
    const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: tenant_id });
    const tenant = tenants[0];

    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // ดึงข้อมูล branch
    let branch = null;
    if (tenant.branch_id) {
      const branches = await base44.asServiceRole.entities.Branch.filter({ id: tenant.branch_id });
      branch = branches[0] || null;
    }

    // ดึงชื่อหอพักจาก Config
    const configs = await base44.asServiceRole.entities.Config.list();
    const buildingNameConfig = configs.find(c => c.key === 'building_name' && (!c.branch_id || c.branch_id === tenant.branch_id));
    const buildingName = buildingNameConfig?.value || null;

    return Response.json({
      success: true,
      tenant: {
        id: tenant.id,
        full_name: tenant.full_name,
        phone: tenant.phone,
        line_user_id: tenant.line_user_id || null,
      },
      branch: branch ? {
        id: branch.id,
        branch_name: branch.branch_name,
      } : null,
      building_name: buildingName,
    });

  } catch (error) {
    console.error('Error getting tenant for LINE connect:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});