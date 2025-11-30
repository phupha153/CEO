import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function GenerateMonthlyBillsButton({ branchId, onSuccess, compact = false }) {
  const [generating, setGenerating] = useState(false);

  const handleGenerateBills = async () => {
    if (!confirm('คุณต้องการสร้างบิลประจำเดือนนี้ใช่หรือไม่?')) {
      return;
    }

    setGenerating(true);
    try {
      toast.info('กำลังสร้างบิลประจำเดือน...', { duration: 3000 });
      
      const response = await base44.functions.invoke('generateMonthlyBills', {
        branch_id: branchId,
        force: true
      });

      if (response.data?.success) {
        const { generatedCount, skippedDueToExistingBill, sentCount, pendingImageCount } = response.data;
        
        if (generatedCount > 0) {
          let msg = `สร้างบิลสำเร็จ ${generatedCount} รายการ`;
          if (skippedDueToExistingBill > 0) msg += ` (ข้ามที่มีแล้ว ${skippedDueToExistingBill})`;
          if (sentCount > 0) msg += ` ส่ง LINE ${sentCount} ราย`;
          else if (pendingImageCount > 0) msg += ` รอส่ง ${pendingImageCount} ราย`;
          
          toast.success(msg, { duration: 5000 });
        } else {
          toast.info(`ไม่มีบิลที่ต้องสร้างใหม่ (มีบิลอยู่แล้ว ${skippedDueToExistingBill || 0} รายการ)`, { duration: 4000 });
        }

        if (onSuccess) onSuccess();
      } else {
        toast.error(response.data?.error || 'เกิดข้อผิดพลาดในการสร้างบิล');
      }
    } catch (error) {
      console.error('Generate bills error:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้างบิล');
    } finally {
      setGenerating(false);
    }
  };

  if (compact) {
    return (
      <Button
        onClick={handleGenerateBills}
        disabled={generating}
        size="sm"
        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
      >
        {generating ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : (
          <Calendar className="w-4 h-4 mr-1" />
        )}
        {generating ? 'กำลังสร้าง...' : 'สร้างบิลเดือนนี้'}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleGenerateBills}
      disabled={generating}
      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
    >
      {generating ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          กำลังสร้างบิล...
        </>
      ) : (
        <>
          <Calendar className="w-4 h-4 mr-2" />
          สร้างบิลประจำเดือนนี้
        </>
      )}
    </Button>
  );
}