import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

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
        const configs = await base44.asServiceRole.entities.Config.list();
        
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

        // ⭐ ดึง tenant และ room เฉพาะที่จำเป็น
        const uniqueTenantIds = [...new Set(dueToday.map(p => p.tenant_id).filter(id => id))];
        const uniqueRoomIds = [...new Set(dueToday.map(p => p.room_id).filter(id => id))];
        
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
        
        console.log(`✅ Loaded ${dueToday.length} relevant payments, ${tenantsBatch.length} tenants, ${roomsBatch.length} rooms`);

        const totalDueToday = dueToday.length;
        console.log(`📊 Found ${totalDueToday} payments ready to send`);

        const paymentsToProcess = dueToday.slice(0, limit);
        const totalRemaining = totalDueToday - paymentsToProcess.length;

        console.log(`📋 Processing this round: ${paymentsToProcess.length}`);
        console.log(`📋 Remaining for next round: ${totalRemaining}`);

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
                const branchBankName = getConfigValue('bank_name', 'กสิกร', paymentBranchId);
                const branchBankAccountNumber = getConfigValue('bank_account_number', '0722835522', paymentBranchId);
                const branchBankAccountName = getConfigValue('bank_account_name', 'ธนานนท์ พรมพักตร์', paymentBranchId);
                const branchBuildingName = getConfigValue('building_name', 'W RESIDENTS', paymentBranchId);
                const branchLateFeePerDay = parseFloat(getConfigValue('late_payment_fee_per_day', '0', paymentBranchId));

                // ⭐ เช็คว่าเปิดค่าปรับแบบขั้นบันไดหรือไม่
                const branchTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === paymentBranchId);
                const globalTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
                const tiersEnabledConfig = branchTiersEnabledConfig || globalTiersEnabledConfig;
                const tiersEnabled = tiersEnabledConfig?.value === 'true';

                // ⭐ สร้าง Flex Message (ใช้โครงสร้างเดียวกับ sendReceipt)
                const bodyContents = [
                    { type: "text", text: "👤 ข้อมูลผู้เช่า", size: "sm", color: "#aaaaaa", margin: "md" },
                    { type: "text", text: tenant.full_name, size: "lg", weight: "bold", color: "#111111", margin: "sm" },
                    { type: "text", text: `ห้อง ${room?.room_number || 'N/A'}`, size: "sm", color: "#555555" },
                    { type: "separator", margin: "lg" },
                    {
                        type: "box",
                        layout: "horizontal",
                        margin: "lg",
                        contents: [
                            { type: "text", text: "💰 ยอดชำระวันนี้", size: "sm", color: "#555555", flex: 0 },
                            { type: "text", text: `${payment.total_amount.toLocaleString()} บาท`, size: "xl", color: "#f59e0b", weight: "bold", align: "end" }
                        ]
                    }
                ];
                
                if (tiersEnabled || branchLateFeePerDay > 0) {
                    bodyContents.push({
                        type: "box",
                        layout: "vertical",
                        margin: "lg",
                        contents: [
                            { type: "text", text: "⚠️ ค่าปรับชำระล่าช้า", size: "sm", color: "#dc2626", weight: "bold" },
                            { type: "text", text: branchLateFeePerDay > 0 ? `${branchLateFeePerDay} บาท/วัน` : "ตามขั้นบันได", size: "xs", color: "#991b1b", margin: "sm" }
                        ],
                        backgroundColor: "#fef2f2",
                        cornerRadius: "md",
                        paddingAll: "12px"
                    });
                }
                
                bodyContents.push({ type: "separator", margin: "lg" });
                bodyContents.push({ type: "text", text: "📸 ส่งสลิปหลังโอนเงิน", size: "sm", color: "#10b981", align: "center", margin: "lg", weight: "bold" });

                const flexMessage = {
                    type: "flex",
                    altText: `⏰ ครบกำหนดชำระวันนี้ - ห้อง ${room?.room_number || 'N/A'}`,
                    contents: {
                        type: "bubble",
                        size: "mega",
                        header: {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "box",
                                    layout: "vertical",
                                    contents: [
                                        { type: "text", text: "⏰ ครบกำหนดชำระ", color: "#ffffff", size: "xl", weight: "bold", align: "center" },
                                        { type: "text", text: branchBuildingName, color: "#ffffff", size: "sm", align: "center", margin: "md" }
                                    ]
                                }
                            ],
                            backgroundColor: "#f59e0b",
                            paddingTop: "20px",
                            paddingBottom: "20px"
                        },
                        body: {
                            type: "box",
                            layout: "vertical",
                            contents: bodyContents
                        }
                    }
                };

                recipients.push({
                    lineUserId: hasLine ? tenant.line_user_id : null,
                    facebookUserId: hasFacebook ? tenant.facebook_user_id : null,
                    message: flexMessage,
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
            // LINE - ส่ง Flex Message โดยตรง
            if (lineRecipients.length > 0) {
                console.log(`📤 Sending ${lineRecipients.length} LINE Flex Messages...`);
                
                // ดึง LINE token
                const lineTokenConfig = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
                const lineToken = lineTokenConfig?.value || Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
                
                if (!lineToken) {
                    console.error('❌ LINE token not found');
                    sendErrors.push('LINE token not configured');
                } else {
                    for (const recipient of lineRecipients) {
                        try {
                            const payload = {
                                to: testLineUserId || recipient.lineUserId,
                                messages: [recipient.message]
                            };
                            
                            console.log(`🔍 Sending to ${recipient.metadata.tenantName}:`, JSON.stringify(payload, null, 2));
                            
                            const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${lineToken}`
                                },
                                body: JSON.stringify(payload)
                            });

                            if (lineResponse.ok) {
                                sentCount++;
                                successfulPaymentIds.add(recipient.metadata.paymentId);
                                console.log(`✅ Sent to ${recipient.metadata.tenantName} (ห้อง ${recipient.metadata.roomNumber})`);
                            } else {
                                const errorText = await lineResponse.text();
                                let errorData;
                                try {
                                    errorData = JSON.parse(errorText);
                                } catch {
                                    errorData = { message: errorText };
                                }
                                sendErrors.push(`ห้อง ${recipient.metadata.roomNumber}: ${errorData.message || errorData.details || 'LINE API error'}`);
                                console.error(`❌ LINE error (${lineResponse.status}):`, errorData);
                            }
                            
                            await new Promise(r => setTimeout(r, 200));
                            
                            if (testLineUserId) break;
                        } catch (error) {
                            console.error(`❌ Send error:`, error);
                            sendErrors.push(`ห้อง ${recipient.metadata.roomNumber}: ${error.message}`);
                        }
                    }
                }
            }

            // Facebook - ส่ง text ปกติ (ยังไม่รองรับ template)
            if (facebookRecipients.length > 0 && !testLineUserId) {
                console.log(`📤 Sending ${facebookRecipients.length} Facebook messages...`);

                for (const recipient of facebookRecipients) {
                    try {
                        // แปลง Flex Message กลับเป็น text สำหรับ Facebook
                        let textMessage = `⏰ วันนี้ครบกำหนดชำระ\n\n`;
                        textMessage += `ห้อง ${recipient.metadata.roomNumber}\n`;
                        textMessage += `ยอดชำระ: ${recipient.message.contents.body.contents.find(c => c.layout === 'horizontal')?.contents[1]?.text || 'N/A'}\n\n`;
                        textMessage += `📸 ส่งสลิปหลังโอนเงิน`;
                        
                        await base44.asServiceRole.functions.invoke('sendFacebookMessage', {
                            to: recipient.facebookUserId,
                            message: textMessage,
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