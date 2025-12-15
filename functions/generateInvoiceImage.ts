import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ฟังก์ชันแปลงตัวเลขเป็นตัวหนังสือไทย
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
          if (digit === 1) {
            result += 'สิบ';
          } else if (digit === 2) {
            result += 'ยี่สิบ';
          } else {
            result += numbers[digit] + positions[position];
          }
        } else if (position === 0 && digit === 1 && len > 1 && parseInt(numStr[len-2]) !== 0) {
          result += 'เอ็ด';
        } else {
          result += numbers[digit] + positions[position];
        }
      }
      
      return result;
    }
    
    let text = convertInteger(integerPart) + 'บาท';
    
    if (decimalPart > 0) {
      text += convertInteger(decimalPart) + 'สตางค์';
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

// ⭐ ฟังก์ชันสร้าง hash จากข้อมูลบิล เพื่อตรวจจับการเปลี่ยนแปลง
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
    // Simple hash: JSON string แล้ว encode เป็น base64
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32); // เอาแค่ 32 ตัวแรก
}

function formatDate(dateString) {
    if (!dateString) return 'ไม่ระบุ';
    
    try {
      const date = new Date(dateString);
      const thaiMonths = [
        'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
        'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
      ];
      
      const day = date.getDate();
      const month = thaiMonths[date.getMonth()];
      const year = date.getFullYear() + 543;
      
      return `${day} ${month} ${year}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'ไม่ระบุ';
    }
}

Deno.serve(async (req) => {
    const startTime = Date.now();
    console.log('🚀 === START generateInvoiceImage ===');
    
    try {
        const base44 = createClientFromRequest(req);
        console.log('✅ Running in service role mode');

        // Parse request body
        console.log('📥 Parsing request body...');
        let paymentId;
        try {
            const body = await req.json();
            paymentId = body.paymentId;
            console.log('✅ PaymentId:', paymentId);
        } catch (parseError) {
            console.error('❌ JSON parse error:', parseError);
            return Response.json({ 
                success: false,
                error: 'รูปแบบข้อมูลไม่ถูกต้อง',
                message: parseError.message
            }, { status: 400 });
        }

        if (!paymentId) {
            console.error('❌ Missing paymentId');
            return Response.json({ 
                success: false,
                error: 'ไม่พบ Payment ID',
                message: 'Missing paymentId'
            }, { status: 400 });
        }

        // ⭐ ใช้ getPublicInvoice เพื่อให้ได้ข้อมูลเหมือนกับหน้า Invoice ในแอป
        console.log('📥 Fetching invoice data via getPublicInvoice...');
        
        let invoiceData;
        try {
            const invoiceResponse = await base44.asServiceRole.functions.invoke('getPublicInvoice', {
                paymentId: paymentId
            });
            
            if (!invoiceResponse.data?.success) {
                console.error('❌ getPublicInvoice failed:', invoiceResponse.data?.error);
                return Response.json({ 
                    success: false,
                    error: invoiceResponse.data?.error || 'ไม่พบข้อมูลใบแจ้งหนี้',
                    message: 'Failed to fetch invoice data'
                }, { status: 404 });
            }
            
            invoiceData = invoiceResponse.data.invoice;
            console.log('✅ Invoice data fetched successfully');
        } catch (fetchError) {
            console.error('❌ Error calling getPublicInvoice:', fetchError);
            return Response.json({ 
                success: false,
                error: 'ไม่สามารถดึงข้อมูลใบแจ้งหนี้ได้',
                message: fetchError.message
            }, { status: 500 });
        }

        // ⭐ ไม่ใช้รูปเก่า - สร้างใหม่ทุกครั้งเพื่อให้ข้อมูลตรงกับแอป
        // (เพราะอาจมีการแก้ไขข้อมูล Config หรือรูปแบบใบแจ้งหนี้)

        // ใช้ข้อมูลจาก invoiceData (เหมือนกับ pages/Invoice.js)
        const payment = invoiceData;
        const room = invoiceData.room;
        const tenant = invoiceData.tenant;
        const bank = invoiceData.bank;
        const recipient = invoiceData.recipient || {};

        console.log('✅ Room:', room.room_number, 'Tenant:', tenant.full_name);

        // ใช้ข้อมูลจาก recipient (เหมือนกับหน้าแอป)
        const buildingName = recipient.building_name || 'W RESIDENTS';
        const buildingLogo = recipient.building_logo || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
        const buildingAddress = recipient.building_address || '';
        const buildingPhone = recipient.building_phone || '';
        const companyName = recipient.company_name || '';
        const taxId = recipient.tax_id || '';
        const companyRegistrationNumber = recipient.company_registration_number || '';
        
        // ข้อมูลธนาคาร
        const bankName = bank.name || 'กสิกรไทย';
        const bankAccountNumber = bank.account_number || '';
        const bankAccountName = bank.account_name || '';

        console.log('✅ Config loaded from getPublicInvoice');

        // สร้างข้อมูลใบแจ้งหนี้
        const invoiceNumber = `INV-${payment.id.slice(0, 8).toUpperCase()}`;
        const issueDateText = formatDate(new Date().toISOString().split('T')[0]);
        const dueDateText = formatDate(payment.due_date);

        // คำนวณวันเกินกำหนด
        const isOverdue = payment.status === 'pending' && payment.due_date && 
            new Date() > new Date(payment.due_date);
        const daysOverdue = isOverdue ? 
            Math.ceil((new Date() - new Date(payment.due_date)) / (1000 * 60 * 60 * 24)) : 0;

        console.log('🎨 Building line items...');
        const lineItems = [];
        
        if (payment.rent_amount && payment.rent_amount > 0) {
            lineItems.push({
                name: 'ค่าเช่า',
                quantity: 1,
                price: payment.rent_amount,
                total: payment.rent_amount
            });
        }
        
        // ⭐ เช็คค่าขั้นต่ำเหมือนหน้าแอป + แสดงมิเตอร์ก่อน-หลัง
        if (payment.electricity_amount && payment.electricity_amount > 0) {
            const calculatedElecAmount = (payment.electricity_units || 0) * (payment.electricity_rate || 0);
            const isElecMinimum = (payment.electricity_units || 0) === 0 || Math.abs(calculatedElecAmount - payment.electricity_amount) > 0.01;
            const elecMeterText = (payment.electricity_previous || payment.electricity_current) 
                ? ` (${payment.electricity_previous}-${payment.electricity_current})` 
                : '';
            
            lineItems.push({
                name: isElecMinimum 
                    ? `ค่าไฟฟ้า${elecMeterText} ใช้ ${payment.electricity_units || 0} หน่วย - คิดขั้นต่ำ`
                    : `ค่าไฟฟ้า${elecMeterText} ${payment.electricity_units || 0} หน่วย × ${payment.electricity_rate || 0} บาท`,
                quantity: 1,
                price: payment.electricity_amount,
                total: payment.electricity_amount
            });
        }
        
        if (payment.water_amount && payment.water_amount > 0) {
            const calculatedWaterAmount = (payment.water_units || 0) * (payment.water_rate || 0);
            const isWaterMinimum = (payment.water_units || 0) === 0 || Math.abs(calculatedWaterAmount - payment.water_amount) > 0.01;
            const waterMeterText = (payment.water_previous || payment.water_current) 
                ? ` (${payment.water_previous}-${payment.water_current})` 
                : '';
            
            lineItems.push({
                name: isWaterMinimum 
                    ? `ค่าน้ำประปา${waterMeterText} ใช้ ${payment.water_units || 0} หน่วย - คิดขั้นต่ำ`
                    : `ค่าน้ำประปา${waterMeterText} ${payment.water_units || 0} หน่วย × ${payment.water_rate || 0} บาท`,
                quantity: 1,
                price: payment.water_amount,
                total: payment.water_amount
            });
        }
        
        if (payment.internet_amount && payment.internet_amount > 0) {
            lineItems.push({
                name: 'ค่าอินเทอร์เน็ต',
                quantity: 1,
                price: payment.internet_amount,
                total: payment.internet_amount
            });
        }
        
        // ⭐ เพิ่มค่าส่วนกลาง (ถ้ามี)
        if (payment.common_fee_amount && payment.common_fee_amount > 0) {
            lineItems.push({
                name: 'ค่าส่วนกลาง',
                quantity: 1,
                price: payment.common_fee_amount,
                total: payment.common_fee_amount
            });
        }

        // ⭐ เพิ่มค่าที่จอดรถ (ถ้ามี)
        if (payment.parking_fee_amount && payment.parking_fee_amount > 0) {
            lineItems.push({
                name: 'ค่าที่จอดรถ',
                quantity: 1,
                price: payment.parking_fee_amount,
                total: payment.parking_fee_amount
            });
        }

        if (payment.other_amount && payment.other_amount > 0) {
            lineItems.push({
                name: 'ค่าใช้จ่ายอื่นๆ',
                quantity: 1,
                price: payment.other_amount,
                total: payment.other_amount
            });
        }
        if (payment.late_fee_amount && payment.late_fee_amount > 0) {
            lineItems.push({
                name: 'ค่าปรับชำระล่าช้า',
                quantity: 1,
                price: payment.late_fee_amount,
                total: payment.late_fee_amount
            });
        }

        console.log('✅ Line items created:', lineItems.length, 'items');

        // สร้าง HTML (รูปแบบเหมือนกับ pages/Invoice.js)
        console.log('🎨 Building HTML content...');
        const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ใบแจ้งหนี้</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Sarabun', 'Tahoma', sans-serif; padding: 12px; background-color: #f1f5f9; }
.container { max-width: 600px; margin: 0 auto; padding: 16px; background: white; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
.header { margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; }
.header-top { display: flex; justify-content: space-between; align-items: start; gap: 12px; margin-bottom: 12px; }
.logo-section { display: flex; align-items: center; gap: 8px; }
.logo { width: 40px; height: 40px; object-fit: contain; }
.company-name { font-size: 18px; font-weight: bold; color: #1e293b; }
.invoice-title { text-align: right; }
.invoice-title h2 { font-size: 16px; font-weight: bold; color: #2563eb; }
.invoice-title p { font-size: 11px; color: #2563eb; font-weight: 600; }
.issuer-info { font-size: 11px; color: #64748b; line-height: 1.5; }
.issuer-info .company-name-text { font-weight: 600; color: #1e293b; }
.invoice-meta { margin-top: 12px; font-size: 11px; line-height: 1.6; }
.invoice-meta .label { font-weight: 600; }
.invoice-meta .due-date { color: #dc2626; font-weight: bold; }
.overdue-warning { background: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 12px; margin-bottom: 12px; display: flex; align-items: start; gap: 8px; }
.overdue-warning .icon { color: #dc2626; font-size: 18px; }
.overdue-warning .text-bold { font-size: 13px; font-weight: bold; color: #991b1b; }
.overdue-warning .text-small { font-size: 11px; color: #b91c1c; }
.customer-section { margin-bottom: 12px; }
.customer-section h3 { font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 6px; }
.customer-box { background: #f8fafc; border-radius: 8px; padding: 12px; }
.customer-box .name { font-weight: bold; font-size: 13px; color: #1e293b; }
.customer-box .detail { font-size: 11px; color: #64748b; margin-top: 2px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
table th { padding: 8px 4px; text-align: left; font-weight: 600; color: #334155; border-bottom: 2px solid #cbd5e1; }
table td { padding: 8px 4px; border-bottom: 1px solid #e2e8f0; }
table .text-center { text-align: center; }
table .text-right { text-align: right; }
table .font-semibold { font-weight: 600; color: #1e293b; }
.total-section { display: flex; justify-content: flex-end; margin-bottom: 12px; }
.total-box { border-top: 2px solid #cbd5e1; padding-top: 8px; }
.total-row { display: flex; justify-content: space-between; align-items: center; gap: 24px; }
.total-label { font-weight: bold; font-size: 13px; color: #1e293b; }
.total-amount { font-weight: bold; font-size: 18px; color: ${isOverdue ? '#dc2626' : '#2563eb'}; }
.payment-info { background: #eff6ff; border-radius: 8px; padding: 8px 12px; margin-bottom: 12px; border: 1px solid #bfdbfe; }
.payment-info .label { font-size: 10px; color: #64748b; margin-bottom: 4px; }
.payment-info .details { font-size: 10px; display: flex; flex-wrap: wrap; gap: 12px; }
.payment-info .details span { white-space: nowrap; }
.payment-info .details .value { font-weight: 600; }
.notes-section { background: #f8fafc; border-radius: 8px; padding: 12px; margin-bottom: 12px; font-size: 11px; color: #64748b; }
.notes-section .title { font-weight: 600; color: #334155; margin-bottom: 4px; }
.footer { text-align: center; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; }
</style>
</head>
<body>
<div class="container">
<div class="header">
<div class="header-top">
<div class="logo-section">
<img src="${escapeHtml(buildingLogo)}" alt="Logo" class="logo" onerror="this.src='https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg'" />
<div>
<div class="company-name">${escapeHtml(buildingName)}</div>
<div style="font-size: 11px; color: #64748b;">ระบบจัดการที่พักอาศัย</div>
</div>
</div>
<div class="invoice-title">
<h2>ใบแจ้งหนี้</h2>
<p>INVOICE</p>
</div>
</div>
<div class="issuer-info">
${companyName ? `<p class="company-name-text">${escapeHtml(companyName)}</p>` : ''}
<p>${escapeHtml(buildingAddress)}</p>
${buildingPhone ? `<p>โทร: ${escapeHtml(buildingPhone)}</p>` : ''}
${taxId ? `<p>เลขประจำตัวผู้เสียภาษี: ${escapeHtml(taxId)}</p>` : ''}
${companyRegistrationNumber ? `<p>เลขทะเบียนนิติบุคคล: ${escapeHtml(companyRegistrationNumber)}</p>` : ''}
</div>
<div class="invoice-meta">
<p><span class="label">เลขที่:</span> ${escapeHtml(invoiceNumber)}</p>
<p><span class="label">วันที่ออก:</span> ${escapeHtml(issueDateText)}</p>
<p><span class="label due-date">ครบกำหนด:</span> <span class="due-date">${escapeHtml(dueDateText)}</span></p>
</div>
</div>
${isOverdue ? `<div class="overdue-warning">
<span class="icon">⚠️</span>
<div>
<p class="text-bold">เกินกำหนดชำระแล้ว ${daysOverdue} วัน</p>
<p class="text-small">กรุณาชำระเงินโดยเร็วที่สุด</p>
</div>
</div>` : ''}
<div class="customer-section">
<h3>ผู้เช่า / Customer</h3>
<div class="customer-box">
<p class="name">${escapeHtml(tenant.full_name)}</p>
<p class="detail">ห้อง ${escapeHtml(room.room_number)}</p>
<p class="detail">โทร: ${escapeHtml(tenant.phone || 'ไม่ระบุ')}</p>
<p class="detail">ที่อยู่: ${escapeHtml(tenant.address && tenant.address !== 'ไม่ระบุ' ? tenant.address : 'ไม่ระบุ')}</p>
${tenant.national_id ? `<p class="detail">เลขประจำตัวผู้เสียภาษี: ${escapeHtml(tenant.national_id)}</p>` : ''}
</div>
</div>
<table>
<thead>
<tr>
<th>ลำดับ</th>
<th>รายการ</th>
<th class="text-center">จำนวน</th>
<th class="text-right">ราคา/หน่วย</th>
<th class="text-right">จำนวนเงิน</th>
</tr>
</thead>
<tbody>
${lineItems.map((item, index) => `<tr>
<td>${index + 1}</td>
<td>${escapeHtml(item.name)}</td>
<td class="text-center">${item.quantity}</td>
<td class="text-right">${(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
<td class="text-right font-semibold">${(item.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
</tr>`).join('')}
</tbody>
</table>
<div class="total-section">
<div class="total-box">
<div class="total-row">
<span class="total-label">รวมทั้งสิ้น</span>
<span class="total-amount">${(payment.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
</div>
</div>
</div>
<div class="payment-info">
<p class="label">💳 ช่องทางการชำระเงิน</p>
<div class="details">
<span><span style="color: #64748b;">ธนาคาร:</span> <span class="value">${escapeHtml(bankName)}</span></span>
<span><span style="color: #64748b;">เลขบัญชี:</span> <span class="value">${escapeHtml(bankAccountNumber)}</span></span>
<span><span style="color: #64748b;">ชื่อ:</span> <span class="value">${escapeHtml(bankAccountName)}</span></span>
</div>
</div>
<div class="notes-section">
<p class="title">หมายเหตุ:</p>
<p>1. กรุณาชำระเงินภายในวันที่กำหนด</p>
<p>2. กรุณาแนบหลักฐานการโอนเงินทุกครั้ง</p>
<p>3. หากมีข้อสงสัยกรุณาติดต่อเจ้าของหอพัก</p>
</div>
<div class="footer">
<p>ขอบคุณที่ใช้บริการ ${escapeHtml(buildingName)}</p>
<p style="margin-top: 2px;">เอกสารนี้สร้างโดยระบบอัตโนมัติ</p>
</div>
</div>
</body>
</html>`;
        
        console.log('✅ HTML content built, length:', htmlContent.length, 'chars');

        // ตรวจสอบ API Key
        const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
        if (!BROWSERLESS_API_KEY) {
            console.error("❌ BROWSERLESS_API_KEY not set");
            return Response.json({ 
                success: false, 
                error: "BROWSERLESS_API_KEY ยังไม่ได้ตั้งค่า" 
            }, { status: 500 });
        }
        console.log('✅ BROWSERLESS_API_KEY found');

        // เรียก Browserless.io API พร้อม retry logic
        console.log('🖼️ Calling Browserless.io...');
        
        const endpoints = [
            { name: 'SFO (US West)', url: `https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}` },
            { name: 'LON (Europe UK)', url: `https://production-lon.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}` },
            { name: 'AMS (Europe)', url: `https://production-ams.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}` }
        ];
        
        let browserlessResponse = null;
        let lastError = null;
        const maxRetries = 3;
        
        for (const endpoint of endpoints) {
            let retryCount = 0;
            
            while (retryCount < maxRetries) {
                try {
                    const attemptNum = retryCount + 1;
                    console.log(`🔄 Trying ${endpoint.name} (Attempt ${attemptNum}/${maxRetries}):`, endpoint.url.split('?')[0]);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 45000);
                    
                    browserlessResponse = await fetch(endpoint.url, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Cache-Control': 'no-cache'
                        },
                        body: JSON.stringify({
                            html: htmlContent,
                            options: {
                                type: 'png',
                                fullPage: true
                            }
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);
                    console.log(`📥 ${endpoint.name} response status:`, browserlessResponse.status);

                    if (browserlessResponse.ok) {
                        console.log(`✅ Success with ${endpoint.name} on attempt ${attemptNum}`);
                        break;
                    }
                    
                    const errorText = await browserlessResponse.text();
                    lastError = `${endpoint.name} - Status ${browserlessResponse.status}: ${errorText}`;
                    console.error(`❌ Attempt ${attemptNum} failed with ${endpoint.name}:`, lastError);
                    
                    // ถ้า 404 หรือ 429 = retry
                    if (browserlessResponse.status === 404 || browserlessResponse.status === 429) {
                        retryCount++;
                        if (retryCount < maxRetries) {
                            const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
                            console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                            await new Promise(resolve => setTimeout(resolve, waitTime));
                        }
                    } else {
                        break; // ถ้าไม่ใช่ 404/429 = ข้ามไป endpoint ถัดไป
                    }
                    
                } catch (error) {
                    if (error.name === 'AbortError') {
                        lastError = `${endpoint.name} - Timeout after 45s`;
                    } else {
                        lastError = `${endpoint.name} - ${error.message}`;
                    }
                    console.error(`❌ Exception with ${endpoint.name} (Attempt ${retryCount + 1}):`, error.message);
                    
                    retryCount++;
                    if (retryCount < maxRetries) {
                        const waitTime = Math.pow(2, retryCount) * 1000;
                        console.log(`⏳ Waiting ${waitTime}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }
                }
            }
            
            // ถ้าสำเร็จ = break ออกจาก endpoint loop
            if (browserlessResponse && browserlessResponse.ok) break;
        }

        if (!browserlessResponse || !browserlessResponse.ok) {
            console.error('❌ All regions failed. Last error:', lastError);
            return Response.json({ 
                success: false,
                error: 'ไม่สามารถสร้างรูปภาพใบแจ้งหนี้ได้ (ลองทุก region แล้ว)',
                details: lastError || 'All endpoints failed',
                api_key_set: !!BROWSERLESS_API_KEY
            }, { status: 500 });
        }

        console.log('✅ Screenshot generated');

        // แปลงเป็น Blob และอัปโหลด
        const imageBlob = await browserlessResponse.blob();
        const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });
        console.log('✅ Image blob created, size:', imageBlob.size, 'bytes');

        console.log('📤 Uploading image...');
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        console.log('✅ Image uploaded:', file_url);

        // บันทึก URL และ hash ลง database
        console.log('💾 Updating payment...');
        const newHash = generatePaymentHash(payment);
        await base44.asServiceRole.entities.Payment.update(paymentId, {
            invoice_image_url: file_url,
            invoice_data_hash: newHash
        });
        console.log('✅ Payment updated with hash:', newHash);

        const elapsed = Date.now() - startTime;
        console.log(`⏱️ Total time: ${elapsed}ms`);
        console.log('🎉 === SUCCESS ===');

        return Response.json({ 
            success: true,
            message: 'สร้างรูปภาพใบแจ้งหนี้สำเร็จ',
            invoice_image_url: file_url
        });

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error('💥 === ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        console.log(`⏱️ Failed after: ${elapsed}ms`);
        
        return Response.json({ 
            success: false,
            error: 'เกิดข้อผิดพลาด',
            message: error.message
        }, { status: 500 });
    }
});