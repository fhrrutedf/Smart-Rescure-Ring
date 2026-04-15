import { WebSocket } from "ws";
import * as crypto from "crypto";

/**
 * Microsoft Edge TTS Service (Saudi Arabic - حامد)
 * Custom robust implementation using direct WebSockets to bypass 403 errors.
 * Logic based on reverse-engineered Edge TTS protocol with Sec-MS-GEC headers.
 */

const VOICES = [
  "ar-SA-HamedNeural",     // حامد — صوت سعودي ذكوري
  "ar-SA-ZariyahNeural",   // زارية — صوت سعودي أنثوي
];

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const SALT = "208A2A77-2E36-4749-8086-4F25A0B1A7C6";

/**
 * Generates the Sec-MS-GEC header value required to bypass 403 errors.
 */
function generateSecMsGecToken(): string {
  const timestamp = Math.floor(Date.now() / 1000);
  const minute = Math.floor(timestamp / 60) * 60;
  const input = minute + SALT;
  return crypto.createHash("sha256").update(input).digest("hex").toUpperCase();
}

/**
 * Synthesizes text to speech using Edge TTS WebSocket API.
 */
async function synthesize(text: string, voice: string): Promise<Buffer> {
  const connectionId = crypto.randomUUID().replace(/-/g, "");
  const url = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&ConnectionId=${connectionId}`;
  
  const gecToken = generateSecMsGecToken();
  const headers = {
    "Pragma": "no-cache",
    "Cache-Control": "no-cache",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
    "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
    "Sec-MS-GEC": gecToken,
    "Sec-MS-GEC-Version": "1-130.0.2849.68"
  };

  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    let audioData = Buffer.alloc(0);
    let downloadStarted = false;

    const timeout = setTimeout(() => {
      ws.terminate();
      reject(new Error("TTS Timeout"));
    }, 15000);

    ws.on("open", () => {
      const configReq = {
        context: {
          synthesis: {
            audio: {
              metadataoptions: { sentenceBoundaryEnabled: false, wordBoundaryEnabled: false },
              outputFormat: "audio-24khz-48kbitrate-mono-mp3",
            },
          },
        },
      };

      const configMsg = `X-Timestamp:${new Date().toISOString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n${JSON.stringify(configReq)}`;
      ws.send(configMsg);

      const ssmlMsg = `X-Timestamp:${new Date().toISOString()}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ar-SA'><voice name='${voice}'><prosody rate='0%' pitch='0Hz' volume='0%'>${text}</prosody></voice></speak>`;
      ws.send(ssmlMsg);
    });

    ws.on("message", (data: any, isBinary: boolean) => {
      if (isBinary) {
        const buffer = data as Buffer;
        const separator = 'Path:audio\r\n';
        const index = buffer.indexOf(separator);
        if (index !== -1) {
          audioData = Buffer.concat([audioData, buffer.subarray(index + separator.length)]);
          downloadStarted = true;
        }
      } else {
        const msg = data.toString();
        if (msg.includes("turn.end")) {
          clearTimeout(timeout);
          ws.close();
          resolve(audioData);
        }
      }
    });

    ws.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Generates speech using Microsoft's Edge TTS service.
 */
export async function generateMicrosoftSpeech(text: string): Promise<Buffer | null> {
  if (!text || text.trim().length === 0) return null;
  const cleanText = text.trim().substring(0, 1000);

  for (const voice of VOICES) {
    try {
      console.log(`[Microsoft TTS] Generating with voice "${voice}" (Robust Core)...`);
      const buffer = await synthesize(cleanText, voice);
      if (buffer && buffer.length > 500) {
        console.log(`[Microsoft TTS] ✅ Success! — ${buffer.length} bytes`);
        return buffer;
      }
    } catch (error: any) {
      console.error(`[Microsoft TTS] Voice "${voice}" failed:`, error?.message || error);
    }
  }

  return null;
}
