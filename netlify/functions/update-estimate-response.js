import { createClient } from '@supabase/supabase-js';

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { token, response, message } = JSON.parse(event.body || '{}');

    // response must be one of: accepted | waiting | asked
    if (!token || !['accepted', 'waiting', 'asked'].includes(response)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'token and valid response (accepted|waiting|asked) are required' }),
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Make sure it exists and hasn't already been responded to
    const { data: existing, error: fetchErr } = await supabase
      .from('estimate_views')
      .select('status')
      .eq('token', token)
      .single();

    if (fetchErr || !existing) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
    }

    const { error: updateErr } = await supabase
      .from('estimate_views')
      .update({
        status: response,
        response,
        message: message || null,
        responded_at: new Date().toISOString(),
      })
      .eq('token', token);

    if (updateErr) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: updateErr.message }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}
