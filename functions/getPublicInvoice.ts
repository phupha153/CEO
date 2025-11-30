import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Public API สำหรับดึงข้อมูลใบแจ้งหนี้ (ไม่ต้อง login)
Deno.serve(async (req) => {
    console.log('========================================');
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
            branchId = body.branchId;
        } else {
            const url = new URL(req.url);
            paymentId = url.searchParams.get('id');
            branchId = url.searchParams.get('branch');
        }

        console.log(`📋 Payment ID: ${paymentId}`);
        console.log(`🏢 Branch ID: ${branchId}`);

        if (!paymentId) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบรหัสใบแจ้งหนี้' 
            }, { status: 400 });
        }

        // ดึงข้อมูล Payment
        const payments = await base44.asServiceRole.entities.Payment.list('-created_date', 5000);
        const payment = payments.find(p => p.id === paymentId);

        if (!payment) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบใบแจ้งหนี้' 
            }, { status: 404 });
        }

        // ตรวจสอบ branch_id ถ้ามีการส่งมา
        if (branchId && payment.branch_id !== branchId) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบใบแจ้งหนี้ในสาขานี้' 
            }, { status: 404 });
        }

        const actualBranchId = payment.branch_id;

        // ดึงข้อมูลที่เกี่ยวข้อง
        const [tenants, rooms, branches, configs] = await Promise.all([
            base44.asServiceRole.entities.Tenant.list('-created_date', 5000),
            base44.asServiceRole.entities.Room.list('-created_date', 5000),
            base44.asServiceRole.entities.Branch.list(),
            base44.asServiceRole.entities.Config.list()
        ]);

        const tenant = tenants.find(t => t.id === payment.tenant_id);
        const room = rooms.find(r => r.id === payment.room_id);
        const branch = branches.find(b => b.id === actualBranchId);

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

        console.log('✅ Invoice data fetched successfully');

        return Response.json({
            success: true,
            data: {
                payment: {
                    id: payment.id,
                    status: payment.status,
                    due_date: payment.due_date,
                    created_date: payment.created_date,
                    rent_amount: payment.rent_amount,
                    water_amount: payment.water_amount,
                    water_units: payment.water_units,
                    water_rate: payment.water_rate,
                    electricity_amount: payment.electricity_amount,
                    electricity_units: payment.electricity_units,
                    electricity_rate: payment.electricity_rate,
                    internet_amount: payment.internet_amount,
                    common_fee_amount: payment.common_fee_amount,
                    parking_fee_amount: payment.parking_fee_amount,
                    other_amount: payment.other_amount,
                    total_amount: payment.total_amount
                },
                tenant: tenant ? {
                    full_name: tenant.full_name,
                    phone: tenant.phone
                } : null,
                room: room ? {
                    room_number: room.room_number,
                    floor: room.floor
                } : null,
                branch: branch ? {
                    branch_name: branch.branch_name,
                    address: branch.address,
                    phone: branch.phone
                } : null,
                configs: configData
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