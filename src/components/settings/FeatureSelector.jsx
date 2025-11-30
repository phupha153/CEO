import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Check, Save, X, Sparkles } from "lucide-react";

// รายการ features ทั้งหมดที่มีในระบบ (แบบละเอียดมาก)
const ALL_SYSTEM_FEATURES = [
  // ระบบพื้นฐาน
  "Dashboard แบบ Real-time",
  "ภาพรวมทั้งหมด (Multi-branch)",
  "วิเคราะห์ข้อมูล",
  
  // การจัดการห้องพัก
  "จัดการห้องพักไม่จำกัด",
  "เพิ่มห้องใหม่",
  "แก้ไขข้อมูลห้อง",
  "ลบห้องพัก",
  "เปลี่ยนสถานะห้อง",
  "อัปโหลดรูปห้อง",
  "Import ห้องจาก Excel",
  "AI ค้นหาห้อง",
  
  // การจัดการผู้เช่า
  "จัดการผู้เช่าไม่จำกัด",
  "เพิ่มผู้เช่าใหม่",
  "แก้ไขข้อมูลผู้เช่า",
  "ลบผู้เช่า",
  "ให้คะแนนผู้เช่า",
  "ดูบัตรประชาชน",
  "Import ผู้เช่าจาก Excel",
  "AI ค้นหาผู้เช่า",
  
  // การจองและสัญญา
  "การจองห้องรายวัน",
  "สร้างการจอง",
  "แก้ไขการจอง",
  "ยกเลิกการจอง",
  "สร้างสัญญาและใบเสร็จ",
  "สร้างสัญญาเช่า",
  "แก้ไขสัญญา",
  "ลบสัญญา",
  "Template สัญญา/เอกสาร",
  "เซ็นสัญญาออนไลน์",
  "ต่ออายุสัญญา",
  
  // การชำระเงิน
  "ระบบการชำระเงินอัตโนมัติ",
  "ดูรายการชำระเงิน",
  "บันทึกการชำระ",
  "แก้ไขการชำระ",
  "ลบการชำระ",
  "ตรวจสอบสลิปอัตโนมัติ",
  "รับเงินอัตโนมัติ (Auto Payment)",
  "ออกใบเสร็จอัตโนมัติ",
  "คำนวณค่าปรับอัตโนมัติ",
  "แจ้งเตือนค้างชำระ",
  "รับชำระเงินสด",
  "รับชำระโอนเงิน",
  "รับชำระ QR Code",
  "ผ่อนชำระ",
  
  // มิเตอร์และค่าสาธารณูปโภค
  "บันทึกมิเตอร์",
  "บันทึกค่าน้ำ",
  "บันทึกค่าไฟ",
  "คำนวณค่าน้ำค่าไฟอัตโนมัติ",
  "ประวัติการบันทึกมิเตอร์",
  "Export ข้อมูลมิเตอร์",
  "สร้างบิลจากมิเตอร์",
  
  // ค่าใช้จ่าย
  "ค่าใช้จ่าย",
  "บันทึกรายจ่ายทุกประเภท",
  "อัปโหลดใบเสร็จค่าใช้จ่าย",
  "จัดหมวดหมู่รายจ่าย",
  "รายงานค่าใช้จ่าย",
  
  // รายงานและบัญชี
  "รายงานทางการเงิน",
  "Export รายงาน Excel",
  "Export รายงาน PDF",
  "ฐานข้อมูลบัญชี",
  "Export ข้อมูลบัญชี",
  "รายงานรายได้รายวัน",
  "รายงานรายได้รายเดือน",
  "รายงานอัตราเข้าพัก",
  "รายงานเปรียบเทียบ",
  
  // การแจ้งซ่อมและบำรุงรักษา
  "แจ้งซ่อมและบำรุงรักษา",
  "ดูรายการแจ้งซ่อม",
  "สร้างคำขอแจ้งซ่อม",
  "แก้ไขคำขอแจ้งซ่อม",
  "ลบคำขอแจ้งซ่อม",
  "เปลี่ยนสถานะการซ่อม",
  "มอบหมายช่างซ่อม",
  "กำหนดระดับความสำคัญ",
  "แจ้งเตือนการแจ้งซ่อม",
  "ติดตามสถานะการซ่อม",
  "อัปโหลดรูปปัญหา",
  "บันทึกค่าใช้จ่ายในการซ่อม",
  
  // การจัดการพัสดุ
  "จัดการพัสดุ/ของส่ง",
  "รับพัสดุ",
  "สแกนข้อมูลพัสดุด้วย AI",
  "แจ้งเตือนผู้รับพัสดุทาง LINE",
  "ติดตามสถานะพัสดุ",
  "บันทึกรูปภาพพัสดุ",
  
  // การแจ้งเตือน
  "การแจ้งเตือนอัตโนมัติ",
  "แจ้งเตือน LINE OA",
  "แจ้งเตือน Email",
  "แจ้งเตือน SMS",
  "แจ้งก่อนครบกำหนดชำระ",
  "แจ้งค้างชำระ",
  "แจ้งสัญญาใกล้หมดอายุ",
  "แจ้งเตือนการซ่อม",
  "แจ้งห้องว่างนาน",
  "ส่งข้อความประกาศหมู่",
  "Template ข้อความสำเร็จรูป",
  
  // AI และระบบอัจฉริยะ
  "AI ผู้ช่วยอัจฉริยะ",
  "AI Chat Assistant",
  "AI ค้นหาข้อมูล 500+เดือน",
  "AI วิเคราะห์ข้อมูล",
  "AI ตรวจสอบสลิปอัตโนมัติ",
  "AI สร้างใบเสร็จอัตโนมัติ",
  "AI ร่างสัญญาอัตโนมัติ",
  "AI คำแนะนำการบริหาร",
  "AI สแกนพัสดุ (OCR)",
  
  // ระบบหลายสาขา
  "ระบบหลายสาขา",
  "เพิ่มสาขาไม่จำกัด",
  "แก้ไขข้อมูลสาขา",
  "สลับสาขา",
  "เปรียบเทียบผลการดำเนินงานสาขา",
  "Dashboard รวมทุกสาขา",
  "รายงานแยกตามสาขา",
  
  // การจัดการพนักงาน
  "จัดการพนักงาน 53สาขา",
  "เพิ่มพนักงาน",
  "กำหนดสิทธิ์พนักงาน",
  "กำหนด Role (Owner/Manager/Employee)",
  "จำกัดสาขาที่พนักงานเข้าถึง",
  "ดูประวัติการทำงาน",
  
  // เอกสารและ Template
  "Template สัญญา/เอกสารปรับแต่งได้",
  "Template ใบเสร็จ",
  "Template ใบแจ้งหนี้",
  "เซ็นเอกสารออนไลน์",
  "Export เอกสาร PDF",
  "สร้างเอกสารอัตโนมัติ",
  "ปรับแต่ง Template HTML",
  
  // Integration
  "แจ้งเตือน LINE ผู้เช่า",
  "LINE Official Account",
  "Slip2Go API",
  "SMS Gateway",
  "Email Service",
  "Browserless (PDF/Screenshot)",
  "CRM Integration",
  "Webhook รับข้อมูล",
  
  // การตั้งค่า
  "ตั้งค่าระบบ",
  "ตั้งค่าข้อมูลหอพัก",
  "ตั้งค่าอัตราค่าน้ำค่าไฟ",
  "ตั้งค่าบัญชีธนาคาร",
  "ตั้งค่าการแจ้งเตือน",
  "อัปโหลดลายเซ็น/ตรา",
  "ตั้งค่า LINE OA",
  "ตั้งค่าสิทธิ์ผู้ใช้",
  
  // ระบบทดสอบ (Developer)
  "โหมดทดสอบระบบ",
  "ดูข้อมูล Lists",
  "สร้างข้อมูลทดสอบ",
  "ลบข้อมูลทดสอบ",
  "คู่มือ AI Analytics",
  "คู่มือ Developer",
  "ทดสอบ LINE",
  "ดู API Logs",
  "จัดการ Webhooks",
];

export default function FeatureSelector({ 
  packageId, 
  packageName, 
  crmFeatures, 
  currentFeatures, 
  notes,
  onSave, 
  onCancel,
  isSaving 
}) {
  const [selectedFeatures, setSelectedFeatures] = useState(currentFeatures || crmFeatures || []);
  const [featureNotes, setFeatureNotes] = useState(notes || '');

  const toggleFeature = (featureName) => {
    setSelectedFeatures(prev => {
      const exists = prev.includes(featureName);
      if (exists) {
        return prev.filter(f => f !== featureName);
      } else {
        return [...prev, featureName];
      }
    });
  };

  const isFeatureEnabled = (featureName) => {
    return selectedFeatures.includes(featureName);
  };

  const toggleCrmFeature = (featureName) => {
    toggleFeature(featureName);
  };

  const crmFeaturesCount = crmFeatures?.length || 0;

  return (
    <div className="space-y-6">
      {/* Features จาก CRM */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <h4 className="font-semibold text-blue-900">Features ที่กำหนดใน CRM ({crmFeaturesCount})</h4>
          </div>
          <p className="text-xs text-blue-700">จาก CRM Package</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(crmFeatures || []).map((feature, idx) => {
            const isChecked = isFeatureEnabled(feature);
            return (
              <div
                key={idx}
                onClick={() => toggleCrmFeature(feature)}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-50 transition-all"
              >
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                  isChecked
                    ? 'border-blue-600 bg-blue-600'
                    : 'border-slate-300 bg-white'
                }`}>
                  {isChecked && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className="text-sm text-slate-800">{feature}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Features ระบบทั้งหมด (เพิ่มเติม) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-slate-800">Features ทั้งหมดของระบบ ({ALL_SYSTEM_FEATURES.length})</h4>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setSelectedFeatures(ALL_SYSTEM_FEATURES)}
            >
              <Check className="w-3 h-3 mr-1" />
              เลือกทั้งหมด
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setSelectedFeatures([])}
            >
              <X className="w-3 h-3 mr-1" />
              ล้าง
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 border border-slate-200 max-h-[400px] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {ALL_SYSTEM_FEATURES.map((feature, idx) => {
              const isChecked = isFeatureEnabled(feature);
              return (
                <div
                  key={idx}
                  onClick={() => toggleFeature(feature)}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all ${
                    isChecked
                      ? 'border-green-500 bg-green-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                    isChecked
                      ? 'border-green-600 bg-green-600'
                      : 'border-slate-300 bg-white'
                  }`}>
                    {isChecked && <Check className="w-3 h-3 text-white" />}
                  </div>
                  <span className={`text-sm ${isChecked ? 'text-green-900 font-medium' : 'text-slate-700'}`}>
                    {feature}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary */}
      <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-indigo-900">Features ที่เลือก</h4>
            <Badge className="bg-indigo-600 text-white text-base px-3 py-1">
              {selectedFeatures.length} Features
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <div>
        <Label className="mb-2 block">หมายเหตุ (ภายใน)</Label>
        <Textarea
          value={featureNotes}
          onChange={(e) => setFeatureNotes(e.target.value)}
          placeholder="บันทึกเพิ่มเติมเกี่ยวกับ features ของแพ็กเกจนี้..."
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-slate-500 mt-1">บันทึกนี้จะแสดงเฉพาะในหน้าผู้ดูแลเท่านั้น</p>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSaving}
        >
          ยกเลิก
        </Button>
        <Button
          onClick={() => onSave(selectedFeatures, featureNotes)}
          disabled={isSaving || selectedFeatures.length === 0}
          className="bg-gradient-to-r from-indigo-600 to-purple-600"
        >
          {isSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              กำลังบันทึก...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              บันทึก
            </>
          )}
        </Button>
      </div>
    </div>
  );
}