import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, DollarSign, TrendingUp, TrendingDown, Wallet, Loader2, DoorOpen, Users, Calendar as CalendarIcon, AlertCircle, BarChart3, PieChart, Sparkles, ChevronDown, ChevronUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPieChart, Pie } from "recharts";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval, getDaysInMonth, startOfDay, endOfDay, differenceInDays, startOfYear, endOfYear, subYears } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import PageHeader from "../components/shared/PageHeader";
import { toast } from "sonner";
import AIInsights from "../components/dashboard/AIInsights";

export default function ReportsPage() {
  const [reportType, setReportType] = useState('monthly');
  const [dateRangeMonths, setDateRangeMonths] = useState(6);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDailyYear, setSelectedDailyYear] = useState(new Date().getFullYear());
  const [selectedDailyMonth, setSelectedDailyMonth] = useState(new Date().getMonth() + 1);
  
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareType, setCompareType] = useState('last_6_months');

  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name');

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  };

  const { data: allRooms = [] } = useQuery({
    queryKey: ['allRooms', 'reports', selectedBranchId],
    queryFn: () => base44.entities.Room.filter({ branch_id: selectedBranchId }, '-room_number', 10000),
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['allPayments', 'reports', selectedBranchId],
    queryFn: () => base44.entities.Payment.filter({ branch_id: selectedBranchId }, '-created_date', 10000),
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['allExpenses', 'reports', selectedBranchId],
    queryFn: () => base44.entities.Expense.filter({ branch_id: selectedBranchId }, '-date', 10000),
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  const { data: allBookings = [] } = useQuery({
    queryKey: ['allBookings', 'reports', selectedBranchId],
    queryFn: () => base44.entities.Booking.filter({ branch_id: selectedBranchId }, '-created_date', 10000),
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: allTenants = [] } = useQuery({
    queryKey: ['allTenants', 'reports', selectedBranchId],
    queryFn: () => base44.entities.Tenant.filter({ branch_id: selectedBranchId }, '-created_date', 10000),
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  const { data: allMaintenance = [] } = useQuery({
    queryKey: ['allMaintenance', 'reports', selectedBranchId],
    queryFn: () => base44.entities.MaintenanceRequest.filter({ branch_id: selectedBranchId }, '-created_date', 10000),
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 10 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    ...retryConfig,
    staleTime: 4 * 60 * 60 * 1000,
    gcTime: 8 * 60 * 60 * 1000,
  });

  const getCurrentDate = useMemo(() => {
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
  }, [configs]);

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
        const today = getCurrentDate;

        if (isNaN(dueDate.getTime()) || isNaN(today.getTime())) {
          cache.set(payment.id, 0);
          return 0;
        }

        const todayStartOfDay = startOfDay(today);
        const dueDateStartOfDay = startOfDay(dueDate);

        const daysOverdue = differenceInDays(todayStartOfDay, dueDateStartOfDay);

        const fee = daysOverdue > 0 ? Math.max(0, daysOverdue * lateFeePerDay) : 0;
        cache.set(payment.id, fee);
        return fee;
      } catch (error) {
        cache.set(payment.id, 0);
        return 0;
      }
    };
  }, [configs, getCurrentDate]);

  const filteredData = useMemo(() => {
    if (!selectedBranchId) return { rooms: [], payments: [], expenses: [], bookings: [] };

    const rooms = reportType === 'daily' 
      ? allRooms.filter(r => r.room_type === 'daily')
      : allRooms;

    return { rooms, payments: allPayments, expenses: allExpenses, bookings: allBookings };
  }, [allRooms.length, allPayments.length, allExpenses.length, allBookings.length, selectedBranchId, reportType]);

  const monthlyChartData = useMemo(() => {
    const monthsData = [];
    const baseMonth = new Date(selectedYear, selectedMonth - 1, 1);

    for (let i = dateRangeMonths - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(baseMonth, i));
      const monthEnd = endOfMonth(subMonths(baseMonth, i));

      const monthPayments = filteredData.payments.filter(p => {
        if (!p.payment_date || p.status !== 'paid') return false;
        try {
          const paymentDate = parseISO(p.payment_date);
          if (isNaN(paymentDate.getTime())) return false;
          return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      });

      const monthExpenses = filteredData.expenses.filter(e => {
        if (!e.date) return false;
        try {
          const expenseDate = parseISO(e.date);
          if (isNaN(expenseDate.getTime())) return false;
          return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      });

      const revenue = monthPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const expense = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const profit = revenue - expense;
      const occupiedRooms = filteredData.rooms.filter(r => r.status === 'occupied').length;

      monthsData.push({
        month: format(monthStart, 'MMM', { locale: th }),
        fullMonth: format(monthStart, 'MMMM yyyy', { locale: th }),
        revenue,
        expense,
        profit,
        occupiedRooms,
        occupancyRate: filteredData.rooms.length > 0 ? ((occupiedRooms / filteredData.rooms.length) * 100).toFixed(1) : 0
      });
    }

    return monthsData;
  }, [
    filteredData.payments.length,
    filteredData.expenses.length,
    filteredData.rooms.length,
    dateRangeMonths,
    selectedYear,
    selectedMonth
  ]);

  // Updated compareChartData to use compareType
  const compareChartData = useMemo(() => {
    if (!compareEnabled || reportType !== 'monthly') return [];
    
    const monthsData = [];
    const currentBaseDate = new Date(selectedYear, selectedMonth - 1, 1); // The last month of the current selected range
    const numberOfMonths = dateRangeMonths; // Comparison period length always matches current period length

    let compareStartDate;
    let compareEndDate;

    switch(compareType) {
      case 'last_3_months':
      case 'last_6_months':
      case 'last_12_months':
        // The comparison period should be the 'dateRangeMonths' directly preceding the 'current' range.
        const currentRangeStartDate = startOfMonth(subMonths(currentBaseDate, dateRangeMonths - 1));
        const compareBaseDateForPrecedingPeriod = subMonths(currentRangeStartDate, 1);
        
        compareStartDate = startOfMonth(subMonths(compareBaseDateForPrecedingPeriod, dateRangeMonths - 1));
        compareEndDate = endOfMonth(compareBaseDateForPrecedingPeriod);
        break;
      case 'last_year':
        // Compare same period, but in the previous year
        compareStartDate = startOfMonth(subYears(subMonths(currentBaseDate, dateRangeMonths - 1), 1));
        compareEndDate = endOfMonth(subYears(currentBaseDate, 1));
        break;
      case 'this_year': 
        // Compare with the period immediately preceding the current selected range, within the same year.
        const currentRangeStartForThisYear = startOfMonth(subMonths(currentBaseDate, dateRangeMonths - 1));
        const currentRangeEndForThisYear = endOfMonth(currentBaseDate);

        compareStartDate = startOfMonth(subMonths(currentRangeStartForThisYear, dateRangeMonths));
        compareEndDate = endOfMonth(subMonths(currentRangeEndForThisYear, dateRangeMonths));
        // If the calculated compareEndDate falls into a different year, we might adjust or handle differently
        // For simplicity, we'll let it span years if the math dictates, but the label is "this year".
        // A more robust solution might cap it to the start of the current year if compareStartDate goes into previous year
        if (compareStartDate.getFullYear() !== currentBaseDate.getFullYear()) {
          // If comparison period starts before the current year, adjust to start of current year
          compareStartDate = startOfYear(currentBaseDate);
          compareEndDate = endOfMonth(subMonths(currentRangeStartForThisYear, 1)); // End before current period begins
          // This would change numberOfMonths dynamically, which complicates `combinedChartData` mapping.
          // For now, we adhere to `numberOfMonths` being `dateRangeMonths`.
          // This case (`this_year` comparison period starting in previous year) will mean
          // the comparison data will show months from previous year, even if labeled "this year".
          // The current approach attempts to find a *preceding* period of the same length *relative to the current period*.
        }
        break;
      default:
        // Fallback for unexpected compareType, should not be hit with defined cases
        compareStartDate = startOfMonth(subMonths(currentBaseDate, numberOfMonths - 1 + numberOfMonths)); 
        compareEndDate = endOfMonth(subMonths(currentBaseDate, numberOfMonths));
        break;
    }
    
    // Iterate backwards from compareEndDate to get the data for numberOfMonths
    for (let i = numberOfMonths - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(compareEndDate, i));
      const monthEnd = endOfMonth(subMonths(compareEndDate, i));

      const monthPayments = filteredData.payments.filter(p => {
        if (!p.payment_date || p.status !== 'paid') return false;
        try {
          const paymentDate = parseISO(p.payment_date);
          if (isNaN(paymentDate.getTime())) return false;
          return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      });

      const monthExpenses = filteredData.expenses.filter(e => {
        if (!e.date) return false;
        try {
          const expenseDate = parseISO(e.date);
          if (isNaN(expenseDate.getTime())) return false;
          return isWithinInterval(expenseDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      });

      const revenue = monthPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const expense = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const profit = revenue - expense;

      monthsData.push({
        month: format(monthStart, 'MMM', { locale: th }),
        fullMonth: format(monthStart, 'MMMM yyyy', { locale: th }),
        revenue,
        expense,
        profit
      });
    }

    return monthsData;
  }, [
    filteredData.payments.length,
    filteredData.expenses.length,
    compareEnabled,
    compareType,
    dateRangeMonths,
    selectedYear,
    selectedMonth,
    reportType
  ]);

  // Combine data for stacked charts, assuming compareChartData has matching length
  const combinedChartData = useMemo(() => {
    if (!compareEnabled || reportType !== 'monthly') return monthlyChartData;

    return monthlyChartData.map((current, index) => {
      const compare = compareChartData[index] || {};
      return {
        ...current,
        compareRevenue: compare.revenue || 0,
        compareExpense: compare.expense || 0,
        compareProfit: compare.profit || 0,
        compareMonth: compare.fullMonth || '' // ✅ เพิ่ม compareMonth
      };
    });
  }, [monthlyChartData, compareChartData, compareEnabled, reportType]);

  const dailyChartData = useMemo(() => {
    const daysInMonth = getDaysInMonth(new Date(selectedDailyYear, selectedDailyMonth - 1));
    const daysData = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDay = new Date(selectedDailyYear, selectedDailyMonth - 1, day);
      const dayStart = startOfDay(currentDay);
      const dayEnd = endOfDay(currentDay);

      const dailyBookings = filteredData.bookings.filter(b => {
        if (b.booking_type !== 'daily' || b.status === 'cancelled') return false;
        if (!b.check_in_date || !b.check_out_date) return false;
        
        try {
          const checkIn = parseISO(b.check_in_date);
          const checkOut = parseISO(b.check_out_date);
          if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) return false;
          return checkIn <= dayEnd && checkOut > dayStart;
        } catch {
          return false;
        }
      });

      const dayPayments = filteredData.payments.filter(p => {
        if (!p.payment_date || p.status !== 'paid') return false;
        
        const isForDailyRoom = filteredData.rooms.some(r => r.id === p.room_id);
        if (!isForDailyRoom) return false;
        
        try {
          const paymentDate = parseISO(p.payment_date);
          if (isNaN(paymentDate.getTime())) return false;
          return isWithinInterval(paymentDate, { start: dayStart, end: dayEnd });
        } catch {
          return false;
        }
      });

      const revenue = dayPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);

      daysData.push({
        day: day.toString(),
        fullDate: format(currentDay, 'd MMM yyyy', { locale: th }),
        revenue,
        dailyBookings: dailyBookings.length
      });
    }

    return daysData;
  }, [
    filteredData.bookings.length,
    filteredData.payments.length,
    filteredData.rooms.length,
    selectedDailyYear,
    selectedDailyMonth
  ]);

  const summary = useMemo(() => {
    if (reportType === 'monthly') {
      const totalRevenue = monthlyChartData.reduce((sum, d) => sum + d.revenue, 0);
      const totalExpenses = monthlyChartData.reduce((sum, d) => sum + d.expense, 0);
      const totalProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

      const occupiedRooms = filteredData.rooms.filter(r => r.status === 'occupied').length;
      const totalRooms = filteredData.rooms.length;
      const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : 0;

      return {
        totalRevenue,
        totalExpenses,
        totalProfit,
        profitMargin,
        occupiedRooms,
        totalRooms,
        occupancyRate
      };
    } else {
      const totalRevenue = dailyChartData.reduce((sum, d) => sum + d.revenue, 0);
      const totalBookings = dailyChartData.reduce((sum, d) => sum + d.dailyBookings, 0);
      const avgDailyRevenue = dailyChartData.length > 0 ? totalRevenue / dailyChartData.length : 0;
      const avgDailyBookings = dailyChartData.length > 0 ? totalBookings / dailyChartData.length : 0;

      return {
        totalRevenue,
        totalBookings,
        avgDailyRevenue,
        avgDailyBookings,
        occupiedRooms: 0,
        totalRooms: filteredData.rooms.length,
        occupancyRate: 0
      };
    }
  }, [reportType, monthlyChartData, dailyChartData, filteredData.rooms]);

  const compareSummary = useMemo(() => {
    if (!compareEnabled || reportType !== 'monthly') return null;

    const totalRevenue = compareChartData.reduce((sum, d) => sum + d.revenue, 0);
    const totalExpenses = compareChartData.reduce((sum, d) => sum + d.expense, 0);
    const totalProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

    return {
      totalRevenue,
      totalExpenses,
      totalProfit,
      profitMargin
    };
  }, [compareChartData, compareEnabled, reportType]);

  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return 0; // Return 0 if previous is 0 to avoid Infinity/NaN for display
    return ((current - previous) / previous) * 100;
  };

  const revenueByCategoryData = useMemo(() => {
    if (reportType !== 'monthly') return [];
    
    const baseMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const rangeStart = startOfMonth(subMonths(baseMonth, dateRangeMonths - 1));
    const rangeEnd = endOfMonth(baseMonth);

    const rangePayments = filteredData.payments.filter(p => {
      if (!p.payment_date || p.status !== 'paid') return false;
      try {
        const paymentDate = parseISO(p.payment_date);
        if (isNaN(paymentDate.getTime())) return false;
        return isWithinInterval(paymentDate, { start: rangeStart, end: rangeEnd });
      } catch {
        return false;
      }
    });

    const categoryMap = {
      rent: 0,
      water: 0,
      electricity: 0,
      internet: 0,
      common_fee: 0,
      parking: 0,
      other: 0
    };

    rangePayments.forEach(p => {
      categoryMap.rent += p.rent_amount || 0;
      categoryMap.water += p.water_amount || 0;
      categoryMap.electricity += p.electricity_amount || 0;
      categoryMap.internet += p.internet_amount || 0;
      categoryMap.common_fee += p.common_fee_amount || 0;
      categoryMap.parking += p.parking_fee_amount || 0;
      categoryMap.other += p.other_amount || 0;
    });

    const categoryNames = {
      rent: 'ค่าเช่า',
      water: 'ค่าน้ำ',
      electricity: 'ค่าไฟ',
      internet: 'อินเทอร์เน็ต',
      common_fee: 'ค่าส่วนกลาง',
      parking: 'ค่าจอดรถ',
      other: 'อื่นๆ'
    };

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#64748b'];
    
    return Object.entries(categoryMap)
      .filter(([_, value]) => value > 0)
      .map(([key, value], index) => ({
        name: categoryNames[key] || key,
        value,
        color: colors[index % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData.payments, reportType, selectedYear, selectedMonth, dateRangeMonths]);

  const expenseByCategoryData = useMemo(() => {
    if (reportType !== 'monthly') return [];
    
    const baseMonth = new Date(selectedYear, selectedMonth - 1, 1);
    const rangeStart = startOfMonth(subMonths(baseMonth, dateRangeMonths - 1));
    const rangeEnd = endOfMonth(baseMonth);

    const rangeExpenses = filteredData.expenses.filter(e => {
      if (!e.date) return false;
      try {
        const expenseDate = parseISO(e.date);
        if (isNaN(expenseDate.getTime())) return false;
        return isWithinInterval(expenseDate, { start: rangeStart, end: rangeEnd });
      } catch {
        return false;
      }
    });

    const categoryMap = {};
    rangeExpenses.forEach(e => {
      const cat = e.category || 'อื่นๆ';
      categoryMap[cat] = (categoryMap[cat] || 0) + (e.amount || 0);
    });

    const categoryNames = {
      electricity: 'ค่าไฟ',
      water: 'ค่าน้ำ',
      repair: 'ซ่อมแซม',
      internet: 'อินเทอร์เน็ต',
      salary: 'เงินเดือน',
      supplies: 'วัสดุสิ้นเปลือง',
      other: 'อื่นๆ'
    };

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];
    
    return Object.entries(categoryMap)
      .map(([key, value], index) => ({
        name: categoryNames[key] || key,
        value,
        color: colors[index % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData.expenses, reportType, selectedYear, selectedMonth, dateRangeMonths]);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const months = [
    { value: 1, label: 'มกราคม' },
    { value: 2, label: 'กุมภาพันธ์' },
    { value: 3, label: 'มีนาคม' },
    { value: 4, label: 'เมษายน' },
    { value: 5, label: 'พฤษภาคม' },
    { value: 6, label: 'มิถุนายน' },
    { value: 7, label: 'กรกฎาคม' },
    { value: 8, label: 'สิงหาคม' },
    { value: 9, label: 'กันยายน' },
    { value: 10, label: 'ตุลาคม' },
    { value: 11, label: 'พฤศจิกายน' },
    { value: 12, label: 'ธันวาคม' },
  ];

  // ✅ เพิ่ม function สำหรับแสดง label ช่วงเปรียบเทียบ
  const getCompareLabel = () => {
    switch(compareType) {
      case 'last_3_months': return '3 เดือนที่แล้ว';
      case 'last_6_months': return '6 เดือนที่แล้ว';
      case 'last_12_months': return '12 เดือนที่แล้ว';
      case 'this_year': return 'ปีนี้';
      case 'last_year': return 'ปีที่แล้ว';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <PageHeader 
        title="รายงานภาพรวม" 
        subtitle={`สาขา ${selectedBranchName}`}
        icon={BarChart3}
      />

      <div className="px-4 md:px-8 py-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Controls */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-3xl overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
              <CardContent className="p-3 md:p-4 relative">
                <div className="flex flex-col gap-2.5">
                  {/* แถวแรก: ประเภทรายงาน + ช่วงเวลา + ปี + เดือน */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-0.5 bg-white/70 backdrop-blur-xl p-0.5 rounded-xl border border-white/60 shadow-md">
                      <Button
                        size="sm"
                        onClick={() => setReportType('monthly')}
                        className={`rounded-lg transition-all text-xs px-3 py-1.5 h-8 ${
                          reportType === 'monthly'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                            : 'bg-transparent text-slate-700 hover:bg-white/80'
                        }`}
                      >
                        <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                        รายเดือน
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setReportType('daily')}
                        className={`rounded-lg transition-all text-xs px-3 py-1.5 h-8 ${
                          reportType === 'daily'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md'
                            : 'bg-transparent text-slate-700 hover:bg-white/80'
                        }`}
                      >
                        <CalendarIcon className="w-3.5 h-3.5 mr-1" />
                        รายวัน
                      </Button>
                    </div>

                    {reportType === 'monthly' ? (
                      <>
                        <Select value={dateRangeMonths.toString()} onValueChange={(val) => setDateRangeMonths(parseInt(val))}>
                          <SelectTrigger className="w-24 h-8 bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="3">3 เดือน</SelectItem>
                            <SelectItem value="6">6 เดือน</SelectItem>
                            <SelectItem value="12">12 เดือน</SelectItem>
                          </SelectContent>
                        </Select>
                        
                        <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(parseInt(val))}>
                          <SelectTrigger className="w-20 h-8 bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map(year => (
                              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(parseInt(val))}>
                          <SelectTrigger className="w-28 h-8 bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {months.map(month => (
                              <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    ) : (
                      <>
                        <Select value={selectedDailyYear.toString()} onValueChange={(val) => setSelectedDailyYear(parseInt(val))}>
                          <SelectTrigger className="w-20 h-8 bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {years.map(year => (
                              <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select value={selectedDailyMonth.toString()} onValueChange={(val) => setSelectedDailyMonth(parseInt(val))}>
                          <SelectTrigger className="w-28 h-8 bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {months.map(month => (
                              <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </>
                    )}
                  </div>

                  {/* แถวที่สอง: เปรียบเทียบ */}
                  {reportType === 'monthly' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          id="compareEnabled"
                          checked={compareEnabled}
                          onChange={(e) => setCompareEnabled(e.target.checked)}
                          className="w-3.5 h-3.5 text-purple-600 rounded"
                        />
                        <label htmlFor="compareEnabled" className="text-xs font-semibold text-slate-700">
                          เปรียบเทียบกับช่วงอื่น
                        </label>
                      </div>

                      {compareEnabled && (
                        <Select value={compareType} onValueChange={setCompareType}>
                          <SelectTrigger className="w-36 h-8 bg-purple-50 border-purple-300 rounded-lg text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="last_3_months">3 เดือนที่แล้ว</SelectItem>
                            <SelectItem value="last_6_months">6 เดือนที่แล้ว</SelectItem>
                            <SelectItem value="last_12_months">12 เดือนที่แล้ว</SelectItem>
                            <SelectItem value="this_year">ปีนี้</SelectItem>
                            <SelectItem value="last_year">ปีที่แล้ว</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Insights */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <AIInsights
              payments={filteredData.payments}
              expenses={filteredData.expenses}
              maintenanceRequests={allMaintenance}
              tenants={allTenants}
              rooms={filteredData.rooms}
              bookings={allBookings}
              branches={[{ id: selectedBranchId, branch_name: selectedBranchName }]}
              materialDeliveries={[]}
              dateRangeLabel={reportType === 'monthly' ? `${dateRangeMonths} เดือนล่าสุด` : `${months.find(m => m.value === selectedDailyMonth)?.label} ${selectedDailyYear}`}
              dateRange={
                reportType === 'monthly'
                  ? {
                      from: startOfMonth(subMonths(new Date(selectedYear, selectedMonth - 1, 1), dateRangeMonths - 1)),
                      to: endOfMonth(new Date(selectedYear, selectedMonth - 1, 1))
                    }
                  : {
                      from: startOfMonth(new Date(selectedDailyYear, selectedDailyMonth - 1, 1)),
                      to: endOfMonth(new Date(selectedDailyYear, selectedDailyMonth - 1, 1))
                    }
              }
              configs={configs}
              showPredictiveMaintenance={true}
              showTenantBehavior={true}
              showFinancialForecast={true}
              showAnomalyDetection={true}
            />
          </motion.div>

          {/* Stats Cards */}
          {reportType === 'monthly' ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br from-green-200/30 to-emerald-300/20 rounded-full blur-3xl" />
                  <CardContent className="p-3 md:p-6 relative">
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                        <DollarSign className="w-3 h-3 md:w-6 md:h-6 text-white" />
                      </div>
                      {compareEnabled && compareSummary && (
                        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                          calculateChange(summary.totalRevenue, compareSummary.totalRevenue) > 0 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {calculateChange(summary.totalRevenue, compareSummary.totalRevenue) > 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {Math.abs(calculateChange(summary.totalRevenue, compareSummary.totalRevenue)).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">รายได้รวม</p>
                    <p className="text-lg md:text-3xl font-bold text-slate-800">฿{summary.totalRevenue.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">{dateRangeMonths} เดือน</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br from-red-200/30 to-orange-300/20 rounded-full blur-3xl" />
                  <CardContent className="p-3 md:p-6 relative">
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-gradient-to-br from-red-500 to-orange-600 shadow-lg">
                        <Wallet className="w-3 h-3 md:w-6 md:h-6 text-white" />
                      </div>
                      {compareEnabled && compareSummary && (
                        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                          calculateChange(summary.totalExpenses, compareSummary.totalExpenses) > 0 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {calculateChange(summary.totalExpenses, compareSummary.totalExpenses) > 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {Math.abs(calculateChange(summary.totalExpenses, compareSummary.totalExpenses)).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">ค่าใช้จ่าย</p>
                    <p className="text-lg md:text-3xl font-bold text-slate-800">฿{summary.totalExpenses.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">{dateRangeMonths} เดือน</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br from-blue-200/30 to-indigo-300/20 rounded-full blur-3xl" />
                  <CardContent className="p-3 md:p-6 relative">
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                        {summary.totalProfit >= 0 ? (
                          <TrendingUp className="w-3 h-3 md:w-6 md:h-6 text-white" />
                        ) : (
                          <TrendingDown className="w-3 h-3 md:w-6 md:h-6 text-white" />
                        )}
                      </div>
                      {compareEnabled && compareSummary && (
                        <div className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                          calculateChange(summary.totalProfit, compareSummary.totalProfit) > 0 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {calculateChange(summary.totalProfit, compareSummary.totalProfit) > 0 ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {Math.abs(calculateChange(summary.totalProfit, compareSummary.totalProfit)).toFixed(1)}%
                        </div>
                      )}
                    </div>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">กำไรสุทธิ</p>
                    <p className={`text-lg md:text-3xl font-bold ${summary.totalProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      ฿{Math.abs(summary.totalProfit).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      <Badge className={parseFloat(summary.profitMargin) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {summary.profitMargin}%
                      </Badge>
                    </p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br from-purple-200/30 to-pink-300/20 rounded-full blur-3xl" />
                  <CardContent className="p-3 md:p-6 relative">
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
                        <DoorOpen className="w-3 h-3 md:w-6 md:h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">อัตราเข้าพัก</p>
                    <p className="text-lg md:text-3xl font-bold text-slate-800">{summary.occupancyRate}%</p>
                    <p className="text-xs text-slate-500 mt-1">{summary.occupiedRooms}/{summary.totalRooms} ห้อง</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br from-green-200/30 to-emerald-300/20 rounded-full blur-3xl" />
                  <CardContent className="p-3 md:p-6 relative">
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                        <DollarSign className="w-3 h-3 md:w-6 md:h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">รายได้รวม</p>
                    <p className="text-lg md:text-3xl font-bold text-slate-800">฿{summary.totalRevenue.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">ทั้งเดือน</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br from-blue-200/30 to-indigo-300/20 rounded-full blur-3xl" />
                  <CardContent className="p-3 md:p-6 relative">
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                        <TrendingUp className="w-3 h-3 md:w-6 md:h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">เฉลี่ยต่อวัน</p>
                    <p className="text-lg md:text-3xl font-bold text-slate-800">฿{Math.floor(summary.avgDailyRevenue).toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-1">รายได้</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br from-purple-200/30 to-pink-300/20 rounded-full blur-3xl" />
                  <CardContent className="p-3 md:p-6 relative">
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg">
                        <Users className="w-3 h-3 md:w-6 md:h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">ยอดเข้าพัก</p>
                    <p className="text-lg md:text-3xl font-bold text-slate-800">{summary.totalBookings}</p>
                    <p className="text-xs text-slate-500 mt-1">ทั้งเดือน</p>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br from-orange-200/30 to-amber-300/20 rounded-full blur-3xl" />
                  <CardContent className="p-3 md:p-6 relative">
                    <div className="flex items-start justify-between mb-3 md:mb-4">
                      <div className="p-2 md:p-3 rounded-xl md:rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg">
                        <DoorOpen className="w-3 h-3 md:w-6 md:h-6 text-white" />
                      </div>
                    </div>
                    <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">เฉลี่ยต่อวัน</p>
                    <p className="text-lg md:text-3xl font-bold text-slate-800">{summary.avgDailyBookings.toFixed(1)}</p>
                    <p className="text-xs text-slate-500 mt-1">ห้อง</p>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

          {/* Charts */}
          {reportType === 'monthly' ? (
            <>
              {/* กราฟแนวโน้มรายได้และค่าใช้จ่าย */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl overflow-hidden rounded-3xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
                  <CardHeader className="pb-4 relative">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      แนวโน้มรายได้และค่าใช้จ่าย
                      {compareEnabled && (
                        <Badge className="bg-purple-100 text-purple-700 ml-2">
                          เปรียบเทียบกับ {getCompareLabel()}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <ResponsiveContainer width="100%" height={280}>
                      <ComposedChart data={combinedChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', borderRadius: '16px', border: 'none', color: '#ffffff' }}
                          itemStyle={{ color: '#ffffff', fontWeight: 600 }}
                          labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: 8 }}
                          formatter={(value, name, props) => {
                            const labels = {
                              revenue: `รายได้ (${props.payload.fullMonth})`,
                              expense: `ค่าใช้จ่าย (${props.payload.fullMonth})`,
                              compareRevenue: `รายได้ (${props.payload.compareMonth || getCompareLabel()})`,
                              compareExpense: `ค่าใช้จ่าย (${props.payload.compareMonth || getCompareLabel()})`
                            };
                            return [`฿${value.toLocaleString()}`, labels[name] || name];
                          }}
                          labelFormatter={(label) => combinedChartData.find(d => d.month === label)?.fullMonth || label}
                          cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                        />
                        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ r: 5 }} name="revenue" />
                        <Line type="monotone" dataKey="expense" stroke="#ef4444" strokeWidth={3} dot={{ r: 5 }} name="expense" />
                        {compareEnabled && (
                          <>
                            <Line type="monotone" dataKey="compareRevenue" stroke="#10b981" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} name="compareRevenue" opacity={0.6} />
                            <Line type="monotone" dataKey="compareExpense" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4 }} name="compareExpense" opacity={0.6} />
                          </>
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                    {compareEnabled && (
                      <div className="space-y-2 mt-4">
                        <div className="flex items-center gap-4 text-xs justify-center flex-wrap">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-0.5 bg-green-500" />
                            <span className="text-slate-600">รายได้ปัจจุบัน</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-0.5 bg-green-500 opacity-60" style={{ borderTop: '2px dashed #10b981' }} />
                            <span className="text-slate-600">รายได้ ({getCompareLabel()})</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-0.5 bg-red-500" />
                            <span className="text-slate-600">ค่าใช้จ่ายปัจจุบัน</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-0.5 bg-red-500 opacity-60" style={{ borderTop: '2px dashed #ef4444' }} />
                            <span className="text-slate-600">ค่าใช้จ่าย ({getCompareLabel()})</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* กราฟสรุปรายได้ตามประเภท */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                  <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl overflow-hidden rounded-3xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-green-200/20 to-emerald-200/15 rounded-full blur-3xl" />
                    <CardHeader className="pb-4 relative">
                      <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-green-600" />
                        รวมรายได้ตามประเภท
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative">
                      {revenueByCategoryData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={300}>
                            <RechartsPieChart>
                              <Pie
                                data={revenueByCategoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={120}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {revenueByCategoryData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderRadius: '16px', border: 'none', color: '#ffffff' }}
                                itemStyle={{ color: '#ffffff', fontWeight: 600 }}
                                formatter={(value) => [`฿${value.toLocaleString()}`, 'รายได้']}
                              />
                              <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" className="text-xl font-bold fill-green-700">
                                ฿{revenueByCategoryData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                              </text>
                              <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="text-sm fill-slate-500">
                                รายได้รวม
                              </text>
                            </RechartsPieChart>
                          </ResponsiveContainer>
                          <div className="flex flex-wrap justify-center gap-3 mt-4">
                            {revenueByCategoryData.map((item) => (
                              <div key={item.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-xs text-slate-600">{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-slate-500">
                          ไม่มีข้อมูลรายได้
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* กราฟสรุปค่าใช้จ่ายตามประเภท */}
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl overflow-hidden rounded-3xl">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-red-200/20 to-orange-200/15 rounded-full blur-3xl" />
                    <CardHeader className="pb-4 relative">
                      <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-red-600" />
                        รวมค่าใช้จ่ายตามประเภท
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative">
                      {expenseByCategoryData.length > 0 ? (
                        <>
                          <ResponsiveContainer width="100%" height={300}>
                            <RechartsPieChart>
                              <Pie
                                data={expenseByCategoryData}
                                cx="50%"
                                cy="50%"
                                innerRadius={80}
                                outerRadius={120}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {expenseByCategoryData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{ backgroundColor: '#1e293b', borderRadius: '16px', border: 'none', color: '#ffffff' }}
                                itemStyle={{ color: '#ffffff', fontWeight: 600 }}
                                formatter={(value) => [`฿${value.toLocaleString()}`, 'ค่าใช้จ่าย']}
                              />
                              <text x="50%" y="45%" textAnchor="middle" dominantBaseline="middle" className="text-xl font-bold fill-red-700">
                                ฿{expenseByCategoryData.reduce((sum, item) => sum + item.value, 0).toLocaleString()}
                              </text>
                              <text x="50%" y="55%" textAnchor="middle" dominantBaseline="middle" className="text-sm fill-slate-500">
                                ค่าใช้จ่ายรวม
                              </text>
                            </RechartsPieChart>
                          </ResponsiveContainer>
                          <div className="flex flex-wrap justify-center gap-3 mt-4">
                            {expenseByCategoryData.map((item) => (
                              <div key={item.name} className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-xs text-slate-600">{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-slate-500">
                          ไม่มีข้อมูลค่าใช้จ่าย
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </div>

              {/* กราฟกำไร/ขาดทุนรายเดือน */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl overflow-hidden rounded-3xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
                  <CardHeader className="pb-4 relative">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      กำไร/ขาดทุนรายเดือน
                      {compareEnabled && (
                        <Badge className="bg-purple-100 text-purple-700 ml-2">
                          เปรียบเทียบกับ {getCompareLabel()}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={combinedChartData}>
                        <defs>
                          <linearGradient id="profitBlue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.85}/>
                            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.85}/>
                          </linearGradient>
                          <linearGradient id="profitOrange" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#fb923c" stopOpacity={0.85}/>
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0.85}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} />
                        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', borderRadius: '16px', border: 'none', color: '#ffffff' }}
                          itemStyle={{ color: '#ffffff', fontWeight: 600 }}
                          labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: 8 }}
                          formatter={(value, name, props) => {
                            const labels = {
                              profit: `${value >= 0 ? 'กำไร' : 'ขาดทุน'} (${props.payload.fullMonth})`,
                              compareProfit: `${value >= 0 ? 'กำไร' : 'ขาดทุน'} (${props.payload.compareMonth || getCompareLabel()})`
                            };
                            return [`฿${value.toLocaleString()}`, labels[name] || (value >= 0 ? 'กำไร' : 'ขาดทุน')];
                          }}
                          cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                        />
                        <Bar dataKey="profit" radius={[20, 20, 20, 20]} name="profit" barSize={compareEnabled ? 30 : 40}>
                          {combinedChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? 'url(#profitBlue)' : 'url(#profitOrange)'} />
                          ))}
                        </Bar>
                        {compareEnabled && (
                          <Bar dataKey="compareProfit" radius={[20, 20, 20, 20]} name="compareProfit" barSize={30} opacity={0.5}>
                            {combinedChartData.map((entry, index) => (
                              <Cell key={`cell-compare-${index}`} fill={entry.compareProfit >= 0 ? '#3b82f6' : '#fb923c'} />
                            ))}
                          </Bar>
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                    {compareEnabled && (
                      <div className="flex items-center gap-4 mt-4 text-xs justify-center flex-wrap">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded-sm bg-blue-500" />
                          <span className="text-slate-600">กำไรปัจจุบัน</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded-sm bg-orange-500" />
                          <span className="text-slate-600">ขาดทุนปัจจุบัน</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded-sm bg-blue-500 opacity-60" />
                          <span className="text-slate-600">กำไรเปรียบเทียบ</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-4 rounded-sm bg-orange-500 opacity-60" />
                          <span className="text-slate-600">ขาดทุนเปรียบเทียบ</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* ตารางเปรียบเทียบ (แสดงเมื่อเปิด compare) */}
              {compareEnabled && compareSummary && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
                  <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 shadow-2xl rounded-3xl">
                    <CardHeader>
                      <CardTitle className="text-lg font-bold text-purple-900 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-purple-600" />
                        ตารางเปรียบเทียบ
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-purple-300">
                              <th className="text-left py-3 px-4 font-semibold text-slate-700">รายการ</th>
                              <th className="text-right py-3 px-4 font-semibold text-blue-700">ปัจจุบัน</th>
                              <th className="text-right py-3 px-4 font-semibold text-purple-700">เปรียบเทียบ</th>
                              <th className="text-right py-3 px-4 font-semibold text-slate-700">เปลี่ยนแปลง</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-purple-200 hover:bg-white/60 transition-colors">
                              <td className="py-3 px-4 font-medium text-slate-800">รายได้รวม</td>
                              <td className="py-3 px-4 text-right font-semibold text-green-700">฿{summary.totalRevenue.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right font-semibold text-purple-700">฿{compareSummary.totalRevenue.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right">
                                <Badge className={calculateChange(summary.totalRevenue, compareSummary.totalRevenue) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                  {calculateChange(summary.totalRevenue, compareSummary.totalRevenue) >= 0 && calculateChange(summary.totalRevenue, compareSummary.totalRevenue) !== 0 ? '+' : ''}
                                  {calculateChange(summary.totalRevenue, compareSummary.totalRevenue).toFixed(1)}%
                                </Badge>
                              </td>
                            </tr>
                            <tr className="border-b border-purple-200 hover:bg-white/60 transition-colors">
                              <td className="py-3 px-4 font-medium text-slate-800">ค่าใช้จ่ายรวม</td>
                              <td className="py-3 px-4 text-right font-semibold text-red-700">฿{summary.totalExpenses.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right font-semibold text-purple-700">฿{compareSummary.totalExpenses.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right">
                                <Badge className={calculateChange(summary.totalExpenses, compareSummary.totalExpenses) > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                                  {calculateChange(summary.totalExpenses, compareSummary.totalExpenses) >= 0 && calculateChange(summary.totalExpenses, compareSummary.totalExpenses) !== 0 ? '+' : ''}
                                  {calculateChange(summary.totalExpenses, compareSummary.totalExpenses).toFixed(1)}%
                                </Badge>
                              </td>
                            </tr>
                            <tr className="border-b border-purple-200 hover:bg-white/60 transition-colors">
                              <td className="py-3 px-4 font-medium text-slate-800">กำไรสุทธิ</td>
                              <td className="py-3 px-4 text-right font-bold">
                                <span className={summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>฿{summary.totalProfit.toLocaleString()}</span>
                              </td>
                              <td className="py-3 px-4 text-right font-bold">
                                <span className={compareSummary.totalProfit >= 0 ? 'text-purple-700' : 'text-red-700'}>฿{compareSummary.totalProfit.toLocaleString()}</span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Badge className={calculateChange(summary.totalProfit, compareSummary.totalProfit) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                  {calculateChange(summary.totalProfit, compareSummary.totalProfit) >= 0 && calculateChange(summary.totalProfit, compareSummary.totalProfit) !== 0 ? '+' : ''}
                                  {calculateChange(summary.totalProfit, compareSummary.totalProfit).toFixed(1)}%
                                </Badge>
                              </td>
                            </tr>
                            <tr className="bg-purple-50/50 backdrop-blur-sm">
                              <td className="py-3 px-4 font-medium text-slate-800">% กำไร</td>
                              <td className="py-3 px-4 text-right">
                                <Badge className={parseFloat(summary.profitMargin) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                  {summary.profitMargin}%
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Badge className={parseFloat(compareSummary.profitMargin) >= 0 ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}>
                                  {compareSummary.profitMargin}%
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Badge className={calculateChange(parseFloat(summary.profitMargin), parseFloat(compareSummary.profitMargin)) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                  {calculateChange(parseFloat(summary.profitMargin), parseFloat(compareSummary.profitMargin)) >= 0 && calculateChange(parseFloat(summary.profitMargin), parseFloat(compareSummary.profitMargin)) !== 0 ? '+' : ''}
                                  {calculateChange(parseFloat(summary.profitMargin), parseFloat(compareSummary.profitMargin)).toFixed(1)}%
                                </Badge>
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl overflow-hidden rounded-3xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
                  <CardHeader className="pb-4 relative">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <DoorOpen className="w-5 h-5 text-blue-600" />
                      ยอดเข้าพักรายวัน
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={dailyChartData}>
                        <defs>
                          <linearGradient id="colorDailyBookings" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.85}/>
                            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.85}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} interval={dailyChartData.length > 20 ? 2 : 0} />
                        <YAxis tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', borderRadius: '16px', border: 'none', color: '#ffffff' }}
                          itemStyle={{ color: '#ffffff', fontWeight: 600 }}
                          labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: 8 }}
                          formatter={(value) => [`${value} ห้อง`, 'การเข้าพัก']}
                          labelFormatter={(label) => dailyChartData.find(d => d.day === label)?.fullDate || label}
                          cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                        />
                        <Bar dataKey="dailyBookings" fill="url(#colorDailyBookings)" radius={[12, 12, 0, 0]} name="ยอดเข้าพัก" barSize={dailyChartData.length > 20 ? 18 : 25} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}>
                <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl overflow-hidden rounded-3xl">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
                  <CardHeader className="pb-4 relative">
                    <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-blue-600" />
                      รายได้รายวัน
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <ResponsiveContainer width="100%" height={300}>
                      <ComposedChart data={dailyChartData}>
                        <defs>
                          <linearGradient id="areaRevenue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} />
                        <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} interval={dailyChartData.length > 20 ? 2 : 0} />
                        <YAxis tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', borderRadius: '16px', border: 'none', color: '#ffffff' }}
                          itemStyle={{ color: '#ffffff', fontWeight: 600 }}
                          labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: 8 }}
                          formatter={(value) => [`฿${value.toLocaleString()}`, 'รายได้']}
                          labelFormatter={(label) => dailyChartData.find(d => d.day === label)?.fullDate || label}
                          cursor={false}
                        />
                        <Area type="monotone" dataKey="revenue" fill="url(#areaRevenue)" stroke="none" />
                        <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          )}

          {/* ตารางสรุปการเงิน - แบบรายงานรวม */}
          {reportType === 'monthly' && monthlyChartData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    ตารางสรุปการเงิน ({selectedBranchName})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-blue-200/50">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">เดือน</th>
                          <th className="text-right py-3 px-4 font-semibold text-green-700">รายได้</th>
                          <th className="text-right py-3 px-4 font-semibold text-red-700">ค่าใช้จ่าย</th>
                          <th className="text-right py-3 px-4 font-semibold text-blue-700">กำไร</th>
                          <th className="text-right py-3 px-4 font-semibold text-blue-700">% กำไร</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyChartData.map((data, index) => {
                          const profitPercent = data.revenue > 0 ? ((data.profit / data.revenue) * 100).toFixed(1) : 0;
                          return (
                            <tr key={index} className="border-b border-blue-100/50 hover:bg-white/60 transition-colors">
                              <td className="py-3 px-4 font-medium text-slate-800">{data.fullMonth}</td>
                              <td className="py-3 px-4 text-right font-semibold text-green-700">฿{data.revenue.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right font-semibold text-red-700">฿{data.expense.toLocaleString()}</td>
                              <td className="py-3 px-4 text-right font-bold">
                                <span className={data.profit >= 0 ? 'text-green-600' : 'text-red-600'}>฿{data.profit.toLocaleString()}</span>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <Badge className={parseFloat(profitPercent) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                                  {profitPercent}%
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-blue-50/50 backdrop-blur-sm border-t-2 border-blue-300/60">
                          <td className="py-4 px-4 font-bold text-slate-800">รวมทั้งหมด</td>
                          <td className="py-4 px-4 text-right font-bold text-green-700">฿{monthlyChartData.reduce((sum, d) => sum + d.revenue, 0).toLocaleString()}</td>
                          <td className="py-4 px-4 text-right font-bold text-red-700">฿{summary.totalExpenses.toLocaleString()}</td>
                          <td className="py-4 px-4 text-right font-bold">
                            <span className={summary.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>฿{summary.totalProfit.toLocaleString()}</span>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Badge className={parseFloat(summary.profitMargin) >= 0 ? 'bg-green-100 text-green-700 font-bold' : 'bg-red-100 text-red-700 font-bold'}>
                              {summary.profitMargin}%
                            </Badge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-xl rounded-3xl">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Building2 className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1">💡 เกี่ยวกับรายงานภาพรวม</h4>
                  <ul className="text-sm text-slate-700 space-y-1 list-disc ml-4">
                    {reportType === 'monthly' ? (
                      <>
                        <li>เลือกปีและเดือนที่ต้องการดูข้อมูล</li>
                        <li>เลือกช่วงเวลา 3, 6 หรือ 12 เดือนย้อนหลัง</li>
                        <li>กราฟแสดงแนวโน้มรายได้ ค่าใช้จ่าย และกำไร</li>
                        <li>ตารางแสดงรายละเอียดรายรับ-รายจ่ายแต่ละเดือน</li>
                        <li>ใช้ AI วิเคราะห์เพื่อรับคำแนะนำเชิงลึก</li>
                        <li><strong>✨ เปิดโหมดเปรียบเทียบเพื่อดูความแตกต่างระหว่างช่วงเวลา</strong></li>
                        <li><strong>แสดงข้อมูลเฉพาะสาขา {selectedBranchName}</strong></li>
                      </>
                    ) : (
                      <>
                        <li>เลือกปีและเดือนที่ต้องการดูรายงานรายวัน</li>
                        <li>แสดงข้อมูลทุกวันในเดือนที่เลือก</li>
                        <li>ยอดเข้าพัก: จำนวนห้องที่จองรายวัน</li>
                        <li>รายได้: เงินที่ชำระแล้วของห้องรายวันแต่ละวัน</li>
                        <li><strong>แสดงข้อมูลเฉพาะสาขา {selectedBranchName}</strong></li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}