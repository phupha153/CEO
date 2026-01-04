import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { platform, userId, tenantId, branchId } = await req.json();

    if (!platform || !userId || !tenantId) {
      return Response.json({ 
        error: 'Missing required fields: platform, userId, tenantId' 
      }, { status: 400 });
    }

    console.log(`📝 Updating ${platform} messages - User ID: ${userId}, Tenant ID: ${tenantId}`);

    // เลือก entity ตาม platform
    const entityName = platform === 'facebook' ? 'FacebookMessage' : 'LineMessage';
    const userIdField = platform === 'facebook' ? 'facebook_user_id' : 'line_user_id';

    // ดึงข้อความทั้งหมดของ user นี้
    const messages = await base44.asServiceRole.entities[entityName].list();
    const userMessages = messages.filter(m => m[userIdField] === userId);

    console.log(`📊 Found ${userMessages.length} messages to update`);

    // อัพเดท tenant_id สำหรับทุกข้อความ
    let updated = 0;
    for (const msg of userMessages) {
      if (msg.tenant_id !== tenantId) {
        await base44.asServiceRole.entities[entityName].update(msg.id, {
          tenant_id: tenantId,
          branch_id: branchId // อัพเดท branch_id ด้วย
        });
        updated++;
      }
    }

    console.log(`✅ Updated ${updated} messages with tenant_id`);

    return Response.json({
      success: true,
      updated: updated,
      total: userMessages.length
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});