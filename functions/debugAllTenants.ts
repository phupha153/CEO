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

    console.log('🔍 DEBUGGING ALL TENANTS');
    console.log(`📍 Branch: ${targetBranchId}`);

    // 1. Fetch all Tenants
    const allTenants = await base44.asServiceRole.entities.Tenant.filter(
      { branch_id: targetBranchId },
      '-created_date',
      1000
    );
    console.log(`📊 Total tenants: ${allTenants?.length || 0}`);

    // 2. Fetch all Bookings
    const allBookings = await base44.asServiceRole.entities.Booking.filter(
      { branch_id: targetBranchId },
      '-created_date',
      1000
    );
    console.log(`📋 Total bookings: ${allBookings?.length || 0}`);

    // 3. Map bookings by tenant_id
    const bookingsByTenant = new Map();
    if (allBookings) {
      allBookings.forEach(b => {
        if (b.tenant_id) {
          if (!bookingsByTenant.has(b.tenant_id)) {
            bookingsByTenant.set(b.tenant_id, []);
          }
          bookingsByTenant.get(b.tenant_id).push(b);
        }
      });
    }

    // 4. Build HTML response
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Debug: All Tenants</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f5f5f5; }
          .container { max-width: 1200px; margin: 0 auto; }
          h1 { color: #333; }
          .summary { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .summary-item { display: inline-block; margin-right: 30px; }
          .summary-label { color: #666; font-size: 12px; }
          .summary-value { font-size: 24px; font-weight: bold; color: #007bff; }
          .tenant-card { background: white; margin: 10px 0; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; }
          .tenant-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
          .tenant-name { font-size: 18px; font-weight: bold; }
          .tenant-status { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; }
          .status-active { background: #d4edda; color: #155724; }
          .status-moved { background: #f8d7da; color: #721c24; }
          .tenant-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; font-size: 12px; margin: 10px 0; }
          .info-item { }
          .info-label { color: #666; font-weight: bold; }
          .info-value { color: #333; margin-top: 2px; font-family: monospace; }
          .booking-section { background: #f0f0f0; padding: 10px; border-radius: 4px; margin-top: 10px; }
          .booking-item { background: white; padding: 8px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #28a745; font-size: 12px; }
          .no-booking { color: #dc3545; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; background: white; margin-top: 15px; }
          th { background: #007bff; color: white; padding: 12px; text-align: left; font-size: 12px; }
          td { padding: 10px 12px; border-bottom: 1px solid #ddd; font-size: 12px; }
          tr:hover { background: #f9f9f9; }
          .no-data { color: #999; text-align: center; padding: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🔍 Debug: All Tenants in Branch</h1>
          
          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Total Tenants</div>
              <div class="summary-value">${allTenants?.length || 0}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Bookings</div>
              <div class="summary-value">${allBookings?.length || 0}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Active Status</div>
              <div class="summary-value">${allTenants?.filter(t => t.status === 'active').length || 0}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Moved Out</div>
              <div class="summary-value">${allTenants?.filter(t => t.status === 'moved_out').length || 0}</div>
            </div>
          </div>

          <h2>📋 Tenant Details</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Tenant Name</th>
                <th>Status</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Bookings</th>
                <th>Room(s)</th>
                <th>Prepaid</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              ${allTenants && allTenants.length > 0 ? allTenants.map((t, idx) => {
                const tenantBookings = bookingsByTenant.get(t.id) || [];
                const rooms = tenantBookings.map(b => b.room_id || 'N/A').join(', ');
                return `
                  <tr>
                    <td>${idx + 1}</td>
                    <td><strong>${t.full_name}</strong></td>
                    <td><span class="tenant-status ${t.status === 'moved_out' ? 'status-moved' : 'status-active'}">${t.status}</span></td>
                    <td>${t.phone || '-'}</td>
                    <td>${t.email || '-'}</td>
                    <td>${tenantBookings.length}</td>
                    <td>${rooms || '❌ ไม่มี'}</td>
                    <td>${(t.prepaid_balance || 0).toLocaleString()} ฿</td>
                    <td>${t.created_date?.substring(0, 10) || 'N/A'}</td>
                  </tr>
                `;
              }).join('') : '<tr><td colspan="9" class="no-data">ไม่มีข้อมูล</td></tr>'}
            </tbody>
          </table>

          <h2 style="margin-top: 30px;">🔎 Detailed View (Tenants with Bookings)</h2>
          ${bookingsByTenant.size > 0 ? Array.from(bookingsByTenant.entries()).map(([tenantId, bookings]) => {
            const tenant = allTenants?.find(t => t.id === tenantId);
            if (!tenant) return '';
            return `
              <div class="tenant-card">
                <div class="tenant-header">
                  <div>
                    <div class="tenant-name">${tenant.full_name}</div>
                    <div style="font-size: 12px; color: #666;">${tenantId}</div>
                  </div>
                  <span class="tenant-status ${tenant.status === 'moved_out' ? 'status-moved' : 'status-active'}">${tenant.status}</span>
                </div>
                <div class="tenant-info">
                  <div class="info-item">
                    <div class="info-label">Phone</div>
                    <div class="info-value">${tenant.phone || 'N/A'}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Email</div>
                    <div class="info-value">${tenant.email || 'N/A'}</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Prepaid Balance</div>
                    <div class="info-value">${(tenant.prepaid_balance || 0).toLocaleString()} ฿</div>
                  </div>
                  <div class="info-item">
                    <div class="info-label">Created</div>
                    <div class="info-value">${tenant.created_date?.substring(0, 10) || 'N/A'}</div>
                  </div>
                </div>
                <div class="booking-section">
                  <strong>Bookings (${bookings.length}):</strong>
                  ${bookings.map(b => `
                    <div class="booking-item">
                      📋 Room: <strong>${b.room_id}</strong> | Status: ${b.status} | Check-in: ${b.check_in_date}
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('') : '<div class="no-data">❌ ไม่มี Tenant ที่มี Booking</div>'}

          <h2 style="margin-top: 30px;">⚠️ Tenants WITHOUT Bookings</h2>
          ${allTenants && allTenants.filter(t => !bookingsByTenant.has(t.id)).length > 0 ? `
            <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 10px 0;">
              ${allTenants.filter(t => !bookingsByTenant.has(t.id)).map((tenant, idx) => `
                <div class="tenant-card" style="border-left-color: #ffc107;">
                  <div class="tenant-header">
                    <div>
                      <div class="tenant-name">${tenant.full_name}</div>
                      <div style="font-size: 12px; color: #666;">${tenant.id}</div>
                    </div>
                    <span class="tenant-status ${tenant.status === 'moved_out' ? 'status-moved' : 'status-active'}">${tenant.status}</span>
                  </div>
                  <div style="color: #dc3545; font-weight: bold;">❌ NO BOOKING</div>
                  <div class="tenant-info" style="margin-top: 10px;">
                    <div class="info-item">
                      <div class="info-label">Phone</div>
                      <div class="info-value">${tenant.phone || 'N/A'}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Email</div>
                      <div class="info-value">${tenant.email || 'N/A'}</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Prepaid Balance</div>
                      <div class="info-value">${(tenant.prepaid_balance || 0).toLocaleString()} ฿</div>
                    </div>
                    <div class="info-item">
                      <div class="info-label">Created</div>
                      <div class="info-value">${tenant.created_date?.substring(0, 10) || 'N/A'}</div>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : '<div class="no-data">✅ ทุก Tenant มี Booking</div>'}
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