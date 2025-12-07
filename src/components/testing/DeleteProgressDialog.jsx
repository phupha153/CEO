import React, { useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function DeleteProgressDialog({ open, onClose, branchId }) {
  const [progress, setProgress] = React.useState(null);
  const [loading, setLoading] = React.useState(false);

  useEffect(() => {
    if (!open || !branchId) return;

    const checkProgress = async () => {
      try {
        const response = await base44.functions.invoke('getDeleteProgress', { branch_id: branchId });
        setProgress(response.data);
      } catch (error) {
        console.error('Error checking progress:', error);
      }
    };

    checkProgress();
    const interval = setInterval(checkProgress, 5000); // ทุก 5 วินาที

    return () => clearInterval(interval);
  }, [open, branchId]);

  if (!progress) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>กำลังโหลดข้อมูล...</DialogTitle>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const percentage = progress.initial > 0 ? ((progress.deleted / progress.initial) * 100).toFixed(1) : 0;
  const isComplete = progress.completed || progress.remaining === 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isComplete ? '✅ ลบเสร็จสิ้น' : '🗑️ กำลังลบข้อมูล'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-slate-600">ความคืบหน้า</span>
              <span className="font-semibold text-slate-800">{percentage}%</span>
            </div>
            <Progress value={parseFloat(percentage)} className="h-2" />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-green-600 text-xs mb-1">ลบแล้ว</p>
              <p className="font-bold text-green-700 text-lg">{progress.deleted.toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <p className="text-blue-600 text-xs mb-1">คงเหลือ</p>
              <p className="font-bold text-blue-700 text-lg">{progress.remaining.toLocaleString()}</p>
            </div>
          </div>

          {progress.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="w-4 h-4" />
                <span className="text-sm font-medium">เกิดข้อผิดพลาด</span>
              </div>
              <p className="text-xs text-red-600 mt-1">{progress.error}</p>
            </div>
          )}

          {isComplete && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">ลบเสร็จสิ้นแล้ว!</span>
              </div>
              <p className="text-xs text-green-600 mt-1">
                ลบทั้งหมด {progress.deleted.toLocaleString()} รายการ
              </p>
            </div>
          )}

          <Button onClick={onClose} className="w-full">
            {isComplete ? 'ปิด' : 'ปิดหน้าต่าง'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}