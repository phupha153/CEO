import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Phone, Mail, Upload, CheckCircle2, DoorOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function PublicBooking() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const branch_id = urlParams.get('branch_id');
  
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [guestData, setGuestData] = useState({
    guest_name: "",
    guest_phone: "",
    guest_email: "",
    guest_national_id: "",
    guest_address: "",
    check_in_date: ""
  });
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // ดึงข้อมูลสาขา
  const { data: branch, isLoading: branchLoading } = useQuery({
    queryKey: ['publicBranch', branch_id],
    queryFn: async () => {
      if (!branch_id) return null;
      const branches = await base44.entities.Branch.filter({ id: branch_id });
      return branches[0] || null;
    },
    enabled: !!branch_id
  });

  // ดึงข้อมูล Config ของสาขา
  const { data: configs = [] } = useQuery({
    queryKey: ['publicConfigs', branch_id],
    queryFn: async () => {
      const allConfigs = await base44.entities.Config.list('', 200);
      return allConfigs.filter(c => !c.branch_id || c.branch_id === branch_id);
    },
    enabled: !!branch_id
  });

  const getConfig = (key, defaultValue = '') => {
    const branchConfig = configs.find(c => c.key === key && c.branch_id === branch_id);
    if (branchConfig) return branchConfig.value;
    const globalConfig = configs.find(c => c.key === key && !c.branch_id);
    return globalConfig ? globalConfig.value : defaultValue;
  };

  const buildingLogo = getConfig('building_logo', 'https://via.placeholder.com/150');
  const buildingName = getConfig('building_name', 'หอพัก');

  // ดึงห้องว่าง (status = available, room_type = monthly)
  const { data: availableRooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['publicRooms', branch_id],
    queryFn: async () => {
      const rooms = await base44.entities.Room.filter({
        branch_id: branch_id,
        status: 'available',
        room_type: 'monthly'
      }, 'floor,room_number', 100);
      return rooms;
    },
    enabled: !!branch_id
  });

  // Mutation สำหรับสร้างการจอง
  const createBookingMutation = useMutation({
    mutationFn: async (bookingData) => {
      const response = await base44.functions.invoke('createPublicBooking', bookingData);
      return response.data;
    },
    onSuccess: (data) => {
      setBookingSuccess(data);
      toast.success('🎉 จองห้องสำเร็จ!');
    },
    onError: (error) => {
      toast.error(`❌ จองไม่สำเร็จ: ${error.message}`);
    }
  });

  const handleSlipUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSlipFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSlipPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitBooking = async () => {
    // Validate
    if (!selectedRoom) {
      toast.error('กรุณาเลือกห้องที่ต้องการจอง');
      return;
    }
    if (!guestData.guest_name || !guestData.guest_phone || !guestData.check_in_date) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (!slipFile) {
      toast.error('กรุณาอัพโหลดสลิปโอนเงินมัดจำ');
      return;
    }

    try {
      // อัพโหลดสลิป
      const { file_url } = await base44.integrations.Core.UploadFile({ file: slipFile });

      // สร้างการจอง
      await createBookingMutation.mutateAsync({
        branch_id,
        room_id: selectedRoom.id,
        ...guestData,
        deposit_slip_url: file_url
      });
    } catch (error) {
      console.error('Booking error:', error);
    }
  };

  if (branchLoading || roomsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">ไม่พบสาขานี้</CardTitle>
            <CardDescription>กรุณาตรวจสอบลิงค์อีกครั้ง</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // แสดงหน้าจองสำเร็จ
  if (bookingSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-2xl w-full"
        >
          <Card>
            <CardHeader className="text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <CardTitle className="text-2xl text-green-700">จองห้องสำเร็จ! 🎉</CardTitle>
              <CardDescription>เจ้าหน้าที่จะติดต่อกลับเร็วๆ นี้</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-slate-600 mb-1">เลขที่การจอง</p>
                <p className="text-2xl font-bold text-blue-700">{bookingSuccess.booking_no}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">ห้อง</p>
                  <p className="font-semibold">{bookingSuccess.room_number}</p>
                </div>
                <div>
                  <p className="text-slate-500">วันที่เข้าพัก</p>
                  <p className="font-semibold">{new Date(bookingSuccess.check_in_date).toLocaleDateString('th-TH')}</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 text-center mt-6">
                กรุณาเก็บเลขที่การจองไว้สำหรับติดตามสถานะ
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 py-8 px-4">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-lg">
            <div className="flex items-center justify-center gap-4 mb-2">
              <img src={buildingLogo} alt="Logo" className="w-16 h-16 rounded-full bg-white p-2" />
              <div className="text-left">
                <CardTitle className="text-2xl">{buildingName}</CardTitle>
                <CardDescription className="text-blue-100">{branch.branch_name}</CardDescription>
              </div>
            </div>
            <div className="flex items-center justify-center gap-4 text-sm text-blue-100">
              {branch.address && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{branch.address}</span>
                </div>
              )}
              {branch.phone && (
                <div className="flex items-center gap-1">
                  <Phone className="w-4 h-4" />
                  <span>{branch.phone}</span>
                </div>
              )}
            </div>
          </CardHeader>
        </Card>
      </div>

      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-6">
        {/* ห้องว่าง */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DoorOpen className="w-5 h-5 text-blue-600" />
                เลือกห้องที่ต้องการจอง
              </CardTitle>
              <CardDescription>ห้องว่าง {availableRooms.length} ห้อง</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {availableRooms.length === 0 ? (
                <p className="text-center text-slate-500 py-8">ไม่มีห้องว่างในขณะนี้</p>
              ) : (
                availableRooms.map(room => (
                  <motion.div
                    key={room.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Card
                      className={`cursor-pointer transition-all ${
                        selectedRoom?.id === room.id
                          ? 'border-blue-500 border-2 bg-blue-50'
                          : 'hover:border-slate-300'
                      }`}
                      onClick={() => setSelectedRoom(room)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-lg">ห้อง {room.room_number}</p>
                            <p className="text-sm text-slate-600">ชั้น {room.floor}</p>
                            {room.size && <p className="text-xs text-slate-500">{room.size} ตร.ม.</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-bold text-blue-600">
                              ฿{room.price.toLocaleString()}
                            </p>
                            <p className="text-xs text-slate-500">/ เดือน</p>
                          </div>
                        </div>
                        {room.amenities && room.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {room.amenities.slice(0, 3).map((amenity, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {amenity}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* ฟอร์มจอง */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ข้อมูลผู้จอง</CardTitle>
              <CardDescription>กรุณากรอกข้อมูลให้ครบถ้วน</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="guest_name">ชื่อ-นามสกุล *</Label>
                <Input
                  id="guest_name"
                  value={guestData.guest_name}
                  onChange={(e) => setGuestData({...guestData, guest_name: e.target.value})}
                  placeholder="กรอกชื่อ-นามสกุล"
                />
              </div>
              <div>
                <Label htmlFor="guest_phone">เบอร์โทรศัพท์ *</Label>
                <Input
                  id="guest_phone"
                  value={guestData.guest_phone}
                  onChange={(e) => setGuestData({...guestData, guest_phone: e.target.value})}
                  placeholder="08X-XXX-XXXX"
                />
              </div>
              <div>
                <Label htmlFor="guest_email">อีเมล</Label>
                <Input
                  id="guest_email"
                  type="email"
                  value={guestData.guest_email}
                  onChange={(e) => setGuestData({...guestData, guest_email: e.target.value})}
                  placeholder="example@email.com"
                />
              </div>
              <div>
                <Label htmlFor="guest_national_id">เลขบัตรประชาชน</Label>
                <Input
                  id="guest_national_id"
                  value={guestData.guest_national_id}
                  onChange={(e) => setGuestData({...guestData, guest_national_id: e.target.value})}
                  placeholder="X-XXXX-XXXXX-XX-X"
                  maxLength={13}
                />
              </div>
              <div>
                <Label htmlFor="check_in_date">วันที่ต้องการเข้าพัก *</Label>
                <Input
                  id="check_in_date"
                  type="date"
                  value={guestData.check_in_date}
                  onChange={(e) => setGuestData({...guestData, check_in_date: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <div>
                <Label htmlFor="guest_address">ที่อยู่</Label>
                <Input
                  id="guest_address"
                  value={guestData.guest_address}
                  onChange={(e) => setGuestData({...guestData, guest_address: e.target.value})}
                  placeholder="ที่อยู่ปัจจุบัน"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>อัพโหลดสลิปโอนเงินมัดจำ *</CardTitle>
              <CardDescription>โอนเงินมัดจำตามจำนวนที่ระบุ</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedRoom && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                  <p className="text-amber-800 font-semibold">จำนวนเงินมัดจำ</p>
                  <p className="text-2xl font-bold text-amber-600">
                    ฿{(selectedRoom.price * 0.5).toLocaleString()}
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    (50% ของค่าเช่ารายเดือน)
                  </p>
                </div>
              )}
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleSlipUpload}
                  className="hidden"
                  id="slip-upload"
                />
                <label htmlFor="slip-upload" className="cursor-pointer">
                  {slipPreview ? (
                    <img src={slipPreview} alt="Slip" className="max-h-40 mx-auto rounded" />
                  ) : (
                    <div>
                      <Upload className="w-12 h-12 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">คลิกเพื่ออัพโหลดสลิป</p>
                    </div>
                  )}
                </label>
              </div>
              <Button
                onClick={handleSubmitBooking}
                disabled={createBookingMutation.isPending}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                size="lg"
              >
                {createBookingMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    กำลังจอง...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    ยืนยันการจอง
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}