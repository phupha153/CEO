import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

/**
 * ฟังก์ชันสำหรับสร้างรูปใบแจ้งหนี้และส่ง LINE แบบ Queue
 * - ดึง Payment ที่ invoice_image_status = 'pending' และยังไม่ส่ง LINE
 * - สร้างรูปทีละ 3 รูปพร้อมกัน (ตามข้อจำกัด Browserless)
 * - ส่ง LINE หลังสร้างรูปเสร็จ
 * 
 * เรียกใช้งานจาก:
 * 1. Cron Job (ทุก 2 นาที)
 * 2. ปุ่มกดจากหน้า UI
 */

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function numberToThaiText(number) {
    if (number === undefined || number === null || isNaN(number) || number === 0) return 'ศูนย์บาทถ้วน';

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
        
        if (position === 1) {
          if (digit === 1) {
            result += 'สิบ';
          } else if (digit === 2) {
            result += 'ยี่สิบ';
          } else {
            result += numbers[digit] + positions[position];
          }
        } else if (position === 0 && digit === 1 && len > 1 && parseInt(numStr[len-2]) !== 0) {
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

Deno.serve(async (req) => {
    console.log('========================================');
    console.log('🖼️ PROCESS INVOICE IMAGE QUEUE (Continuous Mode)');
    console.log(`📅 Timestamp: ${new Date().toISOString()}`);
    console.log('========================================');

    let base44 = null;
    let targetBranchId = null;
    let batchSize = 100; // เพิ่มเป็น 100 เพราะจะรันต่อเนื่อง
    let concurrentLimit = 1; // สร้างทีละ 1 รูป (Free tier Browserless)
    let maxRunTime = 40000; // 40 วินาที (เผื่อ buffer ก่อน timeout 45s)

    try {
        const clonedReq = req.clone();
        base44 = createClientFromRequest(req);

        // Parse request body
        try {
            const text = await clonedReq.text();
            if (text && text.trim()) {
                const body = JSON.parse(text);
                targetBranchId = body.branch_id || null;
                batchSize = body.batch_size || 30;
                concurrentLimit = body.concurrent_limit || 3;
            }
        } catch (e) {
            console.log('⚠️ No valid JSON body');
        }

        console.log(`📋 Target Branch: ${targetBranchId || 'ALL'}`);
        console.log(`📦 Batch Size: ${batchSize}`);
        console.log(`🔄 Concurrent Limit: ${concurrentLimit}`);
        console.log(`⏱️ Max Run Time: ${maxRunTime}ms`);
        
        const startTime = Date.now();

        // 1. Fetch Configs
        const configs = await base44.asServiceRole.entities.Config.list() || [];
        const getConfigValue = (key, defaultValue, branchId = null) => {
            if (branchId) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === branchId);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig?.value || defaultValue;
        };

        // 2. Fetch Payments ที่ต้องสร้างรูป
        // เงื่อนไข: status != 'paid' AND (invoice_image_status = 'pending' OR invoice_image_status = null) AND bill_sent_date = null
        const paymentFilter = targetBranchId ? { branch_id: targetBranchId } : {};
        
        let allPayments = await base44.asServiceRole.entities.Payment.filter(paymentFilter, '-created_date', 500);
        allPayments = allPayments || [];

        // กรองเฉพาะที่ต้องสร้างรูปและส่ง LINE
        const paymentsToProcess = allPayments.filter(p => {
            // ข้ามบิลที่ชำระแล้ว
            if (p.status === 'paid') return false;
            
            // ต้องยังไม่มีรูปหรือสถานะเป็น pending/null
            const needsImage = !p.invoice_image_url || p.invoice_image_status === 'pending' || !p.invoice_image_status;
            
            // ต้องยังไม่ส่ง LINE
            const needsSend = !p.bill_sent_date;
            
            return needsImage || needsSend;
        }).slice(0, batchSize);

        console.log(`📊 Found ${paymentsToProcess.length} payments to process (from ${allPayments.length} total)`);

        if (paymentsToProcess.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีบิลที่ต้องสร้างรูปหรือส่ง LINE',
                processed: 0,
                imageGenerated: 0,
                lineSent: 0
            });
        }

        // 3. Fetch related data
        const paymentRoomIds = [...new Set(paymentsToProcess.map(p => p.room_id).filter(Boolean))];
        const paymentTenantIds = [...new Set(paymentsToProcess.map(p => p.tenant_id).filter(Boolean))];

        const [rooms, tenants] = await Promise.all([
            base44.asServiceRole.entities.Room.filter({}, '-room_number', 5000),
            base44.asServiceRole.entities.Tenant.filter({}, '-created_date', 5000)
        ]);

        const roomMap = new Map((rooms || []).map(r => [r.id, r]));
        const tenantMap = new Map((tenants || []).map(t => [t.id, t]));

        // 4. Process in batches of `concurrentLimit`
        let imageGenerated = 0;
        let imageFailed = 0;
        let lineSent = 0;
        let lineFailed = 0;

        // แบ่งเป็นกลุ่มละ concurrentLimit
        const chunks = [];
        for (let i = 0; i < paymentsToProcess.length; i += concurrentLimit) {
            chunks.push(paymentsToProcess.slice(i, i + concurrentLimit));
        }

        console.log(`📦 Split into ${chunks.length} chunks of max ${concurrentLimit} each`);

        for (let chunkIdx = 0; chunkIdx < chunks.length; chunkIdx++) {
            // ⭐ เช็ค timeout - หยุดก่อนถึง 45 วินาที
            const elapsed = Date.now() - startTime;
            if (elapsed > maxRunTime) {
                console.log(`⏱️ Approaching timeout (${elapsed}ms) - stopping gracefully`);
                break;
            }
            
            const chunk = chunks[chunkIdx];
            console.log(`\n🔄 Processing chunk ${chunkIdx + 1}/${chunks.length} (${chunk.length} payments) [${elapsed}ms elapsed]`);

            // 4.1 สร้างรูปพร้อมกัน (concurrent)
            const imagePromises = chunk.map(async (payment) => {
                const room = roomMap.get(payment.room_id);
                const tenant = tenantMap.get(payment.tenant_id);

                // ถ้ามีรูปแล้ว ข้ามการสร้าง
                if (payment.invoice_image_url && payment.invoice_image_status === 'completed') {
                    console.log(`✅ Payment ${payment.id}: Already has image`);
                    return { payment, room, tenant, imageUrl: payment.invoice_image_url, success: true, skipped: true };
                }

                try {
                    // Mark as generating
                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        invoice_image_status: 'generating'
                    });

                    console.log(`🖼️ Generating image for payment ${payment.id} (Room: ${room?.room_number || 'N/A'})...`);
                    
                    // ⭐ เรียก getPublicInvoice + สร้างรูปเองภายใน function นี้เลย
                    const invoiceDataResult = await base44.asServiceRole.functions.invoke('getPublicInvoice', {
                        paymentId: payment.id
                    });

                    if (!invoiceDataResult.data?.success || !invoiceDataResult.data?.invoice) {
                        throw new Error(invoiceDataResult.data?.error || 'ไม่พบข้อมูลใบแจ้งหนี้');
                    }

                    const invoice = invoiceDataResult.data.invoice;
                    
                    // สร้าง HTML และ screenshot
                    const imageUrl = await generateInvoiceScreenshot(base44, payment.id, invoice);

                    if (imageUrl) {
                        // Update payment with image URL
                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            invoice_image_url: invoiceResult.data.invoice_image_url,
                            invoice_image_status: 'completed'
                        });
                        
                        console.log(`✅ Payment ${payment.id}: Image created`);
                        return { 
                            payment: { ...payment, invoice_image_url: invoiceResult.data.invoice_image_url }, 
                            room, 
                            tenant, 
                            imageUrl: invoiceResult.data.invoice_image_url, 
                            success: true 
                        };
                    } else {
                        throw new Error(invoiceResult.data?.error || 'Unknown error');
                    }
                } catch (error) {
                    console.error(`❌ Payment ${payment.id}: Image generation failed - ${error.message}`);
                    
                    // Mark as failed
                    await base44.asServiceRole.entities.Payment.update(payment.id, {
                        invoice_image_status: 'failed'
                    });
                    
                    return { payment, room, tenant, success: false, error: error.message };
                }
            });

            const imageResults = await Promise.all(imagePromises);

            // Count results
            for (const result of imageResults) {
                if (result.success && !result.skipped) {
                    imageGenerated++;
                } else if (!result.success) {
                    imageFailed++;
                }
            }

            // 4.2 ส่ง LINE สำหรับที่สร้างรูปสำเร็จ (ทีละใบเพื่อหลีกเลี่ยง rate limit)
            for (const result of imageResults) {
                if (!result.success && !result.skipped) continue;
                
                const { payment, room, tenant, imageUrl } = result;
                
                // ข้ามถ้าไม่มี LINE User ID
                if (!tenant?.line_user_id) {
                    console.log(`⏭️ Payment ${payment.id}: No LINE User ID - skip LINE notification`);
                    continue;
                }

                // ข้ามถ้าส่งไปแล้ว
                if (payment.bill_sent_date) {
                    console.log(`⏭️ Payment ${payment.id}: Already sent - skip`);
                    continue;
                }

                try {
                    const bankName = getConfigValue('bank_name', 'กสิกร', room?.branch_id);
                    const bankAcc = getConfigValue('bank_account_number', '-', room?.branch_id);
                    const bankOwner = getConfigValue('bank_account_name', '-', room?.branch_id);
                    const buildingName = getConfigValue('building_name', 'W RESIDENTS', room?.branch_id);
                    const lineToken = getConfigValue('line_channel_access_token', null, room?.branch_id) || Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');

                    let msg = `🏠 ${buildingName} - แจ้งเตือนค่าเช่า\n\n`;
                    msg += `สวัสดีคุณ ${tenant.full_name}\n`;
                    msg += `ห้อง ${room?.room_number || 'N/A'}\n\n`;
                    msg += `💰 ยอดรวม: ${payment.total_amount.toLocaleString()} บาท\n`;
                    msg += `(${numberToThaiText(payment.total_amount)})\n\n`;
                    msg += `📅 กำหนดชำระ: ${new Date(payment.due_date).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
                    msg += `\n💳 โอนเงินได้ที่: ${bankName} ${bankAcc} (${bankOwner})\n`;

                    if (imageUrl) {
                        msg += `\n📄 ดูใบแจ้งหนี้: ${imageUrl}`;
                    }

                    // ส่ง LINE
                    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${lineToken}`
                        },
                        body: JSON.stringify({
                            to: tenant.line_user_id,
                            messages: [{ type: 'text', text: msg }]
                        })
                    });

                    if (lineResponse.ok) {
                        // Update bill_sent_date
                        await base44.asServiceRole.entities.Payment.update(payment.id, {
                            bill_sent_date: new Date().toISOString()
                        });
                        
                        console.log(`📤 Payment ${payment.id}: LINE sent to ${tenant.full_name}`);
                        lineSent++;
                    } else {
                        const errorText = await lineResponse.text();
                        console.error(`❌ Payment ${payment.id}: LINE failed - ${errorText}`);
                        lineFailed++;
                    }

                    // Delay ระหว่างส่ง LINE แต่ละใบ
                    await delay(500);

                } catch (lineError) {
                    console.error(`❌ Payment ${payment.id}: LINE error - ${lineError.message}`);
                    lineFailed++;
                }
            }

            // Delay ระหว่าง chunk (รอ Browserless พร้อม) - ลดเหลือ 1 วินาที
            if (chunkIdx < chunks.length - 1) {
                console.log(`⏳ Waiting 1 second before next chunk...`);
                await delay(1000);
            }
        }

        // 5. Log และ Return
        const totalElapsed = Date.now() - startTime;
        const remaining = paymentsToProcess.length - imageGenerated - imageFailed;
        const summaryMessage = `สร้างรูป ${imageGenerated} ใบ (ล้มเหลว ${imageFailed}), ส่ง LINE ${lineSent} ราย, เหลืออีก ${remaining} ใบ [${Math.round(totalElapsed/1000)}s]`;
        console.log(`\n✅ ${summaryMessage}`);

        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'processInvoiceImageQueue',
                run_timestamp: new Date().toISOString(),
                status: 'success',
                message: summaryMessage,
                details: {
                    processed: paymentsToProcess.length,
                    imageGenerated,
                    imageFailed,
                    lineSent,
                    lineFailed,
                    batchSize,
                    concurrentLimit
                },
                triggered_by: targetBranchId ? 'manual_branch' : 'cron'
            });
        } catch (logError) {
            console.error('⚠️ Failed to write function log:', logError.message);
        }

        return Response.json({
            success: true,
            message: summaryMessage,
            processed: paymentsToProcess.length,
            imageGenerated,
            imageFailed,
            lineSent,
            lineFailed,
            remaining,
            elapsedMs: totalElapsed,
            // ⭐ ถ้ายังมีเหลือ = ควรรันอีกรอบ
            hasMore: remaining > 0
        });

    } catch (error) {
        console.error('❌ Error:', error);

        if (base44) {
            try {
                await base44.asServiceRole.entities.FunctionLog.create({
                    function_name: 'processInvoiceImageQueue',
                    run_timestamp: new Date().toISOString(),
                    status: 'error',
                    message: error.message || 'Unknown error',
                    details: { error: error.stack || String(error) },
                    triggered_by: 'unknown'
                });
            } catch (logError) {
                console.error('⚠️ Failed to write ERROR function log:', logError.message);
            }
        }

        return Response.json({ success: false, error: error.message }, { status: 500 });
    }
});