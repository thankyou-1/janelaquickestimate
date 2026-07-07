import { createClient } from '@supabase/supabase-js';
import { validateTwilioSignature } from './utils/auth.js';

// Twilio posts inbound SMS here as application/x-www-form-urlencoded
export async function handler(event) {
  // Always respond with empty TwiML — no auto-reply
  const twimlResponse = {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
  };

  if (!validateTwilioSignature(event)) {
    console.warn('receive-sms: invalid Twilio signature — rejected');
    return { statusCode: 403, body: 'Forbidden' };
  }

  try {
    const params = new URLSearchParams(event.body || '');
    const from   = params.get('From') || '';
    const to     = params.get('To')   || '';
    const body   = params.get('Body') || '';
    const sid    = params.get('MessageSid') || '';

    if (!from || !body) return twimlResponse;

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Match this number to a client via any prior message (either direction)
    // that carried a client_id — not just the last outbound, so people who
    // text first or reply after a long gap still land in the right thread.
    const { data: known } = await supabase
      .from('messages')
      .select('client_id, client_name')
      .or(`to_number.eq.${from},from_number.eq.${from}`)
      .neq('client_id', '')
      .order('created_at', { ascending: false })
      .limit(1);
    const match = known?.[0];

    await supabase.from('messages').insert({
      client_id:   match?.client_id   || '',
      client_name: match?.client_name || '',
      direction:   'inbound',
      body,
      status:      'received',
      twilio_sid:  sid,
      from_number: from,
      to_number:   to,
    });

    // Opt-out: Twilio blocks future sends at the carrier level, but we also
    // cancel our queued follow-ups so the cron stops attempting them.
    if (/^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*$/i.test(body)) {
      await supabase
        .from('scheduled_messages')
        .update({ status: 'cancelled', note: 'client texted STOP' })
        .eq('status', 'pending')
        .eq('to_number', from);
      if (match?.client_id) {
        await supabase
          .from('scheduled_messages')
          .update({ status: 'cancelled', note: 'client texted STOP' })
          .eq('status', 'pending')
          .eq('client_id', match.client_id);
      }
    }

  } catch (err) {
    console.warn('receive-sms error:', err.message);
  }

  return twimlResponse;
}
