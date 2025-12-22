import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// =========================================================
// 🛠️ HELPER FUNCTIONS (เครื่องมือช่วยงาน)
// =========================================================

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
    return btoa(JSON.stringify(dataToHash)).substring(0, 32);
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

// ฟังก์ชันส่ง Facebook แบบขนาน (เร็วกว่าเดิม 5 เท่า)
async function sendFacebookBatch(base44, recipients, branchId) {
    const BATCH_SIZE = 5; 
    
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const chunk = recipients.slice(i, i + BATCH_SIZE);
        const promises = chunk.map(r => 
            base44.asServiceRole.functions.invoke('sendFacebookMessage', {
                to: r.facebookUserId,
                message: r.message,
                imageUrl: r.imageUrl,
                branch_id: branchId
            }).catch(e => console.error(`⚠️ FB Error (${r.facebookUserId}):`, e.message))
        );
        await Promise.all(promises); // รอ 5 คนเสร็จพร้อมกัน
    }
}

// =========================================================
// 🚀 MAIN SERVER LOGIC
// =========================================================

Deno.serve(async (req) => {
    const VERSION = '💎 V5-ENTERPRISE FULL 💎';
    const START_TIME = Date.now();
    const SAFETY_LIMIT_MS = 85 * 1000; // ตัดจบที่ 85 วินาที
    
    console.log('\n\n');
    console.log('████████████████████████████████████████████████████');
    console.log('█  ' + VERSION);
    console.log('████████████████████████████████████████████████████');
    console.log('⏰ START:', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
    
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Parse Request
        let reqBody = {};
        try { reqBody = await req.json(); } catch(e) {}
        const { branch_id: specificBranchId, test_line_user_id: testLineUserId } = reqBody;

        // 2. Load Configs (โหลดครั้งเดียวใช้คุ้ม)
        const allConfigs = await base44.asServiceRole.entities.Config.list();
        
        // ฟังก์ชันดึง Config แบบไม่ต้องยิง DB บ่อยๆ
        const getConfig = (key, branchId, defaultVal) => {
            const specific = allConfigs.find(c => c.key === key && c.branch_id === branchId);
            if (specific) return specific.value;
            const global = allConfigs.find(c => c.key === key && !c.branch_id);
            return global ? global.value : defaultVal;
        };

        // 3. กำหนดสาขาเป้าหมาย
        let targetBranches = [];
        if (specificBranchId) {
            targetBranches = [specificBranchId];
        } else {
            targetBranches = allConfigs
                .filter(c => c.key === 'send_advance_reminder' && c.value === 'true')
                .map(c => c.branch_id);
        }
        
        // กรองรหัสสาขาซ้ำออก (Unique)
        targetBranches = [...new Set(targetBranches)];

        console.log(`📊 BRANCHES TO PROCESS: ${targetBranches.length}`);
        
        let totalSent = 0;
        let logs = [];

        // -------------------------------------------------
        // 🔄 OUTER LOOP: วนทีละสาขา
        // -------------------------------------------------
        for (const branchId of targetBranches) {
            
            // 🛑 Safety Cut: ถ้าเวลาใกล้หมด ให้หยุด
            if (Date.now() - START_TIME > SAFETY_LIMIT_MS) {
                const msg = `⚠️ TIME LIMIT EXCEEDED! Stopped at branch ${branchId}`;
                console.warn(msg);
                logs.push(msg);
                break;
            }

            // คำนวณวัน
            const advanceDays = parseInt(getConfig('bill_advance_notice_days', branchId, '3'));
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + advanceDays);
            const targetDateStr = targetDate.toISOString().split('T')[0];

            console.log(`\n🔹 Processing Branch: ${branchId} | Due Date: ${targetDateStr}`);

            // เตรียม Config ของสาขานี้
            const branchConfigs = {
                bankName: getConfig('bank_name', branchId, 'กสิกร'),
                accNum: getConfig('bank_account_number', branchId, '0722835522'),
                accName: getConfig('bank_account_name', branchId, 'ธนานนท์ พรมพักตร์'),
                building: getConfig('building_name', branchId, 'W RESIDENTS')
            };

            // ⚡ PAGINATION LOOP: วนลูปย่อยเพื่อแก้ปัญหา Limit 100
            let hasMore = true;
            let offset = 0;
            const BRANCH_BATCH_LIMIT = 500; // ทำสูงสุด 500 ใบต่อสาขาต่อรอบ (กันค้าง)
            
            while (hasMore && offset < BRANCH_BATCH_LIMIT) {
                
                // ดึง Payments ทีละ 50 ใบ
                const payments = await base44.asServiceRole.entities.Payment.filter({
                    branch_id: branchId,
                    status: { $ne: 'paid' },
                    due_date: targetDateStr
                }, '-id', 50, offset);

                if (payments.length === 0) {
                    hasMore = false;
                    break;
                }

                // โหลด Tenant/Room มาแคชไว้ (เฉพาะของ 50 ใบนี้จะดีมาก แต่ API จำกัด เลยโหลด buffer ไว้)
                const tenants = await base44.asServiceRole.entities.Tenant.filter({ branch_id: branchId }, '-id', 1000, 0); 
                const rooms = await base44.asServiceRole.entities.Room.filter({ branch_id: branchId }, '-id', 1000, 0);
                
                const tenantMap = new Map(tenants.map(t => [t.id, t]));
                const roomMap = new Map(rooms.map(r => [r.id, r]));

                const recipients = [];

                // วนลูปสร้างข้อความ
                for (const payment of payments) {
                    // Filter Logic
                    if (payment.advance_reminder_sent_date || payment.bill_sent_date) continue;
                    if (!payment.invoice_image_url) continue;
                    
                    // Hash Check
                    if (payment.invoice_data_hash) {
                         const currentHash = generatePaymentHash(payment);
                         if (currentHash !== payment.invoice_data_hash) continue;
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
                        metadata: { paymentId: payment.id }
                    });
                }

                // เริ่มกระบวนการส่ง (Sending Phase)
                if (recipients.length > 0) {
                    console.log(`   📤 Sending batch of ${recipients.length} messages...`);

                    // 1. Send LINE
                    const lineUsers = recipients.filter(r => r.lineUserId);
                    if (lineUsers.length > 0) {
                         if (testLineUserId) {
                             // Test Mode
                             await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                                recipients: [{ lineUserId: testLineUserId, message: lineUsers[0].message, imageUrl: lineUsers[0].imageUrl }]
                            });
                            console.log('   🧪 Test LINE Sent');
                         } else {
                             // Production Mode
                             await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                                recipients: lineUsers,
                                options: { batchSize: 10, delayBetweenMessages: 50 }
                            });
                         }
                    }

                    // 2. Send Facebook (Parallel Batch - NEW!)
                    const fbUsers = recipients.filter(r => r.facebookUserId);
                    if (fbUsers.length > 0) {
                        await sendFacebookBatch(base44, fbUsers, branchId);
                    }

                    // 3. Update Status
                    const nowIso = new Date().toISOString();
                    await Promise.all(recipients.map(r => 
                        base44.asServiceRole.entities.Payment.update(r.metadata.paymentId, { 
                            advance_reminder_sent_date: nowIso,
                            bill_sent_date: nowIso
                        }).catch(e => console.error(`Update fail ID ${r.metadata.paymentId}:`, e.message))
                    ));

                    totalSent += recipients.length;
                }

                offset += 50; // ขยับไปหน้าถัดไป
                await delay(100); // พักหายใจนิดนึงระหว่าง Batch ย่อย
            }
            
            logs.push(`Branch ${branchId}: Done (Sent ${totalSent} total)`);
            await delay(100); // พักหายใจระหว่าง Branch
        }

        const duration = (Date.now() - START_TIME) / 1000;
        console.log(`\n✅ COMPLETELY DONE! Sent: ${totalSent} | Duration: ${duration}s`);

        return Response.json({
            success: true,
            version: VERSION,
            sent: totalSent,
            logs: logs,
            duration: `${duration}s`
        });

    } catch (err) {
        console.error('❌ FATAL ERROR:', err);
        return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
    }
});