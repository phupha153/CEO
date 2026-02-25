import { getChatDisplayName } from './lineHelpers.js';

// ⭐ บันทึก LineMessage พร้อมชื่อแชทจาก "เลขห้อง - ชื่อผู้เช่า"
export async function saveIncomingLineMessage(base44, lineUserId, tenant, messageType, messageContent, replyToken, branchId) {
    try {
        const finalBranchId = tenant?.branch_id || branchId;

        // ⭐ สร้างชื่อแชทเป็น "เลขห้อง - ชื่อผู้เช่า"
        const { displayName, pictureUrl } = await getChatDisplayName(base44, tenant, lineUserId, finalBranchId);

        await base44.asServiceRole.entities.LineMessage.create({
            branch_id: finalBranchId,
            tenant_id: tenant?.id || null,
            line_user_id: lineUserId,
            line_display_name: displayName,
            line_picture_url: pictureUrl,
            direction: 'incoming',
            message_type: messageType,
            content: messageContent,
            reply_token: replyToken
        });

        console.log(`💾 Saved incoming message (${messageType})`);
    } catch (saveError) {
        // ⭐ เงียบไว้ - ไม่ log error
        console.log('⚠️ Failed to save message to LineMessage');
    }
}