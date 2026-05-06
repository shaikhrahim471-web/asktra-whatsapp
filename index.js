const express = require('express');
const app = express();
app.use(express.json());

const WATI_API_URL = process.env.WATI_API_URL;
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;
const ASKTRA_BASE = 'https://trustadvisory.info';
const ASKTRA_URL = ASKTRA_BASE + '/asktra/api/ask';

app.get('/', (req, res) => res.json({ status: 'Ask TRA WhatsApp Bot is running!', version: '1.0.0' }));

app.post('/webhook', async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body;
    const phone = body.waId || body.phone || (body.contact && body.contact.phone) || body.from;
    const message = body.text || body.body || (body.message && body.message.text);
    if (!phone || !message || typeof message !== 'string') return;
    if (body.eventType === 'outgoing' || body.owner === true) return;
    console.log('Message from ' + phone + ': ' + message);
    await sendWhatsApp(phone, 'Searching TRA Research data...');
    const askResponse = await fetch(ASKTRA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': ASKTRA_BASE,
        'Referer': ASKTRA_BASE + '/asktra/',
        'Host': 'trustadvisory.info',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify({ query: message })
    });
    if (!askResponse.ok) {
      await sendWhatsApp(phone, 'Could not fetch data. Please try again.');
      return;
    }
    const data = await askResponse.json();
    await sendWhatsApp(phone, formatResponse(data, message));
  } catch (err) {
    console.error('Webhook error:', err.message);
  }
});

function formatResponse(data, q) {
  if (!data || !data.sections || !data.sections.length)
    return 'No data for "' + q + '". Try: "Amul rank 2025" or "Top 10 brands BTR 2026"';
  const s = data.sections[0];
  let msg = '';
  if (s.title) msg += s.title + '\n\n';
  if (s.headline) msg += s.headline + '\n\n';
  if (s.insights && s.insights.length) {
    msg += 'Key Findings:\n';
    s.insights.slice(0,3).forEach(i => msg += '- ' + i.replace(/\*\*/g,'').replace(/\*/g,'').trim() + '\n');
    msg += '\n';
  }
  if (s.so_what && s.so_what.length) msg += 'Insight: ' + s.so_what[0] + '\n\n';
  if (s.watch_signal) msg += 'Watch: ' + s.watch_signal + '\n\n';
  msg += 'Source: TRA Research Brand Trust Report';
  return msg.substring(0, 4000);
}

async function sendWhatsApp(phone, message) {
  if (!WATI_API_URL || !WATI_API_TOKEN) { console.log('[DRY RUN]', message.substring(0,80)); return; }
  const r = await fetch(WATI_API_URL + '/api/v1/sendSessionMessage/' + phone.replace('+',''), {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + WATI_API_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messageText: message })
  });
  console.log('Wati:', r.status);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Ask TRA Bot running on port ' + PORT));
