import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = currentUser.custom_role || (currentUser.role === 'admin' ? 'owner' : 'employee');

    // ⭐ Step 1: หา branches ที่ currentUser เป็นเจ้าของ (ใช้ filter แทน list)
    const myOwnedBranches = await base44.asServiceRole.entities.Branch.filter({
      $or: [
        { owner_id: currentUser.email },
        { created_by: currentUser.email }
      ]
    }, '-created_date', 1000); // จำกัด 1000 สาขา (ถ้ามีเยอะกว่านี้ต้องใช้ cursor)

    const myOwnedBranchIds = myOwnedBranches.map(b => b.id);

    // ⭐ Step 2: ดึงเฉพาะ users ที่มี accessible_branches ตรงกับสาขาของเรา
    // (ใช้ $in query แทนการโหลดทั้งหมด)
    let usersInMyBranches = [];
    
    if (myOwnedBranchIds.length > 0) {
      // Query users ที่มี accessible_branches ตรงกับสาขาเรา
      usersInMyBranches = await base44.asServiceRole.entities.User.filter({
        accessible_branches: { $in: myOwnedBranchIds }
      }, '-created_date', 500); // จำกัด 500 users
      
      // กรองออก Developer
      usersInMyBranches = usersInMyBranches.filter(user => {
        const role = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
        return role !== 'developer';
      });
    }

    // ⭐ Step 3: เพิ่ม currentUser เข้าไปถ้ายังไม่มี
    const currentUserInList = usersInMyBranches.some(u => u.email === currentUser.email);
    if (!currentUserInList) {
      usersInMyBranches.push({
        id: currentUser.id,
        email: currentUser.email,
        full_name: currentUser.full_name,
        custom_role: currentUser.custom_role,
        role: currentUser.role,
        accessible_branches: currentUser.accessible_branches || []
      });
    }

    return Response.json({
      users: usersInMyBranches,
      total: usersInMyBranches.length,
      myOwnedBranchIds
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});