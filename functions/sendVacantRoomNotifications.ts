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

        const enabled = getConfig('vacant_room_notifications_enabled') === 'true';
        if (!enabled && !test_mode) {
            return Response.json({ 
                success: false, 
                message: 'การแจ้งเตือนห้องว่างถูกปิดใช้งาน' 
            });
        }

        const daysThreshold = parseInt(getConfig('vacant_days_threshold') || '7');
        const recipients = getConfig('vacant_notification_recipients') || '';
        
        if (!recipients) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบผู้รับการแจ้งเตือน' 
            });
        }

        const recipientIds = recipients.split(',').map(id => id.trim()).filter(id => id);

        // ดึงข้อมูลห้องว่าง
        const allRooms = await base44.asServiceRole.entities.Room.list();
        const vacantRooms = allRooms.filter(room => {
            if (branch_id && room.branch_id !== branch_id) return false;
            return room.status === 'available';
        });

        if (vacantRooms.length === 0) {
            return Response.json({ 
                success: true, 
                message: 'ไม่มีห้องว่างที่ต้องแจ้งเตือน',
                vacantCount: 0
            });
        }

        // จัดกลุ่มห้องตามชั้น
        const roomsByFloor = {};
        for (const room of vacantRooms) {
            const floor = room.floor || 0;
            if (!roomsByFloor[floor]) {
                roomsByFloor[floor] = [];
            }
            roomsByFloor[floor].push(room);
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
            let message = `🏠 แจ้งเตือนห้องว่าง\n\n`;
            message += `พบห้องว่างทั้งหมด ${vacantRooms.length} ห้อง\n\n`;

            const sortedFloors = Object.keys(roomsByFloor).sort((a, b) => parseInt(b) - parseInt(a));
            
            for (const floor of sortedFloors.slice(0, 5)) {
                const rooms = roomsByFloor[floor];
                message += `📍 ชั้น ${floor}:\n`;
                const roomNumbers = rooms.map(r => r.room_number).slice(0, 10).join(', ');
                message += `   ${roomNumbers}\n`;
                if (rooms.length > 10) {
                    message += `   ... และอีก ${rooms.length - 10} ห้อง\n`;
                }
                message += `\n`;
            }

            if (sortedFloors.length > 5) {
                message += `... และอีก ${sortedFloors.length - 5} ชั้น\n\n`;
            }

            message += `💡 พิจารณาทำการตลาดเพื่อเพิ่มผู้เช่า`;

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
            vacantCount: vacantRooms.length,
            sentTo: totalSent,
            errors: errors.length > 0 ? errors : undefined
        };

        // บันทึก FunctionLog
        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendVacantRoomNotifications',
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
                function_name: 'sendVacantRoomNotifications',
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