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
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🧮 [HELPER FUNCTION] calculateLateFee() CALLED');
    console.log(`   📋 Payment ID: ${payment?.id?.substring(0, 12) || 'N/A'}...`);
    console.log(`   📅 Due Date: ${payment?.due_date || 'N/A'}`);
    console.log(`   📅 Calculation Date: ${calculationDate ? calculationDate.toISOString().split('T')[0] : 'Today'}`);
    console.log(`   🏢 Branch ID: ${branchId?.substring(0, 12) || 'N/A'}...`);
    console.log(`   📊 Payment Status: ${payment?.status || 'N/A'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (!payment || !payment.due_date) {
        console.log('⚠️ [HELPER] No payment or due_date → Returning 0');
        return { lateFeeAmount: 0, daysLate: 0 };
    }
    
    // 🔒 LOCK 1: ถ้าชำระแล้ว → ใช้ค่าปรับที่บันทึกไว้
    if (payment.status === 'paid') {
        console.log(`🔒 [HELPER] Payment PAID → Using locked late fee: ${payment.late_fee_amount || 0} บาท`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    // 🔒 LOCK 2: ถ้า admin ล็อคค่าปรับไว้ → ไม่คำนวณใหม่
    if (payment.late_fee_locked === true) {
        console.log(`🔒 [HELPER] Late fee LOCKED by admin: ${payment.late_fee_amount || 0} บาท`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    // ⭐ ถ้าไม่ระบุวันที่ ให้ใช้วันนี้
    const calcDate = calculationDate || new Date();
    
    // ⭐ เช็คว่าคำนวณวันนี้แล้วหรือยัง (ป้องกันคำนวณซ้ำ) - เฉพาะเมื่อใช้วันนี้
    if (!calculationDate && payment.late_fee_last_calculated) {
        const lastCalcDate = new Date(payment.late_fee_last_calculated);
        lastCalcDate.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (lastCalcDate.getTime() === today.getTime()) {
            return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 }; // ✅ ใช้ค่าเดิม
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

                                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                                console.log('✅ [HELPER] CALCULATION COMPLETE (Tiered)');
                                console.log(`   💰 Total Late Fee: ${totalFee} บาท`);
                                console.log(`   📆 Days Late: ${daysOverdue} days`);
                                console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
                                return { lateFeeAmount: totalFee, daysLate: daysOverdue };
                } catch (e) {
                    console.error('Error parsing late fee tiers:', e);
                }
            }
        }

        // ค่าปรับแบบธรรมดา (per day)
        const lateFeePerDay = parseFloat(getConfigValue('late_payment_fee_per_day', '0'));
        
        if (lateFeePerDay === 0 || isNaN(lateFeePerDay)) {
            console.log('⚠️ [HELPER] No late fee config → Returning 0');
            return { lateFeeAmount: 0, daysLate: daysOverdue };
        }

        const simpleFee = daysOverdue * lateFeePerDay;
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ [HELPER] CALCULATION COMPLETE (Simple)');
        console.log(`   💰 Late Fee: ${simpleFee} บาท (${daysOverdue} days × ${lateFeePerDay}฿/day)`);
        console.log(`   📆 Days Late: ${daysOverdue} days`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return { lateFeeAmount: simpleFee, daysLate: daysOverdue };
    } catch (error) {
        console.error('Error calculating late fee:', error);
        return { lateFeeAmount: 0, daysLate: 0 };
    }
}