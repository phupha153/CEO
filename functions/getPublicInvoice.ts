import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Public API สำหรับดึงข้อมูลใบแจ้งหนี้ (ไม่ต้อง login)
// ⭐ ใช้วิธี list().find() ซึ่งเสถียรที่สุด (ช้ากว่า filter แต่ไม่มีปัญหา)
Deno.serve(async (req) => {
    const startTime = Date.now();
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

        // ===== STEP 1: ดึง Payment โดยตรง (ใช้ filter by ID - เร็วที่สุด) =====
        console.log(`⏱️ [${Date.now() - startTime}ms] Fetching payment by ID...`);
        const paymentResults = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
        const payment = Array.isArray(paymentResults) && paymentResults.length > 0 ? paymentResults[0] : null;
        console.log(`⏱️ [${Date.now() - startTime}ms] Payment found: ${payment ? 'YES' : 'NO'}`);

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

        // ===== STEP 2: ดึง Configs และ Branches (เล็ก ไม่ timeout) =====
        console.log(`⏱️ [${Date.now() - startTime}ms] Fetching configs and branches...`);
        const [configs, allBranches] = await Promise.all([
            base44.asServiceRole.entities.Config.list(),
            base44.asServiceRole.entities.Branch.list()
        ]);
        const branch = actualBranchId ? allBranches.find(b => b.id === actualBranchId) : null;
        console.log(`⏱️ [${Date.now() - startTime}ms] Loaded ${configs.length} configs, ${allBranches.length} branches`);

        // ===== STEP 3: ดึง Tenant และ Room (ใช้ list + find) =====
        let tenant = null;
        let room = null;
        
        console.log(`⏱️ [${Date.now() - startTime}ms] Fetching tenant and room...`);
        console.log(`🔍 Looking for room_id: ${payment.room_id}, tenant_id: ${payment.tenant_id}`);
        
        // ดึง Tenant และ Room พร้อมกัน (parallel)
        const [allTenants, allRooms] = await Promise.all([
            payment.tenant_id 
                ? base44.asServiceRole.entities.Tenant.list('-created_date', 10000)
                : Promise.resolve([]),
            payment.room_id 
                ? base44.asServiceRole.entities.Room.list('-created_date', 10000)
                : Promise.resolve([])
        ]);
        
        if (payment.tenant_id) {
            tenant = allTenants.find(t => t.id === payment.tenant_id);
            console.log(`📋 Loaded ${allTenants.length} tenants, found: ${tenant?.full_name || 'NOT FOUND'}`);
        }
        
        if (payment.room_id) {
            room = allRooms.find(r => r.id === payment.room_id);
            console.log(`📋 Loaded ${allRooms.length} rooms, found: ${room?.room_number || 'NOT FOUND'}`);
        }

        console.log(`⏱️ [${Date.now() - startTime}ms] Final: room=${room?.room_number || 'N/A'}, tenant=${tenant?.full_name || 'ไม่ระบุ'}, branch=${branch?.branch_name || 'N/A'}`);

        // ===== STEP 4: ดึง Config Values =====
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

        // ===== STEP 5: สร้าง Response =====
        const invoiceObject = {
            id: payment.id,
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
            total_amount: payment.total_amount,
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

        console.log(`✅ [${Date.now() - startTime}ms] Invoice data fetched successfully`);

        return Response.json({
            success: true,
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
            },
            _debug: {
                totalTime: `${Date.now() - startTime}ms`,
                recordCounts: {
                    payments: allPayments.length,
                    tenants: allTenants.length,
                    rooms: allRooms.length,
                    configs: configs.length
                }
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