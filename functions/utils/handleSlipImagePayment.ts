// ⭐ Extracted from lineWebhookHandler - Smart Payment Matching Logic

export async function selectBestPaymentMatch(pendingPayments, slipAmount) {
    if (!pendingPayments || pendingPayments.length === 0) {
        return null;
    }

    // ⭐ เรียงตาม due_date เก่าสุดก่อน (สำหรับใช้เป็น fallback)
    pendingPayments.sort((a, b) => {
        try {
            return new Date(a.due_date) - new Date(b.due_date);
        } catch {
            return 0;
        }
    });
    
    // ⭐⭐⭐ SMART MATCHING: จับคู่ยอดเงินตรงกันก่อน (ถ้าไม่มีค่อยใช้ due_date เก่าสุด)
    let selectedPayment = pendingPayments[0]; // Fallback: บิลเก่าสุด

    if (slipAmount > 0) {
        console.log('\n========== 💰 SMART AMOUNT MATCHING ==========');
        console.log(`💵 Slip Amount: ${slipAmount.toLocaleString()}฿`);
        console.log(`📊 Total Pending Bills: ${pendingPayments.length}`);
        
        // Step 1: หาบิลที่ยอดเงินตรงกันเป๊ะ (คำนวณจาก total_amount - paid_amount)
        const exactMatches = pendingPayments.filter(p => {
            const currentPaid = parseFloat(p.paid_amount || 0);
            const remainingAmount = parseFloat(p.total_amount || 0) - currentPaid;
            const isMatch = Math.abs(remainingAmount - slipAmount) < 1; // ยอมรับความต่างไม่เกิน 1 บาท
            
            if (isMatch) {
                console.log(`   ✅ EXACT MATCH: Payment ${p.id.substring(0, 8)}... → Remaining: ${remainingAmount.toLocaleString()}฿`);
            }
            
            return isMatch;
        });
        
        console.log(`🎯 Found ${exactMatches.length} exact match(es)`);
        
        if (exactMatches.length > 0) {
            // ถ้าเจอหลายบิลที่ยอดตรงกัน → เลือกบิลที่ due_date เก่าสุด
            if (exactMatches.length > 1) {
                exactMatches.sort((a, b) => {
                    try {
                        return new Date(a.due_date) - new Date(b.due_date);
                    } catch {
                        return 0;
                    }
                });
                console.log(`   📌 Multiple matches found - selecting oldest due_date: ${exactMatches[0].due_date}`);
            }
            
            selectedPayment = exactMatches[0];
            console.log(`✅ SELECTED: Payment ${selectedPayment.id.substring(0, 8)}... (Exact Amount Match)`);
        } else {
            console.log(`   ⚠️ No exact match - using FALLBACK: oldest due_date`);
            console.log(`   📌 SELECTED: Payment ${selectedPayment.id.substring(0, 8)}... (Oldest Due Date: ${selectedPayment.due_date})`);
        }
        console.log('===============================================\n');
    }

    return selectedPayment;
}