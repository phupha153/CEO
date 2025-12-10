import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Version: 2025-12-10 - Updated message format to match sendPaymentReminder

// ⭐ ฟังก์ชันสร้าง hash จากข้อมูลบิล เพื่อตรวจจับการเปลี่ยนแปลง
function generatePaymentHash(payment) {
    const dataToHash = {
        rent_amount: payment.rent_amount || 0,
        water_units: payment.water_units || 0,
        water_amount: payment.water_amount || 0,
        electricity_units: payment.electricity_units || 0,
        electricity_amount: payment.electricity_amount || 0,
        internet_amount: payment.internet_amount || 0,
        common_fee_amount: payment.common_fee_amount || 0,
        parking_fee_amount: payment.parking_fee_amount || 0,
        other_amount: payment.other_amount || 0,
        total_amount: payment.total_amount || 0,
        due_date: payment.due_date || ''
    };
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32);
}

// ฟังก์ชันแปลงตัวเลขเป็นตัวหนังสือไทย
function numberToThaiText(number) {
    if (number === undefined || number === null || isNaN(number) || number === 0) return 'ศูนย์บาทถ้วน';

    const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    
    const parts = number.toFixed(2).split('.');
    const integerPart = parseInt(parts[0]);
    const decimalPart = parseInt(parts[1]);

    function convertInteger(num) {
        if (num === 0) return '';
        
        const numStr = num.toString();
        const len = numStr.length;
        let result = '';
        
        for (let i = 0; i < len; i++) {
            const digit = parseInt(numStr[i]);
            const position = len - i - 1;
            
            if (digit === 0) continue;
            
            if (position === 1) {
                if (digit === 1) {
                    result += 'สิบ';
                } else if (digit === 2) {
                    result += 'ยี่สิบ';
                } else {
                    result += numbers[digit] + positions[position];
                }
            } else if (position === 0 && digit === 1 && len > 1 && parseInt(numStr[len-2]) !== 0) {
                result += 'เอ็ด';
            } else {
                result += numbers[digit] + positions[position];
            }
        }
        
        return result;
    }
    
    let text = convertInteger(integerPart) + 'บาท';
    
    if (decimalPart > 0) {
        text += convertInteger(decimalPart) + 'สตางค์';
    } else {
        text += 'ถ้วน';
    }
    
    return text;
}
Deno.serve(async (req) => {
    const startTime = Date.now();
    console.log('🚀 sendAdvanceReminders function started');
    
    try {
        console.log('📢 Starting advance reminder check...');
        
        const base44 = createClientFromRequest(req);
        console.log('✅ Base44 client created');

        // Parse request body to check for branch_id, test mode, and limit
        let targetBranchId = null;
        let testLineUserId = null;
        let limit = 30; // จำนวนบิลสูงสุดที่จะส่งต่อครั้ง (default 30)
        let body = {};
        try {
            const text = await req.text();
            if (text) {
                body = JSON.parse(text);
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
        
        // Helper function to get config value by branch
        const getConfigValue = (key, defaultValue, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        // ⭐ สรุปสถานะการเปิด/ปิดแจ้งเตือนล่วงหน้าแต่ละสาขา
        const branchReminderConfigs = configs.filter(c => c.key === 'send_advance_reminder');
        const enabledBranches = branchReminderConfigs.filter(c => c.value === 'true').map(c => c.branch_id);
        const disabledBranches = branchReminderConfigs.filter(c => c.value !== 'true').map(c => c.branch_id);
        
        console.log(`📊 Branch reminder status summary:`);
        console.log(`   ✅ Enabled branches (${enabledBranches.length}): ${enabledBranches.join(', ') || 'none'}`);
        console.log(`   ❌ Disabled branches (${disabledBranches.length}): ${disabledBranches.length} branches`);

        // ถ้าไม่มีสาขาไหนเปิดเลย
        if (enabledBranches.length === 0) {
            console.log('⚠️ No branches have advance reminders enabled');
            return Response.json({
                success: true,
                message: 'ไม่มีสาขาใดเปิดการแจ้งเตือนล่วงหน้า กรุณาเปิดในหน้าตั้งค่า > บิล',
                sent: 0,
                enabledBranches: [],
                disabledBranches: disabledBranches.length
            });
        }

        // ⭐ ดึง advanceDays เฉพาะตอนแสดง log (จะใช้ค่าเฉพาะสาขาตอน loop)
        const defaultAdvanceDays = parseInt(getConfigValue('bill_advance_notice_days', '3', targetBranchId));
        console.log(`📅 Default advance notice: ${defaultAdvanceDays} days`);

        // 2. คำนวณวันปัจจุบัน
        const now = new Date();
        const thailandTimeString = now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' });
        const thailandTime = new Date(thailandTimeString);
        const todayDateString = thailandTime.toISOString().split('T')[0];

        console.log(`📅 Today (Thailand): ${todayDateString}`);
        console.log(`📅 Default advance notice days: ${defaultAdvanceDays}`);

        // 3. หาบิลที่วันนี้ = due_date - advanceDays (ยังไม่ชำระ)
        console.log('🔍 Fetching data with pagination...');
        
        // ⭐ Helper function สำหรับดึงข้อมูลแบบ pagination (รองรับมากกว่า 10,000 รายการ)
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
                console.log(`📊 Fetched ${allData.length} records...`);
            }
            return allData;
        }

        // ⭐ ดึงข้อมูลทั้งหมดแบบ parallel และ pagination
        const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : null;
        const [payments, allTenants, allRooms] = await Promise.all([
            fetchAllWithPagination(base44.asServiceRole.entities.Payment, paymentFilter),
            fetchAllWithPagination(base44.asServiceRole.entities.Tenant),
            fetchAllWithPagination(base44.asServiceRole.entities.Room)
        ]);
        
        // สร้าง Map สำหรับ lookup เร็วขึ้น O(1)
        const tenantMap = new Map(allTenants.map(t => [t.id, t]));
        const roomMap = new Map(allRooms.map(r => [r.id, r]));
        
        console.log(`📦 Loaded ${payments.length} payments, ${allTenants.length} tenants, ${allRooms.length} rooms`);

        let upcomingPayments = payments.filter(p => {
            if (p.status === 'paid') return false;
            if (!p.due_date) return false;
            
            // ⭐ ถ้าส่งแจ้งเตือนล่วงหน้าไปแล้ว ไม่ต้องส่งซ้ำ
            if (p.advance_reminder_sent_date) {
                console.log(`⏭️ Skipping payment ${p.id} - already sent advance reminder`);
                return false;
            }
            
            // ⭐ ดึง advanceDays เฉพาะสาขาของบิลนี้
            const paymentBranchId = p.branch_id;
            const branchAdvanceDays = parseInt(getConfigValue('bill_advance_notice_days', '3', paymentBranchId));
            
            // คำนวณวันที่ควรแจ้งเตือน = due_date - advanceDays
            const dueDate = new Date(p.due_date);
            const notifyDate = new Date(dueDate);
            notifyDate.setDate(dueDate.getDate() - branchAdvanceDays);
            const notifyDateString = notifyDate.toISOString().split('T')[0];
            
            // ตรวจสอบว่าวันนี้ = วันที่ควรแจ้งเตือนหรือไม่
            const shouldNotifyToday = notifyDateString === todayDateString;
            
            // ถ้าระบุ branch_id ให้กรองตาม branch
            if (targetBranchId && p.branch_id !== targetBranchId) return false;
            
            return shouldNotifyToday;
        });

        const totalUpcomingPayments = upcomingPayments.length; // เก็บจำนวนทั้งหมดไว้ก่อน
        console.log(`📊 Found ${totalUpcomingPayments} payments due soon ${targetBranchId ? `in branch ${targetBranchId}` : 'in all branches'}`);

        if (totalUpcomingPayments === 0) {
            return Response.json({
                success: true,
                message: targetBranchId 
                    ? `ไม่มีบิลที่จะครบกำหนดเร็วๆ นี้ (สาขา: ${targetBranchId})` 
                    : `ไม่มีบิลที่จะครบกำหนดเร็วๆ นี้`,
                sent: 0,
                total: 0,
                remaining: 0,
                hasMore: false,
                targetBranchId: targetBranchId || 'all'
            });
        }

        // 4. เตรียมข้อความสำหรับแต่ละบิล (grouped by branch)
        const recipients = [];

        // ⭐ กรองเฉพาะบิลจากสาขาที่เปิดการแจ้งเตือน
        const paymentsFromEnabledBranches = upcomingPayments.filter(p => enabledBranches.includes(p.branch_id));
        const skippedCount = upcomingPayments.length - paymentsFromEnabledBranches.length;
        
        // ⭐ จำกัดจำนวนบิลที่จะประมวลผลในรอบนี้
        const paymentsToProcess = paymentsFromEnabledBranches.slice(0, limit);
        const totalRemaining = paymentsFromEnabledBranches.length - paymentsToProcess.length;
        
        console.log(`📋 Payments from enabled branches: ${paymentsFromEnabledBranches.length}`);
        console.log(`📋 Processing this round: ${paymentsToProcess.length}`);
        console.log(`📋 Remaining for next round: ${totalRemaining}`);
        console.log(`⏭️ Skipped payments (disabled branches): ${skippedCount}`);

        if (paymentsFromEnabledBranches.length === 0 && upcomingPayments.length > 0) {
            return Response.json({
                success: true,
                message: `มีบิลที่ครบกำหนด ${upcomingPayments.length} รายการ แต่สาขาเหล่านั้นปิดการแจ้งเตือนล่วงหน้า`,
                sent: 0,
                total: 0,
                remaining: 0,
                hasMore: false,
                totalPaymentsDue: upcomingPayments.length,
                skippedDueToDisabled: skippedCount,
                enabledBranches: enabledBranches
            });
        }

        // ⭐ ตัวแปรนับจำนวน Payment ที่ถูกข้ามเพราะยังไม่มีรูป
        let skippedNoImage = 0;

        for (const payment of paymentsToProcess) {
            try {
                const paymentBranchId = payment.branch_id;

                // ⭐ ใช้ Map lookup แทนการเรียก API ทีละตัว (O(1) แทน O(n))
                const tenant = tenantMap.get(payment.tenant_id);
                const room = roomMap.get(payment.room_id);

                if (!tenant || !tenant.line_user_id) {
                    console.log(`⚠️ No LINE User ID for payment ${payment.id}`);
                    continue;
                }

                // ⭐ ตรวจสอบว่ามีรูปใบแจ้งหนี้และ hash ตรงกันหรือไม่
                const invoiceImageUrl = payment.invoice_image_url || null;
                const currentHash = generatePaymentHash(payment);
                const savedHash = payment.invoice_data_hash || '';

                // ถ้าไม่มีรูปหรือ hash ไม่ตรง = ข้อมูลไม่ครบ → ข้ามไป
                if (!invoiceImageUrl || (savedHash && currentHash !== savedHash)) {
                    console.log(`⏭️ Skipping payment ${payment.id}: No invoice image or hash mismatch (has_image=${!!invoiceImageUrl}, hash_match=${currentHash === savedHash})`);
                    skippedNoImage++;
                    continue;
                }

                // ⭐ ดึง config เฉพาะสาขาของบิลนี้
                const branchBankName = getConfigValue('bank_name', 'กสิกร', paymentBranchId);
                const branchBankAccountNumber = getConfigValue('bank_account_number', '0722835522', paymentBranchId);
                const branchBankAccountName = getConfigValue('bank_account_name', 'ธนานนท์ พรมพักตร์', paymentBranchId);
                const branchBuildingName = getConfigValue('building_name', 'W RESIDENTS', paymentBranchId);
                const branchAdvanceDays = parseInt(getConfigValue('bill_advance_notice_days', '3', paymentBranchId));

                console.log(`📋 Branch ${paymentBranchId}: bank=${branchBankName}, acc=${branchBankAccountNumber}, name=${branchBankAccountName}`);

                // สร้างข้อความเตือนล่วงหน้า (เหมือน sendPaymentReminder template 'advance')
                const dueDateStr = new Date(payment.due_date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
                const roomNum = room?.room_number || 'N/A';

                let message = `📢 ${branchBuildingName} - แจ้งเตือนค่าเช่า\n\n`;
                message += `สวัสดีคุณ ${tenant.full_name}\n`;
                message += `ห้อง ${roomNum}\n\n`;
                message += `รายละเอียดค่าใช้จ่าย:\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n`;

                if (payment.rent_amount > 0) {
                    message += `ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
                }
                if (payment.electricity_amount > 0) {
                    message += `⚡ ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
                }
                if (payment.water_amount > 0) {
                    message += `💧 ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
                }
                if (payment.internet_amount > 0) {
                    message += `ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
                }
                if (payment.common_fee_amount > 0) {
                    message += `ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
                }
                if (payment.parking_fee_amount > 0) {
                    message += `ค่าที่จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บาท\n`;
                }
                if (payment.other_amount > 0) {
                    message += `ค่าใช้จ่ายอื่นๆ: ${payment.other_amount.toLocaleString()} บาท\n`;
                }

                message += `━━━━━━━━━━━━━━━━━━━━\n`;
                message += `💰 รวมทั้งสิ้น: ${payment.total_amount.toLocaleString()} บาท\n`;
                message += `(${numberToThaiText(payment.total_amount)})\n\n`;
                message += `📅 ครบกำหนดชำระ: ${dueDateStr}\n`;
                message += `สถานะ: รอชำระ\n\n`;
                message += `💳 โอนเงินได้ที่: ${branchBankName} ${branchBankAccountNumber} (${branchBankAccountName})\n\n`;
                message += `📄 ดูใบแจ้งหนี้: ${invoiceImageUrl}\n\n`;
                message += `📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\n`;
                message += `ขอบคุณค่ะ 🙏`;

                recipients.push({
                    lineUserId: tenant.line_user_id,
                    message: message,
                    metadata: {
                        paymentId: payment.id,
                        tenantId: tenant.id,
                        roomNumber: room?.room_number,
                        branchId: paymentBranchId
                    }
                });

            } catch (error) {
                console.error(`❌ Error processing payment ${payment.id}:`, error);
            }
        }

        // ⭐ อัปเดต advance_reminder_sent_date แบบ bulk
        const now = new Date().toISOString();
        const paymentIdsToUpdate = recipients.map(r => r.metadata.paymentId);
        
        const updateBatchSize = 50;
        for (let i = 0; i < paymentIdsToUpdate.length; i += updateBatchSize) {
            const batch = paymentIdsToUpdate.slice(i, i + updateBatchSize);
            await Promise.all(
                batch.map(id => 
                    base44.asServiceRole.entities.Payment.update(id, { advance_reminder_sent_date: now })
                        .catch(err => console.warn(`⚠️ Failed to update ${id}:`, err.message))
                )
            );
            console.log(`✅ Updated advance_reminder_sent_date: ${Math.min(i + updateBatchSize, paymentIdsToUpdate.length)}/${paymentIdsToUpdate.length}`);
        }

        // 5. ส่งข้อความ (ใช้ test mode ถ้ามี testLineUserId)
        let sentCount = 0;
        let sendErrors = [];

        if (recipients.length > 0) {
            // ⭐ TEST MODE: ถ้ามี test_line_user_id ให้ส่งไปหาคนเดียวแทน
            if (testLineUserId) {
                console.log(`🧪 TEST MODE: Sending sample to ${testLineUserId}`);
                
                // เลือกบิลตัวอย่างตัวแรก
                const sampleRecipient = recipients[0];
                
                try {
                    const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                        recipients: [{
                            lineUserId: testLineUserId,
                            message: sampleRecipient.message,
                            metadata: { ...sampleRecipient.metadata, testMode: true }
                        }],
                        options: {
                            batchSize: 1,
                            retryAttempts: 2
                        }
                    });

                    const result = batchResult.data;
                    sentCount = result.success;

                    if (result.success > 0) {
                        console.log(`✅ Test message sent successfully`);
                    }
                } catch (error) {
                    console.error('❌ Error sending test message:', error);
                    sendErrors.push(`Test mode error: ${error.message}`);
                }
            } else {
                // ⭐ ส่งจริง - แบ่งเป็น chunks เพื่อป้องกัน timeout
                console.log(`📤 Sending ${recipients.length} advance reminders in chunks...`);
                
                const CHUNK_SIZE = 50; // ส่งทีละ 50 เพื่อป้องกัน timeout
                const chunks = [];
                for (let i = 0; i < recipients.length; i += CHUNK_SIZE) {
                    chunks.push(recipients.slice(i, i + CHUNK_SIZE));
                }

                console.log(`📦 Split into ${chunks.length} chunks of max ${CHUNK_SIZE} each`);

                for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
                    const chunk = chunks[chunkIdx];
                    console.log(`📤 Sending chunk ${chunkIdx + 1}/${chunks.length} (${chunk.length} messages)`);

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
                    
                        if (result.errors && result.errors.length > 0) {
                            result.errors.slice(0, 5).forEach(err => {
                                const meta = err.metadata;
                                sendErrors.push(`ห้อง ${meta?.roomNumber || 'N/A'}: ${err.error}`);
                            });
                        }

                        console.log(`✅ Chunk ${chunkIdx + 1}: sent ${result.success || 0}/${chunk.length}`);

                    } catch (error) {
                        console.error(`❌ Chunk ${chunkIdx + 1} error:`, error.message);
                        sendErrors.push(`Chunk ${chunkIdx + 1} error: ${error.message}`);
                    }

                    // หน่วงเวลาระหว่าง chunk เพื่อไม่ให้ overload
                    if (chunkIdx < chunks.length - 1) {
                        console.log(`⏳ Waiting 1s before next chunk...`);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                console.log(`📊 Advance reminders: ${sentCount}/${recipients.length} sent successfully`);
            }
        }

        const executionTime = Date.now() - startTime;

        // สร้างผลลัพธ์แยกตามสาขา
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
            // พยายามดึง branch_id จาก error message
            const match = err.match(/branch[_\s]?id[:\s]+([a-f0-9]+)/i);
            if (match && match[1]) {
                const branchId = match[1];
                if (!branchStats[branchId]) {
                    branchStats[branchId] = { sent: 0, failed: 0 };
                }
                branchStats[branchId].failed++;
            }
        });

        // แปลง branchStats เป็น array
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

        const responseResult = {
            success: true,
            message: testLineUserId 
                ? `🧪 ส่งข้อความทดสอบสำเร็จ (Test Mode)` 
                : `ส่งการแจ้งเตือนล่วงหน้าสำเร็จ ${sentCount}/${recipients.length} รายการ${targetBranchId ? ` (สาขา: ${targetBranchId})` : ' (ทุกสาขา)'}${totalRemaining > 0 ? ` | เหลืออีก ${totalRemaining} บิล` : ''}${skippedNoImage > 0 ? ` | ข้าม ${skippedNoImage} บิล (ยังไม่มีรูป)` : ''}`,
            sent: sentCount,
            total: testLineUserId ? 1 : recipients.length,
            remaining: totalRemaining,
            hasMore: totalRemaining > 0,
            limit: limit,
            targetBranchId: targetBranchId || 'all',
            testMode: !!testLineUserId,
            enabledBranches: enabledBranches,
            skippedDueToDisabled: skippedCount || 0,
            skippedNoImage: skippedNoImage,
            errors: sendErrors.length > 0 ? sendErrors : undefined,
            thailandTime: thailandTime.toLocaleString('th-TH')
        };

        console.log('🎉 Advance reminder completed:', responseResult);

        // บันทึก FunctionLog พร้อม execution_time และ branch_results
        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendAdvanceReminders',
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
        console.error('❌ Error in sendAdvanceReminders:', error);
        console.error('📍 Error stack:', error.stack);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack,
            details: String(error)
        }, { status: 500 });
    }
});