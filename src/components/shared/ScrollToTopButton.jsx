import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      // ✅ หา scroll container จริงๆ (main content ใน Layout)
      const mainContent = document.querySelector('main.flex-1 > div');
      const scrollTop = mainContent?.scrollTop || 0;
      
      setIsVisible(scrollTop > 200);
    };

    // ฟัง scroll จาก main content container
    const mainContent = document.querySelector('main.flex-1 > div');
    
    if (mainContent) {
      mainContent.addEventListener('scroll', toggleVisibility);
      toggleVisibility(); // Check immediately
    }

    return () => {
      if (mainContent) {
        mainContent.removeEventListener('scroll', toggleVisibility);
      }
    };
  }, []);

  const scrollToTop = () => {
    const mainContent = document.querySelector('main.flex-1 > div');
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