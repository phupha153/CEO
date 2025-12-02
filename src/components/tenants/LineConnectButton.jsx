import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Copy, QrCode, Check, Link as LinkIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function LineConnectButton({ tenant, variant = "outline", size = "sm" }) {
  const [showDialog, setShowDialog] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!tenant?.id) return null;

  // สร้างลิงก์เชื่อมต่อ LINE สำหรับผู้เช่าคนนี้
  const connectUrl = `${window.location.origin}/LineConnect?t=${tenant.id}`;
  
  // เช็คว่าเชื่อมต่อแล้วหรือยัง
  const isConnected = !!tenant.line_user_id;

  const handleCopy = () => {
    navigator.clipboard.writeText(connectUrl);
    setCopied(true);
    toast.success('คัดลอกลิงก์แล้ว');
    setTimeout(() => setCopied(false), 2000);
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
              วิธีเชื่อมต่อ LINE สำหรับ {tenant.full_name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800 font-semibold mb-3">💡 วิธีเชื่อมต่อ LINE</p>
              <ol className="text-sm text-blue-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-900">1.</span>
                  <span>คัดลอกลิงก์ด้านล่าง</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-900">2.</span>
                  <span>ส่งให้ผู้เช่าทาง SMS หรือ LINE</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-900">3.</span>
                  <span>ผู้เช่ากดลิงก์และกด "อนุญาต" บน LINE</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-900">4.</span>
                  <span>เชื่อมต่อเสร็จสิ้น! ✨</span>
                </li>
              </ol>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">ลิงก์เชื่อมต่อ</span>
              </div>
              <div className="bg-white border border-slate-200 rounded-lg p-3 break-all text-sm text-slate-600">
                {connectUrl}
              </div>
              <Button
                onClick={handleCopy}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    คัดลอกแล้ว!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-2" />
                    คัดลอกลิงก์
                  </>
                )}
              </Button>
            </div>

            <p className="text-sm text-slate-600 bg-green-50 p-3 rounded-lg border border-green-200">
              ✅ เมื่อเชื่อมต่อแล้ว ผู้เช่าจะได้รับใบแจ้งหนี้และการแจ้งเตือนต่างๆ ผ่าน LINE โดยอัตโนมัติ
            </p>

            <p className="text-xs text-center text-slate-400">
              ลิงก์นี้ใช้ได้เฉพาะผู้เช่า {tenant.full_name} เท่านั้น
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}