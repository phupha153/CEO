import { createClient } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const { code, user_email } = await req.json();

    if (!code || !user_email) {
      return Response.json({ 
        success: false,
        error: 'กรุณาระบุข้อมูลให้ครบถ้วน' 
      });
    }

    const crmAppId = Deno.env.get("CRM_APP_ID");
    const crmServiceRoleKey = Deno.env.get("CRM_SERVICE_ROLE_KEY");

    if (!crmAppId || !crmServiceRoleKey) {
      return Response.json({ 
        success: false,
        error: 'ไม่สามารถเชื่อมต่อ CRM ได้' 
      });
    }

    const crmClient = createClient({
      appId: crmAppId,
      serviceRoleKey: crmServiceRoleKey,
      baseURL: 'https://app.base44.com'
    });

    // ดึง discount code จาก CRM
    const discountCodes = await crmClient.entities.DiscountCode.filter({ code: code.toUpperCase() });
    const discountCode = discountCodes[0];

    if (!discountCode) {
      return Response.json({ 
        success: false,
        error: 'ไม่พบรหัสส่วนลดนี้' 
      });
    }

    // เพิ่มจำนวนครั้งที่ใช้และบันทึกผู้ใช้
    const currentUsageCount = discountCode.usage_count || 0;
    const usedByEmails = discountCode.used_by_emails || [];

    await crmClient.entities.DiscountCode.update(discountCode.id, {
      usage_count: currentUsageCount + 1,
      used_by_emails: [...usedByEmails, user_email],
      last_used_date: new Date().toISOString()
    });

    console.log(`✅ Discount code ${code} marked as used by ${user_email}`);

    return Response.json({
      success: true,
      message: 'บันทึกการใช้รหัสส่วนลดสำเร็จ'
    });

  } catch (error) {
    console.error('❌ Error marking discount code as used:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});