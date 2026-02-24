// Room Import Configuration - Schema & Template Data
export const roomSchema = {
  type: "object",
  properties: {
    "หมายเลขห้อง": { type: "string" },
    "ชั้น": { type: "integer" },
    "ประเภทห้อง": { type: "string" },
    "ราคา": { type: "number" },
    "สถานะ": { type: "string" },
    "ขนาด": { type: "number" },
    "ค่าน้ำเหมา": { type: "string" },
    "จำนวนค่าน้ำเหมา": { type: "number" },
    "ค่าไฟเหมา": { type: "string" },
    "จำนวนค่าไฟเหมา": { type: "number" },
    "ค่าน้ำต่อหน่วย": { type: "number" },
    "ค่าไฟต่อหน่วย": { type: "number" },
    "ค่าส่วนกลาง": { type: "number" },
    "รายละเอียด": { type: "string" },
    "วันที่ล้างแอร์ล่าสุด": { type: "string", format: "date" }
  },
  required: ["หมายเลขห้อง", "ชั้น", "ประเภทห้อง", "ราคา"]
};

export const templateData = [
  {
    "หมายเลขห้อง": "101",
    "ชั้น": "1",
    "ประเภทห้อง": "รายเดือน",
    "ราคา": "3500",
    "สถานะ": "ว่าง",
    "ขนาด": "25",
    "ค่าน้ำเหมา": "ไม่ใช่",
    "จำนวนค่าน้ำเหมา": "",
    "ค่าไฟเหมา": "ไม่ใช่",
    "จำนวนค่าไฟเหมา": "",
    "ค่าน้ำต่อหน่วย": "18",
    "ค่าไฟต่อหน่วย": "8",
    "ค่าส่วนกลาง": "200",
    "รายละเอียด": "ห้องพักรายเดือน มีแอร์ เฟอร์นิเจอร์ครบ",
    "วันที่ล้างแอร์ล่าสุด": "2023-01-15"
  }
];

export const templateFilename = 'room_template.xlsx';

export const transformRoomData = (data) => {
  const mapRoomType = { 'รายเดือน': 'monthly', 'รายวัน': 'daily' };
  const mapStatus = { 'ว่าง': 'available', 'มีผู้เช่า': 'occupied', 'จอง': 'reserved' };
  const mapYesNo = { 'ใช่': true, 'ไม่ใช่': false, 'true': true, 'false': false };
  
  return {
    branch_id: data.branch_id, // ⭐ รับค่า branch_id ที่ผสมมาจาก additionalData
    room_number: data["หมายเลขห้อง"] || data.room_number,
    floor: data["ชั้น"] || data.floor,
    room_type: mapRoomType[data["ประเภทห้อง"]] || mapRoomType[data.room_type] || data.room_type,
    price: data["ราคา"] || data.price,
    status: mapStatus[data["สถานะ"]] || mapStatus[data.status] || data.status,
    size: data["ขนาด"] || data.size,
    is_flat_rate_water: mapYesNo[data["ค่าน้ำเหมา"]] || false,
    flat_rate_water_amount: data["จำนวนค่าน้ำเหมา"] || null,
    is_flat_rate_electricity: mapYesNo[data["ค่าไฟเหมา"]] || false,
    flat_rate_electricity_amount: data["จำนวนค่าไฟเหมา"] || null,
    water_rate: data["ค่าน้ำต่อหน่วย"] || null,
    electricity_rate: data["ค่าไฟต่อหน่วย"] || null,
    common_fee: data["ค่าส่วนกลาง"] || null,
    description: data["รายละเอียด"] || data.description,
    last_ac_cleaning_date: data["วันที่ล้างแอร์ล่าสุด"] || data.last_ac_cleaning_date
  };
};