import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Search, X, Filter } from "lucide-react";

export default function PaymentsFilterBar({
  searchQuery,
  setSearchQuery,
  dateRangeType,
  setDateRangeType,
  statusFilter,
  setStatusFilter
}) {
  const activeFiltersCount = (statusFilter !== 'all' ? 1 : 0) + (dateRangeType !== 'this_month' ? 1 : 0);

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg sticky top-[73px] md:top-[85px] z-30">
      <CardContent className="p-3">
        <div className="flex gap-3 items-center">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input 
              placeholder="ค้นหาห้อง หรือผู้เช่า..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="pl-9 bg-white/90 shadow-inner border-slate-200 h-10" 
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                className={`gap-2 h-10 px-4 bg-white hover:bg-slate-50 border-slate-200 shadow-sm ${activeFiltersCount > 0 ? 'border-blue-300 bg-blue-50/50' : ''}`}
              >
                <Filter className={`w-4 h-4 ${activeFiltersCount > 0 ? 'text-blue-600' : 'text-slate-500'}`} />
                <span className="hidden md:inline text-slate-700">ตัวกรอง</span>
                {activeFiltersCount > 0 && (
                  <Badge 
                    variant="secondary" 
                    className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">ช่วงเวลา</Label>
                  <Select value={dateRangeType} onValueChange={setDateRangeType}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="next_month">เดือนหน้า</SelectItem>
                      <SelectItem value="this_month">เดือนนี้</SelectItem>
                      <SelectItem value="last_month">เดือนที่แล้ว</SelectItem>
                      <SelectItem value="3_months">3 เดือนล่าสุด</SelectItem>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">สถานะ</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="pending">รอชำระ</SelectItem>
                      <SelectItem value="overdue">เกินกำหนด</SelectItem>
                      <SelectItem value="paid">ชำระแล้ว</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="pt-2 border-t mt-2">
                  <Button 
                    variant="ghost" 
                    className="w-full text-slate-500 hover:text-slate-800"
                    onClick={() => {
                      setDateRangeType('this_month');
                      setStatusFilter('all');
                    }}
                  >
                    ล้างตัวกรอง
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </CardContent>
    </Card>
  );
}