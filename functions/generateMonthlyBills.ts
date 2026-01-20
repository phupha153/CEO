import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { format } from 'npm:date-fns@3.0.0';

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
            } else if (position === 0 && digit === 1 && len > 1 && parseInt(numStr[len - 2]) !== 0) {
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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async (fn, maxRetries = 5, baseDelay = 2000) => {
    let lastError;
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const isRateLimit = error.message?.includes('429') ||
                error.message?.includes('Too Many Requests') ||
                error.message?.includes('Rate limit') ||
                error.message?.includes('fetch failed');

            if (isRateLimit) {
                const waitTime = baseDelay * Math.pow(2, i);
                console.log(`⚠️ Rate limit/Network error. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${maxRetries})`);
                await delay(waitTime);
                continue;
            }
            throw error;
        }
    }
    throw lastError;
};

Deno.serve(async (req) => {
    console.log('========================================');
    console.log('🚀 STARTING BILL GENERATION');
    console.log('========================================');
    console.log('⬇️ SCROLL DOWN TO SEE PAYMENT DEBUG ⬇️');
    console.log('========================================');

    const startTime = Date.now();
    const MAX_BILLS_PER_RUN = 1000; // ⭐ จำกัดสร้างแค่ 1000 บิล/รอบ เพื่อป้องกัน rate limit

    let base44 = null;
    let targetBranchId = null;
    let jobId = null;
    let forceCreate = false;
    let resendNotifications = false;
    let forceSkipDuplicateCheck = false;

    try {
        const clonedReq = req.clone();
        base44 = createClientFromRequest(req);

        // 🔒 Security: Authentication Check
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

        try {
            const text = await clonedReq.text();
            if (text && text.trim()) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
                forceCreate = body.force === true;
                resendNotifications = body.resend_notifications === true;
                forceSkipDuplicateCheck = body.force_skip_duplicate_check === true;
            }
        } catch (e) {
            console.log('⚠️ No valid JSON body or already consumed');
        }

        // 🔒 Security: Branch Access Check
        if (targetBranchId) {
            const userAccessibleBranches = user.accessible_branches;
            const isDeveloper = user.custom_role === 'developer';
            const isOwner = user.custom_role === 'owner';
            
            if (!isDeveloper && !isOwner) {
                if (userAccessibleBranches && !userAccessibleBranches.includes(targetBranchId)) {
                    return Response.json({ error: 'Branch access denied' }, { status: 403 });
                }
            }
        }

        console.log('📋 Target:', targetBranchId || 'ALL');

        // 1. Fetch Configs
        const configs = await base44.asServiceRole.entities.Config.list() || [];
        const getConfigValue = (key, defaultValue, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        // 2. Check Date
        const now = new Date();
        const thFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const thDateParts = thFormatter.formatToParts(now);
        const currentYear = parseInt(thDateParts.find(p => p.type === 'year').value);
        const currentMonth = parseInt(thDateParts.find(p => p.type === 'month').value) - 1;
        const currentDay = parseInt(thDateParts.find(p => p.type === 'day').value);
        const thailandTime = new Date(currentYear, currentMonth, currentDay);

        console.log(`🕐 Server UTC time: ${now.toISOString()}`);
        console.log(`🇹🇭 Thailand date: ${currentDay}/${currentMonth + 1}/${currentYear}`);

        // 3. Fetch Data
        let allRooms = [], bookings = [], meterReadings = [], tenants = [];
        let existingPaymentsMap = new Map();

// ⭐ แก้ไขจุดที่ 1: อัปเกรดฟังก์ชันให้หยุดได้ (Smart Pagination)
        async function fetchWithPagination(entity, filter, sortBy, batchSize = 100, stopCheckFn = null) {
            let allData = [];
            let skip = 0;
            let iteration = 0;
            const MAX_ITERATIONS = 300; 

            while (iteration < MAX_ITERATIONS) {
                iteration++;
                const batch = await entity.filter(filter, sortBy, batchSize, skip);
                const batchLength = Array.isArray(batch) ? batch.length : 0;

                if (batchLength === 0) break;

                // Logic การหยุด: เช็คตัวสุดท้ายของตะกร้า
                if (stopCheckFn && batchLength > 0) {
                    const lastItem = batch[batchLength - 1];
                    if (stopCheckFn(lastItem)) {
                        allData = allData.concat(batch);
                        console.log(`   🛑 Cutoff condition met. Stopping fetch.`);
                        break;
                    }
                }

                allData = allData.concat(batch);
                skip += batchLength;
                await delay(200); 
            }
            return allData;
        }

        // STEP 1: Fetch rooms and bookings - ใช้ limit สูงสุด
        console.log('📦 Step 1: Fetching all data...');

        const filter = targetBranchId ? { branch_id: targetBranchId } : {};

        // ⭐ Fetch Rooms แบบ pagination เต็มรูปแบบ
        console.log('📦 Step 1a: Fetching ALL rooms...');
        let roomSkip = 0;
        let fetchingRooms = true;

        while (fetchingRooms) {
            await retryOperation(async () => {
                const batch = await base44.asServiceRole.entities.Room.filter(filter, '-room_number', 500, roomSkip);
                const batchLength = Array.isArray(batch) ? batch.length : 0;
                console.log(`   🏠 Rooms batch: ${batchLength} items (skip: ${roomSkip}, total: ${allRooms.length + batchLength})`);

                if (batchLength > 0) {
                    allRooms = allRooms.concat(batch);
                    roomSkip += batchLength;
                }

                if (batchLength < 500) {
                    fetchingRooms = false;
                }
            });

            if (fetchingRooms) await delay(500);
        }

        console.log(`✅ Total rooms: ${allRooms.length}`);
        await delay(200);

        // ⭐ Fetch Bookings แบบ pagination เต็มรูปแบบ
        console.log('📦 Step 1b: Fetching ALL active bookings...');
        let bookingSkip = 0;
        let fetchingBookings = true;
        const bookingFilter = { ...filter, status: 'active' };

        while (fetchingBookings) {
            await retryOperation(async () => {
                const batch = await base44.asServiceRole.entities.Booking.filter(bookingFilter, '-created_date', 500, bookingSkip);
                const batchLength = Array.isArray(batch) ? batch.length : 0;

                if (batchLength > 0) {
                    bookings = bookings.concat(batch);
                    bookingSkip += batchLength;
                }

                if (batchLength < 500) {
                    fetchingBookings = false;
                }
            });

            if (fetchingBookings) await delay(200);
        }

        console.log(`✅ Total bookings: ${bookings.length}`);
        await delay(500); // ⭐ พักหลัง Step 1

        const normalizeEntity = (entity) => {
            if (!entity) return null;
            if (entity.data && typeof entity.data === 'object') {
                return { id: entity.id, ...entity.data };
            }
            return entity;
        };

        allRooms = allRooms.map(normalizeEntity).filter(Boolean);
        bookings = bookings.map(normalizeEntity).filter(Boolean);

        const monthlyRooms = allRooms.filter(room => room.room_type === 'monthly');
        console.log(`🏠 Monthly rooms: ${monthlyRooms.length}`);

        const roomsWithBooking = monthlyRooms.filter(room => {
            return bookings.some(b => b.room_id === room.id);
        });
        console.log(`📋 Rooms with active booking: ${roomsWithBooking.length}`);

        // STEP 2: หาสาขาที่ตรงวันสร้างบิล
        const branchIds = [...new Set(roomsWithBooking.map(r => r.branch_id).filter(Boolean))];
        const branchGenDayMap = {};
        const branchesToProcess = [];
        const branchesSkipped = [];

        for (const branchId of branchIds) {
            const genDayConfig = getConfigValue('bill_generation_day', '27', branchId);
            const genDay = parseInt(genDayConfig);
            branchGenDayMap[branchId] = genDay;

            console.log(`🔍 Branch ${branchId}: genDayConfig="${genDayConfig}", genDay=${genDay}, currentDay=${currentDay}, match=${currentDay === genDay}`);

            if (forceCreate || currentDay === genDay) {
                branchesToProcess.push({ branchId, genDay });
            } else {
                branchesSkipped.push({ branchId, genDay, reason: `วันนี้ (${currentDay}) ไม่ตรงกับวันสร้างบิล (${genDay})` });
            }
        }

        console.log(`📆 สาขาที่จะสร้างบิลวันนี้: ${branchesToProcess.length} สาขา`);
        console.log(`⏭️ สาขาที่ข้าม: ${branchesSkipped.length} สาขา`);

        if (branchesSkipped.length > 0 && branchesSkipped.length <= 5) {
            branchesSkipped.forEach(b => {
                console.log(`   - สาขา ${b.branchId}: ${b.reason}`);
            });
        } else if (branchesSkipped.length > 5) {
            console.log(`   (ข้ามแสดงรายละเอียด - มี ${branchesSkipped.length} สาขา)`);
        }

        const branchIdsToProcess = branchesToProcess.map(b => b.branchId);

        if (branchIdsToProcess.length === 0) {
            const reason = branchesSkipped.length > 0
                ? `ไม่มีสาขาที่ตรงวันสร้างบิลวันนี้ (${currentDay})`
                : 'ไม่มีห้องที่ต้องสร้างบิล';
            console.log(`⏭️ ${reason}`);
            return Response.json({
                success: true,
                message: reason,
                generatedCount: 0
            });
        }

        // STEP 3: ดึงข้อมูลเพิ่มเติม (ทีละสาขา)
        console.log(`📦 Step 3: Fetching data for ${branchIdsToProcess.length} branches...`);

  // ⭐ แก้ไขจุดที่ 2 (STEP 3): ดึง Meter แค่ 90 วันย้อนหลัง
        console.log(`📦 Step 3: Fetching Meters (Last 90 days ONLY)...`);
        
        // กำหนดวันตัดรอบ 90 วัน
        const meterCutoffDate = new Date(); 
        meterCutoffDate.setDate(meterCutoffDate.getDate() - 90);
        const meterCutoffStr = meterCutoffDate.toISOString();

        for (let idx = 0; idx < branchIdsToProcess.length; idx++) {
            const branchId = branchIdsToProcess[idx];
            console.log(`   📥 Branch ${idx + 1}/${branchIdsToProcess.length}...`);

            await retryOperation(async () => {
                const [m, t] = await Promise.all([
                    // ✅ ใช้ fetchWithPagination แบบใหม่ + เงื่อนไขหยุดเมื่อเก่ากว่า 90 วัน
                    fetchWithPagination(
                        base44.asServiceRole.entities.MeterReading, 
                        { branch_id: branchId }, 
                        '-reading_date', 
                        150, 
                        (item) => (item.reading_date || item.created_date) < meterCutoffStr
                    ),
                    // ส่วน Tenant ดึงตามปกติ (ไม่ต้องมีเงื่อนไขหยุด เพราะต้องใช้หาคนปัจจุบัน)
                    fetchWithPagination(base44.asServiceRole.entities.Tenant, { branch_id: branchId }, '-created_date', 150)
                ]);
                meterReadings = meterReadings.concat(m || []);
                tenants = tenants.concat(t || []);
            });
            await delay(300);
        }

        meterReadings = meterReadings.map(normalizeEntity).filter(Boolean);
        tenants = tenants.map(normalizeEntity).filter(Boolean);

        console.log(`📦 Fetched: ${meterReadings.length} meter readings, ${tenants.length} tenants`);
        await delay(500); // ⭐ พักก่อน Step 4

        // STEP 4: ดึง Payment ทั้งหมด (ไม่ใช้ fetchWithPagination)
        console.log(`📦 Step 4: Fetching ALL payments...`);

        let recentPayments = [];

        for (const branchId of branchIdsToProcess) {
            console.log(`   📥 Fetching payments for branch: ${branchId}`);

            let branchPayments = [];
            let paymentSkip = 0;
            let fetchingPayments = true;
            let batchNum = 0;

            while (fetchingPayments && batchNum < 100) {
                batchNum++;

                await retryOperation(async () => {
                    const batch = await base44.asServiceRole.entities.Payment.filter(
                        { branch_id: branchId },
                        '-created_date',
                        300,
                        paymentSkip
                    );

                    const batchLength = Array.isArray(batch) ? batch.length : 0;

                    if (batchLength > 0) {
                        branchPayments = branchPayments.concat(batch);
                        paymentSkip += batchLength;
                    }

                    // ⭐ หยุดเฉพาะเมื่อได้ 0 รายการ
                    if (batchLength === 0) {
                        fetchingPayments = false;
                    }
                });

                if (fetchingPayments) await delay(200);
            }

            console.log(`   ✅ สาขา ${branchId}: ${branchPayments.length} payments`);
            recentPayments = recentPayments.concat(branchPayments);
            await delay(300);
        }

        console.log(`⭐ TOTAL PAYMENTS FETCHED: ${recentPayments.length}`);

        const normalizedPayments = [];

        for (const p of recentPayments) {
            if (!p) continue;

            let roomId, dueDate, bookingId, status, totalAmount;

            if (p.data && typeof p.data === 'object') {
                roomId = p.data.room_id;
                dueDate = p.data.due_date;
                bookingId = p.data.booking_id;
                status = p.data.status;
                totalAmount = p.data.total_amount;
            } else {
                roomId = p.room_id;
                dueDate = p.due_date;
                bookingId = p.booking_id;
                status = p.status;
                totalAmount = p.total_amount;
            }

            if (!roomId || !dueDate) continue;

            normalizedPayments.push({
                id: p.id,
                room_id: roomId,
                due_date: dueDate,
                booking_id: bookingId,
                status: status,
                total_amount: totalAmount,
            });
        }

        console.log(`📊 Normalized: ${normalizedPayments.length} payments`);

        for (const p of normalizedPayments) {
            if (!p.due_date) continue;

            const dueYearMonth = p.due_date.substring(0, 7);
            const mapKey = `${p.room_id}|${dueYearMonth}`;

            if (!existingPaymentsMap.has(mapKey)) {
                existingPaymentsMap.set(mapKey, p);
            }
        }

        console.log(`🗺️ Existing payments map: ${existingPaymentsMap.size} entries`);

        let roomsToProcess = roomsWithBooking.filter(room => {
            return branchIdsToProcess.includes(room.branch_id);
        });

        console.log(`✅ Rooms to process: ${roomsToProcess.length}`);

        // 4. Prepare Payments
        const paymentsToCreate = [];
        const updatesToProcess = [];
        const billsToSend = [];
        let skippedDueToExistingBill = 0;
        let skippedDueToLimit = 0;
        const paymentReferenceMap = new Map();

        for (const room of roomsToProcess) {
            // ⭐ ถ้าเกิน limit แล้ว ให้หยุดเตรียมบิล
            if (paymentsToCreate.length >= MAX_BILLS_PER_RUN) {
                skippedDueToLimit++;
                continue;
            }
            try {
                const activeBooking = bookings.find(b => b.room_id === room.id && b.status === 'active');
                if (!activeBooking) continue;

                const roomBranchId = room.branch_id;
                const roomPayDay = parseInt(getConfigValue('pay_day', '5', roomBranchId));

                let roomDueYear = currentYear;
                let roomDueMonth = currentMonth;
                const roomGenDay = parseInt(getConfigValue('bill_generation_day', '27', roomBranchId));

                if (roomGenDay > roomPayDay) {
                    roomDueMonth = currentMonth + 1;
                    if (roomDueMonth > 11) { roomDueMonth = 0; roomDueYear = currentYear + 1; }
                }

                const targetDueYearMonth = `${roomDueYear}-${String(roomDueMonth + 1).padStart(2, '0')}`;
                const mapKey = `${room.id}|${targetDueYearMonth}`;

                // ⭐ สร้าง dueDate object สำหรับใช้ใน format()
                const dueDate = new Date(roomDueYear, roomDueMonth, roomPayDay);

                if (!forceSkipDuplicateCheck) {
                    let existingBill = existingPaymentsMap.get(mapKey) || null;

                    if (!existingBill) {
                        for (const p of normalizedPayments) {
                            if (p.room_id === room.id && p.due_date && p.due_date.substring(0, 7) === targetDueYearMonth) {
                                existingBill = p;
                                break;
                            }
                        }
                    }

                    if (existingBill) {
                        skippedDueToExistingBill++;

                        if (resendNotifications) {
                            const tenant = tenants.find(t => t.id === activeBooking.tenant_id);
                            if (tenant?.line_user_id) {
                                billsToSend.push({ payment: existingBill, tenant, room });
                            }
                        }
                        continue;
                    }
                }

                const roomMeters = meterReadings.filter(m => m.room_id === room.id);
                roomMeters.sort((a, b) => new Date(b.created_date || b.reading_date) - new Date(a.created_date || a.reading_date));

                let latestMeter = roomMeters.find(m => (m.water_units > 0 || m.electricity_units > 0)) || roomMeters[0] || null;

                let waterUnits = latestMeter?.water_units || 0;
                let elecUnits = latestMeter?.electricity_units || 0;

                const waterRate = (room.water_rate !== undefined && room.water_rate !== null)
                    ? parseFloat(room.water_rate)
                    : parseFloat(getConfigValue('water_rate', '18', roomBranchId));
                const elecRate = (room.electricity_rate !== undefined && room.electricity_rate !== null)
                    ? parseFloat(room.electricity_rate)
                    : parseFloat(getConfigValue('electricity_rate', '7', roomBranchId));
                const commonFee = (room.common_fee !== undefined && room.common_fee !== null)
                    ? parseFloat(room.common_fee)
                    : parseFloat(getConfigValue('common_fee', '0', roomBranchId));

                const internetRate = parseFloat(getConfigValue('internet_rate', '0', roomBranchId));
                const carFee = parseFloat(getConfigValue('car_parking_fee', '0', roomBranchId));
                const motoFee = parseFloat(getConfigValue('motorcycle_parking_fee', '0', roomBranchId));

                let waterMinimumApplied = false;
                let electricityMinimumApplied = false;
                let waterMinimumCharge = 0;
                let electricityMinimumCharge = 0;
                const originalWaterUnits = waterUnits;
                const originalElecUnits = elecUnits;

                const waterMinEnabled = getConfigValue('water_minimum_enabled', 'false', roomBranchId) === 'true';
                if (waterMinEnabled) {
                    const minUnits = parseFloat(getConfigValue('water_minimum_units', '3', roomBranchId));
                    const minCharge = parseFloat(getConfigValue('water_minimum_charge', '0', roomBranchId));
                    if (waterUnits <= minUnits && minCharge > 0) {
                        waterMinimumCharge = minCharge;
                        waterMinimumApplied = true;
                    }
                }

                const elecMinEnabled = getConfigValue('electricity_minimum_enabled', 'false', roomBranchId) === 'true';
                if (elecMinEnabled) {
                    const minUnits = parseFloat(getConfigValue('electricity_minimum_units', '3', roomBranchId));
                    const minCharge = parseFloat(getConfigValue('electricity_minimum_charge', '0', roomBranchId));
                    if (elecUnits <= minUnits && minCharge > 0) {
                        electricityMinimumCharge = minCharge;
                        electricityMinimumApplied = true;
                    }
                }

                const tenant = tenants.find(t => t.id === activeBooking.tenant_id);

                if (!tenant || tenant.status === 'moved_out') {
                    console.log(`⏭️ Room ${room.room_number}: Tenant moved out - skip`);
                    continue;
                }

                let parkingAmount = 0;
                let parkingDetails = '';
                if (tenant?.vehicles?.length > 0) {
                    const cars = tenant.vehicles.filter(v => v.type === 'car').length;
                    const motos = tenant.vehicles.filter(v => v.type === 'motorcycle').length;
                    parkingAmount = (cars * carFee) + (motos * motoFee);
                    if (cars > 0 || motos > 0) parkingDetails = `รถยนต์ ${cars}, มอเตอร์ไซค์ ${motos}`;
                }

                let otherMonthlyFeesAmount = 0;
                let otherFeesDetails = '';

                if (room.other_monthly_fees && Array.isArray(room.other_monthly_fees)) {
                    room.other_monthly_fees.forEach(fee => {
                        if (fee.amount > 0) {
                            otherMonthlyFeesAmount += fee.amount;
                            otherFeesDetails += `, ${fee.name} ${fee.amount.toLocaleString()} บาท`;
                        }
                    });
                }

                const waterAmount = waterMinimumApplied ? waterMinimumCharge : (waterUnits * waterRate);
                const electricityAmount = electricityMinimumApplied ? electricityMinimumCharge : (elecUnits * elecRate);

                const totalAmount = (room.price || 0) + waterAmount + electricityAmount + internetRate + commonFee + parkingAmount + otherMonthlyFeesAmount;

                let status = 'pending';
                let paymentDate = null;
                const currentPrepaid = tenant?.prepaid_balance || 0;

                // ⭐ ชำระ prepaid เฉพาะเมื่อบิลเป็นบวก และมีเงินเพียงพอ
                if (totalAmount > 0 && currentPrepaid >= totalAmount) {
                    status = 'paid';
                    paymentDate = now.toISOString();
                    // ⭐ เก็บจำนวนที่หักแทนที่จะเป็น newBalance (แก้ race condition)
                    updatesToProcess.push({
                        tenantId: tenant.id,
                        deduction: totalAmount
                    });
                }

                let notes = `บิลประจำเดือน ${thailandTime.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })} - สร้างอัตโนมัติ`;
                if (parkingDetails) notes += `\nค่าจอดรถ: ${parkingDetails}`;
                if (status === 'paid') notes += `\n✅ ชำระจากเงินล่วงหน้า`;
                if (waterMinimumApplied) {
                    notes += `\n💧 ใช้น้ำ ${originalWaterUnits.toFixed(1)} หน่วย → คิดขั้นต่ำ ${waterMinimumCharge.toLocaleString()} บาท`;
                }
                if (electricityMinimumApplied) {
                    notes += `\n⚡ ใช้ไฟ ${originalElecUnits.toFixed(1)} หน่วย → คิดขั้นต่ำ ${electricityMinimumCharge.toLocaleString()} บาท`;
                }

                // ⭐ ใช้ dueDate ที่ประกาศไว้แล้วด้านบน (ไม่ต้องประกาศใหม่)
                const paymentData = {
                    branch_id: roomBranchId,
                    booking_id: activeBooking.id,
                    tenant_id: activeBooking.tenant_id,
                    room_id: room.id,
                    meter_reading_id: latestMeter?.id || null,
                    due_date: format(dueDate, 'yyyy-MM-dd'),
                    payment_date: paymentDate,
                    rent_amount: room.price || 0,
                    water_units: originalWaterUnits,
                    water_rate: waterRate,
                    water_amount: waterAmount,
                    electricity_units: originalElecUnits,
                    electricity_rate: elecRate,
                    electricity_amount: electricityAmount,
                    internet_amount: internetRate,
                    common_fee_amount: commonFee,
                    parking_fee_amount: parkingAmount,
                    other_amount: otherMonthlyFeesAmount,
                    total_amount: totalAmount,
                    status: status,
                    payment_method: status === 'paid' ? 'prepaid' : 'transfer',
                    notes: notes + (otherFeesDetails ? `\nค่าอื่นๆ: ${otherFeesDetails.substring(2)}` : '')
                };

                paymentsToCreate.push(paymentData);
                paymentReferenceMap.set(room.id, { tenant, room });

            } catch (err) {
                console.error(`Skipping room ${room.room_number}:`, err);
            }
        }

        // 5. Bulk Create Payments
        let createdCount = 0;
        if (paymentsToCreate.length > 0) {
            console.log(`🚀 Creating ${paymentsToCreate.length} bills...`);

            const batches = [];
            for (let i = 0; i < paymentsToCreate.length; i += 100) {
                batches.push(paymentsToCreate.slice(i, i + 100));
            }

            for (const batch of batches) {
                await retryOperation(async () => {
                    const created = await base44.asServiceRole.entities.Payment.bulkCreate(batch);

                    for (const payment of created) {
                        const meta = paymentReferenceMap.get(payment.room_id);
                        if (meta && meta.tenant?.line_user_id) {
                            const shouldSend = getConfigValue('auto_send_bills_after_generation', 'false', payment.branch_id) === 'true';
                            if (shouldSend) {
                                billsToSend.push({ payment, tenant: meta.tenant, room: meta.room });
                            }
                        }
                    }
                    createdCount += created.length;
                });
                await delay(500);
            }
        }

        // 6. Update Prepaid Balances + Calculate Payment Scores
        if (updatesToProcess.length > 0) {
            console.log(`💰 Updating ${updatesToProcess.length} balances...`);

            // ⭐ Group updates ตาม tenant_id เพื่อรวมยอดหักทั้งหมด (แก้ปัญหา race condition)
            const groupedUpdates = {};
            for (const update of updatesToProcess) {
                if (!groupedUpdates[update.tenantId]) {
                    groupedUpdates[update.tenantId] = { totalDeduction: 0 };
                }
                groupedUpdates[update.tenantId].totalDeduction += update.deduction;
            }

            console.log(`📊 Grouped into ${Object.keys(groupedUpdates).length} unique tenants`);

            // อัปเดต prepaid ครั้งเดียวต่อ tenant
            for (const [tenantId, data] of Object.entries(groupedUpdates)) {
                await retryOperation(async () => {
                    const tenant = tenants.find(t => t.id === tenantId);
                    const currentBalance = tenant?.prepaid_balance || 0;
                    const newBalance = currentBalance - data.totalDeduction;

                    await base44.asServiceRole.entities.Tenant.update(tenantId, {
                        prepaid_balance: newBalance
                    });

                    console.log(`💰 Tenant ${tenantId.slice(0, 8)}: ${currentBalance} - ${data.totalDeduction} = ${newBalance}`);

                    // ⭐ คำนวณคะแนนอัตโนมัติหลังชำระผ่าน prepaid
                    try {
                        const response = await base44.asServiceRole.functions.invoke('calculatePaymentScores', {
                            tenant_id: tenantId
                        });
                        if (response.data?.success) {
                            console.log(`✅ Score updated: avg=${response.data.avg_payment_score}`);
                        }
                    } catch (scoreError) {
                        console.warn(`⚠️ Failed to calculate scores:`, scoreError.message);
                    }
                });
                await delay(100);
            }
        }

        // 7. Process invoice queue
        let sentCount = 0;
        let failedCount = 0;
        let pendingImageCount = 0;

        if (billsToSend.length > 0) {
            console.log(`📝 ${billsToSend.length} bills for images`);
            pendingImageCount = billsToSend.length;

            const shouldAutoProcess = getConfigValue('auto_process_invoice_queue_after_generation', 'false', targetBranchId) === 'true';

            if (shouldAutoProcess && billsToSend.length <= 30) {
                console.log(`🚀 Auto-processing...`);

                try {
                    const queueResult = await base44.asServiceRole.functions.invoke('processInvoiceImageQueue', {
                        branch_id: targetBranchId,
                        batch_size: Math.min(billsToSend.length, 30),
                        concurrent_limit: 3
                    });

                    if (queueResult.data?.success) {
                        sentCount = queueResult.data.lineSent || 0;
                        failedCount = queueResult.data.lineFailed || 0;
                        console.log(`✅ Queue done: sent ${sentCount}, failed ${failedCount}`);
                    }
                } catch (queueError) {
                    console.error(`⚠️ Queue error:`, queueError.message);
                }
            }
        }

        // Summary
        const executionTime = Date.now() - startTime;
        const monthName = thailandTime.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
        let summaryMessage = `สร้างบิลสำเร็จ ${createdCount} รายการ`;

        if (skippedDueToExistingBill > 0) {
            summaryMessage += `, ข้าม ${skippedDueToExistingBill} ห้อง`;
        }
        if (skippedDueToLimit > 0) {
            summaryMessage += `, ⚠️ เหลืออีก ${skippedDueToLimit} ห้อง (รันอีกครั้ง)`;
        }
        if (pendingImageCount > 0) {
            summaryMessage += `, รอสร้างรูป ${pendingImageCount} ใบ`;
        }
        if (sentCount > 0 || failedCount > 0) {
            summaryMessage += `, ส่ง ${sentCount} (ล้มเหลว ${failedCount})`;
        }

        const summaryData = {
            success: true,
            message: summaryMessage,
            generatedCount: createdCount,
            skippedDueToExistingBill,
            skippedDueToLimit,
            needMoreRuns: skippedDueToLimit > 0,
            pendingImageCount,
            sentCount,
            failedCount
        };

        try {
            await delay(1000);
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'generateMonthlyBills',
                run_timestamp: new Date().toISOString(),
                status: 'success',
                message: summaryMessage,
                execution_time_ms: executionTime,
                total_sent: createdCount,
                triggered_by: targetBranchId ? 'manual_branch' : 'cron',
                details: summaryData
            });
        } catch (logError) {
            console.error('⚠️ Log error:', logError.message);
        }

        return Response.json(summaryData);

    } catch (err) {
        console.error('❌ FATAL ERROR:', err);
        return Response.json({
            success: false,
            message: `Error: ${err.message}`,
            error: err.stack
        }, { status: 500 });
    }
});