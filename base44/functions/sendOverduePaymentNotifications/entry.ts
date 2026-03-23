import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import { differenceInDays, parseISO, startOfDay } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
    const startTime = Date.now();
    
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

        // ⭐ เช็ค recipients ก่อนเลย - ถ้าไม่มีก็ไม่ต้องดึงข้อมูล
        const recipients = getConfig('overdue_notification_recipients') || '';
        
        if (!recipients || recipients.trim() === '') {
            console.log('⚠️ No recipients - skip immediately (no data fetching needed)');
            return Response.json({ 
                success: true, 
                message: 'ไม่มีผู้รับการแจ้งเตือน ข้าม',
                sent: 0,
                skipped: true
            });
        }

        const recipientIds = recipients.split(',').map(id => id.trim()).filter(id => id);
        if (recipientIds.length === 0) {
            console.log('⚠️ No valid recipients - skip immediately');
            return Response.json({
                success: true,
                message: 'ไม่มีผู้รับที่ถูกต้อง ข้าม',
                sent: 0,
                skipped: true
            });
        }

        console.log(`✅ Recipients: ${recipientIds.length} (${recipientIds.join(', ')})`);

        const enabled = getConfig('overdue_notifications_enabled') === 'true';
        if (!enabled && !test_mode) {
            return Response.json({ 
                success: true, 
                message: 'การแจ้งเตือนถูกปิด ข้าม',
                sent: 0,
                skipped: true
            });
        }

        const daysThreshold = parseInt(getConfig('overdue_days_threshold') || '3');
        
        console.log('📋 Configuration:');
        console.log(`   - Days threshold: ${daysThreshold}`);
        console.log(`   - Branch filter: ${branch_id || 'ALL'}`);
        console.log(`   - Recipients: ${recipientIds.length}`);
        console.log(`   - Enabled: ${enabled}`);

        // ⭐ Helper function สำหรับดึงข้อมูลแบบ pagination
        async function fetchAllWithPagination(entity, filter = null, batchSize = 5000) {
            let allData = [];
            let skip = 0;
            let hasMore = true;
            
            while (hasMore) {
                const batch = filter 
                    ? await entity.filter(filter, '-created_date', batchSize, skip)
                    : await entity.list('-created_date', batchSize, skip);
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

        // ⭐ ดึงเฉพาะ payment ที่ status = pending/overdue (กรองใน database)
        console.log('🔍 Fetching overdue payments with filter...');
        const today = startOfDay(new Date());
        console.log(`📅 Today: ${today.toISOString().split('T')[0]}`);
        
        const paymentFilter = branch_id 
            ? { branch_id: branch_id }
            : {};
        
        // ดึงทั้ง pending และ overdue
        const [pendingPayments, existingOverdue] = await Promise.all([
            fetchAllWithPagination(base44.asServiceRole.entities.Payment, { ...paymentFilter, status: 'pending' }),
            fetchAllWithPagination(base44.asServiceRole.entities.Payment, { ...paymentFilter, status: 'overdue' })
        ]);
        
        const allPayments = [...pendingPayments, ...existingOverdue];
        console.log(`✅ Loaded ${allPayments.length} pending/overdue payments (${pendingPayments.length} pending, ${existingOverdue.length} overdue)`);
        
        // กรองใน memory เฉพาะที่เกิน threshold
        const overduePayments = allPayments.filter(payment => {
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

        // ⭐ อัปเดต late_fee_amount และ status เป็น overdue - แบบ batch เพื่อหลีกเลี่ยง rate limit
        console.log(`📝 Updating late fees for ${overduePayments.length} payments...`);
        const updateBatchSize = 10; // ลด batch size
        
        for (let i = 0; i < overduePayments.length; i += updateBatchSize) {
            const batch = overduePayments.slice(i, i + updateBatchSize);
            
            await Promise.all(
                batch.map(async (payment) => {
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
                    return base44.asServiceRole.entities.Payment.update(payment.id, {
                        status: 'overdue',
                        late_fee_amount: lateFee,
                        total_amount: newTotalAmount
                    }).catch(err => console.error(`Failed to update payment ${payment.id}:`, err));
                })
            );
            
            console.log(`✅ Updated ${Math.min(i + updateBatchSize, overduePayments.length)}/${overduePayments.length}`);
            
            // เพิ่ม delay ระหว่าง batch
            if (i + updateBatchSize < overduePayments.length) {
                await new Promise(r => setTimeout(r, 500));
            }
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

        // ⭐ ดึงเฉพาะ room และ tenant ที่จำเป็น - ไม่ดึงทั้งหมด
        const uniqueRoomIds = [...new Set(overduePayments.map(p => p.room_id).filter(id => id))];
        const uniqueTenantIds = [...new Set(overduePayments.map(p => p.tenant_id).filter(id => id))];
        
        console.log(`📥 Fetching ${uniqueRoomIds.length} rooms and ${uniqueTenantIds.length} tenants...`);
        
        const [roomsBatch, tenantsBatch] = await Promise.all([
            uniqueRoomIds.length > 0 
                ? Promise.all(uniqueRoomIds.map(id => 
                    base44.asServiceRole.entities.Room.filter({ id }).catch(() => null)
                  )).then(results => results.flat().filter(Boolean))
                : [],
            uniqueTenantIds.length > 0
                ? Promise.all(uniqueTenantIds.map(id => 
                    base44.asServiceRole.entities.Tenant.filter({ id }).catch(() => null)
                  )).then(results => results.flat().filter(Boolean))
                : []
        ]);

        const roomMap = new Map(roomsBatch.map(r => [r.id, r]));
        const tenantMap = new Map(tenantsBatch.map(t => [t.id, t]));
        
        console.log(`✅ Loaded ${roomsBatch.length} rooms, ${tenantsBatch.length} tenants`);

        // จัดกลุ่ม payments ตามสาขา
        const paymentsByBranch = {};
        for (const payment of overduePayments) {
            const branchId = payment.branch_id || 'unknown';
            if (!paymentsByBranch[branchId]) {
                paymentsByBranch[branchId] = [];
            }
            
            const room = roomMap.get(payment.room_id);
            const tenant = tenantMap.get(payment.tenant_id);
            
            const dueDate = startOfDay(parseISO(payment.due_date));
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

        const executionTime = Date.now() - startTime;
        const result = {
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
        };

        // บันทึก FunctionLog - หลีกเลี่ยง rate limit
        try {
            await new Promise(r => setTimeout(r, 1000)); // รอ 1 วิก่อนเขียน log
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendOverduePaymentNotifications',
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
        console.error('❌ Fatal error in sendOverduePaymentNotifications:', error);
        console.error('📍 Stack trace:', error.stack);
        
        // บันทึก error log - หลีกเลี่ยง rate limit
        try {
            await new Promise(r => setTimeout(r, 1000)); // รอ 1 วิก่อนเขียน log
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendOverduePaymentNotifications',
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
            error: error.message,
            stack: error.stack,
            details: String(error)
        }, { status: 500 });
    }
});