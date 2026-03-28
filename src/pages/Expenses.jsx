import React, { useState, useMemo, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Edit2, Trash2, Receipt, Zap, Droplets, Wrench, Wifi, Users, ShoppingCart, CalendarIcon, TrendingDown, Search, X, AlertTriangle, Wallet } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subMonths } from "date-fns";
import { th } from "date-fns/locale";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import StatsCard from "../components/dashboard/StatsCard";
import PageHeader from "../components/shared/PageHeader";
import ScrollToTopButton from "../components/shared/ScrollToTopButton";
import SlipPreviewDialog from "../components/shared/SlipPreviewDialog";

export default function Expenses() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [dateRangeType, setDateRangeType] = useState('this_month'); // 'this_month', '3_months', '6_months', 'custom'
  const [dateRange, setDateRange] = useState({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'other',
    date: '',
    description: '',
    receipt_image: '',
    notes: ''
  });
  const [slipPreview, setSlipPreview] = useState({ open: false, url: '' });

  // ✅ เพิ่ม pagination และ search
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const itemsPerPage = 6; // Adjusted for better viewing in this component layout

  const queryClient = useQueryClient();
  const selectedBranchId = localStorage.getItem('selected_branch_id');

  // ✅ Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1); // Reset page when search query changes
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // ✅ Auto-update date range based on type
  useEffect(() => {
    const now = new Date();
    switch (dateRangeType) {
      case 'this_month':
        setDateRange({
          from: startOfMonth(now),
          to: endOfMonth(now)
        });
        break;
      case '3_months':
        setDateRange({
          from: startOfMonth(subMonths(now, 2)),
          to: endOfMonth(now)
        });
        break;
      case '6_months':
        setDateRange({
          from: startOfMonth(subMonths(now, 5)),
          to: endOfMonth(now)
        });
        break;
      case 'custom':
        // Keep existing custom range
        break;
    }
  }, [dateRangeType]);

  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    retry: false,
    staleTime: 60 * 60 * 1000,
  });

  const userPermissions = currentUser?.permissions || [];
  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');

  const canView = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('expenses_view');
  const canAdd = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('expenses_add');
  const canEdit = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('expenses_edit');
  const canDelete = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('expenses_delete');

  const retryConfig = {
    retry: 0,
    retryDelay: 0,
  };

  const { data: branches = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!selectedBranchId, // Only fetch if a branch is selected
  });

  const selectedBranchName = useMemo(() => {
    return branches.find(branch => branch.id === selectedBranchId)?.name || 'ไม่ระบุสาขา';
  }, [branches, selectedBranchId]);


  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', selectedBranchId],
    queryFn: async () => {
      if (!selectedBranchId) return [];
      const expenses = await base44.entities.Expense.filter(
        { branch_id: selectedBranchId },
        '-date',
        1000
      );
      return expenses;
    },
    enabled: canView && !!selectedBranchId,
    ...retryConfig,
    staleTime: 60 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      if (!canAdd) {
        throw new Error('คุณไม่มีสิทธิ์เพิ่มค่าใช้จ่าย');
      }
      return base44.entities.Expense.create({ ...data, branch_id: selectedBranchId });
    },
    onSuccess: async (newExpense) => {
      queryClient.invalidateQueries(['expenses', selectedBranchId]);
      
      // บันทึก log
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'create',
        entity_type: 'Expense',
        entity_id: newExpense.id,
        entity_name: newExpense.title,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `สร้างค่าใช้จ่าย "${newExpense.title}" จำนวน ${newExpense.amount?.toLocaleString()} บาท`
      });
      
      setShowDialog(false);
      resetForm();
      toast.success('บันทึกค่าใช้จ่ายสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => {
      if (!canEdit) {
        throw new Error('คุณไม่มีสิทธิ์แก้ไขค่าใช้จ่าย');
      }
      return base44.entities.Expense.update(id, data);
    },
    onSuccess: async (updatedExpense) => {
      queryClient.invalidateQueries(['expenses', selectedBranchId]);
      
      // บันทึก log
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'update',
        entity_type: 'Expense',
        entity_id: updatedExpense.id,
        entity_name: updatedExpense.title,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `แก้ไขค่าใช้จ่าย "${updatedExpense.title}"`
      });
      
      setShowDialog(false);
      resetForm();
      toast.success('อัปเดตค่าใช้จ่ายสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (expense) => {
      if (!canDelete) {
        throw new Error('คุณไม่มีสิทธิ์ลบค่าใช้จ่าย');
      }
      await base44.entities.Expense.delete(expense.id);
      return expense;
    },
    onSuccess: async (deletedExpense) => {
      queryClient.invalidateQueries(['expenses', selectedBranchId]);
      
      // บันทึก log
      await base44.entities.ActivityLog.create({
        branch_id: selectedBranchId,
        action_type: 'delete',
        entity_type: 'Expense',
        entity_id: deletedExpense.id,
        entity_name: deletedExpense.title,
        user_email: currentUser?.email,
        user_name: currentUser?.full_name,
        description: `ลบค่าใช้จ่าย "${deletedExpense.title}" จำนวน ${deletedExpense.amount?.toLocaleString()} บาท`
      });
      
      toast.success('ลบค่าใช้จ่ายสำเร็จ');
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
    }
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFormData(prev => ({ ...prev, receipt_image: file_url }));
      toast.success('อัปโหลดรูปภาพสำเร็จ');
    } catch (error) {
      toast.error('อัปโหลดรูปภาพไม่สำเร็จ');
    }
    setUploadingImage(false);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = {
      ...formData,
      amount: parseFloat(formData.amount)
    };

    if (editingExpense) {
      updateMutation.mutate({ id: editingExpense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (expense) => {
    if (!canEdit) {
      toast.error('คุณไม่มีสิทธิ์แก้ไขค่าใช้จ่าย');
      return;
    }
    setEditingExpense(expense);
    setFormData({
      title: expense.title || '',
      amount: expense.amount?.toString() || '',
      category: expense.category || 'other',
      date: expense.date || '',
      description: expense.description || '',
      receipt_image: expense.receipt_image || '',
      notes: expense.notes || ''
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingExpense(null);
    setFormData({
      title: '',
      amount: '',
      category: 'other',
      date: '',
      description: '',
      receipt_image: '',
      notes: ''
    });
  };

  const getCategoryIcon = (category) => {
    const icons = {
      electricity: Zap,
      water: Droplets,
      repair: Wrench,
      internet: Wifi,
      salary: Users,
      supplies: ShoppingCart,
      other: Receipt
    };
    return icons[category] || Receipt;
  };

  const getCategoryLabel = (category) => {
    const labels = {
      electricity: 'ค่าไฟ',
      water: 'ค่าน้ำ',
      repair: 'ค่าซ่อมแซม',
      internet: 'ค่าอินเทอร์เน็ต',
      salary: 'เงินเดือน',
      supplies: 'วัสดุสิ้นเปลือง',
      other: 'อื่นๆ'
    };
    return labels[category] || category;
  };

  const getCategoryColor = (category) => {
    const colors = {
      electricity: 'bg-yellow-100 text-yellow-700',
      water: 'bg-blue-100 text-blue-700',
      repair: 'bg-orange-100 text-orange-700',
      internet: 'bg-purple-100 text-purple-700',
      salary: 'bg-green-100 text-green-700',
      supplies: 'bg-pink-100 text-pink-700',
      other: 'bg-slate-100 text-slate-700'
    };
    return colors[category] || colors.other;
  };

  // ✅ Memoized filtering
  const filteredExpenses = useMemo(() => {
    if (!canView) return [];
    let result = expenses;

    // Category filter
    if (activeTab !== 'all') {
      result = result.filter(expense => expense.category === activeTab);
    }

    // Date range filter
    if (dateRange?.from && dateRange?.to) {
      result = result.filter(expense => {
        if (!expense.date) return false;
        try {
          const expenseDate = parseISO(expense.date);
          return isWithinInterval(expenseDate, { start: dateRange.from, end: dateRange.to });
        } catch {
          return false;
        }
      });
    }

    // Search filter
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(expense =>
        expense.title?.toLowerCase().includes(query) ||
        expense.description?.toLowerCase().includes(query) ||
        expense.notes?.toLowerCase().includes(query) // Include notes in search
      );
    }

    return result;
  }, [expenses, activeTab, dateRange, debouncedSearch, canView]);

  // ✅ Pagination
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredExpenses.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredExpenses, currentPage, itemsPerPage]);

  // ✅ Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, dateRange, debouncedSearch]);


  const summary = useMemo(() => {
    const total = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const byCategory = {};
    filteredExpenses.forEach(expense => {
      const cat = expense.category || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + (expense.amount || 0);
    });

    const chartData = Object.entries(byCategory).map(([category, amount]) => ({
      name: getCategoryLabel(category),
      value: amount
    }));

    return { total, byCategory, chartData };
  }, [filteredExpenses]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280', '#14b8a6'];

  if (!selectedBranchId) {
    return (
      <div className="p-4 md:p-8 min-h-screen flex items-center justify-center">
        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 text-center p-8">
          <CardTitle className="text-2xl font-bold mb-4">
            กรุณาเลือกสาขา
          </CardTitle>
          <p className="text-slate-600">
            โปรดเลือกสาขาเพื่อดูข้อมูลค่าใช้จ่าย
          </p>
        </Card>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="p-8 text-center bg-white/80 backdrop-blur-sm border-slate-200/60">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</h2>
          <p className="text-slate-500 mt-2">โปรดติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์</p>
        </Card>
      </div>
    );
  }

  if (expensesLoading || branchesLoading) {
    return (
      <div className="p-4 md:p-8 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-slate-600 text-lg">กำลังโหลดข้อมูลค่าใช้จ่าย...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-50 to-blue-100">
      <ScrollToTopButton />
      <PageHeader
        title="ค่าใช้จ่าย"
        subtitle={`สาขา ${selectedBranchName}`}
        icon={Wallet}
        actions={
          canAdd && (
            <Button
              onClick={() => {
                setEditingExpense(null);
                setFormData({
                  title: '',
                  amount: '',
                  category: 'other',
                  date: new Date().toISOString().split('T')[0], // Set default date to today
                  description: '',
                  receipt_image: '',
                  notes: ''
                });
                setShowDialog(true);
              }}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg"
            >
              <Plus className="w-5 h-5 mr-2" />
              เพิ่มค่าใช้จ่าย
            </Button>
          )
        }
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Summary Card - ใช้ StatsCard แทน */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatsCard
              title="ค่าใช้จ่ายรวม"
              value={summary.total.toLocaleString('th-TH')}
              icon={TrendingDown}
              gradient="bg-gradient-to-br from-red-500 to-orange-600"
            />
            <div className="md:col-span-2">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl h-full">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between h-full">
                    <div>
                      <p className="text-slate-600 text-sm mb-1">ช่วงเวลา</p>
                      <p className="text-xl font-bold text-slate-800">
                        {dateRange.from && dateRange.to ? (
                          <>
                            {format(dateRange.from, 'd MMM', { locale: th })} - {format(dateRange.to, 'd MMM yyyy', { locale: th })}
                          </>
                        ) : (
                          'เลือกช่วงวันที่'
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-slate-600 text-sm mb-1">รายการทั้งหมด</p>
                      <p className="text-xl font-bold text-slate-800">{filteredExpenses.length} รายการ</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Charts */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-800">แยกตามประเภท</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={summary.chartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {summary.chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${value.toLocaleString()} ฿`} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-xl">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-slate-800">รายละเอียดตามประเภท</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.chartData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium text-slate-800">{item.name}</span>
                      </div>
                      <span className="font-bold text-slate-800">{item.value.toLocaleString()} ฿</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col md:flex-row gap-4">
            <Card className="flex-grow bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg p-2">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-transparent h-auto flex flex-wrap justify-start">
                  <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                  <TabsTrigger value="electricity">ค่าไฟ</TabsTrigger>
                  <TabsTrigger value="water">ค่าน้ำ</TabsTrigger>
                  <TabsTrigger value="repair">ค่าซ่อม</TabsTrigger>
                  <TabsTrigger value="internet">อินเทอร์เน็ต</TabsTrigger>
                  <TabsTrigger value="salary">เงินเดือน</TabsTrigger>
                  <TabsTrigger value="supplies">วัสดุสิ้นเปลือง</TabsTrigger>
                  <TabsTrigger value="other">อื่นๆ</TabsTrigger>
                </TabsList>
              </Tabs>
            </Card>
            <Card className="flex-shrink-0 bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg p-2">
              <div className="flex items-center gap-2">
                <Select value={dateRangeType} onValueChange={setDateRangeType}>
                  <SelectTrigger className="w-32 bg-white/80 backdrop-blur-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this_month">เดือนนี้</SelectItem>
                    <SelectItem value="3_months">3 เดือน</SelectItem>
                    <SelectItem value="6_months">6 เดือน</SelectItem>
                    <SelectItem value="custom">กำหนดเอง</SelectItem>
                  </SelectContent>
                </Select>

                {dateRangeType === 'custom' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="gap-2 bg-white/80 backdrop-blur-sm">
                        <CalendarIcon className="w-4 h-4" />
                        {dateRange.from && dateRange.to ? (
                          <>
                            {format(dateRange.from, 'd MMM', { locale: th })} - {format(dateRange.to, 'd MMM yyyy', { locale: th })}
                          </>
                        ) : (
                          'เลือกช่วงวันที่'
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        mode="range"
                        selected={dateRange}
                        onSelect={setDateRange}
                        numberOfMonths={2}
                        locale={th}
                      />
                    </PopoverContent>
                  </Popover>
                )}

                {dateRangeType !== 'custom' && (
                  <div className="text-sm text-slate-600 px-2">
                    {format(dateRange.from, 'd MMM', { locale: th })} - {format(dateRange.to, 'd MMM yyyy', { locale: th })}
                  </div>
                )}
              </div>
            </Card>
          </div>
          
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
            <CardContent className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  placeholder="ค้นหาค่าใช้จ่าย (หัวข้อ, รายละเอียด...)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-10"
                />
                {searchQuery && (
                  <Button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ✅ Expense List with pagination */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {paginatedExpenses.map((expense) => {
                const Icon = getCategoryIcon(expense.category);

                return (
                  <motion.div
                    key={expense.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    layout // Enables layout animations
                  >
                    <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg hover:shadow-xl transition-all">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0">
                                <Icon className="w-6 h-6 text-white" />
                              </div>
                              <div>
                                <h3 className="text-xl font-bold text-slate-800">{expense.title}</h3>
                                <p className="text-sm text-slate-500">
                                  {expense.date ? format(parseISO(expense.date), 'd MMMM yyyy', { locale: th }) : 'ไม่มีวันที่'}
                                </p>
                                <Badge className={getCategoryColor(expense.category)}>
                                  {getCategoryLabel(expense.category)}
                                </Badge>
                              </div>
                            </div>

                            {expense.description && (
                              <p className="text-slate-600 mb-3 text-sm line-clamp-2">{expense.description}</p>
                            )}

                            {expense.receipt_image && (
                              <div className="mt-2">
                                <button
                                  type="button"
                                  onClick={() => setSlipPreview({ open: true, url: expense.receipt_image })}
                                  className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  <Receipt className="w-4 h-4" />
                                  ดูใบเสร็จ/รูปภาพ
                                </button>
                              </div>
                            )}

                            <div className="flex items-center justify-between mt-4 pt-4 border-t">
                              <span className="text-lg font-semibold text-slate-800">จำนวนเงิน:</span>
                              <span className="text-2xl font-bold text-red-600">
                                {expense.amount.toLocaleString()} ฿
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-end gap-2">
                            {canEdit && (
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handleEdit(expense)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="outline"
                                size="icon"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm('คุณแน่ใจว่าต้องการลบค่าใช้จ่ายนี้?')) {
                                    deleteMutation.mutate(expense);
                                  }
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            {paginatedExpenses.length === 0 && (
              <Card className="col-span-full bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
                <CardContent className="p-12 text-center">
                  <Receipt className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-500 text-lg">ไม่มีข้อมูลค่าใช้จ่ายในช่วงเวลานี้ หรือไม่ตรงกับคำค้นหา</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* ✅ Pagination */}
          {filteredExpenses.length > itemsPerPage && (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 shadow-lg">
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <p className="text-sm text-slate-600">
                    แสดง {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, filteredExpenses.length)} จาก {filteredExpenses.length} รายการ
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      ← ก่อนหน้า
                    </Button>
                    <span className="px-3 py-2 text-sm">
                      {currentPage} / {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      ถัดไป →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Slip Preview Dialog */}
          <SlipPreviewDialog
            open={slipPreview.open}
            onOpenChange={(open) => setSlipPreview({ ...slipPreview, open })}
            slipUrl={slipPreview.url}
            title="ใบเสร็จ/รูปภาพค่าใช้จ่าย"
          />

          {/* Form Dialog */}
          <Dialog open={showDialog} onOpenChange={setShowDialog}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingExpense ? 'แก้ไขค่าใช้จ่าย' : 'บันทึกค่าใช้จ่าย'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>หัวข้อค่าใช้จ่าย *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="เช่น ค่าไฟประจำเดือน"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>จำนวนเงิน (บาท) *</Label>
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>ประเภท *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="electricity">ค่าไฟ</SelectItem>
                        <SelectItem value="water">ค่าน้ำ</SelectItem>
                        <SelectItem value="repair">ค่าซ่อมแซม</SelectItem>
                        <SelectItem value="internet">ค่าอินเทอร์เน็ต</SelectItem>
                        <SelectItem value="salary">เงินเดือน</SelectItem>
                        <SelectItem value="supplies">วัสดุสิ้นเปลือง</SelectItem>
                        <SelectItem value="other">อื่นๆ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>วันที่จ่าย *</Label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <Label>รายละเอียด</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    placeholder="รายละเอียดเพิ่มเติม..."
                  />
                </div>

                <div>
                  <Label>รูปใบเสร็จ</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="mt-2"
                  />
                  {formData.receipt_image && (
                    <img
                      src={formData.receipt_image}
                      alt="ใบเสร็จ"
                      className="mt-2 w-full max-w-xs h-48 object-cover rounded-lg"
                    />
                  )}
                </div>

                <div>
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    className="bg-gradient-to-r from-red-600 to-orange-600"
                    disabled={editingExpense ? !canEdit : !canAdd}
                  >
                    {editingExpense ? 'อัปเดต' : 'บันทึก'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}