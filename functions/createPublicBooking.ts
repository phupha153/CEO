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

    if (!check_out_date || check_out_date.trim() === '') {
      return Response.json({ 
        error: 'กรุณาระบุวันที่เช็คเอาท์' 
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
    const reqStart = new Date(check_in_date || new Date().toISOString().split('T')[0]);
    const reqEnd = check_out_date ? new Date(check_out_date) : new Date(reqStart.getTime() + 24*60*60*1000);

    const [activeBookings, tempBookings] = await Promise.all([
      base44.asServiceRole.entities.Booking.filter({
        room_id: room_id,
        branch_id: branch_id,
        status: 'active'
      }, '', 1000),
      base44.asServiceRole.entities.TemporaryBooking.filter({
        room_id: room_id,
        branch_id: branch_id
      }, '', 1000)
    ]);

    // Check if room is booked on the selected date
    const allBookings = [...(activeBookings || []), ...(tempBookings || [])];
    let isBooked = allBookings.some(booking => {
      const checkIn = new Date(booking.check_in_date);
      const checkOut = booking.check_out_date ? new Date(booking.check_out_date) : null;
      
      if (checkOut) {
        return reqStart < checkOut && reqEnd > checkIn;
      } else {
        return reqEnd > checkIn;
      }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // ถ้าสถานะห้องไม่ใช่ 'available' (เช่น occupied หรือ reserved)
    // ให้บล็อกเฉพาะการจองที่เริ่มในวันนี้หรือก่อนหน้า
    // แต่ถ้าจองล่วงหน้าในอนาคต (reqStart > today) และไม่มีการทับซ้อนกับ booking เดิม จะให้จองได้
    if (!isBooked && room.status !== 'available' && reqStart <= today) {
      isBooked = true;
    }

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
      deposit_amount: payload.deposit_amount !== undefined ? payload.deposit_amount : 200,
      deposit_slip_url: payload.deposit_slip_url || '',
      line_user_id: payload.line_user_id || ''
    };

    const booking = await base44.asServiceRole.entities.TemporaryBooking.create(bookingData);

    // 4. Update room status to reserved
    await base44.asServiceRole.entities.Room.update(room_id, {
      status: 'reserved'
    });

    // 4.5 Create Payment record for deposit
    if (booking.deposit_amount > 0) {
      let totalRequired = 0;
      let notes = `เงินมัดจำการจองห้อง ${room.room_number} - ${guest_name}`;

      if (booking_type === 'monthly') {
        const securityDeposit = payload.security_deposit || 0;
        const advanceRent = payload.advance_rent || 0;
        const commonFee = payload.common_fee_included || 0;
        const otherAmount = payload.other_amount || 0;
        totalRequired = securityDeposit + advanceRent + commonFee + otherAmount;

        let details = [];
        if (securityDeposit > 0) details.push(`เงินประกัน: ${securityDeposit.toLocaleString()} บาท`);
        if (advanceRent > 0) details.push(`ค่าเช่าล่วงหน้า: ${advanceRent.toLocaleString()} บาท`);
        if (commonFee > 0) details.push(`ค่าส่วนกลางล่วงหน้า: ${commonFee.toLocaleString()} บาท`);
        if (otherAmount > 0) details.push(`ค่าอื่นๆ: ${otherAmount.toLocaleString()} บาท`);
        
        if (details.length > 0) {
          notes += `\n` + details.join('\n');
        }
      } else {
        const reqStart = new Date(check_in_date || new Date().toISOString().split('T')[0]);
        const reqEnd = check_out_date ? new Date(check_out_date) : new Date(reqStart.getTime() + 24*60*60*1000);
        const nights = Math.ceil(Math.abs(reqEnd - reqStart) / (1000 * 60 * 60 * 24)) || 1;
        totalRequired = nights * (room.price || 0);
      }

      const depositAmount = parseFloat(booking.deposit_amount || 0);
      const securityDeposit = booking_type === 'monthly' ? parseFloat(payload.security_deposit || 0) : 0;
      const advanceRent = booking_type === 'monthly' ? parseFloat(payload.advance_rent || 0) : 0;
      const commonFee = booking_type === 'monthly' ? parseFloat(payload.common_fee_included || 0) : 0;
      const otherAmount = booking_type === 'monthly' ? parseFloat(payload.other_amount || 0) : 0;
      const dueDate = check_in_date || new Date().toISOString().split('T')[0];

      if (totalRequired === 0) {
        totalRequired = depositAmount;
      }

      if (depositAmount > 0) {
        await base44.asServiceRole.entities.Payment.create({
          branch_id: branch_id,
          booking_id: booking.id,
          room_id: room_id,
          payment_category: 'booking_deposit',
          due_date: dueDate,
          late_fee_locked: true,
          total_amount: depositAmount,
          paid_amount: depositAmount,
          status: 'paid',
          payment_date: new Date().toISOString().split('T')[0],
          payment_slip_url: booking.deposit_slip_url || '',
          payment_method: 'transfer',
          line_user_id: payload.line_user_id || '',
          notes: `เงินจองห้อง/มัดจำห้อง ${room.room_number} - ${guest_name}`
        });
      }

      const actualRemaining = Math.max(0, totalRequired - depositAmount);

      if (actualRemaining > 0) {
        let remainingDepositToDeduct = depositAmount;
        let pendingSecDep = securityDeposit;
        let pendingAdvRent = advanceRent;
        let pendingCommon = commonFee;
        let pendingOther = otherAmount;

        if (remainingDepositToDeduct > 0) {
          if (remainingDepositToDeduct >= pendingSecDep) {
            remainingDepositToDeduct -= pendingSecDep;
            pendingSecDep = 0;
          } else {
            pendingSecDep -= remainingDepositToDeduct;
            remainingDepositToDeduct = 0;
          }
        }
        if (remainingDepositToDeduct > 0) {
          if (remainingDepositToDeduct >= pendingAdvRent) {
            remainingDepositToDeduct -= pendingAdvRent;
            pendingAdvRent = 0;
          } else {
            pendingAdvRent -= remainingDepositToDeduct;
            remainingDepositToDeduct = 0;
          }
        }
        if (remainingDepositToDeduct > 0) {
          if (remainingDepositToDeduct >= pendingCommon) {
            remainingDepositToDeduct -= pendingCommon;
            pendingCommon = 0;
          } else {
            pendingCommon -= remainingDepositToDeduct;
            remainingDepositToDeduct = 0;
          }
        }
        if (remainingDepositToDeduct > 0) {
          if (remainingDepositToDeduct >= pendingOther) {
            remainingDepositToDeduct -= pendingOther;
            pendingOther = 0;
          } else {
            pendingOther -= remainingDepositToDeduct;
            remainingDepositToDeduct = 0;
          }
        }

        await base44.asServiceRole.entities.Payment.create({
          branch_id: branch_id,
          booking_id: booking.id,
          room_id: room_id,
          payment_category: 'security_deposit',
          due_date: dueDate,
          late_fee_locked: true,
          security_deposit_amount: pendingSecDep,
          advance_rent_amount: pendingAdvRent,
          common_fee_amount: pendingCommon,
          other_amount: pendingOther,
          total_amount: actualRemaining,
          status: 'pending',
          line_user_id: payload.line_user_id || '',
          notes: `ยอดคงเหลือจากการจองห้อง ${room.room_number} - ${guest_name}\n` +
                 (pendingSecDep > 0 ? `เงินประกัน: ${pendingSecDep.toLocaleString()} บาท\n` : '') +
                 (pendingAdvRent > 0 ? `ค่าเช่าล่วงหน้า: ${pendingAdvRent.toLocaleString()} บาท\n` : '') +
                 (pendingCommon > 0 ? `ค่าส่วนกลาง: ${pendingCommon.toLocaleString()} บาท\n` : '') +
                 (pendingOther > 0 ? `ค่าอื่นๆ: ${pendingOther.toLocaleString()} บาท` : '')
        });
      }
    }

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

${payload.line_user_id ? '📱 (ลูกค้าระบุตัวตนผ่าน LINE แล้ว)' : ''}
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
      booking_no: booking.booking_no,
      deposit_amount: booking.deposit_amount
    });

  } catch (error) {
    console.error('Create public booking error:', error);
    return Response.json({ 
      error: error.message || 'เกิดข้อผิดพลาดในการจอง กรุณาลองใหม่อีกครั้ง' 
    }, { status: 500 });
  }
});