import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, CheckCircle, Send, Wrench, CreditCard, UserPlus, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

export default function FacebookTestDemo() {
  const [currentStep, setCurrentStep] = useState(0);

  const testSteps = [
    {
      step: 1,
      title: "เริ่มต้นการสนทนา",
      description: "ผู้เช่าส่งข้อความไปที่ Facebook Page ของหอพัก",
      userMessage: "สวัสดีครับ",
      botResponse: "👋 สวัสดีค่ะ กรุณาลงทะเบียนก่อนใช้งาน\n\nพิมพ์ \"เบอร์โทรศัพท์\" (เช่น 0812345678)\nหรือพิมพ์ \"ชื่อ-นามสกุล\" เพื่อยืนยันตัวตนค่ะ"
    },
    {
      step: 2,
      title: "ลงทะเบียนด้วยเบอร์โทร",
      description: "ผู้เช่าพิมพ์เบอร์โทรศัพท์เพื่อลงทะเบียน",
      userMessage: "0812345678",
      botResponse: "✅ ลงทะเบียนสำเร็จ!\nยินดีต้อนรับคุณ สมชาย ใจดี"
    },
    {
      step: 3,
      title: "แจ้งซ่อม",
      description: "ผู้เช่าแจ้งปัญหาการซ่อมบำรุง",
      userMessage: "แจ้งซ่อม แอร์ไม่เย็น",
      botResponse: "✅ รับเรื่องแจ้งซ่อมแล้ว\nหัวข้อ: แอร์ไม่เย็น - ต้องตรวจสอบ"
    },
    {
      step: 4,
      title: "ส่งสลิปชำระเงิน",
      description: "ผู้เช่าส่งรูปสลิปเพื่อแจ้งชำระค่าเช่า",
      userMessage: "[รูปสลิปโอนเงิน]",
      botResponse: "✅ ตรวจสอบสลิปสำเร็จ! ยอด 5,000 บาท\nบันทึกการชำระเงินเรียบร้อยแล้วค่ะ"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-4">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">
            Facebook Messenger Integration Demo
          </h1>
          <p className="text-slate-600">
            ระบบจัดการหอพัก - ฟีเจอร์ Messenger สำหรับผู้เช่า
          </p>
        </div>

        {/* Features Overview */}
        <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              ฟีเจอร์ที่รองรับ
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl">
                <UserPlus className="w-6 h-6 text-blue-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800">ลงทะเบียนผู้เช่า</h3>
                  <p className="text-sm text-slate-600">ยืนยันตัวตนด้วยเบอร์โทรหรือชื่อ</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-xl">
                <Wrench className="w-6 h-6 text-orange-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800">แจ้งซ่อม</h3>
                  <p className="text-sm text-slate-600">แจ้งปัญหาผ่าน Messenger</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-xl">
                <CreditCard className="w-6 h-6 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-800">ชำระเงิน</h3>
                  <p className="text-sm text-slate-600">ส่งสลิปและตรวจสอบอัตโนมัติ</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Test Steps Demo */}
        <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
          <CardHeader>
            <CardTitle>ขั้นตอนการทดสอบ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {testSteps.map((step, index) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`border rounded-xl p-4 transition-all ${
                  currentStep === index ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                }`}
                onClick={() => setCurrentStep(index)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    currentStep >= index ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-800 mb-1">{step.title}</h3>
                    <p className="text-sm text-slate-600 mb-3">{step.description}</p>
                    
                    {/* Chat Preview */}
                    <div className="bg-slate-100 rounded-lg p-3 space-y-2">
                      {/* User Message */}
                      <div className="flex justify-end">
                        <div className="bg-blue-600 text-white px-3 py-2 rounded-2xl rounded-br-md max-w-[80%]">
                          <p className="text-sm">{step.userMessage}</p>
                        </div>
                      </div>
                      {/* Bot Response */}
                      <div className="flex justify-start">
                        <div className="bg-white px-3 py-2 rounded-2xl rounded-bl-md max-w-[80%] shadow-sm">
                          <p className="text-sm whitespace-pre-line">{step.botResponse}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* How to Test */}
        <Card className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-xl border-0">
          <CardContent className="p-6">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Send className="w-5 h-5" />
              วิธีทดสอบ
            </h3>
            <ol className="space-y-3 text-blue-100">
              <li className="flex items-start gap-2">
                <Badge className="bg-white/20 text-white">1</Badge>
                <span>ไปที่ Facebook Page ของหอพักและกดปุ่ม "ส่งข้อความ"</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge className="bg-white/20 text-white">2</Badge>
                <span>พิมพ์ข้อความทักทาย เช่น "สวัสดี"</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge className="bg-white/20 text-white">3</Badge>
                <span>ลงทะเบียนด้วยเบอร์โทรศัพท์ที่มีในระบบ</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge className="bg-white/20 text-white">4</Badge>
                <span>ทดสอบแจ้งซ่อมโดยพิมพ์ "แจ้งซ่อม" ตามด้วยปัญหา</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge className="bg-white/20 text-white">5</Badge>
                <span>ทดสอบชำระเงินโดยส่งรูปสลิปโอนเงิน</span>
              </li>
            </ol>
            
            <div className="mt-6 pt-4 border-t border-white/20">
              <p className="text-sm text-blue-200 mb-3">
                💡 ระบบจะตอบกลับอัตโนมัติตามคำสั่งที่ได้รับ
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Technical Info for Reviewers */}
        <Card className="bg-slate-800 text-white shadow-xl border-0">
          <CardContent className="p-6">
            <h3 className="text-lg font-bold mb-4">📋 ข้อมูลสำหรับ Facebook Review Team</h3>
            <div className="space-y-3 text-slate-300 text-sm">
              <p><strong>App Purpose:</strong> ระบบจัดการหอพัก/อพาร์ทเมนท์สำหรับเจ้าของที่พักและผู้เช่า</p>
              <p><strong>pages_messaging Usage:</strong></p>
              <ul className="list-disc list-inside ml-4 space-y-1">
                <li>ผู้เช่าลงทะเบียนยืนยันตัวตนผ่าน Messenger</li>
                <li>ผู้เช่าแจ้งซ่อมบำรุงห้องพัก</li>
                <li>ผู้เช่าส่งสลิปชำระค่าเช่าและรับใบเสร็จอัตโนมัติ</li>
                <li>เจ้าของหอพักส่งแจ้งเตือนค่าเช่าให้ผู้เช่า</li>
              </ul>
              <p><strong>Target Users:</strong> เจ้าของหอพัก/อพาร์ทเมนท์ และผู้เช่าในประเทศไทย</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}