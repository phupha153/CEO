import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function PublicBookingSettingsDialog({ isOpen, setIsOpen, configs, selectedBranchId }) {
  const queryClient = useQueryClient();

  const [bookingPaymentType, setBookingPaymentType] = useState('deposit');
  const [dailyDepositAmount, setDailyDepositAmount] = useState('200');
  const [monthlySecurityDeposit, setMonthlySecurityDeposit] = useState('2000');
  const [monthlyAdvanceRent, setMonthlyAdvanceRent] = useState('1');
  const [monthlyCommonFee, setMonthlyCommonFee] = useState('0');
  const [monthlyOtherFees, setMonthlyOtherFees] = useState('0');
  const [monthlyBookingDeposit, setMonthlyBookingDeposit] = useState('1000');

  useEffect(() => {
    if (configs && configs.length > 0) {
      const getVal = (key, defaultVal) => configs.find(c => c.key === key)?.value || defaultVal;
      setBookingPaymentType(getVal('public_booking_payment_type', 'deposit'));
      setDailyDepositAmount(getVal('public_booking_daily_deposit', getVal('public_booking_deposit', '200')));
      setMonthlySecurityDeposit(getVal('public_booking_monthly_security_deposit', '2000'));
      setMonthlyAdvanceRent(getVal('public_booking_monthly_advance_rent_months', '1'));
      setMonthlyCommonFee(getVal('public_booking_monthly_common_fee_months', '0'));
      setMonthlyOtherFees(getVal('public_booking_monthly_other_fees', '0'));
      setMonthlyBookingDeposit(getVal('public_booking_monthly_booking_deposit', '1000'));
    }
  }, [configs]);

  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const upsertConfig = async (key, value, description) => {
        const existing = configs.find(c => c.key === key);
        if (existing) {
          await base44.entities.Config.update(existing.id, { value: value.toString() });
        } else {
          await base44.entities.Config.create({
            branch_id: selectedBranchId,
            key,
            value: value.toString(),
            value_type: 'string',
            category: 'billing',
            description
          });
        }
      };

      await upsertConfig('public_booking_payment_type', bookingPaymentType, 'ประเภทการชำระเงินจอง (deposit/full)');
      await upsertConfig('public_booking_daily_deposit', dailyDepositAmount, 'เงินมัดจำรายวัน');
      await upsertConfig('public_booking_monthly_security_deposit', monthlySecurityDeposit, 'เงินประกันรายเดือน');
      await upsertConfig('public_booking_monthly_advance_rent_months', monthlyAdvanceRent, 'ค่าเช่าล่วงหน้ารายเดือน');
      await upsertConfig('public_booking_monthly_common_fee_months', monthlyCommonFee, 'ค่าส่วนกลางล่วงหน้ารายเดือน');
      await upsertConfig('public_booking_monthly_other_fees', monthlyOtherFees, 'ค่าอื่นๆแรกเข้า (บาท)');
      await upsertConfig('public_booking_monthly_booking_deposit', monthlyBookingDeposit, 'เงินมัดจำสำหรับจองรายเดือน');
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['configs', selectedBranchId]);
      setIsOpen(false);
      toast.success('บันทึกการตั้งค่าสำเร็จ');
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-slate-600" />
            ตั้งค่าเงินมัดจำ (Public Booking)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>รูปแบบการชำระเงินในการจอง</Label>
            <div className="flex gap-4 mt-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={bookingPaymentType === 'deposit'} onChange={() => setBookingPaymentType('deposit')} className="accent-blue-600" />
                ชำระแค่มัดจำเพื่อจอง
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={bookingPaymentType === 'full'} onChange={() => setBookingPaymentType('full')} className="accent-blue-600" />
                ชำระเต็มจำนวน
              </label>
            </div>
          </div>

          <div className="border-t pt-4">
            <h4 className="font-semibold mb-3 text-indigo-700">การจองรายวัน</h4>
            {bookingPaymentType === 'deposit' ? (
              <div>
                <Label>จำนวนเงินมัดจำ (บาท/การจอง)</Label>
                <Input
                  type="number"
                  value={dailyDepositAmount}
                  onChange={(e) => setDailyDepositAmount(e.target.value)}
                  placeholder="200"
                  className="mt-1"
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500 bg-slate-50 p-2 rounded">ลูกค้าต้องชำระเต็มจำนวน: ราคาห้อง x จำนวนคืน</p>
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
            <h4 className="font-semibold text-blue-700">การจองรายเดือน (แรกเข้า)</h4>
            
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border">
              <div className="col-span-2">
                <Label>เงินประกัน/มัดจำ (บาท)</Label>
                <Input
                  type="number"
                  value={monthlySecurityDeposit}
                  onChange={(e) => setMonthlySecurityDeposit(e.target.value)}
                  placeholder="2000"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>ค่าเช่าล่วงหน้า (เดือน)</Label>
                <Input
                  type="number"
                  value={monthlyAdvanceRent}
                  onChange={(e) => setMonthlyAdvanceRent(e.target.value)}
                  placeholder="1"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>ส่วนกลางล่วงหน้า (เดือน)</Label>
                <Input
                  type="number"
                  value={monthlyCommonFee}
                  onChange={(e) => setMonthlyCommonFee(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>ค่าอื่นๆแรกเข้า (บาท)</Label>
                <Input
                  type="number"
                  value={monthlyOtherFees}
                  onChange={(e) => setMonthlyOtherFees(e.target.value)}
                  placeholder="0"
                  className="mt-1"
                />
              </div>
            </div>

            {bookingPaymentType === 'deposit' ? (
              <div className="mt-3">
                <Label className="text-blue-700 font-semibold">จำนวนเงินมัดจำเพื่อจองห้อง (บาท)</Label>
                <Input
                  type="number"
                  value={monthlyBookingDeposit}
                  onChange={(e) => setMonthlyBookingDeposit(e.target.value)}
                  placeholder="1000"
                  className="mt-1"
                />
                <p className="text-xs text-slate-500 mt-1">ส่วนที่เหลือจะเรียกเก็บในวันทำสัญญาเข้าพัก</p>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-2 bg-slate-50 p-2 rounded">ลูกค้าต้องชำระเต็มจำนวน (เงินประกัน + ค่าเช่าล่วงหน้า + ส่วนกลางล่วงหน้า) ในขณะจอง</p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={() => saveSettingsMutation.mutate()} 
              disabled={saveSettingsMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saveSettingsMutation.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}