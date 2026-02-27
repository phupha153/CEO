import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

// --- Helper Functions ---

function numberToThaiText(number) {
    if (number === undefined || number === null || isNaN(number)) return 'ศูนย์บาทถ้วน';
    if (number === 0) return 'ศูนย์บาทถ้วน';

    const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    
    const numStr = number.toFixed(2);
    const [intStr, decStr] = numStr.split('.');
    let integerPart = parseInt(intStr);
    const decimalPart = parseInt(decStr);

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

    let text = convert(integerPart) + 'บาท';
    if (decimalPart > 0) {
        text += convert(decimalPart) + 'สตางค์';
    } else {
        text += 'ถ้วน';
    }
    return text;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        const thaiMonths = [
            'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
            'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
        ];
        return `${date.getDate()} ${thaiMonths[date.getMonth()]} ${date.getFullYear() + 543}`;
    } catch (e) { return '-'; }
}

// --- Main Handler ---

Deno.serve(async (req) => {
    const startTime = Date.now();
    console.log('🚀 === START generateReceiptImage ===');
    
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const paymentId = body.paymentId;

        if (!paymentId) return Response.json({ success: false, error: 'No paymentId' }, { status: 400 });

        // 1. ดึงข้อมูล Payment ตรวจสอบสถานะ
        console.log('📥 Fetching payment data...');
        const paymentResults = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
        const paymentCheck = Array.isArray(paymentResults) ? paymentResults[0] : paymentResults;

        if (!paymentCheck) return Response.json({ success: false, error: 'ไม่พบข้อมูลการชำระเงิน' }, { status: 404 });
        if (paymentCheck.status !== 'paid') {
            return Response.json({ success: false, error: 'รายการนี้ยังไม่ได้ชำระเงิน' }, { status: 400 });
        }

        // 2. ดึงข้อมูล Invoice ครบชุดผ่าน getPublicInvoice
        console.log('📥 Fetching invoice data via getPublicInvoice...');
        const invoiceResponse = await base44.asServiceRole.functions.invoke('getPublicInvoice', { paymentId });
        
        if (!invoiceResponse.data?.success) {
            throw new Error(invoiceResponse.data?.error || 'Failed to fetch invoice data');
        }
        
        const data = invoiceResponse.data.invoice;
        const payment = data;
        const recipient = data.recipient || {};
        const tenant = data.tenant || {};
        const room = data.room || {};
        const bank = data.bank || {};

        // 3. เตรียมข้อมูลแสดงผล
        const receiptNumber = `REC-${payment.id.slice(0, 8).toUpperCase()}`;
        const paymentDateText = formatDate(payment.payment_date || new Date().toISOString());

        // ข้อมูลผู้รับเงิน
        const logoUrl = recipient.building_logo || 'https://via.placeholder.com/100x100?text=Logo';
        const buildingName = recipient.building_name || 'ที่พัก';
        const displayLessorName = recipient.company_name || recipient.lessor_name || '-';
        const displayLessorAddress = recipient.company_address || recipient.lessor_address || '';
        const displayTaxId = recipient.company_tax_id || recipient.tax_id || '';
        const buildingPhone = recipient.building_phone || '';

        // ข้อมูลธนาคาร
        const bankName = bank.name || 'กสิกรไทย';
        const bankAccountNumber = bank.account_number || '';
        const bankAccountName = bank.account_name || '';

        // 4. ⭐ สร้างรายการสินค้า (Line Items)
        console.log('🎨 Building line items...');
        const lineItems = [];
        
        if (payment.rent_amount > 0) {
            lineItems.push({ name: 'ค่าเช่า', quantity: 1, price: payment.rent_amount, total: payment.rent_amount });
        }
        
        // ⭐ แสดงค่าไฟเสมอ (แม้เป็น 0 บาท) เพื่อให้เห็นหน่วยที่ใช้
        const elecUnits = payment.electricity_units || 0;
        const elecAmount = payment.electricity_amount || 0;
        const calculatedElecAmount = elecUnits * (payment.electricity_rate || 0);
        const isElecMinimum = elecUnits === 0 || Math.abs(calculatedElecAmount - elecAmount) > 0.01;
        const elecMeterText = (payment.electricity_previous || payment.electricity_current) ? ` (${payment.electricity_previous}-${payment.electricity_current})` : '';
        
        lineItems.push({
            name: isElecMinimum 
                ? `ค่าไฟฟ้า${elecMeterText} ใช้ ${elecUnits} หน่วย${elecAmount === 0 ? '' : ' - คิดขั้นต่ำ'}`
                : `ค่าไฟฟ้า${elecMeterText} ${elecUnits} หน่วย × ${payment.electricity_rate || 0} บาท`,
            quantity: 1,
            price: elecAmount,
            total: elecAmount
        });
        
        // ⭐ แสดงค่าน้ำเสมอ (แม้เป็น 0 บาท) เพื่อให้เห็นหน่วยที่ใช้
        const waterUnits = payment.water_units || 0;
        const waterAmount = payment.water_amount || 0;
        const calculatedWaterAmount = waterUnits * (payment.water_rate || 0);
        const isWaterMinimum = waterUnits === 0 || Math.abs(calculatedWaterAmount - waterAmount) > 0.01;
        const waterMeterText = (payment.water_previous || payment.water_current) ? ` (${payment.water_previous}-${payment.water_current})` : '';
        
        lineItems.push({
            name: isWaterMinimum 
                ? `ค่าน้ำประปา${waterMeterText} ใช้ ${waterUnits} หน่วย${waterAmount === 0 ? '' : ' - คิดขั้นต่ำ'}`
                : `ค่าน้ำประปา${waterMeterText} ${waterUnits} หน่วย × ${payment.water_rate || 0} บาท`,
            quantity: 1,
            price: waterAmount,
            total: waterAmount
        });
        
        if (payment.internet_amount > 0) lineItems.push({ name: 'ค่าอินเทอร์เน็ต', quantity: 1, price: payment.internet_amount, total: payment.internet_amount });
        if (payment.common_fee_amount > 0) lineItems.push({ name: 'ค่าส่วนกลาง', quantity: 1, price: payment.common_fee_amount, total: payment.common_fee_amount });
        if (payment.parking_fee_amount > 0) lineItems.push({ name: 'ค่าที่จอดรถ', quantity: 1, price: payment.parking_fee_amount, total: payment.parking_fee_amount });
        if (payment.other_amount > 0) lineItems.push({ name: 'ค่าใช้จ่ายอื่นๆ', quantity: 1, price: payment.other_amount, total: payment.other_amount });

        // ✅ [แก้ไข] เพิ่มจุดเช็คค่าปรับ (Late Fee) ลงในรายการ
        if (payment.late_fee_amount && payment.late_fee_amount > 0) {
            console.log(`✅ Adding Late Fee: ${payment.late_fee_amount}`);
            lineItems.push({
                name: 'ค่าปรับชำระล่าช้า',
                quantity: 1,
                price: payment.late_fee_amount,
                total: payment.late_fee_amount
            });
        }

        const totalAmount = payment.total_amount || 0;

        // 5. สร้าง HTML
        const htmlContent = `<!DOCTYPE html>
        <html lang="th">
        <head>
        <meta charset="UTF-8">
        <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Sarabun', 'Tahoma', sans-serif; padding: 16px; background-color: #f8fafc; }
        .container { max-width: 700px; margin: 0 auto; padding: 32px; background: white; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
        .header-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px; }
        .logo-section { display: flex; align-items: center; gap: 8px; }
        .logo { width: 40px; height: 40px; object-fit: contain; }
        .building-name { font-size: 18px; font-weight: bold; color: #1e293b; }
        .receipt-title { text-align: right; }
        .receipt-title h2 { font-size: 18px; font-weight: bold; color: #16a34a; }
        .receipt-title p { font-size: 12px; color: #16a34a; }
        .issuer-info { font-size: 12px; color: #475569; line-height: 1.4; margin-top: 4px; }
        .receipt-info { display: flex; justify-content: space-between; margin-bottom: 24px; padding: 16px; background: #f8fafc; border-radius: 8px; }
        .receipt-info-item p:first-child { font-size: 12px; color: #64748b; margin-bottom: 4px; }
        .receipt-info-item p:last-child { font-weight: bold; color: #1e293b; }
        .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        .party-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
        .party-box h3 { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px; }
        .party-box .name { font-weight: 600; color: #1e293b; font-size: 13px; }
        .party-box .detail { font-size: 12px; color: #64748b; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 13px; }
        table th { background: #f1f5f9; padding: 12px 8px; text-align: left; font-weight: bold; color: #334155; border-bottom: 2px solid #cbd5e1; }
        table td { padding: 12px 8px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
        table .text-center { text-align: center; }
        table .text-right { text-align: right; }
        table .font-bold { font-weight: bold; }
        .total-section { border-top: 2px solid #cbd5e1; padding-top: 12px; margin-bottom: 16px; }
        .total-row { display: flex; justify-content: space-between; align-items: flex-start; }
        .total-label { font-size: 12px; color: #475569; }
        .total-label span { margin-left: 16px; }
        .total-amount { font-size: 18px; font-weight: bold; color: #1e293b; }
        .stamp-section { display: flex; justify-content: flex-end; margin-top: 12px; }
        .paid-stamp { border: 2px solid #16a34a; border-radius: 4px; padding: 8px 12px; text-align: center; transform: rotate(-3deg); }
        .paid-stamp .check { font-size: 12px; font-weight: bold; color: #15803d; }
        .paid-stamp .date { font-size: 10px; color: #16a34a; }
        .payment-notes { font-size: 12px; color: #64748b; margin-bottom: 16px; }
        .payment-notes span { font-weight: 500; color: #475569; }
        .footer { text-align: center; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
        </style>
        </head>
        <body>
        <div class="container">
        <div class="header">
        <div class="header-top">
        <div class="logo-section">
        <img src="${escapeHtml(logoUrl)}" alt="Logo" class="logo" />
        <div class="building-name">${escapeHtml(buildingName)}</div>
        </div>
        <div class="receipt-title">
        <h2>ใบเสร็จรับเงิน</h2>
        <p>Receipt</p>
        </div>
        </div>
        <div class="issuer-info">
        <p><strong>${escapeHtml(displayLessorName)}</strong></p>
        <p>${escapeHtml(displayLessorAddress)}</p>
        ${displayTaxId ? `<p>เลขประจำตัวผู้เสียภาษี: ${escapeHtml(displayTaxId)}</p>` : ''}
        ${buildingPhone ? `<p>โทร: ${escapeHtml(buildingPhone)}</p>` : ''}
        </div>
        </div>
        <div class="receipt-info">
        <div class="receipt-info-item">
        <p>เลขที่ใบเสร็จ</p>
        <p>${escapeHtml(receiptNumber)}</p>
        </div>
        <div class="receipt-info-item" style="text-align: right;">
        <p>วันที่ออก</p>
        <p>${escapeHtml(paymentDateText)}</p>
        </div>
        </div>
        <div class="parties-grid">
        <div class="party-box">
        <h3>ผู้รับเงิน</h3>
        <p class="name">${escapeHtml(displayLessorName)}</p>
        <p class="detail">${escapeHtml(displayLessorAddress)}</p>
        </div>
        <div class="party-box">
        <h3>ผู้จ่ายเงิน</h3>
        <p class="name">${escapeHtml(tenant.full_name || 'ไม่ระบุ')}</p>
        <p class="detail">ห้อง: ${escapeHtml(room.room_number)} | โทร: ${escapeHtml(tenant.phone || '-')}</p>
        </div>
        </div>
        <table>
        <thead>
        <tr>
        <th style="width: 50px;">ลำดับ</th>
        <th>รายการ</th>
        <th class="text-center" style="width: 80px;">จำนวน</th>
        <th class="text-right" style="width: 100px;">ราคา/หน่วย</th>
        <th class="text-right" style="width: 100px;">จำนวนเงิน</th>
        </tr>
        </thead>
        <tbody>
        ${lineItems.map((item, index) => `<tr>
        <td class="text-center">${index + 1}</td>
        <td>${escapeHtml(item.name)}</td>
        <td class="text-center">${item.quantity}</td>
        <td class="text-right">${(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        <td class="text-right font-bold">${(item.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
        </tr>`).join('')}
        </tbody>
        </table>
        <div class="total-section">
        <div class="total-row">
        <div class="total-label">
        <span style="font-weight: 500;">ยอดเงินสุทธิ</span>
        <span>(${numberToThaiText(totalAmount)})</span>
        </div>
        <div class="total-amount">${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
        </div>
        <div class="stamp-section">
        <div class="paid-stamp">
        <p class="check">✓ ชำระแล้ว</p>
        <p class="date">${escapeHtml(paymentDateText)}</p>
        </div>
        </div>
        </div>
        <div class="payment-notes">
        <span>ชำระผ่าน:</span> ${escapeHtml(bankName)} | ${escapeHtml(bankAccountNumber)} • ใบเสร็จนี้ออกให้เป็นหลักฐานการรับเงินเรียบร้อยแล้ว
        </div>
        <div class="footer">
        <p>ขอบคุณที่ใช้บริการ ${escapeHtml(buildingName)}</p>
        </div>
        </div>
        </body>
        </html>`;

        // 6. ส่งให้ Browserless
        const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
        if (!BROWSERLESS_API_KEY) throw new Error("BROWSERLESS_API_KEY not set");

        const browserlessResponse = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                html: htmlContent,
                viewport: { width: 700, height: 1000 },
                options: { type: 'png', fullPage: true, omitBackground: true }
            })
        });

        if (!browserlessResponse.ok) throw new Error(await browserlessResponse.text());

        const imageBlob = await browserlessResponse.blob();
        const imageFile = new File([imageBlob], `receipt-${paymentId}.png`, { type: 'image/png' });

        // 7. อัปโหลดและบันทึก
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        
        await base44.asServiceRole.entities.Payment.update(paymentId, {
            receipt_image_url: file_url
        });

        const elapsed = Date.now() - startTime;
        console.log(`⏱️ Total time: ${elapsed}ms`);

        return Response.json({ 
            success: true,
            message: 'สร้างรูปภาพใบเสร็จสำเร็จ',
            receipt_image_url: file_url
        });

    } catch (error) {
        console.error('Error:', error);
        
        // 🚨 ส่งอีเมลแจ้งเตือนเมื่อเกิดข้อผิดพลาด
        try {
            const body = await req.json().catch(() => ({}));
            await base44.integrations.Core.SendEmail({
                to: 'phupha20517@gmail.com',
                subject: '🚨 Error in generateReceiptImage',
                body: `เกิดข้อผิดพลาดในการสร้างรูปใบเสร็จ\n\nPayment ID: ${body?.paymentId || 'N/A'}\nError: ${error.message}\n\nStack:\n${error.stack}`
            });
        } catch (e) {
            console.error('Failed to send error email:', e);
        }
        
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});