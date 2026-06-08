import { createClient } from '@supabase/supabase-js';

const TWILIO_BASE = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}`;

function twilioAuth() {
  const creds = `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`;
  return 'Basic ' + Buffer.from(creds).toString('base64');
}

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { to, body, clientId, clientName } = JSON.parse(event.body || '{}');
    if (!to || !body) return { statusCode: 400, headers, body: JSON.stringify({ error: 'to and body are required' }) };

    const toNorm = normalizePhone(to);
    if (!toNorm) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid phone number' }) };

    // Send via Twilio REST API
    const formBody = new URLSearchParams({
      From: process.env.TWILIO_PHONE_NUMBER,
      To: toNorm,
      Body: body,
      StatusCallback: `${process.env.URL || 'https://janelaquickestimate.netlify.app'}/.netlify/functions/sms-status`,
    });

    const twilioRes = await fetch(`${TWILIO_BASE}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: twilioAuth(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });

    const twilioData = await twilioRes.json();
    if (!twilioRes.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: twilioData.message || 'Twilio error', code: twilioData.code }) };
    }

    // Save to Supabase
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data: msg, error: dbErr } = await supabase
      .from('messages')
      .insert({
        client_id: clientId || '',
        client_name: clientName || '',
        direction: 'outbound',
        body,
        status: 'sent',
        twilio_sid: twilioData.sid,
        from_number: process.env.TWILIO_PHONE_NUMBER,
        to_number: toNorm,
      })
      .select('id, created_at')
      .single();

    if (dbErr) console.warn('DB save error:', dbErr.message);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, sid: twilioData.sid, messageId: msg?.id }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}
