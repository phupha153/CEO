import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, Mail, MessageSquare, Trash2 } from "lucide-react";

const CRON_FUNCTIONS = [
  'recheckPendingSlips',
  'processInvoiceImageQueue',
  'sendAdvanceReminders',
  'sendDueDateReminders',
  'sendAutomatedOverdueReminders',
  'sendOverduePaymentNotifications',
  'sendVacantRoomNotifications',
  'sendMaintenanceNotifications',
  'sendContractExpiryNotifications',
  'generateMonthlyBills'
];

export default function AlertSettingsDialog({ open, onClose, existingAlerts = [] }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    alert_name: '',
    function_name: '',
    alert_type: 'failure',
    threshold_value: 3,
    threshold_period_minutes: 60,
    notification_channels: ['email'],
    recipient_emails: [''],
    recipient_line_ids: [''],
    enabled: true,
    cooldown_minutes: 60
  });

  const createAlertMutation = useMutation({
    mutationFn: (data) => base44.entities.CronJobAlert.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronJobAlerts'] });
      toast.success('สร้างการแจ้งเตือนสำเร็จ');
      onClose();
      resetForm();
    },
    onError: (error) => toast.error('เกิดข้อผิดพลาด: ' + error.message)
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (alertId) => base44.entities.CronJobAlert.delete(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cronJobAlerts'] });
      toast.success('ลบการแจ้งเตือนสำเร็จ');
    },
    onError: (error) => toast.error('เกิดข้อผิดพลาด: ' + error.message)
  });

  const resetForm = () => {
    setFormData({
      alert_name: '',
      function_name: '',
      alert_type: 'failure',
      threshold_value: 3,
      threshold_period_minutes: 60,
      notification_channels: ['email'],
      recipient_emails: [''],
      recipient_line_ids: [''],
      enabled: true,
      cooldown_minutes: 60
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const cleanedData = {
      ...formData,
      recipient_emails: formData.recipient_emails.filter(e => e.trim() !== ''),
      recipient_line_ids: formData.recipient_line_ids.filter(id => id.trim() !== '')
    };

    if (cleanedData.recipient_emails.length === 0 && cleanedData.recipient_line_ids.length === 0) {
      toast.error('กรุณาระบุผู้รับการแจ้งเตือนอย่างน้อย 1 ช่องทาง');
      return;
    }

    createAlertMutation.mutate(cleanedData);
  };

  const toggleChannel = (channel) => {
    setFormData(prev => ({
      ...prev,
      notification_channels: prev.notification_channels.includes(channel)
        ? prev.notification_channels.filter(c => c !== channel)
        : [...prev.notification_channels, channel]
    }));
  };

  const addEmailField = () => {
    setFormData(prev => ({
      ...prev,
      recipient_emails: [...prev.recipient_emails, '']
    }));
  };

  const updateEmail = (index, value) => {
    setFormData(prev => ({
      ...prev,
      recipient_emails: prev.recipient_emails.map((e, i) => i === index ? value : e)
    }));
  };

  const removeEmail = (index) => {
    setFormData(prev => ({
      ...prev,
      recipient_emails: prev.recipient_emails.filter((_, i) => i !== index)
    }));
  };

  const addLineIdField = () => {
    setFormData(prev => ({
      ...prev,
      recipient_line_ids: [...prev.recipient_line_ids, '']
    }));
  };

  const updateLineId = (index, value) => {
    setFormData(prev => ({
      ...prev,
      recipient_line_ids: prev.recipient_line_ids.map((id, i) => i === index ? value : id)
    }));
  };

  const removeLineId = (index) => {
    setFormData(prev => ({
      ...prev,
      recipient_line_ids: prev.recipient_line_ids.filter((_, i) => i !== index)
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ตั้งค่าการแจ้งเตือน Cron Jobs</DialogTitle>
          <DialogDescription>
            สร้างการแจ้งเตือนอัตโนมัติเมื่อ Job ล้มเหลวหรือประสิทธิภาพลดลง
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>ชื่อการแจ้งเตือน</Label>
            <Input
              value={formData.alert_name}
              onChange={(e) => setFormData({ ...formData, alert_name: e.target.value })}
              placeholder="เช่น แจ้งเตือนล้มเหลว - ส่งบิล"
              required
            />
          </div>

          <div>
            <Label>Cron Job ที่ต้องการตรวจสอบ</Label>
            <Select value={formData.function_name} onValueChange={(val) => setFormData({ ...formData, function_name: val })}>
              <SelectTrigger>
                <SelectValue placeholder="เลือก Cron Job" />
              </SelectTrigger>
              <SelectContent>
                {CRON_FUNCTIONS.map(fn => (
                  <SelectItem key={fn} value={fn}>{fn}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>ประเภทการแจ้งเตือน</Label>
            <Select value={formData.alert_type} onValueChange={(val) => setFormData({ ...formData, alert_type: val })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="failure">ความล้มเหลว (Failure)</SelectItem>
                <SelectItem value="performance">ประสิทธิภาพลดลง (Performance)</SelectItem>
                <SelectItem value="success_rate">อัตราความสำเร็จต่ำ (Success Rate)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>ค่า Threshold</Label>
              <Input
                type="number"
                value={formData.threshold_value}
                onChange={(e) => setFormData({ ...formData, threshold_value: parseFloat(e.target.value) })}
                placeholder={formData.alert_type === 'failure' ? '3 ครั้ง' : formData.alert_type === 'performance' ? '5000 ms' : '80 %'}
                required
              />
              <p className="text-xs text-slate-500 mt-1">
                {formData.alert_type === 'failure' && 'จำนวนครั้งที่ล้มเหลว'}
                {formData.alert_type === 'performance' && 'เวลาเฉลี่ย (มิลลิวินาที)'}
                {formData.alert_type === 'success_rate' && 'อัตราความสำเร็จขั้นต่ำ (%)'}
              </p>
            </div>

            <div>
              <Label>ช่วงเวลาตรวจสอบ (นาที)</Label>
              <Input
                type="number"
                value={formData.threshold_period_minutes}
                onChange={(e) => setFormData({ ...formData, threshold_period_minutes: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          <div>
            <Label>Cooldown (นาที)</Label>
            <Input
              type="number"
              value={formData.cooldown_minutes}
              onChange={(e) => setFormData({ ...formData, cooldown_minutes: parseInt(e.target.value) })}
              placeholder="60"
            />
            <p className="text-xs text-slate-500 mt-1">ระยะเวลาพักก่อนแจ้งเตือนซ้ำ</p>
          </div>

          <div>
            <Label className="mb-2 block">ช่องทางการแจ้งเตือน</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.notification_channels.includes('email') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleChannel('email')}
              >
                <Mail className="w-4 h-4 mr-1" />
                Email
              </Button>
              <Button
                type="button"
                variant={formData.notification_channels.includes('line') ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleChannel('line')}
              >
                <MessageSquare className="w-4 h-4 mr-1" />
                LINE
              </Button>
            </div>
          </div>

          {formData.notification_channels.includes('email') && (
            <div>
              <Label>อีเมลผู้รับ</Label>
              {formData.recipient_emails.map((email, index) => (
                <div key={index} className="flex gap-2 mt-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => updateEmail(index, e.target.value)}
                    placeholder="admin@example.com"
                  />
                  {formData.recipient_emails.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeEmail(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addEmailField} className="mt-2">
                + เพิ่มอีเมล
              </Button>
            </div>
          )}

          {formData.notification_channels.includes('line') && (
            <div>
              <Label>LINE User IDs</Label>
              {formData.recipient_line_ids.map((lineId, index) => (
                <div key={index} className="flex gap-2 mt-2">
                  <Input
                    value={lineId}
                    onChange={(e) => updateLineId(index, e.target.value)}
                    placeholder="U1234567890abcdefghijklmnopqrstuv"
                  />
                  {formData.recipient_line_ids.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeLineId(index)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addLineIdField} className="mt-2">
                + เพิ่ม LINE ID
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <Label>เปิดใช้งาน</Label>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={createAlertMutation.isPending}>
              {createAlertMutation.isPending ? 'กำลังสร้าง...' : 'สร้างการแจ้งเตือน'}
            </Button>
          </div>
        </form>

        {existingAlerts.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h3 className="font-semibold text-sm mb-3">การแจ้งเตือนที่มีอยู่</h3>
            <div className="space-y-2">
              {existingAlerts.map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{alert.alert_name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">{alert.function_name}</Badge>
                      <Badge variant="outline" className="text-xs">{alert.alert_type}</Badge>
                      {alert.enabled ? (
                        <Badge className="bg-green-500 text-xs">เปิด</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">ปิด</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm('ต้องการลบการแจ้งเตือนนี้?')) {
                        deleteAlertMutation.mutate(alert.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}