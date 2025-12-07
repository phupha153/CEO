import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const kv = await Deno.openKv();

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

        // ดึง progress จาก KV
        const result = await kv.get(['delete_progress', branchId]);
        
        if (result.value) {
            return Response.json(result.value);
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