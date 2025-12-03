import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Crown, Check, Upload, Loader2, CheckCircle, ArrowLeft, X, AlertCircle, Building2, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PackageSelectionPage() {
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [billingCycle, setBillingCycle] = useState('1'); // '1', '3', or '12' months
  const [step, setStep] = useState(1);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [slipUrl, setSlipUrl] = useState('');
  const [errorDetails, setErrorDetails] = useState(null);
  const [debugMode, setDebugMode] = useState(false);
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: branchPackages = [] } = useQuery({
    queryKey: ['branchPackages'],
    queryFn: () => base44.entities.BranchPackage.list('-created_date', 200),
  });

  const { data: crmPackages, isLoading: loadingPackages } = useQuery({
    queryKey: ['crmPackages'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPackagesFromCRM', {});
      return response.data;
    },
  });

  const getConfigValue = (key, defaultValue = '') => {
    const config = configs.find(c => c.key === key && !c.branch_id);
    return config?.value || defaultValue;
  };

  const bankName = getConfigValue('bank_name', 'ธนาคารกสิกรไทย');
  const accountNumber = getConfigValue('bank_account_number', 'xxx-x-xxxxx-x');
  const accountName = getConfigValue('bank_account_name', 'บริษัท...');
  const promptpay = getConfigValue('promptpay', '0812345678');

  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const appMode = getConfigValue('app_mode', 'single_tenant');
  const userAccessibleBranches = currentUser?.accessible_branches || [];
  
  // Filter branches ที่ผู้ใช้สามารถซื้อแพ็กเกจได้
  const purchasableBranches = useMemo(() => {
    // Developer ที่ไม่มี accessible_branches เห็นทุกสาขา, คนอื่นเห็นเฉพาะที่มีสิทธิ์
    const canViewAllBranches = userRole === 'developer' && (!userAccessibleBranches || userAccessibleBranches.length === 0);
    if (canViewAllBranches) return branches;
    return branches.filter(b => userAccessibleBranches.includes(b.id));
  }, [branches, userRole, userAccessibleBranches]);

  // ตรวจสอบว่าสาขาไหนยังไม่มี active paid package
  const branchesNeedingPackage = useMemo(() => {
    return purchasableBranches.filter(branch => {
      const activePaidPackage = branchPackages.find(bp =>
        bp.branch_id === branch.id &&
        bp.status === 'active' &&
        bp.package_id !== 'trial' &&
        bp.price_per_month > 0
      );
      return !activePaidPackage;
    });
  }, [purchasableBranches, branchPackages]);

  // ไม่ต้อง auto-select branches เพราะจะใช้ owner_email แทน

  const packages = (crmPackages?.packages || [])
    .filter(p => p.app_system === 'dormitory')
    .sort((a, b) => {
      const priceA = a.pricing?.monthly || a.price_monthly || 0;
      const priceB = b.pricing?.monthly || b.price_monthly || 0;
      return priceA - priceB;
    });

  const selectedPackage = packages.find(p => p.id === selectedPackageId);
  
  const calculatePrice = useMemo(() => {
    if (!selectedPackage || !billingCycle) return { subtotal: 0, vat: 0, total: 0, branchCount: 0, discount: 0, monthlyPrice: 0, baseMonthlyPrice: 0, discountPercent: 0, savings: 0 };
    
    const months = parseInt(billingCycle);
    
    // รองรับทั้ง 2 โครงสร้าง: pricing object และ price_* fields
    const pricing = selectedPackage.pricing || {};
    const hasNewStructure = pricing.monthly !== undefined;
    
    // ดึงราคาตามโครงสร้างที่มี
    let baseMonthlyPrice = hasNewStructure ? (pricing.monthly || 0) : (selectedPackage.price_monthly || 0);
    let totalPrice = 0;
    let monthlyPrice = baseMonthlyPrice;
    let savings = 0;
    
    if (months === 1) {
      totalPrice = baseMonthlyPrice;
      monthlyPrice = baseMonthlyPrice;
    } else if (months === 3) {
      if (hasNewStructure) {
        totalPrice = pricing.three_months || (baseMonthlyPrice * 3);
        monthlyPrice = pricing.three_months_per_month || baseMonthlyPrice;
        savings = pricing.three_months_savings || 0;
      } else {
        totalPrice = selectedPackage.price_3_months || (baseMonthlyPrice * 3);
        monthlyPrice = totalPrice / 3;
        savings = (baseMonthlyPrice * 3) - totalPrice;
      }
    } else if (months === 6) {
      if (hasNewStructure) {
        totalPrice = pricing.six_months || (baseMonthlyPrice * 6);
        monthlyPrice = pricing.six_months_per_month || baseMonthlyPrice;
        savings = pricing.six_months_savings || 0;
      } else {
        totalPrice = selectedPackage.price_6_months || (baseMonthlyPrice * 6);
        monthlyPrice = totalPrice / 6;
        savings = (baseMonthlyPrice * 6) - totalPrice;
      }
    } else if (months === 12) {
      if (hasNewStructure) {
        totalPrice = pricing.yearly || (baseMonthlyPrice * 12);
        monthlyPrice = pricing.yearly_per_month || baseMonthlyPrice;
        savings = pricing.yearly_savings || 0;
      } else {
        totalPrice = selectedPackage.price_yearly || (baseMonthlyPrice * 12);
        monthlyPrice = totalPrice / 12;
        savings = (baseMonthlyPrice * 12) - totalPrice;
      }
    }
    
    const subtotal = totalPrice;
    const discountPercent = savings > 0 && baseMonthlyPrice > 0 ? Math.round((savings / (baseMonthlyPrice * months)) * 100) : 0;
    const vat = subtotal * 0.07;
    const total = subtotal + vat;
    
    return { 
      subtotal, 
      vat, 
      total, 
      branchCount: selectedPackage.max_branches || 0, 
      userCount: selectedPackage.max_users || 0,
      discount: discountPercent,
      discountPercent,
      savings,
      monthlyPrice, 
      baseMonthlyPrice 
    };
  }, [selectedPackage, billingCycle]);

  const handleSlipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSlip(true);
    setErrorDetails(null);
    
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSlipUrl(file_url);
      toast.success('อัปโหลดสลิปสำเร็จ');
      setStep(2);
    } catch (error) {
      toast.error('อัปโหลดสลิปไม่สำเร็จ');
      setErrorDetails('ไม่สามารถอัปโหลดไฟล์ได้: ' + error.message);
    } finally {
      setUploadingSlip(false);
    }
  };

  const handleConfirmPayment = async () => {
    setProcessingPayment(true);
    setErrorDetails(null);
    
    try {
      // ✅ ตรวจสอบว่ามี currentUser.email ก่อนส่ง
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
      
      // ✅ ไม่ส่ง branch_ids - ให้ function ใช้ owner_email หาสาขาเอง
      const result = await base44.functions.invoke('processSubscriptionPayment', {
        package_id: selectedPackageId,
        package_name: selectedPackage.package_name,
        duration_months: parseInt(billingCycle),
        price_per_month: calculatePrice.monthlyPrice,
        total_amount: calculatePrice.total,
        slip_url: slipUrl,
        user_email: currentUser.email,
        user_name: currentUser.full_name,
        app_mode: appMode
      });

      if (result.data.success) {
        queryClient.invalidateQueries({ queryKey: ['appSubscriptions'] });
        queryClient.invalidateQueries({ queryKey: ['branchPackages'] });
        setStep(3);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="relative z-10 p-4 flex items-center justify-between">
        <Button
          onClick={() => navigate(createPageUrl('Dashboard'))}
          variant="ghost"
          className="text-slate-600 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          กลับ
        </Button>
        {userRole === 'developer' && (
          <Button
            onClick={() => setDebugMode(!debugMode)}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            {debugMode ? '🐛 ปิด Debug' : '🐛 เปิด Debug'}
          </Button>
        )}
      </div>

      <div className="relative z-10 min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
        <div className="w-full max-w-7xl">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="text-center mb-12">
                  <h1 className="text-4xl md:text-5xl font-bold mb-2">
                    <span className="text-slate-900">Small investment</span>
                  </h1>
                  <h2 className="text-4xl md:text-5xl font-bold mb-6">
                    <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                      Huge productivity boost
                    </span>
                  </h2>
                  <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="w-3 h-3 text-green-600" />
                      </div>
                      <span>One-time purchase</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="w-3 h-3 text-green-600" />
                      </div>
                      <span>All the features in every plan</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="w-3 h-3 text-green-600" />
                      </div>
                      <span>30-day Money Back Guarantee</span>
                    </div>
                  </div>
                  
                  {/* Billing Cycle Toggle */}
                  <div className="flex justify-center mb-8 mt-8">
                    <div className="inline-flex items-center gap-1.5 bg-white rounded-full p-1.5 shadow-lg border border-slate-200">
                      <button
                        onClick={() => setBillingCycle('1')}
                        className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                          billingCycle === '1'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        1 เดือน
                      </button>
                      <button
                        onClick={() => setBillingCycle('3')}
                        className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                          billingCycle === '3'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        3 เดือน
                      </button>
                      <button
                        onClick={() => setBillingCycle('6')}
                        className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                          billingCycle === '6'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        6 เดือน
                        {(() => {
                          const savings = selectedPackage?.pricing?.six_months_savings || 
                            (selectedPackage?.price_monthly && selectedPackage?.price_6_months 
                              ? (selectedPackage.price_monthly * 6 - selectedPackage.price_6_months) 
                              : 0);
                          return savings > 0 && (
                            <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                              ประหยัด ฿{savings.toLocaleString()}
                            </span>
                          );
                        })()}
                      </button>
                      <button
                        onClick={() => setBillingCycle('12')}
                        className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                          billingCycle === '12'
                            ? 'bg-slate-900 text-white shadow-md'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        1 ปี
                        {(() => {
                          const savings = selectedPackage?.pricing?.yearly_savings || 
                            (selectedPackage?.price_monthly && selectedPackage?.price_yearly 
                              ? (selectedPackage.price_monthly * 12 - selectedPackage.price_yearly) 
                              : 0);
                          return savings > 0 && (
                            <span className="ml-2 text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full">
                              ประหยัด ฿{savings.toLocaleString()}
                            </span>
                          );
                        })()}
                      </button>
                    </div>
                  </div>
                </div>

                {loadingPackages ? (
                 <div className="text-center py-12">
                   <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                   <p className="text-slate-600">กำลังโหลดแพ็กเกจ...</p>
                 </div>
                ) : packages.length === 0 ? (
                 <div className="text-center py-12">
                   <AlertCircle className="w-12 h-12 text-orange-500 mx-auto mb-4" />
                   <p className="text-slate-800 font-semibold mb-2">ไม่พบแพ็กเกจ</p>
                   <p className="text-sm text-slate-600 mb-4">กรุณาติดต่อผู้ดูแลระบบเพื่อตั้งค่าแพ็กเกจ</p>
                   {debugMode && crmPackages && (
                     <details className="text-left bg-slate-100 p-4 rounded-lg max-w-2xl mx-auto">
                       <summary className="cursor-pointer font-semibold text-slate-700">Debug: ข้อมูลจาก CRM</summary>
                       <pre className="text-xs mt-2 overflow-auto max-h-96 text-slate-600">
                         {JSON.stringify(crmPackages, null, 2)}
                       </pre>
                     </details>
                   )}
                 </div>
                ) : (
                  <>
                    {debugMode && userRole === 'developer' && (
                      <div className="mb-6 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 max-w-4xl mx-auto">
                        <p className="font-bold text-yellow-900 mb-3">🐛 Debug Mode</p>
                        
                        <div className="mb-4">
                          <p className="font-semibold text-yellow-900 mb-2">📦 All CRM Packages:</p>
                          <pre className="text-xs bg-white p-3 rounded overflow-auto max-h-48 text-slate-700 whitespace-pre-wrap">
                            {JSON.stringify(crmPackages, null, 2)}
                          </pre>
                        </div>

                        {selectedPackage && (
                          <>
                            <div className="mb-4">
                              <p className="font-semibold text-yellow-900 mb-2">🎯 Package ที่เลือก:</p>
                              <pre className="text-xs bg-white p-3 rounded overflow-auto max-h-48 text-slate-700 whitespace-pre-wrap">
                                {JSON.stringify(selectedPackage, null, 2)}
                              </pre>
                            </div>
                            
                            <div className="mb-4">
                              <p className="font-semibold text-yellow-900 mb-2">💰 ราคาที่คำนวณได้ (Billing Cycle: {billingCycle} เดือน):</p>
                              <pre className="text-xs bg-white p-3 rounded text-slate-700 whitespace-pre-wrap">
                                {JSON.stringify(calculatePrice, null, 2)}
                              </pre>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {packages.map((pkg, index) => {
                      const isMostPopular = pkg.popular === true || (index === packages.length - 1 && packages.length === 3);
                      const isSelected = selectedPackageId === pkg.id;
                      const isDisabled = pkg.is_active === false; // ⭐ เช็คว่าปิดอยู่หรือไม่
                      
                      return (
                        <motion.div
                          key={pkg.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className={`relative ${isMostPopular && !isDisabled ? 'md:scale-105' : ''}`}
                        >
                          <Card className={`h-full transition-all ${
                           isDisabled 
                             ? 'cursor-not-allowed opacity-60 grayscale' 
                             : 'cursor-pointer'
                          } ${
                           isSelected && !isDisabled ? 'ring-4 ring-blue-500 ring-offset-4' : ''
                          } ${
                           isDisabled
                             ? 'bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 text-slate-400 shadow-lg border-slate-600'
                             : isMostPopular 
                               ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-black text-white shadow-2xl border-0' 
                               : 'bg-white text-slate-800 shadow-lg hover:shadow-xl border-slate-200'
                          }`}
                          onClick={() => {
                           if (isDisabled) return;
                           setSelectedPackageId(pkg.id);
                          }}
                          >
                            {isDisabled && (
                              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                                <Badge className="bg-slate-600 text-slate-300 border-0 px-4 py-1.5 text-xs font-bold rounded-t-lg rounded-b-none">
                                  ปิดการขาย
                                </Badge>
                              </div>
                            )}
                            {isMostPopular && !isDisabled && (
                              <div className="absolute -top-4 left-0 right-0 flex justify-center">
                                <Badge className="bg-orange-500 text-white border-0 px-4 py-1.5 text-xs font-bold rounded-t-lg rounded-b-none">
                                  MOST POPULAR
                                </Badge>
                              </div>
                            )}

                            <CardContent className="p-6 pt-8">
                              <div className="text-center mb-6">
                                <h3 className="text-2xl font-bold mb-2">{pkg.package_name}</h3>
                                <p className={`text-sm ${isMostPopular ? 'text-slate-400' : 'text-slate-500'}`}>
                                  For most businesses that want to optimize
                                </p>
                              </div>

                              <div className="text-center mb-6">
                                {(() => {
                                  const months = parseInt(billingCycle);
                                  const pricing = pkg.pricing || {};
                                  const hasNewStructure = pricing.monthly !== undefined;
                                  
                                  const basePrice = hasNewStructure ? (pricing.monthly || 0) : (pkg.price_monthly || 0);
                                  let displayPrice = basePrice;
                                  let totalPrice = basePrice * months;
                                  let savings = 0;
                                  
                                  if (months === 3) {
                                    if (hasNewStructure) {
                                      totalPrice = pricing.three_months || (basePrice * 3);
                                      displayPrice = pricing.three_months_per_month || basePrice;
                                      savings = pricing.three_months_savings || 0;
                                    } else {
                                      totalPrice = pkg.price_3_months || (basePrice * 3);
                                      displayPrice = totalPrice / 3;
                                      savings = (basePrice * 3) - totalPrice;
                                    }
                                  } else if (months === 6) {
                                    if (hasNewStructure) {
                                      totalPrice = pricing.six_months || (basePrice * 6);
                                      displayPrice = pricing.six_months_per_month || basePrice;
                                      savings = pricing.six_months_savings || 0;
                                    } else {
                                      totalPrice = pkg.price_6_months || (basePrice * 6);
                                      displayPrice = totalPrice / 6;
                                      savings = (basePrice * 6) - totalPrice;
                                    }
                                  } else if (months === 12) {
                                    if (hasNewStructure) {
                                      totalPrice = pricing.yearly || (basePrice * 12);
                                      displayPrice = pricing.yearly_per_month || basePrice;
                                      savings = pricing.yearly_savings || 0;
                                    } else {
                                      totalPrice = pkg.price_yearly || (basePrice * 12);
                                      displayPrice = totalPrice / 12;
                                      savings = (basePrice * 12) - totalPrice;
                                    }
                                  }
                                  
                                  const hasDiscount = savings > 0;
                                  
                                  return hasDiscount ? (
                                    <div>
                                      <div className="flex items-baseline justify-center gap-2 mb-1">
                                        <span className={`text-xl line-through ${isMostPopular ? 'text-slate-400' : 'text-slate-400'}`}>
                                          ฿{basePrice.toLocaleString()}
                                        </span>
                                      </div>
                                      <div className="flex items-baseline justify-center gap-1">
                                        <span className="text-5xl font-bold">
                                          ฿{Math.round(displayPrice).toLocaleString()}
                                        </span>
                                        <span className={`text-base ${isMostPopular ? 'text-slate-400' : 'text-slate-500'}`}>
                                          /month
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-baseline justify-center gap-1">
                                      <span className="text-5xl font-bold">
                                        ฿{Math.round(displayPrice).toLocaleString()}
                                      </span>
                                      <span className={`text-base ${isMostPopular ? 'text-slate-400' : 'text-slate-500'}`}>
                                        /month
                                      </span>
                                    </div>
                                  );
                                })()}
                              </div>

                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (isDisabled) return; // ⭐ ไม่ให้คลิกถ้าปิด
                                  setSelectedPackageId(pkg.id);
                                }}
                                disabled={isDisabled}
                                className={`w-full py-5 text-sm font-semibold rounded-xl mb-6 ${
                                  isDisabled
                                    ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                                    : isSelected
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg'
                                    : isMostPopular
                                    ? 'bg-white hover:bg-slate-50 text-slate-900 border-2 border-white/20'
                                    : 'bg-white hover:bg-slate-50 text-slate-900 border border-slate-200'
                                }`}
                              >
                                {isDisabled ? (
                                  'ปิดการขาย'
                                ) : isSelected ? (
                                  <>
                                    <Check className="w-4 h-4 mr-2" />
                                    เลือกแล้ว
                                  </>
                                ) : (
                                  `Buy ${pkg.package_name} License`
                                )}
                              </Button>

                              <div className="space-y-2.5 mb-4">
                                <div className={`flex items-center gap-2 p-2.5 rounded-lg ${
                                  isMostPopular ? 'bg-white/10' : 'bg-slate-50'
                                }`}>
                                  <Building2 className={`w-5 h-5 ${isMostPopular ? 'text-white' : 'text-slate-700'}`} />
                                  <span className="text-sm font-medium">
                                    {!pkg.max_branches || pkg.max_branches === 0
                                      ? 'ไม่จำกัดสาขา'
                                      : `${pkg.max_branches} สาขา`}
                                  </span>
                                </div>
                                <div className={`flex items-center gap-2 p-2.5 rounded-lg ${
                                  isMostPopular ? 'bg-white/10' : 'bg-slate-50'
                                }`}>
                                  <Users className={`w-5 h-5 ${isMostPopular ? 'text-white' : 'text-slate-700'}`} />
                                  <span className="text-sm font-medium">
                                    {!pkg.max_users || pkg.max_users === 0
                                      ? 'ไม่จำกัดผู้ใช้'
                                      : `${pkg.max_users} ผู้ใช้`}
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2.5 min-h-[200px]">
                                {(pkg.features || []).map((feature, idx) => (
                                  <div key={idx} className="flex items-start gap-2">
                                    <Check className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                                      isMostPopular ? 'text-white' : 'text-blue-600'
                                    }`} />
                                    <span className="text-sm leading-tight">{feature}</span>
                                  </div>
                                ))}
                              </div>
                            </CardContent>

                            {isSelected && (
                              <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-xl z-10"
                              >
                                <Check className="w-6 h-6 text-white" />
                              </motion.div>
                            )}
                          </Card>
                        </motion.div>
                      );
                    })}
                    </div>
                  </>
                )}

                {selectedPackageId && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Card className="max-w-3xl mx-auto bg-white/90 backdrop-blur-xl shadow-xl">
                      <CardContent className="p-8">
                        {appMode === 'multi_tenant' && (
                          <div className="mb-6">
                            <Alert className="bg-blue-50 border-blue-200">
                              <Building2 className="w-5 h-5 text-blue-600" />
                              <AlertDescription className="text-blue-800">
                                <p className="font-semibold mb-2">📦 แพ็กเกจที่คุณซื้อจะใช้ได้กับทุกสาขาที่คุณมีสิทธิ์เข้าถึง</p>
                                <div className="space-y-1 text-sm">
                                  {purchasableBranches.map(branch => (
                                    <div key={branch.id} className="flex items-center gap-2">
                                      <Check className="w-4 h-4 text-blue-600" />
                                      <span>{branch.branch_name}</span>
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs mt-2 text-blue-700">
                                  💡 ราคาเดียว ใช้ได้ทุกสาขา - ไม่มีค่าใช้จ่ายเพิ่มเติม
                                </p>
                              </AlertDescription>
                            </Alert>
                          </div>
                        )}



                        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 mb-6 border border-blue-200">
                          <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">ราคาต่อเดือน</span>
                              <span className="font-semibold">{calculatePrice.monthlyPrice.toLocaleString()} ฿</span>
                            </div>
                            {calculatePrice.savings > 0 && (
                              <div className="bg-orange-50 rounded-lg p-2 border border-orange-200">
                                <p className="text-xs text-orange-700 flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  ประหยัด {calculatePrice.savings.toLocaleString()} ฿ ({calculatePrice.discountPercent}%)
                                </p>
                              </div>
                            )}
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">จำนวน {billingCycle} เดือน</span>
                              <span className="font-semibold">{calculatePrice.subtotal.toLocaleString()} ฿</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-600">VAT (7%)</span>
                              <span className="font-semibold">{calculatePrice.vat.toLocaleString()} ฿</span>
                            </div>
                            <div className="pt-3 border-t-2 border-blue-300">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-slate-800">ยอดรวม</span>
                                <span className="text-3xl font-bold text-blue-600">
                                  {calculatePrice.total.toLocaleString()} ฿
                                </span>
                              </div>
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
                                <p className="text-sm font-semibold text-slate-800">คลิกเพื่ออัปโหลดสลิป</p>
                                <p className="text-xs text-slate-500 mt-1">PNG, JPG (ไม่เกิน 10MB)</p>
                              </div>
                            )}
                          </div>
                        </label>
                      </CardContent>
                    </Card>
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-2xl mx-auto"
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
                        {errorDetails ? 'เกิดข้อผิดพลาด' : 'ตรวจสอบสลิป'}
                      </h2>
                      <p className="text-slate-600">
                        {errorDetails ? 'กรุณาตรวจสอบและลองใหม่อีกครั้ง' : 'กรุณาตรวจสอบความถูกต้องก่อนยืนยัน'}
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
                            setStep(1);
                            setErrorDetails(null);
                          }}
                          className="w-full mt-3 text-red-600 hover:text-red-700"
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
                          <span className="font-bold text-slate-800">{selectedPackage?.package_name}</span>
                        </div>
                        {appMode === 'multi_tenant' && selectedBranches.length > 1 && (
                          <div className="flex justify-between">
                            <span className="text-slate-700">จำนวนสาขา:</span>
                            <span className="font-bold text-slate-800">{selectedBranches.length} สาขา</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-slate-700">ระยะเวลา:</span>
                          <span className="font-bold text-slate-800">{billingCycle} เดือน</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-blue-200">
                          <span className="font-bold text-slate-800">ยอดรวม:</span>
                          <span className="text-2xl font-bold text-blue-600">{calculatePrice.total.toLocaleString()} ฿</span>
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
                        className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 py-6"
                      >
                        <X className="w-4 h-4 mr-2" />
                        ลองใหม่อีกครั้ง
                      </Button>
                    ) : (
                      <Button
                        onClick={handleConfirmPayment}
                        disabled={processingPayment}
                        className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 py-6"
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
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto"
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
                        <Crown className="w-12 h-12 text-green-600 mx-auto mb-3" />
                        <p className="text-green-800 font-semibold mb-2">
                          ยินดีต้อนรับสู่ {selectedPackage?.package_name}!
                        </p>
                        <p className="text-sm text-green-700">
                          ระบบจะนำคุณกลับไปยังแดชบอร์ดในอีกสักครู่...
                        </p>
                      </CardContent>
                    </Card>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}