import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreditCard, Save, Loader2, Upload, X } from "lucide-react";
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
            
            <div className="sm:col-span-2 mt-4 pt-4 border-t">
              <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2 mb-2">QR Code รับเงิน (สำหรับแนบไปกับบิลเรียกเก็บเงิน)</h3>
              <p className="text-sm text-slate-600 mb-4">รูปภาพนี้จะถูกส่งไปพร้อมกับข้อความแจ้งยอดบิลครั้งแรก</p>
              
              {bankInfo.payment_qr_code_url ? (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                    <img
                      src={bankInfo.payment_qr_code_url}
                      alt="QR Code"
                      className="h-48 mx-auto object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          toast.loading('กำลังอัปโหลด QR Code...', { id: 'qr-upload' });
                          try {
                            const { file_url } = await base44.integrations.Core.UploadFile({ file });
                            setBankInfo({ ...bankInfo, payment_qr_code_url: file_url });
                            toast.success('อัปโหลด QR Code สำเร็จ (อย่าลืมกดบันทึก)', { id: 'qr-upload' });
                          } catch (err) {
                            toast.error('อัปโหลดล้มเหลว', { id: 'qr-upload' });
                          }
                        }}
                        className="hidden"
                      />
                      <div className="flex items-center justify-center gap-2 w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                        <Upload className="w-4 h-4" />
                        <span className="text-sm font-medium">เปลี่ยน QR Code</span>
                      </div>
                    </label>
                    <Button
                      type="button"
                      onClick={() => setBankInfo({ ...bankInfo, payment_qr_code_url: '' })}
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
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      toast.loading('กำลังอัปโหลด QR Code...', { id: 'qr-upload' });
                      try {
                        const { file_url } = await base44.integrations.Core.UploadFile({ file });
                        setBankInfo({ ...bankInfo, payment_qr_code_url: file_url });
                        toast.success('อัปโหลด QR Code สำเร็จ (อย่าลืมกดบันทึก)', { id: 'qr-upload' });
                      } catch (err) {
                        toast.error('อัปโหลดล้มเหลว', { id: 'qr-upload' });
                      }
                    }}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                    <div className="text-center">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                      <p className="text-sm font-medium text-slate-700">คลิกเพื่ออัปโหลด QR Code</p>
                      <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF (ไม่เกิน 5MB)</p>
                    </div>
                  </div>
                </label>
              )}
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