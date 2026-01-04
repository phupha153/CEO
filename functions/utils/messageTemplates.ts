/**
 * Central Message Templates - แก้ที่เดียว ใช้ได้ทุกที่
 * ใช้โดย: sendPaymentReminder, sendAutomatedOverdueReminders, SendReminderDialog
 */

export function createPaymentReminderMessage(params) {
    const {
        template,           // 'advance' | 'due_date' | 'overdue'
        buildingName,
        tenantName,
        roomNumber,
        originalAmount,     // ยอดเงินก่อนค่าปรับ
        lateFee = 0,        // ค่าปรับล่าช้า
        totalAmount,        // ยอดรวมทั้งหมด
        daysOverdue = 0,    // จำนวนวันที่เกิน
        bankName,
        bankAccountNumber,
        bankAccountName
    } = params;

    if (template === 'overdue') {
        // แจ้งเตือนเกินกำหนด - ไม่มี emoji, ไม่มีลิงก์
        let message = `แจ้งเตือนค่าเช่าเกินกำหนด\n\n`;
        message += `${buildingName}\n`;
        message += `คุณ ${tenantName} ห้อง ${roomNumber}\n`;
        message += `ยอดเงิน: ${originalAmount.toLocaleString()} บาท`;
        if (lateFee > 0) {
            message += `\nค่าปรับล่าช้า: ${lateFee.toLocaleString()} บาท`;
        }
        message += `\nรวมทั้งสิ้น: ${totalAmount.toLocaleString()} บาท`;
        message += `\nเกินกำหนดมาแล้ว ${daysOverdue} วัน\n\n`;
        message += `กรุณาชำระโดยด่วน${lateFee > 0 ? ' เพื่อหลีกเลี่ยงค่าปรับเพิ่มเติม' : ''}\n\n`;
        message += `โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
        message += `กรุณาส่งหลักฐานการโอนหลังชำระเงิน\nขอบคุณครับ`;
        return message;
    }

    if (template === 'due_date') {
        // แจ้งเตือนครบกำหนด
        let message = `แจ้งเตือนค่าเช่า (ครบกำหนดวันนี้)\n\n`;
        message += `${buildingName}\n`;
        message += `คุณ ${tenantName} ห้อง ${roomNumber}\n`;
        message += `ยอดเงิน: ${totalAmount.toLocaleString()} บาท\n\n`;
        message += `โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
        message += `กรุณาส่งหลักฐานการโอนหลังชำระเงิน\nขอบคุณครับ`;
        return message;
    }

    // advance (default)
    let message = `${buildingName} - แจ้งเตือนค่าเช่าล่วงหน้า\n\n`;
    message += `สวัสดีคุณ ${tenantName}\n`;
    message += `ห้อง ${roomNumber}\n`;
    message += `ยอดเงิน: ${totalAmount.toLocaleString()} บาท\n\n`;
    message += `โอนเงินได้ที่: ${bankName} ${bankAccountNumber} (${bankAccountName})\n\n`;
    message += `กรุณาส่งหลักฐานการโอนหลังชำระเงิน\nขอบคุณครับ`;
    return message;
}