import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, CheckCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import html2canvas from "html2canvas";

// ⭐ Note: calculateLateFee ถูกย้ายไปยัง backend utility แล้ว
// Frontend ใช้ค่าปรับที่คำนวณจาก backend ผ่าน invoice data

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

export default function PublicReceipt() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get("id") || searchParams.get("paymentId");
  
  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [downloading, setDownloading] = useState(false);
  const receiptRef = useRef(null);

  useEffect(() => {
    if (!paymentId) {
      setError('ไม่พบเลขที่ใบเสร็จ');
      setLoading(false);
      return;
    }

    const fetchReceipt = async () => {
      try {
        console.log('🔍 [PublicReceipt] Fetching for paymentId:', paymentId);
        
        const response = await base44.functions.invoke('getPublicInvoice', {
          paymentId
        });

        console.log('🔍 [PublicReceipt] Response:', response.data);
        
        if (response.data.success) {
          setReceiptData(response.data.invoice);
          // ⭐ ดึง configs จาก response
          setConfigs(response.data.invoice?.configs || []);
        } else {
          setError(response.data.error || 'ไม่พบข้อมูลใบเสร็จ');
        }
      } catch (err) {
        console.error('Error fetching receipt:', err);
        setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [paymentId]);

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

  if (error || !receiptData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-md w-full">
          <p className="text-base font-semibold text-slate-700 mb-2">{error || 'ไม่พบข้อมูล'}</p>
          <p className="text-sm text-slate-500">กรุณาติดต่อเจ้าของหอพัก</p>
        </Card>
      </div>
    );
  }

  const receiptNumber = `REC-${receiptData.id.slice(0, 8).toUpperCase()}`;
  const paymentDate = receiptData.payment_date 
    ? format(parseISO(receiptData.payment_date), 'd MMMM yyyy', { locale: th })
    : format(new Date(), 'd MMMM yyyy', { locale: th });

  const handleDownloadImage = async () => {
    if (!receiptRef.current || downloading) return;

    setDownloading(true);
    try {
      // รอให้รูปภาพโหลดเสร็จทั้งหมด
      const images = receiptRef.current.getElementsByTagName('img');
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = resolve; // ไม่ reject เพื่อให้ดำเนินการต่อได้
          });
        })
      );

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true
      });

      const link = document.createElement('a');
      link.download = `ใบเสร็จ-${receiptNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      alert('ดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setDownloading(false);
    }
  };

  // ⭐ ใช้ค่าปรับจาก backend (คำนวณแล้ว)
  const displayLateFee = receiptData.late_fee_amount || 0;

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
    const calculatedElecAmount = receiptData.electricity_units * receiptData.electricity_rate;
    const isElecMinimum = receiptData.electricity_units === 0 || Math.abs(calculatedElecAmount - receiptData.electricity_amount) > 0.01;
    const elecMeterText = (receiptData.electricity_previous || receiptData.electricity_current) 
      ? ` (${receiptData.electricity_previous}-${receiptData.electricity_current})` 
      : '';

    lineItems.push({
      name: isElecMinimum 
        ? `ค่าไฟฟ้า${elecMeterText} ใช้ ${receiptData.electricity_units} หน่วย - คิดขั้นต่ำ`
        : `ค่าไฟฟ้า${elecMeterText} ${receiptData.electricity_units} หน่วย × ${receiptData.electricity_rate} บาท`,
      quantity: 1,
      price: receiptData.electricity_amount,
      total: receiptData.electricity_amount
    });
  }
  if (receiptData.water_amount > 0) {
    const calculatedWaterAmount = receiptData.water_units * receiptData.water_rate;
    const isWaterMinimum = receiptData.water_units === 0 || Math.abs(calculatedWaterAmount - receiptData.water_amount) > 0.01;
    const waterMeterText = (receiptData.water_previous || receiptData.water_current) 
      ? ` (${receiptData.water_previous}-${receiptData.water_current})` 
      : '';

    lineItems.push({
      name: isWaterMinimum 
        ? `ค่าน้ำประปา${waterMeterText} ใช้ ${receiptData.water_units} หน่วย - คิดขั้นต่ำ`
        : `ค่าน้ำประปา${waterMeterText} ${receiptData.water_units} หน่วย × ${receiptData.water_rate} บาท`,
      quantity: 1,
      price: receiptData.water_amount,
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
  if (receiptData.common_fee_amount > 0) {
    lineItems.push({
      name: 'ค่าส่วนกลาง',
      quantity: 1,
      price: receiptData.common_fee_amount,
      total: receiptData.common_fee_amount
    });
  }
  if (receiptData.parking_fee_amount > 0) {
    lineItems.push({
      name: 'ค่าที่จอดรถ',
      quantity: 1,
      price: receiptData.parking_fee_amount,
      total: receiptData.parking_fee_amount
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
  if (displayLateFee > 0) {
    lineItems.push({
      name: 'ค่าปรับชำระล่าช้า',
      quantity: 1,
      price: displayLateFee,
      total: displayLateFee
    });
  }

  const buildingLogo = receiptData?.recipient?.building_logo || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
  const buildingName = receiptData?.recipient?.building_name || 'W RESIDENTS';

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
          
          .receipt-container {
            max-width: 100% !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          .receipt-card {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
          }
          
          .receipt-card > div {
            padding: 10px !important;
          }
          
          h1, h2, h3 { font-size: 14px !important; }
          p, span, td, th { font-size: 10px !important; }
          .text-lg { font-size: 12px !important; }
          .text-xl { font-size: 14px !important; }
          .text-xs { font-size: 9px !important; }
          .text-sm { font-size: 10px !important; }
          
          .mb-4, .mb-5 { margin-bottom: 8px !important; }
          .mb-3 { margin-bottom: 6px !important; }
          .p-3 { padding: 6px !important; }
          .p-2 { padding: 4px !important; }
          .gap-3 { gap: 6px !important; }
          
          .w-10 { width: 28px !important; }
          .h-10 { height: 28px !important; }
          .h-12 { height: 32px !important; }
        }
        
        @media screen {
          .receipt-container {
            max-width: 800px;
            width: 100%;
          }
        }
      `}</style>

      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-end items-center gap-2">
          <Button
            onClick={handleDownloadImage}
            size="sm"
            variant="default"
            className="gap-2 text-sm bg-green-600 hover:bg-green-700 px-4 py-2 active:scale-95 transition-transform"
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {downloading ? 'กำลังสร้างรูป...' : 'ดาวน์โหลดรูปภาพ'}
          </Button>
        </div>
      </div>

      <div className="receipt-container mx-auto p-8 print:p-0">
        <div ref={receiptRef} className="receipt-card bg-white rounded-lg shadow-xl print:shadow-none overflow-hidden">
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
                  <h2 className="text-lg font-bold text-green-600">ใบเสร็จรับเงิน</h2>
                  <p className="text-xs text-green-600">Receipt</p>
                </div>
              </div>
              
              <div className="text-xs text-slate-600 mt-2 space-y-0.5">
                {receiptData.recipient?.company_name ? (
                  <>
                    <p className="font-medium text-slate-800">{receiptData.recipient.company_name}</p>
                    {receiptData.recipient.tax_id && <p>เลขประจำตัวผู้เสียภาษี: {receiptData.recipient.tax_id}</p>}
                    {receiptData.recipient.company_registration_number && <p>เลขทะเบียนนิติบุคคล: {receiptData.recipient.company_registration_number}</p>}
                    <p>{receiptData.recipient?.company_address || receiptData.recipient?.building_address}</p>
                    {receiptData.recipient?.company_phone && <p>เบอร์ติดต่อ: {receiptData.recipient.company_phone}</p>}
                  </>
                ) : receiptData.recipient?.lessor_name ? (
                  <>
                    <p className="font-medium text-slate-800">{receiptData.recipient.lessor_name}</p>
                    {receiptData.recipient.lessor_id && <p>เลขประจำตัวผู้เสียภาษี: {receiptData.recipient.lessor_id}</p>}
                    <p>{receiptData.recipient?.lessor_address || receiptData.recipient?.building_address}</p>
                    {receiptData.recipient?.building_phone && <p>เบอร์ติดต่อ: {receiptData.recipient.building_phone}</p>}
                  </>
                ) : receiptData.recipient?.building_address ? (
                  <>
                    <p>{receiptData.recipient.building_address}</p>
                    {receiptData.recipient?.building_phone && <p>เบอร์ติดต่อ: {receiptData.recipient.building_phone}</p>}
                  </>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-5 p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-xs text-slate-500 mb-1">เลขที่ใบเสร็จ</p>
                <p className="font-bold text-slate-800">{receiptNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500 mb-1">วันที่ออก</p>
                <p className="font-bold text-slate-800">{paymentDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="border border-slate-200 rounded p-2">
                <h3 className="font-semibold text-slate-700 text-xs mb-1">ผู้รับเงิน</h3>
                <div className="text-xs text-slate-600 space-y-0.5">
                  {receiptData.recipient?.company_name ? (
                    <>
                      <p className="font-medium text-slate-800">{receiptData.recipient.company_name}</p>
                      {receiptData.recipient.tax_id && <p>เลขประจำตัวผู้เสียภาษี: {receiptData.recipient.tax_id}</p>}
                      <p>{receiptData.recipient?.company_address || receiptData.recipient?.building_address}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-slate-800">{receiptData.recipient?.lessor_name || receiptData.recipient?.building_name}</p>
                      {receiptData.recipient?.lessor_id && <p>เลขประจำตัวผู้เสียภาษี: {receiptData.recipient.lessor_id}</p>}
                      <p>{receiptData.recipient?.lessor_address || receiptData.recipient?.building_address}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded p-2">
                <h3 className="font-semibold text-slate-700 text-xs mb-1">ผู้จ่ายเงิน</h3>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p className="font-medium text-slate-800">{receiptData.tenant?.full_name || 'ไม่ระบุ'}</p>
                  <p>ห้อง: {receiptData.room?.room_number || 'N/A'} | โทร: {receiptData.tenant?.phone || 'ไม่ระบุ'}</p>
                  <p>ที่อยู่: {receiptData.tenant?.address && receiptData.tenant.address !== 'ไม่ระบุ' && receiptData.tenant.address !== '-' ? receiptData.tenant.address : 'ไม่ระบุ'}</p>
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
                  <span className="ml-2">({numberToThaiText(receiptData.total_amount || 0)})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-800">
                    {(receiptData.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                  <div className="border-2 border-green-600 rounded px-2.5 py-1 text-center transform rotate-[-3deg]">
                    <p className="text-xs font-bold text-green-700">✓ ชำระแล้ว</p>
                    <p className="text-[9px] text-green-600">{paymentDate}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-3 text-xs text-slate-500">
              <span className="font-medium text-slate-600">ชำระผ่าน:</span> {receiptData.bank?.name} | {receiptData.bank?.account_number} • ใบเสร็จนี้ออกให้เป็นหลักฐานการรับเงินเรียบร้อยแล้ว
            </div>

            <div className="flex justify-center mt-5 pt-3 border-t border-slate-200">
              <div className="text-center w-64">
                <div className="h-12 flex items-center justify-center mb-1">
                  {receiptData.recipient?.receiver_signature && (
                    <img 
                      src={receiptData.recipient.receiver_signature} 
                      alt="ลายเซ็นผู้รับเงิน" 
                      className="h-10 object-contain"
                    />
                  )}
                </div>
                <p className="text-xs text-slate-600">
                  ผู้รับเงิน: {receiptData.recipient?.lessor_name || receiptData.recipient?.building_name || '________________'}
                </p>
              </div>
            </div>

            <div className="pt-4 text-center">
              <p className="text-xs text-slate-500">ขอบคุณที่ใช้บริการ {receiptData.recipient?.building_name || buildingName}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}