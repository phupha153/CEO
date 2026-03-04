import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, CheckCircle2, AlertTriangle } from "lucide-react";

export default function LineConnectButton({ tenant, variant = "outline", size = "sm" }) {
  const [showDialog, setShowDialog] = useState(false);

  if (!tenant?.id) return null;

  // เช็คว่าเชื่อมต่อแล้วหรือยัง
  const isConnected = !!tenant.line_user_id;

  // ถ้าเชื่อมต่อแล้ว
  if (isConnected) {
    return (
      <Button
        variant="ghost"
        size={size}
        className="text-green-600 hover:text-green-700 hover:bg-green-50 cursor-default"
        disabled
      >
        <CheckCircle2 className="w-4 h-4 mr-1" />
        LINE เชื่อมต่อแล้ว
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowDialog(true)}
        className="text-green-600 hover:text-green-700 hover:bg-green-50"
      >
        <MessageSquare className="w-4 h-4 mr-1" />
        วิธีเชื่อมต่อ
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-green-600" />
              วิธีเชื่อมต่อ LINE - {tenant.full_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-800 font-semibold mb-3">💬 ขั้นตอนการเชื่อมต่อ LINE</p>
              <ol className="text-sm text-green-700 space-y-2">
                <li>1. ให้ผู้เช่าแอด LINE Official ของหอพัก</li>
                <li>2. ผู้เช่าพิมพ์ <b>เบอร์โทรศัพท์ (10 หลัก)</b> ส่งมาในแชท LINE</li>
                <li>3. ระบบจะตรวจสอบและเชื่อมต่อกับห้องพักให้อัตโนมัติ</li>
              </ol>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                ข้อควรระวัง
              </p>
              <p className="text-sm text-amber-700">
                เบอร์โทรศัพท์ที่ผู้เช่าพิมพ์มา <b>จะต้องตรงกับ</b> เบอร์ที่บันทึกไว้ในระบบเท่านั้น จึงจะสามารถเชื่อมต่อได้สำเร็จ
              </p>
              <div className="mt-2 p-3 bg-white rounded-lg border border-amber-200 text-center">
                <p className="text-xs text-slate-500 mb-1">เบอร์โทรของผู้เช่าในระบบตอนนี้</p>
                <p className="text-lg font-bold text-slate-800">
                  {tenant.phone || "⚠️ ยังไม่ได้ระบุเบอร์โทร"}
                </p>
              </div>
            </div>
          </div>

          <p className="text-sm text-center text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200 mt-2">
            ✅ เมื่อเชื่อมต่อสำเร็จ ระบบจะส่งบิลและการแจ้งเตือนต่างๆ ให้ทาง LINE ทันที
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}