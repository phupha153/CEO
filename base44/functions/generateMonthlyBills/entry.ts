import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
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
    const MAX_BILLS_PER_RUN = 1000; // ⭐ จำกัดสร้งแค่ 1000 บิล/รอบ เพื่อป้องกัน rate limit

    let base44 = null;
    let targetBranchId = null;
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
        const configRes = await base44.asServiceRole.entities.Config.list();
        const configs = Array.isArray(configRes) ? configRes : (configRes?.data || []);
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
        const stepTimings = {};

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

            if (fetchingBookings) await delay(100); // ⭐ OPTIMIZED: Reduced from 200ms
        }

        console.log(`✅ Total bookings: ${bookings.length}`);
        const bookingsMap = new Map(bookings.filter(b => b.status === 'active').map(b => [b.room_id, b])); // ⭐ NEW: Map for O(1) lookup
        // await delay(500); // ⭐ REMOVED: Unnecessary delay

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
              const branchTimings = {}; // ⭐ เก็บเวลาต่อสาขา

              for (const branchId of branchIds) {
                  const genDayConfig = getConfigValue('bill_generation_day', '27', branchId);
                  const genDay = parseInt(genDayConfig);
                  branchGenDayMap[branchId] = genDay;
                  branchTimings[branchId] = { startTime: Date.now(), createdCount: 0 }; // ⭐ เริ่มจับเวลา

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

        // ⭐ Log: ทำไมถึงสร้างบิลวันนี้
        if (forceCreate) {
            console.log(`🔓 FORCE MODE: สร้างบิลโดยไม่เช็ควัน`);
        } else {
            console.log(`✅ วันนี้ (${currentDay}) ตรงกับวันสร้างบิล`);
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
        const tenantsMap = new Map(tenants.map(t => [t.id, t])); // ⭐ NEW: Map for O(1) lookup
        const metersMapByRoom = new Map(); // ⭐ NEW: Group meters by room for O(1) lookup
        for (const meter of meterReadings) {
            if (!metersMapByRoom.has(meter.room_id)) {
                metersMapByRoom.set(meter.room_id, []);
            }
            metersMapByRoom.get(meter.room_id).push(meter);
        }

        console.log(`📦 Fetched: ${meterReadings.length} meter readings, ${tenants.length} tenants`);
        // await delay(500); // ⭐ REMOVED: Unnecessary delay

        // STEP 4: ดึง Payment สำหรับเดือนที่จะสร้างบิล (Smart Filter)
        console.log(`📦 Step 4: Fetching payments for TARGET MONTHS ONLY...`);

        let recentPayments = [];

        for (const branchId of branchIdsToProcess) {
            // ⭐ สร้าง Map: branchId → targetMonth เพื่อดึงเฉพาะเดือนที่จะสร้างบิล
            const branchMonths = new Set();
            const payDay = parseInt(getConfigValue('pay_day', '5', branchId));
            const genDay = parseInt(getConfigValue('bill_generation_day', '27', branchId));

            let billDueMonth = currentMonth;
                              let billDueYear = currentYear;
                              if (currentDay > payDay) {
                                  billDueMonth = currentMonth + 1;
                                  if (billDueMonth > 11) { billDueMonth = 0; billDueYear = currentYear + 1; }
                              }

            const monthStr = `${billDueYear}-${String(billDueMonth + 1).padStart(2, '0')}`;
            branchMonths.add(monthStr);

            console.log(`   📌 Branch ${branchId.substring(0, 8)}: genDay=${genDay}, payDay=${payDay}, billDueMonth=${monthStr}`);

            console.log(`   📥 Branch ${branchId.substring(0, 8)}: Fetching ${branchMonths.size} target month(s)`);

            for (const targetMonth of branchMonths) {
                let branchPayments = [];
                let paymentSkip = 0;
                let fetchingPayments = true;
                let batchNum = 0;

                console.log(`      🔍 Month: ${targetMonth}`);

                while (fetchingPayments && batchNum < 100) {
                    batchNum++;

                    await retryOperation(async () => {
                        const batch = await base44.asServiceRole.entities.Payment.filter(
                            { 
                                branch_id: branchId,
                                due_date: { $gte: `${targetMonth}-01`, $lte: `${targetMonth}-31` }
                            },
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

                    console.log(`         ✅ Month ${targetMonth}: ${branchPayments.length} payments`);
                    recentPayments = recentPayments.concat(branchPayments);
                    // await delay(100); // ⭐ REMOVED: Unnecessary delay
                    }
                    // await delay(300); // ⭐ REMOVED: Unnecessary delay
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
                const activeBooking = bookingsMap.get(room.id); // ⭐ OPTIMIZED: O(1) lookup instead of .find()
                if (!activeBooking) continue;

                const roomBranchId = room.branch_id;

                // ⭐ นับจำนวนบิลต่อสาขา
                if (branchTimings[roomBranchId]) {
                    branchTimings[roomBranchId].createdCount++;
                }

                // ⭐ CRITICAL: ต้องใช้ logic เดียวกับ Step 4 (fetch payments)
                const roomPayDay = parseInt(getConfigValue('pay_day', '5', roomBranchId));
                const roomGenDay = parseInt(getConfigValue('bill_generation_day', '27', roomBranchId));

                let roomDueYear = currentYear;
                                      let roomDueMonth = currentMonth;

                                      if (currentDay > roomPayDay) {
                                          roomDueMonth = currentMonth + 1;
                                          if (roomDueMonth > 11) { roomDueMonth = 0; roomDueYear = currentYear + 1; }
                                      }

                const targetDueYearMonth = `${roomDueYear}-${String(roomDueMonth + 1).padStart(2, '0')}`;
                const mapKey = `${room.id}|${targetDueYearMonth}`;

                // ⭐ สร้าง dueDate object สำหรับใช้ใน format()
                const dueDate = new Date(roomDueYear, roomDueMonth, roomPayDay);

                if (!forceSkipDuplicateCheck) {
                    const existingBill = existingPaymentsMap.get(mapKey) || null; // ⭐ OPTIMIZED: Remove fallback loop

                    if (existingBill) {
                        skippedDueToExistingBill++;
                        // ⭐ Log: ห้องที่ข้ามเพราะมีบิลเก่าแล้ว
                        if (skippedDueToExistingBill <= 10) {
                            console.log(`   ⏭️ Room ${room.room_number}: Skip - บิล ${targetDueYearMonth} มีแล้ว`);
                        }
                        continue;
                    }
                }

                const roomMeters = (metersMapByRoom.get(room.id) || []).slice().sort((a, b) => new Date(b.created_date || b.reading_date) - new Date(a.created_date || a.reading_date)); // ⭐ OPTIMIZED: O(1) map lookup instead of .filter()

                // ⭐ FIX: ใช้มิเตอร์ล่าสุดเสมอ (ไม่ว่าจะ 0 หรือไม่) - ป้องกันเอาค่าเก่ามาใช้
                let latestMeter = roomMeters[0] || null;

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

                // 🔄 NEW: เช็คค่าเหมาก่อน (ถ้าเป็นเหมาจะไม่คำนวณตามหน่วย)
                let waterFlatRateApplied = false;
                let electricityFlatRateApplied = false;

                // ⭐ ค่าขั้นต่ำน้ำ - ดูที่ห้องก่อน ถ้าไม่มีค่อยดูสาขา
                if (room.min_water_units !== null && room.min_water_units !== undefined && 
                    room.min_water_charge !== null && room.min_water_charge !== undefined) {
                    // ใช้ค่าห้อง
                    const minUnits = parseFloat(room.min_water_units);
                    const minCharge = parseFloat(room.min_water_charge);
                    if (waterUnits <= minUnits && minCharge > 0) {
                        waterMinimumCharge = minCharge;
                        waterMinimumApplied = true;
                    }
                } else {
                    // ใช้ค่าสาขา
                    const waterMinEnabled = getConfigValue('water_minimum_enabled', 'false', roomBranchId) === 'true';
                    if (waterMinEnabled) {
                        const minUnits = parseFloat(getConfigValue('water_minimum_units', '3', roomBranchId));
                        const minCharge = parseFloat(getConfigValue('water_minimum_charge', '0', roomBranchId));
                        if (waterUnits <= minUnits && minCharge > 0) {
                            waterMinimumCharge = minCharge;
                            waterMinimumApplied = true;
                        }
                    }
                }

                // ⭐ ค่าขั้นต่ำไฟ - ดูที่ห้องก่อน ถ้าไม่มีค่อยดูสาขา
                if (room.min_electricity_units !== null && room.min_electricity_units !== undefined && 
                    room.min_electricity_charge !== null && room.min_electricity_charge !== undefined) {
                    // ใช้ค่าห้อง
                    const minUnits = parseFloat(room.min_electricity_units);
                    const minCharge = parseFloat(room.min_electricity_charge);
                    if (elecUnits <= minUnits && minCharge > 0) {
                        electricityMinimumCharge = minCharge;
                        electricityMinimumApplied = true;
                    }
                } else {
                    // ใช้ค่าสาขา
                    const elecMinEnabled = getConfigValue('electricity_minimum_enabled', 'false', roomBranchId) === 'true';
                    if (elecMinEnabled) {
                        const minUnits = parseFloat(getConfigValue('electricity_minimum_units', '3', roomBranchId));
                        const minCharge = parseFloat(getConfigValue('electricity_minimum_charge', '0', roomBranchId));
                        if (elecUnits <= minUnits && minCharge > 0) {
                            electricityMinimumCharge = minCharge;
                            electricityMinimumApplied = true;
                        }
                    }
                }

                // ⭐ CRITICAL FIX: Check if booking.tenant_id is valid + use cached tenant
                if (!activeBooking.tenant_id) {
                    console.log(`⏭️ Room ${room.room_number}: No tenant_id in booking - skip`);
                    continue;
                }

                let tenant = tenantsMap.get(activeBooking.tenant_id);
                
                // Use cached tenant if available (avoid N+1 rate limit issues)
                if (!tenant) {
                    console.log(`⏭️ Room ${room.room_number}: Tenant ${activeBooking.tenant_id} NOT IN CACHE - skip`);
                    continue;
                }

                // Check status
                if (tenant.status === 'moved_out') {
                    console.log(`⏭️ Room ${room.room_number}: Tenant ${tenant.full_name} moved out - skip`);
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

                // 🔄 คำนวณค่าน้ำ: เหมา > ขั้นต่ำ > ตามหน่วย
                let waterAmount;
                if ((room.is_flat_rate_water === true || room.is_flat_rate_water === 'true') && room.flat_rate_water_amount) {
                    waterAmount = parseFloat(room.flat_rate_water_amount);
                    waterFlatRateApplied = true;
                } else if (waterMinimumApplied) {
                    waterAmount = waterMinimumCharge;
                } else {
                    waterAmount = waterUnits * waterRate;
                }

                // 🔄 คำนวณค่าไฟ: เหมา > ขั้นต่ำ > ตามหน่วย
                let electricityAmount;
                if ((room.is_flat_rate_electricity === true || room.is_flat_rate_electricity === 'true') && room.flat_rate_electricity_amount) {
                    electricityAmount = parseFloat(room.flat_rate_electricity_amount);
                    electricityFlatRateApplied = true;
                } else if (electricityMinimumApplied) {
                    electricityAmount = electricityMinimumCharge;
                } else {
                    electricityAmount = elecUnits * elecRate;
                }

                // ⭐ SAFE PARSING: Default to 0 if missing/invalid (ไม่ throw error)
                const safeRoomPrice = parseFloat(room.price) || 0;
                const safeWaterAmount = parseFloat(waterAmount) || 0;
                const safeElecAmount = parseFloat(electricityAmount) || 0;
                const safeInternetRate = parseFloat(internetRate) || 0;
                const safeCommonFee = parseFloat(commonFee) || 0;
                const safeParkingAmount = parseFloat(parkingAmount) || 0;
                const safeOtherFees = parseFloat(otherMonthlyFeesAmount) || 0;

                const totalAmount = safeRoomPrice + safeWaterAmount + safeElecAmount + safeInternetRate + safeCommonFee + safeParkingAmount + safeOtherFees;

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
                if (waterFlatRateApplied) {
                    notes += `\n💧 ค่าน้ำเหมาจ่าย: ${room.flat_rate_water_amount.toLocaleString()} บาท`;
                } else if (waterMinimumApplied) {
                    notes += `\n💧 ใช้น้ำ ${originalWaterUnits.toFixed(1)} หน่วย → คิดขั้นต่ำ ${waterMinimumCharge.toLocaleString()} บาท`;
                }
                if (electricityFlatRateApplied) {
                    notes += `\n⚡ ค่าไฟเหมาจ่าย: ${room.flat_rate_electricity_amount.toLocaleString()} บาท`;
                } else if (electricityMinimumApplied) {
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
                    rent_amount: safeRoomPrice,
                    water_units: waterFlatRateApplied ? 0 : (parseFloat(originalWaterUnits) || 0),
                    water_rate: waterFlatRateApplied ? 0 : (parseFloat(waterRate) || 0),
                    water_amount: safeWaterAmount,
                    electricity_units: electricityFlatRateApplied ? 0 : (parseFloat(originalElecUnits) || 0),
                    electricity_rate: electricityFlatRateApplied ? 0 : (parseFloat(elecRate) || 0),
                    electricity_amount: safeElecAmount,
                    internet_amount: safeInternetRate,
                    common_fee_amount: safeCommonFee,
                    parking_fee_amount: safeParkingAmount,
                    other_amount: safeOtherFees,
                    total_amount: parseFloat(totalAmount.toFixed(2)),
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
        const step5StartTime = Date.now();
        let createdCount = 0;
        let skippedCount = 0;
        const errors = [];
        
        if (paymentsToCreate.length > 0) {
            console.log(`🚀 Creating ${paymentsToCreate.length} bills...`);

            const batches = [];
            for (let i = 0; i < paymentsToCreate.length; i += 100) {
                batches.push(paymentsToCreate.slice(i, i + 100));
            }

            for (const batch of batches) {
                const batchStartTime = Date.now();
                await retryOperation(async () => {
                    const created = await base44.asServiceRole.entities.Payment.bulkCreate(batch);

                    createdCount += created.length;
                });
                const batchTime = Date.now() - batchStartTime;
                console.log(`   ✅ Batch: +${batch.length} bills (${batchTime}ms)`);
                await delay(100); // ⭐ OPTIMIZED: Reduced from 500ms
            }
            stepTimings.step5 = Date.now() - step5StartTime;
            console.log(`⏱️ Step 5 (Create Bills): ${stepTimings.step5}ms`);
        }

        // 6. Update Prepaid Balances + Calculate Payment Scores (Parallel Chunked)
        const step6StartTime = Date.now();
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

            // ⭐ อัปเดต prepaid แบบ Parallel Chunked (ปลอดภัยจาก rate limit)
            const entries = Object.entries(groupedUpdates);
            const CHUNK_SIZE = 10; // 10 parallel at a time

            for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
                const chunk = entries.slice(i, i + CHUNK_SIZE);
                const chunkStartTime = Date.now();
                console.log(`   📍 Processing chunk: ${i + 1}-${Math.min(i + CHUNK_SIZE, entries.length)} / ${entries.length}`);

                const results = await Promise.allSettled(
                    chunk.map(([tenantId, data]) =>
                        (async () => {
                            try {
                                const tenant = tenantsMap.get(tenantId); // ⭐ OPTIMIZED: O(1) lookup instead of .find()
                                const currentBalance = tenant?.prepaid_balance || 0;
                                const newBalance = Math.max(0, currentBalance - data.totalDeduction);

                                await retryOperation(async () => {
                                    await base44.asServiceRole.entities.Tenant.update(tenantId, {
                                        prepaid_balance: newBalance
                                    });
                                });

                                console.log(`   💰 Tenant ${tenantId.slice(0, 8)}: ${currentBalance} - ${data.totalDeduction} = ${newBalance}`);

                                // ⭐ คำนวณคะแนนอัตโนมัติหลังชำระผ่าน prepaid
                                try {
                                    const response = await base44.asServiceRole.functions.invoke('calculatePaymentScores', {
                                        tenant_id: tenantId
                                    });
                                    if (response.data?.success) {
                                        console.log(`   ✅ Score: avg=${response.data.avg_payment_score}`);
                                    }
                                } catch (scoreError) {
                                    console.warn(`   ⚠️ Score failed: ${scoreError.message}`);
                                }
                            } catch (err) {
                                console.error(`   ❌ Tenant update failed: ${err.message}`);
                                throw err;
                            }
                        })()
                    )
                );

                // ⭐ Log chunk results
                const successful = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected').length;
                const chunkTime = Date.now() - chunkStartTime;
                console.log(`   ✅ Chunk done: ${successful} success, ${failed} failed (${chunkTime}ms)`);

                await delay(50); // ⭐ OPTIMIZED: Reduced from 200ms (chunk already has 10 parallel operations)
                }
                stepTimings.step6 = Date.now() - step6StartTime;
                console.log(`⏱️ Step 6 (Update Balances): ${stepTimings.step6}ms`);
        }

        // Summary
        const executionTime = Date.now() - startTime;
        const monthName = thailandTime.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
        let summaryMessage = `สร้างบิลสำเร็จ ${createdCount} รายการ`;

        if (skippedCount > 0) {
            summaryMessage += `, ข้าม ${skippedCount} รายการ (ข้อมูลไม่ครบ)`;
        }
        if (skippedDueToExistingBill > 0) {
            summaryMessage += `, ข้าม ${skippedDueToExistingBill} ห้อง (มีบิลแล้ว)`;
        }
        if (skippedDueToLimit > 0) {
            summaryMessage += `, ⚠️ เหลืออีก ${skippedDueToLimit} ห้อง (รันอีกครั้ง)`;
        }

        // ⭐ แสดงเวลาต่อสาขา
        console.log('\n========================================');
        console.log('⏱️ TIMING PER BRANCH:');
        console.log('========================================');
        for (const branchId of branchIdsToProcess) {
            const timing = branchTimings[branchId];
            if (timing) {
                const elapsed = Date.now() - timing.startTime;
                const seconds = (elapsed / 1000).toFixed(2);
                console.log(`📍 Branch ${branchId.slice(0, 8)}: ${timing.createdCount} บิล | ⏱️ ${seconds}s`);
            }
        }
        console.log('========================================');
        console.log(`⏱️ TOTAL TIME: ${(executionTime / 1000).toFixed(2)}s`);
        console.log('========================================');

        const summaryData = {
            success: true,
            message: summaryMessage,
            created: createdCount,
            skipped: skippedCount,
            errors: errors.slice(0, 10),
            generatedCount: createdCount,
            skippedDueToExistingBill,
            skippedDueToLimit,
            needMoreRuns: skippedDueToLimit > 0
        };

        try {
            // await delay(1000); // ⭐ REMOVED: Unnecessary delay before logging
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'generateMonthlyBills',
                run_timestamp: new Date().toISOString(),
                status: 'success',
                message: summaryMessage,
                execution_time_ms: executionTime,
                total_sent: createdCount,
                triggered_by: targetBranchId ? 'manual_branch' : 'cron'
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