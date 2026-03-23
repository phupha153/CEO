import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { title, description, category, priority, image_urls } = body;

        const crmAppId = Deno.env.get('CRM_APP_ID');
        const crmServiceRoleKey = Deno.env.get('CRM_SERVICE_ROLE_KEY');

        if (!crmAppId || !crmServiceRoleKey) {
            return Response.json({ 
                error: 'ไม่พบการตั้งค่า CRM (CRM_APP_ID หรือ CRM_SERVICE_ROLE_KEY)'
            }, { status: 500 });
        }

        console.log('Creating CRM client with:', { 
            appId: crmAppId,
            hasServiceRoleKey: !!crmServiceRoleKey 
        });

        const crmClient = createClient({
            appId: crmAppId,
            serviceRoleKey: crmServiceRoleKey,
            baseURL: 'https://app.base44.com'
        });

        console.log('Creating Issue in CRM...');
        
        const ticket = await crmClient.entities.Issue.create({
            title: title || '',
            description: description || '',
            category: category || 'bug',
            priority: priority || 'medium',
            image_urls: image_urls || [],
            reporter_email: user.email || '',
            reporter_name: user.full_name || '',
            status: 'open'
        });

        console.log('Issue created successfully:', ticket.id);

        return Response.json({ 
            success: true, 
            ticket_id: ticket.id,
            message: 'ส่งรายงานไปยัง CRM สำเร็จ'
        });

    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            response: error.response?.data
        });
        
        return Response.json({ 
            error: 'เกิดข้อผิดพลาด: ' + error.message,
            details: error.response?.data || null
        }, { status: 500 });
    }
});