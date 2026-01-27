import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Search, Trash2, Calendar, Crown, Shield, User, AlertCircle, TrendingUp, Activity, CheckCircle } from "lucide-react";
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

    // Calculate stats
    const stats = useMemo(() => {
        const total = users.length;
        const admins = users.filter(u => u.role === 'admin').length;
        const owners = users.filter(u => u.custom_role === 'owner').length;
        const managers = users.filter(u => u.custom_role === 'manager').length;
        const employees = users.filter(u => u.custom_role === 'employee').length;
        const trialUsers = users.filter(u => u.plan_status === 'trial').length;
        const activeUsers = users.filter(u => u.plan_status === 'active').length;
        const expiredUsers = users.filter(u => u.plan_status === 'expired' || u.plan_status === 'cancelled').length;

        return { total, admins, owners, managers, employees, trialUsers, activeUsers, expiredUsers };
    }, [users]);

    // Filter users
    const filteredUsers = users.filter(user => {
        const query = searchQuery.toLowerCase();
        return !query || 
               user.email?.toLowerCase().includes(query) ||
               user.full_name?.toLowerCase().includes(query) ||
               user.id?.toLowerCase().includes(query);
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
            <div className="max-w-[1600px] mx-auto">
                <PageHeader
                    title="รายงานผู้ใช้ระบบ"
                    subtitle="Dashboard สำหรับดูข้อมูลและจัดการ Users ทั้งหมด"
                    icon={Users}
                />

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4 mb-6">
                    <Card className="bg-white/80 backdrop-blur">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-center">
                                <Users className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
                                <p className="text-xs text-slate-500">ทั้งหมด</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-center">
                                <Crown className="w-6 h-6 text-purple-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-slate-800">{stats.admins}</p>
                                <p className="text-xs text-slate-500">Admin</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-center">
                                <Shield className="w-6 h-6 text-blue-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-slate-800">{stats.owners}</p>
                                <p className="text-xs text-slate-500">Owner</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-center">
                                <User className="w-6 h-6 text-green-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-slate-800">{stats.managers}</p>
                                <p className="text-xs text-slate-500">Manager</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-center">
                                <Activity className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-slate-800">{stats.employees}</p>
                                <p className="text-xs text-slate-500">Employee</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-center">
                                <Calendar className="w-6 h-6 text-amber-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-slate-800">{stats.trialUsers}</p>
                                <p className="text-xs text-slate-500">Trial</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-center">
                                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-slate-800">{stats.activeUsers}</p>
                                <p className="text-xs text-slate-500">Active</p>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/80 backdrop-blur">
                        <CardContent className="pt-4 pb-4">
                            <div className="text-center">
                                <AlertCircle className="w-6 h-6 text-red-500 mx-auto mb-1" />
                                <p className="text-2xl font-bold text-slate-800">{stats.expiredUsers}</p>
                                <p className="text-xs text-slate-500">Expired</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search */}
                <Card className="mb-6 bg-white/80 backdrop-blur">
                    <CardContent className="pt-6">
                        <div className="flex items-center gap-3">
                            <Search className="w-5 h-5 text-slate-400" />
                            <Input
                                placeholder="ค้นหาด้วย email, ชื่อ, หรือ ID..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="flex-1"
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Table */}
                {isLoading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
                        <p className="mt-4 text-slate-600">กำลังโหลด...</p>
                    </div>
                ) : (
                    <Card className="bg-white/80 backdrop-blur overflow-hidden">
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-slate-50/50">
                                        <TableHead className="font-semibold">ชื่อ-อีเมล</TableHead>
                                        <TableHead className="font-semibold">Role</TableHead>
                                        <TableHead className="font-semibold">Plan Status</TableHead>
                                        <TableHead className="font-semibold">Trial Ends</TableHead>
                                        <TableHead className="font-semibold">สาขา</TableHead>
                                        <TableHead className="font-semibold">สร้างเมื่อ</TableHead>
                                        <TableHead className="font-semibold text-center">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => {
                                        const trialInfo = getTrialInfo(user);
                                        
                                        return (
                                            <TableRow key={user.id} className="hover:bg-blue-50/30 transition-colors">
                                                <TableCell>
                                                    <div>
                                                        <p className="font-medium text-slate-800">{user.full_name || '-'}</p>
                                                        <p className="text-xs text-slate-500">{user.email}</p>
                                                        <p className="text-xs text-slate-400 mt-1">ID: {user.id.slice(0, 12)}...</p>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="space-y-1">
                                                        {getRoleBadge(user)}
                                                        {user.permissions && user.permissions.length > 0 && (
                                                            <p className="text-xs text-slate-500">{user.permissions.length} สิทธิ์</p>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {getPlanBadge(user)}
                                                </TableCell>
                                                <TableCell>
                                                    {trialInfo ? (
                                                        <span className={`text-sm ${trialInfo.color}`}>
                                                            {trialInfo.text}
                                                        </span>
                                                    ) : (
                                                        <span className="text-sm text-slate-400">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    {user.accessible_branches && user.accessible_branches.length > 0 ? (
                                                        <Badge variant="outline" className="text-blue-600">
                                                            {user.accessible_branches.length} สาขา
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-sm text-slate-400">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-slate-600">
                                                        {format(parseISO(user.created_date), 'dd/MM/yyyy HH:mm')}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-center">
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
                                                            <Trash2 className="w-3 h-3 mr-1" />
                                                            ลบ Trial
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>

                            {filteredUsers.length === 0 && (
                                <div className="text-center py-12">
                                    <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                    <p className="text-slate-600">ไม่พบผู้ใช้</p>
                                </div>
                            )}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
}