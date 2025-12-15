import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { differenceInDays, parseISO, startOfDay } from 'npm:date-fns@3.6.0';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// HELPER FUNCTIONS
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
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32);
}

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

    const escapeHtml = (text) => {
        if (!text) return '';
        return text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'ไม่ระบุ';
        try {
            const date = new Date(dateString);
            const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
                'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
            return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
        } catch { return 'ไม่ระบุ'; }
    };

    const invoiceNumber = `INV-${paymentId.slice(0, 8).toUpperCase()}`;
    const issueDateText = formatDate(new Date().toISOString().split('T')[0]);
    const dueDateText = formatDate(payment.due_date);
    
    const isOverdue = payment.status === 'overdue';
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
.invoice-title { text-align: right; }
.invoice-title h2 { font-size: 16px; font-weight: bold; color: ${isOverdue ? '#dc2626' : '#2563eb'}; }
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
<div class="invoice-title"><h2>ใบแจ้งหนี้${isOverdue ? ' (เกินกำหนด)' : ''}</h2></div>
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
        body: JSON.stringify({
            html: htmlContent,
            options: { type: 'png', fullPage: true }
        })
    });

    if (!browserlessResponse.ok) throw new Error(`Browserless error: ${await browserlessResponse.text()}`);
    
    const imageBlob = await browserlessResponse.blob();
    const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: imageFile });
    return file_url;
}

// ==========================================
// MAIN FUNCTION (Recursive with Rate Limit Fix)
// ==========================================

Deno.serve(async (req) => {
    const startTime = Date.now();
    try {
        const base44 = createClientFromRequest(req);
        
        let body = {};
        try { body = await req.json(); } catch {}
        
        // ⭐ ระบุชื่อฟังก์ชันตัวเอง (ต้องตรงกับชื่อไฟล์จริง)
        const MY_FUNCTION_NAME = 'sendAutomatedOverdueReminders'; 
        
        const targetBranchId = body.branch_id || null;
        const testLineUserId = body.test_line_user_id || null;
        const limit = Math.min(body.limit || 50, 50);

        console.log(`🔴 Start Batch (Limit: ${limit}) - Branch: ${targetBranchId || 'All'}`);

        // Timezone Fix (UTC+7)
        const nowUTC = new Date();
        const thaiNow = new Date(nowUTC.getTime() + (7 * 60 * 60 * 1000));
        const today = startOfDay(thaiNow);
        const todayString = today.toISOString().split('T')[0];

        // Fetch Configs
        const configs = await base44.asServiceRole.entities.Config.list();
        const getConfigValue = (key, def, branchId) => {
            const c = configs.find(x => x.key === key && (x.branch_id === branchId || !x.branch_id));
            return c?.value || def;
        };

        // Fetch Data (Batch)
        const filterBase = targetBranchId ? { branch_id: targetBranchId } : {};
        const [pendingBatch, overdueBatch] = await Promise.all([
            base44.asServiceRole.entities.Payment.filter({ ...filterBase, status: 'pending' }, '-created_date', 100),
            base44.asServiceRole.entities.Payment.filter({ ...filterBase, status: 'overdue' }, '-created_date', 100)
        ]);

        const candidates = [...(pendingBatch || []), ...(overdueBatch || [])];
        
        // Filter Logic
        const paymentsToProcess = [];
        let hasMoreItemsInDb = false;
        
        for (const p of candidates) {
            if (paymentsToProcess.length >= limit) {
                hasMoreItemsInDb = true;
                break; 
            }

            const reminderEnabled = getConfigValue('send_overdue_reminder', 'false', p.branch_id) === 'true';
            if (!reminderEnabled) continue;

            if (!p.due_date) continue;
            const dueDate = startOfDay(parseISO(p.due_date));
            const daysOverdue = differenceInDays(today, dueDate);

            if (daysOverdue <= 0) continue; 

            if (p.overdue_reminder_sent_date) {
                const lastSent = p.overdue_reminder_sent_date.split('T')[0];
                if (lastSent === todayString) continue; 
            }
            paymentsToProcess.push(p);
        }

        console.log(`📋 Processing Batch: ${paymentsToProcess.length} items`);
        
        if (paymentsToProcess.length === 0) {
             return Response.json({ success: true, message: 'All caught up! No more items.' });
        }

        // Fetch Related Data
        const tenantIds = [...new Set(paymentsToProcess.map(p => p.tenant_id))];
        const roomIds = [...new Set(paymentsToProcess.map(p => p.room_id))];
        const [tenants, rooms] = await Promise.all([
            Promise.all(tenantIds.map(id => base44.asServiceRole.entities.Tenant.filter({id}))).then(r => r.flat()),
            Promise.all(roomIds.map(id => base44.asServiceRole.entities.Room.filter({id}))).then(r => r.flat())
        ]);
        const tenantMap = new Map(tenants.map(t => [t.id, t]));
        const roomMap = new Map(rooms.map(r => [r.id, r]));

        // Process Loop
        const recipients = [];
        
        for (const payment of paymentsToProcess) {
            try {
                // Rate Limit Protection: Small delay inside loop
                await delay(100); 

                // STEP 1: Calculate Late Fee
                const dueDate = startOfDay(parseISO(payment.due_date));
                const daysOverdue = differenceInDays(today, dueDate);
                let lateFee = 0;
                
                const feePerDay = parseFloat(getConfigValue('late_payment_fee_per_day', '0', payment.branch_id));
                if (feePerDay > 0) lateFee = daysOverdue * feePerDay;

                if (payment.status !== 'overdue' || payment.late_fee_amount !== lateFee) {
                    const newTotal = (payment.total_amount - (payment.late_fee_amount||0)) + lateFee;
                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        status: 'overdue',
                        late_fee_amount: lateFee,
                        total_amount: newTotal
                    });
                    payment.status = 'overdue';
                    payment.late_fee_amount = lateFee;
                    payment.total_amount = newTotal;
                    console.log(`💰 Upd LateFee: ${payment.id} = ${lateFee}`);
                }

                // STEP 2: Generate Image
                let imageUrl = payment.invoice_image_url;
                const currentHash = generatePaymentHash(payment);
                
                if (!imageUrl || payment.invoice_data_hash !== currentHash) {
                    // console.log(`🖼️ Gen Image: ${payment.id}`);
                    const invRes = await base44.asServiceRole.functions.invoke('getPublicInvoice', { paymentId: payment.id });
                    if (invRes.data?.invoice) {
                        imageUrl = await generateInvoiceScreenshot(base44, payment.id, invRes.data.invoice);
                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            invoice_image_url: imageUrl,
                            invoice_data_hash: currentHash
                        });
                        payment.invoice_image_url = imageUrl;
                        
                        // Rate Limit Protection: Delay after generating image
                        await delay(1500); 
                    }
                }

                // STEP 3: Create Message
                const tenant = tenantMap.get(payment.tenant_id);
                const room = roomMap.get(payment.room_id);
                if (!tenant || (!tenant.line_user_id && !tenant.facebook_user_id)) continue;

                const bankName = getConfigValue('bank_name', 'กสิกร', payment.branch_id);
                const bankAcc = getConfigValue('bank_account_number', '', payment.branch_id);
                const accName = getConfigValue('bank_account_name', '', payment.branch_id);
                const bldName = getConfigValue('building_name', 'หอพัก', payment.branch_id);

                let msg = `🔴 แจ้งเตือนเกินกำหนดชำระ\n\n${bldName}\n`;
                msg += `คุณ ${tenant.full_name} ห้อง ${room?.room_number}\n`;
                msg += `💰 ยอดรวม: ${payment.total_amount.toLocaleString()} บาท\n`;
                if (lateFee > 0) msg += `(รวมค่าปรับล่าช้า ${lateFee.toLocaleString()} บาท แล้ว)\n`;
                msg += `เกินกำหนด: ${daysOverdue} วัน\n\n`;
                if (imageUrl) msg += `📄 ดูบิล: ${imageUrl}\n\n`;
                msg += `💳 โอน: ${bankName} ${bankAcc} (${accName})\n`;
                msg += `กรุณาชำระด่วนและส่งสลิปครับ 🙏`;

                recipients.push({
                    lineUserId: tenant.line_user_id,
                    facebookUserId: tenant.facebook_user_id,
                    message: msg,
                    metadata: { paymentId: payment.id, branchId: payment.branch_id }
                });

            } catch (err) {
                console.error(`❌ Err processing ${payment.id}: ${err.message}`);
            }
        }

        // 8. Send Messages & Update Status
        let sentCount = 0;
        if (recipients.length > 0) {
            
            // Test Mode
            if (testLineUserId) {
                await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                    recipients: [{ lineUserId: testLineUserId, message: recipients[0].message }],
                    options: { batchSize: 1 }
                });
                return Response.json({ success: true, message: 'Sent test message' });
            }

            // Real Send - LINE
            const lineUsers = recipients.filter(r => r.lineUserId);
            if (lineUsers.length > 0) {
                const res = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                    recipients: lineUsers,
                    // ⭐ Fix 429: Increase delays between batches
                    options: { batchSize: 10, delayBetweenBatches: 2000, delayBetweenMessages: 200 }
                });
                sentCount += res.data?.success || 0;
            }

            // Real Send - Facebook
            const fbUsers = recipients.filter(r => r.facebookUserId);
            for (const r of fbUsers) {
                try {
                    await base44.asServiceRole.functions.invoke('sendFacebookMessage', {
                        to: r.facebookUserId,
                        message: r.message,
                        branch_id: r.metadata.branchId
                    });
                    sentCount++;
                    await delay(300); // Small delay between FB calls
                } catch {}
            }

            // ⭐ Fix 429: Update Last Sent Date (Chunked + Delayed)
            const sentIds = recipients.map(r => r.metadata.paymentId);
            const nowIso = new Date().toISOString();
            
            // Reduced batch size for updates to 10
            for (let i = 0; i < sentIds.length; i += 10) {
                const batch = sentIds.slice(i, i + 10);
                await Promise.all(batch.map(id => 
                    base44.asServiceRole.entities.Payment.update(id, { overdue_reminder_sent_date: nowIso })
                        .catch(e => console.error(`Failed update ${id}`, e))
                ));
                // Wait 2 seconds between update batches
                await delay(2000); 
            }
        }

        // =========================================================
        // RECURSIVE TRIGGER (With 429 Protection)
        // =========================================================
        
        const shouldCallNextBatch = paymentsToProcess.length === limit || hasMoreItemsInDb;

        if (shouldCallNextBatch && !testLineUserId) {
            console.log(`🔄 Batch done. Waiting 5s before next batch...`);
            
            // ⭐ Fix 429: Wait 5 seconds before triggering next run
            await delay(5000);

            await base44.asServiceRole.functions.invoke(MY_FUNCTION_NAME, {
                body: { 
                    branch_id: targetBranchId,
                    limit: limit
                }
            }).catch(err => console.error("❌ Failed to trigger next batch:", err));
        } else {
            console.log("✅ All items processed. Job done.");
        }

        return Response.json({
            success: true,
            processed: paymentsToProcess.length,
            sent: sentCount,
            triggered_next_batch: shouldCallNextBatch
        });

    } catch (error) {
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});