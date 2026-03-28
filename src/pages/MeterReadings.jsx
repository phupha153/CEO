import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Droplets, Zap, Calendar, TrendingUp, Building2, LayoutGrid, Table as TableIcon, Save, History, Check, Trash2, Search, X, AlertTriangle, List, Grid, Gauge, Download, Upload, FileSpreadsheet, Pencil, Sparkles, Loader2, CheckCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import PageHeader from "../components/shared/PageHeader";
import ExcelUploader from "../components/shared/ExcelUploader";
import ScrollToTopButton from "../components/shared/ScrollToTopButton";
import MeterHistoryDialog from "../components/meter/MeterHistoryDialog";
import * as XLSX from "xlsx";

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
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const nowUTC = new Date();
    const thaiOffset = 7 * 60;
    const nowThailand = new Date(nowUTC.getTime() + thaiOffset * 60 * 1000);
    return `${nowThailand.getUTCFullYear()}-${String(nowThailand.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [editingPreviousForRoom, setEditingPreviousForRoom] = useState(null); // room_id ที่กำลังแก้ไขค่าก่อน
  const [showAddMoreFormForRoom, setShowAddMoreFormForRoom] = useState(null); // room_id ที่กำลังแสดงฟอร์มบันทึกเพิ่ม
  const [meterTypeSelection, setMeterTypeSelection] = useState({}); // room_id -> 'water' | 'electricity' | 'both'
  const [previewData, setPreviewData] = useState([]);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [formData, setFormData] = useState({
    room_id: '',
    reading_date: new Date().toISOString().split('T')[0],
    water_current: '',
    electricity_current: '',
    notes: '',
    water_previous: 0, // Added for create/update mutations
    electricity_previous: 0, // Added for create/update mutations
  });

  // ✅ Infinite Scroll
  const [displayLimit, setDisplayLimit] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const loadMoreRef = useRef(null);

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
      setDisplayLimit(20); // Reset limit on search change
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

  // ✅ Shared query key for cache sharing
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Room.filter({ branch_id: selectedBranchId }, '', 1000);
    },
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    placeholderData: (previousData) => previousData,
  });

  // ✅ Backend filtering + Pagination - รองรับ 1M records (SaaS Standard)
  const { data: rawMeterReadings = [], isLoading: readingsLoading } = useQuery({
    queryKey: ['meterReadings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      
      let allData = [];
      let skip = 0;
      const limit = 1000; // ✅ ลด batch size ลงเพื่อไม่ให้เกิด Error Decompress
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

  // ⭐ Filter orphan readings - เก็บเฉพาะมิเตอร์ที่ห้องยังมีอยู่
  const meterReadings = useMemo(() => {
    if (!rooms.length || !rawMeterReadings.length) return rawMeterReadings;
    
    const validRoomIds = new Set(rooms.map(r => r.id));
    const filtered = rawMeterReadings.filter(reading => validRoomIds.has(reading.room_id));
    
    console.log(`🧹 Filtered ${rawMeterReadings.length - filtered.length} orphan meter readings`);
    return filtered;
  }, [rawMeterReadings, rooms]);

  // ✅ Shared query key for cache sharing
  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Booking.filter({ branch_id: selectedBranchId, status: 'active' }, '', 1000);
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
      const limit = 1000; // ✅ ลด batch size ลงเพื่อไม่ให้เกิด Error Decompress
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
    queryKey: ['configs'],
    queryFn: async () => {
      const allConfigs = await base44.entities.Config.list();
      // 🔒 Security: Filter configs based on accessible branches
      if (userRole === 'developer') return allConfigs;
      
      const accessibleBranchIds = currentUser?.accessible_branches || [];
      return allConfigs.filter(c => 
        !c.branch_id || // Global configs
        accessibleBranchIds.includes(c.branch_id) // Only configs from accessible branches
      );
    },
    enabled: canView && !!currentUser,
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
    const headers = ['หมายเลขห้อง', 'มิเตอร์น้ำครั้งก่อน', 'มิเตอร์น้ำปัจจุบัน', 'มิเตอร์ไฟครั้งก่อน', 'มิเตอร์ไฟปัจจุบัน'];
    
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
        const latest = getLatestReading(room.id);
        const waterPrev = latest?.water_current || 0;
        const elecPrev = latest?.electricity_current || 0;
        
        return [
          room.room_number,
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
    link.download = `บันทึกมิเตอร์_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success('ดาวน์โหลดไฟล์สำเร็จ');
  };

  // ✅ STEP 1: อ่าน CSV/Excel และแสดงตัวอย่าง
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!canAdd) {
      toast.error('คุณไม่มีสิทธิ์บันทึกมิเตอร์');
      return;
    }

    try {
      toast.info('กำลังอ่านไฟล์...');

      // ⭐ Check if Excel file
      const isExcel = file.name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      
      let text = '';
      if (isExcel) {
        console.log('📊 Reading Excel file...');
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        text = XLSX.utils.sheet_to_csv(worksheet);
      } else {
        text = await file.text();
      }
      
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('ไฟล์ไม่มีข้อมูล');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/^\ufeff/, ''));
      const parsedData = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.trim() || '';
        });
        parsedData.push(row);
      }

      // สร้าง preview data พร้อมข้อมูลเพิ่มเติม
      const preview = [];
      
      for (const row of parsedData) {
        const roomNumber = row['หมายเลขห้อง'];
        const waterCurrent = parseFloat(row['มิเตอร์น้ำปัจจุบัน']);
        const electricityCurrent = parseFloat(row['มิเตอร์ไฟปัจจุบัน']);
        const waterPrevFromFile = parseFloat(row['มิเตอร์น้ำครั้งก่อน']);
        const elecPrevFromFile = parseFloat(row['มิเตอร์ไฟครั้งก่อน']);

        if (!roomNumber) continue;

        const room = rooms.find(r => r.room_number === roomNumber);
        const booking = room ? getActiveBooking(room.id) : null;
        const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
        const latest = room ? getLatestReading(room.id) : null;

        let waterPrevious = !isNaN(waterPrevFromFile) ? waterPrevFromFile : (latest?.water_current || 0);
        let electricityPrevious = !isNaN(elecPrevFromFile) ? elecPrevFromFile : (latest?.electricity_current || 0);

        const waterUnits = !isNaN(waterCurrent) ? (waterCurrent - waterPrevious) : 0;
        const electricityUnits = !isNaN(electricityCurrent) ? (electricityCurrent - electricityPrevious) : 0;

        preview.push({
          roomNumber,
          tenantName: tenant?.full_name || '-',
          waterPrevious,
          waterCurrent: !isNaN(waterCurrent) ? waterCurrent : waterPrevious,
          waterUnits,
          electricityPrevious,
          electricityCurrent: !isNaN(electricityCurrent) ? electricityCurrent : electricityPrevious,
          electricityUnits,
          status: room ? 'ready' : 'error',
          errorMessage: room ? null : 'ไม่พบห้องในระบบ'
        });
      }

      setPreviewData(preview);
      setShowPreviewDialog(true);
      toast.success(`✅ อ่านไฟล์สำเร็จ ${preview.length} รายการ`);

    } catch (error) {
      console.error('File read error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }

    e.target.value = '';
  };

  // ✅ STEP 2: ยืนยันและนำเข้าข้อมูล
  const handleConfirmImport = async () => {
    try {
      const readyToImport = previewData.filter(d => d.status === 'ready');
      
      if (readyToImport.length === 0) {
        toast.error('ไม่มีข้อมูลที่สามารถนำเข้าได้');
        return;
      }

      setIsImporting(true);
      toast.info(`กำลังนำเข้า ${readyToImport.length} รายการ...`);

      let successCount = 0;
      let errorCount = 0;

      for (const item of readyToImport) {
        const room = rooms.find(r => r.room_number === item.roomNumber);
        if (!room) continue;

        try {
          await base44.entities.MeterReading.create({
            room_id: room.id,
            reading_date: new Date().toISOString().split('T')[0],
            water_previous: item.waterPrevious,
            water_current: item.waterCurrent,
            electricity_previous: item.electricityPrevious,
            electricity_current: item.electricityCurrent,
            water_units: item.waterUnits,
            electricity_units: item.electricityUnits,
            branch_id: selectedBranchId,
            notes: 'นำเข้าจาก Excel'
          });
          successCount++;
        } catch (e) {
          errorCount++;
        }
      }

      queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
      setShowPreviewDialog(false);
      setPreviewData([]);
      
      if (successCount > 0) {
        toast.success(`✅ นำเข้าสำเร็จ ${successCount} ห้อง`);
      }
      if (errorCount > 0) {
        toast.error(`❌ ไม่สามารถนำเข้าได้ ${errorCount} ห้อง`);
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setIsImporting(false);
    }
  };


  // Mutation สำหรับบันทึกมิเตอร์ทีละห้อง (Mobile Card View)
  const createSingleMutation = useMutation({
    mutationFn: async (data) => {
      if (!canAdd) {
        throw new Error('คุณไม่มีสิทธิ์บันทึกมิเตอร์');
      }

      const readingDate = new Date().toISOString().split('T')[0];
      const existingReading = meterReadings.find(r => 
        r.room_id === data.room_id && r.reading_date === readingDate
      );

      if (existingReading) {
        const waterPrevious = data.water_previous !== undefined && data.water_previous !== null && data.water_previous !== '' 
          ? parseFloat(data.water_previous) : existingReading.water_previous;
        const electricityPrevious = data.electricity_previous !== undefined && data.electricity_previous !== null && data.electricity_previous !== '' 
          ? parseFloat(data.electricity_previous) : existingReading.electricity_previous;
          
        const waterCurrent = data.water_current !== null && data.water_current !== undefined && data.water_current !== '' 
          ? parseFloat(data.water_current) : existingReading.water_current;
        const electricityCurrent = data.electricity_current !== null && data.electricity_current !== undefined && data.electricity_current !== '' 
          ? parseFloat(data.electricity_current) : existingReading.electricity_current;

        const waterUnits = waterCurrent - waterPrevious;
        const electricityUnits = electricityCurrent - electricityPrevious;

        return await base44.entities.MeterReading.update(existingReading.id, {
          water_previous: waterPrevious,
          water_current: waterCurrent,
          electricity_previous: electricityPrevious,
          electricity_current: electricityCurrent,
          water_units: waterUnits,
          electricity_units: electricityUnits,
          notes: data.notes || existingReading.notes || ''
        });
      }

      // ใช้ค่า water_previous & electricity_previous จาก data ที่ส่งมา หรือ auto-detect จากประวัติ
      let waterPrevious = data.water_previous !== undefined && data.water_previous !== null && data.water_previous !== '' ? parseFloat(data.water_previous) : null;
      let electricityPrevious = data.electricity_previous !== undefined && data.electricity_previous !== null && data.electricity_previous !== '' ? parseFloat(data.electricity_previous) : null;

      // ถ้าไม่ได้ส่งมา ให้ดึงจากประวัติ
      if (waterPrevious === null || waterPrevious === '') {
        const latestReading = meterReadings.find(r => r.room_id === data.room_id);
        waterPrevious = latestReading?.water_current || 0;
      }

      if (electricityPrevious === null || electricityPrevious === '') {
        const latestReading = meterReadings.find(r => r.room_id === data.room_id);
        electricityPrevious = latestReading?.electricity_current || 0;
      }

      const waterCurrent = data.water_current !== null && data.water_current !== undefined && data.water_current !== '' ? parseFloat(data.water_current) : waterPrevious;
      const electricityCurrent = data.electricity_current !== null && data.electricity_current !== undefined && data.electricity_current !== '' ? parseFloat(data.electricity_current) : electricityPrevious;

      const waterUnits = waterCurrent - waterPrevious;
      const electricityUnits = electricityCurrent - electricityPrevious;

      const readingData = {
        room_id: data.room_id,
        reading_date: readingDate,
        water_previous: waterPrevious,
        water_current: waterCurrent,
        electricity_previous: electricityPrevious,
        electricity_current: electricityCurrent,
        water_units: waterUnits,
        electricity_units: electricityUnits,
        notes: data.notes || '',
        branch_id: selectedBranchId
      };

      return await base44.entities.MeterReading.create(readingData);
    },
    onSuccess: (newReading, variables) => {
      // ⚡ Optimistic update - ไม่ต้องรอ
      queryClient.setQueryData(['meterReadings', selectedBranchId], (old) => {
        if (!old) return [newReading];
        const existsIndex = old.findIndex(r => r.id === newReading.id);
        if (existsIndex >= 0) {
          const newCache = [...old];
          newCache[existsIndex] = newReading;
          return newCache;
        }
        return [newReading, ...old];
      });
      
      setCardReadings(prev => {
        const newState = { ...prev };
        delete newState[variables.room_id];
        return newState;
      });
      toast.success('บันทึกมิเตอร์สำเร็จ');
      
      // บันทึก log ใน background
      const room = rooms.find(r => r.id === newReading.room_id);
      base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'create',
        entity_type: 'MeterReading',
        entity_id: newReading.id,
        entity_name: `ห้อง ${room?.room_number || 'N/A'}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `บันทึกมิเตอร์ห้อง ${room?.room_number || 'N/A'} - ไฟ: ${newReading.electricity_units} น้ำ: ${newReading.water_units}`
      }).catch(() => {});
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

      const existingReading = meterReadings.find(r => 
        r.room_id === data.room_id && r.reading_date === data.reading_date
      );

      if (existingReading) {
        const waterCurrent = data.water_current !== null && data.water_current !== undefined && data.water_current !== '' 
          ? parseFloat(data.water_current) : existingReading.water_current;
        const electricityCurrent = data.electricity_current !== null && data.electricity_current !== undefined && data.electricity_current !== '' 
          ? parseFloat(data.electricity_current) : existingReading.electricity_current;
        const waterPrevious = data.water_previous !== null && data.water_previous !== undefined && data.water_previous !== '' 
          ? parseFloat(data.water_previous) : existingReading.water_previous;
        const electricityPrevious = data.electricity_previous !== null && data.electricity_previous !== undefined && data.electricity_previous !== '' 
          ? parseFloat(data.electricity_previous) : existingReading.electricity_previous;

        const waterUnits = waterCurrent - waterPrevious;
        const electricityUnits = electricityCurrent - electricityPrevious;

        return await base44.entities.MeterReading.update(existingReading.id, {
          water_previous: waterPrevious,
          water_current: waterCurrent,
          electricity_previous: electricityPrevious,
          electricity_current: electricityCurrent,
          water_units: waterUnits,
          electricity_units: electricityUnits,
          notes: data.notes || existingReading.notes || ''
        });
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
        const existingReading = meterReadings.find(r => 
          r.room_id === data.room_id && r.reading_date === data.reading_date
        );

        if (existingReading) {
          const waterPrevious = data.water_previous !== undefined && data.water_previous !== null && data.water_previous !== '' 
            ? parseFloat(data.water_previous) : existingReading.water_previous;
          const electricityPrevious = data.electricity_previous !== undefined && data.electricity_previous !== null && data.electricity_previous !== '' 
            ? parseFloat(data.electricity_previous) : existingReading.electricity_previous;
            
          const waterCurrent = data.water_current !== null && data.water_current !== undefined && data.water_current !== '' 
            ? parseFloat(data.water_current) : existingReading.water_current;
          const electricityCurrent = data.electricity_current !== null && data.electricity_current !== undefined && data.electricity_current !== '' 
            ? parseFloat(data.electricity_current) : existingReading.electricity_current;

          const waterUnits = waterCurrent - waterPrevious;
          const electricityUnits = electricityCurrent - electricityPrevious;

          const result = await base44.entities.MeterReading.update(existingReading.id, {
            water_previous: waterPrevious,
            water_current: waterCurrent,
            electricity_previous: electricityPrevious,
            electricity_current: electricityCurrent,
            water_units: waterUnits,
            electricity_units: electricityUnits,
            notes: data.notes || existingReading.notes || ''
          });
          results.push(result);
        } else {
          // ใช้ค่า water_previous และ electricity_previous จาก data ที่ส่งมา
          let waterPrevious = data.water_previous !== undefined && data.water_previous !== null && data.water_previous !== '' 
            ? parseFloat(data.water_previous) 
            : null;
          let electricityPrevious = data.electricity_previous !== undefined && data.electricity_previous !== null && data.electricity_previous !== '' 
            ? parseFloat(data.electricity_previous) 
            : null;
            
          // ถ้าไม่ได้ส่งมา ให้ดึงจากประวัติล่าสุด
          if (waterPrevious === null) {
            const latestReading = meterReadings.find(r => r.room_id === data.room_id);
            waterPrevious = latestReading?.water_current || 0;
          }
          if (electricityPrevious === null) {
            const latestReading = meterReadings.find(r => r.room_id === data.room_id);
            electricityPrevious = latestReading?.electricity_current || 0;
          }
          
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
    if (!data || (data.water_current == null || data.water_current === '') && (data.electricity_current == null || data.electricity_current === '')) {
      toast.error('กรุณากรอกข้อมูลมิเตอร์อย่างน้อย 1 อย่าง');
      return;
    }

    createSingleMutation.mutate({
      room_id: roomId,
      water_current: data.water_current && data.water_current !== '' ? parseFloat(data.water_current) : null,
      electricity_current: data.electricity_current && data.electricity_current !== '' ? parseFloat(data.electricity_current) : null,
      water_previous: data.water_previous !== undefined && data.water_previous !== '' ? parseFloat(data.water_previous) : null,
      electricity_previous: data.electricity_previous !== undefined && data.electricity_previous !== '' ? parseFloat(data.electricity_previous) : null,
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

  // ✅ Check if room has been recorded in the SELECTED month
  const recordedRoomsThisMonthMap = useMemo(() => {
    const map = new Map();
    const [year, month] = selectedMonth.split('-').map(Number);

    meterReadings.forEach(r => {
      try {
        const readingDate = parseISO(r.reading_date);
        if (readingDate.getMonth() === (month - 1) && readingDate.getFullYear() === year) {
          map.set(r.room_id, true);
        }
      } catch {}
    });
    return map;
  }, [meterReadings, selectedMonth]);

  const getRoomInfo = useCallback((roomId) => roomsMap.get(roomId), [roomsMap]);
  const getActiveBooking = useCallback((roomId) => bookingsMap.get(roomId), [bookingsMap]);
  const getTenantInfo = useCallback((tenantId) => tenantsMap.get(tenantId), [tenantsMap]);
  const getLatestReading = useCallback((roomId) => meterReadingsMap.get(roomId), [meterReadingsMap]);
  const hasRecordedThisMonth = useCallback((roomId) => recordedRoomsThisMonthMap.has(roomId), [recordedRoomsThisMonthMap]);

  const { totalElectricityThisMonth, totalWaterThisMonth, monthReadingsCount } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    
    // Filter readings for selected month
    const monthReadings = meterReadings.filter(r => {
      try {
        const readingDate = parseISO(r.reading_date);
        return readingDate.getMonth() === (month - 1) && readingDate.getFullYear() === year;
      } catch {
        return false;
      }
    });

    // Total electricity for selected month
    const totalElectricity = monthReadings.reduce((sum, r) => sum + (r.electricity_units || 0), 0);

    // Total water for selected month
    const totalWater = monthReadings.reduce((sum, r) => sum + (r.water_units || 0), 0);

    return { 
      totalElectricityThisMonth: totalElectricity, 
      totalWaterThisMonth: totalWater,
      monthReadingsCount: monthReadings.length
    };
  }, [meterReadings, selectedMonth]);

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

  // ✅ Infinite Scroll Display
  const displayedRooms = useMemo(() => {
    return roomsDataForDisplay.slice(0, displayLimit);
  }, [roomsDataForDisplay, displayLimit]);

  const displayRoomsByFloor = useMemo(() => {
    const grouped = displayedRooms.reduce((acc, room) => {
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
  }, [displayedRooms]);

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


  // ✅ Reset display limit when filters change
  useEffect(() => {
    setDisplayLimit(20);
  }, [selectedFloor, debouncedSearch]);

  // ✅ Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayLimit < roomsDataForDisplay.length) {
          setDisplayLimit(prev => Math.min(prev + 20, roomsDataForDisplay.length));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [displayLimit, roomsDataForDisplay.length]);

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
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <PageHeader 
          title="บันทึกมิเตอร์" 
          subtitle={`สาขา ${selectedBranchName}`}
          icon={Gauge}
        />
        <div className="px-4 md:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
            {/* Stats Cards Skeleton */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Card key={i} className="bg-white/60 backdrop-blur-xl border-white/50 shadow-xl overflow-hidden">
                  <CardContent className="p-4 md:p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-slate-200" />
                    </div>
                    <div className="h-4 bg-slate-200 rounded w-24 mb-2" />
                    <div className="h-8 bg-slate-200 rounded w-20 mb-1" />
                    <div className="h-3 bg-slate-200 rounded w-16" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Filter Cards Skeleton */}
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="h-10 bg-slate-200 rounded w-40" />
                  <div className="h-10 bg-slate-200 rounded w-32" />
                </div>
              </CardContent>
            </Card>

            {/* Room Cards Skeleton */}
            <div className="space-y-8">
              {[1, 2].map((floor) => (
                <div key={floor} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-slate-200 rounded" />
                    <div className="h-8 bg-slate-200 rounded w-32" />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(3)].map((_, i) => (
                      <Card key={i} className="bg-white/80 backdrop-blur-sm">
                        <CardContent className="p-6">
                          <div className="h-6 bg-slate-200 rounded w-24 mb-4" />
                          <div className="h-32 bg-slate-100 rounded-xl mb-3" />
                          <div className="h-4 bg-slate-200 rounded w-full mb-2" />
                          <div className="h-4 bg-slate-200 rounded w-3/4" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
            {!isMobile && (
              <>
                <Button
                  onClick={handleDownloadTemplate}
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                >
                  <Download className="w-4 h-4 mr-2" />
                  ดาวน์โหลด
                </Button>

                {canAdd && (
                  <>
                    <input
                      type="file"
                      accept=".csv,.xlsx"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="csv-upload-meter"
                    />
                    <Button
                      variant="outline"
                      onClick={() => document.getElementById('csv-upload-meter').click()}
                      className="border-blue-600 text-blue-600 hover:bg-blue-50"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      อัปโหลดไฟล์
                    </Button>
                  </>
                )}
              </>
            )}



          </div>
        }
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Summary Cards - สไตล์เดียวกับหน้าการชำระเงิน */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-indigo-400 to-purple-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg">
                        <Gauge className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1 hidden md:block">ห้องที่มีการบันทึก</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {Object.keys(readingsByRoomForSummary).length}
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">ห้อง</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 shadow-lg">
                        <Zap className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1 hidden md:block">ไฟฟ้าใช้ทั้งหมด</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {totalElectricityThisMonth.toLocaleString('th-TH')}
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">หน่วย ({monthReadingsCount} รายการ)</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-400 to-blue-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg">
                        <Droplets className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1 hidden md:block">น้ำใช้ทั้งหมด</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {totalWaterThisMonth.toLocaleString('th-TH')}
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">หน่วย ({monthReadingsCount} รายการ)</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: 1.02, y: -4 }}
              transition={{ duration: 0.3, delay: 0.3 }}
            >
              <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 opacity-5" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 opacity-10 blur-3xl" />
                
                <CardContent className="p-4 md:p-6 relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl blur-md opacity-30" />
                      <div className="relative p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-slate-500 mb-1 hidden md:block">บันทึกเดือนนี้</p>
                  <motion.p 
                    className="text-3xl font-bold text-slate-800"
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                  >
                    {monthReadingsCount}
                  </motion.p>
                  <p className="text-xs text-slate-500 mt-1">ห้อง</p>
                </CardContent>
              </Card>
            </motion.div>
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

          {/* Floor Filter + AI Analysis */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="p-2 border rounded-md text-sm"
                  >
                    {(() => {
                      const months = [];
                      const now = new Date();
                      for (let i = 0; i < 12; i++) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const label = format(d, 'MMM yyyy', { locale: th });
                        months.push(<option key={value} value={value}>{label}</option>);
                      }
                      return months;
                    })()}
                  </select>
                </div>

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
              {displayFloors.map((floor) => {
                const floorRooms = displayRoomsByFloor[floor];
                const floorHasUnsaved = floorRooms.some(room => cardReadings[room.id]?.water_current || cardReadings[room.id]?.electricity_current);
                
                return (
                <div key={floor} className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-6 h-6 text-blue-600" />
                      <h2 className="text-2xl font-bold text-slate-800">ชั้น {floor}</h2>
                      <Badge variant="outline" className="text-sm">
                        {floorRooms.length} ห้อง
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {isMobile && floorHasUnsaved && (
                        <Button
                          onClick={() => {
                            // บันทึกทุกห้องในชั้นที่กรอกข้อมูลแล้ว
                            floorRooms.forEach(room => {
                              const data = cardReadings[room.id];
                              if (data?.water_current && data?.electricity_current) {
                                handleSaveSingleReading(room.id);
                              }
                            });
                          }}
                          size="sm"
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          บันทึกชั้นนี้
                        </Button>
                      )}
                      
                      <Button
                        onClick={() => setViewMode('table')}
                        variant="outline"
                        size="sm"
                        className="border-slate-400 text-slate-600 hover:bg-slate-50"
                      >
                        <List className="w-4 h-4 mr-1" />
                        ตาราง
                      </Button>
                    </div>
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
                              {/* Desktop View - แสดง Empty State ถ้าไม่มีการบันทึก */}
                              {!isMobile && (
                                <Card className={`bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all ${hasRecordedThisMonth(room.id) ? 'border-2 border-green-500' : 'border-slate-200/60'}`}>
                                  <CardContent className="p-6">
                                    <div className="flex items-center justify-between mb-4">
                                      <div className="flex items-center gap-2">
                                        <h3 className="text-xl font-bold text-slate-800">ห้อง {room.room_number}</h3>
                                        {tenant && (
                                          <p className="text-sm text-slate-500 ml-2">{tenant.full_name}</p>
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

                                    {/* ถ้าไม่เคยบันทึก - แสดง Empty State หรือ Form */}
                                    {!hasReading && showAddMoreFormForRoom !== room.id ? (
                                      <button
                                        onClick={() => setShowAddMoreFormForRoom(room.id)}
                                        className="w-full flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-blue-300 rounded-xl bg-gradient-to-br from-blue-50 to-sky-50 cursor-pointer hover:border-blue-500 hover:from-blue-100 hover:to-sky-100 hover:shadow-md transition-all active:scale-95 group"
                                      >
                                        <div className="w-16 h-16 rounded-full bg-white border-2 border-blue-200 flex items-center justify-center mb-3 group-hover:border-blue-400 transition-colors shadow-sm">
                                          <Plus className="w-8 h-8 text-blue-600" />
                                        </div>
                                        <p className="text-slate-700 font-semibold mb-1">ยังไม่มีการบันทึก</p>
                                        <p className="text-sm text-slate-500">เป็นครั้งแรกในการบันทึกมิเตอร์</p>
                                      </button>
                                    ) : (
                                      <div className="space-y-3">
                                        {latest && (
                                          <div 
                                            onClick={() => {
                                              if (!canEdit) {
                                                toast.error('คุณไม่มีสิทธิ์แก้ไขมิเตอร์');
                                                return;
                                              }
                                              handleViewHistory(room);
                                              setEditingReading({
                                                id: latest.id,
                                                water_previous: latest.water_previous,
                                                water_current: latest.water_current,
                                                electricity_previous: latest.electricity_previous,
                                                electricity_current: latest.electricity_current
                                              });
                                            }}
                                            className={`bg-blue-50 rounded-lg p-2 mb-2 ${canEdit ? 'cursor-pointer hover:bg-blue-100 transition-colors' : 'opacity-60'}`}
                                          >
                                            <p className="text-xs text-slate-600 mb-1">ค่ามิเตอร์ครั้งก่อน: {canEdit ? '(คลิกแก้ไข)' : '(ดูอย่างเดียว)'}</p>
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

                                        {/* ถ้าบันทึกแล้ว แสดงข้อความ + ปุ่มเล็ก */}
                                        {hasRecordedThisMonth(room.id) && showAddMoreFormForRoom !== room.id ? (
                                          <div className="space-y-3">
                                            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
                                              <div className="flex items-center justify-center gap-2 mb-2">
                                                <Check className="w-5 h-5 text-green-600" />
                                                <p className="text-sm font-bold text-green-700">เดือนนี้บันทึกแล้ว</p>
                                              </div>

                                              <Button
                                                onClick={() => setShowAddMoreFormForRoom(room.id)}
                                                size="sm"
                                                variant="outline"
                                                className="border-green-600 text-green-600 hover:bg-green-50"
                                              >
                                                <Plus className="w-3 h-3 mr-1" />
                                                บันทึกเพิ่ม
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            {hasRecordedThisMonth(room.id) && (
                                              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                                                <p className="text-xs text-amber-700 text-center">⚠️ เดือนนี้บันทึกแล้ว - กำลังบันทึกเพิ่ม</p>
                                              </div>
                                            )}
                                            {!latest && (
                                              <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-3">
                                                <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                                                  <AlertTriangle className="w-4 h-4" />
                                                  บันทึกครั้งแรก (ตั้งต้น)
                                                </p>
                                                <p className="text-xs text-amber-700 mt-1">
                                                  กรุณาระบุเลขมิเตอร์ตั้งต้น (ครั้งก่อน) เพื่อใช้คำนวณยอดหน่วยที่ใช้จริง
                                                </p>
                                              </div>
                                            )}
                                            <div className="grid grid-cols-2 gap-2">
                                              {!latest && (
                                                <>
                                                  <div>
                                                    <Label className="text-xs">น้ำ ครั้งก่อน</Label>
                                                    <Input
                                                      type="number"
                                                      step="0.01"
                                                      placeholder="0"
                                                      value={cardReadings[room.id]?.water_previous || ''}
                                                      onChange={(e) => setCardReadings(prev => ({
                                                        ...prev,
                                                        [room.id]: {
                                                          ...prev[room.id],
                                                          water_previous: e.target.value
                                                        }
                                                      }))}
                                                      disabled={!canAdd || createSingleMutation.isPending}
                                                      className="h-9 text-sm"
                                                    />
                                                  </div>
                                                  <div>
                                                    <Label className="text-xs">ไฟ ครั้งก่อน</Label>
                                                    <Input
                                                      type="number"
                                                      step="0.01"
                                                      placeholder="0"
                                                      value={cardReadings[room.id]?.electricity_previous || ''}
                                                      onChange={(e) => setCardReadings(prev => ({
                                                        ...prev,
                                                        [room.id]: {
                                                          ...prev[room.id],
                                                          electricity_previous: e.target.value
                                                        }
                                                      }))}
                                                      disabled={!canAdd || createSingleMutation.isPending}
                                                      className="h-9 text-sm"
                                                    />
                                                  </div>
                                                </>
                                              )}
                                              <div>
                                                <Label className="text-xs">น้ำปัจจุบัน</Label>
                                                <Input
                                                  type="number"
                                                  step="0.01"
                                                  placeholder="150.5"
                                                  value={cardReadings[room.id]?.water_current || ''}
                                                  onChange={(e) => setCardReadings(prev => ({
                                                    ...prev,
                                                    [room.id]: {
                                                      ...prev[room.id],
                                                      water_current: e.target.value
                                                    }
                                                  }))}
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
                                                  onChange={(e) => setCardReadings(prev => ({
                                                    ...prev,
                                                    [room.id]: {
                                                      ...prev[room.id],
                                                      electricity_current: e.target.value
                                                    }
                                                  }))}
                                                  disabled={!canAdd || createSingleMutation.isPending}
                                                  className="h-9 text-sm"
                                                />
                                              </div>
                                            </div>

                                            <div className="flex gap-2">
                                              <Button
                                                onClick={() => handleSaveSingleReading(room.id)}
                                                disabled={
                                                  !canAdd || 
                                                  createSingleMutation.isPending ||
                                                  ((cardReadings[room.id]?.water_current == null || cardReadings[room.id]?.water_current === '') &&
                                                   (cardReadings[room.id]?.electricity_current == null || cardReadings[room.id]?.electricity_current === ''))
                                                }
                                                className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-9"
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
                                              {hasRecordedThisMonth(room.id) && showAddMoreFormForRoom === room.id && (
                                                <Button
                                                  onClick={() => {
                                                    setShowAddMoreFormForRoom(null);
                                                    setCardReadings(prev => {
                                                      const newState = {...prev};
                                                      delete newState[room.id];
                                                      return newState;
                                                    });
                                                  }}
                                                  size="sm"
                                                  variant="outline"
                                                  className="h-9"
                                                >
                                                  <X className="w-4 h-4" />
                                                </Button>
                                              )}
                                            </div>
                                          </>
                                        )}

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
                                    )}
                                  </CardContent>
                                </Card>
                              )}

                              {/* Mobile View - กรอกข้อมูลในการ์ดเลย */}
                              {isMobile && (
                               <Card className={`bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all ${hasRecordedThisMonth(room.id) ? 'border-2 border-green-500' : 'border-slate-200/60'}`}>
                                 <CardContent className="p-6">
                                   <div className="flex items-center justify-between mb-4">
                                     <div className="flex items-center gap-2">
                                       <h3 className="text-xl font-bold text-slate-800">ห้อง {room.room_number}</h3>
                                       {hasRecordedThisMonth(room.id) && (
                                         <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                                           <Check className="w-3 h-3 mr-1" />
                                           บันทึกแล้ว
                                         </Badge>
                                       )}
                                       {tenant && (
                                         <p className="text-sm text-slate-500 ml-2">{tenant.full_name}</p>
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

                                   {/* ถ้าไม่เคยบันทึก - แสดง Empty State หรือ Form */}
                                   {!hasReading && showAddMoreFormForRoom !== room.id ? (
                                     <button
                                       onClick={() => setShowAddMoreFormForRoom(room.id)}
                                       className="w-full flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-blue-300 rounded-xl bg-gradient-to-br from-blue-50 to-sky-50 cursor-pointer hover:border-blue-500 hover:from-blue-100 hover:to-sky-100 hover:shadow-md transition-all active:scale-95 group"
                                     >
                                       <div className="w-16 h-16 rounded-full bg-white border-2 border-blue-200 flex items-center justify-center mb-3 group-hover:border-blue-400 transition-colors shadow-sm">
                                         <Plus className="w-8 h-8 text-blue-600" />
                                       </div>
                                       <p className="text-slate-700 font-semibold mb-1">ยังไม่มีการบันทึก</p>
                                       <p className="text-sm text-slate-500">เป็นครั้งแรกในการบันทึกมิเตอร์</p>
                                     </button>
                                   ) : (
                                     <div className="space-y-3">
                                       {latest && (
                                         <div 
                                           onClick={() => {
                                             if (!canEdit) {
                                               toast.error('คุณไม่มีสิทธิ์แก้ไขมิเตอร์');
                                               return;
                                             }
                                             handleViewHistory(room);
                                             setEditingReading({
                                               id: latest.id,
                                               water_previous: latest.water_previous,
                                               water_current: latest.water_current,
                                               electricity_previous: latest.electricity_previous,
                                               electricity_current: latest.electricity_current
                                             });
                                           }}
                                           className={`bg-blue-50 rounded-lg p-2 mb-2 ${canEdit ? 'cursor-pointer hover:bg-blue-100 transition-colors' : 'opacity-60'}`}
                                         >
                                           <p className="text-xs text-slate-600 mb-1">ค่ามิเตอร์ครั้งก่อน: {canEdit ? '(คลิกแก้ไข)' : '(ดูอย่างเดียว)'}</p>
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

                                      {/* ถ้าบันทึกแล้ว แสดงข้อความ + ปุ่มเล็ก */}
                                      {hasRecordedThisMonth(room.id) && showAddMoreFormForRoom !== room.id ? (
                                        <div className="space-y-3">
                                          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                              <Check className="w-5 h-5 text-green-600" />
                                              <p className="text-sm font-bold text-green-700">เดือนนี้บันทึกแล้ว</p>
                                            </div>
                                            {latest && (
                                              <div className="flex justify-center gap-4 text-xs text-slate-600 mb-3">
                                                <span>น้ำ: {latest.water_units} หน่วย</span>
                                                <span>ไฟ: {latest.electricity_units} หน่วย</span>
                                              </div>
                                            )}
                                            <Button
                                              onClick={() => setShowAddMoreFormForRoom(room.id)}
                                              size="sm"
                                              variant="outline"
                                              className="border-green-600 text-green-600 hover:bg-green-50"
                                            >
                                              <Plus className="w-3 h-3 mr-1" />
                                              บันทึกเพิ่ม
                                            </Button>
                                          </div>
                                        </div>
                                      ) : (
                                        <>
                                          {hasRecordedThisMonth(room.id) && (
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2">
                                              <p className="text-xs text-amber-700 text-center">⚠️ เดือนนี้บันทึกแล้ว - กำลังบันทึกเพิ่ม</p>
                                            </div>
                                          )}
                                          {!latest && (
                                            <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-3">
                                              <p className="text-sm text-amber-800 font-medium flex items-center gap-2">
                                                <AlertTriangle className="w-4 h-4" />
                                                บันทึกครั้งแรก (ตั้งต้น)
                                              </p>
                                              <p className="text-xs text-amber-700 mt-1">
                                                กรุณาระบุเลขมิเตอร์ตั้งต้น (ครั้งก่อน) เพื่อใช้คำนวณยอดหน่วยที่ใช้จริง
                                              </p>
                                            </div>
                                          )}
                                          <div className="grid grid-cols-2 gap-2">
                                            {!latest && (
                                              <>
                                                <div>
                                                  <Label className="text-xs">น้ำ ครั้งก่อน</Label>
                                                  <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0"
                                                    value={cardReadings[room.id]?.water_previous || ''}
                                                    onChange={(e) => setCardReadings(prev => ({
                                                      ...prev,
                                                      [room.id]: {
                                                        ...prev[room.id],
                                                        water_previous: e.target.value
                                                      }
                                                    }))}
                                                    disabled={!canAdd || createSingleMutation.isPending}
                                                    className="h-9 text-sm"
                                                  />
                                                </div>
                                                <div>
                                                  <Label className="text-xs">ไฟ ครั้งก่อน</Label>
                                                  <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0"
                                                    value={cardReadings[room.id]?.electricity_previous || ''}
                                                    onChange={(e) => setCardReadings(prev => ({
                                                      ...prev,
                                                      [room.id]: {
                                                        ...prev[room.id],
                                                        electricity_previous: e.target.value
                                                      }
                                                    }))}
                                                    disabled={!canAdd || createSingleMutation.isPending}
                                                    className="h-9 text-sm"
                                                  />
                                                </div>
                                              </>
                                            )}
                                            <div>
                                              <Label className="text-xs">น้ำปัจจุบัน</Label>
                                              <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="150.5"
                                                value={cardReadings[room.id]?.water_current || ''}
                                                onChange={(e) => setCardReadings(prev => ({
                                                  ...prev,
                                                  [room.id]: {
                                                    ...prev[room.id],
                                                    water_current: e.target.value
                                                  }
                                                }))}
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
                                                onChange={(e) => setCardReadings(prev => ({
                                                  ...prev,
                                                  [room.id]: {
                                                    ...prev[room.id],
                                                    electricity_current: e.target.value
                                                  }
                                                }))}
                                                disabled={!canAdd || createSingleMutation.isPending}
                                                className="h-9 text-sm"
                                              />
                                            </div>
                                          </div>

                                          <div className="flex gap-2">
                                            <Button
                                              onClick={() => handleSaveSingleReading(room.id)}
                                              disabled={
                                                !canAdd || 
                                                createSingleMutation.isPending ||
                                                ((cardReadings[room.id]?.water_current == null || cardReadings[room.id]?.water_current === '') &&
                                                 (cardReadings[room.id]?.electricity_current == null || cardReadings[room.id]?.electricity_current === ''))
                                              }
                                              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-9"
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
                                            {hasRecordedThisMonth(room.id) && showAddMoreFormForRoom === room.id && (
                                              <Button
                                                onClick={() => {
                                                  setShowAddMoreFormForRoom(null);
                                                  setCardReadings(prev => {
                                                    const newState = {...prev};
                                                    delete newState[room.id];
                                                    return newState;
                                                  });
                                                }}
                                                size="sm"
                                                variant="outline"
                                                className="h-9"
                                              >
                                                <X className="w-4 h-4" />
                                              </Button>
                                            )}
                                            </div>
                                            </>
                                            )}

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
                                          )}
                                          </CardContent>
                                          </Card>
                                          )}
                                           </motion.div>
                                           );
                                           })}
                                           </AnimatePresence>
                                           </div>
                                           </div>
                                           );
                                           })}
                                           </div>
                                           )}

                                           {/* Table View */}
                                                                            {viewMode === 'table' && (
                                             <div className="space-y-6">
                                               {/* ตัวเลือกเวอร์ชัน + ประเภทมิเตอร์ */}
                                               <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                                                 <CardContent className="p-4">
                                                   <div className="flex flex-wrap items-center gap-4">
                                                     <div className="hidden md:flex items-center gap-2">
                                                       <History className="w-5 h-5 text-blue-600" />
                                                       <Label className="font-medium">เวอร์ชัน:</Label>
                      <select
                        value={selectedReadingVersion}
                        onChange={(e) => {
                          setSelectedReadingVersion(e.target.value);
                          setBulkReadings({}); // ล้างค่าเมื่อเปลี่ยนเวอร์ชัน
                          
                          // โหมดดูประวัติ
                          if (e.target.value.startsWith('view_')) {
                            const viewDate = e.target.value.replace('view_', '');
                            setBulkReadingDate(viewDate);
                          } else {
                            setBulkReadingDate(new Date().toISOString().split('T')[0]);
                          }
                        }}
                          className="p-2 border rounded-lg hidden md:block min-w-[200px]"
                        >
                          <option value="new">➕ บันทึกใหม่ (วันนี้)</option>
                        {/* แสดงประวัติจัดกลุ่มตามวันที่ - ดูอย่างเดียว (แสดงทั้ง developer และพนักงาน) */}
                        {(() => {
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
                      </select>
                    </div>
                    {selectedReadingVersion.startsWith('view_') && (
                      <Badge className="bg-blue-100 text-blue-700">
                        ดูประวัติ
                      </Badge>
                    )}

                    <div className="flex flex-wrap gap-2 md:gap-3">
                      <Button
                        size="sm"
                        variant={meterTypeSelection.tableType === 'water' ? 'default' : 'outline'}
                        onClick={() => setMeterTypeSelection({...meterTypeSelection, tableType: 'water'})}
                        className={`${meterTypeSelection.tableType === 'water' ? 'bg-blue-600 text-white' : ''} text-xs md:text-sm`}
                      >
                        <Droplets className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                        น้ำ
                      </Button>
                      <Button
                        size="sm"
                        variant={meterTypeSelection.tableType === 'electricity' ? 'default' : 'outline'}
                        onClick={() => setMeterTypeSelection({...meterTypeSelection, tableType: 'electricity'})}
                        className={`${meterTypeSelection.tableType === 'electricity' ? 'bg-yellow-600 text-white' : ''} text-xs md:text-sm`}
                      >
                        <Zap className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                        ไฟ
                      </Button>
                      <Button
                        size="sm"
                        variant={meterTypeSelection.tableType === 'both' || !meterTypeSelection.tableType ? 'default' : 'outline'}
                        onClick={() => setMeterTypeSelection({...meterTypeSelection, tableType: 'both'})}
                        className={`${meterTypeSelection.tableType === 'both' || !meterTypeSelection.tableType ? 'bg-purple-600 text-white' : ''} text-xs md:text-sm`}
                      >
                        ทั้งสอง
                      </Button>
                    </div>
                    </div>
                    </CardContent>
                    </Card>

              {displayFloors.map((floor) => (
                <div key={floor} className="space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <Building2 className="w-6 h-6 text-blue-600" />
                      <h2 className="text-2xl font-bold text-slate-800">ชั้น {floor}</h2>
                      <Badge variant="outline" className="text-sm">
                        {displayRoomsByFloor[floor].length} ห้อง
                      </Badge>
                    </div>
                    
                    <Button
                      onClick={() => setViewMode('card')}
                      variant="outline"
                      size="sm"
                      className="border-slate-400 text-slate-600 hover:bg-slate-50"
                    >
                      <Grid className="w-4 h-4 mr-1" />
                      การ์ด
                    </Button>
                  </div>

                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">ห้อง</th>
                              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 hidden md:table-cell">ผู้เช่า</th>
                              {(meterTypeSelection.tableType === 'water' || !meterTypeSelection.tableType || meterTypeSelection.tableType === 'both') && (
                                <>
                                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์น้ำก่อน</th>
                                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์น้ำปัจจุบัน</th>
                                </>
                              )}
                              {(meterTypeSelection.tableType === 'electricity' || !meterTypeSelection.tableType || meterTypeSelection.tableType === 'both') && (
                                <>
                                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์ไฟก่อน</th>
                                  <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">มิเตอร์ไฟปัจจุบัน</th>
                                </>
                              )}
                              <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700"></th>
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
                                
                                // โหมดดูประวัติ (ทุกคนที่เลือก view_)
                                const isViewMode = selectedReadingVersion.startsWith('view_');
                                const viewDate = isViewMode ? selectedReadingVersion.replace('view_', '') : null;
                                const historyReading = viewDate ? meterReadings.find(r => r.room_id === room.id && r.reading_date === viewDate) : null;
                                
                                return (
                                  <tr key={room.id} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-sm font-medium text-slate-800">
                                      <div className="flex items-center gap-2">
                                        {room.room_number}
                                        {hasRecordedThisMonth(room.id) && (
                                          <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs">
                                            <Check className="w-3 h-3 mr-1" />
                                            บันทึกแล้ว
                                          </Badge>
                                        )}
                                        {!hasExistingReading && !isViewMode && !hasRecordedThisMonth(room.id) && (
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
                                        {(meterTypeSelection.tableType === 'water' || !meterTypeSelection.tableType || meterTypeSelection.tableType === 'both') && (
                                          <>
                                            <td className="px-4 py-3 text-center">
                                              <div className="font-medium text-slate-600 bg-slate-100 rounded px-2 py-1.5">
                                                {historyReading?.water_previous ?? '-'}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <div className="font-bold text-blue-600 bg-blue-50 rounded px-2 py-1.5">
                                                {historyReading?.water_current ?? '-'}
                                                {historyReading && (
                                                  <span className="text-xs text-slate-500 ml-1">({historyReading.water_units})</span>
                                                )}
                                              </div>
                                            </td>
                                          </>
                                        )}
                                        {(meterTypeSelection.tableType === 'electricity' || !meterTypeSelection.tableType || meterTypeSelection.tableType === 'both') && (
                                          <>
                                            <td className="px-4 py-3 text-center">
                                              <div className="font-medium text-slate-600 bg-slate-100 rounded px-2 py-1.5">
                                                {historyReading?.electricity_previous ?? '-'}
                                              </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                              <div className="font-bold text-yellow-600 bg-yellow-50 rounded px-2 py-1.5">
                                                {historyReading?.electricity_current ?? '-'}
                                                {historyReading && (
                                                  <span className="text-xs text-slate-500 ml-1">({historyReading.electricity_units})</span>
                                                )}
                                              </div>
                                            </td>
                                          </>
                                        )}
                                      </>
                                    ) : (
                                    // โหมดบันทึก/แก้ไข
                                    <>
                                      {(meterTypeSelection.tableType === 'water' || !meterTypeSelection.tableType || meterTypeSelection.tableType === 'both') && (
                                        <>
                                          <td className="px-4 py-3 text-center">
                                            {editingPreviousForRoom === room.id ? (
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={bulkReadings[room.id]?.water_previous ?? waterPrevious ?? '0'}
                                                onChange={(e) => {
                                                  setBulkReadings(prev => ({
                                                    ...prev,
                                                    [room.id]: {
                                                      ...prev[room.id],
                                                      water_previous: e.target.value
                                                    }
                                                  }));
                                                }}
                                                className="w-24 mx-auto"
                                                autoFocus
                                              />
                                            ) : (
                                              <span className="font-medium text-slate-700">{bulkReadings[room.id]?.water_previous || waterPrevious || '0'}</span>
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
                                               setBulkReadings(prev => ({
                                                 ...prev,
                                                 [room.id]: {
                                                   ...prev[room.id],
                                                   water_current: newValue,
                                                   water_previous: prev[room.id]?.water_previous ?? (hasExistingReading ? waterPrevious : '')
                                                 }
                                               }));
                                             }}
                                             className="w-32"
                                           />
                                          </td>
                                        </>
                                      )}
                                      {(meterTypeSelection.tableType === 'electricity' || !meterTypeSelection.tableType || meterTypeSelection.tableType === 'both') && (
                                        <>
                                          <td className="px-4 py-3 text-center">
                                            {editingPreviousForRoom === room.id ? (
                                              <Input
                                                type="number"
                                                step="0.01"
                                                value={bulkReadings[room.id]?.electricity_previous ?? electricityPrevious ?? '0'}
                                                onChange={(e) => {
                                                  setBulkReadings(prev => ({
                                                    ...prev,
                                                    [room.id]: {
                                                      ...prev[room.id],
                                                      electricity_previous: e.target.value
                                                    }
                                                  }));
                                                }}
                                                className="w-24 mx-auto"
                                              />
                                            ) : (
                                              <span className="font-medium text-slate-700">{bulkReadings[room.id]?.electricity_previous || electricityPrevious || '0'}</span>
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
                                                setBulkReadings(prev => ({
                                                  ...prev,
                                                  [room.id]: {
                                                    ...prev[room.id],
                                                    electricity_current: newValue,
                                                    electricity_previous: prev[room.id]?.electricity_previous ?? (hasExistingReading ? electricityPrevious : '')
                                                  }
                                                }));
                                              }}
                                              className="w-32"
                                            />
                                          </td>
                                        </>
                                      )}
                                      <td className="px-4 py-3 text-center">
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => setEditingPreviousForRoom(editingPreviousForRoom === room.id ? null : room.id)}
                                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                        >
                                          {editingPreviousForRoom === room.id ? (
                                            <Check className="w-4 h-4" />
                                          ) : (
                                            <Pencil className="w-4 h-4" />
                                          )}
                                        </Button>
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

          {/* ✅ Load More Indicator */}
          {displayLimit < roomsDataForDisplay.length && (
            <div ref={loadMoreRef} className="py-8 text-center">
              <div className="inline-flex items-center gap-2 text-slate-600">
                <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>กำลังโหลดเพิ่ม...</span>
              </div>
            </div>
          )}

          {displayLimit >= roomsDataForDisplay.length && roomsDataForDisplay.length > 20 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-slate-600">
                  แสดงครบทั้งหมด {roomsDataForDisplay.length} ห้อง
                </p>
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
      <MeterHistoryDialog 
        showDetailDialog={showDetailDialog}
        setShowDetailDialog={setShowDetailDialog}
        selectedReading={selectedReading}
        editingReading={editingReading}
        setEditingReading={setEditingReading}
        canEditHistory={canEditHistory}
        userRole={userRole}
        canDelete={canDelete}
        handleDeleteReading={handleDeleteReading}
        updateMutation={updateMutation}
        deleteMutation={deleteMutation}
      />

      {/* Fixed Save Button for Table View */}
      {viewMode === 'table' && Object.keys(bulkReadings).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 right-6 z-40"
        >
          <Button
            onClick={handleBulkSave}
            disabled={bulkCreateMutation.isPending || !canAdd}
            size="lg"
            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-shadow"
          >
            {bulkCreateMutation.isPending ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />กำลังบันทึก...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" />บันทึกทั้งหมด ({Object.keys(bulkReadings).length})</>
            )}
          </Button>
        </motion.div>
      )}

      <ScrollToTopButton />

      {/* Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-blue-600" />
              ตรวจสอบข้อมูลก่อนนำเข้า ({previewData.length} รายการ)
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">ห้อง</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-700">ผู้เช่า</th>
                    <th className="px-3 py-2 text-center font-semibold text-blue-700">น้ำก่อน</th>
                    <th className="px-3 py-2 text-center font-semibold text-blue-700">น้ำปัจจุบัน</th>
                    <th className="px-3 py-2 text-center font-semibold text-blue-700">ใช้</th>
                    <th className="px-3 py-2 text-center font-semibold text-yellow-700">ไฟก่อน</th>
                    <th className="px-3 py-2 text-center font-semibold text-yellow-700">ไฟปัจจุบัน</th>
                    <th className="px-3 py-2 text-center font-semibold text-yellow-700">ใช้</th>
                    <th className="px-3 py-2 text-center font-semibold text-slate-700">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {previewData.map((item, idx) => (
                    <tr key={idx} className={item.status === 'error' ? 'bg-red-50' : 'hover:bg-slate-50'}>
                      <td className="px-3 py-2 font-medium text-slate-800">{item.roomNumber}</td>
                      <td className="px-3 py-2 text-slate-600">{item.tenantName}</td>
                      <td className="px-3 py-2 text-center text-slate-600">{item.waterPrevious.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center font-bold text-blue-600">{item.waterCurrent.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge className="bg-blue-100 text-blue-700">{item.waterUnits.toFixed(1)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center text-slate-600">{item.electricityPrevious.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center font-bold text-yellow-600">{item.electricityCurrent.toFixed(1)}</td>
                      <td className="px-3 py-2 text-center">
                        <Badge className="bg-yellow-100 text-yellow-700">{item.electricityUnits.toFixed(1)}</Badge>
                      </td>
                      <td className="px-3 py-2 text-center">
                        {item.status === 'ready' ? (
                          <Badge className="bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            พร้อม
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-700">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            ผิดพลาด
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="border-t pt-4 flex justify-between items-center">
            <div className="text-sm text-slate-600">
              พร้อมนำเข้า: <span className="font-bold text-green-600">{previewData.filter(d => d.status === 'ready').length}</span> รายการ
              {previewData.filter(d => d.status === 'error').length > 0 && (
                <span className="ml-3">
                  ข้อผิดพลาด: <span className="font-bold text-red-600">{previewData.filter(d => d.status === 'error').length}</span>
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
                ยกเลิก
              </Button>
              <Button 
                onClick={handleConfirmImport}
                className="bg-gradient-to-r from-green-600 to-emerald-600"
                disabled={previewData.filter(d => d.status === 'ready').length === 0 || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังนำเข้า...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    ยืนยันนำเข้า ({previewData.filter(d => d.status === 'ready').length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}