import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import BranchSelection from "./pages/BranchSelection";
import { differenceInDays, parseISO, startOfDay, format } from "date-fns";
import OnboardingTutorial from "./components/onboarding/OnboardingTutorial";
import {
  LayoutDashboard,
  DoorOpen,
  Calendar,
  CreditCard,
  Users,
  Wrench,
  Settings,
  MessageSquare,
  TestTube,
  Megaphone,
  AlertTriangle,
  WifiOff,
  RefreshCw,
  Globe,
  ScrollText,
  Wallet,
  BarChart3,
  Database,
  Gauge,
  Package,
  Brain,
  List,
  Crown,
  Loader2,
  Shield,
  Terminal,
  Sparkles,
  Clock
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Toaster, toast } from "sonner";

// ฟังก์ชันเช็ค features จากชื่อฟีเจอร์
const checkFeatureAccess = (features, featureName) => {
  // If features list is empty or null, allow access (for backward compatibility or trial)
  if (!features || features.length === 0) return true;

  // Normalize features to strings only
  const normalizedFeatures = features.map(f => {
    if (typeof f === 'string') return f;
    if (f && typeof f === 'object' && typeof f.name === 'string') return f.name;
    return '';
  }).filter(f => f);

  const featureMap = {
    // Core features - ทุกแพ็กเกจต้องมี
    'dashboard_view': ['จัดการห้องพักไม่จำกัด', 'ระบบพื้นฐาน', 'Dashboard'],
    'rooms_view': ['จัดการห้องพักไม่จำกัด', 'ระบบพื้นฐาน', 'จัดการห้อง'],
    'tenants_view': ['จัดการผู้เช่าไม่จำกัด', 'ระบบพื้นฐาน', 'จัดการผู้เช่า'],
    
    // Billing features
    'payments_view': ['ระบบการชำระเงินอัตโนมัติ', 'การชำระเงิน'],
    'meter_readings_view': ['บันทึกมิเตอร์', 'ค่าน้ำค่าไฟ'],
    'expenses_view': ['ค่าใช้จ่าย', 'การเงิน'],
    
    // Contracts
    'contracts_view_monthly': ['สร้างสัญญาและใบเสร็จ', 'สัญญา'],
    'bookings_view_daily': ['การจองห้อง', 'ระบบจอง'],
    
    // Reports & Analytics
    'reports_view_all': ['รายงานทางการเงิน', 'รายงาน'],
    'accounting_view_all': ['ฐานข้อมูลบัญชี', 'บัญชี'],
    
    // Advanced features
    'maintenance_view': ['แจ้งซ่อมและบำรุงรักษา', 'ซ่อมบำรุง'],
    'announcements_send': ['การแจ้งเตือนอัตโนมัติ', 'ประกาศ'],
    
    // Premium features
    'ai_features': ['AI ผู้ช่วยอัจฉริยะ', 'AI', 'ปัญญาประดิษฐ์'],
    
    // Multi-branch
    'multi_branch': ['ระบบหลายสาขา', 'หลายสาขา'],
    
    // Settings
    'settings_view': ['ตั้งค่า', 'Settings'],
    // Developer features are not typically limited by subscription features but by user role/permission
    'settings_access_test_mode': ['Developer', 'เครื่องมือพัฒนา'], 
  };

  const requiredKeywords = featureMap[featureName] || [];
  
  // If no keywords are defined for the feature, it implies it's a basic feature or not controlled by subscription features.
  // In this context, we assume it's allowed if the feature name exists in the map, and we just need to verify keywords.
  if (requiredKeywords.length === 0) return true; 
  
  // Check if any of the subscription's features match any of the required keywords
  return normalizedFeatures.some(feature => 
    requiredKeywords.some(keyword => 
      feature.toLowerCase().includes(keyword.toLowerCase())
    )
  );
};

const TUTORIAL_STEPS = [
  { id: 1 },
  { id: 2 },
  { id: 3 },
  { id: 4 },
  { id: 5 }
];

const navigationItems = [
  {
    title: "ภาพรวมทั้งหมด",
    url: createPageUrl("AllBranchesDashboard"),
    icon: Globe,
    requiredPermission: "dashboard_view",
    requiredFeature: "multi_branch",
    badge: "ทุกสาขา",
    showOnlyForDeveloper: false, 
    hideInMultiTenant: false 
  },
  {
    title: "แดชบอร์ด",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
    requiredPermission: "dashboard_view",
    requiredFeature: "dashboard_view"
  },
  {
    title: "จัดการห้องพัก",
    url: createPageUrl("Rooms"),
    icon: DoorOpen,
    requiredPermission: "rooms_view",
    requiredFeature: "rooms_view"
  },
  {
    title: "การจองห้อง",
    url: createPageUrl("Bookings"),
    icon: Calendar,
    requiredPermission: "bookings_view_daily",
    requiredFeature: "bookings_view_daily"
  },
  {
    title: "การชำระเงิน",
    url: createPageUrl("Payments"),
    icon: CreditCard,
    requiredPermission: "payments_view",
    requiredFeature: "payments_view"
  },
  {
    title: "ผู้เช่า",
    url: createPageUrl("Tenants"),
    icon: Users,
    requiredPermission: "tenants_view",
    requiredFeature: "tenants_view"
  },

  {
    title: "บันทึกมิเตอร์",
    url: createPageUrl("MeterReadings"),
    icon: Gauge,
    requiredPermission: "meter_readings_view",
    requiredFeature: "meter_readings_view"
  },
  {
    title: "ค่าใช้จ่าย",
    url: createPageUrl("Expenses"),
    icon: Wallet,
    requiredPermission: "expenses_view",
    requiredFeature: "expenses_view"
  },
  {
    title: "แจ้งซ่อม",
    url: createPageUrl("Maintenance"),
    icon: Wrench,
    requiredPermission: "maintenance_view",
    requiredFeature: "maintenance_view"
  },
  {
    title: "จัดการพัสดุ",
    url: createPageUrl("Materials"),
    icon: Package,
    requiredPermission: "maintenance_view",
    requiredFeature: "maintenance_view"
  },
  {
    title: "รายงาน",
    url: createPageUrl("reports"),
    icon: BarChart3,
    requiredPermission: "reports_view_all",
    requiredFeature: "reports_view_all"
  },
  {
    title: "ฐานข้อมูลบัญชี",
    url: createPageUrl("AccountingData"),
    icon: Database,
    requiredPermission: "accounting_view_all",
    requiredFeature: "accounting_view_all"
  },
  {
    title: "ส่งข้อความประกาศ",
    url: createPageUrl("Announcements"),
    icon: Megaphone,
    requiredPermission: "announcements_send",
    requiredFeature: "announcements_send"
  },
  {
    title: "ประวัติการจัดการ",
    url: createPageUrl("ActivityLog"),
    icon: Shield,
    requiredPermission: "settings_view",
    requiredFeature: "settings_view"
  },
  {
    title: "ตั้งค่า",
    url: createPageUrl("Settings"),
    icon: Settings,
    requiredPermission: "settings_view",
    requiredFeature: "settings_view"
  },
];

const adminOnlyItems = [
  {
    title: "f12",
    url: createPageUrl("f12"),
    icon: Terminal,
    badge: "Dev",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  },
  {
    title: "ตั้งค่าระบบ",
    url: createPageUrl("PackageSettings"),
    icon: Crown,
    badge: "Dev",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  },
  {
    title: "จัดการผู้ใช้และแพ็กเกจ",
    url: createPageUrl("UserBranchAccess"),
    icon: Users,
    badge: "Admin",
    showOnlyForDeveloper: false,
    requiredPermission: null, // ไม่ต้องเช็คสิทธิ์ - หน้านี้จัดการเองภายใน
    requiredFeature: null
  },
  {
    title: "ดูข้อมูล Lists",
    url: createPageUrl("DataLists"),
    icon: List,
    badge: "Dev",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  },
  {
    title: "Archive ข้อมูล",
    url: createPageUrl("DataArchive"),
    icon: Database,
    badge: "Dev",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  },
  {
    title: "พัฒนา AI - วิเคราะห์การเงิน",
    url: createPageUrl("AIFinancialAnalysis"),
    icon: Brain,
    badge: "AI",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  },
  {
    title: "คู่มือ AI Analytics",
    url: createPageUrl("AIGuidelines"),
    icon: Brain,
    badge: "AI",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "ai_features"
  },
  {
    title: "ทดสอบ LINE",
    url: createPageUrl("TestLine"),
    icon: MessageSquare,
    badge: "Developer",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  },
  {
    title: "โหมดทดสอบระบบ",
    url: createPageUrl("TestingAdmin"),
    icon: TestTube,
    badge: "Developer",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  },
  {
    title: "ทดสอบส่งบิล",
    url: createPageUrl("TestInvoiceGeneration"),
    icon: CreditCard,
    badge: "Dev",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  },
  {
    title: "ตั้งค่า Cron Jobs",
    url: createPageUrl("CronJobSettings"),
    icon: Clock,
    badge: "Dev",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  },
  {
    title: "สร้างข้อมูลทดสอบแบบกำหนดเอง",
    url: createPageUrl("CustomTestDataGenerator"),
    icon: Database,
    badge: "Dev",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  },
  {
    title: "คู่มือ Developer",
    url: createPageUrl("DeveloperGuide"),
    icon: ScrollText,
    badge: "Developer",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  }
];

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const mainContentRef = useRef(null);
  const queryClient = useQueryClient();

  // Initialize Facebook SDK
  useEffect(() => {
    // Hardcode Facebook App ID - ไม่ต้องเรียก API
    const FACEBOOK_APP_ID = '1140191808185304';

    window.fbAsyncInit = function() {
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v18.0'
      });

      console.log('✅ Facebook SDK initialized with App ID:', FACEBOOK_APP_ID);

      // Check login status when SDK is ready
      window.FB.getLoginStatus(function(response) {
        console.log('Initial Facebook Status:', response);
      });
    };

    // Load Facebook SDK
    if (!document.getElementById('facebook-jssdk')) {
      const js = document.createElement('script');
      js.id = 'facebook-jssdk';
      js.src = 'https://connect.facebook.net/en_US/sdk.js';
      js.async = true;
      js.defer = true;
      js.crossOrigin = 'anonymous';
      document.body.appendChild(js);
    } else if (window.FB) {
      // SDK already loaded, re-init
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: 'v18.0'
      });
    }

    // Setup Facebook Login Status Callback
    window.checkLoginState = function() {
      window.FB.getLoginStatus(function(response) {
        console.log('Facebook Login Response:', response);
        if (response.status === 'connected') {
          const accessToken = response.authResponse.accessToken;
          const userID = response.authResponse.userID;
          
          // Get user's Facebook Pages
          window.FB.api('/me/accounts', function(pagesResponse) {
            if (pagesResponse && pagesResponse.data) {
              const pages = pagesResponse.data;
              console.log('Facebook Pages:', pages);
              
              if (pages.length === 0) {
                alert('ไม่พบ Facebook Page ที่คุณเป็นผู้ดูแล');
                return;
              }
              
              // Send pages info to parent window for processing
              window.postMessage({
                type: 'facebook_pages_loaded',
                pages: pages,
                userAccessToken: accessToken
              }, '*');
              
              alert(`พบ ${pages.length} Facebook Pages\nกำลังประมวลผล...`);
            } else {
              console.error('Error fetching pages:', pagesResponse);
              alert('ไม่สามารถดึงข้อมูล Pages ได้');
            }
          });
        } else {
          console.log('User not authenticated');
          alert('กรุณาเข้าสู่ระบบ Facebook ก่อน');
        }
      });
    };
  }, []);
  
  const [selectedBranch, setSelectedBranch] = useState(() => {
    const branchId = localStorage.getItem('selected_branch_id');
    const branchName = localStorage.getItem('selected_branch_name');
    return (branchId && branchName) ? { id: branchId, branch_name: branchName } : null;
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retryCount, setRetryCount] = useState(0);
  const [isCreatingTrial, setIsCreatingTrial] = useState(false);
  const [onboardingMinimized, setOnboardingMinimized] = useState(false);
  const [shownNotifications, setShownNotifications] = useState(() => {
    const stored = localStorage.getItem('shown_notifications');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'theme-dark', 'dark-mode');
    document.body.classList.remove('dark', 'theme-dark', 'dark-mode');
    localStorage.removeItem('theme');
    localStorage.removeItem('darkMode');
    localStorage.removeItem('dark-mode');
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.setAttribute('data-theme', 'light');

    // Suppress WebSocket errors that don't affect functionality
    const originalConsoleError = console.error;
    console.error = (...args) => {
      if (args[0]?.toString().includes('WebSocket')) {
        return;
      }
      originalConsoleError.apply(console, args);
    };

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  useEffect(() => {
    const syncBranchFromStorage = () => {
      const branchId = localStorage.getItem('selected_branch_id');
      const branchName = localStorage.getItem('selected_branch_name');
      
      const newBranch = (branchId && branchName) ? { id: branchId, branch_name: branchName } : null;
      
      setSelectedBranch(prev => {
        if (!prev && !newBranch) return prev;
        if (!prev && newBranch) return newBranch;
        if (prev && !newBranch) return newBranch;
        if (prev && newBranch && prev.id !== newBranch.id) return newBranch;
        return prev;
      });
    };

    syncBranchFromStorage();
    window.addEventListener('storage', syncBranchFromStorage);
    const interval = setInterval(syncBranchFromStorage, 500);

    return () => {
      window.removeEventListener('storage', syncBranchFromStorage);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setRetryCount(0);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOffline);
      window.removeEventListener('offline', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTo(0, 0);
    }
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const { data: currentUser, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      const user = await base44.auth.me();
      setRetryCount(0);
      return user;
    },
    retry: 0,
    retryDelay: 0,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: isOnline,
    networkMode: 'online',
    onError: () => setRetryCount(prev => prev + 1),
    placeholderData: (previousData) => previousData,
  });

  // เช็คสิทธิ์กับ CRM (เช็คทุก 2 นาที + logout อัตโนมัติถ้าไม่มีสิทธิ์)
  const { data: crmAccess, isLoading: crmAccessLoading, error: crmAccessError } = useQuery({
    queryKey: ['crmAccess', currentUser?.email],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

      try {
        const response = await base44.functions.invoke('checkCRMAccess', {}, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = response.data;

        // ⭐ ถ้าไม่มีสิทธิ์ = logout ทันที (ไม่เว้นแม้แต่ developer)
        if (data && data.hasAccess === false && currentUser) {
          console.warn('🚫 CRM Access denied - Logging out:', currentUser.email);
          setTimeout(() => {
            base44.auth.logout();
          }, 2000);
        }

        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.warn('⚠️ CRM check timeout - allowing access');
          return { hasAccess: true, timeout: true };
        }
        throw error;
      }
    },
    enabled: !isLoading && !!currentUser && isOnline,
    staleTime: 30 * 1000,
    refetchInterval: 2 * 60 * 1000,
    refetchIntervalInBackground: true,
    retry: 1,
    retryDelay: 1000,
    throwOnError: false,
  });

  const { data: appSubscriptions = [] } = useQuery({
    queryKey: ['appSubscriptions'],
    queryFn: () => base44.entities.AppSubscription.list('-created_date', 1),
    enabled: !isLoading && !!currentUser,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: branchPackages = [], isLoading: branchPackagesLoading, refetch: refetchBranchPackages } = useQuery({
    queryKey: ['branchPackages'],
    queryFn: () => base44.entities.BranchPackage.list('-created_date', 200),
    enabled: !isLoading && !!currentUser && isOnline,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    enabled: !isLoading && !!currentUser && isOnline,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000, // Changed gcTime to 2 hours
    retry: 0,
    retryDelay: 0,
    networkMode: 'online',
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    enabled: !isLoading && !!currentUser && isOnline,
    staleTime: 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000, // Changed gcTime to 2 hours
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  // ดึงข้อมูลสำหรับ toast notifications
  const { data: toastPayments = [] } = useQuery({
    queryKey: ['allPayments', 'toast', selectedBranch?.id],
    queryFn: async () => {
      if (!selectedBranch) return [];
      return await base44.entities.Payment.filter({ branch_id: selectedBranch.id });
    },
    enabled: !!selectedBranch && !!currentUser,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: toastMaintenance = [] } = useQuery({
    queryKey: ['allMaintenanceRequests', 'toast', selectedBranch?.id],
    queryFn: async () => {
      if (!selectedBranch) return [];
      return await base44.entities.MaintenanceRequest.filter({ branch_id: selectedBranch.id });
    },
    enabled: !!selectedBranch && !!currentUser,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: toastRooms = [] } = useQuery({
    queryKey: ['allRooms', 'toast', selectedBranch?.id],
    queryFn: async () => {
      if (!selectedBranch) return [];
      return await base44.entities.Room.filter({ branch_id: selectedBranch.id });
    },
    enabled: !!selectedBranch && !!currentUser,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: readNotifications = [] } = useQuery({
    queryKey: ['readNotifications', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const all = await base44.entities.Notification.list('-created_date', 500);
      return all.filter(n => n.user_email === currentUser.email && n.is_read);
    },
    enabled: !!currentUser?.email,
    staleTime: 30 * 1000,
  });

  // แสดง Toast Notifications เมื่อเข้ามาครั้งแรก
  useEffect(() => {
    if (!selectedBranch || !currentUser || !toastPayments || !toastMaintenance) return;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const notificationsToShow = [];

    // 1. การชำระเงินใหม่ล่าสุด (24 ชั่วโมง)
    const recentPaidPayments = toastPayments.filter(p => {
      if (p.status !== 'paid' || !p.payment_date) return false;
      try {
        const paymentDateTime = parseISO(p.payment_date);
        const hoursAgo = (new Date() - paymentDateTime) / (1000 * 60 * 60);
        return hoursAgo <= 24;
      } catch {
        return false;
      }
    });

    recentPaidPayments.slice(0, 5).forEach(payment => {
      const room = toastRooms.find(r => r.id === payment.room_id);
      const notifId = `paid-${payment.id}`;
      const isRead = readNotifications.some(n => n.notification_id === notifId);
      
      if (!shownNotifications.has(notifId) && !isRead) {
        notificationsToShow.push({
          id: notifId,
          type: 'success',
          title: `✅ มีการชำระเงินแล้ว - ห้อง ${room?.room_number || 'N/A'}`,
          description: `${payment.total_amount?.toLocaleString()} ฿ · ${format(parseISO(payment.payment_date), 'dd/MM/yyyy HH:mm')}`,
          duration: 6000,
        });
      }
    });

    // 2. เกินกำหนดชำระ
    const overduePayments = toastPayments.filter(p => {
      if (p.status === 'paid' || !p.due_date) return false;
      try {
        const dueDate = parseISO(p.due_date);
        const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        return now > dueDateStart;
      } catch {
        return false;
      }
    });

    overduePayments.slice(0, 5).forEach(payment => {
      const room = toastRooms.find(r => r.id === payment.room_id);
      const notifId = `overdue-${payment.id}`;
      const isRead = readNotifications.some(n => n.notification_id === notifId);
      
      if (!shownNotifications.has(notifId) && !isRead) {
        const daysOverdue = differenceInDays(now, parseISO(payment.due_date));
        notificationsToShow.push({
          id: notifId,
          type: 'error',
          title: `🔴 เกินกำหนดชำระ - ห้อง ${room?.room_number || 'N/A'}`,
          description: `${payment.total_amount?.toLocaleString()} ฿ · เกิน ${daysOverdue} วัน`,
          duration: 5000,
        });
      }
    });

    // 3. แจ้งซ่อมเร่งด่วน
    const urgentMaintenance = toastMaintenance.filter(m => 
      m.status === 'pending' && (m.priority === 'urgent' || m.priority === 'high')
    );

    urgentMaintenance.slice(0, 3).forEach(request => {
      const room = toastRooms.find(r => r.id === request.room_id);
      const notifId = `maintenance-${request.id}`;
      const isRead = readNotifications.some(n => n.notification_id === notifId);
      
      if (!shownNotifications.has(notifId) && !isRead) {
        notificationsToShow.push({
          id: notifId,
          type: 'warning',
          title: `${request.priority === 'urgent' ? '🚨 เร่งด่วนมาก' : '⚠️ เร่งด่วน'} - ห้อง ${room?.room_number || 'N/A'}`,
          description: request.title,
          duration: 5000,
        });
      }
    });

    // แสดง toast ทีละตัวด้วย delay
    notificationsToShow.forEach((notif, index) => {
      setTimeout(() => {
        const toastFn = notif.type === 'success' ? toast.success : 
                       notif.type === 'warning' ? toast.warning : toast.error;
        
        toastFn(notif.title, {
          description: notif.description,
          duration: notif.duration,
        });

        setShownNotifications(prev => {
          const updated = new Set([...prev, notif.id]);
          localStorage.setItem('shown_notifications', JSON.stringify([...updated]));
          return updated;
        });
      }, index * 800); // แสดงทีละตัว ห่างกัน 0.8 วินาที
    });

  }, [toastPayments, toastMaintenance, toastRooms, readNotifications, selectedBranch?.id, currentUser?.id]);

  const getConfigValue = (key, defaultValue = '') => {
    if (selectedBranch) {
      const branchConfig = configs.find(c => c.key === key && c.branch_id === selectedBranch.id);
      if (branchConfig) return branchConfig.value;
    }
    const globalConfig = configs.find(c => c.key === key && !c.branch_id);
    return globalConfig ? globalConfig.value : defaultValue;
  };

  const buildingLogo = getConfigValue('building_logo', 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg');
  const buildingName = getConfigValue('building_name', 'W RESIDENTS');
  const appMode = getConfigValue('app_mode', 'single_tenant'); // ดึงค่า app_mode

  // ⭐ กำหนด userRole, userPermissions, userAccessibleBranches, canAccessBranch
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
  const userPermissions = currentUser?.permissions || [];
  
  // ⭐ แก้ไข: ไม่ใช้ || [] เพื่อให้แยก null/undefined จาก [] ได้
  const userAccessibleBranches = currentUser?.accessible_branches;

  // ถ้ามี accessible_branches set (ไม่ว่าจะ [] หรือมีค่า) ต้องเช็คว่าสาขาอยู่ในลิสต์หรือไม่
  // ถ้าเป็น null/undefined และเป็น developer ให้เข้าได้ทุกสาขา
  const hasAccessibleBranchesSet = userAccessibleBranches !== null && userAccessibleBranches !== undefined;
  const canAccessBranch = (userRole === 'developer' && !hasAccessibleBranchesSet) ||
    (selectedBranch && userAccessibleBranches && userAccessibleBranches.includes(selectedBranch.id));

  // ฟังก์ชันเช็ค feature access - แก้ให้รองรับ multi_tenant
  const hasFeature = (featureName) => {
    if (!currentUser) return false;

    // ถ้าเป็น multi_tenant ให้ดูจาก BranchPackage ของสาขาที่เลือก
    if (appMode === 'multi_tenant' && selectedBranch) {
      const branchPackage = branchPackages.find(bp => 
        bp.branch_id === selectedBranch.id && bp.status === 'active'
      );
      
      // ถ้าไม่มี package = ไม่มีสิทธิ์
      if (!branchPackage) return false;
      
      const features = branchPackage.features || [];
      return checkFeatureAccess(features, featureName);
    }

    // ถ้าเป็น single_tenant ให้ดูจาก AppSubscription
    if (!appSubscriptions || appSubscriptions.length === 0) return false;

    const subscription = appSubscriptions.find(s => s.status === 'active') || appSubscriptions[0];
    if (!subscription) return false;

    // Trial period grants access to all features
    if (subscription.status === 'trial') return true;

    // If subscription is not active, access is denied
    if (subscription.status !== 'active') return false;
    
    const features = subscription.features || [];
    return checkFeatureAccess(features, featureName);
  };


  // ตรวจสอบสถานะ subscription และจัดการ trial อัตโนมัติ - แก้ให้รองรับ multi_tenant
  useEffect(() => {
    // Only proceed if user is loaded and not currently loading, and not on exempt pages
    if (!currentUser || isLoading || branchPackagesLoading || 
        currentPageName === 'PackageSelectionPage' || 
        currentPageName === 'RenewalPage' ||
        currentPageName === 'TrialExpiredPage' ||
        currentPageName === 'PackageExpiredPage') return;
    
    // ⭐ ถ้าอยู่หน้า BranchSelection และยังไม่ได้เลือกสาขา = ไม่ต้อง redirect
    if (currentPageName === 'BranchSelection' && !selectedBranch) return;

    const checkAndCreateTrial = async () => {
      const appModeConfig = configs.find(c => c.key === 'app_mode' && !c.branch_id);
      const currentAppMode = appModeConfig?.value || 'single_tenant';

      // ถ้าเป็น multi_tenant ให้สร้าง trial แยกตามสาขา
      if (currentAppMode === 'multi_tenant' && selectedBranch) {
        // เช็คว่าสาขานี้มี BranchPackage ที่ active อยู่หรือไม่
        const existingPackage = branchPackages.find(bp => 
          bp.branch_id === selectedBranch.id && bp.status === 'active'
        );
        
        // ⭐ เช็คเฉพาะ package ที่ active เท่านั้น (ไม่นับที่ cancelled/expired)
        const anyActivePackage = branchPackages.find(bp => 
          bp.branch_id === selectedBranch.id && bp.status === 'active'
        );

        if (!existingPackage && !anyActivePackage) {
          // ⭐⭐⭐ ไม่มี active package - สร้าง trial ใหม่อัตโนมัติ
          console.log('🚫 No active package for branch:', selectedBranch.id);
          console.log('🆕 Creating trial for branch:', selectedBranch.id);
            setIsCreatingTrial(true);
            try {
              const trialDaysConfig = configs.find(c => c.key === 'trial_days' && !c.branch_id);
              const trialDays = trialDaysConfig ? parseInt(trialDaysConfig.value) : 14;

              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const trialEndDate = new Date(today);
              trialEndDate.setDate(today.getDate() + trialDays);
              trialEndDate.setHours(23, 59, 59, 999);

              await base44.entities.BranchPackage.create({
                branch_id: selectedBranch.id,
                package_id: 'trial',
                package_name: 'Trial Package',
                owner_email: currentUser.email,
                subscription_start_date: today.toISOString().split('T')[0],
                subscription_end_date: trialEndDate.toISOString().split('T')[0],
                status: 'active',
                price_per_month: 0,
                features: [],
                notes: `Trial ${trialDays} วัน - สาขา ${selectedBranch.branch_name}`
              });

              console.log('✅ Created trial BranchPackage for branch:', selectedBranch.id);
              await refetchBranchPackages();
            } catch (error) {
              console.error('Failed to create trial BranchPackage:', error);
            } finally {
              setIsCreatingTrial(false);
            }
          }
          // ⭐⭐⭐ ไม่ auto-upgrade จาก trial เป็น paid package อีกต่อไป
        // แต่ละสาขาต้องซื้อ package เอง หรือถูกกำหนดโดย admin
      } else if (currentAppMode === 'single_tenant') {
        // Single tenant - ใช้ logic เดิม
        if (appSubscriptions.length === 0) {
          setIsCreatingTrial(true);
          try {
            const trialDaysConfig = configs.find(c => c.key === 'trial_days' && !c.branch_id);
            const trialDays = trialDaysConfig ? parseInt(trialDaysConfig.value) : 14;

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const trialEndDate = new Date(today);
            trialEndDate.setDate(today.getDate() + trialDays);
            trialEndDate.setHours(23, 59, 59, 999);

            await base44.entities.AppSubscription.create({
              app_name: 'Dormitory Management System',
              status: 'trial',
              trial_end_date: trialEndDate.toISOString().split('T')[0],
              subscription_start_date: today.toISOString().split('T')[0],
              subscription_end_date: trialEndDate.toISOString().split('T')[0],
              subscription_duration_months: 0,
              price_per_month: 0,
              total_price: 0,
              payment_status: 'pending',
              notes: `Trial ${trialDays} วัน`,
              features: []
            });

            await queryClient.invalidateQueries({ queryKey: ['appSubscriptions'] });
            console.log('✅ Created trial AppSubscription');
          } catch (error) {
            console.error('Failed to create trial subscription:', error);
          } finally {
            setIsCreatingTrial(false);
          }
        }
      }
    };

    checkAndCreateTrial();
  }, [currentUser, appSubscriptions, branchPackages, isLoading, branchPackagesLoading, currentPageName, queryClient, configs, selectedBranch, refetchBranchPackages]);

  // เช็คสถานะและ redirect - แก้ให้รองรับ multi_tenant
  const checkSubscriptionStatus = () => {
    // ⭐ Developer ไม่ต้อง redirect ไปหน้า package pages
    if (userRole === 'developer') return { shouldRedirect: false, status: 'developer' };
    
    // ⭐ ไม่ redirect เมื่ออยู่ในหน้าเหล่านี้ หรือเมื่อยังไม่ได้เลือกสาขา
    if (currentPageName === 'PackageSelectionPage' || 
        currentPageName === 'RenewalPage' || 
        currentPageName === 'TrialExpiredPage' || 
        currentPageName === 'PackageExpiredPage' ||
        currentPageName === 'BranchSelection' ||
        currentPageName === 'BranchManagement' ||
        currentPageName === 'Settings' ||
        currentPageName === 'UserBranchAccess' ||
        currentPageName === 'AllBranchesDashboard') {
      return { shouldRedirect: false };
    }
    
    // ⭐ ถ้ายังไม่ได้เลือกสาขา = ไม่ต้อง redirect
    if (!selectedBranch) {
      return { shouldRedirect: false, status: 'no_branch_selected' };
    }
    
    // ถ้าเป็น multi_tenant ให้ดูจาก BranchPackage
    if (appMode === 'multi_tenant' && selectedBranch) {
      // หา active package ที่ไม่ใช่ trial (ดูจาก package_id และ price) - ต้องมี paid package อย่างน้อย 1 บาท
      const activePaidPackage = branchPackages.find(bp => 
        bp.branch_id === selectedBranch.id && 
        bp.status === 'active' && 
        bp.package_id !== 'trial' && 
        bp.price_per_month > 0
      );

      // ถ้ามี paid package active → ใช้อันนั้น (ลำดับความสำคัญสูงสุด)
      if (activePaidPackage) {
        try {
          const endDate = parseISO(activePaidPackage.subscription_end_date);
          const daysRemaining = differenceInDays(startOfDay(endDate), startOfDay(new Date()));

          if (daysRemaining < 0) {
            return { shouldRedirect: true, redirectTo: 'PackageExpiredPage', status: 'expired', subscription: activePaidPackage };
          }

          return { shouldRedirect: false, status: 'active', daysRemaining, subscription: activePaidPackage };
        } catch {
          return { shouldRedirect: false, status: 'active', subscription: activePaidPackage };
        }
      }

      // ถ้าไม่มี paid package → หา trial package (ที่ active และยังไม่ถูก cancel)
      const trialPackage = branchPackages.find(bp => 
        bp.branch_id === selectedBranch.id && 
        bp.status === 'active' &&
        (bp.package_id === 'trial' || bp.price_per_month === 0 || !bp.price_per_month)
      );

      if (trialPackage) {
        try {
          const endDate = parseISO(trialPackage.subscription_end_date);
          const daysRemaining = differenceInDays(startOfDay(endDate), startOfDay(new Date()));

          if (daysRemaining < 0) {
            return { shouldRedirect: true, redirectTo: 'TrialExpiredPage', status: 'trial_expired', subscription: trialPackage };
          }

          return { shouldRedirect: false, status: 'trial', daysRemaining, subscription: trialPackage };
        } catch {
          return { shouldRedirect: false, status: 'trial', subscription: trialPackage };
        }
      }

      // ถ้าไม่มี package เลย = กำลังสร้าง trial อัตโนมัติ
      return { shouldRedirect: false, status: 'creating_trial', daysRemaining: 999, subscription: null };
    }

    // ถ้าเป็น single_tenant ให้ใช้ logic เดิม
    const activeSub = appSubscriptions.find(s => s.status === 'active') || appSubscriptions[0];
    if (!activeSub) return { shouldRedirect: false };

    // If expired, redirect to PackageExpiredPage
    if (activeSub.status === 'expired') {
      return { shouldRedirect: true, redirectTo: 'PackageExpiredPage', status: 'expired', subscription: activeSub };
    }

    // If trial, check expiry
    if (activeSub.status === 'trial' && activeSub.trial_end_date) {
      try {
        const trialEndDate = parseISO(activeSub.trial_end_date);
        const daysRemaining = differenceInDays(startOfDay(trialEndDate), startOfDay(new Date()));

        if (daysRemaining < 0) {
          return { shouldRedirect: true, redirectTo: 'TrialExpiredPage', status: 'trial_expired', subscription: activeSub };
        }

        return { shouldRedirect: false, status: 'trial', daysRemaining, subscription: activeSub };
      } catch {
        return { shouldRedirect: false };
      }
    }

    // If active, check expiry
    if (activeSub.status === 'active' && activeSub.subscription_end_date) {
      try {
        const endDate = parseISO(activeSub.subscription_end_date);
        const daysRemaining = differenceInDays(startOfDay(endDate), startOfDay(new Date()));

        if (daysRemaining < 0) {
          return { shouldRedirect: true, redirectTo: 'PackageExpiredPage', status: 'expired', subscription: activeSub };
        }

        return { shouldRedirect: false, status: 'active', daysRemaining, subscription: activeSub };
      } catch {
        return { shouldRedirect: false };
      }
    }
    
    if (activeSub.status === 'pending') {
        return { shouldRedirect: false, status: 'pending', subscription: activeSub };
    }

    // Default case, no redirect
    return { shouldRedirect: false, status: activeSub.status, subscription: activeSub };
  };

  const subscriptionCheck = checkSubscriptionStatus();

  useEffect(() => {
    // Redirect if subscription check indicates it and user/data is loaded
    // ⭐ Developer ไม่ต้อง redirect - ข้าม subscription check
    const currentUserRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
    if (subscriptionCheck.shouldRedirect && !isLoading && currentUser && currentUserRole !== 'developer') {
      const targetPage = subscriptionCheck.redirectTo || 'RenewalPage';
      navigate(createPageUrl(targetPage), { replace: true });
    }
  }, [subscriptionCheck.shouldRedirect, subscriptionCheck.redirectTo, isLoading, currentUser, navigate, currentPageName]);

  useEffect(() => {
    console.log('🔍 Layout Branch Check:', {
      currentPageName,
      hasUser: !!currentUser,
      isLoading,
      branchesLoading,
      selectedBranch: selectedBranch?.id,
      canAccessBranch,
      branchesCount: branches.length
    });

    if (!currentUser || isLoading || branchesLoading) return;

    // Pages that don't require a selected branch
    if (currentPageName === 'BranchSelection' || 
        currentPageName === 'AllBranchesDashboard' || 
        currentPageName === 'BranchManagement' ||
        currentPageName === 'Settings' ||
        currentPageName === 'ActivityLog' ||
        currentPageName === 'DataLists' ||
        currentPageName === 'PackageSettings' ||
        currentPageName === 'PackageSelectionPage' ||
        currentPageName === 'RenewalPage' ||
        currentPageName === 'UpdateMyBranches' ||
        currentPageName === 'UserBranchAccess') {
      console.log('✅ หน้านี้ไม่ต้องเลือกสาขา - อนุญาต');
      return;
    }

    // If user has a selected branch but no access to it, clear and redirect
    if (selectedBranch && !canAccessBranch) {
      console.log('🚫 ไม่มีสิทธิ์เข้าสาขานี้ - redirect');
      localStorage.removeItem('selected_branch_id');
      localStorage.removeItem('selected_branch_name');
      setSelectedBranch(null);
      navigate(createPageUrl('BranchSelection'), { replace: true });
      return;
    }

    // If no branch is selected and there are branches available, redirect to branch selection
    if (!selectedBranch && branches.length > 0) {
      console.log('⚠️ ไม่ได้เลือกสาขา - redirect ไป BranchSelection');
      navigate(createPageUrl('BranchSelection'), { replace: true });
    }
  }, [currentUser?.id, selectedBranch?.id, canAccessBranch, isLoading, branchesLoading, currentPageName, branches.length, navigate, userRole]);

  const canAccessMenuItem = (item) => {
    if (!currentUser) return false;

    // ซ่อนเมนูที่มี hideInMultiTenant เมื่ออยู่ในโหมดหลายคน
    if (item.hideInMultiTenant && appMode === 'multi_tenant') {
      return false;
    }

    // ⭐⭐⭐ เช็คเมนู "ภาพรวมทั้งหมด" - แสดงเฉพาะเมื่อมีมากกว่า 1 สาขา
    if (item.url === createPageUrl("AllBranchesDashboard")) {
      // ต้องรอให้ branches โหลดเสร็จก่อน
      if (branchesLoading) return false;

      const accessibleBranches = currentUser?.accessible_branches;

      // ถ้า set accessible_branches แล้ว = เช็คจำนวนสาขาที่มีสิทธิ์
      if (accessibleBranches !== null && accessibleBranches !== undefined) {
        return accessibleBranches.length > 1;
      }

      // ถ้าไม่ set accessible_branches และเป็น developer = ให้ดูจำนวนสาขาทั้งหมด
      if (userRole === 'developer') {
        return branches.length > 1;
      }

      return false;
    }

    if (userRole === 'developer') return true; // Developers always have full access

    // Enforce developer-only items
    if (item.showOnlyForDeveloper && userRole !== 'developer') return false;
    
    // Check Feature Access from Package first
    if (item.requiredFeature && !hasFeature(item.requiredFeature)) {
      return false; // If the required feature is not available in the subscription, deny access
    }
    
    // ⭐ เจ้าของหอพักเข้าถึงได้ทุกอย่างยกเว้น developer-only items
    if (userRole === 'owner') return true;
    
    // If no specific permission is required, grant access (after feature check)
    if (!item.requiredPermission) return true;
    
    // If user has no explicit permissions, check against basic role-based menus
    if (!userPermissions || userPermissions.length === 0) {
      const basicMenus = {
        manager: ['dashboard_view', 'rooms_view', 'tenants_view', 'payments_view'],
        employee: ['dashboard_view', 'rooms_view', 'tenants_view']
      };
      
      const allowedPermissions = basicMenus[userRole] || basicMenus['employee']; // Default to employee
      return allowedPermissions.includes(item.requiredPermission);
    }
    
    // Check against user's specific permissions
    return userPermissions.includes(item.requiredPermission);
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

  const visibleMenuItems = currentUser ? navigationItems.filter(canAccessMenuItem) : [];
  // Admin items are usually developer-only and have requiredPermission, so the hasFeature check within canAccessMenuItem handles them.
  const visibleAdminItems = currentUser && userRole === 'developer' ? adminOnlyItems.filter(canAccessMenuItem) : [];

  // Don't apply subscription check to these pages (public or critical admin pages)
  // Developer สามารถเข้าถึงทุกหน้าได้แม้แพ็กเกจหมดอายุ
  const isDeveloper = userRole === 'developer';

  // ⭐ Developer เข้าถึงทุกหน้าได้โดยไม่ต้องเช็ค package - ไม่ return children เฉยๆ แต่ให้ไปแสดง sidebar ด้วย
  // แต่ไม่ redirect ไปหน้า package pages

  // หน้าที่ไม่ต้องมี sidebar - return children เลย
  if (currentPageName === 'Invoice' || currentPageName === 'Receipt' || 
      currentPageName === 'PrintReceipts' || 
      currentPageName === 'RenewalPage' ||
      currentPageName === 'PackageSelectionPage' ||
      currentPageName === 'TrialExpiredPage' ||
      currentPageName === 'PackageExpiredPage' ||
      currentPageName === 'BranchSelection') {
    return (
      <>
        <Toaster richColors position="top-center" />
        {children}
      </>
    );
  }

  // Settings page - allow render with tutorial
  if (currentPageName === 'Settings') {
    // Continue to render normally with tutorial
  }

  // Render offline screen
  if (!isOnline) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-purple-300/20 to-pink-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tr from-blue-300/20 to-purple-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-md mx-4"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-red-400/30 via-orange-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse" />
            <div className="relative w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-2xl border border-white/50 shadow-2xl flex items-center justify-center">
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl" />
              <WifiOff className="w-20 h-20 text-red-500/80 relative z-10 animate-pulse" style={{ animationDuration: '2s' }} />
            </div>
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">ไม่มีการเชื่อมต่อ</h2>
            <p className="text-slate-600 leading-relaxed px-4">
              กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต<br/>
              และลองอีกครั้ง
            </p>

            <Button 
              onClick={() => window.location.reload()} 
              className="mt-6 bg-white/90 hover:bg-white text-slate-800 border-0 shadow-xl backdrop-blur-sm px-8 py-6 text-base font-semibold rounded-2xl"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              ลองอีกครั้ง
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render error handling screen for currentUser
  if (error && !isLoading && !currentUser) {
    const isNetworkError = error?.message?.includes('Network') || 
                          error?.message?.includes('fetch') ||
                          error?.code === 'ERR_NETWORK';
    
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-orange-300/20 to-red-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tr from-yellow-300/20 to-orange-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-md mx-4"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-400/30 via-red-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse" />
            <div className="relative w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-2xl border border-white/50 shadow-2xl flex items-center justify-center">
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl" />
              <AlertTriangle className="w-20 h-20 text-orange-500/80 relative z-10" />
            </div>
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">
              {isNetworkError ? 'เกิดข้อผิดพลาด' : 'เกิดข้อผิดพลาด'}
            </h2>
            <p className="text-slate-600 leading-relaxed px-4">
              {isNetworkError 
                ? 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้\nกรุณาลองใหม่อีกครั้ง' 
                : error.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ'}
            </p>

            <div className="flex gap-3 justify-center mt-6">
              <Button
                onClick={() => {
                  setRetryCount(0);
                  refetch();
                }}
                disabled={isFetching}
                className="bg-white/90 hover:bg-white text-slate-800 border-0 shadow-xl backdrop-blur-sm px-6 py-6 text-base font-semibold rounded-2xl"
              >
                {isFetching ? (
                  <>
                    <div className="w-5 h-5 border-2 border-slate-800 border-t-transparent rounded-full animate-spin mr-2" />
                    กำลังลอง...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-5 h-5 mr-2" />
                    ลองใหม่
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // แสดง loading screen ถ้ากำลังสร้าง trial
  if (isCreatingTrial) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-300/20 to-sky-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tr from-sky-300/20 to-cyan-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 via-sky-400/30 to-cyan-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="relative w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-2xl border border-white/50 shadow-2xl flex items-center justify-center">
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl animate-pulse" style={{ animationDuration: '2s' }} />
              
              <div className="absolute inset-12 rounded-full border-4 border-transparent border-t-blue-400/60 border-r-sky-400/60 animate-spin" style={{ animationDuration: '3s' }} />
              
              <Crown className="w-16 h-16 text-blue-600 relative z-10" />
            </div>
          </div>

          <div className="text-center space-y-3 max-w-xs mx-auto px-4">
            <h2 className="text-2xl font-bold text-slate-800">🎉 กำลังเตรียมระบบ</h2>
            <p className="text-slate-600 leading-relaxed">
              กำลังสร้างแพ็กเกจทดลองใช้งานให้คุณ<br/>
              กรุณารอสักครู่...
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // แสดงหน้าไม่มีสิทธิ์ถ้าเช็ค CRM แล้วไม่ผ่าน (บล็อกการเข้าถึงทั้งหมด)
  // ⭐ ถ้า error หรือ timeout = อนุญาตให้เข้าใช้งานต่อได้ (fail-open)
  // ⭐ ถ้า hasAccess === false ชัดเจน = deny access
  if (!isLoading && !crmAccessLoading && currentUser && 
      crmAccess && crmAccess.hasAccess === false && !crmAccess.timeout &&
      currentPageName !== 'BranchSelection') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-red-50 to-orange-50 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-red-300/20 to-orange-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tr from-orange-300/20 to-pink-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-md mx-4"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-red-400/30 via-orange-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse" />
            <div className="relative w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-2xl border border-white/50 shadow-2xl flex items-center justify-center">
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl" />
              <AlertTriangle className="w-20 h-20 text-red-500/80 relative z-10" />
            </div>
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">ไม่มีสิทธิ์เข้าใช้งาน</h2>
            <p className="text-slate-600 leading-relaxed px-4">
              อีเมล {currentUser.email} ไม่มีในระบบ<br/>
              กรุณาติดต่อผู้ดูแลระบบ
            </p>

            <Button
              onClick={() => base44.auth.logout()}
              className="mt-6 bg-white/90 hover:bg-white text-slate-800 border-0 shadow-xl backdrop-blur-sm px-8 py-6 text-base font-semibold rounded-2xl"
            >
              ออกจากระบบ
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Render loading screen - แต่ถ้า CRM check ใช้เวลานาน ให้ข้ามไปได้
  const isWaitingForCRM = crmAccessLoading && !crmAccess && !crmAccessError;
  const shouldShowLoading = (isLoading || branchesLoading || branchPackagesLoading || configsLoading) && !isWaitingForCRM;

  if (shouldShowLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-50 via-sky-50 to-cyan-50 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-blue-300/20 to-sky-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tr from-sky-300/20 to-cyan-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 via-sky-400/30 to-cyan-400/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '3s' }} />
            <div className="relative w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-2xl border border-white/50 shadow-2xl flex items-center justify-center">
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl animate-pulse" style={{ animationDuration: '2s' }} />
              
              <div className="absolute inset-12 rounded-full border-4 border-transparent border-t-blue-400/60 border-r-sky-400/60 animate-spin" style={{ animationDuration: '3s' }} />
              
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-500 to-sky-500 shadow-lg relative z-10" />
            </div>
          </div>

          <div className="text-center space-y-3 max-w-xs mx-auto px-4">
            <h2 className="text-2xl font-bold text-slate-800">กำลังโหลด</h2>
            <p className="text-slate-600 leading-relaxed">
              กรุณารอสักครู่<br/>
              ระบบกำลังเตรียมข้อมูลให้คุณ
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // แสดง Subscription Status Banner
  const renderSubscriptionBanner = () => {
    if (isLoading || branchPackagesLoading || configsLoading) return null;
    if (!subscriptionCheck.subscription && subscriptionCheck.status !== 'trial') return null;

    const { status, daysRemaining, subscription } = subscriptionCheck;

    // ถ้าเป็น multi_tenant และสาขานี้มี package active = แสดง package banner
    if (appMode === 'multi_tenant' && selectedBranch) {
      const branchPackage = branchPackages.find(bp => 
        bp.branch_id === selectedBranch.id && bp.status === 'active'
      );

      // มี package active - แสดงสถานะ package ของสาขา
      if (branchPackage) {
        const isTrial = branchPackage.package_id === 'trial' || 
                       branchPackage.price_per_month === 0 || 
                       !branchPackage.price_per_month;

        console.log('🔍 Banner Check:', {
          branchId: selectedBranch.id,
          packageId: branchPackage.package_id,
          pricePerMonth: branchPackage.price_per_month,
          isTrial,
          daysRemaining,
          subscriptionEndDate: branchPackage.subscription_end_date
        });

        // ✅ ถ้าเป็น trial package - แสดงเสมอ (ไม่เช็ค daysRemaining >= 0)
        if (isTrial) {
          const displayDays = daysRemaining !== null && daysRemaining !== undefined && daysRemaining < 999
            ? daysRemaining
            : null;

          return (
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Crown className="w-5 h-5" />
                <div>
                  <p className="font-semibold text-sm">🎉 กำลังทดลองใช้งาน</p>
                  {displayDays !== null && (
                    <p className="text-xs opacity-90">เหลืออีก {displayDays} วัน</p>
                  )}
                </div>
              </div>
              <Button
                onClick={() => navigate(createPageUrl('PackageSelectionPage'))}
                size="sm"
                className="bg-white text-orange-600 hover:bg-white/90"
              >
                อัปเกรดแพ็กเกจ
              </Button>
            </div>
          );
        }

        // ถ้าเป็น paid package และใกล้หมดอายุ (น้อยกว่า 30 วัน) - แสดงเฉพาะตอนใกล้หมดอายุ
        if (!isTrial && daysRemaining !== undefined && daysRemaining < 30 && daysRemaining >= 0) {
          const packageName = branchPackage.package_name || 'แพ็กเกจ';
          return (
            <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5" />
                <div>
                  <p className="font-semibold text-sm">⚠️ {packageName} ใกล้หมดอายุ</p>
                  <p className="text-xs opacity-90">เหลืออีก {daysRemaining} วัน</p>
                </div>
              </div>
              <Button
                onClick={() => navigate(createPageUrl('PackageSelectionPage'))}
                size="sm"
                className="bg-white text-orange-600 hover:bg-white/90"
              >
                ต่ออายุตอนนี้
              </Button>
            </div>
          );
        }

        // ไม่แสดงแถบสีเขียวสำหรับ paid package ปกติ
        return null;
      }

      // ถ้าไม่มี package = แสดง trial banner สำหรับสาขานี้
      if (!branchPackage) {
        return (
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="w-5 h-5" />
              <div>
                <p className="font-semibold text-sm">🎉 สาขานี้ยังไม่มีแพ็กเกจ</p>
                <p className="text-xs opacity-90">กรุณาซื้อแพ็กเกจเพื่อใช้งานเต็มรูปแบบ</p>
              </div>
            </div>
            <Button
              onClick={() => navigate(createPageUrl('PackageSelectionPage'))}
              size="sm"
              className="bg-white text-orange-600 hover:bg-white/90"
            >
              ซื้อแพ็กเกจ
            </Button>
          </div>
        );
      }
      
      return null;
    }

    // Single tenant mode - ใช้ logic เดิม
    if (status === 'trial') {
      return (
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">🎉 กำลังทดลองใช้งาน</p>
              {daysRemaining !== undefined && daysRemaining < 999 && (
                <p className="text-xs opacity-90">เหลืออีก {daysRemaining} วัน</p>
              )}
            </div>
          </div>
          <Button
            onClick={() => navigate(createPageUrl('PackageSelectionPage'))}
            size="sm"
            className="bg-white text-orange-600 hover:bg-white/90"
          >
            อัปเกรดแพ็กเกจ
          </Button>
        </div>
      );
    }

    if (status === 'pending') {
      return (
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 animate-pulse" />
            <div>
              <p className="font-semibold text-sm">⏳ รอตรวจสอบสลิป</p>
              <p className="text-xs opacity-90">ระบบกำลังตรวจสอบการชำระเงินของคุณ</p>
            </div>
          </div>
        </div>
      );
    }

    if (status === 'active' && daysRemaining !== undefined && daysRemaining < 30 && daysRemaining >= 0) {
      const packageName = subscription?.package_name || 'แพ็กเกจ';
      return (
        <div className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5" />
            <div>
              <p className="font-semibold text-sm">⚠️ {packageName} ใกล้หมดอายุ</p>
              <p className="text-xs opacity-90">เหลืออีก {daysRemaining} วัน</p>
              </div>
            </div>
            <Button
              onClick={() => navigate(createPageUrl('RenewalPage'))}
              size="sm"
              className="bg-white text-orange-600 hover:bg-white/90"
            >
              ต่ออายุตอนนี้
            </Button>
          </div>
        );
      }

    // ไม่แสดงแถบสีเขียวสำหรับ paid package ปกติใน single tenant

    return null;
  };

  // If no branch is selected, show branch selection page WITHOUT sidebar and subscription banner
  // ⭐ ยกเว้นหน้า BranchManagement ที่ไม่ต้องการ selectedBranch
  if ((!selectedBranch || currentPageName === 'BranchSelection') && currentPageName !== 'BranchManagement') {
    console.log('🔴 Layout กำลัง render BranchSelection แทน children', {
      currentPageName,
      selectedBranch: selectedBranch?.id,
      willRenderChildren: currentPageName === 'BranchSelection'
    });
    return (
      <>
        <Toaster richColors position="top-center" />
        {currentPageName === 'BranchSelection' ? children : <BranchSelection />}
      </>
    );
  }
  
  console.log('✅ Layout กำลัง render ปกติ', { currentPageName, selectedBranch: selectedBranch?.id });

  // If a branch is selected but user doesn't have access
  if (selectedBranch && !canAccessBranch) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-red-50 to-orange-50 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-gradient-to-br from-red-300/20 to-orange-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-gradient-to-tr from-orange-300/20 to-pink-300/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 max-w-md mx-4"
        >
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-br from-red-400/30 via-orange-400/30 to-pink-400/30 rounded-full blur-3xl animate-pulse" />
            <div className="relative w-64 h-64 mx-auto rounded-full bg-gradient-to-br from-white/40 via-white/30 to-white/20 backdrop-blur-2xl border border-white/50 shadow-2xl flex items-center justify-center">
              <div className="absolute inset-8 rounded-full bg-gradient-to-br from-white/30 to-white/10 backdrop-blur-xl" />
              <AlertTriangle className="w-20 h-20 text-red-500/80 relative z-10" />
            </div>
          </div>

          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-slate-800">ไม่มีสิทธิ์เข้าถึง</h2>
            <p className="text-slate-600 leading-relaxed px-4">
              คุณไม่มีสิทธิ์เข้าถึงสาขา<br/>
              "{selectedBranch.branch_name}"
            </p>

            <Button
              onClick={() => {
                localStorage.removeItem('selected_branch_id');
                localStorage.removeItem('selected_branch_name');
                setSelectedBranch(null);
                navigate(createPageUrl('BranchSelection'), { replace: true });
              }}
              className="mt-6 bg-white/90 hover:bg-white text-slate-800 border-0 shadow-xl backdrop-blur-sm px-8 py-6 text-base font-semibold rounded-2xl"
            >
              เลือกสาขาอื่น
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Check if onboarding tutorial should be shown
  const shouldShowOnboarding = currentUser && 
    currentUser.onboarding_mode_enabled === true &&
    !onboardingMinimized;

  return (
    <SidebarProvider>
      {shouldShowOnboarding && (
        <OnboardingTutorial 
          currentUser={currentUser}
          onComplete={() => {
            queryClient.invalidateQueries({ queryKey: ['currentUser'] });
          }}
          onSkip={() => {
            setOnboardingMinimized(true);
          }}
        />
      )}

      {/* Minimized Onboarding Indicator */}
      {onboardingMinimized && currentUser?.onboarding_mode_enabled && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={() => setOnboardingMinimized(false)}
          className="fixed bottom-6 right-6 z-[9998] bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-4 rounded-2xl shadow-2xl hover:shadow-3xl hover:scale-105 transition-all duration-300 flex items-center gap-3 pointer-events-auto"
        >
          <Sparkles className="w-5 h-5" />
          <div className="text-left">
            <p className="text-xs font-medium opacity-90">คู่มือการใช้งาน</p>
            <p className="text-sm font-bold">ขั้นตอนที่ {currentUser?.onboarding_current_step || 1}/{TUTORIAL_STEPS.length}</p>
          </div>
        </motion.button>
      )}

      <div className="min-h-screen flex w-full h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <Sidebar collapsible="icon" className="border-r-0 bg-transparent flex-shrink-0 z-50 transition-all duration-300 ease-in-out" style={{ '--sidebar-width': '240px', '--sidebar-width-icon': '56px' }}>
          <div className="absolute inset-0 bg-white/70 backdrop-blur-2xl border-r border-white/50" />
          
          <SidebarHeader className="relative z-10 border-b border-white/40 p-2 group-data-[collapsible=icon]:p-1 group-data-[collapsible=icon]:pl-2 bg-gradient-to-br from-white/30 to-white/20 flex-shrink-0">
            <div className="flex items-center justify-between gap-2 mb-1 group-data-[collapsible=icon]:mb-0 group-data-[collapsible=icon]:justify-start">
              <SidebarTrigger className="hover:bg-blue-100/50 p-1.5 rounded-xl transition-all duration-300 group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:p-1" />
            </div>

            <motion.div 
              className="flex flex-col items-center gap-1.5 group-data-[collapsible=icon]:items-start group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:ml-0"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <div className="relative w-10 h-10 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:ml-0.5 flex items-center justify-center transition-all flex-shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl blur-lg opacity-30" />
                <img
                  src={buildingLogo}
                  alt={`${buildingName} Logo`}
                  className="relative w-full h-full object-contain rounded-xl"
                  onError={(e) => {
                    e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
                  }}
                />
              </div>
              <div className="text-center group-data-[collapsible=icon]:hidden w-full">
                <h2 className="font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent text-sm truncate">
                  {buildingName}
                </h2>
                <div className="flex items-center justify-center gap-1.5 mt-0.5">
                  <p className="text-[10px] text-slate-600 truncate">
                    {selectedBranch ? selectedBranch.branch_name : 'ระบบจัดการที่พักอาศัย'}
                  </p>
                  {selectedBranch && (
                    <button
                      onClick={() => {
                        localStorage.removeItem('selected_branch_id');
                        localStorage.removeItem('selected_branch_name');
                        setSelectedBranch(null);
                        navigate(createPageUrl('BranchSelection'), { replace: true });
                      }}
                      className="p-0.5 hover:bg-blue-100/50 rounded-full transition-all group flex-shrink-0"
                      title="เปลี่ยนสาขา"
                    >
                      <RefreshCw className="w-2.5 h-2.5 text-blue-600 group-hover:rotate-180 transition-transform duration-300" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </SidebarHeader>

          <SidebarContent className="relative z-10 p-3 overflow-y-auto flex-1 group-data-[collapsible=icon]:overflow-y-auto group-data-[collapsible=icon]:px-1">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 py-2 group-data-[collapsible=icon]:hidden">
                เมนูหลัก
              </SidebarGroupLabel>
              <SidebarMenu>
                  {visibleMenuItems.map((item, index) => {
                    const isActive = location.pathname === item.url;
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton
                          onClick={() => navigate(item.url)}
                          className={`group hover:bg-gradient-to-r hover:from-blue-50/80 hover:to-purple-50/80 transition-all duration-200 rounded-2xl mb-1 cursor-pointer group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:pl-3 ${
                            isActive ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/30' : ''
                          }`}
                          title={item.title}
                        >
                          <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? '' : 'group-hover:scale-110 transition-transform'}`} />
                          <span className="font-medium group-data-[collapsible=icon]:hidden truncate">{item.title}</span>
                          {item.badge && (
                            <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                              isActive ? 'bg-white/20 text-white' : 'bg-gradient-to-r from-indigo-100 to-purple-100 text-indigo-700'
                            } group-data-[collapsible=icon]:hidden`}>
                              {item.badge}
                            </span>
                          )}
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroup>

            {visibleAdminItems.length > 0 && (
              <SidebarGroup className="mt-4">
                <SidebarGroupLabel className="text-xs font-semibold text-purple-500 uppercase tracking-wider px-3 py-2 group-data-[collapsible=icon]:hidden">
                  🔒 เมนูผู้พัฒนา
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleAdminItems.map((item, index) => {
                      const isActive = location.pathname === item.url;
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            onClick={() => navigate(item.url)}
                            className={`hover:bg-gradient-to-r hover:from-purple-50/80 hover:to-pink-50/80 transition-all duration-200 rounded-2xl mb-1 cursor-pointer group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:pl-3 ${
                              isActive ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30' : ''
                            }`}
                            title={item.title}
                          >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            <span className="font-medium group-data-[collapsible=icon]:hidden truncate">{item.title}</span>
                            {item.badge && (
                              <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                                isActive ? 'bg-white/20 text-white' : 'bg-gradient-to-r from-purple-100 to-pink-100 text-purple-700'
                              } group-data-[collapsible=icon]:hidden`}>
                                {item.badge}
                              </span>
                            )}
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                    );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            )}
          </SidebarContent>

          <SidebarFooter className="relative z-10 border-t border-white/40 p-4 group-data-[collapsible=icon]:p-2 bg-gradient-to-br from-white/30 to-white/20 flex-shrink-0">
            <div className="flex items-center gap-3 px-2 group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pl-1">
              <div className="relative flex-shrink-0">
                <div className={`absolute inset-0 bg-gradient-to-br ${getRoleBadge(userRole).color} rounded-full blur-md opacity-50`} />
                <div className={`relative w-10 h-10 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 bg-gradient-to-br ${getRoleBadge(userRole).color} rounded-full flex items-center justify-center shadow-lg`}>
                  <span className="text-white font-semibold text-sm group-data-[collapsible=icon]:text-xs">
                    {currentUser?.full_name?.charAt(0) || 'A'}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="font-medium text-slate-800 text-sm truncate">
                  {currentUser?.full_name || 'ผู้ดูแลระบบ'}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {getRoleBadge(userRole).label}
                </p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100 min-w-0 h-full relative overflow-hidden">
          <Toaster richColors position="top-center" />
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-400/10 to-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-purple-400/10 to-pink-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
          </div>

          {/* Subscription Status Banner */}
          {renderSubscriptionBanner()}

          <header className="relative z-30 bg-white/40 backdrop-blur-2xl border-b border-white/40 px-6 py-4 md:hidden shadow-sm flex-shrink-0">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-white/50 p-2 rounded-2xl transition-all duration-300 z-40" />
              <div className="flex items-center gap-2">
                <img
                  src={buildingLogo}
                  alt={`${buildingName} Logo`}
                  className="w-8 h-8 object-contain"
                  onError={(e) => {
                    e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
                  }}
                />
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                    {buildingName}
                  </h1>
                  {selectedBranch && (
                    <p className="text-xs text-slate-500">{selectedBranch.branch_name}</p>
                  )}
                </div>
            </div>
            </div>
          </header>

          <div 
            ref={mainContentRef}
            className="relative z-10 flex-1 overflow-y-auto overflow-x-hidden"
          >
            {children}
          </div>
        </main>
        </div>
        </SidebarProvider>
        );
        }