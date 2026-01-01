import React, { useState, useEffect, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Droplets, Zap, Calendar, TrendingUp, Building2, LayoutGrid, Table as TableIcon, Save, History, Check, Trash2, Search, X, AlertTriangle, List, Grid, Gauge, Download, Upload, FileSpreadsheet, Pencil, Sparkles, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import PageHeader from "../components/shared/PageHeader";
import ExcelUploader from "../components/shared/ExcelUploader";

export default function MeterReadings() {
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedReading, setSelectedReading] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingReading, setEditingReading] = useState(null); // สำหรับแก้ไขประวัติ
  const [viewMode, setViewMode] = useState('card');
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [bulkReadings, setBulkReadings] = useState({});
  const [cardReadings, setCardReadings] = useState({}); // สำหรับ Mobile Card View
  const [isMobile, setIsMobile] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [bulkReadingDate, setBulkReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedReadingVersion, setSelectedReadingVersion] = useState('new'); // 'new' หรือ reading.id สำหรับแก้ไข
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [formData, setFormData] = useState({
    room_id: '',
    reading_date: new Date().toISOString().split('T')[0],
    water_current: '',
    electricity_current: '',
    notes: '',
    water_previous: 0, // Added for create/update mutations
    electricity_previous: 0, // Added for create/update mutations
  });

  // ✅ เพิ่ม pagination และ search
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const itemsPerPage = 20;

  const queryClient = useQueryClient();

  // Get selected branch from localStorage
  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name'); // New: Get branch name for PageHeader

  // ตรวจสอบขนาดหน้าจอ
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ✅ Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset page on search change
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const userPermissions = currentUser?.permissions || [];
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  const canView = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('meter_readings_view');
  const canAdd = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('meter_readings_add');
  const canEdit = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('meter_readings_edit');
  const canDelete = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('meter_readings_delete');
  const canEditHistoryPermission = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('meter_readings_edit_history');

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
  };

  // ✅ Backend filtering + Pagination - รองรับ 1M records (SaaS Standard)
  const { data: meterReadings = [], isLoading: readingsLoading } = useQuery({
    queryKey: ['meterReadings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      
      let allData = [];
      let skip = 0;
      const limit = 10000; // ✅ เพิ่ม batch size เป็น 10K เพื่อลด API calls
      let hasMore = true;

      while (hasMore) {
        const batch = await base44.entities.MeterReading.filter(
          { branch_id: selectedBranchId },
          '-reading_date',
          limit,
          skip
        );
        allData = [...allData, ...batch];
        skip += limit;
        
        if (batch.length < limit) hasMore = false;
        if (skip >= 1000000) hasMore = false; // ✅ Circuit breaker - 1M records
      }
      
      console.log(`📊 MeterReadings - Loaded ${allData.length} readings for branch ${selectedBranchId}`);
      return allData;
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  // ✅ Shared query key for cache sharing
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Room',
        filters: { branch_id: selectedBranchId },
        sort: 'room_number',
        limit: 1000
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

  // ✅ Shared query key for cache sharing
  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Booking',
        filters: { branch_id: selectedBranchId, status: 'active' },
        limit: 1000
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

  // ✅ Backend filtering + Pagination - รองรับ 1M records (SaaS Standard)
  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      
      let allData = [];
      let skip = 0;
      const limit = 10000; // ✅ เพิ่ม batch size เป็น 10K
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
        
        if (batch.length < limit) hasMore = false;
        if (skip >= 1000000) hasMore = false; // ✅ Circuit breaker - 1M records
      }
      
      console.log(`📊 MeterReadings - Loaded ${allData.length} tenants for branch ${selectedBranchId}`);
      return allData;
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'], // Removed selectedBranchId, now fetches all configs
    queryFn: async () => {
      return base44.entities.Config.list(); // Fetch all configs
    },
    enabled: canView, // Enabled when canView
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  // Helper to get config value
  const getConfigValue = (key, defaultValue) => {
    // Filter configs by selectedBranchId when accessing the value
    const config = configs.find(c => c.key === key && c.branch_id === selectedBranchId);
    return config ? parseFloat(config.value) : defaultValue;
  };

  const waterRate = getConfigValue('water_rate_per_unit', 20);
  const electricityRate = getConfigValue('electricity_rate_per_unit', 8);

  const allowMeterEditingConfig = configs.find(c => c.key === 'allow_meter_history_editing' && (c.branch_id === selectedBranchId || !c.branch_id));
  const canEditHistory = canEditHistoryPermission && (allowMeterEditingConfig?.value === 'true');

  // ✅ ดาวน์โหลด Template Excel
  const handleDownloadTemplate = () => {
    // ดึงทุกห้องในสาขา (ไม่ว่าจะว่างหรือไม่ว่าง)
    const activeRooms = rooms;
    
    // สร้างข้อมูล CSV พร้อมข้อมูลห้อง
    const headers = ['หมายเลขห้อง', 'ชั้น', 'ผู้เช่า', 'มิเตอร์น้ำครั้งก่อน', 'มิเตอร์น้ำปัจจุบัน', 'มิเตอร์ไฟครั้งก่อน', 'มิเตอร์ไฟปัจจุบัน'];
    
    const rows = activeRooms
      .sort((a, b) => {
        if ((a.floor || 0) !== (b.floor || 0)) {
          return (a.floor || 0) - (b.floor || 0);
        }
        const numA = parseFloat(a.room_number.replace(/\D/g, '')) || 0;
        const numB = parseFloat(b.room_number.replace(/\D/g, '')) || 0;
        return numA - numB;
      })
      .map(room => {
        const booking = getActiveBooking(room.id);
        const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
        const latest = getLatestReading(room.id);
        const waterPrev = latest?.water_current || 0;
        const elecPrev = latest?.electricity_current || 0;
        
        return [
          room.room_number,
          room.floor || '',
          tenant?.full_name || '',
          waterPrev,
          '', // มิเตอร์น้ำปัจจุบัน - ให้กรอก
          elecPrev,
          '' // มิเตอร์ไฟปัจจุบัน - ให้กรอก
        ];
      });

    // สร้าง CSV content พร้อม BOM สำหรับ Excel
    const BOM = '\uFEFF';
    const csvContent = BOM + [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    
    // ดาวน์โหลด
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `บันทึกมิเตอร์_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('ดาวน์โหลดไฟล์สำเร็จ');
  };

  // ✅ Import จาก Excel
  const handleImportData = async (data) => {
    if (!canAdd) {
      toast.error('คุณไม่มีสิทธิ์บันทึกมิเตอร์');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const row of data) {
      const roomNumber = row['หมายเลขห้อง'];
      const waterCurrent = parseFloat(row['มิเตอร์น้ำปัจจุบัน']);
      const electricityCurrent = parseFloat(row['มิเตอร์ไฟปัจจุบัน']);

      // ข้ามถ้าไม่มีข้อมูล
      if (!roomNumber || isNaN(waterCurrent) || isNaN(electricityCurrent)) {
        continue;
      }

      // หาห้อง
      const room = rooms.find(r => r.room_number === roomNumber);
      if (!room) {
        errorCount++;
        continue;
      }

      // หาค่าก่อนหน้า
      const latest = getLatestReading(room.id);
      const waterPrevious = latest?.water_current || 0;
      const electricityPrevious = latest?.electricity_current || 0;

      const waterUnits = waterCurrent - waterPrevious;
      const electricityUnits = electricityCurrent - electricityPrevious;

      try {
        await base44.entities.MeterReading.create({
          room_id: room.id,
          reading_date: new Date().toISOString().split('T')[0],
          water_previous: waterPrevious,
          water_current: waterCurrent,
          electricity_previous: electricityPrevious,
          electricity_current: electricityCurrent,
          water_units: waterUnits,
          electricity_units: electricityUnits,
          branch_id: selectedBranchId,
          notes: 'นำเข้าจาก Excel'
        });
        successCount++;
      } catch (e) {
        errorCount++;
      }
    }

    queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
    
    if (successCount > 0) {
      toast.success(`นำเข้าสำเร็จ ${successCount} ห้อง`);
    }
    if (errorCount > 0) {
      toast.error(`ไม่สามารถนำเข้าได้ ${errorCount} ห้อง`);
    }
  };


  // Mutation สำหรับบันทึกมิเตอร์ทีละห้อง (Mobile Card View)
  const createSingleMutation = useMutation({
    mutationFn: async (data) => {
      if (!canAdd) {
        throw new Error('คุณไม่มีสิทธิ์บันทึกมิเตอร์');
      }
      const previousReadings = meterReadings.filter(r => r.room_id === data.room_id);
      const latestPrevious = previousReadings.length > 0 ? previousReadings[0] : null;

      const waterPrevious = latestPrevious?.water_current || 0;
      const electricityPrevious = latestPrevious?.electricity_current || 0;
      
      const waterCurrent = parseFloat(data.water_current);
      const electricityCurrent = parseFloat(data.electricity_current);

      const waterUnits = waterCurrent - waterPrevious;
      const electricityUnits = electricityCurrent - electricityPrevious;

      const readingData = {
        room_id: data.room_id,
        reading_date: new Date().toISOString().split('T')[0],
        water_previous: waterPrevious,
        water_current: waterCurrent,
        electricity_previous: electricityPrevious,
        electricity_current: electricityCurrent,
        water_units: waterUnits,
        electricity_units: electricityUnits,
        notes: data.notes || '',
        branch_id: selectedBranchId
      };

      return base44.entities.MeterReading.create(readingData);
    },
    onSuccess: async (newReading, variables) => {
      queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
      
      // บันทึก log
      const room = rooms.find(r => r.id === newReading.room_id);
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'create',
        entity_type: 'MeterReading',
        entity_id: newReading.id,
        entity_name: `ห้อง ${room?.room_number || 'N/A'}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `บันทึกมิเตอร์ห้อง ${room?.room_number || 'N/A'} - ไฟ: ${newReading.electricity_units} น้ำ: ${newReading.water_units}`
      });
      
      setCardReadings(prev => {
        const newState = { ...prev };
        delete newState[variables.room_id];
        return newState;
      });
      toast.success('บันทึกมิเตอร์สำเร็จ');
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  });

  // Mutation สำหรับ Desktop (Dialog)
  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!canAdd) {
        throw new Error('คุณไม่มีสิทธิ์บันทึกมิเตอร์');
      }

      const waterCurrent = parseFloat(data.water_current);
      const electricityCurrent = parseFloat(data.electricity_current);
      const waterPrevious = parseFloat(data.water_previous) || 0;
      const electricityPrevious = parseFloat(data.electricity_previous) || 0;

      const waterUnits = waterCurrent - waterPrevious;
      const electricityUnits = electricityCurrent - electricityPrevious;

      // บันทึกเป็น 1 record เดียว (ไม่ต้องสร้าง record ตั้งต้นแยก)
      const meterData = {
        room_id: data.room_id,
        reading_date: data.reading_date,
        water_previous: waterPrevious,
        water_current: waterCurrent,
        electricity_previous: electricityPrevious,
        electricity_current: electricityCurrent,
        water_units: waterUnits,
        electricity_units: electricityUnits,
        notes: data.notes || '',
        branch_id: selectedBranchId
      };

      const meterReading = await base44.entities.MeterReading.create(meterData);
      return meterReading;
    },
    onSuccess: async (newReading) => {
      queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
      queryClient.invalidateQueries(['payments', selectedBranchId]);
      
      // บันทึก log
      const room = rooms.find(r => r.id === newReading.room_id);
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'create',
        entity_type: 'MeterReading',
        entity_id: newReading.id,
        entity_name: `ห้อง ${room?.room_number || 'N/A'}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `บันทึกมิเตอร์ห้อง ${room?.room_number || 'N/A'} - ไฟ: ${newReading.electricity_units} น้ำ: ${newReading.water_units}`
      });
      
      setShowDialog(false);
      resetForm();
      toast.success('บันทึกมิเตอร์สำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (readingsData) => {
      if (!canAdd) {
        throw new Error('คุณไม่มีสิทธิ์บันทึกมิเตอร์');
      }
      const results = [];
      for (const data of readingsData) {
        // ใช้ค่า water_previous และ electricity_previous จาก data ที่ส่งมา
        const waterPrevious = data.water_previous !== undefined && data.water_previous !== '' 
          ? parseFloat(data.water_previous) 
          : 0;
        const electricityPrevious = data.electricity_previous !== undefined && data.electricity_previous !== '' 
          ? parseFloat(data.electricity_previous) 
          : 0;
        
        // ค่าปัจจุบัน
        const waterCurrent = data.water_current !== null && data.water_current !== undefined && data.water_current !== '' 
          ? parseFloat(data.water_current) 
          : waterPrevious;
        const electricityCurrent = data.electricity_current !== null && data.electricity_current !== undefined && data.electricity_current !== '' 
          ? parseFloat(data.electricity_current) 
          : electricityPrevious;

        const waterUnits = waterCurrent - waterPrevious;
        const electricityUnits = electricityCurrent - electricityPrevious;

        const readingData = {
          room_id: data.room_id,
          reading_date: data.reading_date,
          notes: data.notes || '',
          water_previous: waterPrevious,
          water_current: waterCurrent,
          electricity_previous: electricityPrevious,
          electricity_current: electricityCurrent,
          water_units: waterUnits,
          electricity_units: electricityUnits,
          branch_id: selectedBranchId
        };

        const result = await base44.entities.MeterReading.create(readingData);
        results.push(result);
      }
      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
      setBulkReadings({});
      setSelectedReadingVersion('new');
      toast.success(`บันทึกมิเตอร์สำเร็จ ${data.length} ห้อง`);
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  });

  // Mutation สำหรับอัปเดตหลายห้องพร้อมกัน
  const bulkUpdateMutation = useMutation({
    mutationFn: async (readingsData) => {
      if (!canEdit) {
        throw new Error('คุณไม่มีสิทธิ์แก้ไขมิเตอร์');
      }
      const results = [];
      for (const data of readingsData) {
        // หาการบันทึกเดิมของห้องนี้ในวันที่เดียวกัน
        const existingReading = meterReadings.find(r => 
          r.room_id === data.room_id && r.reading_date === bulkReadingDate
        );
        
        if (!existingReading) continue;

        const waterPrevious = data.water_previous !== undefined && data.water_previous !== '' 
          ? parseFloat(data.water_previous) 
          : existingReading.water_previous;
        const electricityPrevious = data.electricity_previous !== undefined && data.electricity_previous !== '' 
          ? parseFloat(data.electricity_previous) 
          : existingReading.electricity_previous;
        
        const waterCurrent = data.water_current !== null && data.water_current !== undefined && data.water_current !== '' 
          ? parseFloat(data.water_current) 
          : existingReading.water_current;
        const electricityCurrent = data.electricity_current !== null && data.electricity_current !== undefined && data.electricity_current !== '' 
          ? parseFloat(data.electricity_current) 
          : existingReading.electricity_current;

        const waterUnits = waterCurrent - waterPrevious;
        const electricityUnits = electricityCurrent - electricityPrevious;

        const result = await base44.entities.MeterReading.update(existingReading.id, {
          water_previous: waterPrevious,
          water_current: waterCurrent,
          electricity_previous: electricityPrevious,
          electricity_current: electricityCurrent,
          water_units: waterUnits,
          electricity_units: electricityUnits
        });
        results.push(result);
      }
      return results;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
      setBulkReadings({});
      setSelectedReadingVersion('new');
      toast.success(`อัปเดตมิเตอร์สำเร็จ ${data.length} ห้อง`);
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  });

  // Mutation for updating an existing meter reading (if an edit UI is implemented)
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (!canEdit) {
        throw new Error('คุณไม่มีสิทธิ์แก้ไขมิเตอร์');
      }
      const waterCurrent = parseFloat(data.water_current);
      const electricityCurrent = parseFloat(data.electricity_current);
      const waterPrevious = parseFloat(data.water_previous);
      const electricityPrevious = parseFloat(data.electricity_previous);

      const waterUnits = waterCurrent - waterPrevious;
      const electricityUnits = electricityCurrent - electricityPrevious;

      return base44.entities.MeterReading.update(id, {
        ...data,
        water_units: waterUnits,
        electricity_units: electricityUnits,
        branch_id: selectedBranchId
      });
    },
    onSuccess: async (updatedReading) => {
      queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
      
      // บันทึก log
      const room = rooms.find(r => r.id === updatedReading.room_id);
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'update',
        entity_type: 'MeterReading',
        entity_id: updatedReading.id,
        entity_name: `ห้อง ${room?.room_number || 'N/A'}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `แก้ไขมิเตอร์ห้อง ${room?.room_number || 'N/A'}`
      });
      
      setShowDialog(false);
      resetForm();
      toast.success('อัปเดตมิเตอร์สำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  // เพิ่ม Mutation สำหรับลบการบันทึกมิเตอร์
  const deleteMutation = useMutation({
    mutationFn: async (reading) => {
      if (!canDelete) {
        throw new Error('คุณไม่มีสิทธิ์ลบมิเตอร์');
      }
      await base44.entities.MeterReading.delete(reading.id);
      return reading;
    },
    onSuccess: async (deletedReading) => {
      queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
      
      // บันทึก log
      const room = rooms.find(r => r.id === deletedReading.room_id);
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'delete',
        entity_type: 'MeterReading',
        entity_id: deletedReading.id,
        entity_name: `ห้อง ${room?.room_number || 'N/A'}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `ลบบันทึกมิเตอร์ห้อง ${room?.room_number || 'N/A'}`
      });
      
      toast.success('ลบมิเตอร์สำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const handleBulkSave = () => {
    const readingsData = Object.entries(bulkReadings)
      .filter(([, data]) => {
        // ตรวจสอบว่ามีค่าอย่างน้อย 1 อย่าง (น้ำ หรือ ไฟ)
        const hasWater = data.water_current !== null && data.water_current !== undefined && data.water_current !== '';
        const hasElec = data.electricity_current !== null && data.electricity_current !== undefined && data.electricity_current !== '';
        return hasWater || hasElec;
      })
      .map(([roomId, data]) => ({
        room_id: roomId,
        reading_date: bulkReadingDate, // ใช้วันที่ที่เลือก
        water_current: data.water_current !== '' && data.water_current !== undefined ? data.water_current : null,
        electricity_current: data.electricity_current !== '' && data.electricity_current !== undefined ? data.electricity_current : null,
        water_previous: data.water_previous,
        electricity_previous: data.electricity_previous,
        notes: data.notes || ''
      }));

    if (readingsData.length === 0) {
      toast.error('กรุณากรอกข้อมูลมิเตอร์อย่างน้อย 1 ห้อง');
      return;
    }

    const isEditing = selectedReadingVersion !== 'new';
    const confirmMsg = isEditing 
      ? `คุณต้องการอัปเดตมิเตอร์ ${readingsData.length} ห้อง (${format(parseISO(bulkReadingDate), 'd MMM yyyy', { locale: th })}) ใช่หรือไม่?`
      : `คุณต้องการบันทึกมิเตอร์ ${readingsData.length} ห้องใช่หรือไม่?`;
    
    if (confirm(confirmMsg)) {
      if (isEditing) {
        bulkUpdateMutation.mutate(readingsData);
      } else {
        bulkCreateMutation.mutate(readingsData);
      }
    }
  };

  // บันทึกมิเตอร์ทีละห้อง (Mobile Card View)
  const handleSaveSingleReading = (roomId) => {
    const data = cardReadings[roomId];
    if (!data || data.water_current == null || data.water_current === '' || data.electricity_current == null || data.electricity_current === '') {
      toast.error('กรุณากรอกข้อมูลมิเตอร์ให้ครบถ้วน');
      return;
    }

    createSingleMutation.mutate({
      room_id: roomId,
      water_current: data.water_current,
      electricity_current: data.electricity_current,
      notes: data.notes || ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // formData now includes water_previous, electricity_previous, and create_payment
    createMutation.mutate(formData);
  };

  const resetForm = () => {
    setEditingRoom(null);
    setFormData({
      room_id: '',
      reading_date: new Date().toISOString().split('T')[0],
      water_current: '',
      electricity_current: '',
      notes: '',
      water_previous: 0,
      electricity_previous: 0,
    });
  };

  // ✅ O(1) Lookup Maps (แก้ N+1 Problem)
  const roomsMap = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms]);
  const tenantsMap = useMemo(() => new Map(tenants.map(t => [t.id, t])), [tenants]);
  const bookingsMap = useMemo(() => {
    const map = new Map();
    bookings.forEach(b => {
      if (b.status === 'active' && !map.has(b.room_id)) {
        map.set(b.room_id, b);
      }
    });
    return map;
  }, [bookings]);
  
  const meterReadingsMap = useMemo(() => {
    const map = new Map();
    meterReadings.forEach(r => {
      if (!map.has(r.room_id)) {
        map.set(r.room_id, r);
      }
    });
    return map;
  }, [meterReadings]);

  const getRoomInfo = useCallback((roomId) => roomsMap.get(roomId), [roomsMap]);
  const getActiveBooking = useCallback((roomId) => bookingsMap.get(roomId), [bookingsMap]);
  const getTenantInfo = useCallback((tenantId) => tenantsMap.get(tenantId), [tenantsMap]);
  const getLatestReading = useCallback((roomId) => meterReadingsMap.get(roomId), [meterReadingsMap]);

      const { totalElectricityThisMonth, totalWaterLatest } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Total electricity this month
    const totalElectricity = meterReadings
      .filter(r => {
        try {
          const readingDate = parseISO(r.reading_date);
          return readingDate.getMonth() === currentMonth && readingDate.getFullYear() === currentYear;
        } catch {
          return false;
        }
      })
      .reduce((sum, r) => sum + (r.electricity_units || 0), 0);

    // Total water from latest reading of each room
    const latestReadings = new Map();
    meterReadings.forEach(r => {
      if (!latestReadings.has(r.room_id)) {
        latestReadings.set(r.room_id, r);
      }
    });

    const totalWater = Array.from(latestReadings.values())
      .reduce((sum, r) => sum + (r.water_units || 0), 0);

    return { totalElectricityThisMonth: totalElectricity, totalWaterLatest: totalWater };
  }, [meterReadings]);

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAiAnalysisResult(null);
    toast.info('🤖 กำลังวิเคราะห์ข้อมูลมิเตอร์ด้วย AI...');

    try {
      // Prepare data for AI - get rooms with at least 1 reading
      const roomDataForAI = rooms.map(room => {
        const roomReadings = meterReadings
          .filter(r => r.room_id === room.id)
          .sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date))
          .slice(0, 5); // last 5 readings
        
        const latestReading = roomReadings[0];
        const previousReading = roomReadings[1];
        
        return {
          room_number: room.room_number,
          floor: room.floor,
          latest_water_units: latestReading?.water_units || 0,
          latest_electricity_units: latestReading?.electricity_units || 0,
          previous_water_units: previousReading?.water_units || null,
          previous_electricity_units: previousReading?.electricity_units || null,
          reading_date: latestReading?.reading_date || null,
          readings_history: roomReadings.map(r => ({
            date: r.reading_date,
            water_units: r.water_units,
            electricity_units: r.electricity_units,
          })),
        };
      }).filter(r => r.reading_date !== null); // ต้องมีอย่างน้อย 1 ครั้ง

      if (roomDataForAI.length === 0) {
        setAiAnalysisResult({
          status: 'no_data',
          message: 'ยังไม่มีข้อมูลมิเตอร์สำหรับการวิเคราะห์ กรุณาบันทึกมิเตอร์ก่อน'
        });
        toast.info('ยังไม่มีข้อมูลมิเตอร์');
        setIsAnalyzing(false);
        return;
      }
      
      // คำนวณค่าเฉลี่ยเพื่อส่งให้ AI ใช้เปรียบเทียบ
      const avgWater = roomDataForAI.reduce((sum, r) => sum + r.latest_water_units, 0) / roomDataForAI.length;
      const avgElectricity = roomDataForAI.reduce((sum, r) => sum + r.latest_electricity_units, 0) / roomDataForAI.length;

      const prompt = `
        คุณคือผู้ช่วยผู้จัดการหอพักอัจฉริยะ โปรดวิเคราะห์ข้อมูลการใช้มิเตอร์ทุกห้องอย่างละเอียด
        เพื่อหาความผิดปกติในการใช้น้ำและไฟฟ้า
        
        **เกณฑ์การตรวจสอบ (ละเอียดมาก):**
        
        1. **การใช้ไฟฟ้าผิดปกติ:**
           - สูงมาก (high): เกิน 300 หน่วย/เดือน หรือพุ่งสูงขึ้น 80% จากครั้งก่อน
           - ปานกลาง (medium): 200-300 หน่วย/เดือน หรือพุ่งสูงขึ้น 50-80% จากครั้งก่อน
           - ต่ำ (low): 150-200 หน่วย/เดือน หรือพุ่งสูงขึ้น 30-50% จากครั้งก่อน หรือสูงกว่าค่าเฉลี่ยของทุกห้อง 50%
           - ติดลบหรือเป็น 0: อาจจดผิด
           - **สำคัญ:** ถ้าห้องใดใช้ไฟเกิน 200 หน่วย ให้รายงานทุกกรณี
        
        2. **การใช้น้ำผิดปกติ:**
           - สูงมาก (high): เกิน 20 หน่วย/เดือน หรือพุ่งสูงขึ้น 80% จากครั้งก่อน
           - ปานกลาง (medium): 12-20 หน่วย/เดือน หรือพุ่งสูงขึ้น 50-80% จากครั้งก่อน
           - ต่ำ (low): 8-12 หน่วย/เดือน หรือพุ่งสูงขึ้น 30-50% จากครั้งก่อน หรือสูงกว่าค่าเฉลี่ยของทุกห้อง 50%
           - ติดลบหรือเป็น 0: อาจจดผิด
           - **สำคัญ:** ถ้าห้องใดใช้น้ำเกิน 10 หน่วย ให้รายงานทุกกรณี
        
        3. **รูปแบบการใช้งาน:**
           - เทียบกับค่าเฉลี่ยของห้องนั้นๆ
           - เทียบกับห้องอื่นๆ ในชั้นเดียวกัน
           - ตรวจสอบการเพิ่มขึ้นแบบกระโดด (spike)
           - ตรวจสอบการลดลงผิดปกติ
           - **หาห้องที่ใช้สูงที่สุด 3-5 อันดับแรก**
        
        **สำคัญมาก:** 
        - ตรวจสอบทุกห้องอย่างละเอียด แม้มีความผิดปกติเพียงเล็กน้อยก็ให้รายงาน
        - รายงานห้องที่ใช้ไฟเกิน 200 หน่วยทุกห้อง (ระดับ low ขึ้นไป)
        - รายงานห้องที่ใช้น้ำเกิน 10 หน่วยทุกห้อง
        - เปรียบเทียบกับค่าเฉลี่ยของทุกห้อง ถ้าสูงกว่า 30% ให้รายงาน
        - **ต้องวิเคราะห์ทุกห้องในข้อมูล ไม่ใช่แค่ห้องเดียว**
        
        ค่าเฉลี่ยของทุกห้อง:
        - ค่าเฉลี่ยน้ำ: ${avgWater.toFixed(2)} หน่วย
        - ค่าเฉลี่ยไฟ: ${avgElectricity.toFixed(2)} หน่วย
        
        ข้อมูลห้องทั้งหมด (${roomDataForAI.length} ห้อง):
        ${JSON.stringify(roomDataForAI, null, 2)}

        ตอบกลับเป็น JSON ในรูปแบบนี้เท่านั้น:
        {
          "summary": "สรุปภาพรวมอย่างละเอียด (จำนวนห้องที่ผิดปกติ, ประเภทปัญหา)",
          "total_rooms_analyzed": จำนวนห้องที่วิเคราะห์,
          "abnormal_rooms": [
            {
              "room_number": "หมายเลขห้อง",
              "issue_type": "electricity" หรือ "water" หรือ "both",
              "severity": "high" หรือ "medium" หรือ "low",
              "description": "คำอธิบายปัญหาที่พบอย่างละเอียด (ระบุตัวเลข, เปรียบเทียบ)",
              "recommendation": "คำแนะนำการแก้ไขหรือตรวจสอบ",
              "current_usage": {
                "water": หน่วยน้ำล่าสุด,
                "electricity": หน่วยไฟล่าสุด
              },
              "comparison": "เทียบกับครั้งก่อน/ค่าเฉลี่ย"
            }
          ],
          "normal_message": "ข้อความถ้าทุกอย่างปกติ",
          "statistics": {
            "avg_water_usage": ค่าเฉลี่ยการใช้น้ำ,
            "avg_electricity_usage": ค่าเฉลี่ยการใช้ไฟ,
            "highest_water_room": "หมายเลขห้องที่ใช้น้ำสูงสุด",
            "highest_electricity_room": "หมายเลขห้องที่ใช้ไฟสูงสุด"
          }
        }
      `;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: prompt,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            total_rooms_analyzed: { type: "number" },
            abnormal_rooms: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  room_number: { type: "string" },
                  issue_type: { type: "string" },
                  severity: { type: "string" },
                  description: { type: "string" },
                  recommendation: { type: "string" },
                  current_usage: {
                    type: "object",
                    properties: {
                      water: { type: "number" },
                      electricity: { type: "number" }
                    }
                  },
                  comparison: { type: "string" }
                }
              }
            },
            normal_message: { type: "string" },
            statistics: {
              type: "object",
              properties: {
                avg_water_usage: { type: "number" },
                avg_electricity_usage: { type: "number" },
                highest_water_room: { type: "string" },
                highest_electricity_room: { type: "string" }
              }
            }
          }
        }
      });

      setAiAnalysisResult(response);
      toast.success('🤖 วิเคราะห์ข้อมูลสำเร็จ!');

    } catch (error) {
      console.error("AI Analysis failed:", error);
      toast.error('การวิเคราะห์ด้วย AI ล้มเหลว');
      setAiAnalysisResult({ status: 'error', message: 'เกิดข้อผิดพลาดในการวิเคราะห์ข้อมูล' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ✅ ตรวจสอบความผิดปกติแบบเรียลไทม์
  const alertsData = useMemo(() => {
    const alerts = [];
    
    rooms.forEach(room => {
      const latest = getLatestReading(room.id);
      if (!latest) return;
      
      const waterUnits = latest.water_units || 0;
      const electricityUnits = latest.electricity_units || 0;
      const booking = getActiveBooking(room.id);
      const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
      
      // เช็คน้ำต่ำกว่า 3 หน่วย (แต่มากกว่า 0)
      if (waterUnits < 3 && waterUnits > 0) {
        alerts.push({
          room_number: room.room_number,
          tenant_name: tenant?.full_name || '-',
          type: 'water_low',
          severity: 'medium',
          message: `น้ำต่ำผิดปกติ: ${waterUnits.toFixed(1)} หน่วย`,
          water_units: waterUnits,
          electricity_units: electricityUnits
        });
      }
      
      // เช็คไฟต่ำกว่า 3 หน่วย (แต่มากกว่า 0)
      if (electricityUnits < 3 && electricityUnits > 0) {
        alerts.push({
          room_number: room.room_number,
          tenant_name: tenant?.full_name || '-',
          type: 'electricity_low',
          severity: 'medium',
          message: `ไฟต่ำผิดปกติ: ${electricityUnits.toFixed(1)} หน่วย`,
          water_units: waterUnits,
          electricity_units: electricityUnits
        });
      }
      
      // เช็คไฟเกิน 200 หน่วย
      if (electricityUnits > 200) {
        alerts.push({
          room_number: room.room_number,
          tenant_name: tenant?.full_name || '-',
          type: 'electricity_high',
          severity: electricityUnits > 300 ? 'high' : 'medium',
          message: `ไฟสูงผิดปกติ: ${electricityUnits.toFixed(1)} หน่วย`,
          water_units: waterUnits,
          electricity_units: electricityUnits
        });
      }
    });
    
    return alerts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }, [rooms, meterReadings, bookings, tenants, getLatestReading, getActiveBooking, getTenantInfo]);

  const roomsDataForDisplay = useMemo(() => {
    // ✅ แสดงทุกห้อง
    const activeRooms = rooms;
    let result = activeRooms;

    // Floor filter
    if (selectedFloor !== 'all') {
      result = result.filter(room => room.floor?.toString() === selectedFloor);
    }

    // Search filter
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(room => {
        const booking = getActiveBooking(room.id);
        const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
        return room.room_number?.toLowerCase().includes(query) ||
               (tenant?.full_name?.toLowerCase().includes(query));
      });
    }

    // ✅ เรียงลำดับ: ชั้น 1 → 2 → 3... และภายในชั้นเรียงตามเลขห้อง
    return result.sort((a, b) => {
      const floorA = a.floor || 1;
      const floorB = b.floor || 1;
      if (floorA !== floorB) {
        return floorA - floorB;
      }
      const numA = parseFloat(a.room_number.replace(/\D/g, '')) || 0;
      const numB = parseFloat(b.room_number.replace(/\D/g, '')) || 0;
      return numA - numB;
    });
  }, [rooms, selectedFloor, debouncedSearch, bookings, tenants, getActiveBooking, getTenantInfo]);

  // ✅ Pagination
  const totalPages = Math.ceil(roomsDataForDisplay.length / itemsPerPage);
  const paginatedRooms = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return roomsDataForDisplay.slice(startIndex, startIndex + itemsPerPage);
  }, [roomsDataForDisplay, currentPage, itemsPerPage]);

  const displayRoomsByFloor = useMemo(() => {
    const grouped = paginatedRooms.reduce((acc, room) => {
      const floor = room.floor || 1;
      if (!acc[floor]) {
        acc[floor] = [];
      }
      acc[floor].push(room);
      return acc;
    }, {});
    
    // Sort rooms within each floor
    Object.keys(grouped).forEach(floor => {
      grouped[floor].sort((a, b) => {
        const numA = parseFloat(a.room_number.replace(/\D/g, '')) || 0;
        const numB = parseFloat(b.room_number.replace(/\D/g, '')) || 0;
        return numA - numB;
      });
    });
    
    return grouped;
  }, [paginatedRooms]);

  const displayFloors = Object.keys(displayRoomsByFloor).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

  // Helper function สำหรับเรียงห้องตามเลขห้อง
  const sortRoomsByNumber = (roomA, roomB) => {
    const numA = parseFloat(roomA.room_number.replace(/\D/g, '')) || 0;
    const numB = parseFloat(roomB.room_number.replace(/\D/g, '')) || 0;
    return numA - numB;
  };

    // For summary and floor dropdown, based on all rooms
  const allOccupiedRooms = rooms;
  const allRoomsByFloorForDropdown = allOccupiedRooms.reduce((acc, room) => {
    const floor = room.floor;
    if (!acc[floor]) {
      acc[floor] = [];
    }
    acc[floor].push(room);
    return acc;
  }, {});
  const sortedFloorsForDropdown = Object.keys(allRoomsByFloorForDropdown).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));


  // ✅ Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedFloor, debouncedSearch]);

  // Read only for summary card
  const readingsByRoomForSummary = allOccupiedRooms.reduce((acc, room) => {
    const roomReadings = meterReadings.filter(r => r.room_id === room.id);
    if (roomReadings.length > 0) {
      acc[room.id] = {
        room,
        readings: roomReadings,
        latest: roomReadings[0]
      };
    }
    return acc;
  }, {});


  const handleViewHistory = (room) => {
    const roomReadings = meterReadings.filter(r => r.room_id === room.id); // Changed 'readings' to 'meterReadings'
    const booking = getActiveBooking(room.id);
    const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
    setSelectedReading({ room, readings: roomReadings, tenant });
    setShowDetailDialog(true);
  };

  const handleDeleteReading = (reading, roomNumber) => {
    if (!canDelete) {
      toast.error('คุณไม่มีสิทธิ์ลบการบันทึกมิเตอร์');
      return;
    }

    if (confirm(`คุณแน่ใจว่าต้องการลบการบันทึกมิเตอร์ของห้อง ${roomNumber} นี้หรือไม่?\n\n⚠️ คำเตือน: การลบจะส่งผลต่อการคำนวณค่ามิเตอร์ครั้งถัดไป`)) {
      deleteMutation.mutate(reading);
    }
  };

  // สำหรับ Desktop: คลิกการ์ดเพื่อเปิด Dialog
  const handleRoomCardClick = (room) => {
    if (!canAdd) {
      toast.error('คุณไม่มีสิทธิ์บันทึกมิเตอร์');
      return;
    }
    
    const latest = getLatestReading(room.id);
    const hasExistingReading = !!latest;
    
    setEditingRoom(room);
    setFormData({
      room_id: room.id,
      reading_date: new Date().toISOString().split('T')[0],
      water_current: '',
      electricity_current: '',
      notes: '',
      // ถ้ามีประวัติแล้วให้ใช้ค่าล่าสุด ถ้าไม่มีให้เริ่มจาก 0
      water_previous: hasExistingReading ? latest.water_current : 0,
      electricity_previous: hasExistingReading ? latest.electricity_current : 0,
    });
    setShowDialog(true);
  };

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
          <p className="text-slate-500 mt-2">โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
        </Card>
      </div>
    );
  }

  // Handle case where no branch is selected
  if (!selectedBranchId) {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-xl font-semibold text-orange-600">กรุณาเลือกสาขา</p>
          <p className="text-slate-500 mt-2">โปรดเลือกสาขาที่คุณต้องการจัดการข้อมูลจากเมนูด้านบน</p>
        </Card>
      </div>
    );
  }

  if (readingsLoading || roomsLoading) {
    return (
      <div className="p-4 md:p-8 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
            <p className="text-slate-600 text-lg">กำลังโหลดข้อมูลห้องและมิเตอร์...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader 
        title="บันทึกมิเตอร์" 
        subtitle={`สาขา ${selectedBranchName}${alertsData.length > 0 ? ` • ${alertsData.length} แจ้งเตือน` : ''}`}
        icon={Gauge}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              <Download className="w-4 h-4 mr-2" />
              ดาวน์โหลด
            </Button>

            {canAdd && (
              <ExcelUploader
                entityName="มิเตอร์"
                templateFields={['หมายเลขห้อง', 'มิเตอร์น้ำปัจจุบัน', 'มิเตอร์ไฟปัจจุบัน']}
                onImport={handleImportData}
                buttonVariant="outline"
                buttonClassName="border-blue-600 text-blue-600 hover:bg-blue-50"
                hideDownloadTemplate={true}
              />
            )}

            {viewMode === 'table' && Object.keys(bulkReadings).length > 0 && (
              <Button
                onClick={handleBulkSave}
                disabled={bulkCreateMutation.isPending || !canAdd}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                {bulkCreateMutation.isPending ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />กำลังบันทึก...</>
                ) : (
                  <><Save className="w-4 h-4 mr-2" />บันทึกทั้งหมด ({Object.keys(bulkReadings).length})</>
                )}
              </Button>
            )}

          </div>
        }
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Real-time Alerts - แบบกะทัดรัด */}
          {alertsData.length > 0 && (
            <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-orange-500">
              <CardContent className="p-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-orange-600" />
                    <span className="font-bold text-orange-900 text-xs">⚠️ {alertsData.length} ห้อง</span>
                  </div>
                  {alertsData.slice(0, 5).map((alert, idx) => (
                    <div 
                      key={idx}
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        alert.severity === 'high' ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
                      }`}
                    >
                      {alert.room_number} {alert.type === 'water_low' ? '💧' : '⚡'}{(alert.type === 'water_low' ? alert.water_units : alert.electricity_units).toFixed(0)}
                    </div>
                  ))}
                  {alertsData.length > 5 && (
                    <span className="text-xs text-orange-700">+{alertsData.length - 5}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm mb-1">ห้องที่มีการบันทึก</p>
                    <p className="text-3xl font-bold">{Object.keys(readingsByRoomForSummary).length}</p>
                  </div>
                  <Gauge className="w-12 h-12 text-blue-200" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-yellow-100 text-sm mb-1">ไฟที่ใช้เดือนนี้ (หน่วย)</p>
                        <p className="text-3xl font-bold">{totalElectricityThisMonth.toFixed(2)}</p>
                    </div>
                    <Zap className="w-12 h-12 text-yellow-200" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-xl">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-cyan-100 text-sm mb-1">น้ำที่ใช้ทั้งหมด (ล่าสุด)</p>
                            <p className="text-3xl font-bold">{totalWaterLatest.toFixed(2)}</p>
                        </div>
                        <Droplets className="w-12 h-12 text-cyan-200" />
                    </div>
                </CardContent>
            </Card>
          </div>

          {/* AI Analysis Result */}
          {(isAnalyzing || aiAnalysisResult) && (
            <Card className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 border-purple-200/60 shadow-xl overflow-hidden">
              <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white pb-4">
                <CardTitle className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">ผลการวิเคราะห์จาก AI</p>
                    <p className="text-purple-200 text-sm font-normal">ตรวจสอบการใช้น้ำและไฟฟ้าผิดปกติ</p>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-4">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-purple-200 rounded-full"></div>
                      <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
                    </div>
                    <p className="text-slate-600 font-medium">กำลังวิเคราะห์ข้อมูลมิเตอร์...</p>
                    <p className="text-slate-400 text-sm">AI กำลังตรวจสอบรูปแบบการใช้งานของทุกห้อง</p>
                  </div>
                ) : aiAnalysisResult?.status === 'no_data' ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertTriangle className="w-8 h-8 text-amber-600" />
                    </div>
                    <p className="text-slate-700 font-semibold mb-2">ยังไม่มีข้อมูลเพียงพอ</p>
                    <p className="text-slate-500 text-sm">{aiAnalysisResult.message}</p>
                  </div>
                ) : aiAnalysisResult?.status === 'error' ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <X className="w-8 h-8 text-red-600" />
                    </div>
                    <p className="text-red-700 font-semibold mb-2">เกิดข้อผิดพลาด</p>
                    <p className="text-slate-500 text-sm">{aiAnalysisResult.message}</p>
                  </div>
                ) : aiAnalysisResult ? (
                  <div className="space-y-6">
                    {/* Summary */}
                    <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                     <div className="flex items-center justify-between mb-2">
                       <p className="text-sm text-slate-500">สรุปภาพรวม</p>
                       <Badge className="bg-purple-100 text-purple-700">
                         วิเคราะห์ {aiAnalysisResult.total_rooms_analyzed || 0} ห้อง
                       </Badge>
                     </div>
                     <p className="text-slate-800 font-medium">{aiAnalysisResult.summary}</p>

                     {/* Statistics */}
                     {aiAnalysisResult.statistics && (
                       <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t">
                         <div className="bg-blue-50 rounded-lg p-3">
                           <p className="text-xs text-blue-600 mb-1">ค่าเฉลี่ยน้ำ</p>
                           <p className="text-lg font-bold text-blue-700">{aiAnalysisResult.statistics.avg_water_usage?.toFixed(1)} หน่วย</p>
                           {aiAnalysisResult.statistics.highest_water_room && (
                             <p className="text-xs text-slate-600 mt-1">สูงสุด: ห้อง {aiAnalysisResult.statistics.highest_water_room}</p>
                           )}
                         </div>
                         <div className="bg-yellow-50 rounded-lg p-3">
                           <p className="text-xs text-yellow-600 mb-1">ค่าเฉลี่ยไฟ</p>
                           <p className="text-lg font-bold text-yellow-700">{aiAnalysisResult.statistics.avg_electricity_usage?.toFixed(1)} หน่วย</p>
                           {aiAnalysisResult.statistics.highest_electricity_room && (
                             <p className="text-xs text-slate-600 mt-1">สูงสุด: ห้อง {aiAnalysisResult.statistics.highest_electricity_room}</p>
                           )}
                         </div>
                       </div>
                     )}
                    </div>

                    {/* Abnormal Rooms */}
                    {aiAnalysisResult.abnormal_rooms && aiAnalysisResult.abnormal_rooms.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <p className="font-semibold text-slate-800">ห้องที่พบความผิดปกติ ({aiAnalysisResult.abnormal_rooms.length} ห้อง)</p>
                        </div>
                        
                        <div className="grid gap-3">
                          {aiAnalysisResult.abnormal_rooms.map((room, idx) => (
                            <div 
                              key={idx} 
                              className={`rounded-xl p-4 border-2 ${
                                room.severity === 'high' 
                                  ? 'bg-red-50 border-red-200' 
                                  : room.severity === 'medium'
                                  ? 'bg-amber-50 border-amber-200'
                                  : 'bg-yellow-50 border-yellow-200'
                              }`}
                            >
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${
                                    room.severity === 'high' 
                                      ? 'bg-red-500 text-white' 
                                      : room.severity === 'medium'
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-yellow-500 text-white'
                                  }`}>
                                    {room.room_number}
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-800">ห้อง {room.room_number}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                      {room.issue_type === 'electricity' || room.issue_type === 'both' ? (
                                        <Badge className="bg-yellow-100 text-yellow-700 gap-1">
                                          <Zap className="w-3 h-3" /> ไฟฟ้า
                                        </Badge>
                                      ) : null}
                                      {room.issue_type === 'water' || room.issue_type === 'both' ? (
                                        <Badge className="bg-blue-100 text-blue-700 gap-1">
                                          <Droplets className="w-3 h-3" /> น้ำ
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                                <Badge className={`${
                                  room.severity === 'high' 
                                    ? 'bg-red-500 text-white' 
                                    : room.severity === 'medium'
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-yellow-500 text-white'
                                }`}>
                                  {room.severity === 'high' ? '⚠️ รุนแรง' : room.severity === 'medium' ? '⚡ ปานกลาง' : '💡 เล็กน้อย'}
                                </Badge>
                              </div>
                              
                              <div className="space-y-2 text-sm">
                                <div className="flex gap-2">
                                  <span className="text-slate-500 min-w-[60px]">ปัญหา:</span>
                                  <span className="text-slate-700">{room.description}</span>
                                </div>
                                {room.current_usage && (
                                  <div className="flex gap-4 py-2 px-3 bg-white rounded-lg border">
                                    <div className="flex items-center gap-1">
                                      <Droplets className="w-3 h-3 text-blue-600" />
                                      <span className="text-xs text-slate-500">น้ำ:</span>
                                      <span className="font-bold text-blue-700">{room.current_usage.water} หน่วย</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Zap className="w-3 h-3 text-yellow-600" />
                                      <span className="text-xs text-slate-500">ไฟ:</span>
                                      <span className="font-bold text-yellow-700">{room.current_usage.electricity} หน่วย</span>
                                    </div>
                                  </div>
                                )}
                                {room.comparison && (
                                  <div className="flex gap-2 bg-slate-50 rounded px-2 py-1">
                                    <span className="text-slate-500 min-w-[60px]">เปรียบเทียบ:</span>
                                    <span className="text-slate-600 text-xs">{room.comparison}</span>
                                  </div>
                                )}
                                <div className="flex gap-2">
                                  <span className="text-slate-500 min-w-[60px]">แนะนำ:</span>
                                  <span className="text-slate-700 font-medium">{room.recommendation}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Check className="w-8 h-8 text-green-600" />
                        </div>
                        <p className="text-green-700 font-semibold mb-2">ไม่พบความผิดปกติ</p>
                        <p className="text-slate-500 text-sm">{aiAnalysisResult.normal_message || 'การใช้น้ำและไฟฟ้าของทุกห้องอยู่ในเกณฑ์ปกติ'}</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )}

          {/* Floor Filter + View Mode Toggle */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-600" />
                  <select
                    value={selectedFloor}
                    onChange={(e) => setSelectedFloor(e.target.value)}
                    className="p-2 border rounded-md"
                  >
                    <option value="all">ทุกชั้น</option>
                    {sortedFloorsForDropdown.map(floor => (
                      <option key={floor} value={floor}>ชั้น {floor}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleAIAnalysis}
                    variant="outline"
                    size="sm"
                    className="border-purple-600 text-purple-600 hover:bg-purple-50"
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-1" />
                    )}
                    AI
                  </Button>
                  
                  <Button
                    onClick={() => setViewMode(viewMode === 'card' ? 'table' : 'card')}
                    variant="outline"
                    size="sm"
                    className="border-slate-400 text-slate-600 hover:bg-slate-50"
                  >
                    {viewMode === 'card' ? (
                      <><List className="w-4 h-4 mr-1" />ตาราง</>
                    ) : (
                      <><Grid className="w-4 h-4 mr-1" />การ์ด</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ✅ Add search */}
          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="ค้นหาห้อง (หมายเลขห้อง, ชื่อผู้เช่า...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Display Rooms */}
          {roomsDataForDisplay.length === 0 && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg p-6 text-center">
              <p className="text-lg font-semibold text-slate-700">ไม่พบห้องพักที่ตรงกับเงื่อนไข</p>
              <p className="text-slate-500 mt-2">ลองเปลี่ยนตัวกรองชั้นหรือคำค้นหา</p>
            </Card>
          )}

          {viewMode === 'card' && (
            <div className="space-y-8">
              {displayFloors.map((floor) => (
                <div key={floor} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-blue-600" />
                    <h2 className="text-2xl font-bold text-slate-800">ชั้น {floor}</h2>
                    <Badge variant="outline" className="text-sm">
                      {displayRoomsByFloor[floor].length} ห้อง
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                      {displayRoomsByFloor[floor]
                        .map(room => {
                          const booking = getActiveBooking(room.id);
                          const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
                          const latest = getLatestReading(room.id);
                          const hasReading = !!latest;
                          
                          return (
                            <motion.div
                              key={room.id}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                            >
                              {/* Desktop View - คลิกเปิด Dialog */}
                              {!isMobile && (
                                <Card 
                                  className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl hover:shadow-2xl transition-all cursor-pointer"
                                  onClick={() => handleRoomCardClick(room)}
                                >
                                  <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                      <div>
                                        <h3 className="text-xl font-bold text-slate-800">ห้อง {room.room_number}</h3>
                                        {tenant && (
                                          <p className="text-sm text-slate-500">{tenant.full_name}</p>
                                        )}
                                      </div>
                                      {hasReading && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewHistory(room);
                                          }}
                                          className="text-blue-600 hover:text-blue-700"
                                        >
                                          <History className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>

                                    {latest ? (
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <Droplets className="w-5 h-5 text-blue-600" />
                                            <div>
                                              <p className="text-xs text-slate-500">น้ำ</p>
                                              <p className="font-bold text-slate-800">{latest.water_current}</p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-xs text-slate-500">ใช้ไป</p>
                                            <p className="font-bold text-blue-600">{latest.water_units} หน่วย</p>
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                                          <div className="flex items-center gap-2">
                                            <Zap className="w-5 h-5 text-yellow-600" />
                                            <div>
                                              <p className="text-xs text-slate-500">ไฟ</p>
                                              <p className="font-bold text-slate-800">{latest.electricity_current}</p>
                                            </div>
                                          </div>
                                          <div className="text-right">
                                            <p className="text-xs text-slate-500">ใช้ไป</p>
                                            <p className="font-bold text-yellow-600">{latest.electricity_units} หน่วย</p>
                                          </div>
                                        </div>

                                        <p className="text-xs text-slate-500 text-center pt-2">
                                          บันทึกล่าสุด: {format(parseISO(latest.reading_date), 'd MMM yyyy', { locale: th })}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="text-center py-6 border-2 border-dashed border-orange-300 rounded-lg bg-orange-50/50">
                                        <Plus className="w-10 h-10 text-orange-500 mx-auto mb-2" />
                                        <p className="text-orange-700 text-sm font-semibold">คลิกเพื่อบันทึกมิเตอร์</p>
                                        <p className="text-orange-600 text-xs mt-1">ยังไม่มีการบันทึก</p>
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              )}

                              {/* Mobile View - กรอกข้อมูลในการ์ดเลย */}
                              {isMobile && (
                                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl hover:shadow-2xl transition-all">
                                  <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                      <div>
                                        <h3 className="text-xl font-bold text-slate-800">ห้อง {room.room_number}</h3>
                                        {tenant && (
                                          <p className="text-sm text-slate-500">{tenant.full_name}</p>
                                        )}
                                      </div>
                                      {hasReading && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleViewHistory(room)}
                                          className="text-blue-600 hover:text-blue-700"
                                        >
                                          <History className="w-4 h-4" />
                                        </Button>
                                      )}
                                    </div>

                                    <div className="space-y-3">
                                     {latest && (
                                       <div className="bg-blue-50 rounded-lg p-2 mb-2">
                                         <p className="text-xs text-slate-600 mb-1">ค่ามิเตอร์ครั้งก่อน:</p>
                                         <div className="flex items-center gap-3 text-xs">
                                           <div className="flex items-center gap-1">
                                             <Droplets className="w-3 h-3 text-blue-600" />
                                             <span className="text-slate-600">น้ำ:</span>
                                             <span className="font-bold text-blue-600">{latest.water_current}</span>
                                           </div>
                                           <div className="flex items-center gap-1">
                                             <Zap className="w-3 h-3 text-yellow-600" />
                                             <span className="text-slate-600">ไฟ:</span>
                                             <span className="font-bold text-yellow-600">{latest.electricity_current}</span>
                                           </div>
                                         </div>
                                       </div>
                                     )}

                                     <div className="grid grid-cols-2 gap-2">
                                       <div>
                                         <Label className="text-xs">น้ำปัจจุบัน</Label>
                                         <Input
                                           type="number"
                                           step="0.01"
                                           placeholder="150.5"
                                           value={cardReadings[room.id]?.water_current || ''}
                                           onChange={(e) => setCardReadings({
                                             ...cardReadings,
                                             [room.id]: {
                                               ...cardReadings[room.id],
                                               water_current: e.target.value
                                             }
                                           })}
                                           disabled={!canAdd || createSingleMutation.isPending}
                                           className="h-9 text-sm"
                                         />
                                       </div>

                                       <div>
                                         <Label className="text-xs">ไฟปัจจุบัน</Label>
                                         <Input
                                           type="number"
                                           step="0.01"
                                           placeholder="250.0"
                                           value={cardReadings[room.id]?.electricity_current || ''}
                                           onChange={(e) => setCardReadings({
                                             ...cardReadings,
                                             [room.id]: {
                                               ...cardReadings[room.id],
                                               electricity_current: e.target.value
                                             }
                                           })}
                                           disabled={!canAdd || createSingleMutation.isPending}
                                           className="h-9 text-sm"
                                         />
                                       </div>
                                     </div>

                                     <Button
                                       onClick={() => handleSaveSingleReading(room.id)}
                                       disabled={
                                         !canAdd || 
                                         createSingleMutation.isPending ||
                                         (cardReadings[room.id]?.water_current == null || cardReadings[room.id]?.water_current === '') ||
                                                                                   (cardReadings[room.id]?.electricity_current == null || cardReadings[room.id]?.electricity_current === '')
                                       }
                                       className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-9"
                                     >
                                       {createSingleMutation.isPending ? (
                                         <>
                                           <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                           กำลังบันทึก...
                                         </>
                                       ) : (
                                         <>
                                           <Check className="w-4 h-4 mr-2" />
                                           บันทึก
                                         </>
                                       )}
                                     </Button>

                                     {latest && (
                                       <div className="pt-3 border-t text-center">
                                         <p className="text-xs text-slate-500">
                                           บันทึกล่าสุด: {format(parseISO(latest.reading_date), 'd MMM yyyy', { locale: th })}
                                         </p>
                                         <div className="flex justify-center gap-4 mt-2 text-xs">
                                           <span className="text-blue-600">ใช้น้ำ: {latest.water_units} หน่วย</span>
                                           <span className="text-yellow-600">ใช้ไฟ: {latest.electricity_units} หน่วย</span>
                                         </div>
                                       </div>
                                     )}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </motion.div>
                          );
                        })}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Table View */}
          {viewMode === 'table' && (
            <div className="space-y-6">
              {/* ตัวเลือกเวอร์ชัน */}
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <History className="w-5 h-5 text-blue-600" />
                      <Label className="font-medium">เวอร์ชัน:</Label>
                      <select
                        value={selectedReadingVersion}
                        onChange={(e) => {
                          setSelectedReadingVersion(e.target.value);
                          setBulkReadings({}); // ล้างค่าเมื่อเปลี่ยนเวอร์ชัน
                          
                          // ถ้าเลือกเวอร์ชันเก่า ให้โหลดค่าเข้ามา
                          if (e.target.value !== 'new' && !e.target.value.startsWith('view_')) {
                            const newBulkReadings = {};
                            rooms.forEach(room => {
                              const reading = meterReadings.find(r => r.id === e.target.value && r.room_id === room.id) 
                                || meterReadings.find(r => r.room_id === room.id && r.reading_date === meterReadings.find(mr => mr.id === e.target.value)?.reading_date);
                              if (reading) {
                                newBulkReadings[room.id] = {
                                  water_previous: reading.water_previous,
                                  water_current: reading.water_current,
                                  electricity_previous: reading.electricity_previous,
                                  electricity_current: reading.electricity_current
                                };
                              }
                            });
                            setBulkReadings(newBulkReadings);
                            setBulkReadingDate(meterReadings.find(r => r.id === e.target.value)?.reading_date || new Date().toISOString().split('T')[0]);
                          } else if (e.target.value.startsWith('view_')) {
                            // โหมดดูประวัติ
                            const viewDate = e.target.value.replace('view_', '');
                            setBulkReadingDate(viewDate);
                          } else {
                            setBulkReadingDate(new Date().toISOString().split('T')[0]);
                          }
                        }}
                        className="p-2 border rounded-lg min-w-[200px]"
                      >
                        <option value="new">➕ บันทึกใหม่ (วันนี้)</option>
                        {/* แสดงประวัติจัดกลุ่มตามวันที่ - ดูอย่างเดียว (สำหรับพนักงาน) */}
                        {!(canEditHistory || userRole === 'owner' || userRole === 'developer') && (() => {
                          const dateGroups = {};
                          meterReadings.forEach(r => {
                            if (!dateGroups[r.reading_date]) {
                              dateGroups[r.reading_date] = r;
                            }
                          });
                          return Object.entries(dateGroups)
                            .sort((a, b) => b[0].localeCompare(a[0]))
                            .slice(0, 10)
                            .map(([date, reading]) => (
                              <option key={`view_${date}`} value={`view_${date}`}>
                                📋 ดูประวัติ: {format(parseISO(date), 'd MMM yyyy', { locale: th })}
                              </option>
                            ));
                        })()}
                        {/* แก้ไขประวัติ - เจ้าของ, developer, หรือคนที่มีสิทธิ์ (จำกัด 5 ครั้งล่าสุด) */}
                        {(canEditHistory || userRole === 'owner' || userRole === 'developer') && (() => {
                          const dateGroups = {};
                          meterReadings.forEach(r => {
                            if (!dateGroups[r.reading_date]) {
                              dateGroups[r.reading_date] = r;
                            }
                          });
                          return Object.entries(dateGroups)
                            .sort((a, b) => b[0].localeCompare(a[0]))
                            .slice(0, 5) // จำกัดแค่ 5 ครั้งล่าสุด
                            .map(([date, reading]) => (
                              <option key={reading.id} value={reading.id}>
                                📝 แก้ไข: {format(parseISO(date), 'd MMM yyyy', { locale: th })}
                              </option>
                            ));
                        })()}
                      </select>
                    </div>
                    {selectedReadingVersion !== 'new' && !selectedReadingVersion.startsWith('view_') && (
                      <Badge className="bg-amber-100 text-amber-700">
                        โหมดแก้ไข
                      </Badge>
                    )}
                    {selectedReadingVersion.startsWith('view_') && (
                      <Badge className="bg-blue-100 text-blue-700">
                        ดูประวัติ
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>

              {displayFloors.map((floor) => (
                <div key={floor} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-blue-600" />
                    <h2 className="text-2xl font-bold text-slate-800">ชั้น {floor}</h2>
                    <Badge variant="outline" className="text-sm">
                      {displayRoomsByFloor[floor].length} ห้อง
                    </Badge>
                  </div>

                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ห้อง</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 hidden md:table-cell">ผู้เช่า</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์น้ำก่อน</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์น้ำปัจจุบัน</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์ไฟก่อน</th>
                              <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์ไฟปัจจุบัน</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {displayRoomsByFloor[floor]
                              .map(room => {
                                const booking = getActiveBooking(room.id);
                                const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
                                const latest = getLatestReading(room.id);
                                const hasExistingReading = !!latest;
                                const waterPrevious = hasExistingReading ? latest.water_current : '';
                                const electricityPrevious = hasExistingReading ? latest.electricity_current : '';
                                
                                // โหมดดูประวัติ (เฉพาะพนักงานที่ไม่มีสิทธิ์แก้ไข)
                                const canEditMeterHistory = canEditHistory || userRole === 'owner' || userRole === 'developer';
                                const isViewMode = selectedReadingVersion.startsWith('view_') && !canEditMeterHistory;
                                const viewDate = isViewMode ? selectedReadingVersion.replace('view_', '') : null;
                                const historyReading = viewDate ? meterReadings.find(r => r.room_id === room.id && r.reading_date === viewDate) : null;
                                
                                return (
                                  <tr key={room.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                      <div className="flex items-center gap-2">
                                        {room.room_number}
                                        {!hasExistingReading && !isViewMode && (
                                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
                                            ครั้งแรก
                                          </Badge>
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">
                                      {tenant?.full_name || '-'}
                                    </td>
                                    {isViewMode ? (
                                      // โหมดดูประวัติ - แสดงข้อมูลอย่างเดียว
                                      <>
                                        <td className="px-4 py-3 text-center">
                                          <span className="font-medium text-slate-600">{historyReading?.water_previous ?? '-'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <span className="font-bold text-blue-600">{historyReading?.water_current ?? '-'}</span>
                                          {historyReading && (
                                            <span className="text-xs text-slate-500 ml-1">({historyReading.water_units})</span>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <span className="font-medium text-slate-600">{historyReading?.electricity_previous ?? '-'}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                          <span className="font-bold text-yellow-600">{historyReading?.electricity_current ?? '-'}</span>
                                          {historyReading && (
                                            <span className="text-xs text-slate-500 ml-1">({historyReading.electricity_units})</span>
                                          )}
                                        </td>
                                      </>
                                    ) : (
                                      // โหมดบันทึก/แก้ไข
                                      <>
                                        <td className="px-4 py-3">
                                          {canEditMeterHistory ? (
                                            <Input
                                              type="number"
                                              step="0.01"
                                              placeholder="ก่อน"
                                              value={bulkReadings[room.id]?.water_previous ?? waterPrevious ?? ''}
                                              onChange={(e) => setBulkReadings({
                                                ...bulkReadings,
                                                [room.id]: {
                                                  ...bulkReadings[room.id],
                                                  water_previous: e.target.value,
                                                  water_current: bulkReadings[room.id]?.water_current ?? ''
                                                }
                                              })}
                                              className="w-24 text-center"
                                            />
                                          ) : hasExistingReading ? (
                                            <div className="text-center font-medium text-slate-700 bg-slate-100 rounded px-2 py-1.5">
                                              {waterPrevious}
                                            </div>
                                          ) : (
                                            <Input
                                              type="number"
                                              step="0.01"
                                              placeholder="ตั้งต้น"
                                              value={bulkReadings[room.id]?.water_previous ?? ''}
                                              onChange={(e) => setBulkReadings({
                                                ...bulkReadings,
                                                [room.id]: {
                                                  ...bulkReadings[room.id],
                                                  water_previous: e.target.value
                                                }
                                              })}
                                              className="w-24 text-center border-amber-300 focus:border-amber-500"
                                            />
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="เช่น 150.5"
                                            value={bulkReadings[room.id]?.water_current ?? ''}
                                            onChange={(e) => {
                                              const newValue = e.target.value;
                                              setBulkReadings({
                                                ...bulkReadings,
                                                [room.id]: {
                                                  ...bulkReadings[room.id],
                                                  water_current: newValue,
                                                  water_previous: canEditMeterHistory 
                                                    ? (bulkReadings[room.id]?.water_previous ?? waterPrevious ?? '')
                                                    : (hasExistingReading ? waterPrevious : (bulkReadings[room.id]?.water_previous ?? ''))
                                                }
                                              });
                                            }}
                                            className="w-32"
                                          />
                                        </td>
                                        <td className="px-4 py-3">
                                          {canEditMeterHistory ? (
                                            <Input
                                              type="number"
                                              step="0.01"
                                              placeholder="ก่อน"
                                              value={bulkReadings[room.id]?.electricity_previous ?? electricityPrevious ?? ''}
                                              onChange={(e) => setBulkReadings({
                                                ...bulkReadings,
                                                [room.id]: {
                                                  ...bulkReadings[room.id],
                                                  electricity_previous: e.target.value,
                                                  electricity_current: bulkReadings[room.id]?.electricity_current ?? ''
                                                }
                                              })}
                                              className="w-24 text-center"
                                            />
                                          ) : hasExistingReading ? (
                                            <div className="text-center font-medium text-slate-700 bg-slate-100 rounded px-2 py-1.5">
                                              {electricityPrevious}
                                            </div>
                                          ) : (
                                            <Input
                                              type="number"
                                              step="0.01"
                                              placeholder="ตั้งต้น"
                                              value={bulkReadings[room.id]?.electricity_previous ?? ''}
                                              onChange={(e) => setBulkReadings({
                                                ...bulkReadings,
                                                [room.id]: {
                                                  ...bulkReadings[room.id],
                                                  electricity_previous: e.target.value
                                                }
                                              })}
                                              className="w-24 text-center border-amber-300 focus:border-amber-500"
                                            />
                                          )}
                                        </td>
                                        <td className="px-4 py-3">
                                          <Input
                                            type="number"
                                            step="0.01"
                                            placeholder="เช่น 250.0"
                                            value={bulkReadings[room.id]?.electricity_current ?? ''}
                                            onChange={(e) => {
                                              const newValue = e.target.value;
                                              setBulkReadings({
                                                ...bulkReadings,
                                                [room.id]: {
                                                  ...bulkReadings[room.id],
                                                  electricity_current: newValue,
                                                  electricity_previous: canEditMeterHistory 
                                                    ? (bulkReadings[room.id]?.electricity_previous ?? electricityPrevious ?? '')
                                                    : (hasExistingReading ? electricityPrevious : (bulkReadings[room.id]?.electricity_previous ?? ''))
                                                }
                                              });
                                            }}
                                            className="w-32"
                                          />
                                        </td>
                                      </>
                                    )}
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          )}

          {/* ✅ Pagination */}
          {totalPages > 1 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-slate-600">
                    แสดง {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, roomsDataForDisplay.length)} จาก {roomsDataForDisplay.length} ห้อง
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      ← ก่อนหน้า
                    </Button>
                    <span className="px-3 py-2 text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      ถัดไป →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Dialog สำหรับ Desktop */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>บันทึกมิเตอร์ - ห้อง {editingRoom?.room_number}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {(() => {
              const latest = getLatestReading(editingRoom?.id);
              // ถ้าไม่มีประวัติเก่า (ครั้งแรก) ให้แสดงช่องกรอกเลขมิเตอร์ตั้งต้น
              if (!latest) {
                return (
                  <div className="space-y-4 border-b pb-4 mb-4">
                    <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                      <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        บันทึกครั้งแรก (ตั้งต้น)
                      </p>
                      <p className="text-xs text-amber-700 mt-1">
                        กรุณาระบุเลขมิเตอร์ตั้งต้น (ครั้งก่อน) เพื่อใช้คำนวณยอดหน่วยที่ใช้จริง
                        หากเป็นการจดครั้งแรกและไม่ต้องการคิดเงิน ให้ใส่เลขเท่ากับมิเตอร์ปัจจุบัน
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-slate-600">มิเตอร์น้ำ (ครั้งก่อน)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.water_previous}
                          onChange={(e) => setFormData({ ...formData, water_previous: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <Label className="text-slate-600">มิเตอร์ไฟ (ครั้งก่อน)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.electricity_previous}
                          onChange={(e) => setFormData({ ...formData, electricity_previous: e.target.value })}
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </div>
                );
              }
              
              return (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-slate-600 mb-2">ค่ามิเตอร์ครั้งก่อน (อัตโนมัติ):</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4 text-blue-600" />
                      <span className="text-slate-600">น้ำ:</span>
                      <span className="font-bold text-blue-600">{latest.water_current}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-600" />
                      <span className="text-slate-600">ไฟ:</span>
                      <span className="font-bold text-yellow-600">{latest.electricity_current}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>มิเตอร์น้ำ (ปัจจุบัน) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.water_current}
                  onChange={(e) => setFormData({ ...formData, water_current: e.target.value })}
                  placeholder="เช่น 150.5"
                  required
                />
                {formData.water_current && (
                  <p className="text-xs text-right mt-1 text-slate-500">
                    ใช้ไป: {(parseFloat(formData.water_current) - parseFloat(formData.water_previous || 0)).toFixed(2)} หน่วย
                  </p>
                )}
              </div>

              <div>
                <Label>มิเตอร์ไฟ (ปัจจุบัน) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.electricity_current}
                  onChange={(e) => setFormData({ ...formData, electricity_current: e.target.value })}
                  placeholder="เช่น 250.0"
                  required
                />
                {formData.electricity_current && (
                  <p className="text-xs text-right mt-1 text-slate-500">
                    ใช้ไป: {(parseFloat(formData.electricity_current) - parseFloat(formData.electricity_previous || 0)).toFixed(2)} หน่วย
                  </p>
                )}
              </div>
            </div>



            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-green-600 to-emerald-600">
                {createMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog - ประวัติการบันทึก */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              ประวัติการบันทึกมิเตอร์ - ห้อง {selectedReading?.room?.room_number}
            </DialogTitle>
          </DialogHeader>
          
          {selectedReading && (
            <div className="space-y-4">
              {selectedReading.tenant && (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <p className="font-semibold text-slate-800">ผู้เช่า: {selectedReading.tenant.full_name}</p>
                    <p className="text-sm text-slate-600">โทร: {selectedReading.tenant.phone}</p>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-3">
                {selectedReading.readings.map((meterReading, index) => (
                  <Card key={meterReading.id} className={index === 0 ? 'border-2 border-blue-500' : ''}>
                    <CardContent className="p-4">
                      {/* โหมดแก้ไข */}
                      {editingReading?.id === meterReading.id ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <p className="font-semibold text-slate-800">แก้ไขมิเตอร์</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingReading(null)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label className="text-xs text-blue-600">น้ำครั้งก่อน</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editingReading.water_previous}
                                onChange={(e) => setEditingReading({...editingReading, water_previous: e.target.value})}
                                className="h-9"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-blue-600">น้ำปัจจุบัน</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editingReading.water_current}
                                onChange={(e) => setEditingReading({...editingReading, water_current: e.target.value})}
                                className="h-9"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-yellow-600">ไฟครั้งก่อน</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editingReading.electricity_previous}
                                onChange={(e) => setEditingReading({...editingReading, electricity_previous: e.target.value})}
                                className="h-9"
                              />
                            </div>
                            <div>
                              <Label className="text-xs text-yellow-600">ไฟปัจจุบัน</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={editingReading.electricity_current}
                                onChange={(e) => setEditingReading({...editingReading, electricity_current: e.target.value})}
                                className="h-9"
                              />
                            </div>
                          </div>
                          
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setEditingReading(null)}>
                              ยกเลิก
                            </Button>
                            <Button 
                              size="sm"
                              disabled={updateMutation.isPending}
                              onClick={() => {
                                updateMutation.mutate({
                                  id: editingReading.id,
                                  data: {
                                    water_previous: editingReading.water_previous,
                                    water_current: editingReading.water_current,
                                    electricity_previous: editingReading.electricity_previous,
                                    electricity_current: editingReading.electricity_current
                                  }
                                });
                                setEditingReading(null);
                              }}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {updateMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <p className="font-semibold text-slate-800">
                                {format(parseISO(meterReading.reading_date), 'd MMMM yyyy', { locale: th })}
                              </p>
                              {index === 0 && <Badge className="mt-1 bg-blue-100 text-blue-700">ล่าสุด</Badge>}
                            </div>
                            
                            <div className="flex gap-1">
                              {/* ปุ่มแก้ไข - เจ้าของและ Developer แก้ได้เสมอ */}
                              {(canEditHistory || userRole === 'owner' || userRole === 'developer') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingReading({
                                    id: meterReading.id,
                                    water_previous: meterReading.water_previous,
                                    water_current: meterReading.water_current,
                                    electricity_previous: meterReading.electricity_previous,
                                    electricity_current: meterReading.electricity_current
                                  })}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              {/* ปุ่มลบ */}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteReading(meterReading, selectedReading.room.room_number)}
                                  disabled={deleteMutation.isPending}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-blue-600">
                                <Droplets className="w-4 h-4" />
                                <span className="font-semibold">น้ำ</span>
                              </div>
                              <div className="text-sm space-y-1 pl-6">
                                <p>ครั้งก่อน: <span className="font-medium">{meterReading.water_previous}</span></p>
                                <p>ครั้งนี้: <span className="font-medium">{meterReading.water_current}</span></p>
                                <p className="text-blue-600 font-bold">ใช้ไป: {meterReading.water_units} หน่วย</p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <div className="flex items-center gap-2 text-yellow-600">
                                <Zap className="w-4 h-4" />
                                <span className="font-semibold">ไฟ</span>
                              </div>
                              <div className="text-sm space-y-1 pl-6">
                                <p>ครั้งก่อน: <span className="font-medium">{meterReading.electricity_previous}</span></p>
                                <p>ครั้งนี้: <span className="font-medium">{meterReading.electricity_current}</span></p>
                                <p className="text-yellow-600 font-bold">ใช้ไป: {meterReading.electricity_units} หน่วย</p>
                              </div>
                            </div>
                          </div>

                          {meterReading.notes && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-sm text-slate-600">{meterReading.notes}</p>
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}