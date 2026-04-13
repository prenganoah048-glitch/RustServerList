const express = require('express');
const fetch = require('node-fetch');
const app = express();

const CLIENT_ID = '1493300661171785849';
const CLIENT_SECRET = 'QaIzVPwknGB9_ABqDQg3ed0-V_C1J_v_';
const BOT_TOKEN = 'MTQ5MzMwMDY2MTE3MTc4NTg0OQ.GlwKCB.3N3G1NPPjlvvICsBfEQnPSASKup66PnWsddi6g';
const REDIRECT_URI = 'https://pull-back.onrender.com';

app.get('/', (req, res) => {
  const url = `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds.join`;
  res.redirect(url);
});

app.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.send('No code provided.');

  try {
    // Step 1: Exchange code for access token
    const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
      method: 'POST',
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const tokenData = await tokenRes.json();
    const access_token = tokenData.access_token;

    // Step 2: Get user info
    const userRes = await fetch('https://discord.com/api/users/@me', {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    const user = await userRes.json();

    // Step 3: Add user to guild
    await fetch(`https://discord.com/api/guilds/${GUILD_ID}/members/${user.id}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ access_token }),
    });

    res.send('✅ You have been added to the server! You can close this tab.');
  } catch (err) {
    console.error(err);
    res.send('❌ Something went wrong. Please try again.');
  }
});

app.listen(3000, () => console.log('Running on port 3000'));
