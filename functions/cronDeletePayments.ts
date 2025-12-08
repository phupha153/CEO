import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Cron job: Delete TEST data from ALL branches with continuous recursive calls
Deno.serve(async (req) => {
    // ⭐ สร้าง empty request สำหรับ SDK (หลีกเลี่ยง AsyncWrap error จาก Cron)
    const emptyReq = new Request('https://dummy.url', {
        method: 'POST',
        headers: req.headers
    });
    
    try {
        const base44 = createClientFromRequest(emptyReq);
        
        console.log(`🧹 [Cron] Starting TEST data deletion for ALL branches...`);

        const startTime = Date.now();
        
        // ⭐ ดึงข้อมูล TEST ทุกประเภท (ไม่กรอง branch_id)
        const batchSize = 300;
        
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
            base44.asServiceRole.entities.Payment.list('-created_date', batchSize * 2),
            base44.asServiceRole.entities.Booking.list('-created_date', batchSize),
            base44.asServiceRole.entities.Room.list('-created_date', batchSize),
            base44.asServiceRole.entities.Tenant.list('-created_date', batchSize),
            base44.asServiceRole.entities.MeterReading.list('-created_date', batchSize)
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
        
        // 1. ลบ Payments (batch size 300)
        if (paymentsToDelete.length > 0) {
            console.log(`💸 [Cron] Deleting ${paymentsToDelete.length} TEST payments...`);
            for (const payment of paymentsToDelete) {
                try {
                    await base44.asServiceRole.entities.Payment.delete(payment.id);
                    totalDeleted++;
                    if (totalDeleted % 50 === 0) {
                        console.log(`✅ [${totalDeleted}/${totalToDelete}] Deleted payment ${payment.id}`);
                    }
                } catch (e) {
                    if (!e.message?.includes('not found') && !e.message?.includes('404')) {
                        console.error(`❌ Error deleting payment:`, e.message);
                    } else {
                        totalDeleted++;
                    }
                }
            }
        }
        
        // 2. ลบ Bookings และอัปเดตห้อง
        if (bookingsToDelete.length > 0) {
            console.log(`📋 [Cron] Deleting ${bookingsToDelete.length} TEST bookings...`);
            for (const booking of bookingsToDelete) {
                try {
                    if (booking.room_id) {
                        await base44.asServiceRole.entities.Room.update(booking.room_id, {
                            status: 'available'
                        }).catch(() => {});
                    }
                    await base44.asServiceRole.entities.Booking.delete(booking.id);
                    totalDeleted++;
                } catch (e) {
                    if (!e.message?.includes('not found') && !e.message?.includes('404')) {
                        console.error(`❌ Error deleting booking:`, e.message);
                    } else {
                        totalDeleted++;
                    }
                }
            }
        }
        
        // 3. ลบ Rooms
        if (roomsToDelete.length > 0) {
            console.log(`🏠 [Cron] Deleting ${roomsToDelete.length} TEST rooms...`);
            for (const room of roomsToDelete) {
                try {
                    await base44.asServiceRole.entities.Room.delete(room.id);
                    totalDeleted++;
                } catch (e) {
                    if (!e.message?.includes('not found') && !e.message?.includes('404')) {
                        console.error(`❌ Error deleting room:`, e.message);
                    } else {
                        totalDeleted++;
                    }
                }
            }
        }
        
        // 4. ลบ Tenants
        if (tenantsToDelete.length > 0) {
            console.log(`👥 [Cron] Deleting ${tenantsToDelete.length} TEST tenants...`);
            for (const tenant of tenantsToDelete) {
                try {
                    await base44.asServiceRole.entities.Tenant.delete(tenant.id);
                    totalDeleted++;
                } catch (e) {
                    if (!e.message?.includes('not found') && !e.message?.includes('404')) {
                        console.error(`❌ Error deleting tenant:`, e.message);
                    } else {
                        totalDeleted++;
                    }
                }
            }
        }
        
        // 5. ลบ MeterReadings
        if (meterReadingsToDelete.length > 0) {
            console.log(`⚡ [Cron] Deleting ${meterReadingsToDelete.length} TEST meter readings...`);
            for (const mr of meterReadingsToDelete) {
                try {
                    await base44.asServiceRole.entities.MeterReading.delete(mr.id);
                    totalDeleted++;
                } catch (e) {
                    if (!e.message?.includes('not found') && !e.message?.includes('404')) {
                        console.error(`❌ Error deleting meter reading:`, e.message);
                    } else {
                        totalDeleted++;
                    }
                }
            }
        }
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ [Cron] Deleted ${totalDeleted} items in ${elapsed}s`);
        
        // ⭐ เช็คว่ายังมีข้อมูลเหลืออีกหรือไม่ - ถ้า entity ใดๆ ลบได้เต็ม batch หรือ fetch มาได้เต็ม batch = ยังมีเหลือ
        const hasMoreData = paymentsToDelete.length === batchSize ||
                           bookingsToDelete.length === batchSize ||
                           roomsToDelete.length === batchSize ||
                           tenantsToDelete.length === batchSize ||
                           meterReadingsToDelete.length === batchSize ||
                           testPayments.length >= batchSize * 2 || // Payment fetch เยอะกว่า เลยใช้ *2
                           testBookings.length >= batchSize ||
                           testRooms.length >= batchSize ||
                           testTenants.length >= batchSize ||
                           testMeterReadings.length >= batchSize;
        
        if (hasMoreData) {
            console.log(`🔄 [Cron] More TEST data likely exists - calling self again...`);
            console.log(`📊 Fetched counts: Payments=${testPayments.length}, Bookings=${testBookings.length}, Rooms=${testRooms.length}, Tenants=${testTenants.length}, MeterReadings=${testMeterReadings.length}`);
            
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