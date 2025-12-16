import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ⭐ FIX: ปรับ Hash ให้รองรับกรณีค่าปรับยังไม่อัปเดตใน DB
function generatePaymentHash(payment) {
    const dataToHash = {
        rent_amount: payment.rent_amount || 0,
        water_amount: payment.water_amount || 0,
        electricity_amount: payment.electricity_amount || 0,
        late_fee_amount: payment.late_fee_amount || 0, // ค่าใน DB
        total_amount: payment.total_amount || 0,
        due_date: payment.due_date || '',
        status: payment.status || 'pending'
    };
    return btoa(JSON.stringify(dataToHash)).substring(0, 32);
}

// ⭐ ฟังก์ชันสร้างรูป
async function generateInvoiceScreenshot(base44, paymentId, invoice) {
    const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
    if (!BROWSERLESS_API_KEY) throw new Error("BROWSERLESS_API_KEY not set");

    const payment = invoice;
    const room = invoice.room || { room_number: 'N/A' };
    const tenant = invoice.tenant || { full_name: 'ไม่ระบุ' };
    const bank = invoice.bank || {};
    const recipient = invoice.recipient || {};

    const escapeHtml = (text) => text ? text.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
    
    const lineItems = [];
    if (payment.rent_amount > 0) lineItems.push({ name: 'ค่าเช่า', total: payment.rent_amount });
    if (payment.electricity_amount > 0) lineItems.push({ name: `ค่าไฟ (${payment.electricity_units || 0} หน่วย)`, total: payment.electricity_amount });
    if (payment.water_amount > 0) lineItems.push({ name: `ค่าน้ำ (${payment.water_units || 0} หน่วย)`, total: payment.water_amount });
    if (payment.late_fee_amount > 0) lineItems.push({ name: '⚠️ ค่าปรับชำระล่าช้า', total: payment.late_fee_amount });

    const htmlContent = `<html><body style="font-family: sans-serif; padding: 20px; background: #f8fafc;">
        <div style="background: white; border: 1px solid #e2e8f0; padding: 24px; border-radius: 12px; max-width: 500px; margin: auto;">
            <h2 style="color: #1e293b;">${escapeHtml(recipient.building_name || 'ใบแจ้งหนี้')}</h2>
            <p>ห้อง: <b>${escapeHtml(room.room_number)}</b> | คุณ: ${escapeHtml(tenant.full_name)}</p>
            <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 16px 0;">
            ${lineItems.map(item => `<div style="display:flex; justify-content:space-between; margin-bottom:8px;"><span>${item.name}</span><b>${item.total.toLocaleString()} ฿</b></div>`).join('')}
            <div style="margin-top:16px; padding-top:16px; border-top: 2px solid #2563eb; display:flex; justify-content:space-between;">
                <span style="font-weight:bold;">ยอดรวมทั้งสิ้น</span>
                <span style="font-weight:bold; color:#2563eb; font-size:20px;">${(payment.total_amount || 0).toLocaleString()} ฿</span>
            </div>
            <p style="margin-top:16px; font-size:12px; color:#64748b; background:#f1f5f9; padding:12px; border-radius:8px;">
                💳 โอนที่: ${escapeHtml(bank.name)} ${escapeHtml(bank.account_number)}<br>ชื่อบัญชี: ${escapeHtml(bank.account_name)}
            </p>
        </div>
    </body></html>`;

    const res = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlContent, options: { type: 'png', fullPage: true } })
    });

    const imageBlob = await res.blob();
    const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: imageFile });
    return file_url;
}

function numberToThaiText(number) {
    if (!number || number === 0) return 'ศูนย์บาทถ้วน';
    // ... ฟังก์ชันภาษาไทยเดิมของคุณ ...
    return ""; 
}

Deno.serve(async (req) => {
    const startTime = Date.now();
    let base44 = createClientFromRequest(req);
    let allImageResults = [];

    try {
        const body = await req.json().catch(() => ({}));
        const targetBranchId = body.branch_id || null;
        const concurrentLimit = 1; 

        // 1. Fetch Configs
        const configs = await base44.asServiceRole.entities.Config.list() || [];
        const getConfigValue = (key, branchId, def) => {
            const c = configs.find(x => x.key === key && x.branch_id === branchId) || configs.find(x => x.key === key && !x.branch_id);
            return c?.value || def;
        };

        // 2. Fetch Payments
        const filter = targetBranchId ? { branch_id: targetBranchId } : {};
        const allPayments = await base44.asServiceRole.entities.Payment.filter(filter, '-created_date', 50);
        const paymentsToProcess = allPayments.filter(p => p.status !== 'paid' && (!p.invoice_image_url || !p.bill_sent_date));

        console.log(`📊 Total payments to process: ${paymentsToProcess.length}`);

        // 3. Fetch Metadata
        const tenantIds = [...new Set(paymentsToProcess.map(p => p.tenant_id))];
        const tenants = await Promise.all(tenantIds.map(id => base44.asServiceRole.entities.Tenant.get(id).catch(() => null)));
        const tenantMap = new Map(tenants.filter(Boolean).map(t => [t.id, t]));

        const roomIds = [...new Set(paymentsToProcess.map(p => p.room_id))];
        const rooms = await Promise.all(roomIds.map(id => base44.asServiceRole.entities.Room.get(id).catch(() => null)));
        const roomMap = new Map(rooms.filter(Boolean).map(r => [r.id, r]));

        // 4. Processing Loop (Sequential for stability)
        for (const payment of paymentsToProcess) {
            const room = roomMap.get(payment.room_id);
            const tenant = tenantMap.get(payment.tenant_id);
            let imageUrl = payment.invoice_image_url;

            try {
                if (!imageUrl || payment.invoice_image_status !== 'completed') {
                    console.log(`🖼️ Generating invoice for Room: ${room?.room_number}`);
                    const invoiceData = await base44.asServiceRole.functions.invoke('getPublicInvoice', { paymentId: payment.id });
                    if (invoiceData.data?.success) {
                        imageUrl = await generateInvoiceScreenshot(base44, payment.id, invoiceData.data.invoice);
                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            invoice_image_url: imageUrl,
                            invoice_image_status: 'completed',
                            invoice_data_hash: generatePaymentHash(payment)
                        });
                    }
                }
                allImageResults.push({ payment, room, tenant, imageUrl, success: true });
            } catch (e) {
                console.error(`❌ Error processing ${payment.id}:`, e.message);
            }
        }

        // 5. Notification Loop
        console.log(`📤 Sending notifications for ${allImageResults.length} items...`);
        for (const result of allImageResults) {
            const { payment, room, tenant, imageUrl } = result;
            if (!imageUrl) continue;

            const bId = payment.branch_id;
            // ⭐ FIX: ประกาศ branchName ไว้ตรงนี้ เพื่อให้ทุกบรรทัดด้านล่างเข้าถึงได้
            const branchName = getConfigValue('building_name', bId, 'W RESIDENTS');
            const autoSend = getConfigValue('auto_send_bills_after_generation', bId, 'false') === 'true';

            if (!autoSend) {
                console.log(`⏭️ [${branchName}] Room ${room?.room_number}: auto_send is OFF`);
                continue;
            }

            if (payment.bill_sent_date) continue;

            if (tenant?.line_user_id) {
                const token = getConfigValue('line_channel_access_token', bId, '');
                if (token) {
                    console.log(`📱 Sending LINE to Room ${room?.room_number} [${branchName}]`);
                    const msg = `📢 ${branchName}\nคุณ ${tenant.full_name}\nยอดชำระ: ${payment.total_amount.toLocaleString()} ฿\n📄 บิล: ${imageUrl}`;
                    
                    const res = await fetch('https://api.line.me/v2/bot/message/push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ to: tenant.line_user_id, messages: [{ type: 'text', text: msg }] })
                    });

                    if (res.ok) {
                        await base44.asServiceRole.entities.Payment.update(payment.id, { bill_sent_date: new Date().toISOString() });
                        console.log(`   ✅ Sent Successfully`);
                    }
                }
            }
        }

        return Response.json({ success: true, processed: allImageResults.length });

    } catch (error) {
        console.error('❌ Global Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});