import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { User, CheckCircle2, Loader2, MessageSquare } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function BookingConfirmTenantDialog({
  isOpen,
  onOpenChange,
  pendingTempBooking,
  rooms,
  tenants,
  selectedTenant,
  setSelectedTenant,
  createNewTenant,
  setCreateNewTenant,
  tenantFormData,
  setTenantFormData,
  confirmTempBookingMutation,
  selectedBranchId
}) {
  if (!pendingTempBooking) return null;

  const getRoomInfo = (roomId) => rooms.find(r => r.id === roomId);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            ยืนยันข้อมูลผู้เช่า
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
            <p className="text-sm text-slate-600 mb-2">การจองห้อง</p>
            <p className="font-bold text-lg text-slate-800">
              ห้อง {getRoomInfo(pendingTempBooking.room_id)?.room_number} • {pendingTempBooking.guest_name}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">ตัวเลือกผู้เช่า:</p>

            {/* ค้นหาผู้เช่าที่มีอยู่ */}
            <div className="space-y-2">
              <label className="text-sm text-slate-600">ผู้เช่าที่มีอยู่</label>
              <Select 
                value={selectedTenant ? selectedTenant.id : ''} 
                onValueChange={(tenantId) => {
                  const tenant = tenants.find(t => t.id === tenantId);
                  if (tenant) {
                    setSelectedTenant(tenant);
                    setCreateNewTenant(false);
                  } else {
                    setSelectedTenant(null);
                    setCreateNewTenant(true);
                  }
                }}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="เลือกผู้เช่า..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">🆓 ไม่เลือกผู้เช่า (สร้างใหม่)</SelectItem>
                  {tenants.filter(t => t.status === 'active').map(tenant => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.full_name} • {tenant.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ฟอร์มสร้างผู้เช่าใหม่ */}
            {(!selectedTenant || createNewTenant) && (
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
                <p className="text-sm font-semibold text-slate-700">ข้อมูลผู้เช่าใหม่</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    placeholder="ชื่อ-นามสกุล"
                    value={tenantFormData.full_name}
                    onChange={(e) => setTenantFormData({...tenantFormData, full_name: e.target.value})}
                  />
                  <Input
                    placeholder="เบอร์โทร"
                    value={tenantFormData.phone}
                    onChange={(e) => setTenantFormData({...tenantFormData, phone: e.target.value})}
                  />
                  <Input
                    placeholder="เลขบัตรประชาชน"
                    value={tenantFormData.national_id}
                    onChange={(e) => setTenantFormData({...tenantFormData, national_id: e.target.value})}
                  />
                  <Input
                    type="email"
                    placeholder="อีเมล"
                    value={tenantFormData.email}
                    onChange={(e) => setTenantFormData({...tenantFormData, email: e.target.value})}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setSelectedTenant(null);
              }}
              disabled={confirmTempBookingMutation.isPending}
            >
              ยกเลิก
            </Button>
            <Button
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold"
              onClick={async () => {
                let tenantId = selectedTenant?.id;

                // สร้างผู้เช่าใหม่ถ้าต้องการ
                if (!tenantId && tenantFormData.full_name) {
                  try {
                    const newTenant = await base44.entities.Tenant.create({
                      branch_id: selectedBranchId,
                      full_name: tenantFormData.full_name,
                      phone: tenantFormData.phone,
                      national_id: tenantFormData.national_id,
                      email: tenantFormData.email,
                      line_user_id: pendingTempBooking.line_user_id || '',
                      status: 'active'
                    });
                    tenantId = newTenant.id;
                    toast.success('เพิ่มผู้เช่าใหม่สำเร็จ');
                  } catch (error) {
                    toast.error('เพิ่มผู้เช่าไม่สำเร็จ');
                    return;
                  }
                }

                confirmTempBookingMutation.mutate({ tempBooking: pendingTempBooking, tenantId });
              }}
              disabled={confirmTempBookingMutation.isPending}
            >
              {confirmTempBookingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  ยืนยันและสร้าง Booking
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}