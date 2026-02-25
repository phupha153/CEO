// ⭐ Silent error handler - notify admin, not user
export async function handleSilentError(base44, error, context) {
    const { lineUserId, branchId, eventType } = context;
    
    console.error(`❌ ${eventType}:`, error.message);
    
    // Log to DB
    await base44.asServiceRole.entities.WebhookLog.create({
        webhook_type: 'line',
        branch_id: branchId,
        event_type: eventType,
        line_user_id: lineUserId,
        status: 'error',
        message: `${eventType} failed`,
        error_message: error.message
    }).catch(() => {});

    // Notify admin via email
    const adminEmail = Deno.env.get('admin_email');
    if (adminEmail) {
        await base44.asServiceRole.integrations.Core.SendEmail({
            to: adminEmail,
            subject: `🚨 LINE ${eventType} Error`,
            body: `Event: ${eventType}\nUser: ${lineUserId}\nBranch: ${branchId}\nError: ${error.message}`
        }).catch(e => console.error('Email send failed:', e.message));
    }
    
    // ไม่ส่งข้อความให้ user
}