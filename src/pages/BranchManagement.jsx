import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Edit2, Trash2, MapPin, Phone, AlertTriangle, Copy } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "../components/shared/PageHeader";

export default function BranchManagement() {
  console.log('🏢 BranchManagement Component Rendered');
  
  const [showDialog, setShowDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingBranch, setDeletingBranch] = useState(null);
  const [editingBranch, setEditingBranch] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // ป้องกันกดซ้ำ
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

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const userRole = currentUser?.role === 'admin' ? 'developer' : (currentUser?.custom_role || 'employee');
  
  // ⭐ แก้ไข: ไม่ใช้ || [] เพื่อให้แยก null/undefined จาก [] ได้
  const userAccessibleBranches = currentUser?.accessible_branches;

  const { data: allBranches = [], isLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: appSubscriptions = [] } = useQuery({
    queryKey: ['appSubscriptions'],
    queryFn: () => base44.entities.AppSubscription.list('-created_date', 1),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
  });



  // ⭐ ดึงจำนวนห้องจริงจาก Room entity - ใช้ SDK
  const { data: allRooms = [] } = useQuery({
    queryKey: ['rooms', 'all', 'secure'],
    queryFn: async () => {
      return await base44.entities.Room.filter({}, '', 5000);
    },
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
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

  // กรองสาขาตามสิทธิ์: เหมือน BranchSelection
  const branches = React.useMemo(() => {
    // Developer = เห็นทุกสาขา
    if (userRole === 'developer') return allBranches;

    // ถ้ามี accessible_branches set แล้ว = ใช้ลิสต์นั้น
    const hasAccessibleBranchesSet = userAccessibleBranches !== null && userAccessibleBranches !== undefined;
    if (hasAccessibleBranchesSet) {
      return allBranches.filter(b => userAccessibleBranches.includes(b.id));
    }

    // ถ้าไม่มี accessible_branches set และเป็น Owner = เห็นสาขาที่ตัวเองเป็นเจ้าของ
    if (userRole === 'owner') {
      return allBranches.filter(b => 
        b.owner_id === currentUser?.email || 
        b.created_by === currentUser?.email
      );
    }

    // Employee/Manager ที่ไม่มี accessible_branches = ไม่เห็นสาขาใดเลย
    return [];
  }, [allBranches, userRole, userAccessibleBranches, currentUser?.email]);

  const { data: crmPackages } = useQuery({
    queryKey: ['crmPackages'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPackagesFromCRM', {});
      return response.data;
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  // ⭐ เช็คจำนวนสาขาจาก owner_id
  const userOwnedBranches = allBranches.filter(b => b.owner_id === currentUser?.email);
  const isTrialMode = currentUser?.plan_status === 'trial';
  
  const activeSub = appSubscriptions.find(s => s.status === 'active');
  const maxAllowedBranches = isTrialMode ? 1 : (activeSub?.max_branches || 999);
  
  const canAddMoreBranches = userRole === 'developer' || userOwnedBranches.length < maxAllowedBranches;

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const branchData = { ...data };
      delete branchData.bill_generation_day;
      delete branchData.payment_due_day;
      return await base44.entities.Branch.create(branchData);
    },
    onSuccess: async (newBranch, variables) => {
      queryClient.invalidateQueries(['branches']);

      // ⭐ บันทึกเฉพาะข้อมูลที่ user กรอกมาจริงๆ
      try {
        const configsToCreate = [];
        
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
        
        if (configsToCreate.length > 0) {
          await base44.entities.Config.bulkCreate(configsToCreate);
        }
      } catch (error) {
        console.error('Failed to create configs:', error);
      }
      
      // บันทึก bill_generation_day และ payment_due_day ลง Config (ถ้ากรอกมา)
      if (variables.bill_generation_day) {
        try {
          await base44.entities.Config.create({
            branch_id: newBranch.id,
            key: 'bill_generation_day',
            value: variables.bill_generation_day,
            value_type: 'number',
            description: 'วันที่สร้างบิลอัตโนมัติ (วันที่ของเดือน)',
            category: 'billing'
          });
        } catch (error) {
          console.error('Failed to create bill_generation_day config:', error);
        }
      }
      
      if (variables.payment_due_day) {
        try {
          await base44.entities.Config.create({
            branch_id: newBranch.id,
            key: 'pay_day',
            value: variables.payment_due_day,
            value_type: 'number',
            description: 'วันครบกำหนดชำระเงิน (วันที่ของเดือน)',
            category: 'billing'
          });
        } catch (error) {
          console.error('Failed to create pay_day config:', error);
        }
      }
      
      queryClient.invalidateQueries(['configs']);
      
      // ⭐ อัปเดต accessible_branches และเปลี่ยนเป็น owner ให้ user ปัจจุบันที่สร้างสาขานี้
      try {
        const currentBranches = userAccessibleBranches || [];
        const updatedBranches = [...currentBranches, newBranch.id];
        await base44.entities.User.update(currentUser.id, {
          accessible_branches: updatedBranches,
          custom_role: 'owner' // เปลี่ยนเป็นเจ้าของหอพัก
        });
        
        queryClient.invalidateQueries(['currentUser']);
        console.log('✅ Added branch access and set owner role for user:', currentUser.id);
      } catch (error) {
        console.error('Failed to update user branch access:', error);
      }
      
      // ⭐ Init user trial เฉพาะเมื่อสร้างสาขาแรกเท่านั้น
      if (!currentUser.trial_ends_at && userOwnedBranches.length === 0) {
        try {
          await base44.functions.invoke('initUserTrial');
          queryClient.invalidateQueries(['currentUser']);
          console.log('✅ สร้าง Trial 30 วันสำเร็จ (สาขาแรก)');
        } catch (error) {
          console.error('Failed to init trial:', error);
        }
      }
      
      setShowDialog(false);
      resetForm();
      setIsSubmitting(false); // ⭐ ปลดล็อค
      toast.success('เพิ่มสาขาสำเร็จ');
    },
    onError: () => {
      setIsSubmitting(false); // ⭐ ปลดล็อค
      toast.error('เกิดข้อผิดพลาด');
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const branchData = { ...data };
      delete branchData.bill_generation_day;
      delete branchData.payment_due_day;
      return await base44.entities.Branch.update(id, branchData);
    },
    onSuccess: async (updatedBranch) => {
      queryClient.invalidateQueries(['branches']);
      
      // อัปเดต Config สำหรับ bill_generation_day
      if (formData.bill_generation_day) {
        const existingConfig = configs.find(c => c.key === 'bill_generation_day' && c.branch_id === updatedBranch.id);
        
        try {
          if (existingConfig) {
            await base44.entities.Config.update(existingConfig.id, { value: formData.bill_generation_day });
          } else {
            await base44.entities.Config.create({
              branch_id: updatedBranch.id,
              key: 'bill_generation_day',
              value: formData.bill_generation_day,
              value_type: 'number',
              description: 'วันที่สร้างบิลอัตโนมัติ (วันที่ของเดือน)',
              category: 'billing'
            });
          }
        } catch (error) {
          console.error('Failed to update bill_generation_day config:', error);
        }
      }
      
      // อัปเดต Config สำหรับ pay_day
      if (formData.payment_due_day) {
        const existingConfig = configs.find(c => c.key === 'pay_day' && c.branch_id === updatedBranch.id);
        
        try {
          if (existingConfig) {
            await base44.entities.Config.update(existingConfig.id, { value: formData.payment_due_day });
          } else {
            await base44.entities.Config.create({
              branch_id: updatedBranch.id,
              key: 'pay_day',
              value: formData.payment_due_day,
              value_type: 'number',
              description: 'วันครบกำหนดชำระเงิน (วันที่ของเดือน)',
              category: 'billing'
            });
          }
        } catch (error) {
          console.error('Failed to update pay_day config:', error);
        }
      }
      
      queryClient.invalidateQueries(['configs']);
      setShowDialog(false);
      resetForm();
      setIsSubmitting(false); // ⭐ ปลดล็อค
      toast.success('อัปเดตสาขาสำเร็จ');
    },
    onError: () => {
      setIsSubmitting(false); // ⭐ ปลดล็อค
      toast.error('เกิดข้อผิดพลาด');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (branchId) => {
      // เรียกใช้ backend function เพื่อลบสาขาและข้อมูลที่เกี่ยวข้อง
      const response = await base44.functions.invoke('deleteBranch', { branchId });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['branches']);
      queryClient.invalidateQueries(['rooms']);
      queryClient.invalidateQueries(['bookings']);
      queryClient.invalidateQueries(['payments']);
      queryClient.invalidateQueries(['tenants']);
      queryClient.invalidateQueries(['maintenance']);
      queryClient.invalidateQueries(['expenses']);
      queryClient.invalidateQueries(['meterReadings']);
      queryClient.invalidateQueries(['configs']);
      queryClient.invalidateQueries(['contracts']);
      queryClient.invalidateQueries(['branchPackages']);
      queryClient.invalidateQueries(['materialDeliveries']);
      setShowDeleteDialog(false);
      setDeletingBranch(null);
      toast.success('ลบสาขาและข้อมูลที่เกี่ยวข้องทั้งหมดสำเร็จ');
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
      setShowDeleteDialog(false);
      setDeletingBranch(null);
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
    
    // ⭐ ป้องกันกดซ้ำ
    if (isSubmitting) {
      toast.warning('กำลังดำเนินการ กรุณารอสักครู่...');
      return;
    }
    
    // เช็คจำนวนสาขาก่อนสร้าง
    if (!editingBranch) {
      // ⭐ Auto-generate branch_code ถ้าไม่กรอก
      let branchCode = formData.branch_code.trim();
      if (!branchCode) {
        const timestamp = Date.now().toString().slice(-6);
        branchCode = `BR${timestamp}`;
        console.log('🔄 Auto-generated branch_code:', branchCode);
      }
      
      // ⭐ เช็ค branch_code ซ้ำ
      const existingBranch = allBranches.find(b => 
        b.branch_code.toLowerCase() === branchCode.toLowerCase()
      );
      if (existingBranch) {
        toast.error(`รหัสสาขา "${branchCode}" มีอยู่แล้ว กรุณาใช้รหัสอื่น`);
        return;
      }
      
      if (!canAddMoreBranches && userRole !== 'developer') {
        toast.error(`Trial ใช้งานได้ 1 สาขา - อัปเกรดเพื่อเพิ่มสาขาได้ไม่จำกัด`);
        return;
      }
      
      // ⭐ อัปเดต formData ด้วย branch_code ที่สร้างขึ้น
      formData.branch_code = branchCode;
    }
    
    setIsSubmitting(true); // ⭐ ล็อคปุ่ม
    
    if (editingBranch) {
      // 🔒 SECURITY FIX: ห้ามส่ง owner_id ตอนแก้ไข (ป้องกันการทับเจ้าของเดิม)
      const { owner_id, ...safeData } = formData;
      updateMutation.mutate({ id: editingBranch.id, data: safeData });
    } else {
      // ✅ ตอนสร้างใหม่: ต้องใส่ owner_id
      const data = {
        ...formData,
        owner_id: currentUser.email
      };
      createMutation.mutate(data);
    }
  };

  const handleEdit = (branch) => {
    setEditingBranch(branch);
    
    // ดึง config ของสาขานี้
    const billGenConfig = configs.find(c => c.key === 'bill_generation_day' && c.branch_id === branch.id);
    const payDayConfig = configs.find(c => c.key === 'pay_day' && c.branch_id === branch.id);
    
    setFormData({
      branch_name: branch.branch_name || '',
      branch_code: branch.branch_code || '',
      address: branch.address || '',
      phone: branch.phone || '',
      manager_name: branch.manager_name || '',
      image_url: branch.image_url || '',
      status: branch.status || 'active',
      description: branch.description || '',
      bill_generation_day: billGenConfig?.value || '',
      payment_due_day: payDayConfig?.value || ''
    });
    setShowDialog(true);
  };

  const handleDelete = (branch) => {
    setDeletingBranch(branch);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (deletingBranch) {
      deleteMutation.mutate(deletingBranch.id);
    }
  };

  const handleCopy = (branch) => {
    if (!confirm(`ยืนยันการคัดลอกสาขา ${branch.branch_name}?`)) return;
    
    const sourceBillGen = configs.find(c => c.key === 'bill_generation_day' && c.branch_id === branch.id);
    const sourcePayDay = configs.find(c => c.key === 'pay_day' && c.branch_id === branch.id);

    const copiedData = {
      branch_name: `${branch.branch_name} (Copy)`,
      branch_code: `${branch.branch_code}_COPY`,
      address: branch.address,
      phone: branch.phone,
      manager_name: branch.manager_name,
      image_url: branch.image_url,
      status: 'active',
      description: branch.description,
      bill_generation_day: sourceBillGen?.value || '',
      payment_due_day: sourcePayDay?.value || ''
    };

    createMutation.mutate(copiedData);
  };

  const resetForm = () => {
    setEditingBranch(null);
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
  };

  // เอาการเช็คสิทธิ์ Developer ออก - ให้ทุกคนเข้าถึงหน้านี้ได้ (เห็นแค่สาขาตัวเอง)

  console.log('🔍 BranchManagement - isLoading:', isLoading);
  console.log('🔍 BranchManagement - branches count:', branches.length);
  
  if (isLoading) {
    console.log('⏳ BranchManagement - กำลังโหลด...');
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <PageHeader
          title="จัดการสาขา"
          subtitle="จัดการข้อมูลสาขาทั้งหมด"
          icon={Building2}
          showNotifications={false}
          showBackButton={true}
        />
        <div className="px-4 md:px-8 py-6">
          <div className="flex items-center justify-center py-20">
            <p>กำลังโหลดข้อมูลสาขา...</p>
          </div>
        </div>
      </div>
    );
  }
  
  console.log('✅ BranchManagement - กำลัง render หน้าปกติ');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader
        title="จัดการสาขา"
        subtitle="จัดการข้อมูลสาขาทั้งหมด"
        icon={Building2}
        showNotifications={false}
        showBackButton={true}
        backUrl={createPageUrl('BranchSelection')}
        actions={
          <Button
            onClick={() => {
              if (!canAddMoreBranches) {
                toast.error(`Trial ใช้งานได้ 1 สาขา (คุณมี ${userOwnedBranches.length} สาขาแล้ว)`);
                return;
              }
              setEditingBranch(null);
              setFormData({
                branch_name: '',
                branch_code: '',
                address: '',
                phone: '',
                manager_name: '',
                image_url: '',
                description: '',
                bill_generation_day: '',
                payment_due_day: ''
              });
              setShowDialog(true);
            }}
            disabled={!canAddMoreBranches}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-500"
          >
            <Plus className="w-5 h-5 mr-2" />
            เพิ่มสาขาใหม่ {!canAddMoreBranches && `(${userOwnedBranches.length}/${maxAllowedBranches})`}
          </Button>
        }
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {branches.map((branch, index) => (
                <motion.div
                  key={branch.id}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.05, y: -10 }}
                >
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl hover:shadow-2xl transition-all overflow-hidden">
                    {branch.image_url ? (
                      <div className="h-48 overflow-hidden">
                        <img
                          src={branch.image_url}
                          alt={branch.branch_name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="h-48 bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                        <Building2 className="w-16 h-16 text-purple-300" />
                      </div>
                    )}

                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-xl font-bold text-slate-800 mb-1">
                            {branch.branch_name}
                          </h3>
                          <p className="text-sm text-slate-500 font-mono">{branch.branch_code}</p>
                        </div>
                        <Badge className={branch.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700'}>
                          {branch.status === 'active' ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </Badge>
                      </div>

                      <div className="space-y-2 mb-4">
                        {branch.manager_name && (
                          <div className="flex items-center gap-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-sm font-bold">{branch.manager_name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="text-xs text-purple-600 font-semibold">ผู้ดูแลสาขา</p>
                              <p className="text-sm text-slate-800 font-medium">{branch.manager_name}</p>
                            </div>
                          </div>
                        )}
                        {branch.address && (
                          <div className="flex items-start gap-2 text-sm">
                            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <span className="text-slate-600 line-clamp-2">{branch.address}</span>
                          </div>
                        )}
                        {branch.phone && (
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">{branch.phone}</span>
                          </div>
                        )}
                      </div>

                      {/* แสดงจำนวนห้องจริงจาก Room entity */}
                      <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700 font-medium">ห้องพักในสาขา:</span>
                          <span className="text-xl font-bold text-blue-700">
                            {roomCountByBranch[branch.id] || 0} ห้อง
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleEdit(branch)}
                        >
                          <Edit2 className="w-4 h-4 mr-1" />
                          แก้ไข
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(branch);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                        {userRole === 'developer' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(branch);
                            }}
                            title="คัดลอกสาขา (Developer Only)"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* เพิ่ม Info Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">💡 หลังจากเพิ่มสาขาแล้ว</h4>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc ml-4">
                    <li><strong>ขั้นตอนถัดไป:</strong> คลิก "เปิดสาขา" → ไปที่ "จัดการห้องพัก" → กด "เพิ่มห้อง"</li>
                    <li>หรือใช้ฟีเจอร์ "นำเข้าจาก Excel" เพื่ออัปโหลดข้อมูลหลายห้องพร้อมกัน</li>
                    <li>สาขาที่ยังไม่มีห้องพักจะแสดงคำเตือนในหน้าแดชบอร์ดรวม</li>
                    <li><strong className="text-blue-900">💡 ทิป:</strong> หากเพิ่มห้องแล้วไม่แสดง ให้รีเฟรชหน้า (F5) หรือกลับมาดูใหม่</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delete Confirmation Dialog - เพิ่มการยืนยันป้อนชื่อสาขา */}
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-5 h-5" />
                  ⚠️ ยืนยันการลบสาขา
                </DialogTitle>
              </DialogHeader>
              {deletingBranch && (
                <div className="space-y-4">
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-sm text-red-800 mb-2">
                      คุณกำลังจะลบสาขา: <strong>{deletingBranch.branch_name}</strong>
                    </p>
                    <p className="text-xs text-red-600 mb-3">
                      ⚠️ <strong>การลบสาขานี้จะลบข้อมูลทั้งหมดที่เกี่ยวข้อง:</strong>
                    </p>
                    <ul className="text-xs text-red-600 list-disc list-inside space-y-1">
                      <li>ห้องพักทั้งหมด</li>
                      <li>ผู้เช่าและการจอง</li>
                      <li>การชำระเงินและใบเสร็จ</li>
                      <li>การแจ้งซ่อมและพัสดุ</li>
                      <li>ค่าใช้จ่ายและบันทึกมิเตอร์</li>
                      <li>สัญญาและแพ็กเกจ</li>
                    </ul>
                    <p className="text-xs text-red-700 font-bold mt-3">
                      ⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้!
                    </p>
                  </div>

                  {/* เพิ่มช่องป้อนชื่อสาขาเพื่อยืนยัน */}
                  <div className="space-y-2">
                    <Label className="text-red-700 font-semibold">
                      กรุณาพิมพ์ชื่อสาขา "{deletingBranch.branch_name}" เพื่อยืนยัน
                    </Label>
                    <Input
                      type="text"
                      placeholder={`พิมพ์ "${deletingBranch.branch_name}" ที่นี่`}
                      onChange={(e) => {
                        setDeletingBranch({ ...deletingBranch, confirmName: e.target.value });
                      }}
                      className="border-red-300 focus:border-red-500 focus:ring-red-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowDeleteDialog(false);
                        setDeletingBranch(null);
                      }}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={confirmDelete}
                      disabled={
                        deleteMutation.isPending ||
                        deletingBranch.confirmName !== deletingBranch.branch_name
                      }
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleteMutation.isPending ? 'กำลังลบ...' : 'ยืนยันลบสาขา'}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Form Dialog */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingBranch ? 'แก้ไขสาขา' : 'เพิ่มสาขาใหม่'}</DialogTitle>
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
                    <Label>รหัสสาขา (ถ้าไม่กรอกจะสร้างอัตโนมัติ)</Label>
                    <Input
                      value={formData.branch_code}
                      onChange={(e) => setFormData({ ...formData, branch_code: e.target.value })}
                      placeholder="WR-SRG01"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      ไม่บังคับ - ถ้าไม่กรอกระบบจะสร้างรหัสให้อัตโนมัติ
                    </p>
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
                    {isSubmitting ? 'กำลังดำเนินการ...' : (editingBranch ? 'อัปเดต' : 'เพิ่มสาขา')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}