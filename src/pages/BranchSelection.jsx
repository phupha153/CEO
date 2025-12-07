import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, ChevronRight, Settings, BarChart3, Check, Loader2, MapPin, Globe, Pencil } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function BranchSelection() {
  const navigate = useNavigate();
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: crmAccess, isLoading: crmAccessLoading, error: crmAccessError } = useQuery({
    queryKey: ['crmAccess', currentUser?.email],
    queryFn: async () => {
      const response = await base44.functions.invoke('checkCRMAccess');
      const data = response.data;

      // ⭐ ถ้าไม่มีสิทธิ์ = logout ทันที (ทุกคน ไม่เว้นแม้แต่ developer)
      if (data && data.hasAccess === false && currentUser) {
        console.warn('🚫 CRM Access denied - Logging out:', currentUser.email);
        setTimeout(() => {
          base44.auth.logout();
        }, 1500);
      }

      return data;
    },
    enabled: !!currentUser,
    staleTime: 30 * 1000,
    refetchInterval: 1 * 60 * 1000,
    refetchIntervalInBackground: true,
    retry: false, // ไม่ retry
    throwOnError: false,
  });

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: branchPackages = [] } = useQuery({
    queryKey: ['branchPackages'],
    queryFn: () => base44.entities.BranchPackage.list('-created_date', 200),
    enabled: !!currentUser,
    staleTime: 30 * 1000,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    staleTime: 5 * 60 * 1000,
  });

  // ⭐ ดึงจำนวนห้องจริงจาก Room entity
  const { data: allRooms = [] } = useQuery({
    queryKey: ['rooms', 'all'],
    queryFn: () => base44.entities.Room.list('-created_date', 5000),
    staleTime: 5 * 60 * 1000,
  });

  // นับจำนวนห้องต่อสาขา
  const roomCountByBranch = React.useMemo(() => {
    const counts = {};
    allRooms.forEach(room => {
      if (room.branch_id) {
        counts[room.branch_id] = (counts[room.branch_id] || 0) + 1;
      }
    });
    return counts;
  }, [allRooms]);

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
  
  // ⭐ แก้ไข: ไม่ใช้ || [] เพื่อให้แยก null/undefined จาก [] ได้
  const userAccessibleBranches = currentUser?.accessible_branches;

  // กรองสาขาตามสิทธิ์: ถ้ามี accessible_branches (ไม่ว่าจะ [] หรือมีค่า) ให้กรองตามนั้น, ถ้าเป็น null/undefined ให้เห็นทุกสาขา
  const hasAccessibleBranchesSet = userAccessibleBranches !== null && userAccessibleBranches !== undefined;
  const canViewAllBranches = !hasAccessibleBranchesSet;
  const filteredBranches = canViewAllBranches
    ? branches
    : branches.filter(branch => userAccessibleBranches && userAccessibleBranches.includes(branch.id));

  // เช็คว่าผู้ใช้อยู่ในโหมดทดลองหรือไม่ (ต้องมี package active และยังไม่หมดอายุ)
  const userPackages = currentUser?.email ? branchPackages.filter(bp => bp.owner_email === currentUser.email && bp.status === 'active') : [];
  
  // ⭐ เช็คว่าเป็น trial และยังไม่หมดอายุ
  const isTrialMode = userPackages.length > 0 && userPackages.every(pkg => {
    const isTrial = pkg.package_id === 'trial' || pkg.price_per_month === 0 || !pkg.price_per_month;
    if (!isTrial) return false;
    
    // เช็คว่ายังไม่หมดอายุ
    if (pkg.subscription_end_date) {
      const endDate = new Date(pkg.subscription_end_date);
      endDate.setHours(23, 59, 59, 999);
      return new Date() <= endDate;
    }
    return true;
  });
  
  const maxTrialBranches = 1;
  
  // ⭐ ถ้าไม่มี package เลย (ผู้ใช้ใหม่) = อนุญาตให้สร้างได้ 1 สาขา
  const hasNoPackageAtAll = userPackages.length === 0;
  const canAddMoreBranches = hasNoPackageAtAll || !isTrialMode || filteredBranches.length < maxTrialBranches;

  // ✅ เช็คว่าไม่มีสาขาเลย หรือไม่มีสิทธิ์ในสาขาใดเลย
  const hasNoBranches = branches.length === 0;
  const hasNoAccess = !hasNoBranches && filteredBranches.length === 0;

  const getConfigValue = (key) => {
    const globalConfig = configs.find(c => c.key === key && !c.branch_id);
    return globalConfig?.value || '';
  };

  const buildingName = getConfigValue('building_name') || 'W RESIDENTS';
  const buildingLogo = getConfigValue('building_logo') || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';

  const handleSelectBranch = (branch) => {
    if (isNavigating) return;
    
    setSelectedBranchId(branch.id);
    setIsNavigating(true);
    localStorage.setItem('selected_branch_id', branch.id);
    localStorage.setItem('selected_branch_name', branch.branch_name);
    
    setTimeout(() => {
      navigate(createPageUrl('Dashboard'));
      setIsNavigating(false);
    }, 300);
  };

  const handleViewAllBranches = () => {
    if (isNavigating) return;
    navigate(createPageUrl('AllBranchesDashboard'));
  };

  const handleManageBranches = (e) => {
    if (e) e.stopPropagation();
    if (isNavigating) return;
    navigate(createPageUrl('BranchManagement'));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-lg">กำลังโหลดข้อมูลผู้ใช้...</p>
        </div>
      </div>
    );
  }

  // ⭐ รอให้ได้ผล CRM access ก่อน (ไม่ให้ข้ามเงื่อนไข)
  if (crmAccessLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-lg">กำลังตรวจสอบสิทธิ์ CRM...</p>
        </div>
      </div>
    );
  }

  // ⭐ เช็คสิทธิ์ CRM ก่อนแสดงหน้า (ถ้า error หรือไม่มีสิทธิ์ = บล็อก)
  if (currentUser && (crmAccessError || !crmAccess || crmAccess.hasAccess === false)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-orange-50 overflow-hidden flex items-center justify-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-red-300/20 to-orange-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tr from-orange-300/20 to-pink-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-md mx-4"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-red-400/30 via-orange-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse" />
            <div className="relative w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-2xl border border-white/50 shadow-2xl flex items-center justify-center">
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl" />
              <Building2 className="w-20 h-20 text-red-500/80 relative z-10" />
            </div>
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">ไม่มีสิทธิ์เข้าใช้งาน</h2>
            <p className="text-slate-600 leading-relaxed px-4">
              อีเมล {currentUser.email} ไม่มีในระบบ<br/>
              กรุณาติดต่อผู้ดูแลระบบ
            </p>

            <Button
              onClick={() => base44.auth.logout()}
              className="mt-6 bg-white/90 hover:bg-white text-slate-800 border-0 shadow-xl backdrop-blur-sm px-8 py-6 text-base font-semibold rounded-2xl"
            >
              ออกจากระบบ
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-purple-100 overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-6xl"
        >
          <Card className="bg-white/80 backdrop-blur-2xl border border-white/60 shadow-2xl overflow-hidden rounded-3xl">
            <CardContent className="p-8">
              <div className="text-center mb-8">
                <p className="text-slate-600">เลือกสาขาที่ต้องการจัดการ</p>
              </div>

              {/* ✅ ถ้ามีสาขา → แสดงปุ่มดูภาพรวม + แก้ไขสาขา (เฉพาะ developer/owner) */}
              {!hasNoBranches && !hasNoAccess && (
                <div className="flex flex-col gap-3 mb-6 items-center">
                  <div className="flex flex-wrap gap-3 justify-center">
                    {/* ปุ่มดูภาพรวมทั้งหมด - แสดงเฉพาะเมื่อมีมากกว่า 1 สาขา และไม่ได้อยู่ใน trial mode */}
                    {filteredBranches.length > 1 && !isTrialMode && (
                      <Button
                        onClick={handleViewAllBranches}
                        disabled={isNavigating}
                        className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white h-auto py-4 px-6 text-sm shadow-lg rounded-2xl font-medium"
                      >
                        <Globe className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span>ดูภาพรวมทั้งหมด</span>
                      </Button>
                    )}
                    
                    {/* ปุ่มแก้ไขสาขา - เฉพาะ developer และ owner เท่านั้น */}
                    {(userRole === 'developer' || userRole === 'owner') && (
                      <Button
                        onClick={(e) => {
                          console.log('🔘 ปุ่มแก้ไขสาขาถูกคลิก!', { userRole, isNavigating });
                          e.stopPropagation();
                          e.preventDefault();
                          handleManageBranches(e);
                        }}
                        disabled={false}
                        variant="outline"
                        className="border-2 border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-700 h-auto py-4 px-6 text-sm rounded-2xl font-medium cursor-pointer z-50 relative"
                        data-onboarding="add-branch-button"
                        type="button"
                      >
                        <Pencil className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span>แก้ไขสาขา</span>
                      </Button>
                    )}
                    
                    {/* ปุ่ม Debug สำหรับผู้พัฒนา */}
                    {userRole === 'developer' && (
                      <Button
                        onClick={() => {
                          const debugInfo = {
                            userRole,
                            currentUser: currentUser?.email,
                            customRole: currentUser?.custom_role,
                            baseRole: currentUser?.role,
                            isNavigating,
                            canAddMoreBranches,
                            hasNoBranches,
                            hasNoAccess,
                            filteredBranchesCount: filteredBranches.length,
                            branchesCount: branches.length,
                            userAccessibleBranches,
                            hasAccessibleBranchesSet,
                            canViewAllBranches,
                            isTrialMode,
                            userPackagesCount: userPackages.length
                          };
                          console.log('🐛 DEBUG INFO:', debugInfo);
                          alert(JSON.stringify(debugInfo, null, 2));
                        }}
                        variant="outline"
                        className="border-2 border-red-300 hover:border-red-500 hover:bg-red-50 text-red-600 h-auto py-4 px-6 text-sm rounded-2xl font-medium"
                      >
                        <Settings className="w-5 h-5 mr-2 flex-shrink-0" />
                        <span>🐛 Debug Info</span>
                      </Button>
                    )}
                  </div>

                </div>
              )}

              {/* ✅ ถ้าไม่มีสาขาเลย หรือไม่มีสิทธิ์ → แสดงปุ่มเพิ่มสาขา */}
              {(hasNoBranches || hasNoAccess) ? (
                <div className="text-center py-16">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="max-w-md mx-auto"
                  >
                    <div className="relative w-32 h-32 mx-auto mb-6">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-sky-400/30 rounded-full blur-3xl animate-pulse" />
                      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-sky-600 flex items-center justify-center shadow-2xl">
                        <Building2 className="w-16 h-16 text-white" />
                      </div>
                    </div>

                    <h2 className="text-2xl font-bold text-slate-800 mb-3">
                      {hasNoBranches ? 'ยังไม่มีสาขา' : 'ยังไม่มีสาขา'}
                    </h2>
                    <p className="text-slate-600 mb-6">
                      {hasNoBranches 
                        ? 'เริ่มต้นใช้งานด้วยการเพิ่มสาขาแรกของคุณ' 
                        : 'เริ่มต้นใช้งานด้วยการเพิ่มสาขาแรกของคุณ หรือติดต่อผู้ดูแลระบบเพื่อขอเข้าถึงสาขา'}
                    </p>

                    {/* ปุ่มเพิ่มสาขา - เฉพาะ developer และ owner เท่านั้น */}
                    {(userRole === 'developer' || userRole === 'owner') ? (
                      <Button
                        onClick={(e) => {
                          console.log('🔘 ปุ่มเพิ่มสาขาถูกคลิก!', { userRole, isNavigating, canAddMoreBranches });
                          e.stopPropagation();
                          e.preventDefault();
                          handleManageBranches(e);
                        }}
                        disabled={!canAddMoreBranches}
                        className="bg-gradient-to-r from-blue-500 to-sky-600 hover:from-blue-600 hover:to-sky-700 text-white h-auto py-5 px-10 text-lg shadow-2xl rounded-2xl font-bold disabled:opacity-50 cursor-pointer z-50 relative"
                        data-onboarding="add-branch-button"
                        type="button"
                      >
                        <Building2 className="w-6 h-6 mr-3" />
                        เพิ่มตึกของคุณ
                      </Button>
                    ) : (
                      <div className="text-center">
                        <p className="text-slate-600">กรุณาติดต่อผู้ดูแลระบบเพื่อขอเข้าถึงสาขา</p>
                      </div>
                    )}
                    {!canAddMoreBranches && (
                      <p className="text-sm text-amber-700 bg-amber-50 px-6 py-3 rounded-xl border-2 border-amber-200 mt-4">
                        ⚠️ สร้างได้สูงสุด {maxTrialBranches} สาขา - อัปเกรดเพื่อเพิ่มสาขาได้ไม่จำกัด
                      </p>
                    )}
                  </motion.div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <AnimatePresence>
                    {filteredBranches.map((branch, index) => {
                    const isSelected = selectedBranchId === branch.id;
                    const isNavigatingThis = isNavigating && isSelected;

                    return (
                      <motion.div
                        key={branch.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: index * 0.1 }}
                      >
                        <Card
                          className={`transition-all duration-300 border-0 bg-white/90 overflow-hidden rounded-3xl h-full ${
                            isNavigating ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-white hover:shadow-xl hover:scale-105'
                          }`}
                          onClick={() => !isNavigating && handleSelectBranch(branch)}
                        >
                          <CardContent className="p-6">
                            <div className="flex flex-col items-center text-center gap-4">
                              <div className="relative">
                                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl blur-md opacity-30" />
                                <div className="relative w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center shadow-lg">
                                  <Building2 className="w-10 h-10 text-white" />
                                </div>
                              </div>

                              <div className="w-full">
                                <h3 className="text-xl font-bold text-slate-800 mb-1">
                                  {branch.branch_name}
                                </h3>
                                <p className="text-sm text-slate-500 font-semibold mb-3">{branch.branch_code}</p>
                                
                                <div className="flex items-center justify-center gap-2 mb-3">
                                  <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full">
                                    <Building2 className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-semibold text-blue-700">{roomCountByBranch[branch.id] || 0}</span>
                                    <span className="text-xs text-blue-600">ห้อง</span>
                                  </div>
                                </div>

                                {branch.address && (
                                  <div className="flex items-start justify-center gap-1.5 text-left">
                                    <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                                    <span className="text-xs text-slate-500 line-clamp-2">{branch.address}</span>
                                  </div>
                                )}
                              </div>

                              <div className="w-full">
                                {isNavigatingThis ? (
                                  <div className="w-full py-2 rounded-full bg-green-100 flex items-center justify-center">
                                    <Check className="w-5 h-5 text-green-600 mr-2" />
                                    <span className="text-sm font-semibold text-green-700">กำลังเข้าสู่ระบบ</span>
                                  </div>
                                ) : (
                                  <div className="w-full py-2 rounded-full bg-slate-100 flex items-center justify-center hover:bg-blue-100 transition-colors">
                                    <span className="text-sm font-semibold text-slate-600">เลือกสาขา</span>
                                    <ChevronRight className="w-4 h-4 text-slate-400 ml-1" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                    })}
                  </AnimatePresence>
                </div>
              )}


            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}