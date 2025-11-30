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

async function getLineToken(base44, branchId = null) {
    try {
        const configs = await base44.asServiceRole.entities.Config.list();
        
        // ⭐ ใช้ token เฉพาะสาขาเท่านั้น (ไม่ fallback ไป global หรือ env)
        
        // 1. ถ้ามี branchId ให้หา token เฉพาะสาขา
        if (branchId) {
            const branchToken = configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branchId);
            if (branchToken?.value?.trim()) {
                console.log(`✅ Using branch-specific token for branch: ${branchId.substring(0, 8)}...`);
                return branchToken.value.trim();
            }
            
            // ⭐ ไม่มี token ของสาขานี้ = return null เลย
            console.warn(`⚠️ No LINE token found for branch: ${branchId.substring(0, 8)}...`);
            return null;
        }
        
        // 2. ถ้าไม่ได้ระบุ branchId ให้หา global token จาก Config
        const globalToken = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
        if (globalToken?.value?.trim()) {
            console.log('✅ Using global token from Config database');
            return globalToken.value.trim();
        }
        
        console.warn('⚠️ No LINE token found');
        return null;
    } catch (error) {
        console.error('❌ Error fetching LINE token:', error);
        return null;
    }
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { paymentId, branch_id } = await req.json();

        // ⭐ Helper function สำหรับดึงข้อมูลแบบ pagination (รองรับมากกว่า 10,000 รายการ)
        async function fetchAllWithPagination(entity, batchSize = 5000) {
            let allData = [];
            let skip = 0;
            let hasMore = true;
            
            while (hasMore) {
                const batch = await entity.list('-created_date', batchSize, skip);
                if (batch.length === 0) {
                    hasMore = false;
                } else {
                    allData = allData.concat(batch);
                    skip += batch.length;
                    if (batch.length < batchSize) {
                        hasMore = false;
                    }
                }
                console.log(`📊 Fetched ${allData.length} records...`);
            }
            return allData;
        }

        // ⭐ ดึงข้อมูลทั้งหมดแบบ pagination
        console.log('📊 Fetching all data upfront...');
        const [configs, allTenants, allRooms, allPayments] = await Promise.all([
            base44.asServiceRole.entities.Config.list(),
            fetchAllWithPagination(base44.asServiceRole.entities.Tenant),
            fetchAllWithPagination(base44.asServiceRole.entities.Room),
            fetchAllWithPagination(base44.asServiceRole.entities.Payment)
        ]);
        
        console.log(`✅ Loaded: ${allTenants.length} tenants, ${allRooms.length} rooms, ${allPayments.length} payments`);

        // สร้าง Map สำหรับ lookup เร็วขึ้น O(1) แทน O(n)
        const tenantMap = new Map(allTenants.map(t => [t.id, t]));
        const roomMap = new Map(allRooms.map(r => [r.id, r]));
        
        // Helper function เพื่อดึง config ตาม branchId
        const getConfigValue = (key, branchId, defaultValue = '') => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig?.value) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        let paymentsToSend = [];
        
        if (paymentId) {
            const targetPayment = allPayments.find(p => p.id === paymentId);
            if (targetPayment && (targetPayment.status === 'pending' || targetPayment.status === 'overdue')) {
                paymentsToSend.push(targetPayment);
            }
        } else {
            // กรองตาม branch_id ถ้าระบุ และ ⭐ ข้ามห้องที่ส่งไปแล้ว (มี bill_sent_date)
            paymentsToSend = allPayments.filter(p => {
                const statusMatch = p.status === 'pending' || p.status === 'overdue';
                const branchMatch = !branch_id || p.branch_id === branch_id;
                const notSentYet = !p.bill_sent_date; // ⭐ ข้ามถ้าส่งไปแล้ว
                return statusMatch && branchMatch && notSentYet;
            });
        }

        if (paymentsToSend.length === 0) {
            return Response.json({ 
                success: false,
                message: 'ไม่มีรายการที่ต้องส่ง' 
            });
        }

        console.log(`📤 Processing ${paymentsToSend.length} payments...`);

        // ✅ เตรียมข้อมูลสำหรับ batch sending (ใช้ Map lookup แทน API call)
        const recipients = [];

        for (const payment of paymentsToSend) {
            // ⭐ ใช้ Map lookup แทนการเรียก API ทีละตัว
            const tenant = tenantMap.get(payment.tenant_id);
            const room = roomMap.get(payment.room_id);

            if (!tenant || !tenant.line_user_id) {
                console.log(`⚠️ Skipping payment ${payment.id}: No LINE User ID`);
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

            // ใช้ due_date จาก payment โดยตรง (ที่คำนวณจาก pay_day ของสาขาตอนสร้างบิลแล้ว)
            let dueDateStr = 'ไม่ระบุ';
            if (payment.due_date) {
                dueDateStr = new Date(payment.due_date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            }

            // ⭐ ดึง config ตาม branchId ของ payment
            const branchId = payment.branch_id;
            const bankAccountNumber = getConfigValue('bank_account_number', branchId, '0722835522');
            const bankAccountName = getConfigValue('bank_account_name', branchId, 'ธนานนท์ พรมพักตร์');
            const bankName = getConfigValue('bank_name', branchId, 'กสิกร');
            const buildingName = getConfigValue('building_name', branchId, 'W RESIDENTS');

            let message = `🏠 ${buildingName} - แจ้งเตือนค่าเช่า\n\n`;
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
            if (payment.common_fee_amount > 0) {
                message += `🏢 ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
            }
            if (payment.parking_fee_amount > 0) {
                message += `🚗 ค่าที่จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บาท\n`;
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
            
            message += `💳 โอนเงินได้ที่: ${bankName} ${bankAccountNumber} (${bankAccountName})\n\n`;

            // ⭐ ใส่ลิงก์รูปใบแจ้งหนี้ (ถ้ามี) - ถ้าไม่มีจะสร้างทีหลังก่อนส่ง LINE และ replace placeholder
            if (payment.invoice_image_url) {
                message += `📄 ดูใบแจ้งหนี้: ${payment.invoice_image_url}\n\n`;
            } else {
                message += `{{INVOICE_IMAGE_PLACEHOLDER}}\n`;
            }
            message += `📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\n`;
            message += `ขอบคุณค่ะ 🙏`;

            recipients.push({
                lineUserId: tenant.line_user_id,
                message: message,
                metadata: {
                    paymentId: payment.id,
                    tenantId: tenant.id,
                    tenantName: tenant.full_name,
                    roomNumber: room?.room_number,
                    branchId: payment.branch_id
                }
            });
        }

        if (recipients.length === 0) {
            return Response.json({
                success: false,
                message: 'ไม่มีผู้รับที่มี LINE User ID'
            });
        }

        // ⭐ สร้างรูปใบแจ้งหนี้แบบ sequential (ทีละใบ) ก่อนส่ง LINE
        console.log(`🖼️ Generating invoice images for ${recipients.length} payments...`);
        let imageSuccessCount = 0;
        let imageFailCount = 0;
        let imageSkipCount = 0;
        
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            const payment = allPayments.find(p => p.id === recipient.metadata.paymentId);

            // ถ้ามีรูปอยู่แล้ว = ใส่ลิงก์เลย (แทน placeholder)
            if (payment?.invoice_image_url) {
                console.log(`[${i + 1}/${recipients.length}] Room ${recipient.metadata.roomNumber}: มีรูปอยู่แล้ว`);
                recipient.message = recipient.message.replace(
                    '{{INVOICE_IMAGE_PLACEHOLDER}}\n',
                    `📄 ดูใบแจ้งหนี้: ${payment.invoice_image_url}\n\n`
                );
                imageSkipCount++;
                continue;
            }

            // ถ้ายังไม่มีรูป = สร้างใหม่
            try {
                console.log(`[${i + 1}/${recipients.length}] Room ${recipient.metadata.roomNumber}: กำลังสร้างรูป...`);
                const startTime = Date.now();
                
                const invoiceResult = await base44.asServiceRole.functions.invoke('generateInvoiceImage', {
                    paymentId: payment.id
                });
                
                const elapsed = Date.now() - startTime;
                console.log(`[${i + 1}/${recipients.length}] generateInvoiceImage took ${elapsed}ms`);
                
                if (invoiceResult.data?.success && invoiceResult.data?.invoice_image_url) {
                    // อัปเดต message ให้มีลิงก์รูป (แทนที่ placeholder)
                    const imageUrl = invoiceResult.data.invoice_image_url;
                    recipient.message = recipient.message.replace(
                        '{{INVOICE_IMAGE_PLACEHOLDER}}\n',
                        `📄 ดูใบแจ้งหนี้: ${imageUrl}\n\n`
                    );
                    console.log(`✅ [${i + 1}/${recipients.length}] Room ${recipient.metadata.roomNumber}: สร้างรูปสำเร็จ (${elapsed}ms)`);
                    imageSuccessCount++;
                } else {
                    // ลบ placeholder ถ้าสร้างรูปไม่สำเร็จ
                    console.error(`❌ [${i + 1}/${recipients.length}] Room ${recipient.metadata.roomNumber}: สร้างรูปล้มเหลว - ${invoiceResult.data?.error || 'Unknown error'}`);
                    recipient.message = recipient.message.replace('{{INVOICE_IMAGE_PLACEHOLDER}}\n', '');
                    imageFailCount++;
                }
            } catch (invoiceError) {
                console.error(`❌ [${i + 1}/${recipients.length}] Room ${recipient.metadata.roomNumber}: Exception - ${invoiceError.message}`);
                // ลบ placeholder ถ้าเกิด error
                recipient.message = recipient.message.replace('{{INVOICE_IMAGE_PLACEHOLDER}}\n', '');
                imageFailCount++;
            }

            // รอ 2 วินาทีก่อนสร้างรูปถัดไป (หลีกเลี่ยง rate limit)
            if (i < recipients.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`📊 Image generation summary: สำเร็จ ${imageSuccessCount}, ล้มเหลว ${imageFailCount}, มีอยู่แล้ว ${imageSkipCount}`);
        
        // ⭐ ลบ placeholder ที่เหลือทั้งหมด (เผื่อมี edge case)
        for (const recipient of recipients) {
            recipient.message = recipient.message.replace('{{INVOICE_IMAGE_PLACEHOLDER}}\n', '');
        }

        console.log(`📤 Sending payment reminders to ${recipients.length} recipients...`);

        // ⭐ อัปเดต bill_sent_date แบบ bulk (ลด API calls)
        const paymentIdsToUpdate = recipients.map(r => r.metadata.paymentId);
        const now = new Date().toISOString();
        
        // อัปเดตทีละ batch เพื่อไม่ให้ timeout
        const updateBatchSize = 50;
        for (let i = 0; i < paymentIdsToUpdate.length; i += updateBatchSize) {
            const batch = paymentIdsToUpdate.slice(i, i + updateBatchSize);
            await Promise.all(
                batch.map(id => 
                    base44.asServiceRole.entities.Payment.update(id, { bill_sent_date: now })
                        .catch(err => console.warn(`⚠️ Failed to update ${id}:`, err.message))
                )
            );
            console.log(`✅ Updated bill_sent_date: ${Math.min(i + updateBatchSize, paymentIdsToUpdate.length)}/${paymentIdsToUpdate.length}`);
        }

        // ✅ ใช้ batch sending - ปรับให้รองรับจำนวนมาก
        const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
            recipients: recipients,
            options: {
                batchSize: 10,
                delayBetweenBatches: 2000,
                delayBetweenMessages: 200,
                retryAttempts: 2
            }
        });

        const result = batchResult.data;
        
        // ⭐ นับจำนวนห้องที่ข้ามเพราะส่งไปแล้ว
        const totalPendingOverdue = allPayments.filter(p => {
            const statusMatch = p.status === 'pending' || p.status === 'overdue';
            const branchMatch = !branch_id || p.branch_id === branch_id;
            return statusMatch && branchMatch;
        }).length;
        const skippedCount = totalPendingOverdue - recipients.length;

        return Response.json({ 
            success: true,
            message: `ส่งข้อความสำเร็จ ${result.success}/${result.total} รายการ`,
            sent: result.success,
            failed: result.failed,
            skipped: skippedCount,
            total: recipients.length,
            errors: result.errors
        });

    } catch (error) {
        console.error('Error in sendPaymentReminder:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});