// ElevenLabs Text-to-Speech Service
// https://elevenlabs.io/docs/api-reference/text-to-speech

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";

// Known valid ElevenLabs voice IDs for Arabic/Multilingual
// The custom voice ID in .env may be invalid — we try it first, then fall back
const FALLBACK_VOICE_IDS = [
  "pNInz6obpgDQGcFmaJgB", // Adam  — Multilingual (most reliable)
  "EXAVITQu4vr4xnSDxMaL", // Bella — Multilingual
  "TxGEqnHWrfWFTfGW9XjX", // Josh  — Multilingual
];

function getApiKey(): string | null {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.warn("⚠️ ELEVENLABS_API_KEY not set. AI voice will be disabled.");
    return null;
  }
  return apiKey;
}

function getVoiceIds(): string[] {
  const envVoiceId = process.env.ELEVENLABS_VOICE_ID;

  // ElevenLabs voice IDs are typically 20-22 alphanumeric characters
  // If the env value looks valid, try it first; otherwise skip it
  const isValidVoiceId = envVoiceId && /^[a-zA-Z0-9]{15,25}$/.test(envVoiceId);

  if (isValidVoiceId) {
    console.log(`[ElevenLabs] Using custom voice: ${envVoiceId}`);
    return [envVoiceId!, ...FALLBACK_VOICE_IDS];
  }

  if (envVoiceId) {
    console.warn(
      `[ElevenLabs] ELEVENLABS_VOICE_ID "${envVoiceId.slice(0, 20)}..." looks invalid (${envVoiceId.length} chars). Using default Adam voice.`
    );
  }

  return FALLBACK_VOICE_IDS;
}

async function callElevenLabs(
  text: string,
  voiceId: string,
  apiKey: string
): Promise<Buffer | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    // Try the stream endpoint — it sometimes has less aggressive Cloudflare rules
    const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}/stream`, {
      method: "POST",
      headers: {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[ElevenLabs] Voice "${voiceId}" failed: HTTP ${response.status} — ${errorText.slice(0, 300)}`
      );
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(audioBuffer);

    if (buffer.length < 100) {
      console.warn(`[ElevenLabs] Audio too small (${buffer.length} bytes), possibly empty.`);
      return null;
    }

    console.log(`[ElevenLabs] ✅ Success with voice "${voiceId}" — ${buffer.length} bytes`);
    return buffer;
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === "AbortError") {
      console.error(`[ElevenLabs] Voice "${voiceId}" timed out.`);
    } else {
      console.error(`[ElevenLabs] Voice "${voiceId}" error:`, error?.message ?? error);
    }
    return null;
  }
}

export async function generateSpeech(text: string): Promise<Buffer | null> {
  const apiKey = getApiKey();
  if (!apiKey) return null;

  if (!text || text.trim().length === 0) {
    console.warn("[ElevenLabs] Empty text provided.");
    return null;
  }

  const voiceIds = getVoiceIds();

  // Try each voice ID until one works
  for (const voiceId of voiceIds) {
    const buffer = await callElevenLabs(text, voiceId, apiKey);
    if (buffer) return buffer;
  }

  console.error("[ElevenLabs] All voice IDs failed.");
  return null;
}
