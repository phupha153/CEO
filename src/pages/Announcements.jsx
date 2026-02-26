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
  const [showChatWindow, setShowChatWindow] = useState(false); // Mobile state: ซ่อน/แสดง chat window

  // Get selected branch from localStorage
  const selectedBranchId = localStorage.getItem('selected_branch_id');
  const selectedBranchName = localStorage.getItem('selected_branch_name');

  // ⭐ โหลดข้อมูลผู้เช่า ห้อง และการจองทันทีเมื่อเปิดหน้า
  const { data: tenants = [], refetch: refetchTenants, isLoading: tenantsLoading } = useQuery({
    queryKey: ['tenants', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allTenants = await base44.entities.Tenant.filter({ branch_id: selectedBranchId });
      console.log('✅ Loaded tenants:', allTenants.length);
      return allTenants;
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!selectedBranchId,
  });

  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['rooms', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allRooms = await base44.entities.Room.filter({ branch_id: selectedBranchId });
      console.log('✅ Loaded rooms:', allRooms.length);
      return allRooms;
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!selectedBranchId,
  });

  const { data: bookings = [], isLoading: bookingsLoading } = useQuery({
    queryKey: ['bookings', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const allBookings = await base44.entities.Booking.filter({ branch_id: selectedBranchId });
      console.log('✅ Loaded bookings:', allBookings.length);
      return allBookings;
    },
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!selectedBranchId,
  });

  // สร้าง Map ของ tenant โดย line_user_id และ facebook_user_id พร้อม room_number
  const tenantsMap = React.useMemo(() => {
    const map = {};
    tenants.forEach(t => {
      // หา booking ที่ใช้งานของผู้เช่านี้
      const activeBooking = bookings.find(b => b.tenant_id === t.id && b.status === 'active');
      
      // หา room_number จาก booking
      let roomNumber = t.room_number; // fallback
      if (activeBooking) {
        const room = rooms.find(r => r.id === activeBooking.room_id);
        if (room?.room_number) {
          roomNumber = room.room_number;
        }
      }
      
      const tenantData = { ...t, room_number: roomNumber };
      
      if (t.line_user_id) map[t.line_user_id] = tenantData;
      if (t.facebook_user_id) map[t.facebook_user_id] = tenantData;
      if (t.id) map[t.id] = tenantData;
    });
    return map;
  }, [tenants, rooms, bookings]);

  // ดึงข้อความ LINE + Facebook เฉพาะสาขานี้
  const { data: lineMessages = [], isLoading: messagesLoading, error: messagesError } = useQuery({
    queryKey: ['lineMessages', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];

      let branchMessages = [];
      try {
          const res = await base44.entities.LineMessage.filter({ branch_id: selectedBranchId }, '-created_date', 500);
          branchMessages = Array.isArray(res) ? res : (res ? [res] : []);
      } catch (e) { console.error('Error fetching branch messages:', e); }
      
      let nullBranchMessages = [];
      try {
          // ดึงข้อความที่ไม่มีสาขา (orphan messages) มาโชว์ในทุกสาขา
          const resNull = await base44.entities.LineMessage.filter({ branch_id: null }, '-created_date', 100);
          nullBranchMessages = Array.isArray(resNull) ? resNull : (resNull ? [resNull] : []);
      } catch (e) { console.error('Error fetching null branch messages:', e); }
      
      const allMessages = [...branchMessages, ...nullBranchMessages];
      const uniqueMessages = Array.from(new Map(allMessages.map(m => [m.id, m])).values());
      return uniqueMessages.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 500);
    },
    staleTime: 30 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    enabled: !!selectedBranchId,
  });

  // ดึงข้อความ Facebook เฉพาะสาขานี้
  const { data: facebookMessages = [] } = useQuery({
    queryKey: ['facebookMessages', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      try {
        let isDefaultBranch = false;
        const configs = await base44.entities.Config.list('', 1000);
        const configList = Array.isArray(configs) ? configs : (configs ? [configs] : []);
        const defConfig = configList.find(c => c.key === 'default_communication_branch' && !c.branch_id);
        if (defConfig && defConfig.value === selectedBranchId) {
            isDefaultBranch = true;
        }

        let branchMessages = [];
        const res = await base44.entities.FacebookMessage?.filter({ branch_id: selectedBranchId }, '-created_date', 500);
        branchMessages = Array.isArray(res) ? res : (res ? [res] : []);
        
        let nullBranchMessages = [];
        if (isDefaultBranch) {
            const resNull = await base44.entities.FacebookMessage?.filter({ branch_id: null }, '-created_date', 100);
            nullBranchMessages = Array.isArray(resNull) ? resNull : (resNull ? [resNull] : []);
        }
        
        const allMessages = [...branchMessages, ...nullBranchMessages];
        const uniqueMessages = Array.from(new Map(allMessages.map(m => [m.id, m])).values());
        return uniqueMessages.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).slice(0, 500);
      } catch (e) {
        console.error('Error fetching Facebook messages:', e);
        return [];
      }
    },
    staleTime: 30 * 1000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    enabled: !!selectedBranchId,
  });

  const { data: announcementHistory = [] } = useQuery({
    queryKey: ['announcementHistory', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const history = await base44.entities.AnnouncementHistory.filter({ branch_id: selectedBranchId }, '-sent_date', 50);
      return history;
    },
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: !!selectedBranchId,
  });

  // สร้าง conversations จากข้อความ - รวมทั้ง LINE และ Facebook
  const conversations = React.useMemo(() => {
    const convMap = new Map();
    
    // ดึงข้อความ LINE
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
          unread_count: 0,
          platform: 'line'
        });
      }
      
      const conv = convMap.get(key);
      if (msg.line_display_name && !conv.line_display_name) {
        conv.line_display_name = msg.line_display_name;
      }
      if (msg.line_picture_url && !conv.line_picture_url) {
        conv.line_picture_url = msg.line_picture_url;
      }
      if (msg.tenant_id && !conv.tenant_id) {
        conv.tenant_id = msg.tenant_id;
      }
      if (new Date(msg.created_date) > new Date(conv.last_message_time)) {
        conv.last_message = msg.content;
        conv.last_message_time = msg.created_date;
        if (msg.line_display_name) conv.line_display_name = msg.line_display_name;
        if (msg.line_picture_url) conv.line_picture_url = msg.line_picture_url;
        if (msg.tenant_id) conv.tenant_id = msg.tenant_id;
      }
      if (msg.direction === 'incoming' && !msg.is_read) {
        conv.unread_count++;
      }
    });
    
    // ดึงข้อความ Facebook
    facebookMessages.forEach(msg => {
      const key = msg.facebook_user_id;
      if (!convMap.has(key)) {
        convMap.set(key, {
          facebook_user_id: msg.facebook_user_id,
          facebook_display_name: msg.facebook_display_name,
          facebook_picture_url: msg.facebook_picture_url,
          line_display_name: msg.facebook_display_name, // เพื่อใช้ในการแสดงผล
          line_picture_url: msg.facebook_picture_url,
          tenant_id: msg.tenant_id,
          last_message: msg.content,
          last_message_time: msg.created_date,
          unread_count: 0,
          platform: 'facebook'
        });
      }
      
      const conv = convMap.get(key);
      if (msg.facebook_display_name && !conv.facebook_display_name) {
        conv.facebook_display_name = msg.facebook_display_name;
        conv.line_display_name = msg.facebook_display_name;
      }
      if (msg.facebook_picture_url && !conv.facebook_picture_url) {
        conv.facebook_picture_url = msg.facebook_picture_url;
        conv.line_picture_url = msg.facebook_picture_url;
      }
      if (msg.tenant_id && !conv.tenant_id) {
        conv.tenant_id = msg.tenant_id;
      }
      if (new Date(msg.created_date) > new Date(conv.last_message_time)) {
        conv.last_message = msg.content;
        conv.last_message_time = msg.created_date;
        if (msg.facebook_display_name) {
          conv.facebook_display_name = msg.facebook_display_name;
          conv.line_display_name = msg.facebook_display_name;
        }
        if (msg.facebook_picture_url) {
          conv.facebook_picture_url = msg.facebook_picture_url;
          conv.line_picture_url = msg.facebook_picture_url;
        }
        if (msg.tenant_id) conv.tenant_id = msg.tenant_id;
      }
      if (msg.direction === 'incoming' && !msg.is_read) {
        conv.unread_count++;
      }
    });
    
    return Array.from(convMap.values()).sort((a, b) => 
      new Date(b.last_message_time) - new Date(a.last_message_time)
    );
  }, [lineMessages, facebookMessages]);

  // ข้อความของ conversation ที่เลือก - รวมทั้ง LINE และ Facebook
  const selectedMessages = React.useMemo(() => {
    if (!selectedConversation) return [];
    
    // ถ้าเป็น Facebook (เช็ค platform ก่อน หรือมี facebook_user_id แต่ไม่มี line_user_id)
    if (selectedConversation.platform === 'facebook' || 
        (selectedConversation.facebook_user_id && !selectedConversation.line_user_id)) {
      return facebookMessages
        .filter(m => m.facebook_user_id === selectedConversation.facebook_user_id)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    }
    
    // ถ้าเป็น LINE
    if (selectedConversation.line_user_id) {
      return lineMessages
        .filter(m => m.line_user_id === selectedConversation.line_user_id)
        .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    }
    
    return [];
  }, [lineMessages, facebookMessages, selectedConversation]);

  // ⭐ เมื่อเปิด conversation ให้ mark unread messages เป็น read (ทีละ batch เพื่อป้องกัน rate limit)
  React.useEffect(() => {
    if (!selectedConversation) return;
    
    const unreadMessages = selectedMessages.filter(m => 
      m.direction === 'incoming' && !m.is_read
    );
    
    if (unreadMessages.length > 0) {
      const entityName = selectedConversation.platform === 'facebook' ? 'FacebookMessage' : 'LineMessage';
      
      // ⚡ แบ่ง batch เพื่อป้องกัน rate limit (ครั้งละ 10 messages, หน่วง 500ms)
      const batchSize = 10;
      const batches = [];
      for (let i = 0; i < unreadMessages.length; i += batchSize) {
        batches.push(unreadMessages.slice(i, i + batchSize));
      }
      
      (async () => {
        for (const batch of batches) {
          await Promise.all(
            batch.map(msg => 
              base44.entities[entityName]?.update(msg.id, { is_read: true })
                .catch(err => console.warn('Failed to mark as read:', err))
            )
          );
          if (batches.indexOf(batch) < batches.length - 1) {
            await new Promise(r => setTimeout(r, 500)); // หน่วง 500ms ระหว่าง batch
          }
        }
        
        // Refresh messages หลังจาก mark เป็น read
        if (selectedConversation.platform === 'facebook') {
          queryClient.invalidateQueries(['facebookMessages', selectedBranchId]);
        } else {
          queryClient.invalidateQueries(['lineMessages', selectedBranchId]);
        }
      })();
    }
  }, [selectedConversation?.line_user_id, selectedConversation?.facebook_user_id, selectedMessages]);

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
  const handleSendChatMessage = async (content, mediaUrl = null) => {
    if (!selectedConversation || (!content.trim() && !mediaUrl)) return;

    try {
      const user = await base44.auth.me();
      
      // ⭐ เช็คว่าเป็น Facebook หรือ LINE
      if (selectedConversation.platform === 'facebook' || selectedConversation.facebook_user_id) {
        // ส่งผ่าน Facebook
        const response = await base44.functions.invoke('sendFacebookMessage', {
          recipientId: selectedConversation.facebook_user_id,
          message: content,
          branch_id: selectedBranchId
        });

        if (response.data?.error) {
          throw new Error(response.data.error);
        }

        // บันทึกข้อความขาออก
        await base44.entities.FacebookMessage.create({
          branch_id: selectedBranchId,
          tenant_id: selectedConversation.tenant_id,
          facebook_user_id: selectedConversation.facebook_user_id,
          facebook_display_name: selectedConversation.facebook_display_name,
          direction: 'outgoing',
          message_type: mediaUrl ? 'image' : 'text',
          content: content,
          media_url: mediaUrl,
          sent_by: user?.email
        });

        await new Promise(r => setTimeout(r, 500));
        queryClient.invalidateQueries(['facebookMessages', selectedBranchId]);
        } else {
        // ส่งผ่าน LINE
        const response = await base44.functions.invoke('sendLineMessage', {
          to: selectedConversation.line_user_id,
          message: content,
          branch_id: selectedBranchId
        });

        if (response.data?.error) {
          throw new Error(response.data.error + (response.data.details ? ': ' + JSON.stringify(response.data.details) : ''));
        }

        // บันทึกข้อความขาออก
        await base44.entities.LineMessage.create({
          branch_id: selectedBranchId,
          tenant_id: selectedConversation.tenant_id,
          line_user_id: selectedConversation.line_user_id,
          line_display_name: selectedConversation.line_display_name,
          direction: 'outgoing',
          message_type: mediaUrl ? 'image' : 'text',
          content: content,
          media_url: mediaUrl,
          sent_by: user?.email
        });

        await new Promise(r => setTimeout(r, 500));
        queryClient.invalidateQueries(['lineMessages', selectedBranchId]);
        }

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
    if (selectedTenants.size === tenantsWithMessaging.length) {
      setSelectedTenants(new Set());
    } else {
      setSelectedTenants(new Set(tenantsWithMessaging.map(t => t.id)));
    }
  };

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('กรุณาพิมพ์ข้อความก่อนส่ง');
      return;
    }

    const targets = targetType === 'all' 
      ? tenantsWithMessaging 
      : tenantsWithMessaging.filter(t => selectedTenants.has(t.id));

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
      // ✅ แยกส่งตาม platform (LINE / Facebook)
      const lineTargets = targets.filter(t => t.line_user_id);
      const facebookTargets = targets.filter(t => t.facebook_user_id);
      
      let totalSuccess = 0;
      let totalFailed = 0;
      let allErrors = [];

      // ส่งผ่าน LINE
      if (lineTargets.length > 0) {
        const lineRecipients = lineTargets.map(tenant => ({
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

        console.log(`📤 Sending to ${lineRecipients.length} LINE recipients...`);

        const lineResponse = await base44.functions.invoke('sendBatchLineMessages', {
          recipients: lineRecipients,
          options: {
            batchSize: 20,
            delayBetweenBatches: 2000,
            delayBetweenMessages: 100,
            retryAttempts: 3
          }
        });

        totalSuccess += lineResponse.data?.success || 0;
        totalFailed += lineResponse.data?.failed || 0;
        if (lineResponse.data?.errors) allErrors.push(...lineResponse.data.errors);
      }

      // ส่งผ่าน Facebook
      if (facebookTargets.length > 0) {
        console.log(`📤 Sending to ${facebookTargets.length} Facebook recipients...`);
        
        for (const tenant of facebookTargets) {
          try {
            setCurrentSending(`กำลังส่งถึง ${tenant.full_name}...`);
            
            const fbResponse = await base44.functions.invoke('sendFacebookMessage', {
              recipientId: tenant.facebook_user_id,
              message: message,
              branch_id: selectedBranchId
            });

            if (!fbResponse.data?.error) {
              totalSuccess++;
              
              // บันทึกข้อความขาออก
              const user = await base44.auth.me();
              await base44.entities.FacebookMessage.create({
                branch_id: selectedBranchId,
                tenant_id: tenant.id,
                facebook_user_id: tenant.facebook_user_id,
                facebook_display_name: tenant.full_name,
                direction: 'outgoing',
                message_type: 'text',
                content: message,
                sent_by: user?.email
              });
            } else {
              totalFailed++;
              allErrors.push({ recipient: tenant.full_name, reason: fbResponse.data.error });
            }
          } catch (error) {
            console.error(`Failed to send to ${tenant.full_name}:`, error);
            totalFailed++;
            allErrors.push({ recipient: tenant.full_name, reason: error.message });
          }
          
          await new Promise(r => setTimeout(r, 500));
        }
      }

      const apiResult = {
        successfulSends: totalSuccess,
        failedSends: totalFailed,
        errors: allErrors
      };

      console.log('📬 Batch Send Result:', apiResult);
      console.log('🔍 Result Details:', {
        successfulSends: apiResult.successfulSends,
        failedSends: apiResult.failedSends,
        hasApiResult: !!apiResult,
        apiResultType: typeof apiResult
      });

      setResult({
        success: apiResult.successfulSends || 0,
        failed: apiResult.failedSends || 0,
        errors: apiResult.errors || []
      });

      setProgress(100);
      setCurrentSending('');

      // บันทึกประวัติการส่ง
      try {
        const user = await base44.auth.me();
        await base44.entities.AnnouncementHistory.create({
          branch_id: selectedBranchId,
          message: message,
          target_type: targetType,
          recipient_count: targets.length,
          success_count: apiResult.successfulSends || 0,
          failed_count: apiResult.failedSends || 0,
          sent_by: user?.email,
          sent_date: new Date().toISOString(),
          platform: 'line'
        });
        queryClient.invalidateQueries(['announcementHistory', selectedBranchId]);
      } catch (historyError) {
        console.error('Failed to save announcement history:', historyError);
      }

      // ✅ แจ้งเตือนตามผลลัพธ์จริง
      const successCount = apiResult.successfulSends || 0;
      const failedCount = apiResult.failedSends || 0;
      
      console.log('📊 Final Toast Decision:', { successCount, failedCount });
      
      if (successCount > 0 && failedCount === 0) {
        toast.success(`✅ ส่งสำเร็จทั้งหมด ${successCount} คน`, {
          duration: 5000,
          icon: '🎉'
        });
        setMessage(''); // Clear message after successful send
      } else if (successCount === 0 && failedCount > 0) {
        toast.error(`❌ ส่งไม่สำเร็จทั้งหมด ${failedCount} คน`, {
          duration: 5000,
          description: 'กรุณาตรวจสอบการเชื่อมต่อหรือลองใหม่อีกครั้ง'
        });
      } else if (successCount > 0 && failedCount > 0) {
        toast.warning(`⚠️ ส่งสำเร็จบางส่วน: ${successCount} คน | ล้มเหลว: ${failedCount} คน`, {
          duration: 5000
        });
      } else if (successCount === 0 && failedCount === 0) {
        // ⚠️ กรณีที่ไม่มี success หรือ failed เลย
        toast.warning('ไม่มีผู้รับที่ส่งได้ กรุณาตรวจสอบว่าผู้เช่ามี LINE/Facebook หรือไม่');
      } else {
        toast.error('ไม่สามารถส่งข้อความได้ กรุณาลองใหม่');
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
          - เขียนสั้น กระชับ ได้ใจความ
          - ใช้ภาษาง่าย ไม่ซับซ้อน
          - ใส่ Emoji ประกอบ 1-2 ตัว (ไม่เยอะเกินไป)
          - ระบุรายละเอียดสำคัญตามที่โจทย์ให้มา
          - ถ้าโจทย์ไม่ได้ระบุวันที่/เวลา ให้เว้นว่างไว้ในวงเล็บ [...]
          - ไม่ต้องใส่หัวข้อ เช่น "ประกาศ:" เริ่มต้นเนื้อหาได้เลย
          - ไม่ต้องใส่คำขอบคุณ หรือคำลงท้าย ให้เนื้อหาหลักเท่านั้น
          - ยาวไม่เกิน 3-4 บรรทัด
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
      {activeTab === 'broadcast' && (
        <PageHeader
          title="ข้อความและประกาศ"
          subtitle={`สาขา ${selectedBranchName || 'ไม่ระบุสาขา'}`}
          icon={Megaphone}
        />
      )}

      <div className="h-full">
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
          <TabsContent value="chat" className="mt-0 h-[calc(100vh-140px)]">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl overflow-hidden h-full">
              {/* Debug info */}
              {messagesError && (
                <div className="p-4 bg-red-50 text-red-700 text-sm">
                  Error: {messagesError.message}
                </div>
              )}
              
              <div className="flex h-full relative">
                {/* Sidebar - แสดง/ซ่อนตาม state บน mobile */}
                <div className={`w-full md:w-80 md:border-r md:flex-shrink-0 ${showChatWindow ? 'hidden md:block' : 'block'}`}>
                  <ChatSidebar
                      conversations={conversations}
                      selectedConversation={selectedConversation}
                      onSelectConversation={(conv) => {
                        setSelectedConversation(conv);
                        setShowChatWindow(true); // เปิด chat window บน mobile
                      }}
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
                
                {/* Chat Window - แสดง/ซ่อนตาม state บน mobile */}
                <div className={`flex-1 ${showChatWindow ? 'block' : 'hidden md:block'}`}>
                  {tenantsLoading || roomsLoading || bookingsLoading ? (
                    <div className="flex items-center justify-center h-full bg-slate-50">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-slate-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-600">กำลังโหลดข้อมูล...</p>
                      </div>
                    </div>
                  ) : (
                    <ChatWindow
                      key={`${selectedConversation?.line_user_id}-${selectedConversation?.facebook_user_id}-${tenants.length}-${rooms.length}-${bookings.length}`}
                      conversation={selectedConversation}
                      messages={selectedMessages}
                      onBack={() => setShowChatWindow(false)} // ปุ่มย้อนกลับบน mobile
                      tenant={(() => {
                        if (!selectedConversation) return null;

                        // ⭐ หา tenant ที่มี line_user_id หรือ facebook_user_id ตรงกับ conversation **จริงๆ**
                        const foundTenant = tenants.find(t => {
                          // ต้อง match กับ platform ที่ใช้งานจริงๆ
                          if (selectedConversation.line_user_id) {
                            return t.line_user_id === selectedConversation.line_user_id;
                          }
                          if (selectedConversation.facebook_user_id) {
                            return t.facebook_user_id === selectedConversation.facebook_user_id;
                          }
                          return false;
                        });

                        console.log('🔍 Announcements: Finding tenant for conversation:', {
                          conversationLineId: selectedConversation.line_user_id,
                          conversationFacebookId: selectedConversation.facebook_user_id,
                          foundTenantId: foundTenant?.id,
                          foundTenantName: foundTenant?.full_name,
                          foundTenantLineId: foundTenant?.line_user_id,
                          foundTenantFacebookId: foundTenant?.facebook_user_id,
                          matched: !!foundTenant,
                          totalTenants: tenants.length
                        });

                        return foundTenant || null;
                      })()}
                    tenants={tenants}
                    rooms={rooms}
                    bookings={bookings}
                    onSendMessage={handleSendChatMessage}
                    onRefresh={async () => {
                      console.log('🔄 Announcements: Starting refresh...');

                      // ⭐ Refetch tenants และรอให้เสร็จ
                      await refetchTenants();

                      // ⭐ Force invalidate และรอให้ reload จริงๆ
                      await queryClient.invalidateQueries(['tenants', selectedBranchId]);

                      // ⭐ รอให้ cache อัปเดต
                      await new Promise(r => setTimeout(r, 300));

                      console.log('✅ Announcements: Tenants refetched, count:', tenants.length);

                      // ⭐ บังคับให้ re-select conversation เพื่อ lookup tenant ใหม่
                      if (selectedConversation) {
                        const conversationKey = selectedConversation.line_user_id || selectedConversation.facebook_user_id;
                        const updatedConv = conversations.find(c => 
                          c.line_user_id === conversationKey || c.facebook_user_id === conversationKey
                        );

                        if (updatedConv) {
                          console.log('🔄 Re-selecting conversation to update tenant reference');
                          setSelectedConversation({...updatedConv});
                        }
                      }
                    }}
                    onLinkTenant={async (lineUserId, tenantId) => {
                    // ตอนนี้ส่ง tenantId มาตรงๆ แล้ว (ไม่ใช่ roomId)
                    const targetTenant = tenants.find(t => t.id === tenantId);
                    if (!targetTenant) {
                      toast.error('ไม่พบผู้เช่า');
                      return;
                    }

                    const isFacebook = selectedConversation.platform === 'facebook' || selectedConversation.facebook_user_id;

                    if (isFacebook) {
                        await base44.entities.Tenant.update(targetTenant.id, {
                          facebook_user_id: lineUserId
                        });
                        
                        const oldMsgs = facebookMessages.filter(m => m.facebook_user_id === lineUserId);
                        for (const msg of oldMsgs) {
                            if (msg.tenant_id !== targetTenant.id || msg.branch_id !== targetTenant.branch_id) {
                                await base44.entities.FacebookMessage.update(msg.id, {
                                    tenant_id: targetTenant.id,
                                    branch_id: targetTenant.branch_id
                                }).catch(()=>{});
                            }
                        }
                    } else {
                        await base44.entities.Tenant.update(targetTenant.id, {
                          line_user_id: lineUserId
                        });
                        
                        const oldMsgs = lineMessages.filter(m => m.line_user_id === lineUserId);
                        for (const msg of oldMsgs) {
                            if (msg.tenant_id !== targetTenant.id || msg.branch_id !== targetTenant.branch_id) {
                                await base44.entities.LineMessage.update(msg.id, {
                                    tenant_id: targetTenant.id,
                                    branch_id: targetTenant.branch_id
                                }).catch(()=>{});
                            }
                        }
                    }

                    toast.success(`เชื่อมต่อบัญชีกับ ${targetTenant.full_name} สำเร็จ`);
                    await refetchTenants();
                    if (isFacebook) queryClient.invalidateQueries(['facebookMessages', selectedBranchId]);
                    else queryClient.invalidateQueries(['lineMessages', selectedBranchId]);
                  }}
                  onUnlinkTenant={async (tenantId) => {
                    try {
                      console.log('Unlinking tenant:', tenantId);
                      await base44.entities.Tenant.update(tenantId, {
                        line_user_id: null,
                        facebook_user_id: null
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
                    )}
                    </div>
                    </div>
                    </Card>
                    </TabsContent>

          {/* Broadcast Tab */}
          <TabsContent value="broadcast" className="mt-0">
            <div className="max-w-4xl mx-auto space-y-6">
          {/* Stats - ปรับให้กระชับสำหรับมือถือ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col items-center md:flex-row md:items-center md:justify-between">
                  <div className="text-center md:text-left">
                    <p className="text-blue-100 text-xs mb-0.5">ทั้งหมด</p>
                    <p className="text-2xl md:text-3xl font-bold">{tenants.length}</p>
                  </div>
                  <Users className="w-6 h-6 md:w-10 md:h-10 text-blue-200 mt-1 md:mt-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col items-center md:flex-row md:items-center md:justify-between">
                  <div className="text-center md:text-left">
                    <p className="text-green-100 text-xs mb-0.5">LINE</p>
                    <p className="text-2xl md:text-3xl font-bold">{tenantsWithLine.length}</p>
                  </div>
                  <svg className="w-6 h-6 md:w-10 md:h-10 text-green-200 mt-1 md:mt-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.193 0-.378-.09-.503-.234l-1.89-2.181v1.787c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.27.173-.51.43-.595.063-.021.13-.03.196-.03.195 0 .38.089.503.234l1.89 2.181V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.001zm-5.741 0c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.003zm-2.466.63H4.917c-.345 0-.63-.285-.63-.63V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629z"/>
                  </svg>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col items-center md:flex-row md:items-center md:justify-between">
                  <div className="text-center md:text-left">
                    <p className="text-blue-100 text-xs mb-0.5">Facebook</p>
                    <p className="text-2xl md:text-3xl font-bold">{tenantsWithFacebook.length}</p>
                  </div>
                  <Facebook className="w-6 h-6 md:w-10 md:h-10 text-blue-200 mt-1 md:mt-0" />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-500 to-red-600 text-white shadow-lg">
              <CardContent className="p-3 md:p-4">
                <div className="flex flex-col items-center md:flex-row md:items-center md:justify-between">
                  <div className="text-center md:text-left">
                    <p className="text-orange-100 text-xs mb-0.5">ยังไม่ลงทะเบียน</p>
                    <p className="text-2xl md:text-3xl font-bold">{tenants.length - tenantsWithMessaging.length}</p>
                  </div>
                  <XCircle className="w-6 h-6 md:w-10 md:h-10 text-orange-200 mt-1 md:mt-0" />
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
          {selectedBranchId && tenantsWithMessaging.length === 0 && (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-red-800">ยังไม่มีผู้เช่าที่เชื่อมต่อระบบแชทในสาขานี้</p>
                  <p className="text-sm text-red-700 mt-1">
                    กรุณาแจ้งให้ผู้เช่าเชื่อมต่อ LINE หรือ Facebook Messenger เพื่อรับข้อความประกาศ
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

          {/* Templates - กระชับสำหรับมือถือ */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardHeader className="p-3 md:p-6">
              <CardTitle className="text-base md:text-lg">📋 แม่แบบข้อความ</CardTitle>
            </CardHeader>
            <CardContent className="p-3 md:p-6 pt-0">
              <div className="grid grid-cols-2 gap-2">
                {templates.map((template, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto py-3 px-2 md:py-4 md:px-4 flex items-center justify-center text-xs md:text-sm"
                    onClick={() => setMessage(template.message)}
                    disabled={sending}
                  >
                    <p className="font-medium text-center leading-tight">{template.label}</p>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Selection & Message Form - แยกคอลัมน์ mobile */}
          <div className="space-y-3 md:space-y-4">
            {/* Recipients Selection */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader className="p-3 md:p-6">
                <CardTitle className="text-base md:text-lg flex items-center gap-2">
                  <Users className="w-4 h-4 md:w-5 md:h-5 text-blue-600" />
                  ผู้รับข้อความ
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0 space-y-3">
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 p-2 md:p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors bg-white">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'all'}
                      onChange={() => setTargetType('all')}
                      className="w-4 h-4 text-blue-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-slate-800">ส่งหาทุกคน</span>
                      <p className="text-xs text-slate-500">
                        ({tenantsWithMessaging.length} คน • {tenantsWithLine.length} LINE, {tenantsWithFacebook.length} FB)
                      </p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 md:p-3 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors bg-white">
                    <input
                      type="radio"
                      name="targetType"
                      checked={targetType === 'individual'}
                      onChange={() => setTargetType('individual')}
                      className="w-4 h-4 text-blue-600 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm text-slate-800">เลือกรายบุคคล</span>
                      <p className="text-xs text-slate-500">
                        ({selectedTenants.size} คน)
                      </p>
                    </div>
                  </label>
                </div>

                {targetType === 'individual' && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-2 pt-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="ค้นหา..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8 h-9 text-sm"
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs px-1">
                      <span className="text-slate-500">เลือก {selectedTenants.size} คน</span>
                      <button 
                        onClick={handleToggleAll}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {selectedTenants.size === tenantsWithMessaging.length ? 'ยกเลิก' : 'ทั้งหมด'}
                      </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto bg-white">
                      {tenantsWithMessaging
                        .filter(t => {
                          const searchLower = searchTerm.toLowerCase();
                          const displayName = `${t.full_name}${t.room_number ? ` - ${t.room_number}` : ''}`.toLowerCase();
                          return displayName.includes(searchLower);
                        })
                        .map(tenant => (
                        <label 
                          key={tenant.id} 
                          className="flex items-center gap-2 p-2 hover:bg-slate-50 border-b last:border-0 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={selectedTenants.has(tenant.id)}
                            onChange={() => handleToggleTenant(tenant.id)}
                            className="w-4 h-4 text-blue-600 rounded border-slate-300 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-xs md:text-sm text-slate-800 truncate">
                              {tenant.full_name}
                              {tenant.line_user_id && tenant.facebook_user_id && (
                                <Badge className="ml-1 bg-blue-500 text-white text-[10px] px-1 py-0">L+F</Badge>
                              )}
                              {tenant.line_user_id && !tenant.facebook_user_id && (
                                <Badge className="ml-1 bg-green-500 text-white text-[10px] px-1 py-0">L</Badge>
                              )}
                              {!tenant.line_user_id && tenant.facebook_user_id && (
                                <Badge className="ml-1 bg-blue-600 text-white text-[10px] px-1 py-0">F</Badge>
                              )}
                            </p>
                            {tenant.room_number && (
                              <p className="text-xs text-slate-500 truncate">
                                {tenant.room_number}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                      {tenantsWithMessaging.length === 0 && (
                        <div className="p-3 text-center text-slate-500 text-xs">
                          ไม่พบผู้เช่าที่เชื่อมต่อระบบแชท
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Message Form */}
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader className="p-3 md:p-6 flex flex-row items-center justify-between">
                <CardTitle className="text-base md:text-lg">✍️ พิมพ์ข้อความ</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAIDialog(true)}
                    className="bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 border-purple-200 hover:from-purple-100 hover:to-pink-100 text-xs h-8"
                  >
                    <Sparkles className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                    <span className="hidden md:inline">AI ช่วยเขียน</span>
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={sending || !message.trim() || tenantsWithMessaging.length === 0 || !selectedBranchId}
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg text-xs h-8"
                    size="sm"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        กำลังส่ง...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-1" />
                        ส่ง ({targetType === 'all' ? tenantsWithMessaging.length : selectedTenants.size})
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0 space-y-3">
                <div>
                  <Label className="text-xs md:text-sm">ข้อความที่ต้องการส่ง *</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={8}
                    placeholder="พิมพ์ข้อความประกาศที่ต้องการส่ง..."
                    className="mt-1 font-sans text-sm"
                    disabled={sending || !selectedBranchId}
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    💡 ใช้อีโมจิและขึ้นบรรทัดใหม่ได้
                  </p>
                </div>

                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="text-xs md:text-sm text-slate-600">
                    ส่งไปยัง: <span className="font-bold text-blue-600">
                      {targetType === 'all' ? tenantsWithMessaging.length : selectedTenants.size} คน
                    </span> ({targetType === 'all' ? `${tenantsWithLine.length} LINE, ${tenantsWithFacebook.length} FB` : ''})
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>



          {/* Info Card - กระชับสำหรับมือถือ */}
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3 md:p-4">
              <h4 className="font-semibold text-blue-900 mb-1.5 text-sm md:text-base">📌 หมายเหตุ</h4>
              <ul className="text-xs md:text-sm text-blue-800 space-y-0.5 md:space-y-1">
                <li>• ส่งเฉพาะผู้เช่าที่ลงทะเบียน LINE</li>
                <li>• ใช้เวลาตามจำนวนผู้รับ</li>
                <li>• ลองส่งซ้ำอัตโนมัติ 3 ครั้ง</li>
                <li className="hidden md:list-item">• หากต้องการให้ผู้เช่าลงทะเบียน LINE ให้แจ้งให้แอด Official Account และส่งข้อความมาก่อน</li>
                <li className="hidden md:list-item">• ข้อความที่ส่งจะปรากฏในแชท LINE ของผู้เช่าทันที</li>
              </ul>
            </CardContent>
          </Card>

          {/* ประวัติการส่งประกาศ - กระชับสำหรับมือถือ */}
          {announcementHistory.length > 0 && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardHeader className="p-3 md:p-6">
                <CardTitle className="text-base md:text-lg">📜 ประวัติการส่ง</CardTitle>
              </CardHeader>
              <CardContent className="p-3 md:p-6 pt-0">
                <div className="space-y-2">
                  {announcementHistory.map((history) => (
                    <div 
                      key={history.id}
                      className="p-2 md:p-3 rounded-lg border bg-white hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-1.5 gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs md:text-sm font-medium text-slate-800 line-clamp-2">
                            {history.message}
                          </p>
                        </div>
                        <Badge 
                          variant={history.failed_count === 0 ? 'default' : 'secondary'}
                          className={`${history.failed_count === 0 ? 'bg-green-500' : 'bg-orange-500'} text-xs flex-shrink-0`}
                        >
                          {history.success_count}/{history.recipient_count}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center justify-between text-xs text-slate-500 gap-2">
                        <span className="truncate">📅 {new Date(history.sent_date).toLocaleDateString('th-TH', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {history.target_type === 'all' ? 'ทุกคน' : 'เลือก'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
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
              <p className="text-sm text-purple-800 mb-2">
                💡 บอก AI ว่าคุณต้องการประกาศเรื่องอะไร
              </p>
              <p className="text-xs text-purple-700">
                ตัวอย่าง: "แจ้งซ่อมประปาวันพรุ่งนี้ 10-12 น.", "เตือนจ่ายค่าเช่า", "ไฟดับเย็นนี้ 18-20 น."
              </p>
              <p className="text-xs text-purple-600 mt-2 font-medium">
                ✨ AI จะเขียนให้สั้น กระชับ ได้ใจความ
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