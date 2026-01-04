import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { parseISO, differenceInDays } from 'npm:date-fns@3.0.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log('🔒 [Lock Late Fees] Starting job...');
        const startTime = Date.now();

        // ดึง configs ทั้งหมดครั้งเดียว (cache)
        const allConfigs = await base44.asServiceRole.entities.Config.list();
        console.log(`✅ Loaded ${allConfigs.length} configs`);

        // ดึง branches ทั้งหมด
        const allBranches = await base44.asServiceRole.entities.Branch.list();
        console.log(`✅ Loaded ${allBranches.length} branches`);

        const results = {
            total_processed: 0,
            total_updated: 0,
            total_skipped: 0,
            branches: []
        };

        // ประมวลผลแยกตามสาขา (ป้องกัน data leak)
        for (const branch of allBranches) {
            console.log(`\n📍 Processing branch: ${branch.branch_name} (${branch.id.substring(0, 12)}...)`);

            // ⭐ ตรวจสอบสถานะแพ็กเกจของเจ้าของสาขา
            let branchOwnerStatus = null;
            try {
                const ownerUser = await base44.asServiceRole.entities.User.filter({ email: branch.owner_id });
                if (ownerUser && ownerUser.length > 0) {
                    branchOwnerStatus = ownerUser[0].plan_status;
                    console.log(`  👤 Owner status: ${branchOwnerStatus}`);
                }
            } catch (e) {
                console.warn(`  ⚠️ Could not check owner status: ${e.message}`);
            }

            // ⭐ ข้าม branch ถ้าเจ้าของหมดอายุ
            if (branchOwnerStatus && branchOwnerStatus !== 'active' && branchOwnerStatus !== 'trial') {
                console.log(`  ⏭️ SKIP: Branch owner expired (status: ${branchOwnerStatus})`);
                continue;
            }

            const branchResult = {
                branch_id: branch.id,
                branch_name: branch.branch_name,
                processed: 0,
                updated: 0,
                skipped: 0,
                errors: []
            };

            try {
                // ดึงบิลที่ยังไม่ชำระครบของสาขานี้
                console.log(`  📦 Fetching payments for branch...`);
                
                const allPayments = await base44.asServiceRole.entities.Payment.filter(
                    { 
                        branch_id: branch.id
                    }
                );

                // Filter เฉพาะบิลที่ยังไม่ชำระครบและมี due_date
                const unpaidPayments = allPayments.filter(p => 
                    p.status !== 'paid' && p.due_date
                );

                console.log(`  🔍 Found ${unpaidPayments.length} unpaid payments`);

                const today = new Date();
                today.setHours(0, 0, 0, 0);

                for (const payment of unpaidPayments) {
                        branchResult.processed++;

                        try {
                            const dueDate = parseISO(payment.due_date);
                            const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                            const daysOverdue = differenceInDays(today, dueDateStart);

                            // ถ้ายังไม่เกินกำหนด → skip
                            if (daysOverdue <= 0) {
                                branchResult.skipped++;
                                continue;
                            }

                            // ⭐ คำนวณค่าปรับ (รองรับ Tiers + Simple)
                            let lateFeeAmount = 0;
                            let calculationMethod = 'none';

                            // เช็คว่าเปิดใช้ Tiers หรือไม่
                            const tiersEnabledConfig = allConfigs.find(c => 
                                c.key === 'late_fee_tiers_enabled' && 
                                (c.branch_id === branch.id || !c.branch_id)
                            );
                            const tiersEnabled = tiersEnabledConfig?.value === 'true';

                            if (tiersEnabled) {
                                const tiersConfig = allConfigs.find(c => 
                                    c.key === 'late_fee_tiers' && 
                                    (c.branch_id === branch.id || !c.branch_id)
                                );

                                if (tiersConfig?.value) {
                                    try {
                                        const tiers = JSON.parse(tiersConfig.value);
                                        
                                        for (const tier of tiers) {
                                            const daysFrom = tier.days_from || 1;
                                            const daysTo = tier.days_to || 999;
                                            const feePerDay = parseFloat(tier.fee_per_day || 0);

                                            if (daysOverdue >= daysFrom) {
                                                const daysInThisTier = Math.min(daysOverdue, daysTo) - daysFrom + 1;
                                                if (daysInThisTier > 0) {
                                                    lateFeeAmount += daysInThisTier * feePerDay;
                                                }
                                            }

                                            if (daysOverdue <= daysTo) break;
                                        }

                                        calculationMethod = 'tiered';
                                    } catch (e) {
                                        console.error(`❌ Error parsing tiers for payment ${payment.id}:`, e);
                                    }
                                }
                            }

                            // Fallback: Simple rate
                            if (calculationMethod === 'none') {
                                const lateFeeConfig = allConfigs.find(c => 
                                    c.key === 'late_payment_fee_per_day' && 
                                    (c.branch_id === branch.id || !c.branch_id)
                                );
                                const lateFeePerDay = parseFloat(lateFeeConfig?.value || 0);
                                lateFeeAmount = daysOverdue * lateFeePerDay;
                                calculationMethod = 'simple';
                            }

                            // คำนวณ total_amount ใหม่
                            const baseAmount = (payment.rent_amount || 0) +
                                              (payment.water_amount || 0) +
                                              (payment.electricity_amount || 0) +
                                              (payment.internet_amount || 0) +
                                              (payment.common_fee_amount || 0) +
                                              (payment.parking_fee_amount || 0) +
                                              (payment.other_amount || 0);

                            const newTotalAmount = baseAmount + lateFeeAmount;

                            // ⭐ อัปเดตเฉพาะที่จำเป็น (ไม่บันทึก late_fee = 0)
                            if (lateFeeAmount > 0 || payment.late_fee_amount !== lateFeeAmount) {
                                await base44.asServiceRole.entities.Payment.update(payment.id, {
                                    late_fee_amount: lateFeeAmount,
                                    total_amount: newTotalAmount,
                                    status: daysOverdue > 0 ? 'overdue' : payment.status
                                });

                                branchResult.updated++;
                                console.log(`  ✅ Updated payment ${payment.id.substring(0, 8)}... | Days: ${daysOverdue} | Late Fee: ${lateFeeAmount}฿ | Method: ${calculationMethod}`);
                            } else {
                                branchResult.skipped++;
                            }

                        } catch (paymentError) {
                            branchResult.errors.push({
                                payment_id: payment.id,
                                error: paymentError.message
                            });
                            console.error(`  ❌ Error processing payment ${payment.id}:`, paymentError.message);
                        }
                    }

            } catch (branchError) {
                branchResult.errors.push({
                    error: branchError.message
                });
                console.error(`❌ Error processing branch ${branch.branch_name}:`, branchError.message);
            }

            results.branches.push(branchResult);
            results.total_processed += branchResult.processed;
            results.total_updated += branchResult.updated;
            results.total_skipped += branchResult.skipped;

            console.log(`✅ Branch "${branch.branch_name}" done: ${branchResult.updated} updated, ${branchResult.skipped} skipped`);
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n🎉 [Lock Late Fees] Completed in ${duration}s`);
        console.log(`📊 Total: ${results.total_processed} processed, ${results.total_updated} updated, ${results.total_skipped} skipped`);

        // บันทึก log
        await base44.asServiceRole.entities.FunctionLog.create({
            function_name: 'lockLateFees',
            run_timestamp: new Date().toISOString(),
            status: 'success',
            message: `Processed ${results.total_processed} payments, updated ${results.total_updated}`,
            details: results,
            triggered_by: 'cron',
            execution_time_ms: Date.now() - startTime
        });

        return Response.json({
            success: true,
            duration_seconds: duration,
            ...results
        });

    } catch (error) {
        console.error('❌ Lock Late Fees Job Failed:', error);

        // บันทึก error log
        try {
            const base44 = createClientFromRequest(req);
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'lockLateFees',
                run_timestamp: new Date().toISOString(),
                status: 'error',
                message: error.message,
                details: { error: error.stack },
                triggered_by: 'cron'
            });
        } catch {}

        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});