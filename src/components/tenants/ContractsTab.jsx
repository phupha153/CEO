import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Search, FileText, Plus, Eye, Edit2, Trash2, RefreshCw, X, ArrowLeft, Loader2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";

export default function ContractsTab({
  isDeveloper,
  contracts,
  contractSearchQuery,
  setContractSearchQuery,
  contractStatusFilter,
  setContractStatusFilter,
  filteredContracts,
  getTenantInfo,
  getRoomInfo,
  getContractStatusBadge,
  handleDeleteContract,
  handleRenewContract,
  canEditContract,
  canDeleteContract,
  canAddContract,
  deleteContractMutation,
  setActiveTab
}) {
  const navigate = useNavigate();

  // Under Maintenance for Non-Developers
  if (!isDeveloper) {
    return (
      <Card className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-2 border-amber-300 shadow-xl">
        <CardContent className="p-8 text-center">
          <div className="inline-block bg-amber-100 p-4 rounded-full mb-4">
            <AlertTriangle className="w-12 h-12 text-amber-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-800 mb-2">🔧 หน้ากำลังปรับปรุง</h3>
          <p className="text-slate-600 mb-6">ขออภัยในความไม่สะดวก ระบบสัญญาเช่ากำลังอัปเดตเพื่อประสิทธิภาพที่ดีขึ้น</p>
          <Button 
            onClick={() => setActiveTab('tenants')}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            กลับไปหน้าผู้เช่า
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Developer Mode - Full Access
  return (
    <>
      {/* Developer Mode Banner */}
      <div className="bg-purple-100 border border-purple-300 rounded-lg p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-purple-600 text-white">Developer Mode</Badge>
          <span className="text-sm text-purple-900">หน้านี้แสดงเฉพาะผู้พัฒนา - ผู้ใช้ทั่วไปจะเห็นข้อความ "กำลังปรับปรุง"</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setActiveTab('tenants')}
          className="border-purple-300 text-purple-700 hover:bg-purple-50"
        >
          <X className="w-4 h-4 mr-1" />
          ปิด
        </Button>
      </div>

      {/* Search & Filter Card */}
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
                      {getContractStatusBadge(contract.status)}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="text-sm flex items-center gap-2">
                        <span className="text-slate-600">ผู้เช่า: </span>
                        <span className="font-semibold text-slate-800">{tenant?.full_name || 'N/A'}</span>
                      </div>
                      {contract.contract_date && (
                        <div className="text-sm flex items-center gap-2">
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

      {/* Empty States */}
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
    </>
  );
}