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
        
        console.log(`🧹 [Cron] Starting TEST data deletion...`);

        const startTime = Date.now();
        const batchSize = 300;
        
        // ⭐ ดึงการตั้งค่าจาก CronDeleteConfig
        let selectedBranchIds = [];
        let deleteEntities = {
            Payment: true,
            MeterReading: true,
            Booking: false,
            Tenant: false,
            Room: false,
            MaintenanceRequest: true,
            Expense: true,
            Contract: false,
            MaterialDelivery: true
        };
        
        try {
            const configs = await base44.asServiceRole.entities.CronDeleteConfig.list('-updated_date', 1);
            if (configs.length > 0) {
                selectedBranchIds = configs[0].selected_branches || [];
                deleteEntities = configs[0].delete_entities || deleteEntities;
                console.log(`📋 [Cron] Config loaded: ${selectedBranchIds.length} branches, entities:`, deleteEntities);
            }
        } catch (e) {
            console.warn(`⚠️ [Cron] Could not load config:`, e.message);
        }
        
        // ถ้าไม่มีรายการที่เลือก ให้ใช้วิธีเดิม (auto-detect)
        let testBranchIds = selectedBranchIds;
        if (testBranchIds.length === 0) {
            const allBranches = await base44.asServiceRole.entities.Branch.list();
            testBranchIds = (allBranches || [])
                .filter(b => 
                    b.branch_code?.includes('TEST') || 
                    b.branch_code?.includes('12345') ||
                    b.branch_code?.includes('5555') ||
                    b.branch_code?.includes('COPY')
                )
                .map(b => b.id);
            console.log(`🏢 [Cron] Auto-detected ${testBranchIds.length} TEST branches`);
        }
        
        console.log(`🎯 [Cron] Target branches: ${testBranchIds.length}`);
        
        // ⭐ ดึงข้อมูลตามที่เลือกเท่านั้น
        const entitiesToFetch = [];
        if (deleteEntities.Payment) entitiesToFetch.push({ name: 'Payment', entity: base44.asServiceRole.entities.Payment, size: batchSize * 2 });
        if (deleteEntities.Booking) entitiesToFetch.push({ name: 'Booking', entity: base44.asServiceRole.entities.Booking, size: batchSize });
        if (deleteEntities.Room) entitiesToFetch.push({ name: 'Room', entity: base44.asServiceRole.entities.Room, size: batchSize });
        if (deleteEntities.Tenant) entitiesToFetch.push({ name: 'Tenant', entity: base44.asServiceRole.entities.Tenant, size: batchSize });
        if (deleteEntities.MeterReading) entitiesToFetch.push({ name: 'MeterReading', entity: base44.asServiceRole.entities.MeterReading, size: batchSize });
        if (deleteEntities.MaintenanceRequest) entitiesToFetch.push({ name: 'MaintenanceRequest', entity: base44.asServiceRole.entities.MaintenanceRequest, size: batchSize });
        if (deleteEntities.Expense) entitiesToFetch.push({ name: 'Expense', entity: base44.asServiceRole.entities.Expense, size: batchSize });
        if (deleteEntities.Contract) entitiesToFetch.push({ name: 'Contract', entity: base44.asServiceRole.entities.Contract, size: batchSize });
        if (deleteEntities.MaterialDelivery) entitiesToFetch.push({ name: 'MaterialDelivery', entity: base44.asServiceRole.entities.MaterialDelivery, size: batchSize });
        
        const fetchResults = await Promise.all(
            entitiesToFetch.map(e => e.entity.list('-created_date', e.size))
        );
        
        const testData = {};
        entitiesToFetch.forEach((e, idx) => {
            testData[e.name] = fetchResults[idx] || [];
        });
        
        // ⭐ กรองเฉพาะ TEST data ตามที่เลือก
        const filterTestData = (data, entityType) => {
            return (data || []).filter(item => 
                item.is_sample === true ||
                testBranchIds.includes(item.branch_id) ||
                item.notes?.includes('[TEST-') || 
                item.notes?.includes('TEST-') ||
                item.room_number?.includes('TEST-') ||
                item.full_name?.includes('[TEST-') ||
                item.full_name?.includes('TEST-') ||
                item.description?.includes('[TEST-') ||
                item.description?.includes('TEST-') ||
                item.title?.includes('[TEST-') ||
                item.created_by?.includes('test-') ||
                item.created_by?.includes('TEST-')
            ).slice(0, batchSize);
        };
        
        const itemsToDelete = {};
        let totalToDelete = 0;
        
        Object.keys(deleteEntities).forEach(entityName => {
            if (deleteEntities[entityName] && testData[entityName]) {
                const filtered = filterTestData(testData[entityName], entityName);
                itemsToDelete[entityName] = filtered;
                totalToDelete += filtered.length;
                console.log(`📊 [Cron] ${entityName}: ${filtered.length} items`);
            }
        });
        
        if (totalToDelete === 0) {
            console.log(`✅ [Cron] No TEST data to delete - system clean!`);
            return Response.json({ 
                success: true, 
                message: 'No TEST data found - system clean',
                remaining: 0 
            });
        }
        
        // ลบข้อมูลทดสอบทีละประเภท
        console.log(`🗑️ [Cron] Starting deletion of ${totalToDelete} TEST items...`);
        
        let totalDeleted = 0;
        const entityOrder = ['Payment', 'MeterReading', 'MaintenanceRequest', 'Expense', 'MaterialDelivery', 'Booking', 'Tenant', 'Room', 'Contract'];
        
        const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
        
        for (const entityName of entityOrder) {
            const items = itemsToDelete[entityName];
            if (!items || items.length === 0) continue;
            
            console.log(`🗑️ [Cron] Deleting ${items.length} ${entityName}...`);
            
            for (const item of items) {
                try {
                    // ถ้าเป็น Booking ให้อัปเดตห้องด้วย
                    if (entityName === 'Booking' && item.room_id) {
                        await base44.asServiceRole.entities.Room.update(item.room_id, {
                            status: 'available'
                        }).catch(() => {});
                    }
                    
                    await base44.asServiceRole.entities[entityName].delete(item.id);
                    totalDeleted++;
                    
                    // ⭐ พัก 300ms ระหว่างแต่ละการลบเพื่อป้องกัน rate limit
                    await delay(300);
                    
                    if (totalDeleted % 50 === 0) {
                        console.log(`✅ [${totalDeleted}/${totalToDelete}]`);
                    }
                } catch (e) {
                    if (e.message?.includes('not found') || e.message?.includes('404') || e.status === 404) {
                        totalDeleted++;
                    } else if (e.message?.includes('Rate limit')) {
                        console.warn(`⚠️ Rate limit - waiting 5s...`);
                        await delay(5000);
                        // ลองอีกครั้ง
                        try {
                            await base44.asServiceRole.entities[entityName].delete(item.id);
                            totalDeleted++;
                        } catch (retryError) {
                            console.error(`❌ Retry failed for ${entityName}:`, retryError.message);
                        }
                    } else {
                        console.error(`❌ Error deleting ${entityName}:`, e.message);
                    }
                }
            }
        }
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ [Cron] Deleted ${totalDeleted} items in ${elapsed}s`);
        
        // ⭐ เช็คว่ายังมีข้อมูลเหลืออีกหรือไม่
        const hasMoreData = Object.values(itemsToDelete).some(items => items && items.length === batchSize);
        
        if (hasMoreData) {
            console.log(`🔄 [Cron] More TEST data likely exists - calling self again...`);
            
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