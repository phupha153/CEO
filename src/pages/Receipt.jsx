import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, CheckCircle, RefreshCw, Building2, Users, ArrowLeft } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";
import html2canvas from "html2canvas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ⭐ Note: ใช้ค่าปรับจาก backend (late_fee_amount) แทนการคำนวณเอง
// ค่าปรับถูก lock ไว้ ณ เวลาที่ยืนยันชำระแล้ว

// ✅ เพิ่มฟังก์ชันแปลงตัวเลขเป็นตัวหนังสือไทย
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

export default function Receipt() {
  const [searchParams] = useSearchParams();
  const paymentId = searchParams.get('paymentId');
  const navigate = useNavigate();

  const [receiptData, setReceiptData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [configs, setConfigs] = useState([]);
  const [showDebug, setShowDebug] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const receiptRef = useRef(null);

  // ⭐ ดึงข้อมูล User เพื่อเช็ค role
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
  });
  const isDeveloper = currentUser?.role === 'admin' || currentUser?.custom_role === 'developer';

  const fetchReceipt = async () => {
    if (!paymentId) {
      setError('ไม่พบเลขที่ใบเสร็จ (ไม่มี paymentId)');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    console.log('Fetching receipt for paymentId:', paymentId);

    const timeoutId = setTimeout(() => {
      setError('การโหลดข้อมูลใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง');
      setLoading(false);
      console.error('Timeout: Receipt fetch took too long');
    }, 15000);

    try {
      // ⭐ ดึง configs เพื่อคำนวณค่าปรับ
      const configsData = await base44.entities.Config.list();
      setConfigs(configsData);
      
      console.log('Calling getPublicInvoice via base44.functions.invoke');
      const response = await base44.functions.invoke('getPublicInvoice', { 
        paymentId: paymentId 
      });

      clearTimeout(timeoutId);
      console.log('Receipt response:', response.data);

      if (response.data.success) {
        const invoice = response.data.invoice;
        setReceiptData(invoice);
        setLoading(false);
      } else {
        clearTimeout(timeoutId);
        const errorMsg = response.data.error || 'ไม่พบข้อมูลใบเสร็จ';
        console.error('Receipt fetch failed:', errorMsg);
        setError(errorMsg);
        setLoading(false);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Error fetching receipt:', err);
      
      let errorMessage = 'เกิดข้อผิดพลาดในการโหลดใบเสร็จ';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipt();
  }, [paymentId]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-sm w-full">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold text-slate-700 mb-2">
            กำลังโหลดใบเสร็จ...
          </p>
          <p className="text-sm text-slate-500">Payment ID: {paymentId?.slice(0, 8)}...</p>
        </Card>
      </div>
    );
  }

  if (error || !receiptData) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <p className="text-lg font-semibold text-slate-800 mb-3">{error || 'ไม่พบข้อมูลใบเสร็จ'}</p>
          <div className="text-sm text-slate-600 mb-6 space-y-1">
            <p>Payment ID: {paymentId}</p>
            <p className="text-xs">กรุณาตรวจสอบว่า:</p>
            <ul className="text-xs text-left list-disc list-inside">
              <li>รายการนี้ได้ชำระเงินแล้ว</li>
              <li>ลิงก์ที่ใช้เปิดถูกต้อง</li>
              <li>อินเทอร์เน็ตเชื่อมต่อปกติ</li>
            </ul>
          </div>
          <div className="flex gap-2 justify-center">
            <Button onClick={fetchReceipt} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              ลองใหม่อีกครั้ง
            </Button>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              ย้อนกลับ
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const receiptNumber = `REC-${receiptData.id.slice(0, 8).toUpperCase()}`;
  const paymentDate = receiptData.payment_date 
    ? format(parseISO(receiptData.payment_date), 'd MMMM yyyy', { locale: th })
    : format(new Date(), 'd MMMM yyyy', { locale: th });

  // ⭐ ใช้ค่าปรับที่ lock ไว้แล้ว (ไม่คำนวณใหม่)
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
  
  // ⭐ แสดงค่าไฟเสมอ (แม้เป็น 0 บาท) เพื่อให้เห็นหน่วยที่ใช้
  const elecUnits = receiptData.electricity_units || 0;
  const elecAmount = receiptData.electricity_amount || 0;
  const calculatedElecAmount = elecUnits * (receiptData.electricity_rate || 0);
  const isElecMinimum = elecUnits === 0 || Math.abs(calculatedElecAmount - elecAmount) > 0.01;
  const elecMeterText = (receiptData.electricity_previous || receiptData.electricity_current) 
    ? ` (${receiptData.electricity_previous}-${receiptData.electricity_current})` 
    : '';

  lineItems.push({
    name: isElecMinimum 
      ? `ค่าไฟฟ้า${elecMeterText} ใช้ ${elecUnits} หน่วย${elecAmount === 0 ? '' : ' - คิดขั้นต่ำ'}`
      : `ค่าไฟฟ้า${elecMeterText} ${elecUnits} หน่วย × ${receiptData.electricity_rate} บาท`,
    quantity: 1,
    price: elecAmount,
    total: elecAmount
  });
  
  // ⭐ แสดงค่าน้ำเสมอ (แม้เป็น 0 บาท) เพื่อให้เห็นหน่วยที่ใช้
  const waterUnits = receiptData.water_units || 0;
  const waterAmount = receiptData.water_amount || 0;
  const calculatedWaterAmount = waterUnits * (receiptData.water_rate || 0);
  const isWaterMinimum = waterUnits === 0 || Math.abs(calculatedWaterAmount - waterAmount) > 0.01;
  const waterMeterText = (receiptData.water_previous || receiptData.water_current) 
    ? ` (${receiptData.water_previous}-${receiptData.water_current})` 
    : '';

  lineItems.push({
    name: isWaterMinimum 
      ? `ค่าน้ำประปา${waterMeterText} ใช้ ${waterUnits} หน่วย${waterAmount === 0 ? '' : ' - คิดขั้นต่ำ'}`
      : `ค่าน้ำประปา${waterMeterText} ${waterUnits} หน่วย × ${receiptData.water_rate} บาท`,
    quantity: 1,
    price: waterAmount,
    total: waterAmount
  });
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
  const buildingName = receiptData?.recipient?.building_name || '';

  // Debug info - เพิ่มข้อมูลดิบจาก API
  const debugInfo = {
    paymentId: receiptData?.id,
    branchId: receiptData?.branch_id,
    branchIdType: typeof receiptData?.branch_id,
    branchIdIsUndefined: receiptData?.branch_id === undefined,
    branchIdIsNull: receiptData?.branch_id === null,
    status: receiptData?.status,
    payment_late_fee_amount: receiptData?.late_fee_amount,
    display_late_fee: displayLateFee,
    daysOverdue: receiptData?.due_date ? differenceInDays(new Date(), parseISO(receiptData.due_date)) : 0,
    configs_for_branch: configs.filter(c => 
      c.branch_id === receiptData?.branch_id && c.key === 'late_payment_fee_per_day'
    ),
    configs_global: configs.filter(c => 
      !c.branch_id && c.key === 'late_payment_fee_per_day'
    ),
    all_late_fee_configs: configs.filter(c => c.key === 'late_payment_fee_per_day'),
    raw_response_keys: receiptData ? Object.keys(receiptData) : [],
    full_receiptData: receiptData
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Debug Dialog - Developer Only */}
      {isDeveloper && (
        <Dialog open={showDebug} onOpenChange={setShowDebug}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>🐛 Debug ข้อมูลค่าปรับ</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="bg-purple-100 p-3 rounded border-2 border-purple-300">
                <p className="font-bold mb-2 text-purple-800">🔍 ข้อมูลดิบจาก API Response:</p>
                <p>• Branch ID: <span className={debugInfo.branchIdIsUndefined ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>{debugInfo.branchId || '❌ undefined/null'}</span></p>
                <p>• Type: {debugInfo.branchIdType}</p>
                <p>• Is undefined? {debugInfo.branchIdIsUndefined ? '✅ YES (ปัญหา!)' : '❌ NO'}</p>
                <p>• Is null? {debugInfo.branchIdIsNull ? '✅ YES' : '❌ NO'}</p>
                <p className="mt-2 font-semibold">Keys in response:</p>
                <p className="text-xs bg-white p-2 rounded">{debugInfo.raw_response_keys.join(', ')}</p>
              </div>

              <div className="bg-slate-100 p-3 rounded">
                <p className="font-bold mb-2">ข้อมูล Payment:</p>
                <p>• ID: {debugInfo.paymentId}</p>
                <p>• Branch ID: {debugInfo.branchId}</p>
                <p>• Status: {debugInfo.status}</p>
                <p>• ค่าปรับที่บันทึก (late_fee_amount): {debugInfo.payment_late_fee_amount} บาท</p>
                <p>• วันเกินกำหนด: {debugInfo.daysOverdue} วัน</p>
              </div>

              <div className="bg-yellow-100 p-3 rounded">
                <p className="font-bold mb-2">ค่าปรับที่คำนวณได้:</p>
                <p>• แสดงในบิล: {debugInfo.display_late_fee} บาท</p>
              </div>

              <div className="bg-blue-100 p-3 rounded">
                <p className="font-bold mb-2">Config สาขานี้:</p>
                {debugInfo.configs_for_branch.length > 0 ? (
                  debugInfo.configs_for_branch.map((c, i) => (
                    <div key={i} className="ml-4">
                      <p>• branch_id: {c.branch_id}</p>
                      <p>• value: {c.value} บาท/วัน</p>
                    </div>
                  ))
                ) : (
                  <p className="text-red-600">❌ ไม่มี config สำหรับสาขานี้</p>
                )}
              </div>

              <div className="bg-green-100 p-3 rounded">
                <p className="font-bold mb-2">Config ระดับ Global:</p>
                {debugInfo.configs_global.length > 0 ? (
                  debugInfo.configs_global.map((c, i) => (
                    <div key={i} className="ml-4">
                      <p>• value: {c.value} บาท/วัน</p>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500">ไม่มี global config</p>
                )}
              </div>

              <div className="bg-red-100 p-3 rounded">
                <p className="font-bold mb-2">⚠️ Config ทั้งหมดในระบบ (late_payment_fee_per_day):</p>
                {debugInfo.all_late_fee_configs.map((c, i) => (
                  <div key={i} className="ml-4 mb-2 border-b pb-1">
                    <p>• branch_id: {c.branch_id || 'null (global)'}</p>
                    <p>• value: {c.value} บาท/วัน</p>
                    <p>• id: {c.id}</p>
                  </div>
                ))}
              </div>

              <div className="bg-orange-100 p-3 rounded border-2 border-orange-400">
                <p className="font-bold mb-2 text-orange-800">📦 Full Receipt Data Object:</p>
                <pre className="text-xs bg-white p-2 rounded overflow-auto max-h-96 border">
                  {JSON.stringify(debugInfo.full_receiptData, null, 2)}
                </pre>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
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
        
        /* สำหรับหน้าจอ - จำกัดความกว้าง */
        @media screen {
          .receipt-container {
            max-width: 800px;
            width: 100%;
          }
        }
        
        /* โหมดมือถือ - ขนาด 400x420px เหมือนใบแจ้งหนี้ */
        @media screen and (max-width: 768px) {
          .receipt-container {
            max-width: 400px !important;
            width: 400px !important;
          }
          .receipt-card {
            min-height: 420px;
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
            {isDeveloper && (
              <Button
                onClick={() => setShowDebug(true)}
                size="sm"
                variant="outline"
                className="gap-2 text-xs border-purple-600 text-purple-600 hover:bg-purple-50"
              >
                🐛 Debug
              </Button>
            )}
            {receiptData?.receipt_image_url && (
              <a 
                href={receiptData.receipt_image_url} 
                target="_blank" 
                rel="noopener noreferrer"
                download
              >
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2 text-xs border-green-600 text-green-600 hover:bg-green-50"
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

      {/* Receipt Content - Responsive: มือถือ 380px, คอม 800px */}
      <div className="receipt-container mx-auto p-2 md:p-8 print:p-0 max-w-[380px] md:max-w-[800px]">
        <div ref={receiptRef} className="receipt-card bg-white rounded-lg shadow-sm border border-slate-200 print:shadow-none print:border-0 overflow-hidden">
          <div className="p-3 md:p-8 print:p-5">
            {/* Header Section - Responsive */}
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
                  <h2 className="text-sm md:text-lg font-bold text-green-600">ใบเสร็จรับเงิน</h2>
                  <p className="text-[9px] md:text-xs text-green-600">Receipt</p>
                </div>
              </div>
              {/* ข้อมูลบริษัทใต้โลโก้ */}
              <div className="text-[9px] md:text-xs text-slate-600 mt-1.5 md:mt-2 space-y-0 md:space-y-0.5">
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

            {/* Receipt Info - Responsive */}
            <div className="grid grid-cols-2 gap-2 md:gap-3 mb-2 md:mb-5 p-2 md:p-3 bg-slate-50 rounded-lg">
              <div>
                <p className="text-[9px] md:text-xs text-slate-500 mb-0.5 md:mb-1">เลขที่ใบเสร็จ</p>
                <p className="font-bold text-[11px] md:text-base text-slate-800">{receiptNumber}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] md:text-xs text-slate-500 mb-0.5 md:mb-1">วันที่ออก</p>
                <p className="font-bold text-[11px] md:text-base text-slate-800">{paymentDate}</p>
              </div>
            </div>



            {/* Payer & Payee Info - Responsive */}
            <div className="grid grid-cols-2 gap-1.5 md:gap-3 mb-2 md:mb-4">
              {/* ผู้รับเงิน */}
              <div className="border border-slate-200 rounded p-1.5 md:p-2">
                <h3 className="font-semibold text-slate-700 text-[9px] md:text-xs mb-0.5 md:mb-1">ผู้รับเงิน</h3>
                <div className="text-[8px] md:text-xs text-slate-600 space-y-0 md:space-y-0.5">
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

              {/* ผู้จ่ายเงิน */}
              <div className="border border-slate-200 rounded p-1.5 md:p-2">
                <h3 className="font-semibold text-slate-700 text-[9px] md:text-xs mb-0.5 md:mb-1">ผู้จ่ายเงิน</h3>
                <div className="text-[8px] md:text-xs text-slate-600 space-y-0 md:space-y-0.5">
                  <p className="font-medium text-slate-800">{receiptData.tenant?.full_name || 'ไม่ระบุ'}</p>
                  <p>ห้อง: {receiptData.room?.room_number || 'N/A'} | โทร: {receiptData.tenant?.phone || 'ไม่ระบุ'}</p>
                  <p>ที่อยู่: {receiptData.tenant?.address && receiptData.tenant.address !== 'ไม่ระบุ' ? receiptData.tenant.address : 'ไม่ระบุ'}</p>
                </div>
              </div>
            </div>

            {/* Receipt Items Table - Responsive */}
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

            {/* Total Amount & Stamp - Responsive */}
            <div className="mb-2 md:mb-4 border-t-2 border-slate-300 pt-2 md:pt-3">
              <div className="flex justify-between items-center">
                <div className="text-[9px] md:text-sm text-slate-600">
                  <span className="font-medium">ยอดเงินสุทธิ</span>
                </div>
                <div className="flex items-center gap-2 md:gap-3">
                  <span className="text-sm md:text-lg font-bold text-slate-800">
                    {(receiptData.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                  {/* ตราประทับชำระแล้ว */}
                  <div className="border-2 border-green-600 rounded px-1.5 md:px-2.5 py-0.5 md:py-1 text-center transform rotate-[-3deg]">
                    <p className="text-[9px] md:text-xs font-bold text-green-700">✓ ชำระแล้ว</p>
                    <p className="text-[8px] md:text-[9px] text-green-600">{paymentDate}</p>
                  </div>
                </div>
              </div>
              <p className="text-[8px] md:text-xs text-slate-500 mt-1 md:mt-0 md:inline md:ml-2">({numberToThaiText(receiptData.total_amount || 0)})</p>
            </div>

            {/* Payment Method & Notes - Responsive */}
            <div className="mb-2 md:mb-3 text-[8px] md:text-xs text-slate-500 leading-tight">
              <span className="font-medium text-slate-600">ชำระผ่าน:</span> {receiptData.bank?.name || '-'}
              {receiptData.bank?.account_number && (
                <span> | {receiptData.bank.account_number}</span>
              )}
              {receiptData.bank?.account_name && (
                <span> ({receiptData.bank.account_name})</span>
              )}
            </div>

            {/* Signature Section - Responsive */}
            <div className="flex justify-center mt-2 md:mt-5 pt-2 md:pt-3 border-t border-slate-200">
              <div className="text-center w-32 md:w-64">
                <div className="h-8 md:h-12 flex items-center justify-center mb-0.5 md:mb-1">
                  {receiptData.recipient?.receiver_signature ? (
                    <img 
                      src={receiptData.recipient.receiver_signature} 
                      alt="ลายเซ็นผู้รับเงิน" 
                      className="h-6 md:h-10 object-contain"
                    />
                  ) : (
                    <div className="h-6 md:h-10 w-full border-b border-slate-300"></div>
                  )}
                </div>
                <p className="text-[8px] md:text-xs text-slate-600">
                  ผู้รับเงิน: {receiptData.recipient?.lessor_name || receiptData.recipient?.building_name || '________________'}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-2 md:pt-4 text-center">
              <p className="text-[8px] md:text-xs text-slate-500">ขอบคุณที่ใช้บริการ <span className="hidden md:inline">{receiptData.recipient.building_name}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}