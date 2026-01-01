import React from "react";
import { Button } from "@/components/ui/button";
import { Crown, MessageSquare, ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function NoPackagePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50 to-red-50 flex items-center justify-center p-4 overflow-hidden">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-orange-300/20 to-red-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tr from-red-300/20 to-pink-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-2xl w-full"
      >
        {/* Decorative Icon */}
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400/30 via-red-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse" />
          <div className="relative w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-2xl border border-white/50 shadow-2xl flex items-center justify-center">
            <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl" />
            <Crown className="w-20 h-20 text-orange-500/80 relative z-10" />
          </div>
        </div>

        {/* Content */}
        <div className="text-center space-y-6 px-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-slate-800 mb-3">
              ยินดีต้อนรับสู่ระบบ
            </h1>
            <h2 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent mb-4">
              จัดการหอพักอัจฉริยะ
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed max-w-xl mx-auto">
              เริ่มต้นใช้งานระบบที่ช่วยให้คุณบริหารจัดการหอพักได้อย่างมืออาชีพ<br/>
              พร้อมฟีเจอร์ครบครันและใช้งานง่าย
            </p>
          </motion.div>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mt-12"
          >
            <Button
              onClick={() => navigate(createPageUrl('PackageSelection'))}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-8 text-lg font-bold rounded-2xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all group"
            >
              <Crown className="w-6 h-6 mr-3 group-hover:rotate-12 transition-transform" />
              เลือกแพ็กเกจที่เหมาะกับคุณ
              <ArrowRight className="w-5 h-5 ml-3 group-hover:translate-x-1 transition-transform" />
            </Button>
            
            <Button
              onClick={() => window.open('https://line.me/R/ti/p/@022kpkpo', '_blank')}
              variant="outline"
              className="border-2 border-orange-500 text-orange-600 hover:bg-orange-50 hover:border-orange-600 px-10 py-8 text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all group"
            >
              <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.193 0-.378-.09-.503-.234l-1.89-2.181v1.787c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.27.173-.51.43-.595.063-.021.13-.03.196-.03.195 0 .38.089.503.234l1.89 2.181V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.001zm-5.741 0c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.003zm-2.466.63H4.917c-.345 0-.63-.285-.63-.63V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629z"/>
              </svg>
              ติดต่อเจ้าหน้าที่
            </Button>
          </motion.div>

          {/* Features Preview */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-blue-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-2">Basic</h3>
              <p className="text-sm text-slate-600">เริ่มต้นง่าย ครบฟีเจอร์<br/>เหมาะสำหรับหอพักขนาดเล็ก</p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-6 border-2 border-blue-300 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-blue-800 mb-2">Pro</h3>
              <p className="text-sm text-blue-600">สำหรับธุรกิจขนาดกลาง<br/>พร้อม AI และระบบอัตโนมัติ</p>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-6 border-2 border-amber-300 shadow-xl hover:shadow-2xl transition-all hover:-translate-y-1">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-500 flex items-center justify-center mx-auto mb-4">
                <Crown className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-bold text-amber-800 mb-2">Elite</h3>
              <p className="text-sm text-amber-600">องค์กรขนาดใหญ่<br/>ไม่จำกัดผู้ใช้และสาขา</p>
            </div>
          </motion.div>

          {/* Additional Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-8 text-sm text-slate-500"
          >
            <p>💡 ทุกแพ็กเกจได้ฟีเจอร์ครบทุกอย่าง แตกต่างเพียงจำนวนผู้ใช้และสาขา</p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}