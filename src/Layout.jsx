import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import BranchSelection from "./pages/BranchSelection";
import { differenceInDays, parseISO, startOfDay, format } from "date-fns";
import OnboardingTutorial from "./components/onboarding/OnboardingTutorial";
import NotificationsPanel from "./components/shared/NotificationsPanel";
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
        Clock,
        Trash2
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
      import {
        Popover,
        PopoverTrigger,
        PopoverContent,
      } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { Toaster, toast } from "sonner";



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
    requiredFeature: "accounting_view_all",
    hideOnMobile: true
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
    requiredFeature: "settings_view",
    hideOnMobile: true
  },
  {
    title: "ตั้งค่า",
    url: createPageUrl("Settings"),
    icon: Settings,
    requiredPermission: "settings_view",
    requiredFeature: "settings_view"
  },
  {
    title: "สร้างข้อมูลทดสอบ",
    url: "#create-test-data",
    icon: Database,
    requiredPermission: "settings_view",
    requiredFeature: "settings_view",
    isTrial: true
  },
  {
    title: "ลบข้อมูลทดสอบ",
    url: "#delete-test-data",
    icon: Trash2,
    requiredPermission: "settings_view",
    requiredFeature: "settings_view",
    isTrial: true
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
    title: "Webhook Logs",
    url: createPageUrl("WebhookLogs"),
    icon: Terminal,
    badge: "Dev",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
  },

  {
    title: "จัดการผู้ใช้และแพ็กเกจ",
    url: createPageUrl("UserBranchAccess"),
    icon: Users,
    badge: "Dev",
    showOnlyForDeveloper: true,
    requiredPermission: "settings_access_test_mode",
    requiredFeature: "settings_access_test_mode"
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
    title: "จัดการประกาศ",
    url: createPageUrl("BannerManagement"),
    icon: Megaphone,
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
  },
  {
    title: "หน้า Welcome (Landing)",
    url: createPageUrl("Welcome"),
    icon: Sparkles,
    badge: "Dev",
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

  // ⭐⭐⭐ Check if public page (variable only - return happens AFTER all hooks)
  const isPublicPage = currentPageName === 'Welcome' || 
                       currentPageName === 'Invoice' || 
                       currentPageName === 'Receipt' || 
                       currentPageName === 'PrintReceipts' || 
                       currentPageName === 'PublicInvoice' ||
                       currentPageName === 'PublicReceipt';

  // ⭐ State declarations - MUST be before any conditional returns
  const [selectedBranch, setSelectedBranch] = useState(() => {
    const branchId = localStorage.getItem('selected_branch_id');
    const branchName = localStorage.getItem('selected_branch_name');
    return (branchId && branchName) ? { id: branchId, branch_name: branchName } : null;
  });

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [retryCount, setRetryCount] = useState(0);
  const [isCreatingTrial, setIsCreatingTrial] = useState(false);
  const [onboardingMinimized, setOnboardingMinimized] = useState(false);
  const [showConnectedDataOptions, setShowConnectedDataOptions] = useState(false);

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

      // Check login status when SDK is ready
      window.FB.getLoginStatus(function(response) {});
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
        if (response.status === 'connected') {
          const accessToken = response.authResponse.accessToken;
          const userID = response.authResponse.userID;
          
          // Get user's Facebook Pages
          window.FB.api('/me/accounts', function(pagesResponse) {
            if (pagesResponse && pagesResponse.data) {
              const pages = pagesResponse.data;
              
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
          alert('กรุณาเข้าสู่ระบบ Facebook ก่อน');
        }
      });
    };
  }, []);

  // ⭐ Force light theme
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
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    enabled: isOnline && !isPublicPage, // ⚡ ไม่โหลดถ้าเป็น public page
    networkMode: 'online',
    onError: () => setRetryCount(prev => prev + 1),
    placeholderData: (previousData) => previousData,
    throwOnError: false,
  });

  // เช็คสิทธิ์กับ CRM (sync role ทุกครั้งที่ currentUser เปลี่ยน)
  const { data: crmAccess, isLoading: crmAccessLoading, error: crmAccessError, refetch: refetchCRMAccess } = useQuery({
    queryKey: ['crmAccess', currentUser?.email],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await base44.functions.invoke('checkCRMAccess', {}, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        const data = response.data;

        // 🔒 FAIL-CLOSED: ถ้ามี error/timeout → DENY
        if (!data || data.error || data.timeout) {
          console.error('❌ CRM check failed - DENYING access');
          const welcomeUrl = window.location.origin + '/Welcome';
          base44.auth.logout(welcomeUrl);
          return { hasAccess: false, reason: data?.error || 'CRM timeout' };
        }

        // ⚡ INSTANT LOGOUT: ถ้า deny → logout + redirect
        if (data.hasAccess === false && currentUser) {
          console.warn('🚫 CRM Access denied - Immediate logout:', currentUser.email);
          const welcomeUrl = window.location.origin + '/Welcome';
          base44.auth.logout(welcomeUrl);
          return data;
        }

        // ⭐ Sync role จาก CRM (ถ้ามี role ส่งกลับมา)
        if (data.hasAccess && data.role && currentUser) {
          // ⭐ Admin users ใน Base44 = developer เสมอ ไม่ sync จาก CRM
          if (currentUser.role === 'admin') {
            return data;
          }

          const currentRole = currentUser.custom_role || null;
          const crmRole = data.role?.trim();

          // ⭐ อัพเดทเฉพาะเมื่อ role ไม่ตรงกัน
          if (currentRole !== crmRole) {
            try {
              await base44.auth.updateMe({ custom_role: crmRole });
              await queryClient.invalidateQueries(['currentUser']);
              await new Promise(resolve => setTimeout(resolve, 500));
              window.location.reload();
            } catch (error) {
              console.error('❌ Role update failed:', error.message);
              console.error('Full error:', error);
            }
          }
        }

        return data;
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
          return { hasAccess: true, timeout: true, cached: true };
        }
        
        console.error('❌ CRM check error:', error);
        return { hasAccess: true, error: error.message, cached: true };
      }
    },
    enabled: !isLoading && !!currentUser?.email && isOnline && !isPublicPage,
    staleTime: 1 * 60 * 1000, // ⭐ Cache 1 นาที (ลดลงเพื่อให้ refetch บ่อยขึ้น)
    gcTime: 5 * 60 * 1000,
    refetchInterval: false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true, // ⭐ เปิด refetch เมื่อกลับมาที่หน้าต่าง
    refetchOnMount: true, // ⭐ เปิด refetch เมื่อ mount ใหม่
    refetchOnReconnect: true,
    retry: 1,
    throwOnError: false,
  });

  const { data: appSubscriptions = [] } = useQuery({
    queryKey: ['appSubscriptions', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const response = await base44.entities.AppSubscription.filter({ created_by: currentUser.email }, '-created_date', 1);
      return response || [];
    },
    enabled: !isLoading && !!currentUser && isOnline && !isPublicPage,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    throwOnError: false,
  });



  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      // 🔒 Multi-Tenancy: Filter branches by owner_id (เจ้าของสาขา)
      const response = await base44.entities.Branch.filter({ owner_id: currentUser.email }, '', 1000);
      return response || [];
    },
    enabled: !isLoading && !!currentUser && isOnline && !isPublicPage,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    networkMode: 'online',
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
    throwOnError: false,
  });

  const { data: configs = [], isLoading: configsLoading } = useQuery({
    queryKey: ['configs', selectedBranch?.id, currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      
      const role = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'developer' : 'employee');
      
      // 🔒 Multi-Tenancy: Developer can see all configs
      if (role === 'developer') {
        const allConfigs = await base44.entities.Config.list('', 1000);
        return allConfigs || [];
      }

      // 🔒 Multi-Tenancy: Non-developers only see:
      // 1. Global configs (no branch_id)
      // 2. Configs from their accessible branches
      const accessibleBranchIds = currentUser?.accessible_branches || [];
      
      // Filter client-side with safe fallback
      const allConfigs = await base44.entities.Config.list('', 1000);
      return (allConfigs || []).filter(c => 
        !c.branch_id || // Global configs
        accessibleBranchIds.includes(c.branch_id) // Only configs from accessible branches
      );
    },
    enabled: !isLoading && !!currentUser && isOnline && !isPublicPage,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
    throwOnError: false,
  });

  // ⭐ ดึงข้อมูลแพ็กเกจของเจ้าของสาขา
  const { data: branchOwnerStatus, isLoading: branchOwnerLoading } = useQuery({
    queryKey: ['branchOwnerStatus', selectedBranch?.id],
    queryFn: async () => {
      if (!selectedBranch?.id) return null;
      const response = await base44.functions.invoke('getBranchOwnerStatus', {
        branch_id: selectedBranch.id
      });
      return response.data;
    },
    enabled: !!selectedBranch && !!currentUser && isOnline,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    throwOnError: false,
    placeholderData: (previousData) => previousData, // ⭐ ใช้ cache เก่าขณะ refetch
  });

  const getConfigValue = (key, defaultValue = '') => {
    if (selectedBranch) {
      const branchConfig = configs.find(c => c.key === key && c.branch_id === selectedBranch.id);
      if (branchConfig && branchConfig.value && branchConfig.value.trim() !== '') {
        return branchConfig.value;
      }
    }
    const globalConfig = configs.find(c => c.key === key && !c.branch_id);
    return globalConfig ? globalConfig.value : defaultValue;
  };

  const buildingLogo = getConfigValue('building_logo', 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/58da6a306_DC4395DB-4B27-4859-85B3-4F2948654F9E.png');
  const buildingName = getConfigValue('building_name', 'หลังหอพัก');
  const appMode = getConfigValue('app_mode', 'single_tenant'); // ดึงค่า app_mode

  // ⭐ กำหนด userRole, userPermissions, userAccessibleBranches, canAccessBranch
  const userRole = (() => {
    // ⭐ Admin users = developer เสมอ (ไม่สนใจ custom_role)
    if (currentUser?.role === 'admin') {
      return 'developer';
    }
    
    let effectiveRole = currentUser?.custom_role;
    
    // ⭐ FIX: ใช้ crmAccess.role เป็น fallback ถ้า custom_role ยัง undefined
    if (!effectiveRole && crmAccess && !crmAccessLoading && crmAccess.role) {
      effectiveRole = crmAccess.role;
    }
    
    const role = effectiveRole || 'employee';
    return role;
  })();
  const userPermissions = currentUser?.permissions || [];
  
  // ⭐ แก้ไข: ไม่ใช้ || [] เพื่อให้แยก null/undefined จาก [] ได้
  const userAccessibleBranches = currentUser?.accessible_branches;

  // ถ้ามี accessible_branches set (ไม่ว่าจะ [] หรือมีค่า) ต้องเช็คว่าสาขาอยู่ในลิสต์หรือไม่
  // ถ้าเป็น null/undefined และเป็น developer ให้เข้าได้ทุกสาขา
  const hasAccessibleBranchesSet = userAccessibleBranches !== null && userAccessibleBranches !== undefined;

  // ⭐ Fallback: ถ้าไม่มี accessible_branches set เลย (null/undefined) 
  // ให้เข้าได้ทุกสาขาที่ตัวเองเป็น owner (ดูจาก owner_id หรือ created_by)
  const canAccessBranch = (() => {
    // Developer ที่ไม่มี accessible_branches set = เข้าได้ทุกสาขา
    if (userRole === 'developer' && !hasAccessibleBranchesSet) return true;

    // ถ้ามี accessible_branches set แล้ว ต้องเช็คว่าสาขาอยู่ในลิสต์หรือไม่
    if (hasAccessibleBranchesSet) {
      return selectedBranch && userAccessibleBranches && userAccessibleBranches.includes(selectedBranch.id);
    }

    // ⭐ ถ้าไม่มี accessible_branches set และไม่ใช่ developer
    // ให้เช็คว่าเป็น owner ของสาขาหรือไม่ (จาก owner_id หรือ created_by)
    if (!hasAccessibleBranchesSet && selectedBranch) {
      const branch = branches.find(b => b.id === selectedBranch.id);
      if (branch) {
        return branch.owner_id === currentUser?.email || 
               branch.created_by === currentUser?.email;
      }
    }

    return false;
  })();

  // ⭐ Feature access - Trial = full access, Active = full access, Owner = full access
  const hasFeature = (featureName) => {
    if (!currentUser) return false;
    
    // Developer = full access
    if (userRole === 'developer') return true;
    
    // Owner = full access (เจ้าของหอพัก)
    if (userRole === 'owner') return true;
    
    // Trial or Active = full access
    if (currentUser.plan_status === 'trial' || currentUser.plan_status === 'active') return true;
    
    return false;
  };


  // ⭐ Auto-sync role จาก CRM ถ้า custom_role = undefined
  useEffect(() => {
    const syncRoleIfNeeded = async () => {
      if (isLoading || !currentUser || isPublicPage) return;

      // ⭐ FORCE REFETCH: ถ้า custom_role = undefined ให้ refetch CRM
      if (!currentUser.custom_role && !crmAccessLoading) {
        try {
          await refetchCRMAccess();
        } catch (error) {
          console.error('❌ Failed to refetch CRM:', error);
        }
      }
    };

    syncRoleIfNeeded();
  }, [isLoading, currentUser?.id, currentUser?.custom_role, isPublicPage]);

  // ⭐ Auto-init trial สำหรับ Owner ที่ยังไม่มี plan_status
  useEffect(() => {
    const initTrialIfNeeded = async () => {
      if (isLoading || !currentUser) return;

      // เฉพาะ Owner ที่ยังไม่มี plan_status เลย (developer ไม่ต้อง init trial)
      if (userRole === 'owner' && !currentUser.plan_status && !isCreatingTrial) {
        setIsCreatingTrial(true);

        try {
          await base44.functions.invoke('initUserTrial');
          await queryClient.invalidateQueries(['currentUser']);
        } catch (error) {
          console.error('❌ สร้าง Trial ไม่สำเร็จ:', error);
        } finally {
          setIsCreatingTrial(false);
        }
      }
    };

    initTrialIfNeeded();
  }, [isLoading, currentUser?.id, currentUser?.plan_status, userRole]);

  // ⭐ User-centric subscription check (ใช้ที่ effect แล้ว - ไม่ต้องใช้ตัวแปร subscriptionCheck อีก)

  useEffect(() => {
    // ⭐ Redirect unauthenticated users to Welcome (even if there's an auth error)
    if (!isLoading && !currentUser && 
        currentPageName !== 'Welcome' &&
        currentPageName !== 'Invoice' &&
        currentPageName !== 'Receipt' &&
        currentPageName !== 'PrintReceipts' &&
        currentPageName !== 'PublicInvoice' &&
        currentPageName !== 'PublicReceipt') {
      navigate(createPageUrl('Welcome'), { replace: true });
      return;
    }

    // ⭐ Check subscription status and redirect
    if (!isLoading && currentUser) {
      // ⚡ รอให้สร้างแพ็กเกจทดลองเสร็จก่อน
      if (isCreatingTrial) return;

      // Skip check for developer and special pages
      if (userRole === 'developer') return;
      if (currentPageName === 'BranchSelection' ||
          currentPageName === 'BranchManagement' ||
          currentPageName === 'UserBranchAccess' ||
          currentPageName === 'AllBranchesDashboard' ||
          currentPageName === 'TrialExpiredPage' ||
          currentPageName === 'NoPackagePage' ||
          currentPageName === 'PackageSelection') return;

      // ⭐ FIX: รอ CRM check เสร็จก่อนถ้า custom_role ยัง undefined (ป้องกัน race condition)
      if (!currentUser.custom_role && crmAccessLoading) {
        return;
      }

      const planStatus = currentUser.plan_status;
      const trialEndsAt = currentUser.trial_ends_at;

      // ⭐ ถ้าไม่มี plan_status หรือ expired/cancelled → ไป NoPackagePage
      if (!planStatus || planStatus === 'expired' || planStatus === 'cancelled') {
        navigate(createPageUrl('NoPackagePage'), { replace: true });
        return;
      }

      // ⭐ ถ้า trial หมดอายุ → ไป TrialExpiredPage
      if (trialEndsAt && planStatus === 'trial') {
        try {
          const trialEndDate = parseISO(trialEndsAt);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const daysRemaining = differenceInDays(trialEndDate, today);

          if (daysRemaining < 0) {
            navigate(createPageUrl('TrialExpiredPage'), { replace: true });
          }
        } catch {}
      }
    }
  }, [isLoading, currentUser, navigate, currentPageName, error, crmAccessLoading]);

  useEffect(() => {
    if (!currentUser || isLoading || branchesLoading) return;

    // Pages that don't require a selected branch
    if (currentPageName === 'BranchSelection' || 
        currentPageName === 'AllBranchesDashboard' || 
        currentPageName === 'BranchManagement' ||
        currentPageName === 'Settings' ||
        currentPageName === 'ActivityLog' ||
        currentPageName === 'DataLists' ||
        currentPageName === 'UpdateMyBranches' ||
        currentPageName === 'UserBranchAccess' ||
        currentPageName === 'PublicInvoice' ||
        currentPageName === 'PublicReceipt' ||
        currentPageName === 'Invoice' ||
        currentPageName === 'Receipt' ||
        currentPageName === 'Welcome') {
      return;
    }

    // If user has a selected branch but no access to it, clear and redirect
    if (selectedBranch && !canAccessBranch) {
      localStorage.removeItem('selected_branch_id');
      localStorage.removeItem('selected_branch_name');
      setSelectedBranch(null);
      navigate(createPageUrl('BranchSelection'), { replace: true });
      return;
    }

    // If no branch is selected and there are branches available, redirect to branch selection
    if (!selectedBranch && branches.length > 0) {
      navigate(createPageUrl('BranchSelection'), { replace: true });
    }
  }, [currentUser?.id, selectedBranch?.id, canAccessBranch, isLoading, branchesLoading, currentPageName, branches.length, navigate, userRole]);

  const canAccessMenuItem = (item) => {
    if (!currentUser) return false;

    // ซ่อนเมนูที่มี hideInMultiTenant เมื่ออยู่ในโหมดหลายคน
    if (item.hideInMultiTenant && appMode === 'multi_tenant') {
      return false;
    }

    // ⭐ ซ่อนเมนูที่มี hideOnMobile บนมือถือ
    if (item.hideOnMobile && window.innerWidth < 768) {
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

  // Trial mutations
  const generateConnectedTestDataMutation = useMutation({
    mutationFn: async (count) => {
      const response = await base44.functions.invoke('generateConnectedTestData', {
        branch_id: selectedBranch?.id,
        count: count
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`✅ สร้างข้อมูลสำเร็จ!`);
      queryClient.invalidateQueries();
      setShowConnectedDataOptions(false);
    },
    onError: (error) => {
      toast.error(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  });

  const deleteTestDataMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('deleteTestDataForBranch', {
        branch_id: selectedBranch?.id
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`✅ ลบข้อมูลสำเร็จ!`);
      queryClient.invalidateQueries();
    },
    onError: (error) => {
      toast.error(`❌ เกิดข้อผิดพลาด: ${error.message}`);
    }
  });

  const visibleMenuItems = currentUser ? navigationItems.filter(item => {
    // Handle trial mode items specially
    if (item.isTrial) {
      return currentUser?.plan_status === 'trial';
    }
    return canAccessMenuItem(item);
  }) : [];
  // Admin items - show for both developer and owner
  const visibleAdminItems = currentUser && (userRole === 'developer' || userRole === 'owner') ? adminOnlyItems.filter(canAccessMenuItem) : [];

  // ⭐⭐⭐ CRITICAL: Early return for Public Pages - MUST come AFTER all hooks!
  if (isPublicPage) {
    return (
      <>
        <Toaster richColors position="top-center" />
        {children}
      </>
    );
  }

  // Don't apply subscription check to these pages (public or critical admin pages)
  // Developer สามารถเข้าถึงทุกหน้าได้แม้แพ็กเกจหมดอายุ
  const isDeveloper = userRole === 'developer';

  // ⭐ Developer เข้าถึงทุกหน้าได้โดยไม่ต้องเช็ค package - ไม่ return children เฉยๆ แต่ให้ไปแสดง sidebar ด้วย
  // แต่ไม่ redirect ไปหน้า package pages

  // หน้าที่ไม่ต้องมี sidebar - return children เลย
  if (currentPageName === 'TrialExpiredPage' ||
      currentPageName === 'NoPackagePage' ||
      currentPageName === 'PackageSelection' ||
      currentPageName === 'BranchSelection' ||
      currentPageName === 'BranchManagement') {
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

  // Render Welcome page for unauthenticated users (not network error)
  if (error && !isLoading && !currentUser) {
    const isNetworkError = error?.message?.includes('Network') || 
                          error?.message?.includes('fetch') ||
                          error?.code === 'ERR_NETWORK';

    // If not authenticated and not already on Welcome page, redirect to Welcome
    if (!isNetworkError && currentPageName !== 'Welcome') {
      navigate(createPageUrl('Welcome'), { replace: true });
      return null;
    }

    // If already on Welcome page, just render it without sidebar
    if (currentPageName === 'Welcome') {
      return (
        <>
          <Toaster richColors position="top-center" />
          {children}
        </>
      );
    }

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

  // 🔒 FAIL-CLOSED: ถ้า CRM deny → BLOCK ทันที (ไม่มี grace period)
  if (!isLoading && !crmAccessLoading && currentUser && 
      crmAccess && crmAccess.hasAccess === false &&
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

  // Render loading screen
  // ⭐ FIX: รอ CRM check เสร็จถ้า custom_role ยัง undefined
  const needsCRMRoleSync = !isLoading && !!currentUser && !currentUser.custom_role && crmAccessLoading;
  const shouldShowLoading = isLoading || branchesLoading || configsLoading || needsCRMRoleSync;

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

  // ⭐ User trial banner - แสดงของเจ้าของสาขา
  const renderSubscriptionBanner = () => {
    // ⚡ FIX: รอให้ branchOwnerStatus โหลดเสร็จก่อน (ถ้ามีการเปิด query)
    const isQueryEnabled = !!selectedBranch && !!currentUser && isOnline;
    const shouldWaitForBranchOwner = isQueryEnabled && branchOwnerLoading;
    
    // รอให้โหลดข้อมูลเสร็จก่อน
    if (isLoading || configsLoading || branchesLoading || !currentUser || shouldWaitForBranchOwner) {
      return null; // ⭐ ไม่แสดงอะไรเลยขณะโหลด (ป้องกัน flash)
    }

    // ⭐ ถ้ามีสาขาเลือก ให้ดู status ของเจ้าของสาขา, ถ้าไม่มีให้ดูของตัวเอง
    const planStatus = branchOwnerStatus?.plan_status || currentUser.plan_status || 'trial';
    const trialEndsAt = branchOwnerStatus?.trial_ends_at || currentUser.trial_ends_at;
    const isOwner = branchOwnerStatus?.is_owner !== false; // ถ้าไม่มีข้อมูล = ตัวเอง

    if (planStatus === 'trial' && trialEndsAt) {
      try {
        const trialEndDate = startOfDay(parseISO(trialEndsAt));
        const today = startOfDay(new Date());
        const daysRemaining = differenceInDays(trialEndDate, today);

        if (daysRemaining >= 0) {
        return (
        <button 
          onClick={() => navigate(createPageUrl('PackageSelection'))}
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 flex items-center justify-between hover:from-amber-600 hover:to-orange-600 transition-all"
        >
        <div className="flex items-center gap-3">
        <Crown className="w-5 h-5" />
        <div className="text-left">
          <p className="font-semibold text-sm">
            🎉 {isOwner ? 'กำลังทดลองใช้งาน' : `แพ็กเกจของ ${branchOwnerStatus?.owner_name || 'เจ้าของ'}`}
          </p>
          <p className="text-xs opacity-90">เหลืออีก {Math.max(0, daysRemaining)} วัน • คลิกเพื่อดูแพ็กเกจ</p>
        </div>
        </div>
        </button>
        );
        }
      } catch {}
    }

    if (planStatus === 'active') {
      const activeSub = appSubscriptions.find(s => s.status === 'active');
      if (activeSub && activeSub.subscription_end_date) {
        try {
          const endDate = startOfDay(parseISO(activeSub.subscription_end_date));
          const today = startOfDay(new Date());
          const daysLeft = differenceInDays(endDate, today);

          if (daysLeft >= 0 && daysLeft < 30) {
            return (
              <button 
                onClick={() => navigate(createPageUrl('PackageSelection'))}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-3 flex items-center justify-between hover:from-yellow-600 hover:to-orange-600 transition-all"
              >
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5" />
                  <div className="text-left">
                    <p className="font-semibold text-sm">
                      ⚠️ {isOwner ? 'แพ็กเกจใกล้หมดอายุ' : `แพ็กเกจของ ${branchOwnerStatus?.owner_name || 'เจ้าของ'} ใกล้หมด`}
                    </p>
                    <p className="text-xs opacity-90">เหลืออีก {daysLeft} วัน • คลิกเพื่อต่ออายุ</p>
                  </div>
                </div>
              </button>
            );
          }
        } catch {}
      }
    }

    return null;
  };

  // If no branch selected, redirect to BranchSelection (except special pages)
  if (!selectedBranch && currentPageName !== 'BranchSelection' && currentPageName !== 'BranchManagement') {
    return (
      <>
        <Toaster richColors position="top-center" />
        <BranchSelection />
      </>
    );
  }

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

  // ⭐ Normalize วันที่ด้วย startOfDay เพื่อให้คำนวณวันคงเหลือได้แม่นยำ (ไม่ขึ้นกับเวลาในวัน)
  const trialEndsAt = branchOwnerStatus?.trial_ends_at || currentUser.trial_ends_at;
  const planStatus = branchOwnerStatus?.plan_status || currentUser.plan_status || 'trial';

  if (planStatus === 'trial' && trialEndsAt) {
    try {
      const trialEndDate = startOfDay(parseISO(trialEndsAt));
      const today = startOfDay(new Date());
      const daysRemaining = differenceInDays(trialEndDate, today);
    } catch (error) {
      console.error('Error calculating trial days:', error);
    }
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
        <Sidebar collapsible="icon" className="border-r-0 bg-transparent flex-shrink-0 z-50 transition-all duration-300 ease-in-out" style={{ '--sidebar-width': '240px', '--sidebar-width-icon': '48px', 'width': '240px' }} data-state="expanded">
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
                    e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/58da6a306_DC4395DB-4B27-4859-85B3-4F2948654F9E.png';
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

                  // Trial mode items with popover
                  if (item.isTrial) {
                    if (item.title.includes('สร้าง')) {
                      return (
                        <SidebarMenuItem key={item.title}>
                          <Popover open={showConnectedDataOptions} onOpenChange={setShowConnectedDataOptions}>
                            <PopoverTrigger asChild>
                              <SidebarMenuButton
                                className="group hover:bg-gradient-to-r hover:from-green-50/80 hover:to-emerald-50/80 transition-all duration-200 rounded-2xl mb-1 cursor-pointer group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:pl-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                title={item.title}
                              >
                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                <span className="font-medium group-data-[collapsible=icon]:hidden truncate">{item.title}</span>
                              </SidebarMenuButton>
                            </PopoverTrigger>
                            <PopoverContent className="w-40 p-2" align="end">
                              <div className="space-y-2">
                                <p className="text-xs font-semibold text-slate-800 px-2">จำนวน</p>
                                <div className="flex flex-col gap-1.5">
                                  <Button
                                    onClick={() => {
                                      if (confirm('🔗 สร้าง 50 ห้อง?')) {
                                        generateConnectedTestDataMutation.mutate(50);
                                      }
                                    }}
                                    disabled={generateConnectedTestDataMutation.isPending}
                                    size="sm"
                                    className="w-full h-7 text-xs bg-blue-500 hover:bg-blue-600"
                                  >
                                    {generateConnectedTestDataMutation.isPending ? '...' : '50 ห้อง'}
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      if (confirm('🔗 สร้าง 100 ห้อง?')) {
                                        generateConnectedTestDataMutation.mutate(100);
                                      }
                                    }}
                                    disabled={generateConnectedTestDataMutation.isPending}
                                    size="sm"
                                    className="w-full h-7 text-xs bg-indigo-500 hover:bg-indigo-600"
                                  >
                                    {generateConnectedTestDataMutation.isPending ? '...' : '100 ห้อง'}
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </SidebarMenuItem>
                      );
                    } else if (item.title.includes('ลบ')) {
                      return (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton
                            onClick={() => {
                              if (confirm('🗑️ ลบข้อมูลทั้งหมด?')) {
                                deleteTestDataMutation.mutate();
                              }
                            }}
                            disabled={deleteTestDataMutation.isPending}
                            className="group hover:bg-gradient-to-r hover:from-red-50/80 hover:to-orange-50/80 transition-all duration-200 rounded-2xl mb-1 cursor-pointer group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:pl-3 bg-red-600 hover:bg-red-700 text-white"
                            title={item.title}
                          >
                            <item.icon className="w-5 h-5 flex-shrink-0" />
                            <span className="font-medium group-data-[collapsible=icon]:hidden truncate">{item.title}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    }
                  }

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

          {/* Desktop Notification Bell */}
          <div className="hidden md:block absolute top-4 right-6 z-40">
            {currentUser && <NotificationsPanel />}
          </div>

          {/* Subscription Status Banner */}
          {renderSubscriptionBanner()}

          <header className="relative z-30 bg-white/40 backdrop-blur-2xl border-b border-white/40 px-3 py-3 md:hidden shadow-sm flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger className="hover:bg-white/50 p-1.5 rounded-xl transition-all duration-300 z-40 flex-shrink-0" />
                <div className="flex items-center gap-1.5 min-w-0">
                  <img
                    src={buildingLogo}
                    alt={`${buildingName} Logo`}
                    className="w-6 h-6 object-contain flex-shrink-0"
                    onError={(e) => {
                      e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg';
                    }}
                  />
                  <div className="min-w-0">
                    <h1 className="text-sm font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent truncate">
                      {buildingName}
                    </h1>
                    {selectedBranch && (
                      <p className="text-[10px] text-slate-500 truncate">{selectedBranch.branch_name}</p>
                    )}
                  </div>
                </div>
              </div>
              {currentUser && <NotificationsPanel />}
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