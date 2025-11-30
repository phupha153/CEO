import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';

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

        console.log(`🗑️ Starting test data deletion at ${new Date().toISOString()}`);

        const results = {
            deletedPayments: 0,
            deletedBookings: 0,
            deletedRooms: 0,
            deletedTenants: 0,
            updatedRooms: 0,
            errors: []
        };

        // ✅ STEP 1: หา Payments ที่เป็น TEST
        console.log('📥 Step 1: Fetching all payments...');
        const allPayments = await base44.asServiceRole.entities.Payment.list('-created_date', 1000);
        
        const testPayments = allPayments.filter(payment => 
            payment.notes?.includes('[TEST-')
        );
        
        console.log(`Found ${testPayments.length} test payments out of ${allPayments.length} total`);

        // ✅ STEP 2: ลบ Payments (ลบทีละ batch เพื่อไม่ให้ timeout)
        if (testPayments.length > 0) {
            console.log('💸 Step 2: Deleting test payments...');
            const batchSize = 50;
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

        // ✅ STEP 3: หา Bookings ที่เป็น TEST
        console.log('📥 Step 3: Fetching all bookings...');
        const allBookings = await base44.asServiceRole.entities.Booking.list('-created_date', 1000);
        
        const testBookings = allBookings.filter(booking => 
            booking.notes?.includes('[TEST-')
        );
        
        console.log(`Found ${testBookings.length} test bookings`);

        // ✅ STEP 4: ลบ Bookings และอัปเดตสถานะห้อง
        if (testBookings.length > 0) {
            console.log('📋 Step 4: Deleting test bookings...');
            const batchSize = 50;
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

        // ✅ STEP 5: หา Rooms ที่เป็น TEST
        console.log('📥 Step 5: Fetching all rooms...');
        const allRooms = await base44.asServiceRole.entities.Room.list('-created_date', 1000);
        
        const testRooms = allRooms.filter(room => 
            room.room_number?.includes('TEST-') || 
            room.description?.includes('[TEST-')
        );
        
        console.log(`Found ${testRooms.length} test rooms`);

        // ✅ STEP 6: ลบ Rooms
        if (testRooms.length > 0) {
            console.log('🏠 Step 6: Deleting test rooms...');
            const batchSize = 50;
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

        // ✅ STEP 7: หา Tenants ที่เป็น TEST
        console.log('📥 Step 7: Fetching all tenants...');
        const allTenants = await base44.asServiceRole.entities.Tenant.list('-created_date', 1000);
        
        const testTenants = allTenants.filter(tenant => 
            tenant.full_name?.includes('[TEST-') || 
            tenant.notes?.includes('[TEST-')
        );
        
        console.log(`Found ${testTenants.length} test tenants`);

        // ✅ STEP 8: ลบ Tenants
        if (testTenants.length > 0) {
            console.log('👥 Step 8: Deleting test tenants...');
            const batchSize = 50;
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

        // ✅ สรุปผลลัพธ์
        console.log('🎯 Test data deletion completed:', results);

        const totalDeleted = results.deletedPayments + results.deletedBookings + results.deletedRooms + results.deletedTenants;

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