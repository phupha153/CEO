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

        const enabled = getConfig('contract_expiry_notifications_enabled') === 'true';
        if (!enabled && !test_mode) {
            return Response.json({ 
                success: false, 
                message: 'การแจ้งเตือนสัญญาใกล้หมดถูกปิดใช้งาน' 
            });
        }

        const daysThreshold = parseInt(getConfig('contract_expiry_days_threshold') || '30');
        const recipients = getConfig('contract_notification_recipients') || '';
        
        if (!recipients) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบผู้รับการแจ้งเตือน' 
            });
        }

        const recipientIds = recipients.split(',').map(id => id.trim()).filter(id => id);

        // ดึงข้อมูลการจองที่ใกล้หมดสัญญา
        const allBookings = await base44.asServiceRole.entities.Booking.list();
        const expiringBookings = allBookings.filter(booking => {
            if (branch_id && booking.branch_id !== branch_id) return false;
            if (booking.status !== 'active') return false;
            if (!booking.check_out_date) return false;

            const checkOutDate = new Date(booking.check_out_date);
            const today = new Date();
            const daysUntilExpiry = Math.floor((checkOutDate - today) / (1000 * 60 * 60 * 24));

            return daysUntilExpiry > 0 && daysUntilExpiry <= daysThreshold;
        });

        if (expiringBookings.length === 0) {
            return Response.json({ 
                success: true, 
                message: 'ไม่มีสัญญาใกล้หมดที่ต้องแจ้งเตือน',
                expiringCount: 0
            });
        }

        // ดึงข้อมูลห้องและผู้เช่า
        const allRooms = await base44.asServiceRole.entities.Room.list();
        const allTenants = await base44.asServiceRole.entities.Tenant.list();

        // จัดเรียงตามวันที่ใกล้หมดที่สุด
        const sortedBookings = expiringBookings.sort((a, b) => {
            const dateA = new Date(a.check_out_date);
            const dateB = new Date(b.check_out_date);
            return dateA - dateB;
        });

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
            let message = `⏰ แจ้งเตือนสัญญาใกล้หมด\n\n`;
            message += `พบสัญญาที่ใกล้หมด ${expiringBookings.length} สัญญา\n\n`;

            sortedBookings.slice(0, 10).forEach((booking, index) => {
                const room = allRooms.find(r => r.id === booking.room_id);
                const tenant = allTenants.find(t => t.id === booking.tenant_id);
                
                const checkOutDate = new Date(booking.check_out_date);
                const today = new Date();
                const daysLeft = Math.floor((checkOutDate - today) / (1000 * 60 * 60 * 24));

                message += `${index + 1}. ห้อง ${room?.room_number || 'N/A'}\n`;
                message += `   👤 ${tenant?.full_name || 'N/A'}\n`;
                message += `   📅 สิ้นสุด: ${checkOutDate.toLocaleDateString('th-TH')}\n`;
                message += `   ⏳ เหลือ: ${daysLeft} วัน\n\n`;
            });

            if (expiringBookings.length > 10) {
                message += `... และอีก ${expiringBookings.length - 10} สัญญา\n\n`;
            }

            message += `💡 ติดต่อผู้เช่าเพื่อต่อสัญญาหรือเตรียมห้องใหม่`;

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
            expiringCount: expiringBookings.length,
            sentTo: totalSent,
            errors: errors.length > 0 ? errors : undefined
        };

        // บันทึก FunctionLog
        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendContractExpiryNotifications',
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
                function_name: 'sendContractExpiryNotifications',
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