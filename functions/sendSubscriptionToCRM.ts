import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

/**
 * ส่งข้อมูลการชำระเงินแพ็กเกจไปยัง CRM
 * รับข้อมูลแบบละเอียดเพื่อส่งไป CRM
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    let payload;
    try {
      payload = await req.json();
    } catch (jsonError) {
      console.error('❌ Invalid JSON payload:', jsonError);
      return Response.json({ 
        success: false,
        error: 'Invalid JSON payload: ' + jsonError.message 
      }, { status: 400 });
    }
    
    console.log('📤 Received payload:', JSON.stringify(payload, null, 2));

    // ดึงค่า config จาก Config entity (ไม่ใช่ environment variables)
    const configs = await base44.asServiceRole.entities.Config.list();
    const webhookUrlConfig = configs.find(c => c.key === 'crm_webhook_url' && !c.branch_id);
    const webhookSecretConfig = configs.find(c => c.key === 'crm_webhook_secret' && !c.branch_id);
    
    const CRM_WEBHOOK_URL = webhookUrlConfig?.value;
    const CRM_WEBHOOK_SECRET = webhookSecretConfig?.value;
    
    console.log('🔑 CRM_WEBHOOK_URL:', CRM_WEBHOOK_URL);
    console.log('🔑 CRM_WEBHOOK_SECRET:', CRM_WEBHOOK_SECRET);
    
    if (!CRM_WEBHOOK_URL || !CRM_WEBHOOK_SECRET) {
      console.error('❌ Missing CRM configuration');
      return Response.json({ 
        success: false,
        error: 'ไม่พบการตั้งค่า CRM Webhook - กรุณาตั้งค่า CRM_WEBHOOK_URL และ CRM_WEBHOOK_SECRET' 
      }, { status: 200 });
    }

    // สร้าง payload สำหรับ CRM
    const webhookPayload = {
      event_type: 'subscription_payment',
      customer_email: payload.customer_email,
      customer_name: payload.customer_name,
      package_id: payload.package_id,
      package_name: payload.package_name,
      subscription_start_date: payload.subscription_start_date,
      subscription_end_date: payload.subscription_end_date,
      duration_months: payload.duration_months,
      price_per_month: payload.price_per_month,
      total_amount: payload.total_amount,
      original_amount: payload.original_amount || payload.total_amount,
      discount_code: payload.discount_code || null,
      discount_amount: payload.discount_amount || 0,
      verified_amount: payload.verified_amount,
      payment_date: payload.payment_date,
      slip_url: payload.slip_url,
      sender_name: payload.sender_name,
      sender_account: payload.sender_account,
      receiver_account: payload.receiver_account,
      receiver_name: payload.receiver_name,
      app_mode: payload.app_mode,
      branch_ids: payload.branch_ids || null,
      branch_id: payload.branch_id || null,
      test_mode: payload.test_mode || false,
      timestamp: new Date().toISOString()
    };

    console.log('📨 Webhook payload:', JSON.stringify(webhookPayload, null, 2));
    console.log('🌐 Sending to URL:', CRM_WEBHOOK_URL);

    // ส่งข้อมูลไป CRM
    let response;
    try {
      response = await fetch(CRM_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CRM_WEBHOOK_SECRET
        },
        body: JSON.stringify(webhookPayload)
      });
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError);
      return Response.json({ 
        success: false,
        error: 'ไม่สามารถเชื่อมต่อกับ CRM ได้: ' + fetchError.message,
        url: CRM_WEBHOOK_URL
      }, { status: 200 });
    }

    const responseText = await response.text();
    console.log('📥 CRM Response Status:', response.status);
    console.log('📥 CRM Response Body:', responseText);

    if (!response.ok) {
      console.error('❌ CRM webhook error:', responseText);
      return Response.json({ 
        success: false,
        error: `CRM ตอบกลับ error (${response.status})`,
        details: responseText,
        url: CRM_WEBHOOK_URL
      }, { status: 200 });
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    console.log('✅ Subscription data sent to CRM successfully');

    return Response.json({
      success: true,
      message: 'ส่งข้อมูลไปยัง CRM สำเร็จ',
      crm_response: result
    });

  } catch (error) {
    console.error('❌ Error sending subscription to CRM:', error);
    console.error('Error stack:', error.stack);
    return Response.json({ 
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 200 });
  }
});