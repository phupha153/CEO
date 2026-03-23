import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { branch_id } = await req.json();

        // ดึง LINE Token
        const configs = await base44.asServiceRole.entities.Config.list();
        
        console.log('All configs:', configs.map(c => ({ key: c.key, branch_id: c.branch_id, has_value: !!c.value })));
        
        const lineTokenConfig = branch_id 
            ? configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branch_id)
            : configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
        
        const lineToken = lineTokenConfig?.value || Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
        
        console.log('Branch ID:', branch_id);
        console.log('Token config found:', !!lineTokenConfig);
        console.log('Token from env:', !!Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN'));
        console.log('Final token:', lineToken ? `${lineToken.substring(0, 10)}...` : 'NOT FOUND');
        
        if (!lineToken) {
            return Response.json({ 
                success: false,
                error: 'LINE_CHANNEL_ACCESS_TOKEN not found',
                branch_id: branch_id,
                configs_checked: configs.length,
                has_env_token: !!Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')
            });
        }

        // ทดสอบเรียก LINE API (ดึงข้อมูล bot)
        const botInfoResponse = await fetch('https://api.line.me/v2/bot/info', {
            headers: {
                'Authorization': `Bearer ${lineToken}`
            }
        });

        const botInfo = await botInfoResponse.json();
        
        if (!botInfoResponse.ok) {
            return Response.json({ 
                success: false,
                error: 'Invalid LINE token or API error',
                status: botInfoResponse.status,
                details: botInfo,
                token_preview: `${lineToken.substring(0, 20)}...`,
                branch_id: branch_id
            });
        }

        return Response.json({ 
            success: true,
            message: 'LINE connection successful!',
            bot_info: botInfo,
            token_source: lineTokenConfig ? 'config' : 'env',
            branch_id: branch_id
        });

    } catch (error) {
        console.error('Test error:', error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});