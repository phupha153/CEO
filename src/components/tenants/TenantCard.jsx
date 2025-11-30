import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, User, UserRound, Home, AlertTriangle, Car, Wallet } from "lucide-react";
import RatingDisplay from "./RatingDisplay";

const TenantCard = React.memo(({ 
  tenant, 
  activeBookings, 
  hasExpiringSoon, 
  avgRating,
  paymentScore, // ⭐ รับคะแนนการชำระเงิน
  vehicleCount,
  onClick,
  getRoomInfo,
  isContractExpiringSoon,
  getDaysUntilExpiry,
  lastRoomNumber,
  userRole // ⭐ เพิ่ม userRole สำหรับ debug
}) => {
  const prepaidBalance = tenant.prepaid_balance || 0;
  
  const handleCardClick = (e) => {
    e.stopPropagation();
    onClick(tenant);
  };

  return (
    <Card 
      className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl hover:shadow-2xl transition-all cursor-pointer relative z-0 group"
      onClick={handleCardClick}
    >
      {hasExpiringSoon && (
        <div className="absolute top-3 right-3 z-10">
          <div className="bg-red-500 text-white rounded-full p-1.5 animate-pulse">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      )}
      
      <CardContent className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-16 h-16 bg-gradient-to-br ${tenant.gender === 'female' ? 'from-pink-400 to-rose-500' : 'from-blue-500 to-indigo-600'} rounded-full flex items-center justify-center shadow-lg`}>
            {tenant.gender === 'female' ? (
              <UserRound className="w-8 h-8 text-white" />
            ) : (
              <User className="w-8 h-8 text-white" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold text-slate-800 line-clamp-1">{tenant.full_name}</h3>
            {activeBookings.length > 0 ? (
              <Badge className="bg-green-100 text-green-700 mt-1">
                กำลังเช่า {activeBookings.length} ห้อง
              </Badge>
            ) : tenant.status === 'moved_out' && lastRoomNumber ? (
              <Badge className="bg-slate-100 text-slate-600 mt-1">
                ผู้เช่าเก่า ห้อง {lastRoomNumber}
              </Badge>
            ) : tenant.status === 'moved_out' ? (
              <Badge className="bg-slate-100 text-slate-600 mt-1">
                ย้ายออกแล้ว
              </Badge>
            ) : null}
          </div>
        </div>

        {avgRating !== null && (
          <div className="mb-3">
            <RatingDisplay rating={avgRating} size="sm" />
          </div>
        )}

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone className="w-4 h-4" />
            <span>{tenant.phone}</span>
          </div>
          {tenant.email && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Mail className="w-4 h-4" />
              <span className="truncate">{tenant.email}</span>
            </div>
          )}
          {tenant.line_id && (
            <p className="text-sm text-slate-600 truncate">LINE: {tenant.line_id}</p>
          )}
          {vehicleCount && vehicleCount.total > 0 && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Car className="w-4 h-4" />
              <span>
                {vehicleCount.cars > 0 && `รถยนต์ ${vehicleCount.cars}`}
                {vehicleCount.cars > 0 && vehicleCount.motorcycles > 0 && ', '}
                {vehicleCount.motorcycles > 0 && `มอเตอร์ไซค์ ${vehicleCount.motorcycles}`}
              </span>
            </div>
          )}
          {prepaidBalance > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-700 font-semibold bg-green-50 px-2 py-1 rounded-lg">
              <Wallet className="w-4 h-4" />
              <span>เงินล่วงหน้า: {prepaidBalance.toLocaleString()} ฿</span>
            </div>
          )}
        </div>

        {activeBookings.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-slate-200">
            {activeBookings.slice(0, 2).map((booking) => {
              const room = getRoomInfo(booking.room_id);
              const daysLeft = getDaysUntilExpiry(booking);
              const expiringSoon = isContractExpiringSoon(booking);
              
              return (
                <div key={booking.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4" />
                    <span className="font-medium">ห้อง {room?.room_number}</span>
                  </div>
                  {expiringSoon && daysLeft !== null && (
                    <Badge className="bg-red-100 text-red-700 text-xs">
                      เหลือ {daysLeft} วัน
                    </Badge>
                  )}
                </div>
              );
            })}
            {activeBookings.length > 2 && (
              <p className="text-xs text-slate-500 text-center">และอีก {activeBookings.length - 2} ห้อง</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
});

TenantCard.displayName = 'TenantCard';

export default TenantCard;