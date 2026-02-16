import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branch_id } = await req.json();

    if (!branch_id) {
      return Response.json({ error: 'branch_id is required' }, { status: 400 });
    }

    // ตั้งค่า flag สำหรับยกเลิก (เก็บใน Deno.env หรือ memory)
    // ใช้ key ที่ unique เพื่อให้ deleteTestDataForBranch เช็คได้
    const cancelKey = `DELETE_CANCEL_${branch_id}`;
    
    // บันทึกลงไป (ใช้ temp storage)
    globalThis.deleteCancellations = globalThis.deleteCancellations || {};
    globalThis.deleteCancellations[cancelKey] = true;

    console.log(`⏸️ Cancel flag set for branch: ${branch_id}`);

    return Response.json({
      success: true,
      message: 'ยกเลิกการลบแล้ว'
    });
  } catch (error) {
    console.error('❌ Error:', error.message);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});