import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Upload, Scan, Send, CheckCircle, Camera, AlertTriangle, Search, X, User, DoorOpen, Calendar, Clock, Truck, Box, FileText, Plus } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import PageHeader from "../components/shared/PageHeader";

export default function Materials() {
  const [showDialog, setShowDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [scanningImage, setScanningImage] = useState(false);
  const [sendingNotification, setSendingNotification] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  
  const [formData, setFormData] = useState({
    recipient_name: '',
    tenant_id: '',
    room_id: '',
    delivery_date: format(new Date(), 'yyyy-MM-dd'),
    delivery_time: format(new Date(), 'HH:mm'),
    delivery_company: '',
    tracking_number: '',
    package_type: 'parcel',
    image_urls: [],
    scanned_text: '',
    notes: '',
    received_by: ''
  });

  const [matchedTenant, setMatchedTenant] = useState(null);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [possibleMatches, setPossibleMatches] = useState([]);
  const [editingDelivery, setEditingDelivery] = useState(null); // New state for editing

  const queryClient = useQueryClient();
  const selectedBranchId = localStorage.getItem('selected_branch_id');

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
    staleTime: 60 * 60 * 1000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list('-created_date', 100),
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const selectedBranchName = useMemo(() => {
    return branches.find(b => b.id === selectedBranchId)?.name || 'ไม่ระบุ';
  }, [branches, selectedBranchId]);

  const userPermissions = currentUser?.permissions || [];
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  const canView = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('maintenance_view');
  const canAdd = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('maintenance_add');
  const canEdit = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('maintenance_edit');

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
  };

  const { data: deliveries = [], isLoading } = useQuery({
    queryKey: ['materialDeliveries', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allDeliveries = await base44.entities.MaterialDelivery.list('-created_date', 500);
      return allDeliveries.filter(d => d.branch_id === selectedBranchId);
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allTenants = await base44.entities.Tenant.list('-created_date', 500);
      return allTenants.filter(t => t.branch_id === selectedBranchId);
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allRooms = await base44.entities.Room.list('-room_number', 1000);
      return allRooms.filter(r => r.branch_id === selectedBranchId);
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      if (!canAdd) throw new Error('คุณไม่มีสิทธิ์เพิ่มข้อมูลพัสดุ');
      return base44.entities.MaterialDelivery.create({ ...data, branch_id: selectedBranchId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['materialDeliveries', selectedBranchId]);
      setShowDialog(false);
      resetForm();
      toast.success('บันทึกข้อมูลพัสดุสำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, picked_up_date }) => {
      const updateData = { status };
      if (picked_up_date) updateData.picked_up_date = picked_up_date;
      return base44.entities.MaterialDelivery.update(id, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['materialDeliveries', selectedBranchId]);
      toast.success('อัปเดตสถานะสำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
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

  const handleScanImage = async () => {
    if (formData.image_urls.length === 0) {
      toast.error('กรุณาอัปโหลดรูปภาพก่อน');
      return;
    }

    setScanningImage(true);
    try {
      const imageUrl = formData.image_urls[0];
      
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: imageUrl,
        json_schema: {
          type: "object",
          properties: {
            recipient_name: {
              type: "string",
              description: "ชื่อผู้รับพัสดุที่อยู่ในรูปภาพ"
            },
            tracking_number: {
              type: "string",
              description: "เลขพัสดุถ้ามี"
            },
            delivery_company: {
              type: "string",
              description: "ชื่อบริษัทขนส่งถ้ามี"
            }
          }
        }
      });

      if (result.status === 'success' && result.output) {
        const scannedData = result.output;
        const recipientName = scannedData.recipient_name || '';
        
        setFormData(prev => ({
          ...prev,
          recipient_name: recipientName,
          tracking_number: scannedData.tracking_number || prev.tracking_number,
          delivery_company: scannedData.delivery_company || prev.delivery_company,
          scanned_text: JSON.stringify(scannedData)
        }));

        // ค้นหาผู้เช่าที่ตรงกับชื่อ - ปรับปรุงการ match ให้ยืดหยุ่นขึ้น
        if (recipientName) {
          // ลบช่องว่างและแปลงเป็นตัวพิมพ์เล็กเพื่อเปรียบเทียบ
          const normalizeText = (text) => text.toLowerCase().replace(/\s+/g, '');
          const normalizedRecipient = normalizeText(recipientName);
          
          // 1. ค้นหา exact match (หลังลบช่องว่าง)
          const exactMatch = tenants.find(t => 
            t.full_name && normalizeText(t.full_name) === normalizedRecipient
          );

          if (exactMatch) {
            setMatchedTenant(exactMatch);
            setFormData(prev => ({
              ...prev,
              tenant_id: exactMatch.id,
              room_id: getRoomIdFromTenant(exactMatch.id)
            }));
            toast.success(`✅ พบผู้เช่า: ${exactMatch.full_name}`);
          } else {
            // 2. ค้นหาแบบ partial match และ fuzzy match
            const scoredMatches = tenants
              .filter(t => t.full_name && t.status === 'active')
              .map(t => {
                const normalizedName = normalizeText(t.full_name);
                
                // คำนวณคะแนนความเหมือน
                let score = 0;
                
                // Partial match
                if (normalizedName.includes(normalizedRecipient) || normalizedRecipient.includes(normalizedName)) {
                  score += 50;
                }
                
                // Character overlap
                const recipientChars = normalizedRecipient.split('');
                const nameChars = normalizedName.split('');
                let matchCount = 0;
                
                for (const char of recipientChars) {
                  const idx = nameChars.indexOf(char);
                  if (idx > -1) {
                    matchCount++;
                    nameChars.splice(idx, 1);
                  }
                }
                
                const similarity = matchCount / Math.max(normalizedRecipient.length, normalizedName.length);
                score += similarity * 50;
                
                return { tenant: t, score };
              })
              .filter(item => item.score >= 40) // ลดเกณฑ์ลงเพื่อให้ match ได้ง่ายขึ้น
              .sort((a, b) => b.score - a.score);

            if (scoredMatches.length === 1 && scoredMatches[0].score >= 70) {
              // ถ้าเจอแค่คนเดียวและคะแนนสูง → เลือกอัตโนมัติ
              const match = scoredMatches[0].tenant;
              setMatchedTenant(match);
              setFormData(prev => ({
                ...prev,
                tenant_id: match.id,
                room_id: getRoomIdFromTenant(match.id)
              }));
              toast.success(`✅ พบผู้เช่า: ${match.full_name}`);
            } else if (scoredMatches.length > 0) {
              // แสดงตัวเลือกให้เลือก
              setPossibleMatches(scoredMatches.map(sm => sm.tenant));
              setShowMatchDialog(true);
              toast.info(`พบผู้เช่าที่เป็นไปได้ ${scoredMatches.length} คน`);
            } else {
              toast.warning(`⚠️ ไม่พบผู้เช่าที่ชื่อ "${recipientName}" ในระบบ`);
            }
          }
        }

        toast.success('สแกนชื่อจากรูปภาพสำเร็จ');
      } else {
        toast.error('ไม่สามารถสแกนข้อมูลจากรูปภาพได้');
      }
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('เกิดข้อผิดพลาดในการสแกนรูปภาพ');
    }
    setScanningImage(false);
  };

  const getRoomIdFromTenant = (tenantId) => {
    // ค้นหาห้องที่ผู้เช่าคนนี้กำลังเช่าอยู่
    const tenantRoom = rooms.find(r => r.tenant_id === tenantId); // Find room by tenant_id
    return tenantRoom?.id || '';
  };

  const handleSendNotification = async (delivery) => {
    if (!delivery.tenant_id) {
      toast.error('ไม่พบข้อมูลผู้เช่า ไม่สามารถส่งแจ้งเตือนได้');
      return;
    }

    const tenant = tenants.find(t => t.id === delivery.tenant_id);
    if (!tenant || !tenant.line_user_id) {
      toast.error('ผู้เช่ายังไม่ได้เชื่อมต่อ LINE');
      return;
    }

    setSendingNotification(delivery.id);
    try {
      const room = rooms.find(r => r.id === delivery.room_id);
      const message = `📦 แจ้งเตือนพัสดุ\n\nเรียน คุณ${tenant.full_name}\nพัสดุของคุณมาถึงแล้ว!\n\n` +
        `🏠 ห้อง: ${room?.room_number || 'ไม่ระบุ'}\n` +
        `📅 วันที่: ${format(new Date(delivery.delivery_date), 'd MMM yyyy', { locale: th })}\n` +
        `🕐 เวลา: ${delivery.delivery_time || '-'}\n` +
        `📦 ประเภท: ${getPackageTypeLabel(delivery.package_type)}\n` +
        (delivery.tracking_number ? `🔢 เลขพัสดุ: ${delivery.tracking_number}\n` : '') +
        (delivery.delivery_company ? `🚚 ขนส่งโดย: ${delivery.delivery_company}\n` : '') +
        `\nกรุณามารับพัสดุได้ที่แผนกต้อนรับค่ะ 🙏`;

      const response = await base44.functions.invoke('sendLineMessage', {
        to: tenant.line_user_id,
        message: message
      });

      if (response.data.success) {
        // อัปเดตสถานะว่าส่งแจ้งเตือนแล้ว
        await base44.entities.MaterialDelivery.update(delivery.id, {
          notification_sent: true,
          notification_sent_date: new Date().toISOString(),
          status: 'notified'
        });
        
        queryClient.invalidateQueries(['materialDeliveries', selectedBranchId]);
        toast.success(`✅ ส่งแจ้งเตือนไปยัง ${tenant.full_name} แล้ว`);
      } else {
        toast.error('ส่งแจ้งเตือนไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Notification error:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งแจ้งเตือน');
    }
    setSendingNotification(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      received_by: currentUser?.full_name || 'Unknown'
    };

    createMutation.mutate(submitData);
  };

  const handleSelectMatch = (tenant) => {
    setMatchedTenant(tenant);
    setFormData(prev => ({
      ...prev,
      tenant_id: tenant.id,
      recipient_name: tenant.full_name,
      room_id: getRoomIdFromTenant(tenant.id)
    }));
    setShowMatchDialog(false);
    toast.success(`เลือกผู้เช่า: ${tenant.full_name}`);
  };

  const resetForm = () => {
    setFormData({
      recipient_name: '',
      tenant_id: '',
      room_id: '',
      delivery_date: format(new Date(), 'yyyy-MM-dd'),
      delivery_time: format(new Date(), 'HH:mm'),
      delivery_company: '',
      tracking_number: '',
      package_type: 'parcel',
      image_urls: [],
      scanned_text: '',
      notes: '',
      received_by: ''
    });
    setMatchedTenant(null);
    setPossibleMatches([]);
    setEditingDelivery(null);
  };

  const getStatusBadge = (status) => {
    const configs = {
      received: { label: 'รับแล้ว', className: 'bg-blue-100 text-blue-700' },
      notified: { label: 'แจ้งแล้ว', className: 'bg-green-100 text-green-700' },
      picked_up: { label: 'รับไปแล้ว', className: 'bg-slate-100 text-slate-700' },
    };
    const config = configs[status] || configs.received;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  const getPackageTypeLabel = (type) => {
    const labels = {
      document: 'เอกสาร',
      parcel: 'พัสดุ',
      box: 'กล่อง',
      food: 'อาหาร',
      other: 'อื่นๆ'
    };
    return labels[type] || type;
  };

  const filteredDeliveries = useMemo(() => {
    let result = deliveries;

    if (activeTab === 'no_recipient') {
      // แสดงเฉพาะพัสดุที่ไม่พบผู้เช่า
      result = result.filter(d => !d.tenant_id);
    } else if (activeTab !== 'all') {
      result = result.filter(d => d.status === activeTab);
    }

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(d => {
        const tenant = tenants.find(t => t.id === d.tenant_id);
        const room = rooms.find(r => r.id === d.room_id);
        return d.recipient_name?.toLowerCase().includes(query) ||
               tenant?.full_name?.toLowerCase().includes(query) ||
               room?.room_number?.toLowerCase().includes(query) ||
               d.tracking_number?.toLowerCase().includes(query);
      });
    }

    return result;
  }, [deliveries, activeTab, debouncedSearch, tenants, rooms]);

  const totalPages = Math.ceil(filteredDeliveries.length / itemsPerPage);
  const paginatedDeliveries = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredDeliveries.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredDeliveries, currentPage]);

  const statusCounts = useMemo(() => ({
    all: deliveries.length,
    received: deliveries.filter(d => d.status === 'received' && d.tenant_id).length, // Exclude no_recipient from received
    notified: deliveries.filter(d => d.status === 'notified').length,
    picked_up: deliveries.filter(d => d.status === 'picked_up').length,
    no_recipient: deliveries.filter(d => !d.tenant_id).length,
  }), [deliveries]);

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
          <p className="text-slate-500 mt-2">โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 min-h-screen">
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600 text-lg">กำลังโหลดข้อมูลพัสดุ...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader 
        title="จัดการพัสดุ" 
        subtitle={`สาขา ${selectedBranchName}`}
        icon={Package}
        actions={
          <Button
            onClick={() => {
              setEditingDelivery(null);
              setMatchedTenant(null);
              setPossibleMatches([]);
              setFormData({
                recipient_name: '',
                tenant_id: '',
                room_id: '',
                delivery_date: new Date().toISOString().split('T')[0],
                delivery_time: '',
                delivery_company: '',
                tracking_number: '',
                package_type: 'parcel',
                image_urls: [],
                scanned_text: '',
                notes: '',
                received_by: ''
              });
              setShowDialog(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            บันทึกพัสดุใหม่
          </Button>
        }
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="ค้นหาพัสดุ (ชื่อผู้รับ, หมายเลขห้อง, เลขพัสดุ...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white/80 backdrop-blur-sm">
              <TabsTrigger value="all">ทั้งหมด ({statusCounts.all})</TabsTrigger>
              <TabsTrigger value="received">รับแล้ว ({statusCounts.received})</TabsTrigger>
              <TabsTrigger value="notified">แจ้งแล้ว ({statusCounts.notified})</TabsTrigger>
              <TabsTrigger value="picked_up">รับไปแล้ว ({statusCounts.picked_up})</TabsTrigger>
              <TabsTrigger value="no_recipient" className="text-amber-700">
                ⚠️ ไม่มีผู้รับ ({statusCounts.no_recipient})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence>
              {paginatedDeliveries.length === 0 ? (
                <Card className="bg-slate-50">
                  <CardContent className="p-8 text-center">
                    <Package className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">
                      {activeTab === 'no_recipient' ? 'ไม่มีพัสดุที่ยังไม่ระบุผู้รับ' : 'ยังไม่มีพัสดุในสถานะนี้'}
                    </h3>
                    <p className="text-slate-500">เริ่มบันทึกพัสดุที่มาส่งได้เลย</p>
                  </CardContent>
                </Card>
              ) : (
                paginatedDeliveries.map((delivery) => {
                  const tenant = tenants.find(t => t.id === delivery.tenant_id);
                  const room = rooms.find(r => r.id === delivery.room_id);
                  const hasNoTenant = !delivery.tenant_id;

                  return (
                    <motion.div
                      key={delivery.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                    >
                      <Card className={`bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all ${hasNoTenant ? 'border-amber-300 bg-amber-50/30' : ''}`}>
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-3">
                                <div className={`w-12 h-12 bg-gradient-to-br ${hasNoTenant ? 'from-amber-500 to-orange-600' : 'from-blue-500 to-indigo-600'} rounded-xl flex items-center justify-center shadow-lg`}>
                                  <Package className="w-6 h-6 text-white" />
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="text-xl font-bold text-slate-800">
                                      {delivery.recipient_name}
                                    </h3>
                                    {getStatusBadge(delivery.status)}
                                    {hasNoTenant && (
                                      <Badge className="bg-amber-100 text-amber-700">
                                        <AlertTriangle className="w-3 h-3 mr-1" />
                                        ไม่พบผู้เช่า
                                      </Badge>
                                    )}
                                  </div>
                                  {tenant && (
                                    <div className="flex items-center gap-3 text-sm text-slate-600">
                                      <span className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {tenant.full_name}
                                      </span>
                                      {room && (
                                        <span className="flex items-center gap-1">
                                          <DoorOpen className="w-3 h-3" />
                                          ห้อง {room.room_number}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="grid md:grid-cols-2 gap-3 mb-3 text-sm">
                                <div className="flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-blue-600" />
                                  <span className="text-slate-600">
                                    {format(new Date(delivery.delivery_date), 'd MMM yyyy', { locale: th })}
                                  </span>
                                </div>
                                {delivery.delivery_time && (
                                  <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-green-600" />
                                    <span className="text-slate-600">{delivery.delivery_time}</span>
                                  </div>
                                )}
                                {delivery.delivery_company && (
                                  <div className="flex items-center gap-2">
                                    <Truck className="w-4 h-4 text-orange-600" />
                                    <span className="text-slate-600">{delivery.delivery_company}</span>
                                  </div>
                                )}
                                {delivery.tracking_number && (
                                  <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-purple-600" />
                                    <span className="text-slate-600">{delivery.tracking_number}</span>
                                  </div>
                                )}
                              </div>

                              <Badge variant="outline" className="mb-3">
                                <Box className="w-3 h-3 mr-1" />
                                {getPackageTypeLabel(delivery.package_type)}
                              </Badge>

                              {delivery.image_urls && delivery.image_urls.length > 0 && (
                                <div className="flex gap-2 mt-3">
                                  {delivery.image_urls.map((url, index) => (
                                    <img
                                      key={index}
                                      src={url}
                                      alt={`รูป ${index + 1}`}
                                      className="w-20 h-20 object-cover rounded-lg border cursor-pointer hover:opacity-80"
                                      onClick={() => window.open(url, '_blank')}
                                    />
                                  ))}
                                </div>
                              )}

                              {delivery.notes && (
                                <p className="text-sm text-slate-600 mt-3 italic">{delivery.notes}</p>
                              )}

                              <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
                                <User className="w-3 h-3" />
                                รับโดย: {delivery.received_by || 'ไม่ระบุ'}
                              </div>
                            </div>

                            <div className="flex md:flex-col gap-2 md:min-w-[200px]">
                              {hasNoTenant && canEdit && (
                                <Card className="bg-amber-50 border-amber-300 p-3">
                                  <p className="text-xs text-amber-800 font-semibold mb-2">
                                    ⚠️ ต้องระบุผู้เช่าก่อนแจ้งเตือน
                                  </p>
                                  <p className="text-xs text-amber-600">
                                    กรุณาเลือกผู้เช่าด้วยตนเอง หรือแก้ไขข้อมูลพัสดุ
                                  </p>
                                </Card>
                              )}

                              {delivery.status === 'received' && !hasNoTenant && tenant?.line_user_id && canEdit && (
                                <Button
                                  onClick={() => handleSendNotification(delivery)}
                                  disabled={sendingNotification === delivery.id}
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 flex-1 md:flex-none"
                                >
                                  {sendingNotification === delivery.id ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                      กำลังส่ง...
                                    </>
                                  ) : (
                                    <>
                                      <Send className="w-4 h-4 mr-2" />
                                      แจ้งเตือนลูกค้า
                                    </>
                                  )}
                                </Button>
                              )}

                              {delivery.status === 'received' && !hasNoTenant && !tenant?.line_user_id && (
                                <Badge className="bg-amber-100 text-amber-700 text-center py-2">
                                  <AlertTriangle className="w-4 h-4 mr-1" />
                                  ผู้เช่าไม่มี LINE
                                </Badge>
                              )}

                              {(delivery.status === 'notified' || delivery.status === 'received') && !hasNoTenant && canEdit && (
                                <Button
                                  onClick={() => {
                                    updateStatusMutation.mutate({
                                      id: delivery.id,
                                      status: 'picked_up',
                                      picked_up_date: new Date().toISOString()
                                    });
                                  }}
                                  variant="outline"
                                  className="border-green-600 text-green-600 hover:bg-green-50 flex-1 md:flex-none"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  ลูกค้ารับแล้ว
                                </Button>
                              )}

                              {delivery.notification_sent && delivery.notification_sent_date && (
                                <div className="text-xs text-slate-500 text-center p-2 bg-green-50 rounded-lg">
                                  ส่งแจ้งเตือนเมื่อ:<br />
                                  {format(new Date(delivery.notification_sent_date), 'd MMM HH:mm', { locale: th })}
                                </div>
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
                    แสดง {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredDeliveries.length)} จาก {filteredDeliveries.length} รายการ
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

          {/* Form Dialog */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Camera className="w-6 h-6 text-blue-600" />
                  บันทึกพัสดุที่มาส่ง
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Step 1: Upload Image */}
                <Card className="bg-blue-50 border-blue-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Upload className="w-5 h-5 text-blue-600" />
                      ขั้นตอนที่ 1: ถ่ายรูป/อัปโหลดรูปใบนำส่ง
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                      className="cursor-pointer"
                    />
                    {uploadingImage && (
                      <div className="flex items-center gap-2 text-blue-600">
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm">กำลังอัปโหลด...</span>
                      </div>
                    )}
                    {formData.image_urls.length > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {formData.image_urls.map((url, index) => (
                          <div key={index} className="relative">
                            <img src={url} alt={`รูป ${index + 1}`} className="w-full h-32 object-cover rounded-lg border-2 border-green-500" />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white h-6 w-6"
                              onClick={() => {
                                setFormData(prev => ({
                                  ...prev,
                                  image_urls: prev.image_urls.filter((_, i) => i !== index)
                                }));
                              }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Step 2: Scan Name */}
                {formData.image_urls.length > 0 && (
                  <Card className="bg-purple-50 border-purple-200">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Scan className="w-5 h-5 text-purple-600" />
                        ขั้นตอนที่ 2: สแกนชื่อผู้รับจากรูปภาพ
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button
                        type="button"
                        onClick={handleScanImage}
                        disabled={scanningImage}
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      >
                        {scanningImage ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            กำลังสแกน AI...
                          </>
                        ) : (
                          <>
                            <Scan className="w-4 h-4 mr-2" />
                            สแกนชื่อด้วย AI
                          </>
                        )}
                      </Button>

                      {matchedTenant && (
                        <div className="bg-green-100 border-2 border-green-500 rounded-lg p-4">
                          <div className="flex items-center gap-2 text-green-800 mb-2">
                            <CheckCircle className="w-5 h-5" />
                            <span className="font-bold">✅ พบผู้เช่าในระบบ!</span>
                          </div>
                          <div className="space-y-1 text-sm">
                            <p><strong>ชื่อ:</strong> {matchedTenant.full_name}</p>
                            {matchedTenant.phone && <p><strong>เบอร์:</strong> {matchedTenant.phone}</p>}
                            {rooms.find(r => r.id === formData.room_id) && (
                              <p><strong>ห้อง:</strong> {rooms.find(r => r.id === formData.room_id)?.room_number}</p>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Step 3: Details */}
                <Card className="bg-slate-50 border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileText className="w-5 h-5 text-slate-600" />
                      รายละเอียดพัสดุ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>ชื่อผู้รับ *</Label>
                      <Input
                        value={formData.recipient_name}
                        onChange={(e) => setFormData({ ...formData, recipient_name: e.target.value })}
                        required
                        placeholder="ชื่อผู้รับพัสดุ"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        💡 ชื่อจะถูกกรอกอัตโนมัติเมื่อสแกน AI
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>วันที่มาส่ง *</Label>
                        <Input
                          type="date"
                          value={formData.delivery_date}
                          onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>เวลาที่มาส่ง</Label>
                        <Input
                          type="time"
                          value={formData.delivery_time}
                          onChange={(e) => setFormData({ ...formData, delivery_time: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>บริษัทขนส่ง</Label>
                        <Input
                          value={formData.delivery_company}
                          onChange={(e) => setFormData({ ...formData, delivery_company: e.target.value })}
                          placeholder="Kerry, Flash, ไปรษณีย์"
                        />
                      </div>
                      <div>
                        <Label>เลขพัสดุ</Label>
                        <Input
                          value={formData.tracking_number}
                          onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                          placeholder="เลขติดตามพัสดุ"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>ประเภทพัสดุ</Label>
                      <Select
                        value={formData.package_type}
                        onValueChange={(value) => setFormData({ ...formData, package_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="document">เอกสาร</SelectItem>
                          <SelectItem value="parcel">พัสดุ</SelectItem>
                          <SelectItem value="box">กล่อง</SelectItem>
                          <SelectItem value="food">อาหาร</SelectItem>
                          <SelectItem value="other">อื่นๆ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>หมายเหตุ</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={2}
                        placeholder="หมายเหตุเพิ่มเติม..."
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    disabled={createMutation.isPending}
                  >
                    {createMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกพัสดุ'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Match Selection Dialog */}
          <Dialog open={showMatchDialog} onOpenChange={setShowMatchDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>เลือกผู้เช่าที่ตรงกัน</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  พบผู้เช่าที่ชื่อคล้ายกัน {possibleMatches.length} คน กรุณาเลือก:
                </p>
                {possibleMatches.map((tenant) => {
                  const room = rooms.find(r => r.id === getRoomIdFromTenant(tenant.id)); // Adjust to find room based on tenant_id relation.
                  return (
                    <Card
                      key={tenant.id}
                      className="cursor-pointer hover:bg-blue-50 transition-all border-2 hover:border-blue-500"
                      onClick={() => handleSelectMatch(tenant)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-800">{tenant.full_name}</p>
                            <p className="text-sm text-slate-600">
                              {tenant.phone}
                              {room && ` • ห้อง ${room.room_number}`}
                            </p>
                          </div>
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                <Button
                  variant="outline"
                  onClick={() => setShowMatchDialog(false)}
                  className="w-full"
                >
                  ยกเลิก
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}