import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Loader2, Check } from "lucide-react";
import { motion } from "framer-motion";

export default function PaymentsReviewBanner({
  viewMode, roomViewPayments, payments, paymentsLoading, roomViewFetching,
  rooms, tenants, setSlipPreview, setConfirmPaymentDialog, updateStatusMutation,
  setSelectedPayment, setShowDetailDialog
}) {
  const paymentsForReview = viewMode === 'room' ? roomViewPayments : payments;
  const needReviewPayments = paymentsForReview.filter(p => p.status !== 'paid' && p.notes?.includes('⚠️ รอตรวจสอบ') && !p.notes?.includes('✅ ยืนยันชำระแล้ว'));
  const isLoadingReview = viewMode === 'room' ? roomViewFetching : paymentsLoading;
  
  if (needReviewPayments.length === 0 || isLoadingReview) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300 shadow-lg">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="bg-amber-100 p-2 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-amber-900 mb-2">
                🔍 รอตรวจสอบสลิป ({needReviewPayments.length} รายการ)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {needReviewPayments.map(p => {
                  const room = rooms.find(r => r.id === p.room_id);
                  const tenant = tenants.find(t => t.id === p.tenant_id);
                  const notesParts = p.notes?.split('⚠️ รอตรวจสอบ:')[1]?.trim() || '';
                  const roomMatch = notesParts.match(/ห้อง\s+(\S+)/);
                  const roomNumber = roomMatch ? roomMatch[1] : (room?.room_number || 'N/A');
                  const reason = notesParts.replace(/^ห้อง\s+\S+\s*-?\s*/, '').split('\n')[0]?.trim() || 'ตรวจสอบไม่ผ่าน';
                  
                  return (
                    <div
                      key={p.id}
                      className="p-3 bg-white rounded-lg border border-amber-200 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-bold text-amber-900 text-sm">
                          ห้อง {roomNumber}
                        </span>
                        <Badge className="bg-amber-200 text-amber-800 text-xs">
                          {(p.total_amount || 0).toLocaleString()}฿
                        </Badge>
                      </div>
                      <p className="text-xs text-amber-800 mb-0.5">{tenant?.full_name || 'N/A'}</p>
                      <p className="text-xs text-amber-700 mb-2">{reason}</p>
                      {p.payment_slip_url && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSlipPreview({ open: true, url: p.payment_slip_url, title: `สลิป ห้อง ${roomNumber}` });
                          }}
                          className="w-full cursor-pointer"
                        >
                          <img src={p.payment_slip_url} alt="สลิป" className="w-full max-h-24 object-contain rounded border border-amber-200 bg-slate-50 mb-2 hover:opacity-80 transition-opacity" />
                        </button>
                      )}
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                         type="button"
                         className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                         onClick={(e) => {
                           e.stopPropagation();
                           e.preventDefault();
                           setConfirmPaymentDialog({ open: true, payment: p });
                         }}
                         disabled={updateStatusMutation.isPending}
                        >
                         {updateStatusMutation.isPending ? (
                           <Loader2 className="w-3 h-3 animate-spin" />
                         ) : (
                           <Check className="w-3 h-3" />
                         )}
                         <span>ยืนยันชำระ</span>
                        </button>
                        <button
                          type="button"
                          className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-md text-xs font-medium transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            setSelectedPayment(p);
                            setShowDetailDialog(true);
                          }}
                        >
                          ดูรายละเอียด
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}