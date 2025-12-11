import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

        const CRM_SERVICE_ROLE_KEY = Deno.env.get("CRM_SERVICE_ROLE_KEY");
        const CRM_APP_ID = '6919c20da02654368aa1f2d8';

        if (!CRM_SERVICE_ROLE_KEY) {
            console.error('❌ Missing CRM_SERVICE_ROLE_KEY');
            return Response.json({
                valid: false,
                error: 'ระบบไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแล'
            });
        }

        // เรียก CRM ตรวจสอบโค้ดโดยตรงจาก entity DiscountCode
        const response = await fetch(`https://app.base44.com/api/apps/${CRM_APP_ID}/entities/DiscountCode?code=${encodeURIComponent(code.trim().toUpperCase())}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${CRM_SERVICE_ROLE_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ CRM fetch failed:', response.status, errorText);
            return Response.json({
                valid: false,
                error: 'ไม่สามารถตรวจสอบโค้ดได้'
            });
        }

        const data = await response.json();
        const discountCodes = Array.isArray(data) ? data : [];
        
        if (discountCodes.length === 0) {
            return Response.json({
                valid: false,
                error: 'โค้ดไม่ถูกต้อง'
            });
        }

        const discountCode = discountCodes[0];

        // เช็คว่าโค้ดยังใช้งานได้หรือไม่
        const now = new Date();
        const expiresAt = discountCode.expires_at ? new Date(discountCode.expires_at) : null;

        if (!discountCode.is_active) {
            return Response.json({
                valid: false,
                error: 'โค้ดนี้ถูกปิดการใช้งานแล้ว'
            });
        }

        if (expiresAt && now > expiresAt) {
            return Response.json({
                valid: false,
                error: 'โค้ดหมดอายุแล้ว'
            });
        }

        const maxUses = discountCode.max_uses || 0;
        const currentUses = discountCode.current_uses || 0;
        
        if (maxUses > 0 && currentUses >= maxUses) {
            return Response.json({
                valid: false,
                error: 'โค้ดถูกใช้งานครบแล้ว'
            });
        }

        return Response.json({
            valid: true,
            code: discountCode.code,
            discount_type: discountCode.discount_type,
            discount_value: discountCode.discount_value,
            max_uses: maxUses,
            current_uses: currentUses,
            remaining_uses: maxUses > 0 ? maxUses - currentUses : 999,
            expires_at: discountCode.expires_at,
            description: discountCode.description || ''
        });

    } catch (error) {
        console.error('❌ Error in validateDiscountCode:', error);
        return Response.json({ 
            valid: false,
            error: 'เกิดข้อผิดพลาด: ' + error.message 
        }, { status: 500 });
    }
});