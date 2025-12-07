import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

        console.log(`🗑️ Fast deletion for branch: ${branchId}`);

        let totalDeleted = 0;
        let round = 0;

        while (true) {
            round++;
            console.log(`[Round ${round}] Fetching...`);
            
            const payments = await base44.asServiceRole.entities.Payment.filter(
                { branch_id: branchId }, 
                '-created_date', 
                10
            );

            if (!payments || payments.length === 0) {
                console.log(`✅ Complete - Total deleted: ${totalDeleted}`);
                break;
            }

            // ลบทีละรายการ delay สั้นๆ
            for (const payment of payments) {
                try {
                    await base44.asServiceRole.entities.Payment.delete(payment.id);
                    totalDeleted++;
                    
                    // delay 100ms ระหว่างรายการ
                    await new Promise(resolve => setTimeout(resolve, 100));
                } catch (e) {
                    if (e.message?.includes('not found') || e.message?.includes('404')) {
                        totalDeleted++;
                    } else {
                        console.error(`Error deleting ${payment.id}:`, e.message);
                    }
                }
            }
            
            console.log(`[Round ${round}] Deleted ${payments.length} - Total: ${totalDeleted}`);
            
            // delay 500ms ระหว่างรอบ
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return Response.json({
            success: true,
            deleted: totalDeleted,
            message: `ลบสำเร็จ ${totalDeleted} รายการ`
        });

    } catch (error) {
        console.error('ERROR:', error.message);
        return Response.json({ 
            success: false, 
            error: error.message
        }, { status: 500 });
    }
});