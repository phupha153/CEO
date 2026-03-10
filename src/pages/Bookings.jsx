import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Calendar as CalendarIcon,
  User,
  DoorOpen,
  AlertTriangle,
  Edit2,
  Trash2,
  Upload,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Search,
  X,
  Calendar,
  Sparkles,
  Loader2,
  FileText,
  Printer,
  Settings
} from "lucide-react";
import {
  format,
  parseISO,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addWeeks,
  subWeeks,
  startOfDay,
  endOfDay
} from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "../components/shared/PageHeader";
import ScrollToTopButton from "../components/shared/ScrollToTopButton";
import AISearchBox from "../components/shared/AISearchBox";
import AIResultCard from "../components/shared/AIResultCard";
import AIActionConfirmation from "../components/shared/AIActionConfirmation";
import BookingConfirmTenantDialog from "../components/bookings/BookingConfirmTenantDialog";
import BookingFormDialog from "../components/bookings/BookingFormDialog";
import CancelBookingDialog from "../components/bookings/CancelBookingDialog";
import CheckoutBookingDialog from "../components/bookings/CheckoutBookingDialog";
import PublicBookingSettingsDialog from "../components/bookings/PublicBookingSettingsDialog";

export default function BookingsPage() {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [editingBooking, setEditingBooking] = useState(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [dialogBookingType, setDialogBookingType] = useState('daily');
  const [formData, setFormData] = useState({
    room_id: '',
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

  const [createPaymentOnBooking, setCreatePaymentOnBooking] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiAction, setAiAction] = useState(null);
  const [aiActionLoading, setAiActionLoading] = useState(false);
  const itemsPerPage = 20;

  const queryClient = useQueryClient();
  const selectedBranchId = localStorage.getItem('selected_branch_id');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: currentUser } = useQuery({ queryKey: ['currentUser'], queryFn: () => base44.auth.me(), retry: false, staleTime: 3600000 });
  const userPermissions = currentUser?.permissions || [];
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
  const isDevOrOwner = userRole === 'developer' || userRole === 'owner';
  const canViewAll = isDevOrOwner || userPermissions.includes('bookings_view_all');
  const canViewDaily = isDevOrOwner || userPermissions.includes('bookings_view_daily');
  const canViewMonthly = isDevOrOwner || userPermissions.includes('bookings_view_monthly');
  const canView = canViewAll || canViewDaily || canViewMonthly;
  const canAdd = isDevOrOwner || userPermissions.includes('bookings_add');
  const canEdit = isDevOrOwner || userPermissions.includes('bookings_edit');
  const canDelete = isDevOrOwner || userPermissions.includes('bookings_delete');
  const canCancel = isDevOrOwner || userPermissions.includes('bookings_cancel_daily');
  const canCheckIn = isDevOrOwner || userPermissions.includes('bookings_checkin');
  const canCheckOut = isDevOrOwner || userPermissions.includes('bookings_checkout');

  const { data: bookings = [], isLoading: bookingsLoading, isFetching: bookingsFetching } = useQuery({
    queryKey: ['bookings', selectedBranchId, 'secure'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Booking',
        filters: { branch_id: selectedBranchId },
        limit: 5000
      });
      return response.data.data;
    },
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: temporaryBookings = [] } = useQuery({
    queryKey: ['temporaryBookings', selectedBranchId],
    queryFn: () => base44.entities.TemporaryBooking.filter({ branch_id: selectedBranchId }, '-created_date', 5000),
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId, 'secure'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Room',
        filters: { branch_id: selectedBranchId },
        sort: '-room_number',
        limit: 5000
      });
      return response.data.data;
    },
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: () => base44.entities.Tenant.filter({ branch_id: selectedBranchId }, '-created_date', 5000),
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { data: maintenanceRequests = [] } = useQuery({
    queryKey: ['maintenanceRequests', selectedBranchId],
    queryFn: () => base44.entities.MaintenanceRequest.filter({ branch_id: selectedBranchId }, '-created_date', 5000),
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs', selectedBranchId],
    queryFn: () => base44.entities.Config.filter({ branch_id: selectedBranchId }),
    enabled: !!selectedBranchId,
  });

  // Configs are handled by PublicBookingSettingsDialog

  const selectedBranchName = useMemo(() => {
    return branches.find(branch => branch.id === selectedBranchId)?.name || 'ไม่ระบุสาขา';
  }, [branches, selectedBranchId]);

  const [selectedFilter, setSelectedFilter] = useState('all');

  // ⭐ กรองเฉพาะ booking ที่ยังใช้งานอยู่ (status = 'active') เท่านั้น
  const dailyBookings = useMemo(() => bookings.filter(b => b.booking_type === 'daily' && b.status === 'active'), [bookings]);
  const monthlyBookings = useMemo(() => bookings.filter(b => b.booking_type === 'monthly' && b.status === 'active'), [bookings]);
  
  const dailyTempBookings = useMemo(() => temporaryBookings.filter(b => b.booking_type === 'daily'), [temporaryBookings]);
  const monthlyTempBookings = useMemo(() => temporaryBookings.filter(b => b.booking_type === 'monthly'), [temporaryBookings]);

  const handleAISearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('กรุณาใส่คำค้นหา');
      return;
    }

    setAiSearching(true);
    setAiResult(null);

    try {
      // ข้อมูลห้องทั้งหมด
      const roomsData = rooms.map(r => ({
        id: r.id,
        room_number: r.room_number,
        floor: r.floor,
        room_type: r.room_type,
        status: r.status,
        price: r.price
      }));

      // การจองที่ active ทั้งหมด
      const activeBookings = bookings.filter(b => b.status === 'active');

      const bookingsData = activeBookings.map(b => {
        const room = rooms.find(r => r.id === b.room_id);
        const tenant = b.tenant_id ? tenants.find(t => t.id === b.tenant_id) : null;
        return {
          room_id: b.room_id,
          room_number: room?.room_number || 'N/A',
          floor: room?.floor,
          room_type: room?.room_type || 'unknown',
          guest_name: b.guest_name || tenant?.full_name || 'ไม่ระบุชื่อ',
          check_in_date: b.check_in_date,
          check_out_date: b.check_out_date || null,
          booking_type: b.booking_type
        };
      });

      // วันที่ปัจจุบัน
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');

      // ฟังก์ชันหาว่าห้องว่างในวันที่กำหนดหรือไม่
      const isRoomAvailableOnDate = (roomId, targetDate) => {
        const roomBookings = bookingsData.filter(b => b.room_id === roomId);
        if (roomBookings.length === 0) return true; // ไม่มี booking = ว่าง
        
        for (const booking of roomBookings) {
          const checkIn = booking.check_in_date;
          const checkOut = booking.check_out_date;
          
          // ถ้าไม่มี check_out_date = ถือว่ายังเช่าอยู่ตลอด
          if (!checkOut) {
            if (targetDate >= checkIn) return false;
          } else {
            // มี check_out = เช็คว่า targetDate อยู่ในช่วงเช่าหรือไม่
            if (targetDate >= checkIn && targetDate < checkOut) return false;
          }
        }
        return true;
      };

      // ฟังก์ชันหาวันที่ห้องจะว่าง (วันหมดสัญญา = วันที่ว่าง)
      const getRoomAvailabilityDate = (roomId) => {
        const roomBookings = bookingsData.filter(b => b.room_id === roomId);
        if (roomBookings.length === 0) return { available: true, availableFrom: todayStr, reason: 'ว่างอยู่แล้วตอนนี้' };
        
        // หา booking ที่ยังใช้งานอยู่
        let latestCheckOut = null;
        let hasNoEndDate = false;
        let currentTenant = null;
        
        for (const booking of roomBookings) {
          if (!booking.check_out_date) {
            hasNoEndDate = true;
            currentTenant = booking.guest_name;
          } else {
            if (!latestCheckOut || booking.check_out_date > latestCheckOut) {
              latestCheckOut = booking.check_out_date;
              currentTenant = booking.guest_name;
            }
          }
        }
        
        if (hasNoEndDate) {
          return { available: false, availableFrom: null, reason: `มีผู้เช่า (${currentTenant}) - ไม่มีวันหมดสัญญา`, currentTenant };
        }
        
        if (latestCheckOut && latestCheckOut > todayStr) {
          // วันหมดสัญญา = วันที่ว่าง
          return { available: false, availableFrom: latestCheckOut, contractEndDate: latestCheckOut, reason: `หมดสัญญาวันที่ ${latestCheckOut}`, currentTenant };
        }
        
        return { available: true, availableFrom: todayStr, reason: 'ว่างอยู่แล้วตอนนี้' };
      };

      // สร้างข้อมูลห้องพร้อมสถานะความว่าง
      const roomsWithAvailability = roomsData.map(r => {
        const availability = getRoomAvailabilityDate(r.id);
        return {
          ...r,
          ...availability
        };
      });

      // ห้องที่ว่างตอนนี้
      const currentlyAvailable = roomsWithAvailability.filter(r => r.available);
      
      // ห้องที่มีผู้เช่าแต่มีกำหนดว่าง
      const willBeAvailable = roomsWithAvailability.filter(r => !r.available && r.availableFrom);
      
      // ห้องที่ไม่มีกำหนดว่าง
      const noEndDate = roomsWithAvailability.filter(r => !r.available && !r.availableFrom);

      // แยกห้องตามประเภท
      const dailyRooms = roomsWithAvailability.filter(r => r.room_type === 'daily');
      const monthlyRooms = roomsWithAvailability.filter(r => r.room_type === 'monthly');
      
      const dailyAvailable = dailyRooms.filter(r => r.available);
      const dailyWillBeAvailable = dailyRooms.filter(r => !r.available && r.availableFrom);
      const dailyNoEndDate = dailyRooms.filter(r => !r.available && !r.availableFrom);
      
      const monthlyAvailable = monthlyRooms.filter(r => r.available);
      const monthlyWillBeAvailable = monthlyRooms.filter(r => !r.available && r.availableFrom);
      const monthlyNoEndDate = monthlyRooms.filter(r => !r.available && !r.availableFrom);

      // สร้าง prompt ที่ชัดเจน
      const promptText = `คุณเป็นผู้ช่วยค้นหาห้องพักอัจฉริยะ ตอบแม่นยำที่สุด

📅 วันที่ปัจจุบัน: ${todayStr} (${format(today, 'd MMMM yyyy', { locale: th })})
📅 ปีปัจจุบัน: ${today.getFullYear()} (พ.ศ. ${today.getFullYear() + 543})

❓ คำถาม: "${searchQuery}"

=== 🏨 ห้องรายวัน (Daily) - ${dailyRooms.length} ห้อง ===

🟢 ว่างตอนนี้ (${dailyAvailable.length} ห้อง):
${dailyAvailable.length > 0 ? dailyAvailable.map(r => 
  `  - ห้อง ${r.room_number} ชั้น ${r.floor} (${r.price?.toLocaleString() || 0} บาท)`
).join('\n') : '  ไม่มี'}

🟡 มีผู้เช่า มีวันหมดสัญญา (${dailyWillBeAvailable.length} ห้อง):
${dailyWillBeAvailable.length > 0 ? dailyWillBeAvailable.map(r => 
  `  - ห้อง ${r.room_number} ชั้น ${r.floor} → หมดสัญญา ${r.availableFrom} (ผู้เช่า: ${r.currentTenant})`
).join('\n') : '  ไม่มี'}

🔴 มีผู้เช่า ไม่มีวันหมดสัญญา (${dailyNoEndDate.length} ห้อง):
${dailyNoEndDate.length > 0 ? dailyNoEndDate.map(r => 
  `  - ห้อง ${r.room_number} ชั้น ${r.floor} (ผู้เช่า: ${r.currentTenant})`
).join('\n') : '  ไม่มี'}

=== 🏠 ห้องรายเดือน (Monthly) - ${monthlyRooms.length} ห้อง ===

🟢 ว่างตอนนี้ (${monthlyAvailable.length} ห้อง):
${monthlyAvailable.length > 0 ? monthlyAvailable.map(r => 
  `  - ห้อง ${r.room_number} ชั้น ${r.floor} (${r.price?.toLocaleString() || 0} บาท)`
).join('\n') : '  ไม่มี'}

🟡 มีผู้เช่า มีวันหมดสัญญา (${monthlyWillBeAvailable.length} ห้อง):
${monthlyWillBeAvailable.length > 0 ? monthlyWillBeAvailable.map(r => 
  `  - ห้อง ${r.room_number} ชั้น ${r.floor} → หมดสัญญา ${r.availableFrom} (ผู้เช่า: ${r.currentTenant})`
).join('\n') : '  ไม่มี'}

🔴 มีผู้เช่า ไม่มีวันหมดสัญญา (${monthlyNoEndDate.length} ห้อง):
${monthlyNoEndDate.length > 0 ? monthlyNoEndDate.map(r => 
  `  - ห้อง ${r.room_number} ชั้น ${r.floor} (ผู้เช่า: ${r.currentTenant})`
).join('\n') : '  ไม่มี'}

=== 🎯 วิธีตอบคำถาม ===

**ถ้าถามเฉพาะ "ห้องรายวัน" หรือ "daily":**
- ตอบเฉพาะห้องที่ room_type = "daily"

**ถ้าถามเฉพาะ "ห้องรายเดือน" หรือ "monthly":**
- ตอบเฉพาะห้องที่ room_type = "monthly"

**ถ้าถามหา "ห้องว่างเดือน X" (เช่น กุมภาพันธ์):**
- คำนวณช่วงวันที่ของเดือนนั้น (กุมภาพันธ์ 2025 = 2025-02-01 ถึง 2025-02-28)
- ห้องว่างในเดือนนั้น = ว่างอยู่แล้ว หรือ วันหมดสัญญา (availableFrom) <= วันสุดท้ายของเดือน
- ห้องที่ไม่มีวันหมดสัญญา (availableFrom = null) = ไม่นับว่าจะว่าง

**ถ้าถามหา "ห้องว่างตอนนี้":**
- ตอบเฉพาะห้องที่ available = true

**ถ้าถามหาห้องตามชั้น:**
- กรองตาม floor ที่ระบุ

**สำคัญมาก:**
- ต้องมี answer ที่ชัดเจน ระบุจำนวนและเลขห้อง
- ต้องมี rooms array ที่มี room_id, room_number, floor, reason
- วันหมดสัญญา (availableFrom) = วันที่ห้องจะว่าง
- ห้องที่ไม่มีวันหมดสัญญา = ยังมีผู้เช่าไม่มีกำหนด = ไม่ว่าง

ตอบเป็นภาษาไทย กระชับ ถูกต้อง แม่นยำ`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: promptText,
        response_json_schema: {
          type: "object",
          properties: {
            answer: { 
              type: "string",
              description: "คำตอบภาษาไทยที่สรุปผลการค้นหา ต้องมีเสมอ"
            },
            action_type: { 
              type: "string",
              enum: ["view", "create"],
              description: "view สำหรับดูข้อมูล, create สำหรับจองห้อง"
            },
            data: {
              type: "object",
              properties: {
                room_id: { type: "string" },
                guest_name: { type: "string" },
                guest_phone: { type: "string" },
                guest_email: { type: "string" },
                check_in_date: { type: "string" },
                check_out_date: { type: "string" },
                deposit_amount: { type: "number" },
                deposit_payment_method: { type: "string" },
                notes: { type: "string" }
              }
            },
            rooms: {
              type: "array",
              description: "รายการห้องที่ตรงเงื่อนไข ต้องมีเสมอเมื่อ action_type เป็น view",
              items: {
                type: "object",
                properties: {
                  room_id: { type: "string", description: "ID ของห้อง" },
                  room_number: { type: "string", description: "เลขห้อง" },
                  floor: { type: "number", description: "ชั้น" },
                  reason: { type: "string", description: "เหตุผลที่แนะนำห้องนี้" }
                },
                required: ["room_id", "room_number", "floor", "reason"]
              }
            }
          },
          required: ["answer", "rooms"]
        }
      });

      console.log('AI Response:', response);
      
      // ถ้า action_type = "create" ให้แสดง confirmation พร้อมเพิ่ม description
      if (response.action_type === 'create' && response.data) {
        setAiAction({ ...response, description: response.answer });
        setAiResult({ answer: response.answer });
      } else {
        // สร้าง answer ถ้าไม่มี
        let finalAnswer = response.answer;
        let finalRooms = response.rooms || [];
        
        if (!finalAnswer || finalAnswer.trim() === '') {
          if (finalRooms.length > 0) {
            finalAnswer = `พบห้องที่ตรงเงื่อนไข ${finalRooms.length} ห้อง`;
          } else {
            finalAnswer = 'ไม่พบห้องที่ตรงตามเงื่อนไข กรุณาลองค้นหาด้วยคำอื่น';
          }
        }
        
        setAiResult({ 
          ...response, 
          answer: finalAnswer,
          rooms: finalRooms
        });
      }
      toast.success('วิเคราะห์สำเร็จ');
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

  const handleAIActionConfirm = async (slipFile) => {
    if (!aiAction?.data) return;

    setAiActionLoading(true);
    try {
      let bookingData = { ...aiAction.data };

      // ถ้ามีการอัปโหลดสลิป
      if (slipFile) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file: slipFile });
        bookingData.deposit_slip_url = file_url;
      }

      bookingData.branch_id = selectedBranchId;
      // กำหนด booking_type ตาม room_type ของห้องที่เลือก
      const selectedRoom = rooms.find(r => r.id === bookingData.room_id);
      bookingData.booking_type = selectedRoom?.room_type || 'daily';
      bookingData.status = 'active';
      bookingData.total_amount = 0;

      await createTempMutation.mutateAsync(bookingData);

      setAiAction(null);
      setAiResult(null);
      setSearchQuery('');
      toast.success('สร้างการจองสำเร็จ');
    } catch (error) {
      console.error('AI Action Error:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการสร้างการจอง');
    } finally {
      setAiActionLoading(false);
    }
  };

  const handleAIActionCancel = () => {
    console.log('❌ User cancelled AI action');
    setAiAction(null);
    setAiResult(prev => prev ? { ...prev, answer: 'ยกเลิกการดำเนินการแล้ว ไม่มีการเปลี่ยนแปลงข้อมูล' } : null);
  };

  const handleBookRoom = (roomId) => {
    if (!canAdd) {
      toast.error('คุณไม่มีสิทธิ์เพิ่มการจอง');
      return;
    }

    setEditingBooking(null);
    setFormData({
      room_id: roomId,
      guest_name: '',
      guest_phone: '',
      guest_email: '',
      check_in_date: new Date().toISOString().split('T')[0],
      check_out_date: '',
      deposit_amount: '',
      deposit_payment_method: 'transfer',
      deposit_slip_url: '',
      notes: ''
    });
    setShowDialog(true);
  };

  const weekDays = useMemo(() => {
    const start = startOfWeek(currentCalendarDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentCalendarDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentCalendarDate]);

  const getRoomEvents = (roomId, date) => {
    const events = [];

    // ⭐ แสดงเฉพาะ booking ที่ status = 'active' เท่านั้น (ซ่อน completed, cancelled)
    const roomBookings = bookings.filter(b => {
      // กรอง: room_id ต้องตรง + status ต้อง active เท่านั้น
      if (b.room_id !== roomId) return false;
      if (b.status !== 'active') return false; // ⭐ ซ่อน booking ที่ไม่ active
      if (!b.check_in_date) return false;

      try {
        const checkIn = startOfDay(parseISO(b.check_in_date));
        const checkOut = b.check_out_date ? startOfDay(parseISO(b.check_out_date)) : endOfDay(parseISO('9999-12-31'));

        return (isSameDay(checkIn, date) || isSameDay(checkOut, date) || isWithinInterval(date, { start: checkIn, end: checkOut }));
      } catch (error) {
        console.error("Error parsing booking dates:", error, b);
        return false;
      }
    });

    roomBookings.forEach(booking => {
      const tenant = booking.tenant_id ? tenants.find(t => t.id === booking.tenant_id) : null;
      events.push({
        type: booking.booking_type === 'daily' ? 'daily-booking' : 'monthly-booking',
        booking: booking,
        tenant: tenant,
        label: booking.booking_type === 'daily'
          ? (booking.guest_name || 'รายวัน')
          : (tenant?.full_name || 'รายเดือน')
      });
    });

    // ⭐ แสดงเฉพาะ TemporaryBooking ที่ยังใช้งานอยู่ (ไม่ต้องเช็ค status เพราะ temp ไม่มี completed/cancelled)
    const roomTempBookings = temporaryBookings.filter(b => {
      if (b.room_id !== roomId) return false;
      if (!b.check_in_date) return false;

      try {
        const checkIn = startOfDay(parseISO(b.check_in_date));
        const checkOut = b.check_out_date ? startOfDay(parseISO(b.check_out_date)) : endOfDay(parseISO('9999-12-31'));

        return (isSameDay(checkIn, date) || isSameDay(checkOut, date) || isWithinInterval(date, { start: checkIn, end: checkOut }));
      } catch (error) {
        console.error("Error parsing temp booking dates:", error, b);
        return false;
      }
    });

    roomTempBookings.forEach(tempBooking => {
      events.push({
        type: 'temporary-booking',
        booking: tempBooking,
        label: tempBooking.guest_name || 'รอยืนยัน'
      });
    });

    const roomMaintenance = maintenanceRequests.filter(m => {
      if (m.room_id !== roomId) return false;
      if (m.status === 'completed' || m.status === 'cancelled') return false;
      if (!m.created_date) return false;

      try {
        const createdDate = startOfDay(parseISO(m.created_date));
        const endDate = m.end_date ? startOfDay(parseISO(m.end_date)) : endOfDay(parseISO('9999-12-31'));

        return (m.status === 'in_progress' && (isSameDay(createdDate, date) || isWithinInterval(date, { start: createdDate, end: endDate}))) ||
               (m.status === 'pending' && isSameDay(createdDate, date));

      } catch (error) {
        console.error("Error parsing maintenance dates:", error, m);
        return false;
      }
    });

    roomMaintenance.forEach(maintenance => {
      events.push({
        type: 'maintenance',
        maintenance: maintenance,
        label: maintenance.title
      });
    });

    return events;
  };

  const getCellColor = (events) => {
    if (events.length === 0) return 'bg-green-50 hover:bg-green-100 border-green-200';

    const hasMonthly = events.some(e => e.type === 'monthly-booking');
    if (hasMonthly) return 'bg-blue-100 hover:bg-blue-200 border-blue-300';

    const hasMaintenance = events.some(e => e.type === 'maintenance');
    if (hasMaintenance) return 'bg-red-100 hover:bg-red-200 border-red-300';

    const hasDaily = events.some(e => e.type === 'daily-booking');
    if (hasDaily) return 'bg-indigo-100 hover:bg-indigo-200 border-indigo-300';

    // ⭐ การจองชั่วคราว (รอยืนยัน) = สีเหลือง
    const hasTemporary = events.some(e => e.type === 'temporary-booking');
    if (hasTemporary) return 'bg-yellow-100 hover:bg-yellow-200 border-yellow-300';

    return 'bg-slate-50 hover:bg-slate-100 border-slate-200';
  };

  const handleCalendarCellClick = (room, date, events) => {
    const isEmptyOrOnlyMaintenance = !events.some(e => e.type === 'daily-booking' || e.type === 'monthly-booking' || e.type === 'temporary-booking');

    if (isEmptyOrOnlyMaintenance) {
      if (!canAdd) {
        toast.error('คุณไม่มีสิทธิ์เพิ่มการจอง');
        return;
      }

      setShowCalendarDialog(false);

      setEditingBooking(null);
      setFormData({
        room_id: room.id,
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        check_in_date: format(date, 'yyyy-MM-dd'),
        check_out_date: '',
        deposit_amount: '',
        deposit_payment_method: 'transfer',
        deposit_slip_url: '',
        notes: ''
      });

      setTimeout(() => {
        setShowDialog(true);
      }, 100);
    } else {
      // ⭐ แสดง Dialog สำหรับยกเลิก/เช็คเอาท์ booking
      const activeBookingEvent = events.find(e => e.type === 'daily-booking' || e.type === 'monthly-booking');
      
      if (activeBookingEvent) {
        const bookingToManage = activeBookingEvent.booking;
        
        const confirmAction = confirm(
          `ห้อง ${room.room_number} - ${bookingToManage.guest_name}\n\n` +
          `เลือกการดำเนินการ:\n` +
          `[ตกลง] = เช็คเอาท์\n` +
          `[ยกเลิก] = ปิด\n\n` +
          `หรือพิมพ์ "cancel" เพื่อยกเลิกการจอง`
        );
        
        if (confirmAction) {
          setPendingCheckoutBooking(bookingToManage);
          setCheckoutBookingDialog(true);
        }
      } else {
        const hasTemporary = events.some(e => e.type === 'temporary-booking');
        const hasMaintenance = events.some(e => e.type === 'maintenance');

        if (hasTemporary) {
          toast.error('ห้องนี้มีการจองรอยืนยันอยู่แล้ว');
        } else if (hasMaintenance) {
          toast.error('ห้องนี้อยู่ระหว่างการซ่อมบำรุง');
        }
      }
    }
  };

  const createTempMutation = useMutation({
    mutationFn: async ({ bookingData, shouldCreatePayment }) => {
      if (!canAdd) {
        throw new Error('คุณไม่มีสิทธิ์เพิ่มการจอง');
      }

      const room = rooms.find(r => r.id === bookingData.room_id);
      if (!room) {
        throw new Error('ไม่พบห้องที่เลือก');
      }

      const newBooking = await base44.entities.TemporaryBooking.create(bookingData);

      // สร้าง Payment ถ้าติ๊กถูก
      if (shouldCreatePayment) {
      const securityDeposit = bookingData.security_deposit || 0;
      const advanceRent = bookingData.advance_rent || 0;
      const commonFee = bookingData.common_fee_included || 0;
      const totalRemaining = securityDeposit + advanceRent + commonFee;

      if (totalRemaining > 0) {
        const dueDate = bookingData.check_out_date || bookingData.contract_deadline || bookingData.check_in_date;
          
          await base44.entities.Payment.create({
            branch_id: selectedBranchId,
            booking_id: newBooking.id,
            room_id: newBooking.room_id,
            payment_category: 'booking_deposit',
            due_date: dueDate,
            security_deposit_amount: securityDeposit,
            advance_rent_amount: advanceRent,
            common_fee_amount: commonFee,
            total_amount: totalRemaining,
            status: 'pending',
            late_fee_locked: true,
            notes: `รายการชำระจากการจองห้อง ${room.room_number} - ${bookingData.guest_name}\n` +
                   `เงินประกัน: ${securityDeposit.toLocaleString()} บาท\n` +
                   `ค่าเช่าล่วงหน้า: ${advanceRent.toLocaleString()} บาท\n` +
                   `ค่าส่วนกลาง: ${commonFee.toLocaleString()} บาท`
          });
        }
      }

      return newBooking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['temporaryBookings', selectedBranchId]);
      queryClient.invalidateQueries(['payments', selectedBranchId]);
      setShowDialog(false);
      resetForm();
      setCreatePaymentOnBooking(false);
      toast.success('บันทึกการจองชั่วคราวสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const updateTempMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (!canEdit) {
        throw new Error('คุณไม่มีสิทธิ์แก้ไขการจอง');
      }
      
      return await base44.entities.TemporaryBooking.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['temporaryBookings', selectedBranchId]);
      setShowDialog(false);
      resetForm();
      toast.success('อัปเดตการจองสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const confirmTempBookingMutation = useMutation({
    mutationFn: async ({ tempBooking, tenantId }) => {
      // สร้าง Booking ปกติจากข้อมูล TemporaryBooking
      const bookingData = {
        ...tempBooking,
        status: 'active',
        booking_no: format(new Date(), 'dd-MM-yy'),
        total_amount: 0,
        tenant_id: tenantId || null
      };
      delete bookingData.id;
      delete bookingData.created_date;
      delete bookingData.updated_date;
      delete bookingData.created_by;

      const newRealBooking = await base44.entities.Booking.create(bookingData);

      // โอนรายการชำระเงินจาก TemporaryBooking ไปยัง Booking จริงและผูกกับผู้เช่า
      const existingPayments = await base44.entities.Payment.filter({ booking_id: tempBooking.id });
      for (const payment of existingPayments) {
        await base44.entities.Payment.update(payment.id, {
          booking_id: newRealBooking.id,
          tenant_id: tenantId || null,
          line_user_id: tempBooking.line_user_id || payment.line_user_id || null
        });
      }
      
      // ⭐ อัปเดตสถานะห้องเป็น "occupied" และลบแถบ "ติดจอง"
      await base44.entities.Room.update(tempBooking.room_id, { status: 'occupied' });
      
      // ลบ TemporaryBooking
      await base44.entities.TemporaryBooking.delete(tempBooking.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      queryClient.invalidateQueries(['temporaryBookings', selectedBranchId]);
      queryClient.invalidateQueries(['tenants', selectedBranchId]);
      queryClient.invalidateQueries(['rooms', selectedBranchId]);
      toast.success('ยืนยันการจองสำเร็จ');
      setConfirmTenantDialog(false);
      setPendingTempBooking(null);
      setSelectedTenant(null);
      setCreateNewTenant(false);
      setTenantFormData({ full_name: '', phone: '', national_id: '', email: '' });
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const deleteTempBookingMutation = useMutation({
    mutationFn: async (id) => {
      const tempBooking = temporaryBookings.find(b => b.id === id);
      if (tempBooking) {
        // เปลี่ยนสถานะห้องกลับเป็นว่าง
        await base44.entities.Room.update(tempBooking.room_id, {
          status: 'available'
        });
      }
      return await base44.entities.TemporaryBooking.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['temporaryBookings', selectedBranchId]);
      queryClient.invalidateQueries(['rooms', selectedBranchId]);
      toast.success('ลบการจองชั่วคราวสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });





  const [checkInConfirmDialog, setCheckInConfirmDialog] = useState(false);
  const [pendingCheckInBooking, setPendingCheckInBooking] = useState(null);
  const [createPaymentOnCheckIn, setCreatePaymentOnCheckIn] = useState(true);
  
  const [cancelBookingDialog, setCancelBookingDialog] = useState(false);
  const [pendingCancelBooking, setPendingCancelBooking] = useState(null);
  
  const [checkoutBookingDialog, setCheckoutBookingDialog] = useState(false);
  const [pendingCheckoutBooking, setPendingCheckoutBooking] = useState(null);
  
  const [bookingActionDialog, setBookingActionDialog] = useState(false);
  const [pendingActionBooking, setPendingActionBooking] = useState(null);
  
  const [confirmTenantDialog, setConfirmTenantDialog] = useState(false);
  const [pendingTempBooking, setPendingTempBooking] = useState(null);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [createNewTenant, setCreateNewTenant] = useState(false);
  const [tenantFormData, setTenantFormData] = useState({
    full_name: '',
    phone: '',
    national_id: '',
    email: ''
  });

  const confirmCheckInMutation = useMutation({
    mutationFn: async ({ booking, shouldCreatePayment }) => {
      if (!canCheckIn) {
        throw new Error('คุณไม่มีสิทธิ์ยืนยันการเข้าพัก');
      }
      
      // อัปเดตวันที่เข้าพักจริง
      await base44.entities.Booking.update(booking.id, {
        actual_check_in_date: new Date().toISOString().split('T')[0]
      });

      // ถ้าเลือกสร้างรายการชำระเงิน
       if (shouldCreatePayment) {
         const room = rooms.find(r => r.id === booking.room_id);
         const dueDate = booking.check_out_date || booking.contract_deadline || new Date().toISOString().split('T')[0];
        
        // คำนวณยอดรวมที่ต้องชำระ (ไม่รวมเงินจองที่จ่ายไปแล้ว)
        const securityDeposit = booking.security_deposit || 0;
        const advanceRent = booking.advance_rent || 0;
        const commonFee = booking.common_fee_included || 0;
        const totalRemaining = securityDeposit + advanceRent + commonFee;
        
        if (totalRemaining > 0) {
          // สร้างรายการชำระเงินรอดำเนินการ
          await base44.entities.Payment.create({
            branch_id: selectedBranchId,
            booking_id: booking.id,
            tenant_id: booking.tenant_id || null,
            room_id: booking.room_id,
            payment_category: 'security_deposit',
            due_date: dueDate,
            security_deposit_amount: securityDeposit,
            advance_rent_amount: advanceRent,
            common_fee_amount: commonFee,
            total_amount: totalRemaining,
            status: 'pending',
            late_fee_locked: true,
            notes: `รายการชำระจากการจองห้อง ${room?.room_number || ''} - ${booking.guest_name}\n` +
                   `เงินประกัน: ${securityDeposit.toLocaleString()} บาท\n` +
                   `ค่าเช่าล่วงหน้า: ${advanceRent.toLocaleString()} บาท\n` +
                   `ค่าส่วนกลาง: ${commonFee.toLocaleString()} บาท`
          });
        }
      }
      
      return booking;
    },
    onSuccess: (booking) => {
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      queryClient.invalidateQueries(['payments', selectedBranchId]);
      setCheckInConfirmDialog(false);
      setPendingCheckInBooking(null);
      toast.success('ยืนยันการเข้าพักสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const cancelBookingMutation = useMutation({
    mutationFn: async (booking) => {
      if (!canDelete && !canCancel) {
        throw new Error('คุณไม่มีสิทธิ์ยกเลิกการจอง');
      }
      
      await base44.entities.Booking.update(booking.id, {
        status: 'cancelled'
      });

      // ⭐ เปลี่ยนสถานะห้องกลับเป็นว่าง
      await base44.entities.Room.update(booking.room_id, {
        status: 'available'
      });
      
      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      setCancelBookingDialog(false);
      setPendingCancelBooking(null);
      toast.success('ยกเลิกการจองสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const checkoutBookingMutation = useMutation({
    mutationFn: async (booking) => {
      if (!canCheckOut) {
        throw new Error('คุณไม่มีสิทธิ์ยืนยันการเช็คเอาท์');
      }
      
      await base44.entities.Booking.update(booking.id, {
        status: 'completed'
      });

      // ⭐ เปลี่ยนสถานะห้องกลับเป็นว่างเมื่อเช็คเอาท์
      await base44.entities.Room.update(booking.room_id, {
        status: 'available'
      });
      
      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      setCheckoutBookingDialog(false);
      setPendingCheckoutBooking(null);
      toast.success('บันทึกการเช็คเอาท์สำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const handleConfirmCheckIn = (booking) => {
    setPendingCheckInBooking(booking);
    setCheckInConfirmDialog(true);
  };

  const handleSlipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSlip(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, deposit_slip_url: file_url }));
      toast.success('อัปโหลดสลิปสำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดสลิปไม่สำเร็จ');
    }
    setUploadingSlip(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const depositAmount = formData.deposit_amount ? parseFloat(formData.deposit_amount) : 0;
    const securityDeposit = formData.security_deposit ? parseFloat(formData.security_deposit) : 0;
    const advanceRent = formData.advance_rent ? parseFloat(formData.advance_rent) : 0;
    const commonFeeIncluded = formData.common_fee_included ? parseFloat(formData.common_fee_included) : 0;
    
    const data = {
      ...formData,
      deposit_amount: depositAmount,
      security_deposit: securityDeposit,
      advance_rent: advanceRent,
      common_fee_included: commonFeeIncluded,
      booking_type: dialogBookingType,
      branch_id: selectedBranchId
    };

    if (editingBooking) {
      updateTempMutation.mutate({ id: editingBooking.id, data });
    } else {
      createTempMutation.mutate({ 
        bookingData: data, 
        shouldCreatePayment: createPaymentOnBooking 
      });
    }
  };

  const handleEdit = (booking) => {
    if (!canEdit) {
      toast.error('คุณไม่มีสิทธิ์แก้ไขการจอง');
      return;
    }
    setEditingBooking(booking);
    setDialogBookingType(booking.booking_type || 'daily');
    setFormData({
      room_id: booking.room_id || '',
      guest_name: booking.guest_name || '',
      guest_phone: booking.guest_phone || '',
      guest_email: booking.guest_email || '',
      guest_national_id: booking.guest_national_id || '',
      guest_address: booking.guest_address || '',
      check_in_date: booking.check_in_date || '',
      check_out_date: booking.check_out_date || '',
      contract_duration: booking.contract_duration || '1 ปี',
      deposit_amount: booking.deposit_amount?.toString() || '',
      security_deposit: booking.security_deposit?.toString() || '',
      advance_rent: booking.advance_rent?.toString() || '',
      common_fee_included: booking.common_fee_included?.toString() || '',
      contract_deadline: booking.contract_deadline || '',
      deposit_payment_method: booking.deposit_payment_method || 'transfer',
      deposit_slip_url: booking.deposit_slip_url || '',
      notes: booking.notes || ''
    });
    setShowDialog(true);
  };

  const handleDeleteTemp = (id) => {
    if (confirm('ลบการจองชั่วคราวนี้ใช่ไหม?')) {
      deleteTempBookingMutation.mutate(id);
    }
  };



  const resetForm = () => {
    setEditingBooking(null);
    setDialogBookingType('daily');
    setFormData({
      room_id: '',
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
    setCreatePaymentOnBooking(false);
  };

  const getStatusBadge = (status) => {
    const configs = {
      active: { label: 'กำลังเข้าพัก', className: 'bg-green-100 text-green-700' },
      completed: { label: 'เสร็จสิ้น', className: 'bg-blue-100 text-blue-700' },
      cancelled: { label: 'ยกเลิก', className: 'bg-red-100 text-red-700' },
    };
    return configs[status] ? <Badge className={configs[status].className}>{configs[status].label}</Badge> : null;
  };

  const getRoomInfo = (roomId) => rooms.find(r => r.id === roomId);

  const filteredBookings = useMemo(() => {
    let bookingsToFilter;
    if (selectedFilter === 'monthly') {
      bookingsToFilter = monthlyBookings;
    } else if (selectedFilter === 'daily') {
      bookingsToFilter = dailyBookings;
    } else {
      bookingsToFilter = [...dailyBookings, ...monthlyBookings];
    }
    
    if (!debouncedSearch.trim()) return bookingsToFilter;

    const query = debouncedSearch.toLowerCase();
    return bookingsToFilter.filter(booking => {
      const room = getRoomInfo(booking.room_id);
      return booking.guest_name?.toLowerCase().includes(query) ||
             booking.guest_phone?.toLowerCase().includes(query) ||
             room?.room_number?.toLowerCase().includes(query);
    });
  }, [selectedFilter, dailyBookings, monthlyBookings, debouncedSearch, rooms]);

  const filteredTempBookings = useMemo(() => {
    let bookingsToFilter;
    if (selectedFilter === 'monthly') {
      bookingsToFilter = monthlyTempBookings;
    } else if (selectedFilter === 'daily') {
      bookingsToFilter = dailyTempBookings;
    } else {
      bookingsToFilter = [...dailyTempBookings, ...monthlyTempBookings];
    }
    
    if (!debouncedSearch.trim()) return bookingsToFilter;

    const query = debouncedSearch.toLowerCase();
    return bookingsToFilter.filter(booking => {
      const room = getRoomInfo(booking.room_id);
      return booking.guest_name?.toLowerCase().includes(query) ||
             booking.guest_phone?.toLowerCase().includes(query) ||
             room?.room_number?.toLowerCase().includes(query);
    });
  }, [selectedFilter, dailyTempBookings, monthlyTempBookings, debouncedSearch, rooms]);

  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredBookings.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredBookings, currentPage, itemsPerPage]);

  const sortedRooms = useMemo(() => {
    return [...rooms].sort((a, b) => {
      if (a.floor !== b.floor) return a.floor - b.floor;
      return a.room_number.localeCompare(b.room_number);
    });
  }, [rooms]);

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
          <p className="text-slate-500 mt-2">โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
        </Card>
      </div>
    );
  }

  if (bookingsLoading && bookings.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <PageHeader
          title="การจองห้อง"
          subtitle={`สาขา ${selectedBranchName}`}
          icon={Calendar}
        />
        <div className="px-4 md:px-8 py-6">
          <div className="max-w-7xl mx-auto space-y-3 animate-pulse">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-200 rounded-lg"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 rounded" style={{ width: `${60 + Math.random() * 30}%` }}></div>
                  <div className="h-3 bg-slate-200 rounded" style={{ width: `${40 + Math.random() * 20}%` }}></div>
                </div>
                <div className="w-24 h-6 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <ScrollToTopButton />
      <PageHeader
        title="การจองห้อง"
        subtitle={`สาขา ${selectedBranchName}`}
        icon={Calendar}
        actions={
          <>
            {canAdd && (
              <Button
                onClick={() => setShowSettingsDialog(true)}
                variant="outline"
                className="border-slate-300 text-slate-700 hover:bg-slate-50 shadow-sm"
              >
                <Settings className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">ตั้งค่าเงินมัดจำ</span>
              </Button>
            )}
            <Button
              onClick={() => {
                setCurrentCalendarDate(new Date());
                setShowCalendarDialog(true);
              }}
              variant="outline"
              className="border-purple-600 text-purple-600 hover:bg-purple-50 shadow-md"
            >
              <CalendarIcon className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">ปฏิทิน</span>
            </Button>
            {canAdd && (
              <Button
                onClick={() => {
                  setEditingBooking(null);
                  setDialogBookingType('daily');
                  setFormData({
                    room_id: '',
                    guest_name: '',
                    guest_phone: '',
                    guest_email: '',
                    check_in_date: new Date().toISOString().split('T')[0],
                    check_out_date: '',
                    deposit_amount: '',
                    security_deposit: '',
                    advance_rent: '',
                    common_fee_included: '',
                    deposit_payment_method: 'transfer',
                    deposit_slip_url: '',
                    notes: ''
                  });
                  setCreatePaymentOnBooking(false);
                  setShowDialog(true);
                }}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
              >
                <Plus className="w-5 h-5 mr-2" />
                เพิ่มการจอง
              </Button>
            )}
          </>
        }
      />

      <div className="px-4 md:px-8 py-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">



          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg rounded-3xl">
            <CardContent className="p-6 md:p-8 space-y-6">
              {userRole === 'developer' ? (
                <AISearchBox
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onAISearch={handleAISearch}
                  onStopSearch={() => setAiSearching(false)}
                  aiSearching={aiSearching}
                  placeholder="ค้นหาการจอง หรือถามเช่น 'จองห้อง 101 วันที่ 25' 'ห้องว่างชั้น 3'"
                />
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-slate-400 pointer-events-none z-10" />
                  <Input
                    type="text"
                    placeholder="ค้นหาการจอง..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 md:pl-12 h-9 md:h-12 rounded-xl md:rounded-2xl bg-white border-slate-200 shadow-sm text-sm md:text-base"
                  />
                  {searchQuery && (
                    <Button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 md:h-8 md:w-8 hover:bg-slate-100 rounded-lg"
                    >
                      <X className="w-3 h-3 md:w-4 md:h-4 text-slate-500" />
                    </Button>
                  )}
                </div>
              )}

              {userRole === 'developer' && aiAction && (
                <AIActionConfirmation
                  action={aiAction}
                  onConfirm={handleAIActionConfirm}
                  onCancel={handleAIActionCancel}
                  isLoading={aiActionLoading}
                  allowSlipUpload={true}
                  roomInfo={aiAction.data?.room_id ? rooms.find(r => r.id === aiAction.data.room_id) : null}
                />
              )}

              {userRole === 'developer' && aiResult && !aiAction && (
                <AIResultCard aiResult={aiResult}>
                  {aiResult.rooms && aiResult.rooms.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-semibold text-purple-800">ห้องที่แนะนำ:</p>
                      {aiResult.rooms.map((room, idx) => {
                        const roomData = rooms.find(r => r.id === room.room_id);
                        return (
                          <div key={idx} className="bg-white/70 rounded-lg p-3 border border-purple-200">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <DoorOpen className="w-4 h-4 text-purple-600" />
                                  <span className="font-semibold text-slate-800">
                                    ห้อง {room.room_number} (ชั้น {room.floor})
                                  </span>
                                  {roomData?.status === 'available' && (
                                    <Badge className="bg-green-100 text-green-700 text-xs">ว่าง</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 mb-2">{room.reason}</p>
                                {roomData && (
                                  <div className="text-xs text-slate-500 space-y-0.5">
                                    <p>ราคา: {roomData.price?.toLocaleString()} บาท/วัน</p>
                                    {roomData.size && <p>ขนาด: {roomData.size} ตร.ม.</p>}
                                    {roomData.amenities && roomData.amenities.length > 0 && (
                                      <p>สิ่งอำนวยความสะดวก: {roomData.amenities.join(', ')}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                              {canAdd && roomData?.status === 'available' && (
                                <Button
                                  size="sm"
                                  onClick={() => handleBookRoom(room.room_id)}
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 flex-shrink-0"
                                >
                                  <Plus className="w-4 h-4 mr-1" />
                                  จองห้องนี้
                                </Button>
                              )}
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

          {/* Empty State */}
          {filteredBookings.length === 0 && filteredTempBookings.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-12 text-center">
                  <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">ไม่มีการจอง</h3>
                  <p className="text-slate-500">ไม่พบการจองในสถานะนี้ หรือไม่ตรงกับคำค้นหา</p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Temporary Bookings */}
          {filteredTempBookings.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2">
                <Badge className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
                  📋 รอยืนยัน
                </Badge>
                <span className="text-sm font-semibold text-slate-700">{filteredTempBookings.length} รายการ</span>
              </div>
              {filteredTempBookings.map((booking) => {
                const room = getRoomInfo(booking.room_id);
                const paymentMethodLabel = {
                  'cash': '💵 เงินสด',
                  'transfer': '🏦 โอนเงิน',
                  'qr_code': '📱 QR Code'
                }[booking.deposit_payment_method] || '-';

                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <Card className="relative overflow-hidden bg-white border-0 shadow-md hover:shadow-2xl transition-all duration-300 group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-400 via-blue-500 to-blue-600 group-hover:w-2 transition-all duration-300" />
                      <CardContent className="p-3 md:p-5 md:pl-6">
                        <div className="flex flex-col md:flex-row justify-between gap-3 md:gap-5">
                          <div className="flex-1 space-y-3 md:space-y-4">
                            <div className="flex items-start gap-2 md:gap-4">
                              <div className="w-12 md:w-14 h-12 md:h-14 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
                                <DoorOpen className="w-6 md:w-7 h-6 md:h-7 text-white" />
                              </div>
                              <div className="flex-1 pt-0 md:pt-1">
                                <div className="flex items-center gap-1 md:gap-2 mb-1 flex-wrap">
                                  <h3 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                                    ห้อง {room?.room_number || 'N/A'}
                                  </h3>
                                  <Badge className={`text-xs font-semibold px-2 py-0.5 ${booking.booking_type === 'daily' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {booking.booking_type === 'daily' ? '📅 รายวัน' : '🏠 รายเดือน'}
                                  </Badge>
                                </div>
                                <p className="text-sm text-slate-500 font-medium">ชั้น {room?.floor || '-'}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg md:rounded-xl p-3 md:p-4 border border-slate-200">
                              <div className="flex items-start gap-2 md:gap-3">
                                <User className="w-4 md:w-5 h-4 md:h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-[10px] md:text-xs text-slate-500 font-semibold uppercase tracking-wide">ผู้เข้าพัก</p>
                                  <p className="text-sm font-bold text-slate-800 truncate">{booking.guest_name || 'ไม่ระบุ'}</p>
                                  {booking.guest_phone && (
                                    <p className="text-[10px] md:text-xs text-slate-600 mt-0.5">{booking.guest_phone}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-start gap-2 md:gap-3">
                                <CalendarIcon className="w-4 md:w-5 h-4 md:h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-[10px] md:text-xs text-slate-500 font-semibold uppercase tracking-wide">วันที่</p>
                                  <p className="text-xs md:text-sm font-bold text-slate-800">{format(parseISO(booking.check_in_date), 'd MMM', { locale: th })}</p>
                                  {booking.check_out_date && (
                                    <p className="text-[10px] md:text-xs text-slate-600 mt-0.5">
                                      ถึง {format(parseISO(booking.check_out_date), 'd MMM', { locale: th })}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>

                            {booking.deposit_amount > 0 && (
                              <div className="bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 rounded-lg md:rounded-xl p-3 md:p-4 border border-indigo-200 shadow-sm">
                                <div className="flex items-start justify-between gap-2 md:gap-3">
                                  <div className="min-w-0">
                                    <p className="text-[10px] md:text-xs text-indigo-600 font-semibold uppercase tracking-wide mb-1">เงินมัดจำ</p>
                                    <p className="text-base md:text-lg font-bold text-indigo-900 truncate">
                                      {booking.deposit_amount.toLocaleString()} ฿
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <Badge className="bg-indigo-600 text-white text-[10px] md:text-xs whitespace-nowrap">{paymentMethodLabel}</Badge>
                                    {booking.deposit_slip_url && (
                                      <a
                                        href={booking.deposit_slip_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center justify-end gap-0.5 md:gap-1 mt-1 md:mt-2 text-indigo-600 hover:text-indigo-700 text-[10px] md:text-xs font-semibold hover:underline"
                                      >
                                        <Camera className="w-3 h-3 md:w-3.5 md:h-3.5" />
                                        ดูสลิป
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}

                            {booking.notes && (
                              <div className="bg-slate-100 rounded-lg p-2 md:p-3 border-l-4 border-slate-400">
                                <p className="text-[10px] md:text-xs text-slate-600 font-semibold uppercase tracking-wide mb-1">หมายเหตุ</p>
                                <p className="text-xs md:text-sm text-slate-700 line-clamp-2">{booking.notes}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-wrap md:flex-col gap-1.5 md:gap-2 justify-end md:justify-start">
                          <Button
                          size="sm"
                          className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 font-semibold px-3 md:px-4 text-xs md:text-sm"
                          onClick={() => {
                           if (booking.booking_type === 'monthly') {
                             // แสดง Dialog เพื่อยืนยันผู้เช่าสำหรับรายเดือน
                             setPendingTempBooking(booking);
                             setTenantFormData({
                               full_name: booking.guest_name || '',
                               phone: booking.guest_phone || '',
                               national_id: booking.guest_national_id || '',
                               email: booking.guest_email || ''
                             });
                             setConfirmTenantDialog(true);
                           } else {
                             // รายวัน ยืนยันโดยตรง
                             confirmTempBookingMutation.mutate({ tempBooking: booking, tenantId: null });
                           }
                          }}
                          disabled={confirmTempBookingMutation.isPending}
                          >
                          {confirmTempBookingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                          ยืนยัน
                          </Button>
                          <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteTemp(booking.id)}
                          className="border-red-300 text-red-600 hover:bg-red-50 font-semibold px-2.5 md:px-4 text-xs md:text-sm"
                          disabled={deleteTempBookingMutation.isPending}
                          >
                          <Trash2 className="w-3 md:w-4 h-3 md:h-4 mr-0.5 md:mr-1.5" />
                          <span className="hidden sm:inline">ลบ</span>
                          </Button>
                             {booking.booking_type === 'monthly' && (
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => {
                                   navigate(`${createPageUrl('BookingReceipt')}?tempId=${booking.id}`);
                                 }}
                                 className="border-purple-300 text-purple-600 hover:bg-purple-50 font-semibold px-2.5 md:px-4 text-xs md:text-sm"
                               >
                                 <FileText className="w-3 md:w-4 h-3 md:h-4 mr-0.5 md:mr-1.5" />
                                 <span className="hidden sm:inline">ดูใบจอง</span>
                                 <span className="sm:hidden">ดู</span>
                               </Button>
                             )}
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => handleEdit(booking)}
                               className="border-blue-300 text-blue-600 hover:bg-blue-50 font-semibold px-2.5 md:px-4 text-xs md:text-sm"
                             >
                               <Edit2 className="w-3 md:w-4 h-3 md:h-4 mr-0.5 md:mr-1.5" />
                               <span className="hidden sm:inline">แก้ไข</span>
                               <span className="sm:hidden">แก</span>
                             </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}



          <Dialog open={showCalendarDialog} onOpenChange={(open) => {
            setShowCalendarDialog(open);
          }}>
            <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-y-auto pointer-events-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold">ปฏิทินห้องพัก</DialogTitle>
                <p className="text-sm text-slate-500 mt-1">
                  💡 คลิกที่เซลล์สีเขียว (ห้องว่าง) เพื่อจองห้องได้เลย
                </p>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setCurrentCalendarDate(subWeeks(currentCalendarDate, 1))}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <div className="text-center">
                    <p className="font-semibold text-slate-800">
                      {format(weekDays[0], 'd MMM', { locale: th })} - {format(weekDays[6], 'd MMM yyyy', { locale: th })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentCalendarDate(new Date())}
                    >
                      วันนี้
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setCurrentCalendarDate(addWeeks(currentCalendarDate, 1))}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4 items-center text-sm bg-slate-50 p-3 rounded-lg">
                  <span className="font-semibold text-slate-700">สัญลักษณ์:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-50 border-2 border-green-200"></div>
                    <span className="text-slate-600">ว่าง (คลิกเพื่อจอง)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-yellow-100 border-2 border-yellow-300"></div>
                    <span className="text-slate-600">รอยืนยัน</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-blue-100 border-2 border-blue-300"></div>
                    <span className="text-slate-600">รายเดือน</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-indigo-100 border-2 border-indigo-300"></div>
                    <span className="text-slate-600">รายวัน</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-red-100 border-2 border-red-300"></div>
                    <span className="text-slate-600">ซ่อมบำรุง</span>
                  </div>
                </div>

                <div className="overflow-x-auto -mx-4 md:mx-0">
                  <div className="min-w-[600px] md:min-w-[800px]">
                    <div className="grid grid-cols-8 border-b-2 border-slate-200">
                      <div className="p-1.5 md:p-3 bg-slate-100 font-semibold text-slate-700 border-r border-slate-200 text-xs md:text-sm">
                        ห้อง
                      </div>
                      {weekDays.map((day, index) => (
                        <div
                          key={index}
                          className={`p-1.5 md:p-3 text-center border-r border-slate-200 text-xs md:text-sm ${
                            isSameDay(day, new Date()) ? 'bg-blue-50' : 'bg-slate-50'
                          }`}
                        >
                          <div className="font-semibold text-slate-800 text-[10px] md:text-sm">
                            {format(day, 'EEE', { locale: th })}
                          </div>
                          <div className={`text-[9px] md:text-xs ${
                            isSameDay(day, new Date()) ? 'text-blue-600 font-bold' : 'text-slate-500'
                          }`}>
                            {format(day, 'd MMM', { locale: th })}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="divide-y divide-slate-200">
                      {sortedRooms.map((room) => (
                        <div key={room.id} className="grid grid-cols-8 hover:bg-slate-50 transition-colors">
                          <div className="p-1.5 md:p-3 border-r border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-1 md:gap-2">
                              <DoorOpen className="w-3 md:w-4 h-3 md:h-4 text-blue-600" />
                              <span className="font-semibold text-slate-800 text-xs md:text-sm">{room.room_number}</span>
                            </div>
                            <div className="flex flex-col gap-0.5 md:gap-1 mt-0.5 md:mt-1">
                              <span className="text-[9px] md:text-xs text-slate-500">ชั้น {room.floor}</span>
                              <span className={`text-[8px] md:text-[10px] px-1 md:px-1.5 py-0.5 rounded-full w-fit ${
                                room.room_type === 'monthly' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {room.room_type === 'monthly' ? 'เดือน' : 'วัน'}
                              </span>
                            </div>
                          </div>

                          {weekDays.map((day, dayIndex) => {
                            const events = getRoomEvents(room.id, day);
                            const cellColor = getCellColor(events);
                            const isEmpty = events.length === 0 || !events.some(e => e.type === 'daily-booking' || e.type === 'monthly-booking' || e.type === 'temporary-booking');

                            return (
                              <div
                                key={dayIndex}
                                className={`p-1 md:p-2 min-h-[50px] md:min-h-[60px] border-r border-slate-200 transition-all ${cellColor} ${
                                  isEmpty && canAdd ? 'cursor-pointer hover:ring-2 hover:ring-green-400' : ''
                                }`}
                                onClick={() => isEmpty && handleCalendarCellClick(room, day, events)}
                                title={isEmpty && canAdd ? 'คลิกเพื่อจองห้อง' : ''}
                              >
                                <div className="space-y-0.5 md:space-y-1">
                                  {events.map((event, eventIndex) => (
                                    <div
                                      key={eventIndex}
                                      className={`text-[9px] md:text-xs p-0.5 md:p-1 rounded truncate cursor-pointer hover:opacity-80 ${
                                        event.type === 'monthly-booking' ? 'bg-blue-600 text-white' :
                                        event.type === 'daily-booking' ? 'bg-indigo-600 text-white' :
                                        event.type === 'temporary-booking' ? 'bg-yellow-500 text-white' :
                                        'bg-red-600 text-white'
                                      }`}
                                      title={`${event.label} - คลิกเพื่อจัดการ`}
                                      onClick={(e) => {
                                        e.stopPropagation();

                                        if (event.type === 'daily-booking' || event.type === 'monthly-booking') {
                                          setPendingActionBooking(event.booking);
                                          setBookingActionDialog(true);
                                        }
                                      }}
                                    >
                                      {event.type === 'maintenance' ? (
                                        <div className="flex items-center gap-0.5 md:gap-1">
                                          <Wrench className="w-2 md:w-3 h-2 md:h-3" />
                                          <span className="truncate">{event.label}</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-0.5 md:gap-1">
                                          <User className="w-2 md:w-3 h-2 md:h-3" />
                                          <span className="truncate">{event.label}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {events.length === 0 && (
                                    <div className="text-[10px] md:text-xs text-center text-green-600 font-semibold py-1 md:py-2">
                                      ว่าง
                                      {canAdd && <div className="text-[8px] md:text-[10px] text-green-500 mt-0.5">คลิก</div>}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <BookingFormDialog
            showDialog={showDialog}
            setShowDialog={setShowDialog}
            editingBooking={editingBooking}
            handleSubmit={handleSubmit}
            dialogBookingType={dialogBookingType}
            setDialogBookingType={setDialogBookingType}
            formData={formData}
            setFormData={setFormData}
            rooms={rooms}
            canEdit={canEdit}
            canAdd={canAdd}
            createTempMutation={createTempMutation}
            updateTempMutation={updateTempMutation}
            uploadingSlip={uploadingSlip}
            handleSlipUpload={handleSlipUpload}
            createPaymentOnBooking={createPaymentOnBooking}
            setCreatePaymentOnBooking={setCreatePaymentOnBooking}
            resetForm={resetForm}
          />
        </div>
      </div>

      <BookingConfirmTenantDialog 
        isOpen={confirmTenantDialog}
        onOpenChange={(open) => {
          setConfirmTenantDialog(open);
          if (!open) {
            setPendingTempBooking(null);
            setSelectedTenant(null);
          }
        }}
        pendingTempBooking={pendingTempBooking}
        rooms={rooms}
        tenants={tenants}
        selectedTenant={selectedTenant}
        setSelectedTenant={setSelectedTenant}
        createNewTenant={createNewTenant}
        setCreateNewTenant={setCreateNewTenant}
        tenantFormData={tenantFormData}
        setTenantFormData={setTenantFormData}
        confirmTempBookingMutation={confirmTempBookingMutation}
        selectedBranchId={selectedBranchId}
      />

      {/* Dialog ยืนยันการเข้าพัก */}
      <Dialog open={checkInConfirmDialog} onOpenChange={setCheckInConfirmDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              ยืนยันการเข้าพัก
            </DialogTitle>
          </DialogHeader>
          
          {pendingCheckInBooking && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="font-semibold text-slate-800">
                  ห้อง {rooms.find(r => r.id === pendingCheckInBooking.room_id)?.room_number}
                </p>
                <p className="text-sm text-slate-600">{pendingCheckInBooking.guest_name}</p>
              </div>
              
              {/* แสดงยอดที่ต้องชำระ */}
              {(pendingCheckInBooking.security_deposit > 0 || 
                pendingCheckInBooking.advance_rent > 0 || 
                pendingCheckInBooking.common_fee_included > 0) && (
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <h4 className="font-semibold text-blue-800 mb-2">ยอดคงเหลือที่ต้องชำระ</h4>
                  <div className="space-y-1 text-sm">
                    {pendingCheckInBooking.security_deposit > 0 && (
                      <div className="flex justify-between">
                        <span>เงินประกันห้อง:</span>
                        <span>{pendingCheckInBooking.security_deposit.toLocaleString()} บาท</span>
                      </div>
                    )}
                    {pendingCheckInBooking.advance_rent > 0 && (
                      <div className="flex justify-between">
                        <span>ค่าเช่าล่วงหน้า:</span>
                        <span>{pendingCheckInBooking.advance_rent.toLocaleString()} บาท</span>
                      </div>
                    )}
                    {pendingCheckInBooking.common_fee_included > 0 && (
                      <div className="flex justify-between">
                        <span>ค่าส่วนกลาง:</span>
                        <span>{pendingCheckInBooking.common_fee_included.toLocaleString()} บาท</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-blue-800 border-t border-blue-300 pt-2 mt-2">
                      <span>รวม:</span>
                      <span>
                        {(
                          (pendingCheckInBooking.security_deposit || 0) +
                          (pendingCheckInBooking.advance_rent || 0) +
                          (pendingCheckInBooking.common_fee_included || 0)
                        ).toLocaleString()} บาท
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="createPayment"
                      checked={createPaymentOnCheckIn}
                      onChange={(e) => setCreatePaymentOnCheckIn(e.target.checked)}
                      className="w-4 h-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="createPayment" className="text-sm text-blue-800">
                      สร้างรายการรอชำระในหน้าการชำระเงิน
                    </label>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setCheckInConfirmDialog(false);
                    setPendingCheckInBooking(null);
                  }}
                  disabled={confirmCheckInMutation.isPending}
                >
                  ยกเลิก
                </Button>
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    confirmCheckInMutation.mutate({
                      booking: pendingCheckInBooking,
                      shouldCreatePayment: createPaymentOnCheckIn && (
                        pendingCheckInBooking.security_deposit > 0 ||
                        pendingCheckInBooking.advance_rent > 0 ||
                        pendingCheckInBooking.common_fee_included > 0
                      )
                    });
                  }}
                  disabled={confirmCheckInMutation.isPending}
                >
                  {confirmCheckInMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังดำเนินการ...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      ยืนยันการเข้าพัก
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <PublicBookingSettingsDialog 
        isOpen={showSettingsDialog} 
        setIsOpen={setShowSettingsDialog} 
        configs={configs} 
        selectedBranchId={selectedBranchId} 
      />

      {/* Dialog ยกเลิก Booking */}
      <CancelBookingDialog 
        isOpen={cancelBookingDialog}
        setIsOpen={setCancelBookingDialog}
        pendingCancelBooking={pendingCancelBooking}
        setPendingCancelBooking={setPendingCancelBooking}
        cancelBookingMutation={cancelBookingMutation}
        rooms={rooms}
      />

      {/* Dialog เลือกการดำเนินการ Booking extracted */}

      {/* Dialog เช็คเอาท์ */}
      <CheckoutBookingDialog 
        isOpen={checkoutBookingDialog}
        setIsOpen={setCheckoutBookingDialog}
        pendingCheckoutBooking={pendingCheckoutBooking}
        setPendingCheckoutBooking={setPendingCheckoutBooking}
        checkoutBookingMutation={checkoutBookingMutation}
        rooms={rooms}
      />
    </div>
  );
}