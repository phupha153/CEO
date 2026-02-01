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
      
      setIsVisible(scrollTop > 100);
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
    <Button
      onClick={scrollToTop}
      className="fixed bottom-8 right-8 z-[99999] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-2xl hover:shadow-3xl rounded-full w-16 h-16 p-0 flex items-center justify-center transition-all duration-300 hover:scale-110 pointer-events-auto"
      style={{ display: isVisible ? 'flex' : 'none' }}
      title="กลับไปด้านบน"
    >
      <ArrowUp className="w-6 h-6 animate-bounce" />
    </Button>
  );
}