import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.4';

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

    console.log('Fetching user subscriptions from CRM...');

    // ดึงข้อมูล subscriptions ของ user นี้จาก CRM
    const subscriptions = await crmClient.entities.Subscription.filter({
      user_email: user.email,
      status: 'active'
    });

    console.log('Found subscriptions:', subscriptions?.length || 0);

    let totalUsers = 0;
    let totalBranches = 0;

    // รวมจำนวนผู้ใช้และสาขาจากทุก subscription
    for (const sub of (subscriptions || [])) {
      totalUsers += sub.total_users_in_network || 0;
      totalBranches += sub.total_branches_in_network || 0;
    }

    console.log('Total users in network:', totalUsers);
    console.log('Total branches in network:', totalBranches);

    return Response.json({
      success: true,
      total_users: totalUsers,
      total_branches: totalBranches,
      subscriptions_count: subscriptions?.length || 0
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