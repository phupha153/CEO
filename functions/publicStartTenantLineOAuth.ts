import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

// Public endpoint for LINE OAuth
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Parse request body
    const body = await req.json();
    const { tenant_id } = body;

    if (!tenant_id) {
      return Response.json({ error: 'Missing tenant_id' }, { status: 400 });
    }

    // ตรวจสอบว่า tenant มีอยู่จริง
    const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: tenant_id });
    const tenant = tenants[0];

    if (!tenant) {
      return Response.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // ถ้าเชื่อมต่อแล้ว
    if (tenant.line_user_id) {
      return Response.json({ 
        success: true,
        already_connected: true,
        message: 'LINE เชื่อมต่อกับบัญชีนี้แล้ว'
      });
    }

    // ดึง LINE credentials จาก Config
    const configs = await base44.asServiceRole.entities.Config.list();
    const lineChannelId = configs.find(c => c.key === 'line_channel_id')?.value;

    if (!lineChannelId) {
      return Response.json({ 
        error: 'กรุณาตั้งค่า LINE Channel ID ก่อน' 
      }, { status: 400 });
    }

    // สร้าง state สำหรับ OAuth (เก็บ tenant_id + timestamp)
    const state = btoa(`tenant:${tenant_id}:${Date.now()}`);
    
    // สร้าง redirect URI - ใช้ URL จาก request
    const baseUrl = new URL(req.url).origin;
    const redirectUri = `${baseUrl}/api/functions/tenantLineOAuthCallback`;

    // สร้าง LINE OAuth URL
    const lineAuthUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
    lineAuthUrl.searchParams.set('response_type', 'code');
    lineAuthUrl.searchParams.set('client_id', lineChannelId);
    lineAuthUrl.searchParams.set('redirect_uri', redirectUri);
    lineAuthUrl.searchParams.set('state', state);
    lineAuthUrl.searchParams.set('scope', 'profile openid');
    lineAuthUrl.searchParams.set('bot_prompt', 'aggressive');

    console.log(`🔗 Starting LINE OAuth for tenant: ${tenant_id}`);

    return Response.json({
      success: true,
      authUrl: lineAuthUrl.toString(),
    });

  } catch (error) {
    console.error('Error starting tenant LINE OAuth:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});