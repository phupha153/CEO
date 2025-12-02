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
  Printer
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
import AISearchBox from "../components/shared/AISearchBox";
import AIResultCard from "../components/shared/AIResultCard";
import AIActionConfirmation from "../components/shared/AIActionConfirmation";

export default function BookingsPage() {
  const navigate = useNavigate();
  const [showDialog, setShowDialog] = useState(false);
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  const [editingBooking, setEditingBooking] = useState(null);
  const [uploadingSlip, setUploadingSlip] = useState(false);
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

  const [currentPage, setCurrentPage] = useState(1);
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

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const userPermissions = currentUser?.permissions || [];
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  const canViewAll = userRole === 'developer' || userPermissions.includes('bookings_view_all');
  const canViewDaily = userRole === 'developer' || userPermissions.includes('bookings_view_daily');
  const canViewMonthly = userRole === 'developer' || userPermissions.includes('bookings_view_monthly');
  const canView = canViewAll || canViewDaily || canViewMonthly;
  const canAdd = userRole === 'developer' || userPermissions.includes('bookings_add');
  const canEdit = userRole === 'developer' || userPermissions.includes('bookings_edit');
  const canDelete = userRole === 'developer' || userPermissions.includes('bookings_delete');
  const canCancel = userRole === 'developer' || userPermissions.includes('bookings_cancel_daily');
  const canCheckIn = userRole === 'developer' || userPermissions.includes('bookings_checkin');
  const canCheckOut = userRole === 'developer' || userPermissions.includes('bookings_checkout');

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: () => base44.entities.Booking.filter({ branch_id: selectedBranchId }, '-created_date', 5000),
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: () => base44.entities.Room.filter({ branch_id: selectedBranchId }, '-room_number', 5000),
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

  const selectedBranchName = useMemo(() => {
    return branches.find(branch => branch.id === selectedBranchId)?.name || 'ไม่ระบุสาขา';
  }, [branches, selectedBranchId]);

  const dailyBookings = useMemo(() => bookings.filter(b => b.booking_type === 'daily'), [bookings]);

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
        const room = dailyRoomsOnly.find(r => r.id === b.room_id);
        const tenant = b.tenant_id ? tenants.find(t => t.id === b.tenant_id) : null;
        return {
          room_id: b.room_id,
          room_number: room?.room_number || 'N/A',
          floor: room?.floor,
          guest_name: b.guest_name || tenant?.full_name || 'ไม่ระบุชื่อ',
          check_in_date: b.check_in_date,
          check_out_date: b.check_out_date || null, // null = ไม่มีกำหนดออก (รายเดือนหรือระยะยาว)
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

      // ฟังก์ชันหาวันที่ห้องจะว่าง
      const getRoomAvailabilityDate = (roomId) => {
        const roomBookings = bookingsData.filter(b => b.room_id === roomId);
        if (roomBookings.length === 0) return { available: true, availableFrom: todayStr, reason: 'ว่างอยู่แล้วตอนนี้' };
        
        // หา booking ที่ยังใช้งานอยู่ (check_in <= today และ ยังไม่ check_out)
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
          return { available: false, availableFrom: null, reason: `มีผู้เช่า (${currentTenant}) - ไม่มีกำหนดย้ายออก`, currentTenant };
        }
        
        if (latestCheckOut && latestCheckOut > todayStr) {
          return { available: false, availableFrom: latestCheckOut, reason: `จะว่างวันที่ ${latestCheckOut}`, currentTenant };
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

      // สร้าง prompt ที่ชัดเจน
      const promptText = `คุณเป็นผู้ช่วยค้นหาห้องพักรายวัน (DAILY ROOMS ONLY) ตอบแม่นยำที่สุด

📅 วันที่ปัจจุบัน: ${todayStr} (${format(today, 'd MMMM yyyy', { locale: th })})
📅 ปีปัจจุบัน: ${today.getFullYear()} (พ.ศ. ${today.getFullYear() + 543})

❓ คำถาม: "${searchQuery}"

=== 📊 สรุปห้องรายวันทั้งหมด (${roomsData.length} ห้อง) ===

🟢 ห้องที่ว่างตอนนี้ (${currentlyAvailable.length} ห้อง):
${currentlyAvailable.length > 0 ? currentlyAvailable.map(r => 
  `  - ห้อง ${r.room_number} ชั้น ${r.floor} (${r.price?.toLocaleString() || 0} บาท)`
).join('\n') : '  ไม่มีห้องว่าง'}

🟡 ห้องที่มีผู้เช่าแต่มีกำหนดว่าง (${willBeAvailable.length} ห้อง):
${willBeAvailable.length > 0 ? willBeAvailable.map(r => 
  `  - ห้อง ${r.room_number} ชั้น ${r.floor} → จะว่างวันที่ ${r.availableFrom} (ผู้เช่า: ${r.currentTenant})`
).join('\n') : '  ไม่มี'}

🔴 ห้องที่ไม่มีกำหนดย้ายออก (${noEndDate.length} ห้อง):
${noEndDate.length > 0 ? noEndDate.map(r => 
  `  - ห้อง ${r.room_number} ชั้น ${r.floor} → ${r.reason}`
).join('\n') : '  ไม่มี'}

=== 📋 รายละเอียดการจองที่ Active ===
${bookingsData.length > 0 ? JSON.stringify(bookingsData.map(b => ({
  ห้อง: b.room_number,
  ชั้น: b.floor,
  ผู้เช่า: b.guest_name,
  เข้าพัก: b.check_in_date,
  ย้ายออก: b.check_out_date || 'ไม่มีกำหนด'
})), null, 2) : 'ไม่มีการจอง'}

=== 🎯 วิธีตอบคำถาม ===

**ถ้าถามหา "ห้องว่างเดือน X" หรือ "ห้องว่างในเดือน X":**
- คำนวณช่วงวันที่ของเดือนนั้นๆ (เช่น กุมภาพันธ์ 2025 = 2025-02-01 ถึง 2025-02-28)
- ห้องจะว่างในเดือนนั้นได้ก็ต่อเมื่อ:
  1. ว่างอยู่แล้วตอนนี้ (available = true) หรือ
  2. มี availableFrom ที่ <= วันสุดท้ายของเดือนนั้น
- ห้องที่ไม่มีกำหนดย้ายออก (availableFrom = null) = ไม่นับว่าจะว่าง

**ถ้าถามหา "ห้องว่างตอนนี้" หรือ "ห้องว่างวันนี้":**
- ตอบเฉพาะห้องที่ available = true

**ถ้าถามหาห้องตามชั้น:**
- กรองตาม floor ที่ระบุ

**สำคัญมาก:**
- ต้องตอบ answer ที่ชัดเจน ระบุจำนวนห้องและเลขห้อง
- ต้องมี rooms array ที่มี room_id, room_number, floor, reason
- ห้องที่ไม่มี availableFrom = ไม่นับว่าจะว่างในอนาคต

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

      await createMutation.mutateAsync(bookingData);

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

    // Use all bookings, not just daily ones, to correctly show availability
    const roomBookings = bookings.filter(b => {
      if (b.room_id !== roomId || b.status === 'cancelled') return false;
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

    return 'bg-slate-50 hover:bg-slate-100 border-slate-200';
  };

  const handleCalendarCellClick = (room, date, events) => {
    const isEmptyOrOnlyMaintenance = !events.some(e => e.type === 'daily-booking' || e.type === 'monthly-booking');

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
      const hasMonthly = events.some(e => e.type === 'monthly-booking');
      const hasDaily = events.some(e => e.type === 'daily-booking');
      const hasMaintenance = events.some(e => e.type === 'maintenance');

      if (hasMonthly) {
        toast.error('ห้องนี้มีผู้เช่ารายเดือนอยู่');
      } else if (hasDaily) {
        toast.error('ห้องนี้มีการจองรายวันอยู่แล้ว');
      } else if (hasMaintenance) {
        toast.error('ห้องนี้อยู่ระหว่างการซ่อมบำรุง');
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!canAdd) {
        throw new Error('คุณไม่มีสิทธิ์เพิ่มการจอง');
      }

      const room = rooms.find(r => r.id === data.room_id);
      if (!room) {
        throw new Error('ไม่พบห้องที่เลือก');
      }

      const checkInDate = parseISO(data.check_in_date);
      const checkOutDate = data.check_out_date ? parseISO(data.check_out_date) : null;

      const conflictBooking = dailyBookings.find(b =>
        b.room_id === data.room_id &&
        b.status === 'active' &&
        ((isWithinInterval(checkInDate, {
          start: parseISO(b.check_in_date),
          end: parseISO(b.check_out_date || '9999-12-31')
        })) || (checkOutDate && isWithinInterval(checkOutDate, {
          start: parseISO(b.check_in_date),
          end: parseISO(b.check_out_date || '9999-12-31')
        })) || (
          parseISO(b.check_in_date) <= checkInDate &&
          parseISO(b.check_out_date || '9999-12-31') >= (checkOutDate || checkInDate)
        ))
      );

      if (conflictBooking) {
        throw new Error('ห้องนี้มีการจองอยู่แล้วในช่วงเวลาที่เลือก');
      }

      const booking = await base44.entities.Booking.create({ ...data, branch_id: selectedBranchId });
      

      
      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      queryClient.invalidateQueries(['rooms', selectedBranchId]);
      queryClient.invalidateQueries(['expenses', selectedBranchId]);
      setShowDialog(false);
      resetForm();
      toast.success('จองห้องสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (!canEdit) {
        throw new Error('คุณไม่มีสิทธิ์แก้ไขการจอง');
      }
      
      const oldBooking = bookings.find(b => b.id === id);
      const booking = await base44.entities.Booking.update(id, data);
      

      
      return booking;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      queryClient.invalidateQueries(['rooms', selectedBranchId]);
      queryClient.invalidateQueries(['expenses', selectedBranchId]);
      setShowDialog(false);
      resetForm();
      toast.success('อัปเดตการจองสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      if (!canDelete) {
        throw new Error('คุณไม่มีสิทธิ์ลบการจอง');
      }
      return base44.entities.Booking.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      queryClient.invalidateQueries(['rooms', selectedBranchId]);
      toast.success('ลบการจองสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (booking) => {
      if (!canCancel) {
        throw new Error('คุณไม่มีสิทธิ์ยกเลิกการจอง');
      }
      await base44.entities.Booking.update(booking.id, { status: 'cancelled' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      queryClient.invalidateQueries(['rooms', selectedBranchId]);
      toast.success('ยกเลิกการจองสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const [checkInConfirmDialog, setCheckInConfirmDialog] = useState(false);
  const [pendingCheckInBooking, setPendingCheckInBooking] = useState(null);
  const [createPaymentOnCheckIn, setCreatePaymentOnCheckIn] = useState(true);

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
        const today = new Date().toISOString().split('T')[0];
        const dueDate = booking.contract_deadline || today;
        
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
            room_id: booking.room_id,
            payment_category: 'security_deposit',
            due_date: dueDate,
            security_deposit_amount: securityDeposit,
            advance_rent_amount: advanceRent,
            common_fee_amount: commonFee,
            total_amount: totalRemaining,
            status: 'pending',
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
    
    // คำนวณยอดรวม
    const depositAmount = formData.deposit_amount ? parseFloat(formData.deposit_amount) : 0;
    const securityDeposit = formData.security_deposit ? parseFloat(formData.security_deposit) : 0;
    const advanceRent = formData.advance_rent ? parseFloat(formData.advance_rent) : 0;
    const commonFeeIncluded = formData.common_fee_included ? parseFloat(formData.common_fee_included) : 0;
    const totalBookingAmount = depositAmount + securityDeposit + advanceRent + commonFeeIncluded;
    const remainingAmount = securityDeposit + advanceRent + commonFeeIncluded;
    
    // สร้างเลขที่ใบจอง
    const bookingNo = formData.booking_no || format(new Date(), 'dd-MM-yy');
    
    const data = {
      ...formData,
      booking_no: bookingNo,
      deposit_amount: depositAmount,
      security_deposit: securityDeposit,
      advance_rent: advanceRent,
      common_fee_included: commonFeeIncluded,
      total_booking_amount: totalBookingAmount,
      remaining_amount: remainingAmount,
      total_amount: 0,
      booking_type: 'daily',
      status: 'active'
    };

    if (editingBooking) {
      updateMutation.mutate({ id: editingBooking.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (booking) => {
    if (!canEdit) {
      toast.error('คุณไม่มีสิทธิ์แก้ไขการจอง');
      return;
    }
    setEditingBooking(booking);
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

  const handleDelete = (id) => {
    if (!canDelete) {
      toast.error('คุณไม่มีสิทธิ์ลบการจอง');
      return;
    }
    if (confirm('คุณแน่ใจว่าต้องการลบการจองนี้?')) {
      deleteMutation.mutate(id);
    }
  };

  const resetForm = () => {
    setEditingBooking(null);
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
    if (!debouncedSearch.trim()) return dailyBookings;

    const query = debouncedSearch.toLowerCase();
    return dailyBookings.filter(booking => {
      const room = getRoomInfo(booking.room_id);
      return booking.guest_name?.toLowerCase().includes(query) ||
             booking.guest_phone?.toLowerCase().includes(query) ||
             room?.room_number?.toLowerCase().includes(query);
    });
  }, [dailyBookings, debouncedSearch, rooms]);

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

  if (bookingsLoading) {
    return (
      <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-600 text-lg">กำลังโหลดข้อมูลการจอง...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader
        title="การจองห้อง"
        subtitle={`สาขา ${selectedBranchName}`}
        icon={Calendar}
        actions={
          <>
            <Button
              onClick={() => {
                setCurrentCalendarDate(new Date());
                setShowCalendarDialog(true);
              }}
              variant="outline"
              className="border-purple-600 text-purple-600 hover:bg-purple-50 shadow-md"
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              ปฏิทิน
            </Button>
            {canAdd && (
              <Button
                onClick={() => {
                  setEditingBooking(null);
                  setFormData({
                    room_id: '',
                    guest_name: '',
                    guest_phone: '',
                    guest_email: '',
                    check_in_date: new Date().toISOString().split('T')[0],
                    check_out_date: '',
                    booking_type: 'daily',
                    deposit_amount: 0,
                    deposit_payment_method: 'cash',
                    total_amount: 0,
                    notes: ''
                  });
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
              <AISearchBox
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onAISearch={handleAISearch}
                onStopSearch={() => setAiSearching(false)}
                aiSearching={aiSearching}
                placeholder="ค้นหาการจอง หรือถามเช่น 'จองห้อง 101 วันที่ 25' 'ห้องว่างชั้น 3'"
              />

              {aiAction && (
                <AIActionConfirmation
                  action={aiAction}
                  onConfirm={handleAIActionConfirm}
                  onCancel={handleAIActionCancel}
                  isLoading={aiActionLoading}
                  allowSlipUpload={true}
                  roomInfo={aiAction.data?.room_id ? rooms.find(r => r.id === aiAction.data.room_id) : null}
                />
              )}

              {aiResult && !aiAction && (
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

          <div className="grid grid-cols-1 gap-4">
            {paginatedBookings.length === 0 && (filteredBookings.length > 0 ? (
              <Card className="col-span-full p-6 text-center text-slate-600">
                <p>ไม่พบการจองในหน้านี้</p>
              </Card>
            ) : (
              <Card className="col-span-full p-6 text-center text-slate-600">
                <p>ไม่พบการจองรายวันในระบบ หรือไม่ตรงกับคำค้นหาของคุณ</p>
              </Card>
            ))}
            {paginatedBookings.map((booking) => {
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
                  <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all">
                    <CardContent className="p-6">
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                              <DoorOpen className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <h3 className="text-xl font-bold text-slate-800">
                                ห้อง {room?.room_number || 'N/A'}
                              </h3>
                              <p className="text-sm text-slate-500">รายวัน</p>
                            </div>
                            {getStatusBadge(booking.status)}
                          </div>

                          <div className="grid md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-2 text-slate-600">
                              <User className="w-4 h-4" />
                              <div>
                                <span className="text-sm font-semibold">{booking.guest_name || 'ไม่ระบุ'}</span>
                                {booking.guest_phone && (
                                  <p className="text-xs text-slate-500">{booking.guest_phone}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-slate-600">
                              <CalendarIcon className="w-4 h-4" />
                              <div className="text-sm">
                                <p>{format(parseISO(booking.check_in_date), 'd MMM yyyy', { locale: th })}</p>
                                {booking.check_out_date && (
                                  <p className="text-xs text-slate-500">
                                    ถึง {format(parseISO(booking.check_out_date), 'd MMM yyyy', { locale: th })}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {booking.deposit_amount > 0 && (
                            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                              <p className="text-sm font-semibold text-blue-800 mb-1">
                                💰 เงินมัดจำ: {booking.deposit_amount.toLocaleString()} บาท
                              </p>
                              <div className="flex items-center gap-4 text-xs text-blue-700">
                                <span>ชำระผ่าน: {paymentMethodLabel}</span>
                                {booking.deposit_slip_url && (
                                  <a
                                    href={booking.deposit_slip_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 hover:underline"
                                  >
                                    <Camera className="w-3 h-3" />
                                    ดูสลิป
                                  </a>
                                )}
                              </div>
                            </div>
                          )}

                          {booking.notes && (
                            <p className="text-sm text-slate-600">
                              หมายเหตุ: {booking.notes}
                            </p>
                          )}
                        </div>

                        <div className="flex md:flex-col gap-2">
                          {canEdit && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEdit(booking)}
                              disabled={updateMutation.isPending}
                              title="แก้ไข"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="outline"
                              size="icon"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleDelete(booking.id)}
                              disabled={deleteMutation.isPending}
                              title="ลบ"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                          {booking.status === 'active' && !booking.actual_check_in_date && canCheckIn && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-green-50 text-green-700 hover:bg-green-100 border-green-300"
                              onClick={() => handleConfirmCheckIn(booking)}
                              disabled={confirmCheckInMutation.isPending}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-2" />
                              ยืนยันการเข้าพัก
                            </Button>
                          )}
                          {booking.actual_check_in_date && (
                            <Badge className="bg-green-100 text-green-700 text-xs">
                              ยืนยันแล้ว
                            </Badge>
                          )}
                          {booking.status === 'active' && canCancel && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="md:mt-auto"
                              onClick={() => {
                                if (confirm('คุณแน่ใจว่าต้องการยกเลิกการจองนี้?')) {
                                  cancelMutation.mutate(booking);
                                }
                              }}
                              disabled={cancelMutation.isPending}
                            >
                              ยกเลิกการจอง
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(createPageUrl('BookingReceipt') + `?id=${booking.id}`)}
                            className="text-purple-600 hover:bg-purple-50 border-purple-200"
                          >
                            <FileText className="w-4 h-4 mr-1" />
                            ใบจอง
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-slate-600">
                    แสดง {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredBookings.length)} จาก {filteredBookings.length} รายการ
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" />
                      ก่อนหน้า
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
                      ถัดไป
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
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
                  <Button
                    variant="outline"
                    onClick={() => setCurrentCalendarDate(new Date())}
                  >
                    วันนี้
                  </Button>
                </div>

                <div className="flex flex-wrap gap-4 items-center text-sm bg-slate-50 p-3 rounded-lg">
                  <span className="font-semibold text-slate-700">สัญลักษณ์:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded bg-green-50 border-2 border-green-200"></div>
                    <span className="text-slate-600">ว่าง (คลิกเพื่อจอง)</span>
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

                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    <div className="grid grid-cols-8 border-b-2 border-slate-200">
                      <div className="p-3 bg-slate-100 font-semibold text-slate-700 border-r border-slate-200 text-sm">
                        ห้อง
                      </div>
                      {weekDays.map((day, index) => (
                        <div
                          key={index}
                          className={`p-3 text-center border-r border-slate-200 text-sm ${
                            isSameDay(day, new Date()) ? 'bg-blue-50' : 'bg-slate-50'
                          }`}
                        >
                          <div className="font-semibold text-slate-800">
                            {format(day, 'EEE', { locale: th })}
                          </div>
                          <div className={`text-xs ${
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
                          <div className="p-3 border-r border-slate-200 bg-slate-50">
                            <div className="flex items-center gap-2">
                              <DoorOpen className="w-4 h-4 text-blue-600" />
                              <span className="font-semibold text-slate-800 text-sm">{room.room_number}</span>
                            </div>
                            <div className="flex flex-col gap-1 mt-1">
                              <span className="text-xs text-slate-500">ชั้น {room.floor}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full w-fit ${
                                room.room_type === 'monthly' 
                                  ? 'bg-blue-100 text-blue-700' 
                                  : 'bg-orange-100 text-orange-700'
                              }`}>
                                {room.room_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}
                              </span>
                            </div>
                          </div>

                          {weekDays.map((day, dayIndex) => {
                            const events = getRoomEvents(room.id, day);
                            const cellColor = getCellColor(events);
                            const isEmpty = events.length === 0 || !events.some(e => e.type === 'daily-booking' || e.type === 'monthly-booking');

                            return (
                              <div
                                key={dayIndex}
                                className={`p-2 min-h-[60px] border-r border-slate-200 transition-all ${cellColor} ${
                                  isEmpty && canAdd ? 'cursor-pointer hover:ring-2 hover:ring-green-400' : ''
                                }`}
                                onClick={() => handleCalendarCellClick(room, day, events)}
                                title={isEmpty && canAdd ? 'คลิกเพื่อจองห้อง' : ''}
                              >
                                <div className="space-y-1">
                                  {events.map((event, eventIndex) => (
                                    <div
                                      key={eventIndex}
                                      className={`text-xs p-1 rounded truncate ${
                                        event.type === 'monthly-booking' ? 'bg-blue-600 text-white' :
                                        event.type === 'daily-booking' ? 'bg-indigo-600 text-white' :
                                        'bg-red-600 text-white'
                                      }`}
                                      title={event.label}
                                    >
                                      {event.type === 'maintenance' ? (
                                        <div className="flex items-center gap-1">
                                          <Wrench className="w-3 h-3" />
                                          <span className="truncate">{event.label}</span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <User className="w-3 h-3" />
                                          <span className="truncate">{event.label}</span>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                  {events.length === 0 && (
                                    <div className="text-xs text-center text-green-600 font-semibold py-2">
                                      ว่าง
                                      {canAdd && <div className="text-[10px] text-green-500 mt-0.5">คลิกเพื่อจอง</div>}
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

          <Dialog open={showDialog} onOpenChange={(open) => {
            setShowDialog(open);
            if (!open) {
              resetForm();
            }
          }}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
              <DialogHeader>
                <DialogTitle>{editingBooking ? 'แก้ไขการจองห้องรายวัน' : 'จองห้องพักรายวัน'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>เลือกห้อง *</Label>
                  <select
                    value={formData.room_id}
                    onChange={(e) => {
                      const selectedRoom = rooms.find(r => r.id === e.target.value);
                      setFormData({ 
                        ...formData, 
                        room_id: e.target.value,
                        // ถ้าเลือกห้องแล้ว ให้ดึงค่าเริ่มต้นจากราคาห้อง
                        security_deposit: selectedRoom ? selectedRoom.price?.toString() : '',
                        advance_rent: selectedRoom ? selectedRoom.price?.toString() : '',
                        common_fee_included: selectedRoom?.common_fee?.toString() || ''
                      });
                    }}
                    required
                    className="w-full p-2 border rounded-md"
                    disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                  >
                    <option value="">เลือกห้อง</option>
                    {rooms
                      .sort((a, b) => {
                        if (a.floor !== b.floor) return a.floor - b.floor;
                        return a.room_number.localeCompare(b.room_number);
                      })
                      .map(room => {
                        const statusText = room.status === 'available' ? 'ว่าง' :
                                          room.status === 'occupied' ? 'มีผู้เช่า' : 'จอง';
                        return (
                          <option key={room.id} value={room.id}>
                            ห้อง {room.room_number} - ชั้น {room.floor} ({room.price?.toLocaleString()} บาท) - {statusText}
                          </option>
                        );
                      })}
                  </select>
                  {formData.room_id && (() => {
                    const selectedRoom = rooms.find(r => r.id === formData.room_id);
                    if (selectedRoom && selectedRoom.status === 'occupied') {
                      return (
                        <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          ห้องนี้มีผู้เช่ารายเดือนอยู่แล้ว
                        </p>
                      );
                    }
                  })()}
                </div>

                {/* ข้อมูลผู้จอง */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    👤 ข้อมูลผู้จอง
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>ชื่อผู้เข้าพัก *</Label>
                      <Input
                        value={formData.guest_name}
                        onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                        required
                        placeholder="ชื่อ-นามสกุล"
                        disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                      />
                    </div>
                    <div>
                      <Label>เบอร์โทรศัพท์ *</Label>
                      <Input
                        value={formData.guest_phone}
                        onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                        required
                        placeholder="0812345678"
                        disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
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
                        disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                      />
                    </div>
                    <div>
                      <Label>อีเมล</Label>
                      <Input
                        type="email"
                        value={formData.guest_email}
                        onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                        placeholder="email@example.com"
                        disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                      />
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <Label>ที่อยู่</Label>
                    <Input
                      value={formData.guest_address}
                      onChange={(e) => setFormData({ ...formData, guest_address: e.target.value })}
                      placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
                      disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                    />
                  </div>
                </div>

                {/* วันที่และเงื่อนไขสัญญา */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    📅 วันที่และเงื่อนไขสัญญา
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>วันที่จอง/เข้าพัก *</Label>
                      <Input
                        type="date"
                        value={formData.check_in_date}
                        onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                        required
                        disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                      />
                    </div>
                    <div>
                      <Label>ระยะเวลาสัญญา</Label>
                      <Select
                        value={formData.contract_duration}
                        onValueChange={(value) => setFormData({ ...formData, contract_duration: value })}
                        disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
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
                  </div>
                  <div className="mt-3">
                    <Label>กำหนดทำสัญญาภายในวันที่</Label>
                    <Input
                      type="date"
                      value={formData.contract_deadline}
                      onChange={(e) => setFormData({ ...formData, contract_deadline: e.target.value })}
                      disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                    />
                    <p className="text-xs text-slate-500 mt-1">หากพ้นกำหนดนี้ถือว่าสละสิทธิ์</p>
                  </div>
                </div>

                {/* รายละเอียดการชำระเงิน */}
                <div className="border-t pt-4">
                  <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    💰 รายละเอียดการชำระเงิน
                  </h3>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>เงินจองห้อง (บาท)</Label>
                        <Input
                          type="number"
                          value={formData.deposit_amount}
                          onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                          placeholder="2,000"
                          disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                        />
                      </div>
                      <div>
                        <Label>เงินประกันห้อง (บาท)</Label>
                        <Input
                          type="number"
                          value={formData.security_deposit}
                          onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })}
                          placeholder="6,000"
                          disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
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
                          disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                        />
                      </div>
                      <div>
                        <Label>รวมส่วนกลาง (บาท)</Label>
                        <Input
                          type="number"
                          value={formData.common_fee_included}
                          onChange={(e) => setFormData({ ...formData, common_fee_included: e.target.value })}
                          placeholder="0"
                          disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                        />
                      </div>
                    </div>
                    
                    {/* แสดงสรุปยอดเงิน */}
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
                    
                    <div>
                      <Label>วิธีการชำระเงิน</Label>
                      <Select
                        value={formData.deposit_payment_method}
                        onValueChange={(value) => setFormData({ ...formData, deposit_payment_method: value })}
                        disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
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
                              {uploadingSlip ? 'กำลังอัปโหลด...' : 'คลิกเพื่ออัปโหลดสลิป'}
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleSlipUpload}
                              disabled={uploadingSlip || createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
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
                              disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
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
                    disabled={createMutation.isPending || updateMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                    placeholder="หมายเหตุเพิ่มเติม..."
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
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
                    disabled={
                      createMutation.isPending ||
                      updateMutation.isPending ||
                      (editingBooking ? !canEdit : !canAdd)
                    }
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'กำลังบันทึก...' : (editingBooking ? 'อัปเดต' : 'จองห้อง')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
    </div>
  );
}