import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, List, Save, History, Check, Plus, X, AlertTriangle, Droplets, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";
import { toast } from "sonner";

export default function MeterRoomCards({
  displayFloors, displayRoomsByFloor, isMobile, cardReadings, setCardReadings,
  canAdd, canEdit, createSingleMutation, getActiveBooking, getTenantInfo,
  getLatestReading, hasRecordedThisMonth, handleViewHistory, setEditingReading,
  showAddMoreFormForRoom, setShowAddMoreFormForRoom, setViewMode,
  handleSaveSingleReading,
}) {
  return (
    <div className="space-y-8">
      {displayFloors.map((floor) => {
        const floorRooms = displayRoomsByFloor[floor];
        const floorHasUnsaved = floorRooms.some(room => cardReadings[room.id]?.water_current || cardReadings[room.id]?.electricity_current);
        return (
          <div key={floor} className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <Building2 className="w-6 h-6 text-blue-600" />
                <h2 className="text-2xl font-bold text-slate-800">ชั้น {floor}</h2>
                <Badge variant="outline" className="text-sm">{floorRooms.length} ห้อง</Badge>
              </div>
              <div className="flex items-center gap-2">
                {isMobile && floorHasUnsaved && (
                  <Button onClick={() => { floorRooms.forEach(room => { const data = cardReadings[room.id]; if (data?.water_current && data?.electricity_current) handleSaveSingleReading(room.id); }); }} size="sm" className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                    <Save className="w-4 h-4 mr-1" />บันทึกชั้นนี้
                  </Button>
                )}
                <Button onClick={() => setViewMode('table')} variant="outline" size="sm" className="border-slate-400 text-slate-600 hover:bg-slate-50">
                  <List className="w-4 h-4 mr-1" />ตาราง
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence>
                {floorRooms.map(room => {
                  const booking = getActiveBooking(room.id);
                  const tenant = booking ? getTenantInfo(booking.tenant_id) : null;
                  const latest = getLatestReading(room.id);
                  const hasReading = !!latest;
                  const recorded = hasRecordedThisMonth(room.id);

                  const inputForm = (
                    <div className="space-y-3">
                      {latest && (
                        <div onClick={() => { if (!canEdit) { toast.error('คุณไม่มีสิทธิ์แก้ไขมิเตอร์'); return; } handleViewHistory(room); setEditingReading({ id: latest.id, water_previous: latest.water_previous, water_current: latest.water_current, electricity_previous: latest.electricity_previous, electricity_current: latest.electricity_current }); }} className={`bg-blue-50 rounded-lg p-2 mb-2 ${canEdit ? 'cursor-pointer hover:bg-blue-100 transition-colors' : 'opacity-60'}`}>
                          <p className="text-xs text-slate-600 mb-1">ค่ามิเตอร์ครั้งก่อน: {canEdit ? '(คลิกแก้ไข)' : '(ดูอย่างเดียว)'}</p>
                          <div className="flex items-center gap-3 text-xs">
                            <div className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-600" /><span className="text-slate-600">น้ำ:</span><span className="font-bold text-blue-600">{latest.water_current}</span></div>
                            <div className="flex items-center gap-1"><Zap className="w-3 h-3 text-yellow-600" /><span className="text-slate-600">ไฟ:</span><span className="font-bold text-yellow-600">{latest.electricity_current}</span></div>
                          </div>
                        </div>
                      )}
                      {recorded && showAddMoreFormForRoom !== room.id ? (
                        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4 text-center">
                          <div className="flex items-center justify-center gap-2 mb-2"><Check className="w-5 h-5 text-green-600" /><p className="text-sm font-bold text-green-700">เดือนนี้บันทึกแล้ว</p></div>
                          {isMobile && latest && <div className="flex justify-center gap-4 text-xs text-slate-600 mb-3"><span>น้ำ: {latest.water_units} หน่วย</span><span>ไฟ: {latest.electricity_units} หน่วย</span></div>}
                          <Button onClick={() => setShowAddMoreFormForRoom(room.id)} size="sm" variant="outline" className="border-green-600 text-green-600 hover:bg-green-50"><Plus className="w-3 h-3 mr-1" />บันทึกเพิ่ม</Button>
                        </div>
                      ) : (
                        <>
                          {recorded && <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-2"><p className="text-xs text-amber-700 text-center">⚠️ เดือนนี้บันทึกแล้ว - กำลังบันทึกเพิ่ม</p></div>}
                          {!latest && <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-3"><p className="text-sm text-amber-800 font-medium flex items-center gap-2"><AlertTriangle className="w-4 h-4" />บันทึกครั้งแรก (ตั้งต้น)</p><p className="text-xs text-amber-700 mt-1">กรุณาระบุเลขมิเตอร์ตั้งต้น (ครั้งก่อน) เพื่อใช้คำนวณยอดหน่วยที่ใช้จริง</p></div>}
                          <div className="grid grid-cols-2 gap-2">
                            {!latest && <>
                              <div><Label className="text-xs">น้ำ ครั้งก่อน</Label><Input type="number" step="0.01" placeholder="0" value={cardReadings[room.id]?.water_previous || ''} onChange={(e) => setCardReadings(prev => ({...prev, [room.id]: {...prev[room.id], water_previous: e.target.value}}))} disabled={!canAdd || createSingleMutation.isPending} className="h-9 text-sm" /></div>
                              <div><Label className="text-xs">ไฟ ครั้งก่อน</Label><Input type="number" step="0.01" placeholder="0" value={cardReadings[room.id]?.electricity_previous || ''} onChange={(e) => setCardReadings(prev => ({...prev, [room.id]: {...prev[room.id], electricity_previous: e.target.value}}))} disabled={!canAdd || createSingleMutation.isPending} className="h-9 text-sm" /></div>
                            </>}
                            <div><Label className="text-xs">น้ำปัจจุบัน</Label><Input type="number" step="0.01" placeholder="150.5" value={cardReadings[room.id]?.water_current || ''} onChange={(e) => setCardReadings(prev => ({...prev, [room.id]: {...prev[room.id], water_current: e.target.value}}))} disabled={!canAdd || createSingleMutation.isPending} className="h-9 text-sm" /></div>
                            <div><Label className="text-xs">ไฟปัจจุบัน</Label><Input type="number" step="0.01" placeholder="250.0" value={cardReadings[room.id]?.electricity_current || ''} onChange={(e) => setCardReadings(prev => ({...prev, [room.id]: {...prev[room.id], electricity_current: e.target.value}}))} disabled={!canAdd || createSingleMutation.isPending} className="h-9 text-sm" /></div>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={() => handleSaveSingleReading(room.id)} disabled={!canAdd || createSingleMutation.isPending || ((cardReadings[room.id]?.water_current == null || cardReadings[room.id]?.water_current === '') && (cardReadings[room.id]?.electricity_current == null || cardReadings[room.id]?.electricity_current === ''))} className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 h-9">
                              {createSingleMutation.isPending ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />กำลังบันทึก...</> : <><Check className="w-4 h-4 mr-2" />บันทึก</>}
                            </Button>
                            {recorded && showAddMoreFormForRoom === room.id && (
                              <Button onClick={() => { setShowAddMoreFormForRoom(null); setCardReadings(prev => { const s = {...prev}; delete s[room.id]; return s; }); }} size="sm" variant="outline" className="h-9"><X className="w-4 h-4" /></Button>
                            )}
                          </div>
                        </>
                      )}
                      {latest && <div className="pt-3 border-t text-center"><p className="text-xs text-slate-500">บันทึกล่าสุด: {format(parseISO(latest.reading_date), 'd MMM yyyy', { locale: th })}</p><div className="flex justify-center gap-4 mt-2 text-xs"><span className="text-blue-600">ใช้น้ำ: {latest.water_units} หน่วย</span><span className="text-yellow-600">ใช้ไฟ: {latest.electricity_units} หน่วย</span></div></div>}
                    </div>
                  );

                  const emptyState = (
                    <button onClick={() => setShowAddMoreFormForRoom(room.id)} className="w-full flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-blue-300 rounded-xl bg-gradient-to-br from-blue-50 to-sky-50 cursor-pointer hover:border-blue-500 hover:from-blue-100 hover:to-sky-100 hover:shadow-md transition-all active:scale-95 group">
                      <div className="w-16 h-16 rounded-full bg-white border-2 border-blue-200 flex items-center justify-center mb-3 group-hover:border-blue-400 transition-colors shadow-sm"><Plus className="w-8 h-8 text-blue-600" /></div>
                      <p className="text-slate-700 font-semibold mb-1">ยังไม่มีการบันทึก</p>
                      <p className="text-sm text-slate-500">เป็นครั้งแรกในการบันทึกมิเตอร์</p>
                    </button>
                  );

                  return (
                    <motion.div key={room.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                      <Card className={`bg-white/80 backdrop-blur-sm shadow-xl hover:shadow-2xl transition-all ${recorded ? 'border-2 border-green-500' : 'border-slate-200/60'}`}>
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <h3 className="text-xl font-bold text-slate-800">ห้อง {room.room_number}</h3>
                              {isMobile && recorded && <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white"><Check className="w-3 h-3 mr-1" />บันทึกแล้ว</Badge>}
                              {tenant && <p className="text-sm text-slate-500 ml-2">{tenant.full_name}</p>}
                            </div>
                            {hasReading && <Button size="sm" variant="ghost" onClick={() => handleViewHistory(room)} className="text-blue-600 hover:text-blue-700"><History className="w-4 h-4" /></Button>}
                          </div>
                          {!hasReading && showAddMoreFormForRoom !== room.id ? emptyState : inputForm}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
}