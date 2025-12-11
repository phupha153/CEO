import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { 
            code, 
            user_email, 
            package_id, 
            package_name, 
            discount_amount, 
            total_amount,
            payment_date
        } = await req.json();

        if (!code) {
            return Response.json({
                success: false,
                error: 'กรุณาระบุโค้ดส่วนลด'
            });
        }

        const CRM_API_KEY = Deno.env.get("CRM_API_KEY");
        const CRM_APP_ID = Deno.env.get("CRM_APP_ID");
        const CRM_SERVICE_ROLE_KEY = Deno.env.get("CRM_SERVICE_ROLE_KEY");

        if (!CRM_API_KEY || !CRM_APP_ID || !CRM_SERVICE_ROLE_KEY) {
            console.error('❌ Missing CRM_API_KEY');
            return Response.json({
                success: false,
                error: 'ระบบไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล'
            });
        }

        console.log('🎟️ Marking discount code as used...');
        console.log('🔍 Code:', code);
        console.log('🔍 User email:', user_email || user.email);
        console.log('🔍 App ID:', CRM_APP_ID);

        const response = await fetch(`https://base44-crm-production.up.railway.app/api/useDiscountCode`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                api_key: CRM_API_KEY,
                service_role_key: CRM_SERVICE_ROLE_KEY,
                code: code.trim().toUpperCase(),
                user_email: user_email || user.email,
                app_id: CRM_APP_ID,
                package_id: package_id || null,
                package_name: package_name || null,
                discount_amount: discount_amount || 0,
                total_amount: total_amount || 0,
                payment_date: payment_date || new Date().toISOString()
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ CRM marking failed:', response.status, errorText);
            return Response.json({
                success: false,
                error: 'ไม่สามารถบันทึกการใช้โค้ดได้'
            });
        }

        const data = await response.json();

        if (data.success) {
            console.log('✅ Discount code marked as used:', data);
            return Response.json({
                success: true,
                message: 'บันทึกการใช้โค้ดสำเร็จ',
                data: data
            });
        } else {
            return Response.json({
                success: false,
                error: data.error || 'ไม่สามารถบันทึกการใช้โค้ดได้'
            });
        }

    } catch (error) {
        console.error('❌ Error in useDiscountCode:', error);
        return Response.json({ 
            success: false,
            error: 'เกิดข้อผิดพลาด: ' + error.message 
        }, { status: 500 });
    }
});