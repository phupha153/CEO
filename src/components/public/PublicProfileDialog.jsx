import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Loader2, Calendar, CreditCard, ExternalLink, ScrollText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function PublicProfileDialog({ open, onOpenChange, lineProfile }) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['publicUserHistory', lineProfile?.userId],
    queryFn: async () => {
      if (!lineProfile?.userId) return null;
      const res = await base44.functions.invoke('getPublicUserHistory', {
        line_user_id: lineProfile.userId
      });
      return res.data;
    },
    enabled: !!lineProfile?.userId && open
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md mx-4 sm:mx-0 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-4">
            <img 
              src={lineProfile?.pictureUrl || 'https://via.placeholder.com/150'} 
              alt="Profile" 
              className="w-16 h-16 rounded-full border-4 border-white shadow-md object-cover"
            />
            <div className="text-left">
              <DialogTitle className="text-xl">{lineProfile?.displayName}</DialogTitle>
              <p className="text-sm text-slate-500">บัญชีผู้ใช้ LINE</p>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4">
          <Tabs defaultValue="bookings" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="bookings">ประวัติการจอง</TabsTrigger>
              <TabsTrigger value="payments">ประวัติชำระเงิน</TabsTrigger>
            </TabsList>
            
            <div className="mt-4 min-h-[300px]">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500" />
                  กำลังโหลดข้อมูล...
                </div>
              ) : (
                <>
                  <TabsContent value="bookings" className="space-y-3 m-0">
                    {!history?.bookings?.length && !history?.tempBookings?.length ? (
                      <div className="text-center py-10 text-slate-500">
                        <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>ไม่มีประวัติการจอง</p>
                      </div>
                    ) : (
                      <>
                        {history?.tempBookings?.map((booking, idx) => (
                          <Card key={`temp-${idx}`} className="bg-orange-50/50 border-orange-200">
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <Badge className="bg-orange-500 mb-1">รอยืนยัน / กำลังพิจารณา</Badge>
                                  <p className="font-bold text-slate-800">
                                    ห้อง {booking.room?.room_number || '-'} 
                                    <span className="text-xs font-normal text-slate-500 ml-2">
                                      ({booking.booking_type === 'monthly' ? 'รายเดือน' : 'รายวัน'})
                                    </span>
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">เลขที่จอง</p>
                                  <p className="text-xs font-mono font-semibold">{booking.booking_no}</p>
                                </div>
                              </div>
                              <div className="text-sm text-slate-600 space-y-1">
                                <p>📅 เช็คอิน: {new Date(booking.check_in_date).toLocaleDateString('th-TH')}</p>
                                {booking.check_out_date && <p>📅 เช็คเอาท์: {new Date(booking.check_out_date).toLocaleDateString('th-TH')}</p>}
                                <p>👥 ผู้เข้าพัก: {booking.number_of_guests} คน</p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                        {history?.bookings?.map((booking, idx) => (
                          <Card key={`book-${idx}`}>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <Badge className={booking.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}>
                                    {booking.status === 'active' ? 'กำลังเช่า/จองแล้ว' : booking.status === 'completed' ? 'เสร็จสิ้น' : 'ยกเลิก'}
                                  </Badge>
                                  <p className="font-bold text-slate-800 mt-1">
                                    ห้อง {booking.room?.room_number || '-'}
                                    <span className="text-xs font-normal text-slate-500 ml-2">
                                      ({booking.booking_type === 'monthly' ? 'รายเดือน' : 'รายวัน'})
                                    </span>
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-slate-500">เลขที่อ้างอิง</p>
                                  <p className="text-xs font-mono font-semibold">{booking.booking_no || '-'}</p>
                                </div>
                              </div>
                              <div className="text-sm text-slate-600 space-y-1">
                                <p>📅 เข้าพัก: {new Date(booking.check_in_date).toLocaleDateString('th-TH')}</p>
                                {booking.check_out_date && <p>📅 สิ้นสุด: {new Date(booking.check_out_date).toLocaleDateString('th-TH')}</p>}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="payments" className="space-y-3 m-0">
                    {!history?.payments?.length ? (
                      <div className="text-center py-10 text-slate-500">
                        <CreditCard className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>ไม่มีประวัติการชำระเงิน</p>
                      </div>
                    ) : (
                      history.payments.sort((a,b) => new Date(b.created_date) - new Date(a.created_date)).map((payment, idx) => (
                        <Card key={`pay-${idx}`}>
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <Badge className={
                                  payment.status === 'paid' ? 'bg-green-500' : 
                                  payment.status === 'pending' ? 'bg-orange-500' : 'bg-red-500'
                                }>
                                  {payment.status === 'paid' ? 'ชำระแล้ว' : 
                                   payment.status === 'pending' ? 'รอชำระ' : 'ค้างชำระ'}
                                </Badge>
                                <p className="font-bold text-slate-800 mt-1">฿{payment.total_amount?.toLocaleString()}</p>
                              </div>
                              <div className="text-right text-xs">
                                <p className="text-slate-500">กำหนดชำระ</p>
                                <p className="font-semibold text-red-600">{new Date(payment.due_date).toLocaleDateString('th-TH')}</p>
                              </div>
                            </div>
                            <div className="text-sm text-slate-600">
                              <p>
                                {payment.payment_category === 'monthly_rent' ? 'ค่าเช่ารายเดือน' : 
                                 payment.payment_category === 'booking_deposit' ? 'เงินมัดจำการจอง' : 'ค่าใช้จ่าย'}
                              </p>
                              {payment.invoice_image_url && (
                                <a 
                                  href={payment.invoice_image_url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-blue-600 hover:underline flex items-center gap-1 mt-2 text-xs"
                                >
                                  <ScrollText className="w-3 h-3" /> ดูใบแจ้งหนี้
                                </a>
                              )}
                              {payment.receipt_image_url && (
                                <a 
                                  href={payment.receipt_image_url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                  className="text-green-600 hover:underline flex items-center gap-1 mt-2 text-xs"
                                >
                                  <ExternalLink className="w-3 h-3" /> ดูใบเสร็จรับเงิน
                                </a>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </TabsContent>
                </>
              )}
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}