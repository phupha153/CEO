import React from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Save, X } from "lucide-react";
import SignaturePad from '../shared/SignaturePad';

export default function SignatureDialog({
  open,
  onOpenChange,
  currentSignatureType,
  hasReadContract,
  setHasReadContract,
  signaturePadRef,
  onSave
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            ลงลายเซ็น {currentSignatureType === 'tenant' ? 'ผู้เช่า' : 
                       currentSignatureType === 'landlord' ? 'ผู้ให้เช่า' : 
                       currentSignatureType === 'witness1' ? 'พยาน ๑' : 'พยาน ๒'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-amber-900 text-base mb-2">
                  คำเตือนสำคัญ: กรุณาอ่านสัญญาก่อนลงนาม
                </h4>
                <p className="text-sm text-amber-800 mb-3 leading-relaxed">
                  โปรดอ่านและทำความเข้าใจข้อตกลงและเงื่อนไขทั้งหมดในสัญญาเช่านี้อย่างละเอียด 
                  ก่อนลงลายมือชื่อ การลงลายมือชื่อถือเป็นการยืนยันว่าท่านได้อ่าน เข้าใจ 
                  และตกลงยินยอมปฏิบัติตามข้อกำหนดทั้งหมดในสัญญาฉบับนี้
                </p>
                
                <div className="flex items-start gap-2 p-3 bg-white rounded-lg border border-amber-300">
                  <Checkbox
                    id="confirm-read"
                    checked={hasReadContract}
                    onCheckedChange={setHasReadContract}
                    className="mt-0.5"
                  />
                  <label 
                    htmlFor="confirm-read" 
                    className="text-sm font-medium text-slate-800 cursor-pointer leading-relaxed"
                  >
                    ข้าพเจ้าได้อ่านและทำความเข้าใจข้อตกลงและเงื่อนไขทั้งหมดในสัญญาเช่าฉบับนี้แล้ว 
                    และยินยอมที่จะปฏิบัติตามข้อกำหนดดังกล่าว
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              💡 วาดลายเซ็นของคุณในกรอบด้านล่าง ลายเซ็นจะถูกวางในตำแหน่งที่ถูกต้องบนสัญญาโดยอัตโนมัติ
            </p>
          </div>
          
          <div className="w-full h-64 border-2 border-slate-300 rounded-lg bg-white">
            <SignaturePad ref={signaturePadRef} className="w-full h-full" />
          </div>
          
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => signaturePadRef.current?.clear()}
            >
              <X className="w-4 h-4 mr-2" />
              ล้าง
            </Button>
            <Button
              type="button"
              onClick={onSave}
              disabled={!hasReadContract}
              className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title={!hasReadContract ? 'กรุณายืนยันว่าได้อ่านสัญญาแล้ว' : ''}
            >
              <Save className="w-4 h-4 mr-2" />
              บันทึกลายเซ็น
            </Button>
          </div>
          
          {!hasReadContract && (
            <p className="text-xs text-amber-600 text-center">
              ⚠️ กรุณาติ๊กยืนยันว่าได้อ่านและเข้าใจสัญญาแล้ว เพื่อดำเนินการลงลายเซ็น
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}