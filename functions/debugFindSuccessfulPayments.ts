import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Find payments with overdue_reminder_sent_date or due_date_reminder_sent_date updated in the last 24 hours
        // Since we know there are 3 successful, we can query both fields
        
        const overduePayments = await base44.asServiceRole.entities.Payment.filter({
            overdue_reminder_sent_date: { $gte: "2026-03-04T00:00:00.000Z" }
        }, '-overdue_reminder_sent_date', 10);
        
        const duePayments = await base44.asServiceRole.entities.Payment.filter({
            due_date_reminder_sent_date: { $gte: "2026-03-04T00:00:00.000Z" }
        }, '-due_date_reminder_sent_date', 10);
        
        const branchIds = [...new Set([...overduePayments.map(p => p.branch_id), ...duePayments.map(p => p.branch_id)])];
        
        const branches = await base44.asServiceRole.entities.Branch.filter({
            id: { $in: branchIds }
        });
        
        const branchMap = new Map(branches.map(b => [b.id, b.branch_name]));
        
        return Response.json({
            overdue: overduePayments.map(p => ({ id: p.id, branch: branchMap.get(p.branch_id), date: p.overdue_reminder_sent_date })),
            due: duePayments.map(p => ({ id: p.id, branch: branchMap.get(p.branch_id), date: p.due_date_reminder_sent_date }))
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});