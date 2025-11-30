import { createClient } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    console.log('=== getPackagesFromCRM Started ===');

    const crmAppId = Deno.env.get("CRM_APP_ID");
    const crmServiceRoleKey = Deno.env.get("CRM_SERVICE_ROLE_KEY");

    console.log('CRM_APP_ID:', crmAppId);
    console.log('Has CRM_SERVICE_ROLE_KEY:', !!crmServiceRoleKey);

    if (!crmAppId || !crmServiceRoleKey) {
      return Response.json({ 
        error: '❌ CRM_APP_ID หรือ CRM_SERVICE_ROLE_KEY ไม่ได้ตั้งค่า',
        packages: [],
        active_subscriptions: []
      }, { status: 500 });
    }

    console.log('Creating CRM client...');

    const crmClient = createClient({
      appId: crmAppId,
      serviceRoleKey: crmServiceRoleKey,
      baseURL: 'https://app.base44.com'
    });

    console.log('Fetching packages from CRM...');

    const packages = await crmClient.entities.Package.list('-created_date', 100);
    
    console.log('✅ Success! Packages:', packages?.length || 0);
    
    // DEBUG: แสดงข้อมูลแพ็กเกจแรก
    if (packages && packages.length > 0) {
      console.log('First package data:', JSON.stringify(packages[0], null, 2));
      console.log('Package fields:', Object.keys(packages[0]));
    }

    return Response.json({
      success: true,
      packages: packages || [],
      active_subscriptions: []
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    console.error('Response:', error.response?.data);
    
    return Response.json({ 
      error: error.message,
      details: error.response?.data || null,
      packages: [],
      active_subscriptions: []
    }, { status: 500 });
  }
});