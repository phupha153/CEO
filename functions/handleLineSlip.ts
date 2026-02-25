import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import { differenceInDays, parseISO } from 'npm:date-fns@3.0.0';

// ⭐ Helper: Calculate Late Fee
function calculateLateFee(payment, configs, branchId, calculationDate = null) {
    const dueDate = parseISO(payment.due_date);
    const daysLate = Math.max(0, Math.floor((calculationDate - dueDate) / (1000 * 60 * 60 * 24)));
    
    if (daysLate === 0) {
        return { lateFeeAmount: 0, daysLate: 0 };
    }
    
    const getConfigValue = (key) => {
        const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
        if (branchConfig) return branchConfig.value;
        const globalConfig = configs.find(c => c.key === key && !c.branch_id);
        return globalConfig?.value || null;
    };
    
    const lateFeeTierConfig = getConfigValue('late_fee_tier');
    let lateFeeAmount = 0;
    
    if (lateFeeTierConfig) {
        try {
            const tiers = JSON.parse(lateFeeTierConfig);
            for (const tier of tiers) {
                if (daysLate >= tier.from && daysLate <= tier.to) {
                    lateFeeAmount = tier.amount;
                    break;
                }
            }
        } catch (e) {
            console.warn('Invalid late_fee_tier config');
        }
    } else {
        const lateFeePerDay = parseFloat(getConfigValue('late_fee_per_day') || '0');
        lateFeeAmount = daysLate * lateFeePerDay;
    }
    
    const lateFeeMax = parseFloat(getConfigValue('late_fee_max') || '0');
    if (lateFeeMax > 0) {
        lateFeeAmount = Math.min(lateFeeAmount, lateFeeMax);
    }
    
    return { lateFeeAmount: Math.round(lateFeeAmount * 100) / 100, daysLate };
}

// ⭐ Helper: Account Match
function isAccountMatch(maskedSlipAccount, myRealAccount) {
    if (!maskedSlipAccount || !myRealAccount) {
        return false;
    }
    
    const slipAcc = String(maskedSlipAccount).replace(/[- ]/g, '').toLowerCase();
    const myAcc = String(myRealAccount).replace(/[- ]/g, '').toLowerCase();
    
    if (Math.abs(slipAcc.length - myAcc.length) > 2) {
        return false;
    }
    
    let matchedCount = 0;
    const minRequired = slipAcc.length <= 4 ? 2 : 3;
    
    for (let i = 0; i < Math.min(slipAcc.length, myAcc.length); i++) {
        if (slipAcc[i] === 'x' || slipAcc[i] === '*') {
            continue;
        }
        if (slipAcc[i] === myAcc[i]) {
            matchedCount++;
        } else {
            return false;
        }
    }
    
    return matchedCount >= minRequired;
}

export async function handleSlipImage(base44, lineUserId, messageId, branchId, replyToken, getLineToken, sendMessage) {
    const slip2goApiKey = Deno.env.get('SLIP2GO_API_KEY');
    const lineToken = await getLineToken(base44, branchId);
    
    if (!lineToken || !slip2goApiKey) {
        await sendMessage(base44, lineUserId, '❌ ระบบขัดข้อง กรุณาติดต่อเจ้าของหอพัก', branchId, replyToken);
        return;
    }

    try {
        if (!branchId) {
            console.error(`❌ CRITICAL: No branchId available for slip verification`);
            await sendMessage(base44, lineUserId, '❌ เกิดข้อผิดพลาดในระบบ กรุณาติดต่อเจ้าของหอพัก', null, replyToken);
            return;
        }

        let tenant = null;
        try {
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ 
                line_user_id: lineUserId,
                branch_id: branchId
            });
            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
        } catch (e) {
            console.log('⚠️ Could not find tenant:', e.message);
        }

        if (!tenant) {
            await sendMessage(base44, lineUserId, 'กรุณาลงทะเบียนด้วยหมายเลขโทรศัพท์ก่อนใช้งาน\nพิมพ์: ลงทะเบียน 0812345678', branchId, replyToken);
            return;
        }

        let pendingPayments = [];
        try {
            const paymentResult = await base44.asServiceRole.entities.Payment.filter({ 
                tenant_id: tenant.id,
                branch_id: branchId,
                status: { $in: ['pending', 'overdue', 'partial_paid'] }
            });
            pendingPayments = Array.isArray(paymentResult) ? paymentResult : (paymentResult ? [paymentResult] : []);
        } catch (e) {
            const allPayments = await base44.asServiceRole.entities.Payment.list('-created_date', 500);
            pendingPayments = allPayments.filter(p => 
                p.tenant_id === tenant.id && 
                p.branch_id === branchId &&
                (p.status === 'pending' || p.status === 'overdue' || p.status === 'partial_paid')
            );
        }

        if (pendingPayments.length === 0) {
            return;
        }

        pendingPayments.sort((a, b) => {
            try {
                return new Date(a.due_date) - new Date(b.due_date);
            } catch {
                return 0;
            }
        });

        let imageResponse;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 30000);
                
                imageResponse = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
                    headers: { 'Authorization': `Bearer ${lineToken}` },
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (imageResponse.ok) {
                    break;
                }
                
                console.log(`Download attempt ${retryCount + 1} failed: ${imageResponse.status}`);
                retryCount++;
                
                if (retryCount < maxRetries) {
                    const backoffMs = 2000 * Math.pow(2, retryCount);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
                
            } catch (downloadError) {
                console.error(`Download attempt ${retryCount + 1} error:`, downloadError.message);
                retryCount++;
                
                if (retryCount < maxRetries) {
                    const backoffMs = 2000 * Math.pow(2, retryCount);
                    await new Promise(resolve => setTimeout(resolve, backoffMs));
                }
            }
        }

        if (!imageResponse || !imageResponse.ok) {
            await sendMessage(base44, lineUserId, 
                '❌ ไม่สามารถดาวน์โหลดรูปภาพได้',
                branchId,
                replyToken
            );
            return;
        }

        const imageBlob = await imageResponse.blob();
        
        if (imageBlob.size > 10 * 1024 * 1024) {
            await sendMessage(base44, lineUserId, 
                '❌ รูปภาพมีขนาดใหญ่เกินไป (เกิน 10MB)\n\nกรุณาส่งรูปที่มีขนาดเล็กกว่าค่ะ',
                branchId,
                replyToken
            );
            return;
        }

        let slipImageUrl = '';
        let uploadRetryCount = 0;
        const maxUploadRetries = 3;
        
        while (uploadRetryCount < maxUploadRetries) {
            try {
                const file = new File([imageBlob], `slip-${Date.now()}.jpg`, { type: imageBlob.type });
                const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
                slipImageUrl = uploadResult.file_url;
                break;
                
            } catch (uploadError) {
                uploadRetryCount++;
                
                if (uploadRetryCount >= maxUploadRetries) {
                    const pendingPayment = (Array.isArray(pendingPayments) ? pendingPayments : [pendingPayments])[0];
                    if (pendingPayment) {
                        await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                            notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่อัพโหลดไม่สำเร็จ - กรุณาให้ส่งใหม่`
                        });
                    }
                    
                    await sendMessage(base44, lineUserId, 
                        '⚠️ ระบบไม่สามารถบันทึกรูปสลิปได้\n\nกรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าของหอพักค่ะ',
                        branchId,
                        replyToken
                    );
                    return;
                }
                
                const backoffMs = 2000 * Math.pow(2, uploadRetryCount);
                await new Promise(resolve => setTimeout(resolve, backoffMs));
            }
        }

        const formData = new FormData();
        formData.append('file', imageBlob, 'slip.jpg');
        formData.append('payload', JSON.stringify({ checkDuplicate: true }));
        
        let slip2goResponse;
        let slip2goData;
        let verificationMethod = '';
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            slip2goResponse = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image/info', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${slip2goApiKey.trim()}` },
                body: formData,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            const responseText = await slip2goResponse.text();
            slip2goData = JSON.parse(responseText);
            
            const isValidCode = slip2goData.code === '200200' || slip2goData.code === 200200;
            
            if ((slip2goResponse.ok && slip2goData.success && slip2goData.data) || (isValidCode && slip2goData.data)) {
                verificationMethod = 'qr-image';
            }
            
            if (slip2goResponse.status === 504 || responseText.includes('504')) {
                const pendingPayment = (Array.isArray(pendingPayments) ? pendingPayments : [pendingPayments])[0];
                if (pendingPayment) {
                    await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                        payment_slip_url: slipImageUrl,
                        notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่ระบบตรวจสอบช้า`
                    });
                }
                
                await sendMessage(base44, lineUserId, 
                    `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ`,
                    branchId,
                    replyToken
                );
                return;
            }
        } catch (fetchError) {
            const pendingPayment = (Array.isArray(pendingPayments) ? pendingPayments : [pendingPayments])[0];
            if (pendingPayment) {
                await base44.asServiceRole.entities.WebhookLog.create({
                    webhook_type: 'line',
                    branch_id: branchId,
                    event_type: 'slip_verification_error',
                    line_user_id: lineUserId,
                    tenant_id: tenant?.id,
                    payment_id: pendingPayment.id,
                    status: 'error',
                    message: 'Slip2Go API error',
                    error_message: fetchError.message
                }).catch(() => {});

                await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่ระบบขัดข้อง`
                });
            }
            
            await sendMessage(base44, lineUserId, 
                `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ`,
                branchId,
                replyToken
            );
            return;
        }

        const errorCode = slip2goData.code;
        const errorMessage = slip2goData.message || '';
        const isDuplicateError = errorCode === '200501' || errorMessage.toLowerCase().includes('duplicate');

        if (isDuplicateError) {
            const pendingPayment = (Array.isArray(pendingPayments) ? pendingPayments : [pendingPayments])[0];
            if (pendingPayment) {
                await base44.asServiceRole.entities.WebhookLog.create({
                    webhook_type: 'line',
                    branch_id: branchId,
                    event_type: 'slip_duplicate',
                    line_user_id: lineUserId,
                    tenant_id: tenant?.id,
                    payment_id: pendingPayment.id,
                    status: 'warning',
                    message: 'Duplicate slip detected'
                }).catch(() => {});
            }

            await sendMessage(base44, lineUserId, 
                `⚠️ สลิปนี้เคยถูกใช้ไปแล้ว\n\nกรุณาส่งสลิปใหม่ค่ะ`,
                branchId,
                replyToken
            );
            return;
        }

        const isFraudSlip = errorCode === '200500' || errorMessage.toLowerCase().includes('fraud');
        if (isFraudSlip) {
            const pendingPayment = (Array.isArray(pendingPayments) ? pendingPayments : [pendingPayments])[0];
            if (pendingPayment) {
                await base44.asServiceRole.entities.WebhookLog.create({
                    webhook_type: 'line',
                    branch_id: branchId,
                    event_type: 'slip_fraud',
                    line_user_id: lineUserId,
                    tenant_id: tenant?.id,
                    payment_id: pendingPayment.id,
                    status: 'warning',
                    message: 'Fraud slip detected',
                    details: { error_code: errorCode }
                }).catch(() => {});
            }
            return;
        }

        const isSlipValid = slip2goResponse.ok && slip2goData.data && verificationMethod;

        if (!isSlipValid) {
            const isSlipNotFound = errorCode === '200404' || errorMessage === 'Slip not found';

            if (isSlipNotFound) {
                const pendingPayment = (Array.isArray(pendingPayments) ? pendingPayments : [pendingPayments])[0];
                if (pendingPayment) {
                    const now = new Date().toISOString();
                    await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                        payment_slip_url: slipImageUrl,
                        notes: `${pendingPayment.notes || ''}\n\n⏳ รอตรวจสอบซ้ำ: ธนาคารยังไม่มีข้อมูล - ${now}`
                    });
                }

                console.log('📸 Slip saved silently - waiting for cron recheck');
                return;
            }

            return;
        }

        const slipData = slip2goData.data;
        const senderName = slipData.sender?.account?.name?.th || 
                          slipData.sender?.displayName || 'N/A';
        const transDate = slipData.dateTime || slipData.transDate || new Date().toISOString().split('T')[0];

        // ⭐ Extract amount
        let slipAmount = 0;
        const possiblePaths = [
            ['amount'],
            ['transAmount'],
            ['transaction', 'amount'],
            ['payment', 'amount'],
            ['data', 'amount'],
            ['receiver', 'amount'],
            ['sender', 'amount'],
            ['receiver', 'account', 'amount'],
            ['sender', 'account', 'amount']
        ];
        
        for (const path of possiblePaths) {
            let current = slipData;
            let isValid = true;
            
            for (const key of path) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    isValid = false;
                    break;
                }
            }
            
            if (isValid && current !== null && current !== undefined) {
                const amount = typeof current === 'number' ? current : parseFloat(current);
                if (!isNaN(amount) && amount > 0) {
                    slipAmount = amount;
                    break;
                }
            }
        }

        if (slipAmount === 0) {
            const pendingPayment = (Array.isArray(pendingPayments) ? pendingPayments : [pendingPayments])[0];
            if (pendingPayment) {
                await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ระบบอ่านยอดไม่ได้`
                });
            }
            
            await sendMessage(base44, lineUserId, 
                `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ`,
                branchId,
                replyToken
            );
            return;
        }

        // ⭐ Get configs and check account
        const configs = await base44.asServiceRole.entities.Config.list();
        const getConfigValue = (key) => {
            const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
            if (branchConfig) return branchConfig.value;
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || null;
        };

        const expectedAccountNumber = getConfigValue('bank_account_number');
        const expectedPromptPay = getConfigValue('promptpay');
        const receiverAccount = slipData.receiver?.account?.bank?.account || '';
        const receiverPromptPay = slipData.receiver?.account?.proxy?.value || '';

        if ((!expectedAccountNumber || expectedAccountNumber.trim() === '') && 
            (!expectedPromptPay || expectedPromptPay.trim() === '')) {
            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: pendingPayments[0].room_id });
            const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
            const roomNumber = room?.room_number || 'ไม่ทราบ';

            const pendingPayment = (Array.isArray(pendingPayments) ? pendingPayments : [pendingPayments])[0];
            if (pendingPayment) {
                await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ`
                });
            }

            await sendMessage(base44, lineUserId, 
                `📸 ได้รับสลิปแล้ว!\n\n⚠️ ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ\nกรุณารอเจ้าของหอพักตรวจสอบค่ะ`,
                branchId,
                replyToken
            );
            return;
        }

        let accountMatch = false;
        let matchMethod = '';

        if (expectedAccountNumber) {
            accountMatch = isAccountMatch(receiverAccount, expectedAccountNumber);
            if (accountMatch) {
                matchMethod = 'Bank Account';
            }
        }

        if (!accountMatch && expectedPromptPay) {
            const promptPayMatch1 = isAccountMatch(receiverPromptPay, expectedPromptPay);
            
            if (!promptPayMatch1) {
                const promptPayMatch2 = isAccountMatch(receiverAccount, expectedPromptPay);
                accountMatch = promptPayMatch2;
                if (promptPayMatch2) matchMethod = 'PromptPay (via receiverAccount)';
            } else {
                accountMatch = true;
                matchMethod = 'PromptPay';
            }
        }

        if (!accountMatch) {
            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: pendingPayments[0].room_id });
            const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
            const roomNumber = room?.room_number || 'ไม่ทราบ';

            const errorMsg = `โอนเงินไปผิดบัญชี\n\nตรวจพบโอนเข้า: ${receiverAccount || receiverPromptPay}\nควรโอนเข้า: ${expectedAccountNumber || expectedPromptPay}\n\nกรุณาตรวจสอบอีกครั้ง`;

            const pendingPayment = (Array.isArray(pendingPayments) ? pendingPayments : [pendingPayments])[0];
            if (pendingPayment) {
                await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ${errorMsg}`
                });
            }

            await sendMessage(base44, lineUserId, 
                `❌ ${errorMsg}\n\nกรุณารอเจ้าของหอพักตรวจสอบค่ะ 🙏`,
                branchId,
                replyToken
            );
            return;
        }

        console.log('💰 Account verified - Smart Bill Matching...');
        
        // ⭐ INLINE: processBillMatching
        async function processBillMatching(
            base44, 
            slipAmount, 
            pendingPayments, 
            tenant, 
            branchId, 
            senderName, 
            transDate, 
            slipImageUrl, 
            verificationMethod, 
            lineUserId, 
            replyToken,
            configs,
            sendMessage
        ) {
            const now = new Date();
            const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
            const today = new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate());
            
            console.log('\n========== 🧠 SMART BILL MATCHING ==========');
            console.log(`💰 Slip amount: ${slipAmount}฿`);
            console.log(`📋 Pending bills: ${pendingPayments.length}`);
            
            let matchedBill = null;
            let matchedBillIndex = -1;
            
            for (let i = 0; i < pendingPayments.length; i++) {
                const bill = pendingPayments[i];
                const billTotal = parseFloat(bill.total_amount) || 0;
                
                if (billTotal === 0) continue;
                
                const diffPercent = Math.abs(slipAmount - billTotal) / billTotal * 100;
                
                if (diffPercent <= 1) {
                    matchedBill = bill;
                    matchedBillIndex = i;
                    break;
                }
            }
            
            console.log('==========================================\n');
            
            if (matchedBill) {
                console.log(`✅ EXACT MATCH: Bill ${matchedBillIndex + 1}`);
                
                const baseAmount = (parseFloat(matchedBill.rent_amount) || 0) +
                                  (parseFloat(matchedBill.water_amount) || 0) +
                                  (parseFloat(matchedBill.electricity_amount) || 0) +
                                  (parseFloat(matchedBill.internet_amount) || 0) +
                                  (parseFloat(matchedBill.common_fee_amount) || 0) +
                                  (parseFloat(matchedBill.parking_fee_amount) || 0) +
                                  (parseFloat(matchedBill.other_amount) || 0);
                
                const { lateFeeAmount, daysLate } = calculateLateFee(matchedBill, configs, branchId, today);
                const expectedAmount = baseAmount + lateFeeAmount;
                
                await base44.asServiceRole.entities.Payment.update(matchedBill.id, {
                    status: 'paid',
                    payment_date: transDate.split('T')[0],
                    payment_slip_url: slipImageUrl,
                    late_fee_amount: lateFeeAmount,
                    total_amount: expectedAmount,
                    paid_amount: expectedAmount,
                    notes: `${matchedBill.notes || ''}\n\n✅ ตรวจสอบสลิปอัตโนมัติผ่าน LINE: ${senderName} โอน ${slipAmount.toLocaleString()} บาท`
                });
                
                if (tenant?.id) {
                    try {
                        await base44.asServiceRole.functions.invoke('calculatePaymentScores', {
                            tenant_id: tenant.id
                        });
                    } catch (e) {
                        console.log('⚠️ Score calculation failed');
                    }
                }
                
                try {
                    await base44.asServiceRole.functions.invoke('sendReceipt', { 
                        paymentId: matchedBill.id 
                    });
                } catch (e) {
                    await sendMessage(base44, lineUserId, 
                        `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${slipAmount.toLocaleString()} บาท`,
                        branchId,
                        replyToken
                    );
                }
                return;
            }
            
            // CASCADE
            console.log('⚠️ NO EXACT MATCH - Cascade payment\n');
            
            let remainingAmount = slipAmount;
            let billsToUpdate = [];
            
            for (let i = 0; i < pendingPayments.length && remainingAmount > 0; i++) {
                const bill = pendingPayments[i];
                const billTotal = parseFloat(bill.total_amount) || 0;
                const billPaid = parseFloat(bill.paid_amount) || 0;
                const billRemaining = Math.max(0, billTotal - billPaid);
                
                if (billRemaining === 0) continue;
                
                const paymentAmount = Math.min(remainingAmount, billRemaining);
                const newPaidAmount = billPaid + paymentAmount;
                const newStatus = (newPaidAmount >= billTotal * 0.95) ? 'paid' : 'partial_paid';
                
                billsToUpdate.push({
                    id: bill.id,
                    paymentAmount,
                    newPaidAmount,
                    newStatus,
                    billTotal,
                    billRemaining
                });
                
                remainingAmount -= paymentAmount;
            }
            
            for (let idx = 0; idx < billsToUpdate.length; idx++) {
                const billUpdate = billsToUpdate[idx];
                const bill = pendingPayments.find(b => b.id === billUpdate.id);
                
                const { lateFeeAmount } = calculateLateFee(bill, configs, branchId, today);
                
                await base44.asServiceRole.entities.Payment.update(billUpdate.id, {
                    status: billUpdate.newStatus,
                    payment_date: transDate.split('T')[0],
                    payment_slip_url: slipImageUrl,
                    paid_amount: billUpdate.newPaidAmount,
                    late_fee_amount: lateFeeAmount,
                    notes: `${bill.notes || ''}\n\n✅ ตรวจสอบสลิปอัตโนมัติผ่าน LINE (CASCADE): ${senderName} โอน ${slipAmount.toLocaleString()} บาท`
                });
            }
            
            if (tenant?.id) {
                try {
                    await base44.asServiceRole.functions.invoke('calculatePaymentScores', {
                        tenant_id: tenant.id
                    });
                } catch (e) {
                    console.log('⚠️ Score calculation failed');
                }
            }
            
            try {
                if (billsToUpdate.length > 0) {
                    await base44.asServiceRole.functions.invoke('sendReceipt', { 
                        paymentId: billsToUpdate[0].id 
                    });
                }
            } catch (e) {
                await sendMessage(base44, lineUserId,
                    `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${slipAmount.toLocaleString()} บาท (ชำระ ${billsToUpdate.length} บิล)`,
                    branchId,
                    replyToken
                );
            }
        }
        
        await processBillMatching(
            base44,
            slipAmount,
            pendingPayments,
            tenant,
            branchId,
            senderName,
            transDate,
            slipImageUrl,
            verificationMethod,
            lineUserId,
            replyToken,
            configs,
            sendMessage
        );
        
        console.log('✅ Bill matching completed');

    } catch (error) {
        console.error('❌ === SLIP PROCESSING ERROR ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        await base44.asServiceRole.entities.WebhookLog.create({
            webhook_type: 'line',
            branch_id: branchId,
            event_type: 'slip_processing_error',
            line_user_id: lineUserId,
            status: 'error',
            message: 'Slip processing failed',
            error_message: error.message
        }).catch(() => {});

        await sendMessage(base44, lineUserId, 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง', branchId, replyToken);
    }
}