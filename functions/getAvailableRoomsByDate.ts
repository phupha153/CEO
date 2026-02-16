import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const { branch_id, check_in_date } = await req.json();

    if (!branch_id || !check_in_date) {
      return Response.json({ 
        error: 'ต้องระบุ branch_id และ check_in_date' 
      }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // ดึงห้องพักทั้งหมดในสาขา
    const allRooms = await base44.entities.Room.filter({ 
      branch_id 
    }, '', 500);

    // ดึงการจองที่ active ทั้งหมดในสาขา
    const activeBookings = await base44.entities.Booking.filter({
      branch_id,
      status: 'active'
    }, '', 500);

    // เช็คว่าห้องไหนถูกจองในวันที่เลือก
    const selectedDate = new Date(check_in_date);
    selectedDate.setHours(0, 0, 0, 0);

    const occupiedRoomIds = new Set();

    for (const booking of activeBookings) {
      if (!booking.check_in_date) continue;
      
      const checkInDate = new Date(booking.check_in_date);
      checkInDate.setHours(0, 0, 0, 0);

      // ถ้ามี check_out_date ให้เช็คว่าวันที่เลือกอยู่ในช่วงการจองหรือไม่
      if (booking.check_out_date) {
        const checkOutDate = new Date(booking.check_out_date);
        checkOutDate.setHours(0, 0, 0, 0);

        if (selectedDate >= checkInDate && selectedDate < checkOutDate) {
          occupiedRoomIds.add(booking.room_id);
        }
      } else {
        // ถ้าไม่มี check_out_date (รายเดือน) ถือว่าห้องถูกจองตั้งแต่วันเข้าพักเป็นต้นไป
        if (selectedDate >= checkInDate) {
          occupiedRoomIds.add(booking.room_id);
        }
      }
    }

    // กรองเฉพาะห้องที่ไม่ถูกจองในวันที่เลือก
    const availableRooms = allRooms.filter(room => 
      !occupiedRoomIds.has(room.id)
    );

    return Response.json({ 
      rooms: availableRooms,
      total: availableRooms.length,
      check_in_date 
    });

  } catch (error) {
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});