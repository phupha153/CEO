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

        const payments = await fetchAll(base44.asServiceRole.entities.Payment, {
            due_date: "2026-03-05",
            status: "pending"
        });
        
        const overduePayments = await fetchAll(base44.asServiceRole.entities.Payment, {
            due_date: "2026-03-05",
            status: "overdue"
        });
        
        const allPayments = [...payments, ...overduePayments];
        
        // Target branches from the user's log
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
        
        const branchPayments = allPayments.filter(p => targetBranches.includes(p.branch_id));
        
        // Those that failed didn't get their date updated
        const failedPayments = branchPayments.filter(p => !p.due_date_reminder_sent_date);
        
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
            
            // Only output if they have some issue or if they have BOTH invalid. Wait, if they have an invalid LINE ID but a valid Facebook, 
            // and it failed, then Facebook token is missing.
            
            return {
                branch: branch?.branch_name || p.branch_id,
                room: room?.room_number || "N/A",
                tenant_name: tenant?.full_name || "N/A",
                line_id: tenant?.line_user_id || "N/A",
                facebook_id: tenant?.facebook_user_id || "N/A",
                issues: issues.join(", ")
            };
        });

        return Response.json({
            totalFound: failedPayments.length,
            details: results
        });
        
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});