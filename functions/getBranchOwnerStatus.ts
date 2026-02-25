import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Authenticate user
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { branch_id } = await req.json();
        
        if (!branch_id) {
            return Response.json({ error: 'branch_id required' }, { status: 400 });
        }

        // Get branch info
        const branches = await base44.asServiceRole.entities.Branch.filter({ id: branch_id }, null, 1);
        if (!branches || branches.length === 0) {
            return Response.json({ error: 'Branch not found' }, { status: 404 });
        }

        const branch = branches[0];
        const ownerEmail = branch.owner_id;

        if (!ownerEmail) {
            return Response.json({ error: 'Branch has no owner' }, { status: 404 });
        }

        // Get owner's subscription status
        const users = await base44.asServiceRole.entities.User.filter({ email: ownerEmail }, null, 1);
        if (!users || users.length === 0) {
            return Response.json({ error: 'Owner not found' }, { status: 404 });
        }

        const owner = users[0];

        // ⚠️ CRITICAL: ต้องส่ง plan_status ที่แท้จริง ถ้าไม่มี = ไม่มีแพ็กเกจ (ไม่ให้ default 'trial')
        return Response.json({
            owner_email: owner.email,
            owner_name: owner.full_name,
            plan_status: owner.plan_status || null, // ⭐ FIX: ส่ง null ถ้าไม่มี (ไม่ใช่ 'trial')
            trial_ends_at: owner.trial_ends_at,
            subscription_end_date: owner.subscription_end_date,
            package_id: owner.package_id,
            package_name: owner.package_name,
            is_owner: user.email === owner.email
        });

    } catch (error) {
        console.error('getBranchOwnerStatus error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});