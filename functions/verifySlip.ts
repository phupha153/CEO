import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { parseISO } from 'npm:date-fns@3.0.0';

// ⭐ Helper: เช็คเลขบัญชีแบบปลอดภัย (รองรับ masked accounts)
function isAccountMatch(maskedSlipAccount, myRealAccount) {
    if (!maskedSlipAccount || !myRealAccount) return false;
    
    const slipAcc = String(maskedSlipAccount).replace(/[- ]/g, '').toLowerCase();
    const myAcc = String(myRealAccount).replace(/[- ]/g, '').toLowerCase();
    
    if (Math.abs(slipAcc.length - myAcc.length) > 2) return false;
    
    let matchedCount = 0;
    const minRequired = slipAcc.length <= 4 ? 2 : 3;
    
    for (let i = 0; i < Math.min(slipAcc.length, myAcc.length); i++) {
        if (slipAcc[i] === 'x' || slipAcc[i] === '*') continue;
        if (slipAcc[i] === myAcc[i]) matchedCount++;
        else return false;
    }
    
    return matchedCount >= minRequired;
}

// ⭐ Helper: Extract amount จาก Slip2Go response (ลองหลาย path เพราะ API อาจเปลี่ยน structure)
function extractAmount(slipData) {
    const possiblePaths = [
        ['amount'],
        ['transAmount'],
        ['transaction', 'amount'],
        ['payment', 'amount'],
        ['data', 'amount'],
        ['receiver', 'amount'],
        ['sender', 'amount']
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
                console.log(`💰 Found amount at path: ${path.join('.')} = ${amount}`);
                return amount;
            }
        }
    }
    
    console.warn('⚠️ Could not find amount in any known path');
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

        const payments = await base44.asServiceRole.entities.Payment.list();
        const payment = payments.find(p => p.id === paymentId);

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
            const rooms = await base44.asServiceRole.entities.Room.list();
            const room = rooms.find(r => r.id === payment.room_id);
            const roomNumber = room?.room_number || 'ไม่ทราบ';
            
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
            
            // ⭐ Log ข้อมูลดิบทั้งหมดก่อนเพื่อ debug
            console.log('📋 Slip2Go Full Response:', JSON.stringify(simpleData, null, 2));
            console.log('📋 Slip Data:', JSON.stringify(slipData, null, 2));
            
            // ⭐ ใช้ extractAmount() เหมือน LINE webhook (robust กว่า)
            const slipAmount = extractAmount(slipData);
            console.log('💰 Extracted slip amount:', slipAmount);
            
            // ⭐⭐⭐ เช็คบัญชีปลายทางก่อนเช็คยอด (ป้องกันรับสลิปที่โอนผิดบัญชี)
            const configs = await base44.asServiceRole.entities.Config.list();
            const getConfigValue = (key) => {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === payment.branch_id);
                if (branchConfig) return branchConfig.value;

                const globalConfig = configs.find(c => c.key === key && !c.branch_id);
                return globalConfig?.value || null;
            };

            const expectedAccountNumber = getConfigValue('bank_account_number');
            const expectedPromptPay = getConfigValue('promptpay');

            // ⭐ ดึงข้อมูลจาก Slip2Go Response
            const receiverAccount = slipData.receiver?.account?.bank?.account || '';
            const receiverPromptPay = slipData.receiver?.account?.proxy?.value || '';
            const receiverName = slipData.receiver?.account?.name || '';

            console.log('🔍 Checking account match (NEW SECURE METHOD):');
            console.log('  Expected Account:', expectedAccountNumber);
            console.log('  Expected PromptPay:', expectedPromptPay);
            console.log('  Receiver Account (from slip):', receiverAccount);
            console.log('  Receiver PromptPay (from slip):', receiverPromptPay);
            console.log('  Receiver Name (from slip):', receiverName);

            // ⭐ ถ้าไม่มี config บัญชีเลย = บังคับให้ตรวจสอบด้วยตนเอง
            if ((!expectedAccountNumber || expectedAccountNumber.trim() === '') && 
                (!expectedPromptPay || expectedPromptPay.trim() === '')) {
                const rooms = await base44.asServiceRole.entities.Room.list();
                const room = rooms.find(r => r.id === payment.room_id);
                const roomNumber = room?.room_number || 'ไม่ทราบ';

                console.log('⚠️ NO CONFIG FOUND - Manual review required');

                await base44.asServiceRole.entities.Payment.update(paymentId, {
                    payment_slip_url: uploadedSlipUrl,
                    notes: payment.notes ? 
                        `${payment.notes}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ (โอนเข้า: ${receiverName} บช ${receiverAccount})` :
                        `⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ (โอนเข้า: ${receiverName} บช ${receiverAccount})`
                });

                return Response.json({ 
                    success: true,
                    message: `อัปโหลดสลิปสำเร็จ\n\n⚠️ ยังไม่ได้ตั้งค่าบัญชีธนาคารในระบบ\nกรุณารอเจ้าของหอพักตรวจสอบ`,
                    manual_review_required: true,
                    no_config: true
                });
            }

            let accountMatch = false;

            // ⭐ เช็คเลขบัญชีธนาคาร
            if (expectedAccountNumber) {
                accountMatch = isAccountMatch(receiverAccount, expectedAccountNumber);
                console.log(`  💳 Bank Account Match: ${accountMatch}`);
            }

            // ⭐ ถ้าไม่ผ่าน ลองเช็ค PromptPay
            if (!accountMatch && expectedPromptPay) {
                const promptPayMatch1 = isAccountMatch(receiverPromptPay, expectedPromptPay);
                const promptPayMatch2 = isAccountMatch(receiverAccount, expectedPromptPay);
                accountMatch = promptPayMatch1 || promptPayMatch2;
                console.log(`  📱 PromptPay Match: ${accountMatch}`);
            }

            console.log('  ✅ Final Account Match:', accountMatch);

            if (!accountMatch) {
                const rooms = await base44.asServiceRole.entities.Room.list();
                const room = rooms.find(r => r.id === payment.room_id);
                const roomNumber = room?.room_number || 'ไม่ทราบ';

                const errorMsg = `โอนเงินไปผิดบัญชี\n\nตรวจพบโอนเข้า: ${receiverAccount || receiverPromptPay}\nควรโอนเข้า: ${expectedAccountNumber || expectedPromptPay}\n\nกรุณาตรวจสอบอีกครั้ง`;

                await base44.asServiceRole.entities.Payment.update(paymentId, {
                    payment_slip_url: uploadedSlipUrl,
                    notes: payment.notes ? 
                        `${payment.notes}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ${errorMsg}` :
                        `⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ${errorMsg}`
                });

                return Response.json({ 
                    success: true,
                    message: `อัปโหลดสลิปสำเร็จ แต่${errorMsg}\n\nกรุณารอเจ้าของหอพักตรวจสอบ`,
                    manual_review_required: true,
                    account_mismatch: true
                });
            }

            // ⭐⭐⭐ คำนวณค่าปรับหลังเช็คชื่อบัญชีแล้ว
            // Slip2Go ส่ง dateTime ไม่ใช่ transDate
            const paymentDateStr = slipData.dateTime || slipData.transDate || new Date().toISOString().split('T')[0];
            const paymentDateObj = parseISO(paymentDateStr.split('T')[0]);
            const dueDateObj = parseISO(payment.due_date);
            const daysLate = Math.floor((paymentDateObj - dueDateObj) / (1000 * 60 * 60 * 24));

            let lateFeeAmount = 0;
            if (daysLate > 0) {
                // เช็คว่าใช้ค่าปรับแบบขั้นบันไดหรือไม่
                const tiersEnabledConfig = configs.find(c => c.key === 'late_fee_tiers_enabled' && (c.branch_id === payment.branch_id || !c.branch_id));
                const tiersEnabled = tiersEnabledConfig?.value === 'true';

                let usedTiers = false;

                if (tiersEnabled) {
                    const tiersConfig = configs.find(c => c.key === 'late_fee_tiers' && (c.branch_id === payment.branch_id || !c.branch_id));

                    if (tiersConfig?.value) {
                        try {
                            const tiers = JSON.parse(tiersConfig.value);
                            console.log(`📊 Using tiered late fees - Days late: ${daysLate}`);

                            for (const tier of tiers) {
                                const daysFrom = tier.days_from || 1;
                                const daysTo = tier.days_to || 999;
                                const feePerDay = parseFloat(tier.fee_per_day || 0);

                                if (daysLate >= daysFrom) {
                                    const daysInThisTier = Math.min(daysLate, daysTo) - daysFrom + 1;
                                    if (daysInThisTier > 0) {
                                        const tierFee = daysInThisTier * feePerDay;
                                        lateFeeAmount += tierFee;
                                        console.log(`  ➡️ Tier ${daysFrom}-${daysTo}: ${daysInThisTier} วัน × ${feePerDay}฿ = ${tierFee}฿`);
                                    }
                                }

                                if (daysLate <= daysTo) break;
                            }

                            usedTiers = true;
                            console.log(`⏰ Late payment (Tiers): ${daysLate} days → TOTAL ${lateFeeAmount} บาท`);
                        } catch (e) {
                            console.error('❌ Error parsing tiers, fallback to simple fee:', e);
                        }
                    }
                }

                // ถ้าไม่ได้เปิดใช้ขั้นบันได หรือ parse ไม่สำเร็จ → ใช้ค่าปรับแบบปกติ
                if (!usedTiers) {
                    const lateFeePerDayConfig = configs.find(c => c.key === 'late_fee_per_day' && (c.branch_id === payment.branch_id || !c.branch_id));
                    const lateFeePerDay = parseFloat(lateFeePerDayConfig?.value || 0);
                    lateFeeAmount = daysLate * lateFeePerDay;
                    console.log(`⏰ Late payment (Simple): ${daysLate} days × ${lateFeePerDay} = ${lateFeeAmount} บาท`);
                }
            }

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
                const rooms = await base44.asServiceRole.entities.Room.list();
                const room = rooms.find(r => r.id === payment.room_id);
                const roomNumber = room?.room_number || 'ไม่ทราบ';
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
            const currentPaid = parseFloat(payment.paid_amount || 0);
            const totalPaidNow = currentPaid + slipAmount;

            const updatedPayment = await base44.asServiceRole.entities.Payment.update(paymentId, {
                status: 'paid',
                payment_date: (slipData.dateTime || slipData.transDate || new Date().toISOString()).split('T')[0],
                payment_slip_url: uploadedSlipUrl,
                late_fee_amount: lateFeeAmount,
                total_amount: expectedAmount,
                paid_amount: expectedAmount,
                notes: payment.notes ? 
                    `${payment.notes}\n\n✅ ตรวจสอบสลิปอัตโนมัติ: ${slipData.sender?.account?.name?.th || 'N/A'} โอน ${slipAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? ` (รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท)` : ''}${currentPaid > 0 ? ` (ชำระเพิ่มจากครั้งก่อน ${currentPaid.toLocaleString()} บาท)` : ''}` :
                    `✅ ตรวจสอบสลิปอัตโนมัติ: ${slipData.sender?.account?.name?.th || 'N/A'} โอน ${slipAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? ` (รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท)` : ''}${currentPaid > 0 ? ` (ชำระเพิ่มจากครั้งก่อน ${currentPaid.toLocaleString()} บาท)` : ''}`
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

            // ส่งข้อมูลไปยัง CRM
            try {
              const crmWebhookUrl = 'https://ta-01ka6m9nmbv7qt4nfa6hkghhyy-5173.wo-eqi13toh5dnga3zgg8fg4pukt.w.modal.host/api/addCustomerWebhook';
              const crmApiKey = 'crm_8swg3i4zy9rpk8ysf6q';

              await fetch(crmWebhookUrl, {
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
                  payment_date: slipData.transDate || new Date().toISOString().split('T')[0],
                  sender_name: slipData.sender?.account?.name?.th || 'N/A',
                  timestamp: new Date().toISOString()
                })
              });
            } catch (crmError) {
              console.error('CRM error:', crmError);
            }

            return Response.json({ 
                success: true,
                message: '✅ ตรวจสอบสลิปสำเร็จและอัปเดตสถานะเป็น "ชำระแล้ว"',
                slipData: slipData,
                verified_amount: slipAmount
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
        const rooms = await base44.asServiceRole.entities.Room.list();
        const room = rooms.find(r => r.id === payment.room_id);
        const roomNumber = room?.room_number || 'ไม่ทราบ';
        
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