// ⭐⭐⭐ Smart Bill Matching Helper - แบ่งออกจาก lineWebhookHandler
// ใช้ logic หาบิลที่ตรงกับสลิป ±1% แล้วชำระแบบ Cascade

// ⭐ calculateLateFee imported inline (copy from calculateLateFee.js)
function calculateLateFeeInline(payment, configs, branchId, today) {
    // ⭐ FIX #1: Handle missing due_date
    if (!payment.due_date) {
        return { lateFeeAmount: 0, daysLate: 0 };
    }
    
    const dueDate = new Date(payment.due_date);
    const daysLate = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
    
    if (daysLate === 0) {
        return { lateFeeAmount: 0, daysLate: 0 };
    }
    
    const getConfigValue = (key) => {
        const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
        if (branchConfig) return branchConfig.value;
        const globalConfig = configs.find(c => c.key === key && !c.branch_id);
        return globalConfig?.value || null;
    };
    
    const lateFeeTierConfig = getConfigValue('late_fee_tier');
    let lateFeeAmount = 0;
    
    if (lateFeeTierConfig) {
        try {
            const tiers = JSON.parse(lateFeeTierConfig);
            for (const tier of tiers) {
                if (daysLate >= tier.from && daysLate <= tier.to) {
                    lateFeeAmount = tier.amount;
                    break;
                }
            }
        } catch (e) {
            console.warn('Invalid late_fee_tier config');
        }
    } else {
        const lateFeePerDay = parseFloat(getConfigValue('late_fee_per_day') || '0');
        lateFeeAmount = daysLate * lateFeePerDay;
    }
    
    const lateFeeMax = parseFloat(getConfigValue('late_fee_max') || '0');
    if (lateFeeMax > 0) {
        lateFeeAmount = Math.min(lateFeeAmount, lateFeeMax);
    }
    
    return { lateFeeAmount: Math.round(lateFeeAmount * 100) / 100, daysLate };
}

async function processBillMatching(
    base44, 
    slipAmount, 
    pendingPayments, 
    tenant, 
    branchId, 
    senderName, 
    transDate, 
    slipImageUrl, 
    verificationMethod, 
    lineUserId, 
    replyToken,
    configs,
    sendMessage
) {
    // ⭐ FIX #2: Input validation
    if (!pendingPayments || pendingPayments.length === 0) {
        console.log('⚠️ No pending bills found');
        return;
    }
    
    if (slipAmount <= 0) {
        console.log('⚠️ Invalid slip amount');
        return;
    }
    
    const now = new Date();
    const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const today = new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate());
    
    console.log('\n========== 🧠 SMART BILL MATCHING ==========');
    console.log(`💰 Slip amount: ${slipAmount}฿`);
    console.log(`📋 Pending bills: ${pendingPayments.length}`);
    
    let matchedBill = null;
    let matchedBillIndex = -1;
    
    // ⭐ ค้นหาบิลที่มียอดตรงกับสลิป ±1%
    for (let i = 0; i < pendingPayments.length; i++) {
        const bill = pendingPayments[i];
        
        // ⭐ FIX #3: Safety check
        if (!bill || !bill.id) continue;
        
        const billTotal = parseFloat(bill.total_amount) || 0;
        
        if (billTotal <= 0) continue; // Changed from === 0 to <= 0
        
        const diffPercent = Math.abs(slipAmount - billTotal) / billTotal * 100;
        
        console.log(`   🔍 Bill ${i + 1}: ${billTotal}฿ | Diff: ${diffPercent.toFixed(1)}%`);
        
        if (diffPercent <= 1) {
            matchedBill = bill;
            matchedBillIndex = i;
            console.log(`   ✅ MATCHED! Bill #${i + 1}`);
            break;
        }
    }
    
    console.log('==========================================\n');
    
    // ⭐ ถ้าเจอบิลที่ตรง
    if (matchedBill) {
        console.log(`✅ EXACT MATCH: Bill ${matchedBillIndex + 1}`);
        return await chargeExactMatch(
            base44, matchedBill, slipAmount, transDate, slipImageUrl,
            senderName, verificationMethod, tenant, branchId, lineUserId, replyToken,
            configs, today, sendMessage
        );
    }
    
    // ⭐ ถ้าไม่เจอ → Cascade payment
    console.log('⚠️ NO EXACT MATCH - proceeding with Cascade payment...\n');
    return await chargeCascadePayment(
        base44, slipAmount, pendingPayments, tenant, branchId, senderName,
        transDate, slipImageUrl, verificationMethod, lineUserId, replyToken,
        configs, today, sendMessage
    );
}

async function chargeExactMatch(
    base44, bill, slipAmount, transDate, slipImageUrl,
    senderName, verificationMethod, tenant, branchId, lineUserId, replyToken,
    configs, today, sendMessage
) {
    const baseAmount = (parseFloat(bill.rent_amount) || 0) +
                      (parseFloat(bill.water_amount) || 0) +
                      (parseFloat(bill.electricity_amount) || 0) +
                      (parseFloat(bill.internet_amount) || 0) +
                      (parseFloat(bill.common_fee_amount) || 0) +
                      (parseFloat(bill.parking_fee_amount) || 0) +
                      (parseFloat(bill.other_amount) || 0);
    
    const { lateFeeAmount, daysLate } = calculateLateFeeInline(bill, configs, branchId, today);
    const expectedAmount = baseAmount + lateFeeAmount;
    const currentPaid = parseFloat(bill.paid_amount || 0);
    const totalPaid = currentPaid + slipAmount;
    
    console.log(`💰 Expected: ${expectedAmount}฿, Slip: ${slipAmount}฿`);
    
    // ชำระบิล
    await base44.asServiceRole.entities.Payment.update(bill.id, {
        status: 'paid',
        payment_date: transDate.split('T')[0],
        payment_slip_url: slipImageUrl,
        late_fee_amount: lateFeeAmount,
        total_amount: expectedAmount,
        paid_amount: expectedAmount,
        notes: `${bill.notes || ''}\n\n✅ ตรวจสอบสลิปอัตโนมัติผ่าน LINE (EXACT MATCH): ${senderName} โอน ${slipAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? ` (รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท จากชำระล่าช้า ${daysLate} วัน)` : ''}`
    });
    
    await base44.asServiceRole.entities.WebhookLog.create({
        webhook_type: 'line',
        branch_id: branchId,
        event_type: 'payment_verified',
        line_user_id: lineUserId,
        tenant_id: tenant?.id,
        payment_id: bill.id,
        amount: slipAmount,
        status: 'success',
        message: 'Payment matched & verified (EXACT MATCH)',
        details: { 
            late_fee: lateFeeAmount, 
            days_late: daysLate,
            sender_name: senderName,
            verification_method: verificationMethod,
            match_type: 'exact_amount'
        }
    }).catch(() => {});
    
    // Score
    if (tenant?.id) {
        try {
            await base44.asServiceRole.functions.invoke('calculatePaymentScores', {
                tenant_id: tenant.id
            });
        } catch (e) {
            console.log('⚠️ Score calculation failed');
        }
    }
    
    // Receipt
    try {
        await base44.asServiceRole.functions.invoke('sendReceipt', { 
            paymentId: bill.id 
        });
    } catch (e) {
        await sendMessage(base44, lineUserId, 
            `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${slipAmount.toLocaleString()} บาท\n📅 วันที่: ${transDate.split('T')[0]}\n\n✓ อัปเดตสถานะ "ชำระแล้ว"\n\nขอบคุณที่ชำระเงินค่ะ 🙏`,
            branchId,
            replyToken
        );
    }
}

async function chargeCascadePayment(
    base44, slipAmount, pendingPayments, tenant, branchId, senderName,
    transDate, slipImageUrl, verificationMethod, lineUserId, replyToken,
    configs, today, sendMessage
) {
    let remainingAmount = slipAmount;
    let billsToUpdate = [];
    let cascadeIndex = 0;
    
    // ⭐ ชำระแบบ Cascade
    for (let i = 0; i < pendingPayments.length && remainingAmount > 0; i++) {
        const bill = pendingPayments[i];
        const billTotal = parseFloat(bill.total_amount) || 0;
        const billPaid = parseFloat(bill.paid_amount) || 0;
        const billRemaining = Math.max(0, billTotal - billPaid);
        
        if (billRemaining === 0) continue;
        
        const paymentAmount = Math.min(remainingAmount, billRemaining);
        const newPaidAmount = billPaid + paymentAmount;
        const newStatus = (newPaidAmount >= billTotal * 0.95) ? 'paid' : 'partial_paid';
        
        cascadeIndex++;
        billsToUpdate.push({
            id: bill.id,
            paymentAmount,
            newPaidAmount,
            newStatus,
            billTotal,
            billRemaining
        });
        
        console.log(`   💳 Bill #${i + 1}: ชำระ ${paymentAmount.toLocaleString()}฿ (รวม ${newPaidAmount.toLocaleString()}/${billTotal}฿)`);
        
        remainingAmount -= paymentAmount;
    }
    
    console.log(`✅ Cascade: ชำระ ${cascadeIndex} บิล, เหลือ ${remainingAmount}฿\n`);
    
    // อัปเดตบิล
    for (let idx = 0; idx < billsToUpdate.length; idx++) {
        const billUpdate = billsToUpdate[idx];
        const bill = pendingPayments.find(b => b.id === billUpdate.id);
        
        const { lateFeeAmount, daysLate } = calculateLateFeeInline(bill, configs, branchId, today);
        
        await base44.asServiceRole.entities.Payment.update(billUpdate.id, {
            status: billUpdate.newStatus,
            payment_date: transDate.split('T')[0],
            payment_slip_url: slipImageUrl,
            paid_amount: billUpdate.newPaidAmount,
            late_fee_amount: lateFeeAmount,
            notes: `${bill.notes || ''}\n\n✅ ตรวจสอบสลิปอัตโนมัติผ่าน LINE (CASCADE): ${senderName} โอน ${slipAmount.toLocaleString()} บาท | บิลนี้ชำระ ${billUpdate.paymentAmount.toLocaleString()}฿`
        });
        
        await base44.asServiceRole.entities.WebhookLog.create({
            webhook_type: 'line',
            branch_id: branchId,
            event_type: 'payment_verified',
            line_user_id: lineUserId,
            tenant_id: tenant?.id,
            payment_id: billUpdate.id,
            amount: billUpdate.paymentAmount,
            status: 'success',
            message: `Cascade payment (Bill ${idx + 1}/${billsToUpdate.length})`,
            details: { match_type: 'cascade' }
        }).catch(() => {});
    }
    
    // Score
    if (tenant?.id) {
        try {
            await base44.asServiceRole.functions.invoke('calculatePaymentScores', {
                tenant_id: tenant.id
            });
        } catch (e) {
            console.log('⚠️ Score calculation failed');
        }
    }
    
    // Receipt
    try {
        if (billsToUpdate.length > 0) {
            await base44.asServiceRole.functions.invoke('sendReceipt', { 
                paymentId: billsToUpdate[0].id 
            });
        }
    } catch (e) {
        await sendMessage(base44, lineUserId,
            `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${slipAmount.toLocaleString()} บาท (ชำระ ${billsToUpdate.length} บิล)\n📅 วันที่: ${transDate.split('T')[0]}\n\n✓ อัปเดตสถานะ\n\nขอบคุณที่ชำระเงินค่ะ 🙏`,
            branchId,
            replyToken
        );
    }
}

module.exports = { processBillMatching };