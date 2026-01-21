import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Clock, 
  Play, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  RefreshCw,
  FileText,
  Bell,
  CreditCard,
  Calendar,
  Mail,
  AlertTriangle,
  DoorOpen,
  Wrench,
  ScrollText,
  Package,
  TestTube,
  Building2,
  Zap,
  TrendingUp,
  Trash2,
  Users,
  Home,
  Save,
  Database,
  Wallet,
  Gauge
} from "lucide-react";
import { createPageUrl } from "@/utils";
import TestSlipUploader from "@/components/testing/TestSlipUploader";
import DeleteProgressDialog from "@/components/testing/DeleteProgressDialog";
import JobStatusIndicator from "@/components/cronjobs/JobStatusIndicator";
import AlertSettingsDialog from "@/components/cronjobs/AlertSettingsDialog";

const CRON_JOBS = [
  {
    id: 'recheckPendingSlips',
    name: 'ตรวจสอบสลิปค้าง',
    description: 'ตรวจสอบสลิปที่ธนาคารยังไม่พบข้อมูลซ้ำอัตโนมัติ แล้วส่งใบเสร็จให้ลูกค้า',
    icon: CreditCard,
    color: 'from-blue-500 to-cyan-500',
    recommendedInterval: '15-30 นาที',
    functionName: 'recheckPendingSlips',
    apis: ['SLIP2GO_API_KEY', 'LINE_CHANNEL_ACCESS_TOKEN']
  },
  {
    id: 'processInvoiceImageQueue',
    name: 'สร้างรูปใบแจ้งหนี้ + ส่ง LINE',
    description: 'สร้างรูปใบแจ้งหนี้ทีละใบและส่ง LINE ให้ลูกค้า (สำหรับบิลที่สร้างแล้วแต่ยังไม่ส่ง)',
    icon: FileText,
    color: 'from-purple-500 to-indigo-500',
    recommendedInterval: 'ทุก 2-5 นาที',
    functionName: 'processInvoiceImageQueue',
    apis: ['LINE_CHANNEL_ACCESS_TOKEN', 'BROWSERLESS_API_KEY']
  },
  {
    id: 'sendAdvanceReminders',
    name: 'ส่งบิลแจ้งหนี้ล่วงหน้า (LINE)',
    description: 'ส่งบิลแจ้งหนี้ให้ลูกค้าผ่าน LINE ก่อนถึงกำหนดชำระ',
    icon: Bell,
    color: 'from-amber-500 to-orange-500',
    recommendedInterval: 'วันละ 1 ครั้ง (เช้า)',
    functionName: 'sendAdvanceReminders',
    apis: ['LINE_CHANNEL_ACCESS_TOKEN', 'BROWSERLESS_API_KEY']
  },
  {
    id: 'sendDueDateReminders',
    name: 'แจ้งเตือนวันครบกำหนด (LINE)',
    description: 'ส่งแจ้งเตือนให้ลูกค้าผ่าน LINE เมื่อถึงวันครบกำหนดชำระ',
    icon: Calendar,
    color: 'from-red-500 to-pink-500',
    recommendedInterval: 'วันละ 1 ครั้ง (เช้า)',
    functionName: 'sendDueDateReminders',
    apis: ['LINE_CHANNEL_ACCESS_TOKEN', 'BROWSERLESS_API_KEY']
  },
  {
    id: 'sendAutomatedOverdueReminders',
    name: 'แจ้งเตือนค้างชำระอัตโนมัติ (LINE)',
    description: 'ส่งแจ้งเตือนให้ลูกค้าที่ค้างชำระผ่าน LINE อัตโนมัติ',
    icon: AlertTriangle,
    color: 'from-orange-500 to-red-500',
    recommendedInterval: 'วันละ 1 ครั้ง',
    functionName: 'sendAutomatedOverdueReminders',
    apis: ['LINE_CHANNEL_ACCESS_TOKEN']
  },
  {
    id: 'sendOverduePaymentNotifications',
    name: 'แจ้งเตือน Admin บิลค้างชำระ',
    description: 'ส่งสรุปบิลค้างชำระให้แอดมินและคำนวณค่าปรับ',
    icon: Mail,
    color: 'from-rose-500 to-pink-500',
    recommendedInterval: 'วันละ 1 ครั้ง',
    functionName: 'sendOverduePaymentNotifications',
    apis: []
  },
  {
    id: 'sendVacantRoomNotifications',
    name: 'แจ้งเตือนห้องว่าง',
    description: 'แจ้งเตือนห้องที่ว่างเกินกำหนดให้แอดมิน',
    icon: DoorOpen,
    color: 'from-cyan-500 to-blue-500',
    recommendedInterval: 'สัปดาห์ละ 1 ครั้ง',
    functionName: 'sendVacantRoomNotifications',
    apis: []
  },
  {
    id: 'sendMaintenanceNotifications',
    name: 'แจ้งเตือนงานซ่อมบำรุง',
    description: 'แจ้งเตือนงานซ่อมที่ค้างให้แอดมิน',
    icon: Wrench,
    color: 'from-teal-500 to-green-500',
    recommendedInterval: 'วันละ 1 ครั้ง',
    functionName: 'sendMaintenanceNotifications',
    apis: []
  },
  {
    id: 'sendContractExpiryNotifications',
    name: 'แจ้งเตือนสัญญาใกล้หมดอายุ',
    description: 'แจ้งเตือนสัญญาที่ใกล้หมดอายุให้แอดมิน',
    icon: ScrollText,
    color: 'from-violet-500 to-purple-500',
    recommendedInterval: 'สัปดาห์ละ 1 ครั้ง',
    functionName: 'sendContractExpiryNotifications',
    apis: []
  },
  {
    id: 'generateMonthlyBills',
    name: 'สร้างบิลรายเดือน',
    description: 'สร้างบิลค่าเช่ารายเดือนอัตโนมัติ (สร้างข้อมูลบิลเท่านั้น ไม่สร้างรูป)',
    icon: FileText,
    color: 'from-green-500 to-emerald-500',
    recommendedInterval: 'เดือนละ 1 ครั้ง (วันที่ตั้งค่า)',
    functionName: 'generateMonthlyBills',
    apis: []
  },
  {
    id: 'cronDeletePayments',
    name: '🗑️ ลบ Payment ต่อเนื่อง',
    description: 'ลบ Payment สาขา Wresident87777 ทีละรายการจนหมด (2 นาที/รายการ)',
    icon: TestTube,
    color: 'from-red-600 to-orange-600',
    recommendedInterval: 'ทุก 2 นาที (*/2 * * * *)',
    functionName: 'cronDeletePayments',
    apis: []
  }
];

export default function CronJobSettings() {
  const navigate = useNavigate();
  const [runningJobs, setRunningJobs] = useState({});
  const [jobResults, setJobResults] = useState({});
  const [cronBranchId, setCronBranchId] = useState('69255a34e816a8749fc765c2');
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [selectedBranchesForDelete, setSelectedBranchesForDelete] = useState([]);
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [deletingPayments, setDeletingPayments] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);
  const [selectedStatsBranch, setSelectedStatsBranch] = useState('all');
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [cronDeleteEntities, setCronDeleteEntities] = useState({
    Payment: true,
    MeterReading: true,
    Booking: false,
    Tenant: false,
    Room: false,
    MaintenanceRequest: true,
    Expense: true,
    Contract: false,
    MaterialDelivery: true
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: allBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
  });

  const { data: functionLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['functionLogs'],
    queryFn: () => base44.entities.FunctionLog.list('-run_timestamp', 500),
    refetchInterval: 10000, // รีเฟรชทุก 10 วินาที
  });

  const { data: cronJobAlerts = [] } = useQuery({
    queryKey: ['cronJobAlerts'],
    queryFn: () => base44.entities.CronJobAlert.list(),
    refetchInterval: 30000,
  });

  const { data: allPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['allPayments'],
    queryFn: () => base44.entities.Payment.list('-created_date', 50000),
    refetchInterval: 30000,
  });

  const { data: allTenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['allTenants'],
    queryFn: () => base44.entities.Tenant.list('-created_date', 10000),
    refetchInterval: 30000,
  });

  const { data: allRooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['allRooms'],
    queryFn: () => base44.entities.Room.list('-created_date', 10000),
    refetchInterval: 30000,
  });

  const { data: allUsers = [], isLoading: usersLoading } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list('-created_date', 10000),
    refetchInterval: 30000,
  });

  const { data: cronDeleteConfigs = [], refetch: refetchCronConfig } = useQuery({
    queryKey: ['cronDeleteConfigs'],
    queryFn: () => base44.entities.CronDeleteConfig.list('-updated_date', 1),
    retry: 0,
  });

  useEffect(() => {
    if (cronDeleteConfigs.length > 0) {
      const config = cronDeleteConfigs[0];
      setSelectedBranchesForDelete(config.selected_branches || []);
      setCronDeleteEntities(config.delete_entities || cronDeleteEntities);
    }
  }, [cronDeleteConfigs]);

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  // ถ้าไม่ใช่ developer ให้ redirect
  if (currentUser && userRole !== 'developer') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-slate-600 mb-4">หน้านี้สำหรับผู้พัฒนาเท่านั้น</p>
            <Button onClick={() => navigate(createPageUrl('Dashboard'))}>
              กลับหน้าหลัก
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const runCronJob = async (job) => {
    setRunningJobs(prev => ({ ...prev, [job.id]: true }));
    setJobResults(prev => ({ ...prev, [job.id]: null }));

    try {
      // ถ้าเป็น cronDeletePayments ให้ส่ง branch_id ไปด้วย
      const params = job.id === 'cronDeletePayments' ? { branch_id: cronBranchId } : {};
      const response = await base44.functions.invoke(job.functionName, params);
      
      setJobResults(prev => ({ 
        ...prev, 
        [job.id]: { 
          success: true, 
          data: response.data,
          timestamp: new Date().toISOString()
        } 
      }));

      toast.success(`${job.name} ทำงานสำเร็จ`);
      refetchLogs();
    } catch (error) {
      setJobResults(prev => ({ 
        ...prev, 
        [job.id]: { 
          success: false, 
          error: error.message,
          timestamp: new Date().toISOString()
        } 
      }));

      toast.error(`${job.name} ล้มเหลว: ${error.message}`);
    } finally {
      setRunningJobs(prev => ({ ...prev, [job.id]: false }));
    }
  };

  const getLastRun = (functionName) => {
    const log = functionLogs.find(l => l.function_name === functionName);
    if (!log) return null;
    return log;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="rounded-xl"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">ตั้งค่า Cron Jobs</h1>
              <p className="text-slate-600">จัดการงานที่ทำงานอัตโนมัติในระบบ</p>
            </div>
          </div>
          <Button
            onClick={() => setShowAlertSettings(true)}
            className="bg-gradient-to-r from-orange-500 to-red-500"
          >
            <Zap className="w-4 h-4 mr-2" />
            ตั้งค่าการแจ้งเตือน
          </Button>
        </div>

        {/* ⭐ ตารางสาขาทั้งหมดแบบละเอียด */}
        <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="w-5 h-5 text-indigo-600" />
              📊 ตารางสาขาทั้งหมด (เจ้าของ + ข้อมูล)
            </CardTitle>
            <CardDescription>
              รายละเอียดทุกสาขา: เจ้าของ, ผู้ใช้, ห้อง, บิล, บิลที่ส่ง (รองรับข้อมูล 1M+ รายการ)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Input
                type="text"
                placeholder="🔍 ค้นหา: ชื่อสาขา, รหัส, อีเมลเจ้าของ..."
                value={branchSearchQuery}
                onChange={(e) => setBranchSearchQuery(e.target.value)}
                className="max-w-md"
              />
            </div>
            {paymentsLoading || tenantsLoading || roomsLoading || usersLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr>
                      <th className="border border-slate-300 px-2 py-2 text-left font-bold text-slate-700 w-8">#</th>
                      <th className="border border-slate-300 px-2 py-2 text-left font-bold text-slate-700">สาขา</th>
                      <th className="border border-slate-300 px-2 py-2 text-left font-bold text-slate-700">รหัสสาขา</th>
                      <th className="border border-slate-300 px-2 py-2 text-left font-bold text-slate-700">เจ้าของสาขา</th>
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">สถานะ</th>
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">ทดลองหมดอายุ</th>
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">ผู้ใช้</th>
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">ห้อง</th>
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">ผู้เช่า</th>
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">บิลทั้งหมด</th>
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">มีรูปแล้ว</th>
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">ส่งแล้ว</th>
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">รอส่ง</th>
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">แจ้งครบกำหนด</th>
                      <th className="border border-slate-300 px-2 py-2 text-center font-bold text-slate-700">แจ้งเกินกำหนด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBranches.length === 0 ? (
                      <tr>
                        <td colSpan="15" className="border border-slate-300 px-4 py-8 text-center text-slate-500">
                          ไม่มีข้อมูลสาขา
                        </td>
                      </tr>
                    ) : allBranches.filter(branch => {
                      if (!branchSearchQuery.trim()) return true;
                      const query = branchSearchQuery.toLowerCase();
                      return (
                        branch.branch_name?.toLowerCase().includes(query) ||
                        branch.branch_code?.toLowerCase().includes(query) ||
                        branch.owner_id?.toLowerCase().includes(query) ||
                        branch.created_by?.toLowerCase().includes(query)
                      );
                    }).map((branch, index) => {
                      const branchPayments = allPayments.filter(p => p.branch_id === branch.id);
                      const branchTenants = allTenants.filter(t => t.branch_id === branch.id);
                      const branchRooms = allRooms.filter(r => r.branch_id === branch.id);
                      
                      const paymentsWithInvoice = branchPayments.filter(p => p.invoice_image_url);
                      const billsSent = branchPayments.filter(p => 
                        p.invoice_image_url && 
                        (p.bill_sent_date || p.advance_reminder_sent_date || p.due_date_reminder_sent_date) && 
                        p.status !== 'paid'
                      );

                      const advanceReminderEnabled = configs.find(c => 
                        c.key === 'send_advance_reminder' && c.branch_id === branch.id
                      )?.value === 'true';

                      const billsReady = branchPayments.filter(p => 
                        p.status !== 'paid' && 
                        p.invoice_image_url && 
                        !p.bill_sent_date && 
                        advanceReminderEnabled
                      );

                      const today = new Date().toISOString().split('T')[0];
                      const dueTodayCount = branchPayments.filter(p => 
                        p.status !== 'paid' && 
                        p.due_date === today &&
                        !p.due_date_reminder_sent_date
                      ).length;

                      const overdueCount = branchPayments.filter(p => 
                        p.status !== 'paid' && 
                        p.due_date && 
                        p.due_date < today && 
                        !p.overdue_reminder_sent_date
                      ).length;

                      // หาเจ้าของสาขา
                      const owner = allUsers.find(u => u.email === branch.owner_id || u.email === branch.created_by);
                      const trialEndsAt = owner?.trial_ends_at;
                      const planStatus = owner?.plan_status;

                      // นับจำนวน User ที่เป็นเจ้าของสาขานี้
                      const usersCount = allUsers.filter(u => 
                        u.accessible_branches && u.accessible_branches.includes(branch.id)
                      ).length || 1;
                      
                      return (
                        <tr key={branch.id} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-2 py-2 text-center text-slate-600">
                            {index + 1}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-slate-800 font-medium">
                            {branch.branch_name}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-slate-600">
                            {branch.branch_code || '-'}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-slate-600 text-xs" title={branch.owner_id || branch.created_by}>
                            {branch.owner_id || branch.created_by || '-'}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center">
                            {planStatus === 'trial' && (
                              <Badge className="bg-amber-500 text-white text-xs">Trial</Badge>
                            )}
                            {planStatus === 'active' && (
                              <Badge className="bg-green-500 text-white text-xs">Active</Badge>
                            )}
                            {planStatus === 'expired' && (
                              <Badge className="bg-red-500 text-white text-xs">Expired</Badge>
                            )}
                            {!planStatus && (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center text-xs">
                            {trialEndsAt ? (
                              <span className={(() => {
                                const endDate = new Date(trialEndsAt);
                                const today = new Date();
                                const daysLeft = Math.ceil((endDate - today) / (1000 * 60 * 60 * 24));
                                if (daysLeft < 0) return 'text-red-600 font-bold';
                                if (daysLeft <= 7) return 'text-orange-600 font-bold';
                                return 'text-slate-600';
                              })()}>
                                {new Date(trialEndsAt).toLocaleDateString('th-TH', { 
                                  day: '2-digit', 
                                  month: 'short', 
                                  year: 'numeric' 
                                })}
                                <br/>
                                <span className="text-[10px]">
                                  ({(() => {
                                    const daysLeft = Math.ceil((new Date(trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24));
                                    return daysLeft < 0 ? `เกิน ${Math.abs(daysLeft)} วัน` : `เหลือ ${daysLeft} วัน`;
                                  })()})
                                </span>
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center text-slate-700 font-medium">
                            {usersCount}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center text-slate-700 font-medium">
                            {branchRooms.length.toLocaleString()}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center text-slate-700 font-medium">
                            {branchTenants.length.toLocaleString()}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center text-blue-700 font-bold">
                            {branchPayments.length.toLocaleString()}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center text-green-700 font-bold">
                            {paymentsWithInvoice.length.toLocaleString()}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center text-purple-700 font-bold">
                            {billsSent.length.toLocaleString()}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center text-amber-700 font-bold">
                            {billsReady.length.toLocaleString()}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center text-red-600 font-bold">
                            {dueTodayCount.toLocaleString()}
                          </td>
                          <td className="border border-slate-300 px-2 py-2 text-center text-orange-600 font-bold">
                            {overdueCount.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    
                    {/* ⭐ แถวรวม */}
                    <tr className="bg-slate-200 font-bold">
                      <td className="border border-slate-400 px-2 py-2 text-center" colSpan="4">
                        รวมทั้งหมด
                      </td>
                      <td className="border border-slate-400 px-2 py-2 text-center text-slate-800" colSpan="2">
                        {allUsers.filter(u => u.plan_status === 'trial').length} Trial / {allUsers.filter(u => u.plan_status === 'active').length} Active
                      </td>
                      <td className="border border-slate-400 px-2 py-2 text-center text-slate-800">
                        {allBranches.length}
                      </td>
                      <td className="border border-slate-400 px-2 py-2 text-center text-slate-800">
                        {allRooms.length.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 px-2 py-2 text-center text-slate-800">
                        {allTenants.length.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 px-2 py-2 text-center text-blue-800">
                        {allPayments.length.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 px-2 py-2 text-center text-green-800">
                        {allPayments.filter(p => p.invoice_image_url).length.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 px-2 py-2 text-center text-purple-800">
                        {allPayments.filter(p => 
                          p.invoice_image_url && 
                          (p.bill_sent_date || p.advance_reminder_sent_date || p.due_date_reminder_sent_date) && 
                          p.status !== 'paid'
                        ).length.toLocaleString()}
                      </td>
                      <td className="border border-slate-400 px-2 py-2 text-center text-amber-800">
                        {(() => {
                          const enabledBranchIds = configs
                            .filter(c => c.key === 'send_advance_reminder' && c.value === 'true')
                            .map(c => c.branch_id);
                          return allPayments.filter(p => 
                            p.status !== 'paid' && 
                            p.invoice_image_url && 
                            !p.bill_sent_date && 
                            enabledBranchIds.includes(p.branch_id)
                          ).length.toLocaleString();
                        })()}
                      </td>
                      <td className="border border-slate-400 px-2 py-2 text-center text-red-800">
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          return allPayments.filter(p => 
                            p.status !== 'paid' && 
                            p.due_date === today &&
                            !p.due_date_reminder_sent_date
                          ).length.toLocaleString();
                        })()}
                      </td>
                      <td className="border border-slate-400 px-2 py-2 text-center text-orange-800">
                        {(() => {
                          const today = new Date().toISOString().split('T')[0];
                          return allPayments.filter(p => 
                            p.status !== 'paid' && 
                            p.due_date && 
                            p.due_date < today && 
                            !p.overdue_reminder_sent_date
                          ).length.toLocaleString();
                        })()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Statistics Card */}
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-600" />
                  สถิติการชำระเงิน
                </CardTitle>
                <CardDescription>ภาพรวมการชำระเงินและใบแจ้งหนี้ทั้งหมด</CardDescription>
              </div>
              <Select value={selectedStatsBranch} onValueChange={setSelectedStatsBranch}>
                <SelectTrigger className="w-[280px] bg-white">
                  <SelectValue placeholder="เลือกสาขา" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      ทุกสาขา
                    </div>
                  </SelectItem>
                  {allBranches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {paymentsLoading || tenantsLoading || roomsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : (() => {
              const filteredPayments = selectedStatsBranch === 'all' 
                ? allPayments 
                : allPayments.filter(p => p.branch_id === selectedStatsBranch);
              
              const filteredTenants = selectedStatsBranch === 'all'
                ? allTenants
                : allTenants.filter(t => t.branch_id === selectedStatsBranch);
              
              const filteredRooms = selectedStatsBranch === 'all'
                ? allRooms
                : allRooms.filter(r => r.branch_id === selectedStatsBranch);

              const enabledBranchIds = configs
                .filter(c => (c.key === 'send_advance_reminder' || c.key === 'send_due_date_reminder' || c.key === 'send_overdue_reminder') && c.value === 'true')
                .map(c => c.branch_id);

              const today = new Date();
              const todayStr = today.toISOString().split('T')[0];
              
              // ⭐ นับห้องที่รอส่งแจ้งครบกำหนด
              const dueTodayPayments = filteredPayments.filter(p => 
                p.status !== 'paid' && 
                p.due_date === todayStr &&
                !p.due_date_reminder_sent_date
              );
              
              // ⭐ นับห้องที่รอส่งแจ้งเกินกำหนด
              const overduePayments = filteredPayments.filter(p => {
                if (p.status === 'paid' || !p.due_date) return false;
                return p.due_date < todayStr && !p.overdue_reminder_sent_date;
              });

              // สร้าง Map สำหรับดึงข้อมูลห้องและผู้เช่า
              const roomMap = new Map(filteredRooms.map(r => [r.id, r]));
              const tenantMap = new Map(filteredTenants.map(t => [t.id, t]));

              // ⭐ นับสลิปที่รอตรวจสอบซ้ำ
              const pendingSlipsRecheck = filteredPayments.filter(p => 
                p.status === 'pending' && 
                p.payment_slip_url && 
                p.notes && 
                (p.notes.includes('รอตรวจสอบซ้ำ') || p.notes.includes('รอตรวจสอบ'))
              );

              return (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  <div className="bg-white p-4 rounded-xl border-2 border-gray-200">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-gray-800">
                        {filteredPayments.length.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">บิลทั้งหมด</p>
                    </div>
                  </div>

                  {/* ⭐ สลิปรอตรวจสอบซ้ำ */}
                  <div className="bg-white p-4 rounded-xl border-2 border-purple-200 cursor-pointer hover:shadow-md transition-shadow" title={pendingSlipsRecheck.map(p => {
                    const room = roomMap.get(p.room_id);
                    const tenant = tenantMap.get(p.tenant_id);
                    return `ห้อง ${room?.room_number || 'N/A'} - ${tenant?.full_name || 'N/A'}`;
                  }).join(', ')}>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-purple-600">
                        {pendingSlipsRecheck.length.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">สลิปรอตรวจซ้ำ</p>
                      <p className="text-xs text-slate-400 mt-0.5">(Cron ทุก 15-30 นาที)</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border-2 border-cyan-200">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-cyan-600">
                        {filteredTenants.length.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">ผู้เช่าทั้งหมด</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border-2 border-cyan-200">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-cyan-600">
                        {filteredTenants.length.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">ผู้เช่าทั้งหมด</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border-2 border-teal-200">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-teal-600">
                        {filteredRooms.length.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">ห้องพักทั้งหมด</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border-2 border-green-200">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">
                        {filteredPayments.filter(p => p.invoice_image_url).length.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">มีใบแจ้งหนี้แล้ว</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border-2 border-pink-200">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-pink-600">
                        {filteredPayments.filter(p => p.invoice_image_url && (p.bill_sent_date || p.advance_reminder_sent_date || p.due_date_reminder_sent_date) && p.status !== 'paid').length.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">บิลที่ส่งแล้ว</p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-xl border-2 border-amber-200">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-amber-600">
                        {filteredPayments.filter(p => 
                          p.status !== 'paid' && 
                          p.invoice_image_url && 
                          !p.bill_sent_date && 
                          (selectedStatsBranch === 'all' ? enabledBranchIds.includes(p.branch_id) : true)
                        ).length.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">บิลที่รอระบบส่ง</p>
                      <p className="text-xs text-slate-400 mt-0.5">(เปิดการแจ้งเตือน)</p>
                    </div>
                  </div>

                  {/* ⭐ รอส่งแจ้งครบกำหนด */}
                  <div className="bg-white p-4 rounded-xl border-2 border-red-200 cursor-pointer hover:shadow-md transition-shadow" title={dueTodayPayments.map(p => {
                    const room = roomMap.get(p.room_id);
                    return `ห้อง ${room?.room_number || 'N/A'}`;
                  }).join(', ')}>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-600">
                        {dueTodayPayments.length.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">รอส่งแจ้งครบกำหนด</p>
                      <p className="text-xs text-slate-400 mt-0.5">(วันนี้)</p>
                    </div>
                  </div>

                  {/* ⭐ รอส่งแจ้งเกินกำหนด */}
                  <div className="bg-white p-4 rounded-xl border-2 border-orange-200 cursor-pointer hover:shadow-md transition-shadow" title={overduePayments.map(p => {
                    const room = roomMap.get(p.room_id);
                    return `ห้อง ${room?.room_number || 'N/A'}`;
                  }).join(', ')}>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-orange-600">
                        {overduePayments.length.toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-600 mt-1">รอส่งแจ้งเกินกำหนด</p>
                      <p className="text-xs text-slate-400 mt-0.5">(ค้างชำระ)</p>
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">หมายเหตุ</p>
                <p className="text-sm text-amber-700">
                  Cron Jobs ต้องตั้งค่าผ่าน Dashboard → Code → Functions → เลือก Function → ตั้งค่า Schedule
                  <br />
                  หน้านี้ใช้สำหรับทดสอบและดูสถานะการทำงานเท่านั้น
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Branch Reminder Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">สถานะการแจ้งเตือนแต่ละสาขา</CardTitle>
            <CardDescription>ดูว่าสาขาไหนเปิด/ปิดการแจ้งเตือนอัตโนมัติ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* แจ้งเตือนล่วงหน้า */}
            <div className="border rounded-xl p-4 bg-amber-50">
              <div className="flex items-center gap-2 mb-3">
                <Bell className="w-5 h-5 text-amber-600" />
                <h3 className="font-semibold text-slate-800">แจ้งเตือนล่วงหน้า (sendAdvanceReminders)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {allBranches.map(branch => {
                  const config = configs.find(c => c.key === 'send_advance_reminder' && c.branch_id === branch.id);
                  const isEnabled = config?.value === 'true';
                  return (
                    <div key={branch.id} className={`p-2 rounded-lg border text-xs ${
                      isEnabled 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800 truncate">{branch.branch_name}</span>
                        <Badge variant={isEnabled ? 'default' : 'outline'} className="text-xs">
                          {isEnabled ? '✅ เปิด' : '❌ ปิด'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* แจ้งเตือนวันครบกำหนด */}
            <div className="border rounded-xl p-4 bg-red-50">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-5 h-5 text-red-600" />
                <h3 className="font-semibold text-slate-800">แจ้งเตือนวันครบกำหนด (sendDueDateReminders)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {allBranches.map(branch => {
                  const config = configs.find(c => c.key === 'send_due_date_reminder' && c.branch_id === branch.id);
                  const isEnabled = config?.value === 'true';
                  return (
                    <div key={branch.id} className={`p-2 rounded-lg border text-xs ${
                      isEnabled 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800 truncate">{branch.branch_name}</span>
                        <Badge variant={isEnabled ? 'default' : 'outline'} className="text-xs">
                          {isEnabled ? '✅ เปิด' : '❌ ปิด'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* แจ้งเตือนค้างชำระ */}
            <div className="border rounded-xl p-4 bg-orange-50">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <h3 className="font-semibold text-slate-800">แจ้งเตือนค้างชำระ (sendAutomatedOverdueReminders)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {allBranches.map(branch => {
                  const config = configs.find(c => c.key === 'send_overdue_reminder' && c.branch_id === branch.id);
                  const isEnabled = config?.value === 'true';
                  return (
                    <div key={branch.id} className={`p-2 rounded-lg border text-xs ${
                      isEnabled 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-slate-50 border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-800 truncate">{branch.branch_name}</span>
                        <Badge variant={isEnabled ? 'default' : 'outline'} className="text-xs">
                          {isEnabled ? '✅ เปิด' : '❌ ปิด'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Developer Test: อัพโหลดสลิปเพื่อทดสอบ */}
        <TestSlipUploader />

        {/* ลบ Payment สาขา Wresdent */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              🗑️ ลบ Payment - Wresdent 123
            </CardTitle>
            <CardDescription className="text-red-700">
              ลบการชำระเงินทั้งหมดของสาขาทดสอบ (Branch ID: 692eae1308315df66d99c351)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">⚠️ คำเตือน</p>
                  <p>การดำเนินการนี้จะลบ Payment ประมาณ <strong>102 รายการ</strong></p>
                </div>
              </div>
            </div>

            <Button
              onClick={async () => {
                if (!confirm('⚠️ ยืนยันการลบ Payment ทั้งหมดของสาขา Wresdent 123?')) return;

                setDeletingPayments(true);
                setDeleteResult(null);

                try {
                  const response = await base44.functions.invoke('deletePaymentsByBranchDirect', {
                    branch_id: '692eae1308315df66d99c351'
                  });

                  const data = response.data;
                  setDeleteResult(data);
                  
                  if (data.success) {
                    toast.success(`ลบสำเร็จ ${data.deleted} รายการ`);
                  } else {
                    toast.error(data.error || 'เกิดข้อผิดพลาด');
                  }
                } catch (error) {
                  setDeleteResult({ success: false, error: error.message });
                  toast.error('เกิดข้อผิดพลาด: ' + error.message);
                } finally {
                  setDeletingPayments(false);
                }
              }}
              disabled={deletingPayments}
              className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700"
            >
              {deletingPayments ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  กำลังลบ...
                </>
              ) : (
                <>
                  <Trash2 className="w-5 h-5 mr-2" />
                  ลบ Payment ทั้งหมด
                </>
              )}
            </Button>

            {deleteResult && (
              <div className={`p-4 rounded-xl border-2 ${
                deleteResult.success 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-start gap-3">
                  {deleteResult.success ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600 mt-0.5" />
                  )}
                  <div>
                    <p className={`font-semibold mb-2 ${
                      deleteResult.success ? 'text-green-800' : 'text-red-800'
                    }`}>
                      {deleteResult.success ? '✅ สำเร็จ!' : '❌ เกิดข้อผิดพลาด'}
                    </p>
                    {deleteResult.success && (
                      <div className="text-sm text-green-700 space-y-1">
                        <p>ลบสำเร็จ: <strong>{deleteResult.deleted}</strong> รายการ</p>
                        <p>จากทั้งหมด: <strong>{deleteResult.total}</strong> รายการ</p>
                        <p className="text-xs mt-2 text-green-600">{deleteResult.message}</p>
                      </div>
                    )}
                    {!deleteResult.success && (
                      <p className="text-sm text-red-700">{deleteResult.error}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* เลือกสาขาสำหรับลบ Cron Job */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800 flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              🗑️ เลือกสาขาที่จะลบข้อมูลทดสอบ
            </CardTitle>
            <CardDescription className="text-red-700">
              Cron Job จะลบข้อมูลทดสอบของสาขาที่เลือกเท่านั้น
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allBranches.map((branch) => {
                const isSelected = selectedBranchesForDelete.includes(branch.id);
                const isTestBranch = branch.branch_code?.includes('TEST') || 
                                    branch.branch_code?.includes('12345') ||
                                    branch.branch_code?.includes('5555') ||
                                    branch.branch_code?.includes('COPY') ||
                                    branch.branch_name?.includes('12345');
                
                return (
                  <div
                    key={branch.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedBranchesForDelete(prev => prev.filter(id => id !== branch.id));
                      } else {
                        setSelectedBranchesForDelete(prev => [...prev, branch.id]);
                      }
                    }}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isSelected 
                        ? 'border-red-500 bg-red-100 shadow-lg' 
                        : 'border-slate-200 bg-white hover:border-red-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <p className="font-bold text-slate-800 text-sm">{branch.branch_name}</p>
                        <p className="text-xs text-slate-500">{branch.branch_code}</p>
                      </div>
                      {isTestBranch && (
                        <Badge className="bg-orange-500 text-xs">ทดสอบ</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${
                        isSelected ? 'bg-red-500 border-red-500' : 'border-slate-300'
                      }`}>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-white" />}
                      </div>
                      <span className="text-xs text-slate-600">
                        {isSelected ? 'เลือกแล้ว' : 'คลิกเพื่อเลือก'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator />

            <div className="flex items-center justify-between bg-white p-4 rounded-lg">
              <div>
                <p className="font-semibold text-slate-800">สาขาที่เลือก: {selectedBranchesForDelete.length} สาขา</p>
                <p className="text-xs text-slate-500 mt-1">
                  {selectedBranchesForDelete.length === 0 
                    ? 'กรุณาเลือกสาขาที่ต้องการลบข้อมูลทดสอบ' 
                    : allBranches.filter(b => selectedBranchesForDelete.includes(b.id)).map(b => b.branch_name).join(', ')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const testBranches = allBranches.filter(b => 
                      b.branch_code?.includes('TEST') || 
                      b.branch_code?.includes('12345') ||
                      b.branch_code?.includes('5555') ||
                      b.branch_code?.includes('COPY') ||
                      b.branch_name?.includes('12345')
                    );
                    setSelectedBranchesForDelete(testBranches.map(b => b.id));
                    toast.success(`เลือกสาขาทดสอบทั้งหมด ${testBranches.length} สาขา`);
                  }}
                  className="text-orange-600"
                >
                  เลือกสาขาทดสอบทั้งหมด
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setSelectedBranchesForDelete([])}
                  className="text-slate-600"
                >
                  ล้างทั้งหมด
                </Button>
              </div>
            </div>

            {/* Entity Type Selection */}
            <div className="bg-gradient-to-r from-orange-100 to-red-100 rounded-lg p-4 border-2 border-orange-300 mt-4">
              <h4 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                <Database className="w-5 h-5" />
                📋 เลือกประเภทข้อมูลที่ Cron Job จะลบ
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                {[
                  { key: 'Payment', label: '💰 การชำระเงิน', icon: Wallet },
                  { key: 'MeterReading', label: '📏 บันทึกมิเตอร์', icon: Gauge },
                  { key: 'Booking', label: '📅 การจอง', icon: Calendar },
                  { key: 'Tenant', label: '👥 ผู้เช่า', icon: Users },
                  { key: 'Room', label: '🏠 ห้องพัก', icon: DoorOpen },
                  { key: 'MaintenanceRequest', label: '🔧 แจ้งซ่อม', icon: Wrench },
                  { key: 'Expense', label: '💸 ค่าใช้จ่าย', icon: Wallet },
                  { key: 'Contract', label: '📄 สัญญา', icon: ScrollText },
                  { key: 'MaterialDelivery', label: '📦 พัสดุ', icon: Package }
                ].map(({ key, label, icon: EntityIcon }) => (
                  <label 
                    key={key}
                    className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      cronDeleteEntities[key]
                        ? 'bg-red-100 border-red-400 text-red-900' 
                        : 'bg-white border-slate-200 hover:border-orange-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={cronDeleteEntities[key]}
                      onChange={(e) => setCronDeleteEntities({
                        ...cronDeleteEntities,
                        [key]: e.target.checked
                      })}
                      className="w-4 h-4"
                    />
                    <EntityIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">{label}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCronDeleteEntities({
                    Payment: true, MeterReading: true, Booking: false, Tenant: false,
                    Room: false, MaintenanceRequest: true, Expense: true, Contract: false, MaterialDelivery: true
                  })}
                >
                  เลือกค่าเริ่มต้น
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCronDeleteEntities({
                    Payment: true, MeterReading: true, Booking: true, Tenant: true,
                    Room: true, MaintenanceRequest: true, Expense: true, Contract: true, MaterialDelivery: true
                  })}
                >
                  เลือกทั้งหมด
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (selectedBranchesForDelete.length === 0) {
                    toast.error('กรุณาเลือกสาขาที่ต้องการลบข้อมูล');
                    return;
                  }

                  try {
                    const data = {
                      selected_branches: selectedBranchesForDelete,
                      delete_entities: cronDeleteEntities,
                      last_updated: new Date().toISOString(),
                      updated_by: currentUser?.email || 'unknown'
                    };

                    const existing = cronDeleteConfigs[0];
                    if (existing) {
                      await base44.entities.CronDeleteConfig.update(existing.id, data);
                    } else {
                      await base44.entities.CronDeleteConfig.create(data);
                    }

                    await refetchCronConfig();
                    toast.success(`💾 บันทึกการตั้งค่าสำเร็จ - ${selectedBranchesForDelete.length} สาขา`);
                  } catch (error) {
                    toast.error('บันทึกไม่สำเร็จ: ' + error.message);
                  }
                }}
                className="bg-blue-600 hover:bg-blue-700 flex-1"
                disabled={selectedBranchesForDelete.length === 0}
              >
                <Save className="w-4 h-4 mr-2" />
                💾 บันทึกการตั้งค่า Cron Job
              </Button>
              <Button
                onClick={async () => {
                  await refetchCronConfig();
                  toast.success('🔄 โหลดการตั้งค่าล่าสุดแล้ว');
                }}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                🔄 โหลดรายการที่บันทึก
              </Button>
            </div>
            
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-300">
              <h4 className="font-semibold text-yellow-900 mb-2">💡 วิธีใช้งาน:</h4>
              <ol className="text-sm text-yellow-800 space-y-1 list-decimal ml-5">
                <li>เลือกสาขาที่ต้องการลบข้อมูลทดสอบ</li>
                <li>เลือกประเภทข้อมูลที่ต้องการให้ Cron Job ลบ</li>
                <li>กดปุ่ม "บันทึกการตั้งค่า Cron Job"</li>
                <li>Cron Job จะลบข้อมูลทดสอบอัตโนมัติตามที่ตั้งค่า</li>
              </ol>
            </div>
            
            <p className="text-xs text-red-600">
              ⚠️ Cron Job จะลบข้อมูลทดสอบ (is_sample, TEST, 12345, 5555, COPY) ของสาขาและประเภทข้อมูลที่เลือกเท่านั้น
            </p>
          </CardContent>
        </Card>

        {/* Active Alerts Summary */}
        {cronJobAlerts.filter(a => a.enabled).length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-4">
              <div className="flex items-start gap-3">
                <Zap className="w-5 h-5 text-orange-600 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-orange-800 mb-2">
                    การแจ้งเตือนที่เปิดอยู่: {cronJobAlerts.filter(a => a.enabled).length} รายการ
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {cronJobAlerts.filter(a => a.enabled).slice(0, 4).map((alert) => (
                      <div key={alert.id} className="text-xs bg-white p-2 rounded border">
                        <p className="font-semibold text-slate-800">{alert.alert_name}</p>
                        <p className="text-slate-600">{alert.function_name}</p>
                      </div>
                    ))}
                  </div>
                  {cronJobAlerts.filter(a => a.enabled).length > 4 && (
                    <p className="text-xs text-orange-700 mt-2">
                      และอีก {cronJobAlerts.filter(a => a.enabled).length - 4} รายการ
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cron Jobs Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CRON_JOBS.map((job) => {
            const Icon = job.icon;
            const isRunning = runningJobs[job.id];
            const result = jobResults[job.id];
            const jobLogs = functionLogs.filter(log => log.function_name === job.functionName);

            return (
              <Card key={job.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${job.color} shadow-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    {cronJobAlerts.some(a => a.function_name === job.functionName && a.enabled) && (
                      <Badge className="bg-orange-500 text-xs">
                        <Zap className="w-3 h-3 mr-1" />
                        มีการแจ้งเตือน
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base mt-3">{job.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {job.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <Clock className="w-3.5 h-3.5" />
                    <span>แนะนำ: {job.recommendedInterval}</span>
                  </div>

                  {job.apis && job.apis.length > 0 && (
                    <div className="text-xs">
                      <span className="text-slate-500">API ที่ใช้: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {job.apis.map((api, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs px-1.5 py-0">
                            {api}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Real-time Status Indicator */}
                  <JobStatusIndicator logs={jobLogs} functionName={job.functionName} />

                  {result && (
                    <div className={`p-2 rounded-lg text-xs ${
                      result.success 
                        ? 'bg-green-50 text-green-700 border border-green-200' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {result.success ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>ทำงานสำเร็จ</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{result.error}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={() => runCronJob(job)}
                    disabled={isRunning}
                    className={`w-full bg-gradient-to-r ${job.color} hover:opacity-90`}
                    size="sm"
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        กำลังทำงาน...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        รันตอนนี้
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Cron Job History by Function */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">ประวัติการทำงานทั้งหมด</CardTitle>
                <CardDescription>แยกตาม Cron Job (แสดง 100 รายการล่าสุด)</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchLogs()}>
                <RefreshCw className="w-4 h-4 mr-2" />
                รีเฟรช
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {functionLogs.length === 0 ? (
              <p className="text-center text-slate-500 py-8">ยังไม่มีประวัติการทำงาน</p>
            ) : (
              <div className="space-y-6">
                {CRON_JOBS.map((job) => {
                  const jobLogs = functionLogs.filter(log => log.function_name === job.functionName);
                  const hasErrors = jobLogs.some(log => log.status === 'error');
                  const Icon = job.icon;

                  return (
                    <div key={job.id} className="border rounded-xl p-4 bg-white">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${job.color}`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-800">{job.name}</h3>
                          <p className="text-xs text-slate-500">{jobLogs.length} รายการ</p>
                        </div>
                        {hasErrors && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            มี Error
                          </Badge>
                        )}
                      </div>

                      <Separator className="mb-3" />

                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {jobLogs.length === 0 ? (
                          <div className="text-center py-8 text-slate-400">
                            <p className="text-sm">ยังไม่มีประวัติการทำงาน</p>
                          </div>
                        ) : jobLogs.map((log, index) => (
                          <div 
                            key={log.id || index}
                            className={`p-2.5 rounded-lg border transition-colors ${
                              log.status === 'success' 
                                ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                                : 'bg-red-50 border-red-200 hover:bg-red-100'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1">
                                {log.status === 'success' ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                                ) : (
                                  <XCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-800">
                                    {log.message || (log.status === 'success' ? 'ทำงานสำเร็จ' : 'เกิดข้อผิดพลาด')}
                                  </p>
                                  {log.details && (
                                    <details className="mt-1">
                                      <summary className="text-xs text-slate-500 cursor-pointer hover:underline">
                                        ดูรายละเอียด
                                      </summary>
                                      <pre className="text-xs bg-white p-2 rounded mt-1 overflow-auto max-h-32 border">
                                        {typeof log.details === 'string' 
                                          ? log.details 
                                          : JSON.stringify(log.details, null, 2)}
                                      </pre>
                                    </details>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xs text-slate-500 whitespace-nowrap">
                                  {formatDate(log.run_timestamp)}
                                </p>
                              </div>
                            </div>
                            </div>
                            ))}
                            </div>
                            </div>
                            );
                            })}
                            </div>
                            )}
                            </CardContent>
                            </Card>
                            </div>

                            <DeleteProgressDialog 
                            open={showProgressDialog} 
                            onClose={() => setShowProgressDialog(false)}
                            branchId={cronBranchId}
                            />

                            <AlertSettingsDialog
                            open={showAlertSettings}
                            onClose={() => setShowAlertSettings(false)}
                            existingAlerts={cronJobAlerts}
                            />
                            </div>
                            );
                            }