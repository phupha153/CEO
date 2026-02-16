import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // คำนวณ userRole
    const userRole = user.custom_role || (user.role === 'admin' ? 'developer' : 'employee');
    const accessibleBranches = user.accessible_branches;

    console.log('🔍 getBranches - User:', {
      email: user.email,
      role: userRole,
      accessible_branches: accessibleBranches
    });

    // ดึงสาขาทั้งหมด
    const branchesResult = await base44.asServiceRole.entities.Branch.list('-created_date', 1000);
    
    console.log('🔍 branchesResult type:', typeof branchesResult, 'isArray:', Array.isArray(branchesResult));
    
    // ✅ Ensure allBranches is always an array
    let allBranches = [];
    if (Array.isArray(branchesResult)) {
      allBranches = branchesResult;
    } else if (branchesResult && typeof branchesResult === 'object' && Array.isArray(branchesResult.data)) {
      allBranches = branchesResult.data;
    } else {
      console.warn('⚠️ Unexpected branchesResult format:', branchesResult);
      allBranches = [];
    }

    // 🔒 SECURITY: กรองตามสิทธิ์
    let filteredBranches = [];

    if (userRole === 'developer') {
      // Developer = เห็นทั้งหมด
      filteredBranches = allBranches;
    } else if (userRole === 'owner') {
      // Owner = สาขาที่สร้างเอง + สาขาที่ถูกชวน
      const ownedBranches = allBranches.filter(b => 
        b.owner_id === user.email || b.created_by === user.email
      );
      const invitedBranches = accessibleBranches 
        ? allBranches.filter(b => accessibleBranches.includes(b.id))
        : [];
      
      // Merge (ไม่ซ้ำ)
      const branchIds = new Set([
        ...ownedBranches.map(b => b.id),
        ...invitedBranches.map(b => b.id)
      ]);
      filteredBranches = allBranches.filter(b => branchIds.has(b.id));
    } else {
      // Employee/Manager = เฉพาะ accessible_branches
      if (accessibleBranches && accessibleBranches.length > 0) {
        filteredBranches = allBranches.filter(b => 
          accessibleBranches.includes(b.id)
        );
      } else {
        filteredBranches = [];
      }
    }

    console.log(`✅ Filtered: ${filteredBranches.length}/${allBranches.length} branches`);

    return Response.json({ 
      data: filteredBranches,
      meta: {
        total: filteredBranches.length,
        user_role: userRole
      }
    });

  } catch (error) {
    console.error('getBranches error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});