import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";

export default function CancelBookingDialog({
  isOpen,
  setIsOpen,
  pendingCancelBooking,
  setPendingCancelBooking,
  cancelBookingMutation,
  rooms
}) {
  return (
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <X className="w-5 h-5 text-red-600" />
              ยกเลิกการจอง
            </DialogTitle>
          </DialogHeader>
          
          {pendingCancelBooking && (
            <div className="space-y-4">
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-sm text-red-600 mb-2">คุณต้องการยกเลิกการจอง</p>
                <p className="font-bold text-lg text-slate-800">
                  ห้อง {rooms.find(r => r.id === pendingCancelBooking.room_id)?.room_number}
                </p>
                <p className="text-sm text-slate-600">{pendingCancelBooking.guest_name}</p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsOpen(false);
                    setPendingCancelBooking(null);
                  }}
                  disabled={cancelBookingMutation.isPending}
                >
                  ไม่ยกเลิก
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => cancelBookingMutation.mutate(pendingCancelBooking)}
                  disabled={cancelBookingMutation.isPending}
                >
                  {cancelBookingMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      กำลังยกเลิก...
                    </>
                  ) : (
                    <>
                      <X className="w-4 h-4 mr-2" />
                      ยืนยันยกเลิก
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