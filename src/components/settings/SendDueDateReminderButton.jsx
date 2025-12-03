import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function SendDueDateReminderButton({ branchId, compact = false }) {
  const [sending, setSending] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    
    try {
      toast.info('กำลังส่งแจ้งเตือนวันครบกำหนด...', { duration: 3000 });
      
      const response = await base44.functions.invoke('sendDueDateReminders', {
        branch_id: branchId
      });

      const data = response.data;
      setResult(data);
      setShowDialog(true);

      if (data.success) {
        const sentCount = data.sent || 0;
        const totalCount = data.total || 0;
        const lineCount = data.lineCount || 0;
        const facebookCount = data.facebookCount || 0;

        if (sentCount > 0) {
          toast.success(
            `ส่งแจ้งเตือนสำเร็จ ${sentCount}/${totalCount} รายการ\n` +
            `(LINE: ${lineCount}, Facebook: ${facebookCount})`,
            { duration: 5000 }
          );
        } else {
          toast.info(data.message || 'ไม่มีบิลที่ต้องส่งแจ้งเตือน', { duration: 4000 });
        }
      } else {
        toast.error(data.error || 'เกิดข้อผิดพลาด');
      }
    } catch (error) {
      console.error('Send due date reminders error:', error);
      toast.error('เกิดข้อผิดพลาดในการส่งแจ้งเตือน');
      setResult({ success: false, error: error.message });
      setShowDialog(true);
    } finally {
      setSending(false);
    }
  };

  if (compact) {
    return (
      <>
        <Button
          onClick={handleSend}
          disabled={sending}
          size="sm"
          className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Bell className="w-4 h-4 mr-1" />
          )}
          {sending ? 'กำลังส่ง...' : 'ส่งแจ้งครบกำหนด'}
        </Button>

        <Dialog open={showDialog} onOpenChange={setShowDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ผลการส่งแจ้งเตือนวันครบกำหนด</DialogTitle>
            </DialogHeader>
            {result && (
              <div className="space-y-3">
                {result.success ? (
                  <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-semibold text-green-800">{result.message}</p>
                      <div className="text-sm text-green-700 mt-2 space-y-1">
                        <p>• ส่งสำเร็จ: {result.sent || 0} รายการ</p>
                        <p>• ทั้งหมด: {result.total || 0} รายการ</p>
                        {result.lineCount > 0 && <p>• LINE: {result.lineCount} รายการ</p>}
                        {result.facebookCount > 0 && <p>• Facebook: {result.facebookCount} รายการ</p>}
                        {result.enabledBranches && result.enabledBranches.length > 0 && (
                          <p className="text-xs mt-2">สาขาที่เปิดใช้งาน: {result.enabledBranches.length} สาขา</p>
                        )}
                      </div>
                      {result.errors && result.errors.length > 0 && (
                        <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                          <p className="text-xs font-semibold text-yellow-800 mb-1">ข้อผิดพลาดบางรายการ:</p>
                          <ul className="text-xs text-yellow-700 space-y-0.5">
                            {result.errors.slice(0, 5).map((err, idx) => (
                              <li key={idx}>• {err}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
                    <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">{result.message || 'เกิดข้อผิดพลาด'}</p>
                      {result.error && (
                        <p className="text-sm text-red-700 mt-1">{result.error}</p>
                      )}
                    </div>
                  </div>
                )}
                <Button onClick={() => setShowDialog(false)} className="w-full">
                  ปิด
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="bg-orange-100 p-2 rounded-lg">
          <Bell className="w-5 h-5 text-orange-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-800 mb-1">ส่งแจ้งเตือนวันครบกำหนดชำระ</h3>
          <p className="text-sm text-slate-600 mb-3">
            ส่งข้อความแจ้งเตือนไปยังผู้เช่าที่มีบิลครบกำหนดชำระวันนี้ (ทั้ง LINE และ Facebook)
          </p>
          <Button
            onClick={handleSend}
            disabled={sending}
            className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
          >
            {sending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังส่งแจ้งเตือน...
              </>
            ) : (
              <>
                <Bell className="w-4 h-4 mr-2" />
                ส่งแจ้งเตือนวันครบกำหนด
              </>
            )}
          </Button>
        </div>
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ผลการส่งแจ้งเตือนวันครบกำหนด</DialogTitle>
          </DialogHeader>
          {result && (
            <div className="space-y-3">
              {result.success ? (
                <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-green-800">{result.message}</p>
                    <div className="text-sm text-green-700 mt-2 space-y-1">
                      <p>• ส่งสำเร็จ: {result.sent || 0} รายการ</p>
                      <p>• ทั้งหมด: {result.total || 0} รายการ</p>
                      {result.lineCount > 0 && <p>• LINE: {result.lineCount} รายการ</p>}
                      {result.facebookCount > 0 && <p>• Facebook: {result.facebookCount} รายการ</p>}
                      {result.enabledBranches && result.enabledBranches.length > 0 && (
                        <p className="text-xs mt-2">สาขาที่เปิดใช้งาน: {result.enabledBranches.length} สาขา</p>
                      )}
                    </div>
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-3 p-2 bg-yellow-50 rounded border border-yellow-200">
                        <p className="text-xs font-semibold text-yellow-800 mb-1">ข้อผิดพลาดบางรายการ:</p>
                        <ul className="text-xs text-yellow-700 space-y-0.5">
                          {result.errors.slice(0, 5).map((err, idx) => (
                            <li key={idx}>• {err}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-800">{result.message || 'เกิดข้อผิดพลาด'}</p>
                    {result.error && (
                      <p className="text-sm text-red-700 mt-1">{result.error}</p>
                    )}
                  </div>
                </div>
              )}
              <Button onClick={() => setShowDialog(false)} className="w-full">
                ปิด
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}