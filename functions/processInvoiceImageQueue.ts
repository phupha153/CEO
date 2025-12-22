import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * 💎 V5.0 ENTERPRISE SCALABLE EDITION (Fixed Design + White Background)
 * - แก้ไขเรื่องรูปพื้นหลังดำเรียบร้อย (บังคับพื้นขาวใน CSS + Browserless)
 * - ใช้ดีไซน์ใหม่ (Sarabun Font, Minimal Layout)
 * - ระบบส่งแจ้งเตือน LINE/FB เหมือนเดิม
 */

// ==========================================
// ⚙️ CONFIGURATION
// ==========================================
const CONFIG = {
    DEFAULT_BATCH_SIZE: 5,
    CONCURRENT_WORKERS: 2,
    MAX_EXECUTION_TIME_MS: 85000,
    RETRY_ATTEMPTS: 3,
    BROWSERLESS_TIMEOUT: 30000,
    ZOMBIE_THRESHOLD_MS: 30 * 60 * 1000
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 🛡️ UTILITIES
// ==========================================

async function callWithRetry(fn, context = '') {
    let lastError;
    for (let i = 0; i < CONFIG.RETRY_ATTEMPTS; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < CONFIG.RETRY_ATTEMPTS - 1) {
                const waitTime = 1000 * Math.pow(2, i);
                console.warn(`⚠️ [${context}] Retry ${i + 1} in ${waitTime}ms...`);
                await delay(waitTime);
            }
        }
    }
    throw lastError;
}

function generatePaymentHash(payment) {
    const dataToHash = {
        rent: payment.rent_amount || 0,
        water: { u: payment.water_units || 0, a: payment.water_amount || 0 },
        elec: { u: payment.electricity_units || 0, a: payment.electricity_amount || 0 },
        fees: {
            net: payment.internet_amount || 0,
            common: payment.common_fee_amount || 0,
            park: payment.parking_fee_amount || 0,
            other: payment.other_amount || 0,
            late: payment.late_fee_amount || 0
        },
        total: payment.total_amount || 0,
        due: payment.due_date || '',
        status: payment.status || 'pending'
    };
    return btoa(JSON.stringify(dataToHash)).substring(0, 32);
}

function numberToThaiText(number) {
    if (!number || isNaN(number) || number === 0) return 'ศูนย์บาทถ้วน';
    const numStr = number.toFixed(2);
    const [baht, satang] = numStr.split('.');
    const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    
    const convert = (s) => {
        let res = '';
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
    };
    
    let text = convert(baht) + 'บาท';
    if (parseInt(satang) > 0) text += convert(satang) + 'สตางค์';
    else text += 'ถ้วน';
    return text;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
    } catch { return '-'; }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ==========================================
// 📄 TEMPLATE SERVICE (แก้ดีไซน์ + พื้นหลังขาว)
// ==========================================
function generateInvoiceHTML(payment, tenant, room, recipient, bank, invoiceNo) {
    const issueDate = formatDate(new Date().toISOString());
    const dueDate = formatDate(payment.due_date);
    
    const items = [];
    if (payment.rent_amount > 0) items.push({ name: 'ค่าเช่า', qty: 1, price: payment.rent_amount });
    if (payment.electricity_amount > 0) items.push({ name: `ค่าไฟ (${payment.electricity_units || 0} หน่วย)`, qty: 1, price: payment.electricity_amount });
    if (payment.water_amount > 0) items.push({ name: `ค่าน้ำ (${payment.water_units || 0} หน่วย)`, qty: 1, price: payment.water_amount });
    if (payment.common_fee_amount > 0) items.push({ name: 'ค่าส่วนกลาง', qty: 1, price: payment.common_fee_amount });
    if (payment.parking_fee_amount > 0) items.push({ name: 'ค่าที่จอดรถ', qty: 1, price: payment.parking_fee_amount });
    if (payment.internet_amount > 0) items.push({ name: 'ค่าอินเทอร์เน็ต', qty: 1, price: payment.internet_amount });
    if (payment.other_amount > 0) items.push({ name: 'ค่าใช้จ่ายอื่นๆ', qty: 1, price: payment.other_amount });
    
    const lateFee = Number(payment.late_fee_amount || 0);
    if (lateFee > 0) {
        items.push({ name: 'ค่าปรับชำระล่าช้า', qty: 1, price: lateFee });
    }

    const total = items.reduce((sum, item) => sum + item.price, 0);

    return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
        <style>
            * { box-sizing: border-box; }
            body { 
                font-family: 'Sarabun', sans-serif; 
                margin: 0; 
                padding: 0; 
                background-color: #ffffff; /* ✅ สำคัญ: บังคับพื้นขาว */
                color: #000;
                -webkit-font-smoothing: antialiased;
            }
            .container { 
                width: 800px; 
                margin: 0 auto; 
                background-color: #ffffff; 
                padding: 50px;
                position: relative;
            }
            
            /* Logo & Header */
            .logo-section { text-align: center; margin-bottom: 30px; }
            .logo-img { height: 120px; object-fit: contain; }

            .brand-name {
                font-family: 'Playfair Display', serif;
                font-size: 24px;
                font-weight: bold;
                margin-bottom: 5px;
            }
            .brand-details { font-size: 12px; color: #333; margin-bottom: 40px; line-height: 1.4; }

            /* Title */
            .invoice-title { font-size: 18px; font-weight: bold; }
            .invoice-subtitle { font-size: 10px; letter-spacing: 1px; color: #666; margin-bottom: 25px; text-transform: uppercase; }

            /* Meta Data */
            .meta-row { display: flex; margin-bottom: 5px; font-size: 12px; }
            .meta-label { font-weight: bold; width: 120px; }

            /* Info Blocks */
            .info-block { margin-bottom: 25px; font-size: 12px; }
            .block-label { font-size: 11px; color: #555; font-weight: 600; margin-bottom: 5px; text-transform: uppercase; }
            
            /* Table */
            table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; font-size: 11px; }
            th { text-align: left; padding: 8px 0; border-bottom: 1px solid #ddd; font-weight: bold; }
            td { padding: 8px 0; vertical-align: top; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }

            /* Total */
            .total-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 10px; padding-top: 10px; border-top: 1px solid #000; }
            .thai-baht { font-size: 11px; color: #333; }
            .grand-total { font-size: 16px; font-weight: bold; color: #000; }

            /* Footer */
            .footer { margin-top: 50px; font-size: 10px; display: flex; justify-content: space-between; align-items: flex-end; }
            .footer-notes { margin-top: 20px; font-size: 9px; color: #555; line-height: 1.4; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo-section">
                <img src="${escapeHtml(recipient.building_logo)}" class="logo-img" />
            </div>

            <div class="brand-name">${escapeHtml(recipient.building_name)}</div>
            <div class="brand-details">
                ${escapeHtml(recipient.company_address)}
                ${recipient.tax_id ? `<br>เลขประจำตัวผู้เสียภาษี: ${escapeHtml(recipient.tax_id)}` : ''}
            </div>

            <div class="invoice-title">ใบแจ้งหนี้</div>
            <div class="invoice-subtitle">INVOICE</div>

            <div class="meta-row"><div class="meta-label">เลขที่:</div><div>${escapeHtml(invoiceNo)}</div></div>
            <div class="meta-row"><div class="meta-label">วันที่ออก:</div><div>${escapeHtml(issueDate)}</div></div>
            <div class="meta-row"><div class="meta-label">ครบกำหนด:</div><div>${escapeHtml(dueDate)}</div></div>

            <br>

            <div class="info-block">
                <div class="block-label">ผู้รับเงิน / RECEIVER</div>
                <div>${escapeHtml(recipient.lessor_name)}</div>
                <div>${escapeHtml(recipient.lessor_address)}</div>
            </div>

            <div class="info-block">
                <div class="block-label">ผู้จ่ายเงิน / PAYER</div>
                <div>${escapeHtml(tenant.full_name)}</div>
                <div>ห้อง: ${escapeHtml(room.room_number)}</div>
                <div>โทร: ${escapeHtml(tenant.phone || '-')}</div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th width="10%">ลำดับ</th>
                        <th width="45%">รายการ</th>
                        <th width="15%" class="text-center">จำนวน</th>
                        <th width="15%" class="text-right">ราคา/หน่วย</th>
                        <th width="15%" class="text-right">จำนวนเงิน</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map((item, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${escapeHtml(item.name)}</td>
                        <td class="text-center">${item.qty}</td>
                        <td class="text-right">${item.price.toLocaleString()}</td>
                        <td class="text-right">${item.price.toLocaleString()}</td>
                    </tr>`).join('')}
                </tbody>
            </table>

            <div class="total-row">
                <div class="thai-baht">รวมทั้งสิ้น (${numberToThaiText(total)})</div>
                <div class="grand-total">${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</div>
            </div>

            <div class="footer">
                <div>
                    <strong>ช่องทางการชำระเงิน</strong><br>
                    ธนาคาร: ${escapeHtml(bank.name)}<br>
                    เลขบัญชี: ${escapeHtml(bank.account_number)}<br>
                    ชื่อ: ${escapeHtml(bank.account_name)}
                </div>
                <div style="text-align:right; color:#aaa;">System Generated | ${escapeHtml(recipient.building_name)}</div>
            </div>

            <div class="footer-notes">
                <strong>หมายเหตุ:</strong><br>
                1. กรุณาชำระเงินภายในวันที่กำหนด<br>
                2. กรุณาแนบหลักฐานการโอนเงินทุกครั้ง
            </div>
        </div>
    </body>
    </html>`;
}

// ==========================================
// 🏭 IMAGE SERVICE (สร้างและอัปโหลดรูป)
// ==========================================
async function generateAndUploadImage(base44, paymentId, html) {
    const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
    if (!BROWSERLESS_API_KEY) throw new Error("API Key missing");

    // 1. เรียก Browserless
    const imageBlob = await callWithRetry(async () => {
        const res = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                html: html, 
                viewport: { width: 800, height: 1000 },
                // ⭐ แก้ไขสำคัญ: omitBackground: false (เพื่อให้ได้พื้นหลังขาว ไม่ทะลุ)
                options: { type: 'png', fullPage: true, omitBackground: false } 
            })
        });
        if (!res.ok) throw new Error(`Browserless Error: ${res.status}`);
        return await res.blob();
    }, 'Browserless');

    // 2. อัปโหลดไป Base44
    const fileUrl = await callWithRetry(async () => {
        const file = new File([imageBlob], `inv-${paymentId}.png`, { type: 'image/png' });
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        const url = uploadRes?.file_url || uploadRes?.url || uploadRes?.data?.fullPath;
        if (!url) throw new Error('Upload failed: No URL returned');
        return url;
    }, 'Upload');

    return fileUrl;
}

// ==========================================
// 🚀 MAIN WORKER
// ==========================================
Deno.serve(async (req) => {
    const startTime = Date.now();
    console.log(`🚀 WORKER STARTED: ${new Date().toISOString()}`);
    
    let base44;
    try {
        base44 = createClientFromRequest(req);
    } catch (e) { return new Response('Client Init Failed', { status: 500 }); }

    // 1. Parse Request Body
    let reqBody = {};
    try { reqBody = await req.json(); } catch (e) {}
    
    const batchSize = reqBody.batch_size || CONFIG.DEFAULT_BATCH_SIZE;
    const targetBranchId = reqBody.branch_id || null;

    // 2. Load Configs
    const configs = await base44.asServiceRole.entities.Config.list() || [];
    const getConfig = (key, branchId) => {
        const c = configs.find(x => x.key === key && x.branch_id === branchId) || configs.find(x => x.key === key && !x.branch_id);
        return c?.value || '';
    };
    
    // 3. Scan Payments
    const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : {};
    let paymentsToProcess = [];
    let dbSkip = 0;
    
    console.log(`🔍 Scanning payments...`);
    
    while (paymentsToProcess.length < batchSize) {
        if (Date.now() - startTime > 10000) break;

        const batch = await base44.asServiceRole.entities.Payment.filter(
            paymentFilter, '-updated_date', 100, dbSkip 
        );
        
        if (!batch || batch.length === 0) break;

        for (const p of batch) {
            if (p.status === 'paid' || p.status === 'cancelled') continue;

            const isUrlInvalid = !p.invoice_image_url || String(p.invoice_image_url).trim().length < 10;
            const isStatusHang = ['generating', 'failed'].includes(p.invoice_image_status);
            
            const lastUpdate = p.updated_date ? new Date(p.updated_date).getTime() : 0;
            const isZombie = p.invoice_image_status === 'generating' && (Date.now() - lastUpdate > CONFIG.ZOMBIE_THRESHOLD_MS);

            const currentHash = generatePaymentHash(p);
            const isDataChanged = p.invoice_data_hash !== currentHash;

            if (isUrlInvalid || isStatusHang || isDataChanged || isZombie) {
                if (!paymentsToProcess.find(x => x.id === p.id)) {
                    paymentsToProcess.push(p);
                }
            }
        }
        dbSkip += batch.length;
        if (dbSkip > 2000) break;
    }

    console.log(`📊 Job Queue: ${paymentsToProcess.length} items`);
    if (paymentsToProcess.length === 0) return Response.json({ status: 'idle', message: 'No jobs found' });

    // 4. Process Loop
    let processed = 0, success = 0, failed = 0;
    
    const cache = { tenants: {}, rooms: {} };
    async function getEntity(type, id) {
        if (!id) return {};
        if (cache[type][id]) return cache[type][id];
        const res = await base44.asServiceRole.entities[type === 'tenants' ? 'Tenant' : 'Room'].filter({ id });
        const item = res[0] || {};
        cache[type][id] = item;
        return item;
    }

    const worker = async (payment) => {
        if (Date.now() - startTime > CONFIG.MAX_EXECUTION_TIME_MS) return;

        try {
            await delay(200); 

            const t = await getEntity('tenants', payment.tenant_id);
            const r = await getEntity('rooms', payment.room_id);
            const branchName = getConfig('building_name', payment.branch_id) || `Branch-${payment.branch_id}`;

            console.log(`⚙️ เริ่มงาน: [${branchName}] ห้อง ${r.room_number || '?'} (${payment.id})`);

            await base44.asServiceRole.entities.Payment.update(payment.id, { invoice_image_status: 'generating' });
            
            const recipient = {
                building_name: getConfig('building_name', payment.branch_id) || branchName,
                building_logo: getConfig('building_logo', payment.branch_id) || 'https://via.placeholder.com/150',
                company_address: getConfig('company_address', payment.branch_id) || getConfig('building_address', payment.branch_id) || 'Bangkok, Thailand',
                lessor_name: getConfig('lessor_name', payment.branch_id) || 'นิติบุคคล',
                lessor_address: getConfig('lessor_address', payment.branch_id) || '',
                tax_id: getConfig('company_tax_id', payment.branch_id) || getConfig('tax_id', payment.branch_id) || '',
                building_phone: getConfig('contact_phone', payment.branch_id) || ''
            };
            const bank = {
                name: getConfig('bank_name', payment.branch_id) || 'ธนาคาร',
                account_number: getConfig('bank_account_number', payment.branch_id) || '-',
                account_name: getConfig('bank_account_name', payment.branch_id) || '-'
            };

            // สร้างรูป
            const invoiceNo = `INV-${payment.id.slice(0,6).toUpperCase()}`;
            const html = generateInvoiceHTML(payment, t, r, recipient, bank, invoiceNo); 
            const imageUrl = await generateAndUploadImage(base44, payment.id, html);
            
            console.log(`📸 รูปเสร็จแล้ว: ${imageUrl}`);

            // สร้างข้อความ
            let message = `📢 แจ้งเตือนค่าเช่า\n${recipient.building_name}\n`;
            message += `สวัสดีคุณ ${t.full_name}\nห้อง ${r.room_number || 'N/A'}\n\n`;
            message += `🧾 รายละเอียด:\n`;
            if (payment.rent_amount > 0) message += `• ค่าเช่า: ${payment.rent_amount.toLocaleString()} บ.\n`;
            if (payment.electricity_amount > 0) message += `• ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บ.\n`;
            if (payment.water_amount > 0) message += `• ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บ.\n`;
            if (payment.common_fee_amount > 0) message += `• ส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บ.\n`;
            if (payment.parking_fee_amount > 0) message += `• จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บ.\n`;
            if (payment.internet_amount > 0) message += `• เน็ต: ${payment.internet_amount.toLocaleString()} บ.\n`;
            if (payment.other_amount > 0) message += `• อื่นๆ: ${payment.other_amount.toLocaleString()} บ.\n`;
            if (payment.late_fee_amount > 0) message += `• ค่าปรับ: ${payment.late_fee_amount.toLocaleString()} บ.\n`;
            message += `--------------------\n`;
            message += `💰 ยอดรวม: ${payment.total_amount.toLocaleString()} บาท\n`;
            message += `(${numberToThaiText(payment.total_amount)})\n\n`;
            message += `📅 ครบกำหนด: ${new Date(payment.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}\n`;
            message += `💳 โอนเงิน: ${bank.name} ${bank.account_number}\n(${bank.account_name})\n\n`;
            if (imageUrl) message += `📄 ดูบิล: ${imageUrl}\n\n`;
            message += `📸 โอนแล้วรบกวนส่งสลิปนะคะ ขอบคุณค่ะ 🙏`;

            const autoSend = getConfig('auto_send_bills_after_generation', payment.branch_id);
            const lineToken = getConfig('line_channel_access_token', payment.branch_id);
            const fbToken = getConfig('facebook_page_access_token', payment.branch_id);
            
            let sent = false;
            let logMsg = "";

            if (autoSend !== 'true') logMsg = `ข้าม: Config ปิดอยู่`;
            else if (payment.bill_sent_date) logMsg = `ข้าม: เคยส่งแล้ว`;
            else {
                console.log(`📤 เริ่มส่งข้อความ...`);
                
                // LINE Check
                if (t.line_user_id) {
                    if (lineToken) {
                        try {
                            const res = await fetch('https://api.line.me/v2/bot/message/push', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json', 'Authorization': `Bearer ${lineToken}`},
                                body: JSON.stringify({to: t.line_user_id, messages: [{type: 'text', text: message}]})
                            });
                            if (res.ok) sent = true;
                        } catch(e) {}
                    }
                }

                // FB Check
                if (t.facebook_user_id) {
                    if (fbToken) {
                        try {
                            const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${fbToken}`, {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({ recipient: { id: t.facebook_user_id }, message: { text: message }, messaging_type: 'MESSAGE_TAG', tag: 'CONFIRMED_EVENT_UPDATE' })
                            });
                            if (res.ok) sent = true;
                        } catch(e) {}
                    }
                }

                if (sent) logMsg = `✅ ส่งสำเร็จ`;
                else logMsg = `❌ ส่งไม่ผ่าน`;
            }
            console.log(logMsg);

            await base44.asServiceRole.entities.Payment.update(payment.id, {
                invoice_image_url: imageUrl,
                invoice_image_status: 'completed',
                invoice_data_hash: generatePaymentHash(payment),
                bill_sent_date: sent ? new Date().toISOString() : (payment.bill_sent_date || null),
                updated_date: new Date().toISOString()
            });

            success++;
            console.log(`🏁 จบงานห้อง ${r.room_number}`);

        } catch (e) {
            console.error(`❌ พังที่ห้อง ${payment.room_id}: ${e.message}`);
            if (e.message.includes('429')) await delay(5000);
            
            await base44.asServiceRole.entities.Payment.update(payment.id, { 
                invoice_image_status: 'failed',
                updated_date: new Date().toISOString()
            });
            failed++;
        } finally {
            processed++;
        }
    };

    // Execute batch
    const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
    const batches = chunk(paymentsToProcess, CONFIG.CONCURRENT_WORKERS);

    for (const batch of batches) {
        if (Date.now() - startTime > CONFIG.MAX_EXECUTION_TIME_MS) break;
        await Promise.all(batch.map(p => worker(p)));
    }

    const resultSummary = {
        status: 'completed',
        processed,
        success,
        failed,
        time_ms: Date.now() - startTime
    };

    console.log('🏁 SUMMARY:', JSON.stringify(resultSummary));
    
    try {
        await base44.asServiceRole.entities.FunctionLog.create({
            function_name: 'invoice_generator_v5',
            status: failed > 0 ? 'warning' : 'success',
            message: `Processed ${processed} bills`,
            details: resultSummary,
            run_timestamp: new Date().toISOString()
        });
    } catch(e) {}

    return Response.json(resultSummary);
});