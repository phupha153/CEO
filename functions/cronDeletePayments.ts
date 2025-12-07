import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Cron job: Delete payments from branch one by one with real-time progress tracking
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        let body = {};
        try {
            body = await req.json();
        } catch {
            // ไม่มี body
        }
        
        let branchId = body.branch_id;
        
        if (!branchId) {
            const configs = await base44.asServiceRole.entities.Config.filter({ key: 'cron_delete_branch_id' });
            branchId = configs.length > 0 ? configs[0].value : '69255a34e816a8749fc765c2';
        }

        console.log(`🔄 [Cron] Checking deletion progress for branch: ${branchId}`);

        // เช็ค progress จาก Config
        const progressKey = `delete_progress_${branchId}`;
        const progressConfigs = await base44.asServiceRole.entities.Config.filter({ key: progressKey });
        const currentProgress = progressConfigs.length > 0 ? JSON.parse(progressConfigs[0].value) : null;
        
        if (!currentProgress) {
            console.log(`🆕 [Cron] No existing progress, starting new deletion...`);
            
            const allPayments = await base44.asServiceRole.entities.Payment.filter(
                { branch_id: branchId },
                '-created_date',
                10000
            );
            
            if (allPayments.length === 0) {
                console.log(`✅ [Cron] No payments to delete`);
                return Response.json({ success: true, message: 'No payments to delete', remaining: 0 });
            }
            
            const initialProgress = {
                deleted: 0,
                remaining: allPayments.length,
                initial: allPayments.length,
                timestamp: Date.now()
            };
            
            await base44.asServiceRole.entities.Config.create({
                key: progressKey,
                value: JSON.stringify(initialProgress),
                description: 'Delete progress tracker',
                category: 'general'
            });
            
            console.log(`📊 [Cron] Initialized progress: ${allPayments.length} payments to delete`);
        }
        
        const payments = await base44.asServiceRole.entities.Payment.filter(
            { branch_id: branchId }, 
            '-created_date', 
            1
        );
        
        if (!payments || payments.length === 0) {
            console.log(`✅ [Cron] Deletion complete!`);
            const finalProgress = currentProgress || { deleted: 0, initial: 0 };
            
            if (progressConfigs.length > 0) {
                await base44.asServiceRole.entities.Config.update(progressConfigs[0].id, {
                    value: JSON.stringify({
                        ...finalProgress,
                        remaining: 0,
                        completed: true,
                        timestamp: Date.now()
                    })
                });
            }
            
            return Response.json({ 
                success: true, 
                message: 'Deletion complete', 
                deleted: finalProgress.deleted,
                remaining: 0 
            });
        }
        
        const payment = payments[0];
        let deleted = false;
        
        try {
            console.log(`🗑️ [Cron] Deleting payment: ${payment.id}`);
            await base44.asServiceRole.entities.Payment.delete(payment.id);
            deleted = true;
            console.log(`✅ [Cron] Deleted payment: ${payment.id}`);
        } catch (e) {
            if (e.message?.includes('not found') || e.message?.includes('404')) {
                console.log(`⚠️ [Cron] Payment ${payment.id} already deleted (404), skipping...`);
                deleted = true;
            } else {
                console.error(`❌ [Cron] Error deleting ${payment.id}:`, e.message);
                throw e;
            }
        }
        
        if (deleted && currentProgress && progressConfigs.length > 0) {
            const newDeleted = (currentProgress.deleted || 0) + 1;
            const newRemaining = Math.max(0, (currentProgress.initial || 0) - newDeleted);
            
            await base44.asServiceRole.entities.Config.update(progressConfigs[0].id, {
                value: JSON.stringify({
                    deleted: newDeleted,
                    remaining: newRemaining,
                    initial: currentProgress.initial,
                    timestamp: Date.now()
                })
            });
            
            console.log(`📊 [Cron] Progress: ${newDeleted}/${currentProgress.initial} (${newRemaining} remaining)`);
            
            return Response.json({ 
                success: true, 
                deleted: newDeleted,
                remaining: newRemaining,
                message: `Deleted 1 payment, ${newRemaining} remaining`
            });
        }
        
        return Response.json({ success: true, message: 'Processing...' });

    } catch (error) {
        console.error('❌ [Cron] ERROR:', error.message);
        return Response.json({ 
            success: false, 
            error: error.message
        }, { status: 500 });
    }
});