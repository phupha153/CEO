import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { differenceInDays, parseISO, startOfDay } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // รับ parameters
        const { branch_id, test_mode = false } = await req.json().catch(() => ({}));

        // ดึง configs
        const configs = await base44.asServiceRole.entities.Config.list();
        
        const getConfig = (key) => {
            const config = configs.find(c => c.key === key && (!c.branch_id || c.branch_id === branch_id));
            return config?.value;
        };

        const enabled = getConfig('overdue_notifications_enabled') === 'true';
        if (!enabled && !test_mode) {
            return Response.json({ 
                success: false, 
                message: 'การแจ้งเตือนค้างชำระถูกปิดใช้งาน' 
            });
        }

        const daysThreshold = parseInt(getConfig('overdue_days_threshold') || '3');
        const recipients = getConfig('overdue_notification_recipients') || '';
        
        if (!recipients) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบผู้รับการแจ้งเตือน กรุณาตั้งค่าใน LINE User ID' 
            });
        }

        const recipientIds = recipients.split(',').map(id => id.trim()).filter(id => id);

        // ⭐ Helper function สำหรับดึงข้อมูลแบบ pagination
        async function fetchAllWithPagination(entity, batchSize = 5000) {
            let allData = [];
            let skip = 0;
            let hasMore = true;
            
            while (hasMore) {
                const batch = await entity.list('-created_date', batchSize, skip);
                if (!Array.isArray(batch) || batch.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(batch);
                    skip += batch.length;
                    if (batch.length < batchSize) {
                        hasMore = false;
                    }
                }
            }
            return allData;
        }

        // ดึงข้อมูล payments ที่เกินกำหนด (ใช้ pagination)
        const allPayments = await fetchAllWithPagination(base44.asServiceRole.entities.Payment);
        const overduePayments = allPayments.filter(payment => {
            if (branch_id && payment.branch_id !== branch_id) return false;
            if (payment.status !== 'pending' && payment.status !== 'overdue') return false;
            if (!payment.due_date) return false;

            const dueDate = startOfDay(parseISO(payment.due_date));
            const today = startOfDay(new Date());
            const daysDiff = differenceInDays(today, dueDate);

            return daysDiff >= daysThreshold;
        });

        if (overduePayments.length === 0) {
            return Response.json({ 
                success: true, 
                message: 'ไม่มีรายการค้างชำระที่ต้องแจ้งเตือน',
                overdueCount: 0
            });
        }

        // ดึงข้อมูลห้องและผู้เช่า (ใช้ pagination)
        const allRooms = await fetchAllWithPagination(base44.asServiceRole.entities.Room);
        const allTenants = await fetchAllWithPagination(base44.asServiceRole.entities.Tenant);

        // จัดกลุ่ม payments ตามสาขา
        const paymentsByBranch = {};
        for (const payment of overduePayments) {
            const branchId = payment.branch_id || 'unknown';
            if (!paymentsByBranch[branchId]) {
                paymentsByBranch[branchId] = [];
            }
            
            const room = allRooms.find(r => r.id === payment.room_id);
            const tenant = allTenants.find(t => t.id === payment.tenant_id);
            
            const dueDate = startOfDay(parseISO(payment.due_date));
            const today = startOfDay(new Date());
            const daysOverdue = differenceInDays(today, dueDate);

            paymentsByBranch[branchId].push({
                room_number: room?.room_number || 'N/A',
                tenant_name: tenant?.full_name || 'N/A',
                amount: payment.total_amount || 0,
                due_date: payment.due_date,
                days_overdue: daysOverdue
            });
        }

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
            // สร้างข้อความสรุป
            let message = `🚨 แจ้งเตือนค้างชำระ\n\n`;
            message += `พบรายการค้างชำระทั้งหมด ${overduePayments.length} รายการ\n\n`;

            for (const [branchId, payments] of Object.entries(paymentsByBranch)) {
                if (payments.length === 0) continue;
                
                message += `📍 รายการค้างชำระ:\n`;
                
                payments.slice(0, 10).forEach((p, index) => {
                    message += `\n${index + 1}. ห้อง ${p.room_number} (${p.tenant_name})\n`;
                    message += `   💰 จำนวน: ${p.amount.toLocaleString()} บาท\n`;
                    message += `   ⏰ เกินกำหนด: ${p.days_overdue} วัน\n`;
                });

                if (payments.length > 10) {
                    message += `\n... และอีก ${payments.length - 10} รายการ\n`;
                }
            }

            message += `\n⚠️ กรุณาติดตามการชำระเงิน`;

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

        return Response.json({
            success: true,
            message: `ส่งการแจ้งเตือนสำเร็จ ${totalSent}/${recipientIds.length} ผู้รับ`,
            overdueCount: overduePayments.length,
            sentTo: totalSent,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});