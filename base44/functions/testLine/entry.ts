import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const body = await req.json();
        
        const lineToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
        const endpoint = 'https://api.line.me/v2/bot/message/push';
        
        const lineResponse = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify(body.payload)
        });

        const lineResponseData = await lineResponse.json();
        return Response.json({
            status: lineResponse.status,
            data: lineResponseData
        });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});