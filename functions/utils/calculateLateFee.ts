import { parseISO, differenceInDays } from 'npm:date-fns';

/**
 * คำนวณค่าปรับล่าช้าตามกฎของสาขา
 * @param {Object} payment - Payment object
 * @param {Array} configs - Array of Config objects
 * @param {string} branchId - Branch ID
 * @returns {number} ค่าปรับที่คำนวณได้ (บาท)
 */
export function calculateLateFee(payment, configs, branchId) {
    if (!payment || !payment.due_date) return 0;
    
    // ⭐ ถ้าชำระแล้ว ให้ใช้ค่าปรับที่บันทึกไว้
    if (payment.status === 'paid') {
        return payment.late_fee_amount || 0;
    }
    
    // ⭐ เช็คว่าคำนวณวันนี้แล้วหรือยัง (ป้องกันคำนวณซ้ำ)
    if (payment.late_fee_last_calculated) {
        const lastCalcDate = new Date(payment.late_fee_last_calculated);
        lastCalcDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (lastCalcDate.getTime() === today.getTime()) {
            return payment.late_fee_amount || 0; // ✅ ใช้ค่าเดิม
        }
    }

    try {
        const dueDate = parseISO(payment.due_date);
        const today = new Date();
        const daysOverdue = differenceInDays(today, dueDate);

        if (daysOverdue <= 0) return 0;

        // Helper function to get config value
        const getConfigValue = (key, defaultValue = null) => {
            const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
            if (branchConfig?.value !== undefined && branchConfig?.value !== null) return branchConfig.value;
            
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value !== undefined && globalConfig?.value !== null ? globalConfig.value : defaultValue;
        };

        // ตรวจสอบว่าเปิดใช้ค่าปรับแบบขั้นบันไดหรือไม่
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

                    return totalFee;
                } catch (e) {
                    console.error('Error parsing late fee tiers:', e);
                }
            }
        }

        // ค่าปรับแบบธรรมดา (per day)
        const lateFeePerDay = parseFloat(getConfigValue('late_payment_fee_per_day', '0'));
        
        if (lateFeePerDay === 0 || isNaN(lateFeePerDay)) return 0;

        return daysOverdue * lateFeePerDay;
    } catch (error) {
        console.error('Error calculating late fee:', error);
        return 0;
    }
}