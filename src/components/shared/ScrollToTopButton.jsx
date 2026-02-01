import React, { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 500) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  if (!isVisible) return null;

  return (
    <Button
      onClick={scrollToTop}
      className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-blue-600 hover:bg-blue-700 text-white shadow-2xl rounded-full w-12 h-12 p-0 flex items-center justify-center animate-in fade-in slide-in-from-top-5"
    >
      <ArrowUp className="w-5 h-5" />
    </Button>
  );
}