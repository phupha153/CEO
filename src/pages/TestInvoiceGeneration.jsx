import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, FileText, Image, Send, CheckCircle2, AlertCircle, Clock, Info, Sparkles, Play, RotateCw, Terminal, ChevronDown, ChevronUp, Trash2, ExternalLink } from "lucide-react";
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
      bookings: bookings.length,
      meterReadings: meterReadings.length,
      tenants: tenants.length
    });

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

  // ===== STEP 3: ส่งแจ้งเตือน LINE =====
  const handleSendBills = async () => {
    setSendingBills(true);
    setSendResult(null);

    addLog('step', '=== เริ่มขั้นตอนที่ 3: ส่งแจ้งเตือน LINE ===');
    addLog('info', `บิลที่รอส่ง: ${paymentsToSend.length} รายการ`);
    addLog('info', `ผู้เช่าที่เชื่อมต่อ LINE: ${tenantsWithLine.length} คน`);

    // แสดงรายละเอียดแต่ละบิล
    paymentsToSend.slice(0, 5).forEach(p => {
      const room = rooms.find(r => r.id === p.room_id);
      const tenant = tenants.find(t => t.id === p.tenant_id);
      addLog('data', `- ห้อง ${room?.room_number}: ${tenant?.full_name} (${p.total_amount?.toLocaleString()} บาท)`, {
        hasLineUserId: !!tenant?.line_user_id,
        hasInvoiceImage: !!p.invoice_image_url
      });
    });
    if (paymentsToSend.length > 5) {
      addLog('info', `... และอีก ${paymentsToSend.length - 5} รายการ`);
    }

    addLog('api', 'เรียก sendPaymentReminder API...');

    try {
      const response = await base44.functions.invoke('sendPaymentReminder', {
        branch_id: selectedBranchId
      });

      const result = response.data;
      setSendResult(result);
      
      if (result.success) {
        addLog('success', result.message || `ส่งสำเร็จ ${result.sent}/${result.total}`);
        addLog('data', 'ผลลัพธ์:', {
          sent: result.sent,
          failed: result.failed,
          skipped: result.skipped
        });
        toast.success(`ส่งแจ้งเตือนสำเร็จ ${result.sent}/${result.total} รายการ`);
        await refetchPayments();
      } else {
        addLog('error', result.message || result.error || 'เกิดข้อผิดพลาด');
        toast.error(result.message || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Send bills error:', error);
      addLog('error', `เกิดข้อผิดพลาด: ${error.message}`);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
      setSendResult({ success: false, error: error.message });
    } finally {
      setSendingBills(false);
      addLog('step', '=== จบขั้นตอนที่ 3 ===');
    }
  };

  // ===== STEP 3B: ส่งทดสอบโดยใส่ LINE User ID เอง =====
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
    addLog('step', '=== ทดสอบส่ง LINE (Manual User ID) ===');
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
      // สร้างข้อความ
      const message = `🏠 แจ้งค่าเช่าห้อง ${room?.room_number || 'N/A'}
      
📅 รอบบิล: ${payment?.due_date || 'N/A'}
💰 ยอดรวม: ${payment?.total_amount?.toLocaleString() || 0} บาท

📝 รายละเอียด:
- ค่าเช่า: ${payment?.rent_amount?.toLocaleString() || 0} บาท
- ค่าน้ำ: ${payment?.water_amount?.toLocaleString() || 0} บาท (${payment?.water_units || 0} หน่วย)
- ค่าไฟ: ${payment?.electricity_amount?.toLocaleString() || 0} บาท (${payment?.electricity_units || 0} หน่วย)
- ค่าส่วนกลาง: ${payment?.common_fee_amount?.toLocaleString() || 0} บาท

กรุณาชำระภายในวันที่ ${payment?.due_date || 'N/A'}
ขอบคุณครับ 🙏`;

      addLog('api', 'เรียก sendLineMessage API...');

      const response = await base44.functions.invoke('sendLineMessage', {
        to: testLineUserId.trim(),
        message: message
      });

      if (response.data.success) {
        addLog('success', 'ส่งสำเร็จ!');
        toast.success('ส่งทดสอบสำเร็จ!');
      } else {
        addLog('error', `ล้มเหลว: ${response.data.error}`);
        toast.error('ส่งล้มเหลว: ' + response.data.error);
      }
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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
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
                  ส่งแจ้งเตือน LINE
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <div className="text-xs text-slate-600 space-y-1 mb-4">
                  <p>🔍 ดึง Tenant, Room, Payment</p>
                  <p>🖼️ สร้างรูปถ้ายังไม่มี</p>
                  <p>💬 สร้างข้อความพร้อมรายละเอียด</p>
                  <p>📤 ส่งผ่าน sendBatchLineMessages</p>
                </div>
                <Button
                  onClick={handleSendBills}
                  disabled={sendingBills || paymentsToSend.length === 0}
                  className="w-full bg-orange-600 hover:bg-orange-700"
                >
                  {sendingBills ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังส่ง...</>
                  ) : (
                    <><Send className="w-4 h-4 mr-2" /> ส่ง LINE ({paymentsToSend.length})</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Preview Invoice Link */}
          <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-300 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-cyan-600" />
                🔗 ดูตัวอย่างใบแจ้งหนี้ (ไม่เปลือง Token)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <p className="text-sm text-slate-600">
                เลือกห้องเพื่อดูตัวอย่างใบแจ้งหนี้ผ่านลิงก์ Public โดยไม่ต้องส่ง LINE
              </p>
              
              <div>
                <Label className="text-xs text-slate-600">เลือกบิลที่ต้องการดู</Label>
                <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="เลือกบิล..." />
                  </SelectTrigger>
                  <SelectContent>
                    {payments.slice(0, 50).map(p => {
                      const room = rooms.find(r => r.id === p.room_id);
                      const tenant = tenants.find(t => t.id === p.tenant_id);
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          ห้อง {room?.room_number} - {tenant?.full_name || 'N/A'} - {p.total_amount?.toLocaleString()} บ.
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {selectedPaymentId && (
                <div className="p-3 bg-white rounded-lg border space-y-2">
                  <p className="text-xs text-slate-500">ลิงก์ใบแจ้งหนี้:</p>
                  <code className="block text-xs bg-slate-100 p-2 rounded break-all">
                    {`https://app-483eff6e.base44.app/PublicInvoice?id=${selectedPaymentId}&branch=${selectedBranchId}`}
                  </code>
                  <Button
                    onClick={() => window.open(`https://app-483eff6e.base44.app/PublicInvoice?id=${selectedPaymentId}&branch=${selectedBranchId}`, '_blank')}
                    className="w-full bg-cyan-600 hover:bg-cyan-700"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    เปิดดูใบแจ้งหนี้
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Manual LINE Test */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-300 shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-5 h-5 text-green-600" />
                🧪 ทดสอบส่ง LINE (ใส่ User ID เอง)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <p className="text-sm text-slate-600">
                ใช้สำหรับทดสอบส่งบิลไปยัง LINE User ID ที่ระบุเอง โดยไม่ต้องเชื่อมต่อกับผู้เช่าในระบบ
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-600">LINE User ID</Label>
                  <Input
                    placeholder="U1234567890abcdef..."
                    value={testLineUserId}
                    onChange={(e) => setTestLineUserId(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    หา User ID ได้จาก LINE Official Account Manager
                  </p>
                </div>
                
                <div>
                  <Label className="text-xs text-slate-600">เลือกบิลที่จะส่ง</Label>
                  <Select value={selectedPaymentId} onValueChange={setSelectedPaymentId}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="เลือกบิล..." />
                    </SelectTrigger>
                    <SelectContent>
                      {payments.slice(0, 30).map(p => {
                        const room = rooms.find(r => r.id === p.room_id);
                        return (
                          <SelectItem key={p.id} value={p.id}>
                            ห้อง {room?.room_number} - {p.total_amount?.toLocaleString()} บ. {p.invoice_image_url ? '🖼️' : ''}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                onClick={handleTestSendLine}
                disabled={sendingTestLine || !testLineUserId.trim() || !selectedPaymentId}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {sendingTestLine ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังส่ง...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> ส่งทดสอบ</>
                )}
              </Button>
            </CardContent>
          </Card>

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