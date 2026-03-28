import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

// Cache สำหรับ Config
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_DURATION = 30 * 1000;

async function getFacebookConfig(base44, branchId = null) {
    try {
        const now = Date.now();
        if (!configCache || (now - configCacheTime) > CONFIG_CACHE_DURATION) {
            configCache = await base44.asServiceRole.entities.Config.list();
            configCacheTime = now;
        }
        
        const findConfig = (key) => {
            const allConfigs = configCache.filter(c => c.key === key && c.value?.trim());
            
            if (branchId) {
                const branchVal = allConfigs.find(c => c.branch_id === branchId);
                if (branchVal?.value?.trim()) return branchVal.value.trim();
            }
            
            const anyValidToken = allConfigs.find(c => c.value?.trim());
            return anyValidToken?.value?.trim() || null;
        };

        return {
            pageAccessToken: findConfig('facebook_page_access_token')
        };
    } catch (error) {
        console.error('❌ Error fetching FB config:', error);
        return null;
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { to, message, branch_id } = await req.json();

        if (!to || !message) {
            return Response.json({ 
                error: 'Missing required fields: to (Facebook PSID) and message' 
            }, { status: 400 });
        }

        // ดึง Facebook Page Access Token
        const config = await getFacebookConfig(base44, branch_id);
        
        if (!config?.pageAccessToken) {
            console.error('❌ No Facebook token found');
            return Response.json({ 
                error: 'FACEBOOK_PAGE_ACCESS_TOKEN not configured' 
            }, { status: 500 });
        }

        console.log(`📤 Sending FB message to ${to}: "${message.substring(0, 50)}..."`);

        // ส่งข้อความผ่าน Facebook Graph API
        // ⭐ ใช้ MESSAGE_TAG สำหรับส่งนอก 24 ชั่วโมง (reminder, payment notification)
        const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${config.pageAccessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient: { id: to },
                message: { text: message },
                messaging_type: 'MESSAGE_TAG',
                tag: 'ACCOUNT_UPDATE'  // ใช้ tag นี้สำหรับแจ้งเตือนการชำระเงิน
            })
        });

        const responseData = await response.json();

        if (!response.ok) {
            console.error('❌ Facebook API error:', responseData);
            return Response.json({ 
                error: 'Facebook API Error', 
                details: responseData 
            }, { status: response.status });
        }

        console.log('✅ Message sent successfully');

        // ⭐⭐⭐ บันทึกข้อความขาออกลง FacebookMessage entity (เหมือน LINE)
        try {
            await base44.asServiceRole.entities.FacebookMessage.create({
                branch_id: branch_id || null,
                tenant_id: null,
                facebook_user_id: to,
                facebook_display_name: null,
                facebook_picture_url: null,
                direction: 'outgoing',
                message_type: 'text',
                content: message,
                is_read: true,
                sent_by: user?.email || 'system'
            });
            console.log('✅ Saved outgoing Facebook message to FacebookMessage entity');
        } catch (saveError) {
            console.error('❌ Failed to save outgoing Facebook message:', saveError);
        }

        return Response.json({ 
            success: true, 
            message: 'Message sent successfully' 
        });

    } catch (error) {
        console.error('❌ Error in sendFacebookMessage:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});