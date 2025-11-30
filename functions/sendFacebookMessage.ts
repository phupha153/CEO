import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

        // ดึง Facebook Page Access Token ตาม branch_id (ถ้ามี) หรือใช้ global
        const configs = await base44.asServiceRole.entities.Config.list();
        const facebookTokenConfig = branch_id 
            ? configs.find(c => c.key === 'facebook_page_access_token' && c.branch_id === branch_id)
            : configs.find(c => c.key === 'facebook_page_access_token' && !c.branch_id);
        
        const pageAccessToken = facebookTokenConfig?.value;
        
        if (!pageAccessToken) {
            return Response.json({ 
                error: 'FACEBOOK_PAGE_ACCESS_TOKEN not configured for this branch' 
            }, { status: 500 });
        }

        // ส่งข้อความผ่าน Facebook Graph API
        const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient: { id: to },
                message: { text: message }
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            return Response.json({ 
                error: 'Facebook API Error', 
                details: errorData 
            }, { status: response.status });
        }

        return Response.json({ 
            success: true, 
            message: 'Message sent successfully' 
        });

    } catch (error) {
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});