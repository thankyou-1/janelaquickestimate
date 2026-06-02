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
    .select('client_name, document_html, document_type, total_amount, status')
    .eq('token', token)
    .single();

  if (error || !data) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  }

  // If still pending, mark as viewed now
  if (data.status === 'pending') {
    await supabase
      .from('estimate_views')
      .update({ status: 'viewed', viewed_at: new Date().toISOString() })
      .eq('token', token);
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      clientName: data.client_name,
      documentHtml: data.document_html,
      documentType: data.document_type,
      totalAmount: data.total_amount,
      status: data.status === 'pending' ? 'viewed' : data.status,
    }),
  };
}
