import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, User, Phone, Home, Calendar, Wallet, CreditCard, CheckCircle, Sparkles, Plus, Trash2 } from "lucide-react";
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
  const [vehicles, setVehicles] = useState([]);

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
    
    if (!formData.full_name) {
      toast.error('กรุณากรอกชื่อ-นามสกุล');
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
      vehicles: vehicles,
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

  const addVehicle = () => {
    setVehicles(prev => [...prev, { type: 'motorcycle', plate: '', brand: '' }]);
  };

  const removeVehicle = (index) => {
    setVehicles(prev => prev.filter((_, i) => i !== index));
  };

  const updateVehicle = (index, field, value) => {
    setVehicles(prev => prev.map((v, i) => i === index ? { ...v, [field]: value } : v));
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
            
            {bookings.length > 0 && (
              <div className="space-y-2">
                {bookings.map((booking, idx) => (
                  <div key={idx} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm font-semibold text-green-900 flex items-center gap-2">
                      <Home className="w-4 h-4" />
                      จะสร้างสัญญาเช่าห้อง {booking.room_number || '(ยังไม่เลือก)'}
                    </p>
                    {booking.check_in_date && (
                      <p className="text-xs text-green-700 mt-1">
                        วันเริ่มเช่า: {booking.check_in_date}
                      </p>
                    )}
                    {booking.deposit_amount && (
                      <p className="text-xs text-green-700 mt-1">
                        เงินมัดจำ: {parseFloat(booking.deposit_amount).toLocaleString()} บาท
                      </p>
                    )}
                  </div>
                ))}
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
                <Label>เบอร์โทรศัพท์</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="0812345678"
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
              <Button
                type="button"
                size="sm"
                onClick={addBooking}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                เพิ่มสัญญาเช่า
              </Button>
            </div>

            {bookings.length > 0 && (
              <div className="space-y-3">
                {bookings.map((booking, index) => (
                  <div key={index} className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200 relative">
                    <button
                      type="button"
                      onClick={() => removeBooking(index)}
                      className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <p className="text-xs font-semibold text-blue-800">สัญญาที่ {index + 1}</p>
                    <div>
                      <Label>เลือกห้อง *</Label>
                      <select
                        value={booking.room_number}
                        onChange={(e) => updateBooking(index, 'room_number', e.target.value)}
                        className="w-full text-sm border rounded-lg px-3 py-2"
                        required
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
                          value={booking.check_in_date}
                          onChange={(e) => updateBooking(index, 'check_in_date', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label>เงินมัดจำ (บาท)</Label>
                        <Input
                          type="number"
                          value={booking.deposit_amount}
                          onChange={(e) => updateBooking(index, 'deposit_amount', e.target.value)}
                          placeholder="5000"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ข้อมูลยานพาหนะ */}
          <div className="border-t pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                  <circle cx="7" cy="17" r="2" />
                  <path d="M9 17h6" />
                  <circle cx="17" cy="17" r="2" />
                </svg>
                ยานพาหนะ
              </h3>
              <Button
                type="button"
                size="sm"
                onClick={addVehicle}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                เพิ่มรถ
              </Button>
            </div>

            {vehicles.length > 0 && (
              <div className="space-y-3">
                {vehicles.map((vehicle, index) => (
                  <div key={index} className="space-y-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200 relative">
                    <button
                      type="button"
                      onClick={() => removeVehicle(index)}
                      className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <p className="text-xs font-semibold text-emerald-800">รถคันที่ {index + 1}</p>
                    
                    <div>
                      <Label>ประเภท *</Label>
                      <select
                        value={vehicle.type}
                        onChange={(e) => updateVehicle(index, 'type', e.target.value)}
                        className="w-full text-sm border rounded-lg px-3 py-2"
                        required
                      >
                        <option value="motorcycle">🏍️ มอเตอร์ไซค์</option>
                        <option value="car">🚗 รถยนต์</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>ทะเบียนรถ *</Label>
                        <Input
                          value={vehicle.plate}
                          onChange={(e) => updateVehicle(index, 'plate', e.target.value)}
                          placeholder="กก 1234"
                          required
                        />
                      </div>
                      <div>
                        <Label>ยี่ห้อ/รุ่น</Label>
                        <Input
                          value={vehicle.brand}
                          onChange={(e) => updateVehicle(index, 'brand', e.target.value)}
                          placeholder="Honda Wave"
                        />
                      </div>
                    </div>
                  </div>
                ))}
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