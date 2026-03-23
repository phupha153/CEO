import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

// Public API สำหรับดึงข้อมูลใบแจ้งหนี้ (ไม่ต้อง login)
Deno.serve(async (req) => {
    console.log('========================================');
    console.log('🎯🎯🎯 VERSION 6 - FIXED IMPORT 🎯🎯🎯');
    console.log('📄 GET PUBLIC INVOICE');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('========================================');

    try {
        const base44 = createClientFromRequest(req);
        
        // Parse request body
        let paymentId, branchId;
        
        if (req.method === 'POST') {
            const body = await req.json();
            paymentId = body.paymentId;
            branchId = body.branchId || body.branch;
        } else {
            const url = new URL(req.url);
            paymentId = url.searchParams.get('id');
            branchId = url.searchParams.get('branchId') || url.searchParams.get('branch');
        }

        console.log(`📋 Payment ID: ${paymentId}`);

        if (!paymentId) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบรหัสใบแจ้งหนี้' 
            }, { status: 400 });
        }

        // ดึงข้อมูล Payment - ใช้ filter แทน list เพื่อลดการโหลดข้อมูล
        console.log('📥 Querying Database with filter...');
        const paymentResults = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
        const paymentList = Array.isArray(paymentResults) ? paymentResults : (paymentResults?.data || []);
        console.log(`📊 Query result: ${paymentList.length} payment(s)`);
        
        const payment = paymentList && paymentList.length > 0 ? paymentList[0] : null;

        if (!payment) {
            console.error('❌ Payment not found in database');
            console.error(`   Searched for ID: ${paymentId}`);
            console.error(`   Query returned: ${JSON.stringify(paymentList)}`);
            
            // ⭐ Try fallback: list all + manual find
            console.warn('⚠️ Fallback: Attempting full list...');
            const allPaymentsFallback = await base44.asServiceRole.entities.Payment.list();
            const allArray = Array.isArray(allPaymentsFallback) ? allPaymentsFallback : [];
            console.log(`   Fallback result: ${allArray.length} payments`);
            const fallbackPayment = allArray.find(p => p.id === paymentId);
            if (fallbackPayment) {
                console.log(`   ✅ Found via fallback: ${fallbackPayment.id}`);
                // ⭐ Update payment reference
                Object.assign(payment, fallbackPayment);
            } else {
                console.error(`   Sample IDs from fallback: ${allArray.slice(0, 3).map(p => p.id).join(', ')}`);
                return Response.json({ 
                    success: false, 
                    error: 'ไม่พบใบแจ้งหนี้ในระบบ กรุณาตรวจสอบลิงก์อีกครั้ง' 
                }, { status: 404 });
            }
        }

        // ⭐ DEBUG: ดูข้อมูลจาก DB
        console.log('🔍🔍🔍 DATABASE PAYMENT DATA:');
        console.log(`   - Payment ID: ${payment.id}`);
        console.log(`   - Branch ID from DB: "${payment.branch_id}"`);
        console.log(`   - Branch ID Type: ${typeof payment.branch_id}`);
        console.log(`   - Branch ID is undefined? ${payment.branch_id === undefined}`);
        console.log(`   - Branch ID is null? ${payment.branch_id === null}`);
        console.log(`   - Branch ID is empty string? ${payment.branch_id === ''}`);

        // ตรวจสอบ branch_id ถ้ามีการส่งมา
        if (branchId && payment.branch_id !== branchId) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบใบแจ้งหนี้ในสาขานี้' 
            }, { status: 404 });
        }

        const actualBranchId = payment.branch_id;

        // ดึงข้อมูลที่เกี่ยวข้อง
        console.log(`🔍 Fetching related data for room_id: ${payment.room_id}, tenant_id: ${payment.tenant_id}, branch_id: ${actualBranchId}`);
        
        const [tenantResults, roomResults, branchResults, meterReadingResults, configs] = await Promise.all([
            payment.tenant_id ? base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id }) : Promise.resolve([]),
            payment.room_id ? base44.asServiceRole.entities.Room.filter({ id: payment.room_id }) : Promise.resolve([]),
            actualBranchId ? base44.asServiceRole.entities.Branch.filter({ id: actualBranchId }) : Promise.resolve([]),
            payment.meter_reading_id ? base44.asServiceRole.entities.MeterReading.filter({ id: payment.meter_reading_id }) : Promise.resolve([]),
            base44.asServiceRole.entities.Config.list()
        ]);

        const tenant = Array.isArray(tenantResults) ? tenantResults[0] : tenantResults;
        const room = Array.isArray(roomResults) ? roomResults[0] : roomResults;
        const branch = Array.isArray(branchResults) ? branchResults[0] : branchResults;
        const meterReading = Array.isArray(meterReadingResults) ? meterReadingResults[0] : meterReadingResults;

        console.log(`📋 Found: room=${room?.room_number}, tenant=${tenant?.full_name}, branch=${branch?.branch_name}`);
        
        // ⭐ แก้ไข: อนุญาตให้เปิดได้แม้ไม่มี tenant (tenant เป็น optional)
        if (!room || !branch) {
            console.error(`❌ Missing required data: room=${!!room}, tenant=${!!tenant}, branch=${!!branch}`);
            console.error(`   Room search result: ${JSON.stringify(roomResults)}`);
            console.error(`   Tenant search result: ${JSON.stringify(tenantResults)}`);
            console.error(`   Branch search result: ${JSON.stringify(branchResults)}`);
            return Response.json({ 
                success: false, 
                error: `ข้อมูลไม่ครบถ้วน: room=${!!room}, tenant=${!!tenant}, branch=${!!branch}` 
            }, { status: 500 });
        }
        
        // ⭐ แจ้งเตือนถ้าไม่มี tenant
        if (!tenant) {
            console.warn('⚠️ ไม่พบข้อมูลผู้เช่า แต่อนุญาตให้เปิดใบแจ้งหนี้ได้');
        }

        // ดึง config ของสาขา
        const getConfigValue = (key, allowGlobal = false) => {
            const branchConfig = configs.find(c => c.key === key && c.branch_id === actualBranchId);
            if (branchConfig && branchConfig.value) return branchConfig.value;
            if (allowGlobal) {
                const globalConfig = configs.find(c => c.key === key && !c.branch_id);
                return globalConfig?.value || null;
            }
            return null;
        };

        const configData = {
            building_name: getConfigValue('building_name', true),
            building_logo: getConfigValue('building_logo', true),
            promptpay: getConfigValue('promptpay', false), // NO GLOBAL FALLBACK for bank details
            promptpay_qr_url: getConfigValue('promptpay_qr_url', false),
            bank_name: getConfigValue('bank_name', false),
            bank_account_number: getConfigValue('bank_account_number', false),
            bank_account_name: getConfigValue('bank_account_name', false),
            contact_phone: getConfigValue('contact_phone', true)
        };

        // ⭐ ส่ง configs กลับไปด้วยเพื่อคำนวณค่าปรับที่ frontend
        const relevantConfigs = configs.filter(c => 
            c.key === 'late_payment_fee_per_day' || 
            c.key === 'late_fee_tiers_enabled' || 
            c.key === 'late_fee_tiers'
        );

        // ⭐ สร้าง invoice object
        const invoiceObject = {
            id: payment.id,
            branch_id: payment.branch_id,  // ⭐ ส่ง branch_id
            status: payment.status,
            due_date: payment.due_date,
            payment_date: payment.payment_date,
            created_date: payment.created_date,
            rent_amount: payment.rent_amount,
            water_amount: payment.water_amount,
            water_units: payment.water_units,
            water_rate: payment.water_rate,
            water_previous: meterReading ? meterReading.water_previous : payment.water_previous,
            water_current: meterReading ? meterReading.water_current : payment.water_current,
            electricity_amount: payment.electricity_amount,
            electricity_units: payment.electricity_units,
            electricity_rate: payment.electricity_rate,
            electricity_previous: meterReading ? meterReading.electricity_previous : payment.electricity_previous,
            electricity_current: meterReading ? meterReading.electricity_current : payment.electricity_current,
            internet_amount: payment.internet_amount,
            common_fee_amount: payment.common_fee_amount,
            parking_fee_amount: payment.parking_fee_amount,
            other_amount: payment.other_amount,
            late_fee_amount: payment.late_fee_amount,
            total_amount: payment.total_amount,
            room: {
                room_number: room.room_number,
                floor: room.floor
            },
            tenant: tenant ? {
                full_name: tenant.full_name,
                phone: tenant.phone,
                address: tenant.address,
                national_id: tenant.national_id
            } : null,
            bank: {
                name: configData.bank_name || '',
                account_number: configData.bank_account_number || '',
                account_name: configData.bank_account_name || ''
            },
            recipient: {
                building_name: configData.building_name || branch.branch_name || '',
                building_logo: configData.building_logo || '',
                building_address: branch.address || '',
                building_phone: configData.contact_phone || branch.phone || '',
                lessor_name: getConfigValue('lessor_name', false) || '',
                lessor_id: getConfigValue('lessor_id', false) || '',
                lessor_phone: getConfigValue('lessor_phone', false) || '',
                lessor_address: getConfigValue('lessor_address', false) || '',
                company_name: getConfigValue('company_name', false) || '',
                tax_id: getConfigValue('company_tax_id', false) || '',
                company_registration_number: getConfigValue('company_registration_number', false) || '',
                company_phone: getConfigValue('company_phone', false) || '',
                company_address: getConfigValue('company_address', false) || '',
                account_name: configData.bank_account_name || '',
                receiver_signature: getConfigValue('receipt_signature', false)
            },
            configs: relevantConfigs  // ⭐ ส่ง configs กลับไปด้วย
        };

        // ⭐ DEBUG LOG
        console.log('🚀🚀🚀 FINAL INVOICE OBJECT TO SEND:');
        console.log(`   - Invoice Branch ID: "${invoiceObject.branch_id}"`);
        console.log(`   - Invoice Branch ID Type: ${typeof invoiceObject.branch_id}`);
        console.log(`   - Object Keys: ${Object.keys(invoiceObject).join(', ')}`);

        console.log('✅ Sending response...');

        return Response.json({
            success: true,
            invoice: invoiceObject
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});