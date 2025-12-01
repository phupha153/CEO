import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ฟังก์ชันสำหรับสร้างรูปใบแจ้งหนี้และส่ง LINE แบบ Queue
 * - ดึง Payment ที่ invoice_image_status = 'pending' และยังไม่ส่ง LINE
 * - สร้างรูปทีละ 1 รูป (ตามข้อจำกัด Browserless Free tier)
 * - ส่ง LINE หลังสร้างรูปเสร็จ
 * 
 * เรียกใช้งานจาก:
 * 1. Cron Job (ทุก 2 นาที)
 * 2. ปุ่มกดจากหน้า UI
 * 
 * @version 2.0 - Fixed deployment issue
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32);
}

// ⭐ ฟังก์ชันสร้างรูป invoice แบบ inline (ไม่เรียก generateInvoiceImage แยก)
async function generateInvoiceScreenshot(base44, paymentId, invoice) {
    const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
    if (!BROWSERLESS_API_KEY) {
        throw new Error("BROWSERLESS_API_KEY not set");
    }

    // ใช้ข้อมูลจาก invoice object
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
            const day = date.getDate();
            const month = thaiMonths[date.getMonth()];
            const year = date.getFullYear() + 543;
            return `${day} ${month} ${year}`;
        } catch { return 'ไม่ระบุ'; }
    };

    const invoiceNumber = `INV-${paymentId.slice(0, 8).toUpperCase()}`;
    const issueDateText = formatDate(new Date().toISOString().split('T')[0]);
    const dueDateText = formatDate(payment.due_date);
    const isOverdue = payment.status === 'pending' && payment.due_date && new Date() > new Date(payment.due_date);
    const daysOverdue = isOverdue ? Math.ceil((new Date() - new Date(payment.due_date)) / (1000 * 60 * 60 * 24)) : 0;

    // สร้าง line items
    const lineItems = [];
    if (payment.rent_amount > 0) lineItems.push({ name: 'ค่าเช่า', total: payment.rent_amount });
    if (payment.electricity_amount > 0) lineItems.push({ name: `ค่าไฟฟ้า ${payment.electricity_units || 0} หน่วย`, total: payment.electricity_amount });
    if (payment.water_amount > 0) lineItems.push({ name: `ค่าน้ำประปา ${payment.water_units || 0} หน่วย`, total: payment.water_amount });
    if (payment.internet_amount > 0) lineItems.push({ name: 'ค่าอินเทอร์เน็ต', total: payment.internet_amount });
    if (payment.common_fee_amount > 0) lineItems.push({ name: 'ค่าส่วนกลาง', total: payment.common_fee_amount });
    if (payment.parking_fee_amount > 0) lineItems.push({ name: 'ค่าที่จอดรถ', total: payment.parking_fee_amount });
    if (payment.other_amount > 0) lineItems.push({ name: 'ค่าใช้จ่ายอื่นๆ', total: payment.other_amount });

    // สร้าง HTML แบบ compact
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

    // เรียก Browserless
    const browserlessResponse = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            html: htmlContent,
            options: { type: 'png', fullPage: true }
        })
    });

    if (!browserlessResponse.ok) {
        const errText = await browserlessResponse.text();
        throw new Error(`Browserless error: ${errText}`);
    }

    // Upload image - ใช้ asServiceRole
    const imageBlob = await browserlessResponse.blob();
    const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: imageFile });
    
    return file_url;
}

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

Deno.serve(async (req) => {
    console.log('========================================');
    console.log('🖼️ PROCESS INVOICE IMAGE QUEUE (Continuous Mode)');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('========================================');

    let base44 = null;
    let targetBranchId = null;
    let batchSize = 500; // เพิ่มเป็น 500 ต่อรอบ (Cron จะรันต่อเนื่อง)
    let concurrentLimit = 1; // สร้างทีละ 1 รูป (Free tier Browserless)
    let maxRunTime = 55000; // 55 วินาที (Deno timeout = 60s)
    let skipLineSend = false; // ⭐ โหมดทดสอบ - สร้างรูปอย่างเดียว ไม่ส่ง LINE

    try {
        const clonedReq = req.clone();
        base44 = createClientFromRequest(req);

        // Parse request body
        try {
            const text = await clonedReq.text();
            if (text && text.trim()) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
                batchSize = body.batch_size || 30;
                concurrentLimit = body.concurrent_limit || 3;
                skipLineSend = body.skip_line_send === true;
            }
        } catch (e) {
            console.log('⚠️ No valid JSON body');
        }

        console.log(`📋 Target Branch: ${targetBranchId || 'ALL'}`);
        console.log(`📦 Batch Size: ${batchSize}`);
        console.log(`🔄 Concurrent Limit: ${concurrentLimit}`);
        console.log(`⏱️ Max Run Time: ${maxRunTime}ms`);
        console.log(`🧪 Skip LINE Send: ${skipLineSend}`);
        
        const startTime = Date.now();

        // 1. Fetch Configs
        const configs = await base44.asServiceRole.entities.Config.list() || [];
        // ⭐ ลำดับ parameter เหมือน sendPaymentReminder: (key, branchId, defaultValue)
        const getConfigValue = (key, branchId, defaultValue = '') => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig?.value) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        // 2. Fetch Payments ที่ต้องสร้างรูป
        // เงื่อนไข: status != 'paid' AND (invoice_image_status = 'pending' OR invoice_image_status = null) AND bill_sent_date = null
        const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : {};
        
        // ⭐ ดึง Payment แบบ pagination เพื่อรองรับมากกว่า 500 รายการ
        let allPayments = [];
        let skip = 0;
        const fetchLimit = 1000;
        let hasMore = true;
        
        while (hasMore) {
            const batch = await base44.asServiceRole.entities.Payment.filter(paymentFilter, '-created_date', fetchLimit, skip);
            if (!batch || batch.length === 0) {
                hasMore = false;
            } else {
                allPayments = allPayments.concat(batch);
                skip += batch.length;
                if (batch.length < fetchLimit) {
                    hasMore = false;
                }
            }
            // จำกัดไม่เกิน 5000 รายการเพื่อป้องกัน memory issue
            if (allPayments.length >= 5000) {
                hasMore = false;
            }
        }
        console.log(`📥 Fetched ${allPayments.length} total payments`);

        // ⭐ สร้างรูปทุกสาขา แต่ส่ง LINE เฉพาะสาขาที่เปิด auto_send
        // ⭐ รวม 'generating' ด้วย เผื่อรอบก่อน timeout ค้างไว้
        const paymentsToProcess = allPayments.filter(p => {
            // ข้ามบิลที่ชำระแล้ว
            if (p.status === 'paid') return false;
            
            // ต้องยังไม่มีรูป หรือสถานะเป็น pending/null/generating (ค้างจากรอบก่อน)
            const needsImage = !p.invoice_image_url || 
                p.invoice_image_status === 'pending' || 
                p.invoice_image_status === 'generating' || 
                !p.invoice_image_status;
            
            // ⭐ เช็คว่าบิลถูกแก้ไขหลังสร้างรูปหรือไม่ (hash ไม่ตรง)
            let needsRegenerate = false;
            if (p.invoice_image_url && p.invoice_data_hash) {
                const currentHash = generatePaymentHash(p);
                if (currentHash !== p.invoice_data_hash) {
                    needsRegenerate = true;
                }
            }
            
            // ⭐ เช็คว่าสาขานี้เปิดส่งบิลอัตโนมัติหรือไม่
            const autoSendEnabled = getConfigValue('auto_send_bills_after_generation', p.branch_id, 'false') === 'true';
            const needsSend = autoSendEnabled && !p.bill_sent_date;
            
            return needsImage || needsRegenerate || needsSend;
        }).slice(0, batchSize);

        console.log(`📊 Found ${paymentsToProcess.length} payments to process (from ${allPayments.length} total)`);

        if (paymentsToProcess.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีบิลที่ต้องสร้างรูปหรือส่ง LINE',
                processed: 0,
                imageGenerated: 0,
                lineSent: 0
            });
        }

        // 3. Fetch related data
        const paymentRoomIds = [...new Set(paymentsToProcess.map(p => p.room_id).filter(Boolean))];
        const paymentTenantIds = [...new Set(paymentsToProcess.map(p => p.tenant_id).filter(Boolean))];

        const [rooms, tenants] = await Promise.all([
            base44.asServiceRole.entities.Room.filter({}, '-room_number', 5000),
            base44.asServiceRole.entities.Tenant.filter({}, '-created_date', 5000)
        ]);

        const roomMap = new Map((rooms || []).map(r => [r.id, r]));
        const tenantMap = new Map((tenants || []).map(t => [t.id, t]));

        // 4. Process in batches of `concurrentLimit`
        let imageGenerated = 0;
        let imageFailed = 0;
        let lineSent = 0;
        let lineFailed = 0;

        // แบ่งเป็นกลุ่มละ concurrentLimit
        const chunks = [];
        for (let i = 0; i < paymentsToProcess.length; i += concurrentLimit) {
            chunks.push(paymentsToProcess.slice(i, i + concurrentLimit));
        }

        console.log(`📦 Split into ${chunks.length} chunks of max ${concurrentLimit} each`);

        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
            // ⭐ เช็ค timeout - หยุดก่อนถึง 45 วินาที
            const elapsed = Date.now() - startTime;
            if (elapsed > maxRunTime) {
                console.log(`⏱️ Approaching timeout (${elapsed}ms) - stopping gracefully`);
                break;
            }
            
            const chunk = chunks[chunkIdx];
            console.log(`\n🔄 Processing chunk ${chunkIdx + 1}/${chunks.length} (${chunk.length} payments) [${elapsed}ms elapsed]`);

            // 4.1 สร้างรูปพร้อมกัน (concurrent)
            const imagePromises = chunk.map(async (payment) => {
                const room = roomMap.get(payment.room_id);
                const tenant = tenantMap.get(payment.tenant_id);

                // ⭐ เช็คว่าต้องสร้างรูปใหม่หรือไม่ (ถ้าบิลถูกแก้ไข)
                let needsRegenerate = false;
                if (payment.invoice_image_url && payment.invoice_data_hash) {
                    const currentHash = generatePaymentHash(payment);
                    if (currentHash !== payment.invoice_data_hash) {
                        needsRegenerate = true;
                        console.log(`🔄 Payment ${payment.id}: Hash mismatch - regenerating image`);
                    }
                }
                
                // ถ้ามีรูปแล้วและไม่ต้องสร้างใหม่ ข้ามการสร้าง
                if (payment.invoice_image_url && payment.invoice_image_status === 'completed' && !needsRegenerate) {
                    console.log(`✅ Payment ${payment.id}: Already has image (hash matched)`);
                    return { payment, room, tenant, imageUrl: payment.invoice_image_url, success: true, skipped: true };
                }

                try {
                    // Mark as generating
                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        invoice_image_status: 'generating'
                    });

                    console.log(`🖼️ Generating image for payment ${payment.id} (Room: ${room?.room_number || 'N/A'})...`);
                    
                    // ⭐ เรียก getPublicInvoice + สร้างรูปเองภายใน function นี้เลย
                    const invoiceDataResult = await base44.asServiceRole.functions.invoke('getPublicInvoice', {
                        paymentId: payment.id
                    });

                    if (!invoiceDataResult.data?.success || !invoiceDataResult.data?.invoice) {
                        throw new Error(invoiceDataResult.data?.error || 'ไม่พบข้อมูลใบแจ้งหนี้');
                    }

                    const invoice = invoiceDataResult.data.invoice;
                    
                    // สร้าง HTML และ screenshot
                    const imageUrl = await generateInvoiceScreenshot(base44, payment.id, invoice);

                    if (imageUrl) {
                        // Update payment with image URL + hash
                        const newHash = generatePaymentHash(payment);
                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            invoice_image_url: imageUrl,
                            invoice_image_status: 'completed',
                            invoice_data_hash: newHash
                        });
                        
                        console.log(`✅ Payment ${payment.id}: Image created`);
                        return { 
                            payment: { ...payment, invoice_image_url: imageUrl }, 
                            room, 
                            tenant, 
                            imageUrl: imageUrl, 
                            success: true 
                        };
                    } else {
                        throw new Error('Failed to generate invoice image');
                    }
                } catch (error) {
                    console.error(`❌ Payment ${payment.id}: Image generation failed - ${error.message}`);
                    
                    // Mark as failed
                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        invoice_image_status: 'failed'
                    });
                    
                    return { payment, room, tenant, success: false, error: error.message };
                }
            });

            const imageResults = await Promise.all(imagePromises);

            // Count results
            for (const result of imageResults) {
                if (result.success && !result.skipped) {
                    imageGenerated++;
                } else if (!result.success) {
                    imageFailed++;
                }
            }

            // 4.2 ส่ง LINE สำหรับที่สร้างรูปสำเร็จ (ทีละใบเพื่อหลีกเลี่ยง rate limit)
            // ⭐ ถ้าเป็นโหมดทดสอบ (skip_line_send = true) ข้ามการส่ง LINE
            if (!skipLineSend) {
                for (const result of imageResults) {
                    if (!result.success && !result.skipped) continue;
                    
                    const { payment, room, tenant, imageUrl } = result;
                    
                    // ⭐ เช็คว่าสาขานี้เปิดส่งบิลอัตโนมัติหรือไม่
                    const autoSendEnabled = getConfigValue('auto_send_bills_after_generation', payment.branch_id, 'false') === 'true';
                    if (!autoSendEnabled) {
                        console.log(`⏭️ Payment ${payment.id}: Branch auto_send disabled - skip LINE`);
                        continue;
                    }
                    
                    // ข้ามถ้าไม่มี LINE User ID
                    if (!tenant?.line_user_id) {
                        console.log(`⏭️ Payment ${payment.id}: No LINE User ID - skip LINE notification`);
                        continue;
                    }

                    // ข้ามถ้าส่งไปแล้ว
                    if (payment.bill_sent_date) {
                        console.log(`⏭️ Payment ${payment.id}: Already sent - skip`);
                        continue;
                    }

                    try {
                    // ⭐ ลำดับ parameter: (key, branchId, defaultValue) เหมือน sendPaymentReminder
                    const branchId = payment.branch_id;
                    const bankName = getConfigValue('bank_name', branchId, 'กสิกร');
                    const bankAcc = getConfigValue('bank_account_number', branchId, '-');
                    const bankOwner = getConfigValue('bank_account_name', branchId, '-');
                    const buildingName = getConfigValue('building_name', branchId, 'W RESIDENTS');
                    
                    // ⭐ ใช้ token เฉพาะสาขาเท่านั้น (ไม่ fallback ไป env) เหมือน sendPaymentReminder
                    const lineToken = getConfigValue('line_channel_access_token', branchId, '');
                    if (!lineToken) {
                        console.log(`⏭️ Payment ${payment.id}: No LINE token for branch ${branchId?.substring(0, 8)}... - skip LINE`);
                        continue;
                    }

                    let msg = `🏠 ${buildingName} - แจ้งเตือนค่าเช่า\n\n`;
                    msg += `สวัสดีคุณ ${tenant.full_name}\n`;
                    msg += `ห้อง ${room?.room_number || 'N/A'}\n\n`;
                    msg += `💰 ยอดรวม: ${payment.total_amount.toLocaleString()} บาท\n`;
                    msg += `(${numberToThaiText(payment.total_amount)})\n\n`;
                    msg += `📅 กำหนดชำระ: ${new Date(payment.due_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
                    msg += `\n💳 โอนเงินได้ที่: ${bankName} ${bankAcc} (${bankOwner})\n`;

                    if (imageUrl) {
                        msg += `\n📄 ดูใบแจ้งหนี้: ${imageUrl}`;
                    }

                    // ส่ง LINE
                    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${lineToken}`
                        },
                        body: JSON.stringify({
                            to: tenant.line_user_id,
                            messages: [{ type: 'text', text: msg }]
                        })
                    });

                    if (lineResponse.ok) {
                        // Update bill_sent_date
                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            bill_sent_date: new Date().toISOString()
                        });
                        
                        console.log(`📤 Payment ${payment.id}: LINE sent to ${tenant.full_name}`);
                        lineSent++;
                    } else {
                        const errorText = await lineResponse.text();
                        console.error(`❌ Payment ${payment.id}: LINE failed - ${errorText}`);
                        lineFailed++;
                    }

                    // Delay ระหว่างส่ง LINE แต่ละใบ
                    await delay(500);

                } catch (lineError) {
                    console.error(`❌ Payment ${payment.id}: LINE error - ${lineError.message}`);
                    lineFailed++;
                }
            }
            } else {
                console.log('🧪 Test mode - skipping LINE send for all payments in this chunk');
            }

            // ⭐ ไม่ต้องรอระหว่าง chunk - ให้ Cron Job รันต่อเนื่องแทน
        }

        // 5. Log และ Return
        const totalElapsed = Date.now() - startTime;
        const remaining = paymentsToProcess.length - imageGenerated - imageFailed;
        const summaryMessage = `สร้างรูป ${imageGenerated} ใบ (ล้มเหลว ${imageFailed}), ส่ง LINE ${lineSent} ราย, เหลืออีก ${remaining} ใบ [${Math.round(totalElapsed/1000)}s]`;
        console.log(`\n✅ ${summaryMessage}`);

        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'processInvoiceImageQueue',
                run_timestamp: new Date().toISOString(),
                status: 'success',
                message: summaryMessage,
                details: {
                    processed: paymentsToProcess.length,
                    imageGenerated,
                    imageFailed,
                    lineSent,
                    lineFailed,
                    batchSize,
                    concurrentLimit
                },
                triggered_by: targetBranchId ? 'manual_branch' : 'cron'
            });
        } catch (logError) {
            console.error('⚠️ Failed to write function log:', logError.message);
        }

        return Response.json({
            success: true,
            message: summaryMessage,
            processed: paymentsToProcess.length,
            imageGenerated,
            imageFailed,
            lineSent,
            lineFailed,
            remaining,
            elapsedMs: totalElapsed,
            // ⭐ ถ้ายังมีเหลือ = ควรรันอีกรอบ
            hasMore: remaining > 0
        });

    } catch (error) {
        console.error('❌ Error:', error);

        if (base44) {
            try {
                await base44.asServiceRole.entities.FunctionLog.create({
                    function_name: 'processInvoiceImageQueue',
                    run_timestamp: new Date().toISOString(),
                    status: 'error',
                    message: error.message || 'Unknown error',
                    details: { error: error.stack || String(error) },
                    triggered_by: 'unknown'
                });
            } catch (logError) {
                console.error('⚠️ Failed to write ERROR function log:', logError.message);
            }
        }

        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});