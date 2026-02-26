import React, { useMemo, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Building2, DoorOpen, Users, CreditCard, AlertTriangle, TrendingUp, Plus, Loader2, Settings as SettingsIcon, Calendar as CalendarIconLucide, ArrowUpRight, ArrowDownRight, DollarSign, Wallet, X, Globe, PieChart } from "lucide-react";
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart as RechartsPieChart, Pie } from "recharts";
import { motion } from "framer-motion";
import { useNavigate, Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import StatsCard from "../components/dashboard/StatsCard";
import { Badge } from "@/components/ui/badge";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears, parseISO, isWithinInterval, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";
import AIInsights from "../components/dashboard/AIInsights";
import PageHeader from "../components/shared/PageHeader";

export default function AllBranchesDashboard() {
  const navigate = useNavigate();

  const [dateRangeType, setDateRangeType] = useState('this_month');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [compareType, setCompareType] = useState('last_month');
  const [customRange, setCustomRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  const [showAIInsights, setShowAIInsights] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const [showQuickStats, setShowQuickStats] = useState(() => {
    const storedValue = localStorage.getItem('hideQuickStats');
    return storedValue !== 'true';
  });
  const [showInfoCard, setShowInfoCard] = useState(() => {
    const storedValue = localStorage.getItem('hideInfoCard');
    return storedValue !== 'true';
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 60 * 60 * 1000,
  });

  const userRole = currentUser?.role === 'admin' ? 'developer' : (currentUser?.custom_role || 'employee');
  const userAccessibleBranches = currentUser?.accessible_branches;
  const canViewAllBranches = userRole === 'developer';

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  };

  const { data: allBranches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    ...retryConfig,
    staleTime: 8 * 60 * 60 * 1000,
    gcTime: 16 * 60 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const branches = useMemo(() => {
    if (userRole === 'developer') return allBranches;
    
    const hasAccessibleBranchesSet = userAccessibleBranches !== null && userAccessibleBranches !== undefined;
    if (hasAccessibleBranchesSet) {
      return allBranches.filter(b => userAccessibleBranches.includes(b.id));
    }
    
    if (userRole === 'owner') {
      return allBranches.filter(b => 
        b.owner_id === currentUser?.email || 
        b.created_by === currentUser?.email
      );
    }
    
    return [];
  }, [allBranches, userRole, userAccessibleBranches, currentUser?.email]);

  // สร้าง Set ของ branch IDs ที่เข้าถึงได้เพื่อกรองข้อมูล
  const accessibleBranchIds = useMemo(() => 
    new Set(branches.map(b => b.id)), 
    [branches]
  );

  const { data: allRooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['allRooms'],
    queryFn: () => base44.entities.Room.list('-room_number', 10000),
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // กรองห้องตามสาขาที่เข้าถึงได้
  const rooms = useMemo(() => 
    allRooms.filter(room => accessibleBranchIds.has(room.branch_id)),
    [allRooms, accessibleBranchIds]
  );

  const { data: allBookings = [] } = useQuery({
    queryKey: ['allBookings'],
    queryFn: () => base44.entities.Booking.list('', 10000),
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // กรองการจองตามสาขาที่เข้าถึงได้
  const bookings = useMemo(() => {
    if (!Array.isArray(allBookings)) return [];
    return allBookings.filter(booking => accessibleBranchIds.has(booking.branch_id));
  }, [allBookings, accessibleBranchIds]);

  const { data: allPayments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['allPayments'],
    queryFn: () => base44.entities.Payment.list('', 10000),
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // กรอง payments ตามสาขาที่เข้าถึงได้
  const payments = useMemo(() => 
    allPayments.filter(payment => accessibleBranchIds.has(payment.branch_id)),
    [allPayments, accessibleBranchIds]
  );

  const { data: allTenants = [] } = useQuery({
    queryKey: ['allTenants'],
    queryFn: () => base44.entities.Tenant.list('', 10000),
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // กรองผู้เช่าตามสาขาที่เข้าถึงได้
  const tenants = useMemo(() => 
    allTenants.filter(tenant => accessibleBranchIds.has(tenant.branch_id)),
    [allTenants, accessibleBranchIds]
  );

  const { data: allMaintenance = [] } = useQuery({
    queryKey: ['allMaintenance'],
    queryFn: () => base44.entities.MaintenanceRequest.list('', 1000),
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // กรองแจ้งซ่อมตามสาขาที่เข้าถึงได้
  const maintenanceRequests = useMemo(() => 
    allMaintenance.filter(maintenance => accessibleBranchIds.has(maintenance.branch_id)),
    [allMaintenance, accessibleBranchIds]
  );

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['allExpenses'],
    queryFn: () => base44.entities.Expense.list('-date', 10000),
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // กรองค่าใช้จ่ายตามสาขาที่เข้าถึงได้
  const expenses = useMemo(() => 
    allExpenses.filter(expense => accessibleBranchIds.has(expense.branch_id)),
    [allExpenses, accessibleBranchIds]
  );

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: async () => {
      const allConfigs = await base44.entities.Config.list();
      // 🔒 Security: Filter configs based on accessible branches
      if (userRole === 'developer') return allConfigs;
      
      const accessibleBranchIds = userAccessibleBranches || [];
      return allConfigs.filter(c => 
        !c.branch_id || // Global configs
        accessibleBranchIds.includes(c.branch_id) // Only configs from accessible branches
      );
    },
    enabled: !!currentUser,
    ...retryConfig,
    staleTime: 4 * 60 * 60 * 1000,
    gcTime: 8 * 60 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const { data: allMaterialDeliveries = [] } = useQuery({
    queryKey: ['allMaterialDeliveries'],
    queryFn: () => base44.entities.MaterialDelivery.list('-delivery_date', 500),
    ...retryConfig,
    staleTime: 4 * 60 * 60 * 1000,
    gcTime: 8 * 60 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // กรองพัสดุตามสาขาที่เข้าถึงได้
  const materialDeliveries = useMemo(() => 
    allMaterialDeliveries.filter(delivery => accessibleBranchIds.has(delivery.branch_id)),
    [allMaterialDeliveries, accessibleBranchIds]
  );

  useEffect(() => {
    if (branches.length > 0 && !showAIInsights) {
      const timer = setTimeout(() => setShowAIInsights(true), 2000);
      return () => clearTimeout(timer);
    }
  }, [branches.length, showAIInsights]);

  const isLoading = branchesLoading || roomsLoading;

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
  }, [configs, getCurrentDate]);

  const getDateRange = () => {
    const now = new Date();
    switch(dateRangeType) {
      case 'all':
        return { from: new Date(2020, 0, 1), to: new Date(2030, 11, 31) };
      case 'this_month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'last_month':
        return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(now) };
      case 'last_3_months':
        return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
      case '3_months':
        return { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
      case '6_months':
        return { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) };
      case '12_months':
        return { from: startOfMonth(subMonths(now, 11)), to: endOfMonth(now) };
      case 'this_year':
        return { from: startOfYear(now), to: endOfYear(now) };
      case 'last_year':
        return { from: startOfYear(subYears(now, 1)), to: endOfYear(subYears(now, 1)) };
      case 'custom':
        return customRange;
      default:
        return { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) };
    }
  };

  const getCompareRange = () => {
    const now = new Date();
    switch(compareType) {
      case 'last_month':
        return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
      case 'last_3_months':
        return { from: startOfMonth(subMonths(now, 3)), to: endOfMonth(subMonths(now, 1)) };
      case 'last_6_months':
        return { from: startOfMonth(subMonths(now, 6)), to: endOfMonth(subMonths(now, 1)) };
      case 'last_12_months':
        return { from: startOfMonth(subMonths(now, 12)), to: endOfMonth(subMonths(now, 1)) };
      case 'this_year':
        return { from: startOfYear(now), to: endOfYear(now) };
      case 'last_year':
        return { from: startOfYear(subYears(now, 1)), to: endOfYear(subYears(now, 1)) };
      default:
        return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
    }
  };

  const dateRange = getDateRange();
  const compareRange = getCompareRange();

  const [showDebug, setShowDebug] = useState(false);
  
  const debugInfo = useMemo(() => ({
    dateRangeType,
    dateRange: {
      from: dateRange.from.toISOString(),
      to: dateRange.to.toISOString()
    },
    userRole,
    canViewAllBranches,
    userAccessibleBranches,
    allBranchesCount: allBranches.length,
    filteredBranchesCount: branches.length,
    branchIds: branches.map(b => ({ id: b.id, name: b.branch_name })),
    accessibleBranchIds: Array.from(accessibleBranchIds),
    allPaymentsCount: allPayments.length,
    filteredPaymentsCount: payments.length,
    paidPayments: payments.filter(p => p.status === 'paid').length,
    paymentsInRange: payments.filter(p => {
      if (p.status !== 'paid' || !p.payment_date) return false;
      try {
        const paymentDate = parseISO(p.payment_date);
        return isWithinInterval(paymentDate, { start: dateRange.from, end: dateRange.to });
      } catch { return false; }
    }).length,
    samplePaidPayments: payments.filter(p => p.status === 'paid').slice(0, 5).map(p => ({ 
      branch_id: p.branch_id, 
      date: p.payment_date, 
      amount: p.total_amount 
    })),
  }), [dateRangeType, dateRange, payments, branches, userRole, userAccessibleBranches, allBranches.length, allPayments.length, accessibleBranchIds]);

  const getMonthsForChart = () => {
    switch(dateRangeType) {
      case 'this_month': return 6;
      case 'last_month': return 6;
      case '3_months': return 3;
      case '6_months': return 6;
      case '12_months': return 12;
      case 'last_3_months': return 3;
      case 'this_year': return new Date().getMonth() + 1;
      case 'last_year': return 12;
      case 'all': return (new Date().getFullYear() - 2020 + 1) * 12;
      case 'custom':
        if (customRange.from && customRange.to) {
          const start = startOfMonth(customRange.from);
          const end = endOfMonth(customRange.to);
          return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth() + 1);
        }
        return 6;
      default: return 6;
    }
  };

  const dateRangeMonths = getMonthsForChart();

  const monthlyChartData = useMemo(() => {
    const monthsData = [];
    const now = new Date();
    
    for (let i = dateRangeMonths - 1; i >= 0; i--) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));

      const monthPayments = payments.filter(p => {
        if (!p.payment_date || p.status !== 'paid') return false;
        try {
          const paymentDate = parseISO(p.payment_date);
          if (isNaN(paymentDate.getTime())) return false;
          return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      });

      const monthExpenses = expenses.filter(e => {
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
      const occupiedRoomsCount = rooms.filter(r => r.status === 'occupied').length;
      const totalRoomsCount = rooms.length;

      monthsData.push({
        month: format(monthStart, 'MMM', { locale: th }),
        fullMonth: format(monthStart, 'MMMM yyyy', { locale: th }),
        revenue,
        expense,
        profit,
        occupiedRooms: occupiedRoomsCount,
        occupancyRate: totalRoomsCount > 0 ? ((occupiedRoomsCount / totalRoomsCount) * 100).toFixed(1) : 0
      });
    }

    return monthsData;
  }, [payments, expenses, rooms, dateRangeMonths]);

  const compareChartData = useMemo(() => {
    if (!compareEnabled) return [];
    
    const monthsData = [];
    
    const monthsBetween = (compareRange.to.getFullYear() - compareRange.from.getFullYear()) * 12 + (compareRange.to.getMonth() - compareRange.from.getMonth() + 1);
    
    for (let i = 0; i < monthsBetween; i++) {
      const monthStart = startOfMonth(new Date(compareRange.from.getFullYear(), compareRange.from.getMonth() + i, 1));
      const monthEnd = endOfMonth(monthStart);

      const monthPayments = payments.filter(p => {
        if (!p.payment_date || p.status !== 'paid') return false;
        try {
          const paymentDate = parseISO(p.payment_date);
          if (isNaN(paymentDate.getTime())) return false;
          return isWithinInterval(paymentDate, { start: monthStart, end: monthEnd });
        } catch {
          return false;
        }
      });

      const monthExpenses = expenses.filter(e => {
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

      monthsData.push({
        month: format(monthStart, 'MMM', { locale: th }),
        fullMonth: format(monthStart, 'MMMM yyyy', { locale: th }),
        revenue,
        expense
      });
    }

    return monthsData;
  }, [payments, expenses, compareEnabled, compareRange]);

  const combinedChartData = useMemo(() => {
    if (!compareEnabled) return monthlyChartData;

    return monthlyChartData.map((current, index) => {
      const compare = compareChartData[index] || {};
      return {
        ...current,
        compareRevenue: compare.revenue || 0,
        compareExpense: compare.expense || 0,
        compareMonth: compare.fullMonth || ''
      };
    });
  }, [monthlyChartData, compareChartData, compareEnabled]);

  const getCompareLabel = () => {
    switch(compareType) {
      case 'last_month': return 'เดือนที่แล้ว';
      case 'last_3_months': return '3 เดือนที่แล้ว';
      case 'last_6_months': return '6 เดือนที่แล้ว';
      case 'last_12_months': return '12 เดือนที่แล้ว';
      case 'this_year': return 'ปีนี้';
      case 'last_year': return 'ปีที่แล้ว';
      default: return '';
    }
  };

  const summary = useMemo(() => {
    const totalRooms = rooms.length;
    const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
    const availableRooms = rooms.filter(r => r.status === 'available').length;
    const occupancyRate = totalRooms > 0 ? ((occupiedRooms / totalRooms) * 100).toFixed(1) : 0;

    const activeBookings = bookings.filter(b => b.status === 'active').length;
    const totalTenants = tenants.length;

    let paidPayments = [];
    let pendingPayments = [];
    
    paidPayments = payments.filter(p => {
      if (p.status !== 'paid' || !p.payment_date) return false;
      try {
        const paymentDate = parseISO(p.payment_date);
        if (isNaN(paymentDate.getTime())) return false;
        return isWithinInterval(paymentDate, { start: dateRange.from, end: dateRange.to });
      } catch {
        return false;
      }
    });

    pendingPayments = payments.filter(p => p.status !== 'paid');
    
    const totalRevenue = paidPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    const pendingRevenue = pendingPayments.reduce((sum, p) => {
      const baseAmount = p.total_amount || 0;
      const lateFee = calculateLateFee(p);
      return sum + baseAmount + lateFee;
    }, 0);

    const totalExpenses = monthlyChartData.reduce((sum, d) => sum + d.expense, 0);
    const totalProfit = monthlyChartData.reduce((sum, d) => sum + d.profit, 0);
    const totalChartRevenue = monthlyChartData.reduce((sum, d) => sum + d.revenue, 0);
    const profitMargin = totalChartRevenue > 0 ? ((totalProfit / totalChartRevenue) * 100).toFixed(1) : 0;

    return {
      totalRooms,
      occupiedRooms,
      availableRooms,
      occupancyRate,
      activeBookings,
      totalTenants,
      totalRevenue,
      pendingRevenue,
      paidCount: paidPayments.length,
      pendingCount: pendingPayments.length,
      totalExpenses,
      totalProfit,
      profitMargin
    };
  }, [rooms, bookings, tenants, payments, dateRange, monthlyChartData, dateRangeType, calculateLateFee]);

  const compareStats = useMemo(() => {
    if (!compareEnabled) return null;

    const comparePayments = payments.filter(payment => {
      if (!payment.payment_date || payment.status !== 'paid') return false;
      try {
        const paymentDate = parseISO(payment.payment_date);
        return isWithinInterval(paymentDate, { start: compareRange.from, end: compareRange.to });
      } catch {
        return false;
      }
    });

    const totalRevenue = comparePayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);

    return { totalRevenue };
  }, [payments, compareRange, compareEnabled, compareType]);

  const calculateChange = (current, previous) => {
    if (!previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  };

  const revenueChange = compareEnabled && compareStats
    ? calculateChange(summary.totalRevenue, compareStats.totalRevenue)
    : 0;

  const branchComparisonData = useMemo(() => {
    return branches.map(branch => {
      const branchRooms = rooms.filter(r => r.branch_id === branch.id);
      const branchPayments = payments.filter(p => p.branch_id === branch.id);
      const branchExpenses = expenses.filter(e => e.branch_id === branch.id);

      const occupied = branchRooms.filter(r => r.status === 'occupied').length;
      const total = branchRooms.length;
      const occupancyRate = total > 0 ? ((occupied / total) * 100).toFixed(1) : 0;

      const paidPayments = branchPayments.filter(p => {
        if (p.status !== 'paid' || !p.payment_date) return false;
        try {
          const paymentDate = parseISO(p.payment_date);
          return isWithinInterval(paymentDate, { start: dateRange.from, end: dateRange.to });
        } catch {
          return false;
        }
      });

      const rangeExpenses = branchExpenses.filter(e => {
        if (!e.date) return false;
        try {
          const expenseDate = parseISO(e.date);
          return isWithinInterval(expenseDate, { start: dateRange.from, end: dateRange.to });
        } catch {
          return false;
        }
      });

      const revenue = paidPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const expense = rangeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
      const profit = revenue - expense;
      const profitMargin = revenue > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;

      return {
        name: branch.branch_name,
        revenue,
        expense,
        profit,
        profitMargin,
        occupancyRate,
        totalRooms: total,
        occupiedRooms: occupied
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [branches, rooms, payments, expenses, dateRange]);

  const branchStats = useMemo(() => {
    return branches.map(branch => {
      const branchRooms = rooms.filter(r => r.branch_id === branch.id);
      const branchBookings = bookings.filter(b => b.branch_id === branch.id && b.status === 'active');
      const branchPayments = payments.filter(p => p.branch_id === branch.id);
      
      const occupied = branchRooms.filter(r => r.status === 'occupied').length;
      const total = branchRooms.length;
      const occupancyRate = total > 0 ? ((occupied / total) * 100).toFixed(1) : 0;
      
      let paidPayments = [];
      let pendingPayments = [];

      paidPayments = branchPayments.filter(p => {
        if (p.status !== 'paid' || !p.payment_date) return false;
        try {
          const paymentDate = parseISO(p.payment_date);
          return isWithinInterval(paymentDate, { start: dateRange.from, end: dateRange.to });
        } catch {
          return false;
        }
      });

      pendingPayments = branchPayments.filter(p => p.status !== 'paid');
      
      const revenue = paidPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
      const pending = pendingPayments.reduce((sum, p) => {
        const baseAmount = p.total_amount || 0;
        const lateFee = calculateLateFee(p);
        return sum + baseAmount + lateFee;
      }, 0);

      return {
        ...branch,
        totalRooms: total,
        occupiedRooms: occupied,
        occupancyRate,
        activeBookings: branchBookings.length,
        revenue,
        pendingRevenue: pending,
        paidCount: paidPayments.length,
        pendingCount: pendingPayments.length
      };
    });
  }, [branches, rooms, bookings, payments, dateRange, calculateLateFee]);

  const dateRangeLabel = () => {
    switch(dateRangeType) {
      case 'all': return 'ทั้งหมด';
      case 'this_month': return `เดือนนี้ (${format(dateRange.from, 'MMM yyyy', { locale: th })})`;
      case 'last_month': return `เดือนที่แล้ว (${format(dateRange.from, 'MMM yyyy', { locale: th })})`;
      case 'last_3_months': return '3 เดือนย้อนหลัง';
      case '3_months': return '3 เดือนล่าสุด';
      case '6_months': return '6 เดือนล่าสุด';
      case '12_months': return '12 เดือนล่าสุด';
      case 'this_year': return `ปีนี้ (${format(dateRange.from, 'yyyy', { locale: th })})`;
      case 'last_year': return `ปีที่แล้ว (${format(dateRange.from, 'yyyy', { locale: th })})`;
      case 'custom': return `${format(dateRange.from, 'd MMM', { locale: th })} - ${format(dateRange.to, 'd MMM yyyy', { locale: th })}`;
      default: return '6 เดือนล่าสุด';
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const handleDismissQuickStats = () => {
    localStorage.setItem('hideQuickStats', 'true');
    setShowQuickStats(false);
  };

  const handleDismissInfoCard = () => {
    localStorage.setItem('hideInfoCard', 'true');
    setShowInfoCard(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <PageHeader 
          title="รายงานรวมทุกสาขา" 
          subtitle="ภาพรวมข้อมูลจากทุกสาขา"
          icon={Globe}
          showNotifications={true}
        />
        <div className="px-4 md:px-8 py-6">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 text-lg">กำลังโหลดข้อมูลทุกสาขา...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ถ้าไม่มีสาขาเลย แสดงหน้าต้อนรับ
  if (!isLoading && branches.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        </div>

        <PageHeader 
          title="รายงานรวมทุกสาขา" 
          subtitle="ภาพรวมข้อมูลจากทุกสาขา"
          icon={Globe}
          showNotifications={true}
        />

        <div className="px-4 md:px-8 py-6 relative z-10">
          <div className="max-w-2xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Card className="bg-white/80 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-3xl overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-purple-200/15 rounded-full blur-3xl" />
                
                <CardContent className="p-12 text-center relative">
                  <div className="mb-8">
                    <div className="relative w-32 h-32 mx-auto mb-6">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full blur-2xl opacity-30 animate-pulse" />
                      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-2xl">
                        <Building2 className="w-16 h-16 text-white" />
                      </div>
                    </div>
                    
                    <h2 className="text-3xl font-bold text-slate-800 mb-3">
                      สวัสดีค่ะ ยินดีต้อนรับสู่<br/>ระบบจัดการหอพักหลังบ้าน
                    </h2>
                    <p className="text-lg text-slate-600 mb-6">
                      ระบบพร้อมให้คุณใช้งานแล้วค่ะ
                    </p>
                  </div>

                  <div className="bg-blue-50 rounded-2xl p-6 mb-6">
                    <p className="text-sm text-slate-700 mb-4">
                      เริ่มต้นด้วยการสร้างสาขาแรกของคุณ
                    </p>
                    <Button
                      onClick={() => navigate(createPageUrl('BranchManagement'))}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg text-lg px-8 py-6"
                    >
                      <Building2 className="w-5 h-5 mr-2" />
                      สร้างสาขาแรก
                    </Button>
                  </div>

                  <p className="text-xs text-slate-500">
                    หลังจากสร้างสาขาแล้ว คุณจะสามารถเพิ่มห้องพัก ผู้เช่า และจัดการระบบได้เต็มรูปแบบ
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <PageHeader 
        title="รายงานรวมทุกสาขา" 
        subtitle="ภาพรวมข้อมูลจากทุกสาขา"
        icon={Globe}
        showNotifications={true}
        actions={
          <>
            {userRole === 'developer' && (
              <Button
                onClick={() => setShowDebug(!showDebug)}
                variant="outline"
                size="sm"
                className="border-orange-400 text-orange-600 hover:bg-orange-50"
              >
                🐛 Debug
              </Button>
            )}
            <Button
              onClick={() => navigate(createPageUrl('Settings'))}
              variant="outline"
              className="border-indigo-600 text-indigo-600 hover:bg-indigo-50 shadow-md"
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              ตั้งค่า
            </Button>
            <Button
              onClick={() => navigate(createPageUrl('BranchManagement'))}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              <Building2 className="w-4 h-4 mr-2" />
              จัดการสาขา
            </Button>
          </>
        }
      />

      <div className="px-4 md:px-8 py-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Debug Panel - Developer Only */}
          {showDebug && userRole === 'developer' && (
            <Card className="bg-orange-50 border-2 border-orange-300 rounded-xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-orange-800 flex items-center gap-2">
                  🐛 Debug Info
                  <Button size="sm" variant="ghost" onClick={() => setShowDebug(false)} className="ml-auto">✕</Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                  <div className="bg-white rounded p-2">
                    <p className="text-orange-600 font-semibold">สาขาทั้งหมด</p>
                    <p className="text-lg font-bold">{debugInfo.allBranchesCount}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-orange-600 font-semibold">สาขาที่เห็น</p>
                    <p className="text-lg font-bold">{debugInfo.filteredBranchesCount}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-orange-600 font-semibold">Payment ทั้งหมด</p>
                    <p className="text-lg font-bold">{debugInfo.allPaymentsCount}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-orange-600 font-semibold">Payment ที่กรองแล้ว</p>
                    <p className="text-lg font-bold">{debugInfo.filteredPaymentsCount}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-orange-600 font-semibold">ชำระแล้ว (paid)</p>
                    <p className="text-lg font-bold">{debugInfo.paidPayments}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-orange-600 font-semibold">อยู่ใน date range</p>
                    <p className="text-lg font-bold">{debugInfo.paymentsInRange}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-orange-600 font-semibold">Role</p>
                    <p className="text-lg font-bold">{debugInfo.userRole}</p>
                  </div>
                  <div className="bg-white rounded p-2">
                    <p className="text-orange-600 font-semibold">ดูทุกสาขา?</p>
                    <p className="text-lg font-bold">{debugInfo.canViewAllBranches ? '✅' : '❌'}</p>
                  </div>
                </div>
                <div className="bg-white rounded p-2 mb-2">
                  <p className="text-orange-600 font-semibold mb-1">Date Range: {debugInfo.dateRangeType}</p>
                  <p className="text-slate-600">{debugInfo.dateRange.from} → {debugInfo.dateRange.to}</p>
                </div>
                <div className="bg-white rounded p-2 mb-2">
                  <p className="text-orange-600 font-semibold mb-1">สาขาที่เข้าถึงได้:</p>
                  <p className="text-slate-600 break-all">{JSON.stringify(debugInfo.branchIds)}</p>
                </div>
                <div className="bg-white rounded p-2">
                  <p className="text-orange-600 font-semibold mb-1">ตัวอย่าง Paid Payments:</p>
                  <pre className="text-slate-600 overflow-auto max-h-32">{JSON.stringify(debugInfo.samplePaidPayments, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Date Range Selection - All in One Card */}
          <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-3xl overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
            <CardContent className="p-3 md:p-4 relative">
              <div className="flex flex-col gap-2.5">
                {/* แถวแรก */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700 shrink-0">ช่วงเวลา:</span>
                  
                  {/* Dropdown รวมทุกช่วงเวลา - ลดความกว้าง */}
                  <Select value={dateRangeType} onValueChange={setDateRangeType}>
                    <SelectTrigger className="w-28 h-8 bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-lg text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="this_month">เดือนนี้</SelectItem>
                      <SelectItem value="last_month">1 เดือนที่แล้ว</SelectItem>
                      <SelectItem value="3_months">3 เดือน</SelectItem>
                      <SelectItem value="6_months">6 เดือน</SelectItem>
                      <SelectItem value="12_months">12 เดือน</SelectItem>
                      <SelectItem value="this_year">ปีนี้</SelectItem>
                      <SelectItem value="last_year">ปีที่แล้ว</SelectItem>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="custom">กำหนดเอง</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Dropdown เลือกปี - อยู่แถวเดียวกัน */}
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

                  {/* Custom Date Picker */}
                  {dateRangeType === 'custom' && (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2 h-8 border-green-300 text-green-700 hover:bg-green-50 rounded-lg text-xs px-2"
                        >
                          <CalendarIconLucide className="w-3.5 h-3.5" />
                          {format(customRange.from, 'd MMM', { locale: th })} - {format(customRange.to, 'd MMM', { locale: th })}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                          mode="range"
                          selected={customRange}
                          onSelect={(range) => {
                            if (range?.from && range?.to) {
                              setCustomRange(range);
                            }
                          }}
                          numberOfMonths={2}
                          locale={th}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* แถวที่สอง */}
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
                      เปรียบเทียบ
                    </label>
                  </div>

                  {compareEnabled && (
                    <Select value={compareType} onValueChange={setCompareType}>
                      <SelectTrigger className="w-36 h-8 bg-purple-50 border-purple-300 rounded-lg text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="last_month">เดือนที่แล้ว</SelectItem>
                        <SelectItem value="last_3_months">3 เดือนที่แล้ว</SelectItem>
                        <SelectItem value="last_6_months">6 เดือนที่แล้ว</SelectItem>
                        <SelectItem value="last_12_months">12 เดือนที่แล้ว</SelectItem>
                        <SelectItem value="this_year">ปีนี้</SelectItem>
                        <SelectItem value="last_year">ปีที่แล้ว</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Overall Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="ห้องทั้งหมด"
              value={`${summary.occupiedRooms}/${summary.totalRooms}`}
              icon={DoorOpen}
              gradient="bg-gradient-to-br from-blue-500 to-blue-600"
            />
            <StatsCard
              title="อัตราการเข้าพัก"
              value={`${summary.occupancyRate}%`}
              icon={TrendingUp}
              gradient="bg-gradient-to-br from-green-500 to-emerald-600"
            />
            
            <Card className="relative overflow-hidden bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-500 to-teal-600 opacity-10 blur-3xl" />
              <div className="p-4 md:p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 md:p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                    <CreditCard className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                  {compareEnabled && compareStats && !paymentsLoading && (
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
                <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">รายได้ (ชำระแล้ว)</p>
                {paymentsLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
                    <span className="text-sm text-slate-500">กำลังโหลด...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-xl md:text-3xl font-bold text-slate-800">{summary.totalRevenue.toLocaleString('th-TH')} ฿</p>
                    <p className="text-xs text-slate-500 mt-1">({summary.paidCount} รายการ)</p>
                  </>
                )}
                {compareEnabled && compareStats && !paymentsLoading && (
                  <p className="text-xs text-slate-500 mt-2">
                    เทียบกับ: {compareStats.totalRevenue.toLocaleString('th-TH')} ฿
                  </p>
                )}
              </div>
            </Card>

            <Card className="relative overflow-hidden bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl hover:shadow-2xl transition-all duration-300">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500 to-red-600 opacity-10 blur-3xl" />
              <div className="p-4 md:p-6 relative">
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 md:p-3 rounded-2xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg">
                    <AlertTriangle className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                </div>
                <p className="text-xs md:text-sm font-medium text-slate-500 mb-1">รอชำระ (รวมค่าปรับ)</p>
                {paymentsLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 text-orange-600 animate-spin" />
                    <span className="text-sm text-slate-500">กำลังโหลด...</span>
                  </div>
                ) : (
                  <>
                    <p className="text-xl md:text-3xl font-bold text-slate-800">{summary.pendingRevenue.toLocaleString('th-TH')} ฿</p>
                    <p className="text-xs text-slate-500 mt-1">({summary.pendingCount} รายการ)</p>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* กราฟแนวโน้มรายได้และค่าใช้จ่าย */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* กราฟแนวโน้มรายได้ */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <Card className="bg-gradient-to-br from-blue-400 via-sky-400 to-cyan-500 text-white border-0 shadow-2xl overflow-hidden rounded-3xl relative">
                <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-br from-white/20 via-blue-300/10 to-transparent rounded-full blur-3xl" />
                <div className="absolute bottom-0 left-0 w-56 h-56 bg-gradient-to-tr from-blue-600/30 to-transparent rounded-full blur-2xl" />
                <CardHeader className="pb-4 relative z-10">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base font-bold text-white drop-shadow-md">แนวโน้มรายได้</CardTitle>
                      {compareEnabled && (
                        <Badge className="bg-white/20 text-white border-white/30">
                          vs {getCompareLabel()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-white text-xl font-bold mt-2 drop-shadow-sm">
                      ฿{monthlyChartData.length > 0 ? Math.floor(monthlyChartData.reduce((sum, d) => sum + d.revenue, 0) / monthlyChartData.length).toLocaleString() : 0}
                    </p>
                    <p className="text-white/95 text-xs font-medium drop-shadow-sm">เฉลี่ยต่อเดือน</p>
                    {compareEnabled && compareStats && (
                      <div className="mt-2 flex items-center gap-2">
                        <Badge className="bg-white/20 text-white text-xs">
                          {getCompareLabel()}: ฿{compareChartData.length > 0 ? Math.floor(compareStats.totalRevenue / compareChartData.length).toLocaleString() : 0}
                        </Badge>
                        <Badge className={`text-xs ${
                          revenueChange > 0 ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}%
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <ResponsiveContainer width="100%" height={180}>
                    <ComposedChart data={combinedChartData}>
                      <defs>
                        <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ffffff" stopOpacity={0.7}/>
                          <stop offset="50%" stopColor="#ffffff" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '16px', border: 'none', color: '#ffffff' }}
                        itemStyle={{ color: '#ffffff', fontWeight: 600 }}
                        labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: 8 }}
                        formatter={(value, name, props) => {
                          const labels = {
                            revenue: `รายได้ (${props.payload.fullMonth})`,
                            compareRevenue: `รายได้ (${props.payload.compareMonth || getCompareLabel()})`
                          };
                          return [`฿${value.toLocaleString()}`, labels[name] || name];
                        }}
                        cursor={false}
                      />
                      <Area type="monotone" dataKey="revenue" fill="url(#lineGradient)" stroke="none" />
                      <Line type="monotone" dataKey="revenue" stroke="#ffffff" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#ffffff', strokeWidth: 2, stroke: '#60a5fa' }} />
                      {compareEnabled && (
                        <Line type="monotone" dataKey="compareRevenue" stroke="#ffffff" strokeWidth={2} strokeDasharray="5 5" dot={false} opacity={0.5} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* กราฟสรุปค่าใช้จ่าย */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-blue-300/15 rounded-full blur-3xl" />
                <CardHeader className="pb-4 relative">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-slate-800">สรุปค่าใช้จ่าย</CardTitle>
                    {compareEnabled && (
                      <Badge className="bg-purple-100 text-purple-700">
                        vs {getCompareLabel()}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1 font-medium">รายเดือน (ทุกสาขา)</p>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={240}>
                    <ComposedChart data={combinedChartData}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.85}/>
                          <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.85}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis hide />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)', color: '#ffffff' }}
                        itemStyle={{ color: '#ffffff', fontWeight: 600 }}
                        labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: 8 }}
                        formatter={(value, name, props) => {
                          const labels = {
                            expense: `ค่าใช้จ่าย (${props.payload.fullMonth})`,
                            compareExpense: `ค่าใช้จ่าย (${props.payload.compareMonth || getCompareLabel()})`
                          };
                          return [`฿${value.toLocaleString()}`, labels[name] || name];
                        }}
                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                      />
                      <Bar dataKey="expense" fill="url(#barGradient)" radius={[20, 20, 20, 20]} barSize={compareEnabled ? 30 : 40} />
                      {compareEnabled && (
                        <Bar dataKey="compareExpense" fill="#8b5cf6" radius={[20, 20, 20, 20]} barSize={30} opacity={0.5} />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ตารางเปรียบเทียบสาขา */}
          {branchComparisonData.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-3xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-indigo-600" />
                    เปรียบเทียบประสิทธิภาพระหว่างสาขา
                  </CardTitle>
                  <p className="text-xs text-slate-600 mt-1">ช่วงเวลา: {dateRangeLabel()}</p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-indigo-200/50">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">สาขา</th>
                          <th className="text-right py-3 px-4 font-semibold text-green-700">รายได้</th>
                          <th className="text-right py-3 px-4 font-semibold text-red-700">ค่าใช้จ่าย</th>
                          <th className="text-right py-3 px-4 font-semibold text-blue-700">กำไร</th>
                          <th className="text-right py-3 px-4 font-semibold text-purple-700">% กำไร</th>
                          <th className="text-right py-3 px-4 font-semibold text-indigo-700">อัตราเข้าพัก</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branchComparisonData.map((branch, index) => (
                          <tr key={index} className="border-b border-indigo-100/50 hover:bg-white/60 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                {index === 0 && <span className="text-xl">🏆</span>}
                                {index === 1 && <span className="text-xl">🥈</span>}
                                {index === 2 && <span className="text-xl">🥉</span>}
                                <span className="font-medium text-slate-800">{branch.name}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-green-700">฿{branch.revenue.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-semibold text-red-700">฿{branch.expense.toLocaleString()}</td>
                            <td className="py-3 px-4 text-right font-bold">
                              <span className={branch.profit >= 0 ? 'text-green-600' : 'text-red-600'}>
                                ฿{branch.profit.toLocaleString()}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Badge className={parseFloat(branch.profitMargin) >= 0 ? 'bg-purple-100 text-purple-700' : 'bg-red-100 text-red-700'}>
                                {branch.profitMargin}%
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Badge className="bg-indigo-100 text-indigo-700">
                                {branch.occupancyRate}% ({branch.occupiedRooms}/{branch.totalRooms})
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* กราฟผู้เข้าพักและกราฟกำไร */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* กราฟผู้เข้าพักรายเดือน */}
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
                <CardHeader className="pb-4 relative">
                  <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <DoorOpen className="w-5 h-5 text-blue-600" />
                    ผู้เข้าพักรายเดือน
                  </CardTitle>
                  <p className="text-xs text-slate-600 font-medium">กราฟแท่ง = จำนวนห้องมีผู้เข้าพัก (ทุกสาขา)</p>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={monthlyChartData}>
                      <defs>
                        <linearGradient id="colorOccupancy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.85}/>
                          <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.85}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" opacity={0.5} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: '#334155', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1e293b', borderRadius: '16px', border: 'none', color: '#ffffff' }}
                        itemStyle={{ color: '#ffffff', fontWeight: 600 }}
                        labelStyle={{ color: '#ffffff', fontWeight: 700, marginBottom: 8 }}
                        formatter={(value) => [`${value} ห้อง`, 'ผู้เข้าพัก']}
                        labelFormatter={(label) => monthlyChartData.find(d => d.month === label)?.fullMonth || label}
                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                      />
                      <Bar dataKey="occupiedRooms" fill="url(#colorOccupancy)" radius={[20, 20, 20, 20]} name="ผู้เข้าพัก" barSize={40} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>

            {/* กราฟกำไร/ขาดทุนรายเดือน */}
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
                <CardHeader className="pb-4 relative">
                  <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                    กำไร/ขาดทุนรายเดือน
                  </CardTitle>
                  <p className="text-xs text-slate-600 font-medium">กราฟแท่ง = กำไรสุทธิ (น้ำเงิน = กำไร, ส้ม = ขาดทุน)</p>
                </CardHeader>
                <CardContent className="relative">
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={monthlyChartData}>
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
                        formatter={(value) => [`฿${value.toLocaleString()}`, value >= 0 ? 'กำไร' : 'ขาดทุน']}
                        labelFormatter={(label) => monthlyChartData.find(d => d.month === label)?.fullMonth || label}
                        cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }}
                      />
                      <Bar dataKey="profit" radius={[20, 20, 20, 20]} name="กำไร/ขาดทุน" barSize={40}>
                        {monthlyChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? 'url(#profitBlue)' : 'url(#profitOrange)'} />
                        ))}
                      </Bar>
                    </ComposedChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* AI Insights */}
          {showAIInsights && (
            <AIInsights
              payments={payments}
              expenses={expenses}
              maintenanceRequests={maintenanceRequests}
              tenants={tenants}
              rooms={rooms}
              bookings={bookings}
              branches={branches}
              materialDeliveries={materialDeliveries}
              dateRangeLabel={dateRangeLabel()}
              dateRange={dateRange}
              configs={configs}
              showPredictiveMaintenance={true}
              showTenantBehavior={true}
              showFinancialForecast={true}
              showAnomalyDetection={true}
            />
          )}

          {/* Branch Cards */}
          <div>
            <h2 className="text-2xl font-bold text-slate-800 mb-4">📍 รายละเอียดแยกตามสาขา ({branches.length} สาขา)</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {branchStats.map((branch, index) => (
                <motion.div
                  key={branch.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + (index * 0.1) }}
                >
                  <Card className="bg-white/90 backdrop-blur-sm border-slate-200/60 shadow-xl hover:shadow-2xl transition-all">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          {branch.image_url ? (
                            <img 
                              src={branch.image_url} 
                              alt={branch.branch_name}
                              className="w-16 h-16 rounded-xl object-cover border-2 border-slate-200"
                            />
                          ) : (
                            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
                              <Building2 className="w-8 h-8 text-white" />
                            </div>
                          )}
                          <div>
                            <h3 className="text-xl font-bold text-slate-800">{branch.branch_name}</h3>
                            <p className="text-sm text-slate-500 font-mono">{branch.branch_code}</p>
                          </div>
                        </div>
                        <Link to={createPageUrl('Dashboard')} onClick={() => {
                          localStorage.setItem('selected_branch_id', branch.id);
                          localStorage.setItem('selected_branch_name', branch.branch_name);
                        }}>
                          <Button size="sm" variant="outline">
                            เปิดสาขา →
                          </Button>
                        </Link>
                      </div>

                      {branch.totalRooms === 0 ? (
                        <div className="bg-amber-50 border-2 border-amber-200 rounded-lg p-4 text-center">
                          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
                          <p className="text-amber-800 font-semibold mb-2">🏠 ยังไม่มีห้องพักในสาขานี้</p>
                          <p className="text-sm text-amber-700 mb-3">กรุณาเพิ่มห้องพักเพื่อเริ่มใช้งาน</p>
                          <Button
                            onClick={() => {
                              localStorage.setItem('selected_branch_id', branch.id);
                              localStorage.setItem('selected_branch_name', branch.branch_name);
                              navigate(createPageUrl('Rooms'));
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            เพิ่มห้องพักเลย
                          </Button>
                        </div>
                      ) : (
                        <>
                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-blue-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <DoorOpen className="w-4 h-4 text-blue-600" />
                                <p className="text-xs text-blue-600 font-semibold">ห้องพัก</p>
                              </div>
                              <p className="text-2xl font-bold text-blue-700">
                                {branch.occupiedRooms}/{branch.totalRooms}
                              </p>
                              <p className="text-xs text-blue-600">อัตราเข้าพัก {branch.occupancyRate}%</p>
                            </div>

                            <div className="bg-green-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <CreditCard className="w-4 h-4 text-green-600" />
                                <p className="text-xs text-green-600 font-semibold">รายได้</p>
                              </div>
                              <p className="text-lg font-bold text-green-700">
                                {branch.revenue.toLocaleString()}
                              </p>
                              <p className="text-xs text-green-600">({branch.paidCount} รายการ)</p>
                            </div>

                            <div className="bg-orange-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <AlertTriangle className="w-4 h-4 text-orange-600" />
                                <p className="text-xs text-orange-600 font-semibold">รอชำระ</p>
                              </div>
                              <p className="text-lg font-bold text-orange-700">
                                {branch.pendingRevenue.toLocaleString()}
                              </p>
                              <p className="text-xs text-orange-600">({branch.pendingCount} รายการ)</p>
                            </div>

                            <div className="bg-purple-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Users className="w-4 h-4 text-purple-600" />
                                <p className="text-xs text-purple-600 font-semibold">สัญญา</p>
                              </div>
                              <p className="text-2xl font-bold text-purple-700">
                                {branch.activeBookings}
                              </p>
                              <p className="text-xs text-purple-600">สัญญาใช้งาน</p>
                            </div>
                          </div>

                          {branch.address && (
                            <div className="text-xs text-slate-600 border-t pt-3">
                              <p className="truncate">📍 {branch.address}</p>
                              {branch.phone && <p className="mt-1">📞 {branch.phone}</p>}
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </div>



          {/* ตารางสรุปการเงิน */}
          {monthlyChartData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    ตารางสรุปการเงิน (ทุกสาขา)
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

          {monthlyChartData.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
              <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-3xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <DoorOpen className="w-5 h-5 text-blue-600" />
                    ตารางสรุปผู้เข้าพัก (ทุกสาขา)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b-2 border-blue-200/50">
                          <th className="text-left py-3 px-4 font-semibold text-slate-700">เดือน</th>
                          <th className="text-right py-3 px-4 font-semibold text-blue-700">ห้องเข้าพัก</th>
                          <th className="text-right py-3 px-4 font-semibold text-blue-700">ห้องว่าง</th>
                          <th className="text-right py-3 px-4 font-semibold text-blue-700">อัตราเข้าพัก</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyChartData.map((data, index) => {
                          const totalRoomsCurrent = rooms.length;
                          const vacantRooms = totalRoomsCurrent - data.occupiedRooms;
                          return (
                            <tr key={index} className="border-b border-blue-100/50 hover:bg-white/60 transition-colors">
                              <td className="py-3 px-4 font-medium text-slate-800">{data.fullMonth}</td>
                              <td className="py-3 px-4 text-right font-semibold text-blue-700">{data.occupiedRooms} ห้อง</td>
                              <td className="py-3 px-4 text-right text-slate-600">{vacantRooms} ห้อง</td>
                              <td className="py-3 px-4 text-right">
                                <Badge className="bg-blue-100 text-blue-700 font-semibold">{data.occupancyRate}%</Badge>
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-blue-50/50 backdrop-blur-sm border-t-2 border-blue-300/60">
                          <td className="py-4 px-4 font-bold text-slate-800">ปัจจุบัน</td>
                          <td className="py-4 px-4 text-right font-bold text-blue-700">{summary.occupiedRooms} ห้อง</td>
                          <td className="py-4 px-4 text-right font-bold text-slate-700">{summary.totalRooms - summary.occupiedRooms} ห้อง</td>
                          <td className="py-4 px-4 text-right">
                            <Badge className="bg-blue-600 text-white font-bold text-base px-3 py-1">{summary.occupancyRate}%</Badge>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}