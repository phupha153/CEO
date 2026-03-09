import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MapPin, 
  Home, 
  Maximize2, 
  Phone, 
  Mail, 
  User, 
  CreditCard, 
  Check, 
  X,
  Loader2,
  Building2,
  Bed,
  Users,
  Calendar,
  Search,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import PublicProfileDialog from '@/components/public/PublicProfileDialog';

export default function PublicBooking() {
  const urlParams = new URLSearchParams(window.location.search);
  let branchIdParam = urlParams.get('branchId');

  // Handle LINE LIFF redirect state
  if (!branchIdParam && urlParams.get('liff.state')) {
    try {
      const stateStr = urlParams.get('liff.state');
      const stateParams = new URLSearchParams(stateStr.startsWith('?') ? stateStr.substring(1) : stateStr);
      if (stateParams.get('branchId')) {
        branchIdParam = stateParams.get('branchId');
      }
    } catch (e) {
      console.error('Error parsing liff.state:', e);
    }
  }

  const [branchId, setBranchId] = useState(branchIdParam || localStorage.getItem('public_booking_branch_id'));

  useEffect(() => {
    if (branchIdParam) {
      localStorage.setItem('public_booking_branch_id', branchIdParam);
      if (branchId !== branchIdParam) {
        setBranchId(branchIdParam);
      }
    }
  }, [branchIdParam]);

  const [lineProfile, setLineProfile] = useState(null);
  const [showProfileDialog, setShowProfileDialog] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [showInitialDialog, setShowInitialDialog] = useState(true);
  const [detailRoom, setDetailRoom] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);
  const [depositSlipUrl, setDepositSlipUrl] = useState('');
  const [bookingStep, setBookingStep] = useState(1);
  const [tempSearchDate, setTempSearchDate] = useState(new Date().toISOString().split('T')[0]);
  const [tempCheckOutDate, setTempCheckOutDate] = useState('');
  const [tempNumberOfGuests, setTempNumberOfGuests] = useState(1);
  const [isRoomSelected, setIsRoomSelected] = useState(false);
  const [createdBooking, setCreatedBooking] = useState(null);
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    guest_national_id: '',
    guest_address: '',
    number_of_guests: 1,
    booking_type: 'monthly',
    check_in_date: new Date().toISOString().split('T')[0],
    check_out_date: '',
    line_user_id: ''
  });

  const [isLineConnecting, setIsLineConnecting] = useState(false);
  const [liffError, setLiffError] = useState(null);

  // Fetch branch info
  const { data: branch, isLoading: branchLoading } = useQuery({
    queryKey: ['publicBranch', branchId],
    queryFn: async () => {
      if (!branchId) return null;
      const branches = await base44.entities.Branch.filter({ id: branchId });
      return branches[0] || null;
    },
    enabled: !!branchId,
    staleTime: Infinity
  });

  // Fetch branch and global configs
  const { data: configsData } = useQuery({
    queryKey: ['publicConfigs', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const [branchConfigs, globalConfigs] = await Promise.all([
        base44.entities.Config.filter({ branch_id: branchId }),
        base44.entities.Config.filter({ branch_id: null }) // ดึง config ส่วนกลาง (Global)
      ]);
      return [...(branchConfigs || []), ...(globalConfigs || [])];
    },
    enabled: !!branchId,
    staleTime: Infinity
  });

  const configs = configsData || [];

  const bankName = configs.find(c => c.key === 'bank_name')?.value || '';
  const bankAccount = configs.find(c => c.key === 'bank_account')?.value || '';
  const bankAccountName = configs.find(c => c.key === 'bank_account_name')?.value || '';
  const buildingLogo = configs.find(c => c.key === 'building_logo')?.value || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/58da6a306_DC4395DB-4B27-4859-85B3-4F2948654F9E.png';

  const bookingPaymentType = configs.find(c => c.key === 'public_booking_payment_type')?.value || 'deposit';
  const dailyDepositAmount = parseFloat(configs.find(c => c.key === 'public_booking_daily_deposit')?.value) || parseFloat(configs.find(c => c.key === 'public_booking_deposit')?.value) || 200;
  const monthlySecurityDeposit = parseFloat(configs.find(c => c.key === 'public_booking_monthly_security_deposit')?.value) || 0;
  const monthlyAdvanceRentMonths = parseFloat(configs.find(c => c.key === 'public_booking_monthly_advance_rent_months')?.value) || 0;
  const monthlyCommonFeeMonths = parseFloat(configs.find(c => c.key === 'public_booking_monthly_common_fee_months')?.value) || 0;
  const monthlyBookingDepositAmount = parseFloat(configs.find(c => c.key === 'public_booking_monthly_booking_deposit')?.value) || 1000;

  const diffTime = formData.check_out_date ? Math.abs(new Date(formData.check_out_date) - new Date(formData.check_in_date)) : 0;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
  const nights = diffDays;

  let breakdown = [];
  let calculatedDeposit = 0;
  
  if (selectedRoom) {
    if (formData.booking_type === 'daily') {
      if (bookingPaymentType === 'full') {
        const roomTotal = nights * (selectedRoom.price || 0);
        calculatedDeposit = roomTotal;
        breakdown.push({ label: `ค่าห้องพัก ${nights} คืน`, amount: roomTotal });
      } else {
        calculatedDeposit = dailyDepositAmount;
        breakdown.push({ label: 'ค่ามัดจำจองห้อง', amount: dailyDepositAmount });
      }
    } else {
      const advanceRentAmount = monthlyAdvanceRentMonths * (selectedRoom.price || 0);
      const commonFeeAmount = monthlyCommonFeeMonths * (selectedRoom.common_fee || 0);
      
      if (bookingPaymentType === 'full') {
        calculatedDeposit = monthlySecurityDeposit + advanceRentAmount + commonFeeAmount;
        if (monthlySecurityDeposit > 0) breakdown.push({ label: 'เงินประกัน/มัดจำ', amount: monthlySecurityDeposit });
        if (advanceRentAmount > 0) breakdown.push({ label: `ค่าเช่าล่วงหน้า ${monthlyAdvanceRentMonths} เดือน`, amount: advanceRentAmount });
        if (commonFeeAmount > 0) breakdown.push({ label: `ค่าส่วนกลางล่วงหน้า ${monthlyCommonFeeMonths} เดือน`, amount: commonFeeAmount });
      } else {
        calculatedDeposit = monthlyBookingDepositAmount;
        breakdown.push({ label: 'ค่ามัดจำจองห้อง', amount: monthlyBookingDepositAmount });
        
        const checkInTotal = monthlySecurityDeposit + advanceRentAmount + commonFeeAmount - monthlyBookingDepositAmount;
        if (checkInTotal > 0) {
          breakdown.push({ label: 'ส่วนที่เหลือที่ต้องชำระวันเข้าพัก', amount: checkInTotal, isInfo: true });
        }
      }
    }
  }

  // Fetch ALL rooms + bookings to check availability (moved up for dependency)
  const { data: allRoomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['publicAllRooms', branchId, searchDate],
    queryFn: async () => {
      if (!branchId) return [];
      const rooms = await base44.entities.Room.filter({ branch_id: branchId }, '', 1000);
      return rooms || [];
    },
    enabled: !!branchId && !showInitialDialog,
    staleTime: 30000
  });

  // Initialize LIFF and handle login state
  useEffect(() => {
    const liffId = configs.find(c => c.key === 'liff_id')?.value;
    if (!liffId) return; // Wait until config is loaded

    const initLiff = async () => {
      try {
        if (!window.liff.id) {
          await window.liff.init({ liffId });
        }
        
        if (window.liff.isLoggedIn()) {
          const profile = await window.liff.getProfile();
          setLineProfile(profile);
          setFormData(prev => ({
            ...prev,
            guest_name: prev.guest_name || profile.displayName,
            line_user_id: profile.userId
          }));

          // Handle pending booking here to ensure order of execution
          const pendingRoomId = localStorage.getItem('pendingBookingRoomId');
          if (pendingRoomId && allRoomsData && allRoomsData.length > 0) {
            const room = allRoomsData.find(r => r.id === pendingRoomId);
            if (room) {
              localStorage.removeItem('pendingBookingRoomId');
              setSelectedRoom(room);
              setFormData(prev => ({ 
                ...prev, 
                check_in_date: searchDate,
                guest_name: profile.displayName,
                line_user_id: profile.userId
              }));
              setIsRoomSelected(true);
              setShowBookingForm(true);
            }
          }
        }
      } catch (err) {
        console.error('LIFF init/profile error:', err);
      }
    };

    if (window.liff) {
      initLiff();
    } else {
      const script = document.createElement('script');
      script.id = 'liff-sdk';
      script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
      script.async = true;
      script.onload = initLiff;
      document.body.appendChild(script);
    }
  }, [configs, allRoomsData, searchDate]);

  const handleRoomSelect = async (room) => {
    const proceedToBooking = () => {
      setSelectedRoom(room);
      setFormData(prev => ({ ...prev, check_in_date: searchDate }));
      setIsRoomSelected(true);
      setShowBookingForm(true);
    };

    const liffId = configs.find(c => c.key === 'liff_id')?.value;
    
    // ถ้าไม่ได้ตั้งค่า LINE LIFF ไว้เลย อนุญาตให้จองได้เลย (ป้องกันระบบพังถ้าแอดมินลืมใส่ liff_id)
    if (!liffId) {
      proceedToBooking();
      return;
    }

    if (!window.liff) {
      toast.error('ระบบ LINE ยังโหลดไม่เสร็จ กรุณารอสักครู่แล้วลองอีกครั้ง');
      return;
    }

    try {
      if (!window.liff.id) {
        try {
          await window.liff.init({ liffId });
        } catch (initErr) {
          console.warn('LIFF init warning:', initErr);
        }
      }

      if (!window.liff.isLoggedIn()) {
        // บังคับล็อกอินเท่านั้น ไม่ยอมให้ proceedToBooking
        localStorage.setItem('pendingBookingRoomId', room.id);
        const redirectUrl = new URL(window.location.href);
        redirectUrl.searchParams.delete('liff.state');
        redirectUrl.searchParams.set('branchId', branchId);
        window.liff.login({ redirectUri: redirectUrl.toString() });
      } else {
        proceedToBooking();
      }
    } catch (err) {
      console.error('LINE Login Error', err);
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ LINE กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleLineLogin = async () => {
    try {
      const liffId = configs.find(c => c.key === 'liff_id')?.value;
      if (!liffId) {
        toast.error('ยังไม่มีการตั้งค่า LINE Login ในระบบ');
        return;
      }
      
      if (!window.liff) {
        toast.error('ระบบ LINE ยังโหลดไม่เสร็จ กรุณารอสักครู่');
        return;
      }

      if (!window.liff.id) {
        try {
          await window.liff.init({ liffId });
        } catch (initErr) {
          console.warn('LIFF init warning:', initErr);
        }
      }

      if (!window.liff.isLoggedIn()) {
        const redirectUrl = new URL(window.location.href);
        redirectUrl.searchParams.delete('liff.state');
        redirectUrl.searchParams.set('branchId', branchId);
        window.liff.login({ redirectUri: redirectUrl.toString() });
      }
    } catch (err) {
      console.error('LINE Login Action Error', err);
      toast.error('ไม่สามารถเข้าสู่ระบบด้วย LINE ได้');
    }
  };

  const { data: bookingsData } = useQuery({
    queryKey: ['publicBookings', branchId, searchDate],
    queryFn: async () => {
      if (!branchId || !searchDate) return [];
      const [bookings, tempBookings] = await Promise.all([
        base44.entities.Booking.filter({ 
          branch_id: branchId,
          status: 'active'
        }, '', 1000),
        base44.entities.TemporaryBooking.filter({
          branch_id: branchId
        }, '', 1000)
      ]);
      return [...(bookings || []), ...(tempBookings || [])];
    },
    enabled: !!branchId && !!searchDate && !showInitialDialog,
    staleTime: 30000
  });

  // Check which rooms are available on selected date
  const rooms = (allRoomsData || []).map(room => {
    const reqStart = new Date(searchDate);
    const reqEnd = formData.check_out_date ? new Date(formData.check_out_date) : new Date(reqStart.getTime() + 24*60*60*1000);
    
    let isOccupied = (bookingsData || []).some(booking => {
      if (booking.room_id !== room.id) return false;
      
      const checkIn = new Date(booking.check_in_date);
      const checkOut = booking.check_out_date ? new Date(booking.check_out_date) : null;
      
      if (checkOut) {
        return reqStart < checkOut && reqEnd > checkIn;
      } else {
        return reqEnd > checkIn;
      }
    });

    if (!isOccupied && room.room_type === 'monthly' && room.status !== 'available') {
      isOccupied = true;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (!isOccupied && room.room_type === 'daily' && room.status !== 'available' && reqStart <= today) {
      isOccupied = true;
    }

    return {
      ...room,
      isAvailable: !isOccupied
    };
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookingData) => {
      const response = await base44.functions.invoke('createPublicBooking', bookingData);
      return response.data;
    },
    onSuccess: (data) => {
      setShowBookingForm(false);
      setCreatedBooking({...data, room: selectedRoom});
      // ตั้งค่า localStorage เพื่อให้ Bookings Management เห็นการจองนี้
      localStorage.setItem('selected_branch_id', branchId);
      if (branch) {
        localStorage.setItem('selected_branch_name', branch.branch_name);
      }
      // ⭐ CRITICAL: บังคับล้าง cache ของ window อื่นด้วย storage event
      window.dispatchEvent(new Event('storage'));
      setShowSuccessDialog(true);
      setFormData({
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        guest_national_id: '',
        guest_address: '',
        number_of_guests: 1,
        booking_type: 'monthly',
        check_in_date: new Date().toISOString().split('T')[0],
        check_out_date: ''
      });
      setSelectedRoom(null);
    },
    onError: (error) => {
      console.error('❌ Booking error:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      toast.error(error.response?.data?.error || error.message || 'เกิดข้อผิดพลาดในการจอง');
    }
  });

  const handleNextStep = (e) => {
    e.preventDefault();

    if (!formData.guest_name || !formData.guest_phone) {
      toast.error('กรุณากรอกชื่อและเบอร์โทรศัพท์');
      return;
    }

    if (!formData.check_out_date) {
      toast.error('กรุณาระบุวันที่เช็คเอาท์');
      return;
    }

    if (formData.check_out_date <= formData.check_in_date) {
      toast.error('วันที่เช็คเอาท์ต้องหลังจากวันที่เช็คอิน');
      return;
    }

    setBookingStep(2);
  };

  const handleSubmitPayment = (e) => {
    e.preventDefault();

    if (!depositSlipUrl) {
      toast.error('กรุณาอัปโหลดสลิปการโอนเงิน');
      return;
    }

    const bookingPayload = {
      ...formData,
      room_id: selectedRoom.id,
      branch_id: branchId,
      deposit_slip_url: depositSlipUrl,
      deposit_amount: publicBookingDeposit
    };

    console.log('📤 Sending booking data:', bookingPayload);
    createBookingMutation.mutate(bookingPayload);
  };

  // Error/Loading states
  if (!branchId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">❌ ไม่พบข้อมูลสาขา</CardTitle>
            <CardDescription className="space-y-2">
              <p>ลิงก์นี้ไม่มีข้อมูลสาขา (branchId)</p>
              <p className="text-xs text-slate-500">⚠️ ลิงก์ต้องอยู่ในรูป: ?branchId=xxxxx</p>
              <p className="text-xs text-slate-500">กรุณาขอลิงก์ใหม่จากทางสาขา</p>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (branchLoading || roomsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">❌ ไม่พบสาขานี้</CardTitle>
            <CardDescription className="space-y-2">
              <p>สาขาที่คุณกำลังมองหาอาจถูกลบหรือไม่มีในระบบ</p>
              <p className="text-xs text-slate-500">📌 branchId: <span className="font-mono">{branchId}</span></p>
              <p className="text-xs text-slate-500">✅ ตรวจสอบให้แน่ใจว่าสาขายังคงใช้งานอยู่</p>
              <p className="text-xs text-slate-500">📞 ติดต่อสาขาเพื่อขอลิงก์ใหม่</p>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleInitialSearch = () => {
    setSearchDate(tempSearchDate);
    const diffTime = Math.abs(new Date(tempCheckOutDate) - new Date(tempSearchDate));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    setFormData({ 
      ...formData, 
      check_in_date: tempSearchDate,
      check_out_date: tempCheckOutDate,
      number_of_guests: tempNumberOfGuests,
      booking_type: diffDays >= 28 ? 'monthly' : 'daily'
    });
    setShowInitialDialog(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100">
      {/* Initial Search Dialog */}
      <Dialog open={showInitialDialog} onOpenChange={setShowInitialDialog}>
        <DialogContent className="max-w-xl mx-4 sm:mx-0 p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-blue-50 via-sky-50 to-blue-100 p-6 sm:p-8">
            <DialogHeader className="text-center mb-6">
              <DialogTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                ค้นหาห้องพัก
              </DialogTitle>
              <DialogDescription className="text-sm text-slate-600 mt-2">
                ค้นหาห้องที่เหมาะกับคุณ
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-6">
              {/* Search Box Style */}
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Search className="w-5 h-5 text-slate-400" />
                </div>
                <Input
                  value={branch?.branch_name || 'กำลังโหลด...'}
                  disabled
                  className="pl-12 h-14 text-base bg-slate-50 border-slate-200 text-slate-700 font-medium"
                />
              </div>

              {/* Date Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-slate-600">เช็คอิน</span>
                  </div>
                  <Input
                    type="date"
                    value={tempSearchDate}
                    onChange={(e) => setTempSearchDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="border-0 bg-transparent p-0 h-auto text-sm font-semibold text-slate-800"
                  />
                </div>

                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <span className="text-xs text-slate-600">เช็คเอาท์</span>
                  </div>
                  <Input
                    type="date"
                    value={tempCheckOutDate}
                    onChange={(e) => setTempCheckOutDate(e.target.value)}
                    min={tempSearchDate}
                    placeholder="รายเดือน"
                    className="border-0 bg-transparent p-0 h-auto text-sm font-semibold text-slate-800"
                  />
                </div>
              </div>

              {/* Guest Count */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-slate-700" />
                    <span className="text-sm font-medium text-slate-700">จำนวนผู้เข้าพัก</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTempNumberOfGuests(Math.max(1, tempNumberOfGuests - 1))}
                      className="h-8 w-8 rounded-full p-0"
                    >
                      -
                    </Button>
                    <span className="text-base font-bold text-slate-800 min-w-[40px] text-center">
                      {tempNumberOfGuests} คน
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTempNumberOfGuests(Math.min(10, tempNumberOfGuests + 1))}
                      className="h-8 w-8 rounded-full p-0"
                    >
                      +
                    </Button>
                  </div>
                </div>
              </div>

              {/* Search Button */}
              <Button 
                onClick={() => {
                  if (!tempCheckOutDate) {
                    toast.error('กรุณาเลือกวันที่เช็คเอาท์เพื่อตรวจสอบห้องว่าง');
                    return;
                  }
                  handleInitialSearch();
                }}
                className="w-full h-14 text-base font-semibold bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 rounded-xl shadow-lg"
              >
                ดูราคา
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="bg-white/90 backdrop-blur-xl border-b border-white/50 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden border-2 border-blue-100">
              <img
                src={buildingLogo}
                alt={branch.branch_name}
                className="w-full h-full object-contain p-1"
                onError={(e) => {
                  e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/58da6a306_DC4395DB-4B27-4859-85B3-4F2948654F9E.png';
                }}
              />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{branch.branch_name}</h1>
              <p className="text-xs sm:text-sm text-slate-600 flex items-center gap-1 sm:gap-2 mt-1">
                <MapPin className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                <span className="truncate">{branch.address || 'หอพักคุณภาพ'}</span>
              </p>
            </div>
            
            <div className="flex-shrink-0 ml-auto">
              {lineProfile ? (
                <button 
                  onClick={() => setShowProfileDialog(true)}
                  className="flex items-center gap-2 hover:bg-slate-100 p-1.5 sm:p-2 rounded-full sm:rounded-xl transition-colors text-left"
                >
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-semibold text-slate-800">{lineProfile.displayName}</p>
                    <p className="text-xs text-slate-500">ดูประวัติของฉัน</p>
                  </div>
                  <img 
                    src={lineProfile.pictureUrl} 
                    alt="Profile" 
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-green-500 object-cover"
                  />
                </button>
              ) : (
                <button 
                  onClick={handleLineLogin}
                  className="flex items-center gap-2 hover:bg-slate-100 p-1.5 sm:p-2 rounded-full sm:rounded-xl transition-colors text-left"
                >
                  <div className="hidden sm:block text-right">
                    <p className="text-sm font-semibold text-slate-800">เข้าสู่ระบบ</p>
                    <p className="text-xs text-slate-500">เพื่อดูประวัติการจอง</p>
                  </div>
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center text-slate-400">
                    <User className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Search Summary & Filter */}
        <Card className="mb-4 sm:mb-6 bg-white/90 backdrop-blur-xl border-white/50 shadow-lg">
          <CardContent className="p-3 sm:p-4">
            {/* Tabs for Booking Type */}
            <Tabs 
              value={formData.booking_type} 
              disabled={isRoomSelected}
              onValueChange={(value) => {
                if (!isRoomSelected) {
                  setFormData({ 
                    ...formData, 
                    booking_type: value
                  });
                }
              }}
              className="mb-4"
            >
              <TabsList className="grid w-full grid-cols-2 bg-slate-100">
                <TabsTrigger value="monthly" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  รายเดือน
                </TabsTrigger>
                <TabsTrigger value="daily" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                  รายวัน
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                  <Home className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="font-semibold">
                    {new Date(searchDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {formData.check_out_date && (
                    <>
                      <span className="text-slate-400">→</span>
                      <span className="font-semibold">
                        {new Date(formData.check_out_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-purple-600" />
                    <span className="text-xs sm:text-sm font-semibold">{formData.number_of_guests} คน</span>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => setShowInitialDialog(true)}
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
              >
                เปลี่ยนเงื่อนไข
              </Button>
            </div>
          </CardContent>
        </Card>

        {rooms.length === 0 ? (
          <Card className="text-center py-12">
            <CardHeader>
              <CardTitle className="text-slate-600">😔 ไม่พบห้องพัก</CardTitle>
              <CardDescription>กรุณาติดต่อสาขาโดยตรง</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-1 sm:mb-2">ห้องพักทั้งหมด</h2>
              <p className="text-sm sm:text-base text-slate-600">
                <span className="inline-flex items-center gap-1.5 bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-semibold text-xs sm:text-sm">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  {rooms.filter(r => r.isAvailable && r.room_type === formData.booking_type).length} ห้องว่าง
                </span>
                <span className="text-slate-400 mx-2">/</span>
                <span className="text-slate-600">{rooms.filter(r => r.room_type === formData.booking_type).length} ห้องทั้งหมด</span>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <AnimatePresence>
                {rooms
                  .filter(room => room.room_type === formData.booking_type)
                  .sort((a, b) => {
                    if (a.isAvailable && !b.isAvailable) return -1;
                    if (!a.isAvailable && b.isAvailable) return 1;
                    return 0;
                  })
                  .map((room) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={!room.isAvailable ? 'opacity-60' : ''}
                  >
                    <Card className={`overflow-hidden hover:shadow-xl transition-all duration-300 group ${
                      !room.isAvailable ? 'bg-slate-50/80 border-slate-200' : 'bg-white shadow-md'
                    }`}>
                      {/* Room Image */}
                      <div className="relative h-48 bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden">
                        {room.image_urls && room.image_urls.length > 0 ? (
                          <img 
                            src={room.image_urls[0]} 
                            alt={`ห้อง ${room.room_number}`}
                            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 ${
                              !room.isAvailable ? 'grayscale' : ''
                            }`}
                            onError={(e) => {
                              e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
                            }}
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Bed className="w-16 h-16 text-slate-400" />
                          </div>
                        )}
                        <div className="absolute top-3 right-3">
                          <Badge className={room.isAvailable ? "bg-green-500 text-white" : "bg-red-500 text-white"}>
                            {room.isAvailable ? 'ว่าง' : 'ไม่ว่าง'}
                          </Badge>
                        </div>
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-blue-500 text-white">ชั้น {room.floor}</Badge>
                        </div>
                        {!room.isAvailable && (
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <div className="bg-white/90 px-4 py-2 rounded-lg font-semibold text-slate-700">
                              เต็มแล้ว
                            </div>
                          </div>
                        )}
                      </div>

                      <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl font-bold">ห้อง {room.room_number}</CardTitle>
                        <CardDescription>
                          <div className="flex items-center gap-2 text-xs sm:text-sm mt-1">
                            <Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            <span>
                              {room.room_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}
                            </span>
                            {room.size && (
                              <>
                                <span>•</span>
                                <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span>{room.size} ตร.ม.</span>
                              </>
                            )}
                          </div>
                        </CardDescription>
                      </CardHeader>

                      <CardContent className="p-4 sm:p-6 pt-0">
                        <div className="space-y-3 sm:space-y-4">
                          {/* Price */}
                          <div className="text-center py-4 sm:py-5 bg-gradient-to-r from-blue-50 to-sky-100 rounded-xl border border-blue-200">
                            <p className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                              ฿{room.price?.toLocaleString() || 'N/A'}
                            </p>
                            <p className="text-xs sm:text-sm text-slate-600 mt-1">
                              {room.room_type === 'monthly' ? 'ต่อเดือน' : 'ต่อวัน'}
                            </p>
                          </div>

                          {/* Amenities */}
                          {room.amenities && room.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 sm:gap-2">
                              {room.amenities.slice(0, 3).map((amenity, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs bg-white">
                                  ✓ {amenity}
                                </Badge>
                              ))}
                              {room.amenities.length > 3 && (
                                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                                  +{room.amenities.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Description */}
                          {room.description && (
                            <p className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed">
                              {room.description}
                            </p>
                          )}

                          {/* Action Buttons */}
                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button 
                              onClick={() => {
                                setDetailRoom(room);
                                setCurrentImageIndex(0);
                                setShowRoomDetails(true);
                              }}
                              variant="outline"
                              className="flex-1 text-xs sm:text-sm"
                              disabled={!room.isAvailable}
                            >
                              ดูรายละเอียด
                            </Button>
                            <Button 
                              onClick={() => handleRoomSelect(room)}
                              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-700 hover:from-blue-600 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
                              disabled={!room.isAvailable}
                            >
                              {room.isAvailable ? '📝 จองห้องนี้' : '⛔ เต็มแล้ว'}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </>
        )}
      </div>

      {/* Booking Form Dialog */}
      <Dialog open={showBookingForm} onOpenChange={(open) => {
        setShowBookingForm(open);
        if (!open) {
          setBookingStep(1);
          setDepositSlipUrl('');
          setIsRoomSelected(false);
        }
      }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto mx-4 sm:mx-0">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">
              {bookingStep === 1 ? '📝 ข้อมูลการจอง' : '💳 ชำระเงินมัดจำ'} - ห้อง {selectedRoom?.room_number}
            </DialogTitle>
            <DialogDescription className="text-sm">
              {bookingStep === 1 ? 'กรอกข้อมูลของคุณเพื่อจองห้องพัก' : 'โอนเงินมัดจำเพื่อยืนยันการจอง'}
            </DialogDescription>
          </DialogHeader>

          {bookingStep === 1 ? (
            <form onSubmit={handleNextStep} className="space-y-4 mt-4">
            
            <div>
              <label className="block text-sm font-medium mb-2">
                ประเภทการจอง <span className="text-red-500">*</span>
              </label>
              <div className="relative opacity-50 pointer-events-none cursor-not-allowed">
                <Select 
                  value={formData.booking_type} 
                  disabled={true}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">รายเดือน</SelectItem>
                    <SelectItem value="daily">รายวัน</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-slate-500 mt-2">⏭️ เลือกห้องใหม่เพื่อเปลี่ยนประเภทการจอง</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <User className="w-4 h-4 inline mr-2" />
                ชื่อ-นามสกุล <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.guest_name}
                onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                placeholder="เช่น สมชาย ใจดี"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <User className="w-4 h-4 inline mr-2" />
                จำนวนผู้เข้าพัก <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                min="1"
                max="10"
                value={formData.number_of_guests}
                onChange={(e) => setFormData({ ...formData, number_of_guests: parseInt(e.target.value) || 1 })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  <Phone className="w-4 h-4 inline mr-2" />
                  เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                </label>
                <Input
                  value={formData.guest_phone}
                  onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                  placeholder="0812345678"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  <Mail className="w-4 h-4 inline mr-2" />
                  อีเมล
                </label>
                <Input
                  type="email"
                  value={formData.guest_email}
                  onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                  placeholder="example@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <CreditCard className="w-4 h-4 inline mr-2" />
                เลขบัตรประชาชน
              </label>
              <Input
                value={formData.guest_national_id}
                onChange={(e) => setFormData({ ...formData, guest_national_id: e.target.value })}
                placeholder="1234567890123"
                maxLength={13}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                <MapPin className="w-4 h-4 inline mr-2" />
                ที่อยู่
              </label>
              <Textarea
                value={formData.guest_address}
                onChange={(e) => setFormData({ ...formData, guest_address: e.target.value })}
                placeholder="บ้านเลขที่, หมู่บ้าน, ตำบล, อำเภอ, จังหวัด"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                📅 วันที่เช็คอิน <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.check_in_date}
                readOnly
                disabled
                className="bg-slate-100 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">💡 กดปุ่ม "เปลี่ยนเงื่อนไข" เพื่อเปลี่ยนวันที่</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                📅 วันที่เช็คเอาท์ <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.check_out_date}
                onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                min={formData.check_in_date}
                required
              />
              <p className="text-xs text-slate-500 mt-1">💡 เลือกวันที่เช็คเอาท์เพื่อเช็คการว่างของห้องในช่วงเวลานั้น</p>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowBookingForm(false)}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button 
                type="submit" 
                className="flex-1 bg-gradient-to-r from-blue-500 to-blue-700"
              >
                ถัดไป →
              </Button>
            </div>
            </form>
            ) : (
            <form onSubmit={handleSubmitPayment} className="space-y-4 mt-4">
              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-4 text-sm space-y-2">
                <p className="font-semibold text-slate-800 mb-2">📋 สรุปข้อมูลการจอง</p>
                <div className="grid grid-cols-2 gap-2">
                  <span className="text-slate-600">ชื่อ:</span>
                  <span className="font-medium text-slate-800">{formData.guest_name}</span>
                  <span className="text-slate-600">เบอร์โทร:</span>
                  <span className="font-medium text-slate-800">{formData.guest_phone}</span>
                  <span className="text-slate-600">จำนวนผู้เข้าพัก:</span>
                  <span className="font-medium text-slate-800">{formData.number_of_guests} คน</span>
                  <span className="text-slate-600">เช็คอิน:</span>
                  <span className="font-medium text-slate-800">
                    {new Date(formData.check_in_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                  {formData.check_out_date && (
                    <>
                      <span className="text-slate-600">เช็คเอาท์:</span>
                      <span className="font-medium text-slate-800">
                        {new Date(formData.check_out_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Deposit Amount */}
              <div className="bg-gradient-to-br from-blue-50 to-sky-100 rounded-xl p-5 border border-blue-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base font-medium text-slate-700">ยอดมัดจำที่ต้องชำระ</span>
                  <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                    ฿{publicBookingDeposit.toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-600">
                  กรุณาโอนเงินมัดจำเพื่อยืนยันการจอง
                </p>
              </div>

              {/* Bank Info */}
              {(bankName || bankAccount || bankAccountName) && (
                <div className="bg-white border-2 border-blue-200 rounded-xl p-4">
                  <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    บัญชีสำหรับโอนเงิน
                  </p>
                  <div className="space-y-2 text-sm">
                    {bankName && (
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2">
                        <span className="text-slate-600">ธนาคาร:</span>
                        <span className="font-semibold text-slate-800">{bankName}</span>
                      </div>
                    )}
                    {bankAccount && (
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2">
                        <span className="text-slate-600">เลขที่บัญชี:</span>
                        <span className="font-semibold text-slate-800 font-mono">{bankAccount}</span>
                      </div>
                    )}
                    {bankAccountName && (
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-2">
                        <span className="text-slate-600">ชื่อบัญชี:</span>
                        <span className="font-semibold text-slate-800">{bankAccountName}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Upload Slip */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  อัปโหลดสลิปการโอนเงิน <span className="text-red-500">*</span>
                </label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const result = await base44.integrations.Core.UploadFile({ file });
                        setDepositSlipUrl(result.file_url);
                        toast.success('อัปโหลดสลิปสำเร็จ');
                      } catch (error) {
                        console.error('Upload error:', error);
                        toast.error('อัปโหลดสลิปไม่สำเร็จ: ' + error.message);
                      }
                    }
                  }}
                  required
                  className="cursor-pointer"
                />
                {depositSlipUrl && (
                  <div className="mt-3 relative">
                    <img 
                      src={depositSlipUrl} 
                      alt="สลิปการโอนเงิน" 
                      className="w-full max-w-xs rounded-lg border-2 border-green-500 mx-auto"
                    />
                    <Badge className="absolute top-2 right-2 bg-green-500">
                      <Check className="w-3 h-3 mr-1" />
                      อัปโหลดแล้ว
                    </Badge>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setBookingStep(1)}
                  className="flex-1"
                >
                  ← ย้อนกลับ
                </Button>
                <Button 
                  type="submit" 
                  disabled={createBookingMutation.isPending || !depositSlipUrl}
                  className="flex-1 bg-gradient-to-r from-blue-500 to-blue-700 disabled:opacity-50"
                >
                  {createBookingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังจอง...
                    </>
                  ) : (
                    'ยืนยันการจอง'
                  )}
                </Button>
              </div>
            </form>
            )}
            </DialogContent>
            </Dialog>

      {/* Room Details Dialog */}
      <Dialog open={showRoomDetails} onOpenChange={setShowRoomDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-0">
          {detailRoom && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl sm:text-2xl">🏠 ห้อง {detailRoom.room_number}</DialogTitle>
                <DialogDescription className="text-sm">
                  {detailRoom.room_type === 'monthly' ? 'ห้องรายเดือน' : 'ห้องรายวัน'}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                {/* Image Gallery */}
                {detailRoom.image_urls && detailRoom.image_urls.length > 0 && (
                  <div className="space-y-2">
                    <div className="relative h-64 bg-gradient-to-br from-slate-200 to-slate-300 rounded-xl overflow-hidden">
                      <img 
                        src={detailRoom.image_urls[currentImageIndex]} 
                        alt={`ห้อง ${detailRoom.room_number}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = 'https://via.placeholder.com/800x600?text=No+Image';
                        }}
                      />
                      {detailRoom.image_urls.length > 1 && (
                        <>
                          <button
                            onClick={() => setCurrentImageIndex(prev => prev === 0 ? detailRoom.image_urls.length - 1 : prev - 1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => setCurrentImageIndex(prev => prev === detailRoom.image_urls.length - 1 ? 0 : prev + 1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full"
                          >
                            →
                          </button>
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                            {currentImageIndex + 1} / {detailRoom.image_urls.length}
                          </div>
                        </>
                      )}
                    </div>
                    {detailRoom.image_urls.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto">
                        {detailRoom.image_urls.map((url, idx) => (
                          <button
                            key={idx}
                            onClick={() => setCurrentImageIndex(idx)}
                            className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 ${
                              currentImageIndex === idx ? 'border-blue-500' : 'border-transparent'
                            }`}
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Price & Details */}
                <div className="bg-gradient-to-r from-blue-50 to-sky-100 rounded-xl p-4 sm:p-6 border border-blue-200">
                  <div className="text-center mb-4">
                    <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">
                      ฿{detailRoom.price?.toLocaleString() || 'N/A'}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 mt-1">
                      {detailRoom.room_type === 'monthly' ? 'ต่อเดือน' : 'ต่อวัน'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                    <div className="bg-white/80 rounded-lg p-2.5 sm:p-3">
                      <p className="text-slate-600 text-xs">ชั้น</p>
                      <p className="font-bold text-slate-800 text-sm sm:text-base">{detailRoom.floor}</p>
                    </div>
                    {detailRoom.size && (
                      <div className="bg-white/80 rounded-lg p-2.5 sm:p-3">
                        <p className="text-slate-600 text-xs">ขนาด</p>
                        <p className="font-bold text-slate-800 text-sm sm:text-base">{detailRoom.size} ตร.ม.</p>
                      </div>
                    )}
                    <div className="bg-white/80 rounded-lg p-2.5 sm:p-3">
                      <p className="text-slate-600 text-xs">ค่าน้ำ</p>
                      <p className="font-bold text-slate-800 text-xs sm:text-sm">
                        {detailRoom.is_flat_rate_water 
                          ? `${detailRoom.flat_rate_water_amount} ฿/ด.`
                          : `${detailRoom.water_rate} ฿/หน่วย`
                        }
                      </p>
                    </div>
                    <div className="bg-white/80 rounded-lg p-2.5 sm:p-3">
                      <p className="text-slate-600 text-xs">ค่าไฟ</p>
                      <p className="font-bold text-slate-800 text-xs sm:text-sm">
                        {detailRoom.is_flat_rate_electricity 
                          ? `${detailRoom.flat_rate_electricity_amount} ฿/ด.`
                          : `${detailRoom.electricity_rate} ฿/หน่วย`
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {detailRoom.description && (
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-2 text-sm sm:text-base">รายละเอียด</h3>
                    <p className="text-slate-600 leading-relaxed text-sm">{detailRoom.description}</p>
                  </div>
                )}

                {/* Amenities */}
                {detailRoom.amenities && detailRoom.amenities.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-3 text-sm sm:text-base">สิ่งอำนวยความสะดวก</h3>
                    <div className="flex flex-wrap gap-2">
                      {detailRoom.amenities.map((amenity, idx) => (
                        <Badge key={idx} variant="outline" className="px-2.5 py-1 text-xs sm:text-sm bg-white">
                          ✓ {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setShowRoomDetails(false)}
                    className="flex-1"
                  >
                    ปิด
                  </Button>
                  <Button 
                    onClick={() => {
                      setShowRoomDetails(false);
                      handleRoomSelect(detailRoom);
                    }}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-blue-700 disabled:opacity-50"
                    disabled={!detailRoom.isAvailable}
                  >
                    {detailRoom.isAvailable ? 'จองห้องนี้' : 'เต็มแล้ว'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PublicProfileDialog 
        open={showProfileDialog} 
        onOpenChange={setShowProfileDialog} 
        lineProfile={lineProfile} 
      />

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md mx-4 sm:mx-0">
          <div className="text-center mb-4">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-4 shadow-lg">
              <Check className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
            </div>
            <DialogTitle className="text-xl sm:text-2xl">จองสำเร็จ! 🎉</DialogTitle>
          </div>

          {createdBooking && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-blue-50 to-sky-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-slate-600 mb-2">รายละเอียดการจอง</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">ห้อง:</span>
                    <span className="font-semibold">{createdBooking.room?.room_number} (ชั้น {createdBooking.room?.floor})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">ชื่อผู้จอง:</span>
                    <span className="font-semibold">{createdBooking.room?.guest_name || formData.guest_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">วันเข้าพัก:</span>
                    <span className="font-semibold">
                      {new Date(formData.check_in_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  {formData.check_out_date && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">วันเช็คเอาท์:</span>
                      <span className="font-semibold">
                        {new Date(formData.check_out_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-4 border border-indigo-200">
                <p className="text-xs text-slate-600 mb-2">เงินมัดจำ</p>
                <p className="text-2xl font-bold text-indigo-600">฿{publicBookingDeposit.toLocaleString()}</p>
                <p className="text-xs text-slate-600 mt-2">กรุณาโอนเงินมัดจำตามบัญชีที่ปรากฎด้านบน</p>
              </div>

              <p className="text-xs text-slate-600 text-center">
                เลขที่ใบจอง: <span className="font-semibold">{createdBooking.booking_no}</span>
              </p>
            </div>
          )}

          <DialogDescription className="text-sm text-center mt-4 leading-relaxed">
            ทางสาขาได้รับการจองของคุณแล้ว และจะติดต่อกลับไปยังเบอร์โทรศัพท์ที่คุณให้ไว้ ภายใน 24 ชั่วโมง
          </DialogDescription>

          <div className="flex flex-col gap-2 pt-4">
            <Button 
              onClick={() => {
                setShowSuccessDialog(false);
                window.location.reload();
              }}
              variant="outline"
              className="w-full"
            >
              ดูห้องอื่นๆ
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}