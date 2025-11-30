import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Sparkles, 
  Building2, 
  Users, 
  Home, 
  FileText, 
  Settings, 
  CreditCard,
  CheckCircle2,
  ArrowRight,
  X,
  MessageCircle,
  SkipForward
} from "lucide-react";

const TUTORIAL_STEPS = [
  {
    id: 1,
    title: "🎉 ยินดีต้อนรับสู่ระบบจัดการหอพัก!",
    description: "คลิกปุ่ม 'เริ่มใช้งาน' เพื่อเริ่มต้นการตั้งค่าระบบของคุณค่ะ",
    page: "BranchSelection",
    target: null,
    action: "start",
    checklistKey: null
  },
  {
    id: 2,
    title: "สร้างห้องพักแรกของคุณ 🏠",
    description: "มาเริ่มต้นด้วยการสร้างห้องพักแรกกันเถอะ จะได้มีห้องให้ผู้เช่าอยู่นะคะ",
    page: "Rooms",
    target: "add-room-button",
    action: "create_room",
    checklistKey: "add_room"
  },
  {
    id: 3,
    title: "เพิ่มผู้เช่าคนแรก 👤",
    description: "ลองสร้างผู้เช่าคนแรกด้วยเบอร์โทรของคุณเองค่ะ",
    page: "Tenants",
    target: "add-tenant-button",
    action: "create_tenant",
    checklistKey: "create_tenant"
  },
  {
    id: 4,
    title: "ส่งเบอร์ไปที่ LINE Official Account 💬",
    description: "Add LINE Official Account ของเรา แล้วส่งเบอร์โทรของคุณไปเพื่อเชื่อมต่อกับระบบแจ้งเตือนค่ะ",
    page: "Tenants",
    target: null,
    action: "connect_line",
    checklistKey: "connect_line",
    extraInfo: "Add LINE: https://lin.ee/clp8ckus"
  },
  {
    id: 5,
    title: "สร้างบิลและทดสอบส่ง 💳",
    description: "สร้างบิลแรกและลองส่งใบแจ้งหนี้ผ่าน LINE เพื่อทดสอบระบบกันค่ะ",
    page: "Payments",
    target: "create-payment-button",
    action: "create_bill",
    checklistKey: "create_bill"
  },
  {
    id: 6,
    title: "ตั้งค่าระบบข้อมูลของคุณ ⚙️",
    description: "มาตั้งค่าข้อมูลหอพัก อัตราค่าน้ำค่าไฟ และรายละเอียดต่างๆ ให้เหมาะกับหอของคุณกันค่ะ",
    page: "Settings",
    target: null,
    action: "setup_settings",
    checklistKey: "setup_settings"
  },
  {
    id: 7,
    title: "🎉 ยินดีด้วยค่ะ! คุณเซ็ตอัพเสร็จแล้ว",
    description: "ระบบของเรายังมีฟีเจอร์สุดเจ๋งอีกเพียบเลยค่ะ เช่น การแจ้งเตือนอัตโนมัติ รายงานการเงิน และ AI ที่จะช่วยคุณได้อีกมากมาย ✨ ขอให้มีความสุขกับการจัดการหอพักนะคะ! 💖",
    page: "Dashboard",
    target: null,
    action: "complete",
    checklistKey: null
  }
];

export default function OnboardingTutorial({ currentUser, onComplete, onSkip }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPageName = location.pathname.split('/').pop() || 'Dashboard';
  
  const [currentStep, setCurrentStep] = useState(currentUser?.onboarding_current_step || 1);
  const [highlightedElement, setHighlightedElement] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSearchingElement, setIsSearchingElement] = useState(false);
  const [lastCardPosition, setLastCardPosition] = useState(null);

  const currentStepData = TUTORIAL_STEPS.find(s => s.id === currentStep);
  const progress = ((currentStep - 1) / (TUTORIAL_STEPS.length - 1)) * 100;

  // ตรวจจับว่ามี dialog เปิดอยู่หรือไม่
  useEffect(() => {
    const checkForDialog = () => {
      const dialog = document.querySelector('[role="dialog"]');
      setIsDialogOpen(!!dialog);
    };

    checkForDialog();
    const observer = new MutationObserver(checkForDialog);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (currentStepData?.target) {
      setIsSearchingElement(true);
      let retryCount = 0;
      const maxRetries = 5;
      
      const findElement = () => {
        const element = document.querySelector(`[data-onboarding="${currentStepData.target}"]`);
        console.log('🎯 Onboarding Debug (attempt', retryCount + 1, '):', {
          step: currentStep,
          target: currentStepData.target,
          elementFound: !!element,
          currentPath: location.pathname,
          currentPageName
        });
        
        if (element) {
          setHighlightedElement(element);
          setIsSearchingElement(false);
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // เพิ่ม z-index ให้ element เพื่อให้กดได้
          element.style.position = 'relative';
          element.style.zIndex = '10000';
          return true;
        } else if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(findElement, 300);
          return false;
        } else {
          console.warn('⚠️ Element not found after', maxRetries, 'attempts for target:', currentStepData.target);
          setIsSearchingElement(false);
          return false;
        }
      };
      
      const initialTimer = setTimeout(findElement, 800);
      
      return () => {
        clearTimeout(initialTimer);
        setIsSearchingElement(false);
        // คืนค่าเดิมเมื่อเปลี่ยน step
        const prevElement = document.querySelector(`[data-onboarding="${currentStepData.target}"]`);
        if (prevElement) {
          prevElement.style.position = '';
          prevElement.style.zIndex = '';
        }
      };
    } else {
      setHighlightedElement(null);
      setIsSearchingElement(false);
    }
  }, [currentStepData, location.pathname, currentStep, currentPageName]);

  const updateUserProgress = async (step, checklist = {}) => {
    try {
      await base44.auth.updateMe({
        onboarding_current_step: step,
        onboarding_completed_checklist: {
          ...currentUser?.onboarding_completed_checklist,
          ...checklist
        }
      });
    } catch (error) {
      console.error('Error updating onboarding progress:', error);
    }
  };

  const handleNext = async () => {
    // จำตำแหน่ง card ปัจจุบันก่อนเปลี่ยน
    if (!currentStepData.target) {
      // ถ้าไม่มี target (เช่น step 1) ใช้มุมล่างขวา
      setLastCardPosition({ bottom: '8px', right: '24px' });
    } else {
      setLastCardPosition(getTooltipPosition());
    }
    
    setIsTransitioning(true);
    setHighlightedElement(null);
    
    const nextStep = currentStep + 1;
    const nextStepData = TUTORIAL_STEPS.find(s => s.id === nextStep);

    // Update checklist if current step has one
    if (currentStepData?.checklistKey) {
      await updateUserProgress(nextStep, {
        [currentStepData.checklistKey]: true
      });
    } else {
      await updateUserProgress(nextStep);
    }

    // Navigate to next page if needed
    if (nextStepData && nextStepData.page !== currentPageName) {
      navigate(createPageUrl(nextStepData.page));
      // รอให้หน้าโหลดเสร็จก่อน
      setTimeout(() => {
        setCurrentStep(nextStep);
        setIsTransitioning(false);
      }, 1200);
    } else {
      setTimeout(() => {
        setCurrentStep(nextStep);
        setIsTransitioning(false);
      }, 300);
    }
  };

  const handleSkip = () => {
    // ปิดชั่วคราวเท่านั้น ไม่ลบข้อมูลขั้นตอน
    if (onSkip) onSkip();
  };

  const handleComplete = async () => {
    await base44.auth.updateMe({
      onboarding_mode_enabled: false,
      onboarding_current_step: TUTORIAL_STEPS.length,
      onboarding_completed_checklist: {
        setup_branch: true,
        create_tenant_and_line: true,
        add_room: true,
        create_contract: true,
        setup_branch_settings: true,
        create_bill: true,
        test_send_invoice: true
      }
    });
    if (onComplete) onComplete();
  };

  if (!currentStepData) return null;

  // ซ่อน tutorial เมื่อมี dialog เปิด
  if (isDialogOpen) return null;

  // Calculate position for tooltip
  const getTooltipPosition = () => {
    // ถ้ากำลัง transition และมีตำแหน่งเก่า ให้ใช้ตำแหน่งเก่า (อยู่กับที่)
    if (isTransitioning && lastCardPosition) {
      return lastCardPosition;
    }

    if (!highlightedElement) return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

    const rect = highlightedElement.getBoundingClientRect();
    const isMobile = window.innerWidth < 768;
    const tooltipWidth = isMobile ? Math.min(window.innerWidth - 32, 400) : 400;
    const tooltipHeight = isMobile ? 280 : 250;

    // On mobile, show at bottom center
    if (isMobile) {
      return { 
        bottom: '16px', 
        left: '16px', 
        right: '16px',
        width: 'auto'
      };
    }

    let top = rect.bottom + 20;
    let left = rect.left + (rect.width / 2) - (tooltipWidth / 2);

    // Adjust if tooltip goes off screen
    if (left + tooltipWidth > window.innerWidth) {
      left = window.innerWidth - tooltipWidth - 20;
    }
    if (left < 20) {
      left = 20;
    }
    if (top + tooltipHeight > window.innerHeight) {
      top = rect.top - tooltipHeight - 20;
    }

    return { top: `${top}px`, left: `${left}px` };
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] pointer-events-none">
        {/* Backdrop blur overlay */}
        {highlightedElement ? (
          // Split into 4 parts to create a cutout around the highlighted element
          <>
            {/* Top section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed bg-black/60 backdrop-blur-md z-[9998] pointer-events-none"
              style={{
                top: 0,
                left: 0,
                right: 0,
                height: highlightedElement.getBoundingClientRect().top - 8,
              }}
            />

            {/* Bottom section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed bg-black/60 backdrop-blur-md z-[9998] pointer-events-none"
              style={{
                top: highlightedElement.getBoundingClientRect().bottom + 8,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />

            {/* Left section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed bg-black/60 backdrop-blur-md z-[9998] pointer-events-none"
              style={{
                top: highlightedElement.getBoundingClientRect().top - 8,
                left: 0,
                width: highlightedElement.getBoundingClientRect().left - 8,
                height: highlightedElement.getBoundingClientRect().height + 16,
              }}
            />

            {/* Right section */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed bg-black/60 backdrop-blur-md z-[9998] pointer-events-none"
              style={{
                top: highlightedElement.getBoundingClientRect().top - 8,
                left: highlightedElement.getBoundingClientRect().right + 8,
                right: 0,
                height: highlightedElement.getBoundingClientRect().height + 16,
              }}
            />
          </>
        ) : !currentStepData.target && currentStep === 6 ? (
          // Blur only left sidebar for Settings page (step 6) - desktop only
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="hidden md:block fixed inset-y-0 left-0 w-[240px] bg-black/60 backdrop-blur-md z-[9998] pointer-events-none"
          />
        ) : !currentStepData.target ? (
          // Full screen backdrop when no target element (e.g., step 4)
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9998] pointer-events-none"
          />
        ) : null}

        {/* Floating hand pointer - only when there's a target */}
        {highlightedElement && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ 
                opacity: 1, 
                scale: [1, 1.2, 1],
                y: [0, -15, 0]
              }}
              transition={{
                scale: {
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut"
                },
                y: {
                  duration: 1,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
              className="absolute z-[10001]"
              style={{
                top: highlightedElement.getBoundingClientRect().top - 60,
                left: highlightedElement.getBoundingClientRect().left + highlightedElement.getBoundingClientRect().width / 2 - 30,
                fontSize: '60px'
              }}
            >
              👇
            </motion.div>
            
            {/* Pulsing ring around target */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ 
                opacity: [0.3, 0.8, 0.3],
                scale: [1, 1.05, 1]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="absolute rounded-2xl pointer-events-none"
              style={{
                top: highlightedElement.getBoundingClientRect().top - 12,
                left: highlightedElement.getBoundingClientRect().left - 12,
                width: highlightedElement.getBoundingClientRect().width + 24,
                height: highlightedElement.getBoundingClientRect().height + 24,
                border: '4px solid #3b82f6',
                boxShadow: '0 0 30px rgba(59, 130, 246, 0.6)',
                zIndex: 9999
              }}
            />
          </>
        )}

        {/* Tutorial Card */}
        {(!isSearchingElement || !currentStepData.target || highlightedElement) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: isTransitioning ? 0.7 : 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute z-[10000] pointer-events-auto max-w-[calc(100vw-32px)] mx-4 md:mx-0"
            style={currentStepData.target ? getTooltipPosition() : { bottom: '8px', right: '16px', left: '16px', width: 'auto' }}
          >
            <Card className="w-full md:w-[400px] bg-gradient-to-br from-white via-blue-50 to-purple-50 shadow-2xl border-2 border-blue-200 overflow-hidden">
            {/* Close button */}
            <button
              onClick={handleSkip}
              className="absolute top-2 right-2 md:top-3 md:right-3 p-1.5 md:p-1 hover:bg-white/50 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5 md:w-4 md:h-4 text-slate-600" />
            </button>

            <div className="p-4 md:p-6 space-y-3 md:space-y-4">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs md:text-xs text-slate-600">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 md:w-3 md:h-3 text-yellow-500" />
                    ขั้นตอนที่ {currentStep} จาก {TUTORIAL_STEPS.length}
                  </span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-2 bg-blue-100" />
              </div>

              {/* Content */}
              <div className="space-y-2 md:space-y-3">
                <h3 className="text-lg md:text-xl font-bold text-slate-800 leading-tight">
                  {currentStepData.title}
                </h3>
                <p className="text-sm md:text-sm text-slate-600 leading-relaxed">
                  {currentStepData.description}
                </p>

                {/* Extra info (LINE link, etc.) */}
                {currentStepData.extraInfo && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-2.5 md:p-3 flex items-start gap-2">
                    <MessageCircle className="w-4 h-4 md:w-4 md:h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <div className="text-xs md:text-xs text-green-800">
                      <p className="font-semibold mb-1">เชื่อมต่อ LINE:</p>
                      <a 
                        href={currentStepData.extraInfo.split(': ')[1]} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-green-600 underline break-all hover:text-green-700"
                      >
                        {currentStepData.extraInfo.split(': ')[1]}
                      </a>
                    </div>
                  </div>
                )}


              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  onClick={handleSkip}
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-slate-600 hover:text-slate-800 text-xs md:text-sm h-10 md:h-9"
                >
                  <SkipForward className="w-3.5 h-3.5 md:w-3 md:h-3 mr-1" />
                  ข้ามทั้งหมด
                </Button>

                {currentStep === TUTORIAL_STEPS.length ? (
                  <Button
                    onClick={handleComplete}
                    size="sm"
                    className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg text-sm md:text-sm h-10 md:h-9"
                  >
                    <CheckCircle2 className="w-4 h-4 md:w-4 md:h-4 mr-2" />
                    เสร็จสิ้น
                  </Button>
                ) : currentStepData.action === 'start' ? (
                  <Button
                    onClick={handleNext}
                    size="lg"
                    disabled={isTransitioning}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg text-base md:text-lg font-bold py-5 md:py-6 h-12 md:h-auto"
                  >
                    {isTransitioning ? "กำลังโหลด..." : "เริ่มใช้งาน"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    size="sm"
                    disabled={isTransitioning}
                    className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-lg text-sm md:text-sm h-10 md:h-9"
                  >
                    {isTransitioning ? (
                      "กำลังโหลด..."
                    ) : (
                      <>
                        ถัดไป
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      </div>
    </AnimatePresence>
  );
}