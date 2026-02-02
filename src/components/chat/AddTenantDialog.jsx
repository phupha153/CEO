import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User, Phone, Home, Calendar, Wallet, CreditCard, CheckCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function AddTenantDialog({ 
  open, 
  onClose, 
  aiData, 
  rooms,
  onSubmit,
  submitting,
  conversation,
  analyzing
}) {
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    address: '',
    national_id: '',
  });
  const [bookings, setBookings] = useState([]);

  // เมื่อ AI ส่งข้อมูลมา ให้กรอกในฟอร์มอัตโนมัติ
  useEffect(() => {
    if (aiData) {
      setFormData({
        full_name: aiData.full_name || '',
        phone: aiData.phone || '',
        address: aiData.address || '',
        national_id: aiData.national_id || '',
      });
      
      // ถ้า AI ส่ง room_numbers มา (หลายห้อง) ให้สร้าง bookings array
      if (aiData.room_numbers && aiData.room_numbers.length > 0) {
        setBookings(aiData.room_numbers.map(roomNum => ({
          room_number: roomNum,
          check_in_date: aiData.check_in_date || '',
          deposit_amount: aiData.deposit_amount || ''
        })));
      } else if (aiData.room_number) {
        // ถ้ามีแค่ห้องเดียว
        setBookings([{
          room_number: aiData.room_number,
          check_in_date: aiData.check_in_date || '',
          deposit_amount: aiData.deposit_amount || ''
        }]);
      }
    }
  }, [aiData]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.phone) {
      toast.error('กรุณากรอกชื่อและเบอร์โทรศัพท์');
      return;
    }

    if (bookings.length > 0) {
      const invalidBooking = bookings.find(b => !b.room_number);
      if (invalidBooking) {
        toast.error('กรุณาเลือกห้องสำหรับสัญญาเช่าทุกรายการ');
        return;
      }
    }

    onSubmit({
      tenantData: formData,
      bookings: bookings,
    });
  };

  const addBooking = () => {
    setBookings([...bookings, { room_number: '', check_in_date: '', deposit_amount: '' }]);
  };

  const removeBooking = (index) => {
    setBookings(bookings.filter((_, i) => i !== index));
  };

  const updateBooking = (index, field, value) => {
    setBookings(bookings.map((b, i) => i === index ? { ...b, [field]: value } : b));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              เพิ่มผู้เช่า
            </DialogTitle>
            {analyzing ? (
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                AI กำลังวิเคราะห์...
              </div>
            ) : aiData && (
              <div className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                <Sparkles className="w-3 h-3" />
                วิเคราะห์จาก AI
              </div>
            )}
          </div>
          {aiData && !analyzing && (
            <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-2">
              {aiData.full_name && <span>• ชื่อ: {aiData.full_name}</span>}
              {aiData.phone && <span>• เบอร์: {aiData.phone}</span>}
              {aiData.room_number && <span>• ห้อง: {aiData.room_number}</span>}
              {aiData.check_in_date && <span>• วันเริ่ม: {aiData.check_in_date}</span>}
              {aiData.deposit_amount && <span>• มัดจำ: {parseFloat(aiData.deposit_amount).toLocaleString()} บาท</span>}
            </div>
          )}
        </DialogHeader>

        {analyzing ? (
          <div className="py-12 flex flex-col items-center justify-center">
            <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
            <p className="text-slate-600 font-medium">AI กำลังวิเคราะห์ข้อความ...</p>
            <p className="text-xs text-slate-500 mt-1">กรุณารอสักครู่</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          {/* สรุปการดำเนินการ */}
          <div className="space-y-2">
            {conversation && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-semibold text-blue-900 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  จะเชื่อมต่อกับ {conversation.facebook_user_id ? 'Facebook' : 'LINE'}
                </p>
              </div>
            )}
            
            {createBooking && aiData?.room_numbers && aiData.room_numbers.length > 0 && (
              <div className="space-y-2">
                {aiData.room_numbers.map((roomNum, idx) => (
                  <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-semibold text-green-900 flex items-center gap-2">
                      <Home className="w-4 h-4" />
                      จะสร้างสัญญาเช่าห้อง {roomNum}
                    </p>
                    {formData.check_in_date && (
                      <p className="text-xs text-green-700 mt-1">
                        วันเริ่มเช่า: {formData.check_in_date}
                      </p>
                    )}
                    {formData.deposit_amount && (
                      <p className="text-xs text-green-700 mt-1">
                        เงินมัดจำ: {parseFloat(formData.deposit_amount).toLocaleString()} บาท
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {createBooking && formData.room_number && (!aiData?.room_numbers || aiData.room_numbers.length === 0) && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm font-semibold text-green-900 flex items-center gap-2">
                  <Home className="w-4 h-4" />
                  จะสร้างสัญญาเช่าห้อง {formData.room_number}
                </p>
                {formData.check_in_date && (
                  <p className="text-xs text-green-700 mt-1">
                    วันเริ่มเช่า: {formData.check_in_date}
                  </p>
                )}
                {formData.deposit_amount && (
                  <p className="text-xs text-green-700 mt-1">
                    เงินมัดจำ: {parseFloat(formData.deposit_amount).toLocaleString()} บาท
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ข้อมูลผู้เช่า */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <User className="w-4 h-4" />
              ข้อมูลผู้เช่า
            </h3>
            
            <div>
              <Label>ชื่อ-นามสกุล *</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="นายสมชาย ใจดี"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>เบอร์โทรศัพท์ *</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0812345678"
                  required
                />
              </div>
              <div>
                <Label>เลขบัตรประชาชน</Label>
                <Input
                  value={formData.national_id}
                  onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                  placeholder="1234567890123"
                  maxLength={13}
                />
              </div>
            </div>

            <div>
              <Label>ที่อยู่</Label>
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 ถนน..."
                rows={2}
              />
            </div>
          </div>

          {/* ข้อมูลการเช่า */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <Home className="w-4 h-4" />
                ข้อมูลการเช่าห้อง
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={createBooking}
                  onChange={(e) => setCreateBooking(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-slate-700">เพิ่มสัญญาเช่า</span>
              </label>
            </div>

            {createBooking && (
              <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div>
                  <Label>เลือกห้อง *</Label>
                  <select
                    value={formData.room_number}
                    onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                    className="w-full text-sm border rounded-lg px-3 py-2"
                    required={createBooking}
                  >
                    <option value="">-- เลือกห้อง --</option>
                    {rooms
                      .filter(r => r.status === 'available')
                      .sort((a, b) => a.room_number.localeCompare(b.room_number, 'th', { numeric: true }))
                      .map(room => (
                        <option key={room.id} value={room.room_number}>
                          ห้อง {room.room_number} - {room.price?.toLocaleString()} บาท/เดือน
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>วันเริ่มเช่า</Label>
                    <Input
                      type="date"
                      value={formData.check_in_date}
                      onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>เงินมัดจำ (บาท)</Label>
                    <Input
                      type="number"
                      value={formData.deposit_amount}
                      onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                      placeholder="5000"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              ยกเลิก
            </Button>
            <Button 
              type="submit" 
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  บันทึก
                </>
              )}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}