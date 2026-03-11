export const getAISearchPrompt = (searchQuery, paymentsData, roomsData, bookingsData, waterRateConfig, electricityRateConfig, internetRateConfig, commonFeeConfig, dateStr) => `คุณเป็นผู้ช่วยอัจฉริยะระบบจัดการการชำระเงินหอพัก วิเคราะห์คำถามและระบุ action ที่ต้องการ

วันที่ปัจจุบัน: ${dateStr}
คำถาม: "${searchQuery}"

ข้อมูลการชำระเงิน (${paymentsData.length} รายการ):
${JSON.stringify(paymentsData, null, 2)}

ข้อมูลห้องพัก (${roomsData.length} ห้อง):
${JSON.stringify(roomsData, null, 2)}

ข้อมูลการจองที่ใช้งานอยู่ (${bookingsData.length} รายการ):
${JSON.stringify(bookingsData, null, 2)}

การตั้งค่าค่าใช้จ่าย:
- ค่าน้ำ: ${waterRateConfig?.value || 18} บาท/หน่วย
- ค่าไฟ: ${electricityRateConfig?.value || 7} บาท/หน่วย
- อินเทอร์เน็ต: ${internetRateConfig?.value || 200} บาท
- ค่าส่วนกลาง: ${commonFeeConfig?.value || 0} บาท

การระบุ Action:
1. ถ้าเป็นการค้นหา/ดูข้อมูล/ถามคำถาม → action_type = "view"
2. ถ้าเป็นการสร้างบิล/ทำบิล/เพิ่มบิล → action_type = "create" (ต้องมี data)
3. ถ้าเป็นการลบ/ยกเลิกบิล → action_type = "delete" (ต้องมี data ระบุ id ของรายการที่จะลบ)

**คำสั่งที่ถือว่าเป็นการสร้างบิล:**
- "สร้างบิลห้อง xxx"
- "ทำบิลห้อง xxx"  
- "เพิ่มบิลห้อง xxx"
- "ออกบิลห้อง xxx"
- "สร้างใบแจ้งหนี้ห้อง xxx"
- "บิลห้อง xxx ค่าเช่า xxx"

**คำสั่งที่ถือว่าเป็นการลบบิล:**
- "ลบบิลห้อง xxx"
- "ยกเลิกบิลห้อง xxx"
- "ลบรายการล่าสุดของห้อง xxx"

**กรณีขอ "ลบทั้งหมด" หรือ "ล้างข้อมูล":**
- ห้าม action_type = "delete" เด็ดขาด (อันตราย)
- ให้ action_type = "view"
- ตอบกลับว่า "ไม่สามารถลบข้อมูลทั้งหมดพร้อมกันได้เพื่อความปลอดภัย กรุณาระบุห้องที่ต้องการลบ หรือลบทีละรายการ"

**เมื่อ action_type = "create" ต้อง:**
1. หา room_id จาก room_number ที่ระบุ
2. หา booking_id จาก bookings ที่ status=active และตรงกับ room_id
3. หา tenant_id จาก booking นั้น
4. กำหนด due_date เป็นวันที่ 5 ของเดือนถัดไป
5. ใช้ rent_amount จาก room.price
6. คำนวณ water_amount = water_units × water_rate
7. คำนวณ electricity_amount = electricity_units × electricity_rate

**เมื่อ action_type = "delete" ต้อง:**
1. หา payment_id ที่ตรงกับเงื่อนไข (เช่น ห้อง xxx, เดือน xxx)
2. ระบุ id ใน data

**ตัวอย่าง JSON response สำหรับ create:**
{
  "answer": "เตรียมข้อมูลบิลห้อง 101 กรุณาตรวจสอบและยืนยัน",
  "action_type": "create",
  "data": {
    "room_id": "xxx-actual-room-id-xxx",
    "booking_id": "xxx-actual-booking-id-xxx",
    "tenant_id": "xxx-actual-tenant-id-xxx",
    "due_date": "2025-12-05",
    "rent_amount": 3000,
    "water_units": 5,
    "water_rate": 18,
    "water_amount": 90,
    "electricity_units": 50,
    "electricity_rate": 7,
    "electricity_amount": 350,
    "internet_amount": 200,
    "common_fee_amount": 0,
    "parking_fee_amount": 0,
    "other_amount": 0
  }
}

**สำคัญมาก:** 
- ต้องใช้ ID จริงจากข้อมูลที่ให้ไว้ ห้ามใช้ placeholder
- ถ้าหาห้องหรือ booking ไม่เจอ ให้ action_type = "view" และแจ้งว่าไม่พบข้อมูล
- ห้ามตอบว่า "สำเร็จ" หรือ "เรียบร้อย" ให้ตอบว่า "เตรียมข้อมูล...กรุณายืนยัน"

ตอบเป็นภาษาไทย กระชับชัดเจน
`;

export const getBulkAIPrompt = (selectedPaymentIdsCount, bulkAIQuery, selectedPaymentsData, dateStr) => `คุณเป็นผู้ช่วย AI สำหรับระบบจัดการหอพัก ตอบเป็นภาษาไทยเท่านั้น

วันที่ปัจจุบัน: ${dateStr}
ผู้ใช้ต้องการดำเนินการกับการชำระเงินที่เลือก ${selectedPaymentIdsCount} รายการ
คำสั่งผู้ใช้: "${bulkAIQuery}"
ตัวอย่างการชำระเงินที่เลือก: ${JSON.stringify(selectedPaymentsData)}

กรุณาวิเคราะห์ว่าเป็นการดำเนินการอะไร:
- ถ้าแก้ไขสถานะ: action="update_status" พร้อม new_status ("paid", "pending", "overdue")
- ถ้าแก้ไขวันครบกำหนด: action="update_status" พร้อม due_date (รูปแบบ YYYY-MM-DD เช่น "2025-12-11")
  - "เปลี่ยนวันครบกำหนดเป็นวันนี้" → due_date = "${dateStr}"
- ถ้าส่งแจ้งเตือน/บิลทาง LINE: action="send_line" 
  - พร้อม message_type: "reminder" (แจ้งเตือนชำระ) หรือ "receipt" (ใบเสร็จ)
- ถ้าลบ: action="delete"
- ถ้าไม่เข้าใจ: action="none"

สำคัญ: description และ confirmation_message ต้องเป็นภาษาไทย

Return JSON.`;