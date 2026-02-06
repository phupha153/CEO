import React, { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
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
  Bed
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function PublicBooking() {
  const urlParams = new URLSearchParams(window.location.search);
  const branchId = urlParams.get('branchId');

  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showRoomDetails, setShowRoomDetails] = useState(false);
  const [detailRoom, setDetailRoom] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    guest_name: '',
    guest_phone: '',
    guest_email: '',
    guest_national_id: '',
    guest_address: '',
    check_in_date: new Date().toISOString().split('T')[0]
  });

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

  // Fetch available rooms by date
  const { data: roomsData, isLoading: roomsLoading } = useQuery({
    queryKey: ['publicRooms', branchId, searchDate],
    queryFn: async () => {
      if (!branchId) return { rooms: [], total: 0 };
      const response = await base44.functions.invoke('getAvailableRoomsByDate', {
        branch_id: branchId,
        check_in_date: searchDate
      });
      return response.data;
    },
    enabled: !!branchId && !!searchDate,
    staleTime: 30000
  });

  const rooms = roomsData?.rooms || [];

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (bookingData) => {
      const response = await base44.functions.invoke('createPublicBooking', bookingData);
      return response.data;
    },
    onSuccess: () => {
      setShowBookingForm(false);
      setShowSuccessDialog(true);
      setFormData({
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        guest_national_id: '',
        guest_address: '',
        check_in_date: new Date().toISOString().split('T')[0]
      });
      setSelectedRoom(null);
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการจอง');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.guest_name || !formData.guest_phone) {
      toast.error('กรุณากรอกชื่อและเบอร์โทรศัพท์');
      return;
    }

    createBookingMutation.mutate({
      ...formData,
      room_id: selectedRoom.id,
      branch_id: branchId
    });
  };

  // Error/Loading states
  if (!branchId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">❌ ไม่พบข้อมูลสาขา</CardTitle>
            <CardDescription>กรุณาใช้ลิงก์ที่ถูกต้องจากทางสาขา</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (branchLoading || roomsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">❌ ไม่พบสาขานี้</CardTitle>
            <CardDescription>สาขาที่คุณกำลังมองหาอาจถูกลบหรือไม่มีในระบบ</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-white/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{branch.branch_name}</h1>
              <p className="text-sm text-slate-600 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {branch.address || 'หอพักคุณภาพ'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Date Picker */}
        <Card className="mb-6 bg-white/80 backdrop-blur-xl border-white/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Home className="w-5 h-5 text-blue-600" />
              ค้นหาห้องว่าง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">
                  📅 เลือกวันที่ต้องการเข้าพัก
                </label>
                <Input
                  type="date"
                  value={searchDate}
                  onChange={(e) => {
                    setSearchDate(e.target.value);
                    setFormData({ ...formData, check_in_date: e.target.value });
                  }}
                  min={new Date().toISOString().split('T')[0]}
                  className="text-base"
                />
              </div>
              <Button
                onClick={() => setSearchDate(new Date().toISOString().split('T')[0])}
                variant="outline"
                className="whitespace-nowrap"
              >
                วันนี้
              </Button>
            </div>
          </CardContent>
        </Card>

        {rooms.length === 0 ? (
          <Card className="text-center py-12">
            <CardHeader>
              <CardTitle className="text-slate-600">😔 ขออภัย ไม่มีห้องว่างในวันที่เลือก</CardTitle>
              <CardDescription>ลองเลือกวันอื่น หรือติดต่อสาขาโดยตรง</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-xl font-bold text-slate-900 mb-2">ห้องว่างสำหรับวันที่ {new Date(searchDate).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</h2>
              <p className="text-slate-600">พบ {rooms.length} ห้องพร้อมให้เข้าพัก</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {rooms.map((room) => (
                  <motion.div
                    key={room.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                  >
                    <Card className="overflow-hidden hover:shadow-2xl transition-all duration-300 group">
                      {/* Room Image */}
                      <div className="relative h-48 bg-gradient-to-br from-slate-200 to-slate-300 overflow-hidden">
                        {room.image_urls && room.image_urls.length > 0 ? (
                          <img 
                            src={room.image_urls[0]} 
                            alt={`ห้อง ${room.room_number}`}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
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
                          <Badge className="bg-green-500 text-white">ว่าง</Badge>
                        </div>
                        <div className="absolute top-3 left-3">
                          <Badge className="bg-blue-500 text-white">ชั้น {room.floor}</Badge>
                        </div>
                      </div>

                      <CardHeader>
                        <CardTitle className="text-xl">ห้อง {room.room_number}</CardTitle>
                        <CardDescription>
                          <div className="flex items-center gap-2 text-sm">
                            <Home className="w-4 h-4" />
                            <span>
                              {room.room_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}
                            </span>
                            {room.size && (
                              <>
                                <span>•</span>
                                <Maximize2 className="w-4 h-4" />
                                <span>{room.size} ตร.ม.</span>
                              </>
                            )}
                          </div>
                        </CardDescription>
                      </CardHeader>

                      <CardContent>
                        <div className="space-y-4">
                          {/* Price */}
                          <div className="text-center py-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                            <p className="text-3xl font-bold text-blue-600">
                              ฿{room.price?.toLocaleString() || 'N/A'}
                            </p>
                            <p className="text-xs text-slate-600 mt-1">
                              {room.room_type === 'monthly' ? 'ต่อเดือน' : 'ต่อวัน'}
                            </p>
                          </div>

                          {/* Amenities */}
                          {room.amenities && room.amenities.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {room.amenities.slice(0, 3).map((amenity, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {amenity}
                                </Badge>
                              ))}
                              {room.amenities.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{room.amenities.length - 3} อื่นๆ
                                </Badge>
                              )}
                            </div>
                          )}

                          {/* Description */}
                          {room.description && (
                            <p className="text-sm text-slate-600 line-clamp-2">
                              {room.description}
                            </p>
                          )}

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <Button 
                              onClick={() => {
                                setDetailRoom(room);
                                setCurrentImageIndex(0);
                                setShowRoomDetails(true);
                              }}
                              variant="outline"
                              className="flex-1"
                            >
                              ดูรายละเอียด
                            </Button>
                            <Button 
                              onClick={() => {
                                setSelectedRoom(room);
                                setFormData({ ...formData, check_in_date: searchDate });
                                setShowBookingForm(true);
                              }}
                              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                            >
                              จองห้องนี้
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
      <Dialog open={showBookingForm} onOpenChange={setShowBookingForm}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>จองห้อง {selectedRoom?.room_number}</DialogTitle>
            <DialogDescription>กรอกข้อมูลของคุณเพื่อจองห้องพัก</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
                วันที่เข้าพัก
              </label>
              <Input
                type="date"
                value={formData.check_in_date}
                onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
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
                disabled={createBookingMutation.isPending}
                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
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
        </DialogContent>
      </Dialog>

      {/* Room Details Dialog */}
      <Dialog open={showRoomDetails} onOpenChange={setShowRoomDetails}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailRoom && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">ห้อง {detailRoom.room_number}</DialogTitle>
                <DialogDescription>
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
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6">
                  <div className="text-center mb-4">
                    <p className="text-4xl font-bold text-blue-600">
                      ฿{detailRoom.price?.toLocaleString() || 'N/A'}
                    </p>
                    <p className="text-sm text-slate-600 mt-1">
                      {detailRoom.room_type === 'monthly' ? 'ต่อเดือน' : 'ต่อวัน'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/70 rounded-lg p-3">
                      <p className="text-slate-600">ชั้น</p>
                      <p className="font-bold text-slate-800">{detailRoom.floor}</p>
                    </div>
                    {detailRoom.size && (
                      <div className="bg-white/70 rounded-lg p-3">
                        <p className="text-slate-600">ขนาด</p>
                        <p className="font-bold text-slate-800">{detailRoom.size} ตร.ม.</p>
                      </div>
                    )}
                    <div className="bg-white/70 rounded-lg p-3">
                      <p className="text-slate-600">ค่าน้ำ</p>
                      <p className="font-bold text-slate-800">
                        {detailRoom.is_flat_rate_water 
                          ? `${detailRoom.flat_rate_water_amount} ฿/เดือน`
                          : `${detailRoom.water_rate} ฿/หน่วย`
                        }
                      </p>
                    </div>
                    <div className="bg-white/70 rounded-lg p-3">
                      <p className="text-slate-600">ค่าไฟ</p>
                      <p className="font-bold text-slate-800">
                        {detailRoom.is_flat_rate_electricity 
                          ? `${detailRoom.flat_rate_electricity_amount} ฿/เดือน`
                          : `${detailRoom.electricity_rate} ฿/หน่วย`
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {detailRoom.description && (
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-2">รายละเอียด</h3>
                    <p className="text-slate-600 leading-relaxed">{detailRoom.description}</p>
                  </div>
                )}

                {/* Amenities */}
                {detailRoom.amenities && detailRoom.amenities.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-3">สิ่งอำนวยความสะดวก</h3>
                    <div className="flex flex-wrap gap-2">
                      {detailRoom.amenities.map((amenity, idx) => (
                        <Badge key={idx} variant="outline" className="px-3 py-1">
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
                      setSelectedRoom(detailRoom);
                      setFormData({ ...formData, check_in_date: searchDate });
                      setShowRoomDetails(false);
                      setShowBookingForm(true);
                    }}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    จองห้องนี้
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="max-w-md text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-green-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl">จองสำเร็จ! 🎉</DialogTitle>
            <DialogDescription className="text-base mt-4">
              ทางสาขาได้รับการจองของคุณแล้ว<br/>
              และจะติดต่อกลับไปยังเบอร์โทรศัพท์ที่คุณให้ไว้<br/>
              ภายใน 24 ชั่วโมง
            </DialogDescription>
          </DialogHeader>
          <Button 
            onClick={() => {
              setShowSuccessDialog(false);
              window.location.reload();
            }}
            className="w-full mt-6 bg-gradient-to-r from-blue-600 to-purple-600"
          >
            ดูห้องอื่นๆ
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}