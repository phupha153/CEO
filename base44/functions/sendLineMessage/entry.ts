import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

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
                error: 'Missing required fields: to (LINE User ID) and message' 
            }, { status: 400 });
        }

        // ดึง LINE Token ตาม branch_id (ถ้ามี) หรือใช้ global
        const configs = await base44.asServiceRole.entities.Config.list();
        const lineTokenConfig = branch_id 
            ? configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branch_id)
            : configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
        
        const lineToken = lineTokenConfig?.value || Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
        
        if (!lineToken) {
            return Response.json({ 
                error: 'LINE_CHANNEL_ACCESS_TOKEN not configured for this branch' 
            }, { status: 500 });
        }

        // ส่งข้อความผ่าน LINE Messaging API
        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify({
                to: to,
                messages: [
                    {
                        type: 'text',
                        text: message
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            return Response.json({ 
                error: 'LINE API Error', 
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