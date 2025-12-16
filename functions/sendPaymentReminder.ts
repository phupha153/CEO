import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// --- Helper Functions ---

function getThaiMidnight(dateInput = new Date()) {
    const thaiTimeString = dateInput.toLocaleString("en-US", { timeZone: "Asia/Bangkok" });
    const thaiDate = new Date(thaiTimeString);
    thaiDate.setHours(0, 0, 0, 0);
    return thaiDate;
}

function generatePaymentHash(payment, currentLateFee) {
    const dataToHash = {
        rent_amount: payment.rent_amount || 0,
        water_units: payment.water_units || 0,
        water_amount: payment.water_amount || 0,
        electricity_units: payment.electricity_units || 0,
        electricity_amount: payment.electricity_amount || 0,
        internet_amount: payment.internet_amount || 0,
        common_fee_amount: payment.common_fee_amount || 0,
        parking_fee_amount: payment.parking_fee_amount || 0,
        other_amount: payment.other_amount || 0,
        // ใช้ค่าปรับที่คำนวณสดในการสร้าง Hash เพื่อให้รูปตรงกับความจริง
        late_fee_amount: currentLateFee || 0, 
        // เราใช้ due_date เป็นตัวอ้างอิงหลัก
        due_date: payment.due_date || ''
    };
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32);
}

function numberToThaiText(number) {
    if (!number || number === 0) return 'ศูนย์บาทถ้วน';
    const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
    const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
    const parts = number.toFixed(2).split('.');
    const integerPart = parseInt(parts[0]);
    const decimalPart = parseInt(parts[1]);

    function convertInteger(num) {
        if (num === 0) return '';
        const numStr = num.toString();
        const len = numStr.length;
        let result = '';
        for (let i = 0; i < len; i++) {
            const digit = parseInt(numStr[i]);
            const position = len - i - 1;
            if (digit === 0) continue;
            if (position === 1 && digit === 1) result += 'สิบ';
            else if (position === 1 && digit === 2) result += 'ยี่สิบ';
            else if (position === 0 && digit === 1 && len > 1) result += 'เอ็ด';
            else result += numbers[digit] + positions[position];
        }
        return result;
    }
    let text = convertInteger(integerPart) + 'บาท';
    if (decimalPart > 0) text += convertInteger(decimalPart) + 'สตางค์';
    else text += 'ถ้วน';
    return text;
}

Deno.serve(async (req) => {
    try {
        console.log('🚀 Starting sendPaymentReminder (No-Update Mode)...');
        const base44 = createClientFromRequest(req);
        const { paymentId, branch_id, template, customMessage } = await req.json();

        // 1. Fetch Data
        let allPayments = [];
        let allTenants = [];
        let allRooms = [];
        let configs = await base44.asServiceRole.entities.Config.list();

        if (paymentId) {
            const paymentResults = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
            const payment = Array.isArray(paymentResults) ? paymentResults[0] : paymentResults;
            allPayments = payment ? [payment] : [];
            if (payment) {
                const [t, r] = await Promise.all([
                    base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id }),
                    base44.asServiceRole.entities.Room.filter({ id: payment.room_id })
                ]);
                allTenants = Array.isArray(t) ? t : [t];
                allRooms = Array.isArray(r) ? r : [r];
            }
        } else if (branch_id) {
             const [t, r, pPending, pOverdue] = await Promise.all([
                base44.asServiceRole.entities.Tenant.filter({ branch_id }),
                base44.asServiceRole.entities.Room.filter({ branch_id }),
                base44.asServiceRole.entities.Payment.filter({ branch_id, status: 'pending' }),
                base44.asServiceRole.entities.Payment.filter({ branch_id, status: 'overdue' })
            ]);
            allTenants = t;
            allRooms = r;
            const pending = Array.isArray(pPending) ? pPending : [];
            const overdue = Array.isArray(pOverdue) ? pOverdue : [];
            allPayments = [...pending, ...overdue].filter(p => !p.bill_sent_date);
        } else {
            return Response.json({ success: false, message: 'กรุณาระบุ branch_id หรือ paymentId' }, { status: 400 });
        }

        const tenantMap = new Map(allTenants.map(t => [t.id, t]));
        const roomMap = new Map(allRooms.map(r => [r.id, r]));
        
        const getConfigValue = (key, bId, def) => {
            if (bId) {
                const c = configs.find(x => x.key === key && x.branch_id === bId);
                if (c?.value) return c.value;
            }
            const g = configs.find(x => x.key === key && !x.branch_id);
            return g?.value || def;
        };

        const recipients = [];

        console.log(`📤 Processing ${allPayments.length} payments...`);

        for (const payment of allPayments) {
            const tenant = tenantMap.get(payment.tenant_id);
            const room = roomMap.get(payment.room_id);
            
            if (!tenant || (!tenant.line_user_id && !tenant.facebook_user_id)) continue;

            // 2. คำนวณวันเกินกำหนด
            let daysOverdue = 0;
            let statusText = 'รอชำระ';
            if (payment.due_date) {
                const dueDateObj = getThaiMidnight(new Date(payment.due_date));
                const todayObj = getThaiMidnight(new Date());
                const diffTime = todayObj.getTime() - dueDateObj.getTime();
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays > 0) {
                    daysOverdue = diffDays;
                    statusText = `เกินกำหนด ${daysOverdue} วัน`;
                }
            }

            // 3. ⭐ คำนวณค่าปรับ (ในตัวแปรเท่านั้น ไม่บันทึก DB)
            let calculatedLateFee = 0;
            if (daysOverdue > 0) {
                const branchId = payment.branch_id;
                
                // Logic เช็ค Config ค่าปรับ
                const tiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && (!c.branch_id || c.branch_id === branchId));
                
                if (tiersEnabledConfig?.value === 'true') {
                     const tiersConfig = configs.find(c => c.key === 'late_fee_tiers' && (!c.branch_id || c.branch_id === branchId));
                     if (tiersConfig?.value) {
                        try {
                            const tiers = JSON.parse(tiersConfig.value);
                            for (const tier of tiers) {
                                const daysFrom = tier.days_from || 1;
                                const daysTo = tier.days_to || 999;
                                const fee = parseFloat(tier.fee_per_day || 0);
                                if (daysOverdue >= daysFrom) {
                                    const d = Math.min(daysOverdue, daysTo) - daysFrom + 1;
                                    if (d > 0) calculatedLateFee += d * fee;
                                }
                                if (daysOverdue <= daysTo) break;
                            }
                        } catch(e) { console.error('Error parsing tiers:', e); }
                     }
                } else {
                    const feeConfig = configs.find(c => c.key === 'late_payment_fee_per_day' && (!c.branch_id || c.branch_id === branchId));
                    const fee = parseFloat(feeConfig?.value || 0);
                    if (!isNaN(fee) && fee > 0) {
                        calculatedLateFee = daysOverdue * fee;
                    }
                }
            }

            console.log(`💰 Payment ${payment.id}: Overdue ${daysOverdue} days, Late Fee (Calculated) = ${calculatedLateFee}`);

            // ❌ [ลบออก] ส่วนที่อัปเดตค่าปรับลง Database ถูกลบออกแล้วตรงนี้ ❌
            
            // คำนวณยอดรวมเพื่อแสดงผล (Display Only)
            // ใช้ยอดเดิมจาก DB (ซึ่งยังไม่รวมค่าปรับ) + ค่าปรับที่เพิ่งคำนวณ
            const originalTotal = payment.total_amount - (payment.late_fee_amount || 0); 
            const displayTotalAmount = originalTotal + calculatedLateFee;

            // 4. สร้างรูป (ส่งค่าปรับไป Override)
            const currentHash = generatePaymentHash(payment, calculatedLateFee);
            const savedHash = payment.invoice_data_hash || '';
            let invoiceImageUrl = payment.invoice_image_url;

            let needsRegenerate = false;
            let needsHashUpdate = false;

            if (!invoiceImageUrl) {
                needsRegenerate = true;
            } else if (!savedHash) {
                needsHashUpdate = true;
            } else if (currentHash !== savedHash) {
                needsRegenerate = true;
            }

            if (needsRegenerate) {
                console.log(`🖼️ Generating invoice image... (with fee: ${calculatedLateFee})`);
                try {
                    // ⭐ ส่ง lateFeeAmount ไปบังคับใช้ในรูป
                    const invoiceResult = await base44.asServiceRole.functions.invoke('generateInvoiceImage', {
                        paymentId: payment.id,
                        forceRegenerate: true,
                        lateFeeAmount: calculatedLateFee 
                    });

                    if (invoiceResult.data?.success && invoiceResult.data?.invoice_image_url) {
                        invoiceImageUrl = invoiceResult.data.invoice_image_url;
                        
                        // ⭐ บันทึกแค่ URL รูปและ Hash ลง DB (ปลอดภัย ไม่กระทบยอดเงิน)
                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            invoice_image_url: invoiceImageUrl,
                            invoice_data_hash: currentHash
                        });
                        console.log(`   ✅ Image generated & URL saved`);
                    }
                } catch (invoiceError) {
                    console.error(`   ❌ Error generating image:`, invoiceError.message);
                }
            } else if (needsHashUpdate) {
                await base44.asServiceRole.entities.Payment.update(payment.id, { invoice_data_hash: currentHash });
            }

            // 5. สร้างข้อความ (ใช้ displayTotalAmount)
            const bankName = getConfigValue('bank_name', payment.branch_id, 'กสิกร');
            const accNo = getConfigValue('bank_account_number', payment.branch_id, '');
            const accName = getConfigValue('bank_account_name', payment.branch_id, '');
            const roomNum = room?.room_number || 'N/A';

            if (!message) {
                if (template === 'overdue') {
                    message = `🔴 แจ้งเตือนเกินกำหนดชำระ\n\n`;
                    message += `คุณ ${tenant.full_name} ห้อง ${roomNum}\n`;
                    message += `💰 ยอดเงิน: ${originalTotal.toLocaleString()} บาท`;
                    if (calculatedLateFee > 0) {
                        message += `\n⚠️ ค่าปรับล่าช้า: +${calculatedLateFee.toLocaleString()} บาท`;
                    }
                    message += `\n💰 รวมทั้งสิ้น: ${displayTotalAmount.toLocaleString()} บาท`; // ใช้ยอดที่คำนวณสด
                    message += `\nเกินกำหนดมาแล้ว: ${daysOverdue} วัน\n\n`;
                    message += `กรุณาชำระโดยด่วนค่ะ\n\n`;
                    message += `💳 โอนเงินได้ที่:\n${bankName} ${accNo}\nชื่อบัญชี: ${accName}\n\n`;
                    message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
                } else {
                    message = `📢 แจ้งเตือนค่าเช่า\n\n`;
                    message += `สวัสดีคุณ ${tenant.full_name}\n`;
                    message += `ห้อง ${roomNum}\n\n`;
                    message += `💰 รวมทั้งสิ้น: ${displayTotalAmount.toLocaleString()} บาท\n`;
                    if (calculatedLateFee > 0) {
                        message += `(รวมค่าปรับ ${calculatedLateFee.toLocaleString()} บาท)\n`;
                    }
                    message += `\nสถานะ: ${statusText}\n\n`;
                    message += `💳 โอนเงินได้ที่: ${bankName} ${accNo} (${accName})\n\n`;
                    message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
                }
            }
            
            if (invoiceImageUrl) {
                message += `\n\n📄 ดูใบแจ้งหนี้: ${invoiceImageUrl}`;
            }

            recipients.push({
                lineUserId: tenant.line_user_id,
                facebookUserId: tenant.facebook_user_id,
                message: message,
                metadata: { 
                    paymentId: payment.id,
                    tenantId: tenant.id,
                    branchId: payment.branch_id
                }
            });
        }

        if (recipients.length === 0) {
            return Response.json({ success: false, message: 'ไม่มีผู้รับที่เชื่อมต่อระบบแชท' });
        }

        console.log(`📤 Dispatching messages to ${recipients.length} recipients...`);

        // Update bill_sent_date (อันนี้ควรอัปเดต เพื่อให้รู้ว่าส่งแล้ว)
        const paymentIdsToUpdate = recipients.map(r => r.metadata.paymentId);
        const nowStr = new Date().toISOString();
        for (let i = 0; i < paymentIdsToUpdate.length; i += 50) {
            const batch = paymentIdsToUpdate.slice(i, i + 50);
            await Promise.all(batch.map(id => 
                base44.asServiceRole.entities.Payment.update(id, { bill_sent_date: nowStr })
                    .catch(err => console.warn(`⚠️ Failed to update sent date for ${id}:`, err.message))
            ));
        }

        // Send Messages logic (เหมือนเดิม)
        let successCount = 0;
        let failCount = 0;
        const lineRecipients = recipients.filter(r => r.lineUserId);
        const facebookRecipients = recipients.filter(r => r.facebookUserId);

        if (lineRecipients.length > 0) {
            try {
                const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                    recipients: lineRecipients,
                    options: { batchSize: 10, delayBetweenBatches: 2000 }
                });
                successCount += batchResult.data.success || 0;
                failCount += batchResult.data.failed || 0;
            } catch (err) { failCount += lineRecipients.length; }
        }

        if (facebookRecipients.length > 0) {
            try {
                const fbResult = await base44.asServiceRole.functions.invoke('sendFacebookPaymentReminder', { recipients: facebookRecipients });
                successCount += fbResult.data.success || 0;
                failCount += fbResult.data.failed || 0;
            } catch (err) { failCount += facebookRecipients.length; }
        }

        return Response.json({ 
            success: true, 
            message: `ส่งข้อความสำเร็จ ${successCount}/${recipients.length} รายการ`,
            sent: successCount,
            failed: failCount
        });

    } catch (error) {
        console.error('Error in sendPaymentReminder:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});