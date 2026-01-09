import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { parseISO, differenceInDays } from 'npm:date-fns@3.0.0';

// ⭐ Inline helper: Calculate late fee
function calculateLateFee(payment, configs, branchId, calculationDate = null) {
    console.log(`🧮 LateFee: ${payment?.id?.substring(0, 8)}... | Due: ${payment?.due_date} | Status: ${payment?.status}`);
    
    if (!payment || !payment.due_date) {
        console.log('  ⏭️ SKIP: No due_date');
        return { lateFeeAmount: 0, daysLate: 0 };
    }
    
    if (payment.status === 'paid') {
        console.log(`  🔒 SKIP: Already paid (locked: ${payment.late_fee_amount || 0}฿)`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    if (payment.late_fee_locked === true) {
        console.log(`  🔒 SKIP: Admin locked (${payment.late_fee_amount || 0}฿)`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    const calcDate = calculationDate || new Date();
    
    if (payment.late_fee_last_calculated) {
        const lastCalcDate = new Date(payment.late_fee_last_calculated);
        lastCalcDate.setHours(0, 0, 0, 0);
        
        const checkDate = new Date();
        const checkThailandTime = new Date(checkDate.getTime() + (7 * 60 * 60 * 1000));
        const checkToday = new Date(checkThailandTime.getFullYear(), checkThailandTime.getMonth(), checkThailandTime.getDate());
        
        if (lastCalcDate.getTime() === checkToday.getTime()) {
            console.log(`  ✅ SKIP: Already calculated today (${payment.late_fee_amount || 0}฿)`);
            return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
        }
    }

    try {
        const dueDate = parseISO(payment.due_date);
        const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const calcDateStart = new Date(calcDate.getFullYear(), calcDate.getMonth(), calcDate.getDate());
        const daysOverdue = differenceInDays(calcDateStart, dueDateStart);

        if (daysOverdue <= 0) return { lateFeeAmount: 0, daysLate: 0 };

        const getConfigValue = (key, defaultValue = null) => {
            const branchCfg = configs.find(c => c.key === key && c.branch_id === branchId);
            if (branchCfg?.value !== undefined && branchCfg?.value !== null) return branchCfg.value;
            const globalCfg = configs.find(c => c.key === key && !c.branch_id);
            return globalCfg?.value !== undefined && globalCfg?.value !== null ? globalCfg.value : defaultValue;
        };

        const tiersEnabled = getConfigValue('late_fee_tiers_enabled') === 'true';

        if (tiersEnabled) {
            const tiersConfigValue = getConfigValue('late_fee_tiers');
            if (tiersConfigValue) {
                try {
                    const tiers = JSON.parse(tiersConfigValue);
                    let totalFee = 0;
                    for (const tier of tiers) {
                        const daysFrom = tier.days_from || 1;
                        const daysTo = tier.days_to || 999;
                        const feePerDay = parseFloat(tier.fee_per_day || 0);
                        if (daysOverdue >= daysFrom) {
                            const daysInThisTier = Math.min(daysOverdue, daysTo) - daysFrom + 1;
                            if (daysInThisTier > 0) {
                                totalFee += daysInThisTier * feePerDay;
                            }
                        }
                        if (daysOverdue <= daysTo) break;
                    }
                    console.log(`  ✅ Tiered: ${daysOverdue}d → ${totalFee}฿`);
                    return { lateFeeAmount: totalFee, daysLate: daysOverdue };
                } catch (e) {
                    console.error('Error parsing late fee tiers:', e);
                }
            }
        }

        const lateFeePerDay = parseFloat(getConfigValue('late_payment_fee_per_day', '0'));
        if (lateFeePerDay === 0 || isNaN(lateFeePerDay)) {
            console.log('  ⏭️ SKIP: No late fee config');
            return { lateFeeAmount: 0, daysLate: daysOverdue };
        }

        const simpleFee = daysOverdue * lateFeePerDay;
        console.log(`  ✅ Simple: ${daysOverdue}d × ${lateFeePerDay}฿ = ${simpleFee}฿`);
        return { lateFeeAmount: simpleFee, daysLate: daysOverdue };
    } catch (error) {
        console.error('Error calculating late fee:', error);
        return { lateFeeAmount: 0, daysLate: 0 };
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        let paymentId = null;
        try {
            const body = await req.json();
            paymentId = body?.paymentId || null;
        } catch {
            // ไม่มี body = รันแบบปกติกับทุกบิล
        }

        const user = await base44.auth.me();

        if (user?.role !== 'admin') {
            return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
        }

        console.log('🔒 [Lock Late Fees] Starting job...', paymentId ? `(Single payment: ${paymentId.substring(0, 12)}...)` : '(All payments)');
        const startTime = Date.now();

        if (paymentId) {
            return await calculateSinglePayment(base44, paymentId, startTime);
        }

        const allBranches = await base44.asServiceRole.entities.Branch.filter({ status: 'active' });
        console.log(`✅ Loaded ${allBranches.length} active branches`);

        const results = {
            total_processed: 0,
            total_updated: 0,
            total_skipped: 0,
            total_branches_skipped_expired: 0,
            branches: []
        };

        for (const branch of allBranches) {
            console.log(`\n📍 Processing branch: ${branch.branch_name} (${branch.id.substring(0, 12)}...)`);

            let shouldSkipBranch = false;
            try {
                const ownerUsers = await base44.asServiceRole.entities.User.filter({ email: branch.owner_id });
                if (ownerUsers && ownerUsers.length > 0) {
                    const ownerStatus = ownerUsers[0].plan_status;
                    console.log(`  👤 Owner "${branch.owner_id}" status: ${ownerStatus}`);
                    
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
                const branchConfigs = await base44.asServiceRole.entities.Config.filter({
                    $or: [
                        { branch_id: branch.id },
                        { branch_id: null }
                    ]
                });
                console.log(`  📋 Loaded ${branchConfigs.length} configs for this branch`);

                const branchDate = new Date();
                const branchThailandTime = new Date(branchDate.getTime() + (7 * 60 * 60 * 1000));
                const branchToday = new Date(branchThailandTime.getFullYear(), branchThailandTime.getMonth(), branchThailandTime.getDate());
                const branchTodayStr = branchToday.toISOString().split('T')[0];
                
                console.log(`  📅 Today (Thailand): ${branchTodayStr} (UTC: ${branchDate.toISOString().split('T')[0]})`);

                const getConfigValue = (key, defaultValue = null) => {
                    const branchCfg = branchConfigs.find(c => c.key === key && c.branch_id === branch.id);
                    if (branchCfg?.value !== undefined && branchCfg?.value !== null) return branchCfg.value;
                    
                    const globalCfg = branchConfigs.find(c => c.key === key && !c.branch_id);
                    return globalCfg?.value !== undefined && globalCfg?.value !== null ? globalCfg.value : defaultValue;
                };

                const pageSize = 500;
                let offset = 0;
                let hasMore = true;
                let totalFetched = 0;

                while (hasMore) {
                    let pagedPayments;
                    let retries = 0;
                    const maxRetries = 3;
                    
                    while (retries < maxRetries) {
                        try {
                            pagedPayments = await base44.asServiceRole.entities.Payment.filter(
                                { 
                                    branch_id: branch.id, 
                                    status: { $ne: 'paid' },
                                    $or: [
                                        { late_fee_calculated_date: null },
                                        { late_fee_calculated_date: { $ne: branchTodayStr } }
                                    ]
                                },
                                '-created_date',
                                pageSize,
                                offset
                            );
                            break;
                        } catch (queryError) {
                            if (queryError.message?.includes('429') && retries < maxRetries - 1) {
                                const backoff = 1000 * Math.pow(2, retries);
                                console.log(`  ⚠️ Rate limit hit, retry ${retries + 1}/${maxRetries} in ${backoff}ms`);
                                await new Promise(resolve => setTimeout(resolve, backoff));
                                retries++;
                            } else {
                                throw queryError;
                            }
                        }
                    }

                    totalFetched += pagedPayments.length;
                    console.log(`  📄 Page ${Math.floor(offset/pageSize) + 1}: Fetched ${pagedPayments.length} bills (total: ${totalFetched})`);

                    if (pagedPayments.length === 0) {
                        hasMore = false;
                        break;
                    }

                    const needsCalculation = pagedPayments;
                    console.log(`  ✅ DB-filtered: ${needsCalculation.length} need calculation`);

                    const processChunkSize = 100;
                    for (let i = 0; i < needsCalculation.length; i += processChunkSize) {
                        const chunk = needsCalculation.slice(i, i + processChunkSize);
                        
                        const updatePromises = chunk.map(async (payment) => {
                            branchResult.processed++;

                            try {
                                if (!payment.due_date) {
                                    branchResult.skipped++;
                                    return;
                                }

                                if (payment.late_fee_locked === true) {
                                    branchResult.skipped++;
                                    return;
                                }

                                const { lateFeeAmount, daysLate } = calculateLateFee(payment, branchConfigs, branch.id, branchToday);

                                if (daysLate <= 0) {
                                    branchResult.skipped++;
                                    return;
                                }

                                const baseAmount = (payment.rent_amount || 0) +
                                                  (payment.water_amount || 0) +
                                                  (payment.electricity_amount || 0) +
                                                  (payment.internet_amount || 0) +
                                                  (payment.common_fee_amount || 0) +
                                                  (payment.parking_fee_amount || 0) +
                                                  (payment.other_amount || 0);

                                const newTotalAmount = baseAmount + lateFeeAmount;

                                const needsUpdate = 
                                    Math.abs((payment.late_fee_amount || 0) - lateFeeAmount) > 0.01 ||
                                    Math.abs((payment.total_amount || 0) - newTotalAmount) > 0.01 ||
                                    (daysLate > 0 && payment.status !== 'overdue');

                                if (needsUpdate) {
                                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                                        late_fee_amount: lateFeeAmount,
                                        total_amount: newTotalAmount,
                                        late_fee_last_calculated: new Date().toISOString(),
                                        late_fee_calculated_date: branchTodayStr,
                                        status: payment.status === 'pending' || payment.status === 'overdue' ? 'overdue' : payment.status
                                    });

                                    branchResult.updated++;
                                    console.log(`  ✅ Updated ${payment.id.substring(0, 8)}... | ${daysLate}d | ${lateFeeAmount}฿`);
                                } else {
                                    branchResult.skipped++;
                                }

                            } catch (paymentError) {
                                branchResult.errors.push({
                                    payment_id: payment.id,
                                    error: paymentError.message
                                });
                                console.error(`  ❌ Error: ${payment.id}`, paymentError.message);
                            }
                        });

                        await Promise.all(updatePromises);
                        
                        if (i + processChunkSize < needsCalculation.length) {
                            await new Promise(resolve => setTimeout(resolve, 150));
                        }
                    }

                    if (pagedPayments.length < pageSize) {
                        hasMore = false;
                    } else {
                        offset += pageSize;
                        await new Promise(resolve => setTimeout(resolve, 300));
                    }
                }

                console.log(`  📊 Total fetched: ${totalFetched} bills for this branch`)

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

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`\n🎉 [Lock Late Fees] Completed in ${duration}s`);
        console.log(`📊 Total: ${results.total_processed} processed, ${results.total_updated} updated, ${results.total_skipped} skipped, ${results.total_branches_skipped_expired} branches skipped (expired)`);

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

async function calculateSinglePayment(base44, paymentId, startTime) {
    try {
        console.log(`\n🎯 [Single Payment Mode] Payment ID: ${paymentId.substring(0, 12)}...`);

        const payments = await base44.asServiceRole.entities.Payment.list();
        const payment = payments.find(p => p.id === paymentId);

        if (!payment) {
            return Response.json({
                success: false,
                error: 'Payment not found'
            }, { status: 404 });
        }

        console.log(`✅ Found payment: ${payment.id.substring(0, 12)}... (Branch: ${payment.branch_id.substring(0, 12)}...)`);

        const allConfigs = await base44.asServiceRole.entities.Config.list();
        const branchConfigs = allConfigs.filter(c => 
            c.branch_id === payment.branch_id || !c.branch_id
        );

        const branch = await base44.asServiceRole.entities.Branch.filter({ id: payment.branch_id });
        const branchData = Array.isArray(branch) ? branch[0] : branch;

        if (!branchData) {
            return Response.json({
                success: false,
                error: 'Branch not found'
            }, { status: 404 });
        }

        let shouldSkip = false;
        try {
            const ownerUsers = await base44.asServiceRole.entities.User.filter({ email: branchData.owner_id });
            if (ownerUsers && ownerUsers.length > 0) {
                const ownerStatus = ownerUsers[0].plan_status;
                if (ownerStatus !== 'active' && ownerStatus !== 'trial') {
                    console.log(`⏭️ SKIP: Owner expired/cancelled (status: ${ownerStatus})`);
                    shouldSkip = true;
                }
            }
        } catch (e) {
            console.warn(`⚠️ Could not check owner status: ${e.message}`);
        }

        if (shouldSkip) {
            return Response.json({
                success: false,
                error: 'Branch owner subscription expired'
            }, { status: 403 });
        }

        if (payment.status === 'paid') {
            return Response.json({
                success: true,
                message: 'Payment already paid',
                late_fee_amount: payment.late_fee_amount || 0,
                updated: false
            });
        }

        if (payment.late_fee_locked === true) {
            return Response.json({
                success: true,
                message: 'Late fee locked by admin',
                late_fee_amount: payment.late_fee_amount || 0,
                updated: false
            });
        }

        const singleDate = new Date();
        const singleThailandTime = new Date(singleDate.getTime() + (7 * 60 * 60 * 1000));
        const singleToday = new Date(singleThailandTime.getFullYear(), singleThailandTime.getMonth(), singleThailandTime.getDate());
        const singleTodayStr = singleToday.toISOString().split('T')[0];

        const { lateFeeAmount, daysLate } = calculateLateFee(payment, branchConfigs, payment.branch_id, singleToday);

        console.log(`📊 Calculation result: ${daysLate} days late → ${lateFeeAmount}฿`);

        const baseAmount = (payment.rent_amount || 0) +
                    (payment.water_amount || 0) +
                    (payment.electricity_amount || 0) +
                    (payment.internet_amount || 0) +
                    (payment.common_fee_amount || 0) +
                    (payment.parking_fee_amount || 0) +
                    (payment.other_amount || 0);

        const newTotalAmount = baseAmount + lateFeeAmount;

        await base44.asServiceRole.entities.Payment.update(payment.id, {
            late_fee_amount: lateFeeAmount,
            total_amount: newTotalAmount,
            late_fee_last_calculated: new Date().toISOString(),
            late_fee_calculated_date: singleTodayStr,
            status: payment.status === 'pending' || payment.status === 'overdue' ? (daysLate > 0 ? 'overdue' : 'pending') : payment.status
        });

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        return Response.json({
            success: true,
            duration_seconds: duration,
            payment_id: paymentId,
            late_fee_amount: lateFeeAmount,
            days_late: daysLate,
            total_amount: newTotalAmount,
            updated: true
        });

    } catch (error) {
        console.error('❌ Single payment calculation failed:', error);
        return Response.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}