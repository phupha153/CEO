import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Building2, 
  Users, 
  CreditCard, 
  BarChart3, 
  MessageSquare, 
  Shield,
  Check,
  ArrowRight,
  Sparkles,
  Crown,
  Zap,
  Star
} from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Welcome() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [buildingName, setBuildingName] = useState('W RESIDENTS');
  const [buildingLogo, setBuildingLogo] = useState('https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg');

  useEffect(() => {
    // Check authentication
    base44.auth.isAuthenticated()
      .then(authed => {
        setIsAuthenticated(authed);
        // ไม่ redirect ไป Dashboard เพื่อให้ดูหน้า Welcome ได้แม้ล็อกอินแล้ว
      })
      .catch(() => setIsAuthenticated(false));

    // Load config
    base44.entities.Config.list()
      .then(configs => {
        const logoConfig = configs.find(c => c.key === 'building_logo' && !c.branch_id);
        const nameConfig = configs.find(c => c.key === 'building_name' && !c.branch_id);
        if (logoConfig?.value) setBuildingLogo(logoConfig.value);
        if (nameConfig?.value) setBuildingName(nameConfig.value);
      })
      .catch(() => {});
  }, [navigate]);

  const features = [
    {
      icon: Building2,
      title: "จัดการห้องพัก",
      description: "ติดตามสถานะห้อง การจอง และข้อมูลผู้เช่าได้อย่างง่ายดาย"
    },
    {
      icon: CreditCard,
      title: "ระบบการเงินอัตโนมัติ",
      description: "สร้างบิล คำนวณค่าน้ำค่าไฟ และติดตามการชำระเงินอัตโนมัติ"
    },
    {
      icon: MessageSquare,
      title: "แจ้งเตือนอัจฉริยะ",
      description: "ส่งการแจ้งเตือนผ่าน LINE และ Facebook อัตโนมัติ"
    },
    {
      icon: BarChart3,
      title: "รายงานและวิเคราะห์",
      description: "ดูสถิติและรายงานทางการเงินแบบเรียลไทม์"
    },
    {
      icon: Users,
      title: "จัดการผู้เช่า",
      description: "บันทึกข้อมูลผู้เช่า ประวัติการชำระเงิน และประเมินความน่าเชื่อถือ"
    },
    {
      icon: Shield,
      title: "ปลอดภัยและน่าเชื่อถือ",
      description: "ระบบรักษาความปลอดภัยระดับสูง พร้อม backup อัตโนมัติ"
    }
  ];

  const packages = [
    {
      name: "Starter",
      price: 590,
      icon: Zap,
      color: "from-blue-500 to-cyan-500",
      features: [
        "จัดการได้สูงสุด 20 ห้อง",
        "ระบบการเงินพื้นฐาน",
        "แจ้งเตือนผ่าน LINE",
        "รายงานมาตรฐาน"
      ]
    },
    {
      name: "Professional",
      price: 990,
      icon: Star,
      color: "from-purple-500 to-pink-500",
      popular: true,
      features: [
        "จัดการได้สูงสุด 50 ห้อง",
        "ระบบการเงินครบถ้วน",
        "แจ้งเตือน LINE + Facebook",
        "รายงานขั้นสูง",
        "หลายสาขา"
      ]
    },
    {
      name: "Enterprise",
      price: 1990,
      icon: Crown,
      color: "from-amber-500 to-orange-500",
      features: [
        "ไม่จำกัดจำนวนห้อง",
        "ระบบการเงินแบบครบวงจร",
        "AI ผู้ช่วยอัจฉริยะ",
        "การวิเคราะห์ขั้นสูง",
        "หลายสาขา",
        "Support 24/7"
      ]
    }
  ];

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-purple-600/10 to-pink-600/10" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 py-20 md:py-32">
          <div className="flex flex-col md:flex-row items-center gap-12">
            {/* Left: Content */}
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex-1 text-center md:text-left"
            >
              <div className="flex items-center gap-3 mb-6 justify-center md:justify-start">
                <img 
                  src={buildingLogo} 
                  alt="Logo" 
                  className="w-16 h-16 object-contain rounded-2xl shadow-lg"
                  onError={(e) => e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg'}
                />
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {buildingName}
                </h1>
              </div>
              
              <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-6">
                ระบบจัดการหอพักและอพาร์ทเมนต์<br />
                <span className="text-blue-600">อัจฉริยะและครบวงจร</span>
              </h2>
              
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                ปรับปรุงการจัดการธุรกิจหอพักของคุณด้วยระบบอัตโนมัติ<br />
                ประหยัดเวลา ลดข้อผิดพลาด เพิ่มรายได้
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                <Button
                  size="lg"
                  onClick={() => {
                    if (isAuthenticated) {
                      navigate(createPageUrl('Dashboard'));
                    } else {
                      base44.auth.redirectToLogin(window.location.origin);
                    }
                  }}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-xl shadow-blue-500/50 px-8 py-6 text-lg rounded-2xl"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  {isAuthenticated ? 'ไปที่แดชบอร์ด' : 'เข้าสู่ระบบ'}
                </Button>
                
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => {
                    document.getElementById('packages').scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-8 py-6 text-lg rounded-2xl"
                >
                  ดูแพ็กเกจ
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </motion.div>

            {/* Right: Image/Illustration */}
            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="flex-1"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500 rounded-3xl blur-3xl opacity-30" />
                <img
                  src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800"
                  alt="Modern Building"
                  className="relative rounded-3xl shadow-2xl w-full max-w-lg mx-auto"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative py-20 bg-white/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              ทำไมต้องเลือกเรา
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              ฟีเจอร์ครบครันที่ออกแบบมาเพื่อธุรกิจหอพักโดยเฉพาะ
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-xl transition-all duration-300 border-0 bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-4">
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                    <CardDescription className="text-base">{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Packages Section */}
      <section id="packages" className="relative py-20">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-800 mb-4">
              เลือกแพ็กเกจที่เหมาะกับคุณ
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              เริ่มต้นฟรี 14 วัน ไม่ต้องใช้บัตรเครดิต
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {packages.map((pkg, index) => (
              <motion.div
                key={pkg.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                {pkg.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 shadow-lg">
                      ⭐ แนะนำ
                    </Badge>
                  </div>
                )}
                
                <Card className={`h-full ${pkg.popular ? 'border-2 border-purple-500 shadow-2xl shadow-purple-500/30' : 'border-0'} bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300`}>
                  <CardHeader>
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${pkg.color} flex items-center justify-center mb-4 mx-auto`}>
                      <pkg.icon className="w-8 h-8 text-white" />
                    </div>
                    <CardTitle className="text-2xl text-center">{pkg.name}</CardTitle>
                    <div className="text-center mt-4">
                      <span className="text-4xl font-bold text-slate-800">฿{pkg.price.toLocaleString()}</span>
                      <span className="text-slate-600">/เดือน</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 mb-6">
                      {pkg.features.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-slate-700">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    
                    <Button
                      className={`w-full ${pkg.popular ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700' : 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700'} text-white shadow-lg`}
                      size="lg"
                      onClick={() => {
                        if (isAuthenticated) {
                          navigate(createPageUrl('PackageSelectionPage'));
                        } else {
                          base44.auth.redirectToLogin(window.location.origin);
                        }
                      }}
                    >
                      {isAuthenticated ? 'เลือกแพ็กเกจนี้' : 'เริ่มใช้งานฟรี 14 วัน'}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 overflow-hidden">
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
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            พร้อมที่จะเริ่มต้นแล้วหรือยัง?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            ทดลองใช้งานฟรี 14 วัน ไม่ต้องใช้บัตรเครดิต
          </p>
          <Button
            size="lg"
            onClick={() => {
              if (isAuthenticated) {
                navigate(createPageUrl('PackageSelectionPage'));
              } else {
                base44.auth.redirectToLogin(window.location.origin);
              }
            }}
            className="bg-white text-blue-600 hover:bg-blue-50 shadow-2xl px-12 py-6 text-lg rounded-2xl"
          >
            <Sparkles className="w-6 h-6 mr-2" />
            {isAuthenticated ? 'เลือกแพ็กเกจ' : 'เริ่มทดลองใช้งานฟรี'}
          </Button>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative py-12 bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <img 
              src={buildingLogo} 
              alt="Logo" 
              className="w-10 h-10 object-contain"
              onError={(e) => e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg'}
            />
            <span className="text-xl font-bold text-white">{buildingName}</span>
          </div>
          <p className="text-slate-400">
            © {new Date().getFullYear()} ระบบจัดการหอพักและอพาร์ทเมนต์. สงวนลิขสิทธิ์.
          </p>
        </div>
      </footer>
    </div>
  );
}