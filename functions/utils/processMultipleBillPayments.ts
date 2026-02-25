// ⭐ Multi-Bill Payment Processing Utility
// Process multiple pending payments with a single slip (FIFO logic)

export async function processMultipleBillPayments(
    base44, 
    pendingPayments, 
    slipAmount, 
    slipImageUrl, 
    senderName, 
    transDate,
    verificationMethod,
    configs,
    branchId,
    lineUserId,
    replyToken,
    calculateLateFee,
    sendMessage
) {
    const now = new Date();
    const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const today = new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate());

    let remainingAmount = slipAmount;
    const processedPayments = [];
    const roomsMap = new Map();

    for (const pendingPayment of pendingPayments) {
        if (remainingAmount <= 0) {
            console.log(`⏭️ No remaining amount - stopping at ${processedPayments.length} bills`);
            break;
        }

        const baseAmount = (parseFloat(pendingPayment.rent_amount) || 0) +
                          (parseFloat(pendingPayment.water_amount) || 0) +
                          (parseFloat(pendingPayment.electricity_amount) || 0) +
                          (parseFloat(pendingPayment.internet_amount) || 0) +
                          (parseFloat(pendingPayment.common_fee_amount) || 0) +
                          (parseFloat(pendingPayment.parking_fee_amount) || 0) +
                          (parseFloat(pendingPayment.other_amount) || 0);
        
        const { lateFeeAmount, daysLate } = calculateLateFee(pendingPayment, configs, branchId, today);
        const expectedAmount = baseAmount + lateFeeAmount;
        const currentPaid = parseFloat(pendingPayment.paid_amount || 0);
        const shortfall = expectedAmount - currentPaid;
        const amountToPay = Math.min(remainingAmount, shortfall);
        const newTotalPaid = currentPaid + amountToPay;
        const isPaid = newTotalPaid >= expectedAmount * 0.95;

        // Fetch room info (cache)
        let room = roomsMap.get(pendingPayment.room_id);
        if (!room) {
            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: pendingPayment.room_id });
            room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
            if (room) roomsMap.set(pendingPayment.room_id, room);
        }
        const roomNumber = room?.room_number || 'N/A';

        console.log(`📋 Bill ${processedPayments.length + 1}/${pendingPayments.length}: Room ${roomNumber} | Need: ${shortfall.toLocaleString()}฿ | Pay: ${amountToPay.toLocaleString()}฿ | Status: ${isPaid ? 'PAID ✅' : 'PARTIAL 💰'}`);

        // Update payment
        await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
            status: isPaid ? 'paid' : 'partial_paid',
            payment_date: isPaid ? transDate.split('T')[0] : null,
            paid_amount: newTotalPaid,
            payment_slip_url: slipImageUrl,
            late_fee_amount: lateFeeAmount,
            total_amount: expectedAmount,
            notes: `${pendingPayment.notes || ''}\n\n${isPaid ? '✅' : '💰'} ตรวจสอบสลิปอัตโนมัติผ่าน LINE: ${senderName} โอน ${slipAmount.toLocaleString()} บาท → ห้อง ${roomNumber} ชำระ ${amountToPay.toLocaleString()} บาท${lateFeeAmount > 0 ? ` (รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท จากชำระล่าช้า ${daysLate} วัน)` : ''}${currentPaid > 0 ? ` (ชำระเพิ่มจากครั้งก่อน ${currentPaid.toLocaleString()} บาท)` : ''}`
        });

        // Log
        await base44.asServiceRole.entities.WebhookLog.create({
            webhook_type: 'line',
            branch_id: branchId,
            event_type: isPaid ? 'payment_verified' : 'partial_payment',
            line_user_id: lineUserId,
            tenant_id: pendingPayment.tenant_id,
            payment_id: pendingPayment.id,
            amount: amountToPay,
            status: 'success',
            message: isPaid ? 'Payment verified (multi-bill)' : `Partial: ${newTotalPaid}/${expectedAmount}`,
            details: { 
                late_fee: lateFeeAmount, 
                days_late: daysLate,
                sender_name: senderName,
                verification_method: verificationMethod,
                room_number: roomNumber,
                total_bills_in_batch: pendingPayments.length
            }
        }).catch(() => {});

        remainingAmount -= amountToPay;
        processedPayments.push({
            paymentId: pendingPayment.id,
            roomNumber,
            amountPaid: amountToPay,
            status: isPaid ? 'paid' : 'partial_paid',
            expectedAmount,
            newTotalPaid,
            lateFee: lateFeeAmount,
            daysLate,
            shortfall: isPaid ? 0 : (expectedAmount - newTotalPaid)
        });
    }

    console.log(`✅ Processed ${processedPayments.length} bills | Remaining: ${remainingAmount.toLocaleString()}฿`);

    // Calculate payment score
    if (pendingPayments[0]?.tenant_id) {
        try {
            await base44.asServiceRole.functions.invoke('calculatePaymentScores', {
                tenant_id: pendingPayments[0].tenant_id
            });
            console.log('✅ Payment score calculated');
        } catch (scoreError) {
            console.log('⚠️ Score calculation failed:', scoreError.message);
        }
    }
    
    // Send receipts for paid bills
    console.log('📨 Sending receipts for paid bills...');
    for (const processed of processedPayments) {
        if (processed.status === 'paid') {
            try {
                await base44.asServiceRole.functions.invoke('sendReceipt', { 
                    paymentId: processed.paymentId 
                });
                console.log(`✅ Receipt sent for room ${processed.roomNumber}`);
            } catch (receiptError) {
                console.error(`❌ Receipt failed for room ${processed.roomNumber}:`, receiptError.message);
            }
        }
    }

    // Build summary message
    const paidBills = processedPayments.filter(p => p.status === 'paid');
    const partialBills = processedPayments.filter(p => p.status === 'partial_paid');
    
    let summaryText = `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${slipAmount.toLocaleString()} บาท\n📅 วันที่: ${transDate.split('T')[0]}\n\n`;
    
    if (paidBills.length > 0) {
        summaryText += `✅ ชำระเต็มจำนวน ${paidBills.length} ห้อง:\n`;
        paidBills.forEach(p => {
            summaryText += `  • ห้อง ${p.roomNumber}: ${p.amountPaid.toLocaleString()}฿${p.lateFee > 0 ? ` (+ปรับ ${p.lateFee.toLocaleString()}฿)` : ''}\n`;
        });
    }
    
    if (partialBills.length > 0) {
        summaryText += `\n💰 ชำระบางส่วน ${partialBills.length} ห้อง:\n`;
        partialBills.forEach(p => {
            summaryText += `  • ห้อง ${p.roomNumber}: ชำระ ${p.amountPaid.toLocaleString()}฿ (ขาด ${p.shortfall.toLocaleString()}฿)\n`;
        });
    }
    
    if (remainingAmount > 0) {
        summaryText += `\n⚠️ เงินเกิน: ${remainingAmount.toLocaleString()}฿`;
    }
    
    summaryText += `\n\nขอบคุณที่ชำระเงินค่ะ 🙏`;

    await sendMessage(base44, lineUserId, summaryText, branchId, replyToken);
    console.log('✅ Sent multi-bill payment summary');
}