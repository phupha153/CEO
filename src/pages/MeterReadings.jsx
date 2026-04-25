import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Droplets, Zap, Calendar, Building2, Save, History, Check, Trash2, Search, X, AlertTriangle, List, Grid, Gauge, Download, Upload, Pencil, Sparkles, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { motion } from "framer-motion";
import { toast } from "sonner";

import PageHeader from "../components/shared/PageHeader";
import ExcelUploader from "../components/shared/ExcelUploader";
import ScrollToTopButton from "../components/shared/ScrollToTopButton";
import MeterHistoryDialog from "../components/meter/MeterHistoryDialog";
import MeterRoomCards from "../components/meter/MeterRoomCards";
import MeterLoadingSkeleton from "../components/meter/MeterLoadingSkeleton";
import AIAnalysisResult from "../components/meter/AIAnalysisResult";
import MeterImportPreviewDialog from "../components/meter/MeterImportPreviewDialog";
import MeterStatCards from "../components/meter/MeterStatCards";
import MeterTableView from "../components/meter/MeterTableView";
import { useMeterExport } from "../hooks/useMeterExport";
import * as XLSX from "xlsx";

export default function MeterReadings() {
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedReading, setSelectedReading] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editingReading, setEditingReading] = useState(null);
  const [viewMode, setViewMode] = useState('card');
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [bulkReadings, setBulkReadings] = useState({});
  const [cardReadings, setCardReadings] = useState({});
  const [isMobile, setIsMobile] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [bulkReadingDate, setBulkReadingDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedReadingVersion, setSelectedReadingVersion] = useState('new');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState(null);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const nowUTC = new Date();
    const thaiOffset = 7 * 60;
    const nowThailand = new Date(nowUTC.getTime() + thaiOffset * 60 * 1000);
    return `${nowThailand.getUTCFullYear()}-${String(nowThailand.getUTCMonth() + 1).padStart(2, '0')}`;
  });
  const [editingPreviousForRoom, setEditingPreviousForRoom] = useState(null);
  const [showAddMoreFormForRoom, setShowAddMoreFormForRoom] = useState(null);
  const [meterTypeSelection, setMeterTypeSelection] = useState({});
  const [previewData, setPreviewData] = useState([]);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [formData, setFormData] = useState({
    room_id: '',
    reading_date: new Date().toISOString().split('T')[0],
    water_current: '',
    electricity_current: '',
    notes: '',
    water_previous: 0,
    electricity_previous: 0,
  });

  const [displayLimit, setDisplayLimit] = useState(20);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const loadMoreRef = useRef(null);

  const queryClient = useQueryClient();
  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setDisplayLimit(20);
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

  const retryConfig = { retry: 0, retryDelay: 0 };

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

  const { data: rawMeterReadings = [], isLoading: readingsLoading } = useQuery({
    queryKey: ['meterReadings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      let allData = [];
      let skip = 0;
      const limit = 1000;
      let hasMore = true;
      while (hasMore) {
        const batch = await base44.entities.MeterReading.filter({ branch_id: selectedBranchId }, '-reading_date', limit, skip);
        allData = [...allData, ...batch];
        skip += limit;
        if (batch.length < limit) hasMore = false;
        if (skip >= 1000000) hasMore = false;
      }
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

  const meterReadings = useMemo(() => {
    if (!rooms.length || !rawMeterReadings.length) return rawMeterReadings;
    const validRoomIds = new Set(rooms.map(r => r.id));
    return rawMeterReadings.filter(reading => validRoomIds.has(reading.room_id));
  }, [rawMeterReadings, rooms]);

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

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      let allData = [];
      let skip = 0;
      const limit = 1000;
      let hasMore = true;
      while (hasMore) {
        const batch = await base44.entities.Tenant.filter({ branch_id: selectedBranchId }, '-created_date', limit, skip);
        allData = [...allData, ...batch];
        skip += limit;
        if (batch.length < limit) hasMore = false;
        if (skip >= 1000000) hasMore = false;
      }
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
      if (userRole === 'developer') return allConfigs;
      const accessibleBranchIds = currentUser?.accessible_branches || [];
      return allConfigs.filter(c => !c.branch_id || accessibleBranchIds.includes(c.branch_id));
    },
    enabled: canView && !!currentUser,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previousData) => previousData,
  });

  const getConfigValue = (key, defaultValue) => {
    const config = configs.find(c => c.key === key && c.branch_id === selectedBranchId);
    return config ? parseFloat(config.value) : defaultValue;
  };

  const waterRate = getConfigValue('water_rate_per_unit', 20);
  const electricityRate = getConfigValue('electricity_rate_per_unit', 8);

  const allowMeterEditingConfig = configs.find(c => c.key === 'allow_meter_history_editing' && (c.branch_id === selectedBranchId || !c.branch_id));
  const canEditHistory = canEditHistoryPermission && (allowMeterEditingConfig?.value === 'true');

  // ✅ O(1) Lookup Maps
  const roomsMap = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms]);
  const tenantsMap = useMemo(() => new Map(tenants.map(t => [t.id, t])), [tenants]);
  const bookingsMap = useMemo(() => {
    const map = new Map();
    bookings.forEach(b => { if (b.status === 'active' && !map.has(b.room_id)) map.set(b.room_id, b); });
    return map;
  }, [bookings]);

  const meterReadingsMap = useMemo(() => {
    const map = new Map();
    meterReadings.forEach(r => { if (!map.has(r.room_id)) map.set(r.room_id, r); });
    return map;
  }, [meterReadings]);

  const recordedRoomsThisMonthMap = useMemo(() => {
    const map = new Map();
    const [year, month] = selectedMonth.split('-').map(Number);
    meterReadings.forEach(r => {
      try {
        const d = parseISO(r.reading_date);
        if (d.getMonth() === (month - 1) && d.getFullYear() === year) map.set(r.room_id, true);
      } catch {}
    });
    return map;
  }, [meterReadings, selectedMonth]);

  const getRoomInfo = useCallback((roomId) => roomsMap.get(roomId), [roomsMap]);
  const getActiveBooking = useCallback((roomId) => bookingsMap.get(roomId), [bookingsMap]);
  const getTenantInfo = useCallback((tenantId) => tenantsMap.get(tenantId), [tenantsMap]);
  const getLatestReading = useCallback((roomId) => meterReadingsMap.get(roomId), [meterReadingsMap]);
  const hasRecordedThisMonth = useCallback((roomId) => recordedRoomsThisMonthMap.has(roomId), [recordedRoomsThisMonthMap]);

  // ✅ Export hook with selectedMonth filter
  const { handleExport: handleDownloadTemplate } = useMeterExport({
    meterReadings, rooms, roomsMap, bookingsMap, tenantsMap, getLatestReading, selectedMonth
  });

  const { totalElectricityThisMonth, totalWaterThisMonth, monthReadingsCount } = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const monthReadings = meterReadings.filter(r => {
      try {
        const d = parseISO(r.reading_date);
        return d.getMonth() === (month - 1) && d.getFullYear() === year;
      } catch { return false; }
    });
    return {
      totalElectricityThisMonth: monthReadings.reduce((sum, r) => sum + (r.electricity_units || 0), 0),
      totalWaterThisMonth: monthReadings.reduce((sum, r) => sum + (r.water_units || 0), 0),
      monthReadingsCount: monthReadings.length
    };
  }, [meterReadings, selectedMonth]);

  // File select handler
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!canAdd) { toast.error('คุณไม่มีสิทธิ์บันทึกมิเตอร์'); return; }
    try {
      toast.info('กำลังอ่านไฟล์...');
      const isExcel = file.name.endsWith('.xlsx') || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      let text = '';
      if (isExcel) {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        text = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
      } else {
        text = await file.text();
      }
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) { toast.error('ไฟล์ไม่มีข้อมูล'); return; }
      const headers = lines[0].split(',').map(h => h.trim().replace(/^\ufeff/, ''));
      const parsedData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        headers.forEach((header, index) => { row[header] = values[index]?.trim() || ''; });
        parsedData.push(row);
      }
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
          roomNumber, tenantName: tenant?.full_name || '-',
          waterPrevious, waterCurrent: !isNaN(waterCurrent) ? waterCurrent : waterPrevious, waterUnits,
          electricityPrevious, electricityCurrent: !isNaN(electricityCurrent) ? electricityCurrent : electricityPrevious, electricityUnits,
          status: room ? 'ready' : 'error',
          errorMessage: room ? null : 'ไม่พบห้องในระบบ'
        });
      }
      setPreviewData(preview);
      setShowPreviewDialog(true);
      toast.success(`✅ อ่านไฟล์สำเร็จ ${preview.length} รายการ`);
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
    e.target.value = '';
  };

  const handleConfirmImport = async () => {
    const readyToImport = previewData.filter(d => d.status === 'ready');
    if (readyToImport.length === 0) { toast.error('ไม่มีข้อมูลที่สามารถนำเข้าได้'); return; }
    setIsImporting(true);
    toast.info(`กำลังนำเข้า ${readyToImport.length} รายการ...`);
    let successCount = 0, errorCount = 0;
    for (const item of readyToImport) {
      const room = rooms.find(r => r.room_number === item.roomNumber);
      if (!room) continue;
      try {
        await base44.entities.MeterReading.create({
          room_id: room.id, reading_date: new Date().toISOString().split('T')[0],
          water_previous: item.waterPrevious, water_current: item.waterCurrent,
          electricity_previous: item.electricityPrevious, electricity_current: item.electricityCurrent,
          water_units: item.waterUnits, electricity_units: item.electricityUnits,
          branch_id: selectedBranchId, notes: 'นำเข้าจาก Excel'
        });
        successCount++;
      } catch { errorCount++; }
    }
    queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
    setShowPreviewDialog(false);
    setPreviewData([]);
    if (successCount > 0) toast.success(`✅ นำเข้าสำเร็จ ${successCount} ห้อง`);
    if (errorCount > 0) toast.error(`❌ ไม่สามารถนำเข้าได้ ${errorCount} ห้อง`);
    setIsImporting(false);
  };

  const createSingleMutation = useMutation({
    mutationFn: async (data) => {
      if (!canAdd) throw new Error('คุณไม่มีสิทธิ์บันทึกมิเตอร์');
      const readingDate = new Date().toISOString().split('T')[0];
      const existingReading = meterReadings.find(r => r.room_id === data.room_id && r.reading_date === readingDate);
      if (existingReading) {
        const waterPrevious = data.water_previous != null && data.water_previous !== '' ? parseFloat(data.water_previous) : existingReading.water_previous;
        const electricityPrevious = data.electricity_previous != null && data.electricity_previous !== '' ? parseFloat(data.electricity_previous) : existingReading.electricity_previous;
        const waterCurrent = data.water_current != null && data.water_current !== '' ? parseFloat(data.water_current) : existingReading.water_current;
        const electricityCurrent = data.electricity_current != null && data.electricity_current !== '' ? parseFloat(data.electricity_current) : existingReading.electricity_current;
        return await base44.entities.MeterReading.update(existingReading.id, {
          water_previous: waterPrevious, water_current: waterCurrent,
          electricity_previous: electricityPrevious, electricity_current: electricityCurrent,
          water_units: waterCurrent - waterPrevious, electricity_units: electricityCurrent - electricityPrevious,
          notes: data.notes || existingReading.notes || ''
        });
      }
      let waterPrevious = data.water_previous != null && data.water_previous !== '' ? parseFloat(data.water_previous) : null;
      let electricityPrevious = data.electricity_previous != null && data.electricity_previous !== '' ? parseFloat(data.electricity_previous) : null;
      if (waterPrevious === null) { const l = meterReadings.find(r => r.room_id === data.room_id); waterPrevious = l?.water_current || 0; }
      if (electricityPrevious === null) { const l = meterReadings.find(r => r.room_id === data.room_id); electricityPrevious = l?.electricity_current || 0; }
      const waterCurrent = data.water_current != null && data.water_current !== '' ? parseFloat(data.water_current) : waterPrevious;
      const electricityCurrent = data.electricity_current != null && data.electricity_current !== '' ? parseFloat(data.electricity_current) : electricityPrevious;
      return await base44.entities.MeterReading.create({
        room_id: data.room_id, reading_date: readingDate,
        water_previous: waterPrevious, water_current: waterCurrent,
        electricity_previous: electricityPrevious, electricity_current: electricityCurrent,
        water_units: waterCurrent - waterPrevious, electricity_units: electricityCurrent - electricityPrevious,
        notes: data.notes || '', branch_id: selectedBranchId
      });
    },
    onSuccess: (newReading, variables) => {
      queryClient.setQueryData(['meterReadings', selectedBranchId], (old) => {
        if (!old) return [newReading];
        const existsIndex = old.findIndex(r => r.id === newReading.id);
        if (existsIndex >= 0) { const nc = [...old]; nc[existsIndex] = newReading; return nc; }
        return [newReading, ...old];
      });
      setCardReadings(prev => { const s = { ...prev }; delete s[variables.room_id]; return s; });
      toast.success('บันทึกมิเตอร์สำเร็จ');
      const room = rooms.find(r => r.id === newReading.room_id);
      base44.entities.ActivityLog.create({ branch_id: selectedBranchId, action_type: 'create', entity_type: 'MeterReading', entity_id: newReading.id, entity_name: `ห้อง ${room?.room_number || 'N/A'}`, user_email: currentUser?.email, user_name: currentUser?.full_name, description: `บันทึกมิเตอร์ห้อง ${room?.room_number || 'N/A'} - ไฟ: ${newReading.electricity_units} น้ำ: ${newReading.water_units}` }).catch(() => {});
    },
    onError: (error) => toast.error('เกิดข้อผิดพลาด: ' + error.message)
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!canAdd) throw new Error('คุณไม่มีสิทธิ์บันทึกมิเตอร์');
      const existingReading = meterReadings.find(r => r.room_id === data.room_id && r.reading_date === data.reading_date);
      if (existingReading) {
        const waterCurrent = data.water_current != null && data.water_current !== '' ? parseFloat(data.water_current) : existingReading.water_current;
        const electricityCurrent = data.electricity_current != null && data.electricity_current !== '' ? parseFloat(data.electricity_current) : existingReading.electricity_current;
        const waterPrevious = data.water_previous != null && data.water_previous !== '' ? parseFloat(data.water_previous) : existingReading.water_previous;
        const electricityPrevious = data.electricity_previous != null && data.electricity_previous !== '' ? parseFloat(data.electricity_previous) : existingReading.electricity_previous;
        return await base44.entities.MeterReading.update(existingReading.id, {
          water_previous: waterPrevious, water_current: waterCurrent,
          electricity_previous: electricityPrevious, electricity_current: electricityCurrent,
          water_units: waterCurrent - waterPrevious, electricity_units: electricityCurrent - electricityPrevious,
          notes: data.notes || existingReading.notes || ''
        });
      }
      const waterCurrent = parseFloat(data.water_current);
      const electricityCurrent = parseFloat(data.electricity_current);
      const waterPrevious = parseFloat(data.water_previous) || 0;
      const electricityPrevious = parseFloat(data.electricity_previous) || 0;
      return await base44.entities.MeterReading.create({
        room_id: data.room_id, reading_date: data.reading_date,
        water_previous: waterPrevious, water_current: waterCurrent,
        electricity_previous: electricityPrevious, electricity_current: electricityCurrent,
        water_units: waterCurrent - waterPrevious, electricity_units: electricityCurrent - electricityPrevious,
        notes: data.notes || '', branch_id: selectedBranchId
      });
    },
    onSuccess: async (newReading) => {
      queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
      queryClient.invalidateQueries(['payments', selectedBranchId]);
      const room = rooms.find(r => r.id === newReading.room_id);
      await base44.entities.ActivityLog.create({ branch_id: selectedBranchId, action_type: 'create', entity_type: 'MeterReading', entity_id: newReading.id, entity_name: `ห้อง ${room?.room_number || 'N/A'}`, user_email: currentUser?.email, user_name: currentUser?.full_name, description: `บันทึกมิเตอร์ห้อง ${room?.room_number || 'N/A'}` });
      setShowDialog(false); resetForm(); toast.success('บันทึกมิเตอร์สำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const bulkCreateMutation = useMutation({
    mutationFn: async (readingsData) => {
      if (!canAdd) throw new Error('คุณไม่มีสิทธิ์บันทึกมิเตอร์');
      const results = [];
      for (const data of readingsData) {
        const existing = meterReadings.find(r => r.room_id === data.room_id && r.reading_date === data.reading_date);
        if (existing) {
          const wp = data.water_previous != null && data.water_previous !== '' ? parseFloat(data.water_previous) : existing.water_previous;
          const ep = data.electricity_previous != null && data.electricity_previous !== '' ? parseFloat(data.electricity_previous) : existing.electricity_previous;
          const wc = data.water_current != null && data.water_current !== '' ? parseFloat(data.water_current) : existing.water_current;
          const ec = data.electricity_current != null && data.electricity_current !== '' ? parseFloat(data.electricity_current) : existing.electricity_current;
          results.push(await base44.entities.MeterReading.update(existing.id, { water_previous: wp, water_current: wc, electricity_previous: ep, electricity_current: ec, water_units: wc - wp, electricity_units: ec - ep, notes: data.notes || existing.notes || '' }));
        } else {
          let wp = data.water_previous != null && data.water_previous !== '' ? parseFloat(data.water_previous) : null;
          let ep = data.electricity_previous != null && data.electricity_previous !== '' ? parseFloat(data.electricity_previous) : null;
          if (wp === null) { const l = meterReadings.find(r => r.room_id === data.room_id); wp = l?.water_current || 0; }
          if (ep === null) { const l = meterReadings.find(r => r.room_id === data.room_id); ep = l?.electricity_current || 0; }
          const wc = data.water_current != null && data.water_current !== '' ? parseFloat(data.water_current) : wp;
          const ec = data.electricity_current != null && data.electricity_current !== '' ? parseFloat(data.electricity_current) : ep;
          results.push(await base44.entities.MeterReading.create({ room_id: data.room_id, reading_date: data.reading_date, notes: data.notes || '', water_previous: wp, water_current: wc, electricity_previous: ep, electricity_current: ec, water_units: wc - wp, electricity_units: ec - ep, branch_id: selectedBranchId }));
        }
      }
      return results;
    },
    onSuccess: (data) => { queryClient.invalidateQueries(['meterReadings', selectedBranchId]); setBulkReadings({}); setSelectedReadingVersion('new'); toast.success(`บันทึกมิเตอร์สำเร็จ ${data.length} ห้อง`); },
    onError: (error) => toast.error('เกิดข้อผิดพลาด: ' + error.message)
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (readingsData) => {
      if (!canEdit) throw new Error('คุณไม่มีสิทธิ์แก้ไขมิเตอร์');
      const results = [];
      for (const data of readingsData) {
        const existing = meterReadings.find(r => r.room_id === data.room_id && r.reading_date === bulkReadingDate);
        if (!existing) continue;
        const wp = data.water_previous !== undefined && data.water_previous !== '' ? parseFloat(data.water_previous) : existing.water_previous;
        const ep = data.electricity_previous !== undefined && data.electricity_previous !== '' ? parseFloat(data.electricity_previous) : existing.electricity_previous;
        const wc = data.water_current != null && data.water_current !== '' ? parseFloat(data.water_current) : existing.water_current;
        const ec = data.electricity_current != null && data.electricity_current !== '' ? parseFloat(data.electricity_current) : existing.electricity_current;
        results.push(await base44.entities.MeterReading.update(existing.id, { water_previous: wp, water_current: wc, electricity_previous: ep, electricity_current: ec, water_units: wc - wp, electricity_units: ec - ep }));
      }
      return results;
    },
    onSuccess: (data) => { queryClient.invalidateQueries(['meterReadings', selectedBranchId]); setBulkReadings({}); setSelectedReadingVersion('new'); toast.success(`อัปเดตมิเตอร์สำเร็จ ${data.length} ห้อง`); },
    onError: (error) => toast.error('เกิดข้อผิดพลาด: ' + error.message)
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (!canEdit) throw new Error('คุณไม่มีสิทธิ์แก้ไขมิเตอร์');
      const wc = parseFloat(data.water_current), ec = parseFloat(data.electricity_current);
      const wp = parseFloat(data.water_previous), ep = parseFloat(data.electricity_previous);
      return base44.entities.MeterReading.update(id, { ...data, water_units: wc - wp, electricity_units: ec - ep, branch_id: selectedBranchId });
    },
    onSuccess: async (updatedReading) => {
      queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
      const room = rooms.find(r => r.id === updatedReading.room_id);
      await base44.entities.ActivityLog.create({ branch_id: selectedBranchId, action_type: 'update', entity_type: 'MeterReading', entity_id: updatedReading.id, entity_name: `ห้อง ${room?.room_number || 'N/A'}`, user_email: currentUser?.email, user_name: currentUser?.full_name, description: `แก้ไขมิเตอร์ห้อง ${room?.room_number || 'N/A'}` });
      setShowDialog(false); resetForm(); toast.success('อัปเดตมิเตอร์สำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const deleteMutation = useMutation({
    mutationFn: async (reading) => {
      if (!canDelete) throw new Error('คุณไม่มีสิทธิ์ลบมิเตอร์');
      await base44.entities.MeterReading.delete(reading.id);
      return reading;
    },
    onSuccess: async (deletedReading) => {
      queryClient.invalidateQueries(['meterReadings', selectedBranchId]);
      const room = rooms.find(r => r.id === deletedReading.room_id);
      await base44.entities.ActivityLog.create({ branch_id: selectedBranchId, action_type: 'delete', entity_type: 'MeterReading', entity_id: deletedReading.id, entity_name: `ห้อง ${room?.room_number || 'N/A'}`, user_email: currentUser?.email, user_name: currentUser?.full_name, description: `ลบบันทึกมิเตอร์ห้อง ${room?.room_number || 'N/A'}` });
      toast.success('ลบมิเตอร์สำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const handleBulkSave = () => {
    const readingsData = Object.entries(bulkReadings)
      .filter(([, data]) => {
        const hasWater = data.water_current != null && data.water_current !== '';
        const hasElec = data.electricity_current != null && data.electricity_current !== '';
        return hasWater || hasElec;
      })
      .map(([roomId, data]) => ({
        room_id: roomId, reading_date: bulkReadingDate,
        water_current: data.water_current !== '' && data.water_current !== undefined ? data.water_current : null,
        electricity_current: data.electricity_current !== '' && data.electricity_current !== undefined ? data.electricity_current : null,
        water_previous: data.water_previous, electricity_previous: data.electricity_previous, notes: data.notes || ''
      }));
    if (readingsData.length === 0) { toast.error('กรุณากรอกข้อมูลมิเตอร์อย่างน้อย 1 ห้อง'); return; }
    const isEditing = selectedReadingVersion !== 'new';
    const confirmMsg = isEditing ? `คุณต้องการอัปเดตมิเตอร์ ${readingsData.length} ห้อง (${format(parseISO(bulkReadingDate), 'd MMM yyyy', { locale: th })}) ใช่หรือไม่?` : `คุณต้องการบันทึกมิเตอร์ ${readingsData.length} ห้องใช่หรือไม่?`;
    if (confirm(confirmMsg)) {
      if (isEditing) bulkUpdateMutation.mutate(readingsData);
      else bulkCreateMutation.mutate(readingsData);
    }
  };

  const handleSaveSingleReading = (roomId) => {
    const data = cardReadings[roomId];
    if (!data || (data.water_current == null || data.water_current === '') && (data.electricity_current == null || data.electricity_current === '')) {
      toast.error('กรุณากรอกข้อมูลมิเตอร์อย่างน้อย 1 อย่าง'); return;
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

  const handleSubmit = (e) => { e.preventDefault(); createMutation.mutate(formData); };

  const resetForm = () => {
    setEditingRoom(null);
    setFormData({ room_id: '', reading_date: new Date().toISOString().split('T')[0], water_current: '', electricity_current: '', notes: '', water_previous: 0, electricity_previous: 0 });
  };

  const handleAIAnalysis = async () => {
    setIsAnalyzing(true); setAiAnalysisResult(null);
    toast.info('🤖 กำลังวิเคราะห์ข้อมูลมิเตอร์ด้วย AI...');
    try {
      const roomDataForAI = rooms.map(room => {
        const roomReadings = meterReadings.filter(r => r.room_id === room.id).sort((a, b) => new Date(b.reading_date) - new Date(a.reading_date)).slice(0, 5);
        const latestReading = roomReadings[0], previousReading = roomReadings[1];
        return { room_number: room.room_number, floor: room.floor, latest_water_units: latestReading?.water_units || 0, latest_electricity_units: latestReading?.electricity_units || 0, previous_water_units: previousReading?.water_units || null, previous_electricity_units: previousReading?.electricity_units || null, reading_date: latestReading?.reading_date || null, readings_history: roomReadings.map(r => ({ date: r.reading_date, water_units: r.water_units, electricity_units: r.electricity_units })) };
      }).filter(r => r.reading_date !== null);
      if (roomDataForAI.length === 0) { setAiAnalysisResult({ status: 'no_data', message: 'ยังไม่มีข้อมูลมิเตอร์' }); toast.info('ยังไม่มีข้อมูลมิเตอร์'); setIsAnalyzing(false); return; }
      const avgWater = roomDataForAI.reduce((sum, r) => sum + r.latest_water_units, 0) / roomDataForAI.length;
      const avgElectricity = roomDataForAI.reduce((sum, r) => sum + r.latest_electricity_units, 0) / roomDataForAI.length;
      const prompt = `วิเคราะห์ข้อมูลมิเตอร์หอพัก ค่าเฉลี่ยน้ำ:${avgWater.toFixed(1)} ไฟ:${avgElectricity.toFixed(1)} ห้อง ${roomDataForAI.length} ห้อง: ${JSON.stringify(roomDataForAI)} รายงานห้องผิดปกติ(ไฟ>200,น้ำ>10,spike>50%) ตอบ JSON: {summary,total_rooms_analyzed,abnormal_rooms:[{room_number,issue_type,severity,description,recommendation,current_usage:{water,electricity},comparison}],normal_message,statistics:{avg_water_usage,avg_electricity_usage,highest_water_room,highest_electricity_room}}`;
      const response = await base44.integrations.Core.InvokeLLM({ prompt });
      setAiAnalysisResult(response); toast.success('🤖 วิเคราะห์ข้อมูลสำเร็จ!');
    } catch (error) {
      toast.error('การวิเคราะห์ด้วย AI ล้มเหลว');
      setAiAnalysisResult({ status: 'error', message: 'เกิดข้อผิดพลาดในการวิเคราะห์ข้อมูล' });
    } finally { setIsAnalyzing(false); }
  };

  const alertsData = useMemo(() => {
    const alerts = [];
    rooms.forEach(room => {
      const latest = getLatestReading(room.id);
      if (!latest) return;
      const waterUnits = latest.water_units || 0, electricityUnits = latest.electricity_units || 0;
      const booking = getActiveBooking(room.id), tenant = booking ? getTenantInfo(booking.tenant_id) : null;
      if (waterUnits < 3 && waterUnits > 0) alerts.push({ room_number: room.room_number, tenant_name: tenant?.full_name || '-', type: 'water_low', severity: 'medium', message: `น้ำต่ำผิดปกติ: ${waterUnits.toFixed(1)} หน่วย`, water_units: waterUnits, electricity_units: electricityUnits });
      if (electricityUnits < 3 && electricityUnits > 0) alerts.push({ room_number: room.room_number, tenant_name: tenant?.full_name || '-', type: 'electricity_low', severity: 'medium', message: `ไฟต่ำผิดปกติ: ${electricityUnits.toFixed(1)} หน่วย`, water_units: waterUnits, electricity_units: electricityUnits });
      if (electricityUnits > 200) alerts.push({ room_number: room.room_number, tenant_name: tenant?.full_name || '-', type: 'electricity_high', severity: electricityUnits > 300 ? 'high' : 'medium', message: `ไฟสูงผิดปกติ: ${electricityUnits.toFixed(1)} หน่วย`, water_units: waterUnits, electricity_units: electricityUnits });
    });
    return alerts.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity]));
  }, [rooms, meterReadings, bookings, tenants, getLatestReading, getActiveBooking, getTenantInfo]);

  const roomsDataForDisplay = useMemo(() => {
    let result = rooms;
    if (selectedFloor !== 'all') result = result.filter(room => room.floor?.toString() === selectedFloor);
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(room => { const booking = getActiveBooking(room.id); const tenant = booking ? getTenantInfo(booking.tenant_id) : null; return room.room_number?.toLowerCase().includes(query) || (tenant?.full_name?.toLowerCase().includes(query)); });
    }
    return result.sort((a, b) => { const fa = a.floor || 1, fb = b.floor || 1; if (fa !== fb) return fa - fb; return (parseFloat(a.room_number.replace(/\D/g, '')) || 0) - (parseFloat(b.room_number.replace(/\D/g, '')) || 0); });
  }, [rooms, selectedFloor, debouncedSearch, bookings, tenants, getActiveBooking, getTenantInfo]);

  const displayedRooms = useMemo(() => roomsDataForDisplay.slice(0, displayLimit), [roomsDataForDisplay, displayLimit]);

  const displayRoomsByFloor = useMemo(() => {
    const grouped = displayedRooms.reduce((acc, room) => { const floor = room.floor || 1; if (!acc[floor]) acc[floor] = []; acc[floor].push(room); return acc; }, {});
    Object.keys(grouped).forEach(floor => { grouped[floor].sort((a, b) => (parseFloat(a.room_number.replace(/\D/g, '')) || 0) - (parseFloat(b.room_number.replace(/\D/g, '')) || 0)); });
    return grouped;
  }, [displayedRooms]);

  const displayFloors = Object.keys(displayRoomsByFloor).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

  const allOccupiedRooms = rooms;
  const allRoomsByFloorForDropdown = allOccupiedRooms.reduce((acc, room) => { const floor = room.floor; if (!acc[floor]) acc[floor] = []; acc[floor].push(room); return acc; }, {});
  const sortedFloorsForDropdown = Object.keys(allRoomsByFloorForDropdown).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

  useEffect(() => { setDisplayLimit(20); }, [selectedFloor, debouncedSearch]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting && displayLimit < roomsDataForDisplay.length) setDisplayLimit(prev => Math.min(prev + 20, roomsDataForDisplay.length)); }, { threshold: 0.1 });
    if (loadMoreRef.current) observer.observe(loadMoreRef.current);
    return () => { if (loadMoreRef.current) observer.unobserve(loadMoreRef.current); };
  }, [displayLimit, roomsDataForDisplay.length]);

  const readingsByRoomForSummary = allOccupiedRooms.reduce((acc, room) => {
    const roomReadings = meterReadings.filter(r => r.room_id === room.id);
    if (roomReadings.length > 0) acc[room.id] = { room, readings: roomReadings, latest: roomReadings[0] };
    return acc;
  }, {});

  const handleViewHistory = (room) => {
    const roomReadings = meterReadings.filter(r => r.room_id === room.id);
    const booking = getActiveBooking(room.id), tenant = booking ? getTenantInfo(booking.tenant_id) : null;
    setSelectedReading({ room, readings: roomReadings, tenant });
    setShowDetailDialog(true);
  };

  const handleDeleteReading = (reading, roomNumber) => {
    if (!canDelete) { toast.error('คุณไม่มีสิทธิ์ลบการบันทึกมิเตอร์'); return; }
    if (confirm(`คุณแน่ใจว่าต้องการลบการบันทึกมิเตอร์ของห้อง ${roomNumber} นี้หรือไม่?\n\n⚠️ คำเตือน: การลบจะส่งผลต่อการคำนวณค่ามิเตอร์ครั้งถัดไป`)) deleteMutation.mutate(reading);
  };

  const handleRoomCardClick = (room) => {
    if (!canAdd) { toast.error('คุณไม่มีสิทธิ์บันทึกมิเตอร์'); return; }
    const latest = getLatestReading(room.id);
    setEditingRoom(room);
    setFormData({ room_id: room.id, reading_date: new Date().toISOString().split('T')[0], water_current: '', electricity_current: '', notes: '', water_previous: latest ? latest.water_current : 0, electricity_previous: latest ? latest.electricity_current : 0 });
    setShowDialog(true);
  };

  if (!canView) return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
        <p className="text-slate-500 mt-2">โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
      </Card>
    </div>
  );

  if (!selectedBranchId) return (
    <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
      <Card className="p-8 text-center">
        <p className="text-xl font-semibold text-orange-600">กรุณาเลือกสาขา</p>
        <p className="text-slate-500 mt-2">โปรดเลือกสาขาที่คุณต้องการจัดการข้อมูลจากเมนูด้านบน</p>
      </Card>
    </div>
  );

  if (readingsLoading || roomsLoading) return <MeterLoadingSkeleton selectedBranchName={selectedBranchName} />;

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
                {userRole === 'developer' && (
                  <Button onClick={() => handleDownloadTemplate(true)} variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50">
                    <Download className="w-4 h-4 mr-2" />ดาวน์โหลดข้อมูล
                  </Button>
                )}
                <Button onClick={() => handleDownloadTemplate(false)} variant="outline" className="border-green-600 text-green-600 hover:bg-green-50">
                  <Download className="w-4 h-4 mr-2" />ดาวน์โหลด
                </Button>
                {canAdd && (
                  <>
                    <input type="file" accept=".csv,.xlsx" onChange={handleFileSelect} className="hidden" id="csv-upload-meter" />
                    <Button variant="outline" onClick={() => document.getElementById('csv-upload-meter').click()} className="border-blue-600 text-blue-600 hover:bg-blue-50">
                      <Upload className="w-4 h-4 mr-2" />อัปโหลดไฟล์
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
          <MeterStatCards roomsCount={Object.keys(readingsByRoomForSummary).length} totalElectricity={totalElectricityThisMonth} totalWater={totalWaterThisMonth} monthCount={monthReadingsCount} />
          <AIAnalysisResult isAnalyzing={isAnalyzing} aiAnalysisResult={aiAnalysisResult} />

          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-600" />
                  <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="p-2 border rounded-md text-sm">
                    {(() => {
                      const months = []; const now = new Date();
                      for (let i = 0; i < 12; i++) {
                        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        months.push(<option key={value} value={value}>{format(d, 'MMM yyyy', { locale: th })}</option>);
                      }
                      return months;
                    })()}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-slate-600" />
                  <select value={selectedFloor} onChange={(e) => setSelectedFloor(e.target.value)} className="p-2 border rounded-md">
                    <option value="all">ทุกชั้น</option>
                    {sortedFloorsForDropdown.map(floor => <option key={floor} value={floor}>ชั้น {floor}</option>)}
                  </select>
                </div>
                <Button onClick={handleAIAnalysis} variant="outline" size="sm" className="border-purple-600 text-purple-600 hover:bg-purple-50" disabled={isAnalyzing}>
                  {isAnalyzing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  AI
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input placeholder="ค้นหาห้อง (หมายเลขห้อง, ชื่อผู้เช่า...)" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-10" />
                {searchQuery && (
                  <Button type="button" onClick={() => setSearchQuery('')} variant="ghost" size="icon" className="absolute right-1 top-1/2 transform -translate-y-1/2">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {roomsDataForDisplay.length === 0 && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg p-6 text-center">
              <p className="text-lg font-semibold text-slate-700">ไม่พบห้องพักที่ตรงกับเงื่อนไข</p>
              <p className="text-slate-500 mt-2">ลองเปลี่ยนตัวกรองชั้นหรือคำค้นหา</p>
            </Card>
          )}

          {viewMode === 'card' && (
            <MeterRoomCards displayFloors={displayFloors} displayRoomsByFloor={displayRoomsByFloor} isMobile={isMobile} cardReadings={cardReadings} setCardReadings={setCardReadings} canAdd={canAdd} canEdit={canEdit} createSingleMutation={createSingleMutation} getActiveBooking={getActiveBooking} getTenantInfo={getTenantInfo} getLatestReading={getLatestReading} hasRecordedThisMonth={hasRecordedThisMonth} handleViewHistory={handleViewHistory} setEditingReading={setEditingReading} showAddMoreFormForRoom={showAddMoreFormForRoom} setShowAddMoreFormForRoom={setShowAddMoreFormForRoom} setViewMode={setViewMode} handleSaveSingleReading={handleSaveSingleReading} />
          )}

          {viewMode === 'table' && (
            <MeterTableView
              displayFloors={displayFloors}
              displayRoomsByFloor={displayRoomsByFloor}
              meterReadings={meterReadings}
              selectedReadingVersion={selectedReadingVersion}
              setSelectedReadingVersion={setSelectedReadingVersion}
              bulkReadings={bulkReadings}
              setBulkReadings={setBulkReadings}
              bulkReadingDate={bulkReadingDate}
              setBulkReadingDate={setBulkReadingDate}
              meterTypeSelection={meterTypeSelection}
              setMeterTypeSelection={setMeterTypeSelection}
              editingPreviousForRoom={editingPreviousForRoom}
              setEditingPreviousForRoom={setEditingPreviousForRoom}
              getActiveBooking={getActiveBooking}
              getTenantInfo={getTenantInfo}
              getLatestReading={getLatestReading}
              hasRecordedThisMonth={hasRecordedThisMonth}
              setViewMode={setViewMode}
            />
          )}

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
                <p className="text-sm text-slate-600">แสดงครบทั้งหมด {roomsDataForDisplay.length} ห้อง</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>บันทึกมิเตอร์ - ห้อง {editingRoom?.room_number}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {(() => {
              const latest = getLatestReading(editingRoom?.id);
              if (!latest) return (
                <div className="space-y-4 border-b pb-4 mb-4">
                  <div className="bg-amber-50 p-3 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-800 font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4" />บันทึกครั้งแรก (ตั้งต้น)</p>
                    <p className="text-xs text-amber-700 mt-1">กรุณาระบุเลขมิเตอร์ตั้งต้น (ครั้งก่อน) เพื่อใช้คำนวณยอดหน่วยที่ใช้จริง</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label className="text-slate-600">มิเตอร์น้ำ (ครั้งก่อน)</Label><Input type="number" step="0.01" value={formData.water_previous} onChange={(e) => setFormData({ ...formData, water_previous: e.target.value })} placeholder="0" /></div>
                    <div><Label className="text-slate-600">มิเตอร์ไฟ (ครั้งก่อน)</Label><Input type="number" step="0.01" value={formData.electricity_previous} onChange={(e) => setFormData({ ...formData, electricity_previous: e.target.value })} placeholder="0" /></div>
                  </div>
                </div>
              );
              return (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs text-slate-600 mb-2">ค่ามิเตอร์ครั้งก่อน (อัตโนมัติ):</p>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2"><Droplets className="w-4 h-4 text-blue-600" /><span className="text-slate-600">น้ำ:</span><span className="font-bold text-blue-600">{latest.water_current}</span></div>
                    <div className="flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-600" /><span className="text-slate-600">ไฟ:</span><span className="font-bold text-yellow-600">{latest.electricity_current}</span></div>
                  </div>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>มิเตอร์น้ำ (ปัจจุบัน) *</Label>
                <Input type="number" step="0.01" value={formData.water_current} onChange={(e) => setFormData({ ...formData, water_current: e.target.value })} placeholder="เช่น 150.5" required />
                {formData.water_current && <p className="text-xs text-right mt-1 text-slate-500">ใช้ไป: {(parseFloat(formData.water_current) - parseFloat(formData.water_previous || 0)).toFixed(2)} หน่วย</p>}
              </div>
              <div>
                <Label>มิเตอร์ไฟ (ปัจจุบัน) *</Label>
                <Input type="number" step="0.01" value={formData.electricity_current} onChange={(e) => setFormData({ ...formData, electricity_current: e.target.value })} placeholder="เช่น 250.0" required />
                {formData.electricity_current && <p className="text-xs text-right mt-1 text-slate-500">ใช้ไป: {(parseFloat(formData.electricity_current) - parseFloat(formData.electricity_previous || 0)).toFixed(2)} หน่วย</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>ยกเลิก</Button>
              <Button type="submit" disabled={createMutation.isPending} className="bg-gradient-to-r from-green-600 to-emerald-600">
                {createMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <MeterHistoryDialog showDetailDialog={showDetailDialog} setShowDetailDialog={setShowDetailDialog} selectedReading={selectedReading} editingReading={editingReading} setEditingReading={setEditingReading} canEditHistory={canEditHistory} userRole={userRole} canDelete={canDelete} handleDeleteReading={handleDeleteReading} updateMutation={updateMutation} deleteMutation={deleteMutation} />

      {viewMode === 'table' && Object.keys(bulkReadings).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="fixed bottom-6 right-6 z-40">
          <Button onClick={handleBulkSave} disabled={bulkCreateMutation.isPending || !canAdd} size="lg" className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-shadow">
            {bulkCreateMutation.isPending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />กำลังบันทึก...</> : <><Save className="w-4 h-4 mr-2" />บันทึกทั้งหมด ({Object.keys(bulkReadings).length})</>}
          </Button>
        </motion.div>
      )}

      <ScrollToTopButton />

      <MeterImportPreviewDialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog} previewData={previewData} isImporting={isImporting} onConfirm={handleConfirmImport} />
    </div>
  );
}