const express = require('express');
const app = express();
app.use(express.json());

const WATI_API_URL = process.env.WATI_API_URL; // e.g. https://live.wati.io/10155092
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;
const TRA_BASE = 'https://trustadvisory.info/asktra/api';

app.get('/', (req, res) => res.json({ status: 'Ask TRA WhatsApp Bot is running' }));

app.post('/webhook', async (req, res) => {
      res.sendStatus(200);
      try {
              const body = req.body;
              console.log('WEBHOOK:', JSON.stringify(body).substring(0, 300));
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
                        await sendWA(phone, 'Welcome to *Ask TRA* - Your Brand Intelligence Assistant!\n\nI can look up brand rankings from TRA Research.\n\n*Try asking:*\n- Surf Excel\n- Tata Salt 2024\n- Top brands in detergent\n\n_Powered by TRA Research_');
                        return;
              }
              await sendWA(phone, 'Searching TRA Research data...');
              const result = await queryTRA(message);
              await sendWA(phone, result);
      } catch(e) { console.error('ERR:', e.message); }
});

async function queryTRA(message) {
      const text = message.trim();
      const yearMatch = text.match(/(202[0-9])/);
      const year = yearMatch ? parseInt(yearMatch[1]) : 2026;
      const catTriggers = ['top brands in', 'top 10', 'best brands in', 'brands in'];
      for (const t of catTriggers) {
              if (text.toLowerCase().includes(t)) {
                        const category = text.toLowerCase().replace(t, '').trim().toUpperCase();
                        return await getCategoryBrands(category, year);
              }
      }
      const cleanText = text.replace(/(202[0-9])/g, '').replace(/ranking|rank|trust|score|report|show me|what is|where is/gi, '').trim();
      return await getBrandRanking(cleanText, year);
}

async function getCategoryBrands(category, year) {
      try {
              const url = `${TRA_BASE}/category_brands?report=BTR&year=${year}&category=${encodeURIComponent(category)}&limit=10`;
              const r = await fetch(url);
              if (!r.ok) return `Sorry, could not find data for: ${category}`;
              const data = await r.json();
              if (!data.data || !data.data.length) return `No data found for *${category}* in ${year}.`;
              let reply = `Top Brands in *${category}* (${year}):\n\n`;
              data.data.forEach(b => { reply += `${b.category_rank}. *${b.brand_name}* - Rank #${b.rank}\n`; });
              reply += `\n_Source: TRA Research_`;
              return reply;
      } catch(e) { return 'Error fetching category data.'; }
}

async function getBrandRanking(brandName, year) {
      try {
              const categories = ['DETERGENTS','BISCUITS','BEVERAGES','AUTOMOBILES','BANK - PSU','TELECOM','ECOMMERCE','PERSONAL CARE','DAIRY','NOODLES - INSTANT'];
              for (const cat of categories) {
                        const url = `${TRA_BASE}/category_brands?report=BTR&year=${year}&category=${encodeURIComponent(cat)}&limit=50`;
                        const r = await fetch(url);
                        if (!r.ok) continue;
                        const data = await r.json();
                        if (!data.data) continue;
                        const found = data.data.find(b => b.brand_name.toLowerCase().includes(brandName.toLowerCase()));
                        if (found) {
                                    return `*${found.brand_name}* - TRA Brand Trust Report ${year}\n\nCategory Rank: #${found.category_rank} in ${found.category}\nOverall Rank: #${found.rank}\n\n_Source: TRA Research_`;
                        }
              }
              return `Could not find *${brandName}* in the TRA database for ${year}.\n\nTry:\n- Check spelling\n- Try a different year\n- Ask: Top brands in [category name]`;
      } catch(e) { return 'Error fetching brand data. Please try again.'; }
}

async function sendWA(phone, message) {
      // WATI sendSessionMessage API
  const url = `${WATI_API_URL}/api/v1/sendSessionMessage/${phone}?messageText=${encodeURIComponent(message)}`;
      console.log('Sending to:', url.substring(0, 80));
      const r = await fetch(url, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${WATI_API_TOKEN}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({})
      });
      const txt = await r.text();
      console.log('WATI send:', r.status, txt.substring(0, 100));
      return r;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ask TRA Bot running on port ${PORT}`));
