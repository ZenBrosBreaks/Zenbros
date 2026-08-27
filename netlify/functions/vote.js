/* Zen Bros newsletter poll.
   Email links open a confirmation page; only the confirmation POST records a
   Netlify Forms submission. This prevents inbox link scanners from voting. */

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

exports.handler = async function (event) {
  const method = String(event.httpMethod || 'GET').toUpperCase();
  const params = method === 'POST' ? parseBody(event) : (event.queryStringParameters || {});
  const optionId = cleanField(params.o || params.option_id || '');
  const pollId = cleanField(params.poll_id || DEFAULT_POLL_ID);
  const option = OPTIONS[optionId];

  if (!option) {
    return messagePage(400, 'That vote link looks off.', 'Return to the newsletter and choose one of the three poll options.');
  }

  if (method === 'GET' && params.status === 'recorded') {
    return messagePage(200, '&#10003; Vote counted!',
      'Your vote for <strong>' + option.label + '</strong> is in.<br>You can close this page and return to the newsletter.');
  }

  if (method === 'GET') return confirmationPage(optionId, option, pollId);
  if (method !== 'POST') return messagePage(405, 'Method not allowed.', 'Return to the newsletter and choose an option.');

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
    return messagePage(503, 'Your vote did not save.', 'Please return to the newsletter and try your choice once more.');
  }

  return {
    statusCode: 303,
    headers: {
      'Location': '/.netlify/functions/vote?status=recorded&o=' + encodeURIComponent(optionId) + '&poll_id=' + encodeURIComponent(pollId),
      'Cache-Control': 'no-store, max-age=0'
    },
    body: ''
  };
};

function parseBody(event) {
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body || '', 'base64').toString('utf8')
    : (event.body || '');
  return Object.fromEntries(new URLSearchParams(raw));
}

function cleanField(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80) || DEFAULT_POLL_ID;
}

function confirmationPage(optionId, option, pollId) {
  const content =
    '<p style="margin:0 0 5px;font-size:11px;font-weight:800;letter-spacing:2px;color:#4e6259;">YOUR SELECTION</p>' +
    '<h1 style="margin:0;font-size:28px;line-height:1.15;color:#111111;">' + option.label + '</h1>' +
    '<p style="margin:10px 0 22px;font-size:14px;line-height:1.55;color:#505654;">' + option.details + '</p>' +
    '<form method="post" action="/.netlify/functions/vote" style="margin:0;">' +
      '<input type="hidden" name="o" value="' + optionId + '">' +
      '<input type="hidden" name="poll_id" value="' + pollId + '">' +
      '<button type="submit" style="width:100%;padding:15px 18px;border:1px solid #111111;background:#111111;color:#ffffff;font:800 14px/18px -apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;letter-spacing:.4px;cursor:pointer;">CONFIRM VOTE</button>' +
    '</form>' +
    '<p style="margin:13px 0 0;font-size:11px;line-height:1.45;color:#737876;">Nothing is recorded until you tap Confirm Vote.</p>';
  return shell(200, 'Confirm your vote', content);
}

function messagePage(statusCode, title, body) {
  const content =
    '<h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;color:#111111;">' + title + '</h1>' +
    '<p style="margin:0;font-size:14px;line-height:1.6;color:#505654;">' + body + '</p>';
  return shell(statusCode, 'Zen Bros community poll', content);
}

function shell(statusCode, title, content) {
  return {
    statusCode: statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0'
    },
    body: '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>' + title + '</title></head>' +
      '<body style="margin:0;padding:0;background:#f2f7f4;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Arial,sans-serif;">' +
      '<main style="max-width:440px;margin:0 auto;padding:48px 18px;">' +
        '<section style="border:1px solid #111111;background:#ffffff;">' +
          '<div style="height:5px;background:#C8F0DD;"></div>' +
          '<div style="padding:28px 24px 30px;text-align:center;">' +
            '<p style="margin:0 0 18px;font-size:10px;font-weight:900;letter-spacing:2px;color:#111111;">ZENBROSBREAKS &middot; COMMUNITY POLL</p>' +
            content +
          '</div>' +
        '</section>' +
      '</main></body></html>'
  };
}
