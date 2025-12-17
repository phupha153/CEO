import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { format } from 'npm:date-fns@3.0.0';

// Helper: แปลงเลขเป็นคำอ่านไทย
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
                if (digit === 1) result += 'สิบ';
                else if (digit === 2) result += 'ยี่สิบ';
                else result += numbers[digit] + positions[position];
            } else if (position === 0 && digit === 1 && len > 1 && parseInt(numStr[len-2]) !== 0) {
                result += 'เอ็ด';
            } else {
                result += numbers[digit] + positions[position];
            }
        }
        return result;
    }
    let text = convertInteger(integerPart) + 'บาท';
    if (decimalPart > 0) text += convertInteger(decimalPart) + 'สตางค์';
    else text += 'ถ้วน';
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
    console.log('🚀 STARTING BILL GENERATION (Smart Fetch Optimized)');
    console.log('========================================');

    const startTime = Date.now();
    const MAX_BILLS_PER_RUN = 1000;

    let base44 = null;
    let targetBranchId = null;
    let forceCreate = false;
    let resendNotifications = false;
    let forceSkipDuplicateCheck = false;
    
    try {
        const clonedReq = req.clone();
        base44 = createClientFromRequest(req);

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

        // 3. Helper Functions & Variables initialization
        let allRooms = [], bookings = [], meterReadings = [], tenants = [];
        let existingPaymentsMap = new Map();
        
        // ⭐ Smart Pagination Function (ฉบับแก้แล้ว)
        async function fetchWithPagination(entity, filter, sortBy, batchSize = 300, stopCheckFn = null) {
            let allData = [];
            let skip = 0;
            let iteration = 0;
            const MAX_ITERATIONS = 50;

            while (iteration < MAX_ITERATIONS) {
                iteration++;
                
                // ดึงข้อมูล
                const batch = await entity.filter(filter, sortBy, batchSize, skip);
                const batchLength = Array.isArray(batch) ? batch.length : 0;

                // ถ้าไม่มีข้อมูลแล้ว ให้หยุด
                if (batchLength === 0) break;

                // ⭐ ส่วนที่เพิ่มมา: เช็คเงื่อนไขหยุด (Stop Logic)
                // เช็คตัวสุดท้ายของ Batch ถ้าเก่าเกินกำหนด ให้หยุดดึง
                if (stopCheckFn && batchLength > 0) {
                    const lastItem = batch[batchLength - 1];
                    if (stopCheckFn(lastItem)) {
                        allData = allData.concat(batch); // เก็บ batch นี้ไว้ก่อนแล้วจบเลย
                        console.log(`   🛑 Stop condition met. Stopping fetch.`);
                        break; // ❌ สั่ง Break Loop ทันที ไม่ดึงต่อแล้ว
                    }
                }

                // ถ้ายังไม่เจอเงื่อนไขหยุด ก็เก็บข้อมูลแล้วไปต่อรอบหน้า
                allData = allData.concat(batch);
                skip += batchLength;
                
                await delay(200);
            }
            console.log(`   ✅ Fetched: ${allData.length} items`);
            return allData;
        }
        const normalizeEntity = (entity) => {
            if (!entity) return null;
            if (entity.data && typeof entity.data === 'object') {
                return { id: entity.id, ...entity.data };
            }
            return entity;
        };

        // STEP 1: Fetch rooms and bookings
        console.log('📦 Step 1: Fetching ALL Rooms & Active Bookings...');
        const filter = targetBranchId ? { branch_id: targetBranchId } : {};
        
        // 1a. Fetch Rooms
        let roomSkip = 0;
        let fetchingRooms = true;
        while (fetchingRooms) {
            await retryOperation(async () => {
                const batch = await base44.asServiceRole.entities.Room.filter(filter, '-room_number', 500, roomSkip);
                const len = batch.length || 0;
                if (len > 0) { allRooms = allRooms.concat(batch); roomSkip += len; }
                if (len < 500) fetchingRooms = false;
            });
            if (fetchingRooms) await delay(200);
        }
        
        // 1b. Fetch Bookings
        let bookingSkip = 0;
        let fetchingBookings = true;
        const bookingFilter = { ...filter, status: 'active' };
        while (fetchingBookings) {
            await retryOperation(async () => {
                const batch = await base44.asServiceRole.entities.Booking.filter(bookingFilter, '-created_date', 500, bookingSkip);
                const len = batch.length || 0;
                if (len > 0) { bookings = bookings.concat(batch); bookingSkip += len; }
                if (len < 500) fetchingBookings = false;
            });
            if (fetchingBookings) await delay(200);
        }

        allRooms = allRooms.map(normalizeEntity).filter(Boolean);
        bookings = bookings.map(normalizeEntity).filter(Boolean);

        const monthlyRooms = allRooms.filter(room => room.room_type === 'monthly');
        const roomsWithBooking = monthlyRooms.filter(room => bookings.some(b => b.room_id === room.id));
        console.log(`✅ Rooms with active booking: ${roomsWithBooking.length}`);

        // STEP 2: Filter Branches based on Generation Day
        const branchIds = [...new Set(roomsWithBooking.map(r => r.branch_id).filter(Boolean))];
        const branchesToProcess = [];
        const branchesSkipped = [];
        
        for (const branchId of branchIds) {
            const genDay = parseInt(getConfigValue('bill_generation_day', '27', branchId));
            if (forceCreate || currentDay === genDay) {
                branchesToProcess.push({ branchId, genDay });
            } else {
                branchesSkipped.push({ branchId, genDay });
            }
        }

        const branchIdsToProcess = branchesToProcess.map(b => b.branchId);
        console.log(`📆 Branches to process: ${branchIdsToProcess.length} (Skipped: ${branchesSkipped.length})`);
        
        if (branchIdsToProcess.length === 0) {
            return Response.json({ success: true, message: 'ไม่มีสาขาที่ต้องสร้างบิลวันนี้', generatedCount: 0 });
        }

        // STEP 3: Smart Fetch Meters & Tenants
        console.log(`📦 Step 3: Fetching Meters (Last 60 days) & Tenants...`);
        
        // Calculate cutoff date for meters (60 days ago)
        const meterCutoffDate = new Date();
        meterCutoffDate.setDate(meterCutoffDate.getDate() - 60);
        const meterCutoffStr = meterCutoffDate.toISOString();

        for (let idx = 0; idx < branchIdsToProcess.length; idx++) {
            const branchId = branchIdsToProcess[idx];
            console.log(`   📥 Branch ${idx + 1}/${branchIdsToProcess.length}...`);
            
            await retryOperation(async () => {
                const [m, t] = await Promise.all([
                    // Meter Reading: Stop fetching if older than 60 days
                    fetchWithPagination(
                        base44.asServiceRole.entities.MeterReading, 
                        { branch_id: branchId }, 
                        '-reading_date', 
                        300,
                        (item) => (item.reading_date || item.created_date) < meterCutoffStr
                    ),
                    // Tenants: Fetch all (needed for notifications)
                    fetchWithPagination(
                        base44.asServiceRole.entities.Tenant, 
                        { branch_id: branchId }, 
                        '-created_date',
                        300
                    )
                ]);
                
                meterReadings = meterReadings.concat(m || []);
                tenants = tenants.concat(t || []);
            });

            if (idx < branchIdsToProcess.length - 1) await delay(300);
        }
        
        meterReadings = meterReadings.map(normalizeEntity).filter(Boolean);
        tenants = tenants.map(normalizeEntity).filter(Boolean);
        console.log(`📦 Fetched: ${meterReadings.length} meters (recent), ${tenants.length} tenants`);

        // STEP 4: Smart Fetch Recent Payments (Duplicate Check)
        console.log(`📦 Step 4: Fetching Recent Payments (Last 45 days)...`);
        
        // Calculate cutoff date for payments (45 days ago)
        const paymentCutoffDate = new Date();
        paymentCutoffDate.setDate(paymentCutoffDate.getDate() - 45);
        const paymentCutoffStr = paymentCutoffDate.toISOString().split('T')[0];

        let recentPayments = [];

        for (const branchId of branchIdsToProcess) {
            console.log(`   📥 Checking existing bills for branch: ${branchId}`);
            await retryOperation(async () => {
                // Payments: Stop fetching if due_date is older than 45 days
                const batch = await fetchWithPagination(
                    base44.asServiceRole.entities.Payment,
                    { branch_id: branchId },
                    '-due_date',
                    300,
                    (item) => item.due_date < paymentCutoffStr
                );
                recentPayments = recentPayments.concat(batch || []);
            });
            await delay(200);
        }

        const normalizedPayments = recentPayments.map(normalizeEntity).filter(p => p && p.room_id && p.due_date);
        
        for (const p of normalizedPayments) {
            const dueYearMonth = p.due_date.substring(0, 7); // YYYY-MM
            existingPaymentsMap.set(`${p.room_id}|${dueYearMonth}`, p);
        }
        console.log(`🗺️ Existing payments map: ${existingPaymentsMap.size} entries (Recent only)`);

        // STEP 5: Process Calculation & Prepare Payments
        let roomsToProcess = roomsWithBooking.filter(r => branchIdsToProcess.includes(r.branch_id));
        console.log(`✅ Final Rooms to Process: ${roomsToProcess.length}`);

        const paymentsToCreate = [];
        const updatesToProcess = [];
        const billsToSend = [];
        let skippedDueToExistingBill = 0;
        let skippedDueToLimit = 0;
        const paymentReferenceMap = new Map();

        for (const room of roomsToProcess) {
            if (paymentsToCreate.length >= MAX_BILLS_PER_RUN) {
                skippedDueToLimit++;
                continue;
            }
            try {
                const activeBooking = bookings.find(b => b.room_id === room.id && b.status === 'active');
                if (!activeBooking) continue;

                const roomBranchId = room.branch_id;
                const roomPayDay = parseInt(getConfigValue('pay_day', '5', roomBranchId));
                const roomGenDay = parseInt(getConfigValue('bill_generation_day', '27', roomBranchId));
                
                // Calculate Target Due Date (Month)
                let roomDueYear = currentYear;
                let roomDueMonth = currentMonth;
                if (roomGenDay > roomPayDay) {
                    roomDueMonth = currentMonth + 1;
                    if (roomDueMonth > 11) { roomDueMonth = 0; roomDueYear = currentYear + 1; }
                }
                
                const targetDueYearMonth = `${roomDueYear}-${String(roomDueMonth + 1).padStart(2, '0')}`;
                const mapKey = `${room.id}|${targetDueYearMonth}`;
                
                // Check Duplicate
                if (!forceSkipDuplicateCheck) {
                    let existingBill = existingPaymentsMap.get(mapKey);
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

                // Get Latest Meter
                const roomMeters = meterReadings.filter(m => m.room_id === room.id);
                roomMeters.sort((a, b) => new Date(b.created_date || b.reading_date) - new Date(a.created_date || a.reading_date));
                const latestMeter = roomMeters.find(m => (m.water_units > 0 || m.electricity_units > 0)) || roomMeters[0] || null;
                
                // Calculation Logic
                const waterUnits = latestMeter?.water_units || 0;
                const elecUnits = latestMeter?.electricity_units || 0;
                const waterRate = parseFloat(room.water_rate ?? getConfigValue('water_rate', '18', roomBranchId));
                const elecRate = parseFloat(room.electricity_rate ?? getConfigValue('electricity_rate', '7', roomBranchId));
                const commonFee = parseFloat(room.common_fee ?? getConfigValue('common_fee', '0', roomBranchId));
                const internetRate = parseFloat(getConfigValue('internet_rate', '0', roomBranchId));
                const carFee = parseFloat(getConfigValue('car_parking_fee', '0', roomBranchId));
                const motoFee = parseFloat(getConfigValue('motorcycle_parking_fee', '0', roomBranchId));

                const tenant = tenants.find(t => t.id === activeBooking.tenant_id);
                if (!tenant || tenant.status === 'moved_out') {
                    console.log(`⏭️ Tenant not found/moved out for room ${room.room_number}`);
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

                let otherFees = 0;
                let otherDetails = '';
                if (Array.isArray(room.other_monthly_fees)) {
                    room.other_monthly_fees.forEach(f => {
                        if (f.amount > 0) {
                            otherFees += f.amount;
                            otherDetails += `, ${f.name} ${f.amount.toLocaleString()} บาท`;
                        }
                    });
                }

                let waterAmt = waterUnits * waterRate;
                let elecAmt = elecUnits * elecRate;
                let waterMinApp = false, elecMinApp = false;

                if (getConfigValue('water_minimum_enabled', 'false', roomBranchId) === 'true') {
                    const minU = parseFloat(getConfigValue('water_minimum_units', '3', roomBranchId));
                    const minC = parseFloat(getConfigValue('water_minimum_charge', '0', roomBranchId));
                    if (waterUnits <= minU && minC > 0) { waterAmt = minC; waterMinApp = true; }
                }
                if (getConfigValue('electricity_minimum_enabled', 'false', roomBranchId) === 'true') {
                    const minU = parseFloat(getConfigValue('electricity_minimum_units', '3', roomBranchId));
                    const minC = parseFloat(getConfigValue('electricity_minimum_charge', '0', roomBranchId));
                    if (elecUnits <= minU && minC > 0) { elecAmt = minC; elecMinApp = true; }
                }

                const totalAmount = (room.price || 0) + waterAmt + elecAmt + internetRate + commonFee + parkingAmount + otherFees;
                
                let status = 'pending';
                let paymentDate = null;
                const currentPrepaid = tenant.prepaid_balance || 0;
                
                if (currentPrepaid >= totalAmount) {
                    status = 'paid';
                    paymentDate = now.toISOString();
                    updatesToProcess.push({ 
                        tenantId: tenant.id, 
                        newBalance: currentPrepaid - totalAmount 
                    });
                }

                let notes = `บิลประจำเดือน ${thailandTime.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })} - สร้างอัตโนมัติ`;
                if (parkingDetails) notes += `\nค่าจอดรถ: ${parkingDetails}`;
                if (status === 'paid') notes += `\n✅ ชำระจากเงินล่วงหน้า`;
                if (waterMinApp) notes += `\n💧 น้ำขั้นต่ำ ${waterAmt.toLocaleString()} บ.`;
                if (elecMinApp) notes += `\n⚡ ไฟขั้นต่ำ ${elecAmt.toLocaleString()} บ.`;
                if (otherDetails) notes += `\nค่าอื่นๆ: ${otherDetails.substring(2)}`;

                const dueDateObj = new Date(roomDueYear, roomDueMonth, roomPayDay);
                
                paymentsToCreate.push({
                    branch_id: roomBranchId,
                    booking_id: activeBooking.id,
                    tenant_id: tenant.id,
                    room_id: room.id,
                    meter_reading_id: latestMeter?.id || null,
                    due_date: format(dueDateObj, 'yyyy-MM-dd'),
                    payment_date: paymentDate,
                    rent_amount: room.price || 0,
                    water_units: waterUnits,
                    water_rate: waterRate,
                    water_amount: waterAmt,
                    electricity_units: elecUnits,
                    electricity_rate: elecRate,
                    electricity_amount: elecAmt,
                    internet_amount: internetRate,
                    common_fee_amount: commonFee,
                    parking_fee_amount: parkingAmount,
                    other_amount: otherFees,
                    total_amount: totalAmount,
                    status: status,
                    payment_method: status === 'paid' ? 'prepaid' : 'transfer',
                    notes: notes
                });
                
                paymentReferenceMap.set(room.id, { tenant, room });

            } catch (err) {
                console.error(`Skipping room ${room.room_number}:`, err);
            }
        }

        // STEP 6: Execute Bulk Create & Update
        let createdCount = 0;
        if (paymentsToCreate.length > 0) {
            console.log(`🚀 Creating ${paymentsToCreate.length} bills...`);
            const batches = [];
            for (let i = 0; i < paymentsToCreate.length; i += 100) batches.push(paymentsToCreate.slice(i, i + 100));

            for (const batch of batches) {
                await retryOperation(async () => {
                    const created = await base44.asServiceRole.entities.Payment.bulkCreate(batch);
                    createdCount += created.length;
                    for (const payment of created) {
                        const meta = paymentReferenceMap.get(payment.room_id);
                        if (meta && getConfigValue('auto_send_bills_after_generation', 'false', payment.branch_id) === 'true') {
                            billsToSend.push({ payment, tenant: meta.tenant, room: meta.room });
                        }
                    }
                });
                await delay(500);
            }
        }

        if (updatesToProcess.length > 0) {
            console.log(`💰 Updating ${updatesToProcess.length} prepaid balances...`);
            for (const u of updatesToProcess) {
                await base44.asServiceRole.entities.Tenant.update(u.tenantId, { prepaid_balance: u.newBalance }).catch(() => {});
                await delay(100);
            }
        }

        // STEP 7: Trigger Invoice Queue
        let sentCount = 0;
        let failedCount = 0;
        let pendingImageCount = billsToSend.length;

        if (billsToSend.length > 0) {
            const shouldAutoProcess = getConfigValue('auto_process_invoice_queue_after_generation', 'false', targetBranchId) === 'true';
            if (shouldAutoProcess && billsToSend.length <= 30) {
                console.log(`🚀 Triggering Auto-Process Queue...`);
                try {
                    const qRes = await base44.asServiceRole.functions.invoke('processInvoiceImageQueue', { 
                        branch_id: targetBranchId, 
                        batch_size: 30, 
                        concurrent_limit: 3 
                    });
                    if (qRes.data?.success) {
                        sentCount = qRes.data.lineSent || 0;
                        failedCount = qRes.data.lineFailed || 0;
                    }
                } catch (e) {
                    console.error('Queue error:', e.message);
                }
            }
        }

        // Summary & Log
        const summary = `สร้างสำเร็จ ${createdCount}, ข้ามซ้ำ ${skippedDueToExistingBill}, ค้าง ${skippedDueToLimit}, รอรูป ${pendingImageCount}`;
        console.log(`✅ ${summary}`);
        
        await base44.asServiceRole.entities.FunctionLog.create({
            function_name: 'generateMonthlyBills',
            run_timestamp: new Date().toISOString(),
            status: 'success',
            message: summary,
            execution_time_ms: Date.now() - startTime,
            total_sent: createdCount,
            triggered_by: targetBranchId ? 'manual' : 'cron',
            details: { 
                createdCount, 
                skippedDueToExistingBill, 
                skippedDueToLimit, 
                sentCount, 
                failedCount,
                pendingImageCount
            }
        }).catch((e) => console.error('Log error:', e.message));

        return Response.json({ success: true, message: summary, generatedCount: createdCount });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});