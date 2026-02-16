import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    console.log('🗑️ Starting Dismissed Payments Cleanup...');
    const startTime = Date.now();

    try {
        const base44 = createClientFromRequest(req);

        // คำนวณวันตัดรอบ (30 วันที่แล้ว)
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const cutoffDateStr = cutoffDate.toISOString();

        console.log(`📅 Cutoff Date: ${cutoffDateStr} (30 days ago)`);

        // 🔍 หา Payment ที่ถูกซ่อนเกิน 30 วัน
        let dismissedPayments = [];
        let skip = 0;
        const FETCH_BATCH_SIZE = 500;
        let fetchingMore = true;

        while (fetchingMore) {
            const batch = await base44.asServiceRole.entities.Payment.filter(
                {
                    is_dismissed: true,
                    dismissed_at: { $lt: cutoffDateStr }
                },
                '-dismissed_at',
                FETCH_BATCH_SIZE,
                skip
            );

            if (batch.length === 0) {
                fetchingMore = false;
            } else {
                dismissedPayments = dismissedPayments.concat(batch);
                skip += batch.length;

                if (batch.length < FETCH_BATCH_SIZE) {
                    fetchingMore = false;
                }
            }
        }

        console.log(`📊 Found ${dismissedPayments.length} payments to delete`);

        if (dismissedPayments.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีรายการที่ต้องลบ',
                deleted: 0,
                duration: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
            });
        }

        // 🗑️ ลบทีละ batch
        const DELETE_BATCH_SIZE = 50;
        let deletedCount = 0;
        const errors = [];

        for (let i = 0; i < dismissedPayments.length; i += DELETE_BATCH_SIZE) {
            const batch = dismissedPayments.slice(i, i + DELETE_BATCH_SIZE);
            
            const results = await Promise.allSettled(
                batch.map(p => base44.asServiceRole.entities.Payment.delete(p.id))
            );

            results.forEach((result, idx) => {
                if (result.status === 'fulfilled') {
                    deletedCount++;
                } else {
                    errors.push({
                        payment_id: batch[idx].id,
                        error: result.reason?.message || 'Unknown error'
                    });
                }
            });

            console.log(`   ✅ Batch ${Math.floor(i / DELETE_BATCH_SIZE) + 1}: ${results.filter(r => r.status === 'fulfilled').length}/${batch.length} deleted`);

            // Delay เล็กน้อยเพื่อป้องกัน rate limit
            if (i + DELETE_BATCH_SIZE < dismissedPayments.length) {
                await new Promise(r => setTimeout(r, 100));
            }
        }

        const duration = (Date.now() - startTime) / 1000;
        const summary = `ลบรายการที่ซ่อนสำเร็จ ${deletedCount} รายการ (เก่ากว่า 30 วัน)`;

        console.log('========================================');
        console.log(`✅ ${summary}`);
        console.log(`⏱️ Duration: ${duration.toFixed(2)}s`);
        console.log('========================================');

        // บันทึก Log
        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'cleanupDismissedPayments',
                run_timestamp: new Date().toISOString(),
                status: errors.length === 0 ? 'success' : 'error',
                message: summary,
                execution_time_ms: Date.now() - startTime,
                total_sent: deletedCount,
                total_failed: errors.length,
                triggered_by: 'cron'
            });
        } catch (logError) {
            console.error('⚠️ Failed to create log:', logError.message);
        }

        return Response.json({
            success: true,
            message: summary,
            deleted: deletedCount,
            failed: errors.length,
            errors: errors.slice(0, 5),
            duration: `${duration.toFixed(2)}s`
        });

    } catch (error) {
        console.error('❌ FATAL ERROR:', error);
        return Response.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});