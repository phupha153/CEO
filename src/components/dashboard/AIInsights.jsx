import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, TrendingUp, AlertTriangle, DollarSign, Brain, Loader2, TrendingDown, Check, BarChart3, RefreshCw, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import { useQuery } from "@tanstack/react-query";

export default function AIInsights({
  payments = [],
  expenses = [],
  maintenanceRequests = [],
  tenants = [],
  rooms = [],
  bookings = [],
  branches = [],
  materialDeliveries = [],
  dateRangeLabel = "เดือนนี้",
  dateRange,
  configs = []
}) {
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
  });

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'developer' : 'employee');

  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedAlerts, setExpandedAlerts] = useState(false);
  const [expandedForecast, setExpandedForecast] = useState(false);

  useEffect(() => {
    // ✅ ตรวจสอบว่ามีข้อมูลพร้อมก่อนเรียก API
    if (rooms.length > 0 && payments.length > 0) {
      generateInsights();
    }
  }, [payments.length, expenses.length, maintenanceRequests.length, tenants.length, rooms.length, bookings.length, branches.length, materialDeliveries.length, dateRangeLabel]);

  const generateInsights = async () => {
    // ✅ ป้องกันการเรียกซ้ำถ้ายังโหลดอยู่
    if (loading && insights) return;

    setLoading(true);
    setError(null);

    try {
      // ✅ เพิ่มการตรวจสอบข้อมูลขั้นต่ำ
      if (!rooms || rooms.length === 0) {
        throw new Error('ไม่มีข้อมูลห้องพักเพียงพอสำหรับการวิเคราะห์');
      }

      const last6MonthsRevenue = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const monthPayments = payments.filter(p => {
          if (p.status !== 'paid' || !p.payment_date) return false;
          try {
            const paymentDate = parseISO(p.payment_date);
            return paymentDate >= monthStart && paymentDate <= monthEnd;
          } catch {
            return false;
          }
        });

        const monthExpenses = expenses.filter(e => {
          if (!e.date) return false;
          try {
            const expenseDate = parseISO(e.date);
            return expenseDate >= monthStart && expenseDate <= monthEnd;
          } catch {
            return false;
          }
        });

        const revenue = monthPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
        const expense = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

        last6MonthsRevenue.push({
          month: `เดือน ${6-i}`,
          revenue,
          expense,
          profit: revenue - expense
        });
      }

      const revenueValues = last6MonthsRevenue.map(m => m.revenue);
      const revenueIncreasing = revenueValues.slice(1).every((val, i) => val >= revenueValues[i]);
      const revenueDecreasing = revenueValues.slice(1).every((val, i) => val <= revenueValues[i]);
      let trend = "ผันแปร";
      if (revenueIncreasing) trend = "เพิ่มขึ้นอย่างต่อเนื่อง";
      else if (revenueDecreasing) trend = "ลดลงอย่างต่อเนื่อง";

      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const newTenants = tenants.filter(t => {
        if (!t.created_date) return false;
        try {
          return parseISO(t.created_date) >= threeMonthsAgo;
        } catch {
          return false;
        }
      }).length;

      const movedOutBookings = bookings.filter(b => {
        if (b.status !== 'completed' || !b.check_out_date) return false;
        try {
          return parseISO(b.check_out_date) >= threeMonthsAgo;
        } catch {
          return false;
        }
      }).length;

      const avgMonthlyExpense = last6MonthsRevenue.reduce((sum, m) => sum + m.expense, 0) / 6;

      // กรอง payments ตาม dateRange ก่อน (เหมือน Dashboard)
      const paymentsInRange = payments.filter(payment => {
        if (payment.status !== 'paid' || !payment.payment_date) return false;
        try {
          const paymentDate = parseISO(payment.payment_date);
          if (isNaN(paymentDate.getTime())) return false;
          return paymentDate >= dateRange.from && paymentDate <= dateRange.to;
        } catch {
          return false;
        }
      });
      
      const totalRevenue = paymentsInRange.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const overduePayments = payments.filter(p => {
        if (!p.due_date || p.status === 'paid') return false;
        try {
          return parseISO(p.due_date) < now;
        } catch {
          return false;
        }
      });
      const pendingPayments = payments.filter(p => p.status !== 'paid');
      
      // ดึงค่าปรับจาก config
      const lateFeeConfig = configs.find(c => c.key === 'late_payment_fee_per_day');
      const lateFeePerDay = lateFeeConfig ? parseFloat(lateFeeConfig.value) : 0;
      
      // ฟังก์ชันคำนวณค่าปรับจริงจากระบบ
      const calculateLateFee = (payment) => {
        if (!payment || !payment.due_date || payment.status === 'paid' || lateFeePerDay === 0) return 0;
        try {
          const dueDate = parseISO(payment.due_date);
          if (isNaN(dueDate.getTime())) return 0;
          const daysOverdue = differenceInDays(now, dueDate);
          return daysOverdue > 0 ? daysOverdue * lateFeePerDay : 0;
        } catch {
          return 0;
        }
      };
      
      const totalPendingAmount = pendingPayments.reduce((sum, p) => {
        const baseAmount = p.total_amount || 0;
        const lateFee = calculateLateFee(p);
        return sum + baseAmount + lateFee;
      }, 0);
      const potentialTotalRevenue = totalRevenue + totalPendingAmount;

      const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const urgentMaintenance = maintenanceRequests.filter(m => m.priority === 'urgent' || m.priority === 'high').length;
      const occupancyRate = rooms.length > 0 ? ((rooms.filter(r => r.status === 'occupied').length / rooms.length) * 100).toFixed(1) : 0;

      const totalOccupiedRooms = rooms.filter(r => r.status === 'occupied').length;
      const totalAvailableRooms = rooms.filter(r => r.status === 'available').length;
      const uniquePendingRooms = [...new Set(pendingPayments.map(p => p.room_id))].length;
      const overduePercentage = totalOccupiedRooms > 0 ? ((uniquePendingRooms / totalOccupiedRooms) * 100).toFixed(1) : 0;

      const isFullOccupancy = parseFloat(occupancyRate) >= 95;

      const unclaimedDeliveries = materialDeliveries.filter(d => {
        if (d.status === 'picked_up') return false;
        if (!d.delivery_date) return false;
        try {
          const deliveryDate = parseISO(d.delivery_date);
          const daysSince = differenceInDays(now, deliveryDate);
          return daysSince >= 3;
        } catch {
          return false;
        }
      });

      const roomsNeedACCleaning = rooms.filter(r => {
        if (!r.last_ac_cleaning_date) return false;
        try {
          const lastCleaningDate = parseISO(r.last_ac_cleaning_date);
          const daysSince = differenceInDays(now, lastCleaningDate);
          return daysSince >= 365;
        } catch {
          return false;
        }
      });

      const tenantOverdueCount = {};
      overduePayments.forEach(p => {
        if (p.tenant_id) {
          tenantOverdueCount[p.tenant_id] = (tenantOverdueCount[p.tenant_id] || 0) + 1;
        }
      });
      const highRiskTenants = Object.entries(tenantOverdueCount)
        .filter(([_, count]) => count >= 2)
        .map(([tenantId, count]) => {
          const tenant = tenants.find(t => t.id === tenantId);
          const payment = payments.find(p => p.tenant_id === tenantId);
          const branch = branches.find(b => b.id === tenant?.branch_id || payment?.branch_id);
          return {
            name: tenant?.full_name || 'ไม่ระบุ',
            count,
            branchName: branch?.branch_name || 'ไม่ระบุสาขา'
          };
        });

      const branchAnalysis = branches.map(branch => {
        const branchPayments = payments.filter(p => p.branch_id === branch.id);
        const branchExpenses = expenses.filter(e => e.branch_id === branch.id);
        const branchMaintenance = maintenanceRequests.filter(m => m.branch_id === branch.id);
        const branchRooms = rooms.filter(r => r.branch_id === branch.id);
        const branchDeliveries = materialDeliveries.filter(d => d.branch_id === branch.id);

        const branchRevenue = branchPayments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.total_amount || 0), 0);
        const branchPending = branchPayments.filter(p => p.status !== 'paid');
        const branchOverdue = branchPayments.filter(p => {
          if (!p.due_date || p.status === 'paid') return false;
          try {
            return parseISO(p.due_date) < now;
          } catch {
            return false;
          }
        });
        const branchExpenseTotal = branchExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        const branchOccupancy = branchRooms.length > 0 ? ((branchRooms.filter(r => r.status === 'occupied').length / branchRooms.length) * 100).toFixed(1) : 0;
        const branchUrgentMaintenance = branchMaintenance.filter(m => m.priority === 'urgent' || m.priority === 'high').length;

        const branchOccupiedRooms = branchRooms.filter(r => r.status === 'occupied').length;
        const branchAvailableRooms = branchRooms.filter(r => r.status === 'available').length;
        const branchPendingRooms = [...new Set(branchPending.map(p => p.room_id))].length;
        const branchOverduePercentage = branchOccupiedRooms > 0 ? ((branchPendingRooms / branchOccupiedRooms) * 100).toFixed(1) : 0;

        const branchUnclaimedDeliveries = branchDeliveries.filter(d => {
          if (d.status === 'picked_up') return false;
          if (!d.delivery_date) return false;
          try {
            const deliveryDate = parseISO(d.delivery_date);
            const daysSince = differenceInDays(now, deliveryDate);
            return daysSince >= 3;
          } catch {
            return false;
          }
        });

        const branchACCleaning = branchRooms.filter(r => {
          if (!r.last_ac_cleaning_date) return false;
          try {
            const lastCleaningDate = parseISO(r.last_ac_cleaning_date);
            const daysSince = differenceInDays(now, lastCleaningDate);
            return daysSince >= 365;
          } catch {
            return false;
          }
        });

        return {
          id: branch.id,
          name: branch.branch_name,
          revenue: branchRevenue,
          expenses: branchExpenseTotal,
          profit: branchRevenue - branchExpenseTotal,
          profitMargin: branchRevenue > 0 ? ((branchRevenue - branchExpenseTotal) / branchRevenue * 100).toFixed(1) : 0,
          pendingCount: branchPending.length,
          pendingAmount: branchPending.reduce((sum, p) => sum + (p.total_amount || 0), 0),
          pendingPayments: branchPending,
          overdueCount: branchOverdue.length,
          overdueAmount: branchOverdue.reduce((sum, p) => sum + (p.total_amount || 0), 0),
          overduePayments: branchOverdue,
          overduePercentage: branchOverduePercentage,
          occupancy: branchOccupancy,
          totalRooms: branchRooms.length,
          occupiedRooms: branchOccupiedRooms,
          availableRooms: branchAvailableRooms,
          urgentMaintenance: branchUrgentMaintenance,
          totalMaintenance: branchMaintenance.length,
          unclaimedDeliveries: branchUnclaimedDeliveries.length,
          acCleaningNeeded: branchACCleaning.length
        };
        });

      const revenueHistory = last6MonthsRevenue.map(m =>
        `${m.month}: รายได้ ${m.revenue.toLocaleString()}฿, ค่าใช้จ่าย ${m.expense.toLocaleString()}฿, กำไร ${m.profit.toLocaleString()}฿`
      ).join('\n');

      const prompt = `คุณคือ "Smart Dorm AI" - นักวิเคราะห์ธุรกิจหอพักที่อธิบายแบบคนธรรมดาฟังเข้าใจ 🧠

**วิเคราะห์ข้อมูล (${dateRangeLabel}):**
- ห้อง: ${rooms.length} ห้อง (เข้าพัก ${totalOccupiedRooms}, ว่าง ${totalAvailableRooms}, อัตรา ${occupancyRate}%)
- รายได้ (ชำระแล้ว): ${totalRevenue.toLocaleString()}฿
- **ค้างชำระ+ค่าปรับ: ${totalPendingAmount.toLocaleString()}฿ (${pendingPayments.length} รายการ)**
- ค่าใช้จ่าย: ${totalExpenses.toLocaleString()}฿ | กำไร: ${(totalRevenue - totalExpenses).toLocaleString()}฿
- **เกินกำหนด: ${overduePayments.length} รายการ (${overduePayments.reduce((sum, p) => sum + (p.total_amount || 0), 0).toLocaleString()}฿ + ค่าปรับ ${overduePayments.reduce((sum, p) => sum + (calculateLateFee ? calculateLateFee(p) : 0), 0).toLocaleString()}฿)**
- แนวโน้ม 6 เดือน: ${trend}
- ผู้เช่า 3 เดือน: เข้าใหม่ ${newTenants} | ย้ายออก ${movedOutBookings}

${branches.length > 0 ? `\n**ข้อมูลแต่ละสาขา (${branches.length} สาขา):**\n${branchAnalysis.map((b, idx) => {
  const lateFee = b.pendingPayments ? b.pendingPayments.reduce((sum, p) => sum + (calculateLateFee ? calculateLateFee(p) : 0), 0) : 0;
  return `**${idx + 1}. ${b.name}:** รายได้ ${b.revenue.toLocaleString()}฿ | ค้างชำระ ${b.pendingCount} รายการ (${b.pendingAmount.toLocaleString()}฿ + ค่าปรับ ${lateFee.toLocaleString()}฿) | อัตราเข้าพัก ${b.occupancy}%`;
}).join('\n')}` : ''}

---

**คำสั่ง: ให้วิเคราะห์สั้น ๆ กระชับ เน้นประเด็นสำคัญ**

**ส่วนที่ 1: แจ้งเตือนปัญหาเร่งด่วน (ถ้ามี)**

ตรวจสอบทุกสาขาตามเกณฑ์: ขาดทุน / ค้างชำระสูง (≥50,000฿) / เกินกำหนด (≥2 รายการ) / ห้องว่างมาก (>25%)

**รูปแบบ (ไม่เกิน 2 บรรทัดต่อปัญหา):**
- 🚨 สาขา [ชื่อ]: **[ปัญหา]** [ตัวเลข]฿ - [สาเหตุสั้น ๆ]

**ถ้าไม่มีปัญหา:** ไม่ต้องเขียนอะไร

---

**ส่วนที่ 2: คาดการณ์รายได้และคำแนะนำ (ห้ามข้าม - ต้องตอบครบ 4 ข้อ)**

- 💰 รายได้คาดการณ์เดือนหน้า: [ตัวเลข] บาท

- 📈 เปอร์เซ็นต์เปลี่ยนแปลง: [+/-]% (เทียบกับ ${potentialTotalRevenue.toLocaleString()}฿)

- 📋 สาเหตุ 3 ข้อหลัก: [สั้น ๆ ชัดเจน]

- 💡 คำแนะนำ 3-4 ข้อ: [actionable พร้อมตัวเลข เช่น "ติดตามค้างชำระ 5 รายแรก ได้คืน 50,000฿"]`;

      // ✅ เพิ่ม timeout สำหรับ API call
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('การวิเคราะห์ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง')), 45000)
      );

      const apiPromise = base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        add_context_from_internet: false
      });

      const response = await Promise.race([apiPromise, timeoutPromise]);

      console.log('========== AI RESPONSE ==========');
      console.log(response);
      console.log('=================================');

      setInsights(response);

    } catch (err) {
      console.error('AI Insights error:', err);
      const errorMessage = err?.message || err?.toString() || 'ไม่สามารถเชื่อมต่อกับ AI ได้';
      setError(errorMessage);
      
      // ✅ ไม่แสดง toast error เพราะจะมี error display ใน UI อยู่แล้ว
      console.log('Error details:', { 
        message: err.message, 
        name: err.name, 
        stack: err.stack?.substring(0, 200) 
      });
    } finally {
      setLoading(false);
    }
  };

  const askAIAboutAlert = (alertText) => {
    const event = new CustomEvent('openAIChatWithMessage', {
      detail: {
        message: `ช่วยอธิบายเพิ่มเติมเกี่ยวกับการแจ้งเตือนนี้: "${alertText}"`
      }
    });
    window.dispatchEvent(event);

    toast.success('เปิด AI Chat แล้ว', {
      description: 'กำลังถามคำถามไปยัง AI...'
    });
  };

  const askAIAboutForecast = (forecastText) => {
    const event = new CustomEvent('openAIChatWithMessage', {
      detail: {
        message: `ช่วยอธิบายเพิ่มเติมเกี่ยวกับการคาดการณ์นี้: "${forecastText}"`
      }
    });
    window.dispatchEvent(event);

    toast.success('เปิด AI Chat แล้ว', {
      description: 'กำลังถามคำถามไปยัง AI...'
    });
  };

  const parseInsights = (content) => {
    if (!content) return { alertLines: [], forecastLines: [] };

    console.log('========== PARSING INSIGHTS ==========');
    console.log('Content length:', content.length);
    console.log('Content preview:', content.substring(0, 500));

    const lines = content.split('\n').map(line => line.trimEnd());
    const alertLines = [];
    const forecastLines = [];
    let isInForecastSection = false;
    let currentForecastItem = null;

    const removeEmojis = (text) => {
      return text
        .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
        .replace(/[\u{2600}-\u{27BF}]/gu, '')
        .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
        .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
        .replace(/[\u{2700}-\u{27BF}]/gu, '')
        .replace(/🚨|💰|📊|📈|📉|📋|💡|⚠️|✅|❌|🏢|🔧|📦|💨/g, '')
        .replace(/🧠|🎯|💸|🏚️|🌬️/g, '')
        .trim();
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (
        trimmed.includes('ส่วนที่ 2') ||
        trimmed.includes('การคาดการณ์รายได้') ||
        trimmed.includes('คาดการณ์รายได้') ||
        (trimmed.includes('💰') && (trimmed.includes('รายได้') || trimmed.includes('คาดการณ์')))
      ) {
        console.log('Found forecast section at line:', i, trimmed);
        isInForecastSection = true;
        continue;
      }

      if (isInForecastSection) {
        if (trimmed.startsWith('-') && (
          trimmed.includes('💰') || trimmed.includes('📊') || trimmed.includes('📈') || 
          trimmed.includes('📉') || trimmed.includes('📋') || trimmed.includes('💡') ||
          trimmed.includes('รายได้คาดการณ์') || trimmed.includes('เทียบกับ') ||
          trimmed.includes('เปอร์เซ็นต์') || trimmed.includes('สาเหตุ') || 
          trimmed.includes('คำแนะนำ') || /\d+.*บาท/.test(trimmed) || /%/.test(trimmed)
        )) {
          if (currentForecastItem) {
            const cleanItem = removeEmojis(currentForecastItem);
            if (cleanItem && cleanItem.length > 5) {
              forecastLines.push(cleanItem);
              console.log('Added forecast line:', cleanItem.substring(0, 100));
            }
          }

          currentForecastItem = trimmed.replace(/^-\s*/, '');
          
          let j = i + 1;
          while (j < lines.length) {
            const nextLine = lines[j];
            const nextLineTrimmed = nextLine.trim();
            
            if (nextLineTrimmed.startsWith('-') && (
              nextLineTrimmed.includes('💰') || nextLineTrimmed.includes('📊') || nextLineTrimmed.includes('📈') ||
              nextLineTrimmed.includes('📉') || nextLineTrimmed.includes('📋') || nextLineTrimmed.includes('💡')
            )) {
              break;
            }
            
            if (!nextLineTrimmed) {
              j++;
              continue;
            }
            
            if (!nextLineTrimmed.startsWith('-') || nextLineTrimmed.startsWith('  -') || /^\d+\./.test(nextLineTrimmed)) {
              currentForecastItem += ' ' + nextLineTrimmed;
              i = j;
              j++;
            } else {
              break;
            }
          }
        }
      } else {
        if (trimmed.startsWith('-') && trimmed.includes('🚨')) {
          const cleanLine = removeEmojis(trimmed.replace(/^-\s*/, ''));
          if (cleanLine && cleanLine.length > 3) {
            alertLines.push(cleanLine);
          }
        }
      }
    }

    if (currentForecastItem) {
      const cleanItem = removeEmojis(currentForecastItem);
      if (cleanItem && cleanItem.length > 5) {
        forecastLines.push(cleanItem);
        console.log('Added final forecast line:', cleanItem.substring(0, 100));
      }
    }

    console.log('Total alert lines:', alertLines.length);
    console.log('Total forecast lines:', forecastLines.length);
    console.log('======================================');

    return { alertLines, forecastLines };
  };

  const { alertLines, forecastLines } = parseInsights(insights);

  if (userRole !== 'developer') {
    return null;
  }

  return (
    <div className="relative">
      <div className="relative overflow-hidden rounded-3xl bg-white/40 backdrop-blur-xl border border-white/50 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 via-pink-300/20 to-blue-400/20 animate-pulse" style={{ animationDuration: '3s' }} />
        
        <div className="relative z-10 p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl blur-xl opacity-50 animate-pulse" />
                <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-600 via-pink-500 to-blue-600 flex items-center justify-center shadow-lg">
                  <Brain className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 bg-clip-text text-transparent">
                    Smart Dorm AI
                  </h3>
                  <Badge className="bg-gradient-to-r from-orange-500 to-pink-500 text-white text-xs px-2 py-0.5 border-0 shadow-md">
                    Beta
                  </Badge>
                </div>
                <p className="text-sm text-slate-600">วิเคราะห์อัตโนมัติด้วย AI</p>
              </div>
            </motion.div>
            {!loading && insights && (
              <Button
                onClick={() => generateInsights()}
                size="sm"
                className="bg-white/80 hover:bg-white text-slate-700 border-0 shadow-lg backdrop-blur-sm"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                วิเคราะห์ใหม่
              </Button>
            )}
          </div>

          <AnimatePresence mode="wait">
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16"
              >
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500 rounded-full blur-2xl opacity-30 animate-pulse" />
                  
                  <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-purple-400/30 via-pink-400/30 to-blue-400/30 backdrop-blur-xl border border-white/40 shadow-2xl flex items-center justify-center">
                    <div className="absolute inset-4 rounded-full bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-blue-500/20 animate-spin" style={{ animationDuration: '3s' }} />
                    
                    <Brain className="w-12 h-12 text-purple-600 relative z-10 animate-pulse" />
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-slate-700 mb-2">AI กำลังวิเคราะห์...</h3>
                <p className="text-sm text-slate-500 text-center max-w-xs mb-3">
                  กำลังประมวลผลข้อมูล 6 เดือนและแนวโน้มธุรกิจ
                </p>
                <p className="text-xs text-slate-400 text-center max-w-md opacity-70">
                  ข้อมูลเป็นการวิเคราะห์เบื้องต้น ควรใช้เป็นข้อมูลอ้างอิงประกอบการตัดสินใจ
                </p>
              </motion.div>
            )}

            {error && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <div className="bg-red-500/10 backdrop-blur-sm rounded-2xl border border-red-300/50 p-6">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900 mb-1">ไม่สามารถวิเคราะห์ได้</h4>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {insights && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* แสดง Raw Response ถ้า parse ไม่ได้ */}
                {alertLines.length === 0 && forecastLines.length === 0 && (
                  <div className="bg-blue-500/10 backdrop-blur-sm rounded-2xl border border-blue-300/50 p-6">
                    <div className="flex items-start gap-3 mb-3">
                      <Brain className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-blue-800 mb-1">
                          ผลการวิเคราะห์จาก AI
                        </p>
                        <p className="text-xs text-blue-700">
                          (ไม่สามารถจัดรูปแบบได้ - แสดงข้อมูลดิบ)
                        </p>
                      </div>
                    </div>
                    <div className="prose prose-sm max-w-none text-slate-700">
                      <ReactMarkdown>{insights}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* การแจ้งเตือนความผิดปกติ */}
                {alertLines.length > 0 && (
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500/10 via-orange-400/10 to-red-500/10 backdrop-blur-sm border border-red-300/30 shadow-xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-400/5 to-orange-400/5" />
                    
                    <div className="relative z-10">
                      <div 
                        className="p-4 cursor-pointer hover:bg-red-50/30 transition-colors"
                        onClick={() => setExpandedAlerts(!expandedAlerts)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg">
                              <AlertTriangle className="w-5 h-5 text-white" />
                            </div>
                            <h4 className="text-base font-bold text-red-900">
                              การแจ้งเตือนความผิดปกติ ({alertLines.length})
                            </h4>
                          </div>
                          <Button variant="ghost" size="sm" className="text-red-700">
                            {expandedAlerts ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </Button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {expandedAlerts && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="px-6 pb-6"
                          >
                            <div className="space-y-2">
                              {alertLines.map((line, idx) => (
                                <motion.div
                                  key={idx}
                                  initial={{ opacity: 0, x: -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                  onClick={() => askAIAboutAlert(line)}
                                  className="group p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-red-200/50 hover:border-red-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                                >
                                  <div className="flex items-start gap-3">
                                    <AlertTriangle className="w-4 h-4 mt-0.5 text-red-600 flex-shrink-0" />
                                    <span className="flex-1 text-sm font-medium text-red-900 leading-relaxed">{line}</span>
                                    <MessageCircle className="w-4 h-4 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                  </div>
                                </motion.div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}

                {/* การคาดการณ์รายได้ */}
                {forecastLines.length > 0 ? (
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500/10 via-green-400/10 to-teal-500/10 backdrop-blur-sm border border-green-300/30 shadow-xl">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/5 to-teal-400/5" />
                    
                    <div className="relative z-10">
                      <div 
                        className="p-4 cursor-pointer hover:bg-green-50/30 transition-colors"
                        onClick={() => setExpandedForecast(!expandedForecast)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg">
                              <DollarSign className="w-5 h-5 text-white" />
                            </div>
                            <h4 className="text-base font-bold text-green-900">
                              การคาดการณ์รายได้ ({forecastLines.length} รายการ)
                            </h4>
                          </div>
                          <Button variant="ghost" size="sm" className="text-green-700">
                            {expandedForecast ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </Button>
                        </div>
                      </div>

                      <AnimatePresence>
                        {expandedForecast && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            className="px-6 pb-6"
                          >
                            <div className="space-y-2">
                              {forecastLines.map((line, idx) => {
                                let icon = null;
                                let iconColor = "text-green-600";

                                if (line.includes('รายได้คาดการณ์')) {
                                  icon = <DollarSign className="w-4 h-4" />;
                                  iconColor = "text-emerald-600";
                                } else if (line.includes('เทียบกับ')) {
                                  icon = <BarChart3 className="w-4 h-4" />;
                                  iconColor = "text-blue-600";
                                } else if (line.includes('เพิ่ม') || (line.includes('เปอร์เซ็นต์') && line.includes('+'))) {
                                  icon = <TrendingUp className="w-4 h-4" />;
                                  iconColor = "text-green-600";
                                } else if (line.includes('ลด') || line.includes('-')) {
                                  icon = <TrendingDown className="w-4 h-4" />;
                                  iconColor = "text-orange-600";
                                } else if (line.includes('สาเหตุ')) {
                                  icon = <BarChart3 className="w-4 h-4" />;
                                  iconColor = "text-indigo-600";
                                } else if (line.includes('คำแนะนำ')) {
                                  icon = <Brain className="w-4 h-4" />;
                                  iconColor = "text-purple-600";
                                }

                                return (
                                  <motion.div
                                    key={idx}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => askAIAboutForecast(line)}
                                    className="group p-4 rounded-xl bg-white/60 backdrop-blur-sm border border-green-200/50 hover:border-green-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] transition-all duration-200"
                                  >
                                    <div className="flex items-start gap-3">
                                      {icon && <div className={`mt-0.5 flex-shrink-0 ${iconColor}`}>{icon}</div>}
                                      <span className="flex-1 text-sm font-medium text-green-900 leading-relaxed">{line}</span>
                                      <MessageCircle className="w-4 h-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                ) : (
                  insights && !loading && (
                    <div className="bg-yellow-500/10 backdrop-blur-sm rounded-2xl border border-yellow-300/50 p-6">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-yellow-800 mb-1">
                            ไม่พบการคาดการณ์รายได้
                          </p>
                          <p className="text-xs text-yellow-700">
                            ลองกดปุ่ม "วิเคราะห์ใหม่" หรือรอสักครู่แล้วลองใหม่
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}