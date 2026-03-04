import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle, Sparkles } from "lucide-react";

export default function AIConfirmDialog({
  open,
  onOpenChange,
  aiPendingChanges,
  onCancel,
  onConfirm
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            ยืนยันการเปลี่ยนแปลง
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {aiPendingChanges && (
            <>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-sm text-purple-800 font-medium mb-2">
                  {aiPendingChanges.explanation}
                </p>
              </div>

              {aiPendingChanges.new_rules && aiPendingChanges.new_rules.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-green-800 mb-2">กฎที่จะเพิ่ม:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {aiPendingChanges.new_rules.map((rule, idx) => (
                      <li key={idx} className="text-sm text-green-700">{rule}</li>
                    ))}
                  </ul>
                </div>
              )}

              {aiPendingChanges.updated_data && Object.keys(aiPendingChanges.updated_data).length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-800 mb-2">ข้อมูลที่จะแก้ไข:</p>
                  <ul className="space-y-1">
                    {Object.entries(aiPendingChanges.updated_data).map(([key, value]) => (
                      <li key={key} className="text-sm text-blue-700">
                        <span className="font-medium">{key}:</span> {String(value)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {aiPendingChanges.new_clauses && aiPendingChanges.new_clauses.length > 0 && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-indigo-800 mb-2">ข้อสัญญาที่จะเพิ่ม:</p>
                  <ul className="space-y-2">
                    {aiPendingChanges.new_clauses.map((clause, idx) => (
                      <li key={idx} className="text-sm text-indigo-700 border-l-2 border-indigo-300 pl-3">
                        <span className="font-bold">ข้อ {clause.clause_number}.</span>
                        {clause.title && <span className="font-medium"> {clause.title}:</span>}
                        <p className="text-indigo-600 mt-1">{clause.content}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel}>
              ยกเลิก
            </Button>
            <Button 
              onClick={onConfirm}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              ยืนยัน
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}