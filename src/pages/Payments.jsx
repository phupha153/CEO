import React, { useState, useEffect, useMemo, useCallback } from "react";
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
import { Plus, CreditCard, Upload, Receipt, Edit2, Trash2, DoorOpen, Zap, Droplets, Wifi, Calculator, Send, Users, FileText, AlertTriangle, LayoutGrid, Table as TableIcon, Clock, CheckCircle2, XCircle, Wand2, Building2, TestTube, Search, ChevronLeft, ChevronRight, X, Calendar as CalendarIcon, Sparkles, Loader2, ChevronDown, ChevronUp, User, Home, CheckSquare, Check } from "lucide-react";
import { format, parseISO, differenceInDays, addMonths, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears, isWithinInterval } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "../components/shared/PageHeader";
import AISearchBox from "../components/shared/AISearchBox";
import AIResultCard from "../components/shared/AIResultCard";
import AIActionConfirmation from "../components/shared/AIActionConfirmation";
import SendAdvanceReminderButton from "@/components/settings/SendAdvanceReminderButton";
import GenerateMonthlyBillsButton from "@/components/payments/GenerateMonthlyBillsButton";
import SlipPreviewDialog from "@/components/shared/SlipPreviewDialog";

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

  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [dateRangeType, setDateRangeType] = useState('this_month');
  const [customRange, setCustomRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('room');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [sortBy, setSortBy] = useState('due_date'); // 'due_date', 'room', 'created_date', 'amount'
  
  // Room View State
  const [roomViewMonth, setRoomViewMonth] = useState(() => {
    const nextMonth = addMonths(new Date(), 1);
    return format(nextMonth, 'yyyy-MM');
  });

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

  const [formData, setFormData] = useState({
    booking_id: '',
    tenant_id: '',
    room_id: '',
    meter_reading_id: '',
    payment_date: '',
    due_date: '',
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

  // Reset filters and clear cache when branch changes
  useEffect(() => {
    setDateRangeType('all');
    setStatusFilter('all');
    setCurrentPage(1);
    setSearchQuery('');
    setAiResult(null);

    queryClient.removeQueries({ queryKey: ['payments', selectedBranchId] });
    queryClient.removeQueries({ queryKey: ['bookings', selectedBranchId] });
    queryClient.removeQueries({ queryKey: ['rooms', selectedBranchId] });
    queryClient.removeQueries({ queryKey: ['tenants', selectedBranchId] });
  }, [selectedBranchId, queryClient]);

  const getTodayDateString = () => {
    try {
      const dateStr = new Date().toISOString();
      if (typeof dateStr === 'string' && dateStr.includes('T')) {
        return dateStr.split('T')[0];
      }
      return new Date().toISOString().substring(0, 10);
    } catch {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const userPermissions = currentUser?.permissions || [];
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  const canView = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_view');
  const canAdd = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_add');
  const canEdit = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_edit');
  const canDelete = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_delete');
  const canConfirmPaid = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_confirm_paid');
  const canSendReminder = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_send_reminder');
  const canSendReceipt = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_send_receipt');
  const canViewInvoice = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_view_invoice');
  const canViewReceipt = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_view_receipt');
  const canAutoCalculate = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_autocalculate');
  const canDeleteTestData = userRole === 'developer';

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
  };

  const { data: payments = [], isLoading: paymentsLoading, isFetching: paymentsFetching } = useQuery({
    queryKey: ['payments', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // Query เฉพาะ branch และจำกัด 10000 รายการล่าสุด (เท่ากับ Dashboard)
      const payments = await base44.entities.Payment.filter(
        { branch_id: selectedBranchId },
        '-created_date',
        10000
      );
      
      console.log('🔍 Payments Page - Fetched at:', new Date().toLocaleTimeString('th-TH'));
      console.log('Selected Branch ID:', selectedBranchId);
      console.log('Total Payments Fetched:', payments.length);
      console.log('Sample payments (first 3):', payments.slice(0, 3).map(p => ({
        id: p.id.substring(0, 8),
        status: p.status,
        total_amount: p.total_amount,
        updated_date: p.updated_date
      })));
      
      // เช็คว่ามี payment ที่ branch_id ไม่ตรงหรือไม่
      const wrongBranch = payments.filter(p => p.branch_id !== selectedBranchId);
      if (wrongBranch.length > 0) {
        console.warn('⚠️ Found payments with wrong branch_id:', wrongBranch.length);
        console.warn('Sample wrong branch payments:', wrongBranch.slice(0, 3));
      }
      
      return payments;
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
    refetchInterval: false,
  });

  const { data: bookings = [], isFetching: bookingsFetching } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // Query เฉพาะ branch และจำกัด 300 รายการล่าสุด
      const bookings = await base44.entities.Booking.filter(
        { branch_id: selectedBranchId },
        '-created_date',
        300
      );
      return bookings;
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 2 * 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });

  const { data: rooms = [], isFetching: roomsFetching } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // Query เฉพาะ branch
      const rooms = await base44.entities.Room.filter(
        { branch_id: selectedBranchId },
        '-room_number',
        500
      );
      return rooms;
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 4 * 60 * 60 * 1000,
    gcTime: 8 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });

  const { data: tenants = [], isFetching: tenantsFetching } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // Query เฉพาะ branch และจำกัด 500 รายการล่าสุด
      const tenants = await base44.entities.Tenant.filter(
        { branch_id: selectedBranchId },
        '-created_date',
        500
      );
      return tenants;
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 2 * 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });

  const { data: meterReadings = [] } = useQuery({
    queryKey: ['meterReadings'],
    queryFn: () => base44.entities.MeterReading.list('-reading_date', 100),
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    ...retryConfig,
    staleTime: 4 * 60 * 60 * 1000,
    gcTime: 8 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

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
    const now = new Date();
    switch(dateRangeType) {
      case 'all':
        return null;
      case 'this_month':
        return { from: startOfMonth(now), to: endOfMonth(now) };
      case 'last_month':
        return { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
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
        return null;
    }
  };

  const dateRange = useMemo(() => getMainDateRange(), [dateRangeType, customRange]);

  const calculateDueDate = () => {
    // ดึง pay_day จาก config ของสาขา (ถ้ามี) ไม่งั้นใช้ global
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
    
    // ถ้าวันสร้างบิล > วันครบกำหนด = due date อยู่ในเดือนถัดไป
    let dueMonth = today.getMonth();
    let dueYear = today.getFullYear();
    
    if (billGenerationDay > payDay) {
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

      if (!payment || !payment.due_date || payment.status === 'paid') {
        cache.set(payment.id, 0);
        return 0;
      }

      // ตรวจสอบว่าเปิดใช้ค่าปรับแบบขั้นบันไดหรือไม่
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

        const todayStartOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const dueDateStartOfDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        const daysOverdue = Math.floor((todayStartOfDay.getTime() - dueDateStartOfDay.getTime()) / (1000 * 60 * 60 * 24));

        if (daysOverdue <= 0) {
          cache.set(payment.id, 0);
          return 0;
        }

        // ถ้าใช้ค่าปรับแบบขั้นบันได
        if (tiersEnabled) {
          const branchTiersConfig = configsList.find(c => c.key === 'late_fee_tiers' && c.branch_id === selectedBranchId);
          const globalTiersConfig = configsList.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
          const tiersConfig = branchTiersConfig || globalTiersConfig;
          
          if (tiersConfig?.value) {
            try {
              const tiers = JSON.parse(tiersConfig.value);
              let totalFee = 0;

              // คำนวณค่าปรับแต่ละช่วง
              for (const tier of tiers) {
                const daysFrom = tier.days_from || 1;
                const daysTo = tier.days_to || 999;
                const feePerDay = parseFloat(tier.fee_per_day || 0);

                if (daysOverdue >= daysFrom) {
                  const daysInThisTier = Math.min(daysOverdue, daysTo) - daysFrom + 1;
                  if (daysInThisTier > 0) {
                    totalFee += daysInThisTier * feePerDay;
                  }
                }

                if (daysOverdue <= daysTo) break;
              }

              cache.set(payment.id, totalFee);
              return totalFee;
            } catch (e) {
              console.error('Error parsing late fee tiers:', e);
            }
          }
        }

        // ถ้าไม่ได้เปิดใช้ขั้นบันได หรือ parse ไม่ได้ → ใช้ค่าปรับแบบเดิม
        const lateFeeConfig = configsList.find(c => c.key === 'late_payment_fee_per_day');
        const lateFeePerDay = lateFeeConfig ? parseFloat(lateFeeConfig.value) : 0;

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
    if (!canAutoCalculate) {
      toast.error('คุณไม่มีสิทธิ์ใช้ฟังก์ชันคำนวณอัตโนมัติ');
      setAutoCalculating(false);
      return;
    }

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

      // Helper function to get config value with branch priority
      const getConfigValue = (key, defaultValue) => {
        const branchConfig = configs.find(c => c.key === key && c.branch_id === selectedBranchId);
        if (branchConfig && branchConfig.value !== undefined && branchConfig.value !== '') {
          return parseFloat(branchConfig.value);
        }
        const globalConfig = configs.find(c => c.key === key && !c.branch_id);
        return globalConfig && globalConfig.value !== undefined && globalConfig.value !== '' ? parseFloat(globalConfig.value) : defaultValue;
      };

      // Calculate Rates (Priority: Room Specific > Branch Config > Default)
      const waterRate = room.water_rate || getConfigValue('water_rate', 18);
      const electricityRate = room.electricity_rate || getConfigValue('electricity_rate', 7);
      const internetRate = getConfigValue('internet_rate', 0); // Default to 0 if not set
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

      // ⭐ ตรวจสอบค่าขั้นต่ำสำหรับน้ำและไฟ
      let notesAddition = '';
      
      // Helper to get string config value
      const getStringConfigValue = (key) => {
        const branchConfig = configs.find(c => c.key === key && c.branch_id === selectedBranchId);
        if (branchConfig) return branchConfig.value;
        const globalConfig = configs.find(c => c.key === key && !c.branch_id);
        return globalConfig?.value || '';
      };
      
      // ค่าน้ำขั้นต่ำ
      const waterMinEnabled = getStringConfigValue('water_minimum_enabled') === 'true';
      if (waterMinEnabled && waterUnits > 0) {
        const minUnits = parseFloat(getStringConfigValue('water_minimum_units') || '3');
        const minCharge = parseFloat(getStringConfigValue('water_minimum_charge') || '0');
        
        if (waterUnits < minUnits && minCharge > 0) {
          waterUnits = minUnits;
          notesAddition += `💧 ใช้น้ำ ${actualWaterUnits.toFixed(1)} หน่วย → คิดขั้นต่ำ ${minUnits} หน่วย\n`;
        }
      }
      
      // ค่าไฟขั้นต่ำ
      const elecMinEnabled = getStringConfigValue('electricity_minimum_enabled') === 'true';
      if (elecMinEnabled && electricityUnits > 0) {
        const minUnits = parseFloat(getStringConfigValue('electricity_minimum_units') || '3');
        const minCharge = parseFloat(getStringConfigValue('electricity_minimum_charge') || '0');
        
        if (electricityUnits < minUnits && minCharge > 0) {
          electricityUnits = minUnits;
          notesAddition += `⚡ ใช้ไฟ ${actualElectricityUnits.toFixed(1)} หน่วย → คิดขั้นต่ำ ${minUnits} หน่วย\n`;
        }
      }

      const waterAmount = waterUnits * waterRate;
      const electricityAmount = electricityUnits * electricityRate;
      const rentAmount = room.price || 0;

      const tenant = tenants.find(t => t.id === activeBooking.tenant_id);
      let parkingFeeAmount = 0;
      if (tenant && tenant.vehicles && tenant.vehicles.length > 0) {
        const carCount = tenant.vehicles.filter(v => v.type === 'car').length;
        const motorcycleCount = tenant.vehicles.filter(v => v.type === 'motorcycle').length;
        parkingFeeAmount = (carCount * carParkingFee) + (motorcycleCount * motorcycleParkingFee);
      }

      // Calculate Other Monthly Fees from Room
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
  }, [currentDateMemo]);

  const filteredPayments = useMemo(() => {
    if (isDataFetching || !selectedBranchId) {
      return [];
    }

    let result = payments;
  
    // ⭐ กรองตาม dateRange เฉพาะเมื่อไม่ใช่ "ทั้งหมด"
    if (dateRange && dateRangeType !== 'all') {
      result = result.filter(payment => {
        const effectiveStatus = getEffectiveStatus(payment);
        
        // ⭐ สำหรับ paid payments ให้กรองตาม payment_date (เหมือน Dashboard)
        if (effectiveStatus === 'paid') {
          if (!payment.payment_date) return false;
          try {
            const paymentDate = parseISO(payment.payment_date);
            if (isNaN(paymentDate.getTime())) return false;
            return isWithinInterval(paymentDate, { start: dateRange.from, end: dateRange.to });
          } catch (error) {
            console.error('Error filtering payment by date:', error);
            return false;
          }
        }
        
        // ⭐ สำหรับ pending/overdue ให้กรองตาม due_date (ไม่เปลี่ยนแปลง)
        if (effectiveStatus === 'pending' || effectiveStatus === 'overdue') {
          if (!payment.due_date) return false;
          try {
            const dueDate = parseISO(payment.due_date);
            if (isNaN(dueDate.getTime())) return false;
            return isWithinInterval(dueDate, { start: dateRange.from, end: dateRange.to });
          } catch {
            return false;
          }
        }
        
        return false;
      });
    }
  
    if (statusFilter !== 'all') {
      result = result.filter(payment => getEffectiveStatus(payment) === statusFilter);
    }
  
    if (searchQuery.trim() && (!aiResult || aiResult.payments?.length === 0)) {
      const query = searchQuery.toLowerCase();
      result = result.filter(payment => {
        const room = rooms.find(r => r.id === payment.room_id);
        const tenant = tenants.find(t => t.id === payment.tenant_id);
        return room?.room_number?.toLowerCase().includes(query) ||
               tenant?.full_name?.toLowerCase().includes(query) ||
               tenant?.phone?.toLowerCase().includes(query) ||
               payment.notes?.toLowerCase().includes(query);
      });
    }

    if (aiResult && aiResult.payments && aiResult.payments.length > 0) {
      const aiPaymentIds = new Set(aiResult.payments.map(p => p.payment_id));
      result = result.filter(payment => aiPaymentIds.has(payment.id));
    }
  
    // Sort results
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'room': {
          const roomA = rooms.find(r => r.id === a.room_id);
          const roomB = rooms.find(r => r.id === b.room_id);
          return (roomA?.room_number || '').localeCompare(roomB?.room_number || '', 'th', { numeric: true });
        }
        case 'created_date':
          return new Date(b.created_date || 0) - new Date(a.created_date || 0);
        case 'amount':
          return (b.total_amount || 0) - (a.total_amount || 0);
        case 'due_date':
        default:
          return new Date(b.due_date || 0) - new Date(a.due_date || 0);
      }
    });

    return result;
  }, [payments, dateRange, statusFilter, searchQuery, rooms, tenants, getEffectiveStatus, selectedBranchId, isDataFetching, aiResult, sortBy]);

  const totalPages = Math.ceil(filteredPayments.length / itemsPerPage);
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredPayments.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredPayments, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [dateRangeType, customRange, statusFilter, searchQuery, aiResult]);

  const getRoomInfo = (roomId) => rooms.find(r => r.id === roomId);
  const getTenantInfo = (tenantId) => tenants.find(t => t.id === tenantId);

  const statusCounts = useMemo(() => {
    return {
      all: filteredPayments.length,
      paid: filteredPayments.filter(p => getEffectiveStatus(p) === 'paid').length,
      pending: filteredPayments.filter(p => getEffectiveStatus(p) === 'pending').length,
      overdue: filteredPayments.filter(p => getEffectiveStatus(p) === 'overdue').length,
    };
  }, [filteredPayments, getEffectiveStatus]);

  const totalAmounts = useMemo(() => {
    const calculateSum = (paymentsToSum) => {
      return paymentsToSum.reduce((sum, p) => {
        const baseAmount = parseFloat(p.total_amount) || 0;
        const lateFee = calculateLateFee(p);
        if (isNaN(baseAmount) || isNaN(lateFee)) {
          console.error('Invalid amount for payment:', p.id, { baseAmount, lateFee });
          return sum;
        }
        return sum + baseAmount + lateFee;
      }, 0);
    };
  
    return {
      all: calculateSum(filteredPayments),
      paid: calculateSum(filteredPayments.filter(p => getEffectiveStatus(p) === 'paid')),
      pending: calculateSum(filteredPayments.filter(p => getEffectiveStatus(p) === 'pending')),
      overdue: calculateSum(filteredPayments.filter(p => getEffectiveStatus(p) === 'overdue')),
    };
  }, [filteredPayments, getEffectiveStatus, calculateLateFee]);

  const pendingOverduePayments = filteredPayments.filter(p => {
    const status = getEffectiveStatus(p);
    return status === 'pending' || status === 'overdue';
  });

  const tenantsWithLine = pendingOverduePayments.filter(p => {
    const tenant = getTenantInfo(p.tenant_id);
    // ⭐ ข้ามห้องที่ส่งบิลไปแล้ว (มี bill_sent_date)
    return tenant && tenant.line_user_id && !p.bill_sent_date;
  }).length;

  const testPaymentsCount = payments.filter(p => p.notes?.includes('[TEST-')).length;

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

  const createMutation = useMutation({
    mutationFn: (data) => {
      if (!canAdd) throw new Error('คุณไม่มีสิทธิ์เพิ่มการชำระเงิน');
      return base44.entities.Payment.create({...data, branch_id: selectedBranchId});
    },
    onSuccess: async (newPayment) => {
      queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] });
      
      // บันทึก log
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
      
      setShowDialog(false);
      resetForm();
      toast.success('บันทึกการชำระเงินสำเร็จ');
    },
    onError: (error) => {
      console.error('Create payment error:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการบันทึก');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (!canEdit) throw new Error('คุณไม่มีสิทธิ์แก้ไขการชำระเงิน');
      // ⭐ เมื่อแก้ไขบิล ให้เคลียร์สถานะรูปเพื่อให้สร้างใหม่
      return base44.entities.Payment.update(id, {
        ...data,
        invoice_image_url: null,
        invoice_image_status: 'pending',
        bill_sent_date: null
      });
    },
    onSuccess: async (updatedPayment) => {
      queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] });
      
      // บันทึก log
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
      
      setShowDialog(false);
      resetForm();
      toast.success('อัปเดตการชำระเงินสำเร็จ - รูปใบแจ้งหนี้จะถูกสร้างใหม่', { duration: 4000 });
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const deleteMutation = useMutation({
    mutationFn: async (payment) => {
      if (!canDelete) throw new Error('คุณไม่มีสิทธิ์ลบการชำระเงิน');
      await base44.entities.Payment.delete(payment.id);
      return payment;
    },
    onSuccess: async (deletedPayment) => {
      queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] });
      
      // บันทึก log
      const room = rooms.find(r => r.id === deletedPayment.room_id);
      const tenant = tenants.find(t => t.id === deletedPayment.tenant_id);
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
      
      toast.success('ลบการชำระเงินสำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, payment_date }) => {
      console.log('🚀 updateStatusMutation.mutationFn CALLED with:', { id, status, payment_date, canConfirmPaid });
      if (!canConfirmPaid) {
        console.error('❌ canConfirmPaid is false!');
        throw new Error('คุณไม่มีสิทธิ์ยืนยันการชำระเงิน');
      }
      console.log('✅ Permission check passed, calling API...');
      const result = await base44.entities.Payment.update(id, { 
        status, 
        payment_date,
        notes: '✅ ยืนยันชำระแล้ว (ผ่านการตรวจสอบด้วยตนเอง)'
      });
      console.log('📤 API call completed:', result);
      return result;
    },
    onSuccess: async (updatedPayment, variables) => {
      console.log('✅ onSuccess triggered! Updated payment:', updatedPayment);
      queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['allPayments'] });
      
      // บันทึก log การยืนยันชำระเงิน
      if (variables.status === 'paid') {
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
          description: `ยืนยันชำระเงินห้อง ${room?.room_number || 'N/A'} จำนวน ${updatedPayment.total_amount?.toLocaleString()} บาท`
        });

        // ⭐ คำนวณและให้คะแนนชำระเงิน (ยิ่งชำระเร็วยิ่งได้คะแนนสูง)
        if (tenant && updatedPayment.due_date && updatedPayment.payment_date) {
          try {
            const dueDate = parseISO(updatedPayment.due_date);
            const paymentDate = parseISO(updatedPayment.payment_date);
            const daysDiff = differenceInDays(dueDate, paymentDate); // บวก = ชำระก่อนกำหนด, ลบ = ชำระช้า

            let paymentScore = 5; // คะแนนฐาน

            if (daysDiff >= 7) {
              paymentScore = 10; // ชำระก่อนกำหนด 7 วันขึ้นไป → 10 คะแนน
            } else if (daysDiff >= 3) {
              paymentScore = 9; // ชำระก่อนกำหนด 3-6 วัน → 9 คะแนน
            } else if (daysDiff >= 1) {
              paymentScore = 8; // ชำระก่อนกำหนด 1-2 วัน → 8 คะแนน
            } else if (daysDiff === 0) {
              paymentScore = 7; // ชำระตรงเวลา → 7 คะแนน
            } else if (daysDiff >= -3) {
              paymentScore = 5; // ชำระช้า 1-3 วัน → 5 คะแนน
            } else if (daysDiff >= -7) {
              paymentScore = 3; // ชำระช้า 4-7 วัน → 3 คะแนน
            } else if (daysDiff >= -14) {
              paymentScore = 2; // ชำระช้า 8-14 วัน → 2 คะแนน
            } else {
              paymentScore = 1; // ชำระช้ามากกว่า 14 วัน → 1 คะแนน
            }

            // อัปเดตคะแนนในข้อมูลผู้เช่า (เก็บไว้ใน payment_scores array)
            const existingScores = tenant.payment_scores || [];
            const newScores = [...existingScores, {
              payment_id: updatedPayment.id,
              score: paymentScore,
              payment_date: updatedPayment.payment_date,
              due_date: updatedPayment.due_date,
              days_diff: daysDiff
            }];

            // คำนวณคะแนนเฉลี่ย
            const avgScore = newScores.reduce((sum, s) => sum + s.score, 0) / newScores.length;

            await base44.entities.Tenant.update(tenant.id, {
              payment_scores: newScores,
              avg_payment_score: Math.round(avgScore * 10) / 10 // เก็บทศนิยม 1 ตำแหน่ง
            });

            console.log(`✅ ให้คะแนนชำระเงิน: ${paymentScore}/10 (ชำระ ${daysDiff >= 0 ? 'ก่อน' : 'หลัง'}กำหนด ${Math.abs(daysDiff)} วัน)`);
          } catch (scoreError) {
            console.error('Error calculating payment score:', scoreError);
          }
        }

        // ส่งใบเสร็จอัตโนมัติทันทีหลังยืนยันชำระ
        if (tenant?.line_user_id && canSendReceipt) {
          try {
            toast.info('กำลังส่งใบเสร็จทาง LINE...', { duration: 2000 });
            const response = await base44.functions.invoke('sendReceipt', {
              paymentId: updatedPayment.id
            });
            
            if (response.data?.success) {
              toast.success(`✅ ส่งใบเสร็จทาง LINE สำเร็จ\nส่งถึง: ${tenant.full_name}`, { duration: 5000 });
            } else {
              toast.warning(`ยืนยันชำระสำเร็จ แต่ไม่สามารถส่งใบเสร็จได้: ${response.data?.error || 'ไม่ทราบสาเหตุ'}`, { duration: 5000 });
            }
          } catch (error) {
            console.error('Auto-send receipt error:', error);
            toast.warning('ยืนยันชำระสำเร็จ แต่ไม่สามารถส่งใบเสร็จอัตโนมัติได้', { duration: 5000 });
          }
        } else if (!tenant?.line_user_id) {
          toast.success('ยืนยันชำระสำเร็จ (ผู้เช่ายังไม่ได้เชื่อมต่อ LINE)', { duration: 3000 });
        } else {
          toast.success('อัปเดตสถานะสำเร็จ', { duration: 3000 });
        }
      } else {
        toast.success('อัปเดตสถานะสำเร็จ');
      }
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
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

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.room_id) {
      toast.error('กรุณาเลือกห้อง');
      return;
    }

    if (!formData.due_date) {
      toast.error('กรุณาระบุวันครบกำหนดชำระ');
      return;
    }

    const total =
      (parseFloat(formData.rent_amount) || 0) +
      (parseFloat(formData.water_amount) || 0) +
      (parseFloat(formData.electricity_amount) || 0) +
      (parseFloat(formData.internet_amount) || 0) +
      (parseFloat(formData.common_fee_amount) || 0) +
      (parseFloat(formData.parking_fee_amount) || 0) +
      (parseFloat(formData.other_amount) || 0);

    if (total <= 0) {
      toast.error('ยอดรวมต้องมากกว่า 0 บาท');
      return;
    }

    const data = {
      booking_id: formData.booking_id || '',
      tenant_id: formData.tenant_id || '',
      room_id: formData.room_id,
      meter_reading_id: formData.meter_reading_id || '',
      payment_date: formData.payment_date || '',
      due_date: formData.due_date,
      rent_amount: parseFloat(formData.rent_amount || 0),
      water_units: parseFloat(formData.water_units || 0),
      water_rate: parseFloat(formData.water_rate || 0),
      water_amount: parseFloat(formData.water_amount || 0),
      electricity_units: parseFloat(formData.electricity_units || 0),
      electricity_rate: parseFloat(formData.electricity_rate || 0),
      electricity_amount: parseFloat(formData.electricity_amount || 0),
      internet_amount: parseFloat(formData.internet_amount || 0),
      common_fee_amount: parseFloat(formData.common_fee_amount || 0),
      parking_fee_amount: parseFloat(formData.parking_fee_amount || 0),
      other_amount: parseFloat(formData.other_amount || 0),
      total_amount: total,
      payment_method: formData.payment_method,
      payment_slip_url: formData.payment_slip_url || '',
      notes: formData.notes || '',
      status: formData.payment_date ? 'paid' : 'pending'
    };

    console.log('Submitting payment data:', data);

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
      booking_id: payment.booking_id || '',
      tenant_id: payment.tenant_id || '',
      room_id: payment.room_id || '',
      meter_reading_id: payment.meter_reading_id || '',
      payment_date: payment.payment_date || '',
      due_date: payment.due_date || '',
      rent_amount: payment.rent_amount || 0,
      water_units: payment.water_units || 0,
      water_rate: payment.water_rate || 0,
      water_amount: payment.water_amount || 0,
      electricity_units: payment.electricity_units || 0,
      electricity_rate: payment.electricity_rate || 0,
      electricity_amount: payment.electricity_amount || 0,
      internet_amount: payment.internet_amount || 0,
      common_fee_amount: payment.common_fee_amount || 0,
      parking_fee_amount: payment.parking_fee_amount || 0,
      other_amount: payment.other_amount || 0,
      payment_method: payment.payment_method || 'cash',
      payment_slip_url: payment.payment_slip_url || '',
      notes: payment.notes || ''
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingPayment(null);
    setFormData({
      booking_id: '',
      tenant_id: '',
      room_id: '',
      meter_reading_id: '',
      payment_date: '',
      due_date: '',
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
  };

  const handleSendReminder = async (paymentId = null) => {
    if (!canSendReminder) {
      toast.error('คุณไม่มีสิทธิ์ส่งข้อความแจ้งเตือน');
      return;
    }

    // ⭐ ถ้าไม่ระบุ paymentId = ต้องยืนยันก่อนส่งทุกห้อง
    if (!paymentId) {
      const confirmed = confirm(`ต้องการส่งบิลไปยังทุกห้องที่มี LINE และยังไม่ได้ส่ง (${tenantsWithLine} ห้อง)?`);
      if (!confirmed) return;
    }

    if (paymentId) {
      setSendingReminder(paymentId);
    } else {
      setSendingAll(true);
    }

    try {
      const response = await base44.functions.invoke('sendPaymentReminder', {
        paymentId: paymentId,
        branch_id: selectedBranchId
      });

      if (response.data.success) {
        // ⭐ เช็คว่าส่งสำเร็จกี่คน ไม่ส่งกี่คน
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
        
        // ⭐ รีเฟรชข้อมูลทันทีหลังส่งบิลสำเร็จ เพื่อให้จุดแดง/สถานะอัพเดท
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
  };

  const handleSendReceipt = async (paymentId) => {
    if (!canSendReceipt) {
      toast.error('คุณไม่มีสิทธิ์ส่งใบเสร็จ');
      return;
    }

    setSendingReceipt(paymentId);
    try {
      const response = await base44.functions.invoke('sendReceipt', {
        paymentId: paymentId
      });

      if (response.data && response.data.success) {
        toast.success(response.data.message || 'ส่งใบเสร็จทาง LINE สำเร็จ');
        // ⭐ รีเฟรชข้อมูลทันทีหลังส่งใบเสร็จสำเร็จ
        queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] });
      } else {
        const errorMsg = response.data?.message || response.data?.error || 'ส่งใบเสร็จไม่สำเร็จ';
        toast.error(errorMsg, { duration: 7000 });
      }
    } catch (error) {
      console.error('Send receipt error:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งใบเสร็จ');
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

  const getStatusBadge = (effectiveStatus) => {
    const configs = {
      paid: { label: 'ชำระแล้ว', className: 'bg-green-100 text-green-700' },
      pending: { label: 'รอชำระ', className: 'bg-yellow-100 text-yellow-700' },
      overdue: { label: 'เกินกำหนด', className: 'bg-red-100 text-red-700' },
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
      const paymentsData = payments.map(p => {
        const room = getRoomInfo(p.room_id);
        const tenant = getTenantInfo(p.tenant_id);
        const effectiveStatus = getEffectiveStatus(p);
        return {
          id: p.id,
          room_number: room?.room_number,
          tenant_name: tenant?.full_name,
          tenant_phone: tenant?.phone,
          due_date: p.due_date,
          payment_date: p.payment_date,
          total_amount: p.total_amount,
          status: effectiveStatus,
          notes: p.notes
        };
      });

      const roomsData = rooms.map(r => ({
        id: r.id,
        room_number: r.room_number,
        floor: r.floor,
        status: r.status,
        price: r.price
      }));

      const bookingsData = bookings.filter(b => b.status === 'active').map(b => {
        const tenant = tenants.find(t => t.id === b.tenant_id);
        const room = rooms.find(r => r.id === b.room_id);
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

      const prompt = `คุณเป็นผู้ช่วยอัจฉริยะระบบจัดการการชำระเงินหอพัก วิเคราะห์คำถามและระบุ action ที่ต้องการ

วันที่ปัจจุบัน: ${format(new Date(), 'yyyy-MM-dd')}
คำถาม: "${searchQuery}"

ข้อมูลการชำระเงิน (${paymentsData.length} รายการ):
${JSON.stringify(paymentsData, null, 2)}

ข้อมูลห้องพัก (${roomsData.length} ห้อง):
${JSON.stringify(roomsData, null, 2)}

ข้อมูลการจองที่ใช้งานอยู่ (${bookingsData.length} รายการ):
${JSON.stringify(bookingsData, null, 2)}

การตั้งค่าค่าใช้จ่าย:
- ค่าน้ำ: ${waterRateConfig?.value || 18} บาท/หน่วย
- ค่าไฟ: ${electricityRateConfig?.value || 7} บาท/หน่วย
- อินเทอร์เน็ต: ${internetRateConfig?.value || 200} บาท
- ค่าส่วนกลาง: ${commonFeeConfig?.value || 0} บาท

การระบุ Action:
1. ถ้าเป็นการค้นหา/ดูข้อมูล/ถามคำถาม → action_type = "view"
2. ถ้าเป็นการสร้างบิล/ทำบิล/เพิ่มบิล → action_type = "create" (ต้องมี data)
3. ถ้าเป็นการลบ/ยกเลิกบิล → action_type = "delete" (ต้องมี data ระบุ id ของรายการที่จะลบ)

**คำสั่งที่ถือว่าเป็นการสร้างบิล:**
- "สร้างบิลห้อง xxx"
- "ทำบิลห้อง xxx"  
- "เพิ่มบิลห้อง xxx"
- "ออกบิลห้อง xxx"
- "สร้างใบแจ้งหนี้ห้อง xxx"
- "บิลห้อง xxx ค่าเช่า xxx"

**คำสั่งที่ถือว่าเป็นการลบบิล:**
- "ลบบิลห้อง xxx"
- "ยกเลิกบิลห้อง xxx"
- "ลบรายการล่าสุดของห้อง xxx"

**กรณีขอ "ลบทั้งหมด" หรือ "ล้างข้อมูล":**
- ห้าม action_type = "delete" เด็ดขาด (อันตราย)
- ให้ action_type = "view"
- ตอบกลับว่า "ไม่สามารถลบข้อมูลทั้งหมดพร้อมกันได้เพื่อความปลอดภัย กรุณาระบุห้องที่ต้องการลบ หรือลบทีละรายการ"

**เมื่อ action_type = "create" ต้อง:**
1. หา room_id จาก room_number ที่ระบุ
2. หา booking_id จาก bookings ที่ status=active และตรงกับ room_id
3. หา tenant_id จาก booking นั้น
4. กำหนด due_date เป็นวันที่ 5 ของเดือนถัดไป
5. ใช้ rent_amount จาก room.price
6. คำนวณ water_amount = water_units × water_rate
7. คำนวณ electricity_amount = electricity_units × electricity_rate

**เมื่อ action_type = "delete" ต้อง:**
1. หา payment_id ที่ตรงกับเงื่อนไข (เช่น ห้อง xxx, เดือน xxx)
2. ระบุ id ใน data

**ตัวอย่าง JSON response สำหรับ create:**
{
  "answer": "เตรียมข้อมูลบิลห้อง 101 กรุณาตรวจสอบและยืนยัน",
  "action_type": "create",
  "data": {
    "room_id": "xxx-actual-room-id-xxx",
    "booking_id": "xxx-actual-booking-id-xxx",
    "tenant_id": "xxx-actual-tenant-id-xxx",
    "due_date": "2025-12-05",
    "rent_amount": 3000,
    "water_units": 5,
    "water_rate": 18,
    "water_amount": 90,
    "electricity_units": 50,
    "electricity_rate": 7,
    "electricity_amount": 350,
    "internet_amount": 200,
    "common_fee_amount": 0,
    "parking_fee_amount": 0,
    "other_amount": 0
  }
}

**สำคัญมาก:** 
- ต้องใช้ ID จริงจากข้อมูลที่ให้ไว้ ห้ามใช้ placeholder
- ถ้าหาห้องหรือ booking ไม่เจอ ให้ action_type = "view" และแจ้งว่าไม่พบข้อมูล
- ห้ามตอบว่า "สำเร็จ" หรือ "เรียบร้อย" ให้ตอบว่า "เตรียมข้อมูล...กรุณายืนยัน"

ตอบเป็นภาษาไทย กระชับชัดเจน
`;

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
        // ถ้า action_type = "create" หรือ "delete" ให้แสดง confirmation
        if ((response.action_type === 'create' || response.action_type === 'delete') && response.data) {
          // Map answer to description so it shows in the confirmation box
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
        // Try to find full payment object for better logging
        const paymentToDelete = payments.find(p => p.id === actionData.id) || { id: actionData.id };
        await deleteMutation.mutateAsync(paymentToDelete);
        toast.success('ลบรายการสำเร็จ');
      } else {
        // Create Logic
        let paymentData = { ...actionData };

        // ถ้ามีการอัปโหลดสลิป
        if (slipFile) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: slipFile });
          paymentData.payment_slip_url = file_url;
          paymentData.payment_method = 'transfer';
        }

        paymentData.branch_id = selectedBranchId;
        paymentData.status = paymentData.payment_date ? 'paid' : 'pending';
        
        // คำนวณ total_amount
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

  const handlePaymentClick = (payment) => {
    if (isSelectionMode) {
      togglePaymentSelection(payment.id);
      return;
    }
    setSelectedPayment(payment);
    setShowDetailDialog(true);
  };

  const togglePaymentSelection = (paymentId) => {
    setSelectedPaymentIds(prev =>
      prev.includes(paymentId)
        ? prev.filter(id => id !== paymentId)
        : [...prev, paymentId]
    );
  };

  const toggleSelectAllInPage = () => {
    const pagePaymentIds = paginatedPayments.map(p => p.id);
    const allSelectedOnPage = pagePaymentIds.every(id => selectedPaymentIds.includes(id));

    if (allSelectedOnPage) {
      setSelectedPaymentIds(prev => prev.filter(id => !pagePaymentIds.includes(id)));
    } else {
      setSelectedPaymentIds(prev => [...new Set([...prev, ...pagePaymentIds])]);
    }
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

      const prompt = `คุณเป็นผู้ช่วย AI สำหรับระบบจัดการหอพัก ตอบเป็นภาษาไทยเท่านั้น
        
ผู้ใช้ต้องการดำเนินการกับการชำระเงินที่เลือก ${selectedPaymentIds.length} รายการ
คำสั่งผู้ใช้: "${bulkAIQuery}"
ตัวอย่างการชำระเงินที่เลือก: ${JSON.stringify(selectedPaymentsData)}

กรุณาวิเคราะห์ว่าเป็นการดำเนินการอะไร:
- ถ้าแก้ไขสถานะ: action="update_status" พร้อม new_status ("paid", "pending", "overdue")
- ถ้าส่งแจ้งเตือน/บิลทาง LINE: action="send_line" 
  - พร้อม message_type: "reminder" (แจ้งเตือนชำระ) หรือ "receipt" (ใบเสร็จ)
- ถ้าลบ: action="delete"
- ถ้าไม่เข้าใจ: action="none"

สำคัญ: description และ confirmation_message ต้องเป็นภาษาไทย

Return JSON.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["update_status", "send_line", "delete", "none"] },
            new_status: { type: "string", enum: ["paid", "pending", "overdue"] },
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

  const executeBulkAction = async () => {
    if (!bulkAIResult) return;
    
    setIsBulkExecuting(true);
    try {
      if (bulkAIResult.action === 'update_status') {
        const chunkSize = 10;
        for (let i = 0; i < selectedPaymentIds.length; i += chunkSize) {
          const chunk = selectedPaymentIds.slice(i, i + chunkSize);
          const promises = chunk.map(id => 
            base44.entities.Payment.update(id, { status: bulkAIResult.new_status })
          );
          await Promise.all(promises);
        }
        
        queryClient.invalidateQueries(['payments', selectedBranchId]);
        setSelectedPaymentIds([]);
        setBulkAIResult(null);
        setBulkAIQuery('');
        toast.success(`อัปเดตสถานะเป็น ${bulkAIResult.new_status} สำเร็จ ${selectedPaymentIds.length} รายการ`);
        
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
        
        queryClient.invalidateQueries(['payments', selectedBranchId]);
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

  if (paymentsLoading || isDataFetching) {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-600 text-lg">กำลังโหลดข้อมูลการชำระเงิน...</p>
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
        title="การชำระเงิน"
        subtitle={`สาขา ${selectedBranchName}`}
        icon={CreditCard}
        actions={
          <>
            {canAdd && (
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
          </>
        }
      />

      <div className="px-4 md:px-8 py-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
            <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                    <label className="text-xs font-semibold text-slate-700">ช่วงเวลา</label>
                    <Select value={dateRangeType} onValueChange={setDateRangeType}>
                      <SelectTrigger className="w-full text-xs bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl">
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
                  </div>
                  
                  <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                    <label className="text-xs font-semibold text-slate-700">สถานะ</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full text-xs bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        <SelectItem value="pending">รอชำระ</SelectItem>
                        <SelectItem value="overdue">เกินกำหนด</SelectItem>
                        <SelectItem value="paid">ชำระแล้ว</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  


                  <div className="flex flex-col gap-1 flex-1 min-w-[120px]">
                    <label className="text-xs font-semibold text-slate-700">เรียงตาม</label>
                    <Select value={sortBy} onValueChange={setSortBy}>
                      <SelectTrigger className="w-full text-xs bg-white/90 backdrop-blur-xl shadow-md border-white/60 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="due_date">วันครบกำหนด</SelectItem>
                        <SelectItem value="room">หมายเลขห้อง</SelectItem>
                        <SelectItem value="created_date">วันที่สร้าง</SelectItem>
                        <SelectItem value="amount">ยอดเงิน</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                </div>

                <div className="flex flex-wrap items-center gap-2">
                {dateRangeType === 'custom' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 border-green-300 text-green-700 hover:bg-green-50 rounded-xl"
                      >
                        <CalendarIcon className="w-4 h-4" />
                        {format(customRange.from, 'd MMM', { locale: th })} - {format(customRange.to, 'd MMM', { locale: th })}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <CalendarComponent
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
              </div>

              <AISearchBox
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onAISearch={handleAISearch}
                onStopSearch={handleStopAISearch}
                aiSearching={aiSearching}
                placeholder="ค้นหาการชำระเงิน หรือถามเช่น 'สร้างบิลห้อง 101' 'รายการค้างชำระ'"
              />

              {aiAction && (
                <AIActionConfirmation
                  action={aiAction}
                  onConfirm={handleAIActionConfirm}
                  onCancel={handleAIActionCancel}
                  isLoading={aiActionLoading}
                  allowSlipUpload={true}
                />
              )}

              {aiResult && !aiAction && (
                <AIResultCard aiResult={aiResult}>
                  {aiResult.payments && aiResult.payments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-semibold text-purple-800">รายการที่เกี่ยวข้อง ({aiResult.payments.length} รายการ):</p>
                      {aiResult.payments.map((item, idx) => {
                        const payment = payments.find(p => p.id === item.payment_id);
                        if (!payment) return null;
                        
                        const room = getRoomInfo(payment.room_id);
                        const tenant = getTenantInfo(payment.tenant_id);
                        const effectiveStatus = getEffectiveStatus(payment);
                        const lateFee = calculateLateFee(payment);
                        const totalWithLateFee = (payment.total_amount || 0) + lateFee;
                        
                        return (
                          <div 
                            key={idx} 
                            className="bg-white/70 rounded-lg p-3 border border-purple-200 hover:shadow-md transition-all cursor-pointer hover:border-purple-300"
                            onClick={() => handlePaymentClick(payment)}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                  <DoorOpen className="w-4 h-4 text-purple-600" />
                                  <span className="font-semibold text-slate-800">
                                    ห้อง {room?.room_number || 'N/A'}
                                  </span>
                                  {effectiveStatus === 'paid' && <Badge className="bg-green-100 text-green-700 text-xs">ชำระแล้ว</Badge>}
                                  {effectiveStatus === 'pending' && <Badge className="bg-yellow-100 text-yellow-700 text-xs">รอชำระ</Badge>}
                                  {effectiveStatus === 'overdue' && <Badge className="bg-red-100 text-red-700 text-xs">เกินกำหนด</Badge>}
                                </div>
                                <p className="text-sm text-slate-600 mb-2">{item.reason || `ผู้เช่า: ${tenant?.full_name || 'N/A'}`}</p>
                                <div className="text-xs text-slate-500 space-y-0.5">
                                  <p className="font-semibold text-blue-700">ยอดเงิน: ฿{totalWithLateFee.toLocaleString()}</p>
                                  {payment.due_date && (
                                    <p>ครบกำหนด: {format(parseISO(payment.due_date), 'd MMM yyyy', { locale: th })}</p>
                                  )}
                                  {payment.payment_date && (
                                    <p>วันที่ชำระ: {format(parseISO(payment.payment_date), 'd MMM yyyy', { locale: th })}</p>
                                  )}
                                </div>
                                
                                {/* ปุ่มดูรายละเอียด */}
                                <div className="flex gap-2 mt-2">
                                  {effectiveStatus !== 'paid' && canViewInvoice && (
                                    <Link to={`${createPageUrl('Invoice')}?paymentId=${payment.id}`} onClick={(e) => e.stopPropagation()}>
                                      <Button size="sm" variant="outline" className="text-xs border-blue-600 text-blue-600 hover:bg-blue-50">
                                        <FileText className="w-3 h-3 mr-1" />
                                        ใบแจ้งหนี้
                                      </Button>
                                    </Link>
                                  )}
                                  {effectiveStatus === 'paid' && canViewReceipt && (
                                    <Link to={`${createPageUrl('Receipt')}?paymentId=${payment.id}`} onClick={(e) => e.stopPropagation()}>
                                      <Button size="sm" className="text-xs bg-green-600 hover:bg-green-700">
                                        <Receipt className="w-3 h-3 mr-1" />
                                        ใบเสร็จ
                                      </Button>
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </AIResultCard>
              )}
            </CardContent>
          </Card>

          {/* แจ้งเตือนสลิปที่รอตรวจสอบ */}
          {(() => {
            const needReviewPayments = payments.filter(p => 
              p.notes?.includes('⚠️ รอตรวจสอบ') && 
              p.status !== 'paid' &&
              !p.notes?.includes('✅ ยืนยันชำระแล้ว')
            );
            if (needReviewPayments.length === 0) return null;

            return (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 shadow-lg">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="bg-amber-100 p-2 rounded-lg">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-amber-900 mb-2">
                          🔍 รอตรวจสอบสลิป ({needReviewPayments.length} รายการ)
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                          {needReviewPayments.map(p => {
                            const room = rooms.find(r => r.id === p.room_id);
                            const tenant = tenants.find(t => t.id === p.tenant_id);
                            const notesParts = p.notes?.split('⚠️ รอตรวจสอบ:')[1]?.trim() || '';
                            const roomMatch = notesParts.match(/ห้อง\s+(\S+)/);
                            const roomNumber = roomMatch ? roomMatch[1] : (room?.room_number || 'N/A');
                            const reason = notesParts.replace(/^ห้อง\s+\S+\s*-?\s*/, '').split('\n')[0]?.trim() || 'ตรวจสอบไม่ผ่าน';
                            
                            return (
                              <div
                                key={p.id}
                                className="p-3 bg-white rounded-lg border border-amber-200 shadow-sm"
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-bold text-amber-900 text-sm">
                                    ห้อง {roomNumber}
                                  </span>
                                  <Badge className="bg-amber-200 text-amber-800 text-xs">
                                    {(p.total_amount || 0).toLocaleString()}฿
                                  </Badge>
                                </div>
                                <p className="text-xs text-amber-800 mb-0.5">{tenant?.full_name || 'N/A'}</p>
                                <p className="text-xs text-amber-700 mb-2">{reason}</p>
                                {p.payment_slip_url && (
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSlipPreview({ open: true, url: p.payment_slip_url, title: `สลิป ห้อง ${roomNumber}` });
                                    }}
                                    className="w-full cursor-pointer"
                                  >
                                    <img src={p.payment_slip_url} alt="สลิป" className="w-full max-h-24 object-contain rounded border border-amber-200 bg-slate-50 mb-2 hover:opacity-80 transition-opacity" />
                                  </button>
                                )}
                                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    type="button"
                                    className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                                    onClick={(e) => {
                                      console.log('🔘🔘🔘 BUTTON CLICKED - Review Banner');
                                      e.stopPropagation();
                                      e.preventDefault();
                                      console.log('Event propagation stopped');
                                      console.log('State check:', { 
                                        paymentId: p.id, 
                                        canConfirmPaid, 
                                        isPending: updateStatusMutation.isPending,
                                        userRole,
                                        userPermissions 
                                      });
                                      const confirmed = confirm(`ยืนยันชำระเงิน ${(p.total_amount || 0).toLocaleString()} บาท?`);
                                      console.log('Confirm dialog result:', confirmed);
                                      if (confirmed) {
                                        console.log('✅ Calling updateStatusMutation.mutate NOW');
                                        const mutationData = { id: p.id, status: 'paid', payment_date: getTodayDateString() };
                                        console.log('Mutation data:', mutationData);
                                        updateStatusMutation.mutate(mutationData);
                                        console.log('Mutate function called');
                                      } else {
                                        console.log('❌ User cancelled confirmation');
                                      }
                                    }}
                                    disabled={updateStatusMutation.isPending}
                                  >
                                    {updateStatusMutation.isPending ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                    <span>ยืนยันชำระ</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-md text-xs font-medium transition-colors"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      console.log('🔘 Review Banner: Details clicked', { paymentId: p.id });
                                      setSelectedPayment(p);
                                      setShowDetailDialog(true);
                                    }}
                                  >
                                    ดูรายละเอียด
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })()}

          {/* ปุ่มจัดการบิล + เลือกหลายรายการ */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white/60 backdrop-blur-xl border border-white/50 shadow-lg rounded-xl px-4 py-3">
            <Button
              variant={isSelectionMode ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => {
                setIsSelectionMode(!isSelectionMode);
                if (isSelectionMode) setSelectedPaymentIds([]);
              }}
              className="shadow-sm"
            >
              {isSelectionMode ? <><X className="w-4 h-4 mr-2" /> ยกเลิก</> : <><CheckSquare className="w-4 h-4 mr-2" /> เลือกหลายรายการ</>}
            </Button>

            <div className="flex items-center gap-2">
              {canAdd && (
                <GenerateMonthlyBillsButton branchId={selectedBranchId} onSuccess={() => queryClient.invalidateQueries({ queryKey: ['payments', selectedBranchId] })} compact />
              )}
              {canSendReminder && (
                <Button
                  onClick={() => handleSendReminder()}
                  disabled={sendingAll || tenantsWithLine === 0}
                  size="sm"
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50 whitespace-nowrap"
                >
                  {sendingAll ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      กำลังส่ง...
                    </>
                  ) : (
                    <>
                      <Send className="w-3 h-3 mr-1" />
                      ส่งบิลทุกห้อง {tenantsWithLine > 0 && `(${tenantsWithLine})`}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
              onClick={() => setStatusFilter('all')}
              className="cursor-pointer"
            >
              <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400 to-indigo-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">ยอดรวมทั้งหมด</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {totalAmounts.all.toLocaleString('th-TH')}
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">บาท ({statusCounts.all} รายการ)</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
              className="cursor-pointer"
            >
              <Card className={`relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 ${statusFilter === 'pending' ? 'ring-2 ring-yellow-500' : ''}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 shadow-lg">
                        <Clock className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">รอชำระ</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {totalAmounts.pending.toLocaleString('th-TH')}
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">บาท ({statusCounts.pending} รายการ)</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
              className="cursor-pointer"
            >
              <Card className={`relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 ${statusFilter === 'overdue' ? 'ring-2 ring-red-500' : ''}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-400 to-red-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                        <XCircle className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">เกินกำหนด</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {totalAmounts.overdue.toLocaleString('th-TH')}
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">บาท ({statusCounts.overdue} รายการ)</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')}
              className="cursor-pointer"
            >
              <Card className={`relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 ${statusFilter === 'paid' ? 'ring-2 ring-green-500' : ''}`}>
                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                        <CheckCircle2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1">ชำระแล้ว</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {totalAmounts.paid.toLocaleString('th-TH')}
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">บาท ({statusCounts.paid} รายการ)</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          <div className="flex items-center justify-between gap-4">
            {canSendReminder && (
              <p className="text-xs text-slate-500">
                บิลรอบนี้: {(() => {
                  const now = new Date();
                  const currentDay = now.getDate();
                  let cycleStart, cycleEnd;
                  
                  if (currentDay >= 20) {
                    cycleStart = new Date(now.getFullYear(), now.getMonth(), 20);
                    cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 20);
                  } else {
                    cycleStart = new Date(now.getFullYear(), now.getMonth() - 1, 20);
                    cycleEnd = new Date(now.getFullYear(), now.getMonth(), 20);
                  }
                  
                  const occupiedRooms = rooms.filter(r => r.status === 'occupied').length;
                  const billsThisCycle = payments.filter(p => {
                    if (!p.due_date) return false;
                    try {
                      const dueDate = parseISO(p.due_date);
                      return dueDate >= cycleStart && dueDate < cycleEnd;
                    } catch { return false; }
                  }).length;
                  return `${billsThisCycle}/${occupiedRooms}`;
                })()}
              </p>
            )}
            
            <div className="flex items-center gap-1 bg-white/90 backdrop-blur-xl shadow-md border border-white/60 rounded-xl p-1">
              <Button
                variant={viewMode === 'room' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('room')}
                className={`h-8 px-3 ${viewMode === 'room' ? 'bg-blue-600 text-white' : ''}`}
              >
                <DoorOpen className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'card' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('card')}
                className={`h-8 px-3 ${viewMode === 'card' ? 'bg-blue-600 text-white' : ''}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('table')}
                className={`h-8 px-3 ${viewMode === 'table' ? 'bg-blue-600 text-white' : ''}`}
              >
                <TableIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {paginatedPayments.length === 0 ? (
            <div className="text-center p-8 bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl rounded-xl">
              <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <p className="text-xl font-semibold text-slate-800">ไม่พบรายการชำระเงิน</p>
              <p className="text-slate-600">ลองเปลี่ยนช่วงเวลาหรือสถานะการค้นหา</p>
            </div>
          ) : (
            <>
              {viewMode === 'card' && (
                <div className="grid grid-cols-1 gap-4">
                  <AnimatePresence>
                    {paginatedPayments.map((payment) => {
                      const room = getRoomInfo(payment.room_id);
                      const tenant = getTenantInfo(payment.tenant_id);
                      const effectiveStatus = getEffectiveStatus(payment);
                      const lateFee = calculateLateFee(payment);
                      const totalWithLateFee = (payment.total_amount || 0) + lateFee;
                      const canSendReminderForPayment = canSendReminder && (effectiveStatus === 'pending' || effectiveStatus === 'overdue') && tenant && tenant.line_user_id;
                      const canSendReceiptForPayment = canSendReceipt && effectiveStatus === 'paid' && tenant && tenant.line_user_id;
                      const hasNoLine = !tenant || !tenant.line_user_id;
                      const isPaid = effectiveStatus === 'paid';
                      const hasSlip = payment.payment_slip_url && payment.payment_slip_url.trim() !== '';
                      const isExpanded = expandedPayments.has(payment.id);
                      const needsManualReview = payment.notes?.includes('⚠️ รอตรวจสอบ');
                      const isSelected = selectedPaymentIds.includes(payment.id);

                      return (
                        <motion.div key={payment.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="relative">
                          {isSelectionMode && (
                            <div
                              className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white'
                                  : 'bg-white/90 border-slate-300 hover:border-blue-400'
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                togglePaymentSelection(payment.id);
                              }}
                            >
                              {isSelected && <Check className="w-4 h-4" />}
                            </div>
                          )}
                          <div className={isSelectionMode && isSelected ? 'ring-2 ring-blue-500 rounded-2xl' : ''}>
                            <Card 
                              className={`bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all cursor-pointer ${effectiveStatus === 'overdue' ? 'border-red-300 bg-red-50/50' : ''} ${needsManualReview ? 'border-amber-300 bg-amber-50/30' : ''}`}
                              onClick={() => handlePaymentClick(payment)}
                            >
                            <CardContent className="p-4 md:p-6">
                              <div className="flex items-start gap-3 mb-3">
                                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                                  <Receipt className="w-5 h-5 md:w-6 md:h-6 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                                    <DoorOpen className="w-4 h-4 md:w-5 md:h-5 text-blue-600 flex-shrink-0" />
                                    <h3 className="text-base md:text-xl font-bold text-slate-800">
                                      ห้อง {room?.room_number || 'N/A'}
                                    </h3>
                                    {getStatusBadge(effectiveStatus)}
                                    {payment.bill_sent_date && effectiveStatus !== 'paid' && (
                                      <Badge className="bg-purple-100 text-purple-700 text-xs" title={`ส่งบิลแล้วเมื่อ ${format(parseISO(payment.bill_sent_date), 'd MMM HH:mm', { locale: th })}`}>
                                        📤 ส่งบิลแล้ว
                                      </Badge>
                                    )}
                                    {payment.receipt_sent_date && effectiveStatus === 'paid' && (
                                      <Badge className="bg-blue-100 text-blue-700 text-xs" title={`ส่งใบเสร็จแล้วเมื่อ ${format(parseISO(payment.receipt_sent_date), 'd MMM HH:mm', { locale: th })}`}>
                                        📄 ส่งใบเสร็จแล้ว
                                      </Badge>
                                    )}
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
                                          console.log('🔘 Card View: Confirm clicked', { paymentId: payment.id, canConfirmPaid });
                                          const confirmed = confirm(`ยืนยันชำระเงิน ${payment.total_amount?.toLocaleString()} บาท?`);
                                          console.log('Confirm dialog result:', confirmed);
                                          if (confirmed) {
                                            console.log('✅ Executing mutation');
                                            updateStatusMutation.mutate({ id: payment.id, status: 'paid', payment_date: getTodayDateString() });
                                          }
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
                                          setSelectedPayment(payment);
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
                                            return `(เกิน ${Math.abs(differenceInDays(date, getCurrentDate()))} วัน)`;
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
                                      {payment.rent_amount > 0 && (
                                        <div className="flex justify-between">
                                          <span className="text-slate-600">ค่าเช่า:</span>
                                          <span className="font-medium">{payment.rent_amount.toLocaleString()} ฿</span>
                                        </div>
                                      )}
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
                                      {lateFee > 0 && (
                                        <div className="flex justify-between text-red-600 font-semibold">
                                          <span>ค่าปรับจ่ายล่าช้า:</span>
                                          <span>+{lateFee.toLocaleString()} ฿</span>
                                        </div>
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>

                              <div className="flex justify-between items-center pt-3 border-t">
                                <span className="text-base md:text-lg font-semibold text-slate-800">รวม:</span>
                                <span className={`text-xl md:text-2xl font-bold ${lateFee > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                  {totalWithLateFee.toLocaleString()} ฿
                                </span>
                              </div>

                              <div className="flex flex-wrap gap-2 mt-4">
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

                                {!isPaid && canViewInvoice && (
                                  <Link to={`${createPageUrl('Invoice')}?paymentId=${payment.id}`} className="flex-shrink-0">
                                    <Button size="sm" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                                      <FileText className="w-4 h-4 mr-1" />
                                      ใบแจ้งหนี้
                                    </Button>
                                  </Link>
                                )}

                                {isPaid && canViewReceipt && (
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
                                    title={payment.receipt_sent_date ? `ส่งแล้วเมื่อ ${format(parseISO(payment.receipt_sent_date), 'd MMM HH:mm', { locale: th })}` : 'ส่งใบเสร็จ'}
                                  >
                                    {sendingReceipt === payment.id ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <>
                                        <Send className="w-4 h-4 mr-1" />
                                        {payment.receipt_sent_date ? 'ส่งซ้ำ' : 'ส่งใบเสร็จ'}
                                      </>
                                    )}
                                  </Button>
                                )}

                                {canSendReminderForPayment && (
                                  <Button 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSendReminder(payment.id);
                                    }} 
                                    disabled={sendingReminder === payment.id} 
                                    className={`flex-shrink-0 ${payment.bill_sent_date ? 'bg-slate-500 hover:bg-slate-600' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'}`}
                                    title={payment.bill_sent_date ? `ส่งแล้วเมื่อ ${format(parseISO(payment.bill_sent_date), 'd MMM HH:mm', { locale: th })}` : 'ส่งแจ้งเตือน'}
                                  >
                                    {sendingReminder === payment.id ? (
                                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <>
                                        <Send className="w-4 h-4 mr-1" />
                                        {payment.bill_sent_date ? 'ส่งซ้ำ' : 'แจ้งเตือน'}
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
                                      updateStatusMutation.mutate({ id: payment.id, status: 'paid', payment_date: getTodayDateString() }); 
                                    }} 
                                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 flex-shrink-0"
                                  >
                                    <CheckCircle2 className="w-4 h-4 mr-1" />
                                    ยืนยันชำระ
                                  </Button>
                                )}
                              </div>

                              {hasNoLine && (effectiveStatus === 'pending' || effectiveStatus === 'overdue') && canSendReminder && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-700 flex items-start gap-2 mt-3">
                                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                  <span>ผู้เช่ายังไม่ได้เชื่อมต่อ LINE</span>
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
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50">
                          <tr>
                            {isSelectionMode && (
                              <th className="px-4 py-3 text-center w-12">
                                <div
                                  className={`w-5 h-5 mx-auto rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                                    paginatedPayments.every(p => selectedPaymentIds.includes(p.id))
                                      ? 'bg-blue-600 border-blue-600 text-white'
                                      : 'bg-white border-slate-300 hover:border-blue-400'
                                  }`}
                                  onClick={toggleSelectAllInPage}
                                >
                                  {paginatedPayments.every(p => selectedPaymentIds.includes(p.id)) && (
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
                            {(canEdit || canDelete || canViewInvoice || canViewReceipt || canConfirmPaid || canSendReminder || canSendReceipt) && (
                              <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">จัดการ</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedPayments.map((payment) => {
                            const room = getRoomInfo(payment.room_id);
                            const tenant = getTenantInfo(payment.tenant_id);
                            const effectiveStatus = getEffectiveStatus(payment);
                            const lateFee = calculateLateFee(payment);
                            const totalWithLateFee = (payment.total_amount || 0) + lateFee;
                            const isPaid = effectiveStatus === 'paid';
                            const isSelected = selectedPaymentIds.includes(payment.id);

                            return (
                              <tr key={payment.id} className={`border-b hover:bg-slate-50 ${effectiveStatus === 'overdue' ? 'bg-red-50/50' : ''} ${isSelected ? 'bg-blue-50/50' : ''}`}>
                                {isSelectionMode && (
                                  <td className="px-4 py-3 text-center">
                                    <div
                                      className={`w-5 h-5 mx-auto rounded border-2 flex items-center justify-center cursor-pointer transition-all ${
                                        isSelected
                                          ? 'bg-blue-600 border-blue-600 text-white'
                                          : 'bg-white border-slate-300 hover:border-blue-400'
                                      }`}
                                      onClick={() => togglePaymentSelection(payment.id)}
                                    >
                                      {isSelected && <Check className="w-3 h-3" />}
                                    </div>
                                  </td>
                                )}
                                <td className="px-4 py-3 text-sm font-medium text-slate-800">{room?.room_number || 'N/A'}</td>
                                <td className="px-4 py-3 text-sm text-slate-600">{tenant?.full_name || 'N/A'}</td>
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
                                          return `เกิน ${Math.abs(differenceInDays(date, getCurrentDate()))} วัน`;
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
                                <td className={`px-4 py-3 text-sm font-bold text-right ${lateFee > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                  {totalWithLateFee.toLocaleString()}
                                  {lateFee > 0 && (
                                    <span className="block text-xs text-red-600">(+{lateFee} ค่าปรับ)</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-sm">{getStatusBadge(effectiveStatus)}</td>
                                {(canEdit || canDelete || canViewInvoice || canViewReceipt || canConfirmPaid || canSendReminder || canSendReceipt) && (
                                  <td className="px-4 py-3">
                                    <div className="flex justify-center gap-1">
                                      {!isPaid && canViewInvoice && (
                                        <Link to={`${createPageUrl('Invoice')}?paymentId=${payment.id}`}>
                                          <Button variant="ghost" size="icon" className="h-8 w-8" title="ใบแจ้งหนี้"><FileText className="w-4 h-4" /></Button>
                                        </Link>
                                      )}
                                      {isPaid && canViewReceipt && (
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
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => { updateStatusMutation.mutate({ id: payment.id, status: 'paid', payment_date: getTodayDateString() }); }} title="ยืนยันชำระ">
                                          <CheckCircle2 className="w-4 h-4" />
                                        </Button>
                                      )}
                                      {(effectiveStatus === 'pending' || effectiveStatus === 'overdue') && tenant?.line_user_id && canSendReminder && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-purple-600 hover:text-purple-700 hover:bg-purple-50" onClick={() => handleSendReminder(payment.id)} disabled={sendingReminder === payment.id} title="แจ้งเตือน (LINE)">
                                          {sendingReminder === payment.id ? (
                                            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                          ) : (
                                            <Send className="w-4 h-4" />
                                          )}
                                        </Button>
                                      )}
                                      {isPaid && tenant?.line_user_id && canSendReceipt && (
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleSendReceipt(payment.id)} disabled={sendingReceipt === payment.id} title="ส่งใบเสร็จ (LINE)">
                                          {sendingReceipt === payment.id ? (
                                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
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
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                  <CardContent className="p-4 md:p-6">
                    {/* Month Selector */}
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
                          onChange={(e) => setRoomViewMonth(e.target.value)}
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
                      <div className="flex items-center gap-4 text-sm">
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

                    {/* Room Grid by Floor */}
                    {(() => {
                      // Group rooms by floor
                      const roomsByFloor = rooms.reduce((acc, room) => {
                        const floor = room.floor || 1;
                        if (!acc[floor]) acc[floor] = [];
                        acc[floor].push(room);
                        return acc;
                      }, {});

                      // Sort floors
                      const sortedFloors = Object.keys(roomsByFloor).sort((a, b) => Number(a) - Number(b));

                      // Get payments for selected month
                      const monthStart = parseISO(`${roomViewMonth}-01`);
                      const monthEnd = endOfMonth(monthStart);

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
                                // Find payment for this room in selected month
                                const roomPayment = payments.find(p => {
                                  if (p.room_id !== room.id) return false;
                                  if (!p.due_date) return false;
                                  try {
                                    const dueDate = parseISO(p.due_date);
                                    return isWithinInterval(dueDate, { start: monthStart, end: monthEnd });
                                  } catch {
                                    return false;
                                  }
                                });

                                const effectiveStatus = roomPayment ? getEffectiveStatus(roomPayment) : null;
                                const tenant = roomPayment ? getTenantInfo(roomPayment.tenant_id) : null;
                                const isSelected = roomPayment && selectedPaymentIds.includes(roomPayment.id);
                                const hasNotSentBill = roomPayment && !roomPayment.bill_sent_date && effectiveStatus !== 'paid';

                                // Determine background color
                                let bgColor = 'bg-slate-200 hover:bg-slate-300'; // No bill
                                let textColor = 'text-slate-600';
                                let statusLabel = 'ไม่มีบิล';

                                if (isSelected && isSelectionMode) {
                                 bgColor = 'bg-blue-600 hover:bg-blue-700';
                                 textColor = 'text-white';
                                } else if (effectiveStatus === 'paid') {
                                 bgColor = 'bg-green-500 hover:bg-green-600';
                                 textColor = 'text-white';
                                 statusLabel = 'ชำระแล้ว';
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
                                       className={`absolute -top-1 -right-1 z-20 w-4 h-4 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
                                         isSelected
                                           ? 'bg-blue-600 border-white'
                                           : 'bg-white border-slate-300'
                                       }`}
                                       onClick={(e) => {
                                         e.stopPropagation();
                                         togglePaymentSelection(roomPayment.id);
                                       }}
                                     >
                                       {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                     </div>
                                   )}
                                   <Dialog>
                                     <DialogTrigger asChild>
                                       <button
                                         className={`${bgColor} ${textColor} rounded-lg p-2 text-center transition-all shadow-sm hover:shadow-md cursor-pointer w-full relative ${isSelected && isSelectionMode ? 'ring-2 ring-blue-400' : ''}`}
                                         onClick={(e) => {
                                           if (isSelectionMode && roomPayment) {
                                             e.preventDefault();
                                             togglePaymentSelection(roomPayment.id);
                                           }
                                         }}
                                       >
                                         <p className="font-bold text-sm">{room.room_number}</p>
                                         {roomPayment && (
                                           <>
                                             <p className="text-xs opacity-90">
                                               {(roomPayment.total_amount || 0).toLocaleString()}฿
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
                                       {roomPayment ? (
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
                                               const lateFee = calculateLateFee(roomPayment);
                                               return lateFee > 0 ? (
                                                 <div className="flex justify-between text-red-600 font-semibold">
                                                   <span>ค่าปรับ:</span>
                                                   <span>+{lateFee.toLocaleString()} ฿</span>
                                                 </div>
                                               ) : null;
                                             })()}
                                           </div>

                                           <div className="border-t pt-3 flex justify-between items-center">
                                             <span className="font-bold">รวมทั้งสิ้น:</span>
                                             <span className="text-xl font-bold text-blue-600">
                                               {((roomPayment.total_amount || 0) + calculateLateFee(roomPayment)).toLocaleString()} ฿
                                             </span>
                                           </div>

                                           {/* Badges */}
                                           <div className="flex flex-wrap gap-1">
                                             {roomPayment.bill_sent_date && effectiveStatus !== 'paid' && (
                                               <Badge className="bg-purple-100 text-purple-700 text-xs">
                                                 📤 ส่งบิล {format(parseISO(roomPayment.bill_sent_date), 'd MMM HH:mm', { locale: th })}
                                               </Badge>
                                             )}
                                             {roomPayment.receipt_sent_date && effectiveStatus === 'paid' && (
                                               <Badge className="bg-blue-100 text-blue-700 text-xs">
                                                 📄 ส่งใบเสร็จ {format(parseISO(roomPayment.receipt_sent_date), 'd MMM HH:mm', { locale: th })}
                                               </Badge>
                                             )}
                                           </div>

                                           {/* Actions */}
                                           <div className="flex flex-wrap gap-2 pt-3 border-t">
                                             {effectiveStatus !== 'paid' && canViewInvoice && (
                                               <Link to={`${createPageUrl('Invoice')}?paymentId=${roomPayment.id}`} className="flex-1 min-w-[100px]">
                                                 <Button size="sm" variant="outline" className="w-full text-xs">
                                                   <FileText className="w-3 h-3 mr-1" />
                                                   ใบแจ้งหนี้
                                                 </Button>
                                               </Link>
                                             )}
                                             {effectiveStatus === 'paid' && canViewReceipt && (
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
                                                 onClick={() => updateStatusMutation.mutate({ id: roomPayment.id, status: 'paid', payment_date: getTodayDateString() })}
                                               >
                                                 <CheckCircle2 className="w-3 h-3 mr-1" />
                                                 ยืนยันชำระ
                                               </Button>
                                             )}
                                             {effectiveStatus !== 'paid' && tenant?.line_user_id && canSendReminder && (
                                               <Button 
                                                 size="sm" 
                                                 className={`w-full text-xs ${roomPayment.bill_sent_date ? 'bg-slate-500 hover:bg-slate-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                                                 onClick={() => handleSendReminder(roomPayment.id)}
                                                 disabled={sendingReminder === roomPayment.id}
                                               >
                                                 {sendingReminder === roomPayment.id ? (
                                                   <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                                 ) : (
                                                   <Send className="w-3 h-3 mr-1" />
                                                 )}
                                                 {roomPayment.bill_sent_date ? 'ส่งซ้ำ' : 'แจ้งเตือน'}
                                               </Button>
                                             )}
                                             {effectiveStatus === 'paid' && tenant?.line_user_id && canSendReceipt && (
                                               <Button 
                                                 size="sm" 
                                                 className={`w-full text-xs ${roomPayment.receipt_sent_date ? 'bg-slate-500 hover:bg-slate-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                                                 onClick={() => handleSendReceipt(roomPayment.id)}
                                                 disabled={sendingReceipt === roomPayment.id}
                                               >
                                                 {sendingReceipt === roomPayment.id ? (
                                                   <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin mr-1" />
                                                 ) : (
                                                   <Send className="w-3 h-3 mr-1" />
                                                 )}
                                                 {roomPayment.receipt_sent_date ? 'ส่งซ้ำ' : 'ส่งใบเสร็จ'}
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
                                               onClick={() => {
                                                 // เตรียมข้อมูลสำหรับสร้างบิล
                                                 const activeBooking = bookings.find(b => b.room_id === room.id && b.status === 'active');
                                                 if (activeBooking) {
                                                   setEditingPayment(null);
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
                                                   // Auto-calculate after a short delay
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
            </>
          )}

          {totalPages > 1 && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-slate-600">
                    แสดง {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredPayments.length)} จาก {filteredPayments.length} รายการ
                  </p>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      ก่อนหน้า
                    </Button>
                    <div className="flex items-center gap-1">
                      {[...Array(Math.min(5, totalPages))].map((_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }

                        return (
                          <Button key={i} variant={currentPage === pageNum ? "default" : "outline"} size="sm" onClick={() => setCurrentPage(pageNum)} className={currentPage === pageNum ? "bg-blue-600 text-white hover:bg-blue-600" : ""}>
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                      ถัดไป
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Dialog open={showDialog} onOpenChange={(open) => { setShowDialog(open); if (!open) { resetForm(); } }}>
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

                {formData.room_id && !editingPayment && canAutoCalculate && (
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
                    <div>
                      <Label className="flex items-center gap-2"><DoorOpen className="w-4 h-4 text-slate-600" />ค่าเช่า (บาท)</Label>
                      <Input type="number" value={formData.rent_amount} onChange={(e) => setFormData({ ...formData, rent_amount: parseFloat(e.target.value) || 0 })} placeholder="0" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="flex items-center gap-2"><Droplets className="w-4 h-4 text-blue-600" />หน่วยน้ำ</Label>
                        <Input type="number" value={formData.water_units} onChange={(e) => {
                          const units = parseFloat(e.target.value || 0);
                          const rate = parseFloat(formData.water_rate || 0);
                          setFormData({ ...formData, water_units: units, water_amount: parseFloat((units * rate).toFixed(2)) });
                        }} placeholder="0" />
                      </div>
                      <div>
                        <Label>ค่าน้ำ (บาท)</Label>
                        <Input type="number" value={formData.water_amount} onChange={(e) => setFormData({ ...formData, water_amount: parseFloat(e.target.value) || 0 })} placeholder="0" />
                        <p className="text-xs text-slate-500 mt-1">อัตรา: {formData.water_rate} บาท/หน่วย</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-600" />หน่วยไฟ</Label>
                        <Input type="number" value={formData.electricity_units} onChange={(e) => {
                          const units = parseFloat(e.target.value || 0);
                          const rate = parseFloat(formData.electricity_rate || 0);
                          setFormData({ ...formData, electricity_units: units, electricity_amount: parseFloat((units * rate).toFixed(2)) });
                        }} placeholder="0" />
                      </div>
                      <div>
                        <Label>ค่าไฟ (บาท)</Label>
                        <Input type="number" value={formData.electricity_amount} onChange={(e) => setFormData({ ...formData, electricity_amount: parseFloat(e.target.value) || 0 })} placeholder="0" />
                        <p className="text-xs text-slate-500 mt-1">อัตรา: {formData.electricity_rate} บาท/หน่วย</p>
                      </div>
                    </div>

                    <div>
                      <Label className="flex items-center gap-2"><Wifi className="w-4 h-4 text-purple-600" />ค่าอินเทอร์เน็ต (บาท)</Label>
                      <Input type="number" value={formData.internet_amount} onChange={(e) => setFormData({ ...formData, internet_amount: parseFloat(e.target.value) || 0 })} placeholder="0" />
                    </div>

                    <div>
                      <Label className="flex items-center gap-2"><Building2 className="w-4 h-4 text-indigo-600" />ค่าส่วนกลาง (บาท)</Label>
                      <Input type="number" value={formData.common_fee_amount} onChange={(e) => setFormData({ ...formData, common_fee_amount: parseFloat(e.target.value) || 0 })} placeholder="0" />
                    </div>

                    <div>
                      <Label className="flex items-center gap-2"><CreditCard className="w-4 h-4 text-green-600" />ค่าจอดรถ (บาท)</Label>
                      <Input type="number" value={formData.parking_fee_amount} onChange={(e) => setFormData({ ...formData, parking_fee_amount: parseFloat(e.target.value) || 0 })} placeholder="0" />
                    </div>

                    <div>
                      <Label>ค่าใช้จ่ายอื่นๆ (บาท)</Label>
                      <Input type="number" value={formData.other_amount} onChange={(e) => setFormData({ ...formData, other_amount: parseFloat(e.target.value) || 0 })} placeholder="0" />
                    </div>

                    <Card className="bg-slate-50 border-slate-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-semibold text-slate-800">ยอดรวมทั้งสิ้น:</span>
                          <span className="text-2xl font-bold text-blue-600">
                            {(parseFloat(formData.rent_amount || 0) + parseFloat(formData.water_amount || 0) + parseFloat(formData.electricity_amount || 0) + parseFloat(formData.internet_amount || 0) + parseFloat(formData.common_fee_amount || 0) + parseFloat(formData.parking_fee_amount || 0) + parseFloat(formData.other_amount || 0)).toLocaleString()} ฿
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
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>ยกเลิก</Button>
                  <Button 
                    type="submit" 
                    className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
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

      {/* Floating Bulk AI Action Bar */}
      <AnimatePresence>
        {selectedPaymentIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 md:left-[280px] md:right-6 md:w-auto md:max-w-3xl z-50"
          >
            <Card className="bg-white shadow-2xl border-slate-200 overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-blue-100 p-2 rounded-lg">
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">เลือกแล้ว {selectedPaymentIds.length} รายการ</p>
                      <p className="text-xs text-slate-500">จัดการการชำระเงินหลายรายการพร้อมกันด้วย AI</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSelectedPaymentIds([])}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4 mr-1" />
                    ล้างการเลือก
                  </Button>
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
                        
                        {bulkAIResult.action === 'update_status' && bulkAIResult.new_status && (
                          <Badge className="mt-2 bg-blue-100 text-blue-700">
                            สถานะใหม่: {bulkAIResult.new_status}
                          </Badge>
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

      {/* Payment Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รายละเอียดการชำระเงิน</DialogTitle>
          </DialogHeader>
          {selectedPayment && (() => {
            const room = getRoomInfo(selectedPayment.room_id);
            const tenant = getTenantInfo(selectedPayment.tenant_id);
            const effectiveStatus = getEffectiveStatus(selectedPayment);
            const lateFee = calculateLateFee(selectedPayment);
            const totalWithLateFee = (selectedPayment.total_amount || 0) + lateFee;

            return (
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500 mb-1">ห้อง</p>
                      <p className="font-bold text-slate-800">{room?.room_number || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">ผู้เช่า</p>
                      <p className="font-bold text-slate-800">{tenant?.full_name || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">วันครบกำหนด</p>
                      <p className="font-bold text-slate-800">
                        {selectedPayment.due_date ? format(parseISO(selectedPayment.due_date), 'd MMM yyyy', { locale: th }) : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 mb-1">สถานะ</p>
                      {getStatusBadge(effectiveStatus)}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="font-semibold text-slate-800">รายการค่าใช้จ่าย</h3>
                  {selectedPayment.rent_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">ค่าเช่า:</span>
                      <span className="font-medium">{selectedPayment.rent_amount.toLocaleString()} ฿</span>
                    </div>
                  )}
                  {selectedPayment.electricity_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">ค่าไฟ ({selectedPayment.electricity_units} หน่วย @ {selectedPayment.electricity_rate} ฿):</span>
                      <span className="font-medium">{selectedPayment.electricity_amount.toLocaleString()} ฿</span>
                    </div>
                  )}
                  {selectedPayment.water_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">ค่าน้ำ ({selectedPayment.water_units} หน่วย @ {selectedPayment.water_rate} ฿):</span>
                      <span className="font-medium">{selectedPayment.water_amount.toLocaleString()} ฿</span>
                    </div>
                  )}
                  {selectedPayment.internet_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">ค่าอินเทอร์เน็ต:</span>
                      <span className="font-medium">{selectedPayment.internet_amount.toLocaleString()} ฿</span>
                    </div>
                  )}
                  {selectedPayment.common_fee_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">ค่าส่วนกลาง:</span>
                      <span className="font-medium">{selectedPayment.common_fee_amount.toLocaleString()} ฿</span>
                    </div>
                  )}
                  {selectedPayment.parking_fee_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">ค่าจอดรถ:</span>
                      <span className="font-medium">{selectedPayment.parking_fee_amount.toLocaleString()} ฿</span>
                    </div>
                  )}
                  {selectedPayment.other_amount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">ค่าใช้จ่ายอื่นๆ:</span>
                      <span className="font-medium">{selectedPayment.other_amount.toLocaleString()} ฿</span>
                    </div>
                  )}
                  {lateFee > 0 && (
                    <div className="flex justify-between text-sm text-red-600 font-semibold">
                      <span>ค่าปรับล่าช้า:</span>
                      <span>+{lateFee.toLocaleString()} ฿</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-3 border-t">
                    <span className="font-bold text-lg">รวมทั้งสิ้น:</span>
                    <span className="font-bold text-2xl text-blue-600">{totalWithLateFee.toLocaleString()} ฿</span>
                  </div>
                </div>

                {selectedPayment.payment_slip_url && (
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-2">หลักฐานการโอน</h3>
                    <button
                      onClick={() => setSlipPreview({ open: true, url: selectedPayment.payment_slip_url, title: `สลิป ห้อง ${room?.room_number || 'N/A'}` })}
                      className="w-full"
                    >
                      <img 
                        src={selectedPayment.payment_slip_url} 
                        alt="สลิป" 
                        className="w-full max-h-64 object-contain rounded-lg border hover:opacity-80 transition-opacity"
                      />
                    </button>
                  </div>
                )}

                {selectedPayment.notes && (
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-2">หมายเหตุ</h3>
                    <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{selectedPayment.notes}</p>
                  </div>
                )}

                <div className="flex gap-2 pt-4 border-t">
                  {effectiveStatus !== 'paid' && canConfirmPaid && (
                    <Button
                      type="button"
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Confirming payment:', selectedPayment.id);
                        updateStatusMutation.mutate({ id: selectedPayment.id, status: 'paid', payment_date: getTodayDateString() });
                        setShowDetailDialog(false);
                      }}
                      disabled={updateStatusMutation.isPending}
                    >
                      {updateStatusMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      ยืนยันชำระ
                    </Button>
                  )}
                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEdit(selectedPayment);
                        setShowDetailDialog(false);
                      }}
                    >
                      <Edit2 className="w-4 h-4 mr-2" />
                      แก้ไข
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowDetailDialog(false);
                    }}
                  >
                    ปิด
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Slip Preview Dialog */}
      <SlipPreviewDialog
        open={slipPreview.open}
        onOpenChange={(open) => setSlipPreview(prev => ({ ...prev, open }))}
        slipUrl={slipPreview.url}
        title={slipPreview.title}
      />
    </div>
  );
}