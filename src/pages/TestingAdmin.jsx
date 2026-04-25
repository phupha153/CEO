import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TestTube, Clock, AlertTriangle, Save, ArrowLeft, Check, CheckCircle, AlertCircle, Zap, Calendar, FileText, Copy, ExternalLink, Trash2, Database, Building2, Users, DoorOpen, Plus, Wallet, Loader2, Send, MessageSquare, Wrench, Gauge, RefreshCw, Sparkles, Terminal, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PageHeader from "../components/shared/PageHeader";
import DeletionProgressDialog from "../components/testing/DeletionProgressDialog";
import TestDataStats from "../components/testing/TestDataStats";
import MassiveLoadDialog from "../components/testing/MassiveLoadDialog";

export default function TestingAdmin() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [generatingBills, setGeneratingBills] = useState(false);
  const [startingOnboarding, setStartingOnboarding] = useState(false);
  const [lastBillGeneration, setLastBillGeneration] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [generatingTestData, setGeneratingTestData] = useState(false);
  const [deletingTestData, setDeletingTestData] = useState(false);
  const [generatingYearlyData, setGeneratingYearlyData] = useState(false);
  const [deletionProgress, setDeletionProgress] = useState({
    show: false,
    currentEntity: '',
    currentBatch: 0,
    totalBatches: 0,
    deletedCount: 0,
    totalCount: 0,
    entityBreakdown: {},
    message: '',
    isComplete: false,
    hasError: false
  });

  // Massive Load Dialog State
  const [massiveLoadOpen, setMassiveLoadOpen] = useState(false);
  const [massiveLoadProgress, setMassiveLoadProgress] = useState(0);
  const [massiveLoadStatus, setMassiveLoadStatus] = useState('idle');
  const [massiveLoadMessage, setMassiveLoadMessage] = useState('');
  const [massiveLoadResults, setMassiveLoadResults] = useState(null);
  
  // Massive Load Form State
  const [massiveLoadForm, setMassiveLoadForm] = useState({
    branchCount: 50,
    roomsPerBranch: 50,
    yearsToGenerate: 3,
    createRooms: true,
    createTenants: true,
    createBookings: true,
    createPayments: true,
    createMeterReadings: true,
    createMaintenance: true
  });

  const [generationProgress, setGenerationProgress] = useState({
    show: false,
    current: 0,
    total: 0,
    message: '',
    details: []
  });

  const [testDataForm, setTestDataForm] = useState({
    entityType: 'CompleteSet',
    quantity: 10,
    branchId: 'current'
  });

  const [yearlyDataForm, setYearlyDataForm] = useState({
    roomsPerBranch: 10,
    branchId: 'current'
  });

  const [testLineUserId, setTestLineUserId] = useState('');
  const [testingReminders, setTestingReminders] = useState(false);
  
  // Custom Delete State
  const [customDeleteForm, setCustomDeleteForm] = useState({
    branchId: 'current',
    entityTypes: {
      Payment: true,
      MeterReading: true,
      Booking: false,
      Tenant: false,
      Room: false,
      MaintenanceRequest: true,
      Expense: true,
      Contract: false,
      MaterialDelivery: true
    }
  });

  const [testDataDeleteForm, setTestDataDeleteForm] = useState({
    branchId: 'current'
  });
  const [deletingTestDataByBranch, setDeletingTestDataByBranch] = useState(false);
  const [testDataDeleteProgress, setTestDataDeleteProgress] = useState({
    current: '',
    deleted: 0,
    total: 0,
    breakdown: {}
  });
  const [customDeleting, setCustomDeleting] = useState(false);
  const [customDeleteProgress, setCustomDeleteProgress] = useState({
    current: '',
    deleted: 0,
    total: 0,
    breakdown: {}
  });

  const { data: billGenerationLogs = [], refetch: refetchBillLogs } = useQuery({
    queryKey: ['functionLogs', 'generateMonthlyBills'],
    queryFn: () => base44.entities.FunctionLog.filter({ function_name: 'generateMonthlyBills' }, '-run_timestamp', 5),
    staleTime: 5000,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: configs = [], refetch: refetchConfigs } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    retry: 0,
    retryDelay: 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: false,
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['allPaymentsTestingAdmin'],
    queryFn: () => base44.entities.Payment.list('-created_date', 5000),
    retry: 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: allBookings = [] } = useQuery({
    queryKey: ['allBookingsTestingAdmin'],
    queryFn: () => base44.entities.Booking.filter({ status: 'active' }, '-created_date', 5000),
    retry: 0,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    retry: 0,
    retryDelay: 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const { data: allRooms = [], isLoading: isLoadingAllRooms } = useQuery({
    queryKey: ['allRoomsDebug'],
    queryFn: () => base44.entities.Room.list(),
    retry: 0,
    retryDelay: 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const { data: allTenants = [], isLoading: isLoadingAllTenants } = useQuery({
    queryKey: ['allTenantsDebugTestingAdmin'],
    queryFn: () => base44.entities.Tenant.list('-created_date'),
    retry: 0,
    retryDelay: 0,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const selectedBranchId = localStorage.getItem('selected_branch_id');

  const roomsWithoutBranch = allRooms.filter(room => !room.branch_id);

  const tenantsWithoutBranch = allTenants.filter(t => !t.branch_id);
  const tenantsWithWrongBranch = allTenants.filter(t =>
    t.branch_id && t.branch_id !== selectedBranchId && t.branch_id.length < 20
  );
  const tenantsWithProblems = [...tenantsWithoutBranch, ...tenantsWithWrongBranch];

  console.log('🔍 Debug Tenants (TestingAdmin - Updated):', {
    totalTenants: allTenants.length,
    selectedBranchId: selectedBranchId,
    tenantsWithoutBranch: tenantsWithoutBranch.length,
    tenantsWithWrongBranch: tenantsWithWrongBranch.length,
    tenantsWithProblems: tenantsWithProblems.length,
    sampleTenant: allTenants[0],
    allTenantsIds: allTenants.map(t => ({ id: t.id, name: t.full_name, branch_id: t.branch_id })).slice(0, 3)
  });

  const [settings, setSettings] = useState({
    test_mode_enabled: 'false',
    test_current_date: ''
  });

  useEffect(() => {
    if (configs.length > 0) {
      const newSettings = {
        test_mode_enabled: configs.find(c => c.key === 'test_mode_enabled')?.value || 'false',
        test_current_date: configs.find(c => c.key === 'test_current_date')?.value || ''
      };
      setSettings(newSettings);
    }
  }, [configs]);

  const createOrUpdateMutation = useMutation({
    mutationFn: async (data) => {
      const existing = configs.find(c => c.key === data.key);
      if (existing) {
        return base44.entities.Config.update(existing.id, data);
      } else {
        return base44.entities.Config.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['configs']);
    },
  });

  const handleSave = async () => {
    try {
      const configsToSave = [
        {
          key: 'test_mode_enabled',
          value: settings.test_mode_enabled,
          value_type: 'string',
          description: 'เปิดใช้งานโหมดทดสอบ',
          category: 'general'
        },
        {
          key: 'test_current_date',
          value: settings.test_current_date,
          value_type: 'string',
          description: 'วันที่สำหรับทดสอบระบบ',
          category: 'general'
        }
      ];

      await Promise.all(configsToSave.map(config => createOrUpdateMutation.mutateAsync(config)));

      setSavedSuccess(true);
      toast.success('บันทึกการตั้งค่าทดสอบสำเร็จ');

      setTimeout(() => {
        setSavedSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึก');
    }
  };

  // ⭐ ตรวจสอบห้องที่มีบิลแล้วสำหรับเดือนนี้
  const getRoomsWithExistingBills = useMemo(() => {
    const now = new Date();
    const payDay = parseInt(configs.find(c => c.key === 'pay_day' && !c.branch_id)?.value || '5');
    const genDay = parseInt(configs.find(c => c.key === 'bill_generation_day' && !c.branch_id)?.value || '25');
    
    let dueMonth = now.getMonth();
    let dueYear = now.getFullYear();
    
    // ถ้าวันสร้างบิล > วันครบกำหนด = บิลจะเป็นเดือนถัดไป
    if (genDay > payDay) {
      dueMonth = now.getMonth() + 1;
      if (dueMonth > 11) {
        dueMonth = 0;
        dueYear = now.getFullYear() + 1;
      }
    }
    
    // หาห้องที่มี booking active
    const roomsWithBooking = allBookings.map(b => b.room_id);
    
    // หาห้องที่มีบิลแล้ว (โดยเช็คจาก due_date)
    const roomsWithBill = allPayments.filter(p => {
      if (!p.due_date || !p.room_id) return false;
      try {
        const due = new Date(p.due_date);
        return due.getMonth() === dueMonth && due.getFullYear() === dueYear;
      } catch {
        return false;
      }
    }).map(p => p.room_id);
    
    // ห้องที่มี booking แต่ยังไม่มีบิล
    const roomsNeedBill = roomsWithBooking.filter(rId => !roomsWithBill.includes(rId));
    
    return {
      roomsWithBill: roomsWithBill.length,
      roomsNeedBill: roomsNeedBill.length,
      totalRoomsWithBooking: roomsWithBooking.length,
      dueMonth: dueMonth + 1, // แสดงเป็น 1-12
      dueYear
    };
  }, [allPayments, allBookings, configs]);

  // ⭐ คำนวณสาขาที่มีบิลเดือนนี้แล้ว (แยกตามสาขา)
  const branchesWithBillsThisMonth = useMemo(() => {
    const now = new Date();
    const payDay = parseInt(configs.find(c => c.key === 'pay_day' && !c.branch_id)?.value || '5');
    const genDay = parseInt(configs.find(c => c.key === 'bill_generation_day' && !c.branch_id)?.value || '25');
    
    let dueMonth = now.getMonth();
    let dueYear = now.getFullYear();
    
    if (genDay > payDay) {
      dueMonth = now.getMonth() + 1;
      if (dueMonth > 11) {
        dueMonth = 0;
        dueYear = now.getFullYear() + 1;
      }
    }
    
    // Group by branch
    const branchInfoMap = new Map();
    
    branches.forEach(branch => {
      const branchBookings = allBookings.filter(b => b.branch_id === branch.id);
      const roomsWithBooking = branchBookings.map(b => b.room_id);
      
      const branchPaymentsThisMonth = allPayments.filter(p => {
        if (p.branch_id !== branch.id || !p.due_date || !p.room_id) return false;
        try {
          const due = new Date(p.due_date);
          return due.getMonth() === dueMonth && due.getFullYear() === dueYear;
        } catch {
          return false;
        }
      });
      
      const roomsWithBill = branchPaymentsThisMonth.map(p => p.room_id);
      const uniqueRoomsWithBill = [...new Set(roomsWithBill)];
      
      if (uniqueRoomsWithBill.length > 0) {
        branchInfoMap.set(branch.id, {
          branchId: branch.id,
          branchName: branch.branch_name,
          roomsWithBill: uniqueRoomsWithBill.length,
          totalRoomsWithBooking: roomsWithBooking.length,
          dueMonth: dueMonth + 1,
          dueYear
        });
      }
    });
    
    return Array.from(branchInfoMap.values());
  }, [allPayments, allBookings, branches, configs]);

  const handleGenerateBills = async () => {
    setGeneratingBills(true);
    try {
      const response = await base44.functions.invoke('generateMonthlyBills', {
        force: false, // ⭐ เช็ควันที่ก่อนสร้างบิล (เหมือน Cron Job จริง)
        branch_id: selectedBranchId
      });

      console.log('Bill generation response:', response.data);

      if (response.data.success) {
        setLastBillGeneration(response.data);
        toast.success(response.data.message);

        await queryClient.invalidateQueries(['payments']);
        await queryClient.invalidateQueries(['allPaymentsTestingAdmin']);
        await refetchBillLogs();
      } else {
        toast.error(response.data.message || 'เกิดข้อผิดพลาดในการสร้างบิล');
      }
    } catch (error) {
      console.error('Error generating bills:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้างบิล: ' + error.message);
    }
    setGeneratingBills(false);
  };

  const handleGenerateAllBranchesBills = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการสร้างบิลสำหรับทุกสาขา?\n\nการกระทำนี้จะสร้างบิลสำหรับห้องที่มีผู้เช่าทั้งหมดในทุกสาขา')) {
      return;
    }

    setGeneratingBills(true);
    try {
      const response = await base44.functions.invoke('generateMonthlyBills', {
        force: false, // ⭐ เช็ควันที่ก่อนสร้างบิล (เหมือน Cron Job จริง)
      });

      console.log('All branches bill generation response:', response.data);

      if (response.data.success) {
        setLastBillGeneration(response.data);
        toast.success(response.data.message);

        await queryClient.invalidateQueries(['payments']);
        await queryClient.invalidateQueries(['allPaymentsTestingAdmin']);
        await refetchBillLogs();
      } else {
        toast.error(response.data.message || 'เกิดข้อผิดพลาดในการสร้างบิล');
      }
    } catch (error) {
      console.error('Error generating bills:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้างบิล: ' + error.message);
    }
    setGeneratingBills(false);
  };

  const handleResetTestDate = () => {
    setSettings({ ...settings, test_current_date: '', test_mode_enabled: 'false' });
  };

  const handleSetTestDateToday = () => {
    const today = new Date().toISOString().split('T')[0];
    setSettings({ ...settings, test_current_date: today, test_mode_enabled: 'true' });
  };

  const getCurrentTestDate = () => {
    if (settings.test_mode_enabled === 'true' && settings.test_current_date) {
      try {
        return format(parseISO(settings.test_current_date), 'd MMMM yyyy', { locale: th });
      } catch {
        return 'ไม่ถูกต้อง';
      }
    }
    return 'ปิดใช้งาน';
  };

  const billGenerationDay = useMemo(() => 
    configs.find(c => c.key === 'bill_generation_day')?.value || '27',
    [configs]
  );
  const billDueDay = useMemo(() => 
    configs.find(c => c.key === 'bill_due_day')?.value || '5',
    [configs]
  );
  const advanceNoticeDays = useMemo(() => 
    configs.find(c => c.key === 'bill_advance_notice_days')?.value || '3',
    [configs]
  );

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอก URL แล้ว');
  };

  // ⭐ ลบข้อมูลแบบกำหนดเอง (เลือกสาขา + เลือก Entity)
  const handleCustomDelete = async () => {
    const selectedEntities = Object.entries(customDeleteForm.entityTypes)
      .filter(([_, checked]) => checked)
      .map(([name]) => name);
    
    if (selectedEntities.length === 0) {
      toast.error('กรุณาเลือกประเภทข้อมูลที่ต้องการลบอย่างน้อย 1 รายการ');
      return;
    }
    
    const branchName = customDeleteForm.branchId === 'current' 
      ? localStorage.getItem('selected_branch_name') 
      : customDeleteForm.branchId === 'all' 
        ? 'ทุกสาขา' 
        : branches.find(b => b.id === customDeleteForm.branchId)?.branch_name || 'ไม่ทราบ';
    
    const entityLabels = {
      Payment: 'การชำระเงิน',
      MeterReading: 'บันทึกมิเตอร์',
      Booking: 'การจอง',
      Tenant: 'ผู้เช่า',
      Room: 'ห้องพัก',
      MaintenanceRequest: 'แจ้งซ่อม',
      Expense: 'ค่าใช้จ่าย',
      Contract: 'สัญญา',
      MaterialDelivery: 'พัสดุ'
    };
    
    const selectedLabels = selectedEntities.map(e => entityLabels[e] || e).join(', ');
    
    if (!confirm(`⚠️ ยืนยันการลบข้อมูล\n\nสาขา: ${branchName}\nข้อมูลที่จะลบ: ${selectedLabels}\n\n** การกระทำนี้ไม่สามารถย้อนกลับได้ **`)) {
      return;
    }
    
    setCustomDeleting(true);
    setCustomDeleteProgress({ current: 'เริ่มต้น...', deleted: 0, total: 0, breakdown: {} });
    
    const branchFilter = customDeleteForm.branchId === 'all' 
      ? {} 
      : { branch_id: customDeleteForm.branchId === 'current' ? selectedBranchId : customDeleteForm.branchId };
    
    let totalDeleted = 0;
    const breakdown = {};
    
    try {
      for (const entityName of selectedEntities) {
        setCustomDeleteProgress(prev => ({ ...prev, current: `กำลังลบ ${entityLabels[entityName]}...` }));
        
        let entityDeleted = 0;
        let hasMore = true;
        
        while (hasMore) {
          const items = await base44.entities[entityName].filter(branchFilter, '-created_date', 500);
          
          if (!items || items.length === 0) {
            hasMore = false;
            break;
          }
          
          // ⭐ ลบทีละรายการเพื่อป้องกัน rate limit
          for (const item of items) {
            try {
              await base44.entities[entityName].delete(item.id);
              entityDeleted++;
              totalDeleted++;
              
              // ⭐ พัก 200ms ระหว่างการลบแต่ละรายการ
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (e) {
              console.warn(`Failed to delete ${entityName} ${item.id}:`, e.message);
            }
          }
          
          setCustomDeleteProgress(prev => ({
            ...prev,
            deleted: totalDeleted,
            breakdown: { ...prev.breakdown, [entityName]: entityDeleted }
          }));
          
          if (items.length < 500) {
            hasMore = false;
          }
        }
        
        breakdown[entityName] = entityDeleted;
        setCustomDeleteProgress(prev => ({
          ...prev,
          deleted: totalDeleted,
          breakdown: { ...breakdown }
        }));
      }
      
      setCustomDeleteProgress(prev => ({ ...prev, current: 'เสร็จสิ้น!' }));
      toast.success(`ลบข้อมูลสำเร็จ ${totalDeleted.toLocaleString()} รายการ`);
      
      // Invalidate queries
      await queryClient.invalidateQueries();
      
    } catch (error) {
      console.error('Custom delete error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setCustomDeleting(false);
    }
  };

  const handleTestReminders = async (type) => {
    if (!testLineUserId.trim()) {
      toast.error('กรุณากรอก LINE User ID ของคุณก่อน');
      return;
    }

    setTestingReminders(true);
    try {
      let response;
      if (type === 'advance') {
        response = await base44.functions.invoke('sendAdvanceReminders', {
          branch_id: selectedBranchId,
          test_line_user_id: testLineUserId.trim()
        });
      } else {
        response = await base44.functions.invoke('sendDueDateReminders', {
          branch_id: selectedBranchId,
          test_line_user_id: testLineUserId.trim()
        });
      }

      if (response.data.success) {
        toast.success(response.data.message);
      } else {
        toast.error(response.data.error || response.data.message);
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
    setTestingReminders(false);
  };

  const handleResetData = async () => {
    if (!confirm('⚠️ คำเตือนสำคัญ!\n\nคุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทั้งหมดในระบบ?\n\n• การกระทำนี้ไม่สามารถย้อนกลับได้\n• ข้อมูลทั้งหมดจะถูกลบถาวร\n• ควรทำเฉพาะในโหมดทดสอบเท่านั้น\n\nกด OK เพื่อยืนยัน')) {
      return;
    }

    const confirmSecond = prompt('ยืนยันอีกครั้ง: คุณแน่ใจว่าต้องการลบข้อมูลทั้งหมด?\n\nพิมพ์ "DELETE" ในช่องต่อไปเพื่อยืนยัน');
    if (confirmSecond === null || confirmSecond.toUpperCase() !== 'DELETE') {
      toast.error('ยกเลิกการรีเซ็ตข้อมูล');
      return;
    }

    setResetting(true);

    try {
      const entitiesToDelete = [
        { name: 'Payment', label: 'การชำระเงิน' },
        { name: 'MeterReading', label: 'บันทึกมิเตอร์' },
        { name: 'Contract', label: 'สัญญาเช่า' },
        { name: 'Booking', label: 'การจองห้อง' },
        { name: 'MaintenanceRequest', label: 'คำขอซ่อม' },
        { name: 'Expense', label: 'ค่าใช้จ่าย' },
        { name: 'Tenant', label: 'ผู้เช่า' }
      ];

      let totalDeleted = 0;

      for (const entity of entitiesToDelete) {
        try {
          const records = await base44.entities[entity.name].list('-created_date', 10000);

          for (const record of records) {
            await base44.entities[entity.name].delete(record.id);
            totalDeleted++;
          }

          console.log(`✅ ลบ ${entity.label} สำเร็จ (${records.length} รายการ)`);
        } catch (error) {
          console.error(`❌ ไม่สามารถลบ ${entity.label}:`, error);
          toast.error(`เกิดข้อผิดพลาดในการลบ ${entity.label}: ${error.message}`);
        }
      }

      queryClient.invalidateQueries();

      toast.success(`รีเซ็ตข้อมูลสำเร็จ! ลบทั้งหมด ${totalDeleted} รายการ`);

      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Error resetting data:', error);
      toast.error('เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล: ' + error.message);
    }

    setResetting(false);
  };

  const deleteRoomsWithoutBranchMutation = useMutation({
    mutationFn: async (roomIds) => {
      const promises = roomIds.map(roomId =>
        base44.entities.Room.delete(roomId)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allRoomsDebug']);
      toast.success('ลบห้องที่ไม่มี branch_id สำเร็จ');
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาดในการลบห้อง: ' + error.message);
    }
  });

  const deleteTenantsWithoutBranchMutation = useMutation({
    mutationFn: async (tenantIds) => {
      const promises = tenantIds.map(tenantId =>
        base44.entities.Tenant.delete(tenantId)
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['allTenantsDebugTestingAdmin']);
      toast.success('ลบผู้เช่าที่ไม่มี branch_id สำเร็จ');
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาดในการลบผู้เช่า: ' + error.message);
    }
  });

  const handleDeleteRoomsWithoutBranch = () => {
    if (roomsWithoutBranch.length === 0) {
      toast.info('ไม่มีห้องที่ต้องลบ');
      return;
    }

    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบห้อง ${roomsWithoutBranch.length} ห้องที่ไม่มี branch_id?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) {
      const roomIds = roomsWithoutBranch.map(r => r.id);
      deleteRoomsWithoutBranchMutation.mutate(roomIds);
    }
  };

  const handleDeleteTenantsWithoutBranch = () => {
    if (tenantsWithProblems.length === 0) {
      toast.info('ไม่มีผู้เช่าที่ต้องลบ');
      return;
    }

    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้เช่า ${tenantsWithProblems.length} คนที่มี branch_id ผิดหรือไม่มี branch_id?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้`)) {
      const tenantIds = tenantsWithProblems.map(t => t.id);
      deleteTenantsWithoutBranchMutation.mutate(tenantIds);
    }
  };

  const updateTenantsWithProblemsToCurrentBranchMutation = useMutation({
    mutationFn: async ({ tenantIds, newBranchId }) => {
      console.log('🔧 Calling updateTenantsBranch function...', {
        tenantIds,
        newBranchId,
        totalTenants: tenantIds.length
      });

      const response = await base44.functions.invoke('updateTenantsBranch', {
        tenantIds,
        newBranchId
      });

      console.log('🎯 Function response:', response.data);

      if (!response.data.success) {
        throw new Error(response.data.message || response.data.error || 'Failed to update tenants');
      }

      return response.data.results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries(['allTenantsDebugTestingAdmin']);
      queryClient.invalidateQueries(['tenants', selectedBranchId]);
      toast.success(`บันทึกผู้เช่าเข้าสาขาปัจจุบันสำเร็จ ${results.success.length} คน`);
    },
    onError: (error) => {
      console.error('Update mutation error:', error);
      toast.error('เกิดข้อผิดพลาดในการบันทึกผู้เช่า: ' + error.message);
    }
  });

  const handleUpdateTenantsToCurrentBranch = () => {
    if (tenantsWithProblems.length === 0) {
      toast.info('ไม่มีผู้เช่าที่ต้องบันทึก');
      return;
    }

    if (!selectedBranchId) {
      toast.error('ไม่พบสาขาปัจจุบัน กรุณาเลือกสาขาก่อน');
      return;
    }

    console.log('📋 Prepare to update tenants:', {
      tenantsWithProblems: tenantsWithProblems.map(t => ({
        id: t.id,
        name: t.full_name,
        currentBranchId: t.branch_id
      })),
      targetBranchId: selectedBranchId,
      branchName: localStorage.getItem('selected_branch_name')
    });

    if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการบันทึกผู้เช่า ${tenantsWithProblems.length} คนเหล่านี้เข้าสาขาปัจจุบัน?\n\nผู้เช่าเหล่านี้จะถูกย้ายเข้าสาขา: ${localStorage.getItem('selected_branch_name')}`)) {
      const tenantIds = tenantsWithProblems.map(t => t.id);
      updateTenantsWithProblemsToCurrentBranchMutation.mutate({
        tenantIds,
        newBranchId: selectedBranchId
      });
    }
  };

  const generateTestDataMutation = useMutation({
    mutationFn: async ({ entityType, quantity, branchId }) => {
      const branch_id_param = branchId === 'current' ? selectedBranchId : null;
      if (branchId === 'current' && !branch_id_param) {
        throw new Error('ไม่พบสาขาปัจจุบัน กรุณาเลือกสาขาก่อน');
      }

      const totalExpectedItems = entityType === 'CompleteSet' ? quantity * 4 : quantity;

      setGenerationProgress({
        show: true,
        current: 0,
        total: totalExpectedItems,
        message: 'กำลังเตรียมข้อมูล...',
        details: []
      });

      const response = await base44.functions.invoke('generateTestData', {
        entityType,
        quantity,
        branch_id: branch_id_param
      });

      return response.data;
    },
    onSuccess: async (data) => {
      if (data.success) {
        const createdCount = data.created ? data.created.length : 0;
        const totalCount = data.totalItems || (testDataForm.entityType === 'CompleteSet' ? testDataForm.quantity * 4 : testDataForm.quantity);

        setGenerationProgress(prev => ({
          ...prev,
          current: createdCount,
          total: totalCount,
          message: data.message || 'สร้างข้อมูลสำเร็จ! 🎉',
          details: data.created || []
        }));

        toast.success(data.message || 'สร้างข้อมูลทดสอบสำเร็จ');

        await queryClient.invalidateQueries(['allRoomsDebug']);
        await queryClient.invalidateQueries(['allTenantsDebugTestingAdmin']);
        await queryClient.invalidateQueries(['allRooms']);
        await queryClient.invalidateQueries(['rooms']);
        await queryClient.invalidateQueries(['allTenants']);
        await queryClient.invalidateQueries(['tenants']);
        await queryClient.invalidateQueries(['bookings']);
        await queryClient.invalidateQueries(['allBookings']);
        await queryClient.invalidateQueries(['payments']);
        await queryClient.invalidateQueries(['allPayments']);

        await queryClient.refetchQueries(['allRoomsDebug'], { active: true });
        await queryClient.refetchQueries(['allTenantsDebugTestingAdmin'], { active: true });
        await queryClient.refetchQueries(['bookings'], { active: true });
        await queryClient.refetchQueries(['allBookings'], { active: true });
        await queryClient.refetchQueries(['payments'], { active: true });
        await queryClient.refetchQueries(['allPayments'], { active: true });

        setTimeout(() => {
          setGenerationProgress({
            show: false,
            current: 0,
            total: 0,
            message: '',
            details: []
          });
        }, 3000);

        console.log('✅ Data refreshed successfully');
      } else {
        setGenerationProgress({ show: false, current: 0, total: 0, message: '', details: [] });
        toast.error(data.error || 'เกิดข้อผิดพลาดในการสร้างข้อมูล');
      }
    },
    onError: (error) => {
      setGenerationProgress({ show: false, current: 0, total: 0, message: '', details: [] });
      toast.error('เกิดข้อผิดพลาดในการสร้างข้อมูลทดสอบ: ' + error.message);
    }
  });

  const handleDeleteTestDataByBranch = async () => {
    const branchName = testDataDeleteForm.branchId === 'current' 
      ? localStorage.getItem('selected_branch_name') 
      : testDataDeleteForm.branchId === 'all' 
        ? 'ทุกสาขา' 
        : branches.find(b => b.id === testDataDeleteForm.branchId)?.branch_name || 'ไม่ทราบ';

    if (!confirm(`⚠️ ยืนยันการลบข้อมูลทดสอบ\n\nสาขา: ${branchName}\n\nจะลบ:\n• ห้องพักที่มี "TEST-" หรือ "MASSIVE-"\n• ผู้เช่า การจอง บิล มิเตอร์ แจ้งซ่อม ที่เกี่ยวข้อง\n\n** การกระทำนี้ไม่สามารถย้อนกลับได้ **`)) {
      return;
    }

    setDeletingTestDataByBranch(true);
    setTestDataDeleteProgress({ current: 'เริ่มต้น...', deleted: 0, total: 0, breakdown: {} });
    
    const branchFilter = testDataDeleteForm.branchId === 'all' 
      ? {} 
      : { branch_id: testDataDeleteForm.branchId === 'current' ? selectedBranchId : testDataDeleteForm.branchId };
    
    let totalDeleted = 0;
    const breakdown = {};
    
    try {
      const entities = [
        { name: 'Payment', label: 'บิลชำระเงิน' },
        { name: 'MeterReading', label: 'มิเตอร์' },
        { name: 'MaintenanceRequest', label: 'แจ้งซ่อม' },
        { name: 'Expense', label: 'ค่าใช้จ่าย' },
        { name: 'Booking', label: 'การจอง' },
        { name: 'Tenant', label: 'ผู้เช่า' },
        { name: 'Room', label: 'ห้องพัก' }
      ];

      for (const entity of entities) {
        setTestDataDeleteProgress(prev => ({ ...prev, current: `กำลังลบ ${entity.label}...` }));
        
        let entityDeleted = 0;
        let hasMore = true;
        
        while (hasMore) {
          const items = await base44.entities[entity.name].filter(branchFilter, '-created_date', 500);
          
          if (!items || items.length === 0) {
            hasMore = false;
            break;
          }
          
          const testItems = items.filter(item => {
            const checkFields = [
              item.room_number, item.full_name, item.notes, 
              item.description, item.title, item.branch_name, item.branch_code
            ];
            return checkFields.some(f => f && (
              f.includes('[TEST-') || f.includes('TEST-') || 
              f.includes('[HEAVY-') || f.includes('HEAVY-') || 
              f.includes('[MASSIVE-') || f.includes('MASSIVE-')
            ));
          });

          const deletePromises = testItems.map(item => 
            base44.entities[entity.name].delete(item.id).catch(e => {
              console.warn(`Failed to delete ${entity.name} ${item.id}:`, e.message);
            })
          );
          
          await Promise.all(deletePromises);
          entityDeleted += testItems.length;
          totalDeleted += testItems.length;
          
          setTestDataDeleteProgress(prev => ({
            ...prev,
            deleted: totalDeleted,
            breakdown: { ...prev.breakdown, [entity.name]: entityDeleted }
          }));
          
          if (items.length < 500) {
            hasMore = false;
          }
        }
        
        breakdown[entity.name] = entityDeleted;
        setTestDataDeleteProgress(prev => ({
          ...prev,
          deleted: totalDeleted,
          breakdown: { ...breakdown }
        }));
      }
      
      setTestDataDeleteProgress(prev => ({ ...prev, current: 'เสร็จสิ้น!' }));
      
      if (totalDeleted === 0) {
        toast.info(`ไม่พบข้อมูลทดสอบใน${branchName}`);
      } else {
        toast.success(`ลบข้อมูลทดสอบสำเร็จ ${totalDeleted.toLocaleString()} รายการ`);
      }
      
      await queryClient.invalidateQueries();
      
    } catch (error) {
      console.error('Delete test data by branch error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setDeletingTestDataByBranch(false);
    }
  };

  const handleDeleteTestDataWithProgress = async () => {
    if (!confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทดสอบทั้งหมด?\n\n' +
      'ข้อมูลที่จะถูกลบ:\n' +
      '- ห้องพักที่มี "TEST-" หรือ "MASSIVE-"\n' +
      '- ผู้เช่า การจอง บิล มิเตอร์ แจ้งซ่อม ที่เกี่ยวข้อง\n' +
      '- สาขาทดสอบ (ถ้ามี)\n\n' +
      '💡 ถ้าข้อมูลเยอะมาก อาจต้องกดหลายครั้ง (ป้องกัน timeout)\n\n' +
      '** การกระทำนี้ไม่สามารถย้อนกลับได้ **')) {
      return;
    }

    setDeletionProgress({
      show: true,
      currentEntity: 'กำลังเตรียมข้อมูล...',
      currentBatch: 0,
      totalBatches: 0,
      deletedCount: 0,
      totalCount: 0,
      entityBreakdown: {},
      message: 'กำลังโหลดข้อมูล...',
      isComplete: false,
      hasError: false
    });

    try {
      // นับจำนวนข้อมูลทดสอบทั้งหมดก่อน
      const entities = ['Payment', 'MeterReading', 'MaintenanceRequest', 'Booking', 'Tenant', 'Room', 'Branch'];
      let totalTestRecords = 0;
      const breakdown = {};

      for (const entityName of entities) {
        const records = await base44.entities[entityName].list('-created_date', 10000);
        const testRecords = records.filter(r => {
          const checkFields = [r.room_number, r.full_name, r.notes, r.description, r.title, r.branch_name, r.branch_code];
          return checkFields.some(f => f && (f.includes('[TEST-') || f.includes('TEST-') || f.includes('[HEAVY-') || f.includes('HEAVY-') || f.includes('[MASSIVE-') || f.includes('MASSIVE-')));
        });
        breakdown[entityName.toLowerCase() + 's'] = testRecords.length;
        totalTestRecords += testRecords.length;
      }

      setDeletionProgress(prev => ({
        ...prev,
        totalCount: totalTestRecords,
        entityBreakdown: breakdown,
        message: `พบข้อมูลทดสอบ ${totalTestRecords.toLocaleString()} รายการ`
      }));

      // เรียก backend function เพื่อลบ (ลบได้สูงสุด 100,000 รายการต่อรอบ)
      const response = await base44.functions.invoke('deleteTestDataWithProgress', {
        batchSize: 1000,
        delayMs: 0,
        maxTimeSeconds: 110,
        maxItemsPerRun: 100000
      });

      if (response.data.success) {
        const totalDeleted = response.data.totalDeleted || 0;
        const needMoreRuns = response.data.needMoreRuns || false;
        
        setDeletionProgress(prev => ({
          ...prev,
          isComplete: true,
          deletedCount: totalDeleted,
          entityBreakdown: response.data.results.deleted,
          message: response.data.message,
          hasError: false
        }));

        if (totalDeleted === 0) {
          toast.info('ไม่พบข้อมูลทดสอบในระบบ', { duration: 3000 });
        } else if (needMoreRuns) {
          toast.warning(`ลบไปแล้ว ${totalDeleted.toLocaleString()} รายการ - กรุณากดลบอีกครั้ง`, { 
            duration: 8000,
            description: 'ยังมีข้อมูลทดสอบเหลืออยู่ กดลบซ้ำจนกว่าจะหมด'
          });
        } else {
          toast.success(`ลบข้อมูลทดสอบทั้งหมดเรียบร้อย ${totalDeleted.toLocaleString()} รายการ`, { duration: 5000 });
        }

        // Invalidate queries
        await queryClient.invalidateQueries();
        
      } else {
        throw new Error(response.data.error || 'เกิดข้อผิดพลาด');
      }

    } catch (error) {
      console.error('Delete error:', error);
      setDeletionProgress(prev => ({
        ...prev,
        hasError: true,
        isComplete: true,
        message: error.message
      }));
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const deleteTestDataMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('deleteTestData', {});
      return response.data;
    },
    onSuccess: async (data) => {
      if (data.success) {
        toast.success(data.message);
        await queryClient.invalidateQueries();
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาดในการลบข้อมูลทดสอบ: ' + error.message);
    }
  });

  const handleGenerateTestData = () => {
    const { entityType, quantity, branchId } = testDataForm;

    if (branchId === 'current' && !selectedBranchId) {
      toast.error('ไม่พบสาขาปัจจุบัน กรุณาเลือกสาขาก่อนที่จะสร้างข้อมูลทดสอบในสาขาปัจจุบัน');
      return;
    }
    if (parseInt(quantity) < 1) {
      toast.error('จำนวนต้องมากกว่า 0');
      return;
    }
    if (parseInt(quantity) > 10000) {
      toast.error('จำนวนต้องไม่เกิน 10,000');
      return;
    }

    const branchText = branchId === 'current'
      ? `สาขา ${localStorage.getItem('selected_branch_name') || 'ไม่ระบุ'}`
      : 'ทุกสาขา (แบ่งเท่าๆ กัน)';

    let entityText = '';
    if (entityType === 'CompleteSet') entityText = 'ชุดครบวงจร';
    else if (entityType === 'Room') entityText = 'ห้องพัก';
    else if (entityType === 'Tenant') entityText = 'ผู้เช่า';
    else if (entityType === 'Booking') entityText = 'การจอง';
    else if (entityType === 'Payment') entityText = 'บิลชำระเงิน';

    const actualTotalQuantity = parseInt(quantity);

    let confirmMessage = '';
    let estimatedTimeSeconds = 0;

    if (entityType === 'CompleteSet') {
        estimatedTimeSeconds = Math.ceil(actualTotalQuantity * 0.5);
    } else {
        estimatedTimeSeconds = Math.ceil(actualTotalQuantity / 10);
    }
    if (estimatedTimeSeconds < 1) estimatedTimeSeconds = 1;

    if (entityType === 'CompleteSet') {
      confirmMessage = `🎯 ยืนยันการสร้างข้อมูลทดสอบ "ครบชุด"\n\n` +
        `สาขา: ${branchText}\n` +
        `• จำนวนชุด: ${actualTotalQuantity} ชุด\n` +
        `${branchId !== 'current' ? `• แบ่งเท่าๆ กันใน ${branches.length} สาขา\n` : ''}` +
        `\n📦 แต่ละชุดประกอบด้วย:\n` +
        `   1️⃣ ห้องพัก 1 ห้อง\n` +
        `   2️⃣ ผู้เช่า 1 คน\n` +
        `   3️⃣ การจอง 1 สัญญา (เชื่อมโยงห้อง+ผู้เช่า)\n` +
        `   4️⃣ บิลชำระเงิน 1 บิล\n` +
        `\n✨ รวม: ${actualTotalQuantity * 4} รายการทั้งหมด!\n` +
        `⏱️ ใช้เวลาประมาณ ${estimatedTimeSeconds} วินาที\n` +
        `\n⚠️ ข้อมูลเหล่านี้จะมีคำว่า [TEST-] และสามารถลบได้ง่ายในภายหลัง\n\n` +
        `กด OK เพื่อดำเนินการต่อ`;
    } else if (entityType === 'Booking') {
      confirmMessage = `🧪 ยืนยันการสร้างข้อมูลทดสอบ\n\n` +
        `ประเภท: ${entityText}\n` +
        `สาขา: ${branchText}\n` +
        `• รวมทั้งหมด: ${actualTotalQuantity} ${entityText}\n` +
        `${branchId !== 'current' ? `• แบ่งเท่าๆ กันในทุกสาขา (${branches.length} สาขา)\n` : ''}` +
        `\n⚡ ระบบจะจับคู่ผู้เช่ากับห้องว่างอัตโนมัติ\n` +
        `⏱️ ใช้เวลาประมาณ ${estimatedTimeSeconds} วินาที\n` +
        `\n⚠️ ข้อมูลเหล่านี้จะมีคำว่า [TEST-] และสามารถลบได้ง่ายในภายหลัง\n\n` +
        `กด OK เพื่อดำเนินการต่อ`;
    } else {
      confirmMessage = `🧪 ยืนยันการสร้างข้อมูลทดสอบ\n\n` +
        `ประเภท: ${entityText}\n` +
        `สาขา: ${branchText}\n` +
        `• รวมทั้งหมด: ${actualTotalQuantity} ${entityText}\n` +
        `${branchId !== 'current' ? `• แบ่งเท่าๆ กันในทุกสาขา (${branches.length} สาขา)\n` : ''}` +
        `⏱️ ใช้เวลาประมาณ ${estimatedTimeSeconds} วินาที\n` +
        `\n⚠️ ข้อมูลเหล่านี้จะมีคำว่า [TEST-] และสามารถลบได้ง่ายในภายหลัง\n\n` +
        `กด OK เพื่อดำเนินการต่อ`;
    }

    if (confirm(confirmMessage)) {
      setGeneratingTestData(true);
      generateTestDataMutation.mutate(
        {
          entityType,
          quantity: parseInt(quantity),
          branchId
        },
        {
          onSettled: () => setGeneratingTestData(false)
        }
      );
    }
  };

  const handleDeleteTestData = () => {
    if (confirm('⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลทดสอบทั้งหมด?\n\nข้อมูลที่จะถูกลบ:\n- ห้องพักที่มี "TEST-" ในชื่อ\n- ผู้เช่าที่มี "[TEST-" ในชื่อ\n- การจองทดสอบทั้งหมด\n- บิลชำระเงินทดสอบทั้งหมด\n\n** การกระทำนี้ไม่สามารถย้อนกลับได้ **')) {
      setDeletingTestData(true);
      deleteTestDataMutation.mutate(undefined, {
          onSettled: () => setDeletingTestData(false)
      });
    }
  };

  const generateYearlyDataMutation = useMutation({
    mutationFn: async ({ roomsPerBranch, branchId }) => {
      const branch_id_param = branchId === 'current' ? selectedBranchId : null;
      if (branchId === 'current' && !branch_id_param) {
        throw new Error('ไม่พบสาขาปัจจุบัน กรุณาเลือกสาขาก่อน');
      }

      const response = await base44.functions.invoke('generateYearlyTestData', {
        roomsPerBranch: parseInt(roomsPerBranch),
        branch_id: branch_id_param
      });

      return response.data;
    },
    onSuccess: async (data) => {
      if (data.success) {
        toast.success(data.message);

        await queryClient.invalidateQueries(['allRoomsDebug']);
        await queryClient.invalidateQueries(['allTenantsDebugTestingAdmin']);
        await queryClient.invalidateQueries(['allRooms']);
        await queryClient.invalidateQueries(['rooms']);
        await queryClient.invalidateQueries(['allTenants']);
        await queryClient.invalidateQueries(['tenants']);
        await queryClient.invalidateQueries(['bookings']);
        await queryClient.invalidateQueries(['allBookings']);
        await queryClient.invalidateQueries(['payments']);
        await queryClient.invalidateQueries(['allPayments']);

        await queryClient.refetchQueries(['allRoomsDebug'], { active: true });
        await queryClient.refetchQueries(['allTenantsDebugTestingAdmin'], { active: true });
        await queryClient.refetchQueries(['bookings'], { active: true });
        await queryClient.refetchQueries(['payments'], { active: true });
        await queryClient.refetchQueries(['allBookings'], { active: true });
        await queryClient.refetchQueries(['allPayments'], { active: true });

        console.log('✅ Yearly data refreshed successfully');
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาดในการสร้างข้อมูล');
      }
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาดในการสร้างข้อมูล 5 ปี: ' + error.message);
    }
  });

  const handleGenerateYearlyData = () => {
    const { roomsPerBranch, branchId } = yearlyDataForm;

    if (branchId === 'current' && !selectedBranchId) {
      toast.error('ไม่พบสาขาปัจจุบัน กรุณาเลือกสาขาก่อน');
      return;
    }

    if (parseInt(roomsPerBranch) < 1 || parseInt(roomsPerBranch) > 100) {
      toast.error('จำนวนห้องต้องอยู่ระหว่าง 1-100');
      return;
    }

    const branchText = branchId === 'current'
      ? `สาขา ${localStorage.getItem('selected_branch_name') || 'ไม่ระบุ'}`
      : `ทุกสาขา (${branches.length} สาขา)`;

    const parsedRoomsPerBranch = parseInt(roomsPerBranch);
    const actualTotalRooms = branchId === 'current' ? parsedRoomsPerBranch : parsedRoomsPerBranch * branches.length;
    const actualTotalPayments = actualTotalRooms * 60;
    const totalItemsCalculated = actualTotalRooms * 3 + actualTotalPayments;

    const estimatedTimeSeconds = Math.ceil(actualTotalPayments / 20);
    const estimatedMaxTimeSeconds = Math.ceil(actualTotalPayments / 10);

    const confirmMessage = `📅 ยืนยันการสร้างข้อมูลจำลอง 5 ปีเต็ม\n\n` +
      `สาขา: ${branchText}\n` +
      `• ห้องพักต่อสาขา: ${roomsPerBranch} ห้อง\n` +
      `• รวมทั้งหมด: ${actualTotalRooms} ห้อง\n\n` +
      `📦 จะสร้างข้อมูลครบวงจร:\n` +
      `   1️⃣ ห้องพัก: ${actualTotalRooms} ห้อง\n` +
      `   2️⃣ ผู้เช่า: ${actualTotalRooms} คน\n` +
      `   3️⃣ การจอง: ${actualTotalRooms} สัญญา (สัญญา 5 ปี)\n` +
      `   4️⃣ บิลชำระเงิน: ${actualTotalPayments} บิล (60 เดือน/ห้อง)\n\n` +
      `✨ รวมทั้งหมด: ${totalItemsCalculated} รายการ\n` +
      `📊 ครอบคลุมข้อมูล 60 เดือนย้อนหลัง (5 ปี)\n` +
      `⏱️ ใช้เวลาประมาณ ${estimatedTimeSeconds}-${estimatedMaxTimeSeconds} วินาที\n\n` +
      `⚠️ ข้อมูลเหล่านี้จะมีคำว่า [TEST-] และสามารถลบได้\n\n` +
      `กด OK เพื่อดำเนินการต่อ`;

    if (confirm(confirmMessage)) {
      setGeneratingYearlyData(true);
      generateYearlyDataMutation.mutate(
        {
          roomsPerBranch: parseInt(roomsPerBranch),
          branchId
        },
        {
          onSettled: () => setGeneratingYearlyData(false)
        }
      );
    }
  };


  if (isLoadingAllRooms || isLoadingAllTenants) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <PageHeader
          title="โหมดทดสอบระบบ"
          subtitle="สำหรับทดสอบการทำงานของระบบเท่านั้น"
          icon={TestTube}
          showNotifications={false}
        />
        <div className="px-4 md:px-8 py-6">
          <div className="max-w-4xl mx-auto flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-600 text-lg">กำลังโหลดข้อมูล...</p>
              <p className="text-slate-500 text-sm mt-2">
                {isLoadingAllRooms && 'กำลังโหลดห้อง... '}
                {isLoadingAllTenants && 'กำลังโหลดผู้เช่า... '}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const yearlyRoomsPerBranch = parseInt(yearlyDataForm.roomsPerBranch) || 0;
  const yearlyActualTotalRooms = yearlyDataForm.branchId === 'current'
    ? yearlyRoomsPerBranch
    : yearlyRoomsPerBranch * branches.length;
  const yearlyTotalItemsDisplay = yearlyActualTotalRooms * 3 + (yearlyActualTotalRooms * 60);


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader
        title="โหมดทดสอบระบบ"
        subtitle="สำหรับทดสอบการทำงานของระบบเท่านั้น (ผู้ดูแลระบบเท่านั้น)"
        icon={TestTube}
        showNotifications={false}
        actions={
          <Link to={createPageUrl('Settings')}>
            <Button variant="outline" className="shadow-md">
              <ArrowLeft className="w-4 h-4 mr-2" />
              กลับไปหน้าตั้งค่า
            </Button>
          </Link>
        }
      />

      <DeletionProgressDialog
        open={deletionProgress.show}
        onOpenChange={(open) => {
          if (deletionProgress.isComplete || deletionProgress.hasError) {
            setDeletionProgress({
              show: false,
              currentEntity: '',
              currentBatch: 0,
              totalBatches: 0,
              deletedCount: 0,
              totalCount: 0,
              entityBreakdown: {},
              message: '',
              isComplete: false,
              hasError: false
            });
          }
        }}
        progress={deletionProgress}
        isComplete={deletionProgress.isComplete}
        hasError={deletionProgress.hasError}
      />

      <MassiveLoadDialog
        open={massiveLoadOpen}
        progress={massiveLoadProgress}
        status={massiveLoadStatus}
        message={massiveLoadMessage}
        results={massiveLoadResults}
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Onboarding Test Button */}
          <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 border-yellow-300 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <Sparkles className="w-6 h-6" />
                🎓 ทดสอบโหมดสอนการใช้งาน
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-100 rounded-lg p-4 border-2 border-yellow-300">
                <h4 className="font-bold text-yellow-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  📌 เกี่ยวกับโหมดสอนการใช้งาน
                </h4>
                <p className="text-sm text-yellow-800 mb-2">
                  โหมดสอนการใช้งานจะพาผู้ใช้ที่เป็นเจ้าของหอพัก (role: owner) ทำตามขั้นตอนการตั้งค่าระบบครั้งแรก
                </p>
                <ul className="text-sm text-yellow-800 list-disc ml-5 space-y-1">
                  <li>แสดงบทช่วยสอนแบบทีละขั้นตอน</li>
                  <li>ไฮไลต์ปุ่มที่ต้องกดในแต่ละขั้น</li>
                  <li>มี Checklist ติดตามความคืบหน้า</li>
                  <li>เหมาะสำหรับผู้ใช้ใหม่ที่ยังไม่คุ้นเคยกับระบบ</li>
                </ul>
              </div>

              <Button
                onClick={async () => {
                  if (!currentUser) {
                    toast.error('ไม่พบข้อมูลผู้ใช้');
                    return;
                  }
                  
                  setStartingOnboarding(true);
                  try {
                    // ล้าง localStorage ให้เหมือนผู้ใช้ใหม่
                    localStorage.removeItem('selected_branch_id');
                    localStorage.removeItem('selected_branch_name');
                    
                    await base44.auth.updateMe({
                      onboarding_mode_enabled: true,
                      onboarding_current_step: 1,
                      onboarding_completed_checklist: {}
                    });
                    
                    toast.success('🎉 เปิดโหมดสอนการใช้งานแล้ว! กำลังพาไปหน้าต้อนรับ...');
                    
                    // รอให้ข้อมูลอัปเดตจริงๆ ก่อน navigate
                    await queryClient.refetchQueries({ queryKey: ['currentUser'] });
                    
                    setTimeout(() => {
                      window.location.href = createPageUrl('BranchSelection');
                    }, 300);
                  } catch (error) {
                    console.error('Error starting onboarding:', error);
                    toast.error('เกิดข้อผิดพลาด: ' + error.message);
                  } finally {
                    setStartingOnboarding(false);
                  }
                }}
                disabled={startingOnboarding}
                className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 shadow-lg h-14 text-base font-bold"
              >
                {startingOnboarding ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    กำลังเริ่มโหมดสอน...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 mr-2" />
                    🎓 เริ่มโหมดสอนการใช้งาน (ทดสอบ)
                  </>
                )}
              </Button>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">📋 ขั้นตอนการทดสอบ:</h4>
                <ol className="space-y-1 text-sm text-blue-700 list-decimal ml-5">
                  <li>กดปุ่ม "เริ่มโหมดสอน" ด้านบน</li>
                  <li>ระบบจะพาคุณไปหน้าเลือกสาขา</li>
                  <li>ทำตามบทช่วยสอนทีละขั้นตอน</li>
                  <li>ลองข้ามหรือปิดบทช่วยสอนได้ตลอดเวลา</li>
                  <li>เมื่อทำครบทุกขั้น จะปิดโหมดสอนอัตโนมัติ</li>
                </ol>
              </div>

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h4 className="font-semibold text-amber-900 mb-2">💡 Tips:</h4>
                <ul className="space-y-1 text-sm text-amber-800 list-disc ml-5">
                  <li>โหมดนี้แสดงเฉพาะกับผู้ใช้ที่มี custom_role = "owner" เท่านั้น</li>
                  <li>สามารถเริ่มใหม่ได้ทุกเมื่อจากปุ่มในหน้า Dashboard</li>
                  <li>ข้อมูลการทำบทช่วยสอนจะถูกบันทึกใน User entity</li>
                  <li>หากต้องการรีเซ็ต ให้ลบฟิลด์ onboarding_* ใน User entity</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-800">
                <Terminal className="w-6 h-6" />
                ตรวจสอบ Cron Job
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 mb-4">
                ดูผลการทำงานล่าสุดของฟังก์ชันที่ทำงานอัตโนมัติ (Cron Job) เช่น การสร้างบิล, การส่ง LINE, และอื่นๆ
              </p>
              <Button onClick={() => navigate(createPageUrl('CronJobDashboard'))}>
                <ArrowRight className="w-4 h-4 mr-2" />
                ไปที่แดชบอร์ด Cron Job
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-slate-800">
                    <Terminal className="w-6 h-6" />
                    ประวัติการรัน Cron Job (5 ครั้งล่าสุด)
                </CardTitle>
                <Button onClick={() => refetchBillLogs()} size="sm" variant="outline"><RefreshCw className="w-4 h-4 mr-2"/>รีเฟรช</Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {billGenerationLogs.length === 0 ? (
                <p className="text-slate-500 text-center py-4">ยังไม่มีประวัติการรัน</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {billGenerationLogs.map(log => (
                    <div key={log.id} className={`p-3 rounded-lg border-2 ${log.status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex justify-between items-center mb-2">
                        <div className={`flex items-center gap-2 font-bold ${log.status === 'success' ? 'text-green-700' : 'text-red-700'}`}>
                          {log.status === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                          <span className="truncate max-w-sm">{log.message}</span>
                        </div>
                        <p className="text-xs text-slate-500 flex-shrink-0 ml-4">
                          {format(parseISO(log.run_timestamp), 'd MMM HH:mm:ss', { locale: th })}
                        </p>
                      </div>
                      <details className="mt-2">
                        <summary className="text-xs cursor-pointer text-slate-600">ดูรายละเอียด</summary>
                        <pre className="mt-2 text-xs bg-slate-800 text-white p-3 rounded-md overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          <TestDataStats />
          
          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <AlertTriangle className="w-6 h-6" />
                คำเตือนสำคัญ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-purple-900">
              <p className="font-semibold">🔒 หน้านี้เป็นหน้าพิเศษสำหรับผู้ดูแลระบบเท่านั้น</p>
              <ul className="list-disc ml-6 space-y-2 text-sm">
                <li>ห้ามเปิดใช้งานโหมดทดสอบในระบบที่มีการใช้งานจริง</li>
                <li>โหมดทดสอบจะมีผลกับการคำนวณค่าปรับทั้งระบบ</li>
                <li>เมื่อขายระบบให้ลูกค้า ห้ามแจ้งให้ลูกค้าทราบเกี่ยวกับหน้านี้</li>
                <li>ควรลบลิงก์หรือการเข้าถึงหน้านี้ออกก่อนส่งมอบระบบ</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-300 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <AlertTriangle className="w-6 h-6" />
                🏠 ห้องพักที่ไม่มี Branch ID
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-100 rounded-lg p-4 border-2 border-orange-300">
                <h4 className="font-bold text-orange-900 mb-2 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  📊 สถานะข้อมูล
                </h4>
                <p className="text-orange-800 text-lg font-semibold">
                  พบห้องที่ไม่มี branch_id: <span className="text-2xl font-bold">{roomsWithoutBranch.length}</span> ห้อง
                </p>
              </div>

              {roomsWithoutBranch.length > 0 ? (
                <>
                  <div className="bg-white rounded-lg p-4 border border-orange-200 max-h-96 overflow-y-auto">
                    <h4 className="font-semibold text-orange-900 mb-3">รายการห้อง ({roomsWithoutBranch.length} ห้อง)</h4>
                    <div className="space-y-2">
                      {roomsWithoutBranch.map((room) => (
                        <div key={room.id} className="flex items-center justify-between bg-orange-50 rounded-lg p-3 border border-orange-200">
                          <div>
                            <p className="font-bold text-slate-800">ห้อง {room.room_number}</p>
                            <p className="text-sm text-slate-600">ชั้น {room.floor} • {room.price?.toLocaleString()} ฿</p>
                            <p className="text-xs text-slate-500">ID: {room.id}</p>
                          </div>
                          <Badge className={
                            room.status === 'available' ? 'bg-green-100 text-green-700' :
                            room.status === 'occupied' ? 'bg-red-100 text-red-700' :
                            'bg-yellow-100 text-yellow-700'
                          }>
                            {room.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-300">
                    <h4 className="font-semibold text-yellow-900 mb-2">⚠️ ผลกระทบ:</h4>
                    <ul className="list-disc ml-5 text-sm text-yellow-800 space-y-1">
                      <li>ห้องเหล่านี้จะไม่แสดงในระบบจนกว่าจะได้รับการกำหนด branch_id</li>
                      <li>ไม่สามารถสร้างการจองหรือสัญญาเช่าสำหรับห้องเหล่านี้ได้</li>
                      <li>อาจเกิดจากการ Import ข้อมูลที่ไม่สมบูรณ์</li>
                    </ul>
                  </div>

                  <Button
                    onClick={handleDeleteRoomsWithoutBranch}
                    disabled={deleteRoomsWithoutBranchMutation.isPending || isLoadingAllRooms}
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-lg h-12 text-base font-bold"
                  >
                    {deleteRoomsWithoutBranchMutation.isPending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        กำลังลบ...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5 mr-2" />
                        ลบห้องที่ไม่มี branch_id ทั้งหมด ({roomsWithoutBranch.length})
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="bg-green-50 rounded-lg p-6 border border-green-200 text-center">
                  <Check className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <p className="text-green-800 font-semibold">✅ ไม่พบห้องที่มีปัญหา</p>
                  <p className="text-sm text-green-600 mt-1">ห้องทั้งหมดมี branch_id ครบถ้วน</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-pink-50 to-purple-50 border-pink-300 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-pink-800">
                <AlertTriangle className="w-6 h-6" />
                👥 ผู้เช่าที่มี Branch ID ผิดพลาด
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-300 text-xs space-y-1">
                <p className="font-bold text-blue-900">🔍 Debug Info:</p>
                <p className="text-blue-800">• Total Tenants: {allTenants.length}</p>
                <p className="text-blue-800">• Selected Branch ID: {selectedBranchId || 'None'}</p>
                <p className="text-blue-800">• Selected Branch Name: {localStorage.getItem('selected_branch_name') || 'None'}</p>
                <p className="text-blue-800">• Without branch_id: {tenantsWithoutBranch.length}</p>
                <p className="text-blue-800">• With wrong branch_id: {tenantsWithWrongBranch.length}</p>
                <p className="text-blue-800">• Total Problems: {tenantsWithProblems.length}</p>
                {allTenants.length > 0 && (
                  <p className="text-blue-800">• Sample Tenant: ID={allTenants[0]?.id}, Name={allTenants[0]?.full_name}, Branch ID={allTenants[0]?.branch_id || 'None'}</p>
                )}
                {allTenants.length > 0 && (
                  <p className="text-blue-800">• First 3 Tenant IDs: {allTenants.map(t => ({ id: t.id, name: t.full_name, branch_id: t.branch_id })).slice(0, 3).map(t => `${t.name} (${t.branch_id ? t.branch_id.substring(0,8) + '...' : 'None'})`).join(', ')}</p>
                )}
              </div>

              <div className="bg-pink-100 rounded-lg p-4 border-2 border-pink-300">
                <h4 className="font-bold text-pink-900 mb-2 flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  📊 สถานะข้อมูล
                </h4>
                <div className="space-y-2 text-pink-800">
                  <p className="text-lg font-semibold">
                    พบผู้เช่าที่มีปัญหาทั้งหมด: <span className="text-2xl font-bold">{tenantsWithProblems.length}</span> คน
                  </p>
                  {tenantsWithoutBranch.length > 0 && (
                    <p className="text-sm">
                      • ไม่มี branch_id: <span className="font-bold">{tenantsWithoutBranch.length}</span> คน
                    </p>
                  )}
                  {tenantsWithWrongBranch.length > 0 && (
                    <p className="text-sm">
                      • มี branch_id ผิด (สั้นเกินไปหรือไม่ถูกต้อง): <span className="font-bold">{tenantsWithWrongBranch.length}</span> คน
                    </p>
                  )}
                  <p className="text-xs text-pink-600 mt-2">
                    🔍 Debug: สาขาปัจจุบัน = {selectedBranchId ? selectedBranchId.substring(0, 8) + '...' : 'ไม่มี'}
                  </p>
                </div>
              </div>

              {tenantsWithProblems.length > 0 ? (
                <>
                  <div className="bg-white rounded-lg p-4 border border-pink-200 max-h-96 overflow-y-auto">
                    <h4 className="font-semibold text-pink-900 mb-3">รายการผู้เช่า ({tenantsWithProblems.length} คน)</h4>
                    <div className="space-y-2">
                      {tenantsWithProblems.map((tenant) => (
                        <div key={tenant.id} className="bg-pink-50 rounded-lg p-3 border border-pink-200">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-bold text-slate-800">{tenant.full_name}</p>
                              <p className="text-sm text-slate-600">📱 {tenant.phone}</p>
                              {tenant.email && (
                                <p className="text-sm text-slate-600">📧 {tenant.email}</p>
                              )}
                              <div className="mt-2 flex items-center gap-2 flex-wrap">
                                {!tenant.branch_id ? (
                                  <Badge className="bg-red-100 text-red-700 text-xs">
                                    ❌ ไม่มี branch_id
                                  </Badge>
                                ) : (
                                  <Badge className="bg-orange-100 text-orange-700 text-xs">
                                    ⚠️ branch_id ผิด: {tenant.branch_id}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-1">ID: {tenant.id}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-300">
                    <h4 className="font-semibold text-yellow-900 mb-2">⚠️ ผลกระทบ:</h4>
                    <ul className="list-disc ml-5 text-sm text-yellow-800 space-y-1">
                      <li>ผู้เช่าเหล่านี้จะไม่แสดงในระบบจนกว่าจะได้รับการกำหนด branch_id ที่ถูกต้อง</li>
                      <li>ไม่สามารถสร้างสัญญาเช่าสำหรับผู้เช่าเหล่านี้ได้</li>
                      <li>อาจเกิดจากการ Import ข้อมูลที่ไม่สมบูรณ์หรือการย้ายข้อมูลจากระบบเก่า</li>
                    </ul>
                  </div>

                  <div className="bg-green-50 rounded-lg p-4 border border-green-300">
                    <h4 className="font-semibold text-green-900 mb-2">💡 วิธีแก้ไข:</h4>
                    <p className="text-sm text-green-800 mb-2">
                      <strong>ตัวเลือกที่ 1 (แนะนำ):</strong> บันทึกผู้เช่าเหล่านี้เข้าสาขาปัจจุบัน "{localStorage.getItem('selected_branch_name')}" ด้วยปุ่มด้านล่าง
                    </p>
                    <p className="text-sm text-green-800">
                      <strong>ตัวเลือกที่ 2:</strong> ไปที่ Dashboard → Data → Tenant แล้วแก้ไข branch_id ของแต่ละคนให้ถูกต้อง
                    </p>
                  </div>

                  <Button
                    onClick={handleUpdateTenantsToCurrentBranch}
                    disabled={updateTenantsWithProblemsToCurrentBranchMutation.isPending || isLoadingAllTenants}
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg h-12 text-base font-bold"
                  >
                    {updateTenantsWithProblemsToCurrentBranchMutation.isPending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        บันทึกผู้เช่าทั้งหมดเข้าสาขาปัจจุบัน ({tenantsWithProblems.length} คน)
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleDeleteTenantsWithoutBranch}
                    disabled={deleteTenantsWithoutBranchMutation.isPending || isLoadingAllTenants}
                    className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 shadow-lg h-12 text-base font-bold"
                  >
                    {deleteTenantsWithoutBranchMutation.isPending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        กำลังลบ...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5 mr-2" />
                        ลบผู้เช่าที่มีปัญหาทั้งหมด ({tenantsWithProblems.length} คน)
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="bg-green-50 rounded-lg p-6 border border-green-200 text-center">
                  <Check className="w-12 h-12 text-green-600 mx-auto mb-3" />
                  <p className="text-green-800 font-semibold">✅ ไม่พบผู้เช่าที่มีปัญหา</p>
                  <p className="text-sm text-green-600 mt-1">ผู้เช่าทั้งหมดมี branch_id ถูกต้องและตรงกับสาขาในระบบ</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Dialog open={generationProgress.show} onOpenChange={(open) => {
            if (!open && generationProgress.current >= generationProgress.total) {
              setGenerationProgress({ show: false, current: 0, total: 0, message: '', details: [] });
            }
          }}>
            <DialogContent className="max-w-2xl" onPointerDownOutside={(e) => {
              if (generationProgress.current < generationProgress.total) {
                e.preventDefault();
              }
            }}>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {generationProgress.current >= generationProgress.total ? (
                    <>
                      <Check className="w-6 h-6 text-green-600" />
                      สร้างข้อมูลสำเร็จ!
                    </>
                  ) : (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                      กำลังสร้างข้อมูลทดสอบ...
                    </>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>{generationProgress.message}</span>
                    <span className="font-bold">
                      {generationProgress.current} / {generationProgress.total}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 h-full transition-all duration-300 rounded-full"
                      style={{
                        width: `${generationProgress.total > 0 ? (generationProgress.current / generationProgress.total) * 100 : 0}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 text-center mt-1">
                    {generationProgress.total > 0
                      ? `${Math.round((generationProgress.current / generationProgress.total) * 100)}% เสร็จสมบูรณ์`
                      : 'กำลังเตรียมข้อมูล...'}
                  </p>
                </div>

                {generationProgress.details && generationProgress.details.length > 0 && (
                  <Card className="bg-slate-50">
                    <CardContent className="p-4 max-h-64 overflow-y-auto">
                      <h4 className="font-semibold text-slate-800 mb-2">📋 รายละเอียด:</h4>
                      <div className="space-y-2 text-sm">
                        {generationProgress.details.map((detail, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-slate-700">
                            <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            <span>{detail}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {generationProgress.current < generationProgress.total && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <p className="text-sm text-blue-800">
                      ⏳ กรุณารอสักครู่... ระบบกำลังสร้างข้อมูลเป็น batch เพื่อความเสถียร
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      💡 การสร้างข้อมูลจำนวนมากอาจใช้เวลา 10-60 วินาที
                    </p>
                  </div>
                )}

                {generationProgress.current >= generationProgress.total && (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => setGenerationProgress({ show: false, current: 0, total: 0, message: '', details: [] })}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      ปิด
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <Plus className="w-6 h-6" />
                🧪 สร้างข้อมูลทดสอบจำนวนมาก
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gradient-to-r from-green-100 to-emerald-100 rounded-lg p-4 border-2 border-green-300">
                <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  ⭐ แนะนำ: ใช้ "ครบชุด" สำหรับการทดสอบที่สมบูรณ์!
                </h4>
                <p className="text-green-800 text-sm mb-2">
                  โหมด <strong>"ครบชุด"</strong> จะสร้างข้อมูลเชื่อมโยงกันครบวงจร เหมาะสำหรับ Demo หรือทดสอบระบบ
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">ประเภทข้อมูล</Label>
                  <Select
                    value={testDataForm.entityType}
                    onValueChange={(value) => setTestDataForm({ ...testDataForm, entityType: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกประเภทข้อมูล" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CompleteSet">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🎯</span>
                          <div>
                            <p className="font-bold text-green-700">ครบชุด (แนะนำ!)</p>
                            <p className="text-xs text-slate-500">ห้อง + ผู้เช่า + การจอง + บิล</p>
                          </div>
                        </div>
                      </SelectItem>
                      <SelectItem value="Room">
                        <div className="flex items-center gap-2">
                          <DoorOpen className="w-4 h-4" />
                          ห้องพักอย่างเดียว
                        </div>
                      </SelectItem>
                      <SelectItem value="Tenant">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          ผู้เช่าอย่างเดียว
                        </div>
                      </SelectItem>
                      <SelectItem value="Booking">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          การจองอย่างเดียว
                        </div>
                      </SelectItem>
                      <SelectItem value="Payment">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4" />
                          บิลชำระเงินอย่างเดียว
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm font-semibold mb-2 block">
                    {testDataForm.entityType === 'CompleteSet' ? 'จำนวนชุด (1-10,000)' : 'จำนวนรวม (1-10,000)'}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    max="10000"
                    value={testDataForm.quantity}
                    onChange={(e) => setTestDataForm({ ...testDataForm, quantity: e.target.value })}
                    className="text-center text-lg font-bold"
                  />
                </div>

                <div>
                  <Label className="text-sm font-semibold mb-2 block">สาขาเป้าหมาย</Label>
                  <Select
                    value={testDataForm.branchId}
                    onValueChange={(value) => setTestDataForm({ ...testDataForm, branchId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสาขาเป้าหมาย" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">
                        เฉพาะสาขาปัจจุบัน ({localStorage.getItem('selected_branch_name') || 'ไม่ระบุ'})
                      </SelectItem>
                      <SelectItem value="all">
                        ทุกสาขา - แบ่งเท่าๆ กัน ({branches.length} สาขา)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">ℹ️ รายละเอียดข้อมูลที่จะสร้าง:</h4>
                <div className="text-sm text-blue-700 space-y-1">
                  {testDataForm.entityType === 'CompleteSet' ? (
                    <>
                      <p className="font-bold text-blue-900 text-base mb-2">🎯 โหมด "ครบชุด" - สร้างข้อมูลเชื่อมโยงกันครบวงจร</p>
                      <div className="bg-white rounded-lg p-3 space-y-2">
                        <p className="font-semibold">แต่ละชุดประกอบด้วย 4 ส่วน:</p>
                        <div className="ml-3 space-y-1.5">
                          <p>1️⃣ <strong>ห้องพัก</strong> - TEST-XXX (ราคา 3,000-8,000฿)</p>
                          <p>2️⃣ <strong>ผู้เช่า</strong> - ชื่อสุ่ม + เบอร์ + อีเมล</p>
                          <p>3️⃣ <strong>การจอง</strong> - เชื่อมโยงผู้เช่ากับห้อง (สัญญา 6-12 เดือน)</p>
                          <p>4️⃣ <strong>บิลชำระเงิน</strong> - 70% ชำระแล้ว / 20% รอชำระ / 10% เกินกำหนด</p>
                        </div>
                        <div className="mt-3 pt-3 border-t border-blue-200">
                          <p className="text-green-700 font-bold">✨ สถานะห้องจะเป็น "มีผู้เช่า" อัตโนมัติ</p>
                          <p className="text-green-700 font-bold">✨ ข้อมูลเชื่อมโยงกันครบถ้วน พร้อมใช้งานทันที!</p>
                        </div>
                      </div>
                    </>
                  ) : testDataForm.entityType === 'Room' ? (
                    <>
                      <p>• ห้องจะมีชื่อเป็น <code className="bg-blue-100 px-1 rounded">TEST-XXX</code></p>
                      <p>• ชั้นจะคำนวณอัตโนมัติตามจำนวนห้องที่มีอยู่</p>
                      <p>• ราคาสุ่มระหว่าง 3,000-8,000 บาท</p>
                      <p>• สถานะเริ่มต้น: ว่าง (available)</p>
                      <p>• มี amenities: แอร์, เฟอร์นิเจอร์, WiFi</p>
                    </>
                  ) : testDataForm.entityType === 'Tenant' ? (
                    <>
                      <p>• ชื่อจะมี <code className="bg-blue-100 px-1 rounded">[TEST-timestamp]</code> นำหน้า</p>
                      <p>• เบอร์โทรสุ่ม (09XXXXXXXX)</p>
                      <p>• Email: test_timestamp_X@example.com</p>
                      <p>• 50% chance จะมียานพาหนะ (รถยนต์หรือมอเตอร์ไซค์)</p>
                    </>
                  ) : testDataForm.entityType === 'Payment' ? (
                    <>
                      <p>• <strong>💰 สร้างบิลสำหรับห้องที่มีผู้เช่า:</strong></p>
                      <p>• 70% ชำระแล้ว / 20% รอชำระ / 10% เกินกำหนด</p>
                      <p>• คำนวณค่าน้ำ-ไฟ-อินเทอร์เน็ตอัตโนมัติ</p>
                      <p>• มีวันครบกำหนดที่สมจริง</p>
                      <p>• <strong className="text-red-600">⚠️ ต้องมีห้องที่มีผู้เช่าอยู่ก่อน</strong></p>
                    </>
                  ) : ( // This will be for Booking
                    <>
                      <p>• <strong>🏠 จับคู่อัตโนมัติ:</strong> เชื่อมผู้เช่ากับห้องว่าง</p>
                      <p>• วันเข้าพัก: ย้อนหลัง 0-30 วัน</p>
                      <p>• ระยะเวลาสัญญา: 6-12 เดือน (สุ่ม)</p>
                      <p>• เงินมัดจำ: 2 เดือน</p>
                      <p>• สถานะห้องจะเปลี่ยนเป็น "มีผู้เช่า" อัตโนมัติ</p>
                      <p>• <strong className="text-red-600">⚠️ ต้องมีห้องว่างและผู้เช่าที่ยังไม่มีห้อง</strong></p>
                    </>
                  )}
                  <div className="mt-3 pt-3 border-t border-blue-300">
                    <p className="text-blue-900 font-semibold text-base">
                      📊 สรุปจำนวนที่จะสร้าง:
                    </p>
                    {testDataForm.entityType === 'CompleteSet' ? (
                      <>
                        <p className="text-blue-900 font-bold text-lg mt-1">
                          • จำนวนชุด: <span className="text-green-600 text-2xl">{testDataForm.quantity}</span> ชุด
                        </p>
                        <p className="text-purple-700 font-bold text-base mt-1">
                          • รายการรวม: <span className="text-purple-600 text-xl">{parseInt(testDataForm.quantity) * 4}</span> รายการ
                          <span className="text-slate-600 text-sm"> (ห้อง {testDataForm.quantity} + ผู้เช่า {testDataForm.quantity} + การจอง {testDataForm.quantity} + บิล {testDataForm.quantity})</span>
                        </p>
                        {testDataForm.branchId !== 'current' && (
                          <p className="text-blue-800 text-sm mt-2">
                            • แบ่งเท่าๆ กันใน {branches.length} สาขา (ประมาณ {Math.floor(parseInt(testDataForm.quantity) / branches.length)}-{Math.ceil(parseInt(testDataForm.quantity) / branches.length)} ชุดต่อสาขา)
                          </p>
                        )}
                      </>
                    ) : testDataForm.branchId === 'current' ? (
                      <p className="text-blue-900 font-bold text-lg mt-1">
                        • รวมทั้งหมด: <span className="text-green-600 text-2xl">{testDataForm.quantity}</span> {testDataForm.entityType === 'Room' ? 'ห้อง' : testDataForm.entityType === 'Tenant' ? 'คน' : testDataForm.entityType === 'Payment' ? 'บิล' : 'การจอง'}
                        <span className="text-slate-600 text-base"> (สาขา {localStorage.getItem('selected_branch_name')})</span>
                      </p>
                    ) : (
                      <>
                        <p className="text-blue-900 font-bold text-lg mt-1">
                          • รวมทั้งหมด: <span className="text-green-600 text-2xl">{parseInt(testDataForm.quantity)}</span> {testDataForm.entityType === 'Room' ? 'ห้อง' : testDataForm.entityType === 'Tenant' ? 'คน' : testDataForm.entityType === 'Payment' ? 'บิล' : 'การจอง'}
                        </p>
                        <p className="text-blue-900 font-bold text-base mt-1">
                          • แบ่งเท่าๆ กันใน <span className="text-purple-600">{branches.length} สาขา</span>
                          <span className="text-slate-600 text-sm"> (ประมาณ {Math.floor(parseInt(testDataForm.quantity) / branches.length)}-{Math.ceil(parseInt(testDataForm.quantity) / branches.length)} ต่อสาขา)</span>
                        </p>
                      </>
                    )}
                    {testDataForm.entityType === 'Booking' && (
                      <p className="text-blue-700 text-xs mt-2">
                        * จำนวนจริงขึ้นกับห้องว่างและผู้เช่าที่มีอยู่
                      </p>
                    )}
                    {testDataForm.entityType === 'Payment' && (
                      <p className="text-blue-700 text-xs mt-2">
                        * จำนวนจริงขึ้นกับห้องที่มีผู้เช่าอยู่
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {(testDataForm.entityType === 'Booking' || testDataForm.entityType === 'Payment') && (
                <div className="bg-red-50 rounded-lg p-4 border border-red-300">
                  <h4 className="font-semibold text-red-900 mb-2">⚠️ ข้อกำหนดเบื้องต้น:</h4>
                  <ul className="list-disc ml-5 text-sm text-red-800 space-y-1">
                    {testDataForm.entityType === 'Booking' && (
                      <>
                        <li>ต้องมี <strong>ห้องว่าง (status: available)</strong> ในสาขาก่อน</li>
                        <li>ต้องมี <strong>ผู้เช่าที่ยังไม่มีห้อง</strong> ในสาขาก่อน</li>
                        <li>ถ้าไม่มีห้องว่าง/ผู้เช่า ระบบจะข้ามสาขานั้น</li>
                      </>
                    )}
                    {testDataForm.entityType === 'Payment' && (
                      <>
                        <li>ต้องมี <strong>การจอง (Booking) ที่ active</strong> ในสาขาก่อน</li>
                        <li>ถ้าไม่มีการจอง ระบบจะข้ามสาขานั้น</li>
                        <li><strong>แนะนำ:</strong> ใช้โหมด "ครบชุด" แทนจะสะดวกกว่า</li>
                      </>
                    )}
                  </ul>
                </div>
              )}

              <Button
                onClick={handleGenerateTestData}
                disabled={generatingTestData || (testDataForm.branchId === 'current' && !selectedBranchId) || parseInt(testDataForm.quantity) < 1 || parseInt(testDataForm.quantity) > 10000}
                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg h-14 text-base font-bold"
              >
                {generatingTestData ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    กำลังสร้างข้อมูล... โปรดรอ
                  </>
                ) : testDataForm.entityType === 'CompleteSet' ? (
                  <>
                    <Plus className="w-5 h-5 mr-2" />
                    🎯 สร้างครบชุด {testDataForm.quantity} ชุด ({parseInt(testDataForm.quantity) * 4} รายการ)
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 mr-2" />
                    สร้างข้อมูลทดสอบ ({testDataForm.quantity} รายการ)
                  </>
                )}
              </Button>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  ⏱️ เวลาโดยประมาณ:
                </h4>
                <div className="text-sm text-blue-800 space-y-1">
                  {testDataForm.entityType === 'CompleteSet' ? (
                    <>
                      <p>• จำนวนรายการรวม: <strong>{parseInt(testDataForm.quantity) * 4} รายการ</strong></p>
                      <p>• เวลาโดยประมาณ: <strong>~{Math.ceil(parseInt(testDataForm.quantity) * 0.5)}-{Math.ceil(parseInt(testDataForm.quantity) * 1)} วินาที</strong></p>
                      <p className="text-xs text-blue-600 mt-2">
                        💡 ระบบจะสร้างเป็น batch ๆ ละ 20-25 รายการ เพื่อความเสถียร
                      </p>
                    </>
                  ) : (
                    <>
                      <p>• จำนวน: <strong>{parseInt(testDataForm.quantity)} {
                        testDataForm.entityType === 'Room' ? 'ห้อง' :
                        testDataForm.entityType === 'Tenant' ? 'คน' :
                        testDataForm.entityType === 'Payment' ? 'บิล' : 'การจอง'
                      }</strong></p>
                      <p>• เวลาโดยประมาณ: <strong>~{Math.ceil(parseInt(testDataForm.quantity) / 15)}-{Math.ceil(parseInt(testDataForm.quantity) / 10)} วินาที</strong></p>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-300">
                <h4 className="font-semibold text-amber-900 mb-2">⚠️ ข้อควรระวัง:</h4>
                <ul className="list-disc ml-5 text-sm text-amber-800 space-y-1">
                  <li>ข้อมูลทดสอบจะมี <code className="bg-amber-100 px-1 rounded">[TEST-]</code> ในชื่อ/คำอธิบาย</li>
                  <li>สามารถลบข้อมูลทดสอบทั้งหมดได้ง่ายด้วยปุ่มด้านล่าง</li>
                  <li>การสร้างข้อมูลจำนวนมากอาจใช้เวลา 10-60 วินาที</li>
                  <li><strong>จำนวนที่กรอก = จำนวนรวมทั้งหมด</strong> (ไม่ใช่ต่อสาขา)</li>
                  <li>ถ้าเลือก "ทุกสาขา" ระบบจะแบ่งให้เท่าๆ กันอัตโนมัติ</li>
                  {testDataForm.entityType === 'CompleteSet' && (
                    <li className="text-green-800 font-semibold">⭐ โหมด "ครบชุด" เหมาะสำหรับ Demo และทดสอบระบบแบบครบวงจร!</li>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-purple-300 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-purple-800">
                <Calendar className="w-6 h-6" />
                📅 สร้างข้อมูลจำลอง 5 ปีเต็ม
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-lg p-4 border-2 border-purple-300">
                <h4 className="font-bold text-purple-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  ⭐ สำหรับทดสอบระบบอย่างสมบูรณ์!
                </h4>
                <p className="text-purple-800 text-sm mb-2">
                  สร้างข้อมูลจำลองครบวงจรย้อนหลัง <strong>60 เดือน (5 ปี)</strong> เพื่อทดสอบกราฟ รายงาน และระบบทั้งหมด
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">จำนวนห้องต่อสาขา (1-100)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={yearlyDataForm.roomsPerBranch}
                    onChange={(e) => setYearlyDataForm({ ...yearlyDataForm, roomsPerBranch: e.target.value })}
                    className="text-center text-lg font-bold"
                  />
                </div>

                <div>
                  <Label className="text-sm font-semibold mb-2 block">สาขาเป้าหมาย</Label>
                  <Select
                    value={yearlyDataForm.branchId}
                    onValueChange={(value) => setYearlyDataForm({ ...yearlyDataForm, branchId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสาขาเป้าหมาย" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">
                        เฉพาะสาขาปัจจุบัน ({localStorage.getItem('selected_branch_name') || 'ไม่ระบุ'})
                      </SelectItem>
                      <SelectItem value="all">
                        ทุกสาขา ({branches.length} สาขา)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border-2 border-purple-200">
                <h4 className="font-semibold text-purple-900 mb-3">📦 ข้อมูลที่จะสร้าง:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                    <span className="text-slate-700">🏠 ห้องพัก:</span>
                    <span className="font-bold text-blue-700">
                      {yearlyDataForm.branchId === 'current'
                        ? `${yearlyRoomsPerBranch} ห้อง`
                        : `${yearlyActualTotalRooms} ห้อง`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                    <span className="text-slate-700">👥 ผู้เช่า:</span>
                    <span className="font-bold text-green-700">
                      {yearlyDataForm.branchId === 'current'
                        ? `${yearlyRoomsPerBranch} คน`
                        : `${yearlyActualTotalRooms} คน`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-purple-50 rounded">
                    <span className="text-slate-700">📋 การจอง:</span>
                    <span className="font-bold text-purple-700">
                      {yearlyDataForm.branchId === 'current'
                        ? `${yearlyRoomsPerBranch} สัญญา`
                        : `${yearlyActualTotalRooms} สัญญา`}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-2 bg-orange-50 rounded">
                    <span className="text-slate-700">💰 บิลชำระเงิน:</span>
                    <span className="font-bold text-orange-700">
                      {yearlyDataForm.branchId === 'current'
                        ? `${yearlyRoomsPerBranch * 60} บิล`
                        : `${yearlyActualTotalRooms * 60} บิล`} (60 เดือน)
                    </span>
                  </div>
                  <div className="border-t-2 border-purple-300 pt-2 mt-2">
                    <div className="flex justify-between items-center p-2 bg-gradient-to-r from-purple-100 to-indigo-100 rounded font-bold">
                      <span className="text-purple-900">📦 รวมทั้งหมด:</span>
                      <span className="text-purple-900 text-lg">
                        {yearlyTotalItemsDisplay} รายการ
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  📊 รายละเอียดข้อมูล 5 ปี:
                </h4>
                <ul className="text-sm text-blue-800 space-y-1 list-disc ml-5">
                  <li>สัญญาเช่า: เริ่มต้น 5 ปีย้อนหลัง - สิ้นสุดวันนี้</li>
                  <li>บิลชำระเงิน: 60 บิล/ห้อง (1 บิล/เดือน × 5 ปี)</li>
                  <li>สถานะบิล: 95% ชำระแล้ว (เดือนเก่า), 50-80% ชำระ (2-3 เดือนล่าสุด)</li>
                  <li>ค่าน้ำ-ไฟ: สุ่มหน่วยการใช้งานแต่ละเดือน</li>
                  <li>เหมาะสำหรับทดสอบกราฟแนวโน้มและรายงานระยะยาว</li>
                </ul>
              </div>

              <Button
                onClick={handleGenerateYearlyData}
                disabled={generatingYearlyData || (yearlyDataForm.branchId === 'current' && !selectedBranchId) || parseInt(yearlyDataForm.roomsPerBranch) < 1 || parseInt(yearlyDataForm.roomsPerBranch) > 100}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-lg h-14 text-base font-bold"
              >
                {generatingYearlyData ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    กำลังสร้างข้อมูล 5 ปี... โปรดรอ
                  </>
                ) : (
                  <>
                    <Calendar className="w-5 h-5 mr-2" />
                    📅 สร้างข้อมูล 5 ปีเต็ม ({yearlyTotalItemsDisplay.toLocaleString()} รายการ)
                  </>
                )}
              </Button>

              <Button
                onClick={async () => {
                  if (!confirm('🔥 HEAVY LOAD TEST\n\nจะสร้างข้อมูลจำนวนมหาศาล:\n• 30 ห้อง/สาขา\n• ข้อมูล 3 ปีย้อนหลัง (36 เดือน)\n• ~1,080 บิล/สาขา\n• มิเตอร์และแจ้งซ่อมเพิ่มเติม\n\n⏱️ ใช้เวลา 5-10 นาที\n\nคุณแน่ใจหรือไม่?')) return;
                  
                  setGeneratingYearlyData(true);
                  try {
                    const response = await base44.functions.invoke('generateHeavyLoadTestData', {
                      roomsPerBranch: 30,
                      yearsToGenerate: 3,
                      branch_id: yearlyDataForm.branchId === 'current' ? selectedBranchId : null
                    });

                    if (response.data.success) {
                      toast.success(response.data.message, { duration: 15000 });
                      await queryClient.invalidateQueries();
                    } else {
                      toast.error(response.data.error || 'เกิดข้อผิดพลาด');
                    }
                  } catch (error) {
                    toast.error('เกิดข้อผิดพลาด: ' + error.message);
                  } finally {
                    setGeneratingYearlyData(false);
                  }
                }}
                disabled={generatingYearlyData}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-lg h-14 text-base font-bold"
              >
                {generatingYearlyData ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    กำลังสร้าง HEAVY LOAD (3 ปี)...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    🔥 HEAVY LOAD TEST: 3 ปี (~3,000+ รายการ)
                  </>
                )}
              </Button>

              {/* Massive Load Configuration */}
              <div className="bg-gradient-to-r from-pink-100 to-purple-100 rounded-lg p-4 border-2 border-pink-300">
                <h4 className="font-bold text-pink-900 mb-3 text-lg flex items-center gap-2">
                  <Zap className="w-6 h-6" />
                  🔥 MASSIVE LOAD TEST - กำหนดค่า
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">จำนวนสาขา</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={massiveLoadForm.branchCount}
                      onChange={(e) => setMassiveLoadForm({ ...massiveLoadForm, branchCount: parseInt(e.target.value) || 1 })}
                      className="text-center text-lg font-bold"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">ห้อง/สาขา</Label>
                    <Input
                      type="number"
                      min="1"
                      max="100"
                      value={massiveLoadForm.roomsPerBranch}
                      onChange={(e) => setMassiveLoadForm({ ...massiveLoadForm, roomsPerBranch: parseInt(e.target.value) || 1 })}
                      className="text-center text-lg font-bold"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-semibold mb-2 block">จำนวนปี</Label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      value={massiveLoadForm.yearsToGenerate}
                      onChange={(e) => setMassiveLoadForm({ ...massiveLoadForm, yearsToGenerate: parseInt(e.target.value) || 1 })}
                      className="text-center text-lg font-bold"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 border border-pink-200 mb-4">
                  <h5 className="font-semibold text-pink-900 mb-3">เลือกข้อมูลที่ต้องการสร้าง:</h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-pink-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={massiveLoadForm.createRooms}
                        onChange={(e) => setMassiveLoadForm({ ...massiveLoadForm, createRooms: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <DoorOpen className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium">ห้องพัก</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-pink-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={massiveLoadForm.createTenants}
                        onChange={(e) => setMassiveLoadForm({ ...massiveLoadForm, createTenants: e.target.checked })}
                        className="w-4 h-4"
                        disabled={!massiveLoadForm.createRooms}
                      />
                      <Users className="w-4 h-4 text-green-600" />
                      <span className={`text-sm font-medium ${!massiveLoadForm.createRooms ? 'text-slate-400' : ''}`}>ผู้เช่า</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-pink-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={massiveLoadForm.createBookings}
                        onChange={(e) => setMassiveLoadForm({ ...massiveLoadForm, createBookings: e.target.checked })}
                        className="w-4 h-4"
                        disabled={!massiveLoadForm.createRooms || !massiveLoadForm.createTenants}
                      />
                      <Calendar className="w-4 h-4 text-purple-600" />
                      <span className={`text-sm font-medium ${(!massiveLoadForm.createRooms || !massiveLoadForm.createTenants) ? 'text-slate-400' : ''}`}>การจอง</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-pink-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={massiveLoadForm.createPayments}
                        onChange={(e) => setMassiveLoadForm({ ...massiveLoadForm, createPayments: e.target.checked })}
                        className="w-4 h-4"
                        disabled={!massiveLoadForm.createBookings}
                      />
                      <Wallet className="w-4 h-4 text-orange-600" />
                      <span className={`text-sm font-medium ${!massiveLoadForm.createBookings ? 'text-slate-400' : ''}`}>บิล</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-pink-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={massiveLoadForm.createMeterReadings}
                        onChange={(e) => setMassiveLoadForm({ ...massiveLoadForm, createMeterReadings: e.target.checked })}
                        className="w-4 h-4"
                        disabled={!massiveLoadForm.createRooms}
                      />
                      <Gauge className="w-4 h-4 text-cyan-600" />
                      <span className={`text-sm font-medium ${!massiveLoadForm.createRooms ? 'text-slate-400' : ''}`}>มิเตอร์</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-pink-50 transition-colors">
                      <input
                        type="checkbox"
                        checked={massiveLoadForm.createMaintenance}
                        onChange={(e) => setMassiveLoadForm({ ...massiveLoadForm, createMaintenance: e.target.checked })}
                        className="w-4 h-4"
                        disabled={!massiveLoadForm.createRooms || !massiveLoadForm.createTenants}
                      />
                      <Wrench className="w-4 h-4 text-red-600" />
                      <span className={`text-sm font-medium ${(!massiveLoadForm.createRooms || !massiveLoadForm.createTenants) ? 'text-slate-400' : ''}`}>แจ้งซ่อม</span>
                    </label>
                  </div>
                </div>

                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <h5 className="font-semibold text-purple-900 mb-2">📊 สรุปข้อมูลที่จะสร้าง:</h5>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {massiveLoadForm.createRooms && (
                      <>
                        <div className="text-purple-700">🏢 สาขา:</div>
                        <div className="font-bold text-purple-900">{massiveLoadForm.branchCount} สาขา</div>
                        <div className="text-purple-700">🏠 ห้องพัก:</div>
                        <div className="font-bold text-purple-900">{(massiveLoadForm.branchCount * massiveLoadForm.roomsPerBranch).toLocaleString()} ห้อง</div>
                      </>
                    )}
                    {massiveLoadForm.createTenants && (
                      <>
                        <div className="text-purple-700">👥 ผู้เช่า:</div>
                        <div className="font-bold text-purple-900">{(massiveLoadForm.branchCount * massiveLoadForm.roomsPerBranch).toLocaleString()} คน</div>
                      </>
                    )}
                    {massiveLoadForm.createBookings && (
                      <>
                        <div className="text-purple-700">📋 การจอง:</div>
                        <div className="font-bold text-purple-900">{(massiveLoadForm.branchCount * massiveLoadForm.roomsPerBranch).toLocaleString()} สัญญา</div>
                      </>
                    )}
                    {massiveLoadForm.createPayments && (
                      <>
                        <div className="text-purple-700">💰 บิล:</div>
                        <div className="font-bold text-purple-900">{(massiveLoadForm.branchCount * massiveLoadForm.roomsPerBranch * massiveLoadForm.yearsToGenerate * 12).toLocaleString()} บิล</div>
                      </>
                    )}
                    {massiveLoadForm.createMeterReadings && (
                      <>
                        <div className="text-purple-700">📏 มิเตอร์:</div>
                        <div className="font-bold text-purple-900">{(massiveLoadForm.branchCount * massiveLoadForm.roomsPerBranch * massiveLoadForm.yearsToGenerate * 12).toLocaleString()} รายการ</div>
                      </>
                    )}
                    {massiveLoadForm.createMaintenance && (
                      <>
                        <div className="text-purple-700">🔧 แจ้งซ่อม:</div>
                        <div className="font-bold text-purple-900">~{Math.floor(massiveLoadForm.branchCount * massiveLoadForm.roomsPerBranch * 0.2)} รายการ</div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <Button
                onClick={async () => {
                  const totalRooms = massiveLoadForm.branchCount * massiveLoadForm.roomsPerBranch;
                  const totalPayments = massiveLoadForm.createPayments ? totalRooms * massiveLoadForm.yearsToGenerate * 12 : 0;
                  const totalItems = 
                    (massiveLoadForm.createRooms ? totalRooms : 0) +
                    (massiveLoadForm.createTenants ? totalRooms : 0) +
                    (massiveLoadForm.createBookings ? totalRooms : 0) +
                    totalPayments +
                    (massiveLoadForm.createMeterReadings ? totalPayments : 0) +
                    (massiveLoadForm.createMaintenance ? Math.floor(totalRooms * 0.2) : 0);
                  
                  if (!confirm(`🔥🔥🔥 MASSIVE LOAD TEST\n\nจะสร้างข้อมูลตามที่เลือก:\n\n📊 สรุป:\n${massiveLoadForm.createRooms ? `• ${massiveLoadForm.branchCount} สาขา\n• ${totalRooms.toLocaleString()} ห้องพัก\n` : ''}${massiveLoadForm.createTenants ? `• ${totalRooms.toLocaleString()} ผู้เช่า\n` : ''}${massiveLoadForm.createBookings ? `• ${totalRooms.toLocaleString()} การจอง\n` : ''}${massiveLoadForm.createPayments ? `• ${totalPayments.toLocaleString()} บิล (${massiveLoadForm.yearsToGenerate} ปี)\n` : ''}${massiveLoadForm.createMeterReadings ? `• ${totalPayments.toLocaleString()} มิเตอร์\n` : ''}${massiveLoadForm.createMaintenance ? `• ~${Math.floor(totalRooms * 0.2)} แจ้งซ่อม\n` : ''}\n📦 รวม ~${totalItems.toLocaleString()} รายการ\n\n⏱️ ใช้เวลา 10-20 นาที\n\nคุณแน่ใจหรือไม่?`)) return;
                  
                  // Open dialog and reset state
                  setMassiveLoadOpen(true);
                  setMassiveLoadProgress(0);
                  setMassiveLoadStatus('running');
                  setMassiveLoadMessage('🚀 กำลังเริ่มสร้างข้อมูล MASSIVE LOAD...\nกรุณารอ 10-20 นาที');
                  setMassiveLoadResults(null);
                  setGeneratingYearlyData(true);
                  
                  const startTime = Date.now();
                  
                  try {
                    // Simulate progress updates
                    const progressInterval = setInterval(() => {
                      setMassiveLoadProgress(prev => {
                        if (prev >= 95) return 95;
                        return prev + Math.random() * 5;
                      });
                    }, 3000);
                    
                    setMassiveLoadMessage('📊 กำลังสร้าง 50 สาขา...\n⏳ โปรดรอสักครู่');
                    
                    const response = await base44.functions.invoke('generateMassiveTestData', {
                      branchCount: massiveLoadForm.branchCount,
                      roomsPerBranch: massiveLoadForm.roomsPerBranch,
                      yearsToGenerate: massiveLoadForm.yearsToGenerate,
                      dataTypes: {
                        rooms: massiveLoadForm.createRooms,
                        tenants: massiveLoadForm.createTenants,
                        bookings: massiveLoadForm.createBookings,
                        payments: massiveLoadForm.createPayments,
                        meterReadings: massiveLoadForm.createMeterReadings,
                        maintenance: massiveLoadForm.createMaintenance
                      }
                    });

                    clearInterval(progressInterval);
                    setMassiveLoadProgress(100);

                    const elapsed = ((Date.now() - startTime) / 60000).toFixed(2);

                    if (response.data.success) {
                      setMassiveLoadStatus('completed');
                      setMassiveLoadMessage(`✅ สร้างข้อมูลสำเร็จ!\n\n${response.data.message}\n\n⏱️ ใช้เวลา: ${elapsed} นาที`);
                      setMassiveLoadResults(response.data.results || {});
                      
                      toast.success('สร้างข้อมูล MASSIVE LOAD สำเร็จ!', { duration: 5000 });
                      await queryClient.invalidateQueries();
                    } else {
                      setMassiveLoadStatus('error');
                      setMassiveLoadMessage(`❌ เกิดข้อผิดพลาด:\n${response.data.error || 'ไม่ทราบสาเหตุ'}`);
                      toast.error('เกิดข้อผิดพลาด', { duration: 5000 });
                    }
                  } catch (error) {
                    const elapsed = ((Date.now() - startTime) / 60000).toFixed(2);
                    setMassiveLoadStatus('error');
                    setMassiveLoadMessage(`❌ เกิดข้อผิดพลาดหลังจาก ${elapsed} นาที:\n${error.message}`);
                    toast.error('เกิดข้อผิดพลาด', { duration: 5000 });
                  } finally {
                    setGeneratingYearlyData(false);
                  }
                }}
                disabled={generatingYearlyData}
                className="w-full bg-gradient-to-r from-red-600 via-pink-600 to-purple-600 hover:from-red-700 hover:via-pink-700 hover:to-purple-700 shadow-2xl h-16 text-base font-bold"
              >
                {generatingYearlyData ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>กำลังสร้าง MASSIVE LOAD...</span>
                    </div>
                    <span className="text-xs opacity-90">ดูความคืบหน้าใน Dialog</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-2">
                      <Zap className="w-6 h-6" />
                      <span>🔥 MASSIVE LOAD TEST</span>
                    </div>
                    <span className="text-xs opacity-90">
                      {massiveLoadForm.branchCount} สาขา × {massiveLoadForm.roomsPerBranch} ห้อง × {massiveLoadForm.yearsToGenerate} ปี
                    </span>
                  </div>
                )}
              </Button>

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-300">
                <h4 className="font-semibold text-amber-900 mb-2">⚠️ ข้อควรระวัง:</h4>
                <ul className="list-disc ml-5 text-sm text-amber-800 space-y-1">
                  <li>การสร้างข้อมูล 5 ปีจะใช้เวลานาน (60-300 วินาที หรือ 1-5 นาที)</li>
                  <li>แนะนำเริ่มจาก 5-10 ห้องต่อสาขาก่อน แล้วค่อยเพิ่ม</li>
                  <li>ข้อมูลทั้งหมดจะมี <code className="bg-amber-100 px-1 rounded">[TEST-]</code> ในชื่อ/หมายเหตุ</li>
                  <li>สามารถลบได้ง่ายด้วยปุ่ม "ลบข้อมูลทดสอบ" ด้านล่าง</li>
                  <li>สำหรับข้อมูลจำนวนมาก ({">"}50 ห้อง) ให้ใช้ MASSIVE LOAD TEST แทน</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* ⭐ Card ลบข้อมูลแบบกำหนดเอง */}
          <Card className="bg-gradient-to-br from-orange-50 to-amber-50 border-orange-300 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <Trash2 className="w-6 h-6" />
                🎯 ลบข้อมูลแบบกำหนดเอง (เลือกสาขา + ประเภท)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-orange-100 rounded-lg p-4 border-2 border-orange-300">
                <h4 className="font-bold text-orange-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  ⚠️ เลือกข้อมูลที่ต้องการลบ
                </h4>
                <p className="text-sm text-orange-800">
                  ฟีเจอร์นี้ช่วยให้คุณลบข้อมูลเฉพาะประเภทที่ต้องการ โดยสามารถเลือกสาขาได้
                </p>
              </div>

              <div>
                <Label className="text-sm font-semibold mb-2 block">เลือกสาขา</Label>
                <Select
                  value={customDeleteForm.branchId}
                  onValueChange={(value) => setCustomDeleteForm({ ...customDeleteForm, branchId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกสาขา" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">
                      🏢 สาขาปัจจุบัน ({localStorage.getItem('selected_branch_name') || 'ไม่ระบุ'})
                    </SelectItem>
                    <SelectItem value="all">
                      🌐 ทุกสาขา (ระวัง!)
                    </SelectItem>
                    {branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.branch_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
               <Label className="text-sm font-semibold mb-3 block">เลือกประเภทข้อมูลที่ต้องการลบ</Label>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                 {[
                   { key: 'Payment', label: '💰 การชำระเงิน', icon: Wallet },
                   { key: 'MeterReading', label: '📏 บันทึกมิเตอร์', icon: Gauge },
                   { key: 'Booking', label: '📅 การจอง', icon: Calendar },
                   { key: 'Tenant', label: '👥 ผู้เช่า', icon: Users },
                   { key: 'Room', label: '🏠 ห้องพัก', icon: DoorOpen },
                   { key: 'MaintenanceRequest', label: '🔧 แจ้งซ่อม', icon: Wrench },
                   { key: 'Expense', label: '💸 ค่าใช้จ่าย', icon: Wallet },
                   { key: 'Contract', label: '📄 สัญญา', icon: FileText },
                   { key: 'MaterialDelivery', label: '📦 พัสดุ', icon: Database }
                 ].map(({ key, label, icon: Icon }) => (
                   <label 
                     key={key}
                     className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                       customDeleteForm.entityTypes[key] 
                         ? 'bg-red-100 border-red-400 text-red-900' 
                         : 'bg-white border-slate-200 hover:border-orange-300'
                     }`}
                   >
                     <input
                       type="checkbox"
                       checked={customDeleteForm.entityTypes[key]}
                       onChange={(e) => setCustomDeleteForm({
                         ...customDeleteForm,
                         entityTypes: { ...customDeleteForm.entityTypes, [key]: e.target.checked }
                       })}
                       className="w-4 h-4"
                     />
                     <Icon className="w-4 h-4" />
                     <span className="text-sm font-medium">{label}</span>
                   </label>
                 ))}
               </div>
              </div>

              {/* Quick Action Button: Delete All Payments Except Wresident */}
              <div className="bg-gradient-to-r from-red-100 to-pink-100 rounded-lg p-4 border-2 border-red-300">
               <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                 <Zap className="w-5 h-5" />
                 ⚡ Quick Action
               </h4>
               <Button
                 onClick={async () => {
                   const wresdentBranch = branches.find(b => 
                     b.branch_name.toLowerCase().includes('wresident') || 
                     b.branch_code === '93'
                   );

                   if (!wresdentBranch) {
                     toast.error('ไม่พบสาขา Wresident');
                     return;
                   }

                   if (!confirm(`⚠️ ยืนยันการลบ Payment ทั้งหมด\n\nจะเก็บไว้เฉพาะสาขา: ${wresdentBranch.branch_name}\n\nข้อมูลที่จะถูกลบ: Payment ของสาขาอื่นทั้งหมด\n\n** การกระทำนี้ไม่สามารถย้อนกลับได้ **`)) {
                     return;
                   }

                   setCustomDeleting(true);
                   setCustomDeleteProgress({ current: 'กำลังลบ Payment...', deleted: 0, total: 0, breakdown: {} });

                   try {
                     const response = await base44.functions.invoke('deletePaymentsExceptBranch', {
                       keep_branch_id: wresdentBranch.id
                     });

                     if (response.data.success) {
                       toast.success(response.data.message, { duration: 5000 });
                       await queryClient.invalidateQueries(['payments']);
                       await queryClient.invalidateQueries(['allPaymentsTestingAdmin']);
                     } else {
                       toast.error('เกิดข้อผิดพลาด: ' + response.data.error);
                     }
                   } catch (error) {
                     toast.error('เกิดข้อผิดพลาด: ' + error.message);
                   } finally {
                     setCustomDeleting(false);
                   }
                 }}
                 disabled={customDeleting}
                 className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700"
               >
                 {customDeleting ? (
                   <>
                     <Loader2 className="w-5 h-5 animate-spin mr-2" />
                     กำลังลบ Payment...
                   </>
                 ) : (
                   <>
                     <Trash2 className="w-5 h-5 mr-2" />
                     ลบ Payment ทั้งหมด ยกเว้น Wresident
                   </>
                 )}
               </Button>
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomDeleteForm({
                    ...customDeleteForm,
                    entityTypes: {
                      Payment: true, MeterReading: true, Booking: false, Tenant: false,
                      Room: false, MaintenanceRequest: true, Expense: true, Contract: false, MaterialDelivery: true
                    }
                  })}
                >
                  เลือกข้อมูลทั่วไป
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomDeleteForm({
                    ...customDeleteForm,
                    entityTypes: {
                      Payment: true, MeterReading: true, Booking: true, Tenant: true,
                      Room: true, MaintenanceRequest: true, Expense: true, Contract: true, MaterialDelivery: true
                    }
                  })}
                >
                  เลือกทั้งหมด
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomDeleteForm({
                    ...customDeleteForm,
                    entityTypes: {
                      Payment: false, MeterReading: false, Booking: false, Tenant: false,
                      Room: false, MaintenanceRequest: false, Expense: false, Contract: false, MaterialDelivery: false
                    }
                  })}
                >
                  ยกเลิกทั้งหมด
                </Button>
              </div>

              {/* Progress Display */}
              {customDeleting && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-3 mb-3">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="font-semibold text-blue-800">{customDeleteProgress.current}</span>
                  </div>
                  <p className="text-sm text-blue-700 mb-2">
                    ลบไปแล้ว: <strong>{customDeleteProgress.deleted.toLocaleString()}</strong> รายการ
                  </p>
                  {Object.keys(customDeleteProgress.breakdown).length > 0 && (
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {Object.entries(customDeleteProgress.breakdown).map(([entity, count]) => (
                        <div key={entity} className="flex justify-between bg-white rounded px-2 py-1">
                          <span>{entity}:</span>
                          <span className="font-bold">{count.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Button
                onClick={handleCustomDelete}
                disabled={customDeleting || Object.values(customDeleteForm.entityTypes).every(v => !v)}
                className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-lg h-14 text-base font-bold"
              >
                {customDeleting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    กำลังลบข้อมูล... ({customDeleteProgress.deleted.toLocaleString()} รายการ)
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    🎯 ลบข้อมูลที่เลือก
                  </>
                )}
              </Button>

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h4 className="font-semibold text-amber-900 mb-2">💡 หมายเหตุ:</h4>
                <ul className="text-sm text-amber-800 space-y-1 list-disc ml-5">
                  <li>ระบบจะลบข้อมูลทีละ batch เพื่อป้องกัน Rate Limit</li>
                  <li>หากข้อมูลมีจำนวนมาก อาจใช้เวลาหลายนาที</li>
                  <li>ข้อมูลที่ลบจะไม่สามารถกู้คืนได้</li>
                  <li><strong>คำแนะนำ:</strong> ลบ Payment และ MeterReading ก่อน แล้วค่อยลบ Booking/Tenant</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-pink-50 border-red-300 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <Trash2 className="w-6 h-6" />
                🗑️ ลบข้อมูลทดสอบทั้งหมด
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-100 rounded-lg p-4 border-2 border-red-300">
                <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  ⚠️ คำเตือน: การกระทำนี้ไม่สามารถย้อนกลับได้!
                </h4>
                <p className="text-red-800 text-sm mb-3">
                  ระบบจะลบข้อมูลทดสอบทั้งหมดที่สร้างผ่านฟีเจอร์นี้:
                </p>
                <ul className="list-disc ml-5 text-sm text-red-800 space-y-1">
                  <li><strong>ห้องพัก</strong> ที่มี <code className="bg-red-200 px-1 rounded">TEST-</code> ในหมายเลขห้อง หรือ <code className="bg-red-200 px-1 rounded">[TEST-]</code> ในคำอธิบาย</li>
                  <li><strong>ผู้เช่า</strong> ที่มี <code className="bg-red-200 px-1 rounded">[TEST-]</code> ในชื่อหรือหมายเหตุ</li>
                  <li><strong>การจอง</strong> ที่มี <code className="bg-red-200 px-1 rounded">[TEST-]</code> ในหมายเหตุ</li>
                  <li><strong>การชำระเงิน</strong> ที่มี <code className="bg-red-200 px-1 rounded">[TEST-]</code> ในหมายเหตุ</li>
                </ul>
              </div>

              {(allRooms.length > 0 || allTenants.length > 0) && (
                <div className="bg-white rounded-lg p-4 border-2 border-slate-200">
                  <h4 className="font-semibold text-slate-900 mb-3">📊 ข้อมูลทดสอบในระบบ:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <span className="text-slate-700">ห้องพักทดสอบ:</span>
                      <Badge className="bg-blue-600 text-white text-base px-3 py-1">
                        {allRooms.filter(r =>
                          r.room_number?.includes('TEST-') || r.description?.includes('[TEST-')
                        ).length} ห้อง
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <span className="text-slate-700">ผู้เช่าทดสอบ:</span>
                      <Badge className="bg-green-600 text-white text-base px-3 py-1">
                        {allTenants.filter(t =>
                          t.full_name?.includes('[TEST-') || t.notes?.includes('[TEST-')
                        ).length} คน
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold mb-2 block">เลือกสาขาที่จะลบข้อมูลทดสอบ</Label>
                  <Select
                    value={testDataDeleteForm.branchId}
                    onValueChange={(value) => setTestDataDeleteForm({ ...testDataDeleteForm, branchId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกสาขา" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">
                        🏢 สาขาปัจจุบัน ({localStorage.getItem('selected_branch_name') || 'ไม่ระบุ'})
                      </SelectItem>
                      <SelectItem value="all">
                        🌐 ทุกสาขา (ระวัง!)
                      </SelectItem>
                      {branches.map(branch => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.branch_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {deletingTestDataByBranch && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-3 mb-3">
                      <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                      <span className="font-semibold text-blue-800">{testDataDeleteProgress.current}</span>
                    </div>
                    <p className="text-sm text-blue-700 mb-2">
                      ลบไปแล้ว: <strong>{testDataDeleteProgress.deleted.toLocaleString()}</strong> รายการ
                    </p>
                    {Object.keys(testDataDeleteProgress.breakdown).length > 0 && (
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(testDataDeleteProgress.breakdown).map(([entity, count]) => (
                          <div key={entity} className="flex justify-between bg-white rounded px-2 py-1">
                            <span>{entity}:</span>
                            <span className="font-bold">{count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Button
                  onClick={handleDeleteTestDataByBranch}
                  disabled={deletingTestDataByBranch}
                  className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 shadow-lg h-12 text-base font-bold"
                >
                  {deletingTestDataByBranch ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      กำลังลบ... ({testDataDeleteProgress.deleted.toLocaleString()} รายการ)
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5 mr-2" />
                      🎯 ลบข้อมูลทดสอบในสาขาที่เลือก
                    </>
                  )}
                </Button>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Button
                    onClick={handleDeleteTestDataWithProgress}
                    disabled={deletionProgress.show && !deletionProgress.isComplete}
                    className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 shadow-lg h-12 text-base font-bold"
                  >
                    {deletionProgress.show && !deletionProgress.isComplete ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        กำลังลบ...
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-5 h-5 mr-2" />
                        ลบทุกสาขาแบบมี Progress
                      </>
                    )}
                  </Button>

                  <Button
                    onClick={handleDeleteTestData}
                    disabled={deleteTestDataMutation.isPending}
                    className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-lg h-12 text-base font-bold"
                  >
                    {deleteTestDataMutation.isPending ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        กำลังลบเร็ว...
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5 mr-2" />
                        ลบทุกสาขาแบบเร็ว
                      </>
                    )}
                  </Button>
                </div>
              </div>

              <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-300">
                <h4 className="font-semibold text-yellow-900 mb-2">💡 หมายเหตุ:</h4>
                <ul className="list-disc ml-5 text-sm text-yellow-800 space-y-1">
                  <li>ข้อมูลที่ลบจะถูกลบถาวร ไม่สามารถกู้คืนได้</li>
                  <li>ระบบจะลบเฉพาะข้อมูลที่มี tag <code className="bg-yellow-200 px-1 rounded">[TEST-]</code> หรือ <code className="bg-yellow-200 px-1 rounded">TEST-</code></li>
                  <li>ข้อมูลจริงของคุณจะไม่ถูกกระทบ</li>
                  <li>หลังจากลบแล้ว หน้าจะ refresh อัตโนมัติ</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-300 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-800">
                <Zap className="w-6 h-6" />
                🖼️ Browserless.io - สำหรับสร้างใบเสร็จรูปภาพ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-indigo-100 rounded-lg p-4 border-2 border-indigo-300">
                <h4 className="font-bold text-indigo-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  📌 Browserless.io คืออะไร?
                </h4>
                <p className="text-sm text-indigo-800 mb-2">
                  Browserless.io เป็นบริการ Cloud Browser API ที่ใช้สำหรับ:
                </p>
                <ul className="text-sm text-indigo-800 list-disc ml-5 space-y-1">
                  <li>แปลง HTML เป็นรูปภาพ PNG อัตโนมัติ</li>
                  <li>สร้างใบเสร็จรูปภาพที่สวยงามจาก HTML template</li>
                  <li>ส่งใบเสร็จทาง LINE ได้โดยตรง</li>
                </ul>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-indigo-800 text-lg">📋 ขั้นตอนการตั้งค่า Browserless.io</h4>

                <div className="bg-white rounded-lg p-4 border border-indigo-200 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">1</div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-slate-800 mb-1">สมัครสมาชิก Browserless.io (ฟรี)</h5>
                      <p className="text-sm text-slate-600 mb-2">
                        ไปที่ <a href="https://www.browserless.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline font-semibold hover:text-blue-800">browserless.io <ExternalLink className="w-3 h-3 inline" /></a> และสมัครสมาชิก
                      </p>
                      <div className="bg-green-50 rounded p-2 border border-green-200">
                        <p className="text-xs text-green-800">
                          💡 <strong>Plan ฟรี:</strong> 6,000 API calls ต่อเดือน (เพียงพอสำหรับหอพักขนาดกลาง)
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">2</div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-slate-800 mb-1">คัดลอก API Key</h5>
                      <p className="text-sm text-slate-600 mb-2">
                        ไปที่ <strong>Dashboard → API Keys</strong> แล้วคัดลอก API Key
                      </p>
                      <div className="bg-amber-50 rounded p-2 border border-amber-200">
                        <p className="text-xs text-amber-800">
                          ⚠️ <strong>คำเตือน:</strong> เก็บ API Key ให้ปลอดภัย อย่าแชร์ให้ผู้อื่น
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold flex-shrink-0">3</div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-slate-800 mb-1">ตั้งค่า API Key ในระบบ</h5>
                      <p className="text-sm text-slate-600 mb-2">
                        ไปที่ <strong>Dashboard → Settings → Environment Variables</strong>
                      </p>
                      <div className="bg-slate-100 rounded p-3 space-y-2">
                        <div>
                          <p className="text-xs text-slate-600 font-semibold mb-1">Variable Name:</p>
                          <code className="bg-slate-800 text-white px-2 py-1 rounded text-xs">BROWSERLESS_API_KEY</code>
                        </div>
                        <div>
                          <p className="text-xs text-slate-600 font-semibold mb-1">Value:</p>
                          <code className="bg-slate-200 text-slate-800 px-2 py-1 rounded text-xs">[วาง API Key ที่คัดลอกไว้]</code>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-600 text-white flex items-center justify-center font-bold flex-shrink-0">✓</div>
                    <div className="flex-1">
                      <h5 className="font-semibold text-green-800 mb-1">เสร็จสิ้น! ทดสอบการใช้งาน</h5>
                      <p className="text-sm text-slate-600 mb-2">
                        ไปที่ <strong>หน้าการชำระเงิน</strong> → เลือกรายการที่ชำระแล้ว → กด <strong>"ส่งใบเสร็จทาง LINE"</strong>
                      </p>
                      <div className="bg-green-50 rounded p-2 border border-green-200">
                        <p className="text-xs text-green-800">
                          ✅ ระบบจะสร้างรูปใบเสร็จอัตโนมัติและส่งทาง LINE ให้ผู้เช่า
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-300">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  💡 ข้อมูลเพิ่มเติม
                </h4>
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <p><strong>URL Endpoint ที่ใช้:</strong> <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">https://production-sfo.browserless.io/screenshot</code></p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <p><strong>ฟังก์ชันที่เกี่ยวข้อง:</strong> <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">generateReceiptImage</code> และ <code className="bg-slate-200 px-1 py-0.5 rounded text-xs">sendReceipt</code></p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <p><strong>การใช้งาน:</strong> 1 ใบเสร็จ = 1 API call (~166 ใบเสร็จต่อวัน สำหรับ plan ฟรี)</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-600 font-bold">•</span>
                    <p><strong>ตรวจสอบ Usage:</strong> ดูได้ที่ <a href="https://cloud.browserless.io/account" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">Browserless Dashboard <ExternalLink className="w-3 h-3 inline" /></a></p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                <h4 className="font-semibold text-purple-800 mb-3">❓ คำถามที่พบบ่อย (FAQ)</h4>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="font-semibold text-purple-900 mb-1">Q: ถ้า API calls หมดจะเกิดอะไรขึ้น?</p>
                    <p className="text-purple-800">A: ระบบจะไม่สามารถสร้างรูปใบเสร็จได้ แต่ยังสามารถส่งใบเสร็จแบบ Flex Message ทาง LINE ได้ปกติ หรืออัปเกรด Plan ได้ที่ Browserless.io</p>
                  </div>
                  <div>
                    <p className="font-semibold text-purple-900 mb-1">Q: สามารถใช้ Self-hosted Browserless ได้ไหม?</p>
                    <p className="text-purple-800">A: ได้ครับ แต่ต้องแก้ไข URL endpoint ในไฟล์ <code className="bg-purple-100 px-1 rounded">functions/generateReceiptImage.js</code></p>
                  </div>
                  <div>
                    <p className="font-semibold text-purple-900 mb-1">Q: ใบเสร็จถูกเก็บไว้ที่ไหน?</p>
                    <p className="text-purple-800">A: รูปใบเสร็จจะถูกอัปโหลดไปยัง Supabase Storage และบันทึก URL ลงใน <code className="bg-purple-100 px-1 rounded">Payment.receipt_image_url</code></p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-4 border border-slate-300">
                <h4 className="font-semibold text-slate-800 mb-3">💰 Browserless.io Plans</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                    <h5 className="font-bold text-green-800 mb-1">Free</h5>
                    <p className="text-2xl font-bold text-green-900 mb-1">$0<span className="text-sm font-normal">/เดือน</span></p>
                    <ul className="text-xs text-green-700 space-y-1">
                      <li>• 6,000 API calls</li>
                      <li>• 60 seconds timeout</li>
                      <li>• เหมาะสำหรับทดสอบ</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 border-2 border-blue-400 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <h5 className="font-bold text-blue-800">Starter</h5>
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">แนะนำ</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-900 mb-1">$50<span className="text-sm font-normal">/เดือน</span></p>
                    <ul className="text-xs text-blue-700 space-y-1">
                      <li>• 50,000 API calls</li>
                      <li>• 120 seconds timeout</li>
                      <li>• เหมาะสำหรับหอพักขนาดกลาง-ใหญ่</li>
                    </ul>
                  </div>
                  <div className="bg-purple-50 border border-purple-300 rounded-lg p-3">
                    <h5 className="font-bold text-purple-800 mb-1">Business</h5>
                    <p className="text-2xl font-bold text-purple-900 mb-1">$150<span className="text-sm font-normal">/เดือน</span></p>
                    <ul className="text-xs text-purple-700 space-y-1">
                      <li>• 200,000 API calls</li>
                      <li>• 240 seconds timeout</li>
                      <li>• เหมาะสำหรับองค์กรขนาดใหญ่</li>
                    </ul>
                  </div>
                </div>
                <p className="text-xs text-slate-500 text-center mt-3">
                  💡 ดูข้อมูลเพิ่มเติมและราคาล่าสุดได้ที่ <a href="https://www.browserless.io/pricing" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">browserless.io/pricing <ExternalLink className="w-3 h-3 inline" /></a>
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-300 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-blue-800">
                <Zap className="w-6 h-6" />
                🔗 Webhook URLs สำหรับตั้งค่า Cron Job
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-100 rounded-lg p-4 border-2 border-blue-300">
                <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  📌 สำคัญ: ต้องตั้งค่า Cron Job เพื่อให้ระบบทำงานอัตโนมัติ
                </h4>
                <p className="text-sm text-blue-800 mb-2">
                  คัดลอก URL ด้านล่างไปตั้งค่าที่ <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-blue-900">cron-job.org <ExternalLink className="w-3 h-3 inline" /></a> (ฟรี)
                </p>
              </div>

              <div className="space-y-3 bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-green-600" />
                  <h4 className="font-semibold text-slate-800">1. สร้างบิลรายเดือนอัตโนมัติ</h4>
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-1 block">URL:</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`${window.location.origin}/api/functions/generateMonthlyBills`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(`${window.location.origin}/api/functions/generateMonthlyBills`)}
                      title="คัดลอก URL"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                  <p className="text-sm text-green-800">
                    <strong>⏰ ตั้งเวลา:</strong> ทุกวันเวลา 00:01 น. (จะทำงานเฉพาะวันที่ {billGenerationDay})<br/>
                    <strong>📅 Cron Expression:</strong> <code className="bg-green-100 px-2 py-0.5 rounded">1 0 * * *</code><br/>
                    <strong>🔧 Method:</strong> POST
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  <h4 className="font-semibold text-slate-800">2. แจ้งเตือนในวันครบกำหนดชำระ</h4>
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-1 block">URL:</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`${window.location.origin}/api/functions/sendDueDateReminders`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(`${window.location.origin}/api/functions/sendDueDateReminders`)}
                      title="คัดลอก URL"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
                  <p className="text-sm text-orange-800">
                    <strong>⏰ ตั้งเวลา:</strong> ทุกวันเวลา 09:00 น. (จะส่งเฉพาะบิลที่ครบกำหนดวันนี้)<br/>
                    <strong>📅 Cron Expression:</strong> <code className="bg-orange-100 px-2 py-0.5 rounded">0 9 * * *</code><br/>
                    <strong>🔧 Method:</strong> POST<br/>
                    <strong>💡 หมายเหตุ:</strong> ต้องเปิดใช้งานในหน้าตั้งค่า → อัตราค่าใช้จ่าย
                  </p>
                </div>
              </div>

              <div className="space-y-3 bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-purple-600" />
                  <h4 className="font-semibold text-slate-800">3. แจ้งเตือนบิลล่วงหน้า</h4>
                </div>
                <div>
                  <Label className="text-sm font-semibold mb-1 block">URL:</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`${window.location.origin}/api/functions/sendAdvanceReminders`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(`${window.location.origin}/api/functions/sendAdvanceReminders`)}
                      title="คัดลอก URL"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                  <p className="text-sm text-purple-800">
                    <strong>⏰ ตั้งเวลา:</strong> ทุกวันเวลา 09:00 น. (จะส่งตามจำนวนวันที่ตั้งค่าไว้)<br/>
                    <strong>📅 Cron Expression:</strong> <code className="bg-purple-100 px-2 py-0.5 rounded">0 9 * * *</code><br/>
                    <strong>🔧 Method:</strong> POST<br/>
                    <strong>💡 หมายเหตุ:</strong> ตั้งจำนวนวันล่วงหน้าได้ในหน้าตั้งค่า → อัตราค่าใช้จ่าย
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-lg p-4 border border-slate-300">
                <h4 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Check className="w-5 h-5 text-green-600" />
                  📚 ขั้นตอนการตั้งค่า Cron Job
                </h4>
                <ol className="space-y-2 text-sm text-slate-700 list-decimal ml-5">
                  <li>ไปที่ <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">cron-job.org</a> และสมัครสมาชิก (ฟรี)</li>
                  <li>คลิก "Create Cron Job" เพื่อสร้าง job ใหม่</li>
                  <li>คัดลอก URL จากด้านบน แล้ววางลงในช่อง URL</li>
                  <li>เลือก Method เป็น <strong>POST</strong></li>
                  <li>ตั้งเวลาตาม Cron Expression ที่แนะนำ</li>
                  <li>บันทึก และทำซ้ำสำหรับทุก webhook</li>
                </ol>
              </div>

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-300">
                <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  💡 เคล็ดลับ:
                </h4>
                <ul className="space-y-1 text-sm text-amber-700 list-disc ml-5">
                  <li>ใช้ชื่อ Cron Job ที่เข้าใจง่าย เช่น "หอพักดีดี - สร้างบิลอัตโนมัติ"</li>
                  <li>เปิด Email Notification เพื่อรับแจ้งเตือนเมื่อ Cron Job ล้มเหลว</li>
                  <li>ตรวจสอบ Log ใน cron-job.org เป็นประจำเพื่อให้แน่ใจว่าทำงานถูกต้อง</li>
                  <li>Webhook #2 และ #3 จะทำงานเฉพาะเมื่อมีการเปิดใช้งานในหน้าตั้งค่า</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-300 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800">
                <Database className="w-6 h-6" />
                รีเซ็ตข้อมูลระบบ (อันตราย!)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-100 rounded-lg p-4 border-2 border-red-300">
                <h4 className="font-bold text-red-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  ⚠️ คำเตือนสำคัญมาก!
                </h4>
                <ul className="space-y-2 text-sm text-red-800 list-disc ml-5">
                  <li><strong>การกระทำนี้จะลบข้อมูลทั้งหมดในระบบอย่างถาวร</strong></li>
                  <li>ข้อมูลที่จะถูกลบ: การชำระเงิน, บันทึกมิเตอร์, สัญญาเช่า, การจองห้อง, คำขอซ่อม, ค่าใช้จ่าย, และผู้เช่า</li>
                  <li>ข้อมูลที่จะไม่ถูกลบ: ห้องพัก, การตั้งค่า, และผู้ใช้งาน</li>
                  <li><strong className="text-red-900">ไม่สามารถย้อนกลับได้!</strong></li>
                  <li>ใช้ฟังก์ชันนี้เฉพาะในโหมดทดสอบเท่านั้น</li>
                </ul>
              </div>

              <div className="bg-amber-100 rounded-lg p-4 border border-amber-300">
                <h4 className="font-semibold text-amber-900 mb-2">🎯 เมื่อไหร่ควรใช้:</h4>
                <ul className="space-y-1 text-sm text-amber-800 list-disc ml-5">
                  <li>เมื่อต้องการเริ่มต้นระบบใหม่หลังจากทดสอบ</li>
                  <li>เมื่อต้องการลบข้อมูลทดสอบทั้งหมด</li>
                  <li>ก่อนส่งมอบระบบให้ลูกค้า (เพื่อเริ่มต้นสะอาด)</li>
                </ul>
              </div>

              <Button
                onClick={handleResetData}
                disabled={resetting}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 shadow-lg h-12 text-base font-bold"
              >
                {resetting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    กำลังลบข้อมูล...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5 mr-2" />
                    🚨 รีเซ็ตข้อมูลทั้งหมด (อันตราย!)
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-300 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-800">
                <MessageSquare className="w-6 h-6" />
                🧪 ทดสอบการแจ้งเตือน LINE
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-green-100 rounded-lg p-4 border-2 border-green-300">
                <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  📌 วิธีหา LINE User ID ของคุณ
                </h4>
                <ol className="text-sm text-green-800 space-y-2 list-decimal ml-5">
                  <li>Add LINE Official Account ของหอพัก (สาขาที่เลือก)</li>
                  <li>ส่งข้อความอะไรก็ได้ถึง Bot</li>
                  <li>ไปที่หน้า <strong>ทดสอบ LINE</strong> → คัดลอก LINE User ID ของคุณ</li>
                  <li>นำมาวางในช่องด้านล่าง</li>
                </ol>
              </div>

              <div>
                <Label className="text-sm font-semibold mb-2 block">LINE User ID ของคุณ</Label>
                <Input
                  placeholder="เช่น Uxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={testLineUserId}
                  onChange={(e) => setTestLineUserId(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  💡 User ID จะขึ้นต้นด้วย "U" ตามด้วยตัวอักษร 33 ตัว
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <h4 className="font-semibold text-blue-800 mb-2">📋 ข้อมูลการตั้งค่าปัจจุบัน:</h4>
                <div className="space-y-1 text-sm text-blue-700">
                  <p>📅 <strong>วันครบกำหนดชำระ:</strong> วันที่ {billDueDay} ของทุกเดือน</p>
                  <p>⏰ <strong>แจ้งบิลล่วงหน้า:</strong> {advanceNoticeDays} วันก่อนครบกำหนด</p>
                  <p>🏢 <strong>สาขาปัจจุบัน:</strong> {localStorage.getItem('selected_branch_name') || 'ไม่ระบุ'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  onClick={() => handleTestReminders('advance')}
                  disabled={testingReminders || !testLineUserId.trim()}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg h-12"
                >
                  {testingReminders ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      กำลังส่ง...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      ทดสอบแจ้งล่วงหน้า
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => handleTestReminders('duedate')}
                  disabled={testingReminders || !testLineUserId.trim()}
                  className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 shadow-lg h-12"
                >
                  {testingReminders ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      กำลังส่ง...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5 mr-2" />
                      ทดสอบแจ้งวันครบกำหนด
                    </>
                  )}
                </Button>
              </div>

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <h4 className="font-semibold text-amber-900 mb-2">💡 วิธีการทดสอบ:</h4>
                <ul className="text-sm text-amber-800 space-y-1 list-disc ml-5">
                  <li><strong>แจ้งล่วงหน้า:</strong> ส่งข้อความตัวอย่างว่าจะแจ้งอย่างไรก่อนครบกำหนด {advanceNoticeDays} วัน</li>
                  <li><strong>แจ้งวันครบกำหนด:</strong> ส่งข้อความตัวอย่างว่าจะแจ้งอย่างไรในวันที่ {billDueDay}</li>
                  <li>ข้อความจะส่งไปยัง LINE User ID ที่กรอก ไม่ได้ส่งให้ผู้เช่าจริง</li>
                  <li>ใช้บิลตัวอย่างจากระบบ (ถ้ามี)</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-600" />
                ทดสอบการสร้างบิลอัตโนมัติ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-blue-800">ข้อมูลการตั้งค่า:</h4>
                  <Button
                    onClick={() => refetchConfigs()}
                    size="sm"
                    variant="ghost"
                    className="h-8 text-blue-600 hover:bg-blue-100"
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    รีเฟรช
                  </Button>
                </div>
                <div className="space-y-1 text-sm text-blue-700">
                  <p>📅 <strong>วันที่สร้างบิลอัตโนมัติ (Global):</strong> วันที่ {billGenerationDay} ของทุกเดือน</p>
                  <p>💰 <strong>วันครบกำหนดชำระ:</strong> วันที่ {billDueDay} ของทุกเดือน</p>
                  <p>🏢 <strong>สาขาปัจจุบัน:</strong> {localStorage.getItem('selected_branch_name') || 'ไม่ระบุ'}</p>
                  <p>💡 <strong>หมายเหตุ:</strong> ปุ่มสร้างบิลจะทำงานเหมือน Cron Job โดยจะตรวจสอบว่าวันนี้เป็นวันสร้างบิลของสาขาหรือไม่ หากไม่ตรงวัน บิลจะไม่ถูกสร้าง</p>
                </div>
              </div>

              {/* แสดงสาขาที่มีบิลเดือนนี้แล้ว */}
              {branchesWithBillsThisMonth.length > 0 && (
                <div className="bg-amber-50 rounded-lg p-4 border-2 border-amber-300">
                  <h4 className="font-bold text-amber-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5" />
                    ⚠️ สาขาที่มีบิลเดือนนี้แล้ว ({branchesWithBillsThisMonth.length} สาขา)
                  </h4>
                  <p className="text-sm text-amber-800 mb-3">
                    สาขาเหล่านี้มีการสร้างบิลแล้วสำหรับงวดปัจจุบัน การกดสร้างบิลซ้ำจะไม่มีผล (ระบบป้องกันการสร้างซ้ำอัตโนมัติ)
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {branchesWithBillsThisMonth.map((info) => (
                      <div key={info.branchId} className="bg-white rounded-lg p-3 border border-amber-200 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-800">{info.branchName}</p>
                          <p className="text-xs text-slate-600">
                            บิลงวด {info.dueMonth}/{info.dueYear} ({info.roomsWithBill}/{info.totalRoomsWithBooking} ห้อง)
                          </p>
                        </div>
                        <Badge className="bg-green-100 text-green-700">
                          ✅ มีบิลแล้ว
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  onClick={handleGenerateBills}
                  disabled={generatingBills}
                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg h-12"
                >
                  {generatingBills ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      กำลังสร้างบิล...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 mr-2" />
                      สร้างบิลสาขาปัจจุบัน
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleGenerateAllBranchesBills}
                  disabled={generatingBills}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg h-12"
                >
                  {generatingBills ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      กำลังสร้างบิล...
                    </>
                  ) : (
                    <>
                      <Building2 className="w-5 h-5 mr-2" />
                      สร้างบิลทุกสาขา
                    </>
                  )}
                </Button>
              </div>

              {lastBillGeneration && (
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <h4 className="font-semibold text-green-800 mb-2">✅ ผลการสร้างบิลล่าสุด:</h4>
                    <div className="space-y-2 text-sm text-green-700">
                      <p>• <strong>สถานะ:</strong> {lastBillGeneration.message}</p>
                      <p>• <strong>จำนวนบิลที่สร้าง:</strong> {lastBillGeneration.generatedCount} รายการ</p>
                      <p>• <strong>ขอบเขต:</strong> {lastBillGeneration.targetBranchId === 'all' ? 'ทุกสาขา' : `สาขา ${localStorage.getItem('selected_branch_name')}`}</p>
                      {lastBillGeneration.config && lastBillGeneration.config.dueDate && (
                        <p>• <strong>วันครบกำหนดชำระ:</strong> {format(parseISO(lastBillGeneration.config.dueDate), 'd MMMM yyyy', { locale: th })}</p>
                      )}
                      {lastBillGeneration.errorCount > 0 && (
                        <p className="text-red-600">• <strong>ล้มเหลว:</strong> {lastBillGeneration.errorCount} รายการ</p>
                      )}
                      {lastBillGeneration.generatedBills && lastBillGeneration.generatedBills.length > 0 && (
                        <div className="mt-2">
                          <p className="font-semibold mb-1">รายละเอียด:</p>
                          <ul className="list-disc ml-5 space-y-1 max-h-48 overflow-y-auto">
                            {lastBillGeneration.generatedBills.map((bill, idx) => (
                              <li key={idx}>
                                ห้อง {bill.room}: {bill.amount.toLocaleString()} บาท
                                {bill.dueDate && ` (ครบกำหนด: ${format(parseISO(bill.dueDate), 'd MMM yy', { locale: th })})`}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {lastBillGeneration.errors && lastBillGeneration.errors.length > 0 && (
                        <div className="mt-2">
                          <p className="font-semibold mb-1 text-red-600">ข้อผิดพลาด:</p>
                          <ul className="list-disc ml-5 space-y-1 text-red-600 max-h-32 overflow-y-auto">
                            {lastBillGeneration.errors.map((error, idx) => (
                              <li key={idx}>{error}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <p className="text-sm text-amber-800">
                  <strong>⚠️ คำเตือน:</strong> การกดปุ่ม "สร้างบิลสาขาปัจจุบัน" จะสร้างบิลเฉพาะห้องที่มีผู้เช่าในสาขาปัจจุบัน ส่วนปุ่ม "สร้างบิลทุกสาขา" จะสร้างบิลสำหรับทุกห้องที่มีผู้เช่าในทุกสาขา
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="w-5 h-5 text-purple-600" />
                การตั้งค่าโหมดทดสอบ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <Label className="text-base font-semibold">สถานะโหมดทดสอบ</Label>
                    <p className="text-sm text-slate-500 mt-1">
                      {settings.test_mode_enabled === 'true' ? (
                        <span className="text-green-600 font-semibold">🟢 เปิดใช้งาน</span>
                      ) : (
                        <span className="text-red-600 font-semibold">🔴 ปิดใช้งาน</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="test_mode"
                      checked={settings.test_mode_enabled === 'true'}
                      onChange={(e) => setSettings({
                        ...settings,
                        test_mode_enabled: e.target.checked ? 'true' : 'false'
                      })}
                      className="w-5 h-5"
                    />
                    <Label htmlFor="test_mode" className="cursor-pointer">
                      เปิดใช้งาน
                    </Label>
                  </div>
                </div>

                {settings.test_mode_enabled === 'true' && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2 text-base">
                        <Clock className="w-5 h-5 text-blue-600" />
                        วันที่สำหรับทดสอบ
                      </Label>
                      <Input
                        type="date"
                        value={settings.test_current_date}
                        onChange={(e) => setSettings({ ...settings, test_current_date: e.target.value })}
                        className="text-lg"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSetTestDateToday}
                        className="flex-1"
                      >
                        ตั้งเป็นวันนี้
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleResetTestDate}
                        className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        รีเซ็ต
                      </Button>
                    </div>

                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-2">วันที่ปัจจุบันที่ระบบใช้:</h4>
                      <p className="text-lg font-bold text-blue-900">{getCurrentTestDate()}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <h4 className="font-semibold text-green-800 mb-2">💡 วิธีใช้งาน:</h4>
                <ol className="space-y-2 text-sm text-green-700 list-decimal ml-5">
                  <li>เปิดใช้งานโหมดทดสอบ</li>
                  <li>เลือกวันที่ที่ต้องการทดสอบ (เช่น วันที่หลังจากวันครบกำหนดชำระ)</li>
                  <li>กดบันทึกการตั้งค่า</li>
                  <li>ไปที่หน้าการชำระเงิน จะเห็นค่าปรับคำนวณตามวันที่ที่ตั้งไว้</li>
                  <li>เสร็จแล้วปิดโหมดทดสอบเพื่อใช้วันที่จริง</li>
                </ol>
              </div>

              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <h4 className="font-semibold text-red-800 mb-2">⚠️ ข้อควรระวัง:</h4>
                <ul className="space-y-1 text-sm text-red-700 list-disc ml-5">
                  <li>อย่าลืมปิดโหมดทดสอบหลังใช้งานเสร็จ</li>
                  <li>โหมดทดสอบจะมีผลกับการคำนวณค่าปรับทั้งระบบ</li>
                  <li>ไม่ควรใช้โหมดทดสอบในการใช้งานจริง</li>
                  <li>เมื่อส่งมอบระบบให้ลูกค้า ควรลบหน้านี้หรือซ่อนการเข้าถึง</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button
              onClick={handleSave}
              disabled={createOrUpdateMutation.isPending}
              className={`${
                savedSuccess
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700'
              } shadow-lg transition-all duration-300`}
            >
              {createOrUpdateMutation.isPending ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  กำลังบันทึก...
                </>
              ) : savedSuccess ? (
                <>
                  <Check className="w-5 h-5 mr-2" />
                  บันทึกสำเร็จ!
                </>
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  บันทึกการตั้งค่า
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}