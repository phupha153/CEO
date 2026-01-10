import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Upload, Building2, CreditCard, AlertCircle, Loader2, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function ConfirmPaymentDialog({ 
  open, 
  onClose, 
  payment, 
  room,
  tenant,
  configs,
  selectedBranchId,
  onConfirmWithoutSlip,
  onConfirmWithSlip,
  confirming,
  verifying
}) {
  const [step, setStep] = useState('choose'); // 'choose' | 'upload'
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const getConfigValue = (key) => {
    const branchConfig = configs?.find(c => c.key === key && c.branch_id === selectedBranchId);
    if (branchConfig) return branchConfig.value;
    
    const globalConfig = configs?.find(c => c.key === key && !c.branch_id);
    return globalConfig?.value || null;
  };

  const bankAccountNumber = getConfigValue('bank_account_number');
  const bankAccountName = getConfigValue('bank_account_name');
  const bankName = getConfigValue('bank_name');
  const promptPay = getConfigValue('promptpay');

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!validTypes.includes(file.type)) {
      toast.error('กรุณาอัพโหลดไฟล์รูปภาพเท่านั้น (JPG, PNG)');
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('ไฟล์มีขนาดใหญ่เกินไป (จำกัดที่ 5MB)');
      return;
    }

    setSlipFile(file);

    // สร้าง preview
    const reader = new FileReader();
    reader.onload = (e) => setSlipPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const handleVerifySlip = async () => {
    if (!slipFile) {
      toast.error('กรุณาเลือกไฟล์สลิปก่อน');
      return;
    }

    setIsVerifying(true);
    try {
      // แปลงไฟล์เป็น Base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result;

        try {
          const response = await base44.functions.invoke('verifySlip', {
            paymentId: payment.id,
            fileBase64: base64,
            fileName: slipFile.name
          });

          if (response.data?.success) {
            toast.success(response.data.message || 'ตรวจสอบสลิปสำเร็จ');
            onConfirmWithSlip?.(response.data);
            handleReset();
          } else {
            toast.error(response.data?.error || response.data?.message || 'ตรวจสอบสลิปไม่สำเร็จ');
          }
        } catch (error) {
          console.error('Verify error:', error);
          toast.error('เกิดข้อผิดพลาด: ' + error.message);
        } finally {
          setIsVerifying(false);
        }
      };
      reader.readAsDataURL(slipFile);
    } catch (error) {
      console.error('Error:', error);
      toast.error('เกิดข้อผิดพลาด');
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setStep('choose');
    setSlipFile(null);
    setSlipPreview('');
    onClose?.();
  };

  if (!payment) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleReset()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            ยืนยันการชำระเงิน
          </DialogTitle>
        </DialogHeader>

        {/* ข้อมูลการชำระเงิน */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">ห้อง</span>
            <span className="font-bold text-slate-800">{room?.room_number || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">ผู้เช่า</span>
            <span className="font-medium text-slate-800">{tenant?.full_name || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm font-semibold text-slate-700">ยอดเงินรวม</span>
            <span className="text-xl font-bold text-blue-600">{payment.total_amount?.toLocaleString() || 0} ฿</span>
          </div>
        </div>

        {step === 'choose' && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">เลือกวิธีการยืนยัน:</p>

            {/* ตัวเลือก 1: ยืนยันเลย */}
            <Button
              onClick={() => {
                onConfirmWithoutSlip?.();
                handleReset();
              }}
              disabled={confirming}
              className="w-full h-auto py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 flex-col gap-2"
            >
              {confirming ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="text-sm">กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-6 h-6" />
                  <div>
                    <p className="font-bold">ยืนยันเลย</p>
                    <p className="text-xs opacity-90">ตรวจสอบด้วยตนเอง</p>
                  </div>
                </>
              )}
            </Button>

            {/* ตัวเลือก 2: อัปโหลดสลิป */}
            <Button
              onClick={() => setStep('upload')}
              variant="outline"
              className="w-full h-auto py-4 flex-col gap-2 border-blue-300 hover:bg-blue-50"
            >
              <Upload className="w-6 h-6 text-blue-600" />
              <div>
                <p className="font-bold text-blue-700">อัปโหลดสลิปเพื่อตรวจสอบ</p>
                <p className="text-xs text-blue-600">ตรวจสอบอัตโนมัติด้วย AI</p>
              </div>
            </Button>
          </div>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            {/* ข้อมูลบัญชีที่จะตรวจสอบ */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-100 p-2 rounded-lg">
                  <Shield className="w-5 h-5 text-blue-700" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-blue-900 mb-2">ระบบจะตรวจสอบบัญชีปลายทาง:</p>
                  {bankAccountNumber && (
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        <span className="text-blue-800">{bankName || 'ธนาคาร'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <span className="font-mono text-blue-900">{bankAccountNumber}</span>
                      </div>
                      <p className="text-blue-700">ชื่อบัญชี: {bankAccountName || 'N/A'}</p>
                    </div>
                  )}
                  {promptPay && (
                    <div className="mt-2 pt-2 border-t border-blue-200">
                      <p className="text-xs text-blue-700">หรือ PromptPay: {promptPay}</p>
                    </div>
                  )}
                  {!bankAccountNumber && !promptPay && (
                    <div className="flex items-start gap-2 text-amber-700 text-sm">
                      <AlertCircle className="w-4 h-4 mt-0.5" />
                      <p>ยังไม่ได้ตั้งค่าบัญชีธนาคาร - จะตรวจสอบเฉพาะยอดเงิน</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* อัปโหลดสลิป */}
            <div>
              <Label>เลือกรูปสลิปโอนเงิน</Label>
              <Input
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleFileSelect}
                className="mt-2"
              />
              {slipPreview && (
                <div className="mt-3">
                  <img
                    src={slipPreview}
                    alt="Preview"
                    className="w-full max-h-64 object-contain rounded-lg border"
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('choose');
                  setSlipFile(null);
                  setSlipPreview('');
                }}
                disabled={isVerifying}
              >
                ย้อนกลับ
              </Button>
              <Button
                onClick={handleVerifySlip}
                disabled={!slipFile || isVerifying}
                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    กำลังตรวจสอบสลิป...
                  </>
                ) : (
                  <>
                    <Shield className="w-4 h-4 mr-2" />
                    ตรวจสอบสลิป
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