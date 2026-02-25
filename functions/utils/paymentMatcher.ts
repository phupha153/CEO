export function calculatePaymentAmountsAndMatch(pendingPayments, slipAmount, configs, branchId, today, calculateLateFee) {
    const paymentsWithAmounts = pendingPayments.map(p => {
        const baseAmount = ['rent_amount','water_amount','electricity_amount','internet_amount','common_fee_amount','parking_fee_amount','other_amount']
            .reduce((sum, key) => sum + (parseFloat(p[key]) || 0), 0);
        
        const { lateFeeAmount, daysLate } = calculateLateFee(p, configs, branchId, today);
        const expectedAmount = baseAmount + lateFeeAmount;
        const currentPaid = parseFloat(p.paid_amount || 0);
        return { ...p, baseAmount, lateFeeAmount, daysLate, expectedAmount, currentPaid, remainingToPay: expectedAmount - currentPaid };
    });

    let processList = [];
    let exactSingle = paymentsWithAmounts.find(p => Math.abs(p.remainingToPay - slipAmount) <= Math.max(1, p.expectedAmount * 0.05));

    if (exactSingle) {
        processList = [exactSingle];
    } else {
        let bestSubset = null;
        const searchLimit = Math.min(paymentsWithAmounts.length, 15);
        const search = (index, subset, sum) => {
            if (bestSubset) return;
            if (sum > 0 && Math.abs(sum - slipAmount) <= subset.length * 2) { 
                bestSubset = [...subset]; return; 
            }
            if (sum > slipAmount + 5 || index >= searchLimit) return;
            subset.push(sortedPayments[index]);
            search(index + 1, subset, sum + sortedPayments[index].remainingToPay);
            subset.pop();
            search(index + 1, subset, sum);
        };
        // Sort by due_date so combination search prioritizes older bills
        const sortedPayments = [...paymentsWithAmounts].sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        search(0, [], 0);

        if (bestSubset) {
            processList = bestSubset;
        } else {
            processList = paymentsWithAmounts;
        }
    }
    return processList;
}