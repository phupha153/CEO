import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Find the latest function log to get the failed list
        const logs = await base44.asServiceRole.entities.FunctionLog.filter({
            function_name: "sendDueDateReminders"
        }, '-run_timestamp', 1);
        
        if (logs.length > 0 && logs[0].details && logs[0].details.errors) {
            const errors = logs[0].details.errors;
            return Response.json({
                total_failed: errors.length,
                errors: errors
            });
        }
        
        return Response.json({ message: "No recent errors found" });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});