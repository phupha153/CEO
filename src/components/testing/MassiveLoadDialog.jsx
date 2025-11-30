import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function MassiveLoadDialog({ open, progress, status, message, results }) {
  const getStatusIcon = () => {
    if (status === 'completed') return <CheckCircle2 className="w-8 h-8 text-green-500" />;
    if (status === 'error') return <AlertCircle className="w-8 h-8 text-red-500" />;
    return <Loader2 className="w-8 h-8 animate-spin text-purple-600" />;
  };

  const getStatusColor = () => {
    if (status === 'completed') return 'from-green-500 to-emerald-500';
    if (status === 'error') return 'from-red-500 to-orange-500';
    return 'from-purple-500 to-pink-500';
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent 
        className="max-w-2xl" 
        onPointerDownOutside={(e) => {
          if (status === 'running') {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (status === 'running') {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getStatusColor()} flex items-center justify-center shadow-lg`}>
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl">🔥 MASSIVE LOAD TEST</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status Icon */}
          <div className="flex justify-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={status}
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ duration: 0.5 }}
              >
                {getStatusIcon()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Progress Bar */}
          {status === 'running' && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">ความคืบหน้า</span>
                <span className="font-bold text-purple-600">{progress}%</span>
              </div>
              <Progress value={progress} className="h-3" />
            </div>
          )}

          {/* Message */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
              {message}
            </p>
          </div>

          {/* Results */}
          {results && (
            <AnimatePresence>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-2 md:grid-cols-4 gap-3"
              >
                {results.branches > 0 && (
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 text-center">
                    <p className="text-2xl font-bold text-blue-700">{results.branches}</p>
                    <p className="text-xs text-blue-600 mt-1">🏢 สาขา</p>
                  </div>
                )}
                {results.rooms > 0 && (
                  <div className="bg-purple-50 rounded-lg p-3 border border-purple-200 text-center">
                    <p className="text-2xl font-bold text-purple-700">{results.rooms.toLocaleString()}</p>
                    <p className="text-xs text-purple-600 mt-1">🏠 ห้อง</p>
                  </div>
                )}
                {results.tenants > 0 && (
                  <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-center">
                    <p className="text-2xl font-bold text-green-700">{results.tenants.toLocaleString()}</p>
                    <p className="text-xs text-green-600 mt-1">👥 ผู้เช่า</p>
                  </div>
                )}
                {results.bookings > 0 && (
                  <div className="bg-orange-50 rounded-lg p-3 border border-orange-200 text-center">
                    <p className="text-2xl font-bold text-orange-700">{results.bookings.toLocaleString()}</p>
                    <p className="text-xs text-orange-600 mt-1">📋 จอง</p>
                  </div>
                )}
                {results.payments > 0 && (
                  <div className="bg-pink-50 rounded-lg p-3 border border-pink-200 text-center">
                    <p className="text-2xl font-bold text-pink-700">{results.payments.toLocaleString()}</p>
                    <p className="text-xs text-pink-600 mt-1">💰 บิล</p>
                  </div>
                )}
                {results.meterReadings > 0 && (
                  <div className="bg-cyan-50 rounded-lg p-3 border border-cyan-200 text-center">
                    <p className="text-2xl font-bold text-cyan-700">{results.meterReadings.toLocaleString()}</p>
                    <p className="text-xs text-cyan-600 mt-1">📏 มิเตอร์</p>
                  </div>
                )}
                {results.maintenance > 0 && (
                  <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-center">
                    <p className="text-2xl font-bold text-red-700">{results.maintenance.toLocaleString()}</p>
                    <p className="text-xs text-red-600 mt-1">🔧 ซ่อม</p>
                  </div>
                )}
                {results.total > 0 && (
                  <div className="bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg p-3 text-center text-white shadow-lg">
                    <p className="text-2xl font-bold">{results.total.toLocaleString()}</p>
                    <p className="text-xs mt-1 opacity-90">📦 รวม</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Performance */}
          {results?.performance && (
            <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
              <p className="text-xs text-purple-800 font-semibold mb-2">⚡ ประสิทธิภาพ:</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-purple-700">
                <div>⏱️ เวลา: {results.performance.totalTime}</div>
                <div>🚀 {results.performance.paymentsPerSecond} บิล/วินาที</div>
              </div>
            </div>
          )}

          {/* Close button */}
          {(status === 'completed' || status === 'error') && (
            <div className="flex justify-end">
              <Button
                onClick={() => window.location.reload()}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                ปิดและรีเฟรชหน้า
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}