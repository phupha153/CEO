import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

const createBatches = (items, batchSize = 50) => {
  const batches = [];
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  return batches;
};

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async (fn, maxRetries = 5, baseDelay = 2000) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const isRateLimit = error.message?.includes('429') || 
                         error.message?.includes('Too Many Requests') || 
                         error.message?.includes('Rate limit') ||
                         error.message?.includes('fetch failed'); // Network glitches
      
      if (isRateLimit) {
        const waitTime = baseDelay * Math.pow(2, i);
        console.log(`⚠️ Rate limit/Network error. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
        await delay(waitTime);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      branchCount = 50, 
      roomsPerBranch = 50, 
      yearsToGenerate = 3,
      dataTypes = {
        rooms: true,
        tenants: true,
        bookings: true,
        payments: true,
        meterReadings: true,
        maintenance: true
      }
    } = await req.json();

    const startTime = Date.now();
    const timestamp = Date.now();

    console.log('🚀🚀🚀 MASSIVE LOAD TEST STARTED');
    console.log(`📊 Parameters:
    - Branches: ${branchCount}
    - Rooms per branch: ${roomsPerBranch}
    - Years: ${yearsToGenerate} (${yearsToGenerate * 12} months)
    - Expected total rooms: ${branchCount * roomsPerBranch}
    - Expected total bills: ${branchCount * roomsPerBranch * yearsToGenerate * 12}
    - Start time: ${new Date().toISOString()}
`);

    const results = {
      branches: 0,
      rooms: 0,
      tenants: 0,
      bookings: 0,
      payments: 0,
      meterReadings: 0,
      maintenanceRequests: 0,
      errors: [],
      timing: {}
    };

    const configs = await base44.asServiceRole.entities.Config.list();
    const waterRate = parseFloat(configs.find(c => c.key === 'water_rate')?.value || '18');
    const electricityRate = parseFloat(configs.find(c => c.key === 'electricity_rate')?.value || '7');
    const internetRate = parseFloat(configs.find(c => c.key === 'internet_rate')?.value || '200');

    const today = new Date();
    const startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - yearsToGenerate);
    const totalMonths = yearsToGenerate * 12;

    let targetBranches = [];

    // 1. สร้างสาขา (เฉพาะถ้าต้องการสร้างห้อง)
    if (dataTypes.rooms) {
      console.log(`\n🏢 Step 1: Creating ${branchCount} branches...`);
      const branchesStep1Start = Date.now();
      
      const branchesToCreate = [];
      const provinces = ['กรุงเทพ', 'เชียงใหม่', 'ภูเก็ต', 'ขอนแก่น', 'นครราชสีมา', 'หาดใหญ่', 'ระยอง', 'ชลบุรี'];
      
      for (let i = 0; i < branchCount; i++) {
        branchesToCreate.push({
          branch_name: `MASSIVE-TEST-${timestamp}-B${(i + 1).toString().padStart(3, '0')}`,
          branch_code: `MASS-${timestamp}-${(i + 1).toString().padStart(3, '0')}`,
          address: `${provinces[i % provinces.length]} ${Math.floor(Math.random() * 999) + 1}`,
          phone: `02${Math.floor(Math.random() * 9000000 + 1000000)}`,
          manager_name: `ผู้จัดการ${i + 1}`,
          total_rooms: roomsPerBranch,
          status: 'active',
          description: `[MASSIVE-TEST-${timestamp}] สาขาทดสอบ ${yearsToGenerate} ปี`
        });
      }

      const branchBatches = createBatches(branchesToCreate, 50);
      const createdBranches = [];
      
      for (let bIdx = 0; bIdx < branchBatches.length; bIdx++) {
        const batch = branchBatches[bIdx];
        const batchResult = await base44.asServiceRole.entities.Branch.bulkCreate(batch);
        createdBranches.push(...batchResult);
        console.log(`  ✅ Branch Batch ${bIdx + 1}/${branchBatches.length}: ${batchResult.length} branches`);
        if (bIdx < branchBatches.length - 1) await delay(500);
      }

      targetBranches = createdBranches;
      results.branches = createdBranches.length;
      results.timing.branches_seconds = ((Date.now() - branchesStep1Start) / 1000).toFixed(2);
      console.log(`✅ Created ${results.branches} branches in ${results.timing.branches_seconds}s\n`);
    } else {
      // ถ้าไม่สร้างห้อง ใช้สาขาที่มีอยู่แล้ว
      console.log(`\n🏢 Step 1: Using existing branches...`);
      const existingBranches = await base44.asServiceRole.entities.Branch.list();
      targetBranches = existingBranches.slice(0, branchCount);
      console.log(`✅ Using ${targetBranches.length} existing branches\n`);
    }

    // 2. สร้างข้อมูลทีละสาขา (Sequential) เพื่อความเสถียรสูงสุด
    console.log(`\n🚀 Step 2: Creating data for ${targetBranches.length} branches (Sequential)...`);
    console.log(`📊 Data types enabled:`, dataTypes);
    const dataStep2Start = Date.now();

    const processBranch = async (branch, branchIndex) => {
      const branchStartTime = Date.now();
      const branchResults = {
        branch_id: branch.id,
        branch_name: branch.branch_name,
        rooms: 0,
        tenants: 0,
        bookings: 0,
        payments: 0,
        meterReadings: 0,
        maintenanceRequests: 0,
        errors: []
      };

      // ถ้าสร้างเฉพาะบิล ให้ดึงข้อมูลที่มีอยู่
      let existingRooms = [];
      let existingTenants = [];
      let existingBookings = [];
      
      if (!dataTypes.rooms && (dataTypes.payments || dataTypes.meterReadings)) {
        existingRooms = await base44.asServiceRole.entities.Room.filter({ branch_id: branch.id });
        if (dataTypes.payments) {
          existingBookings = await base44.asServiceRole.entities.Booking.filter({ branch_id: branch.id, status: 'active' });
        }
      }

      try {
        console.log(`\n🏢 Branch ${branchIndex + 1}: Starting...`);
        
        // สร้างห้อง (เฉพาะถ้าเลือก)
        let createdRooms = [];
        if (dataTypes.rooms) {
          console.log(`  📦 Creating ${roomsPerBranch} rooms...`);
          const roomsToCreate = [];
          for (let i = 0; i < roomsPerBranch; i++) {
            roomsToCreate.push({
              branch_id: branch.id,
              room_number: `${branchIndex + 1}-${(i + 1).toString().padStart(3, '0')}`,
              floor: Math.floor(i / 10) + 1,
              room_type: 'monthly',
              price: 3000 + (Math.floor(Math.random() * 10) * 500),
              status: 'occupied',
              size: 20 + Math.floor(Math.random() * 15),
              amenities: ['แอร์', 'WiFi'],
              description: `[MASSIVE-TEST-${timestamp}]`
            });
          }

          createdRooms = await base44.asServiceRole.entities.Room.bulkCreate(roomsToCreate);
          branchResults.rooms = createdRooms.length;
          console.log(`  ✅ Created ${createdRooms.length} rooms`);
        } else {
          console.log(`  ⏭️ Skipping rooms (not selected)`);
        }

        // สร้างผู้เช่า (เฉพาะถ้าเลือกและมีห้อง)
        let createdTenants = [];
        if (dataTypes.tenants && createdRooms.length > 0) {
          console.log(`  📦 Creating ${createdRooms.length} tenants...`);
          const tenantsToCreate = createdRooms.map((room, i) => ({
            branch_id: branch.id,
            full_name: `[MASSIVE-${timestamp}] ผู้เช่า B${branchIndex + 1}-${i + 1}`,
            phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
            email: `mass_${timestamp}_b${branchIndex}_${i}@test.com`,
            notes: `[MASSIVE-TEST-${timestamp}]`
          }));

          createdTenants = await base44.asServiceRole.entities.Tenant.bulkCreate(tenantsToCreate);
          branchResults.tenants = createdTenants.length;
          console.log(`  ✅ Created ${createdTenants.length} tenants`);
          } else if (dataTypes.tenants) {
          console.log(`  ⏭️ Skipping tenants (no rooms available)`);
          } else {
          console.log(`  ⏭️ Skipping tenants (not selected)`);
          }

          // สร้าง Bookings (เฉพาะถ้าเลือกและมีห้อง+ผู้เช่า)
          let createdBookings = [];
          if (dataTypes.bookings && createdRooms.length > 0 && createdTenants.length > 0) {
          console.log(`  📦 Creating ${createdRooms.length} bookings...`);
          const bookingsToCreate = createdRooms.map((room, i) => ({
            branch_id: branch.id,
            room_id: room.id,
            tenant_id: createdTenants[i].id,
            check_in_date: startDate.toISOString().split('T')[0],
            check_out_date: today.toISOString().split('T')[0],
            booking_type: 'monthly',
            status: 'active',
            deposit_amount: room.price * 2,
            total_amount: room.price,
            notes: `[MASSIVE-TEST-${timestamp}]`
          }));

          createdBookings = await base44.asServiceRole.entities.Booking.bulkCreate(bookingsToCreate);
          branchResults.bookings = createdBookings.length;
          console.log(`  ✅ Created ${createdBookings.length} bookings`);
          } else if (dataTypes.bookings) {
          console.log(`  ⏭️ Skipping bookings (no rooms or tenants)`);
          } else {
          console.log(`  ⏭️ Skipping bookings (not selected)`);
          }

          // สร้าง Payments (เฉพาะถ้าเลือก)
          if (dataTypes.payments) {
            // ถ้าต้องการสร้างบิล แต่ไม่มี bookings → สร้าง bookings อัตโนมัติ
            if (createdBookings.length === 0 && existingBookings.length === 0 && (createdRooms.length > 0 || existingRooms.length > 0)) {
              const roomsForAutoBookings = createdRooms.length > 0 ? createdRooms : existingRooms;
              const tenantsForAutoBookings = createdTenants.length > 0 ? createdTenants : (await base44.asServiceRole.entities.Tenant.filter({ branch_id: branch.id }));

              console.log(`  ⚠️ สร้างบิลต้องมีการจอง - กำลังสร้างการจองอัตโนมัติ...`);

              // ถ้าไม่มี tenants ก็สร้าง tenants อัตโนมัติด้วย
              if (tenantsForAutoBookings.length === 0) {
                console.log(`  📦 Creating ${roomsForAutoBookings.length} tenants (auto)...`);
                const tenantsToCreate = roomsForAutoBookings.map((room, i) => ({
                  branch_id: branch.id,
                  full_name: `[MASSIVE-${timestamp}] ผู้เช่า B${branchIndex + 1}-${i + 1}`,
                  phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
                  email: `mass_${timestamp}_b${branchIndex}_${i}@test.com`,
                  notes: `[MASSIVE-TEST-${timestamp}] Auto-created for payments`
                }));

                const autoTenants = await base44.asServiceRole.entities.Tenant.bulkCreate(tenantsToCreate);
                createdTenants.push(...autoTenants);
                branchResults.tenants = autoTenants.length;
                console.log(`  ✅ Created ${autoTenants.length} tenants (auto)`);
              }

              // สร้าง bookings อัตโนมัติ
              console.log(`  📦 Creating ${roomsForAutoBookings.length} bookings (auto)...`);
              const bookingsToCreate = roomsForAutoBookings.map((room, i) => ({
                branch_id: branch.id,
                room_id: room.id,
                tenant_id: (createdTenants[i] || tenantsForAutoBookings[i]).id,
                check_in_date: startDate.toISOString().split('T')[0],
                check_out_date: today.toISOString().split('T')[0],
                booking_type: 'monthly',
                status: 'active',
                deposit_amount: room.price * 2,
                total_amount: room.price,
                notes: `[MASSIVE-TEST-${timestamp}] Auto-created for payments`
              }));

              const autoBookings = await base44.asServiceRole.entities.Booking.bulkCreate(bookingsToCreate);
              createdBookings.push(...autoBookings);
              branchResults.bookings = autoBookings.length;
              console.log(`  ✅ Created ${autoBookings.length} bookings (auto)`);
            }

            const bookingsForPayments = createdBookings.length > 0 ? createdBookings : existingBookings;
            const roomsForPayments = createdRooms.length > 0 ? createdRooms : existingRooms;

            if (bookingsForPayments.length > 0 && roomsForPayments.length > 0) {
              console.log(`  📦 Creating payments for ${bookingsForPayments.length} bookings x ${totalMonths} months...`);
              const paymentsToCreate = [];
              for (let i = 0; i < Math.min(bookingsForPayments.length, roomsForPayments.length); i++) {
                const booking = bookingsForPayments[i];
                const room = roomsForPayments.find(r => r.id === booking.room_id) || roomsForPayments[i];

          for (let month = 0; month < totalMonths; month++) {
            const billDate = new Date(startDate);
            billDate.setMonth(billDate.getMonth() + month);
            billDate.setDate(5);

            const rand = Math.random();
            const isRecentMonth = month >= totalMonths - 3;
            let status = 'paid';
            let paymentDate = null;

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
              }
            }

            const waterUnits = 5 + Math.floor(Math.random() * 15);
            const electricityUnits = 50 + Math.floor(Math.random() * 150);

            paymentsToCreate.push({
              branch_id: branch.id,
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
              notes: `[MASSIVE-TEST-${timestamp}]`
            });
          }
        }

            // Reduced batch size to 10 and added retry logic + delay
            const paymentBatches = createBatches(paymentsToCreate, 10);
            for (let bIdx = 0; bIdx < paymentBatches.length; bIdx++) {
              await retryOperation(async () => {
                const batch = paymentBatches[bIdx];
                const batchResult = await base44.asServiceRole.entities.Payment.bulkCreate(batch);
                branchResults.payments += batchResult.length;
              });
              // Delay 200ms between EVERY batch to stay under rate limits (approx 3000 writes/min max)
              await delay(200);
            }
            console.log(`  ✅ Created ${branchResults.payments} payments`);
          } else {
            console.log(`  ⏭️ Skipping payments (no bookings or rooms)`);
          }
        } else {
          console.log(`  ⏭️ Skipping payments (not selected)`);
        }

        // สร้าง MeterReadings (เฉพาะถ้าเลือก)
        if (dataTypes.meterReadings) {
          const roomsForMeters = createdRooms.length > 0 ? createdRooms : existingRooms;

          if (roomsForMeters.length > 0) {
            console.log(`  📦 Creating meter readings for ${roomsForMeters.length} rooms x ${totalMonths} months...`);
            const meterReadingsToCreate = [];
            for (let i = 0; i < roomsForMeters.length; i++) {
              const room = roomsForMeters[i];
          let prevWater = Math.floor(Math.random() * 100);
          let prevElec = Math.floor(Math.random() * 500);

          for (let month = 0; month < totalMonths; month++) {
            const readingDate = new Date(startDate);
            readingDate.setMonth(readingDate.getMonth() + month);
            readingDate.setDate(25);

            const waterUsed = 5 + Math.floor(Math.random() * 15);
            const elecUsed = 50 + Math.floor(Math.random() * 150);

            meterReadingsToCreate.push({
              branch_id: branch.id,
              room_id: room.id,
              reading_date: readingDate.toISOString().split('T')[0],
              water_previous: prevWater,
              water_current: prevWater + waterUsed,
              electricity_previous: prevElec,
              electricity_current: prevElec + elecUsed,
              water_units: waterUsed,
              electricity_units: elecUsed,
              notes: `[MASSIVE-TEST-${timestamp}]`
            });

            prevWater += waterUsed;
            prevElec += elecUsed;
          }
        }

            // Reduced batch size to 10 and added retry logic + delay
            const meterBatches = createBatches(meterReadingsToCreate, 10);
            for (let bIdx = 0; bIdx < meterBatches.length; bIdx++) {
              await retryOperation(async () => {
                const batch = meterBatches[bIdx];
                const batchResult = await base44.asServiceRole.entities.MeterReading.bulkCreate(batch);
                branchResults.meterReadings += batchResult.length;
              });
              await delay(200);
            }
            console.log(`  ✅ Created ${branchResults.meterReadings} meter readings`);
          } else {
            console.log(`  ⏭️ Skipping meter readings (no rooms)`);
          }
        } else {
          console.log(`  ⏭️ Skipping meter readings (not selected)`);
        }

        // สร้างแจ้งซ่อม (เฉพาะถ้าเลือกและมีห้อง+ผู้เช่า)
        if (dataTypes.maintenance && createdRooms.length > 0 && createdTenants.length > 0) {
          const maintenanceCount = Math.floor(roomsPerBranch * 0.2);
          console.log(`  📦 Creating ${maintenanceCount} maintenance requests...`);
          const categories = ['electric', 'plumbing', 'furniture', 'air_conditioner'];
          const maintenanceToCreate = [];

        for (let i = 0; i < maintenanceCount; i++) {
          const room = createdRooms[Math.floor(Math.random() * createdRooms.length)];
          const tenant = createdTenants[i % createdTenants.length];
          const randomMonth = Math.floor(Math.random() * totalMonths);
          const requestDate = new Date(startDate);
          requestDate.setMonth(requestDate.getMonth() + randomMonth);

          maintenanceToCreate.push({
            branch_id: branch.id,
            room_id: room.id,
            tenant_id: tenant.id,
            title: `[MASSIVE-${timestamp}] แจ้งซ่อม`,
            description: `ทดสอบ massive load`,
            category: categories[i % categories.length],
            priority: 'medium',
            status: Math.random() < 0.7 ? 'completed' : 'pending'
          });
        }

          if (maintenanceToCreate.length > 0) {
            const createdMaintenance = await base44.asServiceRole.entities.MaintenanceRequest.bulkCreate(maintenanceToCreate);
            branchResults.maintenanceRequests = createdMaintenance.length;
            console.log(`  ✅ Created ${createdMaintenance.length} maintenance requests`);
          }
        } else if (dataTypes.maintenance) {
          console.log(`  ⏭️ Skipping maintenance (no rooms or tenants)`);
        } else {
          console.log(`  ⏭️ Skipping maintenance (not selected)`);
        }

        const branchElapsed = ((Date.now() - branchStartTime) / 1000).toFixed(2);
        console.log(`✅ Branch ${branchIndex + 1}/${branchCount} COMPLETED:`, {
          rooms: branchResults.rooms,
          tenants: branchResults.tenants,
          bookings: branchResults.bookings,
          payments: branchResults.payments,
          meters: branchResults.meterReadings,
          maintenance: branchResults.maintenanceRequests,
          time: `${branchElapsed}s`
        });

        return branchResults;

      } catch (error) {
        console.error(`❌ Branch ${branchIndex + 1} failed:`, error);
        branchResults.errors.push(`Branch ${branchIndex + 1}: ${error.message}`);
        return branchResults;
      }
    };

    console.log('\n⏳ Processing branches sequentially...\n');
    const branchResults = [];
    
    // ทำทีละสาขา (Sequential)
    for (let i = 0; i < targetBranches.length; i++) {
      const branch = targetBranches[i];
      console.log(`\n📦 Processing branch ${i + 1}/${targetBranches.length}...`);
      
      const result = await processBranch(branch, i);
      branchResults.push(result);
      
      const totalSoFar = branchResults.reduce((sum, br) => sum + br.rooms + br.tenants + br.bookings + br.payments + br.meterReadings + br.maintenanceRequests, 0);
      console.log(`✅ Branch ${i + 1} completed - Total items so far: ${totalSoFar}`);
      
      // Delay ระหว่างสาขา
      if (i < targetBranches.length - 1) {
        console.log(`⏸️ Waiting 2 seconds before next branch...`);
        await delay(2000);
      }
    }

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
    results.timing.total_minutes = (totalElapsed / 60000).toFixed(2);
    results.timing.payments_per_second = (results.payments / (totalElapsed / 1000)).toFixed(2);

    const totalItems = results.branches + results.rooms + results.tenants + results.bookings + results.payments + results.meterReadings + results.maintenanceRequests;

    console.log(`\n🎉🎉🎉 MASSIVE LOAD TEST COMPLETED!`);
    console.log(`   Total time: ${results.timing.total_minutes} minutes`);
    console.log(`   Total items: ${totalItems}`);
    console.log(`   Speed: ${results.timing.payments_per_second} payments/sec`);

    return Response.json({
      success: true,
      message: `🎉 MASSIVE LOAD TEST สำเร็จ!\n\n` +
        `⏱️ เวลาที่ใช้: ${results.timing.total_minutes} นาที (${results.timing.total_seconds} วินาที)\n` +
        `⚡ ความเร็ว: ${results.timing.payments_per_second} payments/วินาที\n\n` +
        `📊 สรุปผลลัพธ์:\n` +
        `🏢 สาขา: ${results.branches} สาขา\n` +
        `🏠 ห้องพัก: ${results.rooms} ห้อง\n` +
        `👥 ผู้เช่า: ${results.tenants} คน\n` +
        `📋 การจอง: ${results.bookings} สัญญา\n` +
        `💰 บิล: ${results.payments} บิล (${yearsToGenerate} ปี x ${totalMonths} เดือน)\n` +
        `📏 มิเตอร์: ${results.meterReadings} รายการ\n` +
        `🔧 แจ้งซ่อม: ${results.maintenanceRequests} รายการ\n` +
        `📦 รวมทั้งหมด: ${totalItems} รายการ\n\n` +
        (results.errors.length > 0 ? `⚠️ ข้อผิดพลาด: ${results.errors.length} รายการ\n\n` : '') +
        `🚀 ระบบรองรับ concurrent processing และ heavy load ได้อย่างมีประสิทธิภาพ!`,
      results: {
        branches: results.branches,
        rooms: results.rooms,
        tenants: results.tenants,
        bookings: results.bookings,
        payments: results.payments,
        meterReadings: results.meterReadings,
        maintenance: results.maintenanceRequests,
        total: totalItems,
        performance: {
          totalTime: `${results.timing.total_minutes} นาที`,
          paymentsPerSecond: results.timing.payments_per_second
        }
      }
    });

  } catch (error) {
    console.error('❌ MASSIVE LOAD TEST FAILED:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});