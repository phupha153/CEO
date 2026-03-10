import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

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
            bankAccountNumber: findConfig('bank_account_number') || '-',
            bankAccountName: findConfig('bank_account_name') || '-',
            bankName: findConfig('bank_name') || '-',
            buildingName: findConfig('building_name') || 'ที่พัก'
        };
    } catch (error) {
        console.error('❌ Error fetching FB config:', error);
        return null;
    }
}

async function sendFacebookMessage(base44, pageAccessToken, recipientId, text, imageUrl = null, branchId = null, sentBy = 'system') {
    try {
        // ส่งข้อความ Text ก่อน
        const responseText = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recipient: { id: recipientId },
                message: { text: text },
                messaging_type: 'MESSAGE_TAG',
                tag: 'CONFIRMED_EVENT_UPDATE'
            })
        });
        
        if (!responseText.ok) {
            const errorData = await responseText.json();
            console.error('Facebook API error (Text):', errorData);
            return { success: false, error: errorData };
        }

        // ถัามีรูปภาพ ให้ส่งรูปตามไป
        if (imageUrl) {
            const responseImage = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipient: { id: recipientId },
                    message: {
                        attachment: {
                            type: "image",
                            payload: { url: imageUrl, is_reusable: true }
                        }
                    },
                    messaging_type: 'MESSAGE_TAG',
                    tag: 'CONFIRMED_EVENT_UPDATE'
                })
            });
            if (!responseImage.ok) {
                console.error('Facebook API error (Image):', await responseImage.json());
            }
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
                const message = recipient.message; // ⭐ ใช้ message ที่ caller ส่งมา (ไม่สร้างใหม่)
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
            console.log(`🔍 Processing payment ${payment.id}: tenant_id=${payment.tenant_id}, room_id=${payment.room_id}`);
            
            // ดึงข้อมูล Tenant และ Room
            let tenantsData = await base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id });
            let roomsData = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
            
            if (!Array.isArray(tenantsData)) tenantsData = [tenantsData];
            if (!Array.isArray(roomsData)) roomsData = [roomsData];
            
            const tenant = tenantsData.length > 0 ? tenantsData[0] : null;
            const room = roomsData.length > 0 ? roomsData[0] : null;

            console.log(`👤 Tenant found: ${tenant ? tenant.full_name : 'NONE'}, facebook_user_id: ${tenant?.facebook_user_id || 'NONE'}`);

            if (!tenant) {
                console.log(`❌ Payment ${payment.id}: ไม่พบผู้เช่า (tenant_id=${payment.tenant_id})`);
                results.failed++;
                results.errors.push({ paymentId: payment.id, error: `ไม่พบผู้เช่า ID: ${payment.tenant_id}` });
                continue;
            }
            
            if (!tenant.facebook_user_id) {
                console.log(`❌ Payment ${payment.id}: ผู้เช่า ${tenant.full_name} ยังไม่ได้เชื่อมต่อ Facebook`);
                results.failed++;
                results.errors.push({ paymentId: payment.id, tenantName: tenant.full_name, error: 'ยังไม่ได้เชื่อมต่อ Facebook' });
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

            // ⭐ ไม่สร้างข้อความใหม่ - ใช้ message ที่ส่งมาจาก caller
            // (ส่วนนี้จะถูกข้าม เพราะ passedRecipients มี message มาแล้ว)

            // ⭐ ส่งข้อความที่ส่งมาจาก caller (ไม่สร้างใหม่)
            console.log(`📤 Sending Facebook message (${message.length} chars)...`);
            const sendResult = await sendFacebookMessage(base44, config.pageAccessToken, facebookUserId, message, branchId, user?.email || 'system');
            
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