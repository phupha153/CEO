import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const targetBranchId = body.branch_id;

    console.log('🔍 DEBUGGING ROOM 100');
    console.log(`📍 Branch: ${targetBranchId}`);

    // 1. Fetch Room 100
    const rooms = await base44.asServiceRole.entities.Room.filter(
      { branch_id: targetBranchId, room_number: '100' },
      '-created_date',
      10
    );

    if (!rooms || rooms.length === 0) {
      return Response.json({
        success: false,
        message: 'Room 100 not found',
        branch: targetBranchId
      });
    }

    const room = rooms[0];
    console.log(`✅ Room 100 found: ID=${room.id}`);

    // 2. Fetch all Bookings for this room
    const bookings = await base44.asServiceRole.entities.Booking.filter(
      { room_id: room.id },
      '-created_date',
      50
    );
    console.log(`📋 Bookings: ${bookings?.length || 0}`);

    // 3. Fetch Tenants that are linked to these bookings
    const tenantIds = new Set();
    if (bookings) {
      bookings.forEach(b => {
        if (b.tenant_id) tenantIds.add(b.tenant_id);
      });
    }

    const tenantsMap = new Map();
    if (tenantIds.size > 0) {
      const tenants = await base44.asServiceRole.entities.Tenant.filter(
        { id: { $in: Array.from(tenantIds) } },
        '-created_date',
        50
      );
      if (tenants) {
        tenants.forEach(t => tenantsMap.set(t.id, t));
      }
    }
    console.log(`👤 Tenants: ${tenantsMap.size}`);

    // 4. Fetch all active tenants in the branch
    const allTenants = await base44.asServiceRole.entities.Tenant.filter(
      { branch_id: targetBranchId },
      '-created_date',
      500
    );
    console.log(`📊 All tenants in branch: ${allTenants?.length || 0}`);

    // 5. Build HTML response
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Debug: Room 100</title>
        <style>
          body { font-family: monospace; padding: 20px; background: #f5f5f5; }
          .section { background: white; margin: 15px 0; padding: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          h2 { color: #333; border-bottom: 2px solid #007bff; padding-bottom: 8px; }
          .field { margin: 8px 0; }
          .label { color: #666; font-weight: bold; display: inline-block; min-width: 150px; }
          .value { color: #000; font-family: 'Courier New'; background: #f9f9f9; padding: 4px 8px; border-radius: 4px; }
          .array { background: #f0f0f0; margin: 8px 0; padding: 10px; border-radius: 4px; }
          .booking { background: #e8f4f8; margin: 8px 0; padding: 10px; border-left: 4px solid #007bff; }
          .tenant { background: #f0e8f8; margin: 8px 0; padding: 10px; border-left: 4px solid #9333ea; }
          .status-active { color: #28a745; font-weight: bold; }
          .status-moved { color: #dc3545; font-weight: bold; }
          code { background: #f9f9f9; padding: 2px 6px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <h1>🔍 Debug: Room 100</h1>
        
        <div class="section">
          <h2>🏠 Room Information</h2>
          <div class="field">
            <span class="label">ID:</span>
            <span class="value">${room.id}</span>
          </div>
          <div class="field">
            <span class="label">Room #:</span>
            <span class="value">${room.room_number}</span>
          </div>
          <div class="field">
            <span class="label">Branch:</span>
            <span class="value">${room.branch_id}</span>
          </div>
          <div class="field">
            <span class="label">Type:</span>
            <span class="value">${room.room_type}</span>
          </div>
          <div class="field">
            <span class="label">Status:</span>
            <span class="value" style="background: ${room.status === 'occupied' ? '#ffcccc' : '#ccffcc'}; padding: 6px; border-radius: 4px;">${room.status}</span>
          </div>
          <div class="field">
            <span class="label">Price:</span>
            <span class="value">${room.price} ฿</span>
          </div>
          <div class="field">
            <span class="label">Created:</span>
            <span class="value">${room.created_date?.substring(0, 10) || 'N/A'}</span>
          </div>
        </div>

        <div class="section">
          <h2>📋 Bookings for Room 100</h2>
          ${bookings && bookings.length > 0 ? `
            ${bookings.map((b, idx) => `
              <div class="booking">
                <strong>Booking ${idx + 1}</strong>
                <div class="field">
                  <span class="label">ID:</span>
                  <span class="value">${b.id}</span>
                </div>
                <div class="field">
                  <span class="label">Status:</span>
                  <span class="value">${b.status}</span>
                </div>
                <div class="field">
                  <span class="label">Tenant ID:</span>
                  <span class="value">${b.tenant_id}</span>
                </div>
                <div class="field">
                  <span class="label">Guest Name:</span>
                  <span class="value">${b.guest_name || 'N/A'}</span>
                </div>
                <div class="field">
                  <span class="label">Check-in:</span>
                  <span class="value">${b.check_in_date}</span>
                </div>
                <div class="field">
                  <span class="label">Check-out:</span>
                  <span class="value">${b.check_out_date || 'N/A'}</span>
                </div>
                <div class="field">
                  <span class="label">Created:</span>
                  <span class="value">${b.created_date?.substring(0, 10) || 'N/A'}</span>
                </div>
              </div>
            `).join('')}
          ` : '<p style="color: #999;">❌ No bookings found</p>'}
        </div>

        <div class="section">
          <h2>👤 Tenants Linked to Bookings</h2>
          ${tenantsMap.size > 0 ? `
            ${Array.from(tenantsMap.values()).map((t, idx) => `
              <div class="tenant">
                <strong>Tenant ${idx + 1}</strong>
                <div class="field">
                  <span class="label">ID:</span>
                  <span class="value">${t.id}</span>
                </div>
                <div class="field">
                  <span class="label">Name:</span>
                  <span class="value">${t.full_name}</span>
                </div>
                <div class="field">
                  <span class="label">Status:</span>
                  <span class="value ${t.status === 'moved_out' ? 'status-moved' : 'status-active'}">${t.status}</span>
                </div>
                <div class="field">
                  <span class="label">Phone:</span>
                  <span class="value">${t.phone || 'N/A'}</span>
                </div>
                <div class="field">
                  <span class="label">Email:</span>
                  <span class="value">${t.email || 'N/A'}</span>
                </div>
                <div class="field">
                  <span class="label">Prepaid Balance:</span>
                  <span class="value">${(t.prepaid_balance || 0).toLocaleString()} ฿</span>
                </div>
                <div class="field">
                  <span class="label">Created:</span>
                  <span class="value">${t.created_date?.substring(0, 10) || 'N/A'}</span>
                </div>
              </div>
            `).join('')}
          ` : '<p style="color: #999;">❌ No tenants found</p>'}
        </div>

        <div class="section">
          <h2>📊 Summary</h2>
          <div class="field">
            <span class="label">Bookings Count:</span>
            <span class="value">${bookings?.length || 0}</span>
          </div>
          <div class="field">
            <span class="label">Active Bookings:</span>
            <span class="value">${bookings?.filter(b => b.status === 'active').length || 0}</span>
          </div>
          <div class="field">
            <span class="label">Linked Tenants:</span>
            <span class="value">${tenantsMap.size}</span>
          </div>
          <div class="field">
            <span class="label">Moved-out Tenants:</span>
            <span class="value">${Array.from(tenantsMap.values()).filter(t => t.status === 'moved_out').length}</span>
          </div>
          <div class="field">
            <span class="label">Active Tenants:</span>
            <span class="value">${Array.from(tenantsMap.values()).filter(t => t.status === 'active').length}</span>
          </div>
        </div>
      </body>
      </html>
    `;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});