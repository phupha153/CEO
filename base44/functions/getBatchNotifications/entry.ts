import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 🔒 Security: ตรวจสอบสิทธิ์
    const userRole = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
    const accessibleBranches = user.accessible_branches || [];

    // 🚀 Optimization: ดึงข้อมูลทั้งหมดในครั้งเดียว (Parallel) - เพิ่ม limit สำหรับ Room และ Tenant
    const [payments, rooms, maintenance, bookings, deliveries, tenants] = await Promise.all([
      base44.asServiceRole.entities.Payment.list('-created_date', 1000).then(r => r || []),
      base44.asServiceRole.entities.Room.list('-created_date', 5000).then(r => r || []),
      base44.asServiceRole.entities.MaintenanceRequest.list('-created_date', 500).then(r => r || []),
      base44.asServiceRole.entities.Booking.list('-created_date', 500).then(r => r || []),
      base44.asServiceRole.entities.MaterialDelivery.list('-created_date', 500).then(r => r || []),
      base44.asServiceRole.entities.Tenant.list('-created_date', 5000).then(r => r || [])
    ]);

    // 🔒 Security: กรองข้อมูลตามสิทธิ์
    const filterByBranch = (items) => {
      if (userRole === 'developer') return items;
      
      // Owner = กรองตาม accessible_branches (ถ้า set) หรือทุกสาขา (ถ้าไม่ set)
      if (userRole === 'owner') {
        if (accessibleBranches.length === 0) return items; // ไม่ set = ทุกสาขา
        return items.filter(item => accessibleBranches.includes(item.branch_id));
      }
      
      // Employee = เฉพาะ accessible_branches
      return items.filter(item => 
        item.branch_id && accessibleBranches.includes(item.branch_id)
      );
    };

    const filteredData = {
      payments: filterByBranch(payments),
      rooms: filterByBranch(rooms),
      maintenance: filterByBranch(maintenance),
      bookings: filterByBranch(bookings),
      deliveries: filterByBranch(deliveries),
      tenants: filterByBranch(tenants)
    };

    // ⭐ Debug: ตรวจสอบสาขาที่มีปัญหา
    const problematicBranch = '69256957890d2b5aaaca1d3f';
    const branchPayments = filteredData.payments.filter(p => p.branch_id === problematicBranch);
    const branchRooms = filteredData.rooms.filter(r => r.branch_id === problematicBranch);
    const branchTenants = filteredData.tenants.filter(t => t.branch_id === problematicBranch);
    
    console.log('📦 Batch Notifications Data:', {
      user: user.email,
      role: userRole,
      accessible_branches: accessibleBranches.length,
      counts: {
        payments: filteredData.payments.length,
        rooms: filteredData.rooms.length,
        maintenance: filteredData.maintenance.length,
        bookings: filteredData.bookings.length,
        deliveries: filteredData.deliveries.length,
        tenants: filteredData.tenants.length
      },
      debug_branch_69256957890d2b5aaaca1d3f: {
        payments: branchPayments.length,
        rooms: branchRooms.length,
        tenants: branchTenants.length,
        sample_payment_room_ids: branchPayments.slice(0, 3).map(p => p.room_id),
        sample_room_ids: branchRooms.slice(0, 3).map(r => r.id)
      }
    });

    return Response.json(filteredData);

  } catch (error) {
    console.error('getBatchNotifications error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});