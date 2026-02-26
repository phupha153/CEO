import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import { parseISO, differenceInDays } from 'npm:date-fns@3.0.0';

// ⭐ Helper: เช็คเลขบัญชีแบบปลอดภัย
function isAccountMatch(m, r) {
    if(!m||!r) return false;
    let s = String(m).replace(/[- ]/g,'').toLowerCase();
    let a = String(r).replace(/[- ]/g,'').toLowerCase();
    if(s.startsWith('66')&&s.length===11) s='0'+s.slice(2);
    if(a.startsWith('66')&&a.length===11) a='0'+a.slice(2);
    let c=0, i=s.length-1, j=a.length-1;
    while(i>=0&&j>=0){
        if(s[i]==='x'||s[i]==='*'){i--;j--;continue;}
        if(s[i]===a[j]){c++;i--;j--;}else return false;
    }
    return c>=(s.replace(/[x*]/g,'').length<=3?2:3);
}

// ⭐ Helper: Extract amount
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

// ⭐ Inline helper function
function calculateLateFee(payment, configs, branchId, calculationDate = null) {
    console.log(`🧮 LateFee: ${payment?.id?.substring(0, 8)}... | Due: ${payment?.due_date} | Status: ${payment?.status}`);
    if (!payment || !payment.due_date) return { lateFeeAmount: 0, daysLate: 0 };
    if (payment.status === 'paid' || payment.late_fee_locked === true) return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    
    const calcDate = calculationDate || new Date();
    if (payment.late_fee_last_calculated) {
        const lastCalcDate = new Date(payment.late_fee_last_calculated);
        const lastCalcThailand = new Date(lastCalcDate.getTime() + (7 * 60 * 60 * 1000));
        const lastCalcDay = new Date(lastCalcThailand.getFullYear(), lastCalcThailand.getMonth(), lastCalcThailand.getDate());
        const now = new Date();
        const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000));
        const today = new Date(thailandTime.getFullYear(), thailandTime.getMonth(), thailandTime.getDate());
        if (lastCalcDay.getTime() === today.getTime()) return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }

    try {
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
                } catch (e) {}
            }
        }
        const lateFeePerDay = parseFloat(getConfigValue('late_payment_fee_per_day', '0'));
        if (lateFeePerDay === 0 || isNaN(lateFeePerDay)) return { lateFeeAmount: 0, daysLate: daysOverdue };
        return { lateFeeAmount: daysOverdue * lateFeePerDay, daysLate: daysOverdue };
    } catch (error) {
        return { lateFeeAmount: 0, daysLate: 0 };
    }
}

async function getLineToken(base44, branchId = null) {
    try {
        const configs = await base44.asServiceRole.entities.Config.list();
        if (branchId) {
            const branchToken = configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branchId);
            if (branchToken?.value?.trim()) return branchToken.value.trim();
        }
        const globalToken = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
        if (globalToken?.value?.trim()) return globalToken.value.trim();
        const secretToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
        if (secretToken?.trim()) return secretToken.trim();
        return null;
    } catch (error) {
        return Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')?.trim() || null;
    }
}

async function sendMessage(base44, lineUserId, text, branchId = null, replyToken = null) {
    try {
        const lineToken = await getLineToken(base44, branchId);
        if (!lineToken) return;

        let endpoint = replyToken 
            ? 'https://api.line.me/v2/bot/message/reply'
            : 'https://api.line.me/v2/bot/message/push';

        let body = replyToken
            ? { replyToken, messages: [{ type: 'text', text }] }
            : { to: lineUserId, messages: [{ type: 'text', text }] };

        let response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify(body)
        });

        if (!response.ok && replyToken) {
            endpoint = 'https://api.line.me/v2/bot/message/push';
            body = { to: lineUserId, messages: [{ type: 'text', text }] };
            response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${lineToken}`
                },
                body: JSON.stringify(body)
            });
        }
    } catch (error) {
        console.error('❌ Error sending LINE message:', error);
    }
}

Deno.serve(async (req) => {
    if (req.method !== 'POST') return new Response('OK');
    const base44 = createClientFromRequest(req);
    const { lineUserId, messageId, branchId: initialBranchId, replyToken } = await req.json();
    let branchId = initialBranchId;

    const lineToken = await getLineToken(base44, branchId);
    const slip2goApiKey = Deno.env.get('SLIP2GO_API_KEY');
    
    if (!lineToken || !slip2goApiKey) {
        await sendMessage(base44, lineUserId, '❌ ระบบขัดข้อง กรุณาติดต่อเจ้าของหอพัก', branchId, replyToken);
        return Response.json({ success: false });
    }

    try {
        if (!branchId) {
            console.error(`❌ CRITICAL: No branchId available for slip verification`);
            await sendMessage(base44, lineUserId, '❌ เกิดข้อผิดพลาดในระบบ กรุณาติดต่อเจ้าของหอพัก', null, replyToken);
            return Response.json({ success: false });
        }

        let tenant = null;
        try {
            const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ line_user_id: lineUserId });
            tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
            if (tenant) branchId = tenant.branch_id;
        } catch (e) {}

        if (!tenant) {
            await sendMessage(base44, lineUserId, 'กรุณาลงทะเบียนด้วยหมายเลขโทรศัพท์ก่อนใช้งาน\nพิมพ์: ลงทะเบียน 0812345678', branchId, replyToken);
            return Response.json({ success: false });
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

        if (pendingPayments.length === 0) return Response.json({ success: true });

        pendingPayments.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        const pendingPayment = pendingPayments[0];
        
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
                if (retryCount < maxRetries) await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount)));
            } catch (error) {
                retryCount++;
                if (retryCount < maxRetries) await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, retryCount)));
            }
        }

        if (!imageResponse || !imageResponse.ok) {
            await sendMessage(base44, lineUserId, '❌ ไม่สามารถดาวน์โหลดรูปภาพได้\n\nสาเหตุที่อาจเป็นไปได้:\n• รูปภาพมีขนาดใหญ่เกินไป\n• การเชื่อมต่อขาดหาย\n\nวิธีแก้:\n1. ลองส่งรูปที่มีขนาดเล็กกว่า\n2. ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต\n3. หรือติดต่อเจ้าของหอพักโดยตรงค่ะ', branchId, replyToken);
            return Response.json({ success: false });
        }

        const imageBuffer = await imageResponse.arrayBuffer();
        const imageBlob = new Blob([imageBuffer], { type: 'image/jpeg' });
        if (imageBlob.size > 10 * 1024 * 1024) {
            await sendMessage(base44, lineUserId, '❌ รูปภาพมีขนาดใหญ่เกินไป (เกิน 10MB)\n\nกรุณาส่งรูปที่มีขนาดเล็กกว่าค่ะ', branchId, replyToken);
            return Response.json({ success: false });
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
                    await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                        notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่อัพโหลดไม่สำเร็จ - กรุณาให้ส่งใหม่`
                    });
                    await sendMessage(base44, lineUserId, '⚠️ ระบบไม่สามารถบันทึกรูปสลิปได้\n\nกรุณาลองใหม่อีกครั้ง หรือติดต่อเจ้าของหอพักค่ะ', branchId, replyToken);
                    return Response.json({ success: false });
                }
                await new Promise(resolve => setTimeout(resolve, 2000 * Math.pow(2, uploadRetryCount)));
            }
        }

        const formData = new FormData();
        formData.append('file', imageBlob, 'slip.jpg');
        formData.append('payload', JSON.stringify({ checkDuplicate: true }));
        
        let slip2goResponse;
        let slip2goData;
        let verificationMethod = '';
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
            slip2goData = JSON.parse(responseText);
            
            const isValidCode = slip2goData.code === '200200' || slip2goData.code === 200200;
            if ((slip2goResponse.ok && slip2goData.success && slip2goData.data) || (isValidCode && slip2goData.data)) {
                verificationMethod = 'qr-image';
                verificationSuccess = true;
            }
            
            if (slip2goResponse.status === 504 || responseText.includes('504')) {
                await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่ระบบตรวจสอบช้า`
                });
                await sendMessage(base44, lineUserId, `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ`, branchId, replyToken);
                return Response.json({ success: true });
            }
        } catch (fetchError) {
            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line', branch_id: branchId, event_type: 'slip_verification_error',
                line_user_id: lineUserId, tenant_id: tenant?.id, payment_id: pendingPayment.id,
                status: 'error', message: 'Slip2Go API error', error_message: fetchError.message
            }).catch(() => {});

            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ส่งสลิปผ่าน LINE แต่ระบบขัดข้อง`
            });
            await sendMessage(base44, lineUserId, `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ`, branchId, replyToken);
            return Response.json({ success: true });
        }

        const errorCode = slip2goData.code;
        const errorMessage = slip2goData.message || '';
        const isDuplicateError = errorCode === '200501' || errorMessage.toLowerCase().includes('duplicate');

        if (isDuplicateError) {
            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line', branch_id: branchId, event_type: 'slip_duplicate',
                line_user_id: lineUserId, tenant_id: tenant?.id, payment_id: pendingPayment.id,
                status: 'warning', message: 'Duplicate slip detected'
            }).catch(() => {});
            await sendMessage(base44, lineUserId, `⚠️ สลิปนี้เคยถูกใช้ไปแล้ว\n\nกรุณาส่งสลิปใหม่ค่ะ`, branchId, replyToken);
            return Response.json({ success: true });
        }

        const isFraudSlip = errorCode === '200500' || errorMessage.toLowerCase().includes('fraud');
        if (isFraudSlip && !verificationSuccess) {
            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line', branch_id: branchId, event_type: 'slip_fraud',
                line_user_id: lineUserId, tenant_id: tenant?.id, payment_id: pendingPayment.id,
                status: 'warning', message: 'Fraud slip detected', details: { error_code: errorCode }
            }).catch(() => {});
            return Response.json({ success: true });
        }

        const isSlipValid = slip2goResponse.ok && slip2goData.data && verificationSuccess;
        if (!isSlipValid) {
            if (errorCode === '200404' || errorMessage === 'Slip not found') {
                await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                    payment_slip_url: slipImageUrl,
                    notes: `${pendingPayment.notes || ''}\n\n⏳ รอตรวจสอบซ้ำ: ธนาคารยังไม่มีข้อมูล - ${new Date().toISOString()}`
                });
            }
            return Response.json({ success: true });
        }

        const slipData = slip2goData.data;
        const { amount: slipAmount } = extractAmount(slipData);
        const senderName = slipData.sender?.account?.name?.th || slipData.sender?.displayName || 'N/A';
        const transDate = slipData.dateTime || slipData.transDate || new Date().toISOString().split('T')[0];

        if (slipAmount === 0) {
            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ระบบอ่านยอดไม่ได้`
            });
            await sendMessage(base44, lineUserId, `📸 ได้รับสลิปแล้ว!\n\n⚠️ รอเจ้าของหอพักตรวจสอบค่ะ`, branchId, replyToken);
            return Response.json({ success: true });
        }

        const configs = await base44.asServiceRole.entities.Config.list();
        const getConfigValue = (key) => {
            const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
            if (branchConfig) return branchConfig.value;
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || null;
        };

        const expectedAccountNumber = getConfigValue('bank_account_number');
        const expectedPromptPay = getConfigValue('promptpay');

        // ⭐ ดึงข้อมูลจาก Slip2Go Response อย่างปลอดภัย (ป้องกันปัญหา [object Object])
        let receiverAccount = '';
        if (typeof slipData.receiver?.account === 'string') receiverAccount = slipData.receiver.account;
        else if (typeof slipData.receiver?.account?.account === 'string') receiverAccount = slipData.receiver.account.account;
        else if (typeof slipData.receiver?.account?.bank?.account === 'string') receiverAccount = slipData.receiver.account.bank.account;
        
        let receiverPromptPay = '';
        if (typeof slipData.receiver?.proxy?.account === 'string') receiverPromptPay = slipData.receiver.proxy.account;
        else if (typeof slipData.receiver?.proxy?.value === 'string') receiverPromptPay = slipData.receiver.proxy.value;
        else if (typeof slipData.receiver?.account?.proxy?.account === 'string') receiverPromptPay = slipData.receiver.account.proxy.account;
        else if (typeof slipData.receiver?.account?.proxy?.value === 'string') receiverPromptPay = slipData.receiver.account.proxy.value;
        
        const receiverName = slipData.receiver?.account?.name?.th || slipData.receiver?.account?.name || slipData.receiver?.name || '';

        if ((!expectedAccountNumber || expectedAccountNumber.trim() === '') && 
            (!expectedPromptPay || expectedPromptPay.trim() === '')) {
            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: pendingPayment.room_id });
            const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
            const roomNumber = room?.room_number || 'ไม่ทราบ';

            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ (โอนเข้า: ${receiverName} บช ${receiverAccount})`
            });
            await sendMessage(base44, lineUserId, `📸 ได้รับสลิปแล้ว!\n\n⚠️ ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ\nกรุณารอเจ้าของหอพักตรวจสอบค่ะ`, branchId, replyToken);
            return Response.json({ success: true });
        }

        let accountMatch = false;
        if (expectedAccountNumber) accountMatch = isAccountMatch(receiverAccount, expectedAccountNumber);
        if (!accountMatch && expectedPromptPay) accountMatch = isAccountMatch(receiverPromptPay, expectedPromptPay) || isAccountMatch(receiverAccount, expectedPromptPay);

        if (!accountMatch) {
            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: pendingPayment.room_id });
            const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
            const roomNumber = room?.room_number || 'ไม่ทราบ';
            const errorMsg = `โอนเงินไปผิดบัญชี\n\nตรวจพบโอนเข้า: ${receiverAccount || receiverPromptPay}\nควรโอนเข้า: ${expectedAccountNumber || expectedPromptPay}\n\nกรุณาตรวจสอบอีกครั้ง`;

            await base44.asServiceRole.entities.Payment.update(pendingPayment.id, {
                payment_slip_url: slipImageUrl,
                notes: `${pendingPayment.notes || ''}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ${errorMsg}`
            });
            await sendMessage(base44, lineUserId, `❌ ${errorMsg}\n\nกรุณารอเจ้าของหอพักตรวจสอบค่ะ 🙏`, branchId, replyToken);
            return Response.json({ success: true });
        }

        const today = new Date(new Date().getTime() + (7 * 3600000)); today.setHours(0,0,0,0);
        const pList = pendingPayments.map(p => { 
            const late = calculateLateFee(p, configs, branchId, today); 
            const exp = ['rent_amount','water_amount','electricity_amount','internet_amount','common_fee_amount','parking_fee_amount','other_amount'].reduce((s, k) => s + (parseFloat(p[k]) || 0), 0) + late.lateFeeAmount; 
            return { ...p, expectedAmount: exp, remainingToPay: exp - parseFloat(p.paid_amount || 0), currentPaid: parseFloat(p.paid_amount || 0), lateFeeAmount: late.lateFeeAmount, daysLate: late.daysLate }; 
        });
        const exact = pList.find(p => Math.abs(p.remainingToPay - slipAmount) <= Math.max(1, p.expectedAmount * 0.05));
        const search = (i, sub, sum) => { if (sum > 0 && Math.abs(sum - slipAmount) <= sub.length * 2) return sub; if (sum > slipAmount + 5 || i >= Math.min(pList.length, 15)) return null; const sP = [...pList].sort((a,b)=>new Date(a.due_date)-new Date(b.due_date)); return search(i + 1, [...sub, sP[i]], sum + sP[i].remainingToPay) || search(i + 1, sub, sum); };
        const processList = exact ? [exact] : (search(0, [], 0) || pList);
        let remainingSlipAmount = slipAmount, processedIds = [], partialInfo = null;
        let isExactCombo = processList.length > 0 && Math.abs(processList.reduce((sum, p) => sum + p.remainingToPay, 0) - slipAmount) <= processList.length * 2;

        for (const p of processList) {
            if (remainingSlipAmount <= 0) break;
            const payAmount = Math.min(p.remainingToPay, remainingSlipAmount);
            const newTotalPaid = p.currentPaid + payAmount;
            const status = newTotalPaid >= p.expectedAmount * 0.95 ? 'paid' : 'partial_paid';
            if (status !== 'paid') partialInfo = { expected: p.expectedAmount, paidNow: newTotalPaid, shortfall: p.expectedAmount - newTotalPaid, lateFee: p.lateFeeAmount, daysLate: p.daysLate };

            remainingSlipAmount -= payAmount;
            processedIds.push({ id: p.id, status });

            const isExact = isExactCombo ? ' (ตรงตามยอดบิล)' : '';
            const note = status === 'paid'
                ? `\n\n✅ Auto-verify: ${senderName} โอน ${payAmount.toLocaleString()}฿ (จากยอดรวม ${slipAmount.toLocaleString()}฿)${isExact}${p.lateFeeAmount > 0 ? ` (รวมค่าปรับ ${p.lateFeeAmount.toLocaleString()}฿ ${p.daysLate}วัน)` : ''}`
                : `\n\n💰 ชำระบางส่วน: ${payAmount.toLocaleString()}฿ (รวม ${newTotalPaid.toLocaleString()}/${p.expectedAmount.toLocaleString()}฿)`;

            await base44.asServiceRole.entities.Payment.update(p.id, {
                status, paid_amount: newTotalPaid, payment_slip_url: slipImageUrl,
                late_fee_amount: p.lateFeeAmount, total_amount: p.expectedAmount,
                ...(status === 'paid' ? { payment_date: transDate.split('T')[0] } : {}),
                notes: `${p.notes || ''}${note}`
            });

            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line', branch_id: branchId, event_type: status === 'paid' ? 'payment_verified' : 'partial_payment',
                line_user_id: lineUserId, tenant_id: tenant?.id, payment_id: p.id, amount: payAmount, status: 'success',
                message: status === 'paid' ? 'Verified' : `Partial: ${newTotalPaid}/${p.expectedAmount}`,
                details: { late_fee: p.lateFeeAmount, days_late: p.daysLate, sender: senderName, method: verificationMethod, slip_amount: slipAmount }
            }).catch(() => {});
        }

        if (remainingSlipAmount > 0 && tenant?.id) {
            await base44.asServiceRole.entities.Tenant.update(tenant.id, {
                prepaid_balance: (parseFloat(tenant.prepaid_balance || 0) + remainingSlipAmount),
                notes: `${tenant.notes || ''}\n[${new Date().toISOString().split('T')[0]}] ส่วนเกินสลิป: +${remainingSlipAmount}฿`
            });
            await base44.asServiceRole.entities.WebhookLog.create({
                webhook_type: 'line', branch_id: branchId, event_type: 'prepaid_added', line_user_id: lineUserId,
                tenant_id: tenant.id, amount: remainingSlipAmount, status: 'success', message: `Prepaid added: ${remainingSlipAmount}`
            }).catch(() => {});
        }

        if (tenant?.id) {
            try { await base44.asServiceRole.functions.invoke('calculatePaymentScores', { tenant_id: tenant.id }); } catch (e) {}
        }
        
        if (partialInfo && remainingSlipAmount <= 0) await sendMessage(base44, lineUserId, `💰 รับเงินแล้ว ${slipAmount.toLocaleString()}฿\n✅ หักยอดค้าง: ${partialInfo.paidNow.toLocaleString()}฿\n💵 ยอดที่เหลือ: ${partialInfo.expected.toLocaleString()}฿${partialInfo.lateFee > 0 ? ` (รวมค่าปรับ ${partialInfo.lateFee.toLocaleString()}฿)` : ''}\n⚠️ ขาดอีก: ${partialInfo.shortfall.toLocaleString()}฿\nกรุณาโอนเพิ่มค่ะ 🙏`, branchId, replyToken);
        else if (remainingSlipAmount > 0) await sendMessage(base44, lineUserId, `✅ ตรวจสอบสำเร็จ!\n💰 ยอดเงิน: ${slipAmount.toLocaleString()}฿\n📅 วันที่: ${transDate.split('T')[0]}\n✓ ตัดยอดแล้ว\n💵 ส่วนเกิน ${remainingSlipAmount.toLocaleString()}฿ เก็บเป็นเครดิต\nขอบคุณค่ะ 🙏`, branchId, replyToken);

        for (const item of processedIds) {
            if (item.status === 'paid') {
                try { await base44.asServiceRole.functions.invoke('sendReceipt', { paymentId: item.id }); } 
                catch (e) { }
            }
        }
        return Response.json({ success: true });

    } catch (error) {
        await base44.asServiceRole.entities.WebhookLog.create({
            webhook_type: 'line', branch_id: branchId, event_type: 'slip_processing_error',
            line_user_id: lineUserId, status: 'error', message: 'Slip processing failed', error_message: error.message
        }).catch(() => {});
        await sendMessage(base44, lineUserId, 'เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง', branchId, replyToken);
        return Response.json({ success: false });
    }
});