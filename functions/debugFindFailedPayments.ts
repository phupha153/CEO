import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Find the latest function log for overdue reminders as well
        const logs = await base44.asServiceRole.entities.FunctionLog.filter({
            function_name: "sendAutomatedOverdueReminders"
        }, '-run_timestamp', 20);
        
        const errorLog = logs.find(l => l.total_failed > 0);
        
        if (!errorLog) {
             return Response.json({ message: "No error log found" });
        }
        
        // Filter out the unique error messages
        const uniqueErrors = [...new Set(errorLog.details?.errors || [])];
        
        return Response.json({
            id: errorLog.id,
            time: errorLog.run_timestamp,
            sent: errorLog.total_sent,
            failed: errorLog.total_failed,
            uniqueErrors: uniqueErrors
        });
        
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});