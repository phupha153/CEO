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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
    const VERSION = '🔥 V4-FIXED 🔥';
    const START_TIME = Date.now();
    const SAFETY_LIMIT_MS = 90 * 1000;
    
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

   // ------------------------------------------------------------------
        // ⭐ เริ่มส่วนที่แก้ไขใหม่ (V5 Logic: Loop ทีละสาขา)
        // ------------------------------------------------------------------
        
        // ประกาศตัวแปรเก็บผลลัพธ์
        let totalSent = 0;
        let processLog = [];
        
        // วนลูปทำทีละสาขา (ใช้ enabledBranches จากโค้ดส่วนบนของคุณ)
        for (const branchId of enabledBranches) {
            
            // 1. เช็คเวลา: ถ้าเกิน 1.30 นาที ให้หยุดทันที
            if (Date.now() - START_TIME > SAFETY_LIMIT_MS) {
                console.warn(`\n⚠️ เวลาหมด (1.30 นาที)! หยุดทำงานที่สาขา ID: ${branchId}`);
                break; 
            }

            console.log(`\n🔹 กำลังประมวลผลสาขา ID: ${branchId}`);

            // 2. คำนวณวันแจ้งเตือน
            const advanceDays = parseInt(getConfigValue('bill_advance_notice_days', '3', branchId));
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + advanceDays);
            const targetDateStr = targetDate.toISOString().split('T')[0];
            
            console.log(`   📅 หาวันครบกำหนด: ${targetDateStr}`);

            // 3. ดึงข้อมูลแบบเจาะจง (Targeted Query)
            // สาขานี้ + ยังไม่จ่าย + วันที่ตรงเป๊ะ
            const payments = await base44.asServiceRole.entities.Payment.filter({
                branch_id: branchId,
                status: { $ne: 'paid' },
                due_date: targetDateStr
            }, '-id', 100, 0); // Limit 100 ใบต่อสาขา

            if (payments.length === 0) {
                console.log('   ✨ ไม่มีบิลที่ต้องส่ง');
                continue;
            }

            // 4. ดึง Tenant/Room เฉพาะสาขานี้ (ไม่กิน RAM)
            const tenants = await base44.asServiceRole.entities.Tenant.filter({ branch_id: branchId }, '-id', 300, 0);
            const rooms = await base44.asServiceRole.entities.Room.filter({ branch_id: branchId }, '-id', 300, 0);
            
            const tenantMap = new Map(tenants.map(t => [t.id, t]));
            const roomMap = new Map(rooms.map(r => [r.id, r]));

            const recipients = [];
            
            // เตรียม Config ธนาคาร
            const branchBankName = getConfigValue('bank_name', 'กสิกร', branchId);
            const branchBankAccountNumber = getConfigValue('bank_account_number', '0722835522', branchId);
            const branchBankAccountName = getConfigValue('bank_account_name', 'ธนานนท์ พรมพักตร์', branchId);
            const branchBuildingName = getConfigValue('building_name', 'W RESIDENTS', branchId);

            // 5. สร้างข้อความ
            for (const payment of payments) {
                // กรองเบื้องต้น
                if (payment.advance_reminder_sent_date || payment.bill_sent_date) continue;
                if (!payment.invoice_image_url) continue;

                // เช็ค Hash
                if (payment.invoice_data_hash) {
                    const currentHash = generatePaymentHash(payment);
                    if (currentHash !== payment.invoice_data_hash) {
                        console.error('   ❌ Hash ไม่ตรง ข้าม...');
                        continue;
                    }
                }

                const tenant = tenantMap.get(payment.tenant_id);
                const room = roomMap.get(payment.room_id);

                if (!tenant || (!tenant.line_user_id && !tenant.facebook_user_id)) continue;

                // สร้าง Message
                let message = `📢 ${branchBuildingName} - แจ้งเตือนค่าเช่า\n\n`;
                message += `สวัสดีคุณ ${tenant.full_name}\nห้อง ${room?.room_number || 'N/A'}\n\n`;
                message += `รายละเอียดค่าใช้จ่าย:\n━━━━━━━━━━━━━━━━━━━━\n`;
                if (payment.rent_amount > 0) message += `ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
                if (payment.electricity_amount > 0) message += `⚡ ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
                if (payment.water_amount > 0) message += `💧 ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
                if (payment.internet_amount > 0) message += `ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
                if (payment.common_fee_amount > 0) message += `ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n`;
                message += `💰 รวมทั้งสิ้น: ${payment.total_amount.toLocaleString()} บาท\n`;
                message += `(${numberToThaiText(payment.total_amount)})\n\n`;
                message += `📅 ครบกำหนดชำระ: ${new Date(payment.due_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
                message += `สถานะ: รอชำระ\n\n💳 โอนเงินได้ที่: ${branchBankName} ${branchBankAccountNumber} (${branchBankAccountName})\n\n`;
                if (payment.invoice_image_url) message += `📄 ดูใบแจ้งหนี้: ${payment.invoice_image_url}\n\n`;
                message += `📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;

                recipients.push({
                    lineUserId: tenant.line_user_id,
                    facebookUserId: tenant.facebook_user_id,
                    imageUrl: payment.invoice_image_url,
                    message: message,
                    metadata: { paymentId: payment.id, branchId: branchId }
                });
            }

            // 6. ส่งข้อความ (Batch Send)
            if (recipients.length > 0) {
                console.log(`   📤 กำลังส่ง ${recipients.length} ข้อความ...`);
                
                // LINE
                const lineRecipients = recipients.filter(r => r.lineUserId);
                if (lineRecipients.length > 0) {
                    if (testLineUserId) {
                        // Test Mode
                        await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                            recipients: [{ lineUserId: testLineUserId, message: lineRecipients[0].message, imageUrl: lineRecipients[0].imageUrl }]
                        });
                        console.log('   🧪 Test Sent (LINE)');
                    } else {
                        // Real Mode
                        await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                            recipients: lineRecipients,
                            options: { batchSize: 10, delayBetweenMessages: 100 }
                        });
                    }
                }
                
                // Facebook
                const fbRecipients = recipients.filter(r => r.facebookUserId);
                for (const r of fbRecipients) {
                    try {
                        await base44.asServiceRole.functions.invoke('sendFacebookMessage', {
                            to: r.facebookUserId,
                            message: r.message,
                            imageUrl: r.imageUrl,
                            branch_id: branchId
                        });
                    } catch(e) {}
                }

                // Update Status (สำคัญ)
                const nowIso = new Date().toISOString();
                await Promise.all(recipients.map(r => 
                    base44.asServiceRole.entities.Payment.update(r.metadata.paymentId, { 
                        advance_reminder_sent_date: nowIso,
                        bill_sent_date: nowIso
                    }).catch(e => console.error(e))
                ));
                
                totalSent += recipients.length;
                processLog.push(`Branch ${branchId}: ${recipients.length} sent`);
            }

            // พัก 0.2 วินาทีก่อนไปสาขาถัดไป
            await delay(200);
        }

        // สร้าง Result object ใหม่ (แทนตัวเก่าที่ลบไป)
        const result = {
            success: true,
            message: `ประมวลผลเสร็จสิ้น (Limit 1.30m)`,
            sent: totalSent,
            log: processLog,
            time_taken: `${(Date.now() - START_TIME)/1000}s`
        };
        
        console.log(`\n✅ DONE! Sent: ${totalSent} | Time: ${result.time_taken}`);

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