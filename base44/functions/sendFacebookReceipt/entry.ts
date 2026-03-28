import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';

// Cache สำหรับ Config
let configCache = null;
let configCacheTime = 0;
const CONFIG_CACHE_DURATION = 30 * 1000;

async function getFacebookConfig(base44, branchId = null) {
    try {
        const now = Date.now();
        if (!configCache || (now - configCacheTime) > CONFIG_CACHE_DURATION) {
            configCache = await base44.asServiceRole.entities.Config.list();
            configCacheTime = now;
        }
        
        const findConfig = (key) => {
            const allConfigs = configCache.filter(c => c.key === key && c.value?.trim());
            
            if (branchId) {
                const branchVal = allConfigs.find(c => c.branch_id === branchId);
                if (branchVal?.value?.trim()) return branchVal.value.trim();
            }
            
            const anyValidToken = allConfigs.find(c => c.value?.trim());
            return anyValidToken?.value?.trim() || null;
        };

        return {
            pageAccessToken: findConfig('facebook_page_access_token'),
            buildingName: findConfig('building_name') || 'W RESIDENTS',
            lessorName: findConfig('lessor_name') || findConfig('bank_account_name') || 'ธนานนท์ พรมพักตร์'
        };
    } catch (error) {
        console.error('❌ Error fetching FB config:', error);
        return null;
    }
}

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
        
        // ✅ ตรวจสอบ authentication - อนุญาตให้ service role เรียกได้โดยไม่ต้อง auth
        let user = null;
        try {
            user = await base44.auth.me();
        } catch (authError) {
            // ไม่ error ถ้าเป็นการเรียกจาก service role (เช่น webhook)
            console.log('ℹ️ No user auth - assuming service role call');
        }

        // ✅ Parse request body
        let paymentId;
        try {
            const body = await req.json();
            paymentId = body.paymentId;
            console.log('📝 Request body parsed:', { paymentId });
        } catch (jsonError) {
            console.error('JSON parse error:', jsonError);
            return Response.json({ 
                success: false,
                error: 'รูปแบบข้อมูลไม่ถูกต้อง'
            }, { status: 400 });
        }

        if (!paymentId) {
            console.error('❌ Missing paymentId in request');
            return Response.json({ 
                success: false,
                error: 'ไม่พบข้อมูล Payment ID'
            }, { status: 400 });
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
                error: 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้'
            }, { status: 500 });
        }

        const payment = Array.isArray(payments) ? payments[0] : null;

        if (!payment) {
            console.error('❌ Payment not found:', paymentId);
            return Response.json({ 
                success: false,
                error: 'ไม่พบข้อมูลการชำระเงิน'
            }, { status: 404 });
        }

        console.log('✅ Payment found:', payment.id, 'Status:', payment.status);

        const config = await getFacebookConfig(base44, payment.branch_id);
        if (!config?.pageAccessToken) {
            console.error('❌ Facebook token not available');
            return Response.json({ 
                success: false,
                error: 'ระบบ Facebook ยังไม่ได้ตั้งค่า'
            }, { status: 500 });
        }

        if (payment.status !== 'paid') {
            console.error('❌ Payment not paid yet:', payment.status);
            return Response.json({ 
                success: false,
                error: 'รายการนี้ยังไม่ได้ชำระเงิน',
                currentStatus: payment.status
            }, { status: 400 });
        }



        // ⭐ ดึง tenant โดยตรง (เหมือน LINE)
        console.log('📥 Fetching tenant directly by ID:', payment.tenant_id);
        let tenant = null;
        let room = null;
        
        try {
            if (payment.tenant_id) {
                const tenantResult = await base44.asServiceRole.entities.Tenant.filter({ id: payment.tenant_id });
                if (Array.isArray(tenantResult) && tenantResult.length > 0) {
                    tenant = tenantResult[0];
                } else if (tenantResult && !Array.isArray(tenantResult)) {
                    tenant = tenantResult;
                }
                console.log(`✅ Tenant by ID: ${tenant?.full_name || 'not found'}`);
            }
            
            if (payment.room_id) {
                const roomResult = await base44.asServiceRole.entities.Room.filter({ id: payment.room_id });
                if (Array.isArray(roomResult) && roomResult.length > 0) {
                    room = roomResult[0];
                } else if (roomResult && !Array.isArray(roomResult)) {
                    room = roomResult;
                }
                console.log(`✅ Room by ID: ${room?.room_number || 'not found'}`);
            }
            
        } catch (fetchError) {
            console.error('❌ Error fetching direct data:', fetchError);
        }
        
        // ลองหาจาก booking ถ้าไม่เจอ
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
            return Response.json({ 
                success: false,
                error: 'ไม่พบข้อมูลผู้เช่า'
            }, { status: 400 });
        }

        if (!tenant.facebook_user_id) {
            console.error('❌ Tenant has no Facebook User ID:', tenant.full_name);
            return Response.json({ 
                success: false,
                error: 'ผู้เช่ายังไม่ได้เชื่อมต่อ Facebook',
                tenantName: tenant.full_name
            }, { status: 400 });
        }

        // สร้างข้อความใบเสร็จ
        const paymentDateText = payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }) : '-';

        let message = `🏠 ${config.buildingName}\n`;
        message += `ใบเสร็จรับเงิน\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n`;
        message += `เลขที่: REC-${payment.id.slice(0, 8).toUpperCase()}\n`;
        message += `วันที่: ${paymentDateText}\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `👤 ผู้เช่า: ${tenant.full_name}\n`;
        message += `🏠 ห้อง: ${room?.room_number || 'N/A'}\n`;
        if (tenant.phone) {
            message += `📱 เบอร์: ${tenant.phone}\n`;
        }
        message += `\n📋 รายการ:\n`;
        
        if (payment.rent_amount > 0) {
            message += `  ค่าเช่า: ${payment.rent_amount.toLocaleString()} บาท\n`;
        }
        if (payment.electricity_amount > 0) {
            message += `  ค่าไฟ (${payment.electricity_units} หน่วย): ${payment.electricity_amount.toLocaleString()} บาท\n`;
        }
        if (payment.water_amount > 0) {
            message += `  ค่าน้ำ (${payment.water_units} หน่วย): ${payment.water_amount.toLocaleString()} บาท\n`;
        }
        if (payment.internet_amount > 0) {
            message += `  ค่าอินเทอร์เน็ต: ${payment.internet_amount.toLocaleString()} บาท\n`;
        }
        if (payment.common_fee_amount > 0) {
            message += `  ค่าส่วนกลาง: ${payment.common_fee_amount.toLocaleString()} บาท\n`;
        }
        if (payment.parking_fee_amount > 0) {
            message += `  ค่าที่จอดรถ: ${payment.parking_fee_amount.toLocaleString()} บาท\n`;
        }
        if (payment.other_amount > 0) {
            message += `  ค่าใช้จ่ายอื่นๆ: ${payment.other_amount.toLocaleString()} บาท\n`;
        }
        
        message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        message += `💰 รวมทั้งสิ้น: ${payment.total_amount.toLocaleString()} บาท\n`;
        message += `(${numberToThaiText(payment.total_amount)})\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        message += `✅ ชำระเงินเรียบร้อยแล้ว\n\n`;
        message += `ขอบคุณที่ชำระเงินตรงเวลา\n`;
        message += `ผู้รับเงิน: ${config.lessorName}\n\n`;
        message += `เอกสารนี้สร้างโดยระบบอัตโนมัติ\nกรุณาเก็บใบเสร็จนี้ไว้เป็นหลักฐาน`;

        console.log('📤 Sending Facebook message to:', tenant.facebook_user_id);

        const fbResponse = await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${config.pageAccessToken}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                recipient: { id: tenant.facebook_user_id },
                message: { text: message },
                messaging_type: 'MESSAGE_TAG',
                tag: 'CONFIRMED_EVENT_UPDATE'
            })
        });

        const fbResponseData = await fbResponse.json();
        console.log('📨 Facebook API Response:', fbResponseData);

        if (!fbResponse.ok) {
            console.error('❌ Failed to send Facebook message:', fbResponseData);
            return Response.json({ 
                success: false,
                error: 'ส่งข้อความ Facebook ไม่สำเร็จ',
                details: fbResponseData 
            }, { status: fbResponse.status });
        }

        console.log('✅ Facebook message sent successfully');

        // ⭐⭐⭐ บันทึกข้อความขาออกลง FacebookMessage entity
        try {
            await base44.asServiceRole.entities.FacebookMessage.create({
                branch_id: payment.branch_id,
                tenant_id: tenant.id,
                facebook_user_id: tenant.facebook_user_id,
                facebook_display_name: tenant.full_name,
                facebook_picture_url: null,
                direction: 'outgoing',
                message_type: 'text',
                content: message,
                is_read: true,
                sent_by: user?.email || 'system (auto)'
            });
            console.log('✅ Saved outgoing Facebook message to FacebookMessage entity');
        } catch (saveError) {
            console.error('❌ Failed to save outgoing Facebook message:', saveError);
        }

        // ⭐ บันทึกว่าส่งใบเสร็จแล้ว (เหมือน LINE)
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
            message: `✅ ส่งใบเสร็จทาง Facebook สำเร็จ\n\nส่งถึง: ${tenant.full_name}\nห้อง: ${room?.room_number}\nยอดเงิน: ${payment.total_amount.toLocaleString()} บาท`,
            has_image: true,
            tenant: tenant.full_name,
            room: room?.room_number
        });

    } catch (error) {
        console.error('💥 Error in sendFacebookReceipt:', error);
        return Response.json({ 
            success: false,
            error: 'เกิดข้อผิดพลาดของระบบ',
            message: error.message
        }, { status: 500 });
    }
});