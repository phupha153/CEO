import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

function numberToThaiText(number) {
    if (!number || number === 0) return 'ศูนย์บาทถ้วน';
    
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
            if (position === 1 && digit === 1) res += 'สิบ';
            else if (position === 1 && digit === 2) result += 'ยี่สิบ';
            else if (position === 0 && digit === 1 && len > 1) result += 'เอ็ด';
            else result += numbers[digit] + positions[position];
        }
        return result;
    }
    
    let text = convertInteger(integerPart) + 'บาท';
    if (decimalPart > 0) text += convertInteger(decimalPart) + 'สตางค์';
    else text += 'ถ้วน';
    return text;
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
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const paymentId = body.paymentId;

        if (!paymentId) {
            return Response.json({ success: false, error: 'No paymentId' }, { status: 400 });
        }

        const [payment, configs] = await Promise.all([
            base44.asServiceRole.entities.Payment.filter({ id: paymentId }).then(p => Array.isArray(p) ? p[0] : p),
            base44.asServiceRole.entities.Config.list()
        ]);

        if (!payment) {
            return Response.json({ success: false, error: 'Payment not found' }, { status: 404 });
        }

        if (payment.status !== 'paid') {
            return Response.json({ success: false, error: 'Payment not paid yet' }, { status: 400 });
        }

        const [tenant, room] = await Promise.all([
            payment.tenant_id ? base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id }).then(t => Array.isArray(t) ? t[0] : t) : null,
            payment.room_id ? base44.asServiceRole.entities.Room.filter({ id: payment.room_id }).then(r => Array.isArray(r) ? r[0] : r) : null
        ]);

        if (!tenant) {
            return Response.json({ success: false, error: 'Tenant not found' }, { status: 400 });
        }

        const branchId = payment.branch_id;
        const getConfig = (key, defaultValue) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig ? globalConfig.value : defaultValue;
        };

        const logoUrl = getConfig('building_logo', 'https://via.placeholder.com/100x100?text=Logo');
        const buildingName = getConfig('building_name', 'W RESIDENTS');
        const displayLessorName = getConfig('company_name', '') || getConfig('lessor_name', 'ธนานนท์ พรมพักตร์');
        const displayLessorAddress = getConfig('company_address', '') || getConfig('building_address', '');
        const displayTaxId = getConfig('company_tax_id', '') || getConfig('tax_id', '');
        const bankName = getConfig('bank_name', 'กสิกรไทย');
        const bankAccountNumber = getConfig('bank_account_number', '-');
        const bankAccountName = getConfig('bank_account_name', '-');

        const receiptNo = `REC-${payment.id.slice(0, 8).toUpperCase()}`;
        const paymentDate = formatDate(payment.payment_date);
        const dueDate = formatDate(payment.due_date);

        const items = [];
        if (payment.rent_amount > 0) items.push({ name: 'ค่าเช่า', qty: 1, price: payment.rent_amount });
        if (payment.electricity_amount > 0) items.push({ name: `ค่าไฟ (${payment.electricity_units || 0} หน่วย)`, qty: 1, price: payment.electricity_amount });
        if (payment.water_amount > 0) items.push({ name: `ค่าน้ำ (${payment.water_units || 0} หน่วย)`, qty: 1, price: payment.water_amount });
        if (payment.common_fee_amount > 0) items.push({ name: 'ค่าส่วนกลาง', qty: 1, price: payment.common_fee_amount });
        if (payment.parking_fee_amount > 0) items.push({ name: 'ค่าที่จอดรถ', qty: 1, price: payment.parking_fee_amount });
        if (payment.internet_amount > 0) items.push({ name: 'ค่าอินเทอร์เน็ต', qty: 1, price: payment.internet_amount });
        if (payment.other_amount > 0) items.push({ name: 'ค่าใช้จ่ายอื่นๆ', qty: 1, price: payment.other_amount });
        if (payment.late_fee_amount > 0) items.push({ name: 'ค่าปรับชำระล่าช้า', qty: 1, price: payment.late_fee_amount });

        const totalAmount = payment.total_amount || 0;
        const totalText = numberToThaiText(totalAmount);

        function escapeHtml(text) {
            if (!text) return '';
            return text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

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
                .receipt-label { text-align: right; width: 25%; }
                .receipt-label h2 { font-size: 20px; color: #10b981; font-weight: bold; margin: 0; }
                .receipt-label span { font-size: 12px; color: #10b981; font-weight: 600; letter-spacing: 1px; }
                .meta-bar { display: flex; justify-content: space-between; background: #f0fdf4; padding: 10px 15px; border-radius: 6px; margin-bottom: 20px; border: 1px solid #bbf7d0; }
                .meta-item { font-size: 12px; }
                .meta-item strong { color: #64748b; margin-right: 5px; }
                .meta-item span { font-weight: 600; color: #1e293b; }
                .paid-badge { background: #10b981; color: white; padding: 4px 12px; border-radius: 4px; font-size: 11px; font-weight: 600; }
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
                .total-box { text-align: right; border-top: 2px solid #10b981; padding-top: 10px; min-width: 250px; }
                .total-label { font-size: 13px; font-weight: bold; color: #1e293b; margin-right: 15px; }
                .total-amount { font-size: 22px; font-weight: bold; color: #10b981; }
                .thai-baht { font-size: 12px; color: #64748b; font-style: italic; margin-top: 5px; }
                .paid-box { background: #d1fae5; border: 2px solid #10b981; border-radius: 8px; padding: 15px; margin-bottom: 20px; text-align: center; }
                .paid-box .checkmark { font-size: 32px; color: #10b981; margin-bottom: 8px; }
                .paid-box .status { font-size: 16px; font-weight: bold; color: #047857; margin-bottom: 4px; }
                .paid-box .date { font-size: 12px; color: #059669; }
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
                    <div class="receipt-label">
                        <h2>ใบเสร็จรับเงิน</h2>
                        <span>RECEIPT</span>
                    </div>
                </div>

                <div class="meta-bar">
                    <div class="meta-item"><strong>เลขที่:</strong> <span>${escapeHtml(receiptNo)}</span></div>
                    <div class="meta-item"><strong>วันที่ชำระ:</strong> <span>${escapeHtml(paymentDate)}</span></div>
                    <div class="meta-item"><span class="paid-badge">✓ ชำระแล้ว</span></div>
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
                            <p>ห้อง: ${escapeHtml(room?.room_number || '-')}</p>
                            <p>โทร: ${escapeHtml(tenant.phone || '-')}</p>
                            <p>ที่อยู่: ${escapeHtml(tenant.address || 'ไม่ระบุ')}</p>
                        </div>
                    </div>
                </div>

                <div class="paid-box">
                    <div class="checkmark">✓</div>
                    <div class="status">ชำระเงินเรียบร้อยแล้ว</div>
                    <div class="date">วันที่ชำระ: ${escapeHtml(paymentDate)}</div>
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
                        <span class="total-label">ยอดที่ชำระแล้ว</span>
                        <span class="total-amount">${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
                        <div class="thai-baht">(${totalText})</div>
                    </div>
                </div>

                <div class="notes">
                    <strong>การชำระเงิน:</strong><br>
                    วิธีชำระ: ${payment.payment_method === 'cash' ? 'เงินสด' : payment.payment_method === 'transfer' ? 'โอนเงิน' : payment.payment_method === 'qr_code' ? 'QR Code' : '-'}<br>
                    วันที่ชำระ: ${escapeHtml(paymentDate)}<br>
                    ${payment.notes ? `<br><strong>หมายเหตุ:</strong> ${escapeHtml(payment.notes)}` : ''}
                </div>

                <div class="credit">
                    ใบเสร็จฉบับนี้สร้างโดยระบบอัตโนมัติ | ${escapeHtml(buildingName)} | กรุณาเก็บไว้เป็นหลักฐาน
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

        if (!browserlessResponse.ok) {
            const errorText = await browserlessResponse.text();
            console.error('❌ Browserless Error:', errorText);
            throw new Error(`Browserless API failed (${browserlessResponse.status}): ${errorText}`);
        }

        const imageBlob = await browserlessResponse.blob();
        const imageFile = new File([imageBlob], `receipt-${paymentId}.png`, { type: 'image/png' });
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });

        await base44.asServiceRole.entities.Payment.update(paymentId, {
            receipt_image_url: file_url
        });

        return Response.json({ success: true, receipt_image_url: file_url });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});