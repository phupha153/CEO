import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

/**
 * ฟังก์ชันสำหรับสร้างรูปใบแจ้งหนี้และส่ง LINE แบบ Queue
 * Version: 4.0 - Hybrid (Beautiful Invoice + New Message Format)
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ⭐ ฟังก์ชันสร้าง hash จากข้อมูลบิล
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
        late_fee_amount: payment.late_fee_amount || 0,
        total_amount: payment.total_amount || 0,
        due_date: payment.due_date || '',
        status: payment.status || 'pending'
    };
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32);
}

// ⭐ ฟังก์ชันแปลงตัวเลขเป็นคำอ่านภาษาไทย
function numberToThaiText(number) {
    if (number === undefined || number === null || isNaN(number) || number === 0) return 'ศูนย์บาทถ้วน';
    const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    const parts = number.toFixed(2).split('.');
    
    function convert(n) {
        let res = '';
        const s = n.toString();
        const len = s.length;
        for (let i = 0; i < len; i++) {
            const digit = parseInt(s[i]);
            const pos = len - i - 1;
            if (digit === 0) continue;
            if (pos === 1 && digit === 1) res += 'สิบ';
            else if (pos === 1 && digit === 2) res += 'ยี่สิบ';
            else if (pos === 0 && digit === 1 && len > 1) res += 'เอ็ด';
            else res += numbers[digit] + positions[pos];
        }
        return res;
    }
    let text = convert(parseInt(parts[0])) + 'บาท';
    if (parseInt(parts[1]) > 0) text += convert(parseInt(parts[1])) + 'สตางค์';
    else text += 'ถ้วน';
    return text;
}

// ⭐ ฟังก์ชันจัดรูปแบบวันที่
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
    } catch { return '-'; }
}


// --- Main Queue Worker ---

Deno.serve(async (req) => {
    console.log('========================================');
    console.log('🖼️ PROCESS INVOICE IMAGE QUEUE (New Message Format)');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('========================================');

    const startTime = Date.now();
    let base44 = null;
    let targetBranchId = null;
    let batchSize = 10000;
    let concurrentLimit = 1;
    let maxRunTime = 88000;
    let skipLineSend = false;

    try {
        const clonedReq = req.clone();
        base44 = createClientFromRequest(req);

        // 🔒 Security: Authentication Check
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        try {
            const text = await clonedReq.text();
            if (text && text.trim()) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
                batchSize = body.batch_size || 5;
                concurrentLimit = body.concurrent_limit || 1;
                skipLineSend = body.skip_line_send === true;
            }
        } catch (e) { console.log('⚠️ No valid JSON body'); }

        // 🔒 Security: Branch Access Check
        if (targetBranchId) {
            const userAccessibleBranches = user.accessible_branches;
            const isDeveloper = user.custom_role === 'developer';
            const isOwner = user.custom_role === 'owner';

            if (!isDeveloper && !isOwner) {
                if (userAccessibleBranches && !userAccessibleBranches.includes(targetBranchId)) {
                    return Response.json({ error: 'Branch access denied' }, { status: 403 });
                }
            }
        }

        console.log(`📋 Target Branch: ${targetBranchId || 'ALL'}`);

        const configs = await base44.asServiceRole.entities.Config.list() || [];
        const getConfigValue = (key, branchId, defaultValue = '') => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig?.value) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : {};
        let paymentsToProcess = [];
        let dbSkip = 0;
        const dbFetchSize = 1000;
        const maxScanLimit = 15000;
        let hasMore = true;

        console.log(`📥 Start Scanning for jobs...`);
        
        while (hasMore && paymentsToProcess.length < batchSize && dbSkip < maxScanLimit) {
            const batch = await base44.asServiceRole.entities.Payment.filter(
                paymentFilter, '-updated_date', dbFetchSize, dbSkip
            );

            if (!batch || batch.length === 0) {
                hasMore = false; 
                break;
            }

            for (const p of batch) {
                if (paymentsToProcess.length >= batchSize) break;
                if (p.status === 'paid' || p.status === 'cancelled') continue;
                // 1. ตั้งกฎ: ถ้า updated_date เกิน 30 นาที ให้ถือว่าค้าง
                const ZOMBIE_THRESHOLD_MS = 5 * 60 * 1000; // 30 นาที
                const lastUpdate = p.updated_date ? new Date(p.updated_date).getTime() : 0;
                const isStuckGenerating = p.invoice_image_status === 'generating' && 
                                          (Date.now() - lastUpdate > ZOMBIE_THRESHOLD_MS);

                const needsImage = !p.invoice_image_url || 
                                   p.invoice_image_status === 'pending' || 
                                   p.invoice_image_status === 'generating' ||
                                   !p.invoice_image_status;
                
                let needsRegenerate = false;
                if (p.invoice_image_url && p.invoice_data_hash) {
                    if (generatePaymentHash(p) !== p.invoice_data_hash) needsRegenerate = true;
                }
                if (p.status === 'overdue' && p.late_fee_amount > 0 && !p.invoice_data_hash) needsRegenerate = true;

                const autoSendEnabled = getConfigValue('auto_send_bills_after_generation', p.branch_id, 'false') === 'true';
                const needsSend = autoSendEnabled && !p.bill_sent_date;

                if (needsImage || needsRegenerate || needsSend) {
                    paymentsToProcess.push(p);
                }
            }
            dbSkip += batch.length;
        }

        console.log(`📊 Found jobs: ${paymentsToProcess.length}`);

        if (paymentsToProcess.length === 0) {
            return Response.json({ success: true, message: 'ไม่มีบิลที่ต้องสร้างรูปหรือส่ง LINE', processed: 0 });
        }

        const uniqueTenantIds = [...new Set(paymentsToProcess.map(p => p.tenant_id).filter(id => id))];
        const uniqueRoomIds = [...new Set(paymentsToProcess.map(p => p.room_id).filter(id => id))];
        
        const [tenantsBatch, roomsBatch] = await Promise.all([
            uniqueTenantIds.length > 0 ? Promise.all(uniqueTenantIds.map(id => base44.asServiceRole.entities.Tenant.filter({ id }).catch(() => null))).then(results => results.flat().filter(Boolean)) : [],
            uniqueRoomIds.length > 0 ? Promise.all(uniqueRoomIds.map(id => base44.asServiceRole.entities.Room.filter({ id }).catch(() => null))).then(results => results.flat().filter(Boolean)) : []
        ]);

        const tenantMap = new Map(tenantsBatch.map(t => [t.id, t]));
        const roomMap = new Map(roomsBatch.map(r => [r.id, r]));

        // เพิ่ม fbSent = 0 เข้าไปครับ
        let imageGenerated = 0, imageFailed = 0, lineSent = 0, lineFailed = 0, fbSent = 0;
        let allImageResults = [];
        let processedCount = 0;

        // ⭐ ไม่ต้องสร้างรูปแล้ว - ส่งลิงก์ PublicInvoice โดยตรง
        const processPayment = async (payment) => {
            const room = roomMap.get(payment.room_id);
            const tenant = tenantMap.get(payment.tenant_id);

            if (Date.now() - startTime > maxRunTime) return null;

            // ส่งลิงก์ถึงแม้มี invoice_image_url แล้ว (เพื่อให้ส่ง LINE ได้)
            return { payment, room, tenant, success: true, skipped: false };
        };

        const activePromises = new Set();
        let queueIndex = 0;
        const startNextJob = async () => {
            if (queueIndex >= paymentsToProcess.length) return null;
            const payment = paymentsToProcess[queueIndex];
            queueIndex++;
            const promise = processPayment(payment).then(result => {
                activePromises.delete(promise);
                if (result) allImageResults.push(result);
                if (result?.success && !result?.skipped) imageGenerated++;
                else if (result && !result.success) imageFailed++;
                return startNextJob();
            }).catch(() => startNextJob());
            activePromises.add(promise);
            return promise;
        };

        const workers = [];
        for (let i = 0; i < Math.min(concurrentLimit, paymentsToProcess.length); i++) workers.push(startNextJob());
        await Promise.all(workers);

        if (!skipLineSend) {
            console.log(`\n📤 Sending notifications (New Format)...`);
            for (const result of allImageResults) {
                if (!result.success && !result.skipped) continue;
                const { payment, room, tenant, imageUrl } = result;
                
              // --- 🟢 แก้ไข LOG ตรงนี้ครับ 🟢 ---
                const autoSendEnabled = getConfigValue('auto_send_bills_after_generation', payment.branch_id, 'false') === 'true';
                
                console.log(`🔍 [Debug] ห้อง ${room?.room_number}: ` +
                            `AutoSend=${autoSendEnabled}, ` +
                            `Line=${tenant?.line_user_id ? '✅' : '❌'}, ` +
                            `FB=${tenant?.facebook_user_id ? '✅' : '❌'} ` +  // เช็คว่ามีค่าไหม
                            `[ID: ${tenant?.facebook_user_id || 'ว่าง'}]`); // ปริ้นค่าออกมาดูเลย
                // ------------------------------------

                if (!autoSendEnabled || payment.bill_sent_date) continue;

                // เช็คเงื่อนไขส่ง
                const hasLineId = !!tenant?.line_user_id;
                const hasFacebookId = !!tenant?.facebook_user_id; // <-- ตรงนี้สำคัญ ต้องมีค่า
                if (!hasLineId && !hasFacebookId) continue;

                const branchId = payment.branch_id;
                const bankName = getConfigValue('bank_name', branchId, 'กสิกร');
                const bankAcc = getConfigValue('bank_account_number', branchId, '-');
                const bankOwner = getConfigValue('bank_account_name', branchId, '-');
                const buildingName = getConfigValue('building_name', branchId, 'W RESIDENTS');
                
                // --- 📝 FORMAT ข้อความใหม่ที่สวยงาม ---
                let msg = `📢 แจ้งเตือนค่าเช่า\n`;
                msg += ` ${buildingName}\n`;
                msg += ` คุณ ${tenant.full_name} (ห้อง ${room?.room_number || '-'}) \n\n`;

                msg += `🧾 รายละเอียด:\n`;
                if (payment.rent_amount > 0) msg += `• ค่าเช่า: ${payment.rent_amount.toLocaleString()} บ.\n`;
                if (payment.electricity_amount > 0) msg += `• ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บ.\n`;
                if (payment.water_amount > 0) msg += `• ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บ.\n`;
                if (payment.internet_amount > 0) msg += `• เน็ต: ${payment.internet_amount.toLocaleString()} บ.\n`;
                if (payment.common_fee_amount > 0) msg += `• ส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บ.\n`;
                if (payment.parking_fee_amount > 0) msg += `• จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บ.\n`;
                if (payment.other_amount > 0) msg += `• อื่นๆ: ${payment.other_amount.toLocaleString()} บ.\n`;
                if (payment.late_fee_amount > 0) msg += `• ค่าปรับ: ${payment.late_fee_amount.toLocaleString()} บ.\n`;

                msg += `------------------------------\n`;
                msg += `💰 ยอดรวมสุทธิ: ${payment.total_amount.toLocaleString()} บาท\n`;
                msg += `(${numberToThaiText(payment.total_amount)})\n`;
                msg += `------------------------------\n\n`;

                msg += ` ครบกำหนด: ${new Date(payment.due_date).toLocaleDateString('th-TH')}\n\n`;

                msg += `  ชำระเงินได้ที่:\n`;
                msg += `🏦 ${bankName} ${bankAcc}\n`  // <--- ขาด ; ท้ายบรรทัด
                msg += `👤 ${bankOwner}\n\n`;

                if (imageUrl) msg += `📄 ดูบิล: ${imageUrl}\n\n`;
                msg += `📸 โอนแล้วรบกวนส่งสลิปนะคะ ขอบคุณค่ะ 🙏`;
                // -------------------------------------------

                let messageSent = false;

                if (hasLineId) {
                    try {
                        const lineToken = getConfigValue('line_channel_access_token', branchId, '');
                        if (lineToken) {
                            const res = await fetch('https://api.line.me/v2/bot/message/push', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lineToken}` },
                                body: JSON.stringify({ to: tenant.line_user_id, messages: [{ type: 'text', text: msg }] })
                            });
                            if (res.ok) { lineSent++; messageSent = true; console.log(`✅ [LINE] ห้อง ${room?.room_number}`); }
                            else { lineFailed++; console.error(`❌ [LINE] Failed`); }
                            await delay(200);
                        }
                    } catch (e) { lineFailed++; }
                }

                if (hasFacebookId) {
                    try {
                        const fbToken = getConfigValue('facebook_page_access_token', branchId, '');

                        if (!fbToken) {
                            console.log(`⚠️ [FB] ห้อง ${room?.room_number}: ไม่พบ Token`);
                        } else {
                            const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${fbToken}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    recipient: { id: tenant.facebook_user_id }, 
                                    message: { text: msg },
                                    messaging_type: 'MESSAGE_TAG', 
                                    tag: 'CONFIRMED_EVENT_UPDATE' 
                                })
                            });

                            if (res.ok) { 
                                fbSent++;
                                messageSent = true; 
                                console.log(`✅ [FB] ห้อง ${room?.room_number}`); 
                            } else {
                                const errText = await res.text();
                                console.error(`❌ [FB] Failed ห้อง ${room?.room_number}: ${errText}`);
                            }
                            await delay(200);
                        }
                    } catch (e) { console.error(`❌ [FB] Error: ${e.message}`); }
                }

                if (messageSent) await base44.asServiceRole.entities.Payment.update(payment.id, { bill_sent_date: new Date().toISOString() });
                }
                }

        const totalElapsed = Date.now() - startTime;
        const summary = `ส่งบิล ${lineSent} ราย (FB: ${fbSent}) [${Math.round(totalElapsed/1000)}s]`;
        console.log(`\n✅ ${summary}`);

        try {
            await delay(1000);
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'processInvoiceImageQueue',
                run_timestamp: new Date().toISOString(),
                status: 'success',
                message: summary,
                execution_time_ms: totalElapsed,
                details: { processed: paymentsToProcess.length, lineSent, fbSent, lineFailed, dbScanned: dbSkip }
            });
        } catch (e) {}

        return Response.json({ success: true, message: summary, lineSent, fbSent, lineFailed });

    } catch (error) {
        console.error('❌ Error:', error);
        if (base44) await base44.asServiceRole.entities.FunctionLog.create({ function_name: 'processInvoiceImageQueue', status: 'error', message: error.message }).catch(() => {});
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});