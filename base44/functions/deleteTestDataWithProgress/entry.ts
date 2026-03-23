import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
        error: 'Forbidden - Only developer or owner can delete test data' 
      }, { status: 403 });
    }

    let batchSize = 1000;
    let delayMs = 0;
    let maxTimeSeconds = 110;
    let maxItemsPerRun = 100000;
    let requestData = {};
    
    try {
      requestData = await req.json();
      batchSize = requestData.batchSize || 1000;
      delayMs = requestData.delayMs || 0;
      maxTimeSeconds = requestData.maxTimeSeconds || 110;
      maxItemsPerRun = requestData.maxItemsPerRun || 100000;
    } catch (e) {
      console.log('⚠️ No body provided, using defaults');
    }

    console.log('🗑️ Starting test data deletion with progress:', { 
      batchSize, 
      delayMs,
      maxTimeSeconds,
      maxItemsPerRun,
      timestamp: new Date().toISOString() 
    });

    const startTime = Date.now();
    const results = {
      deleted: {
        payments: 0,
        meterReadings: 0,
        maintenanceRequests: 0,
        bookings: 0,
        tenants: 0,
        rooms: 0,
        branches: 0
      },
      errors: [],
      batches: [],
      totalItemsDeleted: 0,
      reachedLimit: false,
      timing: {
        reached_timeout: false
      }
    };

    // ⭐ ขั้นตอนที่ 1: หาและลบสาขาทดสอบก่อน แล้วเก็บ branch_id ไว้
    console.log('\n🔍 Step 1: Finding and deleting test branches...');
    const testPatterns = [
      '[TEST-', 'TEST-', '[test-', 'test-',
      '[HEAVY-', 'HEAVY-', '[heavy-', 'heavy-',
      '[MASSIVE-', 'MASSIVE-', '[massive-', 'massive-',
      'ทดสอบ', 'mass_', 'MASS-'
    ];

    let allBranches = [];
    let fetchRounds = 0;
    while (fetchRounds < 50) {
      const batch = await base44.entities.Branch.list('-created_date', 1000);
      if (batch.length === 0) break;
      allBranches = allBranches.concat(batch);
      fetchRounds++;
      if (batch.length < 1000) break;
    }

    const testBranches = allBranches.filter(b => {
      const fieldsToCheck = [b.branch_name, b.branch_code, b.description].filter(f => f && typeof f === 'string');
      return fieldsToCheck.some(f => testPatterns.some(p => f.includes(p)));
    });

    const testBranchIds = testBranches.map(b => b.id);
    console.log(`📋 Found ${testBranches.length} test branches:`, testBranchIds.slice(0, 3));

    // ลบสาขาทดสอบ
    for (const branch of testBranches) {
      try {
        await base44.entities.Branch.delete(branch.id);
        results.deleted.branches++;
        results.totalItemsDeleted++;
      } catch (error) {
        console.error(`❌ Failed to delete branch ${branch.id}:`, error.message);
        results.errors.push(`Branch ${branch.branch_name}: ${error.message}`);
      }
    }
    console.log(`✅ Deleted ${results.deleted.branches} test branches\n`);

    // ⭐ ขั้นตอนที่ 2: ลบข้อมูลในสาขาทดสอบ + ข้อมูลที่มี TEST tag
    console.log('🔍 Step 2: Deleting data in test branches + data with TEST tags...');

    // ลำดับการลบ: ลบ child records ก่อน parent records (เรียงตาม dependency)
    const entitiesToDelete = [
      { name: 'Payment', label: 'บิลชำระเงิน', key: 'payments', fields: ['notes'] },
      { name: 'MeterReading', label: 'มิเตอร์', key: 'meterReadings', fields: ['notes'] },
      { name: 'MaintenanceRequest', label: 'แจ้งซ่อม', key: 'maintenanceRequests', fields: ['title', 'description', 'notes'] },
      { name: 'Booking', label: 'การจอง', key: 'bookings', fields: ['notes', 'guest_name'] },
      { name: 'Tenant', label: 'ผู้เช่า', key: 'tenants', fields: ['full_name', 'notes'] },
      { name: 'Room', label: 'ห้องพัก', key: 'rooms', fields: ['room_number', 'description'] }
    ];

    for (const entity of entitiesToDelete) {
      try {
        // เช็ค timeout ก่อนเริ่ม entity ใหม่
        const elapsed = (Date.now() - startTime) / 1000;
        if (elapsed > maxTimeSeconds) {
          console.log(`⏰ Timeout reached (${elapsed}s > ${maxTimeSeconds}s), stopping before ${entity.label}`);
          results.timing.reached_timeout = true;
          break;
        }

        // เช็คว่าถึง limit รายการต่อ run หรือยัง
        if (results.totalItemsDeleted >= maxItemsPerRun) {
          console.log(`⚠️ Reached max items per run (${maxItemsPerRun}), stopping before ${entity.label}`);
          results.reachedLimit = true;
          break;
        }

        console.log(`\n🔍 Processing ${entity.label}... (Deleted so far: ${results.totalItemsDeleted}, Elapsed: ${elapsed.toFixed(1)}s)`);

        // กำหนดฟิลด์ที่ต้องเช็ค
        const checkFields = entity.fields || ['notes', 'description', 'title', 'name'];
        const targetBranchId = requestData.branch_id;
        
        if (targetBranchId) {
          console.log(`  🎯 Processing ${entity.label} for branch: ${targetBranchId}`);
        }

        // ⭐ ลบแบบ batch-by-batch (query แล้วลบทันที ไม่ fetch ทั้งหมดก่อน)
        let totalProcessed = 0;
        let batchNum = 0;
        let consecutiveEmptyBatches = 0;
        const queryBatchSize = 500; // ลดลงเพื่อ query เร็วขึ้น แต่ loop บ่อยกว่า
        
        while (true) {
          // เช็ค timeout และ limit
          const elapsedNow = (Date.now() - startTime) / 1000;
          if (elapsedNow > maxTimeSeconds) {
            console.log(`⏰ Timeout reached after batch ${batchNum}, stopping`);
            results.timing.reached_timeout = true;
            break;
          }

          if (results.totalItemsDeleted >= maxItemsPerRun) {
            console.log(`⚠️ Reached max items limit (${maxItemsPerRun}), stopping`);
            results.reachedLimit = true;
            break;
          }

          // Query batch เล็กๆ
          let currentBatch;
          try {
            if (targetBranchId) {
              currentBatch = await base44.asServiceRole.entities[entity.name].filter(
                { branch_id: targetBranchId },
                '-created_date',
                queryBatchSize
              );
            } else {
              currentBatch = await base44.asServiceRole.entities[entity.name].list('-created_date', queryBatchSize);
            }
          } catch (error) {
            console.error(`  ❌ Query failed:`, error);
            results.errors.push(`${entity.label} Query: ${error.message}`);
            break;
          }

          if (currentBatch.length === 0) {
            console.log(`  ✅ No more ${entity.label} to process`);
            break;
          }

          // กรองเฉพาะข้อมูลทดสอบ
          const testRecords = currentBatch.filter(record => {
            if (record.branch_id && testBranchIds.includes(record.branch_id)) return true;
            
            const valuesToCheck = checkFields
              .map(field => record[field])
              .filter(value => value && typeof value === 'string');

            return valuesToCheck.some(value => 
              testPatterns.some(pattern => value.includes(pattern))
            );
          });

          if (testRecords.length === 0) {
            consecutiveEmptyBatches++;
            if (consecutiveEmptyBatches >= 3) {
              console.log(`  ℹ️ No test records in ${consecutiveEmptyBatches} consecutive batches, stopping scan for ${entity.label}`);
              break;
            }
            // ยังมีโอกาสเจอ test data ในรอบถัดไป (กรณีกระจาย)
            continue;
          }
          
          consecutiveEmptyBatches = 0; // รีเซ็ตเมื่อเจอ test records

          // ลบทันที (แบบ parallel chunks เพื่อเร็วขึ้น)
          const batchStartTime = Date.now();
          let successCount = 0;

          try {
            // แบ่งลบเป็น chunks ย่อยๆ เพื่อป้องกัน rate limit
            const chunkSize = 50;
            for (let i = 0; i < testRecords.length; i += chunkSize) {
              const chunk = testRecords.slice(i, i + chunkSize);
              const deleteResults = await Promise.allSettled(
                chunk.map(record => base44.asServiceRole.entities[entity.name].delete(record.id))
              );
              successCount += deleteResults.filter(r => r.status === 'fulfilled').length;
              const failedCount = deleteResults.filter(r => r.status === 'rejected').length;

              if (failedCount > 0) {
                console.warn(`  ⚠️ ${failedCount}/${chunk.length} items failed in chunk`);
              }
            }
          } catch (error) {
            console.error(`  ❌ Delete batch ${batchNum + 1} failed:`, error);
            results.errors.push(`${entity.label} Batch ${batchNum + 1}: ${error.message}`);
          }

          results.deleted[entity.key] += successCount;
          results.totalItemsDeleted += successCount;
          totalProcessed += currentBatch.length;
          batchNum++;

          const batchElapsed = Date.now() - batchStartTime;
          
          if (batchNum % 3 === 0 || successCount > 0) {
            console.log(`  ✅ Batch ${batchNum}: Deleted ${successCount}/${testRecords.length} test records in ${(batchElapsed/1000).toFixed(1)}s (Total: ${results.deleted[entity.key]})`);
          }

          // ไม่ต้อง delay เพราะแบ่ง chunk แล้ว

          // ถ้า batch นี้มีข้อมูลน้อยกว่า query size = หมดแล้ว
          if (currentBatch.length < queryBatchSize) {
            console.log(`  ✅ Reached end of ${entity.label} data`);
            break;
          }
        }

        console.log(`  🎉 Completed ${entity.label}: ${results.deleted[entity.key]} deleted (${batchNum} batches, Overall: ${results.totalItemsDeleted})`);

        } catch (error) {
        console.error(`❌ Failed to process ${entity.label}:`, error);
        results.errors.push(`${entity.label}: ${error.message}`);
        // อย่า break - ให้ลอง entity ถัดไปต่อ
        }
        }

        console.log(`\n🛑 Deletion loop finished. Reason: ${results.timing.reached_timeout ? 'Timeout' : results.reachedLimit ? 'Item limit' : 'Completed all entities'}`);

    // สาขาถูกลบไปแล้วใน loop ด้านบน (เพิ่ม Branch ใน entitiesToDelete)
    console.log(`\n✅ All entities processed`);

    const totalElapsed = Date.now() - startTime;
    const elapsedSeconds = totalElapsed / 1000;
    results.timing = {
      total_seconds: elapsedSeconds.toFixed(2),
      total_minutes: (totalElapsed / 60000).toFixed(2),
      reached_timeout: elapsedSeconds > maxTimeSeconds
    };

    const totalDeleted = Object.values(results.deleted).reduce((sum, count) => sum + count, 0);

    console.log(`\n🎉 DELETION COMPLETED!`);
    console.log(`   Total time: ${results.timing.total_minutes} minutes`);
    console.log(`   Total deleted: ${totalDeleted} items`);
    console.log(`   Details:`, results.deleted);

    // ถ้าลบได้ 0 รายการ - ยังถือว่าสำเร็จ (แค่ไม่มีข้อมูลทดสอบ)
    if (totalDeleted === 0) {
      return Response.json({
        success: true,
        message: `✅ ไม่พบข้อมูลทดสอบในระบบ\n\nไม่มีข้อมูลที่ต้องลบ`,
        results,
        totalDeleted: 0,
        reachedTimeout: results.timing.reached_timeout,
        performance: {
          total_time_minutes: results.timing.total_minutes,
          total_time_seconds: results.timing.total_seconds,
          items_per_second: '0'
        }
      });
    }

    // บันทึก Activity Log
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        branch_id: requestData.branch_id || null,
        action_type: 'delete',
        entity_type: 'TestData',
        entity_id: `test-cleanup-${Date.now()}`,
        entity_name: 'ลบข้อมูลทดสอบ',
        user_email: user.email,
        user_name: user.full_name,
        description: `ลบข้อมูลทดสอบ: ${results.deleted.payments} บิล, ${results.deleted.bookings} การจอง, ${results.deleted.rooms} ห้อง, ${results.deleted.tenants} ผู้เช่า, ${results.deleted.branches} สาขา (รวม ${totalDeleted} รายการ)`
      });
    } catch (logError) {
      console.error('Failed to create activity log:', logError);
    }

    // เพิ่มข้อความถ้า timeout หรือถึง limit
    const needMoreRuns = results.timing.reached_timeout || results.reachedLimit;
    const timeoutWarning = needMoreRuns
      ? '\n\n⏰ ลบได้บางส่วน (ป้องกัน timeout)\n💡 **กรุณากดลบอีกครั้ง** เพื่อลบข้อมูลที่เหลือ' 
      : '';

    return Response.json({
      success: true,
      reachedTimeout: results.timing.reached_timeout,
      reachedLimit: results.reachedLimit,
      needMoreRuns: needMoreRuns,
      message: `${needMoreRuns ? '⏰ ลบข้อมูลบางส่วนเสร็จแล้ว!' : '✅ ลบข้อมูลทดสอบเสร็จสมบูรณ์!'}${timeoutWarning}\n\n` +
        `⏱️ เวลาที่ใช้: ${results.timing.total_minutes} นาที\n\n` +
        `📊 สรุปการลบ:\n` +
        `${results.deleted.branches > 0 ? `🏢 สาขา: ${results.deleted.branches} สาขา\n` : ''}` +
        `${results.deleted.rooms > 0 ? `🏠 ห้องพัก: ${results.deleted.rooms} ห้อง\n` : ''}` +
        `${results.deleted.tenants > 0 ? `👥 ผู้เช่า: ${results.deleted.tenants} คน\n` : ''}` +
        `${results.deleted.bookings > 0 ? `📋 การจอง: ${results.deleted.bookings} สัญญา\n` : ''}` +
        `${results.deleted.payments > 0 ? `💰 บิล: ${results.deleted.payments} บิล\n` : ''}` +
        `${results.deleted.meterReadings > 0 ? `📏 มิเตอร์: ${results.deleted.meterReadings} รายการ\n` : ''}` +
        `${results.deleted.maintenanceRequests > 0 ? `🔧 แจ้งซ่อม: ${results.deleted.maintenanceRequests} รายการ\n` : ''}` +
        `\n🗑️ รวมทั้งหมด: ${totalDeleted} รายการ\n` +
        (results.errors.length > 0 ? `\n⚠️ ข้อผิดพลาด: ${results.errors.length} รายการ` : ''),
      results,
      totalDeleted,
      performance: {
        total_time_minutes: results.timing.total_minutes,
        total_time_seconds: results.timing.total_seconds,
        items_per_second: (totalDeleted / (totalElapsed / 1000)).toFixed(2)
      }
    });

  } catch (error) {
    console.error('❌ DELETION FAILED:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});