import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        let paymentsRes = await base44.asServiceRole.entities.Payment.filter(
            { status: 'pending' }, '-created_date', 500, 0
        );
        
        let payments = Array.isArray(paymentsRes) ? paymentsRes : Object.values(paymentsRes || {});
        
        const waiting = payments.filter(p => p.notes && p.notes.includes('รอตรวจสอบ'));
        
        return Response.json({
            count: waiting.length,
            samples: waiting.slice(0, 5).map(p => ({
                id: p.id,
                has_slip: !!p.payment_slip_url,
                has_branch: !!p.branch_id,
                notes: p.notes,
                slip_url: p.payment_slip_url,
                branch_id: p.branch_id,
                passed_filter: (
                    p.payment_slip_url && 
                    p.branch_id &&
                    p.notes && 
                    p.notes.includes('รอตรวจสอบ') &&
                    !p.notes.includes('โอนเงินไปผิดบัญชี') &&
                    !p.notes.includes('ยังไม่ได้ตั้งค่าบัญชีธนาคาร')
                )
            }))
        });
    } catch (e) {
        return Response.json({ error: e.message }, { status: 500 });
    }
});