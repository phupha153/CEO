import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Loader2, CheckCircle, Printer, ArrowLeft, AlertTriangle, RefreshCw } from "lucide-react";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { createPageUrl } from "@/utils";
import { toast } from "sonner"; // Assuming sonner is used for toasts

// Helper function สำหรับ retry logic
const fetchWithRetry = async (fn, maxRetries = 3, delay = 1000) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const waitTime = delay * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${maxRetries} after ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

// Helper function สำหรับจำกัด concurrent requests
const fetchInBatches = async (items, batchSize, fetchFn) => {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(item => fetchFn(item))
    );
    results.push(...batchResults);
  }
  
  return results;
};

export default function PrintReceipts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const paymentIdsParam = searchParams.get('paymentIds');
  
  const paymentIds = useMemo(() => 
    paymentIdsParam ? paymentIdsParam.split(',') : []
  , [paymentIdsParam]);

  const [receiptsData, setReceiptsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [failedPayments, setFailedPayments] = useState([]);

  useEffect(() => {
    const fetchReceipts = async () => {
      if (paymentIds.length === 0) {
        setError('ไม่พบรายการที่ต้องการพิมพ์');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      setProgress({ current: 0, total: paymentIds.length });
      setFailedPayments([]);

      try {
        const receipts = [];
        const failed = [];

        console.log(`📊 Starting to fetch ${paymentIds.length} receipts...`);

        // ✅ ปรับลด batch size จาก 5 เป็น 3 เพื่อความเสถียร
        const results = await fetchInBatches(
          paymentIds, 
          3, // ลดจาก 5 เป็น 3 รายการต่อครั้ง
          async (paymentId) => {
            return await fetchWithRetry(
              async () => {
                console.log(`🔄 Fetching invoice for payment: ${paymentId}`);
                
                // ✅ เพิ่ม timeout protection
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Request timeout')), 15000) // 15 วินาที
                );
                
                const fetchPromise = base44.functions.invoke('getPublicInvoice', { 
                  paymentId: paymentId 
                });

                const response = await Promise.race([fetchPromise, timeoutPromise]);

                setProgress(prev => ({ ...prev, current: prev.current + 1 }));

                if (response.data && response.data.success && response.data.invoice) {
                  return { success: true, data: response.data.invoice, paymentId };
                } else {
                  const errorMsg = response.data?.error || 'ไม่พบใบเสร็จ';
                  return { 
                    success: false, 
                    error: errorMsg,
                    paymentId 
                  };
                }
              },
              3, // retry 3 ครั้ง
              3000 // เพิ่มจาก 2 เป็น 3 วินาที
            );
          }
        );

        // ✅ เพิ่ม delay 1 วินาทีระหว่างแต่ละ batch
        await new Promise(resolve => setTimeout(resolve, 1000));

        // ประมวลผลลัพธ์
        results.forEach((result, index) => {
          const paymentId = paymentIds[index];
          
          if (result.status === 'fulfilled' && result.value.success) {
            receipts.push(result.value.data);
          } else {
            const errorMsg = result.status === 'rejected' 
              ? result.reason?.message || 'เกิดข้อผิดพลาดในการโหลด'
              : result.value?.error || 'ไม่ทราบสาเหตุ';
            
            failed.push({ 
              paymentId: paymentId.slice(0, 8),
              error: errorMsg,
              fullId: paymentId // เก็บ full ID สำหรับ debug
            });
            console.error(`❌ Failed to fetch payment ${paymentId}:`, errorMsg);
          }
        });

        console.log(`📊 Results: ${receipts.length} success, ${failed.length} failed`);

        // ✅ เก็บ failed payments ลง sessionStorage
        if (failed.length > 0) {
          sessionStorage.setItem('failed_receipts', JSON.stringify(failed));
        }

        if (receipts.length === 0) {
          setError(`ไม่พบใบเสร็จที่ชำระแล้ว (${failed.length} รายการไม่สามารถโหลดได้)`);
          setFailedPayments(failed);
        } else {
          setReceiptsData(receipts);
          if (failed.length > 0) {
            setFailedPayments(failed);
            // ✅ แสดง toast แจ้งเตือนเมื่อมีรายการล้มเหลว
            toast.warning(`โหลดสำเร็จ ${receipts.length}/${paymentIds.length} รายการ`, {
              description: `มี ${failed.length} รายการที่โหลดไม่สำเร็จ`,
              duration: 5000
            });
          } else {
            toast.success(`โหลดใบเสร็จสำเร็จทั้งหมด ${receipts.length} รายการ`);
            // ✅ ล้าง sessionStorage ถ้าสำเร็จทั้งหมด
            sessionStorage.removeItem('failed_receipts');
          }
        }

        setLoading(false);
      } catch (err) {
        console.error('❌ Error fetching receipts (outer catch):', err);
        setError('เกิดข้อผิดพลาดในการโหลดใบเสร็จ: ' + err.message);
        setLoading(false);
      }
    };

    fetchReceipts();
  }, [paymentIds]);

  const handlePrint = () => {
    window.print();
  };

  const handleGoBack = () => {
    navigate(createPageUrl('AccountingData'));
  };

  const handleRetry = () => {
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-sm w-full">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-lg font-semibold text-slate-700 mb-2">กำลังโหลดใบเสร็จ...</p>
          <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-sm text-slate-500">
            โหลด {progress.current} / {progress.total} รายการ
          </p>
          <p className="text-xs text-slate-400 mt-2">
            ⚠️ กรุณาอย่าปิดหน้านี้ (อาจใช้เวลา 2-3 นาที)
          </p>
          <p className="text-xs text-blue-600 mt-1">
            💡 ระบบจะโหลดทีละ 3 รายการเพื่อความเสถียร
          </p>
        </Card>
      </div>
    );
  }

  if (error || receiptsData.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
          <p className="text-lg font-semibold text-slate-800 mb-3">{error || 'ไม่พบข้อมูลใบเสร็จ'}</p>
          
          {failedPayments.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-left max-h-96 overflow-y-auto">
              <p className="text-sm font-semibold text-red-800 mb-3">
                รายการที่โหลดไม่สำเร็จ ({failedPayments.length} รายการ):
              </p>
              <div className="space-y-2">
                {failedPayments.map((item, idx) => (
                  <div key={idx} className="text-xs bg-white p-3 rounded border border-red-100">
                    <div className="flex items-start gap-2">
                      <span className="font-mono font-semibold text-red-700 flex-shrink-0">
                        #{idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-mono text-xs text-slate-600 mb-1">
                          ID: {item.paymentId}
                        </p>
                        <p className="text-red-600 font-medium">
                          → {item.error}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs text-yellow-800 font-semibold mb-2">
                  💡 สาเหตุที่เป็นไปได้:
                </p>
                <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                  <li>บิลยังไม่ได้ชำระเงิน (status ไม่เป็น 'paid')</li>
                  <li>ข้อมูลผู้เช่าหรือห้องไม่ครบถ้วน</li>
                  <li>เครือข่ายไม่เสถียรขณะโหลด</li>
                  <li>เซิร์ฟเวอร์ใช้เวลานานเกินไป (timeout)</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-center flex-wrap">
            <Button onClick={handleGoBack} variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับหน้าเดิม
            </Button>
            <Button onClick={handleRetry} className="bg-blue-600 hover:bg-blue-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              ลองใหม่อีกครั้ง
            </Button>
          </div>
          
          {failedPayments.length > 0 && (
            <p className="text-xs text-slate-500 mt-4">
              ℹ️ หากลองใหม่แล้วยังมีปัญหา กรุณาตรวจสอบข้อมูลบิลในหน้า "ฐานข้อมูลบัญชี"
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Print Button (Hidden when printing) */}
      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGoBack}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              กลับ
            </Button>
            <div>
              <h2 className="font-bold text-slate-800">
                ใบเสร็จรับเงิน {receiptsData.length} รายการ
                {failedPayments.length > 0 && (
                  <span className="text-sm font-normal text-orange-600 ml-2">
                    (โหลดสำเร็จ {receiptsData.length}/{paymentIds.length} รายการ)
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">กดปุ่มด้านขวาเพื่อพิมพ์หรือบันทึกเป็น PDF</p>
            </div>
          </div>
          <Button
            onClick={handlePrint}
            className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Printer className="w-4 h-4" />
            พิมพ์ / บันทึก PDF (Ctrl+P)
          </Button>
        </div>
      </div>

      {/* Warning for failed receipts */}
      {failedPayments.length > 0 && (
        <div className="print:hidden max-w-7xl mx-auto px-4 pt-4">
          <Card className="bg-orange-50 border-orange-200">
            <div className="p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-orange-800 mb-1">
                  ⚠️ มีบางรายการที่โหลดไม่สำเร็จ
                </p>
                <p className="text-xs text-orange-700 mb-2">
                  พบ {failedPayments.length} รายการที่ไม่สามารถโหลดได้จาก {paymentIds.length} รายการทั้งหมด
                </p>
                <details className="text-xs text-orange-700">
                  <summary className="cursor-pointer font-semibold hover:text-orange-900">
                    ดูรายการที่ล้มเหลว ({failedPayments.length} รายการ)
                  </summary>
                  <ul className="mt-2 space-y-1 pl-4 list-disc">
                    {failedPayments.slice(0, 5).map((item, idx) => (
                      <li key={idx}>ID: {item.paymentId} - {item.error}</li>
                    ))}
                    {failedPayments.length > 5 && (
                      <li className="text-orange-600 font-semibold">
                        และอีก {failedPayments.length - 5} รายการ...
                      </li>
                    )}
                  </ul>
                </details>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* All Receipts */}
      <div className="max-w-7xl mx-auto p-4 space-y-8 print:space-y-0">
        {receiptsData.map((receiptData, index) => {
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
            <Card key={receiptData.id} className="bg-white shadow-lg print:shadow-none print:break-after-page print:border-0">
              <div className="p-6 print:p-8">
                {/* Header */}
                <div className="mb-4 pb-3 border-b border-slate-200">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <img
                        src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65481eff6e/337bb050d_image.jpeg"
                        alt="W Residents Logo"
                        className="w-12 h-12 object-contain"
                      />
                      <div>
                        <h1 className="text-xl font-bold text-slate-800">W RESIDENTS</h1>
                        <p className="text-xs text-slate-600">ระบบจัดการที่พักอาศัย</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <h2 className="text-lg font-bold text-green-600">ใบเสร็จรับเงิน</h2>
                      <p className="text-sm text-green-600 font-semibold">RECEIPT</p>
                    </div>
                  </div>
                  
                  <div className="text-sm text-slate-600 space-y-0.5">
                    <p>28/244 หมู่ 4 ถนนมหาธรรมการ 4 ซอย 6</p>
                    <p>ตำบลสำโรง อำเภอพระประแดง จ.สมุทรปราการ</p>
                  </div>

                  <div className="mt-3 text-sm space-y-0.5">
                    <p><span className="font-semibold">เลขที่:</span> {receiptNumber}</p>
                    <p><span className="font-semibold">วันที่ออก:</span> {paymentDate}</p>
                  </div>
                </div>

                {/* Payment Status Badge */}
                <div className="mb-4">
                  <div className="bg-green-100 border-2 border-green-500 rounded-lg p-3 flex items-center justify-center gap-2">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div className="text-center">
                      <p className="text-sm font-bold text-green-800">ชำระเงินเรียบร้อยแล้ว</p>
                      <p className="text-xs text-green-700">วันที่ชำระ: {paymentDate}</p>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-500 mb-2">ผู้เช่า / Customer</h3>
                  <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                    <p className="font-bold text-base text-slate-800">{receiptData.tenant.full_name}</p>
                    <p className="text-sm text-slate-600">ห้อง {receiptData.room.room_number}</p>
                    <p className="text-sm text-slate-600">{receiptData.tenant.phone}</p>
                    {receiptData.tenant.national_id && (
                      <p className="text-sm text-slate-600">
                        เลขประจำตัวผู้เสียภาษี: {receiptData.tenant.national_id}
                      </p>
                    )}
                  </div>
                </div>

                {/* Receipt Items */}
                <div className="mb-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-slate-300">
                          <th className="text-left py-2 pr-2 font-semibold text-slate-700">ลำดับ</th>
                          <th className="text-left py-2 pr-2 font-semibold text-slate-700">รายการ</th>
                          <th className="text-center py-2 px-1 font-semibold text-slate-700">จำนวน</th>
                          <th className="text-right py-2 pl-2 font-semibold text-slate-700">ราคา/หน่วย</th>
                          <th className="text-right py-2 pl-2 font-semibold text-slate-700">จำนวนเงิน</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lineItems.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-200">
                            <td className="py-2 pr-2 text-slate-600">{idx + 1}</td>
                            <td className="py-2 pr-2 text-slate-800">{item.name}</td>
                            <td className="py-2 px-1 text-center text-slate-600">{item.quantity}</td>
                            <td className="py-2 pl-2 text-right text-slate-600">
                              {(item.price || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-2 pl-2 text-right font-semibold text-slate-800">
                              {(item.total || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Total */}
                <div className="flex justify-end mb-4">
                  <div className="w-full max-w-sm">
                    <div className="flex justify-between py-2 border-t-2 border-slate-300">
                      <span className="font-bold text-base text-slate-800">รวมทั้งสิ้น</span>
                      <span className="font-bold text-xl text-green-600">
                        {(receiptData.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} ฿
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-green-50 rounded-lg p-3 mb-3 border border-green-200">
                  <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-1 text-sm">
                    💰 วิธีการชำระเงิน
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">ธนาคาร:</span>
                      <span className="font-semibold text-slate-800">{receiptData.bank.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">เลขที่บัญชี:</span>
                      <span className="font-semibold text-slate-800">{receiptData.bank.account_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">ชื่อบัญชี:</span>
                      <span className="font-semibold text-slate-800">{receiptData.bank.account_name}</span>
                    </div>
                  </div>
                </div>

                {/* ลายเซ็นผู้รับเงิน - แสดงเฉพาะผู้รับเงิน */}
                <div className="mb-3 pt-3 border-t border-slate-200">
                  <div className="max-w-xs mx-auto text-center">
                    <p className="text-sm text-slate-600 mb-12">ลายมือชื่อผู้รับเงิน / Receiver</p>
                    <div className="border-t border-slate-400 pt-1">
                      <p className="text-sm font-semibold text-slate-700">{receiptData.bank.account_name}</p>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="text-xs text-slate-500 space-y-0.5 bg-slate-50 p-3 rounded mb-3">
                  <p className="font-semibold text-slate-700 mb-1">หมายเหตุ:</p>
                  <p>• ใบเสร็จฉบับนี้ออกให้เป็นหลักฐานการรับเงินเรียบร้อยแล้ว</p>
                  <p>• กรุณาเก็บใบเสร็จนี้ไว้เป็นหลักฐาน</p>
                  <p>• หากมีข้อสงสัยกรุณาติดต่อเจ้าของหอพัก</p>
                </div>

                {/* Footer */}
                <div className="pt-3 border-t border-slate-200 text-center">
                  <p className="text-xs text-slate-600">ขอบคุณที่ใช้บริการ W RESIDENTS</p>
                  <p className="text-xs text-slate-500 mt-0.5">เอกสารนี้สร้างโดยระบบอัตโนมัติ</p>
                  <p className="text-xs text-slate-400 mt-1 print:hidden">ใบที่ {index + 1} / {receiptsData.length}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Print Styles - ปรับขนาดให้พอดี A4 */}
      <style>{`
        @media print {
          body {
            background: white !important;
            font-size: 10px !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          .print\\:border-0 {
            border: 0 !important;
          }
          .print\\:break-after-page {
            break-after: page;
          }
          .print\\:space-y-0 > * + * {
            margin-top: 0 !important;
          }
          @page {
            size: A4;
            margin: 8mm;
          }
          
          /* ลดขนาด font ทั้งหมด */
          h1, h2, h3 { font-size: 14px !important; }
          p, span, td, th { font-size: 10px !important; }
          .text-lg { font-size: 12px !important; }
          .text-xl { font-size: 14px !important; }
          .text-2xl { font-size: 16px !important; }
          .text-xs { font-size: 9px !important; }
          .text-sm { font-size: 10px !important; }
          .text-base { font-size: 11px !important; }
          
          /* ลดระยะห่าง */
          .mb-4 { margin-bottom: 8px !important; }
          .mb-3 { margin-bottom: 6px !important; }
          .p-6 { padding: 12px !important; }
          .p-3 { padding: 6px !important; }
          .py-2 { padding-top: 4px !important; padding-bottom: 4px !important; }
          .gap-3 { gap: 6px !important; }
          
          /* ลดขนาดโลโก้ */
          .w-12 { width: 32px !important; }
          .h-12 { height: 32px !important; }
        }
      `}</style>
    </div>
  );
}