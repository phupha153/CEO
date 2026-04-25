import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, AlertTriangle, X, Check, Droplets, Zap } from "lucide-react";

export default function AIAnalysisResult({ isAnalyzing, aiAnalysisResult }) {
  if (!isAnalyzing && !aiAnalysisResult) return null;

  return (
    <Card className="bg-gradient-to-br from-purple-50 via-white to-indigo-50 border-purple-200/60 shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white pb-4">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg"><Sparkles className="w-5 h-5" /></div>
          <div>
            <p className="text-lg font-bold">ผลการวิเคราะห์จาก AI</p>
            <p className="text-purple-200 text-sm font-normal">ตรวจสอบการใช้น้ำและไฟฟ้าผิดปกติ</p>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-purple-200 rounded-full"></div>
              <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin absolute top-0"></div>
            </div>
            <p className="text-slate-600 font-medium">กำลังวิเคราะห์ข้อมูลมิเตอร์...</p>
            <p className="text-slate-400 text-sm">AI กำลังตรวจสอบรูปแบบการใช้งานของทุกห้อง</p>
          </div>
        ) : aiAnalysisResult?.status === 'no_data' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <p className="text-slate-700 font-semibold mb-2">ยังไม่มีข้อมูลเพียงพอ</p>
            <p className="text-slate-500 text-sm">{aiAnalysisResult.message}</p>
          </div>
        ) : aiAnalysisResult?.status === 'error' ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <X className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-red-700 font-semibold mb-2">เกิดข้อผิดพลาด</p>
            <p className="text-slate-500 text-sm">{aiAnalysisResult.message}</p>
          </div>
        ) : aiAnalysisResult ? (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-slate-500">สรุปภาพรวม</p>
                <Badge className="bg-purple-100 text-purple-700">วิเคราะห์ {aiAnalysisResult.total_rooms_analyzed || 0} ห้อง</Badge>
              </div>
              <p className="text-slate-800 font-medium">{aiAnalysisResult.summary}</p>
              {aiAnalysisResult.statistics && (
                <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-600 mb-1">ค่าเฉลี่ยน้ำ</p>
                    <p className="text-lg font-bold text-blue-700">{aiAnalysisResult.statistics.avg_water_usage?.toFixed(1)} หน่วย</p>
                    {aiAnalysisResult.statistics.highest_water_room && <p className="text-xs text-slate-600 mt-1">สูงสุด: ห้อง {aiAnalysisResult.statistics.highest_water_room}</p>}
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-3">
                    <p className="text-xs text-yellow-600 mb-1">ค่าเฉลี่ยไฟ</p>
                    <p className="text-lg font-bold text-yellow-700">{aiAnalysisResult.statistics.avg_electricity_usage?.toFixed(1)} หน่วย</p>
                    {aiAnalysisResult.statistics.highest_electricity_room && <p className="text-xs text-slate-600 mt-1">สูงสุด: ห้อง {aiAnalysisResult.statistics.highest_electricity_room}</p>}
                  </div>
                </div>
              )}
            </div>
            {aiAnalysisResult.abnormal_rooms && aiAnalysisResult.abnormal_rooms.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                  <p className="font-semibold text-slate-800">ห้องที่พบความผิดปกติ ({aiAnalysisResult.abnormal_rooms.length} ห้อง)</p>
                </div>
                <div className="grid gap-3">
                  {aiAnalysisResult.abnormal_rooms.map((room, idx) => (
                    <div key={idx} className={`rounded-xl p-4 border-2 ${room.severity==='high'?'bg-red-50 border-red-200':room.severity==='medium'?'bg-amber-50 border-amber-200':'bg-yellow-50 border-yellow-200'}`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg ${room.severity==='high'?'bg-red-500 text-white':room.severity==='medium'?'bg-amber-500 text-white':'bg-yellow-500 text-white'}`}>{room.room_number}</div>
                          <div>
                            <p className="font-bold text-slate-800">ห้อง {room.room_number}</p>
                            <div className="flex items-center gap-2 mt-1">
                              {(room.issue_type==='electricity'||room.issue_type==='both') && <Badge className="bg-yellow-100 text-yellow-700 gap-1"><Zap className="w-3 h-3" />ไฟฟ้า</Badge>}
                              {(room.issue_type==='water'||room.issue_type==='both') && <Badge className="bg-blue-100 text-blue-700 gap-1"><Droplets className="w-3 h-3" />น้ำ</Badge>}
                            </div>
                          </div>
                        </div>
                        <Badge className={room.severity==='high'?'bg-red-500 text-white':room.severity==='medium'?'bg-amber-500 text-white':'bg-yellow-500 text-white'}>{room.severity==='high'?'⚠️ รุนแรง':room.severity==='medium'?'⚡ ปานกลาง':'💡 เล็กน้อย'}</Badge>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-2"><span className="text-slate-500 min-w-[60px]">ปัญหา:</span><span className="text-slate-700">{room.description}</span></div>
                        {room.current_usage && (
                          <div className="flex gap-4 py-2 px-3 bg-white rounded-lg border">
                            <div className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-600" /><span className="text-xs text-slate-500">น้ำ:</span><span className="font-bold text-blue-700">{room.current_usage.water} หน่วย</span></div>
                            <div className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-600" /><span className="text-xs text-slate-500">ไฟ:</span><span className="font-bold text-yellow-700">{room.current_usage.electricity} หน่วย</span></div>
                          </div>
                        )}
                        {room.comparison && <div className="flex gap-2 bg-slate-50 rounded px-2 py-1"><span className="text-slate-500 min-w-[60px]">เปรียบเทียบ:</span><span className="text-slate-600 text-xs">{room.comparison}</span></div>}
                        <div className="flex gap-2"><span className="text-slate-500 min-w-[60px]">แนะนำ:</span><span className="text-slate-700 font-medium">{room.recommendation}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><Check className="w-8 h-8 text-green-600" /></div>
                <p className="text-green-700 font-semibold mb-2">ไม่พบความผิดปกติ</p>
                <p className="text-slate-500 text-sm">{aiAnalysisResult.normal_message || 'การใช้น้ำและไฟฟ้าของทุกห้องอยู่ในเกณฑ์ปกติ'}</p>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}