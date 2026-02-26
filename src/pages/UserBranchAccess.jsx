import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Users, Search, Globe, AlertTriangle, Edit2, Check, Shield, Package, Calendar, CreditCard, Loader2, Crown, Sparkles, Settings as SettingsIcon, X, TrendingUp, Trash2, Building2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const [userRoles, setUserRoles] = useState({}); // เก็บ custom_role ที่เลือก
  
  // Package Dialog State
  const [packageForm, setPackageForm] = useState({
    packageId: '',
    startDate: '',
    endDate: '',
    isTrialMode: true,
    pricePerMonth: 0
  });
  const [deletingPackage, setDeletingPackage] = useState(false);
  const [showBankDialog, setShowBankDialog] = useState(false);
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    bank_account_number: '',
    bank_account_name: '',
    promptpay: ''
  });

  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferTarget, setTransferTarget] = useState(null);
  const [targetTransferBranchIds, setTargetTransferBranchIds] = useState([]);

  const queryClient = useQueryClient();

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const userRole = React.useMemo(() => currentUser?.custom_role || (currentUser?.role === 'admin' ? 'developer' : 'employee'), [currentUser]);
  const isDeveloper = userRole === 'developer';

  // ⭐ เฉพาะ Developer เท่านั้นที่เข้าถึงหน้านี้ได้
  useEffect(() => {
    if (!userLoading && currentUser && !isDeveloper) {
      navigate(createPageUrl('Dashboard'), { replace: true });
    }
  }, [userLoading, currentUser, isDeveloper, navigate]);
  // Developer เห็นทุกสาขา (ไม่สนใจ accessible_branches)
  const userAccessibleBranches = React.useMemo(() => {
    return currentUser?.accessible_branches || [];
  }, [currentUser]);

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date', 500),
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: allBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });



  const { data: crmPackages } = useQuery({
    queryKey: ['crmPackages'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPackagesFromCRM', {});
      return response.data;
    },
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['payments', 'secure'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Payment',
        filters: {},
        sort: '-payment_date',
        limit: 500
      });
      return response.data.data;
    },
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: branchPackages = [] } = useQuery({
    queryKey: ['branchPackages'],
    queryFn: () => base44.entities.BranchPackage.list('-created_date', 500),
    retry: 2,
    staleTime: 2 * 60 * 1000,
  });

  const { data: globalConfigs = [] } = useQuery({
    queryKey: ['globalConfigs'],
    queryFn: () => base44.entities.Config.filter({ branch_id: null }, '', 100),
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
      manager: { label: '👔 ผู้จัดการ/พนักงาน', color: 'from-green-500 to-emerald-500' },
      employee: { label: '👤 ผู้จัดการ/พนักงาน', color: 'from-green-500 to-emerald-500' }
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
    mutationFn: async ({ userId, accessible_branches, custom_role }) => {
      console.log('🔄 Updating user:', { userId, accessible_branches, custom_role });
      const result = await base44.entities.User.update(userId, { 
        accessible_branches,
        custom_role
      });
      console.log('✅ Update result:', result);
      return result;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(['users']);
      await queryClient.refetchQueries(['users']);
      toast.success('อัปเดตสาขาและสิทธิ์สำเร็จ');
      setShowBranchDialog(false);
    },
    onError: (error) => {
      console.error('❌ Update error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    },
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

  const savePackageMutation = useMutation({
    mutationFn: async ({ userId, packageData }) => {
      const targetUser = allUsers.find(u => u.id === userId);
      if (!targetUser?.email) throw new Error('User email not found');

      // 1. Update user in local database
      const updateData = {
        plan_status: packageData.isTrialMode ? 'trial' : 'active',
        trial_ends_at: packageData.isTrialMode ? packageData.endDate : null,
        subscription_end_date: !packageData.isTrialMode ? packageData.endDate : null,
        package_id: packageData.isTrialMode ? 'trial' : packageData.packageId,
      };
      
      const updateResult = await base44.entities.User.update(userId, updateData);
      return updateResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('✅ บันทึกแพ็กเกจสำเร็จ');
      setShowPackageDialog(false);
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  });

  const deletePackageMutation = useMutation({
    mutationFn: async ({ userId }) => {
      await base44.entities.User.update(userId, {
        plan_status: null,
        trial_ends_at: null,
        subscription_end_date: null,
        package_id: null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('ลบแพ็กเกจสำเร็จ');
      setShowPackageDialog(false);
      setDeletingPackage(false);
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
      setDeletingPackage(false);
    }
  });

  const transferOwnershipMutation = useMutation({
    mutationFn: async ({ newOwnerUserId, newOwnerEmail, branch_ids }) => {
      if (!branch_ids || branch_ids.length === 0) throw new Error('ไม่พบรหัสสาขาที่จะโอน');

      const results = [];
      for (const b_id of branch_ids) {
        const branch = allBranches.find(b => b.id === b_id);
        
        if (!branch?.owner_id) {
           await base44.entities.Branch.update(b_id, { owner_id: newOwnerEmail });
           
           await base44.entities.User.update(newOwnerUserId, {
             custom_role: 'owner',
             permissions: [
               "dashboard_view", "rooms_view", "rooms_add", "rooms_edit", "rooms_delete",
               "tenants_view", "tenants_add", "tenants_edit", "tenants_delete",
               "bookings_view_daily", "bookings_add_daily", "bookings_edit_daily", "bookings_delete_daily",
               "contracts_view_monthly", "contracts_add_monthly", "contracts_edit_monthly", "contracts_delete_monthly",
               "payments_view", "payments_add", "payments_edit", "payments_confirm", "payments_send_receipt", "payments_send_comms_manual", "payments_delete",
               "meter_readings_view", "meter_readings_add", "meter_readings_edit", "meter_readings_edit_history", "meter_readings_delete",
               "expenses_view", "expenses_add", "expenses_edit", "expenses_delete",
               "maintenance_view", "maintenance_add", "maintenance_edit", "maintenance_delete", "maintenance_update_status",
               "reports_view_all", "reports_export", "accounting_view_all", "accounting_export", "announcements_send", "settings_view", "settings_edit"
             ]
           });
           results.push({ new_owner: newOwnerEmail });
        } else {
          const currentOwner = branch.owner_id;
          if (currentOwner === newOwnerEmail) {
            results.push({ success: true, message: 'ผู้ใช้นี้เป็นเจ้าของสาขาอยู่แล้ว' });
            continue;
          }
          
          const oldOwnerEmail = isDeveloper ? currentOwner : currentUser?.email;
          if (!oldOwnerEmail) {
             throw new Error(`ไม่พบข้อมูลเจ้าของเดิมสำหรับสาขา ${branch.branch_name}`);
          }

          const response = await base44.functions.invoke('transferOwnership', {
            branch_id: b_id,
            new_owner_email: newOwnerEmail,
            old_owner_email: oldOwnerEmail
          });
          results.push(response.data);
        }
      }
      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['users']);
      queryClient.invalidateQueries(['branches']);
      toast.success(`เปลี่ยนเจ้าของสาขาสำเร็จ`);
      
      setShowTransferDialog(false);
      setShowBranchDialog(false);
      
      setTimeout(() => window.location.reload(), 2000);
    },
    onError: (error) => {
      toast.error('เปลี่ยนเจ้าของสาขาไม่สำเร็จ: ' + error.message);
    }
  });

  const handleOpenBranchDialog = (user) => {
    setSelectedUser(user);
    setUserBranchAccess({ [user.id]: user.accessible_branches || [] });
    const currentRole = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
    setUserRoles({ [user.id]: currentRole });
    // รีเซ็ตค่าสาขาที่จะโอนเมื่อเปิด dialog ใหม่
    setTargetTransferBranchIds([]);
    setShowBranchDialog(true);
  };

  const handleOpenPermissionsDialog = (user) => {
    setSelectedUser(user);
    setUserPermissions({ [user.id]: user.permissions || [] });
    setShowPermissionsDialog(true);
  };

  const handleOpenPackageDialog = (user) => {
    setSelectedUser(user);
    setPackageForm({
      packageId: user.package_id || '',
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: user.trial_ends_at || user.subscription_end_date || format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
      isTrialMode: user.plan_status === 'trial' || !user.plan_status,
      pricePerMonth: 0
    });
    setShowPackageDialog(true);
  };

  const handlePackageSubmit = () => {
    if (!packageForm.isTrialMode && !packageForm.packageId) {
      toast.error('กรุณาเลือกแพ็กเกจ');
      return;
    }
    if (!packageForm.endDate) {
      toast.error('กรุณาเลือกวันสิ้นสุด');
      return;
    }

    savePackageMutation.mutate({
      userId: selectedUser.id,
      packageData: packageForm
    });
  };

  const handleOpenBankDialog = () => {
    const getConfig = (key) => globalConfigs.find(c => c.key === key)?.value || '';
    setBankForm({
      bank_name: getConfig('bank_name') || 'ธนาคารกสิกรไทย',
      bank_account_number: getConfig('bank_account_number') || '',
      bank_account_name: getConfig('bank_account_name') || '',
      promptpay: getConfig('promptpay') || ''
    });
    setShowBankDialog(true);
  };

  const saveBankConfigMutation = useMutation({
    mutationFn: async (data) => {
      const updates = Object.entries(data).map(async ([key, value]) => {
        const existing = globalConfigs.find(c => c.key === key);
        if (existing) {
          return base44.entities.Config.update(existing.id, { value });
        } else {
          return base44.entities.Config.create({
            key,
            value,
            branch_id: null,
            description: `Bank Config: ${key}`,
            value_type: 'string',
            category: 'billing'
          });
        }
      });
      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['globalConfigs']);
      toast.success('บันทึกข้อมูลธนาคารสำเร็จ');
      setShowBankDialog(false);
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  });



  const getUserPaymentHistory = (userEmail) => {
    return allPayments.filter(p => p.tenant_id && p.notes && p.notes.toLowerCase().includes(userEmail.toLowerCase()));
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
        actions={
          isDeveloper && (
            <div className="flex gap-2">
              <Button
                onClick={handleOpenBankDialog}
                variant="outline"
                className="text-blue-600 hover:bg-blue-50 border-blue-200"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                ตั้งค่าบัญชีธนาคาร
              </Button>
              <Button
                onClick={cleanupAllUsers}
                variant="outline"
                className="text-red-600 hover:bg-red-50 border-red-200"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                ลบสาขาที่ไม่มีแล้ว (ทุกคน)
              </Button>
            </div>
          )
        }
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
                const role = user.custom_role || (user.role === 'admin' ? 'developer' : 'employee');
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
                            {(isDeveloper || userRole === 'owner') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenBranchDialog(user)}
                                className="text-xs"
                              >
                                <Edit2 className="w-3 h-3 mr-1" />
                                แก้ไข
                              </Button>
                            )}
                          </div>

                          {(() => {
                            // Developer ที่ไม่มี accessible_branches = เข้าถึงทุกสาขา
                            if (role === 'developer' && accessibleBranches.length === 0) {
                              return (
                                <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border-2 border-purple-200">
                                  <div className="flex items-center gap-2">
                                    <Globe className="w-5 h-5 text-purple-600" />
                                    <span className="font-bold text-purple-700">เข้าถึงทุกสาขา (Developer)</span>
                                  </div>
                                </div>
                              );
                            }
                            
                            // Owner ที่ไม่มี accessible_branches = แสดงสาขาที่ตัวเองเป็นเจ้าของ
                            if (role === 'owner' && accessibleBranches.length === 0) {
                              const ownedBranches = allBranches.filter(b => b.owner_id === user.email || b.created_by === user.email);
                              if (ownedBranches.length === 0) {
                                return (
                                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                    <div className="flex items-center gap-2 text-amber-700">
                                      <AlertTriangle className="w-5 h-5" />
                                      <span className="text-sm font-semibold">ยังไม่มีสาขา</span>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div className="space-y-2">
                                  {ownedBranches.map((branch, idx) => (
                                    <div key={branch.id} className="bg-green-50 rounded-lg p-2 border border-green-200">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                                          <span className="text-green-700 font-bold text-xs">{idx + 1}</span>
                                        </div>
                                        <span className="text-sm text-slate-800 font-medium truncate">
                                          {branch.branch_name}
                                        </span>
                                        <Badge className="ml-auto bg-green-100 text-green-700 text-xs">เจ้าของ</Badge>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            
                            // ถ้ามี accessible_branches set แล้ว
                            if (accessibleBranches.length > 0) {
                              return (
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
                              );
                            }
                            
                            // Default: ไม่มีสาขา
                            return (
                              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                                <div className="flex items-center gap-2 text-amber-700">
                                  <AlertTriangle className="w-5 h-5" />
                                  <span className="text-sm font-semibold">ยังไม่ได้กำหนดสาขา</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* User Plan Status + Package Info */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <Package className="w-5 h-5 text-green-600" />
                              <h4 className="font-semibold text-slate-700">แพ็กเกจและสถานะ</h4>
                            </div>
                          </div>

                          {(() => {
                            const planStatus = user.plan_status || 'trial';
                            const trialEndsAt = user.trial_ends_at;
                            const packageName = user.package_name || '-';
                            
                            if (planStatus === 'trial' && trialEndsAt) {
                              try {
                                const endDate = parseISO(trialEndsAt);
                                const today = new Date();
                                today.setHours(0, 0, 0, 0);
                                const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                                
                                return (
                                  <div className="space-y-2">
                                    <div className="rounded-xl border-2 overflow-hidden bg-amber-50 border-amber-300">
                                      <div className="p-3 bg-amber-200/50">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <Package className="w-5 h-5 text-amber-700" />
                                            <span className="text-sm font-bold text-amber-800">🎉 ทดลองใช้</span>
                                          </div>
                                          <Badge className="bg-amber-600 text-white text-xs">Trial</Badge>
                                        </div>
                                      </div>
                                      <div className="p-3 bg-white/50 space-y-1">
                                        <div className="flex items-center gap-1 text-xs text-slate-700">
                                          <Calendar className="w-3 h-3" />
                                          <span>หมดอายุ {format(endDate, 'dd/MM/yyyy')}</span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs">
                                          <span className={daysLeft > 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                                            {daysLeft > 0 ? `⏳ เหลือ ${daysLeft} วัน` : '⚠️ หมดอายุแล้ว'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              } catch {
                                return (
                                  <div className="p-4 rounded-lg bg-amber-50 border-2 border-amber-300">
                                    <p className="text-xs text-amber-800 text-center">ทดลองใช้งาน</p>
                                  </div>
                                );
                              }
                            } else if (planStatus === 'active') {
                              return (
                                <div className="space-y-2">
                                  <div className="rounded-xl border-2 overflow-hidden bg-green-50 border-green-300">
                                    <div className="p-3 bg-green-200/50">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Crown className="w-5 h-5 text-green-700" />
                                          <span className="text-sm font-bold text-green-800">✅ Active</span>
                                        </div>
                                        <Badge className="bg-green-600 text-white text-xs">Premium</Badge>
                                      </div>
                                    </div>
                                    <div className="p-3 bg-white/50">
                                      <div className="space-y-1">
                                        <div className="flex items-center justify-between text-xs">
                                          <span className="text-slate-600">แพ็กเกจ:</span>
                                          <span className="font-semibold text-slate-800">{packageName}</span>
                                        </div>
                                        {user.subscription_end_date && (
                                          <div className="flex items-center justify-between text-xs">
                                            <span className="text-slate-600">หมดอายุ:</span>
                                            <span className="text-slate-800">{format(parseISO(user.subscription_end_date), 'dd/MM/yyyy')}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="p-4 rounded-lg bg-slate-50 border-2 border-dashed border-slate-300">
                                  <p className="text-xs text-slate-600 text-center">ยังไม่มีแผน</p>
                                </div>
                              );
                            }
                          })()}
                        </div>
                      </div>

                      {/* Quick Actions - เฉพาะ Developer และ Owner เท่านั้น */}
                      {(isDeveloper || userRole === 'owner') && (
                        <div className="mt-4 pt-4 border-t flex flex-wrap gap-2">
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
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenPackageDialog(user)}
                            className="text-green-600 hover:bg-green-50 border-green-300"
                          >
                            <Package className="w-4 h-4 mr-1" />
                            แพ็กเกจ
                          </Button>
                          {(() => {
                            const userBranches = user.accessible_branches || [];
                            const hasDeletedBranches = userBranches.some(branchId => 
                              !allBranches.some(b => b.id === branchId)
                            );
                            if (hasDeletedBranches && isDeveloper) {
                              return (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cleanupDeletedBranches(user)}
                                  className="text-red-600 hover:bg-red-50 border-red-200"
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  ลบสาขาเก่า
                                </Button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      )}
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
                  <div className="space-y-3">
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                      <p className="text-sm text-blue-800">
                        <strong>สาขาที่เลือก:</strong> {(userBranchAccess[selectedUser.id] || []).length} สาขา
                      </p>
                    </div>
                    
                    <div>
                      <Label className="text-sm font-semibold mb-2 block">สถานะ/บทบาท (สำหรับสาขาที่ให้สิทธิ์เข้าถึง)</Label>
                      <Select
                        value={userRoles[selectedUser.id] || 'employee'}
                        onValueChange={(value) => setUserRoles({ ...userRoles, [selectedUser.id]: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="เลือกบทบาท" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manager">👔 ผู้จัดการ</SelectItem>
                          <SelectItem value="employee">👤 พนักงาน</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 mt-1">
                        💡 พนักงาน/ผู้จัดการ = มีสิทธิ์ตามที่กำหนด (ไม่สามารถเปลี่ยนให้เป็นเจ้าของด้วยวิธีนี้ได้ หากต้องการโอนความเป็นเจ้าของ ให้ใช้ปุ่ม "โอนกรรมสิทธิ์" ด้านล่าง)
                      </p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-72 overflow-y-auto">
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
                        const selectedBranches = userBranchAccess[selectedUser.id] || [];
                        const selectedRole = userRoles[selectedUser.id] || 'employee';

                        // ถ้าเป็น developer เเละเลือกสาขาที่ตัวเองไม่ได้เป็นเจ้าของ เเต่ผู้ใช้นั้นเป็นเจ้าของ จะเข้ากรณีนี้ไม่ได้
                        if (selectedRole === 'owner') {
                          setTransferTarget(selectedUser);
                          setTargetTransferBranchIds(selectedBranches);
                          setShowTransferDialog(true);
                          return;
                        }

                        console.log('💾 Saving:', { 
                          userId: selectedUser.id, 
                          email: selectedUser.email,
                          accessible_branches: selectedBranches, 
                          custom_role: selectedRole 
                        });
                        updateUserBranchesMutation.mutate({
                          userId: selectedUser.id,
                          accessible_branches: selectedBranches,
                          custom_role: selectedRole
                        });
                      }}
                      disabled={updateUserBranchesMutation.isPending}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    >
                      {updateUserBranchesMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
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

          {/* Bank Config Dialog */}
          <Dialog open={showBankDialog} onOpenChange={setShowBankDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  ตั้งค่าบัญชีธนาคาร (สำหรับรับชำระเงิน)
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>ชื่อธนาคาร</Label>
                  <Input
                    value={bankForm.bank_name}
                    onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                    placeholder="เช่น ธนาคารกสิกรไทย"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ชื่อบัญชี</Label>
                  <Input
                    value={bankForm.bank_account_name}
                    onChange={(e) => setBankForm({ ...bankForm, bank_account_name: e.target.value })}
                    placeholder="ชื่อบัญชีเจ้าของ"
                  />
                </div>
                <div className="space-y-2">
                  <Label>เลขที่บัญชี</Label>
                  <Input
                    value={bankForm.bank_account_number}
                    onChange={(e) => setBankForm({ ...bankForm, bank_account_number: e.target.value })}
                    placeholder="XXX-X-XXXXX-X"
                  />
                </div>
                <div className="space-y-2">
                  <Label>พร้อมเพย์ (ถ้ามี)</Label>
                  <Input
                    value={bankForm.promptpay}
                    onChange={(e) => setBankForm({ ...bankForm, promptpay: e.target.value })}
                    placeholder="เบอร์โทร หรือ เลขบัตรประชาชน"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowBankDialog(false)}>ยกเลิก</Button>
                  <Button 
                    onClick={() => saveBankConfigMutation.mutate(bankForm)}
                    disabled={saveBankConfigMutation.isPending}
                    className="bg-blue-600 text-white"
                  >
                    {saveBankConfigMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Transfer Ownership Dialog */}
          <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="w-6 h-6" />
                  ยืนยันการโอนกรรมสิทธิ์
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Alert className="bg-red-50 border-red-200">
                  <AlertDescription className="text-red-800 text-sm">
                    คุณกำลังจะโอนสิทธิ์การเป็น <strong>"เจ้าของสาขา"</strong> ให้กับ <strong>{transferTarget?.full_name}</strong>
                    <br/><br/>
                    ⚠️ <strong>คำเตือน:</strong> หลังจากโอนสิทธิ์แล้ว คุณจะเสียสิทธิ์การเป็นเจ้าของสาขานี้ และจะถูกปรับสถานะเป็น "ผู้จัดการ" โดยอัตโนมัติ
                  </AlertDescription>
                </Alert>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  <Label>เลือกสาขาที่ต้องการโอน *</Label>
                  <div className="space-y-2 mt-2">
                    {branches.map(branch => {
                      const isChecked = targetTransferBranchIds.includes(branch.id);
                      return (
                        <label key={branch.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${isChecked ? 'bg-red-50 border-red-300' : 'hover:bg-slate-50 border-slate-200'}`}>
                          <input
                            type="checkbox"
                            className="w-4 h-4 rounded text-red-600"
                            checked={isChecked}
                            onChange={() => {
                              setTargetTransferBranchIds(prev => 
                                prev.includes(branch.id) 
                                  ? prev.filter(id => id !== branch.id)
                                  : [...prev, branch.id]
                              );
                            }}
                          />
                          <span className={isChecked ? 'font-semibold text-red-800' : 'text-slate-700'}>{branch.branch_name}</span>
                        </label>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    สามารถเลือกได้หลายสาขาเพื่อโอนกรรมสิทธิ์พร้อมกัน
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowTransferDialog(false)}>
                    ยกเลิก
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (!targetTransferBranchIds || targetTransferBranchIds.length === 0) {
                        toast.error('กรุณาเลือกสาขาที่ต้องการโอนอย่างน้อย 1 สาขา');
                        return;
                      }
                      
                      transferOwnershipMutation.mutate({
                        newOwnerUserId: transferTarget.id,
                        newOwnerEmail: transferTarget.email,
                        branch_ids: targetTransferBranchIds 
                      });
                      setShowTransferDialog(false);
                      setShowBranchDialog(false);
                    }}
                    disabled={transferOwnershipMutation.isPending}
                  >
                    {transferOwnershipMutation.isPending ? 'กำลังดำเนินการ...' : `ยืนยันโอนสิทธิ์ (${targetTransferBranchIds.length} สาขา)`}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Package Dialog */}
          <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-600" />
                  ตั้งค่าแพ็กเกจ: {selectedUser?.full_name}
                </DialogTitle>
              </DialogHeader>
              {selectedUser && (
                <div className="space-y-6">
                  {/* Trial/Paid Toggle */}
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold">โหมด</Label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => setPackageForm({ ...packageForm, isTrialMode: true, pricePerMonth: 0 })}
                        className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                          packageForm.isTrialMode
                            ? 'bg-amber-50 border-amber-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Sparkles className={`w-5 h-5 ${packageForm.isTrialMode ? 'text-amber-600' : 'text-slate-400'}`} />
                          <span className={`font-bold ${packageForm.isTrialMode ? 'text-amber-700' : 'text-slate-600'}`}>
                            Trial
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">ทดลองใช้ฟรี</p>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setPackageForm({ ...packageForm, isTrialMode: false })}
                        className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                          !packageForm.isTrialMode
                            ? 'bg-green-50 border-green-400'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-2 mb-1">
                          <Crown className={`w-5 h-5 ${!packageForm.isTrialMode ? 'text-green-600' : 'text-slate-400'}`} />
                          <span className={`font-bold ${!packageForm.isTrialMode ? 'text-green-700' : 'text-slate-600'}`}>
                            Paid
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">แพ็กเกจชำระเงิน</p>
                      </button>
                    </div>
                  </div>

                  {/* Info: Package applies to all user's branches */}
                  <Alert className="bg-blue-50 border-blue-300">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <AlertDescription className="text-sm text-blue-800">
                      <strong>📦 Package นี้จะใช้ได้กับทุกสาขา</strong>ที่ผู้ใช้คนนี้มีสิทธิ์เข้าถึง
                      {selectedUser?.accessible_branches?.length > 0 && (
                        <span className="block mt-1 text-xs">
                          ({selectedUser.accessible_branches.length} สาขา)
                        </span>
                      )}
                    </AlertDescription>
                  </Alert>

                  {/* Package Selection (Paid mode only) */}
                  {!packageForm.isTrialMode && (
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">เลือกแพ็กเกจ *</Label>
                      <Select 
                        value={packageForm.packageId} 
                        onValueChange={(value) => {
                          const pkg = crmPackages?.packages?.find(p => p.id === value);
                          setPackageForm({ 
                            ...packageForm, 
                            packageId: value,
                            pricePerMonth: pkg?.pricing?.monthly || pkg?.price_monthly || 0
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="-- เลือกแพ็กเกจ --" />
                        </SelectTrigger>
                        <SelectContent>
                          {crmPackages?.packages?.filter(p => p.app_system === 'dormitory').map(pkg => (
                            <SelectItem key={pkg.id} value={pkg.id}>
                              {pkg.package_name?.name || pkg.package_name || pkg.id} - ฿{pkg.pricing?.monthly || pkg.price_monthly || 0}/เดือน
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Date Range */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">วันเริ่มต้น *</Label>
                      <Input
                        type="date"
                        value={packageForm.startDate}
                        onChange={(e) => setPackageForm({ ...packageForm, startDate: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold">วันสิ้นสุด *</Label>
                      <Input
                        type="date"
                        value={packageForm.endDate}
                        onChange={(e) => setPackageForm({ ...packageForm, endDate: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border-2 border-blue-200">
                    <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      สรุปการตั้งค่า
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">ผู้ใช้:</span>
                        <span className="font-semibold text-slate-800">{selectedUser?.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">ใช้ได้กับ:</span>
                        <span className="font-semibold text-blue-700">
                          🌐 ทุกสาขาที่มีสิทธิ์
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">โหมด:</span>
                        <span className={`font-bold ${packageForm.isTrialMode ? 'text-amber-600' : 'text-green-600'}`}>
                          {packageForm.isTrialMode ? '🎉 Trial (ฟรี)' : '💳 Paid'}
                        </span>
                      </div>
                      {!packageForm.isTrialMode && packageForm.packageId && (
                        <div className="flex justify-between">
                          <span className="text-slate-600">ราคา:</span>
                          <span className="font-bold text-green-700">฿{packageForm.pricePerMonth}/เดือน</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-600">วันสิ้นสุด:</span>
                        <span className="font-semibold text-slate-800">
                          {packageForm.endDate ? format(parseISO(packageForm.endDate), 'dd MMM yyyy') : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between gap-2 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const currentMode = packageForm.isTrialMode ? 'Trial' : 'Paid';
                        const confirmMsg = `ยืนยันการลบแพ็กเกจ (${currentMode}) ของ ${selectedUser?.full_name}?\n\nการลบจะทำให้ผู้ใช้ไม่สามารถเข้าใช้งานระบบได้`;
                        if (confirm(confirmMsg)) {
                          setDeletingPackage(true);
                          deletePackageMutation.mutate({ userId: selectedUser.id });
                        }
                      }}
                      disabled={deletePackageMutation.isPending}
                      className="text-red-600 hover:bg-red-50 border-red-300"
                    >
                      {deletePackageMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 mr-1" />
                      )}
                      ลบแพ็กเกจ
                    </Button>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={() => setShowPackageDialog(false)}>
                        ยกเลิก
                      </Button>
                      <Button
                        onClick={handlePackageSubmit}
                        disabled={savePackageMutation.isPending}
                        className="bg-gradient-to-r from-green-600 to-emerald-600"
                      >
                        {savePackageMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            กำลังบันทึก...
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            บันทึก
                          </>
                        )}
                      </Button>
                    </div>
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