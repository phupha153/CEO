import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, FileSignature, ShieldCheck, MessageSquare, Loader2 } from "lucide-react";

export default function AIHelperDialog({
  open,
  onOpenChange,
  aiMode,
  setAiMode,
  aiResult,
  setAiResult,
  aiLoading,
  handleAIRequest,
  onUseTemplate,
  onAddSuggestions
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-700">
            <Sparkles className="w-5 h-5" />
            AI ผู้ช่วยสัญญาเช่า
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-2 bg-slate-100 p-1 rounded-lg">
            <Button 
              variant={aiMode === 'generate' ? 'default' : 'ghost'}
              onClick={() => { setAiMode('generate'); setAiResult(null); }}
              className="flex-1"
            >
              <FileSignature className="w-4 h-4 mr-2" /> สร้างร่างสัญญา
            </Button>
            <Button 
              variant={aiMode === 'review' ? 'default' : 'ghost'}
              onClick={() => { setAiMode('review'); setAiResult(null); }}
              className="flex-1"
            >
              <ShieldCheck className="w-4 h-4 mr-2" /> ตรวจสอบ
            </Button>
            <Button 
              variant={aiMode === 'suggest' ? 'default' : 'ghost'}
              onClick={() => { setAiMode('suggest'); setAiResult(null); }}
              className="flex-1"
            >
              <MessageSquare className="w-4 h-4 mr-2" /> แนะนำเงื่อนไข
            </Button>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border">
            {aiMode === 'generate' && (
              <p className="text-sm text-slate-600">สร้างร่างสัญญาเช่าฉบับใหม่จากข้อมูลผู้เช่าและห้องพักที่เลือกไว้ โดยเน้นความรัดกุมและครอบคลุมตามกฎหมาย</p>
            )}
            {aiMode === 'review' && (
              <p className="text-sm text-slate-600">ตรวจสอบเนื้อหาสัญญาปัจจุบันเพื่อหาช่องโหว่ หรือเงื่อนไขที่อาจเสียเปรียบ พร้อมคำแนะนำในการแก้ไข</p>
            )}
            {aiMode === 'suggest' && (
              <p className="text-sm text-slate-600">แนะนำข้อสัญญาหรือกฎระเบียบเพิ่มเติมที่เหมาะสมกับประเภทห้องพักและผู้เช่ารายนี้</p>
            )}
          </div>

          {!aiResult && (
            <Button 
              onClick={handleAIRequest} 
              disabled={aiLoading} 
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              {aiLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังประมวลผล...</> : 'เริ่มทำงาน'}
            </Button>
          )}

          {aiResult && (
            <div className="space-y-4">
              <div className="bg-white border rounded-lg p-4 shadow-sm max-h-60 overflow-y-auto text-sm">
                {aiMode === 'generate' ? (
                  <div dangerouslySetInnerHTML={{ __html: aiResult }} />
                ) : (
                  <div className="whitespace-pre-wrap">{aiResult}</div>
                )}
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setAiResult(null)}>
                  ลองใหม่
                </Button>
                {aiMode === 'generate' && (
                  <Button 
                    onClick={() => onUseTemplate(aiResult)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    ใช้ร่างสัญญานี้
                  </Button>
                )}
                {aiMode === 'suggest' && (
                  <Button 
                    onClick={() => onAddSuggestions(aiResult)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    เพิ่มในกฎเพิ่มเติม
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}