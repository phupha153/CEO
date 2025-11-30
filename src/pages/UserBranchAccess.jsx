import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Globe, AlertTriangle, Edit2, Check, Shield, Package, Calendar, CreditCard, Loader2 } from "lucide-react";
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
    package_type: 'trial',
    subscription_start_date: '',
    subscription_end_date: '',
    package_name: '',
  });

  const queryClient = useQueryClient();

  const { data: currentUser, isLoading: userLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const userAccessibleBranches = React.useMemo(() => currentUser?.accessible_branches || [], [currentUser]);
  const userRole = React.useMemo(() => currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee'), [currentUser]);

  // Redirect if not authorized
  useEffect(() => {
    if (!userLoading && currentUser && userRole !== 'developer' && userRole !== 'owner') {
      navigate(createPageUrl('BranchSelection'), { replace: true });
    }
  }, [userRole, currentUser, userLoading, navigate]);

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: allBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: branchPackages = [] } = useQuery({
    queryKey: ['branchPackages'],
    queryFn: () => base44.entities.BranchPackage.list('-created_date', 500),
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-payment_date', 500),
  });

  // กรองสาขาที่ผู้ใช้มีสิทธิ์เข้าถึง
  const branches = React.useMemo(() => {
    if (userRole === 'developer') return allBranches;
    return allBranches.filter(branch => userAccessibleBranches.includes(branch.id));
  }, [allBranches, userRole, userAccessibleBranches]);

  // กรองผู้ใช้ให้แสดงเฉพาะที่เกี่ยวข้องกับสาขาที่ตัวเองมีสิทธิ์
  const users = React.useMemo(() => {
    if (userRole === 'developer') return allUsers;
    return allUsers.filter(user => {
      const targetUserBranches = user.accessible_branches || [];
      // แสดงผู้ใช้ที่มีอย่างน้อย 1 สาขาที่ตัวเองมีสิทธิ์ หรือยังไม่มีสาขา
      return targetUserBranches.some(branchId => userAccessibleBranches.includes(branchId)) ||
             targetUserBranches.length === 0;
    });
  }, [allUsers, userRole, userAccessibleBranches]);

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
    if (userRole === 'developer') return users;
    
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

  const createOrUpdatePackageMutation = useMutation({
    mutationFn: async ({ branchId, ownerEmail, packageData }) => {
      const existingPackage = branchPackages.find(
        bp => bp.branch_id === branchId && bp.owner_email === ownerEmail
      );

      if (existingPackage) {
        return base44.entities.BranchPackage.update(existingPackage.id, packageData);
      } else {
        return base44.entities.BranchPackage.create({
          branch_id: branchId,
          owner_email: ownerEmail,
          ...packageData,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['branchPackages']);
      toast.success('บันทึกแพ็กเกจสำเร็จ');
      setShowPackageDialog(false);
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    },
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

  const handleOpenPackageDialog = (user) => {
    setSelectedUser(user);
    
    const existingPackages = branchPackages.filter(bp => bp.owner_email === user.email && bp.status === 'active');
    const existingPackage = existingPackages[0];

    if (existingPackage) {
      setPackageFormData({
        package_type: existingPackage.package_id === 'trial' ? 'trial' : 'paid',
        subscription_start_date: existingPackage.subscription_start_date || '',
        subscription_end_date: existingPackage.subscription_end_date || '',
        package_name: existingPackage.package_name || '',
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);
      
      setPackageFormData({
        package_type: 'trial',
        subscription_start_date: today,
        subscription_end_date: trialEnd.toISOString().split('T')[0],
        package_name: 'Trial Package',
      });
    }
    
    setShowPackageDialog(true);
  };

  const handleSavePackage = async () => {
    if (!selectedUser) return;

    const packageData = {
      package_id: packageFormData.package_type === 'trial' ? 'trial' : 'paid',
      package_name: packageFormData.package_name || (packageFormData.package_type === 'trial' ? 'Trial Package' : 'Paid Package'),
      subscription_start_date: packageFormData.subscription_start_date,
      subscription_end_date: packageFormData.subscription_end_date,
      status: 'active',
      price_per_month: packageFormData.package_type === 'trial' ? 0 : 1,
      features: [],
    };

    const userBranches = selectedUser.accessible_branches || [];
    const targetBranches = userBranches.length > 0 ? userBranches : branches.map(b => b.id);

    try {
      for (const branchId of targetBranches) {
        await createOrUpdatePackageMutation.mutateAsync({
          branchId,
          ownerEmail: selectedUser.email,
          packageData,
        });
      }
      toast.success(`บันทึกแพ็กเกจสำเร็จ (${targetBranches.length} สาขา)`);
      setShowPackageDialog(false);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด');
    }
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

  // Return null while redirecting or loading
  if (userLoading || (currentUser && userRole !== 'developer' && userRole !== 'owner')) {
    return null;
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

                        {/* Package & Payment Info */}
                        <div>
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <Package className="w-5 h-5 text-green-600" />
                              <h4 className="font-semibold text-slate-700">แพ็กเกจ</h4>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenPackageDialog(user, accessibleBranches[0] || branches[0]?.id)}
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
                              const isTrial = activePackage.package_id === 'trial';
                              return (
                                <div className={`p-3 rounded-lg border-2 ${
                                  isTrial ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
                                }`}>
                                  <div className="flex items-center gap-2 mb-2">
                                    <Package className={`w-4 h-4 ${isTrial ? 'text-amber-600' : 'text-green-600'}`} />
                                    <span className={`text-sm font-semibold ${isTrial ? 'text-amber-700' : 'text-green-700'}`}>
                                      {isTrial ? '🎉 ทดลองใช้' : activePackage.package_name}
                                    </span>
                                  </div>
                                  {activePackage.subscription_end_date && (
                                    <div className="flex items-center gap-1 text-xs text-slate-600 mb-1">
                                      <Calendar className="w-3 h-3" />
                                      <span>ถึง {format(parseISO(activePackage.subscription_end_date), 'dd/MM/yyyy')}</span>
                                    </div>
                                  )}
                                  <div className="text-xs text-slate-500">
                                    ใช้ได้ทุกสาขา ({userPackages.length} สาขา)
                                  </div>
                                </div>
                              );
                            } else {
                              return (
                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
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
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-800">
                      💡 <strong>หมายเหตุ:</strong> แสดงเฉพาะสาขาที่คุณมีสิทธิ์เข้าถึง ({branches.length} สาขา)
                    </p>
                  </div>
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
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-600" />
                  จัดการแพ็กเกจ: {selectedUser?.full_name}
                </DialogTitle>
              </DialogHeader>
              {selectedUser && (
                <div className="space-y-6">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>ผู้ใช้:</strong> {selectedUser.email}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      💡 แพ็กเกจจะใช้ได้กับทุกสาขาที่ผู้ใช้มีสิทธิ์เข้าถึง
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Form Section */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                        <Edit2 className="w-4 h-4" />
                        ตั้งค่าแพ็กเกจ
                      </h3>

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          ประเภท
                        </label>
                        <Select
                          value={packageFormData.package_type}
                          onValueChange={(value) => setPackageFormData({ ...packageFormData, package_type: value })}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="trial">🎉 Trial</SelectItem>
                            <SelectItem value="paid">💎 Paid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {packageFormData.package_type === 'paid' && (
                        <div>
                          <label className="text-xs font-semibold text-slate-700 block mb-1">
                            ชื่อแพ็กเกจ
                          </label>
                          <Input
                            value={packageFormData.package_name}
                            onChange={(e) => setPackageFormData({ ...packageFormData, package_name: e.target.value })}
                            placeholder="Premium"
                            className="h-9"
                          />
                        </div>
                      )}

                      <div>
                        <label className="text-xs font-semibold text-slate-700 block mb-1">
                          วันเริ่มต้น
                        </label>
                        <Input
                          type="date"
                          value={packageFormData.subscription_start_date}
                          onChange={(e) => setPackageFormData({ ...packageFormData, subscription_start_date: e.target.value })}
                          className="h-9"
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
                          className="h-9"
                        />
                      </div>

                      {packageFormData.subscription_start_date && packageFormData.subscription_end_date && (
                        <div className="bg-green-50 rounded-lg p-2 border border-green-200">
                          <p className="text-xs text-green-700 font-semibold">
                            📅 {Math.ceil((new Date(packageFormData.subscription_end_date) - new Date(packageFormData.subscription_start_date)) / (1000 * 60 * 60 * 24))} วัน
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Package History */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                        <Calendar className="w-4 h-4" />
                        ประวัติแพ็กเกจ
                      </h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {getUserPackageHistory(selectedUser.email).length > 0 ? (
                          getUserPackageHistory(selectedUser.email).map((pkg) => (
                            <div key={pkg.id} className={`p-2 rounded-lg border ${
                              pkg.status === 'active' ? 'bg-green-50 border-green-300' : 'bg-slate-50 border-slate-200'
                            }`}>
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-xs font-semibold text-slate-700 truncate">
                                  {getBranchName(pkg.branch_id)}
                                </p>
                                <Badge variant={pkg.status === 'active' ? 'default' : 'secondary'} className="text-xs h-5">
                                  {pkg.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-slate-600">{pkg.package_name || 'Trial'}</p>
                              {pkg.subscription_end_date && (
                                <p className="text-xs text-slate-500">
                                  ถึง {format(parseISO(pkg.subscription_end_date), 'dd/MM/yy')}
                                </p>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-slate-500 text-xs">
                            ไม่พบประวัติ
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Payment History */}
                    <div className="space-y-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                        <CreditCard className="w-4 h-4" />
                        ประวัติการชำระเงิน
                      </h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {getUserPaymentHistory(selectedUser.email).length > 0 ? (
                          getUserPaymentHistory(selectedUser.email).slice(0, 10).map((payment) => (
                            <div key={payment.id} className="p-2 rounded-lg bg-white border border-slate-200">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <p className="text-xs font-semibold text-slate-700">
                                  {payment.total_amount?.toLocaleString()} ฿
                                </p>
                                <Badge variant={payment.status === 'paid' ? 'default' : 'secondary'} className="text-xs h-5">
                                  {payment.status}
                                </Badge>
                              </div>
                              {payment.payment_date && (
                                <p className="text-xs text-slate-500">
                                  {format(parseISO(payment.payment_date), 'dd/MM/yy')}
                                </p>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-4 text-slate-500 text-xs">
                            ไม่พบประวัติ
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setShowPackageDialog(false)}>
                      ปิด
                    </Button>
                    <Button
                      onClick={handleSavePackage}
                      disabled={!packageFormData.subscription_start_date || !packageFormData.subscription_end_date || createOrUpdatePackageMutation.isPending}
                      className="bg-gradient-to-r from-green-600 to-emerald-600"
                    >
                      {createOrUpdatePackageMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        'บันทึกทุกสาขา'
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