import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { TestTube, Upload, Loader2 } from "lucide-react";

export default function TestSlipUploader() {
  const [branches, setBranches] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // โหลดสาขาตอนเริ่มต้น
  useEffect(() => {
    const loadBranches = async () => {
      try {
        const data = await base44.entities.Branch.list();
        setBranches(data.filter(b => b.status === 'active'));
      } catch (error) {
        console.error('Error loading branches:', error);
      }
    };
    loadBranches();
  }, []);

  // โหลดห้องทั้งหมด (ไม่บังคับต้องเลือกสาขา)
  useEffect(() => {
    const loadRooms = async () => {
      setLoading(true);
      try {
        const allRooms = await base44.entities.Room.list('-room_number', 500);
        // ถ้าเลือกสาขา ให้แสดงเฉพาะห้องของสาขานั้น ถ้าไม่ได้เลือก แสดงทั้งหมด
        const filteredRooms = selectedBranchId 
          ? allRooms.filter(r => r.branch_id === selectedBranchId)
          : allRooms;
        setRooms(filteredRooms);
        setSelectedRoomId('');
      } catch (error) {
        console.error('Error loading rooms:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRooms();
  }, [selectedBranchId]);

  // โหลด Payment เมื่อเลือกห้อง - ใช้ filter เพื่อดึงเฉพาะห้องที่เลือก
  useEffect(() => {
    if (!selectedRoomId) {
      setPayments([]);
      return;
    }

    const loadPayments = async () => {
      try {
        // ⭐ ใช้ filter แทน list เพื่อดึงเฉพาะบิลของห้องนี้ (ลด payload size)
        const pendingPayments = await base44.entities.Payment.filter(
          { room_id: selectedRoomId, status: 'pending' }, 
          '-created_date', 
          50
        );
        const overduePayments = await base44.entities.Payment.filter(
          { room_id: selectedRoomId, status: 'overdue' }, 
          '-created_date', 
          50
        );
        
        const roomPayments = [...pendingPayments, ...overduePayments];
        setPayments(roomPayments);
      } catch (error) {
        console.error('Error loading payments:', error);
      }
    };
    loadPayments();
  }, [selectedRoomId]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!selectedRoomId) {
      toast.error('กรุณาเลือกห้องก่อน');
      e.target.value = '';
      return;
    }

    setUploading(true);
    const toastId = toast.loading('กำลังอัพโหลดสลิปทดสอบ...');

    try {
      // อัพโหลดไฟล์
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const selectedRoom = rooms.find(r => r.id === selectedRoomId);
      const selectedBranch = branches.find(b => b.id === selectedBranchId);

      // ถ้ามีบิลรอชำระ อัพเดตบิลแรก ถ้าไม่มี แค่แสดงข้อมูล
      if (payments.length > 0) {
        const testPayment = payments[0];
        await base44.entities.Payment.update(testPayment.id, {
          payment_slip_url: file_url,
          notes: `${testPayment.notes || ''}\n\n⚠️ รอตรวจสอบซ้ำ: ห้อง ${selectedRoom?.room_number} - [TEST] ทดสอบระบบตรวจสอบสลิป - ${new Date().toISOString()}`
        });

        toast.success(`✅ บันทึกสลิปทดสอบสำเร็จ\nห้อง ${selectedRoom?.room_number} (${selectedBranch?.branch_name})\n💰 ยอดบิล: ${testPayment.total_amount?.toLocaleString() || 0} บาท`, { 
          id: toastId, 
          duration: 5000 
        });
      } else {
        toast.success(`✅ อัพโหลดสลิปสำเร็จ\nห้อง ${selectedRoom?.room_number} (${selectedBranch?.branch_name})\n(ไม่มีบิลรอชำระ - เพื่อทดสอบเท่านั้น)`, { 
          id: toastId, 
          duration: 5000 
        });
      }

      e.target.value = '';
    } catch (error) {
      console.error(error);
      toast.error('เกิดข้อผิดพลาด: ' + error.message, { id: toastId });
      e.target.value = '';
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-300 shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="bg-purple-100 p-2.5 rounded-xl">
            <TestTube className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <p className="font-bold text-purple-900 mb-1">🧪 ทดสอบระบบตรวจสอบสลิป</p>
              <p className="text-xs text-purple-700">
                เลือกสาขาและห้อง แล้วอัพโหลดสลิปเพื่อทดสอบ - ระบบจะบันทึกสลิปและตั้งสถานะเป็น "รอตรวจสอบ"
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="text-sm bg-white">
                  <SelectValue placeholder="เลือกสาขา" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.branch_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={selectedRoomId} 
                onValueChange={setSelectedRoomId}
                disabled={loading || rooms.length === 0}
              >
                <SelectTrigger className="text-sm bg-white">
                  <SelectValue placeholder={loading ? "กำลังโหลด..." : "เลือกห้อง"} />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map(room => (
                    <SelectItem key={room.id} value={room.id}>
                      ห้อง {room.room_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRoomId && payments.length > 0 && (
              <div className="text-xs text-green-600">
                <p>✅ พบบิลรอชำระ {payments.length} รายการ</p>
                <p className="font-semibold">💰 ยอดบิล: {payments[0]?.total_amount?.toLocaleString() || 0} บาท</p>
              </div>
            )}

            {selectedRoomId && payments.length === 0 && (
              <div className="text-xs text-blue-600">
                ℹ️ ไม่มีบิลรอชำระ - สลิปนี้เพื่อทดสอบเท่านั้น
              </div>
            )}

            <div className="flex items-center gap-2">
              <Input 
                type="file" 
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleUpload}
                disabled={!selectedRoomId || uploading}
                className="text-sm flex-1"
              />
              {uploading && <Loader2 className="w-4 h-4 animate-spin text-purple-600" />}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}