/* ============================================================
   Netlify Function — vote
   ------------------------------------------------------------
   Community-event poll for the newsletter. Each email button
   links here with ?o=<option>. Flow:

     GET  /.netlify/functions/vote?o=trade-nights
          → branded confirm page (nothing recorded yet — this
            keeps email link-scanners from casting phantom votes)
     POST (the confirm button)
          → records the vote into the Netlify Form "event-poll"
            (visible in Netlify → Forms) → thank-you page with
            one-tap links to vote for the other options too.

   Voting is per-click, so one person can vote for all three.
   ============================================================ */

const OPTIONS = {
  'trade-nights': 'Trade nights — Canyon Club / local spots',
  'workshops':    'Workshops — local schools / Canyon Club / church',
  'game-nights':  'TCG game nights — Pokemon / One Piece / Magic'
};

exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const opt = params.o;

  if (!OPTIONS[opt]) {
    return page(400, 'Hmm, that link looks off.',
      '<p style="' + P + '">Head back and tap one of the vote buttons in the email.</p>');
  }

  if (event.httpMethod === 'POST') {
    // Record the vote into Netlify Forms (form "event-poll" is declared
    // as a hidden form in index.html so Netlify captures submissions).
    const site = process.env.URL || 'https://zenbrosbreaks.com';
    try {
      await fetch(site + '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'form-name': 'event-poll',
          'option': OPTIONS[opt],
          'source': 'newsletter'
        }).toString()
      });
    } catch (err) {
      console.error('[vote] record failed:', err && err.message);
      return page(200, 'Hmm, that didn’t save.',
        '<p style="' + P + '">Give it one more try in a minute.</p>' + confirmForm(opt));
    }

    const others = Object.keys(OPTIONS).filter(function (k) { return k !== opt; });
    return page(200, 'Vote counted. Thank you!',
      '<p style="' + P + '">You voted for <strong style="color:#f7f8fa;">' + OPTIONS[opt] + '</strong>.</p>' +
      '<p style="' + P + '">Down for the others too? Tap to vote for those as well:</p>' +
      others.map(function (k) {
        return '<a style="' + BTN_GHOST + '" href="?o=' + k + '">' + OPTIONS[k] + ' &rarr;</a>';
      }).join('') +
      '<a style="' + LINK + '" href="https://zenbrosbreaks.com">Back to zenbrosbreaks.com &rarr;</a>');
  }

  // GET → confirm page
  return page(200, 'Confirm your vote',
    '<p style="' + P + '">One tap to count your vote for:</p>' +
    '<p style="margin:0 0 18px;font-size:17px;font-weight:700;color:#f7f8fa;">' + OPTIONS[opt] + '</p>' +
    confirmForm(opt) +
    '<p style="' + P + ' margin-top:18px;font-size:12px;">You can vote for every option you like &mdash; one tap each.</p>');
};

/* ---- tiny branded page helpers ---------------------------- */

const P = 'margin:0 0 14px;font-size:14px;line-height:1.6;color:#c6cbd4;';
const LINK = 'display:block;margin-top:18px;font-size:13px;color:#8f97a4;text-decoration:none;';
const BTN = 'display:inline-block;background:linear-gradient(120deg,#2ee6a3,#45c6fa);color:#06160e;text-decoration:none;font-weight:800;font-size:15px;padding:13px 26px;border-radius:9px;border:0;cursor:pointer;';
const BTN_GHOST = 'display:block;margin:0 0 10px;background:#21252d;border:1px solid #363c47;color:#f7f8fa;text-decoration:none;font-weight:700;font-size:14px;padding:12px 18px;border-radius:9px;text-align:left;';

function confirmForm(opt) {
  return '<form method="POST" action="?o=' + opt + '" style="margin:0;">' +
    '<button type="submit" style="' + BTN + '">Count my vote &rarr;</button>' +
    '</form>';
}

function page(status, title, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>' + title + ' — Zen Bros Breaks</title></head>' +
      '<body style="margin:0;padding:0;background:#14171c;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Inter,Helvetica,Arial,sans-serif;">' +
      '<div style="max-width:460px;margin:0 auto;padding:48px 20px;">' +
      '<div style="background:#191d23;border:1px solid #363c47;border-radius:14px;padding:28px 26px;">' +
      '<p style="margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.22em;text-transform:uppercase;color:#f7b6c8;">Zen Bros &middot; Community poll</p>' +
      '<h1 style="margin:0 0 14px;font-size:24px;line-height:1.2;color:#f7f8fa;">' + title + '</h1>' +
      body +
      '</div></div></body></html>'
  };
}
