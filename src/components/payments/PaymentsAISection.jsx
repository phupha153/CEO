import React from "react";
import { Loader2, DoorOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import AISearchBox from "../shared/AISearchBox";
import AIActionConfirmation from "../shared/AIActionConfirmation";
import AIResultCard from "../shared/AIResultCard";

export default function PaymentsAISection({
  searchQuery, setSearchQuery, handleAISearch, handleStopAISearch, aiSearching,
  aiAction, handleAIActionConfirm, handleAIActionCancel, aiActionLoading,
  aiResult, payments, getEffectiveStatus, calculateLateFee, handlePaymentClick,
  filterNode = null
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
          filterNode={filterNode}
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