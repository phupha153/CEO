import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ⭐ Extracted slip processing handler
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
            replyToken,
            verificationMethod
        } = body;

        if (!Array.isArray(pendingPayments) || pendingPayments.length === 0) {
            return Response.json({ error: 'Invalid payment data' }, { status: 400 });
        }

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Helper: Calculate late fee
        const calculateLateFee = (payment) => {
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

        // Reorder: exact match first (smart matching)
        const billsWithShortfall = pendingPayments.map(payment => {
            const baseAmount = (parseFloat(payment.rent_amount) || 0) +
                              (parseFloat(payment.water_amount) || 0) +
                              (parseFloat(payment.electricity_amount) || 0) +
                              (parseFloat(payment.internet_amount) || 0) +
                              (parseFloat(payment.common_fee_amount) || 0) +
                              (parseFloat(payment.parking_fee_amount) || 0) +
                              (parseFloat(payment.other_amount) || 0);
            const { lateFeeAmount } = calculateLateFee(payment);
            const expectedAmount = baseAmount + lateFeeAmount;
            const currentPaid = parseFloat(payment.paid_amount || 0);
            const shortfall = expectedAmount - currentPaid;
            return { payment, shortfall };
        });

        const sortedPayments = billsWithShortfall
            .sort((a, b) => {
                const aMatch = Math.abs(a.shortfall - slipAmount) < 0.01 ? 0 : 1;
                const bMatch = Math.abs(b.shortfall - slipAmount) < 0.01 ? 0 : 1;
                return aMatch - bMatch;
            })
            .map(item => item.payment);

        let remainingAmount = slipAmount;
        const processed = [];

        for (const payment of sortedPayments) {
            if (remainingAmount <= 0) break;

            const baseAmount = (parseFloat(payment.rent_amount) || 0) +
                              (parseFloat(payment.water_amount) || 0) +
                              (parseFloat(payment.electricity_amount) || 0) +
                              (parseFloat(payment.internet_amount) || 0) +
                              (parseFloat(payment.common_fee_amount) || 0) +
                              (parseFloat(payment.parking_fee_amount) || 0) +
                              (parseFloat(payment.other_amount) || 0);
            
            const { lateFeeAmount, daysLate } = calculateLateFee(payment);
            const expectedAmount = baseAmount + lateFeeAmount;
            const currentPaid = parseFloat(payment.paid_amount || 0);
            const shortfall = expectedAmount - currentPaid;
            const amountToPay = Math.min(remainingAmount, shortfall);
            const newTotalPaid = currentPaid + amountToPay;
            const isPaid = newTotalPaid >= expectedAmount * 0.95;

            const rooms = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
            const room = Array.isArray(rooms) ? rooms[0] : rooms;
            const roomNum = room?.room_number || 'N/A';

            await base44.asServiceRole.entities.Payment.update(payment.id, {
                status: isPaid ? 'paid' : 'partial_paid',
                payment_date: isPaid ? transDate.split('T')[0] : null,
                paid_amount: newTotalPaid,
                payment_slip_url: slipImageUrl,
                late_fee_amount: lateFeeAmount,
                total_amount: expectedAmount,
                notes: `${payment.notes || ''}\n\n${isPaid ? '✅' : '💰'} LINE: ${senderName} → ห้อง ${roomNum} ชำระ ${amountToPay.toLocaleString()}฿`
            });

            remainingAmount -= amountToPay;
            processed.push({ id: payment.id, room: roomNum, amount: amountToPay, paid: isPaid });
        }

        return Response.json({
            success: true,
            processed,
            remaining: remainingAmount
        });

    } catch (error) {
        console.error('❌ Slip processing error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});