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

  const unreadCount = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // เทียบเป็นวันเท่านั้น
    
    const overduePayments = allPayments.filter(p => {
      if (p.status === 'paid' || !p.due_date) return false;
      try {
        const dueDate = parseISO(p.due_date);
        const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const isOverdue = now > dueDateStart;
        
        // Debug log
        if (isOverdue) {
          console.log('🔴 PageHeader: Overdue payment found:', {
            room_id: p.room_id,
            due_date: p.due_date,
            status: p.status,
            total_amount: p.total_amount,
            branch_id: p.branch_id
          });
        }
        
        return isOverdue;
      } catch {
        return false;
      }
    });

    console.log('🔔 PageHeader: Calculating unread count for branch', selectedBranchId);
    console.log('   - Overdue payments:', overduePayments.length, 'from', allPayments.length, 'total payments');
    console.log('   - Urgent maintenance:', allMaintenanceRequests.filter(m => m.status === 'pending' && (m.priority === 'urgent' || m.priority === 'high')).length);

    const urgentMaintenance = allMaintenanceRequests.filter(m => 
      m.status === 'pending' && (m.priority === 'urgent' || m.priority === 'high')
    ).length;

    return overduePayments.length + urgentMaintenance;
  }, [allPayments, allMaintenanceRequests, selectedBranchId]);

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
              
              {actions}
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