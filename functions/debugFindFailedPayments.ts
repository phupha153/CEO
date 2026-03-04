import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Find the latest function log for overdue reminders as well
        const dueLogs = await base44.asServiceRole.entities.FunctionLog.filter({
            function_name: "sendDueDateReminders"
        }, '-run_timestamp', 5);
        
        const overdueLogs = await base44.asServiceRole.entities.FunctionLog.filter({
            function_name: "sendAutomatedOverdueReminders"
        }, '-run_timestamp', 5);
        
        return Response.json({
            dueLogs: dueLogs.map(l => ({
                id: l.id,
                time: l.run_timestamp,
                status: l.status,
                sent: l.total_sent,
                failed: l.total_failed,
                errors: l.details?.errors
            })),
            overdueLogs: overdueLogs.map(l => ({
                id: l.id,
                time: l.run_timestamp,
                status: l.status,
                sent: l.total_sent,
                failed: l.total_failed,
                errors: l.details?.errors
            }))
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});