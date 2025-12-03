import React, { useState, useMemo, useEffect } from "react"; // Added useEffect
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Download, Search, Calendar, DollarSign, Home, Camera, Shield, Banknote, AlertTriangle, RefreshCw, Database } from "lucide-react"; // Added AlertTriangle, RefreshCw, Database
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "../components/shared/PageHeader"; // Added PageHeader import

export default function AccountingData() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');
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

  // Shared retry config
  const retryConfig = {
    retry: 0, // Changed retry to 0
    retryDelay: 0, // Changed retryDelay to 0
  };

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
        setSelectedBranchName(currentBranch.name);
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

  // ✅ เพิ่ม limit เป็น 1000
  const { data: payments = [], isLoading: paymentsLoading, isFetching: paymentsFetching } = useQuery({
    queryKey: ['payments', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allPayments = await base44.entities.Payment.list('-payment_date', 1000);
      return allPayments.filter(payment => payment.branch_id === selectedBranchId);
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // ✅ เพิ่ม limit เป็น 500
  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allBookings = await base44.entities.Booking.list('-created_date', 500);
      return allBookings.filter(booking => booking.branch_id === selectedBranchId);
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // ✅ เพิ่ม limit เป็น 1000
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allRooms = await base44.entities.Room.list('-room_number', 1000);
      return allRooms.filter(room => room.branch_id === selectedBranchId);
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // ✅ เพิ่ม limit เป็น 500
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allTenants = await base44.entities.Tenant.list('-created_date', 500);
      return allTenants.filter(tenant => tenant.branch_id === selectedBranchId);
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // ✅ เพิ่ม limit เป็น 500
  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allExpenses = await base44.entities.Expense.list('-date', 500);
      return allExpenses.filter(expense => expense.branch_id === selectedBranchId);
    },
    enabled: !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // ฟังก์ชันกรองข้อมูล - แสดงทุก payment ไม่ว่าจะชำระหรือยัง
  const filteredPayments = useMemo(() => {
    return payments
      .filter(payment => {
        const room = rooms.find(r => r.id === payment.room_id);
        const tenant = tenants.find(t => t.id === payment.tenant_id);
        
        const matchSearch = !searchTerm || 
          room?.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tenant?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchDate = !dateFilter || 
          payment.payment_date?.startsWith(dateFilter) ||
          payment.due_date?.startsWith(dateFilter);
        
        return matchSearch && matchDate;
      })
      .sort((a, b) => {
        // เรียงตามวันที่ชำระ (ถ้ามี) หรือวันครบกำหนด
        const dateA = a.payment_date || a.due_date || a.created_date;
        const dateB = b.payment_date || b.due_date || b.created_date;
        return new Date(dateB) - new Date(dateA);
      });
  }, [payments, rooms, tenants, searchTerm, dateFilter]);

  // ฟังก์ชันกรองใบแจ้งหนี้ - แสดงเฉพาะที่ยังไม่ชำระ
  const filteredInvoices = useMemo(() => {
    return payments
      .filter(payment => payment.status === 'pending' || payment.status === 'overdue')
      .filter(payment => {
        const room = rooms.find(r => r.id === payment.room_id);
        const tenant = tenants.find(t => t.id === payment.tenant_id);
        
        const matchSearch = !searchTerm || 
          room?.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          tenant?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchDate = !dateFilter || 
          payment.due_date?.startsWith(dateFilter);
        
        return matchSearch && matchDate;
      });
  }, [payments, rooms, tenants, searchTerm, dateFilter]);

  const filteredBookings = useMemo(() => {
    return bookings.filter(booking => {
      const room = rooms.find(r => r.id === booking.room_id);
      const tenant = tenants.find(t => t.id === booking.tenant_id);
      
      const matchSearch = !searchTerm || 
        room?.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        booking.guest_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchDate = !dateFilter || 
        booking.check_in_date?.startsWith(dateFilter);
      
      return matchSearch && matchDate;
    });
  }, [bookings, rooms, tenants, searchTerm, dateFilter]);

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
      const room = rooms.find(r => r.id === booking.room_id);
      const tenant = tenants.find(t => t.id === booking.tenant_id);
      
      const matchSearch = !searchTerm || 
        room?.room_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchSearch;
    });
  }, [depositData.activeDeposits, rooms, tenants, searchTerm]);

  // Mutation สำหรับคืนเงินมัดจำ
  const returnDepositMutation = useMutation({
    mutationFn: async ({ bookingId, returnAmount, notes }) => {
      // อัปเดตสถานะ booking เป็น completed
      await base44.entities.Booking.update(bookingId, {
        status: 'completed',
        notes: `${notes || ''}\nคืนเงินมัดจำ: ${format(new Date(), 'd/M/yyyy HH:mm', { locale: th })} จำนวน ${returnAmount} บาท` // Changed to show amount in notes
      });
      
      return { bookingId, returnAmount, notes };
    },
    onSuccess: async (data) => {
      const booking = bookings.find(b => b.id === data.bookingId);
      const room = rooms.find(r => r.id === booking?.room_id);
      const tenant = tenants.find(t => t.id === booking?.tenant_id);

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
      queryClient.invalidateQueries(['activityLogs']);
      toast.success('คืนเงินมัดจำสำเร็จ');
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

  // ฟังก์ชันเปิดใบเสร็จทั้งหมด
  const handleOpenAllReceipts = () => {
    if (selectedPayments.length === 0) {
      toast.error('กรุณาเลือกรายการก่อน');
      return;
    }

    if (selectedPayments.length === 1) {
      // ถ้าเลือกแค่ 1 รายการ เปิดในหน้าเดียวกันเลย
      navigate(`${createPageUrl('Receipt')}?paymentId=${selectedPayments[0]}`);
      // Removed toast.success('เปิดใบเสร็จแล้ว'); as per outline
    } else {
      // ถ้าเลือกหลายรายการ แสดง dialog ให้เลือกทีละรายการ
      setShowReceiptLinks(true);
      toast.info(`มี ${selectedPayments.length} ใบเสร็จให้เลือกเปิด`);
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
    if (selectedPayments.length === 0) {
      toast.error('กรุณาเลือกรายการก่อน');
      return;
    }

    // บันทึกประวัติ
    try {
      const roomNumbers = selectedPayments.map(paymentId => {
        const payment = payments.find(p => p.id === paymentId);
        const room = rooms.find(r => r.id === payment?.room_id);
        return room?.room_number || 'N/A';
      }).join(', ');

      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'create',
        entity_type: 'Receipt',
        entity_id: `receipts_${Date.now()}`,
        entity_name: `ใบเสร็จ/ใบแจ้งหนี้ ${selectedPayments.length} รายการ`,
        user_email: currentUser?.email || 'unknown',
        user_name: currentUser?.full_name || 'ไม่ระบุ',
        description: `พิมพ์/บันทึก PDF ${selectedPayments.length} รายการ (ห้อง: ${roomNumbers})`,
        changes: { count: selectedPayments.length, payment_ids: selectedPayments }
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
    }

    // เปิดทุกรายการที่เลือก (ไม่จำกัดเฉพาะที่ชำระแล้ว)
    const paymentIdsString = selectedPayments.join(',');
    navigate(`${createPageUrl('PrintReceipts')}?paymentIds=${paymentIdsString}`);
  };

  // ฟังก์ชัน Export ข้อมูล (All filtered payments)
  const exportPayments = async () => {
    try {
      const data = filteredPayments.map(payment => {
        const room = rooms.find(r => r.id === payment.room_id);
        const tenant = tenants.find(t => t.id === payment.tenant_id);
        
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
          'รวม': payment.total_amount || 0,
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
        if (!payment) return null; // Should not happen if selectedPayments are valid IDs

        const room = rooms.find(r => r.id === payment.room_id);
        const tenant = tenants.find(t => t.id === payment.tenant_id);
        
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
          'รวม': payment.total_amount || 0,
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
        const room = rooms.find(r => r.id === booking.room_id);
        const tenant = tenants.find(t => t.id === booking.tenant_id);
        
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
        const room = rooms.find(r => r.id === payment.room_id);
        const tenant = tenants.find(t => t.id === payment.tenant_id);
        
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
          'รวม': payment.total_amount || 0,
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
        const room = rooms.find(r => r.id === booking.room_id);
        const tenant = tenants.find(t => t.id === booking.tenant_id);
        
        return {
          'ห้อง': room?.room_number || '-',
          'ผู้เช่า': tenant?.full_name || '-',
          'เบอร์โทร': tenant?.phone || '-',
          'วันเริ่มสัญญา': booking.check_in_date ? format(parseISO(booking.check_in_date), 'd/M/yyyy', { locale: th }) : '-',
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
          {/* Action buttons previously in header */}
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              onClick={handlePrintAllReceipts}
              disabled={selectedPayments.length === 0}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
            >
              <Download className="w-4 h-4 mr-2" />
              📄 พิมพ์/บันทึก PDF ({selectedPayments.length})
            </Button>
            <Button
              onClick={handleOpenAllReceipts}
              disabled={selectedPayments.length === 0}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              {selectedPayments.length === 1 ? 'เปิดใบเสร็จ' : `เลือกใบเสร็จ (${selectedPayments.length})`}
            </Button>
          </div>

          {/* ✅ Failed Receipts Banner */}
          {showFailedBanner && failedReceipts.length > 0 && (
            <Card className="bg-red-50 border-2 border-red-200 shadow-lg">
              <CardContent className="p-4">
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
              </CardContent>
            </Card>
          )}

          {/* Filters */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
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
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type="month"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="pl-10 w-full md:w-48"
                  />
                </div>
                {(searchTerm || dateFilter) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchTerm('');
                      setDateFilter('');
                    }}
                  >
                    ล้างตัวกรอง
                  </Button>
                )}
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
                  พบ {filteredPayments.length} รายการ (ทั้งหมด)
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
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">รวม</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">สถานะ</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">วิธีชำระ</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">สลิป</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">ใบเสร็จ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredPayments.map((payment) => {
                          const room = rooms.find(r => r.id === payment.room_id);
                          const tenant = tenants.find(t => t.id === payment.tenant_id);
                          const isSelected = selectedPayments.includes(payment.id);
                          
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
                                {payment.payment_date ? format(parseISO(payment.payment_date), 'd MMM yy', { locale: th }) : '-'}
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
                              <td className="px-4 py-3 text-sm text-right font-bold text-green-600">
                                {(payment.total_amount || 0).toLocaleString()}
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
                  พบ {filteredInvoices.length} รายการ (ยังไม่ชำระ)
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
                          <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">รวม</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">สถานะ</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">ใบแจ้งหนี้</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredInvoices.map((payment) => {
                          const room = rooms.find(r => r.id === payment.room_id);
                          const tenant = tenants.find(t => t.id === payment.tenant_id);
                          const isSelected = selectedInvoices.includes(payment.id);
                          
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
                                {payment.due_date ? format(parseISO(payment.due_date), 'd MMM yy', { locale: th }) : '-'}
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
                              <td className="px-4 py-3 text-sm text-right font-bold text-orange-600">
                                {(payment.total_amount || 0).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  payment.status === 'overdue' 
                                    ? 'bg-red-100 text-red-700' 
                                    : 'bg-yellow-100 text-yellow-700'
                                }`}>
                                  {payment.status === 'overdue' ? 'เกินกำหนด' : 'รอชำระ'}
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
                      <p className="text-slate-600">ไม่มีใบแจ้งหนี้ที่รอชำระ</p>
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
                          const room = rooms.find(r => r.id === booking.room_id);
                          const tenant = tenants.find(t => t.id === booking.tenant_id);
                          
                          return (
                            <tr key={booking.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm font-medium">{room?.room_number || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.full_name || booking.guest_name || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.phone || booking.guest_phone || '-'}</td>
                              <td className="px-4 py-3 text-sm">
                                {booking.check_in_date ? format(parseISO(booking.check_in_date), 'd MMM yy', { locale: th }) : '-'}
                              </td>
                              <td className="px-4 py-3 text-sm">
                                {booking.check_out_date ? format(parseISO(booking.check_out_date), 'd MMM yy', { locale: th }) : '-'}
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
                          const room = rooms.find(r => r.id === booking.room_id);
                          const tenant = tenants.find(t => t.id === booking.tenant_id);
                          
                          return (
                            <tr key={booking.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-sm font-medium">{room?.room_number || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.full_name || '-'}</td>
                              <td className="px-4 py-3 text-sm">{tenant?.phone || '-'}</td>
                              <td className="px-4 py-3 text-sm">
                                {booking.check_in_date ? format(parseISO(booking.check_in_date), 'd MMM yyyy', { locale: th }) : '-'}
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
                              {expense.date ? format(parseISO(expense.date), 'd MMM yy', { locale: th }) : '-'}
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

          {/* Receipt Links Dialog */}
          <Dialog open={showReceiptLinks} onOpenChange={setShowReceiptLinks}>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>เลือกใบเสร็จที่ต้องการเปิด ({selectedPayments.length} รายการ)</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {selectedPayments.map((paymentId) => {
                  const payment = payments.find(p => p.id === paymentId);
                  if (!payment) return null;
                  const room = rooms.find(r => r.id === payment.room_id);
                  const tenant = tenants.find(t => t.id === payment.tenant_id);
                  const url = `${window.location.origin}${createPageUrl('Receipt')}?paymentId=${paymentId}`;
                  
                  return (
                    <Card key={paymentId} className="p-3 hover:bg-slate-50">
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex-1">
                          <p className="font-semibold text-sm">
                            ห้อง {room?.room_number || 'N/A'} - {tenant?.full_name || 'N/A'}
                          </p>
                          <p className="text-xs text-slate-500">
                            {payment.payment_date ? format(parseISO(payment.payment_date), 'd MMMM yyyy', { locale: th }) : 'N/A'}
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
                          <Link to={`${createPageUrl('Receipt')}?paymentId=${paymentId}`} target="_blank">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                              เปิดใบเสร็จ
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
                    const allUrls = selectedPayments
                      .map(id => {
                          const payment = payments.find(p => p.id === id);
                          const room = rooms.find(r => r.id === payment?.room_id);
                          return `ห้อง ${room?.room_number || 'N/A'}: ${window.location.origin}${createPageUrl('Receipt')}?paymentId=${id}`;
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
                        {rooms.find(r => r.id === selectedDeposit.room_id)?.room_number || '-'}
                      </div>
                      <div className="text-slate-600">ผู้เช่า:</div>
                      <div className="font-semibold">
                        {tenants.find(t => t.id === selectedDeposit.tenant_id)?.full_name || '-'}
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