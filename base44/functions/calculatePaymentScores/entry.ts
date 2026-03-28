import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import { differenceInDays, parseISO } from 'npm:date-fns@3.6.0';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  const user = await base44.auth.me();
  const serviceRoleKey = Deno.env.get('BASE44_SERVICE_ROLE_KEY');
  const requestServiceRoleKey = req.headers.get('x-service-role-token') || req.headers.get('authorization')?.replace('Bearer ', '');
  const isServiceRole = serviceRoleKey && requestServiceRoleKey === serviceRoleKey;

  if (!user && !isServiceRole) {
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
    const daysDiff = differenceInDays(paymentDate, dueDate); // บวก = ชำระช้า, ลบ = ชำระก่อนกำหนด

    let score = 5; // คะแนนฐาน
    if (daysDiff <= -7) {
      score = 10; // ชำระก่อนกำหนด 7+ วัน
    } else if (daysDiff <= -3) {
      score = 9; // ชำระก่อนกำหนด 3-6 วัน
    } else if (daysDiff <= -1) {
      score = 8; // ชำระก่อนกำหนด 1-2 วัน
    } else if (daysDiff === 0) {
      score = 7; // ชำระตรงเวลา
    } else if (daysDiff <= 3) {
      score = 5; // ชำระช้า 1-3 วัน
    } else if (daysDiff <= 7) {
      score = 3; // ชำระช้า 4-7 วัน
    } else if (daysDiff <= 14) {
      score = 2; // ชำระช้า 8-14 วัน
    } else {
      score = 1; // ชำระช้า 14+ วัน
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