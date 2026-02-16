import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages } = await req.json();

    if (!messages || messages.length === 0) {
      return Response.json({ error: 'No messages provided' }, { status: 400 });
    }

    // รวมข้อความล่าสุด 10 ข้อความเพื่อให้ AI วิเคราะห์
    const recentMessages = messages.slice(-10);
    const chatContext = recentMessages
      .map(m => `[${m.direction === 'outgoing' ? 'เจ้าหน้าที่' : 'ลูกค้า'}]: ${m.content}`)
      .join('\n');

    console.log('📝 Chat Context for AI:', chatContext);

    // เรียกใช้ AI เพื่อวิเคราะห์ข้อมูล
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `คุณเป็นผู้ช่วยระบบจัดการหอพัก วิเคราะห์บทสนทนาด้านล่างและดึงข้อมูลสำคัญของผู้เช่าออกมา:

${chatContext}

กรุณาดึงข้อมูลต่อไปนี้ (ถ้าไม่มีข้อมูลให้ใส่ null):
- ชื่อ-นามสกุลผู้เช่า
- เบอร์โทรศัพท์
- ที่อยู่
- เลขบัตรประชาชน (13 หลัก)
- เลขห้องที่ต้องการเช่า (ถ้ามีหลายห้อง เช่น "105,106,107" ให้แยกเป็น array ["105", "106", "107"])
- วันที่เริ่มเช่า (รูปแบบ YYYY-MM-DD)
- จำนวนเงินมัดจำ

ถ้าไม่พบข้อมูลให้ใส่ null แทน`,
      response_json_schema: {
        type: "object",
        properties: {
          full_name: { type: ["string", "null"] },
          phone: { type: ["string", "null"] },
          address: { type: ["string", "null"] },
          national_id: { type: ["string", "null"] },
          room_number: { type: ["string", "null"] },
          room_numbers: { 
            type: ["array", "null"],
            items: { type: "string" }
          },
          check_in_date: { type: ["string", "null"] },
          deposit_amount: { type: ["number", "null"] }
        }
      }
    });

    console.log('✅ AI Analysis Result:', result);

    return Response.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('❌ Error:', error);
    return Response.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
});