import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { addMonths, format } from 'npm:date-fns@3.0.0';

Deno.serve(async (req) => {
    const startTime = Date.now();
    console.log('==================================================');
    console.log('🔄 GENERATE ROOM BASED MOCK TENANTS - BATCH VERSION');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('==================================================');

    try {
        const base44 = createClientFromRequest(req);
        const { branch_id, room_ids } = await req.json();

        if (!branch_id) {
            return Response.json({ success: false, error: 'Branch ID is required' }, { status: 400 });
        }

        // Fetch rooms
        let rooms;
        if (room_ids && room_ids.length > 0) {
            rooms = await base44.asServiceRole.entities.Room.filter({ branch_id: branch_id });
            rooms = rooms.filter(r => room_ids.includes(r.id));
        } else {
            rooms = await base44.asServiceRole.entities.Room.filter({ branch_id: branch_id });
        }
        console.log(`Found ${rooms.length} rooms in branch ${branch_id}`);

        // Filter rooms that don't already have active bookings
        const roomsWithActiveBookings = await base44.asServiceRole.entities.Booking.filter({
            branch_id: branch_id,
            status: 'active'
        });
        const bookedRoomIds = new Set(roomsWithActiveBookings.map(b => b.room_id));
        const availableRooms = rooms.filter(r => !bookedRoomIds.has(r.id));
        
        console.log(`${availableRooms.length} rooms are available for tenant creation`);

        let createdTenantsCount = 0;
        let createdBookingsCount = 0;
        let updatedRoomsCount = 0;

        // Process in batches of 100
        const BATCH_SIZE = 100;
        for (let i = 0; i < availableRooms.length; i += BATCH_SIZE) {
            const batch = availableRooms.slice(i, i + BATCH_SIZE);
            console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1} with ${batch.length} rooms`);

            // Step 1: Bulk create tenants
            const tenantData = batch.map(room => ({
                branch_id: branch_id,
                full_name: room.room_number,
                phone: `000-${Math.floor(1000000 + Math.random() * 9000000)}`,
                line_user_id: null,
                vehicles: [],
                status: 'active'
            }));
            const createdTenants = await base44.asServiceRole.entities.Tenant.bulkCreate(tenantData);
            createdTenantsCount += createdTenants.length;
            console.log(`✅ Created ${createdTenants.length} tenants`);

            // Step 2: Bulk create bookings
            const checkInDate = new Date();
            checkInDate.setDate(1);
            const checkOutDate = addMonths(checkInDate, 12);

            const bookingData = batch.map((room, idx) => ({
                branch_id: branch_id,
                room_id: room.id,
                tenant_id: createdTenants[idx].id,
                check_in_date: format(checkInDate, 'yyyy-MM-dd'),
                check_out_date: format(checkOutDate, 'yyyy-MM-dd'),
                booking_type: 'monthly',
                status: 'active',
                total_amount: room.price || 0,
                deposit_amount: (room.price * 2) || 0,
                notes: `สร้างโดยระบบอัตโนมัติสำหรับห้อง ${room.room_number}`
            }));
            const createdBookings = await base44.asServiceRole.entities.Booking.bulkCreate(bookingData);
            createdBookingsCount += createdBookings.length;
            console.log(`✅ Created ${createdBookings.length} bookings`);

            // Step 3: Bulk update room status to occupied
            for (const room of batch) {
                await base44.asServiceRole.entities.Room.update(room.id, { status: 'occupied' });
                updatedRoomsCount++;
            }
            console.log(`✅ Updated ${batch.length} rooms to occupied`);
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