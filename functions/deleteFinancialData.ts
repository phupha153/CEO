import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Verify user is authenticated
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Parse request body for optional branch filter
        let targetBranchId = null;
        try {
            const text = await req.text();
            if (text && text.trim()) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
            }
        } catch (e) {
            // No body or invalid JSON - delete all
        }

        console.log('🗑️ Starting financial data deletion...');
        console.log('Target branch:', targetBranchId || 'ALL');

        const results = {
            payments: 0,
            expenses: 0,
            meterReadings: 0
        };

        // Helper function to delete all records of an entity
        const deleteAllRecords = async (entityName, filter = {}) => {
            let deletedCount = 0;
            let hasMore = true;

            while (hasMore) {
                const records = await base44.asServiceRole.entities[entityName].filter(filter, '-created_date', 100);
                
                if (!records || records.length === 0) {
                    hasMore = false;
                    break;
                }

                for (const record of records) {
                    try {
                        await base44.asServiceRole.entities[entityName].delete(record.id);
                        deletedCount++;
                    } catch (e) {
                        console.error(`Failed to delete ${entityName} ${record.id}:`, e.message);
                    }
                }

                console.log(`Deleted ${deletedCount} ${entityName} records so far...`);
            }

            return deletedCount;
        };

        const filter = targetBranchId ? { branch_id: targetBranchId } : {};

        // Delete Payments
        console.log('🧾 Deleting Payments...');
        results.payments = await deleteAllRecords('Payment', filter);

        // Delete Expenses
        console.log('💰 Deleting Expenses...');
        results.expenses = await deleteAllRecords('Expense', filter);

        // Delete Meter Readings
        console.log('📊 Deleting Meter Readings...');
        results.meterReadings = await deleteAllRecords('MeterReading', filter);

        const totalDeleted = results.payments + results.expenses + results.meterReadings;

        console.log('✅ Financial data deletion completed!');
        console.log(`Total deleted: ${totalDeleted} records`);

        return Response.json({
            success: true,
            message: `ลบข้อมูลการเงินสำเร็จ ${totalDeleted} รายการ`,
            details: {
                payments: results.payments,
                expenses: results.expenses,
                meterReadings: results.meterReadings
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});