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

    // Verify it exists and is still pending
    const { data: existing, error: fetchErr } = await supabase
      .from('signature_requests')
      .select('status, client_name')
      .eq('token', token)
      .single();

    if (fetchErr || !existing) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Request not found' }) };
    }

    if (existing.status === 'signed') {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'Already signed' }) };
    }

    const signedAt = new Date().toISOString();
    const resolvedName = signerName || existing.client_name || '';

    // Try full update first (all columns)
    const { error: fullErr } = await supabase
      .from('signature_requests')
      .update({
        status: 'signed',
        signature_data_url: signatureDataUrl,
        signer_name: resolvedName,
        signed_at: signedAt,
      })
      .eq('token', token);

    if (fullErr) {
      // Some columns may not exist yet — fall back to minimal update
      const { error: minErr } = await supabase
        .from('signature_requests')
        .update({ status: 'signed' })
        .eq('token', token);

      if (minErr) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: minErr.message }) };
      }

      // Return success with a note to add the missing columns
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          warning: 'Signed (status only). Run ALTER TABLE to store signature image. See setup instructions.',
        }),
      };
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
