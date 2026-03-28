import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

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

// ⭐ V2.1 - Fixed: Invoice links removed from overdue/due_date templates
Deno.serve(async (req) => {
    const START_TIME = Date.now();
    const SAFETY_LIMIT_MS = 85 * 1000;
    
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

        // 🔧 Helper function: ประกาศก่อนใช้งานเพื่อป้องกัน hoisting error
        const getConfigValue = (key, branchId, defaultValue = '') => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig?.value) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

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
            // ดึงเฉพาะ branch นั้น + Pagination
            const [configResults, ...data] = await Promise.all([
                base44.asServiceRole.entities.Config.list(),
                (async () => {
                    const result = [];
                    let offset = 0;
                    const limit = 500;
                    while (true) {
                        const chunk = await base44.asServiceRole.entities.Tenant.filter({ branch_id }, '-id', limit, offset);
                        if (chunk.length === 0) break;
                        result.push(...chunk);
                        offset += limit;
                        if (chunk.length < limit) break;
                    }
                    return result;
                })(),
                (async () => {
                    const result = [];
                    let offset = 0;
                    const limit = 500;
                    while (true) {
                        const chunk = await base44.asServiceRole.entities.Room.filter({ branch_id }, '-id', limit, offset);
                        if (chunk.length === 0) break;
                        result.push(...chunk);
                        offset += limit;
                        if (chunk.length < limit) break;
                    }
                    return result;
                })()
            ]);

            configs = configResults;
            allTenants = data[0] || [];
            allRooms = data[1] || [];

            // 🛡️ Safety Check: Validate Bank Config (STRICT - NO FALLBACK)
            const bankNameConf = configs.find(c => c.key === 'bank_name' && c.branch_id === branch_id);
            const accNumConf = configs.find(c => c.key === 'bank_account_number' && c.branch_id === branch_id);
            const accNameConf = configs.find(c => c.key === 'bank_account_name' && c.branch_id === branch_id);

            if (!bankNameConf?.value || !accNumConf?.value || !accNameConf?.value) {
                console.error(`❌ Missing strict bank config for branch ${branch_id} - ABORT`);
                return Response.json({
                    success: false,
                    error: 'MISSING_BANK_CONFIG',
                    message: '⚠️ ยังไม่ได้ตั้งค่าบัญชีธนาคารสำหรับสาขานี้',
                    details: 'กรุณาไปที่ Settings → แท็บ "ธนาคาร" เพื่อตั้งค่า:\n• ชื่อธนาคาร\n• เลขที่บัญชี\n• ชื่อบัญชี\n\n(ระบบไม่อนุญาตให้ใช้ข้อมูลธนาคารของสาขาอื่น)',
                    action: 'กรุณาตั้งค่าก่อนส่ง reminder'
                }, { status: 400 });
            }

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

        let paymentsToSend = allPayments;

        if (paymentsToSend.length === 0) {
            return Response.json({
                success: false,
                message: 'ไม่มีรายการที่ต้องส่ง'
            });
        }

        console.log(`📤 Processing ${paymentsToSend.length} payments...`);

        const recipients = [];
        
        // ⭐ Cache tiered configs + fees per day OUTSIDE the loop (O(1) instead of O(n))
        const tiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === branch_id) 
            || configs.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
        const tiersEnabled = tiersEnabledConfig?.value === 'true';
        
        const tiersConfig = configs.find(c => c.key === 'late_fee_tiers' && c.branch_id === branch_id) 
            || configs.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
        let cachedTiers = null;
        if (tiersConfig?.value) {
            try {
                cachedTiers = JSON.parse(tiersConfig.value);
            } catch {}
        }
        
        const feePerDayConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && c.branch_id === branch_id)
            || configs.find(c => c.key === 'late_payment_fee_per_day' && !c.branch_id);
        const feePerDay = parseFloat(feePerDayConfig?.value || '0');

        for (const payment of paymentsToSend) {
            // 🛑 Safety timeout check
            if (Date.now() - START_TIME > SAFETY_LIMIT_MS) {
                console.error('⚠️ Timeout! Stopping payment processing');
                break;
            }
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

            // ⭐ คำนวณค่าปรับแบบ Smart (ป้องกันคำนวณซ้ำในวันเดียวกัน)
            const branchId = payment.branch_id;
            let calculatedLateFee = 0;

            if (daysOverdue > 0) {
                // 🔒 เช็คว่า admin ล็อคค่าปรับไว้หรือไม่
                if (payment.late_fee_locked === true) {
                    calculatedLateFee = payment.late_fee_amount || 0;
                    console.log(`   🔒 LOCKED by admin: ${calculatedLateFee} บาท (won't recalculate)`);
                    // ไม่ต้องคำนวณใหม่ - ข้ามไปส่วนสร้างข้อความเลย
                } else {
                    // ⭐ เช็คว่าคำนวณค่าปรับไปแล้วในวันนี้หรือยัง (ใช้เวลาไทย)
                    let shouldRecalculate = true;
                    if (payment.late_fee_last_calculated) {
                        // แปลง timestamp ที่บันทึก (UTC) ให้เป็นวันในเวลาไทย
                        const lastCalcDate = new Date(payment.late_fee_last_calculated);
                        const lastCalcThailand = new Date(lastCalcDate.getTime() + (7 * 60 * 60 * 1000));
                        const lastCalcDay = new Date(lastCalcThailand.getFullYear(), lastCalcThailand.getMonth(), lastCalcThailand.getDate());
                        
                        // วันนี้ในเวลาไทย
                        const now = new Date();
                        const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
                        const today = new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate());
                        
                        // ถ้าคำนวณวันนี้แล้ว → ใช้ค่าเดิม (ไม่คำนวณซ้ำ)
                        if (lastCalcDay.getTime() === today.getTime() && payment.late_fee_amount > 0) {
                            shouldRecalculate = false;
                            calculatedLateFee = payment.late_fee_amount;
                            console.log(`   ♻️ Reusing late fee: ${calculatedLateFee} บาท (already calculated today TH)`);
                        }
                    }

                    if (shouldRecalculate) {
                        // ⭐ Use CACHED configs (O(1) - already fetched outside loop)
                        if (tiersEnabled && cachedTiers) {
                            for (const tier of cachedTiers) {
                                const daysFrom = tier.days_from || 1;
                                const daysTo = tier.days_to || 999;
                                const tierFeePerDay = parseFloat(tier.fee_per_day || 0);
                                if (daysOverdue >= daysFrom) {
                                    const daysInTier = Math.min(daysOverdue, daysTo) - daysFrom + 1;
                                    if (daysInTier > 0) calculatedLateFee += daysInTier * tierFeePerDay;
                                }
                                if (daysOverdue <= daysTo) break;
                            }
                        } else if (!isNaN(feePerDay) && feePerDay > 0) {
                            // ⭐ Use CACHED feePerDay
                            calculatedLateFee = daysOverdue * feePerDay;
                        }

                        console.log(`   💰 Calculated late fee: ${calculatedLateFee} บาท (${daysOverdue} วัน)`);

                        const oldLateFee = payment.late_fee_amount || 0;
                        if (calculatedLateFee !== oldLateFee) {
                            const originalAmount = payment.total_amount - oldLateFee;
                            const newTotalAmount = originalAmount + calculatedLateFee;

                            await base44.asServiceRole.entities.Payment.update(payment.id, {
                                late_fee_amount: calculatedLateFee,
                                total_amount: newTotalAmount,
                                status: 'overdue',
                                late_fee_last_calculated: new Date().toISOString()
                            });

                            payment.late_fee_amount = calculatedLateFee;
                            payment.total_amount = newTotalAmount;
                            payment.status = 'overdue';
                        }
                    }
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

            // ⭐ STRICT BANK CONFIG CHECK (NO FALLBACKS)
            const bankNameConf = configs.find(c => c.key === 'bank_name' && c.branch_id === branchId);
            const accNumConf = configs.find(c => c.key === 'bank_account_number' && c.branch_id === branchId);
            const accNameConf = configs.find(c => c.key === 'bank_account_name' && c.branch_id === branchId);
            const qrCodeConf = configs.find(c => c.key === 'payment_qr_code_url' && c.branch_id === branchId) 
                            || configs.find(c => c.key === 'payment_qr_code_url' && !c.branch_id);
            const qrCodeUrl = (qrCodeConf?.value && qrCodeConf.value.trim().startsWith('https')) ? qrCodeConf.value.trim() : null;

            if (!bankNameConf?.value || !accNumConf?.value || !accNameConf?.value) {
                return Response.json({
                    success: false,
                    error: 'MISSING_BANK_CONFIG',
                    message: '⚠️ ยังไม่ได้ตั้งค่าบัญชีธนาคารสำหรับสาขานี้',
                    details: 'กรุณาไปที่ Settings → แท็บ "ธนาคาร" เพื่อตั้งค่า:\n• ชื่อธนาคาร\n• เลขที่บัญชี\n• ชื่อบัญชี\n\n(ระบบไม่อนุญาตให้ใช้ข้อมูลธนาคารของสาขาอื่น)',
                    action: 'กรุณาตั้งค่าก่อนส่ง reminder'
                }, { status: 400 });
            }

            const bankAccountNumber = accNumConf.value;
            const bankAccountName = accNameConf.value;
            const bankName = bankNameConf.value;
            const buildingName = getConfigValue('building_name', branchId, 'ที่พัก');

            // --- ส่วนสร้างข้อความ ---
            let message = '';

            console.log(`📝 Message template for payment ${payment.id}: "${template}", customMessage: ${!!customMessage}`);

            if (customMessage && customMessage.trim()) {
                message = customMessage.trim();
                message += `\n\nโอนเงินได้ที่: ${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}`;
            } else {
                const roomNum = room?.room_number || 'N/A';
                const lateFee = calculatedLateFee;
                const originalAmount = payment.total_amount - (payment.late_fee_amount || 0);
                const totalWithLateFee = originalAmount + lateFee;

                // ⭐ Use CACHED configs (already fetched outside loop)
                let lateFeeStructure = null;
                if (tiersEnabled && cachedTiers) {
                    lateFeeStructure = cachedTiers;
                }

                if (template === 'overdue') {
                    // --- CASE 1: เกินกำหนด (ไม่มีลิงก์) ---
                    console.log(`📝 Using OVERDUE template (NO LINK) for payment ${payment.id}`);
                    message = `📢 แจ้งเตือนค่าเช่าเกินกำหนด\n\n`;
                    message += `${buildingName}\n`;
                    message += `คุณ ${tenant.full_name} ห้อง ${roomNum}\n`;
                    message += `ยอดเงิน: ${originalAmount.toLocaleString()} บาท`;
                    if (lateFee > 0) {
                        message += `\nค่าปรับล่าช้า: ${lateFee.toLocaleString()} บาท`;
                    }
                    message += `\nรวมทั้งสิ้น: ${totalWithLateFee.toLocaleString()} บาท`;
                    message += `\nเกินกำหนดมาแล้ว ${daysOverdue} วัน\n\n`;
                    message += `⚠️ ดำเนินการชำระยอดคงค้างดังกล่าว เพื่อเป็นการหยุดการคำนวณค่าปรับล่าช้าที่จะเพิ่มขึ้น\n\n`;
                    message += `💳 โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
                    message += `กรุณาส่งหลักฐานการโอนหลังชำระเงิน\nขอบคุณครับ 🙏`;

                } else if (template === 'due_date') {
                    // --- CASE 2: ครบกำหนด (ไม่มีลิงก์) ---
                    console.log(`📝 Using DUE_DATE template (NO LINK) for payment ${payment.id}`);
                    message = `📅 แจ้งเตือนค่าเช่า (ครบกำหนดวันนี้)\n\n`;
                    message += `${buildingName}\n`;
                    message += `คุณ ${tenant.full_name} ห้อง ${roomNum}\n\n`;
                    
                    // รายละเอียดค่าใช้จ่าย
                    message += `รายละเอียดค่าใช้จ่าย:\n`;
                    message += `━━━━━━━━━━━━━━━━━━━━\n`;
                    
                    if (payment.rent_amount >= 0) message += `🏠 ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
                    if (payment.electricity_amount >= 0) message += `⚡ ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
                    if (payment.water_amount >= 0) message += `💧 ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
                    if (payment.internet_amount > 0) message += `🌐 ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
                    if (payment.common_fee_amount > 0) message += `🧹 ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
                    if (payment.parking_fee_amount > 0) message += `🚗 ค่าที่จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บาท\n`;
                    if (payment.other_amount > 0) message += `📦 ค่าใช้จ่ายอื่นๆ: ${payment.other_amount.toLocaleString()} บาท\n`;
                    
                    message += `━━━━━━━━━━━━━━━━━━━━\n`;
                    message += `💰 รวมทั้งสิ้น: ${payment.total_amount.toLocaleString()} บาท\n`;
                    message += `(${numberToThaiText(payment.total_amount)})\n\n`;
                    
                    // ⭐ แจ้งค่าปรับแบบขั้นบันได (ถ้ามี)
                    if (lateFeeStructure && Array.isArray(lateFeeStructure) && lateFeeStructure.length > 0) {
                        message += `⚠️ ค่าปรับชำระล่าช้า:\n`;
                        lateFeeStructure.forEach((tier) => {
                            if (tier.days_from !== undefined && tier.days_to !== undefined) {
                                // ถ้า days_to >= 999 แสดง "เป็นต้นไป"
                                if (tier.days_to >= 999) {
                                    message += `   วันที่ ${tier.days_from} เป็นต้นไป: ${tier.fee_per_day} บาท/วัน\n`;
                                } else {
                                    message += `   วันที่ ${tier.days_from}-${tier.days_to}: ${tier.fee_per_day} บาท/วัน\n`;
                                }
                            } else if (tier.days_from !== undefined) {
                                message += `   วันที่ ${tier.days_from} เป็นต้นไป: ${tier.fee_per_day} บาท/วัน\n`;
                            }
                        });
                        message += `\n`;
                    } else if (!isNaN(feePerDay) && feePerDay > 0) {
                        message += `⚠️ หากชำระหลังวันนี้ มีค่าปรับ ${feePerDay} บาท/วัน\n\n`;
                    }
                    
                    message += `💳 โอนเงินได้ที่:\n`;
                    message += `${bankName} ${bankAccountNumber}\n`;
                    message += `ชื่อบัญชี: ${bankAccountName}\n\n`;
                    message += `📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;

                } else {
                    // --- CASE 3: ปกติ (Advance/General) - มีลิงก์ + ธนาคาร ---
                    console.log(`📝 Using ADVANCE/GENERAL template (WITH LINK) for payment ${payment.id}`);
                    const frontendUrl = Deno.env.get('FRONTEND_URL');
                    const paymentBranchId = payment.branch_id || branchId;
                    const invoiceLink = frontendUrl ? `${frontendUrl}publicinvoice?id=${payment.id}&branchId=${paymentBranchId}` : null;
                    console.log(`🔗 Invoice link generated: ${invoiceLink || 'N/A'}`);

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
                    if (payment.other_amount > 0) message += `📦 ค่าใช้จ่ายอื่นๆ: ${payment.other_amount.toLocaleString()} บาท\n`;

                    message += `━━━━━━━━━━━━━━━━━━━━\n`;
                    message += `💰 รวมทั้งสิ้น: ${payment.total_amount.toLocaleString()} บาท\n`;
                    message += `(${numberToThaiText(payment.total_amount)})\n\n`;
                    message += `📅 ครบกำหนดชำระ: ${dueDateStr}\n`;
                    message += `สถานะ: ${statusText}\n\n`;
                    message += `💳 โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
                    if (invoiceLink) {
                        message += `📄 ดูรายละเอียดบิล:\n${invoiceLink}\n\n`;
                    }
                    message += `📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
                }
                }

                recipients.push({
                lineUserId: tenant.line_user_id || null,
                facebookUserId: tenant.facebook_user_id || null,
                message: message,
                imageUrl: (template === 'overdue' || template === 'due_date') ? null : qrCodeUrl,
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

        // ⭐ CRITICAL: ตรวจสอบว่ามี LINE token หรือไม่ (ถ้ามีคนใช้ LINE)
        const lineRecipients = recipients.filter(r => r.lineUserId);
        if (lineRecipients.length > 0) {
            const lineToken = await getLineToken(base44, branch_id);
            if (!lineToken) {
                console.error('❌ CRITICAL: No LINE token configured - cannot send reminders');
                return Response.json({
                    success: false,
                    error: 'MISSING_LINE_CONFIG',
                    message: '⚠️ ยังไม่ได้ตั้งค่า LINE Official Account',
                    details: `ระบบไม่สามารถส่งข้อความ LINE ได้ เนื่องจากยังไม่มีการตั้งค่า LINE Channel Access Token\n\nกรุณาไปที่:\nSettings → แท็บ "ช่องทางสื่อสาร" → LINE → กรอก Channel Access Token`,
                    action: 'กรุณาตั้งค่า LINE ก่อนส่ง reminder',
                    recipients_affected: lineRecipients.length
                }, { status: 400 });
            }
        }

        // Send messages FIRST
        let successCount = 0;
        let failCount = 0;
        const errors = [];
        const successfulPaymentIds = []; // เก็บ ID ของบิลที่ส่งสำเร็จเพื่อนำไปอัปเดตสถานะ

        // ⭐ ลบออก - เช็คก่อนหน้านี้แล้ว
        const facebookRecipients = recipients.filter(r => r.facebookUserId);

        console.log(`📊 Recipients: ${lineRecipients.length} LINE, ${facebookRecipients.length} Facebook`);

        if (lineRecipients.length > 0) {
            try {
                // ⭐ Clean recipients to avoid circular JSON
                const cleanedRecipients = lineRecipients.map(r => ({
                    lineUserId: r.lineUserId,
                    message: r.message,
                    imageUrl: r.imageUrl,
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
                if (result.errors && result.errors.length > 0) {
                    console.error('❌ LINE Send Errors:', JSON.stringify(result.errors, null, 2));
                }

                successCount += result.success || 0;
                failCount += result.failed || 0;
                if (result.errors) errors.push(...result.errors);

                // ดึงเฉพาะ Payment ID ที่ส่งสำเร็จ (เพื่อนำไปอัปเดต)
                // ถ้า sendBatchLineMessages คืนค่า successful_recipients มาให้ ก็ใช้จากนั้น ถ้าไม่มี ก็หักลบจากตัว error
                if (result.successful_recipients && Array.isArray(result.successful_recipients)) {
                     // สมมติว่า response กลับมาเป็น array ของ lineUserId
                     const successIds = cleanedRecipients
                        .filter(r => result.successful_recipients.includes(r.lineUserId))
                        .map(r => r.metadata.paymentId);
                     successfulPaymentIds.push(...successIds);
                } else {
                     // ถ้าไม่ส่งรายการคนสำเร็จมาให้ ต้องหาเอาเองโดยเอาทั้งหมด ลบด้วยคนที่ error
                     // แก้ไขให้รองรับกรณี rate limit (error เป็น string)
                     const failedUserIds = (result.errors || []).map(err => {
                         if (typeof err === 'object' && err.lineUserId) return err.lineUserId;
                         // ถ้า error ไม่มี lineUserId ระบุชัดเจน (เช่น 429 Too Many Requests)
                         // ถือว่า fail ทั้ง batch เพื่อความปลอดภัย (ไม่ mark ว่าส่งแล้ว)
                         return null;
                     }).filter(Boolean);
                     
                     // ถ้าระบบบอกว่า failed เยอะ (เช่นติด rate limit) แต่ไม่ได้ระบุ userId 
                     // เราจะถือว่าไม่ได้ส่งสำเร็จเลย
                     if (result.failed > 0 && failedUserIds.length === 0) {
                         console.warn('⚠️ Could not map errors to specific users, assuming all failed in this batch to be safe');
                         // ถ้ามี success > 0 ให้ถือว่าสำเร็จทั้งหมดที่มีลบด้วยที่ failed แต่เดาไม่ได้ว่าใคร
                         // เพื่อความปลอดภัย ไม่ push ใครเลย (ป้องกันการ mark บิลว่าส่งแล้วทั้งๆที่ล้มเหลว)
                     } else {
                         const successIds = cleanedRecipients
                            .filter(r => !failedUserIds.includes(r.lineUserId))
                            .map(r => r.metadata.paymentId);
                         successfulPaymentIds.push(...successIds);
                     }
                }

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

                    // ส่งอีเมลแจ้งเตือน
                    try {
                        await base44.integrations.Core.SendEmail({
                            to: 'phupha20517@gmail.com',
                            subject: '🚨 Critical LINE Send Failure',
                            body: `เกิดความล้มเหลวร้ายแรงในการส่งข้อความ LINE\n\nอัตราความล้มเหลว: ${Math.round((result.failed/lineRecipients.length)*100)}%\nล้มเหลว: ${result.failed}/${lineRecipients.length} ข้อความ\n\nBranch: ${branch_id || 'N/A'}\n\nErrors:\n${JSON.stringify(result.errors?.slice(0, 3), null, 2)}`
                        });
                    } catch (e) {
                        console.error('Failed to send LINE critical failure email:', e);
                    }
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

                // ส่งอีเมลแจ้งเตือน
                try {
                    await base44.integrations.Core.SendEmail({
                        to: 'phupha20517@gmail.com',
                        subject: '🚨 LINE Batch Send Exception',
                        body: `การส่งข้อความ LINE ล้มเหลวทั้งหมด\n\nError: ${lineError.message}\n\nRecipients: ${lineRecipients.length}\nBranch: ${branch_id || 'N/A'}\n\nStack:\n${lineError.stack}`
                    });
                } catch (e) {
                    console.error('Failed to send LINE exception email:', e);
                }
            }
        }

        if (facebookRecipients.length > 0) {
            try {
                const fbResult = await base44.asServiceRole.functions.invoke('sendFacebookPaymentReminder', {
                    recipients: facebookRecipients
                });

                const result = fbResult.data;
                successCount += result.successCount || 0;
                failCount += result.failCount || 0;
                if (result.errors) errors.push(...result.errors);

                // หาบิลที่ส่งสำเร็จ
                const failedFBUserIds = (result.errors || []).map(err => {
                    if (typeof err === 'object' && err.recipientId) return err.recipientId;
                    return null;
                }).filter(Boolean);
                
                if (result.failCount > 0 && failedFBUserIds.length === 0) {
                     console.warn('⚠️ FB: Could not map errors to specific users, assuming all failed in this batch to be safe');
                } else {
                     const successFBIds = facebookRecipients
                        .filter(r => !failedFBUserIds.includes(r.facebookUserId))
                        .map(r => r.metadata.paymentId);
                     successfulPaymentIds.push(...successFBIds);
                }

                console.log(`✅ Facebook: ${result.successCount || 0}/${facebookRecipients.length} sent`);
                if (result.errors && result.errors.length > 0) {
                    console.error('❌ Facebook Send Errors:', JSON.stringify(result.errors, null, 2));
                }

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

                    // ส่งอีเมลแจ้งเตือน
                    try {
                        await base44.integrations.Core.SendEmail({
                            to: 'phupha20517@gmail.com',
                            subject: '🚨 Critical Facebook Send Failure',
                            body: `เกิดความล้มเหลวร้ายแรงในการส่งข้อความ Facebook\n\nอัตราความล้มเหลว: ${Math.round((result.failed/facebookRecipients.length)*100)}%\nล้มเหลว: ${result.failed}/${facebookRecipients.length} ข้อความ\n\nBranch: ${branch_id || 'N/A'}\n\nErrors:\n${JSON.stringify(result.errors?.slice(0, 3), null, 2)}`
                        });
                    } catch (e) {
                        console.error('Failed to send Facebook critical failure email:', e);
                    }
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

                // ส่งอีเมลแจ้งเตือน
                try {
                    await base44.integrations.Core.SendEmail({
                        to: 'phupha20517@gmail.com',
                        subject: '🚨 Facebook Batch Send Exception',
                        body: `การส่งข้อความ Facebook ล้มเหลวทั้งหมด\n\nError: ${fbError.message}\n\nRecipients: ${facebookRecipients.length}\nBranch: ${branch_id || 'N/A'}\n\nStack:\n${fbError.stack}`
                    });
                } catch (e) {
                    console.error('Failed to send Facebook exception email:', e);
                }
            }
        }

        // ⭐ อัปเดต bill_sent_date และ overdue_reminder_sent_date เฉพาะบิลที่ส่งสำเร็จจริงๆ
        if (successfulPaymentIds.length > 0) {
            console.log(`📝 Updating sent dates for ${successfulPaymentIds.length} successful payments...`);
            const now = new Date().toISOString();
            const updateBatchSize = 100;
            
            const updatePayload = { bill_sent_date: now };
            if (template === 'overdue') {
                updatePayload.overdue_reminder_sent_date = now;
            }

            for (let i = 0; i < successfulPaymentIds.length; i += updateBatchSize) {
                const batch = successfulPaymentIds.slice(i, i + updateBatchSize);
                await Promise.all(
                    batch.map(id =>
                        base44.asServiceRole.entities.Payment.update(id, updatePayload)
                            .catch(err => console.warn(`⚠️ Failed to update ${id}:`, err.message))
                    )
                );
                console.log(`✅ Updated payment dates: ${Math.min(i + updateBatchSize, successfulPaymentIds.length)}/${successfulPaymentIds.length}`);
            }
        } else {
            console.log('⚠️ No successful payments to update dates.');
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
        
        // 🚨 ส่งอีเมลแจ้งเตือนเมื่อเกิดข้อผิดพลาดร้ายแรง
        try {
            const base44 = createClientFromRequest(req);
            await base44.integrations.Core.SendEmail({
                to: 'phupha20517@gmail.com',
                subject: '🚨 Error in sendPaymentReminder Function',
                body: `เกิดข้อผิดพลาดในฟังก์ชัน sendPaymentReminder\n\nError Message: ${error.message}\n\nStack Trace:\n${error.stack}\n\nTimestamp: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`
            });
        } catch (emailError) {
            console.error('Failed to send error notification email:', emailError);
        }
        
        return Response.json({
            error: error.message
        }, { status: 500 });
    }
});