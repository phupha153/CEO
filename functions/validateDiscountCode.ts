import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { code } = await req.json();

        if (!code || code.trim() === '') {
            return Response.json({
                valid: false,
                error: 'กรุณากรอกโค้ดส่วนลด'
            });
        }

        const CRM_APP_ID = Deno.env.get("CRM_APP_ID");
        const CRM_API_KEY = Deno.env.get("CRM_API_KEY");

        if (!CRM_APP_ID || !CRM_API_KEY) {
            console.error('❌ Missing CRM credentials');
            return Response.json({
                valid: false,
                error: 'ระบบไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล'
            });
        }

        console.log('🔍 Validating discount code...');
        console.log('🔍 Code:', code.trim().toUpperCase());
        console.log('🔍 User email:', user.email);
        console.log('🔍 App ID:', CRM_APP_ID);

        const requestBody = {
            code: code.trim().toUpperCase(),
            user_email: user.email,
            app_id: CRM_APP_ID
        };
        console.log('📤 Request Body:', JSON.stringify(requestBody, null, 2));

        const response = await fetch(`https://connect-sphere-crm-8aa1f2d8.base44.app/api/apps/6919c20da02654368aa1f2d8/functions/validateDiscountCode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api_key': CRM_API_KEY
            },
            body: JSON.stringify(requestBody)
        });

        console.log('📥 Status:', response.status);
        const responseText = await response.text();
        console.log('📥 Response:', responseText);

        if (!response.ok) {
            console.error('❌ CRM validation failed:', response.status, responseText);
            return Response.json({
                valid: false,
                error: 'ไม่สามารถตรวจสอบโค้ดได้'
            });
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            return Response.json({
                valid: false,
                error: 'ระบบตอบกลับผิดรูปแบบ'
            });
        }

        console.log('📥 Parsed:', JSON.stringify(data, null, 2));

        if (data.valid) {
            console.log('✅ Code is valid:', data);
            return Response.json({
                valid: true,
                code: data.code,
                discount_type: data.discount_type,
                discount_value: data.discount_value,
                max_uses: data.max_uses,
                current_uses: data.current_uses,
                remaining_uses: data.remaining_uses,
                expires_at: data.expires_at,
                description: data.description
            });
        } else {
            return Response.json({
                valid: false,
                error: data.error || 'โค้ดไม่ถูกต้องหรือหมดอายุแล้ว'
            });
        }

    } catch (error) {
        console.error('❌ Error in validateDiscountCode:', error);
        return Response.json({ 
            valid: false,
            error: 'เกิดข้อผิดพลาด: ' + error.message 
        }, { status: 500 });
    }
});