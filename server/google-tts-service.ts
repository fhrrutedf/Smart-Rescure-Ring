/**
 * Google Translate TTS Service
 * Uses Google's unofficial TTS endpoint — no API key required.
 * Supports Arabic (ar-SA), English, and many other languages.
 */

const GTTS_BASE_URL = "https://translate.google.com/translate_tts";

type Language = "ar" | "en" | "ar-SA";

function buildGoogleTTSUrl(text: string, lang: string = "ar"): string {
  const encoded = encodeURIComponent(text);
  return `${GTTS_BASE_URL}?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encoded}`;
}

/**
 * Split long text into chunks of max 200 characters (Google TTS limit per request)
 */
function splitText(text: string, maxLen = 180): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    if ((current + " " + word).trim().length > maxLen) {
      if (current) chunks.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
  }

  if (current) chunks.push(current.trim());
  return chunks.filter(c => c.length > 0);
}

export async function generateGoogleTTS(
  text: string,
  lang: string = "ar"
): Promise<Buffer | null> {
  if (!text || text.trim().length === 0) {
    console.warn("[GoogleTTS] Empty text provided.");
    return null;
  }

  const cleanText = text.trim().substring(0, 500); // safety cap
  const chunks = splitText(cleanText);
  const audioBuffers: Buffer[] = [];

  console.log(`[GoogleTTS] Synthesizing ${chunks.length} chunk(s) in "${lang}"...`);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const url = buildGoogleTTSUrl(chunk, lang);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Referer": "https://translate.google.com/",
          "Accept": "audio/mpeg, audio/*;q=0.9, */*;q=0.8",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[GoogleTTS] Chunk ${i + 1} failed: HTTP ${response.status}`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length > 100) {
        audioBuffers.push(buffer);
        console.log(`[GoogleTTS] Chunk ${i + 1}/${chunks.length} — ${buffer.length} bytes ✅`);
      } else {
        console.warn(`[GoogleTTS] Chunk ${i + 1} returned empty audio (${buffer.length} bytes)`);
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        console.error(`[GoogleTTS] Chunk ${i + 1} timed out`);
      } else {
        console.error(`[GoogleTTS] Chunk ${i + 1} error:`, error?.message ?? error);
      }
    }
  }

  if (audioBuffers.length === 0) {
    console.error("[GoogleTTS] No audio chunks received.");
    return null;
  }

  const combined = Buffer.concat(audioBuffers);
  console.log(`[GoogleTTS] ✅ Total audio: ${combined.length} bytes from ${audioBuffers.length} chunk(s)`);
  return combined;
}
