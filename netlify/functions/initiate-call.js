import { createClient } from '@supabase/supabase-js';
import { requireApiKey } from './utils/auth.js';

const TWILIO_BASE = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}`;

function twilioAuth() {
  const creds = `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`;
  return 'Basic ' + Buffer.from(creds).toString('base64');
}

function normalizePhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  if (digits.length > 10) return `+${digits}`;
  return null;
}

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const authErr = requireApiKey(event, headers);
  if (authErr) return authErr;
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { clientPhone, clientId, clientName } = JSON.parse(event.body || '{}');
    if (!clientPhone) return { statusCode: 400, headers, body: JSON.stringify({ error: 'clientPhone required' }) };

    const clientNorm = normalizePhone(clientPhone);
    if (!clientNorm) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid client phone number' }) };

    const myPhone = process.env.MY_PHONE_NUMBER;

    // Bridge call: Twilio calls MY phone first.
    // When I answer, it dials the client — client sees the Twilio number.
    // TwiML: <Dial callerId="TWILIO_NUMBER">CLIENT_NUMBER</Dial>
    const twiml = `<Response><Dial callerId="${process.env.TWILIO_PHONE_NUMBER}" action="${process.env.URL || 'https://janelaquickestimate.netlify.app'}/.netlify/functions/call-status-twiml?clientId=${encodeURIComponent(clientId||'')}&amp;clientName=${encodeURIComponent(clientName||'')}&amp;clientPhone=${encodeURIComponent(clientNorm)}">${clientNorm}</Dial></Response>`;

    const statusCallbackBase = `${process.env.URL || 'https://janelaquickestimate.netlify.app'}/.netlify/functions/call-status`;

    const formBody = new URLSearchParams({
      From: process.env.TWILIO_PHONE_NUMBER,
      To: myPhone,
      Twiml: twiml,
      StatusCallback: statusCallbackBase,
      StatusCallbackMethod: 'POST',
    });

    const twilioRes = await fetch(`${TWILIO_BASE}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: twilioAuth(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formBody.toString(),
    });

    const twilioData = await twilioRes.json();
    if (!twilioRes.ok) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: twilioData.message || 'Twilio error' }) };
    }

    // Log call in Supabase
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    const { data: callRow } = await supabase
      .from('calls')
      .insert({
        client_id:   clientId   || '',
        client_name: clientName || '',
        direction:   'outbound',
        status:      'initiated',
        twilio_sid:  twilioData.sid,
        from_number: process.env.TWILIO_PHONE_NUMBER,
        to_number:   clientNorm,
      })
      .select('id')
      .single();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true, sid: twilioData.sid, callId: callRow?.id }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}
