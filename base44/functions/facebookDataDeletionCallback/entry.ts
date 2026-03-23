import { createClient } from 'npm:@base44/sdk@0.8.19';
import { createHmac } from "node:crypto";

Deno.serve(async (req) => {
    try {
        if (req.method !== 'POST') {
            return new Response('Method Not Allowed', { status: 405 });
        }

        const formData = await req.formData();
        const signedRequest = formData.get('signed_request');

        if (!signedRequest) {
            return Response.json({ error: 'Missing signed_request' }, { status: 400 });
        }

        // Parse signed request
        const parsed = parseSignedRequest(signedRequest);
        if (!parsed) {
            return Response.json({ error: 'Invalid signed request' }, { status: 400 });
        }

        const userId = parsed.user_id;
        console.log('📩 Facebook Data Deletion Request for User ID:', userId);

        // Initialize Base44 SDK
        const base44 = createClient({
            appId: Deno.env.get('BASE44_APP_ID'),
            serviceRoleKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
        });

        // Find and delete user data associated with this Facebook User ID
        try {
            const tenants = await base44.asServiceRole.entities.Tenant.filter({
                facebook_user_id: userId
            });

            for (const tenant of tenants) {
                // Clear Facebook User ID from tenant record
                await base44.asServiceRole.entities.Tenant.update(tenant.id, {
                    facebook_user_id: null
                });
                console.log(`✅ Cleared Facebook ID for tenant: ${tenant.full_name}`);
            }
        } catch (error) {
            console.error('Error deleting user data:', error);
        }

        // Generate confirmation code and status URL
        const confirmationCode = `FB-DEL-${Date.now()}-${userId.substring(0, 8)}`;
        const statusUrl = `https://app.base44.com/api/6904ea5ce861be65483eff6e/functions/facebookDeletionStatus?code=${confirmationCode}`;

        console.log('✅ Data deletion processed:', { userId, confirmationCode });

        // Return required response format
        return Response.json({
            url: statusUrl,
            confirmation_code: confirmationCode
        });

    } catch (error) {
        console.error('❌ Facebook Data Deletion Callback Error:', error);
        return Response.json({ 
            error: 'Internal Server Error',
            message: error.message 
        }, { status: 500 });
    }
});

function parseSignedRequest(signedRequest) {
    try {
        const [encodedSig, payload] = signedRequest.split('.', 2);
        
        if (!encodedSig || !payload) {
            console.error('Invalid signed request format');
            return null;
        }

        const secret = Deno.env.get('FACEBOOK_APP_SECRET');
        if (!secret) {
            console.error('FACEBOOK_APP_SECRET not configured');
            return null;
        }

        // Decode signature
        const sig = base64UrlDecode(encodedSig);
        
        // Decode payload
        const data = JSON.parse(base64UrlDecode(payload));

        // Verify signature
        const expectedSig = createHmac('sha256', secret)
            .update(payload)
            .digest();

        if (!sig.equals(expectedSig)) {
            console.error('Bad Signed JSON signature!');
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error parsing signed request:', error);
        return null;
    }
}

function base64UrlDecode(input) {
    // Replace URL-safe characters
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/');
    
    // Add padding if needed
    while (base64.length % 4) {
        base64 += '=';
    }
    
    // Decode base64 to string
    const binaryString = atob(base64);
    
    // Convert to Buffer for signature comparison
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // For text data (payload), return string
    if (input === arguments[0]) {
        return binaryString;
    }
    
    return Buffer.from(bytes);
}