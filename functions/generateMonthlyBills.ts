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
    console.log('🚀 STARTING BILL GENERATION');

    let base44 = null;
    let targetBranchId = null;
    let forceCreate = false;
    let resendNotifications = false;
    
    try {

        // Clone request FIRST before SDK reads the body
        const clonedReq = req.clone();
        
        // Now create SDK client (this may consume the original request body)
        base44 = createClientFromRequest(req);

        // Parse request body from cloned request
        try {
            const text = await clonedReq.text();
            if (text && text.trim()) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
                forceCreate = body.force === true;
                resendNotifications = body.resend_notifications === true;
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

        // 2. Check Date - ใช้ Intl.DateTimeFormat เพื่อความแม่นยำ
        const now = new Date();
        
        // ใช้ Intl.DateTimeFormat เพื่อดึงวันที่ตาม timezone ไทยอย่างถูกต้อง
        const thFormatter = new Intl.DateTimeFormat('en-CA', { 
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
        const thDateParts = thFormatter.formatToParts(now);
        const currentYear = parseInt(thDateParts.find(p => p.type === 'year').value);
        const currentMonth = parseInt(thDateParts.find(p => p.type === 'month').value) - 1; // 0-indexed
        const currentDay = parseInt(thDateParts.find(p => p.type === 'day').value);
        
        // สร้าง thailandTime สำหรับใช้ format อื่นๆ
        const thailandTime = new Date(currentYear, currentMonth, currentDay);
        
        console.log(`🕐 Server UTC time: ${now.toISOString()}`);
        console.log(`🇹🇭 Thailand date: ${currentDay}/${currentMonth + 1}/${currentYear}`);

        // 3. Fetch Data (Retry wrapped)
        let allRooms = [], bookings = [], meterReadings = [], tenants = [];
        // ⭐ existingPaymentsMap จะถูกสร้างเป็น Map หลังจาก fetch เพื่อเพิ่มประสิทธิภาพ
        let existingPaymentsMap = new Map(); // key: "room_id|YYYY-MM", value: payment object
        
        console.log(`🔍 Will check ALL existing payments (no date range filter - fix for duplicate bug)`);
        
        // ⭐ Helper function สำหรับดึงข้อมูลแบบ pagination
        async function fetchWithPagination(entity, filter, sortBy, batchSize = 5000) {
            let allData = [];
            let skip = 0;
            let hasMore = true;
            
            while (hasMore) {
                const batch = await entity.filter(filter, sortBy, batchSize, skip);
                if (!Array.isArray(batch) || batch.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(batch);
                    skip += batch.length;
                    if (batch.length < batchSize) {
                        hasMore = false;
                    }
                }
            }
            return allData;
        }

        await retryOperation(async () => {
            const filter = targetBranchId ? { branch_id: targetBranchId } : {};
            const bookingFilter = { ...filter, status: 'active' };

            // ⭐ ใช้ filter ธรรมดา + limit เท่าที่จำเป็น แทน pagination
            const [r, b, m, t] = await Promise.all([
                base44.asServiceRole.entities.Room.filter(filter, '-room_number', 5000),
                base44.asServiceRole.entities.Booking.filter(bookingFilter, '-created_date', 5000),
                base44.asServiceRole.entities.MeterReading.filter(filter, '-reading_date', 5000),
                base44.asServiceRole.entities.Tenant.filter(filter, '-created_date', 5000)
            ]);
            
            allRooms = Array.isArray(r) ? r : []; 
            bookings = Array.isArray(b) ? b : []; 
            meterReadings = Array.isArray(m) ? m : []; 
            tenants = Array.isArray(t) ? t : [];
        });

        console.log(`📦 Fetched: ${allRooms.length} rooms, ${bookings.length} bookings, ${tenants.length} tenants`);
        
        // ⭐⭐⭐ ดึง Payment เฉพาะเดือนปัจจุบัน/เดือนหน้า (แทนที่จะดึงทั้งหมด)
        console.log('📦 Fetching payments for current/next month only...');
        
        let recentPayments = [];
        
        // ⭐ สร้าง filter สำหรับดึงเฉพาะ payments ที่เกี่ยวข้อง
        // คำนวณ due_date range: เดือนปัจจุบัน และเดือนหน้า
        const thisMonthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
        const nextMonth = currentMonth + 1 > 11 ? 0 : currentMonth + 1;
        const nextMonthYear = currentMonth + 1 > 11 ? currentYear + 1 : currentYear;
        const nextMonthEnd = `${nextMonthYear}-${String(nextMonth + 1).padStart(2, '0')}-31`;
        
        console.log(`📅 Checking payments from ${thisMonthStart} to ${nextMonthEnd}`);
        
        await retryOperation(async () => {
            const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : {};
            
            // ดึงเฉพาะ 2000 รายการล่าสุด (เพียงพอสำหรับ 1-2 เดือน)
            const payments = await base44.asServiceRole.entities.Payment.filter(
                paymentFilter, 
                '-due_date', 
                2000
            );
            
            recentPayments = Array.isArray(payments) ? payments : [];
        });
        
        console.log(`✅ Fetched ${recentPayments.length} recent payments`);
        
        // ⭐ สร้าง Map จาก payments
        for (const p of recentPayments) {
            if (!p || !p.room_id || !p.due_date) continue;
            
            const dueYearMonth = p.due_date.substring(0, 7); // "2025-01"
            const mapKey = `${p.room_id}|${dueYearMonth}`;
            
            if (!existingPaymentsMap.has(mapKey)) {
                existingPaymentsMap.set(mapKey, {
                    id: p.id,
                    room_id: p.room_id,
                    due_date: p.due_date,
                    status: p.status
                });
            }
        }
        
        console.log(`🗺️ Existing payments map: ${existingPaymentsMap.size} unique room-month combinations`);
        console.log(`📅 Current date: ${currentDay}/${currentMonth + 1}/${currentYear} (Thailand time)`);
        console.log(`🔧 Force create: ${forceCreate}`);

        // ⭐⭐⭐ Normalize other entities - data might be inside .data property OR flat
        const normalizeEntity = (entity) => {
            if (!entity) return null;
            if (entity.data && typeof entity.data === 'object') {
                return { id: entity.id, ...entity.data };
            }
            return entity;
        };
        
        allRooms = allRooms.map(normalizeEntity).filter(Boolean);
        bookings = bookings.map(normalizeEntity).filter(Boolean);
        meterReadings = meterReadings.map(normalizeEntity).filter(Boolean);
        tenants = tenants.map(normalizeEntity).filter(Boolean);
        
        // Debug: log first room to verify structure
        if (allRooms.length > 0) {
            console.log(`🔍 Sample room after normalize:`, JSON.stringify({
                id: allRooms[0].id,
                room_type: allRooms[0].room_type,
                room_number: allRooms[0].room_number,
                branch_id: allRooms[0].branch_id
            }));
        }
        
        console.log(`📦 Normalized entities: ${allRooms.length} rooms, ${bookings.length} bookings, ${tenants.length} tenants`);

        // Filter Rooms with detailed logging
        const monthlyRooms = allRooms.filter(room => room.room_type === 'monthly');
        console.log(`🏠 Monthly rooms: ${monthlyRooms.length}`);

        const roomsWithBooking = monthlyRooms.filter(room => {
            return bookings.some(b => b.room_id === room.id);
        });
        console.log(`📋 Rooms with active booking: ${roomsWithBooking.length}`);

        // ⭐ ดึง unique branch IDs และเช็คว่าสาขาไหนตรงวันสร้างบิล
        const branchIds = [...new Set(roomsWithBooking.map(r => r.branch_id).filter(Boolean))];
        const branchGenDayMap = {};
        const branchesToProcess = [];
        const branchesSkipped = [];
        
        for (const branchId of branchIds) {
            const genDay = parseInt(getConfigValue('bill_generation_day', '27', branchId));
            branchGenDayMap[branchId] = genDay;
            
            if (forceCreate || currentDay === genDay) {
                branchesToProcess.push({ branchId, genDay });
            } else {
                branchesSkipped.push({ branchId, genDay, reason: `วันนี้ (${currentDay}) ไม่ตรงกับวันสร้างบิล (${genDay})` });
            }
        }

        console.log(`📆 สาขาที่จะสร้างบิลวันนี้: ${branchesToProcess.length} สาขา`);
        console.log(`⏭️ สาขาที่ข้าม: ${branchesSkipped.length} สาขา`);
        
        if (branchesSkipped.length > 0) {
            branchesSkipped.forEach(b => {
                console.log(`   - สาขา ${b.branchId}: ${b.reason}`);
            });
        }

        // กรองเฉพาะห้องที่อยู่ในสาขาที่ตรงวัน
        const branchIdsToProcess = branchesToProcess.map(b => b.branchId);
        let roomsToProcess = roomsWithBooking.filter(room => {
            return branchIdsToProcess.includes(room.branch_id);
        });

        console.log(`✅ Rooms to process (after branch/date filter): ${roomsToProcess.length}`);

        if (roomsToProcess.length === 0) {
            const reason = branchesSkipped.length > 0
                ? `ไม่มีสาขาที่ตรงวันสร้างบิลวันนี้ (${currentDay}) - สาขาที่ข้าม: ${branchesSkipped.map(b => `${b.branchId}(วันที่${b.genDay})`).join(', ')}`
                : 'ไม่มีห้องที่ต้องสร้างบิล';
            console.log(`⏭️ ${reason}`);
            return Response.json({ 
                success: true, 
                message: reason, 
                generatedCount: 0,
                debug: {
                    currentDay,
                    forceCreate,
                    totalRooms: allRooms.length,
                    monthlyRooms: monthlyRooms.length,
                    roomsWithBooking: roomsWithBooking.length,
                    branchGenDayMap,
                    branchesToProcess: branchesToProcess.map(b => b.branchId),
                    branchesSkipped: branchesSkipped.map(b => ({ id: b.branchId, genDay: b.genDay }))
                }
            });
        }

        // 4. Prepare Payments (In-Memory Calculation)
        const paymentsToCreate = [];
        const updatesToProcess = []; // For prepaid balance updates
        const billsToSend = [];
        let skippedDueToExistingBill = 0; // นับจำนวนห้องที่ข้ามเพราะมีบิลแล้ว
        
        // To map back created payments later
        const paymentReferenceMap = new Map(); // key: "room_id", value: metadata

        for (const room of roomsToProcess) {
            try {
                const activeBooking = bookings.find(b => b.room_id === room.id && b.status === 'active');
                if (!activeBooking) continue;

                // Check existing bill
                const roomBranchId = room.branch_id;
                const roomPayDay = parseInt(getConfigValue('pay_day', '5', roomBranchId));
                
                let roomDueYear = currentYear;
                let roomDueMonth = currentMonth;
                const roomGenDay = parseInt(getConfigValue('bill_generation_day', '27', roomBranchId));
                
                if (roomGenDay > roomPayDay) {
                    roomDueMonth = currentMonth + 1;
                    if (roomDueMonth > 11) { roomDueMonth = 0; roomDueYear = currentYear + 1; }
                }
                
                // ⭐ ตรวจสอบว่ามีบิลของเดือนนี้อยู่แล้วหรือไม่ (ป้องกันสร้างซ้ำ)
                // ใช้ Map lookup แทน array.find() เพื่อประสิทธิภาพสูงสุด O(1)
                const targetDueYearMonth = `${roomDueYear}-${String(roomDueMonth + 1).padStart(2, '0')}`; // e.g., "2025-01"
                const mapKey = `${room.id}|${targetDueYearMonth}`;
                
                let existingBill = existingPaymentsMap.get(mapKey) || null;

                // ⭐ FALLBACK: scan จาก normalizedPayments array
                if (!existingBill) {
                    for (const p of normalizedPayments) {
                        if (p.room_id === room.id && p.due_date && p.due_date.substring(0, 7) === targetDueYearMonth) {
                            existingBill = p;
                            break;
                        }
                    }
                }

                // ⭐⭐⭐ ถ้ามีบิลอยู่แล้ว = ข้ามไป (ไม่ว่าจะ force หรือไม่ก็ตาม)
                if (existingBill) {
                    skippedDueToExistingBill++;
                    
                    // ถ้าต้องการส่งแจ้งเตือนซ้ำ
                    if (resendNotifications) {
                        const tenant = tenants.find(t => t.id === activeBooking.tenant_id);
                        if (tenant?.line_user_id) {
                            billsToSend.push({ payment: existingBill, tenant, room });
                        }
                    }
                    continue;
                }

                // Calculate Amounts
                const roomMeters = meterReadings.filter(m => m.room_id === room.id);
                roomMeters.sort((a, b) => new Date(b.created_date || b.reading_date) - new Date(a.created_date || a.reading_date));
                
                let latestMeter = roomMeters.find(m => (m.water_units > 0 || m.electricity_units > 0)) || roomMeters[0] || null;
                
                let waterUnits = latestMeter?.water_units || 0;
                let elecUnits = latestMeter?.electricity_units || 0;
                
                // Rates
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

                // ⭐ ตรวจสอบค่าขั้นต่ำ
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

                // Parking & Tenant
                const tenant = tenants.find(t => t.id === activeBooking.tenant_id);
                
                if (!tenant || tenant.status === 'moved_out') {
                    console.log(`⏭️ Room ${room.room_number}: Tenant moved out or deleted - skip`);
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

                // Other Monthly Fees
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

                // Check Prepaid
                let status = 'pending';
                let paymentDate = null;
                const currentPrepaid = tenant?.prepaid_balance || 0;
                
                if (currentPrepaid >= totalAmount) {
                    status = 'paid';
                    paymentDate = format(thailandTime, 'yyyy-MM-dd');
                    updatesToProcess.push({ 
                        tenantId: tenant.id, 
                        newBalance: currentPrepaid - totalAmount 
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

                const dueDate = new Date(roomDueYear, roomDueMonth, roomPayDay);
                
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
            console.log(`🚀 Creating ${paymentsToCreate.length} bills in batches...`);
            
            const batches = [];
            for (let i = 0; i < paymentsToCreate.length; i += 50) {
                batches.push(paymentsToCreate.slice(i, i + 50));
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
                await delay(2000);
            }
        }

        // 6. Update Prepaid Balances
        if (updatesToProcess.length > 0) {
            console.log(`💰 Updating ${updatesToProcess.length} tenant balances...`);
            for (const update of updatesToProcess) {
                await retryOperation(async () => {
                    await base44.asServiceRole.entities.Tenant.update(update.tenantId, {
                        prepaid_balance: update.newBalance
                    });
                });
                await delay(200);
            }
        }

        // 7. Process invoice queue if needed
        let sentCount = 0;
        let failedCount = 0;
        let pendingImageCount = 0;
        
        if (billsToSend.length > 0) {
            console.log(`📝 ${billsToSend.length} bills marked for image generation`);
            pendingImageCount = billsToSend.length;
            
            const shouldAutoProcess = getConfigValue('auto_process_invoice_queue_after_generation', 'false', targetBranchId) === 'true';
            
            if (shouldAutoProcess && billsToSend.length <= 30) {
                console.log(`🚀 Auto-triggering processInvoiceImageQueue for ${billsToSend.length} bills...`);
                
                try {
                    const queueResult = await base44.asServiceRole.functions.invoke('processInvoiceImageQueue', {
                        branch_id: targetBranchId,
                        batch_size: Math.min(billsToSend.length, 30),
                        concurrent_limit: 3
                    });
                    
                    if (queueResult.data?.success) {
                        sentCount = queueResult.data.lineSent || 0;
                        failedCount = queueResult.data.lineFailed || 0;
                        console.log(`✅ processInvoiceImageQueue completed: sent ${sentCount}, failed ${failedCount}`);
                    }
                } catch (queueError) {
                    console.error(`⚠️ processInvoiceImageQueue error:`, queueError.message);
                }
            }
        }

        // Summary
        const monthName = thailandTime.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
        let summaryMessage = `สร้างบิลสำเร็จ ${createdCount} รายการ`;
        
        if (skippedDueToExistingBill > 0) {
            summaryMessage += `, ข้ามเพราะมีบิลแล้ว ${skippedDueToExistingBill} ห้อง`;
        }
        if (pendingImageCount > 0) {
            summaryMessage += `, รอสร้างรูป ${pendingImageCount} ใบ`;
        }
        if (sentCount > 0 || failedCount > 0) {
            summaryMessage += `, ส่งไลน์ ${sentCount} รายการ (ล้มเหลว ${failedCount})`;
        }

        const summaryData = {
            success: true,
            message: summaryMessage,
            generatedCount: createdCount,
            skippedDueToExistingBill,
            pendingImageCount,
            sentCount,
            failedCount,
            summary: {
                month: monthName,
                totalRoomsToProcess: roomsToProcess.length,
                created: createdCount,
                skipped: skippedDueToExistingBill,
                pendingImages: pendingImageCount,
                branchesSkipped: branchesSkipped.map(b => ({ id: b.branchId, genDay: b.genDay })),
            }
        };

        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'generateMonthlyBills',
                run_timestamp: new Date().toISOString(),
                status: 'success',
                message: summaryMessage,
                details: summaryData,
                triggered_by: targetBranchId ? 'manual_branch' : 'manual_all',
            });
        } catch (logError) {
            console.error('⚠️ Failed to write function log:', logError.message);
        }

        return Response.json(summaryData);

    } catch (error) {
        console.error('❌ Error:', error);

        if (base44) {
            try {
                await base44.asServiceRole.entities.FunctionLog.create({
                    function_name: 'generateMonthlyBills',
                    run_timestamp: new Date().toISOString(),
                    status: 'error',
                    message: error.message || 'Unknown error',
                    details: { error: error.stack || String(error) },
                    triggered_by: targetBranchId ? 'manual_branch' : (forceCreate ? 'manual_force' : 'scheduled'),
                });
            } catch (logError) {
                console.error('⚠️ Failed to write ERROR function log:', logError.message);
            }
        }

        return Response.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
    }
});