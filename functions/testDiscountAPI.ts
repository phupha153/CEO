import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const CRM_APP_ID = Deno.env.get("CRM_APP_ID");
        const CRM_API_KEY = Deno.env.get("CRM_API_KEY");

        console.log('🔍 Testing Discount API...');
        console.log('CRM_APP_ID:', CRM_APP_ID);
        console.log('Has CRM_API_KEY:', !!CRM_API_KEY);

        const testCode = 'TEST123';
        const requestBody = {
            code: testCode,
            user_email: user.email,
            app_id: CRM_APP_ID
        };

        console.log('📤 Request:', JSON.stringify(requestBody, null, 2));

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

        let data;
        try {
            data = JSON.parse(responseText);
        } catch {
            data = { raw: responseText };
        }

        return Response.json({
            success: response.ok,
            status: response.status,
            data: data,
            test_info: {
                crm_app_id: CRM_APP_ID,
                has_api_key: !!CRM_API_KEY,
                test_code: testCode
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});