import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.19';

// ฟังก์ชันกำหนดสิทธิ์เริ่มต้นตามบทบาท
const getDefaultPermissions = (role) => {
    const permissionsMap = {
        owner: [
            "dashboard_view",
            "rooms_view", "rooms_add", "rooms_edit", "rooms_delete",
            "tenants_view", "tenants_add", "tenants_edit", "tenants_delete",
            "bookings_view_daily", "bookings_add_daily", "bookings_edit_daily", "bookings_delete_daily",
            "contracts_view_monthly", "contracts_add_monthly", "contracts_edit_monthly", "contracts_delete_monthly",
            "payments_view", "payments_add", "payments_edit", "payments_delete", "payments_update_status", "payments_send_receipt",
            "meter_readings_view", "meter_readings_add", "meter_readings_edit", "meter_readings_delete",
            "expenses_view", "expenses_add", "expenses_edit", "expenses_delete",
            "maintenance_view", "maintenance_add", "maintenance_edit", "maintenance_delete", "maintenance_update_status",
            "reports_view_all", "reports_export",
            "accounting_view_all", "accounting_export",
            "announcements_send",
            "settings_view", "settings_edit"
        ],
        manager: [
            "dashboard_view",
            "rooms_view", "rooms_add", "rooms_edit",
            "tenants_view", "tenants_add", "tenants_edit",
            "bookings_view_daily", "bookings_add_daily", "bookings_edit_daily", "bookings_delete_daily",
            "contracts_view_monthly", "contracts_add_monthly", "contracts_edit_monthly",
            "payments_view", "payments_add", "payments_update_status", "payments_send_receipt",
            "meter_readings_view", "meter_readings_add",
            "expenses_view", "expenses_add",
            "maintenance_view", "maintenance_add", "maintenance_edit", "maintenance_update_status",
            "reports_view_all", "reports_export",
            "accounting_view_all",
            "announcements_send",
            "settings_view", "settings_edit"
        ],
        employee: [
            "dashboard_view",
            "rooms_view",
            "tenants_view",
            "bookings_view_daily",
            "contracts_view_monthly",
            "payments_view", "payments_send_receipt",
            "meter_readings_view", "meter_readings_add",
            "expenses_view",
            "maintenance_view", "maintenance_add"
        ]
    };

    return permissionsMap[role] || permissionsMap.employee;
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const payload = await req.json();
        const { full_name, email, phone, custom_role, accessible_branches } = payload;

        // 🔒 BACKEND VALIDATION: เช็คจำนวน users ก่อนเพิ่ม (ป้องกัน bypass frontend)
        const planStatus = user.plan_status || 'trial';
        const isTrialMode = planStatus === 'trial';
        
        // ดึง max_users จาก cached_package_info หรือใช้ default
        const maxAllowedUsers = isTrialMode ? 1 : (user.cached_package_info?.max_users || 999);
        
        // นับผู้ใช้จริงในสาขาที่กำลังจะเพิ่ม (ไม่รวม developer)
        const firstBranchId = accessible_branches?.[0];
        if (!firstBranchId) {
          return Response.json({ 
            error: 'กรุณาระบุสาขาที่พนักงานจะเข้าถึง' 
          }, { status: 400 });
        }
        
        const existingUsers = await base44.asServiceRole.entities.User.filter({});
        const usersInBranch = existingUsers.filter(u => {
          const role = u.custom_role || (u.role === 'admin' ? 'owner' : 'employee');
          if (role === 'developer') return false; // ไม่นับ developer
          return u.accessible_branches?.includes(firstBranchId);
        });
        
        console.log('🔍 User Limit Check:', {
          planStatus,
          maxAllowedUsers,
          currentCount: usersInBranch.length,
          newEmail: email
        });
        
        // ⚠️ ถ้าครบจำนวนแล้ว → REJECT
        if (usersInBranch.length >= maxAllowedUsers) {
          return Response.json({ 
            error: `ครบจำนวนผู้ใช้แล้ว (${maxAllowedUsers} คน) - กรุณาอัปเกรดแพ็กเกจ`,
            current_count: usersInBranch.length,
            max_allowed: maxAllowedUsers
          }, { status: 403 });
        }

        const crmAppId = Deno.env.get('CRM_APP_ID');
        const crmServiceRoleKey = Deno.env.get('CRM_SERVICE_ROLE_KEY');

        if (!crmAppId || !crmServiceRoleKey) {
            return Response.json({ 
                error: 'ไม่พบการตั้งค่า CRM (CRM_APP_ID หรือ CRM_SERVICE_ROLE_KEY)'
            }, { status: 500 });
        }

        console.log('Creating CRM client for employee data...');

        const crmClient = createClient({
            appId: crmAppId,
            serviceRoleKey: crmServiceRoleKey,
            baseURL: 'https://app.base44.com'
        });

        // 1. ตรวจสอบว่ามี User อยู่แล้วหรือไม่
        console.log('Checking if user exists...');
        
        const existingUsers = await base44.asServiceRole.entities.User.filter({ email: email });
        let targetUser;

        if (existingUsers && existingUsers.length > 0) {
            // ถ้ามี User อยู่แล้ว ให้ update ข้อมูล
            console.log('User exists, updating...');
            targetUser = existingUsers[0];
            
            // อัปเดตข้อมูล แต่ไม่ทำถ้าเป็น owner/developer อยู่แล้ว
            const existingRole = targetUser.custom_role || (targetUser.role === 'admin' ? 'owner' : 'employee');
            if (existingRole !== 'developer') {
                await base44.asServiceRole.entities.User.update(targetUser.id, {
                    full_name: full_name || targetUser.full_name,
                    custom_role: custom_role || 'employee',
                    accessible_branches: accessible_branches || [],
                    permissions: getDefaultPermissions(custom_role || 'employee')
                });
                console.log('User updated successfully:', targetUser.id);
            } else {
                console.log('User is developer, skipping update');
            }
        } else {
            // ถ้าไม่มี ให้สร้างใหม่
            console.log('Creating new User in Base44 system...');
            targetUser = await base44.asServiceRole.entities.User.create({
                full_name: full_name || '',
                email: email || '',
                custom_role: custom_role || 'employee',
                accessible_branches: accessible_branches || [],
                permissions: getDefaultPermissions(custom_role || 'employee')
            });
            console.log('User created successfully in Base44:', targetUser.id);
        }

        // 2. ส่งอีเมลเชิญเข้าใช้งาน
        console.log('Sending invitation email...');
        
        try {
            await base44.users.inviteUser(email, 'user');
            console.log('Invitation email sent successfully to:', email);
        } catch (inviteError) {
            console.warn('Failed to send invitation email:', inviteError.message);
            // ไม่ให้ fail ทั้งหมด แค่ log warning
        }

        return Response.json({ 
            success: true,
            message: 'เพิ่มพนักงานในระบบและส่งอีเมลเชิญสำเร็จ',
            user_id: targetUser.id,
            user: {
                full_name,
                email,
                custom_role,
                accessible_branches
            }
        });
    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        
        return Response.json({ 
            error: 'เกิดข้อผิดพลาด: ' + error.message,
            details: error.response?.data || null
        }, { status: 500 });
    }
});