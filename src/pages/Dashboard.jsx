import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, DoorOpen, Users, Wallet, TrendingUp, ArrowUpRight, ArrowDownRight, AlertTriangle, RefreshCw, Loader2, CreditCard, Database, Trash2, Bug, X, Link2, ExternalLink, Copy } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears, isWithinInterval, parseISO, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { toast } from "sonner";
import PageHeader from "../components/shared/PageHeader";
import ScrollToTopButton from "../components/shared/ScrollToTopButton";
import { LayoutDashboard } from "lucide-react";
import AIInsights from "../components/dashboard/AIInsights";
import OnboardingStartButton from "../components/onboarding/OnboardingStartButton";

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dateRangeType, setDateRangeType] = useState('this_month');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [customRange, setCustomRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [compareRange, setCompareRange] = useState({
    from: startOfMonth(subMonths(new Date(), 1)),
    to: endOfMonth(subMonths(new Date(), 1))
  });
  
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [viewMode, setViewMode] = useState('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
  const [showDebugDialog, setShowDebugDialog] = useState(false);
  const [showDeleteBranchDataDialog, setShowDeleteBranchDataDialog] = useState(false);
  const [isCancellingDelete, setIsCancellingDelete] = useState(false);

  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name');

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 4 * 60 * 60 * 1000,
  });

  const userRole = useMemo(() => 
    currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee'),
    [currentUser]
  );

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
  };

  // 🔒 Security: Get current date from config (supports time travel testing)
  const getCurrentDate = () => {
    const testDateConfig = configs.find(c => c.key === 'test_current_date');
    if (testDateConfig && testDateConfig.value) {
      try {
        const date = parseISO(testDateConfig.value);
        if (isNaN(date.getTime())) return new Date();
        return date;
      } catch {
        return new Date();
      }
    }
    return new Date();
  };

  const { data: configs = [] } = useQuery({
    queryKey: ['configs', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allConfigs = await base44.entities.Config.list('', 1000);
      return allConfigs.filter(c => !c.branch_id || c.branch_id === selectedBranchId);
    },
    enabled: !!currentUser && !!selectedBranchId,
    ...retryConfig,
    staleTime: 4 * 60 * 60 * 1000,
    gcTime: 8 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const generateTestDataMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateCustomTestData', {
        branch_id: selectedBranchId,
        totalRecords: 1000,
        counts: {
          rooms: 50,
          tenants: 50,
          bookings: 50,
          payments: 600,
          meterReadings: 50,
          maintenance: 50
        }
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'สร้างข้อมูลทดสอบสำเร็จ!', { duration: 5000 });
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  });

  const deleteTestDataMutation = useMutation({
    mutationFn: async () => {
      toast.info('🗑️ กำลังลบข้อมูล...', { duration: 2000 });
      const response = await base44.functions.invoke('deleteTestDataWithProgress', {
        branch_id: selectedBranchId,
        batchSize: 1000,
        delayMs: 0,
        maxTimeSeconds: 110,
        maxItemsPerRun: 100000
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.needMoreRuns) {
        toast.warning(
          `⏰ ลบได้ ${data.totalDeleted} รายการ\n\n💡 กรุณากดลบอีกครั้งเพื่อลบข้อมูลที่เหลือ`, 
          { duration: 10000 }
        );
      } else {
        toast.success(`✅ ลบข้อมูลทดสอบสำเร็จ!\n\n🗑️ ลบไปทั้งหมด ${data.totalDeleted} รายการ`, {
          duration: 5000
        });
      }
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  });

  const deleteBranchDataMutation = useMutation({
    mutationFn: async ({ abortSignal }) => {
      toast.info('🗑️ กำลังลบข้อมูลทั้งหมดของสาขา...', { duration: 2000 });
      const response = await base44.functions.invoke('deleteTestDataForBranch', {
        branch_id: selectedBranchId,
        abortSignal
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.cancelled) {
        toast.warning(`⏸️ ยกเลิกการลบแล้ว`, { duration: 3000 });
      } else {
        toast.success(`✅ ${data.message}`, { duration: 5000 });
      }
      setShowDeleteBranchDataDialog(false);
      setIsCancellingDelete(false);
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`❌ เกิดข้อผิดพลาด: ${error.message}`);
      setIsCancellingDelete(false);
    }
  });

  const handleCancelDelete = async () => {
    setIsCancellingDelete(true);
    try {
      await base44.functions.invoke('cancelDeleteBranchData', {
        branch_id: selectedBranchId
      });
      toast.info('⏸️ กำลังหยุดการลบ...', { duration: 2000 });
    } catch (error) {
      console.error('Error cancelling delete:', error);
    }
  };

  const [showConnectedDataOptions, setShowConnectedDataOptions] = useState(false);

  const generateConnectedTestDataMutation = useMutation({
    mutationFn: async (count) => {
      toast.info('🔗 กำลังสร้างข้อมูลที่เชื่อมกัน...', { duration: 2000 });
      const response = await base44.functions.invoke('generateConnectedTestData', {
        branch_id: selectedBranchId,
        count: count
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`✅ สร้างข้อมูลสำเร็จ!\n\n🏠 ${data.data.rooms} ห้อง\n👥 ${data.data.tenants} ผู้เช่า\n📅 ${data.data.bookings} การจอง\n⚡ ${data.data.meterReadings} มิเตอร์`, {
        duration: 5000
      });
      queryClient.invalidateQueries();
      setShowConnectedDataOptions(false);
    },
    onError: (error) => {
      toast.error(`❌ เกิดข้อผิดพลาด: ${error.message}`);
      setShowConnectedDataOptions(false);
    }
  });

  const getMainDateRange = () => {
    const now = getCurrentDate();
    const billGenerationDayConfig = configs.find(c => c.key === 'bill_generation_day' && !c.branch_id);
    const billGenerationDay = billGenerationDayConfig ? parseInt(billGenerationDayConfig.value) : 27;
    
    switch(dateRangeType) {
      case 'this_month': {
        // งวดบิลเดือนนี้ = ถ้าวันนี้ยังไม่ถึงวันสร้างบิล ให้ดูงวดเดือนก่อนหน้า
        const currentDay = now.getDate();
        let cycleMonth = now.getMonth();
        let cycleYear = now.getFullYear();
        
        if (currentDay < billGenerationDay) {
          cycleMonth -= 1;
          if (cycleMonth < 0) {
            cycleMonth = 11;
            cycleYear -= 1;
          }
        }
        
        const cycleStart = new Date(cycleYear, cycleMonth, billGenerationDay);
        const cycleEnd = new Date(cycleYear, cycleMonth + 1, billGenerationDay);
        return { from: cycleStart, to: cycleEnd };
      }
      case 'last_month': {
        // งวดบิลเดือนที่แล้ว
        const currentDay = now.getDate();
        let cycleMonth = now.getMonth() - 1;
        let cycleYear = now.getFullYear();
        
        if (currentDay < billGenerationDay) {
          cycleMonth -= 1;
        }
        
        if (cycleMonth < 0) {
          cycleMonth += 12;
          cycleYear -= 1;
        }
        
        const cycleStart = new Date(cycleYear, cycleMonth, billGenerationDay);
        const cycleEnd = new Date(cycleYear, cycleMonth + 1, billGenerationDay);
        return { from: cycleStart, to: cycleEnd };
      }
      case 'this_year':
        return { from: startOfYear(now), to: endOfYear(now) };
      case 'last_year':
        return { from: startOfYear(subYears(now, 1)), to: endOfYear(subYears(now, 1)) };
      case 'custom':
        return customRange;
      default: {
        const currentDay = now.getDate();
        let cycleMonth = now.getMonth();
        let cycleYear = now.getFullYear();
        
        if (currentDay < billGenerationDay) {
          cycleMonth -= 1;
          if (cycleMonth < 0) {
            cycleMonth = 11;
            cycleYear -= 1;
          }
        }
        
        const cycleStart = new Date(cycleYear, cycleMonth, billGenerationDay);
        const cycleEnd = new Date(cycleYear, cycleMonth + 1, billGenerationDay);
        return { from: cycleStart, to: cycleEnd };
      }
    }
  };

  const dateRange = getMainDateRange();

  const { data: rooms = [], isFetching: roomsFetching, error: roomsError } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Room.filter({ branch_id: selectedBranchId }, '-room_number', 1000);
    },
    enabled: !!selectedBranchId,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Booking.filter({ branch_id: selectedBranchId }, '-created_date', 500);
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: allPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Payment.filter({ branch_id: selectedBranchId }, '-due_date', 1000);
    },
    enabled: !!selectedBranchId,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: maintenanceRequests = [] } = useQuery({
    queryKey: ['maintenance', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.MaintenanceRequest.filter({ branch_id: selectedBranchId }, '-created_date', 500);
    },
    enabled: !!selectedBranchId && showMaintenance,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Expense.filter({ branch_id: selectedBranchId }, '-date', 200);
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });



  const calculateLateFee = useMemo(() => {
    const cache = new Map();
    const lateFeeConfig = configs.find(c => c.key === 'late_payment_fee_per_day');
    const lateFeePerDay = lateFeeConfig ? parseFloat(lateFeeConfig.value) : 0;

    return (payment) => {
      if (cache.has(payment.id)) {
        return cache.get(payment.id);
      }

      if (!payment || !payment.due_date || payment.status === 'paid' || lateFeePerDay === 0 || isNaN(lateFeePerDay)) {
        cache.set(payment.id, 0);
        return 0;
      }

      try {
        const dueDate = parseISO(payment.due_date);
        const today = getCurrentDate();

        if (isNaN(dueDate.getTime()) || isNaN(today.getTime())) {
          cache.set(payment.id, 0);
          return 0;
        }

        const todayStartOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const dueDateStartOfDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        const daysOverdue = Math.floor((todayStartOfDay.getTime() - dueDateStartOfDay.getTime()) / (1000 * 60 * 60 * 24));

        const fee = daysOverdue > 0 ? Math.max(0, daysOverdue * lateFeePerDay) : 0;
        cache.set(payment.id, fee);
        return fee;
      } catch (error) {
        cache.set(payment.id, 0);
        return 0;
      }
    };
  }, [configs]);

  const getEffectiveStatus = (payment) => {
    if (!payment) return 'pending';
    if (payment.status === 'paid') return 'paid';
    if (payment.status === 'overdue') return 'overdue';

    if (payment.status === 'pending' && payment.due_date) {
      try {
        const dueDate = parseISO(payment.due_date);
        const today = getCurrentDate();

        if (isNaN(dueDate.getTime()) || isNaN(today.getTime())) {
          return payment.status;
        }

        const todayStartOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const dueDateStartOfDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        if (todayStartOfDay > dueDateStartOfDay) {
          return 'overdue';
        }
      } catch (error) {
        console.error('Error calculating effective status:', error);
        return payment.status;
      }
    }

    return payment.status || 'pending';
  };

  useEffect(() => {
    if (rooms.length > 0) {
      const timer = setTimeout(() => setShowMaintenance(true), 400);
      return () => clearTimeout(timer);
    }
  }, [rooms.length]);

  const stats = useMemo(() => {
    const filteredRooms = viewMode === 'daily' 
      ? rooms.filter(r => r.room_type === 'daily')
      : viewMode === 'monthly'
      ? rooms.filter(r => r.room_type === 'monthly')
      : rooms;

    const totalRooms = filteredRooms.length;
    const occupiedRooms = filteredRooms.filter(r => r.status === 'occupied').length;
    const availableRooms = filteredRooms.filter(r => r.status === 'available').length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    const payments = viewMode === 'all' 
      ? allPayments 
      : allPayments.filter(p => {
          const room = rooms.find(r => r.id === p.room_id);
          return room && room.room_type === viewMode;
        });

    // รายได้: กรองตามงวดบิล (due_date) ไม่ใช่วันที่จ่าย
    const paymentsInRange = payments.filter(payment => {
      if (!payment.due_date) return false;
      try {
        const dueDate = parseISO(payment.due_date);
        if (isNaN(dueDate.getTime())) return false;
        return isWithinInterval(dueDate, { start: dateRange.from, end: dateRange.to });
      } catch {
        return false;
      }
    });

    const totalRevenue = paymentsInRange
      .filter(p => getEffectiveStatus(p) === 'paid')
      .reduce((sum, p) => sum + (p.total_amount || 0), 0);

    // ค้างชำระ: นับทั้งหมดที่ยังไม่จ่าย (ไม่จำกัดช่วงเวลาและไม่กรอง viewMode)
    const allPendingPayments = allPayments.filter(p => getEffectiveStatus(p) !== 'paid');
    const pendingPayments = allPendingPayments.filter(p => getEffectiveStatus(p) === 'pending').length;
    const overduePayments = allPendingPayments.filter(p => getEffectiveStatus(p) === 'overdue').length;
    const paidPayments = paymentsInRange.filter(p => getEffectiveStatus(p) === 'paid').length;
    
    // คำนวณยอดรวมค้างชำระ + ค่าปรับ
    const totalPendingAmount = allPendingPayments.reduce((sum, p) => {
      const baseAmount = p.total_amount || 0;
      // ⭐ ถ้า payment มี late_fee_amount บันทึกไว้แล้ว = total_amount รวมค่าปรับแล้ว ไม่ต้องบวกอีก
      const lateFee = (p.late_fee_amount && p.late_fee_amount > 0) ? 0 : calculateLateFee(p);
      return sum + baseAmount + lateFee;
    }, 0);

    const roomIds = new Set(filteredRooms.map(r => r.id));
    const pendingMaintenanceCount = maintenanceRequests.filter(m => 
      roomIds.has(m.room_id) && m.status === 'pending'
    ).length;

    return {
      totalRooms,
      occupiedRooms,
      availableRooms,
      occupancyRate,
      totalRevenue,
      allPayments: allPendingPayments.length + paidPayments,
      pendingPayments,
      overduePayments,
      paidPayments,
      totalPendingAmount,
      pendingMaintenanceCount,
    };
  }, [rooms, allPayments, maintenanceRequests, dateRange, viewMode, configs, calculateLateFee]);

  const compareStats = useMemo(() => {
    if (!compareEnabled) return null;

    const payments = viewMode === 'all' 
      ? allPayments 
      : allPayments.filter(p => {
          const room = rooms.find(r => r.id === p.room_id);
          return room && room.room_type === viewMode;
        });

    const filteredPayments = payments.filter(payment => {
      if (!payment.payment_date || payment.status !== 'paid') return false;
      try {
        const paymentDate = parseISO(payment.payment_date);
        if (isNaN(paymentDate.getTime())) return false;
        return isWithinInterval(paymentDate, { start: compareRange.from, end: compareRange.to });
      } catch {
        return false;
      }
    });

    const totalRevenue = filteredPayments
      .filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.total_amount || 0), 0);

    return { totalRevenue };
  }, [allPayments, compareRange, compareEnabled, rooms, viewMode]);

  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const revenueChange = compareEnabled && compareStats
    ? calculateChange(stats.totalRevenue, compareStats.totalRevenue)
    : 0;

  const roomStatusData = useMemo(() => {
    const filteredRooms = viewMode === 'daily' 
      ? rooms.filter(r => r.room_type === 'daily')
      : viewMode === 'monthly'
      ? rooms.filter(r => r.room_type === 'monthly')
      : rooms;
    
    return [
      { name: 'มีผู้เช่า', value: filteredRooms.filter(r => r.status === 'occupied').length, color: '#3b82f6' },
      { name: 'ว่าง', value: filteredRooms.filter(r => r.status === 'available').length, color: '#10b981' },
      { name: 'จอง', value: filteredRooms.filter(r => r.status === 'reserved').length, color: '#f59e0b' },
    ];
  }, [rooms, viewMode]);

  const recentPayments = useMemo(() => {
    const payments = viewMode === 'all' 
      ? allPayments 
      : allPayments.filter(p => {
          const room = rooms.find(r => r.id === p.room_id);
          return room && room.room_type === viewMode;
        });

    return payments
      .filter(p => p.status === 'paid' && (p.receipt_sent_date || p.updated_date || p.created_date))
      .sort((a, b) => {
        try {
          // ลำดับความสำคัญ: receipt_sent_date (เวลาส่งใบเสร็จ = เวลาชำระจริง) > updated_date > created_date
          const dateStrA = a.receipt_sent_date || a.updated_date || a.created_date;
          const dateStrB = b.receipt_sent_date || b.updated_date || b.created_date;
          const dateA = parseISO(dateStrA);
          const dateB = parseISO(dateStrB);
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
          return dateB.getTime() - dateA.getTime();
        } catch {
          return 0;
        }
      })
      .slice(0, 5);
  }, [allPayments, rooms, viewMode]);

  const pendingMaintenance = useMemo(() => {
    const filteredRooms = viewMode === 'daily' 
      ? rooms.filter(r => r.room_type === 'daily')
      : viewMode === 'monthly'
      ? rooms.filter(r => r.room_type === 'monthly')
      : rooms;
    const roomIds = new Set(filteredRooms.map(r => r.id));

    return maintenanceRequests
      .filter(m => m.status === 'pending' && roomIds.has(m.room_id))
      .slice(0, 5);
  }, [maintenanceRequests, rooms, viewMode]);

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

  const createPageUrl = (pageName) => {
    // This is a simplified example, a real app might have a more robust URL builder
    // For now, it only returns base paths for known pages.
    switch (pageName) {
      case 'Payments':
        return '/payments';
      // Add other page paths as needed
      default:
        return '/';
    }
  };

  const handlePaymentCardClick = (status) => {
    setPaymentStatusFilter(status); // Set local state (e.g., for potential future use or context)
    localStorage.setItem('paymentStatusFilter', status); // Store filter in localStorage for the Payments page to read
    navigate(createPageUrl('Payments'));
  };

  if (roomsFetching && rooms.length === 0) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
          <PageHeader 
            title="แดชบอร์ด" 
            subtitle={`สาขา ${selectedBranchName}`}
            icon={LayoutDashboard}
          />
          <div className="px-4 md:px-8 py-6">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="space-y-3 animate-pulse">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-slate-200 rounded-lg"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-slate-200 rounded" style={{ width: `${60 + Math.random() * 30}%` }}></div>
                      <div className="h-3 bg-slate-200 rounded" style={{ width: `${40 + Math.random() * 20}%` }}></div>
                    </div>
                    <div className="w-20 h-6 bg-slate-200 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

  if (roomsError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <PageHeader 
          title="แดชบอร์ด" 
          subtitle={`สาขา ${selectedBranchName}`}
          icon={LayoutDashboard}
        />
        <div className="px-4 md:px-8 py-6">
          <div className="max-w-2xl mx-auto">
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-2">เกิดข้อผิดพลาดในการโหลดข้อมูล</h3>
                    <p className="text-sm text-red-700 mb-4">
                      ไม่สามารถโหลดข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ตและลองใหม่อีกครั้ง
                    </p>
                    <Button
                      onClick={() => window.location.reload()}
                      className="bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      โหลดใหม่
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <ScrollToTopButton />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <PageHeader 
        title="แดชบอร์ด" 
        subtitle={`สาขา ${selectedBranchName}`}
        icon={LayoutDashboard}
      />

      <div className="px-4 md:px-8 py-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-3xl overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
              <CardContent className="p-4 md:p-6 relative">
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                      <label className="text-xs font-semibold text-slate-700">มุมมอง</label>
                      <Select value={viewMode} onValueChange={setViewMode}>
                        <SelectTrigger className="w-full text-xs bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">ทั้งหมด</SelectItem>
                          <SelectItem value="daily">รายวัน</SelectItem>
                          <SelectItem value="monthly">รายเดือน</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                      <label className="text-xs font-semibold text-slate-700">ช่วงเวลา</label>
                      <Select value={dateRangeType} onValueChange={setDateRangeType}>
                        <SelectTrigger className="w-full text-xs bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl">
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
                    </div>
                  </div>



                  <div className="flex flex-wrap items-center gap-2">
                    {dateRangeType === 'custom' && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2 bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl">
                            <CalendarIcon className="w-3 h-3" />
                            <span className="text-xs">เลือกวันที่</span>
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

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="compareEnabled"
                        checked={compareEnabled}
                        onChange={(e) => setCompareEnabled(e.target.checked)}
                        className="w-3 h-3 text-blue-600 rounded"
                      />
                      <label htmlFor="compareEnabled" className="text-xs font-semibold text-slate-700">
                        เปรียบเทียบ
                      </label>
                    </div>

                    {compareEnabled && (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-1 bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl">
                            <CalendarIcon className="w-3 h-3" />
                            <span className="text-xs">{format(compareRange.from, 'd MMM', { locale: th })} - {format(compareRange.to, 'd MMM', { locale: th })}</span>
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar
                            mode="range"
                            selected={compareRange}
                            onSelect={setCompareRange}
                            numberOfMonths={2}
                            locale={th}
                          />
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3, delay: 0.2 }}>
              <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400 to-indigo-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                        <DoorOpen className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">ห้องทั้งหมด</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {stats.occupiedRooms}/{stats.totalRooms}
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">
                    {viewMode === 'daily' ? 'ห้องรายวัน' : viewMode === 'monthly' ? 'ห้องรายเดือน' : 'ห้อง'}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3, delay: 0.3 }}>
              <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">อัตราการเข้าพัก</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {stats.occupancyRate}%
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">Occupancy</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3, delay: 0.4 }}>
              <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-400 to-teal-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                        <Wallet className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    {compareEnabled && compareStats && (
                      <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                        revenueChange > 0 ? 'bg-green-100 text-green-700' : revenueChange < 0 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {revenueChange > 0 ? (
                          <ArrowUpRight className="w-3 h-3" />
                        ) : revenueChange < 0 ? (
                          <ArrowDownRight className="w-3 h-3" />
                        ) : null}
                        {Math.abs(revenueChange).toFixed(1)}%
                      </div>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">รายได้ ({dateRangeLabel()})</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {stats.totalRevenue.toLocaleString('th-TH')}
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">฿</p>
                  {compareEnabled && compareStats && (
                    <p className="text-xs text-slate-500 mt-2">
                      เทียบกับ: {compareStats.totalRevenue.toLocaleString('th-TH')} ฿
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3, delay: 0.45 }}>
              <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-400 to-red-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">ค้างชำระ (รวมค่าปรับ)</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {stats.totalPendingAmount.toLocaleString('th-TH')}
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">฿</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {userRole === 'developer' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.48 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                <CardHeader className="pb-3 md:pb-4">
                  <CardTitle className="text-sm md:text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Link2 className="w-5 h-5 text-blue-600" />
                    ลิงก์จองห้องออนไลน์
                  </CardTitle>
                  <p className="text-xs text-slate-600 mt-1">แชร์ลิงก์นี้ให้ผู้ที่สนใจเข้าพัก</p>
                </CardHeader>
                <CardContent>
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-slate-500 mb-2 font-semibold">URL จองห้องพัก</p>
                        <p className="text-sm font-mono text-slate-700 break-all bg-white/70 px-3 py-2 rounded-lg">
                          {window.location.origin}/PublicBooking?branchId={selectedBranchId}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <Button
                        onClick={() => {
                          const url = `${window.location.origin}/PublicBooking?branchId=${selectedBranchId}`;
                          navigator.clipboard.writeText(url);
                          toast.success('📋 คัดลอกลิงก์สำเร็จ!');
                        }}
                        size="sm"
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        คัดลอกลิงก์
                      </Button>
                      <Button
                        onClick={() => {
                          navigate(`/PublicBooking?branchId=${selectedBranchId}`);
                        }}
                        size="sm"
                        variant="outline"
                        className="flex-1"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        เปิดดู
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
              <CardHeader className="pb-3 md:pb-4">
                <CardTitle className="text-sm md:text-lg font-bold text-slate-800">สถานะการชำระเงิน</CardTitle>
                <p className="text-xs text-slate-600 mt-1 font-medium">
                  {viewMode === 'all' ? 'ทุกประเภท' : viewMode === 'daily' ? 'รายวัน' : 'รายเดือน'} - คลิกที่การ์ดเพื่อดูรายละเอียด
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
                  <button
                    onClick={() => handlePaymentCardClick('all')}
                    className="bg-blue-50 rounded-xl p-3 md:p-4 border border-blue-200 hover:shadow-lg hover:scale-105 transition-all cursor-pointer text-left"
                  >
                    <p className="text-xs text-blue-600 font-semibold mb-1">ทั้งหมด</p>
                    <p className="text-2xl md:text-3xl font-bold text-blue-700">{stats.allPayments}</p>
                    <p className="text-xs text-blue-600 mt-1">รายการ</p>
                  </button>

                  <button
                    onClick={() => handlePaymentCardClick('pending')}
                    className="bg-orange-50 rounded-xl p-3 md:p-4 border border-orange-200 hover:shadow-lg hover:scale-105 transition-all cursor-pointer text-left"
                  >
                    <p className="text-xs text-orange-600 font-semibold mb-1">รอชำระ</p>
                    <p className="text-2xl md:text-3xl font-bold text-orange-700">{stats.pendingPayments}</p>
                    <p className="text-xs text-orange-600 mt-1">รายการ</p>
                  </button>

                  <button
                    onClick={() => handlePaymentCardClick('overdue')}
                    className="bg-red-50 rounded-xl p-3 md:p-4 border border-red-200 hover:shadow-lg hover:scale-105 transition-all cursor-pointer text-left"
                  >
                    <p className="text-xs text-red-600 font-semibold mb-1">เกินกำหนด</p>
                    <p className="text-2xl md:text-3xl font-bold text-red-700">{stats.overduePayments}</p>
                    <p className="text-xs text-red-600 mt-1">รายการ</p>
                  </button>

                  <button
                    onClick={() => handlePaymentCardClick('paid')}
                    className="bg-green-50 rounded-xl p-3 md:p-4 border border-green-200 hover:shadow-lg hover:scale-105 transition-all cursor-pointer text-left"
                  >
                    <p className="text-xs text-green-600 font-semibold mb-1">ชำระแล้ว ({dateRangeLabel()})</p>
                    <p className="text-2xl md:text-3xl font-bold text-green-700">{stats.paidPayments}</p>
                    <p className="text-xs text-green-600 mt-1">รายการ</p>
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid lg:grid-cols-2 gap-4 md:gap-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-48 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
                <CardHeader className="relative pb-3 md:pb-4">
                  <CardTitle className="text-sm md:text-lg font-bold text-slate-800">สถานะห้องพัก</CardTitle>
                </CardHeader>
                <CardContent className="relative flex flex-col h-[calc(100%-60px)]">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={roomStatusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {roomStatusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '16px', border: 'none', color: '#fff' }}
                        formatter={(value, name, props) => [`${value} ห้อง`, props.payload.name]}
                      />
                      <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" className="text-3xl font-bold fill-slate-800">
                        {stats.occupancyRate}%
                      </text>
                      <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="text-sm fill-slate-500">
                        อัตราเข้าพัก
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-4">
                    {roomStatusData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-xs text-slate-600">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden h-full">
                <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-48 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
                <CardHeader className="relative pb-3 md:pb-4">
                  <CardTitle className="text-sm md:text-lg font-bold text-slate-800">การชำระเงินล่าสุด</CardTitle>
                </CardHeader>
                <CardContent className="relative flex-1 flex flex-col overflow-hidden">
                  {paymentsLoading ? (
                      <div className="space-y-3 animate-pulse">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-slate-200 rounded" style={{ width: `${50 + Math.random() * 30}%` }}></div>
                              <div className="h-3 bg-slate-200 rounded" style={{ width: `${30 + Math.random() * 20}%` }}></div>
                            </div>
                            <div className="w-16 h-5 bg-slate-200 rounded"></div>
                          </div>
                        ))}
                      </div>
                    ) : (
                    <div className="space-y-3 md:space-y-4 flex-1 overflow-y-auto">
                      {recentPayments.length > 0 ? (
                        recentPayments.map((payment) => {
                                      const room = rooms.find(r => r.id === payment.room_id);
                                      return (
                                        <div key={payment.id} className="flex justify-between items-center p-2 md:p-3 bg-white/70 backdrop-blur-sm rounded-xl border border-blue-100/50 shadow-sm">
                                          <div>
                                            <p className="font-medium text-slate-800 text-sm md:text-base">ห้อง {room?.room_number || 'N/A'}</p>
                                            <p className="text-xs text-slate-500">
                                              {(() => {
                                                try {
                                                  // ลำดับความสำคัญ: receipt_sent_date (เวลาส่งใบเสร็จ = เวลาชำระจริง) > updated_date > created_date
                                                  const receiptSentDateStr = payment.receipt_sent_date;
                                                  const updatedDateStr = payment.updated_date;
                                                  const createdDateStr = payment.created_date;
                                                  
                                                  let dateStr = receiptSentDateStr || updatedDateStr || createdDateStr;
                                                  
                                                  if (!dateStr) return 'N/A';
                                                  
                                                  // ⭐ แก้ไข: ถ้า updated_date ไม่มี Z (UTC marker) ให้เพิ่มเข้าไป
                                                  // เพราะ updated_date จาก Base44 เป็น UTC แต่ไม่มี Z ต่อท้าย
                                                  if (dateStr === updatedDateStr && !dateStr.endsWith('Z')) {
                                                    dateStr = dateStr + 'Z';
                                                  }
                                                  
                                                  const date = parseISO(dateStr);
                                                  if (isNaN(date.getTime())) return 'ข้อมูลไม่ถูกต้อง';
                                                  
                                                  // ⭐ แสดงเป็นเวลาไทยเสมอ (UTC+7)
                                                  return date.toLocaleString('th-TH', {
                                                    timeZone: 'Asia/Bangkok',
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: false
                                                  }) + ' น.';
                                                } catch {
                                                  return 'ข้อมูลไม่ถูกต้อง';
                                                }
                                              })()}
                                            </p>
                                          </div>
                                          <div className="text-right">
                                            <p className="font-bold text-slate-800 text-sm md:text-base">{payment.total_amount.toLocaleString()} ฿</p>
                                            <span className={`text-xs px-2 py-1 rounded-full ${
                                              getEffectiveStatus(payment) === 'paid' ? 'bg-green-100 text-green-700' : 
                                              getEffectiveStatus(payment) === 'overdue' ? 'bg-red-100 text-red-700' :
                                              'bg-orange-100 text-orange-700'
                                            }`}>
                                              {getEffectiveStatus(payment) === 'paid' ? 'ชำระแล้ว' : 
                                               getEffectiveStatus(payment) === 'overdue' ? 'เกินกำหนด' : 'รอชำระ'}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })
                      ) : (
                        <p className="text-center text-slate-500 py-8 text-sm">ยังไม่มีข้อมูลการชำระเงิน</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
            </div>

            {showMaintenance && pendingMaintenance.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-48 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
                <CardHeader className="relative pb-3 md:pb-4">
                  <CardTitle className="text-sm md:text-lg font-bold text-slate-800">คำขอซ่อมที่รอดำเนินการ</CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <div className="space-y-2 md:space-y-3">
                    {pendingMaintenance.map((request) => {
                      const room = rooms.find(r => r.id === request.room_id);
                      return (
                        <div key={request.id} className="flex justify-between items-center p-3 md:p-4 bg-white/70 backdrop-blur-sm rounded-xl border border-blue-100/50 shadow-sm">
                          <div>
                            <p className="font-medium text-slate-800 text-sm md:text-base">{request.title}</p>
                            <p className="text-xs md:text-sm text-slate-500">ห้อง {room?.room_number || 'N/A'}</p>
                          </div>
                          <span className={`px-2 md:px-3 py-1 rounded-full text-xs font-medium ${
                            request.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                            request.priority === 'high' ? 'bg-orange-500 text-white' :
                            request.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {request.priority === 'urgent' ? 'เร่งด่วนมาก' :
                             request.priority === 'high' ? 'เร่งด่วน' :
                             request.priority === 'medium' ? 'ปานกลาง' : 'ต่ำ'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {userRole === 'developer' && (
            <AIInsights
              payments={allPayments}
              expenses={expenses}
              maintenanceRequests={maintenanceRequests}
              tenants={[]}
              rooms={rooms}
              bookings={bookings}
              branches={[]}
              materialDeliveries={[]}
              dateRangeLabel={dateRangeLabel()}
              dateRange={dateRange}
              configs={configs}
            />
          )}

          {userRole === 'developer' && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm md:text-lg font-bold text-slate-800 flex items-center gap-2">
                    <Database className="w-5 h-5 text-purple-600" />
                    เครื่องมือจัดการข้อมูลทดสอบ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-3">
                    <Popover open={showConnectedDataOptions} onOpenChange={setShowConnectedDataOptions}>
                      <PopoverTrigger asChild>
                        <Button
                          disabled={generateConnectedTestDataMutation.isPending}
                          size="sm"
                          className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                          data-onboarding="create-test-data-button"
                        >
                          {generateConnectedTestDataMutation.isPending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin mr-2" />
                              กำลังสร้าง...
                            </>
                          ) : (
                            <>
                              <Database className="w-4 h-4 mr-2" />
                              สร้างข้อมูลที่เชื่อมกัน
                            </>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 p-3">
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-slate-800">เลือกจำนวนข้อมูล</p>
                          <div className="flex flex-col gap-2">
                            <Button
                              onClick={() => {
                                if (confirm('🔗 สร้างข้อมูลทดสอบ 50 ห้อง?\n\n✅ ห้อง + ผู้เช่า + การจอง + มิเตอร์\n✅ พร้อมใช้กับ generateMonthlyBills')) {
                                  generateConnectedTestDataMutation.mutate(50);
                                }
                              }}
                              size="sm"
                              className="w-full bg-blue-500 hover:bg-blue-600"
                            >
                              สร้าง 50 ห้อง
                            </Button>
                            <Button
                              onClick={() => {
                                if (confirm('🔗 สร้างข้อมูลทดสอบ 100 ห้อง?\n\n✅ ห้อง + ผู้เช่า + การจอง + มิเตอร์\n✅ พร้อมใช้กับ generateMonthlyBills\n\n⚠️ อาจใช้เวลานานกว่า')) {
                                  generateConnectedTestDataMutation.mutate(100);
                                }
                              }}
                              size="sm"
                              className="w-full bg-indigo-500 hover:bg-indigo-600"
                            >
                              สร้าง 100 ห้อง
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Button
                      onClick={() => {
                        if (generateTestDataMutation.isPending) {
                          toast.warning('⏳ กรุณารอให้การสร้างข้อมูลเสร็จก่อน');
                          return;
                        }
                        if (confirm('✨ คุณต้องการสร้างข้อมูลทดสอบใช่หรือไม่?\n\n📊 ระบบจะสร้างข้อมูลตัวอย่างให้คุณทดลองใช้งาน')) {
                          generateTestDataMutation.mutate();
                        }
                      }}
                      disabled={generateTestDataMutation.isPending}
                      size="sm"
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                    >
                      {generateTestDataMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          กำลังสร้าง...
                        </>
                      ) : (
                        <>
                          <Database className="w-4 h-4 mr-2" />
                          สร้างข้อมูลแบบเดิม
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => {
                        if (deleteTestDataMutation.isPending) {
                          toast.warning('⏳ กรุณารอให้การลบข้อมูลเสร็จก่อน');
                          return;
                        }
                        if (confirm('🗑️ คุณต้องการลบข้อมูลทดสอบทั้งหมดใช่หรือไม่?\n\n⚠️ หากมีข้อมูลเยอะ อาจต้องกดลบหลายรอบ')) {
                          deleteTestDataMutation.mutate();
                        }
                      }}
                      disabled={deleteTestDataMutation.isPending}
                      size="sm"
                      variant="destructive"
                      className={deleteTestDataMutation.isPending ? "opacity-50 cursor-not-allowed" : ""}
                    >
                      {deleteTestDataMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          กำลังลบ...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          ลบข้อมูลทดสอบ
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => setShowDeleteBranchDataDialog(true)}
                      disabled={deleteBranchDataMutation.isPending}
                      size="sm"
                      variant="destructive"
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {deleteBranchDataMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          กำลังลบ...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          ลบข้อมูลทั้งหมด
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => setShowDebugDialog(true)}
                      size="sm"
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      <Bug className="w-4 h-4 mr-2" />
                      Debug เวลา
                    </Button>
                    {(deleteTestDataMutation.isPending || generateTestDataMutation.isPending) && (
                      <p className="text-xs text-slate-600 animate-pulse">
                        🔄 กำลังดำเนินการ กรุณารอสักครู่...
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {userRole === 'developer' && (
        <OnboardingStartButton 
          currentUser={currentUser}
          onStart={() => {
            queryClient.invalidateQueries({ queryKey: ['currentUser'] });
          }}
        />
      )}

      {/* Delete Branch Data Confirmation Dialog */}
      <Dialog open={showDeleteBranchDataDialog} onOpenChange={setShowDeleteBranchDataDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              ลบข้อมูลทั้งหมดของสาขา
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-semibold mb-2">⚠️ คำเตือน!</p>
              <p className="text-sm text-red-700 mb-3">
                การดำเนินการนี้จะลบข้อมูลต่อไปนี้ของสาขา "{selectedBranchName}" อย่างถาวร:
              </p>
              <ul className="text-sm text-red-700 space-y-1 ml-4 list-disc">
                <li>ห้องพัก</li>
                <li>ผู้เช่า</li>
                <li>การจอง</li>
                <li>การชำระเงิน</li>
                <li>ค่าใช้จ่าย</li>
                <li>แจ้งซ่อม</li>
                <li>บันทึกมิเตอร์</li>
              </ul>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-xs text-yellow-800">
                💡 <strong>ไม่สามารถกู้คืนข้อมูลได้</strong> หลังจากลบ กรุณาตรวจสอบให้แน่ใจก่อนลำเบียง
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowDeleteBranchDataDialog(false)}
                variant="outline"
                className="flex-1"
                disabled={deleteBranchDataMutation.isPending && !isCancellingDelete}
              >
                ปิด
              </Button>
              {deleteBranchDataMutation.isPending ? (
                <Button
                  onClick={handleCancelDelete}
                  variant="destructive"
                  className="flex-1 bg-orange-600 hover:bg-orange-700"
                  disabled={isCancellingDelete}
                >
                  {isCancellingDelete ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      กำลังยกเลิก...
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      ยกเลิกการลบ
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    if (confirm(`⚠️ ยืนยันการลบข้อมูลทั้งหมดของสาขา "${selectedBranchName}"?\n\nข้อมูลที่ลบแล้วไม่สามารถกู้คืนได้!`)) {
                      deleteBranchDataMutation.mutate({});
                    }
                  }}
                  variant="destructive"
                  className="flex-1"
                >
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    ลบข้อมูลทั้งหมด
                  </>
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Debug Dialog */}
      <Dialog open={showDebugDialog} onOpenChange={setShowDebugDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="w-5 h-5 text-purple-600" />
              Debug: Timestamps ของ Payments ล่าสุด
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {recentPayments.length > 0 ? (
              recentPayments.map((payment) => {
                const room = rooms.find(r => r.id === payment.room_id);
                return (
                  <div key={payment.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-bold text-slate-800">ห้อง {room?.room_number || 'N/A'}</p>
                        <p className="text-xs text-slate-500">Payment ID: {payment.id}</p>
                      </div>
                      <span className="text-sm font-bold text-green-600">{payment.total_amount?.toLocaleString()} ฿</span>
                    </div>

                    <div className="grid grid-cols-1 gap-2 text-xs">
                      <div className="bg-white rounded p-2 border">
                        <span className="font-semibold text-blue-600">updated_date:</span>
                        <span className="ml-2 font-mono text-slate-700">
                          {payment.updated_date || <span className="text-red-500">ไม่มี</span>}
                        </span>
                        {payment.updated_date && (
                          <span className="ml-2 text-slate-500">
                            → {parseISO(payment.updated_date).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false })}
                          </span>
                        )}
                      </div>

                      <div className="bg-white rounded p-2 border">
                        <span className="font-semibold text-purple-600">receipt_sent_date:</span>
                        <span className="ml-2 font-mono text-slate-700">
                          {payment.receipt_sent_date || <span className="text-red-500">ไม่มี</span>}
                        </span>
                        {payment.receipt_sent_date && (
                          <span className="ml-2 text-slate-500">
                            → {parseISO(payment.receipt_sent_date).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false })}
                          </span>
                        )}
                      </div>

                      <div className="bg-white rounded p-2 border">
                        <span className="font-semibold text-green-600">created_date:</span>
                        <span className="ml-2 font-mono text-slate-700">
                          {payment.created_date || <span className="text-red-500">ไม่มี</span>}
                        </span>
                        {payment.created_date && (
                          <span className="ml-2 text-slate-500">
                            → {parseISO(payment.created_date).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour12: false })}
                          </span>
                        )}
                      </div>

                      <div className="bg-amber-50 rounded p-2 border border-amber-200">
                        <span className="font-semibold text-amber-700">ที่ใช้แสดง:</span>
                        <span className="ml-2 font-mono text-slate-700">
                          {payment.receipt_sent_date ? '✅ receipt_sent_date (เวลาชำระจริง)' : 
                           payment.updated_date ? '✅ updated_date (สำรอง)' : 
                           '✅ created_date (สำรอง)'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-center text-slate-500 py-8">ไม่มีข้อมูลการชำระเงิน</p>
            )}
          </div>

          <Button onClick={() => setShowDebugDialog(false)} className="w-full">
            ปิด
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}