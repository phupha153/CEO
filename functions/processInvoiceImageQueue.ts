import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ฟังก์ชันสำหรับสร้างรูปใบแจ้งหนี้และส่ง LINE แบบ Queue
 * @version 2.2 - Full Version with Fixed Scope & Accurate Calculations
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ⭐ ฟังก์ชันสร้าง hash จากข้อมูลบิล เพื่อตรวจจับการเปลี่ยนแปลงยอดเงิน
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
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32);
}

// ⭐ ฟังก์ชันสร้างรูปใบแจ้งหนี้ (Screenshot)
async function generateInvoiceScreenshot(base44, paymentId, invoice) {
    const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
    if (!BROWSERLESS_API_KEY) throw new Error("BROWSERLESS_API_KEY not set");

    const payment = invoice;
    const room = invoice.room || { room_number: 'N/A' };
    const tenant = invoice.tenant || { full_name: 'ไม่ระบุ' };
    const bank = invoice.bank || {};
    const recipient = invoice.recipient || {};

    const buildingName = recipient.building_name || 'Double Residence';
    const buildingLogo = recipient.building_logo || '';

    const escapeHtml = (text) => !text ? '' : text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const isOverdue = payment.status === 'overdue' || (payment.due_date && new Date() > new Date(payment.due_date));
    const daysOverdue = isOverdue ? Math.ceil((new Date() - new Date(payment.due_date)) / (1000 * 60 * 60 * 24)) : 0;

    // เตรียมรายการค่าใช้จ่าย
    const lineItems = [];
    if (payment.rent_amount > 0) lineItems.push({ name: 'ค่าเช่า', total: payment.rent_amount });
    if (payment.electricity_amount > 0) lineItems.push({ name: `ค่าไฟ (${payment.electricity_units || 0} หน่วย)`, total: payment.electricity_amount });
    if (payment.water_amount > 0) lineItems.push({ name: `ค่าน้ำ (${payment.water_units || 0} หน่วย)`, total: payment.water_amount });
    if (payment.internet_amount > 0) lineItems.push({ name: 'ค่าอินเทอร์เน็ต', total: payment.internet_amount });
    if (payment.common_fee_amount > 0) lineItems.push({ name: 'ค่าส่วนกลาง', total: payment.common_fee_amount });
    if (payment.late_fee_amount > 0) lineItems.push({ name: '⚠️ ค่าปรับชำระล่าช้า', total: payment.late_fee_amount });

    const htmlContent = `
    <!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
    <style>
        body { font-family: 'Sarabun', sans-serif; padding: 20px; background: #f8fafc; color: #334155; }
        .container { max-width: 500px; margin: auto; background: white; padding: 30px; border-radius: 15px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
        .header { text-align: center; margin-bottom: 20px; }
        .logo { width: 60px; height: 60px; object-fit: contain; }
        .title { font-size: 22px; font-weight: bold; color: ${isOverdue ? '#dc2626' : '#2563eb'}; margin-top: 10px; }
        .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
        .total-row { border-top: 2px solid #e2e8f0; margin-top: 15px; padding-top: 15px; display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; color: #1e293b; }
        .footer-note { background: #eff6ff; padding: 15px; border-radius: 10px; margin-top: 20px; font-size: 12px; }
    </style></head><body>
    <div class="container">
        <div class="header">
            ${buildingLogo ? `<img src="${buildingLogo}" class="logo">` : ''}
            <div class="title">ใบแจ้งหนี้ค่าเช่าห้อง</div>
            <div style="font-size: 14px;">${escapeHtml(buildingName)}</div>
        </div>
        <div class="info-row"><span>ห้อง: <b>${escapeHtml(room.room_number)}</b></span> <span>คุณ: ${escapeHtml(tenant.full_name)}</span></div>
        <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 15px 0;">
        ${lineItems.map(item => `<div class="info-row"><span>${item.name}</span><span>${item.total.toLocaleString()} ฿</span></div>`).join('')}
        <div class="total-row"><span>ยอดรวมสุทธิ</span><span>${(payment.total_amount || 0).toLocaleString()} ฿</span></div>
        <div class="footer-note">
            <b>💳 ช่องทางชำระเงิน</b><br>
            ธนาคาร: ${escapeHtml(bank.name)}<br>
            เลขบัญชี: ${escapeHtml(bank.account_number)}<br>
            ชื่อบัญชี: ${escapeHtml(bank.account_name)}
        </div>
    </div></body></html>`;

    const res = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlContent, options: { type: 'png', fullPage: true } })
    });

    if (!res.ok) throw new Error("Browserless conversion failed");
    const imageBlob = await res.blob();
    const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: imageFile });
    return file_url;
}

// ⭐ ฟังก์ชันแปลงตัวเลขเป็นภาษาไทย
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
                if (digit === 1) result += 'สิบ';
                else if (digit === 2) result += 'ยี่สิบ';
                else result += numbers[digit] + positions[position];
            } else if (position === 0 && digit === 1 && len > 1 && parseInt(numStr[len - 2]) !== 0) {
                result += 'เอ็ด';
            } else {
                result += numbers[digit] + positions[position];
            }
        }
        return result;
    }
    let text = convertInteger(integerPart) + 'บาท';
    if (decimalPart > 0) text += convertInteger(decimalPart) + 'สตางค์';
    else text += 'ถ้วน';
    return text;
}

Deno.serve(async (req) => {
    console.log('--- START PROCESS QUEUE JOB ---');
    const startTime = Date.now();
    let base44 = createClientFromRequest(req);
    let allImageResults = [];

    try {
        const body = await req.json().catch(() => ({}));
        const targetBranchId = body.branch_id || null;

        // 1. ดึงการตั้งค่า Config ทั้งหมด
        const configs = await base44.asServiceRole.entities.Config.list() || [];
        const getConfigValue = (key, branchId, def) => {
            const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
            if (branchConfig?.value) return branchConfig.value;
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || def;
        };

        // 2. ค้นหาบิลที่ยังชำระไม่เสร็จ
        const filter = targetBranchId ? { branch_id: targetBranchId } : {};
        const payments = await base44.asServiceRole.entities.Payment.filter(filter, '-created_date', 50);
        const paymentsToProcess = payments.filter(p => p.status !== 'paid');

        console.log(`📊 Total unpaid payments found: ${paymentsToProcess.length}`);

        // 3. เตรียมข้อมูล Tenant และ Room แบบรวดเร็ว
        const tenantIds = [...new Set(paymentsToProcess.map(p => p.tenant_id))];
        const tenants = await Promise.all(tenantIds.map(id => base44.asServiceRole.entities.Tenant.get(id).catch(() => null)));
        const tenantMap = new Map(tenants.filter(Boolean).map(t => [t.id, t]));

        const roomIds = [...new Set(paymentsToProcess.map(p => p.room_id))];
        const rooms = await Promise.all(roomIds.map(id => base44.asServiceRole.entities.Room.get(id).catch(() => null)));
        const roomMap = new Map(rooms.filter(Boolean).map(r => [r.id, r]));

        // 4. ลูปการจัดการทีละบิล (Sequential เพื่อความเสถียร)
        for (const payment of paymentsToProcess) {
            const room = roomMap.get(payment.room_id);
            const tenant = tenantMap.get(payment.tenant_id);
            let imageUrl = payment.invoice_image_url;

            try {
                // ตรวจสอบว่าต้องสร้างรูปใหม่หรือไม่ (เช็คจากความสมบูรณ์และ Hash)
                const currentHash = generatePaymentHash(payment);
                const isDataChanged = payment.invoice_data_hash !== currentHash;

                if (!imageUrl || payment.invoice_image_status !== 'completed' || isDataChanged) {
                    console.log(`🖼️ Generating Image for Room: ${room?.room_number || 'N/A'}`);
                    const invoiceData = await base44.asServiceRole.functions.invoke('getPublicInvoice', { paymentId: payment.id });
                    
                    if (invoiceData.data?.success) {
                        imageUrl = await generateInvoiceScreenshot(base44, payment.id, invoiceData.data.invoice);
                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            invoice_image_url: imageUrl,
                            invoice_image_status: 'completed',
                            invoice_data_hash: currentHash
                        });
                    }
                }
                
                // เก็บผลลัพธ์ใส่ Array เพื่อไปใช้งาน Step ส่งข้อความ
                allImageResults.push({ payment, room, tenant, imageUrl, success: true });

            } catch (err) {
                console.error(`❌ Error on payment ${payment.id}:`, err.message);
                allImageResults.push({ payment, room, tenant, success: false, error: err.message });
            }
        }

        // 5. ลูปการส่งแจ้งเตือน (Notifications)
        console.log(`📤 Sending notifications for ${allImageResults.length} items...`);
        let sentCount = 0;

        for (const result of allImageResults) {
            if (!result.success || !result.imageUrl) continue;

            const { payment, room, tenant, imageUrl } = result;
            const bId = payment.branch_id;

            // ⭐ FIX: ประกาศตัวแปรไว้ต้น Loop เพื่อป้องกัน ReferenceError
            const branchName = getConfigValue('building_name', bId, 'W RESIDENTS');
            const autoSendEnabled = getConfigValue('auto_send_bills_after_generation', bId, 'false') === 'true';

            // เช็คเงื่อนไขก่อนส่ง
            if (!autoSendEnabled) {
                console.log(`⏭️ [${branchName}] Room ${room?.room_number}: auto_send is OFF`);
                continue;
            }
            if (payment.bill_sent_date) {
                console.log(`⏭️ [${branchName}] Room ${room?.room_number}: Bill already sent`);
                continue;
            }

            // ส่ง LINE Notification
            if (tenant?.line_user_id) {
                const lineToken = getConfigValue('line_channel_access_token', bId, '');
                if (lineToken) {
                    console.log(`📱 Sending LINE to: ${tenant.full_name} (${branchName})`);
                    const lineMsg = `📢 แจ้งเตือนบิลค่าเช่าประจำเดือน\n\nห้อง: ${room?.room_number}\nยอดชำระ: ${payment.total_amount.toLocaleString()} ฿\n\n📄 ดูรายละเอียดใบแจ้งหนี้:\n${imageUrl}\n\nขอบคุณค่ะ 🙏`;
                    
                    const res = await fetch('https://api.line.me/v2/bot/message/push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lineToken}` },
                        body: JSON.stringify({ to: tenant.line_user_id, messages: [{ type: 'text', text: lineMsg }] })
                    });

                    if (res.ok) {
                        await base44.asServiceRole.entities.Payment.update(payment.id, { bill_sent_date: new Date().toISOString() });
                        sentCount++;
                        console.log(`   ✅ Notification Sent`);
                    }
                }
            }
        }

        const executionTime = Date.now() - startTime;
        return Response.json({ 
            success: true, 
            processed: allImageResults.length, 
            sent: sentCount,
            executionTime: `${executionTime}ms`
        });

    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});