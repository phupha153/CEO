import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Crown, Check, Upload, Loader2, CheckCircle, ArrowLeft, X, AlertCircle, Building2, Users, Settings, Sparkles, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PackageSelectionPage() {
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [billingCycle, setBillingCycle] = useState('1');
  const [debugMode, setDebugMode] = useState(false);
  const [expandedPackageId, setExpandedPackageId] = useState(null);
  const [discountCode, setDiscountCode] = useState('');
  const [validatingDiscount, setValidatingDiscount] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'developer' : 'employee');
  const userPermissions = currentUser?.permissions || [];

  // ⭐ เช็คสิทธิ์เข้าถึงหน้าแพ็กเกจ
  const hasPackageAccess = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('settings_access_package_page');

  // ⭐ ถ้าไม่มีสิทธิ์ = แสดงหน้าไม่มีสิทธิ์
  const shouldShowNoAccess = currentUser && !hasPackageAccess;

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list()
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list()
  });

  // ⭐ ไม่ใช้ BranchPackage แล้ว - ดูจาก currentUser.plan_status แทน
  const expiredPackageType = useMemo(() => {
    if (!currentUser) return null;
    if (currentUser.plan_status === 'trial' || !currentUser.package_id) {
      return 'trial';
    }
    return 'paid';
  }, [currentUser]);

  const { data: crmPackages, isLoading: loadingPackages } = useQuery({
    queryKey: ['crmPackages'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPackagesFromCRM', {});
      return response.data;
    }
  });

  const getConfigValue = (key, defaultValue = '') => {
    const config = configs.find((c) => c.key === key && !c.branch_id);
    return config?.value || defaultValue;
  };

  const bankName = getConfigValue('bank_name', 'ธนาคารกสิกรไทย');
  const accountNumber = getConfigValue('bank_account_number', 'xxx-x-xxxxx-x');
  const accountName = getConfigValue('bank_account_name', 'บริษัท...');
  const promptpay = getConfigValue('promptpay', '0812345678');
  const appMode = getConfigValue('app_mode', 'single_tenant');

  const userAccessibleBranches = currentUser?.accessible_branches || [];
  const purchasableBranches = useMemo(() => {
    const canViewAllBranches = userRole === 'developer' && (!userAccessibleBranches || userAccessibleBranches.length === 0);
    if (canViewAllBranches) return branches;
    return branches.filter((b) => userAccessibleBranches.includes(b.id));
  }, [branches, userRole, userAccessibleBranches]);

  const packages = (crmPackages?.packages || [])
    .filter((p) => p.app_system === 'dormitory')
    .sort((a, b) => {
      const priceA = a.pricing?.monthly || a.price_monthly || 0;
      const priceB = b.pricing?.monthly || b.price_monthly || 0;
      return priceA - priceB;
    });

  const selectedPackage = packages.find((p) => p.id === selectedPackageId);

  const calculatePrice = useMemo(() => {
    if (!selectedPackage || !billingCycle) return { subtotal: 0, vat: 0, total: 0, branchCount: 0, discount: 0, monthlyPrice: 0, baseMonthlyPrice: 0, discountPercent: 0, savings: 0, discountAmount: 0, finalTotal: 0 };
    const months = parseInt(billingCycle);
    const pricing = selectedPackage.pricing || {};
    const hasNewStructure = pricing.monthly !== undefined;
    let baseMonthlyPrice = hasNewStructure ? pricing.monthly || 0 : selectedPackage.price_monthly || 0;
    let totalPrice = 0;
    let monthlyPrice = baseMonthlyPrice;
    let savings = 0;
    if (months === 1) { totalPrice = baseMonthlyPrice; monthlyPrice = baseMonthlyPrice; }
    else if (months === 3) { totalPrice = hasNewStructure ? pricing.three_months || baseMonthlyPrice * 3 : selectedPackage.price_3_months || baseMonthlyPrice * 3; monthlyPrice = hasNewStructure ? pricing.three_months_per_month || baseMonthlyPrice : totalPrice / 3; savings = baseMonthlyPrice * 3 - totalPrice; }
    else if (months === 6) { totalPrice = hasNewStructure ? pricing.six_months || baseMonthlyPrice * 6 : selectedPackage.price_6_months || baseMonthlyPrice * 6; monthlyPrice = hasNewStructure ? pricing.six_months_per_month || baseMonthlyPrice : totalPrice / 6; savings = baseMonthlyPrice * 6 - totalPrice; }
    else if (months === 12) { totalPrice = hasNewStructure ? pricing.yearly || baseMonthlyPrice * 12 : selectedPackage.price_yearly || baseMonthlyPrice * 12; monthlyPrice = hasNewStructure ? pricing.yearly_per_month || baseMonthlyPrice : totalPrice / 12; savings = baseMonthlyPrice * 12 - totalPrice; }
    else if (months === 24) { totalPrice = selectedPackage.price_2_years || baseMonthlyPrice * 24; monthlyPrice = totalPrice / 24; savings = baseMonthlyPrice * 24 - totalPrice; }
    else if (months === 36) { totalPrice = selectedPackage.price_3_years || baseMonthlyPrice * 36; monthlyPrice = totalPrice / 36; savings = baseMonthlyPrice * 36 - totalPrice; }
    const subtotal = totalPrice;
    const discountPercent = savings > 0 && baseMonthlyPrice > 0 ? Math.round(savings / (baseMonthlyPrice * months) * 100) : 0;
    const discountAmount = appliedDiscount?.discount_amount || 0;
    const finalTotal = Math.max(0, subtotal - discountAmount);
    return { subtotal, vat: 0, total: subtotal, branchCount: selectedPackage.max_branches || 0, userCount: selectedPackage.max_users || 0, discount: discountPercent, discountPercent, savings, monthlyPrice, baseMonthlyPrice, discountAmount, finalTotal };
  }, [selectedPackage, billingCycle, appliedDiscount]);

  if (shouldShowNoAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-orange-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md mx-auto text-center">

          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-red-400/30 via-orange-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse" />
            <div className="relative w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-2xl border border-white/50 shadow-2xl flex items-center justify-center">
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl" />
              <AlertCircle className="w-20 h-20 text-red-500/80 relative z-10" />
            </div>
          </div>

          <h2 className="text-3xl font-bold text-slate-800 mb-4">ไม่มีสิทธิ์เข้าถึง</h2>
          <p className="text-slate-600 text-lg leading-relaxed mb-8">
            คุณไม่มีสิทธิ์เข้าถึงหน้าจัดการแพ็กเกจ<br />
            กรุณาติดต่อผู้ดูแลระบบ
          </p>

          <Button
            onClick={() => navigate(createPageUrl('Dashboard'))}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-6 text-base font-semibold rounded-2xl shadow-xl">

            <ArrowLeft className="w-5 h-5 mr-2" />
            กลับหน้าหลัก
          </Button>
        </motion.div>
      </div>);

  }

  const handleValidateDiscount = async () => {
    if (!discountCode.trim()) {
      toast.error('กรุณาใส่รหัสส่วนลด');
      return;
    }

    setValidatingDiscount(true);
    try {
      const result = await base44.functions.invoke('validateDiscountCode', {
        code: discountCode.trim(),
        package_id: selectedPackageId,
        total_amount: calculatePrice.subtotal
      });

      if (result.data.success) {
        setAppliedDiscount(result.data);
        toast.success(`ใช้รหัสส่วนลดสำเร็จ! ลด ${result.data.discount_amount.toLocaleString()} บาท`);
      } else {
        toast.error(result.data.error || 'รหัสส่วนลดไม่ถูกต้อง');
        setAppliedDiscount(null);
      }
    } catch (error) {
      toast.error('ไม่สามารถตรวจสอบรหัสส่วนลดได้');
      setAppliedDiscount(null);
    } finally {
      setValidatingDiscount(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-orange-50 relative overflow-hidden">
      {/* Gradient Background Blobs */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/15 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-orange-400/15 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 p-4 flex items-center justify-between">
        <Button
          onClick={() => navigate(createPageUrl('Dashboard'))}
          variant="ghost"
          className="text-slate-600 hover:text-slate-800">

          <ArrowLeft className="w-4 h-4 mr-2" />
          กลับ
        </Button>
        <div className="flex items-center gap-2">
          {userRole === 'developer' &&
          <>
              <Button
              onClick={() => navigate(createPageUrl('UserBranchAccess'))}
              variant="outline"
              size="sm"
              className="text-purple-600 border-purple-300 hover:bg-purple-50">

                <Settings className="w-4 h-4 mr-1" />
                ตั้งค่าสิทธิ์สาขา
              </Button>
              <Button
              onClick={() => setDebugMode(!debugMode)}
              variant="outline"
              size="sm"
              className="text-xs">

                {debugMode ? '🐛 ปิด Debug' : '🐛 เปิด Debug'}
              </Button>
            </>
          }
        </div>
      </div>

      <div className="relative z-10 min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
        <div className="w-full max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}>

            <div className="text-center mb-6 md:mb-8 px-4">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-black mb-4 md:mb-6 leading-tight">
                <span className="text-slate-900">งานหอพัก </span>
                <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">1 วัน</span><br />
                <span className="text-slate-900">เสร็จภายใน </span>
                <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">5 นาที</span>
              </h1>
              <div className="flex items-center justify-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-600 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="whitespace-nowrap">ส่งแจ้งเตือนค่าเช่า-เกินกำหนดอัตโนมัติ</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="whitespace-nowrap">บัญชีเสร็จใน 5 นาที</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="whitespace-nowrap">ระบบตรวจสอบสลิป</span>
                </div>
              </div>
              
              {/* Duration Selection - All Options with Scroll */}
              <div className="flex justify-center mt-5 px-4">
                <div className="w-full max-w-3xl overflow-x-auto scrollbar-hide">
                  <div className="bg-white my-2 p-1.5 rounded-xl inline-flex items-center gap-1.5 sm:gap-2 sm:p-2 shadow-md min-w-max">
                    {[
                    { months: '1', label: '1 เดือน', save: null },
                    { months: '3', label: '3 เดือน', save: 'ลด 5%' },
                    { months: '6', label: '6 เดือน', save: 'ลด 10%' },
                    { months: '12', label: '1 ปี', save: 'ลด 15%' },
                    { months: '24', label: '2 ปี', save: 'ลด 25%' },
                    { months: '36', label: '3 ปี', save: 'ลด 35%' }].
                    map(({ months, label, save }) =>
                    <button
                      key={months}
                      onClick={() => setBillingCycle(months)}
                      className={`px-3 sm:px-4 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                      billingCycle === months ?
                      'bg-orange-500 text-white shadow-lg' :
                      'text-slate-600 hover:bg-slate-50'}`
                      }>

                        <div>{label}</div>
                        {save &&
                      <div className={`text-[10px] font-medium mt-0.5 ${
                      billingCycle === months ? 'text-white/90' : 'text-green-600'}`
                      }>
                            {save}
                          </div>
                      }
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {loadingPackages ?
            <div className="text-center py-12">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
                <p className="text-slate-600">กำลังโหลดแพ็กเกจ...</p>
              </div> :
            packages.length === 0 ?
            <div className="max-w-2xl mx-auto">
                <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5 }}>

                  {/* Decorative Background */}
                  <div className="relative mb-8">
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-400/30 via-red-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse" />
                    <div className="relative w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-2xl border border-white/50 shadow-2xl flex items-center justify-center">
                      <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl" />
                      <AlertCircle className="w-20 h-20 text-orange-500/80 relative z-10" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="text-center space-y-6 px-4">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-800 mb-3">ไม่พบแพ็กเกจในระบบ</h2>
                      <p className="text-slate-600 text-lg leading-relaxed">
                        ขออภัยค่ะ ขณะนี้ยังไม่มีแพ็กเกจที่พร้อมให้บริการ<br />
                        กรุณาติดต่อเจ้าหน้าที่เพื่อสอบถามข้อมูลเพิ่มเติม
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                      <Button
                      onClick={() => window.open('https://line.me/R/ti/p/@022kpkpo', '_blank')}
                      className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white px-8 py-6 text-base font-semibold rounded-2xl shadow-xl">

                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.193 0-.378-.09-.503-.234l-1.89-2.181v1.787c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.27.173-.51.43-.595.063-.021.13-.03.196-.03.195 0 .38.089.503.234l1.89 2.181V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.001zm-5.741 0c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.003zm-2.466.63H4.917c-.345 0-.63-.285-.63-.63V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629z" />
                        </svg>
                        ติดต่อเจ้าหน้าที่
                      </Button>
                      <Button
                      onClick={() => navigate(createPageUrl('Dashboard'))}
                      variant="outline"
                      className="border-slate-300 text-slate-700 hover:bg-slate-50 px-8 py-6 text-base font-semibold rounded-2xl">

                        <ArrowLeft className="w-5 h-5 mr-2" />
                        กลับหน้าหลัก
                      </Button>
                    </div>
                  </div>

                  {/* Debug Mode */}
                  {debugMode && crmPackages &&
                <details className="text-left bg-yellow-50 border-2 border-yellow-300 p-4 rounded-lg mt-8">
                      <summary className="cursor-pointer font-semibold text-yellow-900 mb-2">🐛 Debug: ข้อมูลจาก CRM</summary>
                      <pre className="text-xs mt-2 overflow-auto max-h-96 text-slate-700 bg-white p-3 rounded">
                        {JSON.stringify(crmPackages, null, 2)}
                      </pre>
                    </details>
                }
                </motion.div>
              </div> :

            <>
                {debugMode && userRole === 'developer' &&
              <div className="mb-6 bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4 max-w-4xl mx-auto">
                    <p className="font-bold text-yellow-900 mb-3">🐛 Debug Mode</p>
                    
                    <div className="mb-4">
                      <p className="font-semibold text-yellow-900 mb-2">📦 All CRM Packages:</p>
                      <pre className="text-xs bg-white p-3 rounded overflow-auto max-h-48 text-slate-700 whitespace-pre-wrap">
                        {JSON.stringify(crmPackages, null, 2)}
                      </pre>
                    </div>

                    {selectedPackage &&
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
                }
                  </div>
              }

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
                  {packages.map((pkg, index) => {
                  const isMostPopular = pkg.popular === true;
                  const isSelected = selectedPackageId === pkg.id;
                  const isDisabled = pkg.is_active === false;

                  // กำหนดไอคอนและสีตาม package_name - รองรับทั้ง string และ object
                  const pkgName = typeof pkg.package_name === 'string' ?
                  pkg.package_name :
                  pkg.package_name && typeof pkg.package_name === 'object' && pkg.package_name.name ?
                  String(pkg.package_name.name) :
                  '';
                  const isBasic = pkgName.toLowerCase().includes('basic') || pkgName.toLowerCase().includes('nano');
                  const isPro = pkgName.toLowerCase().includes('pro') || pkgName.toLowerCase().includes('micro');
                  const isElite = !isBasic && !isPro;

                  const packageIcon = isBasic ? Settings : isPro ? Sparkles : Crown;

                  return (
                    <motion.div
                      key={pkg.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="relative">

                        <Card className={`h-full transition-all overflow-hidden rounded-[2rem] border-0 ${
                      isDisabled ?
                      'cursor-not-allowed opacity-60 grayscale' :
                      'cursor-pointer hover:shadow-2xl'} ${

                      isSelected && !isDisabled ? 'ring-4 ring-blue-500 ring-offset-4' : 'shadow-lg'} bg-slate-100`
                      }
                      onClick={() => {
                        if (isDisabled) return;
                        setSelectedPackageId(pkg.id);
                      }}>

                          {isDisabled &&
                        <div className="absolute -top-4 left-0 right-0 flex justify-center">
                              <Badge className="bg-slate-600 text-slate-300 border-0 px-4 py-1.5 text-xs font-bold rounded-t-lg rounded-b-none">
                                ปิดการขาย
                              </Badge>
                            </div>
                        }
                          {isMostPopular && !isDisabled &&
                        <div className="absolute -top-4 left-0 right-0 flex justify-center">
                              <Badge className="bg-orange-500 text-white border-0 px-4 py-1.5 text-xs font-bold rounded-t-lg rounded-b-none">
                                MOST POPULAR
                              </Badge>
                            </div>
                        }

                          <CardContent className="p-0 h-full flex flex-col">
                            {/* Top Section with gradient background */}
                            <div className={`p-6 rounded-t-[1.75rem] ${
                          isBasic ?
                          'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950' :
                          isPro ?
                          'bg-gradient-to-br from-blue-200 via-purple-100 to-pink-100' :
                          'bg-gradient-to-br from-amber-200 via-yellow-100 to-orange-100'}`
                          }>
                              {/* Header: Badge + Icon */}
                              <div className="flex items-start justify-between mb-6">
                                <Badge className={`text-xs px-4 py-1.5 rounded-full font-semibold ${
                              isBasic ?
                              'bg-slate-600 text-white' :
                              isPro ?
                              'bg-gradient-to-r from-blue-500 to-purple-500 text-white' :
                              'bg-gradient-to-r from-amber-600 to-yellow-500 text-white'}`
                              }>
                                  {isBasic ? 'Basic' : isPro ? 'Pro' : 'Elite'}
                                </Badge>
                                {/* Package Name - hidden, just for reference */}
                                {/* {pkgName} */}
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                              isBasic ?
                              'bg-slate-700/50' :
                              isPro ?
                              'bg-blue-500/20' :
                              'bg-amber-500/30'}`
                              }>
                                  {React.createElement(packageIcon, {
                                  className: `w-8 h-8 ${
                                  isBasic ? 'text-blue-400' : isPro ? 'text-blue-600' : 'text-amber-700'}`

                                })}
                                </div>
                              </div>

                              {/* Price */}
                              <div className="mb-2">
                                {(() => {
                                const months = parseInt(billingCycle);
                                const pricing = pkg.pricing || {};
                                const hasNewStructure = pricing.monthly !== undefined;

                                const basePrice = hasNewStructure ? pricing.monthly || 0 : pkg.price_monthly || 0;
                                let displayPrice = basePrice;

                                if (months === 3) {
                                  displayPrice = hasNewStructure ? pricing.three_months_per_month || basePrice : (pkg.price_3_months || basePrice * 3) / 3;
                                } else if (months === 6) {
                                  displayPrice = hasNewStructure ? pricing.six_months_per_month || basePrice : (pkg.price_6_months || basePrice * 6) / 6;
                                } else if (months === 12) {
                                  displayPrice = hasNewStructure ? pricing.yearly_per_month || basePrice : (pkg.price_yearly || basePrice * 12) / 12;
                                } else if (months === 24) {
                                  displayPrice = (pkg.price_2_years || basePrice * 24) / 24;
                                } else if (months === 36) {
                                  displayPrice = (pkg.price_3_years || basePrice * 36) / 36;
                                }

                                return (
                                  <div className="flex items-baseline gap-1">
                                         <span className={`text-4xl font-bold ${isBasic ? 'text-white' : isElite ? 'text-amber-900' : 'text-slate-900'}`}>
                                           ฿{Math.round(displayPrice).toLocaleString()}
                                         </span>
                                         <span className={`text-sm ${isBasic ? 'text-slate-400' : isElite ? 'text-amber-700' : 'text-slate-600'}`}>/เดือน</span>
                                       </div>);

                              })()}
                              </div>

                              {/* Description */}
                              <p className={`text-sm ${isBasic ? 'text-slate-400' : isElite ? 'text-amber-800' : 'text-slate-600'}`}>
                                {(() => {
                                if (typeof pkg.description === 'string') return pkg.description;
                                if (pkg.description && typeof pkg.description === 'object') {
                                  if (pkg.description.name) return String(pkg.description.name);
                                  if (pkg.description.text) return String(pkg.description.text);
                                  return '';
                                }
                                return isBasic ? 'Perfect For Small Teams' : isPro ? 'Perfect For Growing Teams' : 'For Large Organizations';
                              })()}
                              </p>
                            </div>

                            {/* Bottom Section with white background */}
                            <div className="p-6 bg-white rounded-b-[1.75rem] flex-1 flex flex-col">
                              {/* Users & Branches info */}
                              <div className="flex items-center gap-4 mb-4 text-sm">
                                <div className="flex items-center gap-1.5">
                                  <Users className="w-4 h-4 text-slate-400" />
                                  <span className="text-slate-600">
                                    {(() => {
                                    if (pkg.max_users === null || pkg.max_users === undefined) return 'ไม่จำกัด';
                                    if (typeof pkg.max_users === 'object') return 'ไม่จำกัด';
                                    if (typeof pkg.max_users === 'number') return String(pkg.max_users);
                                    if (typeof pkg.max_users === 'string') return pkg.max_users;
                                    return 'ไม่จำกัด';
                                  })()} ผู้ใช้
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Building2 className="w-4 h-4 text-slate-400" />
                                  <span className="text-slate-600">
                                    {(() => {
                                    if (pkg.max_branches === null || pkg.max_branches === undefined) return 'ไม่จำกัด';
                                    if (typeof pkg.max_branches === 'object') return 'ไม่จำกัด';
                                    if (typeof pkg.max_branches === 'number') return String(pkg.max_branches);
                                    if (typeof pkg.max_branches === 'string') return pkg.max_branches;
                                    return 'ไม่จำกัด';
                                  })()} สาขา
                                  </span>
                                </div>
                              </div>

                              {/* Button */}
                              <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (isDisabled) return;

                                const pkgName = typeof pkg.package_name === 'string' ?
                                pkg.package_name :
                                pkg.package_name?.name ? String(pkg.package_name.name) : '';

                                const pricing = pkg.pricing || {};
                                const hasNewStructure = pricing.monthly !== undefined;
                                const basePrice = hasNewStructure ? pricing.monthly || 0 : pkg.price_monthly || 0;
                                const months = parseInt(billingCycle);

                                let totalPrice = basePrice * months;
                                let monthlyPrice = basePrice;

                                if (months === 3) {
                                  totalPrice = hasNewStructure ? pricing.three_months || basePrice * 3 : pkg.price_3_months || basePrice * 3;
                                  monthlyPrice = hasNewStructure ? pricing.three_months_per_month || basePrice : totalPrice / 3;
                                } else if (months === 6) {
                                  totalPrice = hasNewStructure ? pricing.six_months || basePrice * 6 : pkg.price_6_months || basePrice * 6;
                                  monthlyPrice = hasNewStructure ? pricing.six_months_per_month || basePrice : totalPrice / 6;
                                } else if (months === 12) {
                                  totalPrice = hasNewStructure ? pricing.yearly || basePrice * 12 : pkg.price_yearly || basePrice * 12;
                                  monthlyPrice = hasNewStructure ? pricing.yearly_per_month || basePrice : totalPrice / 12;
                                }

                                navigate(createPageUrl('PackagePaymentPage'), {
                                  state: {
                                    packageData: {
                                      packageId: pkg.id,
                                      packageName: pkgName,
                                      durationMonths: months,
                                      monthlyPrice: monthlyPrice,
                                      subtotal: totalPrice,
                                      discountCode: null,
                                      discountAmount: 0,
                                      finalTotal: totalPrice,
                                      isFree: false
                                    }
                                  }
                                });
                              }}
                              disabled={isDisabled}
                              className={`w-full py-4 text-sm font-semibold rounded-2xl mb-6 transition-all ${
                              isDisabled ?
                              'bg-slate-300 text-slate-500 cursor-not-allowed' :
                              isBasic ?
                              'bg-slate-900 text-white hover:bg-slate-800' :
                              isPro ?
                              'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600 shadow-md' :
                              'bg-gradient-to-r from-amber-500 to-yellow-500 text-white hover:from-amber-600 hover:to-yellow-600 shadow-md'}`
                              }>

                                เลือกแพ็กเกจนี้
                              </Button>

                              {/* Features */}
                              <div className="space-y-3 flex-1">
                                {(() => {
                                if (!Array.isArray(pkg.features)) return null;

                                // Get highlighted first, then others
                                const highlighted = pkg.features.filter((f) => f && typeof f === 'object' && f.is_highlighted === true);
                                const featuresToShow = highlighted.length > 0 ? highlighted.slice(0, 5) : pkg.features.slice(0, 5);

                                const result = [];
                                for (let idx = 0; idx < featuresToShow.length; idx++) {
                                  const feature = featuresToShow[idx];
                                  let text = '';
                                  if (typeof feature === 'string') {
                                    text = feature;
                                  } else if (feature && typeof feature === 'object' && feature.name !== undefined) {
                                    text = typeof feature.name === 'string' ? feature.name : '';
                                  }
                                  if (!text) continue;
                                  result.push(
                                    <div key={idx} className="flex items-start gap-2">
                                        <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                                        <span className="text-sm text-slate-600">{text}</span>
                                      </div>
                                  );
                                }
                                return result;
                              })()}
                                
                                {/* ปุ่มดูเพิ่มเติม */}
                                {Array.isArray(pkg.features) && pkg.features.length > 0 &&
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedPackageId(expandedPackageId === pkg.id ? null : pkg.id);
                                }}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-2">

                                    {expandedPackageId === pkg.id ? 'ซ่อน' : 'ดูเพิ่มเติม'}
                                  </button>
                              }
                                
                                {/* แสดง features ทั้งหมดเมื่อกด expand */}
                                {expandedPackageId === pkg.id && Array.isArray(pkg.features) &&
                              <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                                    {(() => {
                                  // Get highlighted features
                                  const highlighted = pkg.features.filter((f) => f && typeof f === 'object' && f.is_highlighted === true);
                                  const hasHighlighted = highlighted.length > 0;

                                  // Create set of shown feature names
                                  const shownFeatures = new Set();
                                  const featuresShownAbove = hasHighlighted ? highlighted.slice(0, 5) : pkg.features.slice(0, 5);
                                  for (let i = 0; i < featuresShownAbove.length; i++) {
                                    const f = featuresShownAbove[i];
                                    if (typeof f === 'string') shownFeatures.add(f);else
                                    if (f && typeof f === 'object' && typeof f.name === 'string') shownFeatures.add(f.name);
                                  }

                                  const result = [];
                                  for (let idx = 0; idx < pkg.features.length; idx++) {
                                    const feature = pkg.features[idx];
                                    let text = '';
                                    if (typeof feature === 'string') {
                                      text = feature;
                                    } else if (feature && typeof feature === 'object' && feature.name !== undefined) {
                                      text = typeof feature.name === 'string' ? feature.name : '';
                                    }

                                    if (!text) continue;
                                    if (shownFeatures.has(text)) continue; // Skip already shown

                                    result.push(
                                      <div key={idx} className="flex items-start gap-2">
                                            <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-300" />
                                            <span className="text-sm text-slate-500">{text}</span>
                                          </div>
                                    );
                                  }
                                  return result;
                                })()}
                                  </div>
                              }
                              </div>
                            </div>
                          </CardContent>

                          {isSelected &&
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="absolute -top-2 -right-2 w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shadow-xl z-10">

                              <Check className="w-6 h-6 text-white" />
                            </motion.div>
                        }
                        </Card>
                      </motion.div>);

                })}
                </div>
              </>
            }
          </motion.div>
        </div>
      </div>
    </div>);

}