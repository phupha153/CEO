import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const CRM_API_KEY = Deno.env.get("CRM_API_KEY");
        const CRM_REGISTERED_APP_ID = 'DORM-1763306051935093';

        if (!CRM_API_KEY) {
            console.error('❌ Missing CRM_API_KEY');
            return Response.json({
                success: false,
                error: 'ระบบไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล'
            });
        }

        console.log('📝 Registering app with CRM...');
        console.log('🔍 App ID:', CRM_REGISTERED_APP_ID);

        const response = await fetch(`https://base44-crm-production.up.railway.app/api/registerApp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: CRM_API_KEY,
                app_id: CRM_REGISTERED_APP_ID,
                app_name: 'Dormitory Management System',
                owner_email: user.email
            })
        });

        const responseText = await response.text();
        console.log('📥 Response Status:', response.status);
        console.log('📥 Response Body:', responseText);

        if (!response.ok) {
            console.error('❌ Registration failed:', response.status, responseText);
            return Response.json({
                success: false,
                error: 'ไม่สามารถลงทะเบียนได้'
            });
        }

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('❌ Failed to parse response:', e);
            return Response.json({
                success: false,
                error: 'ระบบตอบกลับผิดรูปแบบ'
            });
        }

        if (data.success) {
            console.log('✅ App registered successfully');
            return Response.json({
                success: true,
                message: 'ลงทะเบียนสำเร็จ',
                data: data
            });
        } else {
            return Response.json({
                success: false,
                error: data.error || 'ไม่สามารถลงทะเบียนได้'
            });
        }

    } catch (error) {
        console.error('❌ Error in registerAppWithCRM:', error);
        return Response.json({ 
            success: false,
            error: 'เกิดข้อผิดพลาด: ' + error.message 
        }, { status: 500 });
    }
});