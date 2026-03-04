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

        // Fetch all pending payments
        const pendingPayments = await fetchAll(base44.asServiceRole.entities.Payment, {
            status: "pending"
        });
        
        // Filter by due_date containing 2026-03-05
        const todaysPayments = pendingPayments.filter(p => p.due_date && p.due_date.includes("2026-03-05"));
        
        const failedPayments = todaysPayments.filter(p => !p.due_date_reminder_sent_date);
        
        const tenantIds = [...new Set(failedPayments.map(p => p.tenant_id))];
        const roomIds = [...new Set(failedPayments.map(p => p.room_id))];
        
        const tenants = await Promise.all(tenantIds.map(id => base44.asServiceRole.entities.Tenant.get(id).catch(() => null)));
        const rooms = await Promise.all(roomIds.map(id => base44.asServiceRole.entities.Room.get(id).catch(() => null)));
        const branches = await base44.asServiceRole.entities.Branch.list();
        
        const tenantMap = new Map(tenants.filter(Boolean).map(t => [t.id, t]));
        const roomMap = new Map(rooms.filter(Boolean).map(r => [r.id, r]));
        const branchMap = new Map(branches.filter(Boolean).map(b => [b.id, b]));
        
        const results = failedPayments.map(p => {
            const tenant = tenantMap.get(p.tenant_id);
            const room = roomMap.get(p.room_id);
            const branch = branchMap.get(p.branch_id);
            
            let issues = [];
            let validLine = true;
            let validFb = true;
            
            if (!tenant) {
                issues.push("ไม่มีข้อมูลผู้เช่า");
                validLine = false;
                validFb = false;
            } else {
                if (!tenant.line_user_id || typeof tenant.line_user_id !== 'string' || tenant.line_user_id.trim() === '') {
                    issues.push("ไม่มี/Invalid LINE ID");
                    validLine = false;
                }
                if (!tenant.facebook_user_id || typeof tenant.facebook_user_id !== 'string' || tenant.facebook_user_id.trim() === '') {
                    issues.push("ไม่มี/Invalid Facebook ID");
                    validFb = false;
                }
            }
            
            return {
                payment_id: p.id,
                branch: branch?.branch_name || p.branch_id,
                room: room?.room_number || "N/A",
                tenant_name: tenant?.full_name || "N/A",
                issues: issues.join(", ")
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
            pendingCount: pendingPayments.length,
            todaysCount: todaysPayments.length,
            failedCount: failedPayments.length,
            uniqueFailed: uniqueResults.length,
            details: uniqueResults.slice(0, 35)
        });
        
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});