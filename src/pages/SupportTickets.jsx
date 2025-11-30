import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, Inbox, Plus, RefreshCw, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import PageHeader from "../components/shared/PageHeader";
import ReportIssueDialog from "../components/settings/ReportIssueDialog";

export default function SupportTickets() {
  const [activeTab, setActiveTab] = useState('open');
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: tickets = [], isLoading, refetch } = useQuery({
    queryKey: ['supportTickets', currentUser?.email],
    queryFn: async () => {
      const allTickets = await base44.entities.SupportTicket.list('-created_date', 100);
      return allTickets.filter(t => t.reporter_email === currentUser?.email);
    },
    enabled: !!currentUser?.email,
  });

  const openTickets = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
  const closedTickets = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');

  const displayTickets = activeTab === 'open' ? openTickets : activeTab === 'closed' ? closedTickets : tickets;

  const getCategoryIcon = (category) => {
    switch(category) {
      case 'bug': return '🐛';
      case 'feature_request': return '✨';
      case 'question': return '❓';
      default: return '📝';
    }
  };

  const getPriorityColor = (priority) => {
    switch(priority) {
      case 'urgent': return 'bg-red-100 text-red-700 border-red-300';
      case 'high': return 'bg-orange-100 text-orange-700 border-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'low': return 'bg-blue-100 text-blue-700 border-blue-300';
      default: return 'bg-slate-100 text-slate-700 border-slate-300';
    }
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'open':
        return <Badge className="bg-blue-500 text-white">เปิด</Badge>;
      case 'in_progress':
        return <Badge className="bg-yellow-500 text-white">กำลังดำเนินการ</Badge>;
      case 'resolved':
        return <Badge className="bg-green-500 text-white">แก้ไขแล้ว</Badge>;
      case 'closed':
        return <Badge className="bg-slate-500 text-white">ปิด</Badge>;
      default:
        return <Badge className="bg-slate-300 text-slate-700">{status}</Badge>;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <PageHeader
        title="รายงานปัญหา"
        subtitle={`แสดงทั้งหมด ${tickets.length} รายการ`}
        icon={AlertCircle}
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => refetch()}
              size="sm"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              รีเฟรช
            </Button>
            <Button
              onClick={() => setShowNewTicketDialog(true)}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              รายงานปัญหาใหม่
            </Button>
          </>
        }
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 border-b pb-4 mb-6">
                <button
                  onClick={() => setActiveTab('open')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === 'open'
                      ? 'bg-blue-100 text-blue-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  เปิด ({openTickets.length})
                </button>
                <button
                  onClick={() => setActiveTab('closed')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === 'closed'
                      ? 'bg-green-100 text-green-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <CheckCircle className="w-4 h-4" />
                  ปิด ({closedTickets.length})
                </button>
                <button
                  onClick={() => setActiveTab('all')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    activeTab === 'all'
                      ? 'bg-slate-100 text-slate-700 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Inbox className="w-4 h-4" />
                  ทั้งหมด ({tickets.length})
                </button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : displayTickets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Inbox className="w-12 h-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">
                    {activeTab === 'open' ? 'ไม่มีรายงานที่เปิดอยู่' : 'ไม่มีรายงาน'}
                  </h3>
                  <p className="text-slate-600 mb-6">
                    {activeTab === 'open' 
                      ? 'คุณไม่มีรายงานปัญหาที่เปิดอยู่ในขณะนี้'
                      : 'คุณยังไม่ได้สร้างรายงานปัญหา'}
                  </p>
                  <Button
                    onClick={() => setShowNewTicketDialog(true)}
                    className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    สร้างรายงานใหม่
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayTickets.map((ticket, index) => (
                    <motion.div
                      key={ticket.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card className="hover:shadow-md transition-shadow border border-slate-200">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-2xl">{getCategoryIcon(ticket.category)}</span>
                                <h3 className="font-bold text-slate-800 truncate flex-1">
                                  {ticket.title}
                                </h3>
                                {getStatusBadge(ticket.status)}
                              </div>
                              
                              <p className="text-sm text-slate-600 mb-3 line-clamp-2">
                                {ticket.description}
                              </p>

                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {format(parseISO(ticket.created_date), 'd MMM yyyy HH:mm', { locale: th })}
                                </span>
                                <Badge variant="outline" className={getPriorityColor(ticket.priority)}>
                                  {ticket.priority === 'urgent' ? 'เร่งด่วน' : 
                                   ticket.priority === 'high' ? 'สำคัญ' :
                                   ticket.priority === 'medium' ? 'ปกติ' : 'ไม่เร่ง'}
                                </Badge>
                              </div>

                              {ticket.response && (
                                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                  <p className="text-xs font-semibold text-blue-900 mb-1">💬 คำตอบจากทีม:</p>
                                  <p className="text-sm text-blue-800">{ticket.response}</p>
                                </div>
                              )}
                            </div>

                            {ticket.image_urls && ticket.image_urls.length > 0 && (
                              <div className="flex-shrink-0">
                                <img 
                                  src={ticket.image_urls[0]} 
                                  alt="ภาพประกอบ"
                                  className="w-20 h-20 object-cover rounded-lg border border-slate-200"
                                />
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ReportIssueDialog
        isOpen={showNewTicketDialog}
        onClose={() => {
          setShowNewTicketDialog(false);
          refetch();
        }}
        currentUser={currentUser}
      />
    </div>
  );
}