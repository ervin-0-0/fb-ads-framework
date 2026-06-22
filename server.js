const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '5mb' }));

// Serve static files (HTML, assets)
app.use(express.static(path.join(__dirname), { index: false }));

// Health check — also lets the frontend detect server mode
app.get('/api/ping', (_req, res) => res.json({ ok: true }));

// Gemini API proxy — keeps GOOGLE_API_KEY on the server
app.post('/api/ai', async (req, res) => {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: { message: '請在 Zeabur 環境變數中設定 GOOGLE_API_KEY' }
    });
  }
  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(req.body)
      }
    );
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(500).json({ error: { message: err.message } });
  }
});

// Serve the SOP page at root
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'fb-ads-sop.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FB Ads SOP running on http://localhost:${PORT}`));
