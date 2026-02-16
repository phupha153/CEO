import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { branch_id, room_number } = await req.json();

    if (!branch_id || !room_number) {
      return Response.json({ error: 'Missing branch_id or room_number' }, { status: 400 });
    }

    // Find room
    const rooms = await base44.entities.Room.filter({
      branch_id,
      room_number: room_number.toString()
    });

    if (rooms.length === 0) {
      return Response.json({ error: 'Room not found' }, { status: 404 });
    }

    const room = rooms[0];

    // Find and delete bookings
    const bookings = await base44.entities.Booking.filter({
      branch_id,
      room_id: room.id
    });

    let deleted = 0;
    for (const booking of bookings) {
      await base44.entities.Booking.delete(booking.id);
      deleted++;
    }

    return Response.json({ 
      success: true, 
      message: `ลบการจอง ${deleted} รายการสำเร็จ`,
      room: room.room_number,
      bookings_deleted: deleted
    });
  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});