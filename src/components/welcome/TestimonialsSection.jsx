import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Star } from "lucide-react";
import { motion } from "framer-motion";

export default function TestimonialsSection() {
  const testimonials = [
    {
      name: "คุณสมชาย",
      role: "เจ้าของหอพักกรุงเทพฯ",
      content: "ใช้หลังหอพักมา 6 เดือน ลดเวลาการทำงานได้ครึ่งหนึ่ง ไม่ต้องนั่งคำนวณบิล ระบบทำให้หมดเลย",
      rating: 5,
      image: "https://ui-avatars.com/api/?name=S+K&background=3b82f6&color=fff"
    },
    {
      name: "คุณนิภา",
      role: "ผู้จัดการหอพักเชียงใหม่",
      content: "การส่งแจ้งเตือนผ่าน LINE ทำให้ผู้เช่าชำระเงินตรงเวลามากขึ้น ลดปัญหาเก็บเงินได้เยอะ",
      rating: 5,
      image: "https://ui-avatars.com/api/?name=N+P&background=8b5cf6&color=fff"
    },
    {
      name: "คุณประวิทย์",
      role: "เจ้าของหอพัก 3 สาขา",
      content: "จัดการได้หลายสาขาในที่เดียว ดูรายงานได้ครบทุกสาขา ไม่ต้องเปิดหลายหน้าจอ สะดวกมาก",
      rating: 5,
      image: "https://ui-avatars.com/api/?name=P+W&background=ec4899&color=fff"
    },
    {
      name: "คุณวรรณา",
      role: "เจ้าของอพาร์ทเมนต์",
      content: "ระบบให้คะแนนผู้เช่าช่วยได้มาก รู้ว่าผู้เช่าคนไหนดี ผู้เช่าคนไหนมีปัญหา วางแผนได้ง่ายขึ้น",
      rating: 5,
      image: "https://ui-avatars.com/api/?name=W+S&background=f97316&color=fff"
    }
  ];

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
            ความคิดเห็นจากลูกค้า
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            ฟังจากผู้ที่ใช้งานจริง
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow h-full">
                <CardContent className="p-6">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <p className="text-slate-700 mb-6 leading-relaxed">"{testimonial.content}"</p>
                  <div className="flex items-center gap-3">
                    <img src={testimonial.image} alt={testimonial.name} className="w-12 h-12 rounded-full" />
                    <div>
                      <div className="font-bold text-slate-900">{testimonial.name}</div>
                      <div className="text-sm text-slate-600">{testimonial.role}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}