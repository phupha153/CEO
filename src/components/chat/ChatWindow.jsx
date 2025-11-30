import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Send, User, Phone, Home, Loader2, 
  CheckCircle, Info, Sparkles, X, Link, Save
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
    <div className="flex-1 flex flex-col bg-slate-50 h-full">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {conversation.line_picture_url ? (
            <img 
              src={conversation.line_picture_url} 
              alt="" 
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-800">{displayName}</p>
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
          onClick={() => setShowProfile(!showProfile)}
        >
          <Info className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                    <p className={`text-xs mt-1 ${
                      isOutgoing ? 'text-blue-100' : 'text-slate-400'
                    }`}>
                      {msg.created_date && format(new Date(msg.created_date), 'HH:mm')}
                      {isOutgoing && <span className="ml-1">• ส่งจากแอป</span>}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Profile Panel */}
        {showProfile && (
          <div className="w-64 bg-white border-l p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">ข้อมูลผู้ติดต่อ</h3>
              <Button variant="ghost" size="icon" onClick={() => setShowProfile(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="text-center mb-4">
              {conversation.line_picture_url ? (
                <img 
                  src={conversation.line_picture_url} 
                  alt="" 
                  className="w-20 h-20 rounded-full object-cover mx-auto"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center mx-auto">
                  <User className="w-10 h-10 text-white" />
                </div>
              )}
              <p className="font-semibold mt-2">{displayName}</p>
              <p className="text-xs text-slate-500">LINE: {conversation.line_display_name}</p>
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

                {/* ปุ่มยกเลิกการเชื่อมต่อ - แสดงเสมอถ้ามี conversation (ใช้ line_user_id จาก conversation) */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 text-red-600 border-red-200 hover:bg-red-50"
                  disabled={linking}
                  onClick={async () => {
                    const confirmed = window.confirm('ต้องการยกเลิกการเชื่อมต่อ LINE ของผู้เช่านี้?');
                    if (!confirmed) return;

                    setLinking(true);
                    try {
                      await onUnlinkTenant?.(tenant.id);
                      // รีเฟรชข้อมูลและปิด profile panel
                      if (onRefresh) onRefresh();
                      setShowProfile(false);
                    } catch (err) {
                      console.error('Unlink error:', err);
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
                  ยกเลิกการเชื่อมต่อ
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

                {/* Link to Tenant by Room */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-600">เชื่อมต่อกับห้อง:</p>
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="w-full text-sm border rounded-lg px-3 py-2"
                  >
                    <option value="">-- เลือกห้อง --</option>
                  {(() => {
                    // แสดงผู้เช่าทั้งหมดที่ยังไม่มี LINE พร้อมหมายเลขห้อง
                    const tenantsWithoutLine = tenants.filter(t => 
                      !t.line_user_id && t.status !== 'moved_out'
                    );
                    
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
                    
                    return tenantsWithoutLine
                      .map(tenant => {
                        // ใช้ room_number ที่เก็บไว้ใน tenant หรือจาก booking
                        const roomNumber = tenant.room_number || tenantRoomMap[tenant.id];
                        return { tenant, roomNumber };
                      })
                      .filter(({ roomNumber }) => roomNumber) // แสดงเฉพาะที่มีห้อง
                      .sort((a, b) => {
                        // เรียงตามเลขห้อง
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
                    const tenantsWithoutLine = tenants.filter(t => !t.line_user_id && t.status !== 'moved_out');
                    if (tenantsWithoutLine.length === 0) {
                      return (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ ผู้เช่าทุกคนมี LINE แล้ว หรือยังไม่มีผู้เช่าในระบบ
                        </p>
                      );
                    }
                    
                    // เช็คว่ามีห้องให้เลือกกี่ห้อง
                    const tenantRoomMap = {};
                    bookings
                      .filter(b => b.status === 'active')
                      .forEach(booking => {
                        const room = rooms.find(r => r.id === booking.room_id);
                        if (room) {
                          tenantRoomMap[booking.tenant_id] = room.room_number;
                        }
                      });
                    
                    const tenantsWithRoom = tenantsWithoutLine.filter(t => 
                      t.room_number || tenantRoomMap[t.id]
                    );
                    
                    if (tenantsWithRoom.length === 0) {
                      return (
                        <p className="text-xs text-orange-600 mt-1">
                          ⚠️ มีผู้เช่า {tenantsWithoutLine.length} คนที่ยังไม่มี LINE<br/>
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
                    className="w-full bg-green-600 hover:bg-green-700"
                    disabled={!selectedRoomId || linking}
                    onClick={async () => {
                      if (!selectedRoomId || !onLinkTenant) return;
                      setLinking(true);
                      try {
                        // selectedRoomId ตอนนี้คือ tenant_id แล้ว (ไม่ใช่ room_id)
                        // อัพเดท tenant ด้วย line_user_id
                        await base44.entities.Tenant.update(selectedRoomId, {
                          line_user_id: conversation.line_user_id
                        });
                        toast.success('เชื่อมต่อ LINE สำเร็จ');
                        setSelectedRoomId('');
                        // Refresh data
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
                    เชื่อมต่อ LINE
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
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