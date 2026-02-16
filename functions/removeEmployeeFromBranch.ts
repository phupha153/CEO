import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, branch_id } = await req.json();

    // 🔒 Input Validation
    if (!userId || typeof userId !== 'string') {
      return Response.json({ error: 'Invalid userId' }, { status: 400 });
    }
    if (!branch_id || typeof branch_id !== 'string') {
      return Response.json({ error: 'Invalid branch_id' }, { status: 400 });
    }

    // 🔒 SECURITY: ป้องกัน Self-Deletion
    if (userId === user.id) {
      return Response.json({ 
        error: 'คุณไม่สามารถลบตัวเองออกจากสาขาได้' 
      }, { status: 403 });
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
    const targetRole = targetUser.custom_role || (targetUser.role === 'admin' ? 'developer' : 'employee');
    const isOwnerOfBranch = branch.owner_id === user.email || branch.created_by === user.email;
    const isDeveloper = userRole === 'developer';

    // 🔒 CRITICAL: Owner ไม่สามารถลบ Developer ได้
    if (!isDeveloper && targetRole === 'developer') {
      return Response.json({ 
        error: 'คุณไม่มีสิทธิ์ลบ Developer' 
      }, { status: 403 });
    }

    // 🔒 CRITICAL: ป้องกันการลบ Owner ของสาขา
    const isTargetOwnerOfBranch = branch.owner_id === targetUser.email || branch.created_by === targetUser.email;
    if (isTargetOwnerOfBranch) {
      return Response.json({ 
        error: 'ไม่สามารถลบเจ้าของสาขาได้ กรุณาโอนกรรมสิทธิ์ก่อน' 
      }, { status: 403 });
    }

    // 🔒 SECURITY: เฉพาะ Owner/Developer ของสาขาถึงลบได้
    if (!isDeveloper && !isOwnerOfBranch) {
      return Response.json({ 
        error: 'คุณไม่มีสิทธิ์ลบผู้ใช้ในสาขานี้' 
      }, { status: 403 });
    }

    // ⭐ ลบสาขาออกจาก accessible_branches
    const currentBranches = targetUser.accessible_branches || [];
    const updatedBranches = currentBranches.filter(b => b !== branch_id);

    await base44.asServiceRole.entities.User.update(userId, {
      accessible_branches: updatedBranches
    });

    // 📝 บันทึก Audit Log
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        branch_id: branch_id,
        action_type: 'delete',
        entity_type: 'UserBranchAccess',
        entity_id: userId,
        entity_name: `${targetUser.full_name || targetUser.email} ออกจากสาขา ${branch.branch_name}`,
        user_email: user.email,
        user_name: user.full_name,
        description: `ยกเลิกสิทธิ์ของ ${targetUser.full_name || targetUser.email} ออกจากสาขา ${branch.branch_name}`,
        changes: {
          before: currentBranches,
          after: updatedBranches,
          removed_branch: branch.branch_name
        }
      });
    } catch (logError) {
      console.error('⚠️ Failed to create audit log:', logError);
    }

    return Response.json({
      success: true,
      message: `ลบผู้ใช้ ${targetUser.full_name || targetUser.email} ออกจากสาขา ${branch.branch_name} สำเร็จ`,
      updated_branches: updatedBranches
    });

  } catch (error) {
    console.error('❌ Remove employee error:', error);
    
    // 🔒 SECURITY: ไม่เปิดเผย error.message ตรงๆ
    const safeMessage = error.message?.includes('not found') 
      ? 'ไม่พบข้อมูลที่ต้องการ'
      : 'เกิดข้อผิดพลาดในการลบผู้ใช้';
    
    return Response.json({ error: safeMessage }, { status: 500 });
  }
});