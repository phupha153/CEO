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

        // ดึงข้อมูล Payment โดยตรงด้วย filter
        const paymentResults = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
        const payment = Array.isArray(paymentResults) ? paymentResults[0] : paymentResults;

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

        // ดึงข้อมูลที่เกี่ยวข้องโดยตรงด้วย filter
        const [tenantResults, roomResults, branchResults, configs] = await Promise.all([
            payment.tenant_id ? base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id }) : Promise.resolve([]),
            payment.room_id ? base44.asServiceRole.entities.Room.filter({ id: payment.room_id }) : Promise.resolve([]),
            actualBranchId ? base44.asServiceRole.entities.Branch.filter({ id: actualBranchId }) : Promise.resolve([]),
            base44.asServiceRole.entities.Config.list()
        ]);

        const tenant = Array.isArray(tenantResults) ? tenantResults[0] : tenantResults;
        const room = Array.isArray(roomResults) ? roomResults[0] : roomResults;
        const branch = Array.isArray(branchResults) ? branchResults[0] : branchResults;

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

        // ⭐ สร้าง invoice object สำหรับ generateInvoiceImage
        const invoiceObject = {
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
            total_amount: payment.total_amount,
            // ⭐ รวม room, tenant, bank, recipient ไว้ในตัว invoice
            room: room ? {
                room_number: room.room_number,
                floor: room.floor
            } : { room_number: 'N/A', floor: 0 },
            tenant: tenant ? {
                full_name: tenant.full_name,
                phone: tenant.phone,
                address: tenant.address,
                national_id: tenant.national_id
            } : { full_name: 'ไม่ระบุ', phone: '' },
            bank: {
                name: configData.bank_name || 'กสิกรไทย',
                account_number: configData.bank_account_number || '',
                account_name: configData.bank_account_name || ''
            },
            recipient: {
                building_name: configData.building_name || branch?.branch_name || 'W RESIDENTS',
                building_logo: configData.building_logo || '',
                building_address: branch?.address || '',
                building_phone: configData.contact_phone || branch?.phone || '',
                lessor_name: getConfigValue('lessor_name') || '',
                lessor_address: getConfigValue('lessor_address') || '',
                company_name: getConfigValue('company_name') || '',
                tax_id: getConfigValue('company_tax_id') || '',
                company_registration_number: getConfigValue('company_registration_number') || ''
            }
        };

        return Response.json({
            success: true,
            // ⭐ ส่งทั้ง invoice (สำหรับ generateInvoiceImage) และ data (สำหรับ PublicInvoice page)
            invoice: invoiceObject,
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