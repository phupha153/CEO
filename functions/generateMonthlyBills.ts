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
    let base44 = null;
    let targetBranchId = null;
    let forceCreate = false;
    let resendNotifications = false;
    
    try {
        console.log('🚀 Starting monthly bill generation (Optimized Batch Mode)...');

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
        // ⭐ existingPayments จะถูกสร้างเป็น Map หลังจาก fetch เพื่อเพิ่มประสิทธิภาพ
        let existingPaymentsMap = new Map(); // key: "room_id|YYYY-MM", value: payment object
        
        // ⭐ คำนวณช่วงเดือนที่จะตรวจสอบบิลที่มีอยู่ (เดือนปัจจุบัน + 2 เดือนถัดไป เผื่อ edge case)
        // ใช้ YYYY-MM format สำหรับเปรียบเทียบ เพื่อความง่ายและถูกต้อง
        const paymentCheckStartYearMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`; // e.g., "2025-11"
        
        // คำนวณ 2 เดือนถัดไป
        let endCheckYear = currentYear;
        let endCheckMonth = currentMonth + 2; // 0-indexed, so +2 = next 2 months
        if (endCheckMonth > 11) {
            endCheckMonth = endCheckMonth - 12;
            endCheckYear = currentYear + 1;
        }
        const paymentCheckEndYearMonth = `${endCheckYear}-${String(endCheckMonth + 1).padStart(2, '0')}`; // e.g., "2026-01"

        console.log(`🔍 Will check existing payments with due_date YYYY-MM between ${paymentCheckStartYearMonth} and ${paymentCheckEndYearMonth}`);
        
        await retryOperation(async () => {
            const filter = targetBranchId ? { branch_id: targetBranchId } : {};
            const bookingFilter = { ...filter, status: 'active' };

            // Parallel fetching for speed (ไม่ดึง Payment ตรงนี้ เพราะ filter complex ไม่ work)
            // ⭐ ลด limit เป็น 5000 เพื่อหลีกเลี่ยง "Limit too high" error
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

            const [r, b, m, t] = await Promise.all([
                fetchWithPagination(base44.asServiceRole.entities.Room, filter, '-room_number'),
                fetchWithPagination(base44.asServiceRole.entities.Booking, bookingFilter, '-created_date'),
                fetchWithPagination(base44.asServiceRole.entities.MeterReading, filter, '-reading_date'),
                fetchWithPagination(base44.asServiceRole.entities.Tenant, filter, '-created_date')
            ]);
            
            // ⭐ Ensure arrays even if fetch returns null/undefined
            allRooms = r || []; 
            bookings = b || []; 
            meterReadings = m || []; 
            tenants = t || [];
        });

        console.log(`📦 Fetched: ${allRooms.length} rooms, ${bookings.length} bookings`);
        
        // ⭐⭐⭐ ดึง Payment แยกต่างหาก โดยใช้ sort by due_date desc และ limit เฉพาะล่าสุด
        // เพื่อให้ได้เฉพาะ payments ที่เกี่ยวข้องกับเดือนปัจจุบัน/ถัดไป
        console.log(`🔍 Fetching recent payments with pagination...`);
        
        let recentPayments = [];
        await retryOperation(async () => {
            const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : {};
            
            // ⭐ ใช้ pagination สำหรับ payments ด้วย
            let allData = [];
            let skip = 0;
            let hasMore = true;
            const batchSize = 5000;
            
            while (hasMore) {
                const batch = await base44.asServiceRole.entities.Payment.filter(paymentFilter, '-created_date', batchSize, skip);
                if (!Array.isArray(batch) || batch.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(batch);
                    skip += batch.length;
                    console.log(`📊 Fetched ${allData.length} payments...`);
                    if (batch.length < batchSize) {
                        hasMore = false;
                    }
                }
            }
            recentPayments = allData;
        });
        
        console.log(`📦 Fetched ${(recentPayments || []).length} recent payments (raw)`);
        recentPayments = recentPayments || [];
        
        // ⭐⭐⭐ CRITICAL FIX: Normalize payments using same logic as other entities
        const normalizedPayments = [];
        
        for (const p of recentPayments) {
            if (!p) continue;
            
            // ใช้ logic เดียวกับ normalizeEntity
            let roomId, dueDate, bookingId, status, totalAmount;
            
            if (p.data && typeof p.data === 'object') {
                // ข้อมูลอยู่ใน p.data
                roomId = p.data.room_id;
                dueDate = p.data.due_date;
                bookingId = p.data.booking_id;
                status = p.data.status;
                totalAmount = p.data.total_amount;
            } else {
                // ข้อมูลอยู่ใน root level
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
        
        console.log(`📦 Normalized ${normalizedPayments.length} payments from ${recentPayments.length} raw`);
        
        // Debug: log sample payment
        if (normalizedPayments.length > 0) {
            console.log(`🔍 Sample payment: room_id=${normalizedPayments[0].room_id}, due_date=${normalizedPayments[0].due_date}`);
        }
        
        // ⭐ กรองเฉพาะ payments ที่ due_date อยู่ในช่วงที่ต้องการ และสร้าง Map
        // ใช้ YYYY-MM comparison แทน full date comparison
        let filteredPaymentsCount = 0;
        
        for (const p of normalizedPayments) {
            if (!p.due_date) continue;
            
            const dueYearMonth = p.due_date.substring(0, 7); // "2025-12"
            
            // เช็คว่า YYYY-MM อยู่ในช่วงหรือไม่
            if (dueYearMonth >= paymentCheckStartYearMonth && dueYearMonth <= paymentCheckEndYearMonth) {
                const mapKey = `${p.room_id}|${dueYearMonth}`;
                
                if (!existingPaymentsMap.has(mapKey)) {
                    existingPaymentsMap.set(mapKey, p);
                    filteredPaymentsCount++;
                }
            }
        }
        
        console.log(`📊 Added ${filteredPaymentsCount} payments to map (total unique: ${existingPaymentsMap.size})`);
        
        if (existingPaymentsMap.size > 0) {
            const sampleKeys = Array.from(existingPaymentsMap.keys()).slice(0, 10);
            console.log(`🔑 Sample map keys: ${sampleKeys.join(', ')}`);
        }
        
        // ⭐ DEBUG: แสดง due_date (YYYY-MM) ที่พบ
        if (normalizedPayments.length > 0) {
            const dueYearMonths = [...new Set(normalizedPayments.map(p => p.due_date?.substring(0, 7)).filter(Boolean))];
            console.log(`📅 Due YYYY-MM found in payments: ${dueYearMonths.join(', ')}`);
        }
        console.log(`📅 Current date: ${currentDay}/${currentMonth + 1}/${currentYear} (Thailand time)`);
        console.log(`🔧 Force create: ${forceCreate}`);

        // ⭐⭐⭐ CRITICAL: Normalize ALL entities - data might be inside .data property OR flat
        const normalizeEntity = (entity) => {
            if (!entity) return null;
            // ถ้ามี .data property = ข้อมูลอยู่ใน .data
            if (entity.data && typeof entity.data === 'object') {
                return { id: entity.id, ...entity.data };
            }
            // ถ้าไม่มี .data = ข้อมูลอยู่ใน root level แล้ว
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
                const targetDueYearMonth = `${roomDueYear}-${String(roomDueMonth + 1).padStart(2, '0')}`; // e.g., "2025-12"
                const mapKey = `${room.id}|${targetDueYearMonth}`;
                
                let existingBill = existingPaymentsMap.get(mapKey) || null;
                
                // ⭐ FALLBACK: scan จาก normalizedPayments array (ใช้ normalizedPayments ไม่ใช่ recentPayments!)
                if (!existingBill) {
                    for (const p of normalizedPayments) {
                        if (p.room_id === room.id && p.due_date && p.due_date.substring(0, 7) === targetDueYearMonth) {
                            existingBill = p;
                            break;
                        }
                    }
                }
                
                if (existingBill) {
                    console.log(`✅ Room ${room.room_number}: Found bill ${existingBill.id} for ${targetDueYearMonth}`);
                } else {
                    console.log(`📝 Room ${room.room_number}: No bill for ${targetDueYearMonth}, creating...`);
                }

                // ⭐⭐⭐ ถ้ามีบิลอยู่แล้ว = ข้ามไป (ไม่ว่าจะ force หรือไม่ก็ตาม)
                // เพื่อป้องกันการสร้างบิลซ้ำเมื่อ cron job รันหลายรอบต่อวัน
                if (existingBill) {
                    console.log(`⏭️ Room ${room.room_number}: มีบิลเดือน ${roomDueMonth + 1}/${roomDueYear} อยู่แล้ว (ID: ${existingBill.id}) - ข้าม`);
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

                // Calculate Amounts - ⭐ หามิเตอร์ล่าสุดที่มีค่าหน่วยมากกว่า 0 (ถ้ามี)
                const roomMeters = meterReadings.filter(m => m.room_id === room.id);
                // เรียงตาม created_date desc เพื่อให้ได้ล่าสุดจริงๆ
                roomMeters.sort((a, b) => new Date(b.created_date || b.reading_date) - new Date(a.created_date || a.reading_date));
                
                // หามิเตอร์ที่มีหน่วยมากกว่า 0 ก่อน ถ้าไม่มีค่อยใช้ตัวแรก
                let latestMeter = roomMeters.find(m => (m.water_units > 0 || m.electricity_units > 0)) || roomMeters[0] || null;
                
                let waterUnits = latestMeter?.water_units || 0;
                let elecUnits = latestMeter?.electricity_units || 0;
                
                // Rates (Priority: Room specific > Branch Config > Default)
                // ⭐ ใช้ !== undefined && !== null เพื่อให้ค่า 0 ใช้งานได้
                const waterRate = (room.water_rate !== undefined && room.water_rate !== null) 
                    ? parseFloat(room.water_rate) 
                    : parseFloat(getConfigValue('water_rate', '18', roomBranchId));
                const elecRate = (room.electricity_rate !== undefined && room.electricity_rate !== null) 
                    ? parseFloat(room.electricity_rate) 
                    : parseFloat(getConfigValue('electricity_rate', '7', roomBranchId));
                // ⭐ ค่าส่วนกลาง - ใช้ค่าของห้อง (รวมถึง 0) ถ้ามีการตั้งค่าไว้
                const commonFee = (room.common_fee !== undefined && room.common_fee !== null) 
                    ? parseFloat(room.common_fee) 
                    : parseFloat(getConfigValue('common_fee', '0', roomBranchId));
                
                console.log(`🏠 Room ${room.room_number}: common_fee from room = ${room.common_fee}, final = ${commonFee}`);

                const internetRate = parseFloat(getConfigValue('internet_rate', '0', roomBranchId)); // Default changed to 0
                const carFee = parseFloat(getConfigValue('car_parking_fee', '0', roomBranchId));
                const motoFee = parseFloat(getConfigValue('motorcycle_parking_fee', '0', roomBranchId));

                // ⭐ ตรวจสอบค่าขั้นต่ำสำหรับน้ำและไฟ
                let waterMinimumApplied = false;
                let electricityMinimumApplied = false;
                let waterMinimumCharge = 0;
                let electricityMinimumCharge = 0;
                const originalWaterUnits = waterUnits;
                const originalElecUnits = elecUnits;

                // ค่าน้ำขั้นต่ำ - ใช้เมื่อหน่วยเป็น 0 หรือน้อยกว่าขั้นต่ำ
                const waterMinEnabled = getConfigValue('water_minimum_enabled', 'false', roomBranchId) === 'true';
                if (waterMinEnabled) {
                    const minUnits = parseFloat(getConfigValue('water_minimum_units', '3', roomBranchId));
                    const minCharge = parseFloat(getConfigValue('water_minimum_charge', '0', roomBranchId));

                    // ⭐ ใช้ค่าขั้นต่ำเมื่อหน่วย = 0 หรือน้อยกว่าขั้นต่ำ
                    if (waterUnits <= minUnits && minCharge > 0) {
                        waterMinimumCharge = minCharge;
                        waterMinimumApplied = true;
                    }
                }

                // ค่าไฟขั้นต่ำ - ใช้เมื่อหน่วยเป็น 0 หรือน้อยกว่าขั้นต่ำ
                const elecMinEnabled = getConfigValue('electricity_minimum_enabled', 'false', roomBranchId) === 'true';
                if (elecMinEnabled) {
                    const minUnits = parseFloat(getConfigValue('electricity_minimum_units', '3', roomBranchId));
                    const minCharge = parseFloat(getConfigValue('electricity_minimum_charge', '0', roomBranchId));

                    // ⭐ ใช้ค่าขั้นต่ำเมื่อหน่วย = 0 หรือน้อยกว่าขั้นต่ำ
                    if (elecUnits <= minUnits && minCharge > 0) {
                        electricityMinimumCharge = minCharge;
                        electricityMinimumApplied = true;
                    }
                }

                // Parking
                const tenant = tenants.find(t => t.id === activeBooking.tenant_id);
                
                // ⭐ ข้ามห้องนี้ถ้าผู้เช่าย้ายออกแล้ว
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

                // Other Monthly Fees (Room Specific)
                let otherMonthlyFeesAmount = 0;
                let otherFeesDetails = '';
                
                // Check for room-specific other fees (new format or old format)
                if (room.other_monthly_fees && Array.isArray(room.other_monthly_fees)) {
                    // Sum up other fees from room
                    room.other_monthly_fees.forEach(fee => {
                        if (fee.amount > 0) {
                            otherMonthlyFeesAmount += fee.amount;
                            otherFeesDetails += `, ${fee.name} ${fee.amount.toLocaleString()} บาท`;
                        }
                    });
                }

                // ⭐ คำนวณค่าน้ำ/ไฟ - ถ้าใช้ค่าขั้นต่ำให้ใช้ค่าขั้นต่ำแทนการคำนวณจากหน่วย
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
                    water_units: originalWaterUnits, // ใช้หน่วยจริงที่อ่านมา
                    water_rate: waterRate,
                    water_amount: waterAmount, // ใช้ค่าที่คำนวณแล้ว (อาจเป็นค่าขั้นต่ำ)
                    electricity_units: originalElecUnits, // ใช้หน่วยจริงที่อ่านมา
                    electricity_rate: elecRate,
                    electricity_amount: electricityAmount, // ใช้ค่าที่คำนวณแล้ว (อาจเป็นค่าขั้นต่ำ)
                    internet_amount: internetRate,
                    common_fee_amount: commonFee,
                    parking_fee_amount: parkingAmount, // ⭐ แยกค่าที่จอดรถเป็น field ต่างหาก
                    other_amount: otherMonthlyFeesAmount, // ⭐ ไม่รวมค่าที่จอดรถแล้ว
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

        // 5. Bulk Create Payments (Batch of 50) - 1 Call per 50 rooms
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
                    
                    // Map back for image generation (ทุกสาขา) และ LINE notifications (เฉพาะสาขาที่เปิด)
                    for (const payment of created) {
                        const meta = paymentReferenceMap.get(payment.room_id);
                        if (meta) {
                            // ⭐ สร้างรูปทุกสาขา แต่ส่ง LINE เฉพาะสาขาที่เปิด auto_send
                            const shouldSendLine = meta.tenant?.line_user_id && 
                                getConfigValue('auto_send_bills_after_generation', 'false', payment.branch_id) === 'true';
                            
                            billsToSend.push({ 
                                payment, 
                                tenant: meta.tenant, 
                                room: meta.room,
                                shouldSendLine // ⭐ flag บอกว่าต้องส่ง LINE หรือไม่
                            });
                        }
                    }
                    createdCount += created.length;
                });
                await delay(2000); // Safety delay between batches
            }
        }

        // 6. Update Prepaid Balances (Sequential with delay)
        if (updatesToProcess.length > 0) {
            console.log(`💰 Updating ${updatesToProcess.length} tenant balances...`);
            for (const update of updatesToProcess) {
                await retryOperation(async () => {
                    await base44.asServiceRole.entities.Tenant.update(update.tenantId, {
                        prepaid_balance: update.newBalance
                    });
                });
                await delay(200); // 200ms delay per update to be safe
            }
        }

        // 7. ⭐⭐⭐ ไม่สร้างรูปและส่ง LINE ที่นี่แล้ว - ใช้ processInvoiceImageQueue แทน
        // ฟังก์ชันนี้จะแค่สร้างบิล (Payment records) เท่านั้น
        // การสร้างรูปใบแจ้งหนี้และส่ง LINE จะทำผ่าน processInvoiceImageQueue
        // ซึ่งจะสร้างรูปทีละ 3 ใบพร้อมกัน และส่ง LINE ทีละใบ
        
        let sentCount = 0;
        let failedCount = 0;
        let pendingImageCount = 0;
        
        // ⭐ ตั้งสถานะให้บิลใหม่ทั้งหมดเป็น "รอสร้างรูป" (invoice_image_status = 'pending')
        // processInvoiceImageQueue จะดึงไปสร้างรูปและส่ง LINE ทีหลัง
        if (billsToSend.length > 0) {
            console.log(`📝 ${billsToSend.length} bills marked for image generation (will be processed by processInvoiceImageQueue)`);
            pendingImageCount = billsToSend.length;
            
            // ⭐ ถ้าเปิด auto_send และต้องการให้ส่งทันที = เรียก processInvoiceImageQueue
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
                    console.error(`⚠️ processInvoiceImageQueue error (will retry via cron):`, queueError.message);
                }
            } else {
                console.log(`📋 Bills queued for later processing via Cron Job or manual trigger`);
            }
        }

        // สร้างข้อความสรุปผล
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