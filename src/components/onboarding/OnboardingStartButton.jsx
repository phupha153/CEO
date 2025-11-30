import React from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Play } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { toast } from "sonner";

export default function OnboardingStartButton({ currentUser, onStart }) {
  const [isStarting, setIsStarting] = React.useState(false);

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await base44.auth.updateMe({
        onboarding_mode_enabled: true,
        onboarding_current_step: 1,
        onboarding_completed_checklist: {}
      });
      toast.success('🎉 เริ่มโหมดสอนการใช้งานแล้ว!');
      if (onStart) onStart();
    } catch (error) {
      console.error('Error starting onboarding:', error);
      toast.error('เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsStarting(false);
    }
  };

  if (!currentUser) return null;
  
  const userRole = currentUser.custom_role || (currentUser.role === 'admin' ? 'owner' : 'employee');
  
  // Only show for owner (not developer)
  if (userRole !== 'owner') return null;
  
  // Don't show if tutorial is currently active
  if (currentUser.onboarding_mode_enabled) return null;

  // Check if user has completed tutorial before
  const checklist = currentUser.onboarding_completed_checklist || {};
  const hasCompletedBefore = Object.keys(checklist).length > 0;

  // Show button only if owner hasn't completed tutorial yet
  // Once completed, this button disappears forever
  if (hasCompletedBefore) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <Button
        onClick={handleStart}
        disabled={isStarting}
        className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-2xl h-auto py-4 px-6 rounded-2xl group"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <Sparkles className="w-5 h-5 animate-pulse" />
            <div className="absolute inset-0 bg-white/30 rounded-full blur-md animate-ping" />
          </div>
          <div className="text-left">
            <p className="font-bold text-sm">
              {hasCompletedBefore ? '🔄 ทำโหมดสอนอีกครั้ง' : '✨ เริ่มโหมดสอนการใช้งาน'}
            </p>
            <p className="text-xs opacity-90">สำหรับเจ้าของหอพัก & ผู้พัฒนา</p>
          </div>
          <Play className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </div>
      </Button>
    </motion.div>
  );
}