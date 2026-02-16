import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branch_id } = await req.json();

    if (!branch_id) {
      return Response.json({ 
        success: false,
        error: 'กรุณาระบุ branch_id' 
      });
    }

    console.log('🔍 Creating ratings for branch:', branch_id);

    // ดึงผู้เช่าทั้งหมดในสาขานี้ที่มี payment_scores
    const tenants = await base44.asServiceRole.entities.Tenant.filter({ 
      branch_id,
      status: 'active'
    });

    console.log('👥 Found tenants:', tenants.length);

    let createdCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const tenant of tenants) {
      try {
        const paymentScores = tenant.payment_scores || [];
        const avgScore = tenant.avg_payment_score;

        // ถ้าไม่มี payment_scores หรือ avg_payment_score ข้าม
        if (paymentScores.length === 0 || !avgScore) {
          skippedCount++;
          continue;
        }

        // เช็คว่ามี TenantRating อยู่แล้วหรือยัง
        const existingRatings = await base44.asServiceRole.entities.TenantRating.filter({
          tenant_id: tenant.id,
          branch_id
        });

        if (existingRatings.length > 0) {
          console.log(`⏭️ Tenant ${tenant.full_name} already has ratings - skipping`);
          skippedCount++;
          continue;
        }

        // สร้าง TenantRating ใหม่
        await base44.asServiceRole.entities.TenantRating.create({
          tenant_id: tenant.id,
          branch_id: branch_id,
          rating_date: new Date().toISOString().split('T')[0],
          rated_by: 'System',
          payment_score: avgScore,
          property_care_score: 7.0, // ค่าเริ่มต้น
          cohabitation_score: 7.0, // ค่าเริ่มต้น
          overall_rating_stars: Math.min(5, Math.round((avgScore + 7 + 7) / 3 / 2)), // เฉลี่ยแล้วแปลงเป็น 0-5
          overall_rating_text: avgScore >= 8 ? 'ดีเยี่ยม' : avgScore >= 6 ? 'ดี' : 'พอใช้',
          notes: `สร้างอัตโนมัติจาก payment_scores (${paymentScores.length} รายการ)`,
          rating_period: `${new Date().getFullYear()}`
        });

        console.log(`✅ Created rating for tenant: ${tenant.full_name}`);
        createdCount++;

      } catch (error) {
        console.error(`❌ Error creating rating for tenant ${tenant.id}:`, error);
        errors.push({
          tenant_id: tenant.id,
          tenant_name: tenant.full_name,
          error: error.message
        });
      }
    }

    console.log(`✅ Created ${createdCount} ratings, skipped ${skippedCount}, errors ${errors.length}`);

    return Response.json({
      success: true,
      created: createdCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `สร้าง TenantRating สำเร็จ ${createdCount} รายการ`
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});