import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import NotificationsPanel from "./NotificationsPanel";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { differenceInDays, parseISO } from "date-fns";

export default function PageHeader({ 
  title, 
  subtitle, 
  icon: Icon, 
  actions,
  showBackButton = false,
  backUrl = null,
  showNotifications = true
}) {
  const navigate = useNavigate();
  const [notificationsPanelOpen, setNotificationsPanelOpen] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: 60 * 60 * 1000,
  });

  const selectedBranchId = localStorage.getItem('selected_branch_id');

  const { data: allPayments = [] } = useQuery({
    queryKey: ['allPayments', 'toast', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const payments = await base44.entities.Payment.filter({ branch_id: selectedBranchId });
      console.log('🔔 PageHeader: Loaded payments for branch', selectedBranchId, '- Total:', payments.length);
      return payments;
    },
    enabled: showNotifications && !!selectedBranchId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: allMaintenanceRequests = [] } = useQuery({
    queryKey: ['allMaintenanceRequests', 'toast', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const requests = await base44.entities.MaintenanceRequest.filter({ branch_id: selectedBranchId });
      console.log('🔔 PageHeader: Loaded maintenance for branch', selectedBranchId, '- Total:', requests.length);
      return requests;
    },
    enabled: showNotifications && !!selectedBranchId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const { data: allBookings = [] } = useQuery({
    queryKey: ['allBookings', 'toast', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const bookings = await base44.entities.Booking.filter({ branch_id: selectedBranchId });
      return bookings;
    },
    enabled: showNotifications && !!selectedBranchId,
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
    enabled: showNotifications && !!currentUser?.email,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const unreadCount = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    // ฟังก์ชันเช็คว่า notification ถูกอ่านแล้วหรือยัง
    const isRead = (notifId) => {
      return readNotifications.some(n => n.notification_id === notifId && n.is_read);
    };

    let count = 0;

    // 1. สลิปตรวจสอบไม่ผ่าน
    const failedSlipPayments = allPayments.filter(p => 
      p.notes?.includes('⚠️ รอตรวจสอบ') && 
      p.status !== 'paid' &&
      !p.notes?.includes('✅ ยืนยันชำระแล้ว')
    );
    failedSlipPayments.forEach(p => {
      if (!isRead(`failed-slip-${p.id}`)) count++;
    });

    // 2. เกินกำหนดชำระ
    const overduePayments = allPayments.filter(p => {
      if (p.status === 'paid' || !p.due_date) return false;
      try {
        const dueDate = parseISO(p.due_date);
        const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        return now > dueDateStart;
      } catch {
        return false;
      }
    });

    if (overduePayments.length > 10) {
      if (!isRead(`overdue-group-${selectedBranchId}`)) count++;
    } else {
      overduePayments.forEach(p => {
        if (!isRead(`overdue-${p.id}`)) count++;
      });
    }

    // 3. การจองใหม่ (7 วันล่าสุด)
    const newBookings = allBookings.filter(b => {
      if (!b.created_date) return false;
      try {
        const createdDate = parseISO(b.created_date);
        const daysAgo = differenceInDays(now, createdDate);
        return daysAgo <= 7;
      } catch {
        return false;
      }
    });
    newBookings.forEach(b => {
      if (!isRead(`new-booking-${b.id}`)) count++;
    });

    // 4. แจ้งซ่อมเร่งด่วน
    const urgentMaintenance = allMaintenanceRequests.filter(m => 
      m.status === 'pending' && (m.priority === 'urgent' || m.priority === 'high')
    );

    if (urgentMaintenance.length > 10) {
      if (!isRead(`maintenance-group-${selectedBranchId}`)) count++;
    } else {
      urgentMaintenance.forEach(m => {
        if (!isRead(`maintenance-${m.id}`)) count++;
      });
    }

    return count;
  }, [allPayments, allMaintenanceRequests, allBookings, selectedBranchId, readNotifications]);

  const handleBack = () => {
    if (backUrl) {
      navigate(backUrl);
    } else {
      navigate(createPageUrl('Dashboard'));
    }
  };

  return (
    <>
      <div className="relative z-10 bg-white/40 backdrop-blur-2xl border-b border-white/40 shadow-sm">
        <div className="px-4 md:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {showBackButton && (
                <Button
                  onClick={handleBack}
                  variant="ghost"
                  size="icon"
                  className="flex-shrink-0 hover:bg-white/50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              )}
              
              {Icon && (
                <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Icon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
              )}

              <div className="flex-1 min-w-0 hidden md:block">
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 truncate">{title}</h1>
                {subtitle && (
                  <p className="text-xs md:text-sm text-slate-600 truncate">{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}

              {showNotifications && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setNotificationsPanelOpen(true)}
                  className={`relative hover:bg-white/50 hover:bg-blue-100/50 ${unreadCount > 0 ? 'animate-pulse' : ''}`}
                >
                  <Bell className={`w-5 h-5 text-slate-700 ${unreadCount > 0 ? 'animate-[shake_0.5s_ease-in-out_infinite]' : ''}`} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center animate-bounce">
                      <span className="text-white text-xs font-bold">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    </span>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <NotificationsPanel 
        isOpen={notificationsPanelOpen} 
        onClose={() => setNotificationsPanelOpen(false)} 
      />
    </>
  );
}