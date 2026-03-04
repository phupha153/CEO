import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        async function fetchAll(entity, filter) {
            let allData = [];
            let skip = 0;
            while (true) {
                const batch = await entity.filter(filter, '', 1000, skip);
                if (!batch || batch.length === 0) break;
                allData = allData.concat(batch);
                skip += batch.length;
                if (batch.length < 1000) break;
            }
            return allData;
        }

        // Fetch payments with due_date 2026-03-05
        const sentPayments = await fetchAll(base44.asServiceRole.entities.Payment, {
            due_date: "2026-03-05"
        });
        
        // Filter those marked as sent
        const sentToday = sentPayments.filter(p => p.due_date_reminder_sent_date != null);
        
        const tenantIds = [...new Set(sentToday.map(p => p.tenant_id))];
        const roomIds = [...new Set(sentToday.map(p => p.room_id))];
        
        const tenants = await Promise.all(tenantIds.map(id => base44.asServiceRole.entities.Tenant.get(id).catch(() => null)));
        const rooms = await Promise.all(roomIds.map(id => base44.asServiceRole.entities.Room.get(id).catch(() => null)));
        const branches = await base44.asServiceRole.entities.Branch.list();
        
        const tenantMap = new Map(tenants.filter(Boolean).map(t => [t.id, t]));
        const roomMap = new Map(rooms.filter(Boolean).map(r => [r.id, r]));
        const branchMap = new Map(branches.filter(Boolean).map(b => [b.id, b]));
        
        // Determine which ones actually failed (because they have invalid line IDs but were marked sent)
        const actuallyFailed = sentToday.filter(p => {
            const tenant = tenantMap.get(p.tenant_id);
            if (!tenant) return true;
            if (!tenant.line_user_id || typeof tenant.line_user_id !== 'string' || !tenant.line_user_id.startsWith('U')) {
                return true;
            }
            return false;
        });
        
        const results = actuallyFailed.map(p => {
            const tenant = tenantMap.get(p.tenant_id);
            const room = roomMap.get(p.room_id);
            const branch = branchMap.get(p.branch_id);
            
            return {
                branch: branch?.branch_name || p.branch_id,
                room: room?.room_number || "N/A",
                tenant_name: tenant?.full_name || "N/A",
                line_id: tenant?.line_user_id || "N/A"
            };
        });

        // Get unique tenants to reduce duplicates
        const uniqueResults = [];
        const seen = new Set();
        results.forEach(r => {
            const key = `${r.branch}-${r.room}-${r.tenant_name}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueResults.push(r);
            }
        });

        return Response.json({
            markedAsSent: sentToday.length,
            actuallyFailedCount: uniqueResults.length,
            details: uniqueResults.slice(0, 35)
        });
        
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});