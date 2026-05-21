/* ============================================================
   Netlify Function — audience-info
   ------------------------------------------------------------
   One-off helper: visit this in a browser to see all Resend
   audiences for the account, including their IDs.
   URL: https://zenbrosbreaks.com/.netlify/functions/audience-info
   Safe to delete once you've grabbed the audience ID.
   ============================================================ */

exports.handler = async function () {
  const key = process.env.RESEND_API_KEY;
  if (!key) return resp(500, { error: 'RESEND_API_KEY env var not set' });

  const authHeader = { 'Authorization': 'Bearer ' + key };

  try {
    // 1. List existing audiences
    const listRes = await fetch('https://api.resend.com/audiences', { headers: authHeader });
    const listData = await listRes.json();

    if (listData && Array.isArray(listData.data) && listData.data.length > 0) {
      return resp(200, {
        status: 'existing',
        instruction: 'Copy the "id" value below and add it to Netlify as RESEND_AUDIENCE_ID.',
        audiences: listData.data
      });
    }

    // 2. No audiences — create one
    const createRes = await fetch('https://api.resend.com/audiences', {
      method: 'POST',
      headers: Object.assign({}, authHeader, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ name: 'Zen Bros Subscribers' })
    });
    const createData = await createRes.json();

    return resp(200, {
      status: 'created',
      instruction: 'A new audience was created. Copy the "id" below and add it to Netlify as RESEND_AUDIENCE_ID.',
      audience: createData
    });
  } catch (err) {
    return resp(500, { error: String(err && err.message) });
  }
};

function resp(status, obj) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(obj, null, 2)
  };
}
