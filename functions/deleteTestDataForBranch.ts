import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branch_id } = await req.json();

    if (!branch_id) {
      return Response.json({ error: 'branch_id is required' }, { status: 400 });
    }

    // ⭐ Admin only check (ไม่ให้ user ธรรมชาติลบข้อมูลของสาขา)
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Only admins can delete branch data' }, { status: 403 });
    }

    console.log(`🗑️ Deleting ALL test data for branch: ${branch_id}`);

    let totalDeleted = 0;

    // ลบข้อมูลต่างๆตามลำดับความสำคัญ
    const entitiesToDelete = [
      'MaintenanceRequest',
      'Payment',
      'MeterReading',
      'Expense',
      'Booking',
      'Tenant',
      'Room'
    ];

    for (const entityName of entitiesToDelete) {
      try {
        console.log(`📦 Deleting ${entityName}...`);
        const response = await base44.asServiceRole.functions.invoke('deletePaymentsByBranch', {
          branch_id,
          entity_name: entityName,
          batchSize: 1000
        });
        
        const deleted = response.data?.totalDeleted || 0;
        totalDeleted += deleted;
        console.log(`✅ Deleted ${deleted} ${entityName} records`);
      } catch (error) {
        console.warn(`⚠️ Error deleting ${entityName}:`, error.message);
      }
    }

    console.log(`✅ Completed deletion - Total records deleted: ${totalDeleted}`);

    return Response.json({
      success: true,
      totalDeleted,
      message: `ลบข้อมูลของสาขานี้สำเร็จ! ลบไปทั้งหมด ${totalDeleted} รายการ`
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});