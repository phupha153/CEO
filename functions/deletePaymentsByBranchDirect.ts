import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    const startTime = Date.now();
    
    try {
        const base44 = createClientFromRequest(req);
        
        // Parse branch_id
        const { branch_id } = await req.json();
        
        if (!branch_id) {
            return Response.json({ 
                success: false, 
                error: 'กรุณาระบุ branch_id' 
            }, { status: 400 });
        }
        
        console.log(`🗑️ Starting deletion for branch: ${branch_id}`);
        
        // Fetch ALL payments for this branch with pagination
        let allPayments = [];
        let skip = 0;
        const BATCH_SIZE = 1000;
        let hasMore = true;
        
        while (hasMore) {
            const batch = await base44.asServiceRole.entities.Payment.filter(
                { branch_id },
                '-created_date',
                BATCH_SIZE,
                skip
            );
            
            if (!Array.isArray(batch) || batch.length === 0) {
                hasMore = false;
            } else {
                allPayments = allPayments.concat(batch);
                skip += batch.length;
                if (batch.length < BATCH_SIZE) {
                    hasMore = false;
                }
            }
            console.log(`📊 Fetched ${allPayments.length} payments so far...`);
        }
        
        console.log(`📋 Total payments found: ${allPayments.length}`);
        
        if (allPayments.length === 0) {
            return Response.json({
                success: true,
                message: `ไม่พบ Payment ในสาขา ${branch_id}`,
                deleted: 0
            });
        }
        
        // Delete payments one by one in batches
        let deletedCount = 0;
        const DELETE_BATCH_SIZE = 50;
        
        for (let i = 0; i < allPayments.length; i += DELETE_BATCH_SIZE) {
            const batch = allPayments.slice(i, i + DELETE_BATCH_SIZE);
            
            await Promise.all(
                batch.map(payment => 
                    base44.asServiceRole.entities.Payment.delete(payment.id)
                        .then(() => {
                            deletedCount++;
                            if (deletedCount % 10 === 0) {
                                console.log(`🗑️ Deleted ${deletedCount}/${allPayments.length}...`);
                            }
                        })
                        .catch(err => console.error(`Failed to delete ${payment.id}:`, err.message))
                )
            );
            
            // Delay between batches
            if (i + DELETE_BATCH_SIZE < allPayments.length) {
                await new Promise(r => setTimeout(r, 500));
            }
        }
        
        const executionTime = Date.now() - startTime;
        console.log(`✅ Deletion completed: ${deletedCount}/${allPayments.length} payments deleted in ${executionTime}ms`);
        
        // Log to FunctionLog
        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'deletePaymentsByBranchDirect',
                run_timestamp: new Date().toISOString(),
                status: 'success',
                message: `Deleted ${deletedCount} payments from branch ${branch_id}`,
                execution_time_ms: executionTime,
                triggered_by: 'manual',
                details: {
                    branch_id,
                    total_found: allPayments.length,
                    deleted: deletedCount
                }
            });
        } catch (logError) {
            console.error('Failed to log:', logError.message);
        }
        
        return Response.json({
            success: true,
            message: `ลบสำเร็จ ${deletedCount} รายการ`,
            deleted: deletedCount,
            total: allPayments.length
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});