import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { differenceInDays, parseISO, startOfDay } from 'npm:date-fns@3.6.0';

// ส่งการแจ้งเตือนค้างชำระอัตโนมัติให้ผู้เช่า
Deno.serve(async (req) => {
    const startTime = Date.now();

    try {
        const base44 = createClientFromRequest(req);

        console.log('🔴 Starting automated overdue reminders...');

        // Parse request body
        let targetBranchId = null;
        let testLineUserId = null;
        let limit = 20;
        try {
            const text = await req.text();
            if (text) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
                testLineUserId = body.test_line_user_id || null;
                limit = body.limit || 20;
            }
        } catch (parseError) {
            console.log('⚠️ No body or parse error:', parseError.message);
        }

        console.log('📋 Target branch:', targetBranchId || 'ALL BRANCHES');
        console.log('📊 Limit per run:', limit);

        // 1. ดึงการตั้งค่าจาก Config
        const configs = await base44.asServiceRole.entities.Config.list();
        
        const getConfigValue = (key, defaultValue, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        // ⭐ เช็คว่าสาขาไหนเปิดการแจ้งเตือนค้างชำระ
        const branchReminderConfigs = configs.filter(c => c.key === 'send_overdue_reminder');
        const enabledBranches = branchReminderConfigs
            .filter(c => c.value === 'true')
            .map(c => c.branch_id)
            .filter(id => id && id.trim() !== '');
        const disabledBranches = branchReminderConfigs
            .filter(c => c.value !== 'true')
            .map(c => c.branch_id)
            .filter(id => id && id.trim() !== '');

        console.log(`📊 Branch overdue reminder status:`);
        console.log(`   ✅ Enabled branches (${enabledBranches.length}): ${enabledBranches.slice(0, 5).join(', ')}${enabledBranches.length > 5 ? '...' : ''}`);
        console.log(`   ❌ Disabled branches (${disabledBranches.length})`);

        if (enabledBranches.length === 0) {
            console.log('⚠️ No branches have overdue reminders enabled');
            return Response.json({
                success: true,
                message: 'ไม่มีสาขาใดเปิดการแจ้งเตือนค้างชำระ กรุณาเปิดในหน้าตั้งค่า',
                sent: 0,
                enabledBranches: [],
                disabledBranches: disabledBranches.length
            });
        }

        // 2. Helper function สำหรับดึงข้อมูลแบบ pagination
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

        // 3. ดึงข้อมูลแบบกรองเฉพาะที่จำเป็น - filter status ตั้งแต่ query
        console.log('🔍 Fetching filtered overdue payments...');

        const today = startOfDay(new Date());
        const todayString = today.toISOString().split('T')[0];

        // ⭐ ดึงเฉพาะ payment ที่ยังไม่ชำระ (pending/overdue) - ลด memory/network
        const paymentFilter = {
            status: 'pending'  // ดึงเฉพาะที่ยังไม่จ่าย
        };

        if (targetBranchId) {
            paymentFilter.branch_id = targetBranchId;
        }

        let pendingPayments = await fetchAllWithPagination(base44.asServiceRole.entities.Payment, paymentFilter);

        // เพิ่มเช็ค status='overdue' ด้วย (กรณีที่ระบบตั้งเป็น overdue แล้ว)
        const overdueFilter = {
            status: 'overdue'
        };
        if (targetBranchId) {
            overdueFilter.branch_id = targetBranchId;
        }

        const overdueByStatus = await fetchAllWithPagination(base44.asServiceRole.entities.Payment, overdueFilter);
        const allUnpaidPayments = [...pendingPayments, ...overdueByStatus];

        console.log(`📊 Fetched ${allUnpaidPayments.length} unpaid payments (pending+overdue)`);

        // กรองใน memory หา payment ที่เกินกำหนดจริงๆ (due_date < today)
        let overduePayments = allUnpaidPayments.filter(p => {
            if (!p.due_date) return false;

            const dueDate = startOfDay(parseISO(p.due_date));
            const daysOverdue = differenceInDays(today, dueDate);

            return daysOverdue > 0;
        });

        console.log(`📊 Found ${overduePayments.length} actually overdue payments`);

        // กรองเฉพาะสาขาที่เปิดการแจ้งเตือน และยังไม่ส่งในวันนี้
        const todayString = today.toISOString().split('T')[0];
        const paymentsFromEnabledBranches = overduePayments.filter(p => {
            if (!enabledBranches.includes(p.branch_id)) {
                return false;
            }

            // ⭐ ถ้าส่งแจ้งเตือนค้างชำระไปแล้วในวันนี้ ไม่ต้องส่งซ้ำ
            if (p.overdue_reminder_sent_date) {
                const lastSentDate = p.overdue_reminder_sent_date.split('T')[0];
                if (lastSentDate === todayString) {
                    console.log(`⏭️ Skipping payment ${p.id} - already sent overdue reminder today`);
                    return false;
                }
            }

            return true;
        });

        const skippedCount = overduePayments.length - paymentsFromEnabledBranches.length;
        const paymentsToProcess = paymentsFromEnabledBranches.slice(0, limit);
        const totalRemaining = paymentsFromEnabledBranches.length - paymentsToProcess.length;

        console.log(`📋 Payments from enabled branches: ${paymentsFromEnabledBranches.length}`);
        console.log(`📋 Processing this round: ${paymentsToProcess.length}`);
        console.log(`📋 Remaining for next round: ${totalRemaining}`);
        console.log(`⏭️ Skipped (disabled branches or sent today): ${skippedCount}`);

        // ⭐ ดึง tenant และ room เฉพาะที่จำเป็น
        const uniqueTenantIds = [...new Set(paymentsToProcess.map(p => p.tenant_id).filter(id => id))];
        const uniqueRoomIds = [...new Set(paymentsToProcess.map(p => p.room_id).filter(id => id))];
        
        console.log(`📥 Fetching ${uniqueTenantIds.length} tenants and ${uniqueRoomIds.length} rooms...`);
        
        const [tenantsBatch, roomsBatch] = await Promise.all([
            uniqueTenantIds.length > 0 
                ? Promise.all(uniqueTenantIds.map(id => 
                    base44.asServiceRole.entities.Tenant.filter({ id }).catch(() => null)
                  )).then(results => results.flat().filter(Boolean))
                : [],
            uniqueRoomIds.length > 0
                ? Promise.all(uniqueRoomIds.map(id => 
                    base44.asServiceRole.entities.Room.filter({ id }).catch(() => null)
                  )).then(results => results.flat().filter(Boolean))
                : []
        ]);

        const tenantMap = new Map(tenantsBatch.map(t => [t.id, t]));
        const roomMap = new Map(roomsBatch.map(r => [r.id, r]));
        
        console.log(`✅ Loaded ${paymentsToProcess.length} relevant payments, ${tenantsBatch.length} tenants, ${roomsBatch.length} rooms`);

        if (paymentsToProcess.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีบิลค้างชำระที่ต้องส่งแจ้งเตือน',
                sent: 0,
                total: 0,
                remaining: 0,
                hasMore: false
            });
        }

        // 5. เตรียมข้อความสำหรับแต่ละบิล
        const recipients = [];

        for (const payment of paymentsToProcess) {
            try {
                const tenant = tenantMap.get(payment.tenant_id);
                const room = roomMap.get(payment.room_id);

                if (!tenant) continue;

                const hasLine = tenant.line_user_id && tenant.line_user_id.trim() !== '';
                const hasFacebook = tenant.facebook_user_id && tenant.facebook_user_id.trim() !== '';
                
                if (!hasLine && !hasFacebook) continue;

                // คำนวณจำนวนวันที่เกินกำหนด
                const dueDate = startOfDay(parseISO(payment.due_date));
                const daysOverdue = differenceInDays(today, dueDate);

                // ดึง config เฉพาะสาขา
                const paymentBranchId = payment.branch_id;
                const branchBankName = getConfigValue('bank_name', 'กสิกร', paymentBranchId);
                const branchBankAccountNumber = getConfigValue('bank_account_number', '0722835522', paymentBranchId);
                const branchBankAccountName = getConfigValue('bank_account_name', 'ธนานนท์ พรมพักตร์', paymentBranchId);
                const branchBuildingName = getConfigValue('building_name', 'W RESIDENTS', paymentBranchId);

                // ⭐ ดึงค่าปรับจาก payment.late_fee_amount (ถูกอัปเดตโดย sendOverduePaymentNotifications)
                const lateFee = payment.late_fee_amount || 0;
                const originalAmount = payment.total_amount - lateFee;
                const totalWithLateFee = payment.total_amount;

                // สร้างข้อความ
                let message = `🔴 แจ้งเตือนเกินกำหนดชำระ\n\n`;
                message += `${branchBuildingName}\n`;
                message += `คุณ ${tenant.full_name} ห้อง ${room?.room_number || 'N/A'}\n`;
                message += `💰 ยอดเงิน: ${originalAmount.toLocaleString()} บาท`;
                if (lateFee > 0) {
                    message += `\n⚠️ ค่าปรับล่าช้า: +${lateFee.toLocaleString()} บาท`;
                }
                message += `\n💰 รวมทั้งสิ้น: ${totalWithLateFee.toLocaleString()} บาท`;
                message += `\nเกินกำหนดมาแล้ว: ${daysOverdue} วัน\n\n`;
                message += `กรุณาชำระโดยด่วนค่ะ${lateFee > 0 ? ' เพื่อหลีกเลี่ยงค่าปรับเพิ่มเติม' : ''}\n\n`;
                message += `💳 โอนเงินได้ที่:\n${branchBankName} ${branchBankAccountNumber}\nชื่อบัญชี: ${branchBankAccountName}\n\n`;
                message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;

                recipients.push({
                    lineUserId: hasLine ? tenant.line_user_id : null,
                    facebookUserId: hasFacebook ? tenant.facebook_user_id : null,
                    message: message,
                    metadata: {
                        paymentId: payment.id,
                        tenantId: tenant.id,
                        tenantName: tenant.full_name,
                        roomNumber: room?.room_number,
                        branchId: paymentBranchId,
                        channel: hasLine ? 'line' : 'facebook'
                    }
                });

            } catch (error) {
                console.error(`❌ Error processing payment ${payment.id}:`, error);
            }
        }

        // 6. ส่งข้อความ
        let sentCount = 0;
        let sendErrors = [];
        const successfulPaymentIds = new Set();

        const lineRecipients = recipients.filter(r => r.lineUserId);
        const facebookRecipients = recipients.filter(r => r.facebookUserId);

        console.log(`📊 Recipients: ${lineRecipients.length} LINE, ${facebookRecipients.length} Facebook`);

        if (recipients.length > 0) {
            if (testLineUserId) {
                console.log(`🧪 TEST MODE: Sending sample to ${testLineUserId}`);
                const sample = recipients[0];
                
                try {
                    const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                        recipients: [{
                            lineUserId: testLineUserId,
                            message: sample.message,
                            metadata: { ...sample.metadata, testMode: true }
                        }],
                        options: { batchSize: 1, retryAttempts: 2 }
                    });

                    sentCount = batchResult.data.success || 0;
                    if (sentCount > 0) successfulPaymentIds.add(sample.metadata.paymentId);
                    console.log(`✅ Test sent: ${sentCount}`);
                } catch (error) {
                    console.error('❌ Test error:', error);
                    sendErrors.push(`Test: ${error.message}`);
                }
            } else {
                // LINE
                if (lineRecipients.length > 0) {
                    console.log(`📤 Sending ${lineRecipients.length} LINE overdue reminders...`);
                    
                    const CHUNK_SIZE = 50;
                    const chunks = [];
                    for (let i = 0; i < lineRecipients.length; i += CHUNK_SIZE) {
                        chunks.push(lineRecipients.slice(i, i + CHUNK_SIZE));
                    }

                    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
                        const chunk = chunks[chunkIdx];
                        console.log(`📤 Chunk ${chunkIdx + 1}/${chunks.length} (${chunk.length} msgs)`);

                        try {
                            const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                                recipients: chunk,
                                options: {
                                    batchSize: 10,
                                    delayBetweenBatches: 2000,
                                    delayBetweenMessages: 150,
                                    retryAttempts: 3
                                }
                            });

                            const result = batchResult.data;
                            sentCount += result.success || 0;
                            
                            const failedPaymentIds = new Set();
                            if (result.errors && result.errors.length > 0) {
                                result.errors.slice(0, 5).forEach(err => {
                                    sendErrors.push(`ห้อง ${err.metadata?.roomNumber || 'N/A'}: ${err.error}`);
                                    if (err.metadata?.paymentId) failedPaymentIds.add(err.metadata.paymentId);
                                });
                            }
                            
                            chunk.forEach(r => {
                                if (!failedPaymentIds.has(r.metadata.paymentId)) {
                                    successfulPaymentIds.add(r.metadata.paymentId);
                                }
                            });

                            console.log(`✅ Chunk ${chunkIdx + 1}: sent ${result.success || 0}/${chunk.length}`);

                        } catch (error) {
                            console.error(`❌ Chunk ${chunkIdx + 1} error:`, error.message);
                            sendErrors.push(`Chunk ${chunkIdx + 1}: ${error.message}`);
                        }

                        if (chunkIdx < chunks.length - 1) {
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                }

                // Facebook
                if (facebookRecipients.length > 0) {
                    console.log(`📤 Sending ${facebookRecipients.length} Facebook reminders...`);

                    for (const recipient of facebookRecipients) {
                        try {
                            await base44.asServiceRole.functions.invoke('sendFacebookMessage', {
                                to: recipient.facebookUserId,
                                message: recipient.message,
                                branch_id: recipient.metadata.branchId
                            });
                            sentCount++;
                            successfulPaymentIds.add(recipient.metadata.paymentId);
                            console.log(`✅ Facebook → ${recipient.metadata.tenantName}`);
                        } catch (error) {
                            console.error(`❌ Facebook error:`, error);
                            sendErrors.push(`Facebook ห้อง ${recipient.metadata.roomNumber}: ${error.message}`);
                        }
                    }
                }
            }
        }

        // ⭐ อัปเดต sent_date เฉพาะที่ส่งสำเร็จ - ลด batch size เพื่อหลีกเลี่ยง rate limit
        console.log(`📝 Updating sent_date for ${successfulPaymentIds.size} successful payments...`);
        const now_iso = new Date().toISOString();
        const updateBatchSize = 10; // ลดจาก 50 เป็น 10
        const paymentIdsArray = Array.from(successfulPaymentIds);
        
        for (let i = 0; i < paymentIdsArray.length; i += updateBatchSize) {
            const batch = paymentIdsArray.slice(i, i + updateBatchSize);
            await Promise.all(
                batch.map(id => 
                    base44.asServiceRole.entities.Payment.update(id, { 
                        overdue_reminder_sent_date: now_iso
                    })
                        .catch(err => console.warn(`⚠️ Failed to update ${id}:`, err.message))
                )
            );
            console.log(`✅ Updated ${Math.min(i + updateBatchSize, paymentIdsArray.length)}/${paymentIdsArray.length}`);
            
            // ⭐ เพิ่ม delay ระหว่าง batch
            if (i + updateBatchSize < paymentIdsArray.length) {
                await new Promise(r => setTimeout(r, 500));
            }
        }

        const executionTime = Date.now() - startTime;

        // สร้างผลลัพธ์แยกตามสาขา
        const branchResults = [];
        const branchStats = {};

        recipients.forEach(r => {
            const branchId = r.metadata.branchId;
            if (!branchStats[branchId]) {
                branchStats[branchId] = { sent: 0, failed: 0, channel: r.metadata.channel };
            }
            branchStats[branchId].sent++;
        });

        sendErrors.forEach(err => {
            const match = err.match(/ห้อง\s+([^\s:]+)/);
            const roomMatch = match ? match[1] : null;
            if (roomMatch) {
                const recipient = recipients.find(r => r.metadata.roomNumber === roomMatch);
                if (recipient) {
                    const branchId = recipient.metadata.branchId;
                    if (!branchStats[branchId]) {
                        branchStats[branchId] = { sent: 0, failed: 0 };
                    }
                    branchStats[branchId].failed++;
                }
            }
        });

        const branches = await base44.asServiceRole.entities.Branch.list();
        Object.entries(branchStats).forEach(([branchId, stats]) => {
            const branch = branches.find(b => b.id === branchId);
            branchResults.push({
                branch_id: branchId,
                branch_name: branch?.branch_name || 'Unknown',
                status: stats.failed > 0 ? 'partial' : 'success',
                sent: stats.sent,
                failed: stats.failed,
                channel: stats.channel
            });
        });

        const responseResult = {
            success: true,
            message: testLineUserId 
                ? `🧪 ส่งข้อความทดสอบสำเร็จ (Test Mode)` 
                : `ส่งการแจ้งเตือนค้างชำระสำเร็จ ${sentCount}/${recipients.length} รายการ${totalRemaining > 0 ? ` | เหลืออีก ${totalRemaining} บิล` : ''}`,
            sent: sentCount,
            total: testLineUserId ? 1 : recipients.length,
            remaining: totalRemaining,
            hasMore: totalRemaining > 0,
            limit: limit,
            targetBranchId: targetBranchId || 'all',
            testMode: !!testLineUserId,
            enabledBranches: enabledBranches,
            skippedDueToDisabled: skippedCount,
            errors: sendErrors.length > 0 ? sendErrors : undefined,
            lineCount: lineRecipients.length,
            facebookCount: facebookRecipients.length
        };

        console.log('🎉 Automated overdue reminder completed:', responseResult);

        // บันทึก FunctionLog - หลีกเลี่ยง rate limit
        try {
            await new Promise(r => setTimeout(r, 1000)); // รอ 1 วิก่อนเขียน log
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendAutomatedOverdueReminders',
                run_timestamp: new Date().toISOString(),
                status: sendErrors.length > 0 && sentCount === 0 ? 'error' : 'success',
                message: responseResult.message,
                execution_time_ms: executionTime,
                total_sent: sentCount,
                total_failed: sendErrors.length,
                branch_results: branchResults,
                triggered_by: 'cron',
                details: responseResult
            });
        } catch (logError) {
            console.error('Failed to create FunctionLog:', logError);
        }

        return Response.json(responseResult);

    } catch (error) {
        console.error('❌ Error in sendAutomatedOverdueReminders:', error);
        console.error('📍 Error stack:', error.stack);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack,
            details: String(error)
        }, { status: 500 });
    }
});