import { createClient } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    console.log('=== getPackagesFromCRM Started ===');

    const crmAppId = Deno.env.get("CRM_APP_ID");
    const crmServiceRoleKey = Deno.env.get("CRM_SERVICE_ROLE_KEY");

    console.log('CRM_APP_ID:', crmAppId);
    console.log('Has CRM_SERVICE_ROLE_KEY:', !!crmServiceRoleKey);

    if (!crmAppId || !crmServiceRoleKey) {
      return Response.json({ 
        error: '❌ CRM_APP_ID หรือ CRM_SERVICE_ROLE_KEY ไม่ได้ตั้งค่า',
        packages: [],
        active_subscriptions: []
      }, { status: 500 });
    }

    console.log('Creating CRM client...');

    const crmClient = createClient({
      appId: crmAppId,
      serviceRoleKey: crmServiceRoleKey,
      baseURL: 'https://app.base44.com'
    });

    console.log('Fetching packages and discount codes from CRM...');

    const packages = await crmClient.entities.Package.list('-created_date', 100);
    
    // เรียก API ดึง discount codes จาก CRM
    let discountCodes = [];
    try {
      const crmApiKey = Deno.env.get("CRM_API_KEY");
      const discountUrl = 'https://connect-sphere-crm-8aa1f2d8.base44.app/api/apps/6919c20da02654368aa1f2d8/functions/getDiscountCode';
      console.log('📡 Calling CRM for discount codes:', discountUrl);

      const discountResponse = await fetch(discountUrl, {
        method: 'GET',
        headers: { 
          'x-api-key': crmApiKey || '',
          'Content-Type': 'application/json'
        }
      });
      const discountData = await discountResponse.json();
      discountCodes = discountData.discount_codes || [];
      console.log('✅ Fetched discount codes:', discountCodes.length);
    } catch (error) {
      console.warn('⚠️ Failed to fetch discount codes:', error.message);
    }
    
    console.log('✅ Success! Packages:', packages?.length || 0);
    
    // DEBUG: แสดงข้อมูลแพ็กเกจทั้งหมด รวม is_active
    if (packages && packages.length > 0) {
      packages.forEach((pkg, i) => {
        console.log(`Package ${i}: ${pkg.package_name}, is_active: ${pkg.is_active}, status: ${pkg.status}`);
      });
    }

    // ⭐ Map is_active จาก status field (status: 'inactive' = ปิด, status: 'active' = เปิด)
    const mappedPackages = (packages || []).map(pkg => ({
      ...pkg,
      is_active: pkg.status !== 'inactive'
    }));

    return Response.json({
      success: true,
      packages: mappedPackages,
      discount_codes: discountCodes || [],
      active_subscriptions: []
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
    console.error('Response:', error.response?.data);
    
    return Response.json({ 
      error: error.message,
      details: error.response?.data || null,
      packages: [],
      active_subscriptions: []
    }, { status: 500 });
  }
});