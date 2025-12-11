import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Send, Loader2, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { toast } from "sonner";

export default function SendAdvanceReminderButton({ branchId, compact = false, pendingCount = 0 }) {
  const [isSending, setIsSending] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [result, setResult] = useState(null);

  const handleSendReminders = async () => {
    // ⭐ แสดง confirm dialog พร้อมจำนวนที่จะส่ง
    const confirmMessage = pendingCount > 0 
      ? `ต้องการส่งแจ้งเตือนไปยังผู้เช่า ${pendingCount} คนใช่หรือไม่?`
      : 'ต้องการส่งแจ้งเตือนใช่หรือไม่?';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsSending(true);
    setResult(null);
    
    try {
      const response = await base44.functions.invoke('sendAdvanceRemindersV4', {
        branch_id: branchId || null
      });
      
      setResult(response.data);
      setShowResultDialog(true);
      
      if (response.data.success) {
        if (response.data.sent > 0) {
          toast.success(`ส่งแจ้งเตือนสำเร็จ ${response.data.sent} รายการ`);
        } else {
          toast.info(response.data.message || 'ไม่มีบิลที่ต้องแจ้งเตือน');
        }
      } else {
        toast.error(response.data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Error sending reminders:', error);
      setResult({ success: false, error: error.message });
      setShowResultDialog(true);
      toast.error('เกิดข้อผิดพลาดในการส่งแจ้งเตือน');
    } finally {
      setIsSending(false);
    }
  };

  // Compact mode - แสดงเฉพาะปุ่ม
  if (compact) {
    return (
      <>
        <Button
          onClick={handleSendReminders}
          disabled={isSending || pendingCount === 0}
          size="sm"
          variant="outline"
          className="border-blue-300 text-blue-700 hover:bg-blue-50 whitespace-nowrap"
        >
          {isSending ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              กำลังส่ง...
            </>
          ) : (
            <>
              <Send className="w-3 h-3 mr-1" />
              ส่งแจ้งเตือน {pendingCount > 0 && `(${pendingCount})`}
            </>
          )}
        </Button>

        {/* Result Dialog */}
        <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {result?.success ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
                ผลการส่งแจ้งเตือน
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {result?.success ? (
                <>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <p className="text-green-800 font-semibold mb-2">
                      {result.message || 'ดำเนินการเสร็จสิ้น'}
                    </p>

                    {result.sent > 0 && (
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        <div className="bg-white rounded-lg p-3 text-center border">
                          <p className="text-2xl font-bold text-green-600">{result.sent}</p>
                          <p className="text-xs text-slate-600">ส่งสำเร็จ</p>
                        </div>
                        <div className="bg-white rounded-lg p-3 text-center border">
                          <p className="text-2xl font-bold text-slate-600">{result.total || result.sent}</p>
                          <p className="text-xs text-slate-600">ทั้งหมด</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                  <p className="text-red-800 font-semibold mb-2">เกิดข้อผิดพลาด</p>
                  <p className="text-sm text-red-700">{result?.error || 'ไม่ทราบสาเหตุ'}</p>
                </div>
              )}

              <Button
                onClick={() => setShowResultDialog(false)}
                className="w-full"
                variant="outline"
              >
                ปิด
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <>
      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-blue-800 mb-1">
              📢 ส่งแจ้งเตือนล่วงหน้าทันที
            </p>
            <p className="text-xs text-blue-700">
              ส่งข้อความแจ้งเตือนไปยังผู้เช่าทุกห้องที่มีบิลใกล้ครบกำหนด
              {branchId ? ' (เฉพาะสาขานี้)' : ' (ทุกสาขา)'}
            </p>
          </div>
          <Button
            onClick={handleSendReminders}
            disabled={isSending}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 whitespace-nowrap"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังส่ง...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                ส่งแจ้งเตือนทุกห้อง
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.success ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              ผลการส่งแจ้งเตือน
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {result?.success ? (
              <>
                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                  <p className="text-green-800 font-semibold mb-2">
                    {result.message || 'ดำเนินการเสร็จสิ้น'}
                  </p>
                  
                  {result.sent > 0 && (
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div className="bg-white rounded-lg p-3 text-center border">
                        <p className="text-2xl font-bold text-green-600">{result.sent}</p>
                        <p className="text-xs text-slate-600">ส่งสำเร็จ</p>
                      </div>
                      <div className="bg-white rounded-lg p-3 text-center border">
                        <p className="text-2xl font-bold text-slate-600">{result.total || result.sent}</p>
                        <p className="text-xs text-slate-600">ทั้งหมด</p>
                      </div>
                    </div>
                  )}
                  
                  {result.skippedDueToDisabled > 0 && (
                    <p className="text-xs text-amber-700 mt-3">
                      ⚠️ ข้าม {result.skippedDueToDisabled} รายการ (สาขาปิดการแจ้งเตือน)
                    </p>
                  )}
                </div>

                {result.enabledBranches && result.enabledBranches.length > 0 && (
                  <div className="bg-slate-50 rounded-lg p-3 border">
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      สาขาที่เปิดใช้งาน ({result.enabledBranches.length}):
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {result.enabledBranches.slice(0, 5).map((id, idx) => (
                        <span key={idx} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          {id.substring(0, 8)}...
                        </span>
                      ))}
                      {result.enabledBranches.length > 5 && (
                        <span className="text-xs text-slate-500">+{result.enabledBranches.length - 5} อื่นๆ</span>
                      )}
                    </div>
                  </div>
                )}

                {result.errors && result.errors.length > 0 && (
                  <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-xs font-semibold text-amber-800 mb-2">
                      ⚠️ พบข้อผิดพลาดบางรายการ:
                    </p>
                    <ul className="text-xs text-amber-700 space-y-1 max-h-32 overflow-y-auto">
                      {result.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>• {err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li className="text-slate-500">... และอีก {result.errors.length - 5} รายการ</li>
                      )}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                <p className="text-red-800 font-semibold mb-2">เกิดข้อผิดพลาด</p>
                <p className="text-sm text-red-700">{result?.error || 'ไม่ทราบสาเหตุ'}</p>
              </div>
            )}

            <Button
              onClick={() => setShowResultDialog(false)}
              className="w-full"
              variant="outline"
            >
              ปิด
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}