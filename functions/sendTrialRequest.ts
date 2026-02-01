import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { name, email, phone, rooms } = await req.json();

        // Validate input
        if (!name || !email || !phone || !rooms) {
            return Response.json({ error: 'กรุณากรอกข้อมูลให้ครบถ้วน' }, { status: 400 });
        }

        // ส่งไปที่อีเมล admin
        const adminEmail = 'ttn2.20official@gmail.com';

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

        await base44.integrations.Core.SendEmail({
            to: adminEmail,
            subject: `🎯 คำขอทดลองใช้งาน - ${name}`,
            body: emailBody
        });

        return Response.json({ 
            success: true,
            message: 'ส่งคำขอสำเร็จ' 
        });

    } catch (error) {
        console.error('Error:', error);
        return Response.json({ 
            error: error.message 
        }, { status: 500 });
    }
});