import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Gauge, Zap, Droplets, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function MeterStatCards({ roomsCount, totalElectricity, totalWater, monthCount }) {
  const cards = [
    { icon: Gauge, gradient: "from-indigo-500 to-purple-600", label: "ห้องที่มีการบันทึก", value: roomsCount, unit: "ห้อง" },
    { icon: Zap, gradient: "from-yellow-500 to-orange-600", label: "ไฟฟ้าใช้ทั้งหมด", value: totalElectricity.toLocaleString('th-TH'), unit: `หน่วย (${monthCount} รายการ)` },
    { icon: Droplets, gradient: "from-cyan-500 to-blue-600", label: "น้ำใช้ทั้งหมด", value: totalWater.toLocaleString('th-TH'), unit: `หน่วย (${monthCount} รายการ)` },
    { icon: CheckCircle, gradient: "from-green-500 to-emerald-600", label: "บันทึกเดือนนี้", value: monthCount, unit: "ห้อง" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map(({ icon: Icon, gradient, label, value, unit }, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ scale: 1.02, y: -4 }} transition={{ duration: 0.3, delay: i * 0.1 }}>
          <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5`} />
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gradient} opacity-10 blur-3xl`} />
            <CardContent className="p-4 md:p-6 relative">
              <div className="flex items-start justify-between mb-4">
                <div className="relative">
                  <div className={`absolute inset-0 bg-gradient-to-br ${gradient} rounded-2xl blur-md opacity-30`} />
                  <div className={`relative p-3 rounded-2xl bg-gradient-to-br ${gradient} shadow-lg`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-500 mb-1 hidden md:block">{label}</p>
              <motion.p className="text-3xl font-bold text-slate-800" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
                {value}
              </motion.p>
              <p className="text-xs text-slate-500 mt-1">{unit}</p>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}