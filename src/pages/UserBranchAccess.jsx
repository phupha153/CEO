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
import { Users, Search, Globe, AlertTriangle, Edit2, Check, Shield, Package, Calendar, CreditCard, Loader2, Crown, Sparkles, Settings as SettingsIcon, X, TrendingUp, Trash2 } from "lucide-react";
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



  const handleOpenBranchDialog = (user) => {
    setSelectedUser(user);
    setUserBranchAccess({ [user.id]: user.accessible_branches || [] });
    const currentRole = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
    setUserRoles({ [user.id]: currentRole });
    setShowBranchDialog(true);
  };

  const handleOpenPermissionsDialog = (user) => {
    setSelectedUser(user);
    setUserPermissions({ [user.id]: user.permissions || [] });
    setShowPermissionsDialog(true);
  };



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
            <Button
              onClick={cleanupAllUsers}
              variant="outline"
              className="text-red-600 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              ลบสาขาที่ไม่มีแล้ว (ทุกคน)
            </Button>
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
                        <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-2">
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
                      <Label className="text-sm font-semibold mb-2 block">สถานะ/บทบาท</Label>
                      <Select
                        value={userRoles[selectedUser.id] || 'employee'}
                        onValueChange={(value) => setUserRoles({ ...userRoles, [selectedUser.id]: value })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="เลือกบทบาท" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">👑 เจ้าของหอพัก</SelectItem>
                          <SelectItem value="manager">👔 ผู้จัดการ</SelectItem>
                          <SelectItem value="employee">👤 พนักงาน</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500 mt-1">
                        💡 เจ้าของ = มีสิทธิ์ทุกอย่าง, พนักงาน/ผู้จัดการ = มีสิทธิ์ตามที่กำหนด
                      </p>
                    </div>
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
                        const selectedBranches = userBranchAccess[selectedUser.id] || [];
                        const selectedRole = userRoles[selectedUser.id] || 'employee';
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
        </div>
      </div>
    </div>
  );
}