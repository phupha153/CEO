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
  TrendingUp,
  Activity,
  Zap
} from "lucide-react";
import { createPageUrl } from "@/utils";
import TestSlipUploader from "@/components/testing/TestSlipUploader";
import DeleteProgressDialog from "@/components/testing/DeleteProgressDialog";

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
    queryFn: () => base44.entities.FunctionLog.list('-run_timestamp', 200),
    refetchInterval: 10000, // รีเฟรชทุก 10 วินาที
  });

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

  const getJobStats = (functionName) => {
    const logs = functionLogs.filter(l => l.function_name === functionName).slice(0, 10);
    if (logs.length === 0) return null;

    const successCount = logs.filter(l => l.status === 'success').length;
    const errorCount = logs.filter(l => l.status === 'error').length;
    const successRate = Math.round((successCount / logs.length) * 100);

    // คำนวณเวลาเฉลี่ยจาก execution_time_ms
    const executionTimes = logs
      .map(l => l.execution_time_ms)
      .filter(t => t !== undefined && t !== null && !isNaN(t));
    
    const avgExecutionTime = executionTimes.length > 0 
      ? Math.round(executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length)
      : null;

    return {
      successCount,
      errorCount,
      successRate,
      avgExecutionTime,
      totalRuns: logs.length
    };
  };

  const getBranchBreakdown = (functionName) => {
    const recentLogs = functionLogs
      .filter(l => l.function_name === functionName)
      .slice(0, 5);

    const branchStats = {};

    recentLogs.forEach(log => {
      if (log.branch_results && Array.isArray(log.branch_results)) {
        log.branch_results.forEach(br => {
          if (!branchStats[br.branch_id]) {
            branchStats[br.branch_id] = {
              branch_id: br.branch_id,
              branch_name: br.branch_name || 'Unknown',
              success: 0,
              error: 0,
              partial: 0,
              lastStatus: br.status,
              lastError: br.error_message
            };
          }
          
          if (br.status === 'success') branchStats[br.branch_id].success++;
          else if (br.status === 'error') branchStats[br.branch_id].error++;
          else if (br.status === 'partial') branchStats[br.branch_id].partial++;
          
          // Keep latest status
          branchStats[br.branch_id].lastStatus = br.status;
          if (br.error_message) branchStats[br.branch_id].lastError = br.error_message;
        });
      }
    });

    return Object.values(branchStats);
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

            <div className="flex gap-2">
              <Button
                onClick={async () => {
                  if (selectedBranchesForDelete.length === 0) {
                    toast.error('กรุณาเลือกสาขาที่ต้องการลบข้อมูล');
                    return;
                  }

                  try {
                    const config = {
                      key: 'cron_delete_selected_branches',
                      value: JSON.stringify(selectedBranchesForDelete),
                      description: 'รายการ Branch IDs สำหรับ Cron Job ลบข้อมูลทดสอบ',
                      category: 'general'
                    };

                    const configs = await base44.entities.Config.filter({ key: 'cron_delete_selected_branches' });
                    if (configs.length > 0) {
                      await base44.entities.Config.update(configs[0].id, config);
                    } else {
                      await base44.entities.Config.create(config);
                    }
                    toast.success(`บันทึกรายการ ${selectedBranchesForDelete.length} สาขาสำเร็จ`);
                  } catch (error) {
                    toast.error('บันทึกไม่สำเร็จ: ' + error.message);
                  }
                }}
                className="bg-red-600 hover:bg-red-700 flex-1"
                disabled={selectedBranchesForDelete.length === 0}
              >
                💾 บันทึกรายการสาขา
              </Button>
              <Button
                onClick={async () => {
                  try {
                    const configs = await base44.entities.Config.filter({ key: 'cron_delete_selected_branches' });
                    if (configs.length > 0) {
                      const branchIds = JSON.parse(configs[0].value);
                      setSelectedBranchesForDelete(branchIds);
                      toast.success(`โหลดรายการ ${branchIds.length} สาขาแล้ว`);
                    } else {
                      toast.info('ยังไม่มีรายการที่บันทึกไว้');
                    }
                  } catch (error) {
                    toast.error('โหลดไม่สำเร็จ: ' + error.message);
                  }
                }}
                variant="outline"
                className="flex-1"
              >
                🔄 โหลดรายการที่บันทึก
              </Button>
            </div>
            
            <p className="text-xs text-red-600">
              ⚠️ Cron Job จะลบข้อมูลทดสอบ (is_sample, TEST, 12345, 5555, COPY) ของสาขาที่เลือกเท่านั้น
            </p>
          </CardContent>
        </Card>

        {/* Cron Jobs Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {CRON_JOBS.map((job) => {
            const Icon = job.icon;
            const isRunning = runningJobs[job.id];
            const result = jobResults[job.id];
            const lastLog = getLastRun(job.functionName);
            const stats = getJobStats(job.functionName);
            const branchBreakdown = getBranchBreakdown(job.functionName);

            return (
              <Card key={job.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${job.color} shadow-lg relative`}>
                      <Icon className="w-5 h-5 text-white" />
                      {isRunning && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse border-2 border-white" />
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {lastLog && (
                        <Badge 
                          variant={lastLog.status === 'success' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {lastLog.status === 'success' ? '✅ สำเร็จ' : '❌ ล้มเหลว'}
                        </Badge>
                      )}
                      {stats && (
                        <Badge 
                          variant="outline"
                          className={`text-xs ${
                            stats.successRate >= 90 ? 'border-green-500 text-green-700' :
                            stats.successRate >= 70 ? 'border-yellow-500 text-yellow-700' :
                            'border-red-500 text-red-700'
                          }`}
                        >
                          {stats.successRate}% สำเร็จ
                        </Badge>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-base mt-3">{job.name}</CardTitle>
                  <CardDescription className="text-xs">
                    {job.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Performance Stats */}
                  {stats && (
                    <div className="grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded-lg">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1 mb-1">
                          <Activity className="w-3 h-3 text-slate-500" />
                          <span className="text-xs text-slate-500">รัน 10 ครั้งล่าสุด</span>
                        </div>
                        <p className="text-sm font-bold text-slate-800">
                          {stats.successCount}/{stats.totalRuns}
                        </p>
                      </div>
                      {stats.avgExecutionTime && (
                        <div className="text-center">
                          <div className="flex items-center justify-center gap-1 mb-1">
                            <Zap className="w-3 h-3 text-slate-500" />
                            <span className="text-xs text-slate-500">เวลาเฉลี่ย</span>
                          </div>
                          <p className="text-sm font-bold text-slate-800">
                            {stats.avgExecutionTime < 1000 
                              ? `${stats.avgExecutionTime}ms` 
                              : `${(stats.avgExecutionTime / 1000).toFixed(1)}s`}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Branch Breakdown - แสดงเฉพาะที่มีข้อมูล */}
                  {branchBreakdown.length > 0 && (
                    <div className="border rounded-lg p-2 bg-blue-50">
                      <div className="flex items-center gap-1 mb-2">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-medium text-blue-800">ผลลัพธ์ตามสาขา</span>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {branchBreakdown.map((branch, idx) => (
                          <div key={idx} className={`text-xs p-1.5 rounded flex items-center justify-between ${
                            branch.lastStatus === 'error' ? 'bg-red-100 text-red-800' :
                            branch.lastStatus === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            <span className="font-medium truncate flex-1">{branch.branch_name}</span>
                            <div className="flex items-center gap-1">
                              {branch.success > 0 && <span className="text-green-700">✓{branch.success}</span>}
                              {branch.error > 0 && <span className="text-red-700">✗{branch.error}</span>}
                              {branch.partial > 0 && <span className="text-yellow-700">⚠{branch.partial}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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

                  {lastLog && (
                    <div className="text-xs text-slate-500">
                      <span>รันล่าสุด: {formatDate(lastLog.run_timestamp)}</span>
                      {lastLog.execution_time_ms && (
                        <span className="ml-2 text-slate-400">
                          ({lastLog.execution_time_ms < 1000 
                            ? `${lastLog.execution_time_ms}ms` 
                            : `${(lastLog.execution_time_ms / 1000).toFixed(1)}s`})
                        </span>
                      )}
                    </div>
                  )}

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

                  if (jobLogs.length === 0) return null;

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
                        {jobLogs.map((log, index) => {
                          const hasBranchResults = log.branch_results && Array.isArray(log.branch_results) && log.branch_results.length > 0;
                          const branchErrors = hasBranchResults 
                            ? log.branch_results.filter(br => br.status === 'error')
                            : [];

                          return (
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
                                    
                                    {/* แสดงเวลาที่ใช้ */}
                                    {log.execution_time_ms && (
                                      <p className="text-xs text-slate-500 mt-0.5">
                                        ⚡ ใช้เวลา: {log.execution_time_ms < 1000 
                                          ? `${log.execution_time_ms}ms` 
                                          : `${(log.execution_time_ms / 1000).toFixed(1)}s`}
                                      </p>
                                    )}

                                    {/* แสดงสาขาที่ล้มเหลว */}
                                    {branchErrors.length > 0 && (
                                      <div className="mt-2 p-2 bg-red-100 rounded border border-red-200">
                                        <p className="text-xs font-semibold text-red-800 mb-1">
                                          🚨 สาขาที่ล้มเหลว ({branchErrors.length}):
                                        </p>
                                        {branchErrors.slice(0, 3).map((br, idx) => (
                                          <p key={idx} className="text-xs text-red-700">
                                            • {br.branch_name}: {br.error_message || 'Unknown error'}
                                          </p>
                                        ))}
                                        {branchErrors.length > 3 && (
                                          <p className="text-xs text-red-600 mt-1">
                                            และอีก {branchErrors.length - 3} สาขา
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {/* แสดง branch results ทั้งหมด */}
                                    {hasBranchResults && (
                                      <details className="mt-2">
                                        <summary className="text-xs text-blue-600 cursor-pointer hover:underline">
                                          📊 ดูผลลัพธ์ทุกสาขา ({log.branch_results.length})
                                        </summary>
                                        <div className="mt-1 space-y-1">
                                          {log.branch_results.map((br, idx) => (
                                            <div key={idx} className={`text-xs p-1.5 rounded ${
                                              br.status === 'error' ? 'bg-red-50' :
                                              br.status === 'partial' ? 'bg-yellow-50' :
                                              'bg-green-50'
                                            }`}>
                                              <div className="flex items-center justify-between">
                                                <span className="font-medium">{br.branch_name}</span>
                                                <span className={
                                                  br.status === 'error' ? 'text-red-700' :
                                                  br.status === 'partial' ? 'text-yellow-700' :
                                                  'text-green-700'
                                                }>
                                                  {br.sent || 0} ส่ง / {br.failed || 0} ล้มเหลว
                                                </span>
                                              </div>
                                              {br.error_message && (
                                                <p className="text-red-600 mt-1">{br.error_message}</p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    )}

                                    {log.details && (
                                      <details className="mt-1">
                                        <summary className="text-xs text-slate-500 cursor-pointer hover:underline">
                                          ดูรายละเอียดเพิ่มเติม
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
                          );
                        })}
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
        </div>
        );
        }