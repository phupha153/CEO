import { parseISO, differenceInDays } from 'npm:date-fns';

/**
 * คำนวณค่าปรับล่าช้าตามกฎของสาขา
 * @param {Object} payment - Payment object
 * @param {Array} configs - Array of Config objects
 * @param {string} branchId - Branch ID
 * @returns {number} ค่าปรับที่คำนวณได้ (บาท)
 */
/**
 * คำนวณค่าปรับล่าช้าตามกฎของสาขา
 * @param {Object} payment - Payment object
 * @param {Array} configs - Array of Config objects  
 * @param {string} branchId - Branch ID
 * @param {Date} calculationDate - วันที่ใช้คำนวณ (optional, default = วันนี้)
 * @returns {Object} { lateFeeAmount: number, daysLate: number }
 */
export function calculateLateFee(payment, configs, branchId, calculationDate = null) {
    console.log(`🧮 LateFee: ${payment?.id?.substring(0, 8)}... | Due: ${payment?.due_date} | Status: ${payment?.status}`);
    
    if (!payment || !payment.due_date) {
        console.log('  ⏭️ SKIP: No due_date');
        return { lateFeeAmount: 0, daysLate: 0 };
    }
    
    // 🔒 LOCK 1: ถ้าชำระแล้ว
    if (payment.status === 'paid') {
        console.log(`  🔒 SKIP: Already paid (locked: ${payment.late_fee_amount || 0}฿)`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    // 🔒 LOCK 2: ถ้า admin ล็อคค่าปรับ
    if (payment.late_fee_locked === true) {
        console.log(`  🔒 SKIP: Admin locked (${payment.late_fee_amount || 0}฿)`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    const calcDate = calculationDate || new Date();
    
    // 🔒 LOCK 3: เช็คว่าคำนวณวันนี้แล้วหรือยัง (ทำงานเสมอ ไม่ว่า calculationDate มีค่าหรือไม่)
    if (payment.late_fee_last_calculated) {
        const lastCalcDate = new Date(payment.late_fee_last_calculated);
        lastCalcDate.setHours(0, 0, 0, 0);
        
        // ⭐ ใช้เวลาไทย (UTC+7)
        const now = new Date();
        const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const today = new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate());
        
        console.log(`  🔍 LastCalc: ${lastCalcDate.toISOString().split('T')[0]} | Today(TH): ${today.toISOString().split('T')[0]} | Match: ${lastCalcDate.getTime() === today.getTime()}`);
        
        if (lastCalcDate.getTime() === today.getTime()) {
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

                    console.log(`  ✅ Tiered: ${daysOverdue}d → ${totalFee}฿`);
                    return { lateFeeAmount: totalFee, daysLate: daysOverdue };
                } catch (e) {
                    console.error('Error parsing late fee tiers:', e);
                }
            }
        }

        // ค่าปรับแบบธรรมดา (per day)
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