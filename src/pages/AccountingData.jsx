import React, { useState, useMemo, useEffect } from "react"; // Added useEffect
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, Search, Calendar, DollarSign, Home, Camera, Shield, Banknote, AlertTriangle, RefreshCw, Database, Loader2 } from "lucide-react";
import { format, parseISO, subMonths, startOfMonth, endOfMonth, subYears, isWithinInterval, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "../components/shared/PageHeader"; // Added PageHeader import

// ฟังก์ชันคำนวณค่าปรับ
function calculateLateFee(payment, configs, selectedBranchId) {
  if (!payment || !payment.due_date || payment.status === 'paid') return 0;
  if (payment.late_fee_amount && payment.late_fee_amount > 0) return payment.late_fee_amount;

  try {
    const dueDate = parseISO(payment.due_date);
    const today = new Date();
    const daysOverdue = differenceInDays(today, dueDate);

    if (daysOverdue <= 0) return 0;

    // ตรวจสอบว่าเปิดใช้ค่าปรับแบบขั้นบันไดหรือไม่
    const branchConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === selectedBranchId);
    const globalConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
    const tiersEnabledConfig = branchConfig || globalConfig;
    const tiersEnabled = tiersEnabledConfig?.value === 'true';

    if (tiersEnabled) {
      const branchTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && c.branch_id === selectedBranchId);
      const globalTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
      const tiersConfig = branchTiersConfig || globalTiersConfig;
      
      if (tiersConfig?.value) {
        try {
          const tiers = JSON.parse(tiersConfig.value);
          let totalFee = 0;

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

          return totalFee;
        } catch (e) {
          console.error('Error parsing late fee tiers:', e);
        }
      }
    }

    // ค่าปรับแบบธรรมดา
    const branchLateFeeConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && c.branch_id === selectedBranchId);
    const globalLateFeeConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && !c.branch_id);
    const lateFeeConfig = branchLateFeeConfig || globalLateFeeConfig;
    const lateFeePerDay = lateFeeConfig ? parseFloat(lateFeeConfig.value) : 0;
    
    if (lateFeePerDay === 0 || isNaN(lateFeePerDay)) return 0;

    return daysOverdue * lateFeePerDay;
  } catch (error) {
    console.error('Error calculating late fee:', error);
    return 0;
  }
}

export default function AccountingData() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all'); // เดือน/ปีที่เลือก format: 'YYYY-MM'
  const [selectedPayments, setSelectedPayments] = useState([]);
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [showReceiptLinks, setShowReceiptLinks] = useState(false);
  const [showDepositReturnDialog, setShowDepositReturnDialog] = useState(false);
  const [selectedDeposit, setSelectedDeposit] = useState(null);
  const [returnAmount, setReturnAmount] = useState('');
  const [returnNotes, setReturnNotes] = useState('');
  
  // ✅ เพิ่ม state สำหรับ failed receipts
  const [failedReceipts, setFailedReceipts] = useState([]);
  const [showFailedBanner, setShowFailedBanner] = useState(false);
  
  // Debug state
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // New state for active tab and selected branch name
  const [activeTab, setActiveTab] = useState('payments');
  const [selectedBranchName, setSelectedBranchName] = useState('กำลังโหลด...');

  const selectedBranchId = localStorage.getItem('selected_branch_id');
  // Removed canView as it's directly used as !!selectedBranchId

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 60 * 60 * 1000,
  });

  // กำหนด userRole จาก currentUser
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  // Shared retry config
  const retryConfig = {
    retry: 0, // Changed retry to 0
    retryDelay: 0, // Changed retryDelay to 0
  };

  // ⭐ ดึง configs เพื่อคำนวณค่าปรับ
  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    ...retryConfig,
    staleTime: 4 * 60 * 60 * 1000,
    gcTime: 8 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // ✅ เช็ค sessionStorage เมื่อโหลดหน้า
  useEffect(() => {
    const failed = sessionStorage.getItem('failed_receipts');
    if (failed) {
      try {
        const failedData = JSON.parse(failed);
        setFailedReceipts(failedData);
        setShowFailedBanner(true);
      } catch (e) {
        console.error('Error parsing failed receipts:', e);
      } finally {
        sessionStorage.removeItem('failed_receipts'); // Always clear after reading
      }
    }
  }, []);

  // Query for branches to get the selected branch name
  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await base44.entities.Branch.list();
      return response;
    },
    ...retryConfig,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // Set selected branch name once branches are loaded
  useEffect(() => {
    if (selectedBranchId && branches.length > 0) {
      const currentBranch = branches.find(b => b.id === selectedBranchId);
      if (currentBranch) {
        setSelectedBranchName(currentBranch.branch_name);
      } else {
        setSelectedBranchName('ไม่พบสาขา');
      }
    } else if (!selectedBranchId) {
      setSelectedBranchName('ไม่เลือกสาขา');
    }
  }, [branches, selectedBranchId]);

  // ✅ ฟังก์ชันสำหรับ dismiss banner
  const handleDismissFailedBanner = () => {
    setShowFailedBanner(false);
    sessionStorage.removeItem('failed_receipts');
    setFailedReceipts([]);
  };

  // ✅ ฟังก์ชันสำหรับ retry failed receipts
  const handleRetryFailed = () => {
    const failedIds = failedReceipts.map(f => f.paymentId).join(','); // Corrected to paymentId as per previous pattern
    // Clear banner before navigating
    handleDismissFailedBanner(); 
    navigate(`${createPageUrl('PrintReceipts')}?paymentIds=${failedIds}`);
  };

  // ✅ ดึงแบบ pagination เหมือนหน้า Payments
  const { data: payments = [], isLoading: paymentsLoading, isFetching: paymentsFetching } = useQuery({
    queryKey: ['payments', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      
      // ดึงข้อมูลแบบ pagination
      let allData = [];
      let skip = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const batch = await base44.entities.Payment.filter(
          { branch_id: selectedBranchId },
          '-created_date',
          limit,
          skip
        );
        allData = [...allData, ...batch];
        skip += limit;
        
        if (batch.length < limit) {
          hasMore = false;
        }
        
        // สูงสุด 1,000,000 records
        if (skip >= 1000000) {
          hasMore = false;
        }
      }
      
      console.log(`📊 AccountingData - Loaded ${allData.length} payments for branch ${selectedBranchId}`);
      return allData;
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // ✅ ดึง bookings เฉพาะสาขา (BACKEND FILTERING)
  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      
      let allData = [];
      let skip = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const batch = await base44.entities.Booking.filter(
          { branch_id: selectedBranchId },
          '-created_date',
          limit,
          skip
        );
        allData = [...allData, ...batch];
        skip += limit;
        
        if (batch.length < limit) {
          hasMore = false;
        }
        if (skip >= 100000) {
          hasMore = false;
        }
      }
      
      console.log(`📊 AccountingData - Loaded ${allData.length} bookings for branch ${selectedBranchId}`);
      return allData;
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // ✅ ดึงห้องเฉพาะสาขาที่เลือก (MULTI-TENANT SAFE)
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      
      let allData = [];
      let skip = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const batch = await base44.entities.Room.filter(
          { branch_id: selectedBranchId },
          '-room_number',
          limit,
          skip
        );
        allData = [...allData, ...batch];
        skip += limit;
        
        if (batch.length < limit) {
          hasMore = false;
        }
        if (skip >= 100000) {
          hasMore = false;
        }
      }
      
      console.log(`📊 AccountingData - Loaded ${allData.length} rooms for branch ${selectedBranchId}`);
      return allData;
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // ✅ ดึงผู้เช่าเฉพาะสาขาที่เลือก (MULTI-TENANT SAFE)
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      
      let allData = [];
      let skip = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const batch = await base44.entities.Tenant.filter(
          { branch_id: selectedBranchId },
          '-created_date',
          limit,
          skip
        );
        allData = [...allData, ...batch];
        skip += limit;
        
        if (batch.length < limit) {
          hasMore = false;
        }
        if (skip >= 100000) {
          hasMore = false;
        }
      }
      
      console.log(`📊 AccountingData - Loaded ${allData.length} tenants for branch ${selectedBranchId}`);
      return allData;
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // ✅ ดึง expenses เฉพาะสาขา (BACKEND FILTERING)
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      
      let allData = [];
      let skip = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const batch = await base44.entities.Expense.filter(
          { branch_id: selectedBranchId },
          '-date',
          limit,
          skip
        );
        allData = [...allData, ...batch];
        skip += limit;
        
        if (batch.length < limit) {
          hasMore = false;
        }
        if (skip >= 100000) {
          hasMore = false;
        }
      }
      
      console.log(`📊 AccountingData - Loaded ${allData.length} expenses for branch ${selectedBranchId}`);
      return allData;
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // ฟังก์ชันคำนวณงวดบิล - ถ้า due_date อยู่ช่วงต้นเดือน (1-10) = บิลของเดือนก่อนหน้า
  const getBillingPeriod = (payment) => {
    if (!payment.due_date) return null;
    try {
      const dueDate = parseISO(payment.due_date);
      // ถ้าครบกำหนดชำระวันที่ 1-10 ของเดือน → ถือว่าเป็นบิลของเดือนก่อนหน้า
      if (dueDate.getDate() <= 10) {
        return subMonths(dueDate, 1);
      }
      return dueDate;
    } catch {
      return null;
    }
  };

  // สร้างรายการเดือน/ปีที่มีข้อมูล
  const availableMonths = useMemo(() => {
    const monthsSet = new Set();
    payments.forEach(p => {
      const billingPeriod = getBillingPeriod(p);
      if (billingPeriod) {
        const monthKey = format(billingPeriod, 'yyyy-MM');
        monthsSet.add(monthKey);
      }
    });
    
    const sortedMonths = Array.from(monthsSet).sort((a, b) => b.localeCompare(a)); // เรียงจากใหม่ไปเก่า
    return sortedMonths;
  }, [payments]);

  // ✅ สร้าง Maps สำหรับ O(1) lookup (แก้ N+1 Problem)
  const roomsMap = useMemo(() => {
    return new Map(rooms.map(r => [r.id, r]));
  }, [rooms]);

  const tenantsMap = useMemo(() => {
    return new Map(tenants.map(t => [t.id, t]));
  }, [tenants]);

  // ตั้งค่า default เป็นเดือนล่าสุดที่มีข้อมูล
  useEffect(() => {
    if (availableMonths.length > 0 && selectedMonth === 'all') {
      setSelectedMonth(availableMonths[0]); // เดือนล่าสุด
    }
  }, [availableMonths]);

  // ฟังก์ชันกรองข้อมูล - ใบเสร็จรับเงิน (ทุกรายการ)
  const filteredPayments = useMemo(() => {
    console.log('🔍 filteredPayments calculation - Total payments:', payments.length);
    console.log('selectedMonth:', selectedMonth, 'searchTerm:', searchTerm);

    const filtered = payments
      .filter(payment => {
        const room = roomsMap.get(payment.room_id);
        const tenant = tenantsMap.get(payment.tenant_id);
        
        const matchSearch = !searchTerm || 
          room?.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tenant?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchMonth = true;
        if (selectedMonth !== 'all') {
          const billingPeriod = getBillingPeriod(payment);
          if (billingPeriod) {
            const paymentMonth = format(billingPeriod, 'yyyy-MM');
            matchMonth = paymentMonth === selectedMonth;
          } else {
            matchMonth = false;
          }
        }
        
        return matchSearch && matchMonth;
      })
      .sort((a, b) => {
        const dateA = a.payment_date || a.due_date || a.created_date;
        const dateB = b.payment_date || b.due_date || b.created_date;
        return new Date(dateB) - new Date(dateA);
      });
    
    console.log('✅ Filtered payments:', filtered.length);
    return filtered;
  }, [payments, roomsMap, tenantsMap, searchTerm, selectedMonth]);

  // ฟังก์ชันกรองใบแจ้งหนี้ (ทุกรายการ)
  const filteredInvoices = useMemo(() => {
    console.log('🔍 filteredInvoices calculation - Total payments:', payments.length);
    console.log('selectedMonth:', selectedMonth);

    const filtered = payments
      .filter(payment => {
        const room = roomsMap.get(payment.room_id);
        const tenant = tenantsMap.get(payment.tenant_id);
        
        const matchSearch = !searchTerm || 
          room?.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tenant?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        let matchMonth = true;
        if (selectedMonth !== 'all') {
          const billingPeriod = getBillingPeriod(payment);
          if (billingPeriod) {
            const paymentMonth = format(billingPeriod, 'yyyy-MM');
            matchMonth = paymentMonth === selectedMonth;
          } else {
            matchMonth = false;
          }
        }
        
        return matchSearch && matchMonth;
      })
      .sort((a, b) => {
        const dateA = a.due_date || a.created_date;
        const dateB = b.due_date || b.created_date;
        return new Date(dateB) - new Date(dateA);
      });
    
    console.log('✅ Filtered invoices:', filtered.length);
    return filtered;
  }, [payments, roomsMap, tenantsMap, searchTerm, selectedMonth]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      const room = roomsMap.get(booking.room_id);
      const tenant = tenantsMap.get(booking.tenant_id);
      
      const matchSearch = !searchTerm || 
        room?.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.guest_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchDate = !dateFilter || 
        booking.check_in_date?.startsWith(dateFilter);
      
      return matchSearch && matchDate;
    });
  }, [bookings, roomsMap, tenantsMap, searchTerm, dateFilter]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(expense => {
      const matchSearch = !searchTerm || 
        expense.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.description?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchDate = !dateFilter || 
        expense.date?.startsWith(dateFilter);
      
      return matchSearch && matchDate;
    });
  }, [expenses, searchTerm, dateFilter]);

  // คำนวณข้อมูลเงินมัดจำ
  const depositData = useMemo(() => {
    // กรองเฉพาะ booking ที่มีเงินมัดจำและยัง active อยู่
    const activeDeposits = bookings.filter(booking => 
      booking.deposit_amount > 0 && 
      booking.status === 'active' &&
      booking.booking_type === 'monthly'
    );

    const totalHeld = activeDeposits.reduce((sum, b) => sum + (b.deposit_amount || 0), 0);
    const totalCount = activeDeposits.length;

    // คำนวณเงินมัดจำที่คืนแล้ว (จาก booking ที่ completed)
    const returnedDeposits = bookings.filter(booking =>
      booking.deposit_amount > 0 &&
      booking.status === 'completed' &&
      booking.booking_type === 'monthly'
    );
    const totalReturned = returnedDeposits.reduce((sum, b) => sum + (b.deposit_amount || 0), 0);

    return {
      activeDeposits,
      totalHeld,
      totalCount,
      totalReturned,
      returnedCount: returnedDeposits.length
    };
  }, [bookings]);

  const filteredDeposits = useMemo(() => {
    return depositData.activeDeposits.filter(booking => {
      const room = roomsMap.get(booking.room_id);
      const tenant = tenantsMap.get(booking.tenant_id);
      
      const matchSearch = !searchTerm || 
        room?.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchSearch;
    });
  }, [depositData.activeDeposits, roomsMap, tenantsMap, searchTerm]);

  // Mutation สำหรับคืนเงินมัดจำ
  const returnDepositMutation = useMutation({
    mutationFn: async ({ bookingId, returnAmount, notes }) => {
      const booking = bookings.find(b => b.id === bookingId);
      
      // อัปเดตสถานะ booking เป็น completed
      await base44.entities.Booking.update(bookingId, {
        status: 'completed',
        notes: `${notes || ''}\nคืนเงินมัดจำ: ${format(new Date(), 'd/M/yyyy HH:mm', { locale: th })} จำนวน ${returnAmount} บาท`
      });

      // บันทึกค่าใช้จ่ายการคืนเงินมัดจำ
      await base44.entities.Expense.create({
        branch_id: selectedBranchId,
        title: `คืนเงินมัดจำ - ห้อง ${roomsMap.get(booking?.room_id)?.room_number || 'N/A'}`,
        amount: returnAmount,
        category: 'refund_deposit',
        date: format(new Date(), 'yyyy-MM-dd'),
        description: `คืนเงินมัดจำให้ ${tenantsMap.get(booking?.tenant_id)?.full_name || 'ผู้เช่า'}${notes ? ` - ${notes}` : ''}`,
        notes: `Booking ID: ${bookingId}`
      });
      
      return { bookingId, returnAmount, notes };
    },
    onSuccess: async (data) => {
      const booking = bookings.find(b => b.id === data.bookingId);
      const room = roomsMap.get(booking?.room_id);
      const tenant = tenantsMap.get(booking?.tenant_id);

      // บันทึกประวัติ
      try {
        await base44.entities.ActivityLog.create({
          branch_id: selectedBranchId,
          action_type: 'update',
          entity_type: 'Booking',
          entity_id: data.bookingId,
          entity_name: `ห้อง ${room?.room_number || 'N/A'} - ${tenant?.full_name || 'N/A'}`,
          user_email: currentUser?.email || 'unknown',
          user_name: currentUser?.full_name || 'ไม่ระบุ',
          description: `คืนเงินมัดจำ ${data.returnAmount.toLocaleString()} บาท${data.notes ? ` (${data.notes})` : ''}`,
          changes: {
            status: { old: 'active', new: 'completed' },
            deposit_returned: data.returnAmount
          }
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }

      queryClient.invalidateQueries(['bookings']);
      queryClient.invalidateQueries(['expenses', selectedBranchId]);
      queryClient.invalidateQueries(['activityLogs']);
      toast.success('คืนเงินมัดจำและบันทึกค่าใช้จ่ายสำเร็จ');
      setShowDepositReturnDialog(false);
      setSelectedDeposit(null);
      setReturnAmount('');
      setReturnNotes('');
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  });

  const handleReturnDeposit = (booking) => {
    setSelectedDeposit(booking);
    setReturnAmount(booking.deposit_amount.toString());
    setReturnNotes('');
    setShowDepositReturnDialog(true);
  };

  const handleSubmitReturn = () => {
    if (!selectedDeposit) return;
    
    const amount = parseFloat(returnAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('กรุณากรอกจำนวนเงินที่ถูกต้อง');
      return;
    }

    if (amount > selectedDeposit.deposit_amount) {
      toast.error('จำนวนเงินที่คืนมากกว่าเงินมัดจำ');
      return;
    }

    returnDepositMutation.mutate({
      bookingId: selectedDeposit.id,
      returnAmount: amount,
      notes: returnNotes
    });
  };

  // ฟังก์ชันจัดการ checkbox
  const handleSelectPayment = (paymentId) => {
    setSelectedPayments(prev => {
      if (prev.includes(paymentId)) {
        return prev.filter(id => id !== paymentId);
      } else {
        return [...prev, paymentId];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedPayments.length === filteredPayments.length && filteredPayments.length > 0) {
      setSelectedPayments([]);
    } else {
      setSelectedPayments(filteredPayments.map(p => p.id));
    }
  };

  // ฟังก์ชันจัดการ checkbox สำหรับใบแจ้งหนี้
  const handleSelectInvoice = (paymentId) => {
    setSelectedInvoices(prev => {
      if (prev.includes(paymentId)) {
        return prev.filter(id => id !== paymentId);
      } else {
        return [...prev, paymentId];
      }
    });
  };

  const handleSelectAllInvoices = () => {
    if (selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0) {
      setSelectedInvoices([]);
    } else {
      setSelectedInvoices(filteredInvoices.map(p => p.id));
    }
  };

  // ฟังก์ชันเปิดใบเสร็จ/ใบแจ้งหนี้ทั้งหมด
  const handleOpenAllReceipts = () => {
    const selectedIds = activeTab === 'invoices' ? selectedInvoices : selectedPayments;
    const docType = activeTab === 'invoices' ? 'ใบแจ้งหนี้' : 'ใบเสร็จ';
    const pageName = activeTab === 'invoices' ? 'Invoice' : 'Receipt';
    
    if (selectedIds.length === 0) {
      toast.error('กรุณาเลือกรายการก่อน');
      return;
    }

    if (selectedIds.length === 1) {
      // ถ้าเลือกแค่ 1 รายการ เปิดในหน้าเดียวกันเลย
      navigate(`${createPageUrl(pageName)}?paymentId=${selectedIds[0]}`);
    } else {
      // ถ้าเลือกหลายรายการ แสดง dialog ให้เลือกทีละรายการ
      setShowReceiptLinks(true);
      toast.info(`มี ${selectedIds.length} ${docType}ให้เลือกเปิด`);
    }
  };

  // ฟังก์ชันแสดงลิงก์
  const handleShowReceiptLinks = () => {
    if (selectedPayments.length === 0) {
      toast.error('กรุณาเลือกรายการก่อน');
      return;
    }
    setShowReceiptLinks(true);
  };

  // ฟังก์ชันพิมพ์ใบเสร็จ/ใบแจ้งหนี้ทั้งหมด - ดาวน์โหลดได้ทุกรายการ
  const handlePrintAllReceipts = async () => {
    // ใช้รายการที่เลือกตาม tab ที่ active อยู่
    const selectedIds = activeTab === 'invoices' ? selectedInvoices : selectedPayments;
    
    if (selectedIds.length === 0) {
      toast.error('กรุณาเลือกรายการก่อน');
      return;
    }

    // บันทึกประวัติ
    try {
      const roomNumbers = selectedIds.map(paymentId => {
        const payment = payments.find(p => p.id === paymentId);
        const room = roomsMap.get(payment?.room_id);
        return room?.room_number || 'N/A';
      }).join(', ');

      const docTypeName = activeTab === 'invoices' ? 'ใบแจ้งหนี้' : 'ใบเสร็จ';

      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'create',
        entity_type: activeTab === 'invoices' ? 'Invoice' : 'Receipt',
        entity_id: `${activeTab}_${Date.now()}`,
        entity_name: `${docTypeName} ${selectedIds.length} รายการ`,
        user_email: currentUser?.email || 'unknown',
        user_name: currentUser?.full_name || 'ไม่ระบุ',
        description: `พิมพ์/บันทึก PDF ${docTypeName} ${selectedIds.length} รายการ (ห้อง: ${roomNumbers})`,
        changes: { count: selectedIds.length, payment_ids: selectedIds }
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }

    // เปิดทุกรายการที่เลือก - ส่ง type parameter เพื่อระบุว่าเป็นใบเสร็จหรือใบแจ้งหนี้
    const paymentIdsString = selectedIds.join(',');
    const docType = activeTab === 'invoices' ? 'invoice' : 'receipt';
    navigate(`${createPageUrl('PrintReceipts')}?paymentIds=${paymentIdsString}&type=${docType}`);
  };

  // ฟังก์ชัน Export ข้อมูล (All filtered payments)
  const exportPayments = async () => {
    try {
      const data = filteredPayments.map(payment => {
        const room = roomsMap.get(payment.room_id);
        const tenant = tenantsMap.get(payment.tenant_id);
        const calcLateFee = calculateLateFee(payment, configs, selectedBranchId);
        const displayLateFee = payment.late_fee_amount > 0 ? payment.late_fee_amount : calcLateFee;
        const totalWithLateFee = (payment.total_amount || 0) + (displayLateFee > payment.late_fee_amount ? displayLateFee - payment.late_fee_amount : 0);
        
        return {
          'วันที่': payment.payment_date ? format(parseISO(payment.payment_date), 'd/M/yyyy', { locale: th }) : '-',
          'ห้อง': room?.room_number || '-',
          'ผู้เช่า': tenant?.full_name || '-',
          'เลขบัตรประชาชน': tenant?.national_id || '-',
          'ค่าเช่า': payment.rent_amount || 0,
          'ค่าไฟ': payment.electricity_amount || 0,
          'ค่าน้ำ': payment.water_amount || 0,
          'ค่าอินเทอร์เน็ต': payment.internet_amount || 0,
          'อื่นๆ': payment.other_amount || 0,
          'ค่าปรับ': displayLateFee || 0,
          'รวม': totalWithLateFee || 0,
          'วิธีชำระ': payment.payment_method === 'cash' ? 'เงินสด' : payment.payment_method === 'transfer' ? 'โอนเงิน' : 'QR Code'
        };
      });

      downloadCSV(data, 'ใบเสร็จรับเงิน');

      // บันทึกประวัติ
      try {
        await base44.entities.ActivityLog.create({
          branch_id: selectedBranchId,
          action_type: 'create',
          entity_type: 'Export',
          entity_id: `export_${Date.now()}`,
          entity_name: 'ใบเสร็จรับเงิน',
          user_email: currentUser?.email || 'unknown',
          user_name: currentUser?.full_name || 'ไม่ระบุ',
          description: `Export ใบเสร็จรับเงิน ${filteredPayments.length} รายการ`,
          changes: { count: filteredPayments.length, type: 'payments' }
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการ Export');
    }
  };

  // ฟังก์ชัน Export ข้อมูล (Selected payments)
  const exportSelectedPayments = async () => {
    try {
      const data = selectedPayments.map(paymentId => {
        const payment = payments.find(p => p.id === paymentId);
        if (!payment) return null;

        const room = roomsMap.get(payment.room_id);
        const tenant = tenantsMap.get(payment.tenant_id);
        const calcLateFee = calculateLateFee(payment, configs, selectedBranchId);
        const displayLateFee = payment.late_fee_amount > 0 ? payment.late_fee_amount : calcLateFee;
        const totalWithLateFee = (payment.total_amount || 0) + (displayLateFee > payment.late_fee_amount ? displayLateFee - payment.late_fee_amount : 0);
        
        return {
          'วันที่': payment.payment_date ? format(parseISO(payment.payment_date), 'd/M/yyyy', { locale: th }) : '-',
          'ห้อง': room?.room_number || '-',
          'ผู้เช่า': tenant?.full_name || '-',
          'เลขบัตรประชาชน': tenant?.national_id || '-',
          'ค่าเช่า': payment.rent_amount || 0,
          'ค่าไฟ': payment.electricity_amount || 0,
          'ค่าน้ำ': payment.water_amount || 0,
          'ค่าอินเทอร์เน็ต': payment.internet_amount || 0,
          'อื่นๆ': payment.other_amount || 0,
          'ค่าปรับ': displayLateFee || 0,
          'รวม': totalWithLateFee || 0,
          'วิธีชำระ': payment.payment_method === 'cash' ? 'เงินสด' : payment.payment_method === 'transfer' ? 'โอนเงิน' : 'QR Code'
        };
      }).filter(Boolean); // Remove any null entries

      if (data.length === 0) {
        toast.error('ไม่พบข้อมูลสำหรับรายการที่เลือก');
        return;
      }

      downloadCSV(data, 'ใบเสร็จรับเงิน_ที่เลือก');

      // บันทึกประวัติ
      try {
        await base44.entities.ActivityLog.create({
          branch_id: selectedBranchId,
          action_type: 'create',
          entity_type: 'Export',
          entity_id: `export_${Date.now()}`,
          entity_name: 'ใบเสร็จรับเงิน (ที่เลือก)',
          user_email: currentUser?.email || 'unknown',
          user_name: currentUser?.full_name || 'ไม่ระบุ',
          description: `Export ใบเสร็จรับเงินที่เลือก ${selectedPayments.length} รายการ`,
          changes: { count: selectedPayments.length, type: 'payments_selected' }
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (error) {
      console.error('Error exporting selected payments:', error);
      toast.error('เกิดข้อผิดพลาดในการ Export ข้อมูลที่เลือก');
    }
  };


  const exportBookings = async () => {
    try {
      const data = filteredBookings.map(booking => {
        const room = roomsMap.get(booking.room_id);
        const tenant = tenantsMap.get(booking.tenant_id);
        
        return {
          'ห้อง': room?.room_number || '-',
          'ผู้เช่า': tenant?.full_name || booking.guest_name || '-',
          'เบอร์โทร': tenant?.phone || booking.guest_phone || '-',
          'เลขบัตรประชาชน': tenant?.national_id || '-',
          'วันเริ่มสัญญา': booking.check_in_date ? format(parseISO(booking.check_in_date), 'd/M/yyyy', { locale: th }) : '-',
          'วันสิ้นสุดสัญญา': booking.check_out_date ? format(parseISO(booking.check_out_date), 'd/M/yyyy', { locale: th }) : '-',
          'ประเภท': booking.booking_type === 'monthly' ? 'รายเดือน' : 'รายวัน',
          'เงินมัดจำ': booking.deposit_amount || 0,
          'สถานะ': booking.status === 'active' ? 'ใช้งาน' : booking.status === 'completed' ? 'เสร็จสิ้น' : 'ยกเลิก'
        };
      });

      downloadCSV(data, 'สัญญาเช่า');

      // บันทึกประวัติ
      try {
        await base44.entities.ActivityLog.create({
          branch_id: selectedBranchId,
          action_type: 'create',
          entity_type: 'Export',
          entity_id: `export_${Date.now()}`,
          entity_name: 'สัญญาเช่า',
          user_email: currentUser?.email || 'unknown',
          user_name: currentUser?.full_name || 'ไม่ระบุ',
          description: `Export ข้อมูลสัญญาเช่า ${filteredBookings.length} รายการ`,
          changes: { count: filteredBookings.length, type: 'bookings' }
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการ Export');
    }
  };

  const exportExpenses = async () => {
    try {
      const data = filteredExpenses.map(expense => ({
        'วันที่': expense.date ? format(parseISO(expense.date), 'd/M/yyyy', { locale: th }) : '-',
        'รายการ': expense.title || '-',
        'ประเภท': expense.category || '-',
        'จำนวนเงิน': expense.amount || 0,
        'รายละเอียด': expense.description || '-',
        'รูปใบเสร็จ': expense.receipt_image || '-'
      }));

      downloadCSV(data, 'ค่าใช้จ่าย');

      // บันทึกประวัติ
      try {
        await base44.entities.ActivityLog.create({
          branch_id: selectedBranchId,
          action_type: 'create',
          entity_type: 'Export',
          entity_id: `export_${Date.now()}`,
          entity_name: 'ค่าใช้จ่าย',
          user_email: currentUser?.email || 'unknown',
          user_name: currentUser?.full_name || 'ไม่ระบุ',
          description: `Export ข้อมูลค่าใช้จ่าย ${filteredExpenses.length} รายการ`,
          changes: { count: filteredExpenses.length, type: 'expenses' }
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการ Export');
    }
  };

  const exportInvoices = async () => {
    try {
      const data = filteredInvoices.map(payment => {
        const room = roomsMap.get(payment.room_id);
        const tenant = tenantsMap.get(payment.tenant_id);
        const calcLateFee = calculateLateFee(payment, configs, selectedBranchId);
        const displayLateFee = payment.late_fee_amount > 0 ? payment.late_fee_amount : calcLateFee;
        const totalWithLateFee = (payment.total_amount || 0) + (displayLateFee > payment.late_fee_amount ? displayLateFee - payment.late_fee_amount : 0);
        
        return {
          'วันครบกำหนด': payment.due_date ? format(parseISO(payment.due_date), 'd/M/yyyy', { locale: th }) : '-',
          'ห้อง': room?.room_number || '-',
          'ผู้เช่า': tenant?.full_name || '-',
          'เบอร์โทร': tenant?.phone || '-',
          'ค่าเช่า': payment.rent_amount || 0,
          'ค่าไฟ': payment.electricity_amount || 0,
          'ค่าน้ำ': payment.water_amount || 0,
          'ค่าอินเทอร์เน็ต': payment.internet_amount || 0,
          'อื่นๆ': payment.other_amount || 0,
          'ค่าปรับ': displayLateFee || 0,
          'รวม': totalWithLateFee || 0,
          'สถานะ': payment.status === 'pending' ? 'รอชำระ' : 'เกินกำหนด'
        };
      });

      downloadCSV(data, 'ใบแจ้งหนี้');

      // บันทึกประวัติ
      try {
        await base44.entities.ActivityLog.create({
          branch_id: selectedBranchId,
          action_type: 'create',
          entity_type: 'Export',
          entity_id: `export_${Date.now()}`,
          entity_name: 'ใบแจ้งหนี้',
          user_email: currentUser?.email || 'unknown',
          user_name: currentUser?.full_name || 'ไม่ระบุ',
          description: `Export ใบแจ้งหนี้ ${filteredInvoices.length} รายการ`,
          changes: { count: filteredInvoices.length, type: 'invoices' }
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการ Export');
    }
  };

  // Export เงินมัดจำ
  const exportDeposits = async () => {
    try {
      const data = depositData.activeDeposits.map(booking => {
        const room = roomsMap.get(booking.room_id);
        const tenant = tenantsMap.get(booking.tenant_id);
        
        return {
          'ห้อง': room?.room_number || '-',
          'ผู้เช่า': tenant?.full_name || '-',
          'เบอร์โทร': tenant?.phone || '-',
          'วันเริ่มสัญญา': (() => { if (!booking.check_in_date) return '-'; try { const d = parseISO(booking.check_in_date); return isNaN(d.getTime()) ? '-' : format(d, 'd/M/yyyy', { locale: th }); } catch { return '-'; } })(),
          'เงินมัดจำ': booking.deposit_amount || 0,
          'สถานะ': 'ถือครองอยู่'
        };
      });

      downloadCSV(data, 'รายงานเงินมัดจำ');

      // บันทึกประวัติ
      try {
        await base44.entities.ActivityLog.create({
          branch_id: selectedBranchId,
          action_type: 'create',
          entity_type: 'Export',
          entity_id: `export_${Date.now()}`,
          entity_name: 'รายงานเงินมัดจำ',
          user_email: currentUser?.email || 'unknown',
          user_name: currentUser?.full_name || 'ไม่ระบุ',
          description: `Export รายงานเงินมัดจำ ${depositData.activeDeposits.length} รายการ (รวม ${depositData.totalHeld.toLocaleString()} บาท)`,
          changes: { count: depositData.activeDeposits.length, total: depositData.totalHeld, type: 'deposits' }
        });
      } catch (error) {
        console.error('Failed to log activity:', error);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการ Export');
    }
  };

  const downloadCSV = (data, filename) => {
    const headers = Object.keys(data[0] || {});
    const csvContent = [
      '\uFEFF' + headers.join(','),
      ...data.map(row => headers.map(header => `"${(row[header] || '').toString().replace(/"/g, '""')}"`).join(',')) // Escaping quotes for CSV
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success(`Export ${filename} สำเร็จ`);
  };

  // Global Export functions for PageHeader
  const handleExportAll = () => {
    switch (activeTab) {
        case 'payments':
            exportPayments();
            break;
        case 'invoices':
            exportInvoices();
            break;
        case 'bookings':
            exportBookings();
            break;
        case 'deposits':
            exportDeposits();
            break;
        case 'expenses':
            exportExpenses();
            break;
        default:
            toast.error('ไม่สามารถส่งออกได้: ไม่รู้จักแท็บ');
    }
  };

  const handleExportSelected = () => {
      if (activeTab === 'payments') {
          exportSelectedPayments();
      } else {
          toast.error('เลือกได้เฉพาะรายการใบเสร็จรับเงินเท่านั้น');
      }
  };

  if (paymentsLoading && payments.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <PageHeader 
          title="ฐานข้อมูลบัญชี" 
          subtitle={`สาขา ${selectedBranchName}`}
          icon={Database}
        />
        <div className="px-4 md:px-8 py-6">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600 text-lg">กำลังโหลดข้อมูลการชำระเงิน...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader 
        title="ฐานข้อมูลบัญชี" 
        subtitle={`สาขา ${selectedBranchName}`}
        icon={Database}
        actions={
          <>
            {userRole === 'developer' && (
              <Button
                onClick={() => setShowDebugPanel(!showDebugPanel)}
                variant="outline"
                className="border-purple-600 text-purple-600 hover:bg-purple-50 shadow-md"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Debug
              </Button>
            )}
            <Button
              onClick={handleExportSelected}
              disabled={selectedPayments.length === 0 || activeTab !== 'payments'}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50 shadow-md"
            >
              <Download className="w-4 h-4 mr-2" />
              Export ที่เลือก ({selectedPayments.length})
            </Button>
            <Button
              onClick={handleExportAll}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              <Download className="w-4 h-4 mr-2" />
              Export ทั้งหมด
            </Button>
          </>
        }
        />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Debug Panel */}
          {showDebugPanel && userRole === 'developer' && (
            <Card className="bg-purple-50 border-2 border-purple-300 shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-purple-900 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    Debug Info - Data Loading Analysis
                  </h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowDebugPanel(false)}
                  >
                    ปิด
                  </Button>
                </div>

                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-4 border border-purple-200">
                      <p className="font-bold text-purple-800 mb-2">📊 Raw Data Counts</p>
                      <div className="space-y-1 text-xs">
                        <p>Payments loaded: <span className="font-mono font-bold text-blue-600">{payments.length}</span></p>
                        <p>Rooms loaded: <span className="font-mono font-bold text-blue-600">{rooms.length}</span></p>
                        <p>Tenants loaded: <span className="font-mono font-bold text-blue-600">{tenants.length}</span></p>
                        <p>Bookings loaded: <span className="font-mono font-bold text-blue-600">{bookings.length}</span></p>
                        <p>Expenses loaded: <span className="font-mono font-bold text-blue-600">{expenses.length}</span></p>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-4 border border-purple-200">
                      <p className="font-bold text-purple-800 mb-2">🔍 Filtered Results</p>
                      <div className="space-y-1 text-xs">
                        <p>Filtered Payments: <span className="font-mono font-bold text-green-600">{filteredPayments.length}</span></p>
                        <p>Filtered Invoices: <span className="font-mono font-bold text-green-600">{filteredInvoices.length}</span></p>
                        <p>Active Tab: <span className="font-mono font-bold">{activeTab}</span></p>
                        <p>Date Filter: <span className="font-mono font-bold">{dateFilter}</span></p>
                        <p>Search Term: <span className="font-mono font-bold">{searchTerm || '(ไม่มี)'}</span></p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-purple-200">
                    <p className="font-bold text-purple-800 mb-2">📍 Branch & User Info</p>
                    <div className="space-y-1 text-xs">
                      <p>Selected Branch ID: <span className="font-mono text-blue-600">{selectedBranchId}</span></p>
                      <p>Selected Branch Name: <span className="font-mono">{selectedBranchName}</span></p>
                      <p>User Role: <span className="font-mono">{userRole}</span></p>
                      <p>Loading States: Payments={paymentsLoading ? '⏳' : '✅'}, PaymentsFetching={paymentsFetching ? '⏳' : '✅'}</p>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-purple-200">
                    <p className="font-bold text-purple-800 mb-2">🎯 Payment Sample (First 5)</p>
                    <div className="space-y-2">
                      {payments.slice(0, 5).map((p, idx) => {
                        const room = roomsMap.get(p.room_id);
                        const tenant = tenantsMap.get(p.tenant_id);
                        return (
                          <div key={idx} className="text-xs bg-purple-50 p-2 rounded border">
                            <p className="font-mono">
                              <span className="font-bold">#{idx + 1}</span> | 
                              Room: {room?.room_number || '❌ NOT FOUND'} | 
                              Tenant: {tenant?.full_name || '❌ NOT FOUND'} | 
                              Due: {p.due_date || 'N/A'} | 
                              Total: {p.total_amount}฿ | 
                              Status: {p.status}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-purple-200">
                    <p className="font-bold text-purple-800 mb-2">⚠️ Missing Room/Tenant Analysis</p>
                    <div className="space-y-2 text-xs">
                      {(() => {
                        const paymentsWithMissingRoom = payments.filter(p => !roomsMap.has(p.room_id));
                        const paymentsWithMissingTenant = payments.filter(p => !tenantsMap.has(p.tenant_id));

                        return (
                          <>
                            <p>
                              <span className="font-bold text-red-600">Missing Rooms:</span> {paymentsWithMissingRoom.length} payments
                            </p>
                            {paymentsWithMissingRoom.length > 0 && (
                              <div className="bg-red-50 p-2 rounded max-h-40 overflow-y-auto">
                                {paymentsWithMissingRoom.slice(0, 10).map((p, idx) => (
                                  <p key={idx} className="font-mono text-xs">
                                    Payment {p.id.substring(0, 8)} → room_id: {p.room_id}
                                  </p>
                                ))}
                              </div>
                            )}

                            <p className="mt-2">
                              <span className="font-bold text-red-600">Missing Tenants:</span> {paymentsWithMissingTenant.length} payments
                            </p>
                            {paymentsWithMissingTenant.length > 0 && (
                              <div className="bg-red-50 p-2 rounded max-h-40 overflow-y-auto">
                                {paymentsWithMissingTenant.slice(0, 10).map((p, idx) => (
                                  <p key={idx} className="font-mono text-xs">
                                    Payment {p.id.substring(0, 8)} → tenant_id: {p.tenant_id}
                                  </p>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg p-4 border border-purple-200">
                    <p className="font-bold text-purple-800 mb-2">🔧 Date Filter Debug</p>
                    <div className="space-y-1 text-xs">
                      {(() => {
                        if (dateFilter === 'all') {
                          return <p>ไม่มีการกรองตามวันที่</p>;
                        }

                        const now = new Date();
                        let dateRange = null;

                        switch(dateFilter) {
                          case 'this_month':
                            dateRange = { from: startOfMonth(now), to: endOfMonth(now) };
                            break;
                          case 'last_month':
                            dateRange = { from: startOfMonth(subMonths(now, 1)), to: endOfMonth(subMonths(now, 1)) };
                            break;
                          case '3_months':
                            dateRange = { from: startOfMonth(subMonths(now, 2)), to: endOfMonth(now) };
                            break;
                          case '6_months':
                            dateRange = { from: startOfMonth(subMonths(now, 5)), to: endOfMonth(now) };
                            break;
                          case '12_months':
                            dateRange = { from: startOfMonth(subMonths(now, 11)), to: endOfMonth(now) };
                            break;
                        }

                        if (dateRange) {
                          const paymentsInRange = payments.filter(p => {
                            if (!p.due_date) return false;
                            try {
                              const dueDate = parseISO(p.due_date);
                              return isWithinInterval(dueDate, { start: dateRange.from, end: dateRange.to });
                            } catch {
                              return false;
                            }
                          });

                          return (
                            <>
                              <p>Date Range: {format(dateRange.from, 'd MMM yyyy', { locale: th })} - {format(dateRange.to, 'd MMM yyyy', { locale: th })}</p>
                              <p>Payments in range: <span className="font-bold text-blue-600">{paymentsInRange.length}</span></p>
                              <p>Payments without due_date: <span className="font-bold text-red-600">{payments.filter(p => !p.due_date).length}</span></p>
                            </>
                          );
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action buttons previously in header */}
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              onClick={handlePrintAllReceipts}
              disabled={selectedPayments.length === 0 && selectedInvoices.length === 0}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
            >
              <Download className="w-4 h-4 mr-2" />
              📄 พิมพ์/บันทึก PDF ({activeTab === 'invoices' ? selectedInvoices.length : selectedPayments.length})
            </Button>
            <Button
              onClick={handleOpenAllReceipts}
              disabled={selectedPayments.length === 0 && selectedInvoices.length === 0}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              {activeTab === 'invoices' 
                ? (selectedInvoices.length === 1 ? 'เปิดใบแจ้งหนี้' : `เลือกใบแจ้งหนี้ (${selectedInvoices.length})`)
                : (selectedPayments.length === 1 ? 'เปิดใบเสร็จ' : `เลือกใบเสร็จ (${selectedPayments.length})`)
              }
            </Button>
          </div>

          {/* ✅ Failed Receipts Banner */}
          {showFailedBanner && failedReceipts.length > 0 && (
            <Card className="bg-red-50 border-2 border-red-200 shadow-lg">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-bold text-red-800 mb-2 text-base">
                      ⚠️ พบปัญหาในการโหลดใบเสร็จ ({failedReceipts.length} รายการ)
                    </h3>
                    <p className="text-sm text-red-700 mb-3">
                      มีบางรายการที่ไม่สามารถโหลดใบเสร็จได้ กรุณาลองใหม่อีกครั้ง
                    </p>
                    
                    <details className="mb-3">
                      <summary className="cursor-pointer text-sm font-semibold text-red-800 hover:text-red-900 mb-2">
                        ดูรายการที่ล้มเหลว ({failedReceipts.length} รายการ)
                      </summary>
                      <div className="bg-white rounded-lg p-3 border border-red-200 max-h-60 overflow-y-auto">
                        <div className="space-y-2">
                          {failedReceipts.map((item, idx) => (
                            <div key={idx} className="text-xs bg-red-50 p-2 rounded border border-red-100">
                              <div className="flex items-start gap-2">
                                <span className="font-mono font-semibold text-red-700 flex-shrink-0">
                                  #{idx + 1}
                                </span>
                                <div className="flex-1">
                                  <p className="font-mono text-xs text-slate-600 mb-1">
                                    ID: {item.paymentId}
                                  </p>
                                  <p className="text-red-600 font-medium">
                                    {item.error}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={handleRetryFailed}
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        ลองโหลดรายการที่ล้มเหลวอีกครั้ง
                      </Button>
                      <Button
                        onClick={handleDismissFailedBanner}
                        size="sm"
                        variant="outline"
                        className="border-red-600 text-red-600 hover:bg-red-50"
                      >
                        ปิดการแจ้งเตือน
                      </Button>
                    </div>

                    <p className="text-xs text-red-600 mt-3">
                      💡 <strong>เคล็ดลับ:</strong> ปัญหาอาจเกิดจาก: (1) บิลยังไม่ได้ชำระเงิน (2) ข้อมูลผู้เช่า/ห้องไม่ครบ (3) เครือข่ายไม่เสถียร
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Filters */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input
                      placeholder="ค้นหา (ห้อง, ชื่อผู้เช่า, รายการ...)"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger className="w-full md:w-48">
                        <SelectValue placeholder="เลือกงวดบิล" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        {availableMonths.map(monthKey => {
                          const date = parseISO(`${monthKey}-01`);
                          return (
                            <SelectItem key={monthKey} value={monthKey}>
                              {format(date, 'MMMM yyyy', { locale: th })}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {(searchTerm || selectedMonth !== 'all') && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedMonth('all');
                      }}
                    >
                      ล้างตัวกรอง
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="payments" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="payments">
                <DollarSign className="w-4 h-4 mr-2" />
                ใบเสร็จรับเงิน
              </TabsTrigger>
              <TabsTrigger value="invoices">
                <FileText className="w-4 h-4 mr-2" />
                ใบแจ้งหนี้
              </TabsTrigger>
              <TabsTrigger value="bookings">
                <Home className="w-4 h-4 mr-2" />
                สัญญาเช่า
              </TabsTrigger>
              <TabsTrigger value="deposits">
                <Shield className="w-4 h-4 mr-2" />
                เงินมัดจำ
              </TabsTrigger>
              <TabsTrigger value="expenses">
                <FileText className="w-4 h-4 mr-2" />
                ค่าใช้จ่าย
              </TabsTrigger>
            </TabsList>

            {/* Payments Tab */}
            <TabsContent value="payments" className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <p className="text-sm text-slate-600">
                  พบ {filteredPayments.length} รายการ
                </p>
                {filteredPayments.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAll}
                    className="gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPayments.length === filteredPayments.length && filteredPayments.length > 0}
                      onChange={handleSelectAll}
                      className="w-4 h-4"
                    />
                    เลือกทั้งหมด
                  </Button>
                )}
              </div>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedPayments.length === filteredPayments.length && filteredPayments.length > 0}
                              onChange={handleSelectAll}
                              className="w-4 h-4"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">วันที่</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ห้อง</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ผู้เช่า</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">เบอร์โทร</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ค่าเช่า</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ค่าไฟ</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ค่าน้ำ</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">อื่นๆ</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ค่าปรับ</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">รวม</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">สถานะ</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">วิธีชำระ</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">สลิป</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">ใบเสร็จ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredPayments.map((payment) => {
                          const room = roomsMap.get(payment.room_id);
                          const tenant = tenantsMap.get(payment.tenant_id);
                          const isSelected = selectedPayments.includes(payment.id);
                          
                          const calculatedLateFee = calculateLateFee(payment, configs, selectedBranchId);
                          const displayLateFee = payment.late_fee_amount > 0 ? payment.late_fee_amount : calculatedLateFee;
                          const totalWithLateFee = (payment.total_amount || 0) + (displayLateFee > payment.late_fee_amount ? displayLateFee - payment.late_fee_amount : 0);
                          
                          const paymentMethodLabel = {
                            'cash': '💵 เงินสด',
                            'transfer': '🏦 โอนเงิน',
                            'qr_code': '📱 QR Code'
                          }[payment.payment_method] || 'N/A';
                          
                          return (
                            <tr key={payment.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSelectPayment(payment.id)}
                                  className="w-4 h-4"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm">
                               {payment.payment_date ? (() => { try { const d = parseISO(payment.payment_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yy', { locale: th }); } catch { return '-'; } })() : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium">{room?.room_number || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.full_name || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.phone || '-'}</td>
                              <td className="px-4 py-3 text-sm text-right">{(payment.rent_amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-right">{(payment.electricity_amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-right">{(payment.water_amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-right">
                                {((payment.internet_amount || 0) + (payment.other_amount || 0)).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                                {displayLateFee.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                                {totalWithLateFee.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  payment.status === 'paid' 
                                    ? 'bg-green-100 text-green-700' 
                                    : payment.status === 'overdue'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {payment.status === 'paid' ? 'ชำระแล้ว' : payment.status === 'overdue' ? 'เกินกำหนด' : 'รอชำระ'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {payment.status === 'paid' ? (
                                  <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                                    {paymentMethodLabel}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                {payment.payment_slip_url ? (
                                  <a 
                                    href={payment.payment_slip_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    <Camera className="w-4 h-4" />
                                    ดูสลิป
                                  </a>
                                ) : (
                                  <span className="text-xs text-slate-400">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Link 
                                  to={`${createPageUrl('Receipt')}?paymentId=${payment.id}`}
                                  className="inline-flex items-center gap-1 text-xs text-green-600 hover:text-green-800 hover:underline font-medium"
                                >
                                  <FileText className="w-4 h-4" />
                                  ดูใบเสร็จ
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoices Tab */}
            <TabsContent value="invoices" className="space-y-4">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <p className="text-sm text-slate-600">
                  พบ {filteredInvoices.length} รายการ
                </p>
                {filteredInvoices.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSelectAllInvoices}
                    className="gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                      onChange={handleSelectAllInvoices}
                      className="w-4 h-4"
                    />
                    เลือกทั้งหมด ({selectedInvoices.length})
                  </Button>
                )}
              </div>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                            <input
                              type="checkbox"
                              checked={selectedInvoices.length === filteredInvoices.length && filteredInvoices.length > 0}
                              onChange={handleSelectAllInvoices}
                              className="w-4 h-4"
                            />
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">วันครบกำหนด</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ห้อง</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ผู้เช่า</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">เบอร์โทร</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ค่าเช่า</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ค่าไฟ</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ค่าน้ำ</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">อื่นๆ</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">ค่าปรับ</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">รวม</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">สถานะ</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">ใบแจ้งหนี้</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredInvoices.map((payment) => {
                          const room = roomsMap.get(payment.room_id);
                          const tenant = tenantsMap.get(payment.tenant_id);
                          const isSelected = selectedInvoices.includes(payment.id);
                          
                          const calculatedLateFee = calculateLateFee(payment, configs, selectedBranchId);
                          const displayLateFee = payment.late_fee_amount > 0 ? payment.late_fee_amount : calculatedLateFee;
                          const totalWithLateFee = (payment.total_amount || 0) + (displayLateFee > payment.late_fee_amount ? displayLateFee - payment.late_fee_amount : 0);
                          
                          return (
                            <tr key={payment.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-orange-50' : ''}`}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleSelectInvoice(payment.id)}
                                  className="w-4 h-4"
                                />
                              </td>
                              <td className="px-4 py-3 text-sm">
                               {payment.due_date ? (() => { try { const d = parseISO(payment.due_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yy', { locale: th }); } catch { return '-'; } })() : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium">{room?.room_number || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.full_name || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.phone || '-'}</td>
                              <td className="px-4 py-3 text-sm text-right">{(payment.rent_amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-right">{(payment.electricity_amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-right">{(payment.water_amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-sm text-right">
                                {((payment.internet_amount || 0) + (payment.other_amount || 0)).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-semibold text-red-600">
                                {displayLateFee.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-bold text-orange-600">
                                {totalWithLateFee.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  payment.status === 'paid'
                                    ? 'bg-green-100 text-green-700'
                                    : payment.status === 'overdue' 
                                    ? 'bg-red-100 text-red-700' 
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {payment.status === 'paid' ? 'ชำระแล้ว' : payment.status === 'overdue' ? 'เกินกำหนด' : 'รอชำระ'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Link 
                                  to={`${createPageUrl('Invoice')}?paymentId=${payment.id}`}
                                  className="inline-flex items-center gap-1 text-xs text-orange-600 hover:text-orange-800 hover:underline font-medium"
                                >
                                  <FileText className="w-4 h-4" />
                                  ดูใบแจ้งหนี้
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {filteredInvoices.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600">ไม่มีใบแจ้งหนี้</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bookings Tab */}
            <TabsContent value="bookings" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  พบ {filteredBookings.length} รายการ
                </p>
                {/* Export button moved to PageHeader */}
              </div>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ห้อง</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ผู้เช่า</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">เบอร์โทร</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">วันเริ่มสัญญา</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">วันสิ้นสุด</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">ประเภท</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">มัดจำ</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredBookings.map((booking) => {
                          const room = roomsMap.get(booking.room_id);
                          const tenant = tenantsMap.get(booking.tenant_id);
                          
                          return (
                            <tr key={booking.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm font-medium">{room?.room_number || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.full_name || booking.guest_name || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.phone || booking.guest_phone || '-'}</td>
                              <td className="px-4 py-3 text-sm">
                               {booking.check_in_date ? (() => { try { const d = parseISO(booking.check_in_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yy', { locale: th }); } catch { return '-'; } })() : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                               {booking.check_out_date ? (() => { try { const d = parseISO(booking.check_out_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yy', { locale: th }); } catch { return '-'; } })() : '-'}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                  {booking.booking_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-right">{(booking.deposit_amount || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  booking.status === 'active' ? 'bg-green-100 text-green-700' :
                                  booking.status === 'completed' ? 'bg-blue-100 text-blue-700' :
                                  'bg-red-100 text-red-700'
                                }`}>
                                  {booking.status === 'active' ? 'ใช้งาน' : 
                                   booking.status === 'completed' ? 'เสร็จสิ้น' : 'ยกเลิก'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Deposits Tab - NEW */}
            <TabsContent value="deposits" className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <Shield className="w-10 h-10 text-white opacity-80" />
                    </div>
                    <p className="text-blue-100 text-sm mb-1">เงินมัดจำที่ถือครองอยู่</p>
                    <p className="text-3xl font-bold">{depositData.totalHeld.toLocaleString('th-TH')}</p>
                    <p className="text-xs text-blue-100 mt-1">บาท ({depositData.totalCount} รายการ)</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <Banknote className="w-10 h-10 text-white opacity-80" />
                    </div>
                    <p className="text-green-100 text-sm mb-1">เงินมัดจำที่คืนแล้ว</p>
                    <p className="text-3xl font-bold">{depositData.totalReturned.toLocaleString('th-TH')}</p>
                    <p className="text-xs text-green-100 mt-1">บาท ({depositData.returnedCount} รายการ)</p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <DollarSign className="w-10 h-10 text-white opacity-80" />
                    </div>
                    <p className="text-purple-100 text-sm mb-1">รวมทั้งหมด</p>
                    <p className="text-3xl font-bold">
                      {(depositData.totalHeld + depositData.totalReturned).toLocaleString('th-TH')}
                    </p>
                    <p className="text-xs text-purple-100 mt-1">
                      บาท ({depositData.totalCount + depositData.returnedCount} รายการ)
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  พบ {filteredDeposits.length} รายการที่กำลังถือครองอยู่
                </p>
                {/* Export button moved to PageHeader */}
              </div>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ห้อง</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ผู้เช่า</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">เบอร์โทร</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">วันเริ่มสัญญา</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">เงินมัดจำ</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredDeposits.map((booking) => {
                          const room = roomsMap.get(booking.room_id);
                          const tenant = tenantsMap.get(booking.tenant_id);
                          
                          return (
                            <tr key={booking.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm font-medium">{room?.room_number || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.full_name || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.phone || '-'}</td>
                              <td className="px-4 py-3 text-sm">
                               {booking.check_in_date ? (() => { try { const d = parseISO(booking.check_in_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })() : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm text-right font-bold text-blue-600">
                                {(booking.deposit_amount || 0).toLocaleString()} ฿
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  size="sm"
                                  onClick={() => handleReturnDeposit(booking)}
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                  disabled={returnDepositMutation.isPending}
                                >
                                  <Banknote className="w-4 h-4 mr-1" />
                                  คืนเงินมัดจำ
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {filteredDeposits.length === 0 && (
                    <div className="text-center py-12">
                      <Shield className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-600">ไม่มีเงินมัดจำที่กำลังถือครองอยู่</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">💡 หมายเหตุ:</h4>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc ml-5">
                    <li>ระบบแสดงเฉพาะเงินมัดจำของสัญญารายเดือนที่ยังมีสถานะ "ใช้งาน"</li>
                    <li>เมื่อคืนเงินมัดจำ สถานะสัญญาจะเปลี่ยนเป็น "เสร็จสิ้น"</li>
                    <li>สามารถ Export ข้อมูลเงินมัดจำเพื่อเทียบกับบัญชีธนาคารได้</li>
                    <li>ควรเก็บเงินมัดจำในบัญชีธนาคารแยกเพื่อความโปร่งใส</li>
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Expenses Tab */}
            <TabsContent value="expenses" className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm text-slate-600">
                  พบ {filteredExpenses.length} รายการ
                </p>
                {/* Export button moved to PageHeader */}
              </div>

              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">วันที่</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">รายการ</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ประเภท</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">รายละเอียด</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">จำนวนเงิน</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">ใบเสร็จ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredExpenses.map((expense) => (
                          <tr key={expense.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-sm">
                              {expense.date ? (() => { try { const d = parseISO(expense.date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yy', { locale: th }); } catch { return '-'; } })() : '-'}
                            </td>
                            <td className="px-4 py-3 text-sm font-medium">{expense.title || '-'}</td>
                            <td className="px-4 py-3 text-sm">
                              <span className="px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                                {expense.category || '-'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{expense.description || '-'}</td>
                            <td className="px-4 py-3 text-sm text-right font-bold text-red-600">
                              {(expense.amount || 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {expense.receipt_image ? (
                                <a 
                                  href={expense.receipt_image} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  <Camera className="w-4 h-4" />
                                  ดูใบเสร็จ
                                </a>
                              ) : (
                                <span className="text-xs text-slate-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Receipt/Invoice Links Dialog */}
          <Dialog open={showReceiptLinks} onOpenChange={setShowReceiptLinks}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  เลือก{activeTab === 'invoices' ? 'ใบแจ้งหนี้' : 'ใบเสร็จ'}ที่ต้องการเปิด ({activeTab === 'invoices' ? selectedInvoices.length : selectedPayments.length} รายการ)
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {(activeTab === 'invoices' ? selectedInvoices : selectedPayments).map((paymentId) => {
                  const payment = payments.find(p => p.id === paymentId);
                  if (!payment) return null;
                  const room = roomsMap.get(payment.room_id);
                  const tenant = tenantsMap.get(payment.tenant_id);
                  const pageName = activeTab === 'invoices' ? 'Invoice' : 'Receipt';
                  const url = `${window.location.origin}${createPageUrl(pageName)}?paymentId=${paymentId}`;
                  
                  return (
                    <Card key={paymentId} className="p-3 hover:bg-slate-50">
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            ห้อง {room?.room_number || 'N/A'} - {tenant?.full_name || 'N/A'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {activeTab === 'invoices' 
                              ? (payment.due_date ? (() => { try { const d = parseISO(payment.due_date); return isNaN(d.getTime()) ? 'N/A' : `ครบกำหนด: ${format(d, 'd MMMM yyyy', { locale: th })}`; } catch { return 'N/A'; } })() : 'N/A')
                              : (payment.payment_date ? (() => { try { const d = parseISO(payment.payment_date); return isNaN(d.getTime()) ? 'N/A' : format(d, 'd MMMM yyyy', { locale: th }); } catch { return 'N/A'; } })() : 'N/A')
                            }
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard.writeText(url);
                              toast.success('คัดลอกลิงก์แล้ว');
                            }}
                          >
                            คัดลอก
                          </Button>
                          <Link to={`${createPageUrl(pageName)}?paymentId=${paymentId}`} target="_blank">
                            <Button size="sm" className={activeTab === 'invoices' ? "bg-orange-600 hover:bg-orange-700" : "bg-green-600 hover:bg-green-700"}>
                              เปิด{activeTab === 'invoices' ? 'ใบแจ้งหนี้' : 'ใบเสร็จ'}
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    const selectedIds = activeTab === 'invoices' ? selectedInvoices : selectedPayments;
                    const pageName = activeTab === 'invoices' ? 'Invoice' : 'Receipt';
                    const allUrls = selectedIds
                      .map(id => {
                          const payment = payments.find(p => p.id === id);
                          const room = roomsMap.get(payment?.room_id);
                          return `ห้อง ${room?.room_number || 'N/A'}: ${window.location.origin}${createPageUrl(pageName)}?paymentId=${id}`;
                      })
                      .join('\n');
                    navigator.clipboard.writeText(allUrls);
                    toast.success('คัดลอกลิงก์ทั้งหมดแล้ว');
                  }}
                >
                  คัดลอกทั้งหมด
                </Button>
                <Button onClick={() => setShowReceiptLinks(false)}>
                  ปิด
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Deposit Return Dialog - NEW */}
          <Dialog open={showDepositReturnDialog} onOpenChange={setShowDepositReturnDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>คืนเงินมัดจำ</DialogTitle>
              </DialogHeader>
              {selectedDeposit && (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-lg p-4">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-slate-600">ห้อง:</div>
                      <div className="font-semibold">
                        {roomsMap.get(selectedDeposit.room_id)?.room_number || '-'}
                      </div>
                      <div className="text-slate-600">ผู้เช่า:</div>
                      <div className="font-semibold">
                        {tenantsMap.get(selectedDeposit.tenant_id)?.full_name || '-'}
                      </div>
                      <div className="text-slate-600">เงินมัดจำ:</div>
                      <div className="font-semibold text-blue-600">
                        {selectedDeposit.deposit_amount.toLocaleString()} ฿
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label>จำนวนเงินที่คืน (บาท) *</Label>
                    <Input
                      type="number"
                      value={returnAmount}
                      onChange={(e) => setReturnAmount(e.target.value)}
                      placeholder="0"
                      className="mt-1"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      สามารถคืนน้อยกว่าเงินมัดจำได้ (กรณีหักค่าเสียหาย)
                    </p>
                  </div>

                  <div>
                    <Label>หมายเหตุ</Label>
                    <Input
                      value={returnNotes}
                      onChange={(e) => setReturnNotes(e.target.value)}
                      placeholder="เช่น หักค่าซ่อมแซม 500 บาท"
                      className="mt-1"
                    />
                  </div>

                  {parseFloat(returnAmount) < selectedDeposit.deposit_amount && returnAmount && (
                    <Card className="bg-yellow-50 border-yellow-200">
                      <CardContent className="p-3">
                        <p className="text-sm text-yellow-800">
                          <span className="font-semibold">⚠️ หักเงิน:</span> {' '}
                          {(selectedDeposit.deposit_amount - parseFloat(returnAmount)).toLocaleString()} บาท
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDepositReturnDialog(false);
                        setSelectedDeposit(null);
                        setReturnAmount('');
                        setReturnNotes('');
                      }}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      onClick={handleSubmitReturn}
                      disabled={returnDepositMutation.isPending}
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                    >
                      {returnDepositMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          กำลังดำเนินการ...
                        </>
                      ) : (
                        <>
                          <Banknote className="w-4 h-4 mr-2" />
                          ยืนยันคืนเงินมัดจำ
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}