import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    const startTime = Date.now();
    
    try {
        const { paymentId } = await req.json();

        if (!paymentId) {
            console.error('❌ Payment ID is required');
            return Response.json({ 
                success: false, 
                error: 'Payment ID is required' 
            }, { status: 400 });
        }

        console.log(`📥 Processing invoice request for payment: ${paymentId}`);

        const base44 = createClientFromRequest(req);

        // ✅ ดึงข้อมูล Payment
        let payment;
        try {
            const paymentsPromise = base44.asServiceRole.entities.Payment.filter({ id: paymentId });
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Payment fetch timeout')), 10000)
            );
            
            let payments = await Promise.race([paymentsPromise, timeoutPromise]);
            
            // ป้องกัน .find is not a function error
            if (!Array.isArray(payments)) {
                payments = [payments];
            }
            
            payment = payments.length > 0 ? payments[0] : null;
            
            if (!payment) {
                console.error(`❌ Payment not found: ${paymentId}`);
                return Response.json({ 
                    success: false, 
                    error: 'ไม่พบข้อมูลบิล' 
                }, { status: 404 });
            }

            console.log(`✅ Payment found: ${paymentId}, status: ${payment.status}`);
        } catch (error) {
            console.error('❌ Error fetching payment:', error.message);
            return Response.json({ 
                success: false, 
                error: `ไม่สามารถดึงข้อมูลบิลได้: ${error.message}` 
            }, { status: 500 });
        }

        // ✅ ดึงข้อมูล Tenant, Room โดยตรงจาก ID
        let tenant, room, configs;
        try {
            console.log(`🔍 Fetching data for tenant_id: ${payment.tenant_id}, room_id: ${payment.room_id}`);
            
            // ⭐⭐⭐ ใช้ทั้ง filter และ list เป็น fallback เพื่อความมั่นใจ
            let tenantData = [];
            let roomData = [];
            
            // ลอง filter ก่อน
            if (payment.tenant_id) {
                try {
                    const filterResult = await base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id });
                    tenantData = Array.isArray(filterResult) ? filterResult : (filterResult ? [filterResult] : []);
                    console.log(`📋 Tenant filter result: ${tenantData.length} records`);
                } catch (filterErr) {
                    console.warn(`⚠️ Tenant filter failed: ${filterErr.message}`);
                }
            }
            
            // ถ้า filter ไม่ได้ ลอง list แล้ว find
            if (tenantData.length === 0 && payment.tenant_id) {
                console.log(`🔄 Fallback to list for tenant...`);
                const allTenants = await base44.asServiceRole.entities.Tenant.list('-created_date', 2000);
                const arr = Array.isArray(allTenants) ? allTenants : [];
                const found = arr.find(t => t.id === payment.tenant_id);
                if (found) {
                    tenantData = [found];
                    console.log(`✅ Found tenant via list: ${found.full_name}`);
                } else {
                    console.error(`❌ Tenant ${payment.tenant_id} not found in ${arr.length} tenants`);
                }
            }
            
            // ลอง filter room ก่อน
            if (payment.room_id) {
                try {
                    const filterResult = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
                    roomData = Array.isArray(filterResult) ? filterResult : (filterResult ? [filterResult] : []);
                    console.log(`📋 Room filter result: ${roomData.length} records`);
                } catch (filterErr) {
                    console.warn(`⚠️ Room filter failed: ${filterErr.message}`);
                }
            }
            
            // ถ้า filter ไม่ได้ ลอง list แล้ว find
            if (roomData.length === 0 && payment.room_id) {
                console.log(`🔄 Fallback to list for room...`);
                const allRooms = await base44.asServiceRole.entities.Room.list('-room_number', 1000);
                const arr = Array.isArray(allRooms) ? allRooms : [];
                const found = arr.find(r => r.id === payment.room_id);
                if (found) {
                    roomData = [found];
                    console.log(`✅ Found room via list: ${found.room_number}`);
                } else {
                    console.error(`❌ Room ${payment.room_id} not found in ${arr.length} rooms`);
                }
            }
            
            // ดึง configs
            const configsData = await base44.asServiceRole.entities.Config.list();

            // ดึงข้อมูลจาก result
            tenant = tenantData.length > 0 ? tenantData[0] : null;
            room = roomData.length > 0 ? roomData[0] : null;
            configs = Array.isArray(configsData) ? configsData : [];

            console.log(`✅ Final result - Tenant: ${!!tenant} (${tenant?.full_name || 'null'}), Room: ${!!room} (${room?.room_number || 'null'}), Configs: ${configs.length}`);

        } catch (error) {
            console.error('❌ Error fetching related data:', error.message);
            return Response.json({ 
                success: false, 
                error: `ไม่สามารถดึงข้อมูลเพิ่มเติมได้: ${error.message}` 
            }, { status: 500 });
        }

        // ✅ ดึงข้อมูล MeterReading เพื่อแสดงค่ามิเตอร์ก่อน-หลัง
        let meterReading = null;
        if (payment.meter_reading_id) {
            try {
                const meterData = await base44.asServiceRole.entities.MeterReading.filter({ id: payment.meter_reading_id });
                if (Array.isArray(meterData) && meterData.length > 0) {
                    meterReading = meterData[0];
                } else if (meterData && !Array.isArray(meterData)) {
                    meterReading = meterData;
                }
                console.log(`✅ MeterReading found: water ${meterReading?.water_previous}-${meterReading?.water_current}, elec ${meterReading?.electricity_previous}-${meterReading?.electricity_current}`);
            } catch (err) {
                console.warn(`⚠️ Could not fetch meter reading: ${err.message}`);
            }
        }

        // ✅ ใช้ fallback data ถ้าไม่พบข้อมูล (แทนการ return error)
        if (!tenant) {
            console.warn(`⚠️ Tenant not found for payment ${paymentId}, using fallback data`);
            tenant = {
                id: payment.tenant_id || 'unknown',
                full_name: 'ไม่ระบุผู้เช่า',
                phone: '',
                national_id: null,
                email: null,
                address: '-'
            };
        }

        if (!room) {
            console.warn(`⚠️ Room not found for payment ${paymentId}, using fallback data`);
            room = {
                id: payment.room_id || 'unknown',
                room_number: 'N/A',
                floor: 0
            };
        }

        // ✅ ดึงข้อมูลจาก Config
        const getConfigValue = (key, defaultValue = '') => {
            if (payment.branch_id) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === payment.branch_id);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig ? globalConfig.value : defaultValue;
        };

        const bankInfo = {
            name: getConfigValue('bank_name', 'กสิกรไทย'),
            account_number: getConfigValue('bank_account_number', '0722835522'),
            account_name: getConfigValue('bank_account_name', 'ธนานนท์ พรมพักตร์')
        };

        // ✅ สร้าง recipient object สำหรับใบเสร็จ
        // ดึงข้อมูลบริษัท (ถ้ามี)
        const companyName = getConfigValue('company_name', '');
        const companyTaxId = getConfigValue('company_tax_id', '');
        const companyRegistrationNumber = getConfigValue('company_registration_number', '');
        const companyPhone = getConfigValue('company_phone', '');
        const companyAddress = getConfigValue('company_address', '');
        
        // ข้อมูลหอพัก (ใช้เป็น fallback)
        const buildingName = getConfigValue('building_name', 'W RESIDENTS');
        const buildingAddress = getConfigValue('building_address', '');
        const buildingPhone = getConfigValue('building_phone', '');
        
        // ใช้ข้อมูลบริษัทถ้ามี ไม่เช่นนั้นใช้ข้อมูลหอพัก
        const issuerName = companyName || buildingName;
        const issuerAddress = companyAddress || buildingAddress;
        const issuerPhone = companyPhone || buildingPhone;
        
        const recipientInfo = {
            building_name: buildingName, // ใช้ชื่อหอพักเสมอ (W RESIDENTS)
            building_address: buildingAddress || issuerAddress,
            building_phone: buildingPhone || issuerPhone,
            building_logo: getConfigValue('building_logo', 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6904ea5ce861be65483eff6e/337bb050d_image.jpeg'),
            company_name: companyName, // ✅ เพิ่ม company_name แยกต่างหาก
            lessor_name: companyName || getConfigValue('lessor_name', ''), // ชื่อบริษัท/ผู้ให้เช่า (ถ้ามี)
            lessor_address: companyAddress || getConfigValue('lessor_address', ''),
            signature_url: getConfigValue('receipt_signature', ''),
            stamp_url: getConfigValue('receipt_stamp', ''),
            tax_id: companyTaxId,
            company_registration_number: companyRegistrationNumber
        };

        // ✅ สร้าง invoice object
        const invoice = {
            id: payment.id,
            status: payment.status,
            payment_date: payment.payment_date || payment.created_date,
            due_date: payment.due_date,
            
            tenant: {
                id: tenant.id,
                full_name: tenant.full_name || 'ไม่ระบุ',
                phone: tenant.phone || 'ไม่ระบุ',
                national_id: tenant.national_id || null,
                email: tenant.email || null,
                address: (tenant.address && tenant.address.trim() !== '') ? tenant.address : 'ไม่ระบุ'
            },
            
            room: {
                id: room.id,
                room_number: room.room_number || 'N/A',
                floor: room.floor || 0
            },
            
            rent_amount: payment.rent_amount || 0,
            water_amount: payment.water_amount || 0,
            water_units: payment.water_units || 0,
            water_rate: payment.water_rate || 0,
            water_previous: meterReading?.water_previous || 0,
            water_current: meterReading?.water_current || 0,
            electricity_amount: payment.electricity_amount || 0,
            electricity_units: payment.electricity_units || 0,
            electricity_rate: payment.electricity_rate || 0,
            electricity_previous: meterReading?.electricity_previous || 0,
            electricity_current: meterReading?.electricity_current || 0,
            internet_amount: payment.internet_amount || 0,
            common_fee_amount: payment.common_fee_amount || 0,
            parking_fee_amount: payment.parking_fee_amount || 0,
            other_amount: payment.other_amount || 0,
            total_amount: payment.total_amount || 0,
            
            bank: bankInfo,
            recipient: recipientInfo,
            
            payment_method: payment.payment_method || 'transfer',
            payment_slip_url: payment.payment_slip_url || null,
            invoice_image_url: payment.invoice_image_url || null,
            receipt_image_url: payment.receipt_image_url || null,
            notes: payment.notes || null
        };

        const elapsedTime = Date.now() - startTime;
        console.log(`✅ Invoice generated successfully for ${paymentId} in ${elapsedTime}ms`);

        return Response.json({ 
            success: true, 
            invoice: invoice,
            _meta: {
                processing_time_ms: elapsedTime
            }
        });

    } catch (error) {
        const elapsedTime = Date.now() - startTime;
        console.error(`❌ Unexpected error in getPublicInvoice (${elapsedTime}ms):`, error);
        
        return Response.json({ 
            success: false, 
            error: error.message || 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์',
            _meta: {
                processing_time_ms: elapsedTime,
                error_type: error.name
            }
        }, { status: 500 });
    }
});