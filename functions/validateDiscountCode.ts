import { createClient } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const { code, package_id, total_amount } = await req.json();

    if (!code || !package_id || !total_amount) {
      return Response.json({ 
        success: false,
        error: 'กรุณาระบุข้อมูลให้ครบถ้วน' 
      });
    }

    const crmAppId = Deno.env.get("CRM_APP_ID");
    const crmServiceRoleKey = Deno.env.get("CRM_SERVICE_ROLE_KEY");

    if (!crmAppId || !crmServiceRoleKey) {
      return Response.json({ 
        success: false,
        error: 'ไม่สามารถเชื่อมต่อ CRM ได้' 
      });
    }

    const crmClient = createClient({
      appId: crmAppId,
      serviceRoleKey: crmServiceRoleKey,
      baseURL: 'https://app.base44.com'
    });

    // ดึง discount code จาก CRM
    const discountCodes = await crmClient.entities.DiscountCode.filter({ code: code.toUpperCase() });
    const discountCode = discountCodes[0];

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