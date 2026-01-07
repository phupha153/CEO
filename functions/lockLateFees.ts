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

        // ⭐ ดึง branches ที่ active เท่านั้น
        const allBranches = await base44.asServiceRole.entities.Branch.filter({ status: 'active' });
        console.log(`✅ Loaded ${allBranches.length} active branches`);

        const results = {
            total_processed: 0,
            total_updated: 0,
            total_skipped: 0,
            total_branches_skipped_expired: 0,
            branches: []
        };

        // ⭐ ประมวลผลแยกตามสาขา
        for (const branch of allBranches) {
            console.log(`\n📍 Processing branch: ${branch.branch_name} (${branch.id.substring(0, 12)}...)`);

            // ⭐ ตรวจสอบสถานะแพ็กเกจของเจ้าของสาขา (ป้องกันการประมวลผลสาขาที่หมดอายุ)
            let shouldSkipBranch = false;
            try {
                const ownerUsers = await base44.asServiceRole.entities.User.filter({ email: branch.owner_id });
                if (ownerUsers && ownerUsers.length > 0) {
                    const ownerStatus = ownerUsers[0].plan_status;
                    console.log(`  👤 Owner "${branch.owner_id}" status: ${ownerStatus}`);
                    
                    // ⭐ ข้ามถ้าไม่ใช่ active หรือ trial
                    if (ownerStatus !== 'active' && ownerStatus !== 'trial') {
                        console.log(`  ⏭️ SKIP: Owner expired/cancelled (status: ${ownerStatus})`);
                        shouldSkipBranch = true;
                        results.total_branches_skipped_expired++;
                    }
                } else {
                    console.warn(`  ⚠️ Owner not found: ${branch.owner_id} - processing anyway`);
                }
            } catch (e) {
                console.warn(`  ⚠️ Could not check owner status: ${e.message} - processing anyway`);
            }

            if (shouldSkipBranch) continue;

            const branchResult = {
                branch_id: branch.id,
                branch_name: branch.branch_name,
                processed: 0,
                updated: 0,
                skipped: 0,
                errors: []
            };

            try {
                // ⭐ ดึงเฉพาะ configs ของสาขานี้ + global (ไม่โหลดทั้งระบบ)
                const branchConfigs = await base44.asServiceRole.entities.Config.filter({
                    $or: [
                        { branch_id: branch.id },
                        { branch_id: null }
                    ]
                });
                console.log(`  📋 Loaded ${branchConfigs.length} configs for this branch`);

                // ⭐ Query ที่ Database Level - ดึงเฉพาะบิลที่ยังไม่ชำระครบของสาขานี้
                const unpaidPayments = await base44.asServiceRole.entities.Payment.filter({
                    branch_id: branch.id,
                    status: { $ne: 'paid' } // not equal to 'paid'
                });

                console.log(`  🔍 Found ${unpaidPayments.length} unpaid payments for this branch`);

                // ⭐ ใช้เวลาไทย (UTC+7) แทน UTC
                const now = new Date();
                const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
                const today = new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate());
                
                console.log(`  📅 Today (Thailand): ${today.toISOString().split('T')[0]} (UTC: ${now.toISOString().split('T')[0]})`);

                // Helper function สำหรับหาค่า config
                const getConfigValue = (key, defaultValue = null) => {
                    const branchCfg = branchConfigs.find(c => c.key === key && c.branch_id === branch.id);
                    if (branchCfg?.value !== undefined && branchCfg?.value !== null) return branchCfg.value;
                    
                    const globalCfg = branchConfigs.find(c => c.key === key && !c.branch_id);
                    return globalCfg?.value !== undefined && globalCfg?.value !== null ? globalCfg.value : defaultValue;
                };

                // ⭐ ประมวลผลแบบ batch (chunk 50 records/ครั้ง เพื่อป้องกัน rate limit)
                const chunkSize = 50;
                for (let i = 0; i < unpaidPayments.length; i += chunkSize) {
                    const chunk = unpaidPayments.slice(i, i + chunkSize);
                    
                    // ประมวลผล chunk นี้แบบ parallel
                    const updatePromises = chunk.map(async (payment) => {
                        branchResult.processed++;

                        try {
                            if (!payment.due_date) {
                                branchResult.skipped++;
                                return;
                            }

                            // 🔒 ถ้า admin ล็อคค่าปรับไว้ → skip
                            if (payment.late_fee_locked === true) {
                                branchResult.skipped++;
                                console.log(`  🔒 Locked: payment ${payment.id.substring(0, 8)}... (late fee: ${payment.late_fee_amount || 0}฿)`);
                                return;
                            }

                            const dueDate = parseISO(payment.due_date);
                            const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                            const daysOverdue = differenceInDays(today, dueDateStart);

                            // ถ้ายังไม่เกินกำหนด → skip
                            if (daysOverdue <= 0) {
                                branchResult.skipped++;
                                return;
                            }

                            // ⭐ คำนวณค่าปรับ (รองรับ Tiers + Simple)
                            let lateFeeAmount = 0;
                            let calculationMethod = 'none';

                            // เช็คว่าเปิดใช้ Tiers หรือไม่
                            const tiersEnabled = getConfigValue('late_fee_tiers_enabled') === 'true';

                            if (tiersEnabled) {
                                const tiersConfigValue = getConfigValue('late_fee_tiers');

                                if (tiersConfigValue) {
                                    try {
                                        const tiers = JSON.parse(tiersConfigValue);
                                        
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
                                        console.error(`  ❌ Error parsing tiers for payment ${payment.id}:`, e);
                                    }
                                }
                            }

                            // Fallback: Simple rate
                            if (calculationMethod === 'none') {
                                const lateFeePerDay = parseFloat(getConfigValue('late_payment_fee_per_day', '0'));
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

                            // ⭐ อัปเดตเฉพาะที่มีการเปลี่ยนแปลง
                            const needsUpdate = 
                                Math.abs((payment.late_fee_amount || 0) - lateFeeAmount) > 0.01 ||
                                Math.abs((payment.total_amount || 0) - newTotalAmount) > 0.01 ||
                                (daysOverdue > 0 && payment.status !== 'overdue');

                            if (needsUpdate) {
                                await base44.asServiceRole.entities.Payment.update(payment.id, {
                                    late_fee_amount: lateFeeAmount,
                                    total_amount: newTotalAmount,
                                    late_fee_last_calculated: new Date().toISOString(),
                                    status: payment.status === 'pending' || payment.status === 'overdue' ? 'overdue' : payment.status
                                });

                                branchResult.updated++;
                                console.log(`  ✅ Updated payment ${payment.id.substring(0, 8)}... | Due: ${payment.due_date} | Days: ${daysOverdue} | Late Fee: ${lateFeeAmount}฿ | Method: ${calculationMethod}`);
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
                    });

                    // รอให้ chunk นี้เสร็จก่อนไป chunk ถัดไป
                    await Promise.all(updatePromises);
                    
                    // Delay เล็กน้อยเพื่อป้องกัน rate limit
                    if (i + chunkSize < unpaidPayments.length) {
                        await new Promise(resolve => setTimeout(resolve, 100));
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
        console.log(`📊 Total: ${results.total_processed} processed, ${results.total_updated} updated, ${results.total_skipped} skipped, ${results.total_branches_skipped_expired} branches skipped (expired)`);

        // บันทึก log
        await base44.asServiceRole.entities.FunctionLog.create({
            function_name: 'lockLateFees',
            run_timestamp: new Date().toISOString(),
            status: 'success',
            message: `Processed ${results.total_processed} payments, updated ${results.total_updated}, skipped ${results.total_branches_skipped_expired} expired branches`,
            details: results,
            triggered_by: 'cron',
            execution_time_ms: Date.now() - startTime,
            total_sent: results.total_updated,
            total_failed: results.branches.reduce((sum, b) => sum + b.errors.length, 0),
            branch_results: results.branches.map(b => ({
                branch_id: b.branch_id,
                branch_name: b.branch_name,
                status: b.errors.length > 0 ? 'partial_success' : 'success',
                sent: b.updated,
                failed: b.errors.length
            }))
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