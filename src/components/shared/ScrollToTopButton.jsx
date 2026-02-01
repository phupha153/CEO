import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // ตรวจจับ scroll จากทั้ง window และ scroll containers
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const mainContent = document.querySelector('main.flex-1');
      const mainScroll = mainContent?.scrollTop || 0;
      
      if (scrollY > 200 || mainScroll > 200) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    // ฟัง scroll จากทั้ง window และ main content
    window.addEventListener('scroll', toggleVisibility);
    
    const mainContent = document.querySelector('main.flex-1');
    if (mainContent) {
      mainContent.addEventListener('scroll', toggleVisibility);
    }
    
    // เช็คทันทีตอน mount
    toggleVisibility();

    return () => {
      window.removeEventListener('scroll', toggleVisibility);
      if (mainContent) {
        mainContent.removeEventListener('scroll', toggleVisibility);
      }
    };
  }, []);

  const scrollToTop = () => {
    // Scroll ทั้ง window และ main content
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
    
    const mainContent = document.querySelector('main.flex-1');
    if (mainContent) {
      mainContent.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  if (!isVisible) return null;

  return (
    <Button
      onClick={scrollToTop}
      className="fixed bottom-8 right-8 z-[9999] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-2xl hover:shadow-3xl rounded-full w-16 h-16 p-0 flex items-center justify-center transition-all duration-300 hover:scale-110"
      title="กลับไปด้านบน"
    >
      <ArrowUp className="w-6 h-6 animate-bounce" />
    </Button>
  );
}