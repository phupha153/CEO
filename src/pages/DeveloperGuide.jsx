import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Code, 
  Database, 
  Zap, 
  Globe, 
  BookOpen, 
  Terminal,
  Eye,
  AlertTriangle,
  Copy,
  Check,
  Bell,
  DollarSign,
  DoorOpen,
  Wrench,
  Users,
  Clock,
  Send,
  Save,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

export default function DeveloperGuide() {
  const [showBranchIdDialog, setShowBranchIdDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();

  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name');

  const [settings, setSettings] = useState({
    overdue_notifications_enabled: false,
    overdue_days_threshold: '3',
    overdue_notification_recipients: '',
    
    vacant_room_notifications_enabled: false,
    vacant_days_threshold: '7',
    vacant_notification_recipients: '',
    
    maintenance_notifications_enabled: false,
    maintenance_priority_threshold: 'medium',
    maintenance_notification_recipients: '',
    
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

  const handleSaveNotifications = async () => {
    try {
      const configsToSave = [
        { key: 'overdue_notifications_enabled', value: settings.overdue_notifications_enabled ? 'true' : 'false', description: 'เปิดใช้งานการแจ้งเตือนค้างชำระ' },
        { key: 'overdue_days_threshold', value: settings.overdue_days_threshold, description: 'จำนวนวันค้างชำระก่อนแจ้งเตือน' },
        { key: 'overdue_notification_recipients', value: settings.overdue_notification_recipients, description: 'ผู้รับการแจ้งเตือนค้างชำระ' },
        
        { key: 'vacant_room_notifications_enabled', value: settings.vacant_room_notifications_enabled ? 'true' : 'false', description: 'เปิดใช้งานการแจ้งเตือนห้องว่าง' },
        { key: 'vacant_days_threshold', value: settings.vacant_days_threshold, description: 'จำนวนวันที่ห้องว่างก่อนแจ้งเตือน' },
        { key: 'vacant_notification_recipients', value: settings.vacant_notification_recipients, description: 'ผู้รับการแจ้งเตือนห้องว่าง' },
        
        { key: 'maintenance_notifications_enabled', value: settings.maintenance_notifications_enabled ? 'true' : 'false', description: 'เปิดใช้งานการแจ้งเตือนคำขอซ่อม' },
        { key: 'maintenance_priority_threshold', value: settings.maintenance_priority_threshold, description: 'ระดับความสำคัญขั้นต่ำที่จะแจ้งเตือน' },
        { key: 'maintenance_notification_recipients', value: settings.maintenance_notification_recipients, description: 'ผู้รับการแจ้งเตือนคำขอซ่อม' },
        
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
    setCopied(true);
    toast.success('คัดลอกแล้ว!');
    setTimeout(() => setCopied(false), 2000);
  };

  const sections = [
    {
      title: "🏗️ สถาปัตยกรรมระบบ",
      icon: Database,
      color: "from-blue-500 to-indigo-600",
      content: [
        {
          subtitle: "Frontend Stack",
          items: [
            "React 18 - UI Framework",
            "TailwindCSS - Styling",
            "Shadcn/ui - Component Library",
            "Framer Motion - Animations",
            "React Query - State Management",
            "React Router - Navigation"
          ]
        },
        {
          subtitle: "Backend Stack",
          items: [
            "Base44 Platform - Backend as a Service",
            "Deno Runtime - Serverless Functions",
            "PostgreSQL - Database (Supabase)",
            "Real-time Subscriptions"
          ]
        }
      ]
    },
    {
      title: "📦 Entities (ฐานข้อมูล)",
      icon: Database,
      color: "from-green-500 to-emerald-600",
      content: [
        {
          subtitle: "Core Entities",
          items: [
            "Branch - สาขา/ทรัพย์สิน",
            "Room - ห้องพัก",
            "Tenant - ผู้เช่า",
            "Booking - การจอง (รายวัน/รายเดือน)",
            "Payment - การชำระเงิน",
            "MeterReading - บันทึกมิเตอร์",
            "MaintenanceRequest - แจ้งซ่อม",
            "Expense - ค่าใช้จ่าย",
            "Contract - สัญญาเช่า",
            "Config - การตั้งค่า",
            "TenantRating - คะแนนผู้เช่า",
            "User - ผู้ใช้งานระบบ"
          ]
        }
      ]
    },
    {
      title: "⚡ Backend Functions",
      icon: Zap,
      color: "from-purple-500 to-pink-600",
      content: [
        {
          subtitle: "LINE Integration",
          items: [
            "lineWebhookHandler - รับข้อความจาก LINE",
            "sendLineMessage - ส่งข้อความ LINE",
            "sendPaymentReminder - แจ้งเตือนค่าเช่า",
            "sendReceipt - ส่งใบเสร็จ",
            "sendDueDateReminders - แจ้งเตือนครบกำหนด",
            "sendAdvanceReminders - แจ้งเตือนล่วงหน้า"
          ]
        },
        {
          subtitle: "Payment & Receipts",
          items: [
            "verifySlip - ตรวจสอบสลิปด้วย Slip2Go",
            "generateReceiptImage - สร้างรูปใบเสร็จ",
            "generateMultipleReceipts - สร้างใบเสร็จหลายใบ",
            "getPublicInvoice - ดูใบแจ้งหนี้สาธารณะ",
            "generateMonthlyBills - สร้างบิลประจำเดือน"
          ]
        },
        {
          subtitle: "Utilities",
          items: [
            "updateTenantsBranch - อัปเดตสาขาผู้เช่า",
            "sendSmsOtp - ส่ง OTP ทาง SMS",
            "verifySmsOtp - ตรวจสอบ OTP"
          ]
        }
      ]
    },
    {
      title: "🔐 สิทธิ์และ Permissions",
      icon: Globe,
      color: "from-orange-500 to-red-600",
      content: [
        {
          subtitle: "Roles (บทบาท)",
          items: [
            "developer - นักพัฒนา (สิทธิ์เต็ม)",
            "owner - เจ้าของหอพัก (สิทธิ์เต็มยกเว้นโหมดทดสอบ)",
            "manager - ผู้จัดการ (จัดการสาขาที่ได้รับมอบหมาย)",
            "employee - พนักงาน (ดำเนินงานตามสิทธิ์ที่กำหนด)"
          ]
        },
        {
          subtitle: "Permission Categories",
          items: [
            "dashboard_* - แดชบอร์ด",
            "rooms_* - จัดการห้องพัก",
            "bookings_* - การจองห้อง",
            "tenants_* - ผู้เช่า",
            "contracts_* - สัญญาเช่า",
            "payments_* - การชำระเงิน",
            "meter_readings_* - บันทึกมิเตอร์",
            "expenses_* - ค่าใช้จ่าย",
            "maintenance_* - แจ้งซ่อม",
            "reports_* - รายงาน",
            "accounting_* - บัญชี",
            "settings_* - ตั้งค่า"
          ]
        }
      ]
    },
    {
      title: "🔧 Environment Variables",
      icon: Terminal,
      color: "from-cyan-500 to-blue-600",
      content: [
        {
          subtitle: "Required Secrets",
          items: [
            "LINE_CHANNEL_ACCESS_TOKEN - สำหรับ LINE Messaging API",
            "SLIP2GO_API_KEY - สำหรับตรวจสอบสลิป (ถ้าใช้)",
            "BROWSERLESS_API_KEY - สำหรับสร้างรูปใบเสร็จ"
          ]
        }
      ]
    },
    {
      title: "📱 Multi-Branch Support",
      icon: Globe,
      color: "from-teal-500 to-green-600",
      content: [
        {
          subtitle: "Branch Management",
          items: [
            "แต่ละ Entity มี branch_id เชื่อมโยงกับ Branch",
            "Config สามารถเป็น Global (null branch_id) หรือ Branch-specific",
            "User สามารถมี accessible_branches จำกัดสาขาที่เข้าถึงได้",
            "Owner และ Developer เข้าถึงทุกสาขา",
            "Manager และ Employee เข้าถึงเฉพาะสาขาที่กำหนด"
          ]
        }
      ]
    }
  ];

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-start flex-wrap gap-4">
          <div>
            <h1 className="text-4xl font-bold text-slate-800 mb-2">👨‍💻 Developer Guide</h1>
            <p className="text-slate-600">คู่มือสำหรับนักพัฒนาและผู้ดูแลระบบ</p>
          </div>
          <Button
            onClick={() => setShowBranchIdDialog(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            <Eye className="w-4 h-4 mr-2" />
            ดู Branch ID ของสาขานี้
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm border border-slate-200">
            <TabsTrigger value="overview">📚 ภาพรวม</TabsTrigger>
            <TabsTrigger value="notifications">🔔 การแจ้งเตือน (Cron Jobs)</TabsTrigger>
          </TabsList>

          {/* Tab ภาพรวมระบบ */}
          <TabsContent value="overview" className="space-y-6">
            {/* System Overview */}
            <Card className="bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-2xl">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <BookOpen className="w-8 h-8" />
                  ภาพรวมระบบ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-lg">
                  ระบบจัดการหอพักแบบ Multi-Branch สร้างด้วย <strong>Base44 Platform</strong>
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <h4 className="font-bold mb-2">🏗️ Architecture</h4>
                    <p className="text-sm">React + Base44 BaaS</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <h4 className="font-bold mb-2">💾 Database</h4>
                    <p className="text-sm">PostgreSQL (Supabase)</p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
                    <h4 className="font-bold mb-2">⚡ Functions</h4>
                    <p className="text-sm">Deno Serverless</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sections */}
            {sections.map((section, index) => (
              <Card key={index} className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${section.color}`}>
                      <section.icon className="w-6 h-6 text-white" />
                    </div>
                    <span className="text-xl">{section.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {section.content.map((contentBlock, idx) => (
                    <div key={idx}>
                      <h3 className="font-bold text-slate-700 mb-3 text-lg">{contentBlock.subtitle}</h3>
                      <div className="grid md:grid-cols-2 gap-2">
                        {contentBlock.items.map((item, itemIdx) => (
                          <div 
                            key={itemIdx}
                            className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                          >
                            <Code className="w-4 h-4 text-blue-600 flex-shrink-0" />
                            <span className="text-sm text-slate-700">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}

            {/* Quick Links */}
            <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-2xl">
              <CardHeader>
                <CardTitle className="text-2xl">🔗 Quick Links</CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <a 
                  href="https://docs.base44.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-4 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors"
                >
                  <h4 className="font-bold mb-1">📚 Base44 Documentation</h4>
                  <p className="text-sm text-slate-300">เอกสารทางการของ Base44</p>
                </a>
                <a 
                  href="https://dashboard.base44.com" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-4 bg-white/10 backdrop-blur-sm rounded-lg hover:bg-white/20 transition-colors"
                >
                  <h4 className="font-bold mb-1">⚙️ Base44 Dashboard</h4>
                  <p className="text-sm text-slate-300">จัดการ App และ Database</p>
                </a>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab การแจ้งเตือน (ย้ายมาจาก NotificationSettings) */}
          <TabsContent value="notifications" className="space-y-6">
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-2">💡 วิธีใช้งาน</h4>
                    <ul className="text-sm text-blue-700 space-y-1 list-disc ml-4">
                      <li>เปิดใช้งานการแจ้งเตือนที่ต้องการในหน้า <strong>ตั้งค่า → การแจ้งเตือน</strong></li>
                      <li>กรอก LINE User ID ของผู้รับการแจ้งเตือนด้านล่าง</li>
                      <li>ตั้งค่าเงื่อนไขการแจ้งเตือน เช่น ค้างชำระกี่วัน</li>
                      <li>คลิก "ทดสอบส่ง" เพื่อตรวจสอบว่าแจ้งเตือนทำงาน</li>
                      <li>ตั้งค่า Cron Job ตาม URL ด้านล่างเพื่อให้ทำงานอัตโนมัติ</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* การแจ้งเตือนค้างชำระ */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-xl">
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
                      <p className="text-xs text-slate-500">
                        {settings.overdue_notifications_enabled ? '✅ เปิดใช้งานแล้ว' : '❌ ปิดใช้งาน'}
                      </p>
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
                        />
                      </div>

                      <div>
                        <Label>ผู้รับการแจ้งเตือน (LINE User ID)</Label>
                        <Input
                          value={settings.overdue_notification_recipients}
                          onChange={(e) => setSettings({ ...settings, overdue_notification_recipients: e.target.value })}
                          placeholder="U1234567890abcdef, U0987654321fedcba"
                        />
                        <p className="text-xs text-slate-500 mt-1">คั่นด้วย , สำหรับหลาย ID</p>
                      </div>

                      <Button
                        onClick={() => handleTestNotification('overdue')}
                        disabled={testingSending.overdue || !settings.overdue_notification_recipients}
                        variant="outline"
                        className="w-full"
                      >
                        {testingSending.overdue ? 'กำลังส่งทดสอบ...' : 'ทดสอบส่ง'}
                      </Button>
                    </>
                  )}

                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-xs text-blue-800 font-semibold mb-2">Cron Job URL:</p>
                    <div className="flex gap-2">
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
                      ⏰ แนะนำ: 09:00 น. ทุกวัน (<code className="bg-blue-100 px-1 rounded">0 9 * * *</code>)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* การแจ้งเตือนห้องว่าง */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-xl">
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
                      <p className="text-xs text-slate-500">
                        {settings.vacant_room_notifications_enabled ? '✅ เปิดใช้งานแล้ว' : '❌ ปิดใช้งาน'}
                      </p>
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
                        />
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
                        {testingSending.vacant ? 'กำลังส่งทดสอบ...' : 'ทดสอบส่ง'}
                      </Button>
                    </>
                  )}

                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-xs text-blue-800 font-semibold mb-2">Cron Job URL:</p>
                    <div className="flex gap-2">
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
                      ⏰ แนะนำ: 10:00 น. ทุกวัน (<code className="bg-blue-100 px-1 rounded">0 10 * * *</code>)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* การแจ้งเตือนคำขอซ่อม */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-xl">
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
                      <p className="text-xs text-slate-500">
                        {settings.maintenance_notifications_enabled ? '✅ เปิดใช้งานแล้ว' : '❌ ปิดใช้งาน'}
                      </p>
                    </div>
                    <Switch
                      checked={settings.maintenance_notifications_enabled}
                      onCheckedChange={(checked) => setSettings({ ...settings, maintenance_notifications_enabled: checked })}
                    />
                  </div>

                  {settings.maintenance_notifications_enabled && (
                    <>
                      <div>
                        <Label>ระดับความสำคัญขั้นต่ำ</Label>
                        <select
                          value={settings.maintenance_priority_threshold}
                          onChange={(e) => setSettings({ ...settings, maintenance_priority_threshold: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                        >
                          <option value="low">ต่ำ (แจ้งทุกรายการ)</option>
                          <option value="medium">ปานกลาง</option>
                          <option value="high">สูง</option>
                          <option value="urgent">เร่งด่วนมาก</option>
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
                        {testingSending.maintenance ? 'กำลังส่งทดสอบ...' : 'ทดสอบส่ง'}
                      </Button>
                    </>
                  )}

                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-xs text-blue-800 font-semibold mb-2">Cron Job URL:</p>
                    <div className="flex gap-2">
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
                      ⏰ แนะนำ: ทุก 1 ชั่วโมง (<code className="bg-blue-100 px-1 rounded">0 * * * *</code>)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* การแจ้งเตือนสัญญาใกล้หมด */}
              <Card className="bg-white/80 backdrop-blur-sm shadow-xl">
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
                      <p className="text-xs text-slate-500">
                        {settings.contract_expiry_notifications_enabled ? '✅ เปิดใช้งานแล้ว' : '❌ ปิดใช้งาน'}
                      </p>
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
                        />
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
                        {testingSending.contract ? 'กำลังส่งทดสอบ...' : 'ทดสอบส่ง'}
                      </Button>
                    </>
                  )}

                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-xs text-blue-800 font-semibold mb-2">Cron Job URL:</p>
                    <div className="flex gap-2">
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
                      ⏰ แนะนำ: 08:00 น. ทุกวัน (<code className="bg-blue-100 px-1 rounded">0 8 * * *</code>)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ปุ่มบันทึก */}
            <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <CardContent className="p-6">
                <Button
                  onClick={handleSaveNotifications}
                  disabled={updateConfigMutation.isPending}
                  className="w-full bg-white text-blue-600 hover:bg-slate-100"
                >
                  {updateConfigMutation.isPending ? 'กำลังบันทึก...' : '💾 บันทึกการตั้งค่าทั้งหมด'}
                </Button>
              </CardContent>
            </Card>

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

                <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                  <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    ข้อควรระวัง:
                  </h4>
                  <ul className="text-sm text-amber-800 space-y-1 list-disc ml-5">
                    <li>ต้องกดปุ่ม "บันทึก" ก่อนที่ระบบจะส่งการแจ้งเตือน</li>
                    <li>ผู้รับการแจ้งเตือนต้องเพิ่ม LINE Official Account ของคุณเป็นเพื่อนก่อน</li>
                    <li>ถ้าไม่มีข้อมูลตามเงื่อนไข ระบบจะไม่ส่งข้อความ</li>
                    <li>ควรทดสอบส่งก่อนทุกครั้งเพื่อให้แน่ใจว่า LINE User ID ถูกต้อง</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Branch ID Dialog */}
      <Dialog open={showBranchIdDialog} onOpenChange={setShowBranchIdDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">🏢 ข้อมูล Branch ID ของสาขานี้</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-300 shadow-xl">
              <CardContent className="p-8">
                <div className="space-y-6">
                  <div className="bg-white rounded-xl p-6 border-2 border-blue-200 shadow-sm">
                    <Label className="text-blue-700 text-sm font-bold mb-3 block uppercase tracking-wide">
                      📍 ชื่อสาขา
                    </Label>
                    <p className="text-3xl font-bold text-slate-900 mb-2">
                      {selectedBranchName || 'ไม่พบข้อมูลชื่อสาขา'}
                    </p>
                  </div>
                  
                  <div className="bg-white rounded-xl p-6 border-2 border-green-300 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-green-700 text-sm font-bold uppercase tracking-wide flex items-center gap-2">
                        🔑 Branch ID (รหัสเฉพาะสาขา)
                      </Label>
                      {selectedBranchId && (
                        <Badge className="bg-green-600 text-white">พร้อมใช้งาน</Badge>
                      )}
                    </div>
                    
                    {selectedBranchId ? (
                      <div className="space-y-3">
                        <div className="bg-slate-100 rounded-lg p-4 border-2 border-slate-300">
                          <code className="text-xl font-mono font-bold text-slate-900 break-all block leading-relaxed">
                            {selectedBranchId}
                          </code>
                        </div>
                        <Button
                          onClick={() => copyToClipboard(selectedBranchId)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-6 text-lg shadow-lg"
                        >
                          {copied ? (
                            <>
                              <Check className="w-5 h-5 mr-2" />
                              คัดลอกแล้ว!
                            </>
                          ) : (
                            <>
                              <Copy className="w-5 h-5 mr-2" />
                              คัดลอก Branch ID
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-6 text-center">
                        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                        <p className="text-red-700 font-semibold mb-2">⚠️ ไม่พบ Branch ID</p>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}