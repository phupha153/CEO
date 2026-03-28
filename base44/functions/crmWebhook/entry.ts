import { createClientFromRequest, createClient } from 'npm:@base44/sdk@0.8.23';

/**
 * Webhook endpoint สำหรับรับข้อมูลจาก CRM
 * CRM สามารถส่งข้อมูลมาได้หลายประเภท:
 * 1. subscription_renewed - เมื่อลูกค้าต่อสัญญา
 * 2. subscription_expiring - เมื่อสัญญาใกล้หมด
 * 3. package_updated - เมื่อมีการอัปเดตแพ็กเกจ
 */
Deno.serve(async (req) => {
  try {
    // ตรวจสอบ webhook secret
    const webhookSecret = req.headers.get('x-webhook-secret');
    const expectedSecret = Deno.env.get("CRM_WEBHOOK_SECRET");
    
    if (!expectedSecret || webhookSecret !== expectedSecret) {
      return Response.json({ error: 'Invalid webhook secret' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    console.log('CRM Webhook received:', payload);

    const { event_type, data } = payload;

    switch (event_type) {
      case 'subscription_renewed':
        // ลูกค้าต่อสัญญาแล้ว - อัปเดตข้อมูลในระบบ
        await handleSubscriptionRenewed(base44, data);
        break;

      case 'subscription_expiring':
        // สัญญาใกล้หมด - แจ้งเตือนในระบบ
        await handleSubscriptionExpiring(base44, data);
        break;

      case 'package_updated':
        // แพ็กเกจมีการอัปเดต
        await handlePackageUpdated(base44, data);
        break;

      default:
        console.log('Unknown event type:', event_type);
    }

    return Response.json({ 
      success: true,
      message: `Event ${event_type} processed successfully`
    });

  } catch (error) {
    console.error('CRM Webhook error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});

async function handleSubscriptionRenewed(base44, data) {
  const { customer_email, app_name, subscription_start_date, subscription_end_date, 
          price_per_month, duration_months, package_name } = data;

  // สร้าง AppSubscription ใหม่
  await base44.asServiceRole.entities.AppSubscription.create({
    app_name: app_name || `Renewed - ${customer_email}`,
    subscription_start_date,
    subscription_end_date,
    subscription_duration_months: duration_months || 3,
    price_per_month: price_per_month || 0,
    total_price: (price_per_month || 0) * (duration_months || 3),
    status: 'active',
    auto_renew: false,
    payment_status: 'paid',
    notes: `Renewed via CRM webhook - Package: ${package_name}`
  });

  console.log('Subscription renewed for:', customer_email);
}

async function handleSubscriptionExpiring(base44, data) {
  const { customer_email, app_name, days_remaining, subscription_end_date } = data;

  // สร้างการแจ้งเตือนในระบบ
  // อาจจะส่ง notification หรือ email แจ้งผู้ใช้

  console.log(`Subscription expiring in ${days_remaining} days for: ${customer_email}`);
}

async function handlePackageUpdated(base44, data) {
  const { package_id, package_name, price_per_month, features } = data;

  console.log('Package updated:', package_name);
}