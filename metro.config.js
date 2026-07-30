// metro.config.js — Smart Rescuer Ring
// ✅ CommonJS (module.exports) — works on Windows + EAS Build + Expo SDK 54
// ✅ Avoids "Received protocol 'd:'" error caused by "type":"module" in package.json
// ✅ Compatible with expo-router, expo-camera, EAS development builds

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// path.resolve() converts Windows backslash paths to proper absolute paths
// that Metro can safely convert to file:// URLs internally.
const projectRoot = path.resolve(__dirname);

const config = getDefaultConfig(projectRoot);

// ── Resolver ──────────────────────────────────────────────────────────────────
config.resolver = {
  ...config.resolver,
  sourceExts: [
    ...(config.resolver.sourceExts ?? [
      "js", "jsx", "ts", "tsx", "cjs", "json",
    ]),
    "mjs",
  ],
};

// ── Transformer ───────────────────────────────────────────────────────────────
config.transformer = {
  ...config.transformer,
  // Required by expo-router for file-based routing require() contexts
  unstable_allowRequireContext: true,
};

// ── Transform Ignore Patterns ─────────────────────────────────────────────────
// Force Babel to transpile packages that use private class fields (#x, #y, etc.)
// which Hermes does not support natively.
const packagesToTranspile = [
  "expo",
  "expo-router",
  "expo-asset",
  "react-native",
  "react-native-reanimated",
  "react-native-worklets",
  "react-native-gesture-handler",
  "@react-native",
  "@expo",
  "react-native-svg",
];

config.transformer.transformIgnorePatterns = [
  `node_modules/(?!(${packagesToTranspile.join("|")})/)`
];

module.exports = config;

