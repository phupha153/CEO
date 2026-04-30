// ⭐ Employee Expense Handler - แยกออกจาก lineWebhookHandler เพื่อลดขนาดไฟล์
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    // This file is not meant to be called directly - logic is imported by lineWebhookHandler
    return new Response(JSON.stringify({ message: 'Not a standalone endpoint' }), { status: 200 });
});