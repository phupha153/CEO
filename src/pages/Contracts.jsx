import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, FileText, Eye, Edit2, Trash2, ScrollText, Search, RefreshCw, Calendar, User } from "lucide-react";
import { format, parseISO, addMonths, isWithinInterval } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "../components/shared/PageHeader";
import { FileText } from "lucide-react";

export default function Contracts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name') || 'ไม่ระบุ';

  // ⭐ Developer check
  const { data: currentUser, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
  });

  const isDeveloper = currentUser?.role === 'admin' || currentUser?.custom_role === 'developer';

  // Show loading
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">กำลังโหลด...</p>
      </div>
    );
  }

  // Show maintenance for non-developer
  if (!isDeveloper) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl p-12 text-center max-w-md border border-white/50">
          <div className="mb-6">
            <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <FileText className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-3">🚧 กำลังปรับปรุง</h1>
            <p className="text-slate-600 text-lg leading-relaxed">
              ทำการปิดใช้งานสำหรับผู้เช่า<br/>
              <span className="text-sm text-slate-500 mt-2 block">กรุณาติดต่อผู้ดูแลระบบ</span>
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={() => window.history.back()}
            className="bg-white/90 hover:bg-white border-slate-300 text-slate-700 shadow-md"
          >
            กลับไปหน้าเดิม
          </Button>
        </div>
      </div>
    );
  }
  
  const [searchQuery, setSearchQuery] = useState('');
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [renewMonths, setRenewMonths] = useState(12);

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
  };

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', selectedBranchId],
    queryFn: async () => {
      const allContracts = await base44.entities.Contract.list('-contract_date', 200);
      return allContracts.filter(contract => contract.branch_id === selectedBranchId);
    },
    ...retryConfig,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      const allTenants = await base44.entities.Tenant.list('-created_date', 100);
      return allTenants.filter(tenant => tenant.branch_id === selectedBranchId);
    },
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      const allRooms = await base44.entities.Room.list('-room_number', 1000);
      return allRooms.filter(room => room.branch_id === selectedBranchId);
    },
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      const allBookings = await base44.entities.Booking.list('-created_date', 500);
      return allBookings.filter(booking => booking.branch_id === selectedBranchId);
    },
    ...retryConfig,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Contract.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts', selectedBranchId]);
      toast.success('ลบสัญญาสำเร็จ');
    },
    onError: () => {
      toast.error('เกิดข้อผิดพลาดในการลบสัญญา');
    }
  });

  const renewMutation = useMutation({
    mutationFn: async ({ originalContract, months }) => {
      const newStartDate = parseISO(originalContract.end_date);
      const newEndDate = addMonths(newStartDate, months);
      
      // สร้างสัญญาใหม่
      const newContract = await base44.entities.Contract.create({
        branch_id: originalContract.branch_id,
        tenant_id: originalContract.tenant_id,
        room_id: originalContract.room_id,
        booking_id: originalContract.booking_id,
        contract_date: format(new Date(), 'yyyy-MM-dd'),
        start_date: format(newStartDate, 'yyyy-MM-dd'),
        end_date: format(newEndDate, 'yyyy-MM-dd'),
        rent_monthly: originalContract.rent_monthly,
        deposit: originalContract.deposit,
        pay_day: originalContract.pay_day,
        water_rate: originalContract.water_rate,
        elec_rate: originalContract.elec_rate,
        common_fee: originalContract.common_fee,
        internet_fee: originalContract.internet_fee,
        late_fee_per_day: originalContract.late_fee_per_day,
        allow_pets: originalContract.allow_pets,
        no_smoking: originalContract.no_smoking,
        termination_notice_days: originalContract.termination_notice_days,
        deposit_return_days: originalContract.deposit_return_days,
        late_payment_grace_days: originalContract.late_payment_grace_days,
        furniture_rent: originalContract.furniture_rent,
        contract_clauses: originalContract.contract_clauses,
        additional_rules: originalContract.additional_rules,
        lessor_name: originalContract.lessor_name,
        lessor_id: originalContract.lessor_id,
        lessor_phone: originalContract.lessor_phone,
        lessor_address: originalContract.lessor_address,
        lessee_name: originalContract.lessee_name,
        lessee_id: originalContract.lessee_id,
        lessee_phone: originalContract.lessee_phone,
        lessee_address: originalContract.lessee_address,
        building: originalContract.building,
        room_no: originalContract.room_no,
        floor: originalContract.floor,
        full_address: originalContract.full_address,
        status: 'draft',
        notes: `ต่อสัญญาจาก: ${originalContract.contract_no || originalContract.id.slice(0, 8)}`
      });

      // อัพเดต booking ถ้ามี
      if (originalContract.booking_id) {
        await base44.entities.Booking.update(originalContract.booking_id, {
          check_out_date: format(newEndDate, 'yyyy-MM-dd')
        });
      }

      return newContract;
    },
    onSuccess: (newContract) => {
      queryClient.invalidateQueries(['contracts', selectedBranchId]);
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      setRenewDialogOpen(false);
      setSelectedContract(null);
      toast.success('ต่อสัญญาสำเร็จ');
      navigate(`${createPageUrl('ContractEditor')}?contractId=${newContract.id}`);
    },
    onError: (error) => {
      console.error('Renew error:', error);
      toast.error('เกิดข้อผิดพลาดในการต่อสัญญา');
    }
  });

  const getStatusBadge = (status) => {
    const configs = {
      draft: { label: 'แบบร่าง', className: 'bg-slate-100 text-slate-700' },
      pending_signature: { label: 'รอลายเซ็น', className: 'bg-yellow-100 text-yellow-700' },
      signed: { label: 'เซ็นแล้ว', className: 'bg-green-100 text-green-700' },
      active: { label: 'ใช้งาน', className: 'bg-blue-100 text-blue-700' },
      expired: { label: 'หมดอายุ', className: 'bg-red-100 text-red-700' },
      terminated: { label: 'ยกเลิก', className: 'bg-red-100 text-red-700' },
    };
    return configs[status] ? <Badge className={configs[status].className}>{configs[status].label}</Badge> : null;
  };

  const getTenantInfo = (tenantId) => tenants.find(t => t.id === tenantId);
  const getRoomInfo = (roomId) => rooms.find(r => r.id === roomId);

  const handleDelete = (id) => {
    if (confirm('คุณแน่ใจว่าต้องการลบสัญญานี้?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleRenew = (contract) => {
    setSelectedContract(contract);
    setRenewMonths(12);
    setRenewDialogOpen(true);
  };

  const filteredContracts = useMemo(() => {
    if (!searchQuery.trim()) return contracts;

    const query = searchQuery.toLowerCase();
    return contracts.filter(contract => {
      const tenant = getTenantInfo(contract.tenant_id);
      const room = getRoomInfo(contract.room_id);
      
      // ค้นหาตามชื่อผู้เช่า
      const tenantMatch = tenant?.full_name?.toLowerCase().includes(query) ||
                          tenant?.phone?.toLowerCase().includes(query);
      
      // ค้นหาตามห้อง
      const roomMatch = room?.room_number?.toLowerCase().includes(query);
      
      // ค้นหาตามวันที่
      const dateMatch = contract.contract_date?.includes(query) ||
                       contract.start_date?.includes(query) ||
                       contract.end_date?.includes(query);
      
      // ค้นหาตามเลขสัญญา
      const contractMatch = contract.contract_no?.toLowerCase().includes(query);
      
      return tenantMatch || roomMatch || dateMatch || contractMatch;
    });
  }, [contracts, searchQuery, tenants, rooms]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader
        title="สัญญาเช่า"
        subtitle={`สาขา ${selectedBranchName}`}
        icon={ScrollText}
        actions={
          <Button
            onClick={() => navigate(createPageUrl('ContractEditor'))}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
          >
            <Plus className="w-5 h-5 mr-2" />
            สร้างสัญญาใหม่
          </Button>
        }
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Search Bar */}
          <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="ค้นหาสัญญา (ชื่อผู้เช่า, เบอร์โทร, ห้อง, วันที่, เลขสัญญา...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-white/90 border-slate-300 rounded-xl"
                />
              </div>
              {searchQuery && (
                <p className="text-xs text-slate-500 mt-2">
                  พบ {filteredContracts.length} สัญญาจากทั้งหมด {contracts.length} สัญญา
                </p>
              )}
            </CardContent>
          </Card>

          {/* Contracts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="wait">
              {filteredContracts.map((contract) => {
                const tenant = getTenantInfo(contract.tenant_id);
                const room = getRoomInfo(contract.room_id);
                const canRenew = contract.status === 'active' || contract.status === 'signed';

                return (
                  <motion.div
                    key={contract.id}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                  >
                    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl hover:shadow-2xl transition-all">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                              <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-slate-800">
                                {contract.contract_no || `สัญญา #${contract.id.slice(0, 8)}`}
                              </h3>
                              <p className="text-sm text-slate-600">ห้อง {room?.room_number || 'N/A'}</p>
                            </div>
                          </div>
                          {getStatusBadge(contract.status)}
                        </div>

                        <div className="space-y-2 mb-4">
                          <div className="text-sm flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-500" />
                            <span className="text-slate-600">ผู้เช่า: </span>
                            <span className="font-semibold text-slate-800">{tenant?.full_name || 'N/A'}</span>
                          </div>
                          {contract.contract_date && (
                            <div className="text-sm flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-500" />
                              <span className="text-slate-600">วันที่ทำสัญญา: </span>
                              <span className="font-semibold text-slate-800">
                                {format(parseISO(contract.contract_date), 'd MMM yyyy', { locale: th })}
                              </span>
                            </div>
                          )}
                          {contract.start_date && contract.end_date && (
                            <div className="text-sm">
                              <span className="text-slate-600">ระยะเวลา: </span>
                              <span className="font-semibold text-slate-800">
                                {format(parseISO(contract.start_date), 'd MMM yyyy', { locale: th })} - {format(parseISO(contract.end_date), 'd MMM yyyy', { locale: th })}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Link to={`${createPageUrl('ContractEditor')}?contractId=${contract.id}&mode=view`} className="flex-1">
                              <Button variant="outline" size="sm" className="w-full">
                                <Eye className="w-4 h-4 mr-1" />
                                ดู
                              </Button>
                            </Link>
                            {contract.status === 'draft' && (
                              <Link to={`${createPageUrl('ContractEditor')}?contractId=${contract.id}`} className="flex-1">
                                <Button variant="outline" size="sm" className="w-full">
                                  <Edit2 className="w-4 h-4 mr-1" />
                                  แก้ไข
                                </Button>
                              </Link>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(contract.id)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          {canRenew && (
                            <Button
                              size="sm"
                              className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                              onClick={() => handleRenew(contract)}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              ต่อสัญญา
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {filteredContracts.length === 0 && searchQuery && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardContent className="p-12 text-center">
                <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 mb-2">ไม่พบสัญญาที่ค้นหา</p>
                <p className="text-sm text-slate-500">ลองค้นหาด้วยคำอื่นหรือเคลียร์การค้นหา</p>
              </CardContent>
            </Card>
          )}

          {contracts.length === 0 && !searchQuery && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardContent className="p-12 text-center">
                <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">ยังไม่มีสัญญาในระบบ</p>
                <Link to={createPageUrl('ContractEditor')}>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    <Plus className="w-4 h-4 mr-2" />
                    สร้างสัญญาแรก
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Renew Contract Dialog */}
      <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-green-600" />
              ต่อสัญญา
            </DialogTitle>
          </DialogHeader>

          {selectedContract && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <p className="text-sm">
                  <span className="text-slate-600">สัญญาเดิม: </span>
                  <span className="font-semibold">{selectedContract.contract_no || selectedContract.id.slice(0, 8)}</span>
                </p>
                <p className="text-sm">
                  <span className="text-slate-600">ผู้เช่า: </span>
                  <span className="font-semibold">{getTenantInfo(selectedContract.tenant_id)?.full_name}</span>
                </p>
                <p className="text-sm">
                  <span className="text-slate-600">ห้อง: </span>
                  <span className="font-semibold">{getRoomInfo(selectedContract.room_id)?.room_number}</span>
                </p>
                <p className="text-sm">
                  <span className="text-slate-600">วันสิ้นสุดเดิม: </span>
                  <span className="font-semibold">
                    {format(parseISO(selectedContract.end_date), 'd MMM yyyy', { locale: th })}
                  </span>
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  ระยะเวลาการต่อสัญญา (เดือน)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="24"
                  value={renewMonths}
                  onChange={(e) => setRenewMonths(parseInt(e.target.value) || 1)}
                  className="w-full"
                />
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm font-semibold text-green-800 mb-1">สัญญาใหม่</p>
                <p className="text-sm text-green-700">
                  <span className="text-slate-600">วันเริ่มต้น: </span>
                  {format(parseISO(selectedContract.end_date), 'd MMM yyyy', { locale: th })}
                </p>
                <p className="text-sm text-green-700">
                  <span className="text-slate-600">วันสิ้นสุด: </span>
                  {format(addMonths(parseISO(selectedContract.end_date), renewMonths), 'd MMM yyyy', { locale: th })}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  * สัญญาใหม่จะถูกสร้างเป็นแบบร่าง คุณสามารถแก้ไขและเซ็นได้ในภายหลัง
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRenewDialogOpen(false);
                setSelectedContract(null);
              }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={() => renewMutation.mutate({ originalContract: selectedContract, months: renewMonths })}
              disabled={renewMutation.isPending}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {renewMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  กำลังสร้าง...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  ต่อสัญญา
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}