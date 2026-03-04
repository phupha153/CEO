import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, FileText } from "lucide-react";

export default function PrintDialog({ open, onOpenChange, onPrint }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm bg-white sm:rounded-xl shadow-2xl border-0 z-[9999]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-blue-600" />
            เลือกหน้าที่จะพิมพ์
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          <Button 
            variant="outline" 
            className="justify-start h-auto py-3 px-4 hover:bg-blue-50 hover:border-blue-300"
            onClick={() => onPrint('all')}
          >
            <FileText className="w-5 h-5 mr-3 text-slate-500" />
            <div className="text-left">
              <div className="font-semibold text-slate-800">พิมพ์ทั้งหมด (3 หน้า)</div>
              <div className="text-xs text-slate-500">สัญญาครบชุด</div>
            </div>
          </Button>
          
          <Button 
            variant="outline" 
            className="justify-start h-auto py-3 px-4 hover:bg-blue-50 hover:border-blue-300"
            onClick={() => onPrint('page1')}
          >
            <FileText className="w-5 h-5 mr-3 text-slate-500" />
            <div className="text-left">
              <div className="font-semibold text-slate-800">เฉพาะหน้า 1</div>
              <div className="text-xs text-slate-500">ข้อมูลผู้เช่าและรายละเอียดห้องพัก</div>
            </div>
          </Button>
          
          <Button 
            variant="outline" 
            className="justify-start h-auto py-3 px-4 hover:bg-blue-50 hover:border-blue-300"
            onClick={() => onPrint('page2')}
          >
            <FileText className="w-5 h-5 mr-3 text-slate-500" />
            <div className="text-left">
              <div className="font-semibold text-slate-800">เฉพาะหน้า 2</div>
              <div className="text-xs text-slate-500">เงื่อนไขสัญญาและกฎระเบียบ</div>
            </div>
          </Button>
          
          <Button 
            variant="outline" 
            className="justify-start h-auto py-3 px-4 hover:bg-blue-50 hover:border-blue-300"
            onClick={() => onPrint('page3')}
          >
            <FileText className="w-5 h-5 mr-3 text-slate-500" />
            <div className="text-left">
              <div className="font-semibold text-slate-800">เฉพาะหน้า 3</div>
              <div className="text-xs text-slate-500">จุดลงลายมือชื่อและสรุปย่อ</div>
            </div>
          </Button>
        </div>
        
        <DialogFooter className="sm:justify-start">
          <div className="text-xs text-slate-500 w-full text-center bg-slate-50 p-2 rounded">
            💡 เมื่อเลือกแล้ว ระบบจะเปิดหน้าต่างสั่งพิมพ์ของเครื่องคอมพิวเตอร์
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}