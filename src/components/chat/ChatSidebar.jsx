import React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, User, MessageCircle, Trash2, Facebook } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

export default function ChatSidebar({ 
  conversations, 
  selectedConversation, 
  onSelectConversation, 
  searchTerm, 
  onSearchChange,
  tenantsMap,
  onDeleteConversation
}) {
  const [swipedId, setSwipedId] = useState(null);
  const filteredConversations = conversations.filter(conv => {
    const tenant = tenantsMap[conv.tenant_id];
    const name = tenant?.full_name || conv.line_display_name || 'ไม่ทราบชื่อ';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="w-full h-full flex flex-col bg-white border-r">
      {/* Search */}
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="ค้นหาแชท..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-slate-500 text-sm">
            <MessageCircle className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>ยังไม่มีข้อความ</p>
          </div>
        ) : (
          filteredConversations.map((conv) => {
            const tenant = tenantsMap[conv.tenant_id];
            const isSelected = selectedConversation?.line_user_id === conv.line_user_id;
            const isSwiped = swipedId === conv.line_user_id;

            return (
              <div
                key={conv.line_user_id}
                className="relative overflow-hidden"
              >
                {/* Delete button (behind) - visible when swiped */}
                {isSwiped && (
                  <button 
                    type="button"
                    className="absolute right-0 top-0 bottom-0 w-16 bg-red-500 flex items-center justify-center cursor-pointer hover:bg-red-600 transition-colors z-10"
                    onClick={() => {
                      const confirmed = window.confirm('ต้องการลบแชทนี้?');
                      if (!confirmed) {
                        setSwipedId(null);
                        return;
                      }
                      
                      Promise.resolve(onDeleteConversation?.(conv.line_user_id))
                        .catch(err => console.error('Delete failed:', err))
                        .finally(() => setSwipedId(null));
                    }}
                  >
                    <Trash2 className="w-5 h-5 text-white" />
                  </button>
                )}

                {/* Main content (swipeable) */}
                <div
                  onClick={() => {
                    if (isSwiped) {
                      setSwipedId(null);
                    } else {
                      onSelectConversation(conv);
                    }
                  }}
                  onTouchStart={(e) => {
                    const touch = e.touches[0];
                    e.currentTarget.dataset.startX = touch.clientX;
                  }}
                  onTouchMove={(e) => {
                    const touch = e.touches[0];
                    const startX = parseFloat(e.currentTarget.dataset.startX);
                    const diff = startX - touch.clientX;
                    if (diff > 50) {
                      setSwipedId(conv.line_user_id);
                    } else if (diff < -30) {
                      setSwipedId(null);
                    }
                  }}
                  className={`p-3 border-b cursor-pointer transition-all duration-200 bg-white ${
                    isSelected 
                      ? 'bg-blue-50 border-l-4 border-l-blue-500' 
                      : 'hover:bg-slate-50'
                  } ${isSwiped ? '-translate-x-16' : 'translate-x-0'}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="relative flex-shrink-0">
                      {conv.line_picture_url || conv.facebook_picture_url ? (
                        <>
                          <img 
                            src={conv.line_picture_url || conv.facebook_picture_url} 
                            alt="" 
                            className="w-10 h-10 rounded-full object-cover"
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.nextSibling.style.display = 'flex';
                            }}
                          />
                          <div 
                            className="w-10 h-10 rounded-full hidden items-center justify-center bg-gradient-to-br from-green-400 to-emerald-500"
                          >
                            {conv.facebook_user_id ? (
                              <Facebook className="w-5 h-5 text-white" />
                            ) : (
                              <User className="w-5 h-5 text-white" />
                            )}
                          </div>
                        </>
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          conv.facebook_user_id 
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                            : 'bg-gradient-to-br from-green-400 to-emerald-500'
                        }`}>
                          {conv.facebook_user_id ? (
                            <Facebook className="w-5 h-5 text-white" />
                          ) : (
                            <User className="w-5 h-5 text-white" />
                          )}
                        </div>
                      )}
                      {/* Platform Logo Badge */}
                      <div className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 border-white ${
                        conv.facebook_user_id ? 'bg-blue-500' : 'bg-green-500'
                      }`}>
                        {conv.facebook_user_id ? (
                          <Facebook className="w-2.5 h-2.5 text-white" />
                        ) : (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
                          </svg>
                        )}
                      </div>
                      {conv.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-slate-800 truncate text-sm">
                          {tenant?.room_number ? `ห้อง ${tenant.room_number} - ${tenant.full_name}` : (tenant?.full_name || conv.line_display_name || 'ไม่ทราบชื่อ')}
                        </p>
                        <span className="text-xs text-slate-400 flex-shrink-0">
                          {conv.last_message_time && formatDistanceToNow(new Date(conv.last_message_time), { 
                            addSuffix: false, 
                            locale: th 
                          })}
                        </span>
                      </div>

                      {/* Last message preview */}
                      <p className="text-xs text-slate-500 truncate mt-1">
                        {conv.last_message || 'ไม่มีข้อความ'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}