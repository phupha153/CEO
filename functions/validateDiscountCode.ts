Deno.serve(async (req) => {
  try {
    const { code, package_id, total_amount, customer_email } = await req.json();

    if (!code || !package_id || !total_amount) {
      return Response.json({ 
        success: false,
        error: 'กรุณาระบุข้อมูลให้ครบถ้วน' 
      });
    }

    const crmApiKey = Deno.env.get("CRM_API_KEY");
    console.log('🔑 DEBUG: CRM_API_KEY value:', crmApiKey);
    console.log('🔑 DEBUG: CRM_API_KEY length:', crmApiKey?.length);
    console.log('🔑 DEBUG: CRM_API_KEY last 6 chars:', crmApiKey ? crmApiKey.substring(crmApiKey.length - 6) : 'NOT SET');

    if (!crmApiKey) {
      console.error('❌ CRM_API_KEY not set');
      return Response.json({ 
        success: false,
        error: 'ไม่สามารถเชื่อมต่อ CRM ได้ - ไม่พบ API Key' 
      });
    }

    console.log('🔍 Validating discount code:', code.toUpperCase());
    console.log('📦 Package ID:', package_id);
    console.log('💰 Amount:', total_amount);

    // เรียก API CRM เพื่อตรวจสอบโค้ดส่วนลด (ส่ง customer_email ไปด้วย)
    let crmResponse;
    try {
      let url = `https://connect-sphere-crm-8aa1f2d8.base44.app/api/apps/6919c20da02654368aa1f2d8/functions/getDiscountCode?code=${encodeURIComponent(code.toUpperCase())}`;
      if (customer_email) {
        url += `&customer_email=${encodeURIComponent(customer_email)}`;
      }
      console.log('📡 Calling CRM URL:', url);
      console.log('👤 Customer Email:', customer_email);

      crmResponse = await fetch(url, {
        method: 'GET',
        headers: { 
          'x-api-key': crmApiKey,
          'Content-Type': 'application/json'
        }
      });
    } catch (fetchError) {
      console.error('❌ Fetch error:', fetchError.message);
      return Response.json({ 
        success: false,
        error: 'ไม่สามารถเชื่อมต่อ CRM ได้ - ' + fetchError.message
      });
    }

    console.log('📡 CRM Response Status:', crmResponse.status);

    if (!crmResponse.ok) {
      const errorText = await crmResponse.text();
      console.error('❌ CRM Error Response:', errorText);
      return Response.json({ 
        success: false,
        error: `ไม่สามารถเชื่อมต่อ CRM ได้ (${crmResponse.status}): ${errorText.substring(0, 100)}`
      });
    }

    const crmData = await crmResponse.json();
    console.log('✅ CRM Response:', crmData);
    
    // CRM ได้ตรวจสอบความถูกต้องแล้ว ใช้ field valid จาก CRM
    if (!crmData.success || !crmData.valid || !crmData.discount_code) {
      return Response.json({ 
        success: false,
        error: crmData.error || 'รหัสส่วนลดนี้ไม่สามารถใช้งานได้' 
      });
    }

    const discountCode = crmData.discount_code;

    // ✅ เช็คว่าลูกค้าคนนี้ใช้โค้ดนี้ครบจำนวนแล้วหรือยัง (ใช้ customer_usage_count จาก CRM)
    console.log('📊 Usage Info:', {
      max_usage_per_customer: discountCode.max_usage_per_customer,
      customer_usage_count: discountCode.customer_usage_count
    });

    if (discountCode.max_usage_per_customer && 
        discountCode.customer_usage_count !== undefined &&
        discountCode.customer_usage_count >= discountCode.max_usage_per_customer) {
      console.log('❌ Customer usage limit reached');
      return Response.json({ 
        success: false,
        error: 'คุณใช้รหัสส่วนลดนี้ครบจำนวนแล้ว'
      });
    }

    // คำนวณส่วนลด
    let discountAmount = 0;
    if (discountCode.discount_type === 'percentage') {
      discountAmount = (total_amount * discountCode.discount_value) / 100;
      if (discountCode.max_discount && discountAmount > discountCode.max_discount) {
        discountAmount = discountCode.max_discount;
      }
    } else if (discountCode.discount_type === 'fixed') {
      discountAmount = discountCode.discount_value;
    }

    const finalAmount = Math.max(0, total_amount - discountAmount);

    // ✅ เพิ่มข้อมูลการใช้งาน (ของลูกค้าคนนี้)
    const usageInfo = {
      customer_limit: discountCode.max_usage_per_customer || null,
      customer_usage_count: discountCode.customer_usage_count || 0,
      remaining_uses: discountCode.max_usage_per_customer 
        ? Math.max(0, discountCode.max_usage_per_customer - (discountCode.customer_usage_count || 0))
        : null
    };

    return Response.json({
      success: true,
      discount_code: discountCode,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      original_amount: total_amount,
      usage_info: usageInfo
    });

  } catch (error) {
    console.error('❌ Error validating discount code:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});