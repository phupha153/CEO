import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔍 Counting data stats for user:', user.email);

    // นับแยกแต่ละ entity แบบ pagination
    const countEntity = async (entityName, testFields) => {
      try {
        let allRecords = [];
        let currentBatch = [];
        let skip = 0;
        const batchSize = 10000;

        // Fetch ทีละ 10000 records จนกว่าจะได้หมด
        do {
          currentBatch = await base44.entities[entityName].list('-created_date', batchSize);
          allRecords = allRecords.concat(currentBatch);
          skip += batchSize;

          console.log(`📊 ${entityName}: fetched ${allRecords.length} records so far...`);

          // ถ้าได้น้อยกว่า batchSize = หมดแล้ว
          if (currentBatch.length < batchSize) break;
        } while (currentBatch.length === batchSize);

        const total = allRecords.length;
        console.log(`📊 ${entityName}: total ${total} records`);

        // นับข้อมูลทดสอบ
        const testPatterns = [
          '[TEST-', 'TEST-', '[test-', 'test-',
          '[HEAVY-', 'HEAVY-', '[heavy-', 'heavy-',
          '[MASSIVE-', 'MASSIVE-', '[massive-', 'massive-',
          'ทดสอบ', 'mass_', 'MASS-'
        ];

        const testCount = allRecords.filter(r => {
          const checkFields = testFields.map(f => r[f]).filter(f => f && typeof f === 'string');
          return checkFields.some(field => 
            testPatterns.some(pattern => field.includes(pattern))
          );
        }).length;

        console.log(`📊 ${entityName}: ${testCount} test records out of ${total}`);

        return { total, test: testCount, real: total - testCount };
      } catch (error) {
        console.error(`❌ Error counting ${entityName}:`, error);
        return { total: 0, test: 0, real: 0 };
      }
    };

    const branches = await countEntity('Branch', ['branch_name', 'branch_code', 'description']);
    const rooms = await countEntity('Room', ['room_number', 'description']);
    const tenants = await countEntity('Tenant', ['full_name', 'notes']);
    const bookings = await countEntity('Booking', ['notes']);
    const payments = await countEntity('Payment', ['notes']);
    const meterReadings = await countEntity('MeterReading', ['notes']);
    const maintenance = await countEntity('MaintenanceRequest', ['title', 'description', 'notes']);
    const expenses = await countEntity('Expense', ['title', 'description', 'notes']);
    const contracts = await countEntity('Contract', ['notes', 'remarks']);

    const totalAll = branches.total + rooms.total + tenants.total + bookings.total + payments.total + meterReadings.total + maintenance.total + expenses.total + contracts.total;
    const totalTest = branches.test + rooms.test + tenants.test + bookings.test + payments.test + meterReadings.test + maintenance.test + expenses.test + contracts.test;
    const totalReal = branches.real + rooms.real + tenants.real + bookings.real + payments.real + meterReadings.real + maintenance.real + expenses.real + contracts.real;

    console.log(`✅ FINAL STATS - Total: ${totalAll}, Real: ${totalReal}, Test: ${totalTest}`);
    console.log('📊 Breakdown:', { branches, rooms, tenants, bookings, payments, meterReadings, maintenance, expenses, contracts });

    return Response.json({
      success: true,
      stats: {
        test: {
          branches: branches.test,
          rooms: rooms.test,
          tenants: tenants.test,
          bookings: bookings.test,
          payments: payments.test,
          meterReadings: meterReadings.test,
          maintenance: maintenance.test,
          expenses: expenses.test,
          contracts: contracts.test,
          total: totalTest
        },
        real: {
          branches: branches.real,
          rooms: rooms.real,
          tenants: tenants.real,
          bookings: bookings.real,
          payments: payments.real,
          meterReadings: meterReadings.real,
          maintenance: maintenance.real,
          expenses: expenses.real,
          contracts: contracts.real,
          total: totalReal
        },
        all: {
          branches: branches.total,
          rooms: rooms.total,
          tenants: tenants.total,
          bookings: bookings.total,
          payments: payments.total,
          meterReadings: meterReadings.total,
          maintenance: maintenance.total,
          expenses: expenses.total,
          contracts: contracts.total,
          total: totalAll
        }
      }
    });

  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    return Response.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
});