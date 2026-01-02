import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const currentUser = await base44.auth.me();

    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = currentUser.custom_role || (currentUser.role === 'admin' ? 'owner' : 'employee');
    
    // ⭐ เฉพาะ developer และ owner เท่านั้นที่ลบสิทธิ์ได้
    if (userRole !== 'developer' && userRole !== 'owner') {
      return Response.json({ error: 'Forbidden: Only developer/owner can remove test mode permission' }, { status: 403 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return Response.json({ error: 'userId is required' }, { status: 400 });
    }

    // ⭐ ใช้ service role เพื่อ update user
    const user = await base44.asServiceRole.entities.User.filter({ id: userId });
    
    if (!user || user.length === 0) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = user[0];
    const currentPermissions = targetUser.permissions || [];
    const newPermissions = currentPermissions.filter(p => p !== 'settings_access_test_mode');

    await base44.asServiceRole.entities.User.update(userId, { 
      permissions: newPermissions 
    });

    return Response.json({ 
      success: true, 
      message: 'ลบสิทธิ์โหมดทดสอบสำเร็จ',
      newPermissions 
    });

  } catch (error) {
    console.error('Remove test mode permission error:', error);
    return Response.json({ 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
});