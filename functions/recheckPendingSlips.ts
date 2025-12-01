import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Cron Job สำหรับตรวจสอบสลิปที่รอการยืนยันซ้ำ (ทุก 15-30 นาที)
Deno.serve(async (req) => {
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

        // ⭐ CRITICAL: ดึง Payment แบบ batch เพื่อป้องกัน JSON truncation
        const BATCH_SIZE = 500;
        let allPayments = [];
        let skip = 0;
        let hasMore = true;
        
        while (hasMore) {
            const batch = await base44.asServiceRole.entities.Payment.filter({}, '-created_date', BATCH_SIZE, skip);
            
            if (Array.isArray(batch) && batch.length > 0) {
                allPayments = allPayments.concat(batch);
                skip += batch.length;
                console.log(`📦 Fetched batch: ${batch.length} payments, total: ${allPayments.length}`);
                
                if (batch.length < BATCH_SIZE) {
                    hasMore = false;
                }
            } else {
                hasMore = false;
            }
            
            // ป้องกัน infinite loop
            if (skip > 50000) {
                console.log('⚠️ Max payments reached, stopping');
                hasMore = false;
            }
        }
        
        console.log(`📋 Total payments fetched: ${allPayments.length}`);

        const pendingRecheckPayments = allPayments.filter(p => 
            p.status === 'pending' && 
            p.payment_slip_url && 
            p.branch_id && // ⭐ ต้องมี branch_id
            p.notes && 
            (p.notes.includes('รอตรวจสอบซ้ำ') || p.notes.includes('รอตรวจสอบ'))
        );

        console.log(`📋 Found ${pendingRecheckPayments.length} payments pending recheck`);

        if (pendingRecheckPayments.length === 0) {
            return Response.json({ 
                success: true, 
                message: 'No pending slips to recheck',
                processed: 0 
            });
        }

        // ดึง Config สำหรับ LINE Token และบัญชีธนาคาร
        const configs = await base44.asServiceRole.entities.Config.list();
        const getConfigValue = (key, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || null;
        };

        // ดึง Tenant ทั้งหมดสำหรับส่ง LINE
        const tenants = await base44.asServiceRole.entities.Tenant.list('-created_date', 5000);

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
                const formData = new FormData();
                formData.append('file', file);
                formData.append('payload', JSON.stringify({ checkDuplicate: true }));

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
                const isSlipValid = slip2goResponse.ok && slip2goData.success && slip2goData.data;
                const isDuplicate = slip2goData.code === '200501' || (slip2goData.message && slip2goData.message.toLowerCase().includes('duplicate'));

                // ⭐ ถ้าเป็น Duplicate - ถือว่าสลิปถูกต้อง (เคยตรวจสอบผ่านแล้ว)
                if (isDuplicate && slip2goData.data) {
                    console.log(`   ⚠️ Slip is duplicated but valid - processing as successful`);
                    // ดำเนินการต่อเหมือนสลิปถูกต้อง
                } else if (!isSlipValid && !isDuplicate) {
                    const retryCount = (payment.notes.match(/ลองครั้งที่/g) || []).length;

                    if (retryCount >= 3) {
                        // ลองเกิน 3 ครั้งแล้ว - ให้ตรวจสอบด้วยตนเอง
                        console.log(`   ❌ Max retries reached (${retryCount}), marking for manual review`);

                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            notes: `${payment.notes}\n\n⚠️ ตรวจสอบไม่สำเร็จหลังลอง ${retryCount + 1} ครั้ง - กรุณาตรวจสอบด้วยตนเอง`
                        });

                        // ไม่ส่ง LINE แจ้งลูกค้า - รอ admin ตรวจสอบเอง

                        failCount++;
                    } else {
                        // ยังลองได้อีก - อัปเดต notes
                        console.log(`   ⏳ Still not found, retry ${retryCount + 1}/3`);

                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            notes: `${payment.notes}\n\n⏳ ลองครั้งที่ ${retryCount + 1}: ยังไม่พบข้อมูล - ${new Date().toISOString()}`
                        });

                        skippedCount++;
                        }
                        continue;
                        }

                        console.log(`   ✅ Slip2Go verification SUCCESS! (isDuplicate: ${isDuplicate})`);

                        // ✅ ตรวจสอบสำเร็จ!
                        const slipData = slip2goData.data;
                        const slipAmount = parseFloat(slipData.amount?.amount || slipData.amount || 0);
                        const expectedAmount = parseFloat(payment.total_amount);
                        const senderName = slipData.sender?.account?.name?.th || slipData.sender?.name || 'N/A';
                        const transDate = slipData.transDate || slipData.dateTime || new Date().toISOString().split('T')[0];

                        console.log(`   💰 Slip Amount: ${slipAmount} บาท`);
                        console.log(`   💰 Expected Amount: ${expectedAmount} บาท`);
                        console.log(`   👤 Sender: ${senderName}`);

                        // เช็คยอดเงิน
                        if (slipAmount < expectedAmount * 0.95) {
                            console.log(`   ⚠️ Amount mismatch: ${slipAmount} < ${expectedAmount * 0.95} (95% of expected)`);
                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        notes: `${payment.notes}\n\n⚠️ ยอดเงินไม่ตรง: สลิป ${slipAmount} บาท / ต้องชำระ ${expectedAmount} บาท`
                    });
                    
                    const tenant = tenants.find(t => t.id === payment.tenant_id);
                    if (tenant?.line_user_id) {
                        await sendLineMessage(base44, tenant.line_user_id, 
                            `⚠️ ยอดเงินไม่ตรง\n\n💰 สลิป: ${slipAmount.toLocaleString()} บาท\n💰 ต้องชำระ: ${expectedAmount.toLocaleString()} บาท\n\nกรุณาติดต่อเจ้าของหอพักค่ะ`,
                            payment.branch_id,
                            configs
                        );
                    }
                    
                    failCount++;
                    continue;
                }

                // เช็คบัญชีปลายทาง
                const expectedAccountNumber = getConfigValue('bank_account_number', payment.branch_id);
                const expectedPromptPay = getConfigValue('promptpay', payment.branch_id);
                const receiverAccount = slipData.receiver?.account?.value || '';
                const receiverPromptPay = slipData.receiver?.proxy?.value || '';

                let accountMatch = false;
                if (expectedAccountNumber && receiverAccount.includes(expectedAccountNumber.replace(/-/g, ''))) {
                    accountMatch = true;
                } else if (expectedPromptPay && (receiverPromptPay === expectedPromptPay || receiverAccount.includes(expectedPromptPay))) {
                    accountMatch = true;
                }

                if (!accountMatch && (expectedAccountNumber || expectedPromptPay)) {
                    console.log(`   ⚠️ Account mismatch`);
                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        notes: `${payment.notes}\n\n⚠️ โอนไปผิดบัญชี - กรุณาตรวจสอบด้วยตนเอง`
                    });
                    
                    failCount++;
                    continue;
                }

                // ✅ ทุกอย่างถูกต้อง - อัปเดตเป็น paid
                await base44.asServiceRole.entities.Payment.update(payment.id, {
                    status: 'paid',
                    payment_date: transDate.split('T')[0],
                    notes: `${payment.notes}\n\n✅ ตรวจสอบสลิปอัตโนมัติสำเร็จ (Cron): ${senderName} โอน ${slipAmount.toLocaleString()} บาท`
                });

                console.log(`   ✅ Payment updated to PAID`);

                // ส่งใบเสร็จให้ลูกค้าผ่าน LINE
                const tenant = tenants.find(t => t.id === payment.tenant_id);
                if (tenant?.line_user_id) {
                    try {
                        // เรียก sendReceipt function
                        const receiptResponse = await base44.asServiceRole.functions.invoke('sendReceipt', { 
                            paymentId: payment.id 
                        });
                        
                        if (receiptResponse.data?.success) {
                            console.log(`   📄 Receipt sent successfully`);
                        } else {
                            // Fallback ส่งข้อความธรรมดา
                            await sendLineMessage(base44, tenant.line_user_id, 
                                `✅ ตรวจสอบสลิปสำเร็จ!\n\n💰 ยอดเงิน: ${slipAmount.toLocaleString()} บาท\n📅 วันที่: ${transDate.split('T')[0]}\n\nขอบคุณที่ชำระเงินค่ะ 🙏`,
                                payment.branch_id,
                                configs
                            );
                        }
                    } catch (receiptError) {
                        console.error(`   ⚠️ Failed to send receipt:`, receiptError.message);
                        // Fallback
                        await sendLineMessage(base44, tenant.line_user_id, 
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

        return Response.json({ 
            success: true, 
            message: 'Recheck completed',
            processed: pendingRecheckPayments.length,
            successCount,
            failCount,
            skippedCount
        });

    } catch (error) {
        console.error('❌ Cron Job Error:', error);
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