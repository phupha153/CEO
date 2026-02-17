import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();
    
    if (event.type !== 'delete') {
      return Response.json({ error: 'Only delete events are supported' }, { status: 400 });
    }

    const roomId = event.entity_id;
    
    // ลบ MeterReading ทั้งหมดที่เกี่ยวข้องกับห้องนี้
    const meterReadings = await base44.asServiceRole.entities.MeterReading.filter({ room_id: roomId }, '', 1000);
    
    if (meterReadings && meterReadings.length > 0) {
      for (const reading of meterReadings) {
        await base44.asServiceRole.entities.MeterReading.delete(reading.id);
      }
      console.log(`✅ ลบ ${meterReadings.length} บันทึกมิเตอร์สำหรับห้อง ${roomId}`);
    }

    return Response.json({ success: true, deletedCount: meterReadings?.length || 0 });
  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});