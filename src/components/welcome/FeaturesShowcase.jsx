import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";

export default function FeaturesShowcase() {
  const features = [
    {
      title: "ส่ง LINE อัตโนมัติ",
      subtitle: "Easy outreach and reminders",
      description: "ส่งบิล แจ้งเตือนการชำระเงิน และข้อความประกาศผ่าน LINE อัตโนมัติ ไม่ต้องส่งด้วยตัวเอง",
      mockupType: "chat",
      color: "from-green-400 to-emerald-500"
    },
    {
      title: "สร้างบิลอัตโนมัติ",
      subtitle: "Automated Billing System",
      description: "ระบบสร้างบิลค่าเช่า ค่าน้ำ ค่าไฟ พร้อมส่งให้ผู้เช่าอัตโนมัติทุกเดือน",
      mockupType: "invoice",
      color: "from-blue-400 to-cyan-500"
    },
    {
      title: "ระบบให้คะแนนผู้เช่า",
      subtitle: "Tenant Rating System",
      description: "ประเมินผู้เช่าจากประวัติการชำระเงิน ดูแลห้อง และพฤติกรรม เพื่อคัดกรองผู้เช่าคุณภาพ",
      mockupType: "rating",
      color: "from-purple-400 to-pink-500"
    },
    {
      title: "รายงานแบบเรียลไทม์",
      subtitle: "Rich detailed Analytics",
      description: "ดูสถิติรายได้ ค่าใช้จ่าย และอัตราการเข้าพักแบบเรียลไทม์ พร้อมกราฟและตัวเลขที่ชัดเจน",
      mockupType: "analytics",
      color: "from-orange-400 to-red-500"
    }
  ];

  const ChatMockup = () => (
    <div className="space-y-3">
      <div className="flex gap-2 items-start">
        <div className="w-8 h-8 rounded-full bg-green-500 flex-shrink-0" />
        <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-md max-w-[200px]">
          <p className="text-xs text-slate-800">สวัสดีค่ะ นี่คือบิลค่าเช่าประจำเดือนของคุณ</p>
        </div>
      </div>
      <div className="flex gap-2 items-start">
        <div className="w-8 h-8 rounded-full bg-green-500 flex-shrink-0" />
        <div className="bg-white rounded-2xl rounded-tl-none p-3 shadow-md max-w-[200px]">
          <div className="text-xs font-bold text-slate-900 mb-1">💰 ยอดชำระ: 5,500 บาท</div>
          <div className="text-xs text-slate-600">ครบกำหนด: 5 ม.ค. 2568</div>
        </div>
      </div>
      <div className="flex justify-end">
        <div className="bg-blue-600 text-white rounded-2xl rounded-tr-none p-3 shadow-md max-w-[180px]">
          <p className="text-xs">ได้ค่ะ ขอบคุณค่ะ</p>
        </div>
      </div>
    </div>
  );

  const InvoiceMockup = () => (
    <div className="bg-white rounded-xl p-4 shadow-lg space-y-2">
      <div className="flex justify-between items-center pb-2 border-b">
        <div className="text-sm font-bold text-slate-900">ใบแจ้งหนี้</div>
        <div className="text-xs text-slate-600">#INV-001</div>
      </div>
      <div className="space-y-1.5 text-xs">
        <div className="flex justify-between">
          <span className="text-slate-600">ค่าเช่า</span>
          <span className="font-medium text-slate-900">4,500 ฿</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">ค่าน้ำ</span>
          <span className="font-medium text-slate-900">300 ฿</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-600">ค่าไฟ</span>
          <span className="font-medium text-slate-900">700 ฿</span>
        </div>
        <div className="flex justify-between pt-2 border-t font-bold">
          <span className="text-slate-900">รวมทั้งสิ้น</span>
          <span className="text-blue-600">5,500 ฿</span>
        </div>
      </div>
      <div className="pt-2">
        <div className="bg-green-100 text-green-700 text-xs px-2 py-1 rounded-md inline-block">
          ✓ ส่งอัตโนมัติทุกวันที่ 1
        </div>
      </div>
    </div>
  );

  const RatingMockup = () => (
    <div className="bg-white rounded-xl p-4 shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
          A
        </div>
        <div>
          <div className="text-sm font-bold text-slate-900">คุณอารยา</div>
          <div className="text-xs text-slate-600">ห้อง 301</div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">การชำระเงิน</span>
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-yellow-400" />
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">ดูแลห้อง</span>
          <div className="flex gap-0.5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-yellow-400" />
            ))}
            <div className="w-3 h-3 rounded-full bg-slate-200" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">มารยาท</span>
          <div className="flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="w-3 h-3 rounded-full bg-yellow-400" />
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t">
        <div className="text-xs text-slate-600">คะแนนรวม</div>
        <div className="text-2xl font-bold text-slate-900">9.3/10</div>
      </div>
    </div>
  );

  const AnalyticsMockup = () => (
    <div className="bg-white rounded-xl p-4 shadow-lg space-y-3">
      <div className="flex justify-between items-center">
        <div className="text-sm font-bold text-slate-900">รายได้เดือนนี้</div>
        <Badge className="bg-green-100 text-green-700 text-xs">+12%</Badge>
      </div>
      <div className="text-3xl font-bold text-slate-900">฿ 245,600</div>
      <div className="flex items-end gap-1 h-24">
        {[40, 65, 45, 80, 60, 95, 70, 85].map((height, i) => (
          <div key={i} className="flex-1 bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-lg" style={{ height: `${height}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 pt-2 border-t">
        <div>
          <div className="text-xs text-slate-600">ห้องเช่าแล้ว</div>
          <div className="text-lg font-bold text-slate-900">48/50</div>
        </div>
        <div>
          <div className="text-xs text-slate-600">อัตราเข้าพัก</div>
          <div className="text-lg font-bold text-green-600">96%</div>
        </div>
      </div>
    </div>
  );

  const mockups = {
    chat: <ChatMockup />,
    invoice: <InvoiceMockup />,
    rating: <RatingMockup />,
    analytics: <AnalyticsMockup />
  };

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            ทำไมหลังหอพัก<br />
            <span className="text-blue-600">ถึงโดดเด่นกว่าใคร</span>
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            ฟีเจอร์พิเศษที่ไม่มีใครเทียบได้
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-0 shadow-xl bg-white overflow-hidden group hover:shadow-2xl transition-all">
                <div className="p-8">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center flex-shrink-0`}>
                      <div className="w-6 h-6 bg-white rounded-full" />
                    </div>
                    <div>
                      <Badge className="mb-2 bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs">
                        {feature.subtitle}
                      </Badge>
                      <h3 className="text-2xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                      <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                  
                  <div className="mt-6">
                    {mockups[feature.mockupType]}
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}