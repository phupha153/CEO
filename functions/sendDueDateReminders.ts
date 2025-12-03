import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Due date reminder function - sends LINE notifications on payment due dates
// Version: 2025-11-27 - Added tracking for sent reminders
Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        console.log('🔔 Starting due date reminder check...');

        // Parse request body to check for test mode
        let testLineUserId = null;
        try {
            const text = await req.text();
            if (text) {
                const body = JSON.parse(text);
                testLineUserId = body.test_line_user_id || null;
            }
        } catch (parseError) {
            console.log('⚠️ No body or parse error:', parseError.message);
        }

        // 1. ดึงการตั้งค่าจาก Config
        const configs = await base44.asServiceRole.entities.Config.list();
        
        // ⭐ สรุปสถานะการเปิด/ปิดแจ้งเตือนวันครบกำหนดแต่ละสาขา
        const branchReminderConfigs = configs.filter(c => c.key === 'send_due_date_reminder');
        const enabledBranches = branchReminderConfigs.filter(c => c.value === 'true').map(c => c.branch_id);
        const disabledBranches = branchReminderConfigs.filter(c => c.value !== 'true').map(c => c.branch_id);
        
        console.log(`📊 Branch due date reminder status summary:`);
        console.log(`   ✅ Enabled branches (${enabledBranches.length}): ${enabledBranches.join(', ') || 'none'}`);
        console.log(`   ❌ Disabled branches (${disabledBranches.length}): ${disabledBranches.length} branches`);

        // ถ้าไม่มีสาขาไหนเปิดเลย
        if (enabledBranches.length === 0) {
            console.log('⚠️ No branches have due date reminders enabled');
            return Response.json({
                success: true,
                message: 'ไม่มีสาขาใดเปิดการแจ้งเตือนวันครบกำหนด กรุณาเปิดในหน้าตั้งค่า > บิล',
                sent: 0,
                enabledBranches: [],
                disabledBranches: disabledBranches.length
            });
        }

        console.log('✅ Due date reminder check started');

        // 2. Helper function to get config value by branch
        const getConfigValue = (key, defaultValue, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        // ⭐ ดึงวันที่จาก test_current_date ถ้ามี (สำหรับทดสอบ)
        const testDateConfig = configs.find(c => c.key === 'test_current_date' && !c.branch_id);
        let todayString;
        
        if (testDateConfig && testDateConfig.value && testDateConfig.value.trim() !== '') {
            // ใช้วันที่ทดสอบ
            todayString = testDateConfig.value.trim();
            console.log(`🧪 TEST MODE: Using test_current_date = ${todayString}`);
        } else {
            // ⭐ ใช้เวลาไทย (UTC+7) แทน UTC
            const now = new Date();
            const thailandTime = new Date(now.getTime() + (7 * 60 * 60 * 1000)); // เพิ่ม 7 ชม.
            todayString = thailandTime.toISOString().split('T')[0];
            console.log(`📅 Using Thailand date: ${todayString} (UTC: ${now.toISOString()})`);
        }

        // 3. หาบิลที่ครบกำหนดชำระวันนี้ (ยังไม่ชำระ)
        console.log('🔍 Fetching payments with pagination...');
        
        // ⭐ Helper function สำหรับดึงข้อมูลแบบ pagination (รองรับมากกว่า 10,000 รายการ)
        async function fetchAllWithPagination(entity, batchSize = 5000) {
            let allData = [];
            let skip = 0;
            let hasMore = true;
            
            while (hasMore) {
                const batch = await entity.list('-created_date', batchSize, skip);
                if (!Array.isArray(batch) || batch.length === 0) {
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
        
        let payments = await fetchAllWithPagination(base44.asServiceRole.entities.Payment);
        
        // ⭐ แปลงเป็น array เพื่อป้องกัน error
        if (!Array.isArray(payments)) payments = [];
        
        console.log(`📦 Loaded ${payments.length} payments`);
        console.log(`📅 Checking for due_date = ${todayString}`);

        // กรองบิลที่ครบกำหนดชำระวันนี้ - เช็คจาก due_date จริงของบิล
        // ⭐ กรองเฉพาะสาขาที่เปิดการแจ้งเตือน
        const dueToday = payments.filter(p => {
            // ส่งเฉพาะที่ยังไม่ได้ชำระ (pending หรือ overdue)
            if (p.status !== 'pending' && p.status !== 'overdue') return false;

            // ต้องมี due_date
            if (!p.due_date) return false;

            // เช็คว่า due_date ตรงกับวันนี้หรือไม่
            if (p.due_date !== todayString) return false;

            // ⭐ ถ้าส่งแจ้งเตือนวันครบกำหนดไปแล้ว ไม่ต้องส่งซ้ำ
            if (p.due_date_reminder_sent_date) {
                console.log(`⏭️ Skipping payment ${p.id} - already sent due date reminder`);
                return false;
            }
            
            // ⭐ เช็คว่าสาขานี้เปิดการแจ้งเตือนหรือไม่
            if (!enabledBranches.includes(p.branch_id)) {
                console.log(`⏭️ Skipping payment ${p.id} - branch ${p.branch_id} has due date reminder disabled`);
                return false;
            }

            return true;
        });

        console.log(`📊 Found ${dueToday.length} payments due today`);

        if (dueToday.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีบิลที่ครบกำหนดชำระวันนี้',
                sent: 0
            });
        }

        // ⭐ ดึงข้อมูล Tenant และ Room ทั้งหมดก่อนเพื่อลด API calls
        console.log('📥 Pre-fetching all tenants and rooms...');
        const allTenants = await fetchAllWithPagination(base44.asServiceRole.entities.Tenant);
        const allRooms = await fetchAllWithPagination(base44.asServiceRole.entities.Room);
        
        const tenantMap = new Map(allTenants.map(t => [t.id, t]));
        const roomMap = new Map(allRooms.map(r => [r.id, r]));
        
        console.log(`✅ Loaded ${allTenants.length} tenants, ${allRooms.length} rooms`);

        // 4. เตรียมข้อความสำหรับแต่ละบิล (grouped by branch)
        const recipients = [];

        for (const payment of dueToday) {
            try {
                // ⭐ ใช้ Map lookup แทน API call ในลูป
                const tenant = tenantMap.get(payment.tenant_id);
                const room = roomMap.get(payment.room_id);

                if (!tenant) {
                    console.log(`⚠️ Tenant not found for payment ${payment.id}`);
                    continue;
                }

                // ⭐ เช็คว่ามี LINE หรือ Facebook
                const hasLine = tenant.line_user_id && tenant.line_user_id.trim() !== '';
                const hasFacebook = tenant.facebook_user_id && tenant.facebook_user_id.trim() !== '';
                
                if (!hasLine && !hasFacebook) {
                    console.log(`⚠️ No LINE or Facebook ID for payment ${payment.id}, tenant: ${tenant.full_name}`);
                    continue;
                }

                // ดึง config เฉพาะสาขาของบิลนี้
                const paymentBranchId = payment.branch_id;
                const branchBankName = getConfigValue('bank_name', 'กสิกร', paymentBranchId);
                const branchBankAccountNumber = getConfigValue('bank_account_number', '0722835522', paymentBranchId);
                const branchBankAccountName = getConfigValue('bank_account_name', 'ธนานนท์ พรมพักตร์', paymentBranchId);
                const branchBuildingName = getConfigValue('building_name', 'W RESIDENTS', paymentBranchId);
                const branchLateFeePerDay = parseFloat(getConfigValue('late_payment_fee_per_day', '0', paymentBranchId));

                console.log(`💰 Late fee for branch ${paymentBranchId}: ${branchLateFeePerDay} บาท/วัน`);

                // ใช้ due_date จากบิลโดยตรง
                const dueDateStr = new Date(payment.due_date).toLocaleDateString('th-TH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

                let message = `⏰ แจ้งเตือน: วันนี้เป็นวันครบกำหนดชำระค่าเช่า\n\n`;
                message += `🏠 ${branchBuildingName}\n`;
                message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
                message += `สวัสดีคุณ ${tenant.full_name}\n`;
                message += `ห้อง ${room?.room_number || 'N/A'}\n\n`;
                
                message += `📋 รายละเอียดบิล:\n`;
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
                message += `💰 รวมทั้งสิ้น: ${payment.total_amount.toLocaleString()} บาท\n\n`;
                
                message += `📅 ครบกำหนดชำระ: ${dueDateStr} (วันนี้)\n`;
                message += `⚠️ สถานะ: รอชำระ\n\n`;

                // แสดงข้อมูลค่าปรับถ้ามี (ใช้ค่าของสาขา)
                if (branchLateFeePerDay > 0) {
                    message += `⚠️ หมายเหตุ:\n`;
                    message += `หากชำระหลังวันครบกำหนด จะมีค่าปรับ ${branchLateFeePerDay} บาท/วัน\n\n`;
                }
                
                message += `💳 โอนเงินได้ที่:\n`;
                message += `ธนาคาร: ${branchBankName}\n`;
                message += `เลขบัญชี: ${branchBankAccountNumber}\n`;
                message += `ชื่อบัญชี: ${branchBankAccountName}\n\n`;

                // สร้างรูปใบแจ้งหนี้ใหม่ทุกครั้งเพื่อให้ข้อมูลตรงกับแอป (รวมที่อยู่ลูกค้า)
                let invoiceImageUrl = null;
                try {
                    // ลบ invoice_image_url เก่าออกก่อนเพื่อบังคับสร้างใหม่
                    if (payment.invoice_image_url) {
                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            invoice_image_url: null
                        });
                        console.log(`🗑️ Cleared old invoice_image_url for payment ${payment.id}`);
                    }
                    
                    console.log(`🖼️ Generating invoice image for payment ${payment.id}...`);
                    const invoiceResult = await base44.asServiceRole.functions.invoke('generateInvoiceImage', {
                        paymentId: payment.id
                    });
                    if (invoiceResult.data?.success && invoiceResult.data?.invoice_image_url) {
                        invoiceImageUrl = invoiceResult.data.invoice_image_url;
                        console.log(`✅ Invoice image generated: ${invoiceImageUrl}`);
                    }
                } catch (invoiceError) {
                    console.error(`❌ Error generating invoice image:`, invoiceError);
                }

                if (invoiceImageUrl) {
                    message += `📄 ดูใบแจ้งหนี้: ${invoiceImageUrl}\n\n`;
                }

                message += `📸 กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\n`;
                message += `ขอบคุณค่ะ 🙏`;

                recipients.push({
                    lineUserId: tenant.line_user_id,
                    message: message,
                    metadata: {
                        paymentId: payment.id,
                        tenantId: tenant.id,
                        roomNumber: room?.room_number,
                        branchId: paymentBranchId
                    }
                });

                // ⭐ บันทึกว่าส่งแจ้งเตือนวันครบกำหนดแล้ว
                try {
                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        due_date_reminder_sent_date: new Date().toISOString()
                    });
                    console.log(`✅ Updated due_date_reminder_sent_date for payment ${payment.id}`);
                } catch (updateErr) {
                    console.error(`⚠️ Failed to update due_date_reminder_sent_date:`, updateErr.message);
                }

            } catch (error) {
                console.error(`❌ Error processing payment ${payment.id}:`, error);
            }
        }

        // 5. ส่งข้อความ (ใช้ test mode ถ้ามี testLineUserId)
        let sentCount = 0;
        let sendErrors = [];

        if (recipients.length > 0) {
            // ⭐ TEST MODE: ถ้ามี test_line_user_id ให้ส่งไปหาคนเดียวแทน
            if (testLineUserId) {
                console.log(`🧪 TEST MODE: Sending sample to ${testLineUserId}`);
                
                // เลือกบิลตัวอย่างตัวแรก
                const sampleRecipient = recipients[0];
                
                try {
                    const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                        recipients: [{
                            lineUserId: testLineUserId,
                            message: sampleRecipient.message,
                            metadata: { ...sampleRecipient.metadata, testMode: true }
                        }],
                        options: {
                            batchSize: 1,
                            retryAttempts: 2
                        }
                    });

                    const result = batchResult.data;
                    sentCount = result.success;

                    if (result.success > 0) {
                        console.log(`✅ Test message sent successfully`);
                    }
                } catch (error) {
                    console.error('❌ Error sending test message:', error);
                    sendErrors.push(`Test mode error: ${error.message}`);
                }
            } else {
                // ส่งจริง
                try {
                    console.log(`📤 Sending ${recipients.length} due date reminders via batch...`);
                    
                    const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                        recipients: recipients,
                        options: {
                            batchSize: 20,
                            delayBetweenBatches: 2000,
                            delayBetweenMessages: 100,
                            retryAttempts: 3
                        }
                    });

                    const result = batchResult.data;
                    sentCount = result.success;
                
                if (result.errors && result.errors.length > 0) {
                    result.errors.forEach(err => {
                        const meta = err.metadata;
                        sendErrors.push(`ห้อง ${meta?.roomNumber || 'N/A'}: ${err.error}`);
                    });
                }

                    console.log(`📊 Due date reminders: ${sentCount}/${recipients.length} sent successfully`);

                } catch (error) {
                    console.error('❌ Error sending batch messages:', error);
                    sendErrors.push(`Batch sending error: ${error.message}`);
                }
            }
        }

        const result = {
            success: true,
            message: testLineUserId 
                ? `🧪 ส่งข้อความทดสอบสำเร็จ (Test Mode)` 
                : `ส่งการแจ้งเตือนสำเร็จ ${sentCount}/${recipients.length} รายการ`,
            sent: sentCount,
            total: testLineUserId ? 1 : recipients.length,
            testMode: !!testLineUserId,
            enabledBranches: enabledBranches,
            errors: sendErrors.length > 0 ? sendErrors : undefined,
            currentDate: todayString,
            usingTestDate: !!testDateConfig
        };

        console.log('🎉 Due date reminder completed:', result);

        return Response.json(result);

    } catch (error) {
        console.error('❌ Error in sendDueDateReminders:', error);
        console.error('📍 Error stack:', error.stack);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack,
            details: String(error)
        }, { status: 500 });
    }
});