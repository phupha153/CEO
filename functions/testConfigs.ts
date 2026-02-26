import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const c1 = await base44.asServiceRole.entities.Config.filter({ key: 'default_communication_branch' });
    const c2 = await base44.asServiceRole.entities.Config.filter({ branch_id: null });
    return Response.json({ c1, c2 });
});