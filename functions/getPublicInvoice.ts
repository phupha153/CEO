import { createClient } from 'npm:@base44/sdk@0.8.4';

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

// Public API สำหรับดึงใบแจ้งหนี้/ใบเสร็จแบบ HTML (ไม่ต้อง login)
Deno.serve(async (req) => {
    console.log('========================================');
    console.log('📄 GET PUBLIC INVOICE/RECEIPT (HTML MODE)');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('========================================');

    try {
        // ⭐ ใช้ Service Role โดยตรง (ไม่ต้อง auth)
        const base44 = createClient({
            appId: Deno.env.get('BASE44_APP_ID'),
            serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
        });
        
        // Parse URL parameters
        const url = new URL(req.url);
        const paymentId = url.searchParams.get('id');
        const type = url.searchParams.get('type') || 'invoice'; // 'invoice' or 'receipt'

        console.log(`📋 Payment ID: ${paymentId}, Type: ${type}`);

        if (!paymentId) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบรหัสใบแจ้งหนี้' 
            }, { status: 400 });
        }

        // ดึงข้อมูล Payment โดยตรงด้วย filter
        console.log('📥 Querying Database for Payment...');
        const paymentResults = await base44.entities.Payment.filter({ id: paymentId });
        
        console.log(`📊 Query Results: Found ${Array.isArray(paymentResults) ? paymentResults.length : (paymentResults ? 1 : 0)} payment(s)`);
        
        if (Array.isArray(paymentResults) && paymentResults.length > 1) {
            console.error(`⚠️ DUPLICATE PAYMENT IDS FOUND: ${paymentResults.length} records with same ID`);
            paymentResults.forEach((p, idx) => {
                console.log(`  [${idx}] room_id: ${p.room_id}, tenant_id: ${p.tenant_id}, total: ${p.total_amount}`);
            });
        }
        
        const payment = Array.isArray(paymentResults) ? paymentResults[0] : paymentResults;

        if (!payment) {
            console.error('❌ Payment not found in Database');
            return Response.json({ 
                success: false, 
                error: 'ไม่พบใบแจ้งหนี้' 
            }, { status: 404 });
        }

        // ⭐ LOG: ดูข้อมูลดิบจาก Database ว่ามีค่าปรับหรือไม่
        console.log('🔍 [DEBUG] Raw DB Data:');
        console.log(`   - ID: ${payment.id}`);
        console.log(`   - Status: ${payment.status}`);
        console.log(`   - Total Amount: ${payment.total_amount}`);
        console.log(`   - Late Fee Amount: ${payment.late_fee_amount} (Type: ${typeof payment.late_fee_amount})`);

        // ตรวจสอบ branch_id ถ้ามีการส่งมา
        if (branchId && payment.branch_id !== branchId) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบใบแจ้งหนี้ในสาขานี้' 
            }, { status: 404 });
        }

        const actualBranchId = payment.branch_id;

        // ดึงข้อมูลที่เกี่ยวข้อง - ดึงเฉพาะสาขาเพื่อความแม่นยำ
        console.log(`🔍 Looking for room_id: ${payment.room_id}, tenant_id: ${payment.tenant_id}, branch_id: ${actualBranchId}`);
        
        const [allTenants, allRooms, allBranches, configs] = await Promise.all([
            base44.entities.Tenant.filter({ branch_id: actualBranchId }, '-created_date', 5000),
            base44.entities.Room.filter({ branch_id: actualBranchId }, '-created_date', 5000),
            base44.entities.Branch.list(),
            base44.entities.Config.list()
        ]);

        const tenant = payment.tenant_id ? allTenants.find(t => t.id === payment.tenant_id) : null;
        const room = payment.room_id ? allRooms.find(r => r.id === payment.room_id) : null;
        const branch = actualBranchId ? allBranches.find(b => b.id === actualBranchId) : null;

        console.log(`📋 Found: room=${room?.room_number || 'NOT FOUND'}, tenant=${tenant?.full_name || 'NOT FOUND'}, branch=${branch?.branch_name || 'NOT FOUND'}`);
        
        // ⚠️ ตรวจสอบว่าข้อมูลครบถ้วนหรือไม่
        if (!room) {
            console.error(`❌ CRITICAL: Room not found for room_id: ${payment.room_id}`);
            return Response.json({ 
                success: false, 
                error: `ไม่พบข้อมูลห้อง (room_id: ${payment.room_id})` 
            }, { status: 500 });
        }
        
        if (!tenant) {
            console.error(`❌ CRITICAL: Tenant not found for tenant_id: ${payment.tenant_id}`);
            return Response.json({ 
                success: false, 
                error: `ไม่พบข้อมูลผู้เช่า (tenant_id: ${payment.tenant_id})` 
            }, { status: 500 });
        }
        
        if (!branch) {
            console.error(`❌ CRITICAL: Branch not found for branch_id: ${actualBranchId}`);
            return Response.json({ 
                success: false, 
                error: `ไม่พบข้อมูลสาขา (branch_id: ${actualBranchId})` 
            }, { status: 500 });
        }

        // ดึง config ของสาขา
        const getConfigValue = (key) => {
            const branchConfig = configs.find(c => c.key === key && c.branch_id === actualBranchId);
            if (branchConfig) return branchConfig.value;
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || null;
        };

        const configData = {
            building_name: getConfigValue('building_name'),
            building_logo: getConfigValue('building_logo'),
            promptpay: getConfigValue('promptpay'),
            promptpay_qr_url: getConfigValue('promptpay_qr_url'),
            bank_name: getConfigValue('bank_name'),
            bank_account_number: getConfigValue('bank_account_number'),
            bank_account_name: getConfigValue('bank_account_name'),
            contact_phone: getConfigValue('contact_phone')
        };

        console.log('✅ Invoice data fetched successfully');

        // สร้าง line items
        const lineItems = [];
        if (payment.rent_amount > 0) {
            lineItems.push({ name: 'ค่าเช่า', qty: 1, price: payment.rent_amount, total: payment.rent_amount });
        }
        if (payment.electricity_amount > 0) {
            const calcElec = payment.electricity_units * payment.electricity_rate;
            const isMin = payment.electricity_units === 0 || Math.abs(calcElec - payment.electricity_amount) > 0.01;
            const meterTxt = (payment.electricity_previous || payment.electricity_current) 
                ? ` (${payment.electricity_previous}-${payment.electricity_current})` : '';
            const name = isMin 
                ? `ค่าไฟฟ้า${meterTxt} ใช้ ${payment.electricity_units} หน่วย - คิดขั้นต่ำ`
                : `ค่าไฟฟ้า${meterTxt} ${payment.electricity_units} หน่วย × ${payment.electricity_rate} บาท`;
            lineItems.push({ name, qty: 1, price: payment.electricity_amount, total: payment.electricity_amount });
        }
        if (payment.water_amount > 0) {
            const calcWater = payment.water_units * payment.water_rate;
            const isMin = payment.water_units === 0 || Math.abs(calcWater - payment.water_amount) > 0.01;
            const meterTxt = (payment.water_previous || payment.water_current) 
                ? ` (${payment.water_previous}-${payment.water_current})` : '';
            const name = isMin 
                ? `ค่าน้ำประปา${meterTxt} ใช้ ${payment.water_units} หน่วย - คิดขั้นต่ำ`
                : `ค่าน้ำประปา${meterTxt} ${payment.water_units} หน่วย × ${payment.water_rate} บาท`;
            lineItems.push({ name, qty: 1, price: payment.water_amount, total: payment.water_amount });
        }
        if (payment.internet_amount > 0) {
            lineItems.push({ name: 'ค่าอินเทอร์เน็ต', qty: 1, price: payment.internet_amount, total: payment.internet_amount });
        }
        if (payment.common_fee_amount > 0) {
            lineItems.push({ name: 'ค่าส่วนกลาง', qty: 1, price: payment.common_fee_amount, total: payment.common_fee_amount });
        }
        if (payment.parking_fee_amount > 0) {
            lineItems.push({ name: 'ค่าที่จอดรถ', qty: 1, price: payment.parking_fee_amount, total: payment.parking_fee_amount });
        }
        if (payment.other_amount > 0) {
            lineItems.push({ name: 'ค่าใช้จ่ายอื่นๆ', qty: 1, price: payment.other_amount, total: payment.other_amount });
        }
        if (payment.late_fee_amount && payment.late_fee_amount > 0) {
            lineItems.push({ name: 'ค่าปรับชำระล่าช้า', qty: 1, price: payment.late_fee_amount, total: payment.late_fee_amount });
        }

        // ฟอร์แมตวันที่
        const formatDate = (dateStr) => {
            if (!dateStr) return '-';
            const d = new Date(dateStr);
            return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });
        };

        const dueDate = formatDate(payment.due_date);
        const paymentDate = payment.payment_date ? formatDate(payment.payment_date) : formatDate(new Date());
        const invoiceDate = formatDate(payment.created_date || new Date());

        // เช็คสถานะ
        const isPaid = payment.status === 'paid';
        const now = new Date();
        const dueDateObj = payment.due_date ? new Date(payment.due_date) : null;
        const isOverdue = dueDateObj && now > dueDateObj && !isPaid;

        const buildingLogo = configData.building_logo || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
        const buildingName = configData.building_name || branch?.branch_name || 'W RESIDENTS';
        
        const docNumber = type === 'receipt' 
            ? `REC-${payment.id.slice(0, 8).toUpperCase()}`
            : `INV-${payment.id.slice(0, 8).toUpperCase()}`;

        // สร้าง HTML
        const html = `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${type === 'receipt' ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'} - ${buildingName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Sarabun', 'Tahoma', sans-serif; background: #f8fafc; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; background: white; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { padding: 20px; border-bottom: 2px solid #e2e8f0; display: flex; justify-content: space-between; align-items: start; }
        .logo-section { display: flex; align-items: center; gap: 12px; }
        .logo-section img { width: 50px; height: 50px; object-fit: contain; }
        .logo-section h1 { font-size: 20px; font-weight: bold; color: #1e293b; }
        .doc-type { text-align: right; }
        .doc-type h2 { font-size: 20px; font-weight: bold; color: ${type === 'receipt' ? '#059669' : '#2563eb'}; }
        .doc-type p { font-size: 12px; color: ${type === 'receipt' ? '#059669' : '#2563eb'}; }
        .company-info { padding: 0 20px; font-size: 11px; color: #64748b; line-height: 1.5; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; padding: 20px; background: #f8fafc; }
        .info-box { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
        .info-box h3 { font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px; }
        .info-box p { font-size: 11px; color: #64748b; line-height: 1.6; }
        .info-box .highlight { font-weight: 600; color: #1e293b; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        thead { background: #f1f5f9; }
        th { padding: 12px 8px; text-align: left; font-size: 12px; font-weight: bold; color: #475569; border-bottom: 2px solid #cbd5e1; }
        th.center { text-align: center; }
        th.right { text-align: right; }
        td { padding: 10px 8px; font-size: 11px; color: #1e293b; border-bottom: 1px solid #e2e8f0; }
        td.center { text-align: center; }
        td.right { text-align: right; font-weight: 600; }
        .total-section { padding: 20px; border-top: 2px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; }
        .total-text { font-size: 13px; color: #64748b; }
        .total-amount { font-size: 24px; font-weight: bold; color: #1e293b; }
        .stamp { border: 2px solid ${isPaid ? '#059669' : isOverdue ? '#dc2626' : '#f59e0b'}; 
                 border-radius: 8px; padding: 8px 16px; text-align: center; 
                 transform: rotate(-3deg); }
        .stamp p:first-child { font-size: 13px; font-weight: bold; 
                                color: ${isPaid ? '#059669' : isOverdue ? '#dc2626' : '#f59e0b'}; }
        .stamp p:last-child { font-size: 10px; 
                              color: ${isPaid ? '#059669' : isOverdue ? '#dc2626' : '#f59e0b'}; }
        .footer { padding: 20px; font-size: 11px; color: #64748b; text-align: center; 
                  border-top: 1px solid #e2e8f0; }
        .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; 
                      padding: 20px; margin-top: 20px; border-top: 1px solid #e2e8f0; }
        .sig-box { text-align: center; }
        .sig-line { height: 50px; border-bottom: 1px solid #cbd5e1; margin-bottom: 8px; }
        .sig-label { font-size: 11px; color: #64748b; }
        .no-print { padding: 20px; text-align: center; }
        .print-btn { background: #2563eb; color: white; border: none; padding: 12px 24px; 
                     border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; }
        .print-btn:hover { background: #1d4ed8; }
        
        @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; max-width: 100%; }
            .no-print { display: none; }
            @page { size: A4; margin: 10mm; }
        }
    </style>
</head>
<body>
    <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button>
    </div>
    
    <div class="container">
        <div class="header">
            <div class="logo-section">
                <img src="${buildingLogo}" alt="Logo" onerror="this.src='https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg'">
                <h1>${buildingName}</h1>
            </div>
            <div class="doc-type">
                <h2>${type === 'receipt' ? 'ใบเสร็จรับเงิน' : 'ใบแจ้งหนี้'}</h2>
                <p>${type === 'receipt' ? 'Receipt' : 'Invoice'}</p>
            </div>
        </div>

        <div class="company-info">
            ${getConfigValue('company_name') ? `
                <p><strong>${getConfigValue('company_name')}</strong></p>
                ${getConfigValue('company_tax_id') ? `<p>เลขที่ผู้เสียภาษี: ${getConfigValue('company_tax_id')}</p>` : ''}
                ${getConfigValue('company_registration_number') ? `<p>เลขทะเบียนนิติบุคคล: ${getConfigValue('company_registration_number')}</p>` : ''}
                <p>${getConfigValue('company_address') || branch?.address || ''}</p>
            ` : getConfigValue('lessor_name') ? `
                <p><strong>${getConfigValue('lessor_name')}</strong></p>
                <p>${getConfigValue('lessor_address') || branch?.address || ''}</p>
            ` : `
                <p>${branch?.address || ''}</p>
            `}
            ${configData.contact_phone || branch?.phone ? `<p>โทร: ${configData.contact_phone || branch?.phone}</p>` : ''}
        </div>

        <div style="padding: 20px; background: #f8fafc; display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div>
                <p style="font-size: 11px; color: #64748b; margin-bottom: 4px;">เลขที่เอกสาร</p>
                <p style="font-weight: bold; color: #1e293b;">${docNumber}</p>
            </div>
            <div style="text-align: right;">
                <p style="font-size: 11px; color: #64748b; margin-bottom: 4px;">${type === 'receipt' ? 'วันที่ออก' : 'วันที่สร้าง'}</p>
                <p style="font-weight: bold; color: #1e293b;">${type === 'receipt' ? paymentDate : invoiceDate}</p>
            </div>
        </div>

        <div class="info-grid">
            <div class="info-box">
                <h3>${type === 'receipt' ? 'ผู้รับเงิน' : 'ผู้ออกเอกสาร'}</h3>
                <p class="highlight">${configData.bank_account_name || getConfigValue('lessor_name') || buildingName}</p>
                <p>${getConfigValue('lessor_address') || branch?.address || ''}</p>
            </div>
            <div class="info-box">
                <h3>${type === 'receipt' ? 'ผู้จ่ายเงิน' : 'ลูกค้า'}</h3>
                <p class="highlight">${tenant?.full_name || 'ไม่ระบุ'}</p>
                <p>ห้อง: ${room?.room_number || 'N/A'} | โทร: ${tenant?.phone || 'ไม่ระบุ'}</p>
                <p>ที่อยู่: ${tenant?.address && tenant.address !== 'ไม่ระบุ' && tenant.address !== '-' ? tenant.address : 'ไม่ระบุ'}</p>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th style="width: 50px;">ลำดับ</th>
                    <th>รายการ</th>
                    <th class="center" style="width: 80px;">จำนวน</th>
                    <th class="right" style="width: 120px;">ราคา/หน่วย</th>
                    <th class="right" style="width: 120px;">จำนวนเงิน</th>
                </tr>
            </thead>
            <tbody>
                ${lineItems.map((item, idx) => `
                    <tr>
                        <td class="center">${idx + 1}</td>
                        <td>${item.name}</td>
                        <td class="center">${item.qty}</td>
                        <td class="right">${(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                        <td class="right">${(item.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <div class="total-section">
            <div class="total-text">
                <strong>ยอดเงินสุทธิ</strong>
                <span style="margin-left: 8px;">(${numberToThaiText(payment.total_amount || 0)})</span>
            </div>
            <div style="display: flex; align-items: center; gap: 16px;">
                <div class="total-amount">${(payment.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท</div>
                ${type === 'receipt' || isPaid ? `
                    <div class="stamp">
                        <p>✓ ชำระแล้ว</p>
                        <p>${paymentDate}</p>
                    </div>
                ` : isOverdue ? `
                    <div class="stamp">
                        <p>⚠ เกินกำหนด</p>
                        <p>${dueDate}</p>
                    </div>
                ` : `
                    <div class="stamp">
                        <p>รอชำระ</p>
                        <p>ครบ: ${dueDate}</p>
                    </div>
                `}
            </div>
        </div>

        ${type !== 'receipt' ? `
            <div style="padding: 20px; font-size: 11px; color: #64748b; background: #fef3c7; border-left: 4px solid #f59e0b;">
                <strong style="color: #92400e;">ช่องทางชำระเงิน:</strong><br>
                ${configData.bank_name ? `${configData.bank_name} | ${configData.bank_account_number || ''} | ${configData.bank_account_name || ''}` : 'ดูรายละเอียดในแอป'}
            </div>
        ` : `
            <div style="padding: 20px; font-size: 11px; color: #64748b;">
                <strong>ชำระผ่าน:</strong> ${configData.bank_name || 'ไม่ระบุ'} | ${configData.bank_account_number || ''} • ใบเสร็จนี้ออกให้เป็นหลักฐานการรับเงินเรียบร้อยแล้ว
            </div>
        `}

        <div class="signatures">
            <div class="sig-box"><div class="sig-line"></div><p class="sig-label">ผู้จัดทำ</p></div>
            <div class="sig-box"><div class="sig-line"></div><p class="sig-label">ผู้อนุมัติ</p></div>
            <div class="sig-box"><div class="sig-line"></div><p class="sig-label">${type === 'receipt' ? 'ผู้รับเงิน' : 'ผู้ออกเอกสาร'}</p></div>
        </div>

        <div class="footer">
            <p>ขอบคุณที่ใช้บริการ ${buildingName}</p>
        </div>
    </div>

    <div class="no-print" style="margin-top: 20px; text-align: center;">
        <button class="print-btn" onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button>
    </div>
</body>
</html>`;

        console.log('✅ Generated HTML successfully');
        
        return new Response(html, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return new Response(`
            <html>
            <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                <h2>⚠️ เกิดข้อผิดพลาด</h2>
                <p>${error.message}</p>
            </body>
            </html>
        `, {
            status: 500,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
});