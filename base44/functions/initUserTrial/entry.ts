import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // เช็คว่า user มี trial_ends_at แล้วหรือยัง
    if (user.trial_ends_at) {
      return Response.json({ 
        message: 'User already has trial period set',
        trial_ends_at: user.trial_ends_at,
        plan_status: user.plan_status || 'trial'
      });
    }

    // ตั้งค่า trial 30 วัน (ใช้ +31 เพื่อให้แสดง 30 วันในวันแรก)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const trialEndDate = new Date(today);
    trialEndDate.setDate(today.getDate() + 31);
    trialEndDate.setHours(23, 59, 59, 999);

    await base44.auth.updateMe({
      trial_ends_at: trialEndDate.toISOString().split('T')[0],
      plan_status: 'trial'
    });

    return Response.json({
      message: 'Trial period initialized successfully',
      trial_ends_at: trialEndDate.toISOString().split('T')[0],
      plan_status: 'trial',
      days_remaining: 30
    });

  } catch (error) {
    console.error('initUserTrial error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});