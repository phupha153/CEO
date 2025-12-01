import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import PageHeader from "../components/shared/PageHeader";
import { Database, Loader2, Play } from "lucide-react";

export default function CustomTestDataGenerator() {
  const selectedBranchId = localStorage.getItem('selected_branch_id');
  
  const [config, setConfig] = useState({
    totalRecords: 10000,
    dataTypes: {
      rooms: { enabled: true, percentage: 5 },
      tenants: { enabled: true, percentage: 5 },
      bookings: { enabled: true, percentage: 5 },
      payments: { enabled: true, percentage: 60 },
      meterReadings: { enabled: true, percentage: 5 },
      maintenance: { enabled: true, percentage: 5 }
    }
  });

  const totalPercentage = Object.values(config.dataTypes).reduce((sum, type) => 
    type.enabled ? sum + type.percentage : sum, 0
  );

  const generateMutation = useMutation({
    mutationFn: async () => {
      const enabledTypes = Object.entries(config.dataTypes)
        .filter(([_, type]) => type.enabled)
        .reduce((acc, [key, type]) => {
          acc[key] = Math.round((config.totalRecords * type.percentage) / 100);
          return acc;
        }, {});

      const response = await base44.functions.invoke('generateCustomTestData', {
        branch_id: selectedBranchId,
        counts: enabledTypes,
        totalRecords: config.totalRecords
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`สร้างข้อมูลทดสอบสำเร็จ! ${data.message || ''}`);
    },
    onError: (error) => {
      toast.error(`เกิดข้อผิดพลาด: ${error.message}`);
    }
  });

  const updatePercentage = (type, value) => {
    setConfig(prev => ({
      ...prev,
      dataTypes: {
        ...prev.dataTypes,
        [type]: { ...prev.dataTypes[type], percentage: value }
      }
    }));
  };

  const toggleType = (type) => {
    setConfig(prev => ({
      ...prev,
      dataTypes: {
        ...prev.dataTypes,
        [type]: { ...prev.dataTypes[type], enabled: !prev.dataTypes[type].enabled }
      }
    }));
  };

  const dataTypeLabels = {
    rooms: { label: '🏠 ห้องพัก', color: 'blue' },
    tenants: { label: '👥 ผู้เช่า', color: 'green' },
    bookings: { label: '📋 การจอง', color: 'purple' },
    payments: { label: '💰 บิลชำระเงิน', color: 'orange' },
    meterReadings: { label: '📏 มิเตอร์', color: 'cyan' },
    maintenance: { label: '🔧 แจ้งซ่อม', color: 'red' }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-pink-50">
      <PageHeader 
        title="สร้างข้อมูลทดสอบแบบกำหนดเอง" 
        subtitle="เลือกและกำหนดสัดส่วนข้อมูลที่ต้องการสร้าง"
        icon={Database}
      />

      <div className="px-4 md:px-8 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="bg-white/80 backdrop-blur-xl border-white/60 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                ตั้งค่าการสร้างข้อมูล
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* จำนวนรวมทั้งหมด */}
              <div className="space-y-2">
                <Label htmlFor="totalRecords" className="text-base font-semibold">
                  จำนวนรวมทั้งหมด
                </Label>
                <Input
                  id="totalRecords"
                  type="number"
                  min="10"
                  max="100000"
                  value={config.totalRecords}
                  onChange={(e) => setConfig(prev => ({ ...prev, totalRecords: parseInt(e.target.value) || 100 }))}
                  className="text-lg font-bold"
                />
                <p className="text-sm text-slate-500">
                  จำนวน records ทั้งหมดที่จะสร้าง (สูงสุด 100,000 รายการ)
                </p>
              </div>

              <div className="h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

              {/* เลือกประเภทข้อมูลและเปอร์เซ็นต์ */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold">เลือกประเภทข้อมูล</h3>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                    totalPercentage === 100 ? 'bg-green-100 text-green-700' : 
                    totalPercentage > 100 ? 'bg-red-100 text-red-700' : 
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    รวม: {totalPercentage}%
                  </div>
                </div>

                <div className="space-y-4">
                  {Object.entries(dataTypeLabels).map(([key, { label, color }]) => (
                    <div key={key} className={`p-4 rounded-xl border-2 transition-all ${
                      config.dataTypes[key].enabled 
                        ? `border-${color}-200 bg-${color}-50/50` 
                        : 'border-slate-200 bg-slate-50 opacity-60'
                    }`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={config.dataTypes[key].enabled}
                            onCheckedChange={() => toggleType(key)}
                          />
                          <div>
                            <Label className="text-base font-semibold cursor-pointer">
                              {label}
                            </Label>
                            {config.dataTypes[key].enabled && (
                              <p className="text-xs text-slate-500 mt-1">
                                ≈ {Math.round((config.totalRecords * config.dataTypes[key].percentage) / 100)} รายการ
                              </p>
                            )}
                          </div>
                        </div>
                        <div className={`text-2xl font-bold ${
                          config.dataTypes[key].enabled ? `text-${color}-600` : 'text-slate-400'
                        }`}>
                          {config.dataTypes[key].percentage}%
                        </div>
                      </div>

                      {config.dataTypes[key].enabled && (
                        <div className="space-y-2">
                          <Slider
                            value={[config.dataTypes[key].percentage]}
                            onValueChange={([value]) => updatePercentage(key, value)}
                            min={0}
                            max={100}
                            step={5}
                            className="w-full"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {totalPercentage !== 100 && (
                <div className={`p-3 rounded-lg text-sm ${
                  totalPercentage > 100 ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                }`}>
                  ⚠️ {totalPercentage > 100 ? 'เปอร์เซ็นต์รวมเกิน 100%' : 'เปอร์เซ็นต์รวมยังไม่ครบ 100%'}
                </div>
              )}
            </CardContent>
          </Card>

          {/* สรุปและปุ่มสร้าง */}
          <Card className="bg-gradient-to-br from-purple-500 to-pink-500 text-white border-0 shadow-xl">
            <CardContent className="p-6">
              <div className="space-y-4">
                <h3 className="text-xl font-bold">📊 สรุปข้อมูลที่จะสร้าง</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(dataTypeLabels).map(([key, { label }]) => (
                    config.dataTypes[key].enabled && (
                      <div key={key} className="bg-white/20 backdrop-blur-sm rounded-lg p-3">
                        <div className="text-xs opacity-90">{label}</div>
                        <div className="text-2xl font-bold">
                          {Math.round((config.totalRecords * config.dataTypes[key].percentage) / 100)}
                        </div>
                      </div>
                    )
                  ))}
                </div>

                <Button
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending || totalPercentage !== 100}
                  size="lg"
                  className="w-full bg-white text-purple-600 hover:bg-white/90 font-bold text-lg h-14"
                >
                  {generateMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      บันทึก
                    </>
                  )}
                </Button>

                {totalPercentage !== 100 && (
                  <p className="text-xs text-center opacity-90">
                    กรุณาปรับเปอร์เซ็นต์ให้รวมเท่ากับ 100% ก่อนสร้างข้อมูล
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}