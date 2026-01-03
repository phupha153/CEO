import { createServiceRoleClient } from 'npm:@base44/sdk@0.8.4';

// Public API สำหรับดึงข้อมูลใบแจ้งหนี้ (ไม่ต้อง login)
Deno.serve(async (req) => {
    console.log('========================================');
    console.log('📄 GET PUBLIC INVOICE (DEBUG MODE)');
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

        console.log(`📋 Payment ID Requested: ${paymentId}`);

        if (!paymentId) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบรหัสใบแจ้งหนี้' 
            }, { status: 400 });
        }

        // ดึงข้อมูล Payment โดยตรงด้วย filter
        console.log('📥 Querying Database for Payment...');
        const paymentResults = await base44.entities.Payment.filter({ id: paymentId });
        
        console.log(`📊 Query Results: Found ${Array.isArray(paymentResults) ? paymentResults.length : (paymentResults ? 1 : 0)} payment(s)`);
        
        if (Array.isArray(paymentResults) && paymentResults.length > 1) {
            console.error(`⚠️ DUPLICATE PAYMENT IDS FOUND: ${paymentResults.length} records with same ID`);
            paymentResults.forEach((p, idx) => {
                console.log(`  [${idx}] room_id: ${p.room_id}, tenant_id: ${p.tenant_id}, total: ${p.total_amount}`);
            });
        }
        
        const payment = Array.isArray(paymentResults) ? paymentResults[0] : paymentResults;

        if (!payment) {
            console.error('❌ Payment not found in Database');
            return Response.json({ 
                success: false, 
                error: 'ไม่พบใบแจ้งหนี้' 
            }, { status: 404 });
        }

        // ⭐ LOG: ดูข้อมูลดิบจาก Database ว่ามีค่าปรับหรือไม่
        console.log('🔍 [DEBUG] Raw DB Data:');
        console.log(`   - ID: ${payment.id}`);
        console.log(`   - Branch ID: ${payment.branch_id} (Type: ${typeof payment.branch_id})`);
        console.log(`   - Status: ${payment.status}`);
        console.log(`   - Total Amount: ${payment.total_amount}`);
        console.log(`   - Late Fee Amount: ${payment.late_fee_amount} (Type: ${typeof payment.late_fee_amount})`);

        // ตรวจสอบ branch_id ถ้ามีการส่งมา
        if (branchId && payment.branch_id !== branchId) {
            return Response.json({ 
                success: false, 
                error: 'ไม่พบใบแจ้งหนี้ในสาขานี้' 
            }, { status: 404 });
        }

        const actualBranchId = payment.branch_id;

        // ดึงข้อมูลที่เกี่ยวข้อง - ดึงแบบ targeted query
        console.log(`🔍 Looking for room_id: ${payment.room_id}, tenant_id: ${payment.tenant_id}, branch_id: ${actualBranchId}`);
        
        const [tenantResults, roomResults, branchResults, configs] = await Promise.all([
            payment.tenant_id ? base44.entities.Tenant.filter({ id: payment.tenant_id }) : Promise.resolve([]),
            payment.room_id ? base44.entities.Room.filter({ id: payment.room_id }) : Promise.resolve([]),
            actualBranchId ? base44.entities.Branch.filter({ id: actualBranchId }) : Promise.resolve([]),
            base44.entities.Config.list()
        ]);

        const tenant = Array.isArray(tenantResults) ? tenantResults[0] : tenantResults;
        const room = Array.isArray(roomResults) ? roomResults[0] : roomResults;
        const branch = Array.isArray(branchResults) ? branchResults[0] : branchResults;

        console.log(`📋 Found: room=${room?.room_number || 'NOT FOUND'}, tenant=${tenant?.full_name || 'NOT FOUND'}, branch=${branch?.branch_name || 'NOT FOUND'}`);
        
        // ⚠️ ตรวจสอบว่าข้อมูลครบถ้วนหรือไม่
        if (!room) {
            console.error(`❌ CRITICAL: Room not found for room_id: ${payment.room_id}`);
            return Response.json({ 
                success: false, 
                error: `ไม่พบข้อมูลห้อง (room_id: ${payment.room_id})` 
            }, { status: 500 });
        }
        
        if (!tenant) {
            console.error(`❌ CRITICAL: Tenant not found for tenant_id: ${payment.tenant_id}`);
            return Response.json({ 
                success: false, 
                error: `ไม่พบข้อมูลผู้เช่า (tenant_id: ${payment.tenant_id})` 
            }, { status: 500 });
        }
        
        if (!branch) {
            console.error(`❌ CRITICAL: Branch not found for branch_id: ${actualBranchId}`);
            return Response.json({ 
                success: false, 
                error: `ไม่พบข้อมูลสาขา (branch_id: ${actualBranchId})` 
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

        console.log('✅ Invoice data fetched successfully');
        
        // ⭐ Debug: Log all config keys
        console.log('📋 ALL CONFIGS COUNT:', configs.length);
        console.log('📋 CONFIGS FOR BRANCH:', actualBranchId);
        const relevantConfigs = configs.filter(c => 
            ['company_name', 'company_tax_id', 'company_registration_number', 'company_address', 'lessor_name', 'lessor_address', 'bank_account_name'].includes(c.key)
        );
        console.log('📋 RELEVANT CONFIGS:', JSON.stringify(relevantConfigs, null, 2));
        
        // Debug extracted values
        console.log('📋 EXTRACTED CONFIG VALUES:');
        console.log('   - company_name:', getConfigValue('company_name'));
        console.log('   - company_tax_id:', getConfigValue('company_tax_id'));
        console.log('   - company_registration_number:', getConfigValue('company_registration_number'));
        console.log('   - company_address:', getConfigValue('company_address'));
        console.log('   - lessor_name:', getConfigValue('lessor_name'));
        console.log('   - lessor_address:', getConfigValue('lessor_address'));
        console.log('   - bank_account_name:', configData.bank_account_name);

        // ⭐ สร้าง invoice object สำหรับ generateInvoiceImage
        const invoiceObject = {
            id: payment.id,
            branch_id: payment.branch_id,
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
            // ✅ Map ค่าปรับตรงนี้ (เพิ่มเข้ามาเพื่อให้รูปบิลแสดงค่าปรับ)
            late_fee_amount: payment.late_fee_amount,
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
                company_registration_number: getConfigValue('company_registration_number') || '',
                company_phone: getConfigValue('company_phone') || '',
                company_address: getConfigValue('company_address') || '',
                account_name: configData.bank_account_name || ''
            }
        };

        // ⭐ LOG: ตรวจสอบ object ที่กำลังจะส่งกลับ
        console.log('🚀🚀🚀 [NEW LOG v2] SENDING INVOICE OBJECT 🚀🚀🚀');
        console.log(`   - Branch ID in Object: ${invoiceObject.branch_id} (Type: ${typeof invoiceObject.branch_id})`);
        console.log(`   - Late Fee in Object: ${invoiceObject.late_fee_amount}`);
        console.log(`   - Keys in Object: ${Object.keys(invoiceObject).join(', ')}`);

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
                    late_fee_amount: payment.late_fee_amount,
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