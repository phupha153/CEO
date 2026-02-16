import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        console.log('=== sendSmsOtp START (SMS OTP API) ===');
        
        let user;
        try {
            user = await base44.auth.me();
        } catch (authError) {
            console.error('❌ Authentication failed:', authError);
            return Response.json({ 
                success: false,
                error: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' 
            }, { status: 401 });
        }

        if (!user) {
            console.error('❌ No user found after authentication');
            return Response.json({ 
                success: false,
                error: 'ไม่พบข้อมูลผู้ใช้' 
            }, { status: 401 });
        }

        console.log('✅ User authenticated:', user.email);

        const { phoneNumber, contractId } = await req.json();
        console.log('📥 Request payload:', { phoneNumber, contractId });

        if (!phoneNumber || !contractId) {
            console.error('❌ Missing required fields');
            return Response.json({ 
                success: false,
                error: 'ข้อมูลไม่ครบถ้วน: ต้องการเบอร์โทรศัพท์และรหัสสัญญา' 
            }, { status: 400 });
        }

        // ✅ ตรวจสอบ SMS OTP credentials
        const apiKey = Deno.env.get('SMS_OTP_API_KEY');
        const apiSecret = Deno.env.get('SMS_API_SECRET');

        if (!apiKey || !apiSecret) {
            console.error('❌ SMS OTP credentials not configured');
            return Response.json({ 
                success: false,
                error: '❌ ระบบ SMS ยังไม่ได้ตั้งค่า\n\nกรุณาตั้งค่า Secrets:\n• SMS_OTP_API_KEY\n• SMS_API_SECRET\n\nที่ Dashboard → Settings → Secrets' 
            }, { status: 500 });
        }

        // ✅ แปลงเบอร์โทรให้เป็นรูปแบบที่ ThaiBulkSMS รับ (0812345678)
        let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/\-/g, '');
        
        if (formattedPhone.startsWith('+66')) {
            formattedPhone = '0' + formattedPhone.substring(3);
        } else if (formattedPhone.startsWith('66') && formattedPhone.length === 11) {
            formattedPhone = '0' + formattedPhone.substring(2);
        }
        
        if (!formattedPhone.startsWith('0') || formattedPhone.length !== 10) {
            return Response.json({
                success: false,
                error: '❌ รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง (ต้องเป็น 0812345678)'
            }, { status: 400 });
        }

        console.log('📱 Formatted phone:', formattedPhone);

        // ✅ สร้าง OTP 6 หลัก
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpRef = contractId.substring(0, 10);

        console.log('🔐 Generated OTP:', otp.substring(0, 2) + '****');

        // ✅ เก็บ OTP ลง Config entity
        const otpKey = `otp_${formattedPhone}_${contractId}`;
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        try {
            // ลบ OTP เก่าถ้ามี
            const oldOtps = await base44.asServiceRole.entities.Config.filter({ key: otpKey });
            for (const old of oldOtps) {
                await base44.asServiceRole.entities.Config.delete(old.id);
            }

            // สร้าง OTP ใหม่
            await base44.asServiceRole.entities.Config.create({
                key: otpKey,
                value: JSON.stringify({
                    otp: otp,
                    phone: formattedPhone,
                    contractId: contractId,
                    expiresAt: expiresAt.toISOString()
                }),
                value_type: 'string',
                description: 'OTP for contract signing',
                category: 'general'
            });

            console.log('✅ OTP stored successfully');
        } catch (error) {
            console.error('❌ Failed to store OTP:', error);
            return Response.json({
                success: false,
                error: 'ไม่สามารถบันทึก OTP ได้'
            }, { status: 500 });
        }

        // ✅ ส่ง SMS ผ่าน ThaiBulkSMS
        const message = `รหัส OTP สำหรับการลงนามสัญญาเช่า:\n\n${otp}\n\nRef: ${otpRef}\nกรุณากรอกภายใน 5 นาที\n\n- W RESIDENTS`;

        console.log('📤 Sending SMS via SMS OTP API...');

        try {
            const response = await fetch('https://www.thaibulksms.com/sms_api.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    username: apiKey,
                    password: apiSecret,
                    msisdn: formattedPhone,
                    message: message,
                    sender: 'W RESIDENTS',
                    ifttt: '1'
                })
            });

            const responseText = await response.text();
            console.log('📨 SMS OTP API Response:', responseText);

            // Response format: "status|credit|ref_id"
            const parts = responseText.split('|');
            const status = parts[0];

            if (status === '1') {
                console.log('✅ SMS sent successfully');
                console.log('💳 Remaining credits:', parts[1]);
                console.log('📨 Ref ID:', parts[2]);

                return Response.json({ 
                    success: true,
                    message: '✅ ส่งรหัส OTP ไปยังเบอร์ ' + formattedPhone + ' แล้ว\n\nรหัส OTP จะหมดอายุใน 5 นาที',
                    expiresIn: 300,
                    phone: formattedPhone,
                    provider: 'SMS OTP',
                    otpRef: otpRef,
                    refId: parts[2]
                });
            } else {
                const errorMessages = {
                    '0': 'ส่ง SMS ไม่สำเร็จ',
                    '-1': 'Username หรือ Password ไม่ถูกต้อง',
                    '-2': 'Credit ไม่พอ',
                    '-3': 'เบอร์โทรศัพท์ไม่ถูกต้อง',
                    '-4': 'ข้อความยาวเกินไป',
                    '-5': 'Sender name ไม่ถูกต้อง'
                };

                const errorMessage = errorMessages[status] || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ';

                console.error('❌ SMS OTP API Error:', status, errorMessage);

                return Response.json({ 
                    success: false,
                    error: `❌ ${errorMessage}\n\nStatus Code: ${status}`,
                    provider: 'SMS OTP',
                    statusCode: status
                }, { status: 500 });
            }

        } catch (smsError) {
            console.error('❌ SMS OTP Request Error:', smsError);
            
            return Response.json({ 
                success: false,
                error: 'ไม่สามารถเชื่อมต่อกับระบบ SMS ได้: ' + smsError.message,
                provider: 'SMS OTP'
            }, { status: 500 });
        }

    } catch (error) {
        console.error('=== ❌ FATAL ERROR ===');
        console.error(error);
        return Response.json({ 
            success: false,
            error: 'เกิดข้อผิดพลาดภายในระบบ',
            details: error.message 
        }, { status: 500 });
    }
});