import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Version: 2025-12-11-v4-CLEAN - filter ครั้งเดียว
// Last updated: 2025-12-11 16:00 Thailand Time

function generatePaymentHash(payment) {
    const dataToHash = {
        rent_amount: payment.rent_amount || 0,
        water_units: payment.water_units || 0,
        water_amount: payment.water_amount || 0,
        electricity_units: payment.electricity_units || 0,
        electricity_amount: payment.electricity_amount || 0,
        internet_amount: payment.internet_amount || 0,
        common_fee_amount: payment.common_fee_amount || 0,
        parking_fee_amount: payment.parking_fee_amount || 0,
        other_amount: payment.other_amount || 0,
        total_amount: payment.total_amount || 0,
        due_date: payment.due_date || ''
    };
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32);
}

function numberToThaiText(number) {
    if (number === undefined || number === null || isNaN(number) || number === 0) return 'ศูนย์บาทถ้วน';

    const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    
    const parts = number.toFixed(2).split('.');
    const integerPart = parseInt(parts[0]);
    const decimalPart = parseInt(parts[1]);

    function convertInteger(num) {
        if (num === 0) return '';
        
        const numStr = num.toString();
        const len = numStr.length;
        let result = '';
        
        for (let i = 0; i < len; i++) {
            const digit = parseInt(numStr[i]);
            const position = len - i - 1;
            
            if (digit === 0) continue;
            
            if (position === 1) {
                if (digit === 1) {
                    result += 'สิบ';
                } else if (digit === 2) {
                    result += 'ยี่สิบ';
                } else {
                    result += numbers[digit] + positions[position];
                }
            } else if (position === 0 && digit === 1 && len > 1 && parseInt(numStr[len-2]) !== 0) {
                result += 'เอ็ด';
            } else {
                result += numbers[digit] + positions[position];
            }
        }
        
        return result;
    }
    
    let text = convertInteger(integerPart) + 'บาท';
    
    if (decimalPart > 0) {
        text += convertInteger(decimalPart) + 'สตางค์';
    } else {
        text += 'ถ้วน';
    }
    
    return text;
}

Deno.serve(async (req) => {
    const VERSION = 'v4-CLEAN';
    
    console.log('\n\n');
    console.log('████████████████████████████████████████████████████');
    console.log('█  🚀 ADVANCE REMINDER ' + VERSION + '           █');
    console.log('████████████████████████████████████████████████████');
    console.log('⏰ START:', new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }));
    console.log('════════════════════════════════════════════════════\n');
    
    try {
        const base44 = createClientFromRequest(req);

        // Parse request
        let targetBranchId = null;
        let testLineUserId = null;
        let limit = 30;
        try {
            const text = await req.text();
            if (text) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
                testLineUserId = body.test_line_user_id || null;
                limit = body.limit || 30;
            }
        } catch (parseError) {}

        // Load configs
        const configs = await base44.asServiceRole.entities.Config.list();
        
        const getConfigValue = (key, defaultValue, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        const branchReminderConfigs = configs.filter(c => c.key === 'send_advance_reminder');
        const enabledBranches = branchReminderConfigs.filter(c => c.value === 'true').map(c => c.branch_id);

        console.log('📊 Enabled branches:', enabledBranches.length, '/', branchReminderConfigs.length);

        if (enabledBranches.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีสาขาเปิดการแจ้งเตือนล่วงหน้า',
                sent: 0
            });
        }

        // Calculate today
        const now = new Date();
        const thailandTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
        const todayDateString = thailandTime.toISOString().split('T')[0];
        console.log('📅 Today:', todayDateString);

        // Fetch data
        async function fetchAll(entity, filter = null) {
            let allData = [];
            let skip = 0;
            let hasMore = true;
            
            while (hasMore) {
                const batch = filter 
                    ? await entity.filter(filter, '-created_date', 5000, skip)
                    : await entity.list('-created_date', 5000, skip);
                    
                if (!Array.isArray(batch) || batch.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(batch);
                    skip += batch.length;
                    if (batch.length < 5000) hasMore = false;
                }
            }
            return allData;
        }

        console.log('\n📥 FETCHING DATA...');

        const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : null;
        const [allPayments, allTenants, allRooms, branchesData] = await Promise.all([
            fetchAll(base44.asServiceRole.entities.Payment, paymentFilter),
            fetchAll(base44.asServiceRole.entities.Tenant),
            fetchAll(base44.asServiceRole.entities.Room),
            base44.asServiceRole.entities.Branch.list()
        ]);

        const tenantMap = new Map(allTenants.map(t => [t.id, t]));
        const roomMap = new Map(allRooms.map(r => [r.id, r]));
        const branchMap = new Map(branchesData.map(b => [b.id, b.branch_name]));

        console.log('\n📦 DATA LOADED:');
        console.log('   Payments:', allPayments.length);
        console.log('   Tenants:', allTenants.length);
        console.log('   Rooms:', allRooms.length);

        // ⭐⭐⭐ FILTER ครั้งเดียว - เช็คทุกอย่างพร้อมกัน
        console.log('\n🔍 FILTERING (all-in-one)...\n');
        
        let readyToSend = allPayments.filter(p => {
            // 1. Basic checks
            if (p.status === 'paid') return false;
            if (!p.due_date) return false;
            if (p.advance_reminder_sent_date) return false;
            if (targetBranchId && p.branch_id !== targetBranchId) return false;
            if (!enabledBranches.includes(p.branch_id)) return false;
            
            // 2. Date check
            const branchAdvanceDays = parseInt(getConfigValue('bill_advance_notice_days', '3', p.branch_id));
            const dueDate = new Date(p.due_date);
            const notifyDate = new Date(dueDate);
            notifyDate.setDate(dueDate.getDate() - branchAdvanceDays);
            const notifyDateString = notifyDate.toISOString().split('T')[0];
            
            if (notifyDateString !== todayDateString) return false;
            
            // 3. Image + Hash check
            if (!p.invoice_image_url) return false;
            if (p.invoice_data_hash) {
                const currentHash = generatePaymentHash(p);
                if (currentHash !== p.invoice_data_hash) return false;
            }
            
            return true;
        });
        
        console.log('════════════════════════════════════════════════════');
        console.log('📊 FILTER RESULT:');
        console.log('   Total Payments:', allPayments.length);
        console.log('   ✅ Ready to Send:', readyToSend.length);
        console.log('════════════════════════════════════════════════════\n');

        if (readyToSend.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีบิลที่ต้องส่งแจ้งเตือนล่วงหน้าวันนี้',
                sent: 0,
                total: 0
            });
        }

        // จำกัดจำนวน
        const paymentsToProcess = readyToSend.slice(0, limit);
        console.log(`📋 Processing: ${paymentsToProcess.length}/${readyToSend.length}`);

        const recipients = [];

        for (const payment of paymentsToProcess) {
            const tenant = tenantMap.get(payment.tenant_id);
            const room = roomMap.get(payment.room_id);

            if (!tenant || (!tenant.line_user_id && !tenant.facebook_user_id)) continue;

            const branchBankName = getConfigValue('bank_name', 'กสิกร', payment.branch_id);