Deno.serve(async (req) => {
  try {
    const { code, user_email } = await req.json();

    if (!code || !user_email) {
      return Response.json({ 
        success: false,
        error: 'กรุณาระบุข้อมูลให้ครบถ้วน' 
      });
    }

    const crmApiKey = Deno.env.get("CRM_API_KEY");
    if (!crmApiKey) {
      return Response.json({ 
        success: false,
        error: 'ไม่สามารถเชื่อมต่อ CRM ได้' 
      });
    }

    // เรียก API CRM เพื่อบันทึกการใช้โค้ดส่วนลด
    const crmResponse = await fetch('https://connect-sphere-crm-8aa1f2d8.base44.app/api/apps/6919c20da02654368aa1f2d8/functions/getDiscountCode', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': crmApiKey
      },
      body: JSON.stringify({ 
        code: code.toUpperCase(),
        action: 'mark_used',
        user_email: user_email
      })
    });

    const crmData = await crmResponse.json();
    
    if (!crmData.success) {
      return Response.json({ 
        success: false,
        error: crmData.error || 'ไม่สามารถบันทึกการใช้รหัสส่วนลดได้' 
      });
    }

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