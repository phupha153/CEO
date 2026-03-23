import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

const createBatches = (items, batchSize = 25) => {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { roomsPerBranch = 10, branch_id } = await req.json();

    console.log('📅 Generating 5-year test data:', { roomsPerBranch, branch_id, timestamp: new Date().toISOString() });

    const timestamp = Date.now();
    const results = {
      rooms: 0,
      tenants: 0,
      bookings: 0,
      payments: 0,
      errors: []
    };

    // ดึงข้อมูลสาขา
    const branches = await base44.asServiceRole.entities.Branch.list();
    
    if (branches.length === 0) {
      return Response.json({
        success: false,
        error: 'ไม่พบสาขาในระบบ กรุณาสร้างสาขาก่อน'
      });
    }

    // กำหนดสาขาที่จะสร้างข้อมูล
    const targetBranchIds = branch_id ? [branch_id] : branches.map(b => b.id);
    const totalBranches = targetBranchIds.length;

    // ดึงค่า config
    const configs = await base44.asServiceRole.entities.Config.list();
    const waterRate = parseFloat(configs.find(c => c.key === 'water_rate')?.value || '18');
    const electricityRate = parseFloat(configs.find(c => c.key === 'electricity_rate')?.value || '7');
    const internetRate = parseFloat(configs.find(c => c.key === 'internet_rate')?.value || '200');

    // วันที่เริ่มต้น = 5 ปีย้อนหลัง
    const today = new Date();
    const fiveYearsAgo = new Date(today);
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

    console.log(`\n🎯 Creating data for ${totalBranches} branch(es), ${roomsPerBranch} rooms per branch = ${roomsPerBranch * totalBranches} total rooms`);

    // วนลูปแต่ละสาขา
    for (let branchIndex = 0; branchIndex < totalBranches; branchIndex++) {
      const currentBranchId = targetBranchIds[branchIndex];
      console.log(`\n📍 Branch ${branchIndex + 1}/${totalBranches} (${currentBranchId}): Creating ${roomsPerBranch} rooms...`);

      // 1. สร้างห้อง
      const roomsToCreate = [];
      const existingRooms = await base44.asServiceRole.entities.Room.filter({ branch_id: currentBranchId });
      const maxFloor = existingRooms.length > 0 ? Math.max(...existingRooms.map(r => r.floor || 1)) : 0;

      for (let i = 0; i < roomsPerBranch; i++) {
        const roomNumber = `TEST-${timestamp}-${((branchIndex * roomsPerBranch) + i + 1).toString().padStart(4, '0')}`;
        const floor = maxFloor + Math.floor(i / 10) + 1;

        roomsToCreate.push({
          branch_id: currentBranchId,
          room_number: roomNumber,
          floor: floor,
          room_type: 'monthly',
          price: 3000 + (Math.floor(Math.random() * 10) * 500),
          status: 'occupied',
          size: 20 + Math.floor(Math.random() * 15),
          amenities: ['แอร์', 'เฟอร์นิเจอร์', 'WiFi', 'เครื่องทำน้ำอุ่น'],
          description: `[TEST-${timestamp}] ห้องทดสอบ 5 ปี`
        });
      }

      const roomBatches = createBatches(roomsToCreate, 25);
      const createdRooms = [];
      
      for (let bIdx = 0; bIdx < roomBatches.length; bIdx++) {
        try {
          const batch = roomBatches[bIdx];
          const batchResult = await base44.asServiceRole.entities.Room.bulkCreate(batch);
          createdRooms.push(...batchResult);
          console.log(`  ✅ Room Batch ${bIdx + 1}/${roomBatches.length}: ${batchResult.length} rooms`);
          if (bIdx < roomBatches.length - 1) await delay(100);
        } catch (error) {
          console.error(`  ❌ Room Batch ${bIdx + 1} failed:`, error);
          results.errors.push(`Rooms Batch ${bIdx + 1}: ${error.message}`);
        }
      }

      results.rooms += createdRooms.length;

      // 2. สร้างผู้เช่า
      const tenantsToCreate = [];
      const firstNames = ['สมชาย', 'สมหญิง', 'วิชัย', 'ประภา', 'สุดา', 'นพดล', 'วิไล', 'ชัยยา', 'ธนพล', 'มนัสวี'];
      const surnames = ['ใจดี', 'รักดี', 'มั่นใจ', 'สดใส', 'ยิ้มแย้ม', 'แจ่มใส', 'ใจงาม', 'น้ำใจ'];

      for (let i = 0; i < roomsPerBranch; i++) {
        tenantsToCreate.push({
          branch_id: currentBranchId,
          full_name: `[TEST-${timestamp}] ${firstNames[i % firstNames.length]} ${surnames[i % surnames.length]} #${i + 1}`,
          phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
          email: `test_yearly_${timestamp}_${i + 1}@example.com`,
          notes: `[TEST-${timestamp}] ผู้เช่าทดสอบ 5 ปี`
        });
      }

      const tenantBatches = createBatches(tenantsToCreate, 25);
      const createdTenants = [];
      
      for (let bIdx = 0; bIdx < tenantBatches.length; bIdx++) {
        try {
          const batch = tenantBatches[bIdx];
          const batchResult = await base44.asServiceRole.entities.Tenant.bulkCreate(batch);
          createdTenants.push(...batchResult);
          console.log(`  ✅ Tenant Batch ${bIdx + 1}/${tenantBatches.length}: ${batchResult.length} tenants`);
          if (bIdx < tenantBatches.length - 1) await delay(100);
        } catch (error) {
          console.error(`  ❌ Tenant Batch ${bIdx + 1} failed:`, error);
          results.errors.push(`Tenants Batch ${bIdx + 1}: ${error.message}`);
        }
      }

      results.tenants += createdTenants.length;

      // 3. สร้าง Bookings (สัญญา 5 ปี)
      const bookingsToCreate = [];
      
      for (let i = 0; i < Math.min(createdRooms.length, createdTenants.length); i++) {
        const room = createdRooms[i];
        const tenant = createdTenants[i];

        bookingsToCreate.push({
          branch_id: currentBranchId,
          room_id: room.id,
          tenant_id: tenant.id,
          check_in_date: fiveYearsAgo.toISOString().split('T')[0],
          check_out_date: today.toISOString().split('T')[0],
          booking_type: 'monthly',
          status: 'active',
          deposit_amount: room.price * 2,
          total_amount: room.price,
          notes: `[TEST-${timestamp}] สัญญาทดสอบ 5 ปี`
        });
      }

      const bookingBatches = createBatches(bookingsToCreate, 25);
      const createdBookings = [];
      
      for (let bIdx = 0; bIdx < bookingBatches.length; bIdx++) {
        try {
          const batch = bookingBatches[bIdx];
          const batchResult = await base44.asServiceRole.entities.Booking.bulkCreate(batch);
          createdBookings.push(...batchResult);
          console.log(`  ✅ Booking Batch ${bIdx + 1}/${bookingBatches.length}: ${batchResult.length} bookings`);
          if (bIdx < bookingBatches.length - 1) await delay(100);
        } catch (error) {
          console.error(`  ❌ Booking Batch ${bIdx + 1} failed:`, error);
          results.errors.push(`Bookings Batch ${bIdx + 1}: ${error.message}`);
        }
      }

      results.bookings += createdBookings.length;

      // 4. สร้าง Payments (60 บิล ต่อห้อง = 5 ปี)
      const paymentsToCreate = [];
      
      for (let i = 0; i < createdBookings.length; i++) {
        const booking = createdBookings[i];
        const room = createdRooms[i];

        // สร้าง 60 บิล (1 บิลต่อเดือน x 5 ปี)
        for (let month = 0; month < 60; month++) {
          const billDate = new Date(fiveYearsAgo);
          billDate.setMonth(billDate.getMonth() + month);
          billDate.setDate(7); // วันครบกำหนดวันที่ 7

          // กำหนดสถานะการชำระ
          const rand = Math.random();
          let status = 'paid';
          let paymentDate = null;

          // บิล 2-3 เดือนล่าสุด มีโอกาสเป็น pending/overdue
          if (month >= 58) {
            if (rand < 0.5) {
              status = 'paid';
              paymentDate = new Date(billDate);
              paymentDate.setDate(paymentDate.getDate() - Math.floor(Math.random() * 3));
            } else if (rand < 0.8) {
              status = 'pending';
            } else {
              status = 'overdue';
            }
          } else {
            // บิลเดือนก่อนหน้าส่วนใหญ่ชำระแล้ว
            if (rand < 0.95) {
              status = 'paid';
              paymentDate = new Date(billDate);
              paymentDate.setDate(paymentDate.getDate() - Math.floor(Math.random() * 5));
            } else {
              status = 'pending';
            }
          }

          const waterUnits = 5 + Math.floor(Math.random() * 15);
          const electricityUnits = 50 + Math.floor(Math.random() * 150);

          paymentsToCreate.push({
            branch_id: currentBranchId,
            booking_id: booking.id,
            tenant_id: booking.tenant_id,
            room_id: booking.room_id,
            due_date: billDate.toISOString().split('T')[0],
            payment_date: paymentDate ? paymentDate.toISOString().split('T')[0] : null,
            rent_amount: room.price,
            water_units: waterUnits,
            water_rate: waterRate,
            water_amount: waterUnits * waterRate,
            electricity_units: electricityUnits,
            electricity_rate: electricityRate,
            electricity_amount: electricityUnits * electricityRate,
            internet_amount: internetRate,
            common_fee_amount: 0,
            parking_fee_amount: 0,
            other_amount: 0,
            total_amount: room.price + (waterUnits * waterRate) + (electricityUnits * electricityRate) + internetRate,
            status: status,
            payment_method: status === 'paid' ? 'transfer' : 'cash',
            notes: `[TEST-${timestamp}] บิลเดือน ${month + 1}/60`
          });
        }
      }

      console.log(`💰 Creating ${paymentsToCreate.length} payments for 60 months (5 years)...`);
      const paymentBatches = createBatches(paymentsToCreate, 25);
      const createdPayments = [];
      
      for (let bIdx = 0; bIdx < paymentBatches.length; bIdx++) {
        try {
          const batch = paymentBatches[bIdx];
          const batchResult = await base44.asServiceRole.entities.Payment.bulkCreate(batch);
          createdPayments.push(...batchResult);
          console.log(`  ✅ Payment Batch ${bIdx + 1}/${paymentBatches.length}: ${batchResult.length} payments (Total: ${createdPayments.length}/${paymentsToCreate.length})`);
          if (bIdx < paymentBatches.length - 1) await delay(150);
        } catch (error) {
          console.error(`  ❌ Payment Batch ${bIdx + 1} failed:`, error);
          results.errors.push(`Payments Batch ${bIdx + 1}: ${error.message}`);
        }
      }

      results.payments += createdPayments.length;
    }

    const totalItems = results.rooms + results.tenants + results.bookings + results.payments;

    // บันทึก Activity Log
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        branch_id: branch_id || null,
        action_type: 'create',
        entity_type: 'TestData',
        entity_id: `test-${timestamp}`,
        entity_name: 'ข้อมูลทดสอบ 5 ปี',
        user_email: user.email,
        user_name: user.full_name,
        description: `สร้างข้อมูลทดสอบ 5 ปี: ${results.rooms} ห้อง, ${results.tenants} ผู้เช่า, ${results.bookings} การจอง, ${results.payments} บิล (${totalBranches} สาขา)`
      });
    } catch (logError) {
      console.error('Failed to create activity log:', logError);
    }

    return Response.json({
      success: true,
      message: `✅ สร้างข้อมูลทดสอบ 5 ปีสำเร็จ!\n\n` +
        `📊 สรุป:\n` +
        `🏠 ห้องพัก: ${results.rooms} ห้อง\n` +
        `👥 ผู้เช่า: ${results.tenants} คน\n` +
        `📋 การจอง: ${results.bookings} สัญญา\n` +
        `💰 บิลชำระเงิน: ${results.payments} บิล (60 เดือน/ห้อง)\n` +
        `📦 รวมทั้งหมด: ${totalItems} รายการ\n` +
        `🏢 กระจายใน ${totalBranches} สาขา\n` +
        (results.errors.length > 0 ? `\n⚠️ ข้อผิดพลาด: ${results.errors.length} รายการ` : '') +
        `\n\n💡 ข้อมูลครอบคลุม 60 เดือนย้อนหลัง (5 ปี) พร้อมใช้วิเคราะห์กราฟและรายงาน`,
      results,
      totalItems
    });

  } catch (error) {
    console.error('❌ Error generating yearly test data:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});