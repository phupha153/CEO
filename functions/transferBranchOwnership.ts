import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branch_id, new_owner_email, transfer_package } = await req.json();

    // Validation
    if (!branch_id || !new_owner_email) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 🔒 SECURITY: ดึงข้อมูลสาขาและตรวจสอบว่า user เป็นเจ้าของจริง
    const branch = await base44.asServiceRole.entities.Branch.get(branch_id);
    
    if (!branch) {
      return Response.json({ error: 'Branch not found' }, { status: 404 });
    }

    // เฉพาะเจ้าของสาขา (owner_id หรือ created_by) เท่านั้นที่โอนได้
    const isOwner = branch.owner_id === user.email || branch.created_by === user.email;
    const isDeveloper = user.role === 'admin';

    if (!isOwner && !isDeveloper) {
      return Response.json({ error: 'Forbidden: Only branch owner can transfer ownership' }, { status: 403 });
    }

    // ป้องกันโอนให้ตัวเอง
    if (new_owner_email === user.email) {
      return Response.json({ error: 'Cannot transfer to yourself' }, { status: 400 });
    }

    // ดึงข้อมูลเจ้าของเก่าและใหม่
    const [oldOwner, newOwnerUsers] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ email: user.email }),
      base44.asServiceRole.entities.User.filter({ email: new_owner_email })
    ]);

    let newOwner = newOwnerUsers?.[0];

    // ถ้าไม่มี user ใหม่ในระบบ → ส่งสัญญาณให้ frontend เชิญก่อน
    if (!newOwner) {
      return Response.json({ 
        error: 'User not found in system. Frontend should invite first.',
        user_not_found: true,
        should_invite: true,
        new_owner_email: new_owner_email
      }, { status: 404 });
    }

    const currentOldOwner = oldOwner?.[0];

    // 1️⃣ เปลี่ยน Branch.owner_id
    await base44.asServiceRole.entities.Branch.update(branch_id, {
      owner_id: new_owner_email
    });

    // 2️⃣ อัปเดตเจ้าของเก่า → Manager (เก็บสิทธิ์เข้าถึงสาขาไว้)
    if (currentOldOwner) {
      const oldOwnerBranches = currentOldOwner.accessible_branches || [];
      const updatedOldOwnerBranches = oldOwnerBranches.includes(branch_id) 
        ? oldOwnerBranches 
        : [...oldOwnerBranches, branch_id];

      await base44.asServiceRole.entities.User.update(currentOldOwner.id, {
        custom_role: 'manager',
        accessible_branches: updatedOldOwnerBranches
      });
    }

    // 3️⃣ อัปเดตเจ้าของใหม่ → Owner + ใส่สาขาใน accessible_branches
    const newOwnerBranches = newOwner.accessible_branches || [];
    const updatedNewOwnerBranches = newOwnerBranches.includes(branch_id)
      ? newOwnerBranches
      : [...newOwnerBranches, branch_id];

    await base44.asServiceRole.entities.User.update(newOwner.id, {
      custom_role: 'owner',
      accessible_branches: updatedNewOwnerBranches
    });

    // 4️⃣ โอนแพ็กเกจ (ถ้าเลือก)
    if (transfer_package && currentOldOwner) {
      const packageData = {
        plan_status: currentOldOwner.plan_status || null,
        package_id: currentOldOwner.package_id || null,
        package_name: currentOldOwner.package_name || null,
        trial_ends_at: currentOldOwner.trial_ends_at || null,
        subscription_end_date: currentOldOwner.subscription_end_date || null
      };

      // โอนแพ็กเกจไปเจ้าของใหม่
      await base44.asServiceRole.entities.User.update(newOwner.id, packageData);

      // ลบแพ็กเกจออกจากเจ้าของเก่า (reset เป็น trial ใหม่)
      await base44.asServiceRole.entities.User.update(currentOldOwner.id, {
        plan_status: null,
        package_id: null,
        package_name: null,
        trial_ends_at: null,
        subscription_end_date: null
      });
    }

    return Response.json({
      success: true,
      message: 'Transfer ownership successful',
      old_owner: user.email,
      new_owner: new_owner_email,
      branch_id,
      package_transferred: transfer_package || false,
      was_new_invite: false
    });

  } catch (error) {
    console.error('Transfer ownership error:', error);
    return Response.json({ 
      error: error.message || 'Transfer failed',
      details: error.toString()
    }, { status: 500 });
  }
});