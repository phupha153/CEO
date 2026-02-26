export const PERMISSIONS_LIST = [
  { id: 'dashboard_view', label: 'ดูแดชบอร์ด', category: 'แดชบอร์ด' },

  { id: 'rooms_view', label: 'ดูห้องพัก', category: 'ห้องพัก' },
  { id: 'rooms_add', label: 'เพิ่มห้องพัก', category: 'ห้องพัก' },
  { id: 'rooms_edit', label: 'แก้ไขห้องพัก', category: 'ห้องพัก' },
  { id: 'rooms_delete', label: 'ลบห้องพัก', category: 'ห้องพัก' },

  { id: 'tenants_view', label: 'ดูผู้เช่า', category: 'ผู้เช่า' },
  { id: 'tenants_add', label: 'เพิ่มผู้เช่า', category: 'ผู้เช่า' },
  { id: 'tenants_edit', label: 'แก้ไขผู้เช่า', category: 'ผู้เช่า' },
  { id: 'tenants_delete', label: 'ลบผู้เช่า', category: 'ผู้เช่า' },

  { id: 'bookings_view_daily', label: 'ดูการจองรายวัน', category: 'การจอง' },
  { id: 'bookings_add_daily', label: 'เพิ่มการจองรายวัน', category: 'การจอง' },
  { id: 'bookings_edit_daily', label: 'แก้ไขการจองรายวัน', category: 'การจอง' },
  { id: 'bookings_delete_daily', label: 'ลบการจองรายวัน', category: 'การจอง' },

  { id: 'contracts_view_monthly', label: 'ดูสัญญาเช่ารายเดือน', category: 'สัญญาเช่า' },
  { id: 'contracts_add_monthly', label: 'เพิ่มสัญญาเช่ารายเดือน', category: 'สัญญาเช่า' },
  { id: 'contracts_edit_monthly', label: 'แก้ไขสัญญาเช่ารายเดือน', category: 'สัญญาเช่า' },
  { id: 'contracts_delete_monthly', label: 'ลบสัญญาเช่ารายเดือน', category: 'สัญญาเช่า' },

  { id: 'payments_view', label: 'ดูการชำระเงิน', category: 'การชำระเงิน' },
  { id: 'payments_add', label: 'เพิ่มรายการชำระเงิน', category: 'การชำระเงิน' },
  { id: 'payments_edit', label: 'แก้ไขรายการชำระเงิน', category: 'การชำระเงิน' },
  { id: 'bookings_edit_deposit', label: 'แก้ไขเงินมัดจำ', category: 'การชำระเงิน' },
  { id: 'payments_delete', label: 'ลบรายการชำระเงิน', category: 'การชำระเงิน' },
  { id: 'payments_confirm', label: 'ยืนยันชำระเงิน', category: 'การชำระเงิน' },
  { id: 'payments_send_receipt', label: 'ส่งใบเสร็จ', category: 'การชำระเงิน' },
  { id: 'payments_send_comms_manual', label: 'ส่งบิล/แจ้งเตือน (รายบุคคล/หลายคน)', category: 'การชำระเงิน' },

  { id: 'meter_readings_view', label: 'ดูบันทึกมิเตอร์', category: 'บันทึกมิเตอร์' },
  { id: 'meter_readings_add', label: 'เพิ่มบันทึกมิเตอร์', category: 'บันทึกมิเตอร์' },
  { id: 'meter_readings_edit', label: 'แก้ไขบันทึกมิเตอร์ (ปัจจุบัน)', category: 'บันทึกมิเตอร์' },
  { id: 'meter_readings_edit_history', label: 'แก้ไขประวัติมิเตอร์ย้อนหลัง', category: 'บันทึกมิเตอร์' },
  { id: 'meter_readings_delete', label: 'ลบบันทึกมิเตอร์', category: 'บันทึกมิเตอร์' },

  { id: 'expenses_view', label: 'ดูค่าใช้จ่าย', category: 'ค่าใช้จ่าย' },
  { id: 'expenses_add', label: 'เพิ่มค่าใช้จ่าย', category: 'ค่าใช้จ่าย' },
  { id: 'expenses_edit', label: 'แก้ไขค่าใช้จ่าย', category: 'ค่าใช้จ่าย' },
  { id: 'expenses_delete', label: 'ลบค่าใช้จ่าย', category: 'ค่าใช้จ่าย' },

  { id: 'maintenance_view', label: 'ดูแจ้งซ่อม', category: 'แจ้งซ่อม' },
  { id: 'maintenance_add', label: 'เพิ่มแจ้งซ่อม', category: 'แจ้งซ่อม' },
  { id: 'maintenance_edit', label: 'แก้ไขแจ้งซ่อม', category: 'แจ้งซ่อม' },
  { id: 'maintenance_delete', label: 'ลบแจ้งซ่อม', category: 'แจ้งซ่อม' },
  { id: 'maintenance_update_status', label: 'อัปเดตสถานะแจ้งซ่อม', category: 'แจ้งซ่อม' },

  { id: 'reports_view_all', label: 'ดูรายงานทั้งหมด', category: 'รายงาน' },
  { id: 'reports_export', label: 'ส่งออกรายงาน', category: 'รายงาน' },

  { id: 'accounting_view_all', label: 'ดูฐานข้อมูลบัญชี', category: 'ฐานข้อมูลบัญชี' },
  { id: 'accounting_export', label: 'ส่งออกข้อมูลบัญชี', category: 'ฐานข้อมูลบัญชี' },

  { id: 'announcements_send', label: 'ส่งข้อความประกาศ', category: 'ข้อความประกาศ' },

  { id: 'settings_view', label: 'ดูการตั้งค่า', category: 'การตั้งค่า' },
  { id: 'settings_edit', label: 'แก้ไขการตั้งค่า', category: 'การตั้งค่า' },
  { id: 'settings_access_package_page', label: 'เข้าถึงหน้าแพ็กเกจ/ซื้อแพ็กเกจ', category: 'การตั้งค่า' },
];

export const DEFAULT_PERMISSIONS_MAP = {
  owner: PERMISSIONS_LIST.map(p => p.id),
  manager: [
    "dashboard_view",
    "rooms_view", "rooms_add", "rooms_edit",
    "tenants_view", "tenants_add", "tenants_edit",
    "bookings_view_daily", "bookings_add_daily", "bookings_edit_daily", "bookings_delete_daily",
    "contracts_view_monthly", "contracts_add_monthly", "contracts_edit_monthly",
    "payments_view", "payments_add", "payments_edit", "payments_confirm", "payments_send_receipt", "payments_send_comms_manual",
    "meter_readings_view", "meter_readings_add", "meter_readings_edit", "meter_readings_edit_history",
    "expenses_view", "expenses_add",
    "maintenance_view", "maintenance_add", "maintenance_edit", "maintenance_update_status",
    "reports_view_all", "reports_export",
    "accounting_view_all",
    "announcements_send",
    "settings_view", "settings_edit"
  ],
  employee: [
    "dashboard_view",
    "rooms_view",
    "tenants_view",
    "bookings_view_daily",
    "contracts_view_monthly",
    "payments_view",
    "meter_readings_view", "meter_readings_add", "meter_readings_edit", "meter_readings_edit_history",
    "expenses_view",
    "maintenance_view", "maintenance_add"
  ],
};

export const CATEGORY_ICONS = {
  'แดชบอร์ด': '',
  'ห้องพัก': '',
  'ผู้เช่า': '',
  'การจอง': '',
  'สัญญาเช่า': '',
  'การชำระเงิน': '',
  'บันทึกมิเตอร์': '',
  'ค่าใช้จ่าย': '',
  'แจ้งซ่อม': '',
  'รายงาน': '',
  'ฐานข้อมูลบัญชี': '',
  'ข้อความประกาศ': '',
  'การตั้งค่า': '',
};

export const PERMISSION_CATEGORIES_DISPLAY = PERMISSIONS_LIST.reduce((acc, permission) => {
  if (!acc[permission.category]) {
    acc[permission.category] = {
      title: permission.category,
      icon: CATEGORY_ICONS[permission.category] || '📦',
      permissions: []
    };
  }
  acc[permission.category].permissions.push(permission);
  return acc;
}, {});