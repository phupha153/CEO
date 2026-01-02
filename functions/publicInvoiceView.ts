import { createClient } from 'npm:@base44/sdk@0.8.6';

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

function formatThaiDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  const day = date.getDate();
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 
                  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  const month = months[date.getMonth()];
  const year = date.getFullYear() + 543;
  return `${day} ${month} ${year}`;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const paymentId = url.searchParams.get('paymentId') || url.searchParams.get('id');

    if (!paymentId) {
      return new Response(
        '<html><body><h1>ไม่พบเลขที่ใบแจ้งหนี้</h1><p>กรุณาระบุ paymentId ใน URL</p></body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 400 }
      );
    }

    // ⭐ ใช้ Service Role โดยตรง - ไม่ต้อง authenticate
    const base44 = createClient(
      Deno.env.get('BASE44_APP_ID'),
      { serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY') }
    );

    // ดึงข้อมูลจาก function ที่มีอยู่
    const invoiceResult = await base44.functions.invoke('getPublicInvoice', { paymentId });
    
    if (!invoiceResult.success || !invoiceResult.invoice) {
      return new Response(
        `<html><body><h1>ไม่พบข้อมูลใบแจ้งหนี้</h1><p>${invoiceResult.error || 'กรุณาตรวจสอบ Payment ID'}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 404 }
      );
    }

    const invoice = invoiceResult.invoice;
    const invoiceNumber = `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
    const dueDate = formatThaiDate(invoice.due_date);
    const paymentDate = invoice.payment_date ? formatThaiDate(invoice.payment_date) : null;
    const isPaid = invoice.status === 'paid';
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const dueDateObj = invoice.due_date ? new Date(invoice.due_date) : null;
    const isOverdue = !isPaid && dueDateObj && now > dueDateObj;
    const daysOverdue = isOverdue ? Math.floor((now - dueDateObj) / (1000 * 60 * 60 * 24)) : 0;

    const buildingLogo = invoice?.recipient?.building_logo || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
    const buildingName = invoice?.recipient?.building_name || 'W RESIDENTS';

    // สร้าง line items
    const lineItems = [];
    if (invoice.rent_amount > 0) {
      lineItems.push({ name: 'ค่าเช่า', quantity: 1, price: invoice.rent_amount, total: invoice.rent_amount });
    }
    if (invoice.electricity_amount > 0) {
      const calculatedElec = invoice.electricity_units * invoice.electricity_rate;
      const isElecMin = invoice.electricity_units === 0 || Math.abs(calculatedElec - invoice.electricity_amount) > 0.01;
      const elecMeter = (invoice.electricity_previous || invoice.electricity_current) 
        ? ` (${invoice.electricity_previous}-${invoice.electricity_current})` 
        : '';
      const elecName = isElecMin 
        ? `ค่าไฟฟ้า${elecMeter} ใช้ ${invoice.electricity_units} หน่วย - คิดขั้นต่ำ`
        : `ค่าไฟฟ้า${elecMeter} ${invoice.electricity_units} หน่วย × ${invoice.electricity_rate} บาท`;
      lineItems.push({ name: elecName, quantity: 1, price: invoice.electricity_amount, total: invoice.electricity_amount });
    }
    if (invoice.water_amount > 0) {
      const calculatedWater = invoice.water_units * invoice.water_rate;
      const isWaterMin = invoice.water_units === 0 || Math.abs(calculatedWater - invoice.water_amount) > 0.01;
      const waterMeter = (invoice.water_previous || invoice.water_current) 
        ? ` (${invoice.water_previous}-${invoice.water_current})` 
        : '';
      const waterName = isWaterMin 
        ? `ค่าน้ำประปา${waterMeter} ใช้ ${invoice.water_units} หน่วย - คิดขั้นต่ำ`
        : `ค่าน้ำประปา${waterMeter} ${invoice.water_units} หน่วย × ${invoice.water_rate} บาท`;
      lineItems.push({ name: waterName, quantity: 1, price: invoice.water_amount, total: invoice.water_amount });
    }
    if (invoice.internet_amount > 0) {
      lineItems.push({ name: 'ค่าอินเทอร์เน็ต', quantity: 1, price: invoice.internet_amount, total: invoice.internet_amount });
    }
    if (invoice.common_fee_amount > 0) {
      lineItems.push({ name: 'ค่าส่วนกลาง', quantity: 1, price: invoice.common_fee_amount, total: invoice.common_fee_amount });
    }
    if (invoice.parking_fee_amount > 0) {
      lineItems.push({ name: 'ค่าที่จอดรถ', quantity: 1, price: invoice.parking_fee_amount, total: invoice.parking_fee_amount });
    }
    if (invoice.other_amount > 0) {
      lineItems.push({ name: 'ค่าใช้จ่ายอื่นๆ', quantity: 1, price: invoice.other_amount, total: invoice.other_amount });
    }
    if (invoice.late_fee_amount && invoice.late_fee_amount > 0) {
      lineItems.push({ name: 'ค่าปรับชำระล่าช้า', quantity: 1, price: invoice.late_fee_amount, total: invoice.late_fee_amount });
    }

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบแจ้งหนี้ - ${invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Sarabun', 'TH Sarabun New', Arial, sans-serif; background: #f1f5f9; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0; }
    .logo-section { display: flex; align-items: center; gap: 12px; }
    .logo { width: 50px; height: 50px; object-fit: contain; }
    h1 { font-size: 20px; color: #1e293b; }
    h2 { font-size: 20px; color: #f97316; margin: 0; }
    .subtitle { font-size: 12px; color: #f97316; }
    .company-info { font-size: 11px; color: #64748b; margin-top: 10px; line-height: 1.5; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; padding: 15px; background: #f8fafc; border-radius: 8px; }
    .info-box { border: 1px solid #e2e8f0; padding: 12px; border-radius: 6px; background: white; }
    .info-label { font-size: 11px; color: #64748b; margin-bottom: 5px; }
    .info-value { font-size: 14px; font-weight: bold; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    thead { background: #f1f5f9; }
    th { padding: 12px 8px; text-align: left; font-size: 13px; font-weight: bold; color: #475569; border-bottom: 2px solid #cbd5e1; }
    td { padding: 10px 8px; font-size: 12px; color: #334155; border-bottom: 1px solid #e2e8f0; }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .total-section { display: flex; justify-content: space-between; align-items: center; margin: 20px 0; padding-top: 15px; border-top: 2px solid #cbd5e1; }
    .total-label { font-size: 13px; color: #475569; }
    .total-amount { font-size: 20px; font-weight: bold; color: #1e293b; }
    .stamp { border: 2px solid; padding: 8px 12px; border-radius: 4px; text-align: center; transform: rotate(-3deg); display: inline-block; }
    .stamp-paid { border-color: #16a34a; color: #16a34a; }
    .stamp-overdue { border-color: #dc2626; color: #dc2626; }
    .stamp-pending { border-color: #f97316; color: #f97316; }
    .stamp-title { font-size: 12px; font-weight: bold; }
    .stamp-date { font-size: 9px; margin-top: 2px; }
    .payment-info { font-size: 11px; color: #64748b; margin: 15px 0; }
    .signature-section { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .signature-box { text-align: center; }
    .signature-line { height: 60px; border-bottom: 1px solid #cbd5e1; margin-bottom: 8px; }
    .signature-label { font-size: 11px; color: #64748b; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; }
    .btn-print { position: fixed; top: 20px; right: 20px; background: #2563eb; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .btn-print:hover { background: #1d4ed8; }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; padding: 20px; }
      .btn-print { display: none; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <button class="btn-print" onclick="window.print()">🖨️ พิมพ์</button>
  
  <div class="container">
    <div class="header">
      <div class="logo-section">
        <img src="${buildingLogo}" alt="Logo" class="logo" onerror="this.src='https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg'">
        <h1>${buildingName}</h1>
      </div>
      <div style="text-align: right;">
        <h2>ใบแจ้งหนี้</h2>
        <div class="subtitle">Invoice</div>
      </div>
    </div>

    <div class="company-info">
      ${invoice.recipient?.company_name ? `
        <p style="font-weight: 600; color: #1e293b;">${invoice.recipient.company_name}</p>
        ${invoice.recipient.tax_id ? `<p>เลขที่ผู้เสียภาษี: ${invoice.recipient.tax_id}</p>` : ''}
        ${invoice.recipient.company_registration_number ? `<p>เลขทะเบียนนิติบุคคล: ${invoice.recipient.company_registration_number}</p>` : ''}
        <p>${invoice.recipient?.company_address || invoice.recipient?.building_address || ''}</p>
      ` : invoice.recipient?.lessor_name ? `
        <p style="font-weight: 600; color: #1e293b;">${invoice.recipient.lessor_name}</p>
        <p>${invoice.recipient?.lessor_address || invoice.recipient?.building_address || ''}</p>
      ` : invoice.recipient?.building_address ? `
        <p>${invoice.recipient.building_address}</p>
      ` : ''}
      ${invoice.recipient?.building_phone ? `<p>โทร: ${invoice.recipient.building_phone}</p>` : ''}
    </div>

    <div class="info-grid">
      <div>
        <div class="info-label">เลขที่ใบแจ้งหนี้</div>
        <div class="info-value">${invoiceNumber}</div>
      </div>
      <div style="text-align: right;">
        <div class="info-label">วันครบกำหนด</div>
        <div class="info-value">${dueDate}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3 style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px;">ผู้รับเงิน</h3>
        <p style="font-weight: 500; color: #1e293b; font-size: 12px;">${invoice.bank?.account_name || invoice.recipient?.lessor_name || invoice.recipient?.building_name || ''}</p>
        <p style="font-size: 11px; color: #64748b;">${invoice.recipient?.lessor_address || invoice.recipient?.building_address || ''}</p>
      </div>
      <div class="info-box">
        <h3 style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px;">ผู้จ่ายเงิน</h3>
        <p style="font-weight: 500; color: #1e293b; font-size: 12px;">${invoice.tenant?.full_name || 'ไม่ระบุ'}</p>
        <p style="font-size: 11px; color: #64748b;">ห้อง: ${invoice.room?.room_number || 'N/A'} | โทร: ${invoice.tenant?.phone || 'ไม่ระบุ'}</p>
        <p style="font-size: 11px; color: #64748b;">ที่อยู่: ${invoice.tenant?.address && invoice.tenant.address !== 'ไม่ระบุ' && invoice.tenant.address !== '-' ? invoice.tenant.address : 'ไม่ระบุ'}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 50px;">ลำดับ</th>
          <th>รายการ</th>
          <th class="text-center" style="width: 80px;">จำนวน</th>
          <th class="text-right" style="width: 120px;">ราคา/หน่วย</th>
          <th class="text-right" style="width: 120px;">จำนวนเงิน</th>
        </tr>
      </thead>
      <tbody>
        ${lineItems.map((item, index) => `
          <tr>
            <td class="text-center">${index + 1}</td>
            <td>${item.name}</td>
            <td class="text-center">${item.quantity}</td>
            <td class="text-right">${item.price.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
            <td class="text-right" style="font-weight: bold;">${item.total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="total-section">
      <div>
        <span class="total-label">ยอดเงินสุทธิ </span>
        <span style="font-size: 12px; color: #64748b;">(${numberToThaiText(invoice.total_amount || 0)})</span>
      </div>
      <div style="display: flex; align-items: center; gap: 15px;">
        <span class="total-amount">${(invoice.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
        ${isPaid ? `
          <div class="stamp stamp-paid">
            <div class="stamp-title">✓ ชำระแล้ว</div>
            <div class="stamp-date">${paymentDate}</div>
          </div>
        ` : isOverdue ? `
          <div class="stamp stamp-overdue">
            <div class="stamp-title">⚠️ เกินกำหนด</div>
            <div class="stamp-date">${daysOverdue} วัน</div>
          </div>
        ` : `
          <div class="stamp stamp-pending">
            <div class="stamp-title">⏰ รอชำระ</div>
            <div class="stamp-date">ครบกำหนด: ${dueDate}</div>
          </div>
        `}
      </div>
    </div>

    <div class="payment-info">
      <strong>ชำระผ่าน:</strong> ${invoice.bank?.name || ''} | ${invoice.bank?.account_number || ''} 
      • ${isPaid ? `ชำระเงินเรียบร้อยเมื่อ ${paymentDate}` : 'กรุณาชำระเงินภายในวันที่กำหนด'}
    </div>

    <div class="signature-section">
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">ผู้จัดทำ</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">ผู้อนุมัติ</div>
      </div>
      <div class="signature-box">
        <div class="signature-line"></div>
        <div class="signature-label">ผู้รับเงิน</div>
      </div>
    </div>

    <div class="footer">
      ขอบคุณที่ใช้บริการ ${invoice.recipient?.building_name || buildingName}
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('Error in publicInvoiceView:', error);
    return new Response(
      `<html><body><h1>เกิดข้อผิดพลาด</h1><p>${error.message}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 500 }
    );
  }
});