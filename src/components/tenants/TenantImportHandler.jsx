import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * 🎯 Tenant Import Handler - แยกออกจาก pages/Tenants เพื่อลดขนาดไฟล์
 * รับผิดชอบการนำเข้าผู้เช่าจาก Excel/CSV พร้อมสร้าง Booking
 */
export async function handleTenantImport(records, selectedBranchId, existingTenants, branchRooms, existingBookings, queryClient) {
  let createdCount = 0;
  let updatedCount = 0;
  let bookingUpdatedCount = 0;
  let skippedCount = 0;

  for (const record of records) {
    // ⭐ ดึงข้อมูลพื้นฐาน
    const fullName = record.full_name || record['ชื่อ-นามสกุล'];
    const phone = String(record.phone || record['เบอร์โทร'] || '').trim();
    const emergencyPhone = String(record.emergency_contact || record['เบอร์ติดต่อฉุกเฉิน'] || '').trim();
    const nationalId = String(record.national_id || record['เลขบัตรประชาชน'] || '').trim();
    const tenantId = record.id || record.tenant_id;

    // ⚠️ SKIP แถวว่าง (ไม่มีชื่อ)
    if (!fullName || String(fullName).trim() === '') {
      console.warn('❌ Skipping record without name:', record);
      skippedCount++;
      continue;
    }
    
    console.log('✅ Valid record - Name:', fullName, 'Booking data:', record._booking);

    // --- Create/Update Tenant ---
    const existingTenant = tenantId ? existingTenants.find(t => t.id === tenantId) : null;
    
    const rawAge = record.age || record['อายุ'];
    const parsedAge = rawAge ? parseInt(String(rawAge)) : undefined;
    
    const formattedPhone = phone && phone.length >= 9 ? (phone.startsWith('0') ? phone : '0' + phone) : phone;
    const formattedEmergency = emergencyPhone && emergencyPhone.length >= 9 ? (emergencyPhone.startsWith('0') ? emergencyPhone : '0' + emergencyPhone) : emergencyPhone;
    
    const tenantData = {
      full_name: String(fullName).trim(),
      phone: formattedPhone,
      gender: record.gender || record['เพศ'] || existingTenant?.gender,
      age: !isNaN(parsedAge) && parsedAge > 0 ? parsedAge : existingTenant?.age,
      line_id: record.line_id || record['LINE ID'] || existingTenant?.line_id,
      national_id: nationalId || existingTenant?.national_id,
      email: record.email || record['อีเมล'] || existingTenant?.email,
      address: record.address || record['ที่อยู่'] || existingTenant?.address,
      emergency_contact: formattedEmergency || existingTenant?.emergency_contact,
      notes: record.notes || record['หมายเหตุ'] || existingTenant?.notes,
      status: 'active',
      line_user_id: existingTenant?.line_user_id,
      branch_id: selectedBranchId
    };
    
    console.log('📝 [Excel] Tenant data prepared:', tenantData);

    let finalTenant;
    if (existingTenant) {
      await base44.entities.Tenant.update(existingTenant.id, tenantData);
      finalTenant = existingTenant;
      updatedCount++;
    } else {
      const newTenant = await base44.entities.Tenant.create(tenantData);
      existingTenants.push(newTenant);
      finalTenant = newTenant;
      createdCount++;
    }

    // ⭐⭐⭐ FIX: ดึงข้อมูลจาก _booking object ที่ backend ส่งมา
    const bookingData = record._booking || {};
    const roomNumber = bookingData.room_number || record.room_number || record['เลขห้อง'];
    
    console.log('🔍 [Import] Processing booking:', { roomNumber, bookingData, record });
    
    if (roomNumber && String(roomNumber).trim() !== '') {
      const roomNumStr = String(roomNumber).trim();
      const room = branchRooms.find(r => r.room_number === roomNumStr);

      if (!room) {
        console.warn(`⚠️ Room not found: "${roomNumStr}" - Available rooms:`, branchRooms.map(r => r.room_number));
      } else {
        console.log('✅ [Excel] Found room:', room.room_number, 'Creating booking...');
        
        // ✅ SAFE DATE PARSING: รองรับหลายรูปแบบ (YYYY-MM-DD, DD/MM/YYYY, DD/MM/YY พ.ศ., Excel serial)
        const parseDate = (dateValue) => {
          if (!dateValue) return null;
          const str = String(dateValue).trim();
          
          // รูปแบบ YYYY-MM-DD (ISO)
          if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
          
          // รูปแบบ DD/MM/YYYY (4 หลัก)
          if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
            const [d, m, y] = str.split('/');
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
          
          // ⭐ รูปแบบ DD/MM/YY (2 หลัก - Thai Buddhist Era พ.ศ.)
          if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(str)) {
            const [d, m, yy] = str.split('/');
            const buddhistYear = parseInt(yy);
            const christianYear = buddhistYear <= 50 
              ? 2500 + buddhistYear - 543
              : 2400 + buddhistYear - 543;
            return `${christianYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
          
          // Excel serial number (days since 1900-01-01)
          const num = parseFloat(str);
          if (!isNaN(num) && num > 40000) {
            const excelEpoch = new Date(1900, 0, 1);
            const date = new Date(excelEpoch.getTime() + (num - 2) * 24 * 60 * 60 * 1000);
            return date.toISOString().split('T')[0];
          }
          
          return null;
        };
        
        const checkInDate = parseDate(bookingData.check_in_date || record.check_in_date || record['วันเริ่มสัญญา']) || new Date().toISOString().split('T')[0];
        const checkOutDate = parseDate(bookingData.check_out_date || record.check_out_date || record['วันสิ้นสุดสัญญา']);
        const depositAmount = parseFloat(bookingData.deposit_amount || record.deposit_amount || record['เงินมัดจำ'] || 0);
        const bookingStatus = String(bookingData.booking_status || record.booking_status || record['สถานะการจอง'] || 'active').toLowerCase();

        const existingTenantBooking = existingBookings.find(b => b.tenant_id === finalTenant.id && b.room_id === room.id);
        
        const newBookingData = {
          tenant_id: finalTenant.id,
          room_id: room.id,
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          deposit_amount: depositAmount,
          total_amount: room.price,
          booking_type: 'monthly',
          status: bookingStatus,
          branch_id: selectedBranchId
        };

        if (existingTenantBooking) {
          await base44.entities.Booking.update(existingTenantBooking.id, newBookingData);
          bookingUpdatedCount++;
        } else {
          const newBooking = await base44.entities.Booking.create(newBookingData);
          existingBookings.push(newBooking);
          bookingUpdatedCount++;
        }
        
        // อัพเดทสถานะห้อง
        const newRoomStatus = bookingStatus === 'active' ? 'occupied' : 'available';
        if (room.status !== newRoomStatus) {
          await base44.entities.Room.update(room.id, { status: newRoomStatus });
        }
      }
    }
  }

  // แจ้งเตือนผลลัพธ์
  let summaryParts = [];
  if (createdCount > 0) summaryParts.push(`สร้างใหม่ ${createdCount} คน`);
  if (updatedCount > 0) summaryParts.push(`อัพเดท ${updatedCount} คน`);
  if (bookingUpdatedCount > 0) summaryParts.push(`จัดการสัญญา ${bookingUpdatedCount} รายการ`);
  
  if (summaryParts.length > 0) {
    toast.success(`นำเข้าสำเร็จ: ${summaryParts.join(', ')}`);
  } else {
    toast.info('ไม่มีข้อมูลใหม่ที่ต้องนำเข้า');
  }
}