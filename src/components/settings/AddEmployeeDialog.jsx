import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Loader2, Check, Globe, AlertTriangle, Crown } from "lucide-react";
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
  const [showOwnershipWarning, setShowOwnershipWarning] = useState(false);
  const [transferPackage, setTransferPackage] = useState(true);

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

    // Developer can see all branches
    if (userRole === 'developer') {
      return allBranches;
    }

    const hasAccessibleBranchesSet = userAccessibleBranches !== null && userAccessibleBranches !== undefined;

    // If accessible_branches is explicitly set, use it
    if (hasAccessibleBranchesSet) {
      const accessibleSet = new Set(userAccessibleBranches);
      return allBranches.filter(b => accessibleSet.has(b.id));
    }
    
    // Fallback for owners/managers: show branches they own
    return allBranches.filter(b => 
      b.owner_id === currentUser.email || b.created_by === currentUser.email
    );
  }, [allBranches, currentUser, userRole, userAccessibleBranches]);

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

    // ⭐ ถ้าเลือก role = "owner" → แสดงคำเตือนโอนกรรมสิทธิ์
    if (formData.custom_role === 'owner') {
      setShowOwnershipWarning(true);
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

  const handleConfirmOwnershipTransfer = async () => {
    setShowOwnershipWarning(false);
    setIsSending(true);

    try {
      // เรียก backend function เพื่อโอนกรรมสิทธิ์
      const selectedBranchId = formData.accessible_branches[0]; // ใช้สาขาแรกที่เลือก
      
      const transferResponse = await base44.functions.invoke('transferBranchOwnership', {
        branch_id: selectedBranchId,
        new_owner_email: formData.email,
        transfer_package: transferPackage
      });

      if (transferResponse.data?.error) {
        // ถ้า user ยังไม่มีในระบบ → เชิญก่อน
        if (transferResponse.data?.should_invite || transferResponse.data?.user_not_found) {
          const inviteResponse = await base44.functions.invoke('sendEmployeeToCRM', {
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone,
            custom_role: 'owner',
            accessible_branches: [selectedBranchId]
          });

          if (inviteResponse.data?.error) {
            toast.error('❌ ส่งอีเมลเชิญไม่สำเร็จ: ' + inviteResponse.data.error);
            setIsSending(false);
            return;
          }

          // เชิญสำเร็จ แต่ต้องรอ user accept
          toast.success(
            `📧 ส่งอีเมลเชิญสำเร็จ!\n\n⏳ ${formData.full_name} จะได้รับอีเมลเชิญให้สร้าง account\n✅ เมื่อ user ยืนยันอีเมล กรรมสิทธิ์สาขาจะถูกโอนให้${transferPackage ? '\n📦 และแพ็กเกจจะย้ายไปด้วย' : ''}`,
            { duration: 10000 }
          );

          setFormData({
            full_name: '',
            email: '',
            phone: '',
            custom_role: 'employee',
            accessible_branches: []
          });
          setTransferPackage(true);
          onSuccess?.();
          onClose();
          setIsSending(false);
          return;
        } else {
          toast.error(transferResponse.data.error);
          setIsSending(false);
          return;
        }
      }

      // เช็คว่าเป็น invite ใหม่ หรือ user เก่า
      const wasNewInvite = transferResponse.data?.was_new_invite || inviteResponse?.data?.was_new_invite;

      toast.success(
        `${wasNewInvite ? '📧 ส่งอีเมลเชิญสำเร็จ!\n' : ''}✅ โอนกรรมสิทธิ์สาขาสำเร็จ!\n\n👑 เจ้าของใหม่: ${formData.full_name} (${formData.email})\n${transferPackage ? '📦 แพ็กเกจถูกโอนไปด้วย' : ''}${wasNewInvite ? '\n\n⏳ รอให้ user สร้าง account จากอีเมลเชิญ' : ''}`,
        { duration: 10000 }
      );

      setFormData({
        full_name: '',
        email: '',
        phone: '',
        custom_role: 'employee',
        accessible_branches: []
      });
      setTransferPackage(true);
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error('❌ โอนกรรมสิทธิ์ไม่สำเร็จ: ' + (error.message || 'เกิดข้อผิดพลาด'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
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

    {/* Ownership Transfer Warning */}
    <AlertDialog open={showOwnershipWarning} onOpenChange={setShowOwnershipWarning}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-6 h-6" />
            ⚠️ โอนกรรมสิทธิ์สาขา
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 text-left">
            <div className="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
              <p className="text-sm text-slate-800 font-semibold mb-3">
                คุณกำลังเชิญ <strong className="text-amber-700">{formData.full_name}</strong> เป็น <strong className="text-amber-700">เจ้าของหอพัก</strong>
              </p>
              <div className="space-y-2 text-sm text-slate-700">
                <p>📌 <strong>ผลที่จะเกิดขึ้น:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>สาขา <strong>{branches.find(b => b.id === formData.accessible_branches[0])?.branch_name}</strong> จะถูกโอนให้ {formData.full_name}</li>
                  <li>คุณจะเปลี่ยนเป็น <strong>ผู้จัดการ</strong> (ยังเข้าถึงสาขาได้)</li>
                  <li className="text-amber-700 font-semibold">{formData.full_name} จะเป็นเจ้าของและจัดการทุกอย่างในสาขานี้</li>
                </ul>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={transferPackage}
                  onChange={(e) => setTransferPackage(e.target.checked)}
                  className="w-5 h-5 rounded mt-0.5"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-blue-800 flex items-center gap-2">
                    <Crown className="w-4 h-4" />
                    โอนแพ็กเกจไปด้วย
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    {formData.full_name} จะได้รับแพ็กเกจ (Trial/Active) ของคุณ และคุณจะไม่มีแพ็กเกจ (จะต้องซื้อใหม่)
                  </p>
                </div>
              </label>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs text-red-800">
                <strong>⚠️ คำเตือน:</strong> การโอนกรรมสิทธิ์ไม่สามารถย้อนกลับได้ กรุณาตรวจสอบข้อมูลให้ถูกต้อง
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setShowOwnershipWarning(false)}>
            ยกเลิก
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmOwnershipTransfer}
            disabled={isSending}
            className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังโอน...
              </>
            ) : (
              <>
                <Crown className="w-4 h-4 mr-2" />
                ยืนยันโอนกรรมสิทธิ์
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
}