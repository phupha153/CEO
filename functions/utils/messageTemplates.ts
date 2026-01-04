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
        bankAccountName,
        // รายละเอียดค่าใช้จ่าย
        rentAmount = 0,
        waterUnits = 0,
        waterAmount = 0,
        electricityUnits = 0,
        electricityAmount = 0,
        internetAmount = 0,
        commonFeeAmount = 0,
        parkingFeeAmount = 0,
        otherAmount = 0,
        // ขั้นต่ำ
        actualWaterUnits = null,    // หน่วยน้ำจริงที่ใช้ (ถ้ามีการคิดขั้นต่ำ)
        waterMinUnits = null,       // ขั้นต่ำที่คิด
        actualElectricityUnits = null,
        electricityMinUnits = null
    } = params;

    if (template === 'overdue') {
        // 🔴 แจ้งเตือนเกินกำหนด - มี emoji เล็กน้อย
        let message = `🔴 แจ้งเตือนเกินกำหนดชำระ\n\n`;
        message += `${buildingName}\n`;
        message += `คุณ ${tenantName} ห้อง ${roomNumber}\n`;
        
        // รายละเอียดค่าใช้จ่าย
        if (rentAmount > 0 || waterAmount > 0 || electricityAmount > 0) {
            message += `\nรายละเอียด:\n`;
            if (rentAmount > 0) {
                message += `🏠 ค่าเช่า: ${rentAmount.toLocaleString()} บาท\n`;
            }
            if (electricityAmount > 0) {
                const elecUnitsDisplay = actualElectricityUnits !== null && electricityMinUnits !== null && actualElectricityUnits < electricityMinUnits
                    ? `${actualElectricityUnits} → ${electricityMinUnits} หน่วย (ขั้นต่ำ)`
                    : `${electricityUnits} หน่วย`;
                message += `⚡ ค่าไฟ (${elecUnitsDisplay}): ${electricityAmount.toLocaleString()} บาท\n`;
            }
            if (waterAmount > 0) {
                const waterUnitsDisplay = actualWaterUnits !== null && waterMinUnits !== null && actualWaterUnits < waterMinUnits
                    ? `${actualWaterUnits} → ${waterMinUnits} หน่วย (ขั้นต่ำ)`
                    : `${waterUnits} หน่วย`;
                message += `💧 ค่าน้ำ (${waterUnitsDisplay}): ${waterAmount.toLocaleString()} บาท\n`;
            }
            if (internetAmount > 0) {
                message += `📶 ค่าอินเทอร์เน็ต: ${internetAmount.toLocaleString()} บาท\n`;
            }
            if (commonFeeAmount > 0) {
                message += `🏢 ค่าส่วนกลาง: ${commonFeeAmount.toLocaleString()} บาท\n`;
            }
            if (parkingFeeAmount > 0) {
                message += `🚗 ค่าที่จอดรถ: ${parkingFeeAmount.toLocaleString()} บาท\n`;
            }
            if (otherAmount > 0) {
                message += `📋 อื่นๆ: ${otherAmount.toLocaleString()} บาท\n`;
            }
        }
        
        if (lateFee > 0) {
            message += `⚠️ ค่าปรับล่าช้า: +${lateFee.toLocaleString()} บาท\n`;
        }
        message += `💰 รวมทั้งสิ้น: ${totalAmount.toLocaleString()} บาท\n`;
        message += `เกินกำหนดมาแล้ว: ${daysOverdue} วัน\n\n`;
        message += `กรุณาชำระโดยด่วนค่ะ${lateFee > 0 ? ' เพื่อหลีกเลี่ยงค่าปรับเพิ่มเติม' : ''}\n\n`;
        message += `💳 โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
        message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
        return message;
    }

    if (template === 'due_date') {
        // ⏰ แจ้งเตือนครบกำหนด
        let message = `⏰ แจ้งเตือนค่าเช่า (ครบกำหนดวันนี้)\n\n`;
        message += `${buildingName}\n`;
        message += `คุณ ${tenantName} ห้อง ${roomNumber}\n`;
        
        // รายละเอียดค่าใช้จ่าย
        if (rentAmount > 0 || waterAmount > 0 || electricityAmount > 0) {
            message += `\nรายละเอียด:\n`;
            if (rentAmount > 0) {
                message += `🏠 ค่าเช่า: ${rentAmount.toLocaleString()} บาท\n`;
            }
            if (electricityAmount > 0) {
                const elecUnitsDisplay = actualElectricityUnits !== null && electricityMinUnits !== null && actualElectricityUnits < electricityMinUnits
                    ? `${actualElectricityUnits} → ${electricityMinUnits} หน่วย (ขั้นต่ำ)`
                    : `${electricityUnits} หน่วย`;
                message += `⚡ ค่าไฟ (${elecUnitsDisplay}): ${electricityAmount.toLocaleString()} บาท\n`;
            }
            if (waterAmount > 0) {
                const waterUnitsDisplay = actualWaterUnits !== null && waterMinUnits !== null && actualWaterUnits < waterMinUnits
                    ? `${actualWaterUnits} → ${waterMinUnits} หน่วย (ขั้นต่ำ)`
                    : `${waterUnits} หน่วย`;
                message += `💧 ค่าน้ำ (${waterUnitsDisplay}): ${waterAmount.toLocaleString()} บาท\n`;
            }
            if (internetAmount > 0) {
                message += `📶 ค่าอินเทอร์เน็ต: ${internetAmount.toLocaleString()} บาท\n`;
            }
            if (commonFeeAmount > 0) {
                message += `🏢 ค่าส่วนกลาง: ${commonFeeAmount.toLocaleString()} บาท\n`;
            }
            if (parkingFeeAmount > 0) {
                message += `🚗 ค่าที่จอดรถ: ${parkingFeeAmount.toLocaleString()} บาท\n`;
            }
            if (otherAmount > 0) {
                message += `📋 อื่นๆ: ${otherAmount.toLocaleString()} บาท\n`;
            }
        }
        
        message += `💰 รวมทั้งสิ้น: ${totalAmount.toLocaleString()} บาท\n\n`;
        message += `💳 โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
        message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
        return message;
    }

    // 📢 advance (default) - แจ้งล่วงหน้า
    let message = `📢 ${buildingName} - แจ้งเตือนค่าเช่าล่วงหน้า\n\n`;
    message += `สวัสดีค่ะคุณ ${tenantName}\n`;
    message += `ห้อง ${roomNumber}\n`;
    
    // รายละเอียดค่าใช้จ่าย
    if (rentAmount > 0 || waterAmount > 0 || electricityAmount > 0) {
        message += `\nรายละเอียด:\n`;
        if (rentAmount > 0) {
            message += `🏠 ค่าเช่า: ${rentAmount.toLocaleString()} บาท\n`;
        }
        if (electricityAmount > 0) {
            const elecUnitsDisplay = actualElectricityUnits !== null && electricityMinUnits !== null && actualElectricityUnits < electricityMinUnits
                ? `${actualElectricityUnits} → ${electricityMinUnits} หน่วย (ขั้นต่ำ)`
                : `${electricityUnits} หน่วย`;
            message += `⚡ ค่าไฟ (${elecUnitsDisplay}): ${electricityAmount.toLocaleString()} บาท\n`;
        }
        if (waterAmount > 0) {
            const waterUnitsDisplay = actualWaterUnits !== null && waterMinUnits !== null && actualWaterUnits < waterMinUnits
                ? `${actualWaterUnits} → ${waterMinUnits} หน่วย (ขั้นต่ำ)`
                : `${waterUnits} หน่วย`;
            message += `💧 ค่าน้ำ (${waterUnitsDisplay}): ${waterAmount.toLocaleString()} บาท\n`;
        }
        if (internetAmount > 0) {
            message += `📶 ค่าอินเทอร์เน็ต: ${internetAmount.toLocaleString()} บาท\n`;
        }
        if (commonFeeAmount > 0) {
            message += `🏢 ค่าส่วนกลาง: ${commonFeeAmount.toLocaleString()} บาท\n`;
        }
        if (parkingFeeAmount > 0) {
            message += `🚗 ค่าที่จอดรถ: ${parkingFeeAmount.toLocaleString()} บาท\n`;
        }
        if (otherAmount > 0) {
            message += `📋 อื่นๆ: ${otherAmount.toLocaleString()} บาท\n`;
        }
    }
    
    message += `💰 รวมทั้งสิ้น: ${totalAmount.toLocaleString()} บาท\n\n`;
    message += `💳 โอนเงินได้ที่:\n${bankName} ${bankAccountNumber}\nชื่อบัญชี: ${bankAccountName}\n\n`;
    message += `กรุณาส่งหลักฐานการโอนหลังชำระเงินค่ะ\nขอบคุณค่ะ 🙏`;
    return message;
}