import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Send, Loader2, Image } from "lucide-react";
import { toast } from "sonner";

export default function SendAllBillsButton({ branchId, onSuccess, compact = false }) {
  const [processing, setProcessing] = useState(false);

  const handleSendAllBills = async () => {
    if (!confirm('ส่งบิลให้ทุกห้องที่รอส่ง (สร้างรูป + ส่ง LINE)?\n\nระบบจะสร้างรูปใบแจ้งหนี้และส่ง LINE ให้ทุกห้องที่ยังไม่ได้ส่ง')) {
      return;
    }

    setProcessing(true);
    try {
      toast.info('กำลังสร้างรูปและส่งบิล... (อาจใช้เวลาสักครู่)', { duration: 5000 });
      
      const response = await base44.functions.invoke('processInvoiceImageQueue', {
        branch_id: branchId,
        batch_size: 100,
        concurrent_limit: 1
      });

      if (response.data?.success) {
        const { imageGenerated, lineSent, imageFailed, lineFailed, remaining } = response.data;
        
        let msg = `สร้างรูป ${imageGenerated} ใบ, ส่ง LINE ${lineSent} ราย`;
        if (imageFailed > 0 || lineFailed > 0) {
          msg += ` (ล้มเหลว ${imageFailed + lineFailed})`;
        }
        if (remaining > 0) {
          msg += `\n\nเหลืออีก ${remaining} ใบ - รันอีกครั้งหรือรอ Cron Job`;
        }
        
        toast.success(msg, { duration: 7000 });
        if (onSuccess) onSuccess();
      } else {
        toast.error(response.data?.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Send all bills error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  if (compact) {
    return (
      <Button
        onClick={handleSendAllBills}
        disabled={processing}
        size="sm"
        className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
      >
        {processing ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : (
          <Send className="w-4 h-4 mr-1" />
        )}
        {processing ? 'กำลังส่ง...' : 'ส่งบิลทุกห้อง'}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleSendAllBills}
      disabled={processing}
      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
    >
      {processing ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          กำลังสร้างรูปและส่งบิล...
        </>
      ) : (
        <>
          <Send className="w-4 h-4 mr-2" />
          ส่งบิลทุกห้อง (สร้างรูป + LINE)
        </>
      )}
    </Button>
  );
}