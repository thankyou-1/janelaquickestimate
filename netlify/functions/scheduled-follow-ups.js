import { createClient } from '@supabase/supabase-js';

const NETLIFY_BASE = process.env.URL || 'https://janelaquickestimate.netlify.app';

// Netlify runs on UTC — all local-time logic must go through the business
// timezone, or the 7am–7pm window check silently passes at the wrong hours.
const BUSINESS_TZ = process.env.BUSINESS_TZ || 'America/New_York';
const localHour = () =>
  parseInt(new Intl.DateTimeFormat('en-US', { timeZone: BUSINESS_TZ, hour: 'numeric', hour12: false }).format(new Date()), 10);
const localDate = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TZ }).format(new Date()); // YYYY-MM-DD

// Runs via Netlify cron (times are UTC). Sends queued follow-up messages
// that are due today (or overdue) within the 7am–7pm business-local window.
// 14/18/22 UTC = 10am/2pm/6pm EDT (9am/1pm/5pm EST).
export const config = {
  schedule: '0 14,18,22 * * *',
};

export async function handler(event) {
  // Only run as a scheduled function
  if (!event.type || event.type !== 'schedule') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const hour = localHour();
  if (hour < 7 || hour >= 19) {
    console.log(`Outside 7am–7pm ${BUSINESS_TZ} send window (local hour ${hour}), skipping.`);
    return { statusCode: 200, body: JSON.stringify({ skipped: 'outside send window' }) };
  }

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

  // Load all queued follow-up messages that are due
  const today = localDate();
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
      // Check if client replied OR app already sent this exact step since it was scheduled
      const { data: recentMsgs } = await supabase
        .from('messages')
        .select('id, direction, body')
        .eq('client_id', msg.client_id)
        .gte('created_at', msg.created_at)
        .limit(50);

      const clientReplied = recentMsgs?.some(m => m.direction === 'inbound');
      // All steps of a sequence share a queue timestamp, so "any outbound since
      // queueing" would match step 1's own send and kill steps 2-7. Only skip
      // when this step's exact body already went out (startsWith covers the
      // one-time opt-out line the app appends to a client's first message).
      const alreadySent = recentMsgs?.some(
        m => m.direction === 'outbound' && m.body && msg.body && m.body.startsWith(msg.body)
      );

      if (clientReplied) {
        // Client engaged — cancel this and every other pending step for them
        await supabase
          .from('scheduled_messages')
          .update({ status: 'cancelled', note: 'client replied before send' })
          .eq('client_id', msg.client_id)
          .eq('status', 'pending');
        continue;
      }

      if (alreadySent) {
        // App was open and sent it already — mark as sent to avoid confusion
        await supabase
          .from('scheduled_messages')
          .update({ status: 'sent', note: 'sent by app before cron ran', sent_at: new Date().toISOString() })
          .eq('id', msg.id);
        continue;
      }

      // Send via existing send-sms function
      const res = await fetch(`${NETLIFY_BASE}/.netlify/functions/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': process.env.CRM_API_KEY || '' },
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
