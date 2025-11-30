import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain, Loader2, RefreshCw, AlertTriangle, TrendingUp, TrendingDown, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function AISummaryCard({ stats, payments, rooms, expenses, dateRangeLabel }) {
  const [summary, setSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateSummary = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const prompt = `วิเคราะห์ข้อมูลธุรกิจหอพักต่อไปนี้และสรุปเป็นภาษาไทย:

**ข้อมูลห้องพัก:**
- ห้องทั้งหมด: ${stats.totalRooms} ห้อง
- มีผู้เช่า: ${stats.occupiedRooms} ห้อง
- ว่าง: ${stats.availableRooms} ห้อง
- อัตราเข้าพัก: ${stats.occupancyRate}%

**ข้อมูลการเงิน (${dateRangeLabel}):**
- รายได้: ${stats.totalRevenue.toLocaleString()} บาท
- ค้างชำระทั้งหมด: ${stats.totalPendingAmount.toLocaleString()} บาท
- จำนวนค้างชำระ: ${stats.pendingPayments} รายการ
- เกินกำหนด: ${stats.overduePayments} รายการ
- ชำระแล้ว: ${stats.paidPayments} รายการ

**ข้อมูลเพิ่มเติม:**
- การแจ้งซ่อมที่รอดำเนินการ: ${stats.pendingMaintenanceCount} รายการ
${expenses?.length > 0 ? `- ค่าใช้จ่ายล่าสุด: ${expenses.slice(0, 5).map(e => `${e.category} ${e.amount} บาท`).join(', ')}` : ''}

กรุณาสรุปสั้นๆ ในรูปแบบ:

1. **สถานะโดยรวม** (1-2 ประโยค)
2. **จุดที่ต้องให้ความสำคัญ** (2-3 ข้อ - ถ้ามี)
3. **คำแนะนำ** (1-2 ข้อ)

ใช้ emoji ให้เหมาะสม และตอบสั้นกระชับ ไม่เกิน 200 คำ`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: prompt
      });

      setSummary(result);
    } catch (err) {
      console.error('AI Summary Error:', err);
      setError('ไม่สามารถสรุปข้อมูลได้');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 border-2 border-purple-200/50 shadow-xl rounded-3xl overflow-hidden">
      <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-purple-300/20 to-indigo-300/20 rounded-full blur-3xl" />
      
      <CardHeader className="relative pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 shadow-lg">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-800">🤖 AI สรุปภาพรวม</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">วิเคราะห์ข้อมูลด้วย AI</p>
            </div>
          </div>
          
          <Button
            onClick={generateSummary}
            disabled={isLoading}
            size="sm"
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังวิเคราะห์
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 mr-2" />
                สรุปตอนนี้
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="relative">
        <AnimatePresence mode="wait">
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-12"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-indigo-400 rounded-full blur-2xl opacity-30 animate-pulse" />
                <Loader2 className="w-12 h-12 text-purple-600 animate-spin relative" />
              </div>
              <p className="text-slate-600 mt-4 text-sm">กำลังวิเคราะห์ข้อมูล...</p>
            </motion.div>
          )}

          {error && !isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-50 border border-red-200 rounded-2xl p-4"
            >
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                  <Button
                    onClick={generateSummary}
                    size="sm"
                    variant="outline"
                    className="mt-3 border-red-300 text-red-700 hover:bg-red-50"
                  >
                    <RefreshCw className="w-3 h-3 mr-2" />
                    ลองใหม่
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {summary && !isLoading && !error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-white/80 backdrop-blur-sm rounded-2xl p-5 border border-purple-200/50"
            >
              <div className="prose prose-sm prose-slate max-w-none">
                <div className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">
                  {summary}
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-purple-200">
                <div className="flex items-center gap-1 text-xs text-purple-600">
                  <Brain className="w-3 h-3" />
                  <span>วิเคราะห์โดย AI</span>
                </div>
                <Button
                  onClick={generateSummary}
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-xs text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                >
                  <RefreshCw className="w-3 h-3 mr-1" />
                  สรุปใหม่
                </Button>
              </div>
            </motion.div>
          )}

          {!summary && !isLoading && !error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <div className="relative w-20 h-20 mx-auto mb-4">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-indigo-400 rounded-full blur-2xl opacity-20" />
                <div className="relative w-full h-full rounded-full bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
                  <Brain className="w-10 h-10 text-purple-600" />
                </div>
              </div>
              <p className="text-slate-600 text-sm mb-4">คลิกปุ่มด้านบนเพื่อให้ AI วิเคราะห์ข้อมูล</p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}