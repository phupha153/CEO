import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { User, Calendar } from "lucide-react";

export default function BookingActionDialog({ open, onOpenChange, room, onBooking, onAddTenant }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>เลือกการดำเนินการ ห้อง {room?.room_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-6">
          <p className="text-center text-slate-600 text-sm">
            คุณต้องการทำอะไรกับห้องนี้?
          </p>
          
          <div className="space-y-3">
            <Button
              onClick={() => {
                onBooking();
                onOpenChange(false);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 h-12 text-base"
            >
              <Calendar className="w-4 h-4 mr-2" />
              จองห้อง (ระบุวันเข้า-ออก)
            </Button>

            <Button
              onClick={() => {
                onAddTenant();
                onOpenChange(false);
              }}
              variant="outline"
              className="w-full border-blue-600 text-blue-600 hover:bg-blue-50 h-12 text-base"
            >
              <User className="w-4 h-4 mr-2" />
              เพิ่มผู้เช่า (เลือกจากระบบ)
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
            ยกเลิก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}