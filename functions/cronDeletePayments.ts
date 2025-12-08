import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Cron job: Delete TEST data from ALL branches with continuous recursive calls
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        console.log(`🧹 [Cron] Starting TEST data deletion for ALL branches...`);

        const startTime = Date.now();
        
        // ⭐ ดึงข้อมูล TEST ทุกประเภท (ไม่กรอง branch_id)
        const batchSize = 300;
        
        console.log(`🔍 [Cron] Fetching TEST data (batch size: ${batchSize})...`);
        
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
        
        // กรองเฉพาะ TEST data
        const paymentsToDelete = (testPayments || []).filter(p => 
            p.notes?.includes('[TEST-') || p.notes?.includes('TEST-')
        ).slice(0, batchSize);
        
        const bookingsToDelete = (testBookings || []).filter(b => 
            b.notes?.includes('[TEST-') || b.notes?.includes('TEST-')
        ).slice(0, batchSize);
        
        const roomsToDelete = (testRooms || []).filter(r => 
            r.room_number?.includes('TEST-') || 
            r.description?.includes('[TEST-') ||
            r.description?.includes('TEST-')
        ).slice(0, batchSize);
        
        const tenantsToDelete = (testTenants || []).filter(t => 
            t.full_name?.includes('[TEST-') || 
            t.full_name?.includes('TEST-') ||
            t.notes?.includes('[TEST-') ||
            t.notes?.includes('TEST-')
        ).slice(0, batchSize);
        
        const meterReadingsToDelete = (testMeterReadings || []).filter(mr => 
            mr.notes?.includes('[TEST-') || mr.notes?.includes('TEST-')
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
        
        if (!payments || payments.length === 0) {
            console.log(`✅ [Cron] Deletion complete!`);
            const finalProgress = currentProgress || { deleted: 0, initial: 0 };
            
            if (progressConfigs.length > 0) {
                await base44.asServiceRole.entities.Config.update(progressConfigs[0].id, {
                    value: JSON.stringify({
                        ...finalProgress,
                        remaining: 0,
                        completed: true,
                        timestamp: Date.now()
                    })
                });
            }
            
            return Response.json({ 
                success: true, 
                message: 'Deletion complete', 
                deleted: finalProgress.deleted,
                remaining: 0 
            });
        }
        
        console.log(`🗑️ [Cron] Deleting ${payments.length} payments...`);
        
        // ลบทีละรายการ ช้าๆ
        let deletedCount = 0;
        for (const payment of payments) {
            try {
                await base44.asServiceRole.entities.Payment.delete(payment.id);
                deletedCount++;
                console.log(`✅ [${deletedCount}/${payments.length}] Deleted ${payment.id}`);
                
                // รอ 0.5 วินาทีระหว่างรายการ
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (e) {
                if (e.message?.includes('not found') || e.message?.includes('404')) {
                    deletedCount++;
                    console.log(`⚠️ [${deletedCount}/${payments.length}] ${payment.id} already deleted (404)`);
                } else {
                    console.error(`❌ Error deleting ${payment.id}:`, e.message);
                }
            }
        }
        
        // อัปเดต progress
        if (currentProgress && progressConfigs.length > 0) {
            const newDeleted = (currentProgress.deleted || 0) + deletedCount;
            const newRemaining = Math.max(0, (currentProgress.initial || 0) - newDeleted);
            
            await base44.asServiceRole.entities.Config.update(progressConfigs[0].id, {
                value: JSON.stringify({
                    deleted: newDeleted,
                    remaining: newRemaining,
                    initial: currentProgress.initial,
                    timestamp: Date.now()
                })
            });
            
            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`📊 [Cron] Progress: ${newDeleted}/${currentProgress.initial} (${newRemaining} remaining) - took ${elapsed}s`);
            
            // รอให้ครบ 2 นาที
            const targetTime = 120000; // 2 minutes
            const elapsedMs = Date.now() - startTime;
            const remainingTime = targetTime - elapsedMs;
            
            if (remainingTime > 0) {
                console.log(`⏳ [Cron] Waiting ${(remainingTime / 1000).toFixed(1)}s to reach 2 minutes...`);
                await new Promise(resolve => setTimeout(resolve, remainingTime));
            }
            
            return Response.json({ 
                success: true, 
                deleted: newDeleted,
                remaining: newRemaining,
                batchDeleted: deletedCount,
                message: `Deleted ${deletedCount} payments, ${newRemaining} remaining`
            });
        }
        
        return Response.json({ success: true, message: 'Processing...' });

    } catch (error) {
        console.error('❌ [Cron] ERROR:', error.message);
        return Response.json({ 
            success: false, 
            error: error.message
        }, { status: 500 });
    }
});