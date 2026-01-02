import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, DollarSign, CreditCard, Shield, Users, ChevronDown, ChevronUp, Check, Settings as SettingsIcon, AlertTriangle, Calendar, Globe, MessageSquare, Save, Send, ArrowLeft, Bell, DoorOpen, Wrench, Package, TrendingDown, UserPlus, AlertCircle, RefreshCw, Sparkles, Zap, Crown, Loader2, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import SignaturePad from "../components/shared/SignaturePad";
import { Upload, X, Image as ImageIcon, PenTool } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import AddEmployeeDialog from "../components/settings/AddEmployeeDialog";
import PageHeader from "../components/shared/PageHeader";

import { format, parseISO, differenceInDays } from 'date-fns';
import { th } from 'date-fns/locale';
import { createPageUrl } from "@/utils";


// รายการสิทธิ์ทั้งหมดแบ่งตามหมวดหมู่
const PERMISSIONS_LIST = [
  { id: 'dashboard_view', label: 'ดูแดชบอร์ด', category: 'แดชบอร์ด' },

  { id: 'rooms_view', label: 'ดูห้องพัก', category: 'ห้องพัก' },
  { id: 'rooms_add', label: 'เพิ่มห้องพัก', category: 'ห้องพัก' },
  { id: 'rooms_edit', label: 'แก้ไขห้องพัก', category: 'ห้องพัก' },
  { id: 'rooms_delete', label: 'ลบห้องพัก', category: 'ห้องพัก' },

  { id: 'tenants_view', label: 'ดูผู้เช่า', category: 'ผู้เช่า' },
  { id: 'tenants_add', label: 'เพิ่มผู้เช่า', category: 'ผู้เช่า' },
  { id: 'tenants_edit', label: 'แก้ไขผู้เช่า', category: 'ผู้เช่า' },
  { id: 'tenants_delete', label: 'ลบผู้เช่า', category: 'ผู้เช่า' },

  { id: 'bookings_view_daily', label: 'ดูการจองรายวัน', category: 'การจอง' },
  { id: 'bookings_add_daily', label: 'เพิ่มการจองรายวัน', category: 'การจอง' },
  { id: 'bookings_edit_daily', label: 'แก้ไขการจองรายวัน', category: 'การจอง' },
  { id: 'bookings_delete_daily', label: 'ลบการจองรายวัน', category: 'การจอง' },

  { id: 'contracts_view_monthly', label: 'ดูสัญญาเช่ารายเดือน', category: 'สัญญาเช่า' },
  { id: 'contracts_add_monthly', label: 'เพิ่มสัญญาเช่ารายเดือน', category: 'สัญญาเช่า' },
  { id: 'contracts_edit_monthly', label: 'แก้ไขสัญญาเช่ารายเดือน', category: 'สัญญาเช่า' },
  { id: 'contracts_delete_monthly', label: 'ลบสัญญาเช่ารายเดือน', category: 'สัญญาเช่า' },

  { id: 'payments_view', label: 'ดูการชำระเงิน', category: 'การชำระเงิน' },
  { id: 'payments_add', label: 'เพิ่มรายการชำระเงิน', category: 'การชำระเงิน' },
  { id: 'payments_edit', label: 'แก้ไขรายการชำระเงิน', category: 'การชำระเงิน' },
  { id: 'bookings_edit_deposit', label: 'แก้ไขเงินมัดจำ', category: 'การชำระเงิน' },
  { id: 'payments_delete', label: 'ลบรายการชำระเงิน', category: 'การชำระเงิน' },
  { id: 'payments_update_status', label: 'อัปเดตสถานะการชำระเงิน', category: 'การชำระเงิน' },
  { id: 'payments_send_receipt', label: 'ส่งใบเสร็จ', category: 'การชำระเงิน' },

  { id: 'meter_readings_view', label: 'ดูบันทึกมิเตอร์', category: 'บันทึกมิเตอร์' },
  { id: 'meter_readings_add', label: 'เพิ่มบันทึกมิเตอร์', category: 'บันทึกมิเตอร์' },
  { id: 'meter_readings_edit', label: 'แก้ไขบันทึกมิเตอร์ (ปัจจุบัน)', category: 'บันทึกมิเตอร์' },
  { id: 'meter_readings_edit_history', label: 'แก้ไขประวัติมิเตอร์ย้อนหลัง', category: 'บันทึกมิเตอร์' },
  { id: 'meter_readings_delete', label: 'ลบบันทึกมิเตอร์', category: 'บันทึกมิเตอร์' },

  { id: 'expenses_view', label: 'ดูค่าใช้จ่าย', category: 'ค่าใช้จ่าย' },
  { id: 'expenses_add', label: 'เพิ่มค่าใช้จ่าย', category: 'ค่าใช้จ่าย' },
  { id: 'expenses_edit', label: 'แก้ไขค่าใช้จ่าย', category: 'ค่าใช้จ่าย' },
  { id: 'expenses_delete', label: 'ลบค่าใช้จ่าย', category: 'ค่าใช้จ่าย' },

  { id: 'maintenance_view', label: 'ดูแจ้งซ่อม', category: 'แจ้งซ่อม' },
  { id: 'maintenance_add', label: 'เพิ่มแจ้งซ่อม', category: 'แจ้งซ่อม' },
  { id: 'maintenance_edit', label: 'แก้ไขแจ้งซ่อม', category: 'แจ้งซ่อม' },
  { id: 'maintenance_delete', label: 'ลบแจ้งซ่อม', category: 'แจ้งซ่อม' },
  { id: 'maintenance_update_status', label: 'อัปเดตสถานะแจ้งซ่อม', category: 'แจ้งซ่อม' },

  { id: 'reports_view_all', label: 'ดูรายงานทั้งหมด', category: 'รายงาน' },
  { id: 'reports_export', label: 'ส่งออกรายงาน', category: 'รายงาน' },

  { id: 'accounting_view_all', label: 'ดูฐานข้อมูลบัญชี', category: 'ฐานข้อมูลบัญชี' },
  { id: 'accounting_export', label: 'ส่งออกข้อมูลบัญชี', category: 'ฐานข้อมูลบัญชี' },

  { id: 'announcements_send', label: 'ส่งข้อความประกาศ', category: 'ข้อความประกาศ' },

  { id: 'settings_view', label: 'ดูการตั้งค่า', category: 'การตั้งค่า' },
  { id: 'settings_edit', label: 'แก้ไขการตั้งค่า', category: 'การตั้งค่า' },
  { id: 'settings_access_test_mode', label: 'เข้าถึงโหมดทดสอบ (Developer)', category: 'การตั้งค่า' },
];

const DEFAULT_PERMISSIONS_MAP = {
  owner: PERMISSIONS_LIST.map(p => p.id).filter(id => id !== "settings_access_test_mode"),
  manager: [
    "dashboard_view",
    "rooms_view", "rooms_add", "rooms_edit",
    "tenants_view", "tenants_add", "tenants_edit",
    "bookings_view_daily", "bookings_add_daily", "bookings_edit_daily", "bookings_delete_daily",
    "contracts_view_monthly", "contracts_add_monthly", "contracts_edit_monthly",
    "payments_view", "payments_add", "payments_update_status", "payments_send_receipt",
    "meter_readings_view", "meter_readings_add", "meter_readings_edit", "meter_readings_edit_history",
    "expenses_view", "expenses_add",
    "maintenance_view", "maintenance_add", "maintenance_edit", "maintenance_update_status",
    "reports_view_all", "reports_export",
    "accounting_view_all",
    "announcements_send",
    "settings_view", "settings_edit"
  ],
  employee: [
    "dashboard_view",
    "rooms_view",
    "tenants_view",
    "bookings_view_daily",
    "contracts_view_monthly",
    "payments_view", "payments_send_receipt",
    "meter_readings_view", "meter_readings_add", "meter_readings_edit", "meter_readings_edit_history",
    "expenses_view",
    "maintenance_view", "maintenance_add"
  ],
};

const CATEGORY_ICONS = {
  'แดชบอร์ด': '',
  'ห้องพัก': '',
  'ผู้เช่า': '',
  'การจอง': '',
  'สัญญาเช่า': '',
  'การชำระเงิน': '',
  'บันทึกมิเตอร์': '',
  'ค่าใช้จ่าย': '',
  'แจ้งซ่อม': '',
  'รายงาน': '',
  'ฐานข้อมูลบัญชี': '',
  'ข้อความประกาศ': '',
  'การตั้งค่า': '',
};

const PERMISSION_CATEGORIES_DISPLAY = PERMISSIONS_LIST.reduce((acc, permission) => {
  if (!acc[permission.category]) {
    acc[permission.category] = {
      title: permission.category,
      icon: CATEGORY_ICONS[permission.category] || '📦',
      permissions: []
    };
  }
  acc[permission.category].permissions.push(permission);
  return acc;
}, {});

const BranchToggle = ({ applyToAllBranches, setApplyToAllBranches, selectedBranch, canSetGlobalConfig }) => {
  if (!canSetGlobalConfig || !selectedBranch) return null;

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
      <div className="flex items-center gap-2">
        <Globe className={`w-5 h-5 ${applyToAllBranches ? 'text-blue-600' : 'text-slate-500'}`} />
        <div className="text-sm">
          <p className={`font-semibold ${applyToAllBranches ? 'text-blue-700' : 'text-slate-700'}`}>
            {applyToAllBranches ? 'ใช้กับทุกสาขาที่คุณดูแล' : `เฉพาะ ${selectedBranch.name}`}
          </p>
          <p className="text-xs text-slate-600">
            {applyToAllBranches ? 'การตั้งค่าจะมีผลกับทุกสาขาที่คุณมีสิทธิ์เข้าถึง' : 'การตั้งค่าจะมีผลเฉพาะสาขานี้'}
          </p>
        </div>
      </div>
      <Switch
        checked={applyToAllBranches}
        onCheckedChange={setApplyToAllBranches}
        className="data-[state=checked]:bg-blue-600"
      />
    </div>
  );
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState('building');
  const [facebookPages, setFacebookPages] = useState([]);
  const [showPageSelectionDialog, setShowPageSelectionDialog] = useState(false);
  const [selectedPage, setSelectedPage] = useState(null);

  const [buildingInfo, setBuildingInfo] = useState({
    building_name: '',
    address: '',
    phone: '',
  });

  const [lessorInfo, setLessorInfo] = useState({
    lessor_name: '',
    lessor_id: '',
    lessor_phone: '',
    lessor_address: '',
  });

  const [companyInfo, setCompanyInfo] = useState({
    company_name: '',
    company_registration_number: '',
    company_tax_id: '',
    company_phone: '',
    company_address: '',
    use_building_address: false,
  });
  const [hasCompanyInfo, setHasCompanyInfo] = useState(false);

  const [billingRates, setBillingRates] = useState({
    water_rate: '',
    electricity_rate: '',
    internet_fee: '',
    common_fee: '',
    car_parking_fee: '',
    motorcycle_parking_fee: '',
    // ค่าขั้นต่ำสำหรับการใช้น้ำ/ไฟต่ำ
    water_minimum_enabled: false,
    water_minimum_units: '3',
    water_minimum_charge: '',
    electricity_minimum_enabled: false,
    electricity_minimum_units: '3',
    electricity_minimum_charge: ''
  });

  const [billSettings, setBillSettings] = useState({
    bill_generation_day: '27',
    pay_day: '5',
    late_fee_per_day: '',
    auto_send_bills: false,
    bill_advance_notice_days: '3',
    send_advance_reminder: false,
    send_due_date_reminder: false,
    send_overdue_reminder: false,
    // ค่าปรับแบบขั้นบันได
    late_fee_tiers_enabled: false,
    late_fee_tiers: [
      { days_from: 1, days_to: 7, fee_per_day: '' },
      { days_from: 8, days_to: 14, fee_per_day: '' },
      { days_from: 15, days_to: 30, fee_per_day: '' },
      { days_from: 31, days_to: 999, fee_per_day: '' }
    ]
  });

  const [bankInfo, setBankInfo] = useState({
    account_name: '',
    account_number: '',
    bank_name: '',
    promptpay: ''
  });

  const [lineSettings, setLineSettings] = useState({
    line_channel_access_token: '',
    line_channel_secret: ''
  });
  const [facebookSettings, setFacebookSettings] = useState({
    facebook_page_access_token: '',
    facebook_verify_token: ''
  });

  const [applyToAllBranches_line, setApplyToAllBranches_line] = useState(false);
  const [applyToAllBranches_facebook, setApplyToAllBranches_facebook] = useState(false);

  const [expandedCategories, setExpandedCategories] = useState({});
  const [userPermissions, setUserPermissions] = useState({});
  const [selectedUserForPermissions, setSelectedUserForPermissions] = useState(null);
  const [showPermissionsDialog, setShowPermissionsDialog] = useState(false);

  const [signatureImage, setSignatureImage] = useState('');
  const [stampImage, setStampImage] = useState('');
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [uploadingSignature, setUploadingSignature] = useState(false);
  const [uploadingStamp, setUploadingStamp] = useState(false);
  const signaturePadRef = React.useRef(null);

  const [buildingLogo, setBuildingLogo] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // แยก state สำหรับแต่ละหมวด
  const [applyToAllBranches_building, setApplyToAllBranches_building] = useState(false);
  const [applyToAllBranches_billing, setApplyToAllBranches_billing] = useState(false);
  const [applyToAllBranches_billNotif, setApplyToAllBranches_billNotif] = useState(false);
  const [applyToAllBranches_bank, setApplyToAllBranches_bank] = useState(false);
  const [applyToAllBranches_signature, setApplyToAllBranches_signature] = useState(false);
  const [applyToAllBranches_meter, setApplyToAllBranches_meter] = useState(false);

  // ✅ เพิ่ม state สำหรับการแจ้งเตือน (Updated structure)
  const [notificationSettings, setNotificationSettings] = useState({
    enabled: true,
    overdue_payment_days: 1,
    vacant_room_days: 7,
    urgent_maintenance_enabled: true,
    unclaimed_delivery_days: 5,
    low_daily_revenue_percent: 20
  });

  // เพิ่ม state สำหรับ Branch Access Dialog
  const [showBranchAccessDialog, setShowBranchAccessDialog] = useState(false);
  const [selectedUserForBranches, setSelectedUserForBranches] = useState(null);
  const [userBranchAccess, setUserBranchAccess] = useState({});

  // NEW: State for AddEmployeeDialog
  const [showAddEmployeeDialog, setShowAddEmployeeDialog] = useState(false);

  const [meterSettings, setMeterSettings] = useState({
    allow_editing_history: false
  });
  
  // Debug Console for iPad/Mobile (Developer only)
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugConsole, setShowDebugConsole] = useState(false);
  const debugConsoleRef = React.useRef(null);
  
  // Loading state for LINE settings
  const [isSavingLineSettings, setIsSavingLineSettings] = useState(false);
  const [isSavingFacebookSettings, setIsSavingFacebookSettings] = useState(false);
  const [isSavingBuildingInfo, setIsSavingBuildingInfo] = useState(false);
  const [isSavingBillingRates, setIsSavingBillingRates] = useState(false);
  const [isSavingBillSettings, setIsSavingBillSettings] = useState(false);
  const [justSavedBillSettings, setJustSavedBillSettings] = useState(false);
  const [isSavingBankInfo, setIsSavingBankInfo] = useState(false);
  
  const addDebugLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('th-TH');
    setDebugLogs(prev => [...prev, { timestamp, message, type }]);
  };
  
  const clearDebugLogs = () => {
    setDebugLogs([]);
  };
  
  // Auto-scroll debug console
  React.useEffect(() => {
    if (debugConsoleRef.current && showDebugConsole) {
      debugConsoleRef.current.scrollTop = debugConsoleRef.current.scrollHeight;
    }
  }, [debugLogs, showDebugConsole]);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // ⭐ โหลด currentUser ก่อนเสมอ (ป้องกัน "Cannot access before initialization")
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
  const canManagePermissions = userRole === 'developer' || userRole === 'owner';
  const canSetGlobalConfig = userRole === 'developer' || userRole === 'owner';

  // Listen for Facebook Pages data
  useEffect(() => {
    const handleMessage = async (event) => {
      if (event.data.type === 'facebook_pages_loaded') {
        const pages = event.data.pages;
        setFacebookPages(pages);
        
        if (pages.length === 1) {
          // Auto-select if only one page
          await saveFacebookPageToken(pages[0]);
        } else {
          // Show selection dialog
          setShowPageSelectionDialog(true);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const saveFacebookPageToken = async (page) => {
    try {
      const response = await base44.functions.invoke('facebookSavePageToken', {
        branch_id: selectedBranch?.id,
        page_id: page.id,
        access_token: page.access_token,
        page_name: page.name
      });

      if (response.data.success) {
        toast.success(`เชื่อมต่อกับ ${page.name} สำเร็จ!`);
        queryClient.invalidateQueries(['configs']);
        setShowPageSelectionDialog(false);
      } else {
        toast.error('ไม่สามารถบันทึก Token ได้');
      }
    } catch (error) {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  };

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: async () => {
      const allConfigs = await base44.entities.Config.list();
      // Filter เฉพาะ configs ที่เกี่ยวข้องกับสาขาที่มีสิทธิ์
      if (userRole === 'developer') return allConfigs;
      
      const accessibleBranchIds = currentUser?.accessible_branches || [];
      return allConfigs.filter(c => 
        !c.branch_id || // Global configs
        accessibleBranchIds.includes(c.branch_id) // Configs ของสาขาที่เข้าถึงได้
      );
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const allBranches = await base44.entities.Branch.list();
      // Filter เฉพาะสาขาที่มีสิทธิ์เข้าถึง
      if (userRole === 'developer') return allBranches;
      
      const accessibleBranchIds = currentUser?.accessible_branches;
      
      // ⭐ ถ้ามี accessible_branches set (ไม่ว่าจะ [] หรือมีค่า) = กรองตาม list นั้น
      if (accessibleBranchIds !== null && accessibleBranchIds !== undefined) {
        return allBranches.filter(b => accessibleBranchIds.includes(b.id));
      }
      
      // ⭐ ถ้าไม่ได้ set accessible_branches = ไม่แสดงสาขาเลย (แสดงแค่ [])
      return [];
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: notificationConfigs = [] } = useQuery({
    queryKey: ['notificationConfigs'],
    queryFn: async () => {
      const allConfigs = await base44.entities.NotificationConfig.list();
      // Filter เฉพาะ configs ของสาขาที่มีสิทธิ์
      if (userRole === 'developer') return allConfigs;
      
      const accessibleBranchIds = currentUser?.accessible_branches || [];
      return allConfigs.filter(c => 
        !c.branch_id || // Global configs
        accessibleBranchIds.includes(c.branch_id)
      );
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: appSubscriptions = [] } = useQuery({
    queryKey: ['appSubscriptions'],
    queryFn: () => base44.entities.AppSubscription.list('-created_date', 10),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: branchPackages = [], isLoading: branchPackagesLoading } = useQuery({
    queryKey: ['branchPackages'],
    queryFn: () => base44.entities.BranchPackage.list('-created_date', 200),
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const { data: crmPackages } = useQuery({
    queryKey: ['crmPackages'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPackagesFromCRM', {});
      return response.data;
    },
    enabled: !!currentUser,
    staleTime: 5 * 60 * 1000,
  });

  const [selectedBranch] = useState(() => {
    const branchId = localStorage.getItem('selected_branch_id');
    const branchName = localStorage.getItem('selected_branch_name');
    return (branchId && branchName) ? { id: branchId, name: branchName } : null;
  });

  const getConfigValue = (key, defaultValue = '') => {
    const config = configs.find(c => c.key === key && !c.branch_id);
    return config?.value || defaultValue;
  };

  const appMode = getConfigValue('app_mode', 'single_tenant');

  // ⭐ User-Centric Package Model - ดูจาก currentUser.plan_status
  const activeSubscription = (() => {
    if (!currentUser) return null;
    
    const planStatus = currentUser.plan_status; // 'trial' | 'active' | 'expired' | 'cancelled'
    const trialEndsAt = currentUser.trial_ends_at;
    const subscriptionEndDate = currentUser.subscription_end_date;
    const packageId = currentUser.package_id;
    
    // ถ้าไม่มี plan_status หรือ expired/cancelled = ไม่มี package
    if (!planStatus || planStatus === 'expired' || planStatus === 'cancelled') {
      return null;
    }
    
    // ⭐ สร้าง subscription object จาก User data
    return {
      package_id: packageId || 'trial',
      package_name: packageId || 'ทดลองใช้งาน',
      app_name: packageId || 'ทดลองใช้งาน',
      status: planStatus, // 'trial' | 'active'
      subscription_end_date: planStatus === 'trial' ? trialEndsAt : subscriptionEndDate,
      trial_end_date: planStatus === 'trial' ? trialEndsAt : null,
      subscription_start_date: currentUser.created_date, // ใช้วันที่สร้าง user แทน
      payment_status: 'paid',
      auto_renew: false,
      notes: null
    };
  })();


  const getDaysRemaining = () => {
    if (!activeSubscription?.subscription_end_date) return null;
    try {
      const endDate = parseISO(activeSubscription.subscription_end_date);
      return differenceInDays(endDate, new Date());
    } catch (e) {
      console.error("Error parsing subscription end date:", e);
      return null;
    }
  };

  const daysRemaining = getDaysRemaining();

  const crmPackageInfo = React.useMemo(() => {
    if (!activeSubscription || !crmPackages?.packages) return null;
    return crmPackages.packages.find(p => p.id === activeSubscription.package_id);
  }, [activeSubscription, crmPackages]);

  useEffect(() => {
    const getConfigValue = (key, applyToAll = true) => {
      if (!selectedBranch) {
        return configs.find(c => c.key === key && !c.branch_id);
      }
      
      // ✅ ดึงค่าจากสาขาที่เลือกอยู่เสมอ (Toggle ควบคุมแค่ว่าจะ "บันทึก" ไปที่ไหน)
      const branchConfig = configs.find(c => c.key === key && c.branch_id === selectedBranch.id);
      if (branchConfig) return branchConfig;
      
      // Fallback to global config if no branch-specific config exists
      return configs.find(c => c.key === key && !c.branch_id);
    };

    const buildingNameConfig = getConfigValue('building_name');
    const addressConfig = getConfigValue('building_address');
    const phoneConfig = getConfigValue('building_phone');
    const buildingLogoConfig = getConfigValue('building_logo');
    const waterRateConfig = getConfigValue('water_rate');
    const electricityRateConfig = getConfigValue('electricity_rate');
    const lateFeeConfig = getConfigValue('late_payment_fee_per_day');
    const internetFeeConfig = getConfigValue('internet_rate');
    const commonFeeConfig = getConfigValue('common_fee');
    const accountNameConfig = getConfigValue('bank_account_name');
    const accountNumberConfig = getConfigValue('bank_account_number');
    const bankNameConfig = getConfigValue('bank_name');
    const promptpayConfig = getConfigValue('promptpay');
    const lessorNameConfig = getConfigValue('lessor_name');
    const lessorIdConfig = getConfigValue('lessor_id');
    const lessorPhoneConfig = getConfigValue('lessor_phone');
    const lessorAddressConfig = getConfigValue('lessor_address');
    const companyNameConfig = getConfigValue('company_name');
    const companyRegistrationConfig = getConfigValue('company_registration_number');
    const companyTaxIdConfig = getConfigValue('company_tax_id');
    const companyPhoneConfig = getConfigValue('company_phone');
    const companyAddressConfig = getConfigValue('company_address');
    const useCompanyAddressConfig = getConfigValue('use_building_address_for_company');
    
    if (companyNameConfig?.value) {
      setHasCompanyInfo(true);
    }
    const billGenerationDayConfig = getConfigValue('bill_generation_day');
    const payDayConfig = getConfigValue('pay_day');
    const autoSendBillsConfig = getConfigValue('auto_send_bills_after_generation');
    const billAdvanceNoticeConfig = getConfigValue('bill_advance_notice_days');
    const sendAdvanceReminderConfig = getConfigValue('send_advance_reminder');
    const sendDueDateReminderConfig = getConfigValue('send_due_date_reminder');
    const sendOverdueReminderConfig = getConfigValue('send_overdue_reminder');
    const lateFeeeTiersEnabledConfig = getConfigValue('late_fee_tiers_enabled');
    const lateFeeTiersConfig = getConfigValue('late_fee_tiers');
    const carParkingFeeConfig = getConfigValue('car_parking_fee');
    const motorcycleParkingFeeConfig = getConfigValue('motorcycle_parking_fee');
    const waterMinimumEnabledConfig = getConfigValue('water_minimum_enabled');
    const waterMinimumUnitsConfig = getConfigValue('water_minimum_units');
    const waterMinimumChargeConfig = getConfigValue('water_minimum_charge');
    const electricityMinimumEnabledConfig = getConfigValue('electricity_minimum_enabled');
    const electricityMinimumUnitsConfig = getConfigValue('electricity_minimum_units');
    const electricityMinimumChargeConfig = getConfigValue('electricity_minimum_charge');
    const signatureConfig = getConfigValue('receipt_signature');
    const stampConfig = getConfigValue('receipt_stamp');
    const lineTokenConfig = getConfigValue('line_channel_access_token');
    const lineSecretConfig = getConfigValue('line_channel_secret');
    const facebookTokenConfig = getConfigValue('facebook_page_access_token');
    const facebookVerifyTokenConfig = getConfigValue('facebook_verify_token');
    const allowMeterHistoryEditingConfig = getConfigValue('allow_meter_history_editing');

    const allLineTokenConfigs = configs.filter(c => c.key === 'line_channel_access_token');
    
    // Log for debugging
    const logMsg1 = `🔄 กำลังโหลด LINE Config - สาขา: ${selectedBranch?.name || 'null'}`;
    const logMsg2 = `   พบ Config ทั้งหมด: ${allLineTokenConfigs.length} ตัว`;
    const logMsg3 = lineTokenConfig 
      ? `   ✅ โหลด Config จากสาขา: ${lineTokenConfig.branch_id ? (branches.find(b => b.id === lineTokenConfig.branch_id)?.branch_name || 'ไม่พบชื่อ') : 'Global'}`
      : `   ❌ ไม่พบ Config - ใช้ค่าว่าง`;
    
    addDebugLog(logMsg1);
    addDebugLog(logMsg2);
    addDebugLog(logMsg3);
    
    console.log('');
    console.log('🔄 ============= กำลังโหลด LINE Config =============');
    console.log('📍 ข้อมูลสาขา:');
    console.log('   - selectedBranch.id:', selectedBranch?.id || 'null');
    console.log('   - selectedBranch.name:', selectedBranch?.name || 'null');
    console.log('   - Toggle ทุกสาขา:', applyToAllBranches_line ? '✅ เปิด' : '❌ ปิด');
    console.log('');
    console.log('🔍 ค้นหา Config จาก Database:');
    
    console.log(`   - พบ LINE Token Config ทั้งหมด: ${allLineTokenConfigs.length} ตัว`);
    allLineTokenConfigs.forEach((cfg, idx) => {
      const branchName = cfg.branch_id ? (branches.find(b => b.id === cfg.branch_id)?.branch_name || 'ไม่พบชื่อ') : 'Global';
      console.log(`   ${idx + 1}. ${branchName}`);
      console.log(`      - Config ID: ${cfg.id}`);
      console.log(`      - Branch ID: ${cfg.branch_id || 'null'}`);
      console.log(`      - Token: ${cfg.value ? cfg.value.substring(0, 30) + '...' : '(ว่าง)'}`);
      console.log(`      - Match กับสาขาที่เลือก: ${cfg.branch_id === selectedBranch?.id ? '✅ ใช่' : '❌ ไม่ใช่'}`);
    });
    
    console.log('');
    console.log('📥 Config ที่จะโหลดมาในฟอร์ม:');
    if (lineTokenConfig) {
      const branchName = lineTokenConfig.branch_id ? (branches.find(b => b.id === lineTokenConfig.branch_id)?.branch_name || 'ไม่พบชื่อ') : 'Global';
      console.log(`   ✅ พบ Config: ${branchName}`);
      console.log(`   - Config ID: ${lineTokenConfig.id}`);
      console.log(`   - Branch ID: ${lineTokenConfig.branch_id || 'null'}`);
      console.log(`   - Token: ${lineTokenConfig.value ? lineTokenConfig.value.substring(0, 40) + '...' : '(ว่าง)'}`);
    } else {
      console.log('   ❌ ไม่พบ Config เลย - จะใช้ค่าว่าง');
    }
    
    if (lineSecretConfig) {
      console.log(`   ✅ พบ Secret Config`);
      console.log(`   - Secret: ${lineSecretConfig.value ? lineSecretConfig.value.substring(0, 40) + '...' : '(ว่าง)'}`);
    } else {
      console.log('   ❌ ไม่พบ Secret Config');
    }
    console.log('');

    setBuildingLogo(buildingLogoConfig?.value || '');
    setSignatureImage(signatureConfig?.value || '');
    setStampImage(stampConfig?.value || '');
    
    // ✅ อัปเดต LINE settings - อัปเดตทุกครั้งเพื่อให้แน่ใจว่าสอดคล้องกับ config
    const newTokenValue = lineTokenConfig?.value || '';
    const newSecretValue = lineSecretConfig?.value || '';
    
    console.log('🔄 กำลังอัปเดต State:');
    console.log(`   - Token ใหม่: ${newTokenValue ? newTokenValue.substring(0, 40) + '...' : '(ว่าง)'}`);
    console.log(`   - Secret ใหม่: ${newSecretValue ? newSecretValue.substring(0, 40) + '...' : '(ว่าง)'}`);
    
    setLineSettings(prev => {
      const newSettings = {
        line_channel_access_token: newTokenValue,
        line_channel_secret: newSecretValue
      };
      
      if (prev.line_channel_access_token === newSettings.line_channel_access_token &&
          prev.line_channel_secret === newSettings.line_channel_secret) {
        return prev;
      }
      return newSettings;
    });

    setFacebookSettings({
        facebook_page_access_token: facebookTokenConfig?.value || '',
        facebook_verify_token: facebookVerifyTokenConfig?.value || ''
    });

    setMeterSettings(prev => ({...prev, allow_editing_history: allowMeterHistoryEditingConfig?.value === 'true' }));

    setBuildingInfo({
      building_name: buildingNameConfig?.value || '',
      address: addressConfig?.value || '',
      phone: phoneConfig?.value || '',
    });
    setLessorInfo({
      lessor_name: lessorNameConfig?.value || '',
      lessor_id: lessorIdConfig?.value || '',
      lessor_phone: lessorPhoneConfig?.value || '',
      lessor_address: lessorAddressConfig?.value || '',
    });
    setCompanyInfo({
      company_name: companyNameConfig?.value || '',
      company_registration_number: companyRegistrationConfig?.value || '',
      company_tax_id: companyTaxIdConfig?.value || '',
      company_phone: companyPhoneConfig?.value || '',
      company_address: companyAddressConfig?.value || '',
      use_building_address: useCompanyAddressConfig?.value === 'true',
    });
    setBillingRates({
      water_rate: waterRateConfig?.value ?? '',
      electricity_rate: electricityRateConfig?.value ?? '',
      internet_fee: internetFeeConfig?.value ?? '',
      common_fee: commonFeeConfig?.value ?? '',
      car_parking_fee: carParkingFeeConfig?.value ?? '',
      motorcycle_parking_fee: motorcycleParkingFeeConfig?.value ?? '',
      water_minimum_enabled: waterMinimumEnabledConfig?.value === 'true',
      water_minimum_units: waterMinimumUnitsConfig?.value ?? '3',
      water_minimum_charge: waterMinimumChargeConfig?.value ?? '',
      electricity_minimum_enabled: electricityMinimumEnabledConfig?.value === 'true',
      electricity_minimum_units: electricityMinimumUnitsConfig?.value ?? '3',
      electricity_minimum_charge: electricityMinimumChargeConfig?.value ?? ''
    });
    // Parse late fee tiers
    let parsedTiers = [
      { days_from: 1, days_to: 7, fee_per_day: '' },
      { days_from: 8, days_to: 14, fee_per_day: '' },
      { days_from: 15, days_to: 30, fee_per_day: '' },
      { days_from: 31, days_to: 999, fee_per_day: '' }
    ];
    if (lateFeeTiersConfig?.value) {
      try {
        parsedTiers = JSON.parse(lateFeeTiersConfig.value);
      } catch (e) {
        console.error('Error parsing late fee tiers:', e);
      }
    }

    setBillSettings({
      bill_generation_day: billGenerationDayConfig?.value || '27',
      pay_day: payDayConfig?.value || '5',
      late_fee_per_day: lateFeeConfig?.value || '',
      auto_send_bills: autoSendBillsConfig?.value === 'true',
      bill_advance_notice_days: billAdvanceNoticeConfig?.value || '3',
      send_advance_reminder: sendAdvanceReminderConfig?.value === 'true',
      send_due_date_reminder: sendDueDateReminderConfig?.value === 'true',
      send_overdue_reminder: sendOverdueReminderConfig?.value === 'true',
      late_fee_tiers_enabled: lateFeeeTiersEnabledConfig?.value === 'true',
      late_fee_tiers: parsedTiers
    });
    setBankInfo({
      account_name: accountNameConfig?.value || '',
      account_number: accountNumberConfig?.value || '',
      bank_name: bankNameConfig?.value || '',
      promptpay: promptpayConfig?.value || ''
    });
  }, [configs, selectedBranch]);

  // NEW useEffect for notificationConfigs
  useEffect(() => {
    const targetBranchId = applyToAllBranches_billNotif ? null : selectedBranch?.id;
    const config = notificationConfigs.find(c =>
      (applyToAllBranches_billNotif ? !c.branch_id : c.branch_id === targetBranchId)
    );

    if (config) {
      setNotificationSettings({
        enabled: config.enabled ?? true,
        overdue_payment_days: config.overdue_payment_days ?? 1,
        vacant_room_days: config.vacant_room_days ?? 7,
        urgent_maintenance_enabled: config.urgent_maintenance_enabled ?? true,
        unclaimed_delivery_days: config.unclaimed_delivery_days ?? 5,
        low_daily_revenue_percent: config.low_daily_revenue_percent ?? 20
      });
    } else {
      // If no config found for the current scope, set to default values
      setNotificationSettings({
        enabled: true,
        overdue_payment_days: 1,
        vacant_room_days: 7,
        urgent_maintenance_enabled: true,
        unclaimed_delivery_days: 5,
        low_daily_revenue_percent: 20
      });
    }
  }, [notificationConfigs, selectedBranch, applyToAllBranches_billNotif]);


  useEffect(() => {
    const initialPermissions = {};
    users.forEach(user => {
      initialPermissions[user.id] = user.permissions || [];
    });
    setUserPermissions(initialPermissions);
  }, [users]);

  const updateConfigMutation = useMutation({
    mutationFn: async ({ key, value, description, category, value_type = 'string', applyToAllBranches }) => {
      const userAccessibleBranches = currentUser?.accessible_branches || [];
      const isDeveloper = userRole === 'developer' && (!userAccessibleBranches || userAccessibleBranches.length === 0);
      
      // Helper function to process items in chunks to avoid Rate Limits (429 Errors)
      const processInChunks = async (items, fn, chunkSize = 3) => {
        const results = [];
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const chunkResults = await Promise.all(chunk.map(fn));
          results.push(...chunkResults);
          // Small delay between chunks to be nice to the API
          if (i + chunkSize < items.length) await new Promise(r => setTimeout(r, 300));
        }
        return results;
      };

      // ⭐ Case 1: Owner/Manager saving to ALL accessible branches
      if (applyToAllBranches && !isDeveloper && userAccessibleBranches.length > 0) {
        return processInChunks(userAccessibleBranches, async (branchId) => {
          const existingConfigs = configs.filter(c => c.key === key && c.branch_id === branchId);
          
          if (existingConfigs.length > 0) {
            const first = existingConfigs[0];
            // Optimization: Skip update if value hasn't changed
            if (first.value === value.toString()) return first;

            // Update the first match
            await base44.entities.Config.update(first.id, { 
              value: value.toString(),
              value_type,
              description,
              category: category || 'billing' 
            });
            
            // Cleanup of duplicates disabled to prevent rate limiting
            // This was causing 429 errors when many duplicates existed
            
            return first;
          } else {
            // Create new
            return base44.entities.Config.create({
              key,
              value: value.toString(),
              value_type,
              description,
              category: category || 'billing',
              branch_id: branchId
            });
          }
        });
      }
      
      // ⭐ Case 2: Developer Global (branch_id = null)
      if (applyToAllBranches && isDeveloper) {
          const globalConfigs = configs.filter(c => c.key === key && !c.branch_id);
          
          if (globalConfigs.length > 0) {
              const first = globalConfigs[0];
              if (first.value !== value.toString()) {
                  await base44.entities.Config.update(first.id, { value: value.toString() });
              }
              
              // Cleanup of duplicates disabled to prevent rate limiting
              
              return first;
          } else {
              return base44.entities.Config.create({
                  key,
                  value: value.toString(),
                  value_type,
                  description,
                  category: category || 'billing',
                  branch_id: null
              });
          }
      }

      // ⭐ Case 3: Specific Branch (Single update)
      const targetBranchId = selectedBranch?.id;
      // Safety check
      if (!applyToAllBranches && !targetBranchId) {
          throw new Error("ไม่พบข้อมูลสาขา กรุณาเลือกสาขาก่อนบันทึก");
      }

      const branchConfigs = configs.filter(c => c.key === key && c.branch_id === targetBranchId);
      
      if (branchConfigs.length > 0) {
          const first = branchConfigs[0];
          if (first.value !== value.toString()) {
              await base44.entities.Config.update(first.id, { 
                  value: value.toString(),
                  value_type,
                  description,
                  category: category || 'billing'
              });
          }
          
          // Cleanup of duplicates disabled to prevent rate limiting
          
          return first;
      } else {
          return base44.entities.Config.create({
              key,
              value: value.toString(),
              value_type,
              description,
              category: category || 'billing',
              branch_id: targetBranchId
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

  const updateUserPermissionsMutation = useMutation({
    mutationFn: ({ userId, permissions }) => base44.entities.User.update(userId, { permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('อัปเดตสิทธิ์สำเร็จ');
    },
    onError: () => {
      toast.error('อัปเดตสิทธิ์ไม่สำเร็จ');
    }
  });

  const updateUserRoleMutation = useMutation({
    mutationFn: ({ userId, custom_role, permissions }) =>
      base44.entities.User.update(userId, { custom_role, permissions }),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('เปลี่ยนบทบาทสำเร็จ');
    },
    onError: () => {
      toast.error('เปลี่ยนบทบาทไม่สำเร็จ');
    }
  });

  // เพิ่ม mutation สำหรับอัปเดต accessible_branches
  const updateUserBranchesMutation = useMutation({
    mutationFn: ({ userId, accessible_branches }) =>
      base44.entities.User.update(userId, { accessible_branches }),
    onSuccess: () => {
      queryClient.invalidateQueries(['users']);
      toast.success('อัปเดตสาขาที่เข้าถึงได้สำเร็จ');
    },
    onError: () => {
      toast.error('อัปเดตสาขาที่เข้าถึงได้ไม่สำเร็จ');
    }
  });

  // NEW: Mutation for NotificationConfig
  const saveNotificationSettingsMutation = useMutation({
    mutationFn: async (data) => {
      const userAccessibleBranches = currentUser?.accessible_branches || [];
      const isDeveloper = userRole === 'developer' && (!userAccessibleBranches || userAccessibleBranches.length === 0);
      
      // Helper function to process items in chunks (Inline definition to avoid dependency issues)
      const processInChunks = async (items, fn, chunkSize = 3) => {
        const results = [];
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const chunkResults = await Promise.all(chunk.map(fn));
          results.push(...chunkResults);
          if (i + chunkSize < items.length) await new Promise(r => setTimeout(r, 300));
        }
        return results;
      };

      // ⭐ Case 1: Owner/Manager saving to ALL accessible branches (Upsert Pattern)
      if (applyToAllBranches_billNotif && !isDeveloper && userAccessibleBranches.length > 0) {
        return processInChunks(userAccessibleBranches, async (branchId) => {
          const existingConfigs = notificationConfigs.filter(c => c.branch_id === branchId);
          
          if (existingConfigs.length > 0) {
            const first = existingConfigs[0];
            // Update first match
            return base44.entities.NotificationConfig.update(first.id, {
              ...data,
              branch_id: branchId
            });
            // Note: Duplicate cleanup disabled to prevent 429
          } else {
            // Create new
            return base44.entities.NotificationConfig.create({
              ...data,
              branch_id: branchId
            });
          }
        });
      }
      
      // ⭐ Case 2 & 3: Developer Global OR Specific Branch
      const targetBranchId = applyToAllBranches_billNotif ? null : selectedBranch?.id;
      
      // For specific branch, we might have existing config for that branch
      // For global (developer), we look for config with branch_id = null
      
      const existingConfigs = notificationConfigs.filter(c => 
        (applyToAllBranches_billNotif ? !c.branch_id : c.branch_id === targetBranchId)
      );

      if (existingConfigs.length > 0) {
        const first = existingConfigs[0];
        return base44.entities.NotificationConfig.update(first.id, {
          ...data,
          branch_id: targetBranchId
        });
        // Note: Duplicate cleanup disabled
      } else {
        return base44.entities.NotificationConfig.create({
          ...data,
          branch_id: targetBranchId
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['notificationConfigs']);
      toast.success('บันทึกการตั้งค่าการแจ้งเตือนสำเร็จ');
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาดในการบันทึกการตั้งค่า');
      console.error(error);
    }
  });

  // เพิ่ม handler สำหรับจัดการ branch access
  const handleOpenBranchAccessDialog = (user) => {
    setSelectedUserForBranches(user);
    setShowBranchAccessDialog(true);
    setUserBranchAccess({
      [user.id]: user.accessible_branches || []
    });
  };

  const toggleBranchAccess = (userId, branchId) => {
    setUserBranchAccess(prev => {
      const currentBranches = prev[userId] || [];
      const hasBranch = currentBranches.includes(branchId);

      const newBranches = hasBranch
        ? currentBranches.filter(b => b !== branchId)
        : [...currentBranches, branchId];

      return {
        ...prev,
        [userId]: newBranches
      };
    });
  };

  const handleSaveUserBranches = (userId) => {
    updateUserBranchesMutation.mutate({
      userId,
      accessible_branches: userBranchAccess[userId] || []
    });
    setShowBranchAccessDialog(false); // Close dialog after saving
  };

  // ฟังก์ชันช่วยเหลือในการแสดงชื่อสาขา
  const getBranchName = (branchId) => {
    const branch = branches.find(b => b.id === branchId);
    return branch?.branch_name || branchId;
  };

  const handleSaveSignature = async () => {
    if (signaturePadRef.current?.isEmpty()) {
      toast.error('กรุณาเซ็นลายเซ็นก่อน');
      return;
    }

    setUploadingSignature(true);
    try {
      const dataUrl = signaturePadRef.current.toDataURL();

      const blob = await fetch(dataUrl).then(r => r.blob());
      const file = new File([blob], `signature-${Date.now()}.png`, { type: 'image/png' });

      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      await updateConfigMutation.mutateAsync({
        key: 'receipt_signature',
        value: file_url,
        description: 'ลายเซ็นผู้รับเงินสำหรับใบเสร็จ',
        category: 'general',
        applyToAllBranches: applyToAllBranches_signature
      });

      setSignatureImage(file_url);
      setShowSignatureDialog(false);
      toast.success('บันทึกลายเซ็นสำเร็จ' + (applyToAllBranches_signature ? ' (ทุกสาขาที่คุณดูแล)' : ` (${selectedBranch?.name})`));
    } catch (error) {
      toast.error('บันทึกลายเซ็นไม่สำเร็จ');
    }
    setUploadingSignature(false);
  };

  const handleStampUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingStamp(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      await updateConfigMutation.mutateAsync({
        key: 'receipt_stamp',
        value: file_url,
        description: 'ตราประทับสำหรับใบเสร็จ',
        category: 'general',
        applyToAllBranches: applyToAllBranches_signature
      });

      setStampImage(file_url);
      toast.success('อัพโหลดตราประทับสำเร็จ' + (applyToAllBranches_signature ? ' (ทุกสาขาที่คุณดูแล)' : ` (${selectedBranch?.name})`));
    } catch (error) {
      toast.error('อัพโหลดตราประทับไม่สำเร็จ');
    }
    setUploadingStamp(false);
    e.target.value = '';
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
      e.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('ขนาดไฟล์ต้องไม่เกิน 5MB');
      e.target.value = '';
      return;
    }

    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      await updateConfigMutation.mutateAsync({
        key: 'building_logo',
        value: file_url,
        description: 'โลโก้หอพัก',
        category: 'general',
        applyToAllBranches: applyToAllBranches_building
      });

      setBuildingLogo(file_url);
      toast.success('อัพโหลดโลโก้สำเร็จ' + (applyToAllBranches_building ? ' (ทุกสาขา)' : ` (${selectedBranch?.name})`));
    } catch (error) {
      toast.error('อัพโหลดโลโก้ไม่สำเร็จ');
    }
    setUploadingLogo(false);
    e.target.value = '';
  };


  const handleBuildingInfoSubmit = async (e) => {
    e.preventDefault();
    setIsSavingBuildingInfo(true);
    try {
      const savePromises = [
        updateConfigMutation.mutateAsync({ key: 'building_name', value: buildingInfo.building_name, description: 'ชื่อหอพัก', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'building_address', value: buildingInfo.address, description: 'ที่อยู่หอพัก', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'building_phone', value: buildingInfo.phone, description: 'เบอร์โทรหอพัก', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'lessor_name', value: lessorInfo.lessor_name, description: 'ชื่อ-นามสกุลผู้ให้เช่า', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'lessor_id', value: lessorInfo.lessor_id, description: 'เลขบัตรประชาชนผู้ให้เช่า', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'lessor_phone', value: lessorInfo.lessor_phone, description: 'เบอร์โทรผู้ให้เช่า', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'lessor_address', value: lessorInfo.lessor_address, description: 'ที่อยู่ผู้ให้เช่า', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'company_name', value: companyInfo.company_name, description: 'ชื่อบริษัท (ถ้ามี)', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'company_registration_number', value: companyInfo.company_registration_number, description: 'เลขทะเบียนนิติบุคคล', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'company_tax_id', value: companyInfo.company_tax_id, description: 'เลขประจำตัวผู้เสียภาษี (13 หลัก)', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'company_phone', value: companyInfo.company_phone, description: 'เบอร์โทรบริษัท', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'company_address', value: companyInfo.use_building_address ? buildingInfo.address : companyInfo.company_address, description: 'ที่อยู่บริษัท (ตามทะเบียน)', category: 'general', applyToAllBranches: applyToAllBranches_building }),
        updateConfigMutation.mutateAsync({ key: 'use_building_address_for_company', value: companyInfo.use_building_address ? 'true' : 'false', description: 'ใช้ที่อยู่เดียวกับหอพัก', category: 'general', applyToAllBranches: applyToAllBranches_building })
      ];
      await Promise.all(savePromises);
      toast.success('บันทึกข้อมูลหอพักสำเร็จ' + (applyToAllBranches_building ? ' (ทุกสาขาที่คุณดูแล)' : ` (${selectedBranch?.name})`));
    } catch (error) {
      console.error('Building info save error:', error);
      toast.error('บันทึกข้อมูลไม่สำเร็จ: ' + (error.message || 'กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setIsSavingBuildingInfo(false);
    }
  };

  const handleBillingRatesSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    const waterRate = parseFloat(billingRates.water_rate);
    const electricityRate = parseFloat(billingRates.electricity_rate);
    
    if (isNaN(waterRate) || waterRate < 0) {
      toast.error('ค่าน้ำต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0');
      return;
    }
    
    if (isNaN(electricityRate) || electricityRate < 0) {
      toast.error('ค่าไฟต้องเป็นตัวเลขที่มากกว่าหรือเท่ากับ 0');
      return;
    }
    
    setIsSavingBillingRates(true);
    try {
      await Promise.all([
        updateConfigMutation.mutateAsync({ key: 'water_rate', value: billingRates.water_rate, description: 'ค่าน้ำต่อหน่วย (บาท)', value_type: 'number', applyToAllBranches: applyToAllBranches_billing }),
        updateConfigMutation.mutateAsync({ key: 'electricity_rate', value: billingRates.electricity_rate, description: 'ค่าไฟต่อหน่วย (บาท)', value_type: 'number', applyToAllBranches: applyToAllBranches_billing }),
        updateConfigMutation.mutateAsync({ key: 'internet_rate', value: billingRates.internet_fee, description: 'ค่าอินเทอร์เน็ต (บาท)', value_type: 'number', applyToAllBranches: applyToAllBranches_billing }),
        updateConfigMutation.mutateAsync({ key: 'common_fee', value: billingRates.common_fee, description: 'ค่าส่วนกลาง (บาท)', value_type: 'number', applyToAllBranches: applyToAllBranches_billing }),
        updateConfigMutation.mutateAsync({ key: 'car_parking_fee', value: billingRates.car_parking_fee, description: 'ค่าจอดรถยนต์ (บาท/คัน)', value_type: 'number', applyToAllBranches: applyToAllBranches_billing }),
        updateConfigMutation.mutateAsync({ key: 'motorcycle_parking_fee', value: billingRates.motorcycle_parking_fee, description: 'ค่าจอดรถมอเตอร์ไซค์ (บาท/คัน)', value_type: 'number', applyToAllBranches: applyToAllBranches_billing }),
        // ค่าขั้นต่ำสำหรับน้ำ
        updateConfigMutation.mutateAsync({ key: 'water_minimum_enabled', value: billingRates.water_minimum_enabled ? 'true' : 'false', description: 'เปิดใช้ค่าน้ำขั้นต่ำ', value_type: 'string', applyToAllBranches: applyToAllBranches_billing }),
        updateConfigMutation.mutateAsync({ key: 'water_minimum_units', value: billingRates.water_minimum_units, description: 'หน่วยน้ำขั้นต่ำ', value_type: 'number', applyToAllBranches: applyToAllBranches_billing }),
        updateConfigMutation.mutateAsync({ key: 'water_minimum_charge', value: billingRates.water_minimum_charge, description: 'ค่าน้ำขั้นต่ำ (บาท)', value_type: 'number', applyToAllBranches: applyToAllBranches_billing }),
        // ค่าขั้นต่ำสำหรับไฟ
        updateConfigMutation.mutateAsync({ key: 'electricity_minimum_enabled', value: billingRates.electricity_minimum_enabled ? 'true' : 'false', description: 'เปิดใช้ค่าไฟขั้นต่ำ', value_type: 'string', applyToAllBranches: applyToAllBranches_billing }),
        updateConfigMutation.mutateAsync({ key: 'electricity_minimum_units', value: billingRates.electricity_minimum_units, description: 'หน่วยไฟขั้นต่ำ', value_type: 'number', applyToAllBranches: applyToAllBranches_billing }),
        updateConfigMutation.mutateAsync({ key: 'electricity_minimum_charge', value: billingRates.electricity_minimum_charge, description: 'ค่าไฟขั้นต่ำ (บาท)', value_type: 'number', applyToAllBranches: applyToAllBranches_billing })
      ]);
      toast.success('บันทึกอัตราค่าใช้จ่ายสำเร็จ' + (applyToAllBranches_billing ? ' (ทุกสาขาที่คุณดูแล)' : ` (${selectedBranch?.name})`));
    } catch (error) {
      console.error('Billing rates save error:', error);
      toast.error('บันทึกอัตราค่าใช้จ่ายไม่สำเร็จ: ' + (error.message || 'กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setIsSavingBillingRates(false);
    }
  };

  const handleBillSettingsSubmit = async (e) => {
    e.preventDefault();
    setIsSavingBillSettings(true);
    try {
      await Promise.all([
        updateConfigMutation.mutateAsync({ key: 'bill_generation_day', value: billSettings.bill_generation_day, description: 'วันที่สร้างบิลอัตโนมัติ (วันที่ของเดือน)', category: 'general', value_type: 'number', applyToAllBranches: applyToAllBranches_billNotif }),
        updateConfigMutation.mutateAsync({ key: 'pay_day', value: billSettings.pay_day, description: 'วันครบกำหนดชำระ (วันที่ของเดือน)', category: 'general', value_type: 'number', applyToAllBranches: applyToAllBranches_billNotif }),
        updateConfigMutation.mutateAsync({ key: 'late_payment_fee_per_day', value: billSettings.late_fee_per_day, description: 'ค่าปรับล่าช้าต่อวัน (บาท)', value_type: 'number', applyToAllBranches: applyToAllBranches_billNotif }),
        updateConfigMutation.mutateAsync({ key: 'auto_send_bills_after_generation', value: billSettings.auto_send_bills ? 'true' : 'false', description: 'ส่งบิลอัตโนมัติหลังจากสร้างบิล', category: 'general', value_type: 'string', applyToAllBranches: applyToAllBranches_billNotif }),
        updateConfigMutation.mutateAsync({ key: 'bill_advance_notice_days', value: billSettings.bill_advance_notice_days, description: 'แจ้งบิลล่วงหน้ากี่วัน', category: 'general', value_type: 'number', applyToAllBranches: applyToAllBranches_billNotif }),
        updateConfigMutation.mutateAsync({ key: 'send_advance_reminder', value: billSettings.send_advance_reminder ? 'true' : 'false', description: 'เปิด/ปิดการแจ้งบิลล่วงหน้า', category: 'general', value_type: 'string', applyToAllBranches: applyToAllBranches_billNotif }),
        updateConfigMutation.mutateAsync({ key: 'send_due_date_reminder', value: billSettings.send_due_date_reminder ? 'true' : 'false', description: 'ส่งข้อความเตือนในวันครบกำหนดชำระ', category: 'general', value_type: 'string', applyToAllBranches: applyToAllBranches_billNotif }),
        updateConfigMutation.mutateAsync({ key: 'send_overdue_reminder', value: billSettings.send_overdue_reminder ? 'true' : 'false', description: 'ส่งข้อความเตือนเกินกำหนดชำระ', category: 'general', value_type: 'string', applyToAllBranches: applyToAllBranches_billNotif }),
        updateConfigMutation.mutateAsync({ key: 'late_fee_tiers_enabled', value: billSettings.late_fee_tiers_enabled ? 'true' : 'false', description: 'เปิดใช้ค่าปรับแบบขั้นบันได', category: 'billing', value_type: 'string', applyToAllBranches: applyToAllBranches_billNotif }),
        updateConfigMutation.mutateAsync({ key: 'late_fee_tiers', value: JSON.stringify(billSettings.late_fee_tiers), description: 'เงื่อนไขค่าปรับแบบขั้นบันได', category: 'billing', value_type: 'string', applyToAllBranches: applyToAllBranches_billNotif })
      ]);
      
      // ✅ Success Message (Requested Feature)
      toast.success('✅ บันทึกการตั้งค่าบิลสำเร็จแล้ว', {
        description: applyToAllBranches_billNotif
          ? 'มีผลกับทุกสาขาที่คุณดูแล'
          : `มีผลเฉพาะสาขา: ${selectedBranch?.name} (สร้างบิลวันที่ ${billSettings.bill_generation_day})`,
        duration: 5000,
      });
      setJustSavedBillSettings(true);
      setTimeout(() => setJustSavedBillSettings(false), 3000);
    } catch (error) {
      console.error('Bill settings save error:', error);
      toast.error('บันทึกการตั้งค่าบิลไม่สำเร็จ: ' + (error.message || 'กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setIsSavingBillSettings(false);
    }
  };

  const handleBankInfoSubmit = async (e) => {
    e.preventDefault();
    setIsSavingBankInfo(true);
    try {
      await Promise.all([
        updateConfigMutation.mutateAsync({ key: 'bank_account_name', value: bankInfo.account_name, description: 'ชื่อบัญชีธนาคาร', category: 'general', applyToAllBranches: applyToAllBranches_bank }),
        updateConfigMutation.mutateAsync({ key: 'bank_account_number', value: bankInfo.account_number, description: 'เลขที่บัญชี', category: 'general', applyToAllBranches: applyToAllBranches_bank }),
        updateConfigMutation.mutateAsync({ key: 'bank_name', value: bankInfo.bank_name, description: 'ชื่อธนาคาร', category: 'general', applyToAllBranches: applyToAllBranches_bank }),
        updateConfigMutation.mutateAsync({ key: 'promptpay', value: bankInfo.promptpay, description: 'พร้อมเพย์', category: 'general', applyToAllBranches: applyToAllBranches_bank })
      ]);
      toast.success('บันทึกข้อมูลบัญชีธนาคารสำเร็จ' + (applyToAllBranches_bank ? ' (ทุกสาขาที่คุณดูแล)' : ` (${selectedBranch?.name})`));
    } catch (error) {
      console.error('Bank info save error:', error);
      toast.error('บันทึกข้อมูลธนาคารไม่สำเร็จ: ' + (error.message || 'กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setIsSavingBankInfo(false);
    }
  };

  const handleLineSettingsSubmit = async (e) => {
    e.preventDefault();
    
    if (!lineSettings.line_channel_access_token || !lineSettings.line_channel_access_token.trim()) {
      toast.error('กรุณากรอก LINE Channel Access Token');
      return;
    }
    
    setIsSavingLineSettings(true);
    
    const userAccessibleBranches = currentUser?.accessible_branches || [];
    let targetBranchIds;
    
    if (applyToAllBranches_line) {
      if (userAccessibleBranches.length > 0) {
        targetBranchIds = userAccessibleBranches;
      } else {
        // กรณีเป็น Owner/Developer ที่เข้าถึงได้ทุกสาขา (ไม่มี list จำกัด)
        // ให้บันทึกใส่ทุกสาขาที่มีในระบบ
        targetBranchIds = branches.map(b => b.id);
      }
    } else {
      targetBranchIds = [selectedBranch?.id].filter(Boolean);
    }
    
    addDebugLog('🚀 เริ่มบันทึก LINE Settings', 'info');
    addDebugLog(`📝 Token: ${lineSettings.line_channel_access_token.substring(0, 40)}...`);
    addDebugLog(`📝 Toggle: ${applyToAllBranches_line ? '✅ ทุกสาขา' : '❌ เฉพาะสาขา ' + selectedBranch?.name}`);
    addDebugLog(`📝 Target: ${targetBranchIds.length} สาขา`);
    
    console.log('');
    console.log('🚀 ============= เริ่มบันทึก LINE Settings =============');
    console.log('📝 ข้อมูลที่กำลังจะบันทึก:');
    console.log('   - Token:', lineSettings.line_channel_access_token.substring(0, 40) + '...');
    console.log('   - Secret:', lineSettings.line_channel_secret ? lineSettings.line_channel_secret.substring(0, 40) + '...' : '(ไม่มี)');
    console.log('   - Toggle ทุกสาขา:', applyToAllBranches_line ? '✅ เปิด' : '❌ ปิด');
    console.log('   - สาขาที่เลือก:', selectedBranch);
    console.log('   - User accessible branches:', userAccessibleBranches);
    console.log('   - Target branch IDs (จะบันทึกไปที่):', targetBranchIds);
    console.log('');
    
    if (targetBranchIds.length === 0) {
      console.error('❌ ERROR: ไม่มี targetBranchIds - ไม่สามารถบันทึกได้');
      addDebugLog('❌ ERROR: ไม่มีสาขาที่จะบันทึก', 'error');
      toast.error('ไม่พบสาขาที่จะบันทึก - กรุณาเลือกสาขาก่อน');
      setIsSavingLineSettings(false);
      return;
    }
    
    // Validation
    if (!lineSettings.line_channel_access_token.trim()) {
      toast.error('กรุณากรอก LINE Channel Access Token');
      setIsSavingLineSettings(false);
      return;
    }
    
    try {
      // ✅ Bulk save using Promise.all (แก้ N+1 Query Problem)
      const savePromises = targetBranchIds.map(async (branchId) => {
        const branchName = branches.find(b => b.id === branchId)?.branch_name || 'ไม่พบชื่อ';
        
        // Token
        const existingTokenConfig = configs.find(c => 
          c.key === 'line_channel_access_token' && c.branch_id === branchId
        );
        
        const tokenPromise = existingTokenConfig
          ? base44.entities.Config.update(existingTokenConfig.id, {
              value: lineSettings.line_channel_access_token.trim()
            })
          : base44.entities.Config.create({
              key: 'line_channel_access_token',
              value: lineSettings.line_channel_access_token.trim(),
              branch_id: branchId,
              category: 'notification',
              description: `LINE Token สำหรับสาขา ${branchName}`
            });

        // Secret
        let secretPromise = Promise.resolve();
        if (lineSettings.line_channel_secret?.trim()) {
          const existingSecretConfig = configs.find(c => 
            c.key === 'line_channel_secret' && c.branch_id === branchId
          );
          
          secretPromise = existingSecretConfig
            ? base44.entities.Config.update(existingSecretConfig.id, {
                value: lineSettings.line_channel_secret.trim()
              })
            : base44.entities.Config.create({
                key: 'line_channel_secret',
                value: lineSettings.line_channel_secret.trim(),
                branch_id: branchId,
                category: 'notification',
                description: `LINE Secret สำหรับสาขา ${branchName}`
              });
        }

        await Promise.all([tokenPromise, secretPromise]);
        return { branchId, branchName, tokenSaved: true };
      });
      
      const savedResults = await Promise.all(savePromises)
      
      addDebugLog('✅ บันทึกเสร็จทั้งหมด', 'success');
      savedResults.forEach((result, idx) => {
        addDebugLog(`   ${idx + 1}. ${result.branchName} - ✅ สำเร็จ`);
      });
      
      console.log('');
      console.log('✅ ============= บันทึกเสร็จทั้งหมด =============');
      console.log('📊 สรุปผลลัพธ์:');
      savedResults.forEach((result, idx) => {
        console.log(`   ${idx + 1}. ${result.branchName} (ID: ${result.branchId.substring(0, 12)}...) - ✅ บันทึกสำเร็จ`);
      });
      console.log('');
      console.log('🔄 กำลัง invalidate queries เพื่อ refresh ข้อมูล...');
      
      addDebugLog('🔄 กำลัง refresh ข้อมูล...');
      
      // รอให้ query invalidate เสร็จก่อน
      await queryClient.invalidateQueries(['configs']);
      
      console.log('✅ Invalidate queries เสร็จแล้ว');
      console.log('🔄 ระบบจะ reload ข้อมูล configs ใหม่อัตโนมัติ...');
      console.log('');
      
      addDebugLog('✅ Refresh ข้อมูลเสร็จแล้ว', 'success');
      addDebugLog('');
      addDebugLog('🔍 ===== ตรวจสอบหลังบันทึก =====', 'info');
      
      // รอ 1 วินาทีให้ query โหลดเสร็จ
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // ดึงข้อมูล configs ล่าสุดอีกครั้ง
      const latestConfigs = await base44.entities.Config.list();
      const verifyResults = [];
      
      for (const branchId of targetBranchIds) {
        const branchName = branches.find(b => b.id === branchId)?.branch_name || 'ไม่พบชื่อ';
        const savedConfig = latestConfigs.find(c => 
          c.key === 'line_channel_access_token' && c.branch_id === branchId
        );
        
        if (savedConfig) {
          const tokenMatch = savedConfig.value === lineSettings.line_channel_access_token.trim();
          addDebugLog(`   ${tokenMatch ? '✅' : '❌'} ${branchName}: ${tokenMatch ? 'Token ตรงกัน' : 'Token ไม่ตรงกัน!'}`, tokenMatch ? 'success' : 'error');
          verifyResults.push({ branchName, verified: tokenMatch, configId: savedConfig.id });
          
          if (!tokenMatch) {
            addDebugLog(`      บันทึก: ${lineSettings.line_channel_access_token.substring(0, 20)}...`, 'error');
            addDebugLog(`      DB มี: ${savedConfig.value.substring(0, 20)}...`, 'error');
          }
        } else {
          addDebugLog(`   ❌ ${branchName}: ไม่พบ Config ใน Database!`, 'error');
          verifyResults.push({ branchName, verified: false, configId: null });
        }
      }
      
      const allVerified = verifyResults.every(r => r.verified);
      addDebugLog('');
      if (allVerified) {
        addDebugLog('🎉 ตรวจสอบแล้ว: บันทึกสำเร็จทุกสาขา', 'success');
      } else {
        addDebugLog('⚠️ พบปัญหา: บางสาขาบันทึกไม่สำเร็จ', 'error');
        addDebugLog('📌 แนะนำ: ลอง Refresh หน้า (F5) แล้วเช็คว่า Token ยังอยู่หรือไม่', 'info');
      }
      
      const branchCount = targetBranchIds.length;
      toast.success(`บันทึก LINE Token สำเร็จ - ${branchCount} สาขา`, {
        description: savedResults.map(r => `✅ ${r.branchName}`).join('\n')
      });
    } catch (error) {
      addDebugLog('❌ เกิดข้อผิดพลาด: ' + (error?.message || 'Unknown'), 'error');
      
      console.error('');
      console.error('❌ ============= เกิดข้อผิดพลาด =============');
      console.error('Error:', error);
      console.error('Error message:', error?.message);
      console.error('Error response:', error?.response?.data);
      console.error('');
      toast.error('ไม่สามารถบันทึกได้: ' + (error?.message || 'กรุณาลองใหม่'));
    } finally {
      setIsSavingLineSettings(false);
    }
  };

  // NEW: Handler for saving new notification settings
  const handleSaveNotificationSettings = () => {
    saveNotificationSettingsMutation.mutate(notificationSettings);
  };


  const handleMeterSettingsSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateConfigMutation.mutateAsync({
        key: 'allow_meter_history_editing',
        value: meterSettings.allow_editing_history ? 'true' : 'false',
        description: 'อนุญาตให้แก้ไขประวัติมิเตอร์ย้อนหลัง',
        category: 'billing',
        value_type: 'string',
        applyToAllBranches: applyToAllBranches_meter
      });
      toast.success('บันทึกการตั้งค่ามิเตอร์สำเร็จ' + (applyToAllBranches_meter ? ' (ทุกสาขาที่คุณดูแล)' : ` (${selectedBranch?.name})`));
    } catch (error) {
      toast.error('บันทึกไม่สำเร็จ: ' + error.message);
    }
  };

  const handleFacebookSettingsSubmit = async (e) => {
    e.preventDefault();
    setIsSavingFacebookSettings(true);

    const userAccessibleBranches = currentUser?.accessible_branches || [];
    let targetBranchIds;
    
    if (applyToAllBranches_facebook) {
      if (userAccessibleBranches.length > 0) {
        targetBranchIds = userAccessibleBranches;
      } else {
        targetBranchIds = branches.map(b => b.id);
      }
    } else {
      targetBranchIds = [selectedBranch?.id].filter(Boolean);
    }

    try {
      for (const branchId of targetBranchIds) {
        // Update Page Access Token
        const existingToken = configs.find(c => c.key === 'facebook_page_access_token' && c.branch_id === branchId);
        if (existingToken) {
          await base44.entities.Config.update(existingToken.id, { value: facebookSettings.facebook_page_access_token.trim() });
        } else {
          await base44.entities.Config.create({
            key: 'facebook_page_access_token',
            value: facebookSettings.facebook_page_access_token.trim(),
            branch_id: branchId,
            category: 'notification',
            description: 'Facebook Page Access Token'
          });
        }

        // Update Verify Token
        const existingVerify = configs.find(c => c.key === 'facebook_verify_token' && c.branch_id === branchId);
        if (existingVerify) {
          await base44.entities.Config.update(existingVerify.id, { value: facebookSettings.facebook_verify_token.trim() });
        } else {
          await base44.entities.Config.create({
            key: 'facebook_verify_token',
            value: facebookSettings.facebook_verify_token.trim(),
            branch_id: branchId,
            category: 'notification',
            description: 'Facebook Webhook Verify Token'
          });
        }
      }
      
      await queryClient.invalidateQueries(['configs']);
      toast.success('บันทึกการตั้งค่า Facebook สำเร็จ');
    } catch (error) {
      toast.error('บันทึกไม่สำเร็จ: ' + error.message);
    } finally {
      setIsSavingFacebookSettings(false);
    }
  };

  const toggleCategory = (categoryKey) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryKey]: !prev[categoryKey]
    }));
  };

  const togglePermission = (userId, permissionId) => {
    setUserPermissions(prev => {
      const currentPermissions = prev[userId] || [];
      const hasPermission = currentPermissions.includes(permissionId);

      const newPermissions = hasPermission
        ? currentPermissions.filter(p => p !== permissionId)
        : [...currentPermissions, permissionId];

      return {
        ...prev,
        [userId]: newPermissions
      };
    });
  };

  const selectAllInCategory = (userId, categoryKey) => {
    // Use PERMISSION_CATEGORIES_DISPLAY here
    const categoryPermissions = PERMISSION_CATEGORIES_DISPLAY[categoryKey].permissions.map(p => p.id);
    setUserPermissions(prev => {
      const currentPermissions = prev[userId] || [];
      const allSelected = categoryPermissions.every(p => currentPermissions.includes(p));

      let newPermissions;
      if (allSelected) {
        newPermissions = currentPermissions.filter(p => !categoryPermissions.includes(p));
      } else {
        const uniquePermissions = new Set([...currentPermissions, ...categoryPermissions]);
        newPermissions = Array.from(uniquePermissions);
      }

      return {
        ...prev,
        [userId]: newPermissions
      };
    });
  };

  const handleSaveUserPermissions = (userId) => {
    updateUserPermissionsMutation.mutate({
      userId,
      permissions: userPermissions[userId] || []
    });
  };

  const handleOpenPermissionsDialog = (user) => {
    setSelectedUserForPermissions(user);
    setShowPermissionsDialog(true);
    setExpandedCategories({});

    // โหลดสิทธิ์เริ่มต้นถ้ายังไม่มีสิทธิ์
    const currentPermissions = user.permissions || [];
    if (currentPermissions.length === 0) {
      const role = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
      const defaultPerms = DEFAULT_PERMISSIONS_MAP[role] || [];

      setUserPermissions(prev => ({
        ...prev,
        [user.id]: defaultPerms
      }));

      toast.info(`โหลดสิทธิ์เริ่มต้นสำหรับ ${role === 'owner' ? 'เจ้าของหอพัก' : role === 'manager' ? 'ผู้จัดการ' : 'พนักงาน'}`);
    }
  };

  const handleRoleChange = (userId, newRole) => {
    const defaultPerms = DEFAULT_PERMISSIONS_MAP[newRole] || [];

    // Update both role and permissions
    updateUserRoleMutation.mutate({
      userId,
      custom_role: newRole,
      permissions: defaultPerms
    });

    // Update local state
    setUserPermissions(prev => ({
      ...prev,
      [userId]: defaultPerms
    }));

    const roleLabels = {
      owner: 'เจ้าของหอพัก',
      manager: 'ผู้จัดการ',
      employee: 'พนักงาน'
    };

    toast.success(`เปลี่ยนเป็นบทบาท "${roleLabels[newRole]}" และโหลดสิทธิ์เริ่มต้นแล้ว`);
  };

  const getRoleBadge = (role) => {
    const badges = {
      developer: { label: '👨‍💻 Developer', color: 'from-purple-500 to-pink-500' },
      owner: { label: '👑 เจ้าของหอพัก', color: 'from-blue-500 to-indigo-500' },
      manager: { label: '👔 ผู้จัดการ', color: 'from-green-500 to-emerald-500' },
      employee: { label: '👤 พนักงาน', color: 'from-slate-400 to-slate-500' }
    };
    return badges[role] || badges.employee;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <PageHeader
        title="ตั้งค่าระบบ"
        subtitle="ปรับแต่งการทำงานของระบบ"
        icon={SettingsIcon}
        showBackButton={true}
        actions={
          <>
            <Button
              onClick={() => navigate(createPageUrl('SupportTickets'))}
              variant="outline"
              className="border-red-600 text-red-600 hover:bg-red-50"
            >
              <AlertCircle className="w-4 h-4 md:mr-2" />
              <span className="hidden md:inline">รายงานปัญหา</span>
            </Button>
            {canManagePermissions && (() => {
              // ⭐ เช็ค trial mode จาก currentUser.plan_status
              const isTrialMode = currentUser?.plan_status === 'trial';

              return !isTrialMode && (
                <Button
                  onClick={() => setShowAddEmployeeDialog(true)}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  <UserPlus className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">เพิ่มพนักงาน</span>
                </Button>
              );
            })()}
          </>
        }
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-6xl mx-auto">
          <Card className="bg-white/80 backdrop-blur-xl shadow-2xl border-white/60">
            <CardContent className="p-6">
              <div className="flex gap-2 mb-6 border-b overflow-x-auto">
                <Button variant={activeTab === 'package' ? 'default' : 'ghost'} onClick={() => setActiveTab('package')} className={activeTab === 'package' ? 'bg-blue-600' : ''}>
                  <Crown className="w-4 h-4 mr-2" />
                  แพ็กเกจ
                </Button>
                <Button variant={activeTab === 'building' ? 'default' : 'ghost'} onClick={() => setActiveTab('building')} className={activeTab === 'building' ? 'bg-blue-600' : ''}>อาคาร</Button>
                <Button variant={activeTab === 'billing' ? 'default' : 'ghost'} onClick={() => setActiveTab('billing')} className={activeTab === 'billing' ? 'bg-blue-600' : ''}>อัตรา</Button>
                <Button variant={activeTab === 'bill_notifications' ? 'default' : 'ghost'} onClick={() => setActiveTab('bill_notifications')} className={activeTab === 'bill_notifications' ? 'bg-blue-600' : ''}>บิล</Button>
                <Button variant={activeTab === 'notifications' ? 'default' : 'ghost'} onClick={() => setActiveTab('notifications')} className={activeTab === 'notifications' ? 'bg-blue-600' : ''}>การแจ้งเตือน</Button>
                <Button variant={activeTab === 'bank' ? 'default' : 'ghost'} onClick={() => setActiveTab('bank')} className={activeTab === 'bank' ? 'bg-blue-600' : ''}>ธนาคาร</Button>
                <Button variant={activeTab === 'messaging' ? 'default' : 'ghost'} onClick={() => setActiveTab('messaging')} className={activeTab === 'messaging' ? 'bg-blue-600' : ''}>
                  <MessageSquare className="w-4 h-4 mr-1" />
                  ช่องทางสื่อสาร
                </Button>
                <Button variant={activeTab === 'signature' ? 'default' : 'ghost'} onClick={() => setActiveTab('signature')} className={activeTab === 'signature' ? 'bg-blue-600' : ''}>ลายเซ็น</Button>
                {canManagePermissions && (
                  <Button variant={activeTab === 'permissions' ? 'default' : 'ghost'} onClick={() => setActiveTab('permissions')} className={activeTab === 'permissions' ? 'bg-blue-600' : ''}>สิทธิ์</Button>
                )}
              </div>



              {activeTab === 'package' && (
                <div className="space-y-6">
                  {activeSubscription ? (
                    <>
                      {/* ข้อมูลการใช้งาน Package */}
                      {(() => {
                        const pkgNameCheck = activeSubscription?.package_name || activeSubscription?.app_name || '';
                        const isBasicPkg = pkgNameCheck.toLowerCase().includes('basic') || pkgNameCheck.toLowerCase().includes('nano');
                        const isProPkg = pkgNameCheck.toLowerCase().includes('pro') || pkgNameCheck.toLowerCase().includes('micro');
                        const isElitePkg = !isBasicPkg && !isProPkg;
                        
                        return (
                      <div className="relative max-w-sm group">
                        <div className={`absolute inset-0 rounded-[1.5rem] blur-xl opacity-80 group-hover:opacity-100 transition-opacity ${
                          isElitePkg ? 'bg-gradient-to-br from-amber-200/60 via-yellow-200/60 to-orange-200/60' :
                          isProPkg ? 'bg-gradient-to-br from-blue-200/60 via-purple-200/60 to-pink-200/60' :
                          'bg-gradient-to-br from-slate-200/60 via-slate-300/60 to-slate-200/60'
                        }`} />
                        <Card className="relative bg-gradient-to-br from-stone-50 to-amber-50/50 backdrop-blur-xl border-0 shadow-xl rounded-[1.5rem] overflow-hidden">
                          <CardContent className="p-0">
                            {(() => {
                              const pkgName = activeSubscription?.package_name || activeSubscription?.app_name || '';
                              const isTrial = activeSubscription?.status === 'trial' || activeSubscription?.package_id === 'trial';
                              const isBasic = !isTrial && (pkgName.toLowerCase().includes('basic') || pkgName.toLowerCase().includes('nano'));
                              const isPro = !isTrial && (pkgName.toLowerCase().includes('pro') || pkgName.toLowerCase().includes('micro'));
                              const isElite = !isTrial && !isBasic && !isPro;

                              const pkgIcon = isTrial ? Package : isBasic ? SettingsIcon : isPro ? Sparkles : Crown;

                              return (
                                <>
                                  {/* Header with shimmer effect */}
                                  <div className="relative overflow-hidden">
                                    <div className={`relative p-5 ${
                                      isTrial
                                        ? 'bg-gradient-to-br from-amber-400 via-orange-300 to-amber-400'
                                        : isBasic
                                        ? 'bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950'
                                        : isPro
                                        ? 'bg-gradient-to-br from-blue-300 via-indigo-200 to-purple-200'
                                        : 'bg-gradient-to-br from-amber-300 via-yellow-200 to-orange-200'
                                    }`}>
                                      {/* Shimmer overlay - only for Pro and Elite (not Trial) */}
                                      {!isTrial && (isPro || isElite) && (
                                        <>
                                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full animate-[shimmer_3s_infinite]" 
                                            style={{ animation: 'shimmer 3s infinite' }} />
                                          <style>{`
                                            @keyframes shimmer {
                                              0% { transform: translateX(-100%); }
                                              100% { transform: translateX(100%); }
                                            }
                                          `}</style>
                                        </>
                                      )}
                                      
                                      <div className="relative z-10 flex items-start justify-between mb-4">
                                        <Badge className={`text-xs px-3 py-1 rounded-full font-semibold shadow-lg ${
                                          isTrial
                                            ? 'bg-gradient-to-r from-amber-600 to-orange-500 text-white'
                                            : isBasic 
                                            ? 'bg-gradient-to-r from-slate-500 to-slate-600 text-white' 
                                            : isPro 
                                            ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                                            : 'bg-gradient-to-r from-amber-600 to-yellow-500 text-white'
                                        }`}>
                                          {isTrial ? '🎉 Trial' : isBasic ? 'Basic' : isPro ? 'Pro' : 'Elite'}
                                        </Badge>
                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-lg ${
                                          isTrial ? 'bg-white/50' : isBasic ? 'bg-slate-700/60' : isPro ? 'bg-white/40' : 'bg-white/50'
                                        }`}>
                                          {React.createElement(pkgIcon, { 
                                            className: `w-6 h-6 ${isTrial ? 'text-amber-700' : isBasic ? 'text-blue-400' : isPro ? 'text-blue-600' : 'text-amber-700'}` 
                                          })}
                                        </div>
                                      </div>
                                      
                                      <h3 className={`relative z-10 text-xl font-bold mb-1 ${
                                        isTrial ? 'text-white' : isBasic ? 'text-white' : isElite ? 'text-amber-900' : 'text-slate-900'
                                      }`}>
                                        {isTrial ? '🎉 ทดลองใช้งาน' : activeSubscription?.package_name || activeSubscription?.app_name || 'แพ็กเกจระบบจัดการหอพัก'}
                                      </h3>
                                      
                                      {activeSubscription?.subscription_end_date && (
                                        <p className={`relative z-10 text-xs ${
                                          isTrial ? 'text-white/90' : isBasic ? 'text-slate-300' : isElite ? 'text-amber-800' : 'text-slate-600'
                                        }`}>
                                          หมดอายุ {format(parseISO(activeSubscription.subscription_end_date), 'd MMM yyyy', { locale: th })}
                                          {daysRemaining !== null && (
                                            <span className={`ml-1 font-bold ${
                                              isTrial ? (daysRemaining < 7 ? 'text-red-200' : daysRemaining < 30 ? 'text-yellow-200' : 'text-white') :
                                              isBasic ? (daysRemaining < 7 ? 'text-red-400' : daysRemaining < 30 ? 'text-yellow-400' : 'text-green-400') :
                                              daysRemaining < 7 ? 'text-red-600' : daysRemaining < 30 ? 'text-amber-600' : 'text-green-600'
                                            }`}>
                                              (เหลือ {daysRemaining} วัน)
                                            </span>
                                          )}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="p-5 bg-gradient-to-b from-stone-50 to-white">
                                    <Button
                                      onClick={() => navigate(createPageUrl('PackageSelection'))}
                                      className={`w-full py-3 text-sm font-semibold rounded-xl shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] ${
                                        isTrial
                                          ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600'
                                          : isBasic
                                          ? 'bg-gradient-to-r from-slate-800 to-slate-900 text-white hover:from-slate-700 hover:to-slate-800'
                                          : isPro
                                          ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white hover:from-blue-600 hover:to-purple-600'
                                          : 'bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 text-white hover:from-amber-600 hover:via-yellow-600 hover:to-amber-600'
                                      }`}
                                    >
                                      <RefreshCw className="w-4 h-4 mr-2" />
                                      {activeSubscription.status === 'trial' ? 'อัปเกรดแพ็กเกจ' : 'ต่ออายุ/อัปเกรด'}
                                    </Button>
                                  </div>
                                </>
                              );
                            })()}
                          </CardContent>
                        </Card>
                      </div>
                        );
                      })()}

                      {/* การใช้งานผู้ใช้และสาขา */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card className="bg-white border-slate-200 shadow-lg">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <Users className="w-5 h-5 text-blue-600" />
                              ผู้ใช้งาน
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {(() => {
                              // ⭐ แสดงผู้ใช้ที่เข้าถึงสาขาเดียวกันกับ currentUser (branches ที่ query มากรองแล้ว)
                              const myAccessibleBranchIds = branches.map(b => b.id);
                              
                              const usersInMyBranches = users.filter(user => {
                                const role = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
                                
                                // ไม่นับ Developer
                                if (role === 'developer') return false;
                                
                                // ⭐ ถ้าเป็น currentUser เอง = นับ
                                if (user.email === currentUser?.email) return true;
                                
                                // ผู้ใช้อื่นๆ ต้องมี accessible_branches ที่ตรงกับสาขาที่ currentUser เข้าถึงได้
                                if (!user.accessible_branches || user.accessible_branches.length === 0) return false;
                                return user.accessible_branches.some(branchId => myAccessibleBranchIds.includes(branchId));
                              });

                              // นับจำนวนผู้ใช้เฉพาะในสาขาของเรา
                              const totalUsersInMyBranches = usersInMyBranches.length;
                              
                              // ⭐ เช็ค trial mode จาก currentUser.plan_status
                              const isTrialMode = currentUser?.plan_status === 'trial';
                              
                              // ดึง max_users จาก crmPackageInfo หรือใช้ 1 ถ้าเป็น trial
                              const maxUsers = isTrialMode ? 1 : crmPackageInfo?.max_users;
                              const hasLimit = maxUsers !== null && maxUsers !== undefined && maxUsers > 0;
                              const usagePercent = hasLimit ? Math.min((totalUsersInMyBranches / maxUsers) * 100, 100) : 10;

                              return (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">ผู้ใช้งานทั้งหมด</span>
                                    <span className="text-2xl font-bold text-blue-600">
                                      {totalUsersInMyBranches} {hasLimit && `/ ${maxUsers}`}
                                    </span>
                                  </div>
                                  <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all"
                                      style={{ width: `${usagePercent}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    {isTrialMode ? `จำกัด ${maxUsers} ผู้ใช้ในโหมดทดลอง` : !hasLimit ? 'ไม่จำกัดจำนวนผู้ใช้' : `เหลือ ${Math.max(0, maxUsers - totalUsersInMyBranches)} ที่นั่ง`}
                                  </p>

                                  {usersInMyBranches.length > 0 && (
                                    <div className="pt-3 border-t border-slate-200 space-y-1">
                                      <p className="text-xs font-semibold text-slate-700 mb-2">รายชื่อผู้ใช้ในสาขา:</p>
                                      {usersInMyBranches.slice(0, 5).map(user => (
                                        <div key={user.id} className="text-xs text-slate-600 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                          {user.full_name || user.email}
                                        </div>
                                      ))}
                                      {usersInMyBranches.length > 5 && (
                                        <p className="text-xs text-slate-500 italic">และอีก {usersInMyBranches.length - 5} คน</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </CardContent>
                        </Card>

                        <Card className="bg-white border-slate-200 shadow-lg">
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                              <Building2 className="w-5 h-5 text-purple-600" />
                              สาขา
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            {(() => {
                              // ⭐ แสดงสาขาที่ currentUser เข้าถึงได้ทั้งหมด (branches ที่ query มากรองแล้ว)
                              const totalBranchesInSystem = branches.length;
                              
                              // ⭐ เช็ค trial mode จาก currentUser.plan_status
                              const isTrialMode = currentUser?.plan_status === 'trial';
                              
                              // ดึง max_branches จาก crmPackageInfo หรือใช้ 1 ถ้าเป็น trial
                              const maxBranches = isTrialMode ? 1 : crmPackageInfo?.max_branches;
                              const hasLimit = maxBranches !== null && maxBranches !== undefined && maxBranches > 0;
                              const usagePercent = hasLimit ? Math.min((totalBranchesInSystem / maxBranches) * 100, 100) : 10;

                              return (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-slate-600">สาขาที่ดูแลทั้งหมด</span>
                                    <span className="text-2xl font-bold text-purple-600">
                                      {totalBranchesInSystem} {hasLimit && `/ ${maxBranches}`}
                                    </span>
                                  </div>
                                  <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                                      style={{ width: `${usagePercent}%` }}
                                    />
                                  </div>
                                  <p className="text-xs text-slate-500">
                                    {isTrialMode ? `จำกัด ${maxBranches} สาขาในโหมดทดลอง` : !hasLimit ? 'ไม่จำกัดจำนวนสาขา' : `สร้างได้อีก ${Math.max(0, maxBranches - totalBranchesInSystem)} สาขา`}
                                  </p>

                                  {branches.length > 0 && (
                                    <div className="pt-3 border-t border-slate-200 space-y-1">
                                      <p className="text-xs font-semibold text-slate-700 mb-2">สาขาที่เข้าถึงได้:</p>
                                      {branches.map(branch => (
                                        <div key={branch.id} className="text-xs text-slate-600 flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                                          {branch.branch_name}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </CardContent>
                        </Card>
                      </div>




                    </>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.4 }}
                    >
                      <div className="relative">
                        {/* Decorative Background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 via-orange-400/20 to-red-400/20 rounded-3xl blur-3xl animate-pulse" />
                        
                        <Card className="relative bg-gradient-to-br from-white via-amber-50/30 to-orange-50/30 backdrop-blur-xl border-0 shadow-2xl rounded-3xl overflow-hidden">
                          <CardContent className="p-12 text-center">
                            {/* Animated Icon */}
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                              className="relative inline-block mb-8"
                            >
                              <div className="absolute inset-0 bg-gradient-to-br from-amber-500/30 to-orange-500/30 rounded-full blur-2xl animate-pulse" />
                              <div className="relative w-24 h-24 bg-gradient-to-br from-amber-500 to-orange-500 rounded-full flex items-center justify-center shadow-2xl">
                                <Crown className="w-12 h-12 text-white" />
                              </div>
                            </motion.div>

                            {/* Content */}
                            <h3 className="text-3xl font-bold text-slate-800 mb-4">ยังไม่มีแพ็กเกจในระบบ</h3>
                            <p className="text-slate-600 text-lg mb-8 max-w-lg mx-auto leading-relaxed">
                              เริ่มต้นใช้งานระบบจัดการหอพักอัจฉริยะ<br/>
                              เลือกแพ็กเกจที่เหมาะสมกับธุรกิจของคุณ
                            </p>

                            {/* Action Button */}
                            <Button
                              onClick={() => navigate(createPageUrl('PackageSelection'))}
                              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-10 py-7 text-lg font-bold rounded-2xl shadow-xl hover:shadow-2xl transition-all hover:scale-105 active:scale-95"
                            >
                              <Crown className="w-6 h-6 mr-3" />
                              เลือกแพ็กเกจที่เหมาะกับคุณ
                            </Button>
                          </CardContent>
                        </Card>
                      </div>
                    </motion.div>
                  )}
                </div>
              )}

              {activeTab === 'building' && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      ข้อมูลหอพักและผู้มีอำนาจลงนาม
                    </CardTitle>
                    <p className="text-sm text-slate-600 mt-2">
                      ข้อมูลนี้จะถูกใช้ในสัญญาเช่าและเอกสารต่างๆ
                    </p>
                  </CardHeader>
                  <CardContent>
                    <BranchToggle
                      applyToAllBranches={applyToAllBranches_building}
                      setApplyToAllBranches={setApplyToAllBranches_building}
                      selectedBranch={selectedBranch}
                      canSetGlobalConfig={canSetGlobalConfig}
                    />

                    <form onSubmit={handleBuildingInfoSubmit} className="space-y-6">
                      {/* โลโก้หอพัก */}
                      <div className="space-y-4 pb-6 border-b">
                        <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2">
                          <ImageIcon className="w-5 h-5 text-indigo-600" />
                          โลโก้หอพัก
                        </h3>

                        {buildingLogo ? (
                          <div className="space-y-3">
                            <div className="bg-slate-50 rounded-lg p-6 border-2 border-slate-200 flex items-center justify-center">
                              <img
                                src={buildingLogo}
                                alt="โลโก้หอพัก"
                                className="max-h-32 max-w-full object-contain"
                              />
                            </div>
                            <div className="flex gap-2">
                              <label className="flex-1 cursor-pointer">
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleLogoUpload}
                                  className="hidden"
                                />
                                <div className="flex items-center justify-center gap-2 w-full px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">
                                  {uploadingLogo ? (
                                    <>
                                      <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                                      <span className="text-sm font-medium">กำลังอัพโหลด...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-4 h-4" />
                                      <span className="text-sm font-medium">เปลี่ยนโลโก้</span>
                                    </>
                                  )}
                                </div>
                              </label>
                              <Button
                                type="button"
                                onClick={async () => {
                                  if (confirm('คุณแน่ใจว่าต้องการลบโลโก้?')) {
                                    await updateConfigMutation.mutateAsync({
                                      key: 'building_logo',
                                      value: '',
                                      description: 'โลโก้หอพัก',
                                      category: 'general',
                                      applyToAllBranches: applyToAllBranches_building
                                    });
                                    setBuildingLogo('');
                                    toast.success('ลบโลโก้สำเร็จ' + (applyToAllBranches_building ? ' (ทุกสาขาที่คุณดูแล)' : ` (${selectedBranch?.name})`));
                                  }
                                }}
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <X className="w-4 h-4 mr-2" />
                                ลบ
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <label className="block cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleLogoUpload}
                              className="hidden"
                            />
                            <div className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                              {uploadingLogo ? (
                                <div className="text-center">
                                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                  <p className="text-sm text-slate-600">กำลังอัพโหลด...</p>
                                </div>
                              ) : (
                                <div className="text-center">
                                  <Upload className="w-8 h-8 mx-auto mb-2 text-slate-400" />
                                  <p className="text-sm font-medium text-slate-700">คลิกเพื่ออัพโหลดโลโก้</p>
                                  <p className="text-xs text-slate-500 mt-1">PNG, JPG, GIF (ไม่เกิน 5MB)</p>
                                </div>
                              )}
                            </div>
                          </label>
                        )}
                      </div>

                      {/* ข้อมูลหอพัก */}
                      <div className="space-y-4">
                        <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2 border-b pb-2">
                          <Building2 className="w-5 h-5 text-blue-600" />
                          ข้อมูลหอพัก
                        </h3>
                        <div>
                          <Label>ชื่อหอพัก *</Label>
                          <Input
                            value={buildingInfo.building_name}
                            onChange={(e) => setBuildingInfo({ ...buildingInfo, building_name: e.target.value })}
                            placeholder="เช่น W RESIDENTS"
                            required
                          />
                        </div>
                        <div>
                          <Label>ที่อยู่ *</Label>
                          <Input
                            value={buildingInfo.address}
                            onChange={(e) => setBuildingInfo({ ...buildingInfo, address: e.target.value })}
                            placeholder="ที่อยู่เต็มของหอพัก"
                            required
                          />
                        </div>
                        <div>
                          <Label>เบอร์โทรติดต่อ *</Label>
                          <Input
                            value={buildingInfo.phone}
                            onChange={(e) => setBuildingInfo({ ...buildingInfo, phone: e.target.value })}
                            placeholder="0812345678"
                            required
                          />
                        </div>
                      </div>

                      {/* ข้อมูลผู้มีอำนาจลงนาม */}
                      <div className="space-y-4 pt-4 border-t">
                        <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2 border-b pb-2">
                          <Users className="w-5 h-5 text-purple-600" />
                          ข้อมูลผู้มีอำนาจลงนาม (ผู้ให้เช่า)
                        </h3>
                        <p className="text-sm text-slate-600">
                          ข้อมูลนี้จะแสดงในสัญญาเช่าฝ่ายผู้ให้เช่า
                        </p>
                        <div className="space-y-4">
                          <div>
                            <Label>ชื่อ-นามสกุล (ผู้ให้เช่า) *</Label>
                            <Input
                              value={lessorInfo.lessor_name}
                              onChange={(e) => setLessorInfo({ ...lessorInfo, lessor_name: e.target.value })}
                              placeholder="เช่น นายสมชาย ใจดี"
                              required
                            />
                          </div>
                          <div>
                            <Label>เลขบัตรประชาชน (13 หลัก)</Label>
                            <Input
                              value={lessorInfo.lessor_id}
                              onChange={(e) => setLessorInfo({ ...lessorInfo, lessor_id: e.target.value })}
                              placeholder="1234567890123"
                              maxLength={13}
                            />
                          </div>
                          <div>
                            <Label>เบอร์โทรศัพท์</Label>
                            <Input
                              value={lessorInfo.lessor_phone}
                              onChange={(e) => setLessorInfo({ ...lessorInfo, lessor_phone: e.target.value })}
                              placeholder="0812345678"
                            />
                          </div>
                          <div>
                            <Label>ที่อยู่ (ผู้ให้เช่า)</Label>
                            <Input
                              value={lessorInfo.lessor_address}
                              onChange={(e) => setLessorInfo({ ...lessorInfo, lessor_address: e.target.value })}
                              placeholder="ที่อยู่เต็มของผู้ให้เช่า"
                            />
                          </div>
                        </div>
                      </div>

                      {/* ข้อมูลบริษัท */}
                      <div className="space-y-4 pt-4 border-t">
                        <h3 className="text-md font-semibold text-slate-700 flex items-center gap-2 border-b pb-2">
                          <Building2 className="w-5 h-5 text-blue-600" />
                          ข้อมูลบริษัท (ถ้ามี)
                        </h3>
                        
                        <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                          <input
                            type="checkbox"
                            id="hasCompanyInfo"
                            checked={hasCompanyInfo}
                            onChange={(e) => setHasCompanyInfo(e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                          />
                          <label htmlFor="hasCompanyInfo" className="text-sm font-medium text-slate-700 cursor-pointer">
                            มีข้อมูลบริษัท/นิติบุคคล (สำหรับออกใบเสร็จอย่างเป็นทางการ)
                          </label>
                        </div>
                        
                        {hasCompanyInfo && (
                        <>
                        <p className="text-sm text-slate-600">
                          ข้อมูลนี้จะแสดงในใบเสร็จรับเงินและใบแจ้งหนี้
                        </p>
                        <div className="space-y-4 pl-4 border-l-2 border-blue-300">
                          <div>
                            <Label>ชื่อบริษัท / นิติบุคคล</Label>
                            <Input
                              value={companyInfo.company_name}
                              onChange={(e) => setCompanyInfo({ ...companyInfo, company_name: e.target.value })}
                              placeholder="เช่น บริษัท ABC จำกัด หรือ ร้าน XYZ"
                            />
                          </div>
                          
                          <div>
                            <Label>เลขทะเบียนนิติบุคคล</Label>
                            <Input
                              value={companyInfo.company_registration_number}
                              onChange={(e) => setCompanyInfo({ ...companyInfo, company_registration_number: e.target.value })}
                              placeholder="0123456789012"
                              maxLength={13}
                            />
                          </div>

                          <div>
                            <Label>เลขประจำตัวผู้เสียภาษี (Tax ID) *</Label>
                            <Input
                              value={companyInfo.company_tax_id}
                              onChange={(e) => setCompanyInfo({ ...companyInfo, company_tax_id: e.target.value })}
                              placeholder="0123456789012 (13 หลัก)"
                              maxLength={13}
                            />
                          </div>

                          <div>
                            <Label>เบอร์โทรศัพท์บริษัท</Label>
                            <Input
                              value={companyInfo.company_phone}
                              onChange={(e) => setCompanyInfo({ ...companyInfo, company_phone: e.target.value })}
                              placeholder="02-123-4567 หรือ 081-234-5678"
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={companyInfo.use_building_address}
                              onChange={(e) => setCompanyInfo({ ...companyInfo, use_building_address: e.target.checked })}
                              className="w-5 h-5 rounded"
                            />
                            <p className="text-sm font-medium text-blue-900">ใช้ที่อยู่เดียวกับหอพัก</p>
                          </label>

                          {!companyInfo.use_building_address && (
                            <div>
                              <Label>ที่อยู่บริษัท</Label>
                              <Input
                                value={companyInfo.company_address}
                                onChange={(e) => setCompanyInfo({ ...companyInfo, company_address: e.target.value })}
                                placeholder="ที่อยู่เต็มตามทะเบียนพาณิชย์"
                              />
                            </div>
                          )}

                          {companyInfo.use_building_address && buildingInfo.address && (
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                              <p className="text-xs text-green-800">
                                ✅ ที่อยู่บริษัท: <strong>{buildingInfo.address}</strong>
                              </p>
                            </div>
                          )}
                        </div>
                        </>
                        )}

                      </div>

                      <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-600" disabled={isSavingBuildingInfo}>
                        {isSavingBuildingInfo ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            กำลังบันทึก...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            บันทึกทั้งหมด
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'billing' && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-green-600" />
                      อัตราค่าใช้จ่าย
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BranchToggle
                      applyToAllBranches={applyToAllBranches_billing}
                      setApplyToAllBranches={setApplyToAllBranches_billing}
                      selectedBranch={selectedBranch}
                      canSetGlobalConfig={canSetGlobalConfig}
                    />

                    <form onSubmit={handleBillingRatesSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>ค่าน้ำต่อหน่วย (บาท) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={billingRates.water_rate}
                            onChange={(e) => setBillingRates({ ...billingRates, water_rate: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label>ค่าไฟต่อหน่วย (บาท) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={billingRates.electricity_rate}
                            onChange={(e) => setBillingRates({ ...billingRates, electricity_rate: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label>ค่าอินเทอร์เน็ต (บาท) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={billingRates.internet_fee}
                            onChange={(e) => setBillingRates({ ...billingRates, internet_fee: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label>ค่าส่วนกลาง (บาท)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={billingRates.common_fee}
                            onChange={(e) => setBillingRates({ ...billingRates, common_fee: e.target.value })}
                            placeholder="0 ถ้าไม่มี"
                          />
                        </div>
                        <div>
                          <Label>ค่าจอดรถยนต์ (บาท/คัน) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={billingRates.car_parking_fee}
                            onChange={(e) => setBillingRates({ ...billingRates, car_parking_fee: e.target.value })}
                            placeholder="ค่าจอดรถยนต์ต่อคัน"
                            required
                          />
                        </div>
                        <div>
                          <Label>ค่าจอดรถมอเตอร์ไซค์ (บาท/คัน) *</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={billingRates.motorcycle_parking_fee}
                            onChange={(e) => setBillingRates({ ...billingRates, motorcycle_parking_fee: e.target.value })}
                            placeholder="ค่าจอดมอเตอร์ไซค์ต่อคัน"
                            required
                          />
                        </div>
                      </div>

                      {/* ค่าขั้นต่ำสำหรับน้ำและไฟ */}
                      <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        ค่าขั้นต่ำสำหรับการใช้น้ำ/ไฟต่ำ
                      </h3>
                        <p className="text-xs text-slate-600">
                          กำหนดค่าขั้นต่ำสำหรับกรณีที่ผู้เช่าใช้น้ำ/ไฟต่ำกว่าเกณฑ์ที่กำหนด
                        </p>

                        {/* ค่าน้ำขั้นต่ำ */}
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={billingRates.water_minimum_enabled}
                              onChange={(e) => setBillingRates({ ...billingRates, water_minimum_enabled: e.target.checked })}
                              className="w-5 h-5 rounded"
                            />
                            <div>
                              <p className="text-sm font-semibold text-blue-800">เปิดใช้ค่าน้ำขั้นต่ำ</p>
                              <p className="text-xs text-blue-600">คิดค่าน้ำขั้นต่ำถ้าใช้ต่ำกว่าเกณฑ์</p>
                            </div>
                          </label>

                          {billingRates.water_minimum_enabled && (
                            <div className="grid grid-cols-2 gap-3 pl-8">
                              <div>
                                <Label className="text-xs text-blue-700">ถ้าใช้ต่ำกว่า (หน่วย)</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={billingRates.water_minimum_units}
                                  onChange={(e) => setBillingRates({ ...billingRates, water_minimum_units: e.target.value })}
                                  placeholder="3"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-blue-700">คิดค่าน้ำขั้นต่ำ (บาท)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={billingRates.water_minimum_charge}
                                  onChange={(e) => setBillingRates({ ...billingRates, water_minimum_charge: e.target.value })}
                                  placeholder="100"
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* ค่าไฟขั้นต่ำ */}
                        <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200 space-y-3">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={billingRates.electricity_minimum_enabled}
                              onChange={(e) => setBillingRates({ ...billingRates, electricity_minimum_enabled: e.target.checked })}
                              className="w-5 h-5 rounded"
                            />
                            <div>
                              <p className="text-sm font-semibold text-yellow-800">เปิดใช้ค่าไฟขั้นต่ำ</p>
                              <p className="text-xs text-yellow-600">คิดค่าไฟขั้นต่ำถ้าใช้ต่ำกว่าเกณฑ์</p>
                            </div>
                          </label>

                          {billingRates.electricity_minimum_enabled && (
                            <div className="grid grid-cols-2 gap-3 pl-8">
                              <div>
                                <Label className="text-xs text-yellow-700">ถ้าใช้ต่ำกว่า (หน่วย)</Label>
                                <Input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={billingRates.electricity_minimum_units}
                                  onChange={(e) => setBillingRates({ ...billingRates, electricity_minimum_units: e.target.value })}
                                  placeholder="3"
                                  className="mt-1"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-yellow-700">คิดค่าไฟขั้นต่ำ (บาท)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={billingRates.electricity_minimum_charge}
                                  onChange={(e) => setBillingRates({ ...billingRates, electricity_minimum_charge: e.target.value })}
                                  placeholder="100"
                                  className="mt-1"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <Button type="submit" className="bg-gradient-to-r from-green-600 to-emerald-600" disabled={isSavingBillingRates}>
                        {isSavingBillingRates ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            กำลังบันทึก...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            บันทึก
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'bill_notifications' && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      การแจ้งบิลและการสร้างบิลอัตโนมัติ
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BranchToggle
                      applyToAllBranches={applyToAllBranches_billNotif}
                      setApplyToAllBranches={setApplyToAllBranches_billNotif}
                      selectedBranch={selectedBranch}
                      canSetGlobalConfig={canSetGlobalConfig}
                    />

                    <form onSubmit={handleBillSettingsSubmit} className="space-y-6">
                      {/* วันที่สร้างบิลและวันครบกำหนด */}
                      <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                        กำหนดวันที่และรูปแบบการชำระ
                      </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <Label className="text-xs text-slate-600 mb-2 block">วันที่สร้างบิล</Label>
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              value={billSettings.bill_generation_day}
                              onChange={(e) => setBillSettings({ ...billSettings, bill_generation_day: e.target.value })}
                              className="text-center text-2xl font-bold"
                            />
                            <p className="text-xs text-slate-500 mt-1 text-center">ของทุกเดือน</p>
                          </div>

                          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <Label className="text-xs text-slate-600 mb-2 block">วันครบกำหนดชำระ</Label>
                            <Input
                              type="number"
                              min="1"
                              max="31"
                              value={billSettings.pay_day}
                              onChange={(e) => setBillSettings({ ...billSettings, pay_day: e.target.value })}
                              className="text-center text-2xl font-bold"
                            />
                            <p className="text-xs text-slate-500 mt-1 text-center">ของทุกเดือน</p>
                          </div>

                          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                            <Label className="text-xs text-slate-600 mb-2 block">ค่าปรับล่าช้า (บาท/วัน)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={billSettings.late_fee_per_day}
                              onChange={(e) => setBillSettings({ ...billSettings, late_fee_per_day: e.target.value })}
                              className="text-center text-2xl font-bold"
                              disabled={billSettings.late_fee_tiers_enabled}
                            />
                            {billSettings.late_fee_tiers_enabled && (
                              <p className="text-xs text-amber-600 mt-1 text-center">ใช้ค่าปรับแบบขั้นบันไดแทน</p>
                            )}
                          </div>
                        </div>

                      </div>

                      {/* ค่าปรับแบบขั้นบันได */}
                      <div className="space-y-4 pt-4 border-t">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                              ค่าปรับแบบขั้นบันได (ยิ่งช้ายิ่งปรับเพิ่ม)
                            </h3>
                            <p className="text-xs text-slate-500 mt-1">
                              กำหนดอัตราค่าปรับที่แตกต่างกันตามจำนวนวันที่เกินกำหนด
                            </p>
                          </div>
                          <Switch
                            checked={billSettings.late_fee_tiers_enabled}
                            onCheckedChange={(checked) => setBillSettings({ ...billSettings, late_fee_tiers_enabled: checked })}
                          />
                        </div>

                        {billSettings.late_fee_tiers_enabled && (
                          <div className="space-y-3 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
                            <p className="text-xs text-amber-700 font-medium mb-3">
                              ตัวอย่าง: วันที่ 1-7 ปรับ 20฿/วัน<br/>
                              วันที่ 8-14 ปรับ 50฿/วัน
                            </p>
                            
                            {billSettings.late_fee_tiers.map((tier, index) => (
                              <div key={index} className="flex items-center gap-2 bg-white rounded-lg p-3 border border-amber-100 overflow-x-auto">
                                <span className="text-sm text-slate-600 whitespace-nowrap">เกินกำหนด</span>
                                <Input
                                  type="number"
                                  min="1"
                                  value={tier.days_from}
                                  onChange={(e) => {
                                    const newTiers = [...billSettings.late_fee_tiers];
                                    newTiers[index].days_from = parseInt(e.target.value) || 1;
                                    setBillSettings({ ...billSettings, late_fee_tiers: newTiers });
                                  }}
                                  className="w-16 text-center text-sm"
                                />
                                <span className="text-sm text-slate-600">-</span>
                                <Input
                                  type="number"
                                  min="1"
                                  value={tier.days_to === 999 ? '' : tier.days_to}
                                  placeholder="∞"
                                  onChange={(e) => {
                                    const newTiers = [...billSettings.late_fee_tiers];
                                    newTiers[index].days_to = parseInt(e.target.value) || 999;
                                    setBillSettings({ ...billSettings, late_fee_tiers: newTiers });
                                  }}
                                  className="w-16 text-center text-sm"
                                />
                                <span className="text-sm text-slate-600 whitespace-nowrap">วัน ปรับ</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={tier.fee_per_day}
                                  onChange={(e) => {
                                    const newTiers = [...billSettings.late_fee_tiers];
                                    newTiers[index].fee_per_day = e.target.value;
                                    setBillSettings({ ...billSettings, late_fee_tiers: newTiers });
                                  }}
                                  placeholder="0"
                                  className="w-20 text-center text-sm font-semibold"
                                />
                                <span className="text-sm text-slate-600">บาท/วัน</span>
                              </div>
                            ))}

                            <div className="flex gap-2 mt-3">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const lastTier = billSettings.late_fee_tiers[billSettings.late_fee_tiers.length - 1];
                                  const newTier = {
                                    days_from: (lastTier?.days_to || 0) + 1,
                                    days_to: 999,
                                    fee_per_day: ''
                                  };
                                  // อัพเดท days_to ของ tier ก่อนหน้า
                                  const newTiers = [...billSettings.late_fee_tiers];
                                  if (newTiers.length > 0) {
                                    newTiers[newTiers.length - 1].days_to = newTier.days_from - 1;
                                  }
                                  newTiers.push(newTier);
                                  setBillSettings({ ...billSettings, late_fee_tiers: newTiers });
                                }}
                                className="text-xs"
                              >
                                + เพิ่มช่วง
                              </Button>
                              {billSettings.late_fee_tiers.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const newTiers = billSettings.late_fee_tiers.slice(0, -1);
                                    if (newTiers.length > 0) {
                                      newTiers[newTiers.length - 1].days_to = 999;
                                    }
                                    setBillSettings({ ...billSettings, late_fee_tiers: newTiers });
                                  }}
                                  className="text-xs text-red-600 hover:text-red-700"
                                >
                                  ลบช่วงสุดท้าย
                                </Button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* การแจ้งเตือนอัตโนมัติ */}
                      <div className="space-y-3 pt-4 border-t">
                       <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                         การแจ้งเตือนอัตโนมัติ
                       </h3>

                        <div className="space-y-3">
                          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={billSettings.auto_send_bills}
                              onChange={(e) => setBillSettings({ ...billSettings, auto_send_bills: e.target.checked })}
                              className="w-5 h-5 rounded"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-800">ส่งบิลทาง LINE หลังสร้างบิล</p>
                              <p className="text-xs text-slate-600">ส่งใบแจ้งหนี้ให้ผู้เช่าทันทีเมื่อสร้างบิล</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={billSettings.send_advance_reminder}
                              onChange={(e) => setBillSettings({ ...billSettings, send_advance_reminder: e.target.checked })}
                              className="w-5 h-5 rounded"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-800">แจ้งบิลล่วงหน้า</p>
                              <p className="text-xs text-slate-600">ส่งแจ้งเตือนก่อนถึงวันครบกำหนด {billSettings.bill_advance_notice_days} วัน</p>
                            </div>
                          </label>

                          {billSettings.send_advance_reminder && (
                            <div className="ml-8 p-3 bg-blue-50 rounded-lg border border-blue-200">
                              <Label className="text-sm font-medium text-blue-800 mb-2 block">จำนวนวันล่วงหน้า</Label>
                              <div className="flex items-center gap-3">
                                <Input
                                  type="number"
                                  min="1"
                                  max="30"
                                  value={billSettings.bill_advance_notice_days}
                                  onChange={(e) => setBillSettings({ ...billSettings, bill_advance_notice_days: e.target.value })}
                                  className="max-w-xs"
                                />
                                <span className="text-xs text-blue-700">
                                  วันก่อนครบกำหนด
                                </span>
                              </div>
                            </div>
                          )}

                          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={billSettings.send_due_date_reminder}
                              onChange={(e) => setBillSettings({ ...billSettings, send_due_date_reminder: e.target.checked })}
                              className="w-5 h-5 rounded"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-800">แจ้งเตือนในวันครบกำหนด</p>
                              <p className="text-xs text-slate-600">ส่งข้อความเตือนในวันที่ {billSettings.pay_day} (เฉพาะรายการที่รอชำระ)</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors">
                            <input
                              type="checkbox"
                              checked={billSettings.send_overdue_reminder}
                              onChange={(e) => setBillSettings({ ...billSettings, send_overdue_reminder: e.target.checked })}
                              className="w-5 h-5 rounded"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-800">แจ้งเตือนเกินกำหนด</p>
                              <p className="text-xs text-slate-600">ส่งข้อความเตือนทุกวันสำหรับรายการที่เกินกำหนดชำระแล้ว (พร้อมค่าปรับ)</p>
                            </div>
                          </label>
                        </div>
                      </div>

                      <Button
                        type="submit"
                        className={`w-full transition-all ${
                          justSavedBillSettings
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600'
                        }`}
                        disabled={isSavingBillSettings || justSavedBillSettings}
                      >
                        {justSavedBillSettings ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            บันทึกสำเร็จ!
                          </>
                        ) : isSavingBillSettings ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            กำลังบันทึก...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            บันทึกการตั้งค่าบิล
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'notifications' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-slate-800 mb-1">การตั้งค่าการแจ้งเตือน</h3>
                      <p className="text-sm text-slate-600">ตั้งค่าเกณฑ์การแจ้งเตือนต่างๆ</p>
                    </div>
                    {canSetGlobalConfig && (
                      <BranchToggle
                        applyToAllBranches={applyToAllBranches_billNotif}
                        setApplyToAllBranches={setApplyToAllBranches_billNotif}
                        selectedBranch={selectedBranch}
                        canSetGlobalConfig={canSetGlobalConfig}
                      />
                    )}
                  </div>

                  <Card className="bg-blue-50/50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Bell className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Label className="text-sm font-semibold text-slate-700">เปิดใช้งานการแจ้งเตือน</Label>
                            <Switch
                              checked={notificationSettings.enabled}
                              onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, enabled: checked})}
                            />
                          </div>
                          <p className="text-xs text-slate-600">เปิด/ปิดการแจ้งเตือนทั้งหมดในระบบ</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <DollarSign className="w-5 h-5 text-red-600 mt-0.5" />
                            <div className="flex-1">
                              <Label className="text-sm font-semibold text-slate-700">ค้างชำระเกิน (วัน)</Label>
                              <Input
                                type="number"
                                min="1"
                                value={notificationSettings.overdue_payment_days}
                                onChange={(e) => setNotificationSettings({...notificationSettings, overdue_payment_days: parseInt(e.target.value) || 1})}
                                className="mt-2"
                              />
                              <p className="text-xs text-slate-500 mt-1">แจ้งเตือนเมื่อค้างชำระเกินจำนวนวันนี้</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <DoorOpen className="w-5 h-5 text-green-600 mt-0.5" />
                            <div className="flex-1">
                              <Label className="text-sm font-semibold text-slate-700">ห้องว่างเกิน (วัน)</Label>
                              <Input
                                type="number"
                                min="1"
                                value={notificationSettings.vacant_room_days}
                                onChange={(e) => setNotificationSettings({...notificationSettings, vacant_room_days: parseInt(e.target.value) || 7})}
                                className="mt-2"
                              />
                              <p className="text-xs text-slate-500 mt-1">แจ้งเตือนเมื่อห้องว่างเกินจำนวนวันนี้</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Package className="w-5 h-5 text-amber-600 mt-0.5" />
                            <div className="flex-1">
                              <Label className="text-sm font-semibold text-slate-700">พัสดุค้างรับเกิน (วัน)</Label>
                              <Input
                                type="number"
                                min="1"
                                value={notificationSettings.unclaimed_delivery_days}
                                onChange={(e) => setNotificationSettings({...notificationSettings, unclaimed_delivery_days: parseInt(e.target.value) || 5})}
                                className="mt-2"
                              />
                              <p className="text-xs text-slate-500 mt-1">แจ้งเตือนเมื่อพัสดุค้างรับเกินจำนวนวันนี้</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <TrendingDown className="w-5 h-5 text-orange-600 mt-0.5" />
                            <div className="flex-1">
                              <Label className="text-sm font-semibold text-slate-700">รายได้รายวันต่ำกว่าค่าเฉลี่ย (%)</Label>
                              <Input
                                type="number"
                                min="1"
                                max="100"
                                value={notificationSettings.low_daily_revenue_percent}
                                onChange={(e) => setNotificationSettings({...notificationSettings, low_daily_revenue_percent: parseInt(e.target.value) || 20})}
                                className="mt-2"
                              />
                              <p className="text-xs text-slate-500 mt-1">แจ้งเตือนเมื่อรายได้รายวันต่ำกว่าค่าเฉลี่ย (เปอร์เซ็นต์)</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Wrench className="w-5 h-5 text-purple-600 mt-0.5" />
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <Label className="text-sm font-semibold text-slate-700">แจ้งเตือนการซ่อมบำรุงเร่งด่วน</Label>
                              <Switch
                                checked={notificationSettings.urgent_maintenance_enabled}
                                onCheckedChange={(checked) => setNotificationSettings({...notificationSettings, urgent_maintenance_enabled: checked})}
                              />
                            </div>
                            <p className="text-xs text-slate-500 mt-2">แจ้งเตือนเมื่อมีคำขอซ่อมที่มีความเร่งด่วนสูง</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Button
                    onClick={handleSaveNotificationSettings}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 mt-6"
                    disabled={saveNotificationSettingsMutation.isPending}
                  >
                    {saveNotificationSettingsMutation.isPending ? (
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
                </div>
              )}

              {activeTab === 'bank' && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-purple-600" />
                      บัญชีธนาคาร
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <BranchToggle
                      applyToAllBranches={applyToAllBranches_bank}
                      setApplyToAllBranches={setApplyToAllBranches_bank}
                      selectedBranch={selectedBranch}
                      canSetGlobalConfig={canSetGlobalConfig}
                    />

                    <form onSubmit={handleBankInfoSubmit} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <Label>ชื่อบัญชี</Label>
                          <Input
                            value={bankInfo.account_name}
                            onChange={(e) => setBankInfo({ ...bankInfo, account_name: e.target.value })}
                            placeholder="นาย/นาง..."
                          />
                        </div>
                        <div>
                          <Label>ธนาคาร</Label>
                          <Input
                            value={bankInfo.bank_name}
                            onChange={(e) => setBankInfo({ ...bankInfo, bank_name: e.target.value })}
                            placeholder="ธนาคารกสิกรไทย"
                          />
                        </div>
                        <div>
                          <Label>เลขที่บัญชี</Label>
                          <Input
                            value={bankInfo.account_number}
                            onChange={(e) => setBankInfo({ ...bankInfo, account_number: e.target.value })}
                            placeholder="xxx-x-xxxxx-x"
                          />
                        </div>
                        <div>
                          <Label>พร้อมเพย์</Label>
                          <Input
                            value={bankInfo.promptpay}
                            onChange={(e) => setBankInfo({ ...bankInfo, promptpay: e.target.value })}
                            placeholder="0812345678"
                          />
                        </div>
                      </div>
                      <Button type="submit" className="bg-gradient-to-r from-purple-600 to-pink-600" disabled={isSavingBankInfo}>
                        {isSavingBankInfo ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            กำลังบันทึก...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4 mr-2" />
                            บันทึก
                          </>
                        )}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'messaging' && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5 text-indigo-600" />
                      เชื่อมต่อช่องทางสื่อสาร
                    </CardTitle>
                    <p className="text-sm text-slate-600 mt-2">
                      ตั้งค่าการเชื่อมต่อ LINE และ Facebook เพื่อส่งข้อความอัตโนมัติถึงผู้เช่า
                    </p>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="line" className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-6">
                        <TabsTrigger value="line" className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          LINE
                        </TabsTrigger>
                        <TabsTrigger value="facebook" className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          Facebook
                        </TabsTrigger>
                      </TabsList>

                      <TabsContent value="line" className="space-y-6">
                        <BranchToggle
                          applyToAllBranches={applyToAllBranches_line}
                          setApplyToAllBranches={setApplyToAllBranches_line}
                          selectedBranch={selectedBranch}
                          canSetGlobalConfig={canSetGlobalConfig}
                        />

                        <form onSubmit={handleLineSettingsSubmit} className="space-y-6">
                          <div className="space-y-4">
                            <div>
                              <Label>LINE Channel Access Token *</Label>
                              <Input
                                type="password"
                                value={lineSettings.line_channel_access_token}
                                onChange={(e) => setLineSettings({ ...lineSettings, line_channel_access_token: e.target.value })}
                                placeholder="ใส่ Channel Access Token ที่ได้จาก LINE Developers"
                              />
                            </div>
                            <div>
                              <Label>LINE Channel Secret</Label>
                              <Input
                                type="password"
                                value={lineSettings.line_channel_secret}
                                onChange={(e) => setLineSettings({ ...lineSettings, line_channel_secret: e.target.value })}
                                placeholder="ใส่ Channel Secret (สำหรับการยืนยันตัวตน)"
                              />
                            </div>
                          </div>

                          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                            <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                              <Zap className="w-5 h-5" />
                              Webhook URL สำหรับสาขานี้
                            </h4>
                            <div className="space-y-3">
                              <p className="text-sm text-purple-800 font-semibold">
                                ⚠️ URL นี้เฉพาะสาขา "{selectedBranch?.name || 'ไม่ระบุ'}" - คัดลอกไปใส่ในหน้า LINE Developers Console:
                              </p>
                              <div className="bg-white rounded-lg p-3 border-2 border-purple-300 flex items-center gap-2">
                                <code className="flex-1 text-sm text-purple-900 font-mono break-all">
                                  {`https://app-483eff6e.base44.app/api/apps/6904ea5ce861be65483eff6e/functions/lineWebhookHandler?branch_id=${selectedBranch?.id || ''}`}
                                </code>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    navigator.clipboard.writeText(`https://app-483eff6e.base44.app/api/apps/6904ea5ce861be65483eff6e/functions/lineWebhookHandler?branch_id=${selectedBranch?.id || ''}`);
                                    toast.success('คัดลอก Webhook URL แล้ว');
                                  }}
                                  className="flex-shrink-0"
                                >
                                  คัดลอก
                                </Button>
                              </div>
                              <p className="text-xs text-purple-700">
                                💡 แต่ละสาขาต้องใช้ Webhook URL คนละอัน เมื่อสร้างสาขาใหม่ ให้นำ URL ใหม่ไปตั้งค่าใน LINE OA ของสาขานั้น
                              </p>
                            </div>
                          </div>

                          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                            <h4 className="font-semibold text-green-900 mb-2">วิธีตั้งค่า LINE Official Account:</h4>
                            <ol className="text-sm text-green-700 space-y-2 list-decimal ml-5">
                              <li>ไปที่ <a href="https://developers.line.biz/console/" target="_blank" className="underline font-semibold">LINE Developers Console</a></li>
                              <li>สร้าง Provider และ Messaging API Channel</li>
                              <li>ไปที่ Messaging API → คัดลอก <strong>Channel Access Token</strong></li>
                              <li>ไปที่ Basic Settings → คัดลอก <strong>Channel Secret</strong></li>
                              <li>นำมาใส่ในฟอร์มด้านบนและกดบันทึก</li>
                              <li>ตั้ง Webhook URL (ใช้ URL ด้านบน) ใน LINE Console</li>
                            </ol>
                          </div>

                          <Button 
                            type="submit" 
                            className="w-full bg-gradient-to-r from-green-600 to-emerald-600"
                            disabled={isSavingLineSettings}
                          >
                            {isSavingLineSettings ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                กำลังบันทึก...
                              </>
                            ) : (
                              <>
                                <Save className="w-4 h-4 mr-2" />
                                บันทึกการตั้งค่า LINE
                              </>
                            )}
                          </Button>
                        </form>
                      </TabsContent>

                      <TabsContent value="facebook" className="space-y-6">
                        <BranchToggle
                          applyToAllBranches={applyToAllBranches_facebook}
                          setApplyToAllBranches={setApplyToAllBranches_facebook}
                          selectedBranch={selectedBranch}
                          canSetGlobalConfig={canSetGlobalConfig}
                        />

                        {/* ข้อมูล Facebook Page ที่เชื่อมต่ออยู่ */}
                        {facebookSettings.facebook_page_access_token && (
                          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border-2 border-green-300 shadow-lg">
                            <div className="flex items-start gap-6">
                              <div className="flex-shrink-0">
                                <div className="w-20 h-20 rounded-2xl bg-white border-3 border-green-400 shadow-xl flex items-center justify-center overflow-hidden">
                                  {buildingLogo && buildingLogo.includes('graph.facebook.com') ? (
                                    <img src={buildingLogo} alt="Page Logo" className="w-full h-full object-cover" />
                                  ) : (
                                    <Globe className="w-10 h-10 text-green-600" />
                                  )}
                                </div>
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                  <Check className="w-6 h-6 text-green-600" />
                                  <h3 className="text-2xl font-bold text-green-900">เชื่อมต่อสำเร็จ!</h3>
                                </div>
                                <div className="space-y-2 mb-4">
                                  <p className="text-base text-green-800">
                                    <strong>เพจ:</strong> {configs.find(c => c.key === 'facebook_page_name' && c.branch_id === selectedBranch?.id)?.value || buildingInfo.building_name || 'Facebook Page'}
                                  </p>
                                  <p className="text-sm text-green-700">
                                    📍 สาขา: {selectedBranch?.name}
                                  </p>
                                </div>
                                <div className="bg-white/60 rounded-lg p-4 border border-green-200">
                                  <p className="text-sm text-green-900 font-semibold mb-2">คุณสามารถใช้งาน:</p>
                                  <ul className="text-xs text-green-800 space-y-1.5">
                                    <li>• รับข้อความจากลูกค้าผ่าน Facebook Messenger</li>
                                    <li>• ส่งข้อความแจ้งเตือนการชำระเงินอัตโนมัติ</li>
                                    <li>• ตอบกลับคอมเมนต์ในโพสต์ด้วย AI</li>
                                    <li>• ลงทะเบียนผู้เช่าผ่าน Facebook Chat</li>
                                  </ul>
                                </div>
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={async () => {
                                  if (confirm('คุณต้องการยกเลิกการเชื่อมต่อ Facebook หรือไม่?')) {
                                    await Promise.all([
                                      updateConfigMutation.mutateAsync({
                                        key: 'facebook_page_access_token',
                                        value: '',
                                        description: 'Facebook Page Access Token',
                                        category: 'notification',
                                        applyToAllBranches: false
                                      }),
                                      updateConfigMutation.mutateAsync({
                                        key: 'facebook_page_id',
                                        value: '',
                                        description: 'Facebook Page ID',
                                        category: 'notification',
                                        applyToAllBranches: false
                                      }),
                                      updateConfigMutation.mutateAsync({
                                        key: 'facebook_page_name',
                                        value: '',
                                        description: 'Facebook Page Name',
                                        category: 'notification',
                                        applyToAllBranches: false
                                      })
                                    ]);
                                    setFacebookSettings({ facebook_page_access_token: '', facebook_verify_token: '' });
                                    toast.success('ยกเลิกการเชื่อมต่อสำเร็จ');
                                  }
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                              >
                                <X className="w-5 h-5 mr-2" />
                                ยกเลิกการเชื่อมต่อ
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* ปุ่ม Facebook Login Button */}
                        {!facebookSettings.facebook_page_access_token && (
                          <div className="space-y-6">
                            <Button
                              type="button"
                              onClick={() => {
                                if (window.FB) {
                                  console.log('🔵 Facebook SDK ready, starting login...');
                                  window.FB.login(function(response) {
                                    console.log('🔵 FB Login Response:', response);
                                    if (response.authResponse) {
                                      console.log('✅ Facebook authorized!');
                                      window.checkLoginState();
                                    } else {
                                      console.log('❌ User cancelled login or did not fully authorize.');
                                      toast.error('การเข้าสู่ระบบถูกยกเลิก');
                                    }
                                  }, {scope: 'pages_show_list,pages_messaging,pages_read_engagement,pages_manage_metadata'});
                                } else {
                                  console.error('❌ window.FB not available');
                                  toast.error('Facebook SDK ยังไม่พร้อม กรุณารีเฟรชหน้าและลองอีกครั้ง');
                                }
                              }}
                              className="w-full bg-[#1877f2] hover:bg-[#166fe5] text-white text-xl font-bold py-8 shadow-xl hover:shadow-2xl transition-all"
                            >
                              <svg className="w-7 h-7 mr-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                              </svg>
                              เชื่อมต่อด้วย Facebook Login
                            </Button>
                            
                            <div className="bg-blue-50 rounded-xl p-6 border-2 border-blue-200">
                              <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                                <Zap className="w-5 h-5" />
                                ประโยชน์ที่คุณจะได้รับ:
                              </h4>
                              <ul className="text-sm text-blue-800 space-y-2">
                                <li className="flex items-start gap-2">
                                  <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                  <span><strong>รับข้อความอัตโนมัติ:</strong> ลูกค้าส่งข้อความถึงเพจได้ทันที</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                  <span><strong>แจ้งเตือนการชำระเงิน:</strong> ส่งใบแจ้งหนี้ผ่าน Messenger อัตโนมัติ</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                  <span><strong>ตอบคอมเมนต์ด้วย AI:</strong> AI ตอบคอมเมนต์ในโพสต์อัตโนมัติ</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                  <span><strong>ลงทะเบียนผู้เช่า:</strong> ผู้เช่าลงทะเบียนผ่าน Facebook Chat ได้</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <Check className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                  <span><strong>รับแจ้งซ่อม:</strong> รับแจ้งปัญหาผ่าน Messenger พร้อมบันทึกอัตโนมัติ</span>
                                </li>
                              </ul>
                            </div>
                          </div>
                        )}

                        {facebookSettings.facebook_page_access_token && (
                          <>
                            {/* หรือ */}
                            <div className="relative">
                              <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-300"></div>
                              </div>
                              <div className="relative flex justify-center">
                                <span className="bg-white px-4 text-sm text-slate-500">หรือกรอก Token ด้วยตัวเอง</span>
                              </div>
                            </div>

                            <form onSubmit={handleFacebookSettingsSubmit} className="space-y-6">
                          <div className="space-y-4">
                            <div>
                              <Label>Facebook Page Access Token *</Label>
                              <Input
                                type="password"
                                value={facebookSettings.facebook_page_access_token}
                                onChange={(e) => setFacebookSettings({ ...facebookSettings, facebook_page_access_token: e.target.value })}
                                placeholder="ใส่ Page Access Token"
                              />
                            </div>
                            <div>
                              <Label>Verify Token *</Label>
                              <Input
                                value={facebookSettings.facebook_verify_token}
                                onChange={(e) => setFacebookSettings({ ...facebookSettings, facebook_verify_token: e.target.value })}
                                placeholder="กำหนด Verify Token เอง (เช่น mysecrettoken)"
                              />
                            </div>
                          </div>

                          <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
                            <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                              <Zap className="w-5 h-5" />
                              Webhook URL สำหรับ Facebook
                            </h4>
                            <div className="space-y-3">
                              <p className="text-sm text-purple-800 font-semibold">
                                คัดลอก URL นี้ไปใส่ในหน้า Facebook Developers Console:
                              </p>
                              <div className="bg-white rounded-lg p-3 border-2 border-purple-300 flex items-center gap-2">
                                <code className="flex-1 text-sm text-purple-900 font-mono break-all">
                                  https://app-483eff6e.base44.app/api/apps/6904ea5ce861be65483eff6e/functions/facebookWebhookHandler
                                </code>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    navigator.clipboard.writeText('https://app-483eff6e.base44.app/api/apps/6904ea5ce861be65483eff6e/functions/facebookWebhookHandler');
                                    toast.success('คัดลอก Webhook URL แล้ว');
                                  }}
                                  className="flex-shrink-0"
                                >
                                  คัดลอก
                                </Button>
                              </div>
                            </div>
                          </div>

                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                            <h4 className="font-semibold text-blue-900 mb-2">วิธีตั้งค่า Facebook Messenger:</h4>
                            <ol className="text-sm text-blue-700 space-y-2 list-decimal ml-5">
                              <li>ไปที่ <a href="https://developers.facebook.com/" target="_blank" className="underline font-semibold">Facebook Developers</a></li>
                              <li>สร้าง App และเพิ่มผลิตภัณฑ์ Messenger</li>
                              <li>เลือก Page เพื่อสร้าง <strong>Page Access Token</strong></li>
                              <li>ตั้งค่า Webhook โดยใช้ URL ด้านบน และ Verify Token ที่คุณกำหนดเอง</li>
                              <li>เลือก Subscription Fields: <strong>messages</strong></li>
                            </ol>
                          </div>

                              <Button 
                                type="submit" 
                                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
                                disabled={isSavingFacebookSettings}
                              >
                                {isSavingFacebookSettings ? (
                                  <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    กำลังบันทึก...
                                  </>
                                ) : (
                                  <>
                                    <Save className="w-4 h-4 mr-2" />
                                    บันทึกการตั้งค่า Facebook
                                  </>
                                )}
                              </Button>
                            </form>
                          </>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'signature' && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <PenTool className="w-5 h-5 text-indigo-600" />
                      ลายเซ็นและตราประทับสำหรับใบเสร็จ
                    </CardTitle>
                    <p className="text-sm text-slate-600 mt-2">
                      ✅ ข้อมูลนี้จำเป็นตามกฎหมาย (ประมวลรัษฎากร มาตรา 105 ทวิ) เพื่อความถูกต้องของใบเสร็จรับเงิน
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <BranchToggle
                      applyToAllBranches={applyToAllBranches_signature}
                      setApplyToAllBranches={setApplyToAllBranches_signature}
                      selectedBranch={selectedBranch}
                      canSetGlobalConfig={canSetGlobalConfig}
                    />

                    {/* ลายเซ็นผู้รับเงิน */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <PenTool className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-lg font-semibold text-slate-800">ลายเซ็นผู้รับเงิน *</h3>
                      </div>

                      {signatureImage ? (
                        <div className="space-y-3">
                          <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                            <img
                              src={signatureImage}
                              alt="ลายเซ็น"
                              className="h-32 mx-auto object-contain"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => setShowSignatureDialog(true)}
                              variant="outline"
                              className="flex-1"
                            >
                              <PenTool className="w-4 h-4 mr-2" />
                              เซ็นใหม่
                            </Button>
                            <Button
                              type="button"
                              onClick={async () => {
                                if (confirm('คุณแน่ใจว่าต้องการลบลายเซ็น?')) {
                                  await updateConfigMutation.mutateAsync({
                                    key: 'receipt_signature',
                                    value: '',
                                    description: 'ลายเซ็นผู้รับเงินสำหรับใบเสร็จ',
                                    category: 'general',
                                    applyToAllBranches: applyToAllBranches_signature
                                  });
                                  setSignatureImage('');
                                  toast.success('ลบลายเซ็นสำเร็จ' + (applyToAllBranches_signature ? ' (ทุกสาขาที่คุณดูแล)' : ` (${selectedBranch?.name})`));
                                }
                              }}
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4 mr-2" />
                              ลบ
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          onClick={() => setShowSignatureDialog(true)}
                          className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
                        >
                          <PenTool className="w-4 h-4 mr-2" />
                          เซ็นลายเซ็น
                        </Button>
                      )}
                    </div>

                    {/* ตราประทับ */}
                    <div className="space-y-4 pt-4 border-t">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <ImageIcon className="w-5 h-5 text-purple-600" />
                        <h3 className="text-lg font-semibold text-slate-800">ตราประทับ (ถ้ามี)</h3>
                      </div>

                      {stampImage ? (
                        <div className="space-y-3">
                          <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-200">
                            <img
                              src={stampImage}
                              alt="ตราประทับ"
                              className="h-32 mx-auto object-contain"
                            />
                          </div>
                          <div className="flex gap-2">
                            <label className="flex-1">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleStampUpload}
                                className="hidden"
                              />
                              <Button
                                type="button"
                                as="div"
                                variant="outline"
                                className="w-full cursor-pointer"
                              >
                                {uploadingStamp ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-2" />
                                    กำลังอัพโหลด...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    เปลี่ยนตราประทับ
                                  </>
                                )}
                              </Button>
                            </label>
                            <Button
                              type="button"
                              onClick={async () => {
                                if (confirm('คุณแน่ใจว่าต้องการลบตราประทับ?')) {
                                  await updateConfigMutation.mutateAsync({
                                    key: 'receipt_stamp',
                                    value: '',
                                    description: 'ตราประทับสำหรับใบเสร็จ',
                                    category: 'general',
                                    applyToAllBranches: applyToAllBranches_signature
                                  });
                                  setStampImage('');
                                  toast.success('ลบตราประทับสำเร็จ' + (applyToAllBranches_signature ? ' (ทุกสาขาที่คุณดูแล)' : ` (${selectedBranch?.name})`));
                                }
                              }}
                              variant="outline"
                              className="text-red-600 hover:text-red-700"
                            >
                              <X className="w-4 h-4 mr-2" />
                              ลบ
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <label>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleStampUpload}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            as="div"
                            variant="outline"
                            className="w-full cursor-pointer"
                          >
                            {uploadingStamp ? (
                              <>
                                <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin mr-2" />
                                กำลังอัพโหลด...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                อัพโหลดตราประทับ
                              </>
                            )}
                          </Button>
                        </label>
                      )}
                      <p className="text-xs text-slate-500">
                        💡 ตราประทับช่วยเพิ่มความน่าเชื่อถือให้กับใบเสร็จ (ไม่บังคับ)
                      </p>
                    </div>

                    {/* คำแนะนำ */}
                    </CardContent>
                    </Card>
                    )}

                    {canManagePermissions && activeTab === 'permissions' && (
                <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="w-5 h-5 text-orange-600" />
                          จัดการสิทธิ์ผู้ใช้งาน
                        </CardTitle>
                        <p className="text-sm text-slate-600 mt-2">
                          เลือกบทบาท จัดการสิทธิ์การเข้าถึง และกำหนดสาขาที่ผู้ใช้สามารถเข้าถึงได้
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {users
                        .filter(user => {
                          const role = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
                          if (userRole === 'owner' && role === 'developer') return false;
                          if (user.id === currentUser?.id) return false;
                          
                          // กรองเฉพาะผู้ใช้ที่มีสิทธิ์ในสาขาที่เลือกอยู่
                          if (selectedBranch) {
                            const userBranches = user.accessible_branches || [];
                            // ถ้าผู้ใช้คนนี้ไม่มีสิทธิ์ในสาขาที่เลือก = ไม่แสดง
                            if (!userBranches.includes(selectedBranch.id)) return false;
                          }
                          
                          return true;
                        })
                        .sort((a, b) => {
                          // เรียงตามลำดับ: pending users (ไม่มี custom_role) -> owner -> manager -> employee
                          const getRoleOrder = (user) => {
                            const role = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
                            if (!user.custom_role) return 0; // pending users first
                            if (role === 'owner') return 1;
                            if (role === 'manager') return 2;
                            return 3; // employee
                          };
                          return getRoleOrder(a) - getRoleOrder(b);
                        })
                        .map((user) => {
                          const role = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
                          const badge = getRoleBadge(role);
                          const currentPermissions = userPermissions[user.id] || [];
                          const accessibleBranches = user.accessible_branches || [];
                          const canAccessAllBranches = role === 'developer' || role === 'owner';
                          // แสดง pending เฉพาะผู้ใช้ที่ไม่ใช่ admin และยังไม่มี custom_role
                          const isPending = !user.custom_role && user.role !== 'admin';

                          return (
                            <Card key={user.id} className={`border-2 transition-shadow ${isPending ? 'border-amber-400 bg-amber-50/30' : 'border-slate-200 hover:shadow-md'}`}>
                              <CardContent className="p-4">
                                <div className="space-y-4">
                                  {/* ข้อมูลผู้ใช้และบทบาท */}
                                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                                    <div className="flex items-center gap-3 flex-1">
                                      <div className={`w-12 h-12 bg-gradient-to-br ${badge.color} rounded-full flex items-center justify-center flex-shrink-0 ${isPending ? 'opacity-60' : ''}`}>
                                        <span className="text-white font-semibold text-lg">
                                          {user.full_name?.charAt(0) || 'U'}
                                        </span>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                          <p className="font-bold text-slate-800 text-lg truncate">{user.full_name || 'ไม่ระบุชื่อ'}</p>
                                          {isPending && (
                                            <Badge className="bg-amber-500 text-white text-xs">
                                              กำลังรอเข้าใช้
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-sm text-slate-500 truncate">{user.email}</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                          <Badge variant="outline" className="text-xs">
                                            {currentPermissions.length} สิทธิ์
                                          </Badge>
                                          {canAccessAllBranches ? (
                                            <Badge className="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                                              เข้าถึงทุกสาขา
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="text-xs">
                                              {accessibleBranches.length} สาขา
                                            </Badge>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Role Selector */}
                                    <div className="flex items-center gap-2 w-full md:w-auto">
                                      <Label className="text-sm text-slate-600 whitespace-nowrap">บทบาท:</Label>
                                      <Select
                                        value={role}
                                        onValueChange={(newRole) => handleRoleChange(user.id, newRole)}
                                      >
                                        <SelectTrigger className="w-full md:w-[180px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="owner">👑 เจ้าของหอพัก</SelectItem>
                                          <SelectItem value="manager">👔 ผู้จัดการ</SelectItem>
                                          <SelectItem value="employee">👤 พนักงาน</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {/* แสดงรายชื่อสาขาที่เข้าถึงได้ (สำหรับ non-owner/developer) */}
                                  {!canAccessAllBranches && accessibleBranches.length > 0 && (
                                    <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                                      <p className="text-xs font-semibold text-slate-700 mb-2">🏢 สาขาที่เข้าถึงได้:</p>
                                      <div className="flex flex-wrap gap-1.5">
                                        {accessibleBranches.map(branchId => (
                                          <Badge key={branchId} variant="outline" className="text-xs">
                                            {getBranchName(branchId)}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* ปุ่มจัดการ */}
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      type="button"
                                      onClick={() => handleOpenPermissionsDialog(user)}
                                      className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 flex-1 md:flex-none"
                                    >
                                      <SettingsIcon className="w-4 h-4 mr-2" />
                                      จัดการสิทธิ์ย่อย
                                    </Button>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      onClick={() => handleOpenBranchAccessDialog(user)}
                                      className="border-blue-600 text-blue-700 hover:bg-blue-50 flex-1 md:flex-none"
                                    >
                                      <Globe className="w-4 h-4 mr-2" />
                                      จัดการสาขา
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}

                      {users.filter(user => {
                        const role = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
                        if (userRole === 'owner' && role === 'developer') return false;
                        if (user.id === currentUser?.id) return false;
                        return true;
                      }).length === 0 && (
                          <div className="text-center py-8 text-slate-500">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>ไม่พบผู้ใช้งานที่สามารถจัดการสิทธิ์ได้</p>
                          </div>
                        )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>

          {/* Signature Drawing Dialog */}
          <Dialog open={showSignatureDialog} onOpenChange={setShowSignatureDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PenTool className="w-5 h-5 text-indigo-600" />
                  เซ็นลายเซ็นผู้รับเงิน
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4 border-2 border-slate-300" style={{ height: '300px' }}>
                  <SignaturePad ref={signaturePadRef} />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => signaturePadRef.current?.clear()}
                  >
                    ลบลายเซ็น
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowSignatureDialog(false)}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSaveSignature}
                    className="bg-gradient-to-r from-indigo-600 to-purple-600"
                    disabled={uploadingSignature}
                  >
                    {uploadingSignature ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        บันทึกลายเซ็น
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Permissions Dialog */}
          <Dialog open={showPermissionsDialog} onOpenChange={setShowPermissionsDialog}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-orange-600" />
                  จัดการสิทธิ์: {selectedUserForPermissions?.full_name}
                </DialogTitle>
                <p className="text-sm text-slate-600 mt-2">
                  เลือกสิทธิ์การเข้าถึงแต่ละฟังก์ชันสำหรับผู้ใช้คนนี้
                </p>
              </DialogHeader>

              {selectedUserForPermissions && (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>สิทธิ์ที่เลือก:</strong> {(userPermissions[selectedUserForPermissions.id] || []).length} รายการ
                    </p>
                  </div>

                  <div className="space-y-3">
                    {Object.entries(PERMISSION_CATEGORIES_DISPLAY).map(([categoryKey, category]) => {
                      const userId = selectedUserForPermissions.id;
                      const isExpanded = expandedCategories[categoryKey];
                      const currentPermissions = userPermissions[userId] || [];
                      const categoryPermissionIds = category.permissions.map(p => p.id);
                      const selectedInCategory = categoryPermissionIds.filter(p => currentPermissions.includes(p)).length;
                      const allSelected = selectedInCategory === categoryPermissionIds.length;

                      return (
                        <div key={categoryKey} className="border border-slate-200 rounded-lg">
                          <div
                            className="flex items-center justify-between p-3 bg-slate-50 cursor-pointer hover:bg-slate-100 rounded-t-lg"
                            onClick={() => toggleCategory(categoryKey)}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{category.icon}</span>
                              <span className="font-semibold text-slate-800">{category.title}</span>
                              <Badge variant="outline" className="text-xs">
                                {selectedInCategory}/{categoryPermissionIds.length}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant={allSelected ? "default" : "outline"}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  selectAllInCategory(userId, categoryKey);
                                }}
                                className="text-xs"
                              >
                                {allSelected ? '✓ ทั้งหมด' : 'เลือกทั้งหมด'}
                              </Button>
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="p-3 space-y-2 bg-white rounded-b-lg">
                              {category.permissions.map(permission => {
                                const isChecked = currentPermissions.includes(permission.id);

                                return (
                                  <label
                                    key={permission.id}
                                    className={`flex items-center gap-3 p-2 rounded cursor-pointer transition-colors ${
                                      isChecked ? 'bg-green-50 border border-green-200' : 'hover:bg-slate-50'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => togglePermission(userId, permission.id)}
                                      className="w-4 h-4 rounded"
                                    />
                                    <span className={`text-sm flex-1 ${isChecked ? 'font-semibold text-green-700' : 'text-slate-700'}`}>
                                      {permission.label}
                                    </span>
                                    {isChecked && <Check className="w-4 h-4 text-green-600" />}
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowPermissionsDialog(false)}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        handleSaveUserPermissions(selectedUserForPermissions.id);
                        setShowPermissionsDialog(false);
                      }}
                      className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
                      disabled={updateUserPermissionsMutation.isPending}
                    >
                      {updateUserPermissionsMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          บันทึกสิทธิ์
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Branch Access Dialog - ใหม่ */}
          <Dialog open={showBranchAccessDialog} onOpenChange={setShowBranchAccessDialog}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Globe className="w-6 h-6 text-blue-600" />
                  จัดการสาขาที่เข้าถึงได้: {selectedUserForBranches?.full_name}
                </DialogTitle>
                <p className="text-sm text-slate-600 mt-2">
                  เลือกสาขาที่ผู้ใช้สามารถเข้าถึงและจัดการได้
                </p>
              </DialogHeader>

              {selectedUserForBranches && (
                <div className="space-y-4">
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                    <p className="text-sm text-blue-800">
                      <strong>สาขาที่เลือก:</strong> {(userBranchAccess[selectedUserForBranches.id] || []).length} สาขา
                    </p>
                  </div>

                  {(() => {
                    // Developer เห็นทุกสาขา, คนอื่นเห็นเฉพาะสาขาที่ตัวเองมีสิทธิ์
                    const myAccessibleBranches = currentUser?.accessible_branches;
                    const isDeveloper = userRole === 'developer';
                    
                    const filteredBranches = isDeveloper
                      ? branches
                      : branches.filter(b => myAccessibleBranches && myAccessibleBranches.includes(b.id));

                    if (filteredBranches.length === 0) {
                      return (
                        <div className="text-center py-8 text-slate-500">
                          <Globe className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>ไม่มีสาขาที่คุณดูแล</p>
                        </div>
                      );
                    }

                    return (
                      <>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                          <p className="text-sm text-amber-700">
                            💡 หมายเหตุ: แสดงเฉพาะสาขาที่คุณมีสิทธิ์เข้าถึง ({filteredBranches.length} สาขา)
                          </p>
                        </div>
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                          {filteredBranches.map((branch) => {
                            const userId = selectedUserForBranches.id;
                            const currentBranches = userBranchAccess[userId] || [];
                            const isChecked = currentBranches.includes(branch.id);

                            return (
                              <label
                                key={branch.id}
                                className={`flex items-center gap-3 p-4 rounded-lg cursor-pointer transition-colors border-2 ${
                                  isChecked
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'hover:bg-slate-50 border-slate-200'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleBranchAccess(userId, branch.id)}
                                  className="w-5 h-5 rounded"
                                />
                                <div className="flex-1">
                                  <p className={`font-semibold ${isChecked ? 'text-blue-700' : 'text-slate-800'}`}>
                                    {branch.branch_name}
                                  </p>
                                  {branch.address && (
                                    <p className="text-xs text-slate-500 mt-1">{branch.address}</p>
                                  )}
                                </div>
                                {isChecked && <Check className="w-5 h-5 text-blue-600" />}
                              </label>
                            );
                          })}
                        </div>
                      </>
                    );
                  })()}

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowBranchAccessDialog(false)}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        handleSaveUserBranches(selectedUserForBranches.id);
                        setShowBranchAccessDialog(false);
                      }}
                      className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                      disabled={updateUserBranchesMutation.isPending}
                    >
                      {updateUserBranchesMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          บันทึก
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <AddEmployeeDialog
            isOpen={showAddEmployeeDialog}
            onClose={() => setShowAddEmployeeDialog(false)}
            onSuccess={() => {
              queryClient.invalidateQueries(['users']);
              toast.success('เพิ่มพนักงานใหม่สำเร็จ!');
            }}
          />

          {/* Facebook Page Selection Dialog */}
          <Dialog open={showPageSelectionDialog} onOpenChange={setShowPageSelectionDialog}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>เลือก Facebook Page</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {facebookPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => saveFacebookPageToken(page)}
                    className="w-full flex items-center gap-3 p-4 border-2 border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                  >
                    <Globe className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-slate-800">{page.name}</span>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}