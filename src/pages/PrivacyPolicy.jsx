import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Lock, Database, Users, MessageSquare, Bell } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-purple-50 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-slate-800">นโยบายความเป็นส่วนตัว</h1>
            </div>
            <p className="text-sm text-slate-500 mb-8">อัปเดตล่าสุด: 8 ธันวาคม 2025</p>

            <div className="space-y-8">
              {/* บทนำ */}
              <section>
                <h2 className="text-xl font-bold text-slate-800 mb-4">บทนำ</h2>
                <p className="text-slate-600 leading-relaxed">
                  ระบบจัดการหอพัก ("เรา", "ของเรา") ให้ความสำคัญกับความเป็นส่วนตัวของคุณ 
                  นโยบายความเป็นส่วนตัวนี้อธิบายว่าเราเก็บรวบรวม ใช้ และปกป้องข้อมูลส่วนบุคคลของคุณอย่างไร
                  เมื่อคุณใช้บริการระบบจัดการหอพักของเรา
                </p>
              </section>

              {/* ข้อมูลที่เก็บรวบรวม */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Database className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-slate-800">ข้อมูลที่เราเก็บรวบรวม</h2>
                </div>
                <div className="space-y-4 ml-8">
                  <div>
                    <h3 className="font-semibold text-slate-700 mb-2">1. ข้อมูลส่วนบุคคล</h3>
                    <ul className="list-disc list-inside text-slate-600 space-y-1">
                      <li>ชื่อ-นามสกุล</li>
                      <li>เบอร์โทรศัพท์</li>
                      <li>ที่อยู่อีเมล</li>
                      <li>เลขบัตรประชาชน</li>
                      <li>ที่อยู่ที่พักอาศัย</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-700 mb-2">2. ข้อมูลการใช้งาน</h3>
                    <ul className="list-disc list-inside text-slate-600 space-y-1">
                      <li>ประวัติการเข้าสู่ระบบ</li>
                      <li>การชำระเงิน</li>
                      <li>การแจ้งซ่อมบำรุง</li>
                      <li>การจองห้องพัก</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-700 mb-2">3. ข้อมูลทางการเงิน</h3>
                    <ul className="list-disc list-inside text-slate-600 space-y-1">
                      <li>ประวัติการชำระเงิน</li>
                      <li>หลักฐานการโอนเงิน (สลิป)</li>
                      <li>ข้อมูลค่าน้ำค่าไฟ</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* การใช้ Facebook API */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-slate-800">การใช้ Facebook API</h2>
                </div>
                <div className="space-y-4 ml-8 bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-slate-700 mb-2">สิทธิ์ที่ขอจาก Facebook:</h3>
                  <ul className="list-disc list-inside text-slate-600 space-y-2">
                    <li>
                      <strong>pages_show_list:</strong> เพื่อแสดงรายการ Facebook Pages ที่คุณเป็นผู้ดูแล
                      เพื่อให้คุณเลือก Page ที่ต้องการเชื่อมต่อกับระบบ
                    </li>
                    <li>
                      <strong>pages_manage_metadata:</strong> เพื่อตั้งค่า webhook และการรับข้อความ
                      เพื่อให้ระบบสามารถรับและส่งข้อความกับผู้เช่าของคุณผ่าน Messenger
                    </li>
                    <li>
                      <strong>pages_messaging:</strong> เพื่อส่งการแจ้งเตือนอัตโนมัติ เช่น
                      แจ้งเตือนค่าเช่า, ยืนยันการชำระเงิน, แจ้งเตือนการแจ้งซ่อม
                    </li>
                  </ul>
                  
                  <div className="mt-4 p-3 bg-white rounded-lg">
                    <h4 className="font-semibold text-slate-700 mb-2">ข้อมูลที่เราเก็บจาก Facebook:</h4>
                    <ul className="list-disc list-inside text-slate-600 space-y-1">
                      <li>Page ID และชื่อ Page</li>
                      <li>Page Access Token (เก็บไว้เพื่อส่งข้อความเท่านั้น)</li>
                      <li>ข้อความที่ส่งผ่าน Messenger (เพื่อตอบกลับและบันทึกการสนทนา)</li>
                    </ul>
                  </div>

                  <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-2">✓ สิ่งที่เราไม่ทำ:</h4>
                    <ul className="list-disc list-inside text-green-700 space-y-1">
                      <li>ไม่เข้าถึงข้อมูลส่วนตัวอื่นๆ จาก Facebook Profile ของคุณ</li>
                      <li>ไม่โพสต์หรือแชร์อะไรในนาม Page ของคุณโดยไม่ได้รับอนุญาต</li>
                      <li>ไม่ขายหรือแบ่งปันข้อมูล Facebook ของคุณกับบุคคลที่สาม</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* วัตถุประสงค์การใช้ข้อมูล */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Bell className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-slate-800">วัตถุประสงค์การใช้ข้อมูล</h2>
                </div>
                <ul className="list-disc list-inside text-slate-600 space-y-2 ml-8">
                  <li>จัดการข้อมูลการเช่าห้องพัก</li>
                  <li>ประมวลผลการชำระเงิน</li>
                  <li>ส่งการแจ้งเตือนอัตโนมัติผ่าน LINE หรือ Facebook Messenger</li>
                  <li>จัดการการแจ้งซ่อมบำรุง</li>
                  <li>สร้างรายงานและใบเสร็จ</li>
                  <li>ติดต่อสื่อสารเกี่ยวกับการให้บริการ</li>
                </ul>
              </section>

              {/* การรักษาความปลอดภัย */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Lock className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-slate-800">การรักษาความปลอดภัย</h2>
                </div>
                <div className="space-y-3 ml-8">
                  <p className="text-slate-600">
                    เราใช้มาตรการรักษาความปลอดภัยที่เหมาะสมเพื่อปกป้องข้อมูลของคุณ:
                  </p>
                  <ul className="list-disc list-inside text-slate-600 space-y-1">
                    <li>เข้ารหัสข้อมูลด้วย SSL/TLS</li>
                    <li>จัดเก็บข้อมูลบน Supabase (ที่มีมาตรฐานความปลอดภัยสูง)</li>
                    <li>จำกัดการเข้าถึงข้อมูลเฉพาะผู้ที่ได้รับอนุญาต</li>
                    <li>สำรองข้อมูลเป็นประจำ</li>
                  </ul>
                </div>
              </section>

              {/* การเก็บรักษาข้อมูล */}
              <section>
                <h2 className="text-xl font-bold text-slate-800 mb-4">การเก็บรักษาข้อมูล</h2>
                <div className="space-y-3 ml-8 text-slate-600">
                  <p>เราจะเก็บข้อมูลของคุณตราบเท่าที่:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>คุณยังคงใช้บริการของเรา</li>
                    <li>จำเป็นตามกฎหมายหรือข้อกำหนดทางบัญชี</li>
                    <li>เพื่อวัตถุประสงค์ทางธุรกิจที่ชอบด้วยกฎหมาย</li>
                  </ul>
                  <p className="mt-3">
                    หากคุณยกเลิกบริการ คุณสามารถขอให้ลบข้อมูลได้ โดยข้อมูลบางส่วนอาจถูกเก็บไว้
                    เพื่อปฏิบัติตามข้อกำหนดทางกฎหมาย
                  </p>
                </div>
              </section>

              {/* สิทธิ์ของคุณ */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-6 h-6 text-blue-600" />
                  <h2 className="text-xl font-bold text-slate-800">สิทธิ์ของคุณ</h2>
                </div>
                <div className="space-y-3 ml-8">
                  <p className="text-slate-600">คุณมีสิทธิ์:</p>
                  <ul className="list-disc list-inside text-slate-600 space-y-1">
                    <li>เข้าถึงและขอสำเนาข้อมูลส่วนบุคคลของคุณ</li>
                    <li>แก้ไขข้อมูลที่ไม่ถูกต้องหรือไม่สมบูรณ์</li>
                    <li>ขอลบข้อมูลส่วนบุคคลของคุณ</li>
                    <li>คัดค้านการประมวลผลข้อมูลของคุณ</li>
                    <li>ถอนความยินยอมที่ให้ไว้</li>
                    <li>ยกเลิกการเชื่อมต่อ Facebook Page ได้ตลอดเวลา</li>
                  </ul>
                </div>
              </section>

              {/* การแบ่งปันข้อมูล */}
              <section>
                <h2 className="text-xl font-bold text-slate-800 mb-4">การแบ่งปันข้อมูล</h2>
                <div className="space-y-3 ml-8 text-slate-600">
                  <p>เราจะไม่ขายหรือแบ่งปันข้อมูลส่วนบุคคลของคุณกับบุคคลที่สาม ยกเว้น:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>เมื่อได้รับความยินยอมจากคุณ</li>
                    <li>เมื่อกฎหมายกำหนดให้ต้องเปิดเผย</li>
                    <li>กับผู้ให้บริการที่เราไว้วางใจ (เช่น Supabase, Facebook) เพื่อดำเนินงานระบบ</li>
                  </ul>
                </div>
              </section>

              {/* การเปลี่ยนแปลงนโยบาย */}
              <section>
                <h2 className="text-xl font-bold text-slate-800 mb-4">การเปลี่ยนแปลงนโยบาย</h2>
                <p className="text-slate-600 ml-8">
                  เราอาจปรับปรุงนโยบายความเป็นส่วนตัวนี้เป็นครั้งคราว การเปลี่ยนแปลงใดๆ 
                  จะมีผลทันทีที่เผยแพร่บนหน้านี้ เราจะแจ้งให้คุณทราบหากมีการเปลี่ยนแปลงสำคัญ
                </p>
              </section>

              {/* ติดต่อเรา */}
              <section className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">ติดต่อเรา</h2>
                <p className="text-slate-600 mb-3">
                  หากคุณมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัวนี้ กรุณาติดต่อเราที่:
                </p>
                <div className="space-y-2 text-slate-600">
                  <p><strong>อีเมล:</strong> support@langhorphak.com</p>
                  <p><strong>เว็บไซต์:</strong> https://langhorphak.com</p>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}