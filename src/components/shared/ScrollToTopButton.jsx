import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(true); // ⭐ แสดงเสมอเพื่อทดสอบ

  useEffect(() => {
    const toggleVisibility = () => {
      // หา scroll container
      const scrollContainer = 
        document.querySelector('main div[class*="overflow-y-auto"]') ||
        document.querySelector('main > div') ||
        document.querySelector('.overflow-y-auto');
      
      const scrollTop = scrollContainer?.scrollTop || window.scrollY || 0;
      
      console.log('🔍 Scroll Debug:', {
        container: scrollContainer?.className,
        scrollTop,
        shouldShow: scrollTop > 100
      });
      
      setIsVisible(scrollTop > 100);
    };

    // ฟัง scroll จากหลายแหล่ง
    window.addEventListener('scroll', toggleVisibility);
    
    const scrollContainer = document.querySelector('main div[class*="overflow-y-auto"]');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', toggleVisibility);
      console.log('✅ Found scroll container:', scrollContainer.className);
    }
    
    toggleVisibility();

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', toggleVisibility);
      }
    };
  }, []);

  const scrollToTop = () => {
    const scrollContainer = document.querySelector('main div[class*="overflow-y-auto"]');
    
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  console.log('🎨 Rendering button, isVisible:', isVisible);

  // ⭐⭐⭐ แสดงปุ่มเสมอเพื่อทดสอบ (ลบ if statement ออก)
  return (
    <div 
      className="fixed bottom-8 right-8 z-[99999]" 
      style={{ 
        pointerEvents: 'auto',
        position: 'fixed',
        zIndex: 99999
      }}
    >
      <Button
        onClick={scrollToTop}
        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-2xl rounded-full w-16 h-16 p-0 flex items-center justify-center transition-all hover:scale-110"
        title="กลับไปด้านบน"
      >
        <ArrowUp className="w-6 h-6 animate-bounce" />
      </Button>
    </div>
  );
}