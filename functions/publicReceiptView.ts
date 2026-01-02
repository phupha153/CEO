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
        '<html><body><h1>ไม่พบเลขที่ใบเสร็จ</h1><p>กรุณาระบุ paymentId ใน URL</p></body></html>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 400 }
      );
    }

    const base44 = createClientFromRequest(req);

    // ดึงข้อมูลจาก function ที่มีอยู่
    const invoiceResult = await base44.asServiceRole.functions.invoke('getPublicInvoice', { paymentId });
    
    if (!invoiceResult.success || !invoiceResult.invoice) {
      return new Response(
        `<html><body><h1>ไม่พบข้อมูลใบเสร็จ</h1><p>${invoiceResult.error || 'กรุณาตรวจสอบ Payment ID'}</p></body></html>`,
        { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 404 }
      );
    }

    const receipt = invoiceResult.invoice;
    const receiptNumber = `REC-${receipt.id.slice(0, 8).toUpperCase()}`;
    const paymentDate = receipt.payment_date ? formatThaiDate(receipt.payment_date) : formatThaiDate(new Date());

    const buildingLogo = receipt?.recipient?.building_logo || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
    const buildingName = receipt?.recipient?.building_name || 'W RESIDENTS';

    // สร้าง line items
    const lineItems = [];
    if (receipt.rent_amount > 0) {
      lineItems.push({ name: 'ค่าเช่า', quantity: 1, price: receipt.rent_amount, total: receipt.rent_amount });
    }
    if (receipt.electricity_amount > 0) {
      const calculatedElec = receipt.electricity_units * receipt.electricity_rate;
      const isElecMin = receipt.electricity_units === 0 || Math.abs(calculatedElec - receipt.electricity_amount) > 0.01;
      const elecMeter = (receipt.electricity_previous || receipt.electricity_current) 
        ? ` (${receipt.electricity_previous}-${receipt.electricity_current})` 
        : '';
      const elecName = isElecMin 
        ? `ค่าไฟฟ้า${elecMeter} ใช้ ${receipt.electricity_units} หน่วย - คิดขั้นต่ำ`
        : `ค่าไฟฟ้า${elecMeter} ${receipt.electricity_units} หน่วย × ${receipt.electricity_rate} บาท`;
      lineItems.push({ name: elecName, quantity: 1, price: receipt.electricity_amount, total: receipt.electricity_amount });
    }
    if (receipt.water_amount > 0) {
      const calculatedWater = receipt.water_units * receipt.water_rate;
      const isWaterMin = receipt.water_units === 0 || Math.abs(calculatedWater - receipt.water_amount) > 0.01;
      const waterMeter = (receipt.water_previous || receipt.water_current) 
        ? ` (${receipt.water_previous}-${receipt.water_current})` 
        : '';
      const waterName = isWaterMin 
        ? `ค่าน้ำประปา${waterMeter} ใช้ ${receipt.water_units} หน่วย - คิดขั้นต่ำ`
        : `ค่าน้ำประปา${waterMeter} ${receipt.water_units} หน่วย × ${receipt.water_rate} บาท`;
      lineItems.push({ name: waterName, quantity: 1, price: receipt.water_amount, total: receipt.water_amount });
    }
    if (receipt.internet_amount > 0) {
      lineItems.push({ name: 'ค่าอินเทอร์เน็ต', quantity: 1, price: receipt.internet_amount, total: receipt.internet_amount });
    }
    if (receipt.common_fee_amount > 0) {
      lineItems.push({ name: 'ค่าส่วนกลาง', quantity: 1, price: receipt.common_fee_amount, total: receipt.common_fee_amount });
    }
    if (receipt.parking_fee_amount > 0) {
      lineItems.push({ name: 'ค่าที่จอดรถ', quantity: 1, price: receipt.parking_fee_amount, total: receipt.parking_fee_amount });
    }
    if (receipt.other_amount > 0) {
      lineItems.push({ name: 'ค่าใช้จ่ายอื่นๆ', quantity: 1, price: receipt.other_amount, total: receipt.other_amount });
    }
    if (receipt.late_fee_amount && receipt.late_fee_amount > 0) {
      lineItems.push({ name: 'ค่าปรับชำระล่าช้า', quantity: 1, price: receipt.late_fee_amount, total: receipt.late_fee_amount });
    }

    const html = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ใบเสร็จรับเงิน - ${receiptNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Sarabun', 'TH Sarabun New', Arial, sans-serif; background: #f1f5f9; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 2px solid #e2e8f0; }
    .logo-section { display: flex; align-items: center; gap: 12px; }
    .logo { width: 50px; height: 50px; object-fit: contain; }
    h1 { font-size: 20px; color: #1e293b; }
    h2 { font-size: 20px; color: #16a34a; margin: 0; }
    .subtitle { font-size: 12px; color: #16a34a; }
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
    .stamp { border: 2px solid #16a34a; color: #16a34a; padding: 8px 12px; border-radius: 4px; text-align: center; transform: rotate(-3deg); display: inline-block; }
    .stamp-title { font-size: 12px; font-weight: bold; }
    .stamp-date { font-size: 9px; margin-top: 2px; }
    .payment-info { font-size: 11px; color: #64748b; margin: 15px 0; }
    .signature-section { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
    .signature-box { text-align: center; }
    .signature-line { height: 60px; border-bottom: 1px solid #cbd5e1; margin-bottom: 8px; }
    .signature-label { font-size: 11px; color: #64748b; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; }
    .btn-print { position: fixed; top: 20px; right: 20px; background: #16a34a; color: white; padding: 12px 24px; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .btn-print:hover { background: #15803d; }
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
        <h2>ใบเสร็จรับเงิน</h2>
        <div class="subtitle">Receipt</div>
      </div>
    </div>

    <div class="company-info">
      ${receipt.recipient?.company_name ? `
        <p style="font-weight: 600; color: #1e293b;">${receipt.recipient.company_name}</p>
        ${receipt.recipient.tax_id ? `<p>เลขที่ผู้เสียภาษี: ${receipt.recipient.tax_id}</p>` : ''}
        ${receipt.recipient.company_registration_number ? `<p>เลขทะเบียนนิติบุคคล: ${receipt.recipient.company_registration_number}</p>` : ''}
        <p>${receipt.recipient?.company_address || receipt.recipient?.building_address || ''}</p>
      ` : receipt.recipient?.lessor_name ? `
        <p style="font-weight: 600; color: #1e293b;">${receipt.recipient.lessor_name}</p>
        <p>${receipt.recipient?.lessor_address || receipt.recipient?.building_address || ''}</p>
      ` : receipt.recipient?.building_address ? `
        <p>${receipt.recipient.building_address}</p>
      ` : ''}
      ${receipt.recipient?.building_phone ? `<p>โทร: ${receipt.recipient.building_phone}</p>` : ''}
    </div>

    <div class="info-grid">
      <div>
        <div class="info-label">เลขที่ใบเสร็จ</div>
        <div class="info-value">${receiptNumber}</div>
      </div>
      <div style="text-align: right;">
        <div class="info-label">วันที่ออก</div>
        <div class="info-value">${paymentDate}</div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-box">
        <h3 style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px;">ผู้รับเงิน</h3>
        <p style="font-weight: 500; color: #1e293b; font-size: 12px;">${receipt.bank?.account_name || receipt.recipient?.lessor_name || receipt.recipient?.building_name || ''}</p>
        <p style="font-size: 11px; color: #64748b;">${receipt.recipient?.lessor_address || receipt.recipient?.building_address || ''}</p>
      </div>
      <div class="info-box">
        <h3 style="font-size: 12px; font-weight: 600; color: #475569; margin-bottom: 8px;">ผู้จ่ายเงิน</h3>
        <p style="font-weight: 500; color: #1e293b; font-size: 12px;">${receipt.tenant?.full_name || 'ไม่ระบุ'}</p>
        <p style="font-size: 11px; color: #64748b;">ห้อง: ${receipt.room?.room_number || 'N/A'} | โทร: ${receipt.tenant?.phone || 'ไม่ระบุ'}</p>
        <p style="font-size: 11px; color: #64748b;">ที่อยู่: ${receipt.tenant?.address && receipt.tenant.address !== 'ไม่ระบุ' && receipt.tenant.address !== '-' ? receipt.tenant.address : 'ไม่ระบุ'}</p>
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
        <span style="font-size: 12px; color: #64748b;">(${numberToThaiText(receipt.total_amount || 0)})</span>
      </div>
      <div style="display: flex; align-items: center; gap: 15px;">
        <span class="total-amount">${(receipt.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
        <div class="stamp">
          <div class="stamp-title">✓ ชำระแล้ว</div>
          <div class="stamp-date">${paymentDate}</div>
        </div>
      </div>
    </div>

    <div class="payment-info">
      <strong>ชำระผ่าน:</strong> ${receipt.bank?.name || ''} | ${receipt.bank?.account_number || ''} 
      • ใบเสร็จนี้ออกให้เป็นหลักฐานการรับเงินเรียบร้อยแล้ว
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
      ขอบคุณที่ใช้บริการ ${receipt.recipient?.building_name || buildingName}
    </div>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('Error in publicReceiptView:', error);
    return new Response(
      `<html><body><h1>เกิดข้อผิดพลาด</h1><p>${error.message}</p></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 500 }
    );
  }
});