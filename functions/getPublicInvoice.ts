import { createServiceRoleClient } from 'npm:@base44/sdk@0.8.4';

// Public API สำหรับดึงข้อมูลใบแจ้งหนี้ (ไม่ต้อง login)
Deno.serve(async (req) => {
    console.log('========================================');
    console.log('✨✨✨ VERSION 5 - FRESH DEPLOY ✨✨✨');
    console.log('📄 GET PUBLIC INVOICE');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('========================================');

    try {
        const base44 = createServiceRoleClient();
        
        // Parse request body
        let paymentId, branchId;
        
        if (req.method === 'POST') {
            const body = await req.json();
            paymentId = body.paymentId;
            branchId = body.branchId;
        } else {
            const url = new URL(req.url);
            paymentId = url.searchParams.get('id');
            branchId = url.searchParams.get('branch');
        }

        console.log(`📋 Payment ID: ${paymentId}`);

        if (!paymentId) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบรหัสใบแจ้งหนี้' 
            }, { status: 400 });
        }

        // ดึงข้อมูล Payment
        console.log('📥 Querying Database...');
        const paymentResults = await base44.entities.Payment.filter({ id: paymentId });
        const payment = Array.isArray(paymentResults) ? paymentResults[0] : paymentResults;

        if (!payment) {
            console.error('❌ Payment not found');
            return Response.json({ 
                success: false, 
                error: 'ไม่พบใบแจ้งหนี้' 
            }, { status: 404 });
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
        
        const [tenantResults, roomResults, branchResults, configs] = await Promise.all([
            payment.tenant_id ? base44.entities.Tenant.filter({ id: payment.tenant_id }) : Promise.resolve([]),
            payment.room_id ? base44.entities.Room.filter({ id: payment.room_id }) : Promise.resolve([]),
            actualBranchId ? base44.entities.Branch.filter({ id: actualBranchId }) : Promise.resolve([]),
            base44.entities.Config.list()
        ]);

        const tenant = Array.isArray(tenantResults) ? tenantResults[0] : tenantResults;
        const room = Array.isArray(roomResults) ? roomResults[0] : roomResults;
        const branch = Array.isArray(branchResults) ? branchResults[0] : branchResults;

        console.log(`📋 Found: room=${room?.room_number}, tenant=${tenant?.full_name}, branch=${branch?.branch_name}`);
        
        if (!room || !tenant || !branch) {
            console.error(`❌ Missing data: room=${!!room}, tenant=${!!tenant}, branch=${!!branch}`);
            return Response.json({ 
                success: false, 
                error: 'ข้อมูลไม่ครบถ้วน' 
            }, { status: 500 });
        }

        // ดึง config ของสาขา
        const getConfigValue = (key) => {
            const branchConfig = configs.find(c => c.key === key && c.branch_id === actualBranchId);
            if (branchConfig) return branchConfig.value;
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || null;
        };

        const configData = {
            building_name: getConfigValue('building_name'),
            building_logo: getConfigValue('building_logo'),
            promptpay: getConfigValue('promptpay'),
            promptpay_qr_url: getConfigValue('promptpay_qr_url'),
            bank_name: getConfigValue('bank_name'),
            bank_account_number: getConfigValue('bank_account_number'),
            bank_account_name: getConfigValue('bank_account_name'),
            contact_phone: getConfigValue('contact_phone')
        };

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
            water_previous: payment.water_previous,
            water_current: payment.water_current,
            electricity_amount: payment.electricity_amount,
            electricity_units: payment.electricity_units,
            electricity_rate: payment.electricity_rate,
            electricity_previous: payment.electricity_previous,
            electricity_current: payment.electricity_current,
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
            tenant: {
                full_name: tenant.full_name,
                phone: tenant.phone,
                address: tenant.address,
                national_id: tenant.national_id
            },
            bank: {
                name: configData.bank_name || 'กสิกรไทย',
                account_number: configData.bank_account_number || '',
                account_name: configData.bank_account_name || ''
            },
            recipient: {
                building_name: configData.building_name || branch.branch_name || 'W RESIDENTS',
                building_logo: configData.building_logo || '',
                building_address: branch.address || '',
                building_phone: configData.contact_phone || branch.phone || '',
                lessor_name: getConfigValue('lessor_name') || '',
                lessor_address: getConfigValue('lessor_address') || '',
                company_name: getConfigValue('company_name') || '',
                tax_id: getConfigValue('company_tax_id') || '',
                company_registration_number: getConfigValue('company_registration_number') || '',
                company_phone: getConfigValue('company_phone') || '',
                company_address: getConfigValue('company_address') || '',
                account_name: configData.bank_account_name || ''
            }
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