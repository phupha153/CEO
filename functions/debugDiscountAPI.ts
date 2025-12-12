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
        const CRM_SERVICE_ROLE_KEY = Deno.env.get("CRM_SERVICE_ROLE_KEY");

        console.log('🔍 Checking CRM credentials...');
        console.log('CRM_APP_ID:', CRM_APP_ID);
        console.log('Has CRM_API_KEY:', !!CRM_API_KEY);
        console.log('CRM_API_KEY length:', CRM_API_KEY?.length || 0);
        console.log('CRM_API_KEY first 10 chars:', CRM_API_KEY?.substring(0, 10) || 'N/A');
        console.log('Has CRM_SERVICE_ROLE_KEY:', !!CRM_SERVICE_ROLE_KEY);

        if (!CRM_API_KEY) {
            return Response.json({
                error: '❌ CRM_API_KEY ไม่ได้ตั้งค่า',
                has_service_role_key: !!CRM_SERVICE_ROLE_KEY,
                has_app_id: !!CRM_APP_ID
            });
        }

        // Test 1: ทดสอบหลาย header format
        const testCode = 'TEST123';
        const requestBody = {
            code: testCode,
            user_email: user.email,
            app_id: CRM_APP_ID
        };

        const tests = [
            { name: 'api_key header', headers: { 'Content-Type': 'application/json', 'api_key': CRM_API_KEY } },
            { name: 'x-api-key header', headers: { 'Content-Type': 'application/json', 'x-api-key': CRM_API_KEY } },
            { name: 'Authorization Bearer', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CRM_API_KEY}` } },
            { name: 'Authorization (no Bearer)', headers: { 'Content-Type': 'application/json', 'Authorization': CRM_API_KEY } }
        ];

        const results = [];

        for (const test of tests) {
            console.log(`\n🧪 Testing: ${test.name}`);
            console.log('Headers:', JSON.stringify(test.headers, null, 2));

            try {
                const response = await fetch(`https://connect-sphere-crm-8aa1f2d8.base44.app/api/apps/6919c20da02654368aa1f2d8/functions/validateDiscountCode`, {
                    method: 'POST',
                    headers: test.headers,
                    body: JSON.stringify(requestBody)
                });

                const responseText = await response.text();
                
                results.push({
                    test: test.name,
                    status: response.status,
                    ok: response.ok,
                    response: responseText.substring(0, 200)
                });

                console.log(`Status: ${response.status}`);
                console.log(`Response: ${responseText.substring(0, 200)}`);
            } catch (error) {
                results.push({
                    test: test.name,
                    error: error.message
                });
                console.error(`Error: ${error.message}`);
            }
        }

        return Response.json({
            credentials_check: {
                has_app_id: !!CRM_APP_ID,
                app_id: CRM_APP_ID,
                has_api_key: !!CRM_API_KEY,
                api_key_length: CRM_API_KEY?.length || 0,
                api_key_preview: CRM_API_KEY?.substring(0, 10) + '...',
                has_service_role_key: !!CRM_SERVICE_ROLE_KEY
            },
            test_results: results,
            recommendation: results.find(r => r.ok) ? 
                `✅ ใช้ ${results.find(r => r.ok).test} ได้` : 
                '❌ ไม่มี format ไหนทำงาน - ตรวจสอบ CRM_API_KEY'
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});