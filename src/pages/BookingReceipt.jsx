import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Printer, ArrowLeft, Edit2, Save, Sparkles, Loader2, X } from "lucide-react";
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
      queryClient.invalidateQueries(['booking', bookingId]);
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
      <div className="w-full print:w-full p-4 print:p-0 print:space-y-0 print:m-0 print:overflow-hidden">
        <div 
          ref={printRef}
          className="max-w-4xl mx-auto bg-white shadow-lg print:shadow-none print:break-after-page p-8 print:p-2 print:max-w-full print:mx-0"
          style={{ 
            fontFamily: 'TH Sarabun New, Sarabun, sans-serif'
          }}
        >
          {/* Copy Watermark */}
          {isCopy && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-blue-200 text-9xl font-bold rotate-[-30deg] opacity-30 pointer-events-none print:opacity-20">
              สำเนา
            </div>
          )}

          {/* Header with Stamp */}
          <div className="text-center mb-6 relative">
            {isCopy && (
              <div className="inline-block bg-blue-600 text-white px-6 py-2 text-lg font-bold mb-4">
                สำเนา
              </div>
            )}
            
            {/* Logo */}
            {buildingLogo && (
              <div className="mt-2">
                <img 
                  src={buildingLogo} 
                  alt={buildingName}
                  className="h-12 mx-auto object-contain"
                />
              </div>
            )}
            
            <h1 className="text-xl font-bold text-blue-800 mt-1">{buildingName}</h1>
            
            {buildingAddress && (
              <p className="text-xs text-slate-600 mt-0.5">{buildingAddress}</p>
            )}
            {buildingPhone && (
              <p className="text-xs text-slate-600">โทร. {buildingPhone}</p>
            )}
          </div>

          {/* Title */}
          <div className="text-center mb-3">
            <h2 className="text-lg font-bold border-b-2 border-slate-300 pb-1 inline-block px-4">
              ใบจองห้องเช่า
            </h2>
            <div className="text-right mt-1 text-sm">
              <span className="font-semibold">เลขที่ใบจอง </span>
              <span className="text-blue-700 font-bold">{booking.booking_no || format(parseISO(booking.created_date || new Date().toISOString()), 'dd-MM-yy')}</span>
            </div>
          </div>

          {/* Guest Info Box */}
          <div className="border-2 border-slate-300 rounded-lg p-3 mb-3 text-sm">
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
          <div className="mb-3">
            <h3 className="font-bold text-sm mb-2 text-blue-800 border-b border-blue-200 pb-0.5">รายละเอียดเพิ่มเติม</h3>
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
              <div className="text-xs space-y-1 pl-3">
                <p>
                  <span className="font-semibold">วันที่ </span>
                  <span className="text-blue-700">{formatThaiDate(checkInDate)}</span>
                  <span className="ml-4">ได้วางเงินจองห้องไว้ </span>
                  <span className="text-blue-700 font-bold">{depositAmount.toLocaleString()}</span>
                  <span> บาท</span>
                </p>
                <p>
                  <span className="font-semibold">เงื่อนไขสัญญา: </span>
                  <span>สัญญาระยะ </span>
                  <span className="text-blue-700">{contractDuration}</span>
                </p>
                
                {/* Payment Details Table */}
                <div className="mt-4 border border-slate-300 rounded">
                  <table className="w-full text-lg">
                    <tbody>
                      <tr className="border-b border-slate-200">
                        <td className="p-2 font-semibold">เงินประกันห้อง</td>
                        <td className="p-2 text-right text-blue-700">{securityDeposit.toLocaleString()} บาท</td>
                      </tr>
                      <tr className="border-b border-slate-200">
                        <td className="p-2 font-semibold">ค่าเช่าล่วงหน้า</td>
                        <td className="p-2 text-right text-blue-700">{advanceRent.toLocaleString()} บาท</td>
                      </tr>
                      {commonFeeIncluded > 0 && (
                        <tr className="border-b border-slate-200">
                          <td className="p-2 font-semibold">รวมส่วนกลาง</td>
                          <td className="p-2 text-right text-blue-700">{commonFeeIncluded.toLocaleString()} บาท</td>
                        </tr>
                      )}
                      <tr className="border-b border-slate-200 bg-blue-50">
                        <td className="p-2 font-bold">รวมสุทธิ</td>
                        <td className="p-2 text-right text-blue-700 font-bold">{totalBookingAmount.toLocaleString()} บาท</td>
                      </tr>
                      <tr className="bg-green-50">
                        <td className="p-2 font-bold text-green-700">* คงเหลือชำระทีหลัง</td>
                        <td className="p-2 text-right text-green-700 font-bold">{remainingAmount.toLocaleString()} บาท</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Required Documents */}
          <div className="mb-6 bg-slate-50 p-4 rounded border border-slate-200">
            <h3 className="font-bold text-lg mb-2 text-blue-800">สิ่งที่ต้องนำมาด้วยในวันทำสัญญาเข้าห้อง</h3>
            <ol className="list-decimal list-inside text-lg space-y-1 pl-4">
              <li>บัตรประจำตัวประชาชน ตัวจริง พร้อมสำเนาบัตรประชาชน ของผู้เช่าและผู้อาศัยทั้งหมด</li>
              <li>กำหนดให้ผู้จองห้องมาทำสัญญาเช่าภายในวันที่ <span className="text-red-600 font-bold">{formatThaiDate(contractDeadline || checkInDate)}</span> หากพ้นกำหนดนี้ถือว่าสละสิทธิ์</li>
            </ol>
          </div>

          {/* Important Notes */}
          <div className="mb-8 border-2 border-red-200 bg-red-50 p-4 rounded">
            <h3 className="font-bold text-red-700 mb-2">หมายเหตุ</h3>
            <p className="text-lg">
              เงินจองห้องนี้เป็นส่วนหนึ่งในการหักลดค่ามัดจำห้องเช่าในวันทำสัญญาเช่าห้อง หากผู้เช่าห้องสละสิทธิ์หรือไม่ประสงค์ที่จะเช่าห้องที่จองไว้ เงินจำนวนนี้ไม่มีการคืนให้ไม่ว่ากรณีใดๆ ทั้งสิ้น
            </p>
            <p className="text-lg mt-2">
              ใบจองห้องทำขึ้น 2 เพื่อให้ผู้รับจองห้อง 1 และผู้จองห้อง 1
            </p>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 mt-12">
            <div className="text-center">
              <p className="mb-16 text-lg">ลงชื่อ..............................................</p>
              <p className="text-lg">({lessorName || '..........................................'})</p>
              <p className="font-semibold text-lg mt-1">ผู้รับจองห้อง</p>
            </div>
            <div className="text-center">
              <p className="mb-16 text-lg">ลงชื่อ..............................................</p>
              <p className="text-lg">({guestName})</p>
              <p className="font-semibold text-lg mt-1">ผู้จองห้อง</p>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body, html {
            background: white !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          /* ซ่อน sidebar + header เท่านั้น */
          aside, nav, .sidebar, [data-sidebar], header, .print\\:hidden {
            display: none !important;
          }
          
          @page {
            size: A4;
            margin: 8mm;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          .print\\:shadow-none, .shadow-lg, .shadow-sm, .shadow-xl, .shadow-2xl {
            box-shadow: none !important;
          }
          
          .print\\:max-w-none {
            max-width: none !important;
          }
          
          .print\\:p-0 {
            padding: 0 !important;
          }
          
          .print\\:break-after-page {
            break-after: page;
          }
          
          .print\\:space-y-0 > * + * {
            margin-top: 0 !important;
          }
          
          /* ลบ border-radius ทั้งหมด */
          .rounded, .rounded-lg, .rounded-xl, .rounded-2xl, .rounded-full {
            border-radius: 0 !important;
          }
          
          /* เก็บสีพื้นหลังและกรอบในโหมดพิมพ์ */
          .bg-white, .bg-blue-600, .bg-blue-800, .bg-blue-700, .bg-blue-50,
          .bg-slate-300, .bg-slate-200, .bg-slate-50,
          .bg-red-50, .bg-green-50,
          .border-slate-300, .border-slate-200, .border-slate-400,
          .border-red-200, .border-blue-200, .border-blue-300,
          .border-t-2, .border-b-2, .border-2 {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          /* ซ่อนกรอบพิมพ์ */
          * {
            border: none !important;
          }
          
          /* เก็บกรอบที่จำเป็น */
          .border, .border-2, .border-t, .border-b, .border-l, .border-r {
            border: 1px solid currentColor !important;
          }
          
          img {
            border: none !important;
            box-shadow: none !important;
          }
          
          /* ลดขนาด font ทั้งหมด */
          h1 { font-size: 18px !important; line-height: 1.1 !important; }
          h2 { font-size: 15px !important; line-height: 1.1 !important; }
          h3 { font-size: 13px !important; line-height: 1.2 !important; }
          .text-3xl { font-size: 16px !important; }
          .text-2xl { font-size: 14px !important; }
          .text-xl { font-size: 12px !important; }
          .text-lg { font-size: 11px !important; }
          .text-base, p, span, td, th, li { font-size: 10px !important; }
          .text-sm { font-size: 9px !important; }
          .text-xs { font-size: 8px !important; }
          
          /* ลดระยะห่าง padding */
          .p-8 { padding: 8px !important; }
          .p-6 { padding: 6px !important; }
          .p-4 { padding: 5px !important; }
          .p-3 { padding: 4px !important; }
          .p-2 { padding: 3px !important; }
          .px-8 { padding-left: 8px !important; padding-right: 8px !important; }
          .px-6 { padding-left: 6px !important; padding-right: 6px !important; }
          .px-4 { padding-left: 5px !important; padding-right: 5px !important; }
          .py-6 { padding-top: 6px !important; padding-bottom: 6px !important; }
          .py-4 { padding-top: 5px !important; padding-bottom: 5px !important; }
          .py-2 { padding-top: 3px !important; padding-bottom: 3px !important; }
          
          /* ลดระยะห่าง margin */
          .mb-8, .mt-8 { margin-bottom: 6px !important; margin-top: 6px !important; }
          .mb-6, .mt-6 { margin-bottom: 5px !important; margin-top: 5px !important; }
          .mb-4, .mt-4 { margin-bottom: 3px !important; margin-top: 3px !important; }
          .mb-3, .mt-3 { margin-bottom: 2px !important; margin-top: 2px !important; }
          .mb-2, .mt-2 { margin-bottom: 2px !important; margin-top: 2px !important; }
          .mb-12, .mt-12 { margin-bottom: 8px !important; margin-top: 8px !important; }
          .mb-16 { margin-bottom: 10px !important; }
          
          /* ลด gap */
          .gap-8 { gap: 6px !important; }
          .gap-6 { gap: 5px !important; }
          .gap-4 { gap: 4px !important; }
          .gap-3 { gap: 3px !important; }
          .gap-2 { gap: 2px !important; }
          
          /* ลดขนาดรูป */
          .h-20 { height: 40px !important; }
          
          /* space ระหว่างบรรทัด */
          .space-y-4 > * + * { margin-top: 3px !important; }
          .space-y-3 > * + * { margin-top: 2px !important; }
          .space-y-2 > * + * { margin-top: 2px !important; }
          .space-y-1 > * + * { margin-top: 1px !important; }
          
          /* list */
          ol, ul { 
            font-size: 10px !important;
            line-height: 1.2 !important;
            margin-left: 10px !important;
          }
          
          li { margin-bottom: 2px !important; }
          
          /* table */
          table { font-size: 10px !important; }
          td, th { padding: 3px !important; line-height: 1.1 !important; }
          tr { page-break-inside: avoid !important; }
        }
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap');
      `}</style>
    </div>
  );
}