/* Zen Bros newsletter poll.
   A valid email-link GET records one vote in Netlify Forms, then returns a
   compact result page. Obvious inbox scanners are ignored. */

const DEFAULT_POLL_ID = 'first-zen-event-september-2026';

const OPTIONS = {
  'trade-nights': {
    label: 'Trade Night',
    details: 'Bring your collection and trade with other local collectors.'
  },
  'workshops': {
    label: 'Kids\' Hobby Workshop',
    details: 'Card values, negotiation, fair trading and hobby risks.'
  },
  'live-break-night': {
    label: 'Live Break Night',
    details: 'A grown-up Canyon Club night with drinks, apps and live rips.'
  },
  // Keep links from the previous newsletter working.
  'game-nights': {
    label: 'TCG Game Night',
    details: 'Pokemon, One Piece and Magic with local collectors.'
  }
};

const BOT_UA = /bot|crawl|spider|preview|scan|probe|monitor|curl|wget|python|headless|slurp|fetch|safelink|urlcheck|security/i;

exports.handler = async function (event) {
  const method = String(event.httpMethod || 'GET').toUpperCase();
  const query = event.queryStringParameters || {};
  const optionId = cleanField(query.o || '');
  const pollId = cleanField(query.poll_id || DEFAULT_POLL_ID);
  const option = OPTIONS[optionId];

  if (!option) {
    return messagePage(400, 'That vote link looks off.', 'Return to the newsletter and choose one of the three poll options.');
  }
  if (method === 'HEAD') return { statusCode: 204, headers: noCacheHeaders(), body: '' };
  if (method !== 'GET') return messagePage(405, 'Method not allowed.', 'Return to the newsletter and choose an option.');

  const ua = (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || '';
  const isScanner = BOT_UA.test(ua);

  if (!isScanner) {
    const site = process.env.URL || 'https://zenbrosbreaks.com';
    try {
      const response = await fetch(site + '/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          'form-name': 'event-poll',
          'poll_id': pollId,
          'option_id': optionId,
          'option': option.label,
          'option_details': option.details,
          'source': 'newsletter'
        }).toString()
      });
      if (!response.ok) throw new Error('Netlify Forms returned ' + response.status);
    } catch (err) {
      console.error('[vote] record failed:', err && err.message);
      return messagePage(503, 'Your vote did not save.', 'Please return to the newsletter and tap your choice once more.');
    }
  }

  return messagePage(200, '&#10003; Vote counted!',
    'Your vote for <strong>' + option.label + '</strong> is in.<br>You can close this page and return to the newsletter.',
    true);
};

function cleanField(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || DEFAULT_POLL_ID;
}

function noCacheHeaders() {
  return {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store, max-age=0'
  };
}

function messagePage(statusCode, title, body, tryClose) {
  return {
    statusCode: statusCode,
    headers: noCacheHeaders(),
    body: '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Zen Bros community poll</title></head>' +
      '<body style="margin:0;padding:0;background:#f2f7f4;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;">' +
      '<main style="max-width:440px;margin:0 auto;padding:48px 18px;">' +
        '<section style="border:1px solid #111111;background:#ffffff;">' +
          '<div style="height:5px;background:#C8F0DD;"></div>' +
          '<div style="padding:30px 24px;text-align:center;">' +
            '<p style="margin:0 0 18px;font-size:10px;font-weight:900;letter-spacing:2px;color:#111111;">ZENBROSBREAKS &middot; COMMUNITY POLL</p>' +
            '<h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;color:#111111;">' + title + '</h1>' +
            '<p style="margin:0;font-size:14px;line-height:1.6;color:#505654;">' + body + '</p>' +
          '</div>' +
        '</section>' +
      '</main>' +
      (tryClose ? '<script>setTimeout(function(){try{window.close();}catch(e){}},1200);</script>' : '') +
      '</body></html>'
  };
}
