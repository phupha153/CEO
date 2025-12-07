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
  TestTube
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

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: functionLogs = [], refetch: refetchLogs } = useQuery({
    queryKey: ['functionLogs'],
    queryFn: () => base44.entities.FunctionLog.list('-run_timestamp', 50),
    refetchInterval: 30000,
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

        {/* Developer Test: อัพโหลดสลิปเพื่อทดสอบ */}
        <TestSlipUploader />

        {/* Branch ID for Cron Delete */}
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <Label className="text-red-800 font-bold mb-2 block">🎯 Branch ID สำหรับ Cron Delete</Label>
            <Input
              value={cronBranchId}
              onChange={(e) => setCronBranchId(e.target.value)}
              placeholder="ใส่ Branch ID"
              className="bg-white"
            />
            <div className="flex gap-2 mt-3 flex-wrap">
              <Button
                onClick={async () => {
                  try {
                    const configs = await base44.entities.Config.filter({ key: 'cron_delete_branch_id' });
                    if (configs.length > 0) {
                      await base44.entities.Config.update(configs[0].id, { value: cronBranchId });
                    } else {
                      await base44.entities.Config.create({
                        key: 'cron_delete_branch_id',
                        value: cronBranchId,
                        description: 'Branch ID สำหรับ Cron Job ลบ Payment',
                        category: 'general'
                      });
                    }
                    toast.success('บันทึก Branch ID สำเร็จ');
                  } catch (error) {
                    toast.error('บันทึกไม่สำเร็จ: ' + error.message);
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
              >
                💾 บันทึก Branch ID
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const configs = await base44.entities.Config.filter({ key: 'cron_delete_branch_id' });
                    if (configs.length > 0) {
                      setCronBranchId(configs[0].value);
                      toast.success('โหลดค่าที่บันทึกไว้แล้ว');
                    } else {
                      toast.info('ยังไม่มีค่าที่บันทึกไว้');
                    }
                  } catch (error) {
                    toast.error('โหลดไม่สำเร็จ: ' + error.message);
                  }
                }}
              >
                🔄 โหลดค่าที่บันทึก
              </Button>
              <Button
                onClick={async () => {
                  if (!confirm(`🗑️ ต้องการลบ Payment ทั้งหมดของสาขา ${cronBranchId}?\n\n⚠️ การกระทำนี้ไม่สามารถย้อนกลับได้!`)) return;
                  
                  const loadingToast = toast.loading('🚀 เริ่มลบ Payment ในพื้นหลัง...');
                  try {
                    const response = await base44.functions.invoke('deletePaymentsByBranch', { branch_id: cronBranchId });
                    toast.success(`✅ ${response.data.message}\n💡 ทั้งหมด ${response.data.totalPayments} รายการ`, { id: loadingToast, duration: 3000 });
                    setShowProgressDialog(true);
                  } catch (error) {
                    toast.error(`❌ เกิดข้อผิดพลาด: ${error.message}`, { id: loadingToast });
                  }
                }}
                className="bg-red-700 hover:bg-red-800"
              >
                🗑️ ลบทั้งหมดทันที
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowProgressDialog(true)}
                className="border-red-300 text-red-700 hover:bg-red-50"
              >
                📊 ดูความคืบหน้า
              </Button>
            </div>
            <p className="text-xs text-red-600 mt-2">
              กด "บันทึก Branch ID" แล้ว Cron Job จะใช้ค่านี้อัตโนมัติ
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

            return (
              <Card key={job.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`p-2.5 rounded-xl bg-gradient-to-br ${job.color} shadow-lg`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    {lastLog && (
                      <Badge 
                        variant={lastLog.status === 'success' ? 'default' : 'destructive'}
                        className="text-xs"
                      >
                        {lastLog.status === 'success' ? 'สำเร็จ' : 'ล้มเหลว'}
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

                  {lastLog && (
                    <div className="text-xs text-slate-500">
                      <span>รันล่าสุด: {formatDate(lastLog.run_timestamp)}</span>
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

        {/* Recent Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">ประวัติการทำงาน</CardTitle>
                <CardDescription>แสดง 20 รายการล่าสุด</CardDescription>
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
              <div className="space-y-2">
                {functionLogs.slice(0, 20).map((log, index) => (
                  <div 
                    key={log.id || index}
                    className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {log.status === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium text-sm text-slate-800">
                          {log.function_name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {log.message || '-'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        {formatDate(log.run_timestamp)}
                      </p>
                      <Badge 
                        variant={log.status === 'success' ? 'default' : 'destructive'}
                        className="text-xs mt-1"
                      >
                        {log.status === 'success' ? 'สำเร็จ' : 'ล้มเหลว'}
                      </Badge>
                    </div>
                  </div>
                ))}
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