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
  const [activeBanner, setActiveBanner] = useState(null);
  const [showBannerPopup, setShowBannerPopup] = useState(false);
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // ⚡ ลด timeout: 10s → 5s

      try {
        const response = await base44.functions.invoke('checkCRMAccess', {}, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = response.data;

        // 🔒 FAIL-CLOSED: ถ้ามี error/timeout → DENY ACCESS
        if (!data || data.error) {
          console.error('❌ CRM check error - DENYING access for security');
          return { hasAccess: false, reason: 'CRM error' };
        }

        // ⚠️ Timeout = ปัญหาเครือข่าย → DENY
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
      } catch (error) {
        clearTimeout(timeoutId);
        
        // ⚠️ Timeout = ปัญหาเครือข่าย
        if (error.name === 'AbortError') {
          console.warn('⏱️ CRM Timeout (5s) - DENYING for security');
          return { hasAccess: false, reason: 'CRM timeout', timeout: true };
        }
        
        console.error('❌ CRM check error:', error);
        return { hasAccess: false, error: error.message };
      }
    },
    enabled: !!currentUser && !userLoading && userSuccess,
    staleTime: 10 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    retry: 0,
    throwOnError: false,
    networkMode: 'online',
    meta: { timeout: 5000 }, // ⚡ 5 วินาที timeout
  });

  // ⚡ Parallel Queries - ไม่รอ CRM check (แต่จะเช็ค CRM ก่อนแสดงข้อมูล)
  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    enabled: !!currentUser && !userLoading,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    enabled: !!currentUser && !userLoading,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: banners = [] } = useQuery({
    queryKey: ['banners'],
    queryFn: () => base44.entities.Banner.list('-priority', 10),
    enabled: !!currentUser && !userLoading,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ⚡ Lazy Load - โหลดหลัง UI แสดงแล้ว (ไม่บล็อก initial render)
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
    enabled: !!currentUser && !userLoading && branches.length > 0,
    retry: 1,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
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

  // ⭐ FIX: ใช้ crmAccess.role เป็น fallback เมื่อ custom_role ยัง undefined
  const userRole = (() => {
    if (currentUser?.role === 'admin') return 'developer';
    
    let effectiveRole = currentUser?.custom_role;
    
    // ⭐ ถ้า custom_role ยัง undefined และ CRM ส่ง role มาแล้ว ให้ใช้จาก CRM
    if (!effectiveRole && crmAccess && !crmAccessLoading && crmAccess.role) {
      effectiveRole = crmAccess.role;
    }
    
    const finalRole = effectiveRole || 'employee';
    
    return finalRole;
  })();
  
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
  // ⭐ ถ้าเป็น owner ให้เช็คจากสาขาที่ตัวเองเป็นเจ้าของ (ไม่ใช่ branches ทั้งหมด)
  const hasNoBranches = (userRole === 'owner' || userRole === 'developer') 
    ? userOwnedBranches.length === 0 
    : branches.length === 0;
  const hasNoAccess = !hasNoBranches && filteredBranches.length === 0;

  const getConfigValue = (key) => {
    const globalConfig = configs.find(c => c.key === key && !c.branch_id);
    return globalConfig?.value || '';
  };

  const buildingName = getConfigValue('building_name') || 'W RESIDENTS';
  const buildingLogo = getConfigValue('building_logo') || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';

  // ⭐ Logic: เช็คและแสดง Pop-up ประกาศ
  React.useEffect(() => {
    if (!banners || banners.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dismissedBanners = JSON.parse(localStorage.getItem('dismissed_banners') || '[]');

    const validBanner = banners.find(banner => {
      if (!banner.is_active) return false;
      if (dismissedBanners.includes(banner.id)) return false;

      const startDate = new Date(banner.start_date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(banner.end_date);
      endDate.setHours(23, 59, 59, 999);

      return today >= startDate && today <= endDate;
    });

    if (validBanner) {
      setActiveBanner(validBanner);
      setShowBannerPopup(true);
    }
  }, [banners]);

  const handleCloseBanner = () => {
    if (!activeBanner) return;

    const dismissedBanners = JSON.parse(localStorage.getItem('dismissed_banners') || '[]');
    if (!dismissedBanners.includes(activeBanner.id)) {
      dismissedBanners.push(activeBanner.id);
      localStorage.setItem('dismissed_banners', JSON.stringify(dismissedBanners));
    }

    setShowBannerPopup(false);
    setActiveBanner(null);
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const branchData = { ...data };
      delete branchData.bill_generation_day;
      delete branchData.payment_due_day;
      return await base44.entities.Branch.create(branchData);
    },
    onSuccess: async (newBranch, variables) => {
      queryClient.invalidateQueries(['branches']);

      // ⭐ บันทึกเฉพาะข้อมูลที่ user กรอกมาจริงๆ (ไม่ copy จากสาขาอื่น)
      try {
        const configsToCreate = [];
        
        // บันทึกข้อมูลพื้นฐานที่กรอกมา
        if (variables.branch_name) {
          configsToCreate.push({ 
            key: 'building_name', 
            value: variables.branch_name, 
            value_type: 'string', 
            description: 'ชื่อหอพัก', 
            category: 'general',
            branch_id: newBranch.id
          });
        }
        
        if (variables.address) {
          configsToCreate.push({ 
            key: 'building_address', 
            value: variables.address, 
            value_type: 'string', 
            description: 'ที่อยู่หอพัก', 
            category: 'general',
            branch_id: newBranch.id
          });
        }
        
        if (variables.phone) {
          configsToCreate.push({ 
            key: 'building_phone', 
            value: variables.phone, 
            value_type: 'string', 
            description: 'เบอร์โทรหอพัก', 
            category: 'general',
            branch_id: newBranch.id
          });
        }
        
        if (variables.manager_name) {
          configsToCreate.push({ 
            key: 'building_manager', 
            value: variables.manager_name, 
            value_type: 'string', 
            description: 'ผู้ดูแลหอพัก', 
            category: 'general',
            branch_id: newBranch.id
          });
        }
        
        // บันทึก bill settings ถ้ากรอกมา
        if (variables.bill_generation_day) {
          configsToCreate.push({ 
            key: 'bill_generation_day', 
            value: variables.bill_generation_day, 
            value_type: 'number', 
            description: 'วันที่สร้างบิลอัตโนมัติ', 
            category: 'billing',
            branch_id: newBranch.id
          });
        }
        
        if (variables.payment_due_day) {
          configsToCreate.push({ 
            key: 'pay_day', 
            value: variables.payment_due_day, 
            value_type: 'number', 
            description: 'วันครบกำหนดชำระเงิน', 
            category: 'billing',
            branch_id: newBranch.id
          });
        }
        
        if (configsToCreate.length > 0) {
          await base44.entities.Config.bulkCreate(configsToCreate);
        }
      } catch (error) {
        console.error('Failed to create configs:', error);
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
    
    // บันทึก localStorage
    localStorage.setItem('selected_branch_id', branch.id);
    localStorage.setItem('selected_branch_name', branch.branch_name);
    
    // ⭐ ปิด sidebar บนมือถือ (< 768px)
    if (window.innerWidth < 768) {
      const sidebarTrigger = document.querySelector('button[data-sidebar-trigger]');
      if (!sidebarTrigger) {
        // หา trigger button โดยค้นหา button แรกที่มี SidebarTrigger icon
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.getAttribute('class')?.includes('sidebar-trigger') || btn.parentElement?.getAttribute('class')?.includes('sidebar')) {
            btn.click();
            break;
          }
        }
      } else {
        sidebarTrigger.click();
      }
    }
    
    // ⭐ Trigger custom event เพื่อให้ Layout sync ทันที
    window.dispatchEvent(new Event('storage'));
    
    // ⭐ เพิ่ม delay เป็น 800ms เพื่อให้ Layout sync state ทัน
    setTimeout(() => {
      navigate(createPageUrl('Dashboard'));
      setIsNavigating(false);
    }, 800);
  };

  const handleViewReports = () => {
    if (isNavigating) return;
    setIsNavigating(true);
    
    setTimeout(() => {
      navigate(createPageUrl('reports'));
      setIsNavigating(false);
    }, 300);
  };

  // 🚫 CRM DENY = Auto-logout (เช็คหลัง UI แสดงแล้ว)
  // ⭐ CRITICAL: ย้าย useEffect ขึ้นมาก่อน early return เพื่อให้ hooks ถูกเรียกสม่ำเสมอ
  React.useEffect(() => {
    if (currentUser && crmAccess && crmAccess.hasAccess === false) {
      console.warn('🚫 CRM Access denied - Auto logout');
      const welcomeUrl = window.location.origin + '/Welcome';
      setTimeout(() => base44.auth.logout(welcomeUrl), 1000);
    }
  }, [currentUser?.email, crmAccess?.hasAccess]);

  // ⚡ รอให้ CRM check เสร็จก่อนถ้า custom_role ยัง undefined
  const needsRoleSync = currentUser && !currentUser.custom_role && crmAccessLoading;
  const isInitialLoading = userLoading || (isLoading && branches.length === 0) || needsRoleSync;
  
  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-purple-100 flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-300/20 to-sky-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tr from-sky-300/20 to-cyan-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 via-sky-400/30 to-cyan-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="relative w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-2xl border border-white/50 shadow-2xl flex items-center justify-center">
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl animate-pulse" style={{ animationDuration: '2s' }} />
              
              <div className="absolute inset-12 rounded-full border-4 border-transparent border-t-blue-400/60 border-r-sky-400/60 animate-spin" style={{ animationDuration: '3s' }} />
              
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-sky-500 shadow-lg relative z-10" />
            </div>
          </div>

          <div className="text-center space-y-3 max-w-xs mx-auto px-4">
            <h2 className="text-2xl font-bold text-slate-800">กำลังโหลด</h2>
            <p className="text-slate-600 leading-relaxed">
              กรุณารอสักครู่<br/>
              ระบบกำลังเตรียมข้อมูลให้คุณ
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // ⚠️ แสดง warning banner ถ้า CRM กำลังเช็คอยู่
  const showCRMWarning = crmAccessLoading && currentUser;

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
              {/* ⚠️ CRM Loading Banner - แสดงเฉพาะ Developer */}
              {showCRMWarning && userRole === 'developer' && (
                <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-xl p-4 flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-yellow-600 animate-spin flex-shrink-0" />
                  <p className="text-sm text-yellow-800">🔧 Dev: กำลังตรวจสอบสิทธิ์...</p>
                </div>
              )}

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

      {/* Banner Pop-up */}
      <Dialog open={showBannerPopup} onOpenChange={setShowBannerPopup}>
        <DialogContent className="max-w-4xl p-0 border-0 bg-transparent shadow-none">
          <div className="relative">
            <Button
              onClick={handleCloseBanner}
              className="absolute -top-4 -right-4 z-50 rounded-full w-10 h-10 p-0 bg-white hover:bg-slate-100 shadow-lg border-2 border-slate-200"
              variant="ghost"
            >
              <span className="text-2xl font-bold text-slate-700">×</span>
            </Button>
            {activeBanner?.link_url ? (
              <a href={activeBanner.link_url} target="_blank" rel="noopener noreferrer">
                <img
                  src={activeBanner.image_url}
                  alt={activeBanner.title}
                  className="w-full rounded-2xl shadow-2xl cursor-pointer hover:scale-105 transition-transform duration-300"
                />
              </a>
            ) : (
              <img
                src={activeBanner?.image_url}
                alt={activeBanner?.title}
                className="w-full rounded-2xl shadow-2xl"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

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