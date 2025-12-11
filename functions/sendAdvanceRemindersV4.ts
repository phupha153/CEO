import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ⭐⭐⭐ VERSION: V4-FINAL - Filter ครั้งเดียวทุกอย่าง ⭐⭐⭐

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
    const VERSION = '🔥 V4-FINAL 🔥';
    
    console.log('\n\n');
    console.log('████████████████████████████████████████████████████');
    console.log('█  🚀 ADVANCE REMINDER ' + VERSION);
    console.log('████████████████████████████████████████████████████');
    console.log('⏰ START:', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
    console.log('════════════════════════════════════════════════════\n');
    
    try {
        const base44 = createClientFromRequest(req);

        // Parse request
        let targetBranchId = null;
        let testLineUserId = null;
        let limit = 30;
        try {
            const text = await req.text();
            if (text) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
                testLineUserId = body.test_line_user_id || null;
                limit = body.limit || 30;
            }
        } catch (parseError) {}

        console.log('📋 Target Branch:', targetBranchId || 'ALL');
        console.log('📋 Test Mode:', testLineUserId ? 'YES' : 'NO');
        console.log('📋 Limit:', limit);

        // Load configs
        const configs = await base44.asServiceRole.entities.Config.list();
        
        const getConfigValue = (key, defaultValue, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        const branchReminderConfigs = configs.filter(c => c.key === 'send_advance_reminder');
        const enabledBranches = branchReminderConfigs.filter(c => c.value === 'true').map(c => c.branch_id);

        console.log('\n📊 ENABLED BRANCHES:', enabledBranches.length, '/', branchReminderConfigs.length);

        if (enabledBranches.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีสาขาเปิดการแจ้งเตือนล่วงหน้า',
                sent: 0
            });
        }

        // Calculate today
        const now = new Date();
        const thailandTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
        const todayDateString = thailandTime.toISOString().split('T')[0];
        console.log('📅 TODAY:', todayDateString);

        // Fetch data
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

        console.log('\n📥 FETCHING DATA...');

        const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : null;
        const [allPayments, allTenants, allRooms, branchesData] = await Promise.all([
            fetchAll(base44.asServiceRole.entities.Payment, paymentFilter),
            fetchAll(base44.asServiceRole.entities.Tenant),
            fetchAll(base44.asServiceRole.entities.Room),
            base44.asServiceRole.entities.Branch.list()
        ]);

        const tenantMap = new Map(allTenants.map(t => [t.id, t]));
        const roomMap = new Map(allRooms.map(r => [r.id, r]));
        const branchMap = new Map(branchesData.map(b => [b.id, b.branch_name]));

        console.log('\n📦 โหลดข้อมูลแล้ว:');
        console.log('   จำนวน Payment ทั้งหมด:', allPayments.length);
        console.log('   จำนวน Tenant ทั้งหมด:', allTenants.length);
        console.log('   จำนวน Room ทั้งหมด:', allRooms.length);

        // ⭐⭐⭐ สรุปบิลทั้งหมดก่อนกรอง
        console.log('\n📊 สรุปบิลทั้งหมดก่อนเริ่มกรอง:');
        console.log('════════════════════════════════════════════════════');
        console.log(`   📦 จำนวนบิลทั้งหมด: ${allPayments.length} บิล`);
        
        // แยกตามสาขา
        const billsByBranch = {};
        allPayments.forEach(p => {
            const bid = p.branch_id;
            if (!billsByBranch[bid]) billsByBranch[bid] = 0;
            billsByBranch[bid]++;
        });
        
        console.log(`   🏢 จำนวนสาขา: ${Object.keys(billsByBranch).length} สาขา`);
        Object.entries(billsByBranch).forEach(([bid, count]) => {
            const bName = branchMap.get(bid) || bid.substring(0, 8);
            console.log(`      - ${bName}: ${count} บิล`);
        });
        
        // แยกตาม status
        const paidCount = allPayments.filter(p => p.status === 'paid').length;
        const pendingCount = allPayments.filter(p => p.status === 'pending' || p.status === 'overdue').length;
        console.log(`   📊 สถานะบิล: ชำระแล้ว ${paidCount}, รอชำระ ${pendingCount}`);
        
        // มีรูปใบแจ้งหนี้กี่ใบ
        const withImageCount = allPayments.filter(p => p.invoice_image_url).length;
        const noImageCount = allPayments.filter(p => !p.invoice_image_url).length;
        console.log(`   🖼️ รูปใบแจ้งหนี้: มีรูป ${withImageCount}, ไม่มีรูป ${noImageCount}`);
        console.log('════════════════════════════════════════════════════\n');

        // ⭐⭐⭐ กรองข้อมูลครั้งเดียว
        console.log('🔍 เริ่มกรองข้อมูล...\n');
        console.log('════════════════════════════════════════════════════');
        console.log('เงื่อนไขในการกรอง:');
        console.log('  ✓ ยังไม่ได้ชำระเงิน');
        console.log('  ✓ มีวันครบกำหนด');
        console.log('  ✓ ยังไม่ได้ส่งแจ้งเตือนล่วงหน้า');
        console.log('  ✓ สาขาเปิดใช้งานการแจ้งเตือน');
        console.log('  ✓ วันแจ้งเตือนตรงกับวันนี้');
        console.log('  ✓ มีรูปใบแจ้งหนี้');
        console.log('  ✓ Hash ตรงกัน (ถ้ามี)');
        console.log('════════════════════════════════════════════════════\n');
        
        const debugCounts = {
            total: allPayments.length,
            paid: 0,
            noDueDate: 0,
            alreadySent: 0,
            branchDisabled: 0,
            wrongDate: 0,
            noImage: 0,
            hashMismatch: 0,
            passed: 0
        };

        const paymentsWithoutImage = [];

        let readyToSend = allPayments.filter(p => {
            // 1. Status check
            if (p.status === 'paid') {
                debugCounts.paid++;
                return false;
            }
            
            // 2. Due date check
            if (!p.due_date) {
                debugCounts.noDueDate++;
                return false;
            }
            
            // 3. Already sent check
            if (p.advance_reminder_sent_date) {
                debugCounts.alreadySent++;
                return false;
            }
            
            // 4. Branch filter
            if (targetBranchId && p.branch_id !== targetBranchId) return false;
            
            // 5. Branch enabled check
            if (!enabledBranches.includes(p.branch_id)) {
                debugCounts.branchDisabled++;
                return false;
            }
            
            // 6. Date calculation
            const branchAdvanceDays = parseInt(getConfigValue('bill_advance_notice_days', '3', p.branch_id));
            const dueDate = new Date(p.due_date);
            const notifyDate = new Date(dueDate);
            notifyDate.setDate(dueDate.getDate() - branchAdvanceDays);
            const notifyDateString = notifyDate.toISOString().split('T')[0];
            
            if (notifyDateString !== todayDateString) {
                debugCounts.wrongDate++;
                return false;
            }
            
            // 7. Image check
            if (!p.invoice_image_url) {
                debugCounts.noImage++;
                const room = roomMap.get(p.room_id);
                const tenant = tenantMap.get(p.tenant_id);
                paymentsWithoutImage.push({
                    id: p.id,
                    room: room?.room_number || 'N/A',
                    tenant: tenant?.full_name || 'N/A',
                    due_date: p.due_date,
                    total: p.total_amount,
                    branch_id: p.branch_id
                });
                return false;
            }
            
            // 8. Hash check (if exists)
            if (p.invoice_data_hash) {
                const currentHash = generatePaymentHash(p);
                if (currentHash !== p.invoice_data_hash) {
                    debugCounts.hashMismatch++;
                    return false;
                }
            }
            
            debugCounts.passed++;
            return true;
        });
        
        console.log('📊 สรุปผลการกรอง:');
        console.log('════════════════════════════════════════════════════');
        console.log('   จำนวน Payment ทั้งหมด:', debugCounts.total);
        console.log('   ❌ ชำระแล้ว:', debugCounts.paid, 'รายการ');
        console.log('   ❌ ไม่มีวันครบกำหนด:', debugCounts.noDueDate, 'รายการ');
        console.log('   ❌ ส่งแจ้งเตือนแล้ว:', debugCounts.alreadySent, 'รายการ');
        console.log('   ❌ สาขาปิดการแจ้งเตือน:', debugCounts.branchDisabled, 'รายการ');
        console.log('   ❌ วันแจ้งเตือนไม่ตรง:', debugCounts.wrongDate, 'รายการ');
        console.log('   ❌ ไม่มีรูปใบแจ้งหนี้:', debugCounts.noImage, 'รายการ');
        console.log('   ❌ Hash ไม่ตรงกัน:', debugCounts.hashMismatch, 'รายการ');
        console.log('   ✅ พร้อมส่ง:', debugCounts.passed, 'รายการ');
        console.log('════════════════════════════════════════════════════\n');

        // แสดงรายละเอียด Payment ที่ไม่มีรูป
        if (paymentsWithoutImage.length > 0) {
            console.log('⚠️ รายละเอียด Payment ที่ไม่มีรูปใบแจ้งหนี้:');
            console.log('════════════════════════════════════════════════════');
            paymentsWithoutImage.slice(0, 10).forEach((p, idx) => {
                const branchName = branchMap.get(p.branch_id) || p.branch_id;
                console.log(`   ${idx + 1}. ห้อง ${p.room} | ${p.tenant} | ${branchName}`);
                console.log(`      ครบกำหนด: ${p.due_date} | จำนวน: ${p.total?.toLocaleString()} บาท`);
            });
            if (paymentsWithoutImage.length > 10) {
                console.log(`   ... และอีก ${paymentsWithoutImage.length - 10} รายการ`);
            }
            console.log('════════════════════════════════════════════════════\n');
        }

        if (readyToSend.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีบิลที่ต้องส่งแจ้งเตือนล่วงหน้าวันนี้',
                sent: 0,
                total: 0,
                debug: debugCounts
            });
        }

        // จำกัดจำนวน
        const paymentsToProcess = readyToSend.slice(0, limit);
        console.log(`📋 Processing: ${paymentsToProcess.length}/${readyToSend.length}\n`);

        // สร้างข้อความ
        const recipients = [];

        for (const payment of paymentsToProcess) {
            const tenant = tenantMap.get(payment.tenant_id);
            const room = roomMap.get(payment.room_id);

            if (!tenant || (!tenant.line_user_id && !tenant.facebook_user_id)) continue;

            const branchBankName = getConfigValue('bank_name', 'กสิกร', payment.branch_id);
            const branchBankAccountNumber = getConfigValue('bank_account_number', '0722835522', payment.branch_id);
            const branchBankAccountName = getConfigValue('bank_account_name', 'ธนานนท์ พรมพักตร์', payment.branch_id);
            const branchBuildingName = getConfigValue('building_name', 'W RESIDENTS', payment.branch_id);

            // สร้างข้อความรูปแบบเดียวกับ sendPaymentReminder (template normal)
            let message = `📢 ${branchBuildingName} - แจ้งเตือนค่าเช่า\n\n`;
            message += `สวัสดีคุณ ${tenant.full_name}\n`;
            message += `ห้อง ${room?.room_number || 'N/A'}\n\n`;
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
            message += `📅 ครบกำหนดชำระ: ${new Date(payment.due_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
            message += `สถานะ: รอชำระ\n\n`;
            message += `💳 โอนเงินได้ที่: ${branchBankName} ${branchBankAccountNumber} (${branchBankAccountName})\n\n`;

            // เพิ่มลิงก์ใบแจ้งหนี้ (รูปภาพ)
            const invoiceImageUrl = payment.invoice_image_url;
            if (invoiceImageUrl) {
                message += `\n\n📄 ดูใบแจ้งหนี้: ${invoiceImageUrl}`;
            }
            
            message += `\n\n📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\n`;
            message += `ขอบคุณค่ะ 🙏`;

            recipients.push({
                lineUserId: tenant.line_user_id || null,
                facebookUserId: tenant.facebook_user_id || null,
                imageUrl: invoiceImageUrl,
                message: message,
                metadata: {
                    paymentId: payment.id,
                    tenantId: tenant.id,
                    tenantName: tenant.full_name,
                    roomNumber: room?.room_number,
                    branchId: payment.branch_id,
                    channel: tenant.line_user_id ? 'line' : 'facebook'
                }
            });
        }

        console.log(`📤 Prepared ${recipients.length} recipients\n`);

        // Update advance_reminder_sent_date และ bill_sent_date
        const now_iso = new Date().toISOString();
        const updateBatchSize = 50;
        const paymentIdsToUpdate = recipients.map(r => r.metadata.paymentId);
        
        for (let i = 0; i < paymentIdsToUpdate.length; i += updateBatchSize) {
            const batch = paymentIdsToUpdate.slice(i, i + updateBatchSize);
            await Promise.all(
                batch.map(id => 
                    base44.asServiceRole.entities.Payment.update(id, { 
                        advance_reminder_sent_date: now_iso,
                        bill_sent_date: now_iso
                    })
                        .catch(err => console.warn(`⚠️ Failed to update ${id}:`, err.message))
                )
            );
        }

        // Send messages
        let sentCount = 0;
        let sendErrors = [];

        const lineRecipients = recipients.filter(r => r.lineUserId);
        const facebookRecipients = recipients.filter(r => r.facebookUserId);

        console.log(`📊 Recipients: ${lineRecipients.length} LINE, ${facebookRecipients.length} Facebook\n`);

        if (recipients.length > 0) {
            if (testLineUserId) {
                console.log(`🧪 TEST MODE - Sending to ${testLineUserId}\n`);
                const sample = recipients[0];
                
                try {
                    const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                        recipients: [{
                            lineUserId: testLineUserId,
                            imageUrl: sample.imageUrl,
                            message: sample.message,
                            metadata: { ...sample.metadata, testMode: true }
                        }],
                        options: { batchSize: 1, retryAttempts: 2 }
                    });

                    sentCount = batchResult.data.success || 0;
                    console.log(`✅ Test sent: ${sentCount}\n`);
                } catch (error) {
                    console.error('❌ Test error:', error.message);
                    sendErrors.push(`Test: ${error.message}`);
                }
            } else {
                // Send LINE
                if (lineRecipients.length > 0) {
                    console.log(`📤 Sending ${lineRecipients.length} LINE messages...\n`);
                    
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
                        
                            if (result.errors && result.errors.length > 0) {
                                result.errors.slice(0, 5).forEach(err => {
                                    sendErrors.push(`ห้อง ${err.metadata?.roomNumber || 'N/A'}: ${err.error}`);
                                });
                            }

                            console.log(`✅ Chunk ${chunkIdx + 1}: sent ${result.success || 0}/${chunk.length}\n`);

                        } catch (error) {
                            console.error(`❌ Chunk ${chunkIdx + 1} error:`, error.message);
                            sendErrors.push(`Chunk ${chunkIdx + 1}: ${error.message}`);
                        }

                        if (chunkIdx < chunks.length - 1) {
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                }

                // Send Facebook
                if (facebookRecipients.length > 0) {
                    console.log(`\n📤 Sending ${facebookRecipients.length} Facebook messages...\n`);

                    for (const recipient of facebookRecipients) {
                        try {
                            await base44.asServiceRole.functions.invoke('sendFacebookMessage', {
                                to: recipient.facebookUserId,
                                message: recipient.message,
                                imageUrl: recipient.imageUrl,
                                branch_id: recipient.metadata.branchId
                            });
                            sentCount++;
                            console.log(`✅ Facebook → ${recipient.metadata.tenantName}`);
                        } catch (error) {
                            console.error(`❌ Facebook error:`, error.message);
                            sendErrors.push(`Facebook ห้อง ${recipient.metadata.roomNumber}: ${error.message}`);
                        }
                    }
                }
            }
        }

        const totalRemaining = readyToSend.length - paymentsToProcess.length;

        const result = {
            success: true,
            message: testLineUserId 
                ? `🧪 ส่งทดสอบสำเร็จ`
                : `ส่งแจ้งเตือนล่วงหน้าสำเร็จ ${sentCount}/${recipients.length}${totalRemaining > 0 ? ` | เหลืออีก ${totalRemaining}` : ''}`,
            sent: sentCount,
            total: recipients.length,
            remaining: totalRemaining,
            hasMore: totalRemaining > 0,
            testMode: !!testLineUserId,
            debug: debugCounts,
            errors: sendErrors.length > 0 ? sendErrors : undefined
        };

        console.log('\n════════════════════════════════════════════════════');
        console.log('🎉 เสร็จสิ้น');
        console.log('════════════════════════════════════════════════════');
        console.log(`เวลาที่ใช้: ${Date.now() - performance.now()} ms`);
        console.log('════════════════════════════════════════════════════\n');

        return Response.json(result);

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        console.error('Stack:', error.stack);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});