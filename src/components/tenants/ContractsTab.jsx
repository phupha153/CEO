import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, FileText, Plus, Edit2, Trash2, User, Calendar, Eye, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { format, parseISO, addMonths } from "date-fns";
import { th } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function ContractsTab({ 
  isDeveloper,
  contracts,
  canAddContract,
  canEditContract,
  canDeleteContract,
  deleteContractMutation,
  renewContractMutation,
  getTenantInfo,
  getRoomInfo
}) {
  const navigate = useNavigate();
  const [contractSearchQuery, setContractSearchQuery] = useState('');
  const [contractStatusFilter, setContractStatusFilter] = useState('active');
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedContract, setSelectedContract] = useState(null);
  const [renewMonths, setRenewMonths] = useState(12);
  const [showMaintenanceNotice, setShowMaintenanceNotice] = useState(true);

  const getContractStatusBadge = (status) => {
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

  const handleDeleteContract = (id) => {
    if (confirm('คุณแน่ใจว่าต้องการลบสัญญานี้?')) {
      deleteContractMutation.mutate(id);
    }
  };

  const handleRenewContract = (contract) => {
    setSelectedContract(contract);
    setRenewMonths(12);
    setRenewDialogOpen(true);
  };

  const filteredContracts = React.useMemo(() => {
    let filtered = [...contracts];

    if (contractStatusFilter !== 'all') {
      if (contractStatusFilter === 'active') {
        filtered = filtered.filter(c => c.status === 'active' || c.status === 'signed');
      } else {
        filtered = filtered.filter(c => c.status === contractStatusFilter);
      }
    }

    if (contractSearchQuery.trim()) {
      const query = contractSearchQuery.toLowerCase();
      filtered = filtered.filter(contract => {
        const tenant = getTenantInfo(contract.tenant_id);
        const room = getRoomInfo(contract.room_id);
        
        const tenantMatch = tenant?.full_name?.toLowerCase().includes(query) ||
                            tenant?.phone?.toLowerCase().includes(query);
        const roomMatch = room?.room_number?.toLowerCase().includes(query);
        const dateMatch = contract.contract_date?.includes(query) ||
                          contract.start_date?.includes(query) ||
                          contract.end_date?.includes(query);
        const contractMatch = contract.contract_no?.toLowerCase().includes(query);
        
        return tenantMatch || roomMatch || dateMatch || contractMatch;
      });
    }
    
    return filtered;
  }, [contracts, contractSearchQuery, contractStatusFilter, getTenantInfo, getRoomInfo]);

  // แสดงข้อความกำลังปรับปรุง (ซ่อนได้ถ้าเป็น developer)
  if (showMaintenanceNotice && !isDeveloper) {
    return (
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 shadow-xl">
        <CardContent className="p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-orange-400/10" />
          <div className="relative z-10">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Sparkles className="w-12 h-12 text-white animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">🚧 กำลังปรับปรุง</h3>
            <p className="text-slate-600 mb-2">หน้าสัญญาเช่ากำลังอยู่ระหว่างการพัฒนา</p>
            <p className="text-sm text-slate-500">เร็วๆ นี้...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Developer - แสดงข้อความพร้อมปุ่มปิด
  if (showMaintenanceNotice && isDeveloper) {
    return (
      <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 shadow-xl">
        <CardContent className="p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/10 to-orange-400/10" />
          <div className="relative z-10">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
              <Sparkles className="w-12 h-12 text-white animate-pulse" />
            </div>
            <h3 className="text-2xl font-bold text-slate-800 mb-3">🚧 กำลังปรับปรุง</h3>
            <p className="text-slate-600 mb-2">หน้าสัญญาเช่ากำลังอยู่ระหว่างการพัฒนา</p>
            <p className="text-sm text-slate-500 mb-6">เร็วๆ นี้...</p>
            
            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => setShowMaintenanceNotice(false)}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Eye className="w-4 h-4 mr-2" />
                เข้าสู่หน้าสัญญา (Developer)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ผู้พัฒนา - แสดงหน้าปกติ
  return (
    <>
      <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <Input
                type="text"
                placeholder="ค้นหาสัญญา (ชื่อ, เบอร์, ห้อง, เลขสัญญา...)"
                value={contractSearchQuery}
                onChange={(e) => setContractSearchQuery(e.target.value)}
                className="pl-10 bg-white/90 border-slate-300 rounded-xl h-14 w-full"
              />
            </div>
            <div className="w-full md:w-auto">
              <Select value={contractStatusFilter} onValueChange={setContractStatusFilter}>
                <SelectTrigger className="w-full md:w-[220px] h-14 rounded-xl bg-white/90 border-slate-300">
                  <SelectValue placeholder="สถานะสัญญา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="active">ใช้งานอยู่</SelectItem>
                  <SelectItem value="draft">แบบร่าง</SelectItem>
                  <SelectItem value="expired">หมดอายุ</SelectItem>
                  <SelectItem value="terminated">สิ้นสุด/ย้ายออก</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(contractSearchQuery || contractStatusFilter !== 'active') && (
            <p className="text-xs text-slate-500 mt-2">
              พบ {filteredContracts.length} สัญญาจากทั้งหมด {contracts.length} สัญญา
            </p>
          )}
        </CardContent>
      </Card>

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
                      {getContractStatusBadge(contract.status)}
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
                        {contract.status === 'draft' && canEditContract && (
                          <Link to={`${createPageUrl('ContractEditor')}?contractId=${contract.id}`} className="flex-1">
                            <Button variant="outline" size="sm" className="w-full">
                              <Edit2 className="w-4 h-4 mr-1" />
                              แก้ไข
                            </Button>
                          </Link>
                        )}
                        {canDeleteContract && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDeleteContract(contract.id)}
                            disabled={deleteContractMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      {canRenew && canAddContract && (
                        <Button
                          size="sm"
                          className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                          onClick={() => handleRenewContract(contract)}
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

      {filteredContracts.length === 0 && contractSearchQuery && (
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-12 text-center">
            <Search className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-2">ไม่พบสัญญาที่ค้นหา</p>
            <p className="text-sm text-slate-500">ลองค้นหาด้วยคำอื่นหรือเคลียร์การค้นหา</p>
          </CardContent>
        </Card>
      )}

      {contracts.length === 0 && !contractSearchQuery && (
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600 mb-4">ยังไม่มีสัญญาในระบบ</p>
            {canAddContract && (
              <Button
                onClick={() => navigate(createPageUrl('ContractEditor'))}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                สร้างสัญญาแรก
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Renew Dialog */}
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
              onClick={() => renewContractMutation.mutate({ originalContract: selectedContract, months: renewMonths })}
              disabled={renewContractMutation.isPending}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              {renewContractMutation.isPending ? (
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
    </>
  );
}