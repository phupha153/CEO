import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { line_user_id } = await req.json();

    if (!line_user_id) {
      return Response.json({ error: 'Missing line_user_id' }, { status: 400 });
    }

    // Find Tenant by line_user_id
    const tenants = await base44.asServiceRole.entities.Tenant.filter({ line_user_id });
    const tenantIds = tenants.map(t => t.id);

    // Find TemporaryBookings
    const tempBookings = await base44.asServiceRole.entities.TemporaryBooking.filter({ line_user_id });

    // Find Bookings
    let bookings = [];
    let payments = [];

    if (tenantIds.length > 0) {
      const allBookings = await Promise.all(tenantIds.map(tid => base44.asServiceRole.entities.Booking.filter({ tenant_id: tid })));
      bookings = allBookings.flat();

      const allPayments = await Promise.all(tenantIds.map(tid => base44.asServiceRole.entities.Payment.filter({ tenant_id: tid })));
      payments = allPayments.flat();
    }

    // Fetch payments for TemporaryBookings
    if (tempBookings.length > 0) {
      const tempBookingIds = tempBookings.map(b => b.id);
      const tempPaymentsResult = await Promise.all(tempBookingIds.map(id => base44.asServiceRole.entities.Payment.filter({ booking_id: id })));
      const tempPayments = tempPaymentsResult.flat();
      
      // Add only unique payments
      const existingPaymentIds = new Set(payments.map(p => p.id));
      for (const p of tempPayments) {
        if (!existingPaymentIds.has(p.id)) {
          payments.push(p);
          existingPaymentIds.add(p.id);
        }
      }
    }

    // Get rooms info
    const allRoomIds = [...new Set([
      ...tempBookings.map(b => b.room_id),
      ...bookings.map(b => b.room_id)
    ])];

    let rooms = [];
    if (allRoomIds.length > 0) {
      const roomPromises = allRoomIds.map(rid => base44.asServiceRole.entities.Room.filter({ id: rid }));
      const roomsResult = await Promise.all(roomPromises);
      rooms = roomsResult.flat();
    }

    // Attach room info
    const attachRoom = (item) => ({
      ...item,
      room: rooms.find(r => r.id === item.room_id)
    });

    return Response.json({
      tempBookings: tempBookings.map(attachRoom),
      bookings: bookings.map(attachRoom),
      payments: payments
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});