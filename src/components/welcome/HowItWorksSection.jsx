import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

export default function HowItWorksSection() {
  const steps = [
    {
      number: "1",
      title: "ลงทะเบียน",
      description: "สมัครสมาชิกและเข้าสู่ระบบภายใน 2 นาที",
      image: "https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=300&fit=crop"
    },
    {
      number: "2",
      title: "เพิ่มข้อมูลหอพัก",
      description: "กรอกข้อมูลห้องพักและผู้เช่าของคุณ",
      image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=300&fit=crop"
    },
    {
      number: "3",
      title: "เริ่มใช้งาน",
      description: "ระบบพร้อมใช้งานทันที ไม่ต้องติดตั้ง",
      image: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=300&fit=crop"
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
            วิธีการใช้งาน
          </h2>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            เริ่มต้นใช้งานได้ง่ายๆ ภายใน 3 ขั้นตอน
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative"
            >
              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow overflow-hidden group">
                <div className="relative h-48 overflow-hidden bg-gradient-to-br from-blue-100 to-purple-100">
                  <img 
                    src={step.image} 
                    alt={step.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute top-4 left-4 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-lg">
                    {step.number}
                  </div>
                </div>
                <CardContent className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                  <p className="text-slate-600">{step.description}</p>
                </CardContent>
              </Card>
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                    <ArrowRight className="w-5 h-5 text-white" />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}