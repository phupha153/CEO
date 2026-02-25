// ⭐ Helper: สร้างชื่อแชทจาก "เลขห้อง - ชื่อผู้เช่า"
export async function getChatDisplayName(base44, tenant, lineUserId, branchId) {
    if (!tenant?.full_name) {
        // ถ้าไม่มี tenant เชื่อมต่อ ใช้ LINE Profile
        try {
            const lineToken = await getLineTokenForHelper(base44, branchId);
            if (lineToken) {
                const profileRes = await fetch(`https://api.line.me/v2/bot/profile/${lineUserId}`, {
                    headers: { 'Authorization': `Bearer ${lineToken}` }
                });
                if (profileRes.ok) {
                    const profile = await profileRes.json();
                    return { displayName: profile.displayName, pictureUrl: profile.pictureUrl };
                }
            }
        } catch (e) {
            console.log('⚠️ Could not fetch LINE profile');
        }
        return { displayName: 'Unknown', pictureUrl: null };
    }

    // ⭐ Tenant เชื่อมต่อแล้ว → ใช้ "เลขห้อง - ชื่อผู้เช่า"
    try {
        const bookingResult = await base44.asServiceRole.entities.Booking.filter({
            tenant_id: tenant.id,
            status: 'active'
        });
        const activeBooking = Array.isArray(bookingResult) ? bookingResult[0] : bookingResult;

        if (activeBooking?.room_id) {
            const roomResult = await base44.asServiceRole.entities.Room.filter({ id: activeBooking.room_id });
            const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;

            if (room?.room_number) {
                return {
                    displayName: `${room.room_number} - ${tenant.full_name}`,
                    pictureUrl: null
                };
            }
        }
    } catch (e) {
        console.log('⚠️ Could not fetch room for tenant');
    }

    return { displayName: tenant.full_name, pictureUrl: null };
}

// ⭐ Helper: ดึง LINE Token
async function getLineTokenForHelper(base44, branchId) {
    try {
        const configs = await base44.asServiceRole.entities.Config.list();
        
        if (branchId) {
            const branchToken = configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branchId);
            if (branchToken?.value?.trim()) return branchToken.value.trim();
        }

        const globalToken = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
        if (globalToken?.value?.trim()) return globalToken.value.trim();

        return Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')?.trim() || null;
    } catch (error) {
        console.error('❌ Error fetching LINE token:', error);
        return Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN')?.trim() || null;
    }
}