import { createClientFromRequest } from 'npm:@base44/sdk@0.8.19';
import { differenceInDays, parseISO } from 'npm:date-fns';

/**
 * ตรวจสอบสัญญาที่ใกล้หมดและแจ้งไปยัง CRM
 * ควรรันผ่าน Cron Job ทุกวัน
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ตรวจสอบ cron secret (ใช้ API key จาก header แทน)
    const apiKey = req.headers.get('x-api-key');
    const expectedKey = Deno.env.get("CRON_SECRET") || "default-cron-secret";
    
    if (apiKey !== expectedKey) {
      return Response.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // ดึง subscriptions ทั้งหมดที่ active
    const subscriptions = await base44.asServiceRole.entities.AppSubscription.filter({
      status: 'active'
    });

    const today = new Date();
    const notificationThresholds = [30, 15, 7, 3, 1]; // แจ้งเตือนที่ 30, 15, 7, 3, 1 วัน
    const expiringSubs = [];

    for (const sub of subscriptions) {
      if (!sub.subscription_end_date) continue;

      try {
        const endDate = parseISO(sub.subscription_end_date);
        const daysRemaining = differenceInDays(endDate, today);

        if (daysRemaining > 0 && notificationThresholds.includes(daysRemaining)) {
          expiringSubs.push({
            ...sub,
            daysRemaining
          });
        }
      } catch (error) {
        console.error('Error parsing date for subscription:', sub.id, error);
      }
    }

    if (expiringSubs.length === 0) {
      return Response.json({
        success: true,
        message: 'No expiring subscriptions found'
      });
    }

    // ส่งข้อมูลไปยัง CRM webhook
    const crmWebhookUrl = 'https://ta-01ka6m9nmbv7qt4nfa6hkghhyy-5173.wo-eqi13toh5dnga3zgg8fg4pukt.w.modal.host/api/addCustomerWebhook';
    const crmApiKey = 'crm_8swg3i4zy9rpk8ysf6q';

    const results = [];

    for (const sub of expiringSubs) {
      try {
        const webhookPayload = {
          event_type: 'subscription_expiring',
          app_name: sub.app_name,
          subscription_end_date: sub.subscription_end_date,
          days_remaining: sub.daysRemaining,
          price_per_month: sub.price_per_month,
          total_price: sub.total_price,
          timestamp: new Date().toISOString(),
          notes: `Subscription expiring in ${sub.daysRemaining} days`
        };

        const response = await fetch(crmWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': crmApiKey
          },
          body: JSON.stringify(webhookPayload)
        });

        if (response.ok) {
          console.log(`✅ Notified CRM: ${sub.app_name} expires in ${sub.daysRemaining} days`);
          results.push({
            app_name: sub.app_name,
            days_remaining: sub.daysRemaining,
            status: 'sent'
          });
        } else {
          console.error(`Failed to notify CRM for ${sub.app_name}:`, await response.text());
          results.push({
            app_name: sub.app_name,
            days_remaining: sub.daysRemaining,
            status: 'failed'
          });
        }
      } catch (error) {
        console.error(`Error notifying CRM for ${sub.app_name}:`, error);
        results.push({
          app_name: sub.app_name,
          days_remaining: sub.daysRemaining,
          status: 'error',
          error: error.message
        });
      }
    }

    return Response.json({
      success: true,
      message: `Processed ${expiringSubs.length} expiring subscriptions`,
      results: results
    });

  } catch (error) {
    console.error('Error notifying expiring subscriptions:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});