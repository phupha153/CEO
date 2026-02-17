import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { branch_id } = await req.json();

    if (!branch_id) {
      return Response.json({ error: 'branch_id required' }, { status: 400 });
    }

    // ดึงมิเตอร์ทั้งหมดในสาขา
    const allMeters = await base44.asServiceRole.entities.MeterReading.filter(
      { branch_id: branch_id }, 
      '', 
      10000
    );

    if (!allMeters || allMeters.length === 0) {
      return Response.json({ message: 'ไม่มีข้อมูลมิเตอร์', deletedCount: 0 });
    }

    // ดึงห้องทั้งหมดในสาขา
    const rooms = await base44.asServiceRole.entities.Room.filter(
      { branch_id: branch_id },
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

    return Response.json({
      success: true,
      branchId: branch_id,
      totalMeters: allMeters.length,
      validRooms: validRoomIds.size,
      orphanMeters: orphanMeters.length,
      deletedCount: deletedCount,
      message: `✅ ลบข้อมูลมิเตอร์ของห้องที่ลบแล้ว ${deletedCount} รายการ`
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});