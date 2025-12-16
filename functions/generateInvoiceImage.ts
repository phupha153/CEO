import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// --- Helper Functions ---

function getThaiMidnight(dateInput = new Date()) {
    const thaiTimeString = dateInput.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
    const thaiDate = new Date(thaiTimeString);
    thaiDate.setHours(0, 0, 0, 0);
    return thaiDate;
}

function numberToThaiText(number) {
    if (number === undefined || number === null || isNaN(number)) return 'ศูนย์บาทถ้วน';
    if (number === 0) return 'ศูนย์บาทถ้วน';
    const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    const numStr = number.toFixed(2);
    const [intStr, decStr] = numStr.split('.');
    
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
            else if (pos === 0 && digit === 1 && len > 1 && s[len-2] !== '0') res += 'เอ็ด';
            else res += numbers[digit] + positions[pos];
        }
        return res;
    }
    let text = convert(parseInt(intStr)) + 'บาท';
    if (parseInt(decStr) > 0) text += convert(parseInt(decStr)) + 'สตางค์';
    else text += 'ถ้วน';
    return text;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function generatePaymentHash(payment, lateFee) {
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
        late_fee_amount: lateFee || 0, 
        total_amount: payment.total_amount || 0, 
        due_date: payment.due_date || ''
    };
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32);
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        const thaiMonths = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
        return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
    } catch (e) { return '-'; }
}

Deno.serve(async (req) => {
    try {
        console.log('🚀 Starting generateInvoiceImage (Strict Mode)...');
        const base44 = createClientFromRequest(req);
        
        const body = await req.json();
        const paymentId = body.paymentId;
        const lateFeeOverride = body.lateFeeAmount;

        console.log('📦 Body Received:', JSON.stringify(body));

        if (!paymentId) return Response.json({ success: false, error: 'No paymentId' }, { status: 400 });

        // 1. ดึงข้อมูล Payment
        const [invoiceResponse, configs] = await Promise.all([
            base44.asServiceRole.functions.invoke('getPublicInvoice', { paymentId }),
            base44.asServiceRole.entities.Config.list()
        ]);

        if (!invoiceResponse.data?.success) throw new Error('Failed to fetch invoice data');

        const data = invoiceResponse.data.invoice;
        const payment = data;
        const recipient = data.recipient || {};
        const tenant = data.tenant || {};
        const room = data.room || {};
        const bank = data.bank || {};

        // 2. ⭐ ตัดสินใจเลือกค่าปรับ (Strict Logic)
        let finalLateFee = 0;
        
        // Priority 1: ถ้ามีค่าส่งมา (Override) ใช้เลย! ห้ามเถียง!
        if (lateFeeOverride !== undefined && lateFeeOverride !== null) {
            finalLateFee = Number(lateFeeOverride);
            console.log(`✅ [STRICT] Using OVERRIDE Late Fee: ${finalLateFee} (Ignored Config/DB)`);
        } else {
            // Priority 2: ถ้าไม่มีส่งมา ค่อยคำนวณเอง (Auto-Calc)
            console.log('⚠️ No override provided, starting auto-calculation...');
            let calculatedLateFeeFromConfig = 0;
            let daysOverdue = 0;

            if (payment.due_date) {
                const dueDateObj = getThaiMidnight(new Date(payment.due_date));
                const todayObj = getThaiMidnight(new Date());
                const diffTime = todayObj.getTime() - dueDateObj.getTime();
                daysOverdue = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (daysOverdue > 0) {
                    const branchId = payment.branch_id;
                    console.log(`   - Overdue: ${daysOverdue} days, Branch: ${branchId}`);

                    const tiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && (!c.branch_id || c.branch_id === branchId));
                    if (tiersEnabledConfig?.value === 'true') {
                         const tiersConfig = configs.find(c => c.key === 'late_fee_tiers' && (!c.branch_id || c.branch_id === branchId));
                         if (tiersConfig?.value) {
                            try {
                                const tiers = JSON.parse(tiersConfig.value);
                                for (const tier of tiers) {
                                    const daysFrom = tier.days_from || 1;
                                    const daysTo = tier.days_to || 999;
                                    const fee = parseFloat(tier.fee_per_day || 0);
                                    if (daysOverdue >= daysFrom) {
                                        const d = Math.min(daysOverdue, daysTo) - daysFrom + 1;
                                        if (d > 0) calculatedLateFeeFromConfig += d * fee;
                                    }
                                    if (daysOverdue <= daysTo) break;
                                }
                            } catch(e) {}
                         }
                    } else {
                        // Check multiple keys
                        let feeConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && (!c.branch_id || c.branch_id === branchId));
                        if (!feeConfig) feeConfig = configs.find(c => c.key === 'late_fee_per_day' && (!c.branch_id || c.branch_id === branchId));
                        
                        const fee = parseFloat(feeConfig?.value || 0);
                        if (!isNaN(fee) && fee > 0) {
                            calculatedLateFeeFromConfig = daysOverdue * fee;
                        }
                    }
                }
            }

            if (calculatedLateFeeFromConfig > 0) {
                finalLateFee = calculatedLateFeeFromConfig;
                console.log(`✅ [AUTO] Calculated Late Fee: ${finalLateFee}`);
            } else {
                // Priority 3: Fallback to DB
                finalLateFee = Number(payment.late_fee_amount || 0);
                console.log(`ℹ️ [FALLBACK] Using DB Late Fee: ${finalLateFee}`);
            }
        }

        // 3. Recalculate Total
        const dbLateFee = Number(payment.late_fee_amount || 0);
        const baseAmount = Number(payment.total_amount || 0) - dbLateFee;
        const finalTotalAmount = baseAmount + finalLateFee;

        // --- Prepare Display Data ---
        const invoiceNo = `INV-${payment.id.slice(0, 8).toUpperCase()}`;
        const issueDate = formatDate(new Date().toISOString());
        const dueDate = formatDate(payment.due_date);
        const logoUrl = recipient.building_logo || 'https://via.placeholder.com/100x100?text=Logo';
        const buildingName = recipient.building_name || 'Double Residence';
        const displayLessorName = recipient.company_name || recipient.lessor_name || 'ธนานนท์ พรมพักตร์';
        const displayLessorAddress = recipient.company_address || recipient.lessor_address || '';
        const displayTaxId = recipient.company_tax_id || recipient.tax_id || '';

        const items = [];
        if (payment.rent_amount > 0) items.push({ name: 'ค่าเช่า', qty: 1, price: payment.rent_amount });
        if (payment.electricity_amount > 0) {
            items.push({ name: `ค่าไฟ (${payment.electricity_units || 0} หน่วย)`, qty: 1, price: payment.electricity_amount });
        }
        if (payment.water_amount > 0) {
            items.push({ name: `ค่าน้ำ (${payment.water_units || 0} หน่วย)`, qty: 1, price: payment.water_amount });
        }
        if (payment.common_fee_amount > 0) items.push({ name: 'ค่าส่วนกลาง', qty: 1, price: payment.common_fee_amount });
        if (payment.parking_fee_amount > 0) items.push({ name: 'ค่าที่จอดรถ', qty: 1, price: payment.parking_fee_amount });
        if (payment.internet_amount > 0) items.push({ name: 'ค่าอินเทอร์เน็ต', qty: 1, price: payment.internet_amount });
        if (payment.other_amount > 0) items.push({ name: 'ค่าใช้จ่ายอื่นๆ', qty: 1, price: payment.other_amount });
        
        // ✅ Add Late Fee Row (Using Strict Final Value)
        if (finalLateFee > 0) {
            console.log(`➕ Adding Late Fee row: ${finalLateFee}`);
            items.push({ name: 'ค่าปรับชำระล่าช้า', qty: 1, price: finalLateFee });
        }

        const totalText = numberToThaiText(finalTotalAmount);

        // --- HTML Content ---
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

        const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
        if (!BROWSERLESS_API_KEY) throw new Error("BROWSERLESS_API_KEY not set");

        const browserlessResponse = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                html: htmlContent,
                viewport: { width: 800, height: 1000 },
                options: { type: 'png', fullPage: true, omitBackground: true }
            })
        });

        if (!browserlessResponse.ok) throw new Error(await browserlessResponse.text());
        const imageBlob = await browserlessResponse.blob();
        const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });

        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        
        // ⭐ Generate Hash with the ACTUAL fee used (finalLateFee)
        const newHash = generatePaymentHash(payment, finalLateFee);
        
        // ⭐ Save only the image URL and Hash (not the amount)
        await base44.asServiceRole.entities.Payment.update(paymentId, {
            invoice_image_url: file_url,
            invoice_data_hash: newHash
        });

        return Response.json({ success: true, invoice_image_url: file_url });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});