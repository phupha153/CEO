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
        
        // ⭐ ดึง Payments เฉพาะที่ due_date = วันนี้ และยังไม่ชำระ (ลดขนาดข้อมูล)
        console.log(`📥 Fetching payments with due_date=${todayString} and pending/overdue status...`);
        let payments = [];
        
        try {
            // ดึงเฉพาะ payment ที่ครบกำหนดวันนี้
            const pendingPayments = await base44.asServiceRole.entities.Payment.filter(
                { due_date: todayString, status: 'pending' },
                '-created_date',
                1000
            );
            const overduePayments = await base44.asServiceRole.entities.Payment.filter(
                { due_date: todayString, status: 'overdue' },
                '-created_date',
                1000
            );
            
            // รวมผลลัพธ์
            const parseResult = (result) => {
                if (Array.isArray(result)) return result;
                if (typeof result === 'string') {
                    try {
                        const parsed = JSON.parse(result);
                        if (Array.isArray(parsed)) return parsed;
                    } catch (e) {
                        console.error('❌ JSON parse error:', e.message);
                    }
                }
                return [];
            };
            
            payments = [...parseResult(pendingPayments), ...parseResult(overduePayments)];
            console.log(`✅ Fetched ${payments.length} payments (pending: ${parseResult(pendingPayments).length}, overdue: ${parseResult(overduePayments).length})`);
        } catch (err) {
            console.error('❌ Error fetching payments:', err.message);
        }

        // ⭐ Debug: แสดงตัวอย่าง payment ถ้ามี
        if (payments.length > 0) {
            const sample = payments[0];
            console.log(`📝 Sample payment: id=${sample.id}, due_date=${sample.due_date}, status=${sample.status}, branch_id=${sample.branch_id}`);
        }
        
        // ⭐ แปลงเป็น array เพื่อป้องกัน error
        if (!Array.isArray(payments)) payments = [];
        


        // กรองบิลที่ยังไม่ได้ส่งแจ้งเตือน และสาขาเปิดใช้งาน
        const dueToday = payments.filter(p => {
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

        // ⭐ Helper: แปลง result เป็น array
        const parseResult = (result) => {
            if (Array.isArray(result)) return result;
            if (typeof result === 'string') {
                try {
                    const parsed = JSON.parse(result);
                    if (Array.isArray(parsed)) return parsed;
                } catch (e) {
                    console.error('❌ JSON parse error:', e.message);
                }
            }
            return [];
        };

        // ⭐ ดึงข้อมูล Tenant และ Room เฉพาะที่เกี่ยวข้อง
        console.log('📥 Pre-fetching tenants and rooms...');
        const tenantIds = [...new Set(payments.map(p => p.tenant_id).filter(Boolean))];
        const roomIds = [...new Set(payments.map(p => p.room_id).filter(Boolean))];
        
        let allTenants = [];
        let allRooms = [];
        
        // ดึง tenant ทีละ batch เพื่อหลีกเลี่ยงปัญหา JSON ใหญ่เกิน
        for (const tenantId of tenantIds) {
            try {
                const tenants = await base44.asServiceRole.entities.Tenant.filter({ id: tenantId }, '-created_date', 1);
                allTenants = allTenants.concat(parseResult(tenants));
            } catch (e) {
                console.error(`❌ Error fetching tenant ${tenantId}:`, e.message);
            }
        }
        
        for (const roomId of roomIds) {
            try {
                const rooms = await base44.asServiceRole.entities.Room.filter({ id: roomId }, '-created_date', 1);
                allRooms = allRooms.concat(parseResult(rooms));
            } catch (e) {
                console.error(`❌ Error fetching room ${roomId}:`, e.message);
            }
        }
        
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

                // ⭐ ข้อความสั้นกระชับ - วันครบกำหนดชำระ
                let message = `⏰ วันนี้ครบกำหนดชำระค่าเช่า\n\n`;
                message += `🏠 ${branchBuildingName}\n`;
                message += `👤 คุณ ${tenant.full_name} ห้อง ${room?.room_number || 'N/A'}\n`;
                message += `💰 ยอดชำระ: ${payment.total_amount.toLocaleString()} บาท\n\n`;
                
                if (branchLateFeePerDay > 0) {
                    message += `⚠️ หากชำระหลังวันนี้ มีค่าปรับ ${branchLateFeePerDay} บาท/วัน\n\n`;
                }
                
                message += `💳 โอนเงินได้ที่:\n`;
                message += `${branchBankName} ${branchBankAccountNumber}\n`;
                message += `ชื่อ: ${branchBankAccountName}\n\n`;
                message += `📸 ส่งสลิปหลังโอนค่ะ`;

                recipients.push({
                    lineUserId: hasLine ? tenant.line_user_id : null,
                    facebookUserId: hasFacebook ? tenant.facebook_user_id : null,
                    message: message,
                    metadata: {
                        paymentId: payment.id,
                        tenantId: tenant.id,
                        tenantName: tenant.full_name,
                        roomNumber: room?.room_number,
                        branchId: paymentBranchId,
                        channel: hasLine ? 'line' : 'facebook'
                    }
                });

            } catch (error) {
                console.error(`❌ Error processing payment ${payment.id}:`, error);
            }
        }

        // 5. ส่งข้อความ (แยก LINE และ Facebook)
        let sentCount = 0;
        let sendErrors = [];

        // แยก recipients ตาม channel
        const lineRecipients = recipients.filter(r => r.lineUserId);
        const facebookRecipients = recipients.filter(r => !r.lineUserId && r.facebookUserId);

        console.log(`📊 Recipients: ${lineRecipients.length} LINE, ${facebookRecipients.length} Facebook`);

        if (recipients.length > 0) {
            // ⭐ TEST MODE: ถ้ามี test_line_user_id ให้ส่งไปหาคนเดียวแทน
            if (testLineUserId) {
                console.log(`🧪 TEST MODE: Sending sample to ${testLineUserId}`);
                
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
                // ส่งจริง - LINE
                if (lineRecipients.length > 0) {
                    try {
                        console.log(`📤 Sending ${lineRecipients.length} LINE reminders...`);
                        
                        const batchResult = await base44.asServiceRole.functions.invoke('sendBatchLineMessages', {
                            recipients: lineRecipients,
                            options: {
                                batchSize: 20,
                                delayBetweenBatches: 2000,
                                delayBetweenMessages: 100,
                                retryAttempts: 3
                            }
                        });

                        const result = batchResult.data;
                        sentCount += result.success || 0;
                    
                        if (result.errors && result.errors.length > 0) {
                            result.errors.forEach(err => {
                                const meta = err.metadata;
                                sendErrors.push(`LINE ห้อง ${meta?.roomNumber || 'N/A'}: ${err.error}`);
                            });
                        }

                        // ⭐ บันทึกว่าส่งสำเร็จเฉพาะที่ส่งได้จริง
                        if (result.success > 0 && result.successRecipients) {
                            for (const successRecipient of result.successRecipients) {
                                try {
                                    await base44.asServiceRole.entities.Payment.update(successRecipient.metadata.paymentId, {
                                        due_date_reminder_sent_date: new Date().toISOString()
                                    });
                                } catch (updateErr) {
                                    console.error(`⚠️ Failed to update sent date:`, updateErr.message);
                                }
                            }
                        }

                        console.log(`📊 LINE reminders: ${result.success}/${lineRecipients.length} sent`);

                    } catch (error) {
                        console.error('❌ Error sending LINE messages:', error);
                        sendErrors.push(`LINE error: ${error.message}`);
                    }
                }

                // ส่งจริง - Facebook
                if (facebookRecipients.length > 0) {
                    console.log(`📤 Sending ${facebookRecipients.length} Facebook reminders...`);

                    for (const recipient of facebookRecipients) {
                        try {
                            await base44.asServiceRole.functions.invoke('sendFacebookMessage', {
                                to: recipient.facebookUserId,
                                message: recipient.message,
                                branch_id: recipient.metadata.branchId
                            });
                            sentCount++;
                            console.log(`✅ Facebook sent to ${recipient.metadata.tenantName}`);

                            // ⭐ บันทึกว่าส่งสำเร็จแล้ว
                            try {
                                await base44.asServiceRole.entities.Payment.update(recipient.metadata.paymentId, {
                                    due_date_reminder_sent_date: new Date().toISOString()
                                });
                            } catch (updateErr) {
                                console.error(`⚠️ Failed to update sent date:`, updateErr.message);
                            }
                        } catch (error) {
                            console.error(`❌ Facebook error for ${recipient.metadata.tenantName}:`, error);
                            sendErrors.push(`Facebook ห้อง ${recipient.metadata.roomNumber}: ${error.message}`);
                        }
                    }
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
            usingTestDate: !!(testDateConfig && testDateConfig.value && testDateConfig.value.trim() !== ''),
            lineCount: lineRecipients.length,
            facebookCount: facebookRecipients.length
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