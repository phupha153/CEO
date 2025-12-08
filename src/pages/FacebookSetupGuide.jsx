import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Facebook, CheckCircle2, AlertCircle, Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function FacebookSetupGuide() {
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-purple-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
          <CardContent className="p-8">
            <div className="flex items-center gap-3 mb-6">
              <Facebook className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-slate-800">คู่มือการตั้งค่า Facebook Integration</h1>
            </div>
            <p className="text-slate-500 mb-8">สำหรับการส่ง Facebook App Review และการใช้งาน Messenger</p>

            <div className="space-y-8">
              {/* Step 1 */}
              <section className="border-l-4 border-blue-500 pl-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-blue-500">ขั้นตอนที่ 1</Badge>
                  <h2 className="text-xl font-bold text-slate-800">เตรียมข้อมูลแอปพลิเคชัน</h2>
                </div>
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-slate-800 mb-2">Use Case Description</h3>
                    <p className="text-sm text-slate-600 mb-3">
                      ระบบนี้เป็นระบบจัดการหอพัก/ห้องเช่า เราใช้ Facebook Messenger เพื่อ:
                    </p>
                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 ml-4">
                      <li>ส่งการแจ้งเตือนค่าเช่าและค่าน้ำค่าไฟอัตโนมัติ</li>
                      <li>ส่งใบเสร็จรับเงินทันทีหลังชำระเงิน</li>
                      <li>รับแจ้งซ่อมและตอบกลับผ่าน Messenger</li>
                      <li>ส่งการแจ้งเตือนสำคัญเกี่ยวกับการอยู่อาศัย</li>
                    </ul>
                  </div>

                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h3 className="font-semibold text-slate-800 mb-2">🔑 สิทธิ์ที่ต้องขอ (3 อย่าง)</h3>
                    <div className="space-y-3">
                      <div className="bg-green-50 p-3 rounded border border-green-300">
                        <Badge className="bg-green-500 mb-2">จำเป็น</Badge>
                        <p className="font-semibold text-sm text-slate-700">1. pages_show_list</p>
                        <p className="text-sm text-slate-600">
                          เพื่อแสดงรายการ Facebook Pages ที่ผู้ใช้เป็นผู้ดูแล 
                          เพื่อให้เจ้าของหอพักเลือก Page ที่ต้องการเชื่อมต่อ
                        </p>
                      </div>
                      <div className="bg-green-50 p-3 rounded border border-green-300">
                        <Badge className="bg-green-500 mb-2">จำเป็น</Badge>
                        <p className="font-semibold text-sm text-slate-700">2. pages_manage_metadata</p>
                        <p className="text-sm text-slate-600">
                          เพื่อตั้งค่า webhook subscription และการรับข้อความจาก Messenger
                          เพื่อให้ระบบสามารถรับและตอบข้อความจากผู้เช่าได้
                        </p>
                      </div>
                      <div className="bg-green-50 p-3 rounded border border-green-300">
                        <Badge className="bg-green-500 mb-2">จำเป็น</Badge>
                        <p className="font-semibold text-sm text-slate-700">3. pages_utility_messaging</p>
                        <p className="text-sm text-slate-600">
                          เพื่อส่งข้อความ Utility/Transactional ที่ไม่ใช่การโฆษณา เช่น แจ้งเตือนค่าเช่า, 
                          ส่งใบเสร็จ, แจ้งสถานะการแจ้งซ่อม, แจ้งพัสดุมาถึง ด้วย Message Tags ที่เหมาะสม
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 bg-slate-100 p-3 rounded">
                      <h4 className="font-semibold text-sm text-slate-700 mb-2">ℹ️ สิทธิ์ที่ไม่จำเป็น:</h4>
                      <p className="text-xs text-slate-600">
                        ❌ pages_read_engagement - ไม่จำเป็นสำหรับการส่งข้อความ<br/>
                        ❌ business_management - ไม่จำเป็นสำหรับ Page เดียว
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Step 2 */}
              <section className="border-l-4 border-green-500 pl-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-green-500">ขั้นตอนที่ 2</Badge>
                  <h2 className="text-xl font-bold text-slate-800">เตรียม Test Account และ Demo</h2>
                </div>
                <div className="space-y-4">
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-slate-800 mb-3">สิ่งที่ต้องเตรียม:</h3>
                    <ul className="space-y-2 text-sm text-slate-600">
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>สร้าง Facebook Page จำลอง (Test Page) สำหรับทดสอบ</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>สร้าง Test User บน Facebook Developer Console</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>เพิ่ม Test User เป็น Admin ของ Test Page</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <span>เตรียมข้อมูลจำลองในระบบ (ห้องพัก, ผู้เช่า, การชำระเงิน)</span>
                      </li>
                    </ul>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h3 className="font-semibold text-slate-800 mb-3">📹 Screencast Requirements:</h3>
                    <p className="text-sm text-slate-600 mb-3">
                      ต้องอัดวิดีโอแสดงการใช้งานจริง (2-5 นาที) โดยต้องแสดง:
                    </p>
                    <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2 ml-4">
                      <li>เข้าสู่ระบบด้วย Test Account</li>
                      <li>ไปที่เมนู Settings → Facebook Settings</li>
                      <li>คลิก "เชื่อมต่อ Facebook Page"</li>
                      <li>ระบบแสดง OAuth dialog ขอสิทธิ์ pages_show_list และ pages_manage_metadata</li>
                      <li>เลือก Page จากรายการ</li>
                      <li>เชื่อมต่อสำเร็จและตั้งค่า webhook</li>
                      <li>ทดสอบส่งข้อความจำลอง</li>
                      <li>แสดงการรับข้อความและตอบกลับ</li>
                    </ol>
                  </div>
                </div>
              </section>

              {/* Step 3 */}
              <section className="border-l-4 border-orange-500 pl-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-orange-500">ขั้นตอนที่ 3</Badge>
                  <h2 className="text-xl font-bold text-slate-800">Step-by-Step Instructions</h2>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg space-y-3">
                  <p className="text-sm text-slate-600 mb-2">
                    คัดลอกข้อความนี้ไปใส่ใน Facebook App Review:
                  </p>
                  <div className="bg-white p-4 rounded border border-slate-200 relative group">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copyToClipboard(`**Test Account Instructions:**

1. Login to https://langhorphak.com with test credentials:
   - Email: test@langhorphak.com
   - Password: (provided separately)

2. Navigate to "ตั้งค่า" (Settings) from the main menu

3. Click on the "Facebook" tab

4. Click "เชื่อมต่อ Facebook Page" button

5. System will redirect to Facebook OAuth with requested permissions:
   - pages_show_list: To display user's Pages
   - pages_manage_metadata: To configure webhooks

6. After authorization, select your Page from the dropdown list

7. System will subscribe to webhooks automatically

8. Test sending a message:
   - Go to "การชำระเงิน" (Payments) page
   - Select a payment record
   - Click "ส่งใบเสร็จผ่าน Facebook"
   - Message will be sent to tenant via Messenger

9. Verify message delivery in the Page's Messenger inbox`)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <pre className="text-xs text-slate-700 whitespace-pre-wrap">
{`**Test Account Instructions:**

1. Login to https://langhorphak.com with test credentials:
   - Email: test@langhorphak.com
   - Password: (provided separately)

2. Navigate to "ตั้งค่า" (Settings) from the main menu

3. Click on the "Facebook" tab

4. Click "เชื่อมต่อ Facebook Page" button

5. System will redirect to Facebook OAuth with requested permissions:
   - pages_show_list: To display user's Pages
   - pages_manage_metadata: To configure webhooks

6. After authorization, select your Page from the dropdown list

7. System will subscribe to webhooks automatically

8. Test sending a message:
   - Go to "การชำระเงิน" (Payments) page
   - Select a payment record
   - Click "ส่งใบเสร็จผ่าน Facebook"
   - Message will be sent to tenant via Messenger

9. Verify message delivery in the Page's Messenger inbox`}
                    </pre>
                  </div>
                </div>
              </section>

              {/* Step 4 */}
              <section className="border-l-4 border-red-500 pl-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-red-500">ขั้นตอนที่ 4</Badge>
                  <h2 className="text-xl font-bold text-slate-800">API Calls ที่ต้องแสดง</h2>
                </div>
                <div className="space-y-4">
                  <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm space-y-3">
                    <div>
                      <p className="text-slate-400"># 1. Get user's Facebook Pages</p>
                      <p>GET https://graph.facebook.com/v18.0/me/accounts</p>
                    </div>
                    <div>
                      <p className="text-slate-400"># 2. Subscribe to webhooks (requires pages_manage_metadata)</p>
                      <p>POST https://graph.facebook.com/v18.0/{'{page-id}'}/subscribed_apps</p>
                      <p className="text-slate-500">Body: {`{ "subscribed_fields": ["messages", "messaging_postbacks"] }`}</p>
                    </div>
                    <div>
                      <p className="text-slate-400"># 3. Send message to user</p>
                      <p>POST https://graph.facebook.com/v18.0/{'{page-id}'}/messages</p>
                      <p className="text-slate-500">Body: {`{ "recipient": {"id": "USER_ID"}, "message": {...} }`}</p>
                    </div>
                  </div>

                  <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-amber-800 mb-2">⚠️ สำคัญ!</h3>
                        <p className="text-sm text-amber-700">
                          ต้องแสดงให้เห็นว่าเรียก API เหล่านี้ในบริบทที่ถูกต้อง ไม่ใช่แค่อยู่ในโค้ด
                          แต่ต้องแสดงการทำงานจริงในระหว่างการ demo
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Step 5 */}
              <section className="border-l-4 border-purple-500 pl-6">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-purple-500">ขั้นตอนที่ 5</Badge>
                  <h2 className="text-xl font-bold text-slate-800">Privacy Policy</h2>
                </div>
                <div className="space-y-4">
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <p className="text-sm text-slate-600 mb-3">
                      ต้องมี Privacy Policy URL ที่เข้าถึงได้สาธารณะ:
                    </p>
                    <div className="flex items-center gap-2 bg-white p-3 rounded border border-purple-200">
                      <code className="text-sm text-purple-700 flex-1">
                        https://langhorphak.com/privacy-policy
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard('https://langhorphak.com/privacy-policy')}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-green-800 mb-2">✓ Privacy Policy ต้องมี:</h3>
                        <ul className="list-disc list-inside text-sm text-green-700 space-y-1 ml-4">
                          <li>อธิบายว่าใช้ข้อมูล Facebook อะไรบ้าง</li>
                          <li>ใช้เพื่อวัตถุประสงค์อะไร</li>
                          <li>เก็บไว้นานแค่ไหน</li>
                          <li>แชร์กับใครบ้าง (ถ้ามี)</li>
                          <li>วิธีขอลบข้อมูล</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <Button 
                    className="w-full bg-purple-600 hover:bg-purple-700"
                    onClick={() => window.open('/privacy-policy', '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    ดู Privacy Policy ฉบับเต็ม
                  </Button>
                </div>
              </section>

              {/* Checklist */}
              <section className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-lg border border-blue-200">
                <h2 className="text-xl font-bold text-slate-800 mb-4">✅ Checklist ก่อนส่ง App Review</h2>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">เตรียม Use Case Description แล้ว</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">สร้าง Test Account และ Test Page แล้ว</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">อัด Screencast แสดงการใช้งานครบทุกขั้นตอนแล้ว</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">เขียน Step-by-step instructions แล้ว</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">ทดสอบ API calls ทั้ง 3 endpoint แล้ว</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">เผยแพร่ Privacy Policy บนเว็บไซต์แล้ว</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" />
                    <span className="text-sm text-slate-700">ระบุ Privacy Policy URL ใน Facebook App Settings แล้ว</span>
                  </label>
                </div>
              </section>

              {/* Links */}
              <section className="bg-slate-50 p-6 rounded-lg">
                <h2 className="text-xl font-bold text-slate-800 mb-4">🔗 ลิงก์ที่เป็นประโยชน์</h2>
                <div className="space-y-2">
                  <a 
                    href="https://developers.facebook.com/apps" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Facebook Developer Console
                  </a>
                  <a 
                    href="https://developers.facebook.com/docs/app-review" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    App Review Documentation
                  </a>
                  <a 
                    href="https://developers.facebook.com/docs/messenger-platform" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Messenger Platform Documentation
                  </a>
                </div>
              </section>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}