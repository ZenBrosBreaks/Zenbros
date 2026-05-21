/* ============================================================
   Netlify Function — submission-created
   ------------------------------------------------------------
   Fires automatically when ANY Netlify Form on the site is
   submitted. For the "newsletter" form we send a welcome email
   via Resend containing the WELCOME10 discount code.

   Required env var (Netlify → Site config → Environment vars):
     RESEND_API_KEY   — from https://resend.com/api-keys

   If the key isn't set yet, the function no-ops and logs — the
   signup itself still lands in the Netlify Forms panel.
   ============================================================ */

const SENDER  = 'Zen Bros Breaks <noreply@zenbrosbreaks.com>';
const REPLY   = '';                       // optional: set to a real inbox if you want replies
const CODE    = 'WELCOME10';
const SHOP    = 'https://zenbrosbreaks.com';

exports.handler = async function (event) {
  // Diagnostic: prove the function actually got invoked
  console.log('[welcome-email] Invoked. method=' + event.httpMethod + ', body-length=' + (event.body || '').length);

  // Netlify wraps the form submission as { payload: { form_name, data, ... } }
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (_) { return ok('Bad JSON'); }
  const payload = body && body.payload;
  console.log('[welcome-email] form_name=' + (payload && payload.form_name));
  if (!payload || payload.form_name !== 'newsletter') return ok('Not our form');

  const email = payload.data && payload.data.email;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok('No valid email');

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('[welcome-email] RESEND_API_KEY missing — skipped send for', email);
    return ok('No API key (skipped)');
  }

  const headers = {
    'Authorization': 'Bearer ' + key,
    'Content-Type':  'application/json'
  };
  const message = {
    from:    SENDER,
    to:      [email],
    subject: 'Welcome — here’s 10% off your first break',
    html:    htmlBody(),
    text:    textBody()
  };
  if (REPLY) message.reply_to = REPLY;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: headers,
      body:    JSON.stringify(message)
    });
    if (!res.ok) {
      const txt = await res.text().catch(function () { return ''; });
      console.error('[welcome-email] Resend rejected', res.status, txt);
      return ok('Resend error (logged)');
    }
    console.log('[welcome-email] Sent to', email);
  } catch (err) {
    console.error('[welcome-email] Send threw:', err && err.message);
    return ok('Send failed (logged)');
  }

  // Best-effort sync to the Resend Audience used for broadcasts.
  // Set RESEND_AUDIENCE_ID in Netlify env vars to enable; safe to skip otherwise.
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (audienceId) {
    try {
      const ares = await fetch('https://api.resend.com/audiences/' + audienceId + '/contacts', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ email: email, unsubscribed: false })
      });
      if (ares.ok) {
        console.log('[welcome-email] Added to audience:', email);
      } else {
        const atxt = await ares.text().catch(function () { return ''; });
        // 409/422 typically = already in audience; log but don't fail
        console.warn('[welcome-email] Audience add non-ok', ares.status, atxt);
      }
    } catch (err) {
      console.error('[welcome-email] Audience add threw:', err && err.message);
    }
  }

  return ok('Sent');
};

function ok(msg) { return { statusCode: 200, body: msg }; }

function htmlBody() {
  return [
'<!doctype html>',
'<html lang="en"><head><meta charset="utf-8">',
'<meta name="viewport" content="width=device-width,initial-scale=1">',
'<title>Welcome to Zen Bros Breaks</title>',
'</head>',
'<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Inter,Helvetica,Arial,sans-serif;color:#111;">',
'  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f6;padding:36px 16px;">',
'    <tr><td align="center">',
'      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">',
'        <tr><td style="padding:34px 32px 8px;">',
'          <p style="margin:0;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#83858e;font-weight:700;">Zen Bros Breaks</p>',
'          <h1 style="margin:14px 0 8px;font-size:24px;line-height:1.25;font-weight:800;color:#111;letter-spacing:-.01em;">10% off your first break.</h1>',
'          <p style="margin:0;font-size:15px;line-height:1.55;color:#444;">Thanks for joining. Use the code below at checkout — it works once on your first order.</p>',
'        </td></tr>',
'        <tr><td align="center" style="padding:26px 32px 6px;">',
'          <div style="display:inline-block;padding:18px 28px;border:1px dashed #0a84ff;border-radius:10px;background:#eaf3ff;">',
'            <span style="font-family:\'SF Mono\',Menlo,Consolas,monospace;font-size:22px;font-weight:800;letter-spacing:.14em;color:#0a84ff;">' + CODE + '</span>',
'          </div>',
'        </td></tr>',
'        <tr><td align="center" style="padding:20px 32px 30px;">',
'          <a href="' + SHOP + '" style="display:inline-block;background:#0a84ff;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:13px 26px;border-radius:10px;">See available breaks →</a>',
'        </td></tr>',
'        <tr><td style="padding:0 32px 28px;">',
'          <p style="margin:0;font-size:13px;line-height:1.6;color:#555;">We’ll also drop you a heads-up before each break goes live. No daily noise.</p>',
'        </td></tr>',
'        <tr><td style="background:#f9f9fb;padding:18px 32px;border-top:1px solid #eaeaef;">',
'          <p style="margin:0;font-size:11px;line-height:1.55;color:#888;">You’re getting this because you signed up at zenbrosbreaks.com. Don’t want these? Reply <strong>unsubscribe</strong> and we’ll remove you.</p>',
'        </td></tr>',
'      </table>',
'    </td></tr>',
'  </table>',
'</body></html>'
  ].join('\n');
}

function textBody() {
  return [
    'Welcome to Zen Bros Breaks.',
    '',
    'Here’s 10% off your first break: ' + CODE,
    'Apply it at checkout — works once on your first order.',
    '',
    'See available breaks: ' + SHOP,
    '',
    'We’ll also drop you a heads-up before each break goes live.',
    '',
    '— Zen Bros',
    '',
    'You’re getting this because you signed up at zenbrosbreaks.com.',
    'Reply "unsubscribe" to be removed.'
  ].join('\n');
}
