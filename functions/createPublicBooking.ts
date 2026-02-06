import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const {
      branch_id,
      room_id,
      guest_name,
      guest_phone,
      guest_email,
      guest_national_id,
      guest_address,
      check_in_date,
      deposit_slip_url
    } = await req.json();

    // ✅ Validate inputs
    if (!branch_id || !room_id || !guest_name || !guest_phone || !check_in_date || !deposit_slip_url) {
      return Response.json({ error: 'ข้อมูลไม่ครบถ้วน' }, { status: 400 });
    }

    // 🔒 CRITICAL: ตรวจสอบว่า room อยู่ใน branch นี้จริง (ป้องกัน data leak)
    const room = await base44.asServiceRole.entities.Room.filter({
      id: room_id,
      branch_id: branch_id,
      status: 'available'
    });

    if (!room || room.length === 0) {
      return Response.json({ error: 'ห้องนี้ไม่ว่างหรือไม่พบในสาขานี้' }, { status: 400 });
    }

    const selectedRoom = room[0];

    // 🔒 ตรวจสอบว่าห้องนี้ยังไม่มีใครจองไปก่อนหน้านี้ (race condition)
    const existingBookings = await base44.asServiceRole.entities.TemporaryBooking.filter({
      room_id: room_id,
      status: 'pending'
    });

    if (existingBookings && existingBookings.length > 0) {
      return Response.json({ error: 'ห้องนี้มีคนจองไปแล้ว กรุณาเลือกห้องอื่น' }, { status: 409 });
    }

    // คำนวณเงินมัดจำ (50% ของค่าเช่า)
    const depositAmount = selectedRoom.price * 0.5;

    // สร้างเลขที่การจอง (format: BK-YYYYMMDD-XXXX)
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const booking_no = `BK-${dateStr}-${randomNum}`;

    // สร้าง TemporaryBooking
    const newBooking = await base44.asServiceRole.entities.TemporaryBooking.create({
      branch_id,
      room_id,
      guest_name,
      guest_phone,
      guest_email: guest_email || null,
      guest_national_id: guest_national_id || null,
      guest_address: guest_address || null,
      check_in_date,
      booking_no,
      deposit_amount: depositAmount,
      total_amount: depositAmount,
      deposit_slip_url,
      deposit_payment_method: 'transfer',
      status: 'pending', // รอ admin approve
      is_temporary_booking: true
    });

    // ⚠️ อัพเดทสถานะห้องเป็น 'reserved' (จองชั่วคราว)
    await base44.asServiceRole.entities.Room.update(room_id, {
      status: 'reserved'
    });

    // ✅ ส่ง response กลับ
    return Response.json({
      success: true,
      booking_no,
      booking_id: newBooking.id,
      room_number: selectedRoom.room_number,
      check_in_date,
      deposit_amount: depositAmount
    });

  } catch (error) {
    console.error('❌ createPublicBooking error:', error);
    return Response.json({ 
      error: 'เกิดข้อผิดพลาดในการจอง กรุณาลองใหม่อีกครั้ง',
      details: error.message 
    }, { status: 500 });
  }
});