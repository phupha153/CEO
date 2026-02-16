import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  
  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { branch_id } = await req.json();

  console.log('🔄 Starting score recalculation for branch:', branch_id || 'ALL');

  // ดึง Tenants ทั้งหมด
  const filter = branch_id ? { branch_id } : {};
  const allTenants = await base44.asServiceRole.entities.Tenant.filter(filter, '-created_date', 5000);

  console.log(`👥 Found ${allTenants.length} tenants`);

  let successCount = 0;
  let errorCount = 0;
  const results = [];

  // ประมวลผลทีละ 5 คนเพื่อไม่ให้เกิน rate limit
  for (let i = 0; i < allTenants.length; i += 5) {
    const batch = allTenants.slice(i, i + 5);
    
    const batchPromises = batch.map(async (tenant) => {
      try {
        const response = await base44.asServiceRole.functions.invoke('calculatePaymentScores', {
          tenant_id: tenant.id
        });
        
        if (response.data?.success) {
          successCount++;
          return {
            tenant_id: tenant.id,
            tenant_name: tenant.full_name,
            avg_score: response.data.avg_payment_score,
            total_payments: response.data.total_payments,
            success: true
          };
        } else {
          errorCount++;
          return {
            tenant_id: tenant.id,
            tenant_name: tenant.full_name,
            success: false,
            error: 'No paid payments'
          };
        }
      } catch (error) {
        errorCount++;
        console.error(`Error for tenant ${tenant.id}:`, error.message);
        return {
          tenant_id: tenant.id,
          tenant_name: tenant.full_name,
          success: false,
          error: error.message
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    console.log(`✅ Batch ${Math.floor(i/5) + 1}/${Math.ceil(allTenants.length/5)} done (${successCount} success, ${errorCount} errors)`);
    
    // พักระหว่าง batch
    if (i + 5 < allTenants.length) {
      await delay(1000);
    }
  }

  return Response.json({
    success: true,
    message: `คำนวณคะแนนสำเร็จ ${successCount} คน${errorCount > 0 ? `, ข้ามไป ${errorCount} คน (ไม่มีประวัติชำระหรือ error)` : ''}`,
    total_processed: allTenants.length,
    success_count: successCount,
    error_count: errorCount,
    results: results.filter(r => r.success).slice(0, 10) // แสดงตัวอย่าง 10 คนแรก
  });
});