import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

async function getLineToken(base44, branchId = null) {
    try {
        const configs = await base44.asServiceRole.entities.Config.list();
        
        // ลำดับความสำคัญ: branch-specific → global from Config → Environment Variable
        
        // 1. ลองหา token เฉพาะสาขาก่อน
        if (branchId) {
            const branchToken = configs.find(c => c.key === 'line_channel_access_token' && c.branch_id === branchId);
            if (branchToken?.value?.trim()) {
                console.log(`✅ Using branch-specific token (${branchId.substring(0, 8)}...)`);
                return branchToken.value.trim();
            }
        }
        
        // 2. ถ้าไม่มี ให้หา global token จาก Config
        const globalToken = configs.find(c => c.key === 'line_channel_access_token' && !c.branch_id);
        if (globalToken?.value?.trim()) {
            console.log('✅ Using global token from Config database');
            return globalToken.value.trim();
        }
        
        // 3. สุดท้ายค่อยใช้ Environment Variable (token เก่า)
        const envToken = Deno.env.get('LINE_CHANNEL_ACCESS_TOKEN');
        if (envToken?.trim()) {
            console.log('⚠️ Fallback: Using token from Environment Variable');
            return envToken.trim();
        }
        
        return null;
    } catch (error) {
        console.error('❌ Error fetching LINE token:', error);
        return null;
    }
}

// ฟังก์ชันแปลงตัวเลขเป็นตัวหนังสือไทย
function numberToThaiText(number) {
  if (!number || number === 0) return 'ศูนย์บาทถ้วน';
  
  const numbers = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
  const positions = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];
  
  const parts = number.toFixed(2).split('.');
  const integerPart = parseInt(parts[0]);
  const decimalPart = parseInt(parts[1]);
  
  function convertInteger(num) {
    if (num === 0) return '';
    
    const numStr = num.toString();
    const len = numStr.length;
    let result = '';
    
    for (let i = 0; i < len; i++) {
      const digit = parseInt(numStr[i]);
      const position = len - i - 1;
      
      if (digit === 0) continue;
      
      if (position === 1 && digit === 1) {
        result += 'สิบ';
      } else if (position === 1 && digit === 2) {
        result += 'ยี่สิบ';
      } else if (position === 0 && digit === 1 && len > 1) {
        result += 'เอ็ด';
      } else {
        result += numbers[digit] + positions[position];
      }
    }
    
    return result;
  }
  
  let text = convertInteger(integerPart) + 'บาท';
  
  if (decimalPart > 0) {
    text += convertInteger(decimalPart) + 'สตางค์';
  } else {
    text += 'ถ้วน';
  }
  
  return text;
}

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        // ✅ Parse request body first
        let paymentId;
        let isInternal = false;
        try {
            const body = await req.json();
            paymentId = body.paymentId;
            isInternal = body.isInternal === true;
            console.log('📝 Request body parsed:', { paymentId, isInternal });
        } catch (jsonError) {
            console.error('JSON parse error:', jsonError);
            return Response.json({ 
                success: false,
                error: 'รูปแบบข้อมูลไม่ถูกต้อง',
                message: 'Invalid JSON format in request body',
                details: jsonError.message
            }, { status: 400 });
        }

        if (!paymentId) {
            console.error('❌ Missing paymentId in request');
            return Response.json({ 
                success: false,
                error: 'ไม่พบข้อมูล Payment ID',
                message: 'paymentId is required'
            }, { status: 400 });
        }

        // ✅ ตรวจสอบ authentication ถ้าไม่ได้เป็นการเรียกจากระบบภายใน
        let user = null;
        if (!isInternal) {
            try {
                user = await base44.auth.me();
            } catch (authError) {
                console.error('Authentication error:', authError);
                return Response.json({ 
                    success: false,
                    error: 'ไม่ได้รับอนุญาต กรุณาเข้าสู่ระบบใหม่',
                    message: 'Unauthorized - Please login again'
                }, { status: 401 });
            }

            if (!user) {
                return Response.json({ 
                    success: false,
                    error: 'ไม่ได้รับอนุญาต',
                    message: 'User not authenticated'
                }, { status: 401 });
            }
            console.log('User authenticated:', user.email);
        } else {
            console.log('🔄 Internal call - bypassing auth check');
        }

        // ดึงข้อมูล payment โดยตรง
        console.log('🔍 Fetching payment:', paymentId);
        let payments;
        try {
            payments = await base44.asServiceRole.entities.Payment.filter({ id: paymentId });
            if (!Array.isArray(payments)) {
                payments = [payments];
            }
        } catch (dbError) {
            console.error('Database error:', dbError);
            return Response.json({ 
                success: false,
                error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้',
                message: 'Database connection error',
                details: dbError.message
            }, { status: 500 });
        }

        const payment = Array.isArray(payments) ? payments[0] : null;

        if (!payment) {
            console.error('❌ Payment not found:', paymentId);
            return Response.json({ 
                success: false,
                error: 'ไม่พบข้อมูลการชำระเงิน',
                message: 'Payment not found',
                paymentId: paymentId
            }, { status: 404 });
        }

        console.log('✅ Payment found:', payment.id, 'Status:', payment.status);

        // 🔒 Security: Branch Access Check
        if (!isInternal && payment.branch_id && user) {
            const userAccessibleBranches = user.accessible_branches;
            const isDeveloper = user.custom_role === 'developer';
            const isOwner = user.custom_role === 'owner';
            
            if (!isDeveloper && !isOwner) {
                if (userAccessibleBranches && !userAccessibleBranches.includes(payment.branch_id)) {
                    return Response.json({ 
                        success: false,
                        error: 'ไม่มีสิทธิ์เข้าถึงสาขานี้',
                        message: 'Branch access denied'
                    }, { status: 403 });
                }
            }
        }

        const lineToken = await getLineToken(base44, payment.branch_id);
        if (!lineToken) {
            console.error('❌ LINE token not available');
            return Response.json({ 
                success: false,
                error: 'ระบบ LINE ยังไม่ได้ตั้งค่า',
                message: 'LINE token not configured'
            }, { status: 500 });
        }

        if (payment.status !== 'paid') {
            console.error('❌ Payment not paid yet:', payment.status);
            return Response.json({ 
                success: false,
                error: 'รายการนี้ยังไม่ได้ชำระเงิน',
                message: `Payment status is "${payment.status}", not "paid"`,
                currentStatus: payment.status
            }, { status: 400 });
        }

        // ⭐ ดึง tenant โดยตรงจาก tenant_id ก่อน (วิธีที่เชื่อถือได้ที่สุด)
        console.log('📥 Fetching tenant directly by ID:', payment.tenant_id);
        let tenant = null;
        let room = null;
        let configs = [];
        
        try {
            // ⭐ ดึง tenant โดยตรงด้วย filter แทน list (เพื่อไม่พลาดข้อมูล)
            if (payment.tenant_id) {
                const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id });
                if (Array.isArray(tenantResult) && tenantResult.length > 0) {
                    tenant = tenantResult[0];
                } else if (tenantResult && !Array.isArray(tenantResult)) {
                    tenant = tenantResult;
                }
                console.log(`✅ Tenant by ID: ${tenant?.full_name || 'not found'}`);
            }
            
            // ดึง room โดยตรง
            if (payment.room_id) {
                const roomResult = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
                if (Array.isArray(roomResult) && roomResult.length > 0) {
                    room = roomResult[0];
                } else if (roomResult && !Array.isArray(roomResult)) {
                    room = roomResult;
                }
                console.log(`✅ Room by ID: ${room?.room_number || 'not found'}`);
            }
            
            // ดึง configs
            configs = await base44.asServiceRole.entities.Config.list();
            if (!Array.isArray(configs)) configs = [];
            
        } catch (fetchError) {
            console.error('❌ Error fetching direct data:', fetchError);
        }
        
        // ⭐ ถ้าหา tenant ไม่เจอด้วย filter ลองหาจาก booking
        if (!tenant && payment.booking_id) {
            console.log('🔍 Trying to find tenant via booking_id:', payment.booking_id);
            try {
                const bookingResult = await base44.asServiceRole.entities.Booking.filter({ id: payment.booking_id });
                const booking = Array.isArray(bookingResult) ? bookingResult[0] : bookingResult;
                
                if (booking?.tenant_id) {
                    const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ id: booking.tenant_id });
                    tenant = Array.isArray(tenantResult) ? tenantResult[0] : tenantResult;
                    if (tenant) {
                        console.log(`✅ Found tenant via booking: ${tenant.full_name}`);
                    }
                }
            } catch (err) {
                console.error('❌ Error fetching via booking:', err.message);
            }
        }

        console.log(`✅ Final result - Tenant: ${!!tenant} (${tenant?.full_name || 'null'}), Room: ${!!room} (${room?.room_number || 'null'})`)

        if (!tenant) {
            console.error('❌ Tenant not found:', payment.tenant_id);
            console.error('❌ Debug info - payment:', { 
                id: payment.id, 
                tenant_id: payment.tenant_id, 
                room_id: payment.room_id,
                booking_id: payment.booking_id,
                branch_id: payment.branch_id
            });
            return Response.json({ 
                success: false,
                error: 'ไม่พบข้อมูลผู้เช่า',
                message: `Tenant ID ${payment.tenant_id} not found`
            }, { status: 400 });
        }

        if (!tenant.line_user_id) {
            console.error('❌ Tenant has no LINE User ID:', tenant.full_name);
            return Response.json({ 
                success: false,
                error: 'ผู้เช่ายังไม่ได้เชื่อมต่อ LINE',
                message: `${tenant.full_name} ยังไม่ได้เชื่อมต่อบัญชี LINE กับระบบ`,
                tenantName: tenant.full_name
            }, { status: 400 });
        }

        const getConfig = (key, defaultValue) => {
            if (payment.branch_id) {
                const branchConfig = configs.find(c => c.key === key && c.branch_id === payment.branch_id);
                if (branchConfig) return branchConfig.value;
            }
            const globalConfig = configs.find(c => c.key === key && !c.branch_id);
            return globalConfig ? globalConfig.value : defaultValue;
        };

        // ⭐ สร้างลิงก์ PublicReceipt
        const frontendUrl = getConfig('frontend_url', null) || Deno.env.get('FRONTEND_URL');
        
        if (!frontendUrl) {
            console.error('❌ Missing FRONTEND_URL config');
            return Response.json({ 
                success: false,
                error: 'ระบบยังไม่ได้ตั้งค่า FRONTEND_URL'
            }, { status: 500 });
        }

        const receiptLink = `${frontendUrl}/publicreceipt?id=${payment.id}`;
        console.log(`📄 Receipt link: ${receiptLink}`);

        const bankAccountName = getConfig('bank_account_name', '-');
        const lessorName = getConfig('lessor_name', bankAccountName);
        const buildingName = getConfig('building_name', 'ที่พัก');
        const buildingAddress = getConfig('building_address', '');
        const buildingPhone = getConfig('building_phone', '');
        
        // ข้อมูลบริษัท (ถ้ามี)
        const companyName = getConfig('company_name', '');
        const companyTaxId = getConfig('company_tax_id', '');
        const companyRegistrationNumber = getConfig('company_registration_number', '');
        const companyPhone = getConfig('company_phone', '');
        const companyAddress = getConfig('company_address', '');
        
        // ใช้ข้อมูลบริษัทถ้ามี ไม่เช่นนั้นใช้ข้อมูลหอพัก
        const issuerName = companyName || buildingName;
        const issuerAddress = companyAddress || buildingAddress;
        const issuerPhone = companyPhone || buildingPhone;
        const issuerTaxId = companyTaxId;
        const issuerRegistrationNumber = companyRegistrationNumber;

        // สร้างรายการ items
        const items = [];
        if (payment.rent_amount && payment.rent_amount > 0) {
            items.push({
                type: "box",
                layout: "horizontal",
                contents: [
                    { type: "text", text: "ค่าเช่า", size: "sm", color: "#555555", flex: 0 },
                    { type: "text", text: `${payment.rent_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: "sm", color: "#111111", align: "end" }
                ]
            });
        }
        if (payment.electricity_amount && payment.electricity_amount > 0) {
            items.push({
                type: "box",
                layout: "horizontal",
                contents: [
                    { type: "text", text: `ค่าไฟ${payment.electricity_units ? ` (${payment.electricity_units} หน่วย)` : ''}`, size: "sm", color: "#555555", flex: 0 },
                    { type: "text", text: `${payment.electricity_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: "sm", color: "#111111", align: "end" }
                ]
            });
        }
        if (payment.water_amount && payment.water_amount > 0) {
            items.push({
                type: "box",
                layout: "horizontal",
                contents: [
                    { type: "text", text: `ค่าน้ำ${payment.water_units ? ` (${payment.water_units} หน่วย)` : ''}`, size: "sm", color: "#555555", flex: 0 },
                    { type: "text", text: `${payment.water_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: "sm", color: "#111111", align: "end" }
                ]
            });
        }
        if (payment.internet_amount && payment.internet_amount > 0) {
            items.push({
                type: "box",
                layout: "horizontal",
                contents: [
                    { type: "text", text: "ค่าอินเทอร์เน็ต", size: "sm", color: "#555555", flex: 0 },
                    { type: "text", text: `${payment.internet_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: "sm", color: "#111111", align: "end" }
                ]
            });
        }
        if (payment.common_fee_amount && payment.common_fee_amount > 0) {
            items.push({
                type: "box",
                layout: "horizontal",
                contents: [
                    { type: "text", text: "ค่าส่วนกลาง", size: "sm", color: "#555555", flex: 0 },
                    { type: "text", text: `${payment.common_fee_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: "sm", color: "#111111", align: "end" }
                ]
            });
        }
        if (payment.parking_fee_amount && payment.parking_fee_amount > 0) {
            items.push({
                type: "box",
                layout: "horizontal",
                contents: [
                    { type: "text", text: "ค่าที่จอดรถ", size: "sm", color: "#555555", flex: 0 },
                    { type: "text", text: `${payment.parking_fee_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: "sm", color: "#111111", align: "end" }
                ]
            });
        }
        if (payment.other_amount && payment.other_amount > 0) {
            items.push({
                type: "box",
                layout: "horizontal",
                contents: [
                    { type: "text", text: "ค่าใช้จ่ายอื่นๆ", size: "sm", color: "#555555", flex: 0 },
                    { type: "text", text: `${payment.other_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: "sm", color: "#111111", align: "end" }
                ]
            });
        }
        if (payment.late_fee_amount && payment.late_fee_amount > 0) {
            items.push({
                type: "box",
                layout: "horizontal",
                contents: [
                    { type: "text", text: "ค่าปรับชำระล่าช้า", size: "sm", color: "#dc2626", flex: 0 },
                    { type: "text", text: `${payment.late_fee_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: "sm", color: "#dc2626", align: "end", weight: "bold" }
                ]
            });
        }
        
        // ⭐ FIX: ถ้าไม่มีรายการเลย ให้เพิ่มรายการเริ่มต้น
        if (items.length === 0) {
            items.push({
                type: "box",
                layout: "horizontal",
                contents: [
                    { type: "text", text: "ค่าเช่า", size: "sm", color: "#555555", flex: 0 },
                    { type: "text", text: `${(payment.total_amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: "sm", color: "#111111", align: "end" }
                ]
            });
        }

        const paymentDateText = payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : '-';

        // สร้าง Flex Message
        const headerContents = [
            { type: "text", text: issuerName, color: "#ffffff", size: "xl", weight: "bold", align: "center" },
            { type: "text", text: "ใบเสร็จรับเงิน", color: "#ffffff", size: "md", align: "center", margin: "md" }
        ];

        // เพิ่มข้อมูลบริษัทถ้ามี
        if (issuerAddress) {
            headerContents.push({ type: "text", text: issuerAddress, color: "#e0e7ff", size: "xs", align: "center", margin: "sm", wrap: true });
        }
        if (issuerPhone) {
            headerContents.push({ type: "text", text: `โทร: ${issuerPhone}`, color: "#e0e7ff", size: "xs", align: "center", margin: "xs" });
        }
        if (issuerTaxId) {
            headerContents.push({ type: "text", text: `เลขผู้เสียภาษี: ${issuerTaxId}`, color: "#e0e7ff", size: "xs", align: "center", margin: "xs" });
        }

        const flexMessage = {
            type: "flex",
            altText: `ใบเสร็จรับเงิน ${buildingName}`,
            contents: {
                type: "bubble",
                size: "mega",
                header: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "box",
                            layout: "vertical",
                            contents: [
                                { type: "text", text: buildingName, color: "#ffffff", size: "xl", weight: "bold", align: "center" },
                                { type: "text", text: "ใบเสร็จรับเงิน", color: "#ffffff", size: "md", align: "center", margin: "md" }
                            ]
                        }
                    ],
                    backgroundColor: "#2563eb",
                    paddingTop: "20px",
                    paddingBottom: "20px"
                },
                body: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        { type: "text", text: `เลขที่: REC-${payment.id.slice(0, 8).toUpperCase()}`, size: "xs", color: "#aaaaaa", margin: "md" },
                        { type: "text", text: `วันที่: ${paymentDateText}`, size: "xs", color: "#aaaaaa", margin: "sm" },
                        { type: "separator", margin: "lg" },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "lg",
                            spacing: "sm",
                            contents: [
                                { type: "text", text: "ผู้เช่า", size: "sm", color: "#aaaaaa" },
                                { type: "text", text: tenant.full_name || "ไม่ระบุ", size: "md", weight: "bold", color: "#111111" },
                                { type: "text", text: `ห้อง ${room?.room_number || 'N/A'}`, size: "sm", color: "#555555" },
                                ...(tenant.phone ? [{ type: "text", text: tenant.phone, size: "sm", color: "#555555" }] : [])
                            ]
                        },
                        { type: "separator", margin: "lg" },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "lg",
                            spacing: "sm",
                            contents: [
                                { type: "text", text: "รายการ", size: "sm", color: "#aaaaaa", weight: "bold" },
                                ...items
                            ]
                        },
                        { type: "separator", margin: "lg" },
                        {
                            type: "box",
                            layout: "horizontal",
                            margin: "lg",
                            contents: [
                                { type: "text", text: "รวมทั้งสิ้น", size: "md", color: "#111111", weight: "bold", flex: 0 },
                                { type: "text", text: `${payment.total_amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })} บาท`, size: "xl", color: "#2563eb", weight: "bold", align: "end" }
                            ]
                        },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "sm",
                            contents: [
                                { type: "text", text: `(${numberToThaiText(payment.total_amount)})`, size: "sm", color: "#555555", align: "center", wrap: true }
                            ]
                        },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "lg",
                            contents: [
                                { type: "text", text: "✓ ชำระเงินเรียบร้อยแล้ว", size: "md", color: "#ffffff", weight: "bold", align: "center" }
                            ],
                            backgroundColor: "#10b981",
                            cornerRadius: "md",
                            paddingAll: "12px"
                        },
                        { type: "separator", margin: "lg" },
                        {
                            type: "box",
                            layout: "vertical",
                            margin: "lg",
                            spacing: "xs",
                            contents: [
                               
                                { type: "text", text: `ผู้รับเงิน: ${lessorName}`, size: "xs", color: "#aaaaaa", align: "center", margin: "sm" },
                                { type: "text", text: "เอกสารนี้สร้างโดยระบบอัตโนมัติ", size: "xxs", color: "#aaaaaa", align: "center", margin: "sm" },
                               
                            ]
                        }
                    ]
                },
                footer: {
                    type: "box",
                    layout: "vertical",
                    contents: [
                        {
                            type: "button",
                            action: {
                                type: "uri",
                                label: "📄 ดูใบเสร็จฉบับเต็ม",
                                uri: receiptLink
                            },
                            style: "primary",
                            color: "#2563eb"
                        }
                    ],
                    spacing: "sm"
                },
                styles: {
                    footer: {
                        separator: false
                    }
                }
            }
        };

        console.log('📤 Sending LINE message to:', tenant.line_user_id);

        const lineResponse = await fetch('https://api.line.me/v2/bot/message/push', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${lineToken}`
            },
            body: JSON.stringify({
                to: tenant.line_user_id,
                messages: [flexMessage]
            })
        });

        const lineResponseText = await lineResponse.text();
        console.log('📨 LINE API Response Status:', lineResponse.status);
        console.log('📨 LINE API Response Body:', lineResponseText);

        if (!lineResponse.ok) {
            let errorData;
            try {
                errorData = JSON.parse(lineResponseText);
            } catch {
                errorData = { message: lineResponseText };
            }
            console.error('❌ Failed to send LINE message:', errorData);
            return Response.json({ 
                success: false,
                error: 'ส่งข้อความ LINE ไม่สำเร็จ',
                message: errorData.message || 'LINE API error',
                details: errorData 
            }, { status: lineResponse.status });
        }

        console.log('✅ LINE message sent successfully');

        // ⭐ บันทึกว่าส่งใบเสร็จแล้ว
        try {
            await base44.asServiceRole.entities.Payment.update(payment.id, {
                receipt_sent_date: new Date().toISOString()
            });
            console.log(`✅ Updated receipt_sent_date for payment ${payment.id}`);
        } catch (updateErr) {
            console.error(`⚠️ Failed to update receipt_sent_date:`, updateErr.message);
        }

        return Response.json({ 
            success: true,
            message: `✅ ส่งใบเสร็จทาง LINE สำเร็จ\n\nส่งถึง: ${tenant.full_name}\nห้อง: ${room?.room_number}\nยอดเงิน: ${payment.total_amount.toLocaleString()} บาท`,
            has_image: true,
            tenant: tenant.full_name,
            room: room?.room_number
        });

    } catch (error) {
        console.error('💥 Error in sendReceipt:', error);
        return Response.json({ 
            success: false,
            error: 'เกิดข้อผิดพลาดของระบบ',
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});