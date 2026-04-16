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

module.exports = config;
