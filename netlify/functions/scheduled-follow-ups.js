import { createClient } from '@supabase/supabase-js';

const NETLIFY_BASE = process.env.URL || 'https://janelaquickestimate.netlify.app';

// Runs daily via Netlify cron. Sends queued follow-up messages
// that are due today (or overdue) within the 7am–7pm send window.
export const config = {
  schedule: '0 9,13,17 * * *', // 9am, 1pm, 5pm daily
};

export async function handler(event) {
  // Only run as a scheduled function
  if (!event.type || event.type !== 'schedule') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const hour = new Date().getHours();
  if (hour < 7 || hour >= 19) {
    console.log('Outside 7am–7pm send window, skipping.');
    return { statusCode: 200, body: JSON.stringify({ skipped: 'outside send window' }) };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // Load all queued follow-up messages that are due
  const today = new Date().toISOString().split('T')[0];
  const { data: queued, error } = await supabase
    .from('scheduled_messages')
    .select('*')
    .lte('send_on', today)
    .eq('status', 'pending');

  if (error) {
    console.error('Error loading scheduled messages:', error.message);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }

  if (!queued || queued.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ sent: 0 }) };
  }

  let sent = 0;
  let failed = 0;

  for (const msg of queued) {
    try {
      // Check if client replied since this was scheduled — if so, cancel it
      const { data: inbound } = await supabase
        .from('messages')
        .select('id')
        .eq('client_id', msg.client_id)
        .eq('direction', 'inbound')
        .gte('created_at', msg.created_at)
        .limit(1);

      if (inbound && inbound.length > 0) {
        // Client replied — mark cancelled, don't send
        await supabase
          .from('scheduled_messages')
          .update({ status: 'cancelled', note: 'client replied before send' })
          .eq('id', msg.id);
        continue;
      }

      // Send via existing send-sms function
      const res = await fetch(`${NETLIFY_BASE}/.netlify/functions/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: msg.to_number,
          body: msg.body,
          clientId: msg.client_id,
          clientName: msg.client_name,
        }),
      });

      if (res.ok) {
        await supabase
          .from('scheduled_messages')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', msg.id);
        sent++;
      } else {
        const errBody = await res.json().catch(() => ({}));
        console.warn(`Failed to send to ${msg.to_number}:`, errBody.error);
        await supabase
          .from('scheduled_messages')
          .update({ status: 'failed', note: errBody.error || 'send-sms error' })
          .eq('id', msg.id);
        failed++;
      }

      // Throttle — 600ms between sends
      await new Promise(r => setTimeout(r, 600));
    } catch (err) {
      console.error('Unexpected error for message', msg.id, err.message);
      failed++;
    }
  }

  console.log(`Scheduled follow-ups: ${sent} sent, ${failed} failed.`);
  return {
    statusCode: 200,
    body: JSON.stringify({ sent, failed, total: queued.length }),
  };
}
