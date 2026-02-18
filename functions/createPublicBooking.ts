import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Validate required fields
    const { 
      guest_name, 
      guest_phone, 
      room_id, 
      branch_id, 
      check_in_date,
      check_out_date,
      booking_type,
      number_of_guests
    } = payload;
    
    if (!guest_name || !guest_phone || !room_id || !branch_id) {
      return Response.json({ 
        error: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (ชื่อ, เบอร์โทร, ห้อง)' 
      }, { status: 400 });
    }

    if (booking_type === 'daily' && (!check_out_date || check_out_date.trim() === '')) {
      return Response.json({ 
        error: 'กรุณาระบุวันที่เช็คเอาท์สำหรับการจองรายวัน' 
      }, { status: 400 });
    }

    // ⚡ Use service role for backend operations
    // 1. Check if room exists
    const rooms = await base44.asServiceRole.entities.Room.filter({
      id: room_id,
      branch_id: branch_id
    });

    if (!rooms || rooms.length === 0) {
      return Response.json({ 
        error: 'ห้องไม่พบในระบบ กรุณาเลือกห้องอื่น' 
      }, { status: 400 });
    }

    const room = rooms[0];

    // 2. Check actual availability by querying active bookings on the selected date
    const searchDate = new Date(check_in_date);
    const [activeBookings, tempBookings] = await Promise.all([
      base44.asServiceRole.entities.Booking.filter({
        room_id: room_id,
        branch_id: branch_id,
        status: 'active'
      }),
      base44.asServiceRole.entities.TemporaryBooking.filter({
        room_id: room_id,
        branch_id: branch_id
      })
    ]);

    // Check if room is booked on the selected date
    const allBookings = [...(activeBookings || []), ...(tempBookings || [])];
    const isBooked = allBookings.some(booking => {
      const checkIn = new Date(booking.check_in_date);
      const checkOut = booking.check_out_date ? new Date(booking.check_out_date) : null;
      
      if (checkOut) {
        return searchDate >= checkIn && searchDate < checkOut;
      } else {
        return booking.room_id === room_id;
      }
    });

    if (isBooked) {
      return Response.json({ 
        error: 'ห้องนี้ไม่ว่างในวันที่เลือก กรุณาเลือกห้องหรือวันอื่น' 
      }, { status: 400 });
    }

    // 3. Create temporary booking (TemporaryBooking entity only, not Booking)
    const bookingData = {
      branch_id,
      room_id,
      guest_name,
      guest_phone,
      guest_email: payload.guest_email || '',
      guest_national_id: payload.guest_national_id || '',
      guest_address: payload.guest_address || '',
      check_in_date: check_in_date || new Date().toISOString().split('T')[0],
      check_out_date: check_out_date || null,
      booking_type: booking_type || room.room_type,
      number_of_guests: number_of_guests || 1,
      status: 'active',
      booking_no: `TMP-${Date.now()}`,
      deposit_amount: 200,
      deposit_slip_url: payload.deposit_slip_url || ''
    };

    const booking = await base44.asServiceRole.entities.TemporaryBooking.create(bookingData);

    // 4. Update room status to reserved
    await base44.asServiceRole.entities.Room.update(room_id, {
      status: 'reserved'
    });

    // 5. Send notification to admins (optional - using service role for SendEmail)
    try {
      const branch = await base44.asServiceRole.entities.Branch.filter({ id: branch_id });
      const branchName = branch[0]?.branch_name || 'สาขา';
      
      const adminEmail = Deno.env.get('admin_email') || 'phupha20517@gmail.com';
      
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: adminEmail,
        subject: `🔔 มีการจองห้องใหม่ - ${branchName}`,
        body: `
มีการจองห้องใหม่จากระบบออนไลน์:

📍 สาขา: ${branchName}
🚪 ห้อง: ${room.room_number} (ชั้น ${room.floor})
👤 ผู้จอง: ${guest_name}
👥 จำนวนผู้เข้าพัก: ${number_of_guests || 1} คน
📞 เบอร์: ${guest_phone}
📧 อีเมล: ${payload.guest_email || '-'}
📅 วันเข้าพัก: ${check_in_date || 'ไม่ระบุ'}
${check_out_date ? `📅 วันเช็คเอาท์: ${check_out_date}` : ''}
📝 ประเภท: ${booking_type === 'monthly' ? 'รายเดือน' : 'รายวัน'}

กรุณาติดต่อผู้จองเพื่อยืนยันและดำเนินการต่อ
        `.trim()
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't fail the booking if email fails
    }

    return Response.json({
      success: true,
      message: 'จองห้องสำเร็จ! ทางสาขาจะติดต่อกลับไปเร็วๆ นี้',
      booking_id: booking.id,
      booking_no: booking.booking_no
    });

  } catch (error) {
    console.error('Create public booking error:', error);
    return Response.json({ 
      error: error.message || 'เกิดข้อผิดพลาดในการจอง กรุณาลองใหม่อีกครั้ง' 
    }, { status: 500 });
  }
});