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
        
        console.log('📋 Configuration check:');
        console.log(`   - overdue_notifications_enabled: ${enabled}`);
        console.log(`   - overdue_days_threshold: ${daysThreshold}`);
        console.log(`   - overdue_notification_recipients (raw): "${recipients}"`);
        console.log(`   - branch_id filter: ${branch_id || 'ALL BRANCHES'}`);
        
        if (!recipients || recipients.trim() === '') {
            console.error('❌ No recipients configured');
            console.log('💡 Solution: Go to Settings → Notifications → Admin Notifications');
            console.log('💡 Add LINE User IDs (comma-separated) in "overdue_notification_recipients"');
            console.log('💡 Example: U1234567890abc,U0987654321xyz');
            
            return Response.json({ 
                success: false, 
                error: 'ไม่พบผู้รับการแจ้งเตือน กรุณาตั้งค่าใน Settings → การแจ้งเตือน',
                details: {
                    configKey: 'overdue_notification_recipients',
                    currentValue: recipients,
                    required: 'LINE User ID (comma-separated)',
                    example: 'U1234567890abc,U0987654321xyz',
                    howToFind: 'Get LINE User ID from LINE Developer Console or by sending a message to your LINE Bot'
                }
            });
        }

        const recipientIds = recipients.split(',').map(id => id.trim()).filter(id => id);
        console.log(`✅ Found ${recipientIds.length} recipient(s): ${recipientIds.join(', ')}`);
        
        if (recipientIds.length === 0) {
            console.error('❌ No valid recipient IDs after parsing');
            return Response.json({
                success: false,
                error: 'รูปแบบ LINE User ID ไม่ถูกต้อง',
                details: {
                    rawValue: recipients,
                    parsedCount: 0,
                    required: 'LINE User IDs separated by commas'
                }
            });
        }

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
        console.log('🔍 Fetching all payments...');
        const allPayments = await fetchAllWithPagination(base44.asServiceRole.entities.Payment);
        console.log(`✅ Loaded ${allPayments.length} total payments`);
        
        const today = startOfDay(new Date());
        console.log(`📅 Today: ${today.toISOString().split('T')[0]}`);
        
        const overduePayments = allPayments.filter(payment => {
            if (branch_id && payment.branch_id !== branch_id) return false;
            if (payment.status !== 'pending' && payment.status !== 'overdue') return false;
            if (!payment.due_date) return false;

            const dueDate = startOfDay(parseISO(payment.due_date));
            const daysDiff = differenceInDays(today, dueDate);

            return daysDiff >= daysThreshold;
        });
        
        console.log(`📊 Filter results:`);
        console.log(`   - Total payments: ${allPayments.length}`);
        console.log(`   - Overdue (>= ${daysThreshold} days): ${overduePayments.length}`);
        console.log(`   - Branch filter: ${branch_id || 'NONE (all branches)'}`);
        
        if (overduePayments.length > 0) {
            console.log(`📋 Sample overdue payments:`);
            overduePayments.slice(0, 3).forEach((p, i) => {
                const dueDate = startOfDay(parseISO(p.due_date));
                const daysDiff = differenceInDays(today, dueDate);
                console.log(`   ${i+1}. Payment ${p.id?.substring(0, 8)}: ${daysDiff} days overdue, ${p.total_amount}฿, status: ${p.status}`);
            });
        }

        // ⭐ อัปเดต late_fee_amount และ status เป็น overdue
        const updatePromises = [];
        for (const payment of overduePayments) {
            const dueDate = startOfDay(parseISO(payment.due_date));
            const today = startOfDay(new Date());
            const daysOverdue = differenceInDays(today, dueDate);

            // คำนวณค่าปรับ
            let lateFee = 0;
            const branchId = payment.branch_id;
            
            const branchTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === branchId);
            const globalTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
            const tiersEnabledConfig = branchTiersEnabledConfig || globalTiersEnabledConfig;
            const tiersEnabled = tiersEnabledConfig?.value === 'true';
            
            if (tiersEnabled) {
                const branchTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && c.branch_id === branchId);
                const globalTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
                const tiersConfig = branchTiersConfig || globalTiersConfig;
                
                if (tiersConfig?.value) {
                    try {
                        const tiers = JSON.parse(tiersConfig.value);
                        for (const tier of tiers) {
                            const daysFrom = tier.days_from || 1;
                            const daysTo = tier.days_to || 999;
                            const feePerDay = parseFloat(tier.fee_per_day || 0);
                            if (daysOverdue >= daysFrom) {
                                const daysInTier = Math.min(daysOverdue, daysTo) - daysFrom + 1;
                                if (daysInTier > 0) lateFee += daysInTier * feePerDay;
                            }
                            if (daysOverdue <= daysTo) break;
                        }
                    } catch (e) {
                        console.error('Error parsing tiers:', e);
                    }
                }
            } else {
                const branchConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && c.branch_id === branchId);
                const globalConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && !c.branch_id);
                const config = branchConfig || globalConfig;
                const feePerDay = parseFloat(config?.value || '0');
                if (!isNaN(feePerDay) && feePerDay > 0) {
                    lateFee = daysOverdue * feePerDay;
                }
            }

            // อัปเดต payment ด้วย late_fee_amount และ total_amount ใหม่
            const newTotalAmount = (payment.total_amount || 0) + lateFee;
            updatePromises.push(
                base44.asServiceRole.entities.Payment.update(payment.id, {
                    status: 'overdue',
                    late_fee_amount: lateFee,
                    total_amount: newTotalAmount
                }).catch(err => console.error(`Failed to update payment ${payment.id}:`, err))
            );
        }

        // รอให้ทุก update เสร็จ
        if (updatePromises.length > 0) {
            await Promise.all(updatePromises);
            console.log(`✅ Updated ${updatePromises.length} payments with late fees`);
        }

        if (overduePayments.length === 0) {
            console.log('✅ No overdue payments found - nothing to send');
            return Response.json({ 
                success: true, 
                message: 'ไม่มีรายการค้างชำระที่ต้องแจ้งเตือน',
                overdueCount: 0,
                details: {
                    totalPayments: allPayments.length,
                    daysThreshold: daysThreshold,
                    branchFilter: branch_id || 'all'
                }
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
        console.log(`🔑 LINE Token check: ${lineAccessToken ? '✅ Found' : '❌ Not found'}`);
        
        if (!lineAccessToken) {
            console.error('❌ LINE_CHANNEL_ACCESS_TOKEN not set in environment');
            console.log('💡 Solution: Set LINE_CHANNEL_ACCESS_TOKEN in Dashboard → Settings → Secrets');
            return Response.json({ 
                success: false, 
                error: 'ไม่พบ LINE_CHANNEL_ACCESS_TOKEN กรุณาตั้งค่าใน Secrets',
                details: {
                    secretName: 'LINE_CHANNEL_ACCESS_TOKEN',
                    howToSet: 'Dashboard → Settings → Secrets → Add Secret'
                }
            });
        }

        let totalSent = 0;
        const errors = [];

        console.log(`📤 Sending notifications to ${recipientIds.length} recipient(s)...`);

        for (const recipientId of recipientIds) {
            console.log(`📨 Sending to ${recipientId}...`);
            // สร้างข้อความสรุปแบบสั้นกระชับ เน้นเกินกำหนด
            let message = `🔴 เกินกำหนดชำระ\n\n`;
            message += `มี ${overduePayments.length} ห้องค้างชำระ\n\n`;

            for (const [branchId, payments] of Object.entries(paymentsByBranch)) {
                if (payments.length === 0) continue;
                
                payments.slice(0, 10).forEach((p, index) => {
                    message += `${index + 1}. ห้อง ${p.room_number}\n`;
                    message += `เกิน ${p.days_overdue} วัน · ${p.amount.toLocaleString()}฿\n\n`;
                });

                if (payments.length > 10) {
                    message += `และอีก ${payments.length - 10} ห้อง\n\n`;
                }
            }

            message += `⚠️ กรุณาติดตามด่วน`;

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
                    console.log(`✅ Sent to ${recipientId}`);
                } else {
                    const errorData = await lineResponse.json();
                    const errorMsg = `Failed to send to ${recipientId}: ${errorData.message || 'Unknown error'}`;
                    console.error(`❌ ${errorMsg}`, errorData);
                    errors.push(errorMsg);
                }
            } catch (error) {
                const errorMsg = `Error sending to ${recipientId}: ${error.message}`;
                console.error(`❌ ${errorMsg}`);
                errors.push(errorMsg);
            }
        }

        console.log(`🎉 Notification sending completed`);
        console.log(`   - Total sent: ${totalSent}/${recipientIds.length}`);
        console.log(`   - Errors: ${errors.length}`);

        return Response.json({
            success: true,
            message: `ส่งการแจ้งเตือนสำเร็จ ${totalSent}/${recipientIds.length} ผู้รับ`,
            overdueCount: overduePayments.length,
            sentTo: totalSent,
            recipients: recipientIds,
            errors: errors.length > 0 ? errors : undefined,
            details: {
                totalPayments: allPayments.length,
                overduePayments: overduePayments.length,
                daysThreshold: daysThreshold,
                recipientCount: recipientIds.length
            }
        });

    } catch (error) {
        console.error('❌ Fatal error in sendOverduePaymentNotifications:', error);
        console.error('📍 Stack trace:', error.stack);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack,
            details: String(error)
        }, { status: 500 });
    }
});