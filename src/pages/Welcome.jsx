import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  TrendingUp,
  Home,
  FileText,
  Zap
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
    base44.auth.isAuthenticated()
      .then(authed => {
        setIsAuthenticated(authed);
      })
      .catch(() => setIsAuthenticated(false));

    base44.entities.Config.list()
      .then(configs => {
        const logoConfig = configs.find(c => c.key === 'building_logo' && !c.branch_id);
        const nameConfig = configs.find(c => c.key === 'building_name' && !c.branch_id);
        if (logoConfig?.value) setBuildingLogo(logoConfig.value);
        if (nameConfig?.value) setBuildingName(nameConfig.value);
      })
      .catch(() => {});
  }, [navigate]);

  const stats = [
    { icon: Users, label: "ผู้ใช้งาน", value: "500+", color: "from-blue-500 to-cyan-500" },
    { icon: TrendingUp, label: "เพิ่มประสิทธิภาพ", value: "80%", color: "from-green-500 to-emerald-500" },
    { icon: Home, label: "หอพัก", value: "100+", color: "from-purple-500 to-pink-500" },
    { icon: BarChart3, label: "ความพึงพอใจ", value: "95%", color: "from-orange-500 to-red-500" }
  ];

  const features = [
    {
      icon: Building2,
      title: "จัดการห้องพัก",
      description: "ติดตามสถานะห้อง การจอง และข้อมูลผู้เช่าได้ง่ายดาย"
    },
    {
      icon: CreditCard,
      title: "ระบบการเงินอัตโนมัติ",
      description: "สร้างบิล คำนวณค่าน้ำค่าไฟ ส่งแจ้งเตือนอัตโนมัติ"
    },
    {
      icon: MessageSquare,
      title: "แจ้งเตือนอัจฉริยะ",
      description: "ส่งข้อความผ่าน LINE และ Facebook อัตโนมัติ"
    },
    {
      icon: BarChart3,
      title: "รายงานและวิเคราะห์",
      description: "ดูสถิติและรายงานทางการเงินแบบเรียลไทม์"
    },
    {
      icon: Users,
      title: "จัดการผู้เช่า",
      description: "บันทึกข้อมูล ประวัติชำระเงิน และประเมินผู้เช่า"
    },
    {
      icon: Shield,
      title: "ปลอดภัยและมั่นคง",
      description: "ระบบรักษาความปลอดภัยระดับสูง พร้อม backup"
    }
  ];

  const steps = [
    {
      icon: FileText,
      title: "ลงทะเบียนเข้าใช้งาน",
      description: "สมัครสมาชิกและเข้าสู่ระบบเพื่อเริ่มต้นใช้งาน"
    },
    {
      icon: Building2,
      title: "เพิ่มข้อมูลหอพัก",
      description: "กรอกข้อมูลหอพัก ห้องพัก และตั้งค่าต่างๆ"
    },
    {
      icon: Zap,
      title: "เริ่มใช้งานได้ทันที",
      description: "จัดการทุกอย่างได้อย่างง่ายดายและรวดเร็ว"
    }
  ];

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
      {/* Navigation */}
      <nav className="border-b bg-white/80 backdrop-blur-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={buildingLogo} 
              alt="Logo" 
              className="w-10 h-10 object-contain rounded-xl"
              onError={(e) => e.target.src = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg'}
            />
            <span className="text-xl font-bold text-slate-800">{buildingName}</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-slate-600 hover:text-slate-900 transition-colors">คุณสมบัติ</a>
            <a href="#how-to-use" className="text-slate-600 hover:text-slate-900 transition-colors">วิธีใช้งาน</a>
            <a href="#pricing" className="text-slate-600 hover:text-slate-900 transition-colors">แพ็กเกจ</a>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              onClick={() => {
                if (isAuthenticated) {
                  navigate(createPageUrl('Dashboard'));
                } else {
                  base44.auth.redirectToLogin(window.location.origin);
                }
              }}
            >
              {isAuthenticated ? 'แดชบอร์ด' : 'เข้าสู่ระบบ'}
            </Button>
            <Button
              onClick={() => {
                if (isAuthenticated) {
                  navigate(createPageUrl('PackageSelectionPage'));
                } else {
                  base44.auth.redirectToLogin(window.location.origin);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isAuthenticated ? 'เลือกแพ็กเกจ' : 'ทดลองใช้ฟรี'}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-pink-600/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <Badge className="mb-6 px-4 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200">
              Start Here
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-slate-900 mb-6 leading-tight">
              ระบบจัดการหอพัก<br />
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                ครบวงจร ง่าย รวดเร็ว
              </span>
            </h1>
            <p className="text-xl text-slate-600 mb-8 leading-relaxed">
              จัดการห้องพัก การเงิน และผู้เช่าได้อย่างมีประสิทธิภาพ<br />
              ด้วยระบบอัตโนมัติที่ออกแบบมาเพื่อหอพักโดยเฉพาะ
            </p>
            <Button
              size="lg"
              onClick={() => {
                if (isAuthenticated) {
                  navigate(createPageUrl('Dashboard'));
                } else {
                  base44.auth.redirectToLogin(window.location.origin);
                }
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg"
            >
              {isAuthenticated ? 'ไปที่แดชบอร์ด' : 'เริ่มทดลองใช้งาน'}
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>

          {/* Stats Cards */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-5xl mx-auto"
          >
            {stats.map((stat, index) => (
              <Card key={index} className="border-0 bg-white/80 backdrop-blur-sm shadow-lg hover:shadow-xl transition-shadow">
                <CardContent className="p-6 text-center">
                  <div className={`w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-600">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              คุณสมบัติครบครัน
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              ฟีเจอร์ที่ออกแบบมาเพื่อธุรกิจหอพักโดยเฉพาะ
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full border-0 bg-gradient-to-br from-white to-slate-50 hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mb-4">
                      <feature.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-slate-600 leading-relaxed">{feature.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How to Use Section */}
      <section id="how-to-use" className="py-20 bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
              เริ่มต้นใช้งานง่ายๆ 3 ขั้นตอน
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              ไม่ต้องใช้เวลานาน เริ่มจัดการหอพักได้ทันที
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {steps.map((step, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15 }}
                className="relative"
              >
                <Card className="border-0 bg-white shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-8 text-center">
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <step.icon className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
                    <p className="text-slate-600">{step.description}</p>
                  </CardContent>
                </Card>
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-4 transform -translate-y-1/2">
                    <ArrowRight className="w-6 h-6 text-blue-400" />
                  </div>
                )}
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
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              onClick={() => {
                if (isAuthenticated) {
                  navigate(createPageUrl('PackageSelectionPage'));
                } else {
                  base44.auth.redirectToLogin(window.location.origin);
                }
              }}
              className="bg-white text-blue-600 hover:bg-blue-50 shadow-2xl px-12 py-6 text-lg rounded-xl"
            >
              {isAuthenticated ? 'เลือกแพ็กเกจ' : 'เริ่มทดลองใช้งานฟรี'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              className="bg-transparent border-2 border-white text-white hover:bg-white/10 px-12 py-6 text-lg rounded-xl"
            >
              ดูคุณสมบัติเพิ่มเติม
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-slate-900">
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
            © {new Date().getFullYear()} ระบบจัดการหอพักครบวงจร. สงวนลิขสิทธิ์.
          </p>
        </div>
      </footer>
    </div>
  );
}