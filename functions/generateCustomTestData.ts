import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const createBatches = (items, size) => {
  const batches = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
};

const generateRoomNumber = (floor, index) => {
  const roomNum = String(index).padStart(2, '0');
  return `${floor}${roomNum}`;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
    if (userRole !== 'developer' && userRole !== 'owner') {
      return Response.json({ 
        success: false,
        error: 'Forbidden - Only developer or owner can generate test data' 
      }, { status: 403 });
    }

    const { branch_id, counts, totalRecords } = await req.json();

    if (!branch_id) {
      return Response.json({ 
        success: false, 
        error: 'branch_id is required' 
      }, { status: 400 });
    }

    console.log('🎯 Starting custom test data generation:', { 
      branch_id, 
      counts, 
      totalRecords,
      timestamp: new Date().toISOString() 
    });

    const results = {
      created: {
        rooms: 0,
        tenants: 0,
        bookings: 0,
        payments: 0,
        meterReadings: 0,
        maintenance: 0
      },
      errors: []
    };

    const testPrefix = '[TEST-Custom]';

    // 1. สร้างห้องพัก
    if (counts.rooms > 0) {
      console.log(`\n🏠 Creating ${counts.rooms} rooms...`);
      const rooms = [];
      for (let i = 0; i < counts.rooms; i++) {
        const floor = Math.floor(Math.random() * 3) + 1;
        const roomType = Math.random() > 0.3 ? 'monthly' : 'daily';
        const price = roomType === 'monthly' ? 3000 + Math.floor(Math.random() * 2000) : 500 + Math.floor(Math.random() * 500);
        
        rooms.push({
          branch_id,
          room_number: `${testPrefix} ${generateRoomNumber(floor, i + 1)}`,
          floor,
          room_type: roomType,
          price,
          status: 'available',
          size: 25 + Math.floor(Math.random() * 15),
          amenities: ['เตียง', 'ตู้เสื้อผ้า', 'แอร์'],
          description: `${testPrefix} ห้องทดสอบ`
        });
      }

      const roomBatches = createBatches(rooms, 50);
      for (const batch of roomBatches) {
        try {
          await base44.asServiceRole.entities.Room.bulkCreate(batch);
          results.created.rooms += batch.length;
          console.log(`  ✅ Created ${batch.length} rooms (Total: ${results.created.rooms})`);
          await delay(100);
        } catch (error) {
          console.error('  ❌ Room batch failed:', error);
          results.errors.push(`Rooms: ${error.message}`);
        }
      }
    }

    // ดึงห้องที่สร้างมาใหม่
    const createdRooms = await base44.asServiceRole.entities.Room.filter(
      { branch_id },
      '-created_date',
      counts.rooms || 100
    );
    const testRooms = createdRooms.filter(r => r.room_number?.includes(testPrefix));

    // 2. สร้างผู้เช่า
    if (counts.tenants > 0 && testRooms.length > 0) {
      console.log(`\n👥 Creating ${counts.tenants} tenants...`);
      const tenants = [];
      const thaiNames = ['สมชาย', 'สมหญิง', 'ประยุทธ์', 'วิไล', 'สมศักดิ์', 'สมใจ', 'นิภา', 'วรรณา'];
      const thaiSurnames = ['ใจดี', 'รักสงบ', 'มั่นคง', 'สุขสันต์', 'เจริญ', 'ทรัพย์', 'ศรี', 'บุญ'];

      for (let i = 0; i < counts.tenants; i++) {
        const firstName = thaiNames[Math.floor(Math.random() * thaiNames.length)];
        const lastName = thaiSurnames[Math.floor(Math.random() * thaiSurnames.length)];
        
        tenants.push({
          branch_id,
          full_name: `${testPrefix} ${firstName} ${lastName}`,
          phone: `08${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
          national_id: `${Math.floor(Math.random() * 10000000000000).toString().padStart(13, '0')}`,
          notes: `${testPrefix} ผู้เช่าทดสอบ`
        });
      }

      const tenantBatches = createBatches(tenants, 50);
      for (const batch of tenantBatches) {
        try {
          await base44.asServiceRole.entities.Tenant.bulkCreate(batch);
          results.created.tenants += batch.length;
          console.log(`  ✅ Created ${batch.length} tenants (Total: ${results.created.tenants})`);
          await delay(100);
        } catch (error) {
          console.error('  ❌ Tenant batch failed:', error);
          results.errors.push(`Tenants: ${error.message}`);
        }
      }
    }

    // ดึงผู้เช่าที่สร้างมาใหม่
    const createdTenants = await base44.asServiceRole.entities.Tenant.filter(
      { branch_id },
      '-created_date',
      counts.tenants || 100
    );
    const testTenants = createdTenants.filter(t => t.full_name?.includes(testPrefix));

    // 3. สร้างการจอง (เฉพาะห้องรายเดือน)
    if (counts.bookings > 0 && testRooms.length > 0 && testTenants.length > 0) {
      console.log(`\n📋 Creating ${counts.bookings} bookings...`);
      const monthlyRooms = testRooms.filter(r => r.room_type === 'monthly');
      const bookings = [];

      // สร้างการจองตามจำนวนที่กำหนด (ไม่จำกัดด้วยจำนวนห้อง)
      for (let i = 0; i < counts.bookings; i++) {
        const room = monthlyRooms[i % monthlyRooms.length];
        const tenant = testTenants[i % testTenants.length];
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - Math.floor(Math.random() * 12)); // สุ่มภายใน 1 ปี
        const endDate = new Date(startDate);
        endDate.setMonth(endDate.getMonth() + 12); // สัญญา 1 ปี

        bookings.push({
          branch_id,
          room_id: room.id,
          tenant_id: tenant.id,
          check_in_date: startDate.toISOString().split('T')[0],
          actual_check_in_date: startDate.toISOString().split('T')[0],
          check_out_date: endDate.toISOString().split('T')[0],
          booking_type: 'monthly',
          status: 'active',
          deposit_amount: room.price,
          total_amount: room.price,
          notes: `${testPrefix} การจองทดสอบ #${i + 1}`
        });
      }

      const bookingBatches = createBatches(bookings, 50);
      for (const batch of bookingBatches) {
        try {
          await base44.asServiceRole.entities.Booking.bulkCreate(batch);
          results.created.bookings += batch.length;
          
          // อัปเดตสถานะห้องเป็น occupied
          for (const booking of batch) {
            try {
              await base44.asServiceRole.entities.Room.update(booking.room_id, { status: 'occupied' });
            } catch (updateError) {
              console.warn('  ⚠️ Failed to update room status:', updateError.message);
            }
          }

          console.log(`  ✅ Created ${batch.length} bookings (Total: ${results.created.bookings})`);
          await delay(100);
        } catch (error) {
          console.error('  ❌ Booking batch failed:', error);
          results.errors.push(`Bookings: ${error.message}`);
        }
      }
    }

    // ดึงการจองที่สร้างมาใหม่
    const createdBookings = await base44.asServiceRole.entities.Booking.filter(
      { branch_id },
      '-created_date',
      counts.bookings || 100
    );
    const testBookings = createdBookings.filter(b => b.notes?.includes(testPrefix));

    // 4. สร้างบิลชำระเงิน
    if (counts.payments > 0 && testBookings.length > 0) {
      console.log(`\n💰 Creating ${counts.payments} payments...`);
      const payments = [];
      const today = new Date();

      for (let i = 0; i < counts.payments; i++) {
        const booking = testBookings[i % testBookings.length];
        const room = testRooms.find(r => r.id === booking.room_id);
        const monthOffset = Math.floor(i / testBookings.length);
        
        // สร้าง due_date กระจายตลอด 12 เดือน (ย้อนหลังจากวันนี้)
        const dueDate = new Date(today);
        dueDate.setMonth(dueDate.getMonth() - (monthOffset % 12));
        dueDate.setDate(5);

        const waterUnits = 5 + Math.floor(Math.random() * 10);
        const electricityUnits = 50 + Math.floor(Math.random() * 100);
        const waterAmount = waterUnits * 20;
        const electricityAmount = electricityUnits * 7;

        // ตัดสินใจสถานะบิลตาม due_date
        const daysFromDue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
        let status, paymentDate;

        if (daysFromDue < 0) {
          // บิลในอนาคต = pending
          status = 'pending';
          paymentDate = null;
        } else if (daysFromDue < 5) {
          // บิลเพิ่งครบกำหนด 0-5 วัน = 50% จ่ายแล้ว, 50% pending
          if (Math.random() > 0.5) {
            status = 'paid';
            paymentDate = new Date(dueDate.getTime() + Math.random() * 3 * 24 * 60 * 60 * 1000);
          } else {
            status = 'pending';
            paymentDate = null;
          }
        } else if (daysFromDue < 15) {
          // บิลครบกำหนด 5-15 วัน = 70% จ่ายแล้ว, 30% overdue
          if (Math.random() > 0.3) {
            status = 'paid';
            paymentDate = new Date(dueDate.getTime() + Math.random() * 10 * 24 * 60 * 60 * 1000);
          } else {
            status = 'overdue';
            paymentDate = null;
          }
        } else {
          // บิลเก่า > 15 วัน = 80% จ่ายแล้ว, 20% overdue
          if (Math.random() > 0.2) {
            status = 'paid';
            paymentDate = new Date(dueDate.getTime() + Math.random() * 20 * 24 * 60 * 60 * 1000);
          } else {
            status = 'overdue';
            paymentDate = null;
          }
        }

        payments.push({
          branch_id,
          booking_id: booking.id,
          tenant_id: booking.tenant_id,
          room_id: booking.room_id,
          payment_date: paymentDate ? paymentDate.toISOString().split('T')[0] : null,
          due_date: dueDate.toISOString().split('T')[0],
          rent_amount: room?.price || 3000,
          water_units: waterUnits,
          water_rate: 20,
          water_amount: waterAmount,
          electricity_units: electricityUnits,
          electricity_rate: 7,
          electricity_amount: electricityAmount,
          internet_amount: 200,
          total_amount: (room?.price || 3000) + waterAmount + electricityAmount + 200,
          payment_method: status === 'paid' ? (Math.random() > 0.5 ? 'transfer' : 'cash') : null,
          status: status,
          notes: `${testPrefix} บิลทดสอบ เดือน ${dueDate.getMonth() + 1}/${dueDate.getFullYear()}`
        });
      }

      const paymentBatches = createBatches(payments, 50);
      for (const batch of paymentBatches) {
        try {
          await base44.asServiceRole.entities.Payment.bulkCreate(batch);
          results.created.payments += batch.length;
          console.log(`  ✅ Created ${batch.length} payments (Total: ${results.created.payments})`);
          await delay(100);
        } catch (error) {
          console.error('  ❌ Payment batch failed:', error);
          results.errors.push(`Payments: ${error.message}`);
        }
      }
    }

    // 5. สร้างมิเตอร์
    if (counts.meterReadings > 0 && testRooms.length > 0) {
      console.log(`\n📏 Creating ${counts.meterReadings} meter readings...`);
      const readings = [];

      // สร้างมิเตอร์ตามจำนวนที่กำหนด (ห้องเดียวกันสามารถมีหลายรายการได้)
      for (let i = 0; i < counts.meterReadings; i++) {
        const room = testRooms[i % testRooms.length];
        const readingDate = new Date();
        readingDate.setMonth(readingDate.getMonth() - Math.floor(Math.random() * 12)); // สุ่มภายใน 1 ปี

        readings.push({
          branch_id,
          room_id: room.id,
          reading_date: readingDate.toISOString().split('T')[0],
          water_previous: 100 + Math.floor(Math.random() * 50),
          water_current: 150 + Math.floor(Math.random() * 50),
          electricity_previous: 500 + Math.floor(Math.random() * 200),
          electricity_current: 600 + Math.floor(Math.random() * 200),
          notes: `${testPrefix} มิเตอร์ทดสอบ #${i + 1}`,
          recorded_by: user.email
        });
      }

      readings.forEach(r => {
        r.water_units = r.water_current - r.water_previous;
        r.electricity_units = r.electricity_current - r.electricity_previous;
      });

      const readingBatches = createBatches(readings, 50);
      for (const batch of readingBatches) {
        try {
          await base44.asServiceRole.entities.MeterReading.bulkCreate(batch);
          results.created.meterReadings += batch.length;
          console.log(`  ✅ Created ${batch.length} meter readings (Total: ${results.created.meterReadings})`);
          await delay(100);
        } catch (error) {
          console.error('  ❌ Meter reading batch failed:', error);
          results.errors.push(`MeterReadings: ${error.message}`);
        }
      }
    }

    // 6. สร้างแจ้งซ่อม
    if (counts.maintenance > 0 && testRooms.length > 0) {
      console.log(`\n🔧 Creating ${counts.maintenance} maintenance requests...`);
      const maintenanceRequests = [];
      const categories = ['electric', 'plumbing', 'furniture', 'air_conditioner', 'other'];
      const priorities = ['low', 'medium', 'high', 'urgent'];
      const issues = ['ท่อน้ำรั่ว', 'ไฟไม่ติด', 'แอร์เสีย', 'ประตูชำรุด', 'หน้าต่างแตก'];

      // สร้างแจ้งซ่อมตามจำนวนที่กำหนด (ห้องเดียวกันสามารถมีหลายรายการได้)
      for (let i = 0; i < counts.maintenance; i++) {
        const room = testRooms[i % testRooms.length];
        const category = categories[Math.floor(Math.random() * categories.length)];
        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const issue = issues[Math.floor(Math.random() * issues.length)];

        maintenanceRequests.push({
          branch_id,
          room_id: room.id,
          title: `${testPrefix} ${issue}`,
          description: `${testPrefix} รายละเอียด: ${issue} ในห้อง ${room.room_number} #${i + 1}`,
          category,
          priority,
          status: Math.random() > 0.5 ? 'pending' : 'in_progress'
        });
      }

      const maintenanceBatches = createBatches(maintenanceRequests, 50);
      for (const batch of maintenanceBatches) {
        try {
          await base44.asServiceRole.entities.MaintenanceRequest.bulkCreate(batch);
          results.created.maintenance += batch.length;
          console.log(`  ✅ Created ${batch.length} maintenance requests (Total: ${results.created.maintenance})`);
          await delay(100);
        } catch (error) {
          console.error('  ❌ Maintenance batch failed:', error);
          results.errors.push(`Maintenance: ${error.message}`);
        }
      }
    }

    // บันทึก Activity Log
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        branch_id,
        action_type: 'create',
        entity_type: 'TestData',
        entity_id: `test-custom-${Date.now()}`,
        entity_name: 'สร้างข้อมูลทดสอบแบบกำหนดเอง',
        user_email: user.email,
        user_name: user.full_name,
        description: `สร้างข้อมูลทดสอบ: ${results.created.rooms} ห้อง, ${results.created.tenants} ผู้เช่า, ${results.created.bookings} การจอง, ${results.created.payments} บิล, ${results.created.meterReadings} มิเตอร์, ${results.created.maintenance} แจ้งซ่อม`
      });
    } catch (logError) {
      console.error('Failed to create activity log:', logError);
    }

    const totalCreated = Object.values(results.created).reduce((sum, count) => sum + count, 0);

    console.log('\n✅ GENERATION COMPLETED!');
    console.log('Created:', results.created);
    console.log('Total:', totalCreated);
    console.log('Errors:', results.errors.length);

    return Response.json({
      success: true,
      message: `✅ สร้างข้อมูลทดสอบเสร็จสิ้น!\n\n` +
        `📊 สรุป:\n` +
        `🏠 ห้องพัก: ${results.created.rooms} ห้อง\n` +
        `👥 ผู้เช่า: ${results.created.tenants} คน\n` +
        `📋 การจอง: ${results.created.bookings} สัญญา\n` +
        `💰 บิล: ${results.created.payments} บิล\n` +
        `📏 มิเตอร์: ${results.created.meterReadings} รายการ\n` +
        `🔧 แจ้งซ่อม: ${results.created.maintenance} รายการ\n\n` +
        `🗂️ รวมทั้งหมด: ${totalCreated} รายการ` +
        (results.errors.length > 0 ? `\n\n⚠️ ข้อผิดพลาด: ${results.errors.length} รายการ` : ''),
      results,
      totalCreated
    });

  } catch (error) {
    console.error('❌ GENERATION FAILED:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});