import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// เก็บ progress ใน KV store เพื่อให้ function อื่นเข้าถึงได้
const kv = await Deno.openKv();

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

        // บันทึก initial progress
        await kv.set(['delete_progress', branchId], {
            deleted: 0,
            remaining: totalPayments,
            initial: totalPayments,
            timestamp: Date.now()
        });

        // Return ทันที - ให้ลบต่อในพื้นหลัง
        const response = Response.json({
            success: true,
            message: 'เริ่มลบข้อมูลในพื้นหลัง',
            started: true,
            totalPayments: totalPayments
        });

        // ทำงานต่อในพื้นหลังโดยไม่ block response
        (async () => {
            const batchSize = 1;
            let totalDeleted = 0;
            let roundCount = 0;
            let rateLimitCount = 0;
            let lastRateLimitTime = null;

            console.log(`🚀 [${branchId}] Starting deletion of ${totalPayments} payments`);
            console.log(`⚙️ Config: batchSize=1, itemDelay=30s, retryDelay=300-600s, roundDelay=120s`);

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
                        await kv.set(['delete_progress', branchId], {
                            deleted: totalDeleted,
                            remaining: 0,
                            initial: totalPayments,
                            completed: true,
                            rateLimitCount,
                            timestamp: Date.now()
                        });
                        break;
                    }

                    for (const payment of payments) {
                        let retries = 0;
                        const paymentStart = Date.now();

                        while (retries < 3) {
                            try {
                                console.log(`🗑️ [${totalDeleted + 1}/${totalPayments}] Deleting ${payment.id}... (retry: ${retries})`);
                                const deleteStart = Date.now();

                                await base44.asServiceRole.entities.Payment.delete(payment.id);

                                const deleteTime = Date.now() - deleteStart;
                                totalDeleted++;

                                console.log(`✅ [${totalDeleted}/${totalPayments}] Deleted in ${deleteTime}ms`);

                                // รอ 30 วินาทีระหว่างรายการ
                                console.log(`⏳ Waiting 30s before next item...`);
                                await new Promise(resolve => setTimeout(resolve, 30000));
                                break;

                            } catch (e) {
                                const errorTime = Date.now() - paymentStart;

                                if (e.message?.includes('Rate limit') || e.message?.includes('429')) {
                                    rateLimitCount++;
                                    lastRateLimitTime = new Date().toISOString();

                                    if (retries < 2) {
                                        retries++;
                                        const waitTime = 300 * Math.pow(2, retries - 1); // 300s (5min), 600s (10min)
                                        console.error(`⚠️⚠️⚠️ [RATE LIMIT #${rateLimitCount}] at ${lastRateLimitTime}`);
                                        console.error(`⚠️ Payment: ${payment.id}, Retry: ${retries}/3`);
                                        console.error(`⚠️ Error: ${e.message}`);
                                        console.error(`⚠️ Waiting ${waitTime}s (${Math.round(waitTime/60)}min) before retry...`);

                                        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                                    } else {
                                        console.error(`❌ [FAILED] ${payment.id} - Max retries reached after ${errorTime}ms`);
                                        console.error(`❌ Error: ${e.message}`);
                                        break;
                                    }
                                } else {
                                    console.error(`❌ [ERROR] ${payment.id} after ${errorTime}ms: ${e.message}`);
                                    break;
                                }
                            }
                        }
                    }

                    // อัปเดต progress ทุก 50 รอบ
                    if (roundCount % 50 === 0) {
                        const remaining = totalPayments - totalDeleted;
                        const progressPercent = ((totalDeleted / totalPayments) * 100).toFixed(2);

                        console.log(`📊 [Progress Update] Round ${roundCount}`);
                        console.log(`📊 Deleted: ${totalDeleted}/${totalPayments} (${progressPercent}%)`);
                        console.log(`📊 Remaining: ${remaining}, Rate limits: ${rateLimitCount}`);

                        await kv.set(['delete_progress', branchId], {
                            deleted: totalDeleted,
                            remaining: Math.max(0, remaining),
                            initial: totalPayments,
                            rateLimitCount,
                            lastRateLimitTime,
                            timestamp: Date.now()
                        });
                    }

                    // รอ 120 วินาทีระหว่างรอบ
                    console.log(`⏳ [Round ${roundCount} complete] Waiting 120s (2min) before next round...`);
                    await new Promise(resolve => setTimeout(resolve, 120000));
                }
            } catch (error) {
                console.error(`❌❌❌ [FATAL ERROR] Background deletion crashed:`, error.message);
                console.error(`Stack:`, error.stack);

                await kv.set(['delete_progress', branchId], {
                    deleted: totalDeleted,
                    remaining: totalPayments - totalDeleted,
                    initial: totalPayments,
                    error: error.message,
                    rateLimitCount,
                    lastRateLimitTime,
                    timestamp: Date.now()
                });
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