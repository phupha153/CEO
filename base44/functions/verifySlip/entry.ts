import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { parseISO } from 'npm:date-fns@3.0.0';

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

// ⭐ Helper: Extract amount จาก Slip2Go response (ลองหลาย path เพราะ API อาจเปลี่ยน structure)
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

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        let user;
        try {
            user = await base44.auth.me();
        } catch (authError) {
            console.error('Authentication error:', authError);
            return Response.json({ 
                success: false,
                error: 'กรุณาเข้าสู่ระบบใหม่',
                details: authError.message 
            }, { status: 401 });
        }

        if (!user) {
            return Response.json({ 
                success: false,
                error: 'กรุณาเข้าสู่ระบบ' 
            }, { status: 401 });
        }

        console.log('User authenticated:', user.email);

        let requestBody;
        try {
            requestBody = await req.json();
        } catch (parseError) {
            console.error('Error parsing request body:', parseError);
            return Response.json({ 
                success: false,
                error: 'ข้อมูลไม่ถูกต้อง' 
            }, { status: 400 });
        }

        const { paymentId, fileBase64, fileName } = requestBody;

        if (!paymentId || !fileBase64) {
            console.log('Missing required fields');
            return Response.json({ 
                success: false,
                error: 'ข้อมูลไม่ครบถ้วน'
            }, { status: 400 });
        }

        console.log('Processing payment verification for:', paymentId);

        const slip2goApiKey = Deno.env.get('SLIP2GO_API_KEY');
        if (!slip2goApiKey) {
            console.error('SLIP2GO_API_KEY not configured');
            return Response.json({ 
                success: false,
                error: 'ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ' 
            }, { status: 500 });
        }

        const paymentRes = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
        const payment = Array.isArray(paymentRes) ? paymentRes[0] : paymentRes;

        if (!payment) {
            console.error('Payment not found:', paymentId);
            return Response.json({ 
                success: false,
                error: 'ไม่พบข้อมูลบิล' 
            }, { status: 404 });
        }

        console.log('Payment found. Amount:', payment.total_amount);

        let fileBlob;
        let originalFileSize = 0;
        try {
            // ⭐ ตรวจสอบว่า Base64 มี data URI prefix หรือไม่
            let base64Data = fileBase64;
            if (fileBase64.includes(',')) {
                base64Data = fileBase64.split(',')[1];
                console.log('Removed data URI prefix from Base64');
            }
            
            console.log('Base64 data length:', base64Data.length);
            console.log('Base64 first 50 chars:', base64Data.substring(0, 50));
            
            const binaryString = atob(base64Data);
            const len = binaryString.length;
            originalFileSize = len;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // ⭐ ตรวจสอบ magic bytes เพื่อหา MIME type ที่ถูกต้อง
            let mimeType = 'image/jpeg';
            if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
                mimeType = 'image/png';
                console.log('Detected PNG from magic bytes');
            } else if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
                mimeType = 'image/jpeg';
                console.log('Detected JPEG from magic bytes');
            } else if (fileName) {
                const ext = fileName.split('.').pop().toLowerCase();
                if (ext === 'png') mimeType = 'image/png';
                else if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
                console.log('Using MIME type from filename extension:', mimeType);
            }
            
            fileBlob = new Blob([bytes], { type: mimeType });
            
            console.log('✅ File converted successfully');
            console.log('  - Binary size:', len, 'bytes');
            console.log('  - Blob size:', fileBlob.size, 'bytes');
            console.log('  - MIME type:', mimeType);
        } catch (base64Error) {
            console.error('Error converting Base64:', base64Error);
            console.error('Base64 error details:', base64Error.message);
            return Response.json({ 
                success: false,
                error: 'ไฟล์ไม่ถูกต้อง' 
            }, { status: 400 });
        }

        // อัปโหลดสลิปก่อน
        console.log('📤 Uploading slip...');
        let uploadedSlipUrl;
        try {
            const file = new File([fileBlob], fileName || 'slip.jpg', { type: fileBlob.type });
            const uploadResult = await base44.integrations.Core.UploadFile({ file });
            uploadedSlipUrl = uploadResult.file_url;
            console.log('✅ Slip uploaded:', uploadedSlipUrl);
        } catch (uploadError) {
            console.error('Upload error:', uploadError);
            return Response.json({ 
                success: false,
                error: 'ไม่สามารถอัปโหลดสลิปได้' 
            }, { status: 500 });
        }

        console.log('\n=== Verifying slip with Slip2Go ===');
        
        // ⭐ ใช้ "ตรวจสอบสลิปด้วยรูปภาพ" (qr-image/info) เป็นหลัก
        // Endpoint: /api/verify-slip/qr-image/info
        // Request: multipart/form-data with 'file' field
        let simpleData = null;
        let verificationMethod = '';
        
        console.log('🔍 File details:');
        console.log('  - Original fileName:', fileName);
        console.log('  - Blob size:', fileBlob.size, 'bytes');
        console.log('  - Blob type:', fileBlob.type);
        
        const fileToSend = new File([fileBlob], fileName || 'slip.jpg', { type: fileBlob.type });

        let slip2goErrorMessage = null;
        let slip2goErrorCode = null;
        
        // ⭐ ใช้ qr-image/info เป็น endpoint หลัก (รองรับรูปภาพสลิปที่มี QR Code)
        // Note: qr-code/info ต้องการ QR code string ไม่ใช่รูปภาพ จึงไม่สามารถใช้ได้
        console.log('📱 Trying qr-image/info...');
        try {
            const qrFormData = new FormData();
            qrFormData.append('file', fileToSend);
            qrFormData.append('payload', JSON.stringify({ checkDuplicate: true }));

            const qrResponse = await fetch('https://connect.slip2go.com/api/verify-slip/qr-image/info', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${slip2goApiKey.trim()}`
                },
                body: qrFormData
            });

            const qrResponseText = await qrResponse.text();
            console.log('qr-image/info Status:', qrResponse.status);
            console.log('qr-image/info Response:', qrResponseText);

            try {
                const qrData = JSON.parse(qrResponseText);
                // ⭐ Slip2Go: code "200200" = success (ไม่มี field "success")
                // เช็คทั้ง string และ number เพราะ API บางครั้งส่งมาเป็น number
                const isValidCode = qrData.code === '200200' || qrData.code === 200200;
                
                if (isValidCode && qrData.data) {
                    simpleData = qrData;
                    verificationMethod = 'qr-image';
                    console.log('✅ qr-image/info method succeeded (code:', qrData.code, ')');
                } else {
                    slip2goErrorCode = qrData.code;
                    slip2goErrorMessage = qrData.message;
                    console.log('⚠️ qr-image/info failed:', qrData.code, qrData.message);
                }
            } catch (e) {
                console.log('⚠️ qr-image/info parse failed:', e.message);
            }
        } catch (qrError) {
            console.error('qr-image/info error:', qrError.message);
        }
        
        // ⭐ เช็คว่าสำเร็จหรือไม่ (code 200xxx = success range)
        if (!simpleData || !simpleData.data) {
            console.log('❌ Verification failed - saving for manual review');
            console.log('Error code:', slip2goErrorCode);
            console.log('Error message:', slip2goErrorMessage);
            
            // ดึงข้อมูลห้องเพื่อแสดงหมายเลขห้อง
            const rmRes = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
            const roomNum = (Array.isArray(rmRes) ? rmRes[0] : rmRes)?.room_number || 'ไม่ทราบ';
            const roomNumber = roomNum;
            
            // ⭐ แปลง error code ของ Slip2Go เป็นภาษาไทย
            let errorReason = 'ระบบอ่านยอดไม่ได้';
            
            if (slip2goErrorCode === '400002' || slip2goErrorMessage === 'File is Incorrect') {
                errorReason = 'รูปที่อัปโหลดไม่ใช่สลิปโอนเงินที่ถูกต้อง';
            } else if (slip2goErrorCode === '200404' || slip2goErrorMessage === 'Slip not found') {
                // ⭐ Slip2Go หาข้อมูลสลิปไม่เจอในระบบธนาคาร
                // อาจเกิดจาก: สลิปเก่าเกินไป, QR อ่านไม่ชัด, หรือธนาคารยังไม่ sync ข้อมูล
                errorReason = 'ไม่พบข้อมูลสลิปในระบบธนาคาร (อาจเป็นสลิปเก่าหรือ QR อ่านไม่ชัด)';
            } else if (slip2goErrorCode === '400003' || slip2goErrorMessage?.includes('expired')) {
                errorReason = 'QR Code ในสลิปหมดอายุการตรวจสอบ';
            } else if (slip2goErrorCode === '400004' || slip2goErrorMessage?.includes('duplicate') || slip2goErrorMessage?.includes('Duplicate')) {
                errorReason = 'สลิปนี้เคยถูกใช้ยืนยันแล้ว';
            } else if (slip2goErrorCode === '401' || slip2goErrorMessage?.includes('Unauthorized')) {
                errorReason = 'API Key ไม่ถูกต้อง กรุณาติดต่อผู้ดูแล';
            } else if (slip2goErrorCode === '429' || slip2goErrorMessage?.includes('limit')) {
                errorReason = 'เกินโควต้าการตรวจสอบ กรุณาลองใหม่ภายหลัง';
            } else if (slip2goErrorMessage) {
                errorReason = `Slip2Go: ${slip2goErrorMessage}`;
            }
            
            console.log('Final error reason:', errorReason);
            
            await base44.asServiceRole.entities.Payment.update(paymentId, {
                payment_slip_url: uploadedSlipUrl,
                notes: payment.notes ? 
                    `${payment.notes}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ${errorReason}` :
                    `⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ${errorReason}`
            });
            
            return Response.json({ 
                success: true,
                message: `อัปโหลดสลิปสำเร็จ\n\n${errorReason}\n\nกรุณารอเจ้าของหอพักตรวจสอบ`,
                manual_review_required: true,
                error_code: slip2goErrorCode,
                error_message: slip2goErrorMessage
            });
        }
        
        console.log(`✅ Verified using ${verificationMethod} method`);

        // ⭐ เช็คว่ามี simpleData และ code = 200200 (success)
        const isValidCode = simpleData?.code === '200200' || simpleData?.code === 200200;
        if (isValidCode && simpleData?.data) {
            console.log('✅ Slip verification SUCCESS! (code:', simpleData.code, ')');

            const slipData = simpleData.data;
            
            // ⭐ Log ข้อมูลดิบทั้งหมดเพื่อ debug structure
            console.log('📋 Slip2Go Full Response:', JSON.stringify(simpleData, null, 2));
            
            // ⭐ ใช้ extractAmount() เหมือน LINE webhook (ลองหลาย path)
            const slipAmount = extractAmount(slipData);
            console.log('💰 Extracted slip amount:', slipAmount);
            
            // ⭐ Validate amount ต้องมากกว่า 0
            if (slipAmount === 0 || isNaN(slipAmount)) {
                console.error('❌ Invalid slip amount:', slipAmount);
                
                const rmRes = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
                const roomNum = (Array.isArray(rmRes) ? rmRes[0] : rmRes)?.room_number || 'ไม่ทราบ';
                const roomNumber = roomNum;
                
                await base44.asServiceRole.entities.Payment.update(paymentId, {
                    payment_slip_url: uploadedSlipUrl,
                    notes: payment.notes ? 
                        `${payment.notes}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ระบบอ่านยอดเงินไม่ได้` :
                        `⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ระบบอ่านยอดเงินไม่ได้`
                });
                
                return Response.json({ 
                    success: true,
                    message: `อัปโหลดสลิปสำเร็จ\n\nระบบอ่านยอดเงินไม่ได้\nกรุณารอเจ้าของหอพักตรวจสอบ`,
                    manual_review_required: true
                });
            }
            
            // ⭐⭐⭐ เช็คบัญชีปลายทางก่อนเช็คยอด (ป้องกันรับสลิปที่โอนผิดบัญชี)
            const configRes = await base44.asServiceRole.entities.Config.list('', 2000);
            const configs = Array.isArray(configRes) ? configRes : (configRes?.data || []);
            const getConfigValue = (key) => {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === payment.branch_id);
                if (branchConfig) return branchConfig.value;

                const globalConfig = configs.find(c => c.key === key && !c.branch_id);
                return globalConfig?.value || null;
            };

            const expectedAccountNumber = getConfigValue('bank_account_number');
            const expectedPromptPay = getConfigValue('promptpay');
            const expectedAccountName = getConfigValue('bank_account_name');

            // ⭐ ดึงข้อมูลจาก Slip2Go Response
            const receiverAccount = slipData.receiver?.account?.bank?.account || slipData.receiver?.account?.account || slipData.receiver?.account || '';
            const receiverPromptPay = slipData.receiver?.account?.proxy?.value || slipData.receiver?.account?.proxy?.account || slipData.receiver?.proxy?.account || slipData.receiver?.proxy?.value || '';
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
                const rmRes = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
                const roomNum = (Array.isArray(rmRes) ? rmRes[0] : rmRes)?.room_number || 'ไม่ทราบ';
                const roomNumber = roomNum;

                console.log('⚠️ NO CONFIG FOUND - Manual review required');

                await base44.asServiceRole.entities.Payment.update(paymentId, {
                    payment_slip_url: uploadedSlipUrl,
                    notes: payment.notes ? 
                        `${payment.notes}\n\n⚠️ รอตรวจสอบด้วยตนเอง: ห้อง ${roomNumber} (โอนเข้า: ${receiverName} บช ${receiverAccount})` :
                        `⚠️ รอตรวจสอบด้วยตนเอง: ห้อง ${roomNumber} (โอนเข้า: ${receiverName} บช ${receiverAccount})`
                });

                return Response.json({ 
                    success: true,
                    message: `อัปโหลดสลิปสำเร็จ`,
                    manual_review_required: true,
                    no_config: true
                });
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
                
                console.log(`  Expected Name (clean): ${cleanExpectedName}`);
                console.log(`  Receiver Name (clean): ${cleanReceiverName}`);
                
                const prefixes = ['นาย', 'นางสาว', 'นาง', 'นส', 'น.ส.', 'น.ส', 'mr', 'ms', 'mrs', 'บจก', 'บริษัท', 'หจก'];
                for (const prefix of prefixes) {
                    if (cleanReceiverName.startsWith(prefix)) cleanReceiverName = cleanReceiverName.substring(prefix.length);
                    if (cleanExpectedName.startsWith(prefix)) cleanExpectedName = cleanExpectedName.substring(prefix.length);
                }
                
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
                const rmRes = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
                const roomNum = (Array.isArray(rmRes) ? rmRes[0] : rmRes)?.room_number || 'ไม่ทราบ';
                const roomNumber = roomNum;

                const errorMsg = `โอนเงินไปผิดบัญชี\n\nตรวจพบโอนเข้า: ${receiverAccount || receiverPromptPay}\nควรโอนเข้า: ${expectedAccountNumber || expectedPromptPay}\n\nกรุณาตรวจสอบอีกครั้ง`;

                await base44.asServiceRole.entities.Payment.update(paymentId, {
                    payment_slip_url: uploadedSlipUrl,
                    notes: payment.notes ? 
                        `${payment.notes}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ${errorMsg}` :
                        `⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ${errorMsg}`
                });

                const bRes = await base44.asServiceRole.entities.Branch.filter({ id: payment.branch_id });
                const branch = Array.isArray(bRes) ? bRes[0] : bRes;
                const ownerEmail = branch?.owner_id;

                if (ownerEmail) {
                    try {
                        await base44.asServiceRole.integrations.Core.SendEmail({
                            to: ownerEmail,
                            subject: `แจ้งเตือน: ตรวจพบการโอนผิดบัญชี (ห้อง ${roomNumber})`,
                            body: `เรียนเจ้าของหอพัก,\n\nระบบตรวจพบการโอนเงินผิดบัญชีสำหรับห้อง ${roomNumber}\n\n${errorMsg}\n\nกรุณาตรวจสอบสลิปในระบบ`
                        });
                        console.log(`✅ Sent wrong account warning email to ${ownerEmail}`);
                    } catch (emailErr) {
                        console.error('Failed to send warning email:', emailErr);
                    }
                }

                return Response.json({ 
                    success: true,
                    message: `อัปโหลดสลิปสำเร็จ แต่${errorMsg}\n\nกรุณารอเจ้าของหอพักตรวจสอบ`,
                    manual_review_required: true,
                    account_mismatch: true
                });
            }

            // ⭐⭐⭐ คำนวณค่าปรับหลังเช็คชื่อบัญชีแล้ว
            // Slip2Go ส่ง dateTime ไม่ใช่ transDate
            const paymentDateStr = slipData.dateTime || slipData.transDate || new Date().toISOString();
            const paymentDateOnly = paymentDateStr.split('T')[0];
            console.log('📅 Payment date from slip:', paymentDateOnly);
            
            const paymentDateObj = parseISO(paymentDateOnly);
            const dueDateObj = parseISO(payment.due_date);
            const daysLate = Math.floor((paymentDateObj - dueDateObj) / (1000 * 60 * 60 * 24));

            console.log('\n========== 💰 LATE FEE CALCULATION START ==========');
            console.log('📅 Due Date:', payment.due_date);
            console.log('📅 Payment Date:', paymentDateOnly);
            console.log('⏰ Days Late:', daysLate);

            let lateFeeAmount = 0;
            if (daysLate > 0) {
                // เช็คว่าใช้ค่าปรับแบบขั้นบันไดหรือไม่
                const tiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && (c.branch_id === payment.branch_id || !c.branch_id));
                const tiersEnabled = tiersEnabledConfig?.value === 'true';
                
                console.log('🔧 Config Check:');
                console.log('  - late_fee_tiers_enabled:', tiersEnabled ? 'YES ✅' : 'NO ❌');

                let usedTiers = false;

                if (tiersEnabled) {
                    const tiersConfig = configs.find(c => c.key === 'late_fee_tiers' && (c.branch_id === payment.branch_id || !c.branch_id));
                    
                    console.log('  - late_fee_tiers config:', tiersConfig?.value ? 'FOUND ✅' : 'NOT FOUND ❌');

                    if (tiersConfig?.value) {
                        try {
                            const tiers = JSON.parse(tiersConfig.value);
                            console.log('\n📊 USING TIERED LATE FEE CALCULATION');
                            console.log('📋 Tiers:', JSON.stringify(tiers, null, 2));
                            console.log(`⏰ Days Late: ${daysLate}`);

                            for (const tier of tiers) {
                                const daysFrom = tier.days_from || 1;
                                const daysTo = tier.days_to || 999;
                                const feePerDay = parseFloat(tier.fee_per_day || 0);

                                if (daysLate >= daysFrom) {
                                    const daysInThisTier = Math.min(daysLate, daysTo) - daysFrom + 1;
                                    if (daysInThisTier > 0) {
                                        const tierFee = daysInThisTier * feePerDay;
                                        lateFeeAmount += tierFee;
                                        console.log(`  ✅ Tier ${daysFrom}-${daysTo} วัน: ${daysInThisTier} วัน × ${feePerDay}฿ = ${tierFee}฿`);
                                    }
                                }

                                if (daysLate <= daysTo) break;
                            }

                            usedTiers = true;
                            console.log(`\n💰 TIERED TOTAL: ${lateFeeAmount} บาท (${daysLate} วันล่าช้า)`);
                        } catch (e) {
                            console.error('❌ Error parsing tiers, fallback to simple fee:', e);
                        }
                    }
                }

                // ถ้าไม่ได้เปิดใช้ขั้นบันได หรือ parse ไม่สำเร็จ → ใช้ค่าปรับแบบปกติ
                if (!usedTiers) {
                    const lateFeePerDayConfig = configs.find(c => c.key === 'late_fee_per_day' && (c.branch_id === payment.branch_id || !c.branch_id));
                    const lateFeePerDay = parseFloat(lateFeePerDayConfig?.value || 0);
                    
                    console.log('\n📊 USING SIMPLE LATE FEE CALCULATION');
                    console.log('  - late_fee_per_day config:', lateFeePerDay);
                    console.log('  - Days Late:', daysLate);
                    console.log('  - Formula:', `${daysLate} × ${lateFeePerDay}฿`);
                    
                    lateFeeAmount = daysLate * lateFeePerDay;
                    console.log(`\n💰 SIMPLE TOTAL: ${lateFeeAmount} บาท`);
                }
            } else {
                console.log('✅ Payment on time - No late fee');
            }
            
            console.log('========== 💰 LATE FEE CALCULATION END ==========\n');

            // ⭐ คำนวณยอดที่ต้องชำระจริง (รวมค่าปรับ)
            const expectedAmount = parseFloat(payment.total_amount) + lateFeeAmount;
            const currentPaid = parseFloat(payment.paid_amount || 0);
            const totalPaid = currentPaid + slipAmount;

            console.log('💰 Slip amount:', slipAmount);
            console.log('💰 Expected amount (with late fee):', expectedAmount);
            console.log('💰 Already paid:', currentPaid);
            console.log('💰 Total paid:', totalPaid);
            console.log('💰 Late fee:', lateFeeAmount);

            // ตรวจสอบยอดเงิน (ยอมรับ ±5%)
            if (totalPaid < expectedAmount * 0.95) {
                // ดึงข้อมูลห้องเพื่อแสดงหมายเลขห้อง
                const rmRes = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
                const roomNum = (Array.isArray(rmRes) ? rmRes[0] : rmRes)?.room_number || 'ไม่ทราบ';
                const roomNumber = roomNum;
                const shortfall = expectedAmount - totalPaid;

                // อัปเดตยอดที่จ่ายไปแล้ว และเปลี่ยนสถานะเป็น partial_paid
                await base44.asServiceRole.entities.Payment.update(paymentId, {
                    status: 'partial_paid',
                    paid_amount: totalPaid,
                    payment_slip_url: uploadedSlipUrl,
                    late_fee_amount: lateFeeAmount,
                    total_amount: expectedAmount,
                    notes: payment.notes ? 
                        `${payment.notes}\n\n💰 ชำระบางส่วน: ${slipAmount.toLocaleString()} บาท (รวมแล้ว ${totalPaid.toLocaleString()}/${expectedAmount.toLocaleString()} บาท)` :
                        `💰 ชำระบางส่วน: ${slipAmount.toLocaleString()} บาท (รวมแล้ว ${totalPaid.toLocaleString()}/${expectedAmount.toLocaleString()} บาท)`
                });

                const bRes = await base44.asServiceRole.entities.Branch.filter({ id: payment.branch_id });
                const branch = Array.isArray(bRes) ? bRes[0] : bRes;
                const ownerEmail = branch?.owner_id;

                if (ownerEmail) {
                    try {
                        await base44.asServiceRole.integrations.Core.SendEmail({
                            to: ownerEmail,
                            subject: `แจ้งเตือน: ยอดโอนไม่ครบ (ห้อง ${roomNumber})`,
                            body: `เรียนเจ้าของหอพัก,\n\nมีการโอนเงินเข้ามาสำหรับห้อง ${roomNumber} แต่มียอดไม่ครบถ้วน\n\nยอดที่ต้องชำระ: ${expectedAmount.toLocaleString()} บาท\nยอดที่โอนเข้ามา: ${slipAmount.toLocaleString()} บาท\nขาดอีก: ${shortfall.toLocaleString()} บาท\n\nกรุณาตรวจสอบสลิปในระบบ`
                        });
                        console.log(`✅ Sent mismatch amount warning email to ${ownerEmail}`);
                    } catch (emailErr) {
                        console.error('Failed to send warning email:', emailErr);
                    }
                }

                return Response.json({ 
                    success: true,
                    message: `💰 ได้รับเงินแล้ว ${slipAmount.toLocaleString()} บาท\n\n✅ ชำระไปแล้ว: ${totalPaid.toLocaleString()} บาท\n💵 ต้องชำระ: ${expectedAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? `\n   (รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท จากชำระล่าช้า ${daysLate} วัน)` : ''}\n\n⚠️ ต้องโอนเพิ่มอีก: ${shortfall.toLocaleString()} บาท\n\nกรุณาโอนส่วนที่ขาดและอัปโหลดสลิปใหม่`,
                    partial_payment: true,
                    paid_amount: totalPaid,
                    expected_amount: expectedAmount,
                    remaining_amount: shortfall,
                    late_fee: lateFeeAmount
                });
            }

            // ✅ ทุกอย่างถูกต้อง - อัปเดต payment (ชำระครบแล้ว)
            const senderName = slipData.sender?.account?.name?.th || 
                              slipData.sender?.account?.name || 
                              slipData.sender?.displayName || 'N/A';

            const updatedPayment = await base44.asServiceRole.entities.Payment.update(paymentId, {
                status: 'paid',
                payment_date: paymentDateOnly,
                payment_slip_url: uploadedSlipUrl,
                late_fee_amount: lateFeeAmount,
                total_amount: expectedAmount,
                paid_amount: expectedAmount,
                notes: payment.notes ? 
                    `${payment.notes}\n\n✅ ตรวจสอบสลิปอัตโนมัติ: ${senderName} โอน ${slipAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? ` (รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท)` : ''}${currentPaid > 0 ? ` (ชำระเพิ่มจากครั้งก่อน ${currentPaid.toLocaleString()} บาท)` : ''}` :
                    `✅ ตรวจสอบสลิปอัตโนมัติ: ${senderName} โอน ${slipAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? ` (รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท จากชำระล่าช้า ${daysLate} วัน)` : ''}${currentPaid > 0 ? ` (ชำระเพิ่มจากครั้งก่อน ${currentPaid.toLocaleString()} บาท)` : ''}`
            });
            
            console.log('✅ Payment updated successfully:', updatedPayment.id, 'status:', updatedPayment.status);
            
            // ⭐ คำนวณคะแนนอัตโนมัติหลังยืนยันสลิป
            if (payment.tenant_id) {
                try {
                    const scoreResponse = await base44.asServiceRole.functions.invoke('calculatePaymentScores', {
                        tenant_id: payment.tenant_id
                    });
                    if (scoreResponse.data?.success) {
                        console.log(`✅ Score updated: avg=${scoreResponse.data.avg_payment_score}/10`);
                    }
                } catch (scoreError) {
                    console.warn('⚠️ Failed to calculate payment score:', scoreError.message);
                }
            }

            // ⭐ ส่งข้อมูลไปยัง CRM เฉพาะการชำระแพ็กเกจเท่านั้น (ไม่ส่งค่าเช่าห้องปกติ)
            const isPackagePayment = !payment.booking_id || payment.payment_category === 'package';
            
            if (isPackagePayment) {
              console.log('📤 This is a PACKAGE payment - sending to CRM...');
              try {
                const crmWebhookUrl = 'https://ta-01ka6m9nmbv7qt4nfa6hkghhyy-5173.wo-eqi13toh5dnga3zgg8fg4pukt.w.modal.host/api/addCustomerWebhook';
                const crmApiKey = 'crm_8swg3i4zy9rpk8ysf6q';

                const crmResponse = await fetch(crmWebhookUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': crmApiKey
                  },
                  body: JSON.stringify({
                    event_type: 'payment_verified',
                    customer_email: user.email,
                    customer_name: user.full_name,
                    payment_id: paymentId,
                    amount: slipAmount,
                    payment_date: paymentDateOnly,
                    sender_name: senderName,
                    timestamp: new Date().toISOString()
                  })
                });
                
                if (!crmResponse.ok) {
                  console.error('⚠️ CRM webhook failed:', crmResponse.status, await crmResponse.text());
                } else {
                  console.log('✅ CRM webhook sent successfully');
                }
              } catch (crmError) {
                console.error('⚠️ CRM webhook error:', crmError.message);
              }
            } else {
              console.log('⏭️ This is a ROOM RENTAL payment (booking_id exists) - skipping CRM webhook');
            }

            return Response.json({ 
                success: true,
                message: '✅ ตรวจสอบสลิปสำเร็จและอัปเดตสถานะเป็น "ชำระแล้ว"',
                verified_amount: slipAmount,
                payment_date: paymentDateOnly,
                late_fee: lateFeeAmount,
                days_late: daysLate
            });
        }

        // ไม่สามารถอ่านสลิปได้ (กรณี simpleData มีค่าแต่ success = false)
        console.log('❌ Slip verification failed - simpleData exists but success is false');
        
        let errorMessage = 'ระบบอ่านสลิปไม่ได้';
        
        if (simpleData?.message === 'File is Incorrect') {
            errorMessage = 'รูปที่อัปโหลดไม่ใช่สลิปโอนเงินที่ถูกต้อง';
        } else if (simpleData?.code === '400002') {
            errorMessage = 'ไม่สามารถอ่านข้อมูลจากสลิปได้';
        }
        
        // ดึงข้อมูลห้องเพื่อแสดงหมายเลขห้อง
        const rmRes = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
        const roomNum = (Array.isArray(rmRes) ? rmRes[0] : rmRes)?.room_number || 'ไม่ทราบ';
        const roomNumber = roomNum;
        
        // บันทึกสลิปไว้แม้อ่านไม่ได้
        await base44.asServiceRole.entities.Payment.update(paymentId, {
            payment_slip_url: uploadedSlipUrl,
            notes: payment.notes ? 
                `${payment.notes}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ${errorMessage} - กรุณารอเจ้าของหอพักตรวจสอบด้วยตนเอง` :
                `⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ${errorMessage} - กรุณารอเจ้าของหอพักตรวจสอบด้วยตนเอง`
        });
        
        return Response.json({ 
            success: true,
            message: `อัปโหลดสลิปสำเร็จ\n\n${errorMessage}\nกรุณารอเจ้าของหอพักตรวจสอบด้วยตนเอง`,
            manual_review_required: true,
            slip_url: uploadedSlipUrl
        });

    } catch (error) {
        console.error('=== FUNCTION ERROR ===', error);
        return Response.json({ 
            success: false,
            error: 'เกิดข้อผิดพลาดในระบบ',
            details: error.message 
        }, { status: 500 });
    }
});