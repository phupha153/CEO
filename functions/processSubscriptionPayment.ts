import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
      slip_url,
      user_email,
      user_name,
      branch_id,
      branch_ids,
      app_mode: requestAppMode,
      discount_code,
      discount_amount
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

    if (!package_name || !duration_months || !price_per_month || !total_amount || !slip_url) {
      console.log('Missing required fields');
      return Response.json({ 
        success: false,
        error: 'ข้อมูลไม่ครบถ้วน กรุณาลองใหม่อีกครั้ง' 
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
    
    const slipData = data.data;
    const slipAmount = parseFloat(slipData.amount || 0);
    const expectedAmount = parseFloat(total_amount);
    const receiverAccount = slipData.receiver?.account?.bank?.account || '';
    const receiverProxyType = slipData.receiver?.account?.proxy?.type || '';
    const receiverProxyAccount = slipData.receiver?.account?.proxy?.account || '';
    const receiverName = slipData.receiver?.account?.name || '';
    const senderName = slipData.sender?.account?.name || 'N/A';
    const senderAccount = slipData.sender?.account?.bank?.account || '';
    
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
    
    // ✅ Declare shared variables at function scope
    let startDate, endDate, daysToAdd, targetBranchIds = null;

    if (appMode === 'multi_tenant' || (requestAppMode === 'multi_tenant')) {
      console.log('📦 Multi-Tenant Mode: Creating packages based on owner_email');

      // ✅ ตรวจสอบ owner_email ให้แน่นอนจากหลายแหล่ง
      console.log('🔍 Step 1: Determining owner_email');
      console.log('   user_email from payload:', user_email, 'type:', typeof user_email);
      console.log('   user.email from auth:', user.email, 'type:', typeof user.email);

      const ownerEmail = user_email || user.email;
      
      console.log('🔍 Step 2: Final ownerEmail:', ownerEmail, 'type:', typeof ownerEmail);
      
      if (!ownerEmail || ownerEmail === '' || typeof ownerEmail !== 'string') {
        console.error('❌ CRITICAL: ownerEmail validation failed!');
        console.error('   Value:', ownerEmail);
        console.error('   Type:', typeof ownerEmail);
        console.error('   user_email:', user_email);
        console.error('   user.email:', user.email);
        return Response.json({ 
          success: false,
          error: 'ไม่พบข้อมูล email ผู้ใช้ กรุณาลองใหม่อีกครั้ง',
          details: `owner_email validation failed. Received: ${JSON.stringify({user_email, userEmail: user.email})}`
        }, { status: 400 });
      }
      
      console.log('✅ Owner Email validated:', ownerEmail);
      
      // ✅ ดึงข้อมูล user จาก email เพื่อหา accessible_branches
      const allUsers = await base44.asServiceRole.entities.User.list();
      const targetUser = allUsers.find(u => u.email === ownerEmail);
      
      if (!targetUser) {
        return Response.json({ 
          success: false,
          error: 'ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาติดต่อผู้ดูแล',
          details: `User with email ${ownerEmail} not found`
        }, { status: 400 });
      }
      
      const userAccessibleBranches = targetUser.accessible_branches || [];
      
      console.log('👤 User accessible branches:', userAccessibleBranches);
      
      // ✅ ถ้าไม่มีสาขาที่เข้าถึงได้เลย
      if (!userAccessibleBranches || userAccessibleBranches.length === 0) {
        return Response.json({ 
          success: false,
          error: 'ผู้ใช้นี้ยังไม่มีสาขาที่เข้าถึงได้ กรุณาติดต่อผู้ดูแลระบบเพื่อกำหนดสิทธิ์',
          details: 'User has no accessible_branches configured'
        }, { status: 400 });
      }
      
      // ✅ ใช้สาขาทั้งหมดที่ user มีสิทธิ์เข้าถึง
      targetBranchIds = userAccessibleBranches;

      console.log(`✅ Processing ${targetBranchIds.length} branch(es) for user ${ownerEmail}:`, targetBranchIds);

      // คำนวณวันที่ใหม่ - นับต่อจากแพ็กเกจเก่าถ้ามี (30 วัน = 1 เดือน)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      daysToAdd = parseInt(duration_months) * 30;

      // หา package ที่ active อยู่เพื่อนับต่อ
      const branchPackages = await base44.asServiceRole.entities.BranchPackage.list();

      // หา package ที่หมดอายุช้าที่สุดใน branches ที่ซื้อ
      let latestEndDate = null;
      for (const branchId of targetBranchIds) {
        const activePkg = branchPackages.find(bp =>
          bp.branch_id === branchId &&
          bp.status === 'active' &&
          bp.package_id !== 'trial' &&
          bp.price_per_month > 0
        );

        if (activePkg && activePkg.subscription_end_date) {
          const pkgEndDate = new Date(activePkg.subscription_end_date);
          pkgEndDate.setHours(23, 59, 59, 999);
          if (!latestEndDate || pkgEndDate > latestEndDate) {
            latestEndDate = pkgEndDate;
          }
        }
      }

      if (latestEndDate && latestEndDate > today) {
        // นับต่อจาก package เก่า
        startDate = new Date(latestEndDate);
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(0, 0, 0, 0);
      } else {
        // เริ่มใหม่จากวันนี้
        startDate = new Date(today);
      }

      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + daysToAdd);
      endDate.setHours(23, 59, 59, 999);

      console.log('📅 Start Date:', startDate.toISOString().split('T')[0]);
      console.log('📅 End Date:', endDate.toISOString());
      console.log('📅 Duration:', duration_months, 'months =', daysToAdd, 'days');

      // ทำการอัปเดตทุกสาขาที่เลือก
      for (const targetBranchId of targetBranchIds) {
        // ยกเลิก trial packages ของสาขานี้ก่อน
        const trialPackages = branchPackages.filter(bp => 
          bp.branch_id === targetBranchId && 
          (bp.package_id === 'trial' || bp.price_per_month === 0 || !bp.price_per_month)
        );
        
        for (const trialPkg of trialPackages) {
          // ✅ CRITICAL FIX: ต้องส่ง owner_email ไปด้วยตอน update
          const trialOwnerEmail = (trialPkg.owner_email && trialPkg.owner_email.trim() !== '') 
            ? trialPkg.owner_email 
            : ownerEmail;

          await base44.asServiceRole.entities.BranchPackage.update(trialPkg.id, { 
            status: 'cancelled',
            owner_email: trialOwnerEmail,
            notes: (trialPkg.notes || '') + `\n❌ ยกเลิกเมื่อ ${new Date().toISOString().split('T')[0]} (อัปเกรดเป็น ${package_name})`
          });
          console.log(`✅ Cancelled trial package for branch ${targetBranchId}:`, trialPkg.id);
        }

        // หา active package ที่ไม่ใช่ trial
        const currentActivePackage = branchPackages.find(bp => 
          bp.branch_id === targetBranchId && 
          bp.status === 'active' && 
          bp.package_id !== 'trial' && 
          bp.price_per_month > 0
        );

        // ✅ Final validation ก่อนบันทึก
        if (!ownerEmail || ownerEmail === '' || ownerEmail === 'undefined' || ownerEmail === 'null') {
          console.error('❌ CRITICAL: ownerEmail is invalid:', ownerEmail);
          throw new Error(`owner_email is required but has invalid value: ${ownerEmail}`);
        }

        console.log(`📦 Processing branch ${targetBranchId} for owner ${ownerEmail}`);

        if (currentActivePackage) {
          // ✅ Update existing package - ระบุ field ทั้งหมดชัดเจน
          // 🔍 FIXED: ป้องกัน empty string "" ที่จะทำให้ owner_email เป็นค่าว่าง
          const existingOwnerEmail = currentActivePackage.owner_email;
          const finalOwnerEmail = (existingOwnerEmail && existingOwnerEmail.trim() !== '') 
            ? existingOwnerEmail 
            : ownerEmail;
          
          console.log('🔍 Owner Email for Update:', {
            existing: existingOwnerEmail,
            new: ownerEmail,
            final: finalOwnerEmail
          });
          
          const updateData = {
            package_id: package_id,
            package_name: package_name,
            owner_email: finalOwnerEmail,
            subscription_start_date: startDate.toISOString().split('T')[0],
            subscription_end_date: endDate.toISOString().split('T')[0],
            status: 'active',
            price_per_month: parseFloat(price_per_month),
            features: [],
            notes: `✅ ชำระเงินเมื่อ ${new Date().toISOString().split('T')[0]}\n✅ ตรวจสอบสลิปโดย Slip2Go${testModeEnabled ? ' (TEST MODE)' : ''}\n💰 จำนวนเงิน: ${slipAmount.toLocaleString()} บาท\n👤 จาก: ${senderName}\n🏦 เข้าบัญชี: ${receiverAccount || receiverProxyAccount || receiverName}\n📦 ระยะเวลา: ${duration_months} เดือน (${daysToAdd} วัน)${targetBranchIds.length > 1 ? `\n🏢 ซื้อพร้อมกับอีก ${targetBranchIds.length - 1} สาขา` : ''}`
          };
          
          console.log('🔄 Updating package:', currentActivePackage.id, 'Data:', JSON.stringify(updateData, null, 2));
          await base44.asServiceRole.entities.BranchPackage.update(currentActivePackage.id, updateData);
          console.log(`✅ Updated BranchPackage for branch ${targetBranchId}`);
        } else {
          // ✅ Create new package - ระบุ field ทั้งหมดชัดเจน ไม่ใช้ spread
          
          // 🔍 CRITICAL VALIDATION ก่อนสร้าง
          console.log('🔍 Step 3: Pre-create validation for branch:', targetBranchId);
          console.log('   ownerEmail value:', ownerEmail);
          console.log('   ownerEmail type:', typeof ownerEmail);
          console.log('   ownerEmail trimmed:', ownerEmail?.trim());
          console.log('   Is valid string?:', typeof ownerEmail === 'string' && ownerEmail.trim().length > 0);
          
          // 🛡️ Final safety check
          if (!ownerEmail || typeof ownerEmail !== 'string' || ownerEmail.trim() === '') {
            console.error('❌ CRITICAL ERROR: ownerEmail is invalid right before create!');
            console.error('   Value:', ownerEmail);
            console.error('   Payload user_email:', user_email);
            console.error('   Auth user.email:', user.email);
            throw new Error(`CRITICAL: owner_email is ${ownerEmail} (${typeof ownerEmail})`);
          }
          
          const createData = {
            branch_id: targetBranchId,
            package_id: package_id,
            package_name: package_name,
            owner_email: ownerEmail.trim(), // 🔒 Force trim to ensure no whitespace
            subscription_start_date: startDate.toISOString().split('T')[0],
            subscription_end_date: endDate.toISOString().split('T')[0],
            status: 'active',
            price_per_month: parseFloat(price_per_month),
            features: [],
            notes: `✅ ชำระเงินเมื่อ ${new Date().toISOString().split('T')[0]}\n✅ ตรวจสอบสลิปโดย Slip2Go${testModeEnabled ? ' (TEST MODE)' : ''}\n💰 จำนวนเงิน: ${slipAmount.toLocaleString()} บาท\n👤 จาก: ${senderName}\n🏦 เข้าบัญชี: ${receiverAccount || receiverProxyAccount || receiverName}\n📦 ระยะเวลา: ${duration_months} เดือน (${daysToAdd} วัน)${targetBranchIds.length > 1 ? `\n🏢 ซื้อพร้อมกับอีก ${targetBranchIds.length - 1} สาขา` : ''}`
          };
          
          console.log('➕ Step 4: Creating new package');
          console.log('   Data to create:', JSON.stringify(createData, null, 2));
          console.log('   Specifically owner_email:', createData.owner_email, 'length:', createData.owner_email?.length);
          
          const createdPackage = await base44.asServiceRole.entities.BranchPackage.create(createData);
          console.log(`✅ Created BranchPackage for branch ${targetBranchId}:`, createdPackage?.id);
        }
      }

      // อัปเดต AppSubscription (global)
      const subscriptions = await base44.asServiceRole.entities.AppSubscription.list('-created_date', 1);
      const currentSub = subscriptions[0];
      
      if (currentSub) {
        await base44.asServiceRole.entities.AppSubscription.update(currentSub.id, {
          status: 'active',
          package_id: package_id,
          package_name: package_name,
          subscription_end_date: endDate.toISOString().split('T')[0],
          subscription_start_date: startDate.toISOString().split('T')[0],
          subscription_duration_months: duration_months,
          price_per_month: price_per_month,
          total_price: total_amount,
          payment_status: 'paid',
          slip_url: slip_url,
          notes: `✅ ชำระเงินเมื่อ ${new Date().toISOString().split('T')[0]}\n🏢 จำนวนสาขา: ${targetBranchIds.length}\n📦 แพ็กเกจ: ${package_name} (${duration_months} เดือน = ${daysToAdd} วัน)`
        });
        console.log('✅ AppSubscription updated');
      }

    } else {
      console.log('📦 Single-Tenant Mode: Updating AppSubscription');

      // คำนวณวันที่ - นับต่อจาก subscription เก่าถ้ายังไม่หมดอายุ
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      daysToAdd = parseInt(duration_months) * 30;

      const subscriptions = await base44.asServiceRole.entities.AppSubscription.list('-created_date', 1);
      const currentSub = subscriptions[0];

      if (currentSub && currentSub.subscription_end_date && currentSub.status === 'active') {
        const currentEndDate = new Date(currentSub.subscription_end_date);
        currentEndDate.setHours(23, 59, 59, 999);

        if (currentEndDate > today) {
          // นับต่อจาก subscription เก่า
          startDate = new Date(currentEndDate);
          startDate.setDate(startDate.getDate() + 1);
          startDate.setHours(0, 0, 0, 0);
        } else {
          startDate = new Date(today);
        }
      } else {
        startDate = new Date(today);
      }

      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + daysToAdd);
      endDate.setHours(23, 59, 59, 999);

      console.log('📅 Start Date:', startDate.toISOString().split('T')[0]);
      console.log('📅 End Date:', endDate.toISOString());
      console.log('📅 Duration:', duration_months, 'months =', daysToAdd, 'days');

      const subscriptionData = {
        status: 'active',
        package_id: package_id,
        package_name: package_name,
        subscription_start_date: startDate.toISOString().split('T')[0],
        subscription_end_date: endDate.toISOString().split('T')[0],
        subscription_duration_months: duration_months,
        price_per_month: price_per_month,
        total_price: total_amount,
        slip_url: slip_url,
        payment_status: 'paid',
        features: currentSub?.features || [],
        notes: `✅ ชำระเงินเมื่อ ${new Date().toISOString().split('T')[0]}\n✅ ตรวจสอบสลิปโดย Slip2Go${testModeEnabled ? ' (TEST MODE)' : ''}\n💰 จำนวนเงิน: ${slipAmount.toLocaleString()} บาท\n👤 จาก: ${senderName}\n🏦 เข้าบัญชี: ${receiverAccount || receiverProxyAccount || receiverName}\n📦 ระยะเวลา: ${duration_months} เดือน (${daysToAdd} วัน)`
      };

      if (currentSub) {
        await base44.asServiceRole.entities.AppSubscription.update(currentSub.id, subscriptionData);
        console.log('✅ Subscription updated:', currentSub.id);
      } else {
        await base44.asServiceRole.entities.AppSubscription.create({
          app_name: 'Dormitory Management System',
          ...subscriptionData
        });
        console.log('✅ New subscription created');
      }
    }

    // ⭐⭐⭐ บันทึกการใช้โค้ดส่วนลดไปยัง CRM
    if (discount_code && discount_amount > 0) {
      try {
        console.log('🎟️ Marking discount code as used in CRM...');
        
        const CRM_API_KEY = Deno.env.get("CRM_API_KEY");
        const THIS_APP_ID = Deno.env.get("BASE44_APP_ID");

        if (CRM_API_KEY && THIS_APP_ID) {
          const markUsedResponse = await fetch(`https://base44-crm-production.up.railway.app/api/useDiscountCode`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': CRM_API_KEY,
              'x-app-id': THIS_APP_ID
            },
            body: JSON.stringify({
              code: discount_code,
              user_email: user_email || user.email,
              app_id: THIS_APP_ID,
              package_id: package_id,
              package_name: package_name,
              discount_amount: discount_amount,
              total_amount: total_amount,
              payment_date: new Date().toISOString()
            })
          });

          if (markUsedResponse.ok) {
            const markData = await markUsedResponse.json();
            console.log('✅ Discount code marked as used:', markData);
          } else {
            console.warn('⚠️ Failed to mark discount code as used:', await markUsedResponse.text());
          }
        }
      } catch (codeError) {
        console.error('❌ Error marking discount code:', codeError.message);
        // ไม่ block การทำงานหลัก
      }
    }

    // ⭐⭐⭐ ส่งข้อมูลไปยัง CRM ผ่าน sendSubscriptionToCRM function
    try {
      console.log('📤 Sending subscription data to CRM...');
      
      const crmPayload = {
        customer_email: user_email || user.email,
        customer_name: user_name || user.full_name,
        package_id: package_id,
        package_name: package_name,
        subscription_start_date: startDate.toISOString().split('T')[0],
        subscription_end_date: endDate.toISOString().split('T')[0],
        duration_months: parseInt(duration_months),
        price_per_month: parseFloat(price_per_month),
        total_amount: parseFloat(total_amount),
        verified_amount: slipAmount,
        payment_date: new Date().toISOString().split('T')[0],
        slip_url: slip_url,
        sender_name: senderName,
        sender_account: senderAccount,
        receiver_account: receiverAccount || receiverProxyAccount,
        receiver_name: receiverName,
        app_mode: appMode,
        branch_ids: (appMode === 'multi_tenant' && targetBranchIds) ? targetBranchIds : null,
        branch_id: branch_id || null,
        test_mode: testModeEnabled,
        discount_code: discount_code || null,
        discount_amount: discount_amount || 0
      };

      console.log('📤 CRM Payload:', JSON.stringify(crmPayload, null, 2));

      const crmResponse = await base44.asServiceRole.functions.invoke('sendSubscriptionToCRM', crmPayload);
      
      if (crmResponse.data?.success) {
        console.log('✅ CRM notified successfully');
      } else {
        console.warn('⚠️ CRM notification failed:', crmResponse.data?.error || 'Unknown error');
      }
    } catch (crmError) {
      console.error('❌ CRM notification error:', crmError.message);
      // ไม่ block การทำงานหลัก ถ้า CRM fail
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