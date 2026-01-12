import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, DollarSign, DoorOpen, Wrench, Users, Copy, ExternalLink, Clock, ArrowLeft, Save, Send, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PageHeader from "../components/shared/PageHeader";

export default function NotificationSettings() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name');

  const [settings, setSettings] = useState({
    // การแจ้งเตือนค้างชำระ
    overdue_notifications_enabled: false,
    overdue_days_threshold: '3',
    overdue_notification_recipients: '',
    
    // การแจ้งเตือนห้องว่าง
    vacant_room_notifications_enabled: false,
    vacant_days_threshold: '7',
    vacant_notification_recipients: '',
    
    // การแจ้งเตือนคำขอซ่อม
    maintenance_notifications_enabled: false,
    maintenance_priority_threshold: 'medium',
    maintenance_notification_recipients: '',
    
    // การแจ้งเตือนสัญญาใกล้หมด
    contract_expiry_notifications_enabled: false,
    contract_expiry_days_threshold: '30',
    contract_notification_recipients: ''
  });

  const [testingSending, setTestingSending] = useState({
    overdue: false,
    vacant: false,
    maintenance: false,
    contract: false
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    staleTime: 60 * 60 * 1000,
  });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
  const canManage = userRole === 'developer' || userRole === 'owner';
  const isTrialMode = currentUser?.plan_status === 'trial';

  useEffect(() => {
    if (configs.length > 0) {
      const getConfigValue = (key, defaultValue) => {
        const config = configs.find(c => c.key === key && (!c.branch_id || c.branch_id === selectedBranchId));
        return config ? config.value : defaultValue;
      };

      setSettings({
        overdue_notifications_enabled: getConfigValue('overdue_notifications_enabled', 'false') === 'true',
        overdue_days_threshold: getConfigValue('overdue_days_threshold', '3'),
        overdue_notification_recipients: getConfigValue('overdue_notification_recipients', ''),
        
        vacant_room_notifications_enabled: getConfigValue('vacant_room_notifications_enabled', 'false') === 'true',
        vacant_days_threshold: getConfigValue('vacant_days_threshold', '7'),
        vacant_notification_recipients: getConfigValue('vacant_notification_recipients', ''),
        
        maintenance_notifications_enabled: getConfigValue('maintenance_notifications_enabled', 'false') === 'true',
        maintenance_priority_threshold: getConfigValue('maintenance_priority_threshold', 'medium'),
        maintenance_notification_recipients: getConfigValue('maintenance_notification_recipients', ''),
        
        contract_expiry_notifications_enabled: getConfigValue('contract_expiry_notifications_enabled', 'false') === 'true',
        contract_expiry_days_threshold: getConfigValue('contract_expiry_days_threshold', '30'),
        contract_notification_recipients: getConfigValue('contract_notification_recipients', '')
      });
    }
  }, [configs, selectedBranchId]);

  const updateConfigMutation = useMutation({
    mutationFn: async ({ key, value, description, category }) => {
      const existing = configs.find(c => c.key === key && (!c.branch_id || c.branch_id === selectedBranchId));
      
      if (existing) {
        return base44.entities.Config.update(existing.id, { value: value.toString() });
      } else {
        return base44.entities.Config.create({
          key,
          value: value.toString(),
          value_type: 'string',
          description,
          category: category || 'notification',
          branch_id: selectedBranchId
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['configs']);
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + (error.message || 'ไม่สามารถบันทึกได้'));
    }
  });

  const handleSave = async () => {
    try {
      const configsToSave = [
        // Overdue
        { key: 'overdue_notifications_enabled', value: settings.overdue_notifications_enabled ? 'true' : 'false', description: 'เปิดใช้งานการแจ้งเตือนค้างชำระ' },
        { key: 'overdue_days_threshold', value: settings.overdue_days_threshold, description: 'จำนวนวันค้างชำระก่อนแจ้งเตือน' },
        { key: 'overdue_notification_recipients', value: settings.overdue_notification_recipients, description: 'ผู้รับการแจ้งเตือนค้างชำระ' },
        
        // Vacant rooms
        { key: 'vacant_room_notifications_enabled', value: settings.vacant_room_notifications_enabled ? 'true' : 'false', description: 'เปิดใช้งานการแจ้งเตือนห้องว่าง' },
        { key: 'vacant_days_threshold', value: settings.vacant_days_threshold, description: 'จำนวนวันที่ห้องว่างก่อนแจ้งเตือน' },
        { key: 'vacant_notification_recipients', value: settings.vacant_notification_recipients, description: 'ผู้รับการแจ้งเตือนห้องว่าง' },
        
        // Maintenance
        { key: 'maintenance_notifications_enabled', value: settings.maintenance_notifications_enabled ? 'true' : 'false', description: 'เปิดใช้งานการแจ้งเตือนคำขอซ่อม' },
        { key: 'maintenance_priority_threshold', value: settings.maintenance_priority_threshold, description: 'ระดับความสำคัญขั้นต่ำที่จะแจ้งเตือน' },
        { key: 'maintenance_notification_recipients', value: settings.maintenance_notification_recipients, description: 'ผู้รับการแจ้งเตือนคำขอซ่อม' },
        
        // Contract expiry
        { key: 'contract_expiry_notifications_enabled', value: settings.contract_expiry_notifications_enabled ? 'true' : 'false', description: 'เปิดใช้งานการแจ้งเตือนสัญญาใกล้หมด' },
        { key: 'contract_expiry_days_threshold', value: settings.contract_expiry_days_threshold, description: 'จำนวนวันก่อนสัญญาหมดที่จะแจ้งเตือน' },
        { key: 'contract_notification_recipients', value: settings.contract_notification_recipients, description: 'ผู้รับการแจ้งเตือนสัญญาใกล้หมด' }
      ];

      await Promise.all(configsToSave.map(config => updateConfigMutation.mutateAsync(config)));
      toast.success('บันทึกการตั้งค่าสำเร็จ');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleTestNotification = async (type) => {
    setTestingSending({ ...testingSending, [type]: true });
    
    try {
      let response;
      switch(type) {
        case 'overdue':
          response = await base44.functions.invoke('sendOverduePaymentNotifications', { 
            branch_id: selectedBranchId,
            test_mode: true 
          });
          break;
        case 'vacant':
          response = await base44.functions.invoke('sendVacantRoomNotifications', { 
            branch_id: selectedBranchId,
            test_mode: true 
          });
          break;
        case 'maintenance':
          response = await base44.functions.invoke('sendMaintenanceNotifications', { 
            branch_id: selectedBranchId,
            test_mode: true 
          });
          break;
        case 'contract':
          response = await base44.functions.invoke('sendContractExpiryNotifications', { 
            branch_id: selectedBranchId,
            test_mode: true 
          });
          break;
        default:
          throw new Error('Unknown notification type');
      }
      
      if (response && response.data && response.data.success) {
        toast.success(response.data.message);
      } else if (response && response.data && response.data.error) {
        toast.error(response.data.error);
      } else {
        toast.error('เกิดข้อผิดพลาดในการส่งทดสอบ');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการส่งทดสอบ: ' + (error.message || 'ไม่ทราบข้อผิดพลาด'));
    }
    
    setTestingSending({ ...testingSending, [type]: false });
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('คัดลอก URL แล้ว');
  };

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
          <p className="text-slate-500 mt-2">เฉพาะ Owner และ Developer เท่านั้น</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader 
        title="การแจ้งเตือนอัจฉริยะ" 
        subtitle={`สาขา ${selectedBranchName}`}
        icon={Bell}
        showNotifications={false}
        actions={
          <Button
            onClick={handleSave}
            disabled={updateConfigMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
          >
            {updateConfigMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                กำลังบันทึก...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                บันทึกการตั้งค่า
              </>
            )}
          </Button>
        }
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* คำแนะนำ */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900 mb-2">💡 วิธีใช้งาน</h4>
                  <ul className="text-sm text-blue-700 space-y-1 list-disc ml-4">
                    <li>เปิดใช้งานการแจ้งเตือนที่ต้องการ</li>
                    <li>กรอก LINE User ID ของผู้รับการแจ้งเตือน (ดูวิธีหาได้จากหน้า "ทดสอบ LINE")</li>
                    <li>ตั้งค่าเงื่อนไขการแจ้งเตือน เช่น ค้างชำระกี่วัน</li>
                    <li>คลิก "ทดสอบส่ง" เพื่อตรวจสอบว่าแจ้งเตือนทำงาน</li>
                    <li>ตั้งค่า Cron Job ตาม URL ด้านล่างเพื่อให้ทำงานอัตโนมัติ</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1. การแจ้งเตือนค้างชำระ */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
              <CardHeader className="border-b bg-gradient-to-r from-red-50 to-orange-50">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-red-600" />
                  การแจ้งเตือนค้างชำระ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-slate-800">เปิดใช้งาน</p>
                    <p className="text-xs text-slate-500">แจ้งเตือนเมื่อมีผู้เช่าค้างชำระ</p>
                  </div>
                  <Switch
                    checked={settings.overdue_notifications_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, overdue_notifications_enabled: checked })}
                  />
                </div>

                {settings.overdue_notifications_enabled && (
                  <>
                    <div>
                      <Label>ค้างชำระกี่วันจึงแจ้งเตือน</Label>
                      <Input
                        type="number"
                        min="0"
                        value={settings.overdue_days_threshold}
                        onChange={(e) => setSettings({ ...settings, overdue_days_threshold: e.target.value })}
                        placeholder="3"
                      />
                      <p className="text-xs text-slate-500 mt-1">เช่น ถ้าใส่ 3 = แจ้งเมื่อเกินกำหนดชำระ 3 วัน</p>
                    </div>

                    <div>
                      <Label>ผู้รับการแจ้งเตือน (LINE User ID)</Label>
                      <Input
                        value={settings.overdue_notification_recipients}
                        onChange={(e) => setSettings({ ...settings, overdue_notification_recipients: e.target.value })}
                        placeholder="U1234567890abcdef, U0987654321fedcba"
                      />
                      <p className="text-xs text-slate-500 mt-1">สามารถใส่หลาย ID โดยคั่นด้วยเครื่องหมายจุลภาค (,)</p>
                    </div>

                    <Button
                      onClick={() => handleTestNotification('overdue')}
                      disabled={testingSending.overdue || !settings.overdue_notification_recipients}
                      variant="outline"
                      className="w-full"
                    >
                      {testingSending.overdue ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-2" />
                          กำลังส่งทดสอบ...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          ทดสอบส่ง
                        </>
                      )}
                    </Button>
                  </>
                )}

                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Cron Job URL:</strong>
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={`${window.location.origin}/api/functions/sendOverduePaymentNotifications`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(`${window.location.origin}/api/functions/sendOverduePaymentNotifications`)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    ⏰ แนะนำ: ตั้งเวลา 09:00 น. ทุกวัน (Cron: <code className="bg-blue-100 px-1 rounded">0 9 * * *</code>)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 2. การแจ้งเตือนห้องว่าง */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
              <CardHeader className="border-b bg-gradient-to-r from-green-50 to-emerald-50">
                <CardTitle className="flex items-center gap-2">
                  <DoorOpen className="w-5 h-5 text-green-600" />
                  การแจ้งเตือนห้องว่าง
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-slate-800">เปิดใช้งาน</p>
                    <p className="text-xs text-slate-500">แจ้งเตือนเมื่อห้องว่างเกินกำหนด</p>
                  </div>
                  <Switch
                    checked={settings.vacant_room_notifications_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, vacant_room_notifications_enabled: checked })}
                  />
                </div>

                {settings.vacant_room_notifications_enabled && (
                  <>
                    <div>
                      <Label>ห้องว่างกี่วันจึงแจ้งเตือน</Label>
                      <Input
                        type="number"
                        min="0"
                        value={settings.vacant_days_threshold}
                        onChange={(e) => setSettings({ ...settings, vacant_days_threshold: e.target.value })}
                        placeholder="7"
                      />
                      <p className="text-xs text-slate-500 mt-1">เช่น ถ้าใส่ 7 = แจ้งเมื่อห้องว่างต่อเนื่อง 7 วัน</p>
                    </div>

                    <div>
                      <Label>ผู้รับการแจ้งเตือน (LINE User ID)</Label>
                      <Input
                        value={settings.vacant_notification_recipients}
                        onChange={(e) => setSettings({ ...settings, vacant_notification_recipients: e.target.value })}
                        placeholder="U1234567890abcdef"
                      />
                    </div>

                    <Button
                      onClick={() => handleTestNotification('vacant')}
                      disabled={testingSending.vacant || !settings.vacant_notification_recipients}
                      variant="outline"
                      className="w-full"
                    >
                      {testingSending.vacant ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-2" />
                          กำลังส่งทดสอบ...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          ทดสอบส่ง
                        </>
                      )}
                    </Button>
                  </>
                )}

                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Cron Job URL:</strong>
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={`${window.location.origin}/api/functions/sendVacantRoomNotifications`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(`${window.location.origin}/api/functions/sendVacantRoomNotifications`)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    ⏰ แนะนำ: ตั้งเวลา 10:00 น. ทุกวัน (Cron: <code className="bg-blue-100 px-1 rounded">0 10 * * *</code>)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 3. การแจ้งเตือนคำขอซ่อม */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
              <CardHeader className="border-b bg-gradient-to-r from-purple-50 to-pink-50">
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-purple-600" />
                  การแจ้งเตือนคำขอซ่อม
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-slate-800">เปิดใช้งาน</p>
                    <p className="text-xs text-slate-500">แจ้งเตือนเมื่อมีคำขอซ่อมใหม่</p>
                  </div>
                  <Switch
                    checked={settings.maintenance_notifications_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, maintenance_notifications_enabled: checked })}
                  />
                </div>

                {settings.maintenance_notifications_enabled && (
                  <>
                    <div>
                      <Label>ระดับความสำคัญขั้นต่ำที่แจ้งเตือน</Label>
                      <select
                        value={settings.maintenance_priority_threshold}
                        onChange={(e) => setSettings({ ...settings, maintenance_priority_threshold: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      >
                        <option value="low">ต่ำ (แจ้งทุกรายการ)</option>
                        <option value="medium">ปานกลาง (ไม่รวมต่ำ)</option>
                        <option value="high">สูง (เฉพาะเร่งด่วน)</option>
                        <option value="urgent">เร่งด่วนมาก (เฉพาะฉุกเฉินเท่านั้น)</option>
                      </select>
                    </div>

                    <div>
                      <Label>ผู้รับการแจ้งเตือน (LINE User ID)</Label>
                      <Input
                        value={settings.maintenance_notification_recipients}
                        onChange={(e) => setSettings({ ...settings, maintenance_notification_recipients: e.target.value })}
                        placeholder="U1234567890abcdef"
                      />
                    </div>

                    <Button
                      onClick={() => handleTestNotification('maintenance')}
                      disabled={testingSending.maintenance || !settings.maintenance_notification_recipients}
                      variant="outline"
                      className="w-full"
                    >
                      {testingSending.maintenance ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-2" />
                          กำลังส่งทดสอบ...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          ทดสอบส่ง
                        </>
                      )}
                    </Button>
                  </>
                )}

                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Cron Job URL:</strong>
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={`${window.location.origin}/api/functions/sendMaintenanceNotifications`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(`${window.location.origin}/api/functions/sendMaintenanceNotifications`)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    ⏰ แนะนำ: ตั้งเวลาทุก 1 ชั่วโมง (Cron: <code className="bg-blue-100 px-1 rounded">0 * * * *</code>)
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 4. การแจ้งเตือนสัญญาใกล้หมด */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
              <CardHeader className="border-b bg-gradient-to-r from-amber-50 to-yellow-50">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  การแจ้งเตือนสัญญาใกล้หมด
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-slate-800">เปิดใช้งาน</p>
                    <p className="text-xs text-slate-500">แจ้งเตือนเมื่อสัญญาใกล้หมด</p>
                  </div>
                  <Switch
                    checked={settings.contract_expiry_notifications_enabled}
                    onCheckedChange={(checked) => setSettings({ ...settings, contract_expiry_notifications_enabled: checked })}
                  />
                </div>

                {settings.contract_expiry_notifications_enabled && (
                  <>
                    <div>
                      <Label>แจ้งเตือนล่วงหน้ากี่วัน</Label>
                      <Input
                        type="number"
                        min="1"
                        value={settings.contract_expiry_days_threshold}
                        onChange={(e) => setSettings({ ...settings, contract_expiry_days_threshold: e.target.value })}
                        placeholder="30"
                      />
                      <p className="text-xs text-slate-500 mt-1">เช่น ถ้าใส่ 30 = แจ้งก่อนสัญญาหมด 30 วัน</p>
                    </div>

                    <div>
                      <Label>ผู้รับการแจ้งเตือน (LINE User ID)</Label>
                      <Input
                        value={settings.contract_notification_recipients}
                        onChange={(e) => setSettings({ ...settings, contract_notification_recipients: e.target.value })}
                        placeholder="U1234567890abcdef"
                      />
                    </div>

                    <Button
                      onClick={() => handleTestNotification('contract')}
                      disabled={testingSending.contract || !settings.contract_notification_recipients}
                      variant="outline"
                      className="w-full"
                    >
                      {testingSending.contract ? (
                        <>
                          <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-2" />
                          กำลังส่งทดสอบ...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          ทดสอบส่ง
                        </>
                      )}
                    </Button>
                  </>
                )}

                <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <p className="text-xs text-blue-800">
                    <strong>Cron Job URL:</strong>
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Input
                      value={`${window.location.origin}/api/functions/sendContractExpiryNotifications`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(`${window.location.origin}/api/functions/sendContractExpiryNotifications`)}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
                    ⏰ แนะนำ: ตั้งเวลา 08:00 น. ทุกวัน (Cron: <code className="bg-blue-100 px-1 rounded">0 8 * * *</code>)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* คำแนะนำการตั้งค่า Cron Job */}
          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-300">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-600" />
                วิธีตั้งค่า Cron Job อัตโนมัติ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="space-y-3 text-sm text-slate-700 list-decimal ml-5">
                <li>ไปที่ <a href="https://cron-job.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">cron-job.org <ExternalLink className="w-3 h-3 inline" /></a> และสมัครสมาชิก (ฟรี)</li>
                <li>คลิก "Create Cron Job" เพื่อสร้าง job ใหม่</li>
                <li>คัดลอก URL จากช่องด้านบนในแต่ละการ์ด</li>
                <li>วาง URL ในช่อง "URL" และเลือก Method เป็น <strong>POST</strong></li>
                <li>ตั้งเวลาตาม Cron Expression ที่แนะนำ</li>
                <li>บันทึกและทำซ้ำสำหรับการแจ้งเตือนทุกประเภทที่ต้องการ</li>
              </ol>

              <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 mt-4">
                <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  ข้อควรระวัง:
                </h4>
                <ul className="text-sm text-amber-800 space-y-1 list-disc ml-5">
                  <li>ต้องกดปุ่ม "บันทึกการตั้งค่า" ก่อนที่ระบบจะส่งการแจ้งเตือน</li>
                  <li>ผู้รับการแจ้งเตือนต้องเพิ่ม LINE Official Account ของคุณเป็นเพื่อนก่อน</li>
                  <li>ถ้าไม่มีข้อมูลตามเงื่อนไข ระบบจะไม่ส่งข้อความ</li>
                  <li>ควรทดสอบส่งก่อนทุกครั้งเพื่อให้แน่ใจว่า LINE User ID ถูกต้อง</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* ปุ่มยกเลิก (Save button moved to PageHeader) */}
          <div className="flex justify-end gap-3">
            <Button
              onClick={() => navigate(-1)}
              variant="outline"
            >
              ยกเลิก
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}