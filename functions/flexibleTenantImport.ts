import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

/**
 * ⭐ Flexible Tenant CSV/TSV Import
 * Handles Excel exports with missing leading 0s on phone numbers
 * Supports both comma and tab delimiters
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { csv_text, branch_id } = await req.json();

    if (!csv_text || !branch_id) {
      return Response.json(
        { error: 'Missing csv_text or branch_id' },
        { status: 400 }
      );
    }

    // Parse CSV/TSV with flexible delimiter detection
    const lines = csv_text.trim().split('\n');
    if (lines.length < 2) {
      return Response.json({ error: 'CSV must have headers and data' }, { status: 400 });
    }

    // Detect delimiter (tab or comma)
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    
    // Parse headers - Clean BOM, ZWNBSP, tabs, spaces
    const headers = lines[0]
      .split(delimiter)
      .map(h => h
        .replace(/^\ufeff/, '')      // BOM
        .replace(/\u200b/g, '')      // Zero-Width Space
        .replace(/\t/g, ' ')         // Tab → Space
        .replace(/"/g, '')           // Remove quotes
        .trim()
      );

    console.log('📋 Headers:', headers);

    // Parse data rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const values = line.split(delimiter).map(v => v.replace(/"/g, '').trim());
      const record = {};
      
      headers.forEach((header, idx) => {
        record[header] = values[idx] || '';
      });

      // ⭐ CRITICAL FIX: Skip rows that are completely empty (all values are empty or just hyphens)
      const hasData = Object.values(record).some(v => v && v !== '-' && v.trim() !== '');
      if (!hasData) {
        continue; // Skip this row
      }

      rows.push(record);
    }

    console.log(`📊 Parsed ${rows.length} records`);
    console.log('Sample record:', rows[0]);

    // ⭐ Helper: แปลง Excel Date กลับเป็นเลขห้อง
    const parseRoomNumber = (value) => {
      if (!value) return '';
      const str = String(value).trim();
      
      // Pattern 1: Excel date string "YYYY-MM-DD HH:MM:SS" → "M/D"
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        const [year, month, day] = str.split(/[-\s:]/);
        return `${parseInt(month)}/${parseInt(day)}`;
      }
      
      // Pattern 2: Excel serial number (>40000 = date since 1900-01-01)
      const num = parseFloat(str);
      if (!isNaN(num) && num > 40000 && num < 60000) {
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(excelEpoch.getTime() + (num - 2) * 24 * 60 * 60 * 1000);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }
      
      // Pattern 3: Already correct format
      return str;
    };

    // ⭐ Helper: แปลงวันที่ Excel ให้ถูกต้อง (รองรับ DD/MM/YY พ.ศ.)
    const parseContractDate = (value) => {
      if (!value) return '';
      const str = String(value).trim();
      
      // Pattern 1: DD/MM/YY (2 หลัก - พ.ศ.) → YYYY-MM-DD (ค.ศ.)
      if (/^\d{1,2}\/\d{1,2}\/\d{2}$/.test(str)) {
        const [d, m, yy] = str.split('/');
        const buddhistYear = parseInt(yy);
        const christianYear = buddhistYear <= 50 
          ? 2500 + buddhistYear - 543  // 00-50 → 2000-2007
          : 2400 + buddhistYear - 543; // 51-99 → 2008-2056
        return `${christianYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      
      // Pattern 2: DD/MM/YYYY (4 หลัก)
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
        const [d, m, y] = str.split('/');
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      }
      
      // Pattern 3: Excel serial/datetime (YYYY-MM-DD or number)
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        // ⚠️ FIX YEAR BUG: 1969 → 2026 (Excel แปลง 69 ผิด)
        const [year, month, day] = str.split(/[-\s:]/);
        const yearNum = parseInt(year);
        if (yearNum < 1970) {
          // ถ้าเป็น 1969 = ควรเป็น 2026 (69 พ.ศ.)
          const correctedYear = 2500 + (yearNum - 1900) - 543;
          return `${correctedYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        }
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
      
      // Pattern 4: Excel serial number
      const num = parseFloat(str);
      if (!isNaN(num) && num > 40000 && num < 60000) {
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(excelEpoch.getTime() + (num - 2) * 24 * 60 * 60 * 1000);
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      
      return str;
    };

    // ✅ Transform and validate data (Skip empty rows)
    const tenants_data = rows
      .filter(record => {
        // ⚠️ SKIP EMPTY ROWS: ต้องมีชื่อผู้เช่าเท่านั้น
        const hasName = record['ชื่อ-นามสกุล'] && String(record['ชื่อ-นามสกุล']).trim() !== '';
        return hasName;
      })
      .map(record => {
        // Fix phone numbers (add 0 if missing)
        const phone = String(record['เบอร์โทร'] || '').trim();
        const formattedPhone = phone && phone.length === 9 ? '0' + phone : phone;

        const emergency = String(record['เบอร์ติดต่อฉุกเฉิน'] || '').trim();
        const formattedEmergency = emergency && emergency.length === 9 ? '0' + emergency : emergency;

        // ⭐ แปลงเลขห้อง (รองรับ Excel Date)
        const roomNumber = parseRoomNumber(record['เลขห้อง']);

        // ⭐ แปลงวันที่ (รองรับ DD/MM/YY พ.ศ. และ Excel serial ที่ผิด)
        const checkInDate = parseContractDate(record['วันเริ่มสัญญา']);
        const checkOutDate = parseContractDate(record['วันสิ้นสุดสัญญา']);

        return {
          full_name: (record['ชื่อ-นามสกุล'] || '').trim(),
          phone: formattedPhone,
          gender: (record['เพศ'] || '').toLowerCase(),
          age: record['อายุ'] ? parseInt(record['อายุ']) : undefined,
          line_id: (record['LINE ID'] || '').trim(),
          national_id: String(record['เลขบัตรประชาชน'] || '').trim(),
          email: (record['อีเมล'] || '').trim(),
          address: (record['ที่อยู่'] || '').trim(),
          emergency_contact: formattedEmergency,
          notes: (record['หมายเหตุ'] || '').trim(),
          status: 'active',
          // Booking data
          _booking: {
            room_number: roomNumber,
            check_in_date: checkInDate,
            check_out_date: checkOutDate,
            deposit_amount: record['เงินมัดจำ'] ? parseFloat(record['เงินมัดจำ']) : 0,
            booking_status: (record['สถานะการจอง'] || 'active').toLowerCase()
          }
        };
      });

    // ✅ Return parsed data for preview (NOT auto-import)
    return Response.json({
      success: true,
      data: tenants_data,
      count: tenants_data.length,
      message: `อ่านข้อมูลสำเร็จ: ${tenants_data.length} รายการ`
    });
  } catch (error) {
    console.error('❌ Import error:', error);
    return Response.json(
      { error: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
});