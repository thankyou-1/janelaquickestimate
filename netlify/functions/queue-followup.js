import { createClient } from '@supabase/supabase-js';
import { requireApiKey } from './utils/auth.js';

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Api-Key',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const authErr = requireApiKey(event, headers);
  if (authErr) return authErr;
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  let payload;
  try { payload = JSON.parse(event.body); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  let { messages } = payload;
  if (!Array.isArray(messages) || messages.length === 0) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'messages array required' }) };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // replace=true: cancel existing pending rows before inserting (new sequence start)
  // replace=false (default/sync): skip clients that already have pending rows
  const replace = payload.replace !== false; // default true for new sequences
  const clientIds = [...new Set(messages.map(m => m.client_id).filter(Boolean))];

  if (replace) {
    if (clientIds.length > 0) {
      await supabase
        .from('scheduled_messages')
        .update({ status: 'cancelled', note: 'replaced by new sequence' })
        .in('client_id', clientIds)
        .eq('status', 'pending');
    }
  } else {
    // Sync mode: find which clients already have pending rows and exclude them
    const { data: existing } = await supabase
      .from('scheduled_messages')
      .select('client_id')
      .in('client_id', clientIds)
      .eq('status', 'pending');
    const alreadyQueued = new Set((existing || []).map(r => r.client_id));
    messages = messages.filter(m => !alreadyQueued.has(m.client_id));
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
