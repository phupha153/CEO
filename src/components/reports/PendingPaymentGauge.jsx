
import React from "react";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function PendingPaymentGauge({ percentage, pendingAmount, totalPayments }) {
  // จำกัดเปอร์เซ็นต์สูงสุดที่ 10%
  const displayPercentage = Math.min(percentage, 10);
  const needleAngle = -90 + (displayPercentage / 10 * 180);
  
  // สถานะตามเปอร์เซ็นต์
  const getStatus = (percent) => {
    if (percent <= 3) return { label: 'ดีมาก', color: 'text-green-600' };
    if (percent <= 5) return { label: 'ปกติ', color: 'text-blue-600' };
    if (percent <= 8) return { label: 'ระวัง', color: 'text-orange-600' };
    return { label: 'เตือน', color: 'text-red-600' };
  };

  const status = getStatus(displayPercentage);

  return (
    <div className="w-full">
      {/* ข้อมูลด้านบน */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2 border border-blue-200/40 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">อัปเดตล่าสุด</p>
          <p className="text-sm text-slate-700 font-semibold">
            {format(new Date(), 'd MMM yyyy', { locale: th })}
          </p>
        </div>

        <div className="bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2 border border-blue-200/40 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">สถานะ</p>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${displayPercentage <= 5 ? 'bg-green-500' : displayPercentage <= 8 ? 'bg-orange-500' : 'bg-red-500'} animate-pulse`}></div>
            <p className={`text-sm font-bold ${status.color}`}>{status.label}</p>
          </div>
        </div>

        <div className="bg-white/50 backdrop-blur-sm rounded-xl px-4 py-2 border border-blue-200/40 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">ยอดรวมค้างชำระ</p>
          <p className="text-sm text-red-600 font-bold">
            ฿{pendingAmount.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Gauge ตรงกลาง */}
      <div className="flex justify-center items-center">
        <div className="relative" style={{ width: '400px', height: '220px' }}>
          {/* Glow Effect พื้นหลัง */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-72 h-72 bg-gradient-to-br from-blue-400/30 via-blue-300/20 to-blue-200/10 rounded-full blur-3xl"></div>
          </div>

          {/* SVG Gauge */}
          <svg viewBox="0 0 240 140" className="w-full h-full relative z-10">
            <defs>
              {/* Gradient หลักสำหรับ gauge - ไล่จากซ้ายไปขวา (อ่อนไปเข้ม) */}
              <linearGradient id="mainGaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.85" />
                <stop offset="30%" stopColor="#60a5fa" stopOpacity="0.9" />
                <stop offset="70%" stopColor="#3b82f6" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="1" />
              </linearGradient>

              {/* Shadow สำหรับ gauge */}
              <filter id="gaugeShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="8"/>
                <feOffset dx="0" dy="8" result="offsetblur"/>
                <feComponentTransfer>
                  <feFuncA type="linear" slope="0.4"/>
                </feComponentTransfer>
                <feMerge>
                  <feMergeNode/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* พื้นหลัง gauge - สีน้ำเงินอ่อนมากๆ */}
            <path
              d="M 40 110 A 80 80 0 0 1 200 110"
              fill="none"
              stroke="#dbeafe"
              strokeWidth="28"
              strokeLinecap="round"
              opacity="0.25"
            />

            {/* Gauge หลัก - ไล่สีน้ำเงิน */}
            <path
              d="M 40 110 A 80 80 0 0 1 200 110"
              fill="none"
              stroke="url(#mainGaugeGradient)"
              strokeWidth="28"
              strokeLinecap="round"
              strokeDasharray={`${(displayPercentage / 10) * 251.2} 251.2`}
              filter="url(#gaugeShadow)"
              className="transition-all duration-1000 ease-out"
            />

            {/* เข็มชี้ - สามเหลี่ยมสีขาวสั้น ไม่มีเงา */}
            <g transform={`rotate(${needleAngle} 120 110)`}>
              <polygon
                points="120,25 115,55 125,55"
                fill="white"
              />
            </g>
          </svg>

          {/* แสดงเปอร์เซ็นต์ใหญ่ - ขยับขึ้นมาบนเพิ่มขึ้น */}
          <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 text-center">
            <p className="text-5xl font-bold text-slate-800 leading-none">
              {percentage.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-500 font-medium mt-1">ยอดค้างชำระ</p>
          </div>
        </div>
      </div>

      {/* ข้อมูลด้านล่าง - 2 กล่อง */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        {/* กล่องซ้าย - จำนวนรายการ */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 shadow-lg">
          <p className="text-sm text-slate-600 font-medium mb-3">จำนวนรายการ</p>
          <div className="flex items-center gap-3">
            <p className="text-4xl font-bold text-slate-900">{totalPayments}</p>
            <Badge className="bg-orange-500 text-white px-3 py-1 text-sm font-semibold">
              รายการ
            </Badge>
          </div>
        </div>

        {/* กล่องขวา - ยอดเงิน */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/50 shadow-lg">
          <p className="text-sm text-slate-600 font-medium mb-3">ยอดเงิน</p>
          <div className="flex items-center gap-3">
            <p className="text-4xl font-bold text-slate-900">
              ฿{Math.floor(pendingAmount / 1000)}k
            </p>
            <Badge className="bg-slate-800 text-white px-3 py-1 text-sm font-semibold">
              {percentage.toFixed(1)}%
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}
