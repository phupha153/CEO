import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const targetBranchId = body.branch_id;

    console.log('🔬 SDK Test - branch_id:', targetBranchId);

    // Test 1: list() without params
    const listResult = await base44.asServiceRole.entities.Room.list('-room_number', 10, 0);
    console.log('Test 1 - list() result count:', Array.isArray(listResult) ? listResult.length : 'not array', typeof listResult);
    if (Array.isArray(listResult) && listResult.length > 0) {
        console.log('Test 1 - sample item keys:', Object.keys(listResult[0]));
        console.log('Test 1 - sample item[0]:', JSON.stringify(listResult[0]).substring(0, 300));
    }

    // Test 2: try different sort fields
    const t2a = await base44.asServiceRole.entities.Room.list('-room_number', 10, 0);
    const t2b = await base44.asServiceRole.entities.Room.list('-created_date', 10, 0);
    const t2c = await base44.asServiceRole.entities.Room.list('', 10, 0);
    const t2d = await base44.asServiceRole.entities.Room.list('-updated_date', 10, 0);
    
    console.log('sort -room_number:', Array.isArray(t2a) ? t2a.length : typeof t2a);
    console.log('sort -created_date:', Array.isArray(t2b) ? t2b.length : typeof t2b);
    console.log('sort empty:', Array.isArray(t2c) ? t2c.length : typeof t2c);
    console.log('sort -updated_date:', Array.isArray(t2d) ? t2d.length : typeof t2d);

    return Response.json({
        sortRoomNumber: Array.isArray(t2a) ? { count: t2a.length, sample_branch: t2a[0]?.branch_id } : { type: typeof t2a },
        sortCreatedDate: Array.isArray(t2b) ? { count: t2b.length, sample_branch: t2b[0]?.branch_id } : { type: typeof t2b },
        sortEmpty: Array.isArray(t2c) ? { count: t2c.length } : { type: typeof t2c },
        sortUpdatedDate: Array.isArray(t2d) ? { count: t2d.length } : { type: typeof t2d },
    });
});