import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body
        const body = await req.json();
        const keepBranchId = body.keep_branch_id;
        
        if (!keepBranchId) {
            return Response.json({ error: 'keep_branch_id is required' }, { status: 400 });
        }

        console.log('🗑️ Deleting all payments except branch:', keepBranchId);

        let deletedCount = 0;
        let skip = 0;
        const limit = 100;
        let hasMore = true;
        const maxIterations = 10000;
        let iterations = 0;

        while (hasMore && iterations < maxIterations) {
            try {
                // ดึง payments ทั้งหมด
                const allPayments = await base44.asServiceRole.entities.Payment.list('-created_date', limit);
                
                if (!allPayments || allPayments.length === 0) {
                    hasMore = false;
                    break;
                }

                // กรองเฉพาะที่ไม่ใช่สาขาที่ต้องการเก็บ
                const paymentsToDelete = allPayments.filter(p => p.branch_id !== keepBranchId);

                if (paymentsToDelete.length === 0) {
                    // ถ้าไม่มีอะไรให้ลบ แสดงว่าเหลือแต่ของสาขาที่ต้องการเก็บ
                    hasMore = false;
                    break;
                }

                // ลบทีละรายการ
                for (const payment of paymentsToDelete) {
                    try {
                        await base44.asServiceRole.entities.Payment.delete(payment.id);
                        deletedCount++;
                        
                        if (deletedCount % 100 === 0) {
                            console.log(`🗑️ Progress: Deleted ${deletedCount} payments...`);
                        }
                    } catch (e) {
                        console.error(`Failed to delete payment ${payment.id}:`, e.message);
                    }
                }

                iterations++;
                
                // Delay เล็กน้อยเพื่อลด rate limit
                await new Promise(resolve => setTimeout(resolve, 100));

            } catch (e) {
                console.error('Error in batch:', e.message);
                hasMore = false;
            }
        }

        console.log(`✅ Deletion completed! Total deleted: ${deletedCount} payments`);

        return Response.json({
            success: true,
            message: `ลบ Payment สำเร็จ ${deletedCount} รายการ (เก็บไว้เฉพาะสาขา ${keepBranchId})`,
            deletedCount,
            iterations
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});