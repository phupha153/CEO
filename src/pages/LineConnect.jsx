import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckCircle2, Loader2, AlertTriangle, Building } from "lucide-react";
import { motion } from "framer-motion";

export default function LineConnect() {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // ดึง tenant_id จาก URL
  const urlParams = new URLSearchParams(window.location.search);
  const tenantId = urlParams.get('t');
  const successParam = urlParams.get('success');
  const errorParam = urlParams.get('error');

  useEffect(() => {
    if (successParam === 'true') {
      setSuccess(true);
    }
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [successParam, errorParam]);

  // ดึงข้อมูล tenant และ branch - ใช้ public endpoint
  const { data: tenantData, isLoading, error: fetchError } = useQuery({
    queryKey: ['tenantForLineConnect', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      
      // เรียก public function โดยตรง (ไม่ต้อง auth)
      const response = await base44.functions.invoke('publicGetTenantForLineConnect', { tenant_id: tenantId });
      return response.data;
    },
    enabled: !!tenantId,
    staleTime: Infinity,
    retry: 2,
  });

  const handleConnect = async () => {
    if (!tenantId) return;
    
    setConnecting(true);
    setError(null);
    
    try {
      const response = await base44.functions.invoke('publicStartTenantLineOAuth', { tenant_id: tenantId });
      const data = response.data;
      
      if (data?.authUrl) {
        // Redirect ไปยัง LINE OAuth
        window.location.href = data.authUrl;
      } else if (data?.already_connected) {
        setSuccess(true);
      } else {
        setError(data?.error || 'ไม่สามารถเริ่มการเชื่อมต่อได้');
      }
    } catch (err) {
      console.error('Connect error:', err);
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setConnecting(false);
    }
  };

  // หน้าไม่มี tenant_id
  if (!tenantId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/80 backdrop-blur-xl shadow-2xl border-0 rounded-3xl">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">ลิงก์ไม่ถูกต้อง</h2>
            <p className="text-slate-600">กรุณาใช้ลิงก์เชื่อมต่อ LINE ที่ได้รับจากหอพัก</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-600 animate-spin mx-auto mb-4" />
          <p className="text-slate-600">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // ไม่พบ tenant
  if (!tenantData?.tenant) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full bg-white/80 backdrop-blur-xl shadow-2xl border-0 rounded-3xl">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-800 mb-2">ไม่พบข้อมูล</h2>
            <p className="text-slate-600">ลิงก์นี้อาจหมดอายุหรือไม่ถูกต้อง กรุณาติดต่อหอพัก</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { tenant, branch, building_name } = tenantData;

  // เชื่อมต่อสำเร็จ
  if (success || tenant.line_user_id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full"
        >
          <Card className="bg-white/80 backdrop-blur-xl shadow-2xl border-0 rounded-3xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <CheckCircle2 className="w-12 h-12 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-white">เชื่อมต่อสำเร็จ!</h1>
            </div>
            <CardContent className="p-8 text-center">
              <p className="text-lg text-slate-700 mb-4">
                สวัสดีคุณ <span className="font-bold">{tenant.full_name}</span>
              </p>
              <p className="text-slate-600 mb-6">
                LINE ของคุณเชื่อมต่อกับ<br/>
                <span className="font-semibold">{building_name || branch?.branch_name || 'หอพัก'}</span> แล้ว
              </p>
              <div className="bg-green-50 rounded-2xl p-4 text-left">
                <p className="text-sm text-green-800 font-semibold mb-2">✅ คุณจะได้รับแจ้งเตือนผ่าน LINE:</p>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• ใบแจ้งหนี้ค่าเช่ารายเดือน</li>
                  <li>• ใบเสร็จรับเงิน</li>
                  <li>• แจ้งเตือนค่าเช่าใกล้ครบกำหนด</li>
                  <li>• ประกาศจากหอพัก</li>
                </ul>
              </div>
              <p className="text-xs text-slate-500 mt-6">
                คุณสามารถปิดหน้านี้ได้แล้ว
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  // หน้าเชื่อมต่อ
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="max-w-md w-full"
      >
        <Card className="bg-white/80 backdrop-blur-xl shadow-2xl border-0 rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-center">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <MessageSquare className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-white">เชื่อมต่อ LINE</h1>
            <p className="text-green-100 mt-1">{building_name || branch?.branch_name || 'หอพัก'}</p>
          </div>
          
          <CardContent className="p-8">
            <div className="text-center mb-6">
              <p className="text-lg text-slate-700">
                สวัสดีคุณ <span className="font-bold">{tenant.full_name}</span>
              </p>
              <p className="text-slate-500 text-sm mt-1">
                กดปุ่มด้านล่างเพื่อเชื่อมต่อ LINE กับหอพัก
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="bg-slate-50 rounded-2xl p-4 mb-6">
              <p className="text-sm text-slate-600 font-semibold mb-2">เมื่อเชื่อมต่อแล้ว คุณจะได้รับ:</p>
              <ul className="text-sm text-slate-600 space-y-1">
                <li>📄 ใบแจ้งหนี้ค่าเช่ารายเดือน</li>
                <li>🧾 ใบเสร็จรับเงิน</li>
                <li>⏰ แจ้งเตือนค่าเช่าใกล้ครบกำหนด</li>
                <li>📢 ประกาศจากหอพัก</li>
              </ul>
            </div>

            <Button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full h-14 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-lg font-semibold rounded-2xl shadow-lg"
            >
              {connecting ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  กำลังเชื่อมต่อ...
                </>
              ) : (
                <>
                  <MessageSquare className="w-5 h-5 mr-2" />
                  เชื่อมต่อด้วย LINE
                </>
              )}
            </Button>

            <p className="text-xs text-center text-slate-400 mt-6">
              เมื่อกดปุ่ม คุณจะถูกพาไปยังหน้าอนุญาตของ LINE<br/>
              กรุณากด "อนุญาต" เพื่อเชื่อมต่อ
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}