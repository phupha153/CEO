import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // ดึง LINE Login credentials
        const lineLoginChannelId = Deno.env.get('LINE_LOGIN_CHANNEL_ID');
        const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app-483eff6e.base44.app';

        if (!lineLoginChannelId) {
            return Response.json({ error: 'LINE Login not configured' }, { status: 500 });
        }

        // สร้าง state สำหรับ OAuth (เก็บ user email + branch_id)
        const branchId = user.assigned_branch_id;
        const state = btoa(JSON.stringify({ 
            email: user.email, 
            branch_id: branchId,
            timestamp: Date.now()
        }));

        const callbackUrl = `${frontendUrl}/api/apps/6904ea5ce861be65483eff6e/functions/employeeLineOAuthCallback`;
        const lineAuthUrl = `https://access.line.me/oauth2/v2.1/authorize?response_type=code&client_id=${lineLoginChannelId}&redirect_uri=${encodeURIComponent(callbackUrl)}&state=${state}&scope=profile%20openid`;

        return Response.redirect(lineAuthUrl, 302);
    } catch (error) {
        console.error('OAuth Start Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});