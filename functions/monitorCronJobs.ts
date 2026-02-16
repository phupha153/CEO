import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import { differenceInMinutes, parseISO } from 'npm:date-fns@3.6.0';

// ตรวจสอบและส่งการแจ้งเตือนเมื่อ Cron Jobs มีปัญหา
Deno.serve(async (req) => {
    const startTime = Date.now();
    
    try {
        const base44 = createClientFromRequest(req);
        
        console.log('🔍 Starting Cron Job monitoring...');
        
        // ดึง alerts ที่เปิดใช้งาน
        const alerts = await base44.asServiceRole.entities.CronJobAlert.filter({ enabled: true });
        console.log(`📋 Found ${alerts.length} active alerts`);
        
        if (alerts.length === 0) {
            return Response.json({
                success: true,
                message: 'ไม่มีการแจ้งเตือนที่เปิดใช้งาน',
                alertsChecked: 0
            });
        }
        
        // ดึง function logs ล่าสุด
        const functionLogs = await base44.asServiceRole.entities.FunctionLog.list('-run_timestamp', 500);
        console.log(`📊 Loaded ${functionLogs.length} function logs`);
        
        const now = new Date();
        const alertsTriggered = [];
        
        for (const alert of alerts) {
            try {
                // เช็ค cooldown
                if (alert.last_triggered) {
                    const lastTriggered = parseISO(alert.last_triggered);
                    const minutesSince = differenceInMinutes(now, lastTriggered);
                    if (minutesSince < (alert.cooldown_minutes || 60)) {
                        console.log(`⏸️ Alert "${alert.alert_name}" in cooldown (${minutesSince}/${alert.cooldown_minutes} min)`);
                        continue;
                    }
                }
                
                const periodMinutes = alert.threshold_period_minutes || 60;
                const cutoffTime = new Date(now.getTime() - periodMinutes * 60 * 1000);
                
                // กรอง logs ตาม function และช่วงเวลา
                const relevantLogs = functionLogs.filter(log => 
                    log.function_name === alert.function_name &&
                    new Date(log.run_timestamp) >= cutoffTime
                );
                
                console.log(`🔎 Alert "${alert.alert_name}": ${relevantLogs.length} logs in last ${periodMinutes} min`);
                
                let shouldAlert = false;
                let alertMessage = '';
                let alertDetails = {};
                
                if (alert.alert_type === 'failure') {
                    // นับจำนวนครั้งที่ล้มเหลว
                    const failures = relevantLogs.filter(log => log.status === 'error');
                    const failureCount = failures.length;
                    
                    if (failureCount >= alert.threshold_value) {
                        shouldAlert = true;
                        
                        // วิเคราะห์สาขาที่มีปัญหา
                        const branchErrors = {};
                        failures.forEach(log => {
                            if (log.branch_results && Array.isArray(log.branch_results)) {
                                log.branch_results.forEach(br => {
                                    if (br.status === 'error' || br.failed > 0) {
                                        if (!branchErrors[br.branch_id]) {
                                            branchErrors[br.branch_id] = {
                                                branch_name: br.branch_name,
                                                count: 0,
                                                errors: []
                                            };
                                        }
                                        branchErrors[br.branch_id].count++;
                                        if (br.error) branchErrors[br.branch_id].errors.push(br.error);
                                    }
                                });
                            }
                        });
                        
                        alertMessage = `🚨 Cron Job Alert: ${alert.function_name}\n\n`;
                        alertMessage += `ล้มเหลว ${failureCount} ครั้งใน ${periodMinutes} นาทีที่ผ่านมา\n`;
                        alertMessage += `(เกินค่า threshold: ${alert.threshold_value} ครั้ง)\n\n`;
                        
                        if (Object.keys(branchErrors).length > 0) {
                            alertMessage += `🏢 สาขาที่มีปัญหา:\n`;
                            Object.entries(branchErrors).forEach(([branchId, info]) => {
                                alertMessage += `• ${info.branch_name || branchId}: ล้มเหลว ${info.count} ครั้ง\n`;
                                if (info.errors.length > 0) {
                                    alertMessage += `  Error: ${info.errors[0]}\n`;
                                }
                            });
                            alertMessage += '\n';
                        }
                        
                        alertMessage += `กรุณาตรวจสอบและแก้ไข`;
                        
                        alertDetails = {
                            failureCount,
                            threshold: alert.threshold_value,
                            periodMinutes,
                            branchErrors
                        };
                    }
                } else if (alert.alert_type === 'performance') {
                    // เช็คประสิทธิภาพ
                    const logsWithTime = relevantLogs.filter(log => 
                        log.execution_time_ms && log.execution_time_ms > 0
                    );
                    
                    if (logsWithTime.length > 0) {
                        const avgTime = logsWithTime.reduce((sum, log) => sum + log.execution_time_ms, 0) / logsWithTime.length;
                        const thresholdMs = alert.threshold_value;
                        
                        if (avgTime > thresholdMs) {
                            shouldAlert = true;
                            alertMessage = `⚠️ Performance Alert: ${alert.function_name}\n\n`;
                            alertMessage += `เวลาเฉลี่ย: ${(avgTime / 1000).toFixed(2)}s\n`;
                            alertMessage += `เกินค่า threshold: ${(thresholdMs / 1000).toFixed(2)}s\n`;
                            alertMessage += `ใน ${periodMinutes} นาทีที่ผ่านมา\n\n`;
                            alertMessage += `กรุณาตรวจสอบประสิทธิภาพของระบบ`;
                            
                            alertDetails = {
                                avgTimeMs: avgTime,
                                thresholdMs,
                                sampleCount: logsWithTime.length
                            };
                        }
                    }
                } else if (alert.alert_type === 'success_rate') {
                    // เช็คอัตราความสำเร็จ
                    if (relevantLogs.length > 0) {
                        const successCount = relevantLogs.filter(log => log.status === 'success').length;
                        const successRate = (successCount / relevantLogs.length) * 100;
                        const minSuccessRate = alert.threshold_value; // expected to be percentage
                        
                        if (successRate < minSuccessRate) {
                            shouldAlert = true;
                            alertMessage = `📉 Success Rate Alert: ${alert.function_name}\n\n`;
                            alertMessage += `อัตราความสำเร็จ: ${successRate.toFixed(1)}%\n`;
                            alertMessage += `ต่ำกว่าค่า threshold: ${minSuccessRate}%\n`;
                            alertMessage += `ใน ${periodMinutes} นาทีที่ผ่านมา (${relevantLogs.length} ครั้ง)\n\n`;
                            alertMessage += `กรุณาตรวจสอบและแก้ไข`;
                            
                            alertDetails = {
                                successRate,
                                threshold: minSuccessRate,
                                totalRuns: relevantLogs.length,
                                successCount
                            };
                        }
                    }
                }
                
                // ส่งการแจ้งเตือน
                if (shouldAlert) {
                    console.log(`🚨 Triggering alert: ${alert.alert_name}`);
                    
                    const channels = alert.notification_channels || [];
                    const sendResults = [];
                    
                    // ส่งทาง Email
                    if (channels.includes('email') && alert.recipient_emails?.length > 0) {
                        for (const email of alert.recipient_emails) {
                            try {
                                await base44.asServiceRole.integrations.Core.SendEmail({
                                    to: email,
                                    subject: `🚨 Cron Job Alert: ${alert.function_name}`,
                                    body: alertMessage
                                });
                                sendResults.push({ channel: 'email', to: email, success: true });
                                console.log(`✅ Email sent to ${email}`);
                            } catch (error) {
                                sendResults.push({ channel: 'email', to: email, success: false, error: error.message });
                                console.error(`❌ Email failed for ${email}:`, error);
                            }
                        }
                    }
                    
                    // ส่งทาง LINE
                    if (channels.includes('line') && alert.recipient_line_ids?.length > 0) {
                        const lineToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
                        if (lineToken) {
                            for (const lineId of alert.recipient_line_ids) {
                                try {
                                    const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
                                        method: 'POST',
                                        headers: {
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${lineToken}`
                                        },
                                        body: JSON.stringify({
                                            to: lineId,
                                            messages: [{ type: 'text', text: alertMessage }]
                                        })
                                    });
                                    
                                    if (lineResponse.ok) {
                                        sendResults.push({ channel: 'line', to: lineId, success: true });
                                        console.log(`✅ LINE sent to ${lineId}`);
                                    } else {
                                        const errorData = await lineResponse.json();
                                        sendResults.push({ channel: 'line', to: lineId, success: false, error: errorData.message });
                                        console.error(`❌ LINE failed for ${lineId}:`, errorData);
                                    }
                                } catch (error) {
                                    sendResults.push({ channel: 'line', to: lineId, success: false, error: error.message });
                                    console.error(`❌ LINE error for ${lineId}:`, error);
                                }
                            }
                        }
                    }
                    
                    // อัปเดต last_triggered
                    await base44.asServiceRole.entities.CronJobAlert.update(alert.id, {
                        last_triggered: now.toISOString()
                    });
                    
                    alertsTriggered.push({
                        alert: alert.alert_name,
                        function: alert.function_name,
                        type: alert.alert_type,
                        message: alertMessage,
                        sendResults,
                        details: alertDetails
                    });
                }
                
            } catch (error) {
                console.error(`❌ Error processing alert ${alert.alert_name}:`, error);
            }
        }
        
        const executionTime = Date.now() - startTime;
        console.log(`✅ Monitoring completed in ${executionTime}ms`);
        
        // บันทึก log
        await base44.asServiceRole.entities.FunctionLog.create({
            function_name: 'monitorCronJobs',
            run_timestamp: now.toISOString(),
            status: 'success',
            message: `ตรวจสอบ ${alerts.length} alerts, แจ้งเตือน ${alertsTriggered.length} ครั้ง`,
            execution_time_ms: executionTime,
            total_sent: alertsTriggered.length,
            triggered_by: 'cron',
            details: {
                alertsChecked: alerts.length,
                alertsTriggered: alertsTriggered.length,
                results: alertsTriggered
            }
        });
        
        return Response.json({
            success: true,
            message: `ตรวจสอบเสร็จสิ้น - แจ้งเตือน ${alertsTriggered.length}/${alerts.length} รายการ`,
            alertsChecked: alerts.length,
            alertsTriggered: alertsTriggered.length,
            executionTimeMs: executionTime,
            results: alertsTriggered
        });
        
    } catch (error) {
        const executionTime = Date.now() - startTime;
        console.error('❌ Error in monitorCronJobs:', error);
        
        // บันทึก error log
        try {
            await base44.asServiceRole.entities.FunctionLog.create({
                function_name: 'monitorCronJobs',
                run_timestamp: new Date().toISOString(),
                status: 'error',
                message: error.message,
                execution_time_ms: executionTime,
                triggered_by: 'cron',
                details: { error: error.message, stack: error.stack }
            });
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
        
        return Response.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});