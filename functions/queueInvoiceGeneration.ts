import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branch_id, payment_ids, job_name } = await req.json();

    if (!branch_id || !payment_ids || !Array.isArray(payment_ids)) {
      return Response.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    // 🔒 Security: Verify user has access to branch
    const userRole = user.custom_role || (user.role === 'admin' ? 'developer' : 'employee');
    if (userRole !== 'developer' && userRole !== 'owner') {
      const accessibleBranches = user.accessible_branches || [];
      if (!accessibleBranches.includes(branch_id)) {
        return Response.json({ error: 'No access to this branch' }, { status: 403 });
      }
    }

    // สร้าง Queue Job
    const queue = await base44.asServiceRole.entities.InvoiceQueue.create({
      branch_id,
      job_name: job_name || `Generate Invoices - ${new Date().toISOString().split('T')[0]}`,
      total_count: payment_ids.length,
      completed_count: 0,
      failed_count: 0,
      status: 'pending',
      payment_ids,
      failed_ids: []
    });

    return Response.json({
      success: true,
      queue_id: queue.id,
      message: `เพิ่มงานเข้า Queue สำเร็จ (${payment_ids.length} บิล)`
    });

  } catch (error) {
    console.error('Queue error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});