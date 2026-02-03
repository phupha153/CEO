import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, DoorOpen, CreditCard, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

const NAV_ITEMS = [
  { label: "แดชบอร์ด", icon: LayoutDashboard, url: createPageUrl("Dashboard") },
  { label: "ห้องพัก", icon: DoorOpen, url: createPageUrl("Rooms") },
  { label: "การชำระเงิน", icon: CreditCard, url: createPageUrl("Payments") },
  { label: "ประกาศ", icon: MessageSquare, url: createPageUrl("Announcements") },
];

export default function BottomNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 md:hidden bg-white/95 backdrop-blur-xl border-t border-white/50 shadow-2xl z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-center justify-around px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.url;
          const Icon = item.icon;

          return (
            <motion.button
              key={item.url}
              onClick={() => navigate(item.url)}
              whileTap={{ scale: 0.9 }}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all"
            >
              <div
                className={`relative p-2 rounded-lg transition-all ${
                  isActive
                    ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg"
                    : "text-slate-600"
                }`}
              >
                <Icon className="w-5 h-5" />
                {isActive && (
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 -z-10"
                  />
                )}
              </div>
              <span className={`text-[10px] font-semibold ${isActive ? "text-blue-600" : "text-slate-600"}`}>
                {item.label}
              </span>
            </motion.button>
          );
        })}
      </div>
    </nav>
  );
}