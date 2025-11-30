import { createClientFromRequest } from 'npm:@base44/sdk@0.7.1';
import JSZip from 'npm:jszip@3.10.1';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // ตรวจสอบ Authentication
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ 
                success: false,
                error: 'Unauthorized' 
            }, { status: 401 });
        }

        const { paymentIds } = await req.json();

        if (!paymentIds || !Array.isArray(paymentIds) || paymentIds.length === 0) {
            return Response.json({ 
                success: false,
                error: 'Missing or invalid paymentIds array' 
            }, { status: 400 });
        }

        console.log(`Starting bulk receipt download for ${paymentIds.length} payments`);

        // ดึงข้อมูลทั้งหมดที่จำเป็น
        const payments = await base44.asServiceRole.entities.Payment.list();
        const rooms = await base44.asServiceRole.entities.Room.list();
        const tenants = await base44.asServiceRole.entities.Tenant.list();

        // กรองเฉพาะ payments ที่ต้องการและชำระแล้ว
        const targetPayments = payments.filter(p => 
            paymentIds.includes(p.id) && p.status === 'paid'
        );

        if (targetPayments.length === 0) {
            return Response.json({ 
                success: false,
                error: 'No paid payments found in the provided IDs' 
            }, { status: 400 });
        }

        console.log(`Found ${targetPayments.length} paid payments to process`);

        // ตรวจสอบว่ามีรูปใบเสร็จหรือยัง
        const paymentsWithImages = targetPayments.filter(p => p.receipt_image_url);
        const paymentsWithoutImages = targetPayments.filter(p => !p.receipt_image_url);

        if (paymentsWithoutImages.length > 0) {
            const roomNumbers = paymentsWithoutImages.map(p => {
                const room = rooms.find(r => r.id === p.room_id);
                return room?.room_number || 'N/A';
            }).join(', ');

            return Response.json({ 
                success: false,
                error: `กรุณาสร้างใบเสร็จ PNG ก่อนสำหรับห้อง: ${roomNumbers}`,
                missing_count: paymentsWithoutImages.length,
                has_images_count: paymentsWithImages.length
            }, { status: 400 });
        }

        // สร้าง ZIP file
        const zip = new JSZip();
        let successCount = 0;
        let errorCount = 0;

        for (const payment of targetPayments) {
            try {
                const room = rooms.find(r => r.id === payment.room_id);
                const tenant = tenants.find(t => t.id === payment.tenant_id);
                
                // ดาวน์โหลดรูปจาก URL
                const imageResponse = await fetch(payment.receipt_image_url);
                if (!imageResponse.ok) {
                    throw new Error(`Failed to fetch image: ${imageResponse.status}`);
                }
                
                const imageBuffer = await imageResponse.arrayBuffer();

                // ตั้งชื่อไฟล์ตามห้องและวันที่
                const roomNumber = room?.room_number || 'N-A';
                const tenantName = tenant?.full_name || 'N-A';
                const paymentDate = payment.payment_date 
                    ? payment.payment_date.split('T')[0] 
                    : 'no-date';
                
                const fileName = `ใบเสร็จ_ห้อง${roomNumber}_${tenantName}_${paymentDate}.png`
                    .replace(/[<>:"/\\|?*]/g, '_');

                // เพิ่มไฟล์เข้า ZIP
                zip.file(fileName, imageBuffer);
                
                successCount++;
                console.log(`Success: ${fileName}`);

            } catch (error) {
                console.error(`Error processing payment ${payment.id}:`, error);
                errorCount++;
            }
        }

        if (successCount === 0) {
            return Response.json({ 
                success: false,
                error: 'Failed to download any receipts' 
            }, { status: 500 });
        }

        // สร้างไฟล์ ZIP
        console.log('Creating ZIP file...');
        const zipBlob = await zip.generateAsync({ type: 'uint8array' });

        // ส่งไฟล์ ZIP กลับไป
        return new Response(zipBlob, {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename=ใบเสร็จ_${successCount}รายการ_${new Date().toISOString().split('T')[0]}.zip`
            }
        });

    } catch (error) {
        console.error('Error in generateMultipleReceipts:', error);
        return Response.json({ 
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});