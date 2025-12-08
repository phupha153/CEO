import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Facebook, Send, CheckCircle2, XCircle, Loader2, MessageSquare, AlertTriangle, Copy } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "../components/shared/PageHeader";

export default function FacebookTestDemo() {
  const [formData, setFormData] = useState({
    recipientId: '',
    messageType: 'payment_reminder',
    customMessage: ''
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  const selectedBranchId = localStorage.getItem('selected_branch_id');

  // ตัวอย่างข้อความแต่ละประเภท (Utility Messages เท่านั้น)
  const messageTemplates = {
    payment_reminder: {
      title: '🔔 แจ้งเตือนค่าเช่า',
      message: `สวัสดีครับคุณ {{name}}

📌 การแจ้งเตือนค่าเช่าประจำเดือน
ห้อง: {{room_number}}
ยอดที่ต้องชำระ: {{amount}} บาท
ครบกำหนด: {{due_date}}

กรุณาชำระภายในกำหนด
ขอบคุณครับ`,
      tag: 'ACCOUNT_UPDATE'
    },
    receipt: {
      title: '✅ ใบเสร็จรับเงิน',
      message: `สวัสดีครับคุณ {{name}}

✅ รับชำระเงินเรียบร้อยแล้ว
เลขที่ใบเสร็จ: {{receipt_no}}
ยอดชำระ: {{amount}} บาท
วันที่: {{date}}

ขอบคุณที่ชำระเงินตรงเวลาครับ`,
      tag: 'POST_PURCHASE_UPDATE'
    },
    maintenance_update: {
      title: '🔧 อัปเดตการแจ้งซ่อม',
      message: `สวัสดีครับคุณ {{name}}

🔧 สถานะการแจ้งซ่อม
รายการ: {{title}}
สถานะ: {{status}}
ช่างผู้รับผิดชอบ: {{technician}}

เราจะอัปเดตอีกครั้งเมื่อมีความคืบหน้า`,
      tag: 'CONFIRMED_EVENT_UPDATE'
    },
    parcel_notification: {
      title: '📦 พัสดุมาถึง',
      message: `สวัสดีครับคุณ {{name}}

📦 มีพัสดุมาถึงแล้ว
ห้อง: {{room_number}}
บริษัทขนส่ง: {{delivery_company}}
วันที่: {{date}}

สามารถมารับได้ที่เคาน์เตอร์ครับ`,
      tag: 'SHIPPING_UPDATE'
    },
    booking_confirmation: {
      title: '🏠 ยืนยันการจองห้อง',
      message: `สวัสดีครับคุณ {{name}}

✅ ยืนยันการจองห้องพัก
ห้อง: {{room_number}}
วันเช็คอิน: {{check_in}}
วันเช็คเอาท์: {{check_out}}
เลขที่จอง: {{booking_no}}

กรุณามาพร้อมบัตรประชาชนและเงินมัดจำครับ`,
      tag: 'CONFIRMED_EVENT_UPDATE'
    }
  };

  const handleSend = async () => {
    if (!formData.recipientId) {
      toast.error('กรุณากรอก Recipient ID');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const template = messageTemplates[formData.messageType];
      const message = formData.customMessage || template.message;

      const response = await base44.functions.invoke('sendFacebookMessage', {
        recipientId: formData.recipientId,
        message: message,
        messageTag: template.tag,
        branchId: selectedBranchId
      });

      if (response.data.success) {
        setResult({ 
          success: true, 
          message: 'ส่งข้อความสำเร็จ ✅',
          details: response.data
        });
        toast.success('ส่งข้อความสำเร็จ');
      } else {
        setResult({ 
          success: false, 
          message: response.data.error || 'เกิดข้อผิดพลาด',
          details: response.data 
        });
        toast.error('ส่งข้อความล้มเหลว');
      }
    } catch (error) {
      setResult({ 
        success: false, 
        message: error.message || 'เกิดข้อผิดพลาด',
        details: error 
      });
      toast.error('เกิดข้อผิดพลาด');
    }

    setSending(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอกแล้ว');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader
        title="ทดสอบ Facebook Messaging"
        subtitle="ทดสอบการส่งข้อความผ่าน Facebook Messenger"
        icon={Facebook}
        showNotifications={false}
        showBackButton={true}
      />

      <div className="p-8 max-w-5xl mx-auto space-y-6">
        
        {/* สิทธิ์ที่ใช้ */}
        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-blue-600" />
              สิทธิ์ที่ใช้งาน
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-green-300">
                <Badge className="bg-green-500 mb-2">จำเป็น</Badge>
                <h3 className="font-bold text-slate-800 mb-1">pages_show_list</h3>
                <p className="text-xs text-slate-600">แสดงรายการ Pages ที่ผู้ใช้เป็นผู้ดูแล</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-green-300">
                <Badge className="bg-green-500 mb-2">จำเป็น</Badge>
                <h3 className="font-bold text-slate-800 mb-1">pages_manage_metadata</h3>
                <p className="text-xs text-slate-600">ตั้งค่า webhook สำหรับรับข้อความ</p>
              </div>

              <div className="bg-white p-4 rounded-lg border border-green-300">
                <Badge className="bg-green-500 mb-2">จำเป็น</Badge>
                <h3 className="font-bold text-slate-800 mb-1">pages_utility_messaging</h3>
                <p className="text-xs text-slate-600">ส่งข้อความ Utility/Transactional</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-2">ℹ️ สิทธิ์ที่ไม่จำเป็น:</h3>
              <div className="space-y-1 text-sm text-slate-600">
                <p>❌ pages_read_engagement - ไม่จำเป็นสำหรับการส่งข้อความ</p>
                <p>❌ business_management - ไม่จำเป็นสำหรับ Page เดียว</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Message Types */}
        <Card className="shadow-xl border-slate-200">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50">
            <CardTitle>📨 ประเภทข้อความ Utility ที่ส่งได้</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(messageTemplates).map(([key, template]) => (
                <div key={key} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-2">{template.title}</h3>
                  <Badge variant="outline" className="mb-2 text-xs">{template.tag}</Badge>
                  <pre className="text-xs text-slate-600 bg-white p-3 rounded border whitespace-pre-wrap">
                    {template.message.substring(0, 100)}...
                  </pre>
                </div>
              ))}
            </div>

            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-800 mb-2">⚠️ Message Tags ที่อนุญาต:</h3>
                  <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                    <li><code className="bg-white px-1 rounded">ACCOUNT_UPDATE</code> - อัปเดตบัญชี, ค่าเช่า</li>
                    <li><code className="bg-white px-1 rounded">POST_PURCHASE_UPDATE</code> - ใบเสร็จ, ยืนยันการชำระ</li>
                    <li><code className="bg-white px-1 rounded">CONFIRMED_EVENT_UPDATE</code> - สถานะการแจ้งซ่อม</li>
                    <li><code className="bg-white px-1 rounded">SHIPPING_UPDATE</code> - แจ้งพัสดุมาถึง</li>
                  </ul>
                  <p className="text-xs text-amber-600 mt-2">
                    ❌ <strong>ห้ามใช้:</strong> โฆษณา, โปรโมชั่น, ข้อความทั่วไป
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Form */}
        <Card className="shadow-2xl border-2 border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="flex items-center gap-2">
              <Send className="w-6 h-6 text-blue-600" />
              ทดสอบส่งข้อความ Utility Message
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 p-6">
            <div>
              <Label>Facebook User ID (PSID) *</Label>
              <Input
                value={formData.recipientId}
                onChange={(e) => setFormData({ ...formData, recipientId: e.target.value })}
                placeholder="1234567890123456"
              />
              <p className="text-xs text-slate-500 mt-1">
                ดู PSID ได้จากฟิลด์ facebook_user_id ในหน้าผู้เช่า
              </p>
            </div>

            <div>
              <Label>ประเภทข้อความ</Label>
              <Select
                value={formData.messageType}
                onValueChange={(value) => setFormData({ ...formData, messageType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment_reminder">🔔 แจ้งเตือนค่าเช่า</SelectItem>
                  <SelectItem value="receipt">✅ ใบเสร็จรับเงิน</SelectItem>
                  <SelectItem value="maintenance_update">🔧 อัปเดตการแจ้งซ่อม</SelectItem>
                  <SelectItem value="parcel_notification">📦 พัสดุมาถึง</SelectItem>
                  <SelectItem value="booking_confirmation">🏠 ยืนยันการจองห้อง</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>ข้อความ (แก้ไขได้)</Label>
              <Textarea
                value={formData.customMessage || messageTemplates[formData.messageType].message}
                onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                rows={8}
                className="font-mono text-sm"
              />
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="text-xs">
                  Message Tag: {messageTemplates[formData.messageType].tag}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(formData.customMessage || messageTemplates[formData.messageType].message)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>

            <Button
              onClick={handleSend}
              disabled={sending || !formData.recipientId}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  ส่งข้อความทดสอบ
                </>
              )}
            </Button>

            {result && (
              <Alert className={result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                <AlertDescription>
                  <div className="flex items-start gap-2">
                    {result.success ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={result.success ? 'text-green-800 font-semibold' : 'text-red-800 font-semibold'}>
                        {result.message}
                      </p>
                      {result.details && (
                        <details className="mt-2">
                          <summary className="text-xs cursor-pointer">ดูรายละเอียด</summary>
                          <pre className="mt-2 bg-white p-2 rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* คำอธิบาย pages_utility_messaging */}
        <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle>📋 นโยบาย pages_utility_messaging</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-white p-4 rounded-lg">
              <h3 className="font-semibold text-slate-800 mb-2">✅ ข้อความที่ส่งได้:</h3>
              <ul className="list-disc list-inside text-sm text-slate-600 space-y-1">
                <li>แจ้งเตือนที่เกี่ยวกับธุรกรรม (ค่าเช่า, ค่าน้ำค่าไฟ)</li>
                <li>ใบเสร็จและการยืนยันการชำระเงิน</li>
                <li>อัปเดตสถานะคำขอบริการ (แจ้งซ่อม)</li>
                <li>การแจ้งเตือนที่เกี่ยวข้องกับบัญชี</li>
                <li>การแจ้งเตือนการจัดส่ง (พัสดุ)</li>
              </ul>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <h3 className="font-semibold text-red-800 mb-2">❌ ข้อความที่ห้ามส่ง:</h3>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                <li>ข้อความโฆษณาหรือโปรโมชั่น</li>
                <li>ข้อความทักทายทั่วไป</li>
                <li>การตลาดหรือข้อเสนอพิเศษ</li>
                <li>เนื้อหาที่ไม่เกี่ยวข้องกับธุรกรรม</li>
              </ul>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">📖 วัตถุประสงค์การใช้งาน:</h3>
              <p className="text-sm text-blue-700">
                แอพนี้ใช้ pages_utility_messaging เพื่อส่งการแจ้งเตือนที่เป็นประโยชน์และจำเป็น
                ต่อการดำรงชีพของผู้เช่า ไม่ใช่เพื่อการตลาด ทุกข้อความที่ส่งจะมีความเกี่ยวข้อง
                โดยตรงกับธุรกรรมหรือบริการที่ผู้เช่าได้รับ เช่น การแจ้งค่าใช้จ่าย การยืนยัน
                การชำระเงิน การอัปเดตสถานะการแจ้งซ่อม หรือการแจ้งพัสดุมาถึง
              </p>
            </div>
          </CardContent>
        </Card>

        {/* วิธีหา PSID */}
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <h3 className="font-semibold text-green-900 mb-3">💡 วิธีหา Facebook User ID (PSID):</h3>
            <ol className="list-decimal list-inside text-sm text-green-800 space-y-2">
              <li>ให้ผู้เช่าส่งข้อความมาที่ Facebook Page ของหอพัก</li>
              <li>ระบบ Webhook จะรับ PSID อัตโนมัติ</li>
              <li>PSID จะถูกบันทึกใน Tenant → facebook_user_id</li>
              <li>ดูได้จากหน้า "ผู้เช่า" หรือ Database</li>
            </ol>
            <div className="mt-3 bg-white p-3 rounded border border-green-200">
              <p className="text-xs text-green-700">
                ตัวอย่าง PSID: <code className="bg-green-100 px-2 py-1 rounded">1234567890123456</code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* API Documentation */}
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader>
            <CardTitle>🔧 API Endpoint ที่จะถูกเรียกใช้</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="bg-slate-900 text-green-400 p-4 rounded-lg font-mono text-sm space-y-3">
              <div>
                <p className="text-slate-400"># Send utility message with message tag</p>
                <p className="text-white">POST</p>
                <p>https://graph.facebook.com/v18.0/{'{page-id}'}/messages</p>
              </div>
              <div className="text-xs text-slate-500">
                <p>Body:</p>
                <pre className="mt-1 text-yellow-400">{`{
  "recipient": { "id": "PSID" },
  "messaging_type": "MESSAGE_TAG",
  "message": { "text": "..." },
  "tag": "ACCOUNT_UPDATE"
}`}</pre>
              </div>
            </div>

            <div className="mt-4 bg-blue-50 p-3 rounded border border-blue-200">
              <p className="text-sm text-blue-800">
                💡 <strong>Message Tag</strong> บอก Facebook ว่าข้อความนี้เป็นประเภทใด 
                (เช่น ACCOUNT_UPDATE, POST_PURCHASE_UPDATE) ซึ่งจะทำให้สามารถส่งข้อความ
                ได้นอกเหนือจาก 24 ชั่วโมง Standard Messaging Window
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Compliance */}
        <Card className="bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-red-900 mb-2">⚠️ การปฏิบัติตามนโยบาย</h3>
                <p className="text-sm text-red-800 mb-3">
                  เราตกลงที่จะใช้ pages_utility_messaging เฉพาะสำหรับ:
                </p>
                <ul className="list-disc list-inside text-sm text-red-700 space-y-1 ml-4">
                  <li>ข้อความที่เกี่ยวข้องกับธุรกรรมจริงที่เกิดขึ้น</li>
                  <li>ข้อความที่ผู้ใช้คาดหวังจะได้รับ (เช่น แจ้งค่าเช่า, ใบเสร็จ)</li>
                  <li>ข้อความที่ไม่มีเนื้อหาทางการตลาดหรือโฆษณา</li>
                  <li>ข้อความที่ใช้ Message Tag ที่ถูกต้องตามนโยบาย Facebook</li>
                </ul>
                <p className="text-xs text-red-600 mt-3">
                  🚫 หากฝ่าฝืน Facebook จะระงับสิทธิ์หรือแบน App ได้
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}