import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const branchId = body.branch_id;
        
        if (!branchId) {
            return Response.json({ error: 'branch_id is required' }, { status: 400 });
        }

        console.log(`🗑️ Starting background deletion for branch: ${branchId}`);

        // นับจำนวนทั้งหมดก่อน
        const allPayments = await base44.asServiceRole.entities.Payment.filter(
            { branch_id: branchId },
            '-created_date',
            10000
        );
        const totalPayments = allPayments.length;

        // Initialize progress tracking in Config entity
        const progressKey = `delete_progress_${branchId}`;
        const existingProgress = await base44.asServiceRole.entities.Config.filter({ key: progressKey });
        
        const progressData = {
            deleted: 0,
            remaining: totalPayments,
            initial: totalPayments,
            timestamp: Date.now()
        };
        
        if (existingProgress.length > 0) {
            await base44.asServiceRole.entities.Config.update(existingProgress[0].id, {
                value: JSON.stringify(progressData)
            });
        } else {
            await base44.asServiceRole.entities.Config.create({
                key: progressKey,
                value: JSON.stringify(progressData),
                description: 'Delete progress tracker',
                category: 'general'
            });
        }

        // Return ทันที - ให้ลบต่อในพื้นหลัง
        const response = Response.json({
            success: true,
            message: 'เริ่มลบข้อมูลในพื้นหลัง',
            started: true,
            totalPayments: totalPayments
        });

        // ทำงานต่อในพื้นหลังโดยไม่ block response
        (async () => {
            const batchSize = 100;
            let totalDeleted = 0;
            let roundCount = 0;
            let rateLimitCount = 0;
            let lastRateLimitTime = null;

            console.log(`🚀 [${branchId}] Starting deletion of ${totalPayments} payments`);
            console.log(`⚙️ SLOW Config: batchSize=100, itemDelay=5s, retryDelay=15s, roundDelay=60s`);

            try {
                while (true) {
                    roundCount++;
                    const fetchStart = Date.now();

                    console.log(`📦 [Round ${roundCount}] Fetching batch...`);
                    const payments = await base44.asServiceRole.entities.Payment.filter(
                        { branch_id: branchId }, 
                        '-created_date', 
                        batchSize
                    );

                    const fetchTime = Date.now() - fetchStart;
                    console.log(`📦 [Round ${roundCount}] Fetch took ${fetchTime}ms, got ${payments?.length || 0} items`);

                    if (!payments || payments.length === 0) {
                        console.log(`✅ [COMPLETE] Total deleted: ${totalDeleted}, Rate limit hits: ${rateLimitCount}`);
                        
                        const finalProgressConfigs = await base44.asServiceRole.entities.Config.filter({ key: progressKey });
                        if (finalProgressConfigs.length > 0) {
                            await base44.asServiceRole.entities.Config.update(finalProgressConfigs[0].id, {
                                value: JSON.stringify({
                                    deleted: totalDeleted,
                                    remaining: 0,
                                    initial: totalPayments,
                                    completed: true,
                                    rateLimitCount,
                                    timestamp: Date.now()
                                })
                            });
                        }
                        break;
                    }

                    // ลบทั้ง batch พร้อมกัน
                    console.log(`🗑️ [Round ${roundCount}] Deleting ${payments.length} payments in parallel...`);
                    const deleteStart = Date.now();
                    
                    const deletePromises = payments.map(async (payment) => {
                        try {
                            await base44.asServiceRole.entities.Payment.delete(payment.id);
                            return { success: true, id: payment.id };
                        } catch (e) {
                            if (e.message?.includes('not found') || e.message?.includes('404')) {
                                return { success: true, id: payment.id, skipped: true };
                            }
                            return { success: false, id: payment.id, error: e.message };
                        }
                    });
                    
                    const results = await Promise.all(deletePromises);
                    const deleteTime = Date.now() - deleteStart;
                    
                    const successCount = results.filter(r => r.success).length;
                    const failedCount = results.filter(r => !r.success).length;
                    const skippedCount = results.filter(r => r.skipped).length;
                    
                    totalDeleted += successCount;
                    
                    console.log(`✅ [Round ${roundCount}] Deleted ${successCount} payments in ${deleteTime}ms (${skippedCount} skipped, ${failedCount} failed)`);

                    // อัปเดต progress ทุก 10 รอบ
                    if (roundCount % 10 === 0) {
                        const remaining = totalPayments - totalDeleted;
                        const progressPercent = ((totalDeleted / totalPayments) * 100).toFixed(2);

                        console.log(`📊 [Progress Update] Round ${roundCount}`);
                        console.log(`📊 Deleted: ${totalDeleted}/${totalPayments} (${progressPercent}%)`);
                        console.log(`📊 Remaining: ${remaining}, Rate limits: ${rateLimitCount}`);

                        const updateProgressConfigs = await base44.asServiceRole.entities.Config.filter({ key: progressKey });
                        if (updateProgressConfigs.length > 0) {
                            await base44.asServiceRole.entities.Config.update(updateProgressConfigs[0].id, {
                                value: JSON.stringify({
                                    deleted: totalDeleted,
                                    remaining: Math.max(0, remaining),
                                    initial: totalPayments,
                                    rateLimitCount,
                                    lastRateLimitTime,
                                    timestamp: Date.now()
                                })
                            });
                        }
                    }

                    // รอ 60 วินาทีระหว่างรอบ (1 นาที)
                    console.log(`⏳ [Round ${roundCount} complete] Waiting 60s before next round...`);
                    await new Promise(resolve => setTimeout(resolve, 60000));
                }
            } catch (error) {
                console.error(`❌❌❌ [FATAL ERROR] Background deletion crashed:`, error.message);
                console.error(`Stack:`, error.stack);

                const errorProgressConfigs = await base44.asServiceRole.entities.Config.filter({ key: progressKey });
                if (errorProgressConfigs.length > 0) {
                    await base44.asServiceRole.entities.Config.update(errorProgressConfigs[0].id, {
                        value: JSON.stringify({
                            deleted: totalDeleted,
                            remaining: totalPayments - totalDeleted,
                            initial: totalPayments,
                            error: error.message,
                            rateLimitCount,
                            lastRateLimitTime,
                            timestamp: Date.now()
                        })
                    });
                }
            }
        })();

        return response;

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        return Response.json({ 
            success: false, 
            error: error.message
        }, { status: 500 });
    }
});