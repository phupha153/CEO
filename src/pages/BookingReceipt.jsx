import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, ArrowLeft, Edit2, Save, X, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";

// Format Thai Date
const formatThaiDate = (dateStr) => {
  if (!dateStr) return '-';
  try {
    const date = parseISO(dateStr);
    const day = format(date, 'd');
    const month = format(date, 'MMMM', { locale: th });
    const year = parseInt(format(date, 'yyyy')) + 543;
    return `${day} ${month} ${year}`;
  } catch {
    return '-';
  }
};

// Convert number to Thai text
const numberToThaiText = (num) => {
  if (!num || num === 0) return 'ศูนย์บาทถ้วน';
  const units = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  
  const convertGroup = (n) => {
    if (n === 0) return '';
    let result = '';
    const str = n.toString();
    const len = str.length;
    
    for (let i = 0; i < len; i++) {
      const digit = parseInt(str[i]);
      const pos = len - i - 1;
      if (digit !== 0) {
        if (pos === 1 && digit === 1) result += 'สิบ';
        else if (pos === 1 && digit === 2) result += 'ยี่สิบ';
        else if (pos === 0 && digit === 1 && len > 1) result += 'เอ็ด';
        else result += units[digit] + positions[pos];
      }
    }
    return result;
  };
  
  return convertGroup(Math.floor(num)) + 'บาทถ้วน';
};

export default function BookingReceiptPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const printRef = useRef(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('id');
  const tempBookingId = urlParams.get('tempId');
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  // Fetch booking
  const { data: booking, isLoading: bookingLoading } = useQuery({
    queryKey: ['booking', bookingId, tempBookingId],
    queryFn: async () => {
      if (bookingId) {
        const bookings = await base44.entities.Booking.filter({ id: bookingId });
        return bookings[0];
      } else if (tempBookingId) {
        const tempBookings = await base44.entities.TemporaryBooking.filter({ id: tempBookingId });
        return tempBookings[0];
      }
      return null;
    },
    enabled: !!(bookingId || tempBookingId)
  });

  // Fetch room
  const { data: room } = useQuery({
    queryKey: ['room', booking?.room_id],
    queryFn: async () => {
      const rooms = await base44.entities.Room.filter({ id: booking.room_id });
      return rooms[0];
    },
    enabled: !!booking?.room_id
  });

  // Fetch tenant
  const { data: tenant } = useQuery({
    queryKey: ['tenant', booking?.tenant_id],
    queryFn: async () => {
      if (!booking?.tenant_id) return null;
      const tenants = await base44.entities.Tenant.filter({ id: booking.tenant_id });
      return tenants[0];
    },
    enabled: !!booking?.tenant_id
  });

  // Fetch branch
  const { data: branch } = useQuery({
    queryKey: ['branch', booking?.branch_id],
    queryFn: async () => {
      const branches = await base44.entities.Branch.filter({ id: booking.branch_id });
      return branches[0];
    },
    enabled: !!booking?.branch_id
  });

  // Fetch configs
  const { data: configs = [] } = useQuery({
    queryKey: ['configs', booking?.branch_id],
    queryFn: () => base44.entities.Config.list(),
    enabled: !!booking?.branch_id
  });

  const getConfigValue = (key, defaultValue = '') => {
    if (booking?.branch_id) {
      const branchConfig = configs.find(c => c.key === key && c.branch_id === booking.branch_id);
      if (branchConfig) return branchConfig.value;
    }
    const globalConfig = configs.find(c => c.key === key && !c.branch_id);
    return globalConfig ? globalConfig.value : defaultValue;
  };

  const buildingName = getConfigValue('building_name', 'W RESIDENTS');
  const buildingAddress = getConfigValue('building_address', '');
  const buildingPhone = getConfigValue('building_phone', '');
  const buildingLogo = getConfigValue('building_logo', '');
  const lessorName = getConfigValue('lessor_name', '');

  // Initialize edit form
  React.useEffect(() => {
    if (booking) {
      setEditForm({
        guest_name: booking.guest_name || '',
        guest_phone: booking.guest_phone || '',
        guest_national_id: booking.guest_national_id || '',
        guest_address: booking.guest_address || '',
        check_in_date: booking.check_in_date || '',
        contract_duration: booking.contract_duration || '1 ปี',
        contract_deadline: booking.contract_deadline || '',
        deposit_amount: booking.deposit_amount?.toString() || '0',
        security_deposit: booking.security_deposit?.toString() || '0',
        advance_rent: booking.advance_rent?.toString() || '0',
        common_fee_included: booking.common_fee_included?.toString() || '0',
      });
    }
  }, [booking]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const depositAmount = parseFloat(data.deposit_amount) || 0;
      const securityDeposit = parseFloat(data.security_deposit) || 0;
      const advanceRent = parseFloat(data.advance_rent) || 0;
      const commonFeeIncluded = parseFloat(data.common_fee_included) || 0;
      
      return base44.entities.Booking.update(bookingId, {
        ...data,
        deposit_amount: depositAmount,
        security_deposit: securityDeposit,
        advance_rent: advanceRent,
        common_fee_included: commonFeeIncluded,
        total_booking_amount: depositAmount + securityDeposit + advanceRent + commonFeeIncluded,
        remaining_amount: securityDeposit + advanceRent + commonFeeIncluded
      });
    },
    onSuccess: () => {
      queryClient.refetchQueries(['booking', bookingId]);
      setIsEditing(false);
      toast.success('บันทึกสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const handlePrint = () => window.print();
  const handleSave = () => updateMutation.mutate(editForm);
  const handleCancelEdit = () => {
    if (booking) {
      setEditForm({
        guest_name: booking.guest_name || '',
        guest_phone: booking.guest_phone || '',
        guest_national_id: booking.guest_national_id || '',
        guest_address: booking.guest_address || '',
        check_in_date: booking.check_in_date || '',
        contract_duration: booking.contract_duration || '1 ปี',
        contract_deadline: booking.contract_deadline || '',
        deposit_amount: booking.deposit_amount?.toString() || '0',
        security_deposit: booking.security_deposit?.toString() || '0',
        advance_rent: booking.advance_rent?.toString() || '0',
        common_fee_included: booking.common_fee_included?.toString() || '0',
      });
    }
    setIsEditing(false);
  };

  if (bookingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <p className="text-slate-600 mb-4">ไม่พบข้อมูล</p>
          <Button onClick={() => navigate(createPageUrl('Bookings'))}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            กลับ
          </Button>
        </div>
      </div>
    );
  }

  // Calculate amounts
  const depositAmount = isEditing ? (parseFloat(editForm.deposit_amount) || 0) : (booking.deposit_amount || 0);
  const securityDeposit = isEditing ? (parseFloat(editForm.security_deposit) || 0) : (booking.security_deposit || 0);
  const advanceRent = isEditing ? (parseFloat(editForm.advance_rent) || 0) : (booking.advance_rent || 0);
  const commonFeeIncluded = isEditing ? (parseFloat(editForm.common_fee_included) || 0) : (booking.common_fee_included || 0);
  const totalAmount = depositAmount + securityDeposit + advanceRent + commonFeeIncluded;

  // Get display values
  const guestName = isEditing ? editForm.guest_name : (booking.guest_name || tenant?.full_name || '-');
  const guestPhone = isEditing ? editForm.guest_phone : (booking.guest_phone || tenant?.phone || '-');
  const guestNationalId = isEditing ? editForm.guest_national_id : (booking.guest_national_id || tenant?.national_id || '-');
  const guestAddress = isEditing ? editForm.guest_address : (booking.guest_address || tenant?.address || '-');
  const contractDuration = isEditing ? editForm.contract_duration : (booking.contract_duration || '1 ปี');
  const contractDeadline = isEditing ? editForm.contract_deadline : booking.contract_deadline;
  const checkInDate = isEditing ? editForm.check_in_date : booking.check_in_date;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Control Bar */}
      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(createPageUrl('Bookings'))}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            กลับ
          </Button>
          <div className="flex gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={handleCancelEdit}>
                  <X className="w-4 h-4 mr-2" />
                  ยกเลิก
                </Button>
                <Button 
                  onClick={handleSave} 
                  className="bg-green-600 hover:bg-green-700"
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  บันทึก
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <Edit2 className="w-4 h-4 mr-2" />
                แก้ไข
              </Button>
            )}
            <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
              <Printer className="w-4 h-4 mr-2" />
              พิมพ์
            </Button>
          </div>
        </div>
      </div>

      {/* Receipt */}
      <div className="max-w-4xl mx-auto print:max-w-none p-4 print:p-0">
        <div 
          ref={printRef}
          className="bg-white rounded-lg shadow-xl print:shadow-none print:rounded-none"
          style={{ fontFamily: 'TH Sarabun New, Sarabun, sans-serif', width: '210mm', margin: '0 auto' }}
        >
          {/* Header */}
          <div className="border-b-2 border-slate-300 pb-4 pt-6 px-8 text-center">
            {buildingLogo && (
              <img src={buildingLogo} alt={buildingName} className="h-16 mx-auto mb-3 object-contain" />
            )}
            <h1 className="text-2xl font-bold text-slate-800">{buildingName}</h1>
            {buildingAddress && <p className="text-sm text-slate-600 mt-1">{buildingAddress}</p>}
            {buildingPhone && <p className="text-sm text-slate-600">โทร. {buildingPhone}</p>}
          </div>

          {/* Title */}
          <div className="text-center py-4 border-b border-slate-200">
            <h2 className="text-xl font-bold text-blue-800">ใบจองห้องเช่า</h2>
            <p className="text-sm text-slate-600 mt-1">เลขที่ {booking.booking_no || format(parseISO(booking.created_date || new Date().toISOString()), 'dd-MM-yy')}</p>
          </div>

          {/* Content */}
          <div className="px-8 py-6 space-y-6">
            {/* Section 1: Guest Info */}
            <div className="border-2 border-slate-300 rounded-lg p-5">
              <h3 className="font-bold text-base text-slate-800 mb-4">ข้อมูลผู้จอง</h3>
              
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">ชื่อ-สกุล</Label>
                      <Input value={editForm.guest_name} onChange={(e) => setEditForm({...editForm, guest_name: e.target.value})} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">เบอร์โทร</Label>
                      <Input value={editForm.guest_phone} onChange={(e) => setEditForm({...editForm, guest_phone: e.target.value})} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">เลขบัตรประชาชน</Label>
                      <Input value={editForm.guest_national_id} onChange={(e) => setEditForm({...editForm, guest_national_id: e.target.value})} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">ห้อง / ชั้น</Label>
                      <Input value={`${room?.room_number || '-'} / ชั้น ${room?.floor || '-'}`} disabled className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">ที่อยู่ปัจจุบัน</Label>
                    <Input value={editForm.guest_address} onChange={(e) => setEditForm({...editForm, guest_address: e.target.value})} className="mt-1" />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="grid grid-cols-2">
                    <span className="font-semibold text-slate-700">ชื่อ-สกุล:</span>
                    <span className="text-slate-900 font-bold">{guestName}</span>
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="font-semibold text-slate-700">เบอร์โทร:</span>
                    <span className="text-slate-900">{guestPhone}</span>
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="font-semibold text-slate-700">เลขบัตรประชาชน:</span>
                    <span className="text-slate-900">{guestNationalId}</span>
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="font-semibold text-slate-700">ห้อง / ชั้น:</span>
                    <span className="text-slate-900 font-bold">{room?.room_number || '-'} / ชั้น {room?.floor || '-'}</span>
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="font-semibold text-slate-700">ที่อยู่ปัจจุบัน:</span>
                    <span className="text-slate-900">{guestAddress}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2: Booking Details */}
            <div className="border-2 border-slate-300 rounded-lg p-5">
              <h3 className="font-bold text-base text-slate-800 mb-4">รายละเอียดการจอง</h3>
              
              {isEditing ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">วันที่จอง</Label>
                      <Input type="date" value={editForm.check_in_date} onChange={(e) => setEditForm({...editForm, check_in_date: e.target.value})} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">ระยะสัญญา</Label>
                      <Input value={editForm.contract_duration} onChange={(e) => setEditForm({...editForm, contract_duration: e.target.value})} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">เงินจองห้อง (บาท)</Label>
                      <Input type="number" value={editForm.deposit_amount} onChange={(e) => setEditForm({...editForm, deposit_amount: e.target.value})} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">มัดจำห้อง (บาท)</Label>
                      <Input type="number" value={editForm.security_deposit} onChange={(e) => setEditForm({...editForm, security_deposit: e.target.value})} className="mt-1" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm">ค่าเช่าล่วงหน้า (บาท)</Label>
                      <Input type="number" value={editForm.advance_rent} onChange={(e) => setEditForm({...editForm, advance_rent: e.target.value})} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-sm">ส่วนกลาง (บาท)</Label>
                      <Input type="number" value={editForm.common_fee_included} onChange={(e) => setEditForm({...editForm, common_fee_included: e.target.value})} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">กำหนดทำสัญญา</Label>
                    <Input type="date" value={editForm.contract_deadline} onChange={(e) => setEditForm({...editForm, contract_deadline: e.target.value})} className="mt-1" />
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="grid grid-cols-2">
                    <span className="font-semibold text-slate-700">วันที่จอง:</span>
                    <span>{formatThaiDate(checkInDate)}</span>
                  </div>
                  <div className="grid grid-cols-2">
                    <span className="font-semibold text-slate-700">ระยะสัญญา:</span>
                    <span className="font-bold text-blue-700">{contractDuration}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-3 rounded mt-3 border border-slate-200">
                    <div>
                      <p className="text-xs text-slate-600">เงินจอง</p>
                      <p className="font-bold text-lg text-slate-900">{depositAmount.toLocaleString()}</p>
                      <p className="text-xs text-slate-500 mt-1">{numberToThaiText(depositAmount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">มัดจำ</p>
                      <p className="font-bold text-lg text-slate-900">{securityDeposit.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-600">ล่วงหน้า</p>
                      <p className="font-bold text-lg text-slate-900">{advanceRent.toLocaleString()}</p>
                    </div>
                  </div>
                  {commonFeeIncluded > 0 && (
                    <div className="grid grid-cols-2 mt-3 p-3 rounded border border-slate-300">
                      <span className="font-semibold text-slate-700">ส่วนกลาง:</span>
                      <span className="font-bold text-slate-900">{commonFeeIncluded.toLocaleString()} บาท</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 mt-3 p-3 rounded border-2 border-slate-400 bg-slate-50">
                    <span className="font-bold text-slate-900">รวมจำนวนเงิน:</span>
                    <span className="font-bold text-2xl text-slate-900">{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="grid grid-cols-2 mt-2 p-3 rounded border border-slate-300">
                    <span className="font-semibold text-slate-700">กำหนดทำสัญญา:</span>
                    <span className="font-bold text-slate-900">{formatThaiDate(contractDeadline || checkInDate)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Conditions */}
            <div className="border-2 border-slate-400 rounded-lg p-5">
              <h3 className="font-bold text-base text-slate-800 mb-3">เงื่อนไขสำคัญ</h3>
              <ul className="text-sm space-y-2 text-slate-900">
                <li className="flex gap-2">
                  <span className="font-bold text-slate-700 flex-shrink-0">1.</span>
                  <span>เงินจองจะหักลดจากมัดจำ/ค่าเช่าล่วงหน้า/ส่วนกลาง เมื่อทำสัญญา</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-slate-700 flex-shrink-0">2.</span>
                  <span>หากไม่ทำสัญญา หรือชำระเงินให้ครบถ้วนภายในวันกำหนด ถือว่าสละสิทธิ์ เงินไม่คืน</span>
                </li>
                <li className="flex gap-2">
                  <span className="font-bold text-slate-700 flex-shrink-0">3.</span>
                  <span>เข้าพักได้หลังจากทำสัญญา ตรวจห้อง และชำระเงินครบถ้วนเท่านั้น</span>
                </li>
              </ul>
            </div>

            {/* Section 4: Signatures */}
            <div className="flex justify-between items-end pt-8 gap-8">
              <div className="text-center flex-1">
                <div className="border-t-2 border-slate-400 pt-2 h-20" />
                <p className="font-semibold text-sm text-slate-800 mt-2">ผู้รับจองห้อง</p>
                <p className="text-xs text-slate-600">{lessorName || '(...........................)'}</p>
              </div>
              <div className="text-center flex-1">
                <div className="border-t-2 border-slate-400 pt-2 h-20" />
                <p className="font-semibold text-sm text-slate-800 mt-2">ผู้จองห้อง</p>
                <p className="text-xs text-slate-600">{guestName.split(' ')[0] || '(...........................)'}</p>
              </div>
            </div>

            {/* Date */}
            <div className="text-center text-sm text-slate-600 pt-6 border-t border-slate-200">
              <p>วันที่ทำใบจอง: {formatThaiDate(booking.created_date)}</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          * {
            margin: 0 !important;
            padding: 0 !important;
            box-sizing: border-box !important;
          }
          body, html {
            background: white !important;
            font-size: 13px !important;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
      `}</style>
    </div>
  );
}