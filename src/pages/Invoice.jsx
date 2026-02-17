import React, { useRef, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, AlertCircle, ArrowLeft, Clock, CheckCircle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";
import html2canvas from "html2canvas";


// ⭐ Note: ใช้ค่าปรับจาก backend (late_fee_amount) แทนการคำนวณเอง
// Backend จะคำนวณและบันทึกค่าปรับไว้แล้วใน total_amount

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

export default function Invoice() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const invoiceRef = useRef();
  const navigate = useNavigate();

  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [configsLoaded, setConfigsLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!paymentId) {
      setError('ไม่พบเลขที่ใบแจ้งหนี้');
      setLoading(false);
      return;
    }

    const fetchInvoice = async () => {
      try {
        console.log('🔍 [Invoice] Fetching invoice for paymentId:', paymentId);
        
        // ⭐ ดึง configs เพื่อคำนวณค่าปรับ
        const configsData = await base44.entities.Config.list();
        setConfigs(configsData);
        setConfigsLoaded(true);
        
        const response = await base44.functions.invoke('getPublicInvoice', {
          paymentId: paymentId
        });

        console.log('🔍 [Invoice] Response:', response.data);
        
        if (response.data.success) {
          console.log('🔍 [Invoice] Invoice Data:', response.data.invoice);
          console.log('🔍 [Invoice] Recipient:', response.data.invoice?.recipient);
          console.log('🔍 [Invoice] Company Registration Number:', response.data.invoice?.recipient?.company_registration_number);
          setInvoiceData(response.data.invoice);
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
  }, [paymentId]);

  if (loading || !configsLoaded) {
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
  
  // คำนวณวันเกินกำหนด
  const isOverdue = !isPaid && invoiceData.due_date && differenceInDays(new Date(), parseISO(invoiceData.due_date)) > 0;
  const daysOverdue = isOverdue ? differenceInDays(new Date(), parseISO(invoiceData.due_date)) : 0;

  // ⭐ ใช้ค่าปรับที่ lock ไว้ในฐานข้อมูลโดยตรง (Cron Job จะอัปเดตให้)
  const displayLateFee = invoiceData.late_fee_amount || 0;

  const handleDownloadImage = async () => {
    if (!invoiceRef.current || downloading) return;
    
    setDownloading(true);
    try {
      const images = invoiceRef.current.getElementsByTagName('img');
      await Promise.all(
        Array.from(images).map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve;
          });
        })
      );

      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        allowTaint: true
      });
      
      const link = document.createElement('a');
      link.download = `ใบแจ้งหนี้-${invoiceNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error generating image:', error);
      alert('ดาวน์โหลดไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setDownloading(false);
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
  
  // ⭐ แสดงค่าไฟเสมอ (แม้เป็น 0 บาท) เพื่อให้เห็นหน่วยที่ใช้
  const elecUnits = invoiceData.electricity_units || 0;
  const elecAmount = invoiceData.electricity_amount || 0;
  const calculatedElecAmount = elecUnits * (invoiceData.electricity_rate || 0);
  const isElecMinimum = elecUnits === 0 || Math.abs(calculatedElecAmount - elecAmount) > 0.01;
  const elecMeterText = (invoiceData.electricity_previous || invoiceData.electricity_current) 
    ? ` (${invoiceData.electricity_previous}-${invoiceData.electricity_current})` 
    : '';

  lineItems.push({
    name: isElecMinimum 
      ? `ค่าไฟฟ้า${elecMeterText} ใช้ ${elecUnits} หน่วย${elecAmount === 0 ? '' : ' - คิดขั้นต่ำ'}`
      : `ค่าไฟฟ้า${elecMeterText} ${elecUnits} หน่วย × ${invoiceData.electricity_rate} บาท`,
    quantity: 1,
    price: elecAmount,
    total: elecAmount
  });
  
  // ⭐ แสดงค่าน้ำเสมอ (แม้เป็น 0 บาท) เพื่อให้เห็นหน่วยที่ใช้
  const waterUnits = invoiceData.water_units || 0;
  const waterAmount = invoiceData.water_amount || 0;
  const calculatedWaterAmount = waterUnits * (invoiceData.water_rate || 0);
  const isWaterMinimum = waterUnits === 0 || Math.abs(calculatedWaterAmount - waterAmount) > 0.01;
  const waterMeterText = (invoiceData.water_previous || invoiceData.water_current) 
    ? ` (${invoiceData.water_previous}-${invoiceData.water_current})` 
    : '';

  lineItems.push({
    name: isWaterMinimum 
      ? `ค่าน้ำประปา${waterMeterText} ใช้ ${waterUnits} หน่วย${waterAmount === 0 ? '' : ' - คิดขั้นต่ำ'}`
      : `ค่าน้ำประปา${waterMeterText} ${waterUnits} หน่วย × ${invoiceData.water_rate} บาท`,
    quantity: 1,
    price: waterAmount,
    total: waterAmount
  });
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

  // ✅ ใช้ค่าจาก invoiceData แทน hardcode
  const buildingLogo = invoiceData?.recipient?.building_logo || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
  const buildingName = invoiceData?.recipient?.building_name || '';

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      {/* Print Styles - ปรับปรุงสำหรับ A4 */}
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
          
          /* ลดขนาด font ทั้งหมด */
          h1, h2, h3 { font-size: 14px !important; }
          p, span, td, th { font-size: 10px !important; }
          .text-lg { font-size: 12px !important; }
          .text-xl { font-size: 14px !important; }
          .text-2xl { font-size: 16px !important; }
          .text-xs { font-size: 9px !important; }
          .text-sm { font-size: 10px !important; }
          
          /* ลดระยะห่าง */
          .mb-4, .mb-5 { margin-bottom: 8px !important; }
          .mb-3 { margin-bottom: 6px !important; }
          .p-3 { padding: 6px !important; }
          .p-2 { padding: 4px !important; }
          .py-2 { padding-top: 4px !important; padding-bottom: 4px !important; }
          .gap-3 { gap: 6px !important; }
          .gap-4 { gap: 8px !important; }
          
          /* ลดขนาดโลโก้ */
          .w-10 { width: 28px !important; }
          .h-10 { height: 28px !important; }
          .h-12 { height: 32px !important; }
        }
        
        /* สำหรับหน้าจอ - ให้เห็นเป็น A4 */
        @media screen {
          .invoice-container {
            width: 210mm;
            min-height: 297mm;
          }
        }
      `}</style>

      {/* Sticky Header with Action Buttons */}
      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-between items-center gap-2">
          <Button
            onClick={() => navigate(-1)}
            size="sm"
            variant="ghost"
            className="gap-1"
          >
            <ArrowLeft className="w-4 h-4" />
            ย้อนกลับ
          </Button>
          <div className="flex gap-2">
            {invoiceData?.invoice_image_url && (
              <a 
                href={invoiceData.invoice_image_url} 
                target="_blank" 
                rel="noopener noreferrer"
                download
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 text-xs border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  <Download className="w-3 h-3" />
                  ดาวน์โหลดรูปภาพ
                </Button>
              </a>
            )}
            <Button
              onClick={handleDownloadImage}
              size="sm"
              variant="default"
              className="gap-2 text-sm bg-blue-600 hover:bg-blue-700 px-4 py-2 active:scale-95 transition-transform"
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
      </div>

      {/* Invoice Content - ปรับให้พอดี A4 */}
      <div className="invoice-container mx-auto p-1 md:p-4 print:p-0 max-w-[380px] md:max-w-[800px]">
        <div className="invoice-card bg-white rounded-lg shadow-xl print:shadow-none overflow-hidden" ref={invoiceRef}>
          <div className="p-1.5 md:p-4 print:p-3">
            {/* Header Section */}
            <div className="mb-1 md:mb-2 pb-1 md:pb-1.5 border-b border-slate-200">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1 md:gap-1.5">
                  <img
                    src={buildingLogo}
                    alt={`${buildingName} Logo`}
                    className="w-6 h-6 md:w-8 md:h-8 object-contain"
                    onError={(e) => {
                      e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
                    }}
                  />
                  <h1 className="text-[9px] md:text-sm font-bold text-slate-800 truncate">{buildingName}</h1>
                </div>
                <div className="text-right">
                  <h2 className="text-[9px] md:text-sm font-bold text-orange-600">
                    ใบแจ้งหนี้
                  </h2>
                  <p className="text-[8px] md:text-[10px] text-orange-600">
                    Invoice
                  </p>
                </div>
              </div>
              
              {/* ข้อมูลบริษัทใต้โลโก้ */}
              <div className="text-[7.5px] md:text-[9px] text-slate-600 mt-0.5 md:mt-1 space-y-0 leading-tight">
                {invoiceData.recipient?.company_name ? (
                  <>
                    <p className="font-medium text-slate-800 truncate text-[7.5px] md:text-[9px]">{invoiceData.recipient.company_name}</p>
                      {invoiceData.recipient.tax_id && <p className="text-[7.5px] md:text-[9px]">ผู้เสียภาษี: {invoiceData.recipient.tax_id}</p>}
                      {invoiceData.recipient.company_registration_number && <p className="text-[7.5px] md:text-[9px]">ทะเบียน: {invoiceData.recipient.company_registration_number}</p>}
                      <p className="text-[7.5px] md:text-[9px] line-clamp-1">{invoiceData.recipient?.company_address || invoiceData.recipient?.building_address}</p>
                  </>
                ) : invoiceData.recipient?.lessor_name ? (
                  <>
                    <p className="font-medium text-slate-800 truncate text-[7.5px] md:text-[9px]">{invoiceData.recipient.lessor_name}</p>
                    {invoiceData.recipient.lessor_id && <p className="text-[7.5px] md:text-[9px]">ผู้เสียภาษี: {invoiceData.recipient.lessor_id}</p>}
                    <p className="text-[7.5px] md:text-[9px] line-clamp-1">{invoiceData.recipient?.lessor_address || invoiceData.recipient?.building_address}</p>
                    {invoiceData.recipient?.building_phone && <p>เบอร์ติดต่อ: {invoiceData.recipient.building_phone}</p>}
                  </>
                ) : invoiceData.recipient?.building_address ? (
                  <>
                    <p>{invoiceData.recipient.building_address}</p>
                    {invoiceData.recipient?.building_phone && <p>เบอร์ติดต่อ: {invoiceData.recipient.building_phone}</p>}
                  </>
                ) : null}
              </div>
            </div>

            {/* Invoice Info */}
            <div className="grid grid-cols-2 gap-1 md:gap-1.5 mb-1 md:mb-2 p-1 md:p-1.5 bg-slate-50 rounded">
              <div>
                <p className="text-[7.5px] md:text-[8px] text-slate-500 mb-0">เลขที่ใบแจ้งหนี้</p>
                <p className="font-bold text-[9px] md:text-xs text-slate-800">{invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-[7.5px] md:text-[8px] text-slate-500 mb-0">วันครบกำหนด</p>
                <p className="font-bold text-[9px] md:text-xs text-slate-800 line-clamp-1">{dueDate}</p>
              </div>
            </div>



            {/* Payer & Payee Info */}
            <div className="grid grid-cols-2 gap-1 md:gap-1.5 mb-1 md:mb-2">
              {/* ผู้รับเงิน */}
              <div className="border border-slate-200 rounded p-1 md:p-1.5">
                <h3 className="font-semibold text-slate-700 text-[8px] md:text-[9px] mb-0.5">ผู้รับเงิน</h3>
                <div className="text-[7px] md:text-[8px] text-slate-600 space-y-0">
                  {invoiceData.recipient?.company_name ? (
                    <>
                      <p className="font-medium text-slate-800 truncate text-[7px]">{invoiceData.recipient.company_name}</p>
                      {invoiceData.recipient.tax_id && <p className="text-[7px]">ผู้เสียภาษี: {invoiceData.recipient.tax_id}</p>}
                      <p className="text-[7px] line-clamp-1">{invoiceData.recipient?.company_address || invoiceData.recipient?.building_address}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-slate-800 truncate text-[7px]">{invoiceData.recipient?.lessor_name || invoiceData.recipient?.building_name}</p>
                      {invoiceData.recipient?.lessor_id && <p className="text-[7px]">ผู้เสียภาษี: {invoiceData.recipient.lessor_id}</p>}
                      <p className="text-[7px] line-clamp-1">{invoiceData.recipient?.lessor_address || invoiceData.recipient?.building_address}</p>
                    </>
                  )}
                </div>
              </div>

              {/* ผู้จ่ายเงิน */}
              <div className="border border-slate-200 rounded p-1 md:p-1.5">
                <h3 className="font-semibold text-slate-700 text-[8px] md:text-[9px] mb-0.5">ผู้จ่ายเงิน</h3>
                <div className="text-[7px] md:text-[8px] text-slate-600 space-y-0">
                  <p className="font-medium text-slate-800 truncate text-[7px]">{invoiceData.tenant?.full_name || 'ไม่ระบุ'}</p>
                  <p className="text-[7px]">ห้อง: {invoiceData.room?.room_number || '-'} | โทร: {invoiceData.tenant?.phone || '-'}</p>
                  <p className="text-[7px] line-clamp-1">ที่อยู่: {invoiceData.tenant?.address && invoiceData.tenant.address !== 'ไม่ระบุ' && invoiceData.tenant.address !== '-' ? invoiceData.tenant.address : '-'}</p>
                </div>
              </div>
            </div>

            {/* Invoice Items Table */}
            <div className="mb-1 md:mb-2">
              <table className="w-full text-[7.5px] md:text-[9px] border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-300">
                    <th className="text-left py-0.5 md:py-1.5 px-1 md:px-1.5 font-bold text-slate-700 w-5 md:w-10">ลำดับ</th>
                    <th className="text-left py-0.5 md:py-1.5 px-1 md:px-1.5 font-bold text-slate-700">รายการ</th>
                    <th className="text-right py-0.5 md:py-1.5 px-1 md:px-1.5 font-bold text-slate-700">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={index} className="border-b border-slate-200">
                      <td className="py-0.5 md:py-1 px-1 md:px-1.5 text-center text-slate-600 text-[7px] md:text-[8px]">{index + 1}</td>
                      <td className="py-0.5 md:py-1 px-1 md:px-1.5 text-slate-800 text-[7px] md:text-[8px]">{item.name}</td>
                      <td className="py-0.5 md:py-1 px-1 md:px-1.5 text-right font-bold text-slate-800 text-[7px] md:text-[8px]">
                        {(item.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total Amount & Stamp */}
            <div className="mb-1 md:mb-1.5 border-t border-slate-300 pt-1 md:pt-1.5">
              <div className="flex justify-between items-center gap-2">
                <div className="text-[8px] md:text-xs text-slate-600">
                  <span className="font-medium">ยอดเงินสุทธิ</span>
                </div>
                <div className="flex items-center gap-1.5 md:gap-2">
                  <span className="text-[9px] md:text-sm font-bold text-slate-800">
                    {(invoiceData.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                  {/* ตราประทับ */}
                  {isPaid ? (
                    <div className="border border-green-600 rounded px-1 md:px-2 py-0.5 text-center text-[8px] md:text-[9px] transform rotate-[-3deg]">
                      <p className="font-bold text-green-700">✓ ชำระ</p>
                    </div>
                  ) : isOverdue ? (
                    <div className="border border-red-500 rounded px-1 md:px-2 py-0.5 text-center text-[8px] md:text-[9px] transform rotate-[-3deg]">
                      <p className="font-bold text-red-600">เกิน</p>
                    </div>
                  ) : (
                    <div className="border border-orange-500 rounded px-1 md:px-2 py-0.5 text-center text-[8px] md:text-[9px] transform rotate-[-3deg]">
                      <p className="font-bold text-orange-600">รอชำระ</p>
                    </div>
                  )}
                  </div>
                  </div>
                  <p className="text-[7px] md:text-[8px] text-slate-500 mt-0.5">({numberToThaiText(invoiceData.total_amount || 0)})</p>
            </div>

            {/* Payment Method & Notes - แบบเรียบง่าย */}
            <div className="mb-1 md:mb-1.5 text-[7px] md:text-[8px] text-slate-500 leading-tight">
              <span className="font-medium text-slate-600">ชำระผ่าน:</span> {invoiceData.bank?.name || '-'}
              {invoiceData.bank?.account_number && (
                <span> | {invoiceData.bank.account_number}</span>
              )}
              {invoiceData.bank?.account_name && (
                <span> ({invoiceData.bank.account_name})</span>
              )}
            </div>

            {/* Signature Section */}
            <div className="grid grid-cols-3 gap-0.5 md:gap-1 mt-1 md:mt-2 pt-1 md:pt-1.5 border-t border-slate-200">
              <div className="text-center">
                <div className="h-4 md:h-8 border-b border-slate-300 mb-0.5"></div>
                <p className="text-[7px] md:text-[8px] text-slate-600">ผู้จัดทำ</p>
              </div>
              <div className="text-center">
                <div className="h-4 md:h-8 border-b border-slate-300 mb-0.5"></div>
                <p className="text-[7px] md:text-[8px] text-slate-600">ผู้อนุมัติ</p>
              </div>
              <div className="text-center">
                <div className="h-4 md:h-8 border-b border-slate-300 mb-0.5"></div>
                <p className="text-[7px] md:text-[8px] text-slate-600">ผู้รับเงิน</p>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-0.5 md:pt-1 text-center">
              <p className="text-[7px] text-slate-500">ขอบคุณที่ใช้บริการ <span className="hidden md:inline">{invoiceData.recipient?.building_name || buildingName}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}