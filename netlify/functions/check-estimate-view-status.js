import { createClient } from '@supabase/supabase-js';

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const token = event.queryStringParameters?.token;
  if (!token) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Token required' }) };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const { data, error } = await supabase
    .from('estimate_views')
    .select('status, response, message, preferred_week, preferred_time_of_day, viewed_at, responded_at')
    .eq('token', token)
    .single();

  if (error || !data) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  }

  // Only return status/response — never document_html
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: data.status,
      response: data.response || null,
      message: data.message || null,
      preferredWeek: data.preferred_week || null,
      preferredTimeOfDay: data.preferred_time_of_day || null,
      viewedAt: data.viewed_at || null,
      respondedAt: data.responded_at || null,
    }),
  };
}
