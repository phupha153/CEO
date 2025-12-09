import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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

        // คำนวณค่าปรับ ณ วันที่ตรวจสลิป
        const configs = await base44.asServiceRole.entities.Config.list();
        const lateFeeConfig = configs.find(c => c.key === 'late_payment_fee_per_day');
        const lateFeePerDay = lateFeeConfig ? parseFloat(lateFeeConfig.value) : 0;
        
        let lateFeeAmount = 0;
        if (payment.due_date && payment.status !== 'paid' && lateFeePerDay > 0) {
            try {
                const dueDate = new Date(payment.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                dueDate.setHours(0, 0, 0, 0);
                
                const daysOverdue = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));
                if (daysOverdue > 0) {
                    lateFeeAmount = daysOverdue * lateFeePerDay;
                }
            } catch (e) {
                console.error('Error calculating late fee:', e);
            }
        }

        const totalAmountWithLateFee = payment.total_amount + lateFeeAmount;

        console.log('Payment found. Base amount:', payment.total_amount, 'Late fee:', lateFeeAmount, 'Total:', totalAmountWithLateFee);

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
                if (qrResponse.ok && qrData.success && qrData.data?.amount?.amount) {
                    simpleData = qrData;
                    verificationMethod = 'qr-image';
                    console.log('✅ qr-image/info method succeeded');
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
        
        // ถ้าไม่สำเร็จ - บันทึกไว้ให้ตรวจสอบด้วยตนเอง (ไม่ลอง endpoint อื่น)
        if (!simpleData) {
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

        if (simpleData && simpleData.success) {
            console.log('✅ Slip verification SUCCESS!');
            
            const slipData = simpleData.data;
            const slipAmount = parseFloat(slipData.amount?.amount || 0);
            const expectedAmount = totalAmountWithLateFee;
            
            console.log('💰 Slip amount:', slipAmount);
            console.log('💰 Expected amount (with late fee):', expectedAmount);
            console.log('💰 Base amount:', payment.total_amount);
            console.log('💰 Late fee:', lateFeeAmount);
            
            // ตรวจสอบยอดเงิน (ยอมรับ ±5%)
            if (slipAmount < expectedAmount * 0.95) {
                // ดึงข้อมูลห้องเพื่อแสดงหมายเลขห้อง
                const rooms = await base44.asServiceRole.entities.Room.list();
                const room = rooms.find(r => r.id === payment.room_id);
                const roomNumber = room?.room_number || 'ไม่ทราบ';
                
                await base44.asServiceRole.entities.Payment.update(paymentId, {
                    payment_slip_url: uploadedSlipUrl,
                    notes: payment.notes ? 
                        `${payment.notes}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ยอดเงินไม่ตรงกัน (สลิป: ${slipAmount.toLocaleString()} บาท / ต้องชำระ: ${expectedAmount.toLocaleString()} บาท)` :
                        `⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - ยอดเงินไม่ตรงกัน (สลิป: ${slipAmount.toLocaleString()} บาท / ต้องชำระ: ${expectedAmount.toLocaleString()} บาท)`
                });
                
                return Response.json({ 
                    success: true,
                    message: `อัปโหลดสลิปสำเร็จ แต่ยอดเงินไม่ตรงกัน\nสลิป: ${slipAmount.toLocaleString()} บาท\nต้องชำระ: ${expectedAmount.toLocaleString()} บาท\n\nกรุณารอเจ้าของหอพักตรวจสอบ`,
                    manual_review_required: true,
                    amount_mismatch: true
                });
            }

            // ตรวจสอบบัญชีปลายทาง
            const configs = await base44.asServiceRole.entities.Config.list();
            const getConfigValue = (key) => {
                const config = configs.find(c => c.key === key && !c.branch_id);
                return config?.value || null;
            };

            const expectedAccountNumber = getConfigValue('bank_account_number');
            const expectedPromptPay = getConfigValue('promptpay');
            
            const receiverAccount = slipData.receiver?.account?.value || '';
            const receiverPromptPay = slipData.receiver?.proxy?.value || '';
            
            let accountMatch = false;
            if (expectedAccountNumber && receiverAccount.includes(expectedAccountNumber.replace(/-/g, ''))) {
                accountMatch = true;
            } else if (expectedPromptPay && (receiverPromptPay === expectedPromptPay || receiverAccount.includes(expectedPromptPay))) {
                accountMatch = true;
            }

            if (!accountMatch) {
                // ดึงข้อมูลห้องเพื่อแสดงหมายเลขห้อง
                const rooms = await base44.asServiceRole.entities.Room.list();
                const room = rooms.find(r => r.id === payment.room_id);
                const roomNumber = room?.room_number || 'ไม่ทราบ';
                
                await base44.asServiceRole.entities.Payment.update(paymentId, {
                    payment_slip_url: uploadedSlipUrl,
                    notes: payment.notes ? 
                        `${payment.notes}\n\n⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - โอนเงินไปผิดบัญชี (ควรโอนเข้า ${expectedAccountNumber || expectedPromptPay})` :
                        `⚠️ รอตรวจสอบ: ห้อง ${roomNumber} - โอนเงินไปผิดบัญชี (ควรโอนเข้า ${expectedAccountNumber || expectedPromptPay})`
                });
                
                return Response.json({ 
                    success: true,
                    message: `อัปโหลดสลิปสำเร็จ แต่โอนไปผิดบัญชี\nกรุณารอเจ้าของหอพักตรวจสอบ`,
                    manual_review_required: true,
                    account_mismatch: true
                });
            }

            // ✅ ทุกอย่างถูกต้อง - อัพเดต payment พร้อมบันทึกค่าปรับ
            const updateData = {
                status: 'paid',
                payment_date: slipData.transDate || new Date().toISOString().split('T')[0],
                payment_slip_url: uploadedSlipUrl,
                late_fee_amount: lateFeeAmount,
                total_amount: totalAmountWithLateFee,
                notes: payment.notes ? 
                    `${payment.notes}\n\n✅ ตรวจสอบสลิปอัตโนมัติ: ${slipData.sender?.account?.name?.th || 'N/A'} โอน ${slipAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? ` (รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท)` : ''}` :
                    `✅ ตรวจสอบสลิปอัตโนมัติ: ${slipData.sender?.account?.name?.th || 'N/A'} โอน ${slipAmount.toLocaleString()} บาท${lateFeeAmount > 0 ? ` (รวมค่าปรับ ${lateFeeAmount.toLocaleString()} บาท)` : ''}`
            };
            
            const updatedPayment = await base44.asServiceRole.entities.Payment.update(paymentId, updateData);
            
            console.log('✅ Payment updated successfully:', updatedPayment.id, 'status:', updatedPayment.status);

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