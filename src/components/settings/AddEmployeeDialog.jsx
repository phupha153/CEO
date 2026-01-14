import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, Check, Globe } from "lucide-react";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

export default function AddEmployeeDialog({ isOpen, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    custom_role: 'employee',
    accessible_branches: []
  });
  const [isSending, setIsSending] = useState(false);

  // ดึงข้อมูลสาขาที่มีในระบบ
  const { data: allBranches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: () => base44.entities.Branch.list(),
    enabled: isOpen,
  });

  // ดึงข้อมูล user ปัจจุบันเพื่อกรองสาขา
  const { data: currentUser } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
    enabled: isOpen,
  });

  // ⭐ เช็คจำนวนผู้ใช้สูงสุดตามแพ็กเกจ
  const { data: branchPackages = [] } = useQuery({
    queryKey: ['branchPackages'],
    queryFn: () => base44.entities.BranchPackage.list('-created_date', 200),
    enabled: isOpen && !!currentUser,
  });

  const { data: packageFeatureConfigs = [] } = useQuery({
    queryKey: ['packageFeatureConfigs'],
    queryFn: () => base44.entities.PackageFeatureConfig.list(),
    enabled: isOpen && !!currentUser,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: isOpen && !!currentUser,
  });

  const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'owner' : 'employee');
  const userAccessibleBranches = currentUser?.accessible_branches;

  // กรองสาขาที่แสดงให้เลือก: ถ้าเป็น developer หรือไม่ set accessible_branches = เห็นทุกสาขา
  const branches = React.useMemo(() => {
    if (!currentUser) return [];
    const userRole = currentUser?.custom_role || (currentUser?.role === 'admin' ? 'developer' : 'employee');

    // Developer sees all branches
    if (userRole === 'developer') {
        return allBranches;
    }

    const myAccessibleBranches = currentUser?.accessible_branches;

    // If user has an explicit list of accessible branches, use that list.
    if (myAccessibleBranches !== null && myAccessibleBranches !== undefined) {
      return allBranches.filter(b => myAccessibleBranches.includes(b.id));
    }
    
    // Fallback for owners: If no explicit list, show branches they own by email.
    return allBranches.filter(b => b.owner_id === currentUser.email || b.created_by === currentUser.email);

  }, [allBranches, currentUser]);

  const toggleBranchAccess = (branchId) => {
    setFormData(prev => {
      const currentBranches = prev.accessible_branches || [];
      const hasBranch = currentBranches.includes(branchId);
      const newBranches = hasBranch
        ? currentBranches.filter(b => b !== branchId)
        : [...currentBranches, branchId];
      return { ...prev, accessible_branches: newBranches };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // ⭐ ตรวจสอบว่าเลือกสาขาอย่างน้อย 1 สาขา
    if (!formData.accessible_branches || formData.accessible_branches.length === 0) {
      toast.error('กรุณาเลือกอย่างน้อย 1 สาขาที่พนักงานสามารถเข้าถึงได้');
      return;
    }

    setIsSending(true);

    try {
      // ✅ Backend จะ validate limits - ไม่ต้องเช็คที่ frontend (ป้องกัน bypass)
      const response = await base44.functions.invoke('sendEmployeeToCRM', formData);
      
      // ⭐ เช็ค response ว่ามี error หรือไม่
      if (response.data?.error) {
        toast.error(response.data.error);
        setIsSending(false);
        return;
      }
      
      toast.success(
        `✅ เพิ่มพนักงาน ${formData.full_name} สำเร็จ!\n\n📧 ระบบได้ส่งอีเมลเชิญเข้าใช้งานไปที่ ${formData.email} แล้ว\n🏢 สามารถเข้าถึง ${formData.accessible_branches.length} สาขา`,
        { duration: 6000 }
      );
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        custom_role: 'employee',
        accessible_branches: []
      });
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('❌ เพิ่มพนักงานไม่สำเร็จ: ' + (error.message || 'ไม่สามารถส่งข้อมูลได้'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            เพิ่มพนักงานใหม่
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>ชื่อ-นามสกุล *</Label>
            <Input
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              placeholder="นายสมชาย ใจดี"
              required
            />
          </div>

          <div>
            <Label>อีเมล *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@example.com"
              required
            />
          </div>

          <div>
            <Label>เบอร์โทรศัพท์</Label>
            <Input
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="0812345678"
            />
          </div>

          <div>
            <Label>บทบาท</Label>
            <Select value={formData.custom_role} onValueChange={(value) => setFormData({ ...formData, custom_role: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">👑 เจ้าของหอพัก</SelectItem>
                <SelectItem value="manager">👔 ผู้จัดการ</SelectItem>
                <SelectItem value="employee">👤 พนักงาน</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* เลือกสาขาที่เข้าถึงได้ */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-600" />
              <Label className="font-semibold">สาขาที่เข้าถึงได้ *</Label>
            </div>

            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200 mb-2">
              <p className="text-xs text-blue-800">
                <strong>เลือกแล้ว:</strong> {formData.accessible_branches.length} สาขา
              </p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-2">
              {branches.length > 0 ? (
                branches.map(branch => {
                  const isChecked = formData.accessible_branches.includes(branch.id);
                  return (
                    <label
                      key={branch.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border ${
                        isChecked ? 'bg-blue-50 border-blue-300' : 'hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleBranchAccess(branch.id)}
                        className="w-4 h-4 rounded"
                      />
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${isChecked ? 'text-blue-700' : 'text-slate-800'}`}>
                          {branch.branch_name}
                        </p>
                        {branch.branch_code && (
                          <p className="text-xs text-slate-500">{branch.branch_code}</p>
                        )}
                      </div>
                      {isChecked && <Check className="w-4 h-4 text-blue-600" />}
                    </label>
                  );
                })
              ) : (
                <div className="text-center py-4 text-slate-500 text-sm">
                  ไม่พบสาขาในระบบ
                </div>
              )}
            </div>
          </div>

          <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
            <p className="text-xs text-amber-800">
              <strong>⚠️ สำคัญ:</strong> กรุณาเลือกอย่างน้อย 1 สาขาที่พนักงานคนนี้สามารถเข้าถึงและจัดการได้
            </p>
          </div>

          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-xs text-blue-700">
              💡 ข้อมูลจะถูกส่งไปยังระบบ CRM และพนักงานจะได้รับอีเมลเชิญเข้าใช้งานระบบ
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isSending} className="bg-gradient-to-r from-blue-600 to-indigo-600">
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  กำลังส่ง...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  เพิ่มพนักงาน
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}