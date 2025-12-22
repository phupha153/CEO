import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * 💎 V5.0 ENTERPRISE SCALABLE EDITION
 * ระบบสร้างใบแจ้งหนี้อัตโนมัติพร้อมระบบป้องกันความผิดพลาดระดับสูง
 * * Features:
 * - Smart Retry Strategy: ลองใหม่เมื่อ API ล่ม
 * - Time Budgeting: หยุดทำงานอย่างนิ่มนวลเมื่อใกล้หมดเวลา
 * - Aggressive Scan: ค้นหาบิลที่ค้างอยู่ได้แม่นยำ
 * - Modular Code: แยกส่วนชัดเจน แก้ไขง่าย
 */

// ==========================================
// ⚙️ CONFIGURATION & CONSTANTS
// ==========================================
const CONFIG = {
    DEFAULT_BATCH_SIZE: 5,      // จำนวนบิลที่จะทำใน 1 รอบ
    CONCURRENT_WORKERS: 2,       // ทำพร้อมกันกี่งาน (แนะนำ 1-3 เพื่อกัน Rate Limit)
    MAX_EXECUTION_TIME_MS: 85000,// เวลาสูงสุดที่ให้ทำงาน (85 วินาที) ก่อนตัดจบ
    RETRY_ATTEMPTS: 3,           // จำนวนครั้งที่จะลองใหม่ถ้า Error
    BROWSERLESS_TIMEOUT: 30000,  // รอรูปนานสุด 30 วินาที
    ZOMBIE_THRESHOLD_MS: 30 * 60 * 1000 // 30 นาที ถือว่าเป็นบิลค้างเก่า
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 🛡️ UTILITIES (เครื่องมือช่วย)
// ==========================================

/**
 * เรียกฟังก์ชันแบบมีระบบลองใหม่ (Retry) ถ้าเจอ Error ชั่วคราว
 */
async function callWithRetry(fn, context = '') {
    let lastError;
    for (let i = 0; i < CONFIG.RETRY_ATTEMPTS; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const isRateLimit = error.message?.includes('429') || error.message?.includes('Too Many Requests');
            if (i < CONFIG.RETRY_ATTEMPTS - 1) {
                const waitTime = 1000 * Math.pow(2, i); // รอ 1s, 2s, 4s...
                console.warn(`⚠️ [${context}] Retry ${i + 1}/${CONFIG.RETRY_ATTEMPTS} in ${waitTime}ms... (${error.message})`);
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
// 📄 TEMPLATE SERVICE (ส่วนสร้าง HTML)
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
    if (Number(payment.late_fee_amount) > 0) items.push({ name: 'ค่าปรับชำระล่าช้า', qty: 1, price: Number(payment.late_fee_amount) });

    const total = items.reduce((sum, item) => sum + item.price, 0);

    return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
            * { box-sizing: border-box; }
            body { font-family: 'Sarabun', sans-serif; padding: 40px; background: #fff; color: #333; }
            .container { max-width: 800px; margin: 0 auto; background: white; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
            .logo-section { display: flex; gap: 15px; width: 75%; }
            .logo { width: 50px; height: 50px; object-fit: contain; margin-top: 5px; }
            .brand-info h1 { font-size: 18px; font-weight: bold; margin: 0 0 8px 0; color: #1e293b; }
            .brand-info .company-name { font-weight: 600; color: #1e293b; font-size: 12px; margin-bottom: 2px; }
            .brand-info .company-details { font-size: 11px; color: #475569; line-height: 1.4; }
            .invoice-label { text-align: right; width: 25%; }
            .invoice-label h2 { font-size: 20px; color: #2563eb; font-weight: bold; margin: 0; }
            .invoice-label span { font-size: 12px; color: #2563eb; font-weight: 600; letter-spacing: 1px; }
            .meta-bar { display: flex; justify-content: space-between; background: #f8fafc; padding: 10px 15px; border-radius: 6px; margin-bottom: 20px; border: 1px solid #e2e8f0; }
            .meta-item { font-size: 12px; }
            .meta-item strong { color: #64748b; margin-right: 5px; }
            .meta-item span { font-weight: 600; color: #1e293b; }
            .due-date { color: #dc2626 !important; }
            .info-grid { display: flex; gap: 20px; margin-bottom: 25px; }
            .info-box { flex: 1; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; background: #fff; }
            .box-header { font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; padding-bottom: 4px; }
            .box-content .name { font-size: 13px; font-weight: bold; color: #0f172a; margin-bottom: 4px; }
            .box-content p { font-size: 12px; color: #475569; margin: 0 0 2px 0; line-height: 1.4; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 12px; }
            th { text-align: left; padding: 10px; background-color: #f8fafc; color: #475569; font-weight: 600; border-bottom: 2px solid #cbd5e1; }
            td { padding: 12px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #1e293b; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .col-total { font-weight: 600; }
            .total-section { display: flex; justify-content: flex-end; margin-bottom: 25px; }
            .total-box { text-align: right; border-top: 2px solid #cbd5e1; padding-top: 10px; min-width: 250px; }
            .total-label { font-size: 13px; font-weight: bold; color: #1e293b; margin-right: 15px; }
            .total-amount { font-size: 22px; font-weight: bold; color: #2563eb; }
            .thai-baht { font-size: 12px; color: #64748b; font-style: italic; margin-top: 5px; }
            .payment-box { background: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 15px; margin-bottom: 20px; font-size: 12px; display: flex; align-items: center; gap: 12px; }
            .payment-icon { font-size: 18px; }
            .payment-info span { margin-right: 15px; color: #334155; }
            .payment-info strong { color: #1e293b; font-weight: 600; }
            .notes { font-size: 11px; color: #94a3b8; padding-top: 15px; border-top: 1px solid #e2e8f0; line-height: 1.6; }
            .credit { text-align: center; margin-top: 20px; font-size: 10px; color: #cbd5e1; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="logo-section">
                    <img src="${escapeHtml(recipient.building_logo || 'https://via.placeholder.com/100x100?text=Logo')}" class="logo" />
                    <div class="brand-info">
                        <h1>${escapeHtml(recipient.building_name || 'Apartment')}</h1>
                        <div class="company-details">
                            <div class="company-name">${escapeHtml(recipient.company_name || recipient.lessor_name || '')}</div>
                            <div>${escapeHtml(recipient.company_address || recipient.lessor_address || '')}</div>
                            ${recipient.tax_id ? `<div>Tax ID: ${escapeHtml(recipient.tax_id)}</div>` : ''}
                        </div>
                    </div>
                </div>
                <div class="invoice-label">
                    <h2>ใบแจ้งหนี้</h2>
                    <span>INVOICE</span>
                </div>
            </div>

            <div class="meta-bar">
                <div class="meta-item"><strong>เลขที่:</strong> <span>${escapeHtml(invoiceNo)}</span></div>
                <div class="meta-item"><strong>วันที่ออก:</strong> <span>${escapeHtml(issueDate)}</span></div>
                <div class="meta-item"><strong>ครบกำหนด:</strong> <span class="due-date">${escapeHtml(dueDate)}</span></div>
            </div>

            <div class="info-grid">
                <div class="info-box">
                    <div class="box-header">ผู้รับเงิน / RECEIVER</div>
                    <div class="box-content">
                        <div class="name">${escapeHtml(recipient.lessor_name || '')}</div>
                        <p>${escapeHtml(recipient.lessor_address || '')}</p>
                    </div>
                </div>
                <div class="info-box">
                    <div class="box-header">ผู้จ่ายเงิน / PAYER</div>
                    <div class="box-content">
                        <div class="name">${escapeHtml(tenant.full_name || 'ไม่ระบุชื่อ')}</div>
                        <p>ห้อง: ${escapeHtml(room.room_number || '-')}</p>
                        <p>โทร: ${escapeHtml(tenant.phone || '-')}</p>
                    </div>
                </div>
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
                        <td class="text-right">${item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                        <td class="text-right col-total">${item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="total-section">
                <div class="total-box">
                    <span class="total-label">รวมทั้งสิ้น</span>
                    <span class="total-amount">${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
                    <div class="thai-baht">(${numberToThaiText(total)})</div>
                </div>
            </div>

            <div class="payment-box">
                <span class="payment-icon">💳</span>
                <div class="payment-info">
                    <span>ช่องทางการชำระเงิน</span>
                    <span>ธนาคาร: <strong>${escapeHtml(bank.name || 'กสิกรไทย')}</strong></span>
                    <span>เลขบัญชี: <strong>${escapeHtml(bank.account_number || '-')}</strong></span>
                    <span>ชื่อ: <strong>${escapeHtml(bank.account_name || '-')}</strong></span>
                </div>
            </div>

            <div class="notes">
                <strong>หมายเหตุ:</strong><br>
                1. กรุณาชำระเงินภายในวันที่กำหนด<br>
                2. กรุณาแนบหลักฐานการโอนเงินทุกครั้ง
            </div>

            <div class="credit">
                System Generated | ${escapeHtml(recipient.building_name)}
            </div>
        </div>
    </body>
    </html>
    `;
}

// ==========================================
// 🏭 IMAGE SERVICE (สร้างและอัปโหลดรูป)
// ==========================================
async function generateAndUploadImage(base44, paymentId, html) {
    const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
    if (!BROWSERLESS_API_KEY) throw new Error("API Key missing");

    // 1. เรียก Browserless (พร้อม Retry)
    const imageBlob = await callWithRetry(async () => {
        const res = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                html: html, 
                viewport: { width: 800, height: 1000 },
                options: { type: 'png', fullPage: true, omitBackground: true },
                gotoOptions: { waitUntil: 'networkidle0', timeout: CONFIG.BROWSERLESS_TIMEOUT }
            })
        });
        if (!res.ok) throw new Error(`Browserless Error: ${res.status}`);
        return await res.blob();
    }, 'Browserless');

    // 2. อัปโหลดไป Base44 (พร้อม Retry)
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
// 📨 NOTIFICATION SERVICE (ส่งไลน์/เฟส)
// ==========================================
async function sendNotification(payment, tenant, room, recipient, bank, imageUrl, configs) {
    const getConfig = (key) => {
        const branchConf = configs.find(c => c.key === key && c.branch_id === payment.branch_id);
        const globalConf = configs.find(c => c.key === key && !c.branch_id);
        return (branchConf || globalConf)?.value || '';
    };

    const autoSend = getConfig('auto_send_bills_after_generation') === 'true';
    if (!autoSend || payment.bill_sent_date) return false;

    // สร้างข้อความ
    let msg = `📢 แจ้งเตือนค่าเช่า\n`;
    msg += ` ${recipient.building_name || 'หอพัก'}\n`;
    msg += ` คุณ ${tenant.full_name} (ห้อง ${room?.room_number || '-'}) \n\n`;
    msg += `💰 ยอดรวม: ${payment.total_amount.toLocaleString()} บาท\n`;
    msg += `📅 ครบกำหนด: ${formatDate(payment.due_date)}\n\n`;
    msg += `🏦 ${bank.name || 'KBANK'} ${bank.account_number || '-'}\n`;
    msg += `👤 ${bank.account_name || '-'}\n\n`;
    if (imageUrl) msg += `📄 ดูบิล: ${imageUrl}\n\n`;
    msg += `📸 โอนแล้วรบกวนส่งสลิปนะคะ`;

    let sent = false;

    // ส่ง LINE
    if (tenant.line_user_id) {
        const token = getConfig('line_channel_access_token');
        if (token) {
            try {
                await fetch('https://api.line.me/v2/bot/message/push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ to: tenant.line_user_id, messages: [{ type: 'text', text: msg }] })
                });
                sent = true;
                console.log(`✅ LINE sent to ${room.room_number}`);
            } catch (e) { console.error('LINE Failed', e); }
        }
    }

    // ส่ง Facebook
    if (tenant.facebook_user_id) {
        const token = getConfig('facebook_page_access_token');
        if (token) {
            try {
                await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${token}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recipient: { id: tenant.facebook_user_id }, message: { text: msg }, messaging_type: 'MESSAGE_TAG', tag: 'CONFIRMED_EVENT_UPDATE' })
                });
                sent = true;
                console.log(`✅ FB sent to ${room.room_number}`);
            } catch (e) { console.error('FB Failed', e); }
        }
    }

    return sent;
}

// ==========================================
// 🚀 MAIN WORKER (ตัวควบคุมหลัก)
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
    const skipNotify = reqBody.skip_line_send === true;

    // 2. Load Configs & Data
    const configs = await base44.asServiceRole.entities.Config.list() || [];
const getConfig = (key, branchId) => {
        const c = configs.find(x => x.key === key && x.branch_id === branchId) || configs.find(x => x.key === key && !x.branch_id);
        return c?.value || '';
    };
    
    // 3. Scan Payments (Aggressive Filter)
    const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : {};
    let paymentsToProcess = [];
    let dbSkip = 0;
    
    console.log(`🔍 Scanning payments...`);
    
    // Loop ดึงข้อมูลจนกว่าจะได้ Job ครบตาม batchSize หรือหมด DB
    while (paymentsToProcess.length < batchSize) {
        if (Date.now() - startTime > 10000) break; // อย่า Scan นานเกิน 10 วิ

        const batch = await base44.asServiceRole.entities.Payment.filter(
            paymentFilter, '-updated_date', 100, dbSkip // ดึงทีละ 100
        );
        
        if (!batch || batch.length === 0) break;

        for (const p of batch) {
            if (p.status === 'paid' || p.status === 'cancelled') continue;

            // Logic ตรวจจับบิลที่ต้องทำ (รวมถึงพวกที่ค้าง, URL ว่าง, URL เป็น space)
            const isUrlInvalid = !p.invoice_image_url || String(p.invoice_image_url).trim().length < 10;
            const isStatusHang = ['generating', 'failed'].includes(p.invoice_image_status);
            
            // Hash check
            const currentHash = generatePaymentHash(p);
            const isDataChanged = p.invoice_data_hash !== currentHash;

            if (isUrlInvalid || isStatusHang || isDataChanged) {
                // ป้องกัน Duplicate
                if (!paymentsToProcess.find(x => x.id === p.id)) {
                    paymentsToProcess.push(p);
                }
            }
        }
        dbSkip += batch.length;
        if (dbSkip > 2000) break; // Hard limit scan
    }

    console.log(`📊 Job Queue: ${paymentsToProcess.length} items`);
    if (paymentsToProcess.length === 0) return Response.json({ status: 'idle', message: 'No jobs found' });

    // 4. Process Loop (Concurrency Control)
    let processed = 0, success = 0, failed = 0;
    
    // Helper สำหรับดึง Tenant/Room แบบ Lazy (Cache ในตัวแปร)
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
        // เช็คเวลา ถ้าใกล้หมดเวลาให้หยุด
        if (Date.now() - startTime > CONFIG.MAX_EXECUTION_TIME_MS) return;

        try {
            // ⭐ 1. พัก 2 วินาที (แก้ปัญหา Rate Limit 429)
            await delay(2000);

            // ดึงข้อมูล
            const t = await getEntity('tenants', payment.tenant_id);
            const r = await getEntity('rooms', payment.room_id);
            const branchName = getConfig('building_name', payment.branch_id) || `Branch-${payment.branch_id}`;

            console.log(`--------------------------------------------------`);
            console.log(`⚙️ เริ่มงาน: [${branchName}] ห้อง ${r.room_number || '?'} (${payment.id})`);

            // อัปเดตสถานะ
            await base44.asServiceRole.entities.Payment.update(payment.id, { invoice_image_status: 'generating' });
            
            const recipient = {
                building_name: branchName,
                building_logo: 'https://via.placeholder.com/150',
                company_address: 'Bangkok, Thailand',
                lessor_name: 'นิติบุคคล'
            };
            const bank = {
                name: getConfig('bank_name', payment.branch_id),
                account_number: getConfig('bank_account_number', payment.branch_id),
                account_name: getConfig('bank_account_name', payment.branch_id)
            };

            // สร้างรูป
            const invoiceNo = `INV-${payment.id.slice(0,6).toUpperCase()}`;
            const html = generateInvoiceHTML(payment, t, r, recipient, bank, invoiceNo);
            const imageUrl = await generateAndUploadImage(base44, payment.id, html);
            console.log(`📸 สร้างรูปเสร็จ: ${imageUrl ? 'OK' : 'Failed'}`);

            // ⭐ 2. ระบบนักสืบ (เช็คละเอียดว่าทำไมไม่ส่งไลน์)
            const autoSend = getConfig('auto_send_bills_after_generation', payment.branch_id);
            const lineToken = getConfig('line_channel_access_token', payment.branch_id);
            
            let sent = false;
            let logReason = "";

            if (autoSend !== 'true') {
                logReason = `❌ ไม่ส่ง: Config ปิดอยู่ (ค่าปัจจุบันคือ "${autoSend}" ต้องแก้เป็น "true")`;
            } else if (payment.bill_sent_date) {
                logReason = `⚠️ ไม่ส่ง: เคยส่งไปแล้วเมื่อ ${payment.bill_sent_date}`;
            } else if (!t.line_user_id) {
                logReason = `⚠️ ไม่ส่ง: ผู้เช่าไม่มี LINE ID`;
            } else if (!lineToken) {
                logReason = `❌ ไม่ส่ง: ไม่มี Token ใน Config`;
            } else {
                // ถ้าผ่านทุกด่าน ถึงจะส่ง
                console.log(`📤 กำลังส่ง LINE หาคุณ ${t.full_name}...`);
                sent = await sendNotification(payment, t, r, recipient, bank, imageUrl, configs);
                logReason = sent ? "✅ ส่ง LINE สำเร็จ" : "❌ ส่งไม่ผ่าน (API Error)";
            }
            console.log(`📝 ผลการส่งไลน์: ${logReason}`);

            // บันทึกผล
            await base44.asServiceRole.entities.Payment.update(payment.id, {
                invoice_image_url: imageUrl,
                invoice_image_status: 'completed',
                invoice_data_hash: generatePaymentHash(payment),
                bill_sent_date: sent ? new Date().toISOString() : (payment.bill_sent_date || null),
                updated_date: new Date().toISOString()
            });

            success++;
            console.log(`🏁 เสร็จสิ้น ห้อง ${r.room_number}`);

        } catch (e) {
            console.error(`❌ พังที่ห้อง ${payment.room_id}: ${e.message}`);
            // ถ้าโดนบล็อก ให้พักยาว 5 วิ
            if (e.message.includes('429')) {
                console.log('⚠️ เจอ Rate Limit! พัก 5 วินาที...');
                await delay(5000);
            }
            
            await base44.asServiceRole.entities.Payment.update(payment.id, { 
                invoice_image_status: 'failed',
                updated_date: new Date().toISOString()
            });
            failed++;
        } finally {
            processed++;
        }
    };

    // Execute batch with concurrency limit
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
    
    // Optional: Log to FunctionLog Entity if exists
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