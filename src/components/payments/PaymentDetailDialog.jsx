import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { Calculator, CheckCircle2, Edit2, Loader2 } from "lucide-react";

export default function PaymentDetailDialog({
  showDetailDialog, setShowDetailDialog, selectedPayment,
  getRoomInfo, getTenantInfo, getEffectiveStatus, calculateLateFee,
  setSlipPreview, canConfirmPaid, setConfirmPaymentDialog, updateStatusMutation,
  canEdit, handleEdit, getStatusBadge
}) {
  if (!selectedPayment) return null;

  const room = selectedPayment.room_number ? 
    { room_number: selectedPayment.room_number } : 
    getRoomInfo(selectedPayment.room_id);
  const tenant = selectedPayment.tenant_name ? 
    { full_name: selectedPayment.tenant_name,
      line_user_id: selectedPayment.tenant_line_user_id,
      facebook_user_id: selectedPayment.tenant_facebook_user_id
    } : 
    getTenantInfo(selectedPayment.tenant_id);
  const effectiveStatus = getEffectiveStatus(selectedPayment);
  const lateFee = (selectedPayment.late_fee_amount && selectedPayment.late_fee_amount > 0) ? 0 : calculateLateFee(selectedPayment);
  const totalWithLateFee = (selectedPayment.total_amount || 0) + lateFee;

  return (
    <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>รายละเอียดการชำระเงิน</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 mb-1">ห้อง</p>
                <p className="font-bold text-slate-800">{room?.room_number || 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">ผู้เช่า</p>
                <p className="font-bold text-slate-800">{tenant?.full_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">วันครบกำหนด</p>
                <p className="font-bold text-slate-800">
                  {selectedPayment.due_date ? format(parseISO(selectedPayment.due_date), 'd MMM yyyy', { locale: th }) : 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-slate-500 mb-1">สถานะ</p>
                {getStatusBadge(effectiveStatus, selectedPayment)}
              </div>
            </div>
          </div>

          {effectiveStatus === 'partial_paid' && (
            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="p-4">
                <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                  <Calculator className="w-5 h-5" />
                  สถานะการชำระเงิน
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">ยอดที่ต้องชำระทั้งหมด:</span>
                    <span className="font-bold text-slate-800">{totalWithLateFee.toLocaleString()} ฿</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-600">ชำระไปแล้ว:</span>
                    <span className="font-bold text-green-700">
                      {(selectedPayment.paid_amount || 0).toLocaleString()} ฿
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-red-700 font-semibold">ยังค้างชำระอีก:</span>
                    <span className="font-bold text-xl text-red-700">
                      {(totalWithLateFee - (selectedPayment.paid_amount || 0)).toLocaleString()} ฿
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            <h3 className="font-semibold text-slate-800">รายการค่าใช้จ่าย</h3>
            {selectedPayment.security_deposit_amount > 0 && (<div className="flex justify-between text-sm"><span className="text-slate-600">เงินประกันห้อง:</span><span className="font-medium">{selectedPayment.security_deposit_amount.toLocaleString()} ฿</span></div>)}
            {selectedPayment.advance_rent_amount > 0 && (<div className="flex justify-between text-sm"><span className="text-slate-600">ค่าเช่าล่วงหน้า:</span><span className="font-medium">{selectedPayment.advance_rent_amount.toLocaleString()} ฿</span></div>)}
            {selectedPayment.rent_amount > 0 && (<div className="flex justify-between text-sm"><span className="text-slate-600">ค่าเช่า:</span><span className="font-medium">{selectedPayment.rent_amount.toLocaleString()} ฿</span></div>)}
            {selectedPayment.electricity_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">ค่าไฟ ({selectedPayment.electricity_units} หน่วย @ {selectedPayment.electricity_rate} ฿):</span>
                <span className="font-medium">{selectedPayment.electricity_amount.toLocaleString()} ฿</span>
              </div>
            )}
            {selectedPayment.water_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">ค่าน้ำ ({selectedPayment.water_units} หน่วย @ {selectedPayment.water_rate} ฿):</span>
                <span className="font-medium">{selectedPayment.water_amount.toLocaleString()} ฿</span>
              </div>
            )}
            {selectedPayment.internet_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">ค่าอินเทอร์เน็ต:</span>
                <span className="font-medium">{selectedPayment.internet_amount.toLocaleString()} ฿</span>
              </div>
            )}
            {selectedPayment.common_fee_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">ค่าส่วนกลาง:</span>
                <span className="font-medium">{selectedPayment.common_fee_amount.toLocaleString()} ฿</span>
              </div>
            )}
            {selectedPayment.parking_fee_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">ค่าจอดรถ:</span>
                <span className="font-medium">{selectedPayment.parking_fee_amount.toLocaleString()} ฿</span>
              </div>
            )}
            {selectedPayment.other_amount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">ค่าใช้จ่ายอื่นๆ:</span>
                <span className="font-medium">{selectedPayment.other_amount.toLocaleString()} ฿</span>
              </div>
            )}
            {(() => {
              const displayLateFee = selectedPayment.late_fee_amount > 0 ? selectedPayment.late_fee_amount : lateFee;
              if (displayLateFee > 0) {
                return (
                  <div className="flex justify-between text-sm text-red-600 font-semibold">
                    <span>ค่าปรับล่าช้า:</span>
                    <span>+{displayLateFee.toLocaleString()} ฿</span>
                  </div>
                );
              }
              return null;
            })()}
            <div className="flex justify-between pt-3 border-t">
              <span className="font-bold text-lg">รวมทั้งสิ้น:</span>
              <span className="font-bold text-2xl text-blue-600">{totalWithLateFee.toLocaleString()} ฿</span>
            </div>
          </div>

          {selectedPayment.payment_slip_url && (
            <div>
              <h3 className="font-semibold text-slate-800 mb-2">หลักฐานการโอน</h3>
              <button
                onClick={() => setSlipPreview({ open: true, url: selectedPayment.payment_slip_url, title: `สลิป ห้อง ${room?.room_number || 'N/A'}` })}
                className="w-full"
              >
                <img 
                  src={selectedPayment.payment_slip_url} 
                  alt="สลิป" 
                  className="w-full max-h-64 object-contain rounded-lg border hover:opacity-80 transition-opacity"
                />
              </button>
            </div>
          )}

          {selectedPayment.notes && (
            <div>
              <h3 className="font-semibold text-slate-800 mb-2">หมายเหตุ</h3>
              <p className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3">{selectedPayment.notes}</p>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t">
            {effectiveStatus !== 'paid' && canConfirmPaid && (
              <Button
                type="button"
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setConfirmPaymentDialog({ open: true, payment: selectedPayment });
                  setShowDetailDialog(false);
                }}
                disabled={updateStatusMutation.isPending}
              >
                {updateStatusMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                )}
                ยืนยันชำระ
              </Button>
            )}
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEdit(selectedPayment);
                  setShowDetailDialog(false);
                }}
              >
                <Edit2 className="w-4 h-4 mr-2" />
                แก้ไข
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowDetailDialog(false);
              }}
            >
              ปิด
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}