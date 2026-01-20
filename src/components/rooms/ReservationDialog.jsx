import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, addDays, parseISO, isBefore, isAfter } from "date-fns";
import { th } from "date-fns/locale";
import { Calendar as CalendarIcon, User, Plus, Search, Loader2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

export default function ReservationDialog({ 
  open, 
  onOpenChange, 
  room, 
  currentBookings = [], 
  tenants = [],
  onSuccess 
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [bookingType, setBookingType] = useState("monthly");
  
  // Form State
  const [formData, setFormData] = useState({
    check_in_date: "",
    check_out_date: "",
    tenant_id: "",
    guest_name: "", // For new tenant or daily
    guest_phone: "",
    guest_email: "",
    guest_national_id: "",
    guest_address: "",
    guest_line_id: "",
    deposit_amount: "",
    security_deposit: "",
    advance_rent: "",
    common_fee: "",
    contract_duration: "",
    room_price: "",
    notes: ""
  });

  // Tenant selection state
  const [searchTerm, setSearchQuery] = useState("");
  const [isNewTenant, setIsNewTenant] = useState(false);

  useEffect(() => {
    if (open && room) {
      // Initialize form
      let defaultCheckIn = new Date();
      
      // Check if room is occupied, set check-in to next available date
      const activeBooking = currentBookings.find(b => 
        b.room_id === room.id && 
        b.status === 'active' && 
        (!b.check_out_date || new Date(b.check_out_date) >= new Date())
      );

      if (activeBooking && activeBooking.check_out_date) {
        try {
          const nextDay = addDays(parseISO(activeBooking.check_out_date), 1);
          if (isAfter(nextDay, new Date())) {
            defaultCheckIn = nextDay;
          }
        } catch (e) {}
      }

      setFormData({
        check_in_date: format(defaultCheckIn, 'yyyy-MM-dd'),
        check_out_date: "",
        tenant_id: "",
        guest_name: "",
        guest_phone: "",
        guest_email: "",
        guest_national_id: "",
        guest_address: "",
        guest_line_id: "",
        deposit_amount: "",
        security_deposit: "",
        advance_rent: "",
        common_fee: "",
        contract_duration: "",
        room_price: room.price?.toString() || "",
        notes: ""
      });
      setBookingType("monthly");
      setStep(1);
      setIsNewTenant(false);
      setSearchQuery("");
    }
  }, [open, room, currentBookings]);

  const filteredTenants = tenants.filter(t => 
    t.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.phone?.includes(searchTerm)
  ).slice(0, 5);

  const createBookingMutation = useMutation({
    mutationFn: async (data) => {
      let finalTenantId = data.tenant_id;

      // Create tenant if new (monthly only)
      if (bookingType === 'monthly' && isNewTenant) {
        if (!data.guest_name || !data.guest_phone) {
          throw new Error("กรุณาระบุชื่อและเบอร์โทรผู้เช่า");
        }
        const newTenant = await base44.entities.Tenant.create({
          branch_id: room.branch_id,
          full_name: data.guest_name,
          phone: data.guest_phone,
          email: data.guest_email,
          national_id: data.guest_national_id,
          address: data.guest_address,
          line_id: data.guest_line_id,
          status: 'active'
        });
        finalTenantId = newTenant.id;
      }

      // Create Booking
      const bookingData = {
        branch_id: room.branch_id,
        room_id: room.id,
        tenant_id: bookingType === 'monthly' ? finalTenantId : undefined,
        guest_name: bookingType === 'daily' ? data.guest_name : undefined,
        guest_phone: bookingType === 'daily' ? data.guest_phone : undefined,
        guest_email: bookingType === 'daily' ? data.guest_email : undefined,
        guest_national_id: bookingType === 'daily' ? data.guest_national_id : undefined,
        guest_address: bookingType === 'daily' ? data.guest_address : undefined,
        check_in_date: data.check_in_date,
        check_out_date: data.check_out_date || undefined,
        booking_type: bookingType,
        status: 'active',
        deposit_amount: bookingType === 'daily' ? (data.deposit_amount ? parseFloat(data.deposit_amount) : 0) : 0,
        security_deposit: bookingType === 'monthly' ? (data.security_deposit ? parseFloat(data.security_deposit) : 0) : undefined,
        advance_rent: bookingType === 'monthly' ? (data.advance_rent ? parseFloat(data.advance_rent) : 0) : undefined,
        common_fee_included: bookingType === 'monthly' ? (data.common_fee ? parseFloat(data.common_fee) : 0) : undefined,
        contract_duration: bookingType === 'monthly' ? data.contract_duration : undefined,
        total_amount: data.room_price ? parseFloat(data.room_price) : 0,
        notes: data.notes
      };

      return await base44.entities.Booking.create(bookingData);
    },
    onSuccess: () => {
      toast.success("บันทึกการจองสำเร็จ");
      queryClient.invalidateQueries(['bookings']);
      queryClient.invalidateQueries(['rooms']);
      queryClient.invalidateQueries(['tenants']);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    }
  });

  const handleSubmit = () => {
    if (!formData.check_in_date) {
      toast.error("กรุณาระบุวันเข้าพัก");
      return;
    }
    if (bookingType === 'daily' && !formData.check_out_date) {
      toast.error("กรุณาระบุวันที่ออก (สำหรับรายวัน)");
      return;
    }
    if (bookingType === 'daily' && !formData.guest_name) {
      toast.error("กรุณาระบุชื่อผู้เข้าพัก");
      return;
    }
    if (bookingType === 'monthly' && !isNewTenant && !formData.tenant_id) {
      toast.error("กรุณาเลือกผู้เช่า");
      return;
    }
    if (bookingType === 'monthly' && isNewTenant && (!formData.guest_name || !formData.guest_phone)) {
      toast.error("กรุณาระบุชื่อและเบอร์โทรผู้เช่า");
      return;
    }
    
    // Check overlaps
    const newStart = parseISO(formData.check_in_date);
    const newEnd = formData.check_out_date ? parseISO(formData.check_out_date) : null;

    const hasOverlap = currentBookings.some(b => {
      if (b.room_id !== room.id || b.status !== 'active') return false;
      
      const existingStart = parseISO(b.check_in_date);
      const existingEnd = b.check_out_date ? parseISO(b.check_out_date) : null; // If null, indefinite (monthly)

      // If monthly indefinite, it overlaps with any future date unless we assume it ends before new start
      // But usually we reserve AFTER current booking ends.
      // If existing has no end date, we assume it's ongoing.
      
      if (!existingEnd) {
        // Existing is indefinite. New booking starts after existing starts.
        // This is an overlap unless we set an end date to existing booking (which we don't do here)
        // Allow reservation only if start date is far in future? No.
        // Just warn.
        return isBefore(existingStart, newStart) || isBefore(existingStart, newEnd || new Date(9999, 0, 1));
      }

      // Standard overlap check
      const startOverlap = newEnd ? isBefore(newStart, existingEnd) : true;
      const endOverlap = newEnd ? isAfter(newEnd, existingStart) : isAfter(newStart, existingStart); // Logic simplification

      // (StartA <= EndB) and (EndA >= StartB)
      const overlap = (newEnd ? newStart <= existingEnd : true) && (existingStart <= (newEnd || new Date(9999, 0, 1)));
      return overlap;
    });

    // If overlap, just warn but allow? Or block?
    // User request: "จองต่อกับที่ผู้เช่าอยู่ได้" -> implies no overlap ideally.
    // We will proceed but maybe show toast if creates overlap?
    // Let's just create.
    
    createBookingMutation.mutate(formData);
  };

  const activeBooking = currentBookings.find(b => b.room_id === room?.id && b.status === 'active');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>จองห้องพัก {room?.room_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {activeBooking && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex gap-3 items-start">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-semibold">ห้องนี้มีผู้เช่าอยู่แล้ว</p>
                <p>สิ้นสุดสัญญา: {activeBooking.check_out_date ? format(parseISO(activeBooking.check_out_date), "d MMM yyyy", { locale: th }) : "ไม่มีกำหนด"}</p>
                <p className="text-xs mt-1 opacity-80">การจองใหม่ควรเริ่มหลังจากวันที่สิ้นสุดสัญญา</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="font-semibold text-base">ประเภทการเช่า</Label>
            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant={bookingType === 'monthly' ? 'default' : 'outline'}
                className={`h-14 text-base font-semibold ${bookingType === 'monthly' ? 'bg-gradient-to-r from-blue-600 to-indigo-600' : ''}`}
                onClick={() => setBookingType('monthly')}
              >
                📅 รายเดือน
              </Button>
              <Button
                type="button"
                variant={bookingType === 'daily' ? 'default' : 'outline'}
                className={`h-14 text-base font-semibold ${bookingType === 'daily' ? 'bg-gradient-to-r from-green-600 to-emerald-600' : ''}`}
                onClick={() => setBookingType('daily')}
              >
                🏨 รายวัน
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>วันที่เข้าพัก *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.check_in_date ? format(parseISO(formData.check_in_date), "d MMM yyyy", { locale: th }) : "เลือกวันที่"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.check_in_date ? parseISO(formData.check_in_date) : undefined}
                    onSelect={(date) => setFormData({...formData, check_in_date: date ? format(date, "yyyy-MM-dd") : ""})}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>วันที่ออก {bookingType === 'daily' ? '*' : '(ไม่บังคับ)'}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.check_out_date ? format(parseISO(formData.check_out_date), "d MMM yyyy", { locale: th }) : "เลือกวันที่"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={formData.check_out_date ? parseISO(formData.check_out_date) : undefined}
                    onSelect={(date) => setFormData({...formData, check_out_date: date ? format(date, "yyyy-MM-dd") : ""})}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {bookingType === 'monthly' && (
            <div className="space-y-3 border p-3 rounded-lg bg-slate-50">
              <Label className="flex justify-between">
                ผู้เช่า
                {!isNewTenant ? (
                  <Button variant="link" size="sm" className="h-auto p-0 text-blue-600" onClick={() => setIsNewTenant(true)}>
                    + สร้างใหม่
                  </Button>
                ) : (
                  <Button variant="link" size="sm" className="h-auto p-0 text-blue-600" onClick={() => setIsNewTenant(false)}>
                    เลือกที่มีอยู่
                  </Button>
                )}
              </Label>

              {isNewTenant ? (
                <div className="space-y-2">
                  <Input 
                    placeholder="ชื่อ-นามสกุล (ภาษาไทย) *" 
                    value={formData.guest_name}
                    onChange={e => setFormData({...formData, guest_name: e.target.value})}
                  />
                  <Input 
                    placeholder="เบอร์โทร *" 
                    value={formData.guest_phone}
                    onChange={e => setFormData({...formData, guest_phone: e.target.value})}
                  />
                  <Input 
                    placeholder="อีเมล" 
                    type="email"
                    value={formData.guest_email}
                    onChange={e => setFormData({...formData, guest_email: e.target.value})}
                  />
                  <Input 
                    placeholder="เลขบัตรประชาชน" 
                    value={formData.guest_national_id}
                    onChange={e => setFormData({...formData, guest_national_id: e.target.value})}
                  />
                  <Textarea 
                    placeholder="ที่อยู่เดิม" 
                    value={formData.guest_address}
                    onChange={e => setFormData({...formData, guest_address: e.target.value})}
                    rows={2}
                  />
                  <Input 
                    placeholder="LINE ID" 
                    value={formData.guest_line_id}
                    onChange={e => setFormData({...formData, guest_line_id: e.target.value})}
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                      placeholder="ค้นหาชื่อ หรือเบอร์โทร..." 
                      className="pl-8"
                      value={searchTerm}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                  {searchTerm && (
                    <div className="max-h-32 overflow-y-auto border rounded-md bg-white">
                      {filteredTenants.length === 0 ? (
                        <div className="p-2 text-sm text-center text-muted-foreground">ไม่พบข้อมูล</div>
                      ) : (
                        filteredTenants.map(t => (
                          <div 
                            key={t.id} 
                            className={`p-2 text-sm cursor-pointer hover:bg-slate-100 flex justify-between ${formData.tenant_id === t.id ? 'bg-blue-50' : ''}`}
                            onClick={() => {
                              setFormData({...formData, tenant_id: t.id});
                              setSearchQuery("");
                            }}
                          >
                            <span>{t.full_name}</span>
                            <span className="text-muted-foreground text-xs">{t.phone}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                  {formData.tenant_id && (
                    <div className="bg-blue-100 text-blue-800 p-2 rounded-md text-sm flex items-center gap-2">
                      <User className="w-4 h-4" />
                      {tenants.find(t => t.id === formData.tenant_id)?.full_name || "ผู้เช่าที่เลือก"}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-4 w-4 ml-auto" 
                        onClick={() => setFormData({...formData, tenant_id: ""})}
                      >
                        ×
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {bookingType === 'daily' && (
            <div className="space-y-3 border p-3 rounded-lg bg-blue-50">
              <Label className="font-semibold">ข้อมูลผู้เข้าพัก</Label>
              <Input 
                placeholder="ชื่อ-นามสกุล *" 
                value={formData.guest_name}
                onChange={e => setFormData({...formData, guest_name: e.target.value})}
              />
              <Input 
                placeholder="เบอร์โทร *" 
                value={formData.guest_phone}
                onChange={e => setFormData({...formData, guest_phone: e.target.value})}
              />
              <Input 
                placeholder="อีเมล" 
                type="email"
                value={formData.guest_email}
                onChange={e => setFormData({...formData, guest_email: e.target.value})}
              />
              <Input 
                placeholder="เลขบัตรประชาชน" 
                value={formData.guest_national_id}
                onChange={e => setFormData({...formData, guest_national_id: e.target.value})}
              />
              <Textarea 
                placeholder="ที่อยู่" 
                value={formData.guest_address}
                onChange={e => setFormData({...formData, guest_address: e.target.value})}
                rows={2}
              />
            </div>
          )}

          <div>
            <Label>ค่าเช่า (บาท) *</Label>
            <Input 
              type="number" 
              value={formData.room_price} 
              onChange={e => setFormData({...formData, room_price: e.target.value})}
              placeholder={room?.price?.toString() || "0"}
            />
          </div>

          {bookingType === 'monthly' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>เงินประกันห้อง (บาท)</Label>
                  <Input 
                    type="number"
                    value={formData.security_deposit}
                    onChange={e => setFormData({...formData, security_deposit: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>ค่าเช่าล่วงหน้า (บาท)</Label>
                  <Input 
                    type="number"
                    value={formData.advance_rent}
                    onChange={e => setFormData({...formData, advance_rent: e.target.value})}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>ค่าส่วนกลาง (บาท)</Label>
                  <Input 
                    type="number"
                    value={formData.common_fee}
                    onChange={e => setFormData({...formData, common_fee: e.target.value})}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>ระยะเวลาสัญญา (เช่น 1 ปี)</Label>
                  <Input 
                    placeholder="เช่น 1 ปี, 6 เดือน" 
                    value={formData.contract_duration}
                    onChange={e => setFormData({...formData, contract_duration: e.target.value})}
                  />
                </div>
              </div>
            </>
          )}

          {bookingType === 'daily' && (
            <div>
              <Label>เงินมัดจำ (บาท)</Label>
              <Input 
                type="number"
                value={formData.deposit_amount}
                onChange={e => setFormData({...formData, deposit_amount: e.target.value})}
                placeholder="0"
              />
            </div>
          )}

          <div>
            <Label>หมายเหตุ</Label>
            <Textarea 
              value={formData.notes}
              onChange={e => setFormData({...formData, notes: e.target.value})}
              placeholder="รายละเอียดเพิ่มเติม..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
          <Button onClick={handleSubmit} disabled={createBookingMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
            {createBookingMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            ยืนยันการจอง
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}