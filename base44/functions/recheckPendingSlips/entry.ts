import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { parseISO, differenceInDays } from 'npm:date-fns@3.0.0';

// ⭐ Helper: เช็คเลขบัญชีแบบปลอดภัย (รองรับ masked accounts)
function isAccountMatch(maskedSlipAccount, myRealAccount) {
    console.log('\n🔍 === ACCOUNT MATCH CHECK ===');
    console.log('  Input (from slip):', maskedSlipAccount);
    console.log('  Expected (my account):', myRealAccount);
    
    if (!maskedSlipAccount || !myRealAccount) {
        console.log('  ❌ Result: FAIL - Missing data');
        return false;
    }
    
    let slipAcc = String(maskedSlipAccount).replace(/[- ]/g, '').toLowerCase();
    let myAcc = String(myRealAccount).replace(/[- ]/g, '').toLowerCase();
    
    if (slipAcc.startsWith('66') && slipAcc.length === 11) slipAcc = '0' + slipAcc.substring(2);
    if (myAcc.startsWith('66') && myAcc.length === 11) myAcc = '0' + myAcc.substring(2);
    
    console.log('  Cleaned slip account:', slipAcc);
    console.log('  Cleaned my account:', myAcc);
    
    let matchedCount = 0;
    let slipIdx = slipAcc.length - 1;
    let myIdx = myAcc.length - 1;
    
    console.log('  Matching from RIGHT to LEFT:');
    
    while (slipIdx >= 0 && myIdx >= 0) {
        if (slipAcc[slipIdx] === 'x' || slipAcc[slipIdx] === '*') {
            console.log(`  Position [${slipIdx} vs ${myIdx}]: MASKED (${slipAcc[slipIdx]}) - SKIP`);
            slipIdx--;
            myIdx--;
            continue;
        }
        if (slipAcc[slipIdx] === myAcc[myIdx]) {
            matchedCount++;
            console.log(`  Position [${slipIdx} vs ${myIdx}]: MATCH (${slipAcc[slipIdx]} === ${myAcc[myIdx]})`);
            slipIdx--;
            myIdx--;
        } else {
            console.log(`  Position [${slipIdx} vs ${myIdx}]: MISMATCH (${slipAcc[slipIdx]} !== ${myAcc[myIdx]}) - FAIL`);
            return false;
        }
    }
    
    const minRequired = slipAcc.replace(/[x*]/g, '').length <= 3 ? 2 : 3;
    console.log(`  Min required matches: ${minRequired}`);
    
    const isMatch = matchedCount >= minRequired;
    console.log(`  Matched count: ${matchedCount}/${minRequired}`);
    console.log(`  ✅ Result: ${isMatch ? 'PASS' : 'FAIL'}`);
    console.log('=========================\n');
    
    return isMatch;
}

// ⭐ Helper: Extract amount จาก Slip2Go response (ลองหลาย path)
function extractAmount(slipData) {
    console.log('\n🔍 === EXTRACT AMOUNT DEBUG ===');
    console.log('📋 Full slipData structure:', JSON.stringify(slipData, null, 2));
    
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
    
    console.log(`🔎 Trying ${possiblePaths.length} possible paths...`);
    
    for (const path of possiblePaths) {
        let current = slipData;
        let isValid = true;
        
        console.log(`  Testing path: ${path.join('.')}`);
        
        for (const key of path) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
                console.log(`    ✓ Found key "${key}":`, typeof current === 'object' ? '{...}' : current);
            } else {
                isValid = false;
                console.log(`    ✗ Key "${key}" not found`);
                break;
            }
        }
        
        if (isValid && current !== null && current !== undefined) {
            const amount = typeof current === 'number' ? current : parseFloat(current);
            if (!isNaN(amount) && amount > 0) {
                console.log(`💰 ✅ SUCCESS! Found amount at path: ${path.join('.')} = ${amount}`);
                console.log('=============================\n');
                return amount;
            } else {
                console.log(`    ⚠️ Invalid amount value: ${current} (parsed: ${amount})`);
            }
        }
    }
    
    console.error('❌ FAILED! Could not find amount in ANY path!');
    console.error('📋 Available keys in slipData:', Object.keys(slipData || {}));
    console.log('=============================\n');
    return 0;
}

// ⭐ Helper: Calculate late fee (inline version)
function calculateLateFee(payment, configs, branchId, calculationDate = null) {
    console.log(`🧮 LateFee: ${payment?.id?.substring(0, 8)}... | Due: ${payment?.due_date} | Status: ${payment?.status}`);
    
    if (!payment || !payment.due_date) {
        console.log('  ⏭️ SKIP: No due_date');
        return { lateFeeAmount: 0, daysLate: 0 };
    }
    
    if (payment.status === 'paid') {
        console.log(`  🔒 SKIP: Already paid (locked: ${payment.late_fee_amount || 0}฿)`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    if (payment.late_fee_locked === true) {
        console.log(`  🔒 SKIP: Admin locked (${payment.late_fee_amount || 0}฿)`);
        return { lateFeeAmount: payment.late_fee_amount || 0, daysLate: 0 };
    }
    
    const calcDate = calculationDate || new Date();
    
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

// Cron Job สำหรับตรวจสอบสลิปที่รอการยืนยันซ้ำ (ทุก 15-30 นาที)
Deno.serve(async (req) => {
    const startTime = Date.now();
    console.log('========================================');
    console.log('🔄 RECHECK PENDING SLIPS - CRON JOB');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('========================================');

    try {
        const base44 = createClientFromRequest(req);
        
        const slip2goApiKey = Deno.env.get('SLIP2GO_API_KEY');
        if (!slip2goApiKey) {
            console.error('❌ SLIP2GO_API_KEY not configured');
            return Response.json({ success: false, error: 'SLIP2GO_API_KEY not configured' });
        }

        // ⭐ ใช้ Service Role เสมอสำหรับ Cron Job (ป้องกัน Error 401 ใน Log)
        const entityService = base44.asServiceRole.entities;

        // ⭐ CRITICAL: ดึงเฉพาะ Payment ที่ status=pending และมี payment_slip_url
        // ไม่ดึงทั้งหมด 50,000+ รายการ - ใช้ filter ที่ DB level
        console.log('🔍 Fetching only pending payments with slip...');
        
        const BATCH_SIZE = 500;
        let pendingWithSlip = [];
        let skip = 0;
        let hasMore = true;
        
        while (hasMore) {
            // ดึงเฉพาะ pending payments
            const batch = await entityService.Payment.filter(
                { status: 'pending' }, 
                '-created_date', 
                BATCH_SIZE, 
                skip
            );
            
            if (Array.isArray(batch) && batch.length > 0) {
                // กรองเฉพาะที่มี slip และ notes รอตรวจสอบ และไม่รวมกรณีโอนผิดบัญชีหรือยังไม่ตั้งค่าบัญชี
                const filtered = batch.filter(p => 
                    p.payment_slip_url && 
                    p.branch_id &&
                    p.notes && 
                    p.notes.includes('รอตรวจสอบ') &&
                    !p.notes.includes('โอนเงินไปผิดบัญชี') &&
                    !p.notes.includes('ยังไม่ได้ตั้งค่าบัญชีธนาคาร')
                );
                pendingWithSlip = pendingWithSlip.concat(filtered);
                
                skip += batch.length;
                console.log(`📦 Batch: ${batch.length} pending, ${filtered.length} with slip to recheck, total: ${pendingWithSlip.length}`);
                
                if (batch.length < BATCH_SIZE) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
            
            // หยุดถ้าเจอที่ต้อง recheck มากพอแล้ว (ประหยัดเวลา)
            if (pendingWithSlip.length >= 100) {
                console.log('✅ Found enough payments to recheck, stopping fetch');
                hasMore = false;
            }
            
            // ป้องกัน infinite loop - แต่ไม่ต้องดึงมากกว่า 5000 pending
            if (skip > 5000) {
                console.log('⚠️ Max pending payments scanned, stopping');
                hasMore = false;
            }
        }
        
        const pendingRecheckPayments = pendingWithSlip;

        console.log(`📋 Found ${pendingRecheckPayments.length} payments pending recheck (scanned ${skip} pending payments)`);

        if (pendingRecheckPayments.length === 0) {
            return Response.json({ 
                success: true, 
                message: 'No pending slips to recheck',
                processed: 0 
            });
        }

        // ดึง Config สำหรับ LINE Token และบัญชีธนาคาร
        const configRes = await base44.asServiceRole.entities.Config.list('', 1000);
        const configs = Array.isArray(configRes) ? configRes : (configRes?.data || []);
        const getConfigValue = (key, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || null;
        };

        // ไม่ดึง Tenant ล่วงหน้า เพื่อลด memory (จะ fetch แบบ filter แยกตาม payment)

        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;

        for (const payment of pendingRecheckPayments) {
            try {
                console.log(`\n🔍 Processing Payment: ${payment.id}`);
                console.log(`   Slip URL: ${payment.payment_slip_url}`);

                // เช็คว่าผ่านไป 30 วินาทีแล้วหรือยัง (หา timestamp จาก notes)
                const noteMatch = payment.notes.match(/(\d{4}-\d{2}-\d{2}T[\d:\.]+Z)/);
                if (noteMatch) {
                    const savedTime = new Date(noteMatch[1]);
                    const now = new Date();
                    const diffMinutes = (now.getTime() - savedTime.getTime()) / (1000 * 60);
                    
                    if (diffMinutes < 0.5) {
                        console.log(`   ⏳ Only ${diffMinutes.toFixed(1)} minutes passed, skipping (wait at least 30 sec)`);
                        skippedCount++;
                        continue;
                    }
                    console.log(`   ⏱️ ${diffMinutes.toFixed(1)} minutes since saved`);
                }

                // ดาวน์โหลดรูปสลิปจาก URL
                const imageResponse = await fetch(payment.payment_slip_url);
                if (!imageResponse.ok) {
                    console.error(`   ❌ Failed to download slip image`);
                    failCount++;
                    continue;
                }

                const imageBlob = await imageResponse.blob();
                console.log(`   📥 Downloaded image: ${imageBlob.size} bytes, type: ${imageBlob.type}`);

                // ⭐ ตรวจสอบ MIME type - ถ้าไม่มีให้กำหนดจาก URL
                let mimeType = imageBlob.type;
                if (!mimeType || mimeType === 'application/octet-stream') {
                    const url = payment.payment_slip_url.toLowerCase();
                    if (url.includes('.png')) {
                        mimeType = 'image/png';
                    } else if (url.includes('.jpg') || url.includes('.jpeg')) {
                        mimeType = 'image/jpeg';
                    } else {
                        mimeType = 'image/jpeg'; // default
                    }
                    console.log(`   🔧 Fixed MIME type to: ${mimeType}`);
                }

                // ⭐ สร้าง File object แบบเดียวกับ LINE Webhook
                const file = new File([imageBlob], `slip-${Date.now()}.jpg`, { type: mimeType });
                console.log(`   📦 Created File object: ${file.name}, size: ${file.size}, type: ${file.type}`);

                // ส่งไปตรวจสอบกับ Slip2Go
                // ⭐ FIX: ปิด checkDuplicate เพราะครั้งแรกอาจได้ "200404 not found" แต่ครั้งที่ 2 จะได้ "duplicate" โดยไม่มี data
                // → ถ้าปิด checkDuplicate ระบบจะส่งข้อมูลสลิปกลับมาเสมอ แม้จะซ้ำก็ตาม
                const formData = new FormData();
                formData.append('file', file);
                formData.append('payload', JSON.stringify({ checkDuplicate: false }));

                const slip2goResponse = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image/info', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${slip2goApiKey.trim()}` },
                    body: formData
                });

                const responseText = await slip2goResponse.text();
                console.log(`   📡 Slip2Go Status: ${slip2goResponse.status}`);
                console.log(`   📡 Slip2Go Response: ${responseText}`);
                
                let slip2goData;
                try {
                    slip2goData = JSON.parse(responseText);
                } catch (e) {
                    console.error(`   ❌ Failed to parse Slip2Go response`);
                    failCount++;
                    continue;
                }

                // ⭐ เช็คว่า Slip2Go ตอบกลับสำเร็จหรือไม่
                const isSlipValid = slip2goResponse.ok && slip2goData.code === '200200' && slip2goData.data;
                const isDuplicate = slip2goData.code === '200501' || (slip2goData.message && slip2goData.message.toLowerCase().includes('duplicate'));
                const isFraudSlip = slip2goData.code === '200500' || (slip2goData.message && slip2goData.message.toLowerCase().includes('fraud'));

                // ⭐ ถ้าพบว่าเป็นรหัส 200500 (ไม่ใช่รูปสลิป) ให้ล้างข้อมูลทิ้งทันที
                if (isFraudSlip) {
                    console.log(`   ❌ Error 200500: Not a valid slip. Clearing data silently.`);
                    
                    // ลบคำว่า "รอตรวจสอบ..." ออกจาก notes
                    let newNotes = payment.notes || '';
                    newNotes = newNotes.replace(/\n\n⚠️ รอตรวจสอบ:.*$/, '');
                    
                    await entityService.Payment.update(payment.id, {
                        payment_slip_url: null, // เคลียร์รูปทิ้ง ไม่ให้ค้างในบิล
                        notes: newNotes
                    });
                    
                    failCount++;
                    continue;
                }

                // ⭐ ถ้าเป็น Duplicate - ถือว่าสลิปถูกต้อง (เคยตรวจสอบผ่านแล้ว)
                if (isDuplicate && slip2goData.data) {
                    console.log(`   ⚠️ Slip is duplicated but valid - processing as successful`);
                    // ดำเนินการต่อเหมือนสลิปถูกต้อง
                } else if (!isSlipValid && !isDuplicate) {
                    const retryCount = (payment.notes.match(/ลองครั้งที่/g) || []).length;

                    if (retryCount >= 3) {
                        // ลองเกิน 3 ครั้งแล้ว - ให้ตรวจสอบด้วยตนเอง
                        console.log(`   ❌ Max retries reached (${retryCount}), marking for manual review`);

                        await entityService.Payment.update(payment.id, {
                            notes: `${payment.notes}\n\n⚠️ ตรวจสอบไม่สำเร็จหลังลอง ${retryCount + 1} ครั้ง - กรุณาตรวจสอบด้วยตนเอง`
                        });

                        // ไม่ส่ง LINE แจ้งลูกค้า - รอ admin ตรวจสอบเอง

                        failCount++;
                    } else {
                        // ยังลองได้อีก - อัปเดต notes
                        console.log(`   ⏳ Still not found, retry ${retryCount + 1}/3`);

                        await entityService.Payment.update(payment.id, {
                            notes: `${payment.notes}\n\n⏳ ลองครั้งที่ ${retryCount + 1}: ยังไม่พบข้อมูล - ${new Date().toISOString()}`
                        });

                        skippedCount++;
                    }
                    continue;
                }

                        console.log(`   ✅ Slip2Go verification SUCCESS! (isDuplicate: ${isDuplicate})`);

                        // ✅ ตรวจสอบสำเร็จ!
                        const slipData = slip2goData.data;
                        const slipAmount = extractAmount(slipData);
                        const senderName = slipData.sender?.account?.name?.th || slipData.sender?.name || 'N/A';
                        const transDate = slipData.transDate || slipData.dateTime || new Date().toISOString().split('T')[0];

                        console.log(`   💰 Slip Amount: ${slipAmount} บาท`);
                        console.log(`   👤 Sender: ${senderName}`);
                        
                        // ⭐ ถ้ายอด = 0 → เงียบ ไม่ตอบอะไร (รอตรวจสอบซ้ำรอบถัดไป)
                        if (slipAmount === 0 || isNaN(slipAmount)) {
                            console.log(`   ⏳ Amount is 0 or invalid - skipping silently (waiting for next recheck)`);
                            skippedCount++;
                            continue;
                        }

                // ⭐ เช็คบัญชีปลายทางก่อนเช็คยอดเงิน
                const expectedAccountNumber = getConfigValue('bank_account_number', payment.branch_id);
                const expectedPromptPay = getConfigValue('promptpay', payment.branch_id);
                const expectedAccountName = getConfigValue('bank_account_name', payment.branch_id);
                
                // ป้องกันกรณี account เป็น object แล้วไปแปลงเป็น string ได้ [object Object]
                const rawReceiverAccount = slipData.receiver?.account?.bank?.account || slipData.receiver?.account?.account || slipData.receiver?.account;
                const receiverAccount = typeof rawReceiverAccount === 'string' ? rawReceiverAccount : '';
                
                const rawReceiverPromptPay = slipData.receiver?.account?.proxy?.value || slipData.receiver?.account?.proxy?.account || slipData.receiver?.proxy?.account || slipData.receiver?.proxy?.value;
                const receiverPromptPay = typeof rawReceiverPromptPay === 'string' ? rawReceiverPromptPay : '';
                
                const receiverName = slipData.receiver?.account?.name?.th || slipData.receiver?.account?.name?.en || slipData.receiver?.account?.name || slipData.receiver?.name || slipData.receiver?.displayName || '';

                console.log('\n========== 🏦 ACCOUNT VERIFICATION START ==========');
                console.log('📋 Expected Configuration:');
                console.log('  Bank Account:', expectedAccountNumber || '(not set)');
                console.log('  PromptPay:', expectedPromptPay || '(not set)');
                console.log('  Account Name:', expectedAccountName || '(not set)');
                console.log('\n📋 Received from Slip:');
                console.log('  Receiver Account:', receiverAccount || '(empty)');
                console.log('  Receiver PromptPay:', receiverPromptPay || '(empty)');
                console.log('  Receiver Name:', receiverName || '(empty)');

                // ⭐ ถ้าไม่มี config บัญชีเลย = บังคับให้ตรวจสอบด้วยตนเอง
                if ((!expectedAccountNumber || expectedAccountNumber.trim() === '') && 
                    (!expectedPromptPay || expectedPromptPay.trim() === '') &&
                    (!expectedAccountName || expectedAccountName.trim() === '')) {
                    console.log('⚠️ NO CONFIG FOUND - Manual review required');

                    await entityService.Payment.update(payment.id, {
                        notes: `${payment.notes || ''}\n\n⚠️ รอตรวจสอบ: ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ (โอนเข้า: ${receiverName} บช ${receiverAccount})`
                    });

                    const tenantRes1 = payment.tenant_id ? await entityService.Tenant.filter({ id: payment.tenant_id }) : [];
                    const tenant1 = Array.isArray(tenantRes1) ? tenantRes1[0] : tenantRes1;
                    if (tenant1?.line_user_id) {
                        await sendLineMessage(base44, tenant1.line_user_id, 
                            `📸 ได้รับสลิปแล้ว!\n\n⚠️ ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ\nกรุณารอเจ้าของหอพักตรวจสอบค่ะ`,
                            payment.branch_id,
                            configs
                        );
                    }
                    
                    skippedCount++;
                    continue;
                }

                let accountMatch = false;
                let matchMethod = '';
                
                // ⭐ เช็คเลขบัญชีธนาคาร
                if (expectedAccountNumber) {
                    console.log('\n🔍 Checking Bank Account Number...');
                    accountMatch = isAccountMatch(receiverAccount, expectedAccountNumber);
                    if (accountMatch) {
                        matchMethod = 'Bank Account';
                        console.log(`✅ MATCHED via Bank Account Number`);
                    }
                }
                
                // ⭐ ถ้าไม่ผ่าน ลองเช็ค PromptPay
                if (!accountMatch && expectedPromptPay) {
                    console.log('\n🔍 Checking PromptPay...');
                    console.log('  Trying receiverPromptPay vs expectedPromptPay...');
                    const promptPayMatch1 = isAccountMatch(receiverPromptPay, expectedPromptPay);
                    
                    if (!promptPayMatch1) {
                        console.log('  Trying receiverAccount vs expectedPromptPay...');
                        const promptPayMatch2 = isAccountMatch(receiverAccount, expectedPromptPay);
                        accountMatch = promptPayMatch2;
                        if (promptPayMatch2) matchMethod = 'PromptPay (via receiverAccount)';
                    } else {
                        accountMatch = true;
                        matchMethod = 'PromptPay';
                    }
                    
                    if (accountMatch) {
                        console.log(`✅ MATCHED via ${matchMethod}`);
                    }
                }

                // ⭐ ถ้าไม่ผ่านทั้งเลขบัญชีและ PromptPay ลองเช็คชื่อบัญชีเป็นด่านสุดท้าย
                if (!accountMatch && expectedAccountName && receiverName) {
                    console.log('\n🔍 Checking Account Name fallback...');
                    
                    let cleanExpectedName = expectedAccountName.replace(/[\s\.\-]/g, '').toLowerCase();
                    let cleanReceiverName = receiverName.replace(/[\s\.\-]/g, '').toLowerCase();
                    
                    const prefixes = ['นาย', 'นางสาว', 'นาง', 'นส', 'น.ส.', 'น.ส', 'mr', 'ms', 'mrs', 'บจก', 'บริษัท', 'หจก'];
                    for (const prefix of prefixes) {
                        if (cleanReceiverName.startsWith(prefix)) cleanReceiverName = cleanReceiverName.substring(prefix.length);
                        if (cleanExpectedName.startsWith(prefix)) cleanExpectedName = cleanExpectedName.substring(prefix.length);
                    }

                    console.log(`  Expected Name (after prefix strip): ${cleanExpectedName}`);
                    console.log(`  Receiver Name (after prefix strip): ${cleanReceiverName}`);
                    
                    if (cleanExpectedName.length > 2 && (cleanReceiverName.includes(cleanExpectedName) || cleanExpectedName.includes(cleanReceiverName))) {
                        accountMatch = true;
                        matchMethod = 'Account Name';
                        console.log(`✅ MATCHED via Account Name`);
                    } else {
                        console.log(`❌ Mismatch Account Name`);
                    }
                }

                console.log('\n========== 🏦 ACCOUNT VERIFICATION RESULT ==========');
                console.log(`  Final Match: ${accountMatch ? '✅ PASS' : '❌ FAIL'}`);
                console.log(`  Method: ${matchMethod || 'None'}`);
                console.log('====================================================\n');

                if (!accountMatch) {
                    console.log(`   ⚠️ Account mismatch - notifying customer`);
                    
                    const errorMsg = `โอนเงินไปผิดบัญชี\n\nตรวจพบโอนเข้า: ${receiverAccount || receiverPromptPay}\nควรโอนเข้า: ${expectedAccountNumber || expectedPromptPay || expectedAccountName}\n\nกรุณาตรวจสอบและส่งสลิปมาใหม่อีกครั้งค่ะ`;
                    
                    await entityService.Payment.update(payment.id, {
                        notes: `${payment.notes}\n\n⚠️ รอตรวจสอบ: ${errorMsg}`
                    });
                    
                    // ⭐ ส่ง LINE แจ้งลูกค้าว่าโอนผิดบัญชี
                    const tenantRes2 = payment.tenant_id ? await entityService.Tenant.filter({ id: payment.tenant_id }) : [];
                    const tenant2 = Array.isArray(tenantRes2) ? tenantRes2[0] : tenantRes2;
                    if (tenant2?.line_user_id) {
                        await sendLineMessage(base44, tenant2.line_user_id, 
                            `❌ ${errorMsg}\n\nกรุณารอเจ้าของหอพักตรวจสอบ หรือโอนใหม่ที่บัญชีที่ถูกต้องค่ะ 🙏`,
                            payment.branch_id,
                            configs
                        );
                    }
                    
                    failCount++;
                    continue;
                }

                // ⭐⭐⭐ คำนวณค่าปรับหลังเช็คบัญชีผ่านแล้ว
                const paymentDateOnly = transDate.split('T')[0];
                const { lateFeeAmount, daysLate } = calculateLateFee(payment, configs, payment.branch_id, new Date(paymentDateOnly));
                
                const baseAmount = parseFloat(payment.total_amount);
                const expectedAmount = baseAmount + lateFeeAmount;
                const currentPaid = parseFloat(payment.paid_amount || 0);
                const totalPaid = currentPaid + slipAmount;

                console.log(`   💰 Expected Amount (with late fee): ${expectedAmount} บาท`);
                console.log(`   💰 Late Fee: ${lateFeeAmount} บาท (${daysLate} days)`);
                console.log(`   💰 Total Paid: ${totalPaid} บาท`);

                // เช็คยอดเงิน (รองรับ partial payment)
                if (totalPaid < expectedAmount * 0.95) {
                    console.log(`   ⚠️ Partial payment: ${totalPaid} < ${expectedAmount * 0.95} (95% of expected)`);
                    const shortfall = expectedAmount - totalPaid;
                    
                    await entityService.Payment.update(payment.id, {
                        status: 'partial_paid',
                        paid_amount: totalPaid,
                        late_fee_amount: lateFeeAmount,
                        total_amount: expectedAmount,
                        notes: `${payment.notes}\n\n💰 ชำระบางส่วน: ${slipAmount.toLocaleString()} บาท (รวมแล้ว ${totalPaid.toLocaleString()}/${expectedAmount.toLocaleString()} บาท)`
                    });
                    
                    const tenantRes3 = payment.tenant_id ? await entityService.Tenant.filter({ id: payment.tenant_id }) : [];
                    const tenant3 = Array.isArray(tenantRes3) ? tenantRes3[0] : tenantRes3;
                    if (tenant3?.line_user_id) {
                        await sendLineMessage(base44, tenant3.line_user_id, 
                            `💰 ได้รับเงินแล้ว ${slipAmount.toLocaleString()} บาท\n\n✅ ชำระไปแล้ว: ${totalPaid.toLocaleString()} บาท\n💵 ต้องชำระ: ${expectedAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? `\n(รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท)` : ''}\n\n⚠️ ต้องโอนเพิ่มอีก: ${shortfall.toLocaleString()} บาท`,
                            payment.branch_id,
                            configs
                        );
                    }
                    
                    failCount++;
                    continue;
                }

                // ทำความสะอาด notes โดยเอา "รอตรวจสอบ" ออก
                let cleanedNotes = payment.notes || '';
                if (cleanedNotes.includes('⚠️ รอตรวจสอบ')) {
                    cleanedNotes = cleanedNotes
                        .split('\n\n')
                        .filter(line => !line.includes('⚠️ รอตรวจสอบ') && !line.includes('⚠️ โอนเงินไปผิดบัญชี'))
                        .join('\n\n')
                        .trim();
                }

                // ✅ ทุกอย่างถูกต้อง - อัปเดตเป็น paid
                await entityService.Payment.update(payment.id, {
                    status: 'paid',
                    payment_date: transDate.split('T')[0],
                    late_fee_amount: lateFeeAmount,
                    total_amount: expectedAmount,
                    paid_amount: expectedAmount,
                    notes: `${cleanedNotes ? cleanedNotes + '\n\n' : ''}✅ ตรวจสอบสลิปอัตโนมัติสำเร็จ (Cron): ${senderName} โอน ${slipAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? ` (รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท)` : ''}${currentPaid > 0 ? ` (ชำระเพิ่ม ${currentPaid.toLocaleString()} บาท)` : ''}\n✅ ยืนยันชำระแล้ว`
                });

                console.log(`   ✅ Payment updated to PAID`);

                // ส่งใบเสร็จให้ลูกค้าผ่าน LINE
                const tenantRes4 = payment.tenant_id ? await entityService.Tenant.filter({ id: payment.tenant_id }) : [];
                const tenant4 = Array.isArray(tenantRes4) ? tenantRes4[0] : tenantRes4;
                if (tenant4?.line_user_id) {
                    try {
                        // เรียก sendReceipt function
                        const receiptResponse = await base44.asServiceRole.functions.invoke('sendReceipt', { 
                            paymentId: payment.id 
                        });
                        
                        if (receiptResponse.data?.success) {
                            console.log(`   📄 Receipt sent successfully`);
                        } else {
                            // Fallback ส่งข้อความธรรมดา
                            await sendLineMessage(base44, tenant4.line_user_id, 
                                `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${slipAmount.toLocaleString()} บาท\n📅 วันที่: ${transDate.split('T')[0]}\n\nขอบคุณที่ชำระเงินค่ะ 🙏`,
                                payment.branch_id,
                                configs
                            );
                        }
                    } catch (receiptError) {
                        console.error(`   ⚠️ Failed to send receipt:`, receiptError.message);
                        // Fallback
                        await sendLineMessage(base44, tenant4.line_user_id, 
                            `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${slipAmount.toLocaleString()} บาท\n📅 วันที่: ${transDate.split('T')[0]}\n\nขอบคุณที่ชำระเงินค่ะ 🙏`,
                            payment.branch_id,
                            configs
                        );
                    }
                }

                successCount++;

            } catch (paymentError) {
                console.error(`   ❌ Error processing payment ${payment.id}:`, paymentError.message);
                failCount++;
            }
        }

        console.log('\n========================================');
        console.log(`✅ Recheck completed!`);
        console.log(`   Success: ${successCount}`);
        console.log(`   Failed: ${failCount}`);
        console.log(`   Skipped: ${skippedCount}`);
        console.log('========================================');

        const executionTime = Date.now() - startTime;
        const result = {
            success: true, 
            message: 'Recheck completed',
            processed: pendingRecheckPayments.length,
            successCount,
            failCount,
            skippedCount
        };

        // บันทึก FunctionLog
        try {
            await entityService.FunctionLog.create({
                function_name: 'recheckPendingSlips',
                run_timestamp: new Date().toISOString(),
                status: successCount > 0 || skippedCount > 0 ? 'success' : 'error',
                message: `ตรวจสอบสลิปสำเร็จ ${successCount} / ล้มเหลว ${failCount} / ข้าม ${skippedCount}`,
                execution_time_ms: executionTime,
                total_sent: successCount,
                total_failed: failCount,
                triggered_by: 'cron',
                details: result
            });
        } catch (logError) {
            console.error('Failed to create FunctionLog:', logError);
        }

        return Response.json(result);

    } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error('❌ Cron Job Error:', error);
        
        // บันทึก error log
        try {
            await entityService.FunctionLog.create({
                function_name: 'recheckPendingSlips',
                run_timestamp: new Date().toISOString(),
                status: 'error',
                message: error.message,
                execution_time_ms: executionTime,
                triggered_by: 'cron',
                details: { error: error.message, stack: error.stack }
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
        
        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});

// Helper function สำหรับส่ง LINE message
async function sendLineMessage(base44, lineUserId, text, branchId, configs) {
    try {
        // หา LINE Token
        let lineToken = null;
        
        if (branchId && configs) {
            const branchToken = configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branchId);
            if (branchToken?.value?.trim()) {
                lineToken = branchToken.value.trim();
            }
        }
        
        if (!lineToken && configs) {
            const globalToken = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
            if (globalToken?.value?.trim()) {
                lineToken = globalToken.value.trim();
            }
        }
        
        if (!lineToken) {
            lineToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
        }

        if (!lineToken) {
            console.log('⚠️ No LINE token available');
            return;
        }

        const response = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify({
                to: lineUserId,
                messages: [{ type: 'text', text }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('LINE API error:', response.status, errorText);
        } else {
            console.log('✅ LINE message sent');
        }
    } catch (error) {
        console.error('Error sending LINE message:', error.message);
    }
}