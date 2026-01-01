import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Upload, Loader2, Check, AlertCircle, Crown } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { createPageUrl } from "@/utils";

export default function PackagePaymentPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const packageData = location.state?.packageData;
  
  const [slipFile, setSlipFile] = useState(null);
  const [slipPreview, setSlipPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  
  const { data: configs = [] } = useQuery({
    queryKey: ['configs'],
    queryFn: () => base44.entities.Config.list(),
  });
  
  const getConfigValue = (key, defaultValue = '') => {
    const config = configs.find(c => c.key === key && !c.branch_id);
    return config?.value || defaultValue;
  };
  
  const bankName = getConfigValue('bank_name', 'ธนาคารกสิกรไทย');
  const accountNumber = getConfigValue('bank_account_number', 'xxx-x-xxxxx-x');
  const accountName = getConfigValue('bank_account_name', 'บริษัท...');
  const promptpay = getConfigValue('promptpay', '0812345678');
  
  useEffect(() => {
    if (!packageData) {
      toast.error('ไม่พบข้อมูลแพ็กเกจ');
      navigate(createPageUrl('PackageSelection'));
    }
  }, [packageData, navigate]);
  
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setSlipFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setSlipPreview(e.target.result);
    reader.readAsDataURL(file);
  };
  
  const submitPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!slipFile) throw new Error('กรุณาอัปโหลดหลักฐานการโอนเงิน');
      
      setUploading(true);
      
      // Upload slip
      const uploadResult = await base44.integrations.Core.UploadFile({ file: slipFile });
      const slipUrl = uploadResult.file_url;
      
      // Process payment
      const response = await base44.functions.invoke('processSubscriptionPayment', {
        packageId: packageData.packageId,
        packageName: packageData.packageName,
        durationMonths: packageData.durationMonths,
        monthlyPrice: packageData.monthlyPrice,
        subtotal: packageData.subtotal,
        discountCode: packageData.discountCode,
        discountAmount: packageData.discountAmount,
        finalTotal: packageData.finalTotal,
        slipUrl: slipUrl
      });
      
      return response.data;
    },
    onSuccess: () => {
      toast.success('ส่งข้อมูลการชำระเงินสำเร็จ! รอการตรวจสอบจากเจ้าหน้าที่');
      queryClient.invalidateQueries(['currentUser']);
      queryClient.invalidateQueries(['appSubscriptions']);
      setTimeout(() => {
        navigate(createPageUrl('Dashboard'));
      }, 2000);
    },
    onError: (error) => {
      toast.error(error.message || 'เกิดข้อผิดพลาด');
      setUploading(false);
    }
  });
  
  if (!packageData) return null;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Button
          onClick={() => navigate(createPageUrl('PackageSelection'))}
          variant="ghost"
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          กลับ
        </Button>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid md:grid-cols-2 gap-6"
        >
          {/* Left: Package Summary */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6">
                <Crown className="w-8 h-8 text-blue-600" />
                <h2 className="text-2xl font-bold">สรุปแพ็กเกจ</h2>
              </div>
              
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-slate-600">แพ็กเกจ:</span>
                  <span className="font-semibold">{packageData.packageName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">ระยะเวลา:</span>
                  <span className="font-semibold">{packageData.durationMonths} เดือน</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">ราคา/เดือน:</span>
                  <span className="font-semibold">฿{packageData.monthlyPrice.toLocaleString()}</span>
                </div>
                
                <div className="border-t pt-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span>ยอดรวม:</span>
                    <span className="text-blue-600">฿{packageData.finalTotal.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Right: Payment Form */}
          <Card>
            <CardContent className="p-6">
              <h2 className="text-2xl font-bold mb-6">ชำระเงิน</h2>
              
              <div className="space-y-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                  <p className="text-sm font-semibold text-blue-800 mb-2">ข้อมูลการโอนเงิน</p>
                  <div className="space-y-1 text-sm">
                    <p><strong>ธนาคาร:</strong> {bankName}</p>
                    <p><strong>เลขบัญชี:</strong> {accountNumber}</p>
                    <p><strong>ชื่อบัญชี:</strong> {accountName}</p>
                  </div>
                </div>
                
                <div>
                  <Label>อัปโหลดหลักฐานการโอนเงิน</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="mt-2"
                  />
                </div>
                
                {slipPreview && (
                  <div className="border rounded-lg p-4">
                    <img src={slipPreview} alt="Preview" className="max-h-64 mx-auto" />
                  </div>
                )}
              </div>
              
              <Button
                onClick={() => submitPaymentMutation.mutate()}
                disabled={!slipFile || uploading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    กำลังส่งข้อมูล...
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5 mr-2" />
                    ยืนยันการชำระเงิน
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}