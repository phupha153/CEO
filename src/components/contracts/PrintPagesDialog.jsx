import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export default function PrintPagesDialog({ open, onOpenChange }) {
  const [printPages, setPrintPages] = useState('all');

  const handleConfirmPrint = () => {
    // ซ่อนหน้าที่ไม่ต้องการปริ้น
    const allPages = document.querySelectorAll('.contract-page');
    
    if (printPages === 'all') {
      // แสดงทุกหน้า
      allPages.forEach(page => page.style.display = 'block');
    } else if (printPages === 'page1') {
      // แสดงเฉพาะหน้า 1
      allPages.forEach((page, index) => {
        page.style.display = index === 0 ? 'block' : 'none';
      });
    } else if (printPages === 'page2') {
      // แสดงเฉพาะหน้า 2
      allPages.forEach((page, index) => {
        page.style.display = index === 1 ? 'block' : 'none';
      });
    } else if (printPages === 'page3') {
      // แสดงเฉพาะหน้า 3
      allPages.forEach((page, index) => {
        page.style.display = index === 2 ? 'block' : 'none';
      });
    } else if (printPages === 'page1-2') {
      // แสดงเฉพาะหน้า 1-2
      allPages.forEach((page, index) => {
        page.style.display = index <= 1 ? 'block' : 'none';
      });
    }
    
    onOpenChange(false);
    
    // รอให้ display update แล้วค่อย print
    setTimeout(() => {
      window.print();
      
      // คืนค่าการแสดงผลหลังปริ้นเสร็จ
      setTimeout(() => {
        allPages.forEach(page => page.style.display = 'block');
      }, 1000);
    }, 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            เลือกหน้าที่ต้องการพิมพ์
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <button
              onClick={() => setPrintPages('all')}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                printPages === 'all' 
                  ? 'border-blue-600 bg-blue-50' 
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  printPages === 'all' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                }`}>
                  {printPages === 'all' && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">พิมพ์ทั้งหมด (3 หน้า)</p>
                  <p className="text-xs text-slate-600">สัญญาฉบับเต็ม</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setPrintPages('page1')}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                printPages === 'page1' 
                  ? 'border-blue-600 bg-blue-50' 
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  printPages === 'page1' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                }`}>
                  {printPages === 'page1' && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">หน้า 1</p>
                  <p className="text-xs text-slate-600">ข้อมูลผู้เช่า + ข้อสัญญาข้อ 1-8</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setPrintPages('page2')}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                printPages === 'page2' 
                  ? 'border-blue-600 bg-blue-50' 
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  printPages === 'page2' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                }`}>
                  {printPages === 'page2' && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">หน้า 2</p>
                  <p className="text-xs text-slate-600">ข้อสัญญาข้อ 9-15 + กฎเพิ่มเติม</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setPrintPages('page3')}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                printPages === 'page3' 
                  ? 'border-blue-600 bg-blue-50' 
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  printPages === 'page3' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                }`}>
                  {printPages === 'page3' && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">หน้า 3</p>
                  <p className="text-xs text-slate-600">ลายเซ็น + หมายเหตุ</p>
                </div>
              </div>
            </button>

            <button
              onClick={() => setPrintPages('page1-2')}
              className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                printPages === 'page1-2' 
                  ? 'border-blue-600 bg-blue-50' 
                  : 'border-slate-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  printPages === 'page1-2' ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                }`}>
                  {printPages === 'page1-2' && <div className="w-2 h-2 bg-white rounded-full" />}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">หน้า 1-2</p>
                  <p className="text-xs text-slate-600">ข้อสัญญาทั้งหมด (ไม่รวมลายเซ็น)</p>
                </div>
              </div>
            </button>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button 
              onClick={handleConfirmPrint}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Printer className="w-4 h-4 mr-2" />
              พิมพ์
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}