import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ดึง LINE Channel ID จาก Config
    const configs = await base44.asServiceRole.entities.Config.list();
    const lineChannelId = configs.find(c => c.key === 'line_channel_id')?.value;
    const lineChannelSecret = configs.find(c => c.key === 'line_channel_secret')?.value;

    if (!lineChannelId || !lineChannelSecret) {
      return Response.json({ 
        error: 'กรุณาตั้งค่า LINE Channel ID และ Channel Secret ก่อน' 
      }, { status: 400 });
    }

    // สร้าง state สำหรับ OAuth (ใช้ user email + timestamp)
    const state = btoa(`${user.email}:${Date.now()}`);
    
    // สร้าง redirect URI (ต้องตรงกับที่ตั้งค่าใน LINE Console)
    const baseUrl = new URL(req.url).origin;
    const redirectUri = `${baseUrl}/api/functions/lineOAuthCallback`;

    // สร้าง LINE OAuth URL
    const lineAuthUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
    lineAuthUrl.searchParams.set('response_type', 'code');
    lineAuthUrl.searchParams.set('client_id', lineChannelId);
    lineAuthUrl.searchParams.set('redirect_uri', redirectUri);
    lineAuthUrl.searchParams.set('state', state);
    lineAuthUrl.searchParams.set('scope', 'profile openid email'); // ขอ permissions ที่ต้องการ

    return Response.json({
      success: true,
      authUrl: lineAuthUrl.toString(),
      message: 'กรุณา redirect ไปยัง authUrl'
    });

  } catch (error) {
    console.error('Error starting LINE OAuth:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});