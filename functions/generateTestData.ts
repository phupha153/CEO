import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

const createBatches = (items, batchSize = 50) => {
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

    const { entityType, quantity, branch_id } = await req.json();

    console.log('🎯 Generating test data:', { entityType, quantity, branch_id, timestamp: new Date().toISOString() });

    const timestamp = Date.now();
    const results = {
      created: 0,
      failed: 0,
      errors: [],
      details: []
    };

    const branches = await base44.asServiceRole.entities.Branch.list();
    
    if (branches.length === 0) {
      return Response.json({
        success: false,
        error: 'ไม่พบสาขาในระบบ กรุณาสร้างสาขาก่อน'
      });
    }

    let targetBranchIds = branch_id ? [branch_id] : branches.map(b => b.id);
    const totalBranches = targetBranchIds.length;

    // ========================================
    // 🎯 CompleteSet Mode - ปรับปรุงใหม่
    // ========================================
    if (entityType === 'CompleteSet') {
      console.log(`🎯 Creating ${quantity} complete sets across ${totalBranches} branch(es)...`);

      const setsPerBranch = Math.floor(quantity / totalBranches);
      const remainingSets = quantity % totalBranches;

      for (let branchIndex = 0; branchIndex < totalBranches; branchIndex++) {
        const currentBranchId = targetBranchIds[branchIndex];
        const setsForThisBranch = setsPerBranch + (branchIndex < remainingSets ? 1 : 0);

        console.log(`\n📍 Branch ${branchIndex + 1}/${totalBranches} (${currentBranchId}): Creating ${setsForThisBranch} sets...`);

        // เตรียมข้อมูลทั้งหมดก่อน
        const roomsToCreate = [];
        const tenantsToCreate = [];

        for (let i = 0; i < setsForThisBranch; i++) {
          const setNumber = (branchIndex * setsPerBranch) + i + 1;
          const roomNumber = `TEST-${timestamp}-${setNumber.toString().padStart(4, '0')}`;

          roomsToCreate.push({
            branch_id: currentBranchId,
            room_number: roomNumber,
            floor: Math.floor(setNumber / 10) + 1,
            room_type: 'monthly',
            price: 3000 + (Math.floor(Math.random() * 10) * 500),
            status: 'occupied',
            size: 20 + Math.floor(Math.random() * 15),
            amenities: ['แอร์', 'เฟอร์นิเจอร์', 'WiFi'],
            description: `[TEST-${timestamp}] ห้องทดสอบชุดที่ ${setNumber}`
          });

          const tenantNames = ['สมชาย', 'สมหญิง', 'วิชัย', 'ประภา', 'สุดา', 'นพดล', 'วิไล', 'ชัยยา', 'ธนพล', 'มนัสวี'];
          const surnames = ['ใจดี', 'รักดี', 'มั่นใจ', 'สดใส', 'ยิ้มแย้ม', 'แจ่มใส', 'ใจงาม', 'น้ำใจ'];
          
          tenantsToCreate.push({
            branch_id: currentBranchId,
            full_name: `[TEST-${timestamp}] ${tenantNames[i % tenantNames.length]} ${surnames[i % surnames.length]} #${setNumber}`,
            phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
            email: `test_${timestamp}_${setNumber}@example.com`,
            notes: `[TEST-${timestamp}] ผู้เช่าทดสอบ`
          });
        }

        console.log(`📦 Batch creating ${roomsToCreate.length} rooms...`);
        const roomBatches = createBatches(roomsToCreate, 50); // เพิ่มเป็น 50
        const createdRooms = [];
        
        for (let bIdx = 0; bIdx < roomBatches.length; bIdx++) {
          try {
            const batch = roomBatches[bIdx];
            const batchResult = await base44.asServiceRole.entities.Room.bulkCreate(batch);
            createdRooms.push(...batchResult);
            console.log(`  ✅ Room Batch ${bIdx + 1}/${roomBatches.length}: ${batchResult.length} rooms (Total: ${createdRooms.length})`);
            if (bIdx < roomBatches.length - 1) await delay(50); // ลด delay
          } catch (error) {
            console.error(`  ❌ Room Batch ${bIdx + 1} failed:`, error);
            results.errors.push(`Rooms Batch ${bIdx + 1}: ${error.message}`);
          }
        }

        console.log(`👥 Batch creating ${tenantsToCreate.length} tenants...`);
        const tenantBatches = createBatches(tenantsToCreate, 50); // เพิ่มเป็น 50
        const createdTenants = [];
        
        for (let bIdx = 0; bIdx < tenantBatches.length; bIdx++) {
          try {
            const batch = tenantBatches[bIdx];
            const batchResult = await base44.asServiceRole.entities.Tenant.bulkCreate(batch);
            createdTenants.push(...batchResult);
            console.log(`  ✅ Tenant Batch ${bIdx + 1}/${tenantBatches.length}: ${batchResult.length} tenants (Total: ${createdTenants.length})`);
            if (bIdx < tenantBatches.length - 1) await delay(50);
          } catch (error) {
            console.error(`  ❌ Tenant Batch ${bIdx + 1} failed:`, error);
            results.errors.push(`Tenants Batch ${bIdx + 1}: ${error.message}`);
          }
        }

        // สร้าง Bookings
        console.log(`📋 Creating ${setsForThisBranch} bookings...`);
        const bookingsToCreate = [];
        
        for (let i = 0; i < Math.min(createdRooms.length, createdTenants.length); i++) {
          const room = createdRooms[i];
          const tenant = createdTenants[i];

          const checkInDate = new Date();
          checkInDate.setDate(checkInDate.getDate() - Math.floor(Math.random() * 60));
          
          const checkOutDate = new Date(checkInDate);
          checkOutDate.setMonth(checkOutDate.getMonth() + 12);

          bookingsToCreate.push({
            branch_id: currentBranchId,
            room_id: room.id,
            tenant_id: tenant.id,
            check_in_date: checkInDate.toISOString().split('T')[0],
            check_out_date: checkOutDate.toISOString().split('T')[0],
            booking_type: 'monthly',
            status: 'active',
            deposit_amount: room.price * 2,
            total_amount: room.price,
            notes: `[TEST-${timestamp}] การจองทดสอบ`
          });
        }

        const bookingBatches = createBatches(bookingsToCreate, 50);
        const createdBookings = [];
        
        for (let bIdx = 0; bIdx < bookingBatches.length; bIdx++) {
          try {
            const batch = bookingBatches[bIdx];
            const batchResult = await base44.asServiceRole.entities.Booking.bulkCreate(batch);
            createdBookings.push(...batchResult);
            console.log(`  ✅ Booking Batch ${bIdx + 1}/${bookingBatches.length}: ${batchResult.length} bookings (Total: ${createdBookings.length})`);
            if (bIdx < bookingBatches.length - 1) await delay(50);
          } catch (error) {
            console.error(`  ❌ Booking Batch ${bIdx + 1} failed:`, error);
            results.errors.push(`Bookings Batch ${bIdx + 1}: ${error.message}`);
          }
        }

        // สร้าง Payments (สร้างหลายบิลต่อ booking)
        console.log(`💰 Creating payments for ${createdBookings.length} bookings...`);
        const paymentsToCreate = [];
        
        for (let i = 0; i < createdBookings.length; i++) {
          const booking = createdBookings[i];
          const room = createdRooms[i];

          // สร้าง 1-3 บิลต่อ booking
          const numPayments = Math.floor(Math.random() * 2) + 1;
          
          for (let p = 0; p < numPayments; p++) {
            const dueDate = new Date();
            dueDate.setMonth(dueDate.getMonth() - p);
            dueDate.setDate(7);

            const rand = Math.random();
            let status = 'paid';
            let paymentDate = null;

            if (rand < 0.6) {
              status = 'paid';
              paymentDate = new Date(dueDate);
              paymentDate.setDate(paymentDate.getDate() - Math.floor(Math.random() * 5));
            } else if (rand < 0.85) {
              status = 'pending';
            } else {
              status = 'overdue';
            }

            paymentsToCreate.push({
              branch_id: currentBranchId,
              booking_id: booking.id,
              tenant_id: booking.tenant_id,
              room_id: booking.room_id,
              due_date: dueDate.toISOString().split('T')[0],
              payment_date: paymentDate ? paymentDate.toISOString().split('T')[0] : null,
              rent_amount: room.price,
              water_amount: 50 + Math.floor(Math.random() * 100),
              electricity_amount: 200 + Math.floor(Math.random() * 300),
              internet_amount: 200,
              total_amount: room.price + 450,
              status: status,
              payment_method: status === 'paid' ? 'transfer' : 'cash',
              notes: `[TEST-${timestamp}] บิลทดสอบเดือนที่ ${p + 1}`
            });
          }
        }

        const paymentBatches = createBatches(paymentsToCreate, 50);
        const createdPayments = [];
        
        for (let bIdx = 0; bIdx < paymentBatches.length; bIdx++) {
          try {
            const batch = paymentBatches[bIdx];
            const batchResult = await base44.asServiceRole.entities.Payment.bulkCreate(batch);
            createdPayments.push(...batchResult);
            console.log(`  ✅ Payment Batch ${bIdx + 1}/${paymentBatches.length}: ${batchResult.length} payments (Total: ${createdPayments.length})`);
            if (bIdx < paymentBatches.length - 1) await delay(50);
          } catch (error) {
            console.error(`  ❌ Payment Batch ${bIdx + 1} failed:`, error);
            results.errors.push(`Payments Batch ${bIdx + 1}: ${error.message}`);
          }
        }

        results.details.push({
          branch: currentBranchId,
          rooms: createdRooms.length,
          tenants: createdTenants.length,
          bookings: createdBookings.length,
          payments: createdPayments.length
        });
        
        results.created += setsForThisBranch;
      }

      const totalItems = results.details.reduce((sum, d) => 
        sum + d.rooms + d.tenants + d.bookings + d.payments, 0
      );

      return Response.json({
        success: true,
        message: `✅ สร้างข้อมูลทดสอบสำเร็จ ${quantity} ชุด!\n\n` +
          `📦 สร้างทั้งหมด ${totalItems} รายการ\n` +
          `🏢 กระจายใน ${totalBranches} สาขา\n\n` +
          `📊 รายละเอียด:\n` +
          results.details.map((d, i) => 
            `สาขา ${i + 1}: ${d.rooms} ห้อง | ${d.tenants} ผู้เช่า | ${d.bookings} จอง | ${d.payments} บิล`
          ).join('\n') +
          (results.errors.length > 0 ? `\n\n⚠️ ข้อผิดพลาด: ${results.errors.length} รายการ` : '') +
          `\n\n💡 หากต้องการสร้างเพิ่ม สามารถรันซ้ำได้เลย`,
        results,
        totalItems
      });
    }

    // ========================================
    // 🏠 Room Only Mode
    // ========================================
    if (entityType === 'Room') {
      console.log(`🏠 Creating ${quantity} rooms...`);

      const roomsToCreate = [];
      const roomsPerBranch = Math.floor(quantity / totalBranches);
      const remainingRooms = quantity % totalBranches;

      for (let branchIndex = 0; branchIndex < totalBranches; branchIndex++) {
        const currentBranchId = targetBranchIds[branchIndex];
        const roomsForThisBranch = roomsPerBranch + (branchIndex < remainingRooms ? 1 : 0);

        const existingRooms = await base44.asServiceRole.entities.Room.filter({ branch_id: currentBranchId });
        const maxFloor = existingRooms.length > 0 
          ? Math.max(...existingRooms.map(r => r.floor || 1))
          : 0;

        for (let i = 0; i < roomsForThisBranch; i++) {
          const globalIndex = (branchIndex * roomsPerBranch) + i;
          const roomNumber = `TEST-${timestamp}-${(globalIndex + 1).toString().padStart(4, '0')}`;
          const floor = maxFloor + Math.floor(i / 10) + 1;

          roomsToCreate.push({
            branch_id: currentBranchId,
            room_number: roomNumber,
            floor: floor,
            room_type: 'monthly',
            price: 3000 + (Math.floor(Math.random() * 10) * 500),
            status: 'available',
            size: 20 + Math.floor(Math.random() * 15),
            amenities: ['แอร์', 'เฟอร์นิเจอร์', 'WiFi'],
            description: `[TEST-${timestamp}] ห้องทดสอบ`
          });
        }
      }

      const batches = createBatches(roomsToCreate, 50);
      console.log(`📦 Creating ${roomsToCreate.length} rooms in ${batches.length} batches...`);

      for (let i = 0; i < batches.length; i++) {
        try {
          const batchResult = await base44.asServiceRole.entities.Room.bulkCreate(batches[i]);
          results.created += batchResult.length;
          console.log(`  ✅ Batch ${i + 1}/${batches.length}: ${batchResult.length} rooms (Total: ${results.created})`);
          if (i < batches.length - 1) await delay(50);
        } catch (error) {
          console.error(`  ❌ Batch ${i + 1} failed:`, error);
          results.failed += batches[i].length;
          results.errors.push(`Batch ${i + 1}: ${error.message}`);
        }
      }

      return Response.json({
        success: true,
        message: `✅ สร้างห้องพักทดสอบสำเร็จ!\n\n` +
          `📊 สร้างสำเร็จ: ${results.created} ห้อง\n` +
          `🏢 กระจายใน ${totalBranches} สาขา\n` +
          (results.failed > 0 ? `❌ ล้มเหลว: ${results.failed} ห้อง\n` : '') +
          (results.errors.length > 0 ? `\n⚠️ Errors: ${results.errors.join(', ')}` : ''),
        created: results.created,
        failed: results.failed
      });
    }

    // ========================================
    // 👥 Tenant Only Mode
    // ========================================
    if (entityType === 'Tenant') {
      console.log(`👥 Creating ${quantity} tenants...`);

      const tenantsToCreate = [];
      const tenantsPerBranch = Math.floor(quantity / totalBranches);
      const remainingTenants = quantity % totalBranches;

      const firstNames = ['สมชาย', 'สมหญิง', 'วิชัย', 'ประภา', 'สุดา', 'นพดล', 'วิไล', 'ชัยยา', 'ธนพล', 'มนัสวี', 'กิตติ', 'ปิยะ'];
      const lastNames = ['ใจดี', 'รักดี', 'มั่นใจ', 'สดใส', 'ยิ้มแย้ม', 'แจ่มใส', 'ใจงาม', 'น้ำใจ', 'ทองดี', 'เพชรดี'];

      for (let branchIndex = 0; branchIndex < totalBranches; branchIndex++) {
        const currentBranchId = targetBranchIds[branchIndex];
        const tenantsForThisBranch = tenantsPerBranch + (branchIndex < remainingTenants ? 1 : 0);

        for (let i = 0; i < tenantsForThisBranch; i++) {
          const globalIndex = (branchIndex * tenantsPerBranch) + i;
          const tenantNumber = globalIndex + 1;

          tenantsToCreate.push({
            branch_id: currentBranchId,
            full_name: `[TEST-${timestamp}] ${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]} #${tenantNumber}`,
            phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
            email: `test_${timestamp}_${tenantNumber}@example.com`,
            notes: `[TEST-${timestamp}] ผู้เช่าทดสอบ`
          });
        }
      }

      const batches = createBatches(tenantsToCreate, 50);
      console.log(`📦 Creating ${tenantsToCreate.length} tenants in ${batches.length} batches...`);

      for (let i = 0; i < batches.length; i++) {
        try {
          const batchResult = await base44.asServiceRole.entities.Tenant.bulkCreate(batches[i]);
          results.created += batchResult.length;
          console.log(`  ✅ Batch ${i + 1}/${batches.length}: ${batchResult.length} tenants (Total: ${results.created})`);
          if (i < batches.length - 1) await delay(50);
        } catch (error) {
          console.error(`  ❌ Batch ${i + 1} failed:`, error);
          results.failed += batches[i].length;
          results.errors.push(`Batch ${i + 1}: ${error.message}`);
        }
      }

      return Response.json({
        success: true,
        message: `✅ สร้างผู้เช่าทดสอบสำเร็จ!\n\n` +
          `📊 สร้างสำเร็จ: ${results.created} คน\n` +
          `🏢 กระจายใน ${totalBranches} สาขา\n` +
          (results.failed > 0 ? `❌ ล้มเหลว: ${results.failed} คน\n` : ''),
        created: results.created,
        failed: results.failed
      });
    }

    // ========================================
    // 💰 Payment Only Mode
    // ========================================
    if (entityType === 'Payment') {
      console.log(`💰 Creating ${quantity} payments...`);

      const paymentsToCreate = [];
      let totalCreated = 0;

      for (const currentBranchId of targetBranchIds) {
        const activeBookings = await base44.asServiceRole.entities.Booking.filter({
          branch_id: currentBranchId,
          status: 'active'
        });

        if (activeBookings.length === 0) {
          console.log(`⚠️ Branch ${currentBranchId}: No active bookings, skipping...`);
          continue;
        }

        const paymentsNeeded = Math.min(
          quantity - totalCreated,
          activeBookings.length * 3 // สร้างได้สูงสุด 3 บิลต่อ booking
        );

        for (let i = 0; i < paymentsNeeded; i++) {
          const booking = activeBookings[i % activeBookings.length];
          
          const room = await base44.asServiceRole.entities.Room.filter({ id: booking.room_id });
          const roomPrice = room[0]?.price || 3000;

          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() - Math.floor(i / activeBookings.length));
          dueDate.setDate(7);

          const rand = Math.random();
          let status = 'paid';
          let paymentDate = null;

          if (rand < 0.65) {
            status = 'paid';
            paymentDate = new Date(dueDate);
            paymentDate.setDate(paymentDate.getDate() - Math.floor(Math.random() * 5));
          } else if (rand < 0.85) {
            status = 'pending';
          } else {
            status = 'overdue';
          }

          paymentsToCreate.push({
            branch_id: currentBranchId,
            booking_id: booking.id,
            tenant_id: booking.tenant_id,
            room_id: booking.room_id,
            due_date: dueDate.toISOString().split('T')[0],
            payment_date: paymentDate ? paymentDate.toISOString().split('T')[0] : null,
            rent_amount: roomPrice,
            water_amount: 50 + Math.floor(Math.random() * 100),
            electricity_amount: 200 + Math.floor(Math.random() * 300),
            internet_amount: 200,
            total_amount: roomPrice + 450,
            status: status,
            payment_method: status === 'paid' ? 'transfer' : 'cash',
            notes: `[TEST-${timestamp}] บิลทดสอบ`
          });

          totalCreated++;
          if (totalCreated >= quantity) break;
        }

        if (totalCreated >= quantity) break;
      }

      const batches = createBatches(paymentsToCreate, 50);
      const createdPayments = [];

      for (let i = 0; i < batches.length; i++) {
        try {
          const batchResult = await base44.asServiceRole.entities.Payment.bulkCreate(batches[i]);
          createdPayments.push(...batchResult);
          console.log(`  ✅ Batch ${i + 1}/${batches.length}: ${batchResult.length} payments (Total: ${createdPayments.length})`);
          if (i < batches.length - 1) await delay(50);
        } catch (error) {
          console.error(`  ❌ Batch ${i + 1} failed:`, error);
          results.errors.push(`Batch ${i + 1}: ${error.message}`);
        }
      }

      return Response.json({
        success: true,
        message: `✅ สร้างบิลทดสอบสำเร็จ!\n\n` +
          `📊 สร้างสำเร็จ: ${createdPayments.length} บิล\n` +
          `🏢 กระจายใน ${totalBranches} สาขา`,
        created: createdPayments.length
      });
    }

    return Response.json({
      success: false,
      error: 'Invalid entityType. Use: CompleteSet, Room, Tenant, or Payment'
    });

  } catch (error) {
    console.error('❌ Error generating test data:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});