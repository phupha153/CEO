import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
      sort_by = 'due_date'
    } = await req.json();

    if (!branch_id) {
      return Response.json({ error: 'branch_id is required' }, { status: 400 });
    }

    // ✅ Step 1: Fetch configs for date range calculation
    const configs = await base44.entities.Config.list();
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
    // ถ้าไม่มี = จำกัดแค่ 1,000 records ล่าสุด
    const fetchLimit = dateRange ? 20000 : 1000;
    
    let payments = await base44.asServiceRole.entities.Payment.filter(
      filterQuery,
      `-${sort_by}`,
      fetchLimit,
      0
    );

    // ✅ Step 4: Fetch ALL rooms & tenants for this branch (Cache-friendly)
    // ⚠️ Base44 SDK ไม่รองรับ $in operator - ต้องโหลดทั้งสาขา
    const [rooms, tenants] = await Promise.all([
      base44.asServiceRole.entities.Room.filter({ branch_id }, '-room_number', 1000),
      base44.asServiceRole.entities.Tenant.filter({ branch_id }, '-created_date', 1000)
    ]);

    // ✅ Create Maps for O(1) lookup
    const roomsMap = new Map(rooms.map(r => [r.id, r]));
    const tenantsMap = new Map(tenants.map(t => [t.id, t]));

    // ✅ Step 5: Enrich payment data (Server-side JOIN simulation)
    const enrichedPayments = payments.map(payment => ({
      ...payment,
      room_number: roomsMap.get(payment.room_id)?.room_number || 'N/A',
      room_type: roomsMap.get(payment.room_id)?.room_type,
      tenant_name: tenantsMap.get(payment.tenant_id)?.full_name || 'N/A',
      tenant_phone: tenantsMap.get(payment.tenant_id)?.phone,
      tenant_line_user_id: tenantsMap.get(payment.tenant_id)?.line_user_id,
      tenant_facebook_user_id: tenantsMap.get(payment.tenant_id)?.facebook_user_id,
    }));

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

    // ✅ Step 8: Paginate
    const total = filtered.length;
    const paginatedData = filtered.slice(skip, skip + limit);

    return Response.json({
      success: true,
      data: paginatedData,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + limit < total
    });

  } catch (error) {
    console.error('getFilteredPayments error:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});