import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function GenerateMonthlyBillsButton({ branchId, roomsNeedingBills = 0, onSuccess, compact = false }) {
  const [generating, setGenerating] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [useQueue, setUseQueue] = useState(false);

  const handleGenerateBills = async () => {
    const message = useQueue 
      ? 'เพิ่ม job เข้า Queue?\n\n✅ ไม่มี timeout risk\n✅ ประมวลผลทีละ job\n\n(คลิก OK เพื่อเพิ่มเข้า Queue)'
      : 'คุณต้องการสร้างบิลประจำเดือนนี้ใช่หรือไม่?\n\n⚠️ สร้างทันที (อาจ timeout ถ้าข้อมูลเยอะ)';

    if (!confirm(message)) {
      return;
    }

    // ⭐ รีเซ็ต AI state
    if (window.resetPaymentsAI) {
      window.resetPaymentsAI();
    }

    setGenerating(true);
    try {
      if (useQueue) {
        toast.info('กำลังเพิ่มเข้า Queue...', { duration: 2000 });
        
        const response = await base44.functions.invoke('queueBillGeneration', {
          branch_id: branchId,
          force: true
        });

        if (response.data?.success) {
          toast.success(
            `✅ ${response.data.message}\n\nJob ID: ${response.data.job_id}`,
            { duration: 6000 }
          );

          // ⚡ Refetch Queue ทันที
          const { queryClient } = await import('@tanstack/react-query');
          const qc = queryClient.getQueryClient?.() || (await import('@/api/base44Client')).queryClient;
          if (qc) {
            await qc.invalidateQueries({ queryKey: ['invoiceQueue'] });
          }

          if (onSuccess) onSuccess();
        } else {
          toast.error(response.data?.message || 'เพิ่ม Queue ไม่สำเร็จ');
        }
      } else {
        toast.info('กำลังสร้างบิลประจำเดือน...', { duration: 3000 });
        
        const response = await base44.functions.invoke('generateMonthlyBills', {
          branch_id: branchId,
          force: true
        });

        if (response.data?.success) {
          const created = response.data.generatedCount || response.data.created || 0;
          const pending = response.data.pendingImageCount || 0;
          
          if (created > 0) {
            toast.success(
              `สร้างบิลสำเร็จ ${created} รายการ${pending > 0 ? ` (รอสร้างรูป ${pending} ใบ)` : ''}`,
              { duration: 5000 }
            );

            if (pending > 0) {
              const shouldSend = confirm(`ต้องการสร้างรูปและส่ง LINE ทันทีไหม?\n(${pending} ใบ - ใช้เวลาประมาณ ${Math.ceil(pending * 2)} วินาที)`);
              
              if (shouldSend) {
                setProcessingQueue(true);
                toast.info('กำลังสร้างรูปและส่ง LINE...', { duration: 3000 });
                
                try {
                  const queueResponse = await base44.functions.invoke('processInvoiceImageQueue', {
                    branch_id: branchId,
                    batch_size: pending,
                    concurrent_limit: 1
                  });
                  
                  if (queueResponse.data?.success) {
                    const sent = queueResponse.data.lineSent || 0;
                    const failed = queueResponse.data.lineFailed || 0;
                    toast.success(`ส่งสำเร็จ ${sent} ใบ${failed > 0 ? `, ล้มเหลว ${failed}` : ''}`, { duration: 5000 });
                  }
                } catch (queueError) {
                  toast.error('เกิดข้อผิดพลาดในการส่งบิล');
                } finally {
                  setProcessingQueue(false);
                }
              }
            }
          } else {
            toast.info('ไม่มีบิลที่ต้องสร้างใหม่', { duration: 4000 });
          }

          if (onSuccess) onSuccess();
        } else {
          toast.error(response.data?.error || 'เกิดข้อผิดพลาดในการสร้างบิล');
        }
      }
    } catch (error) {
      console.error('Generate bills error:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้างบิล');
    } finally {
      setGenerating(false);
    }
  };

  const isLoading = generating || processingQueue;

  if (compact) {
    return (
      <div className="flex gap-2">
        <Button
          onClick={() => {
            setUseQueue(false);
            handleGenerateBills();
          }}
          disabled={isLoading || roomsNeedingBills === 0}
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          {isLoading && !useQueue ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Calendar className="w-4 h-4 mr-1" />
          )}
          สร้างบิลเดือนนี้{roomsNeedingBills > 0 ? ` (${roomsNeedingBills})` : ''}
        </Button>
        <Button
          onClick={() => {
            setUseQueue(true);
            handleGenerateBills();
          }}
          disabled={isLoading || roomsNeedingBills === 0}
          size="sm"
          variant="outline"
          className="border-purple-300 text-purple-700 hover:bg-purple-50"
        >
          {isLoading && useQueue ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Plus className="w-4 h-4 mr-1" />
          )}
          Queue
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={() => {
        setUseQueue(false);
        handleGenerateBills();
      }}
      disabled={isLoading || roomsNeedingBills === 0}
      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {processingQueue ? 'กำลังส่งบิล...' : 'กำลังสร้างบิล...'}
        </>
      ) : (
        <>
          <Calendar className="w-4 h-4 mr-2" />
          สร้างบิลประจำเดือนนี้{roomsNeedingBills > 0 ? ` (${roomsNeedingBills})` : ''}
        </>
      )}
    </Button>
  );
}