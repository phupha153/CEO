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

    // ⭐ นับจำนวนผู้ใช้และสาขาจากระบบหอพักโดยตรง (ไม่ต้องพึ่ง CRM API)
    
    // 1. นับจำนวน Users ทั้งหมดในระบบ
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 1000);
    const totalUsers = allUsers?.length || 0;
    
    // 2. นับจำนวน Branches ทั้งหมดในระบบ
    const allBranches = await base44.asServiceRole.entities.Branch.list('-created_date', 1000);
    const totalBranches = allBranches?.length || 0;

    console.log('Total users in system:', totalUsers);
    console.log('Total branches in system:', totalBranches);

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