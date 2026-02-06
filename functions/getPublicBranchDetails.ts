import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { branch_id } = await req.json();

    if (!branch_id) {
      return Response.json({ error: 'branch_id is required' }, { status: 400 });
    }

    // ดึงข้อมูลสาขา
    const branches = await base44.asServiceRole.entities.Branch.filter({ id: branch_id });
    const branch = branches[0] || null;

    // ดึง Config
    const allConfigs = await base44.asServiceRole.entities.Config.list('', 200);
    const configs = allConfigs.filter(c => !c.branch_id || c.branch_id === branch_id);

    // ดึงห้องว่าง
    const rooms = branch ? await base44.asServiceRole.entities.Room.filter({
      branch_id: branch_id,
      status: 'available',
      room_type: 'monthly'
    }, 'floor', 100) : [];

    return Response.json({
      branch,
      configs,
      availableRooms: rooms
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});