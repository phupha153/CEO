import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Find the latest function log for due reminders
        const dueLogs = await base44.asServiceRole.entities.FunctionLog.filter({
            function_name: "sendDueDateReminders"
        }, '-run_timestamp', 20);
        
        const errorLog = dueLogs.find(l => l.total_failed > 0);
        
        if (!errorLog) {
             return Response.json({ message: "No error log found" });
        }
        
        // Count frequencies of errors
        const errorCounts = {};
        (errorLog.details?.errors || []).forEach(err => {
            errorCounts[err] = (errorCounts[err] || 0) + 1;
        });
        
        return Response.json({
            id: errorLog.id,
            time: errorLog.run_timestamp,
            sent: errorLog.total_sent,
            failed: errorLog.total_failed,
            errorCounts: errorCounts,
            errors: errorLog.details?.errors?.slice(0, 10)
        });
        
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});