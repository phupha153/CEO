import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.text();
    const { branch_id } = body ? JSON.parse(body) : {};

    // ดึงสาขาทั้งหมด (ถ้าไม่ระบุ branch_id)
    const branches = branch_id 
      ? [{ id: branch_id }] 
      : await base44.asServiceRole.entities.Branch.list('', 10000);

    let totalDeleted = 0;
    const results = [];

    for (const branch of branches || []) {
      try {
        // ดึงมิเตอร์ทั้งหมดในสาขา
        const allMeters = await base44.asServiceRole.entities.MeterReading.filter(
          { branch_id: branch.id }, 
          '', 
          10000
        );

        if (!allMeters || allMeters.length === 0) continue;

        // ดึงห้องทั้งหมดในสาขา
        const rooms = await base44.asServiceRole.entities.Room.filter(
          { branch_id: branch.id },
          '',
          10000
        );

        const validRoomIds = new Set(rooms?.map(r => r.id) || []);

        // หา meter readings ของห้องที่ลบแล้ว
        const orphanMeters = allMeters.filter(m => !validRoomIds.has(m.room_id));

        // ลบทีละตัว
        let deletedCount = 0;
        for (const meter of orphanMeters) {
          await base44.asServiceRole.entities.MeterReading.delete(meter.id);
          deletedCount++;
        }

        totalDeleted += deletedCount;
        results.push({
          branchId: branch.id,
          deleted: deletedCount,
          status: 'success'
        });
      } catch (error) {
        results.push({
          branchId: branch.id,
          error: error.message,
          status: 'failed'
        });
      }
    }

    return Response.json({
      success: true,
      totalDeleted,
      branchResults: results,
      message: `✅ ลบข้อมูลมิเตอร์ของห้องที่ลบแล้ว ${totalDeleted} รายการทั้งหมด`
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});