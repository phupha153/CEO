import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, CheckCircle, RefreshCw, Building2, Users, ArrowLeft } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ฟังก์ชันคำนวณค่าปรับ
function calculateLateFee(payment, configs, selectedBranchId) {
  if (!payment || !payment.due_date) return 0;
  
  // ⭐ ถ้าชำระแล้ว ให้ใช้ค่าปรับที่บันทึกไว้
  if (payment.status === 'paid') {
    return payment.late_fee_amount || 0;
  }
  
  // ⭐ ถ้ายังไม่ชำระ แต่มีค่าปรับบันทึกไว้แล้ว ให้ใช้ตามที่บันทึก
  if (payment.late_fee_amount && payment.late_fee_amount > 0) return payment.late_fee_amount;

  try {
    const dueDate = parseISO(payment.due_date);
    const today = new Date();
    const daysOverdue = differenceInDays(today, dueDate);

    if (daysOverdue <= 0) return 0;

    // ตรวจสอบว่าเปิดใช้ค่าปรับแบบขั้นบันไดหรือไม่
    const branchConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === selectedBranchId);
    const globalConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
    const tiersEnabledConfig = branchConfig || globalConfig;
    const tiersEnabled = tiersEnabledConfig?.value === 'true';

    if (tiersEnabled) {
      const branchTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && c.branch_id === selectedBranchId);
      const globalTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
      const tiersConfig = branchTiersConfig || globalTiersConfig;
      
      if (tiersConfig?.value) {
        try {
          const tiers = JSON.parse(tiersConfig.value);
          let totalFee = 0;

          for (const tier of tiers) {
            const daysFrom = tier.days_from || 1;
            const daysTo = tier.days_to || 999;
            const feePerDay = parseFloat(tier.fee_per_day || 0);

            if (daysOverdue >= daysFrom) {
              const daysInThisTier = Math.min(daysOverdue, daysTo) - daysFrom + 1;
              if (daysInThisTier > 0) {
                totalFee += daysInThisTier * feePerDay;
              }
            }

            if (daysOverdue <= daysTo) break;
          }

          return totalFee;
        } catch (e) {
          console.error('Error parsing late fee tiers:', e);
        }
      }
    }

    // ค่าปรับแบบธรรมดา
    const branchLateFeeConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && c.branch_id === selectedBranchId);
    const globalLateFeeConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && !c.branch_id);
    const lateFeeConfig = branchLateFeeConfig || globalLateFeeConfig;
    const lateFeePerDay = lateFeeConfig ? parseFloat(lateFeeConfig.value) : 0;
    
    console.log('🔍 [Receipt] Late Fee Calculation:', {
      selectedBranchId,
      daysOverdue,
      branchConfig: branchLateFeeConfig?.value,
      globalConfig: globalLateFeeConfig?.value,
      selectedConfig: lateFeeConfig?.value,
      lateFeePerDay,
      totalLateFee: daysOverdue * lateFeePerDay
    });
    
    if (lateFeePerDay === 0 || isNaN(lateFeePerDay)) return 0;

    return daysOverdue * lateFeePerDay;
  } catch (error) {
    console.error('Error calculating late fee:', error);
    return 0;
  }
}

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

  const handlePrint = () => {
    window.print();
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

  // ⭐ คำนวณค่าปรับ
  const calculatedLateFee = calculateLateFee(receiptData, configs, receiptData.branch_id);
  const displayLateFee = receiptData.late_fee_amount > 0 ? receiptData.late_fee_amount : calculatedLateFee;

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
    const isElecMinimum = Math.abs(calculatedElecAmount - receiptData.electricity_amount) > 0.01;

    // แสดงมิเตอร์ก่อน-หลัง ถ้ามี
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
    const isWaterMinimum = Math.abs(calculatedWaterAmount - receiptData.water_amount) > 0.01;

    // แสดงมิเตอร์ก่อน-หลัง ถ้ามี
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

  // Debug info
  const debugInfo = {
    paymentId: receiptData?.id,
    branchId: receiptData?.branch_id,
    status: receiptData?.status,
    payment_late_fee_amount: receiptData?.late_fee_amount,
    calculated_late_fee: calculatedLateFee,
    display_late_fee: displayLateFee,
    daysOverdue: receiptData?.due_date ? differenceInDays(new Date(), parseISO(receiptData.due_date)) : 0,
    configs_for_branch: configs.filter(c => 
      c.branch_id === receiptData?.branch_id && c.key === 'late_payment_fee_per_day'
    ),
    configs_global: configs.filter(c => 
      !c.branch_id && c.key === 'late_payment_fee_per_day'
    ),
    all_late_fee_configs: configs.filter(c => c.key === 'late_payment_fee_per_day')
  };

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      {/* Debug Dialog */}
      <Dialog open={showDebug} onOpenChange={setShowDebug}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🐛 Debug ข้อมูลค่าปรับ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
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
              <p>• คำนวณใหม่: {debugInfo.calculated_late_fee} บาท</p>
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
          </div>
        </DialogContent>
      </Dialog>
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
        
        /* สำหรับหน้าจอ - ให้เห็นเป็น A4 */
        @media screen {
          .receipt-container {
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
            <Button
              onClick={() => setShowDebug(true)}
              size="sm"
              variant="outline"
              className="gap-2 text-xs border-purple-600 text-purple-600 hover:bg-purple-50"
            >
              🐛 Debug ค่าปรับ
            </Button>
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
              onClick={handlePrint}
              size="sm"
              variant="default"
              className="gap-2 text-xs bg-blue-600 hover:bg-blue-700"
            >
              <Download className="w-3 h-3" />
              พิมพ์ / บันทึก PDF
            </Button>
          </div>
        </div>
      </div>

      {/* Receipt Content - ปรับให้พอดี A4 */}
      <div className="receipt-container mx-auto p-4 md:p-8 print:p-0">
        <div className="receipt-card bg-white rounded-lg shadow-xl print:shadow-none overflow-hidden">
          <div className="p-8 print:p-5">
            {/* Header Section */}
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
              {/* ข้อมูลบริษัทใต้โลโก้ */}
              <div className="text-xs text-slate-600 mt-2 space-y-0.5">
                {receiptData.recipient?.company_name ? (
                  <>
                    <p className="font-medium text-slate-800">{receiptData.recipient.company_name}</p>
                    {receiptData.recipient.tax_id && <p>เลขที่ผู้เสียภาษี: {receiptData.recipient.tax_id}</p>}
                    {receiptData.recipient.company_registration_number && <p>เลขทะเบียนนิติบุคคล: {receiptData.recipient.company_registration_number}</p>}
                    <p>{receiptData.recipient?.company_address || receiptData.recipient?.building_address}</p>
                    {receiptData.recipient?.building_phone && <p>โทร: {receiptData.recipient.building_phone}</p>}
                  </>
                ) : receiptData.recipient?.lessor_name ? (
                  <>
                    <p className="font-medium text-slate-800">{receiptData.recipient.lessor_name}</p>
                    <p>{receiptData.recipient?.lessor_address || receiptData.recipient?.building_address}</p>
                    {receiptData.recipient?.building_phone && <p>โทร: {receiptData.recipient.building_phone}</p>}
                  </>
                ) : receiptData.recipient?.building_address ? (
                  <>
                    <p>{receiptData.recipient.building_address}</p>
                    {receiptData.recipient?.building_phone && <p>โทร: {receiptData.recipient.building_phone}</p>}
                  </>
                ) : null}
              </div>
            </div>

            {/* Receipt Info */}
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



            {/* Payer & Payee Info */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {/* ผู้รับเงิน */}
              <div className="border border-slate-200 rounded p-2">
                <h3 className="font-semibold text-slate-700 text-xs mb-1">ผู้รับเงิน</h3>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p className="font-medium text-slate-800">{receiptData.bank?.account_name || receiptData.recipient?.lessor_name || receiptData.recipient?.building_name}</p>
                                          <p>{receiptData.recipient?.lessor_address || receiptData.recipient?.building_address}</p>
                </div>
              </div>

              {/* ผู้จ่ายเงิน */}
              <div className="border border-slate-200 rounded p-2">
                <h3 className="font-semibold text-slate-700 text-xs mb-1">ผู้จ่ายเงิน</h3>
                <div className="text-xs text-slate-600 space-y-0.5">
                  <p className="font-medium text-slate-800">{receiptData.tenant?.full_name || 'ไม่ระบุ'}</p>
                  <p>ห้อง: {receiptData.room?.room_number || 'N/A'} | โทร: {receiptData.tenant?.phone || 'ไม่ระบุ'}</p>
                  <p>ที่อยู่: {receiptData.tenant?.address && receiptData.tenant.address !== 'ไม่ระบุ' ? receiptData.tenant.address : 'ไม่ระบุ'}</p>
                </div>
              </div>
            </div>

            {/* Receipt Items Table */}
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

            {/* Total Amount & Stamp */}
            <div className="mb-4 border-t-2 border-slate-300 pt-3">
              <div className="flex justify-between items-center">
                <div className="text-sm text-slate-600">
                  <span className="font-medium">ยอดเงินสุทธิ</span>
                  <span className="ml-2">({numberToThaiText((receiptData.total_amount || 0) + (displayLateFee > receiptData.late_fee_amount ? displayLateFee - receiptData.late_fee_amount : 0))})</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-800">
                    {((receiptData.total_amount || 0) + (displayLateFee > receiptData.late_fee_amount ? displayLateFee - receiptData.late_fee_amount : 0)).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                  </span>
                  {/* ตราประทับชำระแล้ว */}
                  <div className="border-2 border-green-600 rounded px-2.5 py-1 text-center transform rotate-[-3deg]">
                    <p className="text-xs font-bold text-green-700">✓ ชำระแล้ว</p>
                    <p className="text-[9px] text-green-600">{paymentDate}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Method & Notes - แบบเรียบง่าย */}
            <div className="mb-3 text-xs text-slate-500">
              <span className="font-medium text-slate-600">ชำระผ่าน:</span> {receiptData.bank.name} | {receiptData.bank.account_number} • ใบเสร็จนี้ออกให้เป็นหลักฐานการรับเงินเรียบร้อยแล้ว
            </div>

            {/* Signature Section */}
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

            {/* Footer */}
            <div className="pt-4 text-center">
              <p className="text-xs text-slate-500">ขอบคุณที่ใช้บริการ {receiptData.recipient.building_name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}