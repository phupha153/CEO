import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const logs = await base44.asServiceRole.entities.FunctionLog.filter({
            "details.sent": 3,
            "details.lineCount": 36
        });
        
        return Response.json(logs);
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});