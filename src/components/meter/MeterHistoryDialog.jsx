import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Pencil, Trash2, Droplets, Zap } from "lucide-react";
import { format, parseISO } from "date-fns";
import { th } from "date-fns/locale";

export default function MeterHistoryDialog({
  showDetailDialog,
  setShowDetailDialog,
  selectedReading,
  editingReading,
  setEditingReading,
  canEditHistory,
  userRole,
  canDelete,
  handleDeleteReading,
  updateMutation,
  deleteMutation
}) {
  return (
    <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            ประวัติการบันทึกมิเตอร์ - ห้อง {selectedReading?.room?.room_number}
          </DialogTitle>
        </DialogHeader>
        
        {selectedReading && (
          <div className="space-y-4">
            {selectedReading.tenant && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="p-4">
                  <p className="font-semibold text-slate-800">ผู้เช่า: {selectedReading.tenant.full_name}</p>
                  <p className="text-sm text-slate-600">โทร: {selectedReading.tenant.phone}</p>
                </CardContent>
              </Card>
            )}

            <div className="space-y-3">
              {selectedReading.readings.map((meterReading, index) => (
                <Card key={meterReading.id} className={index === 0 ? 'border-2 border-blue-500' : ''}>
                  <CardContent className="p-4">
                    {/* โหมดแก้ไข */}
                    {editingReading?.id === meterReading.id ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <p className="font-semibold text-slate-800">แก้ไขมิเตอร์</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingReading(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-xs text-blue-600">น้ำครั้งก่อน</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingReading.water_previous}
                              onChange={(e) => setEditingReading({...editingReading, water_previous: e.target.value})}
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-blue-600">น้ำปัจจุบัน</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingReading.water_current}
                              onChange={(e) => setEditingReading({...editingReading, water_current: e.target.value})}
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-yellow-600">ไฟครั้งก่อน</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingReading.electricity_previous}
                              onChange={(e) => setEditingReading({...editingReading, electricity_previous: e.target.value})}
                              className="h-9"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-yellow-600">ไฟปัจจุบัน</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={editingReading.electricity_current}
                              onChange={(e) => setEditingReading({...editingReading, electricity_current: e.target.value})}
                              className="h-9"
                            />
                          </div>
                        </div>
                        
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingReading(null)}>
                            ยกเลิก
                          </Button>
                          <Button 
                            size="sm"
                            disabled={updateMutation?.isPending}
                            onClick={() => {
                              updateMutation?.mutate({
                                id: editingReading.id,
                                data: {
                                  water_previous: editingReading.water_previous,
                                  water_current: editingReading.water_current,
                                  electricity_previous: editingReading.electricity_previous,
                                  electricity_current: editingReading.electricity_current
                                }
                              });
                              setEditingReading(null);
                            }}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            {updateMutation?.isPending ? 'กำลังบันทึก...' : 'บันทึก'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-800">
                              {format(parseISO(meterReading.reading_date), 'd MMMM yyyy', { locale: th })}
                            </p>
                            {index === 0 && <Badge className="mt-1 bg-blue-100 text-blue-700">ล่าสุด</Badge>}
                          </div>
                          
                          <div className="flex gap-1">
                            {/* ปุ่มแก้ไข - เจ้าของและ Developer แก้ได้เสมอ */}
                            {(canEditHistory || userRole === 'owner' || userRole === 'developer') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingReading({
                                  id: meterReading.id,
                                  water_previous: meterReading.water_previous,
                                  water_current: meterReading.water_current,
                                  electricity_previous: meterReading.electricity_previous,
                                  electricity_current: meterReading.electricity_current
                                })}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {/* ปุ่มลบ */}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteReading(meterReading, selectedReading.room.room_number)}
                                disabled={deleteMutation?.isPending}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-blue-600">
                              <Droplets className="w-4 h-4" />
                              <span className="font-semibold">น้ำ</span>
                            </div>
                            <div className="text-sm space-y-1 pl-6">
                              <p>ครั้งก่อน: <span className="font-medium">{meterReading.water_previous}</span></p>
                              <p>ครั้งนี้: <span className="font-medium">{meterReading.water_current}</span></p>
                              <p className="text-blue-600 font-bold">ใช้ไป: {meterReading.water_units} หน่วย</p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-yellow-600">
                              <Zap className="w-4 h-4" />
                              <span className="font-semibold">ไฟ</span>
                            </div>
                            <div className="text-sm space-y-1 pl-6">
                              <p>ครั้งก่อน: <span className="font-medium">{meterReading.electricity_previous}</span></p>
                              <p>ครั้งนี้: <span className="font-medium">{meterReading.electricity_current}</span></p>
                              <p className="text-yellow-600 font-bold">ใช้ไป: {meterReading.electricity_units} หน่วย</p>
                            </div>
                          </div>
                        </div>

                        {meterReading.notes && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-sm text-slate-600">{meterReading.notes}</p>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}