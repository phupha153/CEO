import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Get all branches and users
    const branches = await base44.asServiceRole.entities.Branch.list('-created_date', 10000);
    const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 10000);
    
    let updatedCount = 0;
    const results = [];

    for (const branch of branches) {
      // Skip if already has owner_id
      if (branch.owner_id) {
        results.push({
          branch_id: branch.id,
          branch_name: branch.branch_name,
          status: 'skipped',
          reason: 'already has owner_id'
        });
        continue;
      }

      // Find owner by checking user's accessible_branches and role
      let ownerId = null;
      
      for (const checkUser of allUsers) {
        const accessibleBranches = checkUser.accessible_branches || [];
        const userRole = checkUser.custom_role || (checkUser.role === 'admin' ? 'owner' : 'employee');
        
        // ถ้า user มีสาขานี้ใน accessible_branches และเป็น owner
        if (accessibleBranches.includes(branch.id) && userRole === 'owner') {
          ownerId = checkUser.email;
          break;
        }
      }

      // Fallback: ใช้ created_by ถ้าหาไม่เจอ
      if (!ownerId && branch.created_by) {
        ownerId = branch.created_by;
      }

      if (!ownerId) {
        results.push({
          branch_id: branch.id,
          branch_name: branch.branch_name,
          status: 'failed',
          reason: 'no owner found'
        });
        continue;
      }

      await base44.asServiceRole.entities.Branch.update(branch.id, {
        owner_id: ownerId
      });

      updatedCount++;
      results.push({
        branch_id: branch.id,
        branch_name: branch.branch_name,
        status: 'updated',
        owner_id: ownerId,
        method: branch.created_by === ownerId ? 'created_by' : 'accessible_branches'
      });
    }

    return Response.json({
      success: true,
      message: `Migration completed: ${updatedCount} branches updated`,
      total_branches: branches.length,
      updated_count: updatedCount,
      results
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});