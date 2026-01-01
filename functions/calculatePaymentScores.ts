import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { differenceInDays, parseISO } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tenant_id } = await req.json();

  if (!tenant_id) {
    return Response.json({ error: 'Missing tenant_id' }, { status: 400 });
  }

  const tenant = await base44.entities.Tenant.filter({ id: tenant_id }, '', 1);
  if (!tenant || tenant.length === 0) {
    return Response.json({ error: 'Tenant not found' }, { status: 404 });
  }

  const tenantData = tenant[0];

  // ดึงการชำระเงินทั้งหมดที่ชำระแล้ว
  const payments = await base44.entities.Payment.filter({
    tenant_id: tenant_id,
    status: 'paid'
  });

  const paymentScores = [];

  for (const payment of payments) {
    if (!payment.payment_date || !payment.due_date) continue;

    const paymentDate = parseISO(payment.payment_date);
    const dueDate = parseISO(payment.due_date);
    const daysDiff = differenceInDays(paymentDate, dueDate);

    let score = 10;
    if (daysDiff > 0) {
      // ชำระล่าช้า
      if (daysDiff <= 3) score = 8;
      else if (daysDiff <= 7) score = 6;
      else if (daysDiff <= 14) score = 4;
      else if (daysDiff <= 30) score = 2;
      else score = 0;
    } else if (daysDiff < -7) {
      // ชำระล่วงหน้ามาก
      score = 10;
    }

    paymentScores.push({
      payment_id: payment.id,
      score: score,
      payment_date: payment.payment_date,
      due_date: payment.due_date,
      days_diff: daysDiff
    });
  }

  // คำนวณค่าเฉลี่ย
  const avgScore = paymentScores.length > 0
    ? paymentScores.reduce((sum, s) => sum + s.score, 0) / paymentScores.length
    : 0;

  // อัปเดต Tenant
  await base44.entities.Tenant.update(tenant_id, {
    payment_scores: paymentScores,
    avg_payment_score: Math.round(avgScore * 10) / 10
  });

  return Response.json({
    success: true,
    tenant_id: tenant_id,
    payment_scores: paymentScores,
    avg_payment_score: Math.round(avgScore * 10) / 10,
    total_payments: payments.length
  });
});