import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { calculateLateFee } from './utils/calculateLateFee.js';

// ⭐ ฟังก์ชันสร้าง hash จากข้อมูลบิล เพื่อตรวจจับการเปลี่ยนแปลง
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
    if (!number || number === 0) return 'ศูนย์บาทถ้วน';

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

            if (position === 1 && digit === 1) {
                result += 'สิบ';
            } else if (position === 1 && digit === 2) {
                result += 'ยี่สิบ';
            } else if (position === 0 && digit === 1 && len > 1) {
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

async function getLineToken(base44, branchId = null) {
    try {
        const configs = await base44.asServiceRole.entities.Config.list();

        // ⭐ ใช้ token เฉพาะสาขาเท่านั้น (ไม่ fallback ไป global หรือ env)
        if (branchId) {
            const branchToken = configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branchId);
            if (branchToken?.value?.trim()) {
                console.log(`✅ Using branch-specific token for branch: ${branchId.substring(0, 8)}...`);
                return branchToken.value.trim();
            }

            // ⭐ ไม่มี token ของสาขานี้
            console.warn(`⚠️ No LINE token found for branch: ${branchId.substring(0, 8)}...`);
            return null;
        }

        // กรณี Global token (เผื่อไว้ แต่ระบบนี้เน้น Branch)
        const globalToken = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
        if (globalToken?.value?.trim()) {
            console.log('✅ Using global token from Config database');
            return globalToken.value.trim();
        }

        console.warn('⚠️ No LINE token found');
        return null;
    } catch (error) {
        console.error('❌ Error fetching LINE token:', error);
        return null;
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 🔒 Security: Plan Verification (SaaS Standard)
        const planStatus = user.plan_status;
        if (!planStatus || planStatus === 'expired' || planStatus === 'cancelled') {
            return Response.json({ 
                error: 'Subscription required', 
                message: 'แพ็กเกจของคุณหมดอายุแล้ว กรุณาต่ออายุเพื่อใช้งานต่อ' 
            }, { status: 402 });
        }
        if (planStatus === 'trial' && user.trial_ends_at) {
            const trialEnd = new Date(user.trial_ends_at);
            if (new Date() > trialEnd) {
                return Response.json({ 
                    error: 'Trial expired', 
                    message: 'ช่วงทดลองใช้หมดอายุแล้ว กรุณาเลือกแพ็กเกจเพื่อใช้งานต่อ' 
                }, { status: 402 });
            }
        }

        const { paymentId, branch_id, template, customMessage } = await req.json();
        
        console.log('🔍 sendPaymentReminder received:', { paymentId, branch_id, template, hasCustomMessage: !!customMessage });

        // 🔒 Security: Branch Access Check
        if (branch_id) {
            const userAccessibleBranches = user.accessible_branches;
            const isDeveloper = user.custom_role === 'developer';
            const isOwner = user.custom_role === 'owner';
            
            if (!isDeveloper && !isOwner) {
                if (userAccessibleBranches && !userAccessibleBranches.includes(branch_id)) {
                    return Response.json({ error: 'Branch access denied' }, { status: 403 });
                }
            }
        }

        // ⭐ ดึงข้อมูลตาม branch_id หรือ payment_id
        console.log('📊 Fetching data...');

        let allPayments = [];
        let allTenants = [];
        let allRooms = [];
        let configs = [];

        if (paymentId) {
            // ถ้าระบุ paymentId
            const [paymentResults, configResults] = await Promise.all([
                base44.asServiceRole.entities.Payment.filter({ id: paymentId }),
                base44.asServiceRole.entities.Config.list()
            ]);

            const payment = Array.isArray(paymentResults) ? paymentResults[0] : paymentResults;
            allPayments = payment ? [payment] : [];
            configs = configResults;

            if (payment) {
                const [tenantResults, roomResults] = await Promise.all([
                    payment.tenant_id ? base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id }) : Promise.resolve([]),
                    payment.room_id ? base44.asServiceRole.entities.Room.filter({ id: payment.room_id }) : Promise.resolve([])
                ]);

                const tenant = Array.isArray(tenantResults) ? tenantResults[0] : tenantResults;
                const room = Array.isArray(roomResults) ? roomResults[0] : roomResults;

                allTenants = tenant ? [tenant] : [];
                allRooms = room ? [room] : [];
            }
        } else if (branch_id) {
            // ดึงเฉพาะ branch นั้น
            const [configResults, tenantResults, roomResults] = await Promise.all([
                base44.asServiceRole.entities.Config.list(),
                base44.asServiceRole.entities.Tenant.filter({ branch_id }),
                base44.asServiceRole.entities.Room.filter({ branch_id })
            ]);

            configs = configResults;
            allTenants = Array.isArray(tenantResults) ? tenantResults : [];
            allRooms = Array.isArray(roomResults) ? roomResults : [];

            // ⭐ ดึง pending และ overdue ที่ยังไม่ส่ง (bill_sent_date = null)
            const [pendingResults, overdueResults] = await Promise.all([
                base44.asServiceRole.entities.Payment.filter({ branch_id, status: 'pending' }),
                base44.asServiceRole.entities.Payment.filter({ branch_id, status: 'overdue' })
            ]);

            const pending = Array.isArray(pendingResults) ? pendingResults : [];
            const overdue = Array.isArray(overdueResults) ? overdueResults : [];

            allPayments = [...pending, ...overdue].filter(p => !p.bill_sent_date);
        } else {
            return Response.json({
                success: false,
                message: 'กรุณาระบุ branch_id หรือ paymentId'
            }, { status: 400 });
        }

        console.log(`✅ Loaded: ${allTenants.length} tenants, ${allRooms.length} rooms, ${allPayments.length} payments`);

        // สร้าง Map
        const tenantMap = new Map(allTenants.map(t => [t.id, t]));
        const roomMap = new Map(allRooms.map(r => [r.id, r]));

        // Helper function config
        const getConfigValue = (key, branchId, defaultValue = '') => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig?.value) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        let paymentsToSend = allPayments;

        if (paymentsToSend.length === 0) {
            return Response.json({
                success: false,
                message: 'ไม่มีรายการที่ต้องส่ง'
            });
        }

        console.log(`📤 Processing ${paymentsToSend.length} payments...`);

        const recipients = [];

        for (const payment of paymentsToSend) {
            const tenant = tenantMap.get(payment.tenant_id);
            const room = roomMap.get(payment.room_id);

            if (!tenant) {
                console.log(`⚠️ Skipping payment ${payment.id}: No tenant found`);
                continue;
            }

            const hasLineOrFacebook = tenant.line_user_id || tenant.facebook_user_id;

            if (!hasLineOrFacebook) {
                console.log(`⚠️ Skipping payment ${payment.id}: No LINE or Facebook connection`);
                continue;
            }

            // คำนวณ overdue
            let daysOverdue = 0;
            let statusText = 'รอชำระ';
            if (payment.due_date) {
                const dueDate = new Date(payment.due_date);
                dueDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

                if (diffDays > 0) {
                    daysOverdue = diffDays;
                    statusText = `เกินกำหนด ${daysOverdue} วัน`;
                }
            }

            // คำนวณค่าปรับ real-time
            const branchId = payment.branch_id;
            let calculatedLateFee = 0;

            if (daysOverdue > 0) {
                const branchTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === branchId);
                const globalTiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
                const tiersEnabledConfig = branchTiersEnabledConfig || globalTiersEnabledConfig;
                const tiersEnabled = tiersEnabledConfig?.value === 'true';

                if (tiersEnabled) {
                    const branchTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && c.branch_id === branchId);
                    const globalTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
                    const tiersConfig = branchTiersConfig || globalTiersConfig;

                    if (tiersConfig?.value) {
                        try {
                            const tiers = JSON.parse(tiersConfig.value);
                            for (const tier of tiers) {
                                const daysFrom = tier.days_from || 1;
                                const daysTo = tier.days_to || 999;
                                const feePerDay = parseFloat(tier.fee_per_day || 0);
                                if (daysOverdue >= daysFrom) {
                                    const daysInTier = Math.min(daysOverdue, daysTo) - daysFrom + 1;
                                    if (daysInTier > 0) calculatedLateFee += daysInTier * feePerDay;
                                }
                                if (daysOverdue <= daysTo) break;
                            }
                        } catch (e) {
                            console.error('Error parsing tiers:', e);
                        }
                    }
                } else {
                    const branchConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && c.branch_id === branchId);
                    const globalConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && !c.branch_id);
                    const config = branchConfig || globalConfig;
                    const feePerDay = parseFloat(config?.value || '0');
                    if (!isNaN(feePerDay) && feePerDay > 0) {
                        calculatedLateFee = daysOverdue * feePerDay;
                    }
                }

                console.log(`   💰 Calculated late fee: ${calculatedLateFee} บาท (${daysOverdue} วัน)`);

                const oldLateFee = payment.late_fee_amount || 0;
                if (calculatedLateFee !== oldLateFee) {
                    const originalAmount = payment.total_amount - oldLateFee;
                    const newTotalAmount = originalAmount + calculatedLateFee;

                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        late_fee_amount: calculatedLateFee,
                        total_amount: newTotalAmount,
                        status: 'overdue'
                    });

                    payment.late_fee_amount = calculatedLateFee;
                    payment.total_amount = newTotalAmount;
                    payment.status = 'overdue';
                }
            }

            let dueDateStr = 'ไม่ระบุ';
            if (payment.due_date) {
                dueDateStr = new Date(payment.due_date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }

            const bankAccountNumber = getConfigValue('bank_account_number', branchId, '0722835522');
            const bankAccountName = getConfigValue('bank_account_name', branchId, 'ธนานนท์ พรมพักตร์');
            const bankName = getConfigValue('bank_name', branchId, 'กสิกร');
            const buildingName = getConfigValue('building_name', branchId, 'W RESIDENTS');

            // --- ส่วนสร้างข้อความ ---
            let message = '';

            console.log(`📝 Message template for payment ${payment.id}: "${template}", customMessage: ${!!customMessage}`);

            if (customMessage && customMessage.trim()) {
                message = customMessage.trim();
                message += `\n\n💳 โอนเงินได้ที่: ${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}`;
            } else {
                const roomNum = room?.room_number || 'N/A';
                const lateFee = calculatedLateFee;
                const originalAmount = payment.total_amount - (payment.late_fee_amount || 0);
                const totalWithLateFee = originalAmount + lateFee;

                const lateFeePerDayConfig = getConfigValue('late_payment_fee_per_day', branchId, '0');
                const feePerDay = parseFloat(lateFeePerDayConfig);

                if (template === 'overdue') {
                    // --- CASE 1: เกินกำหนด (Summary เน้นยอด) ---
                    message = `🔴 แจ้งเตือนเกินกำหนดชำระ\n\n`;
                    message += `${buildingName}\n`;
                    message += `คุณ ${tenant.full_name} ห้อง ${roomNum}\n`;
                    message += `💰 ยอดเงิน: ${originalAmount.toLocaleString()} บาท`;
                    if (lateFee > 0) {
                        message += `\n⚠️ ค่าปรับล่าช้า: +${lateFee.toLocaleString()} บาท`;
                    }
                    message += `\n💰 รวมทั้งสิ้น: ${totalWithLateFee.toLocaleString()} บาท`;
                    message += `\nเกินกำหนดมาแล้ว: ${daysOverdue} วัน\n\n`;
                    message += `กรุณาชำระโดยด่วนค่ะ${lateFee > 0 ? ' เพื่อหลีกเลี่ยงค่าปรับเพิ่มเติม' : ''}\n\n`;
                    message += `💳 โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
                    message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;

                } else if (template === 'due_date') {
                    // --- CASE 2: ครบกำหนด (ใช้คำว่า แจ้งเตือนค่าเช่า และแสดงรายละเอียดครบ) ---
                    message = `📢 แจ้งเตือนค่าเช่า (ครบกำหนดวันนี้)\n\n`; // ใช้คำว่าแจ้งเตือนค่าเช่าตามที่ขอ
                    message += `${buildingName}\n`;
                    message += `คุณ ${tenant.full_name} ห้อง ${roomNum}\n\n`;
                    
                    // เพิ่มรายละเอียดค่าใช้จ่าย
                    message += `รายละเอียดค่าใช้จ่าย:\n`;
                    message += `━━━━━━━━━━━━━━━━━━━━\n`;
                    
                    if (payment.rent_amount >= 0) message += `🏠 ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
                    if (payment.electricity_amount >= 0) message += `⚡ ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
                    if (payment.water_amount >= 0) message += `💧 ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
                    if (payment.internet_amount > 0) message += `🌐 ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
                    if (payment.common_fee_amount > 0) message += `🧹 ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
                    if (payment.parking_fee_amount > 0) message += `🚗 ค่าที่จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บาท\n`;
                    if (payment.other_amount > 0) message += `📝 ค่าใช้จ่ายอื่นๆ: ${payment.other_amount.toLocaleString()} บาท\n`;
                    
                    message += `━━━━━━━━━━━━━━━━━━━━\n`;
                    message += `💰 รวมทั้งสิ้น: ${payment.total_amount.toLocaleString()} บาท\n`;
                    message += `(${numberToThaiText(payment.total_amount)})\n\n`;
                    
                    if (!isNaN(feePerDay) && feePerDay > 0) {
                        message += `⚠️ หากชำระหลังวันนี้ มีค่าปรับ ${feePerDay} บาท/วัน\n\n`;
                    }
                    
                    message += `💳 โอนเงินได้ที่:\n`;
                    message += `${bankName} ${bankAccountNumber}\n`;
                    message += `ชื่อ: ${bankAccountName}\n\n`;
                    message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;

                } else {
                    // --- CASE 3: ปกติ (Advance/General) ---
                    message = `📢 ${buildingName} - แจ้งเตือนค่าเช่า\n\n`;
                    message += `สวัสดีคุณ ${tenant.full_name}\n`;
                    message += `ห้อง ${roomNum}\n\n`;
                    message += `รายละเอียดค่าใช้จ่าย:\n`;
                    message += `━━━━━━━━━━━━━━━━━━━━\n`;

                    if (payment.rent_amount >= 0) message += `🏠 ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
                    if (payment.electricity_amount >= 0) message += `⚡ ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
                    if (payment.water_amount >= 0) message += `💧 ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
                    if (payment.internet_amount > 0) message += `🌐 ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
                    if (payment.common_fee_amount > 0) message += `🧹 ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
                    if (payment.parking_fee_amount > 0) message += `🚗 ค่าที่จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บาท\n`;
                    if (payment.other_amount > 0) message += `📝 ค่าใช้จ่ายอื่นๆ: ${payment.other_amount.toLocaleString()} บาท\n`;

                    message += `━━━━━━━━━━━━━━━━━━━━\n`;
                    message += `💰 รวมทั้งสิ้น: ${payment.total_amount.toLocaleString()} บาท\n`;
                    message += `(${numberToThaiText(payment.total_amount)})\n\n`;
                    message += `📅 ครบกำหนดชำระ: ${dueDateStr}\n`;

                    if (daysOverdue > 0) {
                        message += `⚠️ สถานะ: ${statusText}\n\n`;
                    } else {
                        message += `สถานะ: ${statusText}\n\n`;
                    }

                    message += `💳 โอนเงินได้ที่: ${bankName} ${bankAccountNumber} (${bankAccountName})\n\n`;
                }
            }

            // ⭐ สร้างลิงก์ Public Invoice/Receipt
            // ⚠️ SECURITY: ต้องตั้งค่า frontend_url ใน Config หรือ FRONTEND_URL env variable
            const frontendUrl = getConfigValue('frontend_url', branchId) || Deno.env.get('FRONTEND_URL');

            if (!frontendUrl) {
                console.error(`❌ Missing frontend_url config for branch ${branchId}`);
                throw new Error('FRONTEND_URL not configured. Please set frontend_url in Config or FRONTEND_URL environment variable.');
            }
            
            let documentLink = '';
            
            if (payment.status === 'paid') {
                documentLink = `${frontendUrl}/publicreceipt?id=${payment.id}`;
                console.log(`📄 Receipt link: ${documentLink}`);
            } else {
                documentLink = `${frontendUrl}/publicinvoice?id=${payment.id}`;
                console.log(`📄 Invoice link: ${documentLink}`);
            }

            message += `\n\n📄 ดูเอกสาร: ${documentLink}`;

            if (template !== 'due_date' && template !== 'overdue') {
                message += `\n\n📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\n`;
                message += `ขอบคุณค่ะ 🙏`;
            }

            recipients.push({
                lineUserId: tenant.line_user_id || null,
                facebookUserId: tenant.facebook_user_id || null,
                message: message,
                metadata: {
                    paymentId: payment.id,
                    tenantId: tenant.id,
                    tenantName: tenant.full_name,
                    roomNumber: room?.room_number,
                    branchId: payment.branch_id,
                    platform: tenant.facebook_user_id ? 'facebook' : 'line'
                }
            });
        }

        if (recipients.length === 0) {
            return Response.json({
                success: false,
                message: 'ไม่มีผู้รับที่เชื่อมต่อระบบแชท (LINE/Facebook)'
            });
        }

        console.log(`📤 Sending payment reminders to ${recipients.length} recipients...`);

        // Update bill_sent_date
        const paymentIdsToUpdate = recipients.map(r => r.metadata.paymentId);
        const now = new Date().toISOString();
        const updateBatchSize = 50;
        
        for (let i = 0; i < paymentIdsToUpdate.length; i += updateBatchSize) {
            const batch = paymentIdsToUpdate.slice(i, i + updateBatchSize);
            await Promise.all(
                batch.map(id =>
                    base44.asServiceRole.entities.Payment.update(id, { bill_sent_date: now })
                        .catch(err => console.warn(`⚠️ Failed to update ${id}:`, err.message))
                )
            );
            console.log(`✅ Updated bill_sent_date: ${Math.min(i + updateBatchSize, paymentIdsToUpdate.length)}/${paymentIdsToUpdate.length}`);
        }

        // Send messages
        let successCount = 0;
        let failCount = 0;
        const errors = [];

        const lineRecipients = recipients.filter(r => r.lineUserId);
        const facebookRecipients = recipients.filter(r => r.facebookUserId);

        console.log(`📊 Recipients: ${lineRecipients.length} LINE, ${facebookRecipients.length} Facebook`);

        if (lineRecipients.length > 0) {
            try {
                // ⭐ Clean recipients to avoid circular JSON
                const cleanedRecipients = lineRecipients.map(r => ({
                    lineUserId: r.lineUserId,
                    message: r.message,
                    branchId: r.metadata?.branchId,
                    metadata: {
                        paymentId: r.metadata?.paymentId,
                        tenantId: r.metadata?.tenantId,
                        tenantName: r.metadata?.tenantName,
                        roomNumber: r.metadata?.roomNumber,
                        branchId: r.metadata?.branchId,
                        platform: r.metadata?.platform
                    }
                }));

                const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                    recipients: cleanedRecipients,
                    options: {
                        batchSize: 10,
                        delayBetweenBatches: 2000,
                        delayBetweenMessages: 200,
                        retryAttempts: 2
                    }
                });

                const result = batchResult.data;
                console.log('✅ Batch result:', { success: result.success, failed: result.failed, total: lineRecipients.length });

                successCount += result.success || 0;
                failCount += result.failed || 0;
                if (result.errors) errors.push(...result.errors);

                console.log(`✅ LINE: ${result.success}/${lineRecipients.length} sent`);

                // 🚨 Alert if critical failure
                if (result.failed > 0 && result.failed / lineRecipients.length > 0.3) {
                    console.error(`🚨 CRITICAL: LINE send failure rate ${Math.round((result.failed/lineRecipients.length)*100)}% (${result.failed}/${lineRecipients.length})`);
                    await base44.asServiceRole.entities.FunctionLog.create({
                        function_name: 'sendPaymentReminder',
                        run_timestamp: new Date().toISOString(),
                        status: 'error',
                        message: `LINE send critical failure: ${result.failed}/${lineRecipients.length} failed`,
                        details: { errors: result.errors?.slice(0, 5) }
                    }).catch(err => console.warn('Failed to log error:', err));
                }
            } catch (lineError) {
                console.error('❌ LINE batch send failed:', lineError);
                failCount += lineRecipients.length;

                // 🚨 Log critical error
                await base44.asServiceRole.entities.FunctionLog.create({
                    function_name: 'sendPaymentReminder',
                    run_timestamp: new Date().toISOString(),
                    status: 'error',
                    message: `LINE batch send exception: ${lineError.message}`,
                    details: { error: lineError.toString(), recipients: lineRecipients.length }
                }).catch(err => console.warn('Failed to log error:', err));
            }
        }

        if (facebookRecipients.length > 0) {
            try {
                const fbResult = await base44.asServiceRole.functions.invoke('sendFacebookPaymentReminder', {
                    recipients: facebookRecipients
                });

                const result = fbResult.data;
                successCount += result.success || 0;
                failCount += result.failed || 0;
                if (result.errors) errors.push(...result.errors);

                console.log(`✅ Facebook: ${result.success}/${facebookRecipients.length} sent`);

                // 🚨 Alert if critical failure
                if (result.failed > 0 && result.failed / facebookRecipients.length > 0.3) {
                    console.error(`🚨 CRITICAL: Facebook send failure rate ${Math.round((result.failed/facebookRecipients.length)*100)}% (${result.failed}/${facebookRecipients.length})`);
                    await base44.asServiceRole.entities.FunctionLog.create({
                        function_name: 'sendPaymentReminder',
                        run_timestamp: new Date().toISOString(),
                        status: 'error',
                        message: `Facebook send critical failure: ${result.failed}/${facebookRecipients.length} failed`,
                        details: { errors: result.errors?.slice(0, 5) }
                    }).catch(err => console.warn('Failed to log error:', err));
                }
            } catch (fbError) {
                console.error('❌ Facebook batch send failed:', fbError);
                failCount += facebookRecipients.length;

                // 🚨 Log critical error
                await base44.asServiceRole.entities.FunctionLog.create({
                    function_name: 'sendPaymentReminder',
                    run_timestamp: new Date().toISOString(),
                    status: 'error',
                    message: `Facebook batch send exception: ${fbError.message}`,
                    details: { error: fbError.toString(), recipients: facebookRecipients.length }
                }).catch(err => console.warn('Failed to log error:', err));
            }
        }

        const result = { success: successCount, failed: failCount, total: recipients.length, errors };

        return Response.json({
            success: true,
            message: `ส่งข้อความสำเร็จ ${result.success}/${result.total} รายการ`,
            sent: result.success,
            failed: result.failed,
            total: recipients.length,
            errors: result.errors
        });

    } catch (error) {
        console.error('Error in sendPaymentReminder:', error);
        return Response.json({
            error: error.message
        }, { status: 500 });
    }
});