import { createClient } from '@supabase/supabase-js';
import { requireApiKey } from './utils/auth.js';

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {

  const authErr = requireApiKey(event, headers);
  if (authErr) return authErr;
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
    .select('status, signature_data_url, signer_name, signed_at')
    .eq('token', token)
    .single();

  if (error || !data) {
    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  }

  // Only return status fields — never the document HTML
  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: data.status,
      signatureDataUrl: data.status === 'signed' ? data.signature_data_url : null,
      signerName: data.status === 'signed' ? data.signer_name : null,
      signedAt: data.status === 'signed' ? data.signed_at : null,
    }),
  };
}
