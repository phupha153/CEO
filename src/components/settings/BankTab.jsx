import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CreditCard, Save, Loader2 } from "lucide-react";
import { BranchToggle } from "./BranchToggle";

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