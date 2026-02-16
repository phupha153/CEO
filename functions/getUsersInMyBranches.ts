import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { owner_email } = await req.json().catch(() => ({}));
    
    const userRole = currentUser.custom_role || (currentUser.role === 'admin' ? 'owner' : 'employee');

    // ⭐ ใช้ owner_email ที่ส่งมา หรือใช้ currentUser.email
    const targetOwnerEmail = owner_email || currentUser.email;

    // ⭐ Step 1: หา branches ที่ targetOwner เป็นเจ้าของ (ใช้ filter แทน list)
    const myOwnedBranches = await base44.asServiceRole.entities.Branch.filter({
      $or: [
        { owner_id: targetOwnerEmail },
        { created_by: targetOwnerEmail }
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

    // ⭐ Step 3: เพิ่ม targetOwner เข้าไปถ้ายังไม่มี (นับ owner ด้วย)
    const targetOwnerInList = usersInMyBranches.some(u => u.email === targetOwnerEmail);
    if (!targetOwnerInList) {
      // ดึงข้อมูล owner จาก User entity
      const ownerUsers = await base44.asServiceRole.entities.User.filter({ email: targetOwnerEmail }, null, 1);
      if (ownerUsers && ownerUsers.length > 0) {
        const ownerUser = ownerUsers[0];
        usersInMyBranches.push({
          id: ownerUser.id,
          email: ownerUser.email,
          full_name: ownerUser.full_name,
          custom_role: ownerUser.custom_role,
          role: ownerUser.role,
          accessible_branches: ownerUser.accessible_branches || []
        });
      }
    }

    return Response.json({
      users: usersInMyBranches,
      total: usersInMyBranches.length,
      myOwnedBranchIds,
      targetOwnerEmail // เพิ่มเพื่อ debug
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});