import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    let user;
    try {
      user = await base44.auth.me();
    } catch (authError) {
      console.error('Authentication error:', authError);
      return Response.json({ 
        success: false,
        error: 'กรุณาเข้าสู่ระบบใหม่',
        details: authError.message 
      }, { status: 401 });
    }

    if (!user) {
      return Response.json({ 
        success: false,
        error: 'กรุณาเข้าสู่ระบบใหม่' 
      }, { status: 401 });
    }

    console.log('User authenticated:', user.email);

    let payload;
    try {
      payload = await req.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return Response.json({ 
        success: false,
        error: 'ข้อมูลไม่ถูกต้อง' 
      }, { status: 400 });
    }

    const { 
      package_id, 
      package_name, 
      duration_months, 
      price_per_month, 
      total_amount,
      original_amount,
      discount_code,
      discount_amount,
      slip_url,
      user_email,
      user_name,
      branch_id,
      branch_ids,
      app_mode: requestAppMode,
      is_free
    } = payload;

    console.log('=== Processing Subscription Payment ===');
    console.log('📥 PAYLOAD RECEIVED:', JSON.stringify(payload, null, 2));
    console.log('👤 AUTHENTICATED USER:', JSON.stringify({
      email: user.email,
      full_name: user.full_name,
      id: user.id,
      role: user.role,
      custom_role: user.custom_role
    }, null, 2));

    if (!package_name || !duration_months || !price_per_month || total_amount === undefined) {
      console.log('Missing required fields');
      return Response.json({ 
        success: false,
        error: 'ข้อมูลไม่ครบถ้วน กรุณาลองใหม่อีกครั้ง' 
      }, { status: 400 });
    }

    // ถ้าเป็นแพ็กเกจฟรี (ส่วนลด 100%) ไม่ต้องมี slip_url
    if (!is_free && !slip_url) {
      console.log('Missing slip_url for paid package');
      return Response.json({ 
        success: false,
        error: 'กรุณาอัปโหลดสลิปการโอนเงิน' 
      }, { status: 400 });
    }

    const slip2goApiKey = Deno.env.get('SLIP2GO_API_KEY');
    if (!slip2goApiKey) {
      console.error('SLIP2GO_API_KEY not configured');
      return Response.json({ 
        success: false,
        error: 'ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ' 
      }, { status: 500 });
    }

    const configs = await base44.asServiceRole.entities.Config.list();
    const getConfigValue = (key) => {
      const config = configs.find(c => c.key === key && !c.branch_id);
      return config?.value || null;
    };

    const expectedAccountNumber = getConfigValue('bank_account_number');
    const expectedPromptPay = getConfigValue('promptpay');
    const expectedBankName = getConfigValue('bank_name') || 'ธนาคารกสิกรไทย';
    const expectedAccountName = getConfigValue('bank_account_name');
    const testModeEnabled = getConfigValue('test_mode') === 'true';
    const appMode = getConfigValue('app_mode') || 'single_tenant';

    console.log('🏦 Expected account:', expectedAccountNumber);
    console.log('🏦 Expected PromptPay:', expectedPromptPay);
    console.log('🏦 Expected account name:', expectedAccountName);
    console.log('🧪 Test Mode:', testModeEnabled ? 'ENABLED' : 'DISABLED');
    console.log('📱 App Mode:', appMode);
    console.log('💰 Is Free Package:', is_free ? 'YES' : 'NO');

    // ⭐⭐⭐ ตรวจสอบ discount code ก่อนทำอะไรต่อ (ถ้ามี)
    if (discount_code && discount_code.trim() !== '') {
      console.log('\n=== Validating Discount Code ===');
      console.log('🎟️ Discount Code:', discount_code);
      
      try {
        const validateResponse = await base44.asServiceRole.functions.invoke('validateDiscountCode', {
          code: discount_code.trim(),
          package_id: package_id,
          total_amount: original_amount || total_amount,
          customer_email: user_email || user.email
        });
        
        console.log('📡 Validation Response:', validateResponse.data);
        
        if (!validateResponse.data?.success) {
          const errorMsg = validateResponse.data?.error || 'รหัสส่วนลดไม่สามารถใช้งานได้';
          console.log('❌ Discount validation failed:', errorMsg);
          
          // แจ้งรายละเอียดถ้าโค้ดใช้แล้ว
          let errorDetails = 'โค้ดส่วนลดไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่';
          if (errorMsg.includes('usage limit') || errorMsg.includes('ใช้งาน') || errorMsg.includes('ถูกใช้') || errorMsg.includes('ใช้โค้ด')) {
            errorDetails = '🎟️ โค้ดส่วนลดนี้ใช้งานแล้ว\n\nกรุณาลองใช้โค้ดอื่น หรือชำระเงินเต็มจำนวน';
          }
          
          return Response.json({ 
            success: false,
            error: errorMsg,
            details: errorDetails
          }, { status: 400 });
        }
        
        console.log('✅ Discount code validated successfully');
      } catch (validateError) {
        console.error('❌ Discount validation error:', validateError.message);
        return Response.json({ 
          success: false,
          error: 'ไม่สามารถตรวจสอบรหัสส่วนลดได้',
          details: validateError.message
        }, { status: 500 });
      }
    }

    // ถ้าเป็นแพ็กเกจฟรี ข้ามการ verify slip
    let slipData = null;
    let slipAmount = 0;
    let senderName = 'N/A';
    let senderAccount = '';
    let receiverAccount = '';
    let receiverProxyAccount = '';
    let receiverName = '';

    if (!is_free && slip_url) {
      console.log('\n=== Verifying Slip with Slip2Go ===');

    const verifyPayload = {
      payload: {
        imageUrl: slip_url
      }
    };

    console.log('Sending payload:', JSON.stringify(verifyPayload));

    const response = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image-link/info', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${slip2goApiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(verifyPayload)
    });

    const responseText = await response.text();
    console.log('Response Status:', response.status);
    console.log('Response Body:', responseText);

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      return Response.json({ 
        success: false,
        error: 'เกิดข้อผิดพลาดจากระบบตรวจสอบสลิป',
        details: responseText 
      }, { status: 500 });
    }

    const isSuccess = response.ok && (data.code === "200000" || data.message === "Slip found.");

    if (!isSuccess) {
      console.log('❌ Slip verification failed');

      let errorMessage = 'ไม่สามารถตรวจสอบสลิปได้';
      let errorDetails = 'กรุณาลองใหม่อีกครั้ง';

      if (data?.message === 'File is Incorrect' || data?.code === '400002') {
        errorMessage = '❌ ระบบอ่านสลิปไม่ได้';
        errorDetails = `กรุณาตรวจสอบว่า:
    📸 สลิปชัดเจน อ่านได้
    📱 เป็นสลิปจริงจากแอปธนาคาร (มี QR Code)
    💰 มียอดเงินและวันที่แสดงอย่างชัดเจน

    💡 แนะนำ: ใช้ Screenshot จากแอปธนาคารโดยตรง แทนการถ่ายรูปจากหน้าจอ`;
      } else if (data?.message) {
        errorMessage = data.message;
        if (data?.code) {
          errorDetails = `Error code: ${data.code}`;
        }
      }

      return Response.json({ 
        success: false,
        error: errorMessage,
        details: errorDetails
      }, { status: 400 });
    }

    console.log('✅ Slip read successfully!');

    slipData = data.data;
    slipAmount = parseFloat(slipData.amount || 0);
    const expectedAmount = parseFloat(total_amount);
    receiverAccount = slipData.receiver?.account?.bank?.account || '';
    const receiverProxyType = slipData.receiver?.account?.proxy?.type || '';
    receiverProxyAccount = slipData.receiver?.account?.proxy?.account || '';
    receiverName = slipData.receiver?.account?.name || '';
    senderName = slipData.sender?.account?.name || 'N/A';
    senderAccount = slipData.sender?.account?.bank?.account || '';

    console.log('💰 Slip amount:', slipAmount);
    console.log('💰 Expected amount:', expectedAmount);
    console.log('🏦 Receiver name:', receiverName);
    console.log('🏦 Receiver account:', receiverAccount);
    console.log('🏦 Receiver proxy type:', receiverProxyType);
    console.log('🏦 Receiver proxy account:', receiverProxyAccount);
    console.log('👤 Sender name:', senderName);
    console.log('👤 Sender account:', senderAccount);

    if (testModeEnabled) {
      console.log('🧪 TEST MODE: Skipping amount and account verification');
    } else {
      if (slipAmount < expectedAmount * 0.95) {
        return Response.json({ 
          success: false,
          error: `❌ จำนวนเงินน้อยกว่ายอดที่ต้องชำระ`,
          details: `สลิปแสดงยอด: ${slipAmount.toLocaleString()} บาท\nยอดที่ต้องชำระ: ${expectedAmount.toLocaleString()} บาท\n\n⚠️ กรุณาโอนเงินให้ครบถ้วน ${expectedAmount.toLocaleString()} บาท แล้วอัปโหลดสลิปใหม่`
        }, { status: 400 });
      }

      if (slipAmount > expectedAmount) {
        return Response.json({ 
          success: false,
          error: `❌ จำนวนเงินมากกว่ายอดที่ต้องชำระ`,
          details: `สลิปแสดงยอด: ${slipAmount.toLocaleString()} บาท\nยอดที่ต้องชำระ: ${expectedAmount.toLocaleString()} บาท\n\n⚠️ กรุณาโอนเงินให้ตรงตามยอด ${expectedAmount.toLocaleString()} บาท แล้วอัปโหลดสลิปใหม่`
        }, { status: 400 });
      }

      let accountMatch = false;

      const compareAccountWithMask = (actual, expected) => {
        const cleanActual = actual.replace(/-/g, '');
        const cleanExpected = expected.replace(/[^0-9]/g, '');

        if (cleanActual.includes('xxx') || cleanActual.includes('XXX')) {
          const visibleParts = cleanActual.split(/xxx|XXX/i);

          return visibleParts.every(part => {
            if (!part || part.length === 0) return true;
            return cleanExpected.includes(part);
          });
        }

        return cleanActual === cleanExpected || 
               cleanActual.includes(cleanExpected) || 
               cleanExpected.includes(cleanActual);
      };

      if (expectedAccountNumber && receiverAccount) {
        if (compareAccountWithMask(receiverAccount, expectedAccountNumber)) {
          accountMatch = true;
          console.log('✅ Account number matches (with mask)');
        }
      }

      if (!accountMatch && expectedPromptPay && receiverProxyAccount) {
        const cleanPromptPay = expectedPromptPay.replace(/[^0-9]/g, '');
        const cleanReceiverProxy = receiverProxyAccount.replace(/[^0-9]/g, '');

        if (cleanReceiverProxy.includes(cleanPromptPay) || cleanPromptPay.includes(cleanReceiverProxy)) {
          accountMatch = true;
          console.log('✅ PromptPay matches');
        }
      }

      if (!accountMatch && expectedAccountName && receiverName) {
        const cleanExpectedName = expectedAccountName.toLowerCase().replace(/\s+/g, '');
        const cleanReceiverName = receiverName.toLowerCase().replace(/\s+/g, '');

        if (cleanReceiverName.includes(cleanExpectedName) || cleanExpectedName.includes(cleanReceiverName)) {
          accountMatch = true;
          console.log('✅ Account name matches');
        }
      }

      if (!accountMatch) {
        console.log('❌ Account mismatch!');

        const receiverInfo = receiverAccount 
          ? `เลขบัญชี: ${receiverAccount}` 
          : receiverProxyAccount 
            ? `${receiverProxyType}: ${receiverProxyAccount}` 
            : receiverName;

        return Response.json({ 
          success: false,
          error: '❌ โอนเงินไปผิดบัญชี',
          details: `คุณโอนเงินเข้า:\n${receiverInfo}\n(ชื่อบัญชี: ${receiverName})\n\nบัญชีที่ถูกต้อง:\n🏦 ${expectedBankName}\n💳 เลขบัญชี: ${expectedAccountNumber}\n💳 ชื่อบัญชี: ${expectedAccountName}\n📱 PromptPay: ${expectedPromptPay || 'ไม่ได้ระบุ'}\n\n⚠️ กรุณาโอนเงินเข้าบัญชีที่ถูกต้องและอัปโหลดสลิปใหม่`
        }, { status: 400 });
      }
    }

    console.log('✅ All verifications passed!');
    }
    
    // ⭐ คำนวณวันที่เริ่มต้นและสิ้นสุด
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysToAdd = parseInt(duration_months) * 30;

    let startDate;
    let bonusDays = 0;

    // เช็คว่ามี trial เหลืออยู่หรือไม่
    if (user.trial_ends_at && user.plan_status === 'trial') {
      const trialEndDate = new Date(user.trial_ends_at);
      trialEndDate.setHours(23, 59, 59, 999);

      if (trialEndDate > today) {
        // มี trial เหลืออยู่ - บวกวันที่เหลือเข้าไป
        bonusDays = Math.ceil((trialEndDate - today) / (1000 * 60 * 60 * 24));
        console.log(`🎁 Trial bonus: ${bonusDays} days remaining`);
      }
    }

    // นับต่อจาก subscription_end_date เก่าถ้ายังไม่หมดอายุ
    if (user.subscription_end_date && user.plan_status === 'active') {
      const currentEndDate = new Date(user.subscription_end_date);
      currentEndDate.setHours(23, 59, 59, 999);

      if (currentEndDate > today) {
        // นับต่อจากแพ็กเกจเก่า
        startDate = new Date(currentEndDate);
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(0, 0, 0, 0);
      } else {
        startDate = new Date(today);
      }
    } else {
      startDate = new Date(today);
    }

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + daysToAdd + bonusDays);
    endDate.setHours(23, 59, 59, 999);

    console.log('📅 Start Date:', startDate.toISOString().split('T')[0]);
    console.log('📅 End Date:', endDate.toISOString().split('T')[0]);
    console.log('📅 Duration:', duration_months, 'months =', daysToAdd, 'days');
    if (bonusDays > 0) {
      console.log('🎁 Bonus Days (from trial):', bonusDays, 'days');
      console.log('📅 Total Days:', daysToAdd + bonusDays, 'days');
    }

    // ⭐ อัปเดต User entity ของเจ้าของหอพัก
    await base44.asServiceRole.entities.User.update(user.id, {
      plan_status: 'active',
      subscription_end_date: endDate.toISOString().split('T')[0],
      package_id: package_id,
      package_name: package_name,
      trial_ends_at: null // ล้าง trial_ends_at เมื่อซื้อแพ็กเกจแล้ว
    });
    console.log('✅ User package updated for:', user.email);

    // ⭐ อัปเดต AppSubscription (สำหรับ backward compatibility)
    const subscriptions = await base44.asServiceRole.entities.AppSubscription.list('-created_date', 1);
    const currentSub = subscriptions[0];
    
    const subscriptionData = {
      status: 'active',
      package_id: package_id,
      package_name: package_name,
      subscription_start_date: startDate.toISOString().split('T')[0],
      subscription_end_date: endDate.toISOString().split('T')[0],
      subscription_duration_months: duration_months,
      price_per_month: price_per_month,
      total_price: total_amount,
      slip_url: slip_url || null,
      payment_status: 'paid',
      notes: is_free
        ? `🎉 แพ็กเกจฟรี (ส่วนลด 100%)\n✅ เปิดใช้งานเมื่อ ${new Date().toISOString().split('T')[0]}\n👤 เจ้าของ: ${user.email}\n📦 ระยะเวลา: ${duration_months} เดือน (${daysToAdd} วัน)${bonusDays > 0 ? `\n🎁 โบนัสจาก Trial: ${bonusDays} วัน` : ''}${discount_code ? `\n🎟️ รหัสส่วนลด: ${discount_code}` : ''}`
        : `✅ ชำระเงินเมื่อ ${new Date().toISOString().split('T')[0]}\n✅ ตรวจสอบสลิปโดย Slip2Go${testModeEnabled ? ' (TEST MODE)' : ''}\n💰 จำนวนเงิน: ${slipAmount.toLocaleString()} บาท\n👤 จาก: ${senderName}\n👤 เจ้าของ: ${user.email}\n🏦 เข้าบัญชี: ${receiverAccount || receiverProxyAccount || receiverName}\n📦 ระยะเวลา: ${duration_months} เดือน (${daysToAdd} วัน)${bonusDays > 0 ? `\n🎁 โบนัสจาก Trial: ${bonusDays} วัน` : ''}`
    };

    if (currentSub) {
      await base44.asServiceRole.entities.AppSubscription.update(currentSub.id, subscriptionData);
      console.log('✅ AppSubscription updated');
    } else {
      await base44.asServiceRole.entities.AppSubscription.create({
        app_name: 'Dormitory Management System',
        ...subscriptionData
      });
      console.log('✅ New AppSubscription created');
    }

    // ⭐ ส่งข้อมูลการชำระเงินไป CRM
    const crmWebhookUrl = Deno.env.get('CRM_WEBHOOK_URL');
    const crmApiKey = Deno.env.get('CRM_API_KEY'); // ← ใช้ CRM_API_KEY แทน WEBHOOK_SECRET

    console.log('\n❓ CRM DEBUG:');
    console.log('📍 CRM_WEBHOOK_URL exists?', !!crmWebhookUrl);
    console.log('📍 CRM_WEBHOOK_URL value:', crmWebhookUrl || 'NOT SET');
    console.log('🔑 CRM_API_KEY exists?', !!crmApiKey);
    console.log('🔑 CRM_API_KEY length:', crmApiKey?.length || 0);
    console.log('🔑 CRM_API_KEY first 10 chars:', crmApiKey?.substring(0, 10) || 'NOT SET');

    if (crmWebhookUrl && crmApiKey) {
      try {
        console.log('\n=== ✅ Sending to CRM Webhook (Both vars set) ===');
        const crmPayload = {
          event_type: 'subscription_payment',
          customer_email: user.email,
          customer_name: user.full_name,
          customer_phone: user.phone || null,
          package_id: package_id,
          package_name: package_name,
          subscription_start_date: startDate.toISOString().split('T')[0],
          subscription_end_date: endDate.toISOString().split('T')[0],
          duration_months: duration_months,
          price_per_month: price_per_month,
          total_amount: total_amount,
          verified_amount: is_free ? 0 : slipAmount,
          payment_date: new Date().toISOString().split('T')[0],
          slip_url: slip_url || null,
          sender_name: is_free ? 'FREE_PACKAGE' : senderName,
          sender_account: is_free ? 'N/A' : senderAccount,
          receiver_account: is_free ? 'N/A' : receiverAccount,
          receiver_name: is_free ? 'N/A' : receiverName,
          app_mode: appMode,
          branch_ids: Array.isArray(branch_ids) ? branch_ids : [branch_ids].filter(Boolean),
          test_mode: testModeEnabled,
          timestamp: new Date().toISOString(),
          discount_code: discount_code || null,
          discount_amount: discount_amount || 0,
          data_summary: `✅ Package: ${package_name} | Duration: ${duration_months} months | Contract: ${startDate.toISOString().split('T')[0]} - ${endDate.toISOString().split('T')[0]} | Amount: ${total_amount} THB${is_free ? ' (FREE - 100% discount)' : ''}`
        };

        console.log('📊 CRM Payload Summary:');
        console.log('  📦 Package:', package_name);
        console.log('  ⏱️  Duration:', duration_months, 'months');
        console.log('  📅 Start Date:', startDate.toISOString().split('T')[0]);
        console.log('  📅 End Date:', endDate.toISOString().split('T')[0]);
        console.log('  💰 Amount:', total_amount, 'THB');
        console.log('  👤 Customer:', user.email);
        console.log('  🎁 Free Package?:', is_free ? 'YES' : 'NO');

        const crmResponse = await fetch(crmWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': crmApiKey
          },
          body: JSON.stringify(crmPayload)
        });

        const crmResponseText = await crmResponse.text();
        let crmData;
        try {
          crmData = JSON.parse(crmResponseText);
        } catch (e) {
          crmData = { raw: crmResponseText };
        }

        if (crmResponse.ok && crmData?.success) {
          console.log('✅ CRM webhook sent successfully');
          console.log('📡 CRM Response:', crmData);
        } else {
          console.warn('⚠️ CRM webhook returned error:', crmData || crmResponseText);
        }
      } catch (crmError) {
        console.error('⚠️ CRM webhook error (non-blocking):', crmError.message);
        // ไม่ block main flow - เป็นเพียง notification เท่านั้น
      }
    } else {
      console.warn('⚠️ CRM_WEBHOOK_URL หรือ CRM_API_KEY ไม่ได้ตั้งค่า');
    }

    try {
      if (user.line_user_id) {
        await base44.asServiceRole.functions.invoke('sendLineMessage', {
          to: user.line_user_id,
          message: `🎉 ยินดีด้วย!\n\nแพ็กเกจ ${package_name} ของคุณถูกเปิดใช้งานแล้ว\n\n📅 ใช้งานได้ ${daysToAdd} วัน\n📅 หมดอายุ: ${endDate.toISOString().split('T')[0]}\n💰 ยอดชำระ: ${slipAmount.toLocaleString()} บาท\n\nขอบคุณที่ไว้วางใจใช้บริการของเรา!`
        });
        console.log('✅ LINE notification sent');
      }
    } catch (lineError) {
      console.error('LINE notification error:', lineError);
    }

    // ⭐⭐⭐ บันทึกการใช้โค้ดส่วนลดใน CRM (หลังชำระเงินสำเร็จ)
    if (discount_code && discount_code.trim() !== '') {
      try {
        console.log('📝 Marking discount code as used:', discount_code);
        const markUsedResponse = await base44.asServiceRole.functions.invoke('markDiscountCodeUsed', {
          code: discount_code.trim(),
          discount_amount: discount_amount ? parseFloat(discount_amount) : 0,
          customer_email: user_email || user.email,
          original_amount: original_amount ? parseFloat(original_amount) : parseFloat(total_amount),
          final_amount: parseFloat(total_amount)
        });
        
        if (markUsedResponse.data?.success) {
          console.log('✅ Discount code marked as used');
        } else {
          console.warn('⚠️ Failed to mark discount code:', markUsedResponse.data?.error);
        }
      } catch (discountError) {
        console.error('❌ Error marking discount code:', discountError.message);
        // ไม่ block การทำงานหลัก
      }
    }

    console.log('✅ Payment processing completed successfully!');

    return Response.json({
      success: true,
      message: 'เปิดใช้งานแพ็กเกจสำเร็จ',
      verified_amount: slipAmount,
      subscription: {
        package_name: package_name,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        duration_months: duration_months,
        total_days: daysToAdd
      }
    });

  } catch (error) {
    console.error('=== FUNCTION ERROR ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    return Response.json({ 
      success: false,
      error: 'เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง',
      details: error.message
    }, { status: 500 });
  }
});