import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const kv = await Deno.openKv();

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Service role - ไม่ต้องเช็ค auth เพราะเป็น cron job
        const branchId = '69255a34e816a8749fc765c2';
        
        console.log(`🤖 [CRON] Checking deletion progress for branch: ${branchId}`);
        
        // เช็ค progress ปัจจุบัน
        const progressResult = await kv.get(['delete_progress', branchId]);
        const progress = progressResult.value;
        
        // ถ้ามี progress และยังไม่เสร็จ
        if (progress && progress.remaining > 0 && !progress.completed) {
            console.log(`📊 [CRON] Found ongoing deletion: ${progress.deleted}/${progress.initial} (${progress.remaining} remaining)`);
            console.log(`⏭️ [CRON] Continuing deletion...`);
            
            // เรียก delete ต่อ
            const batchSize = 1;
            const payments = await base44.asServiceRole.entities.Payment.filter(
                { branch_id: branchId }, 
                '-created_date', 
                batchSize
            );
            
            console.log(`📦 [CRON] Fetched ${payments?.length || 0} payments to delete`);
            
            if (!payments || payments.length === 0) {
                console.log(`✅ [CRON COMPLETE] All payments deleted!`);
                await kv.set(['delete_progress', branchId], {
                    deleted: progress.deleted,
                    remaining: 0,
                    initial: progress.initial,
                    completed: true,
                    timestamp: Date.now()
                });
                return Response.json({
                    success: true,
                    message: 'Deletion completed',
                    totalDeleted: progress.deleted
                });
            }
            
            // ลบทีละรายการ
            let deleted = 0;
            for (const payment of payments) {
                let retries = 0;
                
                while (retries < 3) {
                    try {
                        console.log(`🗑️ [CRON] Deleting ${payment.id}... (retry: ${retries})`);
                        await base44.asServiceRole.entities.Payment.delete(payment.id);
                        deleted++;
                        console.log(`✅ [CRON] Deleted ${payment.id}`);
                        
                        // รอ 120 วินาที (2 นาที) ระหว่างรายการ
                        await new Promise(resolve => setTimeout(resolve, 120000));
                        break;
                        
                    } catch (e) {
                        // ถ้า 404 = payment ถูกลบไปแล้ว
                        if (e.message?.includes('not found') || e.message?.includes('404')) {
                            console.log(`⚠️ [CRON SKIP] ${payment.id} - Already deleted (404)`);
                            deleted++;
                            break;
                        }
                        
                        if (e.message?.includes('Rate limit') || e.message?.includes('429')) {
                            if (retries < 2) {
                                retries++;
                                const waitTime = 900 * Math.pow(2, retries - 1); // 15min, 30min
                                console.error(`⚠️ [CRON RATE LIMIT] Retry: ${retries}/3`);
                                console.error(`⚠️ [CRON] Waiting ${Math.round(waitTime/60)}min...`);
                                await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
                            } else {
                                console.error(`❌ [CRON FAILED] ${payment.id} - Max retries`);
                                break;
                            }
                        } else {
                            console.error(`❌ [CRON ERROR] ${payment.id}: ${e.message}`);
                            break;
                        }
                    }
                }
            }
            
            // อัพเดต progress
            const newDeleted = progress.deleted + deleted;
            const newRemaining = Math.max(0, progress.initial - newDeleted);
            
            await kv.set(['delete_progress', branchId], {
                deleted: newDeleted,
                remaining: newRemaining,
                initial: progress.initial,
                timestamp: Date.now()
            });
            
            console.log(`📊 [CRON] Progress: ${newDeleted}/${progress.initial} (${newRemaining} remaining)`);
            
            return Response.json({
                success: true,
                message: 'Cron job completed',
                deleted: deleted,
                totalDeleted: newDeleted,
                remaining: newRemaining
            });
        }
        
        // ถ้าไม่มี progress หรือเสร็จแล้ว
        if (!progress) {
            console.log(`ℹ️ [CRON] No ongoing deletion found`);
            return Response.json({
                success: true,
                message: 'No ongoing deletion'
            });
        }
        
        if (progress.completed) {
            console.log(`✅ [CRON] Deletion already completed`);
            return Response.json({
                success: true,
                message: 'Deletion already completed',
                totalDeleted: progress.deleted
            });
        }
        
        return Response.json({
            success: true,
            message: 'Nothing to do'
        });
        
    } catch (error) {
        console.error('❌ [CRON ERROR]:', error.message);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});