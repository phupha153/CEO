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
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);

  const handleGenerateBills = async () => {
    if (!confirm('คุณต้องการสร้างบิลประจำเดือนนี้ใช่หรือไม่?')) {
      return;
    }

    // ⭐ รีเซ็ต AI state
    if (window.resetPaymentsAI) {
      window.resetPaymentsAI();
    }

    setGenerating(true);
    setIsCheckingAccess(true);
    
    try {
      // ✅ FIX: เช็คสิทธิ์เข้าถึง feature ก่อน (ผ่าน branch owner's plan)
      console.log('🔍 Checking branch owner access...');
      const accessCheck = await base44.functions.invoke('getBranchOwnerStatus', {
        branch_id: branchId
      });
      
      setIsCheckingAccess(false);
      
      if (!accessCheck.data || accessCheck.data.error) {
        toast.error('ไม่สามารถตรวจสอบสิทธิ์ได้: ' + (accessCheck.data?.error || 'Unknown'));
        return;
      }
      
      const ownerPlanStatus = accessCheck.data.plan_status;
      console.log('📊 Branch Owner Plan Status:', ownerPlanStatus);
      
      // ⚠️ ถ้าเจ้าของสาขาไม่มี plan หรือหมดอายุ = DENY
      if (!ownerPlanStatus || ownerPlanStatus === 'expired' || ownerPlanStatus === 'cancelled') {
        toast.error('❌ ไม่สามารถสร้างบิลได้\n\nเจ้าของสาขาไม่มีแพ็กเกจที่ใช้งานอยู่', { 
          duration: 7000 
        });
        return;
      }
      
      toast.info('กำลังสร้างบิลประจำเดือน...', { duration: 3000 });
      
      // ⭐ ไม่ใช้ force_skip_duplicate_check เพื่อให้เช็คบิลซ้ำ
      const response = await base44.functions.invoke('generateMonthlyBills', {
        branch_id: branchId,
        force: true
      });

      if (response.data?.success) {
        const created = response.data.generatedCount || response.data.created || 0;
        const skipped = response.data.skipped || 0;
        const errors = response.data.errors || [];
        const pending = response.data.pendingImageCount || 0;
        
        if (skipped > 0 && errors.length > 0) {
          toast.warning(
            `⚠️ สร้างบิลสำเร็จ ${created} รายการ, ข้าม ${skipped} รายการ\n\nข้อผิดพลาด:\n${errors.join('\n')}`,
            { duration: 10000 }
          );
        } else if (created > 0) {
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

          // ⭐ เลื่อนไปเดือนถัดไป (เฉพาะ Room View)
          if (window.moveToNextMonth) {
            window.moveToNextMonth();
          }

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
        toast.error(response.data?.error || 'เกิดข้อผิดพลาดในการสร้างบิล');
      }
    } catch (error) {
      console.error('❌ [GenerateMonthlyBillsButton] FULL ERROR:', error);
      console.error('❌ [GenerateMonthlyBillsButton] Error message:', error.message);
      console.error('❌ [GenerateMonthlyBillsButton] Error stack:', error.stack);
      console.error('❌ [GenerateMonthlyBillsButton] Response data:', error.response?.data);
      
      // ✅ FIX: แสดง error message ที่เข้าใจง่าย
      if (error.message?.includes('402')) {
        toast.error('❌ ไม่สามารถสร้างบิลได้\n\nเจ้าของสาขาไม่มีแพ็กเกจที่ใช้งานอยู่', { 
          duration: 7000 
        });
      } else {
        toast.error('เกิดข้อผิดพลาดในการสร้างบิล: ' + (error.message || 'Unknown'));
      }
    } finally {
      setGenerating(false);
      setIsCheckingAccess(false);
    }
  };

  const isLoading = generating || processingQueue || isCheckingAccess;

  if (compact) {
    return (
      <Button
        onClick={handleGenerateBills}
        disabled={isLoading || roomsNeedingBills === 0}
        size="sm"
        variant="outline"
        className="border-blue-300 text-blue-700 hover:bg-blue-50 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed h-10 w-full"
      >
        {isLoading ? (
          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
        ) : (
          <Calendar className="w-3 h-3 mr-1" />
        )}
        {isCheckingAccess ? 'ตรวจสอบ...' : roomsNeedingBills === 0 ? 'บิลครบแล้ว' : `สร้างบิล (${roomsNeedingBills})`}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleGenerateBills}
      disabled={isLoading || roomsNeedingBills === 0}
      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          {isCheckingAccess ? 'ตรวจสอบสิทธิ์...' : (processingQueue ? 'กำลังส่งบิล...' : 'กำลังสร้างบิล...')}
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