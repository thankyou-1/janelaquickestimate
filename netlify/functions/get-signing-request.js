import { createClient } from '@supabase/supabase-js';

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
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
    .from('signature_requests')
    .select('client_name, document_html, document_type, status')
    .eq('token', token)
    .single();

  if (error || !data) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Document not found' }) };
  }

  if (data.status === 'signed') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        alreadySigned: true,
        clientName: data.client_name,
        documentType: data.document_type,
      }),
    };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      clientName: data.client_name,
      documentHtml: data.document_html,
      documentType: data.document_type,
      status: data.status,
    }),
  };
}
