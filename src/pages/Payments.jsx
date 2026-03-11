import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, CreditCard, Upload, Receipt, Edit2, Trash2, DoorOpen, Zap, Droplets, Wifi, Calculator, Send, Users, FileText, AlertTriangle, LayoutGrid, Table as TableIcon, Clock, CheckCircle2, XCircle, Wand2, Building2, TestTube, Search, ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Sparkles, Loader2, ChevronDown, ChevronUp, User, Home, CheckSquare, Check, Settings } from "lucide-react";
import { format, parseISO, differenceInDays, addMonths, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears, isWithinInterval } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "../components/shared/PageHeader";
import ScrollToTopButton from "../components/shared/ScrollToTopButton";

import SendAdvanceReminderButton from "@/components/settings/SendAdvanceReminderButton";
import GenerateMonthlyBillsButton from "@/components/payments/GenerateMonthlyBillsButton";
import SlipPreviewDialog from "@/components/shared/SlipPreviewDialog";
import SendReminderDialog from "@/components/payments/SendReminderDialog";
import ConfirmPaymentDialog from "@/components/payments/ConfirmPaymentDialog";
import PaymentStatCards from "@/components/payments/PaymentStatCards";
import PaymentDetailDialog from "@/components/payments/PaymentDetailDialog";
import PaymentsAISection from "@/components/payments/PaymentsAISection";
import PaymentsReviewBanner from "@/components/payments/PaymentsReviewBanner";
import { getAISearchPrompt, getBulkAIPrompt } from "@/components/payments/PaymentsAIPrompts";

export default function PaymentsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name') || 'ไม่ระบุ';
  
  const urlParams = new URLSearchParams(window.location.search);
  const initialStatusFilter = urlParams.get('status') || 'all';

  const [showDialog, setShowDialog] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [autoCalculating, setAutoCalculating] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [sendingReceipt, setSendingReceipt] = useState(false);
  const [deletingTestData, setDeletingTestData] = useState(false);
  const [expandedPayments, setExpandedPayments] = useState(new Set());
  const [slipPreview, setSlipPreview] = useState({ open: false, url: '', title: '' });
  const [reminderDialog, setReminderDialog] = useState({ open: false, payment: null, template: null });
  const [confirmReminderDialog, setConfirmReminderDialog] = useState({ open: false, payment: null, template: null });
  const [confirmPaymentDialog, setConfirmPaymentDialog] = useState({ open: false, payment: null });
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [bookingTypeFilter, setBookingTypeFilter] = useState(urlParams.get('type') || 'all');
  const [dateRangeType, setDateRangeType] = useState('this_month');
  const [customRange, setCustomRange] = useState({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('payments_view_mode') || 'room';
  });
  const [displayLimit, setDisplayLimit] = useState(50);
  const loadMoreRef = useRef(null);
  const [sortBy, setSortBy] = useState('due_date'); // 'due_date', 'room', 'created_date', 'amount'
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Room View State
  const [roomViewMonth, setRoomViewMonth] = useState(() => {
    // ใช้เวลาไทย (UTC+7)
    const nowUTC = new Date();
    const thaiOffset = 7 * 60; // UTC+7 = 420 minutes
    const nowThailand = new Date(nowUTC.getTime() + thaiOffset * 60 * 1000);
    const day = nowThailand.getUTCDate();
    
    // ถ้าวันที่ >= 25 → เดือนถัดไป, ถ้า < 25 → เดือนปัจจุบัน
    let targetMonth = nowThailand;
    if (day >= 25) {
      targetMonth = new Date(nowThailand.getUTCFullYear(), nowThailand.getUTCMonth() + 1, 1);
    }
    
    return format(targetMonth, 'yyyy-MM');
  });
  const [isLoadingRoomView, setIsLoadingRoomView] = useState(false);
  const [openRoomDialogs, setOpenRoomDialogs] = useState({});

  const [aiSearching, setAiSearching] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiAbortController, setAiAbortController] = useState(null);
  const [aiAction, setAiAction] = useState(null);
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState([]);
  const [bulkAIQuery, setBulkAIQuery] = useState('');
  const [bulkAIResult, setBulkAIResult] = useState(null);
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [longPressTarget, setLongPressTarget] = useState(null);

  useEffect(() => {
    window.resetPaymentsAI = () => { setAiResult(null); setAiAction(null); setSearchQuery(''); };
    return () => { delete window.resetPaymentsAI; };
  }, []);

  useEffect(() => {
    if (!isSelectionMode) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsSelectionMode(false);
        setSelectedPaymentIds([]);
        toast.info('ยกเลิกการเลือกแล้ว', { duration: 1500 });
      }
    };

    const handleClickOutside = (e) => {
      if (e.target.closest('[data-selection-control]')) return;
      if (e.target.closest('[data-payment-item]')) return;
      if (e.target.closest('input, textarea, button, select, [role="dialog"], [role="menu"]')) return;
      setIsSelectionMode(false);
      setSelectedPaymentIds([]);
      toast.info('ยกเลิกการเลือกแล้ว', { duration: 1500 });
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSelectionMode]);

  const [formData, setFormData] = useState({
    booking_id: '', tenant_id: '', room_id: '', meter_reading_id: '', payment_date: '', due_date: '',
    rent_amount: 0, water_units: 0, water_rate: 0, water_amount: 0, electricity_units: 0, electricity_rate: 0, electricity_amount: 0,
    internet_amount: 0, common_fee_amount: 0, parking_fee_amount: 0, other_amount: 0, security_deposit_amount: 0, advance_rent_amount: 0,
    late_fee_amount: 0, late_fee_locked: false, payment_method: 'cash', payment_slip_url: '', notes: ''
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('status');
    if (status && ['all', 'pending', 'overdue', 'paid'].includes(status)) {
      setStatusFilter(status);
    }
  }, []);

  const toggleExpanded = (paymentId) => {
    setExpandedPayments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(paymentId)) {
        newSet.delete(paymentId);
      } else {
        newSet.add(paymentId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    setDateRangeType('this_month');
    setStatusFilter('all');
    setDisplayLimit(50);
    setSearchQuery('');
    setAiResult(null);

    queryClient.removeQueries({ queryKey: ['payments', selectedBranchId] });
    queryClient.removeQueries({ queryKey: ['bookings', selectedBranchId] });
    queryClient.removeQueries({ queryKey: ['rooms', selectedBranchId] });
    queryClient.removeQueries({ queryKey: ['tenants', selectedBranchId] });
  }, [selectedBranchId, queryClient]);

  const getTodayDateString = () => {
    try {
      const now = new Date();
      return now.toISOString();
    } catch {
      return new Date().toISOString();
    }
  };

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const userPermissions = currentUser?.permissions || [];
  const userRole = currentUser?.role === 'admin' ? 'developer' : (currentUser?.custom_role || 'employee');

  const canView = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_view');
  const canAdd = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_add');
  const canEdit = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_edit');
  const canDelete = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_delete');
  const canConfirmPaid = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_confirm');
  const canSendCommsManual = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_send_comms_manual');
  const canSendReceipt = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_send_receipt');
  const canDeleteTestData = userRole === 'developer';

  const { data: roomViewPayments = [], isFetching: roomViewFetching } = useQuery({
    queryKey: ['payments-room-view', selectedBranchId, roomViewMonth, bookingTypeFilter],
    queryFn: async () => {
      if (!selectedBranchId || !roomViewMonth) return [];
      const [year, month] = roomViewMonth.split('-').map(Number);
      const monthDate = new Date(year, month - 1, 1);
      const response = await base44.functions.invoke('getFilteredPayments', {
        branch_id: selectedBranchId,
        status_filter: 'all',
        booking_type_filter: bookingTypeFilter,
        date_range_type: 'custom',
        custom_range: {
          from: startOfMonth(monthDate),
          to: endOfMonth(monthDate)
        },
        search_query: '',
        page: 1,
        limit: 5000,
        sort_by: 'room',
        exclude_dismissed: true
      });
      
      return response.data?.data || [];
    },
    enabled: canView && !!selectedBranchId && viewMode === 'room',
    retry: 0,
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
  };

  const { data: paymentsResponse, isLoading: paymentsLoading, isFetching: paymentsFetching } = useQuery({
    queryKey: ['payments-filtered', selectedBranchId, statusFilter, bookingTypeFilter, dateRangeType, customRange, searchQuery, displayLimit, sortBy],
    queryFn: async () => {
      if (!selectedBranchId) return { data: [], total: 0, page: 1, totalPages: 0, counts: { all: 0, paid: 0, pending: 0, overdue: 0, partial_paid: 0 }, logs: [] };
      const response = await base44.functions.invoke('getFilteredPayments', {
        branch_id: selectedBranchId,
        status_filter: statusFilter,
        booking_type_filter: bookingTypeFilter,
        date_range_type: dateRangeType,
        custom_range: dateRangeType === 'custom' ? customRange : null,
        search_query: searchQuery,
        page: 1,
        limit: displayLimit,
        sort_by: sortBy,
        debug: true,
        exclude_dismissed: true
      });
      
      if (response.data?.logs) {
        setDebugLogs(response.data.logs);
      }
      
      console.log('🔍 Payments Response:', {
        data_length: response.data?.data?.length,
        total: response.data?.total,
        counts: response.data?.counts,
        page: response.data?.page,
        statusFilter,
        dateRangeType,
        logs: response.data?.logs
      });
      return response.data;
    },
    enabled: canView && !!selectedBranchId && viewMode !== 'room',
    ...retryConfig,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  const payments = paymentsResponse?.data || [];
  const totalFilteredCount = paymentsResponse?.total || 0;
  const statusCounts = paymentsResponse?.counts || { all: 0, paid: 0, pending: 0, overdue: 0, partial_paid: 0 };
  
  console.log('📊 Payments Page State:', {
    payments_length: payments.length,
    totalFilteredCount,
    statusCounts,
    statusFilter,
    dateRangeType
  });

  const { data: bookings = [], isFetching: bookingsFetching } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Booking',
        filters: { branch_id: selectedBranchId, status: 'active' },
        limit: 500
      });
      return response.data.data;
    },
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });

  const { data: rooms = [], isFetching: roomsFetching } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Room',
        filters: { branch_id: selectedBranchId },
        sort: '-room_number',
        limit: 500
      });
      return response.data.data;
    },
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });

  const roomsMap = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms]);
  const getRoomInfo = useCallback((roomId) => roomsMap.get(roomId), [roomsMap]);

  const { data: tenants = [], isFetching: tenantsFetching } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Tenant',
        filters: { branch_id: selectedBranchId },
        limit: 500
      });
      return response.data.data;
    },
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });

  const tenantsMap = useMemo(() => new Map(tenants.map(t => [t.id, t])), [tenants]);
  const getTenantInfo = useCallback((tenantId) => tenantsMap.get(tenantId), [tenantsMap]);

  const { data: meterReadings = [] } = useQuery({
    queryKey: ['meterReadings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // 🔒 SECURITY FIX: Filter by branch_id
      return await base44.entities.MeterReading.filter({ branch_id: selectedBranchId }, '-reading_date', 500);
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // 🔒 SECURITY FIX: Use backend function
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Config',
        filters: { branch_id: selectedBranchId },
        limit: 1000
      });
      
      // รวมกับ global configs
      const globalResponse = await base44.functions.invoke('getSecureData', {
        entity: 'Config',
        filters: { branch_id: null },
        limit: 1000
      });
      
      return [...(response.data?.data || []), ...(globalResponse.data?.data || [])];
    },
    enabled: !!currentUser && !!selectedBranchId,
    ...retryConfig,
    staleTime: 4 * 60 * 60 * 1000,
    gcTime: 8 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!configs || configs.length === 0 || !selectedBranchId) return;
  }, []);

  const isDataFetching = paymentsFetching || bookingsFetching || roomsFetching || tenantsFetching;

  const currentDateMemo = useMemo(() => {
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

  const getCurrentDate = () => currentDateMemo;

  const getMainDateRange = () => {
    const now = getCurrentDate();
    const branchBillConfig = configs.find(c => c.key === 'bill_generation_day' && c.branch_id === selectedBranchId);
    const globalBillConfig = configs.find(c => c.key === 'bill_generation_day' && !c.branch_id);
    const billGenerationDay = branchBillConfig ? parseInt(branchBillConfig.value) : (globalBillConfig ? parseInt(globalBillConfig.value) : 27);
    
    switch(dateRangeType) {
      case 'all':
        return null;
      case 'this_month': {
        let cm = now.getMonth(), cy = now.getFullYear();
        if (now.getDate() < billGenerationDay) { cm -= 1; if (cm < 0) { cm = 11; cy -= 1; } }
        return { from: new Date(cy, cm, billGenerationDay), to: new Date(cy, cm + 1, billGenerationDay) };
      }
      case 'last_month': {
        let cm = now.getMonth() - 1, cy = now.getFullYear();
        if (now.getDate() < billGenerationDay) cm -= 1;
        if (cm < 0) { cm += 12; cy -= 1; }
        return { from: new Date(cy, cm, billGenerationDay), to: new Date(cy, cm + 1, billGenerationDay) };
      }
      case '3_months': {
        let cm = now.getMonth() - 2, cy = now.getFullYear();
        if (now.getDate() < billGenerationDay) cm -= 1;
        while (cm < 0) { cm += 12; cy -= 1; }
        return { from: new Date(cy, cm, billGenerationDay), to: new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= billGenerationDay ? 1 : 0), billGenerationDay) };
      }
      case '6_months': {
        let cm = now.getMonth() - 5, cy = now.getFullYear();
        if (now.getDate() < billGenerationDay) cm -= 1;
        while (cm < 0) { cm += 12; cy -= 1; }
        return { from: new Date(cy, cm, billGenerationDay), to: new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= billGenerationDay ? 1 : 0), billGenerationDay) };
      }
      case '12_months': {
        let cm = now.getMonth() - 11, cy = now.getFullYear();
        if (now.getDate() < billGenerationDay) cm -= 1;
        while (cm < 0) { cm += 12; cy -= 1; }
        return { from: new Date(cy, cm, billGenerationDay), to: new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= billGenerationDay ? 1 : 0), billGenerationDay) };
      }
      case 'this_year':
        return { from: startOfYear(now), to: endOfYear(now) };
      case 'last_year':
        return { from: startOfYear(subYears(now, 1)), to: endOfYear(subYears(now, 1)) };
      case 'custom':
        return customRange;
      default:
        return null;
    }
  };

  const dateRange = useMemo(() => getMainDateRange(), [dateRangeType, customRange]);

  const calculateDueDate = () => {
    const branchPayDayConfig = configs.find(c => c.key === 'pay_day' && c.branch_id === selectedBranchId);
    const globalPayDayConfig = configs.find(c => c.key === 'pay_day' && !c.branch_id);
    const payDayConfig = branchPayDayConfig || globalPayDayConfig;
    const payDay = payDayConfig ? parseInt(payDayConfig.value) : 5;

    const today = getCurrentDate();
    const billGenerationDayConfig = configs.find(c => 
      (c.key === 'bill_generation_day' && c.branch_id === selectedBranchId) || 
      (c.key === 'bill_generation_day' && !c.branch_id)
    );
    const billGenerationDay = billGenerationDayConfig ? parseInt(billGenerationDayConfig.value) : 27;
    let dueMonth = today.getMonth();
    let dueYear = today.getFullYear();
    if (today.getDate() > payDay) {
      dueMonth += 1;
      if (dueMonth > 11) {
        dueMonth = 0;
        dueYear += 1;
      }
    }
    
    const dueDate = new Date(dueYear, dueMonth, payDay);
    return format(dueDate, 'yyyy-MM-dd');
  };

  const calculateLateFee = useMemo(() => {
    const cache = new Map();

    return (payment, configsList = configs) => {
      if (cache.has(payment.id)) {
        return cache.get(payment.id);
      }

      if (!payment || !payment.due_date || payment.status === 'paid') { cache.set(payment.id, 0); return 0; }
      if (payment.late_fee_locked) { cache.set(payment.id, payment.late_fee_amount || 0); return payment.late_fee_amount || 0; }

      const branchConfig = configsList.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === selectedBranchId);
      const globalConfig = configsList.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
      const tiersEnabledConfig = branchConfig || globalConfig;
      const tiersEnabled = tiersEnabledConfig?.value === 'true';

      try {
        const dueDate = parseISO(payment.due_date);
        const today = getCurrentDate();

        if (isNaN(dueDate.getTime()) || isNaN(today.getTime())) {
          cache.set(payment.id, 0);
          return 0;
        }

        const daysOverdue = differenceInDays(today, dueDate);

        if (daysOverdue <= 0) {
          cache.set(payment.id, 0);
          return 0;
        }

        if (tiersEnabled) {
          const branchTiersConfig = configsList.find(c => c.key === 'late_fee_tiers' && c.branch_id === selectedBranchId);
          const globalTiersConfig = configsList.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
          const tiersConfig = branchTiersConfig || globalTiersConfig;
          
          console.log('🔍 Late Fee Debug (Payment ID:', payment.id.substring(0, 8) + '):', {
            daysOverdue,
            tiersEnabled,
            hasTiersConfig: !!tiersConfig,
            tiersConfigValue: tiersConfig?.value,
            selectedBranchId
          });
          
          if (tiersConfig?.value) {
            try {
              const tiers = JSON.parse(tiersConfig.value);
              let totalFee = 0;

              console.log('📊 Tiers Config:', tiers);

              for (const tier of tiers) {
                const daysFrom = tier.days_from || 1;
                const daysTo = tier.days_to || 999;
                const feePerDay = parseFloat(tier.fee_per_day || 0);

                if (daysOverdue >= daysFrom) {
                  const daysInThisTier = Math.min(daysOverdue, daysTo) - daysFrom + 1;
                  if (daysInThisTier > 0) {
                    const tierFee = daysInThisTier * feePerDay;
                    totalFee += tierFee;
                    console.log(`  ➡️ Tier ${daysFrom}-${daysTo}: ${daysInThisTier} วัน × ${feePerDay}฿ = ${tierFee}฿`);
                  }
                }

                if (daysOverdue <= daysTo) break;
              }

              console.log(`💰 Total Late Fee (Tiers): ${totalFee}฿`);
              cache.set(payment.id, totalFee);
              return totalFee;
            } catch (e) {
              console.error('❌ Error parsing late fee tiers:', e);
            }
          }
        }

        const branchLateFeeConfig = configsList.find(c => c.key === 'late_payment_fee_per_day' && c.branch_id === selectedBranchId);
        const globalLateFeeConfig = configsList.find(c => c.key === 'late_payment_fee_per_day' && !c.branch_id);
        const lateFeeConfig = branchLateFeeConfig || globalLateFeeConfig;
        const lateFeePerDay = lateFeeConfig ? parseFloat(lateFeeConfig.value) : 0;
        
        console.log('💵 Simple Late Fee (Payment ID:', payment.id.substring(0, 8) + '):', {
          daysOverdue,
          feePerDay: lateFeePerDay,
          hasBranchConfig: !!branchLateFeeConfig,
          hasGlobalConfig: !!globalLateFeeConfig,
          totalFee: daysOverdue * lateFeePerDay
        });

        if (lateFeePerDay === 0 || isNaN(lateFeePerDay)) {
          cache.set(payment.id, 0);
          return 0;
        }

        const fee = daysOverdue * lateFeePerDay;
        cache.set(payment.id, fee);
        return fee;
      } catch (error) {
        console.error('Error calculating late fee for payment:', payment.id, error);
        cache.set(payment.id, 0);
        return 0;
      }
    };
  }, [configs, currentDateMemo, selectedBranchId]);

  const autoCalculatePayment = async (roomId) => {
    if (!roomId) {
      toast.error('กรุณาเลือกห้องก่อน');
      setAutoCalculating(false);
      return;
    }

    setAutoCalculating(true);
    try {
      const room = rooms.find(r => r.id === roomId);
      if (!room) {
        toast.error('ไม่พบข้อมูลห้อง');
        setAutoCalculating(false);
        return;
      }

      const activeBooking = bookings.find(b => b.room_id === roomId && b.status === 'active');
      if (!activeBooking) {
        toast.error('ไม่พบข้อมูลการจองที่ใช้งานอยู่ของห้องนี้');
        setAutoCalculating(false);
        return;
      }

      const getConfigValue = (key, defaultValue) => {
        const branchConfig = configs.find(c => c.key === key && c.branch_id === selectedBranchId);
        if (branchConfig && branchConfig.value !== undefined && branchConfig.value !== '') {
          return parseFloat(branchConfig.value);
        }
        const globalConfig = configs.find(c => c.key === key && !c.branch_id);
        return globalConfig && globalConfig.value !== undefined && globalConfig.value !== '' ? parseFloat(globalConfig.value) : defaultValue;
      };

      const waterRate = room.water_rate || getConfigValue('water_rate', 18);
      const electricityRate = room.electricity_rate || getConfigValue('electricity_rate', 7);
      const internetRate = getConfigValue('internet_rate', 0);
      const commonFee = room.common_fee || getConfigValue('common_fee', 0);
      
      const carParkingFee = getConfigValue('car_parking_fee', 0);
      const motorcycleParkingFee = getConfigValue('motorcycle_parking_fee', 0);

      const roomMeterReadings = meterReadings.filter(m => m.room_id === roomId);
      const latestMeterReading = roomMeterReadings.sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date))[0];

      let waterUnits = 0;
      let electricityUnits = 0;
      let meterReadingId = '';
      let actualWaterUnits = 0;
      let actualElectricityUnits = 0;

      if (latestMeterReading) {
        actualWaterUnits = latestMeterReading.water_units || 0;
        actualElectricityUnits = latestMeterReading.electricity_units || 0;
        waterUnits = actualWaterUnits;
        electricityUnits = actualElectricityUnits;
        meterReadingId = latestMeterReading.id;
      } else {
        toast.info('ยังไม่มีการบันทึกมิเตอร์สำหรับห้องนี้ กรุณากรอกค่าเอง');
      }

      const gC = (key) => configs.find(c => c.key === key && c.branch_id === selectedBranchId)?.value || configs.find(c => c.key === key && !c.branch_id)?.value || '';
      let notesAddition = '', waterAmount = waterUnits * waterRate, electricityAmount = electricityUnits * electricityRate;

      if (room.is_flat_rate_water) {
        waterAmount = room.flat_rate_water_amount || 0; waterUnits = 0;
        notesAddition += `💧 ค่าน้ำแบบเหมาจ่าย\n`;
      } else if (gC('water_minimum_enabled') === 'true' || room.min_water_units > 0) {
        const mu = room.min_water_units || parseFloat(gC('water_minimum_units') || '0'), mc = room.min_water_charge || parseFloat(gC('water_minimum_charge') || '0');
        if (waterUnits <= mu && mc > 0) { waterUnits = mu; waterAmount = mc; notesAddition += `💧 ใช้น้ำ ${actualWaterUnits.toFixed(1)} หน่วย → คิดขั้นต่ำ ${mc} บาท\n`; }
      }
      if (room.is_flat_rate_electricity) {
        electricityAmount = room.flat_rate_electricity_amount || 0; electricityUnits = 0;
        notesAddition += `⚡ ค่าไฟแบบเหมาจ่าย\n`;
      } else if (gC('electricity_minimum_enabled') === 'true' || room.min_electricity_units > 0) {
        const mu = room.min_electricity_units || parseFloat(gC('electricity_minimum_units') || '0'), mc = room.min_electricity_charge || parseFloat(gC('electricity_minimum_charge') || '0');
        if (electricityUnits <= mu && mc > 0) { electricityUnits = mu; electricityAmount = mc; notesAddition += `⚡ ใช้ไฟ ${actualElectricityUnits.toFixed(1)} หน่วย → คิดขั้นต่ำ ${mc} บาท\n`; }
      }
      const rentAmount = room.price || 0;

      const tenant = tenants.find(t => t.id === activeBooking.tenant_id);
      let parkingFeeAmount = 0;
      if (tenant && tenant.vehicles && tenant.vehicles.length > 0) {
        const carCount = tenant.vehicles.filter(v => v.type === 'car').length;
        const motorcycleCount = tenant.vehicles.filter(v => v.type === 'motorcycle').length;
        parkingFeeAmount = (carCount * carParkingFee) + (motorcycleCount * motorcycleParkingFee);
      }

      let otherMonthlyFeesAmount = 0;
      if (room.other_monthly_fees && Array.isArray(room.other_monthly_fees)) {
        otherMonthlyFeesAmount = room.other_monthly_fees.reduce((sum, fee) => sum + (parseFloat(fee.amount) || 0), 0);
      }

      const autoDueDate = formData.due_date || calculateDueDate();

      setFormData(prev => ({
        ...prev,
        booking_id: activeBooking.id,
        tenant_id: activeBooking.tenant_id,
        meter_reading_id: meterReadingId,
        due_date: autoDueDate,
        rent_amount: rentAmount,
        water_units: waterUnits,
        water_rate: waterRate,
        water_amount: parseFloat(waterAmount.toFixed(2)),
        electricity_units: electricityUnits,
        electricity_rate: electricityRate,
        electricity_amount: parseFloat(electricityAmount.toFixed(2)),
        internet_amount: internetRate,
        common_fee_amount: commonFee,
        parking_fee_amount: parkingFeeAmount,
        other_amount: otherMonthlyFeesAmount,
        notes: notesAddition.trim() ? (notesAddition.trim() + (prev.notes ? '\n' + prev.notes : '')) : prev.notes
      }));

      if (latestMeterReading) {
        if (notesAddition.trim()) {
          toast.success('คำนวณค่าใช้จ่ายสำเร็จ (รวมค่าขั้นต่ำ)', { duration: 4000 });
        } else {
          toast.success('คำนวณค่าใช้จ่ายสำเร็จ');
        }
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการคำนวณอัตโนมัติ');
      console.error(error);
    }
    setAutoCalculating(false);
  };

  const getEffectiveStatus = useCallback((payment) => {
    if (!payment) return 'pending';
    if (payment.status === 'paid') return 'paid';
    if (payment.status === 'partial_paid') return 'partial_paid';
    if (payment.status === 'overdue') return 'overdue';

    if (payment.status === 'pending' && payment.due_date) {
      try {
        const dueDate = parseISO(payment.due_date);
        const today = getCurrentDate();

        if (isNaN(dueDate.getTime()) || isNaN(today.getTime())) {
          return payment.status;
        }

        const daysDiff = differenceInDays(today, dueDate);
        
        if (daysDiff > 0) {
          return 'overdue';
        }
      } catch (error) {
        console.error('Error calculating effective status:', error);
        return payment.status;
      }
    }

    return payment.status || 'pending';
  }, [currentDateMemo]);

  const filteredPayments = useMemo(() => {
    if (!payments || payments.length === 0) return [];
    
    if (aiResult && aiResult.payments && aiResult.payments.length > 0) {
      const aiPaymentIds = new Set(aiResult.payments.map(p => p.payment_id));
      return payments.filter(payment => aiPaymentIds.has(payment.id));
    }
    
    return payments;
  }, [payments, aiResult]);

  const displayedPayments = filteredPayments;

  useEffect(() => {
    setDisplayLimit(50);
  }, [dateRangeType, customRange, statusFilter, searchQuery, aiResult]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayLimit < filteredPayments.length) {
          setDisplayLimit(prev => Math.min(prev + 50, filteredPayments.length));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current && viewMode !== 'room') {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [displayLimit, filteredPayments.length, viewMode]);

  const totalAmounts = useMemo(() => {
    const calculateSum = (paymentsToSum) => {
      return paymentsToSum.reduce((sum, p) => {
        const baseAmount = parseFloat(p.total_amount) || 0;
        const lateFee = (p.late_fee_amount && p.late_fee_amount > 0) ? 0 : calculateLateFee(p);
        if (isNaN(baseAmount) || isNaN(lateFee)) {
          console.error('Invalid amount for payment:', p.id, { baseAmount, lateFee });
          return sum;
        }
        return sum + baseAmount + lateFee;
      }, 0);
    };
  
    const paymentsForSummary = viewMode === 'room' ? roomViewPayments : filteredPayments;
    
    return {
      all: calculateSum(paymentsForSummary),
      paid: calculateSum(paymentsForSummary.filter(p => getEffectiveStatus(p) === 'paid')),
      pending: calculateSum(paymentsForSummary.filter(p => getEffectiveStatus(p) === 'pending')),
      overdue: calculateSum(paymentsForSummary.filter(p => getEffectiveStatus(p) === 'overdue')),
    };
  }, [filteredPayments, roomViewPayments, viewMode, getEffectiveStatus, calculateLateFee]);

  const displayCounts = useMemo(() => {
    if (viewMode === 'room') {
      return {
        all: roomViewPayments.length,
        paid: roomViewPayments.filter(p => getEffectiveStatus(p) === 'paid').length,
        pending: roomViewPayments.filter(p => getEffectiveStatus(p) === 'pending').length,
        overdue: roomViewPayments.filter(p => getEffectiveStatus(p) === 'overdue').length,
      };
    } else {
      return {
        all: filteredPayments.length,
        paid: filteredPayments.filter(p => getEffectiveStatus(p) === 'paid').length,
        pending: filteredPayments.filter(p => getEffectiveStatus(p) === 'pending').length,
        overdue: filteredPayments.filter(p => getEffectiveStatus(p) === 'overdue').length,
      };
    }
  }, [viewMode, roomViewPayments, filteredPayments, getEffectiveStatus]);

  const pendingOverduePayments = useMemo(() => 
    filteredPayments.filter(p => {
      const status = getEffectiveStatus(p);
      return status === 'pending' || status === 'overdue';
    }),
    [filteredPayments, getEffectiveStatus]
  );

  const tenantsWithLine = useMemo(() => {
    const paymentsSource = viewMode === 'room' ? roomViewPayments : pendingOverduePayments;
    
    return paymentsSource.filter(p => {
      const status = getEffectiveStatus(p);
      if (status !== 'pending' && status !== 'overdue') return false;
      if (p.bill_sent_date) return false;
      return p.tenant_line_user_id || p.tenant_facebook_user_id;
    }).length;
  }, [viewMode, roomViewPayments, pendingOverduePayments, getEffectiveStatus]);

  const testPaymentsCount = useMemo(() => 
    payments.filter(p => p.notes?.includes('[TEST-')).length,
    [payments]
  );

  const { data: allPaymentsForCounting = [] } = useQuery({
    queryKey: ['payments-count', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Payment.filter(
        { branch_id: selectedBranchId },
        '-created_date',
        5000
      );
    },
    enabled: canView && !!selectedBranchId,
    staleTime: 10 * 1000,
    gcTime: 30 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const roomsNeedingBills = useMemo(() => {
    if (!rooms.length || !bookings.length || !configs.length) return 0;

    const branchBillConfig = configs.find(c => c.key === 'bill_generation_day' && c.branch_id === selectedBranchId);
    const globalBillConfig = configs.find(c => c.key === 'bill_generation_day' && !c.branch_id);
    const billGenerationDay = branchBillConfig ? parseInt(branchBillConfig.value) : (globalBillConfig ? parseInt(globalBillConfig.value) : 27);

    const branchPayDayConfig = configs.find(c => c.key === 'pay_day' && c.branch_id === selectedBranchId);
    const globalPayDayConfig = configs.find(c => c.key === 'pay_day' && !c.branch_id);
    const payDay = branchPayDayConfig ? parseInt(branchPayDayConfig.value) : (globalPayDayConfig ? parseInt(globalPayDayConfig.value) : 5);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    let dueMonth = currentMonth;
    let dueYear = currentYear;
    if (now.getDate() > payDay) {
      dueMonth += 1;
      if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
    }

    const targetDueYearMonth = `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}`;

    const monthlyRooms = rooms.filter(r => r.room_type === 'monthly');
    const roomsWithBooking = monthlyRooms.filter(room => 
      bookings.some(b => b.room_id === room.id && b.status === 'active')
    );

    let count = 0;
    for (const room of roomsWithBooking) {
      const existingBill = allPaymentsForCounting.find(p => 
        p.room_id === room.id && 
        p.due_date && 
        p.due_date.substring(0, 7) === targetDueYearMonth
      );
      if (!existingBill) count++;
    }

    return count;
  }, [rooms, bookings, allPaymentsForCounting, configs, selectedBranchId]);

  const dateRangeLabel = () => {
    switch(dateRangeType) {
      case 'all': return 'ทั้งหมด';
      case 'this_month': return `เดือนนี้ (${format(dateRange.from, 'MMM yyyy', { locale: th })})`;
      case 'last_month': return `เดือนที่แล้ว (${format(dateRange.from, 'MMM yyyy', { locale: th })})`;
      case '3_months': return '3 เดือนล่าสุด';
      case '6_months': return '6 เดือนล่าสุด';
      case '12_months': return '12 เดือนล่าสุด';
      case 'this_year': return `ปีนี้ (${format(dateRange.from, 'yyyy', { locale: th })})`;
      case 'last_year': return `ปีที่แล้ว (${format(dateRange.from, 'yyyy', { locale: th })})`;
      case 'custom': return `${format(customRange.from, 'd MMM', { locale: th })} - ${format(customRange.to, 'd MMM yyyy', { locale: th })}`;
      default: return 'เดือนนี้';
    }
  };

  const [isCreatingPayment, setIsCreatingPayment] = useState(false);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      console.log('🚀 [createMutation] Starting...', { canAdd, isCreatingPayment });
      if (!canAdd) {
        console.error('❌ [createMutation] No permission');
        throw new Error('คุณไม่มีสิทธิ์เพิ่มการชำระเงิน');
      }
      if (isCreatingPayment) {
        console.error('❌ [createMutation] Already creating');
        throw new Error('กำลังสร้างบิลอยู่ กรุณารอสักครู่');
      }
      setIsCreatingPayment(true);
      console.log('📤 [createMutation] Creating payment...', data);
      const result = await base44.entities.Payment.create({...data, branch_id: selectedBranchId});
      console.log('✅ [createMutation] Success:', result);
      return result;
    },
    onSuccess: async (newPayment) => {
      console.log('✅ [createMutation.onSuccess] Starting...');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] }),
        queryClient.invalidateQueries({ queryKey: ['payments-filtered'] }),
        queryClient.invalidateQueries({ queryKey: ['payments-room-view'] }),
        queryClient.invalidateQueries({ queryKey: ['payments-count'] }),
      ]);
      
      const room = rooms.find(r => r.id === newPayment.room_id);
      const tenant = tenants.find(t => t.id === newPayment.tenant_id);
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'create',
        entity_type: 'Payment',
        entity_id: newPayment.id,
        entity_name: `ห้อง ${room?.room_number || 'N/A'} - ${tenant?.full_name || 'N/A'}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `สร้างบิลค่าเช่าห้อง ${room?.room_number || 'N/A'} จำนวน ${newPayment.total_amount?.toLocaleString()} บาท`
      });
      
      await new Promise(r => setTimeout(r, 500));
      
      setShowDialog(false);
      resetForm();
      setIsCreatingPayment(false);
      toast.success('บันทึกการชำระเงินสำเร็จ');
    },
    onError: (error) => {
      console.error('❌ [createMutation.onError] FULL ERROR:', error);
      console.error('❌ [createMutation.onError] Error message:', error.message);
      console.error('❌ [createMutation.onError] Error stack:', error.stack);
      setIsCreatingPayment(false);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการบันทึก');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      console.log('🔄 [updateMutation] Starting...', { id, canEdit });
      if (!canEdit) {
        console.error('❌ [updateMutation] No permission');
        throw new Error('คุณไม่มีสิทธิ์แก้ไขการชำระเงิน');
      }
      console.log('📤 [updateMutation] Updating payment...', { id, data });
      return base44.entities.Payment.update(id, {
        ...data,
        invoice_image_url: null,
        invoice_image_status: 'pending',
        bill_sent_date: null
      });
    },
    onSuccess: async (updatedPayment) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] }),
        queryClient.invalidateQueries({ queryKey: ['payments-filtered'] }),
        queryClient.invalidateQueries({ queryKey: ['payments-room-view'] }),
        queryClient.invalidateQueries({ queryKey: ['payments-count'] }),
      ]);
      
      const room = rooms.find(r => r.id === updatedPayment.room_id);
      const tenant = tenants.find(t => t.id === updatedPayment.tenant_id);
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'update',
        entity_type: 'Payment',
        entity_id: updatedPayment.id,
        entity_name: `ห้อง ${room?.room_number || 'N/A'} - ${tenant?.full_name || 'N/A'}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `แก้ไขบิลค่าเช่าห้อง ${room?.room_number || 'N/A'} (รูปจะถูกสร้างใหม่)`
      });
      
      await new Promise(r => setTimeout(r, 500));
      
      setShowDialog(false);
      resetForm();
      toast.success('อัปเดตการชำระเงินสำเร็จ - รูปใบแจ้งหนี้จะถูกสร้างใหม่', { duration: 4000 });
    },
    onError: (error) => {
      console.error('❌ [updateStatusMutation.onError] FULL ERROR:', error);
      console.error('❌ [updateStatusMutation.onError] Error message:', error.message);
      console.error('❌ [updateStatusMutation.onError] Error stack:', error.stack);
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (payment) => {
      console.log('🗑️ [deleteMutation] Starting...', { paymentId: payment.id, canDelete });
      if (!canDelete) {
        console.error('❌ [deleteMutation] No permission');
        throw new Error('คุณไม่มีสิทธิ์ลบการชำระเงิน');
      }
      console.log('📤 [deleteMutation] Deleting payment...', payment.id);
      await base44.entities.Payment.delete(payment.id);
      console.log('✅ [deleteMutation] Deleted successfully');
      return payment;
    },
    onMutate: async (deletedPayment) => {
      await queryClient.cancelQueries({ queryKey: ['payments-filtered'] });
      await queryClient.cancelQueries({ queryKey: ['payments-room-view'] });
      await queryClient.cancelQueries({ queryKey: ['payments-count', selectedBranchId] });

      const queryKeyFiltered = ['payments-filtered', selectedBranchId, statusFilter, dateRangeType, customRange, searchQuery, displayLimit, sortBy];
      const queryKeyRoomView = ['payments-room-view', selectedBranchId, roomViewMonth];

      const previousPaymentsFiltered = queryClient.getQueryData(queryKeyFiltered);
      const previousPaymentsRoomView = queryClient.getQueryData(queryKeyRoomView);

      if (previousPaymentsFiltered) {
        queryClient.setQueryData(queryKeyFiltered, (old) => {
            if (!old || !old.data) return old;
            return {
              ...old,
              data: old.data.filter(p => p.id !== deletedPayment.id),
              total: (old.total || 0) - 1,
            }
        });
      }
      
      if (previousPaymentsRoomView) {
        queryClient.setQueryData(queryKeyRoomView, (old) => {
            if (!old) return [];
            return old.filter(p => p.id !== deletedPayment.id)
        });
      }

      return { previousPaymentsFiltered, previousPaymentsRoomView, queryKeyFiltered, queryKeyRoomView };
    },
    onError: (err, deletedPayment, context) => {
      console.error('❌ [deleteMutation.onError] FULL ERROR:', err);
      console.error('❌ [deleteMutation.onError] Error message:', err.message);
      console.error('❌ [deleteMutation.onError] Error stack:', err.stack);
      if (context?.previousPaymentsFiltered) {
        queryClient.setQueryData(context.queryKeyFiltered, context.previousPaymentsFiltered);
      }
      if (context?.previousPaymentsRoomView) {
        queryClient.setQueryData(context.queryKeyRoomView, context.previousPaymentsRoomView);
      }
      toast.error('ลบไม่สำเร็จ: ' + err.message);
    },
    onSuccess: async (deletedPayment) => {
        toast.success('ลบการชำระเงินสำเร็จ');

        const room = rooms.find(r => r.id === deletedPayment.room_id);
        const tenant = tenants.find(t => t.id === deletedPayment.tenant_id);
        try {
            await base44.entities.ActivityLog.create({
              branch_id: selectedBranchId,
              action_type: 'delete',
              entity_type: 'Payment',
              entity_id: deletedPayment.id,
              entity_name: `ห้อง ${room?.room_number || 'N/A'} - ${tenant?.full_name || 'N/A'}`,
              user_email: currentUser?.email,
              user_name: currentUser?.full_name,
              description: `ลบบิลค่าเช่าห้อง ${room?.room_number || 'N/A'} จำนวน ${deletedPayment.total_amount?.toLocaleString()} บาท`
            });
        } catch (logError) {
            console.error("Failed to create activity log for deletion:", logError);
        }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['payments-count', selectedBranchId] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, payment_date }) => {
      console.log('🚀 updateStatusMutation.mutationFn CALLED with:', { id, status, payment_date, canConfirmPaid });
      if (!canConfirmPaid) {
        console.error('❌ canConfirmPaid is false!');
        throw new Error('คุณไม่มีสิทธิ์ยืนยันการชำระเงิน');
      }
      console.log('✅ Permission check passed, calling API...');
      
      const existingPayment = await base44.entities.Payment.filter({ id }, '', 1);
      const payment = existingPayment[0];
      
      let lockedLateFee = payment.late_fee_amount || 0;
      if (status === 'paid' && lockedLateFee === 0) {
        lockedLateFee = calculateLateFee(payment);
        console.log(`🔒 Locking late fee at payment confirmation: ${lockedLateFee} บาท`);
      }
      
      let cleanedNotes = payment?.notes || '';
      if (cleanedNotes.includes('⚠️ รอตรวจสอบ')) {
        cleanedNotes = cleanedNotes
          .split('\n\n')
          .filter(line => !line.includes('⚠️ รอตรวจสอบ') && !line.includes('⚠️ โอนไปผิดบัญชี'))
          .join('\n\n')
          .trim();
      }
      
      const baseAmount = payment.total_amount - (payment.late_fee_amount || 0);
      const newTotalAmount = baseAmount + lockedLateFee;
      
      const result = await base44.entities.Payment.update(id, { 
        status, 
        payment_date,
        late_fee_amount: lockedLateFee,
        total_amount: newTotalAmount,
        notes: (cleanedNotes ? cleanedNotes + '\n\n' : '') + '✅ ยืนยันชำระแล้ว (ผ่านการตรวจสอบด้วยตนเอง)'
      });
      console.log('📤 API call completed:', result);
      return result;
    },
    onSuccess: async (updatedPayment, variables) => {
      console.log('✅ onSuccess triggered! Updated payment:', updatedPayment);
      
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] }),
        queryClient.invalidateQueries({ queryKey: ['payments-filtered'] }),
        queryClient.invalidateQueries({ queryKey: ['payments-room-view'] }),
        queryClient.invalidateQueries({ queryKey: ['payments-count'] }),
        queryClient.invalidateQueries({ queryKey: ['allPayments'] }),
        queryClient.invalidateQueries({ queryKey: ['tenants', selectedBranchId] }),
      ]);
      
      await new Promise(r => setTimeout(r, 500));
      
      if (variables.status === 'paid') {
      const room = rooms.find(r => r.id === updatedPayment.room_id);

      // ⭐ FIX: ดึงข้อมูล Tenant ล่าสุดจากฐานข้อมูลแทนการใช้ cache
      const latestTenantData = await base44.entities.Tenant.filter({ id: updatedPayment.tenant_id }, '', 1);
      const tenant = latestTenantData?.[0];

      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'update',
        entity_type: 'Payment',
        entity_id: updatedPayment.id,
        entity_name: `ห้อง ${room?.room_number || 'N/A'} - ${tenant?.full_name || 'N/A'}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `ยืนยันชำระเงินห้อง ${room?.room_number || 'N/A'} จำนวน ${updatedPayment.total_amount?.toLocaleString()} บาท`
      });

      await base44.entities.Notification.create({
        user_email: currentUser?.email,
        notification_id: `payment-confirmed-${updatedPayment.id}`,
        is_read: false
      });

      if (tenant && updatedPayment.due_date && updatedPayment.payment_date) {
          try {
            const dueDate = parseISO(updatedPayment.due_date);
            const paymentDate = parseISO(updatedPayment.payment_date);
            const daysDiff = differenceInDays(paymentDate, dueDate);

            let paymentScore = 5;

            if (daysDiff <= -7) {
              paymentScore = 10;
            } else if (daysDiff <= -3) {
              paymentScore = 9;
            } else if (daysDiff <= -1) {
              paymentScore = 8;
            } else if (daysDiff === 0) {
              paymentScore = 7;
            } else if (daysDiff <= 3) {
              paymentScore = 5;
            } else if (daysDiff <= 7) {
              paymentScore = 3;
            } else if (daysDiff <= 14) {
              paymentScore = 2;
            } else {
              paymentScore = 1;
            }

            const existingScores = tenant.payment_scores || [];
            const newScores = [...existingScores, {
              payment_id: updatedPayment.id,
              score: paymentScore,
              payment_date: updatedPayment.payment_date,
              due_date: updatedPayment.due_date,
              days_diff: daysDiff
            }];

            const avgScore = newScores.reduce((sum, s) => sum + s.score, 0) / newScores.length;

            await base44.entities.Tenant.update(tenant.id, {
              payment_scores: newScores,
              avg_payment_score: Math.round(avgScore * 10) / 10
            });

            console.log(`✅ ให้คะแนนชำระเงิน: ${paymentScore}/10 (ชำระ ${daysDiff >= 0 ? 'ก่อน' : 'หลัง'}กำหนด ${Math.abs(daysDiff)} วัน)`);
          } catch (scoreError) {
            console.error('Error calculating payment score:', scoreError);
          }
        }

        if (updatedPayment.advance_rent_amount && updatedPayment.advance_rent_amount > 0 && tenant) {
          try {
            const currentPrepaid = tenant.prepaid_balance || 0;
            const newPrepaid = currentPrepaid + updatedPayment.advance_rent_amount;
            
            await base44.entities.Tenant.update(tenant.id, {
              prepaid_balance: newPrepaid
            });
            
            console.log(`✅ เพิ่มยอดเงินล่วงหน้า: ${updatedPayment.advance_rent_amount} บาท → ยอดใหม่: ${newPrepaid} บาท`);
            toast.info(`💰 เพิ่มยอดเงินล่วงหน้า ${updatedPayment.advance_rent_amount.toLocaleString()} บาท ให้ ${tenant.full_name}`, { duration: 5000 });
          } catch (prepaidError) {
            console.error('Error updating prepaid balance:', prepaidError);
          }
        }

        if ((tenant?.line_user_id || tenant?.facebook_user_id) && canSendReceipt) {
          try {
            const platform = tenant?.facebook_user_id ? 'Facebook' : 'LINE';
            toast.info(`กำลังส่งใบเสร็จทาง ${platform}...`, { duration: 2000 });
            
            const response = tenant?.facebook_user_id
              ? await base44.functions.invoke('sendFacebookReceipt', { paymentId: updatedPayment.id })
              : await base44.functions.invoke('sendReceipt', { paymentId: updatedPayment.id });
            
            if (response.data?.success) {
              toast.success(`✅ ส่งใบเสร็จทาง ${platform} สำเร็จ\nส่งถึง: ${tenant.full_name}`, { duration: 5000 });
            } else {
              toast.warning(`ยืนยันชำระสำเร็จ แต่ไม่สามารถส่งใบเสร็จได้: ${response.data?.error || 'ไม่ทราบสาเหตุ'}`, { duration: 5000 });
            }
          } catch (error) {
            console.error('Auto-send receipt error:', error);
            toast.warning('ยืนยันชำระสำเร็จ แต่ไม่สามารถส่งใบเสร็จอัตโนมัติได้: ' + error.message, { duration: 5000 });
          }
        } else if (!tenant?.line_user_id && !tenant?.facebook_user_id) {
          toast.success('ยืนยันชำระสำเร็จ (ผู้เช่ายังไม่ได้เชื่อมต่อระบบแชท)', { duration: 3000 });
        } else {
          toast.success('อัปเดตสถานะสำเร็จ', { duration: 3000 });
        }
      } else {
        toast.success('อัปเดตสถานะสำเร็จ');
      }
    },
    onError: (error) => {
      console.error('❌ [updateStatusMutation.onError] FULL ERROR:', error);
      console.error('❌ [updateStatusMutation.onError] Error message:', error.message);
      console.error('❌ [updateStatusMutation.onError] Error stack:', error.stack);
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const handleSlipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น (JPG, PNG)');
      e.target.value = '';
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('ไฟล์มีขนาดใหญ่เกินไป (จำกัดที่ 5MB)');
      e.target.value = '';
      return;
    }

    setUploadingSlip(true);

    try {
      let fileToUpload = file;
      if (file.size > 1024 * 1024) {
        toast.info('กำลังปรับขนาดรูปภาพ...');

        try {
          const img = new Image();
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
          });

          let width = img.width;
          let height = img.height;
          const maxDimension = 1920;

          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = (height / width) * maxDimension;
              width = maxDimension;
            } else {
              width = (width / height) * maxDimension;
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          const blob = await new Promise((resolve) => {
            canvas.toBlob(resolve, 'image/jpeg', 0.85);
          });

          fileToUpload = new File([blob], file.name, { type: 'image/jpeg' });
          URL.revokeObjectURL(img.src);
        } catch (compressError) {
          console.warn('ไม่สามารถลดขนาดรูปได้:', compressError);
          fileToUpload = file;
        }
      }

      toast.info('กำลังอัพโหลด...');

      const uploadPromise = base44.integrations.Core.UploadFile({ file: fileToUpload });
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('อัพโหลดใช้เวลานานเกินไป')), 60000)
      );

      const { file_url } = await Promise.race([uploadPromise, timeoutPromise]);

      setFormData(prev => ({ ...prev, payment_slip_url: file_url }));
      toast.success('อัพโหลดหลักฐานสำเร็จ');

    } catch (error) {
      console.error('Upload error:', error);
      toast.error('อัพโหลดหลักฐานไม่สำเร็จ');
    } finally {
      setUploadingSlip(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.room_id) {
      toast.error('กรุณาเลือกห้อง');
      return;
    }

    if (!formData.due_date) {
      toast.error('กรุณาระบุวันครบกำหนดชำระ');
      return;
    }

    const total = (parseFloat(formData.rent_amount) || 0) + (parseFloat(formData.water_amount) || 0) + (parseFloat(formData.electricity_amount) || 0) + (parseFloat(formData.internet_amount) || 0) + (parseFloat(formData.common_fee_amount) || 0) + (parseFloat(formData.parking_fee_amount) || 0) + (parseFloat(formData.other_amount) || 0) + (parseFloat(formData.security_deposit_amount) || 0) + (parseFloat(formData.advance_rent_amount) || 0) + (parseFloat(formData.late_fee_amount) || 0);

    if (total <= 0) {
      toast.error('ยอดรวมต้องมากกว่า 0 บาท');
      return;
    }

    const data = {
      booking_id: formData.booking_id || '', tenant_id: formData.tenant_id || '', room_id: formData.room_id, meter_reading_id: formData.meter_reading_id || '', payment_date: formData.payment_date || '', due_date: formData.due_date,
      rent_amount: parseFloat(formData.rent_amount || 0), water_units: parseFloat(formData.water_units || 0), water_rate: parseFloat(formData.water_rate || 0), water_amount: parseFloat(formData.water_amount || 0),
      electricity_units: parseFloat(formData.electricity_units || 0), electricity_rate: parseFloat(formData.electricity_rate || 0), electricity_amount: parseFloat(formData.electricity_amount || 0),
      internet_amount: parseFloat(formData.internet_amount || 0), common_fee_amount: parseFloat(formData.common_fee_amount || 0), parking_fee_amount: parseFloat(formData.parking_fee_amount || 0),
      other_amount: parseFloat(formData.other_amount || 0), security_deposit_amount: parseFloat(formData.security_deposit_amount || 0), advance_rent_amount: parseFloat(formData.advance_rent_amount || 0),
      late_fee_amount: parseFloat(formData.late_fee_amount || 0), late_fee_locked: formData.late_fee_locked || false,
      total_amount: total, payment_method: formData.payment_method, payment_slip_url: formData.payment_slip_url || '', notes: formData.notes || '', status: formData.payment_date ? 'paid' : 'pending'
    };

    console.log('Submitting payment data:', data);

    // ✅ ตรวจสอบบิลซ้ำก่อนบันทึก (เฉพาะตอนสร้างใหม่)
    if (!editingPayment) {
      try {
        const dueDateMonth = formData.due_date.substring(0, 7); // 'YYYY-MM'
        
        // หาบิลที่มีอยู่แล้วในห้องเดียวกัน + เดือนเดียวกัน
        const existingPayments = await base44.entities.Payment.filter({
          room_id: formData.room_id,
          branch_id: selectedBranchId
        }, '-created_date', 100);
        
        const duplicatePayment = existingPayments.find(p => 
          p.due_date && p.due_date.substring(0, 7) === dueDateMonth
        );

        if (duplicatePayment) {
          const room = rooms.find(r => r.id === formData.room_id);
          const confirmed = confirm(
            `⚠️ พบบิลซ้ำในห้อง ${room?.room_number || 'N/A'} เดือน ${format(parseISO(formData.due_date), 'MMM yyyy', { locale: th })}\n\n` +
            `บิลเก่า: ${duplicatePayment.total_amount?.toLocaleString() || 0} บาท (${duplicatePayment.status})\n` +
            `บิลใหม่: ${total.toLocaleString()} บาท\n\n` +
            `ต้องการลบบิลเก่าและสร้างใหม่หรือไม่?`
          );

          if (confirmed) {
            // ลบบิลเก่า
            await base44.entities.Payment.delete(duplicatePayment.id);
            toast.info('ลบบิลเก่าแล้ว กำลังสร้างใหม่...', { duration: 2000 });
          } else {
            toast.info('ยกเลิกการบันทึก');
            return;
          }
        }
      } catch (error) {
        console.error('Error checking duplicate payment:', error);
        // ถ้าเช็คไม่ได้ ให้ดำเนินการต่อได้
      }
    }

    if (editingPayment) {
      updateMutation.mutate({ id: editingPayment.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (payment) => {
    if (!canEdit) {
      toast.error('คุณไม่มีสิทธิ์แก้ไขการชำระเงิน');
      return;
    }

    setEditingPayment(payment);
    setFormData({
      booking_id: payment.booking_id || '', tenant_id: payment.tenant_id || '', room_id: payment.room_id || '', meter_reading_id: payment.meter_reading_id || '', payment_date: payment.payment_date || '', due_date: payment.due_date || '',
      rent_amount: payment.rent_amount || 0, water_units: payment.water_units || 0, water_rate: payment.water_rate || 0, water_amount: payment.water_amount || 0, electricity_units: payment.electricity_units || 0, electricity_rate: payment.electricity_rate || 0, electricity_amount: payment.electricity_amount || 0,
      internet_amount: payment.internet_amount || 0, common_fee_amount: payment.common_fee_amount || 0, parking_fee_amount: payment.parking_fee_amount || 0, other_amount: payment.other_amount || 0, security_deposit_amount: payment.security_deposit_amount || 0, advance_rent_amount: payment.advance_rent_amount || 0,
      late_fee_amount: payment.late_fee_amount || 0, late_fee_locked: payment.late_fee_locked || false, payment_method: payment.payment_method || 'cash', payment_slip_url: payment.payment_slip_url || '', notes: payment.notes || ''
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingPayment(null);
    setFormData({
      booking_id: '', tenant_id: '', room_id: '', meter_reading_id: '', payment_date: '', due_date: '',
      rent_amount: 0, water_units: 0, water_rate: 0, water_amount: 0, electricity_units: 0, electricity_rate: 0, electricity_amount: 0,
      internet_amount: 0, common_fee_amount: 0, parking_fee_amount: 0, other_amount: 0, security_deposit_amount: 0, advance_rent_amount: 0,
      late_fee_amount: 0, payment_method: 'cash', payment_slip_url: '', notes: ''
    });
  };

  const openReminderDialog = (paymentId = null, forceTemplate = null) => {
    if (!canSendCommsManual) {
      toast.error('คุณไม่มีสิทธิ์ส่งข้อความแจ้งเตือน');
      return;
    }

    if (paymentId) {
      const payment = payments.find(p => p.id === paymentId);
      if (!payment) return;
      
      setConfirmReminderDialog({
        open: true,
        payment: payment,
        template: forceTemplate
      });
      return;
    }

    const paymentsSource = viewMode === 'room' ? roomViewPayments : pendingOverduePayments;
    
    const paymentsToSend = paymentsSource.filter(p => {
      const status = getEffectiveStatus(p);
      if (status !== 'pending' && status !== 'overdue') return false;
      if (p.bill_sent_date) return false;
      
      const tenant = tenantsMap.get(p.tenant_id);
      return tenant && (tenant.line_user_id || tenant.facebook_user_id);
    });
    
    const roomsList = paymentsToSend
      .map(p => {
        const room = roomsMap.get(p.room_id);
        return room?.room_number || p.room_number || 'N/A';
      })
      .sort((a, b) => a.localeCompare(b, 'th', { numeric: true }))
      .join(', ');
    
    const confirmed = confirm(
      `📤 ต้องการส่งบิลไปยัง ${tenantsWithLine} ห้อง?\n\n` +
      `ห้องที่จะส่ง:\n${roomsList}\n\n` +
      `(เฉพาะห้องที่เชื่อมต่อระบบแชทและยังไม่ได้ส่งบิล)`
    );
    if (!confirmed) return;

    handleSendReminder(null, null);
  };

  const handleConfirmSendNow = async (payment, forceTemplate = null) => {
    const effectiveStatus = getEffectiveStatus(payment);
    const template = forceTemplate || (effectiveStatus === 'overdue' ? 'overdue' : 'advance');
    
    console.log('🔍 handleConfirmSendNow:', { effectiveStatus, template });
    
    setConfirmReminderDialog({ open: false, payment: null });
    await handleSendReminder(payment.id, template, null);
  };

  const handleEditReminderMessage = (payment) => {
    setConfirmReminderDialog({ open: false, payment: null });
    setReminderDialog({
      open: true,
      payment: payment,
      template: null
    });
  };

  const handleSendReminder = async (paymentId = null, template = null, customMessage = null) => {
    if (paymentId) {
      setSendingReminder(paymentId);
    } else {
      setSendingAll(true);
    }

    try {
      if (template === 'overdue' && paymentId) {
        try {
          console.log('🖼️ Regenerating invoice with late fee for overdue reminder...');
          await base44.functions.invoke('generateInvoiceImage', {
            paymentId: paymentId,
            forceRegenerate: true
          });
          console.log('✅ Invoice regenerated before sending overdue reminder');
          await new Promise(r => setTimeout(r, 1000));
        } catch (invoiceError) {
          console.error('⚠️ Failed to regenerate invoice:', invoiceError);
        }
      }
      
      const response = await base44.functions.invoke('sendPaymentReminder', {
        paymentId: paymentId,
        branch_id: selectedBranchId,
        template: template,
        customMessage: customMessage
      });

      if (response.data.success) {
        const successCount = response.data.sent || 0;
        const failCount = response.data.failed || 0;
        const skippedCount = response.data.skipped || 0;
        
        if (successCount > 0 && failCount === 0 && skippedCount === 0) {
          toast.success(`ส่งแจ้งเตือนสำเร็จ ${successCount} ห้อง`);
        } else if (skippedCount > 0) {
          toast.info(`ข้ามห้องที่ส่งไปแล้ว ${skippedCount} ห้อง${successCount > 0 ? `, ส่งใหม่ ${successCount} ห้อง` : ''}`);
        } else {
          toast.success(response.data.message);
        }
        
        queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] });
        if (response.data.errors && response.data.errors.length > 0) {
          console.error('Errors:', response.data.errors);
        }
      } else {
        toast.error(response.data.message || 'ส่งข้อความไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error sending payment reminder:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งข้อความ');
    }

    setSendingReminder(false);
    setSendingAll(false);
    setReminderDialog({ open: false, payment: null, template: null });
    setConfirmReminderDialog({ open: false, payment: null });
  };

  const handleSendReceipt = async (paymentId) => {
    if (!canSendReceipt) {
      toast.error('คุณไม่มีสิทธิ์ส่งใบเสร็จ');
      return;
    }

    setSendingReceipt(paymentId);
    try {
      // ⭐ FIX: ดึง Payment จาก DB โดยตรง (ไม่ใช้ cache)
      console.log('🔍 Fetching payment from DB:', paymentId);
      const paymentData = await base44.entities.Payment.filter({ id: paymentId }, '', 1);
      const payment = paymentData?.[0];
      
      if (!payment) {
        toast.error('ไม่พบข้อมูล Payment');
        setSendingReceipt(false);
        return;
      }
      
      // ⭐ FIX: ดึงข้อมูล Tenant ล่าสุดจาก DB แทนการใช้ cache
      console.log('🔍 Fetching latest tenant data for:', payment.tenant_id);
      const latestTenantData = await base44.entities.Tenant.filter({ id: payment.tenant_id }, '', 1);
      const tenant = latestTenantData?.[0];
      
      if (!tenant) {
        toast.error('ไม่พบข้อมูลผู้เช่า');
        setSendingReceipt(false);
        return;
      }
      
      console.log('✅ Latest tenant data:', {
        full_name: tenant.full_name,
        line_user_id: tenant.line_user_id,
        facebook_user_id: tenant.facebook_user_id
      });
      
      const hasFacebook = !!tenant.facebook_user_id;
      const hasLine = !!tenant.line_user_id;
      
      let response;
      if (hasFacebook) {
        console.log('📤 Sending receipt via Facebook to:', hasFacebook);
        response = await base44.functions.invoke('sendFacebookReceipt', {
          paymentId: paymentId
        });
      } else if (hasLine) {
        console.log('📤 Sending receipt via LINE to:', hasLine);
        response = await base44.functions.invoke('sendReceipt', {
          paymentId: paymentId
        });
      } else {
        console.error('❌ ไม่พบ LINE/Facebook User ID:', payment);
        toast.error('ผู้เช่ายังไม่ได้เชื่อมต่อระบบแชท');
        setSendingReceipt(false);
        return;
      }

      if (response.data && response.data.success) {
        const platform = hasFacebook ? 'Facebook' : 'LINE';
        toast.success(response.data.message || `ส่งใบเสร็จทาง ${platform} สำเร็จ`);
        queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] });
      } else {
        const errorMsg = response.data?.message || response.data?.error || 'ส่งใบเสร็จไม่สำเร็จ';
        toast.error(errorMsg, { duration: 7000 });
      }
    } catch (error) {
      console.error('Send receipt error:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งใบเสร็จ: ' + error.message);
    } finally {
      setSendingReceipt(false);
    }
  };

  const handleDeleteTestData = async () => {
    if (!canDeleteTestData) {
      toast.error('คุณไม่มีสิทธิ์ลบข้อมูลทดสอบ');
      return;
    }

    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบข้อมูลทดสอบทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
      return;
    }

    setDeletingTestData(true);
    try {
      const response = await base44.functions.invoke('deleteTestData', {});

      if (response.data && response.data.success) {
        toast.success(response.data.message || 'ลบข้อมูลทดสอบสำเร็จ');
        queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] });
        queryClient.invalidateQueries({ queryKey: ['bookings', selectedBranchId] });
        queryClient.invalidateQueries({ queryKey: ['rooms', selectedBranchId] });
        queryClient.invalidateQueries({ queryKey: ['tenants', selectedBranchId] });
      } else {
        toast.error(response.data?.message || 'ลบข้อมูลทดสอบไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Delete test data error:', error);
      toast.error('เกิดข้อผิดพลาดในการลบข้อมูลทดสอบ');
    } finally {
      setDeletingTestData(false);
    }
  };

  const getStatusBadge = (effectiveStatus, payment = null) => {
    const configs = {
      paid: { label: 'ชำระแล้ว', className: 'bg-green-100 text-green-700 text-xs md:text-sm' },
      pending: { label: 'รอชำระ', className: 'bg-yellow-100 text-yellow-700 text-xs md:text-sm' },
      overdue: { label: 'เกินกำหนด', className: 'bg-red-100 text-red-700 text-xs md:text-sm' },
      partial_paid: { 
        label: payment ? `ชำระบางส่วน (${((payment.paid_amount || 0) / (payment.total_amount || 1) * 100).toFixed(0)}%)` : 'ชำระบางส่วน', 
        className: 'bg-orange-100 text-orange-700 text-xs md:text-sm' 
      },
    };
    return configs[effectiveStatus] ? <Badge className={configs[effectiveStatus].className}>{configs[effectiveStatus].label}</Badge> : null;
  };

  const handleAISearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('กรุณาใส่คำค้นหา');
      return;
    }

    const controller = new AbortController();
    setAiAbortController(controller);
    setAiSearching(true);
    setAiResult(null);

    try {
      const paymentsData = payments.map(p => ({
        id: p.id,
        room_number: p.room_number,
        tenant_name: p.tenant_name,
        tenant_phone: p.tenant_phone,
        due_date: p.due_date,
        payment_date: p.payment_date,
        total_amount: p.total_amount,
        status: getEffectiveStatus(p),
        notes: p.notes
      }));

      const roomsData = rooms.map(r => ({
        id: r.id,
        room_number: r.room_number,
        floor: r.floor,
        status: r.status,
        price: r.price
      }));

      const bookingsData = bookings.map(b => {
        const tenant = tenantsMap.get(b.tenant_id);
        const room = roomsMap.get(b.room_id);
        return {
          id: b.id,
          room_id: b.room_id,
          room_number: room?.room_number,
          tenant_id: b.tenant_id,
          tenant_name: tenant?.full_name,
          tenant_phone: tenant?.phone,
          check_in_date: b.check_in_date
        };
      });

      const waterRateConfig = configs.find(c => c.key === 'water_rate');
      const electricityRateConfig = configs.find(c => c.key === 'electricity_rate');
      const internetRateConfig = configs.find(c => c.key === 'internet_rate');
      const commonFeeConfig = configs.find(c => c.key === 'common_fee');

      const prompt = getAISearchPrompt(searchQuery, paymentsData, roomsData, bookingsData, waterRateConfig, electricityRateConfig, internetRateConfig, commonFeeConfig, format(new Date(), 'yyyy-MM-dd'));

      const response = await Promise.race([
        base44.integrations.Core.InvokeLLM({
          prompt,
          response_json_schema: {
            type: "object",
            properties: {
              answer: { type: "string" },
              action_type: {
                type: "string",
                enum: ["view", "create", "delete"]
              },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  room_id: { type: "string" },
                  booking_id: { type: "string" },
                  tenant_id: { type: "string" },
                  due_date: { type: "string" },
                  rent_amount: { type: "number" },
                  water_units: { type: "number" },
                  water_rate: { type: "number" },
                  water_amount: { type: "number" },
                  electricity_units: { type: "number" },
                  electricity_rate: { type: "number" },
                  electricity_amount: { type: "number" },
                  internet_amount: { type: "number" },
                  common_fee_amount: { type: "number" },
                  parking_fee_amount: { type: "number" },
                  other_amount: { type: "number" },
                  notes: { type: "string" }
                }
              },
              payments: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    payment_id: { type: "string" },
                    reason: { type: "string" }
                  },
                  required: ["payment_id"]
                }
              }
            },
            required: ["answer"]
          }
        }),
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('ยกเลิกการค้นหา'));
          });
        })
      ]);

      if (!controller.signal.aborted) {
        if ((response.action_type === 'create' || response.action_type === 'delete') && response.data) {
          setAiAction({ ...response, description: response.answer });
          setAiResult({ answer: response.answer });
        } else {
          setAiResult(response);
        }
        toast.success('วิเคราะห์สำเร็จ');
      }
    } catch (error) {
      if (error.message === 'ยกเลิกการค้นหา') {
        toast.info('หยุดการค้นหาแล้ว');
      } else {
        console.error('AI Search Error:', error);
        toast.error('เกิดข้อผิดพลาดในการวิเคราะห์');
        setAiResult({
          answer: 'ไม่สามารถวิเคราะห์คำถามได้ในขณะนี้ โปรดลองอีกครั้ง',
          payments: []
        });
      }
    } finally {
      setAiSearching(false);
      setAiAbortController(null);
    }
  };

  const handleStopAISearch = () => {
    if (aiAbortController) {
      aiAbortController.abort();
    }
  };

  const handleAIActionConfirm = async (slipFile, modifiedAction) => {
    const actionData = modifiedAction?.data || aiAction?.data;
    if (!actionData) return;

    setAiActionLoading(true);
    try {
      const actionType = modifiedAction?.action_type || aiAction?.action_type;

      if (actionType === 'delete') {
        if (!actionData.id) {
          throw new Error('ไม่พบ ID ของรายการที่ต้องการลบ');
        }
        const paymentToDelete = payments.find(p => p.id === actionData.id) || { id: actionData.id };
        await deleteMutation.mutateAsync(paymentToDelete);
        toast.success('ลบรายการสำเร็จ');
      } else {
        let paymentData = { ...actionData };

        if (slipFile) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: slipFile });
          paymentData.payment_slip_url = file_url;
          paymentData.payment_method = 'transfer';
        }

        paymentData.branch_id = selectedBranchId;
        paymentData.status = paymentData.payment_date ? 'paid' : 'pending';
        
        const total = 
          (parseFloat(paymentData.rent_amount) || 0) +
          (parseFloat(paymentData.water_amount) || 0) +
          (parseFloat(paymentData.electricity_amount) || 0) +
          (parseFloat(paymentData.internet_amount) || 0) +
          (parseFloat(paymentData.common_fee_amount) || 0) +
          (parseFloat(paymentData.parking_fee_amount) || 0) +
          (parseFloat(paymentData.other_amount) || 0);

        paymentData.total_amount = total;

        await createMutation.mutateAsync(paymentData);
        toast.success('สร้างบิลชำระเงินสำเร็จ');
      }

      setAiAction(null);
      setAiResult(null);
      setSearchQuery('');
    } catch (error) {
      console.error('AI Action Error:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการดำเนินการ');
    } finally {
      setAiActionLoading(false);
    }
  };

  const handleAIActionCancel = () => {
    console.log('❌ User cancelled AI action');
    setAiAction(null);
    setAiResult(prev => prev ? { ...prev, answer: 'ยกเลิกการดำเนินการแล้ว ไม่มีการเปลี่ยนแปลงข้อมูล' } : null);
  };

  const handlePaymentClick = (payment, fromCheckbox = false) => {
    if (isSelectionMode && fromCheckbox) {
      togglePaymentSelection(payment.id);
      return;
    }
    if (isSelectionMode && !fromCheckbox) {
      setSelectedPayment(payment);
      setShowDetailDialog(true);
      return;
    }
    setSelectedPayment(payment);
    setShowDetailDialog(true);
  };

  const handleLongPressStart = (e, paymentId) => {
    if (isSelectionMode) return;
    
    const timer = setTimeout(() => {
      setIsSelectionMode(true);
      setSelectedPaymentIds([paymentId]);
      toast.info('เข้าสู่โหมดเลือกหลายรายการ', { duration: 2000 });
    }, 500);
    setLongPressTimer(timer);
    setLongPressTarget(paymentId);
  };

  const handleLongPressEnd = (e) => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setLongPressTarget(null);
  };

  const togglePaymentSelection = (paymentId) => {
    setSelectedPaymentIds(prev =>
      prev.includes(paymentId)
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  const toggleSelectAllInPage = () => {
    const currentViewPayments = viewMode === 'room' ? roomViewPayments : displayedPayments;
    const displayedPaymentIds = currentViewPayments.map(p => p.id);
    const allSelectedOnPage = displayedPaymentIds.every(id => selectedPaymentIds.includes(id));

    if (allSelectedOnPage) {
      setSelectedPaymentIds(prev => prev.filter(id => !displayedPaymentIds.includes(id)));
    } else {
      setSelectedPaymentIds(prev => [...new Set([...prev, ...displayedPaymentIds])]);
    }
  };

  const selectAllFilteredPayments = () => {
    const paymentsToSelect = viewMode === 'room' ? roomViewPayments : filteredPayments;
    const allFilteredIds = paymentsToSelect.map(p => p.id);
    setSelectedPaymentIds(allFilteredIds);
    toast.success(`เลือกแล้ว ${allFilteredIds.length} รายการทั้งหมด`, { duration: 2000 });
  };

  const handleBulkAIRequest = async () => {
    if (!bulkAIQuery.trim()) return;
    
    setAiSearching(true);
    try {
      const selectedPaymentsData = filteredPayments
        .filter(p => selectedPaymentIds.includes(p.id))
        .map(p => {
          const tenant = getTenantInfo(p.tenant_id);
          const room = getRoomInfo(p.room_id);
          return {
            id: p.id,
            tenant_name: tenant?.full_name,
            room_number: room?.room_number,
            total_amount: p.total_amount,
            status: p.status,
            due_date: p.due_date,
            has_line: !!tenant?.line_user_id
          };
        })
        .slice(0, 10);

      const prompt = getBulkAIPrompt(selectedPaymentIds.length, bulkAIQuery, selectedPaymentsData, format(new Date(), 'yyyy-MM-dd'));

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["update_status", "send_line", "delete", "none"] },
            new_status: { type: "string", enum: ["paid", "pending", "overdue"] },
            due_date: { type: "string" },
            message_type: { type: "string", enum: ["reminder", "receipt"] },
            description: { type: "string" },
            confirmation_message: { type: "string" }
          },
          required: ["action", "description", "confirmation_message"]
        }
      });

      if (result.action === 'none') {
        toast.error(result.description || 'ไม่เข้าใจคำสั่ง');
      } else {
        setBulkAIResult(result);
      }
    } catch (error) {
      console.error(error);
      toast.error('AI Error');
    } finally {
      setAiSearching(false);
    }
  };

  const handleBulkDismiss = async () => {
    if (selectedPaymentIds.length === 0) return;

    const confirmed = confirm(`ลบรายการ ${selectedPaymentIds.length} รายการ?\n\nคำเตือน: การลบจะไม่สามารถกู้คืนได้`);
    if (!confirmed) return;

    setIsBulkExecuting(true);
    try {
      const chunkSize = 20;
      
      for (let i = 0; i < selectedPaymentIds.length; i += chunkSize) {
        const chunk = selectedPaymentIds.slice(i, i + chunkSize);
        await Promise.all(chunk.map(id => base44.entities.Payment.delete(id)));
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] }),
        queryClient.invalidateQueries({ queryKey: ['payments-filtered'] }),
        queryClient.invalidateQueries({ queryKey: ['payments-room-view'] }),
        queryClient.invalidateQueries({ queryKey: ['payments-count'] }),
      ]);

      setSelectedPaymentIds([]);
      setIsSelectionMode(false);
      toast.success(`ลบรายการสำเร็จ ${selectedPaymentIds.length} รายการ`);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const executeBulkAction = async () => {
    if (!bulkAIResult) return;
    
    setIsBulkExecuting(true);
    try {
      if (bulkAIResult.action === 'update_status') {
        const chunkSize = 10;
        for (let i = 0; i < selectedPaymentIds.length; i += chunkSize) {
          const chunk = selectedPaymentIds.slice(i, i + chunkSize);
          const updateData = { status: bulkAIResult.new_status };
          
          if (bulkAIResult.due_date) {
            updateData.due_date = bulkAIResult.due_date;
          }
          
          const promises = chunk.map(id => base44.entities.Payment.update(id, updateData));
          await Promise.all(promises);
        }
        
        queryClient.invalidateQueries(['payments', selectedBranchId]);
        setSelectedPaymentIds([]);
        setBulkAIResult(null);
        setBulkAIQuery('');
        toast.success(`อัปเดต ${bulkAIResult.due_date ? 'วันครบกำหนดและสถานะ' : 'สถานะเป็น ' + bulkAIResult.new_status} สำเร็จ ${selectedPaymentIds.length} รายการ`);
        
      } else if (bulkAIResult.action === 'send_line') {
        const paymentsToSend = filteredPayments.filter(p => selectedPaymentIds.includes(p.id));
        let successCount = 0;
        let failCount = 0;
        
        for (const payment of paymentsToSend) {
          try {
            if (bulkAIResult.message_type === 'receipt') {
              await base44.functions.invoke('sendReceipt', { paymentId: payment.id });
            } else {
              await base44.functions.invoke('sendPaymentReminder', { paymentId: payment.id });
            }
            successCount++;
          } catch (error) {
            console.error('Failed to send for payment:', payment.id, error);
            failCount++;
          }
        }
        
        setSelectedPaymentIds([]);
        setBulkAIResult(null);
        setBulkAIQuery('');
        
        if (failCount === 0) {
          toast.success(`ส่ง LINE สำเร็จ ${successCount} รายการ`);
        } else {
          toast.warning(`ส่งสำเร็จ ${successCount} รายการ, ไม่สำเร็จ ${failCount} รายการ`);
        }
        
      } else if (bulkAIResult.action === 'delete') {
        const chunkSize = 10;
        for (let i = 0; i < selectedPaymentIds.length; i += chunkSize) {
          const chunk = selectedPaymentIds.slice(i, i + chunkSize);
          const promises = chunk.map(id => base44.entities.Payment.delete(id));
          await Promise.all(promises);
        }
        
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] }),
          queryClient.invalidateQueries({ queryKey: ['payments-filtered'] }),
          queryClient.invalidateQueries({ queryKey: ['payments-room-view'] }),
          queryClient.invalidateQueries({ queryKey: ['payments-count'] }),
        ]);
        
        setAiResult(null);
        setAiAction(null);
        setSearchQuery('');
        
        setSelectedPaymentIds([]);
        setBulkAIResult(null);
        setBulkAIQuery('');
        toast.success(`ลบสำเร็จ ${selectedPaymentIds.length} รายการ`);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsBulkExecuting(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-800 mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-slate-600">คุณไม่มีสิทธิ์ในการเข้าถึงหน้านี้ กรุณาติดต่อผู้ดูแลระบบ</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoading = (viewMode === 'room' ? roomViewFetching : paymentsLoading);
  const hasNoData = viewMode === 'room' ? (roomViewPayments.length === 0) : (displayedPayments.length === 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <ScrollToTopButton />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <PageHeader
        title="การชำระเงิน"
        subtitle={`สาขา ${selectedBranchName}`}
        icon={CreditCard}
        actions={
          <>
            {canAdd && !tenantsFetching && !bookingsFetching && tenants.length > 0 && (
              <Button
                onClick={() => {
                  setEditingPayment(null);
                  resetForm();
                  setShowDialog(true);
                }}
                data-onboarding="create-payment-button"
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg gap-2"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden md:inline">เพิ่มการชำระเงิน</span>
              </Button>
            )}
            {canAdd && (tenantsFetching || bookingsFetching) && (
              <Button
                disabled
                className="bg-slate-400 shadow-lg gap-2 cursor-wait"
              >
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="hidden md:inline">กำลังโหลด...</span>
              </Button>
            )}
            {canAdd && !tenantsFetching && !bookingsFetching && tenants.length === 0 && (
              <Button
                disabled
                className="bg-slate-400 shadow-lg gap-2"
                title="ยังไม่มีผู้เช่าในระบบ กรุณาเพิ่มผู้เช่าก่อน"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden md:inline">เพิ่มการชำระเงิน</span>
              </Button>
            )}
          </>
        }
      />

      <div className="px-4 md:px-8 py-3 md:py-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-3 md:space-y-6">
          <div className="flex justify-center md:justify-start -mt-2 md:-mt-4 relative z-20"><div className="flex items-center bg-white/80 backdrop-blur-xl p-1.5 rounded-2xl shadow-sm border border-slate-200/60 overflow-x-auto max-w-full"><button onClick={() => setBookingTypeFilter('all')} className={`px-5 md:px-8 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap ${bookingTypeFilter === 'all' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>ทั้งหมด</button><button onClick={() => setBookingTypeFilter('monthly')} className={`px-5 md:px-8 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap ${bookingTypeFilter === 'monthly' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>รายเดือน</button><button onClick={() => setBookingTypeFilter('daily')} className={`px-5 md:px-8 py-2 md:py-2.5 rounded-xl text-xs md:text-sm font-bold transition-all duration-300 whitespace-nowrap ${bookingTypeFilter === 'daily' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>รายวัน</button></div></div>
          <Card className="hidden md:block bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
            <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
            <CardContent className="p-4 md:p-6 relative">
              <PaymentsAISection
                searchQuery={searchQuery} setSearchQuery={setSearchQuery} handleAISearch={handleAISearch} handleStopAISearch={handleStopAISearch}
                aiSearching={aiSearching} aiAction={aiAction} handleAIActionConfirm={handleAIActionConfirm} handleAIActionCancel={handleAIActionCancel}
                aiActionLoading={aiActionLoading} aiResult={aiResult} payments={payments} getEffectiveStatus={getEffectiveStatus} calculateLateFee={calculateLateFee} handlePaymentClick={handlePaymentClick}
              />
            </CardContent>
          </Card>
          <PaymentsReviewBanner
            viewMode={viewMode} roomViewPayments={roomViewPayments} payments={payments} paymentsLoading={paymentsLoading} roomViewFetching={roomViewFetching}
            rooms={rooms} tenants={tenants} setSlipPreview={setSlipPreview} setConfirmPaymentDialog={setConfirmPaymentDialog} updateStatusMutation={updateStatusMutation}
            setSelectedPayment={setSelectedPayment} setShowDetailDialog={setShowDetailDialog}
          />
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg sticky top-[73px] md:top-[85px] z-30">
            <CardContent className="p-3">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1"><label className="text-xs font-semibold text-slate-700 mb-1 block">ค้นหา</label><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" /><Input placeholder="ค้นหาห้อง หรือผู้เช่า..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-white/90 shadow-inner border-slate-200" />{searchQuery && (<button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>)}</div></div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
                  <div className="flex flex-col gap-1 flex-1 min-w-[140px]"><label className="text-xs font-semibold text-slate-700">ช่วงเวลา</label>
                    <Select value={dateRangeType} onValueChange={setDateRangeType}><SelectTrigger className="w-full text-xs bg-white/90 shadow-md border-slate-300 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="this_month">เดือนนี้</SelectItem><SelectItem value="last_month">1 เดือนที่แล้ว</SelectItem><SelectItem value="3_months">3 เดือน</SelectItem><SelectItem value="6_months">6 เดือน</SelectItem><SelectItem value="12_months">12 เดือน</SelectItem><SelectItem value="this_year">ปีนี้</SelectItem><SelectItem value="last_year">ปีที่แล้ว</SelectItem><SelectItem value="all">ทั้งหมด</SelectItem><SelectItem value="custom">กำหนดเอง</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-[120px]"><label className="text-xs font-semibold text-slate-700">สถานะ</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full text-xs bg-white/90 shadow-md border-slate-300 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">ทั้งหมด</SelectItem><SelectItem value="pending">รอชำระ</SelectItem><SelectItem value="partial_paid">ชำระบางส่วน</SelectItem><SelectItem value="overdue">เกินกำหนด</SelectItem><SelectItem value="paid">ชำระแล้ว</SelectItem></SelectContent></Select>
                  </div>
                  <div className="flex flex-col gap-1 flex-1 min-w-[120px]"><label className="text-xs font-semibold text-slate-700">เรียงตาม</label>
                    <Select value={sortBy} onValueChange={setSortBy}><SelectTrigger className="w-full text-xs bg-white/90 shadow-md border-slate-300 rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="due_date">วันครบกำหนด</SelectItem><SelectItem value="room">หมายเลขห้อง</SelectItem><SelectItem value="created_date">วันที่สร้าง</SelectItem><SelectItem value="amount">ยอดเงิน</SelectItem></SelectContent></Select>
                  </div>
                  {dateRangeType === 'custom' && (
                    <div className="flex flex-col gap-1"><label className="text-xs font-semibold text-slate-700">วันที่</label>
                      <Popover><PopoverTrigger asChild><Button variant="outline" size="sm" className="gap-2 border-green-300 text-green-700 hover:bg-green-50 rounded-xl"><CalendarIcon className="w-4 h-4" />{format(customRange.from, 'd MMM', { locale: th })} - {format(customRange.to, 'd MMM', { locale: th })}</Button></PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end"><CalendarComponent mode="range" selected={customRange} onSelect={(r) => { if (r?.from && r?.to) setCustomRange(r); }} numberOfMonths={2} locale={th} /></PopoverContent>
                      </Popover>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {viewMode === 'card' && paymentsLoading ? (
            <div className="text-center p-8 bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl rounded-xl">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-xl font-semibold text-slate-800">กำลังโหลดข้อมูล...</p>
            </div>
          ) : viewMode === 'card' && displayedPayments.length === 0 ? (
            <div className="text-center p-8 bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl rounded-xl">
              <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <p className="text-xl font-semibold text-slate-800">ไม่พบรายการชำระเงิน</p>
              <p className="text-slate-600">ลองเปลี่ยนช่วงเวลาหรือสถานะการค้นหา</p>
            </div>
          ) : viewMode === 'card' && (
                <div className="grid grid-cols-1 gap-4 relative">
                  <AnimatePresence>
                    {displayedPayments.map((payment) => {
                      const effectiveStatus = getEffectiveStatus(payment);
                      const room = payment.room_number ? { room_number: payment.room_number } : getRoomInfo(payment.room_id);
                      const tenant = payment.tenant_name ? { 
                        full_name: payment.tenant_name, 
                        phone: payment.tenant_phone,
                        line_user_id: payment.tenant_line_user_id,
                        facebook_user_id: payment.tenant_facebook_user_id
                      } : getTenantInfo(payment.tenant_id);
                      const lateFee = (payment.late_fee_amount && payment.late_fee_amount > 0) ? 0 : calculateLateFee(payment);
                      const totalWithLateFee = (payment.total_amount || 0) + lateFee;
                      const canSendReminderForPayment = canSendCommsManual && (effectiveStatus === 'pending' || effectiveStatus === 'overdue') && tenant && (tenant.line_user_id || tenant.facebook_user_id);
                      const canSendReceiptForPayment = canSendReceipt && effectiveStatus === 'paid' && tenant && (tenant.line_user_id || tenant.facebook_user_id);
                      const hasNoLine = !tenant || (!tenant.line_user_id && !tenant.facebook_user_id);
                      const isPaid = effectiveStatus === 'paid';
                      const hasSlip = payment.payment_slip_url && payment.payment_slip_url.trim() !== '';
                      const isExpanded = expandedPayments.has(payment.id);
                      const needsManualReview = payment.status !== 'paid' && payment.notes?.includes('⚠️ รอตรวจสอบ') && !payment.notes?.includes('✅ ยืนยันชำระแล้ว');
                      const isSelected = selectedPaymentIds.includes(payment.id);

                      return (
                        <motion.div key={payment.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="relative" data-payment-item>
                          {isSelectionMode && (
                            <div
                              className={`absolute top-3 left-3 z-10 w-10 h-10 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white/90 border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePaymentSelection(payment.id);
                              }}
                              data-selection-control
                            >
                              {isSelected && <Check className="w-6 h-6" />}
                            </div>
                          )}
                          <div className={isSelectionMode && isSelected ? 'ring-2 ring-blue-500 rounded-2xl' : ''}>
                            <Card 
                              className={`select-none bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all cursor-pointer ${effectiveStatus === 'overdue' ? 'border-red-300 bg-red-50/50' : ''} ${needsManualReview ? 'border-amber-300 bg-amber-50/30' : ''} ${longPressTarget === payment.id ? 'scale-95' : ''}`}
                              onClick={() => {
                                if (isSelectionMode) {
                                  togglePaymentSelection(payment.id);
                                } else {
                                  handlePaymentClick(payment, false);
                                }
                              }}
                              onMouseDown={(e) => {
                                if (!isSelectionMode) handleLongPressStart(e, payment.id);
                              }}
                              onMouseUp={() => {
                                if (!isSelectionMode) handleLongPressEnd();
                              }}
                              onMouseLeave={() => {
                                if (!isSelectionMode) handleLongPressEnd();
                              }}
                              onTouchStart={(e) => {
                                if (!isSelectionMode) handleLongPressStart(e, payment.id);
                              }}
                              onTouchEnd={() => {
                                if (!isSelectionMode) handleLongPressEnd();
                              }}
                              onTouchCancel={() => {
                                if (!isSelectionMode) handleLongPressEnd();
                              }}
                              onContextMenu={(e) => e.preventDefault()}
                            >
                            <CardContent className="p-4 md:p-6">
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                                  <Receipt className="w-5 h-5 md:w-6 md:h-6 text-white" />
                                </div>
                                <div className="flex-1 min-w-0"><div className="flex items-center gap-2 mb-1 flex-wrap"><DoorOpen className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" /><h3 className="text-base md:text-xl font-bold text-slate-800">ห้อง {room?.room_number || 'N/A'}</h3><div className="flex items-center gap-1 md:gap-2 flex-wrap">
                                     <Badge variant="outline" className="text-xs border-blue-200 text-blue-700 bg-blue-50">{payment.booking_type === 'daily' ? 'รายวัน' : 'รายเดือน'}</Badge>
                                     {getStatusBadge(effectiveStatus, payment)}
                                     {payment.bill_sent_date && effectiveStatus !== 'paid' && (
                                       <Badge className="bg-purple-100 text-purple-700 text-xs hidden md:inline-flex" title={`ส่งบิลแล้วเมื่อ ${format(parseISO(payment.bill_sent_date), 'd MMM HH:mm', { locale: th })}`}>
                                         📤 ส่งบิลแล้ว
                                       </Badge>
                                     )}
                                     {payment.due_date_reminder_sent_date && effectiveStatus !== 'paid' && (
                                       <Badge className="bg-orange-100 text-orange-700 text-xs hidden md:inline-flex" title={`ส่งแจ้งครบกำหนดแล้วเมื่อ ${format(parseISO(payment.due_date_reminder_sent_date), 'd MMM HH:mm', { locale: th })}`}>
                                         ⏰ ส่งแจ้งครบกำหนดแล้ว
                                       </Badge>
                                     )}
                                     {payment.receipt_sent_date && effectiveStatus === 'paid' && (
                                       <Badge className="bg-blue-100 text-blue-700 text-xs hidden md:inline-flex" title={`ส่งใบเสร็จแล้วเมื่อ ${format(parseISO(payment.receipt_sent_date), 'd MMM HH:mm', { locale: th })}`}>
                                         📄 ส่งใบเสร็จแล้ว
                                       </Badge>
                                     )}
                                   </div>
                                 </div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <User className="w-3 h-3 md:w-4 md:h-4 text-slate-500 flex-shrink-0" />
                                    <p className="text-xs md:text-sm text-slate-600">{tenant?.full_name || 'ไม่ระบุผู้เช่า'}</p>
                                  </div>
                                  {needsManualReview && (
                                  <div className="bg-amber-100 border border-amber-300 rounded-lg px-3 py-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-start gap-2 mb-2">
                                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                      <span className="text-amber-800 text-xs font-medium flex-1">{payment.notes.split('\n\n').find(n => n.includes('⚠️'))}</span>
                                    </div>
                                    {hasSlip && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          setSlipPreview({ open: true, url: payment.payment_slip_url, title: `สลิป ห้อง ${room?.room_number || 'N/A'}` });
                                        }}
                                        className="w-full mb-2"
                                      >
                                        <img 
                                          src={payment.payment_slip_url} 
                                          alt="สลิป" 
                                          className="w-full max-h-32 object-contain rounded-lg border border-amber-200 bg-white hover:opacity-80 transition-opacity"
                                        />
                                      </button>
                                    )}
                                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                      <button
                                        type="button"
                                        className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          setConfirmPaymentDialog({ open: true, payment });
                                        }}
                                        disabled={updateStatusMutation.isPending}
                                      >
                                        {updateStatusMutation.isPending ? (
                                          <Loader2 className="w-4 h-4 animate-spin" />
                                        ) : (
                                          <Check className="w-4 h-4" />
                                        )}
                                        <span>ยืนยันชำระ</span>
                                      </button>
                                      <button
                                        type="button"
                                        className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-md text-sm font-medium transition-colors"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          console.log('🔘 Card View: Details clicked');
                                          setSelectedPayment(p);
                                          setShowDetailDialog(true);
                                        }}
                                      >
                                        ดูรายละเอียด
                                      </button>
                                    </div>
                                  </div>
                                  )}
                                  {payment.notes?.includes('[TEST-') && (
                                    <p className="text-xs text-slate-400 mt-1 truncate">{payment.notes}</p>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                  <p className="text-xs md:text-sm text-slate-500">ครบกำหนด</p>
                                  <p className="text-xs md:text-sm font-medium text-slate-800">
                                    {(() => {
                                      if (!payment.due_date) return 'N/A';
                                      try {
                                        const date = parseISO(payment.due_date);
                                        if (isNaN(date.getTime())) return 'ข้อมูลไม่ถูกต้อง';
                                        return format(date, 'd MMM yyyy', { locale: th });
                                      } catch {
                                        return 'ข้อมูลไม่ถูกต้อง';
                                      }
                                    })()}
                                    {effectiveStatus === 'overdue' && payment.due_date && (
                                      <span className="text-xs ml-2 text-red-600 font-semibold">
                                        {(() => {
                                          try {
                                            const date = parseISO(payment.due_date);
                                            if (isNaN(date.getTime())) return '';
                                            return `(เกิน ${differenceInDays(getCurrentDate(), date)} วัน)`;
                                          } catch {
                                            return '';
                                          }
                                        })()}
                                      </span>
                                    )}
                                  </p>
                                </div>
                                {payment.payment_date && (
                                  <div>
                                    <p className="text-xs md:text-sm text-slate-500">วันที่ชำระ</p>
                                    <p className="text-xs md:text-sm font-medium text-slate-800">
                                      {(() => {
                                        try {
                                          const date = parseISO(payment.payment_date);
                                          if (isNaN(date.getTime())) return 'ข้อมูลไม่ถูกต้อง';
                                          return format(date, 'd MMM yyyy', { locale: th });
                                        } catch {
                                          return 'ข้อมูลไม่ถูกต้อง';
                                        }
                                      })()}
                                    </p>
                                  </div>
                                )}
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div className="space-y-1 text-xs md:text-sm mb-3 pt-3 border-t border-slate-200">
                                      {payment.security_deposit_amount > 0 && (<div className="flex justify-between"><span className="text-slate-600">เงินประกันห้อง:</span><span className="font-medium">{payment.security_deposit_amount.toLocaleString()} ฿</span></div>)}
                                      {payment.advance_rent_amount > 0 && (<div className="flex justify-between"><span className="text-slate-600">ค่าเช่าล่วงหน้า:</span><span className="font-medium">{payment.advance_rent_amount.toLocaleString()} ฿</span></div>)}
                                      {payment.rent_amount > 0 && (<div className="flex justify-between"><span className="text-slate-600">ค่าเช่า:</span><span className="font-medium">{payment.rent_amount.toLocaleString()} ฿</span></div>)}
                                      {payment.electricity_amount > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">ค่าไฟ ({payment.electricity_units} หน่วย):</span>
                                          <span className="font-medium">{payment.electricity_amount.toLocaleString()} ฿</span>
                                        </div>
                                      )}
                                      {payment.water_amount > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">ค่าน้ำ ({payment.water_units} หน่วย):</span>
                                          <span className="font-medium">{payment.water_amount.toLocaleString()} ฿</span>
                                        </div>
                                      )}
                                      {payment.internet_amount > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">ค่าอินเทอร์เน็ต:</span>
                                          <span className="font-medium">{payment.internet_amount.toLocaleString()} ฿</span>
                                        </div>
                                      )}
                                      {payment.common_fee_amount > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">ค่าส่วนกลาง:</span>
                                          <span className="font-medium">{payment.common_fee_amount.toLocaleString()} ฿</span>
                                        </div>
                                      )}
                                      {payment.parking_fee_amount > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">ค่าจอดรถ:</span>
                                          <span className="font-medium">{payment.parking_fee_amount.toLocaleString()} ฿</span>
                                        </div>
                                      )}
                                      {payment.other_amount > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">ค่าใช้จ่ายอื่นๆ:</span>
                                          <span className="font-medium">{payment.other_amount.toLocaleString()} ฿</span>
                                        </div>
                                      )}
                                      {(payment.late_fee_amount > 0 || lateFee > 0) && (
                                        <div className="flex justify-between text-red-600 font-semibold">
                                          <span>ค่าปรับจ่ายล่าช้า:</span>
                                          <span>+{(payment.late_fee_amount || lateFee).toLocaleString()} ฿</span>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <div className="flex justify-between items-center pt-3 border-t">
                                <span className="text-base md:text-lg font-semibold text-slate-800">รวม:</span>
                                <span className={`text-xl md:text-2xl font-bold ${(payment.late_fee_amount > 0 || lateFee > 0) ? 'text-red-600' : 'text-blue-600'}`}>
                                  {totalWithLateFee.toLocaleString()} ฿
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleExpanded(payment.id);
                                }}
                                className="border-slate-300 hover:bg-slate-50"
                              >
                                  {isExpanded ? (
                                    <>
                                      <ChevronUp className="w-4 h-4 mr-1" />
                                      ซ่อนรายละเอียด
                                    </>
                                  ) : (
                                    <>
                                      <ChevronDown className="w-4 h-4 mr-1" />
                                      ดูรายละเอียด
                                    </>
                                  )}
                                </Button>

                                {hasSlip && (
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="border-purple-600 text-purple-600 hover:bg-purple-50 flex-shrink-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSlipPreview({ open: true, url: payment.payment_slip_url, title: `สลิป ห้อง ${room?.room_number || 'N/A'}` });
                                    }}
                                  >
                                    <Upload className="w-4 h-4 mr-1" />
                                    ดูสลิป
                                  </Button>
                                )}

                                {!isPaid && (
                                  <Link to={`${createPageUrl('Invoice')}?paymentId=${payment.id}`} className="flex-shrink-0">
                                    <Button size="sm" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                                      <FileText className="w-4 h-4 mr-1" />
                                      ใบแจ้งหนี้
                                    </Button>
                                  </Link>
                                )}

                                {isPaid && (
                                  <Link to={`${createPageUrl('Receipt')}?paymentId=${payment.id}`} className="flex-shrink-0">
                                    <Button size="sm" className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                                      <Receipt className="w-4 h-4 mr-1" />
                                      ใบเสร็จ
                                    </Button>
                                  </Link>
                                )}

                                {canSendReceiptForPayment && (
                                  <Button 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSendReceipt(payment.id);
                                    }} 
                                    disabled={sendingReceipt === payment.id} 
                                    className={`flex-shrink-0 ${payment.receipt_sent_date ? 'bg-slate-500 hover:bg-slate-600' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
                                    title={payment.receipt_sent_date ? `ส่งแล้วเมื่อ ${format(parseISO(payment.receipt_sent_date), 'd MMM HH:mm', { locale: th })} (${tenant.facebook_user_id ? 'Facebook' : 'LINE'})` : `ส่งใบเสร็จ (${tenant.facebook_user_id ? 'Facebook' : 'LINE'})`}
                                  >
                                    {sendingReceipt === payment.id ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <>
                                        <Send className="w-4 h-4 mr-1" />
                                        ส่งใบเสร็จ
                                      </>
                                    )}
                                  </Button>
                                )}
                                
                                {userRole === 'developer' && isPaid && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSendReceipt(payment.id);
                                    }} 
                                    disabled={sendingReceipt === payment.id} 
                                    className="flex-shrink-0 border-slate-400 text-slate-600 hover:bg-slate-50"
                                    title="ส่งใบเสร็จอีกครั้ง (Developer)"
                                  >
                                    {sendingReceipt === payment.id ? (
                                      <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <>
                                        <Send className="w-4 h-4 mr-1" />
                                        ส่งซ้ำ
                                      </>
                                    )}
                                  </Button>
                                )}

                                {canSendReminderForPayment && (
                                 <Button 
                                   size="sm" 
                                   onClick={(e) => {
                                     e.stopPropagation();
                                     openReminderDialog(payment.id);
                                   }} 
                                   disabled={sendingReminder === payment.id} 
                                   className="flex-shrink-0 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                                   title={(() => {
                                     if (effectiveStatus === 'overdue') return 'แจ้งเตือนเกินกำหนด';
                                     try {
                                       const dueDate = parseISO(payment.due_date);
                                       const today = getCurrentDate();
                                       today.setHours(0, 0, 0, 0);
                                       dueDate.setHours(0, 0, 0, 0);
                                       const daysUntilDue = differenceInDays(dueDate, today);
                                       return daysUntilDue === 0 ? 'แจ้งเตือนครบกำหนด' : 'ส่งบิล';
                                     } catch {
                                       return 'ส่งบิล';
                                     }
                                   })()}
                                 >
                                   {sendingReminder === payment.id ? (
                                     <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                   ) : (
                                     <>
                                       <Send className="w-4 h-4 mr-1" />
                                       {(() => {
                                         if (effectiveStatus === 'overdue') return 'แจ้งเกินกำหนด';
                                         try {
                                           const dueDate = parseISO(payment.due_date);
                                           const today = getCurrentDate();
                                           today.setHours(0, 0, 0, 0);
                                           dueDate.setHours(0, 0, 0, 0);
                                           const daysUntilDue = differenceInDays(dueDate, today);
                                           return daysUntilDue === 0 ? 'แจ้งครบกำหนด' : 'ส่งบิล';
                                         } catch {
                                           return 'ส่งบิล';
                                         }
                                       })()}
                                     </>
                                   )}
                                 </Button>
                                )}

                                {isExpanded && (
                                 <>
                                   {canEdit && (
                                     <Button 
                                       variant="outline" 
                                       size="sm" 
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         handleEdit(payment);
                                       }} 
                                       className="flex-shrink-0"
                                     >
                                       <Edit2 className="w-4 h-4 mr-1" />
                                       แก้ไข
                                     </Button>
                                   )}
                                    {canDelete && (
                                      <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0" 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('คุณแน่ใจว่าต้องการลบการชำระเงินนี้?')) { 
                                            deleteMutation.mutate(payment); 
                                          } 
                                        }}
                                      >
                                        <Trash2 className="w-4 h-4 mr-1" />
                                        ลบ
                                      </Button>
                                    )}
                                  </>
                                )}

                                {(effectiveStatus !== 'paid' && canConfirmPaid) && (
                                  <Button 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmPaymentDialog({ open: true, payment });
                                    }} 
                                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 flex-shrink-0"
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    ยืนยันชำระ
                                  </Button>
                                )}
                              </div>

                              {hasNoLine && (effectiveStatus === 'pending' || effectiveStatus === 'overdue') && canSendCommsManual && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700 flex items-start gap-2 mt-3">
                                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                  <span>ผู้เช่ายังไม่ได้เชื่อมต่อระบบแชท</span>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}

              {viewMode === 'table' && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl relative">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            {isSelectionMode && (
                              <th className="px-4 py-3 text-center w-12">
                                <div
                                  className={`w-5 h-5 mx-auto rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                                    displayedPayments.every(p => selectedPaymentIds.includes(p.id))
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'bg-white border-slate-300 hover:border-blue-400'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleSelectAllInPage();
                                  }}
                                >
                                  {displayedPayments.every(p => selectedPaymentIds.includes(p.id)) && (
                                    <Check className="w-3 h-3" />
                                  )}
                                </div>
                              </th>
                            )}
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ห้อง</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ผู้เช่า</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ครบกำหนด</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ค่าเช่า</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ค่าไฟ</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ค่าน้ำ</th>
                            <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ยอดรวม</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">สถานะ</th>
                            {(canEdit || canDelete || canConfirmPaid || canSendCommsManual || canSendReceipt) && (
                              <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">จัดการ</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {displayedPayments.map((payment) => {
                            const effectiveStatus = getEffectiveStatus(payment);
                            const tenant = payment.tenant_name ? { 
                              full_name: payment.tenant_name,
                              line_user_id: payment.tenant_line_user_id,
                              facebook_user_id: payment.tenant_facebook_user_id
                            } : getTenantInfo(payment.tenant_id);
                            const lateFee = (payment.late_fee_amount && payment.late_fee_amount > 0) ? 0 : calculateLateFee(payment);
                            const totalWithLateFee = (payment.total_amount || 0) + lateFee;
                            const isPaid = effectiveStatus === 'paid';
                            const isSelected = selectedPaymentIds.includes(payment.id);

                            return (
                              <tr 
                                key={payment.id} 
                                className={`select-none border-b hover:bg-slate-50 cursor-pointer ${effectiveStatus === 'overdue' ? 'bg-red-50/50' : ''} ${isSelected ? 'bg-blue-50/50' : ''} ${longPressTarget === payment.id ? 'bg-blue-100' : ''}`}
                                onClick={() => {
                                  if (isSelectionMode) {
                                    togglePaymentSelection(payment.id);
                                  } else {
                                    handlePaymentClick(payment);
                                  }
                                }}
                                onMouseDown={(e) => {
                                  if (!isSelectionMode) handleLongPressStart(e, payment.id);
                                }}
                                onMouseUp={() => {
                                  if (!isSelectionMode) handleLongPressEnd();
                                }}
                                onMouseLeave={() => {
                                  if (!isSelectionMode) handleLongPressEnd();
                                }}
                                onTouchStart={(e) => {
                                  if (!isSelectionMode) handleLongPressStart(e, payment.id);
                                }}
                                onTouchEnd={() => {
                                  if (!isSelectionMode) handleLongPressEnd();
                                }}
                                onTouchCancel={() => {
                                  if (!isSelectionMode) handleLongPressEnd();
                                }}
                                onContextMenu={(e) => e.preventDefault()}
                                data-payment-item
                              >
                                {isSelectionMode && (
                                  <td className="px-4 py-3 text-center">
                                    <div
                                      className={`w-5 h-5 mx-auto rounded border-2 flex items-center justify-center pointer-events-none transition-all ${
                                        isSelected
                                          ? 'bg-blue-600 border-blue-600 text-white'
                                          : 'bg-white border-slate-300'
                                      }`}
                                    >
                                      {isSelected && <Check className="w-3 h-3" />}
                                    </div>
                                  </td>
                                )}
                                <td className="px-4 py-3 text-sm font-medium text-slate-800">{payment.room_number || 'N/A'}<span className="block text-xs text-blue-600 mt-0.5">{payment.booking_type === 'daily' ? 'รายวัน' : 'รายเดือน'}</span></td><td className="px-4 py-3 text-sm text-slate-600">{payment.tenant_name || 'N/A'}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">
                                  {(() => {
                                    if (!payment.due_date) return 'N/A';
                                    try {
                                      const date = parseISO(payment.due_date);
                                      if (isNaN(date.getTime())) return 'ข้อมูลไม่ถูกต้อง';
                                      return format(date, 'd/M/yy', { locale: th });
                                    } catch {
                                      return 'ข้อมูลไม่ถูกต้อง';
                                    }
                                  })()}
                                  {effectiveStatus === 'overdue' && payment.due_date && (
                                    <span className="block text-xs text-red-600 font-semibold">
                                      {(() => {
                                        try {
                                          const date = parseISO(payment.due_date);
                                          if (isNaN(date.getTime())) return '';
                                          return `เกิน ${differenceInDays(getCurrentDate(), date)} วัน`;
                                        } catch {
                                          return '';
                                        }
                                      })()}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-right">{payment.rent_amount?.toLocaleString() || 0}</td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-right">{payment.electricity_amount?.toLocaleString() || 0}</td>
                                <td className="px-4 py-3 text-sm text-slate-600 text-right">{payment.water_amount?.toLocaleString() || 0}</td>
                                <td className={`px-4 py-3 text-sm font-bold text-right ${(payment.late_fee_amount > 0 || lateFee > 0) ? 'text-red-600' : 'text-blue-600'}`}>
                                  {totalWithLateFee.toLocaleString()}
                                  {(payment.late_fee_amount > 0 || lateFee > 0) && (
                                    <span className="block text-xs text-red-600">(+{(payment.late_fee_amount || lateFee).toLocaleString()} ค่าปรับ)</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm">{getStatusBadge(effectiveStatus, payment)}</td>
                                {(canEdit || canDelete || canConfirmPaid || canSendCommsManual || canSendReceipt) && (
                                  <td className="px-4 py-3">
                                    <div className="flex justify-center gap-1">
                                      {!isPaid && (
                                        <Link to={`${createPageUrl('Invoice')}?paymentId=${payment.id}`}>
                                          <Button variant="ghost" size="icon" className="h-8 w-8" title="ใบแจ้งหนี้"><FileText className="w-4 h-4" /></Button>
                                        </Link>
                                      )}
                                      {isPaid && (
                                        <Link to={`${createPageUrl('Receipt')}?paymentId=${payment.id}`}>
                                          <Button variant="ghost" size="icon" className="h-8 w-8" title="ใบเสร็จรับเงิน"><Receipt className="w-4 h-4" /></Button>
                                        </Link>
                                      )}
                                      {canEdit && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(payment)} title="แก้ไข"><Edit2 className="w-4 h-4" /></Button>
                                      )}
                                      {canDelete && (
                                       <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { if (confirm('คุณแน่ใจว่าต้องการลบ?')) { deleteMutation.mutate(payment); } }} title="ลบ">
                                         <Trash2 className="w-4 h-4" />
                                       </Button>
                                      )}
                                      {effectiveStatus !== 'paid' && canConfirmPaid && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => setConfirmPaymentDialog({ open: true, payment })} title="ยืนยันชำระ">
                                          <CheckCircle2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                      {(effectiveStatus === 'pending' || effectiveStatus === 'overdue') && (tenant?.line_user_id || tenant?.facebook_user_id) && canSendCommsManual && (
                                       <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50" onClick={() => openReminderDialog(payment.id)} disabled={sendingReminder === payment.id} title={effectiveStatus === 'overdue' ? 'แจ้งเตือนเกินกำหนด' : 'แจ้งเตือนครบกำหนด'}>
                                         {sendingReminder === payment.id ? (
                                           <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                         ) : (
                                           <Send className="w-4 h-4" />
                                         )}
                                       </Button>
                                      )}
                                      {isPaid && (tenant?.line_user_id || tenant?.facebook_user_id) && canSendReceipt && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleSendReceipt(payment.id)} disabled={sendingReceipt === payment.id} title="ส่งใบเสร็จ (LINE)">
                                          {sendingReceipt === payment.id ? (
                                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <Send className="w-4 h-4" />
                                          )}
                                        </Button>
                                      )}
                                      {userRole === 'developer' && isPaid && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-600 hover:text-slate-700 hover:bg-slate-50" onClick={() => handleSendReceipt(payment.id)} disabled={sendingReceipt === payment.id} title="ส่งใบเสร็จอีกครั้ง (Developer)">
                                          {sendingReceipt === payment.id ? (
                                            <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <Send className="w-4 h-4" />
                                          )}
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {viewMode === 'room' && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl relative">
                  <CardContent className="p-4 md:p-6">
                    {!tenantsFetching && !bookingsFetching && tenants.length === 0 && bookings.length === 0 && (
                      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-semibold text-red-800">⚠️ ไม่สามารถเพิ่มการชำระเงินได้ตอนนี้</p>
                          <p className="text-sm text-red-700 mt-1">ยังไม่มีผู้เช่าในระบบ หรือไม่มีการจองห้องที่ใช้งานอยู่ กรุณาไปที่หน้าผู้เช่าเพื่อเพิ่มผู้เช่าตามเลขห้อง</p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const [year, month] = roomViewMonth.split('-').map(Number);
                            const prevMonth = new Date(year, month - 2, 1);
                            setRoomViewMonth(format(prevMonth, 'yyyy-MM'));
                          }}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Input
                          type="month"
                          value={roomViewMonth}
                          onChange={(e) => {
                            setRoomViewMonth(e.target.value);
                          }}
                          className="w-40"
                        />
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const [year, month] = roomViewMonth.split('-').map(Number);
                            const nextMonth = new Date(year, month, 1);
                            setRoomViewMonth(format(nextMonth, 'yyyy-MM'));
                          }}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="hidden md:flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-green-500"></div>
                          <span>ชำระแล้ว</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-yellow-500"></div>
                          <span>รอชำระ</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-red-500"></div>
                          <span>เกินกำหนด</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded bg-slate-200"></div>
                          <span>ไม่มีบิล</span>
                        </div>
                      </div>
                    </div>

                    {roomViewFetching && roomViewPayments.length === 0 ? (
                      <div className="space-y-3 py-6">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="flex items-center gap-3 animate-pulse">
                            <div className="w-12 h-12 bg-slate-200 rounded-lg"></div>
                            <div className="flex-1 space-y-2">
                              <div className="h-4 bg-slate-200 rounded" style={{ width: `${60 + Math.random() * 30}%` }}></div>
                              <div className="h-3 bg-slate-200 rounded" style={{ width: `${40 + Math.random() * 20}%` }}></div>
                            </div>
                            <div className="w-20 h-6 bg-slate-200 rounded"></div>
                          </div>
                        ))}
                      </div>
                    ) : (() => {
                      const roomsByFloor = rooms.reduce((acc, room) => {
                        const floor = room.floor || 1;
                        if (!acc[floor]) acc[floor] = [];
                        acc[floor].push(room);
                        return acc;
                      }, {});

                      const sortedFloors = Object.keys(roomsByFloor).sort((a, b) => Number(a) - Number(b));

                      return sortedFloors.map(floor => (
                        <div key={floor} className="mb-6">
                          <h3 className="text-lg font-semibold text-slate-800 mb-3 flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-blue-600" />
                            ชั้น {floor}
                          </h3>
                          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                            {roomsByFloor[floor]
                              .sort((a, b) => a.room_number.localeCompare(b.room_number))
                              .map(room => {
                                const roomPayment = roomViewPayments.find(p => p.room_id === room.id);

                                const effectiveStatus = roomPayment ? getEffectiveStatus(roomPayment) : null;
                                const tenant = roomPayment ? getTenantInfo(roomPayment.tenant_id) : null;
                                const isSelected = roomPayment && selectedPaymentIds.includes(roomPayment.id);
                                const hasNotSentBill = roomPayment && !roomPayment.bill_sent_date && effectiveStatus !== 'paid';

                                let bgColor = 'bg-slate-200 hover:bg-slate-300';
                                let textColor = 'text-slate-600';
                                let statusLabel = 'ไม่มีบิล';

                                if (isSelected && isSelectionMode) {
                                 bgColor = 'bg-blue-600 hover:bg-blue-700';
                                 textColor = 'text-white';
                                } else if (effectiveStatus === 'paid') {
                                 bgColor = 'bg-green-500 hover:bg-green-600';
                                 textColor = 'text-white';
                                 statusLabel = 'ชำระแล้ว';
                                } else if (effectiveStatus === 'partial_paid') {
                                 bgColor = 'bg-orange-500 hover:bg-orange-600';
                                 textColor = 'text-white';
                                 statusLabel = 'ชำระบางส่วน';
                                } else if (effectiveStatus === 'overdue') {
                                 bgColor = 'bg-red-500 hover:bg-red-600';
                                 textColor = 'text-white';
                                 statusLabel = 'เกินกำหนด';
                                } else if (effectiveStatus === 'pending') {
                                 bgColor = 'bg-yellow-500 hover:bg-yellow-600';
                                 textColor = 'text-white';
                                 statusLabel = 'รอชำระ';
                                }

                                return (
                                 <div key={room.id} className="relative">
                                   {isSelectionMode && roomPayment && (
                                     <div
                                       className={`absolute -top-1 -right-1 z-20 w-4 h-4 rounded-full border-2 flex items-center justify-center pointer-events-none transition-all ${
                                         isSelected
                                           ? 'bg-blue-600 border-white'
                                           : 'bg-white border-slate-300'
                                       }`}
                                     >
                                       {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                     </div>
                                   )}
                                   <Dialog 
                                     open={openRoomDialogs[room.id] || false}
                                     onOpenChange={(open) => setOpenRoomDialogs(prev => ({ ...prev, [room.id]: open }))}
                                   >
                                     <DialogTrigger asChild>
                                       <button
                                         className={`select-none ${bgColor} ${textColor} rounded-lg p-2 text-center transition-all shadow-sm hover:shadow-md cursor-pointer w-full relative ${isSelected && isSelectionMode ? 'ring-2 ring-blue-400' : ''} ${longPressTarget === roomPayment?.id ? 'scale-95' : ''}`}
                                         onClick={(e) => {
                                           if (isSelectionMode && roomPayment) {
                                             e.preventDefault();
                                             togglePaymentSelection(roomPayment.id);
                                           }
                                         }}
                                         onMouseDown={(e) => {
                                           if (roomPayment && !isSelectionMode) handleLongPressStart(e, roomPayment.id);
                                         }}
                                         onMouseUp={() => {
                                           if (!isSelectionMode) handleLongPressEnd();
                                         }}
                                         onMouseLeave={() => {
                                           if (!isSelectionMode) handleLongPressEnd();
                                         }}
                                         onTouchStart={(e) => {
                                           if (roomPayment && !isSelectionMode) handleLongPressStart(e, roomPayment.id);
                                         }}
                                         onTouchEnd={() => {
                                           if (!isSelectionMode) handleLongPressEnd();
                                         }}
                                         onTouchCancel={() => {
                                           if (!isSelectionMode) handleLongPressEnd();
                                         }}
                                         onContextMenu={(e) => e.preventDefault()}
                                         data-payment-item
                                       >
                                         <p className="font-bold text-sm">{room.room_number}</p>
                                         {roomPayment && (
                                           <>
                                             <p className="text-xs opacity-90">
                                               {(() => {
                                                 const lateFee = (roomPayment.late_fee_amount && roomPayment.late_fee_amount > 0) ? 0 : calculateLateFee(roomPayment);
                                                 return ((roomPayment.total_amount || 0) + lateFee).toLocaleString();
                                               })()}฿
                                             </p>
                                             <p className="text-xs font-medium mt-0.5">{statusLabel}</p>
                                           </>
                                         )}
                                         {hasNotSentBill && (
                                           <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-500 rounded-full border-2 border-white" title="ยังไม่ส่งบิล" />
                                         )}
                                       </button>
                                     </DialogTrigger>
                                     <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                                       <DialogHeader>
                                         <DialogTitle>ห้อง {room.room_number} - รายละเอียด</DialogTitle>
                                       </DialogHeader>
                                       {roomViewFetching && !roomPayment ? (
                                         <div className="space-y-4 py-8">
                                           <div className="flex flex-col items-center justify-center gap-3">
                                             <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                                             <p className="text-sm text-slate-600">กำลังโหลดข้อมูล...</p>
                                           </div>
                                         </div>
                                       ) : roomPayment ? (
                                         <div className="space-y-4">
                                           <div className="flex items-center justify-between">
                                             <span className="font-medium">สถานะ:</span>
                                             {getStatusBadge(effectiveStatus)}
                                           </div>

                                           <div className="space-y-2 text-sm">
                                             <div className="flex justify-between">
                                               <span className="text-slate-600">ผู้เช่า:</span>
                                               <span className="font-medium">{tenant?.full_name || 'N/A'}</span>
                                             </div>
                                             <div className="flex justify-between">
                                               <span className="text-slate-600">ครบกำหนด:</span>
                                               <span className="font-medium">{roomPayment.due_date ? format(parseISO(roomPayment.due_date), 'd MMM yyyy', { locale: th }) : 'N/A'}</span>
                                             </div>
                                             {roomPayment.payment_date && (
                                               <div className="flex justify-between">
                                                 <span className="text-slate-600">วันที่ชำระ:</span>
                                                 <span className="font-medium">{format(parseISO(roomPayment.payment_date), 'd MMM yyyy', { locale: th })}</span>
                                               </div>
                                             )}
                                           </div>

                                           <div className="border-t pt-3 space-y-2 text-sm">
                                             {roomPayment.rent_amount > 0 && (
                                               <div className="flex justify-between">
                                                 <span className="text-slate-600">ค่าเช่า:</span>
                                                 <span className="font-medium">{roomPayment.rent_amount.toLocaleString()} ฿</span>
                                               </div>
                                             )}
                                             {roomPayment.electricity_amount > 0 && (
                                               <div className="flex justify-between">
                                                 <span className="text-slate-600">ค่าไฟ ({roomPayment.electricity_units} หน่วย):</span>
                                                 <span className="font-medium">{roomPayment.electricity_amount.toLocaleString()} ฿</span>
                                               </div>
                                             )}
                                             {roomPayment.water_amount > 0 && (
                                               <div className="flex justify-between">
                                                 <span className="text-slate-600">ค่าน้ำ ({roomPayment.water_units} หน่วย):</span>
                                                 <span className="font-medium">{roomPayment.water_amount.toLocaleString()} ฿</span>
                                               </div>
                                             )}
                                             {roomPayment.internet_amount > 0 && (
                                               <div className="flex justify-between">
                                                 <span className="text-slate-600">ค่าอินเทอร์เน็ต:</span>
                                                 <span className="font-medium">{roomPayment.internet_amount.toLocaleString()} ฿</span>
                                               </div>
                                             )}
                                             {roomPayment.common_fee_amount > 0 && (
                                               <div className="flex justify-between">
                                                 <span className="text-slate-600">ค่าส่วนกลาง:</span>
                                                 <span className="font-medium">{roomPayment.common_fee_amount.toLocaleString()} ฿</span>
                                               </div>
                                             )}
                                             {roomPayment.parking_fee_amount > 0 && (
                                               <div className="flex justify-between">
                                                 <span className="text-slate-600">ค่าจอดรถ:</span>
                                                 <span className="font-medium">{roomPayment.parking_fee_amount.toLocaleString()} ฿</span>
                                               </div>
                                             )}
                                             {roomPayment.other_amount > 0 && (
                                               <div className="flex justify-between">
                                                 <span className="text-slate-600">อื่นๆ:</span>
                                                 <span className="font-medium">{roomPayment.other_amount.toLocaleString()} ฿</span>
                                               </div>
                                             )}
                                             {(() => {
                                               const lateFee = (roomPayment.late_fee_amount && roomPayment.late_fee_amount > 0) ? 0 : calculateLateFee(roomPayment);
                                               return (roomPayment.late_fee_amount > 0 || lateFee > 0) ? (
                                                 <div className="flex justify-between text-red-600 font-semibold">
                                                   <span>ค่าปรับ:</span>
                                                   <span>+{(roomPayment.late_fee_amount || lateFee).toLocaleString()} ฿</span>
                                                 </div>
                                               ) : null;
                                             })()}
                                           </div>

                                           <div className="border-t pt-3 space-y-2 text-sm">
                                             {effectiveStatus !== 'paid' && (
                                               <>
                                                 {roomPayment.paid_amount > 0 ? (
                                                   <>
                                                     <div className="flex justify-between items-center">
                                                       <span className="text-slate-600">ชำระไปแล้ว:</span>
                                                       <span className="font-bold text-green-700">
                                                         {(roomPayment.paid_amount || 0).toLocaleString()} ฿
                                                       </span>
                                                     </div>
                                                     <div className="flex justify-between items-center pt-2 border-t">
                                                       <span className="text-red-700 font-semibold">ยังค้างชำระอีก:</span>
                                                       <span className="font-bold text-xl text-red-700">
                                                         {(() => {
                                                           const lateFee = (roomPayment.late_fee_amount && roomPayment.late_fee_amount > 0) ? 0 : calculateLateFee(roomPayment);
                                                           const totalDue = (roomPayment.total_amount || 0) + lateFee;
                                                           return (totalDue - (roomPayment.paid_amount || 0)).toLocaleString();
                                                         })()} ฿
                                                       </span>
                                                     </div>
                                                   </>
                                                 ) : (
                                                   <div className="flex justify-between items-center">
                                                     <span className="font-bold">รวมทั้งสิ้น:</span>
                                                     <span className="text-xl font-bold text-blue-600">
                                                       {(() => {
                                                         const lateFee = (roomPayment.late_fee_amount && roomPayment.late_fee_amount > 0) ? 0 : calculateLateFee(roomPayment);
                                                         return ((roomPayment.total_amount || 0) + lateFee).toLocaleString();
                                                       })()} ฿
                                                     </span>
                                                   </div>
                                                 )}
                                               </>
                                             )}
                                             {effectiveStatus === 'paid' && (
                                               <div className="flex items-center gap-2 text-green-700">
                                                 <CheckCircle2 className="w-5 h-5" />
                                                 <span className="font-semibold">ชำระครบถ้วนแล้ว</span>
                                               </div>
                                             )}
                                           </div>

                                           <div className="flex flex-wrap gap-1">
                                             {roomPayment.bill_sent_date && effectiveStatus !== 'paid' && (
                                               <Badge className="bg-purple-100 text-purple-700 text-xs">
                                                 📤 ส่งบิล {format(parseISO(roomPayment.bill_sent_date), 'd MMM HH:mm', { locale: th })}
                                               </Badge>
                                             )}
                                             {roomPayment.due_date_reminder_sent_date && effectiveStatus !== 'paid' && (
                                               <Badge className="bg-orange-100 text-orange-700 text-xs">
                                                 ⏰ ส่งแจ้งครบกำหนด {format(parseISO(roomPayment.due_date_reminder_sent_date), 'd MMM HH:mm', { locale: th })}
                                               </Badge>
                                             )}
                                             {roomPayment.receipt_sent_date && effectiveStatus === 'paid' && (
                                               <Badge className="bg-blue-100 text-blue-700 text-xs">
                                                 📄 ส่งใบเสร็จ {format(parseISO(roomPayment.receipt_sent_date), 'd MMM HH:mm', { locale: th })}
                                               </Badge>
                                             )}
                                           </div>

                                           <div className="flex flex-wrap gap-2 pt-3 border-t">
                                             {effectiveStatus !== 'paid' && (
                                               <Link to={`${createPageUrl('Invoice')}?paymentId=${roomPayment.id}`} className="flex-1 min-w-[100px]">
                                                 <Button size="sm" variant="outline" className="w-full text-xs">
                                                   <FileText className="w-3 h-3 mr-1" />
                                                   ใบแจ้งหนี้
                                                 </Button>
                                               </Link>
                                             )}
                                             {effectiveStatus === 'paid' && (
                                               <Link to={`${createPageUrl('Receipt')}?paymentId=${roomPayment.id}`} className="flex-1 min-w-[100px]">
                                                 <Button size="sm" className="w-full text-xs bg-green-600 hover:bg-green-700">
                                                   <Receipt className="w-3 h-3 mr-1" />
                                                   ใบเสร็จ
                                                 </Button>
                                               </Link>
                                             )}
                                             {canEdit && (
                                               <Button 
                                                 size="sm" 
                                                 variant="outline"
                                                 className="flex-1 min-w-[100px] text-xs"
                                                 onClick={() => handleEdit(roomPayment)}
                                               >
                                                 <Edit2 className="w-3 h-3 mr-1" />
                                                 แก้ไข
                                               </Button>
                                             )}
                                             {effectiveStatus !== 'paid' && canConfirmPaid && (
                                               <Button 
                                                 size="sm" 
                                                 className="w-full text-xs bg-green-600 hover:bg-green-700"
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   setConfirmPaymentDialog({ open: true, payment: roomPayment });
                                                 }}
                                                 disabled={updateStatusMutation.isPending}
                                               >
                                                 {updateStatusMutation.isPending ? (
                                                   <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                 ) : (
                                                   <CheckCircle2 className="w-3 h-3 mr-1" />
                                                 )}
                                                 ยืนยันชำระ
                                               </Button>
                                             )}
                                             {effectiveStatus !== 'paid' && (tenant?.line_user_id || tenant?.facebook_user_id) && canSendCommsManual && (
                                               <Button 
                                                 size="sm" 
                                                 className="w-full text-xs bg-purple-600 hover:bg-purple-700"
                                                 onClick={(e) => {
                                                   e.stopPropagation();
                                                   setConfirmReminderDialog({
                                                     open: true,
                                                     payment: roomPayment,
                                                     template: null
                                                   });
                                                 }}
                                                 disabled={sendingReminder === roomPayment.id}
                                               >
                                                 {sendingReminder === roomPayment.id ? (
                                                   <Loader2 className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                                 ) : (
                                                   <Send className="w-3 h-3 mr-1" />
                                                 )}
                                                 {(() => {
                                                   if (effectiveStatus === 'overdue') return 'แจ้งเกินกำหนด';
                                                   try {
                                                     const dueDate = parseISO(roomPayment.due_date);
                                                     const today = getCurrentDate();
                                                     today.setHours(0, 0, 0, 0);
                                                     dueDate.setHours(0, 0, 0, 0);
                                                     const daysUntilDue = differenceInDays(dueDate, today);
                                                     return daysUntilDue === 0 ? 'แจ้งครบกำหนด' : 'ส่งบิล';
                                                   } catch {
                                                     return 'ส่งบิล';
                                                   }
                                                 })()}
                                               </Button>
                                             )}
                                             {effectiveStatus === 'paid' && (tenant?.line_user_id || tenant?.facebook_user_id) && canSendReceipt && (
                                               <Button 
                                                 size="sm" 
                                                 className={`w-full text-xs ${roomPayment.receipt_sent_date ? 'bg-slate-500 hover:bg-slate-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                                                 onClick={() => handleSendReceipt(roomPayment.id)}
                                                 disabled={sendingReceipt === roomPayment.id}
                                               >
                                                 {sendingReceipt === roomPayment.id ? (
                                                   <Loader2 className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                                 ) : (
                                                   <Send className="w-3 h-3 mr-1" />
                                                 )}
                                                 {roomPayment.receipt_sent_date ? 'ส่งซ้ำ' : 'ส่งใบเสร็จ'}
                                               </Button>
                                             )}
                                             {userRole === 'developer' && effectiveStatus === 'paid' && (
                                               <Button 
                                                 size="sm" 
                                                 variant="outline"
                                                 className="w-full text-xs border-slate-400 text-slate-600 hover:bg-slate-50"
                                                 onClick={() => handleSendReceipt(roomPayment.id)}
                                                 disabled={sendingReceipt === roomPayment.id}
                                               >
                                                 {sendingReceipt === roomPayment.id ? (
                                                   <Loader2 className="w-3 h-3 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-1" />
                                                 ) : (
                                                   <Send className="w-3 h-3 mr-1" />
                                                 )}
                                                 ส่งซ้ำ (Dev)
                                               </Button>
                                             )}
                                             {canDelete && (
                                               <Button 
                                                 size="sm" 
                                                 variant="outline"
                                                 className="w-full text-xs border-red-300 text-red-600 hover:bg-red-50"
                                                 onClick={async () => {
                                                   if (confirm('คุณแน่ใจว่าต้องการลบการชำระเงินนี้?')) {
                                                     try {
                                                       await deleteMutation.mutateAsync(roomPayment);
                                                       setOpenRoomDialogs(prev => ({ ...prev, [room.id]: false }));
                                                     } catch (error) {
                                                       console.error('Delete error:', error);
                                                     }
                                                   }
                                                 }}
                                                 disabled={deleteMutation.isPending}
                                               >
                                                 {deleteMutation.isPending ? (
                                                   <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                                                 ) : (
                                                   <Trash2 className="w-3 h-3 mr-1" />
                                                 )}
                                                 ลบ
                                               </Button>
                                             )}
                                             </div>
                                         </div>
                                       ) : (
                                         <div className="space-y-3">
                                           <p className="text-sm text-slate-500">ไม่มีบิลในเดือนนี้</p>
                                           {canAdd && (
                                             <Button
                                               size="sm"
                                               className="w-full bg-blue-600 hover:bg-blue-700"
                                               onClick={async () => {
                                                 const activeBooking = bookings.find(b => b.room_id === room.id && b.status === 'active');
                                                 if (activeBooking) {
                                                   setEditingPayment(null);
                                                   resetForm();
                                                   setFormData({
                                                     booking_id: activeBooking.id,
                                                     tenant_id: activeBooking.tenant_id,
                                                     room_id: room.id,
                                                     meter_reading_id: '',
                                                     payment_date: '',
                                                     due_date: calculateDueDate(),
                                                     rent_amount: 0,
                                                     water_units: 0,
                                                     water_rate: 0,
                                                     water_amount: 0,
                                                     electricity_units: 0,
                                                     electricity_rate: 0,
                                                     electricity_amount: 0,
                                                     internet_amount: 0,
                                                     common_fee_amount: 0,
                                                     parking_fee_amount: 0,
                                                     other_amount: 0,
                                                     payment_method: 'cash',
                                                     payment_slip_url: '',
                                                     notes: ''
                                                   });
                                                   setShowDialog(true);
                                                   setTimeout(() => autoCalculatePayment(room.id), 100);
                                                 } else {
                                                   toast.error('ห้องนี้ไม่มีการจองที่ใช้งานอยู่');
                                                 }
                                               }}
                                             >
                                               <Plus className="w-3 h-3 mr-1" />
                                               สร้างบิล
                                             </Button>
                                           )}
                                         </div>
                                       )}
                                       </DialogContent>
                                       </Dialog>
                                       </div>
                                       );
                                       })}
                                       </div>
                                       </div>
                                       ));
                                       })()}
                                       </CardContent>
                                       </Card>
                                       )}

          {displayLimit < filteredPayments.length && viewMode !== 'room' && (
            <div ref={loadMoreRef} className="py-8 text-center"><div className="inline-flex items-center gap-2 text-slate-600"><div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" /><span>กำลังโหลดเพิ่ม...</span></div></div>
          )}
          {displayLimit >= filteredPayments.length && filteredPayments.length > 50 && viewMode !== 'room' && (
            <Card className="bg-white/80 backdrop-blur-sm"><CardContent className="p-4 text-center"><p className="text-sm text-slate-600">แสดงครบทั้งหมด {filteredPayments.length} รายการ</p></CardContent></Card>
          )}

          <Dialog open={showDialog} onOpenChange={(open) => { 
            setShowDialog(open); 
            if (!open) { 
              resetForm(); 
            } 
          }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingPayment ? 'แก้ไขการชำระเงิน' : 'บันทึกการชำระเงิน'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>เลือกห้อง *</Label>
                  <Select
                    value={formData.room_id}
                    onValueChange={(value) => {
                      const activeBooking = bookings.find(b => b.room_id === value && b.status === 'active');
                      setFormData({ ...formData, room_id: value, booking_id: activeBooking?.id || '', tenant_id: activeBooking?.tenant_id || '' });
                    }}
                    disabled={!!editingPayment}
                  >
                    <SelectTrigger><SelectValue placeholder="เลือกห้อง" /></SelectTrigger>
                    <SelectContent>
                      {rooms
                        .filter(r => r.status === 'occupied')
                        .sort((a, b) => {
                          if (a.floor !== b.floor) return a.floor - b.floor;
                          return a.room_number.localeCompare(b.room_number);
                        })
                        .map(room => {
                          const activeBooking = bookings.find(b => b.room_id === room.id && b.status === 'active');
                          const tenant = activeBooking ? tenants.find(t => t.id === activeBooking.tenant_id) : null;
                          return (
                            <SelectItem key={room.id} value={room.id}>
                              ห้อง {room.room_number} - {tenant?.full_name || 'ไม่พบข้อมูลผู้เช่า'}
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </div>

                {formData.room_id && !editingPayment && (
                  <Button type="button" onClick={() => autoCalculatePayment(formData.room_id)} disabled={autoCalculating} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700">
                    {autoCalculating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        กำลังคำนวณ...
                      </>
                    ) : (
                      <>
                        <Wand2 className="w-4 h-4 mr-2" />
                        กรอกข้อมูลอัตโนมัติ
                      </>
                    )}
                  </Button>
                )}

                {formData.booking_id && !autoCalculating && (
                  <Card className="bg-green-50 border-green-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <Calculator className="w-5 h-5 text-green-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-green-800 mb-1">คำนวณค่าใช้จ่ายอัตโนมัติแล้ว</p>
                          <p className="text-xs text-green-700">
                            วันครบกำหนดชำระ: {(() => {
                              if (!formData.due_date) return '-';
                              try {
                                const date = parseISO(formData.due_date);
                                if (isNaN(date.getTime())) return 'ข้อมูลไม่ถูกต้อง';
                                return format(date, 'd MMM yyyy', { locale: th });
                              } catch {
                                return 'ข้อมูลไม่ถูกต้อง';
                              }
                            })()}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>วันครบกำหนดชำระ *</Label>
                    <Input type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} required />
                  </div>
                  <div>
                    <Label>วันที่ชำระเงิน</Label>
                    <Input type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} />
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Calculator className="w-5 h-5 text-blue-600" />
                    รายละเอียดค่าใช้จ่าย
                  </h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4"><div><Label>เงินประกัน (บาท)</Label><Input type="number" value={formData.security_deposit_amount} onChange={(e) => setFormData({ ...formData, security_deposit_amount: parseFloat(e.target.value) || 0 })} onWheel={(e) => e.target.blur()} placeholder="0" /></div><div><Label>ค่าเช่าล่วงหน้า (บาท)</Label><Input type="number" value={formData.advance_rent_amount} onChange={(e) => setFormData({ ...formData, advance_rent_amount: parseFloat(e.target.value) || 0 })} onWheel={(e) => e.target.blur()} placeholder="0" /></div></div>
                    <div><Label className="flex items-center gap-2"><DoorOpen className="w-4 h-4 text-slate-600" />ค่าเช่า (บาท)</Label><Input type="number" value={formData.rent_amount} onChange={(e) => setFormData({ ...formData, rent_amount: parseFloat(e.target.value) || 0 })} onWheel={(e) => e.target.blur()} placeholder="0" /></div>

                    <div className="grid grid-cols-2 gap-4">
                      <div><Label className="flex items-center gap-2"><Droplets className="w-4 h-4 text-blue-600" />หน่วยน้ำ</Label><Input type="number" value={formData.water_units} onChange={(e) => setFormData({ ...formData, water_units: parseFloat(e.target.value || 0), water_amount: parseFloat((parseFloat(e.target.value || 0) * parseFloat(formData.water_rate || 0)).toFixed(2)) })} onWheel={(e) => e.target.blur()} placeholder="0" /></div>
                      <div><Label>ค่าน้ำ (บาท)</Label><Input type="number" value={formData.water_amount} onChange={(e) => setFormData({ ...formData, water_amount: parseFloat(e.target.value) || 0 })} onWheel={(e) => e.target.blur()} placeholder="0" /><p className="text-xs text-slate-500 mt-1">อัตรา: {formData.water_rate} บาท/หน่วย</p></div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-600" />หน่วยไฟ</Label>
                        <Input type="number" value={formData.electricity_units} onChange={(e) => {
                          const units = parseFloat(e.target.value || 0);
                          const rate = parseFloat(formData.electricity_rate || 0);
                          setFormData({ ...formData, electricity_units: units, electricity_amount: parseFloat((units * rate).toFixed(2)) });
                        }} onWheel={(e) => e.target.blur()} placeholder="0" />
                      </div>
                      <div>
                        <Label>ค่าไฟ (บาท)</Label>
                        <Input type="number" value={formData.electricity_amount} onChange={(e) => setFormData({ ...formData, electricity_amount: parseFloat(e.target.value) || 0 })} onWheel={(e) => e.target.blur()} placeholder="0" />
                        <p className="text-xs text-slate-500 mt-1">อัตรา: {formData.electricity_rate} บาท/หน่วย</p>
                      </div>
                    </div>

                    <div>
                      <Label className="flex items-center gap-2"><Wifi className="w-4 h-4 text-purple-600" />ค่าอินเทอร์เน็ต (บาท)</Label>
                      <Input type="number" value={formData.internet_amount} onChange={(e) => setFormData({ ...formData, internet_amount: parseFloat(e.target.value) || 0 })} onWheel={(e) => e.target.blur()} placeholder="0" />
                    </div>

                    <div>
                      <Label className="flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-600" />ค่าส่วนกลาง (บาท)</Label>
                      <Input type="number" value={formData.common_fee_amount} onChange={(e) => setFormData({ ...formData, common_fee_amount: parseFloat(e.target.value) || 0 })} onWheel={(e) => e.target.blur()} placeholder="0" />
                    </div>

                    <div>
                      <Label className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-green-600" />ค่าจอดรถ (บาท)</Label>
                      <Input type="number" value={formData.parking_fee_amount} onChange={(e) => setFormData({ ...formData, parking_fee_amount: parseFloat(e.target.value) || 0 })} onWheel={(e) => e.target.blur()} placeholder="0" />
                    </div>

                    <div>
                      <Label>ค่าใช้จ่ายอื่นๆ (บาท)</Label>
                      <Input type="number" value={formData.other_amount} onChange={(e) => setFormData({ ...formData, other_amount: parseFloat(e.target.value) || 0 })} onWheel={(e) => e.target.blur()} placeholder="0" />
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1"><Label className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-600" />ค่าปรับ (บาท)</Label><label className="flex items-center gap-1 text-xs cursor-pointer"><input type="checkbox" checked={formData.late_fee_locked} onChange={e => setFormData({...formData, late_fee_locked: e.target.checked})} className="rounded text-red-600" /> ล็อคค่าปรับอัตโนมัติ</label></div>
                      <Input 
                        type="number" 
                        value={formData.late_fee_amount} 
                        onChange={(e) => setFormData({ ...formData, late_fee_amount: parseFloat(e.target.value) || 0, late_fee_locked: true })} 
                        onWheel={(e) => e.target.blur()}
                        placeholder="0"
                        className="border-red-200 focus:border-red-400"
                      />
                      <p className="text-xs text-slate-500 mt-1">การแก้ไขตัวเลขจะล็อคค่าปรับอัตโนมัติทันที</p>
                    </div>

                    <Card className="bg-slate-50 border-slate-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold text-slate-800">ยอดรวมทั้งสิ้น:</span>
                          <span className="text-2xl font-bold text-blue-600">
                            {(parseFloat(formData.rent_amount || 0) + parseFloat(formData.water_amount || 0) + parseFloat(formData.electricity_amount || 0) + parseFloat(formData.internet_amount || 0) + parseFloat(formData.common_fee_amount || 0) + parseFloat(formData.parking_fee_amount || 0) + parseFloat(formData.other_amount || 0) + parseFloat(formData.late_fee_amount || 0)).toLocaleString()} ฿
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div>
                  <Label>วิธีการชำระเงิน</Label>
                  <Select value={formData.payment_method} onValueChange={(value) => setFormData({ ...formData, payment_method: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">เงินสด</SelectItem>
                      <SelectItem value="transfer">โอนเงิน</SelectItem>
                      <SelectItem value="qr_code">QR Code</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>หลักฐานการโอน</Label>
                  <div className="space-y-2">
                    <Input type="file" accept="image/jpeg,image/jpg,image/png" onChange={handleSlipUpload} disabled={uploadingSlip} className="mt-2" />

                    {uploadingSlip && (
                      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-blue-800">กำลังอัพโหลดสลิป...</span>
                      </div>
                    )}

                    {formData.payment_slip_url && !uploadingSlip && (
                      <div className="space-y-2">
                        <img src={formData.payment_slip_url} alt="หลักฐานการโอน" className="w-full max-w-xs h-48 object-cover rounded-lg border-2 border-green-500" />
                        <div className="flex items-center gap-2 text-sm text-green-700">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>อัพโหลดสำเร็จ</span>
                        </div>
                        <Button type="button" variant="outline" size="sm" onClick={() => setFormData({ ...formData, payment_slip_url: '' })} className="text-red-600 hover:text-red-700">
                          ลบรูปภาพ
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label>หมายเหตุ</Label>
                  <Input value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                 <Button type="button" variant="outline" onClick={() => setShowDialog(false)} disabled={isCreatingPayment}>ยกเลิก</Button>
                 <Button 
                   type="submit" 
                   className="bg-gradient-to-r from-blue-600 to-indigo-600"
                   disabled={createMutation.isPending || updateMutation.isPending || isCreatingPayment}
                 >
                   {(createMutation.isPending || updateMutation.isPending || isCreatingPayment) ? (
                     <>
                       <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                       กำลังบันทึก...
                     </>
                   ) : (
                     editingPayment ? 'อัปเดต' : 'บันทึก'
                   )}
                 </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <AnimatePresence>
        {selectedPaymentIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 z-50 left-4 right-4 md:left-[280px] md:right-6 md:max-w-5xl"
          >
            <Card className="bg-white shadow-2xl border-slate-200 overflow-hidden">
              <div className="p-3 md:p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm md:text-base">เลือกแล้ว {selectedPaymentIds.length} รายการ</p>
                      <p className="text-xs text-slate-500 hidden md:block">จัดการการชำระเงินหลายรายการพร้อมกันด้วย AI</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllFilteredPayments}
                      className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 text-xs flex-1 md:flex-initial"
                      disabled={(viewMode === 'room' ? roomViewPayments : filteredPayments).length === 0}
                    >
                      <CheckSquare className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1" />
                      <span className="hidden md:inline">เลือกทั้งหมด ({(viewMode === 'room' ? roomViewPayments : filteredPayments).length})</span>
                      <span className="md:hidden">ทั้งหมด</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDismiss}
                      disabled={isBulkExecuting}
                      className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100 text-xs flex-1 md:flex-initial"
                    >
                      {isBulkExecuting ? (
                        <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1" />
                      )}
                      <span className="hidden md:inline">ลบ</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSelectedPaymentIds([]);
                        setIsSelectionMode(false);
                      }}
                      className="text-slate-600 hover:bg-slate-50 text-xs flex-1 md:flex-initial"
                    >
                      <X className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1" />
                      <span className="hidden md:inline">ยกเลิก</span>
                    </Button>
                  </div>
                </div>

                {!bulkAIResult ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                      <Input 
                        placeholder="บอก AI ว่าจะทำอะไร... (เช่น 'แก้สถานะเป็น paid', 'ส่งบิลทาง LINE')" 
                        value={bulkAIQuery}
                        onChange={e => setBulkAIQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleBulkAIRequest()}
                        className="pl-10 bg-slate-50 border-slate-200"
                        autoFocus
                      />
                    </div>
                    <Button 
                      onClick={handleBulkAIRequest} 
                      disabled={aiSearching || !bulkAIQuery.trim()}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                    >
                      {aiSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" /> AI แก้ไข</>}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="bg-white p-2 rounded-lg border shadow-sm">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{bulkAIResult.confirmation_message}</p>
                        <p className="text-sm text-slate-600 mt-1">{bulkAIResult.description}</p>
                        
                        {bulkAIResult.action === 'update_status' && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {bulkAIResult.new_status && (
                              <Badge className="bg-blue-100 text-blue-700">
                                สถานะใหม่: {bulkAIResult.new_status}
                              </Badge>
                            )}
                            {bulkAIResult.due_date && (
                              <Badge className="bg-green-100 text-green-700">
                                วันครบกำหนด: {format(parseISO(bulkAIResult.due_date), 'd MMM yyyy', { locale: th })}
                              </Badge>
                            )}
                          </div>
                        )}
                        {bulkAIResult.action === 'send_line' && bulkAIResult.message_type && (
                          <Badge className="mt-2 bg-green-100 text-green-700">
                            {bulkAIResult.message_type === 'receipt' ? '📄 ส่งใบเสร็จ' : '🔔 ส่งแจ้งเตือน'}
                          </Badge>
                        )}
                        {bulkAIResult.action === 'delete' && (
                          <Badge variant="destructive" className="mt-2">ลบถาวร</Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-3 justify-end">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setBulkAIResult(null);
                          setBulkAIQuery('');
                        }}
                        disabled={isBulkExecuting}
                      >
                        แก้ไขคำสั่ง
                      </Button>
                      <Button 
                        onClick={executeBulkAction} 
                        disabled={isBulkExecuting}
                        className={bulkAIResult.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                      >
                        {isBulkExecuting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            กำลังดำเนินการ...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            ยืนยันทำรายการ
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <PaymentDetailDialog
        showDetailDialog={showDetailDialog}
        setShowDetailDialog={setShowDetailDialog}
        selectedPayment={selectedPayment}
        getRoomInfo={getRoomInfo}
        getTenantInfo={getTenantInfo}
        getEffectiveStatus={getEffectiveStatus}
        calculateLateFee={calculateLateFee}
        setSlipPreview={setSlipPreview}
        canConfirmPaid={canConfirmPaid}
        setConfirmPaymentDialog={setConfirmPaymentDialog}
        updateStatusMutation={updateStatusMutation}
        canEdit={canEdit}
        handleEdit={handleEdit}
        getStatusBadge={getStatusBadge}
      />

      <SlipPreviewDialog
        open={slipPreview.open}
        onOpenChange={(open) => setSlipPreview(prev => ({ ...prev, open }))}
        slipUrl={slipPreview.url}
        title={slipPreview.title}
      />

      {confirmReminderDialog.payment && (() => {
        const room = confirmReminderDialog.payment.room_number ? 
          { room_number: confirmReminderDialog.payment.room_number } : 
          getRoomInfo(confirmReminderDialog.payment.room_id);
        const tenant = confirmReminderDialog.payment.tenant_name ? 
          { full_name: confirmReminderDialog.payment.tenant_name } : 
          getTenantInfo(confirmReminderDialog.payment.tenant_id);
        const effectiveStatus = getEffectiveStatus(confirmReminderDialog.payment);
        
        return (
          <Dialog open={confirmReminderDialog.open} onOpenChange={(open) => setConfirmReminderDialog({ open, payment: null })}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>ส่งแจ้งเตือนชำระเงิน</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="text-sm text-slate-600">
                  <p className="font-medium text-slate-800 mb-2">ห้อง {room?.room_number || 'N/A'}</p>
                  <p>ผู้เช่า: {tenant?.full_name || 'N/A'}</p>
                  <p>ยอดเงิน: {confirmReminderDialog.payment?.total_amount?.toLocaleString() || 0} บาท</p>
                  <p className="mt-2">
                    ส่งแบบ: <Badge className={effectiveStatus === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}>
                      {effectiveStatus === 'overdue' ? 'เกินกำหนด' : 'ครบกำหนด'}
                    </Badge>
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setConfirmReminderDialog({ open: false, payment: null })}
                  className="flex-1"
                >
                  ยกเลิก
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleEditReminderMessage(confirmReminderDialog.payment)}
                  className="flex-1"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  แก้ไขข้อความ
                </Button>
                <Button
                  onClick={() => handleConfirmSendNow(confirmReminderDialog.payment, confirmReminderDialog.template)}
                  disabled={sendingReminder === confirmReminderDialog.payment.id}
                  className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {sendingReminder === confirmReminderDialog.payment.id ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังส่ง...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      ยืนยันส่งเลย
                    </>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {reminderDialog.payment && (
        <SendReminderDialog
          open={reminderDialog.open}
          onOpenChange={(open) => setReminderDialog({ open, payment: null, template: null })}
          payment={reminderDialog.payment}
          room={reminderDialog.payment.room_number ? 
            { room_number: reminderDialog.payment.room_number } : 
            getRoomInfo(reminderDialog.payment.room_id)}
          tenant={reminderDialog.payment.tenant_name ? 
            { full_name: reminderDialog.payment.tenant_name } : 
            getTenantInfo(reminderDialog.payment.tenant_id)}
          effectiveStatus={getEffectiveStatus(reminderDialog.payment)}
          lateFee={calculateLateFee(reminderDialog.payment)}
          tiersEnabled={(() => {
            const branchConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === selectedBranchId);
            const globalConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
            const tiersEnabledConfig = branchConfig || globalConfig;
            return tiersEnabledConfig?.value === 'true';
          })()}
          configs={configs}
          selectedBranchId={selectedBranchId}
          onConfirm={(template, customMessage) => handleSendReminder(reminderDialog.payment.id, template, customMessage)}
          isSending={sendingReminder === reminderDialog.payment.id}
        />
      )}

      {confirmPaymentDialog.payment && (
        <ConfirmPaymentDialog
          open={confirmPaymentDialog.open}
          onClose={() => setConfirmPaymentDialog({ open: false, payment: null })}
          payment={confirmPaymentDialog.payment}
          room={confirmPaymentDialog.payment.room_number ? 
            { room_number: confirmPaymentDialog.payment.room_number } : 
            getRoomInfo(confirmPaymentDialog.payment.room_id)}
          tenant={confirmPaymentDialog.payment.tenant_name ? 
            { full_name: confirmPaymentDialog.payment.tenant_name } : 
            getTenantInfo(confirmPaymentDialog.payment.tenant_id)}
          configs={configs}
          selectedBranchId={selectedBranchId}
          onConfirmWithoutSlip={() => {
            updateStatusMutation.mutate({ 
              id: confirmPaymentDialog.payment.id, 
              status: 'paid', 
              payment_date: getTodayDateString() 
            });
          }}
          onConfirmWithSlip={async (verifyResult) => {
            await queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] });
            await queryClient.invalidateQueries({ queryKey: ['payments-filtered'] });
            await queryClient.invalidateQueries({ queryKey: ['payments-room-view'] });
            setConfirmPaymentDialog({ open: false, payment: null });
          }}
          confirming={updateStatusMutation.isPending}
        />
      )}
    </div>
  );
}