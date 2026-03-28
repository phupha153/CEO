import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Facebook Webhook Handler v3 - Force Redeploy
const processedMessages = new Set();
const messageSentCache = new Map();

// Cache สำหรับ Config
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_DURATION = 10 * 1000;

async function getFacebookConfig(base44, branchId = null) {
    try {
        const now = Date.now();
        if (!configCache || (now - configCacheTime) > CONFIG_CACHE_DURATION) {
            configCache = await base44.asServiceRole.entities.Config.list();
            configCacheTime = now;
            console.log('🔄 Config cache refreshed, found', configCache.length, 'configs');
        }
        
        if (!configCache) return null;
        
        const findConfig = (key) => {
            // ⭐ หา token ที่มีค่าจริงๆ ก่อน (ไม่ว่าจะสาขาไหน)
            const allConfigs = configCache.filter(c => c.key === key && c.value?.trim());
            console.log(`🔍 Found ${allConfigs.length} configs for key "${key}"`);
            
            if (branchId) {
                const branchVal = allConfigs.find(c => c.branch_id === branchId);
                if (branchVal?.value?.trim()) {
                    console.log(`✅ Using branch-specific token for branch ${branchId}`);
                    return branchVal.value.trim();
                }
            }
            
            // ⭐ ถ้าไม่มี branch-specific ให้ใช้อันแรกที่มีค่า
            const anyValidToken = allConfigs.find(c => c.value?.trim());
            if (anyValidToken) {
                console.log(`✅ Using token from branch ${anyValidToken.branch_id || 'global'}`);
                return anyValidToken.value.trim();
            }
            
            return null;
        };

        const token = findConfig('facebook_page_access_token');
        console.log('🔑 Token found:', token ? `${token.substring(0, 20)}...` : 'NONE');

        return {
            pageAccessToken: token,
            verifyToken: findConfig('facebook_verify_token')
        };
    } catch (error) {
        console.error('❌ Error fetching FB config:', error);
        return null;
    }
}

Deno.serve(async (req) => {
    const url = new URL(req.url);
    
    // 1. Verification Request (GET) - ต้องทำก่อน createClientFromRequest
    if (req.method === 'GET') {
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        console.log('📥 GET Request received:', { mode, token, challenge });

        if (mode === 'subscribe' && token && challenge) {
            const expectedVerifyToken = Deno.env.get('FACEBOOK_WEBHOOK_VERIFY_TOKEN');
            console.log('🔑 Expected token:', expectedVerifyToken);
            
            if (token === expectedVerifyToken) {
                console.log('✅ WEBHOOK_VERIFIED - Returning challenge:', challenge);
                return new Response(challenge, { 
                    status: 200,
                    headers: { 'Content-Type': 'text/plain' }
                });
            } else {
                console.error('❌ Token mismatch. Received:', token, 'Expected:', expectedVerifyToken);
                return new Response('Forbidden', { status: 403 });
            }
        }
        return new Response('OK', { status: 200 });
    }
    
    const base44 = createClientFromRequest(req);

    // 2. Event Notification (POST)
    if (req.method === 'POST') {
        console.log('📥 POST Request received - Facebook Webhook');
        
        let body;
        try {
            body = await req.json();
            console.log('📦 Webhook Body:', JSON.stringify(body, null, 2));
        } catch (e) {
            console.error('❌ Failed to parse JSON body:', e);
            return new Response('Bad Request', { status: 400 });
        }

        console.log('🔍 body.object:', body.object);

        if (body.object === 'page') {
            console.log('✅ body.object === "page" - Processing...');
            
            // ตอบกลับ 200 OK ทันที
            const response = new Response('EVENT_RECEIVED', { status: 200 });

            // Process events asynchronously
            (async () => {
                try {
                    console.log('🔄 Processing entries:', body.entry?.length || 0);
                    
                    for (const entry of body.entry || []) {
                        console.log('📋 Entry:', JSON.stringify(entry, null, 2));
                        
                        // Handle Messenger messages
                        if (entry.messaging) {
                            console.log('💬 Found messaging events:', entry.messaging.length);
                            
                            for (const webhookEvent of entry.messaging) {
                                const senderPsid = webhookEvent.sender.id;
                                const messageId = webhookEvent.message?.mid;

                                console.log(`📩 Messenger event - PSID: ${senderPsid}, MessageID: ${messageId}`);
                                console.log('📨 Event details:', JSON.stringify(webhookEvent, null, 2));

                                if (messageId && processedMessages.has(messageId)) {
                                    console.log('⏭️ Skipping duplicate message:', messageId);
                                    continue;
                                }
                                if (messageId) {
                                    processedMessages.add(messageId);
                                    if (processedMessages.size > 500) {
                                        const first = processedMessages.values().next().value;
                                        processedMessages.delete(first);
                                    }
                                }

                                console.log(`📩 Processing Messenger event from PSID: ${senderPsid}`);

                                const tenants = await base44.asServiceRole.entities.Tenant.list();
                                console.log(`👥 Found ${tenants.length} tenants`);
                                
                                const tenant = tenants.find(t => t.facebook_user_id === senderPsid);
                                console.log(`🔍 Matched tenant:`, tenant ? tenant.full_name : 'None');
                                
                                let branchId = tenant?.branch_id || null;
                                
                                // ⭐ ถ้ายังไม่มีสาขา (ลูกค้าใหม่) ให้วิ่งเข้าสาขาหลัก (ถ้าตั้งไว้)
                                try { if (!branchId && entry.id) { const pageConfigRes = await base44.asServiceRole.entities.Config.filter({ key: 'facebook_page_id', value: entry.id }, '', 1); const pageConfig = Array.isArray(pageConfigRes) ? pageConfigRes[0] : pageConfigRes; if (pageConfig && pageConfig.branch_id) { branchId = pageConfig.branch_id; const bRes = await base44.asServiceRole.entities.Branch.filter({ id: branchId }); const branch = Array.isArray(bRes) ? bRes[0] : bRes; if (branch) { const ownerEmail = branch.owner_id || branch.created_by; const defKey = ownerEmail ? 'default_communication_branch_' + ownerEmail : 'default_communication_branch'; const d = await base44.asServiceRole.entities.Config.filter({ key: defKey, branch_id: null }, '', 1); const v = Array.isArray(d) ? d[0]?.value : d?.value; if (v && v !== 'none') branchId = v; } } } } catch(e) { console.error(e); }

                                if (webhookEvent.message) {
                                                console.log('📝 Message content:', webhookEvent.message);

                                                // Skip echo messages (messages sent by the page itself)
                                                if (webhookEvent.message.is_echo) {
                                                    console.log('⏭️ Skipping echo message');
                                                    continue;
                                                }

                                                // ⭐ ดึงข้อมูลโปรไฟล์ Facebook
                                                let userProfile = null;
                                                try {
                                                    const config = await getFacebookConfig(base44, branchId);
                                                    if (config?.pageAccessToken) {
                                                        const profileRes = await fetch(`https://graph.facebook.com/v18.0/${senderPsid}?fields=first_name,last_name,profile_pic&access_token=${config.pageAccessToken}`);
                                                        if (profileRes.ok) {
                                                            userProfile = await profileRes.json();
                                                            console.log('👤 User profile:', userProfile);
                                                        }
                                                    }
                                                } catch (profileErr) {
                                                    console.warn('⚠️ Failed to get user profile:', profileErr.message);
                                                }

                                                if (webhookEvent.message.text) {
                                                    console.log(`💬 Text message: "${webhookEvent.message.text}"`);
                                                    await handleMessage(base44, senderPsid, webhookEvent.message.text, branchId, tenant, userProfile);
                                                } else if (webhookEvent.message.attachments) {
                                                    console.log('📎 Attachments:', webhookEvent.message.attachments.length);
                                                    await handleAttachments(base44, senderPsid, webhookEvent.message.attachments, branchId, tenant, userProfile);
                                                }
                                            } else if (webhookEvent.delivery || webhookEvent.read) {
                                                // Skip delivery/read receipts silently
                                                console.log('📬 Delivery/Read receipt - skipping');
                                            } else if (webhookEvent.postback) {
                                                console.log('🔘 Postback event:', webhookEvent.postback);
                                                // Handle postback if needed
                                            } else {
                                                console.log('⚠️ Unknown event type:', Object.keys(webhookEvent));
                                            }
                            }
                        } else {
                            console.log('ℹ️ No messaging in entry');
                        }
                        
                        // Handle Page Feed (Posts, Comments)
                        if (entry.changes) {
                            console.log('📰 Found changes (feed):', entry.changes.length);
                            
                            for (const change of entry.changes) {
                                if (change.field === 'feed') {
                                    const value = change.value;
                                    
                                    // Handle new comments
                                    if (value.item === 'comment' && value.verb === 'add') {
                                        await handlePageComment(base44, value);
                                    }
                                }
                            }
                        }
                    }
                    
                    console.log('✅ Finished processing all entries');
                } catch (error) {
                    console.error('❌ Error in async processing:', error);
                }
            })();

            return response;
        } else {
            console.log('⚠️ body.object is not "page":', body.object);
            return new Response('Not Found', { status: 404 });
        }
    }

    return new Response('Method Not Allowed', { status: 405 });
});

async function handleMessage(base44, senderPsid, receivedMessage, branchId, tenant, userProfile = null) {
    const text = receivedMessage.trim();
    console.log(`📝 Text: "${text}"`);
    
    // ⭐ สร้างชื่อจากโปรไฟล์
    const displayName = userProfile ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() : (tenant?.full_name || null);
    const pictureUrl = userProfile?.profile_pic || null;
    
    // ⭐⭐⭐ บันทึกข้อความลง FacebookMessage entity
    try {
        await base44.asServiceRole.entities.FacebookMessage.create({
            branch_id: branchId,
            tenant_id: tenant?.id || null,
            facebook_user_id: senderPsid,
            facebook_display_name: displayName,
            facebook_picture_url: pictureUrl,
            direction: 'incoming',
            message_type: 'text',
            content: text,
            is_read: false
        });
        console.log('✅ Saved incoming Facebook message to FacebookMessage entity');
    } catch (saveError) {
        console.error('❌ Failed to save Facebook message:', saveError);
    }

    // 1. ลงทะเบียนด้วยเบอร์โทรหรือชื่อ (กรณีข้ามสาขา)
    const phonePattern = /^(0\d{9})$/;
    const phoneWithBranchPattern = /^(0\d{9})\s+([A-Z0-9\-]+)$/i;

    if (!tenant) {
        // ยังไม่ลงทะเบียน
        if (phoneWithBranchPattern.test(text)) {
            const match = text.match(phoneWithBranchPattern);
            await handleRegistration(base44, senderPsid, match[1], match[2].toUpperCase());
            return;
        } else if (phonePattern.test(text)) {
            await handleRegistration(base44, senderPsid, text, null);
            return;
        } else if (text.length >= 3) {
            // ลองค้นหาด้วยชื่อ
            await handleNameRegistration(base44, senderPsid, text);
            return;
        }
    }

    // 2. ถ้าพิมพ์ "ลงทะเบียน" → แสดงขั้นตอนการลงทะเบียน
    if (text.toLowerCase().includes('ลงทะเบียน') || text.toLowerCase().includes('สมัคร')) {
        await sendFacebookMessage(base44, senderPsid, 
            '📋 ขั้นตอนการลงทะเบียน\n\n' +
            'กรุณาส่งข้อมูลอย่างใดอย่างหนึ่ง:\n\n' +
            '1️⃣ เบอร์โทรศัพท์ (10 หลัก)\n' +
            '   ตัวอย่าง: 0812345678\n\n' +
            '2️⃣ ชื่อ-นามสกุล\n' +
            '   ตัวอย่าง: สมชาย ใจดี\n\n' +
            '💡 ระบบจะค้นหาข้อมูลของคุณในระบบ\n' +
            'และแจ้งยืนยันห้องพักก่อนลงทะเบียนค่ะ',
            branchId
        );
        return;
    }

    // 3. คำสั่งแจ้งซ่อม (ต้องพิมพ์ "แจ้งซ่อม" + รายละเอียด)
    if (text.toLowerCase().includes('แจ้งซ่อม')) {
        if (!tenant) {
            await sendFacebookMessage(base44, senderPsid, '❌ กรุณาลงทะเบียนก่อนใช้งานค่ะ (พิมพ์เบอร์โทรศัพท์ หรือ ชื่อ-นามสกุล)', branchId);
            return;
        }
        
        // ⭐ ถ้าพิมพ์ "แจ้งซ่อม" ตามด้วยรายละเอียด → บันทึกเลย
        const maintenanceKeywords = ['แจ้งซ่อม', 'แจ้ง ซ่อม'];
        let problemDescription = text;
        
        for (const keyword of maintenanceKeywords) {
            if (text.toLowerCase().includes(keyword)) {
                problemDescription = text.replace(new RegExp(keyword, 'gi'), '').trim();
                break;
            }
        }
        
        // ถ้ามีรายละเอียดปัญหา (มากกว่า 2 ตัวอักษร) → บันทึกเลย
        if (problemDescription.length > 2) {
            await handleMaintenanceReport(base44, senderPsid, problemDescription, tenant);
        } else {
            // ถ้าพิมพ์แค่ "แจ้งซ่อม" → ขอรายละเอียดเพิ่ม
            await sendFacebookMessage(base44, senderPsid, 
                '🔧 ระบบแจ้งซ่อม\n\n' +
                'กรุณาพิมพ์ "แจ้งซ่อม" ตามด้วยรายละเอียดปัญหาค่ะ\n\n' +
                'ตัวอย่าง:\n' +
                '• แจ้งซ่อม ไฟห้องดับ\n' +
                '• แจ้งซ่อม แอร์ไม่เย็น\n' +
                '• แจ้งซ่อม ประปารั่ว',
                branchId
            );
        }
        return;
    }

    // 3. ถ้าลงทะเบียนแล้ว และพิมพ์ข้อความทั่วไป → ไม่ตอบอะไรเลย (เหมือน LINE)
    if (tenant) {
        console.log('ℹ️ Registered user sent general message - NOT responding (silent)');
        return;
    }

    // ⭐ ไม่ตอบอะไรถ้าข้อความไม่เข้าใจ (ไม่ใช่คำสั่งที่รู้จัก) - เหมือน LINE
    console.log('ℹ️ Unknown message, not responding');
}

async function handleRegistration(base44, senderPsid, phoneNumber, branchCode) {
    try {
        const tenants = await base44.asServiceRole.entities.Tenant.list();
        
        let match = null;
        if (branchCode) {
            const branches = await base44.asServiceRole.entities.Branch.list();
            const branch = branches.find(b => b.branch_code?.toUpperCase() === branchCode);
            if (!branch) {
                await sendFacebookMessage(base44, senderPsid, `❌ ไม่พบรหัสสาขา "${branchCode}"`, null);
                return;
            }
            match = tenants.find(t => t.phone === phoneNumber && t.branch_id === branch.id);
        } else {
            const matches = tenants.filter(t => t.phone === phoneNumber);
            if (matches.length > 1) {
                await sendFacebookMessage(base44, senderPsid, '⚠️ พบเบอร์นี้ในหลายสาขา กรุณาระบุรหัสสาขาต่อท้ายเบอร์ (เช่น 0812345678 BR01)', null);
                return;
            }
            match = matches[0];
        }

        if (match) {
            await base44.asServiceRole.entities.Tenant.update(match.id, { facebook_user_id: senderPsid });
            await sendFacebookMessage(base44, senderPsid, `✅ ลงทะเบียนสำเร็จ!\nยินดีต้อนรับคุณ ${match.full_name}`, match.branch_id);
        } else {
            await sendFacebookMessage(base44, senderPsid, `❌ ไม่พบข้อมูลเบอร์ ${phoneNumber} ในระบบ`, null);
        }
    } catch (e) {
        console.error(e);
        await sendFacebookMessage(base44, senderPsid, '❌ เกิดข้อผิดพลาด', null);
    }
}

async function handleNameRegistration(base44, senderPsid, nameQuery) {
    try {
        const tenants = await base44.asServiceRole.entities.Tenant.list();
        const branches = await base44.asServiceRole.entities.Branch.list();
        const bookings = await base44.asServiceRole.entities.Booking.list();
        const rooms = await base44.asServiceRole.entities.Room.list();
        
        const normalizedQuery = nameQuery.toLowerCase().replace(/\s+/g, '');
        
        // 1. ค้นหา exact match
        const exactMatches = tenants.filter(t => {
            if (!t.full_name) return false;
            return t.full_name.toLowerCase().replace(/\s+/g, '') === normalizedQuery;
        });
        
        // 2. ค้นหา partial match
        const partialMatches = tenants.filter(t => {
            if (!t.full_name) return false;
            const normalizedName = t.full_name.toLowerCase().replace(/\s+/g, '');
            return normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName);
        });
        
        // 3. ค้นหา fuzzy match
        let fuzzyMatches = [];
        if (exactMatches.length === 0 && partialMatches.length === 0) {
            fuzzyMatches = tenants.filter(t => {
                if (!t.full_name) return false;
                const normalizedName = t.full_name.toLowerCase().replace(/\s+/g, '');
                const queryChars = normalizedQuery.split('');
                const nameChars = normalizedName.split('');
                let matchCount = 0;
                
                for (const char of queryChars) {
                    if (nameChars.includes(char)) {
                        matchCount++;
                        const idx = nameChars.indexOf(char);
                        if (idx > -1) nameChars.splice(idx, 1);
                    }
                }
                
                const similarity = matchCount / Math.max(normalizedQuery.length, normalizedName.length);
                return similarity >= 0.5;
            });
        }
        
        let matches = exactMatches.length > 0 ? exactMatches : 
                      partialMatches.length > 0 ? partialMatches : 
                      fuzzyMatches;

        // ⭐ ไม่พบเลย → หาที่ใกล้เคียงที่สุด
        if (matches.length === 0) {
            const suggestedTenants = tenants
                .filter(t => t.full_name && t.status === 'active')
                .map(t => {
                    const normalizedName = t.full_name.toLowerCase().replace(/\s+/g, '');
                    const queryChars = normalizedQuery.split('');
                    const nameChars = normalizedName.split('');
                    let matchCount = 0;
                    
                    for (const char of queryChars) {
                        if (nameChars.includes(char)) {
                            matchCount++;
                            const idx = nameChars.indexOf(char);
                            if (idx > -1) nameChars.splice(idx, 1);
                        }
                    }
                    
                    return { tenant: t, similarity: matchCount / Math.max(normalizedQuery.length, normalizedName.length) };
                })
                .filter(item => item.similarity > 0.3)
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, 3);
            
            if (suggestedTenants.length > 0) {
                let message = `❓ ไม่พบชื่อ "${nameQuery}"\n\n🔍 ข้อมูลที่ใกล้เคียง:\n`;
                
                for (const { tenant } of suggestedTenants) {
                    const activeBooking = bookings.find(b => b.tenant_id === tenant.id && b.status === 'active');
                    const room = activeBooking ? rooms.find(r => r.id === activeBooking.room_id) : null;
                    const branch = branches.find(b => b.id === tenant.branch_id);
                    
                    message += `\n👤 ${tenant.full_name}`;
                    if (room) message += ` (ห้อง ${room.room_number})`;
                    if (branch) message += ` - ${branch.branch_name}`;
                }
                
                message += `\n\n💡 หากตรงกับท่าน กรุณาพิมพ์ชื่อให้ถูกต้องหรือระบุเบอร์โทรค่ะ`;
                
                await sendFacebookMessage(base44, senderPsid, message, null);
            } else {
                await sendFacebookMessage(base44, senderPsid, `❌ ไม่พบชื่อ "${nameQuery}" ในระบบ`, null);
            }
            return;
        }
        
        // ⭐ เจอ 1 คน → ถามยืนยันถ้าไม่ใช่ exact match
        if (matches.length === 1) {
            const tenant = matches[0];
            const activeBooking = bookings.find(b => b.tenant_id === tenant.id && b.status === 'active');
            const room = activeBooking ? rooms.find(r => r.id === activeBooking.room_id) : null;
            const branch = branches.find(b => b.id === tenant.branch_id);
            
            const isExactMatch = tenant.full_name.toLowerCase().replace(/\s+/g, '') === normalizedQuery;
            
            if (!isExactMatch) {
                let confirmMessage = `🔍 พบข้อมูลที่ใกล้เคียง:\n\n`;
                confirmMessage += `👤 ชื่อ: ${tenant.full_name}\n`;
                if (room) confirmMessage += `🏠 ห้อง: ${room.room_number}\n`;
                if (branch) confirmMessage += `🏢 สาขา: ${branch.branch_name}\n`;
                if (tenant.phone) confirmMessage += `📱 เบอร์: ${tenant.phone}\n`;
                confirmMessage += `\n❓ ใช่ห้องนี้หรือไม่คะ?\n`;
                confirmMessage += `✅ ตอบ "ใช่" หรือพิมพ์ชื่อเต็มเพื่อยืนยัน`;
                
                await sendFacebookMessage(base44, senderPsid, confirmMessage, tenant.branch_id);
                return;
            }
            
            await base44.asServiceRole.entities.Tenant.update(tenant.id, { facebook_user_id: senderPsid });
            await sendFacebookMessage(base44, senderPsid, `✅ ลงทะเบียนสำเร็จ!\nยินดีต้อนรับคุณ ${tenant.full_name}`, tenant.branch_id);
            return;
        }
        
        // ⭐ เจอหลายคน → แสดงรายชื่อ
        let message = `📋 พบข้อมูล ${matches.length} รายการ:\n`;
        
        for (const tenant of matches.slice(0, 5)) {
            const activeBooking = bookings.find(b => b.tenant_id === tenant.id && b.status === 'active');
            const room = activeBooking ? rooms.find(r => r.id === activeBooking.room_id) : null;
            const branch = branches.find(b => b.id === tenant.branch_id);
            
            message += `\n👤 ${tenant.full_name}`;
            if (room) message += ` (ห้อง ${room.room_number})`;
            if (branch) message += ` - ${branch.branch_name}`;
        }
        
        message += `\n\n💡 กรุณาระบุเบอร์โทรศัพท์เพื่อยืนยันค่ะ`;
        
        await sendFacebookMessage(base44, senderPsid, message, null);
        
    } catch (e) {
        console.error(e);
        await sendFacebookMessage(base44, senderPsid, '❌ เกิดข้อผิดพลาด', null);
    }
}

async function handleAttachments(base44, senderPsid, attachments, branchId, tenant, userProfile = null) {
    const imageAttachment = attachments.find(a => a.type === 'image');
    
    if (!imageAttachment) return;
    
    if (!tenant) {
        await sendFacebookMessage(base44, senderPsid, '❌ กรุณาลงทะเบียนก่อนส่งรูปภาพ', branchId);
        return;
    }

    // ⭐ ดาวน์โหลดและอัปโหลดรูปก่อน (เพื่อให้ได้ media_url)
    const imageUrl = imageAttachment.payload.url;
    console.log(`📸 Facebook Image URL: ${imageUrl}`);
    
    let uploadedImageUrl = null;
    try {
        // Download image from Facebook
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) {
            console.error('❌ Failed to download Facebook image');
            return;
        }
        const imageBlob = await imageRes.blob();
        
        // Upload to Base44
        const file = new File([imageBlob], `fb-slip-${Date.now()}.jpg`, { type: imageBlob.type });
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        uploadedImageUrl = uploadRes.file_url;
        console.log(`✅ Uploaded Facebook image: ${uploadedImageUrl}`);
    } catch (uploadError) {
        console.error('❌ Failed to upload Facebook image:', uploadError);
    }
    
    // ⭐ บันทึกข้อความรูปภาพลง FacebookMessage entity (หลังได้ media_url แล้ว)
    const displayName = userProfile ? `${userProfile.first_name || ''} ${userProfile.last_name || ''}`.trim() : (tenant?.full_name || null);
    const pictureUrl = userProfile?.profile_pic || null;
    
    try {
        await base44.asServiceRole.entities.FacebookMessage.create({
            branch_id: branchId,
            tenant_id: tenant?.id || null,
            facebook_user_id: senderPsid,
            facebook_display_name: displayName,
            facebook_picture_url: pictureUrl,
            direction: 'incoming',
            message_type: 'image',
            content: '[รูปภาพ]',
            media_url: uploadedImageUrl,
            is_read: false
        });
        console.log(`✅ Saved incoming Facebook image to FacebookMessage entity with media_url: ${uploadedImageUrl ? 'YES' : 'NO'}`);
    } catch (saveError) {
        console.error('❌ Failed to save Facebook image message:', saveError);
    }

    // ⭐ ประมวลผลสลิปต่อ
    if (uploadedImageUrl) {
        const slipUrl = uploadedImageUrl;

        // Check Pending Payment
        const allPayments = await base44.asServiceRole.entities.Payment.list('-created_date', 20);
        const pendingPayment = allPayments.find(p => 
            p.tenant_id === tenant.id && (p.status === 'pending' || p.status === 'overdue')
        );

        if (pendingPayment) {
            // Verify with Slip2Go (Optional, assume same API Key)
            const slip2goApiKey = Deno.env.get('SLIP2GO_API_KEY');
            if (slip2goApiKey) {
                // ... Slip verification logic similar to LINE ...
                // For brevity in this implementation, we'll just attach the slip and wait for manual check if logic is complex to duplicate
                // But user asked "exactly like LINE", so we should try verify.
                
                const formData = new FormData();
                formData.append('file', imageBlob, 'slip.jpg');
                
                try {
                    const verifyRes = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image/info', {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${slip2goApiKey.trim()}` },
                        body: formData
                    });
                    
                    const verifyData = await verifyRes.json();
                    const isValidCode = verifyData.code === '200200' || verifyData.code === 200200;
                    
                    if ((verifyRes.ok && verifyData.success && verifyData.data) || (isValidCode && verifyData.data)) {
                        const slipData = verifyData.data;
                        const amount = slipData.amount || slipData.transAmount || 0;
                        const senderName = slipData.sender?.account?.name?.th || slipData.sender?.displayName || 'N/A';
                        const transDate = slipData.transDate || new Date().toISOString().split('T')[0];
                        const receiverName = slipData.receiver?.account?.name || '';
                        
                        console.log(`✅ Slip verified! Amount: ${amount} บาท`);
                        
                        // เช็คยอดเงิน
                        const amountDiff = Math.abs(amount - pendingPayment.total_amount);
                        const diffPercent = (amountDiff / pendingPayment.total_amount) * 100;

                        if (amount === 0) {
                            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                                payment_slip_url: slipUrl,
                                notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ระบบอ่านยอดไม่ได้`
                            });
                            await sendFacebookMessage(base44, senderPsid, '📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ', branchId);
                            return;
                        }

                        // ⭐ เช็คชื่อบัญชีก่อนเช็คยอด (ป้องกันรับสลิปที่โอนผิดบัญชี)
                        const configs = await base44.asServiceRole.entities.Config.list();
                        const getConfigValue = (key) => {
                            const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                            if (branchConfig) return branchConfig.value;
                            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
                            return globalConfig?.value || null;
                        };

                        const expectedAccountName = getConfigValue('bank_account_name');
                        let nameMatch = false;

                        if (expectedAccountName && receiverName) {
                            const cleanExpected = expectedAccountName
                                .replace(/นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|miss\.?|ms\.?|dr\.?/gi, '')
                                .replace(/\s+/g, '')
                                .replace(/\./g, '')
                                .toLowerCase();

                            const cleanReceiver = receiverName
                                .replace(/นาย|นาง|นางสาว|ด\.ช\.|ด\.ญ\.|mr\.?|mrs\.?|miss\.?|ms\.?|dr\.?/gi, '')
                                .replace(/\s+/g, '')
                                .replace(/\./g, '')
                                .toLowerCase();

                            nameMatch = cleanReceiver.includes(cleanExpected) || cleanExpected.includes(cleanReceiver);
                        } else {
                            nameMatch = true;
                        }

                        if (!nameMatch) {
                            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                                payment_slip_url: slipUrl,
                                notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ชื่อบัญชีไม่ตรง (${receiverName})`
                            });
                            await sendFacebookMessage(base44, senderPsid, '❌ ชื่อบัญชีไม่ตรง!\n\nกรุณาตรวจสอบหรือติดต่อเจ้าของหอพักค่ะ', branchId);
                            return;
                        }
                        
                        // เช็คยอดเงิน (หลังเช็คชื่อบัญชีแล้ว)
                        if (diffPercent > 10) {
                            await sendFacebookMessage(base44, senderPsid, 
                                `❌ ยอดเงินไม่ตรง\n\n💰 ยอดที่ต้องชำระ: ${pendingPayment.total_amount.toLocaleString()} บาท\n💵 ยอดที่โอนมา: ${amount.toLocaleString()} บาท\n\nกรุณาตรวจสอบและโอนใหม่ค่ะ`,
                                branchId
                            );
                            return;
                        }
                        
                        await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                            status: 'paid',
                            payment_date: transDate.split('T')[0],
                            payment_slip_url: slipUrl,
                            notes: `${pendingPayment.notes || ''}\n\nตรวจสอบสลิปอัตโนมัติผ่าน Facebook: ${senderName} โอน ${amount} บาท`
                        });
                        
                        // ⭐⭐⭐ ส่งใบเสร็จโดยตรงเลย (เหมือน LINE)
                        console.log('📄 Sending receipt directly via Facebook...');
                        try {
                            const receiptResponse = await base44.asServiceRole.functions.invoke('sendFacebookReceipt', { 
                                paymentId: pendingPayment.id 
                            });
                            
                            if (receiptResponse.data?.success) {
                                console.log('✅ Receipt sent successfully via Facebook');
                            } else {
                                // Fallback message
                                console.error('⚠️ Receipt sending failed, sending fallback message:', receiptResponse.data?.error);
                                await sendFacebookMessage(base44, senderPsid, 
                                    `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${amount.toLocaleString()} บาท\n📅 วันที่: ${transDate.split('T')[0]}\n\n✓ อัปเดตสถานะ "ชำระแล้ว"\n\nขอบคุณที่ชำระเงินค่ะ 🙏`,
                                    branchId
                                );
                            }
                        } catch (receiptError) {
                            console.error('⚠️ Failed to send receipt, sending fallback message:', receiptError.message);
                            await sendFacebookMessage(base44, senderPsid, 
                                `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${amount.toLocaleString()} บาท\n📅 วันที่: ${transDate.split('T')[0]}\n\n✓ อัปเดตสถานะ "ชำระแล้ว"\n\nขอบคุณที่ชำระเงินค่ะ 🙏`,
                                branchId
                            );
                        }
                        
                        return;
                    }
                } catch (e) {
                    console.error('Slip verify error', e);
                }
            }

            // Fallback or no API key
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipUrl,
                notes: (pendingPayment.notes || '') + '\n\n(รอตรวจสอบสลิปจาก Facebook)'
            });
            await sendFacebookMessage(base44, senderPsid, '📸 ได้รับรูปสลิปแล้ว เจ้าหน้าที่จะตรวจสอบและยืนยันอีกครั้งค่ะ', branchId);
        } else {
            // ⭐ ไม่มี pending payment = ไม่ตอบอะไรเลย (เหมือน LINE)
            console.log(`ℹ️ User ${senderPsid} has no pending payment - ignoring image, NOT responding`);
        }
    }
}

async function handleMaintenanceReport(base44, senderPsid, text, tenant) {
    // Call LLM to analyze
    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `วิเคราะห์ปัญหาการแจ้งซ่อม: "${text}"\nระบุ category (electric, plumbing, furniture, air_conditioner, other), priority (low, medium, high, urgent), title, description`,
        response_json_schema: {
            type: "object",
            properties: {
                category: { type: "string", enum: ["electric", "plumbing", "furniture", "air_conditioner", "other"] },
                priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                title: { type: "string" },
                description: { type: "string" }
            },
            required: ["category", "priority", "title", "description"]
        }
    });

    // Find active room
    const bookings = await base44.asServiceRole.entities.Booking.list();
    const activeBooking = bookings.find(b => b.tenant_id === tenant.id && b.status === 'active');

    if (activeBooking) {
        await base44.asServiceRole.entities.MaintenanceRequest.create({
            branch_id: tenant.branch_id,
            room_id: activeBooking.room_id,
            tenant_id: tenant.id,
            title: analysis.title,
            description: analysis.description,
            category: analysis.category,
            priority: analysis.priority,
            status: 'pending',
            notes: `แจ้งผ่าน Facebook: ${text}`
        });
        await sendFacebookMessage(base44, senderPsid, `✅ รับเรื่องแจ้งซ่อมแล้ว\nหัวข้อ: ${analysis.title}`, tenant.branch_id);
    } else {
        await sendFacebookMessage(base44, senderPsid, '❌ ไม่พบข้อมูลการเช่าห้องของคุณ', tenant.branch_id);
    }
}

async function handlePageComment(base44, commentData) {
    try {
        const commentId = commentData.comment_id;
        const postId = commentData.post_id;
        const senderId = commentData.from?.id;
        const message = commentData.message;
        
        console.log(`💬 New comment on post ${postId}: "${message}"`);
        
        // ใช้ AI สร้างข้อความตอบกลับ
        const replyText = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `คุณคือผู้ช่วยของหอพัก/อพาร์ทเมนท์ ตอบคอมเมนต์นี้อย่างสุภาพและเป็นมิตร:\n\n"${message}"\n\nตอบสั้นๆ ไม่เกิน 2-3 ประโยค เป็นภาษาไทยที่สุภาพ`,
            add_context_from_internet: false
        });
        
        // หา branch_id จาก post หรือ config
        const branches = await base44.asServiceRole.entities.Branch.list();
        const defaultBranch = branches[0];
        const branchId = defaultBranch?.id || null;
        
        // Reply to comment
        const config = await getFacebookConfig(base44, branchId);
        if (!config?.pageAccessToken) {
            console.error('❌ No Page Access Token for replying to comment');
            return;
        }
        
        await fetch(`https://graph.facebook.com/v18.0/${commentId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: replyText,
                access_token: config.pageAccessToken
            })
        });
        
        console.log(`✅ Replied to comment: ${replyText}`);
    } catch (error) {
        console.error('❌ Error handling page comment:', error);
    }
}

async function sendFacebookMessage(base44, recipientId, text, branchId) {
    console.log(`📤 Sending FB message to ${recipientId}: "${text.substring(0, 50)}..."`);
    
    // ⭐⭐⭐ บันทึกข้อความขาออกลง FacebookMessage entity
    try {
        await base44.asServiceRole.entities.FacebookMessage.create({
            branch_id: branchId,
            tenant_id: null,
            facebook_user_id: recipientId,
            facebook_display_name: null,
            facebook_picture_url: null,
            direction: 'outgoing',
            message_type: 'text',
            content: text,
            is_read: true,
            sent_by: 'system'
        });
        console.log('✅ Saved outgoing Facebook message to FacebookMessage entity');
    } catch (saveError) {
        console.error('❌ Failed to save outgoing Facebook message:', saveError);
    }
    
    // ⭐ ลองหา token จากทุกแหล่ง
    let config = await getFacebookConfig(base44, branchId);
    
    // ⭐ ถ้าไม่มี token ลองหาจาก branchId = null (ทุกสาขา)
    if (!config?.pageAccessToken) {
        console.log('⚠️ No token for branchId, trying all branches...');
        config = await getFacebookConfig(base44, null);
    }
    
    console.log('🔑 FB Config:', { 
        hasToken: !!config?.pageAccessToken, 
        tokenPreview: config?.pageAccessToken ? config.pageAccessToken.substring(0, 30) + '...' : 'NONE',
        branchId 
    });
    
    if (!config?.pageAccessToken) {
        console.error('❌ No Facebook Page Access Token found in any Config!');
        return;
    }

    try {
        const requestBody = {
            recipient: { id: recipientId },
            message: { text: text },
            messaging_type: 'RESPONSE'
        };
        
        console.log('📨 Request body:', JSON.stringify(requestBody));
        
        const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${config.pageAccessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        const result = await response.json();
        console.log('📬 FB API Response:', JSON.stringify(result));
        
        if (result.error) {
            console.error('❌ FB API Error:', result.error.message, result.error.code);
            
            // ⭐ ถ้า token หมดอายุ ให้ log ชัดเจน
            if (result.error.code === 190) {
                console.error('🔴 TOKEN EXPIRED! Need to refresh Facebook Page Access Token');
            }
        } else {
            console.log('✅ Message sent successfully to:', recipientId);
        }
    } catch (e) {
        console.error('❌ Error sending FB message:', e.message);
    }
}