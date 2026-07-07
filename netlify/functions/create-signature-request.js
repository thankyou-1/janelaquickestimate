import { createClient } from '@supabase/supabase-js';
import { requireApiKey } from './utils/auth.js';

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {

  const authErr = requireApiKey(event, headers);
  if (authErr) return authErr;
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { clientId, clientName, documentHtml, documentType } = JSON.parse(event.body || '{}');

    if (!clientId || !documentHtml) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'clientId and documentHtml are required' }) };
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabase
      .from('signature_requests')
      .insert({
        client_id: clientId,
        client_name: clientName || '',
        document_html: documentHtml,
        document_type: documentType || 'Estimate',
        status: 'pending',
      })
      .select('token')
      .single();

    if (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }

    const signingUrl = `https://janelaquickestimate.netlify.app/sign.html?token=${data.token}`;

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token: data.token, signingUrl }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
}
