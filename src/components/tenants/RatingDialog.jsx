import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Star, TrendingUp, Home, Users, Info } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function RatingDialog({ open, onOpenChange, tenant, onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    payment_score: 10,
    property_care_score: 10,
    cohabitation_score: 10,
    notes: '',
    rating_period: ''
  });

  // ✅ ดึงข้อมูลการชำระเงินเฉพาะเมื่อเปิด dialog
  const { data: payments = [] } = useQuery({
    queryKey: ['tenant-payments', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const allPayments = await base44.entities.Payment.list('-created_date', 50);
      return allPayments.filter(p => p.tenant_id === tenant.id);
    },
    enabled: !!tenant?.id && open,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // ⭐ ดึงคะแนนเดิมของผู้เช่า (โหลดทันทีไม่ต้องรอเปิด dialog)
  const { data: existingRatings = [], isLoading: ratingsLoading } = useQuery({
    queryKey: ['tenant-ratings', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const allRatings = await base44.entities.TenantRating.list('-rating_date', 10);
      return allRatings.filter(r => r.tenant_id === tenant.id);
    },
    enabled: !!tenant?.id,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  // ✅ ใช้ useMemo แทน useEffect สำหรับการคำนวณ scoreBreakdown
  const scoreBreakdown = useMemo(() => {
    if (!open || !tenant?.id || !payments || payments.length === 0) {
      return {
        totalPayments: 0,
        paidOnTime: 0,
        paidLate: 0,
        overdue: 0,
        calculatedScore: 10,
        message: 'ยังไม่มีประวัติการชำระเงิน - ให้คะแนนเต็ม 10'
      };
    }

    const totalPayments = payments.length;
    const paidPayments = payments.filter(p => p.status === 'paid');
    const overduePayments = payments.filter(p => p.status === 'overdue');
    
    let score = 10;
    let paidOnTime = 0;
    let paidLate = 0;
    
    paidPayments.forEach(payment => {
      if (payment.payment_date && payment.due_date) {
        const paymentDate = new Date(payment.payment_date);
        const dueDate = new Date(payment.due_date);
        
        if (paymentDate <= dueDate) {
          paidOnTime++;
        } else {
          paidLate++;
          score = Math.max(0, score - 0.5);
        }
      }
    });

    overduePayments.forEach(() => {
      score = Math.max(0, score - 1);
    });

    if (overduePayments.length >= 3) {
      score = Math.min(score, 5);
    }

    score = Math.round(score * 10) / 10;

    return {
      totalPayments,
      paidOnTime,
      paidLate,
      overdue: overduePayments.length,
      calculatedScore: score,
      message: `วิเคราะห์จาก ${totalPayments} บิล: จ่ายตรงเวลา ${paidOnTime} ครั้ง, จ่ายล่าช้า ${paidLate} ครั้ง, ค้างชำระ ${overduePayments.length} บิล`
    };
  }, [payments, open, tenant?.id]);

  // ✅ อัปเดต payment_score เมื่อเปิด dialog และคำนวณใหม่
  useEffect(() => {
    if (open && scoreBreakdown) {
      setFormData(prev => ({ ...prev, payment_score: scoreBreakdown.calculatedScore }));
    }
  }, [open, scoreBreakdown.calculatedScore]);

  // ✅ โหลดคะแนนเดิม (ล่าสุด) เมื่อเปิด dialog และโหลดข้อมูลเสร็จ
  useEffect(() => {
    if (open && !ratingsLoading) {
      if (existingRatings.length > 0) {
        const latestRating = existingRatings[0];
        console.log('📊 Loading existing rating:', latestRating);
        setFormData({
          payment_score: latestRating.payment_score || scoreBreakdown.calculatedScore,
          property_care_score: latestRating.property_care_score || 10,
          cohabitation_score: latestRating.cohabitation_score || 10,
          notes: latestRating.notes || '',
          rating_period: latestRating.rating_period || ''
        });
      } else {
        console.log('📊 No existing ratings, using defaults');
        setFormData({
          payment_score: scoreBreakdown.calculatedScore,
          property_care_score: 10,
          cohabitation_score: 10,
          notes: '',
          rating_period: ''
        });
      }
    }
  }, [open, existingRatings, scoreBreakdown.calculatedScore, ratingsLoading]);

  // ✅ Reset form เมื่อปิด dialog
  useEffect(() => {
    if (!open) {
      setFormData({
        payment_score: 10,
        property_care_score: 10,
        cohabitation_score: 10,
        notes: '',
        rating_period: ''
      });
    }
  }, [open]);

  // ✅ คำนวณคะแนนรวม
  const overallRating = useMemo(() => {
    const totalScore = (formData.payment_score + formData.property_care_score + formData.cohabitation_score) / 3;
    const stars = (totalScore / 10) * 5;
    
    let text = 'ไม่ดี';
    if (totalScore >= 9) text = 'ดีเยี่ยม';
    else if (totalScore >= 7.5) text = 'ดี';
    else if (totalScore >= 6) text = 'พอใช้';
    else if (totalScore >= 4) text = 'ควรปรับปรุง';
    
    return { stars: Math.round(stars * 10) / 10, text };
  }, [formData.payment_score, formData.property_care_score, formData.cohabitation_score]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      overall_rating_stars: overallRating.stars,
      overall_rating_text: overallRating.text,
      rating_date: new Date().toISOString().split('T')[0]
    });
  };

  const renderStars = (rating) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    return (
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`w-6 h-6 ${
              i < fullStars ? 'fill-yellow-400 text-yellow-400' :
              i === fullStars && hasHalfStar ? 'fill-yellow-400 text-yellow-400 opacity-50' :
              'text-slate-300'
            }`}
          />
        ))}
        <span className="ml-2 text-lg font-bold text-slate-700">{rating.toFixed(1)}</span>
      </div>
    );
  };

  const getScoreColor = (score) => {
    if (score >= 9) return 'text-green-600';
    if (score >= 7.5) return 'text-blue-600';
    if (score >= 6) return 'text-yellow-600';
    if (score >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  // ✅ ถ้าไม่มี tenant ไม่ต้อง render อะไร
  if (!tenant) return null;

  return (
    <Dialog 
      open={open} 
      onOpenChange={onOpenChange}
      modal={true}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            ให้คะแนนผู้เช่า: {tenant.full_name}
          </DialogTitle>
        </DialogHeader>

        {ratingsLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-3">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-slate-600">กำลังโหลดคะแนนเดิม...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
          {/* คะแนนรวม */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200">
            <div className="text-center">
              <p className="text-sm text-slate-600 mb-2">คะแนนรวม</p>
              {renderStars(overallRating.stars)}
              <p className={`text-2xl font-bold mt-2 ${getScoreColor((formData.payment_score + formData.property_care_score + formData.cohabitation_score) / 3)}`}>
                {overallRating.text}
              </p>
            </div>
          </div>

          {/* คะแนนการชำระเงิน - คำนวณอัตโนมัติ */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                1. การชำระค่าน้ำ-ค่าไฟ (คำนวณอัตโนมัติ)
              </Label>
              <span className="text-2xl font-bold text-green-600">{formData.payment_score.toFixed(1)}/10</span>
            </div>
            <p className="text-sm text-slate-500">คะแนนคำนวณจากประวัติการชำระเงิน</p>
            
            {/* แสดงรายละเอียดการคำนวณ */}
            {scoreBreakdown && (
              <Alert className="bg-green-50 border-green-200">
                <Info className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800">
                  <p className="font-semibold mb-1">สรุปประวัติการชำระเงิน:</p>
                  <ul className="space-y-1 text-xs">
                    <li>จ่ายตรงเวลา: <strong>{scoreBreakdown.paidOnTime}</strong> ครั้ง</li>
                    <li>จ่ายล่าช้า: <strong>{scoreBreakdown.paidLate}</strong> ครั้ง (หักคะแนน -0.5 ต่อครั้ง)</li>
                    <li>ค้างชำระ: <strong>{scoreBreakdown.overdue}</strong> บิล (หักคะแนน -1 ต่อบิล)</li>
                    <li className="pt-1 border-t border-green-300 mt-2">
                      <strong>คะแนนที่ได้: {formData.payment_score.toFixed(1)}/10</strong>
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Progress bar แสดงคะแนน */}
            <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${
                  formData.payment_score >= 9 ? 'bg-green-500' :
                  formData.payment_score >= 7.5 ? 'bg-blue-500' :
                  formData.payment_score >= 6 ? 'bg-yellow-500' :
                  formData.payment_score >= 4 ? 'bg-orange-500' :
                  'bg-red-500'
                }`}
                style={{ width: `${(formData.payment_score / 10) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>0 - แย่มาก</span>
              <span>10 - ดีเยี่ยม</span>
            </div>
          </div>

          {/* คะแนนการรักษาทรัพย์สิน */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Home className="w-5 h-5 text-blue-600" />
                2. การรักษาทรัพย์สินของหอ
              </Label>
              <span className="text-2xl font-bold text-blue-600">{formData.property_care_score.toFixed(1)}/10</span>
            </div>
            <p className="text-sm text-slate-500">ไม่ทำของชำรุด / ไม่เคลื่อนย้ายโดยพลการ</p>
            <Slider
              value={[formData.property_care_score]}
              onValueChange={([value]) => setFormData({ ...formData, property_care_score: value })}
              max={10}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>0 - แย่มาก</span>
              <span>10 - ดีเยี่ยม</span>
            </div>
          </div>

          {/* คะแนนความรับผิดชอบและมารยาท */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                3. ความรับผิดชอบและมารยาท
              </Label>
              <span className="text-2xl font-bold text-purple-600">{formData.cohabitation_score.toFixed(1)}/10</span>
            </div>
            <p className="text-sm text-slate-500">การอยู่ร่วมกับผู้อื่น การปฏิบัติตามกฎของหอพัก</p>
            <Slider
              value={[formData.cohabitation_score]}
              onValueChange={([value]) => setFormData({ ...formData, cohabitation_score: value })}
              max={10}
              step={0.5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>0 - แย่มาก</span>
              <span>10 - ดีเยี่ยม</span>
            </div>
          </div>

          {/* ช่วงเวลาที่ประเมิน */}
          <div>
            <Label>ช่วงเวลาที่ประเมิน (ไม่บังคับ)</Label>
            <Input
              value={formData.rating_period}
              onChange={(e) => setFormData({ ...formData, rating_period: e.target.value })}
              placeholder="เช่น มกราคม 2025, ไตรมาส 1/2025"
              className="mt-2"
            />
          </div>

          {/* หมายเหตุ */}
          <div>
            <Label>หมายเหตุ / ข้อเสนอแนะ</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="ข้อสังเกต จุดที่ควรปรับปรุง หรือคำชมเชย..."
              rows={3}
              className="mt-2"
            />
          </div>

          {/* ปุ่ม */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              ยกเลิก
            </Button>
            <Button
              type="submit"
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              disabled={isLoading}
            >
              {isLoading ? 'กำลังบันทึก...' : 'บันทึกคะแนน'}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}