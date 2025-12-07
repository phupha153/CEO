import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// เก็บ progress ใน KV store เพื่อให้ function อื่นเข้าถึงได้
const kv = await Deno.openKv();

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();
        
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const branchId = body.branch_id;
        
        if (!branchId) {
            return Response.json({ error: 'branch_id is required' }, { status: 400 });
        }

        console.log(`🗑️ Starting background deletion for branch: ${branchId}`);

        // นับจำนวนทั้งหมดก่อน
        const allPayments = await base44.asServiceRole.entities.Payment.filter(
            { branch_id: branchId },
            '-created_date',
            10000
        );
        const totalPayments = allPayments.length;

        // บันทึก initial progress
        await kv.set(['delete_progress', branchId], {
            deleted: 0,
            remaining: totalPayments,
            initial: totalPayments,
            timestamp: Date.now()
        });

        // Return ทันที - ให้ลบต่อในพื้นหลัง
        const response = Response.json({
            success: true,
            message: 'เริ่มลบข้อมูลในพื้นหลัง',
            started: true,
            totalPayments: totalPayments
        });

        // ทำงานต่อในพื้นหลังโดยไม่ block response
        (async () => {
            const batchSize = 3; // ลดเหลือ 3 เพื่อหลีกเลี่ยง rate limit
            let totalDeleted = 0;
            let roundCount = 0;

            try {
                while (true) {
                    roundCount++;
                    const payments = await base44.asServiceRole.entities.Payment.filter(
                        { branch_id: branchId }, 
                        '-created_date', 
                        batchSize
                    );

                    if (!payments || payments.length === 0) {
                        console.log(`✅ Deletion completed! Total deleted: ${totalDeleted}`);
                        await kv.set(['delete_progress', branchId], {
                            deleted: totalDeleted,
                            remaining: 0,
                            initial: totalPayments,
                            completed: true,
                            timestamp: Date.now()
                        });
                        break;
                    }

                    for (const payment of payments) {
                        let retries = 0;
                        while (retries < 3) {
                            try {
                                await base44.asServiceRole.entities.Payment.delete(payment.id);
                                totalDeleted++;
                                // เพิ่ม delay 1 วินาทีระหว่างการลบแต่ละรายการ
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                break;
                            } catch (e) {
                                if (e.message?.includes('Rate limit') && retries < 2) {
                                    retries++;
                                    console.warn(`⚠️ Rate limit hit, retry ${retries}/3 for ${payment.id}`);
                                    await new Promise(resolve => setTimeout(resolve, 10000)); // รอ 10 วินาทีก่อน retry
                                } else {
                                    console.error(`❌ Error deleting ${payment.id}:`, e.message);
                                    break;
                                }
                            }
                        }
                    }

                    // อัปเดต progress
                    const remaining = totalPayments - totalDeleted;
                    await kv.set(['delete_progress', branchId], {
                        deleted: totalDeleted,
                        remaining: Math.max(0, remaining),
                        initial: totalPayments,
                        timestamp: Date.now()
                    });

                    console.log(`✅ Round ${roundCount}: Deleted ${payments.length} (Total: ${totalDeleted}/${totalPayments} - เหลือ ${remaining})`);

                    // เพิ่ม delay 5 วินาทีระหว่างแต่ละรอบเพื่อหลีกเลี่ยง rate limit
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            } catch (error) {
                console.error(`❌ Background deletion error:`, error.message);
                await kv.set(['delete_progress', branchId], {
                    deleted: totalDeleted,
                    remaining: totalPayments - totalDeleted,
                    initial: totalPayments,
                    error: error.message,
                    timestamp: Date.now()
                });
            }
        })();

        return response;

    } catch (error) {
        console.error('❌ ERROR:', error.message);
        return Response.json({ 
            success: false, 
            error: error.message
        }, { status: 500 });
    }
});