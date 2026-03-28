import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

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



// =========================================================
// 👷 WORKER FUNCTION (คนงาน 1 คน รับเหมา 1 สาขา)
// =========================================================
async function processBranchWorker(base44, branchId, getConfig, testLineUserId) {
    let branchSent = 0;
    
    // 1. คำนวณวัน (UTC+7 - Asia/Bangkok)
    const advanceDays = parseInt(getConfig('bill_advance_notice_days', branchId, '3'));
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + advanceDays);
    // ⭐ แปลงเป็นเวลาไทย (UTC+7)
    const localDate = new Date(targetDate.getTime() + (7 * 60 * 60 * 1000));
    const targetDateStr = localDate.toISOString().split('T')[0];

    // 2. เตรียม Config (ไม่มี = skip branch)
    const bankName = getConfig('bank_name', branchId, null);
    const accNum = getConfig('bank_account_number', branchId, null);
    const accName = getConfig('bank_account_name', branchId, null);
    const building = getConfig('building_name', branchId, 'ที่พัก');

    // 🛡️ Safety Check: ถ้าไม่มี bank config = skip branch นี้
    if (!bankName || !accNum || !accName) {
        console.error(`❌ Missing bank config for branch ${branchId} - SKIPPING`);
        return 0;
    }

    const branchConfigs = { bankName, accNum, accName, building };

    console.log(`🔹 Worker processing Branch: ${branchId} | Due: ${targetDateStr}`);

    // 3. Loop Pagination (ทยอยดึงบิลทีละ 50 ใบ)
    let hasMore = true;
    let offset = 0;
    const BRANCH_BATCH_LIMIT = 1000; // ⬆️ เพิ่มจาก 500 → 1000

    // ⭐ โหลด Cache แบบ Lightweight (เฉพาะ fields ที่ใช้)
    const CACHE_CHUNK = 500;
    const MAX_SAFE_RECORDS = 10000; // 🛡️ Safety limit

    // โหลด Tenants ทีละ 500 จนครบ (เก็บเฉพาะ fields ที่ใช้)
    const allTenants = [];
    let tenantOffset = 0;
    while (allTenants.length < MAX_SAFE_RECORDS) {
        const tenantChunk = await base44.asServiceRole.entities.Tenant.filter({ branch_id: branchId }, '-id', CACHE_CHUNK, tenantOffset);
        if (tenantChunk.length === 0) break;

        // ⭐ Projection: เก็บเฉพาะ fields ที่จำเป็น (ลด memory ~70%)
        allTenants.push(...tenantChunk.map(t => ({
            id: t.id,
            full_name: t.full_name,
            line_user_id: t.line_user_id,
            facebook_user_id: t.facebook_user_id
        })));

        tenantOffset += CACHE_CHUNK;
        if (tenantChunk.length < CACHE_CHUNK) break;
    }

    // โหลด Rooms ทีละ 500 จนครบ (เก็บเฉพาะ fields ที่ใช้)
    const allRooms = [];
    let roomOffset = 0;
    while (allRooms.length < MAX_SAFE_RECORDS) {
        const roomChunk = await base44.asServiceRole.entities.Room.filter({ branch_id: branchId }, '-id', CACHE_CHUNK, roomOffset);
        if (roomChunk.length === 0) break;

        // ⭐ Projection: เก็บเฉพาะ fields ที่จำเป็น
        allRooms.push(...roomChunk.map(r => ({
            id: r.id,
            room_number: r.room_number
        })));

        roomOffset += CACHE_CHUNK;
        if (roomChunk.length < CACHE_CHUNK) break;
    }

    // 🛡️ Safety Check
    if (allTenants.length >= MAX_SAFE_RECORDS || allRooms.length >= MAX_SAFE_RECORDS) {
        console.warn(`⚠️ Hit safety limit! Tenants: ${allTenants.length}, Rooms: ${allRooms.length}`);
    }

    const tenantMap = new Map(allTenants.map(t => [t.id, t]));
    const roomMap = new Map(allRooms.map(r => [r.id, r]));

    // 📊 Memory Usage Estimate
    const estimatedMemoryMB = ((allTenants.length * 200 + allRooms.length * 100) / 1024 / 1024).toFixed(2);
    console.log(`📦 Cached: ${allTenants.length} tenants, ${allRooms.length} rooms (~${estimatedMemoryMB} MB)`);

    while (hasMore && offset < BRANCH_BATCH_LIMIT) {
        const payments = await base44.asServiceRole.entities.Payment.filter({
            branch_id: branchId,
            status: { $ne: 'paid' },
            due_date: targetDateStr
        }, '-id', 200, offset);

        if (payments.length === 0) {
            hasMore = false;
            break;
        }

        const recipients = [];

        for (const payment of payments) {
            if (payment.advance_reminder_sent_date || payment.bill_sent_date) continue;

            const tenant = tenantMap.get(payment.tenant_id);
            const room = roomMap.get(payment.room_id);
            if (!tenant || (!tenant.line_user_id && !tenant.facebook_user_id)) continue;

            // ⭐ สร้างลิงค์ Public Invoice
            const frontendUrl = getConfig('frontend_url', branchId) || Deno.env.get('FRONTEND_URL');
            const invoiceLink = frontendUrl ? `${frontendUrl}/publicinvoice?id=${payment.id}` : null;

            // --- 📝 MESSAGE BUILDER ---
            let message = `📢 ${branchConfigs.building} - แจ้งเตือนค่าเช่า\n\n`;
            message += `สวัสดีคุณ ${tenant.full_name}\nห้อง ${room?.room_number || 'N/A'}\n\n`;
            message += `รายละเอียดค่าใช้จ่าย:\n━━━━━━━━━━━━━━━━━━━━\n`;
            
            if (payment.rent_amount > 0) message += `🏠 ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
            if (payment.electricity_amount > 0) message += `⚡ ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
            if (payment.water_amount > 0 || payment.water_units > 0) {
                message += `💧 ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
            }
            if (payment.internet_amount > 0) message += `🌐 ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
            if (payment.common_fee_amount > 0) message += `🧹 ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
            
            message += `━━━━━━━━━━━━━━━━━━━━\n`;
            message += `💰 รวมทั้งสิ้น: ${payment.total_amount.toLocaleString()} บาท\n`;
            message += `(${numberToThaiText(payment.total_amount)})\n\n`;
            message += `📅 ครบกำหนดชำระ: ${new Date(payment.due_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
            message += `สถานะ: รอชำระ\n\n`;
            message += `💳 โอนเงินได้ที่:\n${branchConfigs.bankName} ${branchConfigs.accNum}\nชื่อ: ${branchConfigs.accName}\n\n`;
            if (invoiceLink) {
                message += `📄 ดูเอกสาร: ${invoiceLink}\n\n`;
            }
            message += `📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;

            recipients.push({
                lineUserId: tenant.line_user_id,
                facebookUserId: tenant.facebook_user_id,
                branchId: branchId,
                message: message,
                metadata: { paymentId: payment.id }
            });
        }

        if (recipients.length > 0) {
            const successfulSends = []; // เก็บเฉพาะคนที่ส่งสำเร็จ

            // Send LINE
            const lineUsers = recipients.filter(r => r.lineUserId);
            console.log(`📨 LINE Recipients prepared: ${lineUsers.length}`, lineUsers.map(u => ({ 
                userId: u.lineUserId?.substring(0, 10), 
                hasMetadata: !!u.metadata, 
                paymentId: u.metadata?.paymentId?.substring(0, 8) 
            })));
            
            if (lineUsers.length > 0) {
                 if (testLineUserId) {
                     // Test Mode: ส่งเฉพาะ 1 คน
                     const response = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                        recipients: [{ lineUserId: testLineUserId, branchId: branchId, message: lineUsers[0].message, metadata: lineUsers[0].metadata }]
                    });
                    console.log('📤 LINE Response (Test):', response?.data);
                    // เช็คว่าส่งสำเร็จจริง (success อาจเป็น number หรือ boolean)
                    const sentCount = response?.data?.sent || response?.data?.success || 0;
                    if (sentCount > 0) {
                        successfulSends.push(lineUsers[0].metadata.paymentId);
                        console.log(`✅ Test mode sent successfully. PaymentId added:`, lineUsers[0].metadata.paymentId);
                    } else {
                        console.error(`❌ Test mode failed:`, response?.data);
                    }
                 } else {
                     // Production Mode: ส่งทุกคน + เช็ค response
                     const response = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                        recipients: lineUsers,
                        options: { batchSize: 10, delayBetweenMessages: 50 }
                    });
                    console.log('📤 LINE Response (Prod):', response?.data);
                    
                    // เช็คจำนวนที่ส่งสำเร็จจริง (support ทั้ง sent และ success)
                    const sentCount = response?.data?.sent || response?.data?.success || 0;
                    console.log(`🔍 Sent Count: ${sentCount}, LineUsers Count: ${lineUsers.length}`);
                    
                    if (sentCount > 0) {
                        lineUsers.forEach(u => {
                            if (u.metadata?.paymentId) {
                                successfulSends.push(u.metadata.paymentId);
                            } else {
                                console.error('❌ Missing paymentId in metadata:', u);
                            }
                        });
                        console.log(`✅ Added ${successfulSends.length} paymentIds to successfulSends array`);
                    } else {
                        console.error(`❌ LINE API failed or sent 0:`, response?.data);
                    }
                 }
            }

            // Send FB (แบบ Batch เพื่อหลีกเลี่ยง Rate Limit)
            const fbUsers = recipients.filter(r => r.facebookUserId);
            if (fbUsers.length > 0) {
                const FB_BATCH_SIZE = 10;
                const FB_DELAY_MS = 500;
                
                for (let i = 0; i < fbUsers.length; i += FB_BATCH_SIZE) {
                    const batch = fbUsers.slice(i, i + FB_BATCH_SIZE);
                    const fbMessages = batch.map(r => ({
                        to: r.facebookUserId,
                        message: r.message,
                        branch_id: branchId
                    }));
                    
                    const results = await Promise.allSettled(fbMessages.map(fb => 
                        base44.asServiceRole.functions.invoke('sendFacebookMessage', fb)
                    ));
                    
                    // เก็บเฉพาะคนที่ส่งสำเร็จ
                    results.forEach((result, idx) => {
                        if (result.status === 'fulfilled' && result.value?.data?.success) {
                            successfulSends.push(batch[idx].metadata.paymentId);
                        }
                    });
                    
                    if (i + FB_BATCH_SIZE < fbUsers.length) {
                        await delay(FB_DELAY_MS);
                    }
                }
            }

            // Update DB เฉพาะคนที่ส่งสำเร็จจริง
            console.log(`🔍 SuccessfulSends Array Length: ${successfulSends.length}`, successfulSends.map(id => id?.substring(0, 8)));
            
            if (successfulSends.length > 0) {
                const nowIso = new Date().toISOString();
                const UPDATE_BATCH_SIZE = 20;
                const uniquePaymentIds = [...new Set(successfulSends)]; // ป้องกันซ้ำ
                
                console.log(`💾 Updating DB for ${uniquePaymentIds.length} payments...`);
                
                for (let i = 0; i < uniquePaymentIds.length; i += UPDATE_BATCH_SIZE) {
                    const batch = uniquePaymentIds.slice(i, i + UPDATE_BATCH_SIZE);
                    await Promise.all(batch.map(paymentId => 
                        base44.asServiceRole.entities.Payment.update(paymentId, { 
                            advance_reminder_sent_date: nowIso,
                            bill_sent_date: nowIso
                        }).catch(e => console.error(`⚠️ Update Error:`, e.message))
                    ));
                    if (i + UPDATE_BATCH_SIZE < uniquePaymentIds.length) await delay(100);
                }
                
                branchSent += uniquePaymentIds.length;
                console.log(`✅ DB Updated for ${uniquePaymentIds.length} payments`);
            } else {
                console.error(`❌ Branch ${branchId}: 0 successful sends despite ${recipients.length} recipients (LINE sent but no paymentIds collected!)`);
            }
        }
        offset += 200;
        await delay(100); // ⬆️ เพิ่มจาก 50ms → 100ms (ลด database pressure)
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
        
        // ⚠️ CRON JOB MODE: ไม่มี user session - ใช้ Service Role เท่านั้น
        // ลบการเช็ค auth.me() ออก เพราะ cron job ไม่มี authenticated user
        
        let reqBody = {};
        try { reqBody = await req.json(); } catch(e) {}
        const { branch_id: specificBranchId, test_line_user_id: testLineUserId } = reqBody;

        // 🔒 CRON MODE: Skip user-based branch access check
        // Cron jobs run as service role and process all enabled branches

        const configRes = await base44.asServiceRole.entities.Config.list();
        const allConfigs = Array.isArray(configRes) ? configRes : (configRes?.data || []);
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

            // สั่งให้ Worker ทำงานพร้อมกัน (Parallel) + Retry Logic
            const results = await Promise.all(chunk.map(async (bId) => {
                let retries = 0;
                const MAX_RETRIES = 2;

                while (retries <= MAX_RETRIES) {
                    try {
                        const sent = await processBranchWorker(base44, bId, getConfig, testLineUserId);
                        logs.push(`Branch ${bId.substring(0, 8)}...: Done (${sent} sent)`);
                        return sent;
                    } catch (err) {
                        retries++;
                        if (retries > MAX_RETRIES) {
                            console.error(`❌ Worker Failed After ${MAX_RETRIES} Retries (${bId}):`, err.message);
                            logs.push(`Branch ${bId.substring(0, 8)}...: Error - ${err.message}`);
                            return 0;
                        }
                        console.warn(`⚠️ Retry ${retries}/${MAX_RETRIES} for ${bId}`);
                        await delay(1000 * retries); // Exponential backoff
                    }
                }
                return 0;
            }));

            totalSent += results.reduce((a, b) => a + b, 0);
            await delay(200); // ⬆️ เพิ่มจาก 100ms → 200ms (ปลอดภัยกว่า)
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