import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Search, Trash2, Calendar, Crown, Shield, User, AlertCircle } from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { toast } from "sonner";
import PageHeader from "../components/shared/PageHeader";

export default function UsersDashboard() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState("");

    // ดึงข้อมูล currentUser เพื่อเช็คสิทธิ์
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => base44.auth.me(),
    });

    // ดึงข้อมูล Users ทั้งหมด (เฉพาะ developer)
    const { data: users = [], isLoading } = useQuery({
        queryKey: ['allUsers'],
        queryFn: async () => {
            const response = await base44.entities.User.list('-created_date', 500);
            return response || [];
        },
        enabled: currentUser?.role === 'admin',
    });

    // Mutation ลบ trial_ends_at
    const removeTrialEndDateMutation = useMutation({
        mutationFn: async (userId) => {
            await base44.entities.User.update(userId, {
                trial_ends_at: null
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['allUsers']);
            toast.success('✅ ลบ Trial End Date สำเร็จ');
        },
        onError: (error) => {
            toast.error(`❌ เกิดข้อผิดพลาด: ${error.message}`);
        }
    });

    // Filter users
    const filteredUsers = users.filter(user => {
        const query = searchQuery.toLowerCase();
        return !query || 
               user.email?.toLowerCase().includes(query) ||
               user.full_name?.toLowerCase().includes(query);
    });

    // เช็คสิทธิ์
    if (currentUser?.role !== 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center p-6">
                <Card className="max-w-md">
                    <CardContent className="pt-6 text-center">
                        <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold mb-2">ไม่มีสิทธิ์เข้าถึง</h2>
                        <p className="text-slate-600">หน้านี้สำหรับ Developer เท่านั้น</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const getRoleBadge = (user) => {
        if (user.role === 'admin') {
            return <Badge className="bg-purple-500">👨‍💻 Admin</Badge>;
        }
        if (user.custom_role === 'owner') {
            return <Badge className="bg-blue-500">👑 Owner</Badge>;
        }
        if (user.custom_role === 'manager') {
            return <Badge className="bg-green-500">👔 Manager</Badge>;
        }
        return <Badge variant="outline">👤 Employee</Badge>;
    };

    const getPlanBadge = (user) => {
        if (!user.plan_status) {
            return <Badge variant="outline" className="text-slate-500">-</Badge>;
        }
        
        const badges = {
            trial: { label: '🎉 Trial', color: 'bg-amber-500' },
            active: { label: '✅ Active', color: 'bg-green-500' },
            expired: { label: '❌ Expired', color: 'bg-red-500' },
            cancelled: { label: '🚫 Cancelled', color: 'bg-slate-500' }
        };
        
        const badge = badges[user.plan_status] || { label: user.plan_status, color: 'bg-slate-500' };
        return <Badge className={badge.color}>{badge.label}</Badge>;
    };

    const getTrialInfo = (user) => {
        if (!user.trial_ends_at) return null;
        
        try {
            const endDate = parseISO(user.trial_ends_at);
            const daysLeft = differenceInDays(endDate, new Date());
            const dateStr = format(endDate, 'dd/MM/yyyy');
            
            if (daysLeft < 0) {
                return { text: `หมดแล้ว (${dateStr})`, color: 'text-red-600' };
            }
            return { text: `เหลือ ${daysLeft} วัน (${dateStr})`, color: 'text-amber-600' };
        } catch {
            return { text: user.trial_ends_at, color: 'text-slate-500' };
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 p-6">
            <div className="max-w-7xl mx-auto">
                <PageHeader
                    title="จัดการผู้ใช้ระบบ"
                    subtitle="ดูและจัดการข้อมูล Users ทั้งหมด"
                    icon={Users}
                />

                <Card className="mb-6 bg-white/80 backdrop-blur">
                    <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Search className="w-5 h-5 text-blue-500" />
                                ค้นหา Users
                            </CardTitle>
                            <Badge variant="outline" className="text-sm">
                                ทั้งหมด: {filteredUsers.length} คน
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <Input
                            placeholder="ค้นหาด้วย email หรือชื่อ..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-md"
                        />
                    </CardContent>
                </Card>

                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
                        <p className="mt-4 text-slate-600">กำลังโหลด...</p>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {filteredUsers.map((user) => {
                            const trialInfo = getTrialInfo(user);
                            
                            return (
                                <Card key={user.id} className="bg-white/80 backdrop-blur hover:shadow-lg transition-all">
                                    <CardContent className="pt-6">
                                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-3 flex-wrap">
                                                    <h3 className="font-semibold text-lg">{user.full_name || 'ไม่ระบุ'}</h3>
                                                    {getRoleBadge(user)}
                                                    {getPlanBadge(user)}
                                                </div>
                                                
                                                <p className="text-sm text-slate-600">{user.email}</p>
                                                
                                                <div className="flex flex-wrap gap-2 text-xs">
                                                    <Badge variant="outline" className="text-slate-600">
                                                        ID: {user.id.slice(0, 8)}
                                                    </Badge>
                                                    {user.accessible_branches && user.accessible_branches.length > 0 && (
                                                        <Badge variant="outline" className="text-blue-600">
                                                            {user.accessible_branches.length} สาขา
                                                        </Badge>
                                                    )}
                                                    <Badge variant="outline" className="text-slate-500">
                                                        สร้าง: {format(parseISO(user.created_date), 'dd/MM/yyyy')}
                                                    </Badge>
                                                </div>

                                                {trialInfo && (
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <Calendar className="w-4 h-4" />
                                                        <span className={trialInfo.color}>
                                                            Trial: {trialInfo.text}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                {user.trial_ends_at && (
                                                    <Button
                                                        onClick={() => {
                                                            if (confirm(`ลบ Trial End Date ของ ${user.email}?`)) {
                                                                removeTrialEndDateMutation.mutate(user.id);
                                                            }
                                                        }}
                                                        disabled={removeTrialEndDateMutation.isPending}
                                                        variant="outline"
                                                        size="sm"
                                                        className="text-red-600 hover:bg-red-50 border-red-300"
                                                    >
                                                        <Trash2 className="w-4 h-4 mr-1" />
                                                        ลบ Trial Date
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}

                        {filteredUsers.length === 0 && (
                            <Card className="bg-white/80 backdrop-blur">
                                <CardContent className="pt-12 pb-12 text-center">
                                    <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <p className="text-slate-600">ไม่พบผู้ใช้</p>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}