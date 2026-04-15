import { Platform } from "react-native";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system/legacy";
import { Audio } from "expo-av";
import Constants from 'expo-constants';

// Automatically get the correct host IP from Expo debugger or fallback
const getApiUrl = () => {
  // 1. Priority: Environment variable from .env (Vercel Production URL)
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;

  // 2. Web fallback
  if (Platform.OS === 'web') return window.location.origin;
  
  // 3. Expo Go Debugger host (Local Development)
  const debuggerHost = Constants.expoConfig?.hostUri?.split(':').shift();
  if (debuggerHost) return `http://${debuggerHost}:5000`;
  
  // 4. Hard fallback (Change this to your Vercel URL if env var is missing)
  return "https://smart-rescuer-ring.vercel.app"; 
};

const API_URL = getApiUrl();

let activeSound: Audio.Sound | null = null;

// Prevent overlapping speech requests
let isSpeaking = false;

async function stopCurrentSound() {
  if (activeSound) {
    try {
      await activeSound.stopAsync();
      await activeSound.unloadAsync();
    } catch {}
    activeSound = null;
  }
}

async function playAudioNative(base64: string): Promise<void> {
  const tempFile = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;

  await FileSystem.writeAsStringAsync(tempFile, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
  });

  await stopCurrentSound();
  const { sound } = await Audio.Sound.createAsync({ uri: tempFile });
  activeSound = sound;
  await sound.playAsync();

  sound.setOnPlaybackStatusUpdate(async (status) => {
    if (status.isLoaded && status.didJustFinish) {
      await sound.unloadAsync();
      activeSound = null;
      isSpeaking = false;
      try { await FileSystem.deleteAsync(tempFile, { idempotent: true }); } catch {}
    }
  });
}

/**
 * Convert ArrayBuffer to base64 string without using Blob (React Native safe)
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  
  // Process in chunks to avoid call stack overflow for large buffers
  const CHUNK_SIZE = 8192;
  let binary = '';
  for (let i = 0; i < len; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, Math.min(i + CHUNK_SIZE, len));
    // @ts-ignore — React Native's btoa works differently
    for (let j = 0; j < chunk.length; j++) {
      binary += String.fromCharCode(chunk[j]);
    }
  }

  // Use global btoa (available in React Native Hermes engine)
  return btoa(binary);
}

async function playAudioWeb(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const audio = new Audio(url);
    audio.onended = () => {
      isSpeaking = false;
      resolve();
    };
    audio.onerror = (e) => {
      isSpeaking = false;
      reject(e);
    };
    audio.play().catch(reject);
  });
}

export async function speak(text: string): Promise<void> {
  // Prevent overlapping TTS calls
  if (isSpeaking) {
    console.log("[TTS] Already speaking, skipping.");
    return;
  }

  try {
    isSpeaking = true;
    const requestUrl = `${API_URL}/api/tts?text=${encodeURIComponent(text)}`;
    console.log(`[TTS] Requesting Saudi Voice from ${requestUrl}`);

    if (Platform.OS === 'web') {
      await playAudioWeb(requestUrl);
      return;
    }

    // Native implementation (Expo Go)
    const tempFile = `${FileSystem.cacheDirectory}tts_${Date.now()}.mp3`;
    const { status } = await FileSystem.downloadAsync(requestUrl, tempFile);

    if (status === 200) {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
      });

      await stopCurrentSound();
      const { sound } = await Audio.Sound.createAsync({ uri: tempFile });
      activeSound = sound;
      await sound.playAsync();

      sound.setOnPlaybackStatusUpdate(async (playbackStatus: any) => {
        if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
          await sound.unloadAsync();
          activeSound = null;
          isSpeaking = false;
          try { await FileSystem.deleteAsync(tempFile, { idempotent: true }); } catch {}
        }
      });
      return;
    }
  } catch (err: any) {
    console.error("[TTS] Backend fail:", err?.message || err);
    isSpeaking = false;
  }

  // Final fallback — native device speech (works offline)
  try {
    isSpeaking = false; 
    Speech.speak(text, { language: "ar-SA", rate: 0.8 });
  } catch (localErr) {
    console.error("[TTS] Local speech also failed:", localErr);
    isSpeaking = false;
  }
}
