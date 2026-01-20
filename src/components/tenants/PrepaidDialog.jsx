import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Plus, Upload, CheckCircle2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function PrepaidDialog({ open, onOpenChange, tenant, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [slipUrl, setSlipUrl] = useState('');
  const [uploadingSlip, setUploadingSlip] = useState(false);
  const [saving, setSaving] = useState(false);

  // ⭐ Guard: Don't render if tenant is not loaded yet
  if (!open || !tenant?.id) return null;

  const handleSlipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingSlip(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setSlipUrl(file_url);
      toast.success('อัปโหลดสลิปสำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดสลิปไม่สำเร็จ');
    }
    setUploadingSlip(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      toast.error('กรุณาระบุจำนวนเงิน');
      return;
    }

    setSaving(true);
    try {
      // ⭐ Guard: Validate tenant before accessing properties
      if (!tenant?.id) {
        toast.error('ไม่สามารถโหลดข้อมูลผู้เช่า');
        return;
      }
      const currentBalance = tenant?.prepaid_balance || 0;
      const newBalance = currentBalance + parseFloat(amount);

      await base44.entities.Tenant.update(tenant.id, {
        prepaid_balance: newBalance
      });

      // บันทึก log
      await base44.entities.ActivityLog.create({
        branch_id: tenant.branch_id,
        action_type: 'update',
        entity_type: 'Tenant',
        entity_id: tenant.id,
        entity_name: tenant.full_name,
        description: `เติมเงินชำระล่วงหน้า ${parseFloat(amount).toLocaleString()} บาท (ยอดคงเหลือใหม่: ${newBalance.toLocaleString()} บาท)`
      });

      toast.success(`เติมเงินสำเร็จ! ยอดคงเหลือ: ${newBalance.toLocaleString()} บาท`);
      
      setAmount('');
      setSlipUrl('');
      setPaymentMethod('transfer');
      
      if (onSuccess) onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding prepaid:', error);
      toast.error('เกิดข้อผิดพลาดในการเติมเงิน');
    } finally {
      setSaving(false);
    }
  };

  const currentBalance = tenant?.prepaid_balance || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-green-600" />
            เติมเงินชำระล่วงหน้า
          </DialogTitle>
        </DialogHeader>

        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200 mb-4">
          <p className="text-sm text-slate-600 mb-1">ยอดคงเหลือปัจจุบัน</p>
          <p className="text-3xl font-bold text-green-600">
            {currentBalance.toLocaleString()} ฿
          </p>
          <p className="text-xs text-slate-500 mt-1">{tenant?.full_name}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>จำนวนเงินที่เติม (บาท) *</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="เช่น 15000"
              required
              min="1"
              step="0.01"
            />
            <p className="text-xs text-slate-500 mt-1">
              💡 สามารถเติมได้ตามจำนวนที่ต้องการ (เช่น ค่าเช่า 3 เดือน)
            </p>
          </div>

          <div>
            <Label>วิธีการชำระเงิน</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">💵 เงินสด</SelectItem>
                <SelectItem value="transfer">🏦 โอนเงิน</SelectItem>
                <SelectItem value="qr_code">📱 QR Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(paymentMethod === 'transfer' || paymentMethod === 'qr_code') && (
            <div>
              <Label>หลักฐานการโอน (ไม่บังคับ)</Label>
              <div className="mt-2">
                <label className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg hover:border-green-500 hover:bg-green-50 cursor-pointer transition-colors">
                  <Upload className="w-5 h-5 text-slate-600" />
                  <span className="text-sm text-slate-600">
                    {uploadingSlip ? 'กำลังอัปโหลด...' : 'คลิกเพื่ออัปโหลดสลิป'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleSlipUpload}
                    disabled={uploadingSlip || saving}
                    className="hidden"
                  />
                </label>
              </div>
              {slipUrl && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-sm text-green-700 mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>อัปโหลดสำเร็จ</span>
                  </div>
                  <img
                    src={slipUrl}
                    alt="สลิปการโอน"
                    className="w-full max-w-xs h-48 object-cover rounded-lg border-2 border-green-200"
                  />
                </div>
              )}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>ยอดคงเหลือใหม่:</strong> {(currentBalance + (parseFloat(amount) || 0)).toLocaleString()} บาท
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  เติมเงิน
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}