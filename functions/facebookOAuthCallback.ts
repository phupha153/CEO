import { createClient } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        // ถ้า user cancel หรือเกิด error
        if (error) {
            return new Response(generateErrorPage('การเชื่อมต่อถูกยกเลิก'), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        if (!code || !state) {
            return new Response(generateErrorPage('ข้อมูลไม่ครบถ้วน'), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        // Decode state
        let stateData;
        try {
            stateData = JSON.parse(atob(state));
        } catch {
            return new Response(generateErrorPage('State ไม่ถูกต้อง'), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        const { branch_id, redirect_url } = stateData;

        const FACEBOOK_APP_ID = Deno.env.get('FACEBOOK_APP_ID');
        const FACEBOOK_APP_SECRET = Deno.env.get('FACEBOOK_APP_SECRET');
        const callbackUrl = `https://app.base44.com/api/6904ea5ce861be65483eff6e/functions/facebookOAuthCallback`;

        // แลก code เป็น access token
        const tokenResponse = await fetch(
            `https://graph.facebook.com/v18.0/oauth/access_token?` +
            `client_id=${FACEBOOK_APP_ID}` +
            `&redirect_uri=${encodeURIComponent(callbackUrl)}` +
            `&client_secret=${FACEBOOK_APP_SECRET}` +
            `&code=${code}`
        );

        const tokenData = await tokenResponse.json();

        if (tokenData.error) {
            console.error('Token exchange error:', tokenData.error);
            return new Response(generateErrorPage('ไม่สามารถแลก Token ได้: ' + tokenData.error.message), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        const userAccessToken = tokenData.access_token;

        // ดึงรายการ Pages ที่ user เป็น admin
        const pagesResponse = await fetch(
            `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}`
        );
        const pagesData = await pagesResponse.json();

        if (pagesData.error) {
            console.error('Pages fetch error:', pagesData.error);
            return new Response(generateErrorPage('ไม่สามารถดึงข้อมูล Pages ได้'), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        const pages = pagesData.data || [];

        if (pages.length === 0) {
            return new Response(generateErrorPage('ไม่พบ Facebook Page ที่คุณเป็นผู้ดูแล'), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        // ถ้ามีหลาย Page ให้เลือก หรือถ้ามี Page เดียวก็ใช้เลย
        if (pages.length === 1) {
            // บันทึก Page Access Token โดยตรง
            const page = pages[0];
            await savePageToken(branch_id, page);
            
            return new Response(generateSuccessPage(page.name, redirect_url), {
                headers: { 'Content-Type': 'text/html; charset=utf-8' }
            });
        }

        // แสดงหน้าเลือก Page
        return new Response(generatePageSelectionPage(pages, branch_id, redirect_url), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });

    } catch (error) {
        console.error('Facebook OAuth Callback Error:', error);
        return new Response(generateErrorPage('เกิดข้อผิดพลาด: ' + error.message), {
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
    }
});

async function savePageToken(branchId, page) {
    const base44 = createClient({
        appId: Deno.env.get('BASE44_APP_ID'),
        serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
    });

    // หา Config ที่มีอยู่แล้ว
    const existingConfigs = await base44.asServiceRole.entities.Config.filter({
        branch_id: branchId,
        key: 'facebook_page_access_token'
    });

    const configData = {
        branch_id: branchId,
        key: 'facebook_page_access_token',
        value: page.access_token,
        value_type: 'string',
        description: `Facebook Page: ${page.name}`,
        category: 'notification'
    };

    if (existingConfigs.length > 0) {
        await base44.asServiceRole.entities.Config.update(existingConfigs[0].id, configData);
    } else {
        await base44.asServiceRole.entities.Config.create(configData);
    }

    // บันทึก Page ID ด้วย
    const pageIdConfigs = await base44.asServiceRole.entities.Config.filter({
        branch_id: branchId,
        key: 'facebook_page_id'
    });

    const pageIdData = {
        branch_id: branchId,
        key: 'facebook_page_id',
        value: page.id,
        value_type: 'string',
        description: `Facebook Page ID: ${page.name}`,
        category: 'notification'
    };

    if (pageIdConfigs.length > 0) {
        await base44.asServiceRole.entities.Config.update(pageIdConfigs[0].id, pageIdData);
    } else {
        await base44.asServiceRole.entities.Config.create(pageIdData);
    }
}

function generateSuccessPage(pageName, redirectUrl) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>เชื่อมต่อสำเร็จ</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .card { background: white; padding: 40px; border-radius: 20px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 400px; }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #1a1a2e; margin-bottom: 10px; }
        p { color: #666; margin-bottom: 20px; }
        .page-name { background: #f0f0f0; padding: 10px 20px; border-radius: 10px; font-weight: bold; color: #1877f2; }
        .btn { background: #1877f2; color: white; border: none; padding: 12px 30px; border-radius: 10px; font-size: 16px; cursor: pointer; margin-top: 20px; }
        .btn:hover { background: #166fe5; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">✅</div>
        <h1>เชื่อมต่อสำเร็จ!</h1>
        <p>เชื่อมต่อกับ Facebook Page เรียบร้อยแล้ว</p>
        <div class="page-name">${pageName}</div>
        <button class="btn" onclick="window.close(); ${redirectUrl ? `window.opener?.location.reload();` : ''}">ปิดหน้านี้</button>
    </div>
    <script>
        setTimeout(() => {
            if (window.opener) {
                window.opener.postMessage({ type: 'facebook_oauth_success', pageName: '${pageName}' }, '*');
            }
        }, 500);
    </script>
</body>
</html>`;
}

function generateErrorPage(message) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>เกิดข้อผิดพลาด</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%); }
        .card { background: white; padding: 40px; border-radius: 20px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 400px; }
        .icon { font-size: 64px; margin-bottom: 20px; }
        h1 { color: #1a1a2e; margin-bottom: 10px; }
        p { color: #666; }
        .btn { background: #666; color: white; border: none; padding: 12px 30px; border-radius: 10px; font-size: 16px; cursor: pointer; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon">❌</div>
        <h1>เกิดข้อผิดพลาด</h1>
        <p>${message}</p>
        <button class="btn" onclick="window.close()">ปิดหน้านี้</button>
    </div>
</body>
</html>`;
}

function generatePageSelectionPage(pages, branchId, redirectUrl) {
    const pagesHtml = pages.map(page => `
        <button class="page-btn" onclick="selectPage('${page.id}', '${page.access_token}', '${page.name.replace(/'/g, "\\'")}')">
            <span class="page-icon">📄</span>
            <span class="page-name">${page.name}</span>
        </button>
    `).join('');

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>เลือก Facebook Page</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .card { background: white; padding: 40px; border-radius: 20px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.3); max-width: 500px; width: 90%; }
        h1 { color: #1a1a2e; margin-bottom: 10px; }
        p { color: #666; margin-bottom: 20px; }
        .pages { display: flex; flex-direction: column; gap: 10px; }
        .page-btn { display: flex; align-items: center; gap: 15px; padding: 15px 20px; border: 2px solid #e0e0e0; border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s; }
        .page-btn:hover { border-color: #1877f2; background: #f0f7ff; }
        .page-icon { font-size: 24px; }
        .page-name { font-size: 16px; font-weight: 500; color: #1a1a2e; }
        .loading { display: none; }
        .loading.show { display: block; }
    </style>
</head>
<body>
    <div class="card">
        <h1>เลือก Facebook Page</h1>
        <p>กรุณาเลือก Page ที่ต้องการเชื่อมต่อ</p>
        <div class="pages">
            ${pagesHtml}
        </div>
        <p class="loading">กำลังบันทึก...</p>
    </div>
    <script>
        async function selectPage(pageId, accessToken, pageName) {
            document.querySelector('.loading').classList.add('show');
            document.querySelectorAll('.page-btn').forEach(btn => btn.disabled = true);
            
            try {
                const response = await fetch('https://app.base44.com/api/6904ea5ce861be65483eff6e/functions/facebookSavePageToken', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        branch_id: '${branchId}',
                        page_id: pageId,
                        access_token: accessToken,
                        page_name: pageName
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    if (window.opener) {
                        window.opener.postMessage({ type: 'facebook_oauth_success', pageName: pageName }, '*');
                    }
                    document.body.innerHTML = \`
                        <div class="card" style="background:white;padding:40px;border-radius:20px;text-align:center;">
                            <div style="font-size:64px">✅</div>
                            <h1>เชื่อมต่อสำเร็จ!</h1>
                            <p>เชื่อมต่อกับ \${pageName} เรียบร้อยแล้ว</p>
                            <button onclick="window.close()" style="background:#1877f2;color:white;border:none;padding:12px 30px;border-radius:10px;font-size:16px;cursor:pointer;margin-top:20px;">ปิดหน้านี้</button>
                        </div>
                    \`;
                } else {
                    alert('เกิดข้อผิดพลาด: ' + result.error);
                }
            } catch (err) {
                alert('เกิดข้อผิดพลาด: ' + err.message);
            }
        }
    </script>
</body>
</html>`;
}