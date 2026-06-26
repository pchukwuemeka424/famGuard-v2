const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT, 'google-services.json');

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

function generateGoogleServices() {
  const apiKey = readEnvVar('GOOGLE_SERVICES_API_KEY') || 'YOUR_GOOGLE_SERVICES_API_KEY';

  if (apiKey === 'YOUR_GOOGLE_SERVICES_API_KEY') {
    console.warn('⚠️  GOOGLE_SERVICES_API_KEY not set — using placeholder in google-services.json');
  } else {
    const preview = apiKey.length > 20 ? `${apiKey.substring(0, 20)}...` : apiKey;
    console.log(`✅ Generating google-services.json (key: ${preview})`);
  }

  const config = {
    project_info: {
      project_number: '541350773134',
      project_id: 'famguard-e065d',
      storage_bucket: 'famguard-e065d.firebasestorage.app',
    },
    client: [
      {
        client_info: {
          mobilesdk_app_id: '1:541350773134:android:842c1a3784240bedfce4df',
          android_client_info: {
            package_name: 'com.famguardacehubtech',
          },
        },
        oauth_client: [],
        api_key: [{ current_key: apiKey }],
        services: {
          appinvite_service: {
            other_platform_oauth_client: [],
          },
        },
      },
    ],
    configuration_version: '1',
  };

  fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(config, null, 2)}\n`);
  return apiKey;
}

module.exports = { generateGoogleServices };

if (require.main === module) {
  generateGoogleServices();
}
