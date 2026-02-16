import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    const startTime = Date.now();
    
    try {
        const base44 = createClientFromRequest(req);
        
        const { branch_id, test_mode = false } = await req.json().catch(() => ({}));

        const configs = await base44.asServiceRole.entities.Config.list();
        
        const getConfig = (key) => {
            const config = configs.find(c => c.key === key && (!c.branch_id || c.branch_id === branch_id));
            return config?.value;
        };

        const enabled = getConfig('maintenance_notifications_enabled') === 'true';
        if (!enabled && !test_mode) {
            return Response.json({ 
                success: false, 
                message: 'การแจ้งเตือนคำขอซ่อมถูกปิดใช้งาน' 
            });
        }

        const priorityThreshold = getConfig('maintenance_priority_threshold') || 'medium';
        const recipients = getConfig('maintenance_notification_recipients') || '';
        
        if (!recipients) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบผู้รับการแจ้งเตือน' 
            });
        }

        const recipientIds = recipients.split(',').map(id => id.trim()).filter(id => id);

        // กำหนดลำดับความสำคัญ
        const priorityOrder = { 'low': 0, 'medium': 1, 'high': 2, 'urgent': 3 };
        const minPriority = priorityOrder[priorityThreshold] || 1;

        // ดึงข้อมูลคำขอซ่อมที่รอดำเนินการ
        const allMaintenance = await base44.asServiceRole.entities.MaintenanceRequest.list();
        const pendingMaintenance = allMaintenance.filter(request => {
            if (branch_id && request.branch_id !== branch_id) return false;
            if (request.status !== 'pending') return false;
            
            const requestPriority = priorityOrder[request.priority] || 0;
            return requestPriority >= minPriority;
        });

        if (pendingMaintenance.length === 0) {
            return Response.json({ 
                success: true, 
                message: 'ไม่มีคำขอซ่อมที่ต้องแจ้งเตือน',
                maintenanceCount: 0
            });
        }

        // ดึงข้อมูลห้องและผู้เช่า
        const allRooms = await base44.asServiceRole.entities.Room.list();
        const allTenants = await base44.asServiceRole.entities.Tenant.list();

        // ส่งข้อความแจ้งเตือน
        const lineAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
        if (!lineAccessToken) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบ LINE_CHANNEL_ACCESS_TOKEN' 
            });
        }

        let totalSent = 0;
        const errors = [];

        for (const recipientId of recipientIds) {
            let message = `🔧 แจ้งเตือนการซ่อม\n\nได้รับคำขอซ่อม ${pendingMaintenance.length} รายการ ขะรีบดำเนินการครับ`;

            // จัดกลุ่มตามความสำคัญ (ไม่แสดงในข้อความ เพื่อความเรียบง่าย)
            const urgent = pendingMaintenance.filter(m => m.priority === 'urgent');
            const high = pendingMaintenance.filter(m => m.priority === 'high');

            try {
                const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${lineAccessToken}`
                    },
                    body: JSON.stringify({
                        to: recipientId,
                        messages: [{ type: 'text', text: message }]
                    })
                });

                if (lineResponse.ok) {
                    totalSent++;
                } else {
                    const errorData = await lineResponse.json();
                    errors.push(`Failed to send to ${recipientId}: ${errorData.message || 'Unknown error'}`);
                }
            } catch (error) {
                errors.push(`Error sending to ${recipientId}: ${error.message}`);
            }
        }

        const executionTime = Date.now() - startTime;
        const result = {
            success: true,
            message: `ส่งการแจ้งเตือนสำเร็จ ${totalSent}/${recipientIds.length} ผู้รับ`,
            maintenanceCount: pendingMaintenance.length,
            sentTo: totalSent,
            errors: errors.length > 0 ? errors : undefined
        };

        // บันทึก FunctionLog
        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendMaintenanceNotifications',
                run_timestamp: new Date().toISOString(),
                status: 'success',
                message: result.message,
                execution_time_ms: executionTime,
                total_sent: totalSent,
                triggered_by: 'cron',
                details: result
            });
        } catch (logError) {
            console.error('Failed to create FunctionLog:', logError);
        }

        return Response.json(result);

    } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error('Error:', error);
        
        // บันทึก error log
        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendMaintenanceNotifications',
                run_timestamp: new Date().toISOString(),
                status: 'error',
                message: error.message,
                execution_time_ms: executionTime,
                triggered_by: 'cron',
                details: { error: error.message, stack: error.stack }
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
        
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});