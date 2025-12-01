import React, { useState, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, Image, Send, CheckCircle2, AlertCircle, Clock, Info, Sparkles, Play, RotateCw, Terminal, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function TestInvoiceGenerationPage() {
  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name');

  const [generatingBills, setGeneratingBills] = useState(false);
  const [sendingBills, setSendingBills] = useState(false);
  const [generatingInvoice, setGeneratingInvoice] = useState(null);
  const [billResult, setBillResult] = useState(null);
  const [sendResult, setSendResult] = useState(null);
  const [invoiceResults, setInvoiceResults] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(true);
  const [selectedPaymentId, setSelectedPaymentId] = useState('');
  const [testLineUserId, setTestLineUserId] = useState('');
  const [sendingTestLine, setSendingTestLine] = useState(false);
  const logsEndRef = useRef(null);

  const addLog = (type, message, data = null) => {
    const timestamp = new Date().toLocaleTimeString('th-TH');
    const icons = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      step: '🔄',
      data: '📦',
      api: '🌐',
      line: '💬'
    };
    
    setLogs(prev => [...prev, { 
      id: Date.now(), 
      type, 
      message, 
      data, 
      timestamp,
      icon: icons[type] || '•'
    }]);
    
    // Auto scroll to bottom
    setTimeout(() => {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const clearLogs = () => setLogs([]);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 60 * 60 * 1000,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: () => base44.entities.Room.filter({ branch_id: selectedBranchId }, '-room_number', 5000),
    enabled: !!selectedBranchId,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: () => base44.entities.Booking.filter({ branch_id: selectedBranchId, status: 'active' }, '-created_date', 5000),
    enabled: !!selectedBranchId,
  });

  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ['payments', selectedBranchId, 'test'],
    queryFn: () => base44.entities.Payment.filter({ branch_id: selectedBranchId }, '-created_date', 5000),
    enabled: !!selectedBranchId,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: () => base44.entities.Tenant.filter({ branch_id: selectedBranchId }, '-created_date', 5000),
    enabled: !!selectedBranchId,
  });

  const { data: meterReadings = [] } = useQuery({
    queryKey: ['meterReadings', selectedBranchId],
    queryFn: () => base44.entities.MeterReading.filter({ branch_id: selectedBranchId }, '-reading_date', 5000),
    enabled: !!selectedBranchId,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    enabled: !!selectedBranchId,
  });

  const getConfigValue = (key, defaultValue = '') => {
    if (selectedBranchId) {
      const branchConfig = configs.find(c => c.key === key && c.branch_id === selectedBranchId);
      if (branchConfig?.value) return branchConfig.value;
    }
    const globalConfig = configs.find(c => c.key === key && !c.branch_id);
    return globalConfig?.value || defaultValue;
  };

  const monthlyRooms = rooms.filter(r => r.room_type === 'monthly');
  const roomsWithBooking = monthlyRooms.filter(r => 
    bookings.some(b => b.room_id === r.id)
  );
  
  // ⭐ คำนวณเดือนที่ระบบจะสร้างบิล (ดูจาก bill_generation_day และ pay_day)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const currentDay = now.getDate();
  
  const billGenDay = parseInt(getConfigValue('bill_generation_day', '27'));
  const payDay = parseInt(getConfigValue('pay_day', '5'));
  
  // ⭐ คำนวณเดือนที่จะสร้างบิล (ตาม logic ใน generateMonthlyBills)
  let targetBillYear = currentYear;
  let targetBillMonth = currentMonth;
  
  // ถ้าวันสร้างบิล > วันครบกำหนด = สร้างบิลสำหรับเดือนหน้า
  if (billGenDay > payDay) {
    targetBillMonth = currentMonth + 1;
    if (targetBillMonth > 11) {
      targetBillMonth = 0;
      targetBillYear = currentYear + 1;
    }
  }
  
  const targetBillYearMonth = `${targetBillYear}-${String(targetBillMonth + 1).padStart(2, '0')}`; // e.g., "2025-01"
  const currentYearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`; // e.g., "2025-12"
  
  // ดึง room_id ที่มีบิลของเดือนเป้าหมายแล้ว
  const roomsWithTargetBill = new Set(
    payments
      .filter(p => p.due_date && p.due_date.startsWith(targetBillYearMonth))
      .map(p => p.room_id)
  );
  
  // ห้องที่ยังไม่มีบิลเดือนเป้าหมาย
  const roomsWithoutCurrentBill = roomsWithBooking.filter(r => !roomsWithTargetBill.has(r.id));
  
  // ⭐ สรุปบิลแยกตามเดือน
  const billsByMonth = useMemo(() => {
    const monthMap = {};
    payments.forEach(p => {
      if (p.due_date) {
        const month = p.due_date.substring(0, 7); // e.g., "2025-12"
        if (!monthMap[month]) {
          monthMap[month] = { count: 0, total: 0, pending: 0, paid: 0 };
        }
        monthMap[month].count++;
        monthMap[month].total += p.total_amount || 0;
        if (p.status === 'paid') {
          monthMap[month].paid++;
        } else {
          monthMap[month].pending++;
        }
      }
    });
    // Sort by month descending
    return Object.entries(monthMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 6); // แสดง 6 เดือนล่าสุด
  }, [payments]);
  const paymentsToSend = payments.filter(p => 
    (p.status === 'pending' || p.status === 'overdue') && !p.bill_sent_date
  );
  const paymentsWithoutImage = payments.filter(p => 
    !p.invoice_image_url && (p.status === 'pending' || p.status === 'overdue')
  );
  const tenantsWithLine = tenants.filter(t => t.line_user_id);
  
  // บิลที่ส่งได้ (ผู้เช่ามี LINE User ID)
  const paymentsCanSend = paymentsToSend.filter(p => {
    const tenant = tenants.find(t => t.id === p.tenant_id);
    return tenant?.line_user_id;
  });
  // บิลที่ส่งไม่ได้ (ผู้เช่าไม่มี LINE User ID)
  const paymentsCannotSend = paymentsToSend.filter(p => {
    const tenant = tenants.find(t => t.id === p.tenant_id);
    return !tenant?.line_user_id;
  });

  // ===== STEP 1: สร้างบิล =====
  const handleGenerateBills = async () => {
    setGeneratingBills(true);
    setBillResult(null);
    clearLogs();

    addLog('step', '=== เริ่มขั้นตอนที่ 1: สร้างบิลรายเดือน ===');
    addLog('info', `สาขา: ${selectedBranchName} (${selectedBranchId})`);
    addLog('info', `วันที่สร้างบิล: วันที่ ${getConfigValue('bill_generation_day', '27')}`);
    addLog('info', `วันครบกำหนด: วันที่ ${getConfigValue('pay_day', '5')}`);

    addLog('data', `ข้อมูลที่จะใช้:`, {
      rooms: rooms.length,
      monthlyRooms: monthlyRooms.length,
      roomsWithBooking: roomsWithBooking.length,
      roomsWithoutCurrentBill: roomsWithoutCurrentBill.length,
      bookings: bookings.length,
      meterReadings: meterReadings.length,
      tenants: tenants.length
    });
    
    addLog('info', `🔍 เดือนปัจจุบัน: ${currentYearMonth}`);
    addLog('info', `🏠 ห้องที่ยังไม่มีบิลเดือนนี้: ${roomsWithoutCurrentBill.length} ห้อง`);
    
    if (roomsWithoutCurrentBill.length === 0) {
      addLog('warning', '⚠️ ไม่มีห้องที่ต้องสร้างบิล - ทุกห้องมีบิลเดือนนี้แล้ว');
      toast.info('ทุกห้องมีบิลเดือนนี้แล้ว');
      setGeneratingBills(false);
      return;
    }
    
    addLog('info', `📋 ห้องที่จะสร้างบิล: ${roomsWithoutCurrentBill.map(r => r.room_number).slice(0, 10).join(', ')}${roomsWithoutCurrentBill.length > 10 ? '...' : ''}`);

    addLog('api', 'เรียก generateMonthlyBills API...', { branch_id: selectedBranchId, force: true });

    try {
      const response = await base44.functions.invoke('generateMonthlyBills', {
        branch_id: selectedBranchId,
        force: true
      });

      const result = response.data;
      setBillResult(result);
      
      if (result.success) {
        addLog('success', result.message);
        addLog('data', 'ผลลัพธ์:', result.summary || result);
        toast.success(result.message);
        await refetchPayments();
      } else {
        addLog('error', result.message || result.error || 'เกิดข้อผิดพลาด');
        toast.error(result.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Generate bills error:', error);
      addLog('error', `เกิดข้อผิดพลาด: ${error.message}`);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
      setBillResult({ success: false, error: error.message });
    } finally {
      setGeneratingBills(false);
      addLog('step', '=== จบขั้นตอนที่ 1 ===');
    }
  };

  // ===== STEP 2: สร้างรูปใบแจ้งหนี้ =====
  const handleGenerateInvoiceImages = async (singlePaymentId = null) => {
    const paymentsToProcess = singlePaymentId 
      ? payments.filter(p => p.id === singlePaymentId)
      : paymentsWithoutImage;

    if (paymentsToProcess.length === 0) {
      toast.info('ไม่มีบิลที่ต้องสร้างรูป');
      return;
    }

    addLog('step', '=== เริ่มขั้นตอนที่ 2: สร้างรูปใบแจ้งหนี้ ===');
    addLog('info', `จำนวนบิลที่ต้องสร้างรูป: ${paymentsToProcess.length} รายการ`);

    const results = [];
    
    for (let i = 0; i < paymentsToProcess.length; i++) {
      const payment = paymentsToProcess[i];
      const room = rooms.find(r => r.id === payment.room_id);
      const tenant = tenants.find(t => t.id === payment.tenant_id);
      
      setGeneratingInvoice(payment.id);
      addLog('step', `[${i + 1}/${paymentsToProcess.length}] กำลังสร้างรูปห้อง ${room?.room_number || 'N/A'}`);
      addLog('data', 'ข้อมูลบิล:', {
        paymentId: payment.id,
        room: room?.room_number,
        tenant: tenant?.full_name,
        total: payment.total_amount,
        due_date: payment.due_date
      });
      
      addLog('api', 'เรียก generateInvoiceImage API...');

      try {
        const response = await base44.functions.invoke('generateInvoiceImage', {
          paymentId: payment.id
        });

        if (response.data.success) {
          results.push({
            paymentId: payment.id,
            roomNumber: room?.room_number,
            success: true,
            url: response.data.invoice_image_url
          });
          addLog('success', `สร้างรูปสำเร็จ: ${response.data.invoice_image_url}`);
        } else {
          results.push({
            paymentId: payment.id,
            roomNumber: room?.room_number,
            success: false,
            error: response.data.error
          });
          addLog('error', `ล้มเหลว: ${response.data.error}`);
        }
      } catch (error) {
        results.push({
          paymentId: payment.id,
          roomNumber: room?.room_number,
          success: false,
          error: error.message
        });
        addLog('error', `ล้มเหลว: ${error.message}`);
      }

      // Delay between requests
      if (i < paymentsToProcess.length - 1) {
        addLog('info', 'รอ 2 วินาทีก่อนสร้างรูปถัดไป...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    setInvoiceResults(results);
    setGeneratingInvoice(null);
    await refetchPayments();
    
    const successCount = results.filter(r => r.success).length;
    addLog('step', `=== จบขั้นตอนที่ 2: สำเร็จ ${successCount}/${results.length} ===`);
    toast.success(`สร้างรูปสำเร็จ ${successCount}/${results.length} รายการ`);
  };

  // ===== STEP 3: ส่งทดสอบ LINE User ID เดียว หลายรอบ =====
  const handleTestSendLine = async () => {
    if (!testLineUserId.trim()) {
      toast.error('กรุณาใส่ LINE User ID');
      return;
    }
    if (!selectedPaymentId) {
      toast.error('กรุณาเลือกบิลที่ต้องการส่ง');
      return;
    }

    setSendingTestLine(true);
    addLog('step', '=== ทดสอบส่ง LINE หลายรอบ (User ID เดียว) ===');
    addLog('info', `LINE User ID: ${testLineUserId}`);
    addLog('info', `Payment ID: ${selectedPaymentId}`);

    const payment = payments.find(p => p.id === selectedPaymentId);
    const room = rooms.find(r => r.id === payment?.room_id);
    const tenant = tenants.find(t => t.id === payment?.tenant_id);

    addLog('data', 'ข้อมูลบิล:', {
      room: room?.room_number,
      tenant: tenant?.full_name,
      total: payment?.total_amount,
      hasImage: !!payment?.invoice_image_url
    });

    try {
      // ส่ง 3 รอบ
      for (let i = 1; i <= 3; i++) {
        addLog('step', `📤 รอบที่ ${i}/3`);

        const message = `🧪 ทดสอบส่งรอบที่ ${i}

  🏠 ห้อง ${room?.room_number || 'N/A'}
  📅 รอบบิล: ${payment?.due_date || 'N/A'}
  💰 ยอดรวม: ${payment?.total_amount?.toLocaleString() || 0} บาท

  ส่งเมื่อ: ${new Date().toLocaleTimeString('th-TH')}`;

        addLog('api', `เรียก sendLineMessage API รอบที่ ${i}...`);

        const response = await base44.functions.invoke('sendLineMessage', {
          to: testLineUserId.trim(),
          message: message
        });

        if (response.data.success) {
          addLog('success', `รอบที่ ${i} ส่งสำเร็จ!`);
        } else {
          addLog('error', `รอบที่ ${i} ล้มเหลว: ${response.data.error}`);
        }

        // รอ 2 วินาทีระหว่างรอบ
        if (i < 3) {
          addLog('info', 'รอ 2 วินาที...');
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      toast.success('ส่งทดสอบครบ 3 รอบแล้ว!');
    } catch (error) {
      addLog('error', `เกิดข้อผิดพลาด: ${error.message}`);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setSendingTestLine(false);
      addLog('step', '=== จบการทดสอบ ===');
    }
  };

  // ===== FULL FLOW =====
  const handleFullFlow = async () => {
    clearLogs();
    addLog('step', '🚀 เริ่มรันทั้ง 3 ขั้นตอน');

    // 1. สร้างบิล
    await handleGenerateBills();
    
    // รอให้ข้อมูล refresh
    addLog('info', 'รอ 3 วินาทีก่อนขั้นตอนถัดไป...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    await refetchPayments();
    
    // 2. สร้างรูปใบแจ้งหนี้
    const updatedPaymentsWithoutImage = payments.filter(p => 
      !p.invoice_image_url && (p.status === 'pending' || p.status === 'overdue')
    );
    
    if (updatedPaymentsWithoutImage.length > 0) {
      await handleGenerateInvoiceImages();
    } else {
      addLog('info', 'ไม่มีบิลที่ต้องสร้างรูป - ข้ามขั้นตอนนี้');
    }
    
    // 3. ส่งบิล
    addLog('info', 'รอ 2 วินาทีก่อนส่ง LINE...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await handleSendBills();

    addLog('step', '🎉 รันครบทุกขั้นตอนแล้ว!');
  };

  if (!selectedBranchId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">กรุณาเลือกสาขา</h2>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader
        title="ทดสอบระบบสร้างบิล + ส่ง LINE"
        subtitle={`สาขา ${selectedBranchName}`}
        icon={Terminal}
        showNotifications={false}
      />

      <div className="px-4 md:px-8 py-6 space-y-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
              <CardContent className="p-3">
                <div className="text-center">
                  <p className="text-xs text-slate-600">ห้องรายเดือน</p>
                  <p className="text-2xl font-bold text-blue-600">{monthlyRooms.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
              <CardContent className="p-3">
                <div className="text-center">
                  <p className="text-xs text-slate-600">มีผู้เช่า</p>
                  <p className="text-2xl font-bold text-green-600">{roomsWithBooking.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg border-2 border-red-300">
              <CardContent className="p-3">
                <div className="text-center">
                  <p className="text-xs text-slate-600">ยังไม่มีบิล ({currentYearMonth})</p>
                  <p className="text-2xl font-bold text-red-600">{roomsWithoutCurrentBill.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
              <CardContent className="p-3">
                <div className="text-center">
                  <p className="text-xs text-slate-600">รอส่งบิล</p>
                  <p className="text-2xl font-bold text-orange-600">{paymentsToSend.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
              <CardContent className="p-3">
                <div className="text-center">
                  <p className="text-xs text-slate-600">ไม่มีรูป</p>
                  <p className="text-2xl font-bold text-purple-600">{paymentsWithoutImage.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white/80 backdrop-blur-sm shadow-lg">
              <CardContent className="p-3">
                <div className="text-center">
                  <p className="text-xs text-slate-600">เชื่อม LINE</p>
                  <p className="text-2xl font-bold text-emerald-600">{tenantsWithLine.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-2xl">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold mb-1">🚀 รันทั้งหมดอัตโนมัติ</h3>
                  <p className="text-sm opacity-90">สร้างบิล → สร้างรูปใบแจ้งหนี้ → ส่ง LINE (ทีละขั้นตอน)</p>
                </div>
                <Button
                  onClick={handleFullFlow}
                  disabled={generatingBills || sendingBills || generatingInvoice}
                  className="bg-white text-purple-700 hover:bg-white/90 px-8 py-6 text-lg font-bold shadow-lg"
                >
                  {(generatingBills || sendingBills || generatingInvoice) ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      กำลังทำงาน...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      รัน 3 ขั้นตอน
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Individual Steps */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <Card className="bg-white/90 shadow-lg border-blue-200">
              <CardHeader className="pb-2 bg-blue-50">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">1</span>
                  <FileText className="w-4 h-4 text-blue-600" />
                  สร้างบิลรายเดือน
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 space-y-1 mb-4">
                  <p>📦 ดึง Room, Booking, MeterReading, Config</p>
                  <p>💰 คำนวณ ค่าเช่า+น้ำ+ไฟ+ส่วนกลาง</p>
                  <p>🔍 เช็คซ้ำด้วย room_id + YYYY-MM</p>
                  <p>✅ สร้าง Payment records</p>
                </div>
                <Button
                  onClick={handleGenerateBills}
                  disabled={generatingBills}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {generatingBills ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังสร้าง...</>
                  ) : (
                    <><FileText className="w-4 h-4 mr-2" /> สร้างบิล (force)</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Step 2 */}
            <Card className="bg-white/90 shadow-lg border-purple-200">
              <CardHeader className="pb-2 bg-purple-50">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-600 text-white text-sm flex items-center justify-center">2</span>
                  <Image className="w-4 h-4 text-purple-600" />
                  สร้างรูปใบแจ้งหนี้
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 space-y-1 mb-4">
                  <p>🌐 เรียก getPublicInvoice</p>
                  <p>🎨 สร้าง HTML template</p>
                  <p>📸 ใช้ Browserless.io screenshot</p>
                  <p>☁️ Upload + บันทึก URL</p>
                </div>
                
                {/* Single payment selector */}
                <div className="mb-3">
                  <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
                    <SelectTrigger className="text-xs h-8">
                      <SelectValue placeholder="เลือกบิล (หรือสร้างทั้งหมด)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>สร้างทั้งหมดที่ไม่มีรูป ({paymentsWithoutImage.length})</SelectItem>
                      {payments.slice(0, 20).map(p => {
                        const room = rooms.find(r => r.id === p.room_id);
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            ห้อง {room?.room_number} - {p.total_amount?.toLocaleString()} บ. {p.invoice_image_url ? '✅' : '❌'}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  onClick={() => handleGenerateInvoiceImages(selectedPaymentId || null)}
                  disabled={generatingInvoice || (paymentsWithoutImage.length === 0 && !selectedPaymentId)}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  {generatingInvoice ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังสร้าง...</>
                  ) : (
                    <><Image className="w-4 h-4 mr-2" /> สร้างรูป ({selectedPaymentId ? '1' : paymentsWithoutImage.length})</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Step 3 */}
            <Card className="bg-white/90 shadow-lg border-orange-200">
              <CardHeader className="pb-2 bg-orange-50">
                <CardTitle className="text-base flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-orange-600 text-white text-sm flex items-center justify-center">3</span>
                  <Send className="w-4 h-4 text-orange-600" />
                  ทดสอบส่ง LINE
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 space-y-1 mb-4">
                  <p>🧪 ส่ง LINE User ID เดียว - 3 รอบ</p>
                  <p>⏱️ ห่างกัน 2 วินาที</p>
                  <p>💬 ทดสอบ rate limit</p>
                </div>
                <div className="mb-3">
                  <Label className="text-xs text-slate-600">LINE User ID</Label>
                  <Input
                    placeholder="U1234567890..."
                    value={testLineUserId}
                    onChange={(e) => setTestLineUserId(e.target.value)}
                    className="mt-1 text-sm"
                  />
                </div>
                <div className="mb-3">
                  <Label className="text-xs text-slate-600">เลือกบิล</Label>
                  <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue placeholder="เลือกบิล..." />
                    </SelectTrigger>
                    <SelectContent>
                      {payments.slice(0, 20).map(p => {
                        const room = rooms.find(r => r.id === p.room_id);
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            ห้อง {room?.room_number} - {p.total_amount?.toLocaleString()} บ.
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleTestSendLine}
                  disabled={sendingTestLine || !testLineUserId.trim() || !selectedPaymentId}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  {sendingTestLine ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังส่ง...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> ส่ง 3 รอบ</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>



          {/* Realtime Logs */}
          <Card className="bg-slate-900 text-white shadow-2xl">
            <CardHeader className="border-b border-slate-700 pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-green-400" />
                  Console Log (เหมือน Developer Console)
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={clearLogs}
                    className="text-slate-400 hover:text-white h-7 px-2"
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    ล้าง
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setShowLogs(!showLogs)}
                    className="text-slate-400 hover:text-white h-7 px-2"
                  >
                    {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            {showLogs && (
              <CardContent className="p-0">
                <ScrollArea className="h-80">
                  <div className="p-4 font-mono text-xs space-y-1">
                    {logs.length === 0 ? (
                      <div className="text-slate-500 text-center py-8">
                        กด "รัน 3 ขั้นตอน" หรือเลือกขั้นตอนแต่ละอันเพื่อดู log
                      </div>
                    ) : (
                      logs.map(log => (
                        <div key={log.id} className={`flex gap-2 ${
                          log.type === 'error' ? 'text-red-400' :
                          log.type === 'success' ? 'text-green-400' :
                          log.type === 'warning' ? 'text-yellow-400' :
                          log.type === 'step' ? 'text-cyan-400 font-bold' :
                          log.type === 'api' ? 'text-purple-400' :
                          log.type === 'data' ? 'text-blue-400' :
                          'text-slate-300'
                        }`}>
                          <span className="text-slate-500 flex-shrink-0">[{log.timestamp}]</span>
                          <span>{log.icon}</span>
                          <span className="flex-1">{log.message}</span>
                        </div>
                      ))
                    )}
                    {logs.some(l => l.data) && (
                      <div className="mt-4 border-t border-slate-700 pt-4">
                        <p className="text-slate-500 mb-2">📦 Data Objects:</p>
                        {logs.filter(l => l.data).slice(-5).map(log => (
                          <pre key={`data-${log.id}`} className="text-blue-300 bg-slate-800 p-2 rounded mb-2 overflow-auto text-[10px]">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        ))}
                      </div>
                    )}
                    <div ref={logsEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
            )}
          </Card>

          {/* Results Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Bill Generation Result */}
            {billResult && (
              <Card className={`${billResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {billResult.success ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                    ผลการสร้างบิล
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="font-semibold mb-2">{billResult.message}</p>
                  {billResult.summary && (
                    <div className="text-xs space-y-1 text-slate-600">
                      <p>• ห้องที่ประมวลผล: {billResult.summary.totalRoomsToProcess}</p>
                      <p>• สร้างใหม่: {billResult.summary.created}</p>
                      <p>• ข้าม (มีบิลแล้ว): {billResult.summary.skipped}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Send Result */}
            {sendResult && (
              <Card className={`${sendResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    {sendResult.success ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                    ผลการส่ง LINE
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <p className="font-semibold mb-2">{sendResult.message}</p>
                  {sendResult.success && (
                    <div className="text-xs space-y-1 text-slate-600">
                      <p>• ส่งสำเร็จ: {sendResult.sent}</p>
                      <p>• ล้มเหลว: {sendResult.failed}</p>
                      <p>• ข้าม: {sendResult.skipped || 0}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Invoice Image Results */}
          {invoiceResults.length > 0 && (
            <Card className="bg-white/90">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Image className="w-4 h-4 text-purple-600" />
                  ผลการสร้างรูปใบแจ้งหนี้ ({invoiceResults.filter(r => r.success).length}/{invoiceResults.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-2">
                    {invoiceResults.map((result, idx) => (
                      <div key={idx} className={`p-2 rounded-lg border text-sm flex items-center justify-between ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                        <div className="flex items-center gap-2">
                          {result.success ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
                          <span>ห้อง {result.roomNumber}</span>
                        </div>
                        {result.success ? (
                          <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                            ดูรูป →
                          </a>
                        ) : (
                          <span className="text-red-600 text-xs">{result.error}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* ⭐ Bills by Month Summary */}
          {billsByMonth.length > 0 && (
            <Card className="bg-white/90 shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  สรุปบิลแยกตามเดือน (6 เดือนล่าสุด)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {billsByMonth.map(([month, data]) => {
                    const isCurrentMonth = month === currentYearMonth;
                    return (
                      <div 
                        key={month} 
                        className={`p-3 rounded-lg border ${isCurrentMonth ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200'}`}
                      >
                        <p className={`text-xs font-semibold ${isCurrentMonth ? 'text-blue-700' : 'text-slate-600'}`}>
                          {month} {isCurrentMonth && '(เดือนนี้)'}
                        </p>
                        <p className="text-lg font-bold text-slate-800">{data.count} บิล</p>
                        <div className="text-xs text-slate-500 mt-1">
                          <p>💰 {data.total.toLocaleString()} บาท</p>
                          <p>✅ ชำระแล้ว: {data.paid}</p>
                          <p>⏳ ค้างชำระ: {data.pending}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Config Info */}
          <Card className="bg-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-600" />
                ข้อมูล Config สาขานี้
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-slate-500 text-xs">วันสร้างบิล</p>
                  <p className="font-semibold">วันที่ {getConfigValue('bill_generation_day', '27')}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">วันครบกำหนด</p>
                  <p className="font-semibold">วันที่ {getConfigValue('pay_day', '5')}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">ค่าน้ำ</p>
                  <p className="font-semibold">{getConfigValue('water_rate', '18')} บาท/หน่วย</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">ค่าไฟ</p>
                  <p className="font-semibold">{getConfigValue('electricity_rate', '7')} บาท/หน่วย</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}