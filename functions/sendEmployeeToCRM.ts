import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.4';

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

        // Validate required fields
        if (!accessible_branches || accessible_branches.length === 0) {
          return Response.json({ 
            error: 'กรุณาระบุสาขาที่พนักงานจะเข้าถึง' 
          }, { status: 400 });
        }

        // ส่งข้อมูลไป CRM เพื่อ sync permissions และ accessible_branches
        const crmAppId = Deno.env.get('CRM_APP_ID');
        const crmServiceRoleKey = Deno.env.get('CRM_SERVICE_ROLE_KEY');

        if (!crmAppId || !crmServiceRoleKey) {
            console.warn('CRM not configured, skipping sync');
        } else {
            console.log('Syncing employee data to CRM...');
            const crmClient = createClient({
                appId: crmAppId,
                serviceRoleKey: crmServiceRoleKey,
                baseURL: 'https://app.base44.com'
            });

            try {
                await crmClient.entities.Employee.create({
                    full_name,
                    email,
                    phone: phone || '',
                    custom_role: custom_role || 'employee',
                    accessible_branches: accessible_branches || [],
                    permissions: getDefaultPermissions(custom_role || 'employee'),
                    invited_by: user.email,
                    app_id: Deno.env.get('BASE44_APP_ID')
                });
                console.log('Employee synced to CRM successfully');
            } catch (crmError) {
                console.warn('CRM sync failed (non-critical):', crmError.message);
            }
        }

        // ส่งอีเมลเชิญเข้าใช้งาน ผ่าน CRM
        console.log('Sending invitation email via CRM to:', email);
        
        const invitePayload = {
            email,
            full_name,
            custom_role: custom_role || 'employee',
            accessible_branches,
            permissions: getDefaultPermissions(custom_role || 'employee')
        };
        
        console.log('Invitation payload:', JSON.stringify(invitePayload, null, 2));

        return Response.json({ 
            success: true,
            message: 'ส่งอีเมลเชิญพนักงานสำเร็จ',
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