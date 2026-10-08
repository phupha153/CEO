import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const DATASET_ID = '380854512918980';
const ALLOWED_EVENTS = ['Lead', 'Purchase'];

async function sha256(value) {
  const data = new TextEncoder().encode(String(value).trim().toLowerCase());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const token = Deno.env.get('META_CAPI_TOKEN');
    const apiVersion = Deno.env.get('META_API_VERSION');
    const testCode = Deno.env.get('META_TEST_EVENT_CODE');
    if (!token || !apiVersion) {
      return Response.json({ error: 'META_CAPI_TOKEN / META_API_VERSION not set' }, { status: 500 });
    }

    const body = await req.json();
    const eventName = body.eventName;
    if (!ALLOWED_EVENTS.includes(eventName)) {
      return Response.json({ error: 'eventName must be Lead or Purchase' }, { status: 400 });
    }

    const input = body.userData || {};
    const userData = {
      client_ip_address: input.ip || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
      client_user_agent: input.userAgent || req.headers.get('user-agent'),
    };
    if (input.email) userData.em = [await sha256(input.email)];
    if (input.phone) userData.ph = [await sha256(String(input.phone).replace(/\D/g, ''))];
    if (input.fbp) userData.fbp = input.fbp;
    if (input.fbc) userData.fbc = input.fbc;

    const payload = {
      data: [{
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: body.eventId || crypto.randomUUID(),
        action_source: 'website',
        event_source_url: body.eventSourceUrl || 'https://langbaan.app',
        user_data: userData,
        custom_data: body.customData || (eventName === 'Purchase' ? { currency: 'THB', value: 1 } : {}),
      }],
    };
    if (testCode) payload.test_event_code = testCode;

    const res = await fetch(`https://graph.facebook.com/${apiVersion}/${DATASET_ID}/events?access_token=${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    const result = await res.json();
    return Response.json({ ok: res.ok, event_id: payload.data[0].event_id, meta: result }, { status: res.ok ? 200 : 502 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});