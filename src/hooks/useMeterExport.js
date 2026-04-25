import { format, parseISO } from "date-fns";
import { toast } from "sonner";

export function useMeterExport({ meterReadings, rooms, roomsMap, bookingsMap, tenantsMap, getLatestReading, selectedMonth }) {
  const handleExport = (exportData = false) => {
    const BOM = '\uFEFF';
    const now = new Date();
    let headers, rows, filename;

    if (exportData) {
      // ✅ กรองเฉพาะเดือนที่เลือก (selectedMonth) เดือนเดียว
      const [selYear, selMonth] = selectedMonth.split('-').map(Number);
      const filtered = meterReadings
        .filter(r => {
          try {
            const d = parseISO(r.reading_date);
            return d.getFullYear() === selYear && (d.getMonth() + 1) === selMonth;
          } catch {
            return false;
          }
        })
        .sort((a, b) => b.reading_date.localeCompare(a.reading_date));

      headers = ['วันที่', 'หมายเลขห้อง', 'ชื่อผู้เช่า', 'น้ำครั้งก่อน', 'น้ำปัจจุบัน', 'หน่วยน้ำ', 'ไฟครั้งก่อน', 'ไฟปัจจุบัน', 'หน่วยไฟ'];
      rows = filtered.map(r => {
        const room = roomsMap.get(r.room_id);
        const bk = bookingsMap.get(r.room_id);
        const t = bk ? tenantsMap.get(bk.tenant_id) : null;
        return [
          r.reading_date,
          room?.room_number || '-',
          t?.full_name || '-',
          r.water_previous ?? '',
          r.water_current ?? '',
          r.water_units ?? '',
          r.electricity_previous ?? '',
          r.electricity_current ?? '',
          r.electricity_units ?? ''
        ];
      });

      filename = `ข้อมูลมิเตอร์_${selectedMonth}.csv`;
      toast.success(`ดาวน์โหลดข้อมูลเดือน ${selectedMonth} จำนวน ${filtered.length} รายการสำเร็จ`);
    } else {
      headers = ['หมายเลขห้อง', 'มิเตอร์น้ำครั้งก่อน', 'มิเตอร์น้ำปัจจุบัน', 'มิเตอร์ไฟครั้งก่อน', 'มิเตอร์ไฟปัจจุบัน'];
      rows = [...rooms]
        .sort((a, b) => {
          if ((a.floor || 0) !== (b.floor || 0)) return (a.floor || 0) - (b.floor || 0);
          return (parseFloat(a.room_number.replace(/\D/g, '')) || 0) - (parseFloat(b.room_number.replace(/\D/g, '')) || 0);
        })
        .map(room => {
          const l = getLatestReading(room.id);
          return [room.room_number, l?.water_current || 0, '', l?.electricity_current || 0, ''];
        });
      filename = `บันทึกมิเตอร์_${format(now, 'yyyy-MM-dd')}.xlsx`;
      toast.success('ดาวน์โหลดไฟล์สำเร็จ');
    }

    const csvContent = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return { handleExport };
}