import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const processedMessages = new Set();

// Rate limiting cache - ป้องกันส่งข้อความซ้ำๆ ใน 5 นาที
const messageSentCache = new Map();

// Cache สำหรับ Config - ป้องกันการ query ซ้ำๆ
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_DURATION = 10 * 1000; // 10 วินาที

// ⭐ Branch-specific Config Cache (แยก cache ตามสาขา)
const branchConfigCache = new Map();
const BRANCH_CONFIG_CACHE_DURATION = 30 * 1000; // 30 วินาที

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
                branchConfigCache.set(cacheKey, { token, timestamp: Date.now() });
                return token;
            }
        }

        const globalToken = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
        if (globalToken?.value?.trim()) {
            const token = globalToken.value.trim();
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
    // ⭐⭐⭐ LOG แรกสุด - ถ้าไม่เห็น log นี้ = webhook ไม่ได้ถูกเรียกเลย
    console.log('========================================');
    console.log('🚀 LINE WEBHOOK RECEIVED!');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log(`📍 Method: ${req.method}`);
    console.log(`📍 URL: ${req.url}`);
    console.log('========================================');
    
    // ⭐ CRITICAL: Validate branch_id from query parameter
    const url = new URL(req.url);
    const queryBranchId = url.searchParams.get('branch_id');
    console.log(`📍 Branch ID from URL: ${queryBranchId || 'NOT PROVIDED'}`);

    // ⚠️ ถ้าไม่มี branch_id = reject ทันที (ป้องกันข้อมูลปนกัน)
    if (!queryBranchId) {
        console.error('❌ CRITICAL: branch_id is required but not provided in URL');
        return new Response(JSON.stringify({ 
            success: false, 
            error: 'branch_id is required in query parameters' 
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // ส่ง 200 OK ทันทีก่อนทำอะไรเพื่อป้องกัน timeout
    if (req.method !== 'POST') {
        console.log('ℹ️ Not a POST request, returning OK');
        return new Response(JSON.stringify({ message: 'OK' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Parse body ก่อน return response
    let body;
    try {
        body = await req.json();
        console.log('📦 Webhook body received:', JSON.stringify(body).substring(0, 500));
    } catch (parseError) {
        console.error('❌ Failed to parse body:', parseError);
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // สร้าง base44 client ก่อน return response (เพราะต้องใช้ request headers)
    const base44 = createClientFromRequest(req);

    // Process ใน background (non-blocking)
    (async () => {
        try {
            const events = body.events || [];
            console.log(`=== Received ${events.length} event(s) for branch: ${queryBranchId || 'unknown'} ===`);
            
            if (events.length === 0) return;
            
            // ⭐ ใช้ branch_id จาก query parameter แทน destination
            const destinationBranchId = queryBranchId;

            for (const event of events) {
                const lineUserId = event.source?.userId;
                const replyToken = event.replyToken; // ⭐ ดึง replyToken จาก event
                
                if (!lineUserId) continue;

                if (event.type === 'follow') {
                    console.log(`✅ New follower: ${lineUserId}`);
                    
                    // ⭐ หา branch_id ของผู้ใช้ก่อนส่งข้อความ (ใช้ filter แทน list + find)
                    let tenant = null;
                    try {
                        const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
                        tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
                    } catch (e) {
                        console.log('⚠️ Could not find tenant by line_user_id:', e.message);
                    }
                    const userBranchId = tenant?.branch_id || destinationBranchId;
                    
                    console.log(`📍 User branch: ${userBranchId ? userBranchId.substring(0, 12) + '...' : 'null (ไม่รู้สาขา)'}`);
                    
                    await sendWelcomeMessage(base44, lineUserId, userBranchId, replyToken);
                    continue;
                }

                if (event.type === 'message') {
                    const messageId = event.message?.id;
                    const messageType = event.message?.type;
                    
                    if (messageId && processedMessages.has(messageId)) {
                        console.log(`⚠️ Message ${messageId} already processed, skipping`);
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
                        const msgBranchId = destinationBranchId; // ใช้ branch จาก destination ก่อน
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
                        
                        // ⭐ ถ้าพิมพ์ "ลงทะเบียน" → แสดงขั้นตอนการลงทะเบียน
                        if (messageText.toLowerCase().includes('ลงทะเบียน') || messageText.toLowerCase().includes('สมัคร')) {
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

                        if (messageText.toLowerCase().includes('แจ้งซ่อม')) {
                            console.log('🔧 Detected maintenance request keyword');
                            // ⭐ ใช้ filter แทน list + find + branch_id
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

                            // ⭐ ถ้าพิมพ์ "แจ้งซ่อม" ตามด้วยรายละเอียด → บันทึกเลย
                            // เช่น "แจ้งซ่อม แอร์ไม่เย็น" หรือ "แจ้งซ่อม ไฟดับ"
                            const maintenanceKeywords = ['แจ้งซ่อม', 'แจ้ง ซ่อม'];
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
                        
                        // ⭐ หา branch_id ของผู้ใช้ก่อนทำอะไร (ใช้ filter แทน list + find)
                        let tenant = null;
                        try {
                            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
                            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
                        } catch (e) {
                            console.log('⚠️ Could not find tenant:', e.message);
                        }
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
                                        // ⭐ ใช้ filter แทน list + find
                                        let tenant = null;
                                        try {
                                            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
                                            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
                                        } catch (e) {
                                            console.log('⚠️ Could not find tenant:', e.message);
                                        }

                                        // ⭐ ถ้าไม่ได้เชื่อมต่อ (ไม่มี tenant) → ไม่ตอบอะไรเลย
                                        if (!tenant) {
                                            console.log(`ℹ️ User ${lineUserId} not connected - ignoring image, no response`);
                                            continue;
                                        }

                                        const branchId = tenant.branch_id || destinationBranchId;

                                        // ⭐ เช็คว่ามี pending payment หรือไม่ ก่อนประมวลผลรูป
                                        let hasPendingPayment = false;
                                        try {
                                            const paymentResult = await base44.asServiceRole.entities.Payment.filter({ 
                                                tenant_id: tenant.id,
                                                branch_id: branchId
                                            });
                                            const allPayments = Array.isArray(paymentResult) ? paymentResult : (paymentResult ? [paymentResult] : []);
                                            hasPendingPayment = allPayments.some(p => p.status === 'pending' || p.status === 'overdue');
                                        } catch (e) {
                                            console.log('⚠️ Could not check payments:', e.message);
                                        }

                                        // ⭐ ถ้าไม่มี pending payment → ไม่ตอบอะไรเลย (ไม่ใช่สลิปที่เกี่ยวข้อง)
                                        if (!hasPendingPayment) {
                                            console.log(`ℹ️ User ${lineUserId} has no pending payment - ignoring image, no response`);
                                            continue;
                                        }

                        // ⭐ บันทึกข้อความประเภทรูปภาพลง LineMessage ก่อนประมวลผล
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

                            // ⭐ ดาวน์โหลดรูปและเก็บ URL
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
                            console.log(`💾 Saved incoming image to LineMessage entity`);
                        } catch (saveError) {
                            console.error('⚠️ Failed to save image message to LineMessage:', saveError.message);
                        }

                        await handleSlipImage(base44, lineUserId, messageId, branchId, replyToken);
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
        
        // ⭐ ใช้ filter แทน list + find เพื่อความแม่นยำ
        let tenant = null;
        try {
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
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
        
        let successMessage = `✅ บันทึกการแจ้งซ่อมสำเร็จ\n\n`;
        successMessage += `🏠 ห้อง: ${roomNumber}\n`;
        successMessage += `🔧 ปัญหา: ${analysisResult.title}\n`;
        successMessage += `📋 หมวดหมู่: ${categoryTh[analysisResult.category]}\n`;
        successMessage += `📝 รายละเอียด: ${analysisResult.description}\n\n`;
        successMessage += `เจ้าหน้าที่จะดำเนินการแก้ไขโดยเร็วที่สุดค่ะ 🙏`;
        
        console.log('📤 Sending success message with REPLY token...');
        await sendMessage(base44, lineUserId, successMessage, tenantBranchId, replyToken);
        console.log('✅ Maintenance report completed');
        
    } catch (error) {
        console.error('❌ Maintenance report error:', error);
        console.error('Error stack:', error.stack);
        // ⭐ ใช้ filter แทน list + find
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
        // ⭐ CRITICAL: ถ้ามี destinationBranchId ให้ดึงเฉพาะสาขานั้นก่อน
        let tenants;
        if (destinationBranchId) {
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ 
                phone: phoneNumber,
                branch_id: destinationBranchId 
            });
            tenants = Array.isArray(tenantResult) ? tenantResult : (tenantResult ? [tenantResult] : []);
            console.log(`🎯 Filtered by branch first: ${destinationBranchId.substring(0, 8)}... → Found ${tenants.length}`);
        } else {
            tenants = await fetchAllWithPagination(base44.asServiceRole.entities.Tenant);
            console.log(`📊 Fetched all tenants: ${tenants.length}`);
        }

        const branches = await base44.asServiceRole.entities.Branch.list();

        const matchingTenants = tenants.filter(t => t.phone === phoneNumber);
        
        console.log(`📱 Registration: phone=${phoneNumber}, branchCode=${branchCode}, destinationBranchId=${destinationBranchId}`);
        console.log(`📊 Total tenants: ${tenants.length}, Total branches: ${branches.length}`);
        
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
        
        if (destinationBranchId && matchingTenants.length > 1) {
            // ลอง filter เฉพาะสาขาที่ตรงกับ OA ที่ทักมา
            const filteredByDestination = matchingTenants.filter(t => t.branch_id === destinationBranchId);
            console.log(`🎯 Filtering by destinationBranchId: ${destinationBranchId.substring(0, 12)}... → Found ${filteredByDestination.length}`);
            if (filteredByDestination.length === 1) {
                console.log(`✅ Found exact match using destinationBranchId: ${destinationBranchId.substring(0, 12)}...`);
                matchingTenants = filteredByDestination;
            }
        }
        
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
        
        // ⭐ กรณีมีหลายสาขา - แสดงรายการให้เลือก
        // ⭐ แต่ถ้าเป็นสาขาเดียวกัน (แค่ซ้ำกัน) → ลงทะเบียนเลย
        const uniqueBranchIds = [...new Set(matchingTenants.map(t => t.branch_id))];
        console.log(`📊 Unique branches: ${uniqueBranchIds.length}`);
        
        if (uniqueBranchIds.length === 1) {
            // มีแค่ 1 สาขา แม้จะมีหลาย record → ลงทะเบียน record แรก
            const tenant = matchingTenants[0];
            console.log(`✅ All ${matchingTenants.length} tenants are in same branch, registering first one`);
            
            await base44.asServiceRole.entities.Tenant.update(tenant.id, {
                line_user_id: lineUserId
            });
            
            const branch = branches.find(b => b.id === tenant.branch_id);
            await sendConfirmationMessage(base44, lineUserId, tenant, branch, replyToken);
            return;
        }
        
        let message = `📋 พบข้อมูลของคุณใน ${uniqueBranchIds.length} สาขา\n\n`;
        message += `กรุณาส่งข้อมูลในรูปแบบ:\n`;
        message += `"เบอร์โทร รหัสสาขา"\n\n`;
        message += `ตัวอย่าง:\n`;
        
        for (const tenant of matchingTenants) {
            const branch = branches.find(b => b.id === tenant.branch_id);
            if (branch) {
                message += `• ${phoneNumber} ${branch.branch_code} (${branch.branch_name})\n`;
            }
        }
        
        await sendMessage(base44, lineUserId, message, destinationBranchId || matchingTenants[0].branch_id, replyToken);
        
    } catch (error) {
        console.error('Registration error:', error);
        await sendMessage(base44, lineUserId, 
            '❌ เกิดข้อผิดพลาดในการลงทะเบียน\n\nกรุณาลองใหม่อีกครั้งหรือติดต่อเจ้าของหอพักค่ะ',
            destinationBranchId,
            replyToken
        );
    }
}

function extractAmount(slipData) {
    const possiblePaths = [
        ['amount'],
        ['transAmount'],
        ['transaction', 'amount'],
        ['payment', 'amount'],
        ['data', 'amount'],
        ['receiver', 'amount'],
        ['sender', 'amount']
    ];
    
    for (const path of possiblePaths) {
        let current = slipData;
        let isValid = true;
        
        for (const key of path) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                isValid = false;
                break;
            }
        }
        
        if (isValid && current !== null && current !== undefined) {
            const amount = typeof current === 'number' ? current : parseFloat(current);
            if (!isNaN(amount) && amount > 0) {
                return { amount, path: path.join('.') };
            }
        }
    }
    
    return { amount: 0, path: 'not found' };
}

async function handleSlipImage(base44, lineUserId, messageId, branchId = null, replyToken = null) {
    // ใช้ฟังก์ชัน getLineToken แทน
    const lineToken = await getLineToken(base44, branchId);
    const slip2goApiKey = Deno.env.get('SLIP2GO_API_KEY');
    
    if (!lineToken || !slip2goApiKey) {
        console.error('❌ Missing tokens');
        await sendMessage(base44, lineUserId, '❌ ระบบขัดข้อง กรุณาติดต่อเจ้าของหอพัก', branchId, replyToken);
        return;
    }

    try {
        console.log('=== Starting slip verification ===');
        
        // ⭐ CRITICAL: Must filter by both branch_id AND line_user_id
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
            console.log(`❌ No tenant for user: ${lineUserId} in branch: ${branchId.substring(0, 8)}...`);
            await sendMessage(base44, lineUserId, 'กรุณาลงทะเบียนด้วยหมายเลขโทรศัพท์ก่อนใช้งาน\nพิมพ์: ลงทะเบียน 0812345678', branchId, replyToken);
            return;
        }

        console.log(`✅ Found tenant: ${tenant.full_name} (ID: ${tenant.id}) in branch: ${branchId.substring(0, 8)}...`);

        // ⭐ CRITICAL: Filter payments by tenant_id AND branch_id
        let pendingPayments = [];
        try {
            const paymentResult = await base44.asServiceRole.entities.Payment.filter({ 
                tenant_id: tenant.id,
                branch_id: branchId,
                status: { $in: ['pending', 'overdue'] }
            });
            pendingPayments = Array.isArray(paymentResult) ? paymentResult : (paymentResult ? [paymentResult] : []);
        } catch (e) {
            console.log('⚠️ Could not filter payments:', e.message);
            const allPayments = await base44.asServiceRole.entities.Payment.list('-created_date', 500);
            pendingPayments = allPayments.filter(p => 
                p.tenant_id === tenant.id && 
                p.branch_id === branchId &&
                (p.status === 'pending' || p.status === 'overdue')
            );
        }

        // New condition from outline: If no pending payments, do not respond.
        if (pendingPayments.length === 0) {
            console.log(`ℹ️ No pending payment for tenant: ${tenant.id} - NOT responding`);
            return;
        }

        // If there are pending payments, process the first one found (consistent with original `find` behavior)
        const pendingPayment = pendingPayments[0]; 

        console.log(`💰 Found pending payment: ${pendingPayment.id}`);
        console.log(`💰 Amount: ${pendingPayment.total_amount} บาท`);

        console.log(`📥 Downloading image from LINE...`);
        
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
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
            } catch (downloadError) {
                console.error(`Download attempt ${retryCount + 1} error:`, downloadError.message);
                retryCount++;
                
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
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
        console.log(`✅ Downloaded image: ${imageBlob.size} bytes`);
        
        if (imageBlob.size > 10 * 1024 * 1024) {
            console.error('❌ Image too large');
            await sendMessage(base44, lineUserId, 
                '❌ รูปภาพมีขนาดใหญ่เกินไป (เกิน 10MB)\n\nกรุณาส่งรูปที่มีขนาดเล็กกว่า หรือถ่ายรูปใหม่ในความละเอียดต่ำกว่าค่ะ',
                branchId,
                replyToken
            );
            return;
        }

        console.log('📤 Uploading slip image with SERVICE ROLE...');
        let slipImageUrl = '';
        let uploadRetryCount = 0;
        const maxUploadRetries = 3;
        
        while (uploadRetryCount < maxUploadRetries) {
            try {
                const file = new File([imageBlob], `slip-${Date.now()}.jpg`, { type: imageBlob.type });
                
                console.log(`Upload attempt ${uploadRetryCount + 1} - Using asServiceRole`);
                const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
                slipImageUrl = uploadResult.file_url;
                console.log('✅ Slip uploaded successfully:', slipImageUrl);
                break;
                
            } catch (uploadError) {
                console.error(`❌ Upload attempt ${uploadRetryCount + 1} failed:`, uploadError.message);
                console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
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
                
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        const formData = new FormData();
        formData.append('file', imageBlob, 'slip.jpg');
        formData.append('payload', JSON.stringify({ checkDuplicate: true }));

        console.log(`🔍 Verifying slip...`);
        
        let slip2goResponse;
        let slip2goData;
        let verificationMethod = '';
        let verificationSuccess = false;
        
        // ⭐ ขั้นตอนที่ 1: ลอง qr-image/info ก่อน (สำหรับสลิปที่มี QR Code)
        console.log('📱 Step 1: Trying qr-image/info...');
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
            console.log('qr-image/info Status:', slip2goResponse.status);
            console.log('qr-image/info Response:', responseText.substring(0, 500));
            
            slip2goData = JSON.parse(responseText);
            
            // ⭐ ตรวจสอบว่าสลิป valid หรือไม่ (รวมทั้ง code 200200 = Slip is valid)
            const isValidCode = slip2goData.code === '200200' || slip2goData.code === 200200;
            
            if ((slip2goResponse.ok && slip2goData.success && slip2goData.data) || (isValidCode && slip2goData.data)) {
                verificationMethod = 'qr-image';
                verificationSuccess = true;
                console.log('✅ Step 1 SUCCESS: qr-image/info method worked (code:', slip2goData.code, ')');
            } else {
                console.log('⚠️ Step 1 FAILED: qr-image/info -', slip2goData.message || slip2goData.code || 'Unknown error');
                
                // ⭐ ขั้นตอนที่ 2: ไม่มี fallback อื่น - qr-image/info เป็น endpoint หลักสำหรับรูปภาพ
                // qr-code/info ต้องการ QR code string ไม่ใช่รูปภาพ จึงไม่สามารถใช้เป็น fallback ได้
                console.log('⚠️ Step 2: No fallback available - qr-image/info is the only image-based endpoint');
            }
            
            if (slip2goResponse.status === 504 || responseText.includes('504')) {
                await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่ระบบตรวจสอบช้า`
                });
                
                await sendMessage(base44, lineUserId, 
                    `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ`,
                    branchId,
                    replyToken
                );
                return;
            }
            
        } catch (fetchError) {
            console.error('❌ Slip2Go API error:', fetchError.message);
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่ระบบขัดข้อง`
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
            await sendMessage(base44, lineUserId, 
                `⚠️ สลิปนี้เคยถูกใช้ไปแล้ว\n\nกรุณาตรวจสอบหรือส่งสลิปใหม่ค่ะ`,
                branchId,
                replyToken
            );
            return;
        }

        // ⭐⭐⭐ แยกประเภท error:
        // 1. ไม่พบ QR Code เลย = ไม่ใช่สลิป (ผ้าขนหนู, รูปทั่วไป) → ไม่ตอบ ไม่บันทึก
        // 2. พบ QR แต่ธนาคารยังไม่มีข้อมูล (กรุงไทย/กรุงเทพ) → บันทึกรอตรวจซ้ำ

        const isNoQRCode = errorCode === '200400' || 
                          errorMessage.toLowerCase().includes('qr code not found') ||
                          errorMessage.toLowerCase().includes('no qr') ||
                          errorMessage.toLowerCase().includes('cannot detect') ||
                          errorMessage.toLowerCase().includes('invalid image');

        // ⭐ ไม่พบ QR Code = ไม่ใช่สลิป → ไม่ตอบอะไรเลย
        if (isNoQRCode && !verificationSuccess) {
            console.log(`ℹ️ No QR code found - image is not a slip (code: ${errorCode}) - NOT responding, NOT saving`);
            return;
        }

        const isSlipValid = slip2goResponse.ok && slip2goData.data && verificationSuccess;
        
        if (!isSlipValid) {
            // ⭐ error อื่นๆ ที่ไม่ชัดเจน → ไม่ตอบ ไม่บันทึก (ป้องกันรูปขยะ)
            console.log(`ℹ️ Unknown error (code: ${errorCode}, msg: ${errorMessage}) - NOT responding, NOT saving`);
            return;
        }

        const slipData = slip2goData.data;
        const { amount: slipAmount } = extractAmount(slipData);
        
        const senderName = slipData.sender?.account?.name?.th || 
                          slipData.sender?.displayName || 'N/A';
        const transDate = slipData.dateTime || slipData.transDate || new Date().toISOString().split('T')[0];
        
        console.log(`✅ Slip verified using ${verificationMethod} method!`);
        console.log(`💰 Slip Amount: ${slipAmount} บาท`);

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

        // ⭐⭐⭐ คำนวณค่าปรับก่อนเช็คยอดเงิน (รองรับทั้งแบบปกติและแบบขั้นบันได)
        import { parseISO as parseISOLocal, differenceInDays } from 'npm:date-fns@3.0.0';
        
        const paymentDateObj = parseISOLocal(transDate.split('T')[0]);
        const dueDateObj = parseISOLocal(pendingPayment.due_date);
        const daysLate = differenceInDays(paymentDateObj, dueDateObj);
        
        let lateFeeAmount = 0;
        if (daysLate > 0) {
            const configs = await base44.asServiceRole.entities.Config.list();
            
            // เช็คว่าใช้ค่าปรับแบบขั้นบันไดหรือไม่
            const tiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && (c.branch_id === branchId || !c.branch_id));
            const tiersEnabled = tiersEnabledConfig?.value === 'true';
            
            let usedTiers = false;
            
            if (tiersEnabled) {
                const tiersConfig = configs.find(c => c.key === 'late_fee_tiers' && (c.branch_id === branchId || !c.branch_id));
                
                if (tiersConfig?.value) {
                    try {
                        const tiers = JSON.parse(tiersConfig.value);
                        console.log(`📊 Using tiered late fees - Days late: ${daysLate}`);
                        
                        for (const tier of tiers) {
                            const daysFrom = tier.days_from || 1;
                            const daysTo = tier.days_to || 999;
                            const feePerDay = parseFloat(tier.fee_per_day || 0);
                            
                            if (daysLate >= daysFrom) {
                                const daysInThisTier = Math.min(daysLate, daysTo) - daysFrom + 1;
                                if (daysInThisTier > 0) {
                                    const tierFee = daysInThisTier * feePerDay;
                                    lateFeeAmount += tierFee;
                                    console.log(`  ➡️ Tier ${daysFrom}-${daysTo}: ${daysInThisTier} วัน × ${feePerDay}฿ = ${tierFee}฿`);
                                }
                            }
                            
                            if (daysLate <= daysTo) break;
                        }
                        
                        usedTiers = true;
                        console.log(`⏰ Late payment (Tiers): ${daysLate} days → TOTAL ${lateFeeAmount} บาท`);
                    } catch (e) {
                        console.error('❌ Error parsing tiers, fallback to simple fee:', e);
                    }
                }
            }
            
            // ถ้าไม่ได้เปิดใช้ขั้นบันได หรือ parse ไม่สำเร็จ → ใช้ค่าปรับแบบปกติ
            if (!usedTiers) {
                const lateFeePerDayConfig = configs.find(c => c.key === 'late_fee_per_day' && (c.branch_id === branchId || !c.branch_id));
                const lateFeePerDay = parseFloat(lateFeePerDayConfig?.value || 0);
                lateFeeAmount = daysLate * lateFeePerDay;
                console.log(`⏰ Late payment (Simple): ${daysLate} days × ${lateFeePerDay} = ${lateFeeAmount} บาท`);
            }
        }
        
        // ⭐ คำนวณยอดที่ต้องชำระจริง (รวมค่าปรับ)
        const expectedAmount = parseFloat(pendingPayment.total_amount) + lateFeeAmount;
        console.log(`💰 Expected Amount (with late fee): ${expectedAmount} บาท`);

        // ตรวจสอบยอดเงิน (ยอมรับ ±5%)
        if (slipAmount < expectedAmount * 0.95) {
            const shortfall = expectedAmount - slipAmount;
            await sendMessage(base44, lineUserId, 
                `❌ ยอดเงินไม่ครบ\n\n💰 ยอดที่ต้องชำระ: ${expectedAmount.toLocaleString()} บาท\n💵 ยอดที่โอนมา: ${slipAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? `\n\n⏰ รวมค่าปรับล่าช้า ${daysLate} วัน: ${lateFeeAmount.toLocaleString()} บาท` : ''}\n\n⚠️ ต้องโอนเพิ่มอีก: ${shortfall.toLocaleString()} บาท\n\nกรุณาโอนส่วนที่ขาดและส่งสลิปใหม่ค่ะ`,
                branchId,
                replyToken
            );
            return;
        }

        await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
            status: 'paid',
            payment_date: transDate.split('T')[0],
            payment_slip_url: slipImageUrl,
            late_fee_amount: lateFeeAmount,
            total_amount: expectedAmount,
            notes: `${pendingPayment.notes || ''}\n\n✅ ตรวจสอบสลิปอัตโนมัติผ่าน LINE: ${senderName} โอน ${slipAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? ` (รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท จากชำระล่าช้า ${daysLate} วัน)` : ''}`
        });

        // ⭐⭐⭐ ส่งใบเสร็จโดยตรงเลย (ไม่ต้องส่งข้อความยืนยันแยก = ประหยัด Token)
        console.log('📄 Sending receipt directly (skip confirmation message to save token)...');
        
        try {
            const receiptResponse = await base44.asServiceRole.functions.invoke('sendReceipt', { 
                paymentId: pendingPayment.id 
            });
            
            if (receiptResponse.data?.success) {
                console.log('✅ Receipt sent successfully via LINE (1 message only)');
            } else {
                // ⚠️ ถ้าส่งใบเสร็จไม่สำเร็จ → fallback ส่งข้อความยืนยันแทน
                console.error('⚠️ Receipt sending failed, sending fallback message:', receiptResponse.data?.error);
                await sendMessage(base44, lineUserId, 
                    `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${slipAmount.toLocaleString()} บาท\n📅 วันที่: ${transDate.split('T')[0]}\n\n✓ อัปเดตสถานะ "ชำระแล้ว"\n\nขอบคุณที่ชำระเงินค่ะ 🙏`,
                    branchId,
                    replyToken
                );
            }
        } catch (receiptError) {
            // ⚠️ ถ้า error → fallback ส่งข้อความยืนยันแทน
            console.error('⚠️ Failed to send receipt, sending fallback message:', receiptError.message);
            await sendMessage(base44, lineUserId, 
                `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${slipAmount.toLocaleString()} บาท\n📅 วันที่: ${transDate.split('T')[0]}\n\n✓ อัปเดตสถานะ "ชำระแล้ว"\n\nขอบคุณที่ชำระเงินค่ะ 🙏`,
                branchId,
                replyToken
            );
        }

    } catch (error) {
        console.error('Error handling slip image:', error);
        // ⭐ ใช้ filter แทน list + find
        let errorTenant = null;
        try {
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
            errorTenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
        } catch (e) {
            console.log('⚠️ Could not find tenant for error handling:', e.message);
        }
        await sendMessage(base44, lineUserId, 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง', errorTenant?.branch_id || null, replyToken);
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

        // ⭐ ถ้า reply ไม่สำเร็จ (error 400 = Invalid reply token) ให้ลอง push แทน
        if (!response.ok && replyToken) {
            const errorText = await response.text();
            console.error(`❌ Reply failed: ${response.status} - ${errorText}`);

            if (response.status === 400 && errorText.includes('Invalid reply token')) {
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
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ LINE API error:', response.status, errorText);

            // ถ้าเป็น error เรื่อง rate limit ให้ลบ cache เพื่อให้ลองใหม่ได้
            if (errorText.includes('rate limit') || errorText.includes('429')) {
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
    const welcomeText = 
        '🏡 ยินดีต้อนรับสู่ระบบหอพัก W RESIDENTS\n\n' +
        '📱 วิธีลงทะเบียน:\n' +
        '• ส่งเบอร์โทรศัพท์ (10 หลัก)\n' +
        '  ตัวอย่าง: 0812345678\n\n' +
        '• หรือระบุสาขา (ถ้ามีหลายสาขา):\n' +
        '  ตัวอย่าง: 0812345678 BR001\n\n' +
        '🔧 แจ้งซ่อม: พิมพ์ "แจ้งซ่อม" แล้วตามด้วยรายละเอียดปัญหา\n' +
        '💰 ชำระเงิน: ส่งรูปสลิป';

    await sendMessage(base44, lineUserId, welcomeText, branchId, replyToken);
}

async function sendConfirmationMessage(base44, lineUserId, tenant, branch, replyToken = null) {
    let confirmText = `✅ เชื่อมโยงบัญชีสำเร็จ!\n\n`;
    confirmText += `👤 ชื่อ: ${tenant.full_name}\n`;
    confirmText += `📱 เบอร์: ${tenant.phone}\n`;
    if (branch) {
        confirmText += `🏢 สาขา: ${branch.branch_name}\n`;
    }
    confirmText += `\n📸 ส่งรูปสลิปเพื่อชำระค่าเช่าได้เลยค่ะ\n`;
    confirmText += `🔧 แจ้งซ่อม: พิมพ์ "แจ้งซ่อม" แล้วตามด้วยรายละเอียดปัญหา`;

    await sendMessage(base44, lineUserId, confirmText, tenant.branch_id, replyToken);
}

function sendNotFoundMessage(base44, lineUserId, phoneNumber, branchId = null, replyToken = null) {
    // ไม่ตอบกลับอะไรเลยถ้าไม่พบข้อมูลในระบบ
    console.log(`ℹ️ No data found for "${phoneNumber}" - not sending any response`);
    return;
}

// ปิดการลงทะเบียนด้วยชื่อ - ไม่ใช้งานแล้ว
function handleNameRegistration(base44, lineUserId, nameQuery, replyToken = null) {
    // ปิดการลงทะเบียนด้วยชื่อ - ไม่ตอบกลับอะไรเลย
    console.log(`ℹ️ Name registration is disabled - ignoring query: "${nameQuery}"`);
    return;
}