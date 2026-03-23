import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Base URL สำหรับ redirect กลับ
    const appBaseUrl = url.origin;

    // ถ้ามี error จาก LINE
    if (error) {
      console.error('LINE OAuth error:', error);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appBaseUrl}/LineConnect?error=${encodeURIComponent(error)}`
        }
      });
    }

    if (!code || !state) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appBaseUrl}/LineConnect?error=missing_parameters`
        }
      });
    }

    // Decode state เพื่อดึง tenant_id
    let tenantId;
    try {
      const decodedState = atob(state);
      // Format: tenant:tenant_id:timestamp
      const parts = decodedState.split(':');
      if (parts[0] !== 'tenant') {
        throw new Error('Invalid state format');
      }
      tenantId = parts[1];
    } catch (e) {
      console.error('Failed to decode state:', e);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appBaseUrl}/LineConnect?error=invalid_state`
        }
      });
    }

    // สร้าง base44 client
    const base44 = createClientFromRequest(req);

    // ดึง LINE credentials
    const configs = await base44.asServiceRole.entities.Config.list();
    const lineChannelId = configs.find(c => c.key === 'line_channel_id')?.value;
    const lineChannelSecret = configs.find(c => c.key === 'line_channel_secret')?.value;

    if (!lineChannelId || !lineChannelSecret) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appBaseUrl}/LineConnect?t=${tenantId}&error=missing_credentials`
        }
      });
    }

    // แลก authorization code เป็น access token
    const redirectUri = `${url.origin}/api/functions/tenantLineOAuthCallback`;

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
          'Location': `${appBaseUrl}/LineConnect?t=${tenantId}&error=token_exchange_failed`
        }
      });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // ดึง LINE user profile
    const profileResponse = await fetch('https://api.line.me/v2/profile', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!profileResponse.ok) {
      console.error('Failed to get LINE profile');
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appBaseUrl}/LineConnect?t=${tenantId}&error=profile_failed`
        }
      });
    }

    const profileData = await profileResponse.json();
    const lineUserId = profileData.userId;
    const displayName = profileData.displayName;

    console.log(`✅ Got LINE profile: ${displayName} (${lineUserId}) for tenant: ${tenantId}`);

    // อัปเดต tenant ด้วย line_user_id
    try {
      await base44.asServiceRole.entities.Tenant.update(tenantId, {
        line_user_id: lineUserId,
      });
      console.log(`✅ Updated tenant ${tenantId} with LINE User ID: ${lineUserId}`);
    } catch (updateError) {
      console.error('Failed to update tenant:', updateError);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': `${appBaseUrl}/LineConnect?t=${tenantId}&error=update_failed`
        }
      });
    }

    // ส่งข้อความต้อนรับ
    try {
      const lineAccessToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN') || 
        configs.find(c => c.key === 'line_channel_access_token')?.value;

      if (lineAccessToken) {
        // ดึงข้อมูล tenant และ building name
        const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: tenantId });
        const tenant = tenants[0];
        
        const buildingNameConfig = configs.find(c => c.key === 'building_name' && (!c.branch_id || c.branch_id === tenant?.branch_id));
        const buildingName = buildingNameConfig?.value || 'หอพัก';

        await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${lineAccessToken}`
          },
          body: JSON.stringify({
            to: lineUserId,
            messages: [{
              type: 'text',
              text: `🎉 ยินดีต้อนรับคุณ ${tenant?.full_name || displayName}!\n\nขอบคุณที่เชื่อมต่อ LINE กับ ${buildingName}\n\nตั้งแต่นี้ไป คุณจะได้รับ:\n📄 ใบแจ้งหนี้ค่าเช่า\n🧾 ใบเสร็จรับเงิน\n⏰ แจ้งเตือนค่าเช่า\n📢 ประกาศจากหอพัก\n\nผ่าน LINE โดยอัตโนมัติ ✨`
            }]
          })
        });
        console.log(`📤 Sent welcome message to ${lineUserId}`);
      }
    } catch (msgError) {
      console.warn('Failed to send welcome message:', msgError);
      // ไม่ error ถ้าส่งไม่สำเร็จ
    }

    // Redirect กลับไปหน้า LineConnect พร้อมแจ้งความสำเร็จ
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `${appBaseUrl}/LineConnect?t=${tenantId}&success=true`
      }
    });

  } catch (error) {
    console.error('Error in tenant LINE OAuth callback:', error);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': `/LineConnect?error=${encodeURIComponent(error.message)}`
      }
    });
  }
});