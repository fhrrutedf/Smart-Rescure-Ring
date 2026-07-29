import fs from 'fs';
import path from 'path';

const envExamplePath = path.resolve(process.cwd(), '.env.example');
const envPath = path.resolve(process.cwd(), '.env');

if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
  console.log('Creating .env from .env.example...');
  fs.copyFileSync(envExamplePath, envPath);
  console.log('✅ .env file created successfully. Please update your API keys.');
} else if (fs.existsSync(envPath)) {
  console.log('ℹ️ .env file already exists. Skipping creation.');
} else {
  console.error('❌ Could not find .env.example to copy from.');
}
