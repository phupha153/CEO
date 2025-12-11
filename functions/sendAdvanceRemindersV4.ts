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

        console.log('\n📦 DATA LOADED:');
        console.log('   Total Payments:', allPayments.length);
        console.log('   Total Tenants:', allTenants.length);
        console.log('   Total Rooms:', allRooms.length);

        // ⭐⭐⭐ SINGLE FILTER - เช็คทุกอย่างพร้อมกัน
        console.log('\n🔍 STARTING SINGLE FILTER PASS...\n');
        console.log('════════════════════════════════════════════════════');
        console.log('Checking each payment for:');
        console.log('  ✓ Not paid');
        console.log('  ✓ Has due_date');
        console.log('  ✓ Not sent yet (advance_reminder_sent_date)');
        console.log('  ✓ Branch enabled');
        console.log('  ✓ Due date matches notify date (today)');
        console.log('  ✓ Has invoice_image_url');
        console.log('  ✓ Hash matches (if exists)');
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
        
        console.log('📊 FILTER RESULTS:');
        console.log('════════════════════════════════════════════════════');
        console.log('   Total Payments:', debugCounts.total);
        console.log('   ❌ Paid:', debugCounts.paid);
        console.log('   ❌ No Due Date:', debugCounts.noDueDate);
        console.log('   ❌ Already Sent:', debugCounts.alreadySent);
        console.log('   ❌ Branch Disabled:', debugCounts.branchDisabled);
        console.log('   ❌ Wrong Date:', debugCounts.wrongDate);
        console.log('   ❌ No Image:', debugCounts.noImage);
        console.log('   ❌ Hash Mismatch:', debugCounts.hashMismatch);
        console.log('   ✅ READY TO SEND:', debugCounts.passed);
        console.log('════════════════════════════════════════════════════\n');

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

            const totalThai = numberToThaiText(payment.total_amount);

            let message = `🔔 แจ้งเตือนล่วงหน้า\n\n`;
            message += `${branchBuildingName}\n`;
            message += `คุณ ${tenant.full_name} ห้อง ${room?.room_number || 'N/A'}\n`;
            message += `💰 ยอดเงิน: ${payment.total_amount.toLocaleString()} บาท\n`;
            message += `(${totalThai})\n`;
            message += `📅 ครบกำหนด: ${new Date(payment.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}\n\n`;
            message += `กรุณาเตรียมชำระค่ะ\n\n`;
            message += `💳 โอนเงินได้ที่:\n${branchBankName} ${branchBankAccountNumber}\nชื่อบัญชี: ${branchBankAccountName}\n\n`;
            message += `ส่งหลักฐานการโอนหลังชำระเงินค่ะ 🙏`;

            recipients.push({
                lineUserId: tenant.line_user_id || null,
                facebookUserId: tenant.facebook_user_id || null,
                imageUrl: payment.invoice_image_url,
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

        // Update advance_reminder_sent_date
        const now_iso = new Date().toISOString();
        const updateBatchSize = 50;
        const paymentIdsToUpdate = recipients.map(r => r.metadata.paymentId);
        
        for (let i = 0; i < paymentIdsToUpdate.length; i += updateBatchSize) {
            const batch = paymentIdsToUpdate.slice(i, i + updateBatchSize);
            await Promise.all(
                batch.map(id => 
                    base44.asServiceRole.entities.Payment.update(id, { advance_reminder_sent_date: now_iso })
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
        console.log('🎉 COMPLETED');
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