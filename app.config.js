const { generateGoogleServices } = require('./scripts/generate-google-services');

module.exports = ({ config }) => {
  // Get environment variables at build time
  // These come from EAS secrets during build
  let EXPO_PUBLIC_SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  let EXPO_PUBLIC_SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  let EXPO_PUBLIC_EXPO_PROJECT_ID = process.env.EXPO_PUBLIC_EXPO_PROJECT_ID || '';
  let EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
  let EXPO_PUBLIC_DELETE_ACCOUNT_URL = process.env.EXPO_PUBLIC_DELETE_ACCOUNT_URL || 'https://safezone.app/delete-account';
  const googleServicesApiKey = generateGoogleServices();

  // Remove placeholder syntax if present (shouldn't happen but safety check)
  EXPO_PUBLIC_SUPABASE_URL = EXPO_PUBLIC_SUPABASE_URL.replace(/\$\{EXPO_PUBLIC_SUPABASE_URL\}/g, '').trim();
  EXPO_PUBLIC_SUPABASE_ANON_KEY = EXPO_PUBLIC_SUPABASE_ANON_KEY.replace(/\$\{EXPO_PUBLIC_SUPABASE_ANON_KEY\}/g, '').trim();
  EXPO_PUBLIC_EXPO_PROJECT_ID = EXPO_PUBLIC_EXPO_PROJECT_ID.replace(/\$\{EXPO_PUBLIC_EXPO_PROJECT_ID\}/g, '').trim();
  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.replace(/\$\{EXPO_PUBLIC_GOOGLE_MAPS_API_KEY\}/g, '').trim();

  console.log('');
  console.log('================================================');
  console.log('📦 Building app configuration...');
  console.log('================================================');
  console.log('Environment variables:');
  console.log(`  EXPO_PUBLIC_SUPABASE_URL: ${EXPO_PUBLIC_SUPABASE_URL ? `✅ Set (${EXPO_PUBLIC_SUPABASE_URL.substring(0, 30)}...)` : '❌ Missing - App will NOT connect!'}`);
  console.log(`  EXPO_PUBLIC_SUPABASE_ANON_KEY: ${EXPO_PUBLIC_SUPABASE_ANON_KEY ? `✅ Set (${EXPO_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...)` : '❌ Missing - App will NOT connect!'}`);
  console.log(`  EXPO_PUBLIC_EXPO_PROJECT_ID: ${EXPO_PUBLIC_EXPO_PROJECT_ID ? `✅ Set (${EXPO_PUBLIC_EXPO_PROJECT_ID})` : '❌ Missing'}`);
  console.log(`  EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: ${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? `✅ Set (${EXPO_PUBLIC_GOOGLE_MAPS_API_KEY.substring(0, 20)}...)` : '❌ Missing - Maps will NOT work!'}`);
  console.log(`  GOOGLE_SERVICES_API_KEY: ${googleServicesApiKey ? `✅ Set (${googleServicesApiKey.substring(0, 20)}...)` : '❌ Missing - Firebase push may NOT work!'}`);
  console.log('================================================');
  
  // Warn if critical variables are missing
  if (!EXPO_PUBLIC_SUPABASE_URL || !EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    console.error('');
    console.error('⚠️  WARNING: Critical environment variables are missing!');
    console.error('⚠️  The app will NOT be able to connect to Supabase.');
    console.error('⚠️  Make sure EAS secrets are set for this project.');
    console.error('');
  }
  
  console.log('');

  return {
    ...config,
    name: "FamGuards",
    slug: "famguard",
    version: "1.0.5",
    sdkVersion: "54.0.0",
    orientation: "portrait",
    userInterfaceStyle: "light",
    icon: "./assets/icon.png",
    splash: {
      image: "./assets/home/splash.png",
      resizeMode: "cover",
      backgroundColor: "#FFFFFF"
    },
    assetBundlePatterns: [
      "assets/**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.famguardacehubtech",
      config: {
        googleMapsApiKey: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "FamGuards needs your location to share it with family members and show nearby safety incidents.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "FamGuards needs your location to share it with family members even when the app is in the background.",
        NSLocationAlwaysUsageDescription: "FamGuards needs your location to share it with family members and keep them updated about your safety.",
        NSPhotoLibraryUsageDescription: "FamGuards needs access to your photos so you can attach evidence to incident reports.",
        NSCameraUsageDescription: "FamGuards needs camera access so you can take photos for incident reports.",
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#DC2626"
      },
      package: "com.famguardacehubtech",
      googleServicesFile: "./google-services.json",
      config: {
        googleMaps: {
          apiKey: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      },
      permissions: [
        "INTERNET",
        "ACCESS_NETWORK_STATE",
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "ACCESS_BACKGROUND_LOCATION",
        "VIBRATE",
        "RECEIVE_BOOT_COMPLETED",
        "POST_NOTIFICATIONS",
        "android.permission.INTERNET",
        "android.permission.ACCESS_NETWORK_STATE",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.VIBRATE",
        "android.permission.RECEIVE_BOOT_COMPLETED",
        "android.permission.POST_NOTIFICATIONS"
      ],
      versionCode: 13
    },
    web: {},
    plugins: [
      "expo-font",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUseUsageDescription: "FamGuards needs your location to share it with family members and show nearby safety incidents.",
          locationWhenInUsePermission: "FamGuards needs your location to share it with family members and show nearby safety incidents."
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#DC2626",
          sounds: ["./assets/alert.wav"],
          mode: "production"
        }
      ],
      [
        "expo-image-picker",
        {
          photosPermission: "FamGuards needs access to your photos so you can attach evidence to incident reports.",
          cameraPermission: "FamGuards needs camera access so you can take photos for incident reports."
        }
      ],
      "./plugins/with-network-access.js",
      "./plugins/with-network-security-config.js",
      "./plugins/with-google-maps-api-key.js"
    ],
    extra: {
      // CRITICAL: Embed actual values at build time (NOT placeholders)
      // These values come from EAS environment variables during build
      // The app reads them via Constants.expoConfig.extra at runtime
      EXPO_PUBLIC_SUPABASE_URL: EXPO_PUBLIC_SUPABASE_URL || '',
      EXPO_PUBLIC_SUPABASE_ANON_KEY: EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      EXPO_PUBLIC_EXPO_PROJECT_ID: EXPO_PUBLIC_EXPO_PROJECT_ID || '',
      EXPO_PUBLIC_DELETE_ACCOUNT_URL: EXPO_PUBLIC_DELETE_ACCOUNT_URL || 'https://safezone.app/delete-account',
      EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '',
      eas: {
        projectId: "84162762-f743-411c-8b9a-0ed643cdb7a2"
      }
    },
    owner: "acehub-technologies-ltd-uk"
  };
};

