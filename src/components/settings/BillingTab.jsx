import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DollarSign, Save, Loader2 } from "lucide-react";
import { BranchToggle } from "./BranchToggle";

export default function BillingTab({
  billingRates,
  setBillingRates,
  applyToAllBranches,
  setApplyToAllBranches,
  selectedBranch,
  canSetGlobalConfig,
  handleBillingRatesSubmit,
  isSavingBillingRates
}) {
  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-green-600" />
          อัตราค่าใช้จ่าย
        </CardTitle>
      </CardHeader>
      <CardContent>
        <BranchToggle
          applyToAllBranches={applyToAllBranches}
          setApplyToAllBranches={setApplyToAllBranches}
          selectedBranch={selectedBranch}
          canSetGlobalConfig={canSetGlobalConfig}
        />

        <form onSubmit={handleBillingRatesSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>ค่าน้ำต่อหน่วย (บาท) *</Label>
              <Input
                type="number"
                step="0.01"
                value={billingRates.water_rate}
                onChange={(e) => setBillingRates({ ...billingRates, water_rate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>ค่าไฟต่อหน่วย (บาท) *</Label>
              <Input
                type="number"
                step="0.01"
                value={billingRates.electricity_rate}
                onChange={(e) => setBillingRates({ ...billingRates, electricity_rate: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>ค่าอินเทอร์เน็ต (บาท) *</Label>
              <Input
                type="number"
                step="0.01"
                value={billingRates.internet_fee}
                onChange={(e) => setBillingRates({ ...billingRates, internet_fee: e.target.value })}
                required
              />
            </div>
            <div>
              <Label>ค่าส่วนกลาง (บาท)</Label>
              <Input
                type="number"
                step="0.01"
                value={billingRates.common_fee}
                onChange={(e) => setBillingRates({ ...billingRates, common_fee: e.target.value })}
                placeholder="0 ถ้าไม่มี"
              />
            </div>
            <div>
              <Label>ค่าจอดรถยนต์ (บาท/คัน) *</Label>
              <Input
                type="number"
                step="0.01"
                value={billingRates.car_parking_fee}
                onChange={(e) => setBillingRates({ ...billingRates, car_parking_fee: e.target.value })}
                placeholder="ค่าจอดรถยนต์ต่อคัน"
                required
              />
            </div>
            <div>
              <Label>ค่าจอดรถมอเตอร์ไซค์ (บาท/คัน) *</Label>
              <Input
                type="number"
                step="0.01"
                value={billingRates.motorcycle_parking_fee}
                onChange={(e) => setBillingRates({ ...billingRates, motorcycle_parking_fee: e.target.value })}
                placeholder="ค่าจอดมอเตอร์ไซค์ต่อคัน"
                required
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              ค่าขั้นต่ำสำหรับการใช้น้ำ/ไฟต่ำ
            </h3>
            <p className="text-xs text-slate-600">
              กำหนดค่าขั้นต่ำสำหรับกรณีที่ผู้เช่าใช้น้ำ/ไฟต่ำกว่าเกณฑ์ที่กำหนด
            </p>

            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={billingRates.water_minimum_enabled}
                  onChange={(e) => setBillingRates({ ...billingRates, water_minimum_enabled: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <p className="text-sm font-semibold text-blue-800">เปิดใช้ค่าน้ำขั้นต่ำ</p>
                  <p className="text-xs text-blue-600">คิดค่าน้ำขั้นต่ำถ้าใช้ต่ำกว่าเกณฑ์</p>
                </div>
              </label>

              {billingRates.water_minimum_enabled && (
                <div className="grid grid-cols-2 gap-3 pl-8">
                  <div>
                    <Label className="text-xs text-blue-700">ถ้าใช้ต่ำกว่า (หน่วย)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={billingRates.water_minimum_units}
                      onChange={(e) => setBillingRates({ ...billingRates, water_minimum_units: e.target.value })}
                      placeholder="3"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-blue-700">คิดค่าน้ำขั้นต่ำ (บาท)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={billingRates.water_minimum_charge}
                      onChange={(e) => setBillingRates({ ...billingRates, water_minimum_charge: e.target.value })}
                      placeholder="100"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={billingRates.electricity_minimum_enabled}
                  onChange={(e) => setBillingRates({ ...billingRates, electricity_minimum_enabled: e.target.checked })}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <p className="text-sm font-semibold text-yellow-800">เปิดใช้ค่าไฟขั้นต่ำ</p>
                  <p className="text-xs text-yellow-600">คิดค่าไฟขั้นต่ำถ้าใช้ต่ำกว่าเกณฑ์</p>
                </div>
              </label>

              {billingRates.electricity_minimum_enabled && (
                <div className="grid grid-cols-2 gap-3 pl-8">
                  <div>
                    <Label className="text-xs text-yellow-700">ถ้าใช้ต่ำกว่า (หน่วย)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={billingRates.electricity_minimum_units}
                      onChange={(e) => setBillingRates({ ...billingRates, electricity_minimum_units: e.target.value })}
                      placeholder="3"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-yellow-700">คิดค่าไฟขั้นต่ำ (บาท)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={billingRates.electricity_minimum_charge}
                      onChange={(e) => setBillingRates({ ...billingRates, electricity_minimum_charge: e.target.value })}
                      placeholder="100"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button type="submit" className="bg-gradient-to-r from-green-600 to-emerald-600" disabled={isSavingBillingRates}>
            {isSavingBillingRates ? (
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