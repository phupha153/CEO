import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ดึงข้อมูล users และ branches ทั้งหมด
    const users = await base44.asServiceRole.entities.User.list();
    const branches = await base44.asServiceRole.entities.Branch.list();

    // วิเคราะห์ข้อมูล
    const usersData = users.map(user => ({
      email: user.email,
      full_name: user.full_name,
      custom_role: user.custom_role,
      role: user.role,
      accessible_branches: user.accessible_branches || [],
      accessible_branches_count: (user.accessible_branches || []).length
    }));

    const branchesData = branches.map(branch => ({
      id: branch.id,
      branch_name: branch.branch_name,
      owner_id: branch.owner_id,
      created_by: branch.created_by
    }));

    // หาว่า currentUser เป็น owner ของสาขาไหนบ้าง
    const myOwnedBranchIds = branches
      .filter(b => b.owner_id === currentUser.email || b.created_by === currentUser.email)
      .map(b => b.id);

    // ใช้ logic เดียวกับหน้า Settings
    const usersInMyBranches = users.filter(user => {
      const role = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
      
      if (role === 'developer') return false;
      if (user.email === currentUser?.email) return true;
      if (myOwnedBranchIds.length === 0) return false;
      
      const userBranches = user.accessible_branches || [];
      
      if (userBranches.length === 0) {
        const userOwnedBranches = branches
          .filter(b => b.owner_id === user.email || b.created_by === user.email)
          .map(b => b.id);
        return userOwnedBranches.some(branchId => myOwnedBranchIds.includes(branchId));
      }
      
      return userBranches.some(branchId => myOwnedBranchIds.includes(branchId));
    });

    return Response.json({
      currentUser: {
        email: currentUser.email,
        custom_role: currentUser.custom_role,
        accessible_branches: currentUser.accessible_branches
      },
      myOwnedBranchIds,
      allUsers: usersData,
      allBranches: branchesData,
      usersInMyBranchesCount: usersInMyBranches.length,
      usersInMyBranches: usersInMyBranches.map(u => ({
        email: u.email,
        full_name: u.full_name,
        custom_role: u.custom_role,
        accessible_branches: u.accessible_branches || []
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});