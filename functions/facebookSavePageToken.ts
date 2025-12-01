import { createClient } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const body = await req.json();
        const { branch_id, page_id, access_token, page_name } = body;

        if (!branch_id || !page_id || !access_token) {
            return Response.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const base44 = createClient({
            appId: Deno.env.get('BASE44_APP_ID'),
            serviceToken: Deno.env.get('BASE44_SERVICE_TOKEN')
        });

        // บันทึก Page Access Token
        const existingTokenConfigs = await base44.asServiceRole.entities.Config.filter({
            branch_id: branch_id,
            key: 'facebook_page_access_token'
        });

        const tokenData = {
            branch_id: branch_id,
            key: 'facebook_page_access_token',
            value: access_token,
            value_type: 'string',
            description: `Facebook Page: ${page_name || 'Unknown'}`,
            category: 'notification'
        };

        if (existingTokenConfigs.length > 0) {
            await base44.asServiceRole.entities.Config.update(existingTokenConfigs[0].id, tokenData);
        } else {
            await base44.asServiceRole.entities.Config.create(tokenData);
        }

        // บันทึก Page ID
        const existingPageIdConfigs = await base44.asServiceRole.entities.Config.filter({
            branch_id: branch_id,
            key: 'facebook_page_id'
        });

        const pageIdData = {
            branch_id: branch_id,
            key: 'facebook_page_id',
            value: page_id,
            value_type: 'string',
            description: `Facebook Page ID: ${page_name || 'Unknown'}`,
            category: 'notification'
        };

        if (existingPageIdConfigs.length > 0) {
            await base44.asServiceRole.entities.Config.update(existingPageIdConfigs[0].id, pageIdData);
        } else {
            await base44.asServiceRole.entities.Config.create(pageIdData);
        }

        // บันทึก Page Name
        const existingPageNameConfigs = await base44.asServiceRole.entities.Config.filter({
            branch_id: branch_id,
            key: 'facebook_page_name'
        });

        const pageNameData = {
            branch_id: branch_id,
            key: 'facebook_page_name',
            value: page_name || 'Facebook Page',
            value_type: 'string',
            description: 'ชื่อ Facebook Page ที่เชื่อมต่อ',
            category: 'notification'
        };

        if (existingPageNameConfigs.length > 0) {
            await base44.asServiceRole.entities.Config.update(existingPageNameConfigs[0].id, pageNameData);
        } else {
            await base44.asServiceRole.entities.Config.create(pageNameData);
        }

        return Response.json({ 
            success: true,
            message: `เชื่อมต่อกับ ${page_name} สำเร็จ`
        });

    } catch (error) {
        console.error('Save Page Token Error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});