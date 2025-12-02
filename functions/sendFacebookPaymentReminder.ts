import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

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
            
            if (position === 1 && digit === 1) {
                result += 'สิบ';
            } else if (position === 1 && digit === 2) {
                result += 'ยี่สิบ';
            } else if (position === 0 && digit === 1 && len > 1) {
                result += 'เอ็ด';
            } else {
                result += numbers[digit] + positions[position];
            }
        }
        
        return result;
    }
    
    let text = convertInteger(integerPart) + 'บาท';
    
    if (decimalPart > 0) {
        text += convertInteger(decimalPart) + 'สตางค์';
    } else {
        text += 'ถ้วน';
    }
    
    return text;
}

async function getFacebookConfig(base44, branchId = null) {
    try {
        const configs = await base44.asServiceRole.entities.Config.list();
        
        const findConfig = (key) => {
            if (branchId) {
                const branchVal = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchVal?.value?.trim()) return branchVal.value.trim();
            }
            const globalVal = configs.find(c => c.key === key && !c.branch_id);
            return globalVal?.value?.trim() || null;
        };

        return {
            pageAccessToken: findConfig('facebook_page_access_token'),
            bankAccountNumber: findConfig('bank_account_number') || '0722835522',
            bankAccountName: findConfig('bank_account_name') || 'ธนานนท์ พรมพักตร์',
            bankName: findConfig('bank_name') || 'กสิกร',
            buildingName: findConfig('building_name') || 'W RESIDENTS'
        };
    } catch (error) {
        console.error('❌ Error fetching FB config:', error);
        return null;
    }
}

async function sendFacebookMessage(base44, pageAccessToken, recipientId, text, branchId = null, sentBy = 'system') {
    try {
        // ⭐ ใช้ MESSAGE_TAG เพื่อส่งนอกช่วง 24 ชม. (แจ้งเตือนการชำระเงิน)
        const response = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text: text },
                messaging_type: 'MESSAGE_TAG',
                tag: 'CONFIRMED_EVENT_UPDATE'
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('Facebook API error:', errorData);
            return { success: false, error: errorData };
        }

        // ⭐⭐⭐ บันทึกข้อความขาออกลง FacebookMessage entity (เหมือน LINE)
        try {
            await base44.asServiceRole.entities.FacebookMessage.create({
                branch_id: branchId,
                tenant_id: null,
                facebook_user_id: recipientId,
                facebook_display_name: null,
                facebook_picture_url: null,
                direction: 'outgoing',
                message_type: 'text',
                content: text,
                is_read: true,
                sent_by: sentBy
            });
            console.log('✅ Saved outgoing Facebook message to FacebookMessage entity');
        } catch (saveError) {
            console.error('❌ Failed to save outgoing Facebook message:', saveError);
        }
        
        return { success: true };
    } catch (error) {
        console.error('Error sending FB message:', error);
        return { success: false, error: error.message };
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { paymentId, recipients: passedRecipients } = body;

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // ⭐ ถ้ามี recipients ส่งมาจาก sendPaymentReminder ให้ใช้เลย
        if (passedRecipients && Array.isArray(passedRecipients) && passedRecipients.length > 0) {
            console.log(`📤 Processing ${passedRecipients.length} Facebook recipients from caller...`);
            
            for (const recipient of passedRecipients) {
                const facebookUserId = recipient.facebookUserId;
                const message = recipient.message;
                const branchId = recipient.metadata?.branchId;
                
                console.log(`📋 Recipient: facebookUserId=${facebookUserId}, branchId=${branchId}, messageLength=${message?.length || 0}`);
                
                if (!facebookUserId || !message) {
                    console.log(`⚠️ Skipping: missing facebookUserId or message`);
                    results.failed++;
                    results.errors.push({ error: 'Missing facebookUserId or message' });
                    continue;
                }
                
                // ดึง config สำหรับสาขา
                const config = await getFacebookConfig(base44, branchId);
                console.log(`🔑 Config: hasToken=${!!config?.pageAccessToken}, branch=${branchId}`);
                
                if (!config?.pageAccessToken) {
                    console.error(`❌ No Facebook token for branch: ${branchId}`);
                    results.failed++;
                    results.errors.push({ paymentId: recipient.metadata?.paymentId, error: 'No Facebook token' });
                    continue;
                }

                // ส่งข้อความ
                console.log(`📤 Sending to Facebook: ${facebookUserId}`);
                const sendResult = await sendFacebookMessage(base44, config.pageAccessToken, facebookUserId, message, branchId, user?.email || 'system');
                
                console.log(`📬 Send result:`, JSON.stringify(sendResult));
                
                if (sendResult.success) {
                    results.success++;
                    console.log(`✅ Sent to Facebook ${facebookUserId}`);
                } else {
                    results.failed++;
                    results.errors.push({ paymentId: recipient.metadata?.paymentId, error: sendResult.error });
                    console.log(`❌ Failed to send to ${facebookUserId}:`, sendResult.error);
                }

                // หน่วงเวลาเพื่อป้องกัน rate limit
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            return Response.json({ 
                success: results.success > 0,
                message: `ส่งข้อความ Facebook สำเร็จ ${results.success}/${results.success + results.failed} รายการ`,
                successCount: results.success,
                failCount: results.failed,
                errors: results.errors
            });
        }

        // ⭐ Fallback: ถ้าไม่มี recipients ให้ใช้ paymentId ดึงข้อมูลเอง
        let paymentsToSend = [];
        
        if (paymentId) {
            let payments = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
            if (!Array.isArray(payments)) payments = [payments];
            const targetPayment = payments.length > 0 ? payments[0] : null;
            if (targetPayment && (targetPayment.status === 'pending' || targetPayment.status === 'overdue')) {
                paymentsToSend.push(targetPayment);
            }
        } else {
            let allPayments = await base44.asServiceRole.entities.Payment.list();
            if (!Array.isArray(allPayments)) allPayments = [];
            paymentsToSend = allPayments.filter(p => p.status === 'pending' || p.status === 'overdue');
        }

        if (paymentsToSend.length === 0) {
            return Response.json({ 
                success: false,
                message: 'ไม่มีรายการที่ต้องส่ง' 
            });
        }

        for (const payment of paymentsToSend) {
            // ดึงข้อมูล Tenant และ Room
            let tenantsData = await base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id });
            let roomsData = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
            
            if (!Array.isArray(tenantsData)) tenantsData = [tenantsData];
            if (!Array.isArray(roomsData)) roomsData = [roomsData];
            
            const tenant = tenantsData.length > 0 ? tenantsData[0] : null;
            const room = roomsData.length > 0 ? roomsData[0] : null;

            if (!tenant || !tenant.facebook_user_id) {
                console.log(`⚠️ Skipping payment ${payment.id}: No Facebook User ID`);
                continue;
            }

            // ดึง config สำหรับสาขา
            const config = await getFacebookConfig(base44, payment.branch_id);
            if (!config?.pageAccessToken) {
                console.error(`❌ No Facebook token for branch: ${payment.branch_id}`);
                results.failed++;
                results.errors.push({ paymentId: payment.id, error: 'No Facebook token' });
                continue;
            }

            // คำนวณจำนวนวันที่เกินกำหนด
            let daysOverdue = 0;
            let statusText = 'รอชำระ';
            if (payment.due_date) {
                const dueDate = new Date(payment.due_date);
                const today = new Date();
                const diffTime = today.getTime() - dueDate.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays > 0) {
                    daysOverdue = diffDays;
                    statusText = `เกินกำหนด ${daysOverdue} วัน`;
                }
            }

            let dueDateStr = 'ไม่ระบุ';
            if (payment.due_date) {
                dueDateStr = new Date(payment.due_date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }

            let message = `🏠 ${config.buildingName} - แจ้งเตือนค่าเช่า\n\n`;
            message += `สวัสดีคุณ ${tenant.full_name}\n`;
            message += `ห้อง ${room?.room_number || 'N/A'}\n\n`;
            message += `📋 รายละเอียดค่าใช้จ่าย:\n`;
            message += `━━━━━━━━━━━━━━━━━━━━\n`;
            
            if (payment.rent_amount > 0) {
                message += `🏠 ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
            }
            if (payment.electricity_amount > 0) {
                message += `⚡ ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
            }
            if (payment.water_amount > 0) {
                message += `💧 ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
            }
            if (payment.internet_amount > 0) {
                message += `📡 ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
            }
            if (payment.other_amount > 0) {
                message += `📌 ค่าใช้จ่ายอื่นๆ: ${payment.other_amount.toLocaleString()} บาท\n`;
            }
            
            message += `━━━━━━━━━━━━━━━━━━━━\n`;
            message += `💰 รวมทั้งสิ้น: ${payment.total_amount.toLocaleString()} บาท\n`;
            message += `(${numberToThaiText(payment.total_amount)})\n\n`;
            message += `📅 ครบกำหนดชำระ: ${dueDateStr}\n`;
            
            if (daysOverdue > 0) {
                message += `⚠️ สถานะ: ${statusText}\n\n`;
            } else {
                message += `✅ สถานะ: ${statusText}\n\n`;
            }
            
            message += `💳 โอนเงินได้ที่:\n`;
            message += `ธนาคาร: ${config.bankName}\n`;
            message += `เลขบัญชี: ${config.bankAccountNumber}\n`;
            message += `ชื่อบัญชี: ${config.bankAccountName}\n\n`;

            // สร้างรูปใบแจ้งหนี้
            let invoiceImageUrl = payment.invoice_image_url;
            if (!invoiceImageUrl) {
                try {
                    console.log(`🖼️ Generating invoice image for payment ${payment.id}...`);
                    const invoiceResult = await base44.asServiceRole.functions.invoke('generateInvoiceImage', {
                        paymentId: payment.id
                    });
                    if (invoiceResult.data?.success && invoiceResult.data?.invoice_image_url) {
                        invoiceImageUrl = invoiceResult.data.invoice_image_url;
                    }
                } catch (invoiceError) {
                    console.error(`❌ Error generating invoice image:`, invoiceError);
                }
            }

            if (invoiceImageUrl) {
                message += `📄 ดูใบแจ้งหนี้: ${invoiceImageUrl}\n\n`;
            }

            message += `📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\n`;
            message += `ขอบคุณค่ะ 🙏`;

            // ส่งข้อความ (ส่ง base44 และ branchId เพื่อบันทึกข้อความ)
            const sendResult = await sendFacebookMessage(base44, config.pageAccessToken, tenant.facebook_user_id, message, payment.branch_id, user?.email || 'system');
            
            if (sendResult.success) {
                results.success++;
                console.log(`✅ Sent to ${tenant.full_name} (${tenant.facebook_user_id})`);
                
                // ⭐ อัปเดต bill_sent_date (เหมือน LINE)
                try {
                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        bill_sent_date: new Date().toISOString()
                    });
                } catch (updateErr) {
                    console.warn(`⚠️ Failed to update bill_sent_date:`, updateErr.message);
                }
            } else {
                results.failed++;
                results.errors.push({ paymentId: payment.id, tenantName: tenant.full_name, error: sendResult.error });
            }

            // หน่วงเวลาเพื่อป้องกัน rate limit
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        return Response.json({ 
            success: true,
            message: `ส่งข้อความ Facebook สำเร็จ ${results.success}/${results.success + results.failed} รายการ`,
            successCount: results.success,
            failCount: results.failed,
            errors: results.errors
        });

    } catch (error) {
        console.error('Error in sendFacebookPaymentReminder:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});