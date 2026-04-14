const { generateMicrosoftSpeech } = require('./server/microsoft-tts-service');

async function test() {
  console.log("Testing Hamed TTS directly...");
  try {
    const res = await generateMicrosoftSpeech("تحذير طبي، كيف الحال");
    console.log("SUCCESS length:", res ? res.length : "null");
  } catch (e) {
    console.error("ERROR:", e);
  }
}

test();
