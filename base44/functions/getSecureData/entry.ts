import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = user.custom_role || (user.role === 'admin' ? 'developer' : 'employee');

    const { entity, filters = {}, sort = '-created_date', limit = 500 } = await req.json();

    if (!entity) {
      return Response.json({ error: 'Missing entity parameter' }, { status: 400 });
    }

    // 🔒 SECURITY: branch_id ต้องมีเสมอ
    if (!filters.branch_id) {
      return Response.json({ error: 'Missing branch_id filter' }, { status: 400 });
    }

    // 🔒 SECURITY: ตรวจสอบสิทธิ์เข้าถึงสาขา
    const accessibleBranches = user.accessible_branches;
    const isDeveloperOrOwner = userRole === 'developer' || userRole === 'owner';

    if (!isDeveloperOrOwner) {
      // Non-developer: ต้องมี accessible_branches และสาขาที่ขอต้องอยู่ในลิสต์
      if (!accessibleBranches || !accessibleBranches.includes(filters.branch_id)) {
        console.error('❌ Access denied:', user.email, 'branch:', filters.branch_id, 'accessible:', accessibleBranches);
        return Response.json({ error: 'Access denied to this branch' }, { status: 403 });
      }
    }

    // ✅ Cap limit ไม่เกิน 2000 เพื่อป้องกัน memory overflow
    const safeLimit = Math.min(limit, 2000);

    console.log('✅ getSecureData:', { entity, branch_id: filters.branch_id, userRole, limit: safeLimit });

    // ✅ ใช้ filter เสมอ — มี branch_id เป็น mandatory แล้ว
    const data = await base44.asServiceRole.entities[entity].filter(filters, sort, safeLimit);

    return Response.json({
      data,
      meta: {
        count: data.length,
        entity,
        user_role: userRole,
        branch_id: filters.branch_id
      }
    });

  } catch (error) {
    console.error('getSecureData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});