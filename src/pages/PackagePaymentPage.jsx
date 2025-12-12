import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Loader2, CheckCircle, ArrowLeft, X, AlertCircle, Check, Building2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PackagePaymentPage() {
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [slipUrl, setSlipUrl] = useState('');
  const [errorDetails, setErrorDetails] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  
  // รับข้อมูลจากหน้าก่อนหน้า
  const packageData = location.state?.packageData;

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const getConfigValue = (key, defaultValue = '') => {
    const config = configs.find(c => c.key === key && !c.branch_id);
    return config?.value || defaultValue;
  };

  const bankName = getConfigValue('bank_name', 'ธนาคารกสิกรไทย');
  const accountNumber = getConfigValue('bank_account_number', 'xxx-x-xxxxx-x');
  const accountName = getConfigValue('bank_account_name', 'บริษัท...');
  const promptpay = getConfigValue('promptpay', '0812345678');
  const appMode = getConfigValue('app_mode', 'single_tenant');

  const userAccessibleBranches = currentUser?.accessible_branches || [];
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  if (!packageData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <Card className="max-w-md bg-white/90 backdrop-blur-xl shadow-2xl">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่พบข้อมูลแพ็กเกจ</h2>
            <p className="text-slate-600 mb-6">กรุณาเลือกแพ็กเกจก่อน</p>
            <Button
              onClick={() => navigate(createPageUrl('PackageSelectionPage'))}
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
            >
              กลับไปเลือกแพ็กเกจ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSlipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSlip(true);
    setErrorDetails(null);
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSlipUrl(file_url);
      toast.success('อัปโหลดสลิปสำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดสลิปไม่สำเร็จ');
      setErrorDetails('ไม่สามารถอัปโหลดไฟล์ได้: ' + error.message);
    } finally {
      setUploadingSlip(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!slipUrl) {
      toast.error('กรุณาอัปโหลดสลิปก่อน');
      return;
    }

    setProcessingPayment(true);
    setErrorDetails(null);
    
    try {
      if (!currentUser || !currentUser.email) {
        toast.error('ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
        setErrorDetails('ไม่พบ email ผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
        setProcessingPayment(false);
        return;
      }

      if (!currentUser?.email || typeof currentUser.email !== 'string' || currentUser.email.trim() === '') {
        toast.error('ข้อมูลผู้ใช้ไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่');
        setErrorDetails('ไม่พบข้อมูล email ของผู้ใช้ กรุณา Logout และ Login ใหม่');
        setProcessingPayment(false);
        return;
      }
      
      const result = await base44.functions.invoke('processSubscriptionPayment', {
        package_id: packageData.packageId,
        package_name: packageData.packageName,
        duration_months: packageData.durationMonths,
        price_per_month: packageData.monthlyPrice,
        total_amount: packageData.finalTotal,
        original_amount: packageData.subtotal,
        discount_code: packageData.discountCode || null,
        discount_amount: packageData.discountAmount || 0,
        slip_url: slipUrl,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        app_mode: appMode
      });

      if (result.data.success) {
        queryClient.invalidateQueries({ queryKey: ['appSubscriptions'] });
        queryClient.invalidateQueries({ queryKey: ['branchPackages'] });
        setPaymentSuccess(true);
        toast.success('เปิดใช้งานแพ็กเกจสำเร็จ!');
        
        setTimeout(() => {
          navigate(createPageUrl('Dashboard'));
        }, 3000);
      } else {
        const errorMsg = result.data.error || result.data.message || 'เกิดข้อผิดพลาด';
        const errorDetail = result.data.details || '';
        const fullError = errorDetail ? `${errorMsg}\n\n${errorDetail}` : errorMsg;
        
        toast.error(errorMsg, { 
          duration: 10000,
          description: errorDetail ? errorDetail.substring(0, 100) : undefined
        });
        setErrorDetails(fullError);
      }
    } catch (error) {
      let errorMsg = 'ไม่สามารถดำเนินการได้';
      let errorDetail = '';
      
      if (error?.response?.data) {
        errorMsg = error.response.data.error || error.response.data.message || errorMsg;
        errorDetail = error.response.data.details || '';
      } else if (error?.data) {
        errorMsg = error.data.error || error.data.message || errorMsg;
        errorDetail = error.data.details || '';
      } else if (error?.message) {
        errorMsg = error.message;
      }
      
      const fullError = errorDetail ? `${errorMsg}\n\n${errorDetail}` : errorMsg;
      toast.error(errorMsg, { duration: 10000 });
      setErrorDetails(fullError);
    } finally {
      setProcessingPayment(false);
    }
  };

  if (paymentSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-2xl mx-auto w-full"
        >
          <Card className="bg-white/90 backdrop-blur-xl shadow-2xl">
            <CardContent className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", duration: 0.6 }}
                className="mb-6"
              >
                <div className="relative w-24 h-24 mx-auto">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full blur-2xl opacity-40 animate-pulse" />
                  <div className="relative w-full h-full rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-2xl">
                    <CheckCircle className="w-14 h-14 text-white" />
                  </div>
                </div>
              </motion.div>
              
              <h2 className="text-3xl font-bold text-slate-800 mb-2">เปิดใช้งานสำเร็จ!</h2>
              <p className="text-slate-600 mb-6">แพ็กเกจของคุณถูกเปิดใช้งานแล้ว</p>

              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-6">
                  <p className="text-green-800 font-semibold mb-2">
                    ยินดีต้อนรับสู่ {packageData.packageName}!
                  </p>
                  <p className="text-sm text-green-700">
                    ระบบจะนำคุณกลับไปยังแดชบอร์ดในอีกสักครู่...
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="relative z-10 p-4">
        <Button
          onClick={() => navigate(createPageUrl('PackageSelectionPage'))}
          variant="ghost"
          className="text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          กลับไปเลือกแพ็กเกจ
        </Button>
      </div>

      <div className="relative z-10 min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-2xl mx-auto w-full"
        >
          <Card className="bg-white/90 backdrop-blur-xl shadow-2xl">
            <CardContent className="p-8">
              <div className="text-center mb-6">
                <div className={`w-16 h-16 rounded-full ${errorDetails ? 'bg-red-100' : 'bg-blue-100'} flex items-center justify-center mx-auto mb-4`}>
                  {errorDetails ? (
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  ) : (
                    <CheckCircle className="w-8 h-8 text-blue-600" />
                  )}
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">
                  {errorDetails ? 'เกิดข้อผิดพลาด' : 'ชำระเงิน'}
                </h2>
                <p className="text-slate-600">
                  {errorDetails ? 'กรุณาตรวจสอบและลองใหม่อีกครั้ง' : 'กรุณาอัปโหลดสลิปการโอนเงิน'}
                </p>
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

              {appMode === 'multi_tenant' && packageData.branchCount > 1 && (
                <div className="mb-6">
                  <Alert className="bg-blue-50 border-blue-200">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    <AlertDescription className="text-blue-800">
                      <p className="font-semibold mb-2">📦 แพ็กเกจนี้จะใช้ได้กับทุกสาขาที่คุณมีสิทธิ์เข้าถึง</p>
                      <p className="text-xs mt-2 text-blue-700">
                        💡 ราคาเดียว ใช้ได้ทุกสาขา - ไม่มีค่าใช้จ่ายเพิ่มเติม
                      </p>
                    </AlertDescription>
                  </Alert>
                </div>
              )}

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 mb-6">
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-700">แพ็กเกจ:</span>
                    <span className="font-bold text-slate-800">{packageData.packageName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-700">ระยะเวลา:</span>
                    <span className="font-bold text-slate-800">{packageData.durationMonths} เดือน</span>
                  </div>
                  {packageData.discountAmount > 0 && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-700">ราคาปกติ:</span>
                        <span className="line-through text-slate-500">{packageData.subtotal.toLocaleString()} ฿</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>ส่วนลด ({packageData.discountCode}):</span>
                        <span className="font-bold">-{packageData.discountAmount.toLocaleString()} ฿</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                    <span className="font-bold text-slate-800">ยอดชำระ:</span>
                    <span className="text-2xl font-bold text-blue-600">{packageData.finalTotal.toLocaleString()} ฿</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-slate-200 mb-6">
                <h4 className="font-bold text-slate-800 mb-3 text-sm">ข้อมูลการโอนเงิน</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">ธนาคาร</p>
                    <p className="font-semibold text-slate-800">{bankName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">เลขที่บัญชี</p>
                    <p className="font-bold text-slate-800">{accountNumber}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">ชื่อบัญชี</p>
                    <p className="font-semibold text-slate-800">{accountName}</p>
                  </div>
                  {promptpay && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">พร้อมเพย์</p>
                      <p className="font-bold text-slate-800">{promptpay}</p>
                    </div>
                  )}
                </div>
              </div>

              {slipUrl && (
                <div className="bg-slate-50 rounded-xl p-4 border-2 border-slate-200 mb-6">
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
                      setErrorDetails(null);
                    }}
                    className="w-full mt-3 text-red-600 hover:text-red-700"
                  >
                    <X className="w-4 h-4 mr-2" />
                    อัปโหลดใหม่
                  </Button>
                </div>
              )}

              {!slipUrl && (
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSlipUpload}
                    disabled={uploadingSlip}
                    className="hidden"
                  />
                  <div className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl transition-all ${
                    uploadingSlip 
                      ? 'border-slate-300 bg-slate-50 cursor-not-allowed' 
                      : 'border-blue-400 bg-blue-50 hover:bg-blue-100 hover:border-blue-500'
                  }`}>
                    {uploadingSlip ? (
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-2 animate-spin" />
                        <p className="text-sm font-semibold text-slate-700">กำลังอัปโหลด...</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                        <p className="text-sm font-semibold text-slate-800">คลิกเพื่อเลือกสลิป</p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG (ไม่เกิน 10MB)</p>
                      </div>
                    )}
                  </div>
                </label>
              )}

              {errorDetails ? (
                <Button
                  onClick={() => {
                    setSlipUrl('');
                    setErrorDetails(null);
                  }}
                  className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 py-6 mt-6"
                >
                  <X className="w-4 h-4 mr-2" />
                  ลองใหม่อีกครั้ง
                </Button>
              ) : (
                <Button
                  onClick={handleConfirmPayment}
                  disabled={processingPayment || !slipUrl}
                  className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-6 mt-6"
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังดำเนินการ...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      ยืนยันการชำระเงิน
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}