import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, DollarSign, DoorOpen, Wrench, Clock, X, AlertTriangle, Calendar, Package, TrendingDown, CheckCheck, ChevronDown, ChevronUp, Building2, Filter, Trash2, UserPlus, Check, Loader2, ZoomIn } from "lucide-react";
import SlipPreviewDialog from "./SlipPreviewDialog";
import PageHeader from "./PageHeader";
import { toast } from "sonner";
import { format, differenceInDays, parseISO, formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function NotificationsPanel({ isOpen, onClose }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [expandedGroups, setExpandedGroups] = useState({});
  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const [filterBranch, setFilterBranch] = useState(selectedBranchId || 'all');
  const [swipedItem, setSwipedItem] = useState(null);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState(null);
  const [slipPreview, setSlipPreview] = useState({ open: false, url: '', title: '' });

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
  const userAccessibleBranches = currentUser?.accessible_branches || [];
  const showAllBranches = userRole === 'developer' || userRole === 'owner';
  const canDelete = userRole === 'developer' || userRole === 'owner';

  // 🔒 Security: คำนวณสาขาที่มีสิทธิ์เข้าถึง
  const allowedBranchIds = useMemo(() => {
    if (userRole === 'developer') return null; // null = ทุกสาขา
    
    // Owner = สาขาที่เป็น owner_id
    if (userRole === 'owner') {
      return null; // จะกรองใน backend ด้วย owner_id
    }
    
    // Employee/Manager = เฉพาะ accessible_branches
    if (userAccessibleBranches && userAccessibleBranches.length > 0) {
      return userAccessibleBranches;
    }
    
    // ถ้าไม่มีสิทธิ์เลย = block
    return [];
  }, [userRole, userAccessibleBranches]);

  // 🔒 Block queries ถ้าไม่มีสิทธิ์เลย
  const canLoadData = allowedBranchIds === null || allowedBranchIds.length > 0;

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    enabled: showAllBranches && isOpen && canLoadData,
    staleTime: 60 * 60 * 1000,
  });

  // 🚀 Optimization: ดึงข้อมูลทั้งหมดในครั้งเดียว (1 API call แทน 6 calls)
  const { data: batchData, isLoading: paymentsLoading } = useQuery({
    queryKey: ['notifications-batch', 'secure', allowedBranchIds],
    queryFn: async () => {
      const response = await base44.functions.invoke('getBatchNotifications', {});
      return response.data;
    },
    enabled: isOpen && canLoadData,
    staleTime: 30 * 1000, // Cache 30 วินาที
    refetchOnMount: true,
  });

  const allPayments = batchData?.payments || [];
  const allRooms = batchData?.rooms || [];
  const allMaintenanceRequests = batchData?.maintenance || [];
  const allBookings = batchData?.bookings || [];
  const allMaterialDeliveries = batchData?.deliveries || [];
  const allTenants = batchData?.tenants || [];

  const { data: notificationConfigs = [] } = useQuery({
    queryKey: ['notificationConfigs'],
    queryFn: () => base44.entities.NotificationConfig.list(),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000,
  });

  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
    enabled: isOpen,
    staleTime: 4 * 60 * 60 * 1000,
  });

  const { data: readNotifications = [] } = useQuery({
    queryKey: ['readNotifications', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      const all = await base44.entities.Notification.list('-created_date', 500);
      return all.filter(n => n.user_email === currentUser.email);
    },
    enabled: !!currentUser?.email && isOpen,
    staleTime: 0,
    refetchOnMount: true,
  });

  const getCurrentDate = () => {
    const testDateConfig = configs.find(c => c.key === 'test_current_date');
    if (testDateConfig && testDateConfig.value && testDateConfig.value.trim() !== '') {
      try {
        const date = parseISO(testDateConfig.value);
        if (!isNaN(date.getTime())) {
          return date;
        }
      } catch {}
    }
    return new Date();
  };

  // ⭐ Local state สำหรับ optimistic update ทันที (ไม่ต้องรอ API)
  const [localReadIds, setLocalReadIds] = useState(new Set());
  
  // ⭐ Queue สำหรับ batch API calls
  const pendingUpdatesRef = React.useRef([]);
  const flushTimeoutRef = React.useRef(null);

  const flushPendingUpdates = async () => {
    if (pendingUpdatesRef.current.length === 0) return;
    
    const updates = [...pendingUpdatesRef.current];
    pendingUpdatesRef.current = [];
    
    // ⭐ ทำทีละ batch ช้าๆ
    const batchSize = 3;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      try {
        await Promise.all(batch.map(async (notificationId) => {
          const existing = readNotifications.find(n => n.notification_id === notificationId && n.user_email === currentUser.email);
          if (existing) {
            await base44.entities.Notification.update(existing.id, { is_read: true, read_date: new Date().toISOString() });
          } else {
            await base44.entities.Notification.create({ user_email: currentUser.email, notification_id: notificationId, is_read: true, read_date: new Date().toISOString() });
          }
        }));
      } catch (e) {
        console.warn('Notification update error (ignored):', e.message);
      }
      if (i + batchSize < updates.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    
    // ⭐ Invalidate queries หลัง flush เสร็จ
    queryClient.invalidateQueries({ queryKey: ['readNotifications'] });
  };

  // ⭐ Flush เมื่อปิด panel หรือ unmount
  React.useEffect(() => {
    if (!isOpen && pendingUpdatesRef.current.length > 0) {
      flushPendingUpdates();
    }
    
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
      if (pendingUpdatesRef.current.length > 0) {
        flushPendingUpdates();
      }
    };
  }, [isOpen]);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      // ⭐ ไม่ทำอะไรทันที - เก็บเข้า queue แล้ว flush ทีหลัง
      pendingUpdatesRef.current.push(notificationId);
      
      // ⭐ Debounce - รอ 2 วินาทีแล้วค่อย flush ทั้งหมด
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = setTimeout(flushPendingUpdates, 2000);
      
      return { success: true };
    },
    onMutate: async (notificationId) => {
      // ⭐ หายทันทีใน UI
      setLocalReadIds(prev => new Set([...prev, notificationId]));
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async (notificationIds) => {
      // ⭐ เก็บเข้า queue แล้ว flush ทีหลัง
      pendingUpdatesRef.current.push(...notificationIds);
      if (flushTimeoutRef.current) clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = setTimeout(flushPendingUpdates, 2000);
      return { success: true };
    },
    onMutate: async (notificationIds) => {
      // ⭐ หายทันทีทั้งหมดใน UI
      setLocalReadIds(prev => new Set([...prev, ...notificationIds]));
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId) => {
      // ⭐ Flush ทันทีเมื่อลบ
      const existing = readNotifications.find(n => n.notification_id === notificationId && n.user_email === currentUser.email);
      if (existing) {
        await base44.entities.Notification.update(existing.id, { is_read: true, read_date: new Date().toISOString() });
      } else {
        await base44.entities.Notification.create({ user_email: currentUser.email, notification_id: notificationId, is_read: true, read_date: new Date().toISOString() });
      }
      return { success: true };
    },
    onMutate: async (notificationId) => {
      // ⭐ หายทันที
      setLocalReadIds(prev => new Set([...prev, notificationId]));
      setSwipedItem(null);
    },
    onSuccess: () => {
      // ⭐ Refresh ทันที
      queryClient.invalidateQueries({ queryKey: ['readNotifications'] });
    }
  });

  const deleteAllNotificationsMutation = useMutation({
    mutationFn: async (notificationIds) => {
      // ⭐ Flush ทันทีเมื่อลบทั้งหมด
      const batchSize = 5;
      for (let i = 0; i < notificationIds.length; i += batchSize) {
        const batch = notificationIds.slice(i, i + batchSize);
        await Promise.all(batch.map(async (notificationId) => {
          const existing = readNotifications.find(n => n.notification_id === notificationId && n.user_email === currentUser.email);
          if (existing) {
            await base44.entities.Notification.update(existing.id, { is_read: true, read_date: new Date().toISOString() });
          } else {
            await base44.entities.Notification.create({ user_email: currentUser.email, notification_id: notificationId, is_read: true, read_date: new Date().toISOString() });
          }
        }));
      }
      return { success: true };
    },
    onMutate: async (notificationIds) => {
      // ⭐ หายทันทีทั้งหมด
      setLocalReadIds(prev => new Set([...prev, ...notificationIds]));
    },
    onSuccess: () => {
      // ⭐ Refresh ทันที
      queryClient.invalidateQueries({ queryKey: ['readNotifications'] });
    }
  });

  // ⭐ Mutation สำหรับยืนยันชำระเงิน
  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentId) => {
      console.log('🔄 NotificationsPanel: Confirming payment:', paymentId);
      const now = new Date();
      const paymentDate = now.toISOString().split('T')[0];
      
      // อัปเดต payment เป็น paid และใส่ notes ให้ตรงกับหน้า Payments
      const result = await base44.entities.Payment.update(paymentId, {
        status: 'paid',
        payment_date: paymentDate,
        notes: '✅ ยืนยันชำระแล้ว (ผ่านการตรวจสอบด้วยตนเอง)'
      });
      
      console.log('✅ NotificationsPanel: Payment confirmed:', result);
      return { success: true, paymentId };
    },
    onSuccess: (data) => {
      console.log('✅ NotificationsPanel: Success callback triggered for:', data.paymentId);
      toast.success('ยืนยันชำระเงินสำเร็จ');
      setConfirmingPaymentId(null);
      // ⭐ ซ่อนการแจ้งเตือนนี้ทันที (optimistic update)
      setLocalReadIds(prev => new Set([...prev, `failed-slip-${data.paymentId}`]));
      // Refresh payments data
      queryClient.invalidateQueries(['allPayments']);
      queryClient.invalidateQueries(['payments']);
    },
    onError: (error) => {
      console.error('❌ NotificationsPanel: Confirm payment error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
      setConfirmingPaymentId(null);
    }
  });

  const getConfig = (branchId, key, defaultValue) => {
    const branchConfig = notificationConfigs.find(c => c.branch_id === branchId);
    if (branchConfig && branchConfig[key] !== undefined) {
      return branchConfig[key];
    }
    const globalConfig = notificationConfigs.find(c => !c.branch_id);
    if (globalConfig && globalConfig[key] !== undefined) {
      return globalConfig[key];
    }
    return defaultValue;
  };

  const isNotificationRead = (notificationId) => {
    // ⭐ เช็ค local state ก่อน (หายทันที)
    if (localReadIds.has(notificationId)) return true;
    return readNotifications.some(n => n.notification_id === notificationId && n.is_read);
  };

  const isNotificationDeleted = (notificationId) => {
    // ⭐ ไม่ลบออกจาก UI - ให้จางลงแทน
    return false;
  };

  const notificationsByBranch = useMemo(() => {
    console.log('🔍 [NotificationPanel] useMemo triggered - isOpen:', isOpen, 'paymentsLoading:', paymentsLoading);
    if (!isOpen || paymentsLoading) return {};
    
    const now = getCurrentDate();
    console.log('🔍 [NotificationPanel] Current date:', now.toISOString());
    console.log('🔍 [NotificationPanel] Test date config:', configs.find(c => c.key === 'test_current_date'));
    console.log('🔍 [NotificationPanel] All Payments Count:', allPayments.length);
    const branchNotifications = {};

    const selectedBranchId = localStorage.getItem('selected_branch_id');
    const branchesToCheck = showAllBranches 
      ? branches.map(b => b.id)
      : userAccessibleBranches.length > 0
      ? userAccessibleBranches
      : [selectedBranchId].filter(Boolean);

    branchesToCheck.forEach(branchId => {
      const isEnabled = getConfig(branchId, 'enabled', true);
      if (!isEnabled) return;

      const branch = branches.find(b => b.id === branchId);
      const branchName = branch?.branch_name || localStorage.getItem('selected_branch_name') || 'ไม่ระบุสาขา';

      const payments = allPayments.filter(p => p.branch_id === branchId);
      const rooms = allRooms.filter(r => r.branch_id === branchId);
      const maintenanceRequests = allMaintenanceRequests.filter(m => m.branch_id === branchId);
      const bookings = allBookings.filter(b => b.branch_id === branchId);
      const materialDeliveries = allMaterialDeliveries.filter(d => d.branch_id === branchId);
      const tenants = allTenants.filter(t => t.branch_id === branchId);
      
      // ⭐ Debug log
      if (branchId === '69256957890d2b5aaaca1d3f') {
        const unpaidPayments = payments.filter(p => p.status !== 'paid');
        console.log('🔍 Processing branch:', branchName, {
          totalPayments: payments.length,
          pendingPayments: unpaidPayments.length,
          totalRooms: rooms.length,
          unpaidPaymentsDueDates: unpaidPayments.map(p => ({
            room: rooms.find(r => r.id === p.room_id)?.room_number,
            dueDate: p.due_date,
            status: p.status
          }))
        });
      }

      const vacantDaysThreshold = getConfig(branchId, 'vacant_room_days', 7);
      const urgentMaintenanceEnabled = getConfig(branchId, 'urgent_maintenance_enabled', true);
      const unclaimedDaysThreshold = getConfig(branchId, 'unclaimed_delivery_days', 5);

      const alerts = [];

      // 0. สลิปตรวจสอบไม่ผ่าน (⚠️ รอตรวจสอบ) - ต้องไม่ใช่การยืนยันด้วยตนเอง
      const failedSlipPayments = payments.filter(p => 
        p.notes?.includes('⚠️ รอตรวจสอบ') && 
        p.status !== 'paid' &&
        !p.notes?.includes('✅ ยืนยันชำระแล้ว')
      );

      if (failedSlipPayments.length > 0) {
        failedSlipPayments.forEach(payment => {
          const room = rooms.find(r => r.id === payment.room_id);
          const tenant = tenants.find(t => t.id === payment.tenant_id);
          // ⭐ ดึงหมายเลขห้องจาก notes ก่อน ถ้าไม่มีให้ใช้จาก room
          const notesParts = payment.notes?.split('⚠️ รอตรวจสอบ:')[1]?.trim() || '';
          const roomMatch = notesParts.match(/ห้อง\s+(\S+)/);
          const roomNumber = roomMatch ? roomMatch[1] : (room?.room_number || 'N/A');
          const reason = notesParts.replace(/^ห้อง\s+\S+\s*-?\s*/, '').split('\n')[0]?.trim() || 'ตรวจสอบไม่ผ่าน';
          
          alerts.push({
            id: `failed-slip-${payment.id}`,
            type: 'failed-slip',
            icon: AlertTriangle,
            color: 'amber',
            title: `รอตรวจสลิป - ห้อง ${roomNumber}`,
            message: `${tenant?.full_name || 'N/A'} · ${reason}`,
            branch: branchName,
            branchId: branchId,
            time: payment.updated_date || payment.created_date || new Date().toISOString(),
            paymentId: payment.id, // ⭐ เก็บ paymentId สำหรับยืนยันชำระ
            slipUrl: payment.payment_slip_url, // ⭐ เก็บ URL สลิป
            totalAmount: payment.total_amount,
            action: () => {
              if (showAllBranches && branchId !== selectedBranchId) {
                localStorage.setItem('selected_branch_id', branchId);
                localStorage.setItem('selected_branch_name', branchName);
              }
              navigate(createPageUrl('Payments'));
              onClose();
            }
          });
        });
      }

      // 1. เกินกำหนดชำระเท่านั้น (ไม่รวม pending)
      const overduePayments = payments.filter(p => {
        if (p.status === 'paid') return false;
        if (!p.due_date) return false;
        
        try {
          const dueDate = parseISO(p.due_date);
          const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
          const isOverdue = now > dueDateStart;
          
          return isOverdue;
        } catch (err) {
          console.error('Date parse error:', err, p.due_date);
          return false;
        }
      });

      // ⭐ Debug log สำหรับสาขา 12345
      if (branchId === '69256957890d2b5aaaca1d3f') {
        console.log('🔍 Overdue payments found:', overduePayments.length, overduePayments.map(p => ({
          room: rooms.find(r => r.id === p.room_id)?.room_number,
          dueDate: p.due_date,
          status: p.status,
          amount: p.total_amount
        })));
      }

      if (overduePayments.length > 10) {
        const totalOverdueAmount = overduePayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
        const mostRecentTime = overduePayments.reduce((latest, p) => {
          const pTime = p.updated_date || p.created_date || p.due_date;
          return (!latest || (pTime && new Date(pTime) > new Date(latest))) ? pTime : latest;
        }, null);

        alerts.push({
          id: `overdue-group-${branchId}`,
          type: 'overdue-group',
          icon: DollarSign,
          color: 'red',
          title: `เกินกำหนดชำระ ${overduePayments.length} รายการ`,
          message: `รวม ${totalOverdueAmount.toLocaleString()} ฿`,
          branch: branchName,
          branchId: branchId,
          time: mostRecentTime || new Date().toISOString(),
          count: overduePayments.length,
          expandable: true,
          items: overduePayments.map(payment => {
            const room = rooms.find(r => r.id === payment.room_id);
            const tenant = tenants.find(t => t.id === payment.tenant_id);
            const daysOverdue = payment.due_date ? differenceInDays(now, parseISO(payment.due_date)) : 0;
            const roomNumber = room?.room_number || tenant?.full_name || 'N/A';
            
            return {
              id: `overdue-${payment.id}`,
              title: `ห้อง ${roomNumber}`,
              subtitle: `เกินกำหนด ${daysOverdue} วัน`,
              amount: payment.total_amount
            };
          }),
          action: () => {
            if (showAllBranches && branchId !== selectedBranchId) {
              localStorage.setItem('selected_branch_id', branchId);
              localStorage.setItem('selected_branch_name', branchName);
            }
            navigate(createPageUrl('Payments'));
            onClose();
          }
        });
      } else {
        overduePayments.forEach(payment => {
          const room = rooms.find(r => r.id === payment.room_id);
          const tenant = tenants.find(t => t.id === payment.tenant_id);
          
          // ⭐ Debug log สำหรับ N/A
          if (!room) {
            console.warn(`⚠️ Room not found for payment ${payment.id}:`, {
              room_id: payment.room_id,
              tenant_name: tenant?.full_name,
              available_rooms: rooms.length
            });
          }
          
          const daysOverdue = payment.due_date ? differenceInDays(now, parseISO(payment.due_date)) : 0;
          const roomNumber = room?.room_number || tenant?.full_name || 'N/A';
          
          alerts.push({
            id: `overdue-${payment.id}`,
            type: 'overdue',
            icon: DollarSign,
            color: 'red',
            title: `เกินกำหนด - ห้อง ${roomNumber}`,
            message: `เกิน ${daysOverdue} วัน (${payment.total_amount?.toLocaleString()} ฿)`,
            branch: branchName,
            branchId: branchId,
            time: payment.updated_date || payment.created_date || payment.due_date || new Date().toISOString(),
            action: () => {
              if (showAllBranches && branchId !== selectedBranchId) {
                localStorage.setItem('selected_branch_id', branchId);
                localStorage.setItem('selected_branch_name', branchName);
              }
              navigate(createPageUrl('Payments'));
              onClose();
            }
          });
        });
      }

      // 2. การจองใหม่ (7 วันล่าสุด)
      const newBookings = bookings.filter(b => {
        if (!b.created_date) return false;
        try {
          const createdDate = parseISO(b.created_date);
          const daysAgo = differenceInDays(now, createdDate);
          return daysAgo <= 7;
        } catch {
          return false;
        }
      });

      newBookings.forEach(booking => {
        const room = rooms.find(r => r.id === booking.room_id);
        const tenant = tenants.find(t => t.id === booking.tenant_id);
        alerts.push({
          id: `new-booking-${booking.id}`,
          type: 'new-booking',
          icon: Calendar,
          color: 'blue',
          title: `การจองใหม่ - ห้อง ${room?.room_number || 'N/A'}`,
          message: `${tenant?.full_name || booking.guest_name || 'N/A'}`,
          branch: branchName,
          branchId: branchId,
          time: booking.created_date || new Date().toISOString(),
          action: () => {
            if (showAllBranches && branchId !== selectedBranchId) {
              localStorage.setItem('selected_branch_id', branchId);
              localStorage.setItem('selected_branch_name', branchName);
            }
            navigate(createPageUrl('Bookings'));
            onClose();
          }
        });
      });

      // 3. ผู้เช่าใหม่ (7 วันล่าสุด)
      const newTenants = tenants.filter(t => {
        if (!t.created_date) return false;
        try {
          const createdDate = parseISO(t.created_date);
          const daysAgo = differenceInDays(now, createdDate);
          return daysAgo <= 7;
        } catch {
          return false;
        }
      });

      newTenants.forEach(tenant => {
        alerts.push({
          id: `new-tenant-${tenant.id}`,
          type: 'new-tenant',
          icon: UserPlus,
          color: 'green',
          title: `ผู้เช่าใหม่ - ${tenant.full_name}`,
          message: `เบอร์: ${tenant.phone}`,
          branch: branchName,
          branchId: branchId,
          time: tenant.created_date || new Date().toISOString(),
          action: () => {
            if (showAllBranches && branchId !== selectedBranchId) {
              localStorage.setItem('selected_branch_id', branchId);
              localStorage.setItem('selected_branch_name', branchName);
            }
            navigate(createPageUrl('Tenants'));
            onClose();
          }
        });
      });

      // 4. ห้องว่างเกิน X วัน
      const vacantRooms = rooms.filter(r => {
        if (r.status !== 'available') return false;
        const lastBooking = bookings
          .filter(b => b.room_id === r.id && b.check_out_date)
          .sort((a, b) => {
            try {
              return parseISO(b.check_out_date).getTime() - parseISO(a.check_out_date).getTime();
            } catch {
              return 0;
            }
          })[0];

        if (lastBooking && lastBooking.check_out_date) {
          try {
            const daysVacant = differenceInDays(now, parseISO(lastBooking.check_out_date));
            return daysVacant >= vacantDaysThreshold;
          } catch {
            return false;
          }
        }
        return false;
      });

      if (vacantRooms.length > 10) {
        const mostRecentTime = vacantRooms.reduce((latest, r) => {
          const rTime = r.updated_date || r.created_date;
          return (!latest || (rTime && new Date(rTime) > new Date(latest))) ? rTime : latest;
        }, null);

        alerts.push({
          id: `vacant-group-${branchId}`,
          type: 'vacant-group',
          icon: DoorOpen,
          color: 'green',
          title: `ห้องว่างนาน ${vacantRooms.length} ห้อง`,
          message: `ควรหาผู้เช่าเพิ่มเติม`,
          branch: branchName,
          branchId: branchId,
          time: mostRecentTime || new Date().toISOString(),
          count: vacantRooms.length,
          expandable: true,
          items: vacantRooms.map(room => {
            const lastBooking = bookings
              .filter(b => b.room_id === room.id && b.check_out_date)
              .sort((a, b) => parseISO(b.check_out_date).getTime() - parseISO(a.check_out_date).getTime())[0];
            const daysVacant = lastBooking?.check_out_date ? differenceInDays(now, parseISO(lastBooking.check_out_date)) : 0;
            return {
              id: `vacant-${room.id}`,
              title: `ห้อง ${room.room_number}`,
              subtitle: `ว่างมาแล้ว ${daysVacant} วัน`
            };
          }),
          action: () => {
            if (showAllBranches && branchId !== selectedBranchId) {
              localStorage.setItem('selected_branch_id', branchId);
              localStorage.setItem('selected_branch_name', branchName);
            }
            navigate(createPageUrl('Rooms'));
            onClose();
          }
        });
      } else {
        vacantRooms.forEach(room => {
          const lastBooking = bookings
            .filter(b => b.room_id === room.id && b.check_out_date)
            .sort((a, b) => parseISO(b.check_out_date).getTime() - parseISO(a.check_out_date).getTime())[0];
          const daysVacant = lastBooking?.check_out_date ? differenceInDays(now, parseISO(lastBooking.check_out_date)) : 0;
          
          alerts.push({
            id: `vacant-${room.id}`,
            type: 'vacant',
            icon: DoorOpen,
            color: 'green',
            title: `ห้องว่างนาน - ห้อง ${room.room_number}`,
            message: `ว่างมาแล้ว ${daysVacant} วัน`,
            branch: branchName,
            branchId: branchId,
            time: lastBooking?.check_out_date || room.updated_date || new Date().toISOString(),
            action: () => {
              if (showAllBranches && branchId !== selectedBranchId) {
                localStorage.setItem('selected_branch_id', branchId);
                localStorage.setItem('selected_branch_name', branchName);
              }
              navigate(createPageUrl('Rooms'));
              onClose();
            }
          });
        });
      }

      // 5. การซ่อมบำรุงเร่งด่วน
      if (urgentMaintenanceEnabled) {
        const urgentMaintenance = maintenanceRequests.filter(m => 
          m.status === 'pending' && (m.priority === 'urgent' || m.priority === 'high')
        );

        if (urgentMaintenance.length > 10) {
          const mostRecentTime = urgentMaintenance[0]?.created_date || new Date().toISOString();

          alerts.push({
            id: `maintenance-group-${branchId}`,
            type: 'maintenance-group',
            icon: Wrench,
            color: 'purple',
            title: `แจ้งซ่อมเร่งด่วน ${urgentMaintenance.length} รายการ`,
            message: `ต้องดำเนินการโดยด่วน`,
            branch: branchName,
            branchId: branchId,
            time: mostRecentTime,
            count: urgentMaintenance.length,
            expandable: true,
            items: urgentMaintenance.map(request => {
              const room = rooms.find(r => r.id === request.room_id);
              return {
                id: `maintenance-${request.id}`,
                title: `ห้อง ${room?.room_number || 'N/A'}`,
                subtitle: request.title,
                priority: request.priority
              };
            }),
            action: () => {
              if (showAllBranches && branchId !== selectedBranchId) {
                localStorage.setItem('selected_branch_id', branchId);
                localStorage.setItem('selected_branch_name', branchName);
              }
              navigate(createPageUrl('Maintenance'));
              onClose();
            }
          });
        } else {
          urgentMaintenance.forEach(request => {
            const room = rooms.find(r => r.id === request.room_id);
            alerts.push({
              id: `maintenance-${request.id}`,
              type: 'maintenance',
              icon: Wrench,
              color: 'purple',
              title: `${request.priority === 'urgent' ? '🚨 เร่งด่วนมาก' : '⚠️ เร่งด่วน'} - ห้อง ${room?.room_number || 'N/A'}`,
              message: request.title,
              branch: branchName,
              branchId: branchId,
              priority: request.priority,
              time: request.created_date || new Date().toISOString(),
              action: () => {
                if (showAllBranches && branchId !== selectedBranchId) {
                  localStorage.setItem('selected_branch_id', branchId);
                  localStorage.setItem('selected_branch_name', branchName);
                }
                navigate(createPageUrl('Maintenance'));
                onClose();
              }
            });
          });
        }
      }

      // 6. พัสดุค้างรับเกิน X วัน
      const unclaimedDeliveries = materialDeliveries.filter(d => {
        if (d.status === 'picked_up' || !d.delivery_date) return false;
        try {
          const deliveryDate = parseISO(d.delivery_date);
          const daysUnclaimed = differenceInDays(now, deliveryDate);
          return daysUnclaimed >= unclaimedDaysThreshold;
        } catch {
          return false;
        }
      });

      if (unclaimedDeliveries.length > 10) {
        const mostRecentTime = unclaimedDeliveries[0]?.delivery_date || new Date().toISOString();

        alerts.push({
          id: `delivery-group-${branchId}`,
          type: 'delivery-group',
          icon: Package,
          color: 'amber',
          title: `พัสดุค้างรับ ${unclaimedDeliveries.length} รายการ`,
          message: `ควรติดตามผู้รับ`,
          branch: branchName,
          branchId: branchId,
          time: mostRecentTime,
          count: unclaimedDeliveries.length,
          expandable: true,
          items: unclaimedDeliveries.map(delivery => {
            const daysUnclaimed = delivery.delivery_date ? differenceInDays(now, parseISO(delivery.delivery_date)) : 0;
            const room = rooms.find(r => r.id === delivery.room_id);
            return {
              id: `delivery-${delivery.id}`,
              title: delivery.recipient_name,
              subtitle: `ค้าง ${daysUnclaimed} วัน${room ? ` (ห้อง ${room.room_number})` : ''}`
            };
          }),
          action: () => {
            if (showAllBranches && branchId !== selectedBranchId) {
              localStorage.setItem('selected_branch_id', branchId);
              localStorage.setItem('selected_branch_name', branchName);
            }
            navigate(createPageUrl('Materials'));
            onClose();
          }
        });
      } else {
        unclaimedDeliveries.forEach(delivery => {
          const daysUnclaimed = delivery.delivery_date ? differenceInDays(now, parseISO(delivery.delivery_date)) : 0;
          const room = rooms.find(r => r.id === delivery.room_id);
          
          alerts.push({
            id: `delivery-${delivery.id}`,
            type: 'delivery',
            icon: Package,
            color: 'amber',
            title: `พัสดุค้างรับ - ${delivery.recipient_name}`,
            message: `ค้างมาแล้ว ${daysUnclaimed} วัน${room ? ` (ห้อง ${room.room_number})` : ''}`,
            branch: branchName,
            branchId: branchId,
            time: delivery.delivery_date || new Date().toISOString(),
            action: () => {
              if (showAllBranches && branchId !== selectedBranchId) {
                localStorage.setItem('selected_branch_id', branchId);
                localStorage.setItem('selected_branch_name', branchName);
              }
              navigate(createPageUrl('Materials'));
              onClose();
            }
          });
        });
      }

      // 7. สัญญาใกล้หมด
      const expiringBookings = bookings.filter(b => {
        if (b.status !== 'active' || !b.check_out_date) return false;
        try {
          const daysUntilExpiry = differenceInDays(parseISO(b.check_out_date), now);
          return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
        } catch {
          return false;
        }
      });

      if (expiringBookings.length > 10) {
        const mostRecentTime = expiringBookings[0]?.check_out_date || new Date().toISOString();

        alerts.push({
          id: `contract-group-${branchId}`,
          type: 'contract-group',
          icon: Clock,
          color: 'amber',
          title: `สัญญาใกล้หมด ${expiringBookings.length} รายการ`,
          message: `ควรติดต่อผู้เช่าเพื่อต่อสัญญา`,
          branch: branchName,
          branchId: branchId,
          time: mostRecentTime,
          count: expiringBookings.length,
          expandable: true,
          items: expiringBookings.map(booking => {
            const room = rooms.find(r => r.id === booking.room_id);
            const daysUntil = booking.check_out_date ? differenceInDays(parseISO(booking.check_out_date), now) : 0;
            return {
              id: `contract-${booking.id}`,
              title: `ห้อง ${room?.room_number || 'N/A'}`,
              subtitle: `เหลืออีก ${daysUntil} วัน`
            };
          }),
          action: () => {
            if (showAllBranches && branchId !== selectedBranchId) {
              localStorage.setItem('selected_branch_id', branchId);
              localStorage.setItem('selected_branch_name', branchName);
            }
            navigate(createPageUrl('Contracts'));
            onClose();
          }
        });
      } else {
        expiringBookings.forEach(booking => {
          const room = rooms.find(r => r.id === booking.room_id);
          const daysUntil = booking.check_out_date ? differenceInDays(parseISO(booking.check_out_date), now) : 0;
          
          alerts.push({
            id: `contract-${booking.id}`,
            type: 'contract',
            icon: Clock,
            color: 'amber',
            title: `สัญญาใกล้หมด - ห้อง ${room?.room_number || 'N/A'}`,
            message: `เหลืออีก ${daysUntil} วัน`,
            branch: branchName,
            branchId: branchId,
            time: booking.check_out_date || new Date().toISOString(),
            action: () => {
              if (showAllBranches && branchId !== selectedBranchId) {
                localStorage.setItem('selected_branch_id', branchId);
                localStorage.setItem('selected_branch_name', branchName);
              }
              navigate(createPageUrl('Contracts'));
              onClose();
            }
          });
        });
      }

      // เรียงตามเวลาล่าสุดก่อน
      alerts.sort((a, b) => {
        try {
          const timeA = new Date(a.time);
          const timeB = new Date(b.time);
          return timeB - timeA; // ล่าสุดก่อน
        } catch {
          return 0;
        }
      });

      if (alerts.length > 0) {
        branchNotifications[branchId] = {
          branchName,
          alerts
        };
      }
    });

    return branchNotifications;
  }, [allPayments, allRooms, allMaintenanceRequests, allBookings, allMaterialDeliveries, allTenants, notificationConfigs, configs, navigate, isOpen, paymentsLoading, branches, showAllBranches, readNotifications]);

  const allNotifications = Object.values(notificationsByBranch).flatMap(b => b.alerts);
  const filteredNotifications = filterBranch === 'all' 
    ? allNotifications 
    : allNotifications.filter(n => n.branchId === filterBranch);

  // ⭐ แสดงเฉพาะที่ยังไม่อ่าน - ซ่อนที่อ่านแล้ว
  const visibleNotifications = filteredNotifications.filter(n => !isNotificationRead(n.id));
  const unreadCount = visibleNotifications.length;

  if (!isOpen) return null;

  const currentBranch = branches.find(b => b.id === selectedBranchId);
  const currentBranchName = currentBranch?.branch_name || localStorage.getItem('selected_branch_name') || 'สาขาปัจจุบัน';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: -20, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -20, opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="absolute top-4 right-2 md:top-16 md:right-8 w-[96vw] md:w-full max-w-md shadow-2xl max-h-[95vh] md:max-h-none"
          onClick={(e) => e.stopPropagation()}
        >
          <Card className="bg-white shadow-2xl border border-slate-200 rounded-xl md:rounded-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 md:p-6 border-b bg-gradient-to-br from-slate-50 to-white flex-shrink-0">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center relative shadow-md">
                    <Bell className="w-5 h-5 md:w-6 md:h-6 text-white" />
                    {unreadCount > 0 && (
                      <motion.div 
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-gradient-to-r from-red-500 to-pink-600 rounded-full flex items-center justify-center shadow-md text-white text-[10px] md:text-xs font-bold"
                      >
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </motion.div>
                    )}
                  </div>
                  <div>
                    <h2 className="text-base md:text-xl text-slate-900 font-bold">การแจ้งเตือน</h2>
                    <p className="text-xs text-slate-600">
                      {currentBranchName} · {unreadCount > 0 ? `${unreadCount} รายการใหม่` : 'ไม่มีรายการใหม่'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 h-8 w-8 md:h-10 md:w-10"
                >
                  <X className="w-4 h-4 md:w-5 md:h-5" />
                </Button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {unreadCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => markAllAsReadMutation.mutate(visibleNotifications.map(n => n.id))}
                    className="text-xs h-8"
                  >
                    <CheckCheck className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                    อ่านทั้งหมด
                  </Button>
                )}
                {canDelete && filteredNotifications.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (confirm('ลบการแจ้งเตือนทั้งหมด?')) {
                        deleteAllNotificationsMutation.mutate(filteredNotifications.map(n => n.id));
                      }
                    }}
                    className="text-xs h-8"
                  >
                    <Trash2 className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                    ลบ
                  </Button>
                )}
                {showAllBranches && branches.length > 1 && (
                  <select
                    value={filterBranch}
                    onChange={(e) => setFilterBranch(e.target.value)}
                    className="flex-1 md:flex-none px-3 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">ทุกสาขา ({allNotifications.length})</option>
                    {Object.entries(notificationsByBranch).map(([branchId, branchData]) => (
                      <option key={branchId} value={branchId}>
                        {branchData.branchName} ({branchData.alerts.length})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-50/50 to-white">
              <CardContent className="p-3 md:p-6">
                {visibleNotifications.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center py-12"
                  >
                    <div className="relative w-20 h-20 mx-auto mb-4">
                      <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full blur-xl opacity-30"></div>
                      <div className="relative w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center shadow-lg">
                        <CheckCheck className="w-10 h-10 text-white" />
                      </div>
                    </div>
                    <p className="text-slate-700 font-semibold text-lg">
                      {paymentsLoading ? 'กำลังโหลด...' : 'ไม่มีการแจ้งเตือน'}
                    </p>
                    <p className="text-slate-500 text-sm mt-2">
                      {paymentsLoading ? 'กรุณารอสักครู่' : 'ทุกอย่างเรียบร้อยดี ✨'}
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(notificationsByBranch)
                      .filter(([branchId]) => filterBranch === 'all' || filterBranch === branchId)
                      .map(([branchId, branchData]) => (
                      <div key={branchId}>
                        {showAllBranches && filterBranch === 'all' && (
                          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-gradient-to-r from-blue-500/10 to-indigo-500/10 rounded-xl border border-blue-200">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-sm">
                              <Building2 className="w-4 h-4 text-white" />
                            </div>
                            <h3 className="text-sm font-bold text-slate-800">{branchData.branchName}</h3>
                            {branchData.alerts.filter(a => !isNotificationRead(a.id) && !isNotificationDeleted(a.id)).length > 0 && (
                              <Badge className="bg-gradient-to-r from-red-500 to-pink-600 text-white border-0 text-xs ml-auto shadow-sm">
                                {branchData.alerts.filter(a => !isNotificationRead(a.id) && !isNotificationDeleted(a.id)).length}
                              </Badge>
                            )}
                          </div>
                        )}

                        <div className="space-y-3">
                          {branchData.alerts.map((notif, index) => {
                            const IconComponent = notif.icon;
                            const isRead = isNotificationRead(notif.id);
                            const isExpanded = expandedGroups[notif.id] || false;
                            const isSwiped = swipedItem === notif.id;
                            const colorMap = {
                              red: { gradient: 'from-red-500 to-rose-600', border: '#ef4444', bg: 'bg-gradient-to-br from-red-50 to-rose-50', ring: 'ring-red-200', glow: 'shadow-red-200/50' },
                              green: { gradient: 'from-green-500 to-emerald-600', border: '#10b981', bg: 'bg-gradient-to-br from-green-50 to-emerald-50', ring: 'ring-green-200', glow: 'shadow-green-200/50' },
                              blue: { gradient: 'from-blue-500 to-indigo-600', border: '#3b82f6', bg: 'bg-gradient-to-br from-blue-50 to-indigo-50', ring: 'ring-blue-200', glow: 'shadow-blue-200/50' },
                              purple: { gradient: 'from-purple-500 to-fuchsia-600', border: '#a855f7', bg: 'bg-gradient-to-br from-purple-50 to-fuchsia-50', ring: 'ring-purple-200', glow: 'shadow-purple-200/50' },
                              amber: { gradient: 'from-amber-500 to-orange-600', border: '#f59e0b', bg: 'bg-gradient-to-br from-amber-50 to-orange-50', ring: 'ring-amber-200', glow: 'shadow-amber-200/50' }
                            };

                            return (
                              <motion.div
                                key={notif.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ 
                                  opacity: 1, 
                                  y: 0,
                                  x: isSwiped ? -80 : 0 
                                }}
                                exit={{ opacity: 0, x: -100 }}
                                transition={{ delay: index * 0.05 }}
                                className="relative"
                                drag={canDelete && !notif.expandable ? "x" : false}
                                dragConstraints={{ left: -100, right: 0 }}
                                dragElastic={0.1}
                                onDragEnd={(e, info) => {
                                  if (info.offset.x < -60) {
                                    setSwipedItem(notif.id);
                                  } else {
                                    setSwipedItem(null);
                                  }
                                }}
                              >
                                {canDelete && isSwiped && (
                                  <div className="absolute right-0 top-0 bottom-0 w-20 bg-red-500 rounded-r-lg flex items-center justify-center">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        deleteNotificationMutation.mutate(notif.id);
                                      }}
                                      className="text-white hover:bg-red-600"
                                    >
                                      <Trash2 className="w-5 h-5" />
                                    </Button>
                                  </div>
                                )}
                                
                                <Card
                                  className={`group ${colorMap[notif.color].bg} ${isRead ? 'opacity-60' : `shadow-lg ${colorMap[notif.color].glow}`} ${notif.expandable ? '' : 'cursor-pointer hover:shadow-xl hover:scale-[1.02]'} transition-all duration-300 relative border-0 overflow-hidden rounded-2xl`}
                                >
                                  <div className={`absolute inset-0 bg-gradient-to-r ${colorMap[notif.color].gradient} opacity-5`}></div>
                                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${colorMap[notif.color].gradient}`}></div>
                                  
                                  <CardContent className="p-5 relative">
                                    <div 
                                      className="flex items-start gap-4"
                                      onClick={() => {
                                        if (!notif.expandable && notif.type !== 'failed-slip') {
                                          markAsReadMutation.mutate(notif.id);
                                          notif.action();
                                        }
                                      }}
                                    >
                                      <div className={`relative w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg`}>
                                        <div className={`absolute inset-0 bg-gradient-to-br ${colorMap[notif.color].gradient} rounded-2xl blur-md opacity-50`}></div>
                                        <div className={`relative w-12 h-12 bg-gradient-to-br ${colorMap[notif.color].gradient} rounded-2xl flex items-center justify-center border-2 border-white/50`}>
                                          <IconComponent className="w-6 h-6 text-white drop-shadow-sm" />
                                        </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-3 mb-2">
                                          <div className="flex-1">
                                            <p className="font-bold text-slate-900 text-base leading-tight">
                                              {notif.title}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            {!isRead && (
                                              <motion.div 
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                className={`w-3 h-3 bg-gradient-to-br ${colorMap[notif.color].gradient} rounded-full flex-shrink-0 shadow-lg mt-0.5`}
                                              ></motion.div>
                                            )}
                                            {canDelete && !notif.expandable && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all rounded-full"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  deleteNotificationMutation.mutate(notif.id);
                                                }}
                                              >
                                                <X className="w-4 h-4" />
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-sm text-slate-700 leading-relaxed">{notif.message}</p>
                                        
                                        {/* ⭐ ปุ่มยืนยันชำระสำหรับ failed-slip */}
                                        {notif.type === 'failed-slip' && notif.paymentId && (
                                          <div className="mt-3 space-y-2">
                                            {notif.slipUrl && (
                                              <button 
                                                className="block w-full cursor-pointer"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setSlipPreview({ open: true, url: notif.slipUrl, title: notif.title });
                                                }}
                                              >
                                                <img 
                                                  src={notif.slipUrl} 
                                                  alt="สลิป" 
                                                  className="w-full max-h-32 object-contain rounded-lg border border-slate-200 bg-white hover:opacity-80 transition-opacity"
                                                />
                                                <span className="text-xs text-blue-600 flex items-center justify-center gap-1 mt-1">
                                                  <ZoomIn className="w-3 h-3" /> คลิกเพื่อขยาย
                                                </span>
                                              </button>
                                            )}
                                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                             <Button
                                               type="button"
                                               size="sm"
                                               className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                                               disabled={confirmPaymentMutation.isPending && confirmingPaymentId === notif.paymentId}
                                               onClick={(e) => {
                                                 e.preventDefault();
                                                 e.stopPropagation();
                                                 console.log('🔘 NotificationsPanel: Confirm button clicked for:', notif.paymentId);
                                                 if (confirm(`ยืนยันชำระเงิน ${notif.totalAmount?.toLocaleString()} บาท?`)) {
                                                   console.log('✅ User confirmed, executing mutation...');
                                                   setConfirmingPaymentId(notif.paymentId);
                                                   confirmPaymentMutation.mutate(notif.paymentId);
                                                 } else {
                                                   console.log('❌ User cancelled confirmation');
                                                 }
                                               }}
                                             >
                                               {confirmPaymentMutation.isPending && confirmingPaymentId === notif.paymentId ? (
                                                 <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                               ) : (
                                                 <Check className="w-4 h-4 mr-1" />
                                               )}
                                               ยืนยันชำระ
                                             </Button>
                                             <Button
                                               type="button"
                                               size="sm"
                                               variant="outline"
                                               onClick={(e) => {
                                                 e.preventDefault();
                                                 e.stopPropagation();
                                                 markAsReadMutation.mutate(notif.id);
                                                 notif.action();
                                               }}
                                             >
                                               ดูรายละเอียด
                                             </Button>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {notif.expandable && (
                                          <div className="mt-3">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setExpandedGroups(prev => ({
                                                  ...prev,
                                                  [notif.id]: !prev[notif.id]
                                                }));
                                              }}
                                              className="w-full text-xs"
                                            >
                                              {isExpanded ? (
                                                <>
                                                  <ChevronUp className="w-4 h-4 mr-1" />
                                                  ซ่อนรายการ
                                                </>
                                              ) : (
                                                <>
                                                  <ChevronDown className="w-4 h-4 mr-1" />
                                                  ดูทั้งหมด ({notif.count} รายการ)
                                                </>
                                              )}
                                            </Button>

                                            <AnimatePresence>
                                              {isExpanded && (
                                                <motion.div
                                                  initial={{ opacity: 0, height: 0 }}
                                                  animate={{ opacity: 1, height: 'auto' }}
                                                  exit={{ opacity: 0, height: 0 }}
                                                  className="mt-2 space-y-1 max-h-64 overflow-y-auto"
                                                >
                                                  {notif.items.map((item) => (
                                                    <div 
                                                      key={item.id}
                                                      className={`bg-white border rounded p-2 text-xs hover:bg-opacity-80 cursor-pointer ${
                                                        notif.color === 'red' ? 'border-red-200 hover:bg-red-50' :
                                                        notif.color === 'purple' ? 'border-purple-200 hover:bg-purple-50' :
                                                        notif.color === 'amber' ? 'border-amber-200 hover:bg-amber-50' :
                                                        'border-green-200 hover:bg-green-50'
                                                      }`}
                                                      onClick={() => {
                                                        markAsReadMutation.mutate(notif.id);
                                                        notif.action();
                                                      }}
                                                    >
                                                      <div className="flex justify-between items-center">
                                                        <span className="font-medium text-slate-700">
                                                          {item.title}
                                                        </span>
                                                        {item.amount && (
                                                          <span className="text-red-600 font-semibold">
                                                            {item.amount?.toLocaleString()} ฿
                                                          </span>
                                                        )}
                                                        {item.priority && (
                                                          <Badge className={`text-xs ${
                                                            item.priority === 'urgent' ? 'bg-red-500 text-white' :
                                                            'bg-orange-500 text-white'
                                                          }`}>
                                                            {item.priority === 'urgent' ? 'เร่งด่วน' : 'สูง'}
                                                          </Badge>
                                                        )}
                                                      </div>
                                                      <p className="text-slate-500 mt-0.5">
                                                        {item.subtitle}
                                                      </p>
                                                    </div>
                                                  ))}
                                                </motion.div>
                                              )}
                                            </AnimatePresence>
                                          </div>
                                        )}

                                        {notif.time && (
                                          <p className="text-xs text-slate-400 mt-2">
                                            {(() => {
                                              try {
                                                const date = new Date(notif.time);
                                                return formatDistanceToNow(date, { locale: th, addSuffix: true });
                                              } catch {
                                                return '-';
                                              }
                                            })()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </CardContent>
                                </Card>
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </div>
          </Card>
        </motion.div>

        {/* Slip Preview Dialog */}
        <SlipPreviewDialog
          open={slipPreview.open}
          onOpenChange={(open) => setSlipPreview(prev => ({ ...prev, open }))}
          slipUrl={slipPreview.url}
          title={slipPreview.title}
        />
      </motion.div>
    </AnimatePresence>
  );
}