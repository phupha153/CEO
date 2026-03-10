import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreditCard, Save, Loader2, Upload, X, Image as ImageIcon } from "lucide-react";
import { BranchToggle } from "./BranchToggle";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function BankTab({
  bankInfo,
  setBankInfo,
  applyToAllBranches,
  setApplyToAllBranches,
  selectedBranch,
  canSetGlobalConfig,
  handleBankInfoSubmit,
  translatingName,
  isSavingBankInfo
}) {
  const [uploadingQrCode, setUploadingQrCode] = React.useState(false);

  const handleQrCodeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 5MB');
      e.target.value = '';
      return;
    }

    setUploadingQrCode(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setBankInfo({ ...bankInfo, payment_qr_code_url: file_url });
      toast.success('อัปโหลดรูป QR Code สำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดไม่สำเร็จ: ' + error.message);
    }
    setUploadingQrCode(false);
    e.target.value = '';
  };
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-purple-600" />
          บัญชีธนาคาร
        </CardTitle>
      </CardHeader>
      <CardContent>
        <BranchToggle
          applyToAllBranches={applyToAllBranches}
          setApplyToAllBranches={setApplyToAllBranches}
          selectedBranch={selectedBranch}
          canSetGlobalConfig={canSetGlobalConfig}
        />

        <form onSubmit={handleBankInfoSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>ชื่อบัญชี (ภาษาไทย)</Label>
              <Input
                value={bankInfo.account_name}
                onChange={(e) => setBankInfo({ ...bankInfo, account_name: e.target.value })}
                placeholder="ไพทูลย์ มีของ"
              />
            </div>
            <div>
              <Label>ชื่อบัญชี (ภาษาอังกฤษ)</Label>
              <div className="relative">
                <Input
                  value={bankInfo.account_name_en}
                  onChange={(e) => setBankInfo({ ...bankInfo, account_name_en: e.target.value })}
                  placeholder="PHAITOON M"
                  disabled={translatingName}
                />
                {translatingName && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {translatingName ? '🤖 AI กำลังแปลอัตโนมัติ...' : 'แปลจากชื่อไทยอัตโนมัติ หรือแก้ไขเองได้'}
              </p>
            </div>
            <div>
              <Label>ธนาคาร</Label>
              <Input
                value={bankInfo.bank_name}
                onChange={(e) => setBankInfo({ ...bankInfo, bank_name: e.target.value })}
                placeholder="ธนาคารกสิกรไทย"
              />
            </div>
            <div>
              <Label>เลขที่บัญชี</Label>
              <Input
                value={bankInfo.account_number}
                onChange={(e) => {
                  let val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length > 9) {
                    val = val.substring(0, 3) + '-' + val.substring(3, 4) + '-' + val.substring(4, 9) + '-' + val.substring(9, 10);
                  } else if (val.length > 4) {
                    val = val.substring(0, 3) + '-' + val.substring(3, 4) + '-' + val.substring(4);
                  } else if (val.length > 3) {
                    val = val.substring(0, 3) + '-' + val.substring(3);
                  }
                  setBankInfo({ ...bankInfo, account_number: val });
                }}
                placeholder="xxx-x-xxxxx-x"
                maxLength={13}
              />
            </div>
            <div className="sm:col-span-2">
              <Label>พร้อมเพย์</Label>
              <Input
                value={bankInfo.promptpay}
                onChange={(e) => setBankInfo({ ...bankInfo, promptpay: e.target.value })}
                placeholder="0812345678"
              />
            </div>

            <div className="sm:col-span-2 space-y-4 pb-6">
              <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-indigo-600" />
                รูปภาพ QR Code สำหรับรับชำระเงิน
              </h3>

              {bankInfo.payment_qr_code_url ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-lg p-6 border-2 border-slate-200 flex items-center justify-center">
                    <img
                      src={bankInfo.payment_qr_code_url}
                      alt="QR Code รับเงิน"
                      className="max-h-48 max-w-full object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQrCodeUpload}
                        className="hidden"
                      />
                      <div className="flex items-center justify-center gap-2 w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                        {uploadingQrCode ? (
                          <>
                            <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-sm font-medium">กำลังอัพโหลด...</span>
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4" />
                            <span className="text-sm font-medium">เปลี่ยน QR Code</span>
                          </>
                        )}
                      </div>
                    </label>
                    <Button
                      type="button"
                      onClick={() => {
                        if (confirm('คุณแน่ใจว่าต้องการลบ QR Code?')) {
                          setBankInfo({ ...bankInfo, payment_qr_code_url: '' });
                        }
                      }}
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <X className="w-4 h-4 mr-2" />
                      ลบ
                    </Button>
                  </div>
                </div>
              ) : (
                <label className="block cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleQrCodeUpload}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                    {uploadingQrCode ? (
                      <div className="text-center">
                        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <p className="text-sm text-slate-600">กำลังอัพโหลด...</p>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                        <p className="text-sm font-medium text-slate-700">คลิกเพื่ออัพโหลด QR Code</p>
                        <p className="text-xs text-slate-500 mt-1">PNG, JPG (ไม่เกิน 5MB)</p>
                      </div>
                    )}
                  </div>
                </label>
              )}
              <p className="text-xs text-slate-500 mt-2">
                💡 QR Code นี้จะถูกแนบไปพร้อมกับบิลค่าเช่าเมื่อส่งแจ้งเตือนทาง LINE หรือ Facebook ให้ผู้เช่า
              </p>
            </div>

          </div>
          <Button type="submit" className="bg-gradient-to-r from-purple-600 to-pink-600" disabled={isSavingBankInfo}>
            {isSavingBankInfo ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                บันทึก
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}