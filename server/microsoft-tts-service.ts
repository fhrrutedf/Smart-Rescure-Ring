import * as os from "os";
import * as path from "path";
import * as fs from "fs";

/**
 * Microsoft Edge TTS Service (Saudi Arabic - حامد)
 *
 * BUG 3 FIX: The original implementation used raw 'ws' WebSocket connections which
 * fail silently on Vercel's serverless infrastructure (persistent connections are not
 * supported). We now use the 'edge-tts' package (already in dependencies) which wraps
 * the same Edge TTS protocol but is designed to work in serverless environments.
 */

const VOICES = [
  "ar-SA-HamedNeural",   // حامد — صوت سعودي ذكوري
  "ar-SA-ZariyahNeural", // زارية — صوت سعودي أنثوي
];

/**
 * Generates speech using Microsoft's Edge TTS service via the edge-tts package.
 * Returns an audio Buffer on success, or null on failure.
 */
export async function generateMicrosoftSpeech(text: string): Promise<Buffer | null> {
  if (!text || text.trim().length === 0) return null;
  const cleanText = text.trim().substring(0, 1000);

  // Dynamic import of edge-tts to avoid issues if the package fails to load
  let EdgeTTS: any;
  try {
    // edge-tts exports a default class
    const mod = await import("edge-tts");
    EdgeTTS = mod.default ?? mod.EdgeTTS ?? mod;
  } catch (importErr) {
    console.error("[Microsoft TTS] Failed to import edge-tts:", importErr);
    return null;
  }

  for (const voice of VOICES) {
    try {
      console.log(`[Microsoft TTS] Generating with voice "${voice}" via edge-tts...`);

      // edge-tts writes to a temp file; we read it back as a Buffer
      const tmpFile = path.join(os.tmpdir(), `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`);

      const tts = new EdgeTTS(voice);
      await tts.ttsPromise(cleanText, tmpFile);

      if (!fs.existsSync(tmpFile)) {
        throw new Error("edge-tts did not produce an output file");
      }

      const buffer = fs.readFileSync(tmpFile);
      fs.unlinkSync(tmpFile); // clean up temp file

      if (buffer && buffer.length > 500) {
        console.log(`[Microsoft TTS] ✅ Success via edge-tts — ${buffer.length} bytes`);
        return buffer;
      }
    } catch (error: any) {
      console.error(`[Microsoft TTS] Voice "${voice}" failed:`, error?.message || error);
    }
  }

  return null;
}
