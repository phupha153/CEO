Deno.serve(async (req) => {
  try {
    const { code, package_id, total_amount } = await req.json();

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

    // เรียก API CRM เพื่อตรวจสอบโค้ดส่วนลด
    let crmResponse;
    try {
      crmResponse = await fetch('https://connect-sphere-crm-8aa1f2d8.base44.app/api/apps/6919c20da02654368aa1f2d8/functions/getDiscountCode', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': crmApiKey
        },
        body: JSON.stringify({ 
          discount_code: code.toUpperCase(),
          action: 'validate',
          package_id: package_id,
          total_amount: total_amount
        })
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
    
    if (!crmData.success || !crmData.discount_code) {
      return Response.json({ 
        success: false,
        error: crmData.error || 'ไม่พบรหัสส่วนลดนี้' 
      });
    }

    const discountCode = crmData.discount_code;

    if (!discountCode) {
      return Response.json({ 
        success: false,
        error: 'ไม่พบรหัสส่วนลดนี้' 
      });
    }

    // ตรวจสอบสถานะ
    if (discountCode.status !== 'active') {
      return Response.json({ 
        success: false,
        error: 'รหัสส่วนลดนี้ไม่สามารถใช้งานได้' 
      });
    }

    // ตรวจสอบวันหมดอายุ
    if (discountCode.expiry_date) {
      const expiryDate = new Date(discountCode.expiry_date);
      if (new Date() > expiryDate) {
        return Response.json({ 
          success: false,
          error: 'รหัสส่วนลดหมดอายุแล้ว' 
        });
      }
    }

    // ตรวจสอบจำนวนครั้งที่ใช้
    if (discountCode.usage_limit && discountCode.usage_count >= discountCode.usage_limit) {
      return Response.json({ 
        success: false,
        error: 'รหัสส่วนลดถูกใช้งานครบแล้ว' 
      });
    }

    // ตรวจสอบ package ที่ใช้ได้
    if (discountCode.applicable_packages && discountCode.applicable_packages.length > 0) {
      if (!discountCode.applicable_packages.includes(package_id)) {
        return Response.json({ 
          success: false,
          error: 'รหัสส่วนลดนี้ใช้ไม่ได้กับแพ็กเกจที่เลือก' 
        });
      }
    }

    // ตรวจสอบยอดขั้นต่ำ
    if (discountCode.min_purchase_amount && total_amount < discountCode.min_purchase_amount) {
      return Response.json({ 
        success: false,
        error: `ยอดซื้อขั้นต่ำ ${discountCode.min_purchase_amount.toLocaleString()} บาท` 
      });
    }

    // คำนวณส่วนลด
    let discountAmount = 0;
    if (discountCode.discount_type === 'percentage') {
      discountAmount = (total_amount * discountCode.discount_value) / 100;
      if (discountCode.max_discount_amount && discountAmount > discountCode.max_discount_amount) {
        discountAmount = discountCode.max_discount_amount;
      }
    } else if (discountCode.discount_type === 'fixed') {
      discountAmount = discountCode.discount_value;
    }

    const finalAmount = Math.max(0, total_amount - discountAmount);

    return Response.json({
      success: true,
      discount_code: discountCode,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      original_amount: total_amount
    });

  } catch (error) {
    console.error('❌ Error validating discount code:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});