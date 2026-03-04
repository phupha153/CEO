import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, CheckCircle2, AlertTriangle, Link, Smartphone, UserPlus, Loader2, Copy, Search, HelpCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { th } from "date-fns/locale";

export default function LineConnectButton({ tenant, variant = "outline", size = "sm" }) {
  const [showDialog, setShowDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  // Fetch recent LINE users who chatted
  const { data: recentLineUsers = [], isLoading: isLoadingUsers } = useQuery({
    queryKey: ['recentLineUsers', tenant?.branch_id],
    queryFn: async () => {
      if (!tenant?.branch_id) return [];
      
      const messages = await base44.entities.LineMessage.filter({ branch_id: tenant.branch_id }, '-created_date', 100);
      
      const usersMap = new Map();
      messages.forEach(msg => {
        if (msg.line_user_id && !usersMap.has(msg.line_user_id)) {
          usersMap.set(msg.line_user_id, {
            line_user_id: msg.line_user_id,
            display_name: msg.line_display_name || 'ผู้ใช้ LINE',
            picture_url: msg.line_picture_url,
            last_message: msg.content,
            created_date: msg.created_date
          });
        }
      });
      return Array.from(usersMap.values());
    },
    enabled: showDialog && !!tenant?.branch_id
  });

  // Fetch already connected LINE IDs
  const { data: connectedLineIds = [] } = useQuery({
    queryKey: ['connectedLineIds', tenant?.branch_id],
    queryFn: async () => {
      if (!tenant?.branch_id) return [];
      const tenants = await base44.entities.Tenant.filter({ branch_id: tenant.branch_id, status: 'active' }, '', 1000);
      return tenants.map(t => t.line_user_id).filter(Boolean);
    },
    enabled: showDialog && !!tenant?.branch_id
  });

  const connectMutation = useMutation({
    mutationFn: async (lineUserId) => {
      return await base44.entities.Tenant.update(tenant.id, { line_user_id: lineUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants']);
      queryClient.invalidateQueries(['recentLineUsers']);
      toast.success('เชื่อมต่อ LINE สำเร็จ!');
      setShowDialog(false);
    },
    onError: (error) => {
      toast.error('เกิดข้อผิดพลาด: ' + error.message);
    }
  });

  if (!tenant?.id) return null;

  const isConnected = !!tenant.line_user_id;

  if (isConnected) {
    return (
      <Button
        variant="ghost"
        size={size}
        className="text-green-600 hover:text-green-700 hover:bg-green-50 cursor-default font-medium border border-green-200 bg-green-50/50"
        disabled
      >
        <CheckCircle2 className="w-4 h-4 mr-1.5" />
        เชื่อมต่อ LINE แล้ว
      </Button>
    );
  }

  const filteredUsers = recentLineUsers.filter(u => 
    u.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowDialog(true)}
        className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-sm font-medium border-0"
      >
        <Link className="w-4 h-4 mr-1.5" />
        เชื่อมต่อ LINE
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-slate-50">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
            <DialogHeader>
              <DialogTitle className="text-2xl flex items-center gap-3 text-white">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                เชื่อมต่อ LINE
              </DialogTitle>
            </DialogHeader>
            <p className="mt-2 text-green-50 opacity-90">
              กำลังดำเนินการสำหรับผู้เช่า: <span className="font-bold">{tenant.full_name}</span>
            </p>
          </div>

          <Tabs defaultValue="select" className="p-6">
            <TabsList className="grid w-full grid-cols-2 bg-slate-200/50 p-1 rounded-xl">
              <TabsTrigger value="select" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <UserPlus className="w-4 h-4 mr-2" />
                เลือกจากแชท
              </TabsTrigger>
              <TabsTrigger value="auto" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Smartphone className="w-4 h-4 mr-2" />
                ให้ผู้เช่าทำเอง
              </TabsTrigger>
            </TabsList>

            <TabsContent value="select" className="mt-6 space-y-4">
              <div className="flex flex-col space-y-4">
                <p className="text-sm text-slate-600 bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-100 flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-500" />
                  <span>
                    <strong>วิธีใช้งาน:</strong> ให้ผู้เช่าทักแชท LINE Official ของหอพักมา 1 ครั้ง จากนั้นคุณสามารถเลือกชื่อ LINE ของผู้เช่าจากรายการด้านล่างเพื่อทำการเชื่อมต่อได้ทันที
                  </span>
                </p>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    placeholder="ค้นหาชื่อ LINE..." 
                    className="pl-9 bg-white border-slate-200"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[300px]">
                  {isLoadingUsers ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3">
                      <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                      <p>กำลังค้นหาแชทล่าสุด...</p>
                    </div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3 p-6 text-center">
                      <MessageSquare className="w-12 h-12 text-slate-200" />
                      <p>ไม่พบรายการแชทล่าสุด หรือไม่พบชื่อที่ค้นหา<br/>ลองให้ผู้เช่าทักข้อความมาใหม่</p>
                    </div>
                  ) : (
                    <div className="overflow-y-auto flex-1 divide-y divide-slate-100 p-1">
                      {filteredUsers.map(user => {
                        const isAlreadyConnected = connectedLineIds.includes(user.line_user_id);
                        
                        return (
                          <div key={user.line_user_id} className="flex items-center justify-between p-3 hover:bg-slate-50 transition-colors rounded-lg group">
                            <div className="flex items-center gap-3 min-w-0">
                              <Avatar className="w-10 h-10 border border-slate-200 shadow-sm">
                                <AvatarImage src={user.picture_url} />
                                <AvatarFallback className="bg-green-100 text-green-700">
                                  {user.display_name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-800 text-sm truncate flex items-center gap-2">
                                  {user.display_name}
                                  {isAlreadyConnected && (
                                    <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full font-normal">
                                      เชื่อมต่อแล้ว
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-slate-500 truncate mt-0.5" title={user.last_message}>
                                  {user.last_message || 'ไม่มีข้อความ'}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-3 pl-2">
                              <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                {user.created_date ? formatDistanceToNow(new Date(user.created_date), { addSuffix: true, locale: th }) : ''}
                              </span>
                              <Button
                                size="sm"
                                variant={isAlreadyConnected ? "secondary" : "default"}
                                className={!isAlreadyConnected ? "bg-green-600 hover:bg-green-700 shadow-sm" : ""}
                                disabled={isAlreadyConnected || connectMutation.isPending}
                                onClick={() => connectMutation.mutate(user.line_user_id)}
                              >
                                {connectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isAlreadyConnected ? 'เชื่อมแล้ว' : 'เชื่อมต่อ'}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="auto" className="mt-6">
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 border border-green-200">
                    <span className="font-bold text-green-600 text-lg">1</span>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-lg">ให้ผู้เช่าแอด LINE ของหอพัก</p>
                    <p className="text-slate-600 text-sm mt-1">ให้ผู้เช่าเพิ่มเพื่อน LINE Official ของหอพัก หากยังไม่ได้เป็นเพื่อนกัน</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 border border-green-200">
                    <span className="font-bold text-green-600 text-lg">2</span>
                  </div>
                  <div className="w-full">
                    <p className="font-semibold text-slate-800 text-lg">พิมพ์เบอร์โทรศัพท์ส่งมาในแชท</p>
                    <p className="text-slate-600 text-sm mt-1 mb-3">ให้ผู้เช่าพิมพ์เบอร์โทรศัพท์ (10 หลัก) ส่งมาในแชท ระบบจะทำการเชื่อมต่อให้อัตโนมัติ</p>
                    
                    <div className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm">
                      <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span className="text-sm font-semibold text-amber-800">สำคัญมาก! เบอร์ต้องตรงกัน</span>
                      </div>
                      <div className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">เบอร์โทรของผู้เช่าในระบบ</p>
                          <p className="text-2xl font-bold text-slate-800 tracking-wider">
                            {tenant.phone || <span className="text-red-500 text-lg">⚠️ ยังไม่ได้ระบุเบอร์โทร</span>}
                          </p>
                        </div>
                        {tenant.phone && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-slate-50 hover:bg-slate-100"
                            onClick={() => {
                              navigator.clipboard.writeText(tenant.phone);
                              toast.success('คัดลอกเบอร์โทรแล้ว');
                            }}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            คัดลอกเบอร์โทร
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-800 leading-relaxed">
                    เมื่อเชื่อมต่อสำเร็จ ระบบจะสามารถส่งบิลค่าเช่า, แจ้งเตือนยอดค้างชำระ, และรับสลิปโอนเงินผ่านทาง LINE ได้อัตโนมัติ
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}