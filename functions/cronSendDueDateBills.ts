import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { parseISO, differenceInDays } from 'npm:date-fns';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        console.log('🔔 Starting automatic due date/overdue bill sending...');
        
        // ดึงข้อมูลทั้งหมด
        const [branches, payments, configs] = await Promise.all([
            base44.asServiceRole.entities.Branch.list(),
            base44.asServiceRole.entities.Payment.list('-created_date', 5000),
            base44.asServiceRole.entities.Config.list()
        ]);
        
        console.log(`📊 Loaded: ${branches.length} branches, ${payments.length} payments`);
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayDay = today.getDate();
        
        let dueCount = 0;
        let overdueCount = 0;
        const errors = [];
        
        // จัดกลุ่ม payments ตามสาขา
        const paymentsByBranch = {};
        for (const payment of payments) {
            if (payment.status === 'paid' || !payment.due_date) continue;
            
            if (!paymentsByBranch[payment.branch_id]) {
                paymentsByBranch[payment.branch_id] = [];
            }
            paymentsByBranch[payment.branch_id].push(payment);
        }
        
        // วนตามแต่ละสาขา
        for (const branch of branches) {
            const branchPayments = paymentsByBranch[branch.id] || [];
            if (branchPayments.length === 0) continue;
            
            // หา pay_day ของสาขา
            const payDayConfig = configs.find(c => 
                c.key === 'pay_day' && c.branch_id === branch.id
            );
            const payDay = payDayConfig ? parseInt(payDayConfig.value) : 5;
            
            console.log(`\n📍 Branch: ${branch.branch_name} - Pay Day: ${payDay}`);
            
            // แยกบิลครบกำหนด vs เกินกำหนด
            const dueToday = [];
            const overdue = [];
            
            for (const payment of branchPayments) {
                try {
                    const dueDate = parseISO(payment.due_date);
                    const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                    const daysOverdue = differenceInDays(today, dueDateStart);
                    
                    // ถ้าครบกำหนดพอดีวันนี้ (และยังไม่ส่งบิล)
                    if (daysOverdue === 0 && !payment.due_date_reminder_sent_date) {
                        dueToday.push(payment);
                    }
                    // ถ้าเกินกำหนดไปแล้ว
                    else if (daysOverdue > 0) {
                        overdue.push(payment);
                    }
                } catch (err) {
                    console.warn(`⚠️ Invalid due_date for payment ${payment.id}`);
                }
            }
            
            console.log(`  📅 Due today: ${dueToday.length}, 🔴 Overdue: ${overdue.length}`);
            
            // ส่งบิลครบกำหนด
            if (dueToday.length > 0) {
                try {
                    const result = await base44.asServiceRole.functions.invoke('sendPaymentReminder', {
                        branch_id: branch.id,
                        template: 'due_date'
                    });
                    
                    if (result.data?.success) {
                        dueCount += result.data.sent || 0;
                        console.log(`  ✅ Sent ${result.data.sent} due date reminders`);
                    }
                } catch (err) {
                    console.error(`  ❌ Error sending due date reminders:`, err.message);
                    errors.push({ branch: branch.branch_name, type: 'due_date', error: err.message });
                }
            }
            
            // ส่งบิลเกินกำหนด (เฉพาะที่เกินมาแล้ว 1, 3, 7 วัน)
            const overdueToSend = overdue.filter(p => {
                const dueDate = parseISO(p.due_date);
                const dueDateStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                const daysOver = differenceInDays(today, dueDateStart);
                
                // ส่งในวันที่ 1, 3, 7 หลังเกินกำหนด
                return [1, 3, 7].includes(daysOver);
            });
            
            if (overdueToSend.length > 0) {
                try {
                    const result = await base44.asServiceRole.functions.invoke('sendPaymentReminder', {
                        branch_id: branch.id,
                        template: 'overdue'
                    });
                    
                    if (result.data?.success) {
                        overdueCount += result.data.sent || 0;
                        console.log(`  ✅ Sent ${result.data.sent} overdue reminders`);
                    }
                } catch (err) {
                    console.error(`  ❌ Error sending overdue reminders:`, err.message);
                    errors.push({ branch: branch.branch_name, type: 'overdue', error: err.message });
                }
            }
        }
        
        console.log(`\n🎯 Summary: ${dueCount} due date, ${overdueCount} overdue sent`);
        
        return Response.json({
            success: true,
            sent: {
                dueDate: dueCount,
                overdue: overdueCount,
                total: dueCount + overdueCount
            },
            errors: errors.length > 0 ? errors : undefined
        });
        
    } catch (error) {
        console.error('❌ Cron job error:', error);
        return Response.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
});