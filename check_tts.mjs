// TTS diagnostic — tests all 3 engines
import * as os from "os";
import * as path from "path";
import * as fs from "fs";

const ELEVENLABS_KEY = process.env.ELEVENLABS_API_KEY || "sk_ce68cae7b581f3dc2f326b71a829bfabb31e20cb1d97932f";
const ELEVENLABS_VOICE = process.env.ELEVENLABS_VOICE_ID || "EUojVLG1QfxaqqH4ce6s";
const TEST_TEXT = "مرحباً، هذا اختبار للصوت";

// ── 1) ElevenLabs ────────────────────────────────────────────────
async function testElevenLabs() {
  console.log("\n🔊 [1] Testing ElevenLabs...");
  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE}/stream`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": ELEVENLABS_KEY,
        },
        body: JSON.stringify({
          text: TEST_TEXT,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(15000),
      }
    );
    const body = await res.text();
    if (res.ok) {
      console.log(`  ✅ ElevenLabs OK — HTTP ${res.status}, body length: ${body.length}`);
    } else {
      console.log(`  ❌ ElevenLabs FAILED — HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
  } catch (e) {
    console.log(`  ❌ ElevenLabs ERROR: ${e.message}`);
  }
}

// ── 2) Google Translate TTS ──────────────────────────────────────
async function testGoogleTTS() {
  console.log("\n🔊 [2] Testing Google Translate TTS...");
  try {
    const encoded = encodeURIComponent(TEST_TEXT);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ar&q=${encoded}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Referer": "https://translate.google.com/",
      },
      signal: AbortSignal.timeout(10000),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    if (res.ok && buf.length > 100) {
      console.log(`  ✅ Google TTS OK — HTTP ${res.status}, audio: ${buf.length} bytes`);
    } else {
      console.log(`  ❌ Google TTS FAILED — HTTP ${res.status}, bytes: ${buf.length}`);
    }
  } catch (e) {
    console.log(`  ❌ Google TTS ERROR: ${e.message}`);
  }
}

// ── 3) Microsoft Edge TTS ────────────────────────────────────────
async function testMicrosoftTTS() {
  console.log("\n🔊 [3] Testing Microsoft Edge TTS...");
  try {
    const mod = await import("edge-tts");
    const EdgeTTS = mod.default ?? mod.EdgeTTS ?? mod;
    const tmpFile = path.join(os.tmpdir(), `tts_test_${Date.now()}.mp3`);
    const tts = new EdgeTTS("ar-SA-HamedNeural");
    await tts.ttsPromise(TEST_TEXT, tmpFile);
    if (fs.existsSync(tmpFile)) {
      const size = fs.statSync(tmpFile).size;
      fs.unlinkSync(tmpFile);
      if (size > 500) {
        console.log(`  ✅ Microsoft Edge TTS OK — audio: ${size} bytes`);
      } else {
        console.log(`  ❌ Microsoft Edge TTS produced empty file (${size} bytes)`);
      }
    } else {
      console.log(`  ❌ Microsoft Edge TTS: no output file`);
    }
  } catch (e) {
    console.log(`  ❌ Microsoft Edge TTS ERROR: ${e.message}`);
  }
}

// ── Run all ──────────────────────────────────────────────────────
async function main() {
  console.log("🧪 TTS Diagnostic — Testing all engines");
  console.log(`   Text: "${TEST_TEXT}"`);
  await testElevenLabs();
  await testGoogleTTS();
  await testMicrosoftTTS();
  console.log("\n✅ Diagnostic complete.");
}

main().catch(console.error);
