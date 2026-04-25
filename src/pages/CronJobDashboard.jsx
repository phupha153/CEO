import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import PageHeader from '../components/shared/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Clock, Loader2, RefreshCw, Terminal, Send, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { th } from 'date-fns/locale';
import { createPageUrl } from '@/utils';

const FunctionLogCard = ({ functionName, title, icon: Icon, description }) => {
  const [lastRun, setLastRun] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const { data: log, isLoading, refetch } = useQuery({
    queryKey: ['functionLog', functionName],
    queryFn: async () => {
      // At the moment, we cannot query function logs directly.
      // This is a placeholder for future implementation.
      // For now, we will rely on manual trigger and state.
      return null;
    },
    refetchInterval: 60000, // Refetch every minute
  });

  const handleRunFunction = async () => {
    setIsRunning(true);
    setLastRun(null);
    try {
      const response = await base44.functions.invoke(functionName, { force: true });
      setLastRun({
        timestamp: new Date(),
        success: response.data.success,
        data: response.data,
      });
      toast.success(`${title} ทำงานสำเร็จ`);
    } catch (error) {
      setLastRun({
        timestamp: new Date(),
        success: false,
        data: error.response?.data || { error: error.message },
      });
      toast.error(`เกิดข้อผิดพลาดในการรัน ${title}`);
    } finally {
      setIsRunning(false);
    }
  };

  const renderLogDetails = (data) => {
    if (!data) return <p className="text-slate-500">ไม่มีข้อมูล</p>;

    return (
      <pre className="text-xs bg-slate-900 text-white p-4 rounded-lg overflow-x-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  const renderSummary = (data) => {
    if (!data) return null;

    if (functionName === 'generateMonthlyBills') {
      return (
        <div className="space-y-2 text-sm">
          <p><strong>ข้อความ:</strong> {data.message}</p>
          <p><strong>สร้างสำเร็จ:</strong> <span className="font-bold text-green-600">{data.generatedCount || 0}</span> รายการ</p>
          <p><strong>ข้าม (มีบิลแล้ว):</strong> <span className="font-bold text-amber-600">{data.skippedDueToExistingBill || 0}</span> ห้อง</p>
           {data.summary?.branchesSkipped?.length > 0 && (
            <div>
                <p className="font-semibold">สาขาที่ข้าม (ไม่ตรงวัน):</p>
                <ul className="list-disc list-inside">
                    {data.summary.branchesSkipped.map(b => (
                        <li key={b.id}>สาขา {b.id} (วันสร้างบิล: {b.genDay})</li>
                    ))}
                </ul>
            </div>
           )}
        </div>
      );
    }

    if (functionName === 'sendBatchLineMessages') {
         return (
             <div className="space-y-2 text-sm">
                 <p><strong>ข้อความ:</strong> {data.message}</p>
                 <p><strong>ส่งสำเร็จ:</strong> <span className="font-bold text-green-600">{data.success || 0}</span> ข้อความ</p>
                 <p><strong>ล้มเหลว:</strong> <span className="font-bold text-red-600">{data.failed || 0}</span> ข้อความ</p>
             </div>
         )
     }


    return null;
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Icon className="w-6 h-6 text-white" />
          </div>
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-slate-500">{description}</p>
          </div>
        </div>
        <Button onClick={handleRunFunction} disabled={isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              กำลังรัน...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              รันตอนนี้
            </>
          )}
        </Button>
      </CardHeader>
      <CardContent>
        <h4 className="font-semibold mb-2">ผลการรันล่าสุด:</h4>
        {lastRun ? (
          <div className={`p-4 rounded-lg border-2 ${lastRun.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex justify-between items-center mb-2">
              <div className={`flex items-center gap-2 font-bold ${lastRun.success ? 'text-green-700' : 'text-red-700'}`}>
                {lastRun.success ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                <span>{lastRun.success ? 'สำเร็จ' : 'ล้มเหลว'}</span>
              </div>
              <p className="text-xs text-slate-500">
                {format(lastRun.timestamp, 'd MMM yyyy HH:mm:ss', { locale: th })}
              </p>
            </div>
            <div className="space-y-3">
              {renderSummary(lastRun.data)}
              <details>
                <summary className="text-xs cursor-pointer text-slate-600">ดูข้อมูลดิบ (JSON)</summary>
                {renderLogDetails(lastRun.data)}
              </details>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-slate-50 rounded-lg">
            <Clock className="w-8 h-8 mx-auto text-slate-400 mb-2" />
            <p className="text-slate-500">ยังไม่มีข้อมูลการรัน</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};


export default function CronJobDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <PageHeader
        title="แดชบอร์ด Cron Job"
        subtitle="ตรวจสอบผลการทำงานอัตโนมัติล่าสุดของระบบ"
        icon={Terminal}
        showBackButton={true}
        backUrl={createPageUrl('TestingAdmin')}
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <FunctionLogCard
            functionName="generateMonthlyBills"
            title="สร้างบิลรายเดือน"
            icon={FileText}
            description="สร้างบิลค่าเช่าและค่าบริการต่างๆ อัตโนมัติทุกเดือน"
          />
          <FunctionLogCard
            functionName="sendBatchLineMessages"
            title="ส่งการแจ้งเตือน LINE"
            icon={Send}
            description="ส่งข้อความแจ้งเตือนบิลและใบเสร็จผ่าน LINE Official Account"
          />
        </div>
      </div>
    </div>
  );
}