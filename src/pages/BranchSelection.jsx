import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, ChevronRight, Settings, BarChart3, Check, Loader2, MapPin, Globe, Pencil, Bug, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

export default function BranchSelection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedBranchId, setSelectedBranchId] = useState(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    branch_name: '',
    branch_code: '',
    address: '',
    phone: '',
    manager_name: '',
    image_url: '',
    status: 'active',
    description: '',
    bill_generation_day: '',
    payment_due_day: ''
  });

  const { data: currentUser, isLoading: userLoading, isSuccess: userSuccess } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 3000),
  });

  const { data: crmAccess, isLoading: crmAccessLoading, error: crmAccessError } = useQuery({
    queryKey: ['crmAccess', currentUser?.email],
    queryFn: async () => {
      // ⭐ Safety: ตรวจสอบว่า user พร้อมจริงๆ ก่อนเรียก CRM
      if (!currentUser?.email || !currentUser?.id) {
        console.warn('⚠️ User not fully loaded - blocking access');
        return { hasAccess: false, reason: 'User not loaded' };
      }

      const response = await base44.functions.invoke('checkCRMAccess');
      const data = response.data;

      // 🔒 FAIL-CLOSED: ถ้ามี error/timeout → DENY ACCESS (ไม่ fallback เป็น allow)
      if (!data || data.error) {
        console.error('❌ CRM check error - DENYING access for security');
        return { hasAccess: false, reason: 'CRM error' };
      }

      // ⚠️ Timeout = ปัญหาเครือข่าย → DENY (แทนที่จะ allow)
      if (data.timeout) {
        console.warn('⏱️ CRM timeout - DENYING access for security');
        return { hasAccess: false, reason: 'CRM timeout' };
      }

      // ⚡ INSTANT LOGOUT: ถ้า CRM deny ชัดเจน → logout + redirect
      if (data.hasAccess === false && currentUser?.email) {
        console.warn('🚫 CRM Access denied - Immediate logout:', currentUser.email);
        const welcomeUrl = window.location.origin + '/Welcome';
        base44.auth.logout(welcomeUrl);
        return data;
      }

      return data;
    },
    enabled: !!currentUser && !userLoading && userSuccess,
    staleTime: 10 * 60 * 1000, // ⚡ Cache 10 นาที (ลด API calls)
    refetchInterval: false, // ⚠️ ปิด auto-refetch (เช็คเฉพาะตอน reload)
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true, // ✅ เช็คใหม่เมื่อกลับมาที่หน้าต่าง
    retry: 1,
    retryDelay: 500,
    throwOnError: false,
  });

  // 🔒 รอให้ CRM check เสร็จก่อนถึงจะโหลดข้อมูล
  const canLoadData = !crmAccessLoading && crmAccess && crmAccess.hasAccess !== false;

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    enabled: canLoadData && !!currentUser,
    retry: 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    enabled: canLoadData && !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  // ⭐ ดึงจำนวนห้องจริงจาก Room entity - ใช้ Backend
  const { data: allRooms = [] } = useQuery({
    queryKey: ['rooms', 'all', 'secure'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Room',
        filters: {},
        limit: 5000
      });
      return response.data.data;
    },
    enabled: canLoadData && !!currentUser,
    retry: 2,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
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
  
  // ⭐ Security Fix: กรองสาขาตามสิทธิ์
  const userAccessibleBranches = currentUser?.accessible_branches;
  const hasAccessibleBranchesSet = userAccessibleBranches !== null && userAccessibleBranches !== undefined;

  // ⭐ กรองสาขาตาม role และ accessible_branches
  const filteredBranches = React.useMemo(() => {
    // Developer = เห็นทุกสาขา
    if (userRole === 'developer') return branches;

    // ถ้ามี accessible_branches set แล้ว (ไม่ว่าจะ [] หรือมีค่า) = ใช้ลิสต์นั้น
    if (hasAccessibleBranchesSet) {
      return branches.filter(branch => userAccessibleBranches.includes(branch.id));
    }

    // ถ้าไม่มี accessible_branches set (null/undefined)
    // Owner = เห็นสาขาที่ตัวเองเป็นเจ้าของ (owner_id หรือ created_by)
    if (userRole === 'owner') {
      return branches.filter(branch => 
        branch.owner_id === currentUser?.email || 
        branch.created_by === currentUser?.email
      );
    }

    // Employee/Manager ที่ไม่มี accessible_branches = ไม่เห็นสาขาใดเลย
    return [];
  }, [branches, userRole, hasAccessibleBranchesSet, userAccessibleBranches, currentUser?.email]);

  console.log('🔍 BranchSelection Debug:', {
    userRole,
    isDeveloper: userRole === 'developer',
    isOwner: userRole === 'owner',
    canSeeBranchManagementButton: userRole === 'developer' || userRole === 'owner',
    currentUser: currentUser?.email,
    customRole: currentUser?.custom_role,
    role: currentUser?.role,
    hasAccessibleBranchesSet,
    accessibleBranches: userAccessibleBranches,
    filteredBranchesCount: filteredBranches.length,
    totalBranchesCount: branches.length,
    ownedBranches: branches.filter(b => b.owner_id === currentUser?.email).length
  });

  const { data: crmPackages } = useQuery({
    queryKey: ['crmPackages'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPackagesFromCRM', {});
      return response.data;
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  // ⭐ เช็คจำนวนสาขาที่ user เป็นเจ้าของ (owner_id = email)
  const userOwnedBranches = branches.filter(b => b.owner_id === currentUser?.email);
  const isTrialMode = currentUser?.plan_status === 'trial';
  
  // Trial = 1 สาขา, Active = unlimited
  const maxAllowedBranches = isTrialMode ? 1 : 999;
  
  // ⭐ พนักงานสร้างสาขาไม่ได้เลย, เฉพาะ owner/developer
  const canAddMoreBranches = (userRole === 'developer' || userRole === 'owner') && 
                              (userRole === 'developer' || userOwnedBranches.length < maxAllowedBranches);

  // ✅ เช็คว่าไม่มีสาขาเลย หรือไม่มีสิทธิ์ในสาขาใดเลย
  const hasNoBranches = branches.length === 0;
  const hasNoAccess = !hasNoBranches && filteredBranches.length === 0;

  const getConfigValue = (key) => {
    const globalConfig = configs.find(c => c.key === key && !c.branch_id);
    return globalConfig?.value || '';
  };

  const buildingName = getConfigValue('building_name') || 'W RESIDENTS';
  const buildingLogo = getConfigValue('building_logo') || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const branchData = { ...data };
      delete branchData.bill_generation_day;
      delete branchData.payment_due_day;
      return await base44.entities.Branch.create(branchData);
    },
    onSuccess: async (newBranch, variables) => {
      queryClient.invalidateQueries(['branches']);

      try {
        const defaultConfigs = [
          { key: 'building_name', value: '', value_type: 'string', description: 'ชื่อหอพัก', category: 'general' },
          { key: 'water_rate', value: '18', value_type: 'number', description: 'ค่าน้ำต่อหน่วย (บาท)', category: 'billing' },
          { key: 'electricity_rate', value: '8', value_type: 'number', description: 'ค่าไฟต่อหน่วย (บาท)', category: 'billing' },
          { key: 'bill_generation_day', value: '27', value_type: 'number', description: 'วันที่สร้างบิลอัตโนมัติ', category: 'billing' },
          { key: 'pay_day', value: '5', value_type: 'number', description: 'วันครบกำหนดชำระเงิน', category: 'billing' },
        ];

        const configsToCreate = defaultConfigs.map(config => ({
          ...config,
          branch_id: newBranch.id,
        }));

        await base44.entities.Config.bulkCreate(configsToCreate);
      } catch (error) {
        console.error('Failed to create default configs:', error);
      }

      if (variables.bill_generation_day) {
        try {
          await base44.entities.Config.create({
            branch_id: newBranch.id,
            key: 'bill_generation_day',
            value: variables.bill_generation_day,
            value_type: 'number',
            description: 'วันที่สร้างบิลอัตโนมัติ',
            category: 'billing'
          });
        } catch (error) {
          console.error('Failed to create bill_generation_day:', error);
        }
      }

      if (variables.payment_due_day) {
        try {
          await base44.entities.Config.create({
            branch_id: newBranch.id,
            key: 'pay_day',
            value: variables.payment_due_day,
            value_type: 'number',
            description: 'วันครบกำหนดชำระเงิน',
            category: 'billing'
          });
        } catch (error) {
          console.error('Failed to create pay_day:', error);
        }
      }

      queryClient.invalidateQueries(['configs']);

      try {
        const currentBranches = userAccessibleBranches || [];
        const updatedBranches = [...currentBranches, newBranch.id];
        await base44.entities.User.update(currentUser.id, {
          accessible_branches: updatedBranches,
          custom_role: 'owner'
        });
        queryClient.invalidateQueries(['currentUser']);
      } catch (error) {
        console.error('Failed to update user branch access:', error);
      }

      try {
        // ⭐ Init user trial (ถ้าเป็นสาขาแรก)
        await base44.functions.invoke('initUserTrial');
        queryClient.invalidateQueries(['currentUser']);
      } catch (error) {
        console.error('Failed to init trial:', error);
      }

      setShowDialog(false);
      setFormData({
        branch_name: '',
        branch_code: '',
        address: '',
        phone: '',
        manager_name: '',
        image_url: '',
        status: 'active',
        description: '',
        bill_generation_day: '',
        payment_due_day: ''
      });
      setIsSubmitting(false);
      toast.success('เพิ่มสาขาสำเร็จ');
    },
    onError: () => {
      setIsSubmitting(false);
      toast.error('เกิดข้อผิดพลาด');
    },
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, image_url: file_url }));
      toast.success('อัปโหลดรูปภาพสำเร็จ');
    } catch {
      toast.error('อัปโหลดรูปภาพไม่สำเร็จ');
    }
    setUploadingImage(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) {
      toast.warning('กำลังดำเนินการ กรุณารอสักครู่...');
      return;
    }

    const existingBranch = branches.find(b => 
      b.branch_code.toLowerCase() === formData.branch_code.toLowerCase()
    );
    if (existingBranch) {
      toast.error(`รหัสสาขา "${formData.branch_code}" มีอยู่แล้ว กรุณาใช้รหัสอื่น`);
      return;
    }

    if (!canAddMoreBranches && userRole !== 'developer') {
      toast.error(`Trial ใช้งานได้ 1 สาขา - อัปเกรดเพื่อเพิ่มสาขาได้ไม่จำกัด`);
      return;
    }

    setIsSubmitting(true);
    createMutation.mutate({ ...formData, owner_id: currentUser.email });
  };

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

  const handleViewReports = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    setTimeout(() => {
      navigate(createPageUrl('reports'));
      setIsNavigating(false);
    }, 300);
  };



  if (userLoading || isLoading || crmAccessLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600 text-lg">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // 🚫 CRM DENY = แสดง Loading แล้ว Auto-logout (ไม่แสดง UI)
  if (currentUser && crmAccess && crmAccess.hasAccess === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-purple-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-800 text-lg font-semibold">🚫 ไม่มีสิทธิ์เข้าใช้งาน</p>
          <p className="text-slate-600 text-sm mt-2">กำลังออกจากระบบ...</p>
        </div>
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



              {/* ✅ ถ้ามีสาขา → แสดงปุ่มจัดการสาขา */}
              {!hasNoBranches && !hasNoAccess && (userRole === 'developer' || userRole === 'owner') && (
                <div className="flex flex-col gap-3 mb-6 items-center">
                  <Button
                    onClick={() => navigate(createPageUrl('BranchManagement'))}
                    className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white h-auto py-4 px-6 text-sm shadow-lg rounded-2xl font-medium"
                  >
                    <Settings className="w-5 h-5 mr-2 flex-shrink-0" />
                    <span>จัดการสาขา</span>
                  </Button>
                </div>
              )}

              {/* ✅ ถ้าไม่มีสาขาเลย → แสดงกล่องเพิ่มสาขา */}
              {hasNoBranches ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: canAddMoreBranches ? 1.02 : 1 }}
                    onClick={() => canAddMoreBranches && (userRole === 'developer' || userRole === 'owner') && setShowDialog(true)}
                    className={canAddMoreBranches ? "cursor-pointer max-w-md w-full" : "cursor-not-allowed max-w-md w-full"}
                  >
                    <Card className={`border-2 border-dashed ${canAddMoreBranches ? 'border-orange-300 bg-gradient-to-br from-orange-50/80 to-orange-100/50 hover:bg-orange-50 hover:border-orange-400 hover:shadow-xl' : 'border-slate-300 bg-slate-100 opacity-50'} transition-all duration-300`}>
                      <CardContent className="p-16 text-center">
                        <div className="relative w-24 h-24 mx-auto mb-6">
                          <div className={`absolute inset-0 ${canAddMoreBranches ? 'bg-orange-200/50' : 'bg-slate-300/50'} rounded-3xl blur-xl animate-pulse`} style={{ animationDuration: '3s' }} />
                          <div className={`relative w-full h-full rounded-3xl ${canAddMoreBranches ? 'bg-gradient-to-br from-orange-400 to-orange-500' : 'bg-slate-400'} flex items-center justify-center shadow-xl`}>
                            <Plus className="w-12 h-12 text-white" />
                          </div>
                        </div>
                        <h3 className="text-2xl font-bold text-slate-800 mb-3">
                          {canAddMoreBranches ? 'เพิ่มสาขาแรก' : 'ครบจำนวนสาขาแล้ว'}
                        </h3>
                        <p className="text-sm text-slate-600 mb-2">
                          {canAddMoreBranches 
                            ? 'เริ่มต้นใช้งานด้วยการเพิ่มสาขาแรกของคุณ' 
                            : `Trial ใช้งานได้ 1 สาขา (คุณมี ${userOwnedBranches.length} สาขาแล้ว)`}
                        </p>
                        <p className={`text-xs font-medium ${canAddMoreBranches ? 'text-orange-600' : 'text-slate-500'}`}>
                          {canAddMoreBranches ? 'คลิกเพื่อเริ่มต้น' : 'อัปเกรดแพ็กเกจเพื่อเพิ่มสาขา'}
                        </p>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              ) : hasNoAccess ? (
                <div className="flex items-center justify-center py-12">
                  <Card className="max-w-md w-full border-2 border-yellow-300 bg-yellow-50">
                    <CardContent className="p-12 text-center">
                      <Building2 className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
                      <h3 className="text-xl font-bold text-slate-800 mb-2">ไม่มีสิทธิ์เข้าถึงสาขา</h3>
                      <p className="text-sm text-slate-600">กรุณาติดต่อผู้ดูแลระบบเพื่อขอเข้าถึงสาขา</p>
                    </CardContent>
                  </Card>
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

      {/* Logo at bottom right */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-6 right-6 z-40"
      >
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 bg-white/50 rounded-2xl blur-lg" />
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/8398ec5eb_image.png"
            alt="หลังหอพัก"
            className="relative w-full h-full object-contain drop-shadow-xl rounded-2xl"
          />
        </div>
      </motion.div>

      {/* Logo at bottom right */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5 }}
        className="fixed bottom-6 right-6 z-40"
      >
        <div className="relative w-14 h-14">
          <div className="absolute inset-0 bg-white/50 rounded-2xl blur-lg" />
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/8398ec5eb_image.png"
            alt="หลังหอพัก"
            className="relative w-full h-full object-contain drop-shadow-xl rounded-2xl"
          />
        </div>
      </motion.div>

      {/* Form Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>เพิ่มสาขาใหม่</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ชื่อสาขา *</Label>
                <Input
                  value={formData.branch_name}
                  onChange={(e) => setFormData({ ...formData, branch_name: e.target.value })}
                  required
                  placeholder="W Residents สาขาสำโรง"
                />
              </div>
              <div>
                <Label>รหัสสาขา *</Label>
                <Input
                  value={formData.branch_code}
                  onChange={(e) => setFormData({ ...formData, branch_code: e.target.value })}
                  required
                  placeholder="WR-SRG01"
                />
              </div>
            </div>

            <div>
              <Label>ที่อยู่</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                placeholder="28/244 หมู่ 4 ..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>เบอร์โทรศัพท์</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="02-123-4567"
                />
              </div>
              <div>
                <Label>ผู้จัดการสาขา</Label>
                <Input
                  value={formData.manager_name}
                  onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                  placeholder="คุณสมชาย"
                />
              </div>
            </div>

            <div>
              <Label>รูปภาพสาขา</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploadingImage}
                />
                {formData.image_url && (
                  <img src={formData.image_url} alt="Preview" className="w-full h-48 object-cover rounded-lg mt-3" />
                )}
              </div>
            </div>

            <div>
              <Label>คำอธิบาย</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="ใกล้ห้างเมกา, บางนา..."
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold text-slate-800">⚙️ การตั้งค่าบิล</h3>
              <p className="text-xs text-slate-500">
                หากไม่กรอก ระบบจะใช้ค่าเริ่มต้น (วันสร้างบิล: 27, วันครบกำหนด: 5)
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>วันสร้างบิลอัตโนมัติ</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.bill_generation_day}
                    onChange={(e) => setFormData({ ...formData, bill_generation_day: e.target.value })}
                    placeholder="27"
                  />
                  <p className="text-xs text-slate-500 mt-1">วันที่ของเดือน (1-31)</p>
                </div>
                <div>
                  <Label>วันครบกำหนดชำระ</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.payment_due_day}
                    onChange={(e) => setFormData({ ...formData, payment_due_day: e.target.value })}
                    placeholder="5"
                  />
                  <p className="text-xs text-slate-500 mt-1">วันที่ของเดือน (1-31)</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)} disabled={isSubmitting}>
                ยกเลิก
              </Button>
              <Button 
                type="submit" 
                className="bg-gradient-to-r from-purple-600 to-indigo-600"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'กำลังดำเนินการ...' : 'เพิ่มสาขา'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}