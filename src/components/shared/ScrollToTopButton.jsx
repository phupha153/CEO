import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // ✅ หา scroll container จริงๆ - ลองหลาย selector
      const mainContent = 
        document.querySelector('main.flex-1 > div.overflow-y-auto') ||
        document.querySelector('main > div.overflow-y-auto') ||
        document.querySelector('main.flex-1 div[class*="overflow-y-auto"]') ||
        document.querySelector('.overflow-y-auto');
      
      const scrollTop = mainContent?.scrollTop || 0;
      
      console.log('📍 ScrollToTopButton Debug:', {
        found: !!mainContent,
        scrollTop,
        selector: mainContent?.className,
        shouldShow: scrollTop > 100
      });
      
      setIsVisible(scrollTop > 400);
    };

    // ฟัง scroll จาก main content container
    const mainContent = 
      document.querySelector('main.flex-1 > div.overflow-y-auto') ||
      document.querySelector('main > div.overflow-y-auto') ||
      document.querySelector('main.flex-1 div[class*="overflow-y-auto"]') ||
      document.querySelector('.overflow-y-auto');
    
    console.log('🎯 ScrollToTopButton mounted, container:', mainContent?.className);
    
    if (mainContent) {
      mainContent.addEventListener('scroll', toggleVisibility);
      toggleVisibility(); // Check immediately
    } else {
      console.warn('⚠️ ScrollToTopButton: No scroll container found!');
    }

    return () => {
      if (mainContent) {
        mainContent.removeEventListener('scroll', toggleVisibility);
      }
    };
  }, []);

  const scrollToTop = () => {
    const mainContent = 
      document.querySelector('main.flex-1 > div.overflow-y-auto') ||
      document.querySelector('main > div.overflow-y-auto') ||
      document.querySelector('main.flex-1 div[class*="overflow-y-auto"]') ||
      document.querySelector('.overflow-y-auto');
      
    if (mainContent) {
      mainContent.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  // ✅ Debug: แสดงปุ่มเสมอเพื่อทดสอบ
  console.log('🔵 ScrollToTopButton render:', { isVisible });

  return (
    <div
      className="fixed bottom-8 right-8 z-[99999] transition-all duration-500 ease-out pointer-events-auto"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.8)',
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <button
        onClick={scrollToTop}
        className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md border border-white/30 hover:bg-white/30 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
        title="กลับไปด้านบน"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
}