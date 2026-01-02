import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // ดึงข้อมูล current user
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // เช็คว่ามี User record อยู่แล้วหรือไม่
    const existingUsers = await base44.asServiceRole.entities.User.filter({ 
      email: currentUser.email 
    });

    if (existingUsers.length > 0) {
      // มีอยู่แล้ว ให้ update ข้อมูล
      const userId = existingUsers[0].id;
      await base44.asServiceRole.entities.User.update(userId, {
        full_name: currentUser.full_name,
        email: currentUser.email,
        role: currentUser.role,
        custom_role: currentUser.custom_role || (currentUser.role === 'admin' ? 'owner' : 'employee'),
        accessible_branches: currentUser.accessible_branches || [],
        permissions: currentUser.permissions || [],
        trial_ends_at: currentUser.trial_ends_at,
        plan_status: currentUser.plan_status || 'trial',
      });

      return Response.json({ 
        success: true, 
        message: 'User updated successfully',
        userId 
      });
    }

    // ถ้าไม่มี ให้สร้างใหม่
    const newUser = await base44.asServiceRole.entities.User.create({
      full_name: currentUser.full_name,
      email: currentUser.email,
      role: currentUser.role,
      custom_role: currentUser.custom_role || (currentUser.role === 'admin' ? 'owner' : 'employee'),
      accessible_branches: currentUser.accessible_branches || [],
      permissions: currentUser.permissions || [],
      trial_ends_at: currentUser.trial_ends_at,
      plan_status: currentUser.plan_status || 'trial',
    });

    return Response.json({ 
      success: true, 
      message: 'User created successfully',
      userId: newUser.id 
    });

  } catch (error) {
    console.error('Error syncing user:', error);
    return Response.json({ 
      error: error.message || 'Failed to sync user' 
    }, { status: 500 });
  }
});