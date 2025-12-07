import React, { useState, useEffect, useRef } from "react";
import { Terminal, Trash2, AlertCircle, Info, AlertTriangle, Bug } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function F12Page() {
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);
  const originalConsole = useRef({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ deleted: 0, remaining: 0, initial: 0 });

  useEffect(() => {
    // บันทึก console functions เดิม
    originalConsole.current = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    // Override console functions
    console.log = (...args) => {
      originalConsole.current.log(...args);
      addLog('log', args);
    };

    console.error = (...args) => {
      originalConsole.current.error(...args);
      addLog('error', args);
    };

    console.warn = (...args) => {
      originalConsole.current.warn(...args);
      addLog('warn', args);
    };

    console.info = (...args) => {
      originalConsole.current.info(...args);
      addLog('info', args);
    };

    // คืนค่า console functions เดิมเมื่อ unmount
    return () => {
      console.log = originalConsole.current.log;
      console.error = originalConsole.current.error;
      console.warn = originalConsole.current.warn;
      console.info = originalConsole.current.info;
    };
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (type, args) => {
    const timestamp = new Date().toLocaleTimeString('th-TH');
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    setLogs(prev => [...prev, { type, message, timestamp, id: Date.now() + Math.random() }]);
  };

  const clearLogs = () => {
    setLogs([]);
    originalConsole.current.log('🧹 Console cleared');
  };

  const getLogIcon = (type) => {
    switch(type) {
      case 'error': return <AlertCircle className="w-4 h-4" />;
      case 'warn': return <AlertTriangle className="w-4 h-4" />;
      case 'info': return <Info className="w-4 h-4" />;
      default: return <Bug className="w-4 h-4" />;
    }
  };

  const getLogColor = (type) => {
    switch(type) {
      case 'error': return 'bg-red-50 border-red-200 text-red-800';
      case 'warn': return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'info': return 'bg-blue-50 border-blue-200 text-blue-800';
      default: return 'bg-slate-50 border-slate-200 text-slate-800';
    }
  };

  const getBadgeColor = (type) => {
    switch(type) {
      case 'error': return 'bg-red-100 text-red-700';
      case 'warn': return 'bg-yellow-100 text-yellow-700';
      case 'info': return 'bg-blue-100 text-blue-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  const handleDeletePayments = async () => {
    if (!confirm('ยืนยันการลบ Payment ทั้งหมดของสาขา Wresident87777?\n\nจะใช้เวลา 5-10 นาที สำหรับ 2600+ รายการ')) return;
    
    setIsDeleting(true);
    console.log('🗑️ เริ่มลบ Payment ของสาขา 69255a34e816a8749fc765c2...');
    console.log('⏱️ กรุณารอ 5-10 นาที (ประมาณ 2600+ รายการ)');
    console.log('📌 ดูความคืบหน้าจาก Backend Logs ด้านล่าง (log ทุก 100 รายการ)');
    
    toast.loading('กำลังลบ... กรุณารอ 5-10 นาที', { duration: Infinity, id: 'delete-progress' });
    
    try {
      console.log('🚀 กำลังเรียก function...');
      const result = await base44.functions.invoke('deletePaymentsByBranch', { 
        branch_id: '69255a34e816a8749fc765c2' 
      }, {
        timeout: 600000 // 10 นาที
      });
      
      toast.dismiss('delete-progress');
      console.log('✅ ผลลัพธ์:', result.data);
      toast.success(result.data.message || `ลบสำเร็จ ${result.data.deletedCount} รายการ`, { duration: 10000 });
    } catch (error) {
      toast.dismiss('delete-progress');
      console.error('❌ เกิดข้อผิดพลาด:', error);
      console.error('Error response:', error.response?.data);
      console.error('Stack:', error.stack);
      toast.error('ลบไม่สำเร็จ: ' + (error.response?.data?.error || error.message), { duration: 10000 });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <PageHeader
        title="F12 Developer Console"
        subtitle="แสดง Console Logs แบบ Real-time"
        icon={Terminal}
        showBackButton
        actions={
          <div className="flex gap-2">
            <Button 
              onClick={handleDeletePayments} 
              variant="destructive" 
              size="sm"
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? 'กำลังลบ...' : 'ลบ Wresident87777'}
            </Button>
            <Button onClick={clearLogs} variant="outline" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-slate-900 rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-mono text-sm">Console</span>
              </div>
              <Badge variant="outline" className="text-slate-400 border-slate-600">
                {logs.length} logs
              </Badge>
            </div>

            <div className="p-4 h-[calc(100vh-280px)] overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Terminal className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ยังไม่มี logs - ลองกดปุ่มต่างๆ ในระบบเพื่อดู console</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded-lg border ${getLogColor(log.type)} transition-all hover:shadow-md`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getLogIcon(log.type)}
                          <Badge className={`${getBadgeColor(log.type)} text-xs`}>
                            {log.type.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs opacity-70 mb-1">{log.timestamp}</div>
                          <pre className="whitespace-pre-wrap break-words text-sm">{log.message}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}