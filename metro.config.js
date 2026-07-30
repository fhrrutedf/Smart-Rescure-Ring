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
// Force Babel to transpile packages that use ES6+ class syntax and private
// class fields (#x, #y, etc.) which Hermes cannot compile unless transpiled.
// NOTE: scoped packages like @expo/* are matched via "@expo" prefix below.
const packagesToTranspile = [
  "expo",
  "expo-router",
  "expo-asset",
  "expo-modules-core",
  "expo-camera",
  "expo-av",
  "expo-blur",
  "expo-font",
  "expo-haptics",
  "expo-image",
  "expo-image-picker",
  "expo-image-manipulator",
  "expo-linear-gradient",
  "expo-location",
  "expo-speech",
  "expo-splash-screen",
  "expo-system-ui",
  "expo-web-browser",
  "expo-keep-awake",
  "expo-constants",
  "expo-file-system",
  "expo-linking",
  "react-native",
  "react-native-reanimated",
  "react-native-worklets",
  "react-native-gesture-handler",
  "react-native-screens",
  "react-native-safe-area-context",
  "react-native-keyboard-controller",
  "react-native-svg",
  "@react-native",
  "@react-navigation",
  "@expo",
  "@expo-google-fonts",
  "@react-native-async-storage",
];

// Build a regex that ignores node_modules EXCEPT the packages above.
// This ensures Babel transpiles those packages for Hermes compatibility.
config.transformer.transformIgnorePatterns = [
  `node_modules/(?!(${packagesToTranspile.join("|")})/)`
];

module.exports = config;
