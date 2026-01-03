import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// =========================================================
// ⚙️ CONFIGURATION (ตั้งค่าความแรงตรงนี้)
// =========================================================

// ⭐ อยากเพิ่มคนทำงาน แก้เลขตรงนี้ครับ ⭐
// 5 = ทำพร้อมกัน 5 สาขา (ปลอดภัย, แนะนำสำหรับเริ่มต้น)
// 10 = ทำพร้อมกัน 10 สาขา (เร็วขึ้น 2 เท่า, ถ้า Database ไหวก็จัดเลย)
const WORKER_LIMIT = 5; 

// =========================================================
// 🛠️ HELPER FUNCTIONS
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
                if (digit === 1) result += 'สิบ';
                else if (digit === 2) result += 'ยี่สิบ';
                else result += numbers[digit] + positions[position];
            } else if (position === 0 && digit === 1 && len > 1 && parseInt(numStr[len-2]) !== 0) {
                result += 'เอ็ด';
            } else {
                result += numbers[digit] + positions[position];
            }
        }
        return result;
    }
    let text = convertInteger(integerPart) + 'บาท';
    if (decimalPart > 0) text += convertInteger(decimalPart) + 'สตางค์';
    else text += 'ถ้วน';
    return text;
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ฟังก์ชันส่ง Facebook แบบขนาน
async function sendFacebookBatch(base44, recipients, branchId) {
    const BATCH_SIZE = 5; 
    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const chunk = recipients.slice(i, i + BATCH_SIZE);
        await Promise.all(chunk.map(r => 
            base44.asServiceRole.functions.invoke('sendFacebookMessage', {
                to: r.facebookUserId,
                message: r.message,
                imageUrl: r.imageUrl,
                branch_id: branchId
            }).catch(e => console.error(`⚠️ FB Error (${r.facebookUserId}):`, e.message))
        ));
    }
}

// =========================================================
// 👷 WORKER FUNCTION (คนงาน 1 คน รับเหมา 1 สาขา)
// =========================================================
async function processBranchWorker(base44, branchId, getConfig, testLineUserId) {
    let branchSent = 0;
    
    // 1. คำนวณวัน
    const advanceDays = parseInt(getConfig('bill_advance_notice_days', branchId, '3'));
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + advanceDays);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    // 2. เตรียม Config (ดึงค่าให้ถูกต้อง)
    const branchConfigs = {
        bankName: getConfig('bank_name', branchId, 'กสิกร'),
        accNum: getConfig('bank_account_number', branchId, '0722835522'),
        accName: getConfig('bank_account_name', branchId, 'ธนานนท์ พรมพักตร์'),
        building: getConfig('building_name', branchId, 'W RESIDENTS')
    };

    console.log(`🔹 Worker processing Branch: ${branchId} | Due: ${targetDateStr}`);

    // 3. Loop Pagination (ทยอยดึงบิลทีละ 50 ใบ)
    let hasMore = true;
    let offset = 0;
    const BRANCH_BATCH_LIMIT = 500;
    
    while (hasMore && offset < BRANCH_BATCH_LIMIT) {
        const payments = await base44.asServiceRole.entities.Payment.filter({
            branch_id: branchId,
            status: { $ne: 'paid' },
            due_date: targetDateStr
        }, '-id', 50, offset);

        if (payments.length === 0) {
            hasMore = false;
            break;
        }

        // โหลด Cache
        const tenants = await base44.asServiceRole.entities.Tenant.filter({ branch_id: branchId }, '-id', 1000, 0); 
        const rooms = await base44.asServiceRole.entities.Room.filter({ branch_id: branchId }, '-id', 1000, 0);
        const tenantMap = new Map(tenants.map(t => [t.id, t]));
        const roomMap = new Map(rooms.map(r => [r.id, r]));
        const recipients = [];

        for (const payment of payments) {
            if (payment.advance_reminder_sent_date || payment.bill_sent_date) continue;
            if (!payment.invoice_image_url) continue;
            if (payment.invoice_data_hash) {
                 const currentHash = generatePaymentHash(payment);
                 if (currentHash !== payment.invoice_data_hash) continue;
            }

            const tenant = tenantMap.get(payment.tenant_id);
            const room = roomMap.get(payment.room_id);
            if (!tenant || (!tenant.line_user_id && !tenant.facebook_user_id)) continue;

            // --- 📝 MESSAGE BUILDER (รองรับค่าปรับ real-time) ---
            // ⭐ คำนวณค่าปรับแบบ real-time
            const lateFee = calculateLateFee(payment, configs, payment.branch_id);
            const totalWithLateFee = (payment.total_amount || 0) + lateFee;
            
            let message = `📢 ${branchConfigs.building} - แจ้งเตือนค่าเช่า\n\n`;
            message += `สวัสดีคุณ ${tenant.full_name}\nห้อง ${room?.room_number || 'N/A'}\n\n`;
            message += `รายละเอียดค่าใช้จ่าย:\n━━━━━━━━━━━━━━━━━━━━\n`;
            
            if (payment.rent_amount > 0) message += `ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
            if (payment.electricity_amount > 0) message += `⚡ ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
            
            // โชว์ค่าน้ำถ้ามีเงิน หรือ มีหน่วยการใช้
            if (payment.water_amount > 0 || payment.water_units > 0) {
                message += `💧 ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
            }
            
            if (payment.internet_amount > 0) message += `ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
            if (payment.common_fee_amount > 0) message += `ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
            
            if (lateFee > 0) message += `⚠️ ค่าปรับล่าช้า: +${lateFee.toLocaleString()} บาท\n`;
            
            message += `━━━━━━━━━━━━━━━━━━━━\n`;
            message += `💰 รวมทั้งสิ้น: ${totalWithLateFee.toLocaleString()} บาท\n`;
            message += `(${numberToThaiText(totalWithLateFee)})\n\n`;
            message += `📅 ครบกำหนดชำระ: ${new Date(payment.due_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
            
            message += `สถานะ: รอชำระ\n\n💳 โอนเงินได้ที่: ${branchConfigs.bankName} ${branchConfigs.accNum} (${branchConfigs.accName})\n\n`;
            
            if (payment.invoice_image_url) message += `📄 ดูใบแจ้งหนี้: ${payment.invoice_image_url}\n\n`;
            message += `📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
            // -----------------------

            recipients.push({
                lineUserId: tenant.line_user_id,
                facebookUserId: tenant.facebook_user_id,
                imageUrl: payment.invoice_image_url,
                message: message,
                metadata: { paymentId: payment.id }
            });
        }

        if (recipients.length > 0) {
            // Send LINE
            const lineUsers = recipients.filter(r => r.lineUserId);
            if (lineUsers.length > 0) {
                 if (testLineUserId) {
                     await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                        recipients: [{ lineUserId: testLineUserId, message: lineUsers[0].message, imageUrl: lineUsers[0].imageUrl }]
                    });
                 } else {
                     await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                        recipients: lineUsers,
                        options: { batchSize: 10, delayBetweenMessages: 50 }
                    });
                 }
            }
            // Send FB
            const fbUsers = recipients.filter(r => r.facebookUserId);
            if (fbUsers.length > 0) await sendFacebookBatch(base44, fbUsers, branchId);

            // Update DB
            const nowIso = new Date().toISOString();
            await Promise.all(recipients.map(r => 
                base44.asServiceRole.entities.Payment.update(r.metadata.paymentId, { 
                    advance_reminder_sent_date: nowIso,
                    bill_sent_date: nowIso
                }).catch(e => console.error(e))
            ));
            
            branchSent += recipients.length;
        }
        offset += 50;
        await delay(50);
    }
    return branchSent;
}

// =========================================================
// 🚀 MAIN SERVER LOGIC
// =========================================================

Deno.serve(async (req) => {
    const VERSION = '🚀 V6-MULTI-WORKER (READY) 🚀';
    const START_TIME = Date.now();
    const SAFETY_LIMIT_MS = 85 * 1000;
    
    console.log('\n\n');
    console.log('████████████████████████████████████████████████████');
    console.log('█  ' + VERSION);
    console.log('████████████████████████████████████████████████████');
    console.log('👷 Workers Limit:', WORKER_LIMIT);
    console.log('⏰ START:', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
    
    try {
        const base44 = createClientFromRequest(req);
        
        // 🔒 Security: Authentication Check
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        let reqBody = {};
        try { reqBody = await req.json(); } catch(e) {}
        const { branch_id: specificBranchId, test_line_user_id: testLineUserId } = reqBody;

        // 🔒 Security: Branch Access Check
        if (specificBranchId) {
            const userAccessibleBranches = user.accessible_branches;
            const isDeveloper = user.custom_role === 'developer';
            const isOwner = user.custom_role === 'owner';
            
            if (!isDeveloper && !isOwner) {
                if (userAccessibleBranches && !userAccessibleBranches.includes(specificBranchId)) {
                    return Response.json({ error: 'Branch access denied' }, { status: 403 });
                }
            }
        }

        const allConfigs = await base44.asServiceRole.entities.Config.list();
        const getConfig = (key, branchId, defaultVal) => {
            const specific = allConfigs.find(c => c.key === key && c.branch_id === branchId);
            if (specific) return specific.value;
            const global = allConfigs.find(c => c.key === key && !c.branch_id);
            return global ? global.value : defaultVal;
        };

        // หา List สาขาทั้งหมดที่จะส่ง
        let targetBranches = [];
        if (specificBranchId) {
            targetBranches = [specificBranchId];
        } else {
            targetBranches = allConfigs
                .filter(c => c.key === 'send_advance_reminder' && c.value === 'true')
                .map(c => c.branch_id);
        }
        targetBranches = [...new Set(targetBranches)];
        console.log(`📊 BRANCHES TO PROCESS: ${targetBranches.length}`);
        
        let totalSent = 0;
        let logs = [];

        // ⭐⭐⭐ PARALLEL PROCESSING LOGIC (หัวใจของ V6) ⭐⭐⭐
        // แบ่งสาขาเป็นก้อนๆ (Chunks) แล้วให้ Worker รุมทำ
        
        for (let i = 0; i < targetBranches.length; i += WORKER_LIMIT) {
            
            // 🛑 Safety Cut
            if (Date.now() - START_TIME > SAFETY_LIMIT_MS) {
                logs.push('⚠️ Timeout! Stopping workers.');
                break;
            }

            // ตัดสาขามาทำทีละชุด ตาม WORKER_LIMIT
            const chunk = targetBranches.slice(i, i + WORKER_LIMIT);
            console.log(`\n🏗️ Starting Worker Batch ${Math.floor(i/WORKER_LIMIT) + 1} (Processing ${chunk.length} branches)`);

            // สั่งให้ Worker ทำงานพร้อมกัน (Parallel)
            const results = await Promise.all(chunk.map(bId => 
                processBranchWorker(base44, bId, getConfig, testLineUserId)
                    .then(sent => {
                        logs.push(`Branch ${bId}: Done (${sent} sent)`);
                        return sent;
                    })
                    .catch(err => {
                        console.error(`❌ Worker Error (${bId}):`, err.message);
                        logs.push(`Branch ${bId}: Error`);
                        return 0;
                    })
            ));

            totalSent += results.reduce((a, b) => a + b, 0);
            await delay(100); // พักหายใจก่อนเริ่มก้อนถัดไป
        }

        const duration = (Date.now() - START_TIME) / 1000;
        console.log(`\n✅ ALL WORKERS DONE! Total Sent: ${totalSent} | Duration: ${duration}s`);

        return Response.json({
            success: true,
            version: VERSION,
            workers: WORKER_LIMIT,
            sent: totalSent,
            logs: logs,
            duration: `${duration}s`
        });

    } catch (err) {
        console.error('❌ FATAL ERROR:', err);
        return Response.json({ error: err.message, stack: err.stack }, { status: 500 });
    }
});