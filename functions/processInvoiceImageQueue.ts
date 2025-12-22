import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * 💎 V5.1 FINAL FULL CODE (Lazy Load + Auto Retry + Full HTML)
 * - แก้ปัญหา 429: Lazy Load (ดึงเมื่อใช้)
 * - แก้ปัญหา 500: Auto Retry (ลองใหม่เมื่อล่ม)
 * - HTML: ครบถ้วนทุกบรรทัด
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 🛡️ 1. ULTRA SAFE WRAPPER (ระบบป้องกัน Error)
// ==========================================
async function callWithRetry(fn, operationName = 'Operation') {
    const maxRetries = 5;
    let attempt = 0;
    
    while (attempt < maxRetries) {
        try {
            return await fn();
        } catch (error) {
            // เช็คว่าเป็น Error ที่ควรลองใหม่หรือไม่
            const isRateLimit = error.message?.includes('Rate limit') || 
                                error.message?.includes('429') ||
                                (error.body && JSON.stringify(error.body).includes('Rate limit'));
            
            const isServerError = error.message?.includes('500') || error.message?.includes('502') || error.message?.includes('503');
            const isBrowserlessError = error.message?.includes('Browserless');

            if (isRateLimit || isServerError || isBrowserlessError || attempt < 3) { 
                attempt++;
                // สูตรคำนวณเวลารอแบบทวีคูณ: 2วิ, 4วิ, 8วิ, 16วิ...
                const waitTime = 2000 * Math.pow(2, attempt); 
                console.warn(`⚠️ [${operationName}] Error (Attempt ${attempt}/${maxRetries}). Waiting ${waitTime/1000}s...`);
                await delay(waitTime);
            } else {
                console.error(`❌ [${operationName}] Failed after ${maxRetries} attempts: ${error.message}`);
                throw error; // ยอมแพ้ ส่ง Error กลับไป
            }
        }
    }
}

// ==========================================
// 🛠️ 2. HELPER FUNCTIONS
// ==========================================

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
    return btoa(JSON.stringify(dataToHash)).substring(0, 32);
}

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

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
    } catch { return '-'; }
}

// ==========================================
// 📸 3. GENERATE INVOICE FUNCTION (HTML ครบ)
// ==========================================
async function generateInvoiceScreenshot(base44, paymentId, invoice) {
    const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
    if (!BROWSERLESS_API_KEY) throw new Error("BROWSERLESS_API_KEY not set");

    const payment = invoice;
    const recipient = invoice.recipient || {};
    const tenant = invoice.tenant || {};
    const room = invoice.room || {};
    const bank = invoice.bank || {};

    const invoiceNo = `INV-${payment.id.slice(0, 8).toUpperCase()}`;
    const issueDate = formatDate(new Date().toISOString());
    const dueDate = formatDate(payment.due_date);
    const logoUrl = recipient.building_logo || 'https://via.placeholder.com/100x100?text=Logo';
    const buildingName = recipient.building_name || 'Double Residence';
    const displayLessorName = recipient.company_name || recipient.lessor_name || 'ไม่ระบุชื่อผู้รับเงิน';
    const displayLessorAddress = recipient.company_address || recipient.lessor_address || '';
    const displayTaxId = recipient.company_tax_id || recipient.tax_id || '';

    const items = [];
    if (payment.rent_amount > 0) items.push({ name: 'ค่าเช่า', qty: 1, price: payment.rent_amount });
    if (payment.electricity_amount > 0) items.push({ name: `ค่าไฟ (${payment.electricity_units || 0} หน่วย)`, qty: 1, price: payment.electricity_amount });
    if (payment.water_amount > 0) items.push({ name: `ค่าน้ำ (${payment.water_units || 0} หน่วย)`, qty: 1, price: payment.water_amount });
    if (payment.common_fee_amount > 0) items.push({ name: 'ค่าส่วนกลาง', qty: 1, price: payment.common_fee_amount });
    if (payment.parking_fee_amount > 0) items.push({ name: 'ค่าที่จอดรถ', qty: 1, price: payment.parking_fee_amount });
    if (payment.internet_amount > 0) items.push({ name: 'ค่าอินเทอร์เน็ต', qty: 1, price: payment.internet_amount });
    if (payment.other_amount > 0) items.push({ name: 'ค่าใช้จ่ายอื่นๆ', qty: 1, price: payment.other_amount });
    if (Number(payment.late_fee_amount) > 0) items.push({ name: 'ค่าปรับชำระล่าช้า', qty: 1, price: Number(payment.late_fee_amount) });

    const finalTotalAmount = items.reduce((sum, item) => sum + item.price, 0);
    const totalText = numberToThaiText(finalTotalAmount);

    function escapeHtml(text) {
        if (!text) return '';
        return text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // --- เริ่มต้น HTML TEMPLATE ---
    const htmlContent = `
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
                    <img src="${escapeHtml(logoUrl)}" class="logo" />
                    <div class="brand-info">
                        <h1>${escapeHtml(buildingName)}</h1>
                        <div class="company-details">
                            <div class="company-name">${escapeHtml(displayLessorName)}</div>
                            <div>${escapeHtml(displayLessorAddress)}</div>
                            ${displayTaxId ? `<div>เลขประจำตัวผู้เสียภาษี: ${escapeHtml(displayTaxId)}</div>` : ''}
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
                        <div class="name">${escapeHtml(displayLessorName)}</div>
                        <p>${escapeHtml(displayLessorAddress)}</p>
                        ${displayTaxId ? `<p>เลขประจำตัวผู้เสียภาษี: ${escapeHtml(displayTaxId)}</p>` : ''}
                    </div>
                </div>
                <div class="info-box">
                    <div class="box-header">ผู้จ่ายเงิน / PAYER</div>
                    <div class="box-content">
                        <div class="name">${escapeHtml(tenant.full_name || 'ไม่ระบุชื่อ')}</div>
                        <p>ห้อง: ${escapeHtml(room.room_number || '-')}</p>
                        <p>โทร: ${escapeHtml(tenant.phone || '-')}</p>
                        <p>ที่อยู่: ${escapeHtml(tenant.address || 'ไม่ระบุ')}</p>
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
                        <td class="text-right">${(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                        <td class="text-right col-total">${(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="total-section">
                <div class="total-box">
                    <span class="total-label">รวมทั้งสิ้น</span>
                    <span class="total-amount">${finalTotalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
                    <div class="thai-baht">(${totalText})</div>
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
                2. กรุณาแนบหลักฐานการโอนเงินทุกครั้ง<br>
                3. หากมีข้อสงสัยกรุณาติดต่อเจ้าของหอพัก
            </div>

            <div class="credit">
                เอกสารนี้สร้างโดยระบบอัตโนมัติ | ${escapeHtml(buildingName)}
            </div>
        </div>
    </body>
    </html>
    `;
    // --- สิ้นสุด HTML TEMPLATE ---

    // เรียก Browserless ผ่าน Retry
    return await callWithRetry(async () => {
        const browserlessResponse = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                html: htmlContent, 
                viewport: { width: 800, height: 1000 },
                options: { type: 'png', fullPage: true, omitBackground: true },
                gotoOptions: { waitUntil: 'networkidle0', timeout: 30000 }
            })
        });

        if (!browserlessResponse.ok) {
            const txt = await browserlessResponse.text();
            throw new Error(`Browserless Error ${browserlessResponse.status}: ${txt}`);
        }
        
        const imageBlob = await browserlessResponse.blob();
        const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });
        
        await delay(500); // พักก่อน Upload เพื่อความชัวร์
        
        const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file: imageFile });
        return uploadResult?.file_url || uploadResult?.url || uploadResult?.path || uploadResult?.data?.fullPath;
    }, 'GenerateScreenshot');
}

// ==========================================
// 🚀 4. MAIN QUEUE WORKER
// ==========================================

Deno.serve(async (req) => {
    console.log('========================================');
    console.log('🖼️ PROCESS INVOICE V5.1 (LAZY+RETRY)');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log('========================================');

    const startTime = Date.now();
    let base44 = null;
    let targetBranchId = null;
    
    let batchSize = 20; // ⚠️ Limit 20 เพื่อความปลอดภัย
    let skipLineSend = false;
    let maxRunTime = 85000; 

    try {
        const clonedReq = req.clone();
        base44 = createClientFromRequest(req);

        try {
            const text = await clonedReq.text();
            if (text && text.trim()) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
                if (body.batch_size && body.batch_size < 50) batchSize = body.batch_size;
                skipLineSend = body.skip_line_send === true;
            }
        } catch (e) { }

        // Load Configs (ใช้ callWithRetry)
        const configs = await callWithRetry(() => base44.asServiceRole.entities.Config.list(), 'LoadConfig') || [];
        
        const getConfigValue = (key, branchId, defaultValue = '') => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig?.value) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        const paymentFilter = {
            ...(targetBranchId ? { branch_id: targetBranchId } : {}),
            status: 'pending' 
        };
        
        let paymentsToProcess = [];
        
        // 🔥 PHASE 1: Scan Payments (ใช้ callWithRetry)
        console.log(`📥 Scanning jobs...`);
        const batch = await callWithRetry(() => 
            base44.asServiceRole.entities.Payment.filter(paymentFilter, '-updated_date', batchSize, 0)
        , 'ScanPayment');

        if (!batch || batch.length === 0) {
            return Response.json({ success: true, message: 'ไม่มีบิลที่ต้องทำ', processed: 0 });
        }

        // Filter Logic
        for (const p of batch) {
            if (p.status === 'paid' || p.status === 'cancelled') continue;
            
            const ZOMBIE_THRESHOLD_MS = 30 * 60 * 1000; 
            const lastUpdate = p.updated_date ? new Date(p.updated_date).getTime() : 0;
            
            const needsImage = !p.invoice_image_url || p.invoice_image_status === 'pending' || !p.invoice_image_status;
            
            let needsRegenerate = false;
            if (p.invoice_image_url && p.invoice_data_hash) {
                if (generatePaymentHash(p) !== p.invoice_data_hash) needsRegenerate = true;
            }
            
            const autoSendEnabled = getConfigValue('auto_send_bills_after_generation', p.branch_id, 'false') === 'true';
            const needsSend = autoSendEnabled && !p.bill_sent_date;

            if (needsImage || needsRegenerate || needsSend) {
                paymentsToProcess.push(p);
            }
        }

        console.log(`📊 Found ${paymentsToProcess.length} valid jobs (from ${batch.length} scanned)`);

        let imageGenerated = 0, lineSent = 0;
        let processedCount = 0;

        // --- PHASE 2: Notification Function ---
        const sendNotification = async (payment, room, tenant, imageUrl) => {
            if (skipLineSend) return;
            const autoSendEnabled = getConfigValue('auto_send_bills_after_generation', payment.branch_id, 'false') === 'true';
            if (!autoSendEnabled || payment.bill_sent_date) return;

            const hasLineId = !!tenant?.line_user_id;
            const hasFacebookId = !!tenant?.facebook_user_id;
            if (!hasLineId && !hasFacebookId) return;

            const branchId = payment.branch_id;
            const bankName = getConfigValue('bank_name', branchId, 'กสิกร');
            const bankAcc = getConfigValue('bank_account_number', branchId, '-');
            const bankOwner = getConfigValue('bank_account_name', branchId, '-');
            const buildingName = getConfigValue('building_name', branchId, 'W RESIDENTS');

            let msg = `📢 แจ้งเตือนค่าเช่า\n ${buildingName}\n คุณ ${tenant.full_name} (ห้อง ${room?.room_number || '-'}) \n\n🧾 รายละเอียด:\n`;
            if (payment.rent_amount > 0) msg += `• ค่าเช่า: ${payment.rent_amount.toLocaleString()} บ.\n`;
            if (payment.electricity_amount > 0) msg += `• ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บ.\n`;
            if (payment.water_amount > 0) msg += `• ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บ.\n`;
            if (payment.common_fee_amount > 0) msg += `• ส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บ.\n`;
            if (payment.parking_fee_amount > 0) msg += `• จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บ.\n`;
            if (payment.internet_amount > 0) msg += `• เน็ต: ${payment.internet_amount.toLocaleString()} บ.\n`;
            if (payment.other_amount > 0) msg += `• อื่นๆ: ${payment.other_amount.toLocaleString()} บ.\n`;
            if (payment.late_fee_amount > 0) msg += `• ค่าปรับ: ${payment.late_fee_amount.toLocaleString()} บ.\n`;
            msg += `💰 ยอดรวมสุทธิ: ${payment.total_amount.toLocaleString()} บาท\n------------------------------\n`;
            msg += ` ครบกำหนด: ${new Date(payment.due_date).toLocaleDateString('th-TH')}\n\n`;
            msg += `🏦 ${bankName} ${bankAcc}\n👤 ${bankOwner}\n\n`;
            if (imageUrl) msg += `📄 ดูบิล: ${imageUrl}\n\n`;
            msg += `📸 โอนแล้วรบกวนส่งสลิปนะคะ ขอบคุณค่ะ 🙏`;

            let messageSent = false;
            
            if (hasLineId) {
                try {
                    const lineToken = getConfigValue('line_channel_access_token', branchId, '');
                    if (lineToken) {
                        await callWithRetry(() => fetch('https://api.line.me/v2/bot/message/push', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lineToken}` },
                            body: JSON.stringify({ to: tenant.line_user_id, messages: [{ type: 'text', text: msg }] })
                        }), 'SendLINE');
                        messageSent = true; 
                        lineSent++;
                    }
                } catch (e) { console.error('LINE Fail'); }
            }

            if (hasFacebookId) {
                try {
                    const fbToken = getConfigValue('facebook_page_access_token', branchId, '');
                    if (fbToken) {
                        await callWithRetry(() => fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${fbToken}`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ recipient: { id: tenant.facebook_user_id }, message: { text: msg }, messaging_type: 'MESSAGE_TAG', tag: 'CONFIRMED_EVENT_UPDATE' })
                        }), 'SendFB');
                        messageSent = true;
                    }
                } catch (e) { console.error('FB Fail'); }
            }

            if (messageSent) {
                await callWithRetry(() => base44.asServiceRole.entities.Payment.update(payment.id, { bill_sent_date: new Date().toISOString() }), 'UpdateSentDate');
            }
        };

        // --- PHASE 3: Process Loop (One by One) ---
        const processPayment = async (payment) => {
            // Check Lock
            const freshPaymentRes = await callWithRetry(() => base44.asServiceRole.entities.Payment.filter({ id: payment.id }), 'CheckLock');
            const freshPayment = freshPaymentRes[0];
            if (!freshPayment) return { success: false, error: 'Deleted' };

            const ZOMBIE_THRESHOLD_MS = 30 * 60 * 1000;
            const lastUpdate = freshPayment.updated_date ? new Date(freshPayment.updated_date).getTime() : 0;
            if (freshPayment.invoice_image_status === 'generating' && (Date.now() - lastUpdate < ZOMBIE_THRESHOLD_MS)) {
                return { skipped: true };
            }

            // ⭐ LAZY LOAD TENANT & ROOM (ดึงสด ไม่ดึงรอ)
            const tenantRes = await callWithRetry(() => base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id }), 'GetTenant');
            const tenant = tenantRes[0] || {};
            
            const roomRes = await callWithRetry(() => base44.asServiceRole.entities.Room.filter({ id: payment.room_id }), 'GetRoom');
            const room = roomRes[0] || {};

            let needsRegenerate = false;
            if (freshPayment.invoice_image_url && freshPayment.invoice_data_hash) {
                if (generatePaymentHash(freshPayment) !== freshPayment.invoice_data_hash) needsRegenerate = true;
            }

            if (freshPayment.invoice_image_url && freshPayment.invoice_image_status === 'completed' && !needsRegenerate) {
                await sendNotification(freshPayment, room, tenant, freshPayment.invoice_image_url);
                return { success: true, skipped: true };
            }

            if (Date.now() - startTime > maxRunTime) return null;

            try {
                processedCount++;
                const branchName = getConfigValue('building_name', payment.branch_id, 'W RESIDENTS');
                
                await callWithRetry(() => base44.asServiceRole.entities.Payment.update(payment.id, { 
                    invoice_image_status: 'generating',
                    updated_date: new Date().toISOString()
                }), 'UpdateGenerating');

                console.log(`🖼️ [${processedCount}/${paymentsToProcess.length}] [${branchName}] ห้อง ${room?.room_number || '?'}`);
                
                const invoiceDataResult = await callWithRetry(() => base44.asServiceRole.functions.invoke('getPublicInvoice', { paymentId: payment.id }), 'GetPublicInvoice');
                if (!invoiceDataResult.data?.success || !invoiceDataResult.data?.invoice) throw new Error('Invoice data error');

                // Generate Image (ใช้ฟังก์ชันที่มี Retry)
                const imageUrl = await generateInvoiceScreenshot(base44, payment.id, invoiceDataResult.data.invoice);

                if (imageUrl) {
                    const newHash = generatePaymentHash(payment);
                    await callWithRetry(() => base44.asServiceRole.entities.Payment.update(payment.id, {
                        invoice_image_url: imageUrl,
                        invoice_image_status: 'completed',
                        invoice_data_hash: newHash
                    }), 'UpdateCompleted');
                    
                    await sendNotification(payment, room, tenant, imageUrl);
                    return { success: true };
                } else {
                    throw new Error('No image url');
                }
            } catch (error) {
                console.error(`❌ ห้อง ${room?.room_number || '?'}: ${error.message}`);
                await callWithRetry(() => base44.asServiceRole.entities.Payment.update(payment.id, { invoice_image_status: 'failed' }), 'UpdateFailed');
                return { success: false, error: error.message };
            }
        };

        // Execution Loop
        for (const payment of paymentsToProcess) {
             if (Date.now() - startTime > maxRunTime) break;
             const result = await processPayment(payment);
             if (result?.success && !result?.skipped) imageGenerated++;
             
             // ⭐ พักหายใจ 1 วินาที หลังจบงาน 1 ชิ้น
             await delay(1000); 
        }

        const totalElapsed = Date.now() - startTime;
        const summary = `Job Done: ${imageGenerated} images, ${lineSent} notifications sent.`;
        console.log(`\n✅ ${summary}`);
        
        return Response.json({ success: true, message: summary });

    } catch (error) {
        console.error('❌ Fatal Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});