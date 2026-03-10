// ⭐ Shared Late Fee Calculation Logic (Frontend Version)
// ใช้ร่วมกันระหว่าง Invoice, PublicInvoice, Payments
// เพื่อให้การคำนวณค่าปรับสอดคล้องกันทุกหน้า

import { parseISO, differenceInDays } from "date-fns";

export function calculateLateFee(payment, configs, selectedBranchId) {
  if (!payment || !payment.due_date) return 0;
  
  // ⭐ ถ้าชำระแล้ว หรือบิลถูกล็อคค่าปรับ (เช่น บิลค่ามัดจำ) ให้ใช้ค่าปรับเดิม
  if (payment.status === 'paid' || payment.late_fee_locked === true) {
    return payment.late_fee_amount || 0;
  }
  
  // ⭐ ถ้ามีค่าปรับบันทึกไว้แล้ว (เช่น อัปเดตโดย cron) ให้ใช้ตามนั้น
  if (payment.late_fee_amount && payment.late_fee_amount > 0) {
    return payment.late_fee_amount;
  }

  // ⭐ คำนวณค่าปรับสำหรับบิลที่ยังไม่ชำระ
  try {
    const dueDate = parseISO(payment.due_date);
    const today = new Date();
    const daysOverdue = differenceInDays(today, dueDate);

    if (daysOverdue <= 0) return 0;

    // ตรวจสอบว่าเปิดใช้ค่าปรับแบบขั้นบันไดหรือไม่
    const branchConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && c.branch_id === selectedBranchId);
    const globalConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && !c.branch_id);
    const tiersEnabledConfig = branchConfig || globalConfig;
    const tiersEnabled = tiersEnabledConfig?.value === 'true';

    if (tiersEnabled) {
      const branchTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && c.branch_id === selectedBranchId);
      const globalTiersConfig = configs.find(c => c.key === 'late_fee_tiers' && !c.branch_id);
      const tiersConfig = branchTiersConfig || globalTiersConfig;
      
      if (tiersConfig?.value) {
        try {
          const tiers = JSON.parse(tiersConfig.value);
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

    // ค่าปรับแบบธรรมดา (ต่อวัน)
    const branchLateFeeConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && c.branch_id === selectedBranchId);
    const globalLateFeeConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && !c.branch_id);
    const lateFeeConfig = branchLateFeeConfig || globalLateFeeConfig;
    const lateFeePerDay = lateFeeConfig ? parseFloat(lateFeeConfig.value) : 0;
    
    if (lateFeePerDay === 0 || isNaN(lateFeePerDay)) return 0;

    return daysOverdue * lateFeePerDay;
  } catch (error) {
    console.error('Error calculating late fee:', error);
    return 0;
  }
}