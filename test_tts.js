const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const textFile = path.join(__dirname, 'test_tts_input.txt');
const audioFile = path.join(__dirname, 'test_tts_output.mp3');

// Write Arabic text to file
fs.writeFileSync(textFile, 'تحذير طبي. تم رصد جرح. اتصل بالإسعاف', 'utf-8');
console.log('Text file written:', fs.readFileSync(textFile, 'utf-8'));

try {
  const cmd = `edge-tts --voice ar-SA-HamedNeural --file "${textFile}" --write-media "${audioFile}"`;
  console.log('Running:', cmd);
  const result = execSync(cmd, { encoding: 'utf-8', timeout: 15000 });
  console.log('stdout:', result);
} catch (e) {
  console.error('STDERR:', e.stderr);
  console.error('ERROR:', e.message?.substring(0, 500));
}

if (fs.existsSync(audioFile)) {
  const size = fs.statSync(audioFile).size;
  console.log('✅ SUCCESS! Audio file:', size, 'bytes');
  fs.unlinkSync(audioFile);
} else {
  console.log('❌ No output file created');
}

fs.unlinkSync(textFile);
