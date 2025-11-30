import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Component สำหรับซ่อน/แสดง UI elements ตาม feature
 * ใช้สำหรับปุ่ม, เมนู หรือส่วนเล็กๆ ที่ไม่ต้องการแสดง upgrade message
 * 
 * @param {string} featureName - ชื่อ feature ที่ต้องการเช็ค
 * @param {React.ReactNode} children - เนื้อหาที่จะแสดงถ้ามี feature
 * @param {React.ReactNode} fallback - เนื้อหาที่แสดงถ้าไม่มี feature (optional, default = null)
 */
export default function FeatureToggle({ featureName, children, fallback = null }) {
  const { data: subscriptions = [] } = useQuery({
    queryKey: ['appSubscriptions'],
    queryFn: () => base44.entities.AppSubscription.list('-created_date', 1),
    staleTime: 60 * 1000,
  });

  const checkFeatureAccess = (features, featureName) => {
    if (!features || features.length === 0) return true;
    
    const featureMap = {
      'dashboard_view': ['จัดการห้องพักไม่จำกัด', 'ระบบพื้นฐาน', 'Dashboard'],
      'rooms_view': ['จัดการห้องพักไม่จำกัด', 'ระบบพื้นฐาน', 'จัดการห้อง'],
      'tenants_view': ['จัดการผู้เช่าไม่จำกัด', 'ระบบพื้นฐาน', 'จัดการผู้เช่า'],
      'payments_view': ['ระบบการชำระเงินอัตโนมัติ', 'การชำระเงิน'],
      'meter_readings_view': ['บันทึกมิเตอร์', 'ค่าน้ำค่าไฟ'],
      'expenses_view': ['ค่าใช้จ่าย', 'การเงิน'],
      'contracts_view_monthly': ['สร้างสัญญาและใบเสร็จ', 'สัญญา'],
      'bookings_view_daily': ['การจองห้อง', 'ระบบจอง'],
      'reports_view_all': ['รายงานทางการเงิน', 'รายงาน'],
      'accounting_view_all': ['ฐานข้อมูลบัญชี', 'บัญชี'],
      'maintenance_view': ['แจ้งซ่อมและบำรุงรักษา', 'ซ่อมบำรุง'],
      'announcements_send': ['การแจ้งเตือนอัตโนมัติ', 'ประกาศ'],
      'ai_features': ['AI ผู้ช่วยอัจฉริยะ', 'AI', 'ปัญญาประดิษฐ์'],
      'multi_branch': ['ระบบหลายสาขา', 'หลายสาขา'],
      'settings_view': ['ตั้งค่า', 'Settings'],
    };

    const requiredKeywords = featureMap[featureName] || [];
    if (requiredKeywords.length === 0) return true;
    
    return features.some(feature => 
      requiredKeywords.some(keyword => 
        feature.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  };

  const subscription = subscriptions[0];
  
  if (!subscription || subscription.status === 'expired') {
    return fallback;
  }

  if (subscription.status === 'trial') {
    return children;
  }

  if (subscription.status === 'active') {
    const features = subscription.features || [];
    const hasAccess = checkFeatureAccess(features, featureName);
    return hasAccess ? children : fallback;
  }

  return fallback;
}