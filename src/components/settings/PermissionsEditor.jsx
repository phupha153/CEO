import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, User, Save, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const PERMISSION_GROUPS = {
  payments: {
    label: "💰 การชำระเงิน",
    permissions: [
      { key: 'payments_view', label: 'ดูหน้าการชำระเงิน', default: true },
      { key: 'payments_add', label: 'เพิ่มการชำระเงินด้วยตนเอง', default: false },
      { key: 'payments_edit', label: 'แก้ไขการชำระเงิน', default: false },
      { key: 'payments_delete', label: 'ลบการชำระเงิน', default: false },
      { key: 'payments_confirm_paid', label: 'ยืนยันชำระเงิน', default: true },
      { key: 'payments_generate_bills', label: '🆕 สร้างบิลรายเดือนอัตโนมัติ', default: false },
      { key: 'payments_send_bills_bulk', label: '🆕 ส่งบิลทุกห้องพร้อมกัน', default: false },
      { key: 'payments_send_reminder', label: 'ส่งแจ้งเตือนรายบุคคล', default: true },
      { key: 'payments_send_receipt', label: 'ส่งใบเสร็จ', default: true },
      { key: 'payments_view_invoice', label: 'ดูใบแจ้งหนี้', default: true },
      { key: 'payments_view_receipt', label: 'ดูใบเสร็จ', default: true },
      { key: 'payments_autocalculate', label: 'ใช้ฟีเจอร์คำนวณอัตโนมัติ', default: false }
    ]
  },
  rooms: {
    label: "🏠 ห้องพัก",
    permissions: [
      { key: 'rooms_view', label: 'ดูหน้าจัดการห้องพัก', default: true },
      { key: 'rooms_add', label: 'เพิ่มห้องพัก', default: false },
      { key: 'rooms_edit', label: 'แก้ไขห้องพัก', default: false },
      { key: 'rooms_delete', label: 'ลบห้องพัก', default: false }
    ]
  },
  tenants: {
    label: "👤 ผู้เช่า",
    permissions: [
      { key: 'tenants_view', label: 'ดูหน้าผู้เช่า', default: true },
      { key: 'tenants_add', label: 'เพิ่มผู้เช่า', default: false },
      { key: 'tenants_edit', label: 'แก้ไขข้อมูลผู้เช่า', default: false },
      { key: 'tenants_delete', label: 'ลบผู้เช่า', default: false }
    ]
  },
  bookings: {
    label: "📅 การจอง",
    permissions: [
      { key: 'bookings_view_daily', label: 'ดูหน้าการจอง', default: true },
      { key: 'bookings_add', label: 'เพิ่มการจอง', default: false },
      { key: 'bookings_edit', label: 'แก้ไขการจอง', default: false },
      { key: 'bookings_delete', label: 'ลบการจอง', default: false }
    ]
  },
  maintenance: {
    label: "🔧 แจ้งซ่อม",
    permissions: [
      { key: 'maintenance_view', label: 'ดูหน้าแจ้งซ่อม', default: true },
      { key: 'maintenance_add', label: 'เพิ่มรายการแจ้งซ่อม', default: false },
      { key: 'maintenance_edit', label: 'แก้ไขรายการแจ้งซ่อม', default: false },
      { key: 'maintenance_delete', label: 'ลบรายการแจ้งซ่อม', default: false }
    ]
  },
  other: {
    label: "⚙️ อื่นๆ",
    permissions: [
      { key: 'meter_readings_view', label: 'ดูบันทึกมิเตอร์', default: true },
      { key: 'expenses_view', label: 'ดูค่าใช้จ่าย', default: false },
      { key: 'reports_view_all', label: 'ดูรายงาน', default: false },
      { key: 'accounting_view_all', label: 'ดูฐานข้อมูลบัญชี', default: false },
      { key: 'announcements_send', label: 'ส่งข้อความประกาศ', default: false },
      { key: 'settings_view', label: 'เข้าหน้าตั้งค่า', default: false },
      { key: 'dashboard_view', label: 'ดูแดชบอร์ด', default: true }
    ]
  }
};

export default function PermissionsEditor({ targetUser, onSave, onCancel }) {
  const [permissions, setPermissions] = useState(targetUser?.permissions || []);
  const [hasChanges, setHasChanges] = useState(false);

  const togglePermission = (permissionKey) => {
    setPermissions(prev => {
      const newPerms = prev.includes(permissionKey)
        ? prev.filter(p => p !== permissionKey)
        : [...prev, permissionKey];
      setHasChanges(true);
      return newPerms;
    });
  };

  const selectPreset = (presetRole) => {
    const presets = {
      manager: [
        'dashboard_view',
        'payments_view', 'payments_confirm_paid', 'payments_send_reminder', 'payments_send_receipt', 
        'payments_view_invoice', 'payments_view_receipt', 'payments_generate_bills', 'payments_send_bills_bulk',
        'rooms_view', 'rooms_edit',
        'tenants_view', 'tenants_edit',
        'bookings_view_daily', 'bookings_edit',
        'maintenance_view', 'maintenance_edit',
        'meter_readings_view',
        'expenses_view',
        'reports_view_all'
      ],
      employee: [
        'dashboard_view',
        'payments_view', 'payments_confirm_paid', 'payments_send_reminder', 'payments_send_receipt',
        'payments_view_invoice', 'payments_view_receipt',
        'rooms_view',
        'tenants_view',
        'bookings_view_daily',
        'maintenance_view',
        'meter_readings_view'
      ]
    };
    setPermissions(presets[presetRole] || []);
    setHasChanges(true);
  };

  const handleSave = async () => {
    await onSave(permissions);
    setHasChanges(false);
  };

  const allPermissionsCount = useMemo(() => {
    return Object.values(PERMISSION_GROUPS).reduce((sum, group) => sum + group.permissions.length, 0);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-xl">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">กำหนดสิทธิ์การใช้งาน</h3>
            <p className="text-sm text-slate-500">
              {targetUser?.full_name || targetUser?.email} ({targetUser?.custom_role || 'employee'})
            </p>
          </div>
        </div>
        <Badge className="bg-blue-100 text-blue-700">
          {permissions.length}/{allPermissionsCount} สิทธิ์
        </Badge>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-slate-800 mb-3">⚡ ชุดสิทธิ์แนะนำ</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => selectPreset('manager')}
              className="flex-1"
            >
              👔 ผู้จัดการ (เต็มรูปแบบ)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => selectPreset('employee')}
              className="flex-1"
            >
              👤 พนักงาน (พื้นฐาน)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setPermissions([]);
                setHasChanges(true);
              }}
              className="flex-1"
            >
              🚫 ล้างทั้งหมด
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
        {Object.entries(PERMISSION_GROUPS).map(([groupKey, group]) => (
          <Card key={groupKey} className="border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
                {group.label}
                <Badge variant="outline" className="text-xs">
                  {permissions.filter(p => group.permissions.some(gp => gp.key === p)).length}/{group.permissions.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {group.permissions.map(perm => (
                <div key={perm.key} className="flex items-center justify-between">
                  <Label className="text-sm font-medium text-slate-700 cursor-pointer flex-1">
                    {perm.label}
                    {perm.label.includes('🆕') && (
                      <Badge className="ml-2 bg-green-100 text-green-700 text-xs">ใหม่</Badge>
                    )}
                  </Label>
                  <Switch
                    checked={permissions.includes(perm.key)}
                    onCheckedChange={() => togglePermission(perm.key)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3 pt-4 border-t sticky bottom-0 bg-white pb-2">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={!hasChanges}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          ยกเลิก
        </Button>
        <Button
          onClick={handleSave}
          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          disabled={!hasChanges}
        >
          <Save className="w-4 h-4 mr-2" />
          บันทึกสิทธิ์
        </Button>
      </div>
    </div>
  );
}