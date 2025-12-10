import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// ⭐ ฟังก์ชันสร้าง hash จากข้อมูลบิล เพื่อตรวจจับการเปลี่ยนแปลง
function generatePaymentHash(payment) {
    const dataToHash = {
        rent_amount: payment.rent_amount || 0,
        water_units: payment.water_units || 0,
        water_amount: payment.water_amount || 0,
        electricity_units: payment.electricity_units || 0,
        electricity_amount: payment.electricity_amount || 0,
        internet_amount: payment.internet_amount || 0,
        common_fee_amount: payment.common_fee_amount || 0,
        parking_fee_amount: payment.parking_fee_amount || 0,
        other_amount: payment.other_amount || 0,
        total_amount: payment.total_amount || 0,
        due_date: payment.due_date || ''
    };
    const jsonStr = JSON.stringify(dataToHash);
    return btoa(jsonStr).substring(0, 32);
}

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

        const { paymentId, branch_id, template, customMessage } = await req.json();

        // ⭐ ดึงข้อมูลตาม branch_id หรือ payment_id (ลด API calls)
        console.log('📊 Fetching data...');
        
        let allPayments = [];
        let allTenants = [];
        let allRooms = [];
        let configs = [];
        
        if (paymentId) {
            // ถ้าระบุ paymentId = ดึงเฉพาะ payment นั้น
            const [paymentResults, configResults] = await Promise.all([
                base44.asServiceRole.entities.Payment.filter({ id: paymentId }),
                base44.asServiceRole.entities.Config.list()
            ]);
            
            const payment = Array.isArray(paymentResults) ? paymentResults[0] : paymentResults;
            allPayments = payment ? [payment] : [];
            configs = configResults;
            
            if (payment) {
                // ดึงเฉพาะ tenant และ room ที่เกี่ยวข้อง
                const [tenantResults, roomResults] = await Promise.all([
                    payment.tenant_id ? base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id }) : Promise.resolve([]),
                    payment.room_id ? base44.asServiceRole.entities.Room.filter({ id: payment.room_id }) : Promise.resolve([])
                ]);
                
                const tenant = Array.isArray(tenantResults) ? tenantResults[0] : tenantResults;
                const room = Array.isArray(roomResults) ? roomResults[0] : roomResults;
                
                allTenants = tenant ? [tenant] : [];
                allRooms = room ? [room] : [];
            }
        } else if (branch_id) {
            // ดึงเฉพาะ branch นั้น และกรองเฉพาะที่ยังไม่ส่ง
            const [configResults, tenantResults, roomResults] = await Promise.all([
                base44.asServiceRole.entities.Config.list(),
                base44.asServiceRole.entities.Tenant.filter({ branch_id }),
                base44.asServiceRole.entities.Room.filter({ branch_id })
            ]);
            
            configs = configResults;
            allTenants = Array.isArray(tenantResults) ? tenantResults : [];
            allRooms = Array.isArray(roomResults) ? roomResults : [];
            
            // ⭐ ดึง pending และ overdue ที่ยังไม่ส่ง (bill_sent_date = null)
            const [pendingResults, overdueResults] = await Promise.all([
                base44.asServiceRole.entities.Payment.filter({ branch_id, status: 'pending' }),
                base44.asServiceRole.entities.Payment.filter({ branch_id, status: 'overdue' })
            ]);
            
            const pending = Array.isArray(pendingResults) ? pendingResults : [];
            const overdue = Array.isArray(overdueResults) ? overdueResults : [];
            
            // ⭐ กรองเฉพาะที่ยังไม่มี bill_sent_date
            allPayments = [...pending, ...overdue].filter(p => !p.bill_sent_date);
        } else {
            // ไม่แนะนำ - ส่งทุกสาขา (จะช้ามาก)
            return Response.json({
                success: false,
                message: 'กรุณาระบุ branch_id หรือ paymentId'
            }, { status: 400 });
        }
        
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

        // ใช้ payments ที่ดึงมาแล้ว (กรองตาม branch_id หรือ paymentId ตั้งแต่ตอนดึงแล้ว)
        let paymentsToSend = allPayments;

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

            if (!tenant) {
                console.log(`⚠️ Skipping payment ${payment.id}: No tenant found`);
                continue;
            }

            // ⭐ ส่งผ่าน LINE หรือ Facebook ตามที่ผู้เช่าเชื่อมต่อ
            const hasLineOrFacebook = tenant.line_user_id || tenant.facebook_user_id;
            
            if (!hasLineOrFacebook) {
                console.log(`⚠️ Skipping payment ${payment.id}: No LINE or Facebook connection`);
                continue;
            }

            // คำนวณจำนวนวันที่เกินกำหนด
            let daysOverdue = 0;
            let statusText = 'รอชำระ';
            if (payment.due_date) {
                const dueDate = new Date(payment.due_date);
                dueDate.setHours(0, 0, 0, 0);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

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

            // ถ้ามี customMessage ให้ใช้ข้อความที่ระบุจาก dialog
            let message;
            if (customMessage && customMessage.trim()) {
                message = customMessage.trim();
                // เพิ่มข้อมูลบัญชีธนาคารต่อท้าย
                message += `\n\n💳 โอนเงินได้ที่: ${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}`;
            } else {
                // ⭐ สร้างข้อความตาม template parameter
                const roomNum = room?.room_number || 'N/A';
                const amount = (payment.total_amount || 0).toLocaleString();
                
                // ⭐ ใช้ late_fee_amount จากบิล (ถูกอัปเดตโดย sendOverduePaymentNotifications)
                const lateFee = payment.late_fee_amount || 0;
                
                // ⚠️ total_amount รวมค่าปรับแล้ว ต้องลบออกเพื่อแสดงยอดเดิม
                const originalAmount = payment.total_amount - lateFee;
                const totalWithLateFee = payment.total_amount;
                
                // ⭐ สร้างข้อความตาม template
                if (template === 'overdue') {
                    // ข้อความเกินกำหนด
                    message = `🔴 แจ้งเตือนเกินกำหนดชำระ\n\n`;
                    message += `${buildingName}\n`;
                    message += `คุณ ${tenant.full_name} ห้อง ${roomNum}\n`;
                    message += `💰 ยอดเงิน: ${originalAmount.toLocaleString()} บาท`;
                    if (lateFee > 0) {
                        message += `\n⚠️ ค่าปรับล่าช้า: +${lateFee.toLocaleString()} บาท`;
                    }
                    message += `\n💰 รวมทั้งสิ้น: ${totalWithLateFee.toLocaleString()} บาท`;
                    message += `\nเกินกำหนดมาแล้ว: ${daysOverdue} วัน\n\n`;
                    message += `กรุณาชำระโดยด่วนค่ะ${lateFee > 0 ? ' เพื่อหลีกเลี่ยงค่าปรับเพิ่มเติม' : ''}\n\n`;
                    message += `💳 โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
                    message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
                } else if (template === 'due_date') {
                    // ข้อความครบกำหนด - สั้นกระชับ
                    message = `📅 วันนี้ครบกำหนดชำระค่าเช่า\n\n`;
                    message += `${buildingName}\n`;
                    message += `คุณ ${tenant.full_name} ห้อง ${roomNum}\n`;
                    message += `💰 ยอดชำระ: ${amount} บาท\n\n`;
                    
                    const lateFeePerDayConfig = getConfigValue('late_payment_fee_per_day', branchId, '0');
                    const feePerDay = parseFloat(lateFeePerDayConfig);
                    if (!isNaN(feePerDay) && feePerDay > 0) {
                        message += `⚠️ หากชำระหลังวันนี้ มีค่าปรับ ${feePerDay} บาท/วัน\n\n`;
                    }
                    
                    message += `💳 โอนเงินได้ที่:\n`;
                    message += `${bankName} ${bankAccountNumber}\n`;
                    message += `ชื่อ: ${bankAccountName}\n\n`;
                    message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
                } else {
                    // ข้อความล่วงหน้า (advance) - แบบสั้นกระชับเหมือน sendAdvanceReminders
                    const advanceDays = parseInt(getConfigValue('bill_advance_notice_days', branchId, '3'));
                    
                    message = `⚠️ แจ้งเตือนล่วงหน้า\n\n`;
                    message += `🏠 ${buildingName}\n`;
                    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                    message += `สวัสดีคุณ ${tenant.full_name} ห้อง ${roomNum}\n\n`;
                    message += `📅 อีก ${advanceDays} วัน จะถึงวันครบกำหนดชำระ (${dueDateStr})\n\n`;
                    message += `💰 ยอดชำระ: ${payment.total_amount.toLocaleString()} บาท\n\n`;
                    message += `💳 โอนเงินได้ที่:\n`;
                    message += `ธนาคาร: ${bankName}\n`;
                    message += `เลขบัญชี: ${bankAccountNumber}\n`;
                    message += `ชื่อบัญชี: ${bankAccountName}\n\n`;
                }
            }

            // ⭐ สร้างและใส่ลิงก์ใบแจ้งหนี้เฉพาะกรณี 'advance' เท่านั้น
            // กรณี 'due_date' และ 'overdue' ส่งแค่เลขบัญชีธนาคาร
            const shouldIncludeInvoice = template === 'advance';
            
            let invoiceImageUrl = null;
            
            if (shouldIncludeInvoice) {
                invoiceImageUrl = payment.invoice_image_url || null;
                const currentHash = generatePaymentHash(payment);
                const savedHash = payment.invoice_data_hash || '';

                let needsRegenerate = false;
                let needsHashUpdate = false;

                if (!invoiceImageUrl) {
                    needsRegenerate = true;
                } else if (!savedHash) {
                    needsHashUpdate = true;
                    console.log(`📝 Payment ${payment.id}: Has image but no hash - will save hash without regenerating`);
                } else if (currentHash !== savedHash) {
                    needsRegenerate = true;
                }

                if (needsRegenerate) {
                    const reason = !invoiceImageUrl ? 'ยังไม่มีรูป' : 'บิลถูกแก้ไข (hash mismatch)';
                    console.log(`🖼️ Generating invoice image for payment ${payment.id} (${reason})...`);
                    console.log(`   Current hash: ${currentHash}, Saved hash: ${savedHash || 'none'}`);

                    try {
                        const invoiceResult = await base44.asServiceRole.functions.invoke('generateInvoiceImage', {
                            paymentId: payment.id,
                            forceRegenerate: true
                        });
                        if (invoiceResult.data?.success && invoiceResult.data?.invoice_image_url) {
                            invoiceImageUrl = invoiceResult.data.invoice_image_url;
                            console.log(`✅ Invoice image generated: ${invoiceImageUrl}`);
                        } else {
                            console.error(`❌ Failed to generate invoice image: ${invoiceResult.data?.error || 'Unknown error'}`);
                        }
                    } catch (invoiceError) {
                        console.error(`❌ Error generating invoice image:`, invoiceError.message);
                    }
                } else if (needsHashUpdate) {
                    try {
                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            invoice_data_hash: currentHash
                        });
                        console.log(`✅ Payment ${payment.id}: Hash saved (${currentHash})`);
                    } catch (hashError) {
                        console.error(`⚠️ Failed to save hash:`, hashError.message);
                    }
                } else {
                    console.log(`✅ Using existing invoice image for payment ${payment.id} (hash matched)`);
                }
            }
            
            // เพิ่มลิงก์ใบแจ้งหนี้เฉพาะ template 'advance'
            if (shouldIncludeInvoice && invoiceImageUrl) {
                message += `\n\n📄 ดูใบแจ้งหนี้: ${invoiceImageUrl}`;
            }
            
            // เพิ่มข้อความส่งสลิปเฉพาะกรณีที่ไม่ใช่ due_date และ overdue (เพราะมีข้อความนี้อยู่แล้ว)
            if (template !== 'due_date' && template !== 'overdue') {
                message += `\n\n📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\n`;
                message += `ขอบคุณค่ะ 🙏`;
            }

            recipients.push({
                lineUserId: tenant.line_user_id || null,
                facebookUserId: tenant.facebook_user_id || null,
                message: message,
                metadata: {
                    paymentId: payment.id,
                    tenantId: tenant.id,
                    tenantName: tenant.full_name,
                    roomNumber: room?.room_number,
                    branchId: payment.branch_id,
                    platform: tenant.facebook_user_id ? 'facebook' : 'line'
                }
            });
        }

        if (recipients.length === 0) {
            return Response.json({
                success: false,
                message: 'ไม่มีผู้รับที่เชื่อมต่อระบบแชท (LINE/Facebook)'
            });
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

        // ✅ ส่งข้อความผ่าน LINE และ Facebook
        let successCount = 0;
        let failCount = 0;
        const errors = [];

        // แยกผู้รับตาม platform
        const lineRecipients = recipients.filter(r => r.lineUserId);
        const facebookRecipients = recipients.filter(r => r.facebookUserId);

        console.log(`📊 Recipients: ${lineRecipients.length} LINE, ${facebookRecipients.length} Facebook`);

        // ส่งผ่าน LINE
        if (lineRecipients.length > 0) {
            try {
                const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                    recipients: lineRecipients,
                    options: {
                        batchSize: 10,
                        delayBetweenBatches: 2000,
                        delayBetweenMessages: 200,
                        retryAttempts: 2
                    }
                });

                const result = batchResult.data;
                successCount += result.success || 0;
                failCount += result.failed || 0;
                if (result.errors) errors.push(...result.errors);
                
                console.log(`✅ LINE: ${result.success}/${lineRecipients.length} sent`);
            } catch (lineError) {
                console.error('❌ LINE batch send failed:', lineError);
                failCount += lineRecipients.length;
            }
        }

        // ส่งผ่าน Facebook
        if (facebookRecipients.length > 0) {
            try {
                const fbResult = await base44.asServiceRole.functions.invoke('sendFacebookPaymentReminder', {
                    recipients: facebookRecipients
                });

                const result = fbResult.data;
                successCount += result.success || 0;
                failCount += result.failed || 0;
                if (result.errors) errors.push(...result.errors);
                
                console.log(`✅ Facebook: ${result.success}/${facebookRecipients.length} sent`);
            } catch (fbError) {
                console.error('❌ Facebook batch send failed:', fbError);
                failCount += facebookRecipients.length;
            }
        }

        const result = { success: successCount, failed: failCount, total: recipients.length, errors };
        
        return Response.json({ 
            success: true,
            message: `ส่งข้อความสำเร็จ ${result.success}/${result.total} รายการ`,
            sent: result.success,
            failed: result.failed,
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