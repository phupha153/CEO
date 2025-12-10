import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * สร้างข้อมูลทดสอบที่เชื่อมกันจริง 100%
 * - Room, Tenant, Booking, MeterReading ทุกอย่างเชื่อมกันถูกต้อง
 * - พร้อมสร้าง Payment ด้วย generateMonthlyBills
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // ต้อง authenticate ก่อน
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { text } = await req.clone().text().then(t => ({ text: t })).catch(() => ({ text: '' }));
        const body = text ? JSON.parse(text) : {};
        
        const branchId = body.branch_id;
        if (!branchId) {
            return Response.json({ error: 'branch_id is required' }, { status: 400 });
        }

        console.log(`🎯 Starting connected test data generation for branch: ${branchId}`);

        // 1. ลบข้อมูลเก่าทั้งหมดของสาขานี้
        console.log('🗑️ Deleting old data...');
        
        const [oldPayments, oldBookings, oldMeterReadings, oldTenants, oldRooms] = await Promise.all([
            base44.asServiceRole.entities.Payment.filter({ branch_id: branchId }),
            base44.asServiceRole.entities.Booking.filter({ branch_id: branchId }),
            base44.asServiceRole.entities.MeterReading.filter({ branch_id: branchId }),
            base44.asServiceRole.entities.Tenant.filter({ branch_id: branchId }),
            base44.asServiceRole.entities.Room.filter({ branch_id: branchId })
        ]);

        // ลบทีละประเภท (เพื่อไม่ให้มี foreign key issues)
        if (oldPayments.length > 0) {
            for (const p of oldPayments) {
                await base44.asServiceRole.entities.Payment.delete(p.id);
            }
        }
        
        if (oldBookings.length > 0) {
            for (const b of oldBookings) {
                await base44.asServiceRole.entities.Booking.delete(b.id);
            }
        }
        
        if (oldMeterReadings.length > 0) {
            for (const m of oldMeterReadings) {
                await base44.asServiceRole.entities.MeterReading.delete(m.id);
            }
        }
        
        if (oldTenants.length > 0) {
            for (const t of oldTenants) {
                await base44.asServiceRole.entities.Tenant.delete(t.id);
            }
        }
        
        if (oldRooms.length > 0) {
            for (const r of oldRooms) {
                await base44.asServiceRole.entities.Room.delete(r.id);
            }
        }

        console.log(`✅ Deleted old data: ${oldPayments.length} payments, ${oldBookings.length} bookings, ${oldMeterReadings.length} meter readings, ${oldTenants.length} tenants, ${oldRooms.length} rooms`);

        // 2. สร้าง Room 10 ห้อง
        console.log('🏠 Creating 10 rooms...');
        const roomsData = [];
        for (let i = 1; i <= 10; i++) {
            roomsData.push({
                branch_id: branchId,
                room_number: `10${i}`,
                floor: 1,
                room_type: 'monthly',
                price: 3500 + (i * 500),
                water_rate: 25,
                electricity_rate: 8,
                common_fee: 300,
                status: 'occupied',
                description: `ห้องทดสอบ ${i}`
            });
        }

        const createdRooms = await base44.asServiceRole.entities.Room.bulkCreate(roomsData);
        console.log(`✅ Created ${createdRooms.length} rooms`);

        // 3. สร้าง Tenant 10 คน
        console.log('👥 Creating 10 tenants...');
        const tenantNames = [
            'สมชาย ใจดี',
            'สมหญิง รักสงบ',
            'วิชัย มั่งคั่ง',
            'อรพิน สวยงาม',
            'ประยุทธ์ เข้มแข็ง',
            'มานี จริงใจ',
            'ชัยวัฒน์ สุขสม',
            'นภา แสงสว่าง',
            'ธนา เจริญรุ่ง',
            'วรรณา มีชัย'
        ];

        const tenantsData = tenantNames.map((name, i) => ({
            branch_id: branchId,
            full_name: name,
            phone: `081234500${i + 1}`,
            line_user_id: `U00${i + 1}test`,
            status: 'active'
        }));

        const createdTenants = await base44.asServiceRole.entities.Tenant.bulkCreate(tenantsData);
        console.log(`✅ Created ${createdTenants.length} tenants`);

        // 4. สร้าง Booking 10 รายการ (เชื่อม Room + Tenant)
        console.log('📅 Creating 10 bookings...');
        const bookingsData = createdRooms.map((room, i) => ({
            branch_id: branchId,
            room_id: room.id,
            tenant_id: createdTenants[i].id,
            check_in_date: '2025-01-01',
            booking_type: 'monthly',
            status: 'active'
        }));

        const createdBookings = await base44.asServiceRole.entities.Booking.bulkCreate(bookingsData);
        console.log(`✅ Created ${createdBookings.length} bookings`);

        // 5. สร้าง MeterReading สำหรับแต่ละห้อง
        console.log('⚡ Creating meter readings...');
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        
        const meterReadingsData = createdRooms.map((room, i) => ({
            branch_id: branchId,
            room_id: room.id,
            reading_date: lastMonth.toISOString().split('T')[0],
            water_previous: 100 + (i * 10),
            water_current: 150 + (i * 15),
            electricity_previous: 1000 + (i * 100),
            electricity_current: 1200 + (i * 120),
            water_units: 50 + (i * 5),
            electricity_units: 200 + (i * 20)
        }));

        const createdMeterReadings = await base44.asServiceRole.entities.MeterReading.bulkCreate(meterReadingsData);
        console.log(`✅ Created ${createdMeterReadings.length} meter readings`);

        return Response.json({
            success: true,
            message: 'สร้างข้อมูลทดสอบที่เชื่อมกันเรียบร้อย',
            data: {
                rooms: createdRooms.length,
                tenants: createdTenants.length,
                bookings: createdBookings.length,
                meterReadings: createdMeterReadings.length
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});