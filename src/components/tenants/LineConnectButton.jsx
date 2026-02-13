import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageSquare, CheckCircle2, Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function LineConnectButton({ tenant, variant = "outline", size = "sm" }) {
  const [showDialog, setShowDialog] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verifying, setVerifying] = useState(false);

  if (!tenant?.id) return null;

  // เช็คว่าเชื่อมต่อแล้วหรือยัง
  const isConnected = !!tenant.line_user_id;

  const handlePhoneVerify = async () => {
    if (!phoneNumber || phoneNumber.trim() === "") {
      toast.error("กรุณากรอกเบอร์โทรศัพท์");
      return;
    }

    // ตรวจสอบว่าเบอร์ตรงกับข้อมูลผู้เช่าหรือไม่
    const cleanPhone = phoneNumber.replace(/\s|-/g, "");
    const tenantPhone = (tenant.phone || "").replace(/\s|-/g, "");

    if (cleanPhone !== tenantPhone) {
      toast.error("เบอร์โทรศัพท์ไม่ตรงกับข้อมูลผู้เช่า");
      return;
    }

    setVerifying(true);
    try {
      // ส่ง OTP หรือสร้างลิงก์เชื่อมต่อหลังยืนยันเบอร์
      const connectUrl = `${window.location.origin}/LineConnect?t=${tenant.id}`;
      navigator.clipboard.writeText(connectUrl);
      toast.success("เบอร์ถูกต้อง! คัดลอกลิงก์เชื่อมต่อแล้ว - ส่งให้ผู้เช่าทาง LINE");
      setShowDialog(false);
      setPhoneNumber("");
    } catch (error) {
      toast.error("เกิดข้อผิดพลาด");
    } finally {
      setVerifying(false);
    }
  };

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
              เชื่อมต่อ LINE - {tenant.full_name}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="phone" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="phone" className="gap-2">
                <Phone className="w-4 h-4" />
                ยืนยันเบอร์โทร
              </TabsTrigger>
              <TabsTrigger value="chat" className="gap-2">
                <MessageCircle className="w-4 h-4" />
                ทัก LINE มา
              </TabsTrigger>
            </TabsList>

            <TabsContent value="phone" className="space-y-4 mt-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm text-blue-800 font-semibold mb-2">📱 วิธีที่ 1: ยืนยันด้วยเบอร์โทร</p>
                <ol className="text-sm text-blue-700 space-y-1.5">
                  <li>1. พิมพ์เบอร์โทรศัพท์ของผู้เช่า</li>
                  <li>2. กดยืนยัน - ระบบจะตรวจสอบข้อมูล</li>
                  <li>3. ส่งลิงก์เชื่อมต่อให้ผู้เช่า</li>
                  <li>4. ผู้เช่ากดลิงก์และอนุญาต LINE</li>
                </ol>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-700">
                  เบอร์โทรศัพท์ผู้เช่า
                </label>
                <Input
                  type="tel"
                  placeholder="0812345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="text-lg"
                />
                <p className="text-xs text-slate-500">
                  เบอร์โทรที่บันทึกไว้: {tenant.phone || "ไม่มีข้อมูล"}
                </p>
              </div>

              <Button
                onClick={handlePhoneVerify}
                disabled={verifying || !phoneNumber}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {verifying ? "กำลังตรวจสอบ..." : "ยืนยันและรับลิงก์"}
              </Button>
            </TabsContent>

            <TabsContent value="chat" className="space-y-4 mt-4">
              <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-800 font-semibold mb-2">💬 วิธีที่ 2: ทัก LINE มาก่อน</p>
                <ol className="text-sm text-green-700 space-y-1.5">
                  <li>1. ให้ผู้เช่าทัก LINE Official Account มาก่อน</li>
                  <li>2. เข้าหน้าแชท LINE ในระบบหอพัก</li>
                  <li>3. เลือกผู้เช่าจากรายการแชท</li>
                  <li>4. กดปุ่ม "เชื่อมต่อกับห้อง" และเลือกห้อง</li>
                </ol>
              </div>

              <div className="bg-gradient-to-br from-green-100 to-emerald-100 border border-green-300 rounded-xl p-4 text-center">
                <MessageCircle className="w-12 h-12 text-green-600 mx-auto mb-3" />
                <p className="text-sm font-semibold text-green-800 mb-2">
                  ให้ผู้เช่าทัก LINE Official มาก่อน
                </p>
                <p className="text-xs text-green-700">
                  จากนั้นไปที่เมนู "แชท LINE" ในระบบ<br/>
                  เพื่อเชื่อมต่อผู้เช่ากับห้องพัก
                </p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800">
                  💡 <strong>เคล็ดลับ:</strong> วิธีนี้เหมาะกับผู้เช่าที่ทัก LINE มาสอบถามก่อน - ไม่ต้องส่งลิงก์
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <p className="text-sm text-slate-600 bg-green-50 p-3 rounded-lg border border-green-200 mt-4">
            ✅ เมื่อเชื่อมต่อแล้ว ผู้เช่าจะได้รับใบแจ้งหนี้และการแจ้งเตือนต่างๆ ผ่าน LINE อัตโนมัติ
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}