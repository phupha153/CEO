import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { name, email, phone, rooms } = await req.json();

        // Validate input
        if (!name || !email || !phone || !rooms) {
            return Response.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
        }

        // ดึง admin_email จาก Secret
        const adminEmail = Deno.env.get('admin_email');
        
        if (!adminEmail) {
            return Response.json({ 
                error: 'ไม่พบอีเมลแอดมิน โปรดติดต่อเจ้าหน้าที่' 
            }, { status: 500 });
        }

        // ส่งอีเมลแจ้ง admin
        const emailBody = `
📋 มีคำขอทดลองใช้งานระบบใหม่!

👤 ชื่อ: ${name}
📧 อีเมล: ${email}
📞 เบอร์โทร: ${phone}
🏠 จำนวนห้อง: ${rooms} ห้อง

---
กรุณาติดต่อลูกค้ากลับเพื่อดำเนินการต่อ
        `.trim();

        try {
            const emailResult = await base44.integrations.Core.SendEmail({
                to: adminEmail,
                subject: `🎯 คำขอทดลองใช้งาน - ${name}`,
                body: emailBody
            });
            console.log('Email sent successfully:', emailResult);
        } catch (emailError) {
            console.error('SendEmail error:', emailError);
            throw new Error(`ไม่สามารถส่งอีเมลได้: ${emailError.message || 'Unknown error'}`);
        }

        return Response.json({ 
            success: true,
            message: 'ส่งคำขอสำเร็จ ทีมงานจะติดต่อคุณในเร็วๆ นี้' 
        });

    } catch (error) {
        console.error('Trial request error:', error);
        return Response.json({ 
            error: error.message || 'เกิดข้อผิดพลาดในการส่งคำขอ' 
        }, { status: 500 });
    }
});