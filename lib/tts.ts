/**
 * lib/tts.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified Text-To-Speech — ElevenLabs first, fallback to device TTS.
 *
 * Mobile fix: expo-av's Audio.Sound on native needs a file URI, not a blob URL.
 *             We use expo-file-system to save audio → temp file → play.
 *
 * Priority:
 *   1. ElevenLabs  (/api/tts) — high quality, Arabic voice
 *   2. Web Speech API — web/browser fallback (free, built-in)
 *   3. expo-speech  — native device fallback
 */

import { Platform } from "react-native";
import * as Speech from "expo-speech";
import * as FileSystem from "expo-file-system";
import { Audio } from "expo-av";

const API_URL =
  Platform.OS === "web"
    ? process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000"
    : process.env.EXPO_PUBLIC_API_URL || "http://192.168.0.11:5000";

// ─── Prevent audio overlap ───────────────────────────────────────────────────
let activeSound: Audio.Sound | null = null;

async function stopCurrentSound() {
  if (activeSound) {
    try {
      await activeSound.stopAsync();
      await activeSound.unloadAsync();
    } catch {}
    activeSound = null;
  }
}

// ─── Web Speech API fallback ─────────────────────────────────────────────────
function speakWebFallback(text: string): boolean {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return false;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ar-SA";
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const arabicVoice = voices.find(
      (v) => v.lang.startsWith("ar") || v.name.toLowerCase().includes("arabic")
    );
    if (arabicVoice) utterance.voice = arabicVoice;

    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

// ─── Play audio on WEB (blob → object URL) ────────────────────────────────────
async function playAudioWeb(audioBlob: Blob): Promise<void> {
  const audioUri = URL.createObjectURL(audioBlob);
  await stopCurrentSound();
  const { sound } = await Audio.Sound.createAsync({ uri: audioUri });
  activeSound = sound;
  await sound.playAsync();
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      sound.unloadAsync();
      URL.revokeObjectURL(audioUri);
      activeSound = null;
    }
  });
}

// ─── Play audio on NATIVE (base64 → temp file → play) ─────────────────────────
// URL.createObjectURL does NOT work on React Native — must use FileSystem
async function playAudioNative(audioBuffer: ArrayBuffer): Promise<void> {
  const tempFile = `${(FileSystem as any).cacheDirectory}tts_${Date.now()}.mp3`;

  // Convert ArrayBuffer → Base64 safely without btoa
  const base64 = await new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.readAsDataURL(new Blob([audioBuffer]));
  });

  // Write to temp file
  await FileSystem.writeAsStringAsync(tempFile, base64, {
    encoding: (FileSystem as any).EncodingType.Base64,
  });

  // Set up audio mode for playback
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
      // Clean up temp file
      try { await FileSystem.deleteAsync(tempFile, { idempotent: true }); } catch {}
    }
  });
}

// ─── Main speak function ──────────────────────────────────────────────────────
export async function speak(
  text: string,
  options: { timeoutMs?: number } = {}
): Promise<void> {
  const { timeoutMs = 15000 } = options;

  // ── 1. Try ElevenLabs via server
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${API_URL}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log(`[TTS] ElevenLabs audio received successfully.`);
      if (Platform.OS === "web") {
        // Web: blob → object URL
        const audioBlob = await response.blob();
        await playAudioWeb(audioBlob);
      } else {
        // Native: ArrayBuffer → base64 → file → play
        const audioBuffer = await response.arrayBuffer();
        await playAudioNative(audioBuffer);
      }
      return; // ✅ ElevenLabs succeeded
    }

    console.warn(`[TTS] ElevenLabs returned ${response.status}. Using fallback.`);
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn("[TTS] ElevenLabs timed out. Using fallback.");
    } else {
      console.warn("[TTS] ElevenLabs failed:", err?.message ?? err);
    }
  }

  // ── 2. Fallback: Web Speech API (web only)
  if (Platform.OS === "web") {
    const ok = speakWebFallback(text);
    if (ok) {
      console.log("[TTS] Using Web Speech API fallback.");
      return;
    }
  }

  // ── 3. Fallback: expo-speech (native)
  console.log("[TTS] Using expo-speech fallback.");
  Speech.speak(text, { language: "ar-SA", rate: 0.9 });
}

// ─── Stop all speech ─────────────────────────────────────────────────────────
export function stopSpeech() {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    window.speechSynthesis?.cancel();
  }
  Speech.stop();
  stopCurrentSound();
}
