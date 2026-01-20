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

    // 🔧 STUCK JOB RECOVERY: Reset jobs that are stuck in "processing" for >5 minutes
    const stuckJobs = await base44.asServiceRole.entities.InvoiceQueue.filter(
      { status: 'processing' },
      'created_date',
      10
    );

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    for (const stuckJob of stuckJobs) {
      try {
        const startedAt = stuckJob.started_at ? new Date(stuckJob.started_at) : null;
        if (!startedAt || startedAt < fiveMinutesAgo) {
          console.log(`🔧 Resetting stuck job: ${stuckJob.id}`);
          await base44.asServiceRole.entities.InvoiceQueue.update(stuckJob.id, {
            status: 'pending',
            started_at: null,
            error_message: 'Auto-reset after timeout'
          });
        }
      } catch (e) {
        console.error(`Failed to reset stuck job ${stuckJob.id}:`, e);
      }
    }

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