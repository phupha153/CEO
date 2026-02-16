import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import { addMonths, format } from 'npm:date-fns@3.0.0';

Deno.serve(async (req) => {
    const startTime = Date.now();
    console.log('==================================================');
    console.log('🔄 GENERATE ROOM BASED MOCK TENANTS - FUNCTION START');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('==================================================');

    try {
        const base44 = createClientFromRequest(req);
        const { branch_id, room_ids } = await req.json();

        if (!branch_id) {
            return Response.json({ success: false, error: 'Branch ID is required' }, { status: 400 });
        }

        // Fetch rooms - ถ้ามี room_ids ให้ดึงเฉพาะห้องที่เลือก, ไม่งั้นดึงทั้งหมด
        let rooms;
        if (room_ids && room_ids.length > 0) {
            rooms = await base44.asServiceRole.entities.Room.filter({ branch_id: branch_id });
            rooms = rooms.filter(r => room_ids.includes(r.id));
        } else {
            rooms = await base44.asServiceRole.entities.Room.filter({ branch_id: branch_id });
        }
        console.log(`Found ${rooms.length} rooms in branch ${branch_id}`);

        let createdTenantsCount = 0;
        let createdBookingsCount = 0;
        let updatedRoomsCount = 0;

        for (const room of rooms) {
            try {
                // Check if the room already has an active booking
                const existingBookings = await base44.asServiceRole.entities.Booking.filter({
                    room_id: room.id,
                    branch_id: branch_id,
                    status: 'active'
                });

                if (existingBookings.length > 0) {
                    console.log(`Room ${room.room_number} already has an active booking. Skipping.`);
                    continue;
                }
                
                // If room status is not 'available', but has no active booking, set it to available first
                if (room.status !== 'available') {
                    await base44.asServiceRole.entities.Room.update(room.id, { status: 'available' });
                    console.log(`Updated room ${room.room_number} status to 'available'.`);
                }

                // Create a mock tenant (ชื่อเป็นเลขห้องเลย)
                const mockTenant = await base44.asServiceRole.entities.Tenant.create({
                    branch_id: branch_id,
                    full_name: room.room_number, // ใช้เลขห้องเป็นชื่อโดยตรง
                    phone: `000-${Math.floor(1000000 + Math.random() * 9000000)}`,
                    line_user_id: null,
                    vehicles: [],
                    status: 'active'
                });
                createdTenantsCount++;
                console.log(`Created mock tenant "${mockTenant.full_name}" (ID: ${mockTenant.id}) for room ${room.room_number}`);

                // Create a mock booking for the new tenant
                const checkInDate = new Date();
                checkInDate.setDate(1); // วันแรกของเดือนปัจจุบัน
                const checkOutDate = addMonths(checkInDate, 12); // จองไว้ 1 ปี

                const mockBooking = await base44.asServiceRole.entities.Booking.create({
                    branch_id: branch_id,
                    room_id: room.id,
                    tenant_id: mockTenant.id,
                    check_in_date: format(checkInDate, 'yyyy-MM-dd'),
                    check_out_date: format(checkOutDate, 'yyyy-MM-dd'),
                    booking_type: 'monthly',
                    status: 'active',
                    total_amount: room.price || 0,
                    deposit_amount: (room.price * 2) || 0, // มัดจำ 2 เดือน
                    notes: `สร้างโดยระบบอัตโนมัติสำหรับห้อง ${room.room_number}`
                });
                createdBookingsCount++;
                console.log(`Created mock booking (ID: ${mockBooking.id}) for tenant ${mockTenant.id} in room ${room.room_number}`);

                // Update room status to occupied
                await base44.asServiceRole.entities.Room.update(room.id, { status: 'occupied' });
                updatedRoomsCount++;
                console.log(`Updated room ${room.room_number} status to 'occupied'.`);

            } catch (roomError) {
                console.error(`Error processing room ${room.id} (${room.room_number}):`, roomError.message);
                // Continue to next room even if one fails
            }
        }

        const executionTime = Date.now() - startTime;
        const result = {
            success: true,
            message: `Mock data generation completed for branch ${branch_id}`,
            rooms_processed: rooms.length,
            tenants_created: createdTenantsCount,
            bookings_created: createdBookingsCount,
            rooms_updated_to_occupied: updatedRoomsCount,
            execution_time_ms: executionTime
        };
        console.log('✅ FUNCTION COMPLETED:', result);

        // Log the function execution
        await base44.asServiceRole.entities.FunctionLog.create({
            function_name: 'generateRoomBasedMockTenants',
            run_timestamp: new Date().toISOString(),
            status: 'success',
            message: result.message,
            execution_time_ms: executionTime,
            triggered_by: 'manual',
            details: result
        });

        return Response.json(result);

    } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error('❌ CRITICAL ERROR IN generateRoomBasedMockTenants:', error);

        // Log the error
        try {
            const base44 = createClientFromRequest(req);
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'generateRoomBasedMockTenants',
                run_timestamp: new Date().toISOString(),
                status: 'error',
                message: error.message,
                execution_time_ms: executionTime,
                triggered_by: 'manual',
                details: { error: error.message, stack: error.stack }
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }

        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});