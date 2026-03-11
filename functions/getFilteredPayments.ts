import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      branch_id, 
      status_filter = 'all',
      date_range_type = 'this_month',
      custom_range,
      search_query = '',
      page = 1,
      limit = 50,
      sort_by = 'due_date',
      debug = false
    } = await req.json();

    const logs = [];

    if (!branch_id) {
      return Response.json({ error: 'branch_id is required' }, { status: 400 });
    }

    // 🔒 SECURITY: Multi-tenancy + Permission check
    const userRole = user.custom_role || (user.role === 'admin' ? 'owner' : 'employee');
    const userPermissions = user.permissions || [];
    const accessibleBranches = user.accessible_branches;

    // 1. เช็คสิทธิ์ดูข้อมูลการชำระเงิน
    const canView = userRole === 'developer' || userRole === 'owner' || userPermissions.includes('payments_view');
    if (!canView) {
      console.warn(`⚠️ Permission denied: ${user.email} → payments_view`);
      return Response.json({ error: 'No permission to view payments' }, { status: 403 });
    }

    // 2. เช็คสิทธิ์เข้าถึงสาขา
    const hasAccessibleBranchesSet = accessibleBranches !== null && accessibleBranches !== undefined;
    const hasAccess = (userRole === 'developer' && !hasAccessibleBranchesSet) || 
                      (accessibleBranches && accessibleBranches.includes(branch_id));

    if (!hasAccess) {
      console.warn(`⚠️ Branch access denied: ${user.email} → branch ${branch_id}`);
      return Response.json({ error: 'Access denied to this branch' }, { status: 403 });
    }

    // ✅ Step 1: Fetch configs (Cached in-memory)
    const CONFIGS_CACHE = globalThis.__configs_cache || (globalThis.__configs_cache = {});
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    
    if (!CONFIGS_CACHE.data || Date.now() - CONFIGS_CACHE.timestamp > CACHE_TTL) {
      CONFIGS_CACHE.data = await base44.asServiceRole.entities.Config.list();
      CONFIGS_CACHE.timestamp = Date.now();
    }
    const configs = CONFIGS_CACHE.data;
    const branchBillConfig = configs.find(c => c.key === 'bill_generation_day' && c.branch_id === branch_id);
    const globalBillConfig = configs.find(c => c.key === 'bill_generation_day' && !c.branch_id);
    const billGenerationDay = branchBillConfig ? parseInt(branchBillConfig.value) : (globalBillConfig ? parseInt(globalBillConfig.value) : 27);

    // ✅ Calculate date range
    const now = new Date();
    let dateRange = null;
    
    if (date_range_type !== 'all') {
      const currentDay = now.getDate();
      let cycleMonth = now.getMonth();
      let cycleYear = now.getFullYear();

      switch(date_range_type) {
        case 'this_month': {
          if (currentDay < billGenerationDay) {
            cycleMonth -= 1;
            if (cycleMonth < 0) { cycleMonth = 11; cycleYear -= 1; }
          }
          const from = new Date(cycleYear, cycleMonth, billGenerationDay);
          const to = new Date(cycleYear, cycleMonth + 1, billGenerationDay);
          dateRange = { from: from.toISOString(), to: to.toISOString() };
          break;
        }
        case 'last_month': {
          cycleMonth -= 1;
          if (currentDay < billGenerationDay) cycleMonth -= 1;
          if (cycleMonth < 0) { cycleMonth += 12; cycleYear -= 1; }
          const from = new Date(cycleYear, cycleMonth, billGenerationDay);
          const to = new Date(cycleYear, cycleMonth + 1, billGenerationDay);
          dateRange = { from: from.toISOString(), to: to.toISOString() };
          break;
        }
        case '3_months':
        case '6_months':
        case '12_months': {
          const monthsBack = date_range_type === '3_months' ? 2 : date_range_type === '6_months' ? 5 : 11;
          let startMonth = cycleMonth - monthsBack;
          let startYear = cycleYear;
          if (currentDay < billGenerationDay) startMonth -= 1;
          while (startMonth < 0) { startMonth += 12; startYear -= 1; }
          const from = new Date(startYear, startMonth, billGenerationDay);
          const to = new Date(cycleYear, cycleMonth + (currentDay >= billGenerationDay ? 1 : 0), billGenerationDay);
          dateRange = { from: from.toISOString(), to: to.toISOString() };
          break;
        }
        case 'custom':
          if (custom_range?.from && custom_range?.to) {
            dateRange = custom_range;
          }
          break;
      }
    }

    // ✅ Step 2: Build filter query (Server-side)
    const filterQuery = { branch_id };
    
    if (dateRange) {
      filterQuery.due_date = {
        $gte: dateRange.from,
        $lte: dateRange.to
      };
    }

    // ✅ Step 3: Fetch payments (Smart limit based on filters)
    const skip = (page - 1) * limit;
    
    // ⭐ ถ้ามี date range = โหลดเฉพาะช่วงนั้น (ประหยัดหน่วยความจำ)
    // ถ้าไม่มี = จำกัดแค่ 5,000 records ล่าสุด (เพิ่มจาก 1000)
    const fetchLimit = dateRange ? 20000 : 5000;
    
    let payments = await base44.asServiceRole.entities.Payment.filter(
      filterQuery,
      `-${sort_by}`,
      fetchLimit,
      0
    );

    const step3Data = {
      count: payments.length,
      filterQuery: JSON.stringify(filterQuery),
      dateRange,
      first_payment_due_date: payments[0]?.due_date
    };
    console.log('🔍 Step 3 - Fetched payments:', step3Data);
    if (debug) logs.push({ step: 'Step 3: Fetched Payments', data: step3Data });

    // ✅ Step 4: Fetch ALL rooms & tenants for this branch (Cache-friendly)
    // ⚠️ Base44 SDK ไม่รองรับ $in operator - ต้องโหลดทั้งสาขา
    const [rooms, tenants, tempBookings, activeBookings] = await Promise.all([
      base44.asServiceRole.entities.Room.filter({ branch_id }, '-room_number', 1000),
      base44.asServiceRole.entities.Tenant.filter({ branch_id }, '-created_date', 1000),
      base44.asServiceRole.entities.TemporaryBooking.filter({ branch_id }, '-created_date', 1000),
      base44.asServiceRole.entities.Booking.filter({ branch_id, status: 'active' }, '-created_date', 1000)
    ]);

    // ✅ Create Maps for O(1) lookup
    const roomsMap = new Map(rooms.map(r => [r.id, r]));
    const tenantsMap = new Map(tenants.map(t => [t.id, t]));
    const tempBookingsMap = new Map(tempBookings.map(b => [b.id, b]));
    const activeBookingsMap = new Map(activeBookings.map(b => [b.id, b]));

    const step4Data = {
      rooms_count: rooms.length,
      tenants_count: tenants.length,
      temp_bookings_count: tempBookings.length,
      active_bookings_count: activeBookings.length
    };
    console.log('🔍 Step 4 - Rooms & Tenants & Bookings:', step4Data);
    if (debug) logs.push({ step: 'Step 4: Rooms & Tenants & Bookings', data: step4Data });

    // ✅ Step 5: Enrich payment data (Server-side JOIN simulation)
    const enrichedPayments = payments.map(payment => {
      const tenant = tenantsMap.get(payment.tenant_id);
      let tenantName = tenant?.full_name;
      
      if (!tenantName && payment.booking_id) {
        const tempBooking = tempBookingsMap.get(payment.booking_id);
        const activeBooking = activeBookingsMap.get(payment.booking_id);
        
        if (tempBooking && tempBooking.guest_name) {
          tenantName = tempBooking.guest_name + " (จองออนไลน์)";
        } else if (activeBooking && activeBooking.guest_name) {
          tenantName = activeBooking.guest_name;
        }
      }

      return {
        ...payment,
        room_number: roomsMap.get(payment.room_id)?.room_number || 'N/A',
        room_type: roomsMap.get(payment.room_id)?.room_type,
        tenant_name: tenantName || 'N/A',
        tenant_phone: tenant?.phone,
        tenant_line_user_id: tenant?.line_user_id || null,
        tenant_facebook_user_id: tenant?.facebook_user_id || null,
        line_user_id: payment.line_user_id || tenant?.line_user_id || null,
        facebook_user_id: tenant?.facebook_user_id || null,
      };
    });

    const step5Data = {
      enriched_count: enrichedPayments.length,
      first_enriched: enrichedPayments[0]
    };
    console.log('🔍 Step 5 - Enriched:', step5Data);
    if (debug) logs.push({ step: 'Step 5: Enriched', data: step5Data });

    // ✅ Step 6: Apply additional filters (status, search)
    let filtered = enrichedPayments;

    // Calculate effective status (server-side)
    if (status_filter !== 'all') {
      const lateFeeConfig = configs.find(c => c.key === 'late_payment_fee_per_day');
      
      filtered = filtered.filter(payment => {
        let effectiveStatus = payment.status;
        
        if (payment.status === 'pending' && payment.due_date) {
          const dueDate = new Date(payment.due_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          dueDate.setHours(0, 0, 0, 0);
          
          if (today > dueDate) {
            effectiveStatus = 'overdue';
          }
        }
        
        return effectiveStatus === status_filter;
      });
    }

    // Search filter
    if (search_query.trim()) {
      const query = search_query.toLowerCase();
      filtered = filtered.filter(payment => 
        payment.room_number?.toLowerCase().includes(query) ||
        payment.tenant_name?.toLowerCase().includes(query) ||
        payment.tenant_phone?.toLowerCase().includes(query) ||
        payment.notes?.toLowerCase().includes(query)
      );
    }

    // ✅ Step 7: Sort
    filtered.sort((a, b) => {
      switch (sort_by) {
        case 'room':
          return (a.room_number || '').localeCompare(b.room_number || '', 'th', { numeric: true });
        case 'created_date':
          return new Date(b.created_date) - new Date(a.created_date);
        case 'amount':
          return (b.total_amount || 0) - (a.total_amount || 0);
        case 'due_date':
        default:
          return new Date(b.due_date || 0) - new Date(a.due_date || 0);
      }
    });

    // ✅ Step 8: Paginate + Calculate counts AFTER filtering
    const total = filtered.length;
    const paginatedData = filtered.slice(skip, skip + limit);
    
    const step8aData = {
      enriched_count: enrichedPayments.length,
      filtered_count: filtered.length,
      paginated_count: paginatedData.length
    };
    console.log('🔍 Step 8 - Before counts:', step8aData);
    if (debug) logs.push({ step: 'Step 8a: Before Counts', data: step8aData });
    
    // 🔢 Calculate counts from ENRICHED data (before status filter, for all tabs)
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    
    const counts = {
      all: enrichedPayments.length,
      paid: enrichedPayments.filter(p => p.status === 'paid').length,
      pending: enrichedPayments.filter(p => {
        if (p.status === 'paid') return false;
        if (!p.due_date) return true;
        try {
          const dueDate = new Date(p.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return todayDate <= dueDate;
        } catch {
          return true;
        }
      }).length,
      overdue: enrichedPayments.filter(p => {
        if (p.status === 'paid') return false;
        if (!p.due_date) return false;
        try {
          const dueDate = new Date(p.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return todayDate > dueDate;
        } catch {
          return false;
        }
      }).length,
      partial_paid: enrichedPayments.filter(p => p.status === 'partial_paid').length,
    };

    console.log('🔍 Step 8 - Counts:', counts);
    if (debug) logs.push({ step: 'Step 8b: Counts Calculated', data: counts });

    const result = {
      success: true,
      data: paginatedData,
      counts, // ✅ Total counts (ignoring status filter)
      total,  // ✅ Count after status filter
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total,
      logs: debug ? logs : undefined
    };

    const finalData = {
      data_count: result.data.length,
      counts: result.counts,
      total: result.total
    };
    console.log('🔍 Final Response:', finalData);
    if (debug) logs.push({ step: 'Final Response', data: finalData });

    return Response.json(result);

  } catch (error) {
    console.error('❌ getFilteredPayments ERROR:', {
      user: user?.email,
      branch_id: req.url,
      error: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n')
    });
    
    return Response.json({ 
      error: 'Internal server error',
      details: error.message,
      success: false 
    }, { status: 500 });
  }
});