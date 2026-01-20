import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ⚡ CONCURRENCY CONFIG
const CONCURRENT_LIMIT = 10; // ประมวลผลพร้อมกัน 10 บิล
const RETRY_LIMIT = 3; // ลองใหม่สูงสุด 3 ครั้ง
const DELAY_BETWEEN_BATCHES = 1000; // หน่วงเวลา 1 วิระหว่าง batch

async function processWithRetry(fn, retries = RETRY_LIMIT) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Exponential backoff
    }
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ⚠️ Admin-only function (เพราะเป็น Cron Job)
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // 1. ดึง pending jobs
    const pendingJobs = await base44.asServiceRole.entities.InvoiceQueue.filter(
      { status: 'pending' },
      '-created_date',
      10 // ประมวลผลทีละ 10 jobs
    );

    if (!pendingJobs || pendingJobs.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No pending jobs',
        processed: 0 
      });
    }

    const results = [];

    for (const job of pendingJobs) {
      try {
        console.log(`🚀 Processing job ${job.id} - ${job.payment_ids.length} invoices`);
        
        // Update status to processing
        await base44.asServiceRole.entities.InvoiceQueue.update(job.id, {
          status: 'processing',
          started_at: new Date().toISOString()
        });

        const paymentIds = job.payment_ids || [];
        const failedIds = [];
        let completedCount = 0;

        // ⚡ Process in batches with concurrency limit
        for (let i = 0; i < paymentIds.length; i += CONCURRENT_LIMIT) {
          const batch = paymentIds.slice(i, i + CONCURRENT_LIMIT);
          
          const batchResults = await Promise.allSettled(
            batch.map(paymentId => 
              processWithRetry(async () => {
                const response = await base44.asServiceRole.functions.invoke('generateInvoiceImage', {
                  paymentId
                });
                
                if (!response.data.success) {
                  throw new Error(response.data.error || 'Failed to generate invoice');
                }
                
                return response.data;
              })
            )
          );

          // Count results
          batchResults.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
              completedCount++;
            } else {
              failedIds.push(batch[idx]);
              console.error(`Failed payment ${batch[idx]}:`, result.reason);
            }
          });

          // Update progress
          await base44.asServiceRole.entities.InvoiceQueue.update(job.id, {
            completed_count: completedCount,
            failed_count: failedIds.length,
            failed_ids: failedIds
          });

          // Delay between batches
          if (i + CONCURRENT_LIMIT < paymentIds.length) {
            await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
          }
        }

        // Mark job as completed
        await base44.asServiceRole.entities.InvoiceQueue.update(job.id, {
          status: failedIds.length === 0 ? 'completed' : 'failed',
          completed_at: new Date().toISOString(),
          error_message: failedIds.length > 0 
            ? `${failedIds.length} invoices failed` 
            : null
        });

        results.push({
          job_id: job.id,
          completed: completedCount,
          failed: failedIds.length
        });

      } catch (error) {
        console.error(`Job ${job.id} failed:`, error);
        
        await base44.asServiceRole.entities.InvoiceQueue.update(job.id, {
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString()
        });

        results.push({
          job_id: job.id,
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      processed_jobs: results.length,
      results
    });

  } catch (error) {
    console.error('Process queue error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});