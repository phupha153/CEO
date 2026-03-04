import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Fetch all payments with due date 2026-03-05
        const payments = await base44.asServiceRole.entities.Payment.filter({
            due_date: "2026-03-05"
        }, "", 1000);
        
        // Fetch overdue payments for the same date just in case
        const overduePayments = await base44.asServiceRole.entities.Payment.filter({
            due_date: "2026-03-05",
            status: "overdue"
        }, "", 1000);
        
        const allPayments = [...payments, ...overduePayments];
        
        // Filter payments that didn't get the reminder sent
        const failedPayments = allPayments.filter(p => !p.due_date_reminder_sent_date && (p.status === 'pending' || p.status === 'overdue'));
        
        // Fetch related tenants and rooms
        const tenantIds = [...new Set(failedPayments.map(p => p.tenant_id))];
        const roomIds = [...new Set(failedPayments.map(p => p.room_id))];
        
        const tenants = await Promise.all(tenantIds.map(id => base44.asServiceRole.entities.Tenant.get(id).catch(() => null)));
        const rooms = await Promise.all(roomIds.map(id => base44.asServiceRole.entities.Room.get(id).catch(() => null)));
        
        const tenantMap = new Map(tenants.filter(Boolean).map(t => [t.id, t]));
        const roomMap = new Map(rooms.filter(Boolean).map(r => [r.id, r]));
        
        const results = failedPayments.map(p => {
            const tenant = tenantMap.get(p.tenant_id);
            const room = roomMap.get(p.room_id);
            
            let issue = [];
            if (!tenant) issue.push("ไม่มีข้อมูลผู้เช่า (Tenant Not Found)");
            else {
                if (!tenant.line_user_id) issue.push("ไม่มี LINE User ID");
                if (!tenant.facebook_user_id) issue.push("ไม่มี Facebook User ID");
            }
            
            return {
                room: room?.room_number || "N/A",
                tenant_name: tenant?.full_name || "N/A",
                line_id: tenant?.line_id || "N/A",
                has_line_user_id: !!tenant?.line_user_id,
                has_facebook_user_id: !!tenant?.facebook_user_id,
                issues: issue.join(", ")
            };
        });
        
        // Group by issue
        const grouped = {
            noLineOrFb: results.filter(r => !r.has_line_user_id && !r.has_facebook_user_id),
            hasLineButFailed: results.filter(r => r.has_line_user_id),
            hasFbButFailed: results.filter(r => r.has_facebook_user_id),
        };

        return Response.json({
            totalFailed: failedPayments.length,
            details: grouped
        });
        
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});