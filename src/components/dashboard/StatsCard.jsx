import React from "react";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";

export default function StatsCard({ title, value, icon: Icon, gradient, change }) {
  const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden bg-white/60 backdrop-blur-xl border-white/50 shadow-xl hover:shadow-2xl transition-all duration-300">
        {/* Animated gradient background */}
        <div className={`absolute inset-0 ${gradient} opacity-5`} />
        <div className={`absolute top-0 right-0 w-32 h-32 ${gradient} opacity-10 blur-3xl`} />
        
        <div className="p-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div className="relative">
              <div className={`absolute inset-0 ${gradient} rounded-2xl blur-md opacity-30`} />
              <div className={`relative p-3 rounded-2xl ${gradient} shadow-lg`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
            {change && (
              <motion.span 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  change > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {change > 0 ? '+' : ''}{change}%
              </motion.span>
            )}
          </div>
          <p className="text-sm font-medium text-slate-500 mb-1">{title}</p>
          <motion.p 
            className="text-3xl font-bold text-slate-800"
            initial={{ scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
          >
            {displayValue}
          </motion.p>
        </div>
      </Card>
    </motion.div>
  );
}