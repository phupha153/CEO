Deno.serve(async (req) => {
  try {
    const { code, discount_amount, customer_email, original_amount, final_amount } = await req.json();

    if (!code || !customer_email || discount_amount === undefined) {
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

    console.log('📝 Marking discount code as used:', code.toUpperCase());
    console.log('👤 Customer:', customer_email);
    console.log('💰 Discount Amount:', discount_amount);
    console.log('💰 Original Amount:', original_amount);
    console.log('💰 Final Amount:', final_amount);

    // เรียก API CRM เพื่อบันทึกการใช้โค้ดส่วนลด
    let crmResponse;
    try {
      const url = 'https://connect-sphere-crm-8aa1f2d8.base44.app/api/apps/6919c20da02654368aa1f2d8/functions/useDiscountCode';
      console.log('📡 Calling CRM URL:', url);
      
      const requestBody = {
        code: code.toUpperCase(),
        discount_amount: parseFloat(discount_amount) || 0,
        customer_email: customer_email,
        original_amount: original_amount ? parseFloat(original_amount) : undefined,
        final_amount: final_amount ? parseFloat(final_amount) : undefined
      };
      
      console.log('📤 Request body:', JSON.stringify(requestBody));
      
      crmResponse = await fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-api-key': crmApiKey
        },
        body: JSON.stringify(requestBody)
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
        error: `ไม่สามารถบันทึกการใช้โค้ดได้ (${crmResponse.status}): ${errorText.substring(0, 100)}`
      });
    }

    const crmData = await crmResponse.json();
    console.log('✅ CRM Response:', crmData);
    
    if (!crmData.success) {
      return Response.json({ 
        success: false,
        error: crmData.error || 'ไม่สามารถบันทึกการใช้รหัสส่วนลดได้' 
      });
    }

    console.log(`✅ Discount code ${code} marked as used by ${customer_email}`);

    return Response.json({
      success: true,
      message: 'บันทึกการใช้รหัสส่วนลดสำเร็จ'
    });

  } catch (error) {
    console.error('❌ Error marking discount code as used:', error);
    return Response.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
});