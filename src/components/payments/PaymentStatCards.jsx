import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Clock, XCircle, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";

export default function PaymentStatCards({ statusFilter, setStatusFilter, totalAmounts, displayCounts }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -4 }}
        transition={{ duration: 0.3 }}
        onClick={() => setStatusFilter('all')}
        className="cursor-pointer"
      >
        <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 opacity-5" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400 to-indigo-500 opacity-10 blur-3xl" />
          <CardContent className="p-4 md:p-6 relative">
            <div className="flex items-start justify-between mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl blur-md opacity-30" />
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg">
                  <CreditCard className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1 hidden md:block">ยอดรวมทั้งหมด</p>
            <motion.p className="text-3xl font-bold text-slate-800" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
              {totalAmounts.all.toLocaleString('th-TH')}
            </motion.p>
            <p className="text-xs text-slate-500 mt-1">บาท ({displayCounts.all} รายการ)</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -4 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}
        className="cursor-pointer"
      >
        <Card className={`relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 ${statusFilter === 'pending' ? 'ring-2 ring-yellow-500' : ''}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-600 opacity-5" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-400 to-orange-500 opacity-10 blur-3xl" />
          <CardContent className="p-4 md:p-6 relative">
            <div className="flex items-start justify-between mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-2xl blur-md opacity-30" />
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 shadow-lg">
                  <Clock className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1 hidden md:block">รอชำระ</p>
            <motion.p className="text-3xl font-bold text-slate-800" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
              {totalAmounts.pending.toLocaleString('th-TH')}
            </motion.p>
            <p className="text-xs text-slate-500 mt-1">บาท ({displayCounts.pending} รายการ)</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -4 }}
        transition={{ duration: 0.3, delay: 0.2 }}
        onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')}
        className="cursor-pointer"
      >
        <Card className={`relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 ${statusFilter === 'overdue' ? 'ring-2 ring-red-500' : ''}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 opacity-5" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-400 to-red-500 opacity-10 blur-3xl" />
          <CardContent className="p-4 md:p-6 relative">
            <div className="flex items-start justify-between mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl blur-md opacity-30" />
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 shadow-lg">
                  <XCircle className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1 hidden md:block">เกินกำหนด</p>
            <motion.p className="text-3xl font-bold text-slate-800" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
              {totalAmounts.overdue.toLocaleString('th-TH')}
            </motion.p>
            <p className="text-xs text-slate-500 mt-1">บาท ({displayCounts.overdue} รายการ)</p>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ scale: 1.02, y: -4 }}
        transition={{ duration: 0.3, delay: 0.3 }}
        onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')}
        className="cursor-pointer"
      >
        <Card className={`relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300 ${statusFilter === 'paid' ? 'ring-2 ring-green-500' : ''}`}>
          <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 opacity-5" />
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-500 opacity-10 blur-3xl" />
          <CardContent className="p-4 md:p-6 relative">
            <div className="flex items-start justify-between mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl blur-md opacity-30" />
                <div className="relative p-3 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500 mb-1 hidden md:block">ชำระแล้ว</p>
            <motion.p className="text-3xl font-bold text-slate-800" initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
              {totalAmounts.paid.toLocaleString('th-TH')}
            </motion.p>
            <p className="text-xs text-slate-500 mt-1">บาท ({displayCounts.paid} รายการ)</p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}