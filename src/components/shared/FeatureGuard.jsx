import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Lock, ArrowUpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * Component สำหรับตรวจสอบ feature access
 * ใช้ครอบส่วนที่ต้องการจำกัดการเข้าถึง
 * 
 * @param {string} featureName - ชื่อ feature ที่ต้องการเช็ค
 * @param {React.ReactNode} children - เนื้อหาที่จะแสดงถ้ามี feature
 * @param {React.ReactNode} fallback - เนื้อหาที่แสดงถ้าไม่มี feature (optional)
 */
export default function FeatureGuard({ featureName, children, fallback }) {
  const navigate = useNavigate();

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
  
  // ถ้าไม่มี subscription หรือ expired
  if (!subscription || subscription.status === 'expired') {
    return fallback || (
      <Card className="bg-white/90 backdrop-blur-xl border-red-200 shadow-xl">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-slate-800 mb-2">ต้องใช้แพ็กเกจที่ใช้งานอยู่</h3>
          <p className="text-slate-600 mb-4">
            ฟีเจอร์นี้ต้องการแพ็กเกจที่ active
          </p>
          <Button
            onClick={() => navigate(createPageUrl('PackageSelectionPage'))}
            className="bg-gradient-to-r from-blue-600 to-indigo-600"
          >
            <Crown className="w-4 h-4 mr-2" />
            เลือกแพ็กเกจ
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Trial = เข้าได้ทั้งหมด
  if (subscription.status === 'trial') {
    return children;
  }

  // Active = เช็ค features
  if (subscription.status === 'active') {
    const features = subscription.features || [];
    const hasAccess = checkFeatureAccess(features, featureName);

    if (!hasAccess) {
      return fallback || (
        <Card className="bg-white/90 backdrop-blur-xl border-amber-200 shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <Crown className="w-8 h-8 text-amber-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">อัปเกรดเพื่อปลดล็อก</h3>
            <p className="text-slate-600 mb-1">
              ฟีเจอร์นี้ไม่รวมอยู่ในแพ็กเกจปัจจุบันของคุณ
            </p>
            <p className="text-sm text-slate-500 mb-4">
              แพ็กเกจปัจจุบัน: <strong>{subscription.package_name}</strong>
            </p>
            <Button
              onClick={() => navigate(createPageUrl('PackageSelectionPage'))}
              className="bg-gradient-to-r from-amber-500 to-orange-500"
            >
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              อัปเกรดแพ็กเกจ
            </Button>
          </CardContent>
        </Card>
      );
    }

    return children;
  }

  // Pending หรือสถานะอื่น
  return fallback || (
    <Card className="bg-white/90 backdrop-blur-xl border-blue-200 shadow-xl">
      <CardContent className="p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">รอการอนุมัติ</h3>
        <p className="text-slate-600">
          ระบบกำลังตรวจสอบการชำระเงินของคุณ
        </p>
      </CardContent>
    </Card>
  );
}