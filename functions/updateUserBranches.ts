import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { accessible_branches } = await req.json();

    // อัปเดต accessible_branches ของ user
    await base44.auth.updateMe({
      accessible_branches: accessible_branches
    });

    return Response.json({ 
      success: true,
      message: 'Updated user branches successfully',
      accessible_branches 
    });

  } catch (error) {
    console.error('Error updating user branches:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});