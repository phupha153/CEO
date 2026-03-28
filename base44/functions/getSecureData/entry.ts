import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ⭐ คำนวณ userRole
    const userRole = user.custom_role || (user.role === 'admin' ? 'developer' : 'employee');
    
    console.log('🔍 getSecureData - User Access:', {
      email: user.email,
      base_role: user.role,
      custom_role: user.custom_role,
      calculated_role: userRole,
      plan_status: user.plan_status
    });

    const { entity, filters = {}, sort = '-created_date', limit = 1000 } = await req.json();

    if (!entity) {
      return Response.json({ error: 'Missing entity parameter' }, { status: 400 });
    }

    // ตรวจสอบสิทธิ์เข้าถึงสาขา
    const accessibleBranches = user.accessible_branches;

    // Developer/Owner ที่ไม่มี accessible_branches set = เข้าถึงทุกสาขา
    const canAccessAllBranches = (userRole === 'developer' || userRole === 'owner') ? true : (!!accessibleBranches && accessibleBranches.length > 0);

    console.log('🔍 getSecureData - Access Check:', {
      userRole,
      accessibleBranches,
      canAccessAllBranches,
      requested_branch_id: filters.branch_id
    });

    // ถ้ามี branch_id ใน filters ให้เช็คสิทธิ์
    if (filters.branch_id && !canAccessAllBranches) {
      if (!accessibleBranches || !accessibleBranches.includes(filters.branch_id)) {
        console.error('❌ Access denied - User:', user.email, 'Role:', userRole, 'Requested branch:', filters.branch_id, 'Accessible:', accessibleBranches);
        return Response.json({ error: 'Access denied to this branch' }, { status: 403 });
      }
    }

    // ถ้าไม่มี branch_id แต่ user มีข้อจำกัดสาขา ให้กรองเฉพาะสาขาที่เข้าถึงได้
    let finalFilters = { ...filters };
    if (!filters.branch_id && !canAccessAllBranches && accessibleBranches && accessibleBranches.length > 0) {
      // ⚠️ SDK ไม่รองรับ $in operator - ต้องดึงทั้งหมดแล้วกรองเอง
      // แต่ถ้ามีแค่ 1 สาขา ให้ใส่ branch_id ตรงๆ
      if (accessibleBranches.length === 1) {
        finalFilters.branch_id = accessibleBranches[0];
      }
      // ถ้ามีหลายสาขา จะต้องดึงทั้งหมดแล้วกรองเอง (ทำด้านล่าง)
    }

    // ดึงข้อมูล
    let data;
    if (finalFilters.branch_id) {
      // มี branch_id เฉพาะ - ใช้ filter
      data = await base44.asServiceRole.entities[entity].filter(finalFilters, sort, limit);
    } else {
      // ไม่มี branch_id เฉพาะ - ดึงทั้งหมดแล้วกรอง
      data = await base44.asServiceRole.entities[entity].list(sort, limit);
      
      // กรองเฉพาะสาขาที่เข้าถึงได้
      if (!canAccessAllBranches && accessibleBranches && accessibleBranches.length > 0) {
        data = data.filter(item => 
          item.branch_id && accessibleBranches.includes(item.branch_id)
        );
      }
    }

    return Response.json({ 
      data,
      meta: {
        count: data.length,
        entity,
        user_role: userRole,
        accessible_branches: canAccessAllBranches ? 'all' : accessibleBranches
      }
    });

  } catch (error) {
    console.error('getSecureData error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});