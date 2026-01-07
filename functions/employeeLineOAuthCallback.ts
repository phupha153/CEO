import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');

        if (!code || !state) {
            return new Response('<html><body><h1>❌ ข้อผิดพลาด</h1><p>ไม่พบ code หรือ state</p></body></html>', {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        // Decode state
        const stateData = JSON.parse(atob(state));
        const userEmail = stateData.email;
        const branchId = stateData.branch_id;

        // Exchange code for access token
        const lineLoginChannelId = Deno.env.get('LINE_LOGIN_CHANNEL_ID');
        const lineLoginChannelSecret = Deno.env.get('LINE_LOGIN_CHANNEL_SECRET');
        const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app-483eff6e.base44.app';
        const callbackUrl = `${frontendUrl}/api/apps/6904ea5ce861be65483eff6e/functions/employeeLineOAuthCallback`;

        const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: callbackUrl,
                client_id: lineLoginChannelId,
                client_secret: lineLoginChannelSecret
            })
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            console.error('Token exchange failed:', error);
            return new Response('<html><body><h1>❌ ไม่สามารถเชื่อมต่อได้</h1></body></html>', {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // ดึง LINE Profile
        const profileResponse = await fetch('https://api.line.me/v2/profile', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!profileResponse.ok) {
            return new Response('<html><body><h1>❌ ไม่สามารถดึงข้อมูล LINE ได้</h1></body></html>', {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        const profile = await profileResponse.json();
        const lineUserId = profile.userId;

        // อัพเดท User entity
        const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
        const user = Array.isArray(users) ? users[0] : users;

        if (user) {
            await base44.asServiceRole.entities.User.update(user.id, {
                employee_line_user_id: lineUserId,
                can_submit_expenses: true,
                assigned_branch_id: branchId
            });

            return new Response(`
                <html>
                <head>
                    <meta charset="utf-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            min-height: 100vh;
                            margin: 0;
                            padding: 20px;
                        }
                        .card {
                            background: white;
                            border-radius: 20px;
                            padding: 40px;
                            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                            text-align: center;
                            max-width: 400px;
                        }
                        .icon {
                            font-size: 64px;
                            margin-bottom: 20px;
                        }
                        h1 {
                            color: #10b981;
                            font-size: 24px;
                            margin-bottom: 10px;
                        }
                        p {
                            color: #64748b;
                            line-height: 1.6;
                        }
                        .btn {
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 10px;
                            font-size: 16px;
                            font-weight: 600;
                            cursor: pointer;
                            margin-top: 20px;
                        }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <div class="icon">✅</div>
                        <h1>เชื่อมต่อ LINE สำเร็จ!</h1>
                        <p>คุณสามารถส่งค่าใช้จ่ายผ่าน LINE ได้แล้ว</p>
                        <p style="margin-top: 10px; font-size: 14px; color: #94a3b8;">
                            ส่งข้อความหรือรูปใบเสร็จมาที่ LINE OA ของหอพักเพื่อบันทึกค่าใช้จ่าย
                        </p>
                        <button class="btn" onclick="window.close()">ปิดหน้าต่าง</button>
                    </div>
                </body>
                </html>
            `, {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        return new Response('<html><body><h1>❌ ไม่พบข้อมูลผู้ใช้</h1></body></html>', {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    } catch (error) {
        console.error('OAuth Callback Error:', error);
        return new Response(`<html><body><h1>❌ เกิดข้อผิดพลาด</h1><p>${error.message}</p></body></html>`, {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
});