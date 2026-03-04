import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Shield, Send, CheckCircle } from "lucide-react";

export default function OtpDialog({
  open,
  onOpenChange,
  lesseePhone,
  otpSent,
  sendingOtp,
  handleSendOtp,
  otpExpiresIn,
  otp,
  setOtp,
  setOtpError,
  otpError,
  handleVerifyOtp,
  verifyingOtp,
  activeContractId
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-600" />
            ยืนยันตัวตนก่อนลงนาม
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 leading-relaxed">
              📱 เพื่อความปลอดภัย กรุณายืนยันตัวตนด้วยรหัส OTP ที่ส่งไปยังเบอร์โทรศัพท์
            </p>
            <p className="text-xs text-blue-600 mt-2">
              เบอร์: <strong>{lesseePhone || 'ไม่ระบุ'}</strong>
            </p>
          </div>

          {!otpSent && (
            <Button
              onClick={handleSendOtp}
              disabled={sendingOtp || !lesseePhone || !activeContractId}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {sendingOtp ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  กำลังส่ง OTP...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  ส่งรหัส OTP
                </>
              )}
            </Button>
          )}

          {otpSent && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-green-800">
                    ✅ ส่งรหัส OTP แล้ว
                  </p>
                  <Badge className="bg-green-600 text-white">
                    {Math.floor(otpExpiresIn / 60)}:{String(otpExpiresIn % 60).padStart(2, '0')}
                  </Badge>
                </div>
              </div>

              <div>
                <Label>กรอกรหัส OTP 6 หลัก</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setOtp(value);
                    setOtpError('');
                  }}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest font-bold"
                  autoFocus
                />
              </div>

              {otpError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">
                    ❌ {otpError}
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleSendOtp}
                  disabled={sendingOtp || otpExpiresIn > 295 || !activeContractId}
                  variant="outline"
                  className="flex-1"
                >
                  ส่งรหัสใหม่
                </Button>
                <Button
                  onClick={handleVerifyOtp}
                  disabled={verifyingOtp || otp.length !== 6 || !activeContractId}
                  className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                >
                  {verifyingOtp ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      กำลังตรวจสอบ...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      ยืนยัน
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-xs text-amber-800">
              💡 <strong>หมายเหตุ:</strong> รหัส OTP จะหมดอายุใน 5 นาที กรุณากรอกภายในเวลาที่กำหนด
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}