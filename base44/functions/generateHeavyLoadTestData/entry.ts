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

    const { roomsPerBranch = 20, yearsToGenerate = 3, branch_id } = await req.json();

    console.log('🚀 HEAVY LOAD TEST - Generating multi-year test data:', { 
      roomsPerBranch, 
      yearsToGenerate,
      branch_id, 
      timestamp: new Date().toISOString() 
    });

    const startTime = Date.now();
    const timestamp = Date.now();
    const results = {
      rooms: 0,
      tenants: 0,
      bookings: 0,
      payments: 0,
      meterReadings: 0,
      maintenanceRequests: 0,
      errors: [],
      timing: {}
    };

    // ดึงข้อมูลสาขา
    const branches = await base44.asServiceRole.entities.Branch.list();
    
    if (branches.length === 0) {
      return Response.json({
        success: false,
        error: 'ไม่พบสาขาในระบบ กรุณาสร้างสาขาก่อน'
      });
    }

    const targetBranchIds = branch_id ? [branch_id] : branches.map(b => b.id);
    const totalBranches = targetBranchIds.length;

    // ดึงค่า config
    const configs = await base44.asServiceRole.entities.Config.list();
    const waterRate = parseFloat(configs.find(c => c.key === 'water_rate')?.value || '18');
    const electricityRate = parseFloat(configs.find(c => c.key === 'electricity_rate')?.value || '7');
    const internetRate = parseFloat(configs.find(c => c.key === 'internet_rate')?.value || '200');

    const today = new Date();
    const startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - yearsToGenerate);

    const totalMonths = yearsToGenerate * 12;
    const totalRoomsToCreate = roomsPerBranch * totalBranches;
    const totalPaymentsToCreate = totalRoomsToCreate * totalMonths;

    console.log(`\n📊 HEAVY LOAD PARAMETERS:`);
    console.log(`   - Branches: ${totalBranches}`);
    console.log(`   - Rooms per branch: ${roomsPerBranch}`);
    console.log(`   - Total rooms: ${totalRoomsToCreate}`);
    console.log(`   - Years: ${yearsToGenerate} (${totalMonths} months)`);
    console.log(`   - Expected payments: ${totalPaymentsToCreate}`);
    console.log(`   - Date range: ${startDate.toISOString().split('T')[0]} to ${today.toISOString().split('T')[0]}\n`);

    // ⭐ สร้างข้อมูลทุกสาขาพร้อมกันแบบ concurrent
    const branchPromises = targetBranchIds.map(async (currentBranchId, branchIndex) => {
      const branchStartTime = Date.now();
      console.log(`\n🏢 Branch ${branchIndex + 1}/${totalBranches} (${currentBranchId.substring(0, 8)}...): Starting...`);

      const branchResults = {
        rooms: 0,
        tenants: 0,
        bookings: 0,
        payments: 0,
        meterReadings: 0,
        maintenanceRequests: 0,
        errors: []
      };

      try {
        // 1. สร้างห้อง
        const roomsToCreate = [];
        const existingRooms = await base44.asServiceRole.entities.Room.filter({ branch_id: currentBranchId });
        const maxFloor = existingRooms.length > 0 ? Math.max(...existingRooms.map(r => r.floor || 1)) : 0;

        for (let i = 0; i < roomsPerBranch; i++) {
          const roomNumber = `HEAVY-${timestamp}-B${branchIndex}-${(i + 1).toString().padStart(4, '0')}`;
          const floor = maxFloor + Math.floor(i / 10) + 1;

          roomsToCreate.push({
            branch_id: currentBranchId,
            room_number: roomNumber,
            floor: floor,
            room_type: 'monthly',
            price: 3000 + (Math.floor(Math.random() * 10) * 500),
            status: 'occupied',
            size: 20 + Math.floor(Math.random() * 15),
            amenities: ['แอร์', 'เฟอร์นิเจอร์', 'WiFi'],
            description: `[HEAVY-TEST-${timestamp}] ทดสอบ ${yearsToGenerate} ปี`
          });
        }

        const createdRooms = await base44.asServiceRole.entities.Room.bulkCreate(roomsToCreate);
        branchResults.rooms = createdRooms.length;
        console.log(`  ✅ Branch ${branchIndex + 1}: Created ${createdRooms.length} rooms`);

        // 2. สร้างผู้เช่า
        const tenantsToCreate = [];
        const firstNames = ['สมชาย', 'สมหญิง', 'วิชัย', 'ประภา', 'สุดา', 'นพดล', 'วิไล', 'ชัยยา', 'ธนพล', 'มนัสวี'];
        const surnames = ['ใจดี', 'รักดี', 'มั่นใจ', 'สดใส', 'ยิ้มแย้ม', 'แจ่มใส', 'ใจงาม', 'น้ำใจ'];

        for (let i = 0; i < roomsPerBranch; i++) {
          tenantsToCreate.push({
            branch_id: currentBranchId,
            full_name: `[HEAVY-${timestamp}] ${firstNames[i % firstNames.length]} ${surnames[i % surnames.length]} #${i + 1}`,
            phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
            email: `heavy_test_${timestamp}_b${branchIndex}_${i + 1}@example.com`,
            notes: `[HEAVY-TEST-${timestamp}] ทดสอบ ${yearsToGenerate} ปี`
          });
        }

        const createdTenants = await base44.asServiceRole.entities.Tenant.bulkCreate(tenantsToCreate);
        branchResults.tenants = createdTenants.length;
        console.log(`  ✅ Branch ${branchIndex + 1}: Created ${createdTenants.length} tenants`);

        // 3. สร้าง Bookings
        const bookingsToCreate = createdRooms.map((room, i) => ({
          branch_id: currentBranchId,
          room_id: room.id,
          tenant_id: createdTenants[i].id,
          check_in_date: startDate.toISOString().split('T')[0],
          check_out_date: today.toISOString().split('T')[0],
          booking_type: 'monthly',
          status: 'active',
          deposit_amount: room.price * 2,
          total_amount: room.price,
          notes: `[HEAVY-TEST-${timestamp}] สัญญา ${yearsToGenerate} ปี`
        }));

        const createdBookings = await base44.asServiceRole.entities.Booking.bulkCreate(bookingsToCreate);
        branchResults.bookings = createdBookings.length;
        console.log(`  ✅ Branch ${branchIndex + 1}: Created ${createdBookings.length} bookings`);

        // 4. สร้าง Payments แบบ concurrent (ทีละ batch ใหญ่)
        const paymentsToCreate = [];
        
        for (let i = 0; i < createdBookings.length; i++) {
          const booking = createdBookings[i];
          const room = createdRooms[i];

          // สร้างบิลสำหรับทุกเดือนใน N ปี
          for (let month = 0; month < totalMonths; month++) {
            const billDate = new Date(startDate);
            billDate.setMonth(billDate.getMonth() + month);
            billDate.setDate(5); // วันครบกำหนด

            // กำหนดสถานะ: บิลเก่าส่วนใหญ่จ่ายแล้ว, บิล 2-3 เดือนล่าสุดมี pending/overdue
            const rand = Math.random();
            let status = 'paid';
            let paymentDate = null;

            const isRecentMonth = month >= totalMonths - 3;
            
            if (isRecentMonth) {
              if (rand < 0.4) {
                status = 'paid';
                paymentDate = new Date(billDate);
                paymentDate.setDate(paymentDate.getDate() - Math.floor(Math.random() * 3));
              } else if (rand < 0.7) {
                status = 'pending';
              } else {
                status = 'overdue';
              }
            } else {
              if (rand < 0.85) {
                status = 'paid';
                paymentDate = new Date(billDate);
                paymentDate.setDate(paymentDate.getDate() - Math.floor(Math.random() * 7));
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
              notes: `[HEAVY-TEST-${timestamp}] บิลเดือนที่ ${month + 1}/${totalMonths}`
            });
          }
        }

        console.log(`  💰 Branch ${branchIndex + 1}: Creating ${paymentsToCreate.length} payments (${totalMonths} months x ${roomsPerBranch} rooms)...`);
        
        // สร้าง payments แบบ batch ขนาดใหญ่ (50 รายการต่อ batch)
        const paymentBatches = createBatches(paymentsToCreate, 50);
        
        for (let bIdx = 0; bIdx < paymentBatches.length; bIdx++) {
          try {
            const batch = paymentBatches[bIdx];
            const batchResult = await base44.asServiceRole.entities.Payment.bulkCreate(batch);
            branchResults.payments += batchResult.length;
            
            if ((bIdx + 1) % 10 === 0 || bIdx === paymentBatches.length - 1) {
              console.log(`  💳 Branch ${branchIndex + 1}: Payment progress ${branchResults.payments}/${paymentsToCreate.length} (${Math.round(branchResults.payments/paymentsToCreate.length*100)}%)`);
            }
            
            // ลด delay ลงเพื่อให้เร็วขึ้น แต่ยังป้องกัน rate limit
            if (bIdx < paymentBatches.length - 1 && bIdx % 5 === 4) {
              await delay(100);
            }
          } catch (error) {
            console.error(`  ❌ Branch ${branchIndex + 1} Payment Batch ${bIdx + 1} failed:`, error);
            branchResults.errors.push(`Payments Batch ${bIdx + 1}: ${error.message}`);
          }
        }

        // 5. สร้าง MeterReadings แบบ concurrent (1 รายการต่อเดือน)
        const meterReadingsToCreate = [];
        
        for (let i = 0; i < createdRooms.length; i++) {
          const room = createdRooms[i];
          let prevWater = Math.floor(Math.random() * 100);
          let prevElec = Math.floor(Math.random() * 500);

          for (let month = 0; month < totalMonths; month++) {
            const readingDate = new Date(startDate);
            readingDate.setMonth(readingDate.getMonth() + month);
            readingDate.setDate(25);

            const waterUsed = 5 + Math.floor(Math.random() * 15);
            const elecUsed = 50 + Math.floor(Math.random() * 150);

            meterReadingsToCreate.push({
              branch_id: currentBranchId,
              room_id: room.id,
              reading_date: readingDate.toISOString().split('T')[0],
              water_previous: prevWater,
              water_current: prevWater + waterUsed,
              electricity_previous: prevElec,
              electricity_current: prevElec + elecUsed,
              water_units: waterUsed,
              electricity_units: elecUsed,
              notes: `[HEAVY-TEST-${timestamp}] มิเตอร์เดือนที่ ${month + 1}/${totalMonths}`
            });

            prevWater += waterUsed;
            prevElec += elecUsed;
          }
        }

        console.log(`  📊 Branch ${branchIndex + 1}: Creating ${meterReadingsToCreate.length} meter readings...`);
        const meterBatches = createBatches(meterReadingsToCreate, 50);
        
        for (let bIdx = 0; bIdx < meterBatches.length; bIdx++) {
          try {
            const batch = meterBatches[bIdx];
            const batchResult = await base44.asServiceRole.entities.MeterReading.bulkCreate(batch);
            branchResults.meterReadings += batchResult.length;
            
            if ((bIdx + 1) % 10 === 0 || bIdx === meterBatches.length - 1) {
              console.log(`  📏 Branch ${branchIndex + 1}: Meter readings ${branchResults.meterReadings}/${meterReadingsToCreate.length}`);
            }
            
            if (bIdx < meterBatches.length - 1 && bIdx % 5 === 4) {
              await delay(100);
            }
          } catch (error) {
            console.error(`  ❌ Branch ${branchIndex + 1} Meter Batch ${bIdx + 1} failed:`, error);
            branchResults.errors.push(`Meter Batch ${bIdx + 1}: ${error.message}`);
          }
        }

        // 6. สร้างแจ้งซ่อมแบบสุ่ม
        const maintenanceToCreate = [];
        const categories = ['electric', 'plumbing', 'furniture', 'air_conditioner', 'other'];
        const priorities = ['low', 'medium', 'high', 'urgent'];
        
        // สุ่มสร้างแจ้งซ่อม 20-30% ของห้อง
        const maintenanceCount = Math.floor(roomsPerBranch * 0.25);
        
        for (let i = 0; i < maintenanceCount; i++) {
          const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
          const tenant = createdTenants[i % createdTenants.length];
          const randomMonth = Math.floor(Math.random() * totalMonths);
          const requestDate = new Date(startDate);
          requestDate.setMonth(requestDate.getMonth() + randomMonth);

          maintenanceToCreate.push({
            branch_id: currentBranchId,
            room_id: room.id,
            tenant_id: tenant.id,
            title: `[HEAVY-TEST-${timestamp}] แจ้งซ่อม ${categories[i % categories.length]}`,
            description: `ทดสอบระบบแจ้งซ่อม - ${yearsToGenerate} ปี`,
            category: categories[i % categories.length],
            priority: priorities[i % priorities.length],
            status: Math.random() < 0.7 ? 'completed' : 'pending',
            completed_date: Math.random() < 0.7 ? requestDate.toISOString().split('T')[0] : null,
            cost: Math.floor(Math.random() * 5000)
          });
        }

        if (maintenanceToCreate.length > 0) {
          const createdMaintenance = await base44.asServiceRole.entities.MaintenanceRequest.bulkCreate(maintenanceToCreate);
          branchResults.maintenanceRequests = createdMaintenance.length;
          console.log(`  🔧 Branch ${branchIndex + 1}: Created ${createdMaintenance.length} maintenance requests`);
        }

        const branchElapsed = Date.now() - branchStartTime;
        console.log(`  ⏱️ Branch ${branchIndex + 1}: Completed in ${(branchElapsed/1000).toFixed(2)}s`);

        return branchResults;

      } catch (error) {
        console.error(`❌ Branch ${branchIndex + 1} failed:`, error);
        branchResults.errors.push(`Branch error: ${error.message}`);
        return branchResults;
      }
    });

    // รอให้ทุกสาขาสร้างข้อมูลเสร็จพร้อมกัน
    console.log('\n⏳ Waiting for all branches to complete...\n');
    const branchResults = await Promise.all(branchPromises);

    // รวมผลลัพธ์
    branchResults.forEach(br => {
      results.rooms += br.rooms;
      results.tenants += br.tenants;
      results.bookings += br.bookings;
      results.payments += br.payments;
      results.meterReadings += br.meterReadings;
      results.maintenanceRequests += br.maintenanceRequests;
      results.errors.push(...br.errors);
    });

    const totalElapsed = Date.now() - startTime;
    results.timing.total_seconds = (totalElapsed / 1000).toFixed(2);
    results.timing.payments_per_second = (results.payments / (totalElapsed / 1000)).toFixed(2);

    const totalItems = results.rooms + results.tenants + results.bookings + results.payments + results.meterReadings + results.maintenanceRequests;

    console.log(`\n🎉 HEAVY LOAD TEST COMPLETED!`);
    console.log(`   Total time: ${results.timing.total_seconds}s`);
    console.log(`   Total items: ${totalItems}`);
    console.log(`   Speed: ${results.timing.payments_per_second} payments/sec`);

    return Response.json({
      success: true,
      message: `🚀 สร้างข้อมูลทดสอบ ${yearsToGenerate} ปีสำเร็จ!\n\n` +
        `⏱️ เวลาที่ใช้: ${results.timing.total_seconds} วินาที\n` +
        `⚡ ความเร็ว: ${results.timing.payments_per_second} payments/วินาที\n\n` +
        `📊 สรุปผลลัพธ์:\n` +
        `🏠 ห้องพัก: ${results.rooms} ห้อง\n` +
        `👥 ผู้เช่า: ${results.tenants} คน\n` +
        `📋 การจอง: ${results.bookings} สัญญา\n` +
        `💰 บิลชำระเงิน: ${results.payments} บิล (${totalMonths} เดือน x ${results.rooms} ห้อง)\n` +
        `📏 มิเตอร์: ${results.meterReadings} รายการ\n` +
        `🔧 แจ้งซ่อม: ${results.maintenanceRequests} รายการ\n` +
        `📦 รวมทั้งหมด: ${totalItems} รายการ\n` +
        `🏢 กระจายใน ${totalBranches} สาขา\n` +
        (results.errors.length > 0 ? `\n⚠️ ข้อผิดพลาด: ${results.errors.length} รายการ` : '') +
        `\n\n💡 ข้อมูลครอบคลุม ${yearsToGenerate} ปีย้อนหลัง พร้อมทดสอบ performance และ scalability`,
      results,
      totalItems,
      performance: {
        total_time_seconds: results.timing.total_seconds,
        items_per_second: (totalItems / (totalElapsed / 1000)).toFixed(2),
        payments_per_second: results.timing.payments_per_second,
        concurrent_branches: totalBranches
      }
    });

  } catch (error) {
    console.error('❌ HEAVY LOAD TEST FAILED:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});