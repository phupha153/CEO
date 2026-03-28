import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Edit2, Trash2, Phone, Mail, User, Calendar, Home, AlertTriangle, FileText, DollarSign, Clock, Car, Users, Star, Search, X, Loader2, Upload, Sparkles, Wallet, Camera, LogOut, ScrollText, Eye, RefreshCw, Grid3x3, TableIcon, Download, CheckSquare, Square, XCircle, ChevronRight, Check, MessageSquare, CheckCircle2, RotateCcw, Facebook, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays, addMonths, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import * as XLSX from "xlsx";
import ExcelUploader from "../components/shared/ExcelUploader";
import RatingDialog from "../components/tenants/RatingDialog";
import RatingDisplay from "../components/tenants/RatingDisplay";
import TenantCard from "../components/tenants/TenantCard";
import PrepaidDialog from "../components/tenants/PrepaidDialog";
import LineConnectButton from "../components/tenants/LineConnectButton";
import PageHeader from "../components/shared/PageHeader";
import ScrollToTopButton from "../components/shared/ScrollToTopButton";
import { motion, AnimatePresence } from "framer-motion";
import AISearchBox from "../components/shared/AISearchBox";
import AIResultCard from "../components/shared/AIResultCard";
import AIActionConfirmation from "../components/shared/AIActionConfirmation";
import ExcelTable from "../components/tenants/ExcelTable";
import BulkTenantGenerator from "../components/tenants/BulkTenantGenerator";
import ContractsTab from "../components/tenants/ContractsTab";
import ContractActionsBar from "../components/tenants/ContractActionsBar";

export default function TenantsPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('tenants');
  const [showDialog, setShowDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showPrepaidDialog, setShowPrepaidDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [editingTenant, setEditingTenant] = useState(null);
  const [editingBooking, setEditingBooking] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [extractingData, setExtractingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [displayLimit, setDisplayLimit] = useState(50);
  const loadMoreRef = useRef(null);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiAbortController, setAiAbortController] = useState(null);
  const [aiAction, setAiAction] = useState(null);
  const [executingAction, setExecutingAction] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState(['active']);
  const [viewMode, setViewMode] = useState('card'); // 'card', 'table', 'room'
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTenants, setSelectedTenants] = useState([]);
  const [bulkAIQuery, setBulkAIQuery] = useState('');
  const [bulkAIResult, setBulkAIResult] = useState(null);
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);
  const [editingCells, setEditingCells] = useState({});
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [creatingRatings, setCreatingRatings] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showMoveOutDialog, setShowMoveOutDialog] = useState(false);
  const [moveOutData, setMoveOutData] = useState({
    returnDeposit: true,
    depositAmount: '',
    depositNotes: ''
  });
  const [showBulkTenantGenerator, setShowBulkTenantGenerator] = useState(false);
  const [generatingTenants, setGeneratingTenants] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState(null);
  const [longPressTarget, setLongPressTarget] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const searchQueryParam = params.get('search');
    if (searchQueryParam) {
      setSearchQuery(decodeURIComponent(searchQueryParam));
    }

    // Auto-open dialog if requested
    const openDialog = params.get('openDialog');
    if (openDialog === 'true') {
      setEditingTenant(null);
      resetForm();
      setShowDialog(true);
      // Clear URL param
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  const itemsPerPage = 50;

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    gender: '',
    age: '',
    line_id: '',
    national_id: '',
    email: '',
    address: '',
    emergency_contact: '',
    id_card_image: '',
    vehicles: [],
    notes: '',
    create_booking: false,
    room_id: '',
    check_in_date: '',
    deposit_amount: ''
  });

  const [newVehicle, setNewVehicle] = useState({
    type: 'car',
    plate: '',
    brand: ''
  });

  const [bookingFormData, setBookingFormData] = useState({
    room_id: '',
    check_in_date: '',
    check_out_date: '',
    deposit_amount: '',
    payment_timing: 'stay_first',
    notes: '',
    create_payment: true // default true สำหรับสร้างใหม่
  });

  const queryClient = useQueryClient();
  const selectedBranchId = localStorage.getItem('selected_branch_id');

  const { data: configs = [] } = useQuery({
    queryKey: ['configs', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // 🔒 SECURITY FIX: ดึงเฉพาะ configs ของสาขานี้ + global
      const [branchConfigs, globalConfigs] = await Promise.all([
        base44.entities.Config.filter({ branch_id: selectedBranchId }, '', 1000),
        base44.entities.Config.filter({ branch_id: null }, '', 1000)
      ]);
      return [...branchConfigs, ...globalConfigs];
    },
    enabled: !!selectedBranchId,
    staleTime: 60 * 60 * 1000,
  });

  useEffect(() => {
    if (selectedBranchId) {
      queryClient.invalidateQueries(['tenants', selectedBranchId]);
    }
  }, [selectedBranchId, queryClient]);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: Infinity, // Changed to Infinity as per outline
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      // 🔒 SECURITY FIX: ดึงเฉพาะสาขาที่เป็นเจ้าของ
      return await base44.entities.Branch.filter({ owner_id: currentUser.email }, '-created_date', 500);
    },
    enabled: !!currentUser,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  const selectedBranchName = useMemo(() => {
    return branches.find(branch => branch.id === selectedBranchId)?.branch_name || 'ไม่ระบุสาขา';
  }, [branches, selectedBranchId]);

  const userPermissions = currentUser?.permissions || [];
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'developer' : 'employee');
  const isDeveloper = userRole === 'developer';

  const canView = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('tenants_view');
  const canAdd = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('tenants_add');
  const canEdit = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('tenants_edit');
  const canDelete = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('tenants_delete');
  const canAddContract = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('contracts_add_monthly');
  const canEditContract = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('contracts_edit_monthly');
  const canDeleteContract = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('contracts_delete_monthly');
  const canEditDeposit = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('bookings_edit_deposit');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setDisplayLimit(50);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!searchQuery) {
      setAiResult(null);
    }
  }, [searchQuery]);

  useEffect(() => {
    setDisplayLimit(50);
  }, [selectedStatuses]);

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
  };


  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants', selectedBranchId, 'secure'],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Tenant',
        filters: { branch_id: selectedBranchId },
        limit: 10000
      });
      return response.data.data;
    },
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId, 'secure'],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Booking',
        filters: { branch_id: selectedBranchId },
        limit: 10000
      });
      return response.data.data;
    },
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId, 'secure'],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const response = await base44.functions.invoke('getSecureData', {
        entity: 'Room',
        filters: { branch_id: selectedBranchId },
        sort: '-room_number',
        limit: 10000
      });
      return response.data.data;
    },
    enabled: canView && !!selectedBranchId,
    retry: 2,
    staleTime: 1 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['payments', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.Payment.filter({ branch_id: selectedBranchId }); // Updated to use filter directly
    },
    enabled: canView && !!selectedBranchId,
    staleTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: ratings = [] } = useQuery({
    queryKey: ['tenantRatings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.TenantRating.filter({ branch_id: selectedBranchId }); // Updated to use filter directly
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: contracts = [] } = useQuery({
    queryKey: ['contracts', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // 🔒 SECURITY FIX: ใช้ filter ตรงๆ แทน list + client filter
      return await base44.entities.Contract.filter({ branch_id: selectedBranchId }, '-contract_date', 500);
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    placeholderData: (previousData) => previousData,
  });

  const { data: deletedTenants = [], refetch: refetchDeletedTenants } = useQuery({
    queryKey: ['deletedTenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      return await base44.entities.DeletedTenant.filter({ branch_id: selectedBranchId }, '-deleted_date', 100);
    },
    enabled: canView && !!selectedBranchId && showRestoreDialog,
    staleTime: 30 * 1000,
  });

  const restoreTenantMutation = useMutation({
    mutationFn: async (deletedRecord) => {
      // สร้างผู้เช่าใหม่จากข้อมูลเดิม
      const tenantData = deletedRecord.tenant_data;
      delete tenantData.id;
      delete tenantData.created_date;
      delete tenantData.updated_date;
      const newTenant = await base44.entities.Tenant.create(tenantData);
      // ลบ record ที่เก็บไว้
      await base44.entities.DeletedTenant.delete(deletedRecord.id);
      return newTenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants', selectedBranchId]);
      refetchDeletedTenants();
      toast.success('กู้คืนผู้เช่าสำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const handleAISearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('กรุณาใส่คำค้นหา');
      return;
    }

    const controller = new AbortController();
    setAiAbortController(controller);
    setAiSearching(true);
    setAiResult(null);
    setAiAction(null);

    try {
      const query = searchQuery.toLowerCase();

      // ตรวจสอบว่าเป็นคำสั่ง bulk update หรือไม่
      const isBulkCommand = query.includes('ทุกคน') || query.includes('ทั้งหมด') || query.includes('ผู้เช่าทุกคน');
      const hasException = query.includes('ยกเว้น') || query.includes('ไม่รวม');

      // หาชื่อผู้เช่าที่ต้องยกเว้น
      let exceptTenantNames = [];
      if (hasException) {
        const exceptMatch = query.match(/(?:ยกเว้น|ไม่รวม)\s*(.+?)(?:$|เป็น|status)/);
        if (exceptMatch) {
          exceptTenantNames = exceptMatch[1].split(/[,\s]+/).filter(n => n.trim());
        }
      }

      // ตรวจสอบว่าเป็นการแก้ไข field ไหน
      let fieldToUpdate = null;
      let fieldLabel = null;
      let newValue = null;

      if (query.includes('status') || query.includes('สถานะ')) {
        fieldToUpdate = 'status';
        fieldLabel = 'สถานะ';
        if (query.includes('active') || query.includes('อยู่')) {
          newValue = 'active';
        } else if (query.includes('moved_out') || query.includes('ย้ายออก')) {
          newValue = 'moved_out';
        }
      } else if (query.includes('เบอร์โทร') || query.includes('phone')) {
        fieldToUpdate = 'phone';
        fieldLabel = 'เบอร์โทร';
        const phoneMatch = query.match(/(?:เป็น|=)\s*(\d+)/);
        newValue = phoneMatch ? phoneMatch[1] : null;
      }

      // ถ้าเป็น bulk command และมีข้อมูลครบ
      const isBulkUpdateCommand = isBulkCommand && fieldToUpdate && newValue;

      if (isBulkUpdateCommand) {
        // หาผู้เช่าที่ต้องแก้ไข
        let tenantsToUpdate = tenants.filter(t => {
          // ยกเว้นตามชื่อ
          if (exceptTenantNames.length > 0) {
            return !exceptTenantNames.some(name =>
              t.full_name?.toLowerCase().includes(name.toLowerCase())
            );
          }
          return true;
        });

        if (tenantsToUpdate.length === 0) {
          toast.error('ไม่พบผู้เช่าที่ต้องแก้ไข');
          setAiSearching(false);
          return;
        }

        const bulkChanges = {};
        bulkChanges[fieldToUpdate] = newValue;

        const tenantsList = tenantsToUpdate.map(t => ({
          tenant_id: t.id,
          full_name: t.full_name,
          phone: t.phone,
          old_value: t[fieldToUpdate] !== undefined && t[fieldToUpdate] !== null ? t[fieldToUpdate] : 'ไม่ได้ตั้งค่า'
        }));

        const resultText = `พบผู้เช่าที่ต้องแก้ไข ${tenantsToUpdate.length} คน${exceptTenantNames.length > 0 ? ` (ยกเว้น ${exceptTenantNames.join(', ')})` : ''}\n\n📝 รายการที่จะเปลี่ยน: ${fieldLabel} → ${newValue}`;

        setAiResult({
          answer: resultText,
          action_type: 'bulk_update',
          tenants: tenantsList
        });

        setAiAction({
          action_type: 'bulk_update',
          tenant_ids: tenantsToUpdate.map(t => t.id),
          changes: bulkChanges,
          field_label: fieldLabel,
          new_value: newValue,
          tenants_list: tenantsList,
          except_names: exceptTenantNames,
          description: resultText
        });

        toast.info(`พบ ${tenantsToUpdate.length} คนที่ต้องแก้ไข กรุณายืนยัน`);
        setAiSearching(false);
        return;
      }

      // ถ้าไม่ใช่ bulk command ให้ใช้ AI วิเคราะห์แบบเดิม
      const tenantsData = tenants.map(t => ({
        id: t.id,
        full_name: t.full_name,
        phone: t.phone,
        email: t.email,
        line_id: t.line_id,
        status: t.status || 'active',
        vehicles: t.vehicles,
        notes: t.notes,
        prepaid_balance: t.prepaid_balance
      }));

      const bookingsData = bookings.map(b => ({
        id: b.id,
        tenant_id: b.tenant_id,
        room_id: b.room_id,
        check_in_date: b.check_in_date,
        check_out_date: b.check_out_date,
        status: b.status,
        booking_type: b.booking_type,
        notes: b.notes
      }));

      const paymentsData = payments.map(p => ({
        tenant_id: p.tenant_id,
        room_id: p.room_id,
        due_date: p.due_date,
        status: p.status,
        total_amount: p.total_amount
      }));

      const ratingsData = ratings.map(r => ({
        tenant_id: r.tenant_id,
        overall_rating_stars: r.overall_rating_stars,
        payment_score: r.payment_score,
        property_care_score: r.property_care_score,
        cohabitation_score: r.cohabitation_score,
        notes: r.notes
      }));

      // คำนวณคะแนนเฉลี่ยของแต่ละผู้เช่า
      const tenantsWithAvgRating = tenantsData.map(t => {
        const tenantRatings = ratingsData.filter(r => r.tenant_id === t.id);
        const avgRating = tenantRatings.length > 0
          ? tenantRatings.reduce((sum, r) => sum + r.overall_rating_stars, 0) / tenantRatings.length
          : null;
        return { ...t, avg_rating: avgRating };
      });

      // กรองเฉพาะผู้เช่าที่มีคะแนน (สำหรับคำถามเกี่ยวกับคะแนน)
      const tenantsWithRatingOnly = tenantsWithAvgRating.filter(t => t.avg_rating !== null);

      const promptText = `คุณเป็นผู้ช่วย AI ระบบจัดการหอพัก ตอบคำถามผู้ใช้ให้ตรงประเด็น

📌 คำถาม/คำสั่ง: "${searchQuery}"
📅 วันที่วันนี้: ${format(new Date(), 'yyyy-MM-dd')}

📋 ข้อมูลผู้เช่า (${tenantsWithAvgRating.length} คน):
${JSON.stringify(tenantsWithAvgRating.slice(0, 30), null, 2)}

📋 ผู้เช่าที่มีคะแนน (${tenantsWithRatingOnly.length} คน):
${JSON.stringify(tenantsWithRatingOnly.slice(0, 30), null, 2)}

📋 ข้อมูลสัญญาเช่า (${bookingsData.length} สัญญา):
${JSON.stringify(bookingsData.slice(0, 30), null, 2)}

📋 ข้อมูลการชำระเงิน (${paymentsData.length} รายการ):
${JSON.stringify(paymentsData.slice(0, 30), null, 2)}

🔍 **วิธีตอบ:**

1. **ถ้าเป็นคำถาม** (เช่น "ผู้เช่าที่ค้างชำระ", "ผู้เช่าห้อง 501", "ใครคะแนนดี"):
   - ตอบ answer ให้ตรงคำถาม เช่น "ผู้เช่าที่ค้างชำระ: สมชาย, สมหญิง"
   - action_type = "view"
   - tenants = รายการผู้เช่าที่เกี่ยวข้องพร้อม reason อธิบาย

2. **ถ้าเป็นคำสั่งแก้ไข** (เช่น "แก้เบอร์สมชาย เป็น 0812345678"):
   - action_type = "update"
   - tenant_id = ID ของผู้เช่า
   - changes = {"field": {"label": "ชื่อ", "old": "ค่าเดิม", "new": "ค่าใหม่"}}

⚠️ **สำคัญมาก:**
- ตอบ answer ให้ตรงคำถาม ห้ามตอบว่า "วิเคราะห์ข้อมูลเสร็จสิ้น" ถ้าเป็นคำถาม
- reason ใน tenants ต้องอธิบายว่าทำไมผู้เช่านี้ถึงอยู่ในรายการ
- ตอบภาษาไทย
- **เมื่อถามเรื่องคะแนน ความเสี่ยง หรือผู้เช่าที่คะแนนน้อย:** ให้ใช้ข้อมูลจาก "ผู้เช่าที่มีคะแนน" เท่านั้น (avg_rating ไม่เป็น null) ห้ามรวมผู้เช่าที่ยังไม่มีคะแนน`;

      const response = await Promise.race([
        base44.integrations.Core.InvokeLLM({
          prompt: promptText,
          response_json_schema: {
            type: "object",
            properties: {
              answer: { type: "string" },
              action_type: { type: "string", enum: ["view", "update", "create"] },
              tenant_id: { type: "string" },
              changes: {
                type: "object",
                additionalProperties: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    old: { type: "string" },
                    new: { type: "string" }
                  }
                }
              },
              data: { type: "object" },
              tenants: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    tenant_id: { type: "string" },
                    full_name: { type: "string" },
                    reason: { type: "string" }
                  },
                  required: ["tenant_id", "full_name"]
                }
              }
            },
            required: ["answer"]
          }
        }),
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new Error('ยกเลิกการค้นหา'));
          });
        })
      ]);

      if (!controller.signal.aborted) {
        setAiResult(response);

        if (response.action_type === 'update' || response.action_type === 'create') {
          setAiAction({
            action_type: response.action_type,
            tenant_id: response.tenant_id,
            changes: response.changes,
            data: response.data,
            description: response.answer
          });
          toast.info('กรุณายืนยันการดำเนินการ');
        } else {
          toast.success('วิเคราะห์สำเร็จ');
        }
      }
    } catch (error) {
      if (error.message === 'ยกเลิกการค้นหา') {
        toast.info('หยุดการค้นหาแล้ว');
      } else {
        console.error('AI Search Error:', error);
        toast.error('เกิดข้อผิดพลาดในการวิเคราะห์');
        setAiResult({
          answer: 'ไม่สามารถวิเคราะห์คำถามได้ในขณะนี้ โปรดลองอีกครั้ง',
          tenants: []
        });
      }
    } finally {
      setAiSearching(false);
      setAiAbortController(null);
    }
  };

  const handleStopAISearch = () => {
    if (aiAbortController) {
      aiAbortController.abort();
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      if (!canAdd) throw new Error('คุณไม่มีสิทธิ์เพิ่มผู้เช่า');
      const tenantData = {
        full_name: data.full_name,
        phone: data.phone,
        line_id: data.line_id,
        national_id: data.national_id,
        email: data.email,
        address: data.address,
        emergency_contact: data.emergency_contact,
        id_card_image: data.id_card_image,
        vehicles: data.vehicles,
        notes: data.notes,
        branch_id: selectedBranchId
      };

      const tenant = await base44.entities.Tenant.create(tenantData);

      if (data.create_booking && data.room_id) {
        if (!canAddContract) throw new Error('คุณไม่มีสิทธิ์เพิ่มสัญญาเช่า');
        const room = rooms.find(r => r.id === data.room_id);
        if (!room) throw new Error('ไม่พบห้องที่เลือก');

        const bookingData = {
          tenant_id: tenant.id,
          room_id: data.room_id,
          check_in_date: data.check_in_date,
          check_out_date: data.check_out_date,
          deposit_amount: data.deposit_amount ? parseFloat(data.deposit_amount) : 0,
          total_amount: room.price,
          booking_type: 'monthly',
          status: 'active',
          branch_id: selectedBranchId
        };

        const createdBooking = await base44.entities.Booking.create(bookingData);
        await base44.entities.Room.update(data.room_id, { status: 'occupied' });

        // สร้างบิลถ้ามีการเลือก
        if (data.create_invoice) {
          // ใช้รูปแบบการชำระจาก formData
          const paymentTiming = formData.payment_timing || 'stay_first';

          const checkInDate = parseISO(data.check_in_date);
          let dueDate;
          let paymentNotes;

          if (paymentTiming === 'pay_first') {
            // ชำระก่อนเข้าอยู่ = สร้างบิลเดือนแรกทันที
            dueDate = checkInDate;
            paymentNotes = `ค่าเช่าเดือนแรก - ${format(checkInDate, 'MMMM yyyy', { locale: th })}`;
          } else {
            // อยู่ก่อนค่อยชำระ = สร้างบิลเดือนถัดไป
            const nextMonthDate = addMonths(checkInDate, 1);
            dueDate = startOfMonth(nextMonthDate);
            paymentNotes = `ค่าเช่าสำหรับเดือน ${format(dueDate, 'MMMM yyyy', { locale: th })}`;
          }

          // คำนวณยอดชำระทั้งหมด (ถ้าเป็นผู้เช่าใหม่)
          let totalAmount = room.price;
          let otherAmount = 0;
          let notes = paymentNotes;

          if (data.is_new_tenant) {
            const advanceRent = data.advance_rent ? parseFloat(data.advance_rent) : room.price;
            const deposit = data.deposit_amount ? parseFloat(data.deposit_amount) : 0;
            const furniture = data.furniture_fee ? parseFloat(data.furniture_fee) : 0;
            const deduction = data.booking_deduction ? parseFloat(data.booking_deduction) : 0;

            totalAmount = advanceRent + deposit + furniture - deduction;
            otherAmount = deposit + furniture - deduction; // ส่วนต่างที่ไม่ใช่ค่าเช่า

            notes += `\n(ค่าเช่าล่วงหน้า: ${advanceRent}, ประกัน: ${deposit}, เฟอร์นิเจอร์: ${furniture}, หักจอง: ${deduction})`;
          }

          const paymentData = {
            booking_id: createdBooking.id,
            tenant_id: tenant.id,
            room_id: data.room_id,
            due_date: format(dueDate, 'yyyy-MM-dd'),
            rent_amount: data.is_new_tenant && data.advance_rent ? parseFloat(data.advance_rent) : room.price,
            water_amount: 0,
            electricity_amount: 0,
            internet_amount: 0,
            other_amount: otherAmount,
            total_amount: totalAmount,
            status: 'pending',
            payment_method: 'transfer',
            notes: notes,
            branch_id: selectedBranchId
          };

          await base44.entities.Payment.create(paymentData);
        }
      }
      return tenant;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries(['tenants', selectedBranchId]);
      if (variables.create_booking) {
        queryClient.invalidateQueries(['bookings', selectedBranchId]);
        queryClient.invalidateQueries(['rooms', selectedBranchId]);
        queryClient.invalidateQueries(['payments', selectedBranchId]);
      }
      setShowDialog(false);
      resetForm();
      toast.success(variables.create_booking ? 'เพิ่มผู้เช่าและสัญญาเช่าสำเร็จ' : 'เพิ่มผู้เช่าสำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (!canEdit) throw new Error('คุณไม่มีสิทธิ์แก้ไขข้อมูลผู้เช่า');

      // ป้องกันการลบข้อมูล LINE ที่ลงทะเบียนไว้แล้ว
      const existingTenant = tenants.find(t => t.id === id);
      const preservedData = {
        ...data,
        line_user_id: existingTenant?.line_user_id || data.line_user_id
      };

      return base44.entities.Tenant.update(id, preservedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants', selectedBranchId]);
      setShowDialog(false);
      setShowDetailDialog(false);
      resetForm();
      toast.success('อัปเดตข้อมูลสำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      if (!canDelete) throw new Error('คุณไม่มีสิทธิ์ลบผู้เช่า');

      // 0. บันทึกข้อมูลผู้เช่าก่อนลบ (สำหรับกู้คืน)
      const tenantToDelete = tenants.find(t => t.id === id);
      if (tenantToDelete) {
        await base44.entities.DeletedTenant.create({
          original_id: id,
          branch_id: selectedBranchId,
          tenant_data: tenantToDelete,
          deleted_by: currentUser?.email || 'unknown',
          deleted_date: new Date().toISOString()
        });
      }

      // 1. Delete all payments for this tenant
      try {
        const tenantPayments = await base44.entities.Payment.filter({ tenant_id: id });
        if (tenantPayments && tenantPayments.length > 0) {
          for (const payment of tenantPayments) {
            await base44.entities.Payment.delete(payment.id);
          }
        }
      } catch (e) {
        console.warn(`Could not delete payments for tenant ${id}: ${e.message}`);
      }

      // 2. Delete all contracts for this tenant
      try {
        const tenantContracts = await base44.entities.Contract.filter({ tenant_id: id });
        if (tenantContracts && tenantContracts.length > 0) {
          for (const contract of tenantContracts) {
            await base44.entities.Contract.delete(contract.id);
          }
        }
      } catch (e) {
        console.warn(`Could not delete contracts for tenant ${id}: ${e.message}`);
      }

      // 3. Find and delete all bookings for the tenant, and update room status
      const tenantBookings = await base44.entities.Booking.filter({ tenant_id: id });
      if (tenantBookings && tenantBookings.length > 0) {
        for (const booking of tenantBookings) {
          if (booking.room_id && booking.status === 'active') {
            try {
              await base44.entities.Room.update(booking.room_id, { status: 'available' });
            } catch (e) {
              console.warn(`Could not update room ${booking.room_id} status: ${e.message}`);
            }
          }
          await base44.entities.Booking.delete(booking.id);
        }
      }

      // 4. Delete ratings
      const tenantRatings = await base44.entities.TenantRating.filter({ tenant_id: id });
      if (tenantRatings && tenantRatings.length > 0) {
        for (const rating of tenantRatings) {
          await base44.entities.TenantRating.delete(rating.id);
        }
      }

      // 5. Finally, delete the tenant
      return await base44.entities.Tenant.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['bookings', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['rooms', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['tenantRatings', selectedBranchId] });
      setShowDetailDialog(false);
      setSelectedTenant(null);
      toast.success('ลบผู้เช่าและข้อมูลที่เกี่ยวข้องทั้งหมดเรียบร้อย');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการลบ');
    }
  });

  const deleteBookingMutation = useMutation({
    mutationFn: async (booking) => {
      if (!canDeleteContract) throw new Error('คุณไม่มีสิทธิ์ลบสัญญาเช่า');
      await base44.entities.Booking.delete(booking.id);
      await base44.entities.Room.update(booking.room_id, { status: 'available' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      queryClient.invalidateQueries(['rooms', selectedBranchId]);
      queryClient.invalidateQueries(['payments', selectedBranchId]);
      toast.success('ลบสัญญาเช่าสำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const expireBookingMutation = useMutation({
    mutationFn: async (booking) => {
        if (!canEditContract) throw new Error('คุณไม่มีสิทธิ์แก้ไขสัญญาเช่า');
        
        // 1. Update Booking status to 'completed'
        await base44.entities.Booking.update(booking.id, { status: 'completed' });
        
        // 2. Update Room status to 'available'
        if(booking.room_id) {
            await base44.entities.Room.update(booking.room_id, { status: 'available' });
        }
        
        return booking;
    },
    onSuccess: (booking) => {
        queryClient.invalidateQueries(['bookings', selectedBranchId]);
        queryClient.invalidateQueries(['rooms', selectedBranchId]);
        toast.success(`สัญญาเช่าห้อง ${getRoomInfo(booking.room_id)?.room_number} สิ้นสุดลงแล้ว`);
    },
    onError: (error) => {
        toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const createBookingMutation = useMutation({
    mutationFn: async (data) => {
      if (!canAddContract) throw new Error('คุณไม่มีสิทธิ์เพิ่มสัญญาเช่า');
      const room = rooms.find(r => r.id === data.room_id);
      if (!room) throw new Error('ไม่พบห้องที่เลือก');

      // ⭐ เช็คว่ามี booking active สำหรับผู้เช่าคนนี้ในห้องนี้อยู่แล้วหรือไม่
      // และต้องเช็คว่าสัญญานั้นยังไม่หมดอายุด้วย (ถ้าหมดอายุแล้วให้เพิ่มได้)
      const existingBooking = bookings.find(
        b => b.room_id === data.room_id &&
        b.tenant_id === data.tenant_id &&
        b.status === 'active'
      );

      if (existingBooking) {
        // ⭐ เช็คว่าสัญญาเดิมหมดอายุหรือยัง
        const isExpired = existingBooking.check_out_date && 
          differenceInDays(parseISO(existingBooking.check_out_date), new Date()) < 0;
        
        if (!isExpired) {
          throw new Error('มีสัญญาเช่าสำหรับห้องและผู้เช่านี้อยู่แล้ว (ยังไม่หมดอายุ)');
        }
        
        // ⭐ ถ้าสัญญาเดิมหมดอายุแล้ว ให้เปลี่ยนสถานะเป็น completed ก่อน
        await base44.entities.Booking.update(existingBooking.id, { status: 'completed' });
      }

      const bookingDataWithBranch = { ...data, branch_id: selectedBranchId };
      delete bookingDataWithBranch.create_payment; // ลบ field ที่ไม่ต้องการบันทึก
      const createdBooking = await base44.entities.Booking.create(bookingDataWithBranch);
      await base44.entities.Room.update(data.room_id, { status: 'occupied' });

      // ⭐ สร้างบิลเฉพาะเมื่อ create_payment = true
      if (data.create_payment) {
        // ใช้รูปแบบการชำระจาก booking form
        const paymentTiming = data.payment_timing || 'stay_first';

        const checkInDate = parseISO(data.check_in_date);
        let dueDate;
        let paymentNotes;

        if (paymentTiming === 'pay_first') {
          // ชำระก่อนเข้าอยู่ = สร้างบิลเดือนแรกทันที
          dueDate = checkInDate;
          paymentNotes = `ค่าเช่าเดือนแรก - ${format(checkInDate, 'MMMM yyyy', { locale: th })}`;
        } else {
          // อยู่ก่อนค่อยชำระ = สร้างบิลเดือนถัดไป
          const nextMonthDate = addMonths(checkInDate, 1);
          dueDate = startOfMonth(nextMonthDate);
          paymentNotes = `ค่าเช่าสำหรับเดือน ${format(dueDate, 'MMMM yyyy', { locale: th })}`;
        }

        const paymentData = {
          booking_id: createdBooking.id,
          tenant_id: data.tenant_id,
          room_id: data.room_id,
          due_date: format(dueDate, 'yyyy-MM-dd'),
          rent_amount: room.price,
          water_amount: 0,
          electricity_amount: 0,
          internet_amount: 0,
          other_amount: 0,
          total_amount: room.price,
          status: 'pending',
          payment_method: 'transfer',
          notes: paymentNotes,
          branch_id: selectedBranchId
        };

        await base44.entities.Payment.create(paymentData);
      }
      return createdBooking;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      queryClient.invalidateQueries(['rooms', selectedBranchId]);
      queryClient.invalidateQueries(['payments', selectedBranchId]);
      setShowBookingDialog(false);
      setShowDetailDialog(false);
      resetBookingForm();
      toast.success(variables.create_payment ? 'สร้างสัญญาเช่าและบิลค่าเช่าสำเร็จ' : 'สร้างสัญญาเช่าสำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const updateBookingMutation = useMutation({
    mutationFn: async ({ id, data, oldRoomId, createPayment }) => {
      if (!canEditContract) throw new Error('คุณไม่มีสิทธิ์แก้ไขสัญญาเช่า');
      if (oldRoomId !== data.room_id) {
        await base44.entities.Room.update(oldRoomId, { status: 'available' });
        await base44.entities.Room.update(data.room_id, { status: 'occupied' });
      }
      
      const updateData = { ...data };
      delete updateData.create_payment; // ลบ field ที่ไม่ต้องการบันทึก
      
      const updatedBooking = await base44.entities.Booking.update(id, updateData);

      // ⭐ สร้างบิลเฉพาะเมื่อ createPayment = true
      if (createPayment) {
        const room = rooms.find(r => r.id === data.room_id);
        if (room) {
          const paymentTiming = data.payment_timing || 'stay_first';
          const checkInDate = parseISO(data.check_in_date);
          let dueDate;
          let paymentNotes;

          if (paymentTiming === 'pay_first') {
            dueDate = checkInDate;
            paymentNotes = `ค่าเช่าเดือนแรก - ${format(checkInDate, 'MMMM yyyy', { locale: th })}`;
          } else {
            const nextMonthDate = addMonths(checkInDate, 1);
            dueDate = startOfMonth(nextMonthDate);
            paymentNotes = `ค่าเช่าสำหรับเดือน ${format(dueDate, 'MMMM yyyy', { locale: th })}`;
          }

          await base44.entities.Payment.create({
            booking_id: id,
            tenant_id: data.tenant_id,
            room_id: data.room_id,
            due_date: format(dueDate, 'yyyy-MM-dd'),
            rent_amount: room.price,
            water_amount: 0,
            electricity_amount: 0,
            internet_amount: 0,
            other_amount: 0,
            total_amount: room.price,
            status: 'pending',
            payment_method: 'transfer',
            notes: paymentNotes,
            branch_id: selectedBranchId
          });
        }
      }
      
      return updatedBooking;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      queryClient.invalidateQueries(['rooms', selectedBranchId]);
      queryClient.invalidateQueries(['payments', selectedBranchId]);
      setShowBookingDialog(false);
      setShowDetailDialog(false);
      resetBookingForm();
      toast.success(variables.createPayment ? 'แก้ไขสัญญาและสร้างบิลสำเร็จ' : 'แก้ไขสัญญาเช่าสำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const createRatingMutation = useMutation({
    mutationFn: (data) => {
      if (!canEdit) throw new Error('คุณไม่มีสิทธิ์ให้คะแนนผู้เช่า');
      return base44.entities.TenantRating.create({
        ...data,
        tenant_id: selectedTenant.id,
        branch_id: selectedBranchId,
        rated_by: currentUser?.full_name || 'Unknown'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenantRatings', selectedBranchId]);
      setShowRatingDialog(false);
      toast.success('บันทึกคะแนนสำเร็จ');
    },
    onError: (error) => toast.error(error.message || 'เกิดข้อผิดพลาด')
  });

  const deleteContractMutation = useMutation({
    mutationFn: (id) => base44.entities.Contract.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['contracts', selectedBranchId]);
      toast.success('ลบสัญญาสำเร็จ');
    },
    onError: () => {
      toast.error('เกิดข้อผิดพลาดในการลบสัญญา');
    }
  });

  const moveOutMutation = useMutation({
    mutationFn: async ({ tenant, returnDeposit, depositAmount, depositNotes }) => {
      if (!canEdit) throw new Error('คุณไม่มีสิทธิ์แก้ไขข้อมูลผู้เช่า');

      // 1. Update tenant status to 'moved_out' and clear LINE connection
      await base44.entities.Tenant.update(tenant.id, {
        status: 'moved_out',
        moved_out_date: new Date().toISOString().split('T')[0],
        line_user_id: null
      });

      // 2. Find and update active bookings to 'completed'
      const activeBookings = bookings.filter(b => b.tenant_id === tenant.id && b.status === 'active');
      
      for (const booking of activeBookings) {
        await base44.entities.Booking.update(booking.id, { status: 'completed' });
        
        // Update room status to 'available'
        if(booking.room_id) {
          await base44.entities.Room.update(booking.room_id, { status: 'available' });
        }

        // Find and update related formal contracts to 'terminated'
        const relatedContracts = contracts.filter(c => c.booking_id === booking.id && (c.status === 'active' || c.status === 'signed'));
        for(const contract of relatedContracts) {
          await base44.entities.Contract.update(contract.id, { status: 'terminated' });
        }

        // 3. บันทึกค่าใช้จ่ายการคืนเงินมัดจำ (ถ้าเลือก)
        if (returnDeposit && depositAmount > 0 && booking.deposit_amount > 0) {
          const room = rooms.find(r => r.id === booking.room_id);
          await base44.entities.Expense.create({
            branch_id: selectedBranchId,
            title: `คืนเงินมัดจำ - ห้อง ${room?.room_number || 'N/A'}`,
            amount: depositAmount,
            category: 'refund_deposit',
            date: format(new Date(), 'yyyy-MM-dd'),
            description: `คืนเงินมัดจำให้ ${tenant.full_name}${depositNotes ? ` - ${depositNotes}` : ''}`,
            notes: `Booking ID: ${booking.id}`
          });
        }
      }
      
      return tenant;
    },
    onSuccess: (tenant, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenants', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['bookings', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['rooms', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['contracts', selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', selectedBranchId] });
      setShowDetailDialog(false);
      setShowDialog(false);
      setShowMoveOutDialog(false);
      toast.success(`ดำเนินการย้ายออกสำหรับ ${tenant.full_name} สำเร็จ${variables.returnDeposit ? ' (รวมคืนเงินมัดจำ)' : ''}`);
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาดในการย้ายออก');
    }
  });

  const renewContractMutation = useMutation({
    mutationFn: async ({ originalContract, months }) => {
      const newStartDate = parseISO(originalContract.end_date);
      const newEndDate = addMonths(newStartDate, months);

      const newContract = await base44.entities.Contract.create({
        branch_id: originalContract.branch_id,
        tenant_id: originalContract.tenant_id,
        room_id: originalContract.room_id,
        booking_id: originalContract.booking_id,
        contract_date: format(new Date(), 'yyyy-MM-dd'),
        start_date: format(newStartDate, 'yyyy-MM-dd'),
        end_date: format(newEndDate, 'yyyy-MM-dd'),
        rent_monthly: originalContract.rent_monthly,
        deposit: originalContract.deposit,
        pay_day: originalContract.pay_day,
        water_rate: originalContract.water_rate,
        elec_rate: originalContract.elec_rate,
        common_fee: originalContract.common_fee,
        internet_fee: originalContract.internet_fee,
        late_fee_per_day: originalContract.late_fee_per_day,
        allow_pets: originalContract.allow_pets,
        no_smoking: originalContract.no_smoking,
        termination_notice_days: originalContract.termination_notice_days,
        deposit_return_days: originalContract.deposit_return_days,
        late_payment_grace_days: originalContract.late_payment_grace_days,
        furniture_rent: originalContract.furniture_rent,
        contract_clauses: originalContract.contract_clauses,
        additional_rules: originalContract.additional_rules,
        lessor_name: originalContract.lessor_name,
        lessor_id: originalContract.lessor_id,
        lessor_phone: originalContract.lessor_phone,
        lessor_address: originalContract.lessor_address,
        lessee_name: originalContract.lessee_name,
        lessee_id: originalContract.lessee_id,
        lessee_phone: originalContract.lessee_phone,
        lessee_address: originalContract.lessee_address,
        building: originalContract.building,
        room_no: originalContract.room_no,
        floor: originalContract.floor,
        full_address: originalContract.full_address,
        status: 'draft',
        notes: `ต่อสัญญาจาก: ${originalContract.contract_no || originalContract.id.slice(0, 8)}`
      });

      if (originalContract.booking_id) {
        await base44.entities.Booking.update(originalContract.booking_id, {
          check_out_date: format(newEndDate, 'yyyy-MM-dd')
        });
      }

      return newContract;
    },
    onSuccess: (newContract) => {
      queryClient.invalidateQueries(['contracts', selectedBranchId]);
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      setRenewDialogOpen(false);
      setSelectedContract(null);
      toast.success('ต่อสัญญาสำเร็จ');
      navigate(`${createPageUrl('ContractEditor')}?contractId=${newContract.id}`);
    },
    onError: (error) => {
      console.error('Renew error:', error);
      toast.error('เกิดข้อผิดพลาดในการต่อสัญญา');
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ tenantIds, updates }) => {
      const results = [];
      const chunkSize = 10;
      for (let i = 0; i < tenantIds.length; i += chunkSize) {
        const chunk = tenantIds.slice(i, i + chunkSize);
        const promises = chunk.map(id => base44.entities.Tenant.update(id, updates));
        const chunkResults = await Promise.all(promises);
        results.push(...chunkResults);
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants', selectedBranchId]);
      setSelectedTenants([]);
      setBulkAIResult(null);
      setBulkAIQuery('');
      toast.success('อัปเดตข้อมูลผู้เช่าหลายคนสำเร็จ');
    },
    onError: (error) => toast.error('เกิดข้อผิดพลาด: ' + error.message)
  });

  const bulkUpdateFromTableMutation = useMutation({
    mutationFn: async (updates) => {
      // updates is array of { tenantId, data }
      // ⭐ ลดขนาด chunk และเพิ่ม delay เพื่อป้องกัน rate limit
      const chunkSize = 3;
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize);
        const promises = chunk.map(({ tenantId, data }) => {
          const existingTenant = tenants.find(t => t.id === tenantId);
          const preservedData = {
            ...data,
            line_user_id: existingTenant?.line_user_id || data.line_user_id
          };
          return base44.entities.Tenant.update(tenantId, preservedData);
        });
        await Promise.all(promises);
        // หน่วงเวลาระหว่าง chunk
        if (i + chunkSize < updates.length) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants', selectedBranchId]);
      toast.success('อัปเดตข้อมูลสำเร็จ');
    },
    onError: (error) => toast.error('เกิดข้อผิดพลาด: ' + error.message)
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (tenantIds) => {
      // ✅ ใช้ backend function สำหรับลบหลายคนพร้อมกัน (มี rate limit protection)
      const response = await base44.functions.invoke('bulkDeleteTenants', {
        tenant_ids: tenantIds,
        branch_id: selectedBranchId
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['tenants', selectedBranchId]);
      queryClient.invalidateQueries(['bookings', selectedBranchId]);
      queryClient.invalidateQueries(['rooms', selectedBranchId]);
      queryClient.invalidateQueries(['payments', selectedBranchId]);
      queryClient.invalidateQueries(['tenantRatings', selectedBranchId]);
      setSelectedTenants([]);
      setIsSelectionMode(false);
      setBulkAIResult(null);
      setBulkAIQuery('');
      toast.success(data.message || `ลบผู้เช่าสำเร็จ ${data.deleted} คน`);
    },
    onError: (error) => toast.error('เกิดข้อผิดพลาด: ' + error.message)
  });

  const getTenantBookings = useCallback((tenantId) => {
    return bookings.filter(b => b.tenant_id === tenantId && b.booking_type === 'monthly');
  }, [bookings]);

  const getActiveBookings = useCallback((tenantId) => {
    return bookings.filter(b => b.tenant_id === tenantId && b.booking_type === 'monthly' && b.status === 'active');
  }, [bookings]);

  const getRoomInfo = useCallback((roomId) => {
    return rooms.find(r => r.id === roomId);
  }, [rooms]);

  const getVehicleCount = useCallback((tenant) => {
    if (!tenant?.vehicles?.length) return null;
    const cars = tenant.vehicles.filter(v => v.type === 'car').length;
    const motorcycles = tenant.vehicles.filter(v => v.type === 'motorcycle').length;
    return { cars, motorcycles, total: cars + motorcycles };
  }, []);

  const getTenantAverageRating = useCallback((tenantId) => {
    const tenantRatings = ratings.filter(r => r.tenant_id === tenantId);
    if (tenantRatings.length === 0) return null;
    const validRatings = tenantRatings.filter(r => typeof r.overall_rating_stars === 'number' && !isNaN(r.overall_rating_stars));
    if (validRatings.length === 0) return null;
    const sum = validRatings.reduce((acc, r) => acc + r.overall_rating_stars, 0);
    return sum / validRatings.length;
  }, [ratings]);

  const getLatestRating = useCallback((tenantId) => {
    const tenantRatings = ratings.filter(r => r.tenant_id === tenantId);
    tenantRatings.sort((a, b) => new Date(b.rating_date).getTime() - new Date(a.rating_date).getTime());
    return tenantRatings.length > 0 ? tenantRatings[0] : null;
  }, [ratings]);

  const getPaymentStatus = useCallback((booking) => {
    if (!booking?.room_id) return null;
    const roomPayments = payments.filter(p => p.room_id === booking.room_id && p.booking_id === booking.id);
    const pendingPayments = roomPayments.filter(p =>
      (p.status === 'pending' || p.status === 'overdue') && p.due_date
    );
    if (pendingPayments.length === 0) return null;
    pendingPayments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    const nextPayment = pendingPayments[0];
    try {
      const daysUntilDue = differenceInDays(parseISO(nextPayment.due_date), new Date());
      return {
        payment: nextPayment,
        daysUntilDue,
        isOverdue: daysUntilDue < 0,
        isNearDue: daysUntilDue >= 0 && daysUntilDue <= 3
      };
    } catch {
      return null;
    }
  }, [payments]);

  const isContractExpiringSoon = useCallback((booking) => {
    if (!booking?.check_out_date) return false;
    try {
      const daysUntilExpiry = differenceInDays(parseISO(booking.check_out_date), new Date());
      return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    } catch {
      return false;
    }
  }, []);

  const getDaysUntilExpiry = useCallback((booking) => {
    if (!booking?.check_out_date) return null;
    try {
      return differenceInDays(parseISO(booking.check_out_date), new Date());
    } catch {
      return null;
    }
  }, []);

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, id_card_image: file_url }));
      toast.success('อัปโหลดรูปภาพสำเร็จ');

      // เริ่มอ่านข้อมูลด้วย AI
      setExtractingData(true);
      toast.info('กำลังอ่านข้อมูลจากบัตรประชาชน...');

      try {
        const extractResult = await base44.integrations.Core.InvokeLLM({
          prompt: `วิเคราะห์รูปภาพ "บัตรประจำตัวประชาชนไทย" (Thai National ID Card) นี้และดึงข้อมูลออกมาให้ถูกต้องแม่นยำที่สุด โดยเน้น **ภาษาไทย** เป็นหลัก:

1. **full_name**: ขอชื่อ-นามสกุล ภาษาไทย (Thai Name).
   - **สำคัญมาก**: ให้ตัดคำนำหน้าชื่อออก (เช่น นาย, นาง, นางสาว, ด.ช., ด.ญ., ยศต่างๆ) ให้เหลือแค่ "ชื่อตัว" และ "นามสกุล" เท่านั้น
2. **national_id**: เลขประจำตัวประชาชน 13 หลัก (13-digit ID). ต้องเป็นตัวเลขเท่านั้น
3. **address**: ที่อยู่ตามบัตรประชาชน ภาษาไทย (Thai Address) ให้ครบถ้วน
4. **gender**: เพศ (ระบุเป็น 'male' หรือ 'female' หรือ 'other'). ให้ดูจากคำนำหน้าชื่อภาษาไทยในบัตร (นาย=male, นาง/นางสาว=female) หรือดูจากรูปภาพหากไม่ชัดเจน
5. **age**: อายุ (คำนวณจากปีเกิดในบัตรเทียบกับปีปัจจุบัน หรือประมาณจากหน้าตาถ้าอ่านปีเกิดไม่ได้)

กรุณาอ่านตัวอักษรภาษาไทยให้แม่นยำที่สุด ถ้าข้อมูลไหนไม่ชัดให้เว้นว่างไว้`,
          file_urls: [file_url],
          response_json_schema: {
            type: "object",
            properties: {
              full_name: { type: "string", description: "ชื่อ-นามสกุล ไม่รวมคำนำหน้า" },
              gender: { type: "string", enum: ["male", "female", "other"] },
              age: { type: "number" },
              national_id: { type: "string" },
              address: { type: "string" }
            }
          }
        });

        if (extractResult.full_name || extractResult.national_id || extractResult.address) {
          setFormData(prev => ({
            ...prev,
            full_name: extractResult.full_name || prev.full_name,
            gender: extractResult.gender || prev.gender,
            age: extractResult.age?.toString() || prev.age,
            national_id: extractResult.national_id || prev.national_id,
            address: extractResult.address || prev.address
          }));
          toast.success('✨ อ่านข้อมูลจากบัตรประชาชนสำเร็จ! กรุณาตรวจสอบความถูกต้อง');
        } else {
          toast.warning('ไม่สามารถอ่านข้อมูลได้ กรุณากรอกข้อมูลเอง');
        }
      } catch (error) {
        console.error('AI extraction error:', error);
        toast.warning('ไม่สามารถอ่านข้อมูลได้ กรุณากรอกข้อมูลเอง');
      } finally {
        setExtractingData(false);
      }
    } catch (error) {
      toast.error('อัปโหลดรูปภาพไม่สำเร็จ');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // ป้องกัน double submit
    if (createMutation.isPending || updateMutation.isPending) {
      return;
    }

    const commonTenantData = {
    full_name: formData.full_name,
    phone: formData.phone,
    gender: formData.gender,
    age: formData.age ? parseInt(formData.age) : undefined,
    line_id: formData.line_id,
    national_id: formData.national_id,
    email: formData.email,
    address: formData.address,
    emergency_contact: formData.emergency_contact,
    id_card_image: formData.id_card_image,
    vehicles: formData.vehicles,
    notes: formData.notes
    };

    if (editingTenant) {
      updateMutation.mutate({ id: editingTenant.id, data: commonTenantData });
    } else {
      createMutation.mutate({ ...commonTenantData, ...formData });
    }
  };

  const handleBookingSubmit = (e) => {
    e.preventDefault();

    // ป้องกัน double submit
    if (createBookingMutation.isPending || updateBookingMutation.isPending) {
      return;
    }

    if (!selectedTenant || !selectedTenant.id) {
      toast.error('ไม่พบข้อมูลผู้เช่า กรุณาลองใหม่อีกครั้ง');
      return;
    }

    if (!bookingFormData.room_id) {
      toast.error('กรุณาเลือกห้อง');
      return;
    }

    if (!bookingFormData.check_in_date) {
      toast.error('กรุณาเลือกวันเริ่มสัญญา');
      return;
    }

    const data = {
      ...bookingFormData,
      tenant_id: selectedTenant.id,
      booking_type: 'monthly',
      deposit_amount: bookingFormData.deposit_amount ? parseFloat(bookingFormData.deposit_amount) : 0,
      total_amount: rooms.find(r => r.id === bookingFormData.room_id)?.price || 0,
      status: 'active'
    };

    if (editingBooking) {
      updateBookingMutation.mutate({
        id: editingBooking.id,
        data: data,
        oldRoomId: editingBooking.room_id,
        createPayment: bookingFormData.create_payment
      });
    } else {
      createBookingMutation.mutate({ ...data, create_payment: bookingFormData.create_payment });
    }
  };

  const handleEdit = (tenant) => {
    if (!canEdit) {
      toast.error('คุณไม่มีสิทธิ์แก้ไขข้อมูลผู้เช่า');
      return;
    }

    setEditingTenant(tenant);
    setFormData({
      full_name: tenant.full_name || '',
      phone: tenant.phone || '',
      gender: tenant.gender || '',
      age: tenant.age?.toString() || '',
      line_id: tenant.line_id || '',
      national_id: tenant.national_id || '',
      email: tenant.email || '',
      address: tenant.address || '',
      emergency_contact: tenant.emergency_contact || '',
      id_card_image: tenant.id_card_image || '',
      vehicles: tenant.vehicles || [],
      notes: tenant.notes || '',
      create_booking: false,
      room_id: '',
      check_in_date: '',
      check_out_date: '',
      deposit_amount: '',
      payment_timing: 'stay_first'
    });
    setShowDialog(true);
  };

  const handleAddBooking = (tenant) => {
    if (!canAddContract) {
      toast.error('คุณไม่มีสิทธิ์เพิ่มสัญญาเช่า');
      return;
    }
    setSelectedTenant(tenant);
    setEditingBooking(null);
    resetBookingForm();
    setShowBookingDialog(true);
  };

  const handleEditBooking = (tenant, booking) => {
    if (!canEditContract) {
      toast.error('คุณไม่มีสิทธิ์แก้ไขสัญญาเช่า');
      return;
    }
    setSelectedTenant(tenant);
    setEditingBooking(booking);
    setBookingFormData({
      room_id: booking.room_id || '',
      check_in_date: booking.check_in_date || '',
      check_out_date: booking.check_out_date || '',
      deposit_amount: booking.deposit_amount?.toString() || '',
      payment_timing: booking.payment_timing || 'stay_first',
      notes: booking.notes || '',
      create_payment: false // default false เมื่อแก้ไข เพื่อไม่ให้สร้างบิลซ้ำ
    });
    setShowBookingDialog(true);
  };

  const resetForm = () => {
    setEditingTenant(null);
    setFormData({
      full_name: '',
      phone: '',
      gender: '',
      age: '',
      line_id: '',
      national_id: '',
      email: '',
      address: '',
      emergency_contact: '',
      id_card_image: '',
      vehicles: [],
      notes: '',
      create_booking: false,
      room_id: '',
      check_in_date: '',
      check_out_date: '',
      deposit_amount: '',
      payment_timing: 'stay_first'
    });
    setNewVehicle({ type: 'car', plate: '', brand: '' });
  };

  const resetBookingForm = () => {
    setEditingBooking(null);
    setBookingFormData({
      room_id: '',
      check_in_date: '',
      check_out_date: '',
      deposit_amount: '',
      payment_timing: 'stay_first',
      notes: '',
      create_payment: true
    });
  };

  const handleAddVehicle = () => {
    if (!newVehicle.plate) {
      toast.error('กรุณากรอกทะเบียนรถ');
      return;
    }
    setFormData(prev => ({
      ...prev,
      vehicles: [...(prev.vehicles || []), { ...newVehicle }]
    }));
    setNewVehicle({ type: 'car', plate: '', brand: '' });
    toast.success('เพิ่มยานพาหนะสำเร็จ');
  };

  const handleRemoveVehicle = (index) => {
    const newVehicles = [...(formData.vehicles || [])];
    newVehicles.splice(index, 1);
    setFormData({ ...formData, vehicles: newVehicles });
    toast.success('ลบยานพาหนะสำเร็จ');
  };

  const handleTenantClick = (tenant) => {
    if (isSelectionMode) {
      toggleTenantSelection(tenant.id);
      return;
    }
    setSelectedTenant(tenant);
    setShowDetailDialog(true);
  };

  const toggleTenantSelection = (tenantId) => {
    setSelectedTenants(prev =>
      prev.includes(tenantId)
        ? prev.filter(id => id !== tenantId)
        : [...prev, tenantId]
    );
  };

  const handleLongPressStart = (e, tenantId) => {
    if (isSelectionMode) return;

    const timer = setTimeout(() => {
      setIsSelectionMode(true);
      setSelectedTenants([tenantId]);
      toast.info('เข้าสู่โหมดเลือกหลายรายการ', { duration: 2000 });
    }, 500);
    setLongPressTimer(timer);
    setLongPressTarget(tenantId);
  };

  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
    setLongPressTarget(null);
  };

  const toggleSelectAllInPage = () => {
    const displayedTenantIds = displayedTenants.map(t => t.id);
    const allSelectedOnPage = displayedTenantIds.every(id => selectedTenants.includes(id));

    if (allSelectedOnPage) {
      setSelectedTenants(prev => prev.filter(id => !displayedTenantIds.includes(id)));
    } else {
      setSelectedTenants(prev => [...new Set([...prev, ...displayedTenantIds])]);
    }
  };

  const handleCellEdit = async (tenantId, field, value) => {
    try {
      const updateData = { [field]: value };
      await base44.entities.Tenant.update(tenantId, updateData);
      queryClient.invalidateQueries(['tenants', selectedBranchId]);
      setEditingCells({});
      toast.success('อัปเดตข้อมูลสำเร็จ');
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการอัปเดต');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTenants.length === 0) {
      toast.error('กรุณาเลือกผู้เช่าที่ต้องการลบ');
      return;
    }

    const confirmDelete = window.confirm(`คุณแน่ใจว่าต้องการลบผู้เช่า ${selectedTenants.length} คน?\n\n⚠️ การกระทำนี้จะลบข้อมูลทั้งหมดของผู้เช่าที่เลือกอย่างถาวร (รวมสัญญา, การชำระเงิน, คะแนน)`);
    if (!confirmDelete) return;

    setIsBulkExecuting(true);
    toast.info(`กำลังลบผู้เช่า ${selectedTenants.length} คน...`);

    try {
      await bulkDeleteMutation.mutateAsync(selectedTenants);
    } catch (error) {
      console.error('Bulk delete error:', error);
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const handleAIBulkRequest = async () => {
    if (!bulkAIQuery.trim()) return;
    
    setAiSearching(true);
    try {
      const selectedTenantsData = tenants.filter(t => selectedTenants.includes(t.id)).map(t => ({
        full_name: t.full_name,
        status: t.status,
        prepaid_balance: t.prepaid_balance,
        vehicles: t.vehicles || [],
      })).slice(0, 10); // Send sample data

      const prompt = `
        คุณเป็นผู้ช่วย AI สำหรับระบบจัดการหอพัก ตอบเป็นภาษาไทยเท่านั้น
        
        ผู้ใช้ต้องการดำเนินการกับผู้เช่าที่เลือก ${selectedTenants.length} คน
        คำสั่งผู้ใช้: "${bulkAIQuery}"
        ตัวอย่างผู้เช่าที่เลือก: ${JSON.stringify(selectedTenantsData)}
        
        กรุณาวิเคราะห์ว่าเป็นการดำเนินการอะไร:
        - ถ้าลบ: action="delete"
        - ถ้าแก้ไขสถานะ: action="update" พร้อม changes object (เช่น { status: "moved_out" หรือ "active" })
        - ถ้าเพิ่มรถ/ยานพาหนะ (รถ, รถยนต์, มอเตอร์ไซค์): action="add_vehicle"
          - vehicle_type: "car" หรือ "motorcycle" (ถ้าไม่ระบุให้เป็น "car")
          - vehicle_plate: ทะเบียนรถ (ถ้าไม่ระบุให้เป็น "")
          - vehicle_brand: ยี่ห้อ/รุ่น (ถ้าไม่ระบุให้เป็น "")
        - ถ้าไม่เข้าใจ: action="none"
        
        สำคัญ: description และ confirmation_message ต้องเป็นภาษาไทย
        
        Return JSON.
      `;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["update", "delete", "add_vehicle", "none"] },
            changes: { type: "object" },
            vehicle_type: { type: "string", enum: ["car", "motorcycle"] },
            vehicle_plate: { type: "string" },
            vehicle_brand: { type: "string" },
            description: { type: "string" },
            confirmation_message: { type: "string" }
          },
          required: ["action", "description", "confirmation_message"]
        }
      });

      if (result.action === 'none') {
        toast.error(result.description || 'ไม่เข้าใจคำสั่ง');
      } else {
        setBulkAIResult(result);
      }
    } catch (error) {
      console.error(error);
      toast.error('AI Error');
    } finally {
      setAiSearching(false);
    }
  };

  const executeBulkAction = async () => {
    if (!bulkAIResult) return;
    
    setIsBulkExecuting(true);
    try {
      if (bulkAIResult.action === 'delete') {
        await bulkDeleteMutation.mutateAsync(selectedTenants);
      } else if (bulkAIResult.action === 'update') {
        await bulkUpdateMutation.mutateAsync({
          tenantIds: selectedTenants,
          updates: bulkAIResult.changes
        });
      } else if (bulkAIResult.action === 'add_vehicle') {
        // เพิ่มรถยนต์ให้ผู้เช่าที่เลือก
        const newVehicle = {
          type: bulkAIResult.vehicle_type || 'car',
          plate: bulkAIResult.vehicle_plate || '',
          brand: bulkAIResult.vehicle_brand || ''
        };

        const chunkSize = 10;
        for (let i = 0; i < selectedTenants.length; i += chunkSize) {
          const chunk = selectedTenants.slice(i, i + chunkSize);
          const promises = chunk.map(async (tenantId) => {
            const tenant = tenants.find(t => t.id === tenantId);
            const existingVehicles = tenant?.vehicles || [];
            // ตรวจสอบว่ามีทะเบียนนี้อยู่แล้วหรือไม่ (ถ้าไม่มีทะเบียนให้เพิ่มได้เลย)
            const alreadyExists = newVehicle.plate && existingVehicles.some(v => v.plate === newVehicle.plate);
            if (!alreadyExists) {
              return base44.entities.Tenant.update(tenantId, {
                vehicles: [...existingVehicles, newVehicle]
              });
            }
            return Promise.resolve();
          });
          await Promise.all(promises);
        }

        queryClient.invalidateQueries(['tenants', selectedBranchId]);
        setSelectedTenants([]);
        setBulkAIResult(null);
        setBulkAIQuery('');
        const vehicleLabel = newVehicle.type === 'car' ? 'รถยนต์' : 'มอเตอร์ไซค์';
        const plateInfo = newVehicle.plate ? ` ทะเบียน ${newVehicle.plate}` : '';
        toast.success(`เพิ่ม${vehicleLabel}${plateInfo} ให้ผู้เช่า ${selectedTenants.length} คนสำเร็จ`);
      }
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const handleRateGuest = (tenant) => {
    if (!canEdit) {
      toast.error('คุณไม่มีสิทธิ์ให้คะแนนผู้เช่า');
      return;
    }
    setSelectedTenant(tenant);
    setShowRatingDialog(true);
  };

  const handleRatingSubmit = (ratingData) => {
    createRatingMutation.mutate(ratingData);
  };

  const getTenantInfo = useCallback((tenantId) => {
    return tenants.find(t => t.id === tenantId);
  }, [tenants]);



  const handleConfirmAIAction = async () => {
    if (!aiAction) {
      console.log('⚠️ No AI action to confirm');
      return;
    }

    console.log('✅ Confirming AI action:', aiAction.action_type);
    setExecutingAction(true);

    try {
      // Delete - ลบผู้เช่า + Booking + ข้อมูลที่เกี่ยวข้อง
      if (aiAction.action_type === 'delete' && aiAction.tenant_id) {
        const tenant = tenants.find(t => t.id === aiAction.tenant_id);
        if (!tenant) {
          toast.error('ไม่พบผู้เช่า');
          setExecutingAction(false);
          return;
        }

        // ⚠️ ขอยืนยันก่อนลบ
        const activeBookings = getActiveBookings(tenant.id);
        const bookingInfo = activeBookings.length > 0 
          ? `\n\n📋 สัญญาเช่า: ${activeBookings.length} สัญญา` 
          : '';

        const confirmDelete = window.confirm(
          `⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบผู้เช่า "${tenant.full_name}"?${bookingInfo}\n\n` +
          `การกระทำนี้จะลบข้อมูลทั้งหมดอย่างถาวร:\n` +
          `• ผู้เช่า\n` +
          `• สัญญาเช่าทั้งหมด (${activeBookings.length} สัญญา)\n` +
          `• การชำระเงิน\n` +
          `• คะแนน\n` +
          `• สัญญาอย่างเป็นทางการ`
        );

        if (!confirmDelete) {
          toast.info('ยกเลิกการลบแล้ว');
          setExecutingAction(false);
          setAiAction(null);
          return;
        }

        console.log('🗑️ Deleting tenant:', tenant.id);
        await deleteMutation.mutateAsync(tenant.id);
        toast.success(`✅ ลบผู้เช่า "${tenant.full_name}" และข้อมูลที่เกี่ยวข้องสำเร็จ`);
        setAiAction(null);
        setAiResult(null);
        setSearchQuery('');
        setExecutingAction(false);
        return;
      }

      // Bulk Update - แก้ไขหลายคนพร้อมกัน
      if (aiAction.action_type === 'bulk_update' && aiAction.tenant_ids) {
        const tenantIds = aiAction.tenant_ids;
        const changes = aiAction.changes;

        console.log('🔄 Bulk updating tenants:', tenantIds.length, 'tenants with changes:', changes);

        // Update ทีละ chunk
        const chunkSize = 10;
        let updatedCount = 0;
        const updatedTenants = [];

        for (let i = 0; i < tenantIds.length; i += chunkSize) {
          const chunk = tenantIds.slice(i, i + chunkSize);
          const promises = chunk.map(id => base44.entities.Tenant.update(id, changes));
          await Promise.all(promises);
          updatedCount += chunk.length;

          chunk.forEach(id => {
            const tenant = tenants.find(t => t.id === id);
            if (tenant) updatedTenants.push(tenant.full_name);
          });
        }

        // Invalidate cache
        await queryClient.invalidateQueries(['tenants', selectedBranchId]);

        // Log activity
        await base44.entities.ActivityLog.create({
          branch_id: selectedBranchId,
          action_type: 'update',
          entity_type: 'Tenant',
          entity_id: 'bulk',
          entity_name: `แก้ไข ${updatedCount} ผู้เช่า`,
          user_email: currentUser?.email,
          user_name: currentUser?.full_name,
          description: `แก้ไข ${aiAction.field_label} เป็น ${aiAction.new_value} ให้: ${updatedTenants.slice(0, 5).join(', ')}${updatedTenants.length > 5 ? ` และอีก ${updatedTenants.length - 5} คน` : ''}${aiAction.except_names?.length > 0 ? ` (ยกเว้น ${aiAction.except_names.join(', ')})` : ''}`
        });

        toast.success(`✅ แก้ไข ${aiAction.field_label} สำเร็จ ${updatedCount} คน`, {
          duration: 5000
        });
        setAiAction(null);
        setAiResult(null);
        setSearchQuery('');
        return;
      }

      // Single Update - แก้ไขผู้เช่าเดียว
      if (aiAction.action_type === 'update' && aiAction.tenant_id) {
        const tenant = tenants.find(t => t.id === aiAction.tenant_id);
        if (!tenant) {
          toast.error('ไม่พบผู้เช่า');
          setExecutingAction(false);
          return;
        }

        const updateData = {};
        Object.entries(aiAction.changes || {}).forEach(([field, change]) => {
          updateData[field] = change.new;
        });

        console.log('🔄 Updating tenant:', aiAction.tenant_id, updateData);
        await updateMutation.mutateAsync({ id: aiAction.tenant_id, data: updateData });
        toast.success(`✅ แก้ไขข้อมูล ${tenant.full_name} สำเร็จ`);
        setAiAction(null);
        setAiResult(null);
        setSearchQuery('');
      } else if (aiAction.action_type === 'create' && aiAction.data) {
        console.log('🔄 Creating tenant:', aiAction.data);
        await createMutation.mutateAsync({
          ...aiAction.data,
          branch_id: selectedBranchId
        });
        toast.success('✅ เพิ่มข้อมูลสำเร็จ');
        setAiAction(null);
        setAiResult(null);
        setSearchQuery('');
      }
    } catch (error) {
      console.error('❌ AI action error:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    } finally {
      setExecutingAction(false);
    }
  };

  const toggleStatus = (status) => {
    setSelectedStatuses(prev =>
      prev.includes(status)
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
    setDisplayLimit(50);
  };

  const getStatusLabel = (status) => {
    switch(status) {
      case 'active': return 'ผู้เช่าปัจจุบัน';
      case 'moved_out': return 'ย้ายออกแล้ว';
      case 'expiring_soon': return 'ใกล้หมดสัญญา';
      case 'near_payment': return 'ใกล้ถึงกำหนดชำระ';
      case 'payment_overdue': return 'ค้างชำระ';
      default: return status;
    }
  };

  const filteredTenants = useMemo(() => {
    let result = Array.isArray(tenants) ? tenants : [];

    // Filter by search query
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(tenant => {
        const activeBookings = getActiveBookings(tenant.id);
        const roomNumbers = activeBookings.map(b => getRoomInfo(b.room_id)?.room_number).filter(Boolean).join(' ');
        return tenant.full_name?.toLowerCase().includes(query) ||
               tenant.phone?.toLowerCase().includes(query) ||
               tenant.email?.toLowerCase().includes(query) ||
               tenant.line_id?.toLowerCase().includes(query) ||
               roomNumbers.toLowerCase().includes(query);
      });
    }

    // Filter by selected statuses
    if (selectedStatuses.length > 0) {
      result = result.filter(tenant => {
        // Explicit tenant status (active/moved_out)
        const tenantStatus = tenant.status || 'active';
        if (selectedStatuses.includes(tenantStatus)) return true;

        // Dynamic statuses based on bookings/payments
        const activeBookings = getActiveBookings(tenant.id);
        if (activeBookings.length > 0) {
          if (selectedStatuses.includes('expiring_soon') && activeBookings.some(isContractExpiringSoon)) {
            return true;
          }

          const hasNearPayment = activeBookings.some(booking => {
            const paymentInfo = getPaymentStatus(booking);
            return paymentInfo?.isNearDue;
          });
          if (selectedStatuses.includes('near_payment') && hasNearPayment) {
            return true;
          }

          const hasOverduePayment = activeBookings.some(booking => {
            const paymentInfo = getPaymentStatus(booking);
            return paymentInfo?.isOverdue;
          });
          if (selectedStatuses.includes('payment_overdue') && hasOverduePayment) {
            return true;
          }
        }
        return false;
      });
    }

    // If AI result has specific tenants, override with those (except when AI returns empty tenants, then it's just general info)
    if (aiResult?.tenants?.length > 0) {
      const aiTenantIds = new Set(aiResult.tenants.map(t => t.tenant_id));
      result = result.filter(tenant => aiTenantIds.has(tenant.id));
    }

    return result;
    }, [tenants, debouncedSearch, selectedStatuses, aiResult, getActiveBookings, getRoomInfo, isContractExpiringSoon, getPaymentStatus]);

    useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayLimit < filteredTenants.length) {
          setDisplayLimit(prev => Math.min(prev + 50, filteredTenants.length));
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
    }, [displayLimit, filteredTenants.length]);

    const displayedTenants = useMemo(() => {
    return filteredTenants.slice(0, displayLimit);
  }, [filteredTenants, displayLimit]);

  const tenantCardsData = useMemo(() => {
    return displayedTenants.map(tenant => {
      const activeBookings = getActiveBookings(tenant.id);
      const hasExpiringSoon = activeBookings.some(b => isContractExpiringSoon(b));
      const avgRating = getTenantAverageRating(tenant.id);
      
      // ⭐ คำนวณ paymentScore จาก payment_scores ถ้ายังไม่มี avg_payment_score
      let paymentScore = tenant.avg_payment_score;
      if ((paymentScore === null || paymentScore === undefined) && tenant.payment_scores?.length > 0) {
        const avgScore = tenant.payment_scores.reduce((sum, p) => sum + (p.score || 0), 0) / tenant.payment_scores.length;
        paymentScore = Math.round(avgScore * 10) / 10;
      }
      
      // 🔍 DEBUG: แสดงข้อมูลคะแนนสำหรับผู้เช่าทุกคน
      if (tenant.full_name?.includes('ภูผา') || isDeveloper) {
        console.log('🔍 [TenantCard Debug]', tenant.full_name);
        console.log('  - avg_payment_score:', tenant.avg_payment_score, typeof tenant.avg_payment_score);
        console.log('  - payment_scores:', tenant.payment_scores);
        console.log('  - payment_scores.length:', tenant.payment_scores?.length);
        console.log('  - calculated paymentScore:', paymentScore);
        console.log('  - avgRating (from TenantRating):', avgRating);
      }
      
      const vehicleCount = getVehicleCount(tenant);
      
      // หาห้องล่าสุดที่เคยเช่า (สำหรับผู้เช่าที่ย้ายออกแล้ว)
      let lastRoomNumber = null;
      if (tenant.status === 'moved_out' && activeBookings.length === 0) {
        const allTenantBookings = bookings.filter(b => b.tenant_id === tenant.id && b.booking_type === 'monthly');
        if (allTenantBookings.length > 0) {
          const sortedBookings = allTenantBookings.sort((a, b) => 
            new Date(b.check_in_date || 0) - new Date(a.check_in_date || 0)
          );
          const lastRoom = getRoomInfo(sortedBookings[0]?.room_id);
          lastRoomNumber = lastRoom?.room_number;
        }
      }

      return {
        tenant,
        activeBookings,
        hasExpiringSoon,
        avgRating,
        paymentScore, // ⭐ ส่งคะแนนการชำระเงินไปด้วย
        vehicleCount,
        lastRoomNumber
      };
    });
    }, [displayedTenants, getActiveBookings, isContractExpiringSoon, getTenantAverageRating, getVehicleCount, bookings, getRoomInfo]);
const tenantSchema = {
    type: "object",
    additionalProperties: true,
    properties: {
      "ชื่อ-นามสกุล": { type: "string" },
      "เบอร์โทร": { type: "string" }, // ⭐ String type - API จัดการ parsing เอง
      "เพศ": { type: "string" },
      "อายุ": { type: "string" },
      "LINE ID": { type: "string" },
      "เลขบัตรประชาชน": { type: "string" },
      "อีเมล": { type: "string" },
      "ที่อยู่": { type: "string" },
      "เบอร์ติดต่อฉุกเฉิน": { type: "string" },
      "หมายเหตุ": { type: "string" },
      "เลขห้อง": { type: "string" },
      "วันเริ่มสัญญา": { type: "string" },
      "วันสิ้นสุดสัญญา": { type: "string" },
      "เงินมัดจำ": { type: "string" },
      "สถานะการจอง": { type: "string" }
    }
};
  const templateData = [{
    "ชื่อ-นามสกุล": "สมชาย ใจดี",
    "เบอร์โทร": "0812345678",
    "เพศ": "male",
    "อายุ": 30,
    "LINE ID": "somchai123",
    "เลขบัตรประชาชน": "1234567890123",
    "อีเมล": "somchai@email.com",
    "ที่อยู่": "123 ถนนสุขุมวิท กรุงเทพฯ",
    "เบอร์ติดต่อฉุกเฉิน": "0898765432",
    "หมายเหตุ": "ผู้เช่าดี จ่ายตรงเวลา",
    "เลขห้อง": "101",
    "วันเริ่มสัญญา": "2025-01-01",
    "วันสิ้นสุดสัญญา": "2026-01-01",
    "เงินมัดจำ": 5000,
    "สถานะการจอง": "active"
  }];


    const handleDownloadExistingTenants = () => {
    // เตรียมข้อมูลสำหรับ Excel
    const excelData = tenants.map(t => {
      // หา booking ที่ active ของผู้เช่านี้
      const activeBooking = bookings.find(b => b.tenant_id === t.id && b.status === 'active' && b.booking_type === 'monthly');
      const room = activeBooking ? rooms.find(r => r.id === activeBooking.room_id) : null;

      return {
        "ชื่อ-นามสกุล": t.full_name || '',
        "เบอร์โทร": t.phone || '',
        "เพศ": t.gender || '',
        "อายุ": t.age || '',
        "LINE ID": t.line_id || '',
        "เลขบัตรประชาชน": t.national_id || '',
        "อีเมล": t.email || '',
        "ที่อยู่": t.address || '',
        "เบอร์ติดต่อฉุกเฉิน": t.emergency_contact || '',
        "สถานะผู้เช่า": t.status || 'active',
        "หมายเหตุ": t.notes || '',
        "เลขห้อง": room?.room_number || '',
        "วันเริ่มสัญญา": activeBooking?.check_in_date || '',
        "วันสิ้นสุดสัญญา": activeBooking?.check_out_date || '',
        "เงินมัดจำ": activeBooking?.deposit_amount || '',
        "สถานะการจอง": activeBooking?.status || ''
      };
    });

    // สร้าง workbook และ worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ผู้เช่า");

    // ดาวน์โหลดไฟล์ Excel
    XLSX.writeFile(workbook, `tenants_data_${selectedBranchName}.xlsx`);
    toast.success('ดาวน์โหลดข้อมูลผู้เช่าสำเร็จ (Excel)');
    };

    // ⭐ จุดแก้ไข: เปลี่ยนฟังก์ชันนี้ใหม่ทั้งหมด เพื่อให้รับไฟล์จาก Google Sheets ได้
    const handleTenantImport = async (importedData) => {
    if (!selectedBranchId) throw new Error('ไม่พบสาขา');

    // ✅ ไม่ต้องทำความสะอาดอีก - ExcelUploader ทำให้แล้ว
    const cleanData = importedData;

    // Fetch rooms for validation
    const branchRooms = await base44.entities.Room.filter({ branch_id: selectedBranchId }, '-room_number', 1000);
    const existingTenants = await base44.entities.Tenant.filter({ branch_id: selectedBranchId }, '-created_date', 1000);
    const existingBookings = await base44.entities.Booking.filter({ branch_id: selectedBranchId, booking_type: 'monthly' }, '-created_date', 1000);

    let updatedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let bookingUpdatedCount = 0;
    let bookingFixedCount = 0;

    // ⭐ Loop ผ่านข้อมูลที่ล้างสะอาดแล้ว
    for (const record of cleanData) {
      console.log('🔍 [Excel Import] Processing record:', record);
      
      // ดึงข้อมูล (รองรับทั้งภาษาไทยและอังกฤษ) + แปลงตัวเลขให้เป็น string
      const tenantId = record.id || record['รหัส'];
      const fullName = record.full_name || record['ชื่อ-นามสกุล'];
      
      // ⚠️ CRITICAL: แปลงเบอร์โทร/เลขบัตรที่เป็นตัวเลขให้กลายเป็น string ก่อนบันทึก
      // ⭐ FIX: รองรับกรณี Excel ตัด 0 หน้าออก (เบอร์เป็น number)
      const rawPhone = record.phone || record['เบอร์โทร'];
      const phone = String(rawPhone || '').replace(/\s+/g, '').replace(/^0+/, ''); // ลบช่องว่าง + leading zeros
      
      const rawEmergency = record.emergency_contact || record['เบอร์ติดต่อฉุกเฉิน'];
      const emergencyPhone = String(rawEmergency || '').replace(/\s+/g, '').replace(/^0+/, '');
      
      const nationalId = String(record.national_id || record['เลขบัตรประชาชน'] || '').replace(/\s+/g, '');

      // ข้ามถ้าไม่มีชื่อ
      if (!fullName || String(fullName).trim() === '') {
        console.warn('❌ Skipping record without name:', record);
        skippedCount++;
        continue;
      }
      
      console.log('✅ Valid record - Name:', fullName, 'Phone:', phone);

      // --- ส่วนที่เหลือเหมือนเดิม (Logic การบันทึก) ---
      const existingTenant = tenantId ? existingTenants.find(t => t.id === tenantId) : null;
      
      // ✅ Safely parse age (handle both number and string)
      const rawAge = record.age || record['อายุ'];
      const parsedAge = rawAge ? parseInt(String(rawAge)) : undefined;
      
      // ✅ Ensure phone has leading 0 if it's missing (Thai phone format)
      // ⭐ FIX: เติม 0 ให้เบอร์ที่มีความยาว 9 หลัก (Excel ตัด 0 ออก)
      const formattedPhone = phone && phone.length >= 9 ? (phone.startsWith('0') ? phone : '0' + phone) : phone;
      const formattedEmergency = emergencyPhone && emergencyPhone.length >= 9 ? (emergencyPhone.startsWith('0') ? emergencyPhone : '0' + emergencyPhone) : emergencyPhone;
      
      const tenantData = {
        full_name: String(fullName).trim(),
        phone: formattedPhone,
        gender: record.gender || record['เพศ'] || existingTenant?.gender,
        age: !isNaN(parsedAge) && parsedAge > 0 ? parsedAge : existingTenant?.age,
        line_id: record.line_id || record['LINE ID'] || existingTenant?.line_id,
        national_id: nationalId || existingTenant?.national_id,
        email: record.email || record['อีเมล'] || existingTenant?.email,
        address: record.address || record['ที่อยู่'] || existingTenant?.address,
        emergency_contact: formattedEmergency || existingTenant?.emergency_contact, // ⭐ ใช้ formatted แทน
        notes: record.notes || record['หมายเหตุ'] || existingTenant?.notes,
        status: 'active', // ⚠️ FIXED: ผู้เช่าควรเป็น 'active' เสมอ (ไม่ใช้ 'สถานะการจอง')
        line_user_id: existingTenant?.line_user_id,
        branch_id: selectedBranchId
      };
      
      console.log('📝 [Excel] Tenant data prepared:', tenantData);

      let finalTenant;
      if (existingTenant) {
        await base44.entities.Tenant.update(existingTenant.id, tenantData);
        finalTenant = existingTenant;
        updatedCount++;
      } else {
        const newTenant = await base44.entities.Tenant.create(tenantData);
        existingTenants.push(newTenant);
        finalTenant = newTenant;
        createdCount++;
      }

      // จัดการ Booking (ถ้ามีเลขห้อง)
      const roomNumber = record.room_number || record['เลขห้อง'];
      if (roomNumber && String(roomNumber).trim() !== '') {
        const roomNumStr = String(roomNumber).trim();
        const room = branchRooms.find(r => r.room_number === roomNumStr);

        if (!room) {
          console.warn(`⚠️ Room not found: ${roomNumStr} - Skipping booking creation`);
        } else {
          console.log('✅ [Excel] Found room:', room.room_number, 'Creating booking...');
          
          // ✅ SAFE DATE PARSING: รองรับหลายรูปแบบ (YYYY-MM-DD, DD/MM/YYYY, Excel serial)
          const parseDate = (dateValue) => {
            if (!dateValue) return null;
            const str = String(dateValue).trim();
            
            // รูปแบบ YYYY-MM-DD (ISO)
            if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
            
            // รูปแบบ DD/MM/YYYY
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
              const [d, m, y] = str.split('/');
              return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
            }
            
            // Excel serial number (days since 1900-01-01)
            const num = parseFloat(str);
            if (!isNaN(num) && num > 40000) {
              const excelEpoch = new Date(1900, 0, 1);
              const date = new Date(excelEpoch.getTime() + (num - 2) * 24 * 60 * 60 * 1000);
              return date.toISOString().split('T')[0];
            }
            
            return null;
          };
          
          const checkInDate = parseDate(record.check_in_date || record['วันเริ่มสัญญา']) || new Date().toISOString().split('T')[0];
          const checkOutDate = parseDate(record.check_out_date || record['วันสิ้นสุดสัญญา']);
          const depositAmount = parseFloat(record.deposit_amount || record['เงินมัดจำ'] || 0);
          const bookingStatus = String(record.booking_status || record['สถานะการจอง'] || 'active').toLowerCase();

           const existingTenantBooking = existingBookings.find(b => b.tenant_id === finalTenant.id && b.room_id === room.id);
           
           const bookingData = {
             tenant_id: finalTenant.id,
             room_id: room.id,
             check_in_date: checkInDate,
             check_out_date: checkOutDate,
             deposit_amount: depositAmount,
             total_amount: room.price,
             booking_type: 'monthly',
             status: bookingStatus,
             branch_id: selectedBranchId
           };

           if (existingTenantBooking) {
             await base44.entities.Booking.update(existingTenantBooking.id, bookingData);
             bookingUpdatedCount++;
           } else {
             const newBooking = await base44.entities.Booking.create(bookingData);
             existingBookings.push(newBooking);
             bookingUpdatedCount++;
           }
           
           // อัพเดทสถานะห้อง
           const newRoomStatus = bookingStatus === 'active' ? 'occupied' : 'available';
           if (room.status !== newRoomStatus) {
              await base44.entities.Room.update(room.id, { status: newRoomStatus });
           }
        }
      }
    }

    // แจ้งเตือนผลลัพธ์
    let summaryParts = [];
    if (createdCount > 0) summaryParts.push(`สร้างใหม่ ${createdCount} คน`);
    if (updatedCount > 0) summaryParts.push(`อัพเดท ${updatedCount} คน`);
    if (bookingUpdatedCount > 0) summaryParts.push(`จัดการสัญญา ${bookingUpdatedCount} รายการ`);
    
    if (summaryParts.length > 0) {
      toast.success(`นำเข้าสำเร็จ: ${summaryParts.join(', ')}`);
    } else {
      toast.info('ไม่มีข้อมูลใหม่ที่ต้องนำเข้า');
    }
  };



  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
          <p className="text-slate-500 mt-2">โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <ScrollToTopButton />
      <PageHeader
        title="ผู้เช่า & สัญญาเช่า"
        subtitle={`สาขา ${selectedBranchName}`}
        icon={Users}
        actions={
          <>
            {activeTab === 'tenants' && (
              <>
                <Button
                  onClick={handleDownloadExistingTenants}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50 shadow-md"
                >
                  <Download className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">ดาวน์โหลดข้อมูล</span>
                </Button>
                <Button
                  onClick={() => setShowUploadDialog(true)}
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50 shadow-md"
                >
                  <Upload className="w-4 h-4 md:mr-2" />
                  <span className="hidden md:inline">นำเข้าข้อมูล</span>
                </Button>
                {canAdd && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
                        data-onboarding="add-tenant-button"
                      >
                        <Plus className="w-5 h-5 md:mr-2" />
                        <span className="hidden md:inline">เพิ่มผู้เช่า</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-56 p-2" align="end">
                      <div className="space-y-1">
                        <Button
                          onClick={() => {
                            setEditingTenant(null);
                            resetForm();
                            setShowDialog(true);
                          }}
                          variant="ghost"
                          className="w-full justify-start hover:bg-blue-50"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          เพิ่มผู้เช่าทีละคน
                        </Button>
                        <Button
                          onClick={() => setShowBulkTenantGenerator(true)}
                          variant="ghost"
                          className="w-full justify-start hover:bg-green-50 text-green-700"
                        >
                          <Users className="w-4 h-4 mr-2" />
                          เพิ่มหลายคนตามห้อง
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </>
              )}
              {activeTab === 'contracts' && (
              <ContractActionsBar canAddContract={canAddContract} isDeveloper={isDeveloper} />
              )}
              </>
              }
      />

      <div className="px-4 md:px-8 py-6 relative z-10">
        <div className="max-w-7xl mx-auto space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2 bg-white/60 backdrop-blur-sm p-1 rounded-2xl shadow-md">
              <TabsTrigger value="tenants" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-600 data-[state=active]:to-indigo-600 data-[state=active]:text-white">
                <Users className="w-4 h-4 mr-2" />
                ผู้เช่า
              </TabsTrigger>
              <TabsTrigger value="contracts" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-purple-600 data-[state=active]:to-pink-600 data-[state=active]:text-white">
                <ScrollText className="w-4 h-4 mr-2" />
                สัญญาเช่า
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tenants" className="mt-6 space-y-6">
              {showDevPanel && isDeveloper && (
                <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-300 shadow-xl rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        <h3 className="font-bold text-purple-900">🔒 เครื่องมือผู้พัฒนา</h3>
                      </div>
                      <Badge className="bg-purple-600 text-white">Developer Only</Badge>
                    </div>
                    
                    <div className="space-y-3">
                      <Alert className="bg-blue-50 border-blue-200">
                        <AlertCircle className="w-4 h-4 text-blue-600" />
                        <AlertDescription className="text-blue-800 text-sm">
                          <p className="font-semibold mb-1">📊 สร้าง TenantRating จาก Payment Scores</p>
                          <p className="text-xs">ผู้เช่าที่มี payment_scores แต่ยังไม่มี TenantRating จะถูกสร้างอัตโนมัติ</p>
                        </AlertDescription>
                      </Alert>

                      <Button
                        onClick={async () => {
                          if (!selectedBranchId) {
                            toast.error('กรุณาเลือกสาขาก่อน');
                            return;
                          }
                          
                          if (confirm(`สร้าง TenantRating จาก payment_scores สำหรับสาขา ${selectedBranchName}?`)) {
                            setCreatingRatings(true);
                            try {
                              const result = await base44.functions.invoke('createRatingsFromPaymentScores', {
                                branch_id: selectedBranchId
                              });
                              
                              if (result.data.success) {
                                queryClient.invalidateQueries(['tenantRatings', selectedBranchId]);
                                toast.success(result.data.message || `สร้างคะแนนสำเร็จ ${result.data.created} รายการ`);
                              } else {
                                toast.error(result.data.error || 'เกิดข้อผิดพลาด');
                              }
                            } catch (error) {
                              toast.error('เกิดข้อผิดพลาด: ' + error.message);
                            } finally {
                              setCreatingRatings(false);
                            }
                          }
                        }}
                        disabled={creatingRatings}
                        className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      >
                        {creatingRatings ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            กำลังสร้างคะแนน...
                          </>
                        ) : (
                          <>
                            <Star className="w-4 h-4 mr-2" />
                            สร้าง TenantRating อัตโนมัติ
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}



          <Card className="bg-white/60 backdrop-blur-2xl border border-white/80 shadow-2xl rounded-2xl md:rounded-3xl overflow-hidden">
            <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-gradient-to-br from-blue-200/20 to-sky-200/15 rounded-full blur-3xl" />
            <CardContent className="p-4 md:p-6 relative">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <AISearchBox
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    onAISearch={handleAISearch}
                    onStopSearch={handleStopAISearch}
                    aiSearching={aiSearching}
                    placeholder="ค้นหาผู้เช่า หรือถามเช่น 'ผู้เช่าที่ค้างชำระ' 'ผู้เช่าชั้น 3'"
                  />

                  {aiSearching && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl mt-4">
                      <div className="bg-white rounded-xl shadow-lg p-6 flex items-center gap-3">
                        <Loader2 className="w-6 h-6 text-purple-600 animate-spin" />
                        <p className="text-slate-700 font-medium">AI กำลังวิเคราะห์...</p>
                      </div>
                    </div>
                  )}
                </div>

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-10 w-10 translate-y-1">
                      <SlidersHorizontal className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-4 bg-white/95 backdrop-blur-2xl border-white/80 rounded-2xl shadow-2xl" align="start">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold text-slate-700">สถานะผู้เช่า:</Label>
                      {['active', 'moved_out', 'expiring_soon', 'near_payment', 'payment_overdue'].map(status => (
                        <div key={status} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`status-${status}`}
                            checked={selectedStatuses.includes(status)}
                            onChange={() => toggleStatus(status)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <label htmlFor={`status-${status}`} className="text-sm font-medium text-slate-700 cursor-pointer">
                            {getStatusLabel(status)}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

                {aiAction && (
                <AIActionConfirmation
                  action={aiAction}
                  onConfirm={handleConfirmAIAction}
                  onCancel={() => {
                    console.log('❌ AI action cancelled');
                    setAiAction(null);
                    toast.info('ยกเลิกการดำเนินการแล้ว - ไม่มีการเปลี่ยนแปลงข้อมูล');
                  }}
                  isLoading={executingAction}
                />
                )}

                {aiResult && !aiAction && (
                <AIResultCard aiResult={aiResult}>
                  {aiResult.tenants && aiResult.tenants.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-sm font-semibold text-purple-800">ผู้เช่าที่เกี่ยวข้อง:</p>
                      {aiResult.tenants.map((tenant, idx) => {
                        const tenantData = tenants.find(t => t.id === tenant.tenant_id);
                        const activeBookings = tenantData ? getActiveBookings(tenantData.id) : [];
                        const avgRating = tenantData ? getTenantAverageRating(tenantData.id) : null;

                        return (
                          <div key={idx} className="bg-white/70 rounded-lg p-3 border border-purple-200 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <User className="w-4 h-4 text-purple-600" />
                                  <span className="font-semibold text-slate-800">
                                    {tenant.full_name}
                                  </span>
                                  {avgRating !== null && (
                                    <Badge className="bg-yellow-100 text-yellow-700 text-xs">
                                      ⭐ {avgRating.toFixed(1)}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-slate-600 mb-2">{tenant.reason}</p>
                                {tenantData && (
                                  <div className="text-xs text-slate-500 space-y-0.5">
                                    <p>เบอร์โทร: {tenantData.phone}</p>
                                    {activeBookings.length > 0 && (
                                      <p>เช่าอยู่: {activeBookings.length} ห้อง</p>
                                    )}
                                  </div>
                                )}
                              </div>
                              {tenantData && (
                                <Button
                                  size="sm"
                                  onClick={() => handleTenantClick(tenantData)}
                                  className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 flex-shrink-0"
                                >
                                  ดูรายละเอียด
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </AIResultCard>
                )}


            </CardContent>
          </Card>

          

          <div className="flex items-center justify-between gap-3 flex-wrap md:flex-nowrap">
            <p className="text-sm text-slate-600 whitespace-nowrap">
              {debouncedSearch ? (
                <>
                  พบ <span className="font-semibold">{filteredTenants.length}</span> คน จากทั้งหมด {tenants.length} คน
                </>
              ) : (
                <>
                  ผู้เช่าในสาขานี้: <span className="font-semibold">{tenants.length} คน</span>
                </>
              )}
            </p>

            <div className="flex gap-2 items-center flex-shrink-0">
              <Button
                variant={isSelectionMode ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => {
                  const newSelectionMode = !isSelectionMode;
                  setIsSelectionMode(newSelectionMode);
                  if (!newSelectionMode) {
                    setSelectedTenants([]);
                  }
                }}
                className="shadow-sm"
              >
                {isSelectionMode ? (
                  <>
                    <X className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">ยกเลิก</span>
                  </>
                ) : (
                  <>
                    <CheckSquare className="w-4 h-4 md:mr-2" />
                    <span className="hidden md:inline">เลือกหลายรายการ</span>
                  </>
                )}
              </Button>

              <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 flex-shrink-0">
                <Button
                  variant={viewMode === 'card' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('card')}
                  className={`h-8 px-3 rounded-md ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
                >
                  <Grid3x3 className="w-4 h-4 md:mr-1" />
                  <span className="hidden md:inline text-xs">การ์ด</span>
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className={`h-8 px-3 rounded-md ${viewMode === 'table' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
                >
                  <TableIcon className="w-4 h-4 md:mr-1" />
                  <span className="hidden md:inline text-xs">ตาราง</span>
                </Button>
                <Button
                  variant={viewMode === 'room' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('room')}
                  className={`h-8 px-3 rounded-md ${viewMode === 'room' ? 'bg-blue-600 text-white' : 'text-slate-600'}`}
                >
                  <Home className="w-4 h-4 md:mr-1" />
                  <span className="hidden md:inline text-xs">ห้อง</span>
                </Button>
              </div>
            </div>
          </div>

          {tenantsLoading && tenants.length === 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[...Array(6)].map((_, i) => (
                <Card key={i} className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-slate-200 rounded-full flex-shrink-0"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-200 rounded" style={{ width: '70%' }}></div>
                        <div className="h-3 bg-slate-200 rounded" style={{ width: '50%' }}></div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-3 bg-slate-200 rounded" style={{ width: '80%' }}></div>
                      <div className="h-3 bg-slate-200 rounded" style={{ width: '60%' }}></div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      <div className="h-8 bg-slate-200 rounded flex-1"></div>
                      <div className="h-8 bg-slate-200 rounded flex-1"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredTenants.length === 0 && tenants.length > 0 && debouncedSearch ? (
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-8 text-center">
                <Search className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">ไม่พบผู้เช่าที่ตรงกับคำค้นหา</h3>
                <p className="text-slate-500 mb-4">ลองค้นหาด้วยคำอื่น หรือ</p>
                <Button
                  onClick={() => setSearchQuery('')}
                  variant="outline"
                  className="border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                >
                  ล้างการค้นหา
                </Button>
              </CardContent>
            </Card>
          ) : tenants.length === 0 ? (
            <Card className="bg-slate-50">
              <CardContent className="p-8 text-center">
                <Users className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">ยังไม่มีผู้เช่าในสาขานี้</h3>
                <p className="text-slate-500 mb-4">เริ่มต้นเพิ่มผู้เช่าคนแรกของคุณ</p>
                {canAdd && (
                  <Button
                    onClick={() => {
                      resetForm();
                      setShowDialog(true);
                    }}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    เพิ่มผู้เช่า
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : null}

          {viewMode === 'room' ? (
            // Room View - แสดงผู้เช่าแยกตามห้อง
            (() => {
              // หาห้องที่มี booking active ทุกประเภท (ไม่ filter เฉพาะ monthly)
              const roomsWithActiveBooking = new Set(
                bookings
                  .filter(b => b.status === 'active')
                  .map(b => b.room_id)
              );

              console.log('🔍 [Room View] Total rooms:', rooms.length);
              console.log('🔍 [Room View] Total bookings:', bookings.length);
              console.log('🔍 [Room View] Active bookings:', bookings.filter(b => b.status === 'active').length);
              console.log('🔍 [Room View] Rooms with active booking:', roomsWithActiveBooking.size);

              // จัดกลุ่มห้องตามชั้น - ใช้ห้องที่มี booking active + tenant ที่มีอยู่จริง
              const roomsByFloor = (Array.isArray(rooms) ? rooms : [])
                .filter(room => {
                  if (!roomsWithActiveBooking.has(room.id)) return false;
                  
                  // ⭐ เช็คว่า booking ของห้องนี้มี tenant ที่มีอยู่จริงหรือไม่
                  const roomBooking = bookings.find(b => 
                    b.room_id === room.id && 
                    b.status === 'active'
                  );
                  
                  // ถ้าไม่มี tenant_id หรือไม่เจอ tenant = ไม่แสดงห้องนี้
                  if (!roomBooking || !roomBooking.tenant_id) return false;
                  
                  const tenant = tenants.find(t => t.id === roomBooking.tenant_id);
                  return !!tenant; // แสดงเฉพาะห้องที่มี tenant อยู่จริง
                })
                .sort((a, b) => {
                  if (a.floor !== b.floor) return a.floor - b.floor;
                  return a.room_number.localeCompare(b.room_number);
                })
                .reduce((acc, room) => {
                  const floor = room.floor || 1;
                  if (!acc[floor]) acc[floor] = [];
                  acc[floor].push(room);
                  return acc;
                }, {});

              const floors = Object.keys(roomsByFloor).sort((a, b) => parseInt(a) - parseInt(b));

              if (floors.length === 0) {
                return (
                  <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="p-12 text-center">
                      <Home className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                      <h3 className="text-xl font-semibold text-slate-700 mb-2">ยังไม่มีห้องที่มีผู้เช่า</h3>
                      <p className="text-slate-500">เพิ่มผู้เช่าและสร้างสัญญาเช่าเพื่อดูมุมมองตามห้อง</p>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <div className="space-y-6">
                  {floors.map(floor => (
                    <div key={floor}>
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">ชั้น {floor}</Badge>
                        <span className="text-sm font-normal text-slate-500">({roomsByFloor[floor].length} ห้อง)</span>
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {roomsByFloor[floor].map(room => {
                          // หา booking ที่ active สำหรับห้องนี้ (ทุกประเภท)
                          const roomBooking = bookings.find(b => 
                            b.room_id === room.id && 
                            b.status === 'active'
                          );
                          const tenant = roomBooking ? tenants.find(t => t.id === roomBooking.tenant_id) : null;

                          // ⭐ ห้องนี้ไม่ควรแสดงในลิสต์ถ้าไม่มี tenant (ถูก filter ออกแล้วข้างบน)
                          const daysLeft = roomBooking ? getDaysUntilExpiry(roomBooking) : null;
                          const expiringSoon = roomBooking ? isContractExpiringSoon(roomBooking) : false;
                          const paymentStatus = roomBooking ? getPaymentStatus(roomBooking) : null;

                          return (
                            <motion.div
                              key={room.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              whileHover={{ scale: 1.02 }}
                              className="cursor-pointer"
                              onClick={() => tenant && handleTenantClick(tenant)}
                            >
                              <Card className={`relative overflow-hidden transition-all hover:shadow-xl ${
                                expiringSoon ? 'border-red-300 bg-red-50/50' :
                                paymentStatus?.isOverdue ? 'border-orange-300 bg-orange-50/50' :
                                'border-green-200 bg-white'
                              }`}>
                                {/* Room Number Header */}
                                <div className={`py-2 px-3 text-center font-bold text-white ${
                                  expiringSoon ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                  paymentStatus?.isOverdue ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                                  'bg-gradient-to-r from-green-500 to-emerald-600'
                                }`}>
                                  <span className="text-lg">ห้อง {room.room_number}</span>
                                </div>

                                <CardContent className="p-3 space-y-2">
                                  {tenant ? (
                                    <>
                                      {/* Tenant Info */}
                                      <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                                          <span className="text-white font-bold text-xs">{tenant.full_name?.charAt(0)}</span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                          <p className="font-semibold text-slate-800 text-sm truncate">{tenant.full_name}</p>
                                          {tenant.phone && (
                                            <p className="text-xs text-slate-500 truncate">{tenant.phone}</p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Status Badges */}
                                      <div className="flex flex-wrap gap-1">
                                        {expiringSoon && daysLeft !== null && (
                                          <Badge className="bg-red-100 text-red-700 text-[10px] px-1.5 py-0.5">
                                            <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
                                            {daysLeft}ว.
                                          </Badge>
                                        )}
                                        {paymentStatus?.isOverdue && (
                                          <Badge className="bg-orange-100 text-orange-700 text-[10px] px-1.5 py-0.5">
                                            ค้างชำระ
                                          </Badge>
                                        )}
                                        {paymentStatus?.isNearDue && !paymentStatus?.isOverdue && (
                                          <Badge className="bg-yellow-100 text-yellow-700 text-[10px] px-1.5 py-0.5">
                                            ใกล้ครบ
                                          </Badge>
                                        )}
                                      </div>

                                      {/* Contract Period */}
                                      {roomBooking?.check_in_date && roomBooking?.check_out_date && (
                                       <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-100 space-y-0.5">
                                         <div>เข้าพัก: {format(parseISO(roomBooking.check_in_date), 'd MMM', { locale: th })} {parseInt(roomBooking.check_in_date.split('-')[0]) + 543}</div>
                                         <div>หมดสัญญา: {format(parseISO(roomBooking.check_out_date), 'd MMM', { locale: th })} {parseInt(roomBooking.check_out_date.split('-')[0]) + 543}</div>
                                       </div>
                                      )}

                                      {/* Action Buttons */}
                                      <div className="flex gap-1 pt-2 border-t border-slate-100 mt-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="flex-1 h-7 text-xs text-blue-600 hover:bg-blue-50"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleTenantClick(tenant);
                                          }}
                                        >
                                          <Eye className="w-3 h-3 mr-1" />
                                          ดู
                                        </Button>
                                        {canEdit && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            className="flex-1 h-7 text-xs text-slate-600 hover:bg-slate-50"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleEdit(tenant);
                                            }}
                                          >
                                            <Edit2 className="w-3 h-3 mr-1" />
                                            แก้ไข
                                          </Button>
                                        )}
                                      </div>
                                      </>
                                      ) : (
                                      <div className="text-center py-4 text-slate-400 text-xs">
                                        <p className="mb-1">ไม่พบผู้เช่า</p>
                                        {roomBooking ? (
                                          <p className="text-[10px] text-red-500">
                                            ⚠️ มี booking แต่ไม่เจอผู้เช่า<br/>
                                            (ดู Console F12)
                                          </p>
                                        ) : (
                                          <p className="text-[10px]">ไม่มี booking</p>
                                        )}
                                      </div>
                                      )}
                                      </CardContent>
                                      </Card>
                                      </motion.div>
                                      );
                                      })}
                                      </div>
                                      </div>
                                      ))}
                                      </div>
                                      );
                                      })()
          ) : viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tenantCardsData.map(({ tenant, activeBookings, hasExpiringSoon, avgRating, paymentScore, vehicleCount, lastRoomNumber }) => (
                <div key={tenant.id} className="relative">
                  {isSelectionMode && (
                    <div
                      className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-lg border-2 flex items-center justify-center cursor-pointer transition-all ${
                        selectedTenants.includes(tenant.id)
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-white/90 border-slate-300 hover:border-blue-400'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTenantSelection(tenant.id);
                      }}
                    >
                      {selectedTenants.includes(tenant.id) && <Check className="w-4 h-4" />}
                    </div>
                  )}
                  <div 
                    className={`${isSelectionMode && selectedTenants.includes(tenant.id) ? 'ring-2 ring-blue-500 rounded-2xl' : ''} ${longPressTarget === tenant.id ? 'scale-95 transition-transform' : ''}`}
                    onMouseDown={(e) => {
                      if (!isSelectionMode) handleLongPressStart(e, tenant.id);
                    }}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    onTouchStart={(e) => {
                      if (!isSelectionMode) handleLongPressStart(e, tenant.id);
                    }}
                    onTouchEnd={handleLongPressEnd}
                    onTouchCancel={handleLongPressEnd}
                    onContextMenu={(e) => e.preventDefault()}
                  >
                    <TenantCard
                      tenant={tenant}
                      activeBookings={activeBookings}
                      hasExpiringSoon={hasExpiringSoon}
                      avgRating={avgRating}
                      paymentScore={paymentScore}
                      vehicleCount={vehicleCount}
                      onClick={(t) => {
                        if (isSelectionMode) {
                          toggleTenantSelection(t.id);
                        } else {
                          handleTenantClick(t);
                        }
                      }}
                      getRoomInfo={getRoomInfo}
                      isContractExpiringSoon={isContractExpiringSoon}
                      getDaysUntilExpiry={getDaysUntilExpiry}
                      lastRoomNumber={lastRoomNumber}
                      userRole={userRole}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg rounded-2xl overflow-hidden">
              {!isSelectionMode && (
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowRestoreDialog(true);
                      refetchDeletedTenants();
                    }}
                    className="text-green-600 hover:bg-green-50 text-xs"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" />
                    กู้คืนที่ลบ
                  </Button>
                </div>
              )}
              
              <ExcelTable
                tenants={displayedTenants}
                getActiveBookings={getActiveBookings}
                getRoomInfo={getRoomInfo}
                getTenantAverageRating={getTenantAverageRating}
                onCellUpdate={handleCellEdit}
                onBulkUpdate={async (updates) => {
                  await bulkUpdateFromTableMutation.mutateAsync(updates);
                }}
                onDelete={(id) => deleteMutation.mutate(id)}
                onAddBooking={handleAddBooking}
                canEdit={canEdit}
                canDelete={canDelete}
                canAddContract={canAddContract}
                isSelectionMode={isSelectionMode}
                selectedTenants={selectedTenants}
                onToggleSelection={toggleTenantSelection}
                onToggleSelectAll={toggleSelectAllInPage}
                deleteMutation={deleteMutation}
              />
            </Card>
          )}

          {displayLimit < filteredTenants.length && (
            <div ref={loadMoreRef} className="py-8 text-center">
              <div className="inline-flex items-center gap-2 text-slate-600">
                <div className="w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span>กำลังโหลดเพิ่ม...</span>
              </div>
            </div>
          )}

          {displayLimit >= filteredTenants.length && filteredTenants.length > 50 && (
            <Card className="bg-white/80 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <p className="text-sm text-slate-600">
                  แสดงครบทั้งหมด {filteredTenants.length} คน
                </p>
              </CardContent>
            </Card>
          )}

          <Dialog
            open={showDetailDialog}
            onOpenChange={(open) => {
              setShowDetailDialog(open);
              if (!open) {
                setSelectedTenant(null);
              }
            }}
          >
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              {selectedTenant && (
                <Tabs defaultValue="info" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-100 p-1 rounded-xl mb-6">
                    <TabsTrigger value="info" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <User className="w-4 h-4 mr-2" />
                      ข้อมูลทั่วไป
                    </TabsTrigger>
                    <TabsTrigger value="contract" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                      <ScrollText className="w-4 h-4 mr-2" />
                      สัญญาเช่า
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="info" className="space-y-6">
                  {(() => {
                    const avgRating = getTenantAverageRating(selectedTenant.id);
                    const latestRating = getLatestRating(selectedTenant.id);
                    const tenantRatings = ratings.filter(r => r.tenant_id === selectedTenant.id);

                    return (
                      <Card className="bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                              <Star className="w-5 h-5 text-yellow-500" />
                              คะแนนผู้เช่า
                            </h3>
                            {canEdit && (
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRateGuest(selectedTenant);
                                }}
                                className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                              >
                                <Star className="w-4 h-4 mr-1" />
                                ให้คะแนน
                              </Button>
                            )}
                          </div>

                          {(() => {
                          const paymentScore = selectedTenant.avg_payment_score;
                          const hasPaymentScores = selectedTenant.payment_scores?.length > 0;

                          // 🔍 Debug: ดูค่า paymentScore และ hasPaymentScores
                          console.log('🔍 [Rating Debug] Tenant:', selectedTenant.full_name);
                          console.log('  - avg_payment_score:', paymentScore, typeof paymentScore);
                          console.log('  - payment_scores:', selectedTenant.payment_scores);
                          console.log('  - hasPaymentScores:', hasPaymentScores);
                          console.log('  - avgRating (from TenantRating):', avgRating);

                          // ถ้ามีคะแนนจากการให้คะแนนแบบเต็มรูปแบบ
                          if (avgRating !== null) {
                          return (
                          <>
                          <div className="bg-white rounded-lg p-4">
                           <p className="text-sm text-slate-600 mb-2">คะแนนเฉลี่ย</p>
                           <RatingDisplay rating={avgRating} size="md" />
                           <p className="text-xs text-slate-500 mt-2">
                             จากการประเมิน {tenantRatings.length} ครั้ง
                           </p>
                          </div>

                          {latestRating && (
                           <div className="bg-white rounded-lg p-4 border border-yellow-200">
                             <p className="text-sm font-semibold text-slate-700 mb-3">
                               คะแนนล่าสุด: {latestRating.rating_period || (latestRating.rating_date && typeof latestRating.rating_date === 'string' ? format(parseISO(latestRating.rating_date), 'd MMM yyyy', { locale: th }) : 'N/A')}
                             </p>
                             <div className="grid grid-cols-3 gap-3 text-sm">
                               <div>
                                 <Label className="text-xs text-slate-600">การชำระเงิน</Label>
                                 <p className="font-bold text-green-600">{latestRating.payment_score}/10</p>
                               </div>
                               <div>
                                 <Label className="text-xs text-slate-600">รักษาทรัพย์สิน</Label>
                                 <p className="font-bold text-blue-600">{latestRating.property_care_score}/10</p>
                               </div>
                               <div>
                                 <Label className="text-xs text-slate-600">มารยาท</Label>
                                 <p className="font-bold text-purple-600">{latestRating.cohabitation_score}/10</p>
                               </div>
                             </div>
                             {latestRating.notes && (
                               <div className="mt-3 pt-3 border-t">
                                 <p className="text-xs text-slate-600">หมายเหตุ:</p>
                                 <p className="text-sm text-slate-700 mt-1">{latestRating.notes}</p>
                               </div>
                             )}
                             <p className="text-xs text-slate-400 mt-2">
                               ประเมินโดย: {latestRating.rated_by}
                             </p>
                           </div>
                          )}
                          </>
                          );
                          }

                          // ถ้ามีคะแนนการชำระเงินอัตโนมัติ แต่ยังไม่มีคะแนนเต็มรูปแบบ
                          // ⭐ แก้ไข: เช็คว่า paymentScore มีค่า (รวมถึง 0 ด้วย) หรือมี payment_scores
                          if ((paymentScore !== null && paymentScore !== undefined) || hasPaymentScores) {
                          // ⭐ แก้ไข: ถ้า paymentScore เป็น null/undefined แต่มี payment_scores ให้คำนวณเอง
                          const actualPaymentScore = paymentScore ?? (hasPaymentScores 
                            ? selectedTenant.payment_scores.reduce((sum, p) => sum + (p.score || 0), 0) / selectedTenant.payment_scores.length 
                            : 0);
                          const stars = (actualPaymentScore / 10) * 5;
                          return (
                          <>
                          <div className="bg-white rounded-lg p-4">
                           <p className="text-sm text-slate-600 mb-2">คะแนนการชำระเงิน</p>
                           <RatingDisplay rating={stars} size="md" />
                           <div className="flex items-center justify-between mt-3">
                             <p className="text-xs text-slate-500">
                               จากประวัติการชำระ {hasPaymentScores ? selectedTenant.payment_scores.length : 0} ครั้ง
                             </p>
                             <Badge className="bg-green-100 text-green-700 text-xs">
                               {actualPaymentScore.toFixed(1)}/10
                             </Badge>
                           </div>
                          </div>

                          {hasPaymentScores && selectedTenant.payment_scores.length > 0 && (
                          <div className="mt-2">
                            <button
                              onClick={() => setShowPaymentHistory(!showPaymentHistory)}
                              className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
                            >
                              {showPaymentHistory ? '▼ ซ่อนประวัติการชำระเงิน' : `▶ ดูประวัติการชำระเงิน (${selectedTenant.payment_scores.length} ครั้ง)`}
                            </button>
                            {showPaymentHistory && (
                              <div className="mt-3 space-y-2 max-h-40 overflow-y-auto pl-4 border-l-2 border-green-400">
                                {selectedTenant.payment_scores.slice(-5).reverse().map((scoreRecord, idx) => (
                                  <div key={idx} className="text-xs flex justify-between items-center py-1">
                                    <span className="text-slate-600">
                                      {scoreRecord.days_diff <= 0 ? (
                                        <span className="text-green-700 font-medium">
                                          {scoreRecord.days_diff === 0 ? '✓ ตรงเวลา' : `✓ ก่อนกำหนด ${Math.abs(scoreRecord.days_diff)} วัน`}
                                        </span>
                                      ) : (
                                        <span className="text-red-700 font-medium">⚠ หลังกำหนด {scoreRecord.days_diff} วัน</span>
                                      )}
                                    </span>
                                    <Badge className={`text-xs ${
                                      scoreRecord.score >= 8 ? 'bg-green-100 text-green-700' :
                                      scoreRecord.score >= 5 ? 'bg-yellow-100 text-yellow-700' :
                                      'bg-red-100 text-red-700'
                                    }`}>
                                      {scoreRecord.score}/10
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          )}
                          </>
                          );
                          }

                          // ถ้าไม่มีคะแนนเลย
                          return (
                          <div className="bg-white rounded-lg p-6 text-center">
                          <Star className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-600 mb-4">ยังไม่มีคะแนนสำหรับผู้เช่ารายนี้</p>
                          {canEdit && (
                          <Button
                           size="sm"
                           onClick={(e) => {
                             e.stopPropagation();
                             handleRateGuest(selectedTenant);
                           }}
                           className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                          >
                           <Star className="w-4 h-4 mr-1" />
                           ให้คะแนนครั้งแรก
                          </Button>
                          )}
                          </div>
                          );
                          })()}
                        </CardContent>
                      </Card>
                    );
                  })()}

                  <Card className="bg-slate-50 border-slate-200">
                    <CardContent className="p-4 space-y-3">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <User className="w-5 h-5" />
                        ข้อมูลส่วนตัว
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <Label className="text-slate-600">ชื่อ-นามสกุล</Label>
                          <p className="font-semibold">{selectedTenant.full_name}</p>
                        </div>
                        <div>
                          <Label className="text-slate-600">เบอร์โทร</Label>
                          <p className="font-semibold">{selectedTenant.phone}</p>
                        </div>
                        {selectedTenant.email && (
                          <div>
                            <Label className="text-slate-600">อีเมล</Label>
                            <p className="font-semibold">{selectedTenant.email}</p>
                          </div>
                        )}
                        {selectedTenant.line_id && (
                          <div>
                            <Label className="text-slate-600">LINE ID</Label>
                            <p className="font-semibold">{selectedTenant.line_id}</p>
                          </div>
                        )}
                        {selectedTenant.national_id && (
                          <div>
                            <Label className="text-slate-600">เลขบัตรประชาชน</Label>
                            <p className="font-semibold">{selectedTenant.national_id}</p>
                          </div>
                        )}
                        {selectedTenant.emergency_contact && (
                          <div>
                            <Label className="text-slate-600">เบอร์ติดต่อฉุกเฉิน</Label>
                            <p className="font-semibold">{selectedTenant.emergency_contact}</p>
                          </div>
                        )}
                        {selectedTenant.address && (
                          <div className="col-span-2">
                            <Label className="text-slate-600">ที่อยู่เดิม</Label>
                            <p className="font-semibold">{selectedTenant.address}</p>
                          </div>
                        )}
                      </div>
                      {selectedTenant.id_card_image && (
                        <div>
                          <Label className="text-slate-600">รูปบัตรประชาชน</Label>
                          <img
                            src={selectedTenant.id_card_image}
                            alt="บัตรประชาชน"
                            className="mt-2 w-full max-w-md h-48 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <div className="bg-white rounded-lg p-3 border border-slate-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
                                <Wallet className="w-5 h-5 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-600">เงินชำระล่วงหน้า</p>
                                <p className="font-bold text-lg text-green-700">
                                    {(selectedTenant.prepaid_balance || 0).toLocaleString()} ฿
                                </p>
                            </div>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => setShowPrepaidDialog(true)}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                        >
                            <Edit2 className="w-4 h-4 mr-1" />
                            จัดการเงิน
                        </Button>
                    </div>
                  </div>

                  {selectedTenant?.vehicles?.length > 0 && (
                    <Card className="bg-purple-50 border-purple-200">
                      <CardContent className="p-4 space-y-3">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2">
                          <Car className="w-5 h-5 text-purple-600" />
                          ข้อมูลยานพาหนะ ({selectedTenant.vehicles.length} คัน)
                        </h3>
                        <div className="space-y-2">
                          {selectedTenant.vehicles.map((vehicle, index) => (
                            <div key={index} className="bg-white rounded-lg p-3 border border-purple-200">
                              <Badge className={vehicle.type === 'car' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                                {vehicle.type === 'car' ? '🚗 รถยนต์' : '🏍️ มอเตอร์ไซค์'}
                              </Badge>
                              <p className="font-semibold mt-1">ทะเบียน: {vehicle.plate}</p>
                              {vehicle.brand && (
                                <p className="text-sm text-slate-600">ยี่ห้อ/รุ่น: {vehicle.brand}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {selectedTenant.notes && (
                    <Card className="bg-amber-50 border-amber-200">
                      <CardContent className="p-4">
                        <Label className="text-slate-600">หมายเหตุ</Label>
                        <p className="text-slate-800 mt-1">{selectedTenant.notes}</p>
                      </CardContent>
                    </Card>
                  )}

                  </TabsContent>

                  <TabsContent value="contract" className="space-y-6">
                    {(() => {
                      const activeBookings = getActiveBookings(selectedTenant.id);
                      if (activeBookings.length > 0) {
                        return (
                          <Card className="bg-green-50 border-green-200">
                            <CardContent className="p-4 space-y-3">
                              <div className="flex justify-between items-center">
                                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                  <Home className="w-5 h-5 text-green-600" />
                                  สัญญาเช่ารายเดือนปัจจุบัน ({activeBookings.length} ห้อง)
                                </h3>
                                {canAddContract && (
                                  <Button
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddBooking(selectedTenant);
                                    }}
                                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                  >
                                    <Plus className="w-4 h-4 mr-1" />
                                    เพิ่มสัญญาใหม่
                                  </Button>
                                )}
                              </div>
                              <div className="space-y-4">
                                {activeBookings.map((booking) => {
                                    const room = getRoomInfo(booking.room_id);
                                    const daysLeft = getDaysUntilExpiry(booking);
                                    const expiringSoon = isContractExpiringSoon(booking);
                                    const paymentStatus = getPaymentStatus(booking);
                                    const isExpired = daysLeft !== null && daysLeft < 0;

                                    return (
                                      <div key={booking.id} className={`rounded-lg p-4 border relative group ${isExpired ? 'bg-red-50 border-red-200' : 'bg-white border-green-200'}`}>
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          {!isExpired && canEditContract && (
                                             <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                                title="ทำให้หมดอายุ"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (confirm(`คุณแน่ใจว่าต้องการสิ้นสุดสัญญาเช่าห้อง ${room?.room_number}? การดำเนินการนี้จะเปลี่ยนสถานะห้องเป็นว่าง`)) {
                                                    expireBookingMutation.mutate(booking);
                                                  }
                                                }}
                                                disabled={expireBookingMutation.isPending}
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </Button>
                                          )}
                                          {canEditContract && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleEditBooking(selectedTenant, booking);
                                              }}
                                            >
                                              <Edit2 className="w-4 h-4" />
                                            </Button>
                                          )}
                                          {canDeleteContract && (
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                if (confirm('คุณแน่ใจว่าต้องการลบสัญญาเช่านี้?')) {
                                                  deleteBookingMutation.mutate(booking);
                                                }
                                              }}
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          )}
                                        </div>
                                        <div className="flex items-start justify-between mb-3">
                                          <div>
                                            <p className="font-bold text-lg text-slate-800">
                                              ห้อง {room?.room_number || 'N/A'}
                                            </p>
                                            <p className="text-sm text-slate-600">ผู้เช่า: {selectedTenant.full_name}</p>
                                          </div>
                                          {isExpired ? (
                                              <Badge className="bg-red-500 text-white">หมดอายุ</Badge>
                                          ) : expiringSoon && daysLeft !== null && (
                                            <Badge className="bg-red-500 text-white">
                                              <AlertTriangle className="w-3 h-3 mr-1" />
                                              เหลือ {daysLeft} วัน
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                                          {booking.check_in_date && (
                                           <div>
                                             <Label className="text-slate-600">วันเริ่มสัญญา</Label>
                                             <p className="font-semibold flex items-center gap-1">
                                               <Calendar className="w-3 h-3 text-green-600" />
                                               {typeof booking.check_in_date === 'string' && !isNaN(parseISO(booking.check_in_date).getTime()) ? (
                                                 <>
                                                   {format(parseISO(booking.check_in_date), 'd MMM', { locale: th })} {parseInt(booking.check_in_date.split('-')[0]) + 543}
                                                 </>
                                               ) : 'N/A'}
                                             </p>
                                           </div>
                                          )}
                                          {booking.check_out_date && (
                                            <div>
                                              <Label className="text-slate-600">วันสิ้นสุดสัญญา</Label>
                                              <p className={`font-semibold flex items-center gap-1 ${isExpired ? 'text-red-600' : ''}`}>
                                                <Calendar className="w-3 h-3 text-red-600" />
                                                {typeof booking.check_out_date === 'string' && !isNaN(parseISO(booking.check_out_date).getTime()) ? (
                                                  <>
                                                    {format(parseISO(booking.check_out_date), 'd MMM', { locale: th })} {parseInt(booking.check_out_date.split('-')[0]) + 543}
                                                  </>
                                                ) : 'N/A'}
                                              </p>
                                            </div>
                                          )}
                                          {booking.deposit_amount > 0 && (
                                            <div>
                                              <Label className="text-slate-600">เงินมัดจำ</Label>
                                              <p className="font-semibold">{booking.deposit_amount.toLocaleString()} บาท</p>
                                            </div>
                                          )}
                                        </div>

                                        {paymentStatus && paymentStatus.payment && !isExpired && (
                                          <div className="pt-3 border-t border-green-200">
                                            <Label className="text-slate-600 flex items-center gap-2 mb-2">
                                              <DollarSign className="w-4 h-4" />
                                              การชำระเงินล่าสุด
                                            </Label>
                                            <div className={`p-3 rounded-lg ${
                                              paymentStatus.isOverdue ? 'bg-red-100 border-red-300' : 'bg-yellow-100 border-yellow-300'
                                            } border`}>
                                              <p className="font-semibold text-sm">
                                                {paymentStatus.isOverdue ? (
                                                  <span className="text-red-700 flex items-center gap-1">
                                                    <DollarSign className="w-4 h-4" />
                                                    เกินกำหนดชำระแล้ว {Math.abs(paymentStatus.daysUntilDue)} วัน
                                                  </span>
                                                ) : (
                                                  <span className="text-yellow-700 flex items-center gap-1">
                                                    <Clock className="w-4 h-4" />
                                                    ใกล้ถึงกำหนดชำระ (อีก {paymentStatus.daysUntilDue} วัน)
                                                  </span>
                                                )}
                                              </p>
                                              <p className="text-xs text-slate-600 mt-1">
                                                ครบกำหนด: {paymentStatus.payment.due_date && typeof paymentStatus.payment.due_date === 'string' && !isNaN(parseISO(paymentStatus.payment.due_date).getTime()) ? format(parseISO(paymentStatus.payment.due_date), 'd MMM yyyy', { locale: th }) : 'N/A'}
                                              </p>
                                              <p className="text-sm font-bold mt-1">
                                                จำนวน: {paymentStatus.payment.total_amount?.toLocaleString() || 0} บาท
                                              </p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      } else {
                        return (
                          <Card className="bg-slate-50 border-slate-200">
                            <CardContent className="p-6 text-center">
                              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                              <p className="text-slate-600 mb-4">ยังไม่มีสัญญาเช่าสำหรับผู้เช่ารายนี้</p>
                              {canAddContract && (
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddBooking(selectedTenant);
                                  }}
                                  className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                                >
                                  <Plus className="w-4 h-4 mr-2" />
                                  เพิ่มสัญญาเช่าใหม่
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        );
                      }
                    })()}

                    {/* รูปภาพสัญญาเช่า */}
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-slate-800 flex items-center gap-2">
                            <Camera className="w-5 h-5 text-blue-600" />
                            รูปภาพสัญญาเช่า
                          </h3>
                          {canEdit && (selectedTenant.contract_images?.length || 0) < 10 && (
                            <label className="cursor-pointer">
                              <Button
                                size="sm"
                                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                                asChild
                              >
                                <span>
                                  <Plus className="w-4 h-4 mr-1" />
                                  เพิ่มรูป
                                </span>
                              </Button>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  
                                  try {
                                    toast.info('กำลังอัปโหลดรูปสัญญา...');
                                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                    const currentImages = selectedTenant.contract_images || [];
                                    
                                    if (currentImages.length >= 10) {
                                      toast.error('อัปโหลดได้สูงสุด 10 รูปเท่านั้น');
                                      return;
                                    }
                                    
                                    await base44.entities.Tenant.update(selectedTenant.id, {
                                      contract_images: [...currentImages, file_url]
                                    });
                                    
                                    queryClient.invalidateQueries(['tenants', selectedBranchId]);
                                    setSelectedTenant({ ...selectedTenant, contract_images: [...currentImages, file_url] });
                                    toast.success('เพิ่มรูปสัญญาสำเร็จ');
                                  } catch (error) {
                                    toast.error('อัปโหลดรูปไม่สำเร็จ');
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>

                        {selectedTenant.contract_images?.length > 0 ? (
                          <div className="grid grid-cols-2 gap-3">
                            {selectedTenant.contract_images.map((imageUrl, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={imageUrl}
                                  alt={`สัญญา ${index + 1}`}
                                  className="w-full h-32 object-cover rounded-lg border-2 border-blue-200 cursor-pointer hover:scale-105 transition-transform"
                                  onClick={() => window.open(imageUrl, '_blank')}
                                />
                                {canEdit && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="absolute top-1 right-1 bg-white/90 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:bg-red-50"
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (confirm('ลบรูปนี้?')) {
                                        const newImages = selectedTenant.contract_images.filter((_, i) => i !== index);
                                        await base44.entities.Tenant.update(selectedTenant.id, {
                                          contract_images: newImages
                                        });
                                        queryClient.invalidateQueries(['tenants', selectedBranchId]);
                                        setSelectedTenant({ ...selectedTenant, contract_images: newImages });
                                        toast.success('ลบรูปสำเร็จ');
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                                <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                                  {index + 1}/{selectedTenant.contract_images.length}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="bg-white rounded-lg p-8 text-center border-2 border-dashed border-blue-300">
                            <Camera className="w-12 h-12 text-blue-300 mx-auto mb-3" />
                            <p className="text-slate-600 mb-3">ยังไม่มีรูปสัญญาเช่า</p>
                            {canEdit && (
                              <label className="cursor-pointer">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-blue-300 text-blue-600 hover:bg-blue-50"
                                  asChild
                                >
                                  <span>
                                    <Upload className="w-4 h-4 mr-2" />
                                    อัปโหลดรูปสัญญา
                                  </span>
                                </Button>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    
                                    try {
                                      toast.info('กำลังอัปโหลดรูปสัญญา...');
                                      const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                      
                                      await base44.entities.Tenant.update(selectedTenant.id, {
                                        contract_images: [file_url]
                                      });
                                      
                                      queryClient.invalidateQueries(['tenants', selectedBranchId]);
                                      setSelectedTenant({ ...selectedTenant, contract_images: [file_url] });
                                      toast.success('เพิ่มรูปสัญญาสำเร็จ');
                                    } catch (error) {
                                      toast.error('อัปโหลดรูปไม่สำเร็จ');
                                    }
                                  }}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </div>
                        )}

                        {selectedTenant.contract_images?.length > 0 && (
                          <p className="text-xs text-slate-500 text-center">
                            คลิกที่รูปเพื่อดูขนาดเต็ม • อัปโหลดได้สูงสุด 10 รูป
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}

              {selectedTenant && (
                <div className="pt-4 border-t">
                  {/* Messaging Platforms Connection - Responsive Layout */}
                  <div className="space-y-3">
                    {/* LINE */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-200">
                     <div className="flex items-center gap-2">
                       <svg className="w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
                         <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.193 0-.378-.09-.503-.234l-1.89-2.181v1.787c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.27.173-.51.43-.595.063-.021.13-.03.196-.03.195 0 .38.089.503.234l1.89 2.181V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.001zm-5.741 0c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.003zm-2.466.63H4.917c-.345 0-.63-.285-.63-.63V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629z"/>
                       </svg>
                       <span className="text-sm font-medium text-slate-700">LINE:</span>
                       {selectedTenant.line_user_id ? (
                         <span className="text-sm text-green-600 font-medium flex items-center gap-1">
                           <CheckCircle2 className="w-3.5 h-3.5" /> เชื่อมต่อแล้ว
                         </span>
                       ) : (
                         <span className="text-sm text-slate-500">ยังไม่เชื่อมต่อ</span>
                       )}
                     </div>
                     {selectedTenant.line_user_id ? (
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={async () => {
                           if (confirm('ยกเลิกการเชื่อมต่อ LINE?')) {
                             await base44.entities.Tenant.update(selectedTenant.id, { line_user_id: null });
                             queryClient.invalidateQueries(['tenants', selectedBranchId]);
                             setSelectedTenant({ ...selectedTenant, line_user_id: null });
                             toast.success('ยกเลิกการเชื่อมต่อ LINE สำเร็จ');
                           }
                         }}
                         className="text-red-600 hover:bg-red-50"
                       >
                         <X className="w-3.5 h-3.5 mr-1" />
                         ยกเลิก
                       </Button>
                     ) : (
                       <LineConnectButton tenant={selectedTenant} size="sm" />
                     )}
                    </div>

                    {/* Facebook */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-3 border border-blue-200">
                     <div className="flex items-center gap-2">
                       <Facebook className="w-5 h-5 text-blue-600" />
                       <span className="text-sm font-medium text-slate-700">Facebook:</span>
                       {selectedTenant.facebook_user_id ? (
                         <span className="text-sm text-blue-600 font-medium flex items-center gap-1">
                           <CheckCircle2 className="w-3.5 h-3.5" /> เชื่อมต่อแล้ว
                         </span>
                       ) : (
                         <span className="text-sm text-slate-500">ยังไม่เชื่อมต่อ</span>
                       )}
                     </div>
                     {selectedTenant.facebook_user_id ? (
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={async () => {
                           if (confirm('ยกเลิกการเชื่อมต่อ Facebook?')) {
                             await base44.entities.Tenant.update(selectedTenant.id, { facebook_user_id: null });
                             queryClient.invalidateQueries(['tenants', selectedBranchId]);
                             setSelectedTenant({ ...selectedTenant, facebook_user_id: null });
                             toast.success('ยกเลิกการเชื่อมต่อ Facebook สำเร็จ');
                           }
                         }}
                         className="text-red-600 hover:bg-red-50"
                       >
                         <X className="w-3.5 h-3.5 mr-1" />
                         ยกเลิก
                       </Button>
                     ) : (
                       <Button
                         size="sm"
                         variant="outline"
                         className="text-blue-600 hover:bg-blue-50 border-blue-300"
                         disabled
                       >
                         เชื่อมต่อ
                       </Button>
                     )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    {selectedTenant.status !== 'moved_out' && canEdit && (
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // หาเงินมัดจำจาก active bookings
                          const activeBookings = getActiveBookings(selectedTenant.id);
                          const totalDeposit = activeBookings.reduce((sum, b) => sum + (b.deposit_amount || 0), 0);
                          setMoveOutData({
                            returnDeposit: totalDeposit > 0,
                            depositAmount: totalDeposit.toString(),
                            depositNotes: ''
                          });
                          setShowMoveOutDialog(true);
                        }}
                        disabled={moveOutMutation.isPending}
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        ย้ายออก
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        variant="outline"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEdit(selectedTenant);
                          setShowDetailDialog(false);
                        }}
                      >
                        <Edit2 className="w-4 h-4 mr-2" />
                        แก้ไข
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      disabled={deleteMutation.isPending}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!canDelete) {
                          toast.error('คุณไม่มีสิทธิ์ลบผู้เช่า');
                          return;
                        }
                        const confirmDelete = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้เช่า "${selectedTenant.full_name}"?\n\n⚠️ การกระทำนี้จะลบข้อมูลสัญญาเช่าและข้อมูลอื่นๆ ที่เกี่ยวข้องทั้งหมดของผู้เช่ารายนี้อย่างถาวร`);
                        if (confirmDelete) {
                          deleteMutation.mutate(selectedTenant.id);
                        }
                      }}
                    >
                      {deleteMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          กำลังลบ...
                        </>
                      ) : (
                        <>
                          <Trash2 className="w-4 h-4 mr-2" />
                          ลบผู้เช่า {!canDelete && '(ไม่มีสิทธิ์)'}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <RatingDialog
            open={showRatingDialog}
            onOpenChange={(open) => {
              setShowRatingDialog(open);
              if (!open) {
                setSelectedTenant(null);
              }
            }}
            tenant={selectedTenant}
            onSubmit={handleRatingSubmit}
            isLoading={createRatingMutation.isPending}
          />

          <PrepaidDialog
            open={showPrepaidDialog}
            onOpenChange={setShowPrepaidDialog}
            tenant={selectedTenant}
            onSuccess={() => {
              queryClient.invalidateQueries(['tenants', selectedBranchId]);
            }}
          />

          <Dialog
            open={showBookingDialog}
            onOpenChange={(open) => {
              setShowBookingDialog(open);
              if (!open) {
                resetBookingForm();
                setSelectedTenant(null);
                setEditingBooking(null);
              }
            }}
          >
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingBooking ? 'แก้ไขสัญญาเช่า' : 'เพิ่มสัญญาเช่ารายเดือนสำหรับ:'} {selectedTenant?.full_name}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleBookingSubmit} className="space-y-4">
                <div>
                  <Label>เลือกห้อง *</Label>
                  <select
                    value={bookingFormData.room_id}
                    onChange={(e) => setBookingFormData({ ...bookingFormData, room_id: e.target.value })}
                    required
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="">เลือกห้อง</option>
                    {(Array.isArray(rooms) ? rooms : [])
                      .filter(room => room.status === 'available' || (editingBooking && room.id === editingBooking.room_id))
                      .sort((a, b) => {
                        if (a.floor !== b.floor) return a.floor - b.floor;
                        return a.room_number.localeCompare(b.room_number);
                      })
                      .map(room => {
                        const statusText = room.status === 'available' ? 'ว่าง' :
                                          room.status === 'occupied' ? 'มีผู้เช่า' : 'จอง';
                        return (
                          <option key={room.id} value={room.id}>
                            ห้อง {room.room_number} - ชั้น {room.floor} ({room.price.toLocaleString()} บาท/เดือน) {room.status !== 'available' && !editingBooking ? `(${statusText})` : ''}
                          </option>
                        );
                      })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>วันเริ่มสัญญา *</Label>
                    <Input
                      type="date"
                      value={bookingFormData.check_in_date}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, check_in_date: e.target.value })}
                      required
                    />
                    {bookingFormData.check_in_date && (
                      <p className="text-xs text-slate-500 mt-1">
                        ({format(parseISO(bookingFormData.check_in_date), 'd MMM yyyy', { locale: th })} - พ.ศ. {parseInt(bookingFormData.check_in_date.split('-')[0]) + 543})
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>วันสิ้นสุดสัญญา</Label>
                    <Input
                      type="date"
                      value={bookingFormData.check_out_date}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, check_out_date: e.target.value })}
                    />
                    {bookingFormData.check_out_date && (
                      <p className="text-xs text-slate-500 mt-1">
                        ({format(parseISO(bookingFormData.check_out_date), 'd MMM yyyy', { locale: th })} - พ.ศ. {parseInt(bookingFormData.check_out_date.split('-')[0]) + 543})
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <Label>เงินมัดจำ (บาท)</Label>
                  <Input
                    type="number"
                    value={bookingFormData.deposit_amount}
                    onChange={(e) => setBookingFormData({ ...bookingFormData, deposit_amount: e.target.value })}
                    disabled={!canEditDeposit}
                    className={!canEditDeposit ? "bg-slate-100 text-slate-500" : ""}
                  />
                  {!canEditDeposit && <p className="text-xs text-red-500 mt-1">* คุณไม่มีสิทธิ์แก้ไขเงินมัดจำ</p>}
                </div>

                {/* Checkbox สร้างบิลค่าเช่า */}
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border-2 border-green-200">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="create_payment_booking"
                      checked={bookingFormData.create_payment}
                      onChange={(e) => setBookingFormData({ ...bookingFormData, create_payment: e.target.checked })}
                      className="w-5 h-5 rounded border-green-300 text-green-600 focus:ring-green-500"
                    />
                    <Label htmlFor="create_payment_booking" className="text-sm font-semibold text-green-900 cursor-pointer">
                      💳 สร้างบิลค่าเช่าพร้อมกัน
                    </Label>
                  </div>
                  {editingBooking && (
                    <p className="text-xs text-orange-600 mt-2 ml-8">
                      ⚠️ หากติ๊กเลือก จะสร้างบิลใหม่เพิ่ม (ระวังบิลซ้ำ)
                    </p>
                  )}
                </div>

                {bookingFormData.create_payment && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
                  <Label className="text-sm font-semibold text-blue-900 mb-3 block">💳 รูปแบบการชำระเงิน</Label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 p-3 bg-white rounded-lg border-2 border-blue-300 cursor-pointer hover:bg-blue-50 transition-colors">
                      <input
                        type="radio"
                        name="payment_timing"
                        value="pay_first"
                        checked={bookingFormData.payment_timing === 'pay_first'}
                        onChange={(e) => setBookingFormData({ ...bookingFormData, payment_timing: e.target.value })}
                        className="w-5 h-5 mt-0.5"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">💵 ชำระก่อนเข้าอยู่</p>
                        <p className="text-xs text-slate-600 mt-1">สร้างบิลทันทีเมื่อเพิ่มผู้เช่าใหม่</p>
                      </div>
                    </label>
                    <label className="flex items-start gap-3 p-3 bg-white rounded-lg border-2 border-slate-300 cursor-pointer hover:bg-slate-50 transition-colors">
                      <input
                        type="radio"
                        name="payment_timing"
                        value="stay_first"
                        checked={bookingFormData.payment_timing === 'stay_first'}
                        onChange={(e) => setBookingFormData({ ...bookingFormData, payment_timing: e.target.value })}
                        className="w-5 h-5 mt-0.5"
                      />
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">🏠 อยู่ก่อนค่อยชำระ</p>
                        <p className="text-xs text-slate-600 mt-1">สร้างบิลเดือนถัดไป</p>
                      </div>
                    </label>
                  </div>
                </div>
                )}

                <div>
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    value={bookingFormData.notes}
                    onChange={(e) => setBookingFormData({ ...bookingFormData, notes: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowBookingDialog(false);
                      resetBookingForm();
                    }}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-green-600 to-emerald-600"
                    disabled={createBookingMutation.isPending || updateBookingMutation.isPending}
                  >
                    {createBookingMutation.isPending || updateBookingMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        กำลังบันทึก...
                      </>
                    ) : (
                      editingBooking ? 'บันทึกการแก้ไข' : 'สร้างสัญญาเช่า'
                    )}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog
            open={showDialog}
            onOpenChange={(open) => {
              setShowDialog(open);
              if (!open) {
                resetForm();
                setEditingTenant(null);
              }
            }}
          >
            <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingTenant ? 'แก้ไขข้อมูลผู้เช่า' : 'เพิ่มผู้เช่าใหม่'}</DialogTitle>
              </DialogHeader>

              {!editingTenant && currentUser?.onboarding_mode_enabled && currentUser?.onboarding_current_step === 3 && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="space-y-2">
                      <p className="font-semibold text-blue-900">💡 คำแนะนำ:</p>
                      <p className="text-sm text-blue-800">
                        <strong>ใส่เบอร์โทรของคุณเอง</strong> เพื่อทดสอบระบบแจ้งเตือน
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-3">
                      <Camera className="w-5 h-5 text-blue-600" />
                      รูปบัตรประชาชน
                    </h3>
                    <p className="text-sm text-blue-700 mb-3 flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      อัปโหลดรูปบัตรประชาชนแล้วระบบจะกรอกข้อมูลอัตโนมัติให้
                    </p>
                    <div className="space-y-3">
                      <label className="flex items-center justify-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-blue-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 cursor-pointer transition-all">
                        <Upload className="w-5 h-5 text-blue-600" />
                        <span className="text-sm font-medium text-blue-700">
                          {uploadingImage ? 'กำลังอัปโหลด...' : extractingData ? 'กำลังอ่านข้อมูล...' : 'คลิกเพื่ออัปโหลดบัตรประชาชน'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          disabled={uploadingImage || extractingData}
                          className="hidden"
                        />
                      </label>
                      {(uploadingImage || extractingData) && (
                        <div className="flex items-center justify-center gap-2 text-blue-600">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">{uploadingImage ? 'กำลังอัปโหลด...' : 'AI กำลังอ่านข้อมูล...'}</span>
                        </div>
                      )}
                      {formData.id_card_image && (
                        <div className="relative">
                          <img
                            src={formData.id_card_image}
                            alt="บัตรประชาชน"
                            className="w-full h-48 object-cover rounded-lg border-2 border-blue-200"
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm"
                            onClick={() => setFormData({ ...formData, id_card_image: '' })}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2 pt-4">
                    <User className="w-5 h-5" />
                    ข้อมูลส่วนตัว
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <Label>ชื่อ-นามสกุล *</Label>
                      <Input
                        value={formData.full_name}
                        onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                        required
                        placeholder="ระบบจะกรอกอัตโนมัติเมื่ออัปโหลดบัตร"
                      />
                    </div>
                    <div>
                      <Label>เบอร์โทรศัพท์</Label>
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>เพศ</Label>
                        <Select value={formData.gender} onValueChange={(value) => setFormData({ ...formData, gender: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="ระบุ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="male">ชาย</SelectItem>
                            <SelectItem value="female">หญิง</SelectItem>
                            <SelectItem value="other">อื่นๆ</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>อายุ</Label>
                        <Input
                          type="number"
                          value={formData.age}
                          onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                          placeholder="ปี"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>LINE ID</Label>
                      <Input
                        value={formData.line_id}
                        onChange={(e) => setFormData({ ...formData, line_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>เลขบัตรประชาชน</Label>
                      <Input
                        value={formData.national_id}
                        onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                        placeholder="ระบบจะกรอกอัตโนมัติเมื่ออัปโหลดบัตร"
                      />
                    </div>
                    <div>
                      <Label>อีเมล</Label>
                      <Input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>ที่อยู่เดิม</Label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={2}
                      placeholder="ระบบจะกรอกอัตโนมัติเมื่ออัปโหลดบัตร"
                    />
                  </div>

                  <div>
                    <Label>เบอร์ติดต่อฉุกเฉิน</Label>
                    <Input
                      value={formData.emergency_contact}
                      onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                    <Car className="w-5 h-5 text-purple-600" />
                    ข้อมูลยานพาหนะ
                  </h3>

                  {formData.vehicles?.length > 0 && (
                    <div className="space-y-2">
                      <Label>ยานพาหนะที่ลงทะเบียนแล้ว:</Label>
                      {formData.vehicles.map((vehicle, index) => (
                        <div key={index} className="flex items-center gap-3 bg-purple-50 p-3 rounded-lg border border-purple-200">
                          <Badge className={vehicle.type === 'car' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                            {vehicle.type === 'car' ? '🚗 รถยนต์' : '🏍️ มอเตอร์ไซค์'}
                          </Badge>
                          <div className="flex-1">
                            <p className="font-semibold">ทะเบียน: {vehicle.plate}</p>
                            {vehicle.brand && <p className="text-sm text-slate-600">ยี่ห้อ/รุ่น: {vehicle.brand}</p>}
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleRemoveVehicle(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 space-y-3">
                    <Label className="font-semibold">เพิ่มยานพาหนะใหม่:</Label>
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <Label>ประเภทยานพาหนะ</Label>
                        <Select
                          value={newVehicle.type}
                          onValueChange={(value) => setNewVehicle({ ...newVehicle, type: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="car">🚗 รถยนต์</SelectItem>
                            <SelectItem value="motorcycle">🏍️ รถจักรยานยนต์</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>ทะเบียนรถ *</Label>
                          <Input
                            value={newVehicle.plate}
                            onChange={(e) => setNewVehicle({ ...newVehicle, plate: e.target.value })}
                            placeholder="เช่น กก 1234"
                          />
                        </div>
                        <div>
                          <Label>ยี่ห้อ/รุ่น</Label>
                          <Input
                            value={newVehicle.brand}
                            onChange={(e) => setNewVehicle({ ...newVehicle, brand: e.target.value })}
                            placeholder="เช่น Toyota Vios"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        onClick={handleAddVehicle}
                        className="bg-purple-600 hover:bg-purple-700"
                        disabled={!newVehicle.plate}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        เพิ่มยานพาหนะ
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>

                {!editingTenant && canAddContract && (
                  <div className="space-y-4 pt-4 border-t">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        id="create_booking"
                        checked={formData.create_booking}
                        onChange={(e) => setFormData({ ...formData, create_booking: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <Label htmlFor="create_booking" className="text-lg font-semibold text-slate-800 cursor-pointer flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        เพิ่มสัญญาเช่าพร้อมกัน (ไม่บังคับ)
                      </Label>
                    </div>

                    {formData.create_booking && (
                      <div className="space-y-4 pl-7 pt-2">
                        <div>
                          <Label>เลือกห้อง *</Label>
                          <select
                            value={formData.room_id}
                            onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                            required={formData.create_booking}
                            className="w-full p-2 border rounded-md"
                          >
                            <option value="">เลือกห้อง</option>
                            {(Array.isArray(rooms) ? rooms : [])
                              .filter(room => room.status === 'available')
                              .sort((a, b) => {
                                if (a.floor !== b.floor) return a.floor - b.floor;
                                return a.room_number.localeCompare(b.room_number);
                              })
                              .map(room => (
                                <option key={room.id} value={room.id}>
                                  ห้อง {room.room_number} - ชั้น {room.floor} ({room.price.toLocaleString()} บาท/เดือน)
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label>วันเริ่มสัญญา *</Label>
                            <Input
                              type="date"
                              value={formData.check_in_date}
                              onChange={(e) => setFormData({ ...formData, check_in_date: e.target.value })}
                              required={formData.create_booking}
                            />
                          </div>
                          <div>
                            <Label>วันสิ้นสุดสัญญา</Label>
                            <Input
                              type="date"
                              value={formData.check_out_date}
                              onChange={(e) => setFormData({ ...formData, check_out_date: e.target.value })}
                            />
                          </div>
                        </div>

                        <div>
                          <Label>เงินมัดจำ (บาท)</Label>
                          <Input
                            type="number"
                            value={formData.deposit_amount}
                            onChange={(e) => setFormData({ ...formData, deposit_amount: e.target.value })}
                            disabled={!canEditDeposit}
                            className={!canEditDeposit ? "bg-slate-100 text-slate-500" : ""}
                          />
                          {!canEditDeposit && <p className="text-xs text-red-500 mt-1">* คุณไม่มีสิทธิ์แก้ไขเงินมัดจำ</p>}
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              id="create_invoice"
                              checked={formData.create_invoice}
                              onChange={(e) => setFormData({ ...formData, create_invoice: e.target.checked })}
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <Label htmlFor="create_invoice" className="text-sm font-semibold text-slate-800 cursor-pointer">
                              สร้างบิลค่าเช่าเดือนแรกทันที
                            </Label>
                          </div>

                          {formData.create_invoice && (
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200 space-y-4">

                              {/* 1. Payment Timing Selection (Always show first) */}
                              <div>
                                <Label className="text-sm font-semibold text-blue-900 mb-3 block">💳 รูปแบบการชำระเงิน</Label>
                                <div className="space-y-2">
                                  <label className="flex items-start gap-3 p-3 bg-white rounded-lg border-2 border-blue-300 cursor-pointer hover:bg-blue-50 transition-colors">
                                    <input
                                      type="radio"
                                      name="payment_timing_create"
                                      value="pay_first"
                                      checked={formData.payment_timing === 'pay_first'}
                                      onChange={(e) => setFormData({ ...formData, payment_timing: e.target.value })}
                                      className="w-5 h-5 mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <p className="font-semibold text-slate-800">💵 จ่ายก่อนอยู่</p>
                                      <p className="text-xs text-slate-600 mt-1">สร้างบิลค่าเช่าเดือนแรกทันที (ครบกำหนดวันเข้าพัก)</p>
                                    </div>
                                  </label>
                                  <label className="flex items-start gap-3 p-3 bg-white rounded-lg border-2 border-slate-300 cursor-pointer hover:bg-slate-50 transition-colors">
                                    <input
                                      type="radio"
                                      name="payment_timing_create"
                                      value="stay_first"
                                      checked={formData.payment_timing === 'stay_first'}
                                      onChange={(e) => setFormData({ ...formData, payment_timing: e.target.value })}
                                      className="w-5 h-5 mt-0.5"
                                    />
                                    <div className="flex-1">
                                      <p className="font-semibold text-slate-800">🏠 อยู่ก่อนจ่าย</p>
                                      <p className="text-xs text-slate-600 mt-1">สร้างบิลสำหรับเดือนถัดไป (ครบกำหนดต้นเดือนหน้า)</p>
                                    </div>
                                  </label>
                                </div>
                              </div>

                              {/* 2. New Tenant Details Checkbox */}
                              <div className="flex items-center gap-2 pt-2 border-t border-blue-200">
                                <input
                                  type="checkbox"
                                  id="is_new_tenant"
                                  checked={formData.is_new_tenant}
                                  onChange={(e) => setFormData({ ...formData, is_new_tenant: e.target.checked })}
                                  className="w-4 h-4"
                                />
                                <Label htmlFor="is_new_tenant" className="cursor-pointer font-medium text-slate-800">
                                  ระบุรายละเอียดค่าใช้จ่ายแรกเข้า (สำหรับผู้เช่าใหม่)
                                </Label>
                              </div>

                              {/* 3. New Tenant Details Form */}
                              {formData.is_new_tenant && (
                                <div className="space-y-3 bg-white p-3 rounded-lg border border-blue-100">
                                  <div className="grid grid-cols-2 gap-3">
                                    <div>
                                      <Label className="text-xs text-slate-600">ค่าเช่าล่วงหน้า</Label>
                                      <Input
                                        type="number"
                                        value={formData.advance_rent}
                                        onChange={(e) => setFormData({...formData, advance_rent: e.target.value})}
                                        placeholder={rooms.find(r => r.id === formData.room_id)?.price || 0}
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-slate-600">เงินประกัน</Label>
                                      <Input
                                        type="number"
                                        value={formData.deposit_amount}
                                        onChange={(e) => setFormData({...formData, deposit_amount: e.target.value})}
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-slate-600">ค่าเช่าเฟอร์นิเจอร์</Label>
                                      <Input
                                        type="number"
                                        value={formData.furniture_fee}
                                        onChange={(e) => setFormData({...formData, furniture_fee: e.target.value})}
                                        placeholder="0"
                                      />
                                    </div>
                                    <div>
                                      <Label className="text-xs text-slate-600">หักเงินจอง</Label>
                                      <Input
                                        type="number"
                                        value={formData.booking_deduction}
                                        onChange={(e) => setFormData({...formData, booking_deduction: e.target.value})}
                                        placeholder="0"
                                        className="text-red-600 font-semibold"
                                      />
                                    </div>
                                  </div>
                                  <div className="pt-2 border-t text-right font-bold text-blue-800">
                                    ยอดชำระรวม: {(
                                      (parseFloat(formData.advance_rent) || (rooms.find(r => r.id === formData.room_id)?.price || 0)) +
                                      (parseFloat(formData.deposit_amount) || 0) +
                                      (parseFloat(formData.furniture_fee) || 0) -
                                      (parseFloat(formData.booking_deduction) || 0)
                                    ).toLocaleString()} บาท
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-between items-center gap-2 pt-4 border-t">
                  <div className="flex gap-2">
                    {editingTenant && editingTenant.status !== 'moved_out' && canEdit && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          // หาเงินมัดจำจาก active bookings
                          const activeBookings = getActiveBookings(editingTenant.id);
                          const totalDeposit = activeBookings.reduce((sum, b) => sum + (b.deposit_amount || 0), 0);
                          setMoveOutData({
                            returnDeposit: totalDeposit > 0,
                            depositAmount: totalDeposit.toString(),
                            depositNotes: ''
                          });
                          setShowMoveOutDialog(true);
                        }}
                        disabled={moveOutMutation.isPending}
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      >
                        <LogOut className="w-4 h-4 mr-2" />
                        ย้ายออก
                      </Button>
                    )}
                    {editingTenant && canDelete && (
                      <Button
                        type="button"
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (!canDelete) {
                            toast.error('คุณไม่มีสิทธิ์ลบผู้เช่า');
                            return;
                          }
                          const confirmDelete = window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบผู้เช่า "${editingTenant.full_name}"?\n\n⚠️ การกระทำนี้จะลบข้อมูลสัญญาเช่าและข้อมูลอื่นๆ ที่เกี่ยวข้องทั้งหมดของผู้เช่ารายนี้อย่างถาวร`);
                          if (confirmDelete) {
                            deleteMutation.mutate(editingTenant.id);
                            setShowDialog(false);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        ลบผู้เช่า
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowDialog(false)}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-blue-600 to-indigo-600"
                      disabled={createMutation.isPending || updateMutation.isPending}
                    >
                      {createMutation.isPending || updateMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          กำลังบันทึก...
                        </>
                      ) : (
                        editingTenant ? 'อัปเดต' : 'เพิ่มผู้เช่า'
                      )}
                    </Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>นำเข้าข้อมูลผู้เช่า</DialogTitle>
              </DialogHeader>

        <ExcelUploader
  entityName="Tenant"
  schema={tenantSchema}  // 👈 เอา // ออก ให้เป็นแบบนี้ครับ
  templateData={templateData}
  templateFilename={`tenant_template_${selectedBranchName}.csv`}
  onSuccess={() => {
    queryClient.invalidateQueries(['tenants', selectedBranchId]);
    setShowUploadDialog(false);
    toast.success('อัปโหลดข้อมูลผู้เช่าสำเร็จ');
  }}
  onError={(error) => {
    // 👇 เพิ่ม 3 บรรทัดนี้เพื่อดูสาเหตุที่แท้จริง
    console.log("❌ IMPORT ERROR:", error); 
    console.log("📋 Validation Details:", error.errors || error.validation); 
    
    // แจ้งเตือนตามปกติ
    toast.error("รูปแบบไฟล์ไม่ถูกต้อง: กรุณาเปิด Console (F12) เพื่อดูรายละเอียด");
  }}
  additionalData={{ branch_id: selectedBranchId }}
  customImportHandler={handleTenantImport}
/>
              <div className="mt-4 flex justify-end">
                <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
                  ปิด
                </Button>
              </div>
            </DialogContent>
          </Dialog>

            </TabsContent>

            <TabsContent value="contracts" className="mt-6 space-y-6">
              <ContractsTab
                isDeveloper={isDeveloper}
                contracts={contracts}
                canAddContract={canAddContract}
                canEditContract={canEditContract}
                canDeleteContract={canDeleteContract}
                deleteContractMutation={deleteContractMutation}
                renewContractMutation={renewContractMutation}
                getTenantInfo={getTenantInfo}
                getRoomInfo={getRoomInfo}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Restore Deleted Tenants Dialog */}
      <Dialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-green-600" />
              กู้คืนผู้เช่าที่ลบไป
            </DialogTitle>
          </DialogHeader>
          
          {deletedTenants.length === 0 ? (
            <div className="text-center py-12">
              <RotateCcw className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-600">ไม่มีผู้เช่าที่ถูกลบ</p>
              <p className="text-sm text-slate-500 mt-1">ผู้เช่าที่ลบไปจะแสดงที่นี่เพื่อกู้คืน</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">พบผู้เช่าที่ลบไปแล้ว {deletedTenants.length} คน</p>
              {deletedTenants.map((record) => (
                <div key={record.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-800">{record.tenant_data?.full_name}</p>
                    <p className="text-sm text-slate-600">{record.tenant_data?.phone}</p>
                    <p className="text-xs text-slate-500">
                      ลบเมื่อ: {(() => { try { return record.deleted_date && !isNaN(new Date(record.deleted_date).getTime()) ? format(parseISO(record.deleted_date), 'd MMM yy HH:mm', { locale: th }) : '-'; } catch (e) { return '-'; } })()}
                      {record.deleted_by && ` โดย ${record.deleted_by}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => restoreTenantMutation.mutate(record)}
                    disabled={restoreTenantMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {restoreTenantMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="w-4 h-4 mr-1" />
                        กู้คืน
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestoreDialog(false)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Out Dialog */}
      <Dialog open={showMoveOutDialog} onOpenChange={setShowMoveOutDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-orange-600" />
              ย้ายออกและคืนเงินมัดจำ
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {selectedTenant && (
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm">
                  <span className="text-slate-600">ผู้เช่า: </span>
                  <span className="font-semibold">{selectedTenant.full_name}</span>
                </p>
                <p className="text-sm">
                  <span className="text-slate-600">เงินมัดจำทั้งหมด: </span>
                  <span className="font-semibold text-blue-600">
                    {parseFloat(moveOutData.depositAmount || 0).toLocaleString()} ฿
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-green-50 rounded-lg p-3 border border-green-200">
                <input
                  type="checkbox"
                  id="returnDeposit"
                  checked={moveOutData.returnDeposit}
                  onChange={(e) => setMoveOutData({...moveOutData, returnDeposit: e.target.checked})}
                  className="w-5 h-5 rounded border-green-300 text-green-600 focus:ring-green-500"
                />
                <Label htmlFor="returnDeposit" className="text-sm font-semibold text-green-900 cursor-pointer flex-1">
                  💰 คืนเงินมัดจำ
                </Label>
              </div>

              {moveOutData.returnDeposit && (
                <div className="space-y-3 pl-2">
                  <div>
                    <Label className="text-sm">จำนวนเงินที่คืน (บาท) *</Label>
                    <Input
                      type="number"
                      value={moveOutData.depositAmount}
                      onChange={(e) => setMoveOutData({...moveOutData, depositAmount: e.target.value})}
                      placeholder="0"
                      className="mt-1"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      สามารถคืนน้อยกว่าเงินมัดจำได้ (กรณีหักค่าเสียหาย)
                    </p>
                  </div>

                  <div>
                    <Label className="text-sm">หมายเหตุ</Label>
                    <Input
                      value={moveOutData.depositNotes}
                      onChange={(e) => setMoveOutData({...moveOutData, depositNotes: e.target.value})}
                      placeholder="เช่น หักค่าซ่อมแซม 500 บาท"
                      className="mt-1"
                    />
                  </div>
                </div>
              )}
            </div>

            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-3">
                <p className="text-sm text-yellow-800">
                  <span className="font-semibold">⚠️ คำเตือน:</span> การย้ายออกจะทำให้สัญญาทั้งหมดของผู้เช่าสิ้นสุดลง
                  {moveOutData.returnDeposit && ' และบันทึกค่าใช้จ่ายการคืนเงินมัดจำ'}
                </p>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowMoveOutDialog(false);
                setMoveOutData({ returnDeposit: true, depositAmount: '', depositNotes: '' });
              }}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={() => {
                if (moveOutData.returnDeposit && (!moveOutData.depositAmount || parseFloat(moveOutData.depositAmount) <= 0)) {
                  toast.error('กรุณาระบุจำนวนเงินที่คืน');
                  return;
                }
                moveOutMutation.mutate({
                  tenant: selectedTenant || editingTenant,
                  returnDeposit: moveOutData.returnDeposit,
                  depositAmount: parseFloat(moveOutData.depositAmount || 0),
                  depositNotes: moveOutData.depositNotes
                });
              }}
              disabled={moveOutMutation.isPending}
              className="bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700"
            >
              {moveOutMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังดำเนินการ...
                </>
              ) : (
                <>
                  <LogOut className="w-4 h-4 mr-2" />
                  ยืนยันย้ายออก
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      {/* Bulk Tenant Generator Dialog */}
      <BulkTenantGenerator
        open={showBulkTenantGenerator}
        onOpenChange={setShowBulkTenantGenerator}
        rooms={rooms}
        isLoading={generatingTenants}
        onConfirm={async (selectedRoomIds) => {
          if (selectedRoomIds.length === 0) {
            toast.error('กรุณาเลือกห้องอย่างน้อย 1 ห้อง');
            return;
          }

          if (!confirm(`สร้างผู้เช่าสำหรับ ${selectedRoomIds.length} ห้อง?`)) {
            return;
          }

          setGeneratingTenants(true);
          try {
            const response = await base44.functions.invoke('generateRoomBasedMockTenants', {
              branch_id: selectedBranchId,
              room_ids: selectedRoomIds
            });

            if (response.data.success) {
              queryClient.invalidateQueries(['tenants', selectedBranchId]);
              queryClient.invalidateQueries(['bookings', selectedBranchId]);
              queryClient.invalidateQueries(['rooms', selectedBranchId]);

              toast.success(`✅ สร้างผู้เช่าสำเร็จ ${response.data.tenants_created} คน`);
              setShowBulkTenantGenerator(false);
            } else {
              toast.error(response.data.error || 'เกิดข้อผิดพลาด');
            }
          } catch (error) {
            toast.error('เกิดข้อผิดพลาด: ' + error.message);
          } finally {
            setGeneratingTenants(false);
          }
        }}
      />

      {/* Floating Bulk AI Action Bar */}
      <AnimatePresence>
        {selectedTenants.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 z-50 left-4 right-4 md:left-[280px] md:right-6 md:max-w-5xl"
          >
            <Card className="bg-white shadow-2xl border-slate-200 overflow-hidden">
              <div className="p-3 md:p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-3 mb-3">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="bg-blue-100 p-2 rounded-lg flex-shrink-0">
                      <CheckSquare className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 text-sm md:text-base">เลือกแล้ว {selectedTenants.length} รายการ</p>
                      <p className="text-xs text-slate-500 hidden md:block">จัดการผู้เช่าหลายคนพร้อมกันด้วย AI</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTenants(filteredTenants.map(t => t.id));
                        toast.success(`เลือกแล้ว ${filteredTenants.length} รายการทั้งหมด`, { duration: 2000 });
                      }}
                      className="bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100 text-xs flex-1 md:flex-initial"
                      disabled={filteredTenants.length === 0}
                    >
                      <CheckSquare className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1" />
                      <span className="hidden md:inline">เลือกทั้งหมด ({filteredTenants.length})</span>
                      <span className="md:hidden">ทั้งหมด</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleBulkDelete}
                      disabled={isBulkExecuting}
                      className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100 text-xs flex-1 md:flex-initial"
                    >
                      {isBulkExecuting ? (
                        <Loader2 className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1" />
                      )}
                      <span className="hidden md:inline">ลบ</span>
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setSelectedTenants([]);
                        setIsSelectionMode(false);
                      }}
                      className="text-slate-600 hover:bg-slate-50 text-xs flex-1 md:flex-initial"
                    >
                      <X className="w-3.5 h-3.5 md:w-4 md:h-4 md:mr-1" />
                      <span className="hidden md:inline">ยกเลิก</span>
                    </Button>
                  </div>
                </div>

                {!bulkAIResult ? (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500" />
                      <Input 
                        placeholder="บอก AI ว่าจะทำอะไร... (เช่น 'แก้สถานะเป็น active', 'เพิ่มรถยนต์')" 
                        value={bulkAIQuery}
                        onChange={e => setBulkAIQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAIBulkRequest()}
                        className="pl-10 bg-slate-50 border-slate-200"
                        autoFocus
                      />
                    </div>
                    <Button 
                      onClick={handleAIBulkRequest} 
                      disabled={aiSearching || !bulkAIQuery.trim()}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
                    >
                      {aiSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4 mr-2" /> AI แก้ไข</>}
                    </Button>
                  </div>
                ) : (
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="bg-white p-2 rounded-lg border shadow-sm">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{bulkAIResult.confirmation_message}</p>
                        <p className="text-sm text-slate-600 mt-1">{bulkAIResult.description}</p>

                        {bulkAIResult.action === 'update' && bulkAIResult.changes && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.entries(bulkAIResult.changes).map(([key, value]) => (
                              <Badge key={key} className="bg-blue-100 text-blue-700">
                                {key}: {value}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {bulkAIResult.action === 'add_vehicle' && (
                          <Badge className="mt-2 bg-purple-100 text-purple-700">
                            🚗 {bulkAIResult.vehicle_type === 'car' ? 'รถยนต์' : 'มอเตอร์ไซค์'} 
                            {bulkAIResult.vehicle_plate && ` - ${bulkAIResult.vehicle_plate}`}
                          </Badge>
                        )}
                        {bulkAIResult.action === 'delete' && (
                          <Badge variant="destructive" className="mt-2">ลบถาวร</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 justify-end">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setBulkAIResult(null);
                          setBulkAIQuery('');
                        }}
                        disabled={isBulkExecuting}
                      >
                        แก้ไขคำสั่ง
                      </Button>
                      <Button 
                        onClick={executeBulkAction} 
                        disabled={isBulkExecuting}
                        className={bulkAIResult.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}
                      >
                        {isBulkExecuting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            กำลังดำเนินการ...
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            ยืนยันทำรายการ
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      );
      }