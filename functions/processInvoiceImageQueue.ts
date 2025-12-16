import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ฟังก์ชันสำหรับสร้างรูปใบแจ้งหนี้และส่ง LINE แบบ Queue
 * Version: 3.0 - Optimized Scan & Fill Strategy (Final Verified)
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

// ⭐ ฟังก์ชันสร้างรูป invoice แบบ inline
async function generateInvoiceScreenshot(base44, paymentId, invoice) {
    const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
    if (!BROWSERLESS_API_KEY) throw new Error("BROWSERLESS_API_KEY not set");

    const payment = invoice;
    const room = invoice.room || { room_number: 'N/A', floor: 0 };
    const tenant = invoice.tenant || { full_name: 'ไม่ระบุ', phone: '' };
    const bank = invoice.bank || {};
    const recipient = invoice.recipient || {};

    const buildingName = recipient.building_name || 'W RESIDENTS';
    const buildingLogo = recipient.building_logo || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
    const buildingAddress = recipient.building_address || '';
    const buildingPhone = recipient.building_phone || '';
    const companyName = recipient.company_name || '';
    const taxId = recipient.tax_id || '';
    
    const bankName = bank.name || 'กสิกรไทย';
    const bankAccountNumber = bank.account_number || '';
    const bankAccountName = bank.account_name || '';

    const escapeHtml = (text) => text ? text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    const formatDate = (dateString) => {
        if (!dateString) return 'ไม่ระบุ';
        try {
            const date = new Date(dateString);
            const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
            return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
        } catch { return 'ไม่ระบุ'; }
    };

    const invoiceNumber = `INV-${paymentId.slice(0, 8).toUpperCase()}`;
    const issueDateText = formatDate(new Date().toISOString().split('T')[0]);
    const dueDateText = formatDate(payment.due_date);
    const isOverdue = payment.status === 'pending' && payment.due_date && new Date() > new Date(payment.due_date);
    const daysOverdue = isOverdue ? Math.ceil((new Date() - new Date(payment.due_date)) / (1000 * 60 * 60 * 24)) : 0;

    const lineItems = [];
    if (payment.rent_amount > 0) lineItems.push({ name: 'ค่าเช่า', total: payment.rent_amount });
    if (payment.electricity_amount > 0) lineItems.push({ name: `ค่าไฟฟ้า ${payment.electricity_units || 0} หน่วย`, total: payment.electricity_amount });
    if (payment.water_amount > 0) lineItems.push({ name: `ค่าน้ำประปา ${payment.water_units || 0} หน่วย`, total: payment.water_amount });
    if (payment.internet_amount > 0) lineItems.push({ name: 'ค่าอินเทอร์เน็ต', total: payment.internet_amount });
    if (payment.common_fee_amount > 0) lineItems.push({ name: 'ค่าส่วนกลาง', total: payment.common_fee_amount });
    if (payment.parking_fee_amount > 0) lineItems.push({ name: 'ค่าที่จอดรถ', total: payment.parking_fee_amount });
    if (payment.other_amount > 0) lineItems.push({ name: 'ค่าใช้จ่ายอื่นๆ', total: payment.other_amount });
    if (payment.late_fee_amount > 0) lineItems.push({ name: '⚠️ ค่าปรับชำระล่าช้า', total: payment.late_fee_amount });

    const htmlContent = `<!DOCTYPE html>
<html lang="th"><head><meta charset="UTF-8"><style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Sarabun', 'Tahoma', sans-serif; padding: 12px; background: #f1f5f9; }
.container { max-width: 600px; margin: 0 auto; padding: 16px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
.header { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
.header-top { display: flex; justify-content: space-between; align-items: start; gap: 12px; margin-bottom: 12px; }
.logo-section { display: flex; align-items: center; gap: 8px; }
.logo { width: 40px; height: 40px; object-fit: contain; }
.company-name { font-size: 18px; font-weight: bold; color: #1e293b; }
.invoice-title h2 { font-size: 16px; font-weight: bold; color: #2563eb; }
.issuer-info { font-size: 11px; color: #64748b; line-height: 1.5; }
.invoice-meta { margin-top: 12px; font-size: 11px; line-height: 1.6; }
.invoice-meta .due-date { color: #dc2626; font-weight: bold; }
.overdue-warning { background: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.overdue-warning .text-bold { font-size: 13px; font-weight: bold; color: #991b1b; }
.customer-section { margin-bottom: 12px; }
.customer-section h3 { font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 6px; }
.customer-box { background: #f8fafc; border-radius: 8px; padding: 12px; }
.customer-box .name { font-weight: bold; font-size: 13px; color: #1e293b; }
.customer-box .detail { font-size: 11px; color: #64748b; margin-top: 2px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
table th { padding: 8px 4px; text-align: left; font-weight: 600; color: #334155; border-bottom: 2px solid #cbd5e1; }
table td { padding: 8px 4px; border-bottom: 1px solid #e2e8f0; }
.text-right { text-align: right; }
.font-semibold { font-weight: 600; color: #1e293b; }
.total-section { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.total-box { border-top: 2px solid #cbd5e1; padding-top: 8px; }
.total-amount { font-weight: bold; font-size: 18px; color: ${isOverdue ? '#dc2626' : '#2563eb'}; }
.payment-info { background: #eff6ff; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; border: 1px solid #bfdbfe; font-size: 10px; }
.footer { text-align: center; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; }
</style></head><body>
<div class="container">
<div class="header">
<div class="header-top">
<div class="logo-section">
<img src="${escapeHtml(buildingLogo)}" alt="Logo" class="logo" />
<div><div class="company-name">${escapeHtml(buildingName)}</div></div>
</div>
<div class="invoice-title"><h2>ใบแจ้งหนี้</h2></div>
</div>
<div class="issuer-info">
${companyName ? `<p>${escapeHtml(companyName)}</p>` : ''}
<p>${escapeHtml(buildingAddress)}</p>
${buildingPhone ? `<p>โทร: ${escapeHtml(buildingPhone)}</p>` : ''}
${taxId ? `<p>เลขประจำตัวผู้เสียภาษี: ${escapeHtml(taxId)}</p>` : ''}
</div>
<div class="invoice-meta">
<p><b>เลขที่:</b> ${escapeHtml(invoiceNumber)}</p>
<p><b>วันที่ออก:</b> ${escapeHtml(issueDateText)}</p>
<p><b class="due-date">ครบกำหนด:</b> <span class="due-date">${escapeHtml(dueDateText)}</span></p>
</div>
</div>
${isOverdue ? `<div class="overdue-warning"><p class="text-bold">⚠️ เกินกำหนดชำระแล้ว ${daysOverdue} วัน</p></div>` : ''}
<div class="customer-section">
<h3>ผู้เช่า</h3>
<div class="customer-box">
<p class="name">${escapeHtml(tenant.full_name)}</p>
<p class="detail">ห้อง ${escapeHtml(room.room_number)}</p>
<p class="detail">โทร: ${escapeHtml(tenant.phone || 'ไม่ระบุ')}</p>
</div>
</div>
<table>
<thead><tr><th>ลำดับ</th><th>รายการ</th><th class="text-right">จำนวนเงิน</th></tr></thead>
<tbody>
${lineItems.map((item, idx) => `<tr><td>${idx + 1}</td><td>${escapeHtml(item.name)}</td><td class="text-right font-semibold">${(item.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
</tbody>
</table>
<div class="total-section">
<div class="total-box">
<span><b>รวมทั้งสิ้น</b></span>
<span class="total-amount" style="margin-left:24px">${(payment.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
</div>
</div>
<div class="payment-info">
<p>💳 โอนเงินได้ที่: ${escapeHtml(bankName)} ${escapeHtml(bankAccountNumber)} (${escapeHtml(bankAccountName)})</p>
</div>
<div class="footer"><p>ขอบคุณที่ใช้บริการ ${escapeHtml(buildingName)}</p></div>
</div>
</body></html>`;

    const browserlessResponse = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlContent, options: { type: 'png', fullPage: true } })
    });

    if (!browserlessResponse.ok) throw new Error(`Browserless error: ${await browserlessResponse.text()}`);
    const imageBlob = await browserlessResponse.blob();
    const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: imageFile });
    return file_url;
}

Deno.serve(async (req) => {
    console.log('========================================');
    console.log('🖼️ PROCESS INVOICE IMAGE QUEUE (Smart Scan Mode)');
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

        try {
            const text = await clonedReq.text();
            if (text && text.trim()) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
                batchSize = body.batch_size || 30; // Default 30 ถ้าไม่ส่งมา
                concurrentLimit = body.concurrent_limit || 1;
                skipLineSend = body.skip_line_send === true;
            }
        } catch (e) { console.log('⚠️ No valid JSON body'); }

        console.log(`📋 Target Branch: ${targetBranchId || 'ALL'}`);
        console.log(`📦 Batch Size (Target): ${batchSize}`);
        console.log(`🔄 Concurrent Limit: ${concurrentLimit}`);

        // 1. Fetch Configs
        const configs = await base44.asServiceRole.entities.Config.list() || [];
        const getConfigValue = (key, branchId, defaultValue = '') => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig?.value) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        // -----------------------------------------------------------
        // 2. Fetch Payments (Logic: Scan & Fill + Last Updated Sort)
        // -----------------------------------------------------------
        const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : {};
        
        let paymentsToProcess = []; // ตะกร้าใส่บิลที่จะเอาไปทำ
        let dbSkip = 0;             // ตัวนับตำแหน่งใน Database
        const dbFetchSize = 1000;   // ดึงทีละ 1,000 เพื่อประหยัด RAM
        const maxScanLimit = 15000; // ⭐ ลิมิตการสแกนสูงสุด
        let hasMore = true;

        console.log(`📥 Start Scanning for jobs (Max Scan: ${maxScanLimit})...`);
        
        // วนลูปสแกนจนกว่าจะได้งานครบ (batchSize) หรือ สแกนจนทะลุลิมิต
        while (hasMore && paymentsToProcess.length < batchSize && dbSkip < maxScanLimit) {
            
            // ⭐ เรียงตาม -updated_date เพื่อให้บิลที่มีการแก้ไขมาตรวจสอบก่อนเสมอ
            const batch = await base44.asServiceRole.entities.Payment.filter(
                paymentFilter, 
                '-updated_date', 
                dbFetchSize, 
                dbSkip
            );

            if (!batch || batch.length === 0) {
                hasMore = false; 
                break;
            }

            // กรองใน RAM
            for (const p of batch) {
                if (paymentsToProcess.length >= batchSize) break;

                // ข้ามคนที่จ่ายแล้วหรือยกเลิก
                if (p.status === 'paid' || p.status === 'cancelled') continue;

                const needsImage = !p.invoice_image_url || 
                                   p.invoice_image_status === 'pending' || 
                                   p.invoice_image_status === 'generating' ||
                                   !p.invoice_image_status;
                
                // เช็ค Hash แก้ไขข้อมูล
                let needsRegenerate = false;
                if (p.invoice_image_url && p.invoice_data_hash) {
                    const currentHash = generatePaymentHash(p);
                    if (currentHash !== p.invoice_data_hash) {
                        needsRegenerate = true;
                    }
                }
                
                if (p.status === 'overdue' && p.late_fee_amount > 0 && !p.invoice_data_hash) {
                    needsRegenerate = true;
                }

                const autoSendEnabled = getConfigValue('auto_send_bills_after_generation', p.branch_id, 'false') === 'true';
                const needsSend = autoSendEnabled && !p.bill_sent_date;

                if (needsImage || needsRegenerate || needsSend) {
                    paymentsToProcess.push(p);
                }
            }

            dbSkip += batch.length;
            if (dbSkip > 0 && dbSkip % 2000 === 0) console.log(`🔎 Scanned ${dbSkip} items... Found ${paymentsToProcess.length} jobs.`);
        }

        console.log(`📊 Scan Complete. Scanned total: ${dbSkip}. Found jobs: ${paymentsToProcess.length}`);

        if (paymentsToProcess.length === 0) {
            return Response.json({ success: true, message: 'ไม่มีบิลที่ต้องสร้างรูปหรือส่ง LINE', processed: 0 });
        }

        // 3. Prepare Data
        const uniqueTenantIds = [...new Set(paymentsToProcess.map(p => p.tenant_id).filter(id => id))];
        const uniqueRoomIds = [...new Set(paymentsToProcess.map(p => p.room_id).filter(id => id))];
        
        const [tenantsBatch, roomsBatch] = await Promise.all([
            uniqueTenantIds.length > 0 ? Promise.all(uniqueTenantIds.map(id => base44.asServiceRole.entities.Tenant.filter({ id }).catch(() => null))).then(results => results.flat().filter(Boolean)) : [],
            uniqueRoomIds.length > 0 ? Promise.all(uniqueRoomIds.map(id => base44.asServiceRole.entities.Room.filter({ id }).catch(() => null))).then(results => results.flat().filter(Boolean)) : []
        ]);

        const tenantMap = new Map(tenantsBatch.map(t => [t.id, t]));
        const roomMap = new Map(roomsBatch.map(r => [r.id, r]));
        
        // 4. Worker Queue
        let imageGenerated = 0, imageFailed = 0, lineSent = 0, lineFailed = 0;
        let allImageResults = [];
        
        console.log(`🔄 Starting continuous queue with ${concurrentLimit} concurrent workers`);

        let processedCount = 0;
        const processPayment = async (payment) => {
            const room = roomMap.get(payment.room_id);
            const tenant = tenantMap.get(payment.tenant_id);
            
            if (Date.now() - startTime > maxRunTime) return null;

            let needsRegenerate = false;
            if (payment.invoice_image_url && payment.invoice_data_hash) {
                if (generatePaymentHash(payment) !== payment.invoice_data_hash) needsRegenerate = true;
            }
            if (payment.status === 'overdue' && payment.late_fee_amount > 0 && !payment.invoice_data_hash) needsRegenerate = true;
            
            if (payment.invoice_image_url && payment.invoice_image_status === 'completed' && !needsRegenerate) {
                return { payment, room, tenant, imageUrl: payment.invoice_image_url, success: true, skipped: true };
            }

            try {
                processedCount++;
                const branchName = getConfigValue('building_name', payment.branch_id, 'W RESIDENTS');
                
                await base44.asServiceRole.entities.Payment.update(payment.id, { invoice_image_status: 'generating' });
                console.log(`🖼️ [${processedCount}/${paymentsToProcess.length}] [${branchName}] ห้อง ${room?.room_number || 'N/A'}`);
                
                const invoiceDataResult = await base44.asServiceRole.functions.invoke('getPublicInvoice', { paymentId: payment.id });
                if (!invoiceDataResult.data?.success || !invoiceDataResult.data?.invoice) throw new Error(invoiceDataResult.data?.error || 'ไม่พบข้อมูลใบแจ้งหนี้');

                const imageUrl = await generateInvoiceScreenshot(base44, payment.id, invoiceDataResult.data.invoice);

                if (imageUrl) {
                    const newHash = generatePaymentHash(payment);
                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        invoice_image_url: imageUrl,
                        invoice_image_status: 'completed',
                        invoice_data_hash: newHash
                    });
                    await delay(333);
                    return { payment: { ...payment, invoice_image_url: imageUrl }, room, tenant, imageUrl, success: true };
                } else {
                    throw new Error('Failed to generate invoice image');
                }
            } catch (error) {
                console.error(`❌ ห้อง ${room?.room_number || 'N/A'}: ${error.message}`);
                await base44.asServiceRole.entities.Payment.update(payment.id, { invoice_image_status: 'failed' });
                return { payment, room, tenant, success: false, error: error.message };
            }
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

        // 5. Sending Notifications
        if (!skipLineSend) {
            console.log(`\n📤 Sending notifications...`);
            for (const result of allImageResults) {
                if (!result.success && !result.skipped) continue;
                const { payment, room, tenant, imageUrl } = result;
                
                const autoSendEnabled = getConfigValue('auto_send_bills_after_generation', payment.branch_id, 'false') === 'true';
                if (!autoSendEnabled || payment.bill_sent_date) continue;
                
                const hasLineId = !!tenant?.line_user_id;
                const hasFacebookId = !!tenant?.facebook_user_id;
                if (!hasLineId && !hasFacebookId) continue;

                const branchId = payment.branch_id;
                const bankName = getConfigValue('bank_name', branchId, 'กสิกร');
                const bankAcc = getConfigValue('bank_account_number', branchId, '-');
                const bankOwner = getConfigValue('bank_account_name', branchId, '-');
                const buildingName = getConfigValue('building_name', branchId, 'W RESIDENTS');
                
                let msg = `📢 ${buildingName} - แจ้งเตือนค่าเช่า\nสวัสดีคุณ ${tenant.full_name}\nห้อง ${room?.room_number || 'N/A'}\n💰 ยอดรวม: ${payment.total_amount.toLocaleString()} บาท\n📅 ครบกำหนด: ${new Date(payment.due_date).toLocaleDateString('th-TH')}\n💳 ${bankName} ${bankAcc} (${bankOwner})\n`;
                if (imageUrl) msg += `📄 ใบแจ้งหนี้: ${imageUrl}\n`;
                msg += `📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ`;

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
                        if (fbToken) {
                            const res = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${fbToken}`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ recipient: { id: tenant.facebook_user_id }, message: { text: msg }, messaging_type: 'MESSAGE_TAG', tag: 'CONFIRMED_EVENT_UPDATE' })
                            });
                            if (res.ok) { messageSent = true; console.log(`✅ [FB] ห้อง ${room?.room_number}`); }
                            await delay(200);
                        }
                    } catch (e) { console.error('FB Error'); }
                }

                if (messageSent) await base44.asServiceRole.entities.Payment.update(payment.id, { bill_sent_date: new Date().toISOString() });
            }
        }

        // 6. Logging
        const totalElapsed = Date.now() - startTime;
        const summary = `สร้างรูป ${imageGenerated} ใบ, ส่ง LINE ${lineSent} ราย [${Math.round(totalElapsed/1000)}s]`;
        console.log(`\n✅ ${summary}`);
        
        try {
            await delay(1000);
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'processInvoiceImageQueue',
                run_timestamp: new Date().toISOString(),
                status: 'success',
                message: summary,
                execution_time_ms: totalElapsed,
                details: { processed: paymentsToProcess.length, imageGenerated, lineSent, dbScanned: dbSkip }
            });
        } catch (e) {}

        return Response.json({ success: true, message: summary, hasMore: dbSkip >= maxScanLimit ? false : hasMore });

    } catch (error) {
        console.error('❌ Error:', error);
        if (base44) await base44.asServiceRole.entities.FunctionLog.create({ function_name: 'processInvoiceImageQueue', status: 'error', message: error.message }).catch(() => {});
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});