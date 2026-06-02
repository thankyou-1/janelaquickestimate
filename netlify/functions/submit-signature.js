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

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { token, signatureDataUrl, signerName } = JSON.parse(event.body || '{}');

    if (!token || !signatureDataUrl) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'token and signatureDataUrl are required' }),
      };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Make sure it's still pending
    const { data: existing, error: fetchErr } = await supabase
      .from('signature_requests')
      .select('status, document_html, client_name')
      .eq('token', token)
      .single();

    if (fetchErr || !existing) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Request not found' }) };
    }

    if (existing.status === 'signed') {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'Already signed' }) };
    }

    const { error: updateErr } = await supabase
      .from('signature_requests')
      .update({
        status: 'signed',
        signature_data_url: signatureDataUrl,
        signer_name: signerName || existing.client_name || '',
        signed_at: new Date().toISOString(),
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
