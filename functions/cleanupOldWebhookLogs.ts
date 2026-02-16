import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

// ลบ webhook logs ที่เก่ากว่า 30 วัน
Deno.serve(async (req) => {
    const startTime = Date.now();
    
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify admin only
        const user = await base44.auth.me();
        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log('🧹 Starting cleanup of old webhook logs...');

        // คำนวณวันที่ 30 วันก่อน (เวลาไทย UTC+7)
        const now = new Date();
        const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const cutoffDate = new Date(thailandTime);
        cutoffDate.setDate(cutoffDate.getDate() - 30);
        const cutoffISO = cutoffDate.toISOString();

        console.log(`📅 Deleting logs older than: ${cutoffISO}`);

        // ลบทีละ batch เพื่อไม่ให้ timeout
        const BATCH_SIZE = 500;
        let totalDeleted = 0;
        let hasMore = true;

        while (hasMore) {
            const oldLogs = await base44.asServiceRole.entities.WebhookLog.filter(
                { created_date: { $lt: cutoffISO } },
                '-created_date',
                BATCH_SIZE
            );

            if (!oldLogs || oldLogs.length === 0) {
                hasMore = false;
                break;
            }

            // ลบทีละรายการ
            for (const log of oldLogs) {
                try {
                    await base44.asServiceRole.entities.WebhookLog.delete(log.id);
                    totalDeleted++;
                } catch (delError) {
                    console.warn(`⚠️ Failed to delete log ${log.id}:`, delError.message);
                }
            }

            console.log(`✅ Deleted ${totalDeleted} logs so far...`);

            // ถ้าได้น้อยกว่า batch size = ไม่มีเหลือแล้ว
            if (oldLogs.length < BATCH_SIZE) {
                hasMore = false;
            }

            // พักเล็กน้อยระหว่าง batch
            await new Promise(r => setTimeout(r, 1000));
        }

        const executionTime = Date.now() - startTime;

        console.log(`✅ Cleanup completed: Deleted ${totalDeleted} logs in ${executionTime}ms`);

        return Response.json({
            success: true,
            deleted: totalDeleted,
            cutoff_date: cutoffISO,
            execution_time_ms: executionTime
        });

    } catch (error) {
        console.error('❌ Cleanup error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});