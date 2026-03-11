import React from "react";
import { Loader2, DoorOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import AISearchBox from "../shared/AISearchBox";
import AIActionConfirmation from "../shared/AIActionConfirmation";
import AIResultCard from "../shared/AIResultCard";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PaymentsAISection({
  searchQuery, setSearchQuery, handleAISearch, handleStopAISearch, aiSearching,
  aiAction, handleAIActionConfirm, handleAIActionCancel, aiActionLoading,
  aiResult, payments, getEffectiveStatus, calculateLateFee, handlePaymentClick,
  dateRangeType, setDateRangeType, statusFilter, setStatusFilter
}) {
  return (
    <>
      <div className="relative w-full">
        <AISearchBox
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onAISearch={handleAISearch}
          onStopSearch={handleStopAISearch}
          aiSearching={aiSearching}
          placeholder="ค้นหาการชำระเงิน หรือถามเช่น 'สร้างบิลห้อง 101' 'รายการค้างชำระ'"
          filterNode={
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="h-9 md:h-12 w-9 md:w-12 bg-white border-slate-200 text-slate-600 rounded-xl md:rounded-2xl p-0 hover:bg-slate-50 flex items-center justify-center">
                  <Filter className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4 z-[200]" align="end">
                <div className="space-y-4">
                  <h4 className="font-medium text-slate-800 border-b pb-2">ตัวกรองเพิ่มเติม</h4>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">ช่วงเวลา</label>
                    <Select value={dateRangeType} onValueChange={setDateRangeType}>
                      <SelectTrigger className="w-full text-sm bg-white/90 shadow-sm border-slate-300 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[250]">
                        <SelectItem value="this_month">เดือนนี้</SelectItem>
                        <SelectItem value="last_month">1 เดือนที่แล้ว</SelectItem>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-700">สถานะ</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full text-sm bg-white/90 shadow-sm border-slate-300 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="z-[250]">
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        <SelectItem value="pending">รอชำระ</SelectItem>
                        <SelectItem value="overdue">เกินกำหนด</SelectItem>
                        <SelectItem value="paid">ชำระแล้ว</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          }
        />

        {aiSearching && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl mt-4">
            <div className="bg-white rounded-xl shadow-lg p-6 flex items-center gap-3">
              <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
              <p className="text-slate-700 font-medium">AI กำลังวิเคราะห์...</p>
            </div>
          </div>
        )}
      </div>

      {aiAction && (
        <AIActionConfirmation
          action={aiAction}
          onConfirm={handleAIActionConfirm}
          onCancel={handleAIActionCancel}
          isLoading={aiActionLoading}
          allowSlipUpload={true}
        />
      )}

      {aiResult && !aiAction && (
        <AIResultCard aiResult={aiResult}>
          {aiResult.payments && aiResult.payments.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-semibold text-purple-800">รายการที่เกี่ยวข้อง ({aiResult.payments.length} รายการ):</p>
              {aiResult.payments.map((item, idx) => {
                const payment = payments.find(p => p.id === item.payment_id);
                if (!payment) return null;

                const effectiveStatus = getEffectiveStatus(payment);
                const lateFee = (payment.late_fee_amount && payment.late_fee_amount > 0) ? 0 : calculateLateFee(payment);
                const totalWithLateFee = (payment.total_amount || 0) + lateFee;
                
                return (
                  <div 
                    key={idx} 
                    className="bg-white/70 rounded-lg p-3 border border-purple-200 hover:shadow-md transition-all cursor-pointer hover:border-purple-300"
                    onClick={() => handlePaymentClick(payment)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <DoorOpen className="w-4 h-4 text-purple-600" />
                          <span className="font-semibold text-slate-800">
                            ห้อง {payment.room_number || 'N/A'}
                          </span>
                          {effectiveStatus === 'paid' && <Badge className="bg-green-100 text-green-700 text-xs">ชำระแล้ว</Badge>}
                          {effectiveStatus === 'pending' && <Badge className="bg-yellow-100 text-yellow-700 text-xs">รอชำระ</Badge>}
                          {effectiveStatus === 'overdue' && <Badge className="bg-red-100 text-red-700 text-xs">เกินกำหนด</Badge>}
                          {effectiveStatus === 'partial_paid' && <Badge className="bg-orange-100 text-orange-700 text-xs">ชำระบางส่วน ({((payment.paid_amount || 0) / (payment.total_amount || 1) * 100).toFixed(0)}%)</Badge>}
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{item.reason || `ผู้เช่า: ${payment.tenant_name || 'N/A'}`}</p>
                        <div className="text-xs text-slate-500 space-y-0.5">
                          <p className="font-semibold text-blue-700">ยอดเงิน: ฿{totalWithLateFee.toLocaleString()}</p>
                          {payment.due_date && (
                            <p>ครบกำหนด: {format(parseISO(payment.due_date), 'd MMM yyyy', { locale: th })}</p>
                          )}
                          {payment.payment_date && (
                            <p>วันที่ชำระ: {format(parseISO(payment.payment_date), 'd MMM yyyy', { locale: th })}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </AIResultCard>
      )}
    </>
  );
}