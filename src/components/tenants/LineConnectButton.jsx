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
              <p className="text-sm text-green-800 font-semibold mb-3">💬 2 วิธีในการเชื่อมต่อ LINE</p>
              <div className="text-sm text-green-700 space-y-3">
                <div>
                  <p className="font-semibold">วิธีที่ 1: ให้ผู้เช่าเชื่อมต่อเองอัตโนมัติ</p>
                  <ul className="list-disc ml-5 space-y-1 mt-1">
                    <li>ให้ผู้เช่าแอด LINE Official ของหอพัก</li>
                    <li>พิมพ์ <b>เบอร์โทรศัพท์ (10 หลัก)</b> ส่งมาในแชท</li>
                    <li>ระบบจะตรวจสอบและเชื่อมต่อให้อัตโนมัติ</li>
                  </ul>
                </div>
                <div className="pt-2 border-t border-green-200/60">
                  <p className="font-semibold">วิธีที่ 2: แอดมินกดเชื่อมต่อให้</p>
                  <ul className="list-disc ml-5 space-y-1 mt-1">
                    <li>ให้ผู้เช่าทักแชท LINE Official มาหา</li>
                    <li>แอดมินเข้าไปที่หน้า "ข้อความ" (แชท)</li>
                    <li>กดปุ่มเชื่อมต่อผู้เช่ากับห้องพักได้ทันที</li>
                  </ul>
                </div>
              </div>
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