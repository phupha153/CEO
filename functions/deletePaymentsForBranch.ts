import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
    console.log('🗑️ Starting Payment Deletion');
    
    try {
        const base44 = createClientFromRequest(req);
        
        const clonedReq = req.clone();
        let branchId = null;
        
        try {
            const text = await clonedReq.text();
            if (text && text.trim()) {
                const body = JSON.parse(text);
                branchId = body.branch_id;
            }
        } catch (e) {
            console.log('No body provided');
        }
        
        if (!branchId) {
            return Response.json({ 
                success: false, 
                error: 'กรุณาระบุ branch_id' 
            }, { status: 400 });
        }
        
        console.log(`🎯 Target Branch: ${branchId}`);
        
        // ดึง Payment ทั้งหมดของสาขานี้
        let allPayments = [];
        let skip = 0;
        const limit = 1000;
        let hasMore = true;
        
        while (hasMore) {
            const batch = await base44.asServiceRole.entities.Payment.filter(
                { branch_id: branchId },
                '-created_date',
                limit,
                skip
            );
            
            if (!batch || batch.length === 0) {
                hasMore = false;
            } else {
                allPayments = allPayments.concat(batch);
                skip += batch.length;
                
                if (batch.length < limit) {
                    hasMore = false;
                }
            }
            
            // ป้องกัน infinite loop
            if (allPayments.length >= 10000) {
                hasMore = false;
            }
        }
        
        console.log(`📦 Found ${allPayments.length} payments to delete`);
        
        if (allPayments.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มี Payment ที่ต้องลบ',
                deleted: 0
            });
        }
        
        // ลบทีละ batch
        let deletedCount = 0;
        const batchSize = 100;
        
        for (let i = 0; i < allPayments.length; i += batchSize) {
            const batch = allPayments.slice(i, i + batchSize);
            
            for (const payment of batch) {
                try {
                    await base44.asServiceRole.entities.Payment.delete(payment.id);
                    deletedCount++;
                } catch (error) {
                    console.error(`Failed to delete payment ${payment.id}:`, error.message);
                }
            }
            
            console.log(`✅ Deleted ${deletedCount}/${allPayments.length}`);
            
            // Delay between batches
            if (i + batchSize < allPayments.length) {
                await delay(500);
            }
        }
        
        console.log(`🎉 Completed: Deleted ${deletedCount}/${allPayments.length} payments`);
        
        return Response.json({
            success: true,
            message: `ลบ Payment สำเร็จ ${deletedCount} รายการ`,
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