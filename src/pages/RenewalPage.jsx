import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Calendar, CheckCircle, Upload, Loader2, X, Check, Crown, ArrowLeft, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { differenceInDays, parseISO } from "date-fns";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function RenewalPage() {
  const [step, setStep] = useState(1);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [slipUrl, setSlipUrl] = useState('');
  const [errorDetails, setErrorDetails] = useState(null);
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['appSubscriptions'],
    queryFn: () => base44.entities.AppSubscription.list('-created_date', 1),
  });

  const activeSubscription = subscriptions.find(s => s.status === 'active' || s.status === 'expired') || subscriptions[0];

  const packageName = activeSubscription?.package_name || 'Elite Package';
  const packagePrice = activeSubscription?.price_per_month || 2490;
  const packageDuration = activeSubscription?.subscription_duration_months || 3;

  // ดึง branch_id ที่เลือกอยู่
  const selectedBranchId = localStorage.getItem('selected_branch_id');

  const getDaysRemaining = () => {
    if (!activeSubscription?.subscription_end_date) return 0;
    try {
      const endDate = parseISO(activeSubscription.subscription_end_date);
      return differenceInDays(endDate, new Date());
    } catch {
      return 0;
    }
  };

  const daysRemaining = getDaysRemaining();
  const isExpired = daysRemaining < 0;

  const priceBeforeVAT = packagePrice;
  const vat = priceBeforeVAT * 0.07;
  const totalWithVAT = priceBeforeVAT + vat;

  const handleSlipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSlip(true);
    setErrorDetails(null);
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      console.log('✅ Slip uploaded:', file_url);
      setSlipUrl(file_url);
      toast.success('อัปโหลดสลิปสำเร็จ');
      setStep(2);
    } catch (error) {
      console.error('❌ Upload error:', error);
      const errorMsg = 'ไม่สามารถอัปโหลดไฟล์ได้: ' + error.message;
      toast.error(errorMsg);
      setErrorDetails(errorMsg);
    } finally {
      setUploadingSlip(false);
    }
  };

  const handleConfirmPayment = async () => {
    console.log('🔵 ===== CONFIRM PAYMENT START =====');
    setErrorDetails(null);
    
    if (!currentUser) {
      const errorMsg = 'ไม่พบข้อมูลผู้ใช้ กรุณา refresh หน้านี้';
      console.error('❌', errorMsg);
      toast.error(errorMsg);
      setErrorDetails(errorMsg);
      return;
    }

    if (!slipUrl) {
      const errorMsg = 'กรุณาอัปโหลดสลิปก่อน';
      console.error('❌', errorMsg);
      toast.error(errorMsg);
      setErrorDetails(errorMsg);
      return;
    }

    setProcessingPayment(true);
    console.log('📤 กำลังส่งข้อมูลไปยัง backend...');
    
    try {
      const paymentData = {
        package_id: activeSubscription?.package_id || 'renewal',
        package_name: packageName,
        duration_months: packageDuration,
        price_per_month: packagePrice,
        total_amount: totalWithVAT,
        slip_url: slipUrl,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        branch_ids: [selectedBranchId],
        app_mode: 'renewal'
      };

      console.log('📦 Sending payment data:', paymentData);

      const result = await base44.functions.invoke('processSubscriptionPayment', paymentData);

      console.log('📥 Full result:', result);
      console.log('📥 Result status:', result?.status);
      console.log('📥 Result data:', result?.data);

      // ตรวจสอบว่า success หรือไม่
      if (result?.data?.success === true) {
        console.log('✅ Payment processed successfully');
        await queryClient.invalidateQueries({ queryKey: ['appSubscriptions'] });
        await queryClient.invalidateQueries({ queryKey: ['branchPackages'] });
        setStep(3);
        toast.success('ต่ออายุสำเร็จ! กำลังพาคุณกลับสู่หน้าหลัก...', { duration: 3000 });
        
        setTimeout(() => {
          navigate(createPageUrl('Dashboard'));
        }, 3000);
        return;
      }

      // ถ้าไม่ success แสดงว่ามี error
      const errorMsg = result?.data?.error || result?.data?.message || 'เกิดข้อผิดพลาดในการตรวจสอบสลิป';
      const errorDetail = result?.data?.details || '';
      
      console.error('❌ Payment verification failed');
      console.error('Error message:', errorMsg);
      console.error('Error details:', errorDetail);
      
      // แสดง error แต่คงอยู่ที่ step 2 เพื่อให้เห็นสลิป
      const fullError = errorDetail ? `${errorMsg}\n\n${errorDetail}` : errorMsg;
      toast.error(errorMsg, { 
        duration: 10000,
        description: errorDetail ? errorDetail.substring(0, 100) : undefined
      });
      setErrorDetails(fullError);

    } catch (error) {
      console.error('❌ CATCH ERROR:', error);
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error response:', error?.response);
      console.error('Error response data:', error?.response?.data);
      
      let errorMsg = 'เกิดข้อผิดพลาดในการดำเนินการ';
      let errorDetail = '';
      
      // ตรวจสอบ response error
      if (error?.response?.data) {
        const data = error.response.data;
        errorMsg = data.error || data.message || errorMsg;
        errorDetail = data.details || '';
      } 
      // ตรวจสอบ error.data (กรณี base44 function error)
      else if (error?.data) {
        errorMsg = error.data.error || error.data.message || errorMsg;
        errorDetail = error.data.details || '';
      }
      // ใช้ error.message ธรรมดา
      else if (error?.message) {
        errorMsg = error.message;
      }
      
      console.error('🔴 Final error message:', errorMsg);
      console.error('🔴 Final error details:', errorDetail);
      
      const fullError = errorDetail ? `${errorMsg}\n\n${errorDetail}` : errorMsg;
      toast.error(errorMsg, { 
        duration: 10000,
        description: errorDetail ? errorDetail.substring(0, 100) : undefined
      });
      setErrorDetails(fullError);
    } finally {
      setProcessingPayment(false);
      console.log('🔵 ===== CONFIRM PAYMENT END =====');
    }
  };

  const packageFeatures = activeSubscription?.features || [
    'Dashboard Real-time',
    'ตรวจสอบสลิปอัตโนมัติ',
    'Template สัญญา/เอกสารประกอบได้',
    'AI ค้นหา/ตอบคำถาง ไม่จำกัด',
    'AI วิเคราะห์การเงิน',
    'AI วิเคราะห์การเช่า/ทำนายอนาคต',
    'แจ้งเตือน-โอนเตือน-แจ้งพัสดุอัตโนมัติ',
    'รับฝากอัตโนมัติในห้อง (Auto Payment)',
    'แยกสิทธิ์ผู้ใช้งาน',
    'ตรวจประวัติผู้เช่า',
    'ปรับแต่งระบบทั้ง 16ส',
    'Priority Support',
    'รวมแชท',
    'เข้าระบบได้ทุกที่',
    'จำนวนผู้ใช้งาน 8 คน'
  ];

  if (!activeSubscription) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <div className="relative z-10 p-4">
        <Button
          onClick={() => navigate(createPageUrl('Dashboard'))}
          variant="ghost"
          className="text-slate-600 hover:text-slate-800 hover:bg-white/50"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          กลับ
        </Button>
      </div>

      <div className="relative z-10 min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
        <div className="w-full max-w-6xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-5 gap-6"
          >
            <Card className="lg:col-span-3 bg-white/90 backdrop-blur-2xl border border-white/60 shadow-2xl rounded-3xl">
              <CardContent className="p-8">
                <AnimatePresence mode="wait">
                  {step === 1 && (
                    <motion.div
                      key="step1"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      <div className="mb-6 text-center">
                        <h2 className="text-3xl font-bold text-slate-800 mb-2">ข้อมูลการชำระเงิน</h2>
                        <p className="text-sm text-slate-600">กรุณาโอนเงินและอัปโหลดสลิปเพื่อต่ออายุ</p>
                      </div>

                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                        <h3 className="font-bold text-slate-800 mb-4 text-lg">ข้อมูลบัญชีสำหรับโอนเงิน</h3>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center py-2 border-b border-blue-200/50">
                            <span className="text-sm text-slate-600">ธนาคาร</span>
                            <span className="font-semibold text-slate-800">ธนาคารกสิกรไทย</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-blue-200/50">
                            <span className="text-sm text-slate-600">เลขที่บัญชี</span>
                            <span className="font-bold text-lg text-slate-800">0722835522</span>
                          </div>
                          <div className="flex justify-between items-center py-2 border-b border-blue-200/50">
                            <span className="text-sm text-slate-600">ชื่อบัญชี</span>
                            <span className="font-semibold text-slate-800">ธนวรรณ พรมทอง</span>
                          </div>
                          <div className="flex justify-between items-center py-2">
                            <span className="text-sm text-slate-600">พร้อมเพย์</span>
                            <span className="font-bold text-lg text-slate-800">0812345678</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-6">
                        <Label className="text-sm font-semibold text-slate-800 mb-3 block">
                          อัปโหลดหลักฐานการโอนเงิน
                        </Label>
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleSlipUpload}
                            disabled={uploadingSlip}
                            className="hidden"
                          />
                          <div className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-2xl transition-all ${
                            uploadingSlip 
                              ? 'border-slate-300 bg-slate-50 cursor-not-allowed' 
                              : 'border-blue-400 bg-blue-50/50 hover:bg-blue-100/50 hover:border-blue-500'
                          }`}>
                            {uploadingSlip ? (
                              <div className="text-center">
                                <Loader2 className="w-10 h-10 text-blue-600 mx-auto mb-2 animate-spin" />
                                <p className="text-sm font-semibold text-slate-700">กำลังอัปโหลด...</p>
                              </div>
                            ) : (
                              <div className="text-center">
                                <Upload className="w-10 h-10 mx-auto mb-2 text-blue-600" />
                                <p className="text-base font-semibold text-slate-800">คลิกเพื่ออัปโหลดสลิป</p>
                                <p className="text-xs text-slate-500 mt-1">รองรับ PNG, JPG (ไม่เกิน 10MB)</p>
                              </div>
                            )}
                          </div>
                        </label>
                      </div>
                    </motion.div>
                  )}

                  {step === 2 && (
                    <motion.div
                      key="step2"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-6"
                    >
                      <div className="mb-6">
                        <div className="flex items-center gap-3 mb-4">
                          <div className={`w-12 h-12 rounded-xl ${errorDetails ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-gradient-to-br from-green-500 to-emerald-500'} flex items-center justify-center shadow-lg`}>
                            {errorDetails ? (
                              <AlertCircle className="w-6 h-6 text-white" />
                            ) : (
                              <CheckCircle className="w-6 h-6 text-white" />
                            )}
                          </div>
                          <div>
                            <h2 className="text-2xl font-bold text-slate-800">
                              {errorDetails ? 'เกิดข้อผิดพลาด' : 'ตรวจสอบสลิป'}
                            </h2>
                            <p className="text-sm text-slate-600">
                              {errorDetails ? 'กรุณาตรวจสอบและลองใหม่อีกครั้ง' : 'กรุณาตรวจสอบความถูกต้องก่อนยืนยัน'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {errorDetails && (
                        <Alert className="mb-6 bg-red-50 border-red-200">
                          <AlertCircle className="w-5 h-5 text-red-600" />
                          <AlertDescription className="text-red-800">
                            <pre className="text-sm whitespace-pre-wrap leading-relaxed">
                              {errorDetails}
                            </pre>
                          </AlertDescription>
                        </Alert>
                      )}

                      {slipUrl && (
                        <div className="bg-slate-50 rounded-2xl p-4 border-2 border-slate-200">
                          <img 
                            src={slipUrl} 
                            alt="สลิปการโอนเงิน" 
                            className="w-full max-h-96 object-contain rounded-xl"
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSlipUrl('');
                              setStep(1);
                              setErrorDetails(null);
                            }}
                            className="w-full mt-3 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4 mr-2" />
                            อัปโหลดใหม่
                          </Button>
                        </div>
                      )}

                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 mb-6">
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-700">แพ็กเกจ:</span>
                            <span className="font-bold text-slate-800">{packageName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-700">ระยะเวลา:</span>
                            <span className="font-bold text-slate-800">{packageDuration} เดือน</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                            <span className="font-bold text-slate-800">ยอดรวม:</span>
                            <span className="text-2xl font-bold text-blue-600">{totalWithVAT.toLocaleString(undefined, { maximumFractionDigits: 2 })} ฿</span>
                          </div>
                        </div>
                      </div>

                      {errorDetails ? (
                        <Button
                          onClick={() => {
                            setSlipUrl('');
                            setStep(1);
                            setErrorDetails(null);
                          }}
                          className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 py-6 text-lg font-semibold"
                        >
                          <X className="w-5 h-5 mr-2" />
                          ลองใหม่อีกครั้ง
                        </Button>
                      ) : (
                        <Button
                          onClick={handleConfirmPayment}
                          disabled={processingPayment || !currentUser || !slipUrl}
                          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 py-6 text-lg font-semibold"
                        >
                          {processingPayment ? (
                            <>
                              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                              กำลังตรวจสอบสลิป...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-5 h-5 mr-2" />
                              ยืนยันการชำระเงิน
                            </>
                          )}
                        </Button>
                      )}
                    </motion.div>
                  )}

                  {step === 3 && (
                    <motion.div
                      key="step3"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="space-y-6"
                    >
                      <div className="text-center mb-6">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", duration: 0.6 }}
                          className="mb-4"
                        >
                          <div className="relative w-24 h-24 mx-auto">
                            <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full blur-2xl opacity-40 animate-pulse" />
                            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-2xl">
                              <CheckCircle className="w-14 h-14 text-white" />
                            </div>
                          </div>
                        </motion.div>
                        
                        <h2 className="text-3xl font-bold text-slate-800 mb-2">ต่ออายุสำเร็จ!</h2>
                        <p className="text-slate-600">
                          แพ็กเกจของคุณได้รับการต่ออายุแล้ว
                        </p>
                      </div>

                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-6">
                          <div className="text-center space-y-3">
                            <CheckCircle className="w-16 h-16 text-green-600 mx-auto" />
                            <h3 className="font-bold text-green-900 text-lg">ต่ออายุสำเร็จ</h3>
                            <p className="text-sm text-green-800">
                              ระบบได้ตรวจสอบและอนุมัติการชำระเงินแล้ว<br/>
                              แพ็กเกจของคุณพร้อมใช้งานต่อ
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 rounded-3xl p-6 text-white shadow-2xl h-fit lg:sticky lg:top-4">
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Crown className="w-5 h-5 text-yellow-400" />
                  <h3 className="text-lg font-bold">Package Summary</h3>
                </div>
                <p className="text-xs text-slate-400">รายละเอียดแพ็กเกจของคุณ</p>
              </div>

              <div className="bg-slate-700/40 rounded-xl p-3 mb-4 border border-slate-600/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-slate-400">Package</span>
                  <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white border-0 px-2 py-0.5 text-xs">
                    {packageName}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">ระยะเวลา {packageDuration} เดือน</p>
              </div>

              <div className="space-y-1.5 mb-6">
                {packageFeatures.map((feature, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-xs text-slate-300 leading-relaxed">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-700 pt-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">ราคาแพ็กเกจ ({packageDuration} เดือน)</span>
                  <span className="font-semibold">{priceBeforeVAT.toFixed(1)} ฿</span>
                </div>
                
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">VAT (7%)</span>
                  <span className="font-semibold">{vat.toFixed(1)} ฿</span>
                </div>

                <div className="border-t border-slate-700 pt-3 mt-3">
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-bold">Total Amount</span>
                    <div className="text-right">
                      <div className="text-4xl font-bold text-green-400">
                        {totalWithVAT.toFixed(1)}
                      </div>
                      <div className="text-xs text-slate-400">บาท</div>
                    </div>
                  </div>
                </div>
              </div>

              {isExpired ? (
                <div className="mt-4 p-3 bg-amber-600/30 backdrop-blur-sm rounded-xl border border-amber-500/40">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-200 mb-0.5">โปรดหมายเหตุ</p>
                      <p className="text-xs text-amber-200/90">
                        สัญญาจะหมดอายุในอีก {Math.abs(daysRemaining)} วัน
                      </p>
                    </div>
                  </div>
                </div>
              ) : daysRemaining < 30 && (
                <div className="mt-4 p-3 bg-amber-600/30 backdrop-blur-sm rounded-xl border border-amber-500/40">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-amber-300 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-amber-200 mb-0.5">โปรดหมายเหตุ</p>
                      <p className="text-xs text-amber-200/90">
                        สัญญาจะหมดอายุในอีก {daysRemaining} วัน
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}