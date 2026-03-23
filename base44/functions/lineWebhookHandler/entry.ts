import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import { parseISO, differenceInDays } from 'npm:date-fns@3.0.0';

// ⭐ Helper: เช็คเลขบัญชีแบบปลอดภัย (Minified)
function isAccountMatch(m, r) {
    if(!m||!r) return false;
    let s = String(m).replace(/[- ]/g,'').toLowerCase();
    let a = String(r).replace(/[- ]/g,'').toLowerCase();
    if(s.startsWith('66')&&s.length===11) s='0'+s.slice(2);
    if(a.startsWith('66')&&a.length===11) a='0'+a.slice(2);
    let c=0, i=s.length-1, j=a.length-1;
    while(i>=0&&j>=0){
        if(s[i]==='x'||s[i]==='*'){i--;j--;continue;}
        if(s[i]===a[j]){c++;i--;j--;}else return false;
    }
    return c>=(s.replace(/[x*]/g,'').length<=3?2:3);
}

// ⭐ Inline helper function (ไม่ import จากไฟล์อื่น เพื่อหลีกเลี่ยง path issues)
function calculateLateFee(payment, configs, branchId, calculationDate = null) {
    console.log(`🧮 LateFee: ${payment?.id?.substring(0, 8)}... | Due: ${payment?.due_date} | Status: ${payment?.status}`);
    
    if (!payment || !payment.due_date) {
        console.log('  ⏭️ SKIP: No due_date');
        return { lateFeeAmount: 0, daysLate: 0 };
    }
    
    // 🔒 LOCK 1: ถ้าชำระแล้ว
    if (payment.status === 'paid') {
        console.log(`  🔒 SKIP: Already paid (locked: ${payment.late_fee_amount || 0}฿)`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    // 🔒 LOCK 2: ถ้า admin ล็อคค่าปรับ
    if (payment.late_fee_locked === true) {
        console.log(`  🔒 SKIP: Admin locked (${payment.late_fee_amount || 0}฿)`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    const calcDate = calculationDate || new Date();
    
    // 🔒 LOCK 3: เช็คว่าคำนวณวันนี้แล้วหรือยัง (ทำงานเสมอ ไม่ว่า calculationDate มีค่าหรือไม่)
    console.log(`  🔍 LOCK 3 Check: late_fee_last_calculated=${payment.late_fee_last_calculated || 'null'}`);
    if (payment.late_fee_last_calculated) {
        // แปลง timestamp ที่บันทึก (UTC) ให้เป็นวันในเวลาไทย
        const lastCalcDate = new Date(payment.late_fee_last_calculated);
        const lastCalcThailand = new Date(lastCalcDate.getTime() + (7 * 60 * 60 * 1000));
        const lastCalcDay = new Date(lastCalcThailand.getFullYear(), lastCalcThailand.getMonth(), lastCalcThailand.getDate());
        
        // วันนี้ในเวลาไทย
        const now = new Date();
        const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const today = new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate());
        
        console.log(`  🔍 LastCalc(TH): ${lastCalcDay.toISOString().split('T')[0]} | Today(TH): ${today.toISOString().split('T')[0]} | Match: ${lastCalcDay.getTime() === today.getTime()}`);
        
        if (lastCalcDay.getTime() === today.getTime()) {
            console.log(`  ✅ SKIP: Already calculated today (${payment.late_fee_amount || 0}฿)`);
            return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
        }
    } else {
        console.log(`  ⚠️ No late_fee_last_calculated → Will calculate`);
    }

    try {
        const dueDate = parseISO(payment.due_date);
        const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const calcDateStart = new Date(calcDate.getFullYear(), calcDate.getMonth(), calcDate.getDate());
        const daysOverdue = differenceInDays(calcDateStart, dueDateStart);

        if (daysOverdue <= 0) return { lateFeeAmount: 0, daysLate: 0 };

        const getConfigValue = (key, defaultValue = null) => {
            const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
            if (branchConfig?.value !== undefined && branchConfig?.value !== null) return branchConfig.value;
            
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value !== undefined && globalConfig?.value !== null ? globalConfig.value : defaultValue;
        };

        const tiersEnabled = getConfigValue('late_fee_tiers_enabled') === 'true';

        if (tiersEnabled) {
            const tiersConfigValue = getConfigValue('late_fee_tiers');

            if (tiersConfigValue) {
                try {
                    const tiers = JSON.parse(tiersConfigValue);
                    let totalFee = 0;

                    for (const tier of tiers) {
                        const daysFrom = tier.days_from || 1;
                        const daysTo = tier.days_to || 999;
                        const feePerDay = parseFloat(tier.fee_per_day || 0);

                        if (daysOverdue >= daysFrom) {
                            const daysInThisTier = Math.min(daysOverdue, daysTo) - daysFrom + 1;
                            if (daysInThisTier > 0) {
                                totalFee += daysInThisTier * feePerDay;
                            }
                        }

                        if (daysOverdue <= daysTo) break;
                    }

                    console.log(`  ✅ Tiered: ${daysOverdue}d → ${totalFee}฿`);
                    return { lateFeeAmount: totalFee, daysLate: daysOverdue };
                } catch (e) {
                    console.error('Error parsing late fee tiers:', e);
                }
            }
        }

        const lateFeePerDay = parseFloat(getConfigValue('late_payment_fee_per_day', '0'));
        
        if (lateFeePerDay === 0 || isNaN(lateFeePerDay)) {
            console.log('  ⏭️ SKIP: No late fee config');
            return { lateFeeAmount: 0, daysLate: daysOverdue };
        }

        const simpleFee = daysOverdue * lateFeePerDay;
        console.log(`  ✅ Simple: ${daysOverdue}d × ${lateFeePerDay}฿ = ${simpleFee}฿`);
        return { lateFeeAmount: simpleFee, daysLate: daysOverdue };
    } catch (error) {
        console.error('Error calculating late fee:', error);
        return { lateFeeAmount: 0, daysLate: 0 };
    }
}

const processedMessages = new Set();

// Rate limiting cache - ป้องกันส่งข้อความซ้ำๆ ใน 5 นาที
const messageSentCache = new Map();

// Cache สำหรับ Config - ป้องกันการ query ซ้ำๆ
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5 นาที (ลด query ซ้ำซ้อน)

// ⭐ Branch-specific Config Cache (แยก cache ตามสาขา)
const branchConfigCache = new Map();
const BRANCH_CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5 นาที (ลด query ซ้ำซ้อน)
const MAX_BRANCH_CONFIG_CACHE_SIZE = 1000; // ⭐ จำกัดไม่ให้เกิน 1000 สาขา

// ⭐ Branches Cache (ลด query ซ้ำซ้อน)
let branchesCache = null;
let branchesCacheTime = 0;
const BRANCHES_CACHE_DURATION = 5 * 60 * 1000; // 5 นาที

async function getLineToken(base44, branchId = null) {
    try {
        const cacheKey = branchId || 'global';
        const cached = branchConfigCache.get(cacheKey);

        if (cached && (Date.now() - cached.timestamp) < BRANCH_CONFIG_CACHE_DURATION) {
            console.log(`✅ Using cached token for: ${cacheKey}`);
            return cached.token;
        }

        const configs = await base44.asServiceRole.entities.Config.list();

        if (branchId) {
            const branchToken = configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branchId);
            if (branchToken?.value?.trim()) {
                const token = branchToken.value.trim();
                
                // ⭐ Evict oldest entry ถ้า cache เต็ม
                if (branchConfigCache.size >= MAX_BRANCH_CONFIG_CACHE_SIZE) {
                    const oldestKey = branchConfigCache.keys().next().value;
                    branchConfigCache.delete(oldestKey);
                    console.log(`🗑️ Cache evicted: ${oldestKey}`);
                }
                
                branchConfigCache.set(cacheKey, { token, timestamp: Date.now() });
                return token;
            }
        }

        const globalToken = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
        if (globalToken?.value?.trim()) {
            const token = globalToken.value.trim();
            
            // ⭐ Evict oldest entry ถ้า cache เต็ม
            if (branchConfigCache.size >= MAX_BRANCH_CONFIG_CACHE_SIZE) {
                const oldestKey = branchConfigCache.keys().next().value;
                branchConfigCache.delete(oldestKey);
            }
            
            branchConfigCache.set(cacheKey, { token, timestamp: Date.now() });
            return token;
        }

        const secretToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
        if (secretToken?.trim()) {
            return secretToken.trim();
        }

        console.warn('⚠️ No LINE token found');
        return null;
    } catch (error) {
        console.error('❌ Error fetching LINE token:', error);
        const secretToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
        return secretToken?.trim() || null;
    }
}

async function getBranchIdFromDestination(base44, destination) {
    if (!destination) return null;

    try {
        const now = Date.now();
        if (!configCache || (now - configCacheTime) > CONFIG_CACHE_DURATION) {
            configCache = await base44.asServiceRole.entities.Config.list();
            configCacheTime = now;
        }

        const matchingConfig = configCache.find(c => 
            c.key === 'line_oa_user_id' && c.value === destination && c.branch_id
        );

        if (matchingConfig) {
            console.log(`✅ Found branch from destination: ${matchingConfig.branch_id.substring(0, 12)}...`);
            return matchingConfig.branch_id;
        }

        console.log(`⚠️ No branch found for destination: ${destination.substring(0, 20)}...`);
        return null;
    } catch (error) {
        console.error('❌ Error finding branch from destination:', error);
        return null;
    }
}

Deno.serve(async (req) => {
    const url = new URL(req.url);
    const queryBranchId = url.searchParams.get('branch_id');
    const challenge = url.searchParams.get('challenge');

    // ⭐ LINE Challenge Request (verification)
    if (challenge) {
        console.log(`✅ LINE Challenge received: ${challenge.substring(0, 20)}...`);
        return new Response(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    if (req.method !== 'POST') return new Response(JSON.stringify({ message: 'OK' }), { status: 200 });
    let body;
    try { body = await req.json(); } catch (e) { return new Response(JSON.stringify({ success: true }), { status: 200 }); }

    const base44 = createClientFromRequest(req);

    (async () => {
        try {
            const events = body.events || [];
            if (events.length === 0) return;
            
            let destinationBranchId = queryBranchId;
            try { if (queryBranchId) { const bRes = await base44.asServiceRole.entities.Branch.filter({ id: queryBranchId }); const branch = Array.isArray(bRes) ? bRes[0] : bRes; if (branch) { const ownerEmail = branch.owner_id || branch.created_by; const defKey = ownerEmail ? 'default_communication_branch_' + ownerEmail : 'default_communication_branch'; const d = await base44.asServiceRole.entities.Config.filter({ key: defKey, branch_id: null }, '', 1); const v = Array.isArray(d) ? d[0]?.value : d?.value; if (v && v !== 'none') destinationBranchId = v; } } } catch(e) {}

            for (const event of events) {
                const lineUserId = event.source?.userId;
                const replyToken = event.replyToken; // ⭐ ดึง replyToken จาก event
                
                if (!lineUserId) continue;

                if (event.type === 'follow') {
                    continue;
                }

                if (event.type === 'postback') {
                    const postbackData = event.postback?.data || '';
                    
                    if (postbackData.startsWith('cancel_old_expense')) {
                        await handleCancelOldExpense(base44, lineUserId, replyToken, destinationBranchId);
                        continue;
                    }
                    
                    if (postbackData.startsWith('keep_old_expense')) {
                        await handleKeepOldExpense(base44, lineUserId, replyToken, destinationBranchId);
                        continue;
                    }
                    
                    if (postbackData === 'upload_receipt_image') {
                        await sendMessage(base44, lineUserId, 
                            '📸 กรุณาส่งรูปใบเสร็จ/บิล\n\nระบบจะนำข้อมูลจากรูปมาผสานกับข้อมูลที่คุณป้อนไว้แล้วค่ะ',
                            destinationBranchId,
                            replyToken
                        );
                        continue;
                    }
                }

                if (event.type === 'message') {
                    const messageId = event.message?.id;
                    const messageType = event.message?.type;
                    
                    if (messageId && processedMessages.has(messageId)) {
                        continue;
                    }
                    
                    if (messageId) {
                        processedMessages.add(messageId);
                        if (processedMessages.size > 500) {
                            const firstItem = processedMessages.values().next().value;
                            processedMessages.delete(firstItem);
                        }
                    }

                    // ⭐ บันทึกข้อความลง LineMessage entity สำหรับระบบแชท
                    try {
                        // ⭐ CRITICAL: Filter by branch_id AND line_user_id
                        let tenant = null;
                        let msgBranchId = destinationBranchId;
                        try {
                            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
                            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
                            if (tenant) msgBranchId = tenant.branch_id;
                        } catch (e) {}
                        const finalBranchId = msgBranchId;

                        // ดึง LINE Profile เสมอ
                        let displayName = null;
                        let pictureUrl = null;
                        
                        try {
                            const lineToken = await getLineToken(base44, msgBranchId);
                            if (lineToken) {
                                const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
                                    headers: { 'Authorization': `Bearer ${lineToken}` }
                                });
                                if (profileRes.ok) {
                                    const profile = await profileRes.json();
                                    displayName = profile.displayName;
                                    pictureUrl = profile.pictureUrl;
                                    console.log(`✅ Got LINE profile: ${displayName}, pic: ${pictureUrl ? 'YES' : 'NO'}`);
                                }
                            }
                        } catch (profileError) {
                            console.log('⚠️ Could not fetch LINE profile:', profileError.message);
                        }
                        
                        // Fallback to tenant name if no LINE profile
                        if (!displayName && tenant?.full_name) {
                            displayName = tenant.full_name;
                        }

                        const messageContent = messageType === 'text' 
                            ? event.message.text 
                            : `[${messageType}]`;

                        await base44.asServiceRole.entities.LineMessage.create({
                            branch_id: finalBranchId,
                            tenant_id: tenant?.id || null,
                            line_user_id: lineUserId,
                            line_display_name: displayName,
                            line_picture_url: pictureUrl,
                            direction: 'incoming',
                            message_type: messageType === 'text' ? 'text' : 
                                         messageType === 'image' ? 'image' : 
                                         messageType === 'sticker' ? 'sticker' : 'other',
                            content: messageContent,
                            reply_token: replyToken
                        });
                        console.log(`💾 Saved incoming message to LineMessage entity`);
                    } catch (saveError) {
                        console.error('⚠️ Failed to save message to LineMessage:', saveError.message);
                    }
                    
                    if (messageType === 'text') {
                        const messageText = event.message.text?.trim() || '';
                        console.log(`📝 Received text: "${messageText}"`);
                        
                        // ⭐⭐⭐ เช็คว่าเป็นพนักงานที่เชื่อม LINE แล้วหรือไม่
                        let employee = null;
                        try {
                            console.log('🔍 Checking for employee with LINE ID:', lineUserId);
                            const employeeResult = await base44.asServiceRole.entities.User.filter({
                                employee_line_user_id: lineUserId,
                                can_submit_expenses: true
                            });
                            employee = Array.isArray(employeeResult) ? employeeResult[0] : employeeResult;
                            console.log(`📊 Employee query result:`, employee ? `✅ FOUND: ${employee.email}` : '❌ NOT FOUND');
                        } catch (e) {
                            console.log('⚠️ Not an employee:', e.message);
                        }

                        // ⭐ ถ้าเป็นพนักงาน → จัดการ Expense Submission
                        if (employee) {
                            await handleEmployeeExpenseSubmission(base44, lineUserId, employee, messageText, replyToken, destinationBranchId);
                            continue;
                        }
                        
                        // ⭐ ถ้าพิมพ์ "ลงทะเบียน" → แสดงขั้นตอนการลงทะเบียน
                        if (messageText.toLowerCase().includes('ลงทะเบียน')) {
                            console.log('📝 User asking for registration instructions');
                            // ⭐ ใช้ destinationBranchId เพื่อหา token ที่ถูกต้อง
                            await sendMessage(base44, lineUserId, 
                                '📋 ขั้นตอนการลงทะเบียน\n\n' +
                                'กรุณาส่งข้อมูลอย่างใดอย่างหนึ่ง:\n\n' +
                                '1️⃣ เบอร์โทรศัพท์ (10 หลัก)\n' +
                                '   ตัวอย่าง: 0812345678\n\n' +
                                '2️⃣ ชื่อ-นามสกุล\n' +
                                '   ตัวอย่าง: สมชาย ใจดี\n\n' +
                                '💡 ระบบจะค้นหาข้อมูลของคุณในระบบ\n' +
                                'และแจ้งยืนยันห้องพักก่อนลงทะเบียนค่ะ',
                                destinationBranchId,
                                replyToken
                            );
                            continue;
                        }

                        if (messageText.includes('แจ้งซ่อม') || messageText.includes('เเจ้งซ่อม')) {
                            console.log('🔧 Detected maintenance request keyword');
                            let tenant = null;
                            try {
                                const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
                                tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
                            } catch (e) {
                                console.log('⚠️ Could not find tenant:', e.message);
                            }
                            const branchId = tenant?.branch_id || destinationBranchId;
                            
                            console.log(`👤 Tenant found: ${tenant?.full_name || 'Not found'}, Branch: ${branchId}`);

                            if (!tenant) {
                                await sendMessage(base44, lineUserId, 
                                    '❌ กรุณาลงทะเบียนก่อนใช้งานค่ะ\n\n' +
                                    'พิมพ์เบอร์โทรศัพท์ (10 หลัก) หรือ ชื่อ-นามสกุล เพื่อลงทะเบียน',
                                    destinationBranchId,
                                    replyToken
                                );
                                continue;
                            }

                            // ⭐ ถ้าพิมพ์ "แจ้งซ่อม" ตามด้วยรายละเอียด → บันทึกเลย
                            // เช่น "แจ้งซ่อม แอร์ไม่เย็น" หรือ "แจ้งซ่อม ไฟดับ"
                            const maintenanceKeywords = ['แจ้งซ่อม', 'แจ้ง ซ่อม', 'เเจ้งซ่อม', 'เเจ้ง ซ่อม'];
                            let problemDescription = messageText;
                            
                            for (const keyword of maintenanceKeywords) {
                                if (messageText.toLowerCase().includes(keyword)) {
                                    problemDescription = messageText.replace(new RegExp(keyword, 'gi'), '').trim();
                                    break;
                                }
                            }
                            
                            // ถ้ามีรายละเอียดปัญหา (มากกว่า 2 ตัวอักษร) → บันทึกเลย
                            if (problemDescription.length > 2) {
                                console.log(`📝 Processing maintenance with description: "${problemDescription}"`);
                                await handleMaintenanceReport(base44, lineUserId, problemDescription, branchId, replyToken);
                            } else {
                                // ถ้าพิมพ์แค่ "แจ้งซ่อม" → ขอรายละเอียดเพิ่ม
                                await sendMessage(base44, lineUserId, 
                                    '🔧 ระบบแจ้งซ่อม\n\n' +
                                    'กรุณาพิมพ์ "แจ้งซ่อม" ตามด้วยรายละเอียดปัญหาค่ะ\n\n' +
                                    'ตัวอย่าง:\n' +
                                    '• แจ้งซ่อม ไฟห้องดับ สวิตช์ชำรุด\n' +
                                    '• แจ้งซ่อม แอร์ไม่เย็น มีเสียงดัง\n' +
                                    '• แจ้งซ่อม ประปารั่ว ท่อแตก',
                                    branchId,
                                    replyToken
                                );
                            }
                            console.log('✅ Processed maintenance request');
                            continue;
                        }
                        
                        const phoneWithBranchPattern = /^(0\d{9})\s+([A-Z0-9\-]+)$/i;
                        const phoneOnlyPattern = /^0\d{9}$/;

                        if (phoneWithBranchPattern.test(messageText)) {
                            const match = messageText.match(phoneWithBranchPattern);
                            const phone = match[1];
                            const branchCode = match[2].toUpperCase();
                            console.log(`✅ Phone with branch: ${phone} - ${branchCode}`);
                            await handlePhoneNumberRegistration(base44, lineUserId, phone, branchCode, replyToken, null);
                            continue;
                        } else if (phoneOnlyPattern.test(messageText)) {
                            console.log(`✅ Phone only: ${messageText}, destinationBranch: ${destinationBranchId || 'null'}`);
                            // ⭐ ส่ง destinationBranchId ไปด้วยเพื่อช่วย filter
                            await handlePhoneNumberRegistration(base44, lineUserId, messageText, null, replyToken, destinationBranchId);
                            continue;
                        }
                        
                        let tenant = null;
                        try {
                            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
                            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
                        } catch (e) {}
                        const userBranchId = tenant?.branch_id || destinationBranchId;

                        console.log(`📍 User branch for text message: ${userBranchId ? userBranchId.substring(0, 12) + '...' : 'null (ไม่รู้สาขา)'}`);

                        if (!tenant) {
                            // ถ้ายังไม่ลงทะเบียน และไม่ใช่เบอร์โทร ลองค้นหาด้วยชื่อ
                            console.log(`🔍 Not registered yet. Trying name registration for: "${messageText}"`);
                            // ถ้าข้อความยาวพอสมควร (เช่น 3 ตัวอักษรขึ้นไป)
                            if (messageText.length >= 3) {
                                await handleNameRegistration(base44, lineUserId, messageText, replyToken);
                                continue;
                            }
                        }

                        // ⭐ ถ้าลงทะเบียนแล้ว และพิมพ์ข้อความทั่วไป → ไม่ตอบอะไรเลย
                        if (tenant) {
                            console.log('ℹ️ Registered user sent general message - NOT responding (silent)');
                            continue;
                        }

                        // ⭐ ไม่ตอบอะไรถ้าข้อความไม่เข้าใจ (ไม่ใช่คำสั่งที่รู้จัก)
                    console.log('ℹ️ Unknown message, not responding');
                    continue;
                    }
                    
                    if (messageType === 'image' && messageId) {
                                        console.log(`📸 Image received from ${lineUserId}`);
                                        
                                        // ⭐ เช็คพนักงานก่อน
                                        let employee = null;
                                        try {
                                            const employeeResult = await base44.asServiceRole.entities.User.filter({
                                                employee_line_user_id: lineUserId,
                                                can_submit_expenses: true
                                            });
                                            employee = Array.isArray(employeeResult) ? employeeResult[0] : employeeResult;
                                        } catch (e) {
                                            console.log('⚠️ Not an employee:', e.message);
                                        }

                                        if (employee) {
                                            await handleEmployeeExpenseImage(base44, lineUserId, employee, messageId, replyToken, destinationBranchId);
                                            continue;
                                        }
                                        
                                        let tenant = null;
                                        try {
                                            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
                                            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
                                            if (tenant) destinationBranchId = tenant.branch_id;
                                        } catch (e) {}

                                        // ⭐ ถ้าไม่ได้เชื่อมต่อ (ไม่มี tenant) → ไม่ตอบอะไรเลย
                                        if (!tenant) {
                                            console.log(`ℹ️ User ${lineUserId} not connected - ignoring image, no response`);
                                            continue;
                                        }

                                        const branchId = tenant.branch_id || destinationBranchId;

                                        // ⭐ เช็คว่ามี payment ที่รอชำระหรือชำระไม่ครบ (pending/overdue/partial_paid)
                                        let hasPendingPayment = false;
                                        try {
                                            const paymentResult = await base44.asServiceRole.entities.Payment.filter({ 
                                                tenant_id: tenant.id
                                            });
                                            const allPayments = Array.isArray(paymentResult) ? paymentResult : (paymentResult ? [paymentResult] : []);
                                            hasPendingPayment = allPayments.some(p => 
                                                p.status === 'pending' || 
                                                p.status === 'overdue' || 
                                                p.status === 'partial_paid'
                                            );
                                        } catch (e) {
                                            console.log('⚠️ Could not check payments:', e.message);
                                        }

                                        // ⭐ ดาวน์โหลดและอัปโหลดรูปก่อน (เพื่อให้ได้ media_url)
                                        let imageUrl = null;
                                        try {
                                            const lineToken = await getLineToken(base44, branchId);
                                            if (lineToken) {
                                                const imageResponse = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
                                                    headers: { 'Authorization': `Bearer ${lineToken}` }
                                                });
                                                if (imageResponse.ok) {
                                                    const b = await imageResponse.arrayBuffer();
                                                    const file = new File([new Blob([b], { type: 'image/jpeg' })], `line.jpg`, { type: 'image/jpeg' });
                                                    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
                                                    imageUrl = uploadResult.file_url;
                                                    console.log(`✅ Uploaded image: ${imageUrl}`);
                                                }
                                            }
                                        } catch (uploadError) {
                                            console.log('⚠️ Could not upload image:', uploadError.message);
                                        }

                                        // ⭐ บันทึกข้อความประเภทรูปภาพลง LineMessage (หลังได้ media_url แล้ว)
                                        try {
                                            // ดึง LINE Profile (ถ้ามี)
                                            let displayName = tenant?.full_name;
                                            let pictureUrl = null;

                                            try {
                                                const lineToken = await getLineToken(base44, branchId);
                                                if (lineToken) {
                                                    const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
                                                        headers: { 'Authorization': `Bearer ${lineToken}` }
                                                    });
                                                    if (profileRes.ok) {
                                                        const profile = await profileRes.json();
                                                        displayName = profile.displayName || displayName;
                                                        pictureUrl = profile.pictureUrl;
                                                    }
                                                }
                                            } catch (profileError) {
                                                console.log('⚠️ Could not fetch LINE profile:', profileError.message);
                                            }

                                            await base44.asServiceRole.entities.LineMessage.create({
                                                branch_id: branchId,
                                                tenant_id: tenant?.id || null,
                                                line_user_id: lineUserId,
                                                line_display_name: displayName,
                                                line_picture_url: pictureUrl,
                                                direction: 'incoming',
                                                message_type: 'image',
                                                content: '[รูปภาพ]',
                                                media_url: imageUrl,
                                                reply_token: replyToken
                                            });
                                            console.log(`💾 Saved incoming image to LineMessage entity with media_url: ${imageUrl ? 'YES' : 'NO'}`);
                                        } catch (saveError) {
                                            console.error('⚠️ Failed to save image message to LineMessage:', saveError.message);
                                        }

                                        // ⭐ ถ้ามี payment ที่ต้องชำระ → ประมวลผลสลิป
                                        if (hasPendingPayment) {
                                            await handleSlipImage(base44, lineUserId, messageId, branchId, replyToken);
                                        } else {
                                            console.log(`ℹ️ User ${lineUserId} has no outstanding payment - image saved but no slip processing`);
                                        }

                                        continue;
                    }
                }
            }
        } catch (error) {
            console.error('❌ Webhook processing error:', error);
        }
    })();

    // Return 200 OK ทันที
    return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
});

async function handleMaintenanceReport(base44, lineUserId, problemDescription, branchId = null, replyToken = null) {
    try {
        console.log(`🔧 Processing maintenance report from ${lineUserId}: "${problemDescription}"`);
        
        let tenant = null;
        try {
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
        } catch (e) {}
        
        if (!tenant) {
            console.log('❌ Tenant not found');
            await sendMessage(base44, lineUserId, 
                '❌ ไม่พบข้อมูลของคุณในระบบ\n\n' +
                'กรุณาส่งเบอร์โทรศัพท์เพื่อลงทะเบียนก่อนค่ะ',
                branchId,
                replyToken
            );
            return;
        }
        
        const tenantBranchId = tenant.branch_id || branchId;
        
        // ⭐ ใช้ filter แทน list เพื่อดึงเฉพาะ booking ของ tenant นี้
        let bookings = [];
        try {
            const bookingResult = await base44.asServiceRole.entities.Booking.filter({ tenant_id: tenant.id });
            bookings = Array.isArray(bookingResult) ? bookingResult : [bookingResult];
        } catch (e) {
            console.log('⚠️ Could not fetch bookings:', e.message);
        }
        
        // เรียงตามวันที่สร้างล่าสุดเพื่อให้ได้ห้องปัจจุบัน (ในกรณีที่ย้ายห้อง)
        const activeBookings = bookings
            .filter(b => b.tenant_id === tenant.id && b.status === 'active')
            .sort((a, b) => {
                try {
                    // Prioritize created_date, then check_in_date if created_date is not available
                    const dateA = new Date(a.created_date || a.check_in_date);
                    const dateB = new Date(b.created_date || b.check_in_date);
                    return dateB.getTime() - dateA.getTime();
                } catch {
                    // Handle invalid date strings gracefully by not reordering
                    return 0;
                }
            });
        
        const activeBooking = activeBookings[0];
        
        if (!activeBooking) {
            console.log('❌ No active booking found');
            await sendMessage(base44, lineUserId, 
                '❌ ไม่พบข้อมูลห้องพักของคุณ\n\n' +
                'กรุณาติดต่อเจ้าของหอพักค่ะ',
                tenantBranchId,
                replyToken
            );
            return;
        }
        
        console.log(`📍 Active booking room_id: ${activeBooking.room_id}`);
        
        const analysisResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `วิเคราะห์ปัญหาการแจ้งซ่อมต่อไปนี้และจัดหมวดหมู่:

รายละเอียดปัญหา: "${problemDescription}"

กรุณาวิเคราะห์และระบุ:
1. หมวดหมู่ปัญหา (category): electric, plumbing, furniture, air_conditioner, other
2. ระดับความสำคัญ (priority): low, medium, high, urgent
3. หัวข้อสรุปปัญหา (title): สั้นๆ ไม่เกิน 50 ตัวอักษร
4. รายละเอียดที่ปรับปรุงแล้ว (description): ขยายความและจัดรูปแบบให้อ่านง่าย`,
            response_json_schema: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        enum: ["electric", "plumbing", "furniture", "air_conditioner", "other"]
                    },
                    priority: {
                        type: "string",
                        enum: ["low", "medium", "high", "urgent"]
                    },
                    title: {
                        type: "string"
                    },
                    description: {
                        type: "string"
                    }
                },
                required: ["category", "priority", "title", "description"]
            }
        });
        
        console.log('✅ AI Analysis:', analysisResult);
        
        const maintenanceRequest = await base44.asServiceRole.entities.MaintenanceRequest.create({
            branch_id: tenant.branch_id,
            room_id: activeBooking.room_id,
            tenant_id: tenant.id,
            title: analysisResult.title,
            description: analysisResult.description,
            category: analysisResult.category,
            priority: analysisResult.priority,
            status: 'pending',
            notes: `แจ้งผ่าน LINE: ${problemDescription}`
        });
        
        console.log(`✅ Created maintenance request: ${maintenanceRequest.id}`);
        
        const categoryTh = {
            electric: 'ไฟฟ้า',
            plumbing: 'ประปา',
            furniture: 'เฟอร์นิเจอร์',
            air_conditioner: 'เครื่องปรับอากาศ',
            other: 'อื่นๆ'
        };
        
        // ดึงข้อมูลห้องเพื่อแสดงหมายเลขห้อง
        let roomNumber = 'N/A';
        try {
            console.log(`🔍 Fetching room by ID: ${activeBooking.room_id}`);
            let roomsData = await base44.asServiceRole.entities.Room.filter({ id: activeBooking.room_id });

            // ป้องกัน .find error
            if (!Array.isArray(roomsData)) {
                roomsData = roomsData ? [roomsData] : [];
            }

            const room = roomsData.length > 0 ? roomsData[0] : null;

            if (room) {
                roomNumber = room.room_number || 'N/A';
                console.log(`✅ Found room! Number: ${roomNumber}, ID: ${room.id}`);
            } else {
                console.log(`⚠️ Room not found for ID: ${activeBooking.room_id}`);
            }
        } catch (roomError) {
            console.error('❌ Error fetching room data:', roomError);
            console.error('Error details:', roomError.message);
        }
        
        let successMessage = `✅ รับเรื่องแจ้งซ่อมแล้ว ทางเราขะรีบดำเนินการครับ 🔧`;
        
        console.log('📤 Sending success message with REPLY token...');
        await sendMessage(base44, lineUserId, successMessage, tenantBranchId, replyToken);
        console.log('✅ Maintenance report completed');
        
    } catch (error) {
        console.error('❌ Maintenance report error:', error);
        console.error('Error stack:', error.stack);
        let errorTenant = null;
        try {
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
            errorTenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
        } catch (e) {
            console.log('⚠️ Could not find tenant for error handling:', e.message);
        }
        await sendMessage(base44, lineUserId, 
            '❌ เกิดข้อผิดพลาดในการบันทึกการแจ้งซ่อม\n\n' +
            'กรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าของหอพักค่ะ',
            errorTenant?.branch_id || branchId,
            replyToken
        );
    }
}

// ⭐ Helper function สำหรับ pagination
async function fetchAllWithPagination(entity, batchSize = 5000) {
    let allData = [];
    let skip = 0;
    let hasMore = true;
    
    while (hasMore) {
        const batch = await entity.list('-created_date', batchSize, skip);
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

async function handlePhoneNumberRegistration(base44, lineUserId, phoneNumber, branchCode = null, replyToken = null, destinationBranchId = null) {
    try {
        // ⭐⭐⭐ CRITICAL FIX: ต้องมี destinationBranchId เสมอ (ป้องกัน Data Leak)
        if (!destinationBranchId) {
            console.error('❌ CRITICAL: Missing destinationBranchId - cannot register without branch context');
            await sendMessage(base44, lineUserId, 
                '❌ กรุณาลงทะเบียนผ่าน LINE OA ของสาขาที่ถูกต้องค่ะ\n\nถ้าไม่แน่ใจกรุณาติดต่อเจ้าของหอพัก',
                null,
                replyToken
            );
            return;
        }

        // ⭐ ดึงเฉพาะสาขาที่ระบุ (ไม่โหลดทั้งหมด)
        const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ 
            phone: phoneNumber,
            branch_id: destinationBranchId 
        });
        let tenants = Array.isArray(tenantResult) ? tenantResult : (tenantResult ? [tenantResult] : []);
        console.log(`🎯 Filtered tenants in branch ${destinationBranchId.substring(0, 8)}... → Found ${tenants.length}`);

        // ⭐ Cache branches
        const now = Date.now();
        let branches;
        if (!branchesCache || (now - branchesCacheTime) > BRANCHES_CACHE_DURATION) {
            branches = await base44.asServiceRole.entities.Branch.list();
            branchesCache = branches;
            branchesCacheTime = now;
            console.log(`✅ Cached ${branches.length} branches`);
        } else {
            branches = branchesCache;
            console.log(`✅ Using cached branches (${branches.length})`);
        }

        // ⭐ tenants ถูก filter ด้วย phone + branch_id มาแล้ว
        const matchingTenants = tenants; // ไม่ต้อง filter ซ้ำ
        
        console.log(`📱 Registration: phone=${phoneNumber}, branchCode=${branchCode}, destinationBranchId=${destinationBranchId}`);
        console.log(`📊 Matching tenants in branch: ${tenants.length}, Total branches in cache: ${branches.length}`);
        
        if (branchCode) {
            const targetBranch = branches.find(b => b.branch_code?.toUpperCase() === branchCode);
            
            if (!targetBranch) {
                await sendMessage(base44, lineUserId, 
                    `❌ ไม่พบสาขา "${branchCode}"\n\nกรุณาตรวจสอบรหัสสาขาและลองใหม่อีกครั้งค่ะ`,
                    destinationBranchId,
                    replyToken
                );
                return;
            }
            
            // ⭐ tenants ถูก filter มาแล้วด้วย phone ดังนั้นแค่เช็ค branch_id
            const tenant = tenants.find(t => t.branch_id === targetBranch.id);
            
            if (!tenant) {
                await sendMessage(base44, lineUserId, 
                    `❌ ไม่พบเบอร์ ${phoneNumber} ในสาขา "${targetBranch.branch_name}"\n\nกรุณาตรวจสอบข้อมูลและลองใหม่ค่ะ`,
                    targetBranch.id,
                    replyToken
                );
                return;
            }
            
            await base44.asServiceRole.entities.Tenant.update(tenant.id, {
                line_user_id: lineUserId
            });
            
            await sendConfirmationMessage(base44, lineUserId, tenant, targetBranch, replyToken);
            return;
        }
        
        console.log(`🔍 Found ${matchingTenants.length} tenant(s) with phone ${phoneNumber}`);
        matchingTenants.forEach((t, i) => {
            const branch = branches.find(b => b.id === t.branch_id);
            console.log(`   ${i + 1}. ${t.full_name} - Branch: ${branch?.branch_name || t.branch_id}`);
        });
        
        // ⭐ ไม่ต้อง filter ซ้ำเพราะ query แรกกรองด้วย branch_id มาแล้ว
        console.log(`✅ All ${matchingTenants.length} tenant(s) are already in correct branch: ${destinationBranchId.substring(0, 12)}...`);
        
        if (matchingTenants.length === 0) {
            await sendNotFoundMessage(base44, lineUserId, phoneNumber, destinationBranchId, replyToken);
            return;
        }
        
        if (matchingTenants.length === 1) {
            const tenant = matchingTenants[0];
            
            await base44.asServiceRole.entities.Tenant.update(tenant.id, {
                line_user_id: lineUserId
            });
            
            const branch = branches.find(b => b.id === tenant.branch_id);
            
            await sendConfirmationMessage(base44, lineUserId, tenant, branch, replyToken);
            return;
        }
        
        // ⭐ ถ้ามีหลาย record ในสาขาเดียวกัน → ลงทะเบียน record แรก
        if (matchingTenants.length > 1) {
            console.log(`⚠️ Found ${matchingTenants.length} duplicate records in same branch - registering first one`);
        }
        
        const tenant = matchingTenants[0];
        await base44.asServiceRole.entities.Tenant.update(tenant.id, {
            line_user_id: lineUserId
        });
        
        const branch = branches.find(b => b.id === tenant.branch_id);
        await sendConfirmationMessage(base44, lineUserId, tenant, branch, replyToken);
        
    } catch (error) {
        console.error('Registration error:', error);
        await sendMessage(base44, lineUserId, 
            '❌ เกิดข้อผิดพลาดในการลงทะเบียน\n\nกรุณาลองใหม่อีกครั้งหรือติดต่อเจ้าของหอพักค่ะ',
            destinationBranchId,
            replyToken
        );
    }
}

// ⭐ Helper: Extract amount (Minified)
function extractAmount(slipData) {
    const possiblePaths = [
        ['amount'], ['transAmount'], ['transaction', 'amount'], ['payment', 'amount'],
        ['data', 'amount'], ['receiver', 'amount'], ['sender', 'amount'],
        ['receiver', 'account', 'amount'], ['sender', 'account', 'amount']
    ];
    for (const path of possiblePaths) {
        let current = slipData;
        let isValid = true;
        for (const key of path) {
            if (current && typeof current === 'object' && key in current) current = current[key];
            else { isValid = false; break; }
        }
        if (isValid && current != null) {
            const amount = typeof current === 'number' ? current : parseFloat(current);
            if (!isNaN(amount) && amount > 0) return { amount, path: path.join('.') };
        }
    }
    return { amount: 0, path: 'not found' };
}

async function handleSlipImage(base44, lineUserId, messageId, branchId = null, replyToken = null) {
    const lineToken = await getLineToken(base44, branchId);
    const slip2goApiKey = Deno.env.get('SLIP2GO_API_KEY');
    
    if (!lineToken || !slip2goApiKey) {
        await sendMessage(base44, lineUserId, '❌ ระบบขัดข้อง กรุณาติดต่อเจ้าของหอพัก', branchId, replyToken);
        return;
    }

    try {
        
        let tenant = null;
        try {
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
            if (tenant) branchId = tenant.branch_id;
        } catch (e) {}

        // ⭐ CRITICAL: Must have branchId after finding tenant
        if (!branchId) {
            console.error(`❌ CRITICAL: No branchId available for slip verification`);
            await sendMessage(base44, lineUserId, '❌ เกิดข้อผิดพลาดในระบบ กรุณาติดต่อเจ้าของหอพัก', null, replyToken);
            return;
        }

        if (!tenant) {
            await sendMessage(base44, lineUserId, 'กรุณาลงทะเบียนด้วยหมายเลขโทรศัพท์ก่อนใช้งาน\nพิมพ์: ลงทะเบียน 0812345678', branchId, replyToken);
            return;
        }

        // ⭐ CRITICAL: Filter payments รวมทั้ง partial_paid (ชำระไม่ครบ)
        let pendingPayments = [];
        try {
            const paymentResult = await base44.asServiceRole.entities.Payment.filter({ 
                tenant_id: tenant.id,
                status: { $in: ['pending', 'overdue', 'partial_paid'] }
            });
            pendingPayments = Array.isArray(paymentResult) ? paymentResult : (paymentResult ? [paymentResult] : []);
        } catch (e) {
            console.log('⚠️ Could not filter payments:', e.message);
            const allPayments = await base44.asServiceRole.entities.Payment.list('-created_date', 500);
            pendingPayments = allPayments.filter(p => 
                p.tenant_id === tenant.id &&
                (p.status === 'pending' || p.status === 'overdue' || p.status === 'partial_paid')
            );
        }

        if (pendingPayments.length === 0) {
            return;
        }

        pendingPayments.sort((a, b) => {
            try {
                return new Date(a.due_date) - new Date(b.due_date);
            } catch {
                return 0;
            }
        });
        
        const pendingPayment = pendingPayments[0];
        
        let imageResponse;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                
                imageResponse = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
                    headers: { 'Authorization': `Bearer ${lineToken}` },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (imageResponse.ok) {
                    break;
                }
                
                console.log(`Download attempt ${retryCount + 1} failed: ${imageResponse.status}`);
                retryCount++;
                
                if (retryCount < maxRetries) {
                    // ⭐ Exponential backoff: 2s, 4s, 8s
                    const backoffMs = 2000 * Math.pow(2, retryCount);
                    console.log(`⏳ Download retry waiting ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
                
            } catch (downloadError) {
                console.error(`Download attempt ${retryCount + 1} error:`, downloadError.message);
                retryCount++;
                
                if (retryCount < maxRetries) {
                    // ⭐ Exponential backoff: 2s, 4s, 8s
                    const backoffMs = 2000 * Math.pow(2, retryCount);
                    console.log(`⏳ Download error retry waiting ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
        }

        if (!imageResponse || !imageResponse.ok) {
            console.error('❌ Failed to download image after retries');
            await sendMessage(base44, lineUserId, 
                '❌ ไม่สามารถดาวน์โหลดรูปภาพได้\n\nสาเหตุที่อาจเป็นไปได้:\n• รูปภาพมีขนาดใหญ่เกินไป\n• การเชื่อมต่อขาดหาย\n\nวิธีแก้:\n1. ลองส่งรูปที่มีขนาดเล็กกว่า\n2. ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต\n3. หรือติดต่อเจ้าของหอพักโดยตรงค่ะ',
                branchId,
                replyToken
            );
            return;
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
        if (imageBlob.size > 10 * 1024 * 1024) {
            await sendMessage(base44, lineUserId, 
                '❌ รูปภาพมีขนาดใหญ่เกินไป (เกิน 10MB)\n\nกรุณาส่งรูปที่มีขนาดเล็กกว่าค่ะ',
                branchId,
                replyToken
            );
            return;
        }
        let slipImageUrl = '';
        let uploadRetryCount = 0;
        const maxUploadRetries = 3;
        
        while (uploadRetryCount < maxUploadRetries) {
            try {
                const file = new File([imageBlob], `slip-${Date.now()}.jpg`, { type: imageBlob.type });
                const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
                slipImageUrl = uploadResult.file_url;
                break;
                
            } catch (uploadError) {
                uploadRetryCount++;
                
                if (uploadRetryCount >= maxUploadRetries) {
                    await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                        notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่อัพโหลดไม่สำเร็จ - กรุณาให้ส่งใหม่`
                    });
                    
                    await sendMessage(base44, lineUserId, 
                        '⚠️ ระบบไม่สามารถบันทึกรูปสลิปได้\n\nกรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าของหอพักค่ะ',
                        branchId,
                        replyToken
                    );
                    return;
                }
                
                const backoffMs = 2000 * Math.pow(2, uploadRetryCount);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }

        const formData = new FormData();
        formData.append('file', imageBlob, 'slip.jpg');
        formData.append('payload', JSON.stringify({ checkDuplicate: true }));
        
        let slip2goResponse;
        let slip2goData;
        let verificationMethod = '';
        let verificationSuccess = false;
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            slip2goResponse = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image/info', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${slip2goApiKey.trim()}` },
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const responseText = await slip2goResponse.text();
            slip2goData = JSON.parse(responseText);
            
            // ⭐ ตรวจสอบว่าสลิป valid หรือไม่ (รวมทั้ง code 200200 = Slip is valid)
            const isValidCode = slip2goData.code === '200200' || slip2goData.code === 200200;
            
            if ((slip2goResponse.ok && slip2goData.success && slip2goData.data) || (isValidCode && slip2goData.data)) {
                verificationMethod = 'qr-image';
                verificationSuccess = true;
            }
            
            if (slip2goResponse.status === 504 || responseText.includes('504')) {
                await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่ระบบตรวจสอบช้า`
                });
                // 🛑 ไม่ส่งข้อความกลับ ให้เงียบไว้รอ cron job ตรวจสอบ
                console.log('📸 504 Timeout: Saved slip silently for cron recheck');
                return;
            }
            
        } catch (fetchError) {
            // Log to DB
            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line',
                branch_id: branchId,
                event_type: 'slip_verification_error',
                line_user_id: lineUserId,
                tenant_id: tenant?.id,
                payment_id: pendingPayment.id,
                status: 'error',
                message: 'Slip2Go API error',
                error_message: fetchError.message
            }).catch(() => {});

            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่ระบบขัดข้อง`
            });
            // 🛑 ไม่ส่งข้อความกลับ ให้เงียบไว้รอ cron job ตรวจสอบ
            console.log('📸 Fetch Error: Saved slip silently for cron recheck');
            return;
        }

        const errorCode = slip2goData.code;
        const errorMessage = slip2goData.message || '';

        const isDuplicateError = errorCode === '200501' || errorMessage.toLowerCase().includes('duplicate');

        if (isDuplicateError) {
            // Log duplicate
            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line',
                branch_id: branchId,
                event_type: 'slip_duplicate',
                line_user_id: lineUserId,
                tenant_id: tenant?.id,
                payment_id: pendingPayment.id,
                status: 'warning',
                message: 'Duplicate slip detected'
            }).catch(() => {});

            await sendMessage(base44, lineUserId, 
                `⚠️ สลิปนี้เคยถูกใช้ไปแล้ว\n\nกรุณาส่งสลิปใหม่ค่ะ`,
                branchId,
                replyToken
            );
            return;
        }

        // ⭐⭐⭐ Slip2Go Error Codes:
        // 200500 = Fraud (สลิปปลอม) → ไม่ตอบ ไม่บันทึก
        // 200404 = Not found (ธนาคารยัง sync ไม่ทัน) → บันทึกรอตรวจซ้ำ
        // อื่นๆ = Unknown error → ไม่ตอบ ไม่บันทึก

        const isFraudSlip = errorCode === '200500' || errorMessage.toLowerCase().includes('fraud');

        if (isFraudSlip && !verificationSuccess) {
            // Log fraud attempt
            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line',
                branch_id: branchId,
                event_type: 'slip_fraud',
                line_user_id: lineUserId,
                tenant_id: tenant?.id,
                payment_id: pendingPayment.id,
                status: 'warning',
                message: 'Fraud slip detected',
                details: { error_code: errorCode }
            }).catch(() => {});
            // 🛑 เงียบไว้ ไม่บันทึก url รูปลงบิล ไม่ตอบกลับ
            console.log('📸 Slip2Go Error 200500: Ignored silently (Not a slip)');
            return;
        }

        const isSlipValid = slip2goResponse.ok && slip2goData.data && verificationSuccess;

        if (!isSlipValid) {
            const isSlipNotFound = errorCode === '200404' || errorMessage === 'Slip not found';

            if (isSlipNotFound) {
                const now = new Date().toISOString();
                await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayment.notes || ''}\n\n⏳ รอตรวจสอบซ้ำ: ธนาคารยังไม่มีข้อมูล - ${now}`
                });

                // ⭐ ไม่ตอบกลับอะไร - ให้ cron job ตรวจสอบซ้ำแบบเงียบๆ
                console.log('📸 Slip saved silently - waiting for cron recheck');
                return;
            }

            return;
        }

        const slipData = slip2goData.data;
        const { amount: slipAmount } = extractAmount(slipData);
        
        const senderName = slipData.sender?.account?.name?.th || 
                          slipData.sender?.displayName || 'N/A';
        const transDate = slipData.dateTime || slipData.transDate || new Date().toISOString().split('T')[0];

        if (slipAmount === 0) {
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ระบบอ่านยอดไม่ได้`
            });
            
            await sendMessage(base44, lineUserId, 
                `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ`,
                branchId,
                replyToken
            );
            return;
        }

        // ⭐⭐⭐ เช็คเลขบัญชีก่อนเช็คยอด (แบบเดียวกับ verifySlip - ไม่เช็คชื่อ)
        const now2 = Date.now();
        let configs;
        if (!configCache || (now2 - configCacheTime) > CONFIG_CACHE_DURATION) {
            configs = await base44.asServiceRole.entities.Config.list();
            configCache = configs;
            configCacheTime = now2;
            console.log(`✅ Refreshed config cache (${configs.length} items)`);
        } else {
            configs = configCache;
            console.log(`✅ Using cached config (${configs.length} items)`);
        }

        const getConfigValue = (key) => {
            const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
            if (branchConfig) return branchConfig.value;
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || null;
        };

        const expectedAccountNumber = getConfigValue('bank_account_number');
        const expectedPromptPay = getConfigValue('promptpay');
        const expectedAccountName = getConfigValue('bank_account_name');

        const rawRA = slipData.receiver?.account?.bank?.account || slipData.receiver?.account?.account || slipData.receiver?.account;
        const receiverAccount = typeof rawRA === 'string' ? rawRA : '';
        const rawRP = slipData.receiver?.account?.proxy?.value || slipData.receiver?.account?.proxy?.account || slipData.receiver?.proxy?.account || slipData.receiver?.proxy?.value;
        const receiverPromptPay = typeof rawRP === 'string' ? rawRP : '';
        const receiverName = slipData.receiver?.account?.name?.th || slipData.receiver?.account?.name?.en || slipData.receiver?.account?.name || slipData.receiver?.name || slipData.receiver?.displayName || '';

        console.log(`🏦 Verification Check: Acc=${receiverAccount}, PP=${receiverPromptPay}, Name=${receiverName}`);

        if ((!expectedAccountNumber || expectedAccountNumber.trim() === '') && 
            (!expectedPromptPay || expectedPromptPay.trim() === '') &&
            (!expectedAccountName || expectedAccountName.trim() === '')) {
            const rmRes = await base44.asServiceRole.entities.Room.filter({ id: pendingPayment.room_id });
            const roomNum = (Array.isArray(rmRes) ? rmRes[0] : rmRes)?.room_number || 'ไม่ทราบ';
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, { payment_slip_url: slipImageUrl, notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNum} - ยังไม่ได้ตั้งค่าบัญชี` });
            await sendMessage(base44, lineUserId, `📸 ได้รับสลิปแล้ว!\n\n⚠️ ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ\nกรุณารอเจ้าของหอพักตรวจสอบค่ะ`, branchId, replyToken);
            return;
        }

        let accountMatch = false;
        let matchMethod = '';

        if (expectedAccountNumber && isAccountMatch(receiverAccount, expectedAccountNumber)) { accountMatch = true; matchMethod = 'Bank Account'; }
        if (!accountMatch && expectedPromptPay) {
            if (isAccountMatch(receiverPromptPay, expectedPromptPay)) { accountMatch = true; matchMethod = 'PromptPay'; }
            else if (isAccountMatch(receiverAccount, expectedPromptPay)) { accountMatch = true; matchMethod = 'PromptPay (via receiverAccount)'; }
        }
        
        if (!accountMatch && expectedAccountName && receiverName) {
            let cleanExpected = expectedAccountName.replace(/[\s\.\-]/g, '').toLowerCase();
            let cleanReceiver = receiverName.replace(/[\s\.\-]/g, '').toLowerCase();
            const prefixes = ['นาย', 'นางสาว', 'นาง', 'นส', 'น.ส.', 'น.ส', 'mr', 'ms', 'mrs', 'บจก', 'บริษัท', 'หจก'];
            for (const p of prefixes) {
                if (cleanReceiver.startsWith(p)) cleanReceiver = cleanReceiver.substring(p.length);
                if (cleanExpected.startsWith(p)) cleanExpected = cleanExpected.substring(p.length);
            }
            if (cleanExpected.length > 2 && (cleanReceiver.includes(cleanExpected) || cleanExpected.includes(cleanReceiver))) {
                accountMatch = true; matchMethod = 'Account Name';
            }
        }

        console.log(`🏦 Final Match: ${accountMatch ? '✅ PASS' : '❌ FAIL'} via ${matchMethod}`);

        if (!accountMatch) {
            const rmRes = await base44.asServiceRole.entities.Room.filter({ id: pendingPayment.room_id });
            const roomNum = (Array.isArray(rmRes) ? rmRes[0] : rmRes)?.room_number || 'ไม่ทราบ';
            const errorMsg = `โอนเงินไปผิดบัญชี\n\nตรวจพบโอนเข้า: ${receiverAccount || receiverPromptPay}\nควรโอนเข้า: ${expectedAccountNumber || expectedPromptPay || expectedAccountName}\n\nกรุณาตรวจสอบและส่งสลิปมาใหม่อีกครั้งค่ะ`;
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, { payment_slip_url: slipImageUrl, notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNum} - ${errorMsg}` });
            try {
                const b = (await base44.asServiceRole.entities.Branch.list()).find(b => b.id === pendingPayment.branch_id);
                if (b?.owner_id) await base44.asServiceRole.integrations.Core.SendEmail({ to: b.owner_id, subject: `แจ้งเตือน: ตรวจพบการโอนผิดบัญชี (ห้อง ${roomNum})`, body: `เรียนเจ้าของหอพัก,\n\nระบบตรวจพบการโอนเงินผิดบัญชีสำหรับห้อง ${roomNum} ผ่าน LINE\n\n${errorMsg}\n\nกรุณาตรวจสอบสลิปในระบบ` });
            } catch (e) {}
            await sendMessage(base44, lineUserId, `❌ ${errorMsg}\n\nกรุณารอเจ้าของหอพักตรวจสอบค่ะ 🙏`, branchId, replyToken);
            return;
        }

        const today = new Date(new Date().getTime() + (7 * 3600000)); today.setHours(0,0,0,0);
        const pList = pendingPayments.map(p => { 
            const late = calculateLateFee(p, configs, branchId, today); 
            const exp = ['rent_amount','water_amount','electricity_amount','internet_amount','common_fee_amount','parking_fee_amount','other_amount'].reduce((s, k) => s + Math.round((parseFloat(p[k]) || 0) * 100), 0) / 100 + late.lateFeeAmount; 
            return { ...p, expectedAmount: exp, remainingToPay: Math.round((exp - (parseFloat(p.paid_amount) || 0)) * 100) / 100, currentPaid: parseFloat(p.paid_amount || 0), lateFeeAmount: late.lateFeeAmount, daysLate: late.daysLate }; 
        });
        const exact = pList.find(p => Math.abs(p.remainingToPay - slipAmount) < 1);
        const search = (i, sub, sum) => { if (sum > 0 && Math.abs(sum - slipAmount) < 1) return sub; if (sum > slipAmount + 1 || i >= Math.min(pList.length, 15)) return null; const sP = [...pList].sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)); return search(i + 1, [...sub, sP[i]], sum + sP[i].remainingToPay) || search(i + 1, sub, sum); };
        const processList = exact ? [exact] : (search(0, [], 0) || pList);
        let remainingSlipAmount = slipAmount, processedIds = [], partialInfo = null;
        let isExactCombo = processList.length > 0 && Math.abs(processList.reduce((sum, p) => sum + p.remainingToPay, 0) - slipAmount) < 1;

        for (const p of processList) {
            if (remainingSlipAmount <= 0) break;
            const payAmount = Math.min(p.remainingToPay, remainingSlipAmount);
            const newTotalPaid = p.currentPaid + payAmount;
            const status = newTotalPaid >= p.expectedAmount * 0.95 ? 'paid' : 'partial_paid';
            if (status !== 'paid') partialInfo = { expected: p.expectedAmount, paidNow: newTotalPaid, shortfall: p.expectedAmount - newTotalPaid, lateFee: p.lateFeeAmount, daysLate: p.daysLate, room_id: p.room_id, branch_id: p.branch_id };

            remainingSlipAmount -= payAmount;
            processedIds.push({ id: p.id, status });

            let nts = (p.notes || '').replace(/⚠️ รอตรวจสอบ:.*$/gm, '').trim();
            const nt = status === 'paid'
                ? `\n\n✅ Auto-verify: ${senderName} โอน ${payAmount.toLocaleString()}฿${isExactCombo ? ' (ตรงตามบิล)' : ''}${p.lateFeeAmount > 0 ? ` (+ปรับ ${p.lateFeeAmount}฿)` : ''}\n✅ ยืนยันชำระแล้ว`
                : `\n\n💰 ชำระบางส่วน: ${payAmount.toLocaleString()}฿ (รวม ${newTotalPaid}/${p.expectedAmount}฿)`;
            await base44.asServiceRole.entities.Payment.update(p.id, {
                status, paid_amount: newTotalPaid, payment_slip_url: slipImageUrl,
                late_fee_amount: p.lateFeeAmount, total_amount: p.expectedAmount,
                ...(status === 'paid' ? { payment_date: transDate.split('T')[0] } : {}),
                notes: nts + nt
            });

            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line', branch_id: branchId, event_type: status === 'paid' ? 'payment_verified' : 'partial_payment',
                line_user_id: lineUserId, tenant_id: tenant?.id, payment_id: p.id, amount: payAmount, status: 'success',
                message: status === 'paid' ? 'Verified' : `Partial: ${newTotalPaid}/${p.expectedAmount}`,
                details: { late_fee: p.lateFeeAmount, days_late: p.daysLate, sender: senderName, method: verificationMethod, slip_amount: slipAmount }
            }).catch(() => {});
        }

        if (remainingSlipAmount > 0 && tenant?.id) {
            console.log(`💰 Excess ${remainingSlipAmount}฿ -> Prepaid`);
            await base44.asServiceRole.entities.Tenant.update(tenant.id, {
                prepaid_balance: (parseFloat(tenant.prepaid_balance || 0) + remainingSlipAmount),
                notes: `${tenant.notes || ''}\n[${new Date().toISOString().split('T')[0]}] ส่วนเกินสลิป: +${remainingSlipAmount}฿`
            });
            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line', branch_id: branchId, event_type: 'prepaid_added', line_user_id: lineUserId,
                tenant_id: tenant.id, amount: remainingSlipAmount, status: 'success', message: `Prepaid added: ${remainingSlipAmount}`
            }).catch(() => {});
        }

        if (tenant?.id) { try { await base44.asServiceRole.functions.invoke('calculatePaymentScores', { tenant_id: tenant.id }); } catch (e) {} }
        let rT = replyToken;
        if (partialInfo && remainingSlipAmount <= 0) {
            try { const rmRes = await base44.asServiceRole.entities.Room.filter({ id: partialInfo.room_id }); const roomNum = (Array.isArray(rmRes) ? rmRes[0] : rmRes)?.room_number || 'ไม่ทราบ'; const b = (await base44.asServiceRole.entities.Branch.list()).find(b => b.id === (partialInfo.branch_id || branchId)); if (b?.owner_id) await base44.asServiceRole.integrations.Core.SendEmail({ to: b.owner_id, subject: `แจ้งเตือน: ยอดโอนไม่ครบ (ห้อง ${roomNum})`, body: `เรียนเจ้าของหอพัก,\n\nมีการโอนเงินเข้ามาสำหรับห้อง ${roomNum} ผ่าน LINE แต่มียอดไม่ครบถ้วน\n\nยอดที่ต้องชำระ: ${partialInfo.expected.toLocaleString()} บาท\nยอดที่โอนเข้ามา: ${slipAmount.toLocaleString()} บาท\nขาดอีก: ${partialInfo.shortfall.toLocaleString()} บาท\n\nกรุณาตรวจสอบสลิปในระบบ` }); } catch (e) {}
            await sendMessage(base44, lineUserId, `💰 รับเงินแล้ว ${slipAmount.toLocaleString()}฿\n✅ หักยอดค้าง: ${partialInfo.paidNow.toLocaleString()}฿\n💵 ยอดที่เหลือ: ${partialInfo.expected.toLocaleString()}฿${partialInfo.lateFee > 0 ? ` (รวมค่าปรับ ${partialInfo.lateFee.toLocaleString()}฿)` : ''}\n⚠️ ขาดอีก: ${partialInfo.shortfall.toLocaleString()}฿\nกรุณาโอนเพิ่มค่ะ 🙏`, branchId, rT); rT = null;
        } else if (remainingSlipAmount > 0) { await sendMessage(base44, lineUserId, `✅ ตรวจสอบสำเร็จ!\n💰 ยอดเงิน: ${slipAmount.toLocaleString()}฿\n📅 วันที่: ${transDate.split('T')[0]}\n✓ ตัดยอดแล้ว\n💵 ส่วนเกิน ${remainingSlipAmount.toLocaleString()}฿ เก็บเป็นเครดิต\nขอบคุณค่ะ 🙏`, branchId, rT); rT = null; }
        for (const item of processedIds) {
            if (item.status === 'paid') {
                try { await base44.asServiceRole.functions.invoke('sendReceipt', { paymentId: item.id, replyToken: rT }); rT = null; } catch (e) {}
            }
        }
    } catch (error) {
        console.error('❌ === SLIP PROCESSING ERROR ===\nError:', error.message);
        await base44.asServiceRole.entities.WebhookLog.create({ webhook_type: 'line', branch_id: branchId, event_type: 'slip_processing_error', line_user_id: lineUserId, status: 'error', message: 'Slip processing failed', error_message: error.message }).catch(() => {});
        await sendMessage(base44, lineUserId, 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง', branchId, replyToken);
    }
}

async function sendEditTemplate(base44, lineUserId, pendingData, categoryTh, branchId = null, replyToken = null) {
    const templateText = 
        `📝 บันทึกค่าใช้จ่าย\n` +
        `หัวข้อ : ${pendingData.title || '...........'}\n` +
        `ยอดเงิน : ${pendingData.amount.toLocaleString()} บาท\n` +
        `ประเภท : ${categoryTh[pendingData.category]}\n` +
        `วันที่ : ${pendingData.date}\n` +
        `รายละเอียด : ${pendingData.description || '...........'}\n` +
        `รูปสลิป/บิล : (แนบมาแล้ว)\n` +
        `หมายเหตุ : ...........`;
    
    await sendMessage(base44, lineUserId, templateText, branchId, replyToken);
}

// ⭐⭐⭐ Flex Message สำหรับข้อความที่ไม่มีรูป
async function sendFlexWithUploadOption(base44, lineUserId, analysis, categoryTh, branchId = null, replyToken = null) {
    try {
        const lineToken = await getLineToken(base44, branchId);
        if (!lineToken) return;

        const flexMessage = {
            type: 'flex',
            altText: `ตรวจสอบค่าใช้จ่าย ${analysis.amount.toLocaleString()} บาท`,
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '📋 ตรวจสอบข้อมูล',
                            weight: 'bold',
                            size: 'md',
                            color: '#64748B'
                        },
                        {
                            type: 'text',
                            text: 'ยืนยันรายการค่าใช้จ่าย ✅',
                            weight: 'bold',
                            size: 'lg',
                            color: '#1E40AF',
                            margin: 'sm'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'box',
                            layout: 'baseline',
                            spacing: 'sm',
                            contents: [
                                { type: 'text', text: 'หัวข้อ:', size: 'sm', color: '#64748B', flex: 2 },
                                { type: 'text', text: analysis.title, wrap: true, color: '#334155', size: 'sm', flex: 5, weight: 'bold' }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            spacing: 'sm',
                            margin: 'md',
                            contents: [
                                { type: 'text', text: 'ยอดสุทธิ:', size: 'sm', color: '#64748B', flex: 2 },
                                { type: 'text', text: `฿${analysis.amount.toLocaleString()}`, wrap: true, weight: 'bold', color: '#F97316', size: 'xl', flex: 5 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            spacing: 'sm',
                            margin: 'md',
                            contents: [
                                { type: 'text', text: 'วันที่จ่าย:', size: 'sm', color: '#64748B', flex: 2 },
                                { type: 'text', text: analysis.date, wrap: true, color: '#334155', size: 'sm', flex: 5 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            spacing: 'sm',
                            margin: 'md',
                            contents: [
                                { type: 'text', text: 'ประเภท:', size: 'sm', color: '#64748B', flex: 2 },
                                { type: 'text', text: categoryTh[analysis.category], wrap: true, color: '#334155', size: 'sm', flex: 5 }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            spacing: 'sm',
                            margin: 'md',
                            contents: [
                                { type: 'text', text: 'รายละเอียด:', size: 'sm', color: '#64748B', flex: 2 },
                                { type: 'text', text: analysis.description, wrap: true, color: '#334155', size: 'sm', flex: 5 }
                            ]
                        },
                        {
                            type: 'separator',
                            margin: 'lg'
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            spacing: 'sm',
                            margin: 'md',
                            contents: [
                                { type: 'text', text: 'ใบเสร็จ:', size: 'sm', color: '#64748B', flex: 2 },
                                { type: 'text', text: 'ยังไม่มีสลิป ส่งสลิปมาได้เลย', wrap: true, color: '#F97316', size: 'xs', flex: 5 }
                            ]
                        }
                    ],
                    spacing: 'md'
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: 'ยืนยันข้อมูลถูกต้อง',
                                text: '✅ ยืนยัน'
                            },
                            style: 'primary',
                            color: '#16A34A',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '✏️ แก้ไข',
                                text: '✏️ แก้ไข'
                            },
                            style: 'secondary',
                            height: 'sm'
                        }
                    ]
                }
            }
        };

        const endpoint = replyToken 
            ? 'https://api.line.me/v2/bot/message/reply'
            : 'https://api.line.me/v2/bot/message/push';

        const body = replyToken
            ? { replyToken, messages: [flexMessage] }
            : { to: lineUserId, messages: [flexMessage] };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok && replyToken) {
            const fallbackEndpoint = 'https://api.line.me/v2/bot/message/push';
            const fallbackBody = { to: lineUserId, messages: [flexMessage] };
            
            await fetch(fallbackEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${lineToken}`
                },
                body: JSON.stringify(fallbackBody)
            });
        }

        console.log('✅ Sent Flex message with upload option');
    } catch (error) {
        console.error('❌ Error sending Flex message:', error);
    }
}

async function sendFlexConfirmation(base44, lineUserId, analysis, categoryTh, branchId = null, replyToken = null) {
    try {
        const lineToken = await getLineToken(base44, branchId);
        if (!lineToken) return;

        // เช็คว่ามีรูปสลิปหรือไม่
        const hasReceipt = analysis.receipt_image && analysis.receipt_image.trim() !== '';

        // สร้าง body contents - แยกรูปไว้ต่างหาก
        const bodyContents = [
            {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                    { type: 'text', text: 'หัวข้อ:', size: 'sm', color: '#64748B', flex: 2 },
                    { type: 'text', text: analysis.title, wrap: true, color: '#334155', size: 'sm', flex: 5, weight: 'bold' }
                ]
            },
            {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                margin: 'md',
                contents: [
                    { type: 'text', text: 'ยอดสุทธิ:', size: 'sm', color: '#64748B', flex: 2 },
                    { type: 'text', text: `฿${analysis.amount.toLocaleString()}`, wrap: true, weight: 'bold', color: '#F97316', size: 'xl', flex: 5 }
                ]
            },
            {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                margin: 'md',
                contents: [
                    { type: 'text', text: 'วันที่จ่าย:', size: 'sm', color: '#64748B', flex: 2 },
                    { type: 'text', text: analysis.date, wrap: true, color: '#334155', size: 'sm', flex: 5 }
                ]
            },
            {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                margin: 'md',
                contents: [
                    { type: 'text', text: 'ประเภท:', size: 'sm', color: '#64748B', flex: 2 },
                    { type: 'text', text: categoryTh[analysis.category], wrap: true, color: '#334155', size: 'sm', flex: 5 }
                ]
            },
            {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                margin: 'md',
                contents: [
                    { type: 'text', text: 'รายละเอียด:', size: 'sm', color: '#64748B', flex: 2 },
                    { type: 'text', text: analysis.description, wrap: true, color: '#334155', size: 'sm', flex: 5 }
                ]
            },
            {
                type: 'separator',
                margin: 'lg'
            },
            {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                margin: 'md',
                contents: [
                    { type: 'text', text: 'ใบเสร็จ:', size: 'sm', color: '#64748B', flex: 2 },
                    { 
                        type: 'text', 
                        text: hasReceipt ? '✅ แนบมาแล้ว' : 'ยังไม่มีสลิป ส่งสลิปมาได้เลย', 
                        wrap: true, 
                        color: hasReceipt ? '#16A34A' : '#F97316', 
                        size: 'xs', 
                        flex: 5 
                    }
                ]
            }
        ];

        // ถ้ามีรูปสลิป ให้แสดงรูปด้วย
        if (hasReceipt) {
            bodyContents.push({
                type: 'image',
                url: analysis.receipt_image,
                size: 'full',
                aspectRatio: '1.5:1',
                aspectMode: 'cover',
                margin: 'md'
            });
        }

        const flexMessage = {
            type: 'flex',
            altText: `ยืนยันค่าใช้จ่าย ${analysis.amount.toLocaleString()} บาท`,
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '📋 ตรวจสอบข้อมูล',
                            weight: 'bold',
                            size: 'md',
                            color: '#64748B'
                        },
                        {
                            type: 'text',
                            text: 'ยืนยันรายการค่าใช้จ่าย ✅',
                            weight: 'bold',
                            size: 'lg',
                            color: '#1E40AF',
                            margin: 'sm'
                        }
                    ]
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: bodyContents,
                    spacing: 'md'
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: 'ยืนยันข้อมูลถูกต้อง',
                                text: '✅ ยืนยัน'
                            },
                            style: 'primary',
                            color: '#16A34A',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'message',
                                label: '✏️ แก้ไข',
                                text: '✏️ แก้ไข'
                            },
                            style: 'secondary',
                            height: 'sm'
                        }
                    ]
                }
            }
        };

        const endpoint = replyToken 
            ? 'https://api.line.me/v2/bot/message/reply'
            : 'https://api.line.me/v2/bot/message/push';

        const body = replyToken
            ? { replyToken, messages: [flexMessage] }
            : { to: lineUserId, messages: [flexMessage] };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify(body)
        });

        const responseText = await response.text();
        console.log(`📬 LINE API Response (${endpoint.includes('reply') ? 'REPLY' : 'PUSH'}):`, response.status, responseText);

        if (!response.ok && replyToken) {
            console.log('⚠️ Reply failed - attempting PUSH fallback...');
            const fallbackEndpoint = 'https://api.line.me/v2/bot/message/push';
            const fallbackBody = { to: lineUserId, messages: [flexMessage] };
            
            const fallbackResponse = await fetch(fallbackEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${lineToken}`
                },
                body: JSON.stringify(fallbackBody)
            });

            const fallbackText = await fallbackResponse.text();
            console.log(`📬 PUSH Fallback Response:`, fallbackResponse.status, fallbackText);

            if (!fallbackResponse.ok) {
                console.error('❌ Both REPLY and PUSH failed!');
                console.error('   Reply Error:', responseText);
                console.error('   Push Error:', fallbackText);
                throw new Error(`LINE API failed: ${fallbackText}`);
            }

            console.log('✅ Sent Flex confirmation via PUSH fallback');
        } else if (response.ok) {
            console.log('✅ Sent Flex confirmation message via REPLY');
        } else {
            console.error('❌ Flex message failed (no fallback attempted)');
            throw new Error(`LINE API error: ${responseText}`);
        }
    } catch (error) {
        console.error('❌ Error sending Flex message:', error);
    }
}

async function sendMessage(base44, lineUserId, text, branchId = null, replyToken = null) {
    try {
        // เช็ค rate limit - ถ้าเพิ่งส่งไปไม่เกิน 5 นาทีให้ข้าม (เฉพาะ push)
        const cacheKey = `${lineUserId}_${text.substring(0, 50)}`;
        if (!replyToken) {
            const lastSent = messageSentCache.get(cacheKey);
            if (lastSent && (Date.now() - lastSent) < 5 * 60 * 1000) {
                console.log(`⚠️ Rate limit: Message to ${lineUserId} sent recently, skipping`);
                return;
            }
        }
        
        console.log(`📤 Sending message to ${lineUserId} (branch: ${branchId ? branchId.substring(0, 12) + '...' : 'global'})`);
        console.log(`🔑 Reply Token: ${replyToken ? `${replyToken.substring(0, 20)}...` : 'NOT PROVIDED'}`);
        console.log(`📬 Method: ${replyToken ? '⭐ REPLY (จะลองก่อน)' : '📮 PUSH'}`);

        // ใช้ฟังก์ชันใหม่ในการดึง token
        const lineToken = await getLineToken(base44, branchId);

        if (!lineToken) {
            console.error(`❌ No LINE token available for branch: ${branchId ? branchId.substring(0, 12) + '...' : 'global'}`);
            console.error(`   ⚠️ กรุณาตั้งค่า LINE Token ในหน้า Settings → แท็บ LINE`);
            console.error(`   📍 branchId ที่ขอ: ${branchId || 'null (global)'}`);
            return;
        }

        console.log(`✅ Found LINE token for branch: ${branchId ? branchId.substring(0, 12) + '...' : 'global'} (Token: ${lineToken.substring(0, 20)}...)`);  

        // ⭐ ลอง reply ก่อน ถ้าไม่สำเร็จให้ fallback เป็น push
        let endpoint = replyToken 
            ? 'https://api.line.me/v2/bot/message/reply'
            : 'https://api.line.me/v2/bot/message/push';

        let body = replyToken
            ? { replyToken, messages: [{ type: 'text', text }] }
            : { to: lineUserId, messages: [{ type: 'text', text }] };

        console.log(`🚀 Sending to: ${endpoint}`);
        console.log(`📦 Body: ${JSON.stringify(body).substring(0, 150)}...`);

        let response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify(body)
        });

        let responseText = await response.text();
        const usedReplyFirst = replyToken && endpoint.includes('reply');
        console.log(`📬 LINE API Response (${usedReplyFirst ? 'REPLY' : 'PUSH'}):`, response.status, responseText.substring(0, 300));

        // ⭐ ถ้า reply ไม่สำเร็จ (error 400 = Invalid reply token) ให้ลอง push แทน
        if (!response.ok && replyToken) {
            console.error(`❌ Reply failed: ${response.status} - ${responseText}`);

            if (response.status === 400 && responseText.includes('Invalid reply token')) {
                console.log('⚠️ Reply token expired, falling back to PUSH');

                endpoint = 'https://api.line.me/v2/bot/message/push';
                body = { to: lineUserId, messages: [{ type: 'text', text }] };

                console.log(`🔄 Retry with PUSH: ${endpoint}`);

                response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${lineToken}`
                    },
                    body: JSON.stringify(body)
                });

                responseText = await response.text();
                console.log(`📬 PUSH Fallback Response:`, response.status, responseText.substring(0, 300));
            }
        }

        if (!response.ok) {
            console.error('❌ LINE API error:', response.status, responseText);
            console.error('❌ Final endpoint used:', endpoint);
            console.error('❌ Message content:', text.substring(0, 100));

            // ถ้าเป็น error เรื่อง rate limit ให้ลบ cache เพื่อให้ลองใหม่ได้
            if (responseText.includes('rate limit') || responseText.includes('429')) {
                messageSentCache.delete(cacheKey);
            }
        } else {
            const usedMethod = replyToken && endpoint.includes('reply') ? '⭐ REPLY' : '📮 PUSH';
            console.log(`✅ Message sent successfully via ${usedMethod}`);
            console.log(`📊 Stats: replyToken=${replyToken ? 'YES' : 'NO'}, endpoint=${endpoint.includes('reply') ? 'REPLY' : 'PUSH'}`);

            // บันทึกเวลาที่ส่งสำเร็จ (เฉพาะ push หรือ fallback จาก reply)
            if (!replyToken || endpoint.includes('push')) {
                messageSentCache.set(cacheKey, Date.now());

                // จำกัดขนาด cache ไม่ให้เกิน 1000 รายการ
                if (messageSentCache.size > 1000) {
                    const firstKey = messageSentCache.keys().next().value;
                    messageSentCache.delete(firstKey);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error sending LINE message:', error);
        console.error('Error stack:', error.stack);
    }
}

async function sendWelcomeMessage(base44, lineUserId, branchId = null, replyToken = null) {
    // ดึงชื่อหอพักจากการตั้งค่า
    const configs = await base44.asServiceRole.entities.Config.list();
    const getConfigValue = (key) => {
        const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
        if (branchConfig?.value) return branchConfig.value;
        const globalConfig = configs.find(c => c.key === key && !c.branch_id);
        return globalConfig?.value || 'ที่พัก';
    };
    
    const buildingName = getConfigValue('building_name');
    const welcomeText = `🏡 ยินดีต้อนรับสู่ ${buildingName}`;

    await sendMessage(base44, lineUserId, welcomeText, branchId, replyToken);
}

async function sendConfirmationMessage(base44, lineUserId, tenant, branch, replyToken = null) {
    let confirmText = `✅ เชื่อมโยงบัญชีสำเร็จ!\n\n`;
    confirmText += `👤 ชื่อ: ${tenant.full_name}\n`;
    confirmText += `📱 เบอร์: ${tenant.phone}`;
    if (branch) {
        confirmText += `\n🏢 สาขา: ${branch.branch_name}`;
    }
    confirmText += `\n\nส่งรูปสลิปเพื่อชำระค่าเช่าทางนี้ได้เลยค่ะ`;

    await sendMessage(base44, lineUserId, confirmText, tenant.branch_id, replyToken);
}

function sendNotFoundMessage(base44, lineUserId, phoneNumber, branchId = null, replyToken = null) {
    console.log(`ℹ️ No data found for "${phoneNumber}" - not sending response`);
    return;
}

// ปิดการลงทะเบียนด้วยชื่อ - ไม่ใช้งานแล้ว
function handleNameRegistration(base44, lineUserId, nameQuery, replyToken = null) {
    // ปิดการลงทะเบียนด้วยชื่อ - ไม่ตอบกลับอะไรเลย
    console.log(`ℹ️ Name registration is disabled - ignoring query: "${nameQuery}"`);
    return;
}

// ⭐⭐⭐ จัดการค่าใช้จ่าย - ข้อความเปล่า
async function handleEmployeeExpenseSubmission(base44, lineUserId, employee, messageText, replyToken, branchId) {
    try {
        console.log(`💼 Employee expense submission: ${messageText}`);
        
        // ⭐ รอ 1.5 วินาทีให้รูปที่ส่งมาก่อนหน้าทันอัปโหลดและบันทึกเข้า temp_expense_image_url
        console.log('⏳ Waiting 1.5s for image to be saved...');
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // ⭐ โหลด employee ใหม่เพื่อเอาข้อมูลล่าสุด (ป้องกัน race condition)
        const freshEmployeeResult = await base44.asServiceRole.entities.User.filter({
            employee_line_user_id: lineUserId,
            can_submit_expenses: true
        });
        const freshEmployee = Array.isArray(freshEmployeeResult) ? freshEmployeeResult[0] : freshEmployeeResult;
        
        if (!freshEmployee) {
            console.log('❌ Employee not found in fresh query');
            return;
        }
        
        // ใช้ข้อมูลจาก fresh query
        const pendingData = freshEmployee.expense_pending_data;
        const tempImageUrl = freshEmployee.temp_expense_image_url;
        
        console.log('🔍 Fresh Employee Data:', {
            hasPendingData: !!pendingData,
            hasTempImage: !!tempImageUrl,
            editMode: freshEmployee.expense_edit_mode
        });
        
        if (messageText.toLowerCase().includes('ยกเลิก')) {
            await base44.asServiceRole.entities.User.update(freshEmployee.id, {
                expense_pending_data: null,
                temp_expense_image_url: null
            });
            await sendMessage(base44, lineUserId, '❌ ยกเลิกการบันทึกค่าใช้จ่ายแล้ว', branchId, replyToken);
            return;
        }
        
        // ⭐ ถ้ากด "แก้ไข" แต่ไม่มี pending data → ไม่ส่งอะไรเลย
        if (!pendingData && (messageText.toLowerCase().includes('แก้') || messageText === '✏️ แก้ไข')) {
            console.log('ℹ️ Edit requested but no pending data - not responding');
            return;
        }
        
        if (pendingData && (messageText.includes('ยืนยัน') || messageText.includes('✅'))) {
            console.log('========================================');
            console.log('✅ CONFIRMING EXPENSE');
            console.log(`📊 Pending Data:`, JSON.stringify(pendingData, null, 2));
            console.log(`👤 Employee:`, employee.email);
            console.log(`🏢 Branch ID:`, employee.assigned_branch_id || branchId);
            console.log('========================================');
            
            // ตรวจสอบข้อมูลก่อน create
            if (!pendingData.title || !pendingData.amount || !pendingData.category || !pendingData.date) {
                console.error('❌ Missing required fields:', {
                    title: !!pendingData.title,
                    amount: !!pendingData.amount,
                    category: !!pendingData.category,
                    date: !!pendingData.date
                });
                await sendMessage(base44, lineUserId,
                    '❌ ข้อมูลไม่ครบ กรุณาส่งใหม่อีกครั้ง',
                    branchId,
                    replyToken
                );
                return;
            }
            
            // บันทึก Expense
            const expenseData = {
                branch_id: freshEmployee.assigned_branch_id || branchId,
                title: pendingData.title,
                amount: pendingData.amount,
                category: pendingData.category,
                date: pendingData.date,
                description: pendingData.description,
                receipt_image: pendingData.receipt_image || null,
                notes: `ส่งโดย ${employee.full_name || employee.email} ผ่าน LINE`
            };
            
            console.log('💾 Creating Expense with data:', JSON.stringify(expenseData, null, 2));
            
            const createdExpense = await base44.asServiceRole.entities.Expense.create(expenseData);
            
            console.log('✅ Expense created successfully! ID:', createdExpense.id);
            
            await base44.asServiceRole.entities.User.update(freshEmployee.id, {
                expense_pending_data: null,
                temp_expense_image_url: null
            });
            
            console.log('✅ Cleared pending data and temp image from employee');
            
            const categoryTh = {
                electricity: 'ค่าไฟ',
                water: 'ค่าน้ำ',
                repair: 'ค่าซ่อม',
                internet: 'ค่าเน็ต',
                salary: 'เงินเดือน',
                supplies: 'อุปกรณ์',
                refund_deposit: 'คืนเงินมัดจำ',
                other: 'อื่นๆ'
            };
            
            // ส่ง Flex Message แสดงว่าบันทึกสำเร็จ
            const successFlex = {
                type: 'flex',
                altText: '✅ บันทึกค่าใช้จ่ายสำเร็จ',
                contents: {
                    type: 'bubble',
                    hero: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: '✅',
                                        size: 'xxl',
                                        align: 'center',
                                        color: '#06C755'
                                    },
                                    {
                                        type: 'text',
                                        text: 'บันทึกสำเร็จ',
                                        size: 'xl',
                                        weight: 'bold',
                                        align: 'center',
                                        color: '#06C755',
                                        margin: 'md'
                                    }
                                ],
                                paddingAll: 'xl',
                                backgroundColor: '#F0FFF4'
                            }
                        ],
                        paddingAll: 'none'
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: pendingData.title,
                                size: 'lg',
                                weight: 'bold',
                                wrap: true,
                                color: '#1a1a1a'
                            },
                            {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'box',
                                        layout: 'baseline',
                                        contents: [
                                            { type: 'text', text: '💰', size: 'sm', flex: 0 },
                                            { type: 'text', text: 'ยอดเงิน:', size: 'sm', color: '#666666', flex: 2, margin: 'sm' },
                                            { type: 'text', text: `${parseFloat(pendingData.amount).toLocaleString()} บาท`, size: 'sm', weight: 'bold', color: '#06C755', flex: 3, align: 'end' }
                                        ],
                                        margin: 'md'
                                    },
                                    {
                                        type: 'box',
                                        layout: 'baseline',
                                        contents: [
                                            { type: 'text', text: '📁', size: 'sm', flex: 0 },
                                            { type: 'text', text: 'ประเภท:', size: 'sm', color: '#666666', flex: 2, margin: 'sm' },
                                            { type: 'text', text: categoryTh[pendingData.category] || pendingData.category, size: 'sm', color: '#1a1a1a', flex: 3, align: 'end' }
                                        ],
                                        margin: 'sm'
                                    },
                                    {
                                        type: 'box',
                                        layout: 'baseline',
                                        contents: [
                                            { type: 'text', text: '📅', size: 'sm', flex: 0 },
                                            { type: 'text', text: 'วันที่:', size: 'sm', color: '#666666', flex: 2, margin: 'sm' },
                                            { type: 'text', text: pendingData.date, size: 'sm', color: '#1a1a1a', flex: 3, align: 'end' }
                                        ],
                                        margin: 'sm'
                                    }
                                ]
                            }
                        ],
                        spacing: 'md'
                    },
                    styles: {
                        footer: { separator: false }
                    }
                }
            };
            
            const lineToken = await getLineToken(base44, branchId);
            if (lineToken) {
                const endpoint = replyToken 
                    ? 'https://api.line.me/v2/bot/message/reply'
                    : 'https://api.line.me/v2/bot/message/push';

                const body = replyToken
                    ? { replyToken, messages: [successFlex] }
                    : { to: lineUserId, messages: [successFlex] };

                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${lineToken}`
                    },
                    body: JSON.stringify(body)
                });

                if (!response.ok && replyToken) {
                    const fallbackEndpoint = 'https://api.line.me/v2/bot/message/push';
                    const fallbackBody = { to: lineUserId, messages: [successFlex] };
                    
                    await fetch(fallbackEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${lineToken}`
                        },
                        body: JSON.stringify(fallbackBody)
                    });
                }
            }
            
            console.log('✅ Success Flex message sent');
            return;
        }
        
        if (pendingData && (messageText.toLowerCase().includes('แก้') || messageText === '✏️ แก้ไข')) {
            const categoryTh = {
                electricity: 'ค่าไฟ',
                water: 'ค่าน้ำ',
                repair: 'ค่าซ่อม',
                internet: 'ค่าเน็ต',
                salary: 'เงินเดือน',
                supplies: 'อุปกรณ์',
                refund_deposit: 'คืนเงินมัดจำ',
                other: 'อื่นๆ'
            };

            // ส่ง text template และตั้งค่าโหมดแก้ไข
            await sendEditTemplate(base44, lineUserId, pendingData, categoryTh, branchId, replyToken);
            
            // ตั้งค่า flag แก้ไข (ไม่ลบ pending data)
            await base44.asServiceRole.entities.User.update(freshEmployee.id, {
                expense_edit_mode: true
            });
            return;
        }
        
        // ⭐⭐⭐ เช็คว่าอยู่ในโหมดแก้ไขหรือไม่
        if (freshEmployee.expense_edit_mode === true) {
            console.log('✏️ Edit mode detected - analyzing edited message');
            
            // ⭐ Extract บรรทัด "ประเภท :" ด้วย regex ก่อน
            const categoryLineMatch = messageText.match(/ประเภท\s*[:：]\s*(.+)/i);
            const categoryText = categoryLineMatch ? categoryLineMatch[1].trim() : null;
            
            console.log('🔍 [REGEX] Category line found:', categoryText || 'NOT FOUND');
            
            // ⭐ แปลงเป็น enum ด้วย mapping
            const categoryMapping = {
                'ค่าไฟ': 'electricity',
                'ไฟฟ้า': 'electricity',
                'ค่าน้ำ': 'water',
                'ค่านำ้': 'water', // รองรับพิมพ์ผิด
                'น้ำ': 'water',
                'นำ้': 'water', // รองรับพิมพ์ผิด
                'ค่าซ่อม': 'repair',
                'ซ่อม': 'repair',
                'ค่าเน็ต': 'internet',
                'อินเทอร์เน็ต': 'internet',
                'เงินเดือน': 'salary',
                'อุปกรณ์': 'supplies',
                'คืนเงินมัดจำ': 'refund_deposit',
                'มัดจำ': 'refund_deposit'
            };
            
            let extractedCategory = 'other';
            if (categoryText) {
                // หาคีย์ที่ตรงกับข้อความ (ใช้ includes เพื่อรองรับ substring)
                for (const [key, value] of Object.entries(categoryMapping)) {
                    if (categoryText.includes(key)) {
                        extractedCategory = value;
                        console.log(`✅ [REGEX] Mapped "${categoryText}" → ${value}`);
                        break;
                    }
                }
            }
            
            // วิเคราะห์ส่วนอื่นด้วย AI (ไม่ให้ AI ตีความ category อีก)
            const editedAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `วิเคราะห์ข้อความค่าใช้จ่ายที่แก้ไขแล้ว (ไม่ต้องสน category):

"${messageText}"

วันที่ปัจจุบัน: ${new Date().toISOString().split('T')[0]}

กรุณา extract:
1. amount: ดูจากบรรทัด "ยอดเงิน :" (ตัวเลขเท่านั้น)
2. date: ดูจากบรรทัด "วันที่ :" ในรูป YYYY-MM-DD
3. description: ดูจากบรรทัด "รายละเอียด :"
4. title: ดูจากบรรทัด "หัวข้อ :"`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        amount: { type: "number" },
                        date: { type: "string" },
                        description: { type: "string" },
                        title: { type: "string" }
                    },
                    required: ["amount", "date", "title"]
                }
            });
            
            // รวม category จาก regex + ส่วนอื่นจาก AI
            editedAnalysis.category = extractedCategory;
            
            const categoryTh = {
                electricity: 'ค่าไฟ',
                water: 'ค่าน้ำ',
                repair: 'ค่าซ่อม',
                internet: 'ค่าเน็ต',
                salary: 'เงินเดือน',
                supplies: 'อุปกรณ์',
                refund_deposit: 'คืนเงินมัดจำ',
                other: 'อื่นๆ'
            };
            
            // สร้าง pending data ใหม่ (เก็บรูปเดิมถ้ามี)
            const updatedData = {
                title: editedAnalysis.title,
                amount: editedAnalysis.amount,
                category: editedAnalysis.category,
                date: editedAnalysis.date,
                description: editedAnalysis.description || editedAnalysis.title,
                receipt_image: pendingData?.receipt_image || null
            };
            
            // อัพเดท pending data และปิดโหมดแก้ไข
            await base44.asServiceRole.entities.User.update(freshEmployee.id, {
                expense_pending_data: updatedData,
                expense_edit_mode: false
            });
            
            console.log('✅ Updated data from edit:', updatedData);
            console.log('🔍 [EDIT] Final category:', updatedData.category);
            
            // ส่ง Flex confirmation
            await sendFlexConfirmation(base44, lineUserId, updatedData, categoryTh, branchId, replyToken);
            return;
        }
        
        // ⭐⭐⭐ เช็คว่ามีรูปส่งมาก่อนหน้านี้หรือไม่ (จาก temp_expense_image_url)
        console.log('🔍 Checking for temp image:', {
            hasTempImage: !!tempImageUrl,
            tempImageUrl: tempImageUrl || 'null'
        });
        
        if (tempImageUrl) {
            console.log('🔄 Found temp image - Auto-Merging image (from temp) + text');
            
            // วิเคราะห์ข้อความเพื่อเอา title, description, date
            const textAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `วิเคราะห์ข้อความค่าใช้จ่ายนี้และ extract ข้อมูล:

"${messageText}"

วันที่ปัจจุบัน: ${new Date().toISOString().split('T')[0]}

กรุณา extract:
1. category: electricity, water, repair, internet, salary, supplies, refund_deposit, other
2. title: หัวข้อสั้นๆ ไม่เกิน 50 ตัวอักษร
3. description: รายละเอียดสั้นๆ
4. date: วันที่ในรูป YYYY-MM-DD
   - ถ้าระบุวันที่ชัดเจน (เช่น "5/1", "วันที่ 3", "เมื่อวาน") ให้แปลงเป็น YYYY-MM-DD
   - ถ้าพูดถึง "เมื่อวาน" ให้ใช้วันก่อนหน้า
   - **เฉพาะเมื่อไม่มีการระบุวันที่เลย** ให้ใช้วันนี้`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        category: {
                            type: "string",
                            enum: ["electricity", "water", "repair", "internet", "salary", "supplies", "refund_deposit", "other"]
                        },
                        title: { type: "string" },
                        description: { type: "string" },
                        date: { type: "string" }
                    },
                    required: ["category", "title", "date"]
                }
            });
            
            // วิเคราะห์รูปเพื่อเอา amount และ date
            const imageAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `วิเคราะห์ใบเสร็จนี้และ extract ข้อมูล:

วันที่ปัจจุบัน: ${new Date().toISOString().split('T')[0]}

กรุณา extract เฉพาะ:
1. amount: จำนวนเงินรวม (ตัวเลขเท่านั้น)
2. date: วันที่โอนเงิน หรือวันที่ในใบเสร็จ ในรูป YYYY-MM-DD (ถ้าไม่มีให้ใช้วันนี้)`,
                file_urls: [tempImageUrl],
                response_json_schema: {
                    type: "object",
                    properties: {
                        amount: { type: "number" },
                        date: { type: "string" }
                    },
                    required: ["amount", "date"]
                }
            });
            
            const categoryTh = {
                electricity: 'ค่าไฟ',
                water: 'ค่าน้ำ',
                repair: 'ค่าซ่อม',
                internet: 'ค่าเน็ต',
                salary: 'เงินเดือน',
                supplies: 'อุปกรณ์',
                refund_deposit: 'คืนเงินมัดจำ',
                other: 'อื่นๆ'
            };
            
            // รวมข้อมูล: title/category/description/date จากข้อความ + amount/รูปจากรูปภาพ
            const mergedData = {
                title: textAnalysis.title,
                amount: imageAnalysis.amount,
                category: textAnalysis.category,
                date: textAnalysis.date || imageAnalysis.date, // ใช้วันที่จากข้อความก่อน ถ้าไม่มีค่อยใช้จากรูป
                description: textAnalysis.description || textAnalysis.title,
                receipt_image: tempImageUrl
            };
            
            // อัพเดท pending data และลบ temp
            await base44.asServiceRole.entities.User.update(freshEmployee.id, {
                expense_pending_data: mergedData,
                temp_expense_image_url: null
            });
            
            console.log('✅ Merged data (image first):', mergedData);
            console.log('🔍 DEBUG: Merged receipt_image =', mergedData.receipt_image);
            
            // ส่ง Flex confirmation เพียงครั้งเดียว (ไม่ส่งข้อความธรรมดา)
            await sendFlexConfirmation(base44, lineUserId, mergedData, categoryTh, branchId, replyToken);
            return;
        }
        
        // ⭐⭐⭐ ถ้ามี pending data ที่มีรูปอยู่แล้ว + ส่งข้อความตาม → Auto-Merge
        if (pendingData && pendingData.receipt_image) {
            console.log('🔄 Auto-Merge: มีรูปอยู่แล้ว + ข้อความใหม่ → รวมข้อมูล');
            
            // AI Extract category, title, description, date จากข้อความ
            const textAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
                prompt: `วิเคราะห์ข้อความค่าใช้จ่ายนี้และ extract ข้อมูล:

"${messageText}"

วันที่ปัจจุบัน: ${new Date().toISOString().split('T')[0]}

กรุณา extract:
1. category: electricity, water, repair, internet, salary, supplies, refund_deposit, other
2. title: หัวข้อสั้นๆ ไม่เกิน 50 ตัวอักษร
3. description: รายละเอียดสั้นๆ
4. date: วันที่ในรูป YYYY-MM-DD
   - ถ้าระบุวันที่ชัดเจน (เช่น "5/1", "วันที่ 3", "เมื่อวาน") ให้แปลงเป็น YYYY-MM-DD
   - ถ้าพูดถึง "เมื่อวาน" ให้ใช้วันก่อนหน้า
   - **เฉพาะเมื่อไม่มีการระบุวันที่เลย** ให้ใช้วันนี้`,
                response_json_schema: {
                    type: "object",
                    properties: {
                        category: {
                            type: "string",
                            enum: ["electricity", "water", "repair", "internet", "salary", "supplies", "refund_deposit", "other"]
                        },
                        title: { type: "string" },
                        description: { type: "string" },
                        date: { type: "string" }
                    },
                    required: ["category", "title", "date"]
                }
            });
            
            const categoryTh = {
                electricity: 'ค่าไฟ',
                water: 'ค่าน้ำ',
                repair: 'ค่าซ่อม',
                internet: 'ค่าเน็ต',
                salary: 'เงินเดือน',
                supplies: 'อุปกรณ์',
                refund_deposit: 'คืนเงินมัดจำ',
                other: 'อื่นๆ'
            };
            
            // รวมข้อมูล: ข้อความใหม่ + ยอดเงิน/รูปจากเดิม, วันที่ใช้จากข้อความก่อน
            const mergedData = {
                title: textAnalysis.title,
                amount: pendingData.amount,
                category: textAnalysis.category,
                date: textAnalysis.date || pendingData.date, // ใช้วันที่จากข้อความก่อน ถ้าไม่มีค่อยใช้เดิม
                description: textAnalysis.description || textAnalysis.title,
                receipt_image: pendingData.receipt_image
            };
            
            await base44.asServiceRole.entities.User.update(freshEmployee.id, {
                expense_pending_data: mergedData
            });
            
            console.log('✅ Merged data:', mergedData);
            console.log('🔍 DEBUG: Merged receipt_image =', mergedData.receipt_image);
            
            // ส่ง Flex confirmation เพียงครั้งเดียว (ไม่ส่งข้อความธรรมดา)
            await sendFlexConfirmation(base44, lineUserId, mergedData, categoryTh, branchId, replyToken);
            return;
        }
        
        // ⭐ AI Extract ข้อมูล
        const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `วิเคราะห์ข้อความค่าใช้จ่ายต่อไปนี้:

"${messageText}"

วันที่ปัจจุบัน: ${new Date().toISOString().split('T')[0]}

กรุณา extract ข้อมูล:
1. category: electricity, water, repair, internet, salary, supplies, refund_deposit, other
2. amount: จำนวนเงิน (ตัวเลขเท่านั้น)
3. date: วันที่ในรูป YYYY-MM-DD
   - ถ้าระบุวันที่ชัดเจน (เช่น "5/1", "วันที่ 3", "เมื่อวาน") ให้แปลงเป็น YYYY-MM-DD
   - ถ้าพูดถึง "เมื่อวาน" ให้ใช้วันก่อนหน้า
   - ถ้าพูดถึง "วันก่อน" ให้ใช้วันก่อนหน้า
   - **เฉพาะเมื่อไม่มีการระบุวันที่เลย** ให้ใช้วันนี้
4. description: รายละเอียดสั้นๆ
5. title: หัวข้อสั้นๆ ไม่เกิน 50 ตัวอักษร`,
            response_json_schema: {
                type: "object",
                properties: {
                    category: {
                        type: "string",
                        enum: ["electricity", "water", "repair", "internet", "salary", "supplies", "refund_deposit", "other"]
                    },
                    amount: { type: "number" },
                    date: { type: "string" },
                    description: { type: "string" },
                    title: { type: "string" }
                },
                required: ["category", "amount", "date", "title"]
            }
        });
        
        const categoryTh = {
            electricity: 'ค่าไฟ',
            water: 'ค่าน้ำ',
            repair: 'ค่าซ่อม',
            internet: 'ค่าเน็ต',
            salary: 'เงินเดือน',
            supplies: 'อุปกรณ์',
            refund_deposit: 'คืนเงินมัดจำ',
            other: 'อื่นๆ'
        };

        // เก็บข้อมูล pending พร้อม timestamp
        await base44.asServiceRole.entities.User.update(freshEmployee.id, {
            expense_pending_data: {
                title: analysis.title,
                amount: analysis.amount,
                category: analysis.category,
                date: analysis.date,
                description: analysis.description || analysis.title,
                receipt_image: null,
                created_at: new Date().toISOString() // ⭐ เก็บเวลาสร้าง
            },
            temp_expense_image_url: null
        });

        console.log('📝 Expense text saved - sending Flex confirmation');
        
        // ⭐ ส่ง Flex Message พร้อมปุ่มยืนยัน/แก้ไข
        await sendFlexWithUploadOption(base44, lineUserId, analysis, categoryTh, branchId, replyToken);
        
    } catch (error) {
        console.error('❌ Expense submission error:', error);
        await sendMessage(base44, lineUserId,
            '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
            branchId,
            replyToken
        );
    }
}

// ⭐⭐⭐ ส่งแจ้งเตือนเมื่อมีข้อมูลค่าใช้จ่ายรออยู่แล้ว
async function sendPendingExpenseAlert(base44, lineUserId, pendingData, imageUrl, categoryTh, branchId, replyToken) {
    try {
        const lineToken = await getLineToken(base44, branchId);
        if (!lineToken) return;

        const flexMessage = {
            type: 'flex',
            altText: 'มีค่าใช้จ่ายรอยืนยันอยู่แล้ว',
            contents: {
                type: 'bubble',
                header: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: '⚠️ มีข้อมูลรอยืนยันอยู่',
                            weight: 'bold',
                            size: 'lg',
                            color: '#F59E0B'
                        },
                        {
                            type: 'text',
                            text: 'ยืนยันรายการค่าใช้จ่าย ✅',
                            weight: 'bold',
                            size: 'md',
                            color: '#475569',
                            margin: 'sm'
                        }
                    ],
                    backgroundColor: '#FEF3C7'
                },
                body: {
                    type: 'box',
                    layout: 'vertical',
                    contents: [
                        {
                            type: 'text',
                            text: 'ข้อมูลค่าใช้จ่ายที่รอยืนยัน:',
                            size: 'sm',
                            color: '#64748B',
                            margin: 'none'
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            spacing: 'sm',
                            margin: 'md',
                            contents: [
                                { type: 'text', text: 'หัวข้อ:', size: 'sm', color: '#64748B', flex: 2 },
                                { type: 'text', text: pendingData.title || 'ไม่ระบุ', wrap: true, color: '#334155', size: 'sm', flex: 5, weight: 'bold' }
                            ]
                        },
                        {
                            type: 'box',
                            layout: 'baseline',
                            spacing: 'sm',
                            margin: 'md',
                            contents: [
                                { type: 'text', text: 'ยอดสุทธิ:', size: 'sm', color: '#64748B', flex: 2 },
                                { type: 'text', text: `฿${pendingData.amount.toLocaleString()}`, wrap: true, weight: 'bold', color: '#F97316', size: 'xl', flex: 5 }
                            ]
                        },
                        {
                            type: 'separator',
                            margin: 'md'
                        },
                        {
                            type: 'text',
                            text: 'คุณต้องการทำอย่างไรกับรูปสลิปใหม่?',
                            size: 'sm',
                            color: '#475569',
                            margin: 'md',
                            wrap: true
                        }
                    ],
                    spacing: 'sm'
                },
                footer: {
                    type: 'box',
                    layout: 'vertical',
                    spacing: 'sm',
                    contents: [
                        {
                            type: 'button',
                            action: {
                                type: 'postback',
                                label: '🗑️ ลบข้อมูลเก่า ส่งใหม่',
                                data: `cancel_old_expense`
                            },
                            style: 'primary',
                            color: '#DC2626',
                            height: 'sm'
                        },
                        {
                            type: 'button',
                            action: {
                                type: 'postback',
                                label: '✅ เก็บเดิมไว้',
                                data: 'keep_old_expense'
                            },
                            style: 'secondary',
                            height: 'sm'
                        }
                    ]
                }
            }
        };

        const endpoint = replyToken 
            ? 'https://api.line.me/v2/bot/message/reply'
            : 'https://api.line.me/v2/bot/message/push';

        const body = replyToken
            ? { replyToken, messages: [flexMessage] }
            : { to: lineUserId, messages: [flexMessage] };

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok && replyToken) {
            const fallbackEndpoint = 'https://api.line.me/v2/bot/message/push';
            const fallbackBody = { to: lineUserId, messages: [flexMessage] };
            
            await fetch(fallbackEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${lineToken}`
                },
                body: JSON.stringify(fallbackBody)
            });
        }

        console.log('✅ Sent pending expense alert');
    } catch (error) {
        console.error('❌ Error sending pending expense alert:', error);
    }
}

// ⭐⭐⭐ จัดการเมื่อเลือก "ยกเลิกเดิม ส่งข้อมูลใหม่"
async function handleCancelOldExpense(base44, lineUserId, replyToken, branchId) {
    try {
        const employeeResult = await base44.asServiceRole.entities.User.filter({
            employee_line_user_id: lineUserId,
            can_submit_expenses: true
        });
        const employee = Array.isArray(employeeResult) ? employeeResult[0] : employeeResult;
        
        if (!employee) return;
        
        // ⭐ ลบข้อมูลเก่าทั้งหมด (ไม่ประมวลผลรูปใหม่)
        await base44.asServiceRole.entities.User.update(employee.id, {
            expense_pending_data: null,
            temp_expense_image_url: null
        });
        
        console.log('✅ Cleared old expense data - ready for new submission');
        
        // แจ้งให้ส่งข้อมูลใหม่
        await sendMessage(base44, lineUserId, 
            '🗑️ ลบข้อมูลเดิมแล้ว\n\n' +
            'กรุณาส่งข้อมูลค่าใช้จ่ายใหม่อีกครั้ง\n\n' +
            'ตัวอย่าง:\n' +
            '• ซื้อหลอดไฟ 200 บาท\n' +
            '• จ่ายค่าไฟ 1,500 บาท\n\n' +
            'หรือส่งรูปใบเสร็จมาได้เลยค่ะ',
            branchId,
            replyToken
        );
        
    } catch (error) {
        console.error('❌ Error canceling old expense:', error);
        await sendMessage(base44, lineUserId, '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', branchId, replyToken);
    }
}

// ⭐⭐⭐ จัดการเมื่อเลือก "เก็บเดิมไว้"
async function handleKeepOldExpense(base44, lineUserId, replyToken, branchId) {
    try {
        const employeeResult = await base44.asServiceRole.entities.User.filter({
            employee_line_user_id: lineUserId,
            can_submit_expenses: true
        });
        const employee = Array.isArray(employeeResult) ? employeeResult[0] : employeeResult;
        
        if (!employee) return;
        
        // ลบ temp image
        await base44.asServiceRole.entities.User.update(employee.id, {
            temp_expense_image_url: null
        });
        
        await sendMessage(base44, lineUserId, 
            '✅ เก็บข้อมูลเดิมไว้แล้ว\n\n' +
            'รูปใบเสร็จใหม่จะไม่ถูกใช้\n' +
            'คุณสามารถกด "✅ ยืนยัน" เพื่อบันทึกข้อมูลเดิม หรือ "✏️ แก้ไข" เพื่อแก้ไขข้อมูลได้',
            branchId,
            replyToken
        );
        
    } catch (error) {
        console.error('❌ Error keeping old expense:', error);
        await sendMessage(base44, lineUserId, '❌ เกิดข้อผิดพลาด', branchId, replyToken);
    }
}

// ⭐⭐⭐ จัดการค่าใช้จ่าย - รูปใบเสร็จ
async function handleEmployeeExpenseImage(base44, lineUserId, employee, messageId, replyToken, branchId) {
    try {
        console.log(`📸 Employee expense image from ${lineUserId}`);
        
        const lineToken = await getLineToken(base44, branchId);
        if (!lineToken) {
            await sendMessage(base44, lineUserId, '❌ ระบบขัดข้อง กรุณาติดต่อผู้ดูแล', branchId, replyToken);
            return;
        }
        
        // ดาวน์โหลดรูป
        const imageResponse = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
            headers: { 'Authorization': `Bearer ${lineToken}` }
        });
        
        if (!imageResponse.ok) {
            await sendMessage(base44, lineUserId, '❌ ไม่สามารถดาวน์โหลดรูปได้', branchId, replyToken);
            return;
        }
        
        const b = await imageResponse.arrayBuffer();
        const file = new File([new Blob([b], { type: 'image/jpeg' })], `exp.jpg`, { type: 'image/jpeg' });
        const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        
        console.log(`✅ Uploaded expense image: ${file_url}`);
        
        // ⭐ โหลดข้อมูล employee ใหม่อีกครั้ง (ป้องกัน race condition)
        const freshEmployeeResult = await base44.asServiceRole.entities.User.filter({
            employee_line_user_id: lineUserId,
            can_submit_expenses: true
        });
        const freshEmployee = Array.isArray(freshEmployeeResult) ? freshEmployeeResult[0] : freshEmployeeResult;
        const pendingData = freshEmployee?.expense_pending_data;
        
        if (pendingData) {
            // เช็คว่า pending data ถูกสร้างมานานแค่ไหน (ถ้ามากกว่า 30 วินาที = ไม่ใช่ race condition)
            const employeeUpdatedAt = freshEmployee.updated_date ? new Date(freshEmployee.updated_date) : new Date(0);
            const nowTime = new Date();
            const secondsSinceUpdate = (nowTime - employeeUpdatedAt) / 1000;
            
            console.log(`⏱️ Pending data age: ${secondsSinceUpdate.toFixed(1)} seconds`);
            
            // ⭐⭐⭐ ถ้ามีรูปอยู่แล้ว AND ข้อมูลเก่ากว่า 30 วินาที → ส่ง alert ให้เลือก
            if (pendingData.receipt_image && secondsSinceUpdate > 30) {
                console.log(`⚠️ Employee already has old expense with image - sending choice dialog`);
                
                const categoryTh = {
                    electricity: 'ค่าไฟ',
                    water: 'ค่าน้ำ',
                    repair: 'ค่าซ่อม',
                    internet: 'ค่าเน็ต',
                    salary: 'เงินเดือน',
                    supplies: 'อุปกรณ์',
                    refund_deposit: 'คืนเงินมัดจำ',
                    other: 'อื่นๆ'
                };
                
                // เก็บรูปใหม่ไว้ชั่วคราว
                await base44.asServiceRole.entities.User.update(freshEmployee.id, {
                    temp_expense_image_url: file_url
                });
                
                // ส่งแจ้งเตือนให้เลือก
                await sendPendingExpenseAlert(base44, lineUserId, pendingData, file_url, categoryTh, branchId, replyToken);
                return;
            }
            
            // ⭐⭐⭐ ถ้ามีข้อความ (title/description) แต่ไม่มีรูป
            if ((pendingData.title || pendingData.description) && !pendingData.receipt_image) {
                console.log(`📝 Pending data found (${secondsSinceUpdate.toFixed(1)}s old)`);
                
                // ⭐ เช็คว่าอยู่ในช่วง 30 วินาทีหรือไม่
                if (secondsSinceUpdate <= 30) {
                    console.log(`⏱️ Within 30s window - AUTO-MERGING text + image`);
                    
                    // AI Extract ข้อมูลจากรูป (เฉพาะ amount, date)
                    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
                        prompt: `วิเคราะห์ใบเสร็จนี้และ extract ข้อมูล:

วันที่ปัจจุบัน: ${new Date().toISOString().split('T')[0]}

กรุณา extract เฉพาะ:
1. amount: จำนวนเงินรวม (ตัวเลขเท่านั้น)
2. date: วันที่โอนเงิน หรือวันที่ในใบเสร็จ ในรูป YYYY-MM-DD (ถ้าไม่มีให้ใช้วันนี้)`,
                        file_urls: [file_url],
                        response_json_schema: {
                            type: "object",
                            properties: {
                                amount: { type: "number" },
                                date: { type: "string" }
                            },
                            required: ["amount", "date"]
                        }
                    });
                    
                    const categoryTh = {
                        electricity: 'ค่าไฟ',
                        water: 'ค่าน้ำ',
                        repair: 'ค่าซ่อม',
                        internet: 'ค่าเน็ต',
                        salary: 'เงินเดือน',
                        supplies: 'อุปกรณ์',
                        refund_deposit: 'คืนเงินมัดจำ',
                        other: 'อื่นๆ'
                    };
                        
                    // รวมข้อมูล: ใช้ category/title/description จากข้อความ + amount/date จากรูป
                    const mergedData = {
                        title: pendingData.title,
                        amount: analysis.amount,
                        category: pendingData.category,
                        date: analysis.date,
                        description: pendingData.description,
                        receipt_image: file_url
                    };
                    
                    // อัพเดท pending data
                    await base44.asServiceRole.entities.User.update(freshEmployee.id, {
                        expense_pending_data: mergedData
                    });
                    
                    console.log('✅ Auto-merged data:', mergedData);
                    
                    // ส่ง Flex confirmation ด้วยข้อมูลที่ผสานแล้ว
                    await sendFlexConfirmation(base44, lineUserId, mergedData, categoryTh, branchId, replyToken);
                    return;
                } else {
                    console.log(`⚠️ Outside 30s window (${secondsSinceUpdate.toFixed(1)}s) - treating as separate expense, will analyze full data from image`);
                    // ถ้าเกิน 30 วินาที → ถือว่าเป็นรูปใหม่ไม่เกี่ยวกับ pending เดิม → ส่งไป analyze ครบ
                    await base44.asServiceRole.entities.User.update(freshEmployee.id, {
                        expense_pending_data: null
                    });
                }
            }
        }
        
        // ⭐ ส่งรูปอย่างเดียว → เก็บ URL ไว้ใน temp_expense_image_url และไม่ส่งข้อความใดๆ
        console.log('📸 Image only - saving to temp_expense_image_url and NOT responding');
        
        await base44.asServiceRole.entities.User.update(employee.id, {
            temp_expense_image_url: file_url
        });
        
        console.log('✅ Saved temp_expense_image_url - waiting for text message');
        
    } catch (error) {
        console.error('❌ Expense image error:', error);
        await sendMessage(base44, lineUserId,
            '❌ ไม่สามารถประมวลผลรูปได้ กรุณาลองใหม่',
            branchId,
            replyToken
        );
    }
}