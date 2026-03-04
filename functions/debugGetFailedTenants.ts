import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        async function fetchAll(entity, filter) {
            let allData = [];
            let skip = 0;
            while (true) {
                const batch = await entity.filter(filter, '-updated_date', 1000, skip);
                if (!batch || batch.length === 0) break;
                allData = allData.concat(batch);
                skip += batch.length;
                if (batch.length < 1000) break;
            }
            return allData;
        }

        // Fetch payments updated today
        const todaysDateStr = new Date().toISOString().split('T')[0];
        
        // We know the due date is 2026-03-05
        const sentPayments = await fetchAll(base44.asServiceRole.entities.Payment, {
            due_date: "2026-03-05"
        });
        
        // Target branches from user's request
        const targetBranches = [
            "6981d9b23463827c89cc00ac", "69a00e2512ad038e1ecf9114", "699abd9d0118b645d4ee6656",
            "69a01e2d612a2d2ba0dafe55", "69a0236b20c1db94046f605a", "69256957890d2b5aaaca1d3f",
            "6970bffac651e1f6e3209783", "695b3a5146c121b321b86353", "69491868c6af2dee50c43fd7",
            "693da66447a7f1b664be6201", "693db0145e63aac46ba45fb8", "692a0678ae3c1f2cf986a98d",
            "692eae1308315df66d99c351", "6925caf00750af157b6b965f", "69256055c04ce59ef19c3921",
            "69244bd68fdfb9f35eea9845", "69255a34e816a8749fc765c2", "69255c2783e83cc35d067944",
            "691f407445f49b3851eaffcb", "6922096c2d9cea2dc9f8ee3d", "691f411ffcbc37ff57916373",
            "691f394563b2f87300f88c96", "691f3947dd7064ab6876e609", "691f30f35bff74d683facdf9",
            "691f3295b3f52dbbf1f86365", "691f30d9e0293edafd607133", "690af1db7571c2f943928e59",
            "691cb6718db653c44f875069", "691f2f624dfac284c855b0fd", "690af1db7571c2f943928e58",
            "690aeedb2a90217536f9c258", "691f05cc4d91c7a398ac62b7", "692494febb27c2195cee254a",
            "69207b220649e86407c3ff3b", "69207b220649e86407c3ff38", "690aef1b15352cc31afccebc",
            "69207b220649e86407c3ff39", "69207b220649e86407c3ff3a", "69244bd66ce05e17311fc182",
            "691f338f6e064af05bdcabfe", "690af1db7571c2f943928e5a", "691f2f71dd7064ab6876dd1d"
        ];
        
        // Filter those marked as sent today
        const sentToday = sentPayments.filter(p => 
            p.due_date_reminder_sent_date && 
            p.due_date_reminder_sent_date.includes(todaysDateStr) &&
            targetBranches.includes(p.branch_id)
        );
        
        const tenantIds = [...new Set(sentToday.map(p => p.tenant_id))];
        const roomIds = [...new Set(sentToday.map(p => p.room_id))];
        
        const tenants = await Promise.all(tenantIds.map(id => base44.asServiceRole.entities.Tenant.get(id).catch(() => null)));
        const rooms = await Promise.all(roomIds.map(id => base44.asServiceRole.entities.Room.get(id).catch(() => null)));
        const branches = await base44.asServiceRole.entities.Branch.list();
        
        const tenantMap = new Map(tenants.filter(Boolean).map(t => [t.id, t]));
        const roomMap = new Map(rooms.filter(Boolean).map(r => [r.id, r]));
        const branchMap = new Map(branches.filter(Boolean).map(b => [b.id, b]));
        
        // Determine which ones actually failed
        const actuallyFailed = sentToday.filter(p => {
            const tenant = tenantMap.get(p.tenant_id);
            if (!tenant) return true;
            // Mark as failed if line_user_id is not exactly 33 chars or missing
            // Or if they don't have Facebook token
            return true; // Just get all 36 for inspection
        });
        
        const results = actuallyFailed.map(p => {
            const tenant = tenantMap.get(p.tenant_id);
            const room = roomMap.get(p.room_id);
            const branch = branchMap.get(p.branch_id);
            
            let issues = [];
            if (!tenant?.line_user_id || tenant.line_user_id.length !== 33) {
                issues.push("LINE ID ผิดรูปแบบ");
            }
            if (!tenant?.facebook_user_id) {
                issues.push("ไม่มี FB ID");
            }
            
            return {
                payment_id: p.id,
                branch: branch?.branch_name || p.branch_id,
                room: room?.room_number || "N/A",
                tenant_name: tenant?.full_name || "N/A",
                line_id: tenant?.line_user_id || "N/A",
                issues: issues.join(", ")
            };
        });

        // Sort by updated_date descending to see the latest 36
        results.sort((a, b) => {
            const pa = sentToday.find(x => x.id === a.payment_id);
            const pb = sentToday.find(x => x.id === b.payment_id);
            return new Date(pb.updated_date) - new Date(pa.updated_date);
        });

        return Response.json({
            markedAsSent: sentToday.length,
            latest36: results.slice(0, 36)
        });
        
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});