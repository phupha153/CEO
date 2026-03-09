import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Upload } from "lucide-react";

export default function BookingFormDialog({
  showDialog,
  setShowDialog,
  editingBooking,
  handleSubmit,
  dialogBookingType,
  setDialogBookingType,
  formData,
  setFormData,
  rooms,
  canEdit,
  canAdd,
  createTempMutation,
  updateTempMutation,
  uploadingSlip,
  handleSlipUpload,
  createPaymentOnBooking,
  setCreatePaymentOnBooking,
  resetForm
}) {
  return (
    <Dialog open={showDialog} onOpenChange={(open) => {
      setShowDialog(open);
      if (!open) {
        resetForm();
      }
    }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">
        <DialogHeader>
          <DialogTitle>{editingBooking ? 'แก้ไขการจอง' : 'จองห้องพัก'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="mb-2 block">ประเภทการเช่า *</Label>
            <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setDialogBookingType('daily')}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                  dialogBookingType === 'daily'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                รายวัน
              </button>
              <button
                type="button"
                onClick={() => setDialogBookingType('monthly')}
                className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                  dialogBookingType === 'monthly'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                รายเดือน
              </button>
            </div>
          </div>

          <div>
            <Label>เลือกห้อง *</Label>
            <select
              value={formData.room_id}
              onChange={(e) => {
                const selectedRoom = rooms.find(r => r.id === e.target.value);
                if (selectedRoom) {
                  // Auto-fill ตามประเภทห้อง
                  if (dialogBookingType === 'daily') {
                    setFormData({ 
                      ...formData, 
                      room_id: e.target.value,
                      security_deposit: selectedRoom.price?.toString() || '',
                      deposit_amount: ''
                    });
                  } else {
                    // รายเดือน
                    setFormData({ 
                      ...formData, 
                      room_id: e.target.value,
                      security_deposit: selectedRoom.price?.toString() || '',
                      advance_rent: selectedRoom.price?.toString() || '',
                      common_fee_included: selectedRoom.common_fee?.toString() || ''
                    });
                  }
                } else {
                  setFormData({ ...formData, room_id: e.target.value });
                }
              }}
              required
              className="w-full p-2 border rounded-md"
              disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
            >
              <option value="">เลือกห้อง</option>
              {rooms
                .sort((a, b) => {
                  if (a.floor !== b.floor) return a.floor - b.floor;
                  return a.room_number.localeCompare(b.room_number);
                })
                .map(room => {
                  const statusText = room.status === 'available' ? 'ว่าง' :
                                    room.status === 'occupied' ? 'มีผู้เช่า' : 'จอง';
                  return (
                    <option key={room.id} value={room.id}>
                      ห้อง {room.room_number} - ชั้น {room.floor} ({room.price?.toLocaleString()} บาท) - {statusText}
                    </option>
                  );
                })}
            </select>
            {formData.room_id && (() => {
              const selectedRoom = rooms.find(r => r.id === formData.room_id);
              if (selectedRoom && selectedRoom.status === 'occupied') {
                return (
                  <p className="text-sm text-orange-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    ห้องนี้มีผู้เช่ารายเดือนอยู่แล้ว
                  </p>
                );
              }
            })()}
          </div>

          {/* ข้อมูลผู้จอง */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              👤 ข้อมูลผู้จอง
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>ชื่อผู้เข้าพัก *</Label>
                <Input
                  value={formData.guest_name}
                  onChange={(e) => setFormData({ ...formData, guest_name: e.target.value })}
                  required
                  placeholder="ชื่อ-นามสกุล"
                  disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                />
              </div>
              <div>
                <Label>เบอร์โทรศัพท์ *</Label>
                <Input
                  value={formData.guest_phone}
                  onChange={(e) => setFormData({ ...formData, guest_phone: e.target.value })}
                  required
                  placeholder="0812345678"
                  disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-3">
              <div>
                <Label>เลขบัตรประชาชน</Label>
                <Input
                  value={formData.guest_national_id}
                  onChange={(e) => setFormData({ ...formData, guest_national_id: e.target.value })}
                  placeholder="1234567890123"
                  maxLength={13}
                  disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                />
              </div>
              <div>
                <Label>อีเมล</Label>
                <Input
                  type="email"
                  value={formData.guest_email}
                  onChange={(e) => setFormData({ ...formData, guest_email: e.target.value })}
                  placeholder="email@example.com"
                  disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                />
              </div>
            </div>
            
            <div className="mt-3">
              <Label>ที่อยู่</Label>
              <Input
                value={formData.guest_address}
                onChange={(e) => setFormData({ ...formData, guest_address: e.target.value })}
                placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด"
                disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
              />
            </div>
          </div>

          {/* วันที่พัก */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              📅 {dialogBookingType === 'daily' ? 'วันที่พัก' : 'วันที่และเงื่อนไขสัญญา'}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{dialogBookingType === 'daily' ? 'วันที่เข้าพัก' : 'วันที่จอง/เข้าพัก'} *</Label>
                <Input
                  type="date"
                  value={formData.check_in_date}
                  onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                  required
                  disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                />
              </div>
              <div>
                <Label>{dialogBookingType === 'daily' ? 'วันที่ออก *' : 'วันที่สิ้นสุด (ถ้ามี)'}</Label>
                <Input
                  type="date"
                  value={formData.check_out_date}
                  onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                  required={dialogBookingType === 'daily'}
                  disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                />
              </div>
            </div>
            {dialogBookingType === 'monthly' && (
              <>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label>ระยะเวลาสัญญา</Label>
                    <Select
                      value={formData.contract_duration}
                      onValueChange={(value) => setFormData({ ...formData, contract_duration: value })}
                      disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกระยะเวลา" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 เดือน">1 เดือน</SelectItem>
                        <SelectItem value="3 เดือน">3 เดือน</SelectItem>
                        <SelectItem value="6 เดือน">6 เดือน</SelectItem>
                        <SelectItem value="1 ปี">1 ปี</SelectItem>
                        <SelectItem value="2 ปี">2 ปี</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>กำหนดทำสัญญาภายในวันที่</Label>
                    <Input
                      type="date"
                      value={formData.contract_deadline}
                      onChange={(e) => setFormData({ ...formData, contract_deadline: e.target.value })}
                      disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-2">หากพ้นกำหนดนี้ถือว่าสละสิทธิ์</p>
              </>
            )}
          </div>

          {/* รายละเอียดการชำระเงิน */}
          <div className="border-t pt-4">
            <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
              💰 รายละเอียดการชำระเงิน
            </h3>

            <div className="space-y-3">
              {dialogBookingType === 'daily' ? (
                <>
                  {/* ฟอร์มรายวัน - แบบง่าย */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>เงินมัดจำ (บาท)</Label>
                      <Input
                        type="number"
                        value={formData.deposit_amount}
                        onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                        placeholder="500"
                        disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                      />
                    </div>
                    <div>
                      <Label>ค่าใช้จ่ายทั้งหมด (บาท)</Label>
                      <Input
                        type="number"
                        value={formData.security_deposit}
                        onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })}
                        placeholder="3,000"
                        disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                      />
                    </div>
                  </div>

                  {/* แสดงยอดคงเหลือสำหรับรายวัน */}
                  {(formData.deposit_amount || formData.security_deposit) && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-2">สรุปยอดเงิน</h4>
                      <div className="space-y-1 text-sm">
                        {formData.security_deposit > 0 && (
                          <div className="flex justify-between">
                            <span>ค่าใช้จ่ายทั้งหมด:</span>
                            <span>{Number(formData.security_deposit).toLocaleString()} บาท</span>
                          </div>
                        )}
                        {formData.deposit_amount > 0 && (
                          <div className="flex justify-between text-green-700">
                            <span>ชำระแล้ว (มัดจำ):</span>
                            <span>-{Number(formData.deposit_amount).toLocaleString()} บาท</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-orange-600 border-t border-blue-300 pt-2 mt-2">
                          <span>💰 ยอดคงเหลือ (รอชำระ):</span>
                          <span>
                            {Math.max(0, 
                              Number(formData.security_deposit || 0) - Number(formData.deposit_amount || 0)
                            ).toLocaleString()} บาท
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* ฟอร์มรายเดือน - แบบละเอียด */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>เงินจองห้อง (บาท)</Label>
                      <Input
                        type="number"
                        value={formData.deposit_amount}
                        onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                        placeholder="2,000"
                        disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                      />
                    </div>
                    <div>
                      <Label>เงินประกันห้อง (บาท)</Label>
                      <Input
                        type="number"
                        value={formData.security_deposit}
                        onChange={(e) => setFormData({ ...formData, security_deposit: e.target.value })}
                        placeholder="6,000"
                        disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>ค่าเช่าล่วงหน้า (บาท)</Label>
                      <Input
                        type="number"
                        value={formData.advance_rent}
                        onChange={(e) => setFormData({ ...formData, advance_rent: e.target.value })}
                        placeholder="3,900"
                        disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                      />
                    </div>
                    <div>
                      <Label>รวมส่วนกลาง (บาท)</Label>
                      <Input
                        type="number"
                        value={formData.common_fee_included}
                        onChange={(e) => setFormData({ ...formData, common_fee_included: e.target.value })}
                        placeholder="0"
                        disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                      />
                    </div>
                  </div>

                  {/* แสดงสรุปยอดเงิน */}
                  {(formData.deposit_amount || formData.security_deposit || formData.advance_rent) && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 mt-3">
                      <h4 className="font-semibold text-blue-800 mb-2">สรุปยอดเงิน</h4>
                      <div className="space-y-1 text-sm">
                        {formData.deposit_amount > 0 && (
                          <div className="flex justify-between">
                            <span>เงินจองห้อง:</span>
                            <span>{Number(formData.deposit_amount).toLocaleString()} บาท</span>
                          </div>
                        )}
                        {formData.security_deposit > 0 && (
                          <div className="flex justify-between">
                            <span>เงินประกันห้อง:</span>
                            <span>{Number(formData.security_deposit).toLocaleString()} บาท</span>
                          </div>
                        )}
                        {formData.advance_rent > 0 && (
                          <div className="flex justify-between">
                            <span>ค่าเช่าล่วงหน้า:</span>
                            <span>{Number(formData.advance_rent).toLocaleString()} บาท</span>
                          </div>
                        )}
                        {formData.common_fee_included > 0 && (
                          <div className="flex justify-between">
                            <span>รวมส่วนกลาง:</span>
                            <span>{Number(formData.common_fee_included).toLocaleString()} บาท</span>
                          </div>
                        )}
                        <div className="flex justify-between font-bold text-blue-800 border-t border-blue-300 pt-2 mt-2">
                          <span>รวมสุทธิ:</span>
                          <span>
                            {(
                              Number(formData.deposit_amount || 0) +
                              Number(formData.security_deposit || 0) +
                              Number(formData.advance_rent || 0) +
                              Number(formData.common_fee_included || 0)
                            ).toLocaleString()} บาท
                          </span>
                        </div>
                        <div className="flex justify-between text-green-700 font-semibold">
                          <span>* คงเหลือชำระทีหลัง:</span>
                          <span>
                            {(
                              Number(formData.security_deposit || 0) +
                              Number(formData.advance_rent || 0) +
                              Number(formData.common_fee_included || 0)
                            ).toLocaleString()} บาท
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <Label>วิธีการชำระเงิน</Label>
                <Select
                  value={formData.deposit_payment_method}
                  onValueChange={(value) => setFormData({ ...formData, deposit_payment_method: value })}
                  disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                >
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

              {(formData.deposit_payment_method === 'transfer' || formData.deposit_payment_method === 'qr_code') && (
                <div>
                  <Label>หลักฐานการโอน / สลิป</Label>
                  <div className="mt-2">
                    <label className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-colors">
                      <Upload className="w-5 h-5 text-slate-600" />
                      <span className="text-sm text-slate-600">
                        {uploadingSlip ? 'กำลังอัปโหลด...' : 'คลิกเพื่ออัปโหลดสลิป'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleSlipUpload}
                        disabled={uploadingSlip || createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {formData.deposit_slip_url && (
                    <div className="mt-3 relative">
                      <img
                        src={formData.deposit_slip_url}
                        alt="สลิปการโอนเงิน"
                        className="w-full max-w-xs h-48 object-cover rounded-lg border-2 border-slate-200"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => setFormData({ ...formData, deposit_slip_url: '' })}
                        disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
                      >
                        ลบรูป
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <Label>หมายเหตุ</Label>
            <Input
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={createTempMutation.isPending || updateTempMutation.isPending || (editingBooking ? !canEdit : !canAdd)}
              placeholder="หมายเหตุเพิ่มเติม..."
            />
          </div>

          {!editingBooking && (() => {
            const totalAmount = dialogBookingType === 'daily'
              ? Number(formData.security_deposit || 0)
              : (
                  Number(formData.security_deposit || 0) +
                  Number(formData.advance_rent || 0) +
                  Number(formData.common_fee_included || 0)
                );
            return totalAmount > 0;
          })() && (
            <div className="border-t pt-4">
              <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="createPaymentCheck"
                    checked={createPaymentOnBooking}
                    onChange={(e) => setCreatePaymentOnBooking(e.target.checked)}
                    className="w-5 h-5 mt-0.5 rounded border-green-400 text-green-600 focus:ring-green-500"
                  />
                  <div className="flex-1">
                    <label htmlFor="createPaymentCheck" className="font-semibold text-green-800 cursor-pointer">
                      สร้างรายการชำระเงินทันที
                    </label>
                    <p className="text-xs text-green-700 mt-1">
                      ระบบจะสร้างรายการรอชำระในหน้า "การชำระเงิน" ทันทีหลังบันทึกการจอง
                    </p>
                    <p className="text-xs font-semibold text-green-800 mt-2">
                      💰 ยอดรอชำระ: {(
                        dialogBookingType === 'daily'
                          ? Number(formData.security_deposit || 0)
                          : (
                              Number(formData.security_deposit || 0) +
                              Number(formData.advance_rent || 0) +
                              Number(formData.common_fee_included || 0)
                            )
                      ).toLocaleString()} บาท
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={createTempMutation.isPending || updateTempMutation.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-indigo-600"
              disabled={
                createTempMutation.isPending ||
                updateTempMutation.isPending ||
                (editingBooking ? !canEdit : !canAdd)
              }
            >
              {createTempMutation.isPending || updateTempMutation.isPending ? 'กำลังบันทึก...' : (editingBooking ? 'อัปเดต' : 'จองห้อง')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}