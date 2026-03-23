import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { branch_id, redirect_url } = body;

        if (!branch_id) {
            return Response.json({ error: 'branch_id is required' }, { status: 400 });
        }

        const FACEBOOK_APP_ID = Deno.env.get('FACEBOOK_APP_ID');
        
        if (!FACEBOOK_APP_ID) {
            return Response.json({ error: 'Facebook App ID not configured' }, { status: 500 });
        }

        // สร้าง state สำหรับเก็บข้อมูล branch_id และ redirect_url
        const state = btoa(JSON.stringify({
            branch_id,
            redirect_url: redirect_url || '',
            user_email: user.email,
            timestamp: Date.now()
        }));

        // Callback URL - ต้องตรงกับที่ตั้งใน Facebook App
        const callbackUrl = `https://app.base44.com/api/6904ea5ce861be65483eff6e/functions/facebookOAuthCallback`;

        // Facebook OAuth URL พร้อม permissions สำหรับ Pages
        const scopes = [
            'pages_show_list',
            'pages_messaging',
            'pages_read_engagement',
            'pages_manage_metadata'
        ].join(',');

        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
            `client_id=${FACEBOOK_APP_ID}` +
            `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
            `&state=${encodeURIComponent(state)}` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&response_type=code`;

        return Response.json({ 
            success: true,
            auth_url: authUrl 
        });

    } catch (error) {
        console.error('Facebook OAuth Start Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});