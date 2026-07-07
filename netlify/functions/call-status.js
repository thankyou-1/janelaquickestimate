import { createClient } from '@supabase/supabase-js';
import { validateTwilioSignature } from './utils/auth.js';

// Twilio status callback for calls
export async function handler(event) {
  if (!validateTwilioSignature(event)) {
    console.warn('call-status: invalid Twilio signature — rejected');
    return { statusCode: 403, body: 'Forbidden' };
  }
  try {
    const params   = new URLSearchParams(event.body || '');
    const sid      = params.get('CallSid')      || '';
    const status   = params.get('CallStatus')   || '';
    const duration = parseInt(params.get('CallDuration') || '0', 10);

    if (!sid) return { statusCode: 200, body: '' };

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    await supabase
      .from('calls')
      .update({ status, duration })
      .eq('twilio_sid', sid);

  } catch (err) {
    console.warn('call-status error:', err.message);
  }
  return { statusCode: 200, body: '' };
}
