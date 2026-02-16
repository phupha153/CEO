import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

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

        // ดึง progress จาก Config entity
        const progressKey = `delete_progress_${branchId}`;
        const progressConfigs = await base44.asServiceRole.entities.Config.filter({ key: progressKey });
        
        if (progressConfigs.length > 0) {
            const progress = JSON.parse(progressConfigs[0].value);
            return Response.json(progress);
        }
        
        // ถ้าไม่มี progress ให้นับจาก database
        const payments = await base44.asServiceRole.entities.Payment.filter(
            { branch_id: branchId },
            '-created_date',
            10000
        );
        
        return Response.json({
            deleted: 0,
            remaining: payments.length,
            initial: payments.length,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('ERROR:', error.message);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});