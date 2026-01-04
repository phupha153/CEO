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
import { useQuery } from "@tanstack/react-query";

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
    if (effectiveStatus === 'overdue') {
      setSelectedTemplate('overdue');
    } else {
      setSelectedTemplate('advance');
    }
  }, [effectiveStatus, open]);

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

  // ⭐ ใช้ Central Template (ตรงกับ backend)
  const getDefaultMessage = () => {
    const roomNum = room?.room_number || 'N/A';
    const lateFeeAmount = lateFee || 0;
    const originalAmount = (payment.total_amount || 0) - lateFeeAmount;
    const totalAmount = payment.total_amount || 0;

    const getConfigValue = (key, defaultValue) => {
      if (!configs || !selectedBranchId) return defaultValue;
      const branchConfig = configs.find(c => c.key === key && c.branch_id === selectedBranchId);
      if (branchConfig) return branchConfig.value;
      const globalConfig = configs.find(c => c.key === key && !c.branch_id);
      return globalConfig?.value || defaultValue;
    };

    const buildingName = getConfigValue('building_name', 'W RESIDENTS');
    const bankName = getConfigValue('bank_name', 'กสิกร');
    const bankAccountNumber = getConfigValue('bank_account_number', '0722835522');
    const bankAccountName = getConfigValue('bank_account_name', 'ธนานนท์ พรมพักตร์');

    // สร้างข้อความแบบเดียวกับ backend
    if (selectedTemplate === 'overdue') {
      let message = `🔴 แจ้งเตือนเกินกำหนดชำระ\n\n`;
      message += `${buildingName}\n`;
      message += `คุณ ${tenant?.full_name} ห้อง ${roomNum}\n`;
      
      if (payment.rent_amount > 0 || payment.water_amount > 0 || payment.electricity_amount > 0) {
        message += `\nรายละเอียด:\n`;
        if (payment.rent_amount > 0) message += `🏠 ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
        if (payment.electricity_amount > 0) message += `⚡ ค่าไฟ (${payment.electricity_units || 0} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
        if (payment.water_amount > 0) message += `💧 ค่าน้ำ (${payment.water_units || 0} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
        if (payment.internet_amount > 0) message += `📶 ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
        if (payment.common_fee_amount > 0) message += `🏢 ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
        if (payment.parking_fee_amount > 0) message += `🚗 ค่าที่จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บาท\n`;
        if (payment.other_amount > 0) message += `📋 อื่นๆ: ${payment.other_amount.toLocaleString()} บาท\n`;
      }
      
      if (lateFeeAmount > 0) {
        message += `⚠️ ค่าปรับล่าช้า: +${lateFeeAmount.toLocaleString()} บาท\n`;
      }
      message += `💰 รวมทั้งสิ้น: ${totalAmount.toLocaleString()} บาท\n`;
      message += `เกินกำหนดมาแล้ว: ${daysOverdue} วัน\n\n`;
      message += `กรุณาชำระโดยด่วนค่ะ${lateFeeAmount > 0 ? ' เพื่อหลีกเลี่ยงค่าปรับเพิ่มเติม' : ''}\n\n`;
      message += `💳 โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
      message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
      return message;
    } else if (selectedTemplate === 'due_date') {
      let message = `⏰ แจ้งเตือนค่าเช่า (ครบกำหนดวันนี้)\n\n`;
      message += `${buildingName}\n`;
      message += `คุณ ${tenant?.full_name} ห้อง ${roomNum}\n`;
      
      if (payment.rent_amount > 0 || payment.water_amount > 0 || payment.electricity_amount > 0) {
        message += `\nรายละเอียด:\n`;
        if (payment.rent_amount > 0) message += `🏠 ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
        if (payment.electricity_amount > 0) message += `⚡ ค่าไฟ (${payment.electricity_units || 0} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
        if (payment.water_amount > 0) message += `💧 ค่าน้ำ (${payment.water_units || 0} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
        if (payment.internet_amount > 0) message += `📶 ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
        if (payment.common_fee_amount > 0) message += `🏢 ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
        if (payment.parking_fee_amount > 0) message += `🚗 ค่าที่จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บาท\n`;
        if (payment.other_amount > 0) message += `📋 อื่นๆ: ${payment.other_amount.toLocaleString()} บาท\n`;
      }
      
      message += `💰 รวมทั้งสิ้น: ${totalAmount.toLocaleString()} บาท\n\n`;
      message += `💳 โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
      message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
      return message;
    } else {
      let message = `📢 ${buildingName} - แจ้งเตือนค่าเช่าล่วงหน้า\n\n`;
      message += `สวัสดีค่ะคุณ ${tenant?.full_name}\n`;
      message += `ห้อง ${roomNum}\n`;
      
      if (payment.rent_amount > 0 || payment.water_amount > 0 || payment.electricity_amount > 0) {
        message += `\nรายละเอียด:\n`;
        if (payment.rent_amount > 0) message += `🏠 ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
        if (payment.electricity_amount > 0) message += `⚡ ค่าไฟ (${payment.electricity_units || 0} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
        if (payment.water_amount > 0) message += `💧 ค่าน้ำ (${payment.water_units || 0} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
        if (payment.internet_amount > 0) message += `📶 ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
        if (payment.common_fee_amount > 0) message += `🏢 ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
        if (payment.parking_fee_amount > 0) message += `🚗 ค่าที่จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บาท\n`;
        if (payment.other_amount > 0) message += `📋 อื่นๆ: ${payment.other_amount.toLocaleString()} บาท\n`;
      }
      
      message += `💰 รวมทั้งสิ้น: ${totalAmount.toLocaleString()} บาท\n\n`;
      message += `💳 โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
      message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
      return message;
    }
  };

  useEffect(() => {
    if (open && selectedTemplate) {
      setCustomMessage(getDefaultMessage());
    }
  }, [selectedTemplate, open]);

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