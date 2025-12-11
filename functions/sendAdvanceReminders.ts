import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Version: 2025-12-11-v3-MINIMAL - เหลือแต่ log สำคัญ
// Last updated: 2025-12-11 15:30 Thailand Time

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
    const VERSION = 'v3-MINIMAL';
    
    console.log('\n\n');
    console.log('████████████████████████████████████████████████████');
    console.log('█  🚀 ADVANCE REMINDER ' + VERSION + '           █');
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

        console.log('📊 Enabled branches:', enabledBranches.length, '/', branchReminderConfigs.length);

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
        console.log('📅 Today:', todayDateString);

        // Fetch data (silent pagination)
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

        // ⭐⭐⭐ ดึง Payment 2 รอบ: รอบ 1 = มีรูป (สำคัญสุด), รอบ 2 = ไม่มีรูป
        console.log('\n📥 FETCHING PAYMENTS (2 rounds)...');

        const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : null;

        // รอบ 1: ดึง Payment ที่มีรูป (invoice_image_url != null)
        const paymentsWithImage = await fetchAll(base44.asServiceRole.entities.Payment, paymentFilter);
        const paymentsHasImage = paymentsWithImage.filter(p => p.invoice_image_url);

        // รอบ 2: ดึง Payment ที่ไม่มีรูป (invoice_image_url = null) - จำกัดแค่ 1000 รายการ
        const paymentsNoImage = paymentsWithImage.filter(p => !p.invoice_image_url).slice(0, 1000);

        // รวมกัน - มีรูปมาก่อน
        const payments = [...paymentsHasImage, ...paymentsNoImage];

        const [allTenants, allRooms] = await Promise.all([
            fetchAll(base44.asServiceRole.entities.Tenant),
            fetchAll(base44.asServiceRole.entities.Room)
        ]);

        const tenantMap = new Map(allTenants.map(t => [t.id, t]));
        const roomMap = new Map(allRooms.map(r => [r.id, r]));

        console.log('\n📦 DATA LOADED:');
        console.log('   Payments (มีรูป):', paymentsHasImage.length);
        console.log('   Payments (ไม่มีรูป):', paymentsNoImage.length);
        console.log('   Payments (รวม):', payments.length);
        console.log('   Tenants:', allTenants.length);
        console.log('   Rooms:', allRooms.length);

        // Pre-load branch and room info
        const branchesData = await base44.asServiceRole.entities.Branch.list();
        const branchMap = new Map(branchesData.map(b => [b.id, b.branch_name]));

        // ⭐⭐⭐ วิเคราะห์บิลที่มีรูปทั้งหมด
        console.log('\n🔍 ANALYZING ALL PAYMENTS WITH IMAGES:');
        console.log(`   Total with image: ${paymentsHasImage.length}`);

        let matchTodayCount = 0;
        let alreadySentCount = 0;
        let wrongDateCount = 0;

        for (const p of paymentsHasImage) {
            if (!p.due_date) continue;

            const branchAdvanceDays = parseInt(getConfigValue('bill_advance_notice_days', '3', p.branch_id));
            const dueDate = new Date(p.due_date);
            const notifyDate = new Date(dueDate);
            notifyDate.setDate(dueDate.getDate() - branchAdvanceDays);
            const notifyDateString = notifyDate.toISOString().split('T')[0];

            const matchToday = notifyDateString === todayDateString;
            const alreadySent = !!p.advance_reminder_sent_date;

            if (matchToday && !alreadySent) {
                const tenant = tenantMap.get(p.tenant_id);
                const room = roomMap.get(p.room_id);
                const branchName = branchMap.get(p.branch_id) || 'Unknown';
                console.log(`✅ READY TO SEND: [${branchName}] ห้อง ${room?.room_number} - ${tenant?.full_name}`);
                matchTodayCount++;
            } else if (alreadySent) {
                alreadySentCount++;
            } else if (!matchToday) {
                wrongDateCount++;
            }
        }

        console.log(`\n📊 SUMMARY (บิลที่มีรูป ${paymentsHasImage.length} ใบ):`);
        console.log(`   ✅ ตรงวันนี้+ยังไม่ส่ง: ${matchTodayCount}`);
        console.log(`   ⏭️ ส่งไปแล้ว: ${alreadySentCount}`);
        console.log(`   📅 ไม่ตรงวันนี้: ${wrongDateCount}`)

        // Filter payments
        console.log('\n🔍 FILTERING (first 5 payments with details)...\n');
        
        let debugCount = 0;
        let upcomingPayments = payments.filter(p => {
            const shouldDebug = debugCount < 5;
            
            if (shouldDebug) {
                const tenant = tenantMap.get(p.tenant_id);
                const room = roomMap.get(p.room_id);
                const branchName = branchMap.get(p.branch_id) || 'Unknown';
                
                console.log(`━━━ [${branchName}] ห้อง ${room?.room_number || 'N/A'} - ${tenant?.full_name || 'ไม่ทราบชื่อ'} ━━━`);
                console.log('Status:', p.status, '| Due:', p.due_date || 'NONE', '| Image:', !!p.invoice_image_url ? 'YES' : 'NO');
                console.log('Already Sent:', p.advance_reminder_sent_date || 'NO');
                debugCount++;
            }
            
            if (p.status === 'paid') {
                if (shouldDebug) console.log('❌ SKIP: Paid\n');
                return false;
            }
            if (!p.due_date) {
                if (shouldDebug) console.log('❌ SKIP: No due_date\n');
                return false;
            }
            if (p.advance_reminder_sent_date) {
                if (shouldDebug) console.log('❌ SKIP: Already sent\n');
                return false;
            }
            
            const branchAdvanceDays = parseInt(getConfigValue('bill_advance_notice_days', '3', p.branch_id));
            const dueDate = new Date(p.due_date);
            const notifyDate = new Date(dueDate);
            notifyDate.setDate(dueDate.getDate() - branchAdvanceDays);
            const notifyDateString = notifyDate.toISOString().split('T')[0];
            
            const shouldNotifyToday = notifyDateString === todayDateString;
            
            if (shouldDebug) {
                console.log(`Notify on: ${notifyDateString} (${branchAdvanceDays} days before) | Today: ${todayDateString}`);
                console.log(shouldNotifyToday ? '✅ PASS!\n' : '❌ SKIP: Not today\n');
            }
            
            if (targetBranchId && p.branch_id !== targetBranchId) return false;
            
            return shouldNotifyToday;
        });
        
        console.log('════════════════════════════════════════════════════');
        console.log('📊 FILTER RESULT:');
        console.log('   Total Checked:', payments.length);
        console.log('   ✅ Passed:', upcomingPayments.length);
        console.log('   ❌ Filtered Out:', payments.length - upcomingPayments.length);
        console.log('════════════════════════════════════════════════════\n');

        if (upcomingPayments.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีบิลที่ต้องส่งแจ้งเตือนล่วงหน้าวันนี้',
                sent: 0,
                total: 0
            });
        }

        // ⭐⭐⭐ แยกประมวลผล: กลุ่มที่มีรูปก่อน แล้วค่อยกลุ่มที่ไม่มีรูป
        const paymentsFromEnabledBranches = upcomingPayments.filter(p => enabledBranches.includes(p.branch_id));

        // แยกเป็น 2 กลุ่ม
        const paymentsWithImage = paymentsFromEnabledBranches.filter(p => {
            const hasImage = !!p.invoice_image_url;
            const hashMatch = p.invoice_data_hash && generatePaymentHash(p) === p.invoice_data_hash;
            return hasImage && hashMatch;
        });

        const paymentsNoImage = paymentsFromEnabledBranches.filter(p => {
            const hasImage = !!p.invoice_image_url;
            const hashMatch = p.invoice_data_hash && generatePaymentHash(p) === p.invoice_data_hash;
            return !hasImage || !hashMatch;
        });

        // ประมวลผลที่มีรูปก่อน (ทั้งหมด) แล้วค่อยที่ไม่มีรูป (ตาม limit)
        const paymentsToProcess = [
            ...paymentsWithImage,
            ...paymentsNoImage.slice(0, Math.max(0, limit - paymentsWithImage.length))
        ];

        console.log(`📊 Enabled branches: ${paymentsFromEnabledBranches.length}`);
        console.log(`   มีรูป+hash ตรง: ${paymentsWithImage.length} (process ทั้งหมด)`);
        console.log(`   ไม่มีรูป/hash ผิด: ${paymentsNoImage.length} (process ${Math.min(paymentsNoImage.length, Math.max(0, limit - paymentsWithImage.length))})`);
        console.log(`📋 To Process: ${paymentsToProcess.length}`);

        const recipients = [];
        let skippedNoImage = 0;

        for (const payment of paymentsToProcess) {
            const tenant = tenantMap.get(payment.tenant_id);
            const room = roomMap.get(payment.room_id);
            const branchName = branchMap.get(payment.branch_id) || 'Unknown';

            if (!tenant) continue;

            const hasLine = !!tenant.line_user_id;
            const hasFacebook = !!tenant.facebook_user_id;

            if (!hasLine && !hasFacebook) continue;

            const invoiceImageUrl = payment.invoice_image_url || null;
            const currentHash = generatePaymentHash(payment);
            const savedHash = payment.invoice_data_hash || '';

            if (!invoiceImageUrl || (savedHash && currentHash !== savedHash)) {
                skippedNoImage++;
                continue;
            }

            const branchBankName = getConfigValue('bank_name', 'กสิกร', payment.branch_id);
            const branchBankAccountNumber = getConfigValue('bank_account_number', '0722835522', payment.branch_id);
            const branchBankAccountName = getConfigValue('bank_account_name', 'ธนานนท์ พรมพักตร์', payment.branch_id);
            const branchBuildingName = getConfigValue('building_name', 'W RESIDENTS', payment.branch_id);

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
                lineUserId: tenant.line_user_id || null,
                facebookUserId: tenant.facebook_user_id || null,
                message: message,
                metadata: {
                    paymentId: payment.id,
                    tenantId: tenant.id,
                    roomNumber: room?.room_number,
                    branchId: payment.branch_id,
                    tenantName: tenant.full_name
                }
            });
        }

        console.log('\n📤 RECIPIENTS:', recipients.length);
        console.log('   LINE:', recipients.filter(r => r.lineUserId).length);
        console.log('   Facebook:', recipients.filter(r => r.facebookUserId).length);
        console.log('   Skipped (no image):', skippedNoImage, '\n');

        if (recipients.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีผู้รับที่พร้อมส่ง (ตรวจสอบรูปใบแจ้งหนี้)',
                sent: 0,
                skippedNoImage
            });
        }

        // Update advance_reminder_sent_date
        const nowISO = new Date().toISOString();
        const paymentIds = recipients.map(r => r.metadata.paymentId);
        
        for (let i = 0; i < paymentIds.length; i += 50) {
            const batch = paymentIds.slice(i, i + 50);
            await Promise.all(
                batch.map(id => 
                    base44.asServiceRole.entities.Payment.update(id, { advance_reminder_sent_date: nowISO })
                        .catch(() => {})
                )
            );
        }

        // Send messages
        let sentCount = 0;
        let sendErrors = [];

        if (recipients.length > 0) {
            const lineRecipients = recipients.filter(r => r.lineUserId);
            const facebookRecipients = recipients.filter(r => r.facebookUserId);

            // TEST MODE
            if (testLineUserId) {
                console.log('🧪 TEST MODE - sending to:', testLineUserId);
                
                try {
                    const sampleRecipient = lineRecipients[0] || recipients[0];
                    const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                        recipients: [{
                            lineUserId: testLineUserId,
                            message: sampleRecipient.message,
                            metadata: { ...sampleRecipient.metadata, testMode: true }
                        }],
                        options: { batchSize: 1, retryAttempts: 2 }
                    });

                    sentCount = batchResult.data.success || 0;
                    console.log(sentCount > 0 ? '✅ Test sent' : '❌ Test failed');
                } catch (error) {
                    console.error('❌ Test error:', error.message);
                    sendErrors.push(error.message);
                }
            } else {
                // Send LINE
                if (lineRecipients.length > 0) {
                    const chunks = [];
                    for (let i = 0; i < lineRecipients.length; i += 50) {
                        chunks.push(lineRecipients.slice(i, i + 50));
                    }

                    for (const chunk of chunks) {
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

                            sentCount += batchResult.data.success || 0;
                        
                            if (batchResult.data.errors?.length > 0) {
                                batchResult.data.errors.slice(0, 3).forEach(err => {
                                    sendErrors.push(`ห้อง ${err.metadata?.roomNumber}: ${err.error}`);
                                });
                            }
                        } catch (error) {
                            console.error('❌ LINE chunk error:', error.message);
                            sendErrors.push(error.message);
                        }

                        await new Promise(r => setTimeout(r, 1000));
                    }
                }

                // Send Facebook
                if (facebookRecipients.length > 0) {
                    for (const recipient of facebookRecipients) {
                        try {
                            await base44.asServiceRole.functions.invoke('sendFacebookMessage', {
                                recipientId: recipient.facebookUserId,
                                message: recipient.message
                            });
                            sentCount++;
                        } catch (error) {
                            console.error(`❌ Facebook error (${recipient.metadata.roomNumber}):`, error.message);
                            sendErrors.push(`Facebook ${recipient.metadata.roomNumber}: ${error.message}`);
                        }
                        await new Promise(r => setTimeout(r, 500));
                    }
                }
            }
        }

        console.log('\n════════════════════════════════════════════════════');
        console.log('🎉 COMPLETED:');
        console.log('   Sent:', sentCount, '/', recipients.length);
        console.log('   Errors:', sendErrors.length);
        console.log('════════════════════════════════════════════════════\n');

        const responseResult = {
            success: true,
            message: `ส่งแจ้งเตือนล่วงหน้า ${sentCount}/${recipients.length} รายการ`,
            sent: sentCount,
            total: recipients.length,
            skippedNoImage,
            errors: sendErrors.length > 0 ? sendErrors.slice(0, 5) : undefined
        };

        // Log to database
        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendAdvanceReminders',
                run_timestamp: new Date().toISOString(),
                status: sendErrors.length > 0 && sentCount === 0 ? 'error' : 'success',
                message: responseResult.message,
                total_sent: sentCount,
                total_failed: sendErrors.length,
                triggered_by: 'cron',
                details: responseResult
            });
        } catch (logError) {}

        return Response.json(responseResult);

    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error.message);
        console.error('Stack:', error.stack);
        return Response.json({ 
            success: false,
            error: error.message
        }, { status: 500 });
    }
});