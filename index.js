const express = require('express');
const app = express();
app.use(express.json());

const WATI_API_URL = process.env.WATI_API_URL;
const WATI_API_TOKEN = process.env.WATI_API_TOKEN;
const TRA_BASE = 'https://trustadvisory.info/asktra/api';

// Health check
app.get('/', (req, res) => res.json({ status: 'Ask TRA WhatsApp Bot is running' }));

// WATI webhook
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
          if (!phone || !message || message.trim() === '') { console.log('Skip - no phone or message'); return; }
          if (body.eventType === 'outgoing' || body.owner === true) return;
          console.log('MSG:', phone, message);

      const greetings = ['hi', 'hello', 'hey', 'help', 'start', 'namaste'];
          if (greetings.includes(message.trim().toLowerCase())) {
                  await sendWA(phone, 'Welcome to *Ask TRA* - Your Brand Intelligence Assistant!\n\nI can look up brand rankings from TRA Research.\n\n*Try asking:*\n- Surf Excel\n- Tata Salt 2024\n- Top brands in detergent\n- Amul ranking\n\n_Powered by TRA Research_');
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
    const cleanText = text.replace(/(202[0-9])/g, '').replace(/ranking|rank|trust|score|report|show me|what is|where is/gi, '').trim();

  // Category query
  const catTriggers = ['top brands in', 'top 10', 'best brands in', 'brands in'];
    for (const t of catTriggers) {
          if (text.toLowerCase().includes(t)) {
                  const category = text.toLowerCase().replace(t, '').trim().toUpperCase();
                  return await getCategoryBrands(category, year);
          }
    }

  // Brand query - search across categories
  return await getBrandRanking(cleanText, year);
}

async function getCategoryBrands(category, year) {
    try {
          const url = `${TRA_BASE}/category_brands?report=BTR&year=${year}&category=${encodeURIComponent(category)}&limit=10`;
          const r = await fetch(url);
          if (!r.ok) return `Sorry, could not find data for category: ${category}`;
          const data = await r.json();
          if (!data.data || !data.data.length) return `No data found for *${category}* in ${year}. Try a different category name.`;
          let reply = `Top Brands in *${category}* (${year} BTR):\n\n`;
          data.data.forEach(b => {
                  reply += `${b.category_rank}. *${b.brand_name}* - Overall Rank #${b.rank}\n`;
          });
          reply += `\n_Source: TRA Research_`;
          return reply;
    } catch(e) {
          return 'Sorry, could not fetch category data. Please try again.';
    }
}

async function getBrandRanking(brandName, year) {
    try {
          const url = `${TRA_BASE}/category_yoy_brands?report=BTR&year=${year}&category=ALL&limit=1000`;
          const r = await fetch(url);
          if (r.ok) {
                  const data = await r.json();
                  if (data.data) {
                            const found = data.data.filter(b => b.brand_name.toLowerCase().includes(brandName.toLowerCase()));
                            if (found.length > 0) {
                                        const b = found[0];
                                        const change = b.rank_diff || 0;
                                        const arrow = change < 0 ? 'UP' : change > 0 ? 'DOWN' : 'SAME';
                                        return `*${b.brand_name}* - TRA Brand Trust Report ${year}\n\nRank: #${b.rank}\nCategory: ${b.category}\nMovement: ${arrow} ${Math.abs(change)} places vs previous year\n\n_Source: TRA Research_`;
                            }
                  }
          }
          // Try category_brands with known categories
      const categories = ['DETERGENTS', 'BISCUITS', 'BEVERAGES', 'AUTOMOBILES', 'BANKS', 'TELECOM', 'ECOMMERCE', 'FMCG'];
          for (const cat of categories) {
                  const catUrl = `${TRA_BASE}/category_brands?report=BTR&year=${year}&category=${cat}&limit=50`;
                  const cr = await fetch(catUrl);
                  if (cr.ok) {
                            const cd = await cr.json();
                            if (cd.data) {
                                        const found = cd.data.filter(b => b.brand_name.toLowerCase().includes(brandName.toLowerCase()));
                                        if (found.length > 0) {
                                                      const b = found[0];
                                                      return `*${b.brand_name}* - TRA Brand Trust Report ${year}\n\nCategory Rank: #${b.category_rank} in ${b.category}\nOverall Rank: #${b.rank}\n\n_Source: TRA Research_`;
                                        }
                            }
                  }
          }
          return `Could not find *${brandName}* in TRA database for ${year}.\n\nTry:\n- Check spelling\n- Try a different year\n- Ask for a category: "Top brands in detergent"`;
    } catch(e) {
          return 'Sorry, there was an error fetching brand data. Please try again.';
    }
}

async function sendWA(phone, message) {
    const url = `${WATI_API_URL}/api/v1/sendSessionMessage/${phone}`;
    const r = await fetch(url, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${WATI_API_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messageText: message })
    });
    console.log('WATI send:', r.status);
    return r;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Ask TRA Bot running on port ${PORT}`));
