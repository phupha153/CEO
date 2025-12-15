import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ฟังก์ชันแปลงตัวเลขเป็นตัวหนังสือไทย (คงเดิม)
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

// ฟังก์ชัน escapeHtml (คงเดิม)
function escapeHtml(text) {
    if (!text) return '';
    return text.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
}

// ⭐ ฟังก์ชันสร้าง hash (คงเดิม)
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

// ฟังก์ชันจัดรูปแบบวันที่ (คงเดิม)
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
    console.log('🚀 === START generateInvoiceImage (Original Design Revived) ===');
    
    try {
        const base44 = createClientFromRequest(req);
        console.log('✅ Running in service role mode');

        // Parse request body (คงเดิม)
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

        // ⭐ ใช้ getPublicInvoice เพื่อให้ได้ข้อมูลเหมือนกับหน้า Invoice ในแอป (คงเดิม)
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

        // เตรียมข้อมูลสำหรับสร้างภาพ (คงเดิม)
        const payment = invoiceData;
        const room = invoiceData.room;
        const tenant = invoiceData.tenant;
        const bank = invoiceData.bank;
        const recipient = invoiceData.recipient || {};

        console.log('✅ Room:', room.room_number, 'Tenant:', tenant.full_name);

        // ใช้ข้อมูลจาก recipient (เหมือนกับหน้าแอป)
        const buildingName = recipient.building_name || 'W RESIDENTS';
        // ใช้โลโก้ Default ถ้าไม่มี
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

        // คำนวณวันเกินกำหนด (คงเดิม)
        const isOverdue = (payment.status === 'overdue' || payment.status === 'pending') && payment.due_date && 
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

        // ⭐⭐⭐ เปลี่ยน HTML ตรงนี้ ให้เป็นแบบที่คุณชอบ (แบบ sendpayment เดิม) ⭐⭐⭐
        console.log('🎨 Building HTML content (Using Original Design)...');
        const htmlContent = `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <title>ใบแจ้งหนี้</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;700&display=swap');
        body { font-family: 'Sarabun', sans-serif; }
    </style>
</head>
<body class="bg-gray-100 p-4">
    <div class="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-lg" id="invoice">
        <div class="flex justify-between items-start mb-6">
            <div class="flex items-center">
                <img src="${escapeHtml(buildingLogo)}" alt="Logo" class="w-16 h-16 object-contain mr-4" onerror="this.src='https://via.placeholder.com/64?text=Logo'">
                <div>
                    <h1 class="text-2xl font-bold text-gray-800">${escapeHtml(buildingName)}</h1>
                    <p class="text-sm text-gray-600">ระบบจัดการที่พักอาศัย</p>
                </div>
            </div>
            <div class="text-right">
                <h2 class="text-xl font-bold text-blue-600">ใบแจ้งหนี้</h2>
                <p class="text-sm text-gray-500">INVOICE</p>
            </div>
        </div>

        <div class="flex justify-between mb-6 text-sm">
            <div class="text-gray-700">
                ${companyName ? `<p class="font-bold">${escapeHtml(companyName)}</p>` : ''}
                <p>${escapeHtml(buildingAddress)}</p>
                ${buildingPhone ? `<p>โทร: ${escapeHtml(buildingPhone)}</p>` : ''}
                ${taxId ? `<p>เลขประจำตัวผู้เสียภาษี: ${escapeHtml(taxId)}</p>` : ''}
            </div>
            <div class="text-right text-gray-700">
                <p><span class="font-bold">เลขที่:</span> ${escapeHtml(invoiceNumber)}</p>
                <p><span class="font-bold">วันที่ออก:</span> ${escapeHtml(issueDateText)}</p>
                <p class="${isOverdue ? 'text-red-600 font-bold' : ''}"><span class="font-bold">ครบกำหนด:</span> ${escapeHtml(dueDateText)}</p>
            </div>
        </div>

        ${isOverdue ? `
        <div class="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
            <div class="flex">
                <div class="flex-shrink-0">
                    <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                </div>
                <div class="ml-3">
                    <p class="text-sm text-red-700">
                        <span class="font-bold">เกินกำหนดชำระแล้ว ${daysOverdue} วัน</span>
                        กรุณาชำระเงินโดยเร็วที่สุด
                    </p>
                </div>
            </div>
        </div>
        ` : ''}

        <div class="mb-6 bg-gray-50 p-4 rounded">
            <h3 class="text-sm font-bold text-gray-700 mb-2">ผู้เช่า / Customer</h3>
            <p class="text-lg font-bold text-gray-800">${escapeHtml(tenant.full_name)}</p>
            <p class="text-sm text-gray-600">ห้อง ${escapeHtml(room.room_number)}</p>
            <p class="text-sm text-gray-600">โทร: ${escapeHtml(tenant.phone || '-')}</p>
        </div>

        <table class="w-full mb-6">
            <thead>
                <tr class="border-b-2 border-gray-300">
                    <th class="text-left py-2 text-sm font-bold text-gray-700">ลำดับ</th>
                    <th class="text-left py-2 text-sm font-bold text-gray-700 w-1/2">รายการ</th>
                    <th class="text-center py-2 text-sm font-bold text-gray-700">จำนวน</th>
                    <th class="text-right py-2 text-sm font-bold text-gray-700">ราคา/หน่วย</th>
                    <th class="text-right py-2 text-sm font-bold text-gray-700">จำนวนเงิน</th>
                </tr>
            </thead>
            <tbody>
                ${lineItems.map((item, index) => `
                <tr class="border-b border-gray-200">
                    <td class="py-2 text-sm text-gray-700">${index + 1}</td>
                    <td class="py-2 text-sm text-gray-700">${escapeHtml(item.name)}</td>
                    <td class="text-center py-2 text-sm text-gray-700">${item.quantity}</td>
                    <td class="text-right py-2 text-sm text-gray-700">${(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    <td class="text-right py-2 text-sm font-bold text-gray-800">${(item.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="flex justify-end mb-6">
            <div class="w-1/2">
                <div class="flex justify-between py-2 border-t-2 border-gray-300">
                    <span class="text-lg font-bold text-gray-800">รวมทั้งสิ้น</span>
                    <span class="text-2xl font-bold ${isOverdue ? 'text-red-600' : 'text-blue-600'}">${(payment.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿</span>
                </div>
                <div class="text-right text-sm text-gray-600 mt-1">
                    (${numberToThaiText(payment.total_amount)})
                </div>
            </div>
        </div>

        <div class="mb-6 bg-blue-50 p-4 rounded border border-blue-200">
            <h3 class="text-sm font-bold text-gray-700 mb-2">💳 ช่องทางการชำระเงิน</h3>
            <div class="flex flex-wrap gap-4 text-sm">
                <p><span class="text-gray-600">ธนาคาร:</span> <span class="font-bold">${escapeHtml(bankName)}</span></p>
                <p><span class="text-gray-600">เลขบัญชี:</span> <span class="font-bold">${escapeHtml(bankAccountNumber)}</span></p>
                <p><span class="text-gray-600">ชื่อบัญชี:</span> <span class="font-bold">${escapeHtml(bankAccountName)}</span></p>
            </div>
        </div>

        <div class="text-xs text-gray-500">
            <p class="font-bold mb-1">หมายเหตุ:</p>
            <ol class="list-decimal list-inside">
                <li>กรุณาชำระเงินภายในวันที่กำหนด</li>
                <li>กรุณาแนบหลักฐานการโอนเงินทุกครั้ง</li>
                <li>หากมีข้อสงสัยกรุณาติดต่อเจ้าของหอพัก</li>
            </ol>
        </div>
        
        <div class="text-center text-xs text-gray-400 mt-6 border-t pt-4">
            เอกสารนี้สร้างโดยระบบอัตโนมัติ | ${escapeHtml(buildingName)}
        </div>
    </div>
</body>
</html>`;
        
        console.log('✅ HTML content built, length:', htmlContent.length, 'chars');

        // ตรวจสอบ API Key (คงเดิม)
        const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
        if (!BROWSERLESS_API_KEY) {
            console.error("❌ BROWSERLESS_API_KEY not set");
            return Response.json({ 
                success: false, 
                error: "BROWSERLESS_API_KEY ยังไม่ได้ตั้งค่า" 
            }, { status: 500 });
        }
        console.log('✅ BROWSERLESS_API_KEY found');

        // เรียก Browserless.io API พร้อม retry logic (คงเดิม)
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
                                fullPage: true,
                                // ⭐ เพิ่ม options เพื่อให้รอโหลด font และ tailwind
                                waitUntil: 'networkidle0' 
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

        // แปลงเป็น Blob และอัปโหลด (คงเดิม)
        const imageBlob = await browserlessResponse.blob();
        const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });
        console.log('✅ Image blob created, size:', imageBlob.size, 'bytes');

        console.log('📤 Uploading image...');
        const { file_url } = await base44.integrations.Core.UploadFile({ file: imageFile });
        console.log('✅ Image uploaded:', file_url);

        // บันทึก URL และ hash ลง database (คงเดิม)
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