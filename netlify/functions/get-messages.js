import { createClient } from '@supabase/supabase-js';

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const { clientId, phone, limit = '100' } = event.queryStringParameters || {};
  if (!clientId && !phone) return { statusCode: 400, headers, body: JSON.stringify({ error: 'clientId or phone required' }) };

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  let query = supabase
    .from('messages')
    .select('id, created_at, direction, body, status, from_number, to_number, client_id, client_name')
    .order('created_at', { ascending: true })
    .limit(parseInt(limit));

  if (clientId) {
    query = query.eq('client_id', clientId);
  } else if (phone) {
    const norm = normalizePhone(phone);
    query = query.or(`from_number.eq.${norm},to_number.eq.${norm}`);
  }

  const { data, error } = await query;
  if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };

  return { statusCode: 200, headers, body: JSON.stringify({ messages: data || [] }) };
}

function normalizePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return `+${digits}`;
}
