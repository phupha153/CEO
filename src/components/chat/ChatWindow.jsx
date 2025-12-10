import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Send, User, Phone, Home, Loader2, 
  CheckCircle, Info, Sparkles, X, Link, Save, Facebook
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

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
  loading
}) {
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [linking, setLinking] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await onSendMessage(newMessage.trim());
      setNewMessage('');
    } catch (error) {
      toast.error('ส่งข้อความไม่สำเร็จ: ' + error.message);
    } finally {
      setSending(false);
    }
  };

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50">
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

  return (
    <div className="flex-1 flex flex-col bg-slate-50 h-full relative">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between z-10 relative">
        <div className="flex items-center gap-3">
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              <p>ยังไม่มีข้อความ</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              // ข้ามข้อความที่ส่งจากแอปเรา (outgoing) ถ้าไม่ต้องการแสดง
              // แสดงทุกข้อความทั้ง incoming และ outgoing
              const isOutgoing = msg.direction === 'outgoing';

              return (
                <div
                  key={msg.id || idx}
                  className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      isOutgoing
                        ? 'bg-blue-500 text-white rounded-br-md'
                        : 'bg-white text-slate-800 shadow-sm rounded-bl-md'
                    }`}
                  >
                    {msg.message_type === 'image' && msg.media_url && (
                      <a 
                        href={msg.media_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <img 
                          src={msg.media_url} 
                          alt="รูปภาพจากลูกค้า" 
                          className="max-w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </a>
                    )}
                    <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                    <div className={`flex items-center gap-1.5 mt-1 ${
                      isOutgoing ? 'text-blue-100' : 'text-slate-400'
                    }`}>
                      {/* Platform icon for incoming messages */}
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
                      {isOutgoing && <span className="text-xs">• ส่งจากแอป</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
      </div>

      {/* Profile Panel - Slide from right */}
      {showProfile && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-[999] animate-in fade-in duration-200"
            onClick={() => {
              console.log('❌ Close profile panel (backdrop click)');
              setShowProfile(false);
            }}
          />
          
          {/* Profile Panel - Fixed Right Sidebar with Slide Animation */}
          <div 
            className="fixed right-0 top-0 bottom-0 w-80 bg-white shadow-2xl z-[1000] overflow-y-auto animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              maxWidth: '320px',
              width: '100%'
            }}
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
              
              {/* User IDs */}
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
                
                {/* แสดง LINE User ID */}
                {conversation?.line_user_id && (
                  <div className="flex items-start gap-2 text-slate-500 text-xs">
                    <span className="flex-shrink-0">LINE ID:</span>
                    <span className="break-all font-mono">{conversation.line_user_id}</span>
                  </div>
                )}
                
                {/* แสดง Facebook User ID */}
                {conversation?.facebook_user_id && (
                  <div className="flex items-start gap-2 text-slate-500 text-xs">
                    <span className="flex-shrink-0">Facebook ID:</span>
                    <span className="break-all font-mono">{conversation.facebook_user_id}</span>
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
                    const confirmed = window.confirm(`ต้องการยกเลิกการเชื่อมต่อ ${platform} ของผู้เช่านี้?`);
                    if (!confirmed) return;

                    setLinking(true);
                    try {
                      // อัพเดท tenant โดยลบ line_user_id หรือ facebook_user_id
                      const updateData = conversation.facebook_user_id 
                        ? { facebook_user_id: null }
                        : { line_user_id: null };
                      
                      await base44.entities.Tenant.update(tenant.id, updateData);
                      toast.success(`ยกเลิกการเชื่อมต่อ ${platform} สำเร็จ`);
                      
                      // รีเฟรชข้อมูลและปิด profile panel
                      if (onRefresh) onRefresh();
                      setShowProfile(false);
                    } catch (err) {
                      console.error('Unlink error:', err);
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
                
                {/* แสดง LINE User ID สำหรับกรณียังไม่เชื่อมต่อ */}
                {conversation?.line_user_id && (
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">LINE User ID:</p>
                    <p className="text-xs font-mono text-slate-700 break-all">{conversation.line_user_id}</p>
                  </div>
                )}
                
                {/* แสดง Facebook User ID สำหรับกรณียังไม่เชื่อมต่อ */}
                {conversation?.facebook_user_id && (
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-500 mb-1">Facebook User ID:</p>
                    <p className="text-xs font-mono text-slate-700 break-all">{conversation.facebook_user_id}</p>
                  </div>
                )}

                {/* Link to Tenant by Room */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600">
                    เชื่อมต่อกับห้อง:
                  </p>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full text-sm border rounded-lg px-3 py-2"
                  >
                    <option value="">-- เลือกห้อง --</option>
                  {(() => {
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
                        
                        const platform = conversation.facebook_user_id ? 'Facebook' : 'LINE';
                        toast.success(`เชื่อมต่อ ${platform} สำเร็จ`);
                        setSelectedRoomId('');
                        
                        if (onRefresh) onRefresh();
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
            </div>
          </div>
        </>
      )}

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
  );
}