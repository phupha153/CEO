import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Loader2, AlertCircle, Clock, CheckCircle, Zap, Droplets, CreditCard, Home } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import html2canvas from "html2canvas";
import { motion } from "framer-motion";

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
  const branchId = searchParams.get("branchId") || searchParams.get("branch");
  const invoiceRef = useRef();
  
  const [invoiceData, setInvoiceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [downloading, setDownloading] = useState(false);

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
  const elecMeterText = invoiceData.electricity_previous !== undefined && invoiceData.electricity_current !== undefined 
    ? ` (${invoiceData.electricity_previous}-${invoiceData.electricity_current})` 
    : '';

  lineItems.push({
    name: `ค่าไฟฟ้า${elecMeterText} ใช้ ${elecUnits} หน่วย${isElecMinimum && elecUnits > 0 ? ' - คิดขั้นต่ำ' : ''}${elecAmount === 0 && elecUnits > 0 ? ' (ไม่คิดค่าบริการ)' : ''}`,
    quantity: 1,
    price: elecAmount,
    total: elecAmount
  });
  
  // ⭐ แสดงค่าน้ำเสมอ (แม้เป็น 0 บาท) เพื่อให้เห็นหน่วยที่ใช้
  const waterUnits = invoiceData.water_units || 0;
  const waterAmount = invoiceData.water_amount || 0;
  const calculatedWaterAmount = waterUnits * (invoiceData.water_rate || 0);
  const isWaterMinimum = waterUnits === 0 || Math.abs(calculatedWaterAmount - waterAmount) > 0.01;
  const waterMeterText = invoiceData.water_previous !== undefined && invoiceData.water_current !== undefined 
    ? ` (${invoiceData.water_previous}-${invoiceData.water_current})` 
    : '';

  lineItems.push({
    name: `ค่าน้ำประปา${waterMeterText} ใช้ ${waterUnits} หน่วย${isWaterMinimum && waterUnits > 0 ? ' - คิดขั้นต่ำ' : ''}${waterAmount === 0 && waterUnits > 0 ? ' (ไม่คิดค่าบริการ)' : ''}`,
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

  const buildingLogo = invoiceData?.recipient?.building_logo || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
  const buildingName = invoiceData?.recipient?.building_name || '';

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <style>{`
        @media print {
          body, html {
            width: 9.5in !important;
            height: 11in !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @page {
            size: 9.5in 11in;
            margin: 0;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          
          .invoice-container {
            width: 9.5in !important;
            height: 11in !important;
            margin: 0 !important;
            padding: 0.25in 0.5in !important;
            background: white !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            page-break-after: avoid !important;
            page-break-before: avoid !important;
          }
          
          .invoice-card {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            height: 100% !important;
          }
        }
        
        @media screen {
          .invoice-container {
            width: 9.5in;
            min-height: 11in;
            max-width: 100%;
          }
        }
      `}</style>

      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex justify-end items-center gap-2">
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

      <div className="invoice-container mx-auto p-2 md:p-8 print:p-0">
        {/* Summary Cards - Payments Style */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:hidden">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-600 opacity-5" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 opacity-10 blur-3xl" />
              
              <CardContent className="p-4 md:p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl blur-md opacity-30" />
                    <div className="relative p-3 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 shadow-lg">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-500 mb-1">ค่าไฟฟ้า</p>
                <motion.p 
                  className="text-3xl font-bold text-slate-800"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  {(invoiceData.electricity_amount || 0).toLocaleString('th-TH')}
                </motion.p>
                <p className="text-xs text-slate-500 mt-1">{invoiceData.electricity_units || 0} หน่วย</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 opacity-5" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400 to-cyan-500 opacity-10 blur-3xl" />
              
              <CardContent className="p-4 md:p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl blur-md opacity-30" />
                    <div className="relative p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg">
                      <Droplets className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-500 mb-1">ค่าน้ำประปา</p>
                <motion.p 
                  className="text-3xl font-bold text-slate-800"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  {(invoiceData.water_amount || 0).toLocaleString('th-TH')}
                </motion.p>
                <p className="text-xs text-slate-500 mt-1">{invoiceData.water_units || 0} หน่วย</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
          >
            <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600 opacity-5" />
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400 to-indigo-500 opacity-10 blur-3xl" />
              
              <CardContent className="p-4 md:p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl blur-md opacity-30" />
                    <div className="relative p-3 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
                      <Home className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-500 mb-1">ค่าเช่า</p>
                <motion.p 
                  className="text-3xl font-bold text-slate-800"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  {(invoiceData.rent_amount || 0).toLocaleString('th-TH')}
                </motion.p>
                <p className="text-xs text-slate-500 mt-1">บาท</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
          >
            <Card className={`relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl ${isOverdue ? 'ring-2 ring-red-500' : ''}`}>
              <div className={`absolute inset-0 bg-gradient-to-br ${isOverdue ? 'from-red-500 to-red-600' : 'from-green-500 to-emerald-600'} opacity-5`} />
              <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${isOverdue ? 'from-red-400 to-red-500' : 'from-green-400 to-emerald-500'} opacity-10 blur-3xl`} />
              
              <CardContent className="p-4 md:p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="relative">
                    <div className={`absolute inset-0 bg-gradient-to-br ${isOverdue ? 'from-red-500 to-red-600' : 'from-green-500 to-emerald-600'} rounded-2xl blur-md opacity-30`} />
                    <div className={`relative p-3 rounded-2xl bg-gradient-to-br ${isOverdue ? 'from-red-500 to-red-600' : 'from-green-500 to-emerald-600'} shadow-lg`}>
                      <CreditCard className="w-6 h-6 text-white" />
                    </div>
                  </div>
                </div>
                <p className="text-sm font-medium text-slate-500 mb-1">ยอดรวมทั้งสิ้น</p>
                <motion.p 
                  className="text-3xl font-bold text-slate-800"
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  {(invoiceData.total_amount || 0).toLocaleString('th-TH')}
                </motion.p>
                <p className="text-xs text-slate-500 mt-1">บาท</p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <div className="invoice-card bg-white rounded-lg shadow-xl print:shadow-none overflow-hidden" ref={invoiceRef}>
          <div className="p-3 md:p-8 print:p-5">
            <div className="mb-2 md:mb-4 pb-2 md:pb-3 border-b border-slate-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <img
                    src={buildingLogo}
                    alt={`${buildingName} Logo`}
                    className="w-7 h-7 md:w-10 md:h-10 object-contain"
                    onError={(e) => {
                      e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
                    }}
                  />
                  <h1 className="text-sm md:text-lg font-bold text-slate-800">{buildingName}</h1>
                </div>
                <div className="text-right">
                  <h2 className="text-sm md:text-lg font-bold text-orange-600">ใบแจ้งหนี้</h2>
                  <p className="text-[9px] md:text-xs text-orange-600">Invoice</p>
                </div>
              </div>
              
              <div className="text-[9px] md:text-xs text-slate-600 mt-1.5 md:mt-2 space-y-0 md:space-y-0.5">
                {invoiceData.recipient?.company_name ? (
                  <>
                    <p className="font-medium text-slate-800">{invoiceData.recipient.company_name}</p>
                    {invoiceData.recipient.tax_id && <p>เลขที่ผู้เสียภาษี: {invoiceData.recipient.tax_id}</p>}
                    {invoiceData.recipient.company_registration_number && <p>เลขทะเบียนนิติบุคคล: {invoiceData.recipient.company_registration_number}</p>}
                    <p>{invoiceData.recipient?.company_address || invoiceData.recipient?.building_address}</p>
                    {invoiceData.recipient?.company_phone && <p>เบอร์ติดต่อ: {invoiceData.recipient.company_phone}</p>}
                  </>
                ) : invoiceData.recipient?.lessor_name ? (
                  <>
                    <p className="font-medium text-slate-800">{invoiceData.recipient.lessor_name}</p>
                    {invoiceData.recipient.lessor_id && <p>เลขประจำตัวผู้เสียภาษี: {invoiceData.recipient.lessor_id}</p>}
                    <p>{invoiceData.recipient?.lessor_address || invoiceData.recipient?.building_address}</p>
                    {invoiceData.recipient?.lessor_phone && <p>เบอร์ติดต่อ: {invoiceData.recipient.lessor_phone}</p>}
                  </>
                ) : invoiceData.recipient?.building_address ? (
                  <>
                    <p>{invoiceData.recipient.building_address}</p>
                    {invoiceData.recipient?.building_phone && <p>โทร: {invoiceData.recipient.building_phone}</p>}
                  </>
                ) : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 md:gap-3 mb-2 md:mb-5 p-2 md:p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-[9px] md:text-xs text-slate-500 mb-0.5 md:mb-1">เลขที่ใบแจ้งหนี้</p>
                <p className="font-bold text-[11px] md:text-base text-slate-800">{invoiceNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] md:text-xs text-slate-500 mb-0.5 md:mb-1">วันครบกำหนด</p>
                <p className="font-bold text-[11px] md:text-base text-slate-800">{dueDate}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5 md:gap-3 mb-2 md:mb-4">
              <div className="border border-slate-200 rounded p-1.5 md:p-2">
                <h3 className="font-semibold text-slate-700 text-[9px] md:text-xs mb-0.5 md:mb-1">ผู้รับเงิน</h3>
                <div className="text-[8px] md:text-xs text-slate-600 space-y-0 md:space-y-0.5">
                  {invoiceData.recipient?.company_name ? (
                    <>
                      <p className="font-medium text-slate-800">{invoiceData.recipient.company_name}</p>
                      {invoiceData.recipient.tax_id && <p>เลขประจำตัวผู้เสียภาษี: {invoiceData.recipient.tax_id}</p>}
                      {invoiceData.recipient?.company_address && <p>{invoiceData.recipient.company_address}</p>}
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-slate-800">{invoiceData.recipient?.lessor_name || invoiceData.recipient?.building_name}</p>
                      {invoiceData.recipient?.lessor_id && <p>เลขประจำตัวผู้เสียภาษี: {invoiceData.recipient.lessor_id}</p>}
                      <p>{invoiceData.recipient?.lessor_address || invoiceData.recipient?.building_address}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded p-1.5 md:p-2">
                <h3 className="font-semibold text-slate-700 text-[9px] md:text-xs mb-0.5 md:mb-1">ผู้จ่ายเงิน</h3>
                <div className="text-[8px] md:text-xs text-slate-600 space-y-0 md:space-y-0.5">
                  <p className="font-medium text-slate-800">{invoiceData.tenant?.full_name || 'ไม่ระบุ'}</p>
                  <p>ห้อง: {invoiceData.room?.room_number || 'N/A'} | โทร: {invoiceData.tenant?.phone || 'ไม่ระบุ'}</p>
                  <p>ที่อยู่: {invoiceData.tenant?.address && invoiceData.tenant.address !== 'ไม่ระบุ' && invoiceData.tenant.address !== '-' ? invoiceData.tenant.address : 'ไม่ระบุ'}</p>
                </div>
              </div>
            </div>

            <div className="mb-2 md:mb-5">
              <table className="w-full text-[9px] md:text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b md:border-b-2 border-slate-300">
                    <th className="text-left py-1 md:py-2.5 px-1 md:px-2 font-bold text-slate-700 w-6 md:w-12">ลำดับ</th>
                    <th className="text-left py-1 md:py-2.5 px-1 md:px-2 font-bold text-slate-700">รายการ</th>
                    <th className="text-right py-1 md:py-2.5 px-1 md:px-2 font-bold text-slate-700">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((item, index) => (
                    <tr key={index} className="border-b border-slate-200 md:hover:bg-slate-50">
                      <td className="py-1 md:py-2 px-1 md:px-2 text-center text-slate-600">{index + 1}</td>
                      <td className="py-1 md:py-2 px-1 md:px-2 text-slate-800">{item.name}</td>
                      <td className="py-1 md:py-2 px-1 md:px-2 text-right font-bold text-slate-800">
                        {(item.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mb-2 md:mb-4 border-t-2 border-slate-300 pt-2 md:pt-3">
              <div className="flex justify-between items-center">
                <div className="text-[9px] md:text-sm text-slate-600">
                  <span className="font-medium">ยอดเงินสุทธิ</span>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-sm md:text-lg font-bold text-slate-800">
                    {(invoiceData.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                  {isPaid ? (
                    <div className="border-2 border-green-600 rounded px-1.5 md:px-2.5 py-0.5 md:py-1 text-center transform rotate-[-3deg]">
                      <p className="text-[9px] md:text-xs font-bold text-green-700">✓ ชำระ<span className="hidden md:inline">แล้ว</span></p>
                      <p className="text-[8px] md:text-[9px] text-green-600 hidden md:block">{paymentDate}</p>
                    </div>
                  ) : isOverdue ? (
                    <div className="border-2 border-red-500 rounded px-1.5 md:px-2.5 py-0.5 md:py-1 text-center transform rotate-[-3deg]">
                      <p className="text-[9px] md:text-xs font-bold text-red-600 flex items-center gap-0.5 md:gap-1">
                        <AlertCircle className="w-2.5 h-2.5 md:w-3 md:h-3" /> เกินกำหนด
                      </p>
                      <p className="text-[8px] md:text-[9px] text-red-500 hidden md:block">{daysOverdue} วัน</p>
                    </div>
                  ) : (
                    <div className="border-2 border-orange-500 rounded px-1.5 md:px-2.5 py-0.5 md:py-1 text-center transform rotate-[-3deg]">
                      <p className="text-[9px] md:text-xs font-bold text-orange-600 flex items-center gap-0.5 md:gap-1">
                        <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" /> รอชำระ
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[8px] md:text-xs text-slate-500 mt-1 md:mt-0 md:inline md:ml-2">({numberToThaiText(invoiceData.total_amount || 0)})</p>
            </div>

            <div className="mb-2 md:mb-3 text-[8px] md:text-xs text-slate-500 leading-tight">
              <span className="font-medium text-slate-600">ชำระผ่าน:</span> {invoiceData.bank?.name}
              {invoiceData.bank?.account_number && (
                <> | {invoiceData.bank.account_number}</>
              )}
              {invoiceData.bank?.account_name && (
                <> ({invoiceData.bank.account_name})</>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 md:gap-4 mt-2 md:mt-5 pt-2 md:pt-3 border-t border-slate-200">
              <div className="text-center">
                <div className="h-6 md:h-12 border-b border-slate-300 mb-0.5 md:mb-1"></div>
                <p className="text-[8px] md:text-xs text-slate-600">ผู้จัดทำ</p>
              </div>
              <div className="text-center">
                <div className="h-6 md:h-12 border-b border-slate-300 mb-0.5 md:mb-1"></div>
                <p className="text-[8px] md:text-xs text-slate-600">ผู้อนุมัติ</p>
              </div>
              <div className="text-center">
                <div className="h-6 md:h-12 border-b border-slate-300 mb-0.5 md:mb-1"></div>
                <p className="text-[8px] md:text-xs text-slate-600">ผู้รับเงิน</p>
              </div>
            </div>

            <div className="pt-2 md:pt-4 text-center">
              <p className="text-[8px] md:text-xs text-slate-500">ขอบคุณที่ใช้บริการ <span className="hidden md:inline">{invoiceData.recipient?.building_name || buildingName}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}