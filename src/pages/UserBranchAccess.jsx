import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Globe, AlertTriangle, Edit2, Check, Shield, Package, Calendar, CreditCard, Loader2, Crown, Sparkles, Settings as SettingsIcon, X, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../components/shared/PageHeader";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { parseISO, format } from "date-fns";

export default function UserBranchAccess() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showBranchDialog, setShowBranchDialog] = useState(false);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedBranchForPackage, setSelectedBranchForPackage] = useState('');
  const [userBranchAccess, setUserBranchAccess] = useState({});
  const [userPermissions, setUserPermissions] = useState({});
  const [packageFormData, setPackageFormData] = useState({
    package_id: '',
    subscription_start_date: '',
    subscription_end_date: '',
    duration_months: '1',
  });
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [packageToCancel, setPackageToCancel] = useState(null);

  const queryClient = useQueryClient();

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const userRole = React.useMemo(() => currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee'), [currentUser]);
  const isDeveloper = userRole === 'developer';
  // Developer เห็นทุกสาขา (ไม่สนใจ accessible_branches)
  const userAccessibleBranches = React.useMemo(() => {
    return currentUser?.accessible_branches || [];
  }, [currentUser]);

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: branchPackages = [], refetch: refetchBranchPackages } = useQuery({
    queryKey: ['branchPackages'],
    queryFn: () => base44.entities.BranchPackage.list('-created_date', 500),
  });

  const { data: crmPackages } = useQuery({
    queryKey: ['crmPackages'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPackagesFromCRM', {});
      return response.data;
    },
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-payment_date', 500),
  });

  // Developer เห็นทุกสาขา, คนอื่นเห็นเฉพาะสาขาที่ตัวเองมีสิทธิ์
  const branches = React.useMemo(() => {
    // Developer เห็นทุกสาขาเสมอ
    if (isDeveloper) return allBranches;
    if (!userAccessibleBranches || userAccessibleBranches.length === 0) return [];
    return allBranches.filter(branch => userAccessibleBranches.includes(branch.id));
  }, [allBranches, isDeveloper, userAccessibleBranches]);

  // กรองผู้ใช้ให้แสดงเฉพาะที่เกี่ยวข้องกับสาขาที่ตัวเองมีสิทธิ์
  const users = React.useMemo(() => {
    // Developer เห็นทุกผู้ใช้
    if (isDeveloper) return allUsers;
    return allUsers.filter(user => {
      const targetUserBranches = user.accessible_branches || [];
      // แสดงผู้ใช้ที่มีอย่างน้อย 1 สาขาที่ตัวเองมีสิทธิ์ หรือยังไม่มีสาขา
      return targetUserBranches.some(branchId => userAccessibleBranches.includes(branchId)) ||
             targetUserBranches.length === 0;
    });
  }, [allUsers, isDeveloper, userAccessibleBranches]);

  const getBranchName = (branchId) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.branch_name || branchId;
  };

  const getRoleBadge = (role) => {
    const badges = {
      developer: { label: '👨‍💻 Developer', color: 'from-purple-500 to-pink-500' },
      owner: { label: '👑 เจ้าของหอพัก', color: 'from-blue-500 to-indigo-500' },
      manager: { label: '👔 ผู้จัดการ', color: 'from-green-500 to-emerald-500' },
      employee: { label: '👤 พนักงาน', color: 'from-slate-400 to-slate-500' }
    };
    return badges[role] || badges.employee;
  };

  // Filter users based on role
  // Developer can see all users
  // Owner can see users in their accessible branches (excluding other developers)
  const getVisibleUsers = () => {
    if (isDeveloper) return users;
    
    // Owner: show only users that belong to branches they have access to
    return users.filter(user => {
      const targetRole = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
      
      // Don't show developers to owners
      if (targetRole === 'developer') return false;
      
      // Show users that have at least one common accessible branch
      const targetUserBranches = user.accessible_branches || [];
      return targetUserBranches.some(branchId => userAccessibleBranches.includes(branchId)) ||
             targetUserBranches.length === 0; // Show users without branches so owner can assign them
    });
  };

  const updateUserBranchesMutation = useMutation({
    mutationFn: ({ userId, accessible_branches }) =>
      base44.entities.User.update(userId, { accessible_branches }),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('อัปเดตสาขาสำเร็จ');
      setShowBranchDialog(false);
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  // ฟังก์ชันลบสาขาที่ไม่มีอยู่แล้วออกจาก accessible_branches
  const cleanupDeletedBranches = async (user) => {
    const userBranches = user.accessible_branches || [];
    const validBranches = userBranches.filter(branchId => 
      allBranches.some(b => b.id === branchId)
    );
    
    if (validBranches.length !== userBranches.length) {
      const removedCount = userBranches.length - validBranches.length;
      await base44.entities.User.update(user.id, { accessible_branches: validBranches });
      queryClient.invalidateQueries(['users']);
      toast.success(`ลบ ${removedCount} สาขาที่ไม่มีอยู่แล้วออกจาก ${user.full_name}`);
    } else {
      toast.info('ไม่พบสาขาที่ต้องลบ');
    }
  };

  // ลบสาขาที่ไม่มีอยู่แล้วจากทุกผู้ใช้
  const cleanupAllUsers = async () => {
    let totalRemoved = 0;
    let usersUpdated = 0;
    
    for (const user of allUsers) {
      const userBranches = user.accessible_branches || [];
      const validBranches = userBranches.filter(branchId => 
        allBranches.some(b => b.id === branchId)
      );
      
      if (validBranches.length !== userBranches.length) {
        const removedCount = userBranches.length - validBranches.length;
        await base44.entities.User.update(user.id, { accessible_branches: validBranches });
        totalRemoved += removedCount;
        usersUpdated++;
      }
    }
    
    queryClient.invalidateQueries(['users']);
    if (totalRemoved > 0) {
      toast.success(`ลบ ${totalRemoved} สาขาที่ไม่มีอยู่แล้วจาก ${usersUpdated} ผู้ใช้`);
    } else {
      toast.info('ไม่พบสาขาที่ต้องลบ');
    }
  };

  const updateUserPermissionsMutation = useMutation({
    mutationFn: ({ userId, permissions }) =>
      base44.entities.User.update(userId, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('อัปเดตสิทธิ์สำเร็จ');
      setShowPermissionsDialog(false);
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  const updatePackageMutation = useMutation({
    mutationFn: async ({ ownerEmail, packageData, isEditing }) => {
      console.log('Mutation started:', { ownerEmail, packageData, isEditing });
      
      const userBranches = selectedUser?.accessible_branches || [];
      const targetBranches = userBranches.length > 0 ? userBranches : branches.map(b => b.id);
      
      console.log('Target branches:', targetBranches);

      if (targetBranches.length === 0) {
        throw new Error('ไม่พบสาขาที่ต้องอัปเดต');
      }

      const results = [];
      for (const branchId of targetBranches) {
        const existingPackage = branchPackages.find(
          bp => bp.branch_id === branchId && bp.owner_email === ownerEmail && bp.status === 'active'
        );
        
        console.log('Processing branch:', branchId, 'existingPackage:', existingPackage?.id);

        if (isEditing && existingPackage) {
          // อัปเดตแพ็กเกจที่มีอยู่
          console.log('Updating package:', existingPackage.id);
          const result = await base44.entities.BranchPackage.update(existingPackage.id, packageData);
          results.push(result);
        } else {
          // ลบ package เก่าทั้งหมดในสาขานี้ก่อน แล้วสร้างใหม่
          const existingPackages = branchPackages.filter(
            bp => bp.branch_id === branchId && bp.owner_email === ownerEmail
          );
          for (const oldPkg of existingPackages) {
            console.log('Deleting old package:', oldPkg.id);
            await base44.entities.BranchPackage.delete(oldPkg.id);
          }

          // สร้าง package ใหม่
          console.log('Creating new package for branch:', branchId);
          const result = await base44.entities.BranchPackage.create({
            branch_id: branchId,
            owner_email: ownerEmail,
            ...packageData,
          });
          results.push(result);
        }
      }
      
      console.log('Mutation completed, results:', results.length);
      return results;
    },
    onSuccess: (data, variables) => {
      console.log('Mutation success:', data);
      queryClient.invalidateQueries({ queryKey: ['branchPackages'] });
      toast.success(variables.isEditing ? 'แก้ไขแพ็กเกจสำเร็จ' : 'บันทึกแพ็กเกจสำเร็จ');
      setShowPackageDialog(false);
      setIsEditingPackage(false);
      refetchBranchPackages();
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    },
  });

  const cancelPackageMutation = useMutation({
    mutationFn: async (ownerEmail) => {
      // ยกเลิกแพ็กเกจทั้งหมดของ user นี้ในทุกสาขา
      const userPackages = branchPackages.filter(bp => 
        bp.owner_email === ownerEmail && bp.status === 'active'
      );

      const results = [];
      for (const pkg of userPackages) {
        const result = await base44.entities.BranchPackage.update(pkg.id, { status: 'cancelled' });
        results.push(result);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['branchPackages']);
      toast.success('ยกเลิกแพ็กเกจทุกสาขาสำเร็จ');
      setShowCancelDialog(false);
      setPackageToCancel(null);
      refetchBranchPackages();
    },
    onError: () => toast.error('เกิดข้อผิดพลาด'),
  });

  const handleOpenBranchDialog = (user) => {
    setSelectedUser(user);
    setUserBranchAccess({ [user.id]: user.accessible_branches || [] });
    setShowBranchDialog(true);
  };

  const handleOpenPermissionsDialog = (user) => {
    setSelectedUser(user);
    setUserPermissions({ [user.id]: user.permissions || [] });
    setShowPermissionsDialog(true);
  };

  const handleOpenPackageDialog = (user, prefillData = null) => {
    setSelectedUser(user);
    
    if (prefillData) {
      setPackageFormData(prefillData);
    } else {
      const existingPackages = branchPackages.filter(bp => bp.owner_email === user.email && bp.status === 'active');
      const existingPackage = existingPackages[0];

      if (existingPackage) {
        setPackageFormData({
          package_id: existingPackage.package_id || '',
          subscription_start_date: existingPackage.subscription_start_date || '',
          subscription_end_date: existingPackage.subscription_end_date || '',
          duration_months: '1',
        });
      } else {
        const today = new Date().toISOString().split('T')[0];
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 14);
        
        setPackageFormData({
          package_id: 'trial',
          subscription_start_date: today,
          subscription_end_date: trialEnd.toISOString().split('T')[0],
          duration_months: '1',
        });
      }
    }
    
    setShowPackageDialog(true);
  };

  const handleSavePackage = async () => {
    if (!selectedUser || !packageFormData.package_id) {
      toast.error('กรุณาเลือกแพ็กเกจ');
      return;
    }

    if (!packageFormData.subscription_start_date || !packageFormData.subscription_end_date) {
      toast.error('กรุณาระบุวันเริ่มต้นและสิ้นสุด');
      return;
    }

    const selectedCrmPackage = (crmPackages?.packages || []).find(p => p.id === packageFormData.package_id);
    if (!selectedCrmPackage) {
      toast.error('ไม่พบแพ็กเกจที่เลือก');
      return;
    }

    const months = parseInt(packageFormData.duration_months);
    const pricing = selectedCrmPackage.pricing || {};
    let pricePerMonth = pricing.monthly || selectedCrmPackage.price_monthly || 0;

    if (months === 3) {
      pricePerMonth = pricing.three_months_per_month || pricePerMonth;
    } else if (months === 6) {
      pricePerMonth = pricing.six_months_per_month || pricePerMonth;
    } else if (months === 12) {
      pricePerMonth = pricing.yearly_per_month || pricePerMonth;
    }

    const packageData = {
      package_id: selectedCrmPackage.id,
      package_name: selectedCrmPackage.package_name,
      subscription_start_date: packageFormData.subscription_start_date,
      subscription_end_date: packageFormData.subscription_end_date,
      status: 'active',
      price_per_month: pricePerMonth,
      features: selectedCrmPackage.features || [],
    };

    console.log('Saving package:', { ownerEmail: selectedUser.email, packageData, isEditing: isEditingPackage });

    updatePackageMutation.mutate({
      ownerEmail: selectedUser.email,
      packageData,
      isEditing: isEditingPackage,
    });
  };

  const getBranchPackageInfo = (branchId, userEmail) => {
    return branchPackages.find(
      bp => bp.branch_id === branchId && bp.owner_email === userEmail && bp.status === 'active'
    );
  };

  const getUserPaymentHistory = (userEmail) => {
    return allPayments.filter(p => p.tenant_id && p.notes && p.notes.toLowerCase().includes(userEmail.toLowerCase()));
  };

  const getUserPackageHistory = (userEmail) => {
    return branchPackages.filter(bp => bp.owner_email === userEmail).sort((a, b) => 
      new Date(b.created_date) - new Date(a.created_date)
    );
  };

  const toggleBranchAccess = (userId, branchId) => {
    setUserBranchAccess(prev => {
      const current = prev[userId] || [];
      const has = current.includes(branchId);
      return {
        ...prev,
        [userId]: has ? current.filter(b => b !== branchId) : [...current, branchId]
      };
    });
  };

  const togglePermission = (userId, permissionId) => {
    setUserPermissions(prev => {
      const current = prev[userId] || [];
      const has = current.includes(permissionId);
      return {
        ...prev,
        [userId]: has ? current.filter(p => p !== permissionId) : [...current, permissionId]
      };
    });
  };

  const visibleUsers = getVisibleUsers();
  
  const filteredUsers = visibleUsers.filter(user => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  // แสดง loading
  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <Users className="w-12 h-12 text-slate-400 mx-auto mb-4 animate-pulse" />
          <p className="text-slate-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50">
      <PageHeader 
        title="สิทธิ์การเข้าถึงสาขา" 
        subtitle="แสดงรายชื่อผู้ใช้และสาขาที่สามารถเข้าถึงได้"
        icon={Users}
        showBackButton={true}
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Search Bar */}
          <Card className="bg-white/80 backdrop-blur-xl shadow-xl">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาผู้ใช้ด้วยชื่อหรืออีเมล..."
                  className="pl-10 bg-white"
                />
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">ผู้ใช้ทั้งหมด</p>
                    <p className="text-4xl font-bold">{visibleUsers.length}</p>
                  </div>
                  <Users className="w-12 h-12 opacity-30" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">สาขาทั้งหมด</p>
                    <p className="text-4xl font-bold">{branches.length}</p>
                  </div>
                  <Globe className="w-12 h-12 opacity-30" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-500 to-pink-600 text-white">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90 mb-1">ผลการค้นหา</p>
                    <p className="text-4xl font-bold">{filteredUsers.length}</p>
                  </div>
                  <Search className="w-12 h-12 opacity-30" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* User List */}
          <div className="space-y-4">
            {usersLoading ? (
              <Card className="bg-white/80 backdrop-blur-xl">
                <CardContent className="p-12 text-center">
                  <p className="text-slate-600">กำลังโหลดข้อมูล...</p>
                </CardContent>
              </Card>
            ) : filteredUsers.length === 0 ? (
              <Card className="bg-white/80 backdrop-blur-xl">
                <CardContent className="p-12 text-center">
                  <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-600">ไม่พบผู้ใช้</p>
                </CardContent>
              </Card>
            ) : (
              filteredUsers.map((user) => {
                const role = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
                const badge = getRoleBadge(role);
                const accessibleBranches = user.accessible_branches || [];
                const canAccessAllBranches = role === 'developer' || role === 'owner';

                return (
                  <Card key={user.id} className="bg-white/80 backdrop-blur-xl shadow-lg hover:shadow-xl transition-all">
                    <CardContent className="p-6">
                      {/* User Info Section */}
                      <div className="flex items-start gap-4 mb-6 pb-6 border-b">
                        <div className={`w-16 h-16 bg-gradient-to-br ${badge.color} rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                          <span className="text-white font-bold text-2xl">
                            {user.full_name?.charAt(0) || 'U'}
                          </span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-slate-800 mb-1 truncate">
                            {user.full_name || 'ไม่ระบุชื่อ'}
                          </h3>
                          <p className="text-sm text-slate-600 mb-2 truncate">{user.email}</p>
                          
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className={`bg-gradient-to-r ${badge.color} text-white border-0`}>
                              {badge.label}
                            </Badge>
                            
                            {user.permissions && user.permissions.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {user.permissions.length} สิทธิ์
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Branch Access */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <Globe className="w-5 h-5 text-blue-600" />
                              <h4 className="font-semibold text-slate-700">สาขาที่เข้าถึงได้</h4>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenBranchDialog(user)}
                              className="text-xs"
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              แก้ไข
                            </Button>
                          </div>

                          {canAccessAllBranches ? (
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
                              <div className="flex items-center gap-2">
                                <Globe className="w-5 h-5 text-purple-600" />
                                <span className="font-bold text-purple-700">เข้าถึงทุกสาขา</span>
                              </div>
                            </div>
                          ) : accessibleBranches.length > 0 ? (
                            <div className="space-y-2">
                              {accessibleBranches.map((branchId, idx) => (
                                <div key={branchId} className="bg-blue-50 rounded-lg p-2 border border-blue-200">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                      <span className="text-blue-700 font-bold text-xs">{idx + 1}</span>
                                    </div>
                                    <span className="text-sm text-slate-800 font-medium truncate">
                                      {getBranchName(branchId)}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                              <div className="flex items-center gap-2 text-amber-700">
                                <AlertTriangle className="w-5 h-5" />
                                <span className="text-sm font-semibold">ยังไม่ได้กำหนดสาขา</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Package Info - Enhanced */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <Package className="w-5 h-5 text-green-600" />
                              <h4 className="font-semibold text-slate-700">แพ็กเกจปัจจุบัน</h4>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenPackageDialog(user)}
                              className="text-xs"
                            >
                              <Edit2 className="w-3 h-3 mr-1" />
                              จัดการ
                            </Button>
                          </div>

                          {(() => {
                            const userPackages = branchPackages.filter(bp => bp.owner_email === user.email && bp.status === 'active');
                            const activePackage = userPackages[0];
                            
                            if (activePackage) {
                              const pkgName = activePackage.package_name || '';
                              const isBasic = pkgName.toLowerCase().includes('basic') || pkgName.toLowerCase().includes('nano');
                              const isPro = pkgName.toLowerCase().includes('pro') || pkgName.toLowerCase().includes('micro');
                              const isElite = !isBasic && !isPro;
                              const isTrial = activePackage.package_id === 'trial';
                              
                              const pkgIcon = isTrial ? Package : isBasic ? SettingsIcon : isPro ? Sparkles : Crown;
                              
                              return (
                                <div className={`rounded-xl border-2 overflow-hidden ${
                                  isTrial ? 'bg-amber-50 border-amber-300' : 
                                  isBasic ? 'bg-slate-100 border-slate-300' :
                                  isPro ? 'bg-gradient-to-br from-blue-100 to-purple-100 border-blue-300' :
                                  'bg-gradient-to-br from-amber-100 to-yellow-100 border-amber-400'
                                }`}>
                                  <div className={`p-3 ${
                                    isTrial ? 'bg-amber-200/50' :
                                    isBasic ? 'bg-slate-200/50' :
                                    isPro ? 'bg-gradient-to-r from-blue-200 to-purple-200' :
                                    'bg-gradient-to-r from-amber-300 to-yellow-300'
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      {React.createElement(pkgIcon, { 
                                        className: `w-5 h-5 ${
                                          isTrial ? 'text-amber-700' :
                                          isBasic ? 'text-slate-600' :
                                          isPro ? 'text-blue-700' :
                                          'text-amber-800'
                                        }` 
                                      })}
                                      <span className={`text-sm font-bold ${
                                        isTrial ? 'text-amber-800' :
                                        isBasic ? 'text-slate-800' :
                                        isPro ? 'text-blue-800' :
                                        'text-amber-900'
                                      }`}>
                                        {isTrial ? '🎉 ทดลองใช้' : activePackage.package_name}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="p-3 bg-white/50">
                                    {activePackage.subscription_end_date && (
                                      <div className="flex items-center gap-1 text-xs text-slate-700 mb-2">
                                        <Calendar className="w-3 h-3" />
                                        <span>หมดอายุ {format(parseISO(activePackage.subscription_end_date), 'dd/MM/yyyy')}</span>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-1 text-xs text-slate-600">
                                      <Globe className="w-3 h-3" />
                                      <span>{userPackages.length} สาขา</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="p-4 rounded-lg bg-slate-50 border-2 border-dashed border-slate-300">
                                  <p className="text-xs text-slate-600 text-center">ยังไม่มีแพ็กเกจ</p>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenPermissionsDialog(user)}
                        >
                          <Shield className="w-4 h-4 mr-1" />
                          สิทธิ์
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenBranchDialog(user)}
                        >
                          <Globe className="w-4 h-4 mr-1" />
                          สาขา
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Branch Access Dialog */}
          <Dialog open={showBranchDialog} onOpenChange={setShowBranchDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  จัดการสาขา: {selectedUser?.full_name}
                </DialogTitle>
              </DialogHeader>
              {selectedUser && (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>สาขาที่เลือก:</strong> {(userBranchAccess[selectedUser.id] || []).length} สาขา
                    </p>
                  </div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {branches.map(branch => {
                      const isChecked = (userBranchAccess[selectedUser.id] || []).includes(branch.id);
                      return (
                        <label
                          key={branch.id}
                          className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-all border-2 ${
                            isChecked ? 'bg-blue-50 border-blue-300' : 'hover:bg-slate-50 border-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleBranchAccess(selectedUser.id, branch.id)}
                            className="w-5 h-5 rounded"
                          />
                          <div className="flex-1">
                            <p className={`font-semibold ${isChecked ? 'text-blue-700' : 'text-slate-800'}`}>
                              {branch.branch_name}
                            </p>
                            {branch.address && (
                              <p className="text-xs text-slate-500 mt-1">{branch.address}</p>
                            )}
                          </div>
                          {isChecked && <Check className="w-5 h-5 text-blue-600" />}
                        </label>
                      );
                    })}
                  </div>
                  {!isDeveloper && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-xs text-blue-800">
                        💡 <strong>หมายเหตุ:</strong> แสดงเฉพาะสาขาที่คุณมีสิทธิ์เข้าถึง ({branches.length} สาขา)
                      </p>
                    </div>
                  )}
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setShowBranchDialog(false)}>
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={() => {
                        updateUserBranchesMutation.mutate({
                          userId: selectedUser.id,
                          accessible_branches: userBranchAccess[selectedUser.id] || []
                        });
                      }}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      บันทึก
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Package Management Dialog */}
          <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-600" />
                  จัดการแพ็กเกจ: {selectedUser?.full_name}
                </DialogTitle>
              </DialogHeader>
              {selectedUser && (
                <div className="space-y-6">
                  {/* Current Package Display */}
                  {(() => {
                    const userPackages = branchPackages.filter(bp => bp.owner_email === selectedUser.email && bp.status === 'active');
                    const activePackage = userPackages[0];

                    if (activePackage) {
                      const pkgName = activePackage.package_name || '';
                      const isBasic = pkgName.toLowerCase().includes('basic') || pkgName.toLowerCase().includes('nano');
                      const isPro = pkgName.toLowerCase().includes('pro') || pkgName.toLowerCase().includes('micro');
                      const isElite = !isBasic && !isPro;
                      const isTrial = activePackage.package_id === 'trial';
                      const pkgIcon = isTrial ? Package : isBasic ? SettingsIcon : isPro ? Sparkles : Crown;

                      return (
                        <Card className={`border-2 ${
                          isTrial ? 'bg-amber-50 border-amber-300' :
                          isBasic ? 'bg-slate-50 border-slate-300' :
                          isPro ? 'bg-gradient-to-br from-blue-50 to-purple-50 border-blue-300' :
                          'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-400'
                        }`}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex items-center gap-3">
                                {React.createElement(pkgIcon, { 
                                  className: `w-8 h-8 ${
                                    isTrial ? 'text-amber-600' :
                                    isBasic ? 'text-slate-600' :
                                    isPro ? 'text-blue-600' :
                                    'text-amber-700'
                                  }` 
                                })}
                                <div>
                                  <h3 className="font-bold text-slate-800 text-lg">
                                    {isTrial ? '🎉 แพ็กเกจทดลองใช้' : activePackage.package_name}
                                  </h3>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge className="text-xs">
                                      {userPackages.length} สาขา
                                    </Badge>
                                    {activePackage.subscription_end_date && (
                                      <span className="text-xs text-slate-600">
                                        ถึง {format(parseISO(activePackage.subscription_end_date), 'dd MMM yyyy')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    // Set form data to current package values for editing
                                    setPackageFormData({
                                      package_id: activePackage.package_id,
                                      subscription_start_date: activePackage.subscription_start_date || '',
                                      subscription_end_date: activePackage.subscription_end_date || '',
                                      duration_months: '1',
                                    });
                                    setIsEditingPackage(true);
                                    // Scroll to form section
                                    setTimeout(() => {
                                      document.getElementById('package-form-section')?.scrollIntoView({ behavior: 'smooth' });
                                    }, 100);
                                    toast.info('กำลังแก้ไขแพ็กเกจปัจจุบัน');
                                  }}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <Edit2 className="w-4 h-4 mr-1" />
                                  แก้ไข
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setPackageToCancel(activePackage);
                                    setShowCancelDialog(true);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <X className="w-4 h-4 mr-1" />
                                  ยกเลิก
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    }
                    return null;
                  })()}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Form Section */}
                    <div id="package-form-section" className="space-y-4">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                        <Edit2 className="w-5 h-5" />
                        {isEditingPackage ? '✏️ แก้ไขแพ็กเกจปัจจุบัน' : 'เปลี่ยน/ต่ออายุแพ็กเกจ'}
                      </h3>
                      {isEditingPackage && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800">
                            กำลังแก้ไขแพ็กเกจที่มีอยู่ - การเปลี่ยนแปลงจะมีผลกับทุกสาขาที่ผู้ใช้ดูแล
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setIsEditingPackage(false)}
                            className="mt-2 text-blue-600 hover:text-blue-700"
                          >
                            ยกเลิกการแก้ไข → สร้างใหม่แทน
                          </Button>
                        </div>
                      )}

                      <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-2">
                          เลือกแพ็กเกจ
                        </label>
                        <Select
                          value={packageFormData.package_id}
                          onValueChange={(value) => {
                            setPackageFormData({ ...packageFormData, package_id: value });
                            
                            if (value && packageFormData.duration_months) {
                              const today = new Date();
                              const months = parseInt(packageFormData.duration_months);
                              const endDate = new Date(today);
                              endDate.setMonth(today.getMonth() + months);
                              
                              setPackageFormData(prev => ({
                                ...prev,
                                subscription_start_date: today.toISOString().split('T')[0],
                                subscription_end_date: endDate.toISOString().split('T')[0],
                              }));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="เลือกแพ็กเกจ" />
                          </SelectTrigger>
                          <SelectContent>
                            {(crmPackages?.packages || [])
                              .filter(p => p.app_system === 'dormitory' && p.is_active !== false)
                              .sort((a, b) => {
                                const priceA = a.pricing?.monthly || a.price_monthly || 0;
                                const priceB = b.pricing?.monthly || b.price_monthly || 0;
                                return priceA - priceB;
                              })
                              .map(pkg => {
                                const pkgName = pkg.package_name || '';
                                const isBasic = pkgName.toLowerCase().includes('basic') || pkgName.toLowerCase().includes('nano');
                                const isPro = pkgName.toLowerCase().includes('pro') || pkgName.toLowerCase().includes('micro');
                                const pricing = pkg.pricing || {};
                                const monthlyPrice = pricing.monthly || pkg.price_monthly || 0;

                                return (
                                  <SelectItem key={pkg.id} value={pkg.id}>
                                    <div className="flex items-center gap-2">
                                      {isBasic ? <SettingsIcon className="w-4 h-4" /> : isPro ? <Sparkles className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
                                      <span>{pkg.package_name}</span>
                                      <span className="text-xs text-slate-500">฿{monthlyPrice.toLocaleString()}/เดือน</span>
                                    </div>
                                  </SelectItem>
                                );
                              })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-2">
                          ระยะเวลา
                        </label>
                        <Select
                          value={packageFormData.duration_months}
                          onValueChange={(value) => {
                            setPackageFormData({ ...packageFormData, duration_months: value });
                            
                            if (packageFormData.subscription_start_date) {
                              const startDate = new Date(packageFormData.subscription_start_date);
                              const endDate = new Date(startDate);
                              endDate.setMonth(startDate.getMonth() + parseInt(value));
                              
                              setPackageFormData(prev => ({
                                ...prev,
                                subscription_end_date: endDate.toISOString().split('T')[0],
                              }));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">1 เดือน</SelectItem>
                            <SelectItem value="3">3 เดือน</SelectItem>
                            <SelectItem value="6">6 เดือน</SelectItem>
                            <SelectItem value="12">1 ปี</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            วันเริ่มต้น
                          </label>
                          <Input
                            type="date"
                            value={packageFormData.subscription_start_date}
                            onChange={(e) => {
                              setPackageFormData({ ...packageFormData, subscription_start_date: e.target.value });
                              
                              if (packageFormData.duration_months) {
                                const startDate = new Date(e.target.value);
                                const endDate = new Date(startDate);
                                endDate.setMonth(startDate.getMonth() + parseInt(packageFormData.duration_months));
                                
                                setPackageFormData(prev => ({
                                  ...prev,
                                  subscription_end_date: endDate.toISOString().split('T')[0],
                                }));
                              }
                            }}
                            className="h-9 text-sm"
                          />
                        </div>
                        
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            วันสิ้นสุด
                          </label>
                          <Input
                            type="date"
                            value={packageFormData.subscription_end_date}
                            onChange={(e) => setPackageFormData({ ...packageFormData, subscription_end_date: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>

                      {packageFormData.package_id && packageFormData.subscription_start_date && packageFormData.subscription_end_date && (() => {
                        const selectedCrmPackage = (crmPackages?.packages || []).find(p => p.id === packageFormData.package_id);
                        if (!selectedCrmPackage) return null;

                        const months = parseInt(packageFormData.duration_months);
                        const pricing = selectedCrmPackage.pricing || {};
                        let pricePerMonth = pricing.monthly || selectedCrmPackage.price_monthly || 0;
                        let totalPrice = pricePerMonth * months;
                        let savings = 0;

                        if (months === 3) {
                          totalPrice = pricing.three_months || totalPrice;
                          pricePerMonth = pricing.three_months_per_month || pricePerMonth;
                          savings = pricing.three_months_savings || 0;
                        } else if (months === 6) {
                          totalPrice = pricing.six_months || totalPrice;
                          pricePerMonth = pricing.six_months_per_month || pricePerMonth;
                          savings = pricing.six_months_savings || 0;
                        } else if (months === 12) {
                          totalPrice = pricing.yearly || totalPrice;
                          pricePerMonth = pricing.yearly_per_month || pricePerMonth;
                          savings = pricing.yearly_savings || 0;
                        }

                        const days = Math.ceil((new Date(packageFormData.subscription_end_date) - new Date(packageFormData.subscription_start_date)) / (1000 * 60 * 60 * 24));

                        return (
                          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-300">
                            <CardContent className="p-4">
                              <h4 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4" />
                                สรุปราคา
                              </h4>
                              <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-slate-700">ราคาต่อเดือน</span>
                                  <span className="font-semibold">฿{pricePerMonth.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-700">ระยะเวลา</span>
                                  <span className="font-semibold">{months} เดือน ({days} วัน)</span>
                                </div>
                                {savings > 0 && (
                                  <div className="flex justify-between text-green-700">
                                    <span>ส่วนลด</span>
                                    <span className="font-bold">-฿{savings.toLocaleString()}</span>
                                  </div>
                                )}
                                <div className="pt-2 border-t border-green-200 flex justify-between">
                                  <span className="font-bold text-green-900">ยอดรวม</span>
                                  <span className="text-xl font-bold text-green-900">฿{totalPrice.toLocaleString()}</span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })()}
                    </div>

                    {/* Package History with details */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 border-b pb-2">
                        <Calendar className="w-5 h-5" />
                        ประวัติการใช้งานทั้งหมด
                      </h3>
                      <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {getUserPackageHistory(selectedUser.email).length > 0 ? (
                          getUserPackageHistory(selectedUser.email).map((pkg) => {
                            const pkgName = pkg.package_name || '';
                            const isBasic = pkgName.toLowerCase().includes('basic') || pkgName.toLowerCase().includes('nano');
                            const isPro = pkgName.toLowerCase().includes('pro') || pkgName.toLowerCase().includes('micro');
                            const isTrial = pkg.package_id === 'trial';
                            const pkgIcon = isTrial ? Package : isBasic ? SettingsIcon : isPro ? Sparkles : Crown;

                            return (
                              <Card key={pkg.id} className={`border ${
                                pkg.status === 'active' ? 'border-green-300 bg-green-50' : 
                                pkg.status === 'cancelled' ? 'border-red-300 bg-red-50' :
                                'border-slate-200 bg-slate-50'
                              }`}>
                                <CardContent className="p-3">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="flex items-center gap-2">
                                      {React.createElement(pkgIcon, { 
                                        className: `w-4 h-4 ${
                                          isTrial ? 'text-amber-600' :
                                          isBasic ? 'text-slate-600' :
                                          isPro ? 'text-blue-600' :
                                          'text-amber-700'
                                        }` 
                                      })}
                                      <span className="text-sm font-bold text-slate-800">
                                        {pkg.package_name || 'Trial'}
                                      </span>
                                    </div>
                                    <Badge className={`text-xs ${
                                      pkg.status === 'active' ? 'bg-green-600' :
                                      pkg.status === 'cancelled' ? 'bg-red-600' :
                                      'bg-slate-600'
                                    } text-white`}>
                                      {pkg.status === 'active' ? 'ใช้งาน' : pkg.status === 'cancelled' ? 'ยกเลิก' : pkg.status}
                                    </Badge>
                                  </div>
                                  
                                  <div className="space-y-1 text-xs text-slate-600">
                                    <div className="flex items-center gap-1">
                                      <Globe className="w-3 h-3" />
                                      <span>{getBranchName(pkg.branch_id)}</span>
                                    </div>
                                    {pkg.subscription_start_date && (
                                      <div>เริ่ม: {format(parseISO(pkg.subscription_start_date), 'dd/MM/yyyy')}</div>
                                    )}
                                    {pkg.subscription_end_date && (
                                      <div>ถึง: {format(parseISO(pkg.subscription_end_date), 'dd/MM/yyyy')}</div>
                                    )}
                                    {pkg.price_per_month > 0 && (
                                      <div className="text-green-700 font-semibold">
                                        ฿{pkg.price_per_month.toLocaleString()}/เดือน
                                      </div>
                                    )}
                                  </div>

                                  {pkg.status === 'active' && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setPackageToCancel(pkg);
                                        setShowCancelDialog(true);
                                      }}
                                      className="w-full mt-2 text-red-600 hover:bg-red-50 text-xs h-7"
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      ยกเลิกแพ็กเกจนี้
                                    </Button>
                                  )}
                                </CardContent>
                              </Card>
                            );
                          })
                        ) : (
                          <div className="text-center py-8 text-slate-500 text-sm">
                            ไม่พบประวัติการใช้งาน
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => {
                      setShowPackageDialog(false);
                      setIsEditingPackage(false);
                    }}>
                      ปิด
                    </Button>
                    <Button
                      onClick={() => {
                        console.log('Button clicked, calling handleSavePackage');
                        handleSavePackage();
                      }}
                      disabled={!packageFormData.package_id || !packageFormData.subscription_start_date || !packageFormData.subscription_end_date || updatePackageMutation.isPending}
                      className="bg-gradient-to-r from-green-600 to-emerald-600"
                    >
                      {updatePackageMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4 mr-2" />
                          {isEditingPackage ? 'บันทึกการแก้ไข' : 'บันทึกแพ็กเกจใหม่'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>



          {/* Cancel Package Dialog */}
          <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                  ยืนยันการยกเลิก
                </DialogTitle>
              </DialogHeader>
              {packageToCancel && (
                <div className="space-y-4">
                  <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                    <p className="text-sm text-red-800 mb-2">
                      คุณกำลังจะยกเลิกแพ็กเกจของผู้ใช้นี้ในทุกสาขา:
                    </p>
                    <p className="font-bold text-red-900">
                      {packageToCancel.package_name}
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      ผู้ใช้: {packageToCancel.owner_email}
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      จำนวนสาขาที่จะถูกยกเลิก: {branchPackages.filter(bp => bp.owner_email === packageToCancel.owner_email && bp.status === 'active').length} สาขา
                    </p>
                  </div>

                  <p className="text-sm text-slate-600">
                    การยกเลิกจะมีผลทันทีกับทุกสาขา และผู้ใช้จะไม่สามารถเข้าถึงฟีเจอร์ของแพ็กเกจนี้ได้อีก
                  </p>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => {
                      setShowCancelDialog(false);
                      setPackageToCancel(null);
                    }}>
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={() => cancelPackageMutation.mutate(packageToCancel.owner_email)}
                      disabled={cancelPackageMutation.isPending}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {cancelPackageMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          กำลังยกเลิก...
                        </>
                      ) : (
                        <>
                          <X className="w-4 h-4 mr-2" />
                          ยืนยันยกเลิก
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Permissions Dialog */}
          <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-600" />
                  จัดการสิทธิ์: {selectedUser?.full_name}
                </DialogTitle>
              </DialogHeader>
              {selectedUser && (
                <div className="space-y-4">
                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                    <p className="text-sm text-orange-800">
                      <strong>สิทธิ์ที่เลือก:</strong> {(userPermissions[selectedUser.id] || []).length} รายการ
                    </p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { id: 'dashboard_view', label: 'ดูแดชบอร์ด' },
                      { id: 'rooms_view', label: 'ดูห้องพัก' },
                      { id: 'rooms_edit', label: 'แก้ไขห้องพัก' },
                      { id: 'tenants_view', label: 'ดูผู้เช่า' },
                      { id: 'tenants_edit', label: 'แก้ไขผู้เช่า' },
                      { id: 'payments_view', label: 'ดูการชำระเงิน' },
                      { id: 'payments_edit', label: 'แก้ไขการชำระเงิน' },
                      { id: 'bookings_edit_deposit', label: 'แก้ไขเงินมัดจำ' },
                      { id: 'settings_view', label: 'ดูการตั้งค่า' },
                    ].map(perm => {
                      const isChecked = (userPermissions[selectedUser.id] || []).includes(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                            isChecked ? 'bg-green-50 border-2 border-green-300' : 'hover:bg-slate-50 border-2 border-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => togglePermission(selectedUser.id, perm.id)}
                            className="w-4 h-4 rounded"
                          />
                          <span className={`text-sm flex-1 ${isChecked ? 'font-semibold text-green-700' : 'text-slate-700'}`}>
                            {perm.label}
                          </span>
                          {isChecked && <Check className="w-4 h-4 text-green-600" />}
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setShowPermissionsDialog(false)}>
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={() => {
                        updateUserPermissionsMutation.mutate({
                          userId: selectedUser.id,
                          permissions: userPermissions[selectedUser.id] || []
                        });
                      }}
                      className="bg-gradient-to-r from-orange-600 to-red-600"
                    >
                      บันทึก
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}