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

        // ลบแบบเร็วที่สุด - ไม่มี delay เลย
        while (true) {
            round++;
            console.log(`[Round ${round}] Fetching...`);
            
            const payments = await base44.asServiceRole.entities.Payment.filter(
                { branch_id: branchId }, 
                '-created_date', 
                50 // ลบทีละ 50 รายการ
            );

            if (!payments || payments.length === 0) {
                console.log(`✅ Complete - Total deleted: ${totalDeleted}`);
                break;
            }

            // ลบทั้งหมดพร้อมกัน
            const deletePromises = payments.map(p => 
                base44.asServiceRole.entities.Payment.delete(p.id)
                    .catch(e => {
                        if (e.message?.includes('not found') || e.message?.includes('404')) {
                            console.log(`Skip ${p.id} - already deleted`);
                            return true;
                        }
                        throw e;
                    })
            );

            await Promise.all(deletePromises);
            totalDeleted += payments.length;
            
            console.log(`[Round ${round}] Deleted ${payments.length} - Total: ${totalDeleted}`);
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