// ⭐ Logic สำหรับจับคู่บิลตามยอดเงิน
export function matchPendingPayment(pendingPayments, slipAmount) {
    if (!pendingPayments || pendingPayments.length === 0) {
        return null;
    }

    // คำนวณยอดค้างชำระ
    const getAmountLeft = (payment) => {
        const total = parseFloat(payment.total_amount) || 0;
        const paid = parseFloat(payment.paid_amount) || 0;
        return total - paid;
    };

    // ⭐ Step 1: หา bill ที่ยอดเงินตรงกันเป๊ะ (ยอมรับความแตกต่างเศษสตางค์ < 0.01)
    const exactMatch = pendingPayments.find(p => {
        const amountLeft = getAmountLeft(p);
        return Math.abs(amountLeft - slipAmount) < 0.01;
    });

    if (exactMatch) {
        console.log(`✅ [MATCH] Exact amount match found!`);
        console.log(`   Bill ID: ${exactMatch.id.substring(0, 8)}...`);
        console.log(`   Amount Left: ${getAmountLeft(exactMatch).toLocaleString()}฿ = Slip: ${slipAmount.toLocaleString()}฿`);
        return exactMatch;
    }

    // ⭐ Step 2: ถ้าไม่พบยอดตรงกัน → ใช้บิลที่ due_date เก่าสุด (FIFO)
    console.log(`⚠️ [MATCH] No exact amount match - using oldest due_date`);
    console.log(`   Searched ${pendingPayments.length} pending bill(s), no exact match found`);
    return pendingPayments[0];
}