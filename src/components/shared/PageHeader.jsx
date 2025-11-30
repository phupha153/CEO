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
    queryKey: ['allPayments', 'header', selectedBranchId],
    queryFn: () => selectedBranchId 
      ? base44.entities.Payment.filter({ branch_id: selectedBranchId })
      : base44.entities.Payment.list('-created_date', 1000),
    enabled: showNotifications && !!selectedBranchId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: allMaintenanceRequests = [] } = useQuery({
    queryKey: ['allMaintenanceRequests', 'header', selectedBranchId],
    queryFn: () => selectedBranchId
      ? base44.entities.MaintenanceRequest.filter({ branch_id: selectedBranchId })
      : base44.entities.MaintenanceRequest.list('-created_date', 200),
    enabled: showNotifications && !!selectedBranchId,
    staleTime: 2 * 60 * 1000,
  });

  const unreadCount = useMemo(() => {
    const now = new Date();
    
    const overduePayments = allPayments.filter(p => {
      if (p.status === 'paid' || !p.due_date) return false;
      try {
        const dueDate = parseISO(p.due_date);
        return now > dueDate;
      } catch {
        return false;
      }
    }).length;

    const urgentMaintenance = allMaintenanceRequests.filter(m => 
      m.status === 'pending' && (m.priority === 'urgent' || m.priority === 'high')
    ).length;

    return overduePayments + urgentMaintenance;
  }, [allPayments, allMaintenanceRequests]);

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
              
              <div className="flex-1 min-w-0">
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
                  className="relative hover:bg-white/50 hover:bg-blue-100/50"
                >
                  <Bell className="w-5 h-5 text-slate-700" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
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