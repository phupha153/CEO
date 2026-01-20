import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const user = await base44.auth.me();
    if (!user || user.custom_role !== 'developer') {
      return Response.json({ error: 'Developer only' }, { status: 403 });
    }

    console.log('🔄 Processing Queue...');

    // Fetch pending jobs (1 at a time, ordered by created_date)
    const pendingJobs = await base44.asServiceRole.entities.InvoiceQueue.filter(
      { status: 'pending' },
      'created_date',
      1
    );

    if (!pendingJobs || pendingJobs.length === 0) {
      return Response.json({
        success: true,
        message: 'ไม่มี job ที่รอ',
        processedCount: 0
      });
    }

    const job = pendingJobs[0];
    console.log(`📋 Processing job: ${job.id}`);

    // Update status to processing
    await base44.asServiceRole.entities.InvoiceQueue.update(job.id, {
      status: 'processing',
      started_at: new Date().toISOString()
    });

    // Call generateMonthlyBills with job_id
    const generateResult = await base44.asServiceRole.functions.invoke('generateMonthlyBills', {
      branch_id: job.branch_id,
      job_id: job.id,
      force: true
    });

    const data = generateResult.data || {};

    // Update queue entry with results
    const finalStatus = data.success !== false ? 'completed' : 'failed';
    const message = data.message || 'สร้างบิลสำเร็จ';

    await base44.asServiceRole.entities.InvoiceQueue.update(job.id, {
      status: finalStatus,
      completed_count: data.generatedCount || 0,
      failed_count: data.failedCount || 0,
      total_count: (data.generatedCount || 0) + (data.skippedDueToExistingBill || 0),
      error_message: finalStatus === 'failed' ? data.message : null,
      completed_at: new Date().toISOString(),
      payment_ids: data.payment_ids || []
    });

    console.log(`✅ Job completed: ${message}`);

    return Response.json({
      success: true,
      message: `Processed: ${message}`,
      processedCount: 1,
      jobStatus: finalStatus
    });

  } catch (error) {
    console.error('❌ Queue Processing Error:', error);
    return Response.json({
      success: false,
      message: `Error: ${error.message}`
    }, { status: 500 });
  }
});