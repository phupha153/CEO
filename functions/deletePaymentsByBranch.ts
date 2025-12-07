import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    console.log('🚀 Function started');
    
    try {
        const base44 = createClientFromRequest(req);
        console.log('✅ Client created');
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        console.log('✅ User authenticated:', user?.email);
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const body = await req.json();
        const branchId = body.branch_id;
        console.log('✅ Branch ID:', branchId);
        
        if (!branchId) {
            return Response.json({ error: 'branch_id is required' }, { status: 400 });
        }

        console.log('🗑️ Starting deletion for branch:', branchId);

        // นับจำนวนก่อน
        const allPayments = await base44.asServiceRole.entities.Payment.filter(
            { branch_id: branchId }, 
            '-created_date', 
            5000
        );
        const totalCount = allPayments.length;
        console.log(`📊 Found ${totalCount} payments to delete`);

        let deletedCount = 0;
        let errorCount = 0;
        const maxIterations = 50; // จำกัดไว้ 50 รอบ (50 x 200 = 10,000 records max)
        let iterations = 0;

        while (iterations < maxIterations) {
            try {
                console.log(`\n📦 Batch ${iterations + 1}/${maxIterations}`);
                
                // ดึง payments ของสาขานี้
                const payments = await base44.asServiceRole.entities.Payment.filter(
                    { branch_id: branchId }, 
                    '-created_date', 
                    100 // ลด batch size เหลือ 100
                );
                
                console.log(`Found ${payments.length} payments in this batch`);
                
                if (!payments || payments.length === 0) {
                    console.log('✅ No more payments to delete');
                    break;
                }

                // ลบทีละรายการ
                for (const payment of payments) {
                    try {
                        await base44.asServiceRole.entities.Payment.delete(payment.id);
                        deletedCount++;
                        
                        if (deletedCount % 50 === 0) {
                            console.log(`🗑️ Progress: ${deletedCount}/${totalCount} (${Math.round(deletedCount/totalCount*100)}%)`);
                        }
                    } catch (e) {
                        errorCount++;
                        console.error(`❌ Failed to delete ${payment.id}:`, e.message);
                    }
                }

                iterations++;
                console.log(`✅ Batch ${iterations} completed. Total deleted: ${deletedCount}`);
                
                // เพิ่ม delay เล็กน้อยเพื่อลดภาระ
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (e) {
                console.error('❌ Error in batch:', e.message, e.stack);
                break;
            }
        }

        console.log(`\n✅ Deletion completed!`);
        console.log(`📊 Total deleted: ${deletedCount} payments`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`📦 Iterations: ${iterations}`);

        return Response.json({
            success: true,
            message: `ลบ Payment สำเร็จ ${deletedCount} รายการ (สาขา ${branchId})`,
            deletedCount,
            errorCount,
            iterations,
            totalFound: totalCount
        });

    } catch (error) {
        console.error('❌ Fatal Error:', error.message);
        console.error('Stack:', error.stack);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});