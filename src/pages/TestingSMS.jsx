import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MessageSquare, Send, CheckCircle, AlertCircle, Info, Copy } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function TestingSMS() {
  const [sending, setSending] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('0955939229');
  const [result, setResult] = useState(null);

  const handleTestSMS = async () => {
    if (!phoneNumber) {
      toast.error('กรุณากรอกเบอร์โทรศัพท์');
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const testContractId = 'test_' + Date.now();
      
      const response = await base44.functions.invoke('sendSmsOtp', {
        phoneNumber: phoneNumber,
        contractId: testContractId
      });

      console.log('Response:', response.data);

      if (response.data.success) {
        setResult({ 
          success: true, 
          message: 'ส่ง SMS สำเร็จ!',
          details: response.data
        });
        toast.success('✅ ส่ง SMS สำเร็จ');
      } else {
        setResult({ 
          success: false, 
          message: response.data.error || 'เกิดข้อผิดพลาด',
          details: response.data
        });
        toast.error('❌ ส่ง SMS ไม่สำเร็จ');
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMsg = error.response?.data?.error || error.message || 'เกิดข้อผิดพลาด';
      setResult({ 
        success: false, 
        message: errorMsg,
        details: error.response?.data || { error: error.message }
      });
      toast.error('❌ เกิดข้อผิดพลาด');
    }

    setSending(false);
  };

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">ทดสอบส่ง SMS (OTP)</h1>
            <p className="text-slate-500 mt-1">ทดสอบการส่ง SMS ผ่าน SEFSMS</p>
          </div>
          <Link to={createPageUrl('DeveloperGuide')}>
            <Button variant="outline">
              📖 คู่มือ Developer
            </Button>
          </Link>
        </div>

        {/* คำแนะนำ */}
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="w-4 h-4 text-blue-600" />
          <AlertDescription className="text-sm text-blue-800">
            <div className="space-y-2">
              <p className="font-semibold">🔧 ก่อนทดสอบ กรุณาตั้งค่า Secrets:</p>
              <ol className="list-decimal ml-4 space-y-1">
                <li>ไปที่ <strong>Dashboard → Settings → Secrets</strong></li>
                <li>เพิ่ม Secret 2 ตัว:
                  <div className="ml-4 mt-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <code className="bg-blue-100 px-2 py-1 rounded text-xs">SMS_API_KEY</code>
                      <span>=</span>
                      <code className="bg-blue-100 px-2 py-1 rounded text-xs">(Token ของคุณ)</code>
                    </div>
                    <div className="flex items-center gap-2">
                      <code className="bg-blue-100 px-2 py-1 rounded text-xs">SMS_API_SECRET</code>
                      <span>=</span>
                      <code className="bg-blue-100 px-2 py-1 rounded text-xs">(Secret ของคุณ)</code>
                    </div>
                  </div>
                </li>
                <li>บันทึกและรอ 10-30 วินาที</li>
                <li>กลับมาหน้านี้และลองทดสอบ</li>
              </ol>
            </div>
          </AlertDescription>
        </Alert>

        {/* วิธีหา API Key */}
        <Card className="bg-green-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-lg text-green-900">🔑 วิธีหา SEFSMS API Keys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-green-800">
            <ol className="list-decimal ml-5 space-y-2">
              <li>เข้า <a href="https://www.sefth.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">www.sefth.com</a></li>
              <li>Login เข้าบัญชี (หรือสมัครใหม่ถ้ายังไม่มี)</li>
              <li>ไปที่เมนู <strong>API → API Key</strong></li>
              <li>คัดลอก <strong>Token</strong> และ <strong>Secret</strong></li>
              <li>นำไปใส่ใน Dashboard → Settings → Secrets</li>
            </ol>
            <div className="bg-green-100 rounded p-3 mt-3">
              <p className="font-semibold mb-1">✅ ข้อดีของ SEFSMS:</p>
              <ul className="text-xs list-disc ml-5 space-y-1">
                <li>มี <strong>OTP API แบบ Built-in</strong> (ส่งและยืนยัน OTP อัตโนมัติ)</li>
                <li>ไม่ต้องจัดการ OTP storage เอง</li>
                <li>ส่ง SMS ภาษาไทยได้ดี</li>
                <li>ราคาถูกกว่า Twilio มาก</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* ฟอร์มทดสอบ */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              ทดสอบส่ง SMS
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>เบอร์โทรศัพท์ที่จะรับ SMS *</Label>
              <Input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="0812345678"
                maxLength={10}
              />
              <p className="text-xs text-slate-500 mt-1">
                ใส่เบอร์โทรศัพท์ไทย (ขึ้นต้น 06, 08, 09)
              </p>
            </div>

            <Button
              onClick={handleTestSMS}
              disabled={sending || !phoneNumber}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              {sending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  ทดสอบส่ง SMS
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ผลลัพธ์ */}
        {result && (
          <Alert className={result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
            {result.success ? (
              <CheckCircle className="w-4 h-4 text-green-600" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600" />
            )}
            <AlertDescription>
              <div className="space-y-2">
                <p className={result.success ? 'text-green-800 font-semibold' : 'text-red-800 font-semibold'}>
                  {result.message}
                </p>
                
                {result.details && (
                  <details className="text-xs">
                    <summary className="cursor-pointer hover:underline mb-2">
                      {result.success ? '📋 ดูรายละเอียด' : '🐛 ดูข้อมูล Error'}
                    </summary>
                    <pre className="bg-white p-3 rounded border overflow-auto max-h-60 text-xs">
                      {JSON.stringify(result.details, null, 2)}
                    </pre>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(result.details, null, 2));
                        toast.success('คัดลอก error details แล้ว');
                      }}
                    >
                      <Copy className="w-3 h-3 mr-1" />
                      คัดลอก Error
                    </Button>
                  </details>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* การแก้ปัญหา */}
        <Card className="bg-amber-50 border-amber-200">
          <CardHeader>
            <CardTitle className="text-lg text-amber-900">🔍 วิธีแก้ปัญหาที่พบบ่อย</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-amber-800">
            <div>
              <p className="font-semibold">❌ Error 401: API Key/Secret ไม่ถูกต้อง</p>
              <ul className="list-disc ml-5 mt-1 text-xs">
                <li>ตรวจสอบว่า copy Token และ Secret ครบทั้งหมด</li>
                <li>ตรวจสอบว่าไม่มีช่องว่างหน้า-หลัง</li>
                <li>ลอง generate keys ใหม่ใน SEFSMS Dashboard</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">❌ Error 402: เครดิตไม่พอ</p>
              <ul className="list-disc ml-5 mt-1 text-xs">
                <li>ตรวจสอบเครดิตใน SEFSMS Dashboard</li>
                <li>เติมเครดิต SMS</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">❌ Error 400: รหัส OTP ไม่ถูกต้อง</p>
              <ul className="list-disc ml-5 mt-1 text-xs">
                <li>ตรวจสอบว่ากรอกรหัส OTP ถูกต้อง</li>
                <li>รหัส OTP หมดอายุใน 5 นาที</li>
                <li>ลองขอรหัสใหม่</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">❌ Error 500: Internal Server Error</p>
              <ul className="list-disc ml-5 mt-1 text-xs">
                <li>ตรวจสอบว่าตั้งค่า <code className="bg-amber-100 px-1 rounded">SMS_API_KEY</code> และ <code className="bg-amber-100 px-1 rounded">SMS_API_SECRET</code> แล้ว</li>
                <li>รอ 30 วินาทีหลังตั้งค่า Secrets แล้วลองใหม่</li>
                <li>ลองรีเฟรชหน้านี้แล้วทดสอบใหม่</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Support */}
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-slate-600 mb-2">
              💡 หากยังมีปัญหา กรุณาตรวจสอบ <strong>Function Logs</strong> ใน Dashboard
            </p>
            <p className="text-xs text-slate-500">
              Dashboard → Code → Functions → sendSmsOtp → Logs
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}