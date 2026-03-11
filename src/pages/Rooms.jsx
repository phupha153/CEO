import React, { useState, useEffect, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Edit2, Trash2, Upload, Building2, User, Phone, Calendar as CalendarIcon, AlertTriangle, Eye, Clock, DollarSign, X, Check, Search, ChevronLeft, ChevronRight, Wind, DoorOpen, Sparkles, Loader2, FileText, ExternalLink, CheckSquare, Download, LogOut, Gauge, Star, Wrench, Droplet, Zap } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { differenceInDays, parseISO, format, isWithinInterval, subDays } from "date-fns";
import { th } from "date-fns/locale";
import ExcelUploader from "../components/shared/ExcelUploader";
import PageHeader from "../components/shared/PageHeader";
import ScrollToTopButton from "../components/shared/ScrollToTopButton";
import AISearchBox from "../components/shared/AISearchBox";
import AIResultCard from "../components/shared/AIResultCard";
import AIActionConfirmation from "../components/shared/AIActionConfirmation";
import ReservationDialog from "../components/rooms/ReservationDialog";
import { addMonths } from "date-fns";
import BulkRoomGenerator from "../components/rooms/BulkRoomGenerator";
import RoomImportDialog from "../components/rooms/RoomImportDialog";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { roomSchema, templateData, transformRoomData, templateFilename } from '../components/rooms/RoomImportConfig';

export default function RoomsPage() {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [editingRoom, setEditingRoom] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showBranchIdFixDialog, setShowBranchIdFixDialog] = useState(false);
  const [roomsWithoutBranch, setRoomsWithoutBranch] = useState([]);
  const [showBranchIdInfo, setShowBranchIdInfo] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showReservationDialog, setShowReservationDialog] = useState(false);
  const [reservingRoom, setReservingRoom] = useState(null);
  const [showBulkGenerator, setShowBulkGenerator] = useState(false);
  const [dialogBookingType, setDialogBookingType] = useState('daily');
  const [renewBooking, setRenewBooking] = useState(null);
  const [renewMonths, setRenewMonths] = useState(12);
  const [showRenewDialog, setShowRenewDialog] = useState(false);
  const [maintenanceHistoryPage, setMaintenanceHistoryPage] = useState(1);
  const [showConnectTenantDialog, setShowConnectTenantDialog] = useState(false);
  const [connectingRoom, setConnectingRoom] = useState(null);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [connectCheckInDate, setConnectCheckInDate] = useState('');
  const [connectCheckOutDate, setConnectCheckOutDate] = useState('');
  const [showMinCharges, setShowMinCharges] = useState(false);
  const [enableMinWater, setEnableMinWater] = useState(false);
  const [enableMinElectricity, setEnableMinElectricity] = useState(false);
  const [isFlatRateWater, setIsFlatRateWater] = useState(false);
  const [isFlatRateElectricity, setIsFlatRateElectricity] = useState(false);
  const [showEditBookingDialog, setShowEditBookingDialog] = useState(false);
  const [editingBooking, setEditingBooking] = useState(null);
  const [showBulkEditDialog, setShowBulkEditDialog] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    field: '',
    value: '',
    isFlatRate: false,
    flatRateAmount: ''
  });
  
  // Bulk Selection State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [bulkAIQuery, setBulkAIQuery] = useState('');
  const [bulkAIResult, setBulkAIResult] = useState(null);
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [longPressTarget, setLongPressTarget] = useState(null);

  // ⭐ Escape key handler เพื่อยกเลิก selection mode
  useEffect(() => {
    if (!isSelectionMode) return;

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setIsSelectionMode(false);
        setSelectedRooms([]);
        toast.info('ยกเลิกการเลือกแล้ว', { duration: 1500 });
      }
    };

    const handleClickOutside = (e) => {
      // ⭐ ถ้า dialog ใดๆ เปิดอยู่ ไม่ต้อง clear
      if (showBulkEditDialog || showDialog || showDetailDialog || showReservationDialog) return;
      
      // ถ้าคลิกที่ปุ่มหรือ checkbox ให้ข้ามไป
      if (e.target.closest('[data-selection-control]')) return;
      
      // ถ้าคลิกบน card ให้ข้ามไป
      if (e.target.closest('[data-room-item]')) return;
      
      // ⭐ ถ้าคลิกที่ input, textarea, button, dialog ให้ข้ามไป
      if (e.target.closest('input, textarea, button, select, [role="dialog"], [role="menu"]')) return;
      
      // ถ้าคลิกข้างนอก = ยกเลิก selection mode
      setIsSelectionMode(false);
      setSelectedRooms([]);
      toast.info('ยกเลิกการเลือกแล้ว', { duration: 1500 });
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSelectionMode, showBulkEditDialog, showDialog, showDetailDialog, showReservationDialog]);

  const [displayLimit, setDisplayLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('all');
  const [selectedRoomType, setSelectedRoomType] = useState('all');
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiAction, setAiAction] = useState(null);
  const [executingAction, setExecutingAction] = useState(false);
  const loadMoreRef = useRef(null);

  const [formData, setFormData] = useState({
    room_number: '',
    floor: '',
    room_type: 'monthly',
    price: '',
    status: 'available',
    size: '',
    amenities: [],
    description: '',
    image_urls: [],
    last_ac_cleaning_date: '',
    water_rate: '',
    electricity_rate: '',
    common_fee: '',
    is_flat_rate_water: false,
    flat_rate_water_amount: '',
    is_flat_rate_electricity: false,
    flat_rate_electricity_amount: '',
    min_water_units: '',
    min_water_charge: '',
    min_electricity_units: '',
    min_electricity_charge: '',
    other_monthly_fees: [],
    // Booking fields
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    guest_national_id: '',
    guest_address: '',
    check_in_date: '',
    check_out_date: '',
    contract_duration: '1 ปี',
    deposit_amount: '',
    security_deposit: '',
    advance_rent: '',
    common_fee_included: '',
    contract_deadline: '',
    deposit_payment_method: 'transfer',
    deposit_slip_url: '',
    notes: ''
  });

  const queryClient = useQueryClient();
  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setDisplayLimit(50);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    // Clear AI result if search query becomes empty
    if (!searchQuery) {
      setAiResult(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    setDisplayLimit(50);
  }, [selectedFloor, selectedStatuses]);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const userPermissions = currentUser?.permissions || [];
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  const canView = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('rooms_view');
  const canAdd = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('rooms_add');
  const canEdit = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('rooms_edit');
  const canDelete = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('rooms_delete');

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
  };

  const qOpts = { staleTime: 60000, gcTime: 300000 };
  const { data: rooms = [], isLoading: roomsLoading, isFetching: roomsFetching, isError: roomsError } = useQuery({
    queryKey: ['rooms', selectedBranchId, 'v2'],
    queryFn: () => selectedBranchId ? base44.entities.Room.filter({ branch_id: selectedBranchId }, '-room_number', 1000) : [],
    enabled: canView && !!selectedBranchId,
    ...qOpts
  });

  const { data: allRooms = [] } = useQuery({
    queryKey: ['allRooms', 'v2', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const ownedBranches = await base44.entities.Branch.filter({ owner_id: currentUser.email }, '', 100);
      const ownedBranchIds = ownedBranches.map(b => b.id);
      if (ownedBranchIds.length === 0) return [];
      const allRooms = [];
      for (const branchId of ownedBranchIds) {
        allRooms.push(...await base44.entities.Room.filter({ branch_id: branchId }, '-created_date', 1000));
      }
      return allRooms;
    },
    enabled: canView && (userRole === 'developer' || userRole === 'owner') && !!currentUser,
    ...qOpts
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: () => selectedBranchId ? base44.entities.Booking.filter({ branch_id: selectedBranchId, status: 'active' }, '-created_date', 1000) : [],
    enabled: canView && !!selectedBranchId,
    ...qOpts
  });

  const { data: temporaryBookings = [] } = useQuery({
    queryKey: ['temporaryBookings', selectedBranchId],
    queryFn: () => selectedBranchId ? base44.entities.TemporaryBooking.filter({ branch_id: selectedBranchId }, '-created_date', 1000) : [],
    enabled: canView && !!selectedBranchId,
    ...qOpts
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: () => selectedBranchId ? base44.entities.Tenant.filter({ branch_id: selectedBranchId, status: 'active' }, '-created_date', 1000) : [],
    enabled: canView && !!selectedBranchId,
    ...qOpts
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', selectedBranchId],
    queryFn: () => selectedBranchId ? base44.entities.Payment.filter({ branch_id: selectedBranchId }, '-due_date', 1000) : [],
    enabled: canView && !!selectedBranchId,
    ...qOpts
  });

  const { data: maintenanceRequests = [] } = useQuery({
    queryKey: ['maintenanceRequests', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.MaintenanceRequest.filter({ branch_id: selectedBranchId }, '-created_date', 1000);
    },
    enabled: false,
    staleTime: 60 * 60 * 1000,
    gcTime: 120 * 60 * 1000,
  });

  const { data: meterReadings = [] } = useQuery({
    queryKey: ['meterReadings', selectedBranchId],
    queryFn: () => base44.entities.MeterReading.filter({ branch_id: selectedBranchId }, '-reading_date', 5000),
    enabled: false, // ⚡ โหลดเฉพาะเมื่อเปิด Room Detail
    staleTime: 5 * 60 * 1000,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', selectedBranchId],
    queryFn: () => base44.entities.Contract.filter({ branch_id: selectedBranchId }, '-created_date', 5000),
    enabled: false, // ⚡ โหลดเฉพาะเมื่อเปิด Room Detail
    staleTime: 5 * 60 * 1000,
  });

  const { data: tenantRatings = [] } = useQuery({
    queryKey: ['tenantRatings', selectedBranchId],
    queryFn: () => base44.entities.TenantRating.filter({ branch_id: selectedBranchId }, '-rating_date', 5000),
    enabled: false, // ⚡ โหลดเฉพาะเมื่อเปิด Room Detail
    staleTime: 5 * 60 * 1000,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // 🔒 SECURITY FIX: ดึงเฉพาะ configs ของสาขานี้ + global
      const [branchConfigs, globalConfigs] = await Promise.all([
        base44.entities.Config.filter({ branch_id: selectedBranchId }, '', 1000),
        base44.entities.Config.filter({ branch_id: null }, '', 1000)
      ]);
      return [...branchConfigs, ...globalConfigs];
    },
    enabled: canView && !!currentUser && !!selectedBranchId,
    staleTime: 5 * 60 * 1000,
  });

  const getConfigValue = (key) => {
    if (selectedBranchId) {
      const branchConfig = configs.find(c => c.key === key && c.branch_id === selectedBranchId);
      if (branchConfig) return branchConfig.value;
    }
    const globalConfig = configs.find(c => c.key === key && !c.branch_id);
    return globalConfig ? globalConfig.value : null;
  };

  const branchCommonFee = getConfigValue('common_fee');
  const branchWaterRate = getConfigValue('water_rate');
  const branchElecRate = getConfigValue('electricity_rate');

  useEffect(() => {
    if (allRooms.length > 0) {
      const problemRooms = allRooms.filter(room => !room.branch_id);
      setRoomsWithoutBranch(problemRooms);

      if (problemRooms.length > 0) {
        toast.error(`พบห้องที่ยังไม่ได้ระบุสาขา ${problemRooms.length} ห้อง`, {
          duration: 5000,
          action: {
            label: 'แก้ไข',
            onClick: () => setShowBranchIdFixDialog(true)
          }
        });
      }
    }
  }, [allRooms, userRole]);

  const handleAISearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('กรุณาใส่คำค้นหา');
      return;
    }

    setAiSearching(true);
    setAiResult(null);
    setAiAction(null);

    try {
      const query = searchQuery.toLowerCase();
      
      // ⚡ Parse ค่าต่างๆ ก่อน (ใช้ซ้ำได้ทั้ง pre-filter และ bulk command)
      const floorMatch = query.match(/ชั้น\s*(\d+)/);
      const targetFloor = floorMatch ? parseInt(floorMatch[1]) : null;
      const roomNumberMatches = [...query.matchAll(/\b(\d{3,4})\b/g)];
      const targetRoomNumbers = roomNumberMatches.map(match => match[1]);
      
      // ⚡ PRE-FILTER: กรองห้องก่อนส่งไป AI (ลดข้อมูลจาก 10,000 → 100 ห้อง)
      let preFilteredRooms = [...rooms];
      
      // กรองตามสถานะ
      if (query.includes('ว่าง') || query.includes('available')) {
        preFilteredRooms = preFilteredRooms.filter(r => r.status === 'available');
      } else if (query.includes('มีผู้เช่า') || query.includes('occupied')) {
        preFilteredRooms = preFilteredRooms.filter(r => r.status === 'occupied');
      } else if (query.includes('จอง') || query.includes('reserved')) {
        preFilteredRooms = preFilteredRooms.filter(r => r.status === 'reserved');
      }
      
      // กรองตามชั้น
      if (targetFloor) {
        preFilteredRooms = preFilteredRooms.filter(r => r.floor === targetFloor);
      }
      
      // กรองตามประเภท
      if (query.includes('รายวัน')) {
        preFilteredRooms = preFilteredRooms.filter(r => r.room_type === 'daily');
      } else if (query.includes('รายเดือน')) {
        preFilteredRooms = preFilteredRooms.filter(r => r.room_type === 'monthly');
      }
      
      // จำกัด max 100 ห้อง (ลดเวลาประมวลผล)
      const roomsData = preFilteredRooms.slice(0, 100).map(r => ({
        id: r.id,
        room_number: r.room_number,
        floor: r.floor,
        status: r.status,
        price: r.price,
        size: r.size,
        room_type: r.room_type,
        water_rate: r.water_rate,
        electricity_rate: r.electricity_rate,
        common_fee: r.common_fee
      }));
      
      // --- START ENHANCED BULK DETECTION ---
      const isRoomTypeFilter = query.includes('ห้องรายวัน') || query.includes('ห้องรายเดือน');
      const isBulkCommand = query.includes('ทุกห้อง') || query.includes('ทั้งหมด') || query.includes('หลายห้อง') || targetRoomNumbers.length > 1 || isRoomTypeFilter;
      const hasException = query.includes('ยกเว้น') || query.includes('ไม่รวม') || query.includes('เว้น');
      
      let exceptRoomNumbers = [];
      if (hasException) {
        const exceptMatch = query.match(/(?:ยกเว้น|ไม่รวม|เว้น)\s*(?:ห้อง)?\s*([\d,\s]+)/);
        if (exceptMatch) {
          exceptRoomNumbers = exceptMatch[1].split(/[,\s]+/).filter(n => n.trim());
        }
      }
      
      let newValue = null;
      let newValueIsString = false;
      let fieldToUpdate = null;
      let fieldLabel = null;

      // Check for numeric values
      const valueMatch1 = query.match(/(?:เป็น|=|เท่ากับ)\s*(\d+(?:\.\d+)?)/);
      const valueMatch2 = query.match(/(\d+(?:\.\d+)?)\s*(?:บาท)?$/);
      const valueMatch3 = query.match(/(?:ค่าส่วนกลาง|ส่วนกลาง|ค่าไฟ|ค่าน้ำ|ราคา)\s*(\d+(?:\.\d+)?)/);
      if (valueMatch1) newValue = valueMatch1[1];
      else if (valueMatch3) newValue = valueMatch3[1];
      else if (valueMatch2) newValue = valueMatch2[1];

      // Check for field type based on keywords
      if (query.includes('ค่าส่วนกลาง') || query.includes('ส่วนกลาง')) {
        fieldToUpdate = 'common_fee';
        fieldLabel = 'ค่าส่วนกลาง';
      } else if (query.includes('ค่าไฟ') || query.includes('ไฟฟ้า')) {
        fieldToUpdate = 'electricity_rate';
        fieldLabel = 'ค่าไฟต่อหน่วย';
      } else if (query.includes('ค่าน้ำ')) {
        fieldToUpdate = 'water_rate';
        fieldLabel = 'ค่าน้ำต่อหน่วย';
      } else if (query.includes('ราคา') || query.includes('ค่าเช่า')) {
        fieldToUpdate = 'price';
        fieldLabel = 'ราคาห้อง';
      } else if (query.includes('สถานะ') || query.includes('ให้เป็น')) {
        fieldToUpdate = 'status';
        fieldLabel = 'สถานะ';
        if (query.includes('ว่าง') || query.includes('available')) {
            newValue = 'available';
            newValueIsString = true;
        } else if (query.includes('มีผู้เช่า') || query.includes('occupied')) {
            newValue = 'occupied';
            newValueIsString = true;
        } else if (query.includes('จอง') || query.includes('reserved')) {
            newValue = 'reserved';
            newValueIsString = true;
        }
      }
      
      // ตรวจสอบว่าต้องการแก้ไขห้องรายวันหรือรายเดือน
      const isFilterByRoomType = query.includes('รายวัน') || query.includes('รายเดือน');
      const targetRoomType = query.includes('รายวัน') ? 'daily' : query.includes('รายเดือน') ? 'monthly' : null;
      
      const isBulkUpdateCommand = (isBulkCommand || targetFloor || isFilterByRoomType) && fieldToUpdate && newValue !== null;
      
      if (isBulkUpdateCommand) {
        let roomsToUpdate = [...rooms];
        
        // กรองตามประเภทห้อง (รายวัน/รายเดือน)
        if (targetRoomType) {
          roomsToUpdate = roomsToUpdate.filter(r => r.room_type === targetRoomType);
        }
        
        if (targetFloor) {
          roomsToUpdate = roomsToUpdate.filter(r => r.floor === targetFloor);
        }
        
        if (targetRoomNumbers.length > 0 && !(query.includes('ทุกห้อง') || query.includes('ทั้งหมด') || isFilterByRoomType)) {
          const targetSet = new Set(targetRoomNumbers);
          roomsToUpdate = roomsToUpdate.filter(r => targetSet.has(r.room_number));
        }
        
        if (exceptRoomNumbers.length > 0) {
          const exceptSet = new Set(exceptRoomNumbers);
          roomsToUpdate = roomsToUpdate.filter(r => !exceptSet.has(r.room_number));
        }
        
        if (roomsToUpdate.length === 0) {
          toast.error('ไม่พบห้องที่ตรงตามเงื่อนไขสำหรับคำสั่งนี้');
          setAiSearching(false);
          return;
        }
        
        const bulkChanges = {};
        bulkChanges[fieldToUpdate] = newValueIsString ? newValue : parseFloat(newValue);
        
        const roomsList = roomsToUpdate.map(r => ({
          room_id: r.id,
          room_number: r.room_number,
          floor: r.floor,
          old_value: r[fieldToUpdate] !== undefined && r[fieldToUpdate] !== null ? r[fieldToUpdate] : 'ไม่ได้ตั้งค่า'
        }));
        
        const roomTypeText = targetRoomType ? (targetRoomType === 'daily' ? 'ห้องรายวัน' : 'ห้องรายเดือน') : '';
        const resultText = `พบ ${roomsToUpdate.length} ${roomTypeText}ที่ต้องแก้ไข ${exceptRoomNumbers.length > 0 ? ` (ยกเว้น ${exceptRoomNumbers.join(', ')})` : ''}\n📝 เปลี่ยน: ${fieldLabel} → ${newValue}${newValueIsString ? '' : ' บาท'}`;
        
        setAiResult({
          answer: resultText,
          action_type: 'bulk_update',
          rooms: roomsList
        });
        
        setAiAction({
          action_type: 'bulk_update',
          room_ids: roomsToUpdate.map(r => r.id),
          changes: bulkChanges,
          field_label: fieldLabel,
          new_value: newValue,
          rooms_list: roomsList,
          except_rooms: exceptRoomNumbers,
          target_floor: targetFloor,
          description: resultText
        });
        
        toast.info(`พบ ${roomsToUpdate.length} ห้องที่ต้องแก้ไข กรุณายืนยัน`);
        setAiSearching(false);
        return;
      }
      // --- END ENHANCED BULK DETECTION ---

      // Fallback to general AI model if not a parsable bulk command
      const roomNumberMatch = searchQuery.match(/\b(\d{3,4})\b/);
      const targetRoomNumber = roomNumberMatch ? roomNumberMatch[1] : null;
      const targetRoom = targetRoomNumber ? rooms.find(r => r.room_number === targetRoomNumber) : null;

      // ⚡ ข้าม enrichment ถ้ามีห้องเยอะ (เร็วขึ้น 10x)
      const shouldEnrich = preFilteredRooms.length <= 50;
      
      const roomsWithAC = shouldEnrich ? roomsData.map(r => {
        const fullRoom = rooms.find(room => room.id === r.id);
        const booking = getActiveBooking(r.id);
        const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
        const roomPayments = payments.filter(p => p.room_id === r.id);
        const latestPendingPayment = roomPayments
          .filter(p => p.status === 'pending' || p.status === 'overdue')
          .sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0))[0];
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        return {
          ...r,
          tenant_name: tenant?.full_name || null,
          has_pending_payment: !!latestPendingPayment,
          bill_sent: !!latestPendingPayment?.bill_sent_date,
          is_overdue: latestPendingPayment?.due_date ? (todayStr > latestPendingPayment.due_date) : false
        };
      }) : roomsData;

      // เพิ่มข้อมูลค่าส่วนกลางกลาง (สาขา) เข้าไปใน prompt
      const branchCommonFeeValue = branchCommonFee ? parseFloat(branchCommonFee) : 0;

      const promptText = `คุณเป็นผู้ช่วย AI ระบบจัดการหอพัก ตอบคำถามให้ตรงประเด็น กระชับ

📌 คำถาม: "${searchQuery}"
📅 วันที่: ${format(new Date(), 'yyyy-MM-dd')}
🏢 ห้องทั้งหมดในสาขา: ${rooms.length} ห้อง

${targetRoom ? `🎯 ห้อง ${targetRoom.room_number}: ${targetRoom.price} บาท, ${targetRoom.status}\n` : ''}

📋 ข้อมูล${preFilteredRooms.length < rooms.length ? ' (กรองแล้ว)' : ''} ${roomsWithAC.length} ห้อง:
${JSON.stringify(roomsWithAC, null, 2)}

⚠️ หมายเหตุ: ${preFilteredRooms.length < rooms.length ? `กรองเบื้องต้นจาก ${rooms.length} → ${roomsWithAC.length} ห้อง` : `แสดงข้อมูล ${roomsWithAC.length} ห้อง`}

🔍 **วิธีตอบ:**

1. **ถ้าเป็นคำถาม** (เช่น \"ห้องว่างมีกี่ห้อง\", \"ห้องไหนไม่เสียค่าส่วนกลาง\"):
   - ตอบ answer เป็นคำตอบที่ตรงคำถาม
   - action_type = \"view\"
   - rooms = รายการห้องที่เกี่ยวข้องพร้อม reason (ต้องมีข้อมูลให้ครบเพื่อให้คลิกดูได้)
   - **สำคัญ:** สำหรับคำถามเกี่ยวกับค่าส่วนกลาง ต้องระบุห้องทุกห้องที่ตรงเงื่อนไขใน rooms array

2. **ถ้าเป็นคำสั่งแก้ไขห้องเดียว** (เช่น \"แก้ห้อง 501 ราคา 3000\"):
   - action_type = \"update\"
   - room_id = ID ของห้อง
   - changes = {\"field\": {\"label\": \"ชื่อ\", \"old\": \"ค่าเดิม\", \"new\": \"ค่าใหม่\"}}
   
3. **ถ้าเป็นคำสั่งแก้ไขหลายห้อง** (เช่น \"แก้ห้อง 101, 102 เป็นว่าง\"):
   - action_type = \"bulk_update\"
   - room_ids = array ของ ID ห้อง
   - changes = object ของการเปลี่ยนแปลง, e.g. {\"status\": \"available\"}
   - rooms_list = array ของ object ที่มี room_id, room_number, old_value

⚠️ **สำคัญมาก:**
- ถ้าคำสั่งระบุเลขห้องหลายห้อง ให้ใช้ action_type = \"bulk_update\"
- เมื่อตอบคำถามให้แสดงรายการห้องทั้งหมดที่ตรงเงื่อนไข (ไม่ใช่แค่บอกจำนวน)
- ตอบภาษาไทย`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: promptText,
        response_json_schema: {
          type: "object",
          properties: {
            answer: { type: "string" },
            action_type: { type: "string", enum: ["view", "update", "create", "bulk_update"] },
            room_id: { type: "string" }, // For single update
            room_ids: { type: "array", items: { type: "string" } }, // For bulk update
            changes: { type: "object" },
            rooms_list: { type: "array", items: { type: "object" } }, // For bulk update display
            data: { type: "object" },
            rooms: { type: "array", items: { "type": "object" } }
          },
          required: ["answer", "action_type"]
        }
      });

      console.log('🤖 AI Response:', JSON.stringify(response, null, 2));

      setAiResult(response);
      
      if (response.action_type === 'update' || response.action_type === 'create' || response.action_type === 'bulk_update') {
        if (response.action_type === 'update' && !response.room_id) {
          toast.error('AI ไม่สามารถระบุห้องที่ต้องการแก้ไขได้');
          return;
        }
        if (response.action_type === 'bulk_update' && (!response.room_ids || response.room_ids.length === 0)) {
          toast.error('AI ไม่สามารถระบุห้องที่ต้องการแก้ไขได้');
          return;
        }

        setAiAction({ ...response, description: response.answer });
        toast.info('กรุณายืนยันการดำเนินการ');
      } else {
        toast.success('วิเคราะห์สำเร็จ');
      }
    } catch (error) {
      console.error('AI Search Error:', error);
      toast.error('เกิดข้อผิดพลาดในการวิเคราะห์');
      setAiResult({
        answer: 'ไม่สามารถวิเคราะห์คำถามได้ในขณะนี้ โปรดลองอีกครั้ง',
        rooms: []
      });
    } finally {
      setAiSearching(false);
    }
  };

  const needsACCleaning = (room) => {
    if (!room || !room.last_ac_cleaning_date) return false;
    try {
      const lastCleaningDate = parseISO(room.last_ac_cleaning_date);
      if (isNaN(lastCleaningDate.getTime())) return false;
      const daysSince = differenceInDays(new Date(), lastCleaningDate);
      return daysSince >= 365;
    } catch {
      return false;
    }
  };

  const getActiveBooking = (roomId) => {
    // ⭐ หาจากทั้ง TemporaryBooking และ Booking
    // 1. ลองหาจาก TemporaryBooking ก่อน
    const tempRoomBookings = temporaryBookings.filter(b => b.room_id === roomId);
    const tempActiveWithTenant = tempRoomBookings.filter(b => {
      if (b.status !== 'active' || !b.tenant_id) return false;
      const tenant = getTenantInfo(b.tenant_id);
      if (!tenant) return true; // ยังไม่โหลด
      return tenant.status === 'active';
    });
    
    if (tempActiveWithTenant.length > 0) {
      return tempActiveWithTenant.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    }
    
    // 2. ถ้าไม่มี TemporaryBooking ลองหาจาก Booking (เก่า)
    const oldRoomBookings = bookings.filter(b => b.room_id === roomId);
    const oldActiveWithTenant = oldRoomBookings.filter(b => {
      if (b.status !== 'active' || !b.tenant_id) return false;
      const tenant = getTenantInfo(b.tenant_id);
      if (!tenant) return true;
      return tenant.status === 'active';
    });
    
    if (oldActiveWithTenant.length > 0) {
      return oldActiveWithTenant.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    }
    
    return null;
  };

  const getTenantInfo = (tenantId) => {
    if (!tenantId) return null;
    return tenants.find(t => t.id === tenantId) || null;
  };

  const isContractExpiringSoon = (booking) => {
    if (!booking || !booking.check_out_date) return false;
    try {
      const checkOutDate = parseISO(booking.check_out_date);
      if (isNaN(checkOutDate.getTime())) return false;
      const today = new Date();
      const thirtyDaysFromNow = subDays(today, -30);
      return isWithinInterval(checkOutDate, { start: today, end: thirtyDaysFromNow });
    } catch {
      return false;
    }
  };

  const getDaysUntilExpiry = (booking) => {
    if (!booking || !booking.check_out_date) return null;
    try {
      const checkOutDate = parseISO(booking.check_out_date);
      if (isNaN(checkOutDate.getTime())) return null;
      const today = new Date();
      if (checkOutDate < today) return -differenceInDays(checkOutDate, today);
      return differenceInDays(checkOutDate, today);
    } catch {
      return null;
    }
  };

  const getPaymentStatus = (roomId) => {
    const roomPayments = payments.filter(p => p.room_id === roomId);
    const pendingPayments = roomPayments.filter(p =>
      (p.status === 'pending' || p.status === 'overdue') && p.due_date
    );
    if (pendingPayments.length === 0) return null;
    pendingPayments.sort((a, b) => {
      try {
        const dateA = parseISO(a.due_date);
        const dateB = parseISO(b.due_date);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
        return dateA.getTime() - dateB.getTime();
      } catch {
        return 0;
      }
    });
    const nextPayment = pendingPayments[0];
    try {
      const dueDate = parseISO(nextPayment.due_date);
      if (isNaN(dueDate.getTime())) return null;
      const today = new Date();
      const daysUntilDue = differenceInDays(dueDate, today);
      return {
        payment: nextPayment,
        daysUntilDue,
        isOverdue: daysUntilDue < 0,
        isNearDue: daysUntilDue >= 0 && daysUntilDue <= 3
      };
    } catch {
      return null;
    }
  };

  const getRecentPayments = (roomId, limit = 10) => {
    const roomPayments = payments
      .filter(p => p.room_id === roomId && p.status === 'paid' && p.payment_date)
      .sort((a, b) => {
        try {
          const dateA = parseISO(a.payment_date);
          const dateB = parseISO(b.payment_date);
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
          return dateB.getTime() - dateA.getTime();
        } catch {
          return 0;
        }
      });
    return roomPayments.slice(0, limit);
  };

  const getMeterHistory = (roomId, limit = 10) => {
    if (!meterReadings) return [];
    return meterReadings
      .filter(m => m.room_id === roomId)
      .sort((a, b) => {
        try {
          return new Date(b.reading_date) - new Date(a.reading_date);
        } catch {
          return 0;
        }
      })
      .slice(0, limit);
  };

  const getContractForBooking = (bookingId) => {
    if (!contracts || !bookingId) return null;
    return contracts.find(c => c.booking_id === bookingId && (c.status === 'active' || c.status === 'signed'));
  };

  const getLatestTenantRating = (tenantId) => {
    if (!tenantRatings || !tenantId) return null;
    const ratings = tenantRatings
      .filter(r => r.tenant_id === tenantId)
      .sort((a, b) => {
        try {
          return new Date(b.rating_date) - new Date(a.rating_date);
        } catch {
          return 0;
        }
      });
    return ratings.length > 0 ? ratings[0] : null;
  };

  const getMaintenanceHistory = (roomId) => {
    const roomMaintenance = maintenanceRequests
      .filter(m => m.room_id === roomId)
      .sort((a, b) => {
        try {
          const dateA = parseISO(a.created_date);
          const dateB = parseISO(b.created_date);
          if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
          return dateB.getTime() - dateA.getTime();
        } catch {
          return 0;
        }
      });
    return roomMaintenance;
  };


  const filteredRooms = useMemo(() => {
    let result = rooms;

    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(room => {
        // ค้นหาจากข้อมูลห้อง
        if (room.room_number?.toLowerCase().includes(query) ||
            room.description?.toLowerCase().includes(query) ||
            room.amenities?.some(amenity => amenity.toLowerCase().includes(query))) {
          return true;
        }
        
        // ค้นหาจากชื่อผู้เช่า
        const booking = getActiveBooking(room.id);
        if (booking) {
          const tenant = getTenantInfo(booking.tenant_id);
          if (tenant?.full_name?.toLowerCase().includes(query) ||
              tenant?.phone?.includes(query)) {
            return true;
          }
        }
        
        return false;
      });
    }

    if (selectedFloor !== 'all') {
      result = result.filter(room => room.floor?.toString() === selectedFloor);
    }

    if (selectedRoomType !== 'all') {
      result = result.filter(room => room.room_type === selectedRoomType);
    }

    if (selectedStatuses.length > 0) {
      result = result.filter(room => {
        if (selectedStatuses.includes(room.status)) return true;

        const booking = getActiveBooking(room.id);
        const paymentStatus = getPaymentStatus(room.id);
        const acNeedsCleaning = needsACCleaning(room);

        if (selectedStatuses.includes('expiring_soon') && booking && isContractExpiringSoon(booking)) return true;
        if (selectedStatuses.includes('near_payment') && paymentStatus?.isNearDue && !paymentStatus?.isOverdue) return true;
        if (selectedStatuses.includes('payment_overdue') && paymentStatus?.isOverdue) return true;
        if (selectedStatuses.includes('ac_cleaning') && acNeedsCleaning) return true;

        return false;
      });
    }

    return result.sort((a, b) => {
      if (a.floor !== b.floor) {
        return (a.floor || 0) - (b.floor || 0);
      }
      return a.room_number.localeCompare(b.room_number);
    });
  }, [rooms, debouncedSearch, selectedFloor, selectedStatuses, bookings, payments]);

  const availableFloors = useMemo(() => {
    const floors = [...new Set(rooms.map(r => r.floor))].sort((a, b) => a - b);
    return floors;
  }, [rooms]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayLimit < filteredRooms.length) {
          setDisplayLimit(prev => Math.min(prev + 50, filteredRooms.length));
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
  }, [displayLimit, filteredRooms.length]);

  const displayedRooms = useMemo(() => {
    return filteredRooms.slice(0, displayLimit);
  }, [filteredRooms, displayLimit]);

  const roomsByFloorInPage = useMemo(() => {
    const grouped = {};
    displayedRooms.forEach(room => {
      const floor = room.floor;
      if (!grouped[floor]) {
        grouped[floor] = [];
      }
      grouped[floor].push(room);
    });
    return grouped;
  }, [displayedRooms]);

  const sortedFloorsInPage = Object.keys(roomsByFloorInPage).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!canAdd) {
        throw new Error('คุณไม่มีสิทธิ์เพิ่มห้องพัก');
      }
      
      if (!selectedBranchId) {
        throw new Error('ไม่พบข้อมูลสาขา กรุณาเลือกสาขาใหม่');
      }
      
      const roomData = { ...data, branch_id: selectedBranchId };
      console.log('🏗️ Creating room with data:', roomData);
      console.log('📍 Selected Branch ID:', selectedBranchId);
      
      const newRoom = await base44.entities.Room.create(roomData);
      
      console.log('✅ Room created successfully!');
      console.log('📦 Returned room data:', newRoom);
      console.log('🔍 Room ID:', newRoom.id);
      console.log('🔍 Room number:', newRoom.room_number);
      console.log('🔍 Room branch_id:', newRoom.branch_id);
      console.log('🔍 Does branch_id match?', newRoom.branch_id === selectedBranchId);
      
      // บันทึก log
      try {
        await base44.entities.ActivityLog.create({
          branch_id: selectedBranchId,
          action_type: 'create',
          entity_type: 'Room',
          entity_id: newRoom.id,
          entity_name: `ห้อง ${newRoom.room_number}`,
          user_email: currentUser?.email,
          user_name: currentUser?.full_name,
          description: `สร้างห้องพัก ${newRoom.room_number} ชั้น ${newRoom.floor} ราคา ${newRoom.price?.toLocaleString()} บาท`
        });
      } catch (logError) {
        console.error('Failed to create activity log:', logError);
      }
      
      return newRoom;
    },
    onSuccess: async (newRoom) => {
      console.log('🔄 Room created successfully, updating cache...');
      
      // อัปเดตข้อมูลใน cache ทันที
      queryClient.setQueryData(['rooms', selectedBranchId, 'v2'], (oldData) => {
        console.log('📝 Cache before:', oldData?.length, 'rooms');
        const newData = oldData ? [...oldData, newRoom] : [newRoom];
        console.log('📝 Cache after:', newData.length, 'rooms');
        return newData;
      });
      
      // Invalidate และ refetch
      await queryClient.invalidateQueries(['rooms', selectedBranchId, 'v2']);
      await queryClient.invalidateQueries(['allRooms', 'v2']);
      await queryClient.refetchQueries({ queryKey: ['rooms', selectedBranchId, 'v2'], exact: true });
      
      console.log('✅ Cache updated and queries refetched');
      
      toast.success(`เพิ่มห้อง ${newRoom.room_number} สำเร็จ`);
      
      setTimeout(() => {
        setShowDialog(false);
        resetForm();
      }, 500);
    },
    onError: (error) => {
      console.error('Create room error:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการเพิ่มห้องพัก');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (!canEdit) {
        throw new Error('คุณไม่มีสิทธิ์แก้ไขห้องพัก');
      }
      return base44.entities.Room.update(id, data);
    },
    onSuccess: async (updatedRoom) => {
      queryClient.invalidateQueries(['rooms', selectedBranchId, 'v2']);
      queryClient.invalidateQueries(['allRooms', 'v2']);
      
      // บันทึก log
      base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'update',
        entity_type: 'Room',
        entity_id: updatedRoom.id,
        entity_name: `ห้อง ${updatedRoom.room_number}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `แก้ไขข้อมูลห้อง ${updatedRoom.room_number}`
      }).catch(() => {}); // Log ไม่จำเป็นต้องรอ
      
      setShowDialog(false);
      resetForm();
      toast.success('อัปเดตห้องสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการอัปเดตห้องพัก');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (room) => {
      if (!canDelete) {
        throw new Error('คุณไม่มีสิทธิ์ลบห้องพัก');
      }
      await base44.entities.Room.delete(room.id);
      return room;
    },
    onSuccess: async (deletedRoom) => {
      await queryClient.invalidateQueries(['rooms', selectedBranchId, 'v2']);
      await queryClient.refetchQueries(['rooms', selectedBranchId, 'v2']);
      await queryClient.invalidateQueries(['allRooms', 'v2']);
      
      // บันทึก log
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'delete',
        entity_type: 'Room',
        entity_id: deletedRoom.id,
        entity_name: `ห้อง ${deletedRoom.room_number}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `ลบห้องพัก ${deletedRoom.room_number} ชั้น ${deletedRoom.floor}`
      });
      
      toast.success('ลบห้องสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการลบห้องพัก');
    }
  });

  const updateRoomsBranchMutation = useMutation({
    mutationFn: async ({ roomIds, branchId }) => {
      const promises = roomIds.map(roomId =>
        base44.entities.Room.update(roomId, { branch_id: branchId })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['rooms']);
      queryClient.invalidateQueries(['allRooms']);
      setShowBranchIdFixDialog(false);
      setRoomsWithoutBranch([]);
      toast.success('อัปเดตสาขาสำหรับห้องสำเร็จ');
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ roomIds, updates }) => {
      // Use parallel requests with limit to avoid rate limits if too many
      const results = [];
      const chunkSize = 5;
      for (let i = 0; i < roomIds.length; i += chunkSize) {
        const chunk = roomIds.slice(i, i + chunkSize);
        const promises = chunk.map(id => base44.entities.Room.update(id, updates));
        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
        
        // ⚡ Delay to prevent rate limit
        if (i + chunkSize < roomIds.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['rooms', selectedBranchId, 'v2']);
      setSelectedRooms([]);
      setBulkAIResult(null);
      setBulkAIQuery('');
      toast.success('อัปเดตข้อมูลหลายห้องสำเร็จ');
    },
    onError: (error) => toast.error('เกิดข้อผิดพลาด: ' + error.message)
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (roomIds) => {
      const chunkSize = 5;
      for (let i = 0; i < roomIds.length; i += chunkSize) {
        const chunk = roomIds.slice(i, i + chunkSize);
        const promises = chunk.map(id => base44.entities.Room.delete(id));
        await Promise.all(promises);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['rooms', selectedBranchId, 'v2']);
      setSelectedRooms([]);
      setBulkAIResult(null);
      setBulkAIQuery('');
      toast.success('ลบห้องที่เลือกสำเร็จ');
    },
    onError: (error) => toast.error('เกิดข้อผิดพลาด: ' + error.message)
  });

  const moveOutMutation = useMutation({
    mutationFn: async (room) => {
      const booking = getActiveBooking(room.id);
      if (!booking) throw new Error('ไม่พบสัญญาเช่าที่ยังใช้งานอยู่สำหรับห้องนี้');
      const tenant = getTenantInfo(booking.tenant_id);
      if (!tenant) throw new Error('ไม่พบข้อมูลผู้เช่าสำหรับห้องนี้');

      // 1. Update Tenant status
      await base44.entities.Tenant.update(tenant.id, {
        status: 'moved_out',
        moved_out_date: new Date().toISOString().split('T')[0]
      });

      // 2. Update Booking status - เช็คว่ามาจาก entity ไหน
      const isTemporaryBooking = temporaryBookings.some(b => b.id === booking.id);
      if (isTemporaryBooking) {
        await base44.entities.TemporaryBooking.update(booking.id, { status: 'completed' });
      } else {
        await base44.entities.Booking.update(booking.id, { status: 'completed' });
      }
      
      // 3. Update Room status เป็น available
      await base44.entities.Room.update(room.id, { status: 'available' });

      return { room, tenant };
    },
    onSuccess: ({ room, tenant }) => {
      queryClient.invalidateQueries({ queryKey: ['tenants', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['bookings', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['temporaryBookings', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['rooms', selectedBranchId, 'v2'] });
      queryClient.invalidateQueries({ queryKey: ['rooms', selectedBranchId, 'secure'] });
      setShowDetailDialog(false);
      toast.success(`ย้ายออก ${tenant.full_name} จากห้อง ${room.room_number} สำเร็จ (ห้องถูกเปลี่ยนเป็นว่างแล้ว)`);
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการย้ายออก');
    }
  });

  const renewBookingMutation = useMutation({
    mutationFn: async ({ booking, months }) => {
      if (!booking || !booking.check_out_date) {
        throw new Error('ไม่พบข้อมูลสัญญาเช่าเดิม');
      }
      const newCheckOutDate = addMonths(parseISO(booking.check_out_date), months);
      
      const updatedBooking = await base44.entities.Booking.update(booking.id, {
        check_out_date: format(newCheckOutDate, 'yyyy-MM-dd')
      });
      
      // หา contract ที่เกี่ยวข้อง และอัปเดต end_date
      const relatedContracts = await base44.entities.Contract.filter({ booking_id: booking.id });
      if (relatedContracts && relatedContracts.length > 0) {
        const activeContract = relatedContracts.find(c => c.status === 'active' || c.status === 'signed');
        if (activeContract) {
          await base44.entities.Contract.update(activeContract.id, {
            end_date: format(newCheckOutDate, 'yyyy-MM-dd')
          });
        }
      }
      
      return updatedBooking;
    },
    onSuccess: async () => {
      // Invalidate และ refetch ข้อมูลทั้งหมดที่เกี่ยวข้อง
      await queryClient.invalidateQueries({ queryKey: ['bookings', selectedBranchId] });
      await queryClient.invalidateQueries({ queryKey: ['contracts'] });
      await queryClient.refetchQueries({ queryKey: ['bookings', selectedBranchId] });
      
      setShowRenewDialog(false);
      setRenewBooking(null);
      // ไม่ปิด showDetailDialog เพื่อให้ผู้ใช้เห็นข้อมูลที่อัปเดตแล้ว
      toast.success('ต่อสัญญาเช่าสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการต่อสัญญา');
    }
  });

  const connectTenantMutation = useMutation({
    mutationFn: async ({ roomId, tenantId, checkInDate, checkOutDate }) => {
      const room = rooms.find(r => r.id === roomId);
      const tenant = tenants.find(t => t.id === tenantId);
      
      if (!room || !tenant) throw new Error('ไม่พบข้อมูลห้องหรือผู้เช่า');
      
      // สร้าง Booking
      const newBooking = await base44.entities.Booking.create({
        branch_id: selectedBranchId,
        room_id: roomId,
        tenant_id: tenantId,
        booking_type: room.room_type,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        status: 'active'
      });
      
      // อัปเดตสถานะห้องเป็น occupied
      await base44.entities.Room.update(roomId, { status: 'occupied' });
      
      return { booking: newBooking, room, tenant };
    },
    onSuccess: async ({ booking, room, tenant }) => {
      await queryClient.invalidateQueries(['rooms', selectedBranchId]);
      await queryClient.invalidateQueries(['bookings', selectedBranchId]);
      
      // บันทึก log
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'create',
        entity_type: 'Booking',
        entity_id: booking.id,
        entity_name: `ห้อง ${room.room_number} - ${tenant.full_name}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `เชื่อมต่อผู้เช่า ${tenant.full_name} กับห้อง ${room.room_number}`
      });
      
      setShowConnectTenantDialog(false);
      setShowDetailDialog(false);
      setConnectingRoom(null);
      setSelectedTenantId('');
      setConnectCheckInDate('');
      setConnectCheckOutDate('');
      
      toast.success(`เชื่อมต่อ ${tenant.full_name} กับห้อง ${room.room_number} สำเร็จ`);
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data) => {
      const room = rooms.find(r => r.id === data.room_id);
      if (!room) throw new Error('ไม่พบห้องที่เลือก');

      const bookingData = {
        ...data,
        branch_id: selectedBranchId,
        booking_type: dialogBookingType,
        status: 'active',
        total_amount: 0
      };

      // ⭐ สร้าง TemporaryBooking แทน Booking
      const newBooking = await base44.entities.TemporaryBooking.create(bookingData);
      
      // อัปเดตสถานะห้อง
      if (dialogBookingType === 'monthly') {
        await base44.entities.Room.update(room.id, { status: 'occupied' });
      }
      
      return { booking: newBooking, room };
    },
    onSuccess: async ({ booking, room }) => {
      await queryClient.invalidateQueries(['rooms', selectedBranchId]);
      await queryClient.invalidateQueries(['bookings', selectedBranchId]);
      await queryClient.invalidateQueries(['temporaryBookings', selectedBranchId]);
      
      // บันทึก log
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'create',
        entity_type: 'TemporaryBooking',
        entity_id: booking.id,
        entity_name: `ห้อง ${room.room_number} - ${booking.guest_name || 'รายวัน'}`,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `จองห้อง ${room.room_number} (${dialogBookingType === 'daily' ? 'รายวัน' : 'รายเดือน'})`
      });
      
      setShowReservationDialog(false);
      setReservingRoom(null);
      toast.success('จองห้องสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ bookingId, data, isTemp }) => {
      if (!canEdit) {
        throw new Error('คุณไม่มีสิทธิ์แก้ไขการจอง');
      }
      
      if (isTemp) {
        return await base44.entities.TemporaryBooking.update(bookingId, data);
      } else {
        return await base44.entities.Booking.update(bookingId, data);
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries(['bookings', selectedBranchId]);
      await queryClient.invalidateQueries(['temporaryBookings', selectedBranchId]);
      setShowEditBookingDialog(false);
      setEditingBooking(null);
      toast.success('แก้ไขข้อมูลการจองสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const handleLongPressStart = (e, roomId) => {
    if (isSelectionMode) return;
    
    const timer = setTimeout(() => {
      setIsSelectionMode(true);
      setSelectedRooms([roomId]);
      toast.info('เข้าสู่โหมดเลือกหลายห้อง', { duration: 2000 });
    }, 500);
    setLongPressTimer(timer);
    setLongPressTarget(roomId);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setLongPressTarget(null);
  };

  const toggleRoomSelection = (roomId) => {
    setSelectedRooms(prev => 
      prev.includes(roomId) 
        ? prev.filter(id => id !== roomId) 
        : [...prev, roomId]
    );
  };

  const toggleSelectAllInPage = () => {
    const displayedRoomIds = displayedRooms.map(r => r.id);
    const allSelected = displayedRoomIds.every(id => selectedRooms.includes(id));
    
    if (allSelected) {
      setSelectedRooms(prev => prev.filter(id => !displayedRoomIds.includes(id)));
    } else {
      setSelectedRooms(prev => [...new Set([...prev, ...displayedRoomIds])]);
    }
  };

  const handleBulkAIRequest = async () => {
    if (!bulkAIQuery.trim()) return;
    
    setAiSearching(true);
    try {
      const selectedRoomsData = rooms.filter(r => selectedRooms.includes(r.id)).map(r => ({
        room_number: r.room_number,
        floor: r.floor,
        price: r.price,
        status: r.status
      })).slice(0, 10); // Send sample data

      const prompt = `
        User wants to perform bulk action on ${selectedRooms.length} selected rooms.
        User Query: "${bulkAIQuery}"
        Sample Selected Rooms: ${JSON.stringify(selectedRoomsData)}
        
        Determine if this is a DELETE action or UPDATE action.
        - If delete, set action="delete".
        - If update, set action="update" and provide "changes" object with fields to update (e.g. { price: 5000, status: "available" }).
        - Supported fields for update: price (number), status (string: available, occupied, reserved), floor (number), room_type (string: monthly, daily), water_rate, electricity_rate, common_fee.
        - If request is unclear, set action="none".
        
        Return JSON.
      `;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["update", "delete", "none"] },
            changes: { type: "object" },
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
      if (bulkAIResult.action === 'delete') {
        await bulkDeleteMutation.mutateAsync(selectedRooms);
      } else if (bulkAIResult.action === 'update') {
        await bulkUpdateMutation.mutateAsync({
          roomIds: selectedRooms,
          updates: bulkAIResult.changes
        });
      }
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const handleFixBranchIds = () => {
    if (roomsWithoutBranch.length === 0) {
      toast.info('ไม่มีห้องที่ต้องแก้ไข');
      return;
    }
    if (!selectedBranchId) {
      toast.error('กรุณาเลือกสาขาก่อนดำเนินการ');
      return;
    }
    const roomIds = roomsWithoutBranch.map(r => r.id);
    if (confirm(`คุณต้องการกำหนดสาขาปัจจุบันให้กับห้อง ${roomIds.length} ห้องใช่หรือไม่?`)) {
      updateRoomsBranchMutation.mutate({ roomIds, branchId: selectedBranchId });
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({
        ...prev,
        image_urls: [...prev.image_urls, file_url]
      }));
      toast.success('อัปโหลดรูปภาพสำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดรูปภาพไม่สำเร็จ');
    }
    setUploadingImage(false);
  };

  const handleSlipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, deposit_slip_url: file_url }));
      toast.success('อัปโหลดสลิปสำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดสลิปไม่สำเร็จ');
    }
    setUploadingImage(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // ป้องกัน double submit
    if (createMutation.isPending || updateMutation.isPending) {
      return;
    }
    
    const data = {
      ...formData,
      floor: parseInt(formData.floor),
      price: parseFloat(formData.price),
      size: formData.size ? parseFloat(formData.size) : undefined,
      last_ac_cleaning_date: formData.last_ac_cleaning_date || undefined,
      // ⭐ แก้ไข: ตรวจสอบว่ามีค่าหรือไม่ ถ้ามีค่า (รวมถึง 0) ให้ส่งค่านั้น ถ้าว่างเปล่าให้ส่ง null
      water_rate: formData.water_rate !== '' ? parseFloat(formData.water_rate) : null,
      electricity_rate: formData.electricity_rate !== '' ? parseFloat(formData.electricity_rate) : null,
      common_fee: formData.common_fee !== '' ? parseFloat(formData.common_fee) : null,
      is_flat_rate_water: formData.is_flat_rate_water || false,
      flat_rate_water_amount: formData.flat_rate_water_amount !== '' ? parseFloat(formData.flat_rate_water_amount) : null,
      is_flat_rate_electricity: formData.is_flat_rate_electricity || false,
      flat_rate_electricity_amount: formData.flat_rate_electricity_amount !== '' ? parseFloat(formData.flat_rate_electricity_amount) : null,
      min_water_units: formData.min_water_units !== '' ? parseFloat(formData.min_water_units) : null,
      min_water_charge: formData.min_water_charge !== '' ? parseFloat(formData.min_water_charge) : null,
      min_electricity_units: formData.min_electricity_units !== '' ? parseFloat(formData.min_electricity_units) : null,
      min_electricity_charge: formData.min_electricity_charge !== '' ? parseFloat(formData.min_electricity_charge) : null,
      other_monthly_fees: formData.other_monthly_fees || []
    };
    if (editingRoom) {
      updateMutation.mutate({ id: editingRoom.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (room) => {
    if (!canEdit) {
      toast.error('คุณไม่มีสิทธิ์แก้ไขห้องพัก');
      return;
    }
    setEditingRoom(room);
    setFormData({
      room_number: room.room_number || '',
      floor: room.floor?.toString() || '',
      room_type: room.room_type || 'monthly',
      price: room.price?.toString() || '',
      status: room.status || 'available',
      size: room.size?.toString() || '',
      amenities: room.amenities || [],
      description: room.description || '',
      image_urls: room.image_urls || [],
      last_ac_cleaning_date: room.last_ac_cleaning_date || '',
      water_rate: room.water_rate?.toString() || '',
      electricity_rate: room.electricity_rate?.toString() || '',
      common_fee: room.common_fee?.toString() || '',
      is_flat_rate_water: room.is_flat_rate_water || false,
      flat_rate_water_amount: room.flat_rate_water_amount?.toString() || '',
      is_flat_rate_electricity: room.is_flat_rate_electricity || false,
      flat_rate_electricity_amount: room.flat_rate_electricity_amount?.toString() || '',
      min_water_units: room.min_water_units?.toString() || '',
      min_water_charge: room.min_water_charge?.toString() || '',
      min_electricity_units: room.min_electricity_units?.toString() || '',
      min_electricity_charge: room.min_electricity_charge?.toString() || '',
      other_monthly_fees: room.other_monthly_fees || []
    });
    const hasMinWater = !!(room.min_water_units || room.min_water_charge);
    const hasMinElec = !!(room.min_electricity_units || room.min_electricity_charge);
    setShowMinCharges(hasMinWater || hasMinElec);
    setEnableMinWater(hasMinWater);
    setEnableMinElectricity(hasMinElec);
    setIsFlatRateWater(room.is_flat_rate_water || false);
    setIsFlatRateElectricity(room.is_flat_rate_electricity || false);
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingRoom(null);
    setFormData({
      room_number: '',
      floor: '',
      room_type: 'monthly',
      price: '',
      status: 'available',
      size: '',
      amenities: [],
      description: '',
      image_urls: [],
      last_ac_cleaning_date: '',
      water_rate: '',
      electricity_rate: '',
      common_fee: '',
      is_flat_rate_water: false,
      flat_rate_water_amount: '',
      is_flat_rate_electricity: false,
      flat_rate_electricity_amount: '',
      min_water_units: '',
      min_water_charge: '',
      min_electricity_units: '',
      min_electricity_charge: '',
      other_monthly_fees: []
    });
    setIsFlatRateWater(false);
    setIsFlatRateElectricity(false);
  };

  const handleRoomClick = (room) => {
    setSelectedRoom(room);
    setShowDetailDialog(true);
  };

  const handleReserve = (room) => {
    setReservingRoom(room);
    setDialogBookingType(room.room_type || 'daily');
    setFormData({
      room_number: '',
      floor: '',
      room_type: 'monthly',
      price: '',
      status: 'available',
      size: '',
      amenities: [],
      description: '',
      image_urls: [],
      last_ac_cleaning_date: '',
      water_rate: '',
      electricity_rate: '',
      common_fee: '',
      other_monthly_fees: [],
      room_id: room.id,
      guest_name: '',
      guest_phone: '',
      guest_email: '',
      guest_national_id: '',
      guest_address: '',
      check_in_date: new Date().toISOString().split('T')[0],
      check_out_date: '',
      contract_duration: '1 ปี',
      deposit_amount: '',
      security_deposit: room.price?.toString() || '',
      advance_rent: room.price?.toString() || '',
      common_fee_included: room.common_fee?.toString() || '',
      contract_deadline: '',
      deposit_payment_method: 'transfer',
      deposit_slip_url: '',
      notes: ''
    });
    setShowReservationDialog(true);
  };

  const handleEditBooking = (booking) => {
    setEditingBooking(booking);
    setFormData({
      ...formData,
      guest_name: booking.guest_name || '',
      guest_phone: booking.guest_phone || '',
      guest_email: booking.guest_email || '',
      guest_national_id: booking.guest_national_id || '',
      guest_address: booking.guest_address || '',
      check_in_date: booking.check_in_date || '',
      check_out_date: booking.check_out_date || '',
      notes: booking.notes || ''
    });
    setShowEditBookingDialog(true);
  };

  const getRoomColor = (status) => {
    switch(status) {
      case 'available':
        return 'from-green-500 to-emerald-600';
      case 'occupied':
        return 'from-blue-500 to-indigo-600';
      case 'reserved':
        return 'from-orange-500 to-amber-600';
      default:
        return 'from-slate-400 to-slate-500';
    }
  };

  const toggleStatus = (status) => {
    setSelectedStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
    setDisplayLimit(50);
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'available': return 'ว่าง';
      case 'occupied': return 'มีผู้เช่า';
      case 'reserved': return 'จอง';
      case 'expiring_soon': return 'ใกล้หมดสัญญา';
      case 'near_payment': return 'ใกล้ชำระ';
      case 'payment_overdue': return 'เกินกำหนด';
      case 'ac_cleaning': return 'แอร์ต้องล้าง';
      default: return status;
    }
  };







    const handleDownloadExistingRooms = () => {
    const headers = ["หมายเลขห้อง", "ชั้น", "ประเภทห้อง", "ราคา", "สถานะ", "ขนาด", "ค่าน้ำเหมา", "จำนวนค่าน้ำเหมา", "ค่าไฟเหมา", "จำนวนค่าไฟเหมา", "รายละเอียด", "วันที่ล้างแอร์ล่าสุด", "ค่าน้ำต่อหน่วย", "ค่าไฟต่อหน่วย", "ค่าส่วนกลาง"];
    const statusMap = {
      'available': 'ว่าง',
      'occupied': 'มีผู้เช่า',
      'reserved': 'จอง'
    };
    const roomTypeMap = {
      'monthly': 'รายเดือน',
      'daily': 'รายวัน'
    };
    const yesNoMap = { true: 'ใช่', false: 'ไม่ใช่' };
    const csvContent = [
        headers.join(','),
        ...rooms.map(r => [
            r.room_number,
            r.floor,
            roomTypeMap[r.room_type] || r.room_type,
            r.price,
            statusMap[r.status] || r.status,
            r.size || '',
            yesNoMap[r.is_flat_rate_water] || 'ไม่ใช่',
            r.flat_rate_water_amount || '',
            yesNoMap[r.is_flat_rate_electricity] || 'ไม่ใช่',
            r.flat_rate_electricity_amount || '',
            `"${r.description || ''}"`,
            r.last_ac_cleaning_date || '',
            r.water_rate || '',
            r.electricity_rate || '',
            r.common_fee || ''
        ].join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `rooms_data_${selectedBranchName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('ดาวน์โหลดข้อมูลห้องพักสำเร็จ');
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว!');
  };

  const handleConfirmAIAction = async () => {
    if (!aiAction) {
      console.log('⚠️ No AI action to confirm');
      return;
    }

    console.log('✅ Confirming AI action:', aiAction.action_type);
    setExecutingAction(true);
    
    try {
      // Bulk Update - แก้ไขหลายห้องพร้อมกัน
      if (aiAction.action_type === 'bulk_update' && aiAction.room_ids) {
        const roomIds = aiAction.room_ids;
        const changes = aiAction.changes;
        
        console.log('🔄 Bulk updating rooms:', roomIds.length, 'rooms with changes:', changes);
        
        // Update ทีละ chunk เพื่อไม่ให้ overload
        const chunkSize = 10;
        let updatedCount = 0;
        const updatedRooms = [];
        
        for (let i = 0; i < roomIds.length; i += chunkSize) {
          const chunk = roomIds.slice(i, i + chunkSize);
          const promises = chunk.map(id => base44.entities.Room.update(id, changes));
          await Promise.all(promises);
          updatedCount += chunk.length;
          
          // เก็บข้อมูลห้องที่อัปเดต
          chunk.forEach(id => {
            const room = rooms.find(r => r.id === id);
            if (room) updatedRooms.push(room.room_number);
          });
        }
        
        // Invalidate cache
        await queryClient.invalidateQueries(['rooms', selectedBranchId, 'v2']);
        await queryClient.refetchQueries(['rooms', selectedBranchId, 'v2']);
        
        // Log activity
        await base44.entities.ActivityLog.create({
          branch_id: selectedBranchId,
          action_type: 'update',
          entity_type: 'Room',
          entity_id: 'bulk',
          entity_name: `แก้ไข ${updatedCount} ห้อง`,
          user_email: currentUser?.email,
          user_name: currentUser?.full_name,
          description: `แก้ไข ${aiAction.field_label} เป็น ${aiAction.new_value} บาท ให้ห้อง: ${updatedRooms.join(', ')}${aiAction.except_rooms?.length > 0 ? ` (ยกเว้น ${aiAction.except_rooms.join(', ')})` : ''}`
        });
        
        toast.success(`✅ แก้ไข ${aiAction.field_label} สำเร็จ ${updatedCount} ห้อง\n\nห้องที่แก้ไข: ${updatedRooms.join(', ')}`, {
          duration: 5000
        });
        setAiAction(null);
        setAiResult(null);
        setSearchQuery('');
        return;
      }
      
      // Single Update - แก้ไขห้องเดียว
      if (aiAction.action_type === 'update' && aiAction.room_id) {
        const room = rooms.find(r => r.id === aiAction.room_id);
        if (!room) {
          toast.error('ไม่พบห้อง');
          setExecutingAction(false);
          return;
        }

        const updateData = {};
        Object.entries(aiAction.changes || {}).forEach(([field, change]) => {
          let value = change.new;
          if (field === 'floor') value = parseInt(value);
          if (field === 'price' || field === 'size' || field === 'common_fee' || field === 'water_rate' || field === 'electricity_rate') {
            value = parseFloat(value);
          }
          updateData[field] = value;
        });

        console.log('🔄 Updating room:', aiAction.room_id, updateData);
        await updateMutation.mutateAsync({ id: aiAction.room_id, data: updateData });
        toast.success(`✅ แก้ไขห้อง ${room.room_number} สำเร็จ`);
        setAiAction(null);
        setAiResult(null);
        setSearchQuery('');
      } else if (aiAction.action_type === 'create' && aiAction.data) {
        console.log('🔄 Creating room:', aiAction.data);
        await createMutation.mutateAsync({
          ...aiAction.data,
          branch_id: selectedBranchId,
          floor: parseInt(aiAction.data.floor),
          price: parseFloat(aiAction.data.price),
          size: aiAction.data.size ? parseFloat(aiAction.data.size) : undefined
        });
        toast.success('✅ เพิ่มข้อมูลสำเร็จ');
        setAiAction(null);
        setAiResult(null);
        setSearchQuery('');
      }
    } catch (error) {
      console.error('❌ AI action error:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setExecutingAction(false);
    }
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

  if (!selectedBranchId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">กรุณาเลือกสาขา</h2>
          <p className="text-slate-500 mt-2">โปรดเลือกสาขาจากเมนูด้านบนเพื่อจัดการห้องพัก</p>
        </Card>
      </div>
    );
  }

  if ((roomsLoading || roomsFetching) && rooms.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <PageHeader
          title="จัดการห้องพัก"
          subtitle={`สาขา ${selectedBranchName}`}
          icon={DoorOpen}
        />
        <div className="px-4 md:px-8 py-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 animate-pulse">
              {[...Array(12)].map((_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg overflow-hidden">
                  <div className="h-2 bg-slate-200"></div>
                  <CardContent className="p-3 md:p-4 space-y-2">
                    <div className="h-6 bg-slate-200 rounded mx-auto" style={{ width: '60%' }}></div>
                    <div className="h-4 bg-slate-200 rounded" style={{ width: '80%' }}></div>
                    <div className="h-3 bg-slate-200 rounded" style={{ width: '50%' }}></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <ScrollToTopButton />
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <PageHeader
        title="จัดการห้องพัก"
        subtitle={`สาขา ${selectedBranchName}`}
        icon={DoorOpen}
        actions={
          <>
            
            <Button
              onClick={handleDownloadExistingRooms}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 shadow-md hidden md:flex"
            >
              <Download className="w-4 h-4 mr-2" />
              ดาวน์โหลดข้อมูล
            </Button>
            <Button
              onClick={() => setShowUploadDialog(true)}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50 shadow-md hidden md:flex"
            >
              <Upload className="w-4 h-4 mr-2" />
              นำเข้าข้อมูล
            </Button>
            {roomsWithoutBranch.length > 0 && (userRole === 'developer' || userRole === 'owner') && (
              <Button
                onClick={() => setShowBranchIdFixDialog(true)}
                variant="outline"
                className="border-red-500 text-red-600 hover:bg-red-50 shadow-md"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                แก้ไข ({roomsWithoutBranch.length})
              </Button>
            )}
            {canAdd && (
              <Button
                onClick={() => {
                  setEditingRoom(null);
                  setFormData({
                    room_number: '',
                    floor: '',
                    room_type: 'monthly',
                    price: '',
                    status: 'available',
                    size: '',
                    amenities: [],
                    description: '',
                    image_urls: [],
                    last_ac_cleaning_date: '',
                    water_rate: '',
                    electricity_rate: '',
                    common_fee: '',
                    is_flat_rate_water: false,
                    flat_rate_water_amount: '',
                    is_flat_rate_electricity: false,
                    flat_rate_electricity_amount: '',
                    min_water_units: '',
                    min_water_charge: '',
                    min_electricity_units: '',
                    min_electricity_charge: '',
                    other_monthly_fees: []
                  });
                  setIsFlatRateWater(false);
                  setIsFlatRateElectricity(false);
                  setShowDialog(true);
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                data-onboarding="add-room-button"
              >
                <Plus className="w-5 h-5 mr-2" />
                เพิ่มห้องใหม่
              </Button>
            )}
          </>
        }
      />

      <div className="px-4 md:px-8 py-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-3">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg rounded-xl">            
            <CardContent className="p-2.5 md:p-3.5 space-y-1.5 md:space-y-2.5 relative">
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <AISearchBox
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onAISearch={handleAISearch}
                    aiSearching={aiSearching}
                    placeholder="ค้นหาห้อง หรือถามเช่น 'ห้องว่างชั้น 5' 'ห้องที่มีแอร์' 'ห้องราคาถูกที่สุด'"
                  />
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-9 md:h-12 px-3 md:px-4 rounded-xl md:rounded-2xl bg-white/60 backdrop-blur-xl shadow-md border-white/70 flex items-center gap-2"
                    >
                      <CheckSquare className="w-4 h-4" />
                      <span className="hidden md:inline text-sm">สถานะ</span>
                      {selectedStatuses.length > 0 && (
                        <Badge className="bg-blue-500 text-white h-5 px-1.5 text-xs">
                          {selectedStatuses.length}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 md:w-80 p-3 md:p-4 bg-white/95 backdrop-blur-2xl border-white/80 rounded-xl md:rounded-2xl shadow-2xl" align="end">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between mb-3 md:mb-4">
                        <h4 className="font-bold text-slate-800 text-sm md:text-base">เลือกสถานะ</h4>
                        {selectedStatuses.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedStatuses([])}
                            className="h-7 md:h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50/50 rounded-lg px-2"
                          >
                            ล้าง
                          </Button>
                        )}
                      </div>

                      <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-green-50/70 cursor-pointer transition-all">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          selectedStatuses.includes('available')
                            ? 'bg-gradient-to-br from-green-500 to-emerald-500 border-green-600 shadow-lg'
                            : 'bg-white/80 border-slate-300'
                        }`}>
                          {selectedStatuses.includes('available') && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes('available')}
                          onChange={() => toggleStatus('available')}
                          className="sr-only"
                        />
                        <span className="text-sm text-slate-700 font-medium">ว่าง</span>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-blue-50/70 cursor-pointer transition-all">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          selectedStatuses.includes('occupied')
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-500 border-blue-600 shadow-lg'
                            : 'bg-white/80 border-slate-300'
                        }`}>
                          {selectedStatuses.includes('occupied') && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes('occupied')}
                          onChange={() => toggleStatus('occupied')}
                          className="sr-only"
                        />
                        <span className="text-sm text-slate-700 font-medium">มีผู้เช่า</span>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-orange-50/70 cursor-pointer transition-all">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          selectedStatuses.includes('reserved')
                            ? 'bg-gradient-to-br from-orange-500 to-amber-500 border-orange-600 shadow-lg'
                            : 'bg-white/80 border-slate-300'
                        }`}>
                          {selectedStatuses.includes('reserved') && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes('reserved')}
                          onChange={() => toggleStatus('reserved')}
                          className="sr-only"
                        />
                        <span className="text-sm text-slate-700 font-medium">จอง</span>
                      </label>

                      <div className="border-t border-slate-200/50 my-3"></div>

                      <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-50/70 cursor-pointer transition-all">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          selectedStatuses.includes('expiring_soon')
                            ? 'bg-gradient-to-br from-red-500 to-pink-500 border-red-600 shadow-lg'
                            : 'bg-white/80 border-slate-300'
                        }`}>
                          {selectedStatuses.includes('expiring_soon') && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes('expiring_soon')}
                          onChange={() => toggleStatus('expiring_soon')}
                          className="sr-only"
                        />
                        <span className="text-sm text-slate-700 font-medium">ใกล้หมดสัญญา</span>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-yellow-50/70 cursor-pointer transition-all">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          selectedStatuses.includes('near_payment')
                            ? 'bg-gradient-to-br from-yellow-500 to-orange-400 border-yellow-600 shadow-lg'
                            : 'bg-white/80 border-slate-300'
                        }`}>
                          {selectedStatuses.includes('near_payment') && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes('near_payment')}
                          onChange={() => toggleStatus('near_payment')}
                          className="sr-only"
                        />
                        <span className="text-sm text-slate-700 font-medium">ใกล้ชำระ</span>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-red-50/70 cursor-pointer transition-all">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          selectedStatuses.includes('payment_overdue')
                            ? 'bg-gradient-to-br from-red-600 to-red-500 border-red-700 shadow-lg'
                            : 'bg-white/80 border-slate-300'
                        }`}>
                          {selectedStatuses.includes('payment_overdue') && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes('payment_overdue')}
                          onChange={() => toggleStatus('payment_overdue')}
                          className="sr-only"
                        />
                        <span className="text-sm text-slate-700 font-medium">เกินกำหนด</span>
                      </label>

                      <label className="flex items-center gap-3 p-3 rounded-xl hover:bg-cyan-50/70 cursor-pointer transition-all">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                          selectedStatuses.includes('ac_cleaning')
                            ? 'bg-gradient-to-br from-cyan-500 to-blue-400 border-cyan-600 shadow-lg'
                            : 'bg-white/80 border-slate-300'
                        }`}>
                          {selectedStatuses.includes('ac_cleaning') && (
                            <Check className="w-4 h-4 text-white" />
                          )}
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedStatuses.includes('ac_cleaning')}
                          onChange={() => toggleStatus('ac_cleaning')}
                          className="sr-only"
                        />
                        <span className="text-sm text-slate-700 font-medium">แอร์ต้องล้าง</span>
                      </label>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {aiAction && (
                <AIActionConfirmation
                  action={aiAction}
                  onConfirm={handleConfirmAIAction}
                  onCancel={() => {
                    console.log('❌ AI action cancelled');
                    setAiAction(null);
                    toast.info('ยกเลิกการดำเนินการแล้ว - ไม่มีการเปลี่ยนแปลงข้อมูล');
                  }}
                  isLoading={executingAction}
                  roomInfo={aiAction.room_id ? rooms.find(r => r.id === aiAction.room_id) : null}
                />
              )}

              {aiResult && !aiAction && (
                <AIResultCard aiResult={aiResult}>
                  {aiResult.rooms && aiResult.rooms.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-semibold text-purple-800">ห้องที่พบ:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {aiResult.rooms.map((aiRoom, idx) => {
                          const roomData = rooms.find(r => r.id === aiRoom.room_id);
                          if (!roomData) return null;
                          
                          const booking = getActiveBooking(roomData.id);
                          const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
                          
                          return (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: idx * 0.05 }}
                            >
                              <Card 
                                className={`cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br ${getRoomColor(roomData.status)} overflow-hidden`}
                                onClick={() => handleRoomClick(roomData)}
                              >
                                <CardContent className="p-4 text-white">
                                  <div className="flex items-start justify-between mb-2">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <DoorOpen className="w-5 h-5" />
                                        <p className="text-2xl font-bold">{aiRoom.room_number}</p>
                                      </div>
                                      <p className="text-sm opacity-90">ชั้น {aiRoom.floor}</p>
                                    </div>
                                    <Badge className="bg-white/20 text-white border-white/30">
                                      {roomData.room_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}
                                    </Badge>
                                  </div>
                                  
                                  <div className="space-y-1 text-sm opacity-90">
                                    <p className="font-semibold text-lg">{roomData.price?.toLocaleString()} ฿</p>
                                    {tenant ? (
                                      <p className="truncate">👤 {tenant.full_name}</p>
                                    ) : (
                                      <p>✓ {getStatusLabel(roomData.status)}</p>
                                    )}
                                    {aiRoom.reason && (
                                      <p className="text-xs border-t border-white/20 pt-2 mt-2 italic">
                                        {aiRoom.reason}
                                      </p>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </AIResultCard>
              )}

              {(debouncedSearch || selectedRoomType !== 'all' || selectedStatuses.length > 0) && (
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap pt-2 border-t border-white/50">
                  <span className="text-[10px] md:text-xs text-slate-600 font-semibold">กรอง:</span>
                  {debouncedSearch && (
                    <Badge variant="outline" className="bg-white/80 backdrop-blur-sm border-slate-200/60 text-[10px] md:text-xs py-0 h-5">ค้นหา: {debouncedSearch}</Badge>
                  )}
                  {selectedRoomType !== 'all' && (
                    <Badge variant="outline" className="bg-white/80 backdrop-blur-sm border-slate-200/60 text-[10px] md:text-xs py-0 h-5">{selectedRoomType === 'monthly' ? 'รายเดือน' : 'รายวัน'}</Badge>
                  )}
                  {selectedStatuses.map(status => (
                    <Badge key={status} variant="outline" className="bg-white/80 backdrop-blur-sm border-slate-200/60 text-[10px] md:text-xs py-0 h-5">{getStatusLabel(status)}</Badge>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedRoomType('all');
                      setSelectedStatuses([]);
                      setCurrentPage(1);
                    }}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50/50 text-[10px] md:text-xs rounded-lg h-5 px-2"
                  >
                    ล้าง
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-between my-4 px-1">
            <p className="text-sm text-slate-600">
              {debouncedSearch ? `พบ ${filteredRooms.length} ห้อง` : `ห้องทั้งหมด: ${rooms.length} ห้อง`}
            </p>
            <Button
              variant={isSelectionMode ? "destructive" : "outline"}
              size="sm"
              onClick={() => {
                const newSelectionMode = !isSelectionMode;
                setIsSelectionMode(newSelectionMode);
                if (!newSelectionMode) {
                  setSelectedRooms([]);
                }
              }}
              className="shadow-sm"
              data-selection-control
            >
              {isSelectionMode ? (
                <><X className="w-4 h-4 mr-2" /> ยกเลิกการเลือก</>
              ) : (
                <><CheckSquare className="w-4 h-4 mr-2" /> แก้ไขหลายรายการ</>
              )}
            </Button>
          </div>

          <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-lg rounded-xl md:rounded-2xl overflow-hidden">
            <CardContent className="p-2 md:p-3">
              <div className="flex flex-wrap gap-2 md:gap-3 items-center text-[10px] md:text-xs">
                <span className="font-semibold text-slate-700 text-xs hidden md:inline">สถานะห้อง:</span>
                <div className="flex items-center gap-1 md:gap-1.5">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-gradient-to-r from-green-500 to-emerald-600"></div>
                  <span className="text-slate-600">ว่าง</span>
                </div>
                <div className="flex items-center gap-1 md:gap-1.5">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                  <span className="text-slate-600">มีผู้เช่า</span>
                </div>
                <div className="flex items-center gap-1 md:gap-1.5">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-gradient-to-r from-orange-500 to-amber-600"></div>
                  <span className="text-slate-600">จอง</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5 md:w-3 md:h-3 text-red-500" />
                  <span className="text-slate-600">หมดสัญญา</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5 md:w-3 md:h-3 text-yellow-500" />
                  <span className="text-slate-600">ใกล้ชำระ</span>
                </div>
                <div className="flex items-center gap-1">
                  <DollarSign className="w-2.5 h-2.5 md:w-3 md:h-3 text-red-500" />
                  <span className="text-slate-600">เกินกำหนด</span>
                </div>
                <div className="flex items-center gap-1">
                  <Wind className="w-2.5 h-2.5 md:w-3 md:h-3 text-cyan-500" />
                  <span className="text-slate-600">แอร์</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {filteredRooms.length === 0 && rooms.length > 0 && (
            <Card className="bg-yellow-50 border-yellow-200"><CardContent className="p-6 text-center"><AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" /><h3 className="text-lg font-bold text-slate-800 mb-2">ไม่พบห้องที่ตรงกับเงื่อนไข</h3><p className="text-slate-600 mb-4">ลองเปลี่ยนเงื่อนไขการค้นหาหรือกรองข้อมูล</p><Button variant="outline" onClick={() => { setSearchQuery(''); setSelectedFloor('all'); setSelectedStatuses([]); setDisplayLimit(50); }}>ล้างการกรอง</Button></CardContent></Card>
          )}

          {roomsError && (
            <Card className="bg-red-50 border-red-200 border-dashed border-2"><CardContent className="p-12 text-center"><AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-4" /><h3 className="text-xl font-bold text-red-800 mb-2">เกิดข้อผิดพลาดในการโหลดข้อมูล</h3><p className="text-red-600 mb-4">ไม่สามารถโหลดข้อมูลห้องพักได้ กรุณาลองใหม่อีกครั้ง</p><Button onClick={() => queryClient.invalidateQueries({queryKey: ['rooms', selectedBranchId, 'v2']})} variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">โหลดใหม่</Button></CardContent></Card>
          )}

          {rooms.length === 0 && !roomsLoading && !roomsFetching && !roomsError && (
            <Card className="bg-blue-50 border-blue-200 border-dashed border-2">
              <CardContent className="p-12 text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Building2 className="w-10 h-10 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-800 mb-2">เริ่มสร้างหอพักของคุณ</h3>
                <p className="text-slate-600 mb-8 max-w-md mx-auto">
                  ดูเหมือนคุณจะยังไม่มีห้องพักในระบบ มาเริ่มต้นสร้างห้องพักกันเถอะ! 
                  คุณสามารถสร้างทีละห้อง หรือสร้างทั้งตึกพร้อมกันได้เลย
                </p>
                <div className="flex justify-center gap-4 flex-wrap">
                  {canAdd && (
                    <>
                      <Button
                        onClick={() => setShowBulkGenerator(true)}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg px-8 py-6 text-lg rounded-2xl"
                      >
                        <Building2 className="w-6 h-6 mr-2" />
                        สร้างหลายห้องพร้อมกัน (แนะนำ)
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingRoom(null);
                          setFormData({
                            room_number: '', floor: '', room_type: 'monthly', price: '',
                            status: 'available', size: '', amenities: [], description: '',
                            image_urls: [], last_ac_cleaning_date: ''
                          });
                          setShowDialog(true);
                        }}
                        className="px-8 py-6 text-lg rounded-2xl"
                      >
                        <Plus className="w-6 h-6 mr-2" />
                        สร้างทีละห้อง
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {displayedRooms.length > 0 && (
            <div className="space-y-6">
              {sortedFloorsInPage.map((floor) => (
                <motion.div
                  key={floor}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
                    <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
                    <CardHeader className="pb-3 md:pb-4 relative">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 md:gap-3">
                          <Building2 className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
                          <h2 className="text-lg md:text-2xl font-bold text-slate-800">ชั้น {floor}</h2>
                          <Badge variant="outline" className="text-xs md:text-sm bg-white/80">
                            {roomsByFloorInPage[floor].length} ห้อง
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="relative">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
                        <AnimatePresence>
                          {roomsByFloorInPage[floor].map((room) => {
                            const booking = getActiveBooking(room.id);
                            const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
                            const isDaily = booking?.booking_type === 'daily';
                            const hasCheckedIn = booking?.actual_check_in_date;
                            const isOverdueCheckout = isDaily && hasCheckedIn && booking?.check_out_date && new Date() > new Date(booking.check_out_date);
                            const expiringSoon = booking && (isContractExpiringSoon(booking) || isOverdueCheckout);
                            const daysLeft = booking ? getDaysUntilExpiry(booking) : null;
                            const paymentStatus = getPaymentStatus(room.id);
                            const acNeedsCleaning = needsACCleaning(room);
                            
                            // ⭐ เช็คจากทั้ง TemporaryBooking และ Booking + ต้องมี tenant_id
                            const hasActiveBooking = (
                              temporaryBookings.some(b => 
                                b.room_id === room.id && 
                                b.status === 'active' &&
                                b.tenant_id !== null && b.tenant_id !== undefined
                              ) ||
                              bookings.some(b => 
                                b.room_id === room.id && 
                                b.status === 'active' &&
                                b.tenant_id !== null && b.tenant_id !== undefined
                              )
                            );
                            
                            // ⭐ เช็คการจองที่ยังไม่มี tenant_id (จองชั่วคราว)
                            const hasReservationWithoutTenant = (
                              temporaryBookings.some(b => 
                                b.room_id === room.id && 
                                b.status === 'active' &&
                                (b.tenant_id === null || b.tenant_id === undefined)
                              ) ||
                              bookings.some(b => 
                                b.room_id === room.id && 
                                b.status === 'active' &&
                                (b.tenant_id === null || b.tenant_id === undefined)
                              )
                            );
                            
                            // Check for future reservations (ติดจองล่วงหน้า) - เช็คจากทั้ง 2 entity
                            const futureBookings = [
                              ...temporaryBookings.filter(b => 
                                b.room_id === room.id && 
                                b.status === 'active' && 
                                b.check_in_date &&
                                new Date(b.check_in_date) > new Date()
                              ),
                              ...bookings.filter(b => 
                                b.room_id === room.id && 
                                b.status === 'active' && 
                                b.check_in_date &&
                                new Date(b.check_in_date) > new Date()
                              )
                            ];
                            
                            // DEBUG LOG - เปรียบเทียบ IDs และข้อมูล
                            if (room.room_number === '101') {
                              console.log('🔍 DEBUG Room 101 - ข้อมูลห้อง:', { id: room.id, number: room.room_number, status: room.status });
                              console.log('📦 TemporaryBookings ทั้งหมด:', temporaryBookings.length, 'รายการ');
                              temporaryBookings.forEach((b, idx) => {
                                console.log(`  [${idx}] room_id: ${b.room_id}, tenant_id: ${b.tenant_id}, status: ${b.status}, check_in: ${b.check_in_date}`);
                              });
                              console.log('🎯 TemporaryBookings สำหรับ 101:', temporaryBookings.filter(b => b.room_id === room.id));
                              console.log('📋 Bookings ทั้งหมด:', bookings.length, 'รายการ');
                              bookings.forEach((b, idx) => {
                                console.log(`  [${idx}] room_id: ${b.room_id}, tenant_id: ${b.tenant_id}, status: ${b.status}`);
                              });
                              console.log('✅ hasReservationWithoutTenant:', hasReservationWithoutTenant);
                              console.log('🚀 futureBookings:', futureBookings.length, 'รายการ');
                              console.log('📌 isReserved:', room.status === 'reserved' || futureBookings.length > 0 || (hasActiveBooking && room.status !== 'occupied') || hasReservationWithoutTenant);
                            }
                            
                            // แสดง "ติดจอง" ถ้า: room status = reserved หรือมี future booking หรือมี active booking แต่ room status ไม่ใช่ occupied หรือจองแบบยังไม่มีผู้เช่า
                            const isReserved = room.status === 'reserved' || 
                   temporaryBookings.some(b => b.room_id === room.id && b.status === 'active');
                            return (
                              <motion.div
                                key={room.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                whileHover={{ scale: 1.05 }}
                                transition={{ duration: 0.2 }}
                                data-room-item
                              >
                                <Card
                                  className={`select-none relative overflow-hidden cursor-pointer bg-gradient-to-br ${expiringSoon ? 'from-rose-500 to-pink-600' : getRoomColor(room.status)} shadow-lg hover:shadow-2xl transition-all duration-300 rounded-2xl ${selectedRooms.includes(room.id) ? 'ring-4 ring-blue-400 ring-offset-2' : ''} ${longPressTarget === room.id ? 'scale-95' : ''} h-full min-h-[140px]`}
                                  onClick={() => {
                                    if (isSelectionMode) {
                                      toggleRoomSelection(room.id);
                                    } else {
                                      handleRoomClick(room);
                                    }
                                  }}
                                  onMouseDown={(e) => {
                                    if (!isSelectionMode) handleLongPressStart(e, room.id);
                                  }}
                                  onMouseUp={() => {
                                    if (!isSelectionMode) handleLongPressEnd();
                                  }}
                                  onMouseLeave={() => {
                                    if (!isSelectionMode) handleLongPressEnd();
                                  }}
                                  onTouchStart={(e) => {
                                    if (!isSelectionMode) handleLongPressStart(e, room.id);
                                  }}
                                  onTouchEnd={() => {
                                    if (!isSelectionMode) handleLongPressEnd();
                                  }}
                                  onTouchCancel={() => {
                                    if (!isSelectionMode) handleLongPressEnd();
                                  }}
                                  onContextMenu={(e) => e.preventDefault()}
                                >
                                  {isSelectionMode && (
                                    <div 
                                      className="absolute top-2 left-2 z-20" 
                                      onClick={(e) => { 
                                        e.stopPropagation(); 
                                        toggleRoomSelection(room.id); 
                                      }}
                                      data-selection-control
                                    >
                                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedRooms.includes(room.id) ? 'bg-blue-600 border-blue-600' : 'bg-white/30 border-white/70 hover:bg-white/50'}`}>
                                        {selectedRooms.includes(room.id) && <Check className="w-4 h-4 text-white" />}
                                      </div>
                                    </div>
                                  )}
                                  {room.room_type === 'daily' && (
                                    <div className="absolute top-0 left-0 right-0 bg-white/30 backdrop-blur-sm text-white text-[10px] font-medium py-1 text-center z-10 tracking-wide pointer-events-none rounded-t-2xl border-b border-white/20">
                                      รายวัน
                                    </div>
                                  )}
                                  <div className="absolute top-2 right-2 z-10 flex gap-1">
                                    {expiringSoon && (
                                      <div className="bg-red-500 text-white rounded-full p-1 animate-pulse" title={isOverdueCheckout ? "เกินวันเช็คเอาท์" : "ใกล้หมดสัญญา"}>
                                        <AlertTriangle className="w-3 h-3 md:w-4 md:h-4" />
                                      </div>
                                    )}
                                    {paymentStatus?.isOverdue && (
                                      <div className="bg-red-600 text-white rounded-full p-1 animate-pulse" title="เกินกำหนดชำระ">
                                        <DollarSign className="w-3 h-3 md:w-4 md:h-4" />
                                      </div>
                                    )}
                                    {paymentStatus?.isNearDue && !paymentStatus.isOverdue && (
                                      <div className="bg-yellow-500 text-white rounded-full p-1 animate-pulse" title="ใกล้ถึงกำหนดชำระ">
                                        <Clock className="w-3 h-3 md:w-4 md:h-4" />
                                      </div>
                                    )}
                                    {acNeedsCleaning && (
                                      <div className="bg-cyan-500 text-white rounded-full p-1 animate-pulse" title="แอร์ต้องล้าง (เกิน 1 ปี)">
                                        <Wind className="w-3 h-3 md:w-4 md:h-4" />
                                      </div>
                                    )}
                                  </div>

                                  {isReserved && (
                                    <div className="absolute top-0 left-0 right-0 z-20 pointer-events-none">
                                      <div className="bg-orange-500/95 backdrop-blur-sm text-white text-[10px] font-bold py-1 px-2 text-center shadow-lg">
                                        ติดจอง
                                      </div>
                                    </div>
                                  )}

                                  <CardContent className="p-3 md:p-4 text-white h-full flex flex-col justify-center">
                                    <div className="text-center space-y-1 md:space-y-2">
                                      <p className="text-xl md:text-2xl font-bold">{room.room_number}</p>
                                      <p className="text-xs md:text-sm opacity-90 truncate">
                                        {tenant ? tenant.full_name : getStatusLabel(room.status)}
                                      </p>
                                      <div className="text-xs opacity-80">
                                        <p>{room.price.toLocaleString()} ฿</p>
                                        <p>{room.room_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}</p>
                                      </div>
                                      {(room.is_flat_rate_water || room.is_flat_rate_electricity) && (
                                        <div className="flex items-center justify-center gap-1 pt-1">
                                          {room.is_flat_rate_water && (
                                            <div className="flex items-center gap-0.5 bg-white/20 px-1.5 py-0.5 rounded-full">
                                              <Droplet className="w-2.5 h-2.5" />
                                              <span className="text-[9px] font-semibold">เหมา</span>
                                            </div>
                                          )}
                                          {room.is_flat_rate_electricity && (
                                            <div className="flex items-center gap-0.5 bg-white/20 px-1.5 py-0.5 rounded-full">
                                              <Zap className="w-2.5 h-2.5" />
                                              <span className="text-[9px] font-semibold">เหมา</span>
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {paymentStatus && paymentStatus.isOverdue && (
                                        <div className="pt-2 border-t border-white/30 space-y-1">
                                            <p className="text-xs font-semibold bg-red-600/90 rounded px-2 py-1">
                                              เกิน {Math.abs(paymentStatus.daysUntilDue)} วัน
                                            </p>
                                        </div>
                                      )}
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}

          {displayLimit < filteredRooms.length && (
            <div ref={loadMoreRef} className="py-8 text-center">
              <div className="inline-flex items-center gap-2 text-slate-600">
                <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>กำลังโหลดเพิ่ม...</span>
              </div>
            </div>
          )}

          {displayLimit >= filteredRooms.length && filteredRooms.length > 50 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-slate-600">
                  แสดงครบทั้งหมด {filteredRooms.length} ห้อง
                </p>
              </CardContent>
            </Card>
          )}

          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <div className="flex justify-between items-center">
                  <DialogTitle>{editingRoom ? 'แก้ไขห้องพัก' : 'เพิ่มห้องใหม่'}</DialogTitle>
                  {!editingRoom && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-blue-600 hover:bg-blue-50"
                      onClick={() => {
                        setShowDialog(false);
                        setShowBulkGenerator(true);
                      }}
                    >
                      <Building2 className="w-4 h-4 mr-2" />
                      สร้างหลายห้องพร้อมกัน?
                    </Button>
                  )}
                </div>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>หมายเลขห้อง *</Label>
                    <Input
                      value={formData.room_number}
                      onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>ชั้น *</Label>
                    <Input
                      type="number"
                      value={formData.floor}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value })}
                      onWheel={(e) => e.target.blur()}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ประเภทห้อง *</Label>
                    <Select value={formData.room_type} onValueChange={(value) => setFormData({ ...formData, room_type: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">รายเดือน</SelectItem>
                        <SelectItem value="daily">รายวัน</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>ราคา (บาท) *</Label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      onWheel={(e) => e.target.blur()}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>สถานะ</Label>
                    <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">ว่าง</SelectItem>
                        <SelectItem value="occupied">มีผู้เช่า</SelectItem>
                        <SelectItem value="reserved">จอง</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>ขนาด (ตร.ม.)</Label>
                    <Input
                      type="number"
                      value={formData.size}
                      onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      onWheel={(e) => e.target.blur()}
                    />
                  </div>
                </div>

                <div className="space-y-4 p-4 border rounded-lg bg-slate-50/50">
                  <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-700" />
                    การคิดค่าน้ำ-ไฟ
                  </h4>
                  
                  {/* ค่าน้ำ */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="flat-water"
                        checked={isFlatRateWater}
                        onCheckedChange={(checked) => {
                          setIsFlatRateWater(checked);
                          setFormData({ ...formData, is_flat_rate_water: checked });
                          if (checked) setEnableMinWater(false);
                        }}
                      />
                      <Label htmlFor="flat-water" className="cursor-pointer font-medium text-blue-700 flex items-center gap-2">
                        <Droplet className="w-4 h-4" />
                        ค่าน้ำเหมาจ่าย
                      </Label>
                    </div>
                    
                    {isFlatRateWater ? (
                      <Input
                        type="number"
                        placeholder="จำนวนเงิน (บาท/เดือน)"
                        value={formData.flat_rate_water_amount}
                        onChange={(e) => setFormData({ ...formData, flat_rate_water_amount: e.target.value })}
                        onWheel={(e) => e.target.blur()}
                        className="bg-blue-50 border-blue-300"
                      />
                    ) : (
                      <Input
                        type="number"
                        placeholder={branchWaterRate ? `${branchWaterRate} (ค่ากลาง)` : "ค่าน้ำต่อหน่วย"}
                        value={formData.water_rate}
                        onChange={(e) => setFormData({ ...formData, water_rate: e.target.value })}
                        onWheel={(e) => e.target.blur()}
                      />
                    )}
                  </div>

                  {/* ค่าไฟ */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="flat-electricity"
                        checked={isFlatRateElectricity}
                        onCheckedChange={(checked) => {
                          setIsFlatRateElectricity(checked);
                          setFormData({ ...formData, is_flat_rate_electricity: checked });
                          if (checked) setEnableMinElectricity(false);
                        }}
                      />
                      <Label htmlFor="flat-electricity" className="cursor-pointer font-medium text-orange-700 flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        ค่าไฟเหมาจ่าย
                      </Label>
                    </div>
                    
                    {isFlatRateElectricity ? (
                      <Input
                        type="number"
                        placeholder="จำนวนเงิน (บาท/เดือน)"
                        value={formData.flat_rate_electricity_amount}
                        onChange={(e) => setFormData({ ...formData, flat_rate_electricity_amount: e.target.value })}
                        onWheel={(e) => e.target.blur()}
                        className="bg-orange-50 border-orange-300"
                      />
                    ) : (
                      <Input
                        type="number"
                        placeholder={branchElecRate ? `${branchElecRate} (ค่ากลาง)` : "ค่าไฟต่อหน่วย"}
                        value={formData.electricity_rate}
                        onChange={(e) => setFormData({ ...formData, electricity_rate: e.target.value })}
                        onWheel={(e) => e.target.blur()}
                      />
                    )}
                  </div>

                  {/* ค่าส่วนกลาง */}
                  <div>
                    <Label>ค่าส่วนกลาง (บาท/เดือน)</Label>
                    <Input
                      type="number"
                      placeholder={branchCommonFee ? `${branchCommonFee} (ค่ากลาง)` : "0"}
                      value={formData.common_fee}
                      onChange={(e) => setFormData({ ...formData, common_fee: e.target.value })}
                      onWheel={(e) => e.target.blur()}
                    />
                  </div>
                </div>

                {/* ค่าขั้นต่ำน้ำ-ไฟ */}
                {!isFlatRateWater && !isFlatRateElectricity && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="show-min-charges"
                        checked={showMinCharges}
                        onCheckedChange={(checked) => {
                          setShowMinCharges(checked);
                          if (!checked) {
                            setEnableMinWater(false);
                            setEnableMinElectricity(false);
                            setFormData({ 
                              ...formData, 
                              min_water_units: '', 
                              min_water_charge: '',
                              min_electricity_units: '', 
                              min_electricity_charge: ''
                            });
                          }
                        }}
                      />
                      <Label htmlFor="show-min-charges" className="cursor-pointer font-medium">
                        คิดค่าน้ำค่าไฟขั้นต่ำเฉพาะห้องนี้
                      </Label>
                    </div>

                    {showMinCharges && (
                    <div className="p-4 border rounded-lg bg-slate-50/50 space-y-3">
                      <p className="text-xs text-slate-500">ถ้าไม่ตั้ง = ใช้ค่าสาขา</p>
                      
                      <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox
                          id="enable-min-water"
                          checked={enableMinWater}
                          onCheckedChange={(checked) => {
                            setEnableMinWater(checked);
                            if (!checked) {
                              setFormData({ 
                                ...formData, 
                                min_water_units: '', 
                                min_water_charge: '' 
                              });
                            }
                          }}
                        />
                        <Label htmlFor="enable-min-water" className="text-sm cursor-pointer">
                          ตั้งค่าขั้นต่ำค่าน้ำ
                        </Label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-slate-600">หน่วย</Label>
                          <Input
                            type="number"
                            placeholder="เช่น 5"
                            value={formData.min_water_units}
                            onChange={(e) => setFormData({ ...formData, min_water_units: e.target.value })}
                            onWheel={(e) => e.target.blur()}
                            disabled={!enableMinWater}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">คิดค่า (บาท)</Label>
                          <Input
                            type="number"
                            placeholder="เช่น 50"
                            value={formData.min_water_charge}
                            onChange={(e) => setFormData({ ...formData, min_water_charge: e.target.value })}
                            onWheel={(e) => e.target.blur()}
                            disabled={!enableMinWater}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500">ถ้าใช้น้อยกว่า X หน่วย คิด Y บาท</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Checkbox
                          id="enable-min-electricity"
                          checked={enableMinElectricity}
                          onCheckedChange={(checked) => {
                            setEnableMinElectricity(checked);
                            if (!checked) {
                              setFormData({ 
                                ...formData, 
                                min_electricity_units: '', 
                                min_electricity_charge: '' 
                              });
                            }
                          }}
                        />
                        <Label htmlFor="enable-min-electricity" className="text-sm cursor-pointer">
                          ตั้งค่าขั้นต่ำค่าไฟ
                        </Label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-slate-600">หน่วย</Label>
                          <Input
                            type="number"
                            placeholder="เช่น 10"
                            value={formData.min_electricity_units}
                            onChange={(e) => setFormData({ ...formData, min_electricity_units: e.target.value })}
                            onWheel={(e) => e.target.blur()}
                            disabled={!enableMinElectricity}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-600">คิดค่า (บาท)</Label>
                          <Input
                            type="number"
                            placeholder="เช่น 100"
                            value={formData.min_electricity_charge}
                            onChange={(e) => setFormData({ ...formData, min_electricity_charge: e.target.value })}
                            onWheel={(e) => e.target.blur()}
                            disabled={!enableMinElectricity}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500">ถ้าใช้น้อยกว่า X หน่วย คิด Y บาท</p>
                    </div>
                    </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Other Monthly Fees */}
                <div className="space-y-2 p-4 border rounded-lg bg-slate-50/50">
                  <Label className="flex items-center gap-2 font-semibold">
                    <DollarSign className="w-4 h-4 text-slate-700" />
                    ค่าใช้จ่ายอื่นๆ รายเดือน (เฉพาะห้องนี้)
                  </Label>
                  {(formData.other_monthly_fees || []).map((fee, index) => (
                    <div key={index} className="flex gap-2 items-end">
                      <div className="flex-1">
                        <Label className="text-xs text-slate-500">รายการ</Label>
                        <Input
                          value={fee.name}
                          onChange={(e) => {
                            const newFees = [...(formData.other_monthly_fees || [])];
                            newFees[index].name = e.target.value;
                            setFormData({ ...formData, other_monthly_fees: newFees });
                          }}
                          placeholder="เช่น ค่าที่จอดรถพิเศษ, ค่าเช่าตู้เย็น"
                        />
                      </div>
                      <div className="w-32">
                        <Label className="text-xs text-slate-500">จำนวนเงิน</Label>
                        <Input
                          type="number"
                          value={fee.amount}
                          onChange={(e) => {
                            const newFees = [...(formData.other_monthly_fees || [])];
                            newFees[index].amount = parseFloat(e.target.value);
                            setFormData({ ...formData, other_monthly_fees: newFees });
                          }}
                          onWheel={(e) => e.target.blur()}
                          placeholder="0"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:bg-red-50 mb-0.5"
                        onClick={() => {
                          const newFees = (formData.other_monthly_fees || []).filter((_, i) => i !== index);
                          setFormData({ ...formData, other_monthly_fees: newFees });
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2 border-dashed"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        other_monthly_fees: [...(formData.other_monthly_fees || []), { name: '', amount: '' }]
                      });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    เพิ่มรายการ
                  </Button>
                </div>

                <div>
                  <Label>วันที่ล้างแอร์ครั้งล่าสุด</Label>
                  <Input
                    type="date"
                    value={formData.last_ac_cleaning_date}
                    onChange={(e) => setFormData({ ...formData, last_ac_cleaning_date: e.target.value })}
                    placeholder="เลือกวันที่ล้างแอร์"
                  />
                </div>

                <div>
                  <Label>สิ่งอำนวยความสะดวก/เฟอร์นิเจอร์</Label>
                  <p className="text-xs text-slate-500 mb-2">พิมพ์รายการแล้วกด Enter (เช่น เตียง, ตู้เสื้อผ้า, แอร์)</p>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        placeholder="พิมพ์รายการแล้วกด Enter"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const value = e.currentTarget.value.trim();
                            if (value && !formData.amenities.includes(value)) {
                              setFormData({
                                ...formData,
                                amenities: [...formData.amenities, value]
                              });
                              e.currentTarget.value = '';
                            }
                          }
                        }}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {['เตียง', 'ที่นอน', 'ตู้เสื้อผ้า', 'โต๊ะทำงาน', 'โต๊ะเครื่องแป้ง', 'เก้าอี้', 'ชั้นวางของ', 'แอร์', 'เครื่องทำน้ำอุ่น', 'ทีวี', 'ตู้เย็น', 'ไมโครเวฟ', 'ระเบียง', 'เครื่องซักผ้า', 'ผ้าม่าน', 'Wi-Fi'].map((item) => (
                        <Button
                          key={item}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (!formData.amenities.includes(item)) {
                              setFormData({
                                ...formData,
                                amenities: [...formData.amenities, item]
                              });
                            }
                          }}
                          className="text-xs"
                          disabled={formData.amenities.includes(item)}
                        >
                          + {item}
                        </Button>
                      ))}
                    </div>

                    {formData.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2 p-3 bg-slate-50 rounded-lg">
                        {formData.amenities.map((amenity, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-1 rounded-md text-sm"
                          >
                            <span>{amenity}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  amenities: formData.amenities.filter((_, i) => i !== index)
                                });
                              }}
                              className="text-blue-700 hover:text-blue-900 ml-1 leading-none"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label>รายละเอียด</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />
                </div>

                <div>
                  <Label>รูปภาพห้อง</Label>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                    {formData.image_urls.length > 0 && (
                      <div className="grid grid-cols-3 gap-2 mt-3">
                        {formData.image_urls.map((url, index) => (
                          <img key={index} src={url} alt={`รูป ${index + 1}`} className="w-full h-48 object-cover rounded-lg" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between gap-2 pt-4">
                  {editingRoom && canDelete && (
                    <Button 
                      type="button" 
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`ยืนยันการลบห้อง ${editingRoom.room_number}?\n\n⚠️ การลบจะไม่สามารถย้อนกลับได้`)) {
                          deleteMutation.mutate(editingRoom);
                          setShowDialog(false);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      {deleteMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          กำลังลบ...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          ลบห้อง
                        </>
                      )}
                    </Button>
                  )}
                  <div className="flex gap-2 ml-auto">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowDialog(false)}
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      ยกเลิก
                    </Button>
                    <Button 
                      type="submit" 
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {createMutation.isPending || updateMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        editingRoom ? 'อัปเดต' : 'เพิ่มห้อง'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showDetailDialog} onOpenChange={(open) => {
           setShowDetailDialog(open);
           if (!open) {
             setSelectedRoom(null);
             setMaintenanceHistoryPage(1);
           }
          }}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>รายละเอียดห้อง {selectedRoom?.room_number}</DialogTitle>
              </DialogHeader>

              {selectedRoom && (() => {
                const booking = getActiveBooking(selectedRoom.id);
                const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
                const daysLeft = booking ? getDaysUntilExpiry(booking) : null;
                const paymentStatus = getPaymentStatus(selectedRoom.id);
                const recentPayments = getRecentPayments(selectedRoom.id, 12);
                const meterHistory = getMeterHistory(selectedRoom.id, 12);
                const maintenanceHistory = getMaintenanceHistory(selectedRoom.id);

                return (
                  <div className="space-y-4">
                    <Tabs defaultValue="room-info" className="w-full">
                      <TabsList className="grid w-full grid-cols-5">
                        <TabsTrigger value="room-info">
                          <span className="md:hidden">ห้อง</span>
                          <span className="hidden md:inline">ข้อมูลห้อง</span>
                        </TabsTrigger>
                        <TabsTrigger value="tenant-info">
                          <span className="md:hidden">ผู้เช่า</span>
                          <span className="hidden md:inline">ข้อมูลผู้เช่า</span>
                        </TabsTrigger>
                        <TabsTrigger value="payment-history">
                          <span className="md:hidden">ชำระ</span>
                          <span className="hidden md:inline">ประวัติการชำระ</span>
                        </TabsTrigger>
                        <TabsTrigger value="meter-history">
                          <span className="md:hidden">มิเตอร์</span>
                          <span className="hidden md:inline">ข้อมูลมิเตอร์</span>
                        </TabsTrigger>
                        <TabsTrigger value="maintenance-history">
                          <span className="md:hidden">ซ่อม</span>
                          <span className="hidden md:inline">ประวัติการซ่อม</span>
                        </TabsTrigger>
                      </TabsList>
                      
                      <TabsContent value="room-info" className="pt-4 space-y-4">
                        <Card className="bg-slate-50 border-slate-200">
                          <CardContent className="p-4 space-y-3">
                            {selectedRoom.image_urls && selectedRoom.image_urls.length > 0 && (
                              <div className="grid grid-cols-2 gap-3 mb-4">
                                {selectedRoom.image_urls.map((url, index) => (
                                  <img key={index} src={url} alt={`ห้อง ${index + 1}`} className="w-full h-48 object-cover rounded-lg" />
                                ))}
                              </div>
                            )}
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                              <DoorOpen className="w-5 h-5" />
                              ข้อมูลห้อง
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label className="text-slate-600">หมายเลขห้อง</Label>
                                <p className="text-xl font-bold text-slate-800">{selectedRoom.room_number}</p>
                              </div>
                              <div>
                                <Label className="text-slate-600">ชั้น</Label>
                                <p className="text-xl font-bold text-slate-800">{selectedRoom.floor}</p>
                              </div>
                              <div>
                                <Label className="text-slate-600">ประเภท</Label>
                                <p className="text-lg font-semibold text-slate-800">
                                  {selectedRoom.room_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}
                                </p>
                              </div>
                              <div>
                                <Label className="text-slate-600">ราคา</Label>
                                <p className="text-xl font-bold text-green-600">
                                  {selectedRoom.price?.toLocaleString()} บาท
                                </p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-100 p-3 rounded-lg">
                              <div>
                                <Label className="text-slate-600 text-xs flex items-center gap-1">
                                  <Droplet className="w-3.5 h-3.5 text-blue-500" />
                                  ค่าน้ำ
                                  {selectedRoom.is_flat_rate_water && (
                                    <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">เหมา</Badge>
                                  )}
                                </Label>
                                <p className="font-semibold text-blue-600">
                                  {selectedRoom.is_flat_rate_water ? (
                                    `${selectedRoom.flat_rate_water_amount?.toLocaleString() || 0} บาท/เดือน`
                                  ) : (
                                    selectedRoom.water_rate !== null && selectedRoom.water_rate !== undefined ? `${selectedRoom.water_rate} บาท/หน่วย` : <span className="text-slate-400 text-sm">(ใช้ค่ากลาง)</span>
                                  )}
                                </p>
                              </div>
                              <div>
                                <Label className="text-slate-600 text-xs flex items-center gap-1">
                                  <Zap className="w-3.5 h-3.5 text-orange-500" />
                                  ค่าไฟ
                                  {selectedRoom.is_flat_rate_electricity && (
                                    <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0">เหมา</Badge>
                                  )}
                                </Label>
                                <p className="font-semibold text-orange-600">
                                  {selectedRoom.is_flat_rate_electricity ? (
                                    `${selectedRoom.flat_rate_electricity_amount?.toLocaleString() || 0} บาท/เดือน`
                                  ) : (
                                    selectedRoom.electricity_rate !== null && selectedRoom.electricity_rate !== undefined ? `${selectedRoom.electricity_rate} บาท/หน่วย` : <span className="text-slate-400 text-sm">(ใช้ค่ากลาง)</span>
                                  )}
                                </p>
                              </div>
                              <div>
                                <Label className="text-slate-600 text-xs">ค่าส่วนกลาง</Label>
                                <p className="font-semibold text-slate-700">
                                  {selectedRoom.common_fee !== undefined && selectedRoom.common_fee !== null
                                    ? (selectedRoom.common_fee === 0 ? '0 บาท (ไม่เสีย)' : `${selectedRoom.common_fee.toLocaleString()} บาท`)
                                    : (branchCommonFee ? `${parseFloat(branchCommonFee).toLocaleString()} บาท (ค่ากลาง)` : '-')}
                                </p>
                              </div>
                              {selectedRoom.other_monthly_fees && selectedRoom.other_monthly_fees.map((fee, index) => (
                                <div key={index}>
                                  <Label className="text-slate-600 text-xs">{fee.name}</Label>
                                  <p className="font-semibold text-purple-600">
                                    {fee.amount?.toLocaleString()} บาท
                                  </p>
                                </div>
                              ))}
                            </div>

                            {selectedRoom.size && (
                              <div>
                                <Label className="text-slate-600">ขนาดห้อง</Label>
                                <p className="text-lg font-semibold text-slate-800">{selectedRoom.size} ตร.ม.</p>
                              </div>
                            )}

                            {selectedRoom.amenities && selectedRoom.amenities.length > 0 && (
                              <div>
                                <Label className="text-slate-600 mb-2 block">สิ่งอำนวยความสะดวก</Label>
                                <div className="flex flex-wrap gap-2">
                                  {selectedRoom.amenities.map((amenity, index) => (
                                    <Badge key={index} className="bg-green-100 text-green-700">
                                      {amenity}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedRoom.description && (
                              <div>
                                <Label className="text-slate-600">รายละเอียด</Label>
                                <p className="text-slate-800 mt-1">{selectedRoom.description}</p>
                              </div>
                            )}

                            {selectedRoom.last_ac_cleaning_date && (
                              <div>
                                <Label className="text-slate-600">ล้างแอร์ครั้งล่าสุด</Label>
                                <p className="text-lg font-semibold text-slate-800">
                                  {(() => {
                                    try {
                                      const date = parseISO(selectedRoom.last_ac_cleaning_date);
                                      if (isNaN(date.getTime())) return 'ข้อมูลไม่ถูกต้อง';
                                      return format(date, 'd MMM yyyy', { locale: th });
                                    } catch {
                                      return 'ข้อมูลไม่ถูกต้อง';
                                    }
                                  })()}
                                </p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                        </TabsContent>

                      <TabsContent value="tenant-info" className="pt-4 space-y-4">
                        {(() => {
                          // ⭐ ตรวจสอบการจองที่ไม่มี tenant_id ก่อน (guest_name อย่างเดียว)
                          const anyBooking = [...temporaryBookings, ...bookings].find(b => 
                            b.room_id === selectedRoom.id && b.status === 'active'
                          );

                          if (selectedRoom.status === 'occupied' && !booking && !anyBooking) {
                            return (
                              <Card className="bg-yellow-50 border-yellow-200">
                                <CardContent className="p-6 text-center">
                                  <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
                                  <h3 className="font-bold text-yellow-800">ไม่พบข้อมูลการจอง</h3>
                                  <p className="text-sm text-yellow-700">ห้องนี้มีสถานะ "มีผู้เช่า" แต่ไม่มีข้อมูลการจองในระบบ</p>
                                </CardContent>
                              </Card>
                            );
                          }

                          // ⭐ กรณีมี booking แต่ไม่มี tenant (broken booking หรือ guest only)
                          if ((booking && !tenant) || (anyBooking && !anyBooking.tenant_id)) {
                            const displayBooking = booking || anyBooking;
                            const isDaily = displayBooking.booking_type === 'daily';
                            const hasCheckedIn = displayBooking.actual_check_in_date;
                            
                            return (
                              <Card className="bg-orange-50 border-orange-200">
                                <CardContent className="p-4 space-y-3">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h3 className="font-bold text-orange-800 flex items-center gap-2">
                                        <User className="w-5 h-5" />
                                        {isDaily ? 'ข้อมูลการเข้าพัก' : 'ข้อมูลการจอง'}
                                      </h3>
                                      {!isDaily && (
                                        <p className="text-xs text-orange-600 mt-1">มีการจองแต่ยังไม่ได้ยืนยันเป็นผู้เช่า</p>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                     {(canEdit || canDelete) && (
                                       <Button 
                                         variant="outline" 
                                         size="sm"
                                         onClick={() => {
                                           setEditingBooking(displayBooking);
                                           setShowEditBookingDialog(true);
                                         }}
                                         className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                                       >
                                         <Edit2 className="w-4 h-4 mr-1" />
                                         แก้ไข
                                       </Button>
                                     )}
                                     {!hasCheckedIn && (canEdit || canDelete) && (
                                       <Button 
                                         variant="outline" 
                                         size="sm"
                                         onClick={async () => {
                                            const today = new Date().toISOString().split('T')[0];
                                            const isTemp = temporaryBookings.some(b => b.id === displayBooking.id);
                                            
                                            if (isDaily && isTemp) {
                                              // สำหรับรายวัน: สร้าง Booking จริง + เปลี่ยนห้องเป็น occupied
                                              try {
                                                const tempBooking = temporaryBookings.find(b => b.id === displayBooking.id);
                                                
                                                // 1. สร้าง Booking จริง (ไม่มี tenant_id)
                                                await base44.entities.Booking.create({
                                                  branch_id: selectedBranchId,
                                                  room_id: tempBooking.room_id,
                                                  guest_name: tempBooking.guest_name,
                                                  guest_phone: tempBooking.guest_phone,
                                                  guest_email: tempBooking.guest_email,
                                                  guest_national_id: tempBooking.guest_national_id,
                                                  guest_address: tempBooking.guest_address,
                                                  check_in_date: tempBooking.check_in_date,
                                                  actual_check_in_date: today,
                                                  check_out_date: tempBooking.check_out_date,
                                                  booking_type: 'daily',
                                                  status: 'active',
                                                  deposit_amount: tempBooking.deposit_amount,
                                                  security_deposit: tempBooking.security_deposit,
                                                  total_booking_amount: tempBooking.total_booking_amount,
                                                  remaining_amount: tempBooking.remaining_amount,
                                                  deposit_payment_method: tempBooking.deposit_payment_method,
                                                  deposit_slip_url: tempBooking.deposit_slip_url,
                                                  notes: tempBooking.notes
                                                });
                                                
                                                // 2. เปลี่ยนห้องเป็น occupied
                                                await base44.entities.Room.update(selectedRoom.id, { status: 'occupied' });
                                                
                                                // 3. ลบ TemporaryBooking เก่า
                                                await base44.entities.TemporaryBooking.delete(tempBooking.id);
                                                
                                                queryClient.invalidateQueries(['bookings']);
                                                queryClient.invalidateQueries(['temporaryBookings']);
                                                queryClient.invalidateQueries(['rooms']);
                                                toast.success('ยืนยันเข้าพักสำเร็จ - ห้องเปลี่ยนเป็นมีผู้เข้าพักแล้ว');
                                              } catch (err) {
                                                toast.error('เกิดข้อผิดพลาด: ' + err.message);
                                              }
                                            } else {
                                              // สำหรับรายเดือนหรือ Booking ปกติ: แค่อัพเดท actual_check_in_date
                                              const updatePromise = isTemp
                                                ? base44.entities.TemporaryBooking.update(displayBooking.id, { actual_check_in_date: today })
                                                : base44.entities.Booking.update(displayBooking.id, { actual_check_in_date: today });
                                              
                                              updatePromise.then(() => {
                                                queryClient.invalidateQueries(['bookings']);
                                                queryClient.invalidateQueries(['temporaryBookings']);
                                                toast.success('ยืนยันเข้าพักสำเร็จ');
                                              }).catch(err => {
                                                toast.error('เกิดข้อผิดพลาด: ' + err.message);
                                              });
                                            }
                                          }}
                                          className="bg-green-600 text-white border-green-600 hover:bg-green-700"
                                        >
                                          <Check className="w-4 h-4 mr-1" />
                                          ยืนยันเข้าพัก
                                        </Button>
                                      )}
                                      {hasCheckedIn && isDaily && (canEdit || canDelete) && (
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={async () => {
                                            if (confirm(`ยืนยันการเช็คเอาท์?\nห้อง ${selectedRoom.room_number} จะถูกเปลี่ยนเป็นสถานะ "ว่าง"`)) {
                                              const isTemp = temporaryBookings.some(b => b.id === displayBooking.id);
                                              
                                              const updatePromise = isTemp
                                                ? base44.entities.TemporaryBooking.update(displayBooking.id, { status: 'completed' })
                                                : base44.entities.Booking.update(displayBooking.id, { status: 'completed' });
                                              
                                              updatePromise.then(async () => {
                                                await base44.entities.Room.update(selectedRoom.id, { status: 'available' });
                                                queryClient.invalidateQueries(['bookings']);
                                                queryClient.invalidateQueries(['temporaryBookings']);
                                                queryClient.invalidateQueries(['rooms']);
                                                setShowDetailDialog(false);
                                                toast.success('เช็คเอาท์สำเร็จ');
                                              }).catch(err => {
                                                toast.error('เกิดข้อผิดพลาด: ' + err.message);
                                              });
                                            }
                                          }}
                                          className="bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
                                        >
                                          <LogOut className="w-4 h-4 mr-1" />
                                          เช็คเอาท์
                                        </Button>
                                      )}
                                      {(canEdit || canDelete) && (
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          onClick={async () => {
                                            if (!confirm(`ยืนยันการยกเลิกการจอง?\nห้อง ${selectedRoom.room_number} จะถูกเปลี่ยนเป็นสถานะ "ว่าง"`)) return;
                                            try {
                                              const isTemp = temporaryBookings.some(b => b.id === displayBooking.id);
                                              if (isTemp) await base44.entities.TemporaryBooking.delete(displayBooking.id);
                                              else await base44.entities.Booking.update(displayBooking.id, { status: 'cancelled' });
                                              await base44.entities.Room.update(selectedRoom.id, { status: 'available' });
                                              await queryClient.invalidateQueries(['bookings']);
                                              await queryClient.invalidateQueries(['temporaryBookings']);
                                              await queryClient.invalidateQueries(['rooms']);
                                              await queryClient.refetchQueries(['rooms', selectedBranchId, 'v2']);
                                              setShowDetailDialog(false);
                                              toast.success('ยกเลิกการจองสำเร็จ (เปลี่ยนสถานะห้องเป็นว่างแล้ว)');
                                            } catch (err) {
                                              toast.error('เกิดข้อผิดพลาด: ' + err.message);
                                            }
                                          }}
                                          className="bg-red-600 text-white border-red-600 hover:bg-red-700"
                                        >
                                          <Trash2 className="w-4 h-4 mr-1" />
                                          ยกเลิก
                                        </Button>
                                      )}
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-3 text-sm">
                                   <div>
                                     <Badge className="bg-slate-600 text-white">
                                       {displayBooking.booking_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}
                                     </Badge>
                                   </div>
                                   <div>
                                     <Badge className={hasCheckedIn ? 'bg-green-600' : 'bg-slate-600'}>
                                       {hasCheckedIn ? 'เข้าพักแล้ว' : displayBooking.status}
                                     </Badge>
                                   </div>
                                    {displayBooking.guest_name && (
                                      <div className="col-span-2">
                                        <Label className="text-slate-600">
                                          {isDaily ? 'ชื่อผู้เข้าพัก' : 'ชื่อผู้เข้าพัก (ยังไม่ได้ยืนยัน)'}
                                        </Label>
                                        <p className="font-semibold text-slate-800">{displayBooking.guest_name}</p>
                                      </div>
                                    )}
                                    {displayBooking.guest_phone && (
                                      <div>
                                        <Label className="text-slate-600">เบอร์ติดต่อ</Label>
                                        <p className="font-semibold text-slate-800">{displayBooking.guest_phone}</p>
                                      </div>
                                    )}
                                    {displayBooking.guest_email && (
                                      <div>
                                        <Label className="text-slate-600">อีเมล</Label>
                                        <p className="font-semibold text-slate-800">{displayBooking.guest_email}</p>
                                      </div>
                                    )}
                                    {displayBooking.check_in_date && (
                                      <div>
                                        <Label className="text-slate-600">วันเช็คอิน</Label>
                                        <p className="font-semibold text-slate-800">
                                          {(() => { try { const d = parseISO(displayBooking.check_in_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })()}
                                        </p>
                                      </div>
                                    )}
                                    {displayBooking.actual_check_in_date && (
                                      <div>
                                        <Label className="text-slate-600">เข้าพักจริง</Label>
                                        <p className="font-semibold text-green-700">
                                          {(() => { try { const d = parseISO(displayBooking.actual_check_in_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })()}
                                        </p>
                                      </div>
                                    )}
                                    {displayBooking.check_out_date && (
                                      <div>
                                        <Label className="text-slate-600">วันเช็คเอาท์</Label>
                                        <p className="font-semibold text-slate-800">
                                          {(() => { try { const d = parseISO(displayBooking.check_out_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })()}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          }

                          if (tenant && booking) {
                            return (
                              <div className="space-y-4">
                                {/* ข้อมูลผู้เช่า */}
                                <Card className="bg-blue-50 border-blue-200">
                                  <CardContent className="p-4 space-y-3">
                                    <div className="flex justify-between items-start">
                                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <User className="w-5 h-5" />
                                        ข้อมูลผู้เช่า
                                      </h3>
                                      <div className="flex flex-col gap-2 items-end">
                                        {isContractExpiringSoon(booking) && (
                                          <Button onClick={() => { setRenewBooking(booking); setShowRenewDialog(true); }} className="bg-green-600 hover:bg-green-700 text-white" size="sm">
                                            <FileText className="w-4 h-4 mr-2" /> ต่อสัญญา
                                          </Button>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => { if (confirm(`ยืนยันการย้ายออก ${tenant.full_name} จากห้อง ${selectedRoom.room_number}?`)) { moveOutMutation.mutate(selectedRoom); } }} disabled={moveOutMutation.isPending} className="text-orange-600 border-orange-300 hover:bg-orange-50">
                                          {moveOutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                                          <span className="ml-2">ย้ายออก</span>
                                        </Button>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                      <div><Label className="text-slate-600">ชื่อ-นามสกุล</Label><Link to={`${createPageUrl('Tenants')}?search=${encodeURIComponent(tenant.full_name)}`} onClick={() => setShowDetailDialog(false)} className="font-semibold text-blue-600 hover:underline">{tenant.full_name}</Link></div>
                                      <div><Label className="text-slate-600">เบอร์โทร</Label><p className="font-semibold flex items-center gap-1"><Phone className="w-3 h-3" />{tenant.phone || '-'}</p></div>
                                      {tenant.line_id && <div><Label className="text-slate-600">LINE ID</Label><p className="font-semibold">{tenant.line_id}</p></div>}
                                      {tenant.email && <div><Label className="text-slate-600">อีเมล</Label><p className="font-semibold">{tenant.email}</p></div>}
                                      {tenant.national_id && <div><Label className="text-slate-600">เลขบัตรประชาชน</Label><p className="font-semibold">{tenant.national_id}</p></div>}
                                      {booking.check_in_date && <div><Label className="text-slate-600">วันเข้าพัก</Label><p className="font-semibold flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{(() => { try { const d = parseISO(booking.check_in_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })()}</p></div>}
                                      {booking.check_out_date && <div className="col-span-2"><Label className="text-slate-600">วันสิ้นสุดสัญญา</Label><div className="flex items-center gap-2"><p className="font-semibold flex items-center gap-1"><CalendarIcon className="w-3 h-3" />{(() => { try { const d = parseISO(booking.check_out_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })()}</p>{daysLeft !== null && daysLeft >= 0 && daysLeft <= 30 && (<Badge className="bg-red-500 text-white"><AlertTriangle className="w-3 h-3 mr-1" />เหลือ {daysLeft} วัน</Badge>)}</div></div>}
                                    </div>
                                  </CardContent>
                                </Card>

                              </div>
                            );
                          }

                          return (
                            <Card className="bg-slate-50 border-slate-200">
                                <CardContent className="p-6 text-center space-y-4">
                                    <User className="w-12 h-12 text-slate-400 mx-auto" />
                                    <p className="text-slate-600">ห้องนี้ยังไม่มีผู้เช่า</p>
                                    <div className="flex flex-col gap-2">
                                      <Button onClick={() => { handleReserve(selectedRoom); setShowDetailDialog(false); }} className="bg-purple-600 hover:bg-purple-700 text-white">
                                        <CalendarIcon className="w-4 h-4 mr-2" /> จองห้อง
                                      </Button>
                                      <Button 
                                        onClick={() => { 
                                          setConnectingRoom(selectedRoom);
                                          setShowConnectTenantDialog(true);
                                        }} 
                                        variant="outline" 
                                        className="border-blue-600 text-blue-600 hover:bg-blue-50"
                                      >
                                        <User className="w-4 h-4 mr-2" /> เชื่อมต่อผู้เช่า
                                      </Button>
                                    </div>
                                </CardContent>
                            </Card>
                          );
                        })()}
                      </TabsContent>

                      <TabsContent value="payment-history" className="pt-4">
                        <Card className="bg-green-50 border-green-200">
                          <CardContent className="p-4 space-y-3">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                              <DollarSign className="w-5 h-5 text-green-600" />
                              ประวัติการชำระเงิน
                            </h3>
                            {recentPayments.length > 0 ? (
                              <div className="space-y-2 max-h-96 overflow-y-auto p-1">
                                {recentPayments.map((payment) => (
                                  <div key={payment.id} className="bg-white rounded-lg p-3 border border-green-200 shadow-sm">
                                    <div className="flex justify-between items-center text-sm">
                                      <span className="font-semibold text-slate-700">
                                        {(() => { try { const d = parseISO(payment.payment_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })()}
                                      </span>
                                      <span className="font-bold text-green-700">
                                        {payment.total_amount?.toLocaleString()} ฿
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">ครบกำหนด: {(() => { try { const d = parseISO(payment.due_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })()}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-center text-slate-500 py-8">ไม่มีประวัติการชำระเงิน</p>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="meter-history" className="pt-4">
                        <Card className="bg-purple-50 border-purple-200">
                          <CardContent className="p-4 space-y-3">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                              <Gauge className="w-5 h-5 text-purple-600" />
                              ประวัติมิเตอร์
                            </h3>
                            {meterHistory.length > 0 ? (
                              <div className="space-y-2 max-h-96 overflow-y-auto p-1">
                                {meterHistory.map((reading) => (
                                  <div key={reading.id} className="bg-white rounded-lg p-3 border border-purple-200 shadow-sm">
                                    <div className="flex justify-between items-center text-sm mb-2">
                                       <span className="font-semibold text-slate-700">
                                        {(() => { try { const d = parseISO(reading.reading_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMMM yyyy', { locale: th }); } catch { return '-'; } })()}
                                       </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <p>💧 ค่าน้ำ: <span className="font-semibold text-blue-700">{reading.water_units || 0}</span> หน่วย</p>
                                        <p>⚡️ ค่าไฟ: <span className="font-semibold text-orange-700">{reading.electricity_units || 0}</span> หน่วย</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-center text-slate-500 py-8">ไม่มีประวัติการจดมิเตอร์</p>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>

                      <TabsContent value="maintenance-history" className="pt-4">
                        <Card className="bg-orange-50 border-orange-200">
                          <CardContent className="p-4 space-y-3">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                              <Wrench className="w-5 h-5 text-orange-600" />
                              ประวัติการซ่อม ({maintenanceHistory.length} รายการ)
                            </h3>
                            {maintenanceHistory.length > 0 ? (
                              <>
                                <div className="space-y-2 max-h-96 overflow-y-auto p-1">
                                  {(() => {
                                    const itemsPerPage = 10;
                                    const startIdx = (maintenanceHistoryPage - 1) * itemsPerPage;
                                    const paginatedItems = maintenanceHistory.slice(startIdx, startIdx + itemsPerPage);
                                    return paginatedItems.map((request) => (
                                      <div key={request.id} className="bg-white rounded-lg p-3 border border-orange-200 shadow-sm">
                                        <div className="flex justify-between items-start mb-2">
                                          <div>
                                            <p className="font-semibold text-slate-800">{request.title}</p>
                                            <p className="text-xs text-slate-500 mt-1">
                                              {(() => { try { const d = parseISO(request.created_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })()}
                                            </p>
                                          </div>
                                          <Badge className={`text-xs flex-shrink-0 ${
                                            request.status === 'completed' ? 'bg-green-100 text-green-800' :
                                            request.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                                            request.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                            'bg-yellow-100 text-yellow-800'
                                          }`}>
                                            {request.status === 'completed' ? 'เสร็จแล้ว' :
                                             request.status === 'in_progress' ? 'กำลังซ่อม' :
                                             request.status === 'cancelled' ? 'ยกเลิก' :
                                             'รอดำเนินการ'}
                                          </Badge>
                                        </div>
                                        {request.description && (
                                          <p className="text-sm text-slate-700 mb-2">{request.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-2 text-xs">
                                          <Badge variant="outline" className="bg-gray-50">
                                            {request.category}
                                          </Badge>
                                          {request.priority && (
                                            <Badge variant="outline" className={
                                              request.priority === 'urgent' ? 'bg-red-50 border-red-200' :
                                              request.priority === 'high' ? 'bg-orange-50 border-orange-200' :
                                              request.priority === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                                              'bg-blue-50 border-blue-200'
                                            }>
                                              {request.priority === 'urgent' ? '🔴 ด่วนมาก' :
                                               request.priority === 'high' ? '🟠 สำคัญ' :
                                               request.priority === 'medium' ? '🟡 ปกติ' :
                                               '🔵 ต่ำ'}
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    ));
                                  })()}
                                </div>
                                {maintenanceHistory.length > 10 && (
                                  <div className="flex items-center justify-between pt-3 border-t border-orange-200 text-xs">
                                    <span className="text-slate-600">
                                      หน้า {maintenanceHistoryPage} จาก {Math.ceil(maintenanceHistory.length / 10)}
                                    </span>
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setMaintenanceHistoryPage(prev => Math.max(1, prev - 1))}
                                        disabled={maintenanceHistoryPage === 1}
                                        className="h-7"
                                      >
                                        ก่อนหน้า
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => setMaintenanceHistoryPage(prev => Math.min(Math.ceil(maintenanceHistory.length / 10), prev + 1))}
                                        disabled={maintenanceHistoryPage === Math.ceil(maintenanceHistory.length / 10)}
                                        className="h-7"
                                      >
                                        ถัดไป
                                      </Button>
                                    </div>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="text-center text-slate-500 py-8">ไม่มีประวัติการซ่อม</p>
                            )}
                          </CardContent>
                        </Card>
                      </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-2 pt-4 border-t">
                       <Button variant="outline" onClick={() => setShowDetailDialog(false)}>ปิด</Button>
                       {canEdit && (
                        <Button
                          onClick={() => {
                            handleEdit(selectedRoom);
                            setShowDetailDialog(false);
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          แก้ไขห้อง
                        </Button>
                       )}
                    </div>
                  </div>
                )
              })()}
            </DialogContent>
          </Dialog>

          <RoomImportDialog
            open={showUploadDialog}
            onOpenChange={setShowUploadDialog}
            selectedBranchId={selectedBranchId}
            onSuccess={() => {
              queryClient.invalidateQueries(['rooms', selectedBranchId, 'v2']);
              queryClient.invalidateQueries(['allRooms', 'v2']);
              setShowUploadDialog(false);
              toast.success('นำเข้าข้อมูลห้องพักสำเร็จ!');
            }}
          />

          <Dialog open={showReservationDialog} onOpenChange={(open) => {
            setShowReservationDialog(open);
            if (!open) setReservingRoom(null);
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
              <DialogHeader>
                <DialogTitle>จองห้อง {reservingRoom?.room_number}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => {
                e.preventDefault();
                
                const depositAmount = formData.deposit_amount ? parseFloat(formData.deposit_amount) : 0;
                const securityDeposit = formData.security_deposit ? parseFloat(formData.security_deposit) : 0;
                const advanceRent = formData.advance_rent ? parseFloat(formData.advance_rent) : 0;
                const commonFeeIncluded = formData.common_fee_included ? parseFloat(formData.common_fee_included) : 0;
                const totalBookingAmount = depositAmount + securityDeposit + advanceRent + commonFeeIncluded;
                const remainingAmount = securityDeposit + advanceRent + commonFeeIncluded;
                
                const bookingNo = format(new Date(), 'dd-MM-yy');
                
                const data = {
                  room_id: formData.room_id,
                  guest_name: formData.guest_name,
                  guest_phone: formData.guest_phone,
                  guest_email: formData.guest_email,
                  guest_national_id: formData.guest_national_id,
                  guest_address: formData.guest_address,
                  check_in_date: formData.check_in_date,
                  check_out_date: formData.check_out_date,
                  contract_duration: formData.contract_duration,
                  booking_no: bookingNo,
                  deposit_amount: depositAmount,
                  security_deposit: securityDeposit,
                  advance_rent: advanceRent,
                  common_fee_included: commonFeeIncluded,
                  total_booking_amount: totalBookingAmount,
                  remaining_amount: remainingAmount,
                  contract_deadline: formData.contract_deadline,
                  deposit_payment_method: formData.deposit_payment_method,
                  deposit_slip_url: formData.deposit_slip_url,
                  notes: formData.notes
                };

                createBookingMutation.mutate(data);
              }} className="space-y-4">
                <div>
                  <Label className="mb-2 block">ประเภทการเช่า *</Label>
                  <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setDialogBookingType('daily')}
                      className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                        dialogBookingType === 'daily'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      รายวัน
                    </button>
                    <button
                      type="button"
                      onClick={() => setDialogBookingType('monthly')}
                      className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                        dialogBookingType === 'monthly'
                          ? 'bg-white text-blue-600 shadow-sm'
                          : 'text-slate-600 hover:text-slate-800'
                      }`}
                    >
                      รายเดือน
                    </button>
                  </div>
                </div>

                {/* ข้อมูลผู้จอง */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-blue-600" />
                    ข้อมูลผู้จอง
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>ชื่อผู้เข้าพัก *</Label>
                      <Input
                        value={formData.guest_name}
                        onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                        required
                        placeholder="ชื่อ-นามสกุล"
                        disabled={createBookingMutation.isPending}
                      />
                    </div>
                    <div>
                      <Label>เบอร์โทรศัพท์ *</Label>
                      <Input
                        value={formData.guest_phone}
                        onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                        required
                        placeholder="0812345678"
                        disabled={createBookingMutation.isPending}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mt-3">
                    <div>
                      <Label>เลขบัตรประชาชน</Label>
                      <Input
                        value={formData.guest_national_id}
                        onChange={(e) => setFormData({ ...formData, guest_national_id: e.target.value })}
                        placeholder="1234567890123"
                        maxLength={13}
                        disabled={createBookingMutation.isPending}
                      />
                    </div>
                    <div>
                      <Label>อีเมล</Label>
                      <Input
                        type="email"
                        value={formData.guest_email}
                        onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                        placeholder="email@example.com"
                        disabled={createBookingMutation.isPending}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <Label>ที่อยู่</Label>
                    <Input
                      value={formData.guest_address}
                      onChange={(e) => setFormData({ ...formData, guest_address: e.target.value })}
                      placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
                      disabled={createBookingMutation.isPending}
                    />
                  </div>
                </div>

                {/* วันที่พัก */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-blue-600" />
                    {dialogBookingType === 'daily' ? 'วันที่พัก' : 'วันที่และเงื่อนไขสัญญา'}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{dialogBookingType === 'daily' ? 'วันที่เข้าพัก' : 'วันที่จอง/เข้าพัก'} *</Label>
                      <Input
                        type="date"
                        value={formData.check_in_date}
                        onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                        required
                        disabled={createBookingMutation.isPending}
                      />
                    </div>
                    <div>
                      <Label>{dialogBookingType === 'daily' ? 'วันที่ออก *' : 'วันที่สิ้นสุด (ถ้ามี)'}</Label>
                      <Input
                        type="date"
                        value={formData.check_out_date}
                        onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                        required={dialogBookingType === 'daily'}
                        disabled={createBookingMutation.isPending}
                      />
                    </div>
                  </div>
                  {dialogBookingType === 'monthly' && (
                    <>
                      <div className="grid grid-cols-2 gap-4 mt-3">
                        <div>
                          <Label>ระยะเวลาสัญญา</Label>
                          <Select
                            value={formData.contract_duration}
                            onValueChange={(value) => setFormData({ ...formData, contract_duration: value })}
                            disabled={createBookingMutation.isPending}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="เลือกระยะเวลา" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1 เดือน">1 เดือน</SelectItem>
                              <SelectItem value="3 เดือน">3 เดือน</SelectItem>
                              <SelectItem value="6 เดือน">6 เดือน</SelectItem>
                              <SelectItem value="1 ปี">1 ปี</SelectItem>
                              <SelectItem value="2 ปี">2 ปี</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>กำหนดทำสัญญาภายในวันที่</Label>
                          <Input
                            type="date"
                            value={formData.contract_deadline}
                            onChange={(e) => setFormData({ ...formData, contract_deadline: e.target.value })}
                            disabled={createBookingMutation.isPending}
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">หากพ้นกำหนดนี้ถือว่าสละสิทธิ์</p>
                    </>
                  )}
                </div>

                {/* รายละเอียดการชำระเงิน */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-green-600" />
                    รายละเอียดการชำระเงิน
                  </h3>

                  <div className="space-y-3">
                    {dialogBookingType === 'daily' ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>เงินมัดจำ (บาท)</Label>
                            <Input
                              type="number"
                              value={formData.deposit_amount}
                              onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                              placeholder="500"
                              disabled={createBookingMutation.isPending}
                            />
                          </div>
                          <div>
                            <Label>ค่าใช้จ่ายทั้งหมด (บาท)</Label>
                            <Input
                              type="number"
                              value={formData.security_deposit}
                              onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })}
                              placeholder="3,000"
                              disabled={createBookingMutation.isPending}
                            />
                          </div>
                        </div>

                        {(formData.deposit_amount || formData.security_deposit) && (
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <h4 className="font-semibold text-blue-800 mb-2">สรุปยอดเงิน</h4>
                            <div className="space-y-1 text-sm">
                              {formData.security_deposit > 0 && (
                                <div className="flex justify-between">
                                  <span>ค่าใช้จ่ายทั้งหมด:</span>
                                  <span>{Number(formData.security_deposit).toLocaleString()} บาท</span>
                                </div>
                              )}
                              {formData.deposit_amount > 0 && (
                                <div className="flex justify-between text-green-700">
                                  <span>ชำระแล้ว (มัดจำ):</span>
                                  <span>-{Number(formData.deposit_amount).toLocaleString()} บาท</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold text-orange-600 border-t border-blue-300 pt-2 mt-2">
                                <span>💰 ยอดคงเหลือ (รอชำระ):</span>
                                <span>
                                  {Math.max(0, 
                                    Number(formData.security_deposit || 0) - Number(formData.deposit_amount || 0)
                                  ).toLocaleString()} บาท
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>เงินจองห้อง (บาท)</Label>
                            <Input
                              type="number"
                              value={formData.deposit_amount}
                              onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                              placeholder="2,000"
                              disabled={createBookingMutation.isPending}
                            />
                          </div>
                          <div>
                            <Label>เงินประกันห้อง (บาท)</Label>
                            <Input
                              type="number"
                              value={formData.security_deposit}
                              onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })}
                              placeholder="6,000"
                              disabled={createBookingMutation.isPending}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>ค่าเช่าล่วงหน้า (บาท)</Label>
                            <Input
                              type="number"
                              value={formData.advance_rent}
                              onChange={(e) => setFormData({ ...formData, advance_rent: e.target.value })}
                              placeholder="3,900"
                              disabled={createBookingMutation.isPending}
                            />
                          </div>
                          <div>
                            <Label>รวมส่วนกลาง (บาท)</Label>
                            <Input
                              type="number"
                              value={formData.common_fee_included}
                              onChange={(e) => setFormData({ ...formData, common_fee_included: e.target.value })}
                              placeholder="0"
                              disabled={createBookingMutation.isPending}
                            />
                          </div>
                        </div>

                        {(formData.deposit_amount || formData.security_deposit || formData.advance_rent) && (
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mt-3">
                            <h4 className="font-semibold text-blue-800 mb-2">สรุปยอดเงิน</h4>
                            <div className="space-y-1 text-sm">
                              {formData.deposit_amount > 0 && (
                                <div className="flex justify-between">
                                  <span>เงินจองห้อง:</span>
                                  <span>{Number(formData.deposit_amount).toLocaleString()} บาท</span>
                                </div>
                              )}
                              {formData.security_deposit > 0 && (
                                <div className="flex justify-between">
                                  <span>เงินประกันห้อง:</span>
                                  <span>{Number(formData.security_deposit).toLocaleString()} บาท</span>
                                </div>
                              )}
                              {formData.advance_rent > 0 && (
                                <div className="flex justify-between">
                                  <span>ค่าเช่าล่วงหน้า:</span>
                                  <span>{Number(formData.advance_rent).toLocaleString()} บาท</span>
                                </div>
                              )}
                              {formData.common_fee_included > 0 && (
                                <div className="flex justify-between">
                                  <span>รวมส่วนกลาง:</span>
                                  <span>{Number(formData.common_fee_included).toLocaleString()} บาท</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold text-blue-800 border-t border-blue-300 pt-2 mt-2">
                                <span>รวมสุทธิ:</span>
                                <span>
                                  {(
                                    Number(formData.deposit_amount || 0) +
                                    Number(formData.security_deposit || 0) +
                                    Number(formData.advance_rent || 0) +
                                    Number(formData.common_fee_included || 0)
                                  ).toLocaleString()} บาท
                                </span>
                              </div>
                              <div className="flex justify-between text-green-700 font-semibold">
                                <span>* คงเหลือชำระทีหลัง:</span>
                                <span>
                                  {(
                                    Number(formData.security_deposit || 0) +
                                    Number(formData.advance_rent || 0) +
                                    Number(formData.common_fee_included || 0)
                                  ).toLocaleString()} บาท
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div>
                      <Label>วิธีการชำระเงิน</Label>
                      <Select
                        value={formData.deposit_payment_method}
                        onValueChange={(value) => setFormData({ ...formData, deposit_payment_method: value })}
                        disabled={createBookingMutation.isPending}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">💵 เงินสด</SelectItem>
                          <SelectItem value="transfer">🏦 โอนเงิน</SelectItem>
                          <SelectItem value="qr_code">📱 QR Code</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {(formData.deposit_payment_method === 'transfer' || formData.deposit_payment_method === 'qr_code') && (
                      <div>
                        <Label>หลักฐานการโอน / สลิป</Label>
                        <div className="mt-2">
                          <label className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors">
                            <Upload className="w-5 h-5 text-slate-600" />
                            <span className="text-sm text-slate-600">
                              {uploadingImage ? 'กำลังอัปโหลด...' : 'คลิกเพื่ออัปโหลดสลิป'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleSlipUpload}
                              disabled={uploadingImage || createBookingMutation.isPending}
                              className="hidden"
                            />
                          </label>
                        </div>
                        {formData.deposit_slip_url && (
                          <div className="mt-3 relative">
                            <img
                              src={formData.deposit_slip_url}
                              alt="สลิปการโอนเงิน"
                              className="w-full max-w-xs h-48 object-cover rounded-lg border-2 border-slate-200"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-2"
                              onClick={() => setFormData({ ...formData, deposit_slip_url: '' })}
                              disabled={createBookingMutation.isPending}
                            >
                              ลบรูป
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label>หมายเหตุ</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    disabled={createBookingMutation.isPending}
                    placeholder="หมายเหตุเพิ่มเติม..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowReservationDialog(false)}
                    disabled={createBookingMutation.isPending}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-blue-600 to-indigo-600"
                    disabled={createBookingMutation.isPending}
                  >
                    {createBookingMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      'จองห้อง'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <BulkRoomGenerator 
            open={showBulkGenerator} 
            onOpenChange={setShowBulkGenerator}
            branchId={selectedBranchId}
            onSuccess={() => {
              queryClient.invalidateQueries(['rooms', selectedBranchId]);
              queryClient.invalidateQueries(['allRooms']);
            }}
          />

          <Dialog open={showBranchIdInfo} onOpenChange={setShowBranchIdInfo}>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle className="text-2xl">🏢 ข้อมูล Branch ID ของสาขานี้</DialogTitle>
              </DialogHeader>

              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 shadow-xl">
                  <CardContent className="p-8">
                    <div className="space-y-6">
                      <div className="bg-white rounded-xl p-6 border-2 border-blue-200 shadow-sm">
                        <Label className="text-blue-700 text-sm font-bold mb-3 block uppercase tracking-wide">
                          📍 ชื่อสาขา
                        </Label>
                        <p className="text-3xl font-bold text-slate-900 mb-2">
                          {localStorage.getItem('selected_branch_name') || 'ไม่พบข้อมูลชื่อสาขา'}
                        </p>
                      </div>

                      <div className="bg-white rounded-xl p-6 border-2 border-green-300 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <Label className="text-green-700 text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                            🔑 Branch ID (รหัสเฉพาะสาขา)
                          </Label>
                          {selectedBranchId && (
                            <Badge className="bg-green-600 text-white">พร้อมใช้งาน</Badge>
                          )}
                        </div>

                        {selectedBranchId ? (
                          <div className="space-y-3">
                            <div className="bg-slate-100 rounded-lg p-4 border-2 border-slate-300">
                              <code className="text-xl font-mono font-bold text-slate-900 break-all block leading-relaxed">
                                {selectedBranchId}
                              </code>
                            </div>
                            <Button
                              onClick={() => copyToClipboard(selectedBranchId)}
                              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg shadow-lg"
                            >
                              📋 คัดลอก Branch ID
                            </Button>
                          </div>
                        ) : (
                          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 text-center">
                            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                            <p className="text-red-700 font-semibold mb-2">⚠️ ไม่พบ Branch ID</p>
                            <p className="text-red-600 text-sm">
                              กรุณาเลือกสาขาใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-yellow-50 border-2 border-yellow-300 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <AlertTriangle className="w-8 h-8 text-yellow-600 mt-1 shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-yellow-900 text-lg mb-3">📚 วิธีใช้ Branch ID:</p>
                        <ol className="list-decimal list-inside text-yellow-800 space-y-2 text-base">
                          <li>
                            <strong>Branch ID</strong> เป็นรหัสเฉพาะของสาขา (รหัสยาวๆ ตัวอย่างข้างบน)
                          </li>
                          <li>
                            <strong className="text-red-600">⚠️ อย่าสับสน!</strong> Branch Code (เช่น W93, BKK01) <strong className="text-red-600">≠ Branch ID</strong>
                          </li>
                          <li>
                            เมื่ออัปโหลด Excel ต้องใส่ <strong>Branch ID</strong> ในคอลัมน์ <code className="bg-yellow-200 px-2 py-1 rounded">branch_id</code>
                          </li>
                          <li>
                            คลิกปุ่ม <strong className="text-green-600">"📋 คัดลอก Branch ID"</strong> แล้วนำไปวางในไฟล์ CSV ของคุณ
                          </li>
                        </ol>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end pt-4 border-t-2 border-slate-200">
                  <Button
                    onClick={() => setShowBranchIdInfo(false)}
                    className="px-8 py-6 text-lg font-semibold bg-slate-700 hover:bg-slate-800"
                  >
                    ปิดหน้าต่าง
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={showBranchIdFixDialog} onOpenChange={setShowBranchIdFixDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>ห้องที่ยังไม่ได้ระบุสาขา</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-yellow-800 mb-1">พบห้องที่ยังไม่ได้ระบุสาขา</p>
                        <p className="text-sm text-yellow-700">
                          ห้องเหล่านี้จะไม่แสดงในระบบจนกว่าจะได้รับการกำหนดสาขา
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                  <h3 className="font-semibold mb-3">รายการห้อง ({roomsWithoutBranch.length} ห้อง)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {roomsWithoutBranch.map(room => (
                      <Card key={room.id} className="p-2 text-center">
                        <p className="font-bold text-slate-800">ห้อง {room.room_number}</p>
                        <p className="text-xs text-slate-500">ชั้น {room.floor}</p>
                        <p className="text-xs text-green-600">{room.price?.toLocaleString()} ฿</p>
                      </Card>
                    ))}
                  </div>
                </div>

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-blue-900 mb-3">สาขาปัจจุบัน:</h3>
                    <p className="text-lg text-slate-800 mb-2">{localStorage.getItem('selected_branch_name')}</p>

                    <div className="bg-white rounded-lg p-3 border border-blue-300 mt-3">
                      <Label className="text-xs text-slate-600 mb-1 block">Branch ID:</Label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-sm font-mono text-slate-800 break-all">
                          {selectedBranchId}
                        </code>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(selectedBranchId)}
                          className="shrink-0"
                        >
                          คัดลอก
                        </Button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 mt-3">
                      💡 <strong>คำแนะนำ:</strong> คลิก "กำหนดสาขาให้ห้องทั้งหมด" ด้านล่างเพื่ออัปเดต branch_id ให้ห้องทั้ง {roomsWithoutBranch.length} ห้องอัตโนมัติ
                    </p>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowBranchIdFixDialog(false)}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    onClick={handleFixBranchIds}
                    disabled={updateRoomsBranchMutation.isPending || !selectedBranchId}
                    className="bg-gradient-to-r from-green-600 to-emerald-600"
                  >
                    {updateRoomsBranchMutation.isPending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        กำลังอัปเดต...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        กำหนดสาขาให้ห้องทั้งหมด ({roomsWithoutBranch.length})
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Floating Bulk AI Action Bar */}
          <AnimatePresence>
            {selectedRooms.length > 0 && (
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
                          <p className="font-bold text-slate-800 text-sm md:text-base">เลือกแล้ว {selectedRooms.length} ห้อง</p>
                          <p className="text-xs text-slate-500 hidden md:block">จัดการหลายห้องพร้อมกันด้วย AI</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={toggleSelectAllInPage}
                          className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 text-xs flex-1 md:flex-initial"
                          disabled={displayedRooms.length === 0}
                          data-selection-control
                        >
                          <CheckSquare className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1" />
                          <span className="hidden md:inline">เลือกทั้งหมด ({displayedRooms.length})</span>
                          <span className="md:hidden">ทั้งหมด</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => {
                            setSelectedRooms([]);
                            setIsSelectionMode(false);
                          }}
                          className="text-slate-600 hover:bg-slate-50 text-xs flex-1 md:flex-initial"
                          data-selection-control
                        >
                          <X className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1" />
                          <span className="hidden md:inline">ยกเลิก</span>
                        </Button>
                      </div>
                    </div>

                    {!bulkAIResult ? (
                      <div className="flex flex-col gap-3">
                        <Button
                          onClick={() => setShowBulkEditDialog(true)}
                          className="w-full bg-slate-600 hover:bg-slate-700 text-white py-4 font-medium"
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          แก้ไขข้อมูล {selectedRooms.length} ห้อง
                        </Button>

                        <div className="flex items-center gap-2">
                          <div className="h-px flex-1 bg-slate-200" />
                          <span className="text-xs text-slate-500">หรือ</span>
                          <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input 
                              placeholder="ใช้ AI... (เช่น ลบห้องทั้งหมด, แก้ราคาเป็น 4500)" 
                              value={bulkAIQuery}
                              onChange={e => setBulkAIQuery(e.target.value)}
                              onKeyDown={e => e.key === 'Enter' && handleBulkAIRequest()}
                              className="pl-10 bg-white border-slate-300"
                            />
                          </div>
                          <Button 
                            onClick={handleBulkAIRequest} 
                            disabled={aiSearching || !bulkAIQuery.trim()}
                            className="bg-slate-600 hover:bg-slate-700 text-white px-5"
                          >
                            {aiSearching ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
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
                            
                            {bulkAIResult.action === 'update' && bulkAIResult.changes && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                {Object.entries(bulkAIResult.changes).map(([key, value]) => (
                                  <Badge key={key} variant="outline" className="bg-white">
                                    {key}: {String(value)}
                                  </Badge>
                                ))}
                              </div>
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
                                <Check className="w-4 h-4 mr-2" />
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
        </div>
      </div>

      <Dialog open={showRenewDialog} onOpenChange={setShowRenewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              ต่อสัญญาเช่า
            </DialogTitle>
          </DialogHeader>
          {renewBooking && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 p-4 rounded-lg space-y-2 border">
                <p className="text-sm"><span className="text-slate-600">ห้อง:</span> <span className="font-semibold">{selectedRoom?.room_number}</span></p>
                <p className="text-sm"><span className="text-slate-600">ผู้เช่า:</span> <span className="font-semibold">{getTenantInfo(renewBooking.tenant_id)?.full_name}</span></p>
                <p className="text-sm"><span className="text-slate-600">วันหมดอายุเดิม:</span> <span className="font-semibold">{(() => { try { const d = parseISO(renewBooking.check_out_date); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })()}</span></p>
              </div>

              <div>
                <Label htmlFor="renewMonths" className="block text-sm font-medium text-slate-700 mb-2">
                  ระยะเวลาต่อสัญญา (เดือน)
                </Label>
                <Input
                  id="renewMonths"
                  type="number"
                  value={renewMonths}
                  onChange={(e) => setRenewMonths(parseInt(e.target.value) || 1)}
                  onWheel={(e) => e.target.blur()}
                  min="1"
                  className="w-full"
                />
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm text-green-800"><span className="text-slate-600">วันหมดอายุใหม่:</span> <span className="font-bold">{format(addMonths(parseISO(renewBooking.check_out_date), renewMonths), 'd MMM yyyy', { locale: th })}</span></p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRenewDialog(false)}>ยกเลิก</Button>
            <Button
              onClick={() => renewBookingMutation.mutate({ booking: renewBooking, months: renewMonths })}
              disabled={renewBookingMutation.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {renewBookingMutation.isPending ? 'กำลังต่อสัญญา...' : 'ยืนยันการต่อสัญญา'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showConnectTenantDialog} onOpenChange={setShowConnectTenantDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              เชื่อมต่อผู้เช่ากับห้อง {connectingRoom?.room_number}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-2 block">เลือกผู้เช่า *</Label>
              <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกผู้เช่าจากระบบ" />
                </SelectTrigger>
                <SelectContent>
                  {tenants
                    .filter(t => t.status === 'active')
                    .map(tenant => {
                      // เช็คว่าผู้เช่ามีห้องหรือยัง
                      const activeBooking = bookings.find(b => 
                        b.tenant_id === tenant.id && 
                        b.status === 'active'
                      );
                      const room = activeBooking ? rooms.find(r => r.id === activeBooking.room_id) : null;
                      
                      return (
                        <SelectItem 
                          key={tenant.id} 
                          value={tenant.id}
                          disabled={!!activeBooking}
                        >
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span>{tenant.full_name} - {tenant.phone}</span>
                            {activeBooking ? (
                              <Badge className="bg-orange-500 text-white text-xs ml-2 flex-shrink-0">
                                ห้อง {room?.room_number || 'N/A'}
                              </Badge>
                            ) : (
                              <Badge className="bg-green-500 text-white text-xs ml-2 flex-shrink-0">
                                ว่าง
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                ✅ ว่าง = เลือกได้ | 🔒 มีห้องแล้ว = เลือกไม่ได้
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>วันเข้าพัก *</Label>
                <Input
                  type="date"
                  value={connectCheckInDate}
                  onChange={(e) => setConnectCheckInDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>วันสิ้นสุดสัญญา *</Label>
                <Input
                  type="date"
                  value={connectCheckOutDate}
                  onChange={(e) => setConnectCheckOutDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {selectedTenantId && connectCheckInDate && connectCheckOutDate && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">สรุป:</h4>
                  <div className="space-y-1 text-sm">
                    <p><span className="text-slate-600">ผู้เช่า:</span> <span className="font-semibold">{tenants.find(t => t.id === selectedTenantId)?.full_name}</span></p>
                    <p><span className="text-slate-600">ห้อง:</span> <span className="font-semibold">{connectingRoom?.room_number} (ชั้น {connectingRoom?.floor})</span></p>
                    <p><span className="text-slate-600">ราคา:</span> <span className="font-semibold">{connectingRoom?.price?.toLocaleString()} บาท/{connectingRoom?.room_type === 'monthly' ? 'เดือน' : 'วัน'}</span></p>
                    <p><span className="text-slate-600">ระยะเวลา:</span> <span className="font-semibold">
                      {(() => { try { const d = parseISO(connectCheckInDate); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })()} - {(() => { try { const d = parseISO(connectCheckOutDate); return isNaN(d.getTime()) ? '-' : format(d, 'd MMM yyyy', { locale: th }); } catch { return '-'; } })()}
                    </span></p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowConnectTenantDialog(false);
                setSelectedTenantId('');
                setConnectCheckInDate('');
                setConnectCheckOutDate('');
              }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={() => {
                if (!selectedTenantId || !connectCheckInDate || !connectCheckOutDate) {
                  toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
                  return;
                }
                connectTenantMutation.mutate({
                  roomId: connectingRoom.id,
                  tenantId: selectedTenantId,
                  checkInDate: connectCheckInDate,
                  checkOutDate: connectCheckOutDate
                });
              }}
              disabled={connectTenantMutation.isPending || !selectedTenantId || !connectCheckInDate || !connectCheckOutDate}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {connectTenantMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังเชื่อมต่อ...
                </>
              ) : (
                'ยืนยันการเชื่อมต่อ'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkEditDialog} onOpenChange={setShowBulkEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              {selectedRooms.length > 0 ? `แก้ไขข้อมูล ${selectedRooms.length} ห้องพร้อมกัน` : 'แก้ไขข้อมูลหลายห้อง'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={(e) => {
            e.preventDefault();
            
            if (!bulkEditData.field) {
              toast.error('กรุณาเลือกข้อมูลที่ต้องการแก้ไข');
              return;
            }

            const updates = {};
            
            if (bulkEditData.field === 'flat_rate_water') {
              updates.is_flat_rate_water = true;
              updates.flat_rate_water_amount = parseFloat(bulkEditData.flatRateAmount);
            } else if (bulkEditData.field === 'flat_rate_electricity') {
              updates.is_flat_rate_electricity = true;
              updates.flat_rate_electricity_amount = parseFloat(bulkEditData.flatRateAmount);
            } else if (bulkEditData.field === 'disable_flat_rate_water') {
              updates.is_flat_rate_water = false;
              updates.flat_rate_water_amount = null;
            } else if (bulkEditData.field === 'disable_flat_rate_electricity') {
              updates.is_flat_rate_electricity = false;
              updates.flat_rate_electricity_amount = null;
            } else {
              updates[bulkEditData.field] = 
                ['price', 'water_rate', 'electricity_rate', 'common_fee'].includes(bulkEditData.field)
                  ? parseFloat(bulkEditData.value)
                  : bulkEditData.value;
            }

            if (confirm(`ยืนยันแก้ไข ${selectedRooms.length} ห้อง?`)) {
              bulkUpdateMutation.mutate({ roomIds: selectedRooms, updates });
              setShowBulkEditDialog(false);
              setBulkEditData({ field: '', value: '', isFlatRate: false, flatRateAmount: '' });
            }
          }} className="space-y-4 py-4">
            <div>
              <Label className="mb-2 block font-semibold">เลือกข้อมูลที่ต้องการแก้ไข</Label>
              <Select 
                value={bulkEditData.field} 
                onValueChange={(value) => setBulkEditData({ ...bulkEditData, field: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="เลือกรายการ..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">💰 ราคาห้อง</SelectItem>
                  <SelectItem value="status">🚪 สถานะห้อง</SelectItem>
                  <SelectItem value="water_rate">💧 ค่าน้ำต่อหน่วย</SelectItem>
                  <SelectItem value="electricity_rate">⚡ ค่าไฟต่อหน่วย</SelectItem>
                  <SelectItem value="common_fee">🏢 ค่าส่วนกลาง</SelectItem>
                  <SelectItem value="flat_rate_water">💧 ตั้งค่าน้ำเหมาจ่าย</SelectItem>
                  <SelectItem value="flat_rate_electricity">⚡ ตั้งค่าไฟเหมาจ่าย</SelectItem>
                  <SelectItem value="disable_flat_rate_water">❌ ปิดค่าน้ำเหมา (กลับเป็นคิดตามหน่วย)</SelectItem>
                  <SelectItem value="disable_flat_rate_electricity">❌ ปิดค่าไฟเหมา (กลับเป็นคิดตามหน่วย)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {bulkEditData.field && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                {bulkEditData.field === 'status' ? (
                  <div>
                    <Label className="mb-2 block">สถานะใหม่</Label>
                    <Select 
                      value={bulkEditData.value} 
                      onValueChange={(value) => setBulkEditData({ ...bulkEditData, value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกสถานะ..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">ว่าง</SelectItem>
                        <SelectItem value="occupied">มีผู้เช่า</SelectItem>
                        <SelectItem value="reserved">จอง</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : bulkEditData.field === 'flat_rate_water' || bulkEditData.field === 'flat_rate_electricity' ? (
                  <div>
                    <Label className="mb-2 block">
                      {bulkEditData.field === 'flat_rate_water' ? '💧 ค่าน้ำเหมาจ่าย (บาท/เดือน)' : '⚡ ค่าไฟเหมาจ่าย (บาท/เดือน)'}
                    </Label>
                    <Input
                      type="number"
                      placeholder="เช่น 100"
                      value={bulkEditData.flatRateAmount}
                      onChange={(e) => setBulkEditData({ ...bulkEditData, flatRateAmount: e.target.value })}
                      onWheel={(e) => e.target.blur()}
                      required
                    />
                    <p className="text-xs text-slate-500 mt-2">
                      ✅ เมื่อตั้งค่าเหมา จะไม่คิดตามหน่วยอีกต่อไป
                    </p>
                  </div>
                ) : bulkEditData.field === 'disable_flat_rate_water' || bulkEditData.field === 'disable_flat_rate_electricity' ? (
                  <div className="text-center py-4">
                    <p className="text-sm text-slate-600">
                      ⚠️ จะปิดการคิดค่าเหมา และกลับไปคิดตามหน่วยแทน
                    </p>
                  </div>
                ) : (
                  <div>
                    <Label className="mb-2 block">
                      {bulkEditData.field === 'price' ? 'ราคาใหม่ (บาท)' :
                       bulkEditData.field === 'water_rate' ? 'ค่าน้ำต่อหน่วย (บาท)' :
                       bulkEditData.field === 'electricity_rate' ? 'ค่าไฟต่อหน่วย (บาท)' :
                       bulkEditData.field === 'common_fee' ? 'ค่าส่วนกลาง (บาท)' :
                       'ค่าใหม่'}
                    </Label>
                    <Input
                      type="number"
                      placeholder="ใส่ตัวเลข..."
                      value={bulkEditData.value}
                      onChange={(e) => setBulkEditData({ ...bulkEditData, value: e.target.value })}
                      onWheel={(e) => e.target.blur()}
                      required
                    />
                  </div>
                )}

                <div className="mt-4 bg-white rounded-lg p-3 border">
                  <p className="text-xs font-semibold text-slate-700 mb-2">ห้องที่จะแก้ไข ({selectedRooms.length} ห้อง):</p>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {selectedRooms.slice(0, 20).map(roomId => {
                      const room = rooms.find(r => r.id === roomId);
                      return room ? (
                        <Badge key={roomId} variant="outline" className="bg-blue-50 text-blue-700">
                          {room.room_number}
                        </Badge>
                      ) : null;
                    })}
                    {selectedRooms.length > 20 && (
                      <Badge variant="outline" className="bg-slate-50">
                        +{selectedRooms.length - 20} ห้อง
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowBulkEditDialog(false);
                  setBulkEditData({ field: '', value: '', isFlatRate: false, flatRateAmount: '' });
                }}
              >
                ยกเลิก
              </Button>
              <Button 
                type="submit"
                className="bg-green-600 hover:bg-green-700"
                disabled={
                  bulkUpdateMutation.isPending || 
                  !bulkEditData.field ||
                  (bulkEditData.field !== 'disable_flat_rate_water' && 
                   bulkEditData.field !== 'disable_flat_rate_electricity' &&
                   ((bulkEditData.field === 'flat_rate_water' || bulkEditData.field === 'flat_rate_electricity') 
                     ? !bulkEditData.flatRateAmount 
                     : !bulkEditData.value))
                }
              >
                {bulkUpdateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังอัปเดต...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    ยืนยันการแก้ไข
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditBookingDialog} onOpenChange={setShowEditBookingDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-600" />
              แก้ไขข้อมูลการเข้าพัก
            </DialogTitle>
          </DialogHeader>

          {editingBooking && (
            <form onSubmit={(e) => {
              e.preventDefault();
              
              const isTemp = temporaryBookings.some(b => b.id === editingBooking.id);
              
              const data = {
                guest_name: formData.guest_name,
                guest_phone: formData.guest_phone,
                guest_email: formData.guest_email,
                guest_national_id: formData.guest_national_id,
                guest_address: formData.guest_address,
                check_in_date: formData.check_in_date,
                check_out_date: formData.check_out_date,
                notes: formData.notes
              };

              updateBookingMutation.mutate({
                bookingId: editingBooking.id,
                data,
                isTemp
              });
            }} className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4 border">
                <p className="text-sm text-slate-600">ห้อง:</p>
                <p className="text-xl font-bold text-slate-800">
                  {rooms.find(r => r.id === editingBooking.room_id)?.room_number}
                </p>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  ข้อมูลผู้เข้าพัก
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ชื่อผู้เข้าพัก *</Label>
                    <Input
                      value={formData.guest_name}
                      onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                      required
                      placeholder="ชื่อ-นามสกุล"
                      disabled={updateBookingMutation.isPending}
                    />
                  </div>
                  <div>
                    <Label>เบอร์โทรศัพท์ *</Label>
                    <Input
                      value={formData.guest_phone}
                      onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                      required
                      placeholder="0812345678"
                      disabled={updateBookingMutation.isPending}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label>เลขบัตรประชาชน</Label>
                    <Input
                      value={formData.guest_national_id}
                      onChange={(e) => setFormData({ ...formData, guest_national_id: e.target.value })}
                      placeholder="1234567890123"
                      maxLength={13}
                      disabled={updateBookingMutation.isPending}
                    />
                  </div>
                  <div>
                    <Label>อีเมล</Label>
                    <Input
                      type="email"
                      value={formData.guest_email}
                      onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                      placeholder="email@example.com"
                      disabled={updateBookingMutation.isPending}
                    />
                  </div>
                </div>
                
                <div className="mt-3">
                  <Label>ที่อยู่</Label>
                  <Input
                    value={formData.guest_address}
                    onChange={(e) => setFormData({ ...formData, guest_address: e.target.value })}
                    placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
                    disabled={updateBookingMutation.isPending}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-blue-600" />
                  วันที่พัก
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>วันเข้าพัก *</Label>
                    <Input
                      type="date"
                      value={formData.check_in_date}
                      onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                      required
                      disabled={updateBookingMutation.isPending}
                    />
                  </div>
                  <div>
                    <Label>วันออก {editingBooking.booking_type === 'daily' ? '*' : '(ถ้ามี)'}</Label>
                    <Input
                      type="date"
                      value={formData.check_out_date}
                      onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                      required={editingBooking.booking_type === 'daily'}
                      disabled={updateBookingMutation.isPending}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>หมายเหตุ</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  disabled={updateBookingMutation.isPending}
                  placeholder="หมายเหตุเพิ่มเติม..."
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditBookingDialog(false);
                    setEditingBooking(null);
                  }}
                  disabled={updateBookingMutation.isPending}
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                  disabled={updateBookingMutation.isPending}
                >
                  {updateBookingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    'บันทึก'
                  )}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}