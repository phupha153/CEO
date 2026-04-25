import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import jsPDF from 'npm:jspdf@2.5.1';
import html2canvas from 'npm:html2canvas@1.4.1';

// Component สำหรับ render ใบเสร็จ (ใช้สำหรับแปลงเป็น PDF)
export const ReceiptContent = ({ receiptData }) => {
  const receiptNumber = `REC-${receiptData.id.slice(0, 8).toUpperCase()}`;
  const paymentDate = receiptData.payment_date 
    ? format(parseISO(receiptData.payment_date), 'd MMMM yyyy', { locale: th })
    : format(new Date(), 'd MMMM yyyy', { locale: th });

  const lineItems = [];
  if (receiptData.rent_amount > 0) {
    lineItems.push({
      name: 'ค่าเช่า',
      quantity: 1,
      price: receiptData.rent_amount,
      total: receiptData.rent_amount
    });
  }
  if (receiptData.electricity_amount > 0) {
    lineItems.push({
      name: `ค่าไฟฟ้า (${receiptData.electricity_units} หน่วย × ${receiptData.electricity_rate} บาท)`,
      quantity: receiptData.electricity_units,
      price: receiptData.electricity_rate,
      total: receiptData.electricity_amount
    });
  }
  if (receiptData.water_amount > 0) {
    lineItems.push({
      name: `ค่าน้ำประปา (${receiptData.water_units} หน่วย × ${receiptData.water_rate} บาท)`,
      quantity: receiptData.water_units,
      price: receiptData.water_rate,
      total: receiptData.water_amount
    });
  }
  if (receiptData.internet_amount > 0) {
    lineItems.push({
      name: 'ค่าอินเทอร์เน็ต',
      quantity: 1,
      price: receiptData.internet_amount,
      total: receiptData.internet_amount
    });
  }
  if (receiptData.other_amount > 0) {
    lineItems.push({
      name: 'ค่าใช้จ่ายอื่นๆ',
      quantity: 1,
      price: receiptData.other_amount,
      total: receiptData.other_amount
    });
  }

  return (
    <div style={{
      width: '794px',
      minHeight: '1123px',
      background: 'white',
      padding: '40px',
      fontFamily: 'Arial, sans-serif'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '30px', paddingBottom: '20px', borderBottom: '2px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg"
              alt="Logo"
              style={{ width: '60px', height: '60px', objectFit: 'contain' }}
            />
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>{receiptData.recipient?.building_name || 'ที่พัก'}</h1>
              <p style={{ fontSize: '14px', color: '#64748b', margin: '5px 0 0 0' }}>ระบบจัดการที่พักอาศัย</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981', margin: 0 }}>ใบเสร็จรับเงิน</h2>
            <p style={{ fontSize: '14px', color: '#10b981', fontWeight: '600', margin: '5px 0 0 0' }}>RECEIPT</p>
          </div>
        </div>
        
        <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
          <p style={{ margin: '3px 0' }}>28/244 หมู่ 4 ถนนมหาธรรมการ 4 ซอย 6</p>
          <p style={{ margin: '3px 0' }}>ตำบลสำโรง อำเภอพระประแดง จ.สมุทรปราการ</p>
        </div>

        <div style={{ fontSize: '13px' }}>
          <p style={{ margin: '5px 0' }}><span style={{ fontWeight: '600' }}>เลขที่:</span> {receiptNumber}</p>
          <p style={{ margin: '5px 0' }}><span style={{ fontWeight: '600' }}>วันที่ออก:</span> {paymentDate}</p>
        </div>
      </div>

      {/* Payment Status */}
      <div style={{ 
        background: '#d1fae5', 
        border: '2px solid #10b981', 
        borderRadius: '8px', 
        padding: '20px', 
        marginBottom: '25px',
        textAlign: 'center'
      }}>
        <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#065f46', margin: 0 }}>✓ ชำระเงินเรียบร้อยแล้ว</p>
        <p style={{ fontSize: '13px', color: '#047857', margin: '5px 0 0 0' }}>วันที่ชำระ: {paymentDate}</p>
      </div>

      {/* Customer Info */}
      <div style={{ marginBottom: '25px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '10px' }}>ผู้เช่า / Customer</h3>
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '15px' }}>
          <p style={{ fontWeight: 'bold', fontSize: '16px', color: '#1e293b', margin: '5px 0' }}>{receiptData.tenant.full_name}</p>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '5px 0' }}>ห้อง {receiptData.room.room_number}</p>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '5px 0' }}>{receiptData.tenant.phone}</p>
          {receiptData.tenant.national_id && (
            <p style={{ fontSize: '13px', color: '#64748b', margin: '5px 0' }}>
              เลขประจำตัวผู้เสียภาษี: {receiptData.tenant.national_id}
            </p>
          )}
        </div>
      </div>

      {/* Items Table */}
      <div style={{ marginBottom: '25px' }}>
        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '600', color: '#475569' }}>ลำดับ</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: '600', color: '#475569' }}>รายการ</th>
              <th style={{ textAlign: 'center', padding: '10px 8px', fontWeight: '600', color: '#475569' }}>จำนวน</th>
              <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '600', color: '#475569' }}>ราคา/หน่วย</th>
              <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: '600', color: '#475569' }}>จำนวนเงิน</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px 8px', color: '#64748b' }}>{index + 1}</td>
                <td style={{ padding: '10px 8px', color: '#1e293b' }}>{item.name}</td>
                <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b' }}>{item.quantity}</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: '#64748b' }}>
                  {(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', fontWeight: '600', color: '#1e293b' }}>
                  {(item.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '25px' }}>
        <div style={{ width: '300px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '15px 0', 
            borderTop: '2px solid #cbd5e1' 
          }}>
            <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>รวมทั้งสิ้น</span>
            <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#10b981' }}>
              {(receiptData.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
            </span>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div style={{ 
        background: '#d1fae5', 
        borderRadius: '8px', 
        padding: '15px', 
        marginBottom: '20px',
        border: '1px solid #6ee7b7'
      }}>
        <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#1e293b', marginBottom: '10px' }}>
          💰 วิธีการชำระเงิน
        </h3>
        <div style={{ fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
            <span style={{ color: '#64748b' }}>ธนาคาร:</span>
            <span style={{ fontWeight: '600', color: '#1e293b' }}>{receiptData.bank.name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
            <span style={{ color: '#64748b' }}>เลขที่บัญชี:</span>
            <span style={{ fontWeight: '600', color: '#1e293b' }}>{receiptData.bank.account_number}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
            <span style={{ color: '#64748b' }}>ชื่อบัญชี:</span>
            <span style={{ fontWeight: '600', color: '#1e293b' }}>{receiptData.bank.account_name}</span>
          </div>
        </div>
      </div>



      {/* Notes */}
      <div style={{ 
        fontSize: '12px', 
        color: '#64748b', 
        background: '#f8fafc', 
        padding: '15px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <p style={{ fontWeight: '600', color: '#475569', marginBottom: '8px' }}>หมายเหตุ:</p>
        <p style={{ margin: '3px 0' }}>• ใบเสร็จฉบับนี้ออกให้เป็นหลักฐานการรับเงินเรียบร้อยแล้ว</p>
        <p style={{ margin: '3px 0' }}>• กรุณาเก็บใบเสร็จนี้ไว้เป็นหลักฐาน</p>
        <p style={{ margin: '3px 0' }}>• หากมีข้อสงสัยกรุณาติดต่อเจ้าของหอพัก</p>
      </div>

      {/* Footer */}
      <div style={{ paddingTop: '20px', borderTop: '1px solid #e2e8f0', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#64748b', margin: '3px 0' }}>ขอบคุณที่ใช้บริการ {receiptData.recipient?.building_name || 'ที่พัก'}</p>
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '3px 0' }}>เอกสารนี้สร้างโดยระบบอัตโนมัติ</p>
      </div>
    </div>
  );
};

// ฟังก์ชันสร้าง PDF จาก Receipt Data
export const generateReceiptPDF = async (receiptData, filename) => {
  // สร้าง element ชั่วคราวใน DOM
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  document.body.appendChild(container);

  // Render receipt content
  const root = ReactDOM.createRoot(container);
  root.render(<ReceiptContent receiptData={receiptData} />);

  // รอให้ render เสร็จ
  await new Promise(resolve => setTimeout(resolve, 500));

  // Convert to canvas
  const canvas = await html2canvas(container.firstChild, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff'
  });

  // Create PDF
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const imgWidth = 210; // A4 width in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  
  pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  
  // Cleanup
  document.body.removeChild(container);

  return pdf;
};

export default { ReceiptContent, generateReceiptPDF };