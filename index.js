const express = require('express');
const app = express();
app.use(express.json());
const WATI_API_URL = process.env.WATI_API_URL;
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;
const ASKTRA_BASE = 'https://trustadvisory.info';
const ASKTRA_URL = ASKTRA_BASE + '/asktra/api/ask';
app.get('/', (req, res) => res.json({ status: 'running' }));
app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    console.log('WEBHOOK:', JSON.stringify(body).substring(0, 400));
    const phone = body.waId || body.phone || (body.contact && body.contact.phone) || body.from;
    let message = null;
    if (body.text && typeof body.text === 'object' && body.text.body) message = body.text.body;
    else if (body.text && typeof body.text === 'string') message = body.text;
    else if (body.body && typeof body.body === 'string') message = body.body;
    if (!phone || !message || message.trim() === '') { console.log('Skip'); return; }
    if (body.eventType === 'outgoing' || body.owner === true) return;
    console.log('MSG:', phone, message);
    await sendWA(phone, 'Searching TRA Research data...');
    const r = await fetch(ASKTRA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Origin': ASKTRA_BASE, 'Referer': ASKTRA_BASE + '/asktra/', 'Host': 'trustadvisory.info', 'X-Requested-With': 'XMLHttpRequest' },
      body: JSON.stringify({ query: message })
    });
    console.log('TRA status:', r.status);
    if (!r.ok) { await sendWA(phone, 'TRA error ' + r.status); return; }
    const data = await r.json();
    await sendWA(phone, fmt(data, message));
  } catch(e) { console.error('ERR:', e.message); }
});
function fmt(data, q) {
  if (!data || !data.sections || !data.sections.length) return 'No data for: "' + q + '". Try: "Amul rank 2025"';
  const s = data.sections[0];
  let m = '';
  if (s.title) m += s.title + '\n\n';
  if (s.headline) m += s.headline + '\n\n';
  if (s.insights && s.insights.length) { m += 'Key Findings:\n'; s.insights.slice(0,3).forEach(i => m += '- ' + i.replace(/\*\*/g,'').replace(/\*/g,'').trim() + '\n'); m += '\n'; }
  if (s.so_what && s.so_what.length) m += 'Insight: ' + s.so_what[0] + '\n\n';
  m += 'Source: TRA Research Brand Trust Report';
  return m.substring(0, 4000);
}
async function sendWA(phone, msg) {
  if (!WATI_API_URL || !WATI_API_TOKEN) { console.log('[DRY]', msg); return; }
  const p = String(phone).replace('+','').replace(/\s/g,'');
  const r = await fetch(WATI_API_URL + '/api/v1/sendSessionMessage/' + p, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + WATI_API_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageText: msg })
  });
  const j = await r.json();
  console.log('Wati:', r.status, JSON.stringify(j).substring(0,100));
}
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Ask TRA Bot v1.1 on port ' + PORT));
