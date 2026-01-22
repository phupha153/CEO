import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Building2, Check, ArrowRight, ArrowLeft, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function BulkRoomGenerator({ open, onOpenChange, branchId, onSuccess }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  
  // Step 1: Configuration
  const [config, setConfig] = useState({
    floors: "",
    roomsPerFloor: "",
    price: "",
    roomType: "monthly",
    floorStart: "1",
    roomStart: "1"
  });

  // Step 2: Generated Data
  const [generatedRooms, setGeneratedRooms] = useState([]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(1);
      setConfig({
        floors: "",
        roomsPerFloor: "",
        price: "",
        roomType: "monthly",
        floorStart: "1",
        roomStart: "1"
      });
      setGeneratedRooms([]);
    }
  }, [open]);

  const handleGenerate = () => {
    const floors = parseInt(config.floors);
    const roomsPerFloor = parseInt(config.roomsPerFloor);
    const startFloor = parseInt(config.floorStart) || 1;
    const startRoom = parseInt(config.roomStart) || 1;
    const price = parseFloat(config.price) || 0;

    if (!floors || !roomsPerFloor) {
      toast.error("กรุณาระบุจำนวนชั้นและจำนวนห้องต่อชั้น");
      return;
    }

    const rooms = [];
    // Generate rooms for each floor
    for (let f = 0; f < floors; f++) {
      const floorNum = startFloor + f;
      for (let r = 0; r < roomsPerFloor; r++) {
        // Room number in floor: if startRoom=1 and r=0 → roomInFloor=1 (room 01)
        const roomInFloor = startRoom + r;
        // Format: Floor + 2-digit room number (e.g., 101, 102, 103...)
        const roomNum = `${floorNum}${String(roomInFloor).padStart(2, '0')}`;
        
        rooms.push({
          room_number: roomNum,
          floor: floorNum,
          room_type: config.roomType,
          price: price,
          status: 'available',
          size: '',
          water_rate: '',
          electricity_rate: '',
          common_fee: ''
        });
      }
    }
    
    console.log('🏠 Generated rooms:', rooms.length, 'First room:', rooms[0]?.room_number);

    setGeneratedRooms(rooms);
    setStep(2);
  };

  const handleRoomChange = (globalIndex, field, value) => {
    const newRooms = [...generatedRooms];
    // Convert to appropriate type based on field
    let convertedValue = value;
    if (field === 'floor' || field === 'price' || field === 'size' || field === 'water_rate' || field === 'electricity_rate') {
      convertedValue = value === '' ? '' : (field === 'floor' ? parseInt(value) || 0 : parseFloat(value) || 0);
    }
    newRooms[globalIndex] = { ...newRooms[globalIndex], [field]: convertedValue };
    setGeneratedRooms(newRooms);
  };

  const handleDeleteRoom = (globalIndex) => {
    const newRooms = generatedRooms.filter((_, idx) => idx !== globalIndex);
    setGeneratedRooms(newRooms);
    toast.success('ลบห้องออกจากรายการแล้ว');
  };

  const handleSave = async () => {
    if (!branchId) {
      toast.error("ไม่พบข้อมูลสาขา");
      return;
    }

    setSaving(true);
    try {
      // Prepare data for API
      const roomsToCreate = generatedRooms.map(room => ({
        ...room,
        branch_id: branchId,
        floor: parseInt(room.floor),
        price: parseFloat(room.price) || 0,
        size: room.size ? parseFloat(room.size) : undefined,
        water_rate: room.water_rate ? parseFloat(room.water_rate) : undefined,
        electricity_rate: room.electricity_rate ? parseFloat(room.electricity_rate) : undefined,
        common_fee: room.common_fee ? parseFloat(room.common_fee) : undefined,
      }));

      await base44.entities.Room.bulkCreate(roomsToCreate);
      
      toast.success(`สร้างห้องพักสำเร็จ ${roomsToCreate.length} ห้อง`);
      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("Bulk create error:", error);
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen && !saving) {
        onOpenChange(false);
      }
    }}>
      <DialogContent 
        className="max-w-4xl max-h-[90vh] flex flex-col"
        onPointerDownOutside={(e) => {
          if (saving) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (saving) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            สร้างห้องพักจำนวนมาก
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-1">
          {step === 1 ? (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>จำนวนชั้น</Label>
                  <Input 
                    type="number" 
                    placeholder="เช่น 5" 
                    value={config.floors}
                    onChange={(e) => setConfig({...config, floors: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>จำนวนห้องต่อชั้น</Label>
                  <Input 
                    type="number" 
                    placeholder="เช่น 10" 
                    value={config.roomsPerFloor}
                    onChange={(e) => setConfig({...config, roomsPerFloor: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>เลขชั้นเริ่มต้น</Label>
                  <Input 
                    type="number" 
                    placeholder="ปกติเริ่มที่ 1" 
                    value={config.floorStart}
                    onChange={(e) => setConfig({...config, floorStart: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>เลขห้องเริ่มต้น (ต่อชั้น)</Label>
                  <Input 
                    type="number" 
                    placeholder="ปกติเริ่มที่ 1" 
                    value={config.roomStart}
                    onChange={(e) => setConfig({...config, roomStart: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ประเภทห้อง (ค่าเริ่มต้น)</Label>
                  <Select 
                    value={config.roomType} 
                    onValueChange={(v) => setConfig({...config, roomType: v})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">รายเดือน</SelectItem>
                      <SelectItem value="daily">รายวัน</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>ราคาค่าเช่า (ค่าเริ่มต้น)</Label>
                  <Input 
                    type="number" 
                    placeholder="บาท" 
                    value={config.price}
                    onChange={(e) => setConfig({...config, price: e.target.value})}
                  />
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                <p className="font-semibold mb-1">💡 ตัวอย่างการสร้าง</p>
                <p>ถ้าเลือก 5 ชั้น, 10 ห้องต่อชั้น, เริ่มชั้น 1, เริ่มห้อง 1:</p>
                <p>ระบบจะสร้างห้องเลขที่ 101-110, 201-210, ..., 501-510</p>
                <p className="mt-1">ถ้าเริ่มห้อง 2: จะได้ 102-111, 202-211, ..., 502-511</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="font-semibold text-slate-700">
                  รายการห้องที่จะสร้าง ({generatedRooms.length} ห้อง)
                </h3>
                <p className="text-xs text-slate-500">
                  * สามารถแก้ไขข้อมูลในตารางได้ก่อนบันทึก
                </p>
              </div>
              
              <div className="border rounded-lg overflow-hidden bg-white h-[450px] flex flex-col">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-20">
                    <TableRow>
                      <TableHead className="w-[100px]">เลขห้อง</TableHead>
                      <TableHead className="w-[80px]">ชั้น</TableHead>
                      <TableHead className="w-[120px]">ประเภท</TableHead>
                      <TableHead className="w-[120px]">ราคา</TableHead>
                      <TableHead className="w-[100px]">ขนาด (ตร.ม.)</TableHead>
                      <TableHead className="w-[120px]">ค่าน้ำ/หน่วย</TableHead>
                      <TableHead className="w-[120px]">ค่าไฟ/หน่วย</TableHead>
                      <TableHead className="w-[80px]">ลบ</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
                <div className="overflow-auto flex-1">
                  {Array.from(new Set(generatedRooms.map(r => r.floor))).sort((a,b) => a - b).map(floor => (
                    <div key={floor} className="mb-0">
                      <div className="bg-slate-100 px-4 py-2 font-semibold text-slate-700 border-b border-t">
                        ชั้น {floor}
                      </div>
                      <Table>
                        <TableBody>
                          {generatedRooms.map((room, globalIndex) => {
                            if (room.floor !== floor) return null;
                            return (
                              <TableRow key={globalIndex} className="hover:bg-blue-50/50">
                                <TableCell className="w-[100px]">
                                  <Input 
                                    value={room.room_number} 
                                    onChange={(e) => handleRoomChange(globalIndex, 'room_number', e.target.value)}
                                    className="h-8"
                                    placeholder="เลขห้อง"
                                  />
                                </TableCell>
                                <TableCell className="w-[80px]">
                                  <Input 
                                    type="number"
                                    value={room.floor} 
                                    onChange={(e) => handleRoomChange(globalIndex, 'floor', e.target.value)}
                                    className="h-8"
                                    placeholder="ชั้น"
                                  />
                                </TableCell>
                                <TableCell className="w-[120px]">
                                  <Select 
                                    value={room.room_type} 
                                    onValueChange={(v) => handleRoomChange(globalIndex, 'room_type', v)}
                                  >
                                    <SelectTrigger className="h-8">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="monthly">รายเดือน</SelectItem>
                                      <SelectItem value="daily">รายวัน</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell className="w-[120px]">
                                  <Input 
                                    type="number"
                                    value={room.price} 
                                    onChange={(e) => handleRoomChange(globalIndex, 'price', e.target.value)}
                                    className="h-8"
                                    placeholder="ราคา"
                                  />
                                </TableCell>
                                <TableCell className="w-[100px]">
                                  <Input 
                                    type="number"
                                    value={room.size} 
                                    placeholder="ขนาด"
                                    onChange={(e) => handleRoomChange(globalIndex, 'size', e.target.value)}
                                    className="h-8"
                                  />
                                </TableCell>
                                <TableCell className="w-[120px]">
                                  <Input 
                                    type="number"
                                    value={room.water_rate} 
                                    placeholder="น้ำ(กลาง)"
                                    onChange={(e) => handleRoomChange(globalIndex, 'water_rate', e.target.value)}
                                    className="h-8"
                                  />
                                </TableCell>
                                <TableCell className="w-[120px]">
                                  <Input 
                                    type="number"
                                    value={room.electricity_rate} 
                                    placeholder="ไฟ(กลาง)"
                                    onChange={(e) => handleRoomChange(globalIndex, 'electricity_rate', e.target.value)}
                                    className="h-8"
                                  />
                                </TableCell>
                                <TableCell className="w-[80px]">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteRoom(globalIndex)}
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 border-t pt-4">
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleGenerate} className="bg-blue-600 hover:bg-blue-700">
                ถัดไป <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep(1)} disabled={saving}>
                <ArrowLeft className="w-4 h-4 mr-2" /> ย้อนกลับ
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-green-600 hover:bg-green-700">
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4 mr-2" /> ยืนยันการสร้าง {generatedRooms.length} ห้อง
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}