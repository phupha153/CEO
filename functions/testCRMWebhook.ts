import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ success: false, error: 'Admin only' }, { status: 403 });
    }

    const crmWebhookUrl = Deno.env.get('CRM_WEBHOOK_URL');
    const crmWebhookSecret = Deno.env.get('CRM_WEBHOOK_SECRET');

    console.log('\n=== CRM WEBHOOK DEBUG ===');
    console.log('📍 URL:', crmWebhookUrl || 'NOT SET');
    console.log('🔑 Secret (first 20 chars):', crmWebhookSecret?.substring(0, 20) + '...' || 'NOT SET');
    console.log('🔑 Secret length:', crmWebhookSecret?.length || 0);
    console.log('🔑 Secret has spaces?', crmWebhookSecret?.includes(' '));

    if (!crmWebhookUrl || !crmWebhookSecret) {
      return Response.json({
        success: false,
        error: 'CRM_WEBHOOK_URL or CRM_WEBHOOK_SECRET not set',
        env_check: {
          CRM_WEBHOOK_URL: crmWebhookUrl ? 'SET' : 'NOT SET',
          CRM_WEBHOOK_SECRET: crmWebhookSecret ? 'SET' : 'NOT SET'
        }
      });
    }

    const testPayload = {
      event_type: 'subscription_payment',
      customer_email: 'test@example.com',
      customer_name: 'Test User',
      customer_phone: '0812345678',
      package_id: 'test-pkg-001',
      package_name: 'TEST PACKAGE',
      subscription_start_date: '2026-01-21',
      subscription_end_date: '2026-02-21',
      duration_months: 1,
      price_per_month: 1390,
      total_amount: 1390,
      verified_amount: 1390,
      payment_date: '2026-01-21',
      slip_url: null,
      sender_name: 'Test Sender',
      sender_account: '1234567890',
      receiver_account: '9876543210',
      receiver_name: 'Test Receiver',
      app_mode: 'single_tenant',
      branch_ids: ['test-branch-001'],
      test_mode: true,
      timestamp: new Date().toISOString()
    };

    console.log('\n📤 Sending test payload to CRM...');
    console.log('🎯 Headers:', {
      'Content-Type': 'application/json',
      'x-api-key': `${crmWebhookSecret.substring(0, 10)}...`
    });
    console.log('📦 Payload keys:', Object.keys(testPayload));

    const crmResponse = await fetch(crmWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': crmWebhookSecret.trim()
      },
      body: JSON.stringify(testPayload)
    });

    const responseText = await crmResponse.text();
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    console.log('\n📥 CRM Response:');
    console.log('Status:', crmResponse.status);
    console.log('Headers:', Object.fromEntries(crmResponse.headers.entries()));
    console.log('Body:', responseData);

    return Response.json({
      success: crmResponse.ok,
      status: crmResponse.status,
      response: responseData,
      debug: {
        url_sent: crmWebhookUrl,
        header_sent: 'x-api-key',
        secret_length: crmWebhookSecret.length,
        secret_trimmed: crmWebhookSecret.trim() === crmWebhookSecret,
        test_mode: true
      }
    });

  } catch (error) {
    console.error('❌ Test error:', error);
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});