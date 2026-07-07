import crypto from 'crypto';

// Shared-secret auth for CRM-only endpoints.
// Fails open when CRM_API_KEY is not configured so a deploy can't break
// messaging before the env var is set — set CRM_API_KEY in Netlify env
// (and VITE_CRM_API_KEY in the CRM app) to activate protection.
export function requireApiKey(event, headers) {
  const key = process.env.CRM_API_KEY;
  if (!key) {
    console.warn('CRM_API_KEY not set — endpoint is unprotected');
    return null;
  }
  const provided = event.headers['x-api-key'] || event.headers['X-Api-Key'] || '';
  if (provided !== key) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
  }
  return null;
}

// Twilio webhook signature validation (X-Twilio-Signature).
// Set TWILIO_SIG_VALIDATION=off in Netlify env to disable if webhooks
// stop logging (e.g. URL mismatch behind a proxy).
export function validateTwilioSignature(event) {
  if (process.env.TWILIO_SIG_VALIDATION === 'off') return true;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return true;

  const signature = event.headers['x-twilio-signature'] || '';
  if (!signature) return false;

  const url = event.rawUrl || '';
  const params = new URLSearchParams(event.body || '');
  const sorted = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const data = url + sorted.map(([k, v]) => k + v).join('');
  const expected = crypto.createHmac('sha1', token).update(Buffer.from(data, 'utf-8')).digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
