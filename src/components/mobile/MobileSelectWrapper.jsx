import React, { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * MobileSelectWrapper: Shows Select normally on desktop, Drawer on mobile
 * 
 * Usage:
 * <MobileSelectWrapper
 *   value={status}
 *   onValueChange={setStatus}
 *   placeholder="Select status"
 *   label="Status"
 *   items={[{ value: 'active', label: 'Active' }]}
 * />
 */
export default function MobileSelectWrapper({
  value,
  onValueChange,
  placeholder = "Select an option",
  label = "Choose",
  items = [],
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  const selectedItem = items.find((item) => item.value === value);
  const displayLabel = selectedItem?.label || placeholder;

  // Desktop: Use normal Select
  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Mobile: Use Drawer
  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 justify-between items-center ${className}`}
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {displayLabel}
        </span>
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>

      <Drawer open={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{label}</DrawerTitle>
          </DrawerHeader>
          <ScrollArea className="h-72 w-full">
            <div className="flex flex-col p-4 gap-2">
              {items.map((item) => (
                <button
                  key={item.value}
                  onClick={() => {
                    onValueChange(item.value);
                    setIsOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                    value === item.value
                      ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold"
                      : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                >
                  {item.label}
                  {value === item.value && (
                    <svg
                      className="w-5 h-5 ml-auto"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          </ScrollArea>
        </DrawerContent>
      </Drawer>
    </>
  );
}