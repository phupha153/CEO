/**
 * ⭐ Format tenant display name as "Room Number Tenant Name"
 * Used in LINE messages to show proper tenant identification
 */
export async function formatTenantDisplayName(base44, tenant) {
    try {
        if (!tenant?.id) return 'ไม่ทราบ';

        // ⭐ ดึง room_number จาก room_id ใน booking
        let roomNumber = '';
        try {
            // หาบิลแรกของผู้เช่า
            const bookings = await base44.asServiceRole.entities.Booking.filter({
                tenant_id: tenant.id,
                status: 'active'
            });
            
            const activeBooking = Array.isArray(bookings) ? bookings[0] : bookings;
            
            if (activeBooking?.room_id) {
                const roomResult = await base44.asServiceRole.entities.Room.filter({
                    id: activeBooking.room_id
                });
                const room = Array.isArray(roomResult) ? roomResult[0] : roomResult;
                if (room) roomNumber = room.room_number;
            }
        } catch (e) {
            console.log('⚠️ Could not fetch room:', e.message);
        }

        // ⭐ แสดง "เลขห้อง ชื่อผู้เช่า"
        return roomNumber && tenant?.full_name
            ? `${roomNumber} ${tenant.full_name}`
            : tenant?.full_name || 'ไม่ทราบ';
            
    } catch (error) {
        console.error('❌ Error formatting tenant name:', error.message);
        return tenant?.full_name || 'ไม่ทราบ';
    }
}