import { createClient } from '@supabase/supabase-js';
import { requireApiKey } from './utils/auth.js';

// Called by the CRM when the user records the outcome of a call
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
    const { callSid, outcome, outcomeNotes } = JSON.parse(event.body || '{}');
    // outcome: "answered" | "voicemail" | "no-answer" | "busy"

    if (!callSid) return { statusCode: 400, headers, body: JSON.stringify({ error: 'callSid required' }) };

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    await supabase
      .from('calls')
      .update({ outcome, outcome_notes: outcomeNotes || '' })
      .eq('twilio_sid', callSid);

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}
