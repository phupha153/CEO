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

        console.log(`🗑️ Starting background deletion for branch: ${branchId}`);

        // Return ทันที - ให้ลบต่อในพื้นหลัง
        const response = Response.json({
            success: true,
            message: 'เริ่มลบข้อมูลในพื้นหลัง',
            started: true
        });

        // ทำงานต่อในพื้นหลังโดยไม่ block response
        (async () => {
            const batchSize = 100;
            let totalDeleted = 0;
            let roundCount = 0;

            try {
                while (true) {
                    roundCount++;
                    const payments = await base44.asServiceRole.entities.Payment.filter(
                        { branch_id: branchId }, 
                        '-created_date', 
                        batchSize
                    );
                    
                    if (!payments || payments.length === 0) {
                        console.log(`✅ Deletion completed! Total deleted: ${totalDeleted}`);
                        break;
                    }

                    for (const payment of payments) {
                        try {
                            await base44.asServiceRole.entities.Payment.delete(payment.id);
                            totalDeleted++;
                        } catch (e) {
                            console.error(`❌ Error deleting ${payment.id}:`, e.message);
                        }
                    }

                    console.log(`✅ Round ${roundCount}: Deleted ${payments.length} (Total: ${totalDeleted})`);
                    
                    // หน่วงเล็กน้อยเพื่อไม่ให้ load server มากเกิน
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                console.error(`❌ Background deletion error:`, error.message);
            }
        })();

        return response;

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        return Response.json({ 
            success: false, 
            error: error.message
        }, { status: 500 });
    }
});