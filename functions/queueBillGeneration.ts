import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    // 🔒 Authentication Check
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 🔒 Plan Verification
    const planStatus = user.plan_status;
    if (!planStatus || planStatus === 'expired' || planStatus === 'cancelled') {
      return Response.json({ 
        error: 'Subscription required', 
        message: 'แพ็กเกจของคุณหมดอายุแล้ว' 
      }, { status: 402 });
    }

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const targetBranchId = body.branch_id || null;
    const forceCreate = body.force === true;

    // 🔒 Branch Access Check
    if (targetBranchId) {
      const userAccessibleBranches = user.accessible_branches;
      const isDeveloper = user.custom_role === 'developer';
      const isOwner = user.custom_role === 'owner';
      
      if (!isDeveloper && !isOwner) {
        if (userAccessibleBranches && !userAccessibleBranches.includes(targetBranchId)) {
          return Response.json({ error: 'Branch access denied' }, { status: 403 });
        }
      }
    }

    // ✅ Create Queue Entry
    const jobName = `Generate Monthly Bills${targetBranchId ? ` - ${targetBranchId}` : ' - All Branches'}`;
    
    const queueEntry = await base44.asServiceRole.entities.InvoiceQueue.create({
      branch_id: targetBranchId,
      job_name: jobName,
      total_count: 0, // จะ update ตอนประมวลผล
      status: 'pending',
      payment_ids: [],
      failed_ids: []
    });

    return Response.json({
      success: true,
      message: '✅ เพิ่มเข้า Queue สำเร็จ',
      job_id: queueEntry.id,
      job_name: jobName,
      status: 'pending'
    });

  } catch (error) {
    console.error('❌ Queue Error:', error);
    return Response.json({
      success: false,
      message: `Error: ${error.message}`
    }, { status: 500 });
  }
});