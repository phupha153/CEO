import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Trash2, Check, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function DeletionProgressDialog({ 
  open, 
  onOpenChange, 
  progress,
  isComplete,
  hasError 
}) {
  const { 
    currentEntity = '', 
    currentBatch = 0, 
    totalBatches = 0, 
    deletedCount = 0, 
    totalCount = 0,
    entityBreakdown = {},
    message = ''
  } = progress || {};

  const overallProgress = totalCount > 0 ? Math.round((deletedCount / totalCount) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl"
        onPointerDownOutside={(e) => {
          if (!isComplete) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (!isComplete) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AnimatePresence mode="wait">
              {hasError ? (
                <motion.div
                  key="error"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <AlertCircle className="w-6 h-6 text-red-600" />
                </motion.div>
              ) : isComplete ? (
                <motion.div
                  key="complete"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Check className="w-6 h-6 text-green-600" />
                </motion.div>
              ) : (
                <motion.div
                  key="loading"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                >
                  <Loader2 className="w-6 h-6 animate-spin text-red-600" />
                </motion.div>
              )}
            </AnimatePresence>
            
            <span>
              {hasError ? 'เกิดข้อผิดพลาด' : isComplete ? 'ลบข้อมูลสำเร็จ!' : 'กำลังลบข้อมูลทดสอบ...'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!isComplete && !hasError && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span className="font-medium">{message || currentEntity}</span>
                  <span className="font-bold">
                    ลบแล้ว {deletedCount.toLocaleString()} / {totalCount.toLocaleString()}
                  </span>
                </div>
                
                <div className="w-full bg-slate-200 rounded-full h-4 overflow-hidden">
                  <motion.div
                    className="bg-gradient-to-r from-red-600 to-pink-600 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${overallProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                
                <p className="text-xs text-slate-500 text-center">
                  {overallProgress}% เสร็จสมบูรณ์
                </p>
              </div>

              {currentBatch > 0 && totalBatches > 0 && (
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-sm text-blue-800">
                    📦 Batch: {currentBatch}/{totalBatches}
                  </p>
                  <div className="w-full bg-blue-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-blue-600 h-full rounded-full transition-all duration-300"
                      style={{ width: `${(currentBatch / totalBatches) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                <p className="text-sm text-amber-800 text-center">
                  ⏳ กรุณารอสักครู่... ระบบกำลังลบข้อมูลทีละ batch เพื่อความเสถียร
                </p>
              </div>
            </>
          )}

          {(isComplete || hasError) && (
            <Card className="bg-slate-50">
              <CardContent className="p-4">
                {entityBreakdown && Object.values(entityBreakdown).reduce((sum, val) => sum + val, 0) > 0 ? (
                  <>
                    <h4 className="font-semibold text-slate-800 mb-3">📊 รายละเอียดการลบ:</h4>
                    <div className="space-y-2 text-sm">
                      {Object.entries(entityBreakdown).map(([key, value]) => {
                        const labels = {
                          branches: '🏢 สาขา',
                          rooms: '🏠 ห้องพัก',
                          tenants: '👥 ผู้เช่า',
                          bookings: '📋 การจอง',
                          payments: '💰 บิล',
                          meterReadings: '📏 มิเตอร์',
                          maintenanceRequests: '🔧 แจ้งซ่อม'
                        };
                        
                        if (value > 0) {
                          return (
                            <div key={key} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                              <span className="text-slate-700">{labels[key] || key}:</span>
                              <span className="font-bold text-green-600">{value.toLocaleString()} รายการ</span>
                            </div>
                          );
                        }
                        return null;
                      })}
                      
                      <div className="border-t-2 border-slate-300 pt-2 mt-2">
                        <div className="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded font-bold">
                          <span className="text-slate-800">🗑️ รวมทั้งหมด:</span>
                          <span className="text-green-700 text-lg">
                            {Object.values(entityBreakdown).reduce((sum, val) => sum + val, 0).toLocaleString()} รายการ
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Check className="w-8 h-8 text-blue-600" />
                    </div>
                    <h4 className="font-semibold text-slate-800 mb-2">ไม่พบข้อมูลทดสอบในระบบ</h4>
                    <p className="text-sm text-slate-600">ระบบไม่มีข้อมูลที่มี tag [TEST-], TEST-, [HEAVY-], HEAVY-, [MASSIVE-], MASSIVE- หรือ "ทดสอบ"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {(isComplete || hasError) && (
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  onOpenChange(false);
                  if (!hasError) {
                    window.location.reload();
                  }
                }}
                className={hasError ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              >
                {hasError ? 'ปิด' : 'ปิดและรีเฟรช'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}