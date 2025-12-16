import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ฟังก์ชันสำหรับสร้างรูปใบแจ้งหนี้และส่ง LINE แบบ Queue (Sequential & Safe Scope)
 * @version 2.4 - Final Stable Version
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ==========================================
// 1. HELPER: Generate Hash
// ==========================================
function generatePaymentHash(payment) {
    const dataToHash = {
        rent_amount: payment.rent_amount || 0,
        water_amount: payment.water_amount || 0,
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
    // แปลง Object เป็น String แล้ว Hash (Base64) ตัดเอา 32 ตัวแรก
    return btoa(JSON.stringify(dataToHash)).substring(0, 32);
}

// ==========================================
// 2. HELPER: Number to Thai Text
// ==========================================
function numberToThaiText(number) {
    if (number === undefined || number === null || isNaN(number) || number === 0) return 'ศูนย์บาทถ้วน';
    
    const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    
    const numStr = number.toFixed(2);
    const [intStr, decStr] = numStr.split('.');
    
    function convert(nStr) {
        let res = '';
        const len = nStr.length;
        for (let i = 0; i < len; i++) {
            const digit = parseInt(nStr[i]);
            const pos = len - i - 1;
            if (digit === 0) continue;
            
            if (pos === 1 && digit === 1) res += 'สิบ';
            else if (pos === 1 && digit === 2) res += 'ยี่สิบ';
            else if (pos === 0 && digit === 1 && len > 1 && nStr[i-1] !== '0') res += 'เอ็ด';
            else res += numbers[digit] + positions[pos];
        }
        return res;
    }
    
    let text = convert(intStr) + 'บาท';
    if (parseInt(decStr) > 0) {
        text += convert(decStr) + 'สตางค์';
    } else {
        text += 'ถ้วน';
    }
    return text;
}

// ==========================================
// 3. HELPER: Generate Invoice Screenshot
// ==========================================
async function generateInvoiceScreenshot(base44, paymentId, invoice) {
    const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
    if (!BROWSERLESS_API_KEY) throw new Error("BROWSERLESS_API_KEY not set");

    const payment = invoice;
    const room = invoice.room || { room_number: 'N/A' };
    const tenant = invoice.tenant || { full_name: 'ไม่ระบุ' };
    const bank = invoice.bank || {};
    const recipient = invoice.recipient || {};

    const buildingName = recipient.building_name || 'W RESIDENTS';
    const buildingLogo = recipient.building_logo || '';

    const escapeHtml = (text) => text ? text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        try {
            const d = new Date(dateString);
            return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch { return '-'; }
    };

    const isOverdue = payment.status === 'overdue' || (payment.due_date && new Date() > new Date(payment.due_date));

    // Prepare Line Items
    const lineItems = [];
    if (payment.rent_amount > 0) lineItems.push({ name: 'ค่าเช่า', total: payment.rent_amount });
    if (payment.electricity_amount > 0) lineItems.push({ name: `ค่าไฟ (${payment.electricity_units || 0} หน่วย)`, total: payment.electricity_amount });
    if (payment.water_amount > 0) lineItems.push({ name: `ค่าน้ำ (${payment.water_units || 0} หน่วย)`, total: payment.water_amount });
    if (payment.internet_amount > 0) lineItems.push({ name: 'ค่าอินเทอร์เน็ต', total: payment.internet_amount });
    if (payment.common_fee_amount > 0) lineItems.push({ name: 'ค่าส่วนกลาง', total: payment.common_fee_amount });
    if (payment.parking_fee_amount > 0) lineItems.push({ name: 'ค่าที่จอดรถ', total: payment.parking_fee_amount });
    if (payment.other_amount > 0) lineItems.push({ name: 'ค่าใช้จ่ายอื่นๆ', total: payment.other_amount });
    if (payment.late_fee_amount > 0) lineItems.push({ name: '⚠️ ค่าปรับชำระล่าช้า', total: payment.late_fee_amount });

    // HTML Content
    const htmlContent = `
    <!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Sarabun', sans-serif; padding: 20px; background: #f8fafc; color: #334155; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 20px; }
        .logo { height: 50px; object-fit: contain; margin-bottom: 10px; }
        .title { font-size: 22px; font-weight: bold; color: ${isOverdue ? '#dc2626' : '#2563eb'}; }
        .info-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; }
        .item-row { display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; }
        .total-section { margin-top: 20px; border-top: 2px solid #e2e8f0; padding-top: 15px; }
        .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; color: #1e293b; }
        .payment-info { background: #eff6ff; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 12px; }
    </style></head><body>
        <div class="container">
            <div class="header">
                ${buildingLogo ? `<img src="${buildingLogo}" class="logo">` : ''}
                <div class="title">ใบแจ้งหนี้ ${isOverdue ? '(เกินกำหนด)' : ''}</div>
                <div>${escapeHtml(buildingName)}</div>
            </div>
            <div class="info-row">
                <span>ห้อง: <b>${escapeHtml(room.room_number)}</b></span>
                <span>ผู้เช่า: ${escapeHtml(tenant.full_name)}</span>
            </div>
            <div class="info-row">
                <span>กำหนดชำระ: ${formatDate(payment.due_date)}</span>
            </div>
            <hr style="border:none; border-top:1px solid #e2e8f0; margin:15px 0;">
            ${lineItems.map(item => `
                <div class="item-row">
                    <span>${escapeHtml(item.name)}</span>
                    <span>${item.total.toLocaleString()} ฿</span>
                </div>
            `).join('')}
            <div class="total-section">
                <div class="total-row">
                    <span>ยอดรวมสุทธิ</span>
                    <span style="color: ${isOverdue ? '#dc2626' : '#2563eb'}">${(payment.total_amount || 0).toLocaleString()} ฿</span>
                </div>
            </div>
            <div class="payment-info">
                <b>ช่องทางการชำระเงิน</b><br>
                ธนาคาร: ${escapeHtml(bank.name)}<br>
                เลขบัญชี: ${escapeHtml(bank.account_number)}<br>
                ชื่อบัญชี: ${escapeHtml(bank.account_name)}
            </div>
        </div>
    </body></html>`;

    // Send to Browserless
    const res = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            html: htmlContent,
            viewport: { width: 500, height: 800, deviceScaleFactor: 2 },
            options: { type: 'png', fullPage: true }
        })
    });

    if (!res.ok) throw new Error(`Browserless Error: ${await res.text()}`);

    // Upload to Storage
    const imageBlob = await res.blob();
    const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: imageFile });
    
    return file_url;
}

// ==========================================
// 4. MAIN LOGIC (Deno Serve)
// ==========================================
Deno.serve(async (req) => {
    console.log('🚀 processInvoiceImageQueue: Starting job...');
    const startTime = Date.now();
    let base44 = createClientFromRequest(req);
    let allImageResults = [];

    try {
        // Parse Request Body
        const body = await req.json().catch(() => ({}));
        const targetBranchId = body.branch_id || null;
        const skipLineSend = body.skip_line_send === true;

        // 4.1 Fetch Configs (ดึงครั้งเดียว)
        const configs = await base44.asServiceRole.entities.Config.list() || [];
        const getConfigValue = (key, branchId, def) => {
            const branchVal = configs.find(c => c.key === key && c.branch_id === branchId);
            if (branchVal?.value) return branchVal.value;
            const globalVal = configs.find(c => c.key === key && !c.branch_id);
            return globalVal?.value || def;
        };

        // 4.2 Fetch Payments (กรองที่ยังไม่จ่าย)
        const filter = targetBranchId ? { branch_id: targetBranchId } : {};
        const allPayments = await base44.asServiceRole.entities.Payment.filter(filter, '-created_date', 50);
        const paymentsToProcess = allPayments.filter(p => p.status !== 'paid');

        console.log(`📊 Found ${paymentsToProcess.length} unpaid payments`);

        // 4.3 Prepare Data (Bulk Fetch for Performance)
        const tenantIds = [...new Set(paymentsToProcess.map(p => p.tenant_id))];
        const tenants = await Promise.all(tenantIds.map(id => base44.asServiceRole.entities.Tenant.get(id).catch(() => null)));
        const tenantMap = new Map(tenants.filter(Boolean).map(t => [t.id, t]));

        const roomIds = [...new Set(paymentsToProcess.map(p => p.room_id))];
        const rooms = await Promise.all(roomIds.map(id => base44.asServiceRole.entities.Room.get(id).catch(() => null)));
        const roomMap = new Map(rooms.filter(Boolean).map(r => [r.id, r]));

        // 4.4 Image Generation Loop (Sequential)
        for (const payment of paymentsToProcess) {
            const room = roomMap.get(payment.room_id);
            const tenant = tenantMap.get(payment.tenant_id);
            let imageUrl = payment.invoice_image_url;

            try {
                // Check if image needs regeneration
                const currentHash = generatePaymentHash(payment);
                const isHashChanged = payment.invoice_data_hash !== currentHash;
                const isImageMissing = !imageUrl;
                const isNotCompleted = payment.invoice_image_status !== 'completed';

                if (isImageMissing || isNotCompleted || isHashChanged) {
                    console.log(`🖼️ Generating Image: Room ${room?.room_number || 'Unknown'}`);
                    
                    // Call getPublicInvoice for structured data
                    const invoiceData = await base44.asServiceRole.functions.invoke('getPublicInvoice', { paymentId: payment.id });
                    
                    if (!invoiceData.data?.success) {
                        throw new Error("getPublicInvoice API failed");
                    }

                    // Generate Screenshot
                    imageUrl = await generateInvoiceScreenshot(base44, payment.id, invoiceData.data.invoice);
                    
                    // Update Payment Record
                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        invoice_image_url: imageUrl,
                        invoice_image_status: 'completed',
                        invoice_data_hash: currentHash
                    });
                    console.log(`   ✅ Image Updated`);
                }

                // Collect Result
                allImageResults.push({ payment, room, tenant, imageUrl, success: true });

            } catch (err) {
                console.error(`❌ Error on payment ${payment.id}:`, err.message);
                allImageResults.push({ payment, room, tenant, success: false, error: err.message });
            }
        }

        // 4.5 Notification Sending Loop
        let lineSentCount = 0;
        
        if (!skipLineSend) {
            console.log(`📤 Sending notifications for ${allImageResults.length} items...`);
            
            for (const result of allImageResults) {
                if (!result.success || !result.imageUrl) continue;

                const { payment, room, tenant, imageUrl } = result;
                const bId = payment.branch_id;

                // ⭐ CRITICAL FIX: Declare variables inside loop top-level to avoid ReferenceError
                const branchName = getConfigValue('building_name', bId, 'W RESIDENTS');
                const autoSendEnabled = getConfigValue('auto_send_bills_after_generation', bId, 'false') === 'true';

                // Check Conditions
                if (!autoSendEnabled) {
                    console.log(`⏭️ [${branchName}] Room ${room?.room_number}: Auto-send disabled`);
                    continue;
                }
                if (payment.bill_sent_date) {
                    console.log(`⏭️ [${branchName}] Room ${room?.room_number}: Already sent`);
                    continue;
                }
                if (!tenant?.line_user_id) continue;

                // Send LINE Message
                const lineToken = getConfigValue('line_channel_access_token', bId, '');
                if (lineToken) {
                    console.log(`📱 Sending LINE to Room ${room?.room_number}...`);
                    
                    const msg = `📢 แจ้งเตือนบิลค่าเช่า: ${branchName}\n` +
                                `ห้อง: ${room?.room_number}\n` +
                                `ยอดชำระ: ${payment.total_amount.toLocaleString()} ฿\n` +
                                `📄 ดูบิล: ${imageUrl}\n\n` +
                                `ขอบคุณครับ 🙏`;

                    const res = await fetch('https://api.line.me/v2/bot/message/push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lineToken}` },
                        body: JSON.stringify({ 
                            to: tenant.line_user_id, 
                            messages: [{ type: 'text', text: msg }] 
                        })
                    });

                    if (res.ok) {
                        await base44.asServiceRole.entities.Payment.update(payment.id, { bill_sent_date: new Date().toISOString() });
                        lineSentCount++;
                        console.log(`   ✅ Sent Successfully`);
                    } else {
                        console.error(`   ❌ LINE Failed: ${await res.text()}`);
                    }
                }
                
                // Small delay to prevent rate limits
                await delay(200);
            }
        }

        const executionTime = Date.now() - startTime;
        return Response.json({ 
            success: true, 
            processed: allImageResults.length, 
            sent: lineSentCount,
            time: `${executionTime}ms` 
        });

    } catch (error) {
        console.error('❌ Critical Global Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});