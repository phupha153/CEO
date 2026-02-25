import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const {
            pendingPayments,
            slipAmount,
            slipImageUrl,
            senderName,
            transDate,
            configs,
            branchId,
            lineUserId,
            replyToken
        } = body;

        if (!Array.isArray(pendingPayments) || pendingPayments.length === 0) {
            return Response.json({ error: 'Invalid payments data' }, { status: 400 });
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Helper: Calculate late fee
        const calculateLateFee = (payment, configs, branchId, today) => {
            const dueDate = new Date(payment.due_date);
            const daysLate = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
            
            if (daysLate === 0) return { lateFeeAmount: 0, daysLate: 0 };

            const lateFeePerDay = parseFloat(
                (configs.find(c => c.key === 'late_fee_per_day' && c.branch_id === branchId)?.value ||
                configs.find(c => c.key === 'late_fee_per_day' && !c.branch_id)?.value) || '0'
            );
            
            return {
                lateFeeAmount: daysLate * lateFeePerDay,
                daysLate
            };
        };

        // Reorder: exact match first
        const billsWithShortfall = pendingPayments.map(payment => {
            const baseAmount = (parseFloat(payment.rent_amount) || 0) +
                              (parseFloat(payment.water_amount) || 0) +
                              (parseFloat(payment.electricity_amount) || 0) +
                              (parseFloat(payment.internet_amount) || 0) +
                              (parseFloat(payment.common_fee_amount) || 0) +
                              (parseFloat(payment.parking_fee_amount) || 0) +
                              (parseFloat(payment.other_amount) || 0);
            const { lateFeeAmount } = calculateLateFee(payment, configs, branchId, today);
            const expectedAmount = baseAmount + lateFeeAmount;
            const currentPaid = parseFloat(payment.paid_amount || 0);
            const shortfall = expectedAmount - currentPaid;
            return { payment, shortfall };
        });

        const sortedPayments = billsWithShortfall.sort((a, b) => {
            const aIsExactMatch = Math.abs(a.shortfall - slipAmount) < 0.01 ? 0 : 1;
            const bIsExactMatch = Math.abs(b.shortfall - slipAmount) < 0.01 ? 0 : 1;
            return aIsExactMatch - bIsExactMatch;
        }).map(item => item.payment);

        let remainingAmount = slipAmount;
        const processedPayments = [];

        for (const pendingPayment of sortedPayments) {
            if (remainingAmount <= 0) break;

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

            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: pendingPayment.room_id });
            const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
            const roomNumber = room?.room_number || 'N/A';

            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                status: isPaid ? 'paid' : 'partial_paid',
                payment_date: isPaid ? transDate.split('T')[0] : null,
                paid_amount: newTotalPaid,
                payment_slip_url: slipImageUrl,
                late_fee_amount: lateFeeAmount,
                total_amount: expectedAmount,
                notes: `${pendingPayment.notes || ''}\n\n${isPaid ? '✅' : '💰'} ตรวจสอบสลิปอัตโนมัติผ่าน LINE: ${senderName} → ห้อง ${roomNumber} ชำระ ${amountToPay.toLocaleString()} บาท`
            });

            remainingAmount -= amountToPay;
            processedPayments.push({
                paymentId: pendingPayment.id,
                roomNumber,
                amountPaid: amountToPay,
                status: isPaid ? 'paid' : 'partial_paid'
            });
        }

        return Response.json({
            success: true,
            processedCount: processedPayments.length,
            remainingAmount,
            processed: processedPayments
        });

    } catch (error) {
        console.error('❌ Multi-bill processing error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});