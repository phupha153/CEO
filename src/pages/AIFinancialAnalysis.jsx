import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Brain, Loader2, RefreshCw, TrendingUp, DollarSign, AlertTriangle, Target, Lightbulb, BarChart3, CalendarIcon, Lock } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import PageHeader from "../components/shared/PageHeader";
import { parseISO, differenceInDays, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears, isWithinInterval, format } from "date-fns";
import { th } from "date-fns/locale";
import { createPageUrl } from "@/utils";

export default function AIFinancialAnalysis() {
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedBranchId, setSelectedBranchId] = useState(localStorage.getItem('selected_branch_id'));
  const [dateRangeType, setDateRangeType] = useState('this_month');
  const [customRange, setCustomRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // Multi-tenant safe: filter at DB level
      return await base44.entities.Room.filter({ branch_id: selectedBranchId }, '-room_number', 1000);
    },
    enabled: !!selectedBranchId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Payment.filter({ branch_id: selectedBranchId }, '-created_date', 10000);
    },
    enabled: !!selectedBranchId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Expense.filter({ branch_id: selectedBranchId }, '-date', 500);
    },
    enabled: !!selectedBranchId,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // Multi-tenant safe: filter at DB level
      return await base44.entities.Booking.filter({ branch_id: selectedBranchId }, '-created_date', 500);
    },
    enabled: !!selectedBranchId,
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // Multi-tenant safe: filter at DB level
      return await base44.entities.Tenant.filter({ branch_id: selectedBranchId }, '-created_date', 500);
    },
    enabled: !!selectedBranchId,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 60 * 60 * 1000,
  });

  const { data: allBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
  });

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
  const userAccessibleBranches = currentUser?.accessible_branches;
  const canViewAllBranches = userRole === 'developer' && (!userAccessibleBranches || userAccessibleBranches.length === 0);

  // กรองสาขาตามสิทธิ์
  const branches = React.useMemo(() => {
    if (canViewAllBranches) return allBranches;
    return allBranches.filter(b => userAccessibleBranches && userAccessibleBranches.includes(b.id));
  }, [allBranches, canViewAllBranches, userAccessibleBranches]);

  const getDateRange = () => {
    const now = new Date();
    switch(dateRangeType) {
      case 'this_month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'last_month':
        return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
      case 'this_year':
        return { from: startOfYear(now), to: endOfYear(now) };
      case 'last_year':
        return { from: startOfYear(subYears(now, 1)), to: endOfYear(subYears(now, 1)) };
      case 'custom':
        return customRange;
      default:
        return { from: startOfMonth(now), to: endOfMonth(now) };
    }
  };

  const dateRange = getDateRange();

  const dateRangeLabel = () => {
    switch(dateRangeType) {
      case 'this_month': return 'เดือนนี้';
      case 'last_month': return 'เดือนที่แล้ว';
      case 'this_year': return 'ปีนี้';
      case 'last_year': return 'ปีที่แล้ว';
      case 'custom': return `${format(dateRange.from, 'd MMM', { locale: th })} - ${format(dateRange.to, 'd MMM yyyy', { locale: th })}`;
      default: return 'เดือนนี้';
    }
  };

  const generateAnalysis = async () => {
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      
      // คำนวณค่าปรับ
      const lateFeeConfig = configs.find(c => c.key === 'late_payment_fee_per_day');
      const lateFeePerDay = lateFeeConfig ? parseFloat(lateFeeConfig.value) : 50;

      const calculateLateFee = (payment) => {
        if (!payment?.due_date || payment.status === 'paid' || lateFeePerDay === 0) return 0;
        try {
          const dueDate = parseISO(payment.due_date);
          const daysOverdue = differenceInDays(now, dueDate);
          return daysOverdue > 0 ? daysOverdue * lateFeePerDay : 0;
        } catch {
          return 0;
        }
      };

      // คำนวณสถิติ
      const totalOccupied = rooms.filter(r => r.status === 'occupied').length;
      const totalAvailable = rooms.filter(r => r.status === 'available').length;
      const occupancyRate = rooms.length > 0 ? ((totalOccupied / rooms.length) * 100).toFixed(1) : 0;

      // กรองตาม dateRange
      const paymentsInRange = payments.filter(p => {
        if (p.status !== 'paid' || !p.payment_date) return false;
        try {
          const paymentDate = parseISO(p.payment_date);
          return isWithinInterval(paymentDate, { start: dateRange.from, end: dateRange.to });
        } catch {
          return false;
        }
      });

      const totalRevenue = paymentsInRange.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      
      const pendingPayments = payments.filter(p => p.status !== 'paid');
      const totalPending = pendingPayments.reduce((sum, p) => sum + (p.total_amount || 0) + calculateLateFee(p), 0);
      
      const overduePayments = pendingPayments.filter(p => {
        if (!p.due_date) return false;
        try {
          return parseISO(p.due_date) < now;
        } catch {
          return false;
        }
      });

      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const profit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? ((profit / totalRevenue) * 100).toFixed(1) : 0;

      // คำนวณรายได้เฉลี่ยต่อห้อง
      const avgRevenuePerRoom = totalOccupied > 0 ? (totalRevenue / totalOccupied).toFixed(0) : 0;

      // หาลูกค้าที่จ่ายล่วงหน้า (ดูจาก booking ที่มี deposit_amount)
      const advancePaymentBookings = bookings.filter(b => b.deposit_amount && b.deposit_amount > 0);
      const totalAdvancePayment = advancePaymentBookings.reduce((sum, b) => sum + (b.deposit_amount || 0), 0);

      // รายได้ 6 เดือนย้อนหลัง
      const last6Months = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        
        const monthPayments = payments.filter(p => {
          if (p.status !== 'paid' || !p.payment_date) return false;
          try {
            const date = parseISO(p.payment_date);
            return date >= monthStart && date <= monthEnd;
          } catch {
            return false;
          }
        });

        const monthExpenses = expenses.filter(e => {
          if (!e.date) return false;
          try {
            const date = parseISO(e.date);
            return date >= monthStart && date <= monthEnd;
          } catch {
            return false;
          }
        });

        last6Months.push({
          revenue: monthPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0),
          expense: monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0)
        });
      }

      // ผู้เช่าใหม่และย้ายออก 3 เดือนล่าสุด
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const newTenants = tenants.filter(t => {
        if (!t.created_date) return false;
        try {
          return parseISO(t.created_date) >= threeMonthsAgo;
        } catch {
          return false;
        }
      }).length;

      const movedOut = bookings.filter(b => {
        if (b.status !== 'completed' || !b.check_out_date) return false;
        try {
          return parseISO(b.check_out_date) >= threeMonthsAgo;
        } catch {
          return false;
        }
      }).length;

      const selectedBranch = branches.find(b => b.id === selectedBranchId);

      const prompt = `คุณคือที่ปรึกษาทางการเงินหอพักที่อธิบายแบบคนธรรมดาฟังเข้าใจ

**ข้อมูลธุรกิจหอพัก ${selectedBranch ? `(สาขา ${selectedBranch.branch_name})` : ''}:**
- ช่วงเวลา: ${dateRangeLabel()}
- ห้องทั้งหมด: ${rooms.length} ห้อง (เข้าพัก ${totalOccupied}, ว่าง ${totalAvailable}, อัตรา ${occupancyRate}%)
- รายได้ (${dateRangeLabel()}): ${totalRevenue.toLocaleString()}฿ (จากผู้เช่า ${totalOccupied} ห้อง)
- รายได้เฉลี่ยต่อห้อง: ${avgRevenuePerRoom.toLocaleString()}฿/เดือน
- ค้างชำระ+ค่าปรับ: ${totalPending.toLocaleString()}฿ (${pendingPayments.length} รายการ)
- เกินกำหนด: ${overduePayments.length} รายการ
- ค่าใช้จ่าย: ${totalExpenses.toLocaleString()}฿
- กำไรสุทธิ: ${profit.toLocaleString()}฿ (${profitMargin}%)
- เงินล่วงหน้า: ${totalAdvancePayment.toLocaleString()}฿ จาก ${advancePaymentBookings.length} รายการ
- รายได้ 6 เดือนย้อนหลัง: ${last6Months.map((m, i) => `เดือน${6-i}: ${m.revenue.toLocaleString()}฿`).join(' | ')}
- ผู้เช่า 3 เดือน: เข้าใหม่ ${newTenants} คน | ย้ายออก ${movedOut} คน

---

**คำสั่ง: วิเคราะห์ตามโครงสร้าง 7 ข้อ ใช้ภาษาง่าย เห็นภาพ ไม่ใช้ศัพท์เทคนิค**

## 1) ภาพรวมรายได้ตอนนี้

อธิบายสั้น ๆ (4-5 ประโยค):
- เดือนหนึ่งหอพักนี้ได้เงินเข้ามาประมาณกี่บาท
- ห้องหนึ่งทำเงินให้กี่บาทต่อเดือนโดยเฉลี่ย
- เดือนนี้โตหรือลดกี่% เทียบเดือนก่อน พร้อมเหตุผลง่าย ๆ
- รายได้ที่แน่นอนแล้ว (ล็อกแน่น) VS รายได้เสี่ยงหายไป

---

## 2) วิเคราะห์ค่าใช้จ่าย

แบ่งเป็น 2 แบบ (3-4 ประโยค):
- **ค่าใช้จ่ายประจำ** (ลดยาก): เช่น เงินเดือน, อินเทอร์เน็ต, ค่านิติ
- **ค่าใช้จ่ายตามการใช้งาน** (ลดได้): เช่น ค่าน้ำ-ไฟ, ค่าซ่อม
- **กำไรสุทธิ**: สรุปว่า "เดือนหนึ่งเหลือจริง ๆ กี่บาท" และ "ทุก 100 บาทเหลือกำไรกี่บาท"

---

## 3) วิเคราะห์รายได้ล่วงหน้า

อธิบายสั้น ๆ (3-4 ประโยค):
- มีลูกค้าจ่ายล่วงหน้ากี่ราย รวมกี่บาท
- ช่วยเรื่องสภาพคล่องยังไง (ภาษาง่าย)
- ความเสี่ยง (เช่น ต้องคืนเงิน, บริหารไม่ดี)

---

## 4) จุดที่ทำเงินเพิ่มได้ทันที

เสนอเป็นข้อ ๆ สั้น ๆ (4-5 ข้อ):
- ขึ้นราคาได้ที่ไหน
- แพ็กเกจเสริมอะไรขายได้
- ส่วนลดจ่ายรายปี
- โอกาสที่ยังไม่ได้ใช้

---

## 5) คาดการณ์รายได้อนาคต

คาดการณ์สั้น ๆ:
- อีก 3 เดือน: [ตัวเลข]
- อีก 6 เดือน: [ตัวเลข]
- อีก 12 เดือน: [ตัวเลข]
- วาดกราฟด้วยคำพูด

---

## 6) วิเคราะห์จุดเสี่ยง

เตือนตรงไปตรงมา (3-4 ข้อ):
- อัตราย้ายออกสูงไหม
- รายได้กระจุกกลุ่มเดียวไหม
- ห้องรายได้ไม่นิ่งกี่ห้อง
- เสี่ยงเงินสดหมุนไม่ทันไหม

---

## 7) แผนลงมือทำ

**5 อย่างเพิ่มรายได้ทันที:**
1. [ข้อแนะนำพร้อมตัวเลข]
2. ...

**5 อย่างลดความเสี่ยง:**
1. [ข้อแนะนำ]
2. ...

**5 อย่างลดค่าใช้จ่าย:**
1. [ข้อแนะนำ]
2. ...

**วิธีเพิ่มรายได้ล่วงหน้า:** [2-3 ข้อ]

**วิธีทำให้รายได้โต 20-50%:** [2-3 ข้อ]

---

**สรุป 1 หน้า:**
[สรุปสั้น ๆ แบบคุยกับเจ้าของหอ 4-5 ประโยค]

---

**ข้อกำหนด:**
- ใช้ภาษาคนธรรมดา ไม่ใช้ MRR/ARPU (ถ้าจำเป็นต้องใช้ให้ใส่วงเล็บแปล)
- ยกตัวเลขตัวอย่างให้เห็นภาพจริง
- ประโยคสั้น ชัดเจน ตรงไปตรงมา
- รวมทั้งหมดไม่เกิน 2 หน้า A4`;

      // Add retry logic for LLM timeout
      let response;
      let retries = 3;
      while (retries > 0) {
        try {
          response = await Promise.race([
            base44.integrations.Core.InvokeLLM({
              prompt: prompt,
              add_context_from_internet: false
            }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('LLM timeout')), 30000) // 30s timeout
            )
          ]);
          break;
        } catch (err) {
          retries--;
          if (retries === 0) throw err;
          await new Promise(r => setTimeout(r, 1000 * (4 - retries))); // backoff
        }
      }

      setAnalysis(response);
    } catch (err) {
      console.error('AI Analysis error:', err);
      setError(err?.message || 'ไม่สามารถวิเคราะห์ได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rooms.length > 0 && payments.length > 0) {
      generateAnalysis();
    }
  }, [rooms.length, payments.length, selectedBranchId, dateRangeType, customRange.from, customRange.to]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-100 via-pink-50 to-blue-100">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <PageHeader 
        title="พัฒนา AI - วิเคราะห์การเงิน" 
        subtitle="วิเคราะห์รายได้ ค่าใช้จ่าย และรายได้ล่วงหน้าแบบเข้าใจง่าย"
        icon={Brain}
        actions={
          !loading && analysis && (
            <Button
              onClick={generateAnalysis}
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              วิเคราะห์ใหม่
            </Button>
          )
        }
      />

      <div className="px-3 md:px-8 py-4 md:py-6 relative z-10">
        <div className="max-w-5xl mx-auto">

          {/* Filters Card */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 md:mb-6">
            <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-xl rounded-2xl md:rounded-3xl overflow-hidden">
              <CardContent className="p-3 md:p-6">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                  
                  {/* Branch Selector */}
                  <div className="flex flex-col gap-1.5 md:gap-2">
                    <label className="text-xs md:text-sm font-semibold text-slate-700">เลือกสาขา</label>
                    <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                      <SelectTrigger className="bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl">
                        <SelectValue placeholder="เลือกสาขา" />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map(branch => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.branch_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date Range Selector */}
                  <div className="flex flex-col gap-1.5 md:gap-2">
                    <label className="text-xs md:text-sm font-semibold text-slate-700">ช่วงเวลา</label>
                    <div className="flex gap-2 flex-col md:flex-row">
                      <Select value={dateRangeType} onValueChange={setDateRangeType}>
                        <SelectTrigger className="bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="this_month">เดือนนี้</SelectItem>
                          <SelectItem value="last_month">เดือนที่แล้ว</SelectItem>
                          <SelectItem value="this_year">ปีนี้</SelectItem>
                          <SelectItem value="last_year">ปีที่แล้ว</SelectItem>
                          <SelectItem value="custom">กำหนดเอง</SelectItem>
                        </SelectContent>
                      </Select>

                      {dateRangeType === 'custom' && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="gap-2 bg-white/90">
                              <CalendarIcon className="w-4 h-4" />
                              เลือกวันที่
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                              mode="range"
                              selected={customRange}
                              onSelect={setCustomRange}
                              numberOfMonths={2}
                              locale={th}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-3xl bg-white/50 backdrop-blur-xl border border-white/60 shadow-2xl"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-400/10 via-pink-300/10 to-blue-400/10" />
            
            <div className="relative z-10 p-6 md:p-8">
              
              {loading && (
                <div className="flex flex-col items-center justify-center py-20">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-full blur-2xl opacity-30 animate-pulse" />
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-purple-400/30 via-pink-400/30 to-blue-400/30 backdrop-blur-xl border border-white/40 shadow-2xl flex items-center justify-center">
                      <Brain className="w-10 h-10 text-purple-600 animate-pulse" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-700 mb-2">AI กำลังวิเคราะห์การเงิน...</h3>
                  <p className="text-sm text-slate-500">กรุณารอสักครู่</p>
                </div>
              )}

              {error && !loading && (
                <div className="bg-red-500/10 rounded-2xl border border-red-300/50 p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-red-900 mb-1">เกิดข้อผิดพลาด</h4>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {analysis && !loading && (
                <div className="prose prose-slate max-w-none">
                  <ReactMarkdown
                    components={{
                      h1: ({children}) => <h1 className="text-2xl font-bold text-slate-800 mb-4 mt-6 first:mt-0">{children}</h1>,
                      h2: ({children}) => (
                        <div className="flex items-center gap-3 mt-8 mb-4 first:mt-0">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg flex-shrink-0">
                            {children.toString().includes('1)') && <TrendingUp className="w-5 h-5 text-white" />}
                            {children.toString().includes('2)') && <BarChart3 className="w-5 h-5 text-white" />}
                            {children.toString().includes('3)') && <DollarSign className="w-5 h-5 text-white" />}
                            {children.toString().includes('4)') && <Target className="w-5 h-5 text-white" />}
                            {children.toString().includes('5)') && <TrendingUp className="w-5 h-5 text-white" />}
                            {children.toString().includes('6)') && <AlertTriangle className="w-5 h-5 text-white" />}
                            {children.toString().includes('7)') && <Lightbulb className="w-5 h-5 text-white" />}
                          </div>
                          <h2 className="text-xl font-bold text-slate-800 m-0">{children}</h2>
                        </div>
                      ),
                      h3: ({children}) => <h3 className="text-lg font-semibold text-slate-700 mt-6 mb-3">{children}</h3>,
                      p: ({children}) => <p className="text-slate-700 leading-relaxed mb-3">{children}</p>,
                      ul: ({children}) => <ul className="space-y-2 mb-4">{children}</ul>,
                      ol: ({children}) => <ol className="space-y-2 mb-4">{children}</ol>,
                      li: ({children}) => (
                        <li className="text-slate-700 leading-relaxed pl-2">
                          <span className="inline-block w-2 h-2 bg-purple-500 rounded-full mr-2" />
                          {children}
                        </li>
                      ),
                      strong: ({children}) => <strong className="font-bold text-slate-800">{children}</strong>,
                      blockquote: ({children}) => (
                        <blockquote className="border-l-4 border-purple-500 pl-4 py-2 my-4 bg-purple-50/50 rounded-r-lg">
                          {children}
                        </blockquote>
                      ),
                      hr: () => <hr className="my-6 border-slate-200" />,
                    }}
                  >
                    {analysis}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}