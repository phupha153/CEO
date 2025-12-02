import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, Send, Users, CheckCircle, XCircle, AlertTriangle, Loader2, Search, UserCheck, Sparkles, MessageCircle, Facebook } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import PageHeader from "../components/shared/PageHeader";
import ChatSidebar from "../components/chat/ChatSidebar";
import ChatWindow from "../components/chat/ChatWindow";

export default function Announcements() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('broadcast'); // 'broadcast' | 'chat'
  
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [currentSending, setCurrentSending] = useState('');

  // AI Writing State
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Selection State
  const [targetType, setTargetType] = useState('all'); // 'all' | 'individual'
  const [selectedTenants, setSelectedTenants] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Chat State
  const [chatSearchTerm, setChatSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);

  // Get selected branch from localStorage
  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name');

  const { data: tenants = [], refetch: refetchTenants } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allTenants = await base44.entities.Tenant.list();
      // เพิ่ม room_number สำหรับ tenant ที่ยังไม่มี
      const rooms = await base44.entities.Room.list();
      const bookings = await base44.entities.Booking.list();
      
      return allTenants
        .filter(tenant => tenant.branch_id === selectedBranchId)
        .map(tenant => {
          if (!tenant.room_number) {
            const activeBooking = bookings.find(b => b.tenant_id === tenant.id && b.status === 'active');
            if (activeBooking) {
              const room = rooms.find(r => r.id === activeBooking.room_id);
              if (room?.room_number) {
                return { ...tenant, room_number: room.room_number };
              }
            }
          }
          return tenant;
        });
    },
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allRooms = await base44.entities.Room.list();
      return allRooms.filter(room => room.branch_id === selectedBranchId);
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allBookings = await base44.entities.Booking.list();
      return allBookings.filter(b => b.branch_id === selectedBranchId);
    },
    staleTime: 5 * 60 * 1000,
  });

  // สร้าง Map ของ tenant โดย line_user_id
  const tenantsMap = {};
  tenants.forEach(t => {
    if (t.line_user_id) tenantsMap[t.line_user_id] = t;
    if (t.id) tenantsMap[t.id] = t;
  });

  // ดึงข้อความ LINE เฉพาะสาขานี้
  const { data: lineMessages = [], isLoading: messagesLoading, error: messagesError } = useQuery({
    queryKey: ['lineMessages', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      // ดึงเฉพาะข้อความของสาขานี้
      const branchMessages = await base44.entities.LineMessage.filter({ branch_id: selectedBranchId }, '-created_date', 500);
      return branchMessages;
    },
    staleTime: 5 * 1000,
    refetchInterval: 5 * 1000,
    enabled: !!selectedBranchId,
  });

  // สร้าง conversations จากข้อความ - รวม user ที่เป็นคนเดียวกัน
  const conversations = React.useMemo(() => {
    const convMap = new Map();
    
    lineMessages.forEach(msg => {
      const key = msg.line_user_id;
      if (!convMap.has(key)) {
        convMap.set(key, {
          line_user_id: msg.line_user_id,
          line_display_name: msg.line_display_name,
          line_picture_url: msg.line_picture_url,
          tenant_id: msg.tenant_id,
          last_message: msg.content,
          last_message_time: msg.created_date,
          unread_count: 0
        });
      }
      
      const conv = convMap.get(key);
      // Update display name and picture if newer message has them
      if (msg.line_display_name && !conv.line_display_name) {
        conv.line_display_name = msg.line_display_name;
      }
      if (msg.line_picture_url && !conv.line_picture_url) {
        conv.line_picture_url = msg.line_picture_url;
      }
      if (msg.tenant_id && !conv.tenant_id) {
        conv.tenant_id = msg.tenant_id;
      }
      // Update last message if newer
      if (new Date(msg.created_date) > new Date(conv.last_message_time)) {
        conv.last_message = msg.content;
        conv.last_message_time = msg.created_date;
        // อัปเดต display name และ picture จากข้อความล่าสุด
        if (msg.line_display_name) conv.line_display_name = msg.line_display_name;
        if (msg.line_picture_url) conv.line_picture_url = msg.line_picture_url;
        if (msg.tenant_id) conv.tenant_id = msg.tenant_id;
      }
      // Count unread incoming messages
      if (msg.direction === 'incoming' && !msg.is_read) {
        conv.unread_count++;
      }
    });
    
    return Array.from(convMap.values()).sort((a, b) => 
      new Date(b.last_message_time) - new Date(a.last_message_time)
    );
  }, [lineMessages]);

  // ข้อความของ conversation ที่เลือก
  const selectedMessages = React.useMemo(() => {
    if (!selectedConversation) return [];
    return lineMessages
      .filter(m => m.line_user_id === selectedConversation.line_user_id)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
  }, [lineMessages, selectedConversation]);

  // ⭐ เมื่อเปิด conversation ให้ mark unread messages เป็น read
  React.useEffect(() => {
    if (!selectedConversation) return;
    
    const unreadMessages = selectedMessages.filter(m => 
      m.direction === 'incoming' && !m.is_read
    );
    
    if (unreadMessages.length > 0) {
      // อัปเดตทีละ batch เพื่อไม่ให้ช้า
      Promise.all(
        unreadMessages.map(msg => 
          base44.entities.LineMessage.update(msg.id, { is_read: true })
            .catch(err => console.warn('Failed to mark as read:', err))
        )
      ).then(() => {
        // Refresh messages หลังจาก mark เป็น read
        queryClient.invalidateQueries(['lineMessages', selectedBranchId]);
      });
    }
  }, [selectedConversation?.line_user_id, selectedMessages]);

  // นับผู้เช่าที่มี LINE/Facebook User ID
  const tenantsWithLine = tenants.filter(t => t.line_user_id);
  const tenantsWithFacebook = tenants.filter(t => t.facebook_user_id);
  const tenantsWithMessaging = tenants.filter(t => t.line_user_id || t.facebook_user_id);

  // Reset selection when branch changes
  useEffect(() => {
    setSelectedTenants(new Set());
    setTargetType('all');
    setSearchTerm('');
    setSelectedConversation(null);
  }, [selectedBranchId]);

  // ส่งข้อความตอบกลับใน chat
  const handleSendChatMessage = async (content) => {
    if (!selectedConversation || !content.trim()) return;

    try {
      // ส่งข้อความผ่าน LINE
      const response = await base44.functions.invoke('sendLineMessage', {
        to: selectedConversation.line_user_id,
        message: content,
        branch_id: selectedBranchId
      });

      // เช็ค error จาก response
      if (response.data?.error) {
        throw new Error(response.data.error + (response.data.details ? ': ' + JSON.stringify(response.data.details) : ''));
      }

      // บันทึกข้อความขาออก
      const user = await base44.auth.me();
      await base44.entities.LineMessage.create({
        branch_id: selectedBranchId,
        tenant_id: selectedConversation.tenant_id,
        line_user_id: selectedConversation.line_user_id,
        line_display_name: selectedConversation.line_display_name,
        direction: 'outgoing',
        message_type: 'text',
        content: content,
        sent_by: user?.email
      });

      // Refresh messages
      queryClient.invalidateQueries(['lineMessages', selectedBranchId]);
      toast.success('ส่งข้อความสำเร็จ');
    } catch (error) {
      console.error('Send error:', error);
      throw error;
    }
  };

  const handleToggleTenant = (id) => {
    const newSelected = new Set(selectedTenants);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTenants(newSelected);
  };

  const handleToggleAll = () => {
    if (selectedTenants.size === tenantsWithLine.length) {
      setSelectedTenants(new Set());
    } else {
      setSelectedTenants(new Set(tenantsWithLine.map(t => t.id)));
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('กรุณาพิมพ์ข้อความก่อนส่ง');
      return;
    }

    const targets = targetType === 'all' 
      ? tenantsWithLine 
      : tenantsWithLine.filter(t => selectedTenants.has(t.id));

    if (targets.length === 0) {
      toast.error('กรุณาเลือกผู้รับอย่างน้อย 1 คน');
      return;
    }

    if (!confirm(`คุณต้องการส่งข้อความนี้ให้ ${targets.length} คนใช่หรือไม่?`)) {
      return;
    }

    setSending(true);
    setResult(null);
    setProgress(0);
    setCurrentSending(''); // Reset current sending display

    try {
      // ✅ ใช้ batch sending function ใหม่
      const recipients = targets.map(tenant => ({
        lineUserId: tenant.line_user_id,
        branchId: tenant.branch_id,
        message: message,
        metadata: {
          tenantId: tenant.id,
          tenantName: tenant.full_name,
          roomNumber: tenant.room_number,
          branchId: tenant.branch_id
        }
      }));

      console.log(`📤 Sending to ${recipients.length} recipients via batch function...`);

      const response = await base44.functions.invoke('sendBatchLineMessages', {
        recipients: recipients,
        options: {
          batchSize: 20,           // ส่งพร้อมกัน 20 คนต่อ batch
          delayBetweenBatches: 2000, // รอ 2 วินาทีระหว่าง batch
          delayBetweenMessages: 100,  // รอ 100ms ระหว่างข้อความ
          retryAttempts: 3         // ลองใหม่ 3 ครั้ง
        }
      });

      const apiResult = response.data; // Rename to avoid shadowing state 'result'

      if (apiResult) { // Assuming apiResult exists, further check apiResult.success for aggregated counts
        setResult({
          success: apiResult.successfulSends,
          failed: apiResult.failedSends,
          errors: apiResult.errors || []
        });

        setProgress(100);
        setCurrentSending(''); // Clear after batch completes

        if (apiResult.failedSends === 0) {
          toast.success(`ส่งข้อความสำเร็จทั้งหมด ${apiResult.successfulSends} คน`);
          setMessage(''); // Clear message after successful send
        } else if (apiResult.successfulSends === 0) {
          toast.error('ส่งข้อความไม่สำเร็จทั้งหมด');
        } else {
          toast.warning(`ส่งสำเร็จ ${apiResult.successfulSends} คน, ไม่สำเร็จ ${apiResult.failedSends} คน`);
        }
      } else {
        toast.error(apiResult.message || 'เกิดข้อผิดพลาดในการเรียกใช้ฟังก์ชัน batch');
      }

    } catch (error) {
      console.error('Unexpected error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }

    setSending(false);
  };

  // Template messages
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast.error('กรุณาระบุเรื่องที่ต้องการประกาศ');
      return;
    }

    setIsGeneratingAI(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `
          คุณเป็นผู้ช่วยดูแลหอพัก เขียนประกาศข้อความถึงผู้เช่า
          
          โจทย์: "${aiPrompt}"
          
          คำแนะนำ:
          - เขียนให้สุภาพ เป็นทางการแต่ดูเป็นกันเอง
          - ใส่ Emoji ประกอบให้น่าอ่าน
          - ระบุรายละเอียดให้ครบถ้วนตามที่โจทย์ให้มา
          - ถ้าโจทย์ไม่ได้ระบุวันที่/เวลา ให้เว้นว่างไว้ในวงเล็บ [...]
          - ไม่ต้องใส่หัวข้อ เช่น "ประกาศ:" เริ่มต้นเนื้อหาได้เลย
          - ภาษาไทย
        `,
        response_json_schema: {
          type: "object",
          properties: {
            content: { type: "string", description: "เนื้อหาประกาศ" }
          }
        }
      });

      if (result && result.content) {
        setMessage(result.content);
        setShowAIDialog(false);
        setAiPrompt('');
        toast.success('สร้างข้อความประกาศสำเร็จ');
      }
    } catch (error) {
      console.error('AI Generation Error:', error);
      toast.error('ไม่สามารถสร้างข้อความได้ กรุณาลองใหม่');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const templates = [
    {
      label: '⚡ ประกาศไฟดับ',
      message: '🔴 แจ้งเตือน: ไฟฟ้าจะดับชั่วคราว\n\nเนื่องจากมีการบำรุงรักษาระบบไฟฟ้า\n\nวันที่: [ระบุวันที่]\nเวลา: [ระบุเวลา]\nระยะเวลา: ประมาณ [ระบุระยะเวลา] ชั่วโมง\n\nขออภัยในความไม่สะดวก 🙏'
    },
    {
      label: '💧 ประกาศตัดน้ำ',
      message: '💧 แจ้งเตือน: ระงับการจ่ายน้ำประปาชั่วคราว\n\nเนื่องจากมีการซ่อมแซมระบบประปา\n\nวันที่: [ระบุวันที่]\nเวลา: [ระบุเวลา]\nระยะเวลา: ประมาณ [ระบุระยะเวลา] ชั่วโมง\n\nกรุณาเตรียมน้ำไว้ใช้ล่วงหน้า ขออภัยในความไม่สะดวก 🙏'
    },
    {
      label: '🔧 ประกาศซ่อมบำรุง',
      message: '🔧 แจ้งซ่อมบำรุง\n\nจะมีการซ่อมบำรุง [ระบุสิ่งที่ซ่อม]\n\nวันที่: [ระบุวันที่]\nเวลา: [ระบุเวลา]\n\nหากมีข้อสงสัย กรุณาติดต่อแอดมิน\n\nขอบคุณค่ะ 🙏'
    },
    {
      label: '📢 ประกาศทั่วไป',
      message: '📢 ประกาศ\n\n[พิมพ์ข้อความประกาศของคุณที่นี่]\n\nขอบคุณค่ะ 🙏'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <PageHeader
        title="ข้อความและประกาศ"
        subtitle={`สาขา ${selectedBranchName || 'ไม่ระบุสาขา'}`}
        icon={Megaphone}
        actions={
          activeTab === 'broadcast' ? (
            <Button
              onClick={handleSend}
              disabled={sending || !message.trim() || tenantsWithLine.length === 0 || !selectedBranchId}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              {sending ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5 mr-2" />
                  ส่งข้อความ ({targetType === 'all' ? tenantsWithLine.length : selectedTenants.size} คน)
                </>
              )}
            </Button>
          ) : null
        }
      />

      <div className="px-4 md:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 bg-white/80 backdrop-blur-sm p-1 rounded-xl shadow-sm">
            <TabsTrigger value="broadcast" className="gap-2 rounded-lg data-[state=active]:bg-blue-500 data-[state=active]:text-white">
              <Megaphone className="w-4 h-4" />
              ส่งประกาศ
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-2 rounded-lg data-[state=active]:bg-blue-500 data-[state=active]:text-white relative">
              <MessageCircle className="w-4 h-4" />
              แชท
              {conversations.reduce((acc, c) => acc + c.unread_count, 0) > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs h-5 w-5 p-0 flex items-center justify-center">
                  {conversations.reduce((acc, c) => acc + c.unread_count, 0)}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Chat Tab */}
          <TabsContent value="chat" className="mt-0">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl overflow-hidden">
              {/* Debug info */}
              {messagesError && (
                <div className="p-4 bg-red-50 text-red-700 text-sm">
                  Error: {messagesError.message}
                </div>
              )}
              
              <div className="flex h-[600px]">
                {/* Sidebar */}
                <div className="w-80 border-r flex-shrink-0">
                  <ChatSidebar
                      conversations={conversations}
                      selectedConversation={selectedConversation}
                      onSelectConversation={setSelectedConversation}
                      searchTerm={chatSearchTerm}
                      onSearchChange={setChatSearchTerm}
                      tenantsMap={tenantsMap}
                      onDeleteConversation={async (lineUserId) => {
                        try {
                          console.log('Deleting conversation for:', lineUserId);
                          // ลบข้อความทั้งหมดของ user นี้
                          const messagesToDelete = lineMessages.filter(m => m.line_user_id === lineUserId);
                          console.log('Messages to delete:', messagesToDelete.length);
                          
                          if (messagesToDelete.length > 0) {
                            await Promise.all(messagesToDelete.map(msg => base44.entities.LineMessage.delete(msg.id)));
                          }
                          
                          if (selectedConversation?.line_user_id === lineUserId) {
                            setSelectedConversation(null);
                          }
                          
                          queryClient.invalidateQueries(['lineMessages', selectedBranchId]);
                          toast.success('ลบแชทเรียบร้อย');
                        } catch (error) {
                          console.error('Delete error:', error);
                          toast.error('ลบแชทไม่สำเร็จ: ' + error.message);
                        }
                      }}
                    />
                </div>
                
                {/* Chat Window */}
                <ChatWindow
                  conversation={selectedConversation}
                  messages={selectedMessages}
                  tenant={selectedConversation ? (
                    // ⭐ หา tenant ที่มี line_user_id ตรงกับ conversation
                    tenants.find(t => t.line_user_id === selectedConversation.line_user_id) ||
                    tenantsMap[selectedConversation.tenant_id] ||
                    tenantsMap[selectedConversation.line_user_id]
                  ) : null}
                  tenants={tenants}
                  rooms={rooms}
                  bookings={bookings}
                  onSendMessage={handleSendChatMessage}
                  onRefresh={() => queryClient.invalidateQueries(['lineMessages', selectedBranchId])}
                  onLinkTenant={async (lineUserId, tenantId) => {
                    // ตอนนี้ส่ง tenantId มาตรงๆ แล้ว (ไม่ใช่ roomId)
                    const targetTenant = tenants.find(t => t.id === tenantId);
                    if (!targetTenant) {
                      toast.error('ไม่พบผู้เช่า');
                      return;
                    }

                    // อัพเดท tenant ด้วย line_user_id
                    await base44.entities.Tenant.update(targetTenant.id, {
                      line_user_id: lineUserId
                    });

                    toast.success(`เชื่อมต่อ LINE กับ ${targetTenant.full_name} สำเร็จ`);
                    await refetchTenants();
                    queryClient.invalidateQueries(['lineMessages', selectedBranchId]);
                  }}
                  onUnlinkTenant={async (tenantId) => {
                    try {
                      console.log('Unlinking tenant:', tenantId);
                      await base44.entities.Tenant.update(tenantId, {
                        line_user_id: null
                      });
                      
                      // ⭐ เคลียร์ selectedConversation ทันทีเพื่อบังคับ re-render
                      const currentLineUserId = selectedConversation?.line_user_id;
                      setSelectedConversation(null);
                      
                      // Refetch ทันทีเพื่อ update UI
                      await refetchTenants();
                      await queryClient.invalidateQueries(['lineMessages', selectedBranchId]);
                      await queryClient.refetchQueries(['tenants', selectedBranchId]);
                      
                      // ⭐ เลือก conversation กลับมาใหม่ (ถ้ายังมี) เพื่อให้ tenant เป็น null
                      if (currentLineUserId) {
                        // รอให้ data อัปเดตก่อน
                        setTimeout(() => {
                          const updatedConv = conversations.find(c => c.line_user_id === currentLineUserId);
                          if (updatedConv) {
                            setSelectedConversation({...updatedConv, tenant_id: null});
                          }
                        }, 500);
                      }
                      
                      toast.success('ยกเลิกการเชื่อมต่อ LINE สำเร็จ');
                    } catch (error) {
                      console.error('Unlink error:', error);
                      toast.error('ยกเลิกการเชื่อมต่อไม่สำเร็จ: ' + error.message);
                    }
                  }}
                  loading={messagesLoading}
                />
              </div>
            </Card>
          </TabsContent>

          {/* Broadcast Tab */}
          <TabsContent value="broadcast" className="mt-0">
            <div className="max-w-4xl mx-auto space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm mb-1">ผู้เช่าทั้งหมด (สาขานี้)</p>
                    <p className="text-3xl font-bold">{tenants.length}</p>
                  </div>
                  <Users className="w-12 h-12 text-blue-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm mb-1">ลงทะเบียน LINE</p>
                    <p className="text-3xl font-bold">{tenantsWithLine.length}</p>
                  </div>
                  <svg className="w-12 h-12 text-green-200" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.193 0-.378-.09-.503-.234l-1.89-2.181v1.787c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.27.173-.51.43-.595.063-.021.13-.03.196-.03.195 0 .38.089.503.234l1.89 2.181V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.001zm-5.741 0c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.003zm-2.466.63H4.917c-.345 0-.63-.285-.63-.63V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629z"/>
                  </svg>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-100 text-sm mb-1">ลงทะเบียน Facebook</p>
                    <p className="text-3xl font-bold">{tenantsWithFacebook.length}</p>
                  </div>
                  <Facebook className="w-12 h-12 text-blue-200" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-100 text-sm mb-1">ยังไม่ลงทะเบียน</p>
                    <p className="text-3xl font-bold">{tenants.length - tenantsWithMessaging.length}</p>
                  </div>
                  <XCircle className="w-12 h-12 text-orange-200" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Warning if no selected branch */}
          {!selectedBranchId && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800">กรุณาเลือกสาขาก่อน</p>
                  <p className="text-sm text-red-700 mt-1">
                    กรุณาเลือกสาขาจากเมนูด้านบนเพื่อส่งข้อความประกาศ
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Warning if no registered tenants for the selected branch */}
          {selectedBranchId && tenantsWithLine.length === 0 && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800">ยังไม่มีผู้เช่าที่ลงทะเบียน LINE ในสาขานี้</p>
                  <p className="text-sm text-red-700 mt-1">
                    กรุณาแจ้งให้ผู้เช่าแอด LINE Official Account และส่งข้อความมาก่อน เพื่อให้ระบบบันทึก User ID
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress Indicator */}
          {sending && (
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    <div>
                      <p className="font-semibold text-blue-900">กำลังส่งข้อความ...</p>
                      <p className="text-sm text-blue-700 mt-1">
                        กำลังดำเนินการส่งข้อความแบบกลุ่ม
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-blue-600 text-white">
                    {progress}%
                  </Badge>
                </div>
                <Progress value={progress} className="h-2" />
                <p className="text-xs text-blue-600 text-center">
                  กรุณารอสักครู่ อย่าปิดหน้าต่างนี้
                </p>
              </CardContent>
            </Card>
          )}

          {/* Templates */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg">📋 แม่แบบข้อความ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.map((template, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto py-6 flex items-center justify-center"
                    onClick={() => setMessage(template.message)}
                    disabled={sending}
                  >
                    <p className="font-semibold text-base">{template.label}</p>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selection & Message Form */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recipients Selection */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  ผู้รับข้อความ
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors bg-white">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'all'}
                      onChange={() => setTargetType('all')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800">ส่งหาทุกคน</span>
                      <p className="text-xs text-slate-500">
                        ผู้เช่าที่มี LINE ทั้งหมด ({tenantsWithLine.length} คน)
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors bg-white">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'individual'}
                      onChange={() => setTargetType('individual')}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div className="flex-1">
                      <span className="font-medium text-slate-800">เลือกรายบุคคล</span>
                      <p className="text-xs text-slate-500">
                        เลือกเฉพาะบางคนที่ต้องการ ({selectedTenants.size} คน)
                      </p>
                    </div>
                  </label>
                </div>

                {targetType === 'individual' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-3 pt-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="ค้นหาชื่อ หรือเลขห้อง..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9"
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs px-1">
                      <span className="text-slate-500">เลือกแล้ว {selectedTenants.size} คน</span>
                      <button 
                        onClick={handleToggleAll}
                        className="text-blue-600 hover:underline"
                      >
                        {selectedTenants.size === tenantsWithLine.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                      </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden max-h-[400px] overflow-y-auto bg-white">
                      {tenantsWithLine
                        .filter(t => 
                          t.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.room_number && t.room_number.toLowerCase().includes(searchTerm.toLowerCase()))
                        )
                        .map(tenant => (
                        <label 
                          key={tenant.id} 
                          className="flex items-center gap-3 p-3 hover:bg-slate-50 border-b last:border-0 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTenants.has(tenant.id)}
                            onChange={() => handleToggleTenant(tenant.id)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <p className="font-medium text-sm text-slate-800 truncate">{tenant.full_name}</p>
                              {tenant.room_number && (
                                <Badge variant="outline" className="text-xs bg-slate-50 text-slate-600 border-slate-200">
                                  ห้อง {tenant.room_number}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </label>
                      ))}
                      {tenantsWithLine.length === 0 && (
                        <div className="p-4 text-center text-slate-500 text-sm">
                          ไม่พบผู้เช่าที่มี LINE
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Message Form */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">✍️ พิมพ์ข้อความ</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAIDialog(true)}
                  className="bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border-purple-200 hover:from-purple-100 hover:to-pink-100"
                >
                  <Sparkles className="w-4 h-4 mr-2" />
                  AI ช่วยเขียน
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>ข้อความที่ต้องการส่ง *</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={12}
                    placeholder="พิมพ์ข้อความประกาศที่ต้องการส่ง..."
                    className="mt-2 font-sans"
                    disabled={sending || !selectedBranchId}
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    💡 สามารถใช้อีโมจิและขึ้นบรรทัดใหม่ได้ตามต้องการ
                  </p>
                </div>

                <div className="flex justify-between items-center pt-4 border-t">
                  <div className="text-sm text-slate-600">
                    จะส่งไปยัง: <span className="font-bold text-blue-600">
                      {targetType === 'all' ? tenantsWithLine.length : selectedTenants.size} คน
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Result */}
          {result && (
            <Card className={`${result.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'}`}>
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  {result.failed === 0 ? (
                    <CheckCircle className="w-6 h-6 text-green-600 mt-1" />
                  ) : (
                    <AlertTriangle className="w-6 h-6 text-orange-600 mt-1" />
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-2">ผลการส่งข้อความ</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                        <span className="text-green-800">ส่งสำเร็จ: <strong>{result.success}</strong> คน</span>
                      </div>
                      {result.failed > 0 && (
                        <>
                          <div className="flex items-center gap-2">
                            <XCircle className="w-5 h-5 text-red-600" />
                            <span className="text-red-800">ส่งไม่สำเร็จ: <strong>{result.failed}</strong> คน</span>
                          </div>
                          {result.errors.length > 0 && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-orange-300">
                              <p className="text-sm font-semibold text-slate-700 mb-2">รายละเอียดข้อผิดพลาด:</p>
                              <ul className="text-xs text-slate-600 space-y-1 max-h-32 overflow-y-auto">
                                {result.errors.map((error, index) => (
                                  <li key={index}>• {error.lineUserId ? `${error.lineUserId}: ${error.reason}` : error}</li> // Adjust based on actual error structure from backend
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <h4 className="font-semibold text-blue-900 mb-2">📌 หมายเหตุ</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• ระบบจะส่งข้อความไปยังผู้เช่าที่ลงทะเบียน LINE เท่านั้น</li>
                <li>• การส่งข้อความจะดำเนินการแบบกลุ่มและอาจใช้เวลาขึ้นอยู่กับจำนวนผู้รับ</li>
                <li>• ระบบจะลองส่งซ้ำอัตโนมัติ 3 ครั้งหากส่งไม่สำเร็จ</li>
                <li>• หากต้องการให้ผู้เช่าลงทะเบียน LINE ให้แจ้งให้แอด Official Account และส่งข้อความมาก่อน</li>
                <li>• ข้อความที่ส่งจะปรากฏในแชท LINE ของผู้เช่าทันที</li>
              </ul>
            </CardContent>
          </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* AI Dialog */}
      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              ให้ AI ช่วยร่างประกาศ
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
              <p className="text-sm text-purple-800">
                บอก AI ว่าคุณต้องการประกาศเรื่องอะไร เช่น <br/>
                "แจ้งซ่อมประปาวันพรุ่งนี้ 10 โมง ถึงเที่ยง", "แจ้งเตือนจ่ายค่าเช่า"
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>รายละเอียดประกาศ</Label>
              <Textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="ระบุเรื่องที่ต้องการประกาศ..."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIDialog(false)}>ยกเลิก</Button>
            <Button 
              onClick={handleAIGenerate}
              disabled={isGeneratingAI || !aiPrompt.trim()}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700"
            >
              {isGeneratingAI ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังสร้าง...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  สร้างข้อความ
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}