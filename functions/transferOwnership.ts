import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // ✅ ดึงข้อมูล Users
    const [oldOwnerData, newOwnerData] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ email: old_owner_email }),
      base44.asServiceRole.entities.User.filter({ email: new_owner_email })
    ]);

    if (!oldOwnerData || oldOwnerData.length === 0) {
      return Response.json({ error: 'ไม่พบข้อมูลเจ้าของเก่า' }, { status: 404 });
    }

    if (!newOwnerData || newOwnerData.length === 0) {
      return Response.json({ error: 'ไม่พบข้อมูลเจ้าของใหม่' }, { status: 404 });
    }

    const oldOwner = oldOwnerData[0];
    const newOwner = newOwnerData[0];

    // 📦 STEP 1: Copy Package Data (plan_status, trial_ends_at, subscription_end_date, package_id, package_name)
    const packageData = {
      plan_status: oldOwner.plan_status || 'trial',
      trial_ends_at: oldOwner.trial_ends_at || null,
      subscription_end_date: oldOwner.subscription_end_date || null,
      package_id: oldOwner.package_id || null,
      package_name: oldOwner.package_name || null,
      custom_role: 'owner'
    };

    // ⚡ STEP 2: Update new owner with package data
    await base44.asServiceRole.entities.User.update(newOwner.id, packageData);

    // 🏢 STEP 3: Update Branch owner_id
    await base44.asServiceRole.entities.Branch.update(branch_id, {
      owner_id: new_owner_email
    });

    // 📌 STEP 4: ไม่ต้องปรับคนเก่า - CRM จะ sync role อัตโนมัติ

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