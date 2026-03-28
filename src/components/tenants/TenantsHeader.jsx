import React from 'react';
import { Users, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function TenantsHeader({
  filteredCount,
  totalCount,
  searchQuery,
  onSearchChange,
  onClearSearch
}) {
  return (
    <div className="relative z-10 bg-white/40 backdrop-blur-2xl border-b border-white/40 shadow-sm sticky top-0">
      <div className="px-4 md:px-8 py-4">
        <div className="flex flex-col gap-4">
          {/* Title & Count */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0 hidden md:block">
                <h1 className="text-xl md:text-2xl font-bold text-slate-800 truncate">ผู้เช่า</h1>
                <p className="text-xs md:text-sm text-slate-600 truncate">
                  แสดง {filteredCount} จาก {totalCount} คน
                </p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="ค้นหาผู้เช่า..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-9 bg-white/60 border-white/40 focus:bg-white"
              />
              {searchQuery && (
                <Button
                  onClick={onClearSearch}
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-6 w-6 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}