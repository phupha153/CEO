import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import { differenceInDays, parseISO, startOfDay } from 'npm:date-fns@3.6.0';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ⭐ Retry wrapper with exponential backoff
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 Attempt ${attempt}/${maxRetries}...`);
            return await fn();
        } catch (error) {
            if (attempt === maxRetries) {
                throw error; // ส่งข้อผิดพลาดครั้งสุดท้าย
            }
            const delayMs = baseDelay * Math.pow(2, attempt - 1); // Exponential: 1s, 2s, 4s
            console.warn(`⚠️ Attempt ${attempt} failed (${error.message}), retrying in ${delayMs}ms...`);
            await delay(delayMs);
        }
    }
}

// ⭐ สร้าง timestamp เวลาไทย (UTC+7)
function getThailandTimestamp() {
    const now = new Date();
    const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    return thailandTime.toISOString();
}

// ⭐ สร้าง hash จากข้อมูลบิล เพื่อตรวจจับการเปลี่ยนแปลง
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
        late_fee_amount: payment.late_fee_amount || 0,
        total_amount: payment.total_amount || 0,
        due_date: payment.due_date || '',
        status: payment.status || 'pending'
    };
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32);
}

// ⭐ สร้างรูปใบแจ้งหนี้ inline
async function generateInvoiceScreenshot(base44, paymentId, invoice) {
    const BROWSERLESS_API_KEY = Deno.env.get("BROWSERLESS_API_KEY");
    if (!BROWSERLESS_API_KEY) {
        throw new Error("BROWSERLESS_API_KEY not set");
    }

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
    const isOverdue = payment.status === 'overdue' || (payment.status === 'pending' && payment.due_date && new Date() > new Date(payment.due_date));
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
    if (payment.late_fee_amount > 0) lineItems.push({ name: '⚠️ ค่าปรับชำระล่าช้า', total: payment.late_fee_amount });

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
.invoice-title h2 { font-size: 16px; font-weight: bold; color: ${isOverdue ? '#dc2626' : '#2563eb'}; }
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
<div class="invoice-title"><h2>ใบแจ้งหนี้${isOverdue ? ' (เกินกำหนด)' : ''}</h2></div>
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

    // Upload image
    const imageBlob = await browserlessResponse.blob();
    const imageFile = new File([imageBlob], `invoice-${paymentId}.png`, { type: 'image/png' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: imageFile });
    
    return file_url;
}

// ส่งการแจ้งเตือนค้างชำระอัตโนมัติให้ผู้เช่า (V2 - WITH LATE FEE CALC + INVOICE GEN)
Deno.serve(async (req) => {
    const startTime = Date.now();

    try {
        const base44 = createClientFromRequest(req);

        console.log('🔴🔴🔴 Starting automated overdue reminders V2 (WITH INVOICE + LATE FEE)...');
        console.log('⭐⭐⭐ This version includes: STEP 1=Late Fee Calc, STEP 2=Invoice Gen, STEP 3=Messaging');

        // Parse request body
        let targetBranchId = null;
        let testLineUserId = null;
        let limit = 100; // จำนวนบิลสูงสุดที่จะส่งต่อครั้ง (default 100)
        try {
            const text = await req.text();
            if (text) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
                testLineUserId = body.test_line_user_id || null;
                limit = body.limit || 100;
            }
        } catch (parseError) {
            console.log('⚠️ No body or parse error:', parseError.message);
        }

        console.log('📋 Target branch:', targetBranchId || 'ALL BRANCHES');
        console.log('📊 Limit per run:', limit);

        // 1. ดึงการตั้งค่าจาก Config
        const configs = await base44.asServiceRole.entities.Config.list();
        
        const getConfigValue = (key, defaultValue, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        // ⭐ เช็คว่าสาขาไหนเปิดการแจ้งเตือนค้างชำระ
        const branchReminderConfigs = configs.filter(c => c.key === 'send_overdue_reminder');
        const enabledBranches = branchReminderConfigs
            .filter(c => c.value === 'true')
            .map(c => c.branch_id)
            .filter(id => id && id.trim() !== '');
        const disabledBranches = branchReminderConfigs
            .filter(c => c.value !== 'true')
            .map(c => c.branch_id)
            .filter(id => id && id.trim() !== '');

        console.log(`📊 Branch overdue reminder status:`);
        console.log(`   ✅ Enabled branches (${enabledBranches.length}): ${enabledBranches.slice(0, 5).join(', ')}${enabledBranches.length > 5 ? '...' : ''}`);
        console.log(`   ❌ Disabled branches (${disabledBranches.length})`);

        if (enabledBranches.length === 0) {
            console.log('⚠️ No branches have overdue reminders enabled');
            return Response.json({
                success: true,
                message: 'ไม่มีสาขาใดเปิดการแจ้งเตือนค้างชำระ กรุณาเปิดในหน้าตั้งค่า',
                sent: 0,
                enabledBranches: [],
                disabledBranches: disabledBranches.length
            });
        }

        // 3. ดึงข้อมูลแบบกรองเฉพาะที่จำเป็น - filter status ตั้งแต่ query
        console.log('🔍 Fetching filtered overdue payments...');
        console.log('⭐ Using NEW VERSION with STEP 1+2+3 (late fee calc + invoice gen + messaging)');

        // ⭐ ใช้เวลาไทย (UTC+7) เพื่อให้ตรงกับเวลาจริงในประเทศไทย
        const now = new Date();
        const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const today = startOfDay(new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate()));
        console.log(`📅 Today (Thailand): ${today.toISOString().split('T')[0]}`);

        // ⭐ ดึงเฉพาะ payment ที่ยังไม่ชำระ (pending/overdue) - ใช้ limit*2 แทน fetchAll
        // ⚡ ใช้ limit*2 เพื่อให้มีพอกรองหลังจากเช็ค overdue_reminder_sent_date
        const paymentFilter = {
            status: 'pending'  // ดึงเฉพาะที่ยังไม่จ่าย
        };

        if (targetBranchId) {
            paymentFilter.branch_id = targetBranchId;
        }

        let pendingPayments = await base44.asServiceRole.entities.Payment.filter(paymentFilter, '-created_date', limit * 2);

        // เพิ่มเช็ค status='overdue' ด้วย (กรณีที่ระบบตั้งเป็น overdue แล้ว)
        const overdueFilter = {
            status: 'overdue'
        };
        if (targetBranchId) {
            overdueFilter.branch_id = targetBranchId;
        }

        const overdueByStatus = await base44.asServiceRole.entities.Payment.filter(overdueFilter, '-created_date', limit * 2);
        const allUnpaidPayments = [...pendingPayments, ...overdueByStatus];

        console.log(`📊 Fetched ${allUnpaidPayments.length} unpaid payments (pending+overdue)`);

        // กรองใน memory หา payment ที่เกินกำหนดจริงๆ (due_date < today)
        let overduePayments = allUnpaidPayments.filter(p => {
            if (!p.due_date) return false;

            const dueDate = startOfDay(parseISO(p.due_date));
            const daysOverdue = differenceInDays(today, dueDate);

            return daysOverdue > 0;
        });

        console.log(`📊 Found ${overduePayments.length} actually overdue payments`);

        // กรองเฉพาะสาขาที่เปิดการแจ้งเตือน และยังไม่ส่งในวันนี้ (เวลาไทย)
        const todayString = today.toISOString().split('T')[0]; // วันนี้ในเวลาไทย
        const paymentsFromEnabledBranches = overduePayments.filter(p => {
            if (!enabledBranches.includes(p.branch_id)) {
                return false;
            }

            // ⭐ ถ้าส่งแจ้งเตือนค้างชำระไปแล้วในวันนี้ ไม่ต้องส่งซ้ำ
            if (p.overdue_reminder_sent_date) {
                const lastSentDate = p.overdue_reminder_sent_date.split('T')[0];
                if (lastSentDate === todayString) {
                    console.log(`⏭️ Skipping payment ${p.id} - already sent overdue reminder today`);
                    return false;
                }
            }

            return true;
        });

        const skippedCount = overduePayments.length - paymentsFromEnabledBranches.length;
        const paymentsToProcess = paymentsFromEnabledBranches.slice(0, limit);
        const totalRemaining = paymentsFromEnabledBranches.length - paymentsToProcess.length;

        console.log(`📋 Payments from enabled branches: ${paymentsFromEnabledBranches.length}`);
        console.log(`📋 Processing this round: ${paymentsToProcess.length}`);
        console.log(`📋 Remaining for next round: ${totalRemaining}`);
        console.log(`⏭️ Skipped (disabled branches or sent today): ${skippedCount}`);

        // ⭐ ดึง tenant และ room แบบ Batch ทีละสาขา (ลด N+1 Queries)
        const uniqueBranchIds = [...new Set(paymentsToProcess.map(p => p.branch_id).filter(id => id))];
        console.log(`📥 Fetching tenants and rooms for ${uniqueBranchIds.length} branches...`);
        
        const allTenants = [];
        const allRooms = [];
        const CACHE_CHUNK = 500;

        for (const bId of uniqueBranchIds) {
            // ดึง Tenant
            let tOffset = 0;
            while (true) {
                const chunk = await base44.asServiceRole.entities.Tenant.filter({ branch_id: bId }, '-id', CACHE_CHUNK, tOffset);
                if (chunk.length === 0) break;
                allTenants.push(...chunk.map(t => ({
                    id: t.id,
                    full_name: t.full_name,
                    line_user_id: t.line_user_id,
                    facebook_user_id: t.facebook_user_id
                })));
                tOffset += CACHE_CHUNK;
                if (chunk.length < CACHE_CHUNK) break;
            }

            // ดึง Room
            let rOffset = 0;
            while (true) {
                const chunk = await base44.asServiceRole.entities.Room.filter({ branch_id: bId }, '-id', CACHE_CHUNK, rOffset);
                if (chunk.length === 0) break;
                allRooms.push(...chunk.map(r => ({
                    id: r.id,
                    room_number: r.room_number
                })));
                rOffset += CACHE_CHUNK;
                if (chunk.length < CACHE_CHUNK) break;
            }
        }

        const tenantMap = new Map(allTenants.map(t => [t.id, t]));
        const roomMap = new Map(allRooms.map(r => [r.id, r]));
        
        console.log(`✅ Loaded ${paymentsToProcess.length} relevant payments, ${allTenants.length} tenants, ${allRooms.length} rooms`);

        if (paymentsToProcess.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีบิลค้างชำระที่ต้องส่งแจ้งเตือน',
                sent: 0,
                total: 0,
                remaining: 0,
                hasMore: false
            });
        }

       console.log(`\n💰 ========== STEP 1: CALCULATING LATE FEES (PRODUCTION-GRADE) ==========`);
// ⭐ แก้ให้ใช้วันที่ไทย (UTC+7)
const nowForCalc = new Date();
const thaiDateForCalc = new Date(nowForCalc.getTime() + (7 * 60 * 60 * 1000));
const todayDateStr = thaiDateForCalc.toISOString().split('T')[0];

        let feeCalculated = 0;
        let feeSkipped = 0;
        
        for (const payment of paymentsToProcess) {
            const dueDate = startOfDay(parseISO(payment.due_date));
            const daysOverdue = differenceInDays(today, dueDate);

            if (daysOverdue <= 0) continue;

            // 🔒 LOCK 1: ถ้า admin ล็อคค่าปรับไว้ → skip (ไม่คำนวณทับ)
            if (payment.late_fee_locked === true) {
                const room = roomMap.get(payment.room_id);
                console.log(`🔒 LOCKED ${payment.id.substring(0,8)} (ห้อง ${room?.room_number}): Admin locked at ${payment.late_fee_amount || 0} บาท`);
                feeSkipped++;
                continue;
            }

            // 🔒 LOCK 2: เช็คว่าคำนวณวันนี้แล้วหรือยัง (ป้องกันคำนวณซ้ำ)
            const lastCalcDate = payment.late_fee_last_calculated?.split('T')[0];
            if (lastCalcDate === todayDateStr && payment.late_fee_amount > 0) {
                const room = roomMap.get(payment.room_id);
                console.log(`⏭️ SKIP ${payment.id.substring(0,8)} (ห้อง ${room?.room_number}): Already calculated today (${payment.late_fee_amount} บาท)`);
                feeSkipped++;
                continue;
            }

            const branchId = payment.branch_id;
            let lateFee = 0;

            // เช็คว่าใช้ระบบ tiers หรือไม่
            const branchTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === branchId);
            const globalTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
            const tiersEnabledConfig = branchTiersEnabledConfig || globalTiersEnabledConfig;
            const tiersEnabled = tiersEnabledConfig?.value === 'true';

            if (tiersEnabled) {
                const branchTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && c.branch_id === branchId);
                const globalTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
                const tiersConfig = branchTiersConfig || globalTiersConfig;

                if (tiersConfig?.value) {
                    try {
                        const tiers = JSON.parse(tiersConfig.value);
                        for (const tier of tiers) {
                            const daysFrom = tier.days_from || 1;
                            const daysTo = tier.days_to || 999;
                            const feePerDay = parseFloat(tier.fee_per_day || 0);
                            if (daysOverdue >= daysFrom) {
                                const daysInTier = Math.min(daysOverdue, daysTo) - daysFrom + 1;
                                if (daysInTier > 0) lateFee += daysInTier * feePerDay;
                            }
                            if (daysOverdue <= daysTo) break;
                        }
                    } catch (e) {
                        console.error('Error parsing tiers:', e);
                    }
                }
            } else {
                const branchConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && c.branch_id === branchId);
                const globalConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && !c.branch_id);
                const config = branchConfig || globalConfig;
                const feePerDay = parseFloat(config?.value || '0');
                if (!isNaN(feePerDay) && feePerDay > 0) {
                    lateFee = daysOverdue * feePerDay;
                }
            }

            // อัปเดตค่าปรับและ total_amount
            const currentLateFee = payment.late_fee_amount || 0;
            const baseAmount = payment.total_amount - currentLateFee;
            const newTotalAmount = baseAmount + lateFee;

            const room = roomMap.get(payment.room_id);
            const hasLateFeeChanged = lateFee !== currentLateFee;

            console.log(`💰 Payment ${payment.id.substring(0,8)} (ห้อง ${room?.room_number}): ${daysOverdue} วัน → ค่าปรับ ${lateFee} บาท ${hasLateFeeChanged ? '(เปลี่ยนแปลง)' : '(เท่าเดิม)'}`);

            // ⭐ PRODUCTION-GRADE: อัปเดตเฉพาะเมื่อค่าปรับเปลี่ยนแปลง + บันทึก timestamp (เวลาไทย)
            const thailandTime = getThailandTimestamp();
            if (hasLateFeeChanged || payment.status !== 'overdue') {
                await base44.asServiceRole.entities.Payment.update(payment.id, {
                    status: 'overdue',
                    late_fee_amount: lateFee,
                    total_amount: newTotalAmount,
                    late_fee_last_calculated: thailandTime
                });
                feeCalculated++;
                console.log(`   ✅ DB Updated with timestamp (Thailand time)`);
            } else {
                console.log(`   ⏭️ No change - updating timestamp only`);
                await base44.asServiceRole.entities.Payment.update(payment.id, {
                    late_fee_last_calculated: thailandTime
                });
            }

            // อัปเดต payment object ในหน่วยความจำ
            payment.late_fee_amount = lateFee;
            payment.total_amount = newTotalAmount;
            payment.status = 'overdue';
            payment.late_fee_last_calculated = thailandTime;

            // ⚡ Removed delay - not needed for performance
        }
        
        console.log(`\n📊 LATE FEE CALCULATION SUMMARY:`);
        console.log(`   - Calculated: ${feeCalculated}`);
        console.log(`   - Skipped (already done today): ${feeSkipped}`);
        console.log(`   - Total processed: ${paymentsToProcess.length}`);
        
        console.log(`✅ STEP 1 COMPLETE: ${feeCalculated} calculated, ${feeSkipped} skipped (already done today)`);

        // ⭐ ขั้นตอนที่ 2: เตรียมข้อความสำหรับแต่ละบิล (ไม่สร้างรูป - ส่งแค่ลิงก์)
        console.log(`\n💬 ========== STEP 2: MESSAGE CREATION ==========`);
        const recipients = [];
        const messageCreationDetails = [];

        for (const payment of paymentsToProcess) {
            // ⭐ ใช้ payment ปัจจุบัน (ไม่ต้อง refresh เพราะไม่มีการสร้างรูป)
            const latestPayment = payment;
            
            const tenant = tenantMap.get(latestPayment.tenant_id);
            const room = roomMap.get(latestPayment.room_id);
            const roomNumber = room?.room_number || 'N/A';
            
            console.log(`\n💬 Payment ${latestPayment.id.substring(0,8)} (ห้อง ${roomNumber}):`);

            if (!tenant) {
                console.log(`   ❌ ไม่พบข้อมูล tenant - ข้าม`);
                continue;
            }

            const hasLine = tenant.line_user_id && tenant.line_user_id.trim() !== '';
            const hasFacebook = tenant.facebook_user_id && tenant.facebook_user_id.trim() !== '';
            
            console.log(`   - Tenant: ${tenant.full_name}`);
            console.log(`   - LINE ID: ${hasLine ? '✅ มี' : '❌ ไม่มี'} (${tenant.line_user_id || 'N/A'})`);
            console.log(`   - Facebook ID: ${hasFacebook ? '✅ มี' : '❌ ไม่มี'} (${tenant.facebook_user_id || 'N/A'})`);
            
            if (!hasLine && !hasFacebook) {
                console.log(`   ⚠️ ไม่มี LINE/Facebook ID - ข้าม`);
                continue;
            }

            // คำนวณจำนวนวันที่เกินกำหนด
            const dueDate = startOfDay(parseISO(latestPayment.due_date));
            const daysOverdue = differenceInDays(today, dueDate);

            // ดึง config เฉพาะสาขา
            const paymentBranchId = latestPayment.branch_id;
            const branchBankName = getConfigValue('bank_name', '-', paymentBranchId);
            const branchBankAccountNumber = getConfigValue('bank_account_number', '-', paymentBranchId);
            const branchBankAccountName = getConfigValue('bank_account_name', '-', paymentBranchId);
            const branchBuildingName = getConfigValue('building_name', 'ที่พัก', paymentBranchId);
            const qrCodeUrl = getConfigValue('payment_qr_code_url', null, paymentBranchId);

            // ⭐⭐⭐ ใช้ latestPayment (ที่ refresh แล้ว) สำหรับค่าปรับและ invoice URL
            const lateFee = latestPayment.late_fee_amount || 0;
            const originalAmount = latestPayment.total_amount - lateFee;
            const totalWithLateFee = latestPayment.total_amount;
            
            console.log(`   - latestPayment.late_fee_amount: ${latestPayment.late_fee_amount || 0} บาท`);
            console.log(`   - latestPayment.total_amount: ${latestPayment.total_amount || 0} บาท`);
            console.log(`   - latestPayment.invoice_image_url: ${latestPayment.invoice_image_url ? '✅ มี' : '❌ ไม่มี'}`);

            // ⭐ สร้าง Text Message แบบเดียวกับ sendPaymentReminder
            const branchTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === paymentBranchId);
            const globalTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
            const tiersEnabledConfig = branchTiersEnabledConfig || globalTiersEnabledConfig;
            const tiersEnabled = tiersEnabledConfig?.value === 'true';

            // ⭐ ดึง late fee tiers
            let lateFeeStructure = null;
            if (tiersEnabled) {
                const branchTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && c.branch_id === paymentBranchId);
                const globalTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
                const tiersConfig = branchTiersConfig || globalTiersConfig;
                if (tiersConfig?.value) {
                    try {
                        lateFeeStructure = JSON.parse(tiersConfig.value);
                    } catch {}
                }
            }

            // สร้างข้อความ
            let message = `🔴 เกินกำหนดชำระ (${daysOverdue} วัน)\n\n`;
            message += `${branchBuildingName}\n`;
            message += `คุณ ${tenant.full_name} ห้อง ${roomNumber}\n\n`;
            
            // แสดงยอดเดิมและค่าปรับ
            message += `💰 ยอดเดิม: ${originalAmount.toLocaleString()} บาท\n`;
            if (lateFee > 0) {
                message += `⚠️ ค่าปรับล่าช้า: ${lateFee.toLocaleString()} บาท\n`;
            }
            message += `💰 รวมทั้งสิ้น: ${totalWithLateFee.toLocaleString()} บาท\n\n`;
            
            // แจ้งค่าปรับต่อไป
            if (lateFeeStructure && Array.isArray(lateFeeStructure) && lateFeeStructure.length > 0) {
                message += `⚠️ ค่าปรับชำระล่าช้า:\n`;
                lateFeeStructure.forEach((tier) => {
                    if (tier.days_to >= 999) {
                        message += `   วันที่ ${tier.days_from} เป็นต้นไป: ${tier.fee_per_day} บาท/วัน\n`;
                    } else {
                        message += `   วันที่ ${tier.days_from}-${tier.days_to}: ${tier.fee_per_day} บาท/วัน\n`;
                    }
                });
            }

            console.log(`   📏 Text message created`);

            messageCreationDetails.push({
                paymentId: latestPayment.id,
                roomNumber: roomNumber,
                tenantName: tenant.full_name,
                messageType: 'text',
                lateFee: lateFee,
                totalAmount: totalWithLateFee,
                channels: {
                    line: hasLine,
                    facebook: hasFacebook
                }
            });

            recipients.push({
                lineUserId: hasLine ? tenant.line_user_id : null,
                facebookUserId: hasFacebook ? tenant.facebook_user_id : null,
                message: message,
                imageUrl: qrCodeUrl,
                metadata: {
                    paymentId: latestPayment.id,
                    tenantId: tenant.id,
                    tenantName: tenant.full_name,
                    roomNumber: roomNumber,
                    branchId: paymentBranchId,
                    channel: hasLine ? 'line' : 'facebook'
                }
            });
        }
        
        console.log(`\n📋 ========== MESSAGE CREATION SUMMARY ==========`);
        console.log(`   - Total messages: ${recipients.length}`);
        console.log(`   - With late fee: ${messageCreationDetails.filter(d => d.lateFee > 0).length}`);
        console.log(`   - No late fee: ${messageCreationDetails.filter(d => d.lateFee === 0).length}`);

        // แสดงตัวอย่างข้อความ 3 รายการแรก
        console.log(`\n📝 ========== MESSAGE EXAMPLES (first 3) ==========`);
        messageCreationDetails.slice(0, 3).forEach((detail, idx) => {
            const recipient = recipients[idx];
            console.log(`\n${idx + 1}. ห้อง ${detail.roomNumber} (${detail.tenantName}):`);
            console.log(`   💰 Late Fee: ${detail.lateFee} บาท`);
            console.log(`   💰 Total: ${detail.totalAmount} บาท`);
            console.log(`   📱 Channels: LINE=${detail.channels.line ? '✅' : '❌'}, FB=${detail.channels.facebook ? '✅' : '❌'}`);
            console.log(`   📄 Message:\n${recipient?.message || 'N/A'}\n`);
        });

        // 6. ส่งข้อความ - ส่ง Flex Message โดยตรงไป LINE API
        let sentCount = 0;
        let sendErrors = [];
        const successfulPaymentIds = new Set();

        const lineRecipients = recipients.filter(r => r.lineUserId);
        const facebookRecipients = recipients.filter(r => r.facebookUserId);

        console.log(`📊 Recipients: ${lineRecipients.length} LINE, ${facebookRecipients.length} Facebook`);

        if (recipients.length > 0) {
            const now_iso = getThailandTimestamp();
            const CHUNK_SIZE = 10; // ลดจำนวนต่อรอบป้องกัน Timeout ฝั่งต้นทาง

            // --- 1. จัดการ LINE ---
            const lineRecipientsCleaned = lineRecipients.map(r => ({
                lineUserId: testLineUserId || r.lineUserId,
                message: r.message,
                imageUrl: r.imageUrl,
                branchId: r.metadata.branchId,
                metadata: {
                    paymentId: r.metadata.paymentId,
                    tenantId: r.metadata.tenantId,
                    tenantName: r.metadata.tenantName,
                    roomNumber: r.metadata.roomNumber,
                    branchId: r.metadata.branchId,
                    platform: 'line'
                }
            }));

            if (lineRecipientsCleaned.length > 0) {
                console.log(`📤 Sending LINE in chunks of ${CHUNK_SIZE}...`);
                for (let i = 0; i < lineRecipientsCleaned.length; i += CHUNK_SIZE) {
                    const chunk = lineRecipientsCleaned.slice(i, i + CHUNK_SIZE);
                    const chunkSuccessfulPaymentIds = [];

                    try {
                        const batchResult = await retryWithBackoff(
                            () => base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                                recipients: chunk,
                                options: {
                                    batchSize: 10,
                                    delayBetweenBatches: 1000,
                                    delayBetweenMessages: 100,
                                    retryAttempts: 2
                                }
                            }),
                            3, 1000
                        );

                        const result = batchResult.data;
                        sentCount += result.success || 0;
                        
                        if (result.errors) {
                            result.errors.forEach(err => {
                                sendErrors.push(`ห้อง ${err.lineUserId || 'N/A'}: ${err.error || 'Unknown error'}`);
                            });
                        }
                        
                        const failedLineUserIds = (result.errors || []).map(err => err.lineUserId).filter(Boolean);
                        chunk.forEach(r => {
                            if (!failedLineUserIds.includes(r.lineUserId)) {
                                successfulPaymentIds.add(r.metadata.paymentId);
                                chunkSuccessfulPaymentIds.push(r.metadata.paymentId);
                            }
                        });

                        console.log(`✅ LINE Chunk ${Math.floor(i/CHUNK_SIZE) + 1}: ${result.success}/${chunk.length} sent`);
                        
                        // ⭐ อัปเดต DB ทันทีเมื่อจบแต่ละ chunk ป้องกัน state loss ถ้าเกิด error ภายหลัง
                        if (chunkSuccessfulPaymentIds.length > 0) {
                            await Promise.all(chunkSuccessfulPaymentIds.map(id => 
                                base44.asServiceRole.entities.Payment.update(id, { 
                                    overdue_reminder_sent_date: now_iso,
                                    bill_sent_date: now_iso
                                }).catch(err => console.warn(`⚠️ Failed to update ${id}:`, err.message))
                            ));
                            console.log(`📝 Updated DB for ${chunkSuccessfulPaymentIds.length} LINE payments`);
                        }

                    } catch (lineError) {
                        console.error(`❌ LINE chunk ${Math.floor(i/CHUNK_SIZE) + 1} failed after retries:`, lineError);
                        sendErrors.push(`LINE batch error: ${lineError.message}`);
                    }
                    
                    if (i + CHUNK_SIZE < lineRecipientsCleaned.length) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }

            // --- 2. จัดการ Facebook ---
            if (facebookRecipients.length > 0 && !testLineUserId) {
                console.log(`📤 Sending Facebook in chunks of ${CHUNK_SIZE}...`);
                for (let i = 0; i < facebookRecipients.length; i += CHUNK_SIZE) {
                    const chunk = facebookRecipients.slice(i, i + CHUNK_SIZE);
                    const chunkSuccessfulPaymentIds = [];

                    try {
                        const fbResult = await base44.asServiceRole.functions.invoke('sendFacebookPaymentReminder', {
                            recipients: chunk
                        });

                        const result = fbResult.data;
                        sentCount += result.success || 0;
                        
                        if (result.errors) {
                            result.errors.forEach(err => {
                                sendErrors.push(`Facebook (Payment ${err.paymentId || 'N/A'}): ${err.error || 'Unknown error'}`);
                            });
                        }
                        
                        // ⭐ ดึง error จาก paymentId ตามที่ Facebook API ส่งกลับมา
                        const failedPaymentIds = (result.errors || []).map(err => err.paymentId).filter(Boolean);
                        chunk.forEach(r => {
                            if (!failedPaymentIds.includes(r.metadata.paymentId)) {
                                successfulPaymentIds.add(r.metadata.paymentId);
                                chunkSuccessfulPaymentIds.push(r.metadata.paymentId);
                            }
                        });

                        console.log(`✅ Facebook Chunk ${Math.floor(i/CHUNK_SIZE) + 1}: ${result.success}/${chunk.length} sent`);

                        // ⭐ อัปเดต DB ทันทีเมื่อจบแต่ละ chunk
                        if (chunkSuccessfulPaymentIds.length > 0) {
                            await Promise.all(chunkSuccessfulPaymentIds.map(id => 
                                base44.asServiceRole.entities.Payment.update(id, { 
                                    overdue_reminder_sent_date: now_iso,
                                    bill_sent_date: now_iso
                                }).catch(err => console.warn(`⚠️ Failed to update ${id}:`, err.message))
                            ));
                            console.log(`📝 Updated DB for ${chunkSuccessfulPaymentIds.length} FB payments`);
                        }

                    } catch (fbError) {
                        console.error(`❌ Facebook chunk ${Math.floor(i/CHUNK_SIZE) + 1} failed:`, fbError);
                        sendErrors.push(`Facebook batch error: ${fbError.message}`);
                    }
                    
                    if (i + CHUNK_SIZE < facebookRecipients.length) {
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }
        }

        const executionTime = Date.now() - startTime;

        // สร้างผลลัพธ์แยกตามสาขา
        const branchResults = [];
        const branchStats = {};

        recipients.forEach(r => {
            const branchId = r.metadata.branchId;
            if (!branchStats[branchId]) {
                branchStats[branchId] = { sent: 0, failed: 0, channel: r.metadata.channel };
            }
            branchStats[branchId].sent++;
        });

        sendErrors.forEach(err => {
            const match = err.match(/ห้อง\s+([^\s:]+)/);
            const roomMatch = match ? match[1] : null;
            if (roomMatch) {
                const recipient = recipients.find(r => r.metadata.roomNumber === roomMatch);
                if (recipient) {
                    const branchId = recipient.metadata.branchId;
                    if (!branchStats[branchId]) {
                        branchStats[branchId] = { sent: 0, failed: 0 };
                    }
                    branchStats[branchId].failed++;
                }
            }
        });

        const branches = await base44.asServiceRole.entities.Branch.list();
        Object.entries(branchStats).forEach(([branchId, stats]) => {
            const branch = branches.find(b => b.id === branchId);
            branchResults.push({
                branch_id: branchId,
                branch_name: branch?.branch_name || 'Unknown',
                status: stats.failed > 0 ? 'partial' : 'success',
                sent: stats.sent,
                failed: stats.failed,
                channel: stats.channel
            });
        });

        const responseResult = {
            success: true,
            message: testLineUserId 
                ? `🧪 ส่งข้อความทดสอบสำเร็จ (Test Mode)` 
                : `ส่งการแจ้งเตือนค้างชำระสำเร็จ ${sentCount}/${recipients.length} รายการ${totalRemaining > 0 ? ` | เหลืออีก ${totalRemaining} บิล` : ''}`,
            sent: sentCount,
            total: testLineUserId ? 1 : recipients.length,
            remaining: totalRemaining,
            hasMore: totalRemaining > 0,
            limit: limit,
            targetBranchId: targetBranchId || 'all',
            testMode: !!testLineUserId,
            enabledBranches: enabledBranches,
            skippedDueToDisabled: skippedCount,
            lateFeeCalculated: feeCalculated,
            lateFeeSkipped: feeSkipped,
            messageCreationDetails: messageCreationDetails,
            errors: sendErrors.length > 0 ? sendErrors : undefined,
            lineCount: lineRecipients.length,
            facebookCount: facebookRecipients.length
        };

        console.log('\n⏱️ ========== EXECUTION TIME ==========');
        console.log(`   ⏱️ Function executed in: ${executionTime}ms (${(executionTime / 1000).toFixed(2)} seconds)`);
        console.log('========================================\n');
        
        console.log('🎉 Automated overdue reminder completed:', responseResult);

        // บันทึก FunctionLog - หลีกเลี่ยง rate limit
        try {
            await new Promise(r => setTimeout(r, 1000)); // รอ 1 วิก่อนเขียน log
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'sendAutomatedOverdueReminders',
                run_timestamp: getThailandTimestamp(),
                status: sendErrors.length > 0 && sentCount === 0 ? 'error' : 'success',
                message: responseResult.message,
                execution_time_ms: executionTime,
                total_sent: sentCount,
                total_failed: sendErrors.length,
                branch_results: branchResults,
                triggered_by: 'cron',
                details: responseResult
            });
        } catch (logError) {
            console.error('Failed to create FunctionLog:', logError);
        }

        return Response.json(responseResult);

    } catch (error) {
        console.error('❌ Error in sendAutomatedOverdueReminders:', error);
        console.error('📍 Error stack:', error.stack);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack,
            details: String(error)
        }, { status: 500 });
    }
});