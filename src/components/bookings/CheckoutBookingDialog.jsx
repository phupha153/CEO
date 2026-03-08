import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function CheckoutBookingDialog({
  isOpen,
  setIsOpen,
  pendingCheckoutBooking,
  setPendingCheckoutBooking,
  checkoutBookingMutation,
  rooms
}) {
  return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
              ยืนยันการเช็คเอาท์
            </DialogTitle>
          </DialogHeader>
          
          {pendingCheckoutBooking && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="text-sm text-blue-600 mb-2">คุณต้องการเช็คเอาท์</p>
                <p className="font-bold text-lg text-slate-800">
                  ห้อง {rooms.find(r => r.id === pendingCheckoutBooking.room_id)?.room_number}
                </p>
                <p className="text-sm text-slate-600">{pendingCheckoutBooking.guest_name}</p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsOpen(false);
                    setPendingCheckoutBooking(null);
                  }}
                  disabled={checkoutBookingMutation.isPending}
                >
                  ยกเลิก
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => checkoutBookingMutation.mutate(pendingCheckoutBooking)}
                  disabled={checkoutBookingMutation.isPending}
                >
                  {checkoutBookingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      ยืนยันเช็คเอาท์
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
  );
}