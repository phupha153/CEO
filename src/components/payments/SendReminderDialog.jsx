import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Loader2, Send, Calendar, AlertTriangle, DollarSign } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";

export default function SendReminderDialog({
  open,
  onOpenChange,
  payment,
  room,
  tenant,
  effectiveStatus,
  lateFee,
  tiersEnabled,
  onConfirm,
  isSending
}) {
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  if (!payment) return null;

  const daysOverdue = payment.due_date ? differenceInDays(new Date(), parseISO(payment.due_date)) : 0;
  const isOverdue = effectiveStatus === 'overdue';

  const templates = [
    {
      id: 'due_date',
      name: '📅 แจ้งเตือนครบกำหนด',
      description: 'สำหรับบิลที่กำลังจะครบกำหนด หรือครบกำหนดพอดี',
      color: 'from-blue-500 to-indigo-500',
      recommended: !isOverdue
    },
    {
      id: 'overdue',
      name: '🔴 แจ้งเตือนเกินกำหนด',
      description: 'สำหรับบิลที่เกินกำหนดชำระแล้ว',
      color: 'from-red-500 to-orange-500',
      recommended: isOverdue
    }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>เลือกรูปแบบการส่งบิล</DialogTitle>
        </DialogHeader>

        {/* Payment Info */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">ห้อง:</span>
            <span className="font-bold text-slate-800">{room?.room_number || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">ผู้เช่า:</span>
            <span className="font-medium text-slate-800">{tenant?.full_name || 'N/A'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">ยอดเงิน:</span>
            <span className="font-bold text-blue-600">{(payment.total_amount || 0).toLocaleString()} ฿</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">ครบกำหนด:</span>
            <span className="font-medium text-slate-800">
              {payment.due_date ? format(parseISO(payment.due_date), 'd MMM yyyy', { locale: th }) : 'N/A'}
            </span>
          </div>
          
          {/* Status & Late Fee Info */}
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">สถานะ:</span>
              <Badge className={
                effectiveStatus === 'paid' ? 'bg-green-100 text-green-700' :
                effectiveStatus === 'overdue' ? 'bg-red-100 text-red-700' :
                'bg-yellow-100 text-yellow-700'
              }>
                {effectiveStatus === 'paid' ? 'ชำระแล้ว' :
                 effectiveStatus === 'overdue' ? `เกินกำหนด ${daysOverdue} วัน` :
                 'ครบกำหนด'}
              </Badge>
            </div>

            {isOverdue && lateFee > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-semibold text-red-800">
                    {tiersEnabled ? 'ค่าปรับแบบขั้นบันได' : 'ค่าปรับล่าช้า'}
                  </span>
                </div>
                <p className="text-sm text-red-700">
                  +{lateFee.toLocaleString()} ฿ (เกิน {daysOverdue} วัน)
                </p>
                <p className="text-xl font-bold text-red-800 mt-2">
                  รวมทั้งสิ้น: {((payment.total_amount || 0) + lateFee).toLocaleString()} ฿
                </p>
              </div>
            )}

            {isOverdue && tiersEnabled && (
              <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded p-2">
                💡 ระบบคิดค่าปรับแบบขั้นบันได - ยิ่งชำระช้ายิ่งแพง
              </p>
            )}
          </div>
        </div>

        {/* Template Selection */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">เลือกรูปแบบการส่ง:</p>
          {templates.map(template => (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all ${
                selectedTemplate === template.id
                  ? 'ring-2 ring-blue-500 shadow-lg'
                  : 'hover:shadow-md'
              } ${template.recommended ? 'border-blue-300' : ''}`}
              onClick={() => setSelectedTemplate(template.id)}
            >
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    selectedTemplate === template.id
                      ? 'border-blue-600 bg-blue-600'
                      : 'border-slate-300'
                  }`}>
                    {selectedTemplate === template.id && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-slate-800">{template.name}</p>
                      {template.recommended && (
                        <Badge className="bg-blue-100 text-blue-700 text-xs">แนะนำ</Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">{template.description}</p>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* ตัวอย่างข้อความที่จะส่ง */}
        {selectedTemplate && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-purple-800 mb-2">ตัวอย่างข้อความที่จะส่ง:</p>
            <div className="bg-white rounded p-3 text-sm text-slate-700 space-y-1">
              {selectedTemplate === 'due_date' ? (
                <>
                  <p>📅 <strong>แจ้งเตือนครบกำหนดชำระ</strong></p>
                  <p>ห้อง: {room?.room_number}</p>
                  <p>ยอดเงิน: {(payment.total_amount || 0).toLocaleString()} บาท</p>
                  <p>ครบกำหนด: {payment.due_date ? format(parseISO(payment.due_date), 'd MMM yyyy', { locale: th }) : 'N/A'}</p>
                  <p className="text-xs text-slate-500 mt-2">💡 กรุณาชำระภายในกำหนด</p>
                </>
              ) : (
                <>
                  <p>🔴 <strong>แจ้งเตือนเกินกำหนดชำระ</strong></p>
                  <p>ห้อง: {room?.room_number}</p>
                  <p>ยอดเงินเดิม: {(payment.total_amount || 0).toLocaleString()} บาท</p>
                  {lateFee > 0 && (
                    <>
                      <p className="text-red-600 font-semibold">ค่าปรับล่าช้า: +{lateFee.toLocaleString()} บาท</p>
                      <p className="text-red-600 font-bold">รวมทั้งสิ้น: {((payment.total_amount || 0) + lateFee).toLocaleString()} บาท</p>
                    </>
                  )}
                  <p>เกินกำหนดมาแล้ว: {daysOverdue} วัน</p>
                  <p className="text-xs text-red-600 mt-2">⚠️ กรุณาชำระโดยเร็ว{lateFee > 0 ? ' เพื่อหลีกเลี่ยงค่าปรับเพิ่มเติม' : ''}</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              setSelectedTemplate(null);
              onOpenChange(false);
            }}
            disabled={isSending}
          >
            ยกเลิก
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            onClick={() => {
              if (!selectedTemplate) {
                return;
              }
              onConfirm(selectedTemplate);
              setSelectedTemplate(null);
            }}
            disabled={!selectedTemplate || isSending}
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังส่ง...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                ยืนยันส่งข้อความ
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}