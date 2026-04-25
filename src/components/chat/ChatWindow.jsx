import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Send, User, Phone, Home, Loader2, 
  CheckCircle, Info, Sparkles, X, Link, Save, Facebook, ArrowLeft, UserPlus, Image as ImageIcon
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import AddTenantDialog from "./AddTenantDialog";

function ImageWithLoader({ url }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <a 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="block relative mb-2"
    >
      {loading && (
        <div className="bg-slate-100 rounded-lg w-40 h-32 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-slate-400 animate-spin" />
        </div>
      )}
      {error && (
        <div className="bg-slate-100 rounded-lg w-40 h-32 flex flex-col items-center justify-center">
          <ImageIcon className="w-6 h-6 text-slate-400 mb-1" />
          <p className="text-xs text-slate-500">โหลดไม่สำเร็จ</p>
        </div>
      )}
      <img 
        src={url} 
        alt="รูปภาพ" 
        loading="lazy"
        className={`max-w-xs max-h-64 rounded-lg cursor-pointer hover:opacity-90 transition-opacity object-cover ${
          loading ? 'hidden' : 'block'
        }`}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
      />
    </a>
  );
}

export default function ChatWindow({ 
  conversation, 
  messages, 
  tenant,
  tenants = [],
  rooms = [],
  bookings = [],
  onSendMessage,
  onRefresh,
  onLinkTenant,
  onUnlinkTenant,
  onBack,
  loading
}) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showProfile, setShowProfile] = useState(() => window.innerWidth >= 1024);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [linking, setLinking] = useState(false);
  const [showAddTenantDialog, setShowAddTenantDialog] = useState(false);
  const [analyzingChat, setAnalyzingChat] = useState(false);
  const [aiExtractedData, setAiExtractedData] = useState(null);
  const [submittingTenant, setSubmittingTenant] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [readReceipts, setReadReceipts] = useState({});
  const messagesEndRef = useRef(null);
  const refreshIntervalRef = useRef(null);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    staleTime: Infinity,
  });

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'developer' : 'employee');

  // ⭐ ปิด Auto-refresh เพื่อป้องกัน Rate Limit (รอให้ user refresh ด้วยตัวเอง)
  // useEffect(() => {
  //   if (!conversation || !onRefresh || showAddTenantDialog || sending) return;

  //   refreshIntervalRef.current = setInterval(async () => {
  //     try {
  //       await onRefresh();
  //     } catch (error) {
  //       console.warn('Auto-refresh failed:', error);
  //     }
  //   }, 30000); // 30 วินาที

  //   return () => {
  //     if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
  //   };
  // }, [conversation, onRefresh, showAddTenantDialog, sending]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await onSendMessage(newMessage.trim());
      setNewMessage('');
      
      // Mark as read automatically
      setReadReceipts(prev => ({
        ...prev,
        [conversation?.id]: new Date().toISOString()
      }));
    } catch (error) {
      toast.error('ส่งข้อความไม่สำเร็จ: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  const compressImage = async (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let { width, height } = img;
          
          // Resize if larger than 1200px
          if (width > 1200 || height > 1200) {
            const ratio = Math.min(1200 / width, 1200 / height);
            width *= ratio;
            height *= ratio;
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to WebP with quality 0.7
          canvas.toBlob(resolve, 'image/webp', 0.7);
        };
      };
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSending(true);
    try {
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], `image_${Date.now()}.webp`, { type: 'image/webp' });
      
      const uploadedUrl = await base44.integrations.Core.UploadFile({ file: compressedFile });
      
      await onSendMessage(`[รูปภาพ]`, uploadedUrl.file_url);
      toast.success(`อัพโหลดสำเร็จ (${(compressedFile.size / 1024).toFixed(1)} KB)`);
    } catch (error) {
      toast.error('อัพโหลดรูปไม่สำเร็จ: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  // Debug: Log tenant and conversation state — MUST be before early return
  useEffect(() => {
    if (conversation) {
      console.log('🔍 ChatWindow State:', {
        conversationLineId: conversation.line_user_id,
        conversationFacebookId: conversation.facebook_user_id,
        conversationTenantId: conversation.tenant_id,
        tenantId: tenant?.id,
        tenantName: tenant?.full_name,
        tenantLineId: tenant?.line_user_id,
        tenantFacebookId: tenant?.facebook_user_id,
        hasTenant: !!tenant
      });
    }
  }, [conversation, tenant]);

  if (!conversation) {
    return (
      <div className="flex-1 flex h-full w-full items-center justify-center bg-slate-50">
        <div className="text-center text-slate-400">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Send className="w-8 h-8" />
          </div>
          <p className="font-medium">เลือกแชทเพื่อเริ่มสนทนา</p>
        </div>
      </div>
    );
  }

  const displayName = tenant?.full_name || conversation.line_display_name || 'ไม่ทราบชื่อ';

  const handleAnalyzeChat = async () => {
    if (analyzingChat) return;
    
    // เปิด Dialog ทันที
    setShowAddTenantDialog(true);
    setShowProfile(false);
    setAnalyzingChat(true);
    setAiExtractedData(null); // Reset ข้อมูลเก่า
    
    try {
      const response = await base44.functions.invoke('analyzeChatForTenant', {
        messages: messages
      });
      
      if (response.data.success) {
        setAiExtractedData(response.data.data);
      } else {
        toast.error('วิเคราะห์ข้อมูลไม่สำเร็จ');
        setShowAddTenantDialog(false);
      }
    } catch (error) {
      console.error('Analyze error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
      setShowAddTenantDialog(false);
    } finally {
      setAnalyzingChat(false);
    }
  };

  const handleSubmitTenant = async ({ tenantData, bookings, vehicles }) => {
    setSubmittingTenant(true);
    try {
      const branchId = localStorage.getItem('selected_branch_id');
      
      // สร้างหรืออัปเดตผู้เช่า
      let tenantId = tenant?.id;
      
      if (tenant) {
        // อัปเดตผู้เช่าที่มีอยู่
        await base44.entities.Tenant.update(tenant.id, {
          ...tenantData,
          branch_id: branchId,
          vehicles: vehicles || []
        });
        toast.success('อัปเดตข้อมูลผู้เช่าสำเร็จ');
      } else {
        // สร้างผู้เช่าใหม่
        const newTenant = await base44.entities.Tenant.create({
          ...tenantData,
          branch_id: branchId,
          status: 'active',
          vehicles: vehicles || []
        });
        tenantId = newTenant.id;
        toast.success('เพิ่มผู้เช่าใหม่สำเร็จ');
      }

      // เชื่อมต่อ LINE/Facebook
      const platformId = conversation.facebook_user_id 
        ? { facebook_user_id: conversation.facebook_user_id }
        : { line_user_id: conversation.line_user_id };
      
      await base44.entities.Tenant.update(tenantId, platformId);

      // 🔄 Migrate Chat History (ดึงประวัติแชทย้อนหลังมาที่สาขานี้)
      try {
        if (conversation.facebook_user_id) {
          const pastMessages = await base44.entities.FacebookMessage.filter({ facebook_user_id: conversation.facebook_user_id }, '', 1000);
          const msgs = Array.isArray(pastMessages) ? pastMessages : (pastMessages ? [pastMessages] : []);
          for (const msg of msgs) {
            if (msg.branch_id !== branchId || msg.tenant_id !== tenantId) {
              await base44.entities.FacebookMessage.update(msg.id, { branch_id: branchId, tenant_id: tenantId });
            }
          }
        } else if (conversation.line_user_id) {
          const pastMessages = await base44.entities.LineMessage.filter({ line_user_id: conversation.line_user_id }, '', 1000);
          const msgs = Array.isArray(pastMessages) ? pastMessages : (pastMessages ? [pastMessages] : []);
          for (const msg of msgs) {
            if (msg.branch_id !== branchId || msg.tenant_id !== tenantId) {
              await base44.entities.LineMessage.update(msg.id, { branch_id: branchId, tenant_id: tenantId });
            }
          }
        }
      } catch (e) {
        console.error('Failed to migrate history:', e);
      }
      
      // ⭐ สร้าง Booking หลายห้อง (รองรับ array)
      if (bookings && bookings.length > 0) {
        for (const bookingData of bookings) {
          const selectedRoom = rooms.find(r => r.room_number === bookingData.room_number);
          
          if (selectedRoom) {
            await base44.entities.Booking.create({
              branch_id: branchId,
              room_id: selectedRoom.id,
              tenant_id: tenantId,
              check_in_date: bookingData.check_in_date || new Date().toISOString().split('T')[0],
              booking_type: selectedRoom.room_type || 'monthly',
              status: 'active',
              deposit_amount: parseFloat(bookingData.deposit_amount) || 0,
            });

            // อัปเดตสถานะห้องเป็น occupied
            await base44.entities.Room.update(selectedRoom.id, {
              status: 'occupied'
            });
          }
        }
        
        toast.success(`สร้างสัญญาเช่าสำเร็จ ${bookings.length} ห้อง`);
      }

      setShowAddTenantDialog(false);
      setAiExtractedData(null);
      
      // Refresh data
      if (onRefresh) await onRefresh();
      
    } catch (error) {
      console.error('Submit error:', error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
      setSubmittingTenant(false);
    }
  };

  return (
    <div className="flex-1 flex h-full relative overflow-hidden w-full">
      <div className="flex-1 flex flex-col bg-slate-50 h-full min-w-0 relative">
        {/* Header */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between z-10 relative flex-shrink-0">
        <div className="flex items-center gap-3">
          {/* ปุ่มย้อนกลับ - แสดงเฉพาะบน mobile */}
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onBack}
              className="md:hidden hover:bg-slate-100 -ml-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="relative">
            {conversation.line_picture_url || conversation.facebook_picture_url ? (
              <img 
                src={conversation.line_picture_url || conversation.facebook_picture_url} 
                alt="" 
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                conversation.facebook_user_id 
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                  : 'bg-gradient-to-br from-green-400 to-emerald-500'
              }`}>
                {conversation.facebook_user_id ? (
                  <Facebook className="w-5 h-5 text-white" />
                ) : (
                  <User className="w-5 h-5 text-white" />
                )}
              </div>
            )}
            {/* Platform Badge */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-white ${
              conversation.facebook_user_id ? 'bg-blue-500' : 'bg-green-500'
            }`}>
              {conversation.facebook_user_id ? (
                <Facebook className="w-3 h-3 text-white" />
              ) : (
                <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.193 0-.378-.09-.503-.234l-1.89-2.181v1.787c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.27.173-.51.43-.595.063-.021.13-.03.196-.03.195 0 .38.089.503.234l1.89 2.181V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.001zm-5.741 0c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.003zm-2.466.63H4.917c-.345 0-.63-.285-.63-.63V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629z"/>
                </svg>
              )}
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-slate-800">{displayName}</p>
              {/* Platform Label */}
              <Badge className={`text-xs px-1.5 py-0.5 ${
                conversation.facebook_user_id 
                  ? 'bg-blue-100 text-blue-700' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {conversation.facebook_user_id ? 'Facebook' : 'LINE'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              {tenant ? (
                <>
                  <Badge className="bg-green-100 text-green-700 text-xs">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    ผู้เช่าในระบบ
                  </Badge>
                  {tenant.room_number && (
                    <Badge variant="outline" className="text-xs">
                      <Home className="w-3 h-3 mr-1" />
                      ห้อง {tenant.room_number}
                    </Badge>
                  )}
                </>
              ) : (
                <Badge className="bg-orange-100 text-orange-700 text-xs">
                  ยังไม่ได้ลงทะเบียน
                </Badge>
              )}
            </div>
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            console.log('🔍 Toggle Profile:', !showProfile, 'Tenant:', tenant?.full_name, 'Facebook ID:', conversation.facebook_user_id);
            setShowProfile(!showProfile);
          }}
          className="hover:bg-slate-100"
        >
          <Info className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 relative z-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    <div className={`rounded-2xl h-8 ${i % 2 === 0 ? 'bg-blue-200 w-48' : 'bg-slate-200 w-56'}`} />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              <p>ยังไม่มีข้อความ</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOutgoing = msg.direction === 'outgoing';

              return (
                <div
                  key={msg.id || idx}
                  className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`rounded-2xl px-3 py-2 break-words ${
                      isOutgoing
                        ? 'bg-blue-500 text-white rounded-br-sm'
                        : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}
                    style={{ maxWidth: '85%' }}
                  >
                    {msg.message_type === 'image' && msg.media_url && (
                      <ImageWithLoader url={msg.media_url} />
                    )}
                    {msg.content && msg.content !== '[รูปภาพ]' && (
                      <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    )}
                    <div className={`flex items-center gap-1.5 mt-1 ${
                      isOutgoing ? 'text-blue-100' : 'text-slate-400'
                    }`}>
                      {!isOutgoing && (
                        msg.platform === 'facebook' || conversation.facebook_user_id ? (
                          <Facebook className="w-3 h-3" />
                        ) : (
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.193 0-.378-.09-.503-.234l-1.89-2.181v1.787c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.27.173-.51.43-.595.063-.021.13-.03.196-.03.195 0 .38.089.503.234l1.89 2.181V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.001zm-5.741 0c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.003zm-2.466.63H4.917c-.345 0-.63-.285-.63-.63V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629z"/>
                          </svg>
                        )
                      )}
                      <span className="text-xs">
                        {msg.created_date && format(new Date(msg.created_date), 'HH:mm')}
                      </span>
                      {isOutgoing && (
                        <>
                          <span className="text-xs">•</span>
                          {readReceipts[conversation?.id] ? '✓✓' : '✓'}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {typingUsers.size > 0 && (
            <div className="flex justify-start">
              <div className="bg-slate-100 text-slate-600 rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                กำลังพิมพ์... <span className="animate-pulse">●●●</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="bg-white border-t p-3">
          <div className="flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="พิมพ์ข้อความ..."
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={sending}
            />
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={sending}
                className="hidden"
              />
              <Button
                asChild
                variant="outline"
                size="icon"
                disabled={sending}
                className="hover:bg-slate-100"
              >
                <span><ImageIcon className="w-4 h-4" /></span>
              </Button>
            </label>
            <Button
              onClick={handleSend}
              disabled={!newMessage.trim() || sending}
              className="bg-blue-500 hover:bg-blue-600"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

      </div>

      {/* Profile Panel */}
      {showProfile && (
        <>
          {/* Backdrop - Only visible on mobile */}
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-[99] animate-in fade-in duration-200"
            onClick={() => {
              console.log('❌ Close profile panel (backdrop click)');
              setShowProfile(false);
            }}
          />

          {/* Profile Panel - Fixed on mobile, Static on desktop */}
          <div 
            className="fixed lg:static inset-y-0 right-0 w-80 bg-white shadow-2xl lg:shadow-none lg:border-l z-[100] lg:z-0 overflow-y-auto flex-shrink-0 animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '320px' }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-800">ข้อมูลผู้ติดต่อ</h3>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => {
                    console.log('❌ Close profile panel (X button)');
                    setShowProfile(false);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>

              <div className="text-center mb-4 pb-4 border-b">
                {conversation.line_picture_url || conversation.facebook_picture_url ? (
                  <img 
                    src={conversation.line_picture_url || conversation.facebook_picture_url} 
                    alt="" 
                    className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-slate-100"
                  />
                ) : (
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto border-4 border-white shadow-lg ${
                    conversation.facebook_user_id 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600'
                      : 'bg-gradient-to-br from-green-400 to-emerald-500'
                  }`}>
                    {conversation.facebook_user_id ? (
                      <Facebook className="w-12 h-12 text-white" />
                    ) : (
                      <User className="w-12 h-12 text-white" />
                    )}
                  </div>
                )}
                <p className="font-bold text-lg mt-3">{displayName}</p>
                
                {/* Platform Badge */}
                <Badge className={`mt-2 ${
                  conversation.facebook_user_id 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'bg-green-100 text-green-700'
                }`}>
                  {conversation.facebook_user_id ? (
                    <>
                      <Facebook className="w-3 h-3 mr-1" />
                      Facebook
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3 mr-1" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.193 0-.378-.09-.503-.234l-1.89-2.181v1.787c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.27.173-.51.43-.595.063-.021.13-.03.196-.03.195 0 .38.089.503.234l1.89 2.181V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.001zm-5.741 0c0 .346-.282.63-.63.63-.345 0-.627-.284-.627-.63V8.108c0-.345.282-.63.63-.63.346 0 .63.285.63.63v4.771h-.003zm-2.466.63H4.917c-.345 0-.63-.285-.63-.63V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629z"/>
                      </svg>
                      LINE
                    </>
                  )}
                </Badge>
                
                {/* User IDs - แสดงเฉพาะ Developer */}
                {userRole === 'developer' && (
                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    {conversation.line_user_id && (
                      <p className="font-mono bg-slate-50 p-2 rounded break-all">
                        LINE: {conversation.line_user_id}
                      </p>
                    )}
                    {conversation.facebook_user_id && (
                      <p className="font-mono bg-blue-50 p-2 rounded break-all text-blue-700">
                        Facebook: {conversation.facebook_user_id}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {tenant ? (
                <div className="space-y-3 text-sm">
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-green-800 font-medium flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      ผู้เช่าในระบบ
                    </p>
                  </div>

                  {tenant.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-4 h-4" />
                      <span>{tenant.phone}</span>
                    </div>
                  )}
                  {tenant.room_number && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Home className="w-4 h-4" />
                      <span>ห้อง {tenant.room_number}</span>
                    </div>
                  )}

                  {/* ปุ่มยกเลิกการเชื่อมต่อ - รองรับทั้ง LINE และ Facebook */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 text-red-600 border-red-200 hover:bg-red-50"
                    disabled={linking}
                    onClick={async () => {
                      const platform = conversation.facebook_user_id ? 'Facebook' : 'LINE';
                      console.log('🔓 Unlink clicked:', {
                        platform,
                        tenantId: tenant?.id,
                        tenantName: tenant?.full_name,
                        lineUserId: conversation.line_user_id,
                        facebookUserId: conversation.facebook_user_id,
                        currentTenantLineId: tenant?.line_user_id,
                        currentTenantFacebookId: tenant?.facebook_user_id
                      });

                      const confirmed = window.confirm(`ต้องการยกเลิกการเชื่อมต่อ ${platform} ของผู้เช่านี้?`);
                      if (!confirmed) return;

                      setLinking(true);
                      try {
                        // อัพเดท tenant โดยลบ line_user_id หรือ facebook_user_id
                        const updateData = conversation.facebook_user_id 
                          ? { facebook_user_id: null }
                          : { line_user_id: null };
                        
                        console.log('📤 Updating tenant:', tenant.id, 'with:', updateData);
                        
                        await base44.entities.Tenant.update(tenant.id, updateData);
                        
                        console.log('✅ Update successful');
                        toast.success(`ยกเลิกการเชื่อมต่อ ${platform} สำเร็จ`);
                        
                        // ⭐ Refresh เฉพาะ tenants และรอให้เสร็จ
                        if (onRefresh) {
                          console.log('🔄 Calling onRefresh...');
                          await onRefresh();
                          console.log('✅ onRefresh completed');
                        }
                        
                        // ปิด panel หลัง refresh เสร็จ
                        setShowProfile(false);
                      } catch (err) {
                        console.error('❌ Unlink error:', err);
                        toast.error('ยกเลิกการเชื่อมต่อไม่สำเร็จ');
                      } finally {
                        setLinking(false);
                      }
                    }}
                  >
                    {linking ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <X className="w-4 h-4 mr-1" />
                    )}
                    ยกเลิกการเชื่อมต่อ {conversation.facebook_user_id ? 'Facebook' : 'LINE'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-orange-50 rounded-lg text-sm">
                    <p className="text-orange-800">
                      ผู้ติดต่อนี้ยังไม่ได้เชื่อมต่อกับผู้เช่าในระบบ
                    </p>
                  </div>

                  {/* Link to Tenant by Room */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-600">
                      เชื่อมต่อกับห้อง:
                    </p>
                    <select
                      value={selectedRoomId}
                      onChange={(e) => setSelectedRoomId(e.target.value)}
                      className="w-full text-sm border rounded-lg px-3 py-2"
                      disabled={!tenants || tenants.length === 0 || !rooms || rooms.length === 0}
                    >
                      <option value="">
                        {!tenants || tenants.length === 0 ? '⏳ กำลังโหลดผู้เช่า...' : '-- เลือกห้อง --'}
                      </option>
                    {(() => {
                      // ⭐ ถ้าข้อมูลยังไม่พร้อม ไม่แสดงตัวเลือก
                      if (!tenants || tenants.length === 0 || !rooms || rooms.length === 0 || !bookings) {
                        return null;
                      }

                      // ⭐ กรองผู้เช่าที่ยังไม่มี LINE หรือ Facebook (ตาม platform ที่กำลังใช้)
                      const isFacebook = !!conversation.facebook_user_id;
                      const tenantsWithoutPlatform = tenants.filter(t => {
                        if (t.status === 'moved_out') return false;
                        return isFacebook ? !t.facebook_user_id : !t.line_user_id;
                      });

                      // สร้าง Map ของ tenant กับห้องจาก bookings
                      const tenantRoomMap = {};
                      bookings
                        .filter(b => b.status === 'active')
                        .forEach(booking => {
                          const room = rooms.find(r => r.id === booking.room_id);
                          if (room) {
                            tenantRoomMap[booking.tenant_id] = room.room_number;
                          }
                        });

                      return tenantsWithoutPlatform
                        .map(tenant => {
                          const roomNumber = tenant.room_number || tenantRoomMap[tenant.id];
                          return { tenant, roomNumber };
                        })
                        .filter(({ roomNumber }) => roomNumber)
                        .sort((a, b) => {
                          return (a.roomNumber || '').localeCompare(b.roomNumber || '', 'th', { numeric: true });
                        })
                        .map(({ tenant, roomNumber }) => (
                          <option key={tenant.id} value={tenant.id}>
                            ห้อง {roomNumber} - {tenant.full_name}
                          </option>
                        ));
                    })()}
                    </select>
                    
                    {/* Debug: แสดงสาเหตุถ้าไม่มีห้องให้เลือก */}
                    {(() => {
                      const isFacebook = !!conversation.facebook_user_id;
                      const platform = isFacebook ? 'Facebook' : 'LINE';
                      const tenantsWithoutPlatform = tenants.filter(t => {
                        if (t.status === 'moved_out') return false;
                        return isFacebook ? !t.facebook_user_id : !t.line_user_id;
                      });
                      
                      if (tenantsWithoutPlatform.length === 0) {
                        return (
                          <p className="text-xs text-orange-600 mt-1">
                            ⚠️ ผู้เช่าทุกคนมี {platform} แล้ว หรือยังไม่มีผู้เช่าในระบบ
                          </p>
                        );
                      }
                      
                      const tenantRoomMap = {};
                      bookings
                        .filter(b => b.status === 'active')
                        .forEach(booking => {
                          const room = rooms.find(r => r.id === booking.room_id);
                          if (room) {
                            tenantRoomMap[booking.tenant_id] = room.room_number;
                          }
                        });
                      
                      const tenantsWithRoom = tenantsWithoutPlatform.filter(t => 
                        t.room_number || tenantRoomMap[t.id]
                      );
                      
                      if (tenantsWithRoom.length === 0) {
                        return (
                          <p className="text-xs text-orange-600 mt-1">
                            ⚠️ มีผู้เช่า {tenantsWithoutPlatform.length} คนที่ยังไม่มี {platform}<br/>
                            แต่ยังไม่มีสัญญา active หรือยังไม่ได้ผูกห้อง
                          </p>
                        );
                      }
                      
                      return (
                        <p className="text-xs text-green-600 mt-1">
                          ✓ พบ {tenantsWithRoom.length} ห้องให้เลือก
                        </p>
                      );
                    })()}
                    <Button
                      size="sm"
                      className={`w-full ${
                        conversation.facebook_user_id 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-green-600 hover:bg-green-700'
                      }`}
                      disabled={!selectedRoomId || linking}
                      onClick={async () => {
                        if (!selectedRoomId) return;
                        setLinking(true);
                        try {
                          // อัพเดท tenant ด้วย line_user_id หรือ facebook_user_id
                          const updateData = conversation.facebook_user_id 
                            ? { facebook_user_id: conversation.facebook_user_id }
                            : { line_user_id: conversation.line_user_id };
                          
                          await base44.entities.Tenant.update(selectedRoomId, updateData);

                          // 🔄 Migrate Chat History (ดึงประวัติแชทย้อนหลังมาที่สาขานี้)
                          try {
                            const targetTenant = tenants.find(t => t.id === selectedRoomId);
                            if (targetTenant) {
                              if (conversation.facebook_user_id) {
                                const pastMessages = await base44.entities.FacebookMessage.filter({ facebook_user_id: conversation.facebook_user_id }, '', 1000);
                                const msgs = Array.isArray(pastMessages) ? pastMessages : (pastMessages ? [pastMessages] : []);
                                for (const msg of msgs) {
                                  if (msg.branch_id !== targetTenant.branch_id || msg.tenant_id !== targetTenant.id) {
                                    await base44.entities.FacebookMessage.update(msg.id, { branch_id: targetTenant.branch_id, tenant_id: targetTenant.id });
                                  }
                                }
                              } else if (conversation.line_user_id) {
                                const pastMessages = await base44.entities.LineMessage.filter({ line_user_id: conversation.line_user_id }, '', 1000);
                                const msgs = Array.isArray(pastMessages) ? pastMessages : (pastMessages ? [pastMessages] : []);
                                for (const msg of msgs) {
                                  if (msg.branch_id !== targetTenant.branch_id || msg.tenant_id !== targetTenant.id) {
                                    await base44.entities.LineMessage.update(msg.id, { branch_id: targetTenant.branch_id, tenant_id: targetTenant.id });
                                  }
                                }
                              }
                            }
                          } catch (e) {
                            console.error('Failed to migrate history:', e);
                          }
                          
                          const platform = conversation.facebook_user_id ? 'Facebook' : 'LINE';
                          toast.success(`เชื่อมต่อ ${platform} สำเร็จ และดึงประวัติแชทมาแล้ว`);
                          setSelectedRoomId('');
                          setShowProfile(false);
                          
                          // ⭐ Refresh เฉพาะ tenants
                          if (onRefresh) await onRefresh();
                        } catch (error) {
                          console.error('Link error:', error);
                          toast.error('เชื่อมต่อไม่สำเร็จ: ' + error.message);
                        } finally {
                          setLinking(false);
                        }
                      }}
                    >
                      {linking ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-1" />
                      ) : (
                        <Link className="w-4 h-4 mr-1" />
                      )}
                      เชื่อมต่อ {conversation.facebook_user_id ? 'Facebook' : 'LINE'}
                    </Button>
                  </div>
                </div>
              )}

              {/* ปุ่มเพิ่มผู้เช่า - แสดงตลอดเวลา */}
              <div className="mt-4 pt-4 border-t">
                <Button
                  size="sm"
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                  disabled={analyzingChat || messages.length === 0}
                  onClick={() => {
                    console.log('🆕 Add Tenant clicked, messages count:', messages.length);
                    if (messages.length === 0) {
                      toast.error('ยังไม่มีข้อความให้วิเคราะห์');
                      return;
                    }
                    handleAnalyzeChat();
                  }}
                >
                  {analyzingChat ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      กำลังวิเคราะห์...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      เพิ่มผู้เช่าใหม่
                    </>
                  )}
                </Button>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  AI จะวิเคราะห์ข้อความและเสนอข้อมูลให้
                </p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Tenant Dialog */}
      <AddTenantDialog
        open={showAddTenantDialog}
        onClose={() => {
          setShowAddTenantDialog(false);
          setAiExtractedData(null);
          setAnalyzingChat(false);
        }}
        aiData={aiExtractedData}
        rooms={rooms}
        onSubmit={handleSubmitTenant}
        submitting={submittingTenant}
        conversation={conversation}
        analyzing={analyzingChat}
      />
    </div>
  );
}