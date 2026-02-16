import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    console.log('=== getMyNetworkStats Started ===');

    // Authenticate user from dormitory app
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('User:', user.email);

    const crmAppId = Deno.env.get("CRM_APP_ID");
    const crmServiceRoleKey = Deno.env.get("CRM_SERVICE_ROLE_KEY");

    if (!crmAppId || !crmServiceRoleKey) {
      return Response.json({ 
        error: 'CRM credentials not configured',
        total_users: 0,
        total_branches: 0
      }, { status: 500 });
    }

    // Connect to CRM
    const crmClient = createClient({
      appId: crmAppId,
      serviceRoleKey: crmServiceRoleKey,
      baseURL: 'https://app.base44.com'
    });

    console.log('Calling CRM API to get network stats...');

    // เรียก CRM API endpoint ที่จะนับจำนวนผู้ใช้และสาขาทั้งหมด
    const CRM_API_KEY = Deno.env.get('CRM_API_KEY');
    
    const crmApiResponse = await fetch(
      'https://connect-sphere-crm-8aa1f2d8.base44.app/api/apps/6919c20da02654368aa1f2d8/functions/getNetworkStats',
      {
        method: 'POST',
        headers: {
          'api_key': CRM_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email: user.email })
      }
    );

    if (!crmApiResponse.ok) {
      const errorText = await crmApiResponse.text();
      console.error('❌ CRM API error:', errorText);
      return Response.json({ 
        error: 'ไม่สามารถเชื่อมต่อ CRM ได้',
        total_users: 0,
        total_branches: 0
      }, { status: 500 });
    }

    const crmData = await crmApiResponse.json();
    
    console.log('CRM Response:', crmData);

    const totalUsers = crmData?.total_users || 0;
    const totalBranches = crmData?.total_branches || 0;

    console.log('Total users in network:', totalUsers);
    console.log('Total branches in network:', totalBranches);

    return Response.json({
      success: true,
      total_users: totalUsers,
      total_branches: totalBranches
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    
    return Response.json({ 
      error: error.message,
      total_users: 0,
      total_branches: 0
    }, { status: 500 });
  }
});