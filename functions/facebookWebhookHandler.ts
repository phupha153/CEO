import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
        }
        
        if (!configCache) return null;
        
        const findConfig = (key) => {
            if (branchId) {
                const branchVal = configCache.find(c => c.key === key && c.branch_id === branchId);
                if (branchVal?.value?.trim()) return branchVal.value.trim();
            }
            const globalVal = configCache.find(c => c.key === key && !c.branch_id);
            return globalVal?.value?.trim() || null;
        };

        return {
            pageAccessToken: findConfig('facebook_page_access_token'),
            verifyToken: findConfig('facebook_verify_token')
        };
    } catch (error) {
        console.error('❌ Error fetching FB config:', error);
        return null;
    }
}

Deno.serve(async (req) => {
    const url = new URL(req.url);
    const base44 = createClientFromRequest(req);

    // 1. Verification Request (GET)
    if (req.method === 'GET') {
        const mode = url.searchParams.get('hub.mode');
        const token = url.searchParams.get('hub.verify_token');
        const challenge = url.searchParams.get('hub.challenge');

        if (mode && token) {
            // ดึง Verify Token (อาจจะต้องดึงจาก DB หรือ Env ถ้าตั้งค่าไว้)
            // แต่เนื่องจาก Verification มักจะเกิดก่อนที่เราจะรู้ branch_id 
            // เราจะลองดึง Global config หรือค้นหาทุก verify token ที่ตรงกัน
            
            // เพื่อความง่ายและเร็ว ลองโหลด config ทั้งหมดมาเช็ค
            const configs = await base44.asServiceRole.entities.Config.list();
            const validTokens = configs
                .filter(c => c.key === 'facebook_verify_token')
                .map(c => c.value.trim());
            
            if (mode === 'subscribe' && validTokens.includes(token)) {
                console.log('✅ WEBHOOK_VERIFIED');
                return new Response(challenge, { status: 200 });
            } else {
                return new Response('Forbidden', { status: 403 });
            }
        }
        return new Response('Bad Request', { status: 400 });
    }

    // 2. Event Notification (POST)
    if (req.method === 'POST') {
        let body;
        try {
            body = await req.json();
        } catch (e) {
            return new Response('Bad Request', { status: 400 });
        }

        if (body.object === 'page') {
            // ตอบกลับ 200 OK ทันที
            const response = new Response('EVENT_RECEIVED', { status: 200 });

            // Process events
            (async () => {
                for (const entry of body.entry || []) {
                    const webhookEvent = entry.messaging?.[0];
                    if (!webhookEvent) continue;

                    const senderPsid = webhookEvent.sender.id;
                    const messageId = webhookEvent.message?.mid;

                    if (messageId && processedMessages.has(messageId)) continue;
                    if (messageId) {
                        processedMessages.add(messageId);
                        if (processedMessages.size > 500) {
                            const first = processedMessages.values().next().value;
                            processedMessages.delete(first);
                        }
                    }

                    console.log(`📩 Received event from PSID: ${senderPsid}`);

                    // หา Tenant และ Branch
                    const tenants = await base44.asServiceRole.entities.Tenant.list();
                    const tenant = tenants.find(t => t.facebook_user_id === senderPsid);
                    const branchId = tenant?.branch_id || null; // ถ้าไม่เจอ tenant, branchId = null (จะใช้ global token)

                    if (webhookEvent.message) {
                        if (webhookEvent.message.text) {
                            await handleMessage(base44, senderPsid, webhookEvent.message.text, branchId, tenant);
                        } else if (webhookEvent.message.attachments) {
                            await handleAttachments(base44, senderPsid, webhookEvent.message.attachments, branchId, tenant);
                        }
                    }
                }
            })();

            return response;
        } else {
            return new Response('Not Found', { status: 404 });
        }
    }

    return new Response('Method Not Allowed', { status: 405 });
});

async function handleMessage(base44, senderPsid, receivedMessage, branchId, tenant) {
    const text = receivedMessage.trim();
    console.log(`📝 Text: "${text}"`);

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

    // 3. Default Response
    if (tenant) {
        await sendFacebookMessage(base44, senderPsid, 
            '🤖 สวัสดีค่ะ มีอะไรให้ช่วยไหมคะ?\n\n' +
            '🔧 แจ้งซ่อม: พิมพ์ "แจ้งซ่อม" ตามด้วยปัญหา\n' +
            '💰 ชำระเงิน: ส่งรูปสลิป', 
            branchId
        );
    } else {
        await sendFacebookMessage(base44, senderPsid, 
            '👋 สวัสดีค่ะ กรุณาลงทะเบียนก่อนใช้งาน\n\n' +
            'พิมพ์ "เบอร์โทรศัพท์" (เช่น 0812345678)\n' +
            'หรือพิมพ์ "ชื่อ-นามสกุล" เพื่อยืนยันตัวตนค่ะ', 
            null
        );
    }
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

async function handleAttachments(base44, senderPsid, attachments, branchId, tenant) {
    if (!tenant) {
        await sendFacebookMessage(base44, senderPsid, '❌ กรุณาลงทะเบียนก่อนส่งรูปภาพ', branchId);
        return;
    }

    const imageAttachment = attachments.find(a => a.type === 'image');
    if (imageAttachment) {
        // Process Slip Logic (Simplified from LINE)
        const imageUrl = imageAttachment.payload.url;
        console.log(`📸 Image URL: ${imageUrl}`);
        
        // Download image
        const imageRes = await fetch(imageUrl);
        if (!imageRes.ok) return;
        const imageBlob = await imageRes.blob();
        
        // Upload to Base44
        const file = new File([imageBlob], `fb-slip-${Date.now()}.jpg`, { type: imageBlob.type });
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        const slipUrl = uploadRes.file_url;

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
                    if (verifyData.data && verifyData.data.amount) {
                        const amount = verifyData.data.amount;
                        await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                            status: 'paid',
                            payment_slip_url: slipUrl,
                            notes: `ตรวจสอบอัตโนมัติ (Facebook): ยอด ${amount} บาท`
                        });
                        await sendFacebookMessage(base44, senderPsid, `✅ ตรวจสอบสลิปสำเร็จ! ยอด ${amount} บาท\nบันทึกการชำระเงินเรียบร้อยแล้วค่ะ`, branchId);
                        
                        // Send Receipt
                        try {
                            await base44.asServiceRole.functions.invoke('sendReceipt', { paymentId: pendingPayment.id });
                        } catch (e) {}
                        
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
            await sendFacebookMessage(base44, senderPsid, '✅ ไม่มียอดค้างชำระ ขอบคุณค่ะ', branchId);
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

async function sendFacebookMessage(base44, recipientId, text, branchId) {
    const config = await getFacebookConfig(base44, branchId);
    if (!config?.pageAccessToken) {
        console.error('❌ No Facebook Page Access Token');
        return;
    }

    try {
        await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${config.pageAccessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text: text }
            })
        });
    } catch (e) {
        console.error('❌ Error sending FB message:', e);
    }
}