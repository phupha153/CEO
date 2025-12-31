import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export default function GenerateMonthlyBillsButton({ branchId, onSuccess, compact = false }) {
  const [generating, setGenerating] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    staleTime: 4 * 60 * 60 * 1000,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', branchId],
    queryFn: () => base44.entities.Room.filter({ branch_id: branchId }),
    enabled: !!branchId,
    staleTime: 2 * 60 * 60 * 1000,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', branchId],
    queryFn: () => base44.entities.Booking.filter({ branch_id: branchId, status: 'active' }),
    enabled: !!branchId,
    staleTime: 2 * 60 * 60 * 1000,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', branchId],
    queryFn: () => base44.entities.Payment.filter({ branch_id: branchId }),
    enabled: !!branchId,
    staleTime: 1 * 60 * 1000,
  });

  // ⭐ คำนวณจำนวนห้องที่ยังไม่มีบิลเดือนนี้
  const roomsNeedingBills = React.useMemo(() => {
    if (!rooms.length || !bookings.length || !payments.length || !configs.length) return 0;

    const branchBillConfig = configs.find(c => c.key === 'bill_generation_day' && c.branch_id === branchId);
    const globalBillConfig = configs.find(c => c.key === 'bill_generation_day' && !c.branch_id);
    const billGenerationDay = branchBillConfig ? parseInt(branchBillConfig.value) : (globalBillConfig ? parseInt(globalBillConfig.value) : 27);

    const branchPayDayConfig = configs.find(c => c.key === 'pay_day' && c.branch_id === branchId);
    const globalPayDayConfig = configs.find(c => c.key === 'pay_day' && !c.branch_id);
    const payDay = branchPayDayConfig ? parseInt(branchPayDayConfig.value) : (globalPayDayConfig ? parseInt(globalPayDayConfig.value) : 5);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let dueMonth = currentMonth;
    let dueYear = currentYear;
    if (billGenerationDay > payDay) {
      dueMonth += 1;
      if (dueMonth > 11) { dueMonth = 0; dueYear += 1; }
    }

    const targetDueYearMonth = `${dueYear}-${String(dueMonth + 1).padStart(2, '0')}`;

    const monthlyRooms = rooms.filter(r => r.room_type === 'monthly');
    const roomsWithBooking = monthlyRooms.filter(room => 
      bookings.some(b => b.room_id === room.id)
    );

    let count = 0;
    for (const room of roomsWithBooking) {
      const existingBill = payments.find(p => 
        p.room_id === room.id && 
        p.due_date && 
        p.due_date.substring(0, 7) === targetDueYearMonth
      );
      if (!existingBill) count++;
    }

    return count;
  }, [rooms, bookings, payments, configs, branchId]);

  const handleGenerateBills = async () => {
    if (!confirm('คุณต้องการสร้างบิลประจำเดือนนี้ใช่หรือไม่?')) {
      return;
    }

    setGenerating(true);
    try {
      toast.info('กำลังสร้างบิลประจำเดือน...', { duration: 3000 });
      
      // ⭐ ไม่ใช้ force_skip_duplicate_check เพื่อให้เช็คบิลซ้ำ
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
      console.error('Generate bills error:', error);
      toast.error('เกิดข้อผิดพลาดในการสร้างบิล');
    } finally {
      setGenerating(false);
    }
  };

  const isLoading = generating || processingQueue;

  if (compact) {
    return (
      <Button
        onClick={handleGenerateBills}
        disabled={isLoading || roomsNeedingBills === 0}
        size="sm"
        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
        ) : (
          <Calendar className="w-4 h-4 mr-1" />
        )}
        {processingQueue ? 'กำลังส่ง...' : generating ? 'กำลังสร้าง...' : `สร้างบิลเดือนนี้${roomsNeedingBills > 0 ? ` (${roomsNeedingBills})` : ''}`}
      </Button>
    );
  }

  return (
    <Button
      onClick={handleGenerateBills}
      disabled={isLoading || roomsNeedingBills === 0}
      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
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