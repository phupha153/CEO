import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import { parseISO, differenceInDays } from 'npm:date-fns@3.0.0';

// ⭐ Helper: เช็คเลขบัญชีแบบปลอดภัย
function isAccountMatch(maskedSlipAccount, myRealAccount) {
    console.log('\n🔍 === ACCOUNT MATCH CHECK ===');
    console.log('  Input (from slip):', maskedSlipAccount);
    console.log('  Expected (my account):', myRealAccount);
    
    if (!maskedSlipAccount || !myRealAccount) {
        console.log('  ❌ Result: FAIL - Missing data');
        return false;
    }
    
    const slipAcc = String(maskedSlipAccount).replace(/[- ]/g, '').toLowerCase();
    const myAcc = String(myRealAccount).replace(/[- ]/g, '').toLowerCase();
    
    console.log('  Cleaned slip account:', slipAcc);
    console.log('  Cleaned my account:', myAcc);
    
    if (Math.abs(slipAcc.length - myAcc.length) > 2) {
        console.log(`  ❌ Result: FAIL - Length mismatch (${slipAcc.length} vs ${myAcc.length})`);
        return false;
    }
    
    let matchedCount = 0;
    const minRequired = slipAcc.length <= 4 ? 2 : 3;
    
    console.log(`  Min required matches: ${minRequired}`);
    
    for (let i = 0; i < Math.min(slipAcc.length, myAcc.length); i++) {
        if (slipAcc[i] === 'x' || slipAcc[i] === '*') {
            console.log(`  Position ${i}: MASKED (${slipAcc[i]}) - SKIP`);
            continue;
        }
        if (slipAcc[i] === myAcc[i]) {
            matchedCount++;
            console.log(`  Position ${i}: MATCH (${slipAcc[i]} === ${myAcc[i]})`);
        } else {
            console.log(`  Position ${i}: MISMATCH (${slipAcc[i]} !== ${myAcc[i]}) - FAIL`);
            return false;
        }
    }
    
    const isMatch = matchedCount >= minRequired;
    console.log(`  Matched count: ${matchedCount}/${minRequired}`);
    console.log(`  ✅ Result: ${isMatch ? 'PASS' : 'FAIL'}`);
    console.log('=========================\n');
    
    return isMatch;
}

// ⭐ คำนวณค่าปรับชำระล่าช้า
function calculateLateFee(payment, configs, branchId, calculationDate = null) {
    console.log(`🧮 LateFee: ${payment?.id?.substring(0, 8)}... | Due: ${payment?.due_date} | Status: ${payment?.status}`);
    
    if (!payment || !payment.due_date) {
        console.log('  ⏭️ SKIP: No due_date');
        return { lateFeeAmount: 0, daysLate: 0 };
    }
    
    if (payment.status === 'paid') {
        console.log(`  🔒 SKIP: Already paid (locked: ${payment.late_fee_amount || 0}฿)`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    if (payment.late_fee_locked === true) {
        console.log(`  🔒 SKIP: Admin locked (${payment.late_fee_amount || 0}฿)`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    const calcDate = calculationDate || new Date();
    
    console.log(`  🔍 LOCK 3 Check: late_fee_last_calculated=${payment.late_fee_last_calculated || 'null'}`);
    if (payment.late_fee_last_calculated) {
        const lastCalcDate = new Date(payment.late_fee_last_calculated);
        const lastCalcThailand = new Date(lastCalcDate.getTime() + (7 * 60 * 60 * 1000));
        const lastCalcDay = new Date(lastCalcThailand.getFullYear(), lastCalcThailand.getMonth(), lastCalcThailand.getDate());
        
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

function extractAmount(slipData) {
    console.log('\n🔍 === EXTRACT AMOUNT DEBUG ===');
    console.log('📋 Full slipData structure:', JSON.stringify(slipData, null, 2));
    
    const possiblePaths = [
        ['amount'],
        ['transAmount'],
        ['transaction', 'amount'],
        ['payment', 'amount'],
        ['data', 'amount'],
        ['receiver', 'amount'],
        ['sender', 'amount'],
        ['receiver', 'account', 'amount'],
        ['sender', 'account', 'amount']
    ];
    
    console.log(`🔎 Trying ${possiblePaths.length} possible paths...`);
    
    for (const path of possiblePaths) {
        let current = slipData;
        let isValid = true;
        
        console.log(`  Testing path: ${path.join('.')}`);
        
        for (const key of path) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
                console.log(`    ✓ Found key "${key}":`, typeof current === 'object' ? '{...}' : current);
            } else {
                isValid = false;
                console.log(`    ✗ Key "${key}" not found`);
                break;
            }
        }
        
        if (isValid && current !== null && current !== undefined) {
            const amount = typeof current === 'number' ? current : parseFloat(current);
            if (!isNaN(amount) && amount > 0) {
                console.log(`💰 ✅ SUCCESS! Found amount at path: ${path.join('.')} = ${amount}`);
                console.log('=============================\n');
                return { amount, path: path.join('.') };
            } else {
                console.log(`    ⚠️ Invalid amount value: ${current} (parsed: ${amount})`);
            }
        }
    }
    
    console.error('❌ FAILED! Could not find amount in ANY path!');
    console.error('📋 Available keys in slipData:', Object.keys(slipData || {}));
    console.log('=============================\n');
    return { amount: 0, path: 'not found' };
}

const processedMessages = new Set();
const messageSentCache = new Map();
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_DURATION = 5 * 60 * 1000;
const branchConfigCache = new Map();
const BRANCH_CONFIG_CACHE_DURATION = 5 * 60 * 1000;
const MAX_BRANCH_CONFIG_CACHE_SIZE = 1000;
let branchesCache = null;
let branchesCacheTime = 0;
const BRANCHES_CACHE_DURATION = 5 * 60 * 1000;

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

    if (challenge) {
        console.log(`✅ LINE Challenge received: ${challenge.substring(0, 20)}...`);
        return new Response(challenge, {
            status: 200,
            headers: { 'Content-Type': 'text/plain' }
        });
    }

    if (!queryBranchId) {
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'branch_id required' 
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ message: 'OK' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    let body;
    try {
        body = await req.json();
    } catch (parseError) {
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const base44 = createClientFromRequest(req);

    (async () => {
        try {
            const events = body.events || [];
            
            if (events.length === 0) return;
            
            const destinationBranchId = queryBranchId;

            for (const event of events) {
                const lineUserId = event.source?.userId;
                const replyToken = event.replyToken;
                
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

                    try {
                        let tenant = null;
                        const msgBranchId = destinationBranchId;
                        try {
                            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ 
                                line_user_id: lineUserId,
                                branch_id: msgBranchId 
                            });
                            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
                        } catch (e) {
                            console.log('⚠️ Could not find tenant:', e.message);
                        }
                        const finalBranchId = tenant?.branch_id || msgBranchId;

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

                        if (employee) {
                            await handleEmployeeExpenseSubmission(base44, lineUserId, employee, messageText, replyToken, destinationBranchId);
                            continue;
                        }
                        
                        if (messageText.toLowerCase().includes('ลงทะเบียน') || messageText.toLowerCase().includes('สมัคร')) {
                            console.log('📝 User asking for registration instructions');
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

                        if (messageText.toLowerCase().includes('แจ้งซ่อม')) {
                            console.log('🔧 Detected maintenance request keyword');
                            let tenant = null;
                            try {
                                const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ 
                                    line_user_id: lineUserId,
                                    branch_id: destinationBranchId 
                                });
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
                                    null,
                                    replyToken
                                );
                                continue;
                            }

                            const maintenanceKeywords = ['แจ้งซ่อม', 'แจ้ง ซ่อม'];
                            let problemDescription = messageText;
                            
                            for (const keyword of maintenanceKeywords) {
                                if (messageText.toLowerCase().includes(keyword)) {
                                    problemDescription = messageText.replace(new RegExp(keyword, 'gi'), '').trim();
                                    break;
                                }
                            }
                            
                            if (problemDescription.length > 2) {
                                console.log(`📝 Processing maintenance with description: "${problemDescription}"`);
                                await handleMaintenanceReport(base44, lineUserId, problemDescription, branchId, replyToken);
                            } else {
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
                            await handlePhoneNumberRegistration(base44, lineUserId, messageText, null, replyToken, destinationBranchId);
                            continue;
                        }
                        
                        let tenant = null;
                        try {
                            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ 
                                line_user_id: lineUserId,
                                branch_id: destinationBranchId
                            });
                            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
                        } catch (e) {
                            console.log('⚠️ Could not find tenant:', e.message);
                        }
                        const userBranchId = tenant?.branch_id || destinationBranchId;

                        console.log(`📍 User branch for text message: ${userBranchId ? userBranchId.substring(0, 12) + '...' : 'null (ไม่รู้สาขา)'}`);

                        if (!tenant) {
                            console.log(`🔍 Not registered yet. Trying name registration for: "${messageText}"`);
                            if (messageText.length >= 3) {
                                await handleNameRegistration(base44, lineUserId, messageText, replyToken);
                                continue;
                            }
                        }

                        if (tenant) {
                            console.log('ℹ️ Registered user sent general message - NOT responding (silent)');
                            continue;
                        }

                        console.log('ℹ️ Unknown message, not responding');
                        continue;
                    }
                    
                    if (messageType === 'image' && messageId) {
                        console.log(`📸 Image received from ${lineUserId}`);
                        
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
                            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ 
                                line_user_id: lineUserId,
                                branch_id: destinationBranchId
                            });
                            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
                        } catch (e) {
                            console.log('⚠️ Could not find tenant:', e.message);
                        }

                        if (!tenant) {
                            console.log(`ℹ️ User ${lineUserId} not connected - ignoring image, no response`);
                            continue;
                        }

                        const branchId = tenant.branch_id || destinationBranchId;

                        let hasPendingPayment = false;
                        try {
                            const paymentResult = await base44.asServiceRole.entities.Payment.filter({ 
                                tenant_id: tenant.id,
                                branch_id: branchId
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

                        let imageUrl = null;
                        try {
                            const lineToken = await getLineToken(base44, branchId);
                            if (lineToken) {
                                const imageResponse = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
                                    headers: { 'Authorization': `Bearer ${lineToken}` }
                                });
                                if (imageResponse.ok) {
                                    const imageBlob = await imageResponse.blob();
                                    const file = new File([imageBlob], `line-image-${Date.now()}.jpg`, { type: imageBlob.type });
                                    const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
                                    imageUrl = uploadResult.file_url;
                                    console.log(`✅ Uploaded image: ${imageUrl}`);
                                }
                            }
                        } catch (uploadError) {
                            console.log('⚠️ Could not upload image:', uploadError.message);
                        }

                        try {
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
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ 
                line_user_id: lineUserId,
                branch_id: branchId
            });
            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
        } catch (e) {
            console.log('⚠️ Could not find tenant:', e.message);
        }
        
        if (!tenant) {
            console.log('❌ Tenant not found');
            await sendMessage(base44, lineUserId, 
                '❌ ไม่พบข้อมูลของคุณในระบบ\n\n' +
                'กรุณาส่งเบอร์โทรศัพท์เพื่อลงทะเบียนก่อนค่ะ',
                null,
                replyToken
            );
            return;
        }
        
        const tenantBranchId = tenant.branch_id || branchId;
        
        let bookings = [];
        try {
            const bookingResult = await base44.asServiceRole.entities.Booking.filter({ tenant_id: tenant.id });
            bookings = Array.isArray(bookingResult) ? bookingResult : [bookingResult];
        } catch (e) {
            console.log('⚠️ Could not fetch bookings:', e.message);
        }
        
        const activeBookings = bookings
            .filter(b => b.tenant_id === tenant.id && b.status === 'active')
            .sort((a, b) => {
                try {
                    const dateA = new Date(a.created_date || a.check_in_date);
                    const dateB = new Date(b.created_date || b.check_in_date);
                    return dateB.getTime() - dateA.getTime();
                } catch {
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
        
        let successMessage = `✅ รับเรื่องแจ้งซ่อมแล้ว ทางเราจะรีบดำเนินการครับ 🔧`;
        
        console.log('📤 Sending success message with REPLY token...');
        await sendMessage(base44, lineUserId, successMessage, tenantBranchId, replyToken);
        console.log('✅ Maintenance report completed');
        
    } catch (error) {
        console.error('❌ Maintenance report error:', error);
        console.error('Error stack:', error.stack);
        let errorTenant = null;
        try {
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ 
                line_user_id: lineUserId,
                branch_id: branchId
            });
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

async function handlePhoneNumberRegistration(base44, lineUserId, phoneNumber, branchCode = null, replyToken = null, destinationBranchId = null) {
    try {
        if (!destinationBranchId) {
            console.error('❌ CRITICAL: Missing destinationBranchId - cannot register without branch context');
            await sendMessage(base44, lineUserId, 
                '❌ กรุณาลงทะเบียนผ่าน LINE OA ของสาขาที่ถูกต้องค่ะ\n\nถ้าไม่แน่ใจกรุณาติดต่อเจ้าของหอพัก',
                null,
                replyToken
            );
            return;
        }

        const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ 
            phone: phoneNumber,
            branch_id: destinationBranchId 
        });
        let tenants = Array.isArray(tenantResult) ? tenantResult : (tenantResult ? [tenantResult] : []);
        console.log(`🎯 Filtered tenants in branch ${destinationBranchId.substring(0, 8)}... → Found ${tenants.length}`);

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

        const matchingTenants = tenants;
        
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

async function handleSlipImage(base44, lineUserId, messageId, branchId = null, replyToken = null) {
    const lineToken = await getLineToken(base44, branchId);
    const slip2goApiKey = Deno.env.get('SLIP2GO_API_KEY');
    
    if (!lineToken || !slip2goApiKey) {
        await sendMessage(base44, lineUserId, '❌ ระบบขัดข้อง กรุณาติดต่อเจ้าของหอพัก', branchId, replyToken);
        return;
    }

    try {
        if (!branchId) {
            console.error(`❌ CRITICAL: No branchId available for slip verification`);
            await sendMessage(base44, lineUserId, '❌ เกิดข้อผิดพลาดในระบบ กรุณาติดต่อเจ้าของหอพัก', null, replyToken);
            return;
        }

        let tenant = null;
        try {
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ 
                line_user_id: lineUserId,
                branch_id: branchId
            });
            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
        } catch (e) {
            console.log('⚠️ Could not find tenant:', e.message);
        }

        if (!tenant) {
            await sendMessage(base44, lineUserId, 'กรุณาลงทะเบียนด้วยหมายเลขโทรศัพท์ก่อนใช้งาน\nพิมพ์: ลงทะเบียน 0812345678', branchId, replyToken);
            return;
        }

        // ⭐ ดึงบิลที่ค้างชำระทั้งหมด
        let pendingPayments = [];
        try {
            const paymentResult = await base44.asServiceRole.entities.Payment.filter({ 
                tenant_id: tenant.id,
                branch_id: branchId,
                status: { $in: ['pending', 'overdue', 'partial_paid'] }
            });
            pendingPayments = Array.isArray(paymentResult) ? paymentResult : (paymentResult ? [paymentResult] : []);
        } catch (e) {
            console.log('⚠️ Could not filter payments:', e.message);
            const allPayments = await base44.asServiceRole.entities.Payment.list('-created_date', 500);
            pendingPayments = allPayments.filter(p => 
                p.tenant_id === tenant.id && 
                p.branch_id === branchId &&
                (p.status === 'pending' || p.status === 'overdue' || p.status === 'partial_paid')
            );
        }

        if (pendingPayments.length === 0) {
            return;
        }

        // เรียงบิลตามวันครบกำหนด (เก่า → ใหม่)
        pendingPayments.sort((a, b) => {
            try {
                return new Date(a.due_date) - new Date(b.due_date);
            } catch {
                return 0;
            }
        });
        
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
                    const backoffMs = 2000 * Math.pow(2, retryCount);
                    console.log(`⏳ Download retry waiting ${backoffMs}ms...`);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
                
            } catch (downloadError) {
                console.error(`Download attempt ${retryCount + 1} error:`, downloadError.message);
                retryCount++;
                
                if (retryCount < maxRetries) {
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

        const imageBlob = await imageResponse.blob();
        
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
                    await base44.asServiceRole.entities.Payment.update(pendingPayments[0].id, {
                        notes: `${pendingPayments[0].notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่อัพโหลดไม่สำเร็จ - กรุณาให้ส่งใหม่`
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
            
            const isValidCode = slip2goData.code === '200200' || slip2goData.code === 200200;
            
            if ((slip2goResponse.ok && slip2goData.success && slip2goData.data) || (isValidCode && slip2goData.data)) {
                verificationMethod = 'qr-image';
                verificationSuccess = true;
            }
            
            if (slip2goResponse.status === 504 || responseText.includes('504')) {
                await base44.asServiceRole.entities.Payment.update(pendingPayments[0].id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayments[0].notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่ระบบตรวจสอบช้า`
                });
                
                await sendMessage(base44, lineUserId, 
                    `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ`,
                    branchId,
                    replyToken
                );
                return;
            }
            
        } catch (fetchError) {
            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line',
                branch_id: branchId,
                event_type: 'slip_verification_error',
                line_user_id: lineUserId,
                tenant_id: tenant?.id,
                payment_id: pendingPayments[0].id,
                status: 'error',
                message: 'Slip2Go API error',
                error_message: fetchError.message
            }).catch(() => {});

            await base44.asServiceRole.entities.Payment.update(pendingPayments[0].id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayments[0].notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่ระบบขัดข้อง`
            });
            
            await sendMessage(base44, lineUserId, 
                `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ`,
                branchId,
                replyToken
            );
            return;
        }

        const errorCode = slip2goData.code;
        const errorMessage = slip2goData.message || '';

        const isDuplicateError = errorCode === '200501' || errorMessage.toLowerCase().includes('duplicate');

        if (isDuplicateError) {
            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line',
                branch_id: branchId,
                event_type: 'slip_duplicate',
                line_user_id: lineUserId,
                tenant_id: tenant?.id,
                payment_id: pendingPayments[0].id,
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

        const isFraudSlip = errorCode === '200500' || errorMessage.toLowerCase().includes('fraud');

        if (isFraudSlip && !verificationSuccess) {
            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line',
                branch_id: branchId,
                event_type: 'slip_fraud',
                line_user_id: lineUserId,
                tenant_id: tenant?.id,
                payment_id: pendingPayments[0].id,
                status: 'warning',
                message: 'Fraud slip detected',
                details: { error_code: errorCode }
            }).catch(() => {});
            return;
        }

        const isSlipValid = slip2goResponse.ok && slip2goData.data && verificationSuccess;

        if (!isSlipValid) {
            const isSlipNotFound = errorCode === '200404' || errorMessage === 'Slip not found';

            if (isSlipNotFound) {
                const now = new Date().toISOString();
                await base44.asServiceRole.entities.Payment.update(pendingPayments[0].id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayments[0].notes || ''}\n\n⏳ รอตรวจสอบซ้ำ: ธนาคารยังไม่มีข้อมูล - ${now}`
                });

                console.log('📸 Slip saved silently - waiting for cron recheck');
                return;
            }

            return;
        }

        const slipData = slip2goData.data;
        const { amount: totalSlipAmount } = extractAmount(slipData);
        
        const senderName = slipData.sender?.account?.name?.th || 
                          slipData.sender?.displayName || 'N/A';
        const transDate = slipData.dateTime || slipData.transDate || new Date().toISOString().split('T')[0];

        if (totalSlipAmount === 0) {
            await base44.asServiceRole.entities.Payment.update(pendingPayments[0].id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayments[0].notes || ''}\n\n⚠️ รอตรวจสอบ: ระบบอ่านยอดไม่ได้`
            });
            
            await sendMessage(base44, lineUserId, 
                `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ`,
                branchId,
                replyToken
            );
            return;
        }

        console.log(`💰 Total slip amount: ${totalSlipAmount.toLocaleString()}฿`);
        console.log(`📊 Processing ${pendingPayments.length} pending bill(s)...`);

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

        const receiverAccount = slipData.receiver?.account?.bank?.account || '';
        const receiverPromptPay = slipData.receiver?.account?.proxy?.value || '';
        const receiverName = slipData.receiver?.account?.name || '';

        console.log('\n========== 🏦 ACCOUNT VERIFICATION START ==========');
        console.log('📋 Expected Configuration:');
        console.log('  Bank Account:', expectedAccountNumber || '(not set)');
        console.log('  PromptPay:', expectedPromptPay || '(not set)');
        console.log('\n📋 Received from Slip:');
        console.log('  Receiver Account:', receiverAccount || '(empty)');
        console.log('  Receiver PromptPay:', receiverPromptPay || '(empty)');
        console.log('  Receiver Name:', receiverName || '(empty)');

        if ((!expectedAccountNumber || expectedAccountNumber.trim() === '') && 
            (!expectedPromptPay || expectedPromptPay.trim() === '')) {
            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: pendingPayments[0].room_id });
            const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
            const roomNumber = room?.room_number || 'ไม่ทราบ';

            console.log('⚠️ NO CONFIG FOUND - Manual review required');

            await base44.asServiceRole.entities.Payment.update(pendingPayments[0].id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayments[0].notes || ''}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ (โอนเข้า: ${receiverName} บช ${receiverAccount})`
            });

            await sendMessage(base44, lineUserId, 
                `📸 ได้รับสลิปแล้ว!\n\n⚠️ ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ\nกรุณารอเจ้าของหอพักตรวจสอบค่ะ`,
                branchId,
                replyToken
            );
            return;
        }

        let accountMatch = false;
        let matchMethod = '';

        if (expectedAccountNumber) {
            console.log('\n🔍 Checking Bank Account Number...');
            accountMatch = isAccountMatch(receiverAccount, expectedAccountNumber);
            if (accountMatch) {
                matchMethod = 'Bank Account';
                console.log(`✅ MATCHED via Bank Account Number`);
            }
        }

        if (!accountMatch && expectedPromptPay) {
            console.log('\n🔍 Checking PromptPay...');
            console.log('  Trying receiverPromptPay vs expectedPromptPay...');
            const promptPayMatch1 = isAccountMatch(receiverPromptPay, expectedPromptPay);
            
            if (!promptPayMatch1) {
                console.log('  Trying receiverAccount vs expectedPromptPay...');
                const promptPayMatch2 = isAccountMatch(receiverAccount, expectedPromptPay);
                accountMatch = promptPayMatch2;
                if (promptPayMatch2) matchMethod = 'PromptPay (via receiverAccount)';
            } else {
                accountMatch = true;
                matchMethod = 'PromptPay';
            }
            
            if (accountMatch) {
                console.log(`✅ MATCHED via ${matchMethod}`);
            }
        }

        console.log('\n========== 🏦 ACCOUNT VERIFICATION RESULT ==========');
        console.log(`  Final Match: ${accountMatch ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`  Method: ${matchMethod || 'None'}`);
        console.log('====================================================\n');

        if (!accountMatch) {
            console.log('❌ Account mismatch - saving for manual review');
            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: pendingPayments[0].room_id });
            const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
            const roomNumber = room?.room_number || 'ไม่ทราบ';

            const errorMsg = `โอนเงินไปผิดบัญชี\n\nตรวจพบโอนเข้า: ${receiverAccount || receiverPromptPay}\nควรโอนเข้า: ${expectedAccountNumber || expectedPromptPay}\n\nกรุณาตรวจสอบอีกครั้ง`;

            await base44.asServiceRole.entities.Payment.update(pendingPayments[0].id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayments[0].notes || ''}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ${errorMsg}`
            });

            await sendMessage(base44, lineUserId, 
                `❌ ${errorMsg}\n\nกรุณารอเจ้าของหอพักตรวจสอบค่ะ 🙏`,
                branchId,
                replyToken
            );
            console.log('✅ Sent account mismatch message');
            return;
        }

        console.log('✅ Account verified - processing smart bill matching...');
        
        const now = new Date();
        const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const today = new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate());

        // ⭐⭐⭐ STEP 1: คำนวณยอดทุกบิล (รวมค่าปรับ)
        const billsWithAmounts = pendingPayments.map(payment => {
            const baseAmount = (parseFloat(payment.rent_amount) || 0) +
                              (parseFloat(payment.water_amount) || 0) +
                              (parseFloat(payment.electricity_amount) || 0) +
                              (parseFloat(payment.internet_amount) || 0) +
                              (parseFloat(payment.common_fee_amount) || 0) +
                              (parseFloat(payment.parking_fee_amount) || 0) +
                              (parseFloat(payment.other_amount) || 0);
            
            const { lateFeeAmount, daysLate } = calculateLateFee(payment, configs, branchId, today);
            const expectedAmount = baseAmount + lateFeeAmount;
            const currentPaid = parseFloat(payment.paid_amount || 0);
            const amountNeeded = expectedAmount - currentPaid;

            return {
                payment,
                baseAmount,
                lateFeeAmount,
                daysLate,
                expectedAmount,
                currentPaid,
                amountNeeded
            };
        });

        console.log(`💰 Slip Amount: ${totalSlipAmount.toLocaleString()}฿`);
        console.log(`📊 Found ${billsWithAmounts.length} pending bill(s):`);
        billsWithAmounts.forEach((b, i) => {
            console.log(`   ${i + 1}. Need ${b.amountNeeded.toLocaleString()}฿ (ID: ${b.payment.id.substring(0, 8)}...)`);
        });

        // ⭐⭐⭐ STEP 2: SMART MATCHING - หาบิลที่ยอดตรงกับสลิป ±5%
        let matchedBill = null;
        let matchType = '';

        for (const bill of billsWithAmounts) {
            const lowerBound = bill.amountNeeded * 0.95;
            const upperBound = bill.amountNeeded * 1.05;
            
            if (totalSlipAmount >= lowerBound && totalSlipAmount <= upperBound) {
                matchedBill = bill;
                matchType = 'exact_match';
                console.log(`🎯 EXACT MATCH! Slip ${totalSlipAmount.toLocaleString()}฿ ≈ Bill ${bill.amountNeeded.toLocaleString()}฿`);
                break;
            }
        }

        // ⭐⭐⭐ STEP 3: ประมวลผลตาม matching result
        let remainingAmount = totalSlipAmount;
        const paidBills = [];
        const partialBills = [];
        let updatesToProcess = [];

        if (matchedBill) {
            // ⭐ กรณี: ยอดตรงพอดี → จ่ายบิลนั้นเลย
            console.log(`✅ Processing matched bill...`);
            
            const amountUsed = Math.min(totalSlipAmount, matchedBill.expectedAmount);
            
            updatesToProcess.push({
                id: matchedBill.payment.id,
                data: {
                    status: 'paid',
                    payment_date: transDate.split('T')[0],
                    payment_slip_url: slipImageUrl,
                    late_fee_amount: matchedBill.lateFeeAmount,
                    total_amount: matchedBill.expectedAmount,
                    paid_amount: matchedBill.expectedAmount,
                    notes: `${matchedBill.payment.notes || ''}\n\n✅ ชำระผ่าน LINE (ยอดตรง): ${senderName} โอน ${amountUsed.toLocaleString()} บาท${matchedBill.lateFeeAmount > 0 ? ` (รวมค่าปรับ ${matchedBill.lateFeeAmount.toLocaleString()} บาท)` : ''}`
                },
                tenant_id: tenant.id,
                amount_used: amountUsed
            });
            
            paidBills.push({ payment: matchedBill.payment, amountUsed, lateFeeAmount: matchedBill.lateFeeAmount, daysLate: matchedBill.daysLate });
            remainingAmount -= amountUsed;
            
            console.log(`   ✅ PAID (Exact Match): ${amountUsed.toLocaleString()}฿, Remaining: ${remainingAmount.toLocaleString()}฿`);
            
            // ⭐ ถ้ายังเหลือเงิน → cascade ต่อกับบิลอื่น
            if (remainingAmount > 0) {
                console.log(`💰 Remaining ${remainingAmount.toLocaleString()}฿ - cascading to other bills...`);
                
                for (const bill of billsWithAmounts) {
                    if (bill.payment.id === matchedBill.payment.id) continue;
                    if (remainingAmount <= 0) break;
                    
                    if (remainingAmount >= bill.amountNeeded * 0.95) {
                        const amountUsed = Math.min(remainingAmount, bill.expectedAmount);
                        
                        updatesToProcess.push({
                            id: bill.payment.id,
                            data: {
                                status: 'paid',
                                payment_date: transDate.split('T')[0],
                                payment_slip_url: slipImageUrl,
                                late_fee_amount: bill.lateFeeAmount,
                                total_amount: bill.expectedAmount,
                                paid_amount: bill.expectedAmount,
                                notes: `${bill.payment.notes || ''}\n\n✅ ชำระผ่าน LINE (เงินเหลือจาก cascade): ${amountUsed.toLocaleString()} บาท${bill.lateFeeAmount > 0 ? ` (รวมค่าปรับ ${bill.lateFeeAmount.toLocaleString()} บาท)` : ''}`
                            },
                            tenant_id: tenant.id,
                            amount_used: amountUsed
                        });
                        
                        paidBills.push({ payment: bill.payment, amountUsed, lateFeeAmount: bill.lateFeeAmount, daysLate: bill.daysLate });
                        remainingAmount -= amountUsed;
                        console.log(`   ✅ CASCADE PAID: ${amountUsed.toLocaleString()}฿, Remaining: ${remainingAmount.toLocaleString()}฿`);
                    } else if (remainingAmount > 0) {
                        const newPaidAmount = bill.currentPaid + remainingAmount;
                        
                        updatesToProcess.push({
                            id: bill.payment.id,
                            data: {
                                status: 'partial_paid',
                                paid_amount: newPaidAmount,
                                payment_slip_url: slipImageUrl,
                                late_fee_amount: bill.lateFeeAmount,
                                total_amount: bill.expectedAmount,
                                notes: `${bill.payment.notes || ''}\n\n💰 ชำระบางส่วน (cascade): ${remainingAmount.toLocaleString()} บาท (รวมแล้ว ${newPaidAmount.toLocaleString()}/${bill.expectedAmount.toLocaleString()} บาท)`
                            }
                        });
                        
                        partialBills.push({ payment: bill.payment, amountUsed: remainingAmount, shortfall: bill.expectedAmount - newPaidAmount });
                        console.log(`   ⚠️ CASCADE PARTIAL: ${remainingAmount.toLocaleString()}฿`);
                        remainingAmount = 0;
                    }
                }
            }
        } else {
            // ⭐ กรณี: ไม่มียอดตรงพอดี → Cascade ตามเดิม (เรียงตามวันครบกำหนด)
            console.log(`⚠️ No exact match - using CASCADE mode (oldest bill first)`);
            
            for (let i = 0; i < billsWithAmounts.length && remainingAmount > 0; i++) {
                const bill = billsWithAmounts[i];
                
                console.log(`📋 Bill ${i + 1}: Need ${bill.amountNeeded.toLocaleString()}฿`);

                if (remainingAmount >= bill.amountNeeded * 0.95) {
                    const amountUsed = Math.min(remainingAmount, bill.expectedAmount);
                    
                    updatesToProcess.push({
                        id: bill.payment.id,
                        data: {
                            status: 'paid',
                            payment_date: transDate.split('T')[0],
                            payment_slip_url: slipImageUrl,
                            late_fee_amount: bill.lateFeeAmount,
                            total_amount: bill.expectedAmount,
                            paid_amount: bill.expectedAmount,
                            notes: `${bill.payment.notes || ''}\n\n✅ ชำระผ่าน LINE (cascade): ${senderName} โอน ${amountUsed.toLocaleString()}/${totalSlipAmount.toLocaleString()} บาท${bill.lateFeeAmount > 0 ? ` (รวมค่าปรับ ${bill.lateFeeAmount.toLocaleString()} บาท)` : ''}`
                        },
                        tenant_id: tenant.id,
                        amount_used: amountUsed
                    });
                    
                    paidBills.push({ payment: bill.payment, amountUsed, lateFeeAmount: bill.lateFeeAmount, daysLate: bill.daysLate });
                    remainingAmount -= amountUsed;
                    console.log(`   ✅ CASCADE PAID: ${amountUsed.toLocaleString()}฿, Remaining: ${remainingAmount.toLocaleString()}฿`);
                } else if (remainingAmount > 0) {
                    const newPaidAmount = bill.currentPaid + remainingAmount;
                    
                    updatesToProcess.push({
                        id: bill.payment.id,
                        data: {
                            status: 'partial_paid',
                            paid_amount: newPaidAmount,
                            payment_slip_url: slipImageUrl,
                            late_fee_amount: bill.lateFeeAmount,
                            total_amount: bill.expectedAmount,
                            notes: `${bill.payment.notes || ''}\n\n💰 ชำระบางส่วน (cascade): ${remainingAmount.toLocaleString()} บาท (รวมแล้ว ${newPaidAmount.toLocaleString()}/${bill.expectedAmount.toLocaleString()} บาท)`
                        }
                    });
                    
                    partialBills.push({ payment: bill.payment, amountUsed: remainingAmount, shortfall: bill.expectedAmount - newPaidAmount });
                    console.log(`   ⚠️ CASCADE PARTIAL: ${remainingAmount.toLocaleString()}฿`);
                    remainingAmount = 0;
                }
            }
        }

        // ⭐ Batch Update ทุกบิลพร้อมกัน
        console.log(`📝 Updating ${updatesToProcess.length} bill(s)...`);
        for (const update of updatesToProcess) {
            await base44.asServiceRole.entities.Payment.update(update.id, update.data);
        }
        console.log('✅ All bills updated');

        // ⭐ ถ้ายอดเหลือ → เติม prepaid_balance
        if (remainingAmount > 0) {
            const currentPrepaid = tenant.prepaid_balance || 0;
            const newPrepaid = currentPrepaid + remainingAmount;
            
            await base44.asServiceRole.entities.Tenant.update(tenant.id, {
                prepaid_balance: newPrepaid
            });
            
            console.log(`💵 Added to prepaid: ${remainingAmount.toLocaleString()}฿ (${currentPrepaid}฿ → ${newPrepaid}฿)`);
        }

        // ⭐ Log webhook success
        await base44.asServiceRole.entities.WebhookLog.create({
            webhook_type: 'line',
            branch_id: branchId,
            event_type: 'multi_payment_verified',
            line_user_id: lineUserId,
            tenant_id: tenant?.id,
            amount: totalSlipAmount,
            status: 'success',
            message: `Paid ${paidBills.length} bill(s), Partial ${partialBills.length}`,
            details: { 
                paid_count: paidBills.length,
                partial_count: partialBills.length,
                remaining: remainingAmount,
                sender_name: senderName,
                match_type: matchType || 'cascade'
            }
        }).catch(() => {});

        // ⭐ คำนวณคะแนนการชำระเงิน
        if (tenant?.id && paidBills.length > 0) {
            try {
                console.log('📊 Calculating payment score...');
                await base44.asServiceRole.functions.invoke('calculatePaymentScores', {
                    tenant_id: tenant.id
                });
                console.log('✅ Payment score calculated');
            } catch (scoreError) {
                console.log('⚠️ Score calculation failed:', scoreError.message);
            }
        }

        // ⭐⭐⭐ ส่งใบเสร็จแยกทีละห้อง
        console.log(`📨 Sending ${paidBills.length} receipt(s)...`);
        const receiptResults = [];
        
        for (let i = 0; i < paidBills.length; i++) {
            const { payment } = paidBills[i];
            try {
                await base44.asServiceRole.functions.invoke('sendReceipt', { 
                    paymentId: payment.id 
                });
                receiptResults.push({ room: payment.room_id, status: 'sent' });
                console.log(`   ✅ Receipt ${i + 1}/${paidBills.length} sent`);
                
                if (i < paidBills.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            } catch (receiptError) {
                console.error(`   ❌ Receipt ${i + 1} failed:`, receiptError.message);
                receiptResults.push({ room: payment.room_id, status: 'failed' });
            }
        }

        // ⭐ ส่งข้อความสรุป
        let summaryMessage = `✅ ตรวจสอบสลิปสำเร็จ!\n\n`;
        summaryMessage += `💰 ยอดโอน: ${totalSlipAmount.toLocaleString()} บาท\n`;
        summaryMessage += `📅 วันที่: ${transDate.split('T')[0]}\n`;
        
        if (matchType === 'exact_match') {
            summaryMessage += `🎯 ระบบจับคู่ยอดอัตโนมัติ\n\n`;
        } else {
            summaryMessage += `📊 จ่ายตามลำดับวันครบกำหนด\n\n`;
        }
        
        if (paidBills.length > 0) {
            summaryMessage += `━━━━━━━━━━━━━━━━━━━━\n`;
            summaryMessage += `✅ ชำระครบ ${paidBills.length} ห้อง:\n`;
            
            for (const { payment, amountUsed } of paidBills) {
                const roomResult = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
                const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
                const roomNumber = room?.room_number || 'N/A';
                summaryMessage += `   • ห้อง ${roomNumber}: ${amountUsed.toLocaleString()}฿\n`;
            }
            summaryMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        }
        
        if (partialBills.length > 0) {
            const { payment, shortfall } = partialBills[0];
            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
            const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
            const roomNumber = room?.room_number || 'N/A';
            summaryMessage += `⚠️ ห้อง ${roomNumber}: ต้องโอนเพิ่มอีก ${shortfall.toLocaleString()}฿\n\n`;
        }
        
        if (remainingAmount > 0) {
            summaryMessage += `💵 เงินคงเหลือ: ${remainingAmount.toLocaleString()}฿\n(เติมเข้าบัญชีล่วงหน้าแล้ว)\n\n`;
        }
        
        summaryMessage += `📨 ส่งใบเสร็จแล้ว ${paidBills.length} ใบ\n\n`;
        summaryMessage += `ขอบคุณที่ชำระเงินค่ะ 🙏`;

        await sendMessage(base44, lineUserId, summaryMessage, branchId, replyToken);
        console.log('✅ Sent summary message');

    } catch (error) {
        console.error('❌ === SLIP PROCESSING ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        await base44.asServiceRole.entities.WebhookLog.create({
            webhook_type: 'line',
            branch_id: branchId,
            event_type: 'slip_processing_error',
            line_user_id: lineUserId,
            status: 'error',
            message: 'Slip processing failed',
            error_message: error.message
        }).catch(() => {});

        await sendMessage(base44, lineUserId, 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง', branchId, replyToken);
        console.log('✅ Sent error message to user');
    }
}

async function sendMessage(base44, lineUserId, text, branchId = null, replyToken = null) {
    try {
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

        const lineToken = await getLineToken(base44, branchId);

        if (!lineToken) {
            console.error(`❌ No LINE token available for branch: ${branchId ? branchId.substring(0, 12) + '...' : 'global'}`);
            console.error(`   ⚠️ กรุณาตั้งค่า LINE Token ในหน้า Settings → แท็บ LINE`);
            console.error(`   📍 branchId ที่ขอ: ${branchId || 'null (global)'}`);
            return;
        }

        console.log(`✅ Found LINE token for branch: ${branchId ? branchId.substring(0, 12) + '...' : 'global'} (Token: ${lineToken.substring(0, 20)}...)`);  

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

            if (responseText.includes('rate limit') || responseText.includes('429')) {
                messageSentCache.delete(cacheKey);
            }
        } else {
            const usedMethod = replyToken && endpoint.includes('reply') ? '⭐ REPLY' : '📮 PUSH';
            console.log(`✅ Message sent successfully via ${usedMethod}`);
            console.log(`📊 Stats: replyToken=${replyToken ? 'YES' : 'NO'}, endpoint=${endpoint.includes('reply') ? 'REPLY' : 'PUSH'}`);

            if (!replyToken || endpoint.includes('push')) {
                messageSentCache.set(cacheKey, Date.now());

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
    console.log(`ℹ️ No data found for "${phoneNumber}" - not sending any response`);
    return;
}

function handleNameRegistration(base44, lineUserId, nameQuery, replyToken = null) {
    console.log(`ℹ️ Name registration is disabled - ignoring query: "${nameQuery}"`);
    return;
}

async function handleEmployeeExpenseSubmission(base44, lineUserId, employee, messageText, replyToken, branchId) {
    console.log(`💼 Employee detected - forwarding to expense handler`);
}

async function handleEmployeeExpenseImage(base44, lineUserId, employee, messageId, replyToken, branchId) {
    console.log(`📸 Employee image detected`);
}

async function handleCancelOldExpense(base44, lineUserId, replyToken, branchId) {
    console.log(`🗑️ Cancel old expense`);
}

async function handleKeepOldExpense(base44, lineUserId, replyToken, branchId) {
    console.log(`✅ Keep old expense`);
}