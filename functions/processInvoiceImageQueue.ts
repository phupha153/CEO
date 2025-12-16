import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { differenceInDays, parseISO, startOfDay } from 'npm:date-fns@3.6.0';

/**
 * ระบบแจ้งเตือนค่าเช่าและสร้างบิลอัตโนมัติ (Full Version - Debuggable)
 * @version 3.0 - Original Structure Fixed
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
        late_fee_amount: payment.late_fee_amount || 0,
        total_amount: payment.total_amount || 0,
        due_date: payment.due_date || '',
        status: payment.status || 'pending'
    };
    return btoa(JSON.stringify(dataToHash)).substring(0, 32);
}

// ==========================================
// 2. HELPER: Thai Baht Text
// ==========================================
function numberToThaiText(number) {
    if (!number || isNaN(number) || number === 0) return 'ศูนย์บาทถ้วน';
    const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    const parts = number.toFixed(2).split('.');
    const integerPart = parseInt(parts[0]);
    const decimalPart = parseInt(parts[1]);

    function convertInteger(num) {
        if (num === 0) return '';
        const s = num.toString();
        let res = '';
        for (let i = 0; i < s.length; i++) {
            const digit = parseInt(s[i]);
            const pos = s.length - i - 1;
            if (digit === 0) continue;
            if (pos === 1 && digit === 1) res += 'สิบ';
            else if (pos === 1 && digit === 2) res += 'ยี่สิบ';
            else if (pos === 0 && digit === 1 && s.length > 1 && s[i - 1] !== '0') res += 'เอ็ด';
            else res += numbers[digit] + positions[pos];
        }
        return res;
    }
    let text = convertInteger(integerPart) + 'บาท';
    if (decimalPart > 0) text += convertInteger(decimalPart) + 'สตางค์';
    else text += 'ถ้วน';
    return text;
}

// ==========================================
// 3. HELPER: Generate Screenshot (รับค่าปรับ Override)
// ==========================================
async function generateInvoiceScreenshot(base44, paymentId, invoice, manualLateFee = 0) {
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
            return new Date(dateString).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
        } catch { return '-'; }
    };

    const isOverdue = payment.status === 'overdue' || (payment.due_date && new Date() > new Date(payment.due_date));

    // ⭐ ใช้ค่าปรับที่ส่งมา (manualLateFee) แทนค่าใน invoice เพื่อความถูกต้อง
    const finalLateFee = Number(manualLateFee);
    // คำนวณยอดรวมใหม่
    const originalTotal = Number(payment.total_amount || 0) - Number(payment.late_fee_amount || 0);
    const finalTotal = originalTotal + finalLateFee;

    const lineItems = [];
    if (payment.rent_amount > 0) lineItems.push({ name: 'ค่าเช่า', total: payment.rent_amount });
    if (payment.electricity_amount > 0) lineItems.push({ name: `ค่าไฟ (${payment.electricity_units || 0} หน่วย)`, total: payment.electricity_amount });
    if (payment.water_amount > 0) lineItems.push({ name: `ค่าน้ำ (${payment.water_units || 0} หน่วย)`, total: payment.water_amount });
    if (payment.internet_amount > 0) lineItems.push({ name: 'ค่าอินเทอร์เน็ต', total: payment.internet_amount });
    if (payment.common_fee_amount > 0) lineItems.push({ name: 'ค่าส่วนกลาง', total: payment.common_fee_amount });
    if (payment.parking_fee_amount > 0) lineItems.push({ name: 'ค่าที่จอดรถ', total: payment.parking_fee_amount });
    if (payment.other_amount > 0) lineItems.push({ name: 'ค่าใช้จ่ายอื่นๆ', total: payment.other_amount });
    
    // ⭐ ใส่ค่าปรับที่ถูกต้องลงไป
    if (finalLateFee > 0) lineItems.push({ name: '⚠️ ค่าปรับชำระล่าช้า', total: finalLateFee });

    const htmlContent = `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
    <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;700&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Sarabun', sans-serif; padding: 20px; background: #f8fafc; color: #334155; }
        .container { max-width: 500px; margin: 0 auto; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 20px; }
        .logo { height: 50px; object-fit: contain; margin-bottom: 10px; }
        .title { font-size: 22px; font-weight: bold; color: ${isOverdue ? '#dc2626' : '#2563eb'}; }
        .row { display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px; font-size: 14px; }
        .total-row { display: flex; justify-content: space-between; font-weight: bold; font-size: 20px; color: #1e293b; margin-top: 20px; border-top: 2px solid #e2e8f0; padding-top: 15px; }
        .footer { background: #eff6ff; padding: 15px; border-radius: 8px; margin-top: 20px; font-size: 12px; }
    </style></head><body>
        <div class="container">
            <div class="header">
                ${buildingLogo ? `<img src="${buildingLogo}" class="logo">` : ''}
                <div class="title">ใบแจ้งหนี้ ${isOverdue ? '(เกินกำหนด)' : ''}</div>
                <div>${escapeHtml(buildingName)}</div>
            </div>
            <div style="margin-bottom: 20px;">
                <b>ห้อง ${escapeHtml(room.room_number)}</b><br>
                ผู้เช่า: ${escapeHtml(tenant.full_name)}<br>
                ครบกำหนด: ${formatDate(payment.due_date)}
            </div>
            ${lineItems.map(item => `<div class="row"><span>${escapeHtml(item.name)}</span><span>${item.total.toLocaleString()} ฿</span></div>`).join('')}
            <div class="total-row">
                <span>รวมทั้งสิ้น</span>
                <span style="color:${isOverdue ? '#dc2626' : '#2563eb'}">${finalTotal.toLocaleString()} ฿</span>
            </div>
            <div class="footer">
                <b>ช่องทางการชำระเงิน</b><br>
                ธนาคาร: ${escapeHtml(bank.name)}<br>
                เลขบัญชี: ${escapeHtml(bank.account_number)}<br>
                ชื่อบัญชี: ${escapeHtml(bank.account_name)}
            </div>
        </div>
    </body></html>`;

    const res = await fetch(`https://production-sfo.browserless.io/screenshot?token=${BROWSERLESS_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: htmlContent, options: { type: 'png', fullPage: true } })
    });

    if (!res.ok) throw new Error("Browserless failed");
    const imageBlob = await res.blob();
    const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: imageFile });
    return file_url;
}

// ==========================================
// 4. MAIN LOGIC (Full Process)
// ==========================================
Deno.serve(async (req) => {
    const startTime = Date.now();
    let base44 = createClientFromRequest(req);

    console.log('🔴🔴🔴 Starting automated overdue reminders V3 (FULL PROCESS)...');
    console.log('⭐⭐⭐ Step 1: Late Fee | Step 2: Invoice Gen | Step 3: Messaging');

    try {
        const body = await req.json().catch(() => ({}));
        const targetBranchId = body.branch_id || null;
        const limit = body.limit || 50;

        // ----------------------------------------------------
        // 1. CONFIG & DATA FETCHING
        // ----------------------------------------------------
        const configs = await base44.asServiceRole.entities.Config.list() || [];
        const getConfigValue = (key, branchId, def) => {
            const bVal = configs.find(c => c.key === key && c.branch_id === branchId);
            if (bVal?.value) return bVal.value;
            const gVal = configs.find(c => c.key === key && !c.branch_id);
            return gVal?.value || def;
        };

        const enabledBranches = configs.filter(c => c.key === 'send_overdue_reminder' && c.value === 'true').map(c => c.branch_id);
        console.log(`📊 Enabled Branches: ${enabledBranches.join(', ')}`);

        // Helper Fetch
        async function fetchAllUnpaid(branchId) {
            const filter = { status: 'pending' };
            if (branchId) filter.branch_id = branchId;
            return await base44.asServiceRole.entities.Payment.filter(filter, '-created_date', 100); // Limit 100 to prevent timeout
        }

        const unpaidPayments = await fetchAllUnpaid(targetBranchId);
        const today = startOfDay(new Date());

        // Filter จริงๆ ว่าเกินกำหนดหรือยัง
        const overduePayments = unpaidPayments.filter(p => {
            if (!p.due_date) return false;
            const dueDate = startOfDay(parseISO(p.due_date));
            const diff = differenceInDays(today, dueDate);
            return diff > 0 && enabledBranches.includes(p.branch_id);
        }).slice(0, limit);

        console.log(`📊 Found ${overduePayments.length} overdue payments to process`);

        if (overduePayments.length === 0) {
            return Response.json({ success: true, message: "No overdue payments found." });
        }

        // Prepare Map for Rooms/Tenants
        const tenantIds = [...new Set(overduePayments.map(p => p.tenant_id))];
        const roomIds = [...new Set(overduePayments.map(p => p.room_id))];
        
        const [tenants, rooms] = await Promise.all([
            Promise.all(tenantIds.map(id => base44.asServiceRole.entities.Tenant.get(id).catch(() => null))),
            Promise.all(roomIds.map(id => base44.asServiceRole.entities.Room.get(id).catch(() => null)))
        ]);
        const tenantMap = new Map(tenants.filter(Boolean).map(t => [t.id, t]));
        const roomMap = new Map(rooms.filter(Boolean).map(r => [r.id, r]));

        // ----------------------------------------------------
        // ⭐ STEP 1: CALCULATE LATE FEES (Update DB First)
        // ----------------------------------------------------
        console.log(`\n💰 ========== STEP 1: CALCULATING LATE FEES ==========`);
        for (const payment of overduePayments) {
            const dueDate = startOfDay(parseISO(payment.due_date));
            const daysOverdue = differenceInDays(today, dueDate);
            let lateFee = 0;

            // Logic คำนวณค่าปรับ
            const feePerDayConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && c.branch_id === payment.branch_id) 
                                 || configs.find(c => c.key === 'late_payment_fee_per_day' && !c.branch_id);
            const feePerDay = parseFloat(feePerDayConfig?.value || 0);
            
            if (feePerDay > 0) {
                lateFee = daysOverdue * feePerDay;
            }

            // ถ้าค่าปรับเปลี่ยน ให้ Update DB
            if (lateFee !== (payment.late_fee_amount || 0)) {
                console.log(`💰 Payment ${payment.id}: Updating Late Fee to ${lateFee} (Overdue ${daysOverdue} days)`);
                const baseTotal = payment.total_amount - (payment.late_fee_amount || 0);
                await base44.asServiceRole.entities.Payment.update(payment.id, {
                    late_fee_amount: lateFee,
                    total_amount: baseTotal + lateFee,
                    status: 'overdue' // บังคับสถานะ
                });
                // อัปเดต Object ในตัวแปรด้วย
                payment.late_fee_amount = lateFee;
                payment.total_amount = baseTotal + lateFee;
            }
        }

        // ----------------------------------------------------
        // ⭐ STEP 2: GENERATE INVOICES (With Correct Fee)
        // ----------------------------------------------------
        console.log(`\n🖼️ ========== STEP 2: INVOICE GENERATION ==========`);
        let invoicesGenerated = 0;
        
        for (const payment of overduePayments) {
            const room = roomMap.get(payment.room_id);
            const currentHash = generatePaymentHash(payment);
            
            // เช็คว่าต้องสร้างรูปใหม่ไหม
            if (!payment.invoice_image_url || payment.invoice_data_hash !== currentHash) {
                console.log(`🖼️ Generating Image for Room: ${room?.room_number}`);
                
                try {
                    const invoiceData = await base44.asServiceRole.functions.invoke('getPublicInvoice', { paymentId: payment.id });
                    if (invoiceData.data?.success) {
                        // ⭐ ส่ง payment.late_fee_amount ที่คำนวณแล้วไปบังคับ
                        const imageUrl = await generateInvoiceScreenshot(base44, payment.id, invoiceData.data.invoice, payment.late_fee_amount);
                        
                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            invoice_image_url: imageUrl,
                            invoice_image_status: 'completed',
                            invoice_data_hash: currentHash
                        });
                        
                        payment.invoice_image_url = imageUrl; // อัปเดตตัวแปรเพื่อใช้ใน Step 3
                        invoicesGenerated++;
                    }
                } catch (e) {
                    console.error(`❌ Invoice Gen Failed for ${payment.id}:`, e.message);
                }
            } else {
                console.log(`⏭️ Image OK for Room: ${room?.room_number}`);
            }
        }
        console.log(`✅ Generated ${invoicesGenerated} new invoices`);

        // ----------------------------------------------------
        // ⭐ STEP 3: SEND NOTIFICATIONS (Safe Scope)
        // ----------------------------------------------------
        console.log(`\n💬 ========== STEP 3: MESSAGE CREATION ==========`);
        let sentCount = 0;

        for (const payment of overduePayments) {
            const tenant = tenantMap.get(payment.tenant_id);
            const room = roomMap.get(payment.room_id);
            const branchId = payment.branch_id;

            // ⭐ FIX SCOPE: ประกาศตัวแปรที่นี่ เพื่อให้ใช้ได้ทุกที่ในลูป
            const branchName = getConfigValue('building_name', branchId, 'W RESIDENTS');
            const autoSend = getConfigValue('auto_send_bills_after_generation', branchId, 'false') === 'true';

            // Log การทำงาน
            console.log(`Checking Room ${room?.room_number} (${tenant?.full_name}): AutoSend=${autoSend}, SentDate=${payment.bill_sent_date ? 'Yes' : 'No'}`);

            if (!autoSend) continue;
            
            // เช็คว่าส่งวันนี้ไปหรือยัง
            const todayStr = new Date().toISOString().split('T')[0];
            const lastSent = payment.overdue_reminder_sent_date ? payment.overdue_reminder_sent_date.split('T')[0] : '';
            
            if (lastSent === todayStr) {
                console.log(`   ⏭️ Already sent today.`);
                continue;
            }

            if (tenant?.line_user_id) {
                const token = getConfigValue('line_channel_access_token', branchId, '');
                if (token) {
                    console.log(`   📱 Sending LINE...`);
                    const msg = `🔴 แจ้งเตือนเกินกำหนดชำระ\n${branchName}\n` +
                                `ห้อง: ${room?.room_number}\n` +
                                `ยอดชำระ: ${payment.total_amount.toLocaleString()} ฿\n` +
                                (payment.late_fee_amount > 0 ? `(รวมค่าปรับ ${payment.late_fee_amount} บ.)\n` : '') +
                                `📄 ดูบิล: ${payment.invoice_image_url || '-'}\n\n` +
                                `กรุณาชำระโดยด่วน ขอบคุณครับ 🙏`;

                    try {
                        const res = await fetch('https://api.line.me/v2/bot/message/push', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ to: tenant.line_user_id, messages: [{ type: 'text', text: msg }] })
                        });

                        if (res.ok) {
                            await base44.asServiceRole.entities.Payment.update(payment.id, { overdue_reminder_sent_date: new Date().toISOString() });
                            sentCount++;
                            console.log(`   ✅ SENT SUCCESS!`);
                        } else {
                            console.error(`   ❌ LINE API Error: ${await res.text()}`);
                        }
                    } catch (err) {
                        console.error(`   ❌ Network Error: ${err.message}`);
                    }
                }
            }
            await delay(200); // Rate Limit Protection
        }

        // Final Log
        const executionTime = Date.now() - startTime;
        console.log(`\n🎉 DONE! Sent ${sentCount} messages. Time: ${executionTime}ms`);
        
        return Response.json({ success: true, processed: overduePayments.length, sent: sentCount });

    } catch (error) {
        console.error('❌ CRITICAL ERROR:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});