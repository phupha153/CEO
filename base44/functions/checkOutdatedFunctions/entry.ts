import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * 🔍 ตรวจสอบ Functions ที่ใช้ SDK เวอร์ชันเก่า
 * Version: 1.0
 * 
 * ฟังก์ชันนี้จะ:
 * 1. ดึง FunctionLog ล่าสุดของแต่ละ function
 * 2. ตรวจสอบว่า function ไหนมี error ที่เกี่ยวกับ SDK version
 * 3. ส่งรายงานทาง LINE/Email ถ้าเจอปัญหา
 */

Deno.serve(async (req) => {
    const startTime = Date.now();
    
    try {
        const base44 = createClientFromRequest(req);
        
        // ⭐ รับ parameters
        let sendReport = false;
        let targetVersion = '0.8.6';
        try {
            const body = await req.json();
            sendReport = body.send_report || false;
            targetVersion = body.target_version || '0.8.6';
        } catch {}

        console.log('🔍 Starting SDK version check...');
        console.log(`   Target version: ${targetVersion}`);
        console.log(`   Send report: ${sendReport}`);

        // 📊 ดึง function logs ล่าสุดแยกตาม function name
        const allLogs = await base44.asServiceRole.entities.FunctionLog.list('-run_timestamp', 1000);
        
        const latestLogsByFunction = new Map();
        for (const log of allLogs) {
            if (!latestLogsByFunction.has(log.function_name)) {
                latestLogsByFunction.set(log.function_name, log);
            }
        }

        console.log(`✅ Analyzed ${latestLogsByFunction.size} unique functions`);

        // 🔍 วิเคราะห์หา functions ที่น่าสนใจ
        const suspiciousFunctions = [];
        const criticalKeywords = [
            'sdk', 'version', 'import', 'module not found', 
            'cannot find', 'deprecat', 'outdated'
        ];

        for (const [functionName, log] of latestLogsByFunction.entries()) {
            if (log.status === 'error') {
                const errorMsg = (log.message || '').toLowerCase();
                const hasSDKIssue = criticalKeywords.some(keyword => 
                    errorMsg.includes(keyword)
                );

                if (hasSDKIssue) {
                    suspiciousFunctions.push({
                        function_name: functionName,
                        last_error: log.message,
                        last_run: log.run_timestamp,
                        likely_sdk_issue: true
                    });
                }
            }
        }

        console.log(`⚠️ Found ${suspiciousFunctions.length} functions with potential SDK issues`);

        // 📝 สร้างรายงาน
        const report = {
            timestamp: new Date().toISOString(),
            target_sdk_version: targetVersion,
            total_functions_checked: latestLogsByFunction.size,
            suspicious_functions: suspiciousFunctions.length,
            details: suspiciousFunctions,
            recommendation: suspiciousFunctions.length > 0 
                ? `พบ ${suspiciousFunctions.length} functions ที่อาจใช้ SDK เก่า - แนะนำให้อัปเดทเป็น ${targetVersion}`
                : 'ไม่พบปัญหา - ทุก function ทำงานปกติ'
        };

        // 📤 ส่งรายงานทาง LINE ถ้าเจอปัญหา
        if (sendReport && suspiciousFunctions.length > 0) {
            console.log('📨 Sending report via LINE...');
            
            const configs = await base44.asServiceRole.entities.Config.list();
            const adminLineId = configs.find(c => c.key === 'admin_line_user_id')?.value;
            const lineToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');

            if (adminLineId && lineToken) {
                let message = `🚨 ตรวจพบ Functions ที่อาจใช้ SDK เก่า\n\n`;
                message += `📊 ตรวจสอบ: ${latestLogsByFunction.size} functions\n`;
                message += `⚠️ พบปัญหา: ${suspiciousFunctions.length} functions\n\n`;
                message += `รายชื่อ Functions:\n`;
                
                suspiciousFunctions.slice(0, 5).forEach((fn, idx) => {
                    message += `${idx + 1}. ${fn.function_name}\n`;
                    message += `   Error: ${fn.last_error.substring(0, 60)}...\n\n`;
                });

                if (suspiciousFunctions.length > 5) {
                    message += `... และอีก ${suspiciousFunctions.length - 5} functions\n\n`;
                }

                message += `💡 แนะนำ: ขอให้ AI อัปเดท SDK เป็น ${targetVersion} ทั้งหมด`;

                try {
                    await fetch('https://api.line.me/v2/bot/message/push', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${lineToken}`
                        },
                        body: JSON.stringify({
                            to: adminLineId,
                            messages: [{ type: 'text', text: message }]
                        })
                    });
                    console.log('✅ Report sent to LINE');
                } catch (lineError) {
                    console.error('❌ Failed to send LINE message:', lineError);
                }
            }
        }

        const executionTime = Date.now() - startTime;

        // บันทึก log
        await base44.asServiceRole.entities.FunctionLog.create({
            function_name: 'checkOutdatedFunctions',
            run_timestamp: new Date().toISOString(),
            status: 'success',
            message: report.recommendation,
            execution_time_ms: executionTime,
            triggered_by: 'cron',
            details: report
        });

        return Response.json({
            success: true,
            ...report,
            execution_time_ms: executionTime
        });

    } catch (error) {
        console.error('❌ Error:', error);
        return Response.json({ 
            success: false, 
            error: error.message 
        }, { status: 500 });
    }
});