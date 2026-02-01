import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar, Loader2, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function GenerateMonthlyBillsButton({ branchId, roomsNeedingBills = 0, onSuccess, compact = false }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [generating, setGenerating] = useState(false);
  const [processingQueue, setProcessingQueue] = useState(false);
  const [isCheckingAccess, setIsCheckingAccess] = useState(false);
  const [showNoTenantsDialog, setShowNoTenantsDialog] = useState(false);

  const { data: tenants = [] } = useQuery({
    queryKey: ['tenants', branchId],
    queryFn: async () => {
      if (!branchId) return [];
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Tenant',
        filters: { branch_id: branchId, status: 'active' },
        limit: 500
      });
      return response.data.data;
    },
    enabled: !!branchId,
    staleTime: 2 * 60 * 1000,
  });

  const handleGenerateBills = async () => {
    if (tenants.length === 0) {
      setShowNoTenantsDialog(true);
      return;
    }

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
      <>
        <Button
          onClick={handleGenerateBills}
          disabled={isLoading || roomsNeedingBills === 0}
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Calendar className="w-4 h-4 mr-1" />
          )}
          {isCheckingAccess ? 'ตรวจสอบสิทธิ์...' : `สร้างบิลเดือนนี้${roomsNeedingBills > 0 ? ` (${roomsNeedingBills})` : ''}`}
        </Button>

        <Dialog open={showNoTenantsDialog} onOpenChange={setShowNoTenantsDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-700">
                <AlertTriangle className="w-6 h-6" />
                ยังไม่มีผู้เช่าในระบบ
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800 mb-3">
                  ไม่สามารถสร้างบิลได้เนื่องจากยังไม่มีผู้เช่าในระบบ
                </p>
                <p className="text-sm text-amber-700">
                  กรุณาเพิ่มผู้เช่าก่อนเพื่อสร้างบิลรายเดือน
                </p>
              </div>
              <Button
                onClick={() => {
                  setShowNoTenantsDialog(false);
                  navigate(createPageUrl('Tenants'));
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              >
                <Users className="w-4 h-4 mr-2" />
                ไปหน้าจัดการผู้เช่า
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
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

      <Dialog open={showNoTenantsDialog} onOpenChange={setShowNoTenantsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="w-6 h-6" />
              ยังไม่มีผู้เช่าในระบบ
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800 mb-3">
                ไม่สามารถสร้างบิลได้เนื่องจากยังไม่มีผู้เช่าในระบบ
              </p>
              <p className="text-sm text-amber-700">
                กรุณาเพิ่มผู้เช่าก่อนเพื่อสร้างบิลรายเดือน
              </p>
            </div>
            <Button
              onClick={() => {
                setShowNoTenantsDialog(false);
                navigate(createPageUrl('Tenants'));
              }}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
            >
              <Users className="w-4 h-4 mr-2" />
              ไปหน้าจัดการผู้เช่า
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}