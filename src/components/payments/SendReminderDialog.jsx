import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send, Calendar, AlertTriangle, Settings } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function SendReminderDialog({
  open,
  onOpenChange,
  payment,
  room,
  tenant,
  effectiveStatus,
  lateFee,
  tiersEnabled,
  configs,
  selectedBranchId,
  onConfirm,
  isSending
}) {
  const navigate = useNavigate();
  const [selectedTemplate, setSelectedTemplate] = useState(() => effectiveStatus === 'overdue' ? 'overdue' : 'advance');
  const [customMessage, setCustomMessage] = useState('');

  // ⭐ เมื่อ effectiveStatus เปลี่ยน ให้อัปเดต selectedTemplate
  useEffect(() => {
    if (!payment) return;
    if (effectiveStatus === 'overdue') {
      setSelectedTemplate('overdue');
    } else {
      setSelectedTemplate('advance');
    }
  }, [effectiveStatus, open, payment]);

  useEffect(() => {
    if (!payment || !open || !selectedTemplate) return;
    setCustomMessage(getDefaultMessage());
  }, [selectedTemplate, open]);

  if (!payment) return null;

  const daysOverdue = payment.due_date ? differenceInDays(new Date(), parseISO(payment.due_date)) : 0;
  const isOverdue = effectiveStatus === 'overdue';
  const totalWithLateFee = (payment.total_amount || 0) + lateFee;

  const templates = [
    {
      id: 'advance',
      name: '📢 แจ้งเตือนล่วงหน้า',
      color: 'from-purple-500 to-indigo-500',
    },
    {
      id: 'due_date',
      name: '📅 ครบกำหนด',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      id: 'overdue',
      name: '🔴 เกินกำหนด',
      color: 'from-red-500 to-orange-500',
    }
  ];

  const getDefaultMessage = () => {
    const roomNum = room?.room_number || 'N/A';
    const amount = (payment.total_amount || 0).toLocaleString();
    const dueDate = payment.due_date ? format(parseISO(payment.due_date), 'd MMM yyyy', { locale: th }) : 'N/A';
    
    // คำนวณวันที่ครบกำหนด
    const dueDateObj = payment.due_date ? parseISO(payment.due_date) : null;
    const dueDateDay = dueDateObj ? dueDateObj.getDate() : null;

    // สร้างข้อความค่าปรับแบบระบุวันที่จริง
    let tierText = '';
    if (tiersEnabled && configs && dueDateDay) {
      const branchTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && c.branch_id === selectedBranchId);
      const globalTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
      const tiersConfig = branchTiersConfig || globalTiersConfig;
      
      if (tiersConfig?.value) {
        try {
          const tiers = JSON.parse(tiersConfig.value);
          tierText = '\n\n⚠️ อัตราค่าปรับล่าช้า:\n' + tiers.map((tier, idx) => {
            const startDay = dueDateDay + tier.days_from;
            const isLastTier = idx === tiers.length - 1;
            
            let dateRange;
            if (isLastTier || !tier.days_to) {
              dateRange = `วันที่ ${startDay} เป็นต้นไป`;
            } else {
              const endDay = dueDateDay + tier.days_to;
              dateRange = `วันที่ ${startDay}-${endDay}`;
            }
            return `• ${dateRange}: ${tier.fee_per_day} บาท/วัน`;
          }).join('\n');
        } catch (e) {
          // ไม่แสดงถ้า parse ไม่ได้
        }
      }
    }

    if (selectedTemplate === 'advance') {
      return `สวัสดีค่ะ 😊\n\nขอแจ้งเตือนค่าเช่าห้อง ${roomNum}\n💰 ยอดเงิน: ${amount} บาท\n📅 ครบกำหนดชำระ: ${dueDate}${tierText ? tierText + '\n' : '\n'}\nกรุณาเตรียมชำระภายในกำหนดนะคะ 🙏`;
    } else if (selectedTemplate === 'overdue') {
      const lateFeeText = lateFee > 0 ? `\n⚠️ ค่าปรับล่าช้า: +${lateFee.toLocaleString()} บาท${tiersEnabled ? ' (ขั้นบันได)' : ''}\n💰 รวมทั้งสิ้น: ${totalWithLateFee.toLocaleString()} บาท` : '';
      return `เรียนคุณผู้เช่า 🙏\n\n🔴 แจ้งเตือนเกินกำหนดชำระ\nห้อง ${roomNum}\n💰 ยอดเงิน: ${amount} บาท${lateFeeText}\n⏰ เกินกำหนดมาแล้ว: ${daysOverdue} วัน${tierText}\n\nกรุณาชำระโดยด่วนค่ะ${lateFee > 0 ? ' เพื่อหลีกเลี่ยงค่าปรับเพิ่มเติม' : ''}`;
    } else {
      return `สวัสดีค่ะ 😊\n\n📅 ถึงกำหนดชำระค่าเช่าแล้ว\nห้อง ${roomNum}\n💰 ยอดเงิน: ${amount} บาท\n📅 ครบกำหนด: ${dueDate}${tierText}\n\nกรุณาชำระภายในวันนี้นะคะ 🙏`;
    }
  };

  // moved above early return

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ส่งบิลแจ้งหนี้</DialogTitle>
        </DialogHeader>

        {/* แถบเลือก Template ด้านบน */}
        <div className="flex gap-2 border-b pb-4">
          {templates.map(template => (
            <button
              key={template.id}
              onClick={() => {
                setSelectedTemplate(template.id);
                setCustomMessage(getDefaultMessage());
              }}
              className={`flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all ${
                selectedTemplate === template.id
                  ? `bg-gradient-to-r ${template.color} text-white shadow-lg`
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {template.name}
            </button>
          ))}
        </div>

        {/* Payment Info Compact */}
        <div className="grid grid-cols-2 gap-3 text-sm bg-slate-50 rounded-lg p-3">
          <div>
            <span className="text-slate-500">ห้อง:</span>
            <span className="font-bold text-slate-800 ml-2">{room?.room_number || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500">ผู้เช่า:</span>
            <span className="font-medium text-slate-800 ml-2">{tenant?.full_name || 'N/A'}</span>
          </div>
          <div>
            <span className="text-slate-500">ยอดเงิน:</span>
            <span className="font-bold text-blue-600 ml-2">{(payment.total_amount || 0).toLocaleString()} ฿</span>
          </div>
          <div>
            <span className="text-slate-500">สถานะ:</span>
            <Badge className={`ml-2 ${
              effectiveStatus === 'paid' ? 'bg-green-100 text-green-700' :
              effectiveStatus === 'overdue' ? 'bg-red-100 text-red-700' :
              'bg-yellow-100 text-yellow-700'
            }`}>
              {effectiveStatus === 'paid' ? 'ชำระแล้ว' :
               effectiveStatus === 'overdue' ? `เกิน ${daysOverdue} วัน` :
               'ครบกำหนด'}
            </Badge>
          </div>
          {isOverdue && lateFee > 0 && (
            <>
              <div className="col-span-2 bg-red-50 border border-red-200 rounded p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span className="text-red-700 text-sm font-bold">
                    ค่าปรับล่าช้า: +{lateFee.toLocaleString()} ฿ → รวม {totalWithLateFee.toLocaleString()} ฿
                  </span>
                </div>
                
                {tiersEnabled && (() => {
                  const branchTiersConfig = configs?.find(c => c.key === 'late_fee_tiers' && c.branch_id === selectedBranchId);
                  const globalTiersConfig = configs?.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
                  const tiersConfig = branchTiersConfig || globalTiersConfig;
                  
                  if (!tiersConfig?.value) return null;
                  
                  try {
                    const tiers = JSON.parse(tiersConfig.value);
                    const dueDateObj = payment.due_date ? parseISO(payment.due_date) : null;
                    const dueDateDay = dueDateObj ? dueDateObj.getDate() : null;
                    
                    if (!dueDateDay) return null;
                    
                    return (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-semibold text-red-800">⚠️ อัตราค่าปรับ:</p>
                        {tiers.map((tier, idx) => {
                          const startDay = dueDateDay + tier.days_from;
                          const isLastTier = idx === tiers.length - 1;
                          
                          let dateRange;
                          if (isLastTier || !tier.days_to) {
                            dateRange = `วันที่ ${startDay} เป็นต้นไป`;
                          } else {
                            const endDay = dueDateDay + tier.days_to;
                            dateRange = `วันที่ ${startDay}-${endDay}`;
                          }
                          
                          return (
                            <div key={idx} className="flex justify-between text-xs text-red-700 bg-white/50 rounded px-2 py-1">
                              <span>{dateRange}</span>
                              <span className="font-semibold">{tier.fee_per_day} ฿/วัน</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </div>
            </>
          )}
        </div>

        {/* ข้อความที่จะส่ง */}
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">ข้อความที่จะส่ง:</label>
          <Textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            rows={8}
            className="bg-white border-slate-200 resize-none"
            placeholder="แก้ไขข้อความได้ตามต้องการ..."
          />
          <p className="text-xs text-slate-500">💡 สามารถแก้ไขข้อความได้ตามต้องการ</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t">
          <Button
            variant="outline"
            onClick={() => {
              setCustomMessage('');
              onOpenChange(false);
            }}
            disabled={isSending}
          >
            ยกเลิก
          </Button>
          <Button
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            onClick={() => {
              if (!customMessage.trim()) {
                toast.error('กรุณาใส่ข้อความ');
                return;
              }
              console.log('🔍 SendReminderDialog: Sending with template:', selectedTemplate);
              onConfirm(selectedTemplate, customMessage);
            }}
            disabled={!customMessage.trim() || isSending}
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