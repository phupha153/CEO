Deno.serve(async (req) => {
    const appId = Deno.env.get('FACEBOOK_APP_ID');
    
    if (!appId) {
        return Response.json({ 
            error: 'FACEBOOK_APP_ID not configured' 
        }, { status: 500 });
    }

    return Response.json({ appId });
});