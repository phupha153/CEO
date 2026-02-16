import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = user.custom_role || (user.role === 'admin' ? 'developer' : 'employee');

    // 🔒 SECURITY: เฉพาะ owner/developer สร้างสาขาได้
    if (userRole !== 'owner' && userRole !== 'developer') {
      return Response.json({ 
        error: 'Permission denied - Only owners can create branches' 
      }, { status: 403 });
    }

    const body = await req.json();
    const { branchData, billSettings } = body;

    if (!branchData || !branchData.branch_name) {
      return Response.json({ error: 'branch_name is required' }, { status: 400 });
    }

    // ตรวจสอบ branch_code ซ้ำ
    if (branchData.branch_code) {
      const existing = await base44.asServiceRole.entities.Branch.filter({ 
        branch_code: branchData.branch_code 
      });
      if (existing && existing.length > 0) {
        return Response.json({ 
          error: `รหัสสาขา "${branchData.branch_code}" มีอยู่แล้ว` 
        }, { status: 400 });
      }
    }

    // ✅ สร้างสาขา
    const newBranch = await base44.asServiceRole.entities.Branch.create({
      ...branchData,
      owner_id: user.email
    });

    console.log('✅ Branch created:', newBranch.id);

    // ✅ สร้าง Configs สำหรับสาขา (ถ้ามี)
    const configsToCreate = [];

    if (billSettings?.bill_generation_day) {
      configsToCreate.push({
        key: 'bill_generation_day',
        value: billSettings.bill_generation_day.toString(),
        value_type: 'number',
        description: 'วันที่สร้างบิลอัตโนมัติ',
        category: 'billing',
        branch_id: newBranch.id
      });
    }

    if (billSettings?.payment_due_day) {
      configsToCreate.push({
        key: 'pay_day',
        value: billSettings.payment_due_day.toString(),
        value_type: 'number',
        description: 'วันครบกำหนดชำระเงิน',
        category: 'billing',
        branch_id: newBranch.id
      });
    }

    if (branchData.branch_name) {
      configsToCreate.push({
        key: 'building_name',
        value: branchData.branch_name,
        value_type: 'string',
        description: 'ชื่อหอพัก',
        category: 'general',
        branch_id: newBranch.id
      });
    }

    if (branchData.address) {
      configsToCreate.push({
        key: 'building_address',
        value: branchData.address,
        value_type: 'string',
        description: 'ที่อยู่หอพัก',
        category: 'general',
        branch_id: newBranch.id
      });
    }

    if (branchData.phone) {
      configsToCreate.push({
        key: 'building_phone',
        value: branchData.phone,
        value_type: 'string',
        description: 'เบอร์โทรหอพัก',
        category: 'general',
        branch_id: newBranch.id
      });
    }

    if (branchData.manager_name) {
      configsToCreate.push({
        key: 'building_manager',
        value: branchData.manager_name,
        value_type: 'string',
        description: 'ผู้ดูแลหอพัก',
        category: 'general',
        branch_id: newBranch.id
      });
    }

    if (configsToCreate.length > 0) {
      await base44.asServiceRole.entities.Config.bulkCreate(configsToCreate);
      console.log(`✅ Created ${configsToCreate.length} configs`);
    }

    // ✅ อัพเดท accessible_branches + custom_role ของ user
    try {
      const currentBranches = user.accessible_branches || [];
      const updatedBranches = [...currentBranches, newBranch.id];
      
      await base44.asServiceRole.entities.User.update(user.id, {
        accessible_branches: updatedBranches,
        custom_role: 'owner'
      });
      
      console.log('✅ Updated user accessible_branches');
    } catch (updateError) {
      console.error('⚠️ Failed to update user:', updateError.message);
    }

    return Response.json({ 
      success: true,
      data: newBranch
    });

  } catch (error) {
    console.error('createBranch error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});