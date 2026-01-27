import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// รายการสิทธิ์ที่ถูกต้องทั้งหมด
const VALID_PERMISSIONS = [
  'dashboard_view',
  'rooms_view', 'rooms_add', 'rooms_edit', 'rooms_delete',
  'tenants_view', 'tenants_add', 'tenants_edit', 'tenants_delete',
  'bookings_view_daily', 'bookings_add_daily', 'bookings_edit_daily', 'bookings_delete_daily',
  'contracts_view_monthly', 'contracts_add_monthly', 'contracts_edit_monthly', 'contracts_delete_monthly',
  'payments_view', 'payments_add', 'payments_edit', 'bookings_edit_deposit', 'payments_delete', 
  'payments_update_status', 'payments_send_receipt', 'payments_generate_bills', 'payments_send_bills_bulk',
  'meter_readings_view', 'meter_readings_add', 'meter_readings_edit', 'meter_readings_edit_history', 'meter_readings_delete',
  'expenses_view', 'expenses_add', 'expenses_edit', 'expenses_delete',
  'maintenance_view', 'maintenance_add', 'maintenance_edit', 'maintenance_delete', 'maintenance_update_status',
  'reports_view_all', 'reports_export',
  'accounting_view_all', 'accounting_export',
  'announcements_send',
  'settings_view', 'settings_edit', 'settings_access_package_page', 'settings_access_test_mode'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userId, permissions } = await req.json();

    // 🔒 Input Validation
    if (!userId || typeof userId !== 'string') {
      return Response.json({ error: 'Invalid userId' }, { status: 400 });
    }

    if (!Array.isArray(permissions)) {
      return Response.json({ error: 'permissions must be an array' }, { status: 400 });
    }

    // 🔒 Validate permissions list
    const invalidPermissions = permissions.filter(p => !VALID_PERMISSIONS.includes(p));
    if (invalidPermissions.length > 0) {
      return Response.json({ 
        error: `Invalid permissions: ${invalidPermissions.join(', ')}`,
        valid_permissions: VALID_PERMISSIONS
      }, { status: 400 });
    }

    // 🔒 ดึงข้อมูล target user
    const targetUser = await base44.asServiceRole.entities.User.get(userId);
    if (!targetUser) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // 🔒 SECURITY: เช็คว่า current user มีสิทธิ์ update target user หรือไม่
    const currentRole = currentUser.custom_role || (currentUser.role === 'admin' ? 'developer' : 'employee');
    const targetRole = targetUser.custom_role || (targetUser.role === 'admin' ? 'developer' : 'employee');

    // ⚠️ ห้าม update developer
    if (targetRole === 'developer' && currentRole !== 'developer') {
      return Response.json({ error: 'ไม่สามารถแก้ไขสิทธิ์ของ Developer ได้' }, { status: 403 });
    }

    // ⚠️ ห้าม update ตัวเอง
    if (userId === currentUser.id) {
      return Response.json({ error: 'ไม่สามารถแก้ไขสิทธิ์ของตัวเองได้' }, { status: 403 });
    }

    // 🔒 Multi-Tenant Check: ตรวจสอบว่า target user อยู่ในสาขาที่ current user ดูแล
    if (currentRole !== 'developer') {
      // ดึงสาขาที่ current user เป็นเจ้าของ
      const ownedBranches = await base44.asServiceRole.entities.Branch.filter({
        owner_id: currentUser.email
      }, '', 1000);

      const ownedBranchIds = ownedBranches.map(b => b.id);

      // เช็คว่า target user อยู่ในสาขาใดสาขาหนึ่งที่เราดูแล
      const targetBranches = targetUser.accessible_branches || [];
      const hasCommonBranch = targetBranches.some(branchId => ownedBranchIds.includes(branchId));

      // หรือเป็น owner ของสาขาเดียวกัน
      const isOwnerOfSameBranch = ownedBranches.some(b => 
        b.owner_id === targetUser.email || b.created_by === targetUser.email
      );

      if (!hasCommonBranch && !isOwnerOfSameBranch) {
        return Response.json({ 
          error: 'คุณไม่มีสิทธิ์แก้ไขสิทธิ์ของผู้ใช้คนนี้ (ไม่ได้อยู่ในสาขาเดียวกัน)' 
        }, { status: 403 });
      }
    }

    // 📝 เก็บค่าเก่าเพื่อ audit log
    const oldPermissions = targetUser.permissions || [];

    // ⭐ UPDATE with Service Role (ข้าม RLS)
    await base44.asServiceRole.entities.User.update(userId, { permissions });

    // 📝 บันทึก Audit Log
    try {
      const targetBranches = targetUser.accessible_branches || [];
      const logBranchId = targetBranches.length > 0 ? targetBranches[0] : null;

      await base44.asServiceRole.entities.ActivityLog.create({
        branch_id: logBranchId,
        action_type: 'update',
        entity_type: 'UserPermissions',
        entity_id: userId,
        entity_name: `สิทธิ์ของ ${targetUser.full_name || targetUser.email}`,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        description: `แก้ไขสิทธิ์การใช้งานของ ${targetUser.full_name || targetUser.email}`,
        changes: {
          before: oldPermissions,
          after: permissions,
          added: permissions.filter(p => !oldPermissions.includes(p)),
          removed: oldPermissions.filter(p => !permissions.includes(p))
        }
      });
    } catch (logError) {
      console.error('⚠️ Failed to create audit log:', logError);
      // ไม่ throw error เพราะ update สำเร็จแล้ว
    }

    return Response.json({
      success: true,
      message: `อัปเดตสิทธิ์ของ ${targetUser.full_name || targetUser.email} สำเร็จ`,
      updated_permissions: permissions,
      changes: {
        added: permissions.filter(p => !oldPermissions.includes(p)),
        removed: oldPermissions.filter(p => !permissions.includes(p))
      }
    });

  } catch (error) {
    console.error('❌ Update permissions error:', error);
    
    return Response.json({ 
      error: error.message || 'เกิดข้อผิดพลาดในการอัปเดตสิทธิ์',
      details: error.toString()
    }, { status: 500 });
  }
});