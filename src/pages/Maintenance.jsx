import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Wrench, AlertCircle, Clock, CheckCircle, Upload, RefreshCw, Search, X, AlertTriangle, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import PageHeader from "../components/shared/PageHeader";

export default function Maintenance() {
  const [showDialog, setShowDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [formData, setFormData] = useState({
    room_id: '',
    tenant_id: '',
    title: '',
    description: '',
    category: 'other',
    priority: 'medium',
    image_urls: [],
    assigned_to: '',
    notes: ''
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const itemsPerPage = 15;

  const queryClient = useQueryClient();

  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const userPermissions = currentUser?.permissions || [];
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  const canView = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('maintenance_view');
  const canAdd = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('maintenance_add');
  const canEdit = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('maintenance_edit');
  const canDelete = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('maintenance_delete');
  const canUpdateStatus = userRole === 'developer' || userPermissions.includes('maintenance_update_status');

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
  };

  const { data: maintenanceRequests = [], isLoading: maintenanceLoading, error: maintenanceError } = useQuery({
    queryKey: ['maintenanceRequests', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.MaintenanceRequest.filter({ branch_id: selectedBranchId }, '-created_date', 500);
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Room.filter({ branch_id: selectedBranchId }, '-room_number', 1000);
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 2 * 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Tenant.filter({ branch_id: selectedBranchId }, '-created_date', 500);
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      if (!canAdd) {
        throw new Error('คุณไม่มีสิทธิ์เพิ่มคำขอซ่อม');
      }
      if (!selectedBranchId) {
        throw new Error('ไม่พบสาขาที่เลือก กรุณาเลือกสาขา');
      }
      return base44.entities.MaintenanceRequest.create({ ...data, branch_id: selectedBranchId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['maintenanceRequests', selectedBranchId]);
      setShowDialog(false);
      resetForm();
      toast.success('บันทึกคำขอซ่อมสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, completed_date }) => {
      if (!canUpdateStatus) {
        throw new Error('คุณไม่มีสิทธิ์อัปเดตสถานะ');
      }
      const updateData = { status };
      if (status === 'completed' && completed_date) {
        updateData.completed_date = completed_date;
      }
      return base44.entities.MaintenanceRequest.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['maintenanceRequests', selectedBranchId]);
      toast.success('อัปเดตสถานะสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      if (!canDelete) {
        throw new Error('คุณไม่มีสิทธิ์ลบคำขอซ่อม');
      }
      return base44.entities.MaintenanceRequest.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['maintenanceRequests', selectedBranchId]);
      toast.success('ลบคำขอซ่อมสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({
        ...prev,
        image_urls: [...prev.image_urls, file_url]
      }));
      toast.success('อัปโหลดรูปภาพสำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดรูปภาพไม่สำเร็จ');
    }
    setUploadingImage(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    createMutation.mutate({ ...formData, status: 'pending' });
  };

  const resetForm = () => {
    setFormData({
      room_id: '',
      tenant_id: '',
      title: '',
      description: '',
      category: 'other',
      priority: 'medium',
      image_urls: [],
      assigned_to: '',
      notes: ''
    });
  };

  const getStatusBadge = (status) => {
    const configs = {
      pending: { label: 'รอดำเนินการ', className: 'bg-yellow-100 text-yellow-700', icon: Clock },
      in_progress: { label: 'กำลังซ่อม', className: 'bg-blue-100 text-blue-700', icon: Wrench },
      completed: { label: 'เสร็จแล้ว', className: 'bg-green-100 text-green-700', icon: CheckCircle },
      cancelled: { label: 'ยกเลิก', className: 'bg-red-100 text-red-700', icon: AlertCircle },
    };
    const config = configs[status] || configs.pending;
    const Icon = config.icon;
    return (
      <Badge className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority) => {
    const configs = {
      urgent: { label: 'เร่งด่วนมาก', className: 'bg-red-500 text-white' },
      high: { label: 'เร่งด่วน', className: 'bg-orange-500 text-white' },
      medium: { label: 'ปานกลาง', className: 'bg-yellow-500 text-white' },
      low: { label: 'ต่ำ', className: 'bg-blue-500 text-white' },
    };
    const config = configs[priority] || configs.medium;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      electric: 'ไฟฟ้า',
      plumbing: 'ประปา',
      furniture: 'เฟอร์นิเจอร์',
      air_conditioner: 'เครื่องปรับอากาศ',
      other: 'อื่นๆ'
    };
    return labels[category] || category;
  };

  const getRoomInfo = (roomId) => rooms.find(r => r.id === roomId);
  const getTenantInfo = (tenantId) => tenants.find(t => t.id === tenantId);

  const filteredRequests = useMemo(() => {
    let result = maintenanceRequests;

    if (activeTab !== 'all') {
      result = result.filter(req => req.status === activeTab);
    }

    if (selectedCategory !== 'all') {
      result = result.filter(req => req.category === selectedCategory);
    }

    if (selectedPriority !== 'all') {
      result = result.filter(req => req.priority === selectedPriority);
    }

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(req => {
        const room = getRoomInfo(req.room_id);
        const tenant = getTenantInfo(req.tenant_id);
        return req.title?.toLowerCase().includes(query) ||
               req.description?.toLowerCase().includes(query) ||
               room?.room_number?.toLowerCase().includes(query) ||
               tenant?.full_name?.toLowerCase().includes(query);
      });
    }

    return result;
  }, [maintenanceRequests, activeTab, selectedCategory, selectedPriority, debouncedSearch, rooms, tenants]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);
  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRequests, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, selectedCategory, selectedPriority]);

  const anyLoading = maintenanceLoading;
  const anyError = maintenanceError;

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-800">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
          <p className="text-slate-500 mt-2">โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
        </Card>
      </div>
    );
  }

  if (anyLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <PageHeader
          title="แจ้งซ่อม"
          subtitle={`สาขา ${selectedBranchName}`}
          icon={Wrench}
        />
        <div className="px-4 md:px-8 py-6">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-600 text-lg">กำลังโหลดคำขอซ่อม...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (anyError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <PageHeader
          title="แจ้งซ่อม"
          subtitle={`สาขา ${selectedBranchName}`}
          icon={Wrench}
        />
        <div className="px-4 md:px-8 py-6">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-red-900 mb-2">เกิดข้อผิดพลาด</h3>
                    <p className="text-sm text-red-700 mb-4">
                      ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง
                    </p>
                    <Button onClick={() => window.location.reload()} className="bg-red-600 hover:bg-red-700">
                      <RefreshCw className="w-4 h-4 mr-2" />
                      โหลดใหม่
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <PageHeader
        title="แจ้งซ่อม"
        subtitle={`สาขา ${selectedBranchName}`}
        icon={Wrench}
        actions={
          canAdd && (
            <Button
              onClick={() => setShowDialog(true)}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              แจ้งซ่อมใหม่
            </Button>
          )
        }
      />

      <div className="px-4 md:px-8 py-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
            <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="ค้นหาคำขอซ่อม (หัวข้อ, ห้อง, ชื่อผู้เช่า...)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-10 bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl"
                  />
                  {searchQuery && (
                    <Button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold text-slate-700">หมวดหมู่:</Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger className="w-36 bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        <SelectItem value="electric">ไฟฟ้า</SelectItem>
                        <SelectItem value="plumbing">ประปา</SelectItem>
                        <SelectItem value="furniture">เฟอร์นิเจอร์</SelectItem>
                        <SelectItem value="air_conditioner">แอร์</SelectItem>
                        <SelectItem value="other">อื่นๆ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold text-slate-700">ความสำคัญ:</Label>
                    <Select value={selectedPriority} onValueChange={setSelectedPriority}>
                      <SelectTrigger className="w-36 bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        <SelectItem value="urgent">เร่งด่วนมาก</SelectItem>
                        <SelectItem value="high">เร่งด่วน</SelectItem>
                        <SelectItem value="medium">ปานกลาง</SelectItem>
                        <SelectItem value="low">ต่ำ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white/80 backdrop-blur-sm">
              <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              <TabsTrigger value="pending">รอดำเนินการ</TabsTrigger>
              <TabsTrigger value="in_progress">กำลังซ่อม</TabsTrigger>
              <TabsTrigger value="completed">เสร็จแล้ว</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence>
              {paginatedRequests.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="text-center py-10 text-slate-500"
                >
                  ไม่พบคำขอซ่อมในสถานะนี้ หรือไม่ตรงกับคำค้นหา
                </motion.div>
              ) : (
                paginatedRequests.map((request) => {
                  const room = getRoomInfo(request.room_id);
                  const tenant = getTenantInfo(request.tenant_id);

                  return (
                    <motion.div
                      key={request.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all">
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {getStatusBadge(request.status)}
                                {getPriorityBadge(request.priority)}
                                <Badge variant="outline">{getCategoryLabel(request.category)}</Badge>
                              </div>

                              <div>
                                <h3 className="text-xl font-bold text-slate-800 mb-1">{request.title}</h3>
                                <p className="text-slate-600">{request.description}</p>
                              </div>

                              <div className="flex flex-wrap gap-4 text-sm">
                                <div>
                                  <span className="text-slate-500">ห้อง:</span>
                                  <span className="font-medium text-slate-800 ml-1">
                                    {room?.room_number || 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">ผู้แจ้ง:</span>
                                  <span className="font-medium text-slate-800 ml-1">
                                    {tenant?.full_name || 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">แจ้งเมื่อ:</span>
                                  <span className="font-medium text-slate-800 ml-1">
                                    {format(new Date(request.created_date), 'd MMM yyyy HH:mm', { locale: th })}
                                  </span>
                                </div>
                                {request.updated_date && request.updated_date !== request.created_date && (
                                  <div>
                                    <span className="text-slate-500">อัปเดต:</span>
                                    <span className="font-medium text-slate-800 ml-1">
                                      {format(new Date(request.updated_date), 'd MMM yyyy HH:mm', { locale: th })}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {request.image_urls && request.image_urls.length > 0 && (
                                <div className="flex gap-2">
                                  {request.image_urls.map((url, index) => (
                                    <img
                                      key={index}
                                      src={url}
                                      alt={`รูป ${index + 1}`}
                                      className="w-20 h-20 object-cover rounded-lg border"
                                    />
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex flex-col gap-2">
                              {request.status !== 'completed' && request.status !== 'cancelled' && (
                                <>
                                  {request.status === 'pending' && canUpdateStatus && (
                                    <>
                                      <Button
                                        onClick={() => {
                                          updateStatusMutation.mutate({
                                            id: request.id,
                                            status: 'in_progress'
                                          });
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700"
                                      >
                                        เริ่มดำเนินการ
                                      </Button>
                                      <Button
                                        onClick={() => {
                                          updateStatusMutation.mutate({
                                            id: request.id,
                                            status: 'completed',
                                            completed_date: new Date().toISOString().split('T')[0]
                                          });
                                        }}
                                        className="bg-green-600 hover:bg-green-700"
                                      >
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        ดำเนินการเสร็จสิ้น
                                      </Button>
                                    </>
                                  )}
                                  {request.status === 'in_progress' && canUpdateStatus && (
                                    <Button
                                      onClick={() => {
                                        updateStatusMutation.mutate({
                                          id: request.id,
                                          status: 'completed',
                                          completed_date: new Date().toISOString().split('T')[0]
                                        });
                                      }}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      ซ่อมเสร็จแล้ว
                                    </Button>
                                  )}
                                  {canUpdateStatus && (
                                    <Button
                                      variant="outline"
                                      className="text-orange-600 hover:text-orange-700"
                                      onClick={() => {
                                        if (confirm('คุณแน่ใจว่าต้องการยกเลิกคำขอนี้?')) {
                                          updateStatusMutation.mutate({
                                            id: request.id,
                                            status: 'cancelled'
                                          });
                                        }
                                      }}
                                    >
                                      ยกเลิก
                                    </Button>
                                  )}
                                </>
                              )}
                              {canDelete && (
                                <Button
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    if (confirm('คุณแน่ใจว่าต้องการลบคำขอซ่อมนี้? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
                                      deleteMutation.mutate(request.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 mr-1" />
                                  ลบ
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>

          {totalPages > 1 && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-slate-600">
                    แสดง {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredRequests.length)} จาก {filteredRequests.length} รายการ
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      ← ก่อนหน้า
                    </Button>
                    <span className="px-3 py-2 text-sm text-slate-700">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      ถัดไป →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>แจ้งซ่อมใหม่</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>เลือกห้อง *</Label>
                    <Select value={formData.room_id} onValueChange={(value) => setFormData({ ...formData, room_id: value })} required>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกห้อง" />
                      </SelectTrigger>
                      <SelectContent>
                        {rooms.map(room => (
                          <SelectItem key={room.id} value={room.id}>
                            ห้อง {room.room_number} - ชั้น {room.floor}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>ผู้แจ้ง</Label>
                    <Select value={formData.tenant_id} onValueChange={(value) => setFormData({ ...formData, tenant_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกผู้แจ้ง" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map(tenant => (
                          <SelectItem key={tenant.id} value={tenant.id}>
                            {tenant.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>หัวข้อปัญหา *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="เช่น หลอดไฟห้องนอนเสีย"
                  />
                </div>

                <div>
                  <Label>รายละเอียดปัญหา *</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    rows={3}
                    placeholder="อธิบายปัญหาโดยละเอียด..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ประเภทปัญหา *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })} required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="electric">ไฟฟ้า</SelectItem>
                        <SelectItem value="plumbing">ประปา</SelectItem>
                        <SelectItem value="furniture">เฟอร์นิเจอร์</SelectItem>
                        <SelectItem value="air_conditioner">เครื่องปรับอากาศ</SelectItem>
                        <SelectItem value="other">อื่นๆ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>ระดับความเร่งด่วน *</Label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })} required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">ต่ำ</SelectItem>
                        <SelectItem value="medium">ปานกลาง</SelectItem>
                        <SelectItem value="high">เร่งด่วน</SelectItem>
                        <SelectItem value="urgent">เร่งด่วนมาก</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>รูปภาพปัญหา</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="mt-2"
                  />
                  {formData.image_urls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      {formData.image_urls.map((url, index) => (
                        <img key={index} src={url} alt={`รูป ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    ยกเลิก
                  </Button>
                  <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600" disabled={createMutation.isLoading}>
                    {createMutation.isLoading ? 'กำลังบันทึก...' : 'แจ้งซ่อม'}
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