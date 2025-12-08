import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import HeroSection from "../components/welcome/HeroSection";
import HowItWorksSection from "../components/welcome/HowItWorksSection";
import FeaturesShowcase from "../components/welcome/FeaturesShowcase";
import TestimonialsSection from "../components/welcome/TestimonialsSection";

export default function Welcome() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [buildingName, setBuildingName] = useState('หลังหอพัก');
  const [buildingLogo, setBuildingLogo] = useState('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/41d4e63e1_DC4395DB-4B27-4859-85B3-4F2948654F9E.png');

  useEffect(() => {
    base44.auth.isAuthenticated()
      .then(authed => setIsAuthenticated(authed))
      .catch(() => setIsAuthenticated(false));

    base44.entities.Config.list()
      .then(configs => {
        const logoConfig = configs.find(c => c.key === 'building_logo' && !c.branch_id);
        const nameConfig = configs.find(c => c.key === 'building_name' && !c.branch_id);
        if (logoConfig?.value) setBuildingLogo(logoConfig.value);
        if (nameConfig?.value) setBuildingName(nameConfig.value);
      })
      .catch(() => {});
  }, []);

  const handleCta = () => {
    if (isAuthenticated) {
      navigate(createPageUrl('Dashboard'));
    } else {
      base44.auth.redirectToLogin(window.location.origin);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="border-b bg-white/95 backdrop-blur-lg sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={buildingLogo} 
              alt="หลังหอพัก" 
              className="w-10 h-10 object-contain"
              onError={(e) => e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/41d4e63e1_DC4395DB-4B27-4859-85B3-4F2948654F9E.png'}
            />
            <span className="text-2xl font-bold text-slate-900">{buildingName}</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-slate-600 hover:text-slate-900 transition-colors font-medium">
              วิธีใช้งาน
            </a>
            <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors font-medium">
              คุณสมบัติ
            </a>
            <a href="#testimonials" className="text-slate-600 hover:text-slate-900 transition-colors font-medium">
              รีวิว
            </a>
            <a href="#contact" className="text-slate-600 hover:text-slate-900 transition-colors font-medium">
              ติดต่อ
            </a>
          </div>
          
          <div className="flex items-center gap-3">
            {isAuthenticated && (
              <Button
                variant="ghost"
                onClick={() => navigate(createPageUrl('Dashboard'))}
                className="text-slate-700 hover:text-slate-900"
              >
                แดชบอร์ด
              </Button>
            )}
            <Button
              onClick={handleCta}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6"
            >
              {isAuthenticated ? 'เข้าสู่ระบบ' : 'ทดลองใช้ฟรี'}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <HeroSection 
        isAuthenticated={isAuthenticated}
        onCtaClick={handleCta}
        buildingLogo={buildingLogo}
      />

      {/* How It Works */}
      <div id="how-it-works">
        <HowItWorksSection />
      </div>

      {/* Features Showcase */}
      <div id="features">
        <FeaturesShowcase />
      </div>

      {/* Testimonials */}
      <div id="testimonials">
        <TestimonialsSection />
      </div>

      {/* CTA Section */}
      <section id="contact" className="relative py-24 bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative z-10 max-w-4xl mx-auto px-4 text-center"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            พร้อมที่จะเริ่มต้นแล้วหรือยัง?
          </h2>
          <p className="text-xl text-blue-100 mb-10 leading-relaxed">
            ทดลองใช้งานฟรี 14 วัน ไม่ต้องใช้บัตรเครดิต<br />
            เริ่มจัดการหอพักอย่างมืออาชีพได้ทันที
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={handleCta}
              className="bg-white text-blue-600 hover:bg-blue-50 shadow-2xl px-12 py-7 text-lg rounded-xl font-bold"
            >
              {isAuthenticated ? 'ไปที่แดชบอร์ด' : 'เริ่มทดลองใช้งานฟรี'}
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <img 
                src={buildingLogo} 
                alt="หลังหอพัก" 
                className="w-10 h-10 object-contain"
                onError={(e) => e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/41d4e63e1_DC4395DB-4B27-4859-85B3-4F2948654F9E.png'}
              />
              <span className="text-xl font-bold text-white">{buildingName}</span>
            </div>
            
            <div className="flex gap-8 text-sm text-slate-400">
              <a href="#how-it-works" className="hover:text-white transition-colors">วิธีใช้งาน</a>
              <a href="#features" className="hover:text-white transition-colors">คุณสมบัติ</a>
              <a href="#testimonials" className="hover:text-white transition-colors">รีวิว</a>
              <a href="#contact" className="hover:text-white transition-colors">ติดต่อ</a>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-slate-800 text-center text-slate-400 text-sm">
            © {new Date().getFullYear()} หลังหอพัก - ระบบจัดการหอพักครบวงจร. สงวนลิขสิทธิ์.
          </div>
        </div>
      </footer>
    </div>
  );
}