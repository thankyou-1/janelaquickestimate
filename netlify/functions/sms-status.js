import { createClient } from '@supabase/supabase-js';
import { validateTwilioSignature } from './utils/auth.js';

// Twilio status callback for outbound messages (delivered, failed, etc.)
export async function handler(event) {
  if (!validateTwilioSignature(event)) {
    console.warn('sms-status: invalid Twilio signature — rejected');
    return { statusCode: 403, body: 'Forbidden' };
  }
  try {
    const params    = new URLSearchParams(event.body || '');
    const sid       = params.get('MessageSid') || '';
    const status    = params.get('MessageStatus') || '';
    if (!sid) return { statusCode: 200, body: '' };

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    await supabase.from('messages').update({ status }).eq('twilio_sid', sid);
  } catch (err) {
    console.warn('sms-status error:', err.message);
  }
  return { statusCode: 200, body: '' };
}
