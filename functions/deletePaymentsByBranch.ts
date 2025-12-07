import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('🚀 Function started');
    
    try {
        const base44 = createClientFromRequest(req);
        console.log('✅ Client created');
        
        const user = await base44.auth.me();
        console.log('✅ User authenticated:', user?.email);
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const branchId = body.branch_id;
        console.log('✅ Branch ID:', branchId);
        
        if (!branchId) {
            return Response.json({ error: 'branch_id is required' }, { status: 400 });
        }

        console.log('🗑️ Starting deletion...');

        let deletedCount = 0;
        const batchSize = 50;
        const maxIterations = 60;

        for (let i = 0; i < maxIterations; i++) {
            console.log(`\n📦 Batch ${i + 1}/${maxIterations}`);
            
            const payments = await base44.asServiceRole.entities.Payment.filter(
                { branch_id: branchId }, 
                '-created_date', 
                batchSize
            );
            
            console.log(`📋 Found ${payments.length} payments`);
            
            if (!payments || payments.length === 0) {
                console.log('✅ No more payments');
                break;
            }

            for (const payment of payments) {
                try {
                    await base44.asServiceRole.entities.Payment.delete(payment.id);
                    deletedCount++;
                    
                    if (deletedCount % 25 === 0) {
                        console.log(`🗑️ Deleted: ${deletedCount}`);
                    }
                } catch (e) {
                    console.error(`❌ Error: ${payment.id}`);
                }
            }

            console.log(`✅ Batch ${i + 1} done: ${deletedCount} total`);
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log(`\n✅ COMPLETED: ${deletedCount} payments deleted`);

        return Response.json({
            success: true,
            message: `ลบสำเร็จ ${deletedCount} รายการ`,
            deletedCount
        });

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        return Response.json({ 
            success: false, 
            error: error.message
        }, { status: 500 });
    }
});