import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AIResultCard({ aiResult, children }) {
  if (!aiResult) return null;

  // ถ้าไม่มี answer และไม่มี rooms และไม่มี children ให้ไม่แสดงการ์ด
  const hasRooms = aiResult.rooms && aiResult.rooms.length > 0;
  if (!aiResult.answer && !hasRooms && !children) return null;

  // สร้างข้อความ default ตามสถานการณ์
  let displayAnswer = aiResult.answer;
  if (!displayAnswer) {
    if (hasRooms) {
      displayAnswer = `พบห้องที่ตรงเงื่อนไข ${aiResult.rooms.length} ห้อง`;
    } else if (aiResult.action_type === 'update') {
      displayAnswer = 'พบข้อมูลที่ต้องการแก้ไข กรุณาตรวจสอบรายละเอียดด้านล่าง';
    } else if (aiResult.action_type === 'create') {
      displayAnswer = 'เตรียมสร้างรายการใหม่ กรุณาตรวจสอบรายละเอียด';
    } else {
      displayAnswer = 'ไม่พบข้อมูลที่ตรงตามเงื่อนไข';
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="bg-gradient-to-br from-purple-50 to-blue-50 border-purple-200 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-md flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-slate-800 mb-2 text-lg">คำตอบจาก AI</h4>
                {displayAnswer && (
                  <p className="text-slate-700 whitespace-pre-line leading-relaxed mb-4">{displayAnswer}</p>
                )}
                {children}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}