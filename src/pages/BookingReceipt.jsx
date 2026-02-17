import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, Download, ArrowLeft, Edit2, Save, Sparkles, Loader2, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { toast } from "sonner";


// แปลงตัวเลขเป็นข้อความภาษาไทย
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
        if (pos === 1 && digit === 1) {
          result += 'สิบ';
        } else if (pos === 1 && digit === 2) {
          result += 'ยี่สิบ';
        } else if (pos === 0 && digit === 1 && len > 1) {
          result += 'เอ็ด';
        } else {
          result += units[digit] + positions[pos];
        }
      }
    }
    return result;
  };
  
  const intPart = Math.floor(num);
  const result = convertGroup(intPart);
  
  return result + 'บาทถ้วน';
};

// แปลงวันที่เป็นภาษาไทย
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

export default function BookingReceiptPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const printRef = useRef(null);
  
  const urlParams = new URLSearchParams(window.location.search);
  const bookingId = urlParams.get('id');
  const tempBookingId = urlParams.get('tempId');
  const isCopy = urlParams.get('copy') === 'true';
  
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

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

  const { data: room } = useQuery({
    queryKey: ['room', booking?.room_id],
    queryFn: async () => {
      const rooms = await base44.entities.Room.filter({ id: booking.room_id });
      return rooms[0];
    },
    enabled: !!booking?.room_id
  });

  const { data: tenant } = useQuery({
    queryKey: ['tenant', booking?.tenant_id],
    queryFn: async () => {
      if (!booking?.tenant_id) return null;
      const tenants = await base44.entities.Tenant.filter({ id: booking.tenant_id });
      return tenants[0];
    },
    enabled: !!booking?.tenant_id
  });

  const { data: branch } = useQuery({
    queryKey: ['branch', booking?.branch_id],
    queryFn: async () => {
      const branches = await base44.entities.Branch.filter({ id: booking.branch_id });
      return branches[0];
    },
    enabled: !!booking?.branch_id
  });

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

  const handlePrint = () => {
    window.print();
  };



  // Initialize edit form when booking loads
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
        notes: booking.notes || ''
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
      toast.success('บันทึกการแก้ไขสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการบันทึก');
    }
  });

  // AI Edit handler
  const handleAIEdit = async () => {
    if (!aiQuery.trim()) {
      toast.error('กรุณาใส่คำสั่งแก้ไข');
      return;
    }

    setAiLoading(true);
    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `คุณเป็นผู้ช่วยแก้ไขใบจองห้องเช่า วิเคราะห์คำสั่งและแก้ไขข้อมูลตามที่ผู้ใช้ต้องการ

ข้อมูลใบจองปัจจุบัน:
- ชื่อผู้จอง: ${editForm.guest_name}
- เบอร์โทร: ${editForm.guest_phone}
- เลขบัตรประชาชน: ${editForm.guest_national_id}
- ที่อยู่: ${editForm.guest_address}
- วันที่จอง: ${editForm.check_in_date}
- ระยะเวลาสัญญา: ${editForm.contract_duration}
- กำหนดทำสัญญา: ${editForm.contract_deadline}
- เงินจองห้อง: ${editForm.deposit_amount} บาท
- เงินประกันห้อง: ${editForm.security_deposit} บาท
- ค่าเช่าล่วงหน้า: ${editForm.advance_rent} บาท
- รวมส่วนกลาง: ${editForm.common_fee_included} บาท
- หมายเหตุ: ${editForm.notes}

คำสั่งจากผู้ใช้: "${aiQuery}"

กรุณาส่งคืนข้อมูลที่แก้ไขแล้ว พร้อมอธิบายสิ่งที่เปลี่ยนแปลง`,
        response_json_schema: {
          type: "object",
          properties: {
            updated_data: {
              type: "object",
              properties: {
                guest_name: { type: "string" },
                guest_phone: { type: "string" },
                guest_national_id: { type: "string" },
                guest_address: { type: "string" },
                check_in_date: { type: "string" },
                contract_duration: { type: "string" },
                contract_deadline: { type: "string" },
                deposit_amount: { type: "string" },
                security_deposit: { type: "string" },
                advance_rent: { type: "string" },
                common_fee_included: { type: "string" },
                notes: { type: "string" }
              }
            },
            explanation: { type: "string" }
          },
          required: ["updated_data", "explanation"]
        }
      });

      if (response.updated_data) {
        setEditForm(prev => ({
          ...prev,
          ...response.updated_data
        }));
        toast.success(response.explanation || 'แก้ไขข้อมูลตามคำสั่งแล้ว');
      }
      setShowAIDialog(false);
      setAiQuery('');
      setIsEditing(true);
    } catch (error) {
      console.error('AI Edit Error:', error);
      toast.error('เกิดข้อผิดพลาดในการวิเคราะห์คำสั่ง');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSave = () => {
    updateMutation.mutate(editForm);
  };

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
        notes: booking.notes || ''
      });
    }
    setIsEditing(false);
  };

  if (bookingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <p className="text-slate-600 mb-4">ไม่พบข้อมูลใบจอง</p>
          <Button onClick={() => navigate(createPageUrl('Bookings'))}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            กลับหน้าการจอง
          </Button>
        </div>
      </div>
    );
  }

  // คำนวณยอดเงินต่างๆ - ใช้จาก editForm ถ้ากำลังแก้ไข
  const depositAmount = isEditing ? (parseFloat(editForm.deposit_amount) || 0) : (booking.deposit_amount || 0);
  const securityDeposit = isEditing ? (parseFloat(editForm.security_deposit) || 0) : (booking.security_deposit || 0);
  const advanceRent = isEditing ? (parseFloat(editForm.advance_rent) || 0) : (booking.advance_rent || 0);
  const commonFeeIncluded = isEditing ? (parseFloat(editForm.common_fee_included) || 0) : (booking.common_fee_included || 0);
  const totalBookingAmount = depositAmount + securityDeposit + advanceRent + commonFeeIncluded;
  const remainingAmount = securityDeposit + advanceRent + commonFeeIncluded;

  // ข้อมูลผู้จอง - ใช้จาก editForm ถ้ากำลังแก้ไข
  const guestName = isEditing ? editForm.guest_name : (booking.guest_name || tenant?.full_name || '-');
  const guestPhone = isEditing ? editForm.guest_phone : (booking.guest_phone || tenant?.phone || '-');
  const guestNationalId = isEditing ? editForm.guest_national_id : (booking.guest_national_id || tenant?.national_id || '-');
  const guestAddress = isEditing ? editForm.guest_address : (booking.guest_address || tenant?.address || '-');
  const contractDuration = isEditing ? editForm.contract_duration : (booking.contract_duration || '1 ปี');
  const contractDeadline = isEditing ? editForm.contract_deadline : booking.contract_deadline;
  const checkInDate = isEditing ? editForm.check_in_date : booking.check_in_date;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Print Controls - Hidden on print */}
      <div className="print:hidden bg-white border-b shadow-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(createPageUrl('Bookings'))}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            กลับ
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowAIDialog(true)}
              className="border-purple-300 text-purple-600 hover:bg-purple-50"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI แก้ไข
            </Button>
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
              พิมพ์ใบจอง
            </Button>
          </div>
        </div>
      </div>

      {/* AI Edit Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              แก้ไขด้วย AI
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              พิมพ์คำสั่งเช่น "เปลี่ยนระยะสัญญาเป็น 2 ปี" หรือ "เพิ่มเงินมัดจำเป็น 5000"
            </p>
            <Input
              placeholder="เช่น: เปลี่ยนระยะสัญญาเป็น 6 เดือน..."
              value={aiQuery}
              onChange={(e) => setAiQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !aiLoading) handleAIEdit();
              }}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowAIDialog(false)}>
                ยกเลิก
              </Button>
              <Button 
                onClick={handleAIEdit} 
                disabled={aiLoading || !aiQuery.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังวิเคราะห์...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    ดำเนินการ
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Content */}
      <div className="booking-container mx-auto print:m-0 print:p-0">
        <div 
          ref={printRef}
          className="booking-card bg-white rounded-lg shadow-xl print:shadow-none overflow-hidden"
          style={{ 
            fontFamily: 'TH Sarabun New, Sarabun, sans-serif',
            padding: 'var(--receipt-padding)'
          }}
        >
          {/* Copy Watermark */}
          {isCopy && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-200 text-8xl font-bold rotate-[-30deg] opacity-25 pointer-events-none print:opacity-20">
              สำเนา
            </div>
          )}

          {/* Header with Logo */}
          <div className="text-center mb-1">
            {/* Logo */}
            {buildingLogo && (
              <div className="mb-1">
                <img 
                  src={buildingLogo} 
                  alt={buildingName}
                  className="h-10 mx-auto object-contain"
                />
              </div>
            )}
            
            <h1 className="text-base font-bold text-blue-800 leading-tight">{buildingName}</h1>
            
            {buildingAddress && (
              <p className="text-[10px] text-slate-600 mt-0.5 leading-tight">{buildingAddress}</p>
            )}
            {buildingPhone && (
              <p className="text-[10px] text-slate-600 leading-tight">โทร. {buildingPhone}</p>
            )}
          </div>

          {/* Title */}
          <div className="text-center mb-2">
            <h2 className="text-sm font-bold border-b border-slate-300 pb-0.5 inline-block px-2">
              ใบจองห้องเช่า
            </h2>
            <div className="text-right mt-0.5 text-xs leading-tight">
              <span className="font-semibold">เลขที่ </span>
              <span className="text-blue-700 font-bold">{booking.booking_no || format(parseISO(booking.created_date || new Date().toISOString()), 'dd-MM-yy')}</span>
            </div>
          </div>

          {/* Guest Info Box */}
          <div className="border border-slate-300 rounded p-1.5 mb-2 text-xs">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">ชื่อผู้จอง</Label>
                    <Input
                      value={editForm.guest_name}
                      onChange={(e) => setEditForm({...editForm, guest_name: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">เบอร์โทร</Label>
                    <Input
                      value={editForm.guest_phone}
                      onChange={(e) => setEditForm({...editForm, guest_phone: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">เลขบัตรประชาชน</Label>
                    <Input
                      value={editForm.guest_national_id}
                      onChange={(e) => setEditForm({...editForm, guest_national_id: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">เงินจองห้อง (บาท)</Label>
                    <Input
                      type="number"
                      value={editForm.deposit_amount}
                      onChange={(e) => setEditForm({...editForm, deposit_amount: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-sm">ที่อยู่</Label>
                  <Input
                    value={editForm.guest_address}
                    onChange={(e) => setEditForm({...editForm, guest_address: e.target.value})}
                    className="mt-1"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="mb-2">
                      <span className="font-semibold">ได้รับเงินจองห้อง </span>
                      <span className="border-b border-dotted border-slate-400 px-2">{room?.room_number || '-'}</span>
                      <span className="ml-2">ชั้น</span>
                      <span className="border-b border-dotted border-slate-400 px-2">{room?.floor || '-'}</span>
                    </p>
                    <p className="mb-2">
                      <span className="font-semibold">ให้เป็นจำนวนเงิน </span>
                      <span className="border-b border-dotted border-slate-400 px-2 text-blue-700 font-bold">{depositAmount.toLocaleString()}</span>
                      <span className="ml-2">บาท</span>
                      <span className="ml-2 text-slate-500">({numberToThaiText(depositAmount)})</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="mb-2">
                    <span className="font-semibold">น.ส./นาย/นาง </span>
                    <span className="border-b border-dotted border-slate-400 px-2 min-w-[200px] inline-block">{guestName}</span>
                  </p>
                  <p className="mb-2">
                    <span className="font-semibold">เลขที่บัตรประชาชน </span>
                    <span className="border-b border-dotted border-slate-400 px-2">{guestNationalId}</span>
                  </p>
                  <p className="mb-2">
                    <span className="font-semibold">ที่อยู่ </span>
                    <span className="border-b border-dotted border-slate-400 px-2 min-w-[300px] inline-block">{guestAddress}</span>
                  </p>
                  <p>
                    <span className="font-semibold">โทร. </span>
                    <span className="border-b border-dotted border-slate-400 px-2">{guestPhone}</span>
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Detail Section */}
          <div className="mb-1.5">
            <h3 className="font-bold text-sm mb-1 text-blue-800 border-b border-blue-200 pb-0.5">รายละเอียด</h3>
            {isEditing ? (
              <div className="space-y-4 pl-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">วันที่จอง</Label>
                    <Input
                      type="date"
                      value={editForm.check_in_date}
                      onChange={(e) => setEditForm({...editForm, check_in_date: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">ระยะเวลาสัญญา</Label>
                    <Select
                      value={editForm.contract_duration}
                      onValueChange={(value) => setEditForm({...editForm, contract_duration: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">เงินประกันห้อง (บาท)</Label>
                    <Input
                      type="number"
                      value={editForm.security_deposit}
                      onChange={(e) => setEditForm({...editForm, security_deposit: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">ค่าเช่าล่วงหน้า (บาท)</Label>
                    <Input
                      type="number"
                      value={editForm.advance_rent}
                      onChange={(e) => setEditForm({...editForm, advance_rent: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm">รวมส่วนกลาง (บาท)</Label>
                    <Input
                      type="number"
                      value={editForm.common_fee_included}
                      onChange={(e) => setEditForm({...editForm, common_fee_included: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">กำหนดทำสัญญาภายในวันที่</Label>
                    <Input
                      type="date"
                      value={editForm.contract_deadline}
                      onChange={(e) => setEditForm({...editForm, contract_deadline: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                </div>
                
                {/* Summary Box */}
                <div className="mt-4 border border-blue-300 rounded bg-blue-50 p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">สรุปยอดเงิน (คำนวณอัตโนมัติ)</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <span>รวมสุทธิ:</span>
                    <span className="text-right font-bold text-blue-700">{totalBookingAmount.toLocaleString()} บาท</span>
                    <span>คงเหลือชำระทีหลัง:</span>
                    <span className="text-right font-bold text-green-700">{remainingAmount.toLocaleString()} บาท</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-[10px] space-y-1 pl-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <div>
                    <p><span className="font-semibold">วันที่:</span> {formatThaiDate(checkInDate)}</p>
                    <p><span className="font-semibold">ห้อง:</span> {room?.room_number || '-'} ชั้น {room?.floor || '-'}</p>
                  </div>
                  <div>
                    <p><span className="font-semibold">เงินจอง:</span> {depositAmount.toLocaleString()} บาท</p>
                    <p><span className="font-semibold">สัญญา:</span> {contractDuration}</p>
                  </div>
                </div>
                
                {/* Payment Details Table */}
                <div className="mt-1 border border-slate-300 rounded">
                  <table className="w-full text-xs">
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="px-1 py-1 font-semibold">เงินประกัน</td>
                        <td className="px-1 py-1 text-right text-blue-700 font-semibold">{securityDeposit.toLocaleString()}</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="px-1 py-1 font-semibold">ค่าเช่าล่วงหน้า</td>
                        <td className="px-1 py-1 text-right text-blue-700 font-semibold">{advanceRent.toLocaleString()}</td>
                      </tr>
                      {commonFeeIncluded > 0 && (
                        <tr className="border-b border-slate-200">
                          <td className="px-1 py-1 font-semibold">ส่วนกลาง</td>
                          <td className="px-1 py-1 text-right text-blue-700 font-semibold">{commonFeeIncluded.toLocaleString()}</td>
                        </tr>
                      )}
                      <tr className="bg-blue-50">
                        <td className="px-1 py-1 font-bold">รวมสุทธิ</td>
                        <td className="px-1 py-1 text-right text-blue-700 font-bold">{totalBookingAmount.toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Required Documents */}
          <div className="mb-1.5 bg-slate-50 p-1.5 rounded border border-slate-200">
            <h3 className="font-bold text-xs mb-0.5 text-blue-800">เอกสารที่ต้องนำมา</h3>
            <ol className="list-decimal list-inside text-[10px] space-y-0.5 pl-2">
              <li>บัตรประชาชน ตัวจริง + สำเนา ของผู้เช่าและผู้อาศัยทั้งหมด</li>
              <li>ทำสัญญาภายในวันที่ <span className="text-red-600 font-bold">{formatThaiDate(contractDeadline || checkInDate)}</span></li>
            </ol>
          </div>

          {/* Important Notes */}
          <div className="mb-1.5 border border-red-300 bg-red-50 p-1.5 rounded">
            <h3 className="font-bold text-red-700 text-xs mb-0.5">หมายเหตุ</h3>
            <p className="text-[10px] leading-snug">
              เงินจองเป็นส่วนหักลดมัดจำวันทำสัญญา หากสละสิทธิ์ไม่คืนเงิน
            </p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-1.5 mt-1.5 flex-grow">
            <div className="text-center flex flex-col justify-end">
              <p className="mb-3 text-[10px] leading-tight">ลงชื่อ........................</p>
              <p className="text-[10px] leading-tight">({lessorName ? lessorName.split(' ')[0] : 'ผู้รับจอง'})</p>
              <p className="font-semibold text-[10px]">ผู้รับจองห้อง</p>
            </div>
            <div className="text-center flex flex-col justify-end">
              <p className="mb-3 text-[10px] leading-tight">ลงชื่อ........................</p>
              <p className="text-[10px] leading-tight">({guestName.split(' ')[0] || 'ผู้จอง'})</p>
              <p className="font-semibold text-[10px]">ผู้จองห้อง</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        :root {
          --receipt-padding: 12px;
        }
        
        @media screen and (min-width: 768px) {
          :root {
            --receipt-padding: 24px;
          }
        }
        
        @media screen and (min-width: 1024px) {
          :root {
            --receipt-padding: 32px;
          }
        }
        
        @media print {
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body, html {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 11px !important;
          }
          
          @page {
            size: A4;
            margin: 8mm;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:shadow-none {
            box-shadow: none !important;
          }
          
          .booking-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }
          
          .booking-card {
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
            width: 100% !important;
          }
          
          /* ลดขนาด font ทั้งหมด */
          h1, h2, h3 { font-size: 14px !important; }
          p, span, td, th { font-size: 10px !important; }
          .text-lg { font-size: 12px !important; }
          .text-xl { font-size: 14px !important; }
          .text-xs { font-size: 9px !important; }
          .text-sm { font-size: 10px !important; }
          
          /* ลดระยะห่าง */
          .mb-4, .mb-5 { margin-bottom: 8px !important; }
          .mb-3, .mb-2 { margin-bottom: 6px !important; }
          .mb-1 { margin-bottom: 4px !important; }
          .p-3 { padding: 6px !important; }
          .p-2 { padding: 4px !important; }
          .px-4, .px-2 { padding-left: 4px !important; padding-right: 4px !important; }
          .gap-3 { gap: 6px !important; }
          .gap-4 { gap: 8px !important; }
        }
        
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
      `}</style>

      {/* A4 Preview Styles */}
      <style>{`
        @media screen {
          html {
            background: #f3f4f6;
          }
          
          .booking-container {
            max-width: 210mm;
            width: 100%;
            margin: 20px auto;
            padding: 20px;
          }
          
          .booking-card {
            width: 100%;
            height: 297mm;
            background: white;
            border: 1px solid #d1d5db;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }
        }
      `}</style>
    </div>
  );
}