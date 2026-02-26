import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import { parseISO, differenceInDays } from 'npm:date-fns@3.0.0';

// Cache for Config
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_DURATION = 5 * 60 * 1000;

// Helper: Check Account Match
function isAccountMatch(maskedSlipAccount, myRealAccount) {
    if (!maskedSlipAccount || !myRealAccount) return false;
    const slipAcc = String(maskedSlipAccount).replace(/[- ]/g, '').toLowerCase();
    const myAcc = String(myRealAccount).replace(/[- ]/g, '').toLowerCase();
    if (Math.abs(slipAcc.length - myAcc.length) > 2) return false;
    let matchedCount = 0;
    const minRequired = slipAcc.length <= 4 ? 2 : 3;
    for (let i = 0; i < Math.min(slipAcc.length, myAcc.length); i++) {
        if (slipAcc[i] === 'x' || slipAcc[i] === '*') continue;
        if (slipAcc[i] !== myAcc[i]) return false;
        matchedCount++;
    }
    return matchedCount >= minRequired;
}

// Helper: Calculate Late Fee
function calculateLateFee(payment, configs, branchId, calculationDate = null) {
    if (!payment || !payment.due_date) return { lateFeeAmount: 0, daysLate: 0 };
    if (payment.status === 'paid' || payment.late_fee_locked === true) {
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    if (payment.late_fee_last_calculated) {
        const lastCalcDate = new Date(payment.late_fee_last_calculated);
        const lastCalcThailand = new Date(lastCalcDate.getTime() + (7 * 60 * 60 * 1000));
        const lastCalcDay = new Date(lastCalcThailand.getFullYear(), lastCalcThailand.getMonth(), lastCalcThailand.getDate());
        const now = new Date();
        const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const today = new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate());
        if (lastCalcDay.getTime() === today.getTime()) {
            return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
        }
    }

    try {
        const calcDate = calculationDate || new Date();
        const dueDate = parseISO(payment.due_date);
        const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
        const calcDateStart = new Date(calcDate.getFullYear(), calcDate.getMonth(), calcDate.getDate());
        const daysOverdue = differenceInDays(calcDateStart, dueDateStart);

        if (daysOverdue <= 0) return { lateFeeAmount: 0, daysLate: 0 };

        const getConfigValue = (key, defaultValue = null) => {
            const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
            if (branchConfig?.value !== undefined && branchConfig?.value !== null) return branchConfig.value;
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value !== undefined && globalConfig?.value !== null ? globalConfig.value : defaultValue;
        };

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
                            if (daysInThisTier > 0) totalFee += daysInThisTier * feePerDay;
                        }
                        if (daysOverdue <= daysTo) break;
                    }
                    return { lateFeeAmount: totalFee, daysLate: daysOverdue };
                } catch (e) { console.error('Error parsing late fee tiers:', e); }
            }
        }

        const lateFeePerDay = parseFloat(getConfigValue('late_payment_fee_per_day', '0'));
        if (lateFeePerDay === 0 || isNaN(lateFeePerDay)) return { lateFeeAmount: 0, daysLate: daysOverdue };
        const simpleFee = daysOverdue * lateFeePerDay;
        return { lateFeeAmount: simpleFee, daysLate: daysOverdue };
    } catch (error) {
        console.error('Error calculating late fee:', error);
        return { lateFeeAmount: 0, daysLate: 0 };
    }
}

// Helper: Extract Amount
function extractAmount(slipData) {
    const possiblePaths = [
        ['amount'], ['transAmount'], ['transaction', 'amount'], ['payment', 'amount'],
        ['data', 'amount'], ['receiver', 'amount'], ['sender', 'amount'],
        ['receiver', 'account', 'amount'], ['sender', 'account', 'amount']
    ];
    for (const path of possiblePaths) {
        let current = slipData;
        let isValid = true;
        for (const key of path) {
            if (current && typeof current === 'object' && key in current) current = current[key];
            else { isValid = false; break; }
        }
        if (isValid && current != null) {
            const amount = typeof current === 'number' ? current : parseFloat(current);
            if (!isNaN(amount) && amount > 0) return { amount, path: path.join('.') };
        }
    }
    return { amount: 0, path: 'not found' };
}

// Helper: Get LINE Token
async function getLineToken(base44, branchId = null) {
    try {
        const configs = await base44.asServiceRole.entities.Config.list('', 5000);
        if (branchId) {
            const branchToken = configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branchId);
            if (branchToken?.value?.trim()) return branchToken.value.trim();
        }
        const globalToken = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
        if (globalToken?.value?.trim()) return globalToken.value.trim();
        return Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')?.trim() || null;
    } catch (error) {
        return Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')?.trim() || null;
    }
}

// Helper: Send Message
async function sendMessage(base44, lineUserId, text, branchId = null, replyToken = null) {
    try {
        const lineToken = await getLineToken(base44, branchId);
        if (!lineToken) {
            console.error('No LINE token found');
            return;
        }

        let endpoint = replyToken ? 'https://api.line.me/v2/bot/message/reply' : 'https://api.line.me/v2/bot/message/push';
        let body = replyToken ? { replyToken, messages: [{ type: 'text', text }] } : { to: lineUserId, messages: [{ type: 'text', text }] };

        let response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lineToken}` },
            body: JSON.stringify(body)
        });

        if (!response.ok && replyToken && response.status === 400) {
            // Fallback to push
            endpoint = 'https://api.line.me/v2/bot/message/push';
            body = { to: lineUserId, messages: [{ type: 'text', text }] };
            response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${lineToken}` },
                body: JSON.stringify(body)
            });
        }
        
        if (!response.ok) {
            console.error(`LINE API Error: ${response.status} ${await response.text()}`);
        } else {
            console.log(`Message sent to ${lineUserId}`);
        }
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { lineUserId, messageId, branchId, replyToken } = await req.json();

        console.log(`Processing slip for ${lineUserId}, branch: ${branchId}`);

        const lineToken = await getLineToken(base44, branchId);
        const slip2goApiKey = Deno.env.get('SLIP2GO_API_KEY');
        
        if (!lineToken || !slip2goApiKey) {
            await sendMessage(base44, lineUserId, '❌ ระบบขัดข้อง กรุณาติดต่อเจ้าของหอพัก', branchId, replyToken);
            return Response.json({ success: false, error: 'Config missing' });
        }

        // Get Tenant
        let tenant = null;
        try {
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId, branch_id: branchId });
            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
        } catch (e) {
            console.log('Tenant not found:', e.message);
        }

        if (!tenant) {
            await sendMessage(base44, lineUserId, 'กรุณาลงทะเบียนด้วยหมายเลขโทรศัพท์ก่อนใช้งาน', branchId, replyToken);
            return Response.json({ success: false, error: 'Tenant not found' });
        }

        // Get Pending Payments
        let pendingPayments = [];
        try {
            const paymentResult = await base44.asServiceRole.entities.Payment.filter({ 
                tenant_id: tenant.id,
                branch_id: branchId,
                status: { $in: ['pending', 'overdue', 'partial_paid'] }
            });
            pendingPayments = Array.isArray(paymentResult) ? paymentResult : (paymentResult ? [paymentResult] : []);
        } catch (e) {
            console.log('Payments fetch error:', e.message);
        }

        if (pendingPayments.length === 0) {
            return Response.json({ success: true, message: 'No pending payments' });
        }

        pendingPayments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        const pendingPayment = pendingPayments[0];

        // Download Image
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
                if (imageResponse.ok) break;
                retryCount++;
                if (retryCount < maxRetries) await new Promise(r => setTimeout(r, 2000 * Math.pow(2, retryCount)));
            } catch (e) {
                retryCount++;
                if (retryCount < maxRetries) await new Promise(r => setTimeout(r, 2000 * Math.pow(2, retryCount)));
            }
        }

        if (!imageResponse || !imageResponse.ok) {
            await sendMessage(base44, lineUserId, '❌ ไม่สามารถดาวน์โหลดรูปภาพได้ กรุณาส่งใหม่', branchId, replyToken);
            return Response.json({ success: false, error: 'Image download failed' });
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
        if (imageBlob.size > 10 * 1024 * 1024) {
            await sendMessage(base44, lineUserId, '❌ รูปภาพใหญ่เกินไป (เกิน 10MB)', branchId, replyToken);
            return Response.json({ success: false, error: 'Image too large' });
        }

        // Upload to Base44
        let slipImageUrl = '';
        try {
            const file = new File([imageBlob], `slip-${Date.now()}.jpg`, { type: imageBlob.type });
            const uploadResult = await base44.asServiceRole.integrations.Core.UploadFile({ file });
            slipImageUrl = uploadResult.file_url;
        } catch (uploadError) {
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: อัพโหลดรูปไม่สำเร็จ`
            });
            await sendMessage(base44, lineUserId, '⚠️ ระบบบันทึกรูปไม่ได้ กรุณาลองใหม่', branchId, replyToken);
            return Response.json({ success: false, error: 'Upload failed' });
        }

        // Check Slip2Go
        const formData = new FormData();
        formData.append('file', imageBlob, 'slip.jpg');
        formData.append('payload', JSON.stringify({ checkDuplicate: true }));

        let slip2goResponse;
        let slip2goData;
        let verificationSuccess = false;

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
            try { slip2goData = JSON.parse(responseText); } catch(e) {}

            const isValidCode = slip2goData?.code === '200200' || slip2goData?.code === 200200;
            if ((slip2goResponse.ok && slip2goData?.success && slip2goData?.data) || (isValidCode && slip2goData?.data)) {
                verificationSuccess = true;
            }

            if (slip2goResponse.status === 504 || responseText.includes('504')) {
                await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ระบบตรวจสอบสลิปช้า`
                });
                await sendMessage(base44, lineUserId, `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ (ระบบช้า)`, branchId, replyToken);
                return Response.json({ success: true, status: 'timeout' });
            }
        } catch (fetchError) {
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ระบบตรวจสอบขัดข้อง`
            });
            await sendMessage(base44, lineUserId, `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ (ระบบขัดข้อง)`, branchId, replyToken);
            return Response.json({ success: false, error: 'Slip2Go fetch error' });
        }

        const errorCode = slip2goData?.code;
        const errorMessage = slip2goData?.message || '';
        const isDuplicateError = errorCode === '200501' || errorMessage.toLowerCase().includes('duplicate');

        if (isDuplicateError) {
            await sendMessage(base44, lineUserId, `⚠️ สลิปนี้เคยถูกใช้ไปแล้ว\n\nกรุณาส่งสลิปใหม่ค่ะ`, branchId, replyToken);
            return Response.json({ success: false, error: 'Duplicate slip' });
        }

        const isFraudSlip = errorCode === '200500' || errorMessage.toLowerCase().includes('fraud');
        if (isFraudSlip && !verificationSuccess) {
            return Response.json({ success: false, error: 'Fraud slip' });
        }

        if (!verificationSuccess) {
            const isSlipNotFound = errorCode === '200404' || errorMessage === 'Slip not found';
            if (isSlipNotFound) {
                const now = new Date().toISOString();
                await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayment.notes || ''}\n\n⏳ รอตรวจสอบซ้ำ: ธนาคารยังไม่มีข้อมูล - ${now}`
                });
                console.log('Slip not found, waiting for cron');
                return Response.json({ success: true, status: 'waiting_recheck' });
            }

            // ⭐ Generic Error Fallback
            console.log(`❌ Slip verification failed with code: ${errorCode}, message: ${errorMessage}`);
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ ตรวจสอบไม่ผ่าน: ระบบตรวจสอบสลิปขัดข้อง (${errorCode}: ${errorMessage})`
            });
            await sendMessage(base44, lineUserId, `❌ ไม่สามารถตรวจสอบสลิปได้\n\nสาเหตุ: ${errorMessage || 'ระบบขัดข้อง'}\n\nกรุณาติดต่อเจ้าของหอพักค่ะ`, branchId, replyToken);
            return Response.json({ success: false, error: 'Verification failed' });
        }

        const slipData = slip2goData.data;
        const { amount: slipAmount } = extractAmount(slipData);
        const senderName = slipData.sender?.account?.name?.th || slipData.sender?.name || 'N/A';
        const transDate = slipData.dateTime || slipData.transDate || new Date().toISOString().split('T')[0];

        if (slipAmount === 0) {
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ ตรวจสอบไม่ผ่าน: ระบบอ่านยอดไม่ได้`
            });
            await sendMessage(base44, lineUserId, `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ (อ่านยอดไม่ได้)`, branchId, replyToken);
            return Response.json({ success: false, error: 'Zero amount' });
        }

        // Check Account
        const configs = await base44.asServiceRole.entities.Config.list('', 5000);
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
        
        // If no config, fail
        if ((!expectedAccountNumber || expectedAccountNumber.trim() === '') && (!expectedPromptPay || expectedPromptPay.trim() === '')) {
            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: pendingPayment.room_id });
            const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ ตรวจสอบไม่ผ่าน: ห้อง ${room?.room_number || 'N/A'} - ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ`
            });
            await sendMessage(base44, lineUserId, `📸 ได้รับสลิปแล้ว!\n\n⚠️ ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ\nกรุณารอเจ้าของหอพักตรวจสอบค่ะ`, branchId, replyToken);
            return Response.json({ success: false, error: 'No bank config' });
        }

        let accountMatch = false;
        if (expectedAccountNumber && isAccountMatch(receiverAccount, expectedAccountNumber)) accountMatch = true;
        if (!accountMatch && expectedPromptPay) {
            if (isAccountMatch(receiverPromptPay, expectedPromptPay) || isAccountMatch(receiverAccount, expectedPromptPay)) accountMatch = true;
        }

        if (!accountMatch) {
            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: pendingPayment.room_id });
            const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
            const errorMsg = `โอนเงินไปผิดบัญชี\n\nตรวจพบโอนเข้า: ${receiverAccount || receiverPromptPay}\nควรโอนเข้า: ${expectedAccountNumber || expectedPromptPay}\n\nกรุณาตรวจสอบอีกครั้ง`;
            
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ ตรวจสอบไม่ผ่าน: ห้อง ${room?.room_number || 'N/A'} - ${errorMsg}`
            });
            await sendMessage(base44, lineUserId, `❌ ${errorMsg}\n\nกรุณารอเจ้าของหอพักตรวจสอบค่ะ 🙏`, branchId, replyToken);
            return Response.json({ success: false, error: 'Account mismatch' });
        }

        // Process Payment (Same as recheck)
        const today = new Date(new Date().getTime() + (7 * 3600000)); today.setHours(0,0,0,0);
        const late = calculateLateFee(pendingPayment, configs, branchId, today);
        const exp = ['rent_amount','water_amount','electricity_amount','internet_amount','common_fee_amount','parking_fee_amount','other_amount'].reduce((s, k) => s + (parseFloat(pendingPayment[k]) || 0), 0) + late.lateFeeAmount;
        const remainingToPay = exp - parseFloat(pendingPayment.paid_amount || 0);
        
        let payAmount = Math.min(remainingToPay, slipAmount);
        let newTotalPaid = parseFloat(pendingPayment.paid_amount || 0) + payAmount;
        let status = newTotalPaid >= exp * 0.95 ? 'paid' : 'partial_paid';
        
        await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
            status, paid_amount: newTotalPaid, payment_slip_url: slipImageUrl,
            late_fee_amount: late.lateFeeAmount, total_amount: exp,
            ...(status === 'paid' ? { payment_date: transDate.split('T')[0] } : {}),
            notes: `${pendingPayment.notes || ''}\n\n✅ Auto-verify: โอน ${payAmount.toLocaleString()}฿`
        });

        // Add excess to prepaid if any
        let remainingSlipAmount = slipAmount - payAmount;
        if (remainingSlipAmount > 0) {
            await base44.asServiceRole.entities.Tenant.update(tenant.id, {
                prepaid_balance: (parseFloat(tenant.prepaid_balance || 0) + remainingSlipAmount)
            });
        }

        if (status === 'paid') {
            await sendMessage(base44, lineUserId, `✅ ตรวจสอบสำเร็จ!\n💰 ยอดเงิน: ${slipAmount.toLocaleString()}฿\n📅 วันที่: ${transDate.split('T')[0]}\nขอบคุณค่ะ 🙏`, branchId, replyToken);
            try { await base44.asServiceRole.functions.invoke('sendReceipt', { paymentId: pendingPayment.id }); } catch(e) {}
        } else {
            await sendMessage(base44, lineUserId, `💰 รับเงินแล้ว ${slipAmount.toLocaleString()}฿\n⚠️ ยังขาดอีก: ${(exp - newTotalPaid).toLocaleString()}฿`, branchId, replyToken);
        }

        return Response.json({ success: true, status: status });

    } catch (error) {
        console.error('ProcessSlipImage error:', error);
        return Response.json({ error: error.message }, { status: 500 });
    }
});