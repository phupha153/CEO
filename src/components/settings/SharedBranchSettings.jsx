import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";

export default function SharedBranchSettings({ selectedBranch, branches }) {
  const queryClient = useQueryClient();
  const [sharedUnlinkedBranches, setSharedUnlinkedBranches] = useState([]);

  // Fetch configs just for this component to keep it isolated
  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['sharedBranchConfigs', selectedBranch?.id],
    queryFn: async () => {
      if (!selectedBranch?.id) return [];
      return await base44.entities.Config.filter({ 
        key: 'shared_unlinked_branches', 
        branch_id: selectedBranch.id 
      });
    },
    enabled: !!selectedBranch?.id,
  });

  useEffect(() => {
    if (configs && configs.length > 0 && configs[0].value) {
      setSharedUnlinkedBranches(configs[0].value.split(',').map(id => id.trim()));
    } else {
      setSharedUnlinkedBranches([]);
    }
  }, [configs]);

  const toggleBranch = async (branchId) => {
    const isCurrentlyChecked = sharedUnlinkedBranches.includes(branchId);
    let newShared = [...sharedUnlinkedBranches];
    
    if (isCurrentlyChecked) {
      newShared = newShared.filter(id => id !== branchId);
    } else {
      newShared.push(branchId);
    }
    
    setSharedUnlinkedBranches(newShared);
    const val = newShared.join(',');

    try {
      if (configs.length > 0) {
        if (val) {
          await base44.entities.Config.update(configs[0].id, { value: val });
        } else {
          await base44.entities.Config.delete(configs[0].id);
        }
      } else if (val) {
        await base44.entities.Config.create({ 
          key: 'shared_unlinked_branches', 
          branch_id: selectedBranch?.id, 
          value: val, 
          category: 'notification',
          description: 'แชร์ข้อความแชทคนแปลกหน้าจากสาขาอื่นมาที่สาขานี้'
        });
      }
      await queryClient.invalidateQueries(['sharedBranchConfigs']);
      await queryClient.invalidateQueries(['configs']); // Also invalidate global configs query
      toast.success('บันทึกการแชร์สาขาสำเร็จ');
    } catch (err) {
      console.error(err);
      toast.error('บันทึกไม่สำเร็จ');
      // Revert state on error
      setSharedUnlinkedBranches(isCurrentlyChecked ? [...newShared, branchId] : newShared.filter(id => id !== branchId));
    }
  };

  const otherBranches = branches.filter(b => b.id !== selectedBranch?.id);

  if (!selectedBranch) return null;

  return (
    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-5 border border-purple-100 shadow-sm relative overflow-hidden mt-6">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-100 rounded-full opacity-50 blur-xl"/>
      <div className="flex items-start gap-4 relative z-10">
        <div className="bg-purple-100 p-3 rounded-full flex-shrink-0 mt-1 shadow-sm border border-purple-200">
          <Users className="w-6 h-6 text-purple-600"/>
        </div>
        <div className="flex-1">
          <h4 className="text-lg font-bold text-purple-900 mb-2">แชร์แชทคนแปลกหน้าข้ามสาขา (Shared Chats)</h4>
          <div className="bg-white/60 rounded-lg p-3 border border-purple-100 mb-4">
            <p className="text-sm text-purple-800 leading-relaxed">
              เลือกสาขาที่คุณต้องการดึงข้อความแชทของ <b>"ผู้เช่าที่ยังไม่ผูกห้อง"</b> มาแสดงในสาขานี้ด้วย<br/>
              (มีประโยชน์เมื่อคุณใช้ LINE OA ตัวเดียวกับหลายสาขา และต้องการให้แอดมินสาขานี้ช่วยตอบแชทลูกค้าใหม่ของสาขาอื่น)
            </p>
          </div>
          
          <div className="space-y-2 max-h-48 overflow-y-auto bg-white/80 rounded-lg border border-purple-200 p-3">
            {isLoading ? (
              <p className="text-sm text-slate-500 text-center py-2">กำลังโหลด...</p>
            ) : otherBranches.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-2">คุณไม่มีสาขาอื่น</p>
            ) : (
              otherBranches.map(b => (
                <label key={b.id} className="flex items-center gap-3 p-2 hover:bg-purple-50 rounded-md cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={sharedUnlinkedBranches.includes(b.id)}
                    onChange={() => toggleBranch(b.id)}
                    className="w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-slate-700">{b.branch_name}</span>
                </label>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}