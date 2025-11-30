import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, Search, Filter, Calendar, User, Database, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import PageHeader from "../components/shared/PageHeader";

export default function ActivityLog() {
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [entityFilter, setEntityFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const selectedBranchId = localStorage.getItem('selected_branch_id');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me()
  });

  const { data: activityLogs = [], isLoading } = useQuery({
    queryKey: ['activityLogs'],
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 500),
    refetchInterval: 30000
  });

  const { data: allBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list()
  });

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
  const userAccessibleBranches = currentUser?.accessible_branches;
  const canViewAllBranches = userRole === 'developer' && (!userAccessibleBranches || userAccessibleBranches.length === 0);

  // กรองสาขาตามสิทธิ์
  const branches = React.useMemo(() => {
    if (canViewAllBranches) return allBranches;
    return allBranches.filter(b => userAccessibleBranches && userAccessibleBranches.includes(b.id));
  }, [allBranches, canViewAllBranches, userAccessibleBranches]);

  const filteredLogs = activityLogs
    .filter(log => {
      // กรองตามสาขา
      if (branchFilter !== 'all' && log.branch_id !== branchFilter) return false;
      
      // ถ้าไม่ใช่ developer และไม่มีการเลือกสาขาในฟิลเตอร์ ให้แสดงเฉพาะสาขาที่เลือก
      if (userRole !== 'developer' && branchFilter === 'all' && log.branch_id !== selectedBranchId) return false;
      
      if (actionFilter !== 'all' && log.action_type !== actionFilter) return false;
      if (entityFilter !== 'all' && log.entity_type !== entityFilter) return false;
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        return (
          log.description?.toLowerCase().includes(search) ||
          log.entity_name?.toLowerCase().includes(search) ||
          log.user_name?.toLowerCase().includes(search) ||
          log.user_email?.toLowerCase().includes(search)
        );
      }
      return true;
    });

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const entityTypes = [...new Set(activityLogs.map(log => log.entity_type))].filter(Boolean);

  const getActionBadge = (action) => {
    const badges = {
      create: { label: 'สร้าง', className: 'bg-green-600 text-white' },
      update: { label: 'แก้ไข', className: 'bg-blue-600 text-white' },
      delete: { label: 'ลบ', className: 'bg-red-600 text-white' }
    };
    return badges[action] || { label: action, className: 'bg-slate-600 text-white' };
  };

  const getEntityIcon = (entityType) => {
    const icons = {
      Room: '🚪',
      Expense: '💸',
      Payment: '💰',
      Booking: '📅',
      Tenant: '👤',
      MeterReading: '⚡',
      Maintenance: '🔧',
      Branch: '🏢'
    };
    return icons[entityType] || '📄';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <PageHeader
        title="ประวัติการจัดการ"
        subtitle="ติดตามและตรวจสอบการเปลี่ยนแปลงในระบบ"
        icon={Shield}
        showBackButton={true}
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Database className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">ทั้งหมด</p>
                    <p className="text-xl font-bold text-slate-800">{filteredLogs.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                    <div className="text-xl">➕</div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">สร้าง</p>
                    <p className="text-xl font-bold text-green-600">
                      {filteredLogs.filter(l => l.action_type === 'create').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <div className="text-xl">✏️</div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">แก้ไข</p>
                    <p className="text-xl font-bold text-blue-600">
                      {filteredLogs.filter(l => l.action_type === 'update').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                    <div className="text-xl">🗑️</div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">ลบ</p>
                    <p className="text-xl font-bold text-red-600">
                      {filteredLogs.filter(l => l.action_type === 'delete').length}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="ค้นหา..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสาขา" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสาขา</SelectItem>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        🏢 {branch.branch_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="ประเภทการกระทำ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกประเภท</SelectItem>
                    <SelectItem value="create">➕ สร้าง</SelectItem>
                    <SelectItem value="update">✏️ แก้ไข</SelectItem>
                    <SelectItem value="delete">🗑️ ลบ</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={entityFilter} onValueChange={setEntityFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="ประเภทข้อมูล" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกประเภท</SelectItem>
                    {entityTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {getEntityIcon(type)} {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Activity List */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                บันทึกกิจกรรม ({filteredLogs.length} รายการ)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paginatedLogs.length === 0 ? (
                <div className="text-center py-12">
                  <Shield className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                  <p className="text-slate-500">ไม่พบบันทึกกิจกรรม</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paginatedLogs.map((log) => {
                    const actionBadge = getActionBadge(log.action_type);
                    const entityIcon = getEntityIcon(log.entity_type);

                    return (
                      <div
                        key={log.id}
                        className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white"
                      >
                        <div className="flex items-start gap-4">
                          <div className="text-3xl flex-shrink-0">{entityIcon}</div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <Badge className={actionBadge.className}>
                                    {actionBadge.label}
                                  </Badge>
                                  <Badge variant="outline">
                                    {log.entity_type}
                                  </Badge>
                                  {log.branch_id && (
                                    <Badge className="bg-blue-100 text-blue-700">
                                      🏢 {branches.find(b => b.id === log.branch_id)?.branch_name || 'ไม่ระบุสาขา'}
                                    </Badge>
                                  )}
                                </div>
                                <p className="font-semibold text-slate-800 mb-1">
                                  {log.description}
                                </p>
                                {log.entity_name && (
                                  <p className="text-sm text-slate-600">
                                    {log.entity_name}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                              <div className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                <span>{log.user_name || log.user_email || log.created_by}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                <span>
                                  {format(new Date(log.created_date), 'd MMM yyyy HH:mm', { locale: th })}
                                </span>
                              </div>
                              {log.ip_address && (
                                <div className="flex items-center gap-1">
                                  <span>🌐 {log.ip_address}</span>
                                </div>
                              )}
                            </div>

                            {log.changes && Object.keys(log.changes).length > 0 && (
                              <details className="mt-3">
                                <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                                  ดูรายละเอียดการเปลี่ยนแปลง
                                </summary>
                                <div className="mt-2 bg-slate-50 rounded p-3 text-xs">
                                  <pre className="whitespace-pre-wrap text-slate-700">
                                    {JSON.stringify(log.changes, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg border disabled:opacity-50 hover:bg-slate-50"
                  >
                    ← ก่อนหน้า
                  </button>
                  <span className="text-sm text-slate-600">
                    หน้า {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg border disabled:opacity-50 hover:bg-slate-50"
                  >
                    ถัดไป →
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}