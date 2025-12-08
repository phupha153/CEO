import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Video, CheckCircle2, Clock, AlertTriangle, Copy, Download, Play, Pause } from "lucide-react";
import { toast } from "sonner";

export default function FacebookScreencastGuide() {
  const [copiedStep, setCopiedStep] = useState(null);

  const copyScript = (text, stepNumber) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(stepNumber);
    toast.success('คัดลอกสคริปต์แล้ว');
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const fullScript = `สวัสดีครับ วันนี้ผมจะแสดงการใช้งาน Facebook Integration ในระบบจัดการหอพัก

[หน้า Login]
ผมจะเริ่มจาก Login เข้าสู่ระบบด้วย test account

[กรอก Email และ Password แล้วกด Login]

[หน้า Dashboard]
เข้าสู่ระบบสำเร็จแล้ว ตอนนี้ผมจะไปที่เมนู "ตั้งค่า"

[คลิกเมนู Settings]

[หน้า Settings]
อยู่ในหน้าตั้งค่าแล้ว ผมจะเลือกแท็บ "Facebook"

[คลิกแท็บ Facebook]

[แสดงหน้า Facebook Settings]
ตอนนี้ยังไม่ได้เชื่อมต่อ Facebook Page ผมจะคลิกปุ่ม "เชื่อมต่อ Facebook Page"

[คลิกปุ่ม "เชื่อมต่อ Facebook Page"]

[Facebook OAuth Dialog ปรากฏ]
ระบบกำลังขอสิทธิ์ 2 อย่าง:
1. pages_show_list - เพื่อแสดงรายการ Pages ที่ผมเป็นผู้ดูแล
2. pages_manage_metadata - เพื่อตั้งค่า webhook สำหรับรับข้อความ

ผมจะกดยืนยันเพื่ออนุญาต

[คลิก Continue หรือ Authorize]

[กลับมาที่หน้า Settings - แสดงรายการ Pages]
เชื่อมต่อสำเร็จแล้ว ตอนนี้เห็นรายการ Facebook Pages ของผม
ผมจะเลือก Page ที่ต้องการ

[เลือก Page จาก Dropdown]

[แสดงสถานะ "เชื่อมต่อสำเร็จ"]
ระบบได้ตั้งค่า webhook subscription แล้ว พร้อมรับข้อความจาก Messenger

[ไปที่เมนู "การชำระเงิน"]
ตอนนี้ผมจะทดสอบส่งข้อความผ่าน Facebook Messenger

[เลือก Payment record หนึ่ง]
[คลิกปุ่ม "ส่งใบเสร็จผ่าน Facebook"]

[แสดง Loading]
กำลังส่งข้อความ...

[แสดง Success message]
ส่งข้อความสำเร็จ ผมจะเปิด Messenger เพื่อตรวจสอบ

[เปิดแท็บใหม่ไปที่ Facebook Page Messenger]
[แสดงข้อความที่ส่งไปในกล่องข้อความ]

เห็นข้อความที่ส่งไปแล้ว พร้อมใบเสร็จ

ระบบทำงานสมบูรณ์ ขอบคุณครับ`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-purple-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <Video className="w-8 h-8 text-red-600" />
              <h1 className="text-3xl font-bold text-slate-800">คู่มือการถ่าย Screencast</h1>
            </div>
            <p className="text-slate-500 mb-8">สำหรับส่ง Facebook App Review</p>

            <div className="space-y-8">
              {/* เตรียมตัว */}
              <section className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-xl border border-blue-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-blue-600" />
                  ก่อนเริ่มถ่าย
                </h2>
                <div className="space-y-3">
                  <div className="bg-white p-4 rounded-lg">
                    <h3 className="font-semibold text-slate-800 mb-2">🎬 เครื่องมือที่แนะนำ:</h3>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong>Windows:</strong> OBS Studio (ฟรี) หรือ Loom
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong>Mac:</strong> QuickTime Player (มีในเครื่องแล้ว) หรือ Loom
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong>Online:</strong> Loom.com (ง่ายที่สุด - ถ่ายผ่าน browser)
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-amber-800 mb-2">⚠️ ข้อกำหนด:</h3>
                        <ul className="list-disc list-inside text-sm text-amber-700 space-y-1">
                          <li>ความยาว: <strong>2-5 นาที</strong></li>
                          <li>ความละเอียด: <strong>1280x720 ขึ้นไป</strong></li>
                          <li>รูปแบบ: MP4, MOV, หรือ WebM</li>
                          <li>ขนาดไฟล์: <strong>ไม่เกิน 100 MB</strong></li>
                          <li>เสียงพูด: <strong>ไม่จำเป็น</strong> (แต่จะดีกว่า)</li>
                          <li>แสดง: UI ทั้งหมด และ API calls</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="font-semibold text-green-800 mb-2">✓ Checklist ก่อนเริ่มถ่าย:</h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4" />
                        <span className="text-sm text-green-700">เตรียม Test Account พร้อม Test Page แล้ว</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4" />
                        <span className="text-sm text-green-700">เพิ่มข้อมูลจำลอง (ห้องพัก, ผู้เช่า, การชำระเงิน) แล้ว</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4" />
                        <span className="text-sm text-green-700">ทดสอบ flow ทั้งหมด 1 รอบก่อนถ่ายจริง</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4" />
                        <span className="text-sm text-green-700">เปิด Developer Tools (F12) ไว้เพื่อแสดง Network calls</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" className="w-4 h-4" />
                        <span className="text-sm text-green-700">ปิด notification และเสียงรบกวนทั้งหมด</span>
                      </label>
                    </div>
                  </div>
                </div>
              </section>

              {/* สคริปต์การถ่าย */}
              <section>
                <h2 className="text-xl font-bold text-slate-800 mb-4">📝 สคริปต์การถ่ายทีละขั้นตอน</h2>
                
                {/* Step 1 */}
                <div className="mb-6 border-l-4 border-blue-500 pl-6 bg-blue-50/50 p-4 rounded-r-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-blue-500">0:00-0:30</Badge>
                      <h3 className="font-bold text-slate-800">เริ่มต้น - Login</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyScript('สวัสดีครับ วันนี้ผมจะแสดงการใช้งาน Facebook Integration ในระบบจัดการหอพัก\n\nผมจะเริ่มจาก Login เข้าสู่ระบบด้วย test account', 1)}
                      className="text-blue-600"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedStep === 1 && <span className="ml-1 text-xs">✓</span>}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700 font-medium">พูด:</p>
                    <div className="bg-white p-3 rounded border border-blue-200">
                      <p className="text-sm text-slate-600">
                        "สวัสดีครับ วันนี้ผมจะแสดงการใช้งาน Facebook Integration ในระบบจัดการหอพัก<br/>
                        ผมจะเริ่มจาก Login เข้าสู่ระบบด้วย test account"
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mt-3">ทำ:</p>
                    <ul className="list-disc list-inside text-sm text-slate-600 ml-4 space-y-1">
                      <li>เปิด Browser (แนะนำ Chrome)</li>
                      <li>ไปที่ URL ของแอพ</li>
                      <li>กรอก Email ของ Test Account</li>
                      <li>กรอก Password</li>
                      <li>คลิก "เข้าสู่ระบบ"</li>
                    </ul>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="mb-6 border-l-4 border-green-500 pl-6 bg-green-50/50 p-4 rounded-r-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500">0:30-1:00</Badge>
                      <h3 className="font-bold text-slate-800">ไปหน้า Settings</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyScript('เข้าสู่ระบบสำเร็จแล้ว ตอนนี้ผมจะไปที่เมนู "ตั้งค่า" เพื่อตั้งค่า Facebook', 2)}
                      className="text-green-600"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedStep === 2 && <span className="ml-1 text-xs">✓</span>}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700 font-medium">พูด:</p>
                    <div className="bg-white p-3 rounded border border-green-200">
                      <p className="text-sm text-slate-600">
                        "เข้าสู่ระบบสำเร็จแล้ว ตอนนี้ผมจะไปที่เมนู 'ตั้งค่า' เพื่อตั้งค่า Facebook"
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mt-3">ทำ:</p>
                    <ul className="list-disc list-inside text-sm text-slate-600 ml-4 space-y-1">
                      <li>คลิกเมนู "ตั้งค่า" (Settings) จาก Sidebar</li>
                      <li>รอให้หน้า Settings โหลด</li>
                      <li><strong>เปิด Developer Tools (F12)</strong> → แท็บ Network</li>
                      <li>Filter เฉพาะ "Fetch/XHR"</li>
                    </ul>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="mb-6 border-l-4 border-purple-500 pl-6 bg-purple-50/50 p-4 rounded-r-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-500">1:00-1:30</Badge>
                      <h3 className="font-bold text-slate-800">เลือกแท็บ Facebook</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyScript('อยู่ในหน้าตั้งค่าแล้ว ผมจะเลือกแท็บ "Facebook" เพื่อเชื่อมต่อ Page', 3)}
                      className="text-purple-600"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedStep === 3 && <span className="ml-1 text-xs">✓</span>}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700 font-medium">พูด:</p>
                    <div className="bg-white p-3 rounded border border-purple-200">
                      <p className="text-sm text-slate-600">
                        "อยู่ในหน้าตั้งค่าแล้ว ผมจะเลือกแท็บ 'Facebook' เพื่อเชื่อมต่อ Page"
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mt-3">ทำ:</p>
                    <ul className="list-disc list-inside text-sm text-slate-600 ml-4 space-y-1">
                      <li>คลิกแท็บ "Facebook"</li>
                      <li><strong>ให้เห็น Developer Tools</strong> ในหน้าจอ</li>
                      <li>แสดงปุ่ม "เชื่อมต่อ Facebook Page"</li>
                    </ul>
                  </div>
                </div>

                {/* Step 4 - สำคัญที่สุด */}
                <div className="mb-6 border-l-4 border-red-500 pl-6 bg-red-50/50 p-4 rounded-r-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-red-500">1:30-2:30</Badge>
                      <h3 className="font-bold text-slate-800">🔥 OAuth & API Calls (สำคัญที่สุด!)</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyScript('ตอนนี้ยังไม่ได้เชื่อมต่อ Facebook Page ผมจะคลิกปุ่ม "เชื่อมต่อ Facebook Page" ระบบจะขอสิทธิ์ pages_show_list และ pages_manage_metadata', 4)}
                      className="text-red-600"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedStep === 4 && <span className="ml-1 text-xs">✓</span>}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-red-100 p-3 rounded border border-red-300 mb-3">
                      <p className="text-sm text-red-800 font-bold">
                        ⚠️ ส่วนนี้สำคัญที่สุด! Facebook จะดูว่าคุณเรียก API จริงหรือไม่
                      </p>
                    </div>
                    
                    <p className="text-sm text-slate-700 font-medium">พูด:</p>
                    <div className="bg-white p-3 rounded border border-red-200">
                      <p className="text-sm text-slate-600">
                        "ตอนนี้ยังไม่ได้เชื่อมต่อ Facebook Page ผมจะคลิกปุ่ม 'เชื่อมต่อ Facebook Page'<br/>
                        ระบบจะขอสิทธิ์ 3 อย่าง:<br/>
                        1. pages_show_list - เพื่อแสดงรายการ Pages<br/>
                        2. pages_manage_metadata - เพื่อตั้งค่า webhook<br/>
                        3. pages_utility_messaging - เพื่อส่งข้อความ Utility/Transactional"
                      </p>
                    </div>
                    
                    <p className="text-sm text-slate-700 font-medium mt-3">ทำ:</p>
                    <ul className="list-disc list-inside text-sm text-slate-600 ml-4 space-y-1">
                      <li>คลิกปุ่ม "เชื่อมต่อ Facebook Page"</li>
                      <li><strong>ชะลอ 2 วินาที</strong> - ให้เห็น Facebook OAuth Dialog</li>
                      <li><strong>แสดงให้ชัดเจน</strong> ว่าขอสิทธิ์อะไรบ้าง</li>
                      <li>คลิก "Continue" หรือ "Authorize"</li>
                      <li><strong>รอให้ redirect กลับมา</strong></li>
                      <li><strong>ใน Developer Tools → Network:</strong></li>
                      <li className="ml-6">→ ต้องเห็น <code className="bg-slate-800 text-green-400 px-1 rounded">GET /me/accounts</code></li>
                      <li className="ml-6">→ ต้องเห็น <code className="bg-slate-800 text-green-400 px-1 rounded">POST /{'{page-id}'}/subscribed_apps</code></li>
                      <li><strong>เลื่อนดู Network calls</strong> ให้ชัดเจน (ซูมเข้าถ้าจำเป็น)</li>
                    </ul>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="mb-6 border-l-4 border-orange-500 pl-6 bg-orange-50/50 p-4 rounded-r-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-orange-500">2:30-3:30</Badge>
                      <h3 className="font-bold text-slate-800">เลือก Page และตั้งค่า</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyScript('เชื่อมต่อสำเร็จแล้ว ตอนนี้เห็นรายการ Facebook Pages ของผม ผมจะเลือก Page ที่ต้องการ', 5)}
                      className="text-orange-600"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedStep === 5 && <span className="ml-1 text-xs">✓</span>}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700 font-medium">พูด:</p>
                    <div className="bg-white p-3 rounded border border-orange-200">
                      <p className="text-sm text-slate-600">
                        "เชื่อมต่อสำเร็จแล้ว ตอนนี้เห็นรายการ Facebook Pages ของผม<br/>
                        ผมจะเลือก Page ที่ต้องการใช้งาน"
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mt-3">ทำ:</p>
                    <ul className="list-disc list-inside text-sm text-slate-600 ml-4 space-y-1">
                      <li>เลือก Page จาก Dropdown</li>
                      <li>คลิก "บันทึก" หรือ "เชื่อมต่อ"</li>
                      <li><strong>แสดง Success message</strong></li>
                      <li>ใน Network ต้องเห็น webhook subscription call</li>
                    </ul>
                  </div>
                </div>

                {/* Step 6 */}
                <div className="mb-6 border-l-4 border-indigo-500 pl-6 bg-indigo-50/50 p-4 rounded-r-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-indigo-500">3:30-4:30</Badge>
                      <h3 className="font-bold text-slate-800">ทดสอบส่งข้อความ</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyScript('ตอนนี้ผมจะทดสอบส่งข้อความผ่าน Facebook Messenger โดยไปที่หน้าการชำระเงิน และส่งใบเสร็จให้ผู้เช่า', 6)}
                      className="text-indigo-600"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedStep === 6 && <span className="ml-1 text-xs">✓</span>}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700 font-medium">พูด:</p>
                    <div className="bg-white p-3 rounded border border-indigo-200">
                      <p className="text-sm text-slate-600">
                        "ตอนนี้ผมจะทดสอบส่งข้อความผ่าน Facebook Messenger<br/>
                        โดยไปที่หน้าการชำระเงิน และส่งใบเสร็จให้ผู้เช่า"
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mt-3">ทำ:</p>
                    <ul className="list-disc list-inside text-sm text-slate-600 ml-4 space-y-1">
                      <li>คลิกเมนู "การชำระเงิน"</li>
                      <li>เลือก Payment record ที่มีสถานะ "paid"</li>
                      <li>คลิกปุ่ม "ส่งใบเสร็จผ่าน Facebook"</li>
                      <li><strong>ใน Network:</strong> ต้องเห็น <code className="bg-slate-800 text-green-400 px-1 rounded">POST /{'{page-id}'}/messages</code></li>
                      <li>แสดง Success message</li>
                    </ul>
                  </div>
                </div>

                {/* Step 7 */}
                <div className="mb-6 border-l-4 border-pink-500 pl-6 bg-pink-50/50 p-4 rounded-r-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-pink-500">4:30-5:00</Badge>
                      <h3 className="font-bold text-slate-800">ยืนยันการส่งข้อความ</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyScript('ส่งข้อความสำเร็จแล้ว ผมจะเปิด Messenger เพื่อตรวจสอบว่าข้อความส่งไปถึงจริง', 7)}
                      className="text-pink-600"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedStep === 7 && <span className="ml-1 text-xs">✓</span>}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700 font-medium">พูด:</p>
                    <div className="bg-white p-3 rounded border border-pink-200">
                      <p className="text-sm text-slate-600">
                        "ส่งข้อความสำเร็จแล้ว ผมจะเปิด Messenger เพื่อตรวจสอบว่าข้อความส่งไปถึงจริง"
                      </p>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mt-3">ทำ:</p>
                    <ul className="list-disc list-inside text-sm text-slate-600 ml-4 space-y-1">
                      <li><strong>เปิดแท็บใหม่</strong> → ไปที่ Facebook Page</li>
                      <li>คลิก "Inbox" หรือ "ข้อความ"</li>
                      <li><strong>แสดงข้อความที่เพิ่งส่งไป</strong> ในกล่องข้อความ</li>
                      <li>ซูมเข้าให้เห็นชัดเจน</li>
                      <li><strong>ทดสอบตอบกลับ</strong> (ถ้ามี webhook handler)</li>
                    </ul>
                  </div>
                </div>

                {/* Step 8 */}
                <div className="mb-6 border-l-4 border-green-500 pl-6 bg-green-50/50 p-4 rounded-r-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-500">4:45-5:00</Badge>
                      <h3 className="font-bold text-slate-800">สรุป</h3>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyScript('เห็นข้อความที่ส่งไปแล้ว พร้อมใบเสร็จ ระบบทำงานสมบูรณ์ ขอบคุณครับ', 8)}
                      className="text-green-600"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedStep === 8 && <span className="ml-1 text-xs">✓</span>}
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-slate-700 font-medium">พูด:</p>
                    <div className="bg-white p-3 rounded border border-green-200">
                      <p className="text-sm text-slate-600">
                        "เห็นข้อความที่ส่งไปแล้ว พร้อมใบเสร็จ<br/>
                        ระบบทำงานสมบูรณ์ ขอบคุณครับ"
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* API Calls Checklist */}
              <section className="bg-gradient-to-br from-slate-50 to-slate-100 p-6 rounded-xl border border-slate-300">
                <h2 className="text-xl font-bold text-slate-800 mb-4">✅ API Calls ที่ต้องแสดงในวิดีโอ</h2>
                <div className="space-y-3">
                  <div className="bg-white p-3 rounded border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-mono text-xs">GET</Badge>
                      <code className="text-sm text-slate-700">graph.facebook.com/v18.0/me/accounts</code>
                    </div>
                    <p className="text-xs text-slate-500 ml-14">→ ใช้ pages_show_list เพื่อดึงรายการ Pages</p>
                  </div>

                  <div className="bg-white p-3 rounded border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-mono text-xs bg-blue-50">POST</Badge>
                      <code className="text-sm text-slate-700">graph.facebook.com/v18.0/{'{page-id}'}/subscribed_apps</code>
                    </div>
                    <p className="text-xs text-slate-500 ml-14">→ ใช้ pages_manage_metadata เพื่อตั้งค่า webhook</p>
                  </div>

                  <div className="bg-white p-3 rounded border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="font-mono text-xs bg-green-50">POST</Badge>
                      <code className="text-sm text-slate-700">graph.facebook.com/v18.0/{'{page-id}'}/messages</code>
                    </div>
                    <p className="text-xs text-slate-500 ml-14">→ ส่งข้อความไปยัง Messenger</p>
                  </div>
                </div>

                <div className="mt-4 bg-red-50 p-3 rounded border border-red-200">
                  <p className="text-sm text-red-800">
                    <strong>🔥 สำคัญมาก:</strong> ต้องเห็น API calls เหล่านี้ใน Developer Tools → Network tab
                    <br/>Facebook จะตรวจสอบว่าคุณเรียกใช้ API จริงหรือไม่!
                  </p>
                </div>
              </section>

              {/* สคริปต์เต็ม */}
              <section className="bg-slate-900 text-green-400 p-6 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">📄 สคริปต์เต็ม (คัดลอกได้)</h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      copyScript(fullScript, 'full');
                      setCopiedStep('full');
                    }}
                    className="text-green-400 hover:text-green-300"
                  >
                    <Copy className="w-4 h-4 mr-1" />
                    {copiedStep === 'full' ? 'คัดลอกแล้ว ✓' : 'คัดลอกทั้งหมด'}
                  </Button>
                </div>
                <pre className="text-sm whitespace-pre-wrap leading-relaxed">
{fullScript}
                </pre>
              </section>

              {/* Tips */}
              <section className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-xl border border-blue-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">💡 Tips สำหรับการถ่าย</h2>
                <ul className="space-y-3 text-sm text-slate-700">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>ถ่ายหน้าจอเต็ม</strong> - แต่ปิด notification, browser tabs อื่นๆ</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>เคลื่อนเมาส์ช้าๆ</strong> - ให้ผู้ดูเห็นว่าคลิกที่ไหน</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Zoom Developer Tools</strong> - ให้เห็น API endpoints ชัดเจน (Ctrl/Cmd + Plus)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>หยุดรอ 1-2 วินาที</strong> หลัง API call แต่ละครั้ง</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>พูดภาษาอังกฤษ</strong> หรือมี subtitle (Facebook reviewer อาจไม่เข้าใจไทย)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <span><strong>อย่าตัดต่อ</strong> - ถ่ายต่อเนื่อง 1 take (ถ้าผิดพลาดก็ถ่ายใหม่)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <span><strong>ถ้าไม่มีเสียง:</strong> ใส่ Text Overlay อธิบายแต่ละขั้นตอน</span>
                  </li>
                </ul>
              </section>

              {/* Upload Instructions */}
              <section className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-xl border border-purple-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">📤 วิธีอัปโหลดวิดีโอ</h2>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-slate-800 mb-2">Option 1: อัปโหลดไปที่ YouTube (แนะนำ)</h3>
                    <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1 ml-4">
                      <li>อัปโหลดวิดีโอเป็น <strong>Unlisted</strong> (ไม่ใช่ Private)</li>
                      <li>คัดลอก YouTube URL</li>
                      <li>วางใน Facebook App Review submission</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-semibold text-slate-800 mb-2">Option 2: อัปโหลดตรงใน Facebook</h3>
                    <ol className="list-decimal list-inside text-sm text-slate-600 space-y-1 ml-4">
                      <li>ไปที่ App Review → Permissions → Request</li>
                      <li>คลิก "Add Screencast"</li>
                      <li>อัปโหลดไฟล์วิดีโอโดยตรง (ไม่เกิน 100 MB)</li>
                    </ol>
                  </div>

                  <div className="bg-purple-100 p-3 rounded border border-purple-300">
                    <p className="text-sm text-purple-800">
                      💡 <strong>Loom.com</strong> จะให้ URL แชร์ได้ทันที - ใช้งานง่ายที่สุด!
                    </p>
                  </div>
                </div>
              </section>

              {/* Final Checklist */}
              <section className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-xl border border-green-300">
                <h2 className="text-xl font-bold text-slate-800 mb-4">✅ Checklist ก่อนส่ง</h2>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">วิดีโอความยาว 2-5 นาที</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">แสดง Login flow</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">แสดง Facebook OAuth dialog</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">แสดงสิทธิ์ที่ขอ (pages_show_list, pages_manage_metadata)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">เห็น API calls ใน Developer Tools → Network</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">แสดงการเลือก Page</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">แสดงการส่งข้อความทดสอบ</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">เปิด Messenger ยืนยันว่าข้อความส่งถึง</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">วิดีโอชัดเจน ไม่สั่น ไม่เบลอ</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">บันทึกเป็น MP4 หรือ MOV</span>
                  </label>
                </div>
              </section>

              {/* Download Script */}
              <div className="flex gap-3">
                <Button 
                  className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  onClick={() => {
                    const blob = new Blob([fullScript], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'facebook-screencast-script.txt';
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success('ดาวน์โหลดสคริปต์แล้ว');
                  }}
                >
                  <Download className="w-4 h-4 mr-2" />
                  ดาวน์โหลดสคริปต์เต็ม
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}