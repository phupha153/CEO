import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

// Helper function สำหรับดึงข้อมูลแบบ pagination
async function fetchAllEntities(entity, batchSize = 1000) {
    let allData = [];
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
        const batch = await entity.filter({}, '-created_date', batchSize, skip);
        if (!Array.isArray(batch) || batch.length === 0) {
            hasMore = false;
        } else {
            allData = allData.concat(batch);
            skip += batch.length;
            if (batch.length < batchSize) {
                hasMore = false;
            }
        }
        // ป้องกัน infinite loop
        if (skip > 50000) hasMore = false;
    }
    return allData;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ 
                success: false,
                error: 'Unauthorized' 
            }, { status: 401 });
        }

        const userRole = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
        if (userRole !== 'developer' && userRole !== 'owner') {
            return Response.json({ 
                success: false,
                error: 'Forbidden - Only developer or owner can delete test data' 
            }, { status: 403 });
        }

        // Parse request body สำหรับ branch_id
        let targetBranchId = null;
        try {
            const clonedReq = req.clone();
            const text = await clonedReq.text();
            if (text && text.trim()) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
            }
        } catch (e) {
            console.log('⚠️ No valid JSON body');
        }

        console.log(`🗑️ Starting test data deletion at ${new Date().toISOString()}`);
        console.log(`📋 Target branch: ${targetBranchId || 'ALL'}`);

        const results = {
            deletedPayments: 0,
            deletedBookings: 0,
            deletedRooms: 0,
            deletedTenants: 0,
            deletedMeterReadings: 0,
            updatedRooms: 0,
            errors: []
        };

        // ✅ STEP 1: หา Payments ที่เป็น TEST (ใช้ pagination)
        console.log('📥 Step 1: Fetching all payments...');
        const allPayments = await fetchAllEntities(base44.asServiceRole.entities.Payment);
        
        let testPayments = allPayments.filter(payment => 
            payment.notes?.includes('[TEST-') || payment.notes?.includes('TEST-')
        );
        
        // กรองตาม branch ถ้าระบุ
        if (targetBranchId) {
            testPayments = testPayments.filter(p => p.branch_id === targetBranchId);
        }
        
        console.log(`Found ${testPayments.length} test payments out of ${allPayments.length} total`);

        // ✅ STEP 2: ลบ Payments (ลบทีละ batch เพื่อไม่ให้ timeout)
        if (testPayments.length > 0) {
            console.log('💸 Step 2: Deleting test payments...');
            const batchSize = 100;
            for (let i = 0; i < testPayments.length; i += batchSize) {
                const batch = testPayments.slice(i, i + batchSize);
                const deletePromises = batch.map(p => 
                    base44.asServiceRole.entities.Payment.delete(p.id)
                        .then(() => {
                            results.deletedPayments++;
                            return { success: true, id: p.id };
                        })
                        .catch(error => {
                            results.errors.push(`Payment ${p.id}: ${error.message}`);
                            return { success: false, id: p.id, error: error.message };
                        })
                );
                
                await Promise.all(deletePromises);
                console.log(`  ✅ Deleted batch ${Math.floor(i/batchSize) + 1}: ${results.deletedPayments}/${testPayments.length}`);
            }
        }

        // ✅ STEP 3: หา Bookings ที่เป็น TEST (ใช้ pagination)
        console.log('📥 Step 3: Fetching all bookings...');
        const allBookings = await fetchAllEntities(base44.asServiceRole.entities.Booking);
        
        let testBookings = allBookings.filter(booking => 
            booking.notes?.includes('[TEST-') || booking.notes?.includes('TEST-')
        );
        
        // กรองตาม branch ถ้าระบุ
        if (targetBranchId) {
            testBookings = testBookings.filter(b => b.branch_id === targetBranchId);
        }
        
        console.log(`Found ${testBookings.length} test bookings`);

        // ✅ STEP 4: ลบ Bookings และอัปเดตสถานะห้อง
        if (testBookings.length > 0) {
            console.log('📋 Step 4: Deleting test bookings...');
            const batchSize = 100;
            for (let i = 0; i < testBookings.length; i += batchSize) {
                const batch = testBookings.slice(i, i + batchSize);
                
                for (const booking of batch) {
                    try {
                        // อัปเดตห้องให้เป็น available
                        if (booking.room_id) {
                            await base44.asServiceRole.entities.Room.update(booking.room_id, {
                                status: 'available'
                            });
                            results.updatedRooms++;
                        }
                        
                        // ลบ booking
                        await base44.asServiceRole.entities.Booking.delete(booking.id);
                        results.deletedBookings++;
                    } catch (error) {
                        results.errors.push(`Booking ${booking.id}: ${error.message}`);
                    }
                }
                
                console.log(`  ✅ Deleted batch ${Math.floor(i/batchSize) + 1}: ${results.deletedBookings}/${testBookings.length}`);
            }
        }

        // ✅ STEP 5: หา Rooms ที่เป็น TEST (ใช้ pagination)
        console.log('📥 Step 5: Fetching all rooms...');
        const allRooms = await fetchAllEntities(base44.asServiceRole.entities.Room);
        
        let testRooms = allRooms.filter(room => 
            room.room_number?.includes('TEST-') || 
            room.description?.includes('[TEST-') ||
            room.description?.includes('TEST-')
        );
        
        // กรองตาม branch ถ้าระบุ
        if (targetBranchId) {
            testRooms = testRooms.filter(r => r.branch_id === targetBranchId);
        }
        
        console.log(`Found ${testRooms.length} test rooms`);

        // ✅ STEP 6: ลบ Rooms
        if (testRooms.length > 0) {
            console.log('🏠 Step 6: Deleting test rooms...');
            const batchSize = 100;
            for (let i = 0; i < testRooms.length; i += batchSize) {
                const batch = testRooms.slice(i, i + batchSize);
                const deletePromises = batch.map(r => 
                    base44.asServiceRole.entities.Room.delete(r.id)
                        .then(() => {
                            results.deletedRooms++;
                            return { success: true, id: r.id };
                        })
                        .catch(error => {
                            results.errors.push(`Room ${r.room_number}: ${error.message}`);
                            return { success: false, id: r.id, error: error.message };
                        })
                );
                
                await Promise.all(deletePromises);
                console.log(`  ✅ Deleted batch ${Math.floor(i/batchSize) + 1}: ${results.deletedRooms}/${testRooms.length}`);
            }
        }

        // ✅ STEP 7: หา Tenants ที่เป็น TEST (ใช้ pagination)
        console.log('📥 Step 7: Fetching all tenants...');
        const allTenants = await fetchAllEntities(base44.asServiceRole.entities.Tenant);
        
        let testTenants = allTenants.filter(tenant => 
            tenant.full_name?.includes('[TEST-') || 
            tenant.full_name?.includes('TEST-') ||
            tenant.notes?.includes('[TEST-') ||
            tenant.notes?.includes('TEST-')
        );
        
        // กรองตาม branch ถ้าระบุ
        if (targetBranchId) {
            testTenants = testTenants.filter(t => t.branch_id === targetBranchId);
        }
        
        console.log(`Found ${testTenants.length} test tenants`);

        // ✅ STEP 8: ลบ Tenants
        if (testTenants.length > 0) {
            console.log('👥 Step 8: Deleting test tenants...');
            const batchSize = 100;
            for (let i = 0; i < testTenants.length; i += batchSize) {
                const batch = testTenants.slice(i, i + batchSize);
                const deletePromises = batch.map(t => 
                    base44.asServiceRole.entities.Tenant.delete(t.id)
                        .then(() => {
                            results.deletedTenants++;
                            return { success: true, id: t.id };
                        })
                        .catch(error => {
                            results.errors.push(`Tenant ${t.full_name}: ${error.message}`);
                            return { success: false, id: t.id, error: error.message };
                        })
                );
                
                await Promise.all(deletePromises);
                console.log(`  ✅ Deleted batch ${Math.floor(i/batchSize) + 1}: ${results.deletedTenants}/${testTenants.length}`);
            }
        }

        // ✅ STEP 9: หา MeterReadings ที่เกี่ยวข้องกับห้อง TEST (ใช้ pagination)
        console.log('📥 Step 9: Fetching all meter readings...');
        const allMeterReadings = await fetchAllEntities(base44.asServiceRole.entities.MeterReading);
        
        // หา room IDs ที่เป็น TEST
        const testRoomIds = new Set(testRooms.map(r => r.id));
        
        let testMeterReadings = allMeterReadings.filter(mr => 
            testRoomIds.has(mr.room_id) ||
            mr.notes?.includes('[TEST-') ||
            mr.notes?.includes('TEST-')
        );
        
        // กรองตาม branch ถ้าระบุ
        if (targetBranchId) {
            testMeterReadings = testMeterReadings.filter(mr => mr.branch_id === targetBranchId);
        }
        
        console.log(`Found ${testMeterReadings.length} test meter readings`);

        // ✅ STEP 10: ลบ MeterReadings
        if (testMeterReadings.length > 0) {
            console.log('⚡ Step 10: Deleting test meter readings...');
            const batchSize = 100;
            for (let i = 0; i < testMeterReadings.length; i += batchSize) {
                const batch = testMeterReadings.slice(i, i + batchSize);
                const deletePromises = batch.map(mr => 
                    base44.asServiceRole.entities.MeterReading.delete(mr.id)
                        .then(() => {
                            results.deletedMeterReadings++;
                            return { success: true, id: mr.id };
                        })
                        .catch(error => {
                            results.errors.push(`MeterReading ${mr.id}: ${error.message}`);
                            return { success: false, id: mr.id, error: error.message };
                        })
                );
                
                await Promise.all(deletePromises);
                console.log(`  ✅ Deleted batch ${Math.floor(i/batchSize) + 1}: ${results.deletedMeterReadings}/${testMeterReadings.length}`);
            }
        }

        // ✅ สรุปผลลัพธ์
        console.log('🎯 Test data deletion completed:', results);

        const totalDeleted = results.deletedPayments + results.deletedBookings + results.deletedRooms + results.deletedTenants + results.deletedMeterReadings;

        if (totalDeleted === 0) {
            return Response.json({
                success: true,
                message: '✅ ไม่พบข้อมูลทดสอบที่ต้องลบ - ระบบสะอาดแล้ว',
                results
            });
        }

        let message = `✅ ลบข้อมูลทดสอบสำเร็จ!\n\n`;
        message += `💸 การชำระเงิน: ${results.deletedPayments} รายการ\n`;
        message += `📋 การจอง: ${results.deletedBookings} รายการ\n`;
        message += `🏠 ห้องพัก: ${results.deletedRooms} ห้อง\n`;
        message += `👥 ผู้เช่า: ${results.deletedTenants} คน\n`;
        message += `⚡ มิเตอร์: ${results.deletedMeterReadings} รายการ\n`;
        message += `🔄 ห้องที่อัปเดตสถานะ: ${results.updatedRooms} ห้อง`;
        
        if (results.errors.length > 0) {
            message += `\n\n⚠️ มีข้อผิดพลาดบางส่วน: ${results.errors.length} รายการ`;
            console.error('Errors:', results.errors);
        }

        return Response.json({
            success: true,
            message: message,
            results
        });

    } catch (error) {
        console.error('❌ Error in deleteTestData:', error);
        return Response.json({ 
            success: false,
            error: error.message,
            details: error.stack 
        }, { status: 500 });
    }
});