import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, ShoppingCart } from "lucide-react";
import { motion } from "framer-motion";
import { createPageUrl } from "@/utils";

export default function PackageExpiredPage() {
  const navigate = useNavigate();
  const selectedBranchName = localStorage.getItem('selected_branch_name') || 'สาขาของคุณ';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50 to-orange-50 overflow-hidden">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-red-400/10 to-orange-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-orange-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
      </div>

      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="text-center">
            {/* Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mb-8"
            >
              <div className="relative w-32 h-32 mx-auto">
                <div className="absolute inset-0 bg-gradient-to-br from-red-400/30 via-orange-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse" />
                <div className="relative w-full h-full rounded-full bg-gradient-to-br from-red-100 via-orange-50 to-white border border-red-200 shadow-2xl flex items-center justify-center">
                  <AlertCircle className="w-16 h-16 text-red-500" />
                </div>
              </div>
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl md:text-4xl font-bold text-slate-800 mb-3"
            >
              แพ็กเกจหมดอายุแล้ว
            </motion.h1>

            {/* Description */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-slate-600 mb-8 leading-relaxed"
            >
              "<span className="font-semibold text-slate-800">{selectedBranchName}</span>"<br />
              กรุณาต่ออายุแพ็กเกจเพื่อใช้งานต่อ
            </motion.p>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              <Button
                onClick={() => navigate(createPageUrl('RenewalPage'))}
                className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white py-6 text-lg font-semibold rounded-2xl shadow-xl"
              >
                <RefreshCw className="w-5 h-5 mr-2" />
                ต่ออายุแพ็กเกจ
              </Button>

              <Button
                onClick={() => navigate(createPageUrl('PackageSelectionPage'))}
                variant="outline"
                className="w-full bg-white/80 backdrop-blur-sm border-slate-300 hover:bg-white text-slate-700 py-6 text-base rounded-2xl"
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                เลือกแพ็กเกจใหม่
              </Button>


            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}