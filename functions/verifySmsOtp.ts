import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        console.log('=== verifySmsOtp START (Manual) ===');
        
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
            return Response.json({ 
                success: false,
                error: 'ไม่พบข้อมูลผู้ใช้' 
            }, { status: 401 });
        }

        const { phoneNumber, contractId, otp } = await req.json();

        if (!phoneNumber || !contractId || !otp) {
            return Response.json({ 
                success: false,
                error: 'ข้อมูลไม่ครบถ้วน' 
            }, { status: 400 });
        }

        // ✅ แปลงเบอร์โทร
        let formattedPhone = phoneNumber.replace(/\s+/g, '').replace(/\-/g, '');
        
        if (formattedPhone.startsWith('+66')) {
            formattedPhone = '0' + formattedPhone.substring(3);
        } else if (formattedPhone.startsWith('66') && formattedPhone.length === 11) {
            formattedPhone = '0' + formattedPhone.substring(2);
        }

        // ✅ ดึง OTP จาก Config
        const otpKey = `otp_${formattedPhone}_${contractId}`;
        
        let storedOtpConfigs;
        try {
            storedOtpConfigs = await base44.asServiceRole.entities.Config.filter({ key: otpKey });
        } catch (error) {
            console.error('❌ Failed to retrieve OTP:', error);
            return Response.json({
                success: false,
                error: 'ไม่สามารถตรวจสอบ OTP ได้'
            }, { status: 500 });
        }

        if (!storedOtpConfigs || storedOtpConfigs.length === 0) {
            return Response.json({ 
                success: false,
                error: '❌ ไม่พบรหัส OTP หรือหมดอายุแล้ว\n\nกรุณาขอรหัสใหม่'
            }, { status: 400 });
        }

        const storedOtpConfig = storedOtpConfigs[0];
        let storedData;
        
        try {
            storedData = JSON.parse(storedOtpConfig.value);
        } catch (error) {
            console.error('❌ Failed to parse OTP data:', error);
            return Response.json({
                success: false,
                error: 'ข้อมูล OTP ไม่ถูกต้อง'
            }, { status: 500 });
        }

        // ✅ ตรวจสอบว่า OTP หมดอายุหรือยัง
        const expiresAt = new Date(storedData.expiresAt);
        const now = new Date();

        if (now > expiresAt) {
            // ลบ OTP ที่หมดอายุ
            await base44.asServiceRole.entities.Config.delete(storedOtpConfig.id);
            
            return Response.json({ 
                success: false,
                error: '❌ รหัส OTP หมดอายุแล้ว\n\nกรุณาขอรหัสใหม่'
            }, { status: 400 });
        }

        // ✅ ตรวจสอบว่า OTP ถูกต้องหรือไม่
        if (storedData.otp !== otp) {
            return Response.json({ 
                success: false,
                error: '❌ รหัส OTP ไม่ถูกต้อง\n\nกรุณาลองใหม่อีกครั้ง'
            }, { status: 400 });
        }

        // ✅ OTP ถูกต้อง - ลบ OTP ออกจากระบบ
        await base44.asServiceRole.entities.Config.delete(storedOtpConfig.id);

        console.log('✅ OTP verified successfully');

        return Response.json({ 
            success: true,
            message: '✅ ยืนยันตัวตนสำเร็จ'
        });

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