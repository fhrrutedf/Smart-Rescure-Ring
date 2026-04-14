import { execFile } from "child_process";
import * as path from "path";
import * as fs from "fs";

/**
 * Microsoft Edge TTS Service (Saudi Arabic - حامد)
 * Uses Python's edge-tts CLI (v7.x) which connects to Microsoft's free TTS service.
 * Voice: ar-SA-HamedNeural — صوت سعودي ذكوري طبيعي
 */

const VOICES = [
  "ar-SA-HamedNeural",     // حامد — صوت سعودي ذكوري
  "ar-SA-ZariyahNeural",   // زارية — صوت سعودي أنثوي
];

function runEdgeTTS(voice: string, textFile: string, audioFile: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "--voice", voice,
      "--file", textFile,
      "--write-media", audioFile,
    ];

    const proc = execFile("edge-tts", args, {
      timeout: 15000,
      encoding: "utf-8",
      windowsHide: true,
    }, (error, stdout, stderr) => {
      // edge-tts may write warnings to stderr but still succeed
      // So check if the output file was created regardless of error
      if (fs.existsSync(audioFile) && fs.statSync(audioFile).size > 100) {
        resolve();
      } else if (error) {
        reject(new Error(`edge-tts exited with error: ${error.message?.substring(0, 200)}`));
      } else {
        reject(new Error("edge-tts produced no output"));
      }
    });
  });
}

export async function generateMicrosoftSpeech(text: string): Promise<Buffer | null> {
  if (!text || text.trim().length === 0) {
    console.warn("[Microsoft TTS] Empty text provided.");
    return null;
  }

  const cleanText = text.trim().substring(0, 1000);
  const uniqueId = Math.random().toString(36).substring(7);
  const tempDir = process.cwd();

  for (const voice of VOICES) {
    const tempTextFile = path.join(tempDir, `tts_input_${uniqueId}.txt`);
    const tempAudioFile = path.join(tempDir, `tts_output_${uniqueId}.mp3`);

    try {
      console.log(`[Microsoft TTS] Generating with voice "${voice}": "${cleanText.substring(0, 40)}..."`);

      // Write Arabic text to file to avoid shell encoding issues
      fs.writeFileSync(tempTextFile, cleanText, "utf-8");

      // Use execFile (not exec) to avoid shell interpretation issues
      await runEdgeTTS(voice, tempTextFile, tempAudioFile);

      // Read the generated audio
      const buffer = fs.readFileSync(tempAudioFile);

      // Cleanup temp files
      try { fs.unlinkSync(tempTextFile); } catch {}
      try { fs.unlinkSync(tempAudioFile); } catch {}

      console.log(`[Microsoft TTS] ✅ حامد says it! Voice "${voice}" — ${buffer.length} bytes`);
      return buffer;

    } catch (error: any) {
      console.error(`[Microsoft TTS] Voice "${voice}" failed:`, error?.message?.substring(0, 300) || error);
      // Cleanup on error
      try { fs.unlinkSync(tempTextFile); } catch {}
      try { fs.unlinkSync(tempAudioFile); } catch {}
    }
  }

  console.error("[Microsoft TTS] All voices failed.");
  return null;
}
