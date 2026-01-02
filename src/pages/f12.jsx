import React, { useState, useEffect, useRef } from "react";
import { Terminal, Trash2, AlertCircle, Info, AlertTriangle, Bug, Eye, User, Settings, Loader2, ExternalLink, Link as LinkIcon, RefreshCw } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";

export default function F12Page() {
  const [logs, setLogs] = useState([]);
  const logsEndRef = useRef(null);
  const originalConsole = useRef({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState({ deleted: 0, remaining: 0, initial: 0 });
  const [manualBranchId, setManualBranchId] = useState('');
  const [generatedLinks, setGeneratedLinks] = useState([]);

  // Fetch user data for debugging
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  // ⭐ Fetch payments for link testing (ทุกสถานะ)
  const { data: pendingPayments = [], refetch: refetchPayments, isLoading: paymentsLoading } = useQuery({
    queryKey: ['pendingPayments', manualBranchId],
    queryFn: async () => {
      if (!manualBranchId) return [];
      const allPayments = await base44.entities.Payment.filter({ 
        branch_id: manualBranchId
      });
      // เรียงตาม created_date ล่าสุด แล้วเอา 10 รายการแรก
      return allPayments.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 10);
    },
    enabled: !!manualBranchId
  });

  // Auto-select first branch on load
  useEffect(() => {
    if (branches.length > 0 && !manualBranchId) {
      setManualBranchId(branches[0].id);
    }
  }, [branches, manualBranchId]);

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

  const handleDebugUser = () => {
    console.log('👤 Current User:', currentUser);
    console.log('📋 User Role:', currentUser?.custom_role || currentUser?.role);
    console.log('🔑 Permissions:', currentUser?.permissions);
    console.log('🏢 Accessible Branches:', currentUser?.accessible_branches);
    console.log('📧 Email:', currentUser?.email);
    console.log('🆔 ID:', currentUser?.id);
    toast.success('ดูข้อมูลใน Console แล้ว', { duration: 3000 });
  };

  const handleDebugStorage = () => {
    console.log('💾 LocalStorage Data:');
    console.log('  - selected_branch_id:', localStorage.getItem('selected_branch_id'));
    console.log('  - selected_branch_name:', localStorage.getItem('selected_branch_name'));
    console.log('🏢 All Branches:', branches);
    toast.success('ดูข้อมูลใน Console แล้ว', { duration: 3000 });
  };

  const handleDebugNavigation = () => {
    console.log('🧭 Navigation Test:');
    console.log('  - Current URL:', window.location.href);
    console.log('  - Pathname:', window.location.pathname);
    console.log('  - Search:', window.location.search);
    console.log('  - History State:', window.history.state);
    toast.success('ดูข้อมูลใน Console แล้ว', { duration: 3000 });
  };

  const handleTestQuery = async () => {
    try {
      console.log('🔍 Testing API Query...');
      const testData = await base44.entities.Branch.list('-created_date', 5);
      console.log('✅ Query Success:', testData);
      toast.success(`Query สำเร็จ - ได้ ${testData.length} สาขา`, { duration: 3000 });
    } catch (error) {
      console.error('❌ Query Error:', error);
      toast.error('Query ไม่สำเร็จ: ' + error.message, { duration: 5000 });
    }
  };

  const handleClearStorage = () => {
    if (confirm('ยืนยันการล้าง LocalStorage?')) {
      localStorage.removeItem('selected_branch_id');
      localStorage.removeItem('selected_branch_name');
      console.log('🗑️ Cleared storage');
      toast.success('ล้าง Storage แล้ว', { duration: 3000 });
    }
  };

  const handleDeletePayments = async () => {
    if (!confirm('ยืนยันการลบ Payment ทั้งหมดของสาขา Wresident87777?\n\nระบบจะลบในพื้นหลัง')) return;

    setIsDeleting(true);
    setDeleteProgress({ deleted: 0, remaining: 0, initial: 0 });
    toast.loading('กำลังนับจำนวนข้อมูล...', { id: 'delete-start' });

    try {
      const result = await base44.functions.invoke('deletePaymentsByBranch', { 
        branch_id: '69255a34e816a8749fc765c2' 
      });

      console.log('🚀 Background deletion started:', result.data);

      if (result.data.success && result.data.started && result.data.totalPayments) {
        setDeleteProgress({ 
          deleted: 0, 
          remaining: result.data.totalPayments, 
          initial: result.data.totalPayments 
        });

        toast.dismiss('delete-start');
        toast.success(`🚀 เริ่มลบ ${result.data.totalPayments.toLocaleString()} รายการ`, { 
          duration: 4000 
        });

        // Poll progress ทุก 3 วินาที (ลด frequency เพื่อหลีกเลี่ยง rate limit)
        let poll404Count = 0;
        const interval = setInterval(async () => {
          try {
            const progressResult = await base44.functions.invoke('getDeleteProgress', { 
              branch_id: '69255a34e816a8749fc765c2' 
            });

            poll404Count = 0; // Reset on success

            if (progressResult.data.deleted !== undefined) {
              const prev = deleteProgress;
              const newProgress = progressResult.data;

              setDeleteProgress(newProgress);

              // แสดง toast อัพเดททุก 10%
              const prevPercent = prev.initial > 0 ? Math.floor((prev.deleted / prev.initial) * 10) : 0;
              const newPercent = newProgress.initial > 0 ? Math.floor((newProgress.deleted / newProgress.initial) * 10) : 0;

              if (newPercent > prevPercent && newProgress.remaining > 0) {
                toast.info(`📊 ลบไปแล้ว ${newProgress.deleted.toLocaleString()}/${newProgress.initial.toLocaleString()} (${Math.round((newProgress.deleted/newProgress.initial)*100)}%)`, {
                  duration: 2000
                });
              }

              console.log(`📊 Progress: ${newProgress.deleted.toLocaleString()}/${newProgress.initial.toLocaleString()} (เหลือ ${newProgress.remaining.toLocaleString()})`);

              if (newProgress.remaining === 0 && newProgress.deleted > 0) {
                clearInterval(interval);
                setIsDeleting(false);
                toast.success(`✅ ลบเสร็จสมบูรณ์! ลบทั้งหมด ${newProgress.deleted.toLocaleString()} รายการ`, { duration: 8000 });
              }
            }
          } catch (err) {
            // หยุด poll ถ้าเจอ 404 ซ้ำๆ มากกว่า 10 ครั้ง
            if (err.response?.status === 404 || err.message?.includes('404')) {
              poll404Count++;
              if (poll404Count > 10) {
                clearInterval(interval);
                setIsDeleting(false);
              }
            } else {
              console.warn('⚠️ Poll error:', err.message);
            }
          }
        }, 3000);

        // หยุด poll หลัง 10 นาที
        setTimeout(() => {
          clearInterval(interval);
          if (deleteProgress.remaining > 0) {
            toast.warning('⚠️ หมดเวลา polling - กระบวนการอาจยังทำงานอยู่', { duration: 5000 });
          }
          setIsDeleting(false);
        }, 10 * 60 * 1000);
      } else {
        toast.dismiss('delete-start');
        toast.warning('เริ่มลบข้อมูลแล้ว แต่ไม่สามารถติดตาม progress ได้', { duration: 5000 });
        setIsDeleting(false);
      }
    } catch (error) {
      toast.dismiss('delete-start');
      console.error('❌ เกิดข้อผิดพลาด:', error);
      toast.error('ลบไม่สำเร็จ: ' + error.message, { duration: 5000 });
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
          <div className="flex gap-2 flex-wrap">
            <Button onClick={clearLogs} variant="outline" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Clear
            </Button>
          </div>
        }
      />

      <div className="p-4 md:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Debug Tools */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Bug className="w-5 h-5 text-purple-600" />
              🛠️ Developer Tools
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <Button onClick={handleDebugUser} variant="outline" size="sm" className="h-auto py-3">
                <User className="w-4 h-4 mr-2" />
                ดู User Data
              </Button>

              <Button onClick={handleDebugStorage} variant="outline" size="sm" className="h-auto py-3">
                <Settings className="w-4 h-4 mr-2" />
                ดู Storage
              </Button>

              <Button onClick={handleDebugNavigation} variant="outline" size="sm" className="h-auto py-3">
                <Eye className="w-4 h-4 mr-2" />
                ดู Navigation
              </Button>

              <Button onClick={handleTestQuery} variant="outline" size="sm" className="h-auto py-3">
                <Terminal className="w-4 h-4 mr-2" />
                Test Query
              </Button>

              <Button onClick={handleClearStorage} variant="outline" size="sm" className="h-auto py-3 border-orange-300 text-orange-700 hover:bg-orange-50">
                <Trash2 className="w-4 h-4 mr-2" />
                ล้าง Storage
              </Button>

              <Button 
                onClick={handleDeletePayments} 
                variant="destructive" 
                size="sm"
                disabled={isDeleting}
                className="h-auto py-3 col-span-2"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? 'กำลังลบ...' : 'ลบ Payment สาขา Test'}
              </Button>

              <Button 
                onClick={async () => {
                  if (!confirm('⚠️ ยืนยันการลบข้อมูลทดสอบทั้งหมด?\n\n- Payments, Bookings, Rooms, Tenants, MeterReadings ที่มี [TEST-] หรือ TEST- ในข้อมูล\n\nการดำเนินการนี้ไม่สามารถย้อนกลับได้')) return;

                  setIsDeleting(true);
                  toast.loading('กำลังลบข้อมูลทดสอบ...', { id: 'delete-test' });

                  try {
                    const result = await base44.functions.invoke('deleteTestData', {});
                    console.log('✅ Delete test data result:', result.data);

                    toast.dismiss('delete-test');
                    if (result.data.success) {
                      toast.success(result.data.message, { duration: 8000 });
                    } else {
                      toast.error('ลบไม่สำเร็จ: ' + (result.data.error || 'Unknown error'));
                    }
                  } catch (error) {
                    toast.dismiss('delete-test');
                    console.error('❌ Error:', error);
                    toast.error('ลบไม่สำเร็จ: ' + error.message);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                variant="destructive"
                size="sm"
                disabled={isDeleting}
                className="h-auto py-3 col-span-2 bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? 'กำลังลบ...' : '🗑️ ลบข้อมูลทดสอบทั้งหมด'}
              </Button>

              <Button 
                onClick={async () => {
                  const selectedBranchId = localStorage.getItem('selected_branch_id');
                  if (!selectedBranchId) {
                    toast.error('กรุณาเลือกสาขาก่อน');
                    return;
                  }

                  if (!confirm(`🎯 คำนวณคะแนนการชำระเงินให้ผู้เช่าทุกคนในสาขานี้?\n\nระบบจะประมวลผลทีละ 5 คน`)) return;

                  setIsDeleting(true);
                  toast.loading('กำลังคำนวณคะแนน...', { id: 'recalc-scores' });

                  try {
                    const result = await base44.functions.invoke('recalculateAllScores', { 
                      branch_id: selectedBranchId 
                    });
                    console.log('✅ Recalculate scores result:', result.data);

                    toast.dismiss('recalc-scores');
                    if (result.data.success) {
                      toast.success(result.data.message, { duration: 8000 });
                    } else {
                      toast.error('คำนวณไม่สำเร็จ: ' + (result.data.error || 'Unknown error'));
                    }
                  } catch (error) {
                    toast.dismiss('recalc-scores');
                    console.error('❌ Error:', error);
                    toast.error('คำนวณไม่สำเร็จ: ' + error.message);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                variant="default"
                size="sm"
                disabled={isDeleting}
                className="h-auto py-3 col-span-2 bg-purple-600 hover:bg-purple-700"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังคำนวณ...
                  </>
                ) : (
                  <>
                    <Terminal className="w-4 h-4 mr-2" />
                    🧮 คำนวณคะแนนทุกคน
                  </>
                )}
              </Button>
            </div>

            {/* ส่วนใส่ Branch ID แบบ Manual */}
            <div className="mt-6 p-4 bg-orange-50 border-2 border-orange-300 rounded-xl">
              <h3 className="font-bold text-orange-800 mb-3 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                🔥 ลบ Payment ด้วย Branch ID
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="ใส่ Branch ID ที่ต้องการลบ"
                  value={manualBranchId}
                  onChange={(e) => setManualBranchId(e.target.value)}
                  className="flex-1 px-4 py-2 border-2 border-orange-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <Button
                  onClick={async () => {
                    if (!manualBranchId?.trim()) {
                      toast.error('กรุณาใส่ Branch ID');
                      return;
                    }

                    if (!confirm(`⚠️ ยืนยันการลบ Payment ทั้งหมดของสาขา:\n${manualBranchId}\n\nระบบจะลบในพื้นหลัง`)) {
                      return;
                    }

                    setIsDeleting(true);
                    setDeleteProgress({ deleted: 0, remaining: 0, initial: 0 });
                    toast.loading('กำลังนับจำนวนข้อมูล...', { id: 'delete-manual' });

                    try {
                      const result = await base44.functions.invoke('deletePaymentsByBranch', { 
                        branch_id: manualBranchId 
                      });

                      console.log('🚀 Background deletion started:', result.data);

                      if (result.data.success && result.data.started) {
                        const total = result.data.totalPayments || 0;
                        setDeleteProgress({ 
                          deleted: 0, 
                          remaining: total, 
                          initial: total 
                        });

                        toast.dismiss('delete-manual');
                        toast.success(`🚀 เริ่มลบ ${total.toLocaleString()} รายการ`, { 
                          duration: 4000 
                        });

                        // Poll progress ทุก 3 วินาที
                        let poll404Count = 0;
                        const interval = setInterval(async () => {
                          try {
                            const progressResult = await base44.functions.invoke('getDeleteProgress', { 
                              branch_id: manualBranchId 
                            });

                            poll404Count = 0; // Reset on success

                            const newProgress = progressResult.data;
                            setDeleteProgress(newProgress);

                            console.log(`📊 Progress: ลบแล้ว ${newProgress.deleted?.toLocaleString() || 0}/${newProgress.initial?.toLocaleString() || 0} (เหลือ ${newProgress.remaining?.toLocaleString() || 0})`);

                            if (newProgress.completed || newProgress.remaining === 0) {
                              clearInterval(interval);
                              setIsDeleting(false);
                              toast.success(`✅ ลบเสร็จแล้ว ${newProgress.deleted?.toLocaleString() || 0} รายการ!`, { duration: 8000 });
                            }
                          } catch (err) {
                            // หยุด poll ถ้าเจอ 404 ซ้ำๆ
                            if (err.response?.status === 404 || err.message?.includes('404')) {
                              poll404Count++;
                              if (poll404Count > 10) {
                                clearInterval(interval);
                                setIsDeleting(false);
                              }
                            } else {
                              console.warn('⚠️ Poll error:', err.message);
                            }
                          }
                        }, 3000);

                        setTimeout(() => {
                          clearInterval(interval);
                          setIsDeleting(false);
                        }, 10 * 60 * 1000);
                      } else {
                        toast.dismiss('delete-manual');
                        toast.warning('เริ่มลบแล้ว แต่ไม่สามารถติดตาม progress ได้');
                        setIsDeleting(false);
                      }
                    } catch (error) {
                      toast.dismiss('delete-manual');
                      console.error('❌ Error:', error);
                      toast.error('ลบไม่สำเร็จ: ' + error.message);
                      setIsDeleting(false);
                    }
                  }}
                  disabled={isDeleting || !manualBranchId}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-6"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังลบ...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      ลบทันที
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* ⭐ Public Invoice Link Generator */}
            <div className="mt-6 p-4 bg-green-50 border-2 border-green-300 rounded-xl">
              <h3 className="font-bold text-green-800 mb-3 flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                🔗 ทดสอบลิงก์ใบแจ้งหนี้สาธารณะ (ไม่ต้องล็อกอิน)
              </h3>
              <p className="text-sm text-green-700 mb-3">
                สร้างลิงก์ใบแจ้งหนี้ที่เข้าถึงได้โดยไม่ต้องล็อกอิน (เหมือนหน้า Welcome)
              </p>

              {/* Branch Selector */}
              <div className="flex gap-2 mb-4">
                <Select value={manualBranchId} onValueChange={setManualBranchId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="เลือกสาขา..." />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.branch_name} ({branch.branch_code || 'N/A'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => refetchPayments()}
                  variant="outline"
                  size="sm"
                  disabled={paymentsLoading}
                  className="border-green-300 text-green-700 hover:bg-green-50"
                >
                  <RefreshCw className={`w-4 h-4 ${paymentsLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {/* แสดงรายการ Payment ที่สามารถสร้างลิงก์ได้ */}
              {pendingPayments.length > 0 ? (
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {pendingPayments.map((payment) => {
                    const publicLink = `${window.location.origin}${createPageUrl('PublicInvoice')}?paymentId=${payment.id}`;
                    const alreadyGenerated = generatedLinks.some(l => l.paymentId === payment.id);

                    const statusColors = {
                      paid: 'bg-green-100 text-green-700',
                      pending: 'bg-yellow-100 text-yellow-700',
                      partial_paid: 'bg-blue-100 text-blue-700',
                      overdue: 'bg-red-100 text-red-700'
                    };

                    return (
                      <div key={payment.id} className="bg-white p-3 rounded-lg border border-green-200 flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-slate-800 truncate">
                              {payment.id.substring(0, 8)}...
                            </p>
                            <Badge className={`text-xs ${statusColors[payment.status] || 'bg-slate-100'}`}>
                              {payment.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-600">
                            ยอด: {payment.total_amount?.toLocaleString()} บาท • ครบ: {payment.due_date ? new Date(payment.due_date).toLocaleDateString('th-TH') : '-'}
                          </p>
                          {alreadyGenerated && (
                            <div className="mt-1 flex items-center gap-1">
                              <input
                                type="text"
                                readOnly
                                value={publicLink}
                                className="flex-1 text-xs bg-green-50 border border-green-300 rounded px-2 py-1"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  navigator.clipboard.writeText(publicLink);
                                  toast.success('คัดลอกลิงก์แล้ว');
                                }}
                                className="h-7 text-xs"
                              >
                                Copy
                              </Button>
                            </div>
                          )}
                        </div>
                        {alreadyGenerated ? (
                          <Button
                            size="sm"
                            onClick={() => window.open(publicLink, '_blank')}
                            className="bg-green-600 hover:bg-green-700 h-8"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            เปิดลิงก์
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => {
                              setGeneratedLinks(prev => [...prev, { paymentId: payment.id, link: publicLink }]);
                              toast.success('สร้างลิงก์แล้ว!');
                            }}
                            variant="outline"
                            className="border-green-300 text-green-700 hover:bg-green-50 h-8"
                          >
                            สร้างลิงก์
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 bg-white rounded-lg border-2 border-dashed border-green-200">
                  <LinkIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">ไม่มี Payment ในสาขานี้</p>
                  <p className="text-xs mt-1">ลองเปลี่ยน Branch ID ด้านล่าง หรือสร้างข้อมูลทดสอบ</p>
                </div>
              )}

              {/* Generate All Links */}
              <Button
                onClick={() => {
                  if (pendingPayments.length === 0) {
                    toast.error('ไม่มี Payment ให้สร้างลิงก์');
                    return;
                  }
                  const newLinks = pendingPayments.map(p => ({
                    paymentId: p.id,
                    link: `${window.location.origin}${createPageUrl('PublicInvoice')}?paymentId=${p.id}`
                  }));
                  setGeneratedLinks(newLinks);
                  toast.success(`สร้างลิงก์ทั้งหมด ${pendingPayments.length} รายการแล้ว!`);
                }}
                variant="outline"
                size="sm"
                className="w-full border-green-300 text-green-700 hover:bg-green-50"
              >
                <LinkIcon className="w-4 h-4 mr-2" />
                สร้างลิงก์ทั้งหมด ({pendingPayments.length})
              </Button>
            </div>

            {/* Delete Progress Indicator */}
            {deleteProgress.initial > 0 && (
              <div className="mt-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200 shadow-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                  <div className="flex-1">
                    <p className="font-bold text-blue-900 text-lg">
                      {deleteProgress.remaining === 0 && deleteProgress.deleted > 0 ? '✅ ลบเสร็จสมบูรณ์!' : '🔄 กำลังลบข้อมูล...'}
                    </p>
                    <p className="text-sm text-blue-700 font-medium">
                      ลบไปแล้ว <span className="font-bold text-blue-900">{deleteProgress.deleted.toLocaleString()}</span> / {deleteProgress.initial.toLocaleString()} รายการ
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      เหลืออีก <span className="font-bold">{deleteProgress.remaining.toLocaleString()}</span> รายการ
                    </p>
                  </div>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-4 overflow-hidden shadow-inner">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 transition-all duration-300 rounded-full relative"
                    style={{ width: `${deleteProgress.initial > 0 ? (deleteProgress.deleted / deleteProgress.initial) * 100 : 0}%` }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                  </div>
                </div>
                <div className="flex justify-between items-center mt-3">
                  <p className="text-xs text-blue-600 font-semibold">
                    {deleteProgress.initial > 0 ? Math.round((deleteProgress.deleted / deleteProgress.initial) * 100) : 0}% เสร็จสิ้น
                  </p>
                  <p className="text-xs text-blue-500">
                    อัพเดททุก 2 วินาที
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Console Display */}
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