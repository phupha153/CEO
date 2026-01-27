import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, branch_id } = await req.json();

    if (!userId || !branch_id) {
      return Response.json({ error: 'Missing required fields: userId, branch_id' }, { status: 400 });
    }

    // ⭐ ดึงข้อมูล user ที่จะถูกลบ
    const targetUser = await base44.asServiceRole.entities.User.get(userId);
    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // ⭐ ดึงข้อมูลสาขาเพื่อเช็คสิทธิ์
    const branch = await base44.asServiceRole.entities.Branch.get(branch_id);
    if (!branch) {
      return Response.json({ error: 'Branch not found' }, { status: 404 });
    }

    // 🔒 SECURITY CHECK: เฉพาะ Owner/Developer ของสาขาถึงลบ user ได้
    const userRole = user.custom_role || (user.role === 'admin' ? 'developer' : 'employee');
    const isOwnerOfBranch = branch.owner_id === user.email || branch.created_by === user.email;
    const isDeveloper = userRole === 'developer';

    if (!isDeveloper && !isOwnerOfBranch) {
      return Response.json({ 
        error: 'Forbidden: คุณไม่มีสิทธิ์ลบผู้ใช้ในสาขานี้' 
      }, { status: 403 });
    }

    // ⭐ ลบสาขาออกจาก accessible_branches
    const currentBranches = targetUser.accessible_branches || [];
    const updatedBranches = currentBranches.filter(b => b !== branch_id);

    await base44.asServiceRole.entities.User.update(userId, {
      accessible_branches: updatedBranches
    });

    return Response.json({
      success: true,
      message: `ลบผู้ใช้ ${targetUser.full_name || targetUser.email} ออกจากสาขา ${branch.branch_name} สำเร็จ`,
      updated_branches: updatedBranches
    });

  } catch (error) {
    console.error('❌ Remove employee error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});