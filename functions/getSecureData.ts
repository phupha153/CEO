import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ⭐ Auto-init trial ถ้ายังไม่มี
    if (!user.trial_ends_at) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const trialEndDate = new Date(today);
      trialEndDate.setDate(today.getDate() + 30);
      trialEndDate.setHours(23, 59, 59, 999);

      await base44.asServiceRole.auth.updateUser(user.email, {
        trial_ends_at: trialEndDate.toISOString().split('T')[0],
        plan_status: 'trial'
      });

      // Refresh user object
      user.trial_ends_at = trialEndDate.toISOString().split('T')[0];
      user.plan_status = 'trial';
    }

    // ⭐ ตรวจสอบสถานะ trial ของ user
    const userRole = user.custom_role || (user.role === 'admin' ? 'developer' : 'employee');
    
    console.log('🔍 getSecureData - User Role Check:', {
      email: user.email,
      base_role: user.role,
      custom_role: user.custom_role,
      calculated_role: userRole
    });
    
    // Developer ไม่ต้องเช็ค trial
    if (userRole !== 'developer') {
      const trialEndDate = new Date(user.trial_ends_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (today > trialEndDate && user.plan_status !== 'active') {
        return Response.json({ 
          error: 'Trial expired', 
          trial_ends_at: user.trial_ends_at,
          plan_status: user.plan_status
        }, { status: 403 });
      }
    }

    const { entity, filters = {}, sort = '-created_date', limit = 10000 } = await req.json();

    if (!entity) {
      return Response.json({ error: 'Missing entity parameter' }, { status: 400 });
    }

    // ตรวจสอบสิทธิ์เข้าถึงสาขา (ใช้ตัวแปร userRole จาก line 31 แล้ว)
    const accessibleBranches = user.accessible_branches;

    // Developer ที่ไม่มี accessible_branches = เข้าถึงทุกสาขา
    // Owner ที่ไม่มี accessible_branches = เข้าถึงทุกสาขา (ของตัวเอง)
    const canAccessAllBranches = (userRole === 'developer' || userRole === 'owner') && (!accessibleBranches || accessibleBranches.length === 0);

    console.log('🔍 getSecureData - Access Check:', {
      userRole,
      accessibleBranches,
      canAccessAllBranches,
      requested_branch_id: filters.branch_id
    });

    // ถ้ามี branch_id ใน filters ให้เช็คสิทธิ์
    if (filters.branch_id && !canAccessAllBranches) {
      // ⭐ Owner ที่ไม่มี accessible_branches = ให้เข้าถึงสาขาที่ตัวเองเป็นเจ้าของได้
      if (!accessibleBranches || accessibleBranches.length === 0) {
        if (userRole === 'owner') {
          // ตรวจสอบว่าเป็นเจ้าของสาขานี้หรือไม่
          const branches = await base44.asServiceRole.entities.Branch.filter({ id: filters.branch_id });
          const branch = branches[0];
          
          if (!branch || (branch.owner_id !== user.email && branch.created_by !== user.email)) {
            console.error('❌ Owner cannot access branch - Not the owner:', {
              user: user.email,
              branch_id: filters.branch_id,
              branch_owner: branch?.owner_id,
              branch_created_by: branch?.created_by
            });
            return Response.json({ error: 'Access denied to this branch' }, { status: 403 });
          }
          // ✅ เป็นเจ้าของสาขา - อนุญาต
          console.log('✅ Owner access granted to own branch:', filters.branch_id);
        } else {
          console.error('❌ Access denied - No accessible branches:', {
            user: user.email,
            role: userRole,
            requested_branch: filters.branch_id
          });
          return Response.json({ error: 'Access denied to this branch' }, { status: 403 });
        }
      } else if (!accessibleBranches.includes(filters.branch_id)) {
        console.error('❌ Access denied - Branch not in accessible list:', {
          user: user.email,
          role: userRole,
          requested_branch: filters.branch_id,
          accessible: accessibleBranches
        });
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