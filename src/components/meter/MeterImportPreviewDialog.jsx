import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";

export default function MeterImportPreviewDialog({ open, onOpenChange, previewData, isImporting, onConfirm }) {
  const readyCount = previewData.filter(d => d.status === 'ready').length;
  const errorCount = previewData.filter(d => d.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-blue-600" />
            ตรวจสอบข้อมูลก่อนนำเข้า ({previewData.length} รายการ)
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">ห้อง</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-700">ผู้เช่า</th>
                  <th className="px-3 py-2 text-center font-semibold text-blue-700">น้ำก่อน</th>
                  <th className="px-3 py-2 text-center font-semibold text-blue-700">น้ำปัจจุบัน</th>
                  <th className="px-3 py-2 text-center font-semibold text-blue-700">ใช้</th>
                  <th className="px-3 py-2 text-center font-semibold text-yellow-700">ไฟก่อน</th>
                  <th className="px-3 py-2 text-center font-semibold text-yellow-700">ไฟปัจจุบัน</th>
                  <th className="px-3 py-2 text-center font-semibold text-yellow-700">ใช้</th>
                  <th className="px-3 py-2 text-center font-semibold text-slate-700">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewData.map((item, idx) => (
                  <tr key={idx} className={item.status === 'error' ? 'bg-red-50' : 'hover:bg-slate-50'}>
                    <td className="px-3 py-2 font-medium text-slate-800">{item.roomNumber}</td>
                    <td className="px-3 py-2 text-slate-600">{item.tenantName}</td>
                    <td className="px-3 py-2 text-center text-slate-600">{item.waterPrevious.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center font-bold text-blue-600">{item.waterCurrent.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center"><Badge className="bg-blue-100 text-blue-700">{item.waterUnits.toFixed(1)}</Badge></td>
                    <td className="px-3 py-2 text-center text-slate-600">{item.electricityPrevious.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center font-bold text-yellow-600">{item.electricityCurrent.toFixed(1)}</td>
                    <td className="px-3 py-2 text-center"><Badge className="bg-yellow-100 text-yellow-700">{item.electricityUnits.toFixed(1)}</Badge></td>
                    <td className="px-3 py-2 text-center">
                      {item.status === 'ready' ? (
                        <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />พร้อม</Badge>
                      ) : (
                        <Badge className="bg-red-100 text-red-700"><AlertTriangle className="w-3 h-3 mr-1" />ผิดพลาด</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="border-t pt-4 flex justify-between items-center">
          <div className="text-sm text-slate-600">
            พร้อมนำเข้า: <span className="font-bold text-green-600">{readyCount}</span> รายการ
            {errorCount > 0 && <span className="ml-3">ข้อผิดพลาด: <span className="font-bold text-red-600">{errorCount}</span></span>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>ยกเลิก</Button>
            <Button onClick={onConfirm} className="bg-gradient-to-r from-green-600 to-emerald-600" disabled={readyCount === 0 || isImporting}>
              {isImporting ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังนำเข้า...</>) : (<><CheckCircle className="w-4 h-4 mr-2" />ยืนยันนำเข้า ({readyCount})</>)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}