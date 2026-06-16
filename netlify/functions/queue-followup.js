import { createClient } from '@supabase/supabase-js';

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let payload;
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { messages } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'messages array required' }) };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // Cancel any existing pending follow-ups for these client IDs first
  const clientIds = [...new Set(messages.map(m => m.client_id).filter(Boolean))];
  if (clientIds.length > 0) {
    await supabase
      .from('scheduled_messages')
      .update({ status: 'cancelled', note: 'replaced by new sequence' })
      .in('client_id', clientIds)
      .eq('status', 'pending');
  }

  // Insert new scheduled messages (skip any missing required fields)
  const rows = messages
    .filter(m => m.client_id && m.to_number && m.body && m.send_on)
    .map(m => ({
      client_id: m.client_id,
      client_name: m.client_name || '',
      to_number: normalizePhone(m.to_number),
      body: m.body,
      send_on: m.send_on,
      status: 'pending',
      note: m.note || null,
    }));

  if (rows.length === 0) return { statusCode: 200, headers, body: JSON.stringify({ queued: 0 }) };

  const { error } = await supabase.from('scheduled_messages').insert(rows);
  if (error) return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };

  return { statusCode: 200, headers, body: JSON.stringify({ queued: rows.length }) };
}

function normalizePhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === '1') return `+${digits}`;
  return `+${digits}`;
}
