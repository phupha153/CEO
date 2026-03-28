import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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

    // ถ้ามีเวอร์ชันใหม่ → ส่งอีเมลแจ้งเตือน
    if (needsUpdate) {
      const adminEmail = Deno.env.get('admin_email');

      if (adminEmail) {
        const emailBody = `🚨 ตรวจพบ @base44/sdk เวอร์ชันใหม่!\n\n` +
                         `📦 เวอร์ชันปัจจุบัน: ${currentVersion}\n` +
                         `✨ เวอร์ชันล่าสุด: ${latestVersion}\n\n` +
                         `คำสั่งสำหรับ Base44 AI:\n"อัปเดต SDK เป็น ${latestVersion}"\n\n` +
                         `---\n` +
                         `ตรวจสอบเมื่อ: ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`;

        await base44.integrations.Core.SendEmail({
          to: adminEmail,
          subject: `🔔 @base44/sdk เวอร์ชันใหม่: ${latestVersion}`,
          body: emailBody
        });

        console.log('✅ Sent email notification to admin');
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