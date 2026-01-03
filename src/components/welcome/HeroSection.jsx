import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Users, TrendingUp, Home, Star } from "lucide-react";
import { motion } from "framer-motion";

export default function HeroSection({ isAuthenticated, onCtaClick, buildingLogo, onTrialClick }) {
  const stats = [
    { icon: Users, label: "ผู้ใช้งาน", value: "500+", color: "from-blue-500 to-cyan-500" },
    { icon: TrendingUp, label: "เพิ่มประสิทธิภาพ", value: "80%", color: "from-green-500 to-emerald-500" },
    { icon: Home, label: "หอพักที่ใช้งาน", value: "100+", color: "from-purple-500 to-pink-500" },
    { icon: Star, label: "ความพึงพอใจ", value: "95%", color: "from-orange-500 to-amber-500" }
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 py-20 md:py-32">
      <div className="absolute inset-0 opacity-40">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl" />
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <Badge className="mb-6 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 text-sm">
            👑 10,000+ Successful Projects
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">
            <span className="text-slate-900">ปล่อยให้</span>
            <span className="text-blue-600"> ระบบ</span>
            <span className="text-slate-900"> ทำงานแทนคุณ</span><br />
            <span className="text-slate-900">ให้คุณ</span>
            <span className="text-blue-600">พักผ่อน</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-slate-600 mb-10 leading-relaxed max-w-3xl mx-auto">
            ระบบจัดการหอพักอัตโนมัติที่ดูแลทุกอย่างให้คุณ<br />
            ตั้งแต่การสร้างบิล ส่งแจ้งเตือน ไปจนถึงรายงานทางการเงิน
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={onCtaClick}
              className="bg-blue-600 hover:bg-blue-700 text-white px-10 py-7 text-lg rounded-xl shadow-xl hover:shadow-2xl transition-all"
            >
              เข้าสู่ระบบ
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            {!isAuthenticated && (
              <Button
                size="lg"
                onClick={onTrialClick}
                variant="outline"
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-10 py-7 text-lg rounded-xl shadow-xl hover:shadow-2xl transition-all"
              >
                ขอทดลองใช้
              </Button>
            )}
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto"
        >
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              whileHover={{ y: -5, scale: 1.02 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-slate-200/50"
            >
              <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              <div className="text-3xl font-bold text-slate-900 mb-1">{stat.value}</div>
              <div className="text-sm text-slate-600">{stat.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}