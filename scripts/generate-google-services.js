const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'google-services.json');
const TEMPLATE_PATH = path.join(ROOT, 'google-services.json.example');

function readEnvVar(name) {
  let value = process.env[name];
  if (value) {
    return value.trim().replace(/^["']|["']$/g, '');
  }

  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(new RegExp(`^${name}=(.+)$`, 'm'));
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, '');
    }
  }

  return '';
}

function loadTemplate() {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error('google-services.json.example not found');
  }

  return JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
}

function generateGoogleServices() {
  const apiKey = readEnvVar('GOOGLE_SERVICES_API_KEY');

  if (!apiKey) {
    console.error('❌ GOOGLE_SERVICES_API_KEY is not set.');
    console.error('   Add it to .env: GOOGLE_SERVICES_API_KEY=your_firebase_android_api_key');
    console.error('   For EAS builds, set it as a project secret: eas env:create ... GOOGLE_SERVICES_API_KEY');
    throw new Error('GOOGLE_SERVICES_API_KEY is required to generate google-services.json');
  }

  const preview = apiKey.length > 20 ? `${apiKey.substring(0, 20)}...` : `${apiKey.substring(0, 8)}...`;
  console.log(`✅ Generating google-services.json from GOOGLE_SERVICES_API_KEY (${preview})`);

  const config = loadTemplate();
  const client = config.client?.[0];

  if (!client?.api_key?.[0]) {
    throw new Error('google-services.json.example is missing client.api_key[0]');
  }

  client.api_key[0].current_key = apiKey;

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(config, null, 2)}\n`);
  return apiKey;
}

module.exports = { generateGoogleServices };

if (require.main === module) {
  try {
    generateGoogleServices();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
