import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users, Home, CheckSquare, Square, AlertTriangle, Info } from "lucide-react";
import { motion } from "framer-motion";

export default function BulkTenantGenerator({ open, onOpenChange, rooms, onConfirm, isLoading }) {
  const [selectedRoomIds, setSelectedRoomIds] = useState([]);

  // กรองเฉพาะห้องว่าง (available)
  const availableRooms = useMemo(() => {
    return rooms
      .filter(room => room.status === 'available')
      .sort((a, b) => {
        if (a.floor !== b.floor) return a.floor - b.floor;
        return a.room_number.localeCompare(b.room_number);
      });
  }, [rooms]);

  // จัดกลุ่มห้องตามชั้น
  const roomsByFloor = useMemo(() => {
    return availableRooms.reduce((acc, room) => {
      const floor = room.floor || 1;
      if (!acc[floor]) acc[floor] = [];
      acc[floor].push(room);
      return acc;
    }, {});
  }, [availableRooms]);

  const floors = Object.keys(roomsByFloor).sort((a, b) => parseInt(a) - parseInt(b));

  const toggleRoom = (roomId) => {
    setSelectedRoomIds(prev => 
      prev.includes(roomId) 
        ? prev.filter(id => id !== roomId)
        : [...prev, roomId]
    );
  };

  const selectAll = () => {
    setSelectedRoomIds(availableRooms.map(r => r.id));
  };

  const deselectAll = () => {
    setSelectedRoomIds([]);
  };

  const handleConfirm = () => {
    onConfirm(selectedRoomIds);
    setSelectedRoomIds([]);
  };

  const handleClose = () => {
    setSelectedRoomIds([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Users className="w-6 h-6 text-blue-600" />
            สร้างผู้เช่าจำนวนมาก
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* คำอธิบาย */}
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p className="font-semibold text-blue-900">ℹ️ วิธีใช้งาน:</p>
                  <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                    <li>เลือกห้องที่ต้องการสร้างผู้เช่า</li>
                    <li>ระบบจะสร้างผู้เช่าใหม่ โดยใช้ <strong>เลขห้อง</strong> เป็นชื่อผู้เช่า</li>
                    <li>สร้างการจองห้องพร้อมกัน (สัญญา 1 ปี)</li>
                    <li>อัพเดทสถานะห้องเป็น "มีผู้เช่า" อัตโนมัติ</li>
                  </ul>
                  <p className="text-xs text-blue-700 mt-2">
                    💡 <strong>หมายเหตุ:</strong> ข้อมูลผู้เช่าสามารถแก้ไขได้ในภายหลัง และผู้เช่าสามารถเชื่อมต่อ LINE ได้เอง
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ปุ่ม Select All / Deselect All */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              ห้องว่างทั้งหมด: <strong>{availableRooms.length}</strong> ห้อง
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAll}
                className="border-blue-300 text-blue-600 hover:bg-blue-50"
              >
                <CheckSquare className="w-4 h-4 mr-1" />
                เลือกทั้งหมด ({availableRooms.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={deselectAll}
                className="border-slate-300 text-slate-600 hover:bg-slate-50"
              >
                <Square className="w-4 h-4 mr-1" />
                ยกเลิกทั้งหมด
              </Button>
            </div>
          </div>

          {/* แสดงจำนวนที่เลือก */}
          {selectedRoomIds.length > 0 && (
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-5 h-5 text-green-600" />
                  <p className="font-semibold text-green-800">
                    เลือกแล้ว {selectedRoomIds.length} ห้อง → จะสร้างผู้เช่า {selectedRoomIds.length} คน
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Grid แสดงห้อง */}
          {floors.length === 0 ? (
            <Card className="bg-slate-50">
              <CardContent className="p-12 text-center">
                <Home className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-slate-700 mb-2">ไม่มีห้องว่าง</h3>
                <p className="text-slate-500">ทุกห้องมีผู้เช่าแล้ว หรือยังไม่มีห้องในระบบ</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6 max-h-[50vh] overflow-y-auto pr-2">
              {floors.map(floor => (
                <div key={floor}>
                  <div className="flex items-center gap-3 mb-3 sticky top-0 bg-white/95 backdrop-blur-sm py-2 z-10">
                    <Badge className="bg-blue-100 text-blue-700 text-sm px-3 py-1">
                      ชั้น {floor}
                    </Badge>
                    <span className="text-sm text-slate-500">
                      ({roomsByFloor[floor].length} ห้อง)
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                    {roomsByFloor[floor].map(room => {
                      const isSelected = selectedRoomIds.includes(room.id);
                      
                      return (
                        <motion.div
                          key={room.id}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Card
                            className={`cursor-pointer transition-all ${
                              isSelected 
                                ? 'border-2 border-blue-500 bg-blue-50 shadow-lg' 
                                : 'border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                            }`}
                            onClick={() => toggleRoom(room.id)}
                          >
                            <CardContent className="p-3 relative">
                              {/* Checkbox */}
                              <div className="absolute top-2 right-2">
                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                  isSelected 
                                    ? 'bg-blue-600 border-blue-600' 
                                    : 'bg-white border-slate-300'
                                }`}>
                                  {isSelected && (
                                    <CheckSquare className="w-4 h-4 text-white" />
                                  )}
                                </div>
                              </div>

                              {/* Room Number */}
                              <div className="text-center">
                                <div className={`font-bold text-lg mb-1 ${
                                  isSelected ? 'text-blue-700' : 'text-slate-800'
                                }`}>
                                  {room.room_number}
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {room.price?.toLocaleString()}฿
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isLoading}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedRoomIds.length === 0 || isLoading}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                กำลังสร้าง...
              </>
            ) : (
              <>
                <Users className="w-4 h-4 mr-2" />
                สร้างผู้เช่า {selectedRoomIds.length} คน
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}