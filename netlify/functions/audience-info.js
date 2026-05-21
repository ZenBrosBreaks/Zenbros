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
  if (!key) {
    return { statusCode: 500, body: 'RESEND_API_KEY env var not set' };
  }

  try {
    const res = await fetch('https://api.resend.com/audiences', {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    const data = await res.json();
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data, null, 2)
    };
  } catch (err) {
    return { statusCode: 500, body: 'Fetch error: ' + (err && err.message) };
  }
};
