import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function GenerateMonthlyBillsButton({ branchId, roomsNeedingBills = 0, onSuccess, compact = false }) {
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);

  // ⭐ Debug: Log ค่า props ที่ได้มา
  console.log('🔘 [GenerateMonthlyBillsButton] Props:', {
    branchId,
    roomsNeedingBills,
    generating,
    processingQueue,
    isLoading: generating || processingQueue,
    isDisabled: (generating || processingQueue || roomsNeedingBills === 0)
  });

  const handleGenerateBills = async () => {
    if (!confirm('คุณต้องการสร้างบิลประจำเดือนนี้ใช่หรือไม่?')) {
      return;
    }

    // ⭐ รีเซ็ต AI state
    if (window.resetPaymentsAI) {
      window.resetPaymentsAI();
    }

    setGenerating(true);
    
    // ⭐ แสดง toast ที่อยู่นานกว่า เพื่อให้เห็น loading state
    const loadingToast = toast.loading('🔄 กำลังสร้างบิลประจำเดือน...', { duration: Infinity });
    
    try {
      console.log('📤 [GENERATE BILLS] Calling backend...', { branch_id: branchId });
      
      const response = await base44.functions.invoke('generateMonthlyBills', {
        branch_id: branchId,
        force: true
      });
      
      console.log('📥 [GENERATE BILLS] Response:', response.data);
      
      // ⭐ ปิด loading toast ก่อน
      toast.dismiss(loadingToast);

      if (response.data?.success) {
        const created = response.data.generatedCount || response.data.created || 0;
        const pending = response.data.pendingImageCount || 0;
        
        if (created > 0) {
          toast.success(
            `สร้างบิลสำเร็จ ${created} รายการ${pending > 0 ? ` (รอสร้างรูป ${pending} ใบ)` : ''}`,
            { duration: 5000 }
          );

          // ⭐ Invalidate ทุก query ที่เกี่ยวข้อง
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['payments-count'] }),
            queryClient.invalidateQueries({ queryKey: ['payments-filtered'] }),
            queryClient.invalidateQueries({ queryKey: ['payments-room-view'] }),
            queryClient.invalidateQueries({ queryKey: ['payments'] })
          ]);

          // ⭐ ถ้ามีบิลที่ต้องสร้างรูป = ถามว่าจะส่งทันทีไหม
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
        // ⭐ แสดง error ละเอียดพร้อมรายละเอียดจาก backend
        const errorMsg = response.data?.message || response.data?.error || 'เกิดข้อผิดพลาดในการสร้างบิล';
        console.error('❌ [GENERATE BILLS] Backend error:', {
          message: errorMsg,
          data: response.data
        });
        
        toast.error(errorMsg, { 
          duration: 15000, // ⭐ แสดงนาน 15 วินาที
          description: response.data?.details ? JSON.stringify(response.data.details).substring(0, 100) : 'กรุณาดูรายละเอียดใน Console (F12)'
        });
      }
    } catch (error) {
      console.error('========================================');
      console.error('❌ [GENERATE BILLS] Frontend Error:');
      console.error('========================================');
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      console.error('Details:', {
        branchId,
        timestamp: new Date().toISOString()
      });
      console.error('========================================');
      
      // ⭐ ปิด loading toast ถ้ายังเปิดอยู่
      toast.dismiss(loadingToast);
      
      toast.error(`❌ เกิดข้อผิดพลาด: ${error.message}`, { 
        duration: 15000,
        description: 'กรุณาดูรายละเอียดใน Console (F12) และส่งให้ผู้ดูแลระบบ'
      });
    } finally {
      setGenerating(false);
      console.log('🏁 [GENERATE BILLS] Process completed');
    }
  };

  const isLoading = generating || processingQueue;

  if (compact) {
    // ⭐ -1 = loading, 0 = no rooms, >0 = has rooms
    const isLoadingRooms = roomsNeedingBills === -1;
    const hasNoRooms = roomsNeedingBills === 0;
    const isDisabled = isLoading || hasNoRooms;

    return (
      <Button
        onClick={handleGenerateBills}
        disabled={isDisabled}
        size="sm"
        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : isLoadingRooms ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : (
          <Calendar className="w-4 h-4 mr-1" />
        )}
        สร้างบิลเดือนนี้{roomsNeedingBills > 0 ? ` (${roomsNeedingBills})` : isLoadingRooms ? ' (...)' : ''}
      </Button>
    );
  }

  // ⭐ -1 = loading, 0 = no rooms, >0 = has rooms
  const isLoadingRooms = roomsNeedingBills === -1;
  const hasNoRooms = roomsNeedingBills === 0;
  const isDisabled = isLoading || hasNoRooms;

  return (
    <Button
      onClick={handleGenerateBills}
      disabled={isDisabled}
      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {processingQueue ? 'กำลังส่งบิล...' : 'กำลังสร้างบิล...'}
        </>
      ) : isLoadingRooms ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          กำลังโหลด...
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