import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

                // ⭐ สร้าง Flex Message แบบครบกำหนดชำระ
                const roomNumber = room?.room_number || 'N/A';
                
                // เตรียมข้อมูลค่าปรับ
                let lateFeeText = '';
                if (tiersEnabled) {
                    const lateFeeStructureConfig = configs.find(c => 
                        c.key === 'late_fee_tiers' && c.branch_id === paymentBranchId
                    );
                    let lateFeeStructure = null;
                    if (lateFeeStructureConfig?.value) {
                        try {
                            lateFeeStructure = JSON.parse(lateFeeStructureConfig.value);
                        } catch {}
                    }

                    if (lateFeeStructure && Array.isArray(lateFeeStructure) && lateFeeStructure.length > 0) {
                        lateFeeText = 'ค่าปรับชำระล่าช้า:\n';
                        lateFeeStructure.forEach((tier) => {
                            if (tier.days_from !== undefined && tier.days_to !== undefined) {
                                if (tier.days_to >= 999) {
                                    lateFeeText += `วันที่ ${tier.days_from}+ : ${tier.fee_per_day}฿/วัน\n`;
                                } else {
                                    lateFeeText += `วันที่ ${tier.days_from}-${tier.days_to}: ${tier.fee_per_day}฿/วัน\n`;
                                }
                            }
                        });
                    }
                } else if (branchLateFeePerDay > 0) {
                    lateFeeText = `หากชำระหลังวันนี้\nค่าปรับ ${branchLateFeePerDay}฿/วัน`;
                }

                const flexMessage = {
                    type: "flex",
                    altText: `⏰ ครบกำหนดชำระวันนี้ - ห้อง ${roomNumber} (${payment.total_amount.toLocaleString()}฿)`,
                    contents: {
                        type: "bubble",
                        header: {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "text",
                                    text: "⏰ ครบกำหนดชำระวันนี้",
                                    weight: "bold",
                                    size: "xl",
                                    color: "#F59E0B"
                                },
                                {
                                    type: "text",
                                    text: branchBuildingName,
                                    size: "sm",
                                    color: "#64748B",
                                    margin: "sm"
                                }
                            ],
                            backgroundColor: "#FFFBEB",
                            paddingAll: "15px"
                        },
                        body: {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "box",
                                    layout: "baseline",
                                    contents: [
                                        { type: "text", text: "ผู้เช่า", size: "sm", color: "#64748B", flex: 3 },
                                        { type: "text", text: tenant.full_name, size: "sm", weight: "bold", flex: 5, wrap: true }
                                    ],
                                    margin: "md"
                                },
                                {
                                    type: "box",
                                    layout: "baseline",
                                    contents: [
                                        { type: "text", text: "ห้อง", size: "sm", color: "#64748B", flex: 3 },
                                        { type: "text", text: roomNumber, size: "sm", weight: "bold", flex: 5 }
                                    ],
                                    margin: "sm"
                                },
                                { type: "separator", margin: "lg" },
                                {
                                    type: "box",
                                    layout: "baseline",
                                    contents: [
                                        { type: "text", text: "ยอดชำระ", size: "md", weight: "bold", flex: 3 },
                                        { type: "text", text: `${payment.total_amount.toLocaleString()} ฿`, size: "xl", weight: "bold", color: "#2563EB", flex: 5 }
                                    ],
                                    margin: "md"
                                },
                                ...(lateFeeText ? [{
                                    type: "box",
                                    layout: "vertical",
                                    contents: [
                                        { type: "text", text: lateFeeText, size: "xxs", color: "#DC2626", wrap: true }
                                    ],
                                    backgroundColor: "#FEF2F2",
                                    cornerRadius: "8px",
                                    paddingAll: "8px",
                                    margin: "md"
                                }] : [])
                            ],
                            paddingAll: "15px"
                        },
                        footer: {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                {
                                    type: "text",
                                    text: "💳 ข้อมูลการโอน",
                                    weight: "bold",
                                    size: "sm",
                                    color: "#1E293B"
                                },
                                {
                                    type: "box",
                                    layout: "vertical",
                                    contents: [
                                        { type: "text", text: `${branchBankName} ${branchBankAccountNumber}`, size: "xs", color: "#475569" },
                                        { type: "text", text: branchBankAccountName, size: "xs", color: "#475569" }
                                    ],
                                    margin: "sm",
                                    backgroundColor: "#F1F5F9",
                                    cornerRadius: "6px",
                                    paddingAll: "10px"
                                },
                                {
                                    type: "text",
                                    text: "📸 ส่งสลิปหลังโอนค่ะ 🙏",
                                    size: "xs",
                                    color: "#64748B",
                                    margin: "md"
                                }
                            ],
                            paddingAll: "15px",
                            backgroundColor: "#F8FAFC"
                        }
                    }
                };

                recipients.push({
                    lineUserId: hasLine ? tenant.line_user_id : null,
                    facebookUserId: hasFacebook ? tenant.facebook_user_id : null,
                    flexMessage: hasLine ? flexMessage : null,
                    message: hasFacebook ? `⏰ วันนี้ครบกำหนดชำระค่าเช่า\n\n🏠 ${branchBuildingName}\n👤 คุณ ${tenant.full_name} ห้อง ${roomNumber}\n💰 ยอดชำระ: ${payment.total_amount.toLocaleString()} บาท\n\n${lateFeeText ? `⚠️ ${lateFeeText}\n\n` : ''}💳 โอนเงินได้ที่:\n${branchBankName} ${branchBankAccountNumber}\nชื่อ: ${branchBankAccountName}\n\n📸 ส่งสลิปหลังโอนค่ะ` : null,
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

        // 5. ส่งข้อความ
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
                    console.log(`📤 Sending ${lineRecipients.length} LINE messages...`);
                    
                    const CHUNK_SIZE = 50;
                    const chunks = [];
                    for (let i = 0; i < lineRecipients.length; i += CHUNK_SIZE) {
                        chunks.push(lineRecipients.slice(i, i + CHUNK_SIZE));
                    }

                    for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
                        const chunk = chunks[chunkIdx];
                        console.log(`📤 Chunk ${chunkIdx + 1}/${chunks.length} (${chunk.length} msgs)`);

                        try {
                            // ⭐ ส่ง Flex Message แทนข้อความธรรมดา
                            const lineAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
                            if (!lineAccessToken) {
                                throw new Error('LINE_CHANNEL_ACCESS_TOKEN not set');
                            }

                            let chunkSuccess = 0;
                            let chunkFailed = 0;
                            const chunkErrors = [];

                            for (const recipient of chunk) {
                                try {
                                    console.log(`📤 Sending to ${recipient.metadata.tenantName} (${recipient.metadata.roomNumber})...`);
                                    console.log(`📋 Flex Message:`, JSON.stringify(recipient.flexMessage, null, 2));
                                    
                                    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${lineAccessToken}`
                                        },
                                        body: JSON.stringify({
                                            to: recipient.lineUserId,
                                            messages: [recipient.flexMessage]
                                        })
                                    });

                                    if (lineResponse.ok) {
                                        chunkSuccess++;
                                        successfulPaymentIds.add(recipient.metadata.paymentId);
                                        console.log(`✅ Sent successfully`);
                                    } else {
                                        const errorText = await lineResponse.text();
                                        console.error(`❌ LINE API Error (${lineResponse.status}):`, errorText);
                                        let errorData;
                                        try {
                                            errorData = JSON.parse(errorText);
                                        } catch {
                                            errorData = { message: errorText };
                                        }
                                        chunkFailed++;
                                        chunkErrors.push({
                                            metadata: recipient.metadata,
                                            error: errorData.message || errorText
                                        });
                                    }

                                    await new Promise(r => setTimeout(r, 150));
                                } catch (err) {
                                    console.error(`❌ Send error for ${recipient.metadata.roomNumber}:`, err);
                                    chunkFailed++;
                                    chunkErrors.push({
                                        metadata: recipient.metadata,
                                        error: err.message
                                    });
                                }
                            }

                            const batchResult = {
                                data: {
                                    success: chunkSuccess,
                                    failed: chunkFailed,
                                    errors: chunkErrors
                                }
                            };

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
                    console.log(`📤 Sending ${facebookRecipients.length} Facebook messages...`);

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