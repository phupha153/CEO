import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, AlertCircle, Clock, CheckCircle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";
import { base44 } from "@/api/base44Client";

// ⭐ Note: ใช้ค่าปรับจาก backend (late_fee_amount) แทนการคำนวณเอง
// Backend คำนวณและบันทึกไว้ใน total_amount แล้ว

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

export default function PublicInvoice() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("id") || searchParams.get("paymentId");
  const branchId = searchParams.get("branch");
  const invoiceRef = useRef();
  
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configs, setConfigs] = useState([]);

  useEffect(() => {
    if (!paymentId) {
      setError('ไม่พบเลขที่ใบแจ้งหนี้');
      setLoading(false);
      return;
    }

    const fetchInvoice = async () => {
      try {
        console.log('🔍 [PublicInvoice] Fetching for paymentId:', paymentId);
        
        // ⭐ ใช้ SDK แทน fetch เพื่อให้จัดการ path อัตโนมัติทั้ง production และ preview
        const response = await base44.functions.invoke('getPublicInvoice', {
          paymentId,
          branchId
        });

        console.log('🔍 [PublicInvoice] Response:', response.data);
        
        if (response.data.success) {
          console.log('🔍 [PublicInvoice] Invoice Data:', response.data.invoice);
          setInvoiceData(response.data.invoice);
          // ⭐ ดึง configs จาก response
          setConfigs(response.data.invoice?.configs || []);
        } else {
          setError(response.data.error || 'ไม่พบข้อมูลใบแจ้งหนี้');
        }
      } catch (err) {
        console.error('Error fetching invoice:', err);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [paymentId, branchId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-sm w-full">
          <Loader2 className="w-10 h-10 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-base font-semibold text-slate-700">กำลังโหลด...</p>
        </Card>
      </div>
    );
  }

  if (error || !invoiceData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-md w-full">
          <p className="text-base font-semibold text-slate-700 mb-2">{error || 'ไม่พบข้อมูล'}</p>
          <p className="text-sm text-slate-500">กรุณาติดต่อเจ้าของหอพัก</p>
        </Card>
      </div>
    );
  }

  const invoiceNumber = `INV-${invoiceData.id.slice(0, 8).toUpperCase()}`;
  const issueDate = format(new Date(), 'd MMMM yyyy', { locale: th });
  const dueDate = invoiceData.due_date ? format(parseISO(invoiceData.due_date), 'd MMMM yyyy', { locale: th }) : '-';
  const paymentDate = invoiceData.payment_date 
    ? format(parseISO(invoiceData.payment_date), 'd MMMM yyyy', { locale: th })
    : null;
  const isPaid = invoiceData.status === 'paid';
  
  const isOverdue = !isPaid && invoiceData.due_date && differenceInDays(new Date(), parseISO(invoiceData.due_date)) > 0;
  const daysOverdue = isOverdue ? differenceInDays(new Date(), parseISO(invoiceData.due_date)) : 0;

  // ⭐ ใช้ค่าปรับที่บันทึกไว้แล้ว (ไม่คำนวณใหม่)
  const displayLateFee = invoiceData.late_fee_amount || 0;

  const handleDownload = () => {
    if (window.print) {
      window.print();
    }
  };

  const lineItems = [];
  if (invoiceData.rent_amount > 0) {
    lineItems.push({
      name: 'ค่าเช่า',
      quantity: 1,
      price: invoiceData.rent_amount,
      total: invoiceData.rent_amount
    });
  }
  if (invoiceData.electricity_amount > 0) {
    const calculatedElecAmount = invoiceData.electricity_units * invoiceData.electricity_rate;
    const isElecMinimum = invoiceData.electricity_units === 0 || Math.abs(calculatedElecAmount - invoiceData.electricity_amount) > 0.01;
    const elecMeterText = (invoiceData.electricity_previous || invoiceData.electricity_current) 
      ? ` (${invoiceData.electricity_previous}-${invoiceData.electricity_current})` 
      : '';

    lineItems.push({
      name: isElecMinimum 
        ? `ค่าไฟฟ้า${elecMeterText} ใช้ ${invoiceData.electricity_units} หน่วย - คิดขั้นต่ำ`
        : `ค่าไฟฟ้า${elecMeterText} ${invoiceData.electricity_units} หน่วย × ${invoiceData.electricity_rate} บาท`,
      quantity: 1,
      price: invoiceData.electricity_amount,
      total: invoiceData.electricity_amount
    });
  }
  if (invoiceData.water_amount > 0) {
    const calculatedWaterAmount = invoiceData.water_units * invoiceData.water_rate;
    const isWaterMinimum = invoiceData.water_units === 0 || Math.abs(calculatedWaterAmount - invoiceData.water_amount) > 0.01;
    const waterMeterText = (invoiceData.water_previous || invoiceData.water_current) 
      ? ` (${invoiceData.water_previous}-${invoiceData.water_current})` 
      : '';

    lineItems.push({
      name: isWaterMinimum 
        ? `ค่าน้ำประปา${waterMeterText} ใช้ ${invoiceData.water_units} หน่วย - คิดขั้นต่ำ`
        : `ค่าน้ำประปา${waterMeterText} ${invoiceData.water_units} หน่วย × ${invoiceData.water_rate} บาท`,
      quantity: 1,
      price: invoiceData.water_amount,
      total: invoiceData.water_amount
    });
  }
  if (invoiceData.internet_amount > 0) {
    lineItems.push({
      name: 'ค่าอินเทอร์เน็ต',
      quantity: 1,
      price: invoiceData.internet_amount,
      total: invoiceData.internet_amount
    });
  }
  if (invoiceData.common_fee_amount > 0) {
    lineItems.push({
      name: 'ค่าส่วนกลาง',
      quantity: 1,
      price: invoiceData.common_fee_amount,
      total: invoiceData.common_fee_amount
    });
  }
  if (invoiceData.parking_fee_amount > 0) {
    lineItems.push({
      name: 'ค่าที่จอดรถ',
      quantity: 1,
      price: invoiceData.parking_fee_amount,
      total: invoiceData.parking_fee_amount
    });
  }
  if (invoiceData.other_amount > 0) {
    lineItems.push({
      name: 'ค่าใช้จ่ายอื่นๆ',
      quantity: 1,
      price: invoiceData.other_amount,
      total: invoiceData.other_amount
    });
  }
  if (displayLateFee > 0) {
    lineItems.push({
      name: 'ค่าปรับชำระล่าช้า',
      quantity: 1,
      price: displayLateFee,
      total: displayLateFee
    });
  }

  const buildingLogo = invoiceData?.recipient?.building_logo || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
  const buildingName = invoiceData?.recipient?.building_name || 'W RESIDENTS';

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <style>{`
        @media print {
          body, html {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 11px !important;
          }
          
          @page {
            size: A4;
            margin: 8mm;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          
          .invoice-container {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          .invoice-card {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
          }
          
          .invoice-card > div {
            padding: 10px !important;
          }
          
          h1, h2, h3 { font-size: 14px !important; }
          p, span, td, th { font-size: 10px !important; }
          .text-lg { font-size: 12px !important; }
          .text-xl { font-size: 14px !important; }
          .text-2xl { font-size: 16px !important; }
          .text-xs { font-size: 9px !important; }
          .text-sm { font-size: 10px !important; }
          
          .mb-4, .mb-5 { margin-bottom: 8px !important; }
          .mb-3 { margin-bottom: 6px !important; }
          .p-3 { padding: 6px !important; }
          .p-2 { padding: 4px !important; }
          .py-2 { padding-top: 4px !important; padding-bottom: 4px !important; }
          .gap-3 { gap: 6px !important; }
          .gap-4 { gap: 8px !important; }
          
          .w-10 { width: 28px !important; }
          .h-10 { height: 28px !important; }
          .h-12 { height: 32px !important; }
        }
        
        @media screen {
          .invoice-container {
            width: 210mm;
            min-height: 297mm;
          }
        }
      `}</style>

      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-end items-center gap-2">
          <Button
            onClick={handleDownload}
            size="sm"
            variant="default"
            className="gap-2 text-xs bg-blue-600 hover:bg-blue-700"
          >
            <Download className="w-3 h-3" />
            พิมพ์ / บันทึก PDF
          </Button>
        </div>
      </div>

      <div className="invoice-container mx-auto p-4 md:p-8 print:p-0">
        <div className="invoice-card bg-white rounded-lg shadow-xl print:shadow-none overflow-hidden" ref={invoiceRef}>
          <div className="p-8 print:p-5">
            <div className="mb-4 pb-3 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <img
                    src={buildingLogo}
                    alt={`${buildingName} Logo`}
                    className="w-10 h-10 object-contain"
                    onError={(e) => {
                      e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
                    }}
                  />
                  <h1 className="text-lg font-bold text-slate-800">{buildingName}</h1>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-bold text-orange-600">ใบแจ้งหนี้</h2>
                  <p className="text-xs text-orange-600">Invoice</p>
                </div>
              </div>
              
              <div className="text-xs text-slate-600 mt-2 space-y-0.5">
                {invoiceData.recipient?.company_name ? (
                  <>
                    <p className="font-medium text-slate-800">{invoiceData.recipient.company_name}</p>
                    {invoiceData.recipient.tax_id && <p>เลขที่ผู้เสียภาษี: {invoiceData.recipient.tax_id}</p>}
                    {invoiceData.recipient.company_registration_number && <p>เลขทะเบียนนิติบุคคล: {invoiceData.recipient.company_registration_number}</p>}
                    <p>{invoiceData.recipient?.company_address || invoiceData.recipient?.building_address}</p>
                    {invoiceData.recipient?.building_phone && <p>โทร: {invoiceData.recipient.building_phone}</p>}
                  </>
                ) : invoiceData.recipient?.lessor_name ? (
                  <>
                    <p className="font-medium text-slate-800">{invoiceData.recipient.lessor_name}</p>
                    <p>{invoiceData.recipient?.lessor_address || invoiceData.recipient?.building_address}</p>
                    {invoiceData.recipient?.building_phone && <p>โทร: {invoiceData.recipient.building_phone}</p>}
                  </>
                ) : invoiceData.recipient?.building_address ? (
                  <>
                    <p>{invoiceData.recipient.building_address}</p>
                    {invoiceData.recipient?.building_phone && <p>โทร: {invoiceData.recipient.building_phone}</p>}
                  </>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-500 mb-1">เลขที่ใบแจ้งหนี้</p>
                <p className="font-bold text-slate-800">{invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">วันครบกำหนด</p>
                <p className="font-bold text-slate-800">{dueDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="border border-slate-200 rounded p-2">
                <h3 className="font-semibold text-slate-700 text-xs mb-1">ผู้รับเงิน</h3>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p className="font-medium text-slate-800">{invoiceData.bank?.account_name || invoiceData.recipient?.lessor_name || invoiceData.recipient?.building_name}</p>
                  <p>{invoiceData.recipient?.lessor_address || invoiceData.recipient?.building_address}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded p-2">
                <h3 className="font-semibold text-slate-700 text-xs mb-1">ผู้จ่ายเงิน</h3>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p className="font-medium text-slate-800">{invoiceData.tenant?.full_name || 'ไม่ระบุ'}</p>
                  <p>ห้อง: {invoiceData.room?.room_number || 'N/A'} | โทร: {invoiceData.tenant?.phone || 'ไม่ระบุ'}</p>
                  <p>ที่อยู่: {invoiceData.tenant?.address && invoiceData.tenant.address !== 'ไม่ระบุ' && invoiceData.tenant.address !== '-' ? invoiceData.tenant.address : 'ไม่ระบุ'}</p>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-300">
                    <th className="text-left py-2.5 px-2 font-bold text-slate-700 w-12">ลำดับ</th>
                    <th className="text-left py-2.5 px-2 font-bold text-slate-700">รายการ</th>
                    <th className="text-center py-2.5 px-2 font-bold text-slate-700 w-18">จำนวน</th>
                    <th className="text-right py-2.5 px-2 font-bold text-slate-700 w-26">ราคา/หน่วย</th>
                    <th className="text-right py-2.5 px-2 font-bold text-slate-700 w-30">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={index} className="border-b border-slate-200 hover:bg-slate-50">
                      <td className="py-2 px-2 text-center text-slate-600">{index + 1}</td>
                      <td className="py-2 px-2 text-slate-800">{item.name}</td>
                      <td className="py-2 px-2 text-center text-slate-600">{item.quantity}</td>
                      <td className="py-2 px-2 text-right text-slate-600">
                        {(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2 px-2 text-right font-bold text-slate-800">
                        {(item.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mb-4 border-t-2 border-slate-300 pt-3">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-600">
                  <span className="font-medium">ยอดเงินสุทธิ</span>
                  <span className="ml-2">({numberToThaiText(invoiceData.total_amount || 0)})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-800">
                    {(invoiceData.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                  {isPaid ? (
                    <div className="border-2 border-green-600 rounded px-2.5 py-1 text-center transform rotate-[-3deg]">
                      <p className="text-xs font-bold text-green-700">✓ ชำระแล้ว</p>
                      <p className="text-[9px] text-green-600">{paymentDate}</p>
                    </div>
                  ) : isOverdue ? (
                    <div className="border-2 border-red-500 rounded px-2.5 py-1 text-center transform rotate-[-3deg]">
                      <p className="text-xs font-bold text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> เกินกำหนด
                      </p>
                      <p className="text-[9px] text-red-500">{daysOverdue} วัน</p>
                    </div>
                  ) : (
                    <div className="border-2 border-orange-500 rounded px-2.5 py-1 text-center transform rotate-[-3deg]">
                      <p className="text-xs font-bold text-orange-600 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> รอชำระ
                      </p>
                      <p className="text-[9px] text-orange-500">ครบกำหนด: {dueDate}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mb-3 text-xs text-slate-500">
              <span className="font-medium text-slate-600">ชำระผ่าน:</span> {invoiceData.bank?.name} | {invoiceData.bank?.account_number} • {isPaid ? `ชำระเงินเรียบร้อยเมื่อ ${paymentDate}` : 'กรุณาชำระเงินภายในวันที่กำหนด'}
            </div>

            <div className="grid grid-cols-3 gap-4 mt-5 pt-3 border-t border-slate-200">
              <div className="text-center">
                <div className="h-12 border-b border-slate-300 mb-1"></div>
                <p className="text-xs text-slate-600">ผู้จัดทำ</p>
              </div>
              <div className="text-center">
                <div className="h-12 border-b border-slate-300 mb-1"></div>
                <p className="text-xs text-slate-600">ผู้อนุมัติ</p>
              </div>
              <div className="text-center">
                <div className="h-12 border-b border-slate-300 mb-1"></div>
                <p className="text-xs text-slate-600">ผู้รับเงิน</p>
              </div>
            </div>

            <div className="pt-4 text-center">
              <p className="text-xs text-slate-500">ขอบคุณที่ใช้บริการ {invoiceData.recipient?.building_name || buildingName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}