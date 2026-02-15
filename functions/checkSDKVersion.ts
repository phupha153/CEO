import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // 🔒 Security: Admin only
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    console.log('🔍 Checking @base44/sdk version...');
    
    // เช็คเวอร์ชันล่าสุดจาก npm registry
    const npmResponse = await fetch('https://registry.npmjs.org/@base44/sdk/latest');
    if (!npmResponse.ok) {
      throw new Error('Failed to fetch npm registry');
    }

    const npmData = await npmResponse.json();
    const latestVersion = npmData.version;
    const currentVersion = '0.8.6'; // เวอร์ชันที่ใช้อยู่ตอนนี้

    console.log(`📦 Current: ${currentVersion} | Latest: ${latestVersion}`);

    // เปรียบเทียบเวอร์ชัน
    const needsUpdate = latestVersion !== currentVersion;

    // ถ้ามีเวอร์ชันใหม่ → ส่ง LINE แจ้งเตือน
    if (needsUpdate) {
      const configs = await base44.asServiceRole.entities.Config.list();
      const lineToken = configs.find(c => c.key === 'line_channel_access_token')?.value || 
                        Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
      const adminEmail = Deno.env.get('admin_email');

      if (lineToken && adminEmail) {
        // ดึง admin user's LINE ID
        const admins = await base44.asServiceRole.entities.User.filter({ 
          email: adminEmail,
          role: 'admin' 
        });
        const adminLineId = admins[0]?.line_user_id;

        if (adminLineId) {
          const message = `🚨 มี SDK เวอร์ชันใหม่!\n\n` +
                         `📦 ปัจจุบัน: ${currentVersion}\n` +
                         `✨ ล่าสุด: ${latestVersion}\n\n` +
                         `แจ้ง Base44 AI เพื่ออัปเดท:\n"อัปเดต SDK เป็น ${latestVersion}"`;

          await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify({
              to: adminLineId,
              messages: [{ type: 'text', text: message }]
            })
          });

          console.log('✅ Sent LINE notification to admin');
        }
      }
    }

    return Response.json({
      success: true,
      current_version: currentVersion,
      latest_version: latestVersion,
      needs_update: needsUpdate,
      message: needsUpdate 
        ? `⚠️ มี SDK เวอร์ชันใหม่: ${latestVersion}` 
        : '✅ ใช้เวอร์ชันล่าสุดอยู่แล้ว'
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});