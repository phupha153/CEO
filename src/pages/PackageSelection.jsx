import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Package, Mail, MessageCircle, ArrowLeft, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { createPageUrl } from "@/utils";

export default function PackageSelection() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-400/10 to-blue-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/10 to-indigo-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          {/* Back Button */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <Button
              onClick={() => navigate(-1)}
              variant="ghost"
              className="text-slate-600 hover:text-slate-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              ย้อนกลับ
            </Button>
          </motion.div>

          <Card className="bg-white/80 backdrop-blur-2xl border border-white/60 shadow-2xl overflow-hidden rounded-3xl">
            <CardContent className="p-8 md:p-12">
              <div className="text-center">
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                  className="mb-8"
                >
                  <div className="relative w-32 h-32 mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-400/30 via-blue-400/30 to-indigo-400/30 rounded-full blur-3xl animate-pulse" />
                    <div className="relative w-full h-full rounded-full bg-gradient-to-br from-purple-500 to-blue-600 shadow-2xl flex items-center justify-center">
                      <Crown className="w-16 h-16 text-white" />
                    </div>
                  </div>
                </motion.div>

                {/* Title */}
                <motion.h1
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-3xl md:text-4xl font-bold text-slate-800 mb-4"
                >
                  🎉 อัปเกรดแพ็กเกจ
                </motion.h1>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-slate-600 mb-8 leading-relaxed text-lg"
                >
                  ต้องการอัปเกรดเป็นแพ็กเกจเต็มรูปแบบ<br />
                  หรือต่ออายุการใช้งาน?<br />
                  <span className="font-semibold text-purple-600">กรุณาติดต่อเจ้าของระบบ</span>
                </motion.p>

                {/* Features Highlight */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="mb-8 p-6 bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl border border-purple-200"
                >
                  <h3 className="text-lg font-semibold text-slate-800 mb-4">✨ ประโยชน์ที่จะได้รับ</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-sm text-slate-700">สาขาไม่จำกัด</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-sm text-slate-700">ห้องพักไม่จำกัด</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-sm text-slate-700">ส่งบิลอัตโนมัติ</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-sm text-slate-700">รายงานครบถ้วน</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-sm text-slate-700">LINE แจ้งเตือน</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-white text-xs">✓</span>
                      </div>
                      <span className="text-sm text-slate-700">Support 24/7</span>
                    </div>
                  </div>
                </motion.div>

                {/* Contact Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="space-y-3"
                >
                  <Button
                    onClick={() => window.location.href = 'mailto:support@wresidents.com?subject=ต้องการอัปเกรดแพ็กเกจ&body=สวัสดีครับ%0A%0Aผมสนใจอัปเกรดแพ็กเกจครับ'}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-6 text-lg font-semibold rounded-2xl shadow-xl"
                  >
                    <Mail className="w-5 h-5 mr-2" />
                    ติดต่อทางอีเมล
                  </Button>
                  
                  <Button
                    onClick={() => window.open('https://line.me/R/ti/p/@wresidents', '_blank')}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-6 text-lg font-semibold rounded-2xl shadow-xl"
                  >
                    <MessageCircle className="w-5 h-5 mr-2" />
                    ติดต่อทาง LINE
                  </Button>

                  <div className="pt-4">
                    <p className="text-sm text-slate-500">
                      📞 โทร: <a href="tel:0621234567" className="text-purple-600 hover:underline font-semibold">062-123-4567</a>
                    </p>
                  </div>
                </motion.div>
              </div>
            </CardContent>
          </Card>

          {/* Additional Info */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-6 text-center"
          >
            <p className="text-sm text-slate-600">
              เวลาทำการ: จันทร์-ศุกร์ 9:00-18:00 น.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}