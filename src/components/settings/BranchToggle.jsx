import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Globe } from 'lucide-react';

export const BranchToggle = ({ applyToAllBranches, setApplyToAllBranches, selectedBranch, canSetGlobalConfig }) => {
  if (!canSetGlobalConfig || !selectedBranch) return null;

  return (
    <div className="flex items-center justify-between gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Globe className={`w-5 h-5 flex-shrink-0 ${applyToAllBranches ? 'text-blue-600' : 'text-slate-500'}`} />
        <div className="text-sm flex-1 min-w-0">
          <p className={`font-semibold ${applyToAllBranches ? 'text-blue-700' : 'text-slate-700'}`}>
            {applyToAllBranches ? 'ใช้กับทุกสาขาที่คุณดูแล' : `เฉพาะ ${selectedBranch.name}`}
          </p>
          <p className="text-xs text-slate-600 break-words">
            {applyToAllBranches ? 'การตั้งค่าจะมีผลกับทุกสาขาที่คุณมีสิทธิ์เข้าถึง' : 'การตั้งค่าจะมีผลเฉพาะสาขานี้'}
          </p>
        </div>
      </div>
      <Switch
        checked={applyToAllBranches}
        onCheckedChange={setApplyToAllBranches}
        className="data-[state=checked]:bg-blue-600 flex-shrink-0"
      />
    </div>
  );
};