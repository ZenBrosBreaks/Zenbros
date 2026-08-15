/* ============================================================
   Netlify Function — vote
   ------------------------------------------------------------
   One-tap poll voting from the newsletter. Clicking a link in
   the email records the vote instantly and shows a tiny
   "counted" page — no confirm step, no site chrome.

     GET /.netlify/functions/vote?o=trade-nights → recorded

   Votes land in Netlify → Forms → "event-poll". Each click is
   one vote, so the same person can vote for all options.
   Obvious link-scanner user agents are skipped so they don't
   cast phantom votes.
   ============================================================ */

const OPTIONS = {
  'trade-nights': 'Trade nights — Canyon Club / local spots',
  'workshops':    'Workshops — local schools / Canyon Club / church',
  'game-nights':  'TCG game nights — Pokemon / One Piece / Magic'
};

const BOT_UA = /bot|crawl|spider|preview|scan|probe|monitor|curl|wget|python|headless|slurp|fetch/i;

exports.handler = async function (event) {
  const opt = (event.queryStringParameters || {}).o;
  if (!OPTIONS[opt]) {
    return page('Hmm, that link looks off.', 'Head back to the email and tap one of the vote options.');
  }

  const ua = (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || '';
  const isBot = BOT_UA.test(ua);

  if (!isBot) {
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
    }
  }

  return page('&#10003; Vote counted!',
    'Thanks &mdash; you voted for <strong style="color:#ffffff;">' + OPTIONS[opt] + '</strong>.<br />' +
    'You can close this tab. Want to back another idea? Tap it in the email too.');
};

function page(title, body) {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
    body: '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>Zen Bros — Community poll</title></head>' +
      '<body style="margin:0;padding:0;background:#12161c;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;">' +
      '<div style="max-width:420px;margin:0 auto;padding:60px 20px;text-align:center;">' +
      '<p style="margin:0 0 8px;font-size:11px;font-weight:800;letter-spacing:3px;color:#2ee6a3;">ZEN BROS &middot; COMMUNITY POLL</p>' +
      '<h1 style="margin:0 0 12px;font-size:26px;line-height:1.2;color:#f7f8fa;">' + title + '</h1>' +
      '<p style="margin:0;font-size:14px;line-height:1.6;color:#c6cbd4;">' + body + '</p>' +
      '</div></body></html>'
  };
}
