import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ⭐ ใช้ service role เพื่อดึง users ทั้งหมด
    const allUsers = await base44.asServiceRole.entities.User.list();
    const allBranches = await base44.asServiceRole.entities.Branch.list();

    const userRole = currentUser.custom_role || (currentUser.role === 'admin' ? 'owner' : 'employee');

    // ⭐ หา branches ที่ currentUser เป็นเจ้าของ
    const myOwnedBranchIds = allBranches
      .filter(b => b.owner_id === currentUser.email || b.created_by === currentUser.email)
      .map(b => b.id);

    // ⭐ กรองเฉพาะผู้ใช้ที่อยู่ในสาขาของเรา
    const usersInMyBranches = allUsers.filter(user => {
      const role = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
      
      // ไม่นับ Developer
      if (role === 'developer') return false;
      
      // ⭐ ถ้าเป็น currentUser เอง = นับ
      if (user.email === currentUser.email) return true;
      
      // ผู้ใช้อื่นๆ ต้องมี accessible_branches ที่ตรงกับสาขาที่ currentUser เป็นเจ้าของ
      if (!user.accessible_branches || user.accessible_branches.length === 0) return false;
      return user.accessible_branches.some(branchId => myOwnedBranchIds.includes(branchId));
    });

    return Response.json({
      users: usersInMyBranches,
      total: usersInMyBranches.length,
      myOwnedBranchIds
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});