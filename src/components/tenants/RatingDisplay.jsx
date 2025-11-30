import React from "react";
import { Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function RatingDisplay({ rating, size = "md", showText = true }) {
  if (!rating || rating === 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-0.5">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} text-slate-300`} />
          ))}
        </div>
        {showText && <span className="text-sm text-slate-400">ยังไม่มีคะแนน</span>}
      </div>
    );
  }

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  const getTextColor = () => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-blue-600';
    if (rating >= 2.5) return 'text-yellow-600';
    if (rating >= 1.5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getBadgeColor = () => {
    if (rating >= 4.5) return 'bg-green-100 text-green-700';
    if (rating >= 3.5) return 'bg-blue-100 text-blue-700';
    if (rating >= 2.5) return 'bg-yellow-100 text-yellow-700';
    if (rating >= 1.5) return 'bg-orange-100 text-orange-700';
    return 'bg-red-100 text-red-700';
  };

  const getText = () => {
    if (rating >= 4.5) return 'ดีเยี่ยม';
    if (rating >= 3.5) return 'ดี';
    if (rating >= 2.5) return 'พอใช้';
    if (rating >= 1.5) return 'ควรปรับปรุง';
    return 'ไม่ดี';
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} ${
              i < fullStars ? 'fill-yellow-400 text-yellow-400' :
              i === fullStars && hasHalfStar ? 'fill-yellow-400 text-yellow-400 opacity-50' :
              'text-slate-300'
            }`}
          />
        ))}
      </div>
      {showText && (
        <>
          <span className={`font-bold ${getTextColor()}`}>
            {rating.toFixed(1)}
          </span>
          <Badge className={`${getBadgeColor()} text-xs`}>
            {getText()}
          </Badge>
        </>
      )}
    </div>
  );
}