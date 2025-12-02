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

// ฟังก์ชัน escape HTML
function escapeHtml(text) {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ฟังก์ชันจัดรูปแบบวันที่
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
    console.log('🚀 === START generateReceiptImage ===');
    
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

        // ดึงข้อมูล Payment โดยตรง
        console.log('📥 Fetching payment data...');
        let payments = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
        
        if (!Array.isArray(payments)) {
            payments = [payments];
        }
        
        const payment = payments.length > 0 ? payments[0] : null;

        if (!payment) {
            console.error('❌ Payment not found');
            return Response.json({ 
                success: false,
                error: 'ไม่พบข้อมูลการชำระเงิน',
                message: 'Payment not found'
            }, { status: 404 });
        }
        console.log('✅ Payment found, status:', payment.status);

        if (payment.status !== 'paid') {
            console.error('❌ Payment not paid, status:', payment.status);
            return Response.json({ 
                success: false,
                error: 'รายการนี้ยังไม่ได้ชำระเงิน',
                message: 'Payment is not paid yet',
                currentStatus: payment.status
            }, { status: 400 });
        }

        // ⭐ ใช้ getPublicInvoice เพื่อให้ได้ข้อมูลเหมือนกับหน้า Invoice/Receipt ในแอป
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
            console.log('📋 Tenant address from getPublicInvoice:', invoiceData.tenant?.address);
        } catch (fetchError) {
            console.error('❌ Error calling getPublicInvoice:', fetchError);
            return Response.json({ 
                success: false,
                error: 'ไม่สามารถดึงข้อมูลใบแจ้งหนี้ได้',
                message: fetchError.message
            }, { status: 500 });
        }

        // ⭐ ใช้ข้อมูลจาก invoiceData (เหมือนกับ pages/Receipt.js)
        const room = invoiceData.room;
        const tenant = invoiceData.tenant;
        const bank = invoiceData.bank;
        const recipient = invoiceData.recipient || {};

        console.log('✅ Room:', room.room_number, 'Tenant:', tenant.full_name, 'Tenant address:', tenant.address);

        // ใช้ข้อมูลจาก recipient (เหมือนกับหน้าแอป)
        const buildingName = recipient.building_name || 'W RESIDENTS';
        const buildingLogo = recipient.building_logo || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
        const buildingAddress = recipient.building_address || '';
        const buildingPhone = recipient.building_phone || '';
        const companyName = recipient.company_name || '';
        const taxId = recipient.tax_id || '';
        const companyRegistrationNumber = recipient.company_registration_number || '';
        const lessorName = recipient.lessor_name || '';
        const lessorAddress = recipient.lessor_address || buildingAddress;
        
        // ข้อมูลธนาคาร
        const bankName = bank.name || 'กสิกรไทย';
        const bankAccountNumber = bank.account_number || '';
        const bankAccountName = bank.account_name || '';

        console.log('✅ Config loaded from getPublicInvoice');

        // สร้างข้อมูลใบเสร็จ
        const receiptNumber = `REC-${payment.id.slice(0, 8).toUpperCase()}`;
        const paymentDateText = formatDate(payment.payment_date);

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
        
        // ⭐ เช็คค่าขั้นต่ำเหมือนกับ generateInvoiceImage + แสดงมิเตอร์ก่อน-หลัง
        if (payment.electricity_amount && payment.electricity_amount > 0) {
            const calculatedElecAmount = (payment.electricity_units || 0) * (payment.electricity_rate || 0);
            const isElecMinimum = (payment.electricity_units || 0) === 0 || Math.abs(calculatedElecAmount - payment.electricity_amount) > 0.01;
            const elecMeterText = (invoiceData.electricity_previous || invoiceData.electricity_current) 
                ? ` (${invoiceData.electricity_previous}-${invoiceData.electricity_current})` 
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
            const waterMeterText = (invoiceData.water_previous || invoiceData.water_current) 
                ? ` (${invoiceData.water_previous}-${invoiceData.water_current})` 
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

        console.log('✅ Line items created:', lineItems.length, 'items');

        // ⭐ สร้าง HTML ให้เหมือนกับ pages/Receipt.js ในแอป
        console.log('🎨 Building HTML content...');
        const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ใบเสร็จรับเงิน</title>
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
<img src="${escapeHtml(buildingLogo)}" alt="Logo" class="logo" onerror="this.src='https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg'" />
<div class="building-name">${escapeHtml(buildingName)}</div>
</div>
<div class="receipt-title">
<h2>ใบเสร็จรับเงิน</h2>
<p>Receipt</p>
</div>
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
${companyName ? `
<p class="name">${escapeHtml(companyName)}</p>
${taxId ? `<p class="detail">เลขที่ผู้เสียภาษี: ${escapeHtml(taxId)}</p>` : ''}
${companyRegistrationNumber ? `<p class="detail">เลขทะเบียนนิติบุคคล: ${escapeHtml(companyRegistrationNumber)}</p>` : ''}
<p class="detail">${escapeHtml(recipient.company_address || buildingAddress)}</p>
` : `
<p class="name">${escapeHtml(bankAccountName || lessorName || buildingName)}</p>
<p class="detail">${escapeHtml(lessorAddress || buildingAddress)}</p>
`}
</div>
<div class="party-box">
<h3>ผู้จ่ายเงิน</h3>
<p class="name">${escapeHtml(tenant.full_name)}</p>
<p class="detail">ห้อง: ${escapeHtml(room.room_number)} | โทร: ${escapeHtml(tenant.phone || '-')}</p>
<p class="detail">ที่อยู่: ${escapeHtml(tenant.address && tenant.address !== '-' ? tenant.address : 'ไม่ระบุ')}</p>
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
<span>(${numberToThaiText(payment.total_amount || 0)})</span>
</div>
<div class="total-amount">${(payment.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
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

        // เรียก Browserless.io API - ลอง regions ต่างๆ
        console.log('🖼️ Calling Browserless.io...');
        console.log('🔑 API Key:', BROWSERLESS_API_KEY ? `${BROWSERLESS_API_KEY.substring(0, 10)}...` : 'NOT SET');
        
        const endpoints = [
            { name: 'SFO (US West)', url: `https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}` },
            { name: 'LON (Europe UK)', url: `https://production-lon.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}` },
            { name: 'AMS (Europe)', url: `https://production-ams.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}` }
        ];
        
        let browserlessResponse = null;
        let lastError = null;
        
        for (const endpoint of endpoints) {
            try {
                console.log(`🔄 Trying ${endpoint.name}:`, endpoint.url.split('?')[0]);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
                
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
                    console.log(`✅ Success with ${endpoint.name}`);
                    break;
                }
                
                const errorText = await browserlessResponse.text();
                lastError = `${endpoint.name} - Status ${browserlessResponse.status}: ${errorText}`;
                console.error(`❌ Failed with ${endpoint.name}:`, lastError);
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    lastError = `${endpoint.name} - Timeout after 30s`;
                } else {
                    lastError = `${endpoint.name} - ${error.message}`;
                }
                console.error(`❌ Exception with ${endpoint.name}:`, error.message);
            }
        }

        if (!browserlessResponse || !browserlessResponse.ok) {
            console.error('❌ All regions failed. Last error:', lastError);
            return Response.json({ 
                success: false,
                error: 'ไม่สามารถสร้างรูปภาพใบเสร็จได้ (ลองทุก region แล้ว)',
                details: lastError || 'All endpoints failed',
                api_key_set: !!BROWSERLESS_API_KEY
            }, { status: 500 });
        }

        console.log('✅ Screenshot generated');

        // แปลงเป็น Blob และอัปโหลด
        const imageBlob = await browserlessResponse.blob();
        const imageFile = new File([imageBlob], `receipt-${paymentId}.png`, { type: 'image/png' });
        console.log('✅ Image blob created, size:', imageBlob.size, 'bytes');

        console.log('📤 Uploading image...');
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        console.log('✅ Image uploaded:', file_url);

        // บันทึก URL ลง database
        console.log('💾 Updating payment...');
        await base44.asServiceRole.entities.Payment.update(paymentId, {
            receipt_image_url: file_url
        });
        console.log('✅ Payment updated');

        const elapsed = Date.now() - startTime;
        console.log(`⏱️ Total time: ${elapsed}ms`);
        console.log('🎉 === SUCCESS ===');

        return Response.json({ 
            success: true,
            message: 'สร้างรูปภาพใบเสร็จสำเร็จ',
            receipt_image_url: file_url
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