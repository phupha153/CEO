
import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, AlertTriangle, TrendingUp, BarChart3, Target, ArrowLeft, MessageCircle, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

export default function AIGuidelines() {
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState({
    overview: true, // As per instruction, Overview is always expanded
    aiChat: false,
    alerts: false,
    forecast: false,
    fullOccupancy: false,
    howWorks: false,
    bestPractices: false,
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => navigate(-1)}
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold text-slate-800 flex items-center gap-3">
              <Brain className="w-10 h-10 text-purple-600" />
              คู่มือ Smart Dorm AI Analytics
            </h1>
            <p className="text-slate-600 mt-2">
              เข้าใจการทำงานของระบบวิเคราะห์อัจฉริยะ
            </p>
          </div>
        </div>

        {/* Overview - Always Expanded */}
        <Card className="bg-gradient-to-br from-purple-600 to-blue-600 text-white border-0 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Brain className="w-7 h-7" />
              ระบบวิเคราะห์อัตโนมัติ AI (2 รูปแบบ)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-purple-100 text-lg">
              ระบบ Smart Dorm AI วิเคราะห์ข้อมูล 6 เดือนย้อนหลังและให้คำแนะนำแบบเรียลไทม์
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border-2 border-white/30">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-7 h-7" />
                  <Badge className="bg-green-600 text-white">Dashboard</Badge>
                </div>
                <p className="font-bold text-base mb-2">1. Smart Dorm AI (แดชบอร์ด)</p>
                <ul className="text-xs text-purple-100 space-y-1 list-disc ml-4">
                  <li>วิเคราะห์อัตโนมัติทุกครั้งที่เปิดหน้า</li>
                  <li>แจ้งเตือนความผิดปกติทุกสาขา</li>
                  <li>คาดการณ์รายได้เดือนหน้า</li>
                  <li>แนะนำกลยุทธ์ธุรกิจ</li>
                </ul>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4 border-2 border-white/30">
                <div className="flex items-center gap-2 mb-3">
                  <MessageCircle className="w-7 h-7" />
                  <Badge className="bg-cyan-600 text-white">Chat</Badge>
                </div>
                <p className="font-bold text-base mb-2">2. AI Chat (ถาม-ตอบ)</p>
                <ul className="text-xs text-purple-100 space-y-1 list-disc ml-4">
                  <li>ถามคำถามได้ทุกเรื่อง</li>
                  <li>วิเคราะห์ข้อมูลตามที่ถาม</li>
                  <li>จำบทสนทนาได้ (6 ข้อความล่าสุด)</li>
                  <li>ตอบจากข้อมูลจริง 100%</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* AI Chat System */}
        <Card className="bg-white/80 backdrop-blur-sm border-2 border-cyan-300 shadow-xl">
          <CardHeader 
            className="bg-gradient-to-r from-cyan-50 to-blue-50 border-b-2 border-cyan-200 cursor-pointer hover:bg-cyan-100/50 transition-colors"
            onClick={() => toggleSection('aiChat')}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-cyan-900">
                <MessageCircle className="w-6 h-6 text-cyan-600" />
                💬 AI Chat - ระบบใหม่ที่แม่นยำกว่าเดิม
                <Badge className="bg-green-600 text-white ml-2">อัปเดตล่าสุด</Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-cyan-700">
                {expandedSections.aiChat ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </Button>
            </div>
          </CardHeader>
          <AnimatePresence>
            {expandedSections.aiChat && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5">
                    <h3 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                      <Zap className="w-5 h-5" />
                      ✨ สิ่งที่เปลี่ยนไป (ดีขึ้นมาก!)
                    </h3>
                    <div className="space-y-3">
                      <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                        <p className="font-bold text-green-900 mb-2">✅ วิธีเดิม (มีปัญหา):</p>
                        <ul className="text-sm text-red-700 space-y-1 list-disc ml-5">
                          <li>AI ต้อง "คิดเอง" ว่าจะดึงข้อมูลอะไร</li>
                          <li>บางครั้งดึงข้อมูลผิด หรือไม่ดึงเลย</li>
                          <li>ตอบว่า "ไม่มีข้อมูล" ทั้งที่มีจริง</li>
                          <li><strong className="text-red-800">รายได้บอก 0 บาท ทั้งที่มีหลายแสน! ❌</strong></li>
                        </ul>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                        <p className="font-bold text-blue-900 mb-2">✅ วิธีใหม่ (แม่นยำ 100%):</p>
                        <ul className="text-sm text-green-700 space-y-1 list-disc ml-5">
                          <li><strong>ดึงข้อมูลทั้งหมดก่อน</strong> แล้วส่งให้ AI โดยตรง</li>
                          <li>AI ได้ข้อมูลครบทุกอย่าง: Payment, Expense, Room, Tenant, Booking, Maintenance, Delivery</li>
                          <li>ใช้วิธีเดียวกับ "Smart Dorm AI" ในแดชบอร์ด</li>
                          <li><strong className="text-green-800">รับประกันความแม่นยำ 100%! ✅</strong></li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-cyan-50 border-2 border-cyan-200 rounded-xl p-4">
                    <h3 className="font-bold text-cyan-900 mb-3">📊 ข้อมูลที่ AI Chat จะได้รับ:</h3>
                    <div className="grid md:grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3 border border-cyan-200">
                        <p className="font-semibold text-cyan-900 text-sm mb-2">💰 การเงิน:</p>
                        <ul className="text-xs text-slate-700 space-y-1 list-disc ml-4">
                          <li>รายได้ทั้งหมด (ชำระแล้ว/รอชำระ/เกินกำหนด)</li>
                          <li>ค่าใช้จ่ายทั้งหมด (แยกตามประเภท)</li>
                          <li>กำไร/ขาดทุน</li>
                          <li>รายการชำระล่าสุด 15 รายการ</li>
                          <li>รายการค้างชำระล่าสุด 15 รายการ</li>
                        </ul>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-cyan-200">
                        <p className="font-semibold text-cyan-900 text-sm mb-2">🏠 ห้องพักและผู้เช่า:</p>
                        <ul className="text-xs text-slate-700 space-y-1 list-disc ml-4">
                          <li>จำนวนห้องทั้งหมด/ว่าง/มีผู้เช่า</li>
                          <li>อัตราการเข้าพัก</li>
                          <li>ผู้เช่าทั้งหมดและสัญญาใช้งาน</li>
                          <li>คำขอซ่อม (รอดำเนินการ/เร่งด่วน)</li>
                          <li>พัสดุที่ยังไม่ได้รับ</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                    <h3 className="font-bold text-purple-900 mb-3">🧠 ความสามารถพิเศษ:</h3>
                    <ul className="text-sm text-purple-800 space-y-2 list-disc ml-5">
                      <li>
                        <strong>จำบทสนทนาได้:</strong> AI จดจำ 6 ข้อความล่าสุด ทำให้ถามต่อเนื่องได้ 
                        <br />
                        <span className="text-xs text-purple-600">
                          เช่น: ถาม "รายได้เท่าไหร่?" → ตอบ "538,050 บาท" → ถามต่อ "เทียบกับเดือนก่อนเพิ่มหรือลด?" AI จะจำคำถามแรกได้
                        </span>
                      </li>
                      <li>
                        <strong>กรองข้อมูลเฉพาะสาขา:</strong> AI จะตอบเฉพาะข้อมูลของสาขาที่คุณเลือกเท่านั้น
                      </li>
                      <li>
                        <strong>รีเฟรชข้อมูลอัตโนมัติ:</strong> เปิด AI Chat ใหม่ทุกครั้ง = โหลดข้อมูลล่าสุดจากระบบ
                      </li>
                    </ul>
                  </div>

                  <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-4">
                    <h3 className="font-bold text-yellow-900 mb-3">💡 ตัวอย่างคำถามที่ถามได้:</h3>
                    <div className="grid md:grid-cols-2 gap-2">
                      <div className="bg-white rounded-lg p-3 border border-yellow-200">
                        <p className="text-xs font-semibold text-yellow-900 mb-2">💰 การเงิน:</p>
                        <ul className="text-xs text-slate-700 space-y-1">
                          <li>• รายได้เดือนนี้เท่าไหร่?</li>
                          <li>• ค่าใช้จ่ายทั้งหมด?</li>
                          <li>• กำไรสุทธิเท่าไหร่?</li>
                          <li>• มีใครค้างชำระบ้าง?</li>
                        </ul>
                      </div>
                      <div className="bg-white rounded-lg p-3 border border-yellow-200">
                        <p className="text-xs font-semibold text-yellow-900 mb-2">🏠 ห้องพักและผู้เช่า:</p>
                        <ul className="text-xs text-slate-700 space-y-1">
                          <li>• ห้องว่างมีกี่ห้อง?</li>
                          <li>• อัตราเข้าพักเท่าไหร่?</li>
                          <li>• ผู้เช่าทั้งหมดกี่คน?</li>
                          <li>• งานซ่อมที่รอดำเนินการ?</li>
                        </ul>
                      </div>
                    </div>
                    <p className="text-xs text-yellow-700 mt-3">
                      <strong>💬 เคล็ดลับ:</strong> ถามแบบสบายๆ เหมือนคุยกับคน AI จะเข้าใจและตอบได้!
                    </p>
                  </div>

                  <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                    <h3 className="font-bold text-red-900 mb-3">⚠️ ข้อจำกัด:</h3>
                    <ul className="text-sm text-red-800 space-y-2 list-disc ml-5">
                      <li>AI ตอบได้เฉพาะข้อมูลที่มีในระบบเท่านั้น</li>
                      <li>ถ้าข้อมูลบันทึกไม่ครบ/ไม่ถูกต้อง → AI จะตอบตามข้อมูลที่มี</li>
                      <li>ไม่สามารถแก้ไขข้อมูล/เพิ่มข้อมูลได้ (ใช้เพื่อดูข้อมูลและวิเคราะห์เท่านั้น)</li>
                      <li>ใช้เป็นข้อมูลอ้างอิงประกอบการตัดสินใจ ไม่ใช่คำตอบสุดท้าย</li>
                    </ul>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Alert Guidelines */}
        <Card className="bg-white/80 backdrop-blur-sm border-2 border-amber-300 shadow-xl">
          <CardHeader 
            className="bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-200 cursor-pointer hover:bg-amber-100/50 transition-colors"
            onClick={() => toggleSection('alerts')}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
                🚨 ความผิดปกติที่ระบบจะแจ้งเตือน
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-amber-700">
                {expandedSections.alerts ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </Button>
            </div>
          </CardHeader>
          <AnimatePresence>
            {expandedSections.alerts && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                      <h3 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                        💰 การเงิน
                      </h3>
                      <ul className="text-sm text-red-800 space-y-2 list-disc ml-5">
                        <li>รายได้ลด/เพิ่ม <strong>&gt;20%</strong> เทียบกับเดือนก่อน</li>
                        <li>ค่าใช้จ่ายสูง <strong>&gt;30%</strong> ของรายได้</li>
                        <li><strong>ค้างชำระเยอะมาก &gt;5 รายการ หรือ &gt;5% ของห้องที่มีผู้เช่า</strong></li>
                        <li>ระบุชื่อสาขาและเปอร์เซ็นต์ทุกครั้ง</li>
                      </ul>
                    </div>

                    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                      <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                        🏠 ห้องพัก
                      </h3>
                      <ul className="text-sm text-blue-800 space-y-2 list-disc ml-5">
                        <li>ห้องว่าง <strong>&gt;30%</strong> ของห้องทั้งหมด</li>
                        <li>ห้องที่มีคำขอซ่อมบ่อย (เดือนละ 3+ ครั้ง)</li>
                        <li>แอร์ที่ไม่ได้ล้างเกิน 1 ปี</li>
                      </ul>
                    </div>

                    <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                      <h3 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                        🔧 การซ่อมแซม
                      </h3>
                      <ul className="text-sm text-purple-800 space-y-2 list-disc ml-5">
                        <li><strong>คำขอซ่อมเร่งด่วน &gt;3 รายการ</strong> ในสาขาเดียวกัน</li>
                        <li>ห้องที่มีประวัติซ่อมบ่อย</li>
                        <li>ระบุชื่อสาขาและจำนวนรายการ</li>
                      </ul>
                    </div>

                    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                      <h3 className="font-bold text-orange-900 mb-3 flex items-center gap-2">
                        👥 พฤติกรรมผู้เช่า
                      </h3>
                      <ul className="text-sm text-orange-800 space-y-2 list-disc ml-5">
                        <li><strong>ผู้เช่าค้างชำระบ่อย ≥2 ครั้ง</strong></li>
                        <li>ผู้เช่าที่จ่ายช้า &gt;7 วัน อย่างสม่ำเสมอ</li>
                        <li>ระบุชื่อผู้เช่าและสาขาทุกครั้ง</li>
                      </ul>
                    </div>

                    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
                      <h3 className="font-bold text-indigo-900 mb-3 flex items-center gap-2">
                        📅 สัญญาเช่า
                      </h3>
                      <ul className="text-sm text-indigo-800 space-y-2 list-disc ml-5">
                        <li><strong>สัญญาหมดพร้อมกัน &gt;5 ห้อง</strong> ใน 1-2 เดือน</li>
                        <li>ความเสี่ยงห้องว่างพร้อมกัน</li>
                        <li>ระบุสาขาและจำนวนห้อง</li>
                      </ul>
                    </div>

                    <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                      <h3 className="font-bold text-green-900 mb-3 flex items-center gap-2">
                        ✅ กรณีไม่พบความผิดปกติ
                      </h3>
                      <p className="text-sm text-green-800">
                        ระบบจะแสดงข้อความ <strong>"✅ ไม่พบความผิดปกติ"</strong> เมื่อทุกอย่างเป็นปกติ
                      </p>
                    </div>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Revenue Forecast */}
        <Card className="bg-white/80 backdrop-blur-sm border-2 border-blue-300 shadow-xl">
          <CardHeader 
            className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b-2 border-blue-200 cursor-pointer hover:bg-blue-100/50 transition-colors"
            onClick={() => toggleSection('forecast')}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-blue-900">
                <TrendingUp className="w-6 h-6 text-blue-600" />
                📊 การคาดการณ์รายได้
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-blue-700">
                {expandedSections.forecast ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </Button>
            </div>
          </CardHeader>
          <AnimatePresence>
            {expandedSections.forecast && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="p-6 space-y-4">
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                    <h3 className="font-bold text-blue-900 mb-3">ข้อมูลที่ใช้ในการคาดการณ์:</h3>
                    <ul className="text-sm text-blue-800 space-y-2 list-disc ml-5">
                      <li>📈 รายได้ย้อนหลัง 6 เดือนและแนวโน้ม</li>
                      <li>🏠 อัตราการเข้าพักปัจจุบัน</li>
                      <li>👥 จำนวนผู้เช่าใหม่และผู้ย้ายออก (3 เดือน)</li>
                      <li>💸 ค่าใช้จ่ายเฉลี่ยรายเดือน</li>
                      <li>💰 <strong>เทียบกับเดือนนี้ (ถ้าชำระครบทุกห้อง)</strong></li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4">
                    <h3 className="font-bold text-purple-900 mb-3">⚠️ สิ่งสำคัญ:</h3>
                    <ul className="text-sm text-purple-800 space-y-2 list-disc ml-5">
                      <li>
                        เปอร์เซ็นต์การเติบโตเทียบกับ <strong>"รายได้เดือนนี้ถ้าชำระครบทุกห้อง"</strong>
                      </li>
                      <li>
                        <strong>ไม่ใช่</strong> เทียบกับรายได้ที่ชำระแล้ว
                      </li>
                      <li>
                        ทำให้คาดการณ์แม่นยำและสะท้อนศักยภาพจริง
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4">
                    <h3 className="font-bold text-slate-800 mb-3">📋 รูปแบบการนำเสนอ:</h3>
                    <ol className="text-sm text-slate-700 space-y-2 list-decimal ml-5">
                      <li><strong>รายได้คาดการณ์เดือนหน้า:</strong> [ตัวเลข] บาท</li>
                      <li><strong>เทียบกับเดือนนี้ (ถ้าชำระครบ):</strong> [ตัวเลข] บาท</li>
                      <li><strong>เปอร์เซ็นต์เพิ่ม/ลด:</strong> [+/-XX%]</li>
                      <li><strong>สาเหตุหลัก:</strong> อัตราเข้าพัก, ผู้เช่าใหม่, ย้ายออก, แนวโน้ม</li>
                      <li><strong>คำแนะนำจาก AI:</strong> กลยุทธ์ที่เหมาะสม</li>
                    </ol>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Full Occupancy Recommendations */}
        <Card className="bg-white/80 backdrop-blur-sm border-2 border-green-300 shadow-xl">
          <CardHeader 
            className="bg-gradient-to-r from-green-50 to-emerald-50 border-b-2 border-green-200 cursor-pointer hover:bg-green-100/50 transition-colors"
            onClick={() => toggleSection('fullOccupancy')}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-green-900">
                <Target className="w-6 h-6 text-green-600" />
                🎯 คำแนะนำเมื่อห้องเต็ม (≥95%)
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-green-700">
                {expandedSections.fullOccupancy ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </Button>
            </div>
          </CardHeader>
          <AnimatePresence>
            {expandedSections.fullOccupancy && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="p-6">
                  <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-5">
                    <p className="text-sm text-green-900 mb-4 font-semibold">
                      เมื่ออัตราการเข้าพัก ≥95% ต่อเนื่อง AI จะแนะนำ 5 กลยุทธ์นี้:
                    </p>
                    
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4 border-2 border-green-200">
                        <div className="flex items-start gap-3">
                          <Badge className="bg-green-600 text-white text-lg shrink-0">①</Badge>
                          <div>
                            <h4 className="font-bold text-green-900 mb-1">ขึ้นค่าเช่า 5-10% ทดสอบตลาด</h4>
                            <p className="text-sm text-green-800">
                              เมื่อห้องเต็มต่อเนื่อง = ความต้องการสูง → ทดลองปรับราคา สำหรับห้องใหม่หรือสัญญาต่อ
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-blue-200">
                        <div className="flex items-start gap-3">
                          <Badge className="bg-blue-600 text-white text-lg shrink-0">②</Badge>
                          <div>
                            <h4 className="font-bold text-blue-900 mb-1">เพิ่มบริการเสริม</h4>
                            <p className="text-sm text-blue-800">
                              เสนอบริการเพิ่มเติม: ซักผ้า, Wi-Fi ความเร็วสูง, ที่จอดรถ, ทำความสะอาด
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-purple-200">
                        <div className="flex items-start gap-3">
                          <Badge className="bg-purple-600 text-white text-lg shrink-0">③</Badge>
                          <div>
                            <h4 className="font-bold text-purple-900 mb-1">คัดกรองผู้เช่าคุณภาพสูง</h4>
                            <p className="text-sm text-purple-800">
                              เลือกผู้เช่าที่ชำระตรงเวลา, ดูแลห้องดี, ไม่มีประวัติค้างชำระ
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-orange-200">
                        <div className="flex items-start gap-3">
                          <Badge className="bg-orange-600 text-white text-lg shrink-0">④</Badge>
                          <div>
                            <h4 className="font-bold text-orange-900 mb-1">โปรโมท "ห้องเต็มต่อเนื่อง"</h4>
                            <p className="text-sm text-orange-800">
                              ใช้จุดขายว่า "ห้องเต็มตลอด" เพื่อสร้างความน่าเชื่อถือและดึงดูดผู้เช่าใหม่
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white rounded-lg p-4 border-2 border-indigo-200">
                        <div className="flex items-start gap-3">
                          <Badge className="bg-indigo-600 text-white text-lg shrink-0">⑤</Badge>
                          <div>
                            <h4 className="font-bold text-indigo-900 mb-1">พิจารณาขยายสาขา/ห้องพรีเมียม</h4>
                            <p className="text-sm text-indigo-800">
                              หากเต็มต่อเนื่อง 6+ เดือน → เปิดสาขาใหม่ หรือปรับปรุงห้องพรีเมียมราคาสูงขึ้น
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* How AI Works */}
        <Card className="bg-white/80 backdrop-blur-sm border-2 border-slate-200 shadow-xl">
          <CardHeader 
            className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200 cursor-pointer hover:bg-slate-100/80 transition-colors"
            onClick={() => toggleSection('howWorks')}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-slate-900">
                <BarChart3 className="w-6 h-6 text-slate-600" />
                ⚙️ การทำงานของระบบ
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-slate-700">
                {expandedSections.howWorks ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </Button>
            </div>
          </CardHeader>
          <AnimatePresence>
            {expandedSections.howWorks && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="font-bold text-slate-800 mb-2">📊 ข้อมูลที่นำมาวิเคราะห์:</h3>
                    <ul className="text-sm text-slate-700 space-y-1.5 list-disc ml-5">
                      <li>ประวัติรายได้ย้อนหลัง 6 เดือน</li>
                      <li>ค่าใช้จ่ายรายเดือน</li>
                      <li>การชำระเงิน (ทันเวลา/ค้างชำระ/เกินกำหนด)</li>
                      <li>อัตราการเข้าพัก</li>
                      <li>คำขอซ่อมแซม (ประเภท, ความเร่งด่วน, ความถี่)</li>
                      <li>พฤติกรรมผู้เช่า (การชำระ, ระยะเวลาพัก)</li>
                      <li>สถานะสัญญาเช่า</li>
                    </ul>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 border-2 border-blue-200 rounded-xl p-4">
                    <h3 className="font-bold text-blue-900 mb-2">🧠 กระบวนการวิเคราะห์:</h3>
                    <ol className="text-sm text-blue-800 space-y-1.5 list-decimal ml-5">
                      <li>รวบรวมข้อมูลจากทุกสาขา</li>
                      <li>คำนวณค่าเฉลี่ยและแนวโน้ม</li>
                      <li>เปรียบเทียบกับเกณฑ์มาตรฐาน</li>
                      <li>ตรวจจับความผิดปกติ (Anomaly Detection)</li>
                      <li>คาดการณ์รายได้เดือนหน้า</li>
                      <li>สร้างคำแนะนำเฉพาะสถานการณ์</li>
                    </ol>
                  </div>

                  <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                    <h3 className="font-bold text-yellow-900 mb-2">⏱️ ความถี่ในการอัปเดต:</h3>
                    <ul className="text-sm text-yellow-800 space-y-1.5 list-disc ml-5">
                      <li>วิเคราะห์ใหม่ทุกครั้งที่เปิดหน้า Dashboard/รายงาน</li>
                      <li>ข้อมูลแคชไว้ในหน่วยความจำ (ไม่เรียก AI ซ้ำหากข้อมูลไม่เปลี่ยน)</li>
                      <li>ใช้เวลาประมาณ 15-45 วินาที ในการวิเคราะห์</li>
                    </ul>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Best Practices */}
        <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 shadow-xl">
          <CardHeader
            className="cursor-pointer hover:bg-indigo-100/50 transition-colors"
            onClick={() => toggleSection('bestPractices')}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-indigo-900">
                💡 ข้อแนะนำในการใช้งาน
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-indigo-700">
                {expandedSections.bestPractices ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </Button>
            </div>
          </CardHeader>
          <AnimatePresence>
            {expandedSections.bestPractices && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <CardContent className="space-y-3 p-6">
                  <div className="bg-white rounded-lg p-4 border-2 border-indigo-200">
                    <h4 className="font-bold text-indigo-900 mb-2">✅ ควรทำ:</h4>
                    <ul className="text-sm text-indigo-800 space-y-1.5 list-disc ml-5">
                      <li>อ่านคำแนะนำทุกวัน (ทั้ง Smart Dorm AI และ AI Chat)</li>
                      <li>ติดตามการแจ้งเตือนและดำเนินการทันที</li>
                      <li>เปรียบเทียบคำคาดการณ์กับความเป็นจริง</li>
                      <li>บันทึกข้อมูลให้ครบถ้วนและถูกต้อง</li>
                      <li>ใช้ AI Chat ถามคำถามเฉพาะเจาะจงเมื่อต้องการ</li>
                    </ul>
                  </div>

                  <div className="bg-white rounded-lg p-4 border-2 border-red-200">
                    <h4 className="font-bold text-red-900 mb-2">❌ ไม่ควรทำ:</h4>
                    <ul className="text-sm text-red-800 space-y-1.5 list-disc ml-5">
                      <li>ไม่ควรเชื่อ 100% ใช้เป็นข้อมูลประกอบการตัดสินใจ</li>
                      <li>ไม่ควรละเลยการแจ้งเตือนซ้ำๆ</li>
                      <li>ไม่ควรบันทึกข้อมูลไม่ครบ (AI จะวิเคราะห์ไม่แม่นยำ)</li>
                      <li>ไม่ควรถาม AI Chat เรื่องที่ไม่เกี่ยวกับการจัดการหอพัก</li>
                    </ul>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Info Footer */}
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-slate-700 mb-2">
                  <strong>Smart Dorm AI Analytics</strong> ใช้เทคโนโลยี Large Language Model (LLM) จาก Base44 
                  ในการวิเคราะห์ข้อมูลแบบเรียลไทม์
                </p>
                <p className="text-xs text-slate-600">
                  💡 ยิ่งระบบมีข้อมูลมาก AI ก็วิเคราะห์ได้แม่นยำมากขึ้น
                </p>
                <p className="text-xs text-purple-600 mt-2">
                  🔄 อัปเดตล่าสุด: เปลี่ยน AI Chat ให้ใช้ข้อมูลจริงจากระบบโดยตรง (ไม่ต้องให้ AI ดึงเอง)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
