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

        console.log(`🗑️ Deleting payments for branch: ${branchId}`);

        // ลบแค่ 100 รายการต่อครั้ง แล้ว return ให้ frontend เรียกซ้ำ
        const batchSize = 100;
        let deletedCount = 0;

        const payments = await base44.asServiceRole.entities.Payment.filter(
            { branch_id: branchId }, 
            '-created_date', 
            batchSize
        );
        
        console.log(`📋 Found ${payments.length} payments to delete`);
        
        if (!payments || payments.length === 0) {
            return Response.json({
                success: true,
                completed: true,
                message: 'ลบเสร็จสิ้นแล้ว',
                deletedThisRound: 0,
                hasMore: false
            });
        }

        for (const payment of payments) {
            try {
                await base44.asServiceRole.entities.Payment.delete(payment.id);
                deletedCount++;
            } catch (e) {
                console.error(`❌ Error deleting ${payment.id}:`, e.message);
            }
        }

        console.log(`✅ Deleted ${deletedCount} payments in this round`);

        return Response.json({
            success: true,
            completed: false,
            message: `ลบไปแล้ว ${deletedCount} รายการ`,
            deletedThisRound: deletedCount,
            hasMore: payments.length === batchSize
        });

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        return Response.json({ 
            success: false, 
            error: error.message
        }, { status: 500 });
    }
});