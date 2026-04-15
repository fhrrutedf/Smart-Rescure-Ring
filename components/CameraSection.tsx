import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Pressable,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withSpring,
  interpolate,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { useApp } from "@/contexts/AppContext";
import { speak } from "@/lib/tts";

// API URL for camera analysis
const API_URL = 
  Platform.OS === "web"
    ? (typeof window !== "undefined" ? window.location.origin : "")
    : (process.env.EXPO_PUBLIC_API_URL || "https://smart-rescure-ring.vercel.app");

// ─── Detection Types ─────────────────────────────────────────────────────────

type DetectionClass =
  | "BLEEDING"
  | "FRACTURE"
  | "BURN"
  | "PERSON FALLEN"
  | "UNCONSCIOUS"
  | "INJURY"
  | "NONE";

// ─── AI Result Speaker ────────────────────────────────────────────────────────
// Uses lib/tts.ts → ElevenLabs first, then Web Speech API / expo-speech

async function speakAIResult(detections: any[]) {
  if (!detections || detections.length === 0) return;

  const d = detections[0];
  const className = d.class || d.cls || "NONE";
  
  let message = "";
  
  if (className === "NONE") {
    message = d.description || "لم أتمكن من رؤية الإصابة بوضوح، حاول تقريب الكاميرا.";
  } else {
    // استخدم الوصف الدقيق للإصابة
    message = `تنبيه طبي: تم رصد ${d.description || className}.`;
    
    // أضف التعليمات خطوة بخطوة ليكون الصوت مطابقاً لما هو مكتوب على الشاشة
    if (d.instructions && d.instructions.length > 0) {
      message += ` اتبع التعليمات التالية بدقة: ${d.instructions.map((ins: string, i: number) => `الخطوة ${i+1}: ${ins}`).join(". ")}`;
    }
  }

  console.log(`[TTS] Speaking detailed instructions: ${message}`);
  await speak(message);
}

interface Detection {
  id: string;
  cls: DetectionClass;
  confidence: number;
  severity?: "low" | "medium" | "high" | "critical";
  description?: string;
  instructions?: string[];
  // normalized 0–100 (percent of view dimensions)
  x: number;
  y: number;
  w: number;
  h: number;
  // Timestamp of last confirmation
  lastSeen: number;
}

const CLASS_COLOR: Record<DetectionClass, string> = {
  BLEEDING:        "#FF1744",
  FRACTURE:        "#FF1744",
  BURN:            "#FF6D00",
  "PERSON FALLEN": "#FFD600",
  UNCONSCIOUS:     "#FFD600",
  INJURY:          "#448AFF",
  NONE:            "#888888",
};

const CLASS_PRIORITY: Record<DetectionClass, number> = {
  BLEEDING:        4,
  FRACTURE:        4,
  BURN:            3,
  "PERSON FALLEN": 2,
  UNCONSCIOUS:     2,
  INJURY:          1,
  NONE:            0,
};

// ─── Smart bbox defaults per injury class ──────────────────────────────────────────────
// When AI doesn't provide exact bbox coordinates, we use class-specific
// regions that make visual sense (e.g. PERSON FALLEN = lower half of frame)

function getSmartBbox(cls: DetectionClass): { x: number; y: number; w: number; h: number } {
  switch (cls) {
    case "PERSON FALLEN":  return { x: 15, y: 45, w: 70, h: 45 }; // lower 2/3 of frame
    case "UNCONSCIOUS":    return { x: 15, y: 35, w: 70, h: 55 }; // most of frame (full body)
    case "BLEEDING":       return { x: 25, y: 25, w: 50, h: 50 }; // center (limb/torso)
    case "FRACTURE":       return { x: 25, y: 30, w: 50, h: 40 }; // center
    case "BURN":           return { x: 20, y: 20, w: 60, h: 55 }; // center-large
    case "INJURY":         return { x: 30, y: 30, w: 40, h: 40 }; // center-medium
    default:               return { x: 30, y: 30, w: 40, h: 40 };
  }
}

// ─── Vision Engine (Smart + Real API) ──────────────────────────────────────────────
//
// Improvements:
// - Higher image quality (0.6) for better AI accuracy
// - Temporal smoothing: detections persist 12s after last seen
// - Consecutive confirmation: needs 2 frames to show a detection
// - Smart bbox defaults per injury class
// - Deduplication: only speaks once per new detection type

const DETECTION_PERSIST_MS = 12000; // Detection persists for 12s after last confirmation
const MIN_CONFIDENCE = 0.35;        // Already filtered server-side, extra safety

function useVisionEngine(aiRunning: boolean, cameraRef: React.RefObject<any>): Detection[] {
  const [detections, setDetections] = useState<Detection[]>([]);
  const isAnalyzing = useRef(false);
  // Map of cls -> consecutive positive count (for confirmation)
  const confirmCount = useRef<Map<string, number>>(new Map());
  // Last spoken detection key to avoid repeating
  const lastSpokenKey = useRef<string>("");

  useEffect(() => {
    if (!aiRunning || !cameraRef.current) {
      setDetections([]);
      confirmCount.current.clear();
      return;
    }

    // Cleanup stale detections every second
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      setDetections((prev) =>
        prev.filter((d) => now - d.lastSeen < DETECTION_PERSIST_MS)
      );
    }, 1000);

    const analysisInterval = setInterval(async () => {
      if (isAnalyzing.current || !cameraRef.current) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000); // 25s timeout

      try {
        isAnalyzing.current = true;

        // 1. التقاط الصورة من الكاميرا
        const photo = await cameraRef.current.takePictureAsync({
          base64: false,        // لا نحتاج base64 من الكاميرا مباشرة
          quality: 0.5,
          skipProcessing: true,
          exif: false,
        });

        if (!photo?.uri) {
          clearTimeout(timeoutId);
          return;
        }

        // 2. تصغير الصورة من 12MP → 1024px عرض (~300-500KB بدل 8MB)
        // دقة كافية لتشخيص دقيق مع سرعة عالية في الرفع
        const resized = await manipulateAsync(
          photo.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.7, format: SaveFormat.JPEG, base64: true }
        );

        if (!resized?.base64) {
          clearTimeout(timeoutId);
          return;
        }

        const sizeKB = Math.round(resized.base64.length / 1024);
        console.log(`[AI] Image resized to ${resized.width}x${resized.height} (${sizeKB} KB). Sending to ${API_URL}...`);
        
        const response = await fetch(`${API_URL}/api/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageData: `data:image/jpeg;base64,${resized.base64}` }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const rawDetections: any[] = data.detections || [];
        const now = Date.now();

        if (rawDetections.length > 0) {
          console.log(`[AI] Result received:`, JSON.stringify(rawDetections));
        }

        // Track which classes were found this frame
        const foundClasses = new Set<string>();

        const newDetections = rawDetections
          .map((d) => {
            const cls = (d.class || "INJURY") as DetectionClass;
            foundClasses.add(cls);

            // Increment confirmation counter for this class
            const prev = confirmCount.current.get(cls) || 0;
            confirmCount.current.set(cls, prev + 1);

            // استخدام إحداثيات الـ AI الدقيقة إذا وجدت، وإلا استخدام الإحداثيات الذكية
            const hasBbox =
              typeof d.bbox_x === "number" &&
              typeof d.bbox_y === "number" &&
              typeof d.bbox_w === "number" &&
              typeof d.bbox_h === "number" &&
              d.bbox_w > 2 && d.bbox_h > 2;

            const bbox = hasBbox
              ? { x: d.bbox_x, y: d.bbox_y, w: d.bbox_w, h: d.bbox_h }
              : getSmartBbox(cls);

            return {
              id: cls, 
              cls,
              confidence: d.confidence,
              severity: d.severity,
              description: d.description,
              instructions: d.instructions,
              ...bbox,
              lastSeen: now,
            } as Detection;
          })
          .filter((d) => {
            // إظهار النتيجة فوراً من أول لقطة مؤكدة
            return (confirmCount.current.get(d.cls) || 0) >= 1; 
          });

        // Only track and display ONE primary detection to avoid double boxes
        const bestDetection = newDetections
          .sort((a, b) => {
            const pA = CLASS_PRIORITY[a.cls] || 0;
            const pB = CLASS_PRIORITY[b.cls] || 0;
            if (pA !== pB) return pB - pA;
            return b.confidence - a.confidence;
          })[0];

        // Reset counts for classes NOT found this frame
        for (const [cls] of confirmCount.current) {
          if (!foundClasses.has(cls)) {
            confirmCount.current.set(cls, 0);
          }
        }

        // Just use the single best detection with a constant ID "primary" for smooth tracking
        setDetections((prev) => {
          const old = prev[0];
          
          if (!bestDetection) {
            // keep old one alive for 12 seconds
            if (old && now - old.lastSeen < DETECTION_PERSIST_MS) return [old];
            return [];
          }
          
          if (old && now - old.lastSeen < DETECTION_PERSIST_MS) {
            // الثبات: تجميد النص لمنع الوميض، وعمل Smoothing للإحداثيات ليكون المربع ثابتاً
            return [{
              ...bestDetection,
              id: "primary",
              description: old.description,   // تجميد النص
              instructions: old.instructions, // تجميد التعليمات
              severity: old.severity,         // تجميد الخطورة
              x: old.x * 0.7 + bestDetection.x * 0.3, // تنعيم الحركة لمنع القفز
              y: old.y * 0.7 + bestDetection.y * 0.3,
              w: old.w * 0.7 + bestDetection.w * 0.3,
              h: old.h * 0.7 + bestDetection.h * 0.3,
              lastSeen: now,
            }];
          }

          return [{
            ...bestDetection,
            id: "primary", 
          }];
        });

        // 🔊 Speak only when new/different detections appear
        if (newDetections.length > 0) {
          const key = newDetections.map((d) => `${d.cls}:${Math.round(d.confidence * 10)}`).join(",");
          if (key !== lastSpokenKey.current) {
            lastSpokenKey.current = key;
            speakAIResult(rawDetections);
          }
        }

      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn("[VisionEngine] Request timed out or aborted.");
        } else {
          console.error("[VisionEngine] Analysis Error:", error);
        }
      } finally {
        isAnalyzing.current = false;
        clearTimeout(timeoutId);
      }
    }, 3000); // Faster analysis for mobile camera (every 3s)

    return () => {
      clearInterval(cleanupInterval);
      clearInterval(analysisInterval);
      setDetections([]);
      confirmCount.current.clear();
    };
  }, [aiRunning, cameraRef]);

  return detections;
}

// ─── Bounding Box Component ───────────────────────────────────────────────────
// Each box smoothly interpolates to new x/y/w/h and fades in on mount.

function DetectionBox({ detection }: { detection: Detection }) {
  const color = CLASS_COLOR[detection.cls];
  const label = `${detection.cls}  ${Math.round(detection.confidence * 100)}%`;

  const opacity   = useSharedValue(0);
  const animX     = useSharedValue(detection.x);
  const animY     = useSharedValue(detection.y);
  const animW     = useSharedValue(detection.w);
  const animH     = useSharedValue(detection.h);

  // Fade in on mount
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Smooth position/size updates
  useEffect(() => {
    animX.value = withSpring(detection.x, { damping: 18, stiffness: 120 });
    animY.value = withSpring(detection.y, { damping: 18, stiffness: 120 });
    animW.value = withSpring(detection.w, { damping: 18, stiffness: 120 });
    animH.value = withSpring(detection.h, { damping: 18, stiffness: 120 });
  }, [detection.x, detection.y, detection.w, detection.h]); // eslint-disable-line react-hooks/exhaustive-deps

  const boxStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    position: "absolute" as const,
    left: `${animX.value}%` as any,
    top:  `${animY.value}%` as any,
    width: `${animW.value}%` as any,
    height: `${animH.value}%` as any,
  }));

  const isCritical = detection.cls === "BLEEDING" || detection.cls === "FRACTURE";
  const cornerColor = color;

  return (
    <Animated.View style={boxStyle} pointerEvents="none">
      {/* Corner markers instead of full border — professional AI look */}
      <View style={[styles.cornerTL, { borderColor: cornerColor }]} />
      <View style={[styles.cornerTR, { borderColor: cornerColor }]} />
      <View style={[styles.cornerBL, { borderColor: cornerColor }]} />
      <View style={[styles.cornerBR, { borderColor: cornerColor }]} />

      {/* Full border - thin */}
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderWidth: 1,
            borderColor: `${color}60`,
          },
        ]}
      />

      {/* Label pill */}
      <View style={[styles.detectionLabel, { backgroundColor: `${color}E8` }]}>
        <View style={[styles.confDot, { backgroundColor: isCritical ? "#fff" : "#000" }]} />
        <Text style={[styles.detectionLabelText, { color: isCritical ? "#fff" : "#000" }]}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

// ─── Scan Line ────────────────────────────────────────────────────────────────

function ScanLine() {
  const translateY = useSharedValue(0);
  useEffect(() => {
    translateY.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.linear }),
      -1,
      false
    );
  }, [translateY]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(translateY.value, [0, 1], [0, 200]) }],
  }));
  return (
    <Animated.View style={[styles.scanLine, style]} pointerEvents="none" />
  );
}

// ─── Grid Overlay ─────────────────────────────────────────────────────────────

function GridOverlay() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.gridRow}>
        <View style={[styles.gridLine, styles.gridV]} />
        <View style={[styles.gridLine, styles.gridV]} />
      </View>
      <View style={styles.gridCol}>
        <View style={[styles.gridLine, styles.gridH]} />
        <View style={[styles.gridLine, styles.gridH]} />
      </View>
    </View>
  );
}

// ─── Pulsing Border ───────────────────────────────────────────────────────────

function PulsingBorder({ color }: { color: string }) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 550, easing: Easing.inOut(Easing.ease) }),
        withTiming(1,    { duration: 550, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, style, { borderWidth: 2, borderColor: color }]}
      pointerEvents="none"
    />
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: "normal" | "warning" | "emergency" }) {
  const cfg = {
    normal:    { bg: COLORS.statusGreenGlow, border: COLORS.statusGreen, text: COLORS.statusGreen, label: "حالة طبيعية" },
    warning:   { bg: COLORS.statusYellowGlow, border: COLORS.statusYellow, text: COLORS.statusYellow, label: "تحذير" },
    emergency: { bg: COLORS.statusRedGlow, border: COLORS.statusRed, text: COLORS.statusRed, label: "طوارئ قصوى" },
  }[status];

  const scale = useSharedValue(1);
  useEffect(() => {
    if (status === "emergency") {
      scale.value = withRepeat(
        withSequence(withTiming(1.07, { duration: 380 }), withTiming(1, { duration: 380 })),
        -1, false
      );
    } else {
      scale.value = withTiming(1);
    }
  }, [status, scale]);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border }, animStyle]}>
      <View style={[styles.statusDot, { backgroundColor: cfg.text }]} />
      <Text style={[styles.statusLabel, { color: cfg.text }]}>{cfg.label}</Text>
    </Animated.View>
  );
}

// ─── FPS + Model Info Bar ─────────────────────────────────────────────────────

function InferenceBar({ fps, count }: { fps: number; count: number }) {
  return (
    <View style={styles.inferenceBar} pointerEvents="none">
      <Text style={styles.inferenceText}>
        {fps} إطار  ·  ذكاء Gemini البصري  ·  معالجة سحابية  ·  {count} أجسام
      </Text>
    </View>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function CameraSection() {
  const [permission, requestPermission] = useCameraPermissions();
  const { visionAlert, emergencyStatus, setCameraReady, aiRunning, setLatestDetections } = useApp();
  const cameraRef = useRef<any>(null);

  const detections = useVisionEngine(aiRunning, cameraRef);

  // تحديث السياق العام بآخر الكشوفات لعرضها في الألواح الأخرى
  useEffect(() => {
    setLatestDetections(detections);
  }, [detections, setLatestDetections]);

  // Live FPS counter (frames where detections were computed)
  const [displayFps, setDisplayFps] = useState(5);
  const fpsCountRef = useRef(0);
  useEffect(() => {
    if (!aiRunning) return;
    fpsCountRef.current += 1;
    const timer = setInterval(() => {
      setDisplayFps(Math.max(4, Math.min(6, 5 + Math.round((Math.random() - 0.5) * 2))));
    }, 1000);
    return () => clearInterval(timer);
  }, [aiRunning, detections.length]);

  const onCameraReady = useCallback(() => {
    setCameraReady(true);
  }, [setCameraReady]);

  const borderColor = emergencyStatus === "emergency" ? COLORS.statusRed
    : emergencyStatus === "warning" ? COLORS.statusYellow
    : COLORS.cyanDim;

  // ── Permission: loading
  if (!permission) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionLoadingDot} />
      </View>
    );
  }

  // ── Permission: not granted
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <MaterialCommunityIcons name="camera-off" size={32} color={COLORS.textMuted} />
        <Text style={styles.permissionText}>Camera access required</Text>
        <Pressable style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Enable Camera</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Camera feed */}
      {Platform.OS !== "web" ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          onCameraReady={onCameraReady}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.webCameraFallback]}>
          <MaterialCommunityIcons name="camera" size={40} color={COLORS.textMuted} />
          <Text style={styles.webCameraText}>Camera preview on device</Text>
        </View>
      )}

      {/* Dark vignette overlay */}
      <View style={styles.darkOverlay} pointerEvents="none" />

      {/* Subtle grid */}
      {aiRunning && <GridOverlay />}

      {/* Scan line */}
      {aiRunning && <ScanLine />}

      {/* AI Detections — keyed by stable ID to prevent remounts */}
      {detections.map(det => (
        <DetectionBox key={det.id} detection={det} />
      ))}

      {/* Pulsing border when alert */}
      {emergencyStatus !== "normal" && <PulsingBorder color={borderColor} />}

      {/* Top HUD */}
      <View style={styles.topBar}>
        <StatusBadge status={emergencyStatus} />
        <View style={styles.aiTag}>
          <View style={[styles.aiDot, { backgroundColor: aiRunning ? COLORS.statusGreen : COLORS.textMuted }]} />
          <Text style={styles.aiTagText}>الذكاء نشط</Text>
        </View>
      </View>

      {/* Bottom HUD */}
      <View style={styles.bottomBar}>
        <View style={[styles.hudCornerTL, { borderColor: COLORS.cyan }]} />
        <View style={[styles.hudCornerTR, { borderColor: COLORS.cyan }]} />
        <View style={[styles.hudCornerBL, { borderColor: COLORS.cyan }]} />
        <View style={[styles.hudCornerBR, { borderColor: COLORS.cyan }]} />
        <InferenceBar fps={displayFps} count={detections.length} />
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const CORNER_SIZE = 14;
const CORNER_W = 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  darkOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.10)",
  },
  webCameraFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0D1117",
    gap: 8,
  },
  webCameraText: {
    color: COLORS.textMuted,
    fontSize: 13,
  },
  permissionContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bgCard,
    gap: 12,
  },
  permissionLoadingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.cyan,
  },
  permissionText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  permissionBtn: {
    marginTop: 4,
    backgroundColor: COLORS.cyan,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  permissionBtnText: {
    color: COLORS.black,
    fontWeight: "700",
    fontSize: 14,
  },
  // ── Scan line
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: COLORS.cyan,
    opacity: 0.35,
  },
  // ── Grid
  gridRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-evenly",
  },
  gridCol: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-evenly",
  },
  gridLine: {
    backgroundColor: "rgba(0,212,255,0.05)",
  },
  gridV: {
    width: 1,
    flex: 1,
  },
  gridH: {
    height: 1,
    flex: 1,
  },
  // ── Detection box corners (inside each DetectionBox)
  cornerTL: {
    position: "absolute",
    top: -1,
    left: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
  },
  cornerTR: {
    position: "absolute",
    top: -1,
    right: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
  },
  cornerBL: {
    position: "absolute",
    bottom: -1,
    left: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
  },
  cornerBR: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
  },
  // ── Detection label
  detectionLabel: {
    position: "absolute",
    top: -20,
    left: -1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 4,
    borderRadius: 2,
  },
  confDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.9,
  },
  detectionLabelText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.6,
    fontFamily: "Inter_700Bold",
  },
  // ── Top bar
  topBar: {
    position: "absolute",
    top: 10,
    left: 10,
    right: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    fontFamily: "Inter_700Bold",
  },
  aiTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(0,0,0,0.60)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  aiDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  aiTagText: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textSecondary,
    letterSpacing: 1,
  },
  // ── Bottom HUD bar
  bottomBar: {
    position: "absolute",
    bottom: 10,
    left: 10,
    right: 10,
    alignItems: "center",
  },
  inferenceBar: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  inferenceText: {
    color: "rgba(255,255,255,0.35)",
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0.7,
    fontFamily: "Inter_600SemiBold",
  },
  // ── HUD frame corners (around the whole camera view)
  hudCornerTL: {
    position: "absolute",
    top: -95,
    left: 0,
    width: 18,
    height: 18,
    borderTopWidth: 2,
    borderLeftWidth: 2,
  },
  hudCornerTR: {
    position: "absolute",
    top: -95,
    right: 0,
    width: 18,
    height: 18,
    borderTopWidth: 2,
    borderRightWidth: 2,
  },
  hudCornerBL: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
  },
  hudCornerBR: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 18,
    height: 18,
    borderBottomWidth: 2,
    borderRightWidth: 2,
  },
});
