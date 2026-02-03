import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function DeleteAccountSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const handleDeleteAccount = async () => {
    if (!isConfirmed) {
      toast.error("กรุณายืนยันการลบบัญชี");
      return;
    }

    setIsDeleting(true);
    try {
      await base44.auth.deleteAccount();
      toast.success("บัญชีของคุณถูกลบแล้ว");
      setTimeout(() => {
        base44.auth.logout();
      }, 1000);
    } catch (error) {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="mt-8 p-6 border-t border-red-200 bg-red-50 rounded-lg">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-red-900 mb-2">ลบบัญชี</h3>
            <p className="text-sm text-red-800 mb-4">
              การลบบัญชีถาวรจะลบข้อมูลของคุณทั้งหมด ไม่สามารถกู้คืนได้
            </p>
            <Button
              onClick={() => setIsOpen(true)}
              variant="destructive"
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              ลบบัญชีของฉัน
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600">
              ยืนยันการลบบัญชี
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm space-y-3">
              <p>
                ⚠️ <span className="font-bold">การกระทำนี้ไม่สามารถย้อนกลับได้</span>
              </p>
              <p>
                บัญชี ข้อมูล และทั้งหมดที่เกี่ยวข้องจะถูกลบอย่างถาวร
              </p>
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isConfirmed}
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                    className="mt-1"
                  />
                  <span className="text-xs text-red-800">
                    ฉันเข้าใจว่าการลบบัญชีนี้ถาวรและไม่สามารถกู้คืนได้
                  </span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setIsConfirmed(false)}>
              ยกเลิก
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={!isConfirmed || isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? "กำลังลบ..." : "ลบบัญชี"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}