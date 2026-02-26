import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branch_id, new_owner_email, old_owner_email } = await req.json();

    // ✅ Validation
    if (!branch_id || !new_owner_email || !old_owner_email) {
      return Response.json({ 
        error: 'Missing required fields: branch_id, new_owner_email, old_owner_email' 
      }, { status: 400 });
    }

    // ⛔ ป้องกันการ transfer ให้ตัวเอง
    if (new_owner_email === old_owner_email) {
      return Response.json({ 
        error: 'ไม่สามารถโอนให้ตัวเองได้' 
      }, { status: 400 });
    }

    // 🔒 SECURITY: เฉพาะเจ้าของสาขาเท่านั้นที่ transfer ได้
    const branch = await base44.asServiceRole.entities.Branch.filter({ id: branch_id });
    if (!branch || branch.length === 0) {
      return Response.json({ error: 'ไม่พบสาขา' }, { status: 404 });
    }

    const branchData = branch[0];
    if (branchData.owner_id !== old_owner_email && branchData.created_by !== old_owner_email) {
      return Response.json({ 
        error: 'คุณไม่ใช่เจ้าของสาขานี้' 
      }, { status: 403 });
    }

    // ✅ ดึงข้อมูล Users และ สาขาที่เจ้าของเดิมถืออยู่ (เพื่อป้องกันสิทธิ์หาย)
    const [oldOwnerData, newOwnerData, oldOwnedBranches] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ email: old_owner_email }),
      base44.asServiceRole.entities.User.filter({ email: new_owner_email }),
      base44.asServiceRole.entities.Branch.filter({ owner_id: old_owner_email })
    ]);

    if (!oldOwnerData || oldOwnerData.length === 0) {
      return Response.json({ error: 'ไม่พบข้อมูลเจ้าของเก่า' }, { status: 404 });
    }

    if (!newOwnerData || newOwnerData.length === 0) {
      return Response.json({ error: 'ไม่พบข้อมูลเจ้าของใหม่' }, { status: 404 });
    }

    const oldOwner = oldOwnerData[0];
    const newOwner = newOwnerData[0];

    // ✅ Prepare accessible_branches for New Owner (only if they are in explicit mode)
    // If null/undefined, they are in implicit mode (owner access), so no need to update as they will own the branch.
    let newOwnerPackageData = {
      plan_status: oldOwner.plan_status || 'trial',
      trial_ends_at: oldOwner.trial_ends_at || null,
      subscription_end_date: oldOwner.subscription_end_date || null,
      package_id: oldOwner.package_id || null,
      package_name: oldOwner.package_name || null,
      custom_role: 'owner'
    };

    if (newOwner.accessible_branches && Array.isArray(newOwner.accessible_branches)) {
      const branches = [...newOwner.accessible_branches];
      if (!branches.includes(branch_id)) {
        branches.push(branch_id);
      }
      newOwnerPackageData.accessible_branches = branches;
    }

    // ⚡ STEP 2: Update new owner with package data
    await base44.asServiceRole.entities.User.update(newOwner.id, newOwnerPackageData);

    // 🏢 STEP 3: Update Branch owner_id
    await base44.asServiceRole.entities.Branch.update(branch_id, {
      owner_id: new_owner_email
    });

    // ✅ Prepare accessible_branches for Old Owner
    // We must ensure they keep access to the transferred branch (as manager)
    // AND keep access to other branches they owned (by making it explicit)
    let oldOwnerBranches = [];
    
    if (oldOwner.accessible_branches && Array.isArray(oldOwner.accessible_branches)) {
      oldOwnerBranches = [...oldOwner.accessible_branches];
    } else {
      // If null, they were relying on ownership. Convert all owned branches to explicit list.
      // This list includes the current branch_id (since we queried before update)
      oldOwnerBranches = (oldOwnedBranches || []).map(b => b.id);
    }

    if (!oldOwnerBranches.includes(branch_id)) {
      oldOwnerBranches.push(branch_id);
    }

    // 👔 STEP 4: Downgrade old owner to manager but keep access
    await base44.asServiceRole.entities.User.update(oldOwner.id, {
      custom_role: 'manager',
      plan_status: null,
      trial_ends_at: null,
      subscription_end_date: null,
      package_id: null,
      package_name: null,
      accessible_branches: oldOwnerBranches
    });

    // 🔗 STEP 5: Sync roles to CRM
    try {
      // ✅ Sync old owner → manager
      await base44.asServiceRole.functions.invoke('sendEmployeeToCRM', {
        employee_email: old_owner_email,
        employee_name: oldOwner.full_name,
        role: 'manager'
      });

      // ✅ Sync new owner → owner
      await base44.asServiceRole.functions.invoke('sendEmployeeToCRM', {
        employee_email: new_owner_email,
        employee_name: newOwner.full_name,
        role: 'owner'
      });

      console.log('✅ Synced roles to CRM successfully');
    } catch (crmError) {
      console.warn('⚠️ CRM sync warning (non-blocking):', crmError.message);
      // Non-blocking - transfer already successful, CRM sync failed
    }

    return Response.json({
      success: true,
      message: 'โอนกรรมสิทธิ์สำเร็จ',
      new_owner: new_owner_email,
      old_owner: old_owner_email,
      branch_name: branchData.branch_name
    });

  } catch (error) {
    console.error('❌ Transfer Ownership Error:', error);
    return Response.json({ 
      error: error.message || 'เกิดข้อผิดพลาดในการโอนกรรมสิทธิ์' 
    }, { status: 500 });
  }
});