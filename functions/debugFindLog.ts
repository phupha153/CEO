import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Let's get the 10 most recently updated payments with due_date_reminder_sent_date
        const duePayments = await base44.asServiceRole.entities.Payment.filter({}, '-due_date_reminder_sent_date', 10);
        
        // Let's get the 10 most recently updated payments with overdue_reminder_sent_date
        const overduePayments = await base44.asServiceRole.entities.Payment.filter({}, '-overdue_reminder_sent_date', 10);
        
        const branchIds = [...new Set([...overduePayments.map(p => p.branch_id), ...duePayments.map(p => p.branch_id)])].filter(Boolean);
        const tenantIds = [...new Set([...overduePayments.map(p => p.tenant_id), ...duePayments.map(p => p.tenant_id)])].filter(Boolean);
        const roomIds = [...new Set([...overduePayments.map(p => p.room_id), ...duePayments.map(p => p.room_id)])].filter(Boolean);
        
        const branches = await base44.asServiceRole.entities.Branch.filter({ id: { $in: branchIds } });
        const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: { $in: tenantIds } });
        const rooms = await base44.asServiceRole.entities.Room.filter({ id: { $in: roomIds } });
        
        const branchMap = new Map(branches.map(b => [b.id, b.branch_name]));
        const tenantMap = new Map(tenants.map(t => [t.id, t.full_name]));
        const roomMap = new Map(rooms.map(r => [r.id, r.room_number]));
        
        return Response.json({
            due: duePayments.filter(p => p.due_date_reminder_sent_date).slice(0, 3).map(p => ({
                id: p.id,
                branch: branchMap.get(p.branch_id) || p.branch_id,
                tenant: tenantMap.get(p.tenant_id) || p.tenant_id,
                room: roomMap.get(p.room_id) || p.room_id,
                date: p.due_date_reminder_sent_date
            })),
            overdue: overduePayments.filter(p => p.overdue_reminder_sent_date).slice(0, 3).map(p => ({
                id: p.id,
                branch: branchMap.get(p.branch_id) || p.branch_id,
                tenant: tenantMap.get(p.tenant_id) || p.tenant_id,
                room: roomMap.get(p.room_id) || p.room_id,
                date: p.overdue_reminder_sent_date
            }))
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});