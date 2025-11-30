import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Sparkles, X, Loader2, Square } from "lucide-react";

export default function AISearchBox({ 
  searchQuery, 
  onSearchChange, 
  onAISearch, 
  onStopSearch,
  aiSearching, 
  placeholder = "ค้นหา หรือถามคำถาม AI...",
  disabled = false 
}) {
  return (
    <div className="relative">
      <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
      <Input
        type="text"
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-12 pr-24 h-14 rounded-2xl bg-white border-slate-200 shadow-sm text-base placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && searchQuery.trim() && !disabled && !aiSearching) {
            onAISearch();
          }
        }}
        disabled={disabled}
      />
      <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1 z-10">
        {searchQuery && !disabled && !aiSearching && (
          <Button
            type="button"
            onClick={() => onSearchChange('')}
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-slate-100 rounded-xl"
          >
            <X className="w-4 h-4 text-slate-500" />
          </Button>
        )}
        {aiSearching ? (
          <Button
            onClick={onStopSearch}
            size="icon"
            className="h-10 w-10 bg-gradient-to-br from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-md rounded-xl"
            title="หยุดการค้นหา"
          >
            <Square className="w-5 h-5 text-white fill-white" />
          </Button>
        ) : (
          <Button
            onClick={onAISearch}
            disabled={!searchQuery.trim() || disabled}
            size="icon"
            className="h-10 w-10 bg-gradient-to-br from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 shadow-md rounded-xl disabled:opacity-50"
            title="ถาม AI ผู้ช่วย"
          >
            <Sparkles className="w-5 h-5 text-white" />
          </Button>
        )}
      </div>
    </div>
  );
}