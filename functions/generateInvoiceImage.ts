import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// --- Helper Functions ---

function numberToThaiText(number) {
    if (number === undefined || number === null || isNaN(number)) return 'ศูนย์บาทถ้วน';
    if (number === 0) return 'ศูนย์บาทถ้วน';

    const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    
    const numStr = number.toFixed(2);
    const [intStr, decStr] = numStr.split('.');
    let integerPart = parseInt(intStr); // ใช้ let เพื่อให้แก้ไขค่าได้ถ้าจำเป็น
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
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32);
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
    try {
        const base44 = createClientFromRequest(req);
        const body = await req.json();
        const paymentId = body.paymentId;

        if (!paymentId) return Response.json({ success: false, error: 'No paymentId' }, { status: 400 });

        // 1. ดึงข้อมูล Invoice
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

        // 2. เตรียมข้อมูลสำหรับแสดงผล
        const invoiceNo = `INV-${payment.id.slice(0, 8).toUpperCase()}`;
        const issueDate = formatDate(new Date().toISOString());
        const dueDate = formatDate(payment.due_date);
        
        // ข้อมูลผู้รับเงิน (Header)
        const logoUrl = recipient.building_logo || 'https://via.placeholder.com/100x100?text=Logo';
        const buildingName = recipient.building_name || 'Double Residence';
        // ใช้ชื่อผู้ปล่อยเช่า หรือชื่อบริษัท ถ้าไม่มีให้ใช้ค่า Default
        const lessorName = recipient.lessor_name || recipient.company_name || 'ธนานนท์ พรมพักตร์';
        const lessorAddr = recipient.lessor_address || recipient.company_address || '28/244 หมู่ 4 ถนนมหรรณพ 4 ซอย 6 ตำบล/แขวงลาดพร้าว อำเภอ/เขตลาดพร้าว จ.กรุงเทพมหานคร';

        // รายการสินค้า
        const items = [];
        if (payment.rent_amount > 0) items.push({ name: 'ค่าเช่า', qty: 1, price: payment.rent_amount });
        
        // ไฟฟ้า (แสดงหน่วยถ้ามี)
        if (payment.electricity_amount > 0) {
            let desc = `ค่าไฟ`;
            if (payment.electricity_units) desc += ` (${payment.electricity_units} หน่วย)`;
            // เช็คว่ามีเลขมิเตอร์ไหม
            if (payment.electricity_previous && payment.electricity_current) {
                desc += ` [${payment.electricity_previous}-${payment.electricity_current}]`;
            }
            items.push({ name: desc, qty: 1, price: payment.electricity_amount });
        }
        
        // ประปา
        if (payment.water_amount > 0) {
            let desc = `ค่าน้ำ`;
            if (payment.water_units) desc += ` (${payment.water_units} หน่วย)`;
            items.push({ name: desc, qty: 1, price: payment.water_amount });
        }

        if (payment.common_fee_amount > 0) items.push({ name: 'ค่าส่วนกลาง', qty: 1, price: payment.common_fee_amount });
        if (payment.parking_fee_amount > 0) items.push({ name: 'ค่าที่จอดรถ', qty: 1, price: payment.parking_fee_amount });
        if (payment.internet_amount > 0) items.push({ name: 'ค่าอินเทอร์เน็ต', qty: 1, price: payment.internet_amount });
        if (payment.other_amount > 0) items.push({ name: 'ค่าใช้จ่ายอื่นๆ', qty: 1, price: payment.other_amount });
        if (payment.late_fee_amount > 0) items.push({ name: 'ค่าปรับล่าช้า', qty: 1, price: payment.late_fee_amount });

        const totalAmount = payment.total_amount || 0;
        const totalText = numberToThaiText(totalAmount);

        // เช็คเกินกำหนด
        const isOverdue = payment.status === 'overdue' || (payment.status === 'pending' && new Date(payment.due_date) < new Date());

        // 3. HTML Template (Clean Version - No Signatures)
        const htmlContent = `
        <!DOCTYPE html>
        <html lang="th">
        <head>
            <meta charset="UTF-8">
            <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
            <style>
                * { box-sizing: border-box; }
                body { font-family: 'Sarabun', sans-serif; padding: 30px; background: #fff; color: #333; }
                .container { max-width: 800px; margin: 0 auto; background: white; }
                
                /* Header Layout */
                .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px; }
                .logo-section { display: flex; gap: 15px; width: 70%; }
                .logo { width: 45px; height: 45px; object-fit: contain; margin-top: 5px; }
                .building-info h1 { font-size: 18px; font-weight: bold; margin: 0 0 5px 0; color: #1e293b; }
                .lessor-info { font-size: 12px; color: #64748b; line-height: 1.4; margin: 0; }
                
                .invoice-label { text-align: right; width: 30%; }
                .invoice-label h2 { font-size: 18px; color: #2563eb; font-weight: bold; margin: 0; }
                .invoice-label span { font-size: 12px; color: #2563eb; font-weight: 600; }

                /* Meta Data (Invoice No, Date) - เรียงแบบรูปที่ 1 */
                .meta-box { background: #f8fafc; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; display: flex; justify-content: space-between; font-size: 12px; border: 1px solid #e2e8f0; }
                .meta-item strong { color: #1e293b; margin-right: 5px; }
                .meta-item span { color: #475569; }
                .due-date { color: #dc2626 !important; font-weight: bold; }

                /* Customer Box */
                .customer-box { background: #f8fafc; border-radius: 8px; padding: 16px; margin-bottom: 25px; border: 1px solid #e2e8f0; }
                .cust-label { font-size: 11px; color: #64748b; font-weight: 600; margin-bottom: 6px; text-transform: uppercase; }
                .cust-name { font-size: 14px; font-weight: bold; color: #0f172a; margin-bottom: 4px; }
                .cust-detail { font-size: 12px; color: #475569; line-height: 1.5; }

                /* Table */
                table { width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 12px; }
                th { text-align: left; padding: 10px; border-bottom: 2px solid #cbd5e1; color: #334155; font-weight: 600; }
                td { padding: 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; color: #1e293b; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .col-total { font-weight: 600; }

                /* Summary Section */
                .summary-container { display: flex; justify-content: flex-end; margin-bottom: 20px; }
                .summary-box { text-align: right; border-top: 2px solid #cbd5e1; padding-top: 10px; min-width: 250px; }
                .summary-label { font-size: 13px; font-weight: bold; color: #1e293b; margin-right: 15px; }
                .summary-amount { font-size: 20px; font-weight: bold; color: #2563eb; }
                .thai-baht-text { text-align: right; font-size: 12px; color: #64748b; margin-top: 4px; font-style: italic; }

                /* Bank Info Box */
                .payment-box { background: #eff6ff; border: 1px solid #dbeafe; border-radius: 8px; padding: 12px 16px; margin-bottom: 20px; font-size: 12px; display: flex; align-items: center; gap: 10px; }
                .payment-icon { font-size: 16px; }
                .payment-text span { margin-right: 12px; color: #334155; }
                .payment-text strong { color: #1e293b; }

                /* Footer Notes */
                .notes { font-size: 11px; color: #94a3b8; margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 15px; line-height: 1.6; }
                .credit { text-align: center; margin-top: 15px; font-size: 10px; color: #cbd5e1; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo-section">
                        <img src="${escapeHtml(logoUrl)}" class="logo" />
                        <div class="building-info">
                            <h1>${escapeHtml(buildingName)}</h1>
                            <p class="lessor-info"><strong>${escapeHtml(lessorName)}</strong></p>
                            <p class="lessor-info">${escapeHtml(lessorAddr)}</p>
                        </div>
                    </div>
                    <div class="invoice-label">
                        <h2>ใบแจ้งหนี้</h2>
                        <span>INVOICE</span>
                    </div>
                </div>

                <div class="meta-box">
                    <div class="meta-item">
                        <strong>เลขที่:</strong> <span>${escapeHtml(invoiceNo)}</span>
                    </div>
                    <div class="meta-item">
                        <strong>วันที่ออก:</strong> <span>${escapeHtml(issueDate)}</span>
                    </div>
                    <div class="meta-item">
                        <strong>ครบกำหนด:</strong> <span class="due-date">${escapeHtml(dueDate)}</span>
                    </div>
                </div>

                <div class="customer-box">
                    <div class="cust-label">ผู้เช่า / Customer</div>
                    <div class="cust-name">${escapeHtml(tenant.full_name || 'ไม่ระบุชื่อ')}</div>
                    <div class="cust-detail">ห้อง: ${escapeHtml(room.room_number || '-')}</div>
                    <div class="cust-detail">โทร: ${escapeHtml(tenant.phone || '-')}</div>
                    <div class="cust-detail">ที่อยู่: ${escapeHtml(tenant.address || 'ไม่ระบุ')}</div>
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

                <div class="summary-container">
                    <div class="summary-box">
                        <span class="summary-label">รวมทั้งสิ้น</span>
                        <span class="summary-amount">${totalAmount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
                        <div class="thai-baht-text">(${totalText})</div>
                    </div>
                </div>

                <div class="payment-box">
                    <span class="payment-icon">💳</span>
                    <div class="payment-text">
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

        // 4. สร้างรูปภาพผ่าน Browserless
        const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
        if (!BROWSERLESS_API_KEY) throw new Error("BROWSERLESS_API_KEY not set");

        const browserlessResponse = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                html: htmlContent,
                options: { 
                    type: 'png', 
                    fullPage: true, 
                    omitBackground: true,
                    viewport: { width: 800, height: 1000 } // Fix width to ensure consistent layout
                }
            })
        });

        if (!browserlessResponse.ok) throw new Error(await browserlessResponse.text());

        const imageBlob = await browserlessResponse.blob();
        const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });

        // 5. อัปโหลดรูปภาพ
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        
        // 6. อัปเดตข้อมูล Payment
        const newHash = generatePaymentHash(payment);
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