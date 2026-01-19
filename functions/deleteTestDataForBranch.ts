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

    // ⭐ Admin/Developer only check
    const isDeveloper = user.role === 'admin' || user.custom_role === 'developer';
    if (!isDeveloper) {
      return Response.json({ error: 'Forbidden: Only admins/developers can delete branch data' }, { status: 403 });
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
        
        // ลบทีละ batch เพื่อไม่ให้โอเวอร์โหลด
        let hasMore = true;
        let batchDeleted = 0;
        const cancelKey = `DELETE_CANCEL_${branch_id}`;
        
        while (hasMore) {
          // ⏸️ เช็คว่าถูกยกเลิกหรือไม่
          if (globalThis.deleteCancellations?.[cancelKey]) {
            console.log(`⏸️ Deletion cancelled for branch: ${branch_id}`);
            delete globalThis.deleteCancellations[cancelKey];
            return Response.json({
              success: true,
              totalDeleted,
              cancelled: true,
              message: `ยกเลิกการลบแล้ว ลบได้ ${totalDeleted} รายการ`
            });
          }

          const records = await base44.asServiceRole.entities[entityName].filter(
            { branch_id },
            '-created_date',
            1000
          );
          
          if (records.length === 0) {
            hasMore = false;
            break;
          }
          
          // ลบทีละรายการ
          for (const record of records) {
            try {
              await base44.asServiceRole.entities[entityName].delete(record.id);
              batchDeleted++;
            } catch (err) {
              console.warn(`⚠️ Error deleting ${entityName} ${record.id}:`, err.message);
            }
          }
        }
        
        totalDeleted += batchDeleted;
        console.log(`✅ Deleted ${batchDeleted} ${entityName} records`);
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