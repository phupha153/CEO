import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Cron job: Delete TEST data from ALL branches with continuous recursive calls
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        console.log(`🧹 [Cron] Starting TEST data deletion for ALL branches...`);

        const startTime = Date.now();
        
        // ⭐ ดึงข้อมูล TEST ทุกประเภท (ไม่กรอง branch_id)
        const batchSize = 1000;
        
        console.log(`🔍 [Cron] Fetching TEST data (batch size: ${batchSize})...`);
        
        // ดึงรายการสาขาที่ต้องการลบจาก Config
        let selectedBranchIds = [];
        try {
            const configs = await base44.asServiceRole.entities.Config.filter({ key: 'cron_delete_selected_branches' });
            if (configs.length > 0 && configs[0].value) {
                selectedBranchIds = JSON.parse(configs[0].value);
                console.log(`📋 [Cron] Using selected branches from config: ${selectedBranchIds.length} branches`);
            }
        } catch (e) {
            console.warn(`⚠️ [Cron] Could not load selected branches:`, e.message);
        }
        
        // ถ้าไม่มีรายการที่เลือก ให้ใช้วิธีเดิม (เช็คจาก branch_code)
        let testBranchIds = selectedBranchIds;
        if (testBranchIds.length === 0) {
            const allBranches = await base44.asServiceRole.entities.Branch.list();
            testBranchIds = (allBranches || [])
                .filter(b => 
                    b.branch_code?.includes('TEST') || 
                    b.branch_code?.includes('12345') ||
                    b.branch_code?.includes('5555') ||
                    b.branch_code?.includes('COPY') ||
                    b.branch_name?.includes('12345') ||
                    b.branch_name?.includes('[TEST') ||
                    b.notes?.includes('[TEST') ||
                    b.description?.includes('[TEST')
                )
                .map(b => b.id);
            console.log(`🏢 [Cron] Auto-detected ${testBranchIds.length} TEST branches`);
        }
        
        console.log(`🎯 [Cron] Target branches: ${JSON.stringify(testBranchIds)}`);
        
        // ดึงข้อมูลทดสอบจากทุกสาขา
        const [
            testPayments,
            testBookings,
            testRooms,
            testTenants,
            testMeterReadings
        ] = await Promise.all([
            base44.asServiceRole.entities.Payment.list('-created_date', batchSize * 3),
            base44.asServiceRole.entities.Booking.list('-created_date', batchSize * 2),
            base44.asServiceRole.entities.Room.list('-created_date', batchSize * 2),
            base44.asServiceRole.entities.Tenant.list('-created_date', batchSize * 2),
            base44.asServiceRole.entities.MeterReading.list('-created_date', batchSize * 2)
        ]);
        
        // กรองเฉพาะ TEST data (ใช้ is_sample, notes, หรือ branch_id ของสาขาทดสอบ)
        const paymentsToDelete = (testPayments || []).filter(p => 
            p.is_sample === true ||
            testBranchIds.includes(p.branch_id) ||
            p.notes?.includes('[TEST-') || 
            p.notes?.includes('TEST-') ||
            p.created_by?.includes('test-') ||
            p.created_by?.includes('TEST-')
        ).slice(0, batchSize);
        
        const bookingsToDelete = (testBookings || []).filter(b => 
            b.is_sample === true ||
            testBranchIds.includes(b.branch_id) ||
            b.notes?.includes('[TEST-') || 
            b.notes?.includes('TEST-') ||
            b.created_by?.includes('test-') ||
            b.created_by?.includes('TEST-')
        ).slice(0, batchSize);
        
        const roomsToDelete = (testRooms || []).filter(r => 
            r.is_sample === true ||
            testBranchIds.includes(r.branch_id) ||
            r.room_number?.includes('TEST-') || 
            r.description?.includes('[TEST-') ||
            r.description?.includes('TEST-') ||
            r.created_by?.includes('test-') ||
            r.created_by?.includes('TEST-')
        ).slice(0, batchSize);
        
        const tenantsToDelete = (testTenants || []).filter(t => 
            t.is_sample === true ||
            testBranchIds.includes(t.branch_id) ||
            t.full_name?.includes('[TEST-') || 
            t.full_name?.includes('TEST-') ||
            t.notes?.includes('[TEST-') ||
            t.notes?.includes('TEST-') ||
            t.created_by?.includes('test-') ||
            t.created_by?.includes('TEST-')
        ).slice(0, batchSize);
        
        const meterReadingsToDelete = (testMeterReadings || []).filter(mr => 
            mr.is_sample === true ||
            testBranchIds.includes(mr.branch_id) ||
            mr.notes?.includes('[TEST-') || 
            mr.notes?.includes('TEST-') ||
            mr.created_by?.includes('test-') ||
            mr.created_by?.includes('TEST-')
        ).slice(0, batchSize);
        
        const totalToDelete = paymentsToDelete.length + bookingsToDelete.length + 
                             roomsToDelete.length + tenantsToDelete.length + 
                             meterReadingsToDelete.length;
        
        console.log(`📊 [Cron] Found TEST data: ${paymentsToDelete.length} payments, ${bookingsToDelete.length} bookings, ${roomsToDelete.length} rooms, ${tenantsToDelete.length} tenants, ${meterReadingsToDelete.length} meter readings`);
        
        if (totalToDelete === 0) {
            console.log(`✅ [Cron] No TEST data to delete - system clean!`);
            return Response.json({ 
                success: true, 
                message: 'No TEST data found - system clean',
                remaining: 0 
            });
        }
        
        const payments = paymentsToDelete;
        
        // ลบข้อมูลทดสอบทีละประเภท
        console.log(`🗑️ [Cron] Starting deletion of ${totalToDelete} TEST items...`);
        
        let totalDeleted = 0;
        
        // 1. ลบ Payments แบบ chunked parallel (ป้องกัน rate limit)
        if (paymentsToDelete.length > 0) {
            console.log(`💸 [Cron] Deleting ${paymentsToDelete.length} TEST payments...`);
            const chunkSize = 25;
            for (let i = 0; i < paymentsToDelete.length; i += chunkSize) {
                const chunk = paymentsToDelete.slice(i, i + chunkSize);
                const deleteResults = await Promise.allSettled(
                    chunk.map(payment => base44.asServiceRole.entities.Payment.delete(payment.id))
                );
                const successCount = deleteResults.filter(r => r.status === 'fulfilled').length;
                totalDeleted += successCount;
                console.log(`✅ [${totalDeleted}/${totalToDelete}] Deleted ${successCount}/${chunk.length} payments`);
                if (i + chunkSize < paymentsToDelete.length) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }
        }
        
        // 2. ลบ Bookings แบบ chunked parallel
        if (bookingsToDelete.length > 0) {
            console.log(`📋 [Cron] Deleting ${bookingsToDelete.length} TEST bookings...`);
            const chunkSize = 25;
            for (let i = 0; i < bookingsToDelete.length; i += chunkSize) {
                const chunk = bookingsToDelete.slice(i, i + chunkSize);
                const deleteResults = await Promise.allSettled(
                    chunk.map(async (booking) => {
                        if (booking.room_id) {
                            await base44.asServiceRole.entities.Room.update(booking.room_id, {
                                status: 'available'
                            }).catch(() => {});
                        }
                        return base44.asServiceRole.entities.Booking.delete(booking.id);
                    })
                );
                const successCount = deleteResults.filter(r => r.status === 'fulfilled').length;
                totalDeleted += successCount;
                console.log(`✅ [${totalDeleted}/${totalToDelete}] Deleted ${successCount}/${chunk.length} bookings`);
                if (i + chunkSize < bookingsToDelete.length) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }
        }
        
        // 3. ลบ Rooms แบบ chunked parallel
        if (roomsToDelete.length > 0) {
            console.log(`🏠 [Cron] Deleting ${roomsToDelete.length} TEST rooms...`);
            const chunkSize = 25;
            for (let i = 0; i < roomsToDelete.length; i += chunkSize) {
                const chunk = roomsToDelete.slice(i, i + chunkSize);
                const deleteResults = await Promise.allSettled(
                    chunk.map(room => base44.asServiceRole.entities.Room.delete(room.id))
                );
                const successCount = deleteResults.filter(r => r.status === 'fulfilled').length;
                totalDeleted += successCount;
                console.log(`✅ [${totalDeleted}/${totalToDelete}] Deleted ${successCount}/${chunk.length} rooms`);
                if (i + chunkSize < roomsToDelete.length) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }
        }
        
        // 4. ลบ Tenants แบบ chunked parallel
        if (tenantsToDelete.length > 0) {
            console.log(`👥 [Cron] Deleting ${tenantsToDelete.length} TEST tenants...`);
            const chunkSize = 25;
            for (let i = 0; i < tenantsToDelete.length; i += chunkSize) {
                const chunk = tenantsToDelete.slice(i, i + chunkSize);
                const deleteResults = await Promise.allSettled(
                    chunk.map(tenant => base44.asServiceRole.entities.Tenant.delete(tenant.id))
                );
                const successCount = deleteResults.filter(r => r.status === 'fulfilled').length;
                totalDeleted += successCount;
                console.log(`✅ [${totalDeleted}/${totalToDelete}] Deleted ${successCount}/${chunk.length} tenants`);
                if (i + chunkSize < tenantsToDelete.length) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }
        }
        
        // 5. ลบ MeterReadings แบบ chunked parallel
        if (meterReadingsToDelete.length > 0) {
            console.log(`⚡ [Cron] Deleting ${meterReadingsToDelete.length} TEST meter readings...`);
            const chunkSize = 25;
            for (let i = 0; i < meterReadingsToDelete.length; i += chunkSize) {
                const chunk = meterReadingsToDelete.slice(i, i + chunkSize);
                const deleteResults = await Promise.allSettled(
                    chunk.map(mr => base44.asServiceRole.entities.MeterReading.delete(mr.id))
                );
                const successCount = deleteResults.filter(r => r.status === 'fulfilled').length;
                totalDeleted += successCount;
                console.log(`✅ [${totalDeleted}/${totalToDelete}] Deleted ${successCount}/${chunk.length} meter readings`);
                if (i + chunkSize < meterReadingsToDelete.length) {
                    await new Promise(resolve => setTimeout(resolve, 800));
                }
            }
        }
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ [Cron] Deleted ${totalDeleted} items in ${elapsed}s`);
        
        // ⭐ ถ้ายังมีข้อมูลทดสอบเหลืออยู่ (ลบได้เต็ม batch) → เรียกตัวเองใหม่
        if (totalDeleted >= batchSize) {
            console.log(`🔄 [Cron] More TEST data exists - calling self again...`);
            
            // เรียก function ตัวเองอีกครั้งแบบ async (ไม่รอผลลัพธ์)
            base44.asServiceRole.functions.invoke('cronDeletePayments', {})
                .then(() => console.log(`✅ [Cron] Recursive call triggered`))
                .catch(err => console.warn(`⚠️ [Cron] Recursive call failed:`, err.message));
            
            return Response.json({ 
                success: true, 
                deleted: totalDeleted,
                message: `Deleted ${totalDeleted} items, more data exists - recursive call triggered`,
                recursive: true
            });
        }
        
        // เสร็จสิ้น - ไม่มีข้อมูลทดสอบเหลือแล้ว
        console.log(`🎉 [Cron] All TEST data deleted!`);
        
        return Response.json({ 
            success: true, 
            deleted: totalDeleted,
            message: `Deletion complete - deleted ${totalDeleted} items`,
            recursive: false
        });

    } catch (error) {
        console.error('❌ [Cron] ERROR:', error.message);
        console.error('Stack:', error.stack);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});