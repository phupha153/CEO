import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ⭐ สร้าง timestamp เวลาไทย (UTC+7)
function getThailandTimestamp() {
    const now = new Date();
    const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    return thailandTime.toISOString();
}

// Due date reminder function - sends LINE notifications on payment due dates
// Version: 2025-11-27 - Added tracking for sent reminders
Deno.serve(async (req) => {
    const startTime = Date.now();
    
    try {
        const base44 = createClientFromRequest(req);
        
        console.log('🔔 Starting due date reminder check...');

        // Parse request body to check for test mode and limit
        let testLineUserId = null;
        let targetBranchId = null;
        let limit = 50; // จำนวนบิลสูงสุดที่จะส่งต่อครั้ง (default 50)
        try {
            const text = await req.text();
            if (text) {
                const body = JSON.parse(text);
                testLineUserId = body.test_line_user_id || null;
                targetBranchId = body.branch_id || null;
                limit = body.limit || 50;
            }
        } catch (parseError) {
            console.log('⚠️ No body or parse error:', parseError.message);
        }

        console.log('📊 Limit per run:', limit);

        // 1. ดึงการตั้งค่าจาก Config
        const configsResponse = await base44.asServiceRole.entities.Config.list('', 1000);
        const configs = Array.isArray(configsResponse) ? configsResponse : (configsResponse?.data || []);
        
        // ⭐ สรุปสถานะการเปิด/ปิดแจ้งเตือนวันครบกำหนดแต่ละสาขา
        const branchReminderConfigs = configs.filter(c => c.key === 'send_due_date_reminder');
        const enabledBranches = branchReminderConfigs
            .filter(c => c.value === 'true')
            .map(c => c.branch_id)
            .filter(id => id && id.trim() !== ''); // ⭐ กรองเอา null/undefined/empty ออก
        const disabledBranches = branchReminderConfigs
            .filter(c => c.value !== 'true')
            .map(c => c.branch_id)
            .filter(id => id && id.trim() !== '');

        console.log(`📊 Branch due date reminder status summary:`);
        console.log(`   ✅ Enabled branches (${enabledBranches.length}): ${enabledBranches.slice(0, 5).join(', ')}${enabledBranches.length > 5 ? '...' : ''}`);
        console.log(`   ❌ Disabled branches (${disabledBranches.length}): ${disabledBranches.length} branches`);

        // ถ้าไม่มีสาขาไหนเปิดเลย
        if (enabledBranches.length === 0) {
            console.log('⚠️ No branches have due date reminders enabled');
            return Response.json({
                success: true,
                message: 'ไม่มีสาขาใดเปิดการแจ้งเตือนวันครบกำหนด กรุณาเปิดในหน้าตั้งค่า > บิล',
                sent: 0,
                enabledBranches: [],
                disabledBranches: disabledBranches.length
            });
        }

        console.log('✅ Due date reminder check started');

        // 2. Helper function to get config value by branch
        const getConfigValue = (key, defaultValue, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        // ⭐ Helper function สำหรับดึงข้อมูลแบบ pagination
        async function fetchAll(entity, filter = null) {
            let allData = [];
            let skip = 0;
            let hasMore = true;
            
            while (hasMore) {
                const batch = filter 
                    ? await entity.filter(filter, '-created_date', 5000, skip)
                    : await entity.list('-created_date', 5000, skip);
                    
                if (!Array.isArray(batch) || batch.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(batch);
                    skip += batch.length;
                    if (batch.length < 5000) hasMore = false;
                }
            }
            return allData;
        }

        // ⭐ ดึงวันที่จาก test_current_date ถ้ามี (สำหรับทดสอบ)
        const testDateConfig = configs.find(c => c.key === 'test_current_date' && !c.branch_id);
        let todayString;
        
        if (testDateConfig && testDateConfig.value && testDateConfig.value.trim() !== '') {
            todayString = testDateConfig.value.trim();
            console.log(`🧪 TEST MODE: Using test_current_date = ${todayString}`);
        } else {
            const now = new Date();
            const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
            todayString = thailandTime.toISOString().split('T')[0];
            console.log(`📅 Using Thailand date: ${todayString}`);
        }

        // 3. ดึงข้อมูลแบบกรองเฉพาะที่จำเป็น - ไม่ดึงทั้งหมด
        console.log('🔍 Fetching filtered data...');

        // ⭐ ดึงเฉพาะ payment ที่ due_date = วันนี้ และยังไม่ชำระ และสาขาเปิดใช้งาน
        const paymentFilter = {
            due_date: todayString,
            status: 'pending'
        };
        
        if (targetBranchId) {
            paymentFilter.branch_id = targetBranchId;
        }

        let allPayments = await fetchAll(base44.asServiceRole.entities.Payment, paymentFilter);
        
        // เพิ่มเช็ค overdue ด้วย (กรณีที่ระบบตั้งเป็น overdue แต่ยังไม่ชำระ)
        const overdueFilter = {
            due_date: todayString,
            status: 'overdue'
        };
        if (targetBranchId) {
            overdueFilter.branch_id = targetBranchId;
        }
        
        const overduePayments = await fetchAll(base44.asServiceRole.entities.Payment, overdueFilter);
        allPayments = [...allPayments, ...overduePayments];

        console.log(`📊 Payments due today (${todayString}): ${allPayments.length}`);

        // กรองบิลที่ยังไม่ได้ส่งแจ้งเตือนวันครบกำหนด และสาขาเปิดใช้งาน
        const dueToday = allPayments.filter(p => {
            // ⭐ เช็คแบบเข้มงวด - ป้องกันส่งซ้ำ
            if (p.due_date_reminder_sent_date) {
                console.log(`⏭️ Skip payment ${p.id} - due date reminder already sent at ${p.due_date_reminder_sent_date}`);
                return false;
            }
            if (!enabledBranches.includes(p.branch_id)) {
                console.log(`⏭️ Skip payment ${p.id} - branch ${p.branch_id} disabled`);
                return false;
            }
            return true;
        });
        
        console.log(`📊 After filtering: ${dueToday.length} payments need reminder`);

        const totalDueToday = dueToday.length;
        console.log(`📊 Found ${totalDueToday} payments ready to send`);

        const paymentsToProcess = dueToday.slice(0, limit);
        const totalRemaining = totalDueToday - paymentsToProcess.length;

        console.log(`📋 Processing this round: ${paymentsToProcess.length}`);
        console.log(`📋 Remaining for next round: ${totalRemaining}`);

        // ⭐ ดึง tenant และ room แบบ Batch ทีละสาขา (ลด N+1 Queries)
        const uniqueBranchIds = [...new Set(paymentsToProcess.map(p => p.branch_id).filter(id => id))];
        console.log(`📥 Fetching tenants and rooms for ${uniqueBranchIds.length} branches...`);
        
        const allTenants = [];
        const allRooms = [];
        const CACHE_CHUNK = 500;

        for (const bId of uniqueBranchIds) {
            // ดึง Tenant
            let tOffset = 0;
            while (true) {
                const chunk = await base44.asServiceRole.entities.Tenant.filter({ branch_id: bId }, '-id', CACHE_CHUNK, tOffset);
                if (chunk.length === 0) break;
                allTenants.push(...chunk.map(t => ({
                    id: t.id,
                    full_name: t.full_name,
                    line_user_id: t.line_user_id,
                    facebook_user_id: t.facebook_user_id
                })));
                tOffset += CACHE_CHUNK;
                if (chunk.length < CACHE_CHUNK) break;
            }

            // ดึง Room
            let rOffset = 0;
            while (true) {
                const chunk = await base44.asServiceRole.entities.Room.filter({ branch_id: bId }, '-id', CACHE_CHUNK, rOffset);
                if (chunk.length === 0) break;
                allRooms.push(...chunk.map(r => ({
                    id: r.id,
                    room_number: r.room_number
                })));
                rOffset += CACHE_CHUNK;
                if (chunk.length < CACHE_CHUNK) break;
            }
        }

        const tenantMap = new Map(allTenants.map(t => [t.id, t]));
        const roomMap = new Map(allRooms.map(r => [r.id, r]));
        
        console.log(`✅ Loaded ${paymentsToProcess.length} payments, ${allTenants.length} tenants, ${allRooms.length} rooms`);

        // 4. เตรียมข้อความสำหรับแต่ละบิล
        const recipients = [];

        for (const payment of paymentsToProcess) {
            try {
                const tenant = tenantMap.get(payment.tenant_id);
                const room = roomMap.get(payment.room_id);

                if (!tenant) continue;

                const hasLine = tenant.line_user_id && tenant.line_user_id.trim() !== '';
                const hasFacebook = tenant.facebook_user_id && tenant.facebook_user_id.trim() !== '';
                
                if (!hasLine && !hasFacebook) continue;

                // ดึง config เฉพาะสาขาของบิลนี้
                const paymentBranchId = payment.branch_id;
                const branchBankName = getConfigValue('bank_name', '-', paymentBranchId);
                const branchBankAccountNumber = getConfigValue('bank_account_number', '-', paymentBranchId);
                const branchBankAccountName = getConfigValue('bank_account_name', '-', paymentBranchId);
                const branchBuildingName = getConfigValue('building_name', 'ที่พัก', paymentBranchId);
                const branchLateFeePerDay = parseFloat(getConfigValue('late_payment_fee_per_day', '0', paymentBranchId));

                // ⭐ สร้าง Text Message แบบเดียวกับ sendPaymentReminder (ไม่ใช้ Flex Message)
                const branchTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === paymentBranchId);
                const globalTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
                const tiersEnabledConfig = branchTiersEnabledConfig || globalTiersEnabledConfig;
                const tiersEnabled = tiersEnabledConfig?.value === 'true';

                // ⭐ ดึง late fee tiers
                let lateFeeStructure = null;
                if (tiersEnabled) {
                    const branchTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && c.branch_id === paymentBranchId);
                    const globalTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
                    const tiersConfig = branchTiersConfig || globalTiersConfig;
                    if (tiersConfig?.value) {
                        try {
                            lateFeeStructure = JSON.parse(tiersConfig.value);
                        } catch {}
                    }
                }

                // สร้างข้อความ
                let message = `📅 แจ้งเตือนค่าเช่า (ครบกำหนดวันนี้)\n\n`;
                message += `${branchBuildingName}\n`;
                message += `คุณ ${tenant.full_name} ห้อง ${room?.room_number || 'N/A'}\n\n`;
                message += `💰 รวมทั้งสิ้น: ${payment.total_amount.toLocaleString()} บาท\n\n`;
                
                // แจ้งค่าปรับ
                if (lateFeeStructure && Array.isArray(lateFeeStructure) && lateFeeStructure.length > 0) {
                    message += `⚠️ ค่าปรับชำระล่าช้า:\n`;
                    lateFeeStructure.forEach((tier) => {
                        if (tier.days_to >= 999) {
                            message += `   วันที่ ${tier.days_from} เป็นต้นไป: ${tier.fee_per_day} บาท/วัน\n`;
                        } else {
                            message += `   วันที่ ${tier.days_from}-${tier.days_to}: ${tier.fee_per_day} บาท/วัน\n`;
                        }
                    });
                    message += `\n`;
                } else if (branchLateFeePerDay > 0) {
                    message += `⚠️ หากชำระหลังวันนี้ มีค่าปรับ ${branchLateFeePerDay} บาท/วัน\n\n`;
                }
                
                message += `📸 รบกวนส่งสลิปหลังโอนไปทางแชทนี้ด้วยค่ะ`;

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

        // 5. ส่งข้อความ - ส่ง Flex Message โดยตรงไป LINE API
        let sentCount = 0;
        let sendErrors = [];
        const successfulPaymentIds = new Set();

        const lineRecipients = recipients.filter(r => r.lineUserId);
        const facebookRecipients = recipients.filter(r => r.facebookUserId);

        console.log(`📊 Recipients: ${lineRecipients.length} LINE, ${facebookRecipients.length} Facebook`);

        if (recipients.length > 0) {
            // ⭐ ส่งผ่าน sendBatchLineMessages และ sendFacebookPaymentReminder (เหมือน sendPaymentReminder)
            const lineRecipientsCleaned = lineRecipients.map(r => ({
                lineUserId: testLineUserId || r.lineUserId,
                message: r.message,
                branchId: r.metadata.branchId,
                metadata: {
                    paymentId: r.metadata.paymentId,
                    tenantId: r.metadata.tenantId,
                    tenantName: r.metadata.tenantName,
                    roomNumber: r.metadata.roomNumber,
                    branchId: r.metadata.branchId,
                    platform: 'line'
                }
            }));

            if (lineRecipientsCleaned.length > 0) {
                try {
                    const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                        recipients: lineRecipientsCleaned,
                        options: {
                            batchSize: 10,
                            delayBetweenBatches: 2000,
                            delayBetweenMessages: 200,
                            retryAttempts: 2
                        }
                    });

                    const result = batchResult.data;
                    sentCount += result.success || 0;
                    
                    if (result.errors) {
                        result.errors.forEach(err => {
                            sendErrors.push(`ห้อง ${err.lineUserId || 'N/A'}: ${err.error || 'Unknown error'}`);
                        });
                    }
                    
                    // เพิ่ม payment IDs ที่ส่งสำเร็จ (กรองเอาเฉพาะคนที่ไม่มี error)
                    const failedLineUserIds = (result.errors || []).map(err => err.lineUserId).filter(Boolean);
                    lineRecipientsCleaned.forEach(r => {
                        if (!failedLineUserIds.includes(r.lineUserId)) {
                            successfulPaymentIds.add(r.metadata.paymentId);
                        }
                    });

                    console.log(`✅ LINE: ${result.success}/${lineRecipientsCleaned.length} sent`);
                } catch (lineError) {
                    console.error('❌ LINE batch send failed:', lineError);
                    sendErrors.push(`LINE batch error: ${lineError.message}`);
                }
            }

            // Facebook
            if (facebookRecipients.length > 0 && !testLineUserId) {
                try {
                    const fbResult = await base44.asServiceRole.functions.invoke('sendFacebookPaymentReminder', {
                        recipients: facebookRecipients
                    });

                    const result = fbResult.data;
                    sentCount += result.success || 0;
                    
                    if (result.errors) {
                        result.errors.forEach(err => {
                            sendErrors.push(`Facebook: ${err.error || 'Unknown error'}`);
                        });
                    }
                    
                    // เพิ่ม payment IDs ที่ส่งสำเร็จ (กรองเอาเฉพาะคนที่ไม่มี error)
                    const failedFbUserIds = (result.errors || []).map(err => err.facebookUserId || err.recipientId || err.id).filter(Boolean);
                    facebookRecipients.forEach(r => {
                        if (!failedFbUserIds.includes(r.facebookUserId)) {
                            successfulPaymentIds.add(r.metadata.paymentId);
                        }
                    });

                    console.log(`✅ Facebook: ${result.success}/${facebookRecipients.length} sent`);
                } catch (fbError) {
                    console.error('❌ Facebook batch send failed:', fbError);
                    sendErrors.push(`Facebook batch error: ${fbError.message}`);
                }
            }
        }

        // ⭐ อัปเดต sent_date เฉพาะที่ส่งสำเร็จ - ลด batch size เพื่อหลีกเลี่ยง rate limit
        console.log(`📝 Updating sent_date for ${successfulPaymentIds.size} successful payments...`);
        const now_iso = getThailandTimestamp();
        const updateBatchSize = 10; // ลดจาก 50 เป็น 10 เพื่อหลีกเลี่ยง rate limit
        const paymentIdsArray = Array.from(successfulPaymentIds);
        
        for (let i = 0; i < paymentIdsArray.length; i += updateBatchSize) {
            const batch = paymentIdsArray.slice(i, i + updateBatchSize);
            await Promise.all(
                batch.map(id => 
                    base44.asServiceRole.entities.Payment.update(id, { 
                        due_date_reminder_sent_date: now_iso,
                        bill_sent_date: now_iso
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

        const result = {
            success: true,
            message: testLineUserId 
                ? `🧪 ส่งข้อความทดสอบสำเร็จ (Test Mode)` 
                : `ส่งการแจ้งเตือนสำเร็จ ${sentCount}/${recipients.length} รายการ${totalRemaining > 0 ? ` | เหลืออีก ${totalRemaining} บิล` : ''}`,
            sent: sentCount,
            total: testLineUserId ? 1 : recipients.length,
            remaining: totalRemaining,
            hasMore: totalRemaining > 0,
            limit: limit,
            testMode: !!testLineUserId,
            enabledBranches: enabledBranches,
            errors: sendErrors.length > 0 ? sendErrors : undefined,
            currentDate: todayString,
            usingTestDate: !!(testDateConfig && testDateConfig.value && testDateConfig.value.trim() !== ''),
            lineCount: lineRecipients.length,
            facebookCount: facebookRecipients.length
        };

        console.log('🎉 Due date reminder completed:', result);
        
        const executionTime = Date.now() - startTime;
        
        // สร้าง branch_results - หลีกเลี่ยง rate limit
        try {
            await new Promise(r => setTimeout(r, 1000)); // รอ 1 วิก่อนเขียน log

            const branchResults = [];
            const branchStats = {};

            recipients.forEach(r => {
                const branchId = r.metadata.branchId;
                if (!branchStats[branchId]) {
                    branchStats[branchId] = { sent: 0, failed: 0 };
                }
                branchStats[branchId].sent++;
            });

            sendErrors.forEach(err => {
                const match = err.match(/ห้อง\s+([^\s:]+)/);
                if (match) {
                    const roomNum = match[1];
                    const recipient = recipients.find(r => r.metadata.roomNumber === roomNum);
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
                    failed: stats.failed
                });
            });

            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendDueDateReminders',
                run_timestamp: getThailandTimestamp(),
                status: sendErrors.length > 0 && sentCount === 0 ? 'error' : 'success',
                message: result.message,
                execution_time_ms: executionTime,
                total_sent: sentCount,
                total_failed: sendErrors.length,
                branch_results: branchResults,
                triggered_by: 'cron',
                details: result
            });
        } catch (logError) {
            console.error('Failed to create FunctionLog:', logError);
        }

        return Response.json(result);

    } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error('❌ Error in sendDueDateReminders:', error);
        console.error('📍 Error stack:', error.stack);
        
        // บันทึก error log - หลีกเลี่ยง rate limit
        try {
            await new Promise(r => setTimeout(r, 1000)); // รอ 1 วิก่อนเขียน log
            const base44ForLog = createClientFromRequest(req);
            await base44ForLog.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendDueDateReminders',
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