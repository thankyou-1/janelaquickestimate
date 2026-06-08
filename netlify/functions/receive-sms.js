import { createClient } from '@supabase/supabase-js';

// Twilio posts inbound SMS here as application/x-www-form-urlencoded
export async function handler(event) {
  // Always respond with empty TwiML — no auto-reply
  const twimlResponse = {
    statusCode: 200,
    headers: { 'Content-Type': 'text/xml' },
    body: '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
  };

  try {
    const params = new URLSearchParams(event.body || '');
    const from   = params.get('From') || '';
    const to     = params.get('To')   || '';
    const body   = params.get('Body') || '';
    const sid    = params.get('MessageSid') || '';

    if (!from || !body) return twimlResponse;

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

    // Try to find which client this is from by matching phone number
    // against the most recent outbound message we sent to that number
    const { data: lastOut } = await supabase
      .from('messages')
      .select('client_id, client_name')
      .eq('to_number', from)
      .eq('direction', 'outbound')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    await supabase.from('messages').insert({
      client_id:   lastOut?.client_id   || '',
      client_name: lastOut?.client_name || '',
      direction:   'inbound',
      body,
      status:      'received',
      twilio_sid:  sid,
      from_number: from,
      to_number:   to,
    });

  } catch (err) {
    console.warn('receive-sms error:', err.message);
  }

  return twimlResponse;
}
