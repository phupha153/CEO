import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // ถ้ามี error จาก LINE
    if (error) {
      console.error('LINE OAuth error:', error);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `/settings?line_error=${encodeURIComponent(error)}`
        }
      });
    }

    if (!code || !state) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/settings?line_error=missing_parameters'
        }
      });
    }

    // Decode state เพื่อดึง user email
    const decodedState = atob(state);
    const [userEmail] = decodedState.split(':');

    // สร้าง base44 client (ใช้ service role เพราะยังไม่มี user session)
    const base44 = createClientFromRequest(req);

    // ดึง LINE credentials
    const configs = await base44.asServiceRole.entities.Config.list();
    const lineChannelId = configs.find(c => c.key === 'line_channel_id')?.value;
    const lineChannelSecret = configs.find(c => c.key === 'line_channel_secret')?.value;

    if (!lineChannelId || !lineChannelSecret) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/settings?line_error=missing_credentials'
        }
      });
    }

    // แลก authorization code เป็น access token
    const baseUrl = url.origin;
    const redirectUri = `${baseUrl}/api/functions/lineOAuthCallback`;

    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: lineChannelId,
        client_secret: lineChannelSecret,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('LINE token exchange failed:', errorData);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/settings?line_error=token_exchange_failed'
        }
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // เก็บ access token ลงใน Config
    const existingToken = configs.find(c => c.key === 'line_channel_access_token');
    
    if (existingToken) {
      await base44.asServiceRole.entities.Config.update(existingToken.id, {
        value: accessToken,
        description: `LINE OAuth Access Token (Updated: ${new Date().toISOString()})`,
      });
    } else {
      await base44.asServiceRole.entities.Config.create({
        key: 'line_channel_access_token',
        value: accessToken,
        value_type: 'string',
        description: `LINE OAuth Access Token (Connected: ${new Date().toISOString()})`,
        category: 'notification',
      });
    }

    // เก็บข้อมูลการเชื่อมต่อ
    await base44.asServiceRole.entities.Config.create({
      key: 'line_oauth_connected_at',
      value: new Date().toISOString(),
      value_type: 'string',
      description: `Connected by ${userEmail}`,
      category: 'notification',
    });

    console.log('✅ LINE OAuth connected successfully');

    // Redirect กลับไปหน้า Settings พร้อมแจ้งความสำเร็จ
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/settings?line_success=true&tab=line'
      }
    });

  } catch (error) {
    console.error('Error in LINE OAuth callback:', error);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `/settings?line_error=${encodeURIComponent(error.message)}`
      }
    });
  }
});