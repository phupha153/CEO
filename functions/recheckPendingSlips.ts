import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { room_id, branch_id } = await req.json();

    if (!room_id || !branch_id) {
      return Response.json({ error: 'Missing room_id or branch_id' }, { status: 400 });
    }

    // ดึง pending/overdue payments ของห้องนี้
    const pendingPayments = await base44.entities.Payment.filter(
      { room_id, branch_id, status: 'pending' },
      '-created_date',
      100
    );

    const overduePayments = await base44.entities.Payment.filter(
      { room_id, branch_id, status: 'overdue' },
      '-created_date',
      100
    );

    const allPayments = [...pendingPayments, ...overduePayments];

    if (allPayments.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'ไม่มีบิลรอตรวจสอบ',
        checked: 0,
        verified: 0,
        failed: 0
      });
    }

    // Loop เรียก verifySlip สำหรับแต่ละบิล
    let verified = 0;
    let failed = 0;
    const results = [];

    for (const payment of allPayments) {
      try {
        const verifyResult = await base44.functions.invoke('verifySlip', {
          payment_id: payment.id
        });

        if (verifyResult.data.success) {
          verified++;
          results.push({ payment_id: payment.id, status: 'verified' });
        } else {
          failed++;
          results.push({ payment_id: payment.id, status: 'failed', message: verifyResult.data.message });
        }
      } catch (error) {
        failed++;
        results.push({ payment_id: payment.id, status: 'error', message: error.message });
      }
    }

    return Response.json({
      success: true,
      message: `ตรวจสอบสลิป ${allPayments.length} รายการ - สำเร็จ ${verified}, ล้มเหลว ${failed}`,
      checked: allPayments.length,
      verified,
      failed,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});