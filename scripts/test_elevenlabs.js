const fs = require('fs');
const path = require('path');

// Load .env if possible, otherwise fallback to simple parser
try {
  require('dotenv').config();
} catch (e) {
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, 'utf8');
    raw.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) {
        const key = m[1];
        let val = m[2] || '';
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[key] = val;
      }
    });
  }
}

const apiKey = process.env.ELEVENLABS_API_KEY;
const voiceId = process.env.ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB';
const text = process.argv.slice(2).join(' ') || 'تحذير طبي. استجابة عاجلة مطلوبة.';
const outFile = path.join(process.cwd(), 'tts_test_output.mp3');

if (!apiKey) {
  console.error('ELEVENLABS_API_KEY not set in environment or .env');
  process.exit(1);
}

(async () => {
  try {
    if (typeof fetch === 'undefined') {
      // Node >=18 has fetch; otherwise try dynamic import of node-fetch
      try {
        global.fetch = (await import('node-fetch')).default;
      } catch (e) {
        console.error('fetch is not available and node-fetch is not installed. Use Node 18+ or install node-fetch.');
        process.exit(1);
      }
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
        'User-Agent': 'node-test-script',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!resp.ok) {
      const txt = await resp.text().catch(() => '<no-body>');
      throw new Error(`HTTP ${resp.status} - ${txt}`);
    }

    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(outFile, buffer);
    console.log('✅ Wrote', outFile, buffer.length, 'bytes');
  } catch (err) {
    console.error('❌ ElevenLabs test failed:', err.message || err);
    process.exit(2);
  }
})();
