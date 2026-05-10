const express = require('express');
const app = express();
app.use(express.json());

const WATI_API_URL = process.env.WATI_API_URL;
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;

app.get('/', (req, res) => res.json({ status: 'Ask TRA Bot running' }));

app.post('/webhook', async (req, res) => {
        res.sendStatus(200);
        try {
                  const body = req.body;
                  console.log('WEBHOOK:', JSON.stringify(body).substring(0, 200));
                  const phone = body.waId || body.phone || (body.contact && body.contact.phone) || body.from;
                  let message = null;
                  if (body.text && typeof body.text === 'object' && body.text.body) message = body.text.body;
                  else if (body.text && typeof body.text === 'string') message = body.text;
                  else if (body.body && typeof body.body === 'string') message = body.body;
                  if (!phone || !message || message.trim() === '') return;
                  if (body.eventType === 'outgoing' || body.owner === true) return;
                  console.log('MSG:', phone, message);
                  const greetings = ['hi', 'hello', 'hey', 'help', 'start', 'namaste'];
                  if (greetings.includes(message.trim().toLowerCase())) {
                              await sendWA(phone, 'Welcome to *Ask TRA* - Your Brand Intelligence Assistant!\n\nI can look up brand rankings from TRA Research.\n\n*Try asking:*\n- Surf Excel\n- Tata Salt\n- Amul\n- Top brands in FABRICARE\n\n_Powered by TRA Research_');
                              return;
                  }
                  await sendWA(phone, 'Searching TRA Research data...');
                  const result = await queryAskTRA(message);
                  await sendWA(phone, result);
        } catch(e) { console.error('ERR:', e.message); }
});

async function queryAskTRA(query) {
        try {
                  const r = await fetch('https://trustadvisory.info/asktra/api/ask', {
                              method: 'POST',
                              headers: {
                                            'Content-Type': 'application/json',
                                            'Origin': 'https://trustadvisory.info',
                                            'Referer': 'https://trustadvisory.info/asktra/'
                              },
                              body: JSON.stringify({ query })
                  });
                  if (!r.ok) { console.log('TRA ask error:', r.status); return fallbackSearch(query); }
                  const data = await r.json();
                  console.log('TRA response sections:', data.sections ? data.sections.length : 0);
                  if (!data.sections || !data.sections.length) return fallbackSearch(query);
                  const s = data.sections[0];
                  const brand = s.brand || query;
                  const chart = s.chart;
                  let reply = `*${brand}* - TRA Brand Trust Report\n\n`;
                  if (chart && chart.ranks && chart.years) {
                              reply += `*Rankings over the years:*\n`;
                              chart.years.forEach((yr, i) => { reply += `${yr}: Rank #${chart.ranks[i]}\n`; });
                  }
                  if (s.category) reply += `\nCategory: ${s.category}\n`;
                  if (s.headline) reply += `\n${s.headline}\n`;
                  reply += `\n_Source: TRA Research_`;
                  return reply;
        } catch(e) {
                            console.error('queryAskTRA error:', e.message);
                  return fallbackSearch(query);
        }
}

async function fallbackSearch(query) {
        return `Sorry, I could not find data for *${query}* right now.\n\nTry:\n- Check spelling\n- Try: Amul, Tata Salt, Surf Excel, Amul Butter`;
}

async function sendWA(phone, message) {
        const url = `${WATI_API_URL}/api/v1/sendSessionMessage/${phone}?messageText=${encodeURIComponent(message)}`;
        console.log('Sending to:', url.substring(0, 80));
        const r = await fetch(url, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${WATI_API_TOKEN}`, 'Content-Type': 'application/json' },
                  body: JSON.stringify({})
        });
        const txt = await r.text();
        console.log('WATI send:', r.status, txt.substring(0, 100));
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ask TRA Bot running on port ${PORT}`));
